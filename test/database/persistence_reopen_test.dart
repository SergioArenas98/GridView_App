import 'dart:io';

import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/entities.dart';

import 'generated/schema_v1.dart' as v1;

/// On-disk persistence and reopen coverage: proves the migration and the DAO
/// writes survive a real file being closed and reopened (not just in-memory).
void main() {
  late Directory tempDir;
  late File dbFile;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_db_test');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  test(
    'migrates a v1 on-disk database to v2 and preserves data across reopen',
    () async {
      // Create the v1 schema on disk and seed a Phase 4 row.
      final v1.DatabaseAtV1 oldDb = v1.DatabaseAtV1(NativeDatabase(dbFile));
      await oldDb
          .into(oldDb.seasons)
          .insert(
            RawValuesInsertable(<String, Expression<Object>>{
              'year': Variable<int>(2026),
              'status': Variable<String>('active'),
              'is_current': Variable<bool>(true),
            }),
          );
      await oldDb
          .into(oldDb.circuits)
          .insert(
            RawValuesInsertable(<String, Expression<Object>>{
              'id': Variable<String>('spa'),
              'name': Variable<String>('Spa'),
            }),
          );
      await oldDb.close();

      // Opening the real database migrates 1 -> 2 in place on the file.
      final GridViewDatabase migrated = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      expect(migrated.schemaVersion, 2);
      expect((await migrated.select(migrated.seasons).get()).single.year, 2026);
      // A new v2 table is usable on the migrated file.
      await migrated
          .into(migrated.drivers)
          .insert(DriversCompanion.insert(id: 'x', fullName: 'X'));
      await migrated.close();

      // Reopen at v2: no re-migration, all data persists.
      final GridViewDatabase reopened = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      expect(reopened.schemaVersion, 2);
      expect((await reopened.select(reopened.seasons).get()).single.year, 2026);
      expect((await reopened.select(reopened.drivers).get()).single.id, 'x');
      await reopened.close();
    },
  );

  test(
    'core entities, ordering, ETags and freshness survive a reopen',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      await db
          .into(db.seasons)
          .insert(
            SeasonsCompanion.insert(
              year: const Value<int>(2026),
              status: 'active',
            ),
          );
      await db.calendarDao.upsertCircuits(<Circuit>[
        const Circuit(id: 'spa', name: 'Spa', lengthMeters: 7004),
      ]);
      await db.competitorDao.upsertDrivers(<Driver>[
        const Driver(id: 'b', fullName: 'B'),
        const Driver(id: 'a', fullName: 'A'),
      ]);
      await db.competitorDao
          .replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
            const DriverSeasonEntry(
              id: '2026-a',
              season: 2026,
              driverId: 'a',
              constructorId: 't',
              raceNumber: 1,
            ),
            const DriverSeasonEntry(
              id: '2026-b',
              season: 2026,
              driverId: 'b',
              constructorId: 't',
              raceNumber: 2,
            ),
          ]);
      await db.standingsDao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'a',
          position: 1,
          points: 25.5,
        ),
      ]);
      await db.syncMetadataDao.upsert(
        ResourceSyncState(
          resourceKey: ResourceKey.driverStandings(2026),
          season: 2026,
          etag: 'W/"abc"',
          generatedAt: DateTime.utc(2026, 7, 20, 10),
          sourceUpdatedAt: DateTime.utc(2026, 7, 20, 9),
          staleAfter: DateTime.utc(2026, 7, 20, 11),
          contentVersion: '2026.07.20.1',
          lastAttemptAt: DateTime.utc(2026, 7, 20, 10),
          lastSuccessAt: DateTime.utc(2026, 7, 20, 10),
          serverStale: false,
        ),
      );
      await db.close();

      final GridViewDatabase reopened = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      // Core entities persist.
      expect(
        (await reopened.select(reopened.circuits).get()).single.lengthMeters,
        7004,
      );
      // Ordering (by race number) persists.
      final List<SeasonDriver> roster = await reopened.competitorDao
          .driversForSeason(2026);
      expect(roster.map((SeasonDriver s) => s.driver.id), <String>['a', 'b']);
      // Fractional standing persists.
      final DriverStanding? standing = await reopened.standingsDao
          .driverStanding(2026, 'a');
      expect(standing?.points, 25.5);
      // ETag + freshness + scope persist.
      final ResourceSyncState? sync = await reopened.syncMetadataDao.read(
        ResourceKey.driverStandings(2026),
      );
      expect(sync?.etag, 'W/"abc"');
      expect(sync?.season, 2026);
      expect(sync?.generatedAt, DateTime.utc(2026, 7, 20, 10));
      expect(sync?.sourceUpdatedAt, DateTime.utc(2026, 7, 20, 9));
      expect(sync?.staleAfter, DateTime.utc(2026, 7, 20, 11));
      expect(sync?.contentVersion, '2026.07.20.1');
      expect(sync?.lastSuccessAt, DateTime.utc(2026, 7, 20, 10));
      expect(sync?.serverStale, isFalse);
      await reopened.close();
    },
  );
}
