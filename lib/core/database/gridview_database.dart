import 'package:drift/drift.dart';

import 'connection/open_connection.dart';
import 'daos/vertical_slice_dao.dart';
import 'tables.dart';

part 'gridview_database.g.dart';

/// The reconstructed local database (Phase 4 vertical slice).
///
/// Schema version 1. Instants are stored as ISO-8601 UTC text
/// (`storeDateTimeAsText`) so a `DateTime` column always round-trips in UTC.
/// Foreign keys are enabled for every connection in [beforeOpen], so the
/// `sessions -> grand_prix` cascade and the circuit/season references are
/// enforced at runtime and under test.
@DriftDatabase(
  tables: <Type>[Seasons, Circuits, GrandPrixEvents, Sessions, Snapshots],
  daos: <Type>[VerticalSliceDao],
)
class GridViewDatabase extends _$GridViewDatabase {
  GridViewDatabase() : super(openAppConnection());

  /// Test/alternate connection constructor (in-memory or temporary on-disk).
  GridViewDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;

  @override
  DriftDatabaseOptions get options =>
      const DriftDatabaseOptions(storeDateTimeAsText: true);

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async {
      await m.createAll();
    },
    beforeOpen: (OpeningDetails details) async {
      // SQLite defaults foreign keys off; enable them on every open.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
