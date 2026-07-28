import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/router_harness.dart';

void main() {
  group('branch switching', () {
    testWidgets('the pill navigation switches among all four branches', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(tester);
      expect(find.byType(HomeScreen), findsOneWidget);

      await tapNav(tester, 'Calendar');
      expect(find.byType(CalendarScreen), findsOneWidget);
      expect(shellLocation(router), '/calendar');

      await tapNav(tester, 'Standings');
      expect(find.byType(StandingsScreen), findsOneWidget);
      // The Standings destination opens the season-agnostic branch root.
      expect(shellLocation(router), '/standings');

      await tapNav(tester, 'Explore');
      expect(find.byType(ExploreScreen), findsOneWidget);
      expect(shellLocation(router), '/explore');

      await tapNav(tester, 'Home');
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router), '/');
    });
  });

  group('settings', () {
    testWidgets('opens Settings from the app bar and system-back returns', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester);
      await tester.tap(find.byTooltip('Open settings'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);

      // Android system back.
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });

  group('unknown and invalid routes', () {
    testWidgets('an unknown route renders a recoverable not-found screen', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/totally/unknown');
      expect(find.byType(NotFoundScreen), findsOneWidget);
      expect(find.text('Screen not found'), findsOneWidget);
    });

    testWidgets('the not-found screen recovers to Home', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/totally/unknown');
      await tester.tap(find.text('Go to Home'));
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('invalid parameters resolve to a controlled invalid state', (
      WidgetTester tester,
    ) async {
      for (final String location in <String>[
        '/standings/drivers/abc', // non-numeric season
        '/standings/constructors/1700', // season out of range
        '/calendar/2026/999', // round out of range
        '/calendar/notyear/3', // non-numeric season
        '/drivers/BAD_ID', // not lowercase-kebab
        '/constructors/UPPER', // not lowercase-kebab
        '/circuits/with space', // invalid characters
      ]) {
        await pumpApp(tester, initialLocation: location);
        expect(
          find.byType(NotFoundScreen),
          findsOneWidget,
          reason: 'expected invalid-route state for $location',
        );
        expect(find.text('Invalid link'), findsOneWidget, reason: location);
        expect(tester.takeException(), isNull, reason: location);
      }
    });
  });

  group('standings branch root', () {
    testWidgets('/standings is the season-agnostic root showing drivers', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings',
      );
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(shellLocation(router), '/standings');
      // Drivers on the first visit (a driver name is shown, not a team).
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsNothing);

      // Switching championship at the root is internal to the screen: the
      // season-agnostic location is preserved and no season is invented.
      await tester.tap(find.text('Constructors'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings');
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
      expect(find.text('Max Verstappen'), findsNothing);
    });

    testWidgets('season-specific standings deep links render their season', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/standings/constructors/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);

      await pumpApp(tester, initialLocation: '/standings/drivers/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(find.text('Max Verstappen'), findsOneWidget);
    });

    testWidgets('an explicit sibling switch replaces instead of stacking', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2026',
      );

      await tester.tap(find.text('Constructors'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/constructors/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);

      await tester.tap(find.text('Drivers'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/drivers/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);

      // Nothing was stacked to pop back to: system back does not peel off a
      // sibling Standings page.
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/drivers/2026');
      expect(find.byType(StandingsScreen), findsOneWidget);
    });
  });

  group('direct detail opening (deep-link ready)', () {
    testWidgets('valid detail routes open directly', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar/2026/3');
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);

      await pumpApp(tester, initialLocation: '/drivers/a-driver');
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await pumpApp(tester, initialLocation: '/constructors/scuderia-rossa');
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await pumpApp(tester, initialLocation: '/circuits/northgate');
      expect(find.byType(CircuitDetailScreen), findsOneWidget);
    });
  });

  group('component catalogue production exclusion', () {
    testWidgets('the catalogue entry is shown outside production', (
      WidgetTester tester,
    ) async {
      await pumpStandalone(
        tester,
        const SettingsScreen(environmentOverride: AppEnvironment.development),
      );
      expect(find.text('Component catalogue'), findsOneWidget);
    });

    testWidgets('the catalogue entry is hidden in production', (
      WidgetTester tester,
    ) async {
      await pumpStandalone(
        tester,
        const SettingsScreen(environmentOverride: AppEnvironment.production),
      );
      expect(find.text('Component catalogue'), findsNothing);
      expect(find.text('Developer'), findsNothing);
    });
  });

  group('entity graph has no duplicate loop', () {
    testWidgets(
      'driver -> team -> the same driver collapses instead of stacking',
      (WidgetTester tester) async {
        // A coherent two-entity graph: the driver races for the team, and the
        // team's derived line-up contains that driver.
        final GoRouter router = await pumpApp(
          tester,
          drivers: FakeDriverRepository(
            profile: (int season, String driverId) => driverProfileFixture(
              season: season,
              driverId: driverId,
              participations: <DriverParticipation>[
                participation(
                  season: season,
                  driverId: driverId,
                  constructorId: 'red-bull',
                  teamName: 'Oracle Red Bull Racing',
                ),
              ],
            ),
          ),
          constructors: FakeConstructorRepository(
            profile: (int season, String constructorId) => teamProfileFixture(
              season: season,
              constructorId: constructorId,
              lineup: <TeamLineupMember>[
                lineupMember(driverId: 'b-racer', name: 'Bruno Racer'),
              ],
            ),
          ),
        );

        unawaited(router.push('/drivers/b-racer'));
        await tester.pumpAndSettle();
        expect(find.byType(DriverDetailScreen), findsOneWidget);

        // Forward navigation to the current team pushes a new page.
        await tester.tap(find.byType(GvTeamRow));
        await tester.pumpAndSettle();
        expect(find.byType(ConstructorDetailScreen), findsOneWidget);

        // Re-opening the driver that is directly below returns to it instead of
        // pushing a duplicate.
        await tester.tap(
          find.byKey(const ValueKey<String>('team-lineup-b-racer')),
        );
        await tester.pumpAndSettle();
        expect(find.byType(ConstructorDetailScreen), findsNothing);
        expect(find.byType(DriverDetailScreen), findsOneWidget);

        // Proof that nothing was duplicated: a single system back leaves the
        // detail stack entirely and returns to the shell (Home). If a duplicate
        // driver had been stacked, we would still be on a detail screen.
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.byType(DriverDetailScreen), findsNothing);
        expect(find.byType(HomeScreen), findsOneWidget);
      },
    );
  });
}
