import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/legacy/legacy_preference_migration.dart';
import 'package:gridview/core/legacy/legacy_startup.dart';
import 'package:gridview/core/legacy/legacy_storage.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'legacy_test_support.dart';

/// The legacy preference migration, over the real `SharedPreferences` API
/// seeded with the exact keys, types and values the legacy app wrote.
void main() {
  late List<PreferenceDiagnostic> diagnostics;

  setUp(() => diagnostics = <PreferenceDiagnostic>[]);

  Future<LegacyMigrationResult> migrate(LegacyMigrationStore store) =>
      LegacyPreferenceMigration(
        store: store,
        onDiagnostic: diagnostics.add,
      ).run();

  /// What the app renders on the first frame after the upgrade: the production
  /// startup step, then the repository's synchronous snapshot.
  Future<AppPreferences> launch() async {
    final AppPreferencesRepository repository =
        await openPreferencesAfterLegacyMigration(
          onDiagnostic: diagnostics.add,
        );
    addTearDown(repository.dispose);
    return repository.snapshot;
  }

  group('populated legacy storage', () {
    test(
      'Spanish + dark carry over and are visible on the first frame',
      () async {
        seedPrefs(<String, Object>{'languageCode': 'es', 'isDarkMode': true});

        final AppPreferences first = await launch();

        expect(first.language, AppLanguagePreference.spanish);
        expect(first.theme, AppThemePreference.dark);
        expect(first.timeDisplay, TimeDisplayPreference.fallback);
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        expect(prefs.getString(PreferenceKeys.language), 'spanish');
        expect(prefs.getString(PreferenceKeys.theme), 'dark');
        expect(
          prefs.getString(LegacyMigrationMarker.key),
          LegacyMigrationMarker.completed,
        );
        expect(diagnostics, isEmpty);
      },
    );

    test('English + light carry over as explicit choices', () async {
      seedPrefs(<String, Object>{'languageCode': 'en', 'isDarkMode': false});

      final AppPreferences first = await launch();

      // Not `system` and not the dark default: the legacy user chose these.
      expect(first.language, AppLanguagePreference.english);
      expect(first.theme, AppThemePreference.light);
    });

    test('the migration leaves the legacy keys in place', () async {
      seedPrefs(<String, Object>{'languageCode': 'es', 'isDarkMode': true});

      await launch();

      // Removal belongs to the post-launch cleanup, never to the migration.
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(prefs.get('languageCode'), 'es');
      expect(prefs.get('isDarkMode'), true);
    });

    for (final String code in <String>['it', 'pt', 'fr', 'de', 'ca']) {
      test('legacy "$code" is unsupported and leaves the default', () async {
        final MemoryMigrationStore store = MemoryMigrationStore(
          <String, Object>{'languageCode': code, 'isDarkMode': true},
        );

        final LegacyMigrationResult result = await migrate(store);

        expect(result.status, LegacyMigrationStatus.completed);
        expect(result.language, LegacyValueOutcome.unsupported);
        expect(result.theme, LegacyValueOutcome.migrated);
        expect(store.values.containsKey(PreferenceKeys.language), isFalse);
        expect(store.values[PreferenceKeys.theme], 'dark');
      });
    }
  });

  group('empty legacy storage', () {
    test('a device with no legacy keys gets the new defaults', () async {
      seedPrefs(<String, Object>{});

      final AppPreferences first = await launch();

      expect(first, AppPreferences.defaults);
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(prefs.getKeys(), <String>{LegacyMigrationMarker.key});
      expect(diagnostics, isEmpty);
    });

    test('an absent key is reported as absent, not migrated', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(
        const <String, Object>{},
      );

      final LegacyMigrationResult result = await migrate(store);

      expect(result.status, LegacyMigrationStatus.completed);
      expect(result.language, LegacyValueOutcome.absent);
      expect(result.theme, LegacyValueOutcome.absent);
    });
  });

  group('corrupt legacy storage', () {
    final Map<String, Map<String, Object>>
    cases = <String, Map<String, Object>>{
      'wrong types': <String, Object>{'languageCode': 7, 'isDarkMode': 'true'},
      'numeric bool': <String, Object>{'languageCode': 'xx', 'isDarkMode': 1},
      'empty string': <String, Object>{'languageCode': '', 'isDarkMode': 0.5},
      'region tag': <String, Object>{
        'languageCode': 'es_ES',
        'isDarkMode': <String>['true'],
      },
      'wrong case': <String, Object>{
        'languageCode': 'EN',
        'isDarkMode': 'dark',
      },
    };

    cases.forEach((String name, Map<String, Object> legacy) {
      test('$name: startup completes on the defaults', () async {
        seedPrefs(legacy);

        final AppPreferences first = await launch();

        expect(first, AppPreferences.defaults);
        // Neither key was written, so the repository raises no corrupted-value
        // diagnostic either: invalid legacy data is not a fault of this build.
        expect(diagnostics, isEmpty);
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        expect(prefs.containsKey(PreferenceKeys.language), isFalse);
        expect(prefs.containsKey(PreferenceKeys.theme), isFalse);
        expect(
          prefs.getString(LegacyMigrationMarker.key),
          LegacyMigrationMarker.completed,
        );
      });
    });

    test('one invalid value does not stop the other migrating', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(<String, Object>{
        'languageCode': 'es',
        'isDarkMode': 'yes',
      });

      final LegacyMigrationResult result = await migrate(store);

      expect(result.language, LegacyValueOutcome.migrated);
      expect(result.theme, LegacyValueOutcome.invalid);
      expect(store.values[PreferenceKeys.language], 'spanish');
    });

    test(
      'a store that throws everywhere yields incomplete, never an error',
      () async {
        final LegacyMigrationResult result = await migrate(
          ThrowingMigrationStore(),
        );

        expect(result.status, LegacyMigrationStatus.incomplete);
      },
    );
  });

  group('corrupt reconstruction value', () {
    test('languageCode=es replaces a corrupt new language key', () async {
      seedPrefs(<String, Object>{
        'languageCode': 'es',
        PreferenceKeys.language: 'klingon',
      });

      final AppPreferences first = await launch();

      // Without the repair the corrupt token would render as `system` and the
      // cleanup would then delete the only record of the Spanish choice.
      expect(first.language, AppLanguagePreference.spanish);
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(PreferenceKeys.language), 'spanish');
      expect(
        prefs.getString(LegacyMigrationMarker.key),
        LegacyMigrationMarker.completed,
      );
      // Repaired before the repository read it: no corrupted-value report.
      expect(diagnostics, isEmpty);
    });

    test('isDarkMode=false replaces a corrupt new theme key', () async {
      seedPrefs(<String, Object>{
        'isDarkMode': false,
        PreferenceKeys.theme: 'purple',
      });

      final AppPreferences first = await launch();

      expect(first.theme, AppThemePreference.light);
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(PreferenceKeys.theme), 'light');
      expect(diagnostics, isEmpty);
    });

    test('a wrongly-typed new key is corrupt too', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(<String, Object>{
        'languageCode': 'es',
        'isDarkMode': true,
        PreferenceKeys.language: 3,
        PreferenceKeys.theme: false,
      });

      final LegacyMigrationResult result = await migrate(store);

      expect(result.status, LegacyMigrationStatus.completed);
      expect(result.language, LegacyValueOutcome.replacedCorrupt);
      expect(result.theme, LegacyValueOutcome.replacedCorrupt);
      expect(store.values[PreferenceKeys.language], 'spanish');
      expect(store.values[PreferenceKeys.theme], 'dark');
    });

    test(
      'a corrupt new key with no usable legacy choice is left alone',
      () async {
        final MemoryMigrationStore store =
            MemoryMigrationStore(<String, Object>{
              'languageCode': 'it',
              PreferenceKeys.language: 'klingon',
              PreferenceKeys.theme: 'purple',
            });

        final LegacyMigrationResult result = await migrate(store);

        // The repository's own corrupted-value handling still owns these.
        expect(result.language, LegacyValueOutcome.unsupported);
        expect(result.theme, LegacyValueOutcome.absent);
        expect(store.writes, <String>[LegacyMigrationMarker.key]);
      },
    );
  });

  group('read failures', () {
    for (final (String name, String failing) in <(String, String)>[
      ('legacy language key', 'languageCode'),
      ('legacy theme key', 'isDarkMode'),
      ('new language key', PreferenceKeys.language),
      ('marker', LegacyMigrationMarker.key),
    ]) {
      test(
        'an unreadable $name is not absent: incomplete, then retried',
        () async {
          final MemoryMigrationStore store = MemoryMigrationStore(
            <String, Object>{'languageCode': 'es', 'isDarkMode': true},
            failingReads: <String>{failing},
          );

          final LegacyMigrationResult first = await migrate(store);

          expect(first.status, LegacyMigrationStatus.incomplete);
          expect(store.values.containsKey(LegacyMigrationMarker.key), isFalse);
          expect(store.values['languageCode'], 'es');
          expect(store.values['isDarkMode'], true);

          store.failingReads.clear();
          final LegacyMigrationResult retry = await migrate(store);

          expect(retry.status, LegacyMigrationStatus.completed);
          expect(store.values[PreferenceKeys.language], 'spanish');
          expect(store.values[PreferenceKeys.theme], 'dark');
        },
      );
    }

    test('one unreadable key still lets the other migrate', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(
        <String, Object>{'languageCode': 'es', 'isDarkMode': true},
        failingReads: <String>{'languageCode'},
      );

      final LegacyMigrationResult result = await migrate(store);

      expect(result.language, LegacyValueOutcome.readFailed);
      expect(result.theme, LegacyValueOutcome.migrated);
      expect(store.values.containsKey(PreferenceKeys.language), isFalse);
    });
  });

  group('repeated upgrades', () {
    test('a second launch is a no-op', () async {
      final MemoryMigrationStore store = MemoryMigrationStore(<String, Object>{
        'languageCode': 'es',
        'isDarkMode': true,
      });
      await migrate(store);
      final int writesAfterFirst = store.writes.length;

      final LegacyMigrationResult second = await migrate(store);

      expect(second.status, LegacyMigrationStatus.alreadyCompleted);
      expect(store.writes.length, writesAfterFirst);
    });

    test('a choice made after the upgrade survives later launches', () async {
      seedPrefs(<String, Object>{'languageCode': 'es', 'isDarkMode': true});
      await launch();
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      // The user moves to the new `system` options in Settings…
      await prefs.setString(PreferenceKeys.theme, 'system');
      await prefs.setString(PreferenceKeys.language, 'system');

      // …and the next app update launches again with legacy keys still present.
      final AppPreferences next = await launch();

      expect(next.theme, AppThemePreference.system);
      expect(next.language, AppLanguagePreference.system);
    });

    test(
      'without a marker, an existing new value is never overwritten',
      () async {
        // A launch that wrote the language then died before the marker, or a
        // backup restored without it.
        final MemoryMigrationStore store =
            MemoryMigrationStore(<String, Object>{
              'languageCode': 'es',
              'isDarkMode': true,
              PreferenceKeys.language: 'english',
              PreferenceKeys.theme: 'light',
            });

        final LegacyMigrationResult result = await migrate(store);

        expect(result.status, LegacyMigrationStatus.completed);
        expect(result.language, LegacyValueOutcome.alreadySet);
        expect(result.theme, LegacyValueOutcome.alreadySet);
        expect(store.values[PreferenceKeys.language], 'english');
        expect(store.values[PreferenceKeys.theme], 'light');
      },
    );

    test(
      'a marker with an unknown value does not skip the migration',
      () async {
        final MemoryMigrationStore store = MemoryMigrationStore(
          <String, Object>{'isDarkMode': true, LegacyMigrationMarker.key: true},
        );

        final LegacyMigrationResult result = await migrate(store);

        expect(result.status, LegacyMigrationStatus.completed);
        expect(store.values[PreferenceKeys.theme], 'dark');
        expect(
          store.values[LegacyMigrationMarker.key],
          LegacyMigrationMarker.completed,
        );
      },
    );

    test(
      'a failed value write leaves it incomplete and the retry finishes',
      () async {
        final MemoryMigrationStore store = MemoryMigrationStore(
          <String, Object>{'languageCode': 'es', 'isDarkMode': true},
          failingWrites: <String>{PreferenceKeys.theme},
        );

        final LegacyMigrationResult first = await migrate(store);

        expect(first.status, LegacyMigrationStatus.incomplete);
        expect(first.language, LegacyValueOutcome.migrated);
        expect(first.theme, LegacyValueOutcome.writeFailed);
        expect(store.values.containsKey(LegacyMigrationMarker.key), isFalse);
        expect(diagnostics.single.kind, PreferenceDiagnosticKind.writeFailure);
        expect(diagnostics.single.key, PreferenceKeys.theme);

        store.failingWrites.clear();
        final LegacyMigrationResult retry = await migrate(store);

        expect(retry.status, LegacyMigrationStatus.completed);
        expect(retry.language, LegacyValueOutcome.alreadySet);
        expect(retry.theme, LegacyValueOutcome.migrated);
        expect(store.values[PreferenceKeys.theme], 'dark');
      },
    );

    test(
      'a failed marker write leaves it incomplete and the retry finishes',
      () async {
        final MemoryMigrationStore store = MemoryMigrationStore(
          <String, Object>{'isDarkMode': false},
          failingWrites: <String>{LegacyMigrationMarker.key},
        );

        final LegacyMigrationResult first = await migrate(store);

        expect(first.status, LegacyMigrationStatus.incomplete);
        expect(store.values[PreferenceKeys.theme], 'light');
        expect(diagnostics.single.key, LegacyMigrationMarker.key);

        store.failingWrites.clear();
        expect((await migrate(store)).status, LegacyMigrationStatus.completed);
        expect(store.values[PreferenceKeys.theme], 'light');
      },
    );
  });

  group('value mapping', () {
    test('language codes map only en and es', () {
      expect(mapLegacyLanguage('en').value, AppLanguagePreference.english);
      expect(mapLegacyLanguage('es').value, AppLanguagePreference.spanish);
      expect(mapLegacyLanguage(null).outcome, LegacyValueOutcome.absent);
      expect(mapLegacyLanguage(' es').outcome, LegacyValueOutcome.invalid);
    });

    test('theme maps only bools', () {
      expect(mapLegacyTheme(true).value, AppThemePreference.dark);
      expect(mapLegacyTheme(false).value, AppThemePreference.light);
      expect(mapLegacyTheme(null).outcome, LegacyValueOutcome.absent);
      expect(mapLegacyTheme('false').outcome, LegacyValueOutcome.invalid);
    });
  });
}
