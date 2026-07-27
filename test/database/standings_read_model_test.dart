import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart';
import 'package:gridview/core/database/daos/standings_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';

/// The Standings presentation read models, read from a real database.
///
/// These prove what the championship tables are allowed to say about their rows:
/// the delivered order is authoritative, the team comes from the standing's own
/// `constructorId` and nothing optional is ever turned into a false value.
void main() {
  late GridViewDatabase db;
  late StandingsDao dao;
  late CompetitorDao competitors;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.standingsDao;
    competitors = db.competitorDao;
  });
  tearDown(() => db.close());

  Future<void> seedCompetitors() async {
    await competitors.upsertDrivers(<Driver>[
      const Driver(
        id: 'max-verstappen',
        fullName: 'Max Verstappen',
        shortCode: 'VER',
      ),
      const Driver(
        id: 'lando-norris',
        fullName: 'Lando Norris',
        shortCode: 'NOR',
      ),
    ]);
    await competitors.upsertConstructors(<Constructor>[
      const Constructor(
        id: 'red-bull',
        name: 'Red Bull Racing',
        colorPrimary: '#1E41FF',
      ),
      const Constructor(id: 'mclaren', name: 'McLaren'),
    ]);
    await competitors
        .replaceConstructorSeasonEntries(2026, <ConstructorSeasonEntry>[
          const ConstructorSeasonEntry(
            id: 'cse-mclaren-2026',
            season: 2026,
            constructorId: 'mclaren',
            fullName: 'McLaren Formula 1 Team',
            colorPrimary: '#FF8000',
          ),
        ]);
  }

  group('drivers read model', () {
    test(
      'joins the stable driver identity and the season team branding',
      () async {
        await seedCompetitors();
        await dao.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            position: 1,
            points: 232.5,
            wins: 5,
            podiums: 10,
          ),
          const DriverStanding(
            season: 2026,
            driverId: 'max-verstappen',
            constructorId: 'red-bull',
            position: 2,
            points: 241,
          ),
        ]);

        final List<DriverStandingEntry> rows = await dao.driverStandingEntries(
          2026,
        );

        expect(rows.first.driverName, 'Lando Norris');
        expect(rows.first.driverShortCode, 'NOR');
        // Season branding wins over the stable constructor name.
        expect(rows.first.constructorName, 'McLaren Formula 1 Team');
        expect(rows.first.teamColor, '#FF8000');
        expect(rows.first.points, 232.5);
        expect(rows.first.wins, 5);
        expect(rows.first.podiums, 10);

        // No season entry stored for Red Bull: the stable identity is the
        // fallback, never an invented name.
        expect(rows.last.constructorName, 'Red Bull Racing');
        expect(rows.last.teamColor, '#1E41FF');
        // Optional statistics the contract omitted stay null — never a zero.
        expect(rows.last.wins, isNull);
        expect(rows.last.podiums, isNull);
      },
    );

    test('a null constructorId does not guess a team', () async {
      await seedCompetitors();
      // The driver *does* have a season participation entry for a team; the
      // standing still names no constructor, so no team is shown.
      await competitors.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: 'dse-ver-2026',
          season: 2026,
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
      ]);
      await dao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 1,
          points: 10,
        ),
      ]);

      final List<DriverStandingEntry> rows = await dao.driverStandingEntries(
        2026,
      );
      expect(rows.single.constructorId, isNull);
      expect(rows.single.constructorName, isNull);
      expect(rows.single.teamColor, isNull);
      // Stable identity is unaffected.
      expect(rows.single.driverName, 'Max Verstappen');
    });

    test(
      'mid-season stints never duplicate or re-team a standing row',
      () async {
        await seedCompetitors();
        // Two participation entries for one driver in one season.
        await competitors.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
          const DriverSeasonEntry(
            id: 'dse-nor-a',
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            startRound: 1,
            endRound: 10,
          ),
          const DriverSeasonEntry(
            id: 'dse-nor-b',
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'red-bull',
            startRound: 11,
          ),
        ]);
        await dao.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            position: 1,
            points: 100,
          ),
        ]);

        final List<DriverStandingEntry> rows = await dao.driverStandingEntries(
          2026,
        );
        expect(rows, hasLength(1));
        // Exactly the constructor the standing names — not the later stint.
        expect(rows.single.constructorName, 'McLaren Formula 1 Team');
      },
    );

    test('an unsynchronised competitor keeps its stable identity', () async {
      // Standings persisted before their competitors were synchronised. The
      // write path creates the minimal identity row required for referential
      // integrity (`drivers.full_name` is NOT NULL, so it carries a humanised
      // placeholder — Phase 6A persistence behaviour). The read model adds
      // nothing of its own: it reports exactly what is stored, keeps the stable
      // id intact for navigation, and leaves genuinely absent optional identity
      // fields null rather than deriving them.
      await dao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'unsynced-driver',
          position: 1,
          points: 1,
        ),
      ]);
      final List<DriverStandingEntry> rows = await dao.driverStandingEntries(
        2026,
      );
      expect(rows.single.driverId, 'unsynced-driver');
      expect(rows.single.driverName, 'Unsynced Driver');
      expect(rows.single.driverShortCode, isNull);
      expect(rows.single.constructorName, isNull);
    });

    test('a read model with no stored identity reports no name', () async {
      // The defensive path: a row whose identity is not present locally at all
      // reports a null name, which the screen renders as a localized
      // "unavailable" fallback rather than as an invented name.
      const DriverStandingEntry entry = DriverStandingEntry(
        standing: DriverStanding(
          season: 2026,
          driverId: 'ghost-driver',
          points: 0,
        ),
        orderIndex: 0,
      );
      expect(entry.driverName, isNull);
      expect(entry.driverId, 'ghost-driver');
    });
  });

  group('constructors read model', () {
    test('prefers season branding, then the stable identity', () async {
      await seedCompetitors();
      await dao.replaceConstructorStandings(2026, <ConstructorStanding>[
        const ConstructorStanding(
          season: 2026,
          constructorId: 'mclaren',
          position: 1,
          points: 460.5,
          wins: 9,
        ),
        const ConstructorStanding(
          season: 2026,
          constructorId: 'red-bull',
          position: 2,
          points: 331,
        ),
      ]);

      final List<ConstructorStandingEntry> rows = await dao
          .constructorStandingEntries(2026);

      expect(rows.first.seasonName, 'McLaren Formula 1 Team');
      expect(rows.first.stableName, 'McLaren');
      expect(rows.first.displayName, 'McLaren Formula 1 Team');
      expect(rows.first.teamColor, '#FF8000');
      expect(rows.first.points, 460.5);
      expect(rows.first.wins, 9);

      expect(rows.last.seasonName, isNull);
      expect(rows.last.displayName, 'Red Bull Racing');
      expect(rows.last.wins, isNull);
      // A display name is never identity.
      expect(rows.last.constructorId, 'red-bull');
    });
  });

  group('delivered order', () {
    test(
      'order_index wins over null, duplicated and non-monotonic positions',
      () async {
        await dao.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'd-a',
            position: 4,
            points: 10,
          ),
          const DriverStanding(season: 2026, driverId: 'd-b', points: 99),
          const DriverStanding(
            season: 2026,
            driverId: 'd-c',
            position: 1,
            points: 0,
          ),
          const DriverStanding(
            season: 2026,
            driverId: 'd-d',
            position: 1,
            points: 0.5,
          ),
        ]);

        final List<DriverStandingEntry> rows = await dao.driverStandingEntries(
          2026,
        );
        // Exactly as delivered: not by position, not by points, not by name.
        expect(rows.map((DriverStandingEntry r) => r.driverId), <String>[
          'd-a',
          'd-b',
          'd-c',
          'd-d',
        ]);
        expect(rows.map((DriverStandingEntry r) => r.orderIndex), <int>[
          0,
          1,
          2,
          3,
        ]);
        // Duplicated and null positions survive; a confirmed zero stays zero.
        expect(rows[1].position, isNull);
        expect(rows[2].position, 1);
        expect(rows[3].position, 1);
        expect(rows[2].points, 0);
        expect(rows[3].points, 0.5);
      },
    );

    test('constructor rows keep their delivered order too', () async {
      await dao.replaceConstructorStandings(2026, <ConstructorStanding>[
        const ConstructorStanding(
          season: 2026,
          constructorId: 't-low',
          position: 9,
          points: 1,
        ),
        const ConstructorStanding(
          season: 2026,
          constructorId: 't-high',
          position: 1,
          points: 500,
        ),
      ]);
      final List<ConstructorStandingEntry> rows = await dao
          .constructorStandingEntries(2026);
      expect(
        rows.map((ConstructorStandingEntry r) => r.constructorId),
        <String>['t-low', 't-high'],
      );
    });
  });

  group('season isolation', () {
    test(
      'another season is excluded and its stable identities are kept',
      () async {
        await seedCompetitors();
        await dao.replaceDriverStandings(2025, <DriverStanding>[
          const DriverStanding(
            season: 2025,
            driverId: 'max-verstappen',
            constructorId: 'red-bull',
            position: 1,
            points: 400,
          ),
        ]);
        await dao.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            position: 1,
            points: 100,
          ),
        ]);

        expect(
          (await dao.driverStandingEntries(
            2026,
          )).map((DriverStandingEntry r) => r.driverId),
          <String>['lando-norris'],
        );
        // The previous season's rows stay on disk, simply unwatched.
        expect(
          (await dao.driverStandingEntries(
            2025,
          )).map((DriverStandingEntry r) => r.driverId),
          <String>['max-verstappen'],
        );
        // Replacing a season's table never deletes competitor identities.
        expect(await competitors.countDriver('max-verstappen'), 1);
        expect(await competitors.countConstructor('red-bull'), 1);
      },
    );

    test('season branding is scoped to the read season', () async {
      await seedCompetitors();
      await competitors
          .replaceConstructorSeasonEntries(2025, <ConstructorSeasonEntry>[
            const ConstructorSeasonEntry(
              id: 'cse-mclaren-2025',
              season: 2025,
              constructorId: 'mclaren',
              fullName: 'McLaren 2025 Team',
            ),
          ]);
      await dao.replaceConstructorStandings(2026, <ConstructorStanding>[
        const ConstructorStanding(
          season: 2026,
          constructorId: 'mclaren',
          position: 1,
          points: 1,
        ),
      ]);

      final List<ConstructorStandingEntry> rows = await dao
          .constructorStandingEntries(2026);
      expect(rows.single.seasonName, 'McLaren Formula 1 Team');
    });
  });

  test('an empty season yields an empty table, not an error', () async {
    expect(await dao.driverStandingEntries(2026), isEmpty);
    expect(await dao.constructorStandingEntries(2026), isEmpty);
  });
}
