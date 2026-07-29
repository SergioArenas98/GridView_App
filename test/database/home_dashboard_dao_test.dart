import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/home_dashboard_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

import '../support/domain_fixtures.dart';

/// The Home dashboard composition, exercised against the real Drift pipeline.
///
/// Every case writes through the normal DAO write paths and then reads the
/// composed dashboard, so what is asserted is exactly what the screen receives.
void main() {
  late GridViewDatabase db;
  late HomeDashboardDao dao;

  // The fixture season: rounds 11 and 12 completed, 13 upcoming (sprint), then
  // 14 and 15.
  final DateTime now = DateTime.utc(2026, 7, 18, 12);

  setUp(() async {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.homeDashboardDao;
    await db.seasonDao.upsertSeason(season2026());
  });
  tearDown(() => db.close());

  /// Writes the whole fixture calendar (events, sessions and circuits).
  Future<void> writeCalendar({int season = 2026}) async {
    final List<CalendarEntry> entries = calendarFixture(season: season);
    // The season circuits collection carries the full circuit facts; the
    // calendar collection carries only the events.
    await db.calendarDao.upsertCircuits(
      entries
          .map((CalendarEntry e) => e.circuit)
          .whereType<Circuit>()
          .toList(growable: false),
    );
    await db.calendarDao.replaceCalendar(
      season,
      entries.map((CalendarEntry e) => e.grandPrix).toList(growable: false),
      const <Circuit>[],
    );
  }

  /// Materializes a Home representation for [season], optionally pointing at a
  /// featured round.
  Future<void> writeHomeSnapshot({
    int season = 2026,
    GrandPrix? featured,
    Circuit? circuit,
  }) => db.verticalSliceDao.writeHomeSnapshot(
    homeSeason: season,
    featured: featured,
    featuredCircuit: circuit,
    freshness: freshness(generatedAt: DateTime.utc(2026, 7, 18, 12)),
    force: true,
  );

  group('materialization and season scoping', () {
    test('no Home snapshot means no dashboard at all', () async {
      await writeCalendar();
      expect(await dao.readDashboard(now), isNull);
    });

    test('a materialized Home carries its own season', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.seasonYear, 2026);
      expect(view.season?.year, 2026);
    });

    test(
      'an old season Home reports that old season, never the new one',
      () async {
        await db.seasonDao.upsertSeason(
          Season(year: 2025, status: SeasonStatus.completed, isCurrent: false),
        );
        await writeHomeSnapshot(season: 2025);
        expect((await dao.readDashboard(now))!.seasonYear, 2025);
      },
    );

    test('a materialized Home with no events is valid and empty', () async {
      await writeHomeSnapshot();
      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.focus, isNull);
      expect(view.latestCompleted, isNull);
      expect(view.upcoming, isEmpty);
    });
  });

  group('focus', () {
    test('the persisted focus round is authoritative', () async {
      await writeCalendar();
      // Point Home at the *completed* round 12 even though the calendar can
      // already identify round 13 as the next event.
      await writeHomeSnapshot(
        featured: calendarFixture()
            .firstWhere((CalendarEntry e) => e.round == 12)
            .grandPrix,
      );

      final HomeFocus focus = (await dao.readDashboard(now))!.focus!;
      expect(focus.round, 12);
      expect(focus.source, HomeFocusSource.homeSnapshot);
      expect(
        focus.grandPrix.status,
        EventStatus.completed,
        reason: 'a contract-defined completed focus is not replaced',
      );
    });

    test(
      'no focus round falls back to the shared relevant-event rule',
      () async {
        await writeCalendar();
        await writeHomeSnapshot();

        final HomeFocus focus = (await dao.readDashboard(now))!.focus!;
        expect(focus.round, 13);
        expect(focus.source, HomeFocusSource.calendarFallback);
      },
    );

    test('the focus carries its circuit relation', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      final HomeFocus focus = (await dao.readDashboard(now))!.focus!;
      expect(focus.circuit?.name, 'Circuit de Spa-Francorchamps');
      expect(focus.circuit?.country, 'Belgium');
    });

    test('an unresolved circuit is omitted without hiding the event', () async {
      // An event whose circuit has never synchronised leaves a referential stub.
      await db.calendarDao.replaceCalendar(2026, <GrandPrix>[
        belgianGrandPrix(),
      ], const <Circuit>[]);
      await writeHomeSnapshot();

      final HomeFocus focus = (await dao.readDashboard(now))!.focus!;
      expect(focus.grandPrix.name, 'Belgian Grand Prix');
      expect(focus.circuit, isNull);
    });

    test('sessions keep their delivered order', () async {
      await writeCalendar();
      // Sessions are owned by the event's own snapshot, not by the calendar
      // collection, so the weekend schedule is written through that path.
      await db.verticalSliceDao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: DateTime.utc(2026, 7, 18, 12)),
        force: true,
      );
      await writeHomeSnapshot();

      final HomeFocus focus = (await dao.readDashboard(now))!.focus!;
      expect(focus.sessions.map((Session s) => s.type), <SessionType>[
        SessionType.practice1,
        SessionType.sprintQualifying,
        SessionType.sprint,
        SessionType.qualifying,
        SessionType.race,
      ]);
    });

    test(
      'a focus round with no surviving event row falls back safely',
      () async {
        await writeCalendar();
        await writeHomeSnapshot(
          featured: calendarFixture()
              .firstWhere((CalendarEntry e) => e.round == 13)
              .grandPrix,
        );
        // Drop the event the snapshot points at.
        await db.calendarDao.replaceCalendar(
          2026,
          calendarFixture()
              .where((CalendarEntry e) => e.round != 13)
              .map((CalendarEntry e) => e.grandPrix)
              .toList(growable: false),
          const <Circuit>[],
        );

        final HomeFocus? focus = (await dao.readDashboard(now))!.focus;
        expect(
          focus!.round,
          14,
          reason: 'the calendar supplies a safe fallback',
        );
        expect(focus.source, HomeFocusSource.calendarFallback);
      },
    );
  });

  group('latest completed event and upcoming events', () {
    test(
      'the latest completed event is the most recent finished one',
      () async {
        await writeCalendar();
        await writeHomeSnapshot();
        expect((await dao.readDashboard(now))!.latestCompleted!.round, 12);
      },
    );

    test('no completed event yields none', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      expect(
        (await dao.readDashboard(DateTime.utc(2026, 1, 1)))!.latestCompleted,
        isNull,
      );
    });

    test('upcoming events are chronological and exclude the focus', () async {
      await writeCalendar();
      await writeHomeSnapshot();

      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.focus!.round, 13);
      expect(
        view.upcoming.map((CalendarEntry e) => e.round),
        <int>[14, 15],
        reason: 'the featured round is never shown twice',
      );
    });

    test('upcoming events are bounded by the documented limit', () async {
      final List<GrandPrix> many = <GrandPrix>[
        for (int round = 20; round < 30; round++)
          calendarEntry(
            round: round,
            name: 'Round $round Grand Prix',
            startDate: '2026-09-${(round - 19).toString().padLeft(2, '0')}',
            endDate: '2026-09-${(round - 19).toString().padLeft(2, '0')}',
          ).grandPrix,
      ];
      await db.calendarDao.replaceCalendar(2026, many, const <Circuit>[]);
      await writeHomeSnapshot();

      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.upcoming.length, kHomeUpcomingEventLimit);
    });

    test('upcoming entries carry their circuit relation', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      final CalendarEntry next = (await dao.readDashboard(now))!.upcoming.first;
      expect(next.circuitName, 'Hungaroring');
      expect(next.locality, 'Mogyoród');
    });
  });

  group('championship leaders', () {
    Future<void> writeDriverStandings(List<DriverStanding> rows) =>
        db.standingsDao.replaceDriverStandings(2026, rows);

    test('only a confirmed position 1 becomes a leader', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await db.competitorDao.upsertDriverIdentities(<Driver>[
        const Driver(id: 'max-verstappen', fullName: 'Max Verstappen'),
        const Driver(id: 'lando-norris', fullName: 'Lando Norris'),
      ]);
      await writeDriverStandings(<DriverStanding>[
        // The highest points total, but deliberately *not* position 1.
        const DriverStanding(
          season: 2026,
          driverId: 'lando-norris',
          position: 2,
          points: 999,
        ),
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 1,
          points: 241,
        ),
      ]);

      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.driverLeaders.single.driverId, 'max-verstappen');
      expect(
        view.driverLeaders.single.points,
        241,
        reason: 'a leader is never inferred from a maximum points total',
      );
    });

    test('no position 1 leaves the leaders empty', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeDriverStandings(<DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 2,
          points: 241,
        ),
      ]);
      expect((await dao.readDashboard(now))!.driverLeaders, isEmpty);
    });

    test('a tie preserves every confirmed position 1', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeDriverStandings(<DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 1,
          points: 241,
        ),
        const DriverStanding(
          season: 2026,
          driverId: 'lando-norris',
          position: 1,
          points: 241,
        ),
      ]);
      expect((await dao.readDashboard(now))!.driverLeaders.length, 2);
    });

    test('an unresolved leader identity carries no display name', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeDriverStandings(<DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'never-synced',
          position: 1,
          points: 241,
        ),
      ]);

      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.driverLeaders.single.driverName, isNull);
      expect(view.driverLeaders.single.driverId, 'never-synced');
    });

    test('null and fractional points survive exactly', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeDriverStandings(<DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 1,
          points: 241.5,
        ),
      ]);

      final view = (await dao.readDashboard(now))!.driverLeaders.single;
      expect(view.points, 241.5);
      expect(view.wins, isNull, reason: 'an absent count never becomes zero');
    });

    test('constructor leaders follow the same rule', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await db.standingsDao
          .replaceConstructorStandings(2026, <ConstructorStanding>[
            const ConstructorStanding(
              season: 2026,
              constructorId: 'mclaren',
              position: 2,
              points: 999,
            ),
            const ConstructorStanding(
              season: 2026,
              constructorId: 'red-bull',
              position: 1,
              points: 402,
            ),
          ]);

      expect(
        (await dao.readDashboard(now))!.constructorLeaders.single.constructorId,
        'red-bull',
      );
    });

    test('another season\'s standings are never used', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await db.seasonDao.upsertSeason(
        Season(year: 2025, status: SeasonStatus.completed, isCurrent: false),
      );
      await db.standingsDao.replaceDriverStandings(2025, <DriverStanding>[
        const DriverStanding(
          season: 2025,
          driverId: 'old-champion',
          position: 1,
          points: 500,
        ),
      ]);
      expect((await dao.readDashboard(now))!.driverLeaders, isEmpty);
    });
  });

  group('cached race-result enrichment', () {
    Future<void> writeResult({
      required SessionType sessionType,
      required List<RaceResultEntry> entries,
      int round = 12,
    }) => db.resultsDao.writeRaceResult(
      RaceResult(
        id: '2026-r$round-${sessionType.wire}',
        season: 2026,
        round: round,
        grandPrixId: calendarFixture()
            .firstWhere((CalendarEntry e) => e.round == round)
            .grandPrix
            .id,
        sessionType: sessionType,
        status: ResultStatus.finalResult,
        entries: entries,
      ),
    );

    test('no cached result leaves the enrichment absent', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      final HomeDashboardView view = (await dao.readDashboard(now))!;
      expect(view.latestCompleted, isNotNull);
      expect(view.latestRaceResult, isNull);
    });

    test('the race classification is used for the latest event', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeResult(
        sessionType: SessionType.race,
        entries: const <RaceResultEntry>[
          RaceResultEntry(
            driverId: 'max-verstappen',
            constructorId: 'red-bull',
            position: 1,
            status: FinishStatus.finished,
          ),
        ],
      );

      final RaceResult result = (await dao.readDashboard(
        now,
      ))!.latestRaceResult!;
      expect(result.sessionType, SessionType.race);
      expect(result.round, 12);
    });

    test('a sprint classification is never used as the race result', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeResult(
        sessionType: SessionType.sprint,
        entries: const <RaceResultEntry>[
          RaceResultEntry(
            driverId: 'oscar-piastri',
            constructorId: 'mclaren',
            position: 1,
            status: FinishStatus.finished,
          ),
        ],
      );
      expect((await dao.readDashboard(now))!.latestRaceResult, isNull);
    });

    test('a result for another round is not attached', () async {
      await writeCalendar();
      await writeHomeSnapshot();
      await writeResult(
        round: 11,
        sessionType: SessionType.race,
        entries: const <RaceResultEntry>[
          RaceResultEntry(
            driverId: 'max-verstappen',
            constructorId: 'red-bull',
            position: 1,
            status: FinishStatus.finished,
          ),
        ],
      );
      expect((await dao.readDashboard(now))!.latestRaceResult, isNull);
    });
  });

  group('streaming', () {
    test('the dashboard re-emits after a standings commit', () async {
      await writeCalendar();
      await writeHomeSnapshot();

      final Stream<HomeDashboardView?> stream = dao.watchDashboard(() => now);
      final Future<List<HomeDashboardView?>> collected = stream
          .take(2)
          .toList();

      await Future<void>.delayed(const Duration(milliseconds: 20));
      await db.standingsDao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          position: 1,
          points: 241,
        ),
      ]);

      final List<HomeDashboardView?> emissions = await collected;
      expect(emissions.first!.driverLeaders, isEmpty);
      expect(emissions.last!.driverLeaders.single.driverId, 'max-verstappen');
    });
  });
}
