// Drift column `.check()` constraints reference the column getter in their own
// definition (the documented drift DSL pattern); drift analyses the AST and
// never executes the getter, so the recursive-getter lint is a false positive.
// ignore_for_file: recursive_getters
import 'package:drift/drift.dart';

import 'competitor_tables.dart';
import 'tables.dart';

// Race/sprint classification tables (added in schema v2).
//
// A `RaceResult` is the classification for a points-awarding session and is
// owned by its Grand Prix (cascade). Timing is stored structurally: durations
// are whole milliseconds (`...Millis`), never pre-formatted strings; `gapText`
// is an optional display fallback only. Points are REAL so fractional values
// are exact. A not-yet-run session is `status = unavailable` with no entry rows.

@DataClassName('RaceResultRow')
class RaceResults extends Table {
  TextColumn get id => text()();
  IntColumn get season => integer().check(season.isBetweenValues(1950, 2100))();
  IntColumn get round => integer().check(round.isBetweenValues(1, 30))();

  /// Cascades: removing a Grand Prix removes its result documents.
  TextColumn get grandPrixId =>
      text().references(GrandPrixEvents, #id, onDelete: KeyAction.cascade)();

  /// `SessionType` wire token (`race` or `sprint`).
  TextColumn get sessionType => text()();

  /// `ResultStatus` wire token.
  TextColumn get status => text()();

  /// Optional session fastest lap, flattened from the domain `FastestLap` value
  /// object. The duration is stored as whole milliseconds.
  TextColumn get fastestLapDriverId => text().nullable()();
  IntColumn get fastestLapTimeMillis => integer().nullable().check(
    fastestLapTimeMillis.isBiggerOrEqualValue(0),
  )();
  IntColumn get fastestLapLap =>
      integer().nullable().check(fastestLapLap.isBiggerOrEqualValue(1))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};

  /// One result document per (event, session type) — a sprint weekend has both
  /// a sprint and a race result, so uniqueness is on the pair, not the event.
  @override
  List<Set<Column<Object>>> get uniqueKeys => <Set<Column<Object>>>[
    <Column<Object>>{grandPrixId, sessionType},
  ];
}

/// One classification row within a [RaceResults]. Keyed by (raceResultId,
/// driverId) — a driver is classified once per result — with an explicit
/// `orderIndex` for the classification order.
@DataClassName('RaceResultEntryRow')
@TableIndex(name: 'idx_rre_result_order', columns: {#raceResultId, #orderIndex})
class RaceResultEntries extends Table {
  /// Cascades: removing a result document removes its classification rows.
  TextColumn get raceResultId =>
      text().references(RaceResults, #id, onDelete: KeyAction.cascade)();
  TextColumn get driverId =>
      text().references(Drivers, #id, onDelete: KeyAction.noAction)();
  TextColumn get constructorId =>
      text().references(Constructors, #id, onDelete: KeyAction.noAction)();
  IntColumn get position =>
      integer().nullable().check(position.isBiggerOrEqualValue(1))();
  IntColumn get gridPosition =>
      integer().nullable().check(gridPosition.isBiggerOrEqualValue(0))();

  /// Points scored; fractional values are valid; `null` when none is the
  /// confirmed absence.
  RealColumn get points => real().nullable()();

  /// `FinishStatus` wire token.
  TextColumn get status => text()();
  IntColumn get laps =>
      integer().nullable().check(laps.isBiggerOrEqualValue(0))();

  /// Total elapsed race time for a classified finisher, in whole milliseconds.
  IntColumn get elapsedTimeMillis =>
      integer().nullable().check(elapsedTimeMillis.isBiggerOrEqualValue(0))();

  /// Gap to the leader for a same-lap finisher, in whole milliseconds.
  IntColumn get gapToLeaderMillis =>
      integer().nullable().check(gapToLeaderMillis.isBiggerOrEqualValue(0))();

  /// Whole laps behind the leader for a lapped finisher.
  IntColumn get lapsBehind =>
      integer().nullable().check(lapsBehind.isBiggerOrEqualValue(0))();
  BoolColumn get fastestLap => boolean().nullable()();
  TextColumn get dnfReason => text().nullable()();

  /// Optional display fallback only; never the sole gap representation.
  TextColumn get gapText => text().nullable()();

  /// Explicit classification ordering.
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{
    raceResultId,
    driverId,
  };
}
