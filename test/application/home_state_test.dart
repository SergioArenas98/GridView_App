import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/home/domain/home_leader.dart';
import 'package:gridview/features/home/domain/home_session_focus.dart';
import 'package:gridview/features/home/domain/home_temporal_state.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

const ApiFailure _offline = ApiFailure(kind: ApiFailureKind.networkUnavailable);

void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12, 10);

  HomeState compute({
    int? season = 2026,
    bool seasonReady = true,
    HomeDashboardView? dashboard,
    bool dashboardReady = true,
    ResourceSyncState? homeMetadata,
    ResourceSyncState? calendarMetadata,
    ResourceSyncState? driverStandingsMetadata,
    ResourceSyncState? constructorStandingsMetadata,
    ResourceSyncState? resultMetadata,
    bool refreshing = false,
    ApiFailure? lastFailure,
    bool driverStandingsFailed = false,
    bool constructorStandingsFailed = false,
    bool syncSettled = true,
  }) => computeHomeState(
    HomeStateInputs(
      season: season,
      seasonReady: seasonReady,
      dashboard: dashboard,
      dashboardReady: dashboardReady,
      homeMetadata: homeMetadata,
      calendarMetadata: calendarMetadata,
      driverStandingsMetadata: driverStandingsMetadata,
      constructorStandingsMetadata: constructorStandingsMetadata,
      resultMetadata: resultMetadata,
      refreshing: refreshing,
      lastFailure: lastFailure,
      driverStandingsFailed: driverStandingsFailed,
      constructorStandingsFailed: constructorStandingsFailed,
      syncSettled: syncSettled,
      now: now,
    ),
  );

  ResourceSyncState synced({DateTime? staleAfter}) =>
      syncedMetadata('home:2026', staleAfter: staleAfter);

  group('first load', () {
    test('no dashboard emission yet is loading', () {
      expect(compute(dashboardReady: false), isA<HomeLoading>());
    });

    test('a running first refresh is loading, never an error', () {
      expect(
        compute(refreshing: true, lastFailure: _offline),
        isA<HomeLoading>(),
      );
    });

    test('no representation plus a failure is a first-load error', () {
      final HomeState state = compute(lastFailure: _offline);
      expect(state, isA<HomeFirstLoadError>());
      expect(
        (state as HomeFirstLoadError).failure.kind,
        ApiFailureKind.networkUnavailable,
      );
    });

    test('no representation and no failure stays loading', () {
      expect(compute(), isA<HomeLoading>());
    });
  });

  group('season context', () {
    test('an unresolved season while the run is still going is loading', () {
      expect(compute(season: null, syncSettled: false), isA<HomeLoading>());
    });

    test('an unresolved season before the stream emits is loading', () {
      expect(compute(season: null, seasonReady: false), isA<HomeLoading>());
    });

    test('an unresolved season after a settled run is reported explicitly', () {
      expect(compute(season: null), isA<HomeSeasonContextUnavailable>());
    });

    test("a dashboard for another season is not this season's Home", () {
      expect(
        compute(dashboard: homeDashboardFixture(seasonYear: 2025)),
        isA<HomeLoading>(),
        reason: 'an old season Home is never rendered as the new one',
      );
    });
  });

  group('season-empty', () {
    test('a materialized Home with no focus is empty, not loading', () {
      final HomeState state = compute(
        dashboard: homeDashboardFixture(
          withFocus: false,
          withLatestCompleted: false,
          upcoming: const <CalendarEntry>[],
        ),
        homeMetadata: synced(),
      );
      expect(state, isA<HomeSeasonEmpty>());
      expect((state as HomeSeasonEmpty).seasonYear, 2026);
    });

    test('an empty Home keeps its own provenance and stays refreshable', () {
      final HomeSeasonEmpty state =
          compute(
                dashboard: homeDashboardFixture(withFocus: false),
                homeMetadata: synced(),
                refreshing: true,
              )
              as HomeSeasonEmpty;
      expect(state.refreshing, isTrue);
      expect(state.provenance.lastSuccessAt, isNotNull);
    });
  });

  group('ready', () {
    HomeReady ready({
      HomeDashboardView? dashboard,
      ResourceSyncState? homeMetadata,
      bool refreshing = false,
      ApiFailure? lastFailure,
    }) =>
        compute(
              dashboard: dashboard ?? homeDashboardFixture(),
              homeMetadata: homeMetadata ?? synced(),
              refreshing: refreshing,
              lastFailure: lastFailure,
            )
            as HomeReady;

    test('a healthy dashboard is ready and pre-event', () {
      final HomeReady state = ready();
      expect(state.phase, HomeTemporalPhase.preEvent);
      expect(state.event.round, 13);
      expect(state.latestResult, isNotNull);
      expect(state.upcoming, isNotNull);
    });

    test('an in-progress focus is a race weekend', () {
      expect(
        ready(
          dashboard: homeDashboardFixture(
            focus: homeFocusFixture(status: EventStatus.inProgress),
          ),
        ).phase,
        HomeTemporalPhase.raceWeekend,
      );
    });

    test('a completed focus is post-race', () {
      expect(
        ready(
          dashboard: homeDashboardFixture(
            focus: homeFocusFixture(status: EventStatus.completed),
          ),
        ).phase,
        HomeTemporalPhase.postRace,
      );
    });

    test('the session focus and window come from the delivered order', () {
      final HomeReady state = ready();
      expect(
        state.event.sessionFocus!.session.id,
        '2026-belgian-grand-prix-practice-1',
        reason: 'the earliest still-future session of the weekend',
      );
      expect(state.event.sessionFocus!.relevance, HomeSessionRelevance.next);
      expect(state.event.scheduleWindow.length, 3);
    });

    test('a weekend with no sessions has no session focus', () {
      final HomeReady state = ready(
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(sessions: const []),
        ),
      );
      expect(state.event.sessionFocus, isNull);
      expect(state.event.scheduleWindow, isEmpty);
      expect(state.event.hasSessions, isFalse);
    });

    test('cached content survives a refresh and a refresh failure', () {
      expect(ready(refreshing: true).refreshing, isTrue);
      expect(ready(refreshing: true).refreshError, isNull);
      expect(ready(lastFailure: _offline).refreshError?.kind, _offline.kind);
      expect(
        ready(lastFailure: _offline).event.focus.grandPrix.name,
        'Belgian Grand Prix',
      );
    });
  });

  group('leader modules', () {
    HomeReady readyWith({
      List<DriverStandingEntry>? driverLeaders,
      List<ConstructorStandingEntry>? constructorLeaders,
      bool driverStandingsFailed = false,
    }) =>
        compute(
              dashboard: homeDashboardFixture(
                driverLeaders: driverLeaders,
                constructorLeaders: constructorLeaders,
              ),
              homeMetadata: synced(),
              driverStandingsFailed: driverStandingsFailed,
            )
            as HomeReady;

    test('a confirmed leader is resolved for each championship', () {
      final HomeReady state = readyWith();
      expect(state.driverLeader!.leader, isA<HomeSingleLeader>());
      expect(state.teamLeader!.leader, isA<HomeSingleLeader>());
    });

    test('no confirmed leader is unavailable, not a page error', () {
      final HomeReady state = readyWith(
        driverLeaders: const <DriverStandingEntry>[],
      );
      expect(state.driverLeader!.leader, isA<HomeLeaderUnavailable>());
      expect(state.driverLeader!.isAvailable, isFalse);
      expect(
        state.teamLeader!.leader,
        isA<HomeSingleLeader>(),
        reason: 'the two championships are independent',
      );
    });

    test('one championship failing never marks the other failed', () {
      final HomeReady state = readyWith(driverStandingsFailed: true);
      expect(state.driverLeader!.failed, isTrue);
      expect(state.teamLeader!.failed, isFalse);
      expect(
        state.event.focus.grandPrix.name,
        'Belgian Grand Prix',
        reason: 'a standings failure never removes the event hero',
      );
    });

    test('a tie is preserved', () {
      final HomeReady state = readyWith(
        driverLeaders: <DriverStandingEntry>[
          driverStandingEntry(
            driverId: 'a',
            driverName: 'A',
            order: 0,
            position: 1,
            points: 100,
          ),
          driverStandingEntry(
            driverId: 'b',
            driverName: 'B',
            order: 1,
            position: 1,
            points: 100,
          ),
        ],
      );
      expect(state.driverLeader!.leader, isA<HomeTiedLeaders>());
    });
  });

  group('latest result module', () {
    test('a missing cached result keeps the event summary usable', () {
      final HomeReady state =
          compute(dashboard: homeDashboardFixture(), homeMetadata: synced())
              as HomeReady;
      expect(state.latestResult!.event.round, 12);
      expect(state.latestResult!.winner, isNull);
      expect(state.latestResult!.resultStatus, isNull);
    });

    test('a cached race result adds a winner and its own status', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  latestRaceResult: raceResultFixture(
                    sessionType: SessionType.race,
                    round: 12,
                    entries: const <RaceResultEntry>[
                      RaceResultEntry(
                        driverId: 'max-verstappen',
                        constructorId: 'red-bull',
                        driverName: 'Max Verstappen',
                        constructorName: 'Red Bull Racing',
                        position: 1,
                        status: FinishStatus.finished,
                      ),
                    ],
                  ),
                ),
                homeMetadata: synced(),
              )
              as HomeReady;
      expect(state.latestResult!.winner!.name, 'Max Verstappen');
      expect(state.latestResult!.resultStatus, ResultStatus.finalResult);
    });

    test('no completed event simply omits the module', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(withLatestCompleted: false),
                homeMetadata: synced(),
              )
              as HomeReady;
      expect(state.latestResult, isNull);
      expect(state.event.focus.grandPrix.name, 'Belgian Grand Prix');
    });
  });

  group('section provenance', () {
    test("each module carries its own resource's freshness", () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata(
                  'calendar:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
                ),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                ),
              )
              as HomeReady;

      expect(state.homeProvenance.freshness, FreshnessState.fresh);
      expect(state.upcoming!.provenance.freshness, FreshnessState.stale);
      expect(state.driverLeader!.provenance.freshness, FreshnessState.fresh);
      expect(
        state.teamLeader!.provenance.freshness,
        isNull,
        reason: 'a resource with no record of its own claims neither state',
      );
    });

    test('a bootstrap-only Home has no individual freshness or timestamp', () {
      final HomeReady state =
          compute(dashboard: homeDashboardFixture(), homeMetadata: null)
              as HomeReady;
      expect(state.homeProvenance.freshness, isNull);
      expect(
        state.homeProvenance.lastSuccessAt,
        isNull,
        reason: 'no fabricated update time is published',
      );
    });

    test("a calendar-fallback focus carries the calendar's provenance", () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  focus: homeFocusFixture(
                    source: HomeFocusSource.calendarFallback,
                  ),
                ),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata(
                  'calendar:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
                ),
              )
              as HomeReady;
      expect(state.event.provenance.freshness, FreshnessState.stale);
      expect(
        state.homeProvenance.freshness,
        FreshnessState.fresh,
        reason: 'the Home resource itself is still fresh',
      );
    });

    test('one stale section does not make the whole screen stale', () {
      final HomeReady fresh =
          compute(
                dashboard: homeDashboardFixture(),
                homeMetadata: synced(),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                ),
              )
              as HomeReady;
      expect(fresh.hasStaleSection, isFalse);

      final HomeReady partlyStale =
          compute(
                dashboard: homeDashboardFixture(),
                homeMetadata: synced(),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
                ),
              )
              as HomeReady;
      expect(partlyStale.hasStaleSection, isTrue);
      expect(
        partlyStale.homeProvenance.isStale,
        isFalse,
        reason: 'the Home resource keeps its own fresh state',
      );
    });

    test('a cached classification carries the result resource, not the '
        'calendar', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  latestRaceResult: raceResultFixture(
                    sessionType: SessionType.race,
                    round: 12,
                    entries: const <RaceResultEntry>[
                      RaceResultEntry(
                        driverId: 'max-verstappen',
                        constructorId: 'red-bull',
                        driverName: 'Max Verstappen',
                        constructorName: 'Red Bull Racing',
                        position: 1,
                        status: FinishStatus.finished,
                      ),
                    ],
                  ),
                ),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata('calendar:2026'),
                resultMetadata: syncedMetadata(
                  'grand-prix-results:2026:12',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
                ),
              )
              as HomeReady;

      expect(state.latestResult!.resultProvenance!.isStale, isTrue);
      expect(
        state.latestResult!.provenance.isStale,
        isFalse,
        reason: 'the event summary keeps the calendar\'s own fresh state',
      );
      expect(
        state.hasStaleSection,
        isTrue,
        reason: 'the stale classification is reported as aggregate uncertainty',
      );
    });

    test('an event with no cached classification represents no result '
        'resource', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata('calendar:2026'),
                resultMetadata: syncedMetadata(
                  'grand-prix-results:2026:12',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
                ),
              )
              as HomeReady;

      expect(state.latestResult!.resultProvenance, isNull);
      expect(
        state.hasStaleSection,
        isFalse,
        reason: 'an absent classification is never a stale one',
      );
    });
  });

  group('partial data', () {
    test('an unavailable leader marks the dashboard partial', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  driverLeaders: const <DriverStandingEntry>[],
                ),
                homeMetadata: synced(),
              )
              as HomeReady;
      expect(state.isPartial, isTrue);
    });

    test('a complete dashboard is not partial', () {
      final HomeReady state =
          compute(dashboard: homeDashboardFixture(), homeMetadata: synced())
              as HomeReady;
      expect(state.isPartial, isFalse);
    });

    test('no upcoming events marks the dashboard partial', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  upcoming: const <CalendarEntry>[],
                ),
                homeMetadata: synced(),
              )
              as HomeReady;
      expect(state.upcoming, isNull);
      expect(state.isPartial, isTrue);
    });
  });
}
