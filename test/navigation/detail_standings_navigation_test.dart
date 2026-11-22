// Step 55C.9N: Driver / Team Detail → Standings navigation.
//
// The Standings tables live inside the bottom-navigation shell, while entity
// details render above it on the root navigator. Opening a table from a detail
// must therefore change the active branch (or return to the very table the
// detail was opened from), never push a second shell destination above the
// detail: that duplicated the shell's branch navigators and failed go_router's
// `!keyReservation.contains(key)` assertion.
//
// Every season and value is a deterministic test fixture.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/app_shell.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/standings/application/standings_state.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

const Size _tall = Size(400, 2400);

/// The driver races for the team and the team's line-up contains the driver,
/// so Driver → Team → Driver is reachable.
FakeDriverRepository _drivers() => FakeDriverRepository(
  cards: (int season) => seasonDriverCardsFixture(season: season),
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
);

FakeConstructorRepository _teams() => FakeConstructorRepository(
  cards: (int season) => seasonTeamCardsFixture(season: season),
  profile: (int season, String constructorId) => teamProfileFixture(
    season: season,
    constructorId: constructorId,
    stableName: 'Red Bull',
    seasonName: 'Oracle Red Bull Racing',
    lineup: <TeamLineupMember>[
      lineupMember(
        season: season,
        driverId: 'max-verstappen',
        name: 'Max Verstappen',
      ),
    ],
  ),
);

FakeStandingsRepository _standings() => FakeStandingsRepository(
  drivers: (int season) => driverStandingsFixture(season: season),
  constructors: (int season) => constructorStandingsFixture(season: season),
);

Future<GoRouter> _pump(
  WidgetTester tester, {
  required String at,
  Size size = _tall,
  int? currentSeason = 2026,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  return pumpApp(
    tester,
    initialLocation: at,
    surfaceSize: size,
    currentSeason: currentSeason,
    drivers: _drivers(),
    constructors: _teams(),
    standings: _standings(),
  );
}

Finder get _driversLink => find.text("View drivers' standings");
Finder get _teamsLink => find.text("View constructors' standings");

/// The one visible Standings table, its championship and season.
(StandingsChampionship?, int?) _table(WidgetTester tester) {
  final StandingsScreen screen = tester.widget<StandingsScreen>(
    find.byType(StandingsScreen),
  );
  return (screen.championship, screen.season);
}

/// The shell exists exactly once and no route error was raised.
void _expectSingleShell(WidgetTester tester) {
  expect(tester.takeException(), isNull);
  expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
}

Future<void> _openDriverFromHome(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey<String>('home-driver-leader')));
  await tester.pumpAndSettle();
  expect(find.byType(DriverDetailScreen), findsOneWidget);
}

void main() {
  group('Driver Detail → Drivers\' Standings', () {
    testWidgets('B: from Home it opens the table for the resolved season', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      await _openDriverFromHome(tester);

      await tester.tap(_driversLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(_table(tester), (StandingsChampionship.drivers, 2026));
      expect(shellLocation(router), '/standings/drivers/2026');
    });

    testWidgets('C: from Explore it opens the table; Explore keeps its state', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/explore/drivers');
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await tester.tap(_driversLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(_table(tester), (StandingsChampionship.drivers, 2026));
      expect(shellLocation(router), '/standings/drivers/2026');

      // The Explore branch is where the user left it.
      await tapNav(tester, 'Explore');
      expect(find.byType(ExploreScreen), findsOneWidget);
      expect(shellLocation(router), '/explore/drivers');
      expect(find.text('Max Verstappen'), findsOneWidget);
    });

    testWidgets('A: from a historical table it returns to that same table '
        'and scroll position', (WidgetTester tester) async {
      final GoRouter router = await _pump(
        tester,
        at: '/standings/drivers/2024',
        size: const Size(390, 600),
      );
      final Finder list = find
          .descendant(
            of: find.byType(StandingsScreen),
            matching: find.byType(Scrollable),
          )
          .last;
      await tester.drag(list, const Offset(0, -120));
      await tester.pumpAndSettle();
      final double offset = tester.state<ScrollableState>(list).position.pixels;
      expect(offset, greaterThan(0));

      await tester.tap(find.text('Lando Norris').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(find.text('2024 season'), findsOneWidget);

      await tester.scrollUntilVisible(
        _driversLink,
        150,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey<String>('driver-detail-list')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(_driversLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(_table(tester), (StandingsChampionship.drivers, 2024));
      expect(shellLocation(router), '/standings/drivers/2024');
      expect(tester.state<ScrollableState>(list).position.pixels, offset);
    });

    testWidgets('D: from a deep link it opens the locally resolved season', (
      WidgetTester tester,
    ) async {
      for (final int season in <int>[2026, 2025]) {
        final GoRouter router = await _pump(
          tester,
          at: '/drivers/max-verstappen',
          currentSeason: season,
        );
        expect(find.text('$season season'), findsOneWidget);
        await tester.tap(_driversLink);
        await tester.pumpAndSettle();

        _expectSingleShell(tester);
        expect(_table(tester), (StandingsChampionship.drivers, season));
        expect(shellLocation(router), '/standings/drivers/$season');
      }
    });

    testWidgets('E: through another entity (Team → Driver) it stays valid', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      unawaited(router.push('/constructors/red-bull'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Max Verstappen').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await tester.tap(_driversLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      expect(_table(tester), (StandingsChampionship.drivers, 2026));
    });

    testWidgets('the shell tabs keep their selection and state afterwards', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      await _openDriverFromHome(tester);
      await tester.tap(_driversLink);
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/standings/drivers/2026');

      await tapNav(tester, 'Home');
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router), '/');
      await tapNav(tester, 'Standings');
      expect(_table(tester), (StandingsChampionship.drivers, 2026));
      expect(shellLocation(router), '/standings/drivers/2026');
      _expectSingleShell(tester);
    });

    testWidgets('Back from Driver Detail still returns to the origin', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      await _openDriverFromHome(tester);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router), '/');
    });

    testWidgets('Driver → Team → same Driver still pops instead of stacking', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      await _openDriverFromHome(tester);
      await tester.tap(
        find.bySemanticsLabel('Open team Oracle Red Bull Racing'),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      await tester.tap(find.text('Max Verstappen').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      // One back leaves the detail stack entirely.
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(shellLocation(router), '/');
    });
  });

  group('Team Detail → Constructors\' Standings', () {
    testWidgets('from Home it opens the table for the resolved season', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, at: '/');
      await tester.tap(find.byKey(const ValueKey<String>('home-team-leader')));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.tap(_teamsLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      expect(_table(tester), (StandingsChampionship.constructors, 2026));
      expect(shellLocation(router), '/standings/constructors/2026');
    });

    testWidgets('from a historical table it returns to that same table', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(
        tester,
        at: '/standings/constructors/2024',
      );
      await tester.tap(find.text('McLaren Formula 1 Team').first);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.tap(_teamsLink);
      await tester.pumpAndSettle();

      _expectSingleShell(tester);
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      expect(_table(tester), (StandingsChampionship.constructors, 2024));
      expect(shellLocation(router), '/standings/constructors/2024');
    });
  });
}
