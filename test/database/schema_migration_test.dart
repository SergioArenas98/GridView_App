import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';

import 'generated/schema.dart';
import 'generated/schema_v1.dart' as v1;

/// Schema-version and migration coverage for the Drift database.
///
/// Two concerns are covered:
/// 1. The **fresh v2** schema that `onCreate` produces (a clean install).
/// 2. The **non-destructive 1 -> 2 migration**, verified against the exported
///    `drift_schema_v2.json` and proven to preserve every Phase 4 (v1) row.
///
/// Future schema bumps must add another `verifier.schemaAt(n)` migration step
/// and extend the expected-tables set below.
void main() {
  group('fresh v2 schema (onCreate)', () {
    late GridViewDatabase db;

    setUp(() => db = GridViewDatabase.forTesting(NativeDatabase.memory()));
    tearDown(() => db.close());

    const Set<String> expectedTables = <String>{
      // v1 spine
      'seasons', 'circuits', 'grand_prix', 'sessions', 'snapshots',
      // v2 competitors (line-up is derived from driver_season_entries — no table)
      'drivers', 'constructors',
      'driver_season_entries', 'constructor_season_entries',
      // v2 standings
      'driver_standings', 'constructor_standings',
      // v2 results
      'race_results', 'race_result_entries',
      // v2 media
      'media_assets', 'media_variants',
      'driver_media', 'constructor_media', 'circuit_media', 'grand_prix_media',
      // v2 sync
      'resource_sync_metadata',
    };

    test('schema version is 2', () {
      expect(db.schemaVersion, 2);
    });

    test('onCreate builds every v2 table', () async {
      final List<QueryRow> rows = await db
          .customSelect("SELECT name FROM sqlite_master WHERE type = 'table'")
          .get();
      final Set<String> tables = rows
          .map((QueryRow r) => r.read<String>('name'))
          .toSet();
      expect(tables, containsAll(expectedTables));
    });

    test('circuits gained the v2 physical/geographic columns', () async {
      final List<QueryRow> info = await db
          .customSelect('PRAGMA table_info(circuits)')
          .get();
      final Set<String> columns = info
          .map((QueryRow r) => r.read<String>('name'))
          .toSet();
      expect(
        columns,
        containsAll(<String>[
          'latitude',
          'longitude',
          'length_meters',
          'corner_count',
          'direction',
          'first_grand_prix_year',
          'lap_record_driver_id',
          'lap_record_time_millis',
          'lap_record_year',
        ]),
      );
    });

    test(
      '(season, round) uniqueness is still enforced on grand_prix',
      () async {
        await db
            .into(db.seasons)
            .insert(
              SeasonsCompanion.insert(
                year: const Value(2026),
                status: 'active',
              ),
            );
        await db
            .into(db.circuits)
            .insert(CircuitsCompanion.insert(id: 'spa', name: 'Spa'));

        GrandPrixEventsCompanion event(String id) =>
            GrandPrixEventsCompanion.insert(
              id: id,
              season: 2026,
              round: 13,
              eventSlug: 'belgian-grand-prix',
              name: 'Belgian Grand Prix',
              circuitId: 'spa',
              status: 'upcoming',
              format: 'sprint',
            );

        await db
            .into(db.grandPrixEvents)
            .insert(event('2026-belgian-grand-prix'));
        await expectLater(
          db.into(db.grandPrixEvents).insert(event('2026-belgian-duplicate')),
          throwsA(anything),
        );
      },
    );

    test(
      'deleting a media asset cascades to its variants and owner association',
      () async {
        await db
            .into(db.drivers)
            .insert(
              DriversCompanion.insert(
                id: 'max-verstappen',
                fullName: 'Max Verstappen',
              ),
            );
        await db
            .into(db.mediaAssets)
            .insert(
              MediaAssetsCompanion.insert(
                id: 'max-verstappen-portrait-v1',
                entityType: 'driver',
                category: 'portrait',
                format: 'webp',
                version: 'v1',
                entityId: const Value<String?>('max-verstappen'),
              ),
            );
        await db
            .into(db.mediaAssetVariants)
            .insert(
              MediaAssetVariantsCompanion.insert(
                mediaId: 'max-verstappen-portrait-v1',
                variantName: 'thumbnail',
                url: 'https://cdn.example/max-thumb.webp',
              ),
            );
        await db
            .into(db.driverMedia)
            .insert(
              DriverMediaCompanion.insert(
                mediaId: 'max-verstappen-portrait-v1',
                driverId: 'max-verstappen',
                orderIndex: 0,
              ),
            );

        // Removes the only asset row; the cascade must clear its dependents.
        await db.delete(db.mediaAssets).go();

        expect(await db.select(db.mediaAssetVariants).get(), isEmpty);
        expect(await db.select(db.driverMedia).get(), isEmpty);
      },
    );

    test(
      'placeholder media persists with no owner association (no fabricated FK)',
      () async {
        // A placeholder asset references no real entity, so it has no row in any
        // of the four ownership association tables. It must still persist with
        // foreign keys enforced.
        await db
            .into(db.mediaAssets)
            .insert(
              MediaAssetsCompanion.insert(
                id: 'driver-placeholder-portrait-v1',
                entityType: 'placeholder',
                category: 'portrait',
                format: 'webp',
                version: 'v1',
              ),
            );

        expect(await db.select(db.mediaAssets).get(), hasLength(1));
        expect(await db.select(db.driverMedia).get(), isEmpty);
        expect(await db.select(db.constructorMedia).get(), isEmpty);
        expect(await db.select(db.circuitMedia).get(), isEmpty);
        expect(await db.select(db.grandPrixMedia).get(), isEmpty);
      },
    );

    test('every declared query index exists', () async {
      final List<QueryRow> rows = await db
          .customSelect("SELECT name FROM sqlite_master WHERE type = 'index'")
          .get();
      final Set<String> indexes = rows
          .map((QueryRow r) => r.read<String>('name'))
          .toSet();
      expect(
        indexes,
        containsAll(<String>[
          'idx_grand_prix_season_start',
          'idx_grand_prix_circuit_season',
          'idx_sessions_gp_order',
          'idx_dse_season_driver',
          'idx_dse_season_constructor',
          'idx_driver_standings_season_order',
          'idx_constructor_standings_season_order',
          'idx_rre_result_order',
          'idx_driver_media_driver',
          'idx_constructor_media_constructor',
          'idx_circuit_media_circuit',
          'idx_grand_prix_media_gp',
          'idx_resource_sync_stale_after',
          'idx_resource_sync_season_stale',
        ]),
      );
    });

    test(
      'constructor_season_entries is unique per (season, constructor)',
      () async {
        await db
            .into(db.seasons)
            .insert(
              SeasonsCompanion.insert(
                year: const Value<int>(2026),
                status: 'active',
              ),
            );
        await db
            .into(db.constructors)
            .insert(
              ConstructorsCompanion.insert(id: 'ferrari', name: 'Ferrari'),
            );
        await db
            .into(db.constructorSeasonEntries)
            .insert(
              ConstructorSeasonEntriesCompanion.insert(
                id: '2026-ferrari',
                season: 2026,
                constructorId: 'ferrari',
              ),
            );
        await expectLater(
          db
              .into(db.constructorSeasonEntries)
              .insert(
                ConstructorSeasonEntriesCompanion.insert(
                  id: '2026-ferrari-b',
                  season: 2026,
                  constructorId: 'ferrari',
                ),
              ),
          throwsA(anything),
        );
      },
    );

    test(
      'race_results allow sprint+race but reject a duplicate session type',
      () async {
        await db
            .into(db.seasons)
            .insert(
              SeasonsCompanion.insert(
                year: const Value<int>(2026),
                status: 'active',
              ),
            );
        await db
            .into(db.circuits)
            .insert(CircuitsCompanion.insert(id: 'spa', name: 'Spa'));
        await db
            .into(db.grandPrixEvents)
            .insert(
              GrandPrixEventsCompanion.insert(
                id: '2026-belgian-grand-prix',
                season: 2026,
                round: 13,
                eventSlug: 'belgian-grand-prix',
                name: 'Belgian Grand Prix',
                circuitId: 'spa',
                status: 'completed',
                format: 'sprint',
              ),
            );

        RaceResultsCompanion result(String id, String sessionType) =>
            RaceResultsCompanion.insert(
              id: id,
              season: 2026,
              round: 13,
              grandPrixId: '2026-belgian-grand-prix',
              sessionType: sessionType,
              status: 'final',
            );

        // A sprint and a race result coexist for the same Grand Prix.
        await db
            .into(db.raceResults)
            .insert(result('2026-belgian-grand-prix-sprint-results', 'sprint'));
        await db
            .into(db.raceResults)
            .insert(result('2026-belgian-grand-prix-race-results', 'race'));
        // A second 'race' result for the same event violates the uniqueness pair.
        await expectLater(
          db
              .into(db.raceResults)
              .insert(result('2026-belgian-grand-prix-race-dup', 'race')),
          throwsA(anything),
        );
      },
    );
  });

  group('migration v1 -> v2', () {
    late SchemaVerifier verifier;

    setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

    test(
      'upgrades to the exported v2 schema and preserves every Phase 4 row',
      () async {
        final schema = await verifier.schemaAt(1);

        // --- Seed representative Phase 4 rows at schema v1. ---
        final v1.DatabaseAtV1 oldDb = v1.DatabaseAtV1(schema.newConnection());
        final DateTime generatedAt = DateTime.utc(2026, 7, 20, 10);
        final DateTime sourceUpdatedAt = DateTime.utc(2026, 7, 20, 9, 55);
        final DateTime sessionStart = DateTime.utc(2026, 7, 26, 13);

        await oldDb
            .into(oldDb.seasons)
            .insert(
              RawValuesInsertable(<String, Expression<Object>>{
                'year': Variable<int>(2026),
                'label': Variable<String>(
                  '2026 FIA Formula One World Championship',
                ),
                'status': Variable<String>('active'),
                'round_count': Variable<int>(24),
                'current_round': Variable<int>(13),
                'is_current': Variable<bool>(true),
              }),
            );
        await oldDb
            .into(oldDb.circuits)
            .insert(
              RawValuesInsertable(<String, Expression<Object>>{
                'id': Variable<String>('spa-francorchamps'),
                'name': Variable<String>('Circuit de Spa-Francorchamps'),
                'locality': Variable<String>('Stavelot'),
                'country': Variable<String>('Belgium'),
                'country_code': Variable<String>('BE'),
              }),
            );
        await oldDb
            .into(oldDb.grandPrix)
            .insert(
              RawValuesInsertable(<String, Expression<Object>>{
                'id': Variable<String>('2026-belgian-grand-prix'),
                'season': Variable<int>(2026),
                'round': Variable<int>(13),
                'event_slug': Variable<String>('belgian-grand-prix'),
                'name': Variable<String>('Belgian Grand Prix'),
                'circuit_id': Variable<String>('spa-francorchamps'),
                'status': Variable<String>('upcoming'),
                'format': Variable<String>('sprint'),
                'timezone': Variable<String>('Europe/Brussels'),
                'has_results': Variable<bool>(false),
              }),
            );
        await oldDb
            .into(oldDb.sessions)
            .insert(
              RawValuesInsertable(<String, Expression<Object>>{
                'id': Variable<String>('2026-belgian-grand-prix-race'),
                'grand_prix_id': Variable<String>('2026-belgian-grand-prix'),
                'type': Variable<String>('race'),
                'name': Variable<String>('Race'),
                'start_time_utc': Variable<DateTime>(sessionStart),
                'status': Variable<String>('scheduled'),
                'order_index': Variable<int>(6),
              }),
            );
        await oldDb
            .into(oldDb.snapshots)
            .insert(
              RawValuesInsertable(<String, Expression<Object>>{
                'key': Variable<String>('home'),
                'generated_at': Variable<DateTime>(generatedAt),
                'source_updated_at': Variable<DateTime>(sourceUpdatedAt),
                'content_version': Variable<String>('2026.07.20.1'),
                'server_stale': Variable<bool>(false),
                'focus_season': Variable<int>(2026),
                'focus_round': Variable<int>(13),
              }),
            );
        await oldDb.close();

        // --- Run the real migration and validate the resulting schema. ---
        final GridViewDatabase db = GridViewDatabase.forTesting(
          schema.newConnection(),
        );
        // Throws unless the migrated schema matches the exported v2 schema.
        await verifier.migrateAndValidate(db, 2);

        // --- Every seeded v1 row survives, unchanged. ---
        final List<SeasonRow> seasons = await db.select(db.seasons).get();
        expect(seasons, hasLength(1));
        expect(seasons.single.year, 2026);
        expect(seasons.single.status, 'active');
        expect(seasons.single.label, '2026 FIA Formula One World Championship');
        expect(seasons.single.roundCount, 24);
        expect(seasons.single.isCurrent, isTrue);

        final List<CircuitRow> circuits = await db.select(db.circuits).get();
        expect(circuits, hasLength(1));
        expect(circuits.single.id, 'spa-francorchamps');
        expect(circuits.single.name, 'Circuit de Spa-Francorchamps');
        expect(circuits.single.countryCode, 'BE');
        // New v2 columns default to null on migrated rows.
        expect(circuits.single.latitude, isNull);
        expect(circuits.single.lengthMeters, isNull);
        expect(circuits.single.direction, isNull);
        expect(circuits.single.lapRecordTimeMillis, isNull);

        final List<GrandPrixRow> events = await db
            .select(db.grandPrixEvents)
            .get();
        expect(events, hasLength(1));
        expect(events.single.id, '2026-belgian-grand-prix');
        expect(events.single.round, 13);
        expect(events.single.timezone, 'Europe/Brussels');

        final List<SessionRow> sessions = await db.select(db.sessions).get();
        expect(sessions, hasLength(1));
        expect(sessions.single.orderIndex, 6);
        expect(sessions.single.startTimeUtc, sessionStart);

        final List<SnapshotRow> snapshots = await db.select(db.snapshots).get();
        expect(snapshots, hasLength(1));
        expect(snapshots.single.key, 'home');
        expect(snapshots.single.generatedAt, generatedAt);
        expect(snapshots.single.sourceUpdatedAt, sourceUpdatedAt);
        expect(snapshots.single.focusSeason, 2026);
        expect(snapshots.single.focusRound, 13);

        // New v2 tables exist and start empty after a migration.
        expect(await db.select(db.drivers).get(), isEmpty);
        expect(await db.select(db.raceResults).get(), isEmpty);
        expect(await db.select(db.mediaAssets).get(), isEmpty);
        expect(await db.select(db.resourceSyncMetadata).get(), isEmpty);

        await db.close();
      },
    );
  });
}
