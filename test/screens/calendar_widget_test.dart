import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_event_card.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// A full 24-round season so the relevant event (round 13) is genuinely below
/// the fold and the one-time positioning is observable.
List<CalendarEntry> _fullSeason() => <CalendarEntry>[
  for (int round = 1; round <= 24; round++)
    calendarEntry(
      round: round,
      name: 'Round $round Grand Prix',
      startDate: _startDate(round),
      endDate: _endDate(round),
      status: round < 12
          ? EventStatus.completed
          : (round == 12 ? EventStatus.completed : EventStatus.scheduled),
      circuit: Circuit(
        id: 'circuit-$round',
        name: 'Circuit $round',
        locality: 'Town $round',
        country: 'Country $round',
      ),
    ),
];

String _startDate(int round) {
  final DateTime day = DateTime.utc(2026, 3, 6).add(Duration(days: 14 * round));
  return '${day.year}-${_p(day.month)}-${_p(day.day)}';
}

String _endDate(int round) {
  final DateTime day = DateTime.utc(2026, 3, 8).add(Duration(days: 14 * round));
  return '${day.year}-${_p(day.month)}-${_p(day.day)}';
}

String _p(int v) => v.toString().padLeft(2, '0');

/// The clock that makes round 13 the next event of [_fullSeason].
final DateTime _clock = DateTime.utc(2026, 8, 20, 12);

/// A surface tall enough for the whole five-event fixture calendar, so
/// content assertions never depend on where the one-time anchor scrolled to.
const Size _listSurface = Size(400, 1200);

/// Publishes a finished application run whose calendar outcome is [kind].
void _publishCalendarOutcome(
  WidgetTester tester, {
  ApiFailureKind? failure,
  int season = 2026,
}) {
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        AppSyncCompleted(
          trigger: SyncTrigger.manual,
          outcomes: <ResourceSyncOutcome>[
            ResourceSyncOutcome(
              resourceKey: 'calendar:$season',
              kind: failure == null
                  ? ResourceSyncOutcomeKind.applied
                  : ResourceSyncOutcomeKind.failed,
              failure: failure,
            ),
          ],
        ),
      );
}

void main() {
  group('Calendar states', () {
    testWidgets('shows a skeleton while nothing is cached yet', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendarStream: (int season) =>
            const Stream<List<CalendarEntry>>.empty(),
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        disableAnimations: true,
      );

      expect(find.byType(GvSkeletonBlock), findsWidgets);
      expect(find.byType(CalendarEventCard), findsNothing);
    });

    testWidgets('a valid empty calendar is a real empty state, not a loader', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => const <CalendarEntry>[],
      );
      await pumpApp(tester, initialLocation: '/calendar', repository: repo);

      expect(find.text('No races scheduled yet'), findsOneWidget);
      expect(find.byType(GvSkeletonBlock), findsNothing);
      expect(find.byType(GvErrorState), findsNothing);
    });

    testWidgets('a first-load failure offers a retry that refreshes', (
      WidgetTester tester,
    ) async {
      int refreshes = 0;
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => const <CalendarEntry>[],
        onRefreshCalendar: (int season) async {
          refreshes++;
          return const RefreshSuccess();
        },
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        // Nothing has ever synchronised successfully.
        syncMetadata: (String key) => null,
        disableAnimations: true,
      );
      _publishCalendarOutcome(
        tester,
        failure: ApiFailureKind.networkUnavailable,
      );
      await tester.pumpAndSettle();

      expect(find.text("Can't load the calendar"), findsOneWidget);
      expect(find.text('You appear to be offline.'), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(refreshes, greaterThan(0));
    });

    testWidgets('an unresolvable season is a controlled recoverable state', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        currentSeason: null,
        syncMetadata: (String key) => null,
        disableAnimations: true,
      );
      containerOf(tester)
          .read(appSyncStateProvider.notifier)
          .publish(
            const AppSyncSeasonContextUnavailable(
              trigger: SyncTrigger.startup,
              outcomes: <ResourceSyncOutcome>[],
            ),
          );
      await tester.pumpAndSettle();

      expect(find.text('Season not available yet'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('Calendar list', () {
    testWidgets('renders the season events in their persisted order', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _listSurface,
      );

      expect(find.text('2026 season'), findsOneWidget);
      expect(find.text('British Grand Prix'), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
      double dyOf(String name) => tester.getTopLeft(find.text(name)).dy;
      expect(dyOf('British Grand Prix'), lessThan(dyOf('Italian Grand Prix')));
      expect(dyOf('Italian Grand Prix'), lessThan(dyOf('Belgian Grand Prix')));
    });

    testWidgets('no placeholder content remains on the screen', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');

      expect(
        find.text('Preview layout. Live data arrives in a later update.'),
        findsNothing,
      );
      expect(find.byType(GvImagePlaceholder), findsNothing);
    });

    testWidgets('the next event is marked and every status has a label', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _listSurface,
      );

      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Completed'), findsNWidgets(2));
      expect(find.text('Upcoming'), findsOneWidget);
      expect(find.text('Scheduled'), findsNWidgets(2));
      // The sprint weekend advertises its format.
      expect(find.text('Sprint weekend'), findsOneWidget);
    });

    testWidgets('postponed, cancelled and unknown statuses read as text', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => <CalendarEntry>[
          calendarEntry(
            round: 1,
            name: 'Postponed Grand Prix',
            startDate: '2026-09-04',
            status: EventStatus.postponed,
          ),
          calendarEntry(
            round: 2,
            name: 'Cancelled Grand Prix',
            startDate: '2026-09-11',
            status: EventStatus.cancelled,
          ),
          calendarEntry(
            round: 3,
            name: 'Mystery Grand Prix',
            startDate: '2026-09-18',
            status: EventStatus.unknown,
          ),
        ],
      );
      await pumpApp(tester, initialLocation: '/calendar', repository: repo);

      expect(find.text('Postponed'), findsOneWidget);
      expect(find.text('Cancelled'), findsOneWidget);
      expect(find.text('Status unknown'), findsOneWidget);
    });

    testWidgets('a missing locality and country simply do not render', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => <CalendarEntry>[
          calendarEntry(
            round: 1,
            name: 'Bare Grand Prix',
            startDate: '2026-09-04',
            endDate: '2026-09-06',
          ),
        ],
      );
      await pumpApp(tester, initialLocation: '/calendar', repository: repo);

      expect(find.text('Bare Grand Prix'), findsOneWidget);
      expect(find.textContaining('null'), findsNothing);
    });

    testWidgets('tapping an event opens its season/round route', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _listSurface,
        disableAnimations: true,
      );
      await tester.tap(find.text('Belgian Grand Prix'));
      await tester.pumpAndSettle();

      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      final GrandPrixDetailScreen detail = tester.widget<GrandPrixDetailScreen>(
        find.byType(GrandPrixDetailScreen),
      );
      expect(detail.season, 2026);
      expect(detail.round, 13);
    });
  });

  group('Calendar freshness and refresh', () {
    testWidgets('a stale calendar shows a cached-data notice with its rows', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        syncMetadata: (String key) =>
            syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
      );

      expect(find.byType(GvOfflineNotice), findsOneWidget);
      expect(
        find.text(
          'This data may be out of date — showing the last saved '
          'version.',
        ),
        findsOneWidget,
      );
      expect(find.byType(CalendarEventCard), findsWidgets);
    });

    testWidgets('pull-to-refresh keeps the rows visible', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _listSurface,
      );
      expect(find.byType(CalendarEventCard), findsWidgets);

      await tester.fling(
        find.byType(CalendarEventCard).first,
        const Offset(0, 300),
        1000,
      );
      await tester.pump();
      expect(find.byType(CalendarEventCard), findsWidgets);
      await tester.pumpAndSettle();
      expect(find.byType(CalendarEventCard), findsWidgets);
    });

    testWidgets('a refresh failure keeps the rows and shows a notice', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');
      _publishCalendarOutcome(
        tester,
        failure: ApiFailureKind.networkUnavailable,
      );
      await tester.pumpAndSettle();

      expect(find.byType(CalendarEventCard), findsWidgets);
      expect(
        find.text("Couldn't refresh — showing saved data."),
        findsOneWidget,
      );
    });

    testWidgets('an unrelated core failure does not become a Calendar error', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');
      containerOf(tester)
          .read(appSyncStateProvider.notifier)
          .publish(
            const AppSyncCompleted(
              trigger: SyncTrigger.manual,
              outcomes: <ResourceSyncOutcome>[
                ResourceSyncOutcome(
                  resourceKey: 'standings:drivers:2026',
                  kind: ResourceSyncOutcomeKind.failed,
                  failure: ApiFailureKind.serverUnavailable,
                ),
              ],
            ),
          );
      await tester.pumpAndSettle();

      expect(find.byType(CalendarEventCard), findsWidgets);
      expect(find.text("Couldn't refresh — showing saved data."), findsNothing);
      expect(find.byType(GvErrorState), findsNothing);
    });

    testWidgets('the refresh action is reachable and labelled', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');
      final Finder action = find.byKey(
        const ValueKey<String>('calendar-refresh'),
      );
      expect(action, findsOneWidget);
      expect(
        tester.getSize(find.byType(IconButton).first).height,
        greaterThanOrEqualTo(48),
      );
      await tester.tap(action);
      await tester.pumpAndSettle();
      expect(find.byType(CalendarEventCard), findsWidgets);
    });
  });

  group('Calendar initial position', () {
    testWidgets('the relevant event is brought into view once', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => _fullSeason(),
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        clock: _clock,
      );

      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Round 13 Grand Prix'), findsOneWidget);
      expect(
        scrollOffsetOf(tester, CalendarScreen),
        greaterThan(0),
        reason: 'the list opened near the relevant event, not at round 1',
      );
    });

    testWidgets('a later emission never repositions the list', (
      WidgetTester tester,
    ) async {
      final StreamController<List<CalendarEntry>> events =
          StreamController<List<CalendarEntry>>.broadcast();
      addTearDown(events.close);
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendarStream: (int season) => events.stream,
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        clock: _clock,
        disableAnimations: true,
      );
      events.add(_fullSeason());
      await tester.pumpAndSettle();
      final double positioned = scrollOffsetOf(tester, CalendarScreen);
      expect(positioned, greaterThan(0));

      // The user scrolls back to the top…
      tester
          .state<ScrollableState>(
            find
                .descendant(
                  of: find.byType(CalendarScreen),
                  matching: find.byType(Scrollable),
                )
                .first,
          )
          .position
          .jumpTo(0);
      await tester.pumpAndSettle();

      // …and a background refresh re-emits the same calendar.
      events.add(_fullSeason());
      await tester.pumpAndSettle();

      expect(
        scrollOffsetOf(tester, CalendarScreen),
        0,
        reason: 'positioning happens once, never on every Drift emission',
      );
    });

    testWidgets('switching branches preserves the user scroll position', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => _fullSeason(),
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        clock: _clock,
      );
      final double offset = scrollOffsetOf(tester, CalendarScreen);

      await tapNav(tester, 'Home');
      await tapNav(tester, 'Calendar');

      expect(scrollOffsetOf(tester, CalendarScreen), offset);
    });

    testWidgets('returning from Grand Prix detail preserves the position', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => _fullSeason(),
        grandPrix: (int s, int r) => grandPrixDetailFixture(s, r),
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        clock: _clock,
        disableAnimations: true,
      );
      final double offset = scrollOffsetOf(tester, CalendarScreen);

      await tester.tap(find.text('Round 13 Grand Prix'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(find.byType(CalendarScreen), findsOneWidget);
      expect(scrollOffsetOf(tester, CalendarScreen), offset);
    });
  });

  group('Calendar accessibility', () {
    testWidgets('event cards expose a descriptive semantic label', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');

      expect(
        find.bySemanticsLabel(RegExp('Belgian Grand Prix, round 13')),
        findsOneWidget,
      );
    });

    testWidgets('event cards meet the minimum touch target', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar');
      final Size size = tester.getSize(find.byType(CalendarEventCard).first);
      expect(size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('the list stays usable at a large text scale', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        textScale: 2,
        surfaceSize: const Size(400, 1200),
      );

      expect(find.byType(CalendarEventCard), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders Spanish copy for the new strings', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => const <CalendarEntry>[],
      );
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: repo,
        locale: const Locale('es'),
      );

      expect(find.text('Todavía no hay carreras programadas'), findsOneWidget);
    });
  });
}
