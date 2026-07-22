import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/standings_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

void main() {
  late GridViewDatabase db;
  late StandingsDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.standingsDao;
  });
  tearDown(() => db.close());

  test(
    'standings preserve the delivered championship order (via order_index)',
    () async {
      // Rows are persisted and read back in the exact delivered order, so
      // upstream tie-breaking is preserved rather than re-derived locally.
      await dao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'p1',
          position: 1,
          points: 300,
        ),
        const DriverStanding(
          season: 2026,
          driverId: 'p2',
          position: 2,
          points: 200,
        ),
        const DriverStanding(season: 2026, driverId: 'unranked', points: 0),
      ]);

      final List<DriverStanding> standings = await dao.driverStandingsForSeason(
        2026,
      );
      expect(standings.map((DriverStanding s) => s.driverId), <String>[
        'p1',
        'p2',
        'unranked',
      ]);
      // A genuine zero-point total keeps its zero (never null / dropped) and an
      // unranked competitor keeps a null position.
      expect(standings.last.points, 0);
      expect(standings.last.position, isNull);
    },
  );

  test('fractional points round-trip exactly', () async {
    await dao.replaceConstructorStandings(2026, <ConstructorStanding>[
      const ConstructorStanding(
        season: 2026,
        constructorId: 'team-a',
        position: 1,
        points: 0.5,
      ),
    ]);
    final List<ConstructorStanding> standings = await dao
        .constructorStandingsForSeason(2026);
    expect(standings.single.points, 0.5);
  });

  test('replacing a season drops obsolete rows without duplicates', () async {
    await dao.replaceDriverStandings(2026, <DriverStanding>[
      const DriverStanding(
        season: 2026,
        driverId: 'a',
        position: 1,
        points: 10,
      ),
      const DriverStanding(season: 2026, driverId: 'b', position: 2, points: 5),
    ]);
    await dao.replaceDriverStandings(2026, <DriverStanding>[
      const DriverStanding(
        season: 2026,
        driverId: 'a',
        position: 1,
        points: 18,
      ),
    ]);

    final List<DriverStanding> standings = await dao.driverStandingsForSeason(
      2026,
    );
    expect(standings, hasLength(1));
    expect(standings.single.driverId, 'a');
    expect(standings.single.points, 18);
  });

  test(
    'writing a standing ensures the referenced competitor identity rows',
    () async {
      // Neither driver nor constructor pre-exist: the write must still succeed
      // (FK satisfied by minimal ensured identity rows).
      await dao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'brand-new-driver',
          constructorId: 'brand-new-team',
          position: 1,
          points: 25,
        ),
      ]);

      expect(await db.select(db.drivers).get(), hasLength(1));
      expect(await db.select(db.constructors).get(), hasLength(1));
      final DriverStanding? one = await dao.driverStanding(
        2026,
        'brand-new-driver',
      );
      expect(one?.constructorId, 'brand-new-team');
    },
  );

  test('replacing one season leaves another season untouched', () async {
    await dao.replaceDriverStandings(2025, <DriverStanding>[
      const DriverStanding(
        season: 2025,
        driverId: 'a',
        position: 1,
        points: 100,
      ),
    ]);
    await dao.replaceDriverStandings(2026, <DriverStanding>[
      const DriverStanding(
        season: 2026,
        driverId: 'a',
        position: 3,
        points: 40,
      ),
    ]);

    final List<DriverStanding> s2025 = await dao.driverStandingsForSeason(2025);
    expect(s2025, hasLength(1));
    expect(s2025.single.points, 100);
    expect(s2025.single.position, 1);
  });

  test('replacing with an identical set is idempotent', () async {
    const List<DriverStanding> set = <DriverStanding>[
      DriverStanding(season: 2026, driverId: 'a', position: 1, points: 25),
      DriverStanding(season: 2026, driverId: 'b', position: 2, points: 18),
    ];
    await dao.replaceDriverStandings(2026, set);
    await dao.replaceDriverStandings(2026, set);

    final List<DriverStanding> standings = await dao.driverStandingsForSeason(
      2026,
    );
    expect(standings, hasLength(2));
    expect(standings.map((DriverStanding s) => s.driverId), <String>['a', 'b']);
  });

  test('duplicate championship positions are allowed', () async {
    // Two competitors may (transiently) share a position; the store does not
    // reject it.
    await dao.replaceConstructorStandings(2026, <ConstructorStanding>[
      const ConstructorStanding(
        season: 2026,
        constructorId: 'x',
        position: 5,
        points: 10,
      ),
      const ConstructorStanding(
        season: 2026,
        constructorId: 'y',
        position: 5,
        points: 10,
      ),
    ]);
    expect(await dao.constructorStandingsForSeason(2026), hasLength(2));
  });
}
