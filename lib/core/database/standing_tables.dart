// Drift column `.check()` constraints reference the column getter in their own
// definition (the documented drift DSL pattern); drift analyses the AST and
// never executes the getter, so the recursive-getter lint is a false positive.
// ignore_for_file: recursive_getters
import 'package:drift/drift.dart';

import 'competitor_tables.dart';
import 'tables.dart';

// Championship standing tables (added in schema v2).
//
// Points are stored as REAL (`double`) so fractional/half points are exact and
// are never coerced to integer. `position` is nullable (an unranked competitor
// keeps a null position, never a false 0), while a genuine zero-point total
// keeps its zero. `orderIndex` preserves the authoritative championship order as
// delivered by the source (ties broken upstream, not re-derived locally). Rows
// are keyed by (season, competitorId); reads order by (season, orderIndex).

@DataClassName('DriverStandingRow')
@TableIndex(
  name: 'idx_driver_standings_season_order',
  columns: {#season, #orderIndex},
)
class DriverStandings extends Table {
  IntColumn get season =>
      integer().references(Seasons, #year, onDelete: KeyAction.noAction)();
  TextColumn get driverId =>
      text().references(Drivers, #id, onDelete: KeyAction.noAction)();

  /// Primary team for context; nullable per the domain model.
  TextColumn get constructorId => text().nullable().references(
    Constructors,
    #id,
    onDelete: KeyAction.noAction,
  )();
  IntColumn get position => integer().nullable()();

  /// Championship points; fractional values are valid.
  RealColumn get points => real()();
  IntColumn get wins => integer().nullable()();
  IntColumn get podiums => integer().nullable()();
  BoolColumn get provisional => boolean().nullable()();

  /// Authoritative championship order (0-based position in the delivered list).
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{season, driverId};
}

@DataClassName('ConstructorStandingRow')
@TableIndex(
  name: 'idx_constructor_standings_season_order',
  columns: {#season, #orderIndex},
)
class ConstructorStandings extends Table {
  IntColumn get season =>
      integer().references(Seasons, #year, onDelete: KeyAction.noAction)();
  TextColumn get constructorId =>
      text().references(Constructors, #id, onDelete: KeyAction.noAction)();
  IntColumn get position => integer().nullable()();

  /// Championship points; fractional values are valid.
  RealColumn get points => real()();
  IntColumn get wins => integer().nullable()();
  BoolColumn get provisional => boolean().nullable()();

  /// Authoritative championship order (0-based position in the delivered list).
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{season, constructorId};
}
