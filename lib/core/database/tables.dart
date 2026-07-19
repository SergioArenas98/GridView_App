import 'package:drift/drift.dart';

// Drift table definitions for the Phase 4 vertical slice.
//
// Only the tables needed by the "Home next Grand Prix -> Grand Prix detail"
// journey are defined here: seasons, circuits, grand_prix, sessions and a
// generic snapshot/freshness metadata table. Other v1 entities (drivers,
// constructors, standings, results, media) are intentionally out of scope until
// later phases.
//
// Conventions:
// - Stable GridView IDs are the primary keys (never display names).
// - Instants are stored in UTC (the database uses `storeDateTimeAsText`, so a
//   `DateTime` column round-trips as an ISO-8601 UTC string).
// - Calendar-only dates (season/event start/end) are kept as `YYYY-MM-DD`
//   text so no timezone conversion is ever applied to them.
// - Enum-like values are stored as their wire token strings; the domain mappers
//   map any unrecognised token to an explicit `unknown` case.
// - Optional values stay nullable.
// - Row classes are suffixed `Row` so they never collide with the equally-named
//   domain entities (`Season`, `Circuit`, ...).

@DataClassName('SeasonRow')
class Seasons extends Table {
  IntColumn get year => integer()();
  TextColumn get label => text().nullable()();

  /// `SeasonStatus` wire token.
  TextColumn get status => text()();
  TextColumn get startDate => text().nullable()();
  TextColumn get endDate => text().nullable()();
  IntColumn get roundCount => integer().nullable()();
  IntColumn get currentRound => integer().nullable()();
  BoolColumn get isCurrent => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{year};
}

@DataClassName('CircuitRow')
class Circuits extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get locality => text().nullable()();
  TextColumn get country => text().nullable()();

  /// ISO 3166-1 alpha-2, uppercase (approved rule).
  TextColumn get countryCode => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

@DataClassName('GrandPrixRow')
class GrandPrixEvents extends Table {
  @override
  String get tableName => 'grand_prix';

  TextColumn get id => text()();
  IntColumn get season =>
      integer().references(Seasons, #year, onDelete: KeyAction.noAction)();
  IntColumn get round => integer()();
  TextColumn get eventSlug => text()();
  TextColumn get name => text()();
  TextColumn get officialName => text().nullable()();
  TextColumn get circuitId =>
      text().references(Circuits, #id, onDelete: KeyAction.noAction)();

  /// `EventStatus` wire token.
  TextColumn get status => text()();

  /// `WeekendFormat` wire token.
  TextColumn get format => text()();

  /// Calendar-only local dates (no timezone conversion applied).
  TextColumn get startDate => text().nullable()();
  TextColumn get endDate => text().nullable()();

  /// Event-local IANA timezone (e.g. `Europe/Brussels`); distinct from any UTC
  /// instant and never derived from a country code.
  TextColumn get timezone => text().nullable()();
  BoolColumn get hasResults => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};

  // Protects Grand Prix uniqueness on (season, round) in addition to the
  // stable id primary key.
  @override
  List<Set<Column<Object>>> get uniqueKeys => <Set<Column<Object>>>[
    <Column<Object>>{season, round},
  ];
}

@DataClassName('SessionRow')
class Sessions extends Table {
  TextColumn get id => text()();

  /// Cascades: removing a Grand Prix removes its sessions.
  TextColumn get grandPrixId =>
      text().references(GrandPrixEvents, #id, onDelete: KeyAction.cascade)();

  /// `SessionType` wire token.
  TextColumn get type => text()();
  TextColumn get name => text().nullable()();

  /// UTC instants (stored as ISO-8601 text via `storeDateTimeAsText`).
  DateTimeColumn get startTimeUtc => dateTime().nullable()();
  DateTimeColumn get endTimeUtc => dateTime().nullable()();

  /// `SessionStatus` wire token.
  TextColumn get status => text()();

  /// Explicit weekend ordering; the client never assumes a fixed session set.
  IntColumn get orderIndex => integer()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// Per-snapshot freshness metadata. One row per synchronised snapshot, keyed by
/// a logical snapshot key (e.g. `home`, `grand_prix:2026:13`). `generatedAt`
/// is the monotonic snapshot version used by the conflict rule.
@DataClassName('SnapshotRow')
class Snapshots extends Table {
  TextColumn get key => text()();

  /// Snapshot generation instant (UTC). Primary ordering key for the
  /// older-snapshot-cannot-overwrite-newer conflict rule.
  DateTimeColumn get generatedAt => dateTime()();
  DateTimeColumn get sourceUpdatedAt => dateTime().nullable()();
  DateTimeColumn get staleAfter => dateTime().nullable()();
  TextColumn get contentVersion => text().nullable()();

  /// Server-provided stale flag, when supplied (a fallback when `staleAfter`
  /// is absent).
  BoolColumn get serverStale => boolean().nullable()();

  /// Optional focus pointer: the `home` snapshot records which (season, round)
  /// Grand Prix is its featured/next event so the Home stream can resolve it.
  IntColumn get focusSeason => integer().nullable()();
  IntColumn get focusRound => integer().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{key};
}
