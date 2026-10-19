import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/connection/open_connection.dart';
import 'package:gridview/core/legacy/legacy_preference_migration.dart';
import 'package:gridview/core/legacy/legacy_startup.dart';
import 'package:gridview/core/legacy/legacy_storage.dart';
import 'package:gridview/core/legacy/legacy_storage_cleanup.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';

import 'legacy_test_support.dart';

/// The genuine Hive 2.2.3 `cache` box; see `test/fixtures/legacy/README.md`.
final Uint8List _legacyHiveBox = File(
  'test/fixtures/legacy/cache.hive',
).readAsBytesSync();

/// A reconstruction database the cleanup must never touch.
final Uint8List _driftBytes = Uint8List.fromList(
  'SQLite format 3\u0000 reconstruction data'.codeUnits,
);

void main() {
  late Directory documents;

  setUp(() {
    documents = Directory.systemTemp.createTempSync('gv_legacy_docs_');
  });
  tearDown(() {
    if (documents.existsSync()) documents.deleteSync(recursive: true);
  });

  File doc(String name) => File(p.join(documents.path, name));

  /// The documents directory of a device upgraded from the legacy app, which
  /// was killed with its box open, plus files this app owns.
  void populateLegacyDevice() {
    doc('cache.hive').writeAsBytesSync(_legacyHiveBox);
    doc('cache.lock').writeAsBytesSync(const <int>[]);
    doc('cache.hivec').writeAsBytesSync(_legacyHiveBox);
    doc(kDatabaseFileName).writeAsBytesSync(_driftBytes);
    doc('unrelated.hive').writeAsBytesSync(_legacyHiveBox);
  }

  LegacyStorageCleanup cleanup(
    LegacyMigrationStore store, {
    Future<Directory> Function()? directory,
  }) => LegacyStorageCleanup(
    store: store,
    documentsDirectory: directory ?? () async => documents,
  );

  Map<String, Object> migrated() => <String, Object>{
    'languageCode': 'es',
    'isDarkMode': true,
    PreferenceKeys.language: 'spanish',
    PreferenceKeys.theme: 'dark',
    LegacyMigrationMarker.key: LegacyMigrationMarker.completed,
  };

  test('the fixture is a real Hive box with the legacy cache keys', () {
    // Hive stores String keys in plain ASCII inside each frame.
    final String raw = String.fromCharCodes(_legacyHiveBox);
    for (final String key in <String>[
      'grandprix_cache',
      'drivers_cache',
      'teams_cache',
      'last_cache_update',
    ]) {
      expect(raw, contains(key));
    }
  });

  group('populated legacy storage', () {
    test('after a completed migration the legacy files and keys go', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);

      for (final String name in LegacyHiveFiles.all) {
        expect(doc(name).existsSync(), isFalse, reason: name);
      }
      expect(store.values.containsKey('languageCode'), isFalse);
      expect(store.values.containsKey('isDarkMode'), isFalse);
    });

    test('everything the reconstruction owns is left byte-identical', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      await cleanup(store).run();

      expect(doc(kDatabaseFileName).readAsBytesSync(), _driftBytes);
      expect(doc('unrelated.hive').readAsBytesSync(), _legacyHiveBox);
      expect(store.values[PreferenceKeys.language], 'spanish');
      expect(store.values[PreferenceKeys.theme], 'dark');
      // The marker stays, so a later launch never migrates again.
      expect(
        store.values[LegacyMigrationMarker.key],
        LegacyMigrationMarker.completed,
      );
    });

    test('nothing is removed before the migration completed', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(
        const <String, Object>{'languageCode': 'es', 'isDarkMode': true},
      );

      expect(
        await cleanup(store).run(),
        LegacyCleanupStatus.skippedMigrationIncomplete,
      );

      for (final String name in LegacyHiveFiles.all) {
        expect(doc(name).existsSync(), isTrue, reason: name);
      }
      expect(store.values['languageCode'], 'es');
      expect(store.values['isDarkMode'], true);
    });

    test('an incomplete migration on the real store blocks cleanup', () async {
      seedPrefs(<String, Object>{'languageCode': 'es', 'isDarkMode': true});
      populateLegacyDevice();
      final SharedPreferencesMigrationStore store =
          SharedPreferencesMigrationStore(
            await SharedPreferences.getInstance(),
          );

      expect(
        await cleanup(store).run(),
        LegacyCleanupStatus.skippedMigrationIncomplete,
      );
      expect(doc('cache.hive').existsSync(), isTrue);
    });

    test('migration then cleanup on the real store, end to end', () async {
      seedPrefs(<String, Object>{'languageCode': 'en', 'isDarkMode': false});
      populateLegacyDevice();
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final SharedPreferencesMigrationStore store =
          SharedPreferencesMigrationStore(prefs);

      await LegacyPreferenceMigration(store: store).run();
      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);

      expect(prefs.getKeys(), <String>{
        PreferenceKeys.language,
        PreferenceKeys.theme,
        LegacyMigrationMarker.key,
      });
      expect(prefs.getString(PreferenceKeys.language), 'english');
      expect(prefs.getString(PreferenceKeys.theme), 'light');
      expect(doc('cache.hive').existsSync(), isFalse);
      expect(doc(kDatabaseFileName).existsSync(), isTrue);
    });
  });

  group('incomplete migration', () {
    test('a transient read failure keeps everything until the retry', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(
        const <String, Object>{'languageCode': 'es', 'isDarkMode': true},
        failingReads: <String>{'languageCode'},
      );

      // Launch 1: the read fails, so the migration is incomplete...
      final LegacyMigrationResult first = await LegacyPreferenceMigration(
        store: store,
      ).run();
      expect(first.status, LegacyMigrationStatus.incomplete);

      // ...and the post-frame cleanup removes nothing.
      expect(
        await cleanup(store).run(),
        LegacyCleanupStatus.skippedMigrationIncomplete,
      );
      expect(doc('cache.hive').readAsBytesSync(), _legacyHiveBox);
      expect(doc('cache.hivec').readAsBytesSync(), _legacyHiveBox);
      expect(doc('cache.lock').existsSync(), isTrue);
      expect(store.values['languageCode'], 'es');
      expect(store.values['isDarkMode'], true);

      // Launch 2: the read succeeds, the choice is migrated, then cleaned.
      store.failingReads.clear();
      final LegacyMigrationResult retry = await LegacyPreferenceMigration(
        store: store,
      ).run();
      expect(retry.status, LegacyMigrationStatus.completed);
      expect(store.values[PreferenceKeys.language], 'spanish');
      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
      for (final String name in LegacyHiveFiles.all) {
        expect(doc(name).existsSync(), isFalse, reason: name);
      }
      expect(store.values.containsKey('languageCode'), isFalse);
    });

    test('an unreadable marker removes nothing', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(
        migrated(),
        failingReads: <String>{LegacyMigrationMarker.key},
      );

      expect(await cleanup(store).run(), LegacyCleanupStatus.failed);
      expect(doc('cache.hive').readAsBytesSync(), _legacyHiveBox);
      expect(store.values['languageCode'], 'es');
    });
  });

  group('empty legacy storage', () {
    test('a device with no legacy files or keys is already clean', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(
        const <String, Object>{
          LegacyMigrationMarker.key: LegacyMigrationMarker.completed,
        },
      );

      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
      expect(documents.listSync(), isEmpty);
    });
  });

  group('corrupt legacy storage', () {
    test('a corrupt box is deleted without ever being parsed', () async {
      doc('cache.hive').writeAsBytesSync(
        List<int>.generate(512, (int i) => (i * 37 + 11) % 256),
      );
      doc('cache.lock').writeAsStringSync('not a lock');
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
      expect(doc('cache.hive').existsSync(), isFalse);
      expect(doc('cache.lock').existsSync(), isFalse);
    });

    test('a directory with a legacy file name is left alone', () async {
      Directory(p.join(documents.path, 'cache.hive')).createSync();
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
      expect(
        Directory(p.join(documents.path, 'cache.hive')).existsSync(),
        isTrue,
      );
    });

    test('an unavailable documents directory fails without throwing', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      expect(
        await cleanup(
          store,
          directory: () async => throw const FileSystemException('denied'),
        ).run(),
        LegacyCleanupStatus.failed,
      );
      expect(store.values['languageCode'], 'es');
    });

    test(
      'the production step completes when the platform is unavailable',
      () async {
        // No path_provider implementation exists under `flutter test`, so the
        // real step meets a failing documents directory after a completed
        // migration, and must still complete without removing anything.
        seedPrefs(<String, Object>{
          'languageCode': 'es',
          LegacyMigrationMarker.key: LegacyMigrationMarker.completed,
        });

        await expectLater(cleanUpLegacyStorage(), completes);

        final SharedPreferences prefs = await SharedPreferences.getInstance();
        expect(prefs.get('languageCode'), 'es');
      },
    );

    test('a store that throws everywhere fails without throwing', () async {
      populateLegacyDevice();

      expect(
        await cleanup(ThrowingMigrationStore()).run(),
        LegacyCleanupStatus.failed,
      );
      expect(doc('cache.hive').existsSync(), isTrue);
    });
  });

  group('repeated launches', () {
    test('a second run finds nothing left to do', () async {
      populateLegacyDevice();
      final MemoryMigrationStore store = MemoryMigrationStore(migrated());

      await cleanup(store).run();
      expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
      expect(doc(kDatabaseFileName).readAsBytesSync(), _driftBytes);
    });

    test(
      'a partial failure removes what it can and the retry finishes',
      () async {
        populateLegacyDevice();
        final MemoryMigrationStore store = MemoryMigrationStore(
          migrated(),
          failingRemovals: <String>{'isDarkMode'},
        );

        expect(await cleanup(store).run(), LegacyCleanupStatus.failed);
        expect(doc('cache.hive').existsSync(), isFalse);
        expect(store.values.containsKey('languageCode'), isFalse);
        expect(store.values['isDarkMode'], true);

        store.failingRemovals.clear();
        expect(await cleanup(store).run(), LegacyCleanupStatus.cleaned);
        expect(store.values.containsKey('isDarkMode'), isFalse);
      },
    );
  });
}
