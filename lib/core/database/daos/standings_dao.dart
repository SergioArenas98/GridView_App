import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/standing.dart';
import '../../../features/shared/domain/entities/standing_entry.dart';
import '../competitor_tables.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../standing_tables.dart';
import '../tables.dart';

part 'standings_dao.g.dart';

/// Local data source for driver and constructor championship standings.
///
/// Writes replace a whole season's table in one transaction (so a refreshed
/// standings snapshot never leaves stale rows behind), and defensively ensure
/// the referenced season/competitor identity rows exist so the collection can
/// be persisted before its competitors are fully synchronised.
///
/// Reads return domain standings — or the richer [DriverStandingEntry] /
/// [ConstructorStandingEntry] read models the Standings screen consumes — in the
/// **delivered** order recorded in `order_index`. That order is authoritative:
/// it is never recomputed from position, points or names, so duplicated, null or
/// non-monotonic positions survive exactly as the contract supplied them.
@DriftAccessor(
  tables: <Type>[
    DriverStandings,
    ConstructorStandings,
    Seasons,
    Drivers,
    Constructors,
    ConstructorSeasonEntries,
  ],
)
class StandingsDao extends DatabaseAccessor<GridViewDatabase>
    with _$StandingsDaoMixin {
  StandingsDao(super.db);

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  Future<void> replaceDriverStandings(
    int season,
    List<DriverStanding> standings,
  ) {
    return transaction(() async {
      validateSeason(season);
      for (final DriverStanding s in standings) {
        validateSlug(s.driverId, field: 'driverId');
        validateSeason(s.season, field: 'standing season');
        if (s.constructorId != null) {
          validateSlug(s.constructorId!, field: 'constructorId');
        }
      }
      await _ensureSeason(season);
      await (delete(
        driverStandings,
      )..where((DriverStandings s) => s.season.equals(season))).go();
      for (int i = 0; i < standings.length; i++) {
        final DriverStanding s = standings[i];
        await _ensureDriver(s.driverId);
        if (s.constructorId != null) await _ensureConstructor(s.constructorId!);
        await into(driverStandings).insert(_driverCompanion(s, i));
      }
    });
  }

  Future<void> replaceConstructorStandings(
    int season,
    List<ConstructorStanding> standings,
  ) {
    return transaction(() async {
      validateSeason(season);
      for (final ConstructorStanding s in standings) {
        validateSlug(s.constructorId, field: 'constructorId');
        validateSeason(s.season, field: 'standing season');
      }
      await _ensureSeason(season);
      await (delete(
        constructorStandings,
      )..where((ConstructorStandings s) => s.season.equals(season))).go();
      for (int i = 0; i < standings.length; i++) {
        final ConstructorStanding s = standings[i];
        await _ensureConstructor(s.constructorId);
        await into(constructorStandings).insert(_constructorCompanion(s, i));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  Future<List<DriverStanding>> driverStandingsForSeason(int season) async {
    final List<DriverStandingRow> rows = await _driverRows(season);
    return rows.map(_driverFrom).toList(growable: false);
  }

  Future<List<ConstructorStanding>> constructorStandingsForSeason(
    int season,
  ) async {
    final List<ConstructorStandingRow> rows = await _constructorRows(season);
    return rows.map(_constructorFrom).toList(growable: false);
  }

  /// The season's driver standing rows in the delivered `order_index` order.
  Future<List<DriverStandingRow>> _driverRows(int season) =>
      (select(driverStandings)
            ..where((DriverStandings s) => s.season.equals(season))
            ..orderBy(<OrderClauseGenerator<DriverStandings>>[
              (DriverStandings s) => OrderingTerm(expression: s.orderIndex),
            ]))
          .get();

  /// The season's constructor standing rows in the delivered `order_index`
  /// order.
  Future<List<ConstructorStandingRow>> _constructorRows(int season) =>
      (select(constructorStandings)
            ..where((ConstructorStandings s) => s.season.equals(season))
            ..orderBy(<OrderClauseGenerator<ConstructorStandings>>[
              (ConstructorStandings s) =>
                  OrderingTerm(expression: s.orderIndex),
            ]))
          .get();

  Stream<List<DriverStanding>> watchDriverStandingsForSeason(int season) =>
      (select(driverStandings)
            ..where((DriverStandings s) => s.season.equals(season))
            ..orderBy(<OrderClauseGenerator<DriverStandings>>[
              (DriverStandings s) => OrderingTerm(expression: s.orderIndex),
            ]))
          .watch()
          .map(
            (List<DriverStandingRow> rows) =>
                rows.map(_driverFrom).toList(growable: false),
          );

  Stream<List<ConstructorStanding>> watchConstructorStandingsForSeason(
    int season,
  ) =>
      (select(constructorStandings)
            ..where((ConstructorStandings s) => s.season.equals(season))
            ..orderBy(<OrderClauseGenerator<ConstructorStandings>>[
              (ConstructorStandings s) =>
                  OrderingTerm(expression: s.orderIndex),
            ]))
          .watch()
          .map(
            (List<ConstructorStandingRow> rows) =>
                rows.map(_constructorFrom).toList(growable: false),
          );

  // ---------------------------------------------------------------------------
  // Presentation read models
  // ---------------------------------------------------------------------------

  /// The season's drivers' table as [DriverStandingEntry] read models, in the
  /// delivered `order_index` order.
  ///
  /// The team context comes from **exactly** `DriverStanding.constructorId`: a
  /// standing that names no constructor gets no team, and a driver's
  /// participation entries are deliberately not consulted, so a mid-season
  /// change can neither invent a "current team" nor duplicate a standing row.
  Future<List<DriverStandingEntry>> driverStandingEntries(int season) async {
    final List<DriverStandingRow> rows = await _driverRows(season);
    if (rows.isEmpty) return const <DriverStandingEntry>[];

    final Map<String, DriverRow> identities = await _driversById(
      rows.map((DriverStandingRow r) => r.driverId).toSet(),
    );
    final Set<String> teamIds = rows
        .map((DriverStandingRow r) => r.constructorId)
        .whereType<String>()
        .toSet();
    final Map<String, ConstructorRow> teams = await _constructorsById(teamIds);
    final Map<String, ConstructorSeasonEntryRow> branding = await _brandingById(
      season,
      teamIds,
    );

    return rows
        .map((DriverStandingRow r) {
          final DriverRow? identity = identities[r.driverId];
          final String? teamId = r.constructorId;
          final ConstructorRow? team = teamId == null ? null : teams[teamId];
          final ConstructorSeasonEntryRow? entry = teamId == null
              ? null
              : branding[teamId];
          return DriverStandingEntry(
            standing: _driverFrom(r),
            orderIndex: r.orderIndex,
            driverName: identity?.fullName,
            driverShortCode: identity?.shortCode,
            constructorName: teamId == null
                ? null
                : (entry?.fullName ?? entry?.shortName ?? team?.name),
            teamColor: teamId == null
                ? null
                : (entry?.colorPrimary ?? team?.colorPrimary),
          );
        })
        .toList(growable: false);
  }

  /// Streams [driverStandingEntries]; re-emits after any commit that can change
  /// a row, a driver identity or a team's season branding.
  Stream<List<DriverStandingEntry>> watchDriverStandingEntries(int season) =>
      _watch(<ResultSetImplementation<dynamic, dynamic>>[
        driverStandings,
        drivers,
        constructors,
        constructorSeasonEntries,
      ], () => driverStandingEntries(season));

  /// The season's constructors' table as [ConstructorStandingEntry] read
  /// models, in the delivered `order_index` order. Season-specific branding is
  /// preferred over the stable identity name; neither is ever used as identity.
  Future<List<ConstructorStandingEntry>> constructorStandingEntries(
    int season,
  ) async {
    final List<ConstructorStandingRow> rows = await _constructorRows(season);
    if (rows.isEmpty) return const <ConstructorStandingEntry>[];

    final Set<String> ids = rows
        .map((ConstructorStandingRow r) => r.constructorId)
        .toSet();
    final Map<String, ConstructorRow> identities = await _constructorsById(ids);
    final Map<String, ConstructorSeasonEntryRow> branding = await _brandingById(
      season,
      ids,
    );

    return rows
        .map((ConstructorStandingRow r) {
          final ConstructorRow? identity = identities[r.constructorId];
          final ConstructorSeasonEntryRow? entry = branding[r.constructorId];
          return ConstructorStandingEntry(
            standing: _constructorFrom(r),
            orderIndex: r.orderIndex,
            seasonName: entry?.fullName ?? entry?.shortName,
            stableName: identity?.name,
            teamColor: entry?.colorPrimary ?? identity?.colorPrimary,
          );
        })
        .toList(growable: false);
  }

  /// Streams [constructorStandingEntries]; re-emits after any commit that can
  /// change a row, a team identity or its season branding.
  Stream<List<ConstructorStandingEntry>> watchConstructorStandingEntries(
    int season,
  ) => _watch(<ResultSetImplementation<dynamic, dynamic>>[
    constructorStandings,
    constructors,
    constructorSeasonEntries,
  ], () => constructorStandingEntries(season));

  Future<int> countDriverStandings(int season) async {
    final List<DriverStandingRow> rows = await (select(
      driverStandings,
    )..where((DriverStandings s) => s.season.equals(season))).get();
    return rows.length;
  }

  Future<int> countConstructorStandings(int season) async {
    final List<ConstructorStandingRow> rows = await (select(
      constructorStandings,
    )..where((ConstructorStandings s) => s.season.equals(season))).get();
    return rows.length;
  }

  Future<DriverStanding?> driverStanding(int season, String driverId) async {
    final DriverStandingRow? row =
        await (select(driverStandings)..where(
              (DriverStandings s) =>
                  s.season.equals(season) & s.driverId.equals(driverId),
            ))
            .getSingleOrNull();
    return row == null ? null : _driverFrom(row);
  }

  Future<ConstructorStanding?> constructorStanding(
    int season,
    String constructorId,
  ) async {
    final ConstructorStandingRow? row =
        await (select(constructorStandings)..where(
              (ConstructorStandings s) =>
                  s.season.equals(season) &
                  s.constructorId.equals(constructorId),
            ))
            .getSingleOrNull();
    return row == null ? null : _constructorFrom(row);
  }

  // ---------------------------------------------------------------------------
  // Lookups used to compose the read models
  // ---------------------------------------------------------------------------

  Future<Map<String, DriverRow>> _driversById(Set<String> ids) async {
    if (ids.isEmpty) return const <String, DriverRow>{};
    final List<DriverRow> rows = await (select(
      drivers,
    )..where((Drivers d) => d.id.isIn(ids))).get();
    return <String, DriverRow>{for (final DriverRow r in rows) r.id: r};
  }

  Future<Map<String, ConstructorRow>> _constructorsById(Set<String> ids) async {
    if (ids.isEmpty) return const <String, ConstructorRow>{};
    final List<ConstructorRow> rows = await (select(
      constructors,
    )..where((Constructors c) => c.id.isIn(ids))).get();
    return <String, ConstructorRow>{
      for (final ConstructorRow r in rows) r.id: r,
    };
  }

  /// A season's stored team branding, keyed by stable constructor id. Scoped to
  /// [season] so one season's rebranding never leaks into another's table.
  Future<Map<String, ConstructorSeasonEntryRow>> _brandingById(
    int season,
    Set<String> ids,
  ) async {
    if (ids.isEmpty) return const <String, ConstructorSeasonEntryRow>{};
    final List<ConstructorSeasonEntryRow> rows =
        await (select(constructorSeasonEntries)..where(
              (ConstructorSeasonEntries e) =>
                  e.season.equals(season) & e.constructorId.isIn(ids),
            ))
            .get();
    return <String, ConstructorSeasonEntryRow>{
      for (final ConstructorSeasonEntryRow r in rows) r.constructorId: r,
    };
  }

  /// Emits an initial value, then re-emits after any commit to [tables].
  Stream<T> _watch<T>(
    List<ResultSetImplementation<dynamic, dynamic>> tables,
    Future<T> Function() read,
  ) async* {
    yield await read();
    yield* attachedDatabase
        .tableUpdates(TableUpdateQuery.onAllTables(tables))
        .asyncMap((_) => read());
  }

  // ---------------------------------------------------------------------------
  // Reference ensuring (minimal identity rows for FK integrity)
  // ---------------------------------------------------------------------------

  Future<void> _ensureSeason(int year) => into(seasons).insert(
    SeasonsCompanion.insert(
      year: Value<int>(year),
      status: SeasonStatus.unknown.wire,
    ),
    mode: InsertMode.insertOrIgnore,
  );

  Future<void> _ensureDriver(String id) => into(drivers).insert(
    DriversCompanion.insert(id: id, fullName: _humanizeSlug(id)),
    mode: InsertMode.insertOrIgnore,
  );

  Future<void> _ensureConstructor(String id) => into(constructors).insert(
    ConstructorsCompanion.insert(id: id, name: _humanizeSlug(id)),
    mode: InsertMode.insertOrIgnore,
  );

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  DriverStandingsCompanion _driverCompanion(DriverStanding s, int order) =>
      DriverStandingsCompanion.insert(
        season: s.season,
        driverId: s.driverId,
        constructorId: Value<String?>(s.constructorId),
        position: Value<int?>(s.position),
        points: s.points,
        wins: Value<int?>(s.wins),
        podiums: Value<int?>(s.podiums),
        provisional: Value<bool?>(s.provisional),
        orderIndex: order,
      );

  ConstructorStandingsCompanion _constructorCompanion(
    ConstructorStanding s,
    int order,
  ) => ConstructorStandingsCompanion.insert(
    season: s.season,
    constructorId: s.constructorId,
    position: Value<int?>(s.position),
    points: s.points,
    wins: Value<int?>(s.wins),
    provisional: Value<bool?>(s.provisional),
    orderIndex: order,
  );

  DriverStanding _driverFrom(DriverStandingRow r) => DriverStanding(
    season: r.season,
    driverId: r.driverId,
    constructorId: r.constructorId,
    position: r.position,
    points: r.points,
    wins: r.wins,
    podiums: r.podiums,
    provisional: r.provisional,
  );

  ConstructorStanding _constructorFrom(ConstructorStandingRow r) =>
      ConstructorStanding(
        season: r.season,
        constructorId: r.constructorId,
        position: r.position,
        points: r.points,
        wins: r.wins,
        provisional: r.provisional,
      );

  String _humanizeSlug(String slug) => slug
      .split('-')
      .map(
        (String w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
      )
      .join(' ');
}
