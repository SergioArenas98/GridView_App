import 'package:drift/drift.dart';

import 'competitor_tables.dart';
import 'connection/open_connection.dart';
import 'daos/calendar_dao.dart';
import 'daos/competitor_dao.dart';
import 'daos/media_dao.dart';
import 'daos/results_dao.dart';
import 'daos/standings_dao.dart';
import 'daos/sync_metadata_dao.dart';
import 'daos/vertical_slice_dao.dart';
import 'media_tables.dart';
import 'result_tables.dart';
import 'standing_tables.dart';
import 'sync_tables.dart';
import 'tables.dart';

part 'gridview_database.g.dart';

/// The reconstructed local database.
///
/// **Schema version 2.** Instants are stored as ISO-8601 UTC text
/// (`storeDateTimeAsText`) so a `DateTime` column always round-trips in UTC.
/// Foreign keys are enabled for every connection in [beforeOpen], so all
/// cascades and references are enforced at runtime and under test.
///
/// Schema history:
/// - **v1** — the Phase 4 calendar spine: `seasons`, `circuits` (base columns),
///   `grand_prix`, `sessions`, `snapshots`.
/// - **v2** — the complete v1 domain persistence model. `circuits` gains its
///   physical/geographic columns (added non-destructively); new tables add
///   drivers, constructors, season entries + line-up, driver/constructor
///   standings, race results + entries, media assets + variants + the four
///   FK-backed media ownership associations, and resource sync metadata. The
///   1 -> 2 migration is purely additive: every existing v1 row is preserved.
@DriftDatabase(
  tables: <Type>[
    // v1 calendar spine.
    Seasons,
    Circuits,
    GrandPrixEvents,
    Sessions,
    Snapshots,
    // v2 competitors and participation.
    Drivers,
    Constructors,
    DriverSeasonEntries,
    ConstructorSeasonEntries,
    // v2 standings.
    DriverStandings,
    ConstructorStandings,
    // v2 results.
    RaceResults,
    RaceResultEntries,
    // v2 media.
    MediaAssets,
    MediaAssetVariants,
    DriverMedia,
    ConstructorMedia,
    CircuitMedia,
    GrandPrixMedia,
    // v2 synchronization metadata (provisioned for Phase 6B).
    ResourceSyncMetadata,
  ],
  daos: <Type>[
    VerticalSliceDao,
    MediaDao,
    StandingsDao,
    ResultsDao,
    CompetitorDao,
    CalendarDao,
    SyncMetadataDao,
  ],
)
class GridViewDatabase extends _$GridViewDatabase {
  GridViewDatabase() : super(openAppConnection());

  /// Test/alternate connection constructor (in-memory or temporary on-disk).
  GridViewDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 2;

  @override
  DriftDatabaseOptions get options =>
      const DriftDatabaseOptions(storeDateTimeAsText: true);

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async {
      // A fresh install is created directly at the current (v2) schema.
      await m.createAll();
    },
    onUpgrade: (Migrator m, int from, int to) async {
      // Foreign keys are OFF during migrations (they are only turned ON in
      // beforeOpen, which runs afterwards), so additive DDL is safe here.
      if (from < 2) {
        await _upgradeToV2(m);
      }
    },
    beforeOpen: (OpeningDetails details) async {
      // SQLite defaults foreign keys off; enable them on every open.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );

  /// Non-destructive 1 -> 2 migration.
  ///
  /// Adds the new nullable `circuits` columns and creates every v2 table. It
  /// never touches, rewrites or drops an existing v1 row: the Phase 4 calendar
  /// spine survives the upgrade intact.
  Future<void> _upgradeToV2(Migrator m) async {
    // Extend circuits with the full physical/geographic identity (all nullable).
    await m.addColumn(circuits, circuits.latitude);
    await m.addColumn(circuits, circuits.longitude);
    await m.addColumn(circuits, circuits.lengthMeters);
    await m.addColumn(circuits, circuits.cornerCount);
    await m.addColumn(circuits, circuits.direction);
    await m.addColumn(circuits, circuits.firstGrandPrixYear);
    await m.addColumn(circuits, circuits.lapRecordDriverId);
    await m.addColumn(circuits, circuits.lapRecordTimeMillis);
    await m.addColumn(circuits, circuits.lapRecordYear);

    // Create the new v2 tables (empty; parents before children for clarity).
    await m.createTable(drivers);
    await m.createTable(constructors);
    await m.createTable(driverSeasonEntries);
    await m.createTable(constructorSeasonEntries);
    await m.createTable(driverStandings);
    await m.createTable(constructorStandings);
    await m.createTable(raceResults);
    await m.createTable(raceResultEntries);
    await m.createTable(mediaAssets);
    await m.createTable(mediaAssetVariants);
    await m.createTable(driverMedia);
    await m.createTable(constructorMedia);
    await m.createTable(circuitMedia);
    await m.createTable(grandPrixMedia);
    await m.createTable(resourceSyncMetadata);

    // Create every v2 index. v1 defined no standalone indexes, so this creates
    // exactly the new ones (on both the v1 spine tables and the new tables).
    for (final DatabaseSchemaEntity entity in allSchemaEntities) {
      if (entity is Index) {
        await m.create(entity);
      }
    }
  }
}
