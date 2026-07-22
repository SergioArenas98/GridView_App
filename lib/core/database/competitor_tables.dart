// Drift column `.check()` constraints reference the column getter in their own
// definition (the documented drift DSL pattern); drift analyses the AST and
// never executes the getter, so the recursive-getter lint is a false positive.
// ignore_for_file: recursive_getters
import 'package:drift/drift.dart';

import 'tables.dart';

// Competitor identity and season participation tables (added in schema v2).
//
// Identity is separate from participation (domain rule): `Drivers` and
// `Constructors` hold only the stable biographical identity; a competitor's
// team, race number and livery for a given year live on the season-entry
// tables. Foreign keys to the identity tables use `noAction` (identity rows are
// stable and never cascade-deleted), matching the v1 `grand_prix -> circuits`
// convention.
//
// A constructor's season line-up is NOT persisted as a separate table: it is
// the set of `DriverSeasonEntries` for that season and constructor (the single
// source of truth for driver/team membership), derived on read.

@DataClassName('DriverRow')
class Drivers extends Table {
  TextColumn get id => text()();
  TextColumn get fullName => text()();
  TextColumn get givenName => text().nullable()();
  TextColumn get familyName => text().nullable()();

  /// Three-letter broadcast code (biographical/current value).
  TextColumn get shortCode => text().nullable()();

  /// Career permanent number (season car number lives on the season entry).
  IntColumn get permanentNumber => integer().nullable()();
  TextColumn get nationality => text().nullable()();

  /// ISO 3166-1 alpha-2, uppercase.
  TextColumn get countryCode => text().nullable()();

  /// Calendar-only date (`YYYY-MM-DD`); no timezone conversion applied.
  TextColumn get dateOfBirth => text().nullable()();
  TextColumn get placeOfBirth => text().nullable()();
  TextColumn get biography => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

@DataClassName('ConstructorRow')
class Constructors extends Table {
  TextColumn get id => text()();

  /// Canonical base name; season entrant names differ per year.
  TextColumn get name => text()();
  TextColumn get shortName => text().nullable()();
  TextColumn get nationality => text().nullable()();

  /// ISO 3166-1 alpha-2, uppercase.
  TextColumn get countryCode => text().nullable()();

  /// Base brand colour `#RRGGBB`; season livery overrides on the season entry.
  TextColumn get colorPrimary => text().nullable()();
  TextColumn get biography => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// A driver's participation for a team over a span of a season. A mid-season
/// change is two entries with different `startRound`/`endRound` spans; driver
/// identity never changes.
@DataClassName('DriverSeasonEntryRow')
@TableIndex(
  name: 'idx_dse_season_driver',
  columns: {#season, #driverId, #startRound, #endRound},
)
@TableIndex(
  name: 'idx_dse_season_constructor',
  columns: {#season, #constructorId, #startRound, #endRound},
)
class DriverSeasonEntries extends Table {
  TextColumn get id => text()();
  IntColumn get season => integer()
      .references(Seasons, #year, onDelete: KeyAction.noAction)
      .check(season.isBetweenValues(1950, 2100))();
  TextColumn get driverId =>
      text().references(Drivers, #id, onDelete: KeyAction.noAction)();

  /// Team for this participation span (season-specific).
  TextColumn get constructorId =>
      text().references(Constructors, #id, onDelete: KeyAction.noAction)();

  /// Season car number (may differ from the driver's permanent number).
  IntColumn get raceNumber => integer().nullable()();

  /// `DriverRole` wire token.
  TextColumn get role => text().nullable()();
  TextColumn get shortCode => text().nullable()();

  /// First/last round of the participation span; `null` means from the season
  /// start / until the season end.
  IntColumn get startRound =>
      integer().nullable().check(startRound.isBetweenValues(1, 30))();
  IntColumn get endRound =>
      integer().nullable().check(endRound.isBetweenValues(1, 30))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// A team's season-specific branding and identity. Rebranding varies these
/// fields across seasons while the stable `constructorId` stays constant. Its
/// line-up is derived from the season's driver entries, not stored here. A team
/// has exactly one entry per season, enforced by `UNIQUE(season, constructorId)`
/// (which also backs the by-season lookup).
@DataClassName('ConstructorSeasonEntryRow')
class ConstructorSeasonEntries extends Table {
  TextColumn get id => text()();
  IntColumn get season => integer()
      .references(Seasons, #year, onDelete: KeyAction.noAction)
      .check(season.isBetweenValues(1950, 2100))();
  TextColumn get constructorId =>
      text().references(Constructors, #id, onDelete: KeyAction.noAction)();
  TextColumn get fullName => text().nullable()();
  TextColumn get shortName => text().nullable()();

  /// Season livery colours `#RRGGBB`.
  TextColumn get colorPrimary => text().nullable()();
  TextColumn get colorSecondary => text().nullable()();
  TextColumn get powerUnit => text().nullable()();
  TextColumn get teamPrincipal => text().nullable()();
  TextColumn get base => text().nullable()();
  TextColumn get chassis => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};

  /// One entry per (season, constructor).
  @override
  List<Set<Column<Object>>> get uniqueKeys => <Set<Column<Object>>>[
    <Column<Object>>{season, constructorId},
  ];
}
