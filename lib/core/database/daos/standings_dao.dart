import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/standing.dart';
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
/// be persisted before its competitors are fully synchronised. Reads return
/// domain standings ordered by championship position (unranked competitors
/// last, then by points descending).
@DriftAccessor(
  tables: <Type>[
    DriverStandings,
    ConstructorStandings,
    Seasons,
    Drivers,
    Constructors,
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
    final List<DriverStandingRow> rows =
        await (select(driverStandings)
              ..where((DriverStandings s) => s.season.equals(season))
              ..orderBy(<OrderClauseGenerator<DriverStandings>>[
                (DriverStandings s) => OrderingTerm(expression: s.orderIndex),
              ]))
            .get();
    return rows.map(_driverFrom).toList(growable: false);
  }

  Future<List<ConstructorStanding>> constructorStandingsForSeason(
    int season,
  ) async {
    final List<ConstructorStandingRow> rows =
        await (select(constructorStandings)
              ..where((ConstructorStandings s) => s.season.equals(season))
              ..orderBy(<OrderClauseGenerator<ConstructorStandings>>[
                (ConstructorStandings s) =>
                    OrderingTerm(expression: s.orderIndex),
              ]))
            .get();
    return rows.map(_constructorFrom).toList(growable: false);
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
