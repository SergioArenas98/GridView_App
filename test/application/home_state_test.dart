import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/home/domain/home_leader.dart';
import 'package:gridview/features/home/domain/home_module_availability.dart';
import 'package:gridview/features/home/domain/home_session_focus.dart';
import 'package:gridview/features/home/domain/home_temporal_state.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
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
    // Most tests describe a launched app whose collections an accepted
    // bootstrap already materialized; the ones about unavailability turn it off
    // explicitly.
    bool bootstrapMaterialized = true,
    int bootstrapSeason = 2026,
    bool metadataReady = true,
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
      bootstrapMetadata: bootstrapMaterialized
          ? syncedMetadata(ResourceKey.bootstrap(), season: bootstrapSeason)
          : null,
      metadataReady: metadataReady,
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
      expect(state.driverLeader.leader, isA<HomeSingleLeader>());
      expect(state.teamLeader.leader, isA<HomeSingleLeader>());
    });

    test('no confirmed leader is unavailable, not a page error', () {
      final HomeReady state = readyWith(
        driverLeaders: const <DriverStandingEntry>[],
      );
      expect(state.driverLeader.leader, isA<HomeLeaderUnavailable>());
      expect(state.driverLeader.hasLeader, isFalse);
      expect(
        state.teamLeader.leader,
        isA<HomeSingleLeader>(),
        reason: 'the two championships are independent',
      );
    });

    test('one championship failing never marks the other failed', () {
      final HomeReady state = readyWith(driverStandingsFailed: true);
      expect(state.driverLeader.failed, isTrue);
      expect(state.teamLeader.failed, isFalse);
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
      expect(state.driverLeader.leader, isA<HomeTiedLeaders>());
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
      expect(state.upcoming.provenance.freshness, FreshnessState.stale);
      expect(state.driverLeader.provenance.freshness, FreshnessState.fresh);
      expect(
        state.teamLeader.provenance.freshness,
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

  // Availability answers "can this module answer at all"; cardinality answers
  // "what did it answer". Conflating them makes Home claim information is
  // missing whenever a complete answer is legitimately empty.
  group('module availability is independent from cardinality', () {
    HomeReady upcomingState({
      List<CalendarEntry>? upcoming,
      ResourceSyncState? calendarMetadata,
      bool bootstrapMaterialized = true,
      int bootstrapSeason = 2026,
      bool metadataReady = true,
    }) =>
        compute(
              dashboard: homeDashboardFixture(
                focus: homeFocusFixture(status: EventStatus.completed),
                upcoming: upcoming ?? const <CalendarEntry>[],
              ),
              homeMetadata: synced(),
              calendarMetadata: calendarMetadata,
              driverStandingsMetadata: syncedMetadata('standings:drivers:2026'),
              constructorStandingsMetadata: syncedMetadata(
                'standings:constructors:2026',
              ),
              bootstrapMaterialized: bootstrapMaterialized,
              bootstrapSeason: bootstrapSeason,
              metadataReady: metadataReady,
            )
            as HomeReady;

    test('the season finale with a materialized calendar is a valid empty '
        'result, not partial', () {
      final HomeReady state = upcomingState(
        calendarMetadata: syncedMetadata('calendar:2026'),
      );

      expect(
        state.upcoming.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.upcoming.events, isEmpty);
      expect(state.phase, HomeTemporalPhase.postRace);
      expect(
        state.isPartial,
        isFalse,
        reason: 'no races left is the complete answer, not missing information',
      );
    });

    test('a same-season bootstrap materializes the calendar without '
        'fabricating its metadata', () {
      final HomeReady state = upcomingState();

      expect(
        state.upcoming.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.isPartial, isFalse);
      expect(
        state.upcoming.provenance.lastSuccessAt,
        isNull,
        reason: 'bootstrap materializes content but lends no provenance',
      );
      expect(state.upcoming.provenance.freshness, isNull);
    });

    test('a bootstrap for another season materializes nothing here', () {
      final HomeReady state = upcomingState(bootstrapSeason: 2025);

      expect(state.upcoming.availability, HomeModuleAvailability.unavailable);
      expect(state.isPartial, isTrue);
    });

    test('an unmaterialized calendar makes upcoming unavailable and Home '
        'partial', () {
      final HomeReady state = upcomingState(bootstrapMaterialized: false);

      expect(state.upcoming.availability, HomeModuleAvailability.unavailable);
      expect(
        state.isPartial,
        isTrue,
        reason: 'the rest of the dashboard still renders',
      );
      expect(state.event.focus.grandPrix.name, 'Belgian Grand Prix');
    });

    test('metadata that has not been read yet never claims unavailable', () {
      final HomeReady state = upcomingState(
        bootstrapMaterialized: false,
        metadataReady: false,
      );

      expect(
        state.upcoming.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.isPartial, isFalse);
    });

    test('a materialized calendar with one upcoming event is available', () {
      final HomeReady state = upcomingState(
        upcoming: calendarFixture(
          season: 2026,
        ).where((CalendarEntry e) => e.round == 14).toList(growable: false),
        calendarMetadata: syncedMetadata('calendar:2026'),
      );

      expect(state.upcoming.availability, HomeModuleAvailability.available);
      expect(state.upcoming.events, hasLength(1));
      expect(state.isPartial, isFalse);
    });

    test('a stale materialized calendar with no future events is stale, not '
        'partial', () {
      final HomeReady state = upcomingState(
        calendarMetadata: syncedMetadata(
          'calendar:2026',
          staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
        ),
      );

      expect(
        state.upcoming.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.upcoming.provenance.isStale, isTrue);
      expect(state.hasStaleSection, isTrue);
      expect(state.isPartial, isFalse);
    });

    test('a calendar refresh failure over cached data keeps the valid empty '
        'result', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  focus: homeFocusFixture(status: EventStatus.completed),
                  upcoming: const <CalendarEntry>[],
                ),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata('calendar:2026'),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                ),
                constructorStandingsMetadata: syncedMetadata(
                  'standings:constructors:2026',
                ),
                driverStandingsFailed: true,
              )
              as HomeReady;

      expect(
        state.upcoming.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.driverLeader.failed, isTrue);
      expect(
        state.driverLeader.availability,
        HomeModuleAvailability.available,
        reason: 'a failed refresh over cached rows is not unavailability',
      );
      expect(state.isPartial, isFalse);
      expect(state.event.focus.grandPrix.name, 'Belgian Grand Prix');
    });

    test('a single confirmed leader is available, and so is a tie', () {
      final HomeReady single =
          compute(dashboard: homeDashboardFixture(), homeMetadata: synced())
              as HomeReady;
      expect(
        single.driverLeader.availability,
        HomeModuleAvailability.available,
      );
      expect(single.isPartial, isFalse);

      final HomeReady tied =
          compute(
                dashboard: homeDashboardFixture(
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
                ),
                homeMetadata: synced(),
              )
              as HomeReady;
      expect(tied.driverLeader.leader, isA<HomeTiedLeaders>());
      expect(tied.driverLeader.availability, HomeModuleAvailability.available);
      expect(tied.isPartial, isFalse);
    });

    test('a materialized table that names no leader yet is not partial', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  driverLeaders: const <DriverStandingEntry>[],
                ),
                homeMetadata: synced(),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                ),
              )
              as HomeReady;

      expect(state.driverLeader.leader, isA<HomeLeaderUnavailable>());
      expect(
        state.driverLeader.availability,
        HomeModuleAvailability.availableEmpty,
      );
      expect(state.isPartial, isFalse);
    });

    test('an unmaterialized standings table still makes Home partial', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(
                  driverLeaders: const <DriverStandingEntry>[],
                ),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata('calendar:2026'),
                constructorStandingsMetadata: syncedMetadata(
                  'standings:constructors:2026',
                ),
                bootstrapMaterialized: false,
              )
              as HomeReady;

      expect(
        state.driverLeader.availability,
        HomeModuleAvailability.unavailable,
      );
      expect(
        state.teamLeader.availability,
        HomeModuleAvailability.available,
        reason: 'the two championships stay independent',
      );
      expect(state.isPartial, isTrue);
    });

    test('an absent cached classification is never partial', () {
      final HomeReady state =
          compute(
                dashboard: homeDashboardFixture(),
                homeMetadata: synced(),
                calendarMetadata: syncedMetadata('calendar:2026'),
                driverStandingsMetadata: syncedMetadata(
                  'standings:drivers:2026',
                ),
                constructorStandingsMetadata: syncedMetadata(
                  'standings:constructors:2026',
                ),
              )
              as HomeReady;

      expect(state.latestResult!.winner, isNull);
      expect(state.isPartial, isFalse);
    });

    test('a season with no events at all stays season-empty, never a partial '
        'ready state', () {
      final HomeState state = compute(
        dashboard: homeDashboardFixture(
          withFocus: false,
          withLatestCompleted: false,
          upcoming: const <CalendarEntry>[],
        ),
        homeMetadata: synced(),
        bootstrapMaterialized: false,
      );

      expect(state, isA<HomeSeasonEmpty>());
    });
  });
}
