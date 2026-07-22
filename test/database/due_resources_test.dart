import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

void main() {
  // A fixed, supplied UTC instant — the DAO never calls DateTime.now itself.
  final DateTime now = DateTime.utc(2026, 7, 20, 12);
  final DateTime past = now.subtract(const Duration(hours: 1));
  final DateTime future = now.add(const Duration(hours: 1));

  ResourceSyncState state(
    String key, {
    int? season,
    DateTime? staleAfter,
    DateTime? lastSuccessAt,
    bool? serverStale,
  }) => ResourceSyncState(
    resourceKey: key,
    season: season,
    staleAfter: staleAfter,
    lastSuccessAt: lastSuccessAt,
    serverStale: serverStale,
  );

  group('in-memory', () {
    late GridViewDatabase db;

    setUp(() => db = GridViewDatabase.forTesting(NativeDatabase.memory()));
    tearDown(() => db.close());

    Future<Set<String>> dueKeys({int? season}) async {
      final List<ResourceSyncState> due = await db.syncMetadataDao
          .readDueResources(now, season: season);
      return due.map((ResourceSyncState s) => s.resourceKey).toSet();
    }

    test('a never-successful resource is due', () async {
      await db.syncMetadataDao.upsert(state('a', staleAfter: future));
      expect(await dueKeys(), <String>{'a'});
    });

    test('serverStale is due even with a future or null staleAfter', () async {
      await db.syncMetadataDao.upsert(
        state(
          'future',
          lastSuccessAt: past,
          serverStale: true,
          staleAfter: future,
        ),
      );
      await db.syncMetadataDao.upsert(
        state('null', lastSuccessAt: past, serverStale: true),
      );
      expect(await dueKeys(), <String>{'future', 'null'});
    });

    test('staleAfter equal to now is due', () async {
      await db.syncMetadataDao.upsert(
        state('eq', lastSuccessAt: past, serverStale: false, staleAfter: now),
      );
      expect(await dueKeys(), <String>{'eq'});
    });

    test('staleAfter before now is due', () async {
      await db.syncMetadataDao.upsert(
        state(
          'before',
          lastSuccessAt: past,
          serverStale: false,
          staleAfter: past,
        ),
      );
      expect(await dueKeys(), <String>{'before'});
    });

    test('staleAfter after now is not due', () async {
      await db.syncMetadataDao.upsert(
        state(
          'after',
          lastSuccessAt: past,
          serverStale: false,
          staleAfter: future,
        ),
      );
      expect(await dueKeys(), isEmpty);
    });

    test(
      'successful with null staleAfter and serverStale false is not due',
      () async {
        await db.syncMetadataDao.upsert(
          state('fresh', lastSuccessAt: past, serverStale: false),
        );
        expect(await dueKeys(), isEmpty);
      },
    );

    test('season filtering never returns another season', () async {
      await db.syncMetadataDao.upsert(
        state(
          ResourceKey.driverStandings(2025),
          season: 2025,
          staleAfter: past,
        ),
      );
      await db.syncMetadataDao.upsert(
        state(
          ResourceKey.driverStandings(2026),
          season: 2026,
          staleAfter: past,
        ),
      );
      expect(await dueKeys(season: 2026), <String>{
        ResourceKey.driverStandings(2026),
      });
    });

    test('similarly-shaped keys in two seasons do not collide', () async {
      await db.syncMetadataDao.upsert(
        state(ResourceKey.driver('max-verstappen', 2025), season: 2025),
      );
      await db.syncMetadataDao.upsert(
        state(ResourceKey.driver('max-verstappen', 2026), season: 2026),
      );
      // Both never-successful -> both due, and their keys are distinct.
      expect(await dueKeys(), <String>{
        'driver:max-verstappen:2025',
        'driver:max-verstappen:2026',
      });
    });

    test(
      'ordering is deterministic: never, server-stale, oldest, then key',
      () async {
        await db.syncMetadataDao.upsert(state('z-never'));
        await db.syncMetadataDao.upsert(state('a-never'));
        await db.syncMetadataDao.upsert(
          state(
            'server',
            lastSuccessAt: past,
            serverStale: true,
            staleAfter: future,
          ),
        );
        await db.syncMetadataDao.upsert(
          state(
            'expired-old',
            lastSuccessAt: past,
            serverStale: false,
            staleAfter: now.subtract(const Duration(hours: 3)),
          ),
        );
        await db.syncMetadataDao.upsert(
          state(
            'expired-new',
            lastSuccessAt: past,
            serverStale: false,
            staleAfter: past,
          ),
        );

        final List<ResourceSyncState> due = await db.syncMetadataDao
            .readDueResources(now);
        expect(due.map((ResourceSyncState s) => s.resourceKey), <String>[
          'a-never',
          'z-never',
          'server',
          'expired-old',
          'expired-new',
        ]);
      },
    );

    test('returns ResourceSyncState read models, not Drift rows', () async {
      await db.syncMetadataDao.upsert(state('a'));
      final List<ResourceSyncState> due = await db.syncMetadataDao
          .readDueResources(now);
      expect(due.single, isA<ResourceSyncState>());
      expect(due.single.resourceKey, 'a');
    });
  });

  test('the due query survives a database close and reopen', () async {
    final Directory tempDir = Directory.systemTemp.createTempSync('gv_due');
    final File dbFile = File('${tempDir.path}/gridview_v2.sqlite');
    try {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      await db.syncMetadataDao.upsert(
        state(ResourceKey.home(2026), season: 2026, staleAfter: past),
      );
      await db.close();

      final GridViewDatabase reopened = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      final List<ResourceSyncState> due = await reopened.syncMetadataDao
          .readDueResources(now, season: 2026);
      expect(due.map((ResourceSyncState s) => s.resourceKey), <String>[
        ResourceKey.home(2026),
      ]);
      await reopened.close();
    } finally {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    }
  });
}
