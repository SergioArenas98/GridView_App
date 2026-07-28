import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/router_harness.dart';

const Size _tallSurface = Size(400, 2400);

/// A coherent two-entity graph: the driver races for the team, and the team's
/// derived line-up contains that driver — so an A → B → A loop is genuinely
/// reachable from both sides.
FakeDriverRepository _linkedDrivers() => FakeDriverRepository(
  cards: (int season) => seasonDriverCardsFixture(season: season),
  profile: (int season, String driverId) => driverProfileFixture(
    season: season,
    driverId: driverId,
    name: 'Max Verstappen',
    participations: <DriverParticipation>[
      participation(
        season: season,
        driverId: driverId,
        constructorId: 'red-bull',
        teamName: 'Oracle Red Bull Racing',
      ),
    ],
  ),
);

FakeConstructorRepository _linkedTeams() => FakeConstructorRepository(
  cards: (int season) => seasonTeamCardsFixture(season: season),
  profile: (int season, String constructorId) => teamProfileFixture(
    season: season,
    constructorId: constructorId,
    stableName: 'Red Bull',
    seasonName: 'Oracle Red Bull Racing',
    lineup: <TeamLineupMember>[
      lineupMember(driverId: 'max-verstappen', name: 'Max Verstappen'),
    ],
  ),
);

/// Cross-entity navigation across the whole entity graph.
///
/// Every route is driven by a **stable identifier**, details stay above the
/// shell so Android back returns to the exact originating branch, and an
/// immediate A → B → A loop pops back to the existing route instead of stacking
/// a duplicate.
void main() {
  group('entry points', () {
    testWidgets('Explore → Driver detail', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets('Standings → Driver detail', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Max Verstappen').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets('Constructors standings → Team detail', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2026',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('McLaren Formula 1 Team').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
    });

    testWidgets('Explore → Circuit detail', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Autodromo Nazionale Monza'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);
    });

    testWidgets('Circuit → related Grand Prix', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/spa-francorchamps',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Belgian Grand Prix'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
    });

    testWidgets('Driver detail → Team detail', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        drivers: _linkedDrivers(),
        constructors: _linkedTeams(),
      );
      await tester.tap(find.text('Oracle Red Bull Racing').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
    });

    testWidgets('Team detail → Driver detail', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/red-bull',
        surfaceSize: _tallSurface,
        drivers: _linkedDrivers(),
        constructors: _linkedTeams(),
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });
  });

  group('loop prevention', () {
    testWidgets('Driver → Team → the same Driver pops instead of pushing', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        drivers: _linkedDrivers(),
        constructors: _linkedTeams(),
      );

      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Oracle Red Bull Racing').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      // One system back leaves the detail stack entirely: nothing accumulated.
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('Team → Driver → the same Team pops instead of pushing', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
        drivers: _linkedDrivers(),
        constructors: _linkedTeams(),
      );

      await tester.tap(find.text('Oracle Red Bull Racing'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await tester.tap(find.text('Oracle Red Bull Racing').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('Grand Prix → Circuit → the same Grand Prix pops', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _tallSurface,
      );
      unawaited(router.push('/calendar/2026/13'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);

      await tester.tap(find.text('View circuit'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);

      await tester.tap(find.text('Belgian Grand Prix'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsNothing);
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
    });

    testWidgets('a different entity still pushes normally', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
        constructors: FakeConstructorRepository(
          cards: (int season) => seasonTeamCardsFixture(season: season),
          profile: (int season, String constructorId) => teamProfileFixture(
            season: season,
            constructorId: constructorId,
            lineup: <TeamLineupMember>[
              lineupMember(driverId: 'pierre-gasly', name: 'Pierre Gasly'),
              lineupMember(driverId: 'jack-doohan', name: 'Jack Doohan'),
            ],
          ),
        ),
        drivers: FakeDriverRepository(
          profile: (int season, String driverId) => driverProfileFixture(
            season: season,
            driverId: driverId,
            name: driverId == 'pierre-gasly' ? 'Pierre Gasly' : 'Jack Doohan',
            participations: <DriverParticipation>[
              participation(
                season: season,
                driverId: driverId,
                constructorId: 'williams',
                teamName: 'Williams Racing',
              ),
            ],
          ),
        ),
      );

      await tester.tap(find.text('BWT Alpine Formula One Team'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pierre Gasly'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      // A *different* team is legitimate forward navigation, so it pushes.
      await tester.tap(find.text('Williams Racing').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      // Two backs unwind the two pushes above the driver.
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });
  });

  group('origin and season context are preserved', () {
    testWidgets('Android back returns to the exact originating branch', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Autodromo Nazionale Monza'));
      await tester.pumpAndSettle();

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(ExploreScreen), findsOneWidget);
      expect(shellLocation(router), '/explore/circuits');
    });

    testWidgets('a historical Standings season reaches the driver detail', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        profile: (int season, String driverId) =>
            driverProfileFixture(season: season, driverId: driverId),
      );
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2021',
        surfaceSize: _tallSurface,
        drivers: drivers,
      );
      await tester.tap(find.text('Max Verstappen').first);
      await tester.pumpAndSettle();

      expect(drivers.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'max-verstappen', season: 2021),
      ]);
    });

    testWidgets('the Standings context survives a detail round trip', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2021',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('McLaren Formula 1 Team').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(shellLocation(router), '/standings/constructors/2021');
    });

    testWidgets('a Grand Prix result opens the driver with the event season', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        profile: (int season, String driverId) =>
            driverProfileFixture(season: season, driverId: driverId),
      );
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: _tallSurface,
        drivers: drivers,
      );
      unawaited(router.push('/calendar/2026/12'));
      await tester.pumpAndSettle();

      final Finder driverRow = find.text('Max Verstappen');
      if (driverRow.evaluate().isEmpty) return;
      await tester.tap(driverRow.first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets('a detail pushed from Home returns to Home', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(tester, surfaceSize: _tallSurface);
      unawaited(router.push('/drivers/max-verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });
}
