import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// The (season, round) a pushed Grand Prix screen was opened with. Pushed
/// detail routes live on the **root** navigator above the shell, so the shell's
/// own location is unchanged by design; the screen's own validated parameters
/// are what prove the exact route.
(int, int) openedGrandPrix(WidgetTester tester) {
  final GrandPrixDetailScreen screen = tester.widget<GrandPrixDetailScreen>(
    find.byType(GrandPrixDetailScreen),
  );
  return (screen.season, screen.round);
}

/// A tall surface so every Home module is laid out without step-by-step
/// scrolling; the navigation behaviour under test is unaffected by it.
const Size _tall = Size(400, 2400);

Future<GoRouter> pumpHomeRouter(
  WidgetTester tester, {
  HomeDashboardView? dashboard,
  Size surfaceSize = _tall,
}) => pumpApp(
  tester,
  initialLocation: '/',
  surfaceSize: surfaceSize,
  disableAnimations: true,
  repository: FakeRaceWeekendRepository(
    home: homeViewFixture(),
    dashboard: dashboard ?? homeDashboardFixture(),
    calendar: (int season) => calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

double homeScrollOffset(WidgetTester tester) => tester
    .state<ScrollableState>(
      find
          .descendant(
            of: find.byType(HomeScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    )
    .position
    .pixels;

void main() {
  testWidgets('launch opens Home', (WidgetTester tester) async {
    final GoRouter router = await pumpHomeRouter(tester);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(shellLocation(router), '/');
  });

  group('Grand Prix routes carry the exact season and round', () {
    testWidgets('the hero opens the featured Grand Prix', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(tester);
      await tester.tap(find.byKey(const ValueKey<String>('home-hero-open')));
      await tester.pumpAndSettle();

      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(openedGrandPrix(tester), (2026, 13));
      expect(
        shellLocation(router),
        '/',
        reason: 'the detail sits on the root navigator above the Home branch',
      );
    });

    testWidgets('the focused session opens the same Grand Prix', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-session-focus')),
      );
      await tester.pumpAndSettle();
      expect(openedGrandPrix(tester), (2026, 13));
    });

    testWidgets('the latest completed event opens its own round', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-latest-result')),
      );
      await tester.pumpAndSettle();
      expect(
        openedGrandPrix(tester),
        (2026, 12),
        reason: 'the latest completed round, not the featured one',
      );
    });

    testWidgets('an upcoming event opens its own round', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-upcoming-2026-14')),
      );
      await tester.pumpAndSettle();
      expect(openedGrandPrix(tester), (2026, 14));
    });
  });

  group('championship leaders', () {
    testWidgets('a single Driver leader opens the driver by stable id', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-driver-leader')),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'max-verstappen',
        reason: 'the stable identifier, never a display name',
      );
    });

    testWidgets('a single Team leader opens the team by stable id', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(find.byKey(const ValueKey<String>('home-team-leader')));
      await tester.pumpAndSettle();

      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'mclaren',
      );
    });

    testWidgets('the detail receives the exact Home season', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-driver-leader')),
      );
      await tester.pumpAndSettle();

      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .originSeason,
        2026,
        reason: 'the season the leader was displayed for travels with it',
      );
    });

    testWidgets('tied Drivers open the exact-season Standings route', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(
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

      await tester.tap(
        find.byKey(const ValueKey<String>('home-driver-leader')),
      );
      await tester.pumpAndSettle();

      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(shellLocation(router), '/standings/drivers/2026');
    });

    testWidgets('tied Teams open the exact-season Standings route', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(
        tester,
        dashboard: homeDashboardFixture(
          constructorLeaders: <ConstructorStandingEntry>[
            constructorStandingEntry(
              constructorId: 'mclaren',
              stableName: 'McLaren',
              order: 0,
              position: 1,
              points: 460,
            ),
            constructorStandingEntry(
              constructorId: 'red-bull',
              stableName: 'Red Bull Racing',
              order: 1,
              position: 1,
              points: 460,
            ),
          ],
        ),
      );

      await tester.tap(find.byKey(const ValueKey<String>('home-team-leader')));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/constructors/2026');
    });

    testWidgets('an unavailable leader opens Standings, never a broken route', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(
        tester,
        dashboard: homeDashboardFixture(
          driverLeaders: const <DriverStandingEntry>[],
        ),
      );

      await tester.tap(
        find.byKey(const ValueKey<String>('home-driver-leader')),
      );
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/drivers/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);
    });
  });

  group('section and quick actions', () {
    testWidgets('View Calendar opens the Calendar branch root', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(tester);
      await tester.tap(find.text('View Calendar'));
      await tester.pumpAndSettle();

      expect(find.byType(CalendarScreen), findsOneWidget);
      expect(shellLocation(router), '/calendar');
    });

    testWidgets('the Explore shortcuts open their exact category', (
      WidgetTester tester,
    ) async {
      for (final (String key, String location) in <(String, String)>[
        ('home-quick-drivers', '/explore/drivers'),
        ('home-quick-teams', '/explore/teams'),
        ('home-quick-circuits', '/explore/circuits'),
      ]) {
        final GoRouter router = await pumpHomeRouter(tester);
        await tester.tap(find.byKey(ValueKey<String>(key)));
        await tester.pumpAndSettle();

        expect(find.byType(ExploreScreen), findsOneWidget, reason: key);
        expect(shellLocation(router), location, reason: key);
      }
    });

    testWidgets('the standings section actions open the season routes', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(tester);
      await tester.tap(find.text("View drivers' standings"));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/drivers/2026');
    });

    testWidgets('Settings opens above the shell and back returns Home', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      await tester.tap(find.byTooltip('Open settings'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);

      final NavigatorState nav = tester.state(find.byType(Navigator).first);
      nav.pop();
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });

  group('back behaviour and stacking', () {
    testWidgets('back from a Grand Prix returns to Home', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(tester);
      await tester.tap(find.byKey(const ValueKey<String>('home-hero-open')));
      await tester.pumpAndSettle();

      tester.state<NavigatorState>(find.byType(Navigator).first).pop();
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router), '/');
    });

    testWidgets('back from a Driver leader returns to Home', (
      WidgetTester tester,
    ) async {
      final GoRouter router2 = await pumpHomeRouter(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('home-driver-leader')),
      );
      await tester.pumpAndSettle();

      tester.state<NavigatorState>(find.byType(Navigator).first).pop();
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router2), '/');
    });

    testWidgets('repeated branch actions never stack identical routes', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpHomeRouter(tester);
      // Leave and return three times. Branch navigation replaces rather than
      // pushes, so the Explore branch can never accumulate duplicates.
      for (int i = 0; i < 3; i++) {
        await tester.tap(
          find.byKey(const ValueKey<String>('home-quick-teams')),
        );
        await tester.pumpAndSettle();
        expect(shellLocation(router), '/explore/teams', reason: 'pass $i');
        await tapNav(tester, 'Home');
        expect(find.byType(HomeScreen), findsOneWidget, reason: 'pass $i');
      }
    });

    testWidgets('repeated detail taps never stack identical routes', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester);
      for (int i = 0; i < 3; i++) {
        await tester.tap(
          find.byKey(const ValueKey<String>('home-driver-leader')),
        );
        await tester.pumpAndSettle();
        expect(find.byType(DriverDetailScreen), findsOneWidget);

        // Exactly one pop returns to Home: nothing was stacked underneath.
        tester.state<NavigatorState>(find.byType(Navigator).first).pop();
        await tester.pumpAndSettle();
        expect(find.byType(HomeScreen), findsOneWidget, reason: 'pass $i');
        expect(find.byType(DriverDetailScreen), findsNothing);
      }
    });
  });

  group('scroll preservation', () {
    testWidgets('a detail round trip restores the Home offset', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester, surfaceSize: const Size(400, 640));

      await tester.drag(
        find.descendant(
          of: find.byType(HomeScreen),
          matching: find.byType(Scrollable),
        ),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();
      final double offset = homeScrollOffset(tester);
      expect(offset, greaterThan(0));

      await tester.tap(find.byKey(const ValueKey<String>('home-hero-open')));
      await tester.pumpAndSettle();
      tester.state<NavigatorState>(find.byType(Navigator).first).pop();
      await tester.pumpAndSettle();

      expect(homeScrollOffset(tester), offset);
    });

    testWidgets('a branch switch preserves the Home offset', (
      WidgetTester tester,
    ) async {
      await pumpHomeRouter(tester, surfaceSize: const Size(400, 640));

      await tester.drag(
        find.descendant(
          of: find.byType(HomeScreen),
          matching: find.byType(Scrollable),
        ),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();
      final double offset = homeScrollOffset(tester);

      await tapNav(tester, 'Calendar');
      await tapNav(tester, 'Home');

      expect(homeScrollOffset(tester), offset);
    });

    testWidgets('a season transition starts the new season at the top', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        surfaceSize: const Size(400, 640),
        disableAnimations: true,
        currentSeason: 2027,
        repository: FakeRaceWeekendRepository(
          home: homeViewFixture(),
          // A materialized Home for the *new* season with nothing scheduled.
          dashboard: homeDashboardFixture(
            seasonYear: 2027,
            withFocus: false,
            withLatestCompleted: false,
            upcoming: const <CalendarEntry>[],
          ),
          calendar: (int season) => calendarFixture(season: season),
        ),
      );

      expect(find.text('2027 season'), findsOneWidget);
      expect(homeScrollOffset(tester), 0);
    });
  });
}
