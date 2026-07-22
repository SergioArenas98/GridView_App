import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/entity_validation.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

void main() {
  late GridViewDatabase db;

  setUp(() => db = GridViewDatabase.forTesting(NativeDatabase.memory()));
  tearDown(() => db.close());

  group('DAO transactional validation', () {
    test('a non-kebab identifier is rejected', () async {
      await expectLater(
        db.competitorDao.upsertDrivers(<Driver>[
          const Driver(id: 'Max_Verstappen', fullName: 'Max'),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
      expect(await db.select(db.drivers).get(), isEmpty);
    });

    test('a non ISO-3166 alpha-2 country code is rejected', () async {
      await expectLater(
        db.competitorDao.upsertDrivers(<Driver>[
          const Driver(id: 'max', fullName: 'Max', countryCode: 'usa'),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
    });

    test('a season outside 1950..2100 is rejected', () async {
      await expectLater(
        db.standingsDao.replaceDriverStandings(3000, <DriverStanding>[
          const DriverStanding(season: 3000, driverId: 'x', points: 0),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
    });

    test('a round outside 1..30 is rejected', () async {
      await expectLater(
        db.competitorDao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
          const DriverSeasonEntry(
            id: '2026-x',
            season: 2026,
            driverId: 'x',
            constructorId: 't',
            startRound: 40,
          ),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
    });
  });

  group('SQL CHECK constraints (direct inserts)', () {
    test('media_assets rejects a non-positive aspect ratio', () async {
      await expectLater(
        db
            .into(db.mediaAssets)
            .insert(
              MediaAssetsCompanion.insert(
                id: 'm1',
                entityType: 'driver',
                category: 'portrait',
                format: 'webp',
                version: 'v1',
                aspectRatio: const Value<double?>(-1.0),
              ),
            ),
        throwsA(anything),
      );
    });

    test('media_variants rejects a non-positive width', () async {
      await db
          .into(db.mediaAssets)
          .insert(
            MediaAssetsCompanion.insert(
              id: 'm1',
              entityType: 'driver',
              category: 'portrait',
              format: 'webp',
              version: 'v1',
            ),
          );
      await expectLater(
        db
            .into(db.mediaAssetVariants)
            .insert(
              MediaAssetVariantsCompanion.insert(
                mediaId: 'm1',
                variantName: 'thumbnail',
                url: 'https://cdn/x.webp',
                width: const Value<int?>(0),
              ),
            ),
        throwsA(anything),
      );
    });

    test('driver_standings rejects a negative order index', () async {
      await db
          .into(db.seasons)
          .insert(
            SeasonsCompanion.insert(
              year: const Value<int>(2026),
              status: 'active',
            ),
          );
      await db
          .into(db.drivers)
          .insert(DriversCompanion.insert(id: 'x', fullName: 'X'));
      await expectLater(
        db
            .into(db.driverStandings)
            .insert(
              DriverStandingsCompanion.insert(
                season: 2026,
                driverId: 'x',
                points: 10,
                orderIndex: -1,
              ),
            ),
        throwsA(anything),
      );
    });

    test('driver_season_entries rejects an out-of-range start round', () async {
      await db
          .into(db.seasons)
          .insert(
            SeasonsCompanion.insert(
              year: const Value<int>(2026),
              status: 'active',
            ),
          );
      await db
          .into(db.drivers)
          .insert(DriversCompanion.insert(id: 'x', fullName: 'X'));
      await db
          .into(db.constructors)
          .insert(ConstructorsCompanion.insert(id: 't', name: 'T'));
      await expectLater(
        db
            .into(db.driverSeasonEntries)
            .insert(
              DriverSeasonEntriesCompanion.insert(
                id: '2026-x',
                season: 2026,
                driverId: 'x',
                constructorId: 't',
                startRound: const Value<int?>(40),
              ),
            ),
        throwsA(anything),
      );
    });
  });

  test('null stays null, never coerced to zero or empty text', () async {
    await db.competitorDao.upsertDrivers(<Driver>[
      const Driver(id: 'null-driver', fullName: 'N'),
    ]);
    final List<DriverRow> rows = await db.select(db.drivers).get();
    expect(rows, hasLength(1));
    expect(rows.single.countryCode, isNull);
    expect(rows.single.permanentNumber, isNull);
    expect(rows.single.dateOfBirth, isNull);
  });
}
