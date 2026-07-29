import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// Home is a long dashboard, so most assertions use a tall surface rather than
/// scrolling step by step; nothing about the assertions is relaxed. The narrow
/// and large-text cases below use a real phone surface on purpose.
const Size _tall = Size(400, 2400);
const Size _phone = Size(390, 844);
const Size _narrow = Size(320, 900);

/// The unresolved-identity marker the database stores for a referential stub. It
/// must never reach the screen.
const String _unresolvedMarker = '__unresolved__';

Future<void> pumpHome(
  WidgetTester tester, {
  HomeDashboardView? dashboard,
  Stream<HomeDashboardView?>? dashboardStream,
  Size surfaceSize = _tall,
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  bool mockData = false,
  DateTime? clock,
  int? currentSeason = 2026,
  ResourceSyncState? Function(String key)? syncMetadata,
  Stream<ResourceSyncState?> Function(String key)? syncMetadataStream,
  ManualCoreRefresh? onManualRefresh,
}) => pumpApp(
  tester,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  mockData: mockData,
  clock: clock,
  currentSeason: currentSeason,
  syncMetadata: syncMetadata,
  syncMetadataStream: syncMetadataStream,
  onManualRefresh: onManualRefresh,
  disableAnimations: true,
  repository: FakeRaceWeekendRepository(
    dashboard: dashboardStream == null
        ? (dashboard ?? homeDashboardFixture())
        : null,
    dashboardStream: dashboardStream,
    home: homeViewFixture(),
    calendar: (int season) => calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

/// Publishes an application-level synchronization report exactly as the real
/// coordinator does. Feature controllers mirror it; they never produce it.
void publishSync(
  WidgetTester tester, {
  List<ResourceSyncOutcome> outcomes = const <ResourceSyncOutcome>[],
  bool seasonContextUnavailable = false,
}) {
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        seasonContextUnavailable
            ? AppSyncSeasonContextUnavailable(
                trigger: SyncTrigger.manual,
                outcomes: outcomes,
              )
            : AppSyncCompleted(trigger: SyncTrigger.manual, outcomes: outcomes),
      );
}

ResourceSyncOutcome failed(String key, ApiFailureKind kind) =>
    ResourceSyncOutcome(
      resourceKey: key,
      kind: ResourceSyncOutcomeKind.failed,
      failure: kind,
    );

/// Every string rendered anywhere in the tree.
List<String> renderedText(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((Text t) => t.data ?? t.textSpan?.toPlainText() ?? '')
    .toList(growable: false);

/// Every semantic label in the tree.
List<String> semanticLabels(WidgetTester tester) => tester
    .widgetList<Semantics>(find.byType(Semantics))
    .map((Semantics s) => s.properties.label ?? '')
    .where((String s) => s.isNotEmpty)
    .toList(growable: false);

void main() {
  group('first-load and degraded states', () {
    testWidgets('a first load with no representation shows the skeleton', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboardStream: Stream<HomeDashboardView?>.fromFuture(
          Completer<HomeDashboardView?>().future,
        ),
      );

      expect(find.byType(GvSkeletonCard), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsNothing);
    });

    testWidgets('a first-load failure is recoverable and retry works', (
      WidgetTester tester,
    ) async {
      int refreshCalls = 0;
      await pumpHome(
        tester,
        dashboardStream: Stream<HomeDashboardView?>.value(null),
        onManualRefresh: () async => refreshCalls++,
      );
      // Building Home performs no request at all.
      expect(refreshCalls, 0);

      publishSync(
        tester,
        outcomes: <ResourceSyncOutcome>[
          failed('home:2026', ApiFailureKind.networkUnavailable),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text("Can't load Home"), findsOneWidget);
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(refreshCalls, 1);
    });

    testWidgets('an unresolvable season is reported explicitly', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        currentSeason: null,
        dashboardStream: Stream<HomeDashboardView?>.value(null),
      );
      publishSync(tester, seasonContextUnavailable: true);
      await tester.pumpAndSettle();

      expect(find.text('Season not available'), findsOneWidget);
    });

    testWidgets('a valid season-empty Home renders as empty, not loading', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          withFocus: false,
          withLatestCompleted: false,
          upcoming: const <CalendarEntry>[],
        ),
      );

      expect(find.text('Calendar not available'), findsOneWidget);
      expect(find.byType(GvSkeletonCard), findsNothing);
      expect(find.text('2026 season'), findsOneWidget);
      // The other destinations stay reachable from an empty season.
      expect(
        find.byKey(const ValueKey<String>('home-quick-drivers')),
        findsOne,
      );
    });
  });

  group('temporal states', () {
    testWidgets('pre-event leads with the next Grand Prix', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(find.text('Next Grand Prix'), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsWidgets);
      expect(find.text('Round 13'), findsWidgets);
    });

    testWidgets('a race weekend leads with the current Grand Prix', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(status: EventStatus.inProgress),
        ),
      );
      expect(find.text('Current Grand Prix'), findsOneWidget);
      expect(find.text('Race weekend'), findsOneWidget);
    });

    testWidgets('a live session is announced as live', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(
            status: EventStatus.inProgress,
            sessions: <Session>[
              Session(
                id: 'race',
                type: SessionType.race,
                name: 'Race',
                startTime: DateTime.utc(2026, 7, 18, 11),
                status: SessionStatus.live,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Current session'), findsOneWidget);
      expect(
        find.text('Live now'),
        findsNWidgets(2),
        reason: 'the hero and the session block both state it',
      );
    });

    testWidgets('post-race leads with the latest Grand Prix', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(status: EventStatus.completed),
        ),
      );
      expect(find.text('Latest Grand Prix'), findsOneWidget);
    });
  });

  group('hero', () {
    testWidgets('renders without an image, using a placeholder only', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(find.byType(GvImagePlaceholder), findsWidgets);
      expect(
        find.byType(Image),
        findsNothing,
        reason: 'Phase 7D never requests remote imagery',
      );
    });

    testWidgets('stays useful without a circuit', (WidgetTester tester) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(focus: homeFocusFixture(circuit: null)),
      );

      expect(find.text('Belgian Grand Prix'), findsWidgets);
      expect(find.text('View Grand Prix'), findsOneWidget);
      expect(
        renderedText(tester).join(' '),
        isNot(contains('spa-francorchamps')),
      );
    });

    testWidgets('shows a relative start alongside the explicit time', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      // The Belgian weekend opens 2026-07-24 10:30Z and the pinned clock is
      // 2026-07-18 12:10Z, so the label coarsens to whole days.
      expect(find.text('Starts in 5 days'), findsWidgets);
      // The explicit localized time is always present too, in the event's own
      // zone and with that zone stated.
      expect(find.textContaining('CEST'), findsWidgets);
      // …and the reader's own zone is stated as well (pinned by the harness).
      expect(find.text('Your time zone: UTC'), findsOneWidget);
    });
  });

  group('session timing', () {
    testWidgets('shows the next session and a bounded schedule window', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(find.text('Next session'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('home-session-focus')),
        findsOne,
      );
      // A compact subset — never the full five-session weekend.
      expect(find.byType(GvSessionRow), findsNWidgets(3));
    });

    testWidgets('a weekend with no sessions says so', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(sessions: const <Session>[]),
        ),
      );
      expect(find.text('Session times not available'), findsOneWidget);
    });

    testWidgets('a session with no start time shows no time at all', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(
            sessions: <Session>[
              const Session(
                id: 'race',
                type: SessionType.race,
                name: 'Race',
                status: SessionStatus.scheduled,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Race'), findsWidgets);
      expect(
        renderedText(tester).join(' '),
        isNot(contains('00:00')),
        reason: 'a missing time never becomes midnight',
      );
    });
  });

  group('championship leaders', () {
    testWidgets('a single confirmed leader shows name, team and points', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);

      expect(find.text("Drivers' Championship leader"), findsOneWidget);
      expect(find.text('Max Verstappen'), findsWidgets);
      expect(find.text('Red Bull Racing'), findsWidgets);
      expect(find.text('241 pts'), findsWidgets);
    });

    testWidgets('tied leaders are named as tied, never one winner', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: <DriverStandingEntry>[
            driverStandingEntry(
              driverId: 'max-verstappen',
              driverName: 'Max Verstappen',
              order: 0,
              position: 1,
              points: 241,
            ),
            driverStandingEntry(
              driverId: 'lando-norris',
              driverName: 'Lando Norris',
              order: 1,
              position: 1,
              points: 241,
            ),
          ],
        ),
      );

      expect(find.text('Tied leaders'), findsOneWidget);
      expect(
        find.text('Max Verstappen · Lando Norris'),
        findsOneWidget,
        reason: 'both names are summarised concisely',
      );
    });

    testWidgets('an unavailable table keeps the standings action', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: const <DriverStandingEntry>[],
        ),
        syncMetadata: unmaterialized(<String>{'standings:drivers:2026'}),
      );

      expect(find.text('Leader unavailable'), findsOneWidget);
      expect(find.text("View drivers' standings"), findsOneWidget);
    });

    testWidgets('a materialized table with no leader yet says so, and is not '
        'reported as missing information', (WidgetTester tester) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: const <DriverStandingEntry>[],
        ),
      );

      expect(find.text('No leader yet'), findsOneWidget);
      expect(find.text('Leader unavailable'), findsNothing);
      expect(find.text('Some information is unavailable'), findsNothing);
      expect(find.text("View drivers' standings"), findsOneWidget);
    });

    testWidgets('an unresolved identity never leaks an identifier', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: <DriverStandingEntry>[
            driverStandingEntry(
              driverId: 'max-verstappen',
              order: 0,
              position: 1,
              points: 241,
            ),
          ],
        ),
      );

      expect(find.text('No leader yet'), findsOneWidget);
      final String all = renderedText(tester).join(' ');
      expect(all, isNot(contains('max-verstappen')));
      expect(all, isNot(contains('Max-Verstappen')));
    });

    testWidgets('fractional points keep their locale separator', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        locale: const Locale('es'),
        dashboard: homeDashboardFixture(
          driverLeaders: <DriverStandingEntry>[
            driverStandingEntry(
              driverId: 'max-verstappen',
              driverName: 'Max Verstappen',
              order: 0,
              position: 1,
              points: 241.5,
            ),
          ],
        ),
      );
      expect(find.text('241,5 pts'), findsWidgets);
    });

    testWidgets('a confirmed zero renders as zero', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: <DriverStandingEntry>[
            driverStandingEntry(
              driverId: 'rookie',
              driverName: 'Rookie Driver',
              order: 0,
              position: 1,
              points: 0,
            ),
          ],
        ),
      );
      expect(find.text('0 pts'), findsWidgets);
    });

    testWidgets('the two championships render independently', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: const <DriverStandingEntry>[],
        ),
      );
      expect(find.text('No leader yet'), findsOneWidget);
      expect(find.text("Teams' Championship leader"), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsWidgets);
    });
  });

  group('latest completed Grand Prix', () {
    testWidgets('renders without a cached result', (WidgetTester tester) async {
      await pumpHome(tester);
      expect(find.text('Latest result'), findsOneWidget);
      expect(find.text('Italian Grand Prix'), findsWidgets);
      expect(find.text('Result unavailable'), findsOneWidget);
    });

    testWidgets('safe race-result enrichment names the winner', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          latestRaceResult: raceResultFixture(
            sessionType: SessionType.race,
            round: 12,
            entries: const <RaceResultEntry>[
              RaceResultEntry(
                driverId: 'lando-norris',
                constructorId: 'mclaren',
                driverName: 'Lando Norris',
                position: 2,
                status: FinishStatus.finished,
              ),
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
      );

      expect(find.text('Winner'), findsOneWidget);
      expect(find.text('Max Verstappen · Red Bull Racing'), findsOneWidget);
      expect(find.text('Final'), findsWidgets);
    });

    testWidgets('an unresolved winner shows localized copy, not an id', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          latestRaceResult: raceResultFixture(
            sessionType: SessionType.race,
            round: 12,
            entries: const <RaceResultEntry>[
              RaceResultEntry(
                driverId: 'max-verstappen',
                constructorId: 'red-bull',
                position: 1,
                status: FinishStatus.finished,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Winner unavailable'), findsOneWidget);
      expect(renderedText(tester).join(' '), isNot(contains('max-verstappen')));
    });

    testWidgets('a sprint classification never names the race winner', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          latestRaceResult: raceResultFixture(
            sessionType: SessionType.sprint,
            round: 12,
            entries: const <RaceResultEntry>[
              RaceResultEntry(
                driverId: 'oscar-piastri',
                constructorId: 'mclaren',
                driverName: 'Oscar Piastri',
                position: 1,
                status: FinishStatus.finished,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Winner'), findsNothing);
      expect(find.text('Oscar Piastri'), findsNothing);
      expect(find.text('Italian Grand Prix'), findsWidgets);
    });
  });

  group('upcoming events', () {
    testWidgets('renders chronologically and excludes the featured event', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);

      expect(find.text('Upcoming events'), findsOneWidget);
      final double hungarian = tester
          .getTopLeft(find.text('Hungarian Grand Prix'))
          .dy;
      final double dutch = tester.getTopLeft(find.text('Dutch Grand Prix')).dy;
      expect(hungarian, lessThan(dutch));
      // The Belgian GP is the hero; it never appears twice.
      expect(
        find.byKey(const ValueKey<String>('home-upcoming-2026-13')),
        findsNothing,
      );
    });

    testWidgets('no upcoming events shows a concise line, not an error', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(upcoming: const <CalendarEntry>[]),
      );
      expect(find.text('No upcoming events'), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsWidgets);
      expect(
        find.byType(GvOfflineNotice),
        findsNothing,
        reason: 'an available calendar with nothing left is not a data gap',
      );
    });
  });

  group('freshness and partial data', () {
    testWidgets('a bootstrap-only Home shows no updated time', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, syncMetadata: (String key) => null);
      expect(
        find.textContaining('Updated'),
        findsNothing,
        reason: 'no fabricated timestamp is published',
      );
    });

    testWidgets('a directly-synced Home shows its own updated time', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(find.textContaining('Updated'), findsOneWidget);
    });

    testWidgets('a stale section produces one safe aggregate notice', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        syncMetadata: (String key) => syncedMetadata(
          key,
          staleAfter: key == 'standings:drivers:2026'
              ? DateTime.utc(2026, 7, 18, 11)
              : null,
        ),
      );

      expect(find.text('Some information may be outdated'), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsWidgets);
    });

    testWidgets('a genuinely unavailable module shows one concise notice', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: const <DriverStandingEntry>[],
        ),
        syncMetadata: unmaterialized(<String>{'standings:drivers:2026'}),
      );
      expect(find.text('Some information is unavailable'), findsOneWidget);
      expect(find.byType(GvOfflineNotice), findsOneWidget);
    });

    testWidgets('the season finale is never reported as missing information', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(status: EventStatus.completed),
          upcoming: const <CalendarEntry>[],
        ),
      );

      expect(find.text('No upcoming events'), findsOneWidget);
      expect(find.text('Upcoming events unavailable'), findsNothing);
      expect(
        find.text('Some information is unavailable'),
        findsNothing,
        reason: 'a complete empty answer is not missing information',
      );
      expect(find.byType(GvOfflineNotice), findsNothing);
    });

    // While the materialization records are still being read, neither "nothing
    // here" nor "unavailable" is known, so Home asserts neither.
    group('unresolved materialization', () {
      /// Holds every metadata record unresolved until [emit] is called.
      ({
        Stream<ResourceSyncState?> Function(String key) streams,
        void Function(ResourceSyncState? Function(String key) value) emit,
      })
      pending() {
        final Map<String, StreamController<ResourceSyncState?>> controllers =
            <String, StreamController<ResourceSyncState?>>{};
        return (
          streams: (String key) => controllers
              .putIfAbsent(key, StreamController<ResourceSyncState?>.broadcast)
              .stream,
          emit: (ResourceSyncState? Function(String key) value) {
            for (final MapEntry<String, StreamController<ResourceSyncState?>> e
                in controllers.entries) {
              e.value.add(value(e.key));
            }
          },
        );
      }

      testWidgets('an empty upcoming module asserts nothing while its record '
          'is being read', (WidgetTester tester) async {
        await pumpHome(
          tester,
          dashboard: homeDashboardFixture(upcoming: const <CalendarEntry>[]),
          syncMetadataStream: pending().streams,
        );

        expect(
          find.byKey(const ValueKey<String>('home-upcoming-resolving')),
          findsOneWidget,
        );
        expect(find.text('No upcoming events'), findsNothing);
        expect(find.text('Upcoming events unavailable'), findsNothing);
        expect(find.text('Some information is unavailable'), findsNothing);
        expect(find.byType(GvOfflineNotice), findsNothing);
      });

      testWidgets('neither leader asserts anything while its table is being '
          'read', (WidgetTester tester) async {
        await pumpHome(
          tester,
          dashboard: homeDashboardFixture(
            driverLeaders: const <DriverStandingEntry>[],
            constructorLeaders: const <ConstructorStandingEntry>[],
          ),
          syncMetadataStream: pending().streams,
        );

        expect(
          find.byKey(const ValueKey<String>('home-driver-leader-resolving')),
          findsOneWidget,
        );
        expect(
          find.byKey(const ValueKey<String>('home-team-leader-resolving')),
          findsOneWidget,
        );
        expect(find.text('No leader yet'), findsNothing);
        expect(find.text('Leader unavailable'), findsNothing);
        expect(find.text('Some information is unavailable'), findsNothing);
      });

      testWidgets('stored content stays visible, without a freshness claim', (
        WidgetTester tester,
      ) async {
        await pumpHome(tester, syncMetadataStream: pending().streams);

        expect(find.text('Belgian Grand Prix'), findsWidgets);
        expect(
          find.text('Max Verstappen'),
          findsWidgets,
          reason: 'a stored leader keeps rendering while its record is read',
        );
        expect(find.text('Italian Grand Prix'), findsWidgets);
        expect(
          find.textContaining('Updated'),
          findsNothing,
          reason: 'no update time is claimed from an unread record',
        );
        expect(find.text('Some information may be outdated'), findsNothing);
        expect(find.byType(GvOfflineNotice), findsNothing);
      });

      testWidgets('resolving settles into the valid empty result', (
        WidgetTester tester,
      ) async {
        final ({
          Stream<ResourceSyncState?> Function(String key) streams,
          void Function(ResourceSyncState? Function(String key) value) emit,
        })
        records = pending();
        await pumpHome(
          tester,
          dashboard: homeDashboardFixture(
            focus: homeFocusFixture(status: EventStatus.completed),
            upcoming: const <CalendarEntry>[],
          ),
          syncMetadataStream: records.streams,
        );
        expect(find.text('No upcoming events'), findsNothing);

        records.emit((String key) => syncedMetadata(key));
        await tester.pumpAndSettle();

        expect(find.text('No upcoming events'), findsOneWidget);
        expect(find.text('Upcoming events unavailable'), findsNothing);
        expect(find.byType(GvOfflineNotice), findsNothing);
      });

      testWidgets('resolving settles into unavailable', (
        WidgetTester tester,
      ) async {
        final ({
          Stream<ResourceSyncState?> Function(String key) streams,
          void Function(ResourceSyncState? Function(String key) value) emit,
        })
        records = pending();
        await pumpHome(
          tester,
          dashboard: homeDashboardFixture(upcoming: const <CalendarEntry>[]),
          syncMetadataStream: records.streams,
        );
        expect(find.text('Upcoming events unavailable'), findsNothing);
        expect(find.byType(GvOfflineNotice), findsNothing);

        records.emit(unmaterialized(<String>{'calendar:2026'}));
        await tester.pumpAndSettle();

        expect(find.text('Upcoming events unavailable'), findsOneWidget);
        expect(find.text('Some information is unavailable'), findsOneWidget);
      });

      testWidgets('resolving settles into available content', (
        WidgetTester tester,
      ) async {
        final ({
          Stream<ResourceSyncState?> Function(String key) streams,
          void Function(ResourceSyncState? Function(String key) value) emit,
        })
        records = pending();
        int refreshes = 0;
        await pumpHome(
          tester,
          syncMetadataStream: records.streams,
          onManualRefresh: () async => refreshes++,
        );
        expect(find.text('Dutch Grand Prix'), findsWidgets);

        records.emit((String key) => syncedMetadata(key));
        await tester.pumpAndSettle();

        expect(find.text('Dutch Grand Prix'), findsWidgets);
        expect(
          refreshes,
          0,
          reason: 'resolving metadata triggers no refresh of any kind',
        );
      });
    });

    testWidgets('an unmaterialized calendar reports upcoming as unavailable', (
      WidgetTester tester,
    ) async {
      await pumpHome(
        tester,
        dashboard: homeDashboardFixture(upcoming: const <CalendarEntry>[]),
        syncMetadata: unmaterialized(<String>{'calendar:2026'}),
      );

      expect(find.text('Upcoming events unavailable'), findsOneWidget);
      expect(find.text('Some information is unavailable'), findsOneWidget);
      expect(
        find.text('Belgian Grand Prix'),
        findsWidgets,
        reason: 'the rest of the dashboard still renders',
      );
    });
  });

  group('manual refresh', () {
    testWidgets('the app-bar action runs the core refresh once', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      await pumpHome(tester, onManualRefresh: () async => calls++);
      expect(calls, 0, reason: 'building Home produces no request');

      await tester.tap(find.byKey(const ValueKey<String>('home-refresh')));
      await tester.pumpAndSettle();
      expect(calls, 1);
    });

    testWidgets('pull-to-refresh runs the core refresh once', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      await pumpHome(
        tester,
        surfaceSize: _phone,
        onManualRefresh: () async => calls++,
      );
      expect(calls, 0);

      await tester.fling(find.byType(HomeScreen), const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(calls, 1);
    });

    testWidgets('cached cards stay visible during a refresh', (
      WidgetTester tester,
    ) async {
      final Completer<void> pending = Completer<void>();
      await pumpHome(tester, onManualRefresh: () => pending.future);

      await tester.tap(find.byKey(const ValueKey<String>('home-refresh')));
      await tester.pump();

      expect(find.text('Belgian Grand Prix'), findsWidgets);
      expect(find.text('Max Verstappen'), findsWidgets);
      pending.complete();
      await tester.pumpAndSettle();
    });
  });

  group('environment', () {
    testWidgets('the mock-data banner appears only in fixture mode', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, mockData: true);
      expect(find.byType(MockDataBanner), findsOneWidget);
    });

    testWidgets('remote mode shows no Sample data banner', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(find.byType(MockDataBanner), findsNothing);
      expect(find.textContaining('Sample data'), findsNothing);
    });
  });

  group('localization', () {
    testWidgets('Spanish renders the dashboard copy', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, locale: const Locale('es'));

      expect(find.text('Próximo Gran Premio'), findsOneWidget);
      expect(find.text('Líder del Campeonato de Pilotos'), findsOneWidget);
      expect(
        find.text('Líder del Campeonato de Constructores'),
        findsOneWidget,
      );
      expect(find.text('Próximos eventos'), findsOneWidget);
      expect(find.text('Temporada 2026'), findsOneWidget);
      // Proper names are never translated.
      expect(find.text('Belgian Grand Prix'), findsWidgets);
    });

    testWidgets('long Spanish copy stays within the layout', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, locale: const Locale('es'), surfaceSize: _phone);
      expect(tester.takeException(), isNull);
    });
  });

  group('accessibility and responsiveness', () {
    testWidgets('the event name is a semantic heading', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      final Iterable<Semantics> headings = tester
          .widgetList<Semantics>(find.byType(Semantics))
          .where((Semantics s) => s.properties.header ?? false);
      expect(headings, isNotEmpty);
    });

    testWidgets('the session block announces name, time and status', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(
        semanticLabels(tester).any(
          (String l) =>
              l.contains('Next session') &&
              l.contains('Practice 1') &&
              l.contains('Scheduled'),
        ),
        isTrue,
      );
    });

    testWidgets('the driver leader announces championship, name and points', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      expect(
        semanticLabels(tester).any(
          (String l) =>
              l.contains("Drivers' Championship leader") &&
              l.contains('Max Verstappen') &&
              l.contains('241 points'),
        ),
        isTrue,
      );
    });

    testWidgets('interactive targets are at least 48 logical pixels', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, surfaceSize: _phone);
      for (final Element element
          in find
              .byWidgetPredicate((Widget w) => w is GvIconButton)
              .evaluate()) {
        expect(tester.getSize(find.byWidget(element.widget)).height, 48.0);
      }
    });

    testWidgets('the dashboard survives 200% text on a narrow phone', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, surfaceSize: _narrow, textScale: 2.0);
      expect(tester.takeException(), isNull);
      expect(find.text('Belgian Grand Prix'), findsWidgets);
    });

    testWidgets('there is exactly one primary vertical scrollable', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester, surfaceSize: _phone);
      final Finder scrollables = find.descendant(
        of: find.byType(HomeScreen),
        matching: find.byType(Scrollable),
      );
      expect(scrollables, findsOneWidget);
    });
  });

  group('no technical values reach the screen', () {
    testWidgets('no identifier, humanised identifier or marker is shown', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      final String all =
          '${renderedText(tester).join(' ')} ${semanticLabels(tester).join(' ')}';

      for (final String forbidden in <String>[
        _unresolvedMarker,
        'spa-francorchamps',
        'max-verstappen',
        'red-bull',
        '2026-belgian-grand-prix',
        'Spa Francorchamps',
        'Belgian Grand Prix 2026',
      ]) {
        expect(all, isNot(contains(forbidden)), reason: forbidden);
      }
    });

    testWidgets('no placeholder-catalogue copy is shown', (
      WidgetTester tester,
    ) async {
      await pumpHome(tester);
      final String all = renderedText(tester).join(' ');
      expect(all, isNot(contains('More coming soon')));
      expect(all, isNot(contains('Preview layout')));
      expect(all, isNot(contains('Profile placeholder')));
    });
  });
}
