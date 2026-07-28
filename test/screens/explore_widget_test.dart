import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/router_harness.dart';

/// A surface tall enough for the whole fixture collection, so content assertions
/// do not depend on scroll position.
const Size _tallSurface = Size(400, 1400);

/// A short surface, so the lists genuinely overflow and can be scrolled.
const Size _shortSurface = Size(400, 500);

List<SeasonDriverCard> _longDrivers({int season = 2026}) => <SeasonDriverCard>[
  for (int i = 0; i < 22; i++)
    driverCard(
      season: season,
      order: i,
      driverId: 'driver-${i + 1}',
      name: 'Driver ${i + 1}',
      raceNumber: i + 1,
      constructorId: 'team-${(i ~/ 2) + 1}',
      teamName: 'Team ${(i ~/ 2) + 1}',
      position: i + 1,
      points: (22 - i) * 10,
    ),
];

List<SeasonTeamCard> _longTeams({int season = 2026}) => <SeasonTeamCard>[
  for (int i = 0; i < 11; i++)
    teamCard(
      season: season,
      order: i,
      constructorId: 'team-${i + 1}',
      stableName: 'Team ${i + 1}',
      seasonName: 'Team ${i + 1} Racing',
      position: i + 1,
      points: (11 - i) * 25,
    ),
];

List<SeasonCircuitCard> _longCircuits({int season = 2026}) =>
    <SeasonCircuitCard>[
      for (int i = 0; i < 24; i++)
        circuitCard(
          season: season,
          order: i + 1,
          circuitId: 'circuit-${i + 1}',
          name: 'Circuit ${i + 1}',
          locality: 'City ${i + 1}',
          country: 'Country ${i + 1}',
          related: relatedGrandPrix(
            season: season,
            round: i + 1,
            name: 'Grand Prix ${i + 1}',
          ),
        ),
    ];

/// Metadata that has never synchronised, so a collection stays unmaterialized.
ResourceSyncState? _neverSynced(String key) => null;

/// Only an accepted bootstrap for this exact season materialized the
/// collections; no individual resource has a record of its own.
ResourceSyncState? _bootstrapOnly(String key) => key == 'bootstrap'
    ? ResourceSyncState(
        resourceKey: key,
        season: 2026,
        lastSuccessAt: DateTime.utc(2026, 7, 18, 11, 55),
      )
    : null;

void main() {
  group('category routing', () {
    testWidgets('/explore defaults to Drivers', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      expect(find.byType(ExploreScreen), findsOneWidget);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('Autodromo Nazionale Monza'), findsNothing);
    });

    testWidgets('each explicit category route opens its own collection', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
      );
      expect(find.text('BWT Alpine Formula One Team'), findsOneWidget);
      expect(find.text('Max Verstappen'), findsNothing);
    });

    testWidgets('the circuits route opens the circuits collection', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _tallSurface,
      );
      expect(find.text('Autodromo Nazionale Monza'), findsOneWidget);
    });

    testWidgets('selecting a category replaces the page and makes no request', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = defaultFakeDrivers();
      final FakeConstructorRepository constructors = defaultFakeConstructors();
      final FakeCircuitRepository circuits = defaultFakeCircuits();
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        drivers: drivers,
        constructors: constructors,
        circuits: circuits,
      );

      await tester.tap(find.text('Teams'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/teams');
      expect(find.byType(ExploreScreen), findsOneWidget);

      await tester.tap(find.text('Circuits'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/circuits');

      await tester.tap(find.text('Drivers'));
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/drivers');

      expect(drivers.collectionRefreshCount, 0);
      expect(constructors.collectionRefreshCount, 0);
      expect(circuits.collectionRefreshCount, 0);
    });

    testWidgets('repeated taps on the active category do not stack routes', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
      );
      for (int i = 0; i < 3; i++) {
        await tester.tap(find.text('Teams'));
        await tester.pumpAndSettle();
      }
      expect(shellLocation(router), '/explore/teams');
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('an invalid category route is a controlled not-found', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/explore/not-a-category');
      expect(find.byType(ExploreScreen), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('collection states', () {
    testWidgets('a materialized empty collection renders as empty', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
        constructors: FakeConstructorRepository(
          cards: (int season) => const <SeasonTeamCard>[],
        ),
      );
      expect(find.text('No teams yet'), findsOneWidget);
      expect(find.byType(GvSkeletonCard), findsNothing);
    });

    testWidgets('an unmaterialized collection stays loading, not empty', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        disableAnimations: true,
        syncMetadata: _neverSynced,
        drivers: FakeDriverRepository(
          cards: (int season) => const <SeasonDriverCard>[],
        ),
      );
      expect(find.text('No drivers yet'), findsNothing);
      expect(find.byType(GvSkeletonCard), findsWidgets);
    });

    testWidgets('a bootstrap-only collection shows no fabricated timestamp', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        syncMetadata: _bootstrapOnly,
      );
      // Real content, from an accepted same-season bootstrap.
      expect(find.text('Max Verstappen'), findsOneWidget);
      // ...but nothing that claims when this collection was last updated.
      expect(find.textContaining('Updated'), findsNothing);
      expect(find.text('Showing saved data'), findsNothing);
    });

    testWidgets('a bootstrap-only empty collection renders as empty', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _tallSurface,
        syncMetadata: _bootstrapOnly,
        circuits: FakeCircuitRepository(
          cards: (int season) => const <SeasonCircuitCard>[],
        ),
      );
      expect(find.text('No circuits yet'), findsOneWidget);
    });

    testWidgets('a first-load failure offers a focused retry', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        cards: (int season) => const <SeasonDriverCard>[],
        onRefreshCollection: (int season) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      final FakeConstructorRepository constructors = defaultFakeConstructors();
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        disableAnimations: true,
        syncMetadata: _neverSynced,
        drivers: drivers,
        constructors: constructors,
      );

      // The coordinator reports that this collection's own resource failed with
      // nothing materialized locally: a recoverable first-load error.
      containerOf(tester)
          .read(appSyncStateProvider.notifier)
          .publish(
            const AppSyncCompleted(
              trigger: SyncTrigger.startup,
              outcomes: <ResourceSyncOutcome>[
                ResourceSyncOutcome(
                  resourceKey: 'drivers:2026',
                  kind: ResourceSyncOutcomeKind.failed,
                  failure: ApiFailureKind.networkUnavailable,
                ),
              ],
            ),
          );
      await tester.pumpAndSettle();
      expect(find.text("Can't load the drivers"), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(drivers.collectionRefreshSeasons, <int>[2026]);
      expect(
        constructors.collectionRefreshCount,
        0,
        reason: 'the retry targets only the selected collection',
      );
    });

    testWidgets(
      'cached cards stay visible when the coordinator reports a failure',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/explore',
          surfaceSize: _tallSurface,
        );
        expect(find.text('Max Verstappen'), findsOneWidget);

        // Exactly as the real coordinator reports it: this collection's own
        // resource failed, nothing else did.
        containerOf(tester)
            .read(appSyncStateProvider.notifier)
            .publish(
              const AppSyncCompleted(
                trigger: SyncTrigger.foreground,
                outcomes: <ResourceSyncOutcome>[
                  ResourceSyncOutcome(
                    resourceKey: 'drivers:2026',
                    kind: ResourceSyncOutcomeKind.failed,
                    failure: ApiFailureKind.networkUnavailable,
                  ),
                ],
              ),
            );
        await tester.pumpAndSettle();

        expect(
          find.text('Max Verstappen'),
          findsOneWidget,
          reason: 'content is never replaced by an error',
        );
        expect(find.text('Update failed'), findsOneWidget);
      },
    );

    testWidgets("one category's failure never becomes another's", (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
        syncMetadata: _neverSynced,
        drivers: FakeDriverRepository(
          cards: (int season) => const <SeasonDriverCard>[],
        ),
        constructors: FakeConstructorRepository(
          cards: (int season) => seasonTeamCardsFixture(season: season),
        ),
      );
      // Teams has content even though Drivers is unmaterialized.
      expect(find.text('BWT Alpine Formula One Team'), findsOneWidget);
      expect(find.text("Can't load the drivers"), findsNothing);
    });
  });

  group('header', () {
    testWidgets('no sample-data banner appears in a build serving real data', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      expect(
        find.byType(MockDataBanner),
        findsNothing,
        reason: 'a remote build must never claim its data is a sample',
      );
    });

    testWidgets('the sample-data banner appears in a fixture build', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        mockData: true,
      );
      expect(find.byType(MockDataBanner), findsOneWidget);
    });

    testWidgets('the resolved season is shown as the screen context', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        currentSeason: 2024,
      );
      expect(find.text('2024 season'), findsOneWidget);
    });
  });

  group('content and accessibility', () {
    testWidgets('no placeholder catalogue data appears anywhere', (
      WidgetTester tester,
    ) async {
      for (final String location in <String>[
        '/explore',
        '/explore/teams',
        '/explore/circuits',
      ]) {
        await pumpApp(
          tester,
          initialLocation: location,
          surfaceSize: _tallSurface,
        );
        expect(find.text('Profile placeholder'), findsNothing);
        expect(find.text('Every driver on the current grid'), findsNothing);
        expect(find.text('Every constructor this season'), findsNothing);
        expect(find.text('Every circuit on the calendar'), findsNothing);
      }
    });

    testWidgets('no stable identifier is ever displayed', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      expect(find.textContaining('max-verstappen'), findsNothing);
      expect(find.textContaining('Max-verstappen'), findsNothing);
      expect(find.textContaining('red-bull'), findsNothing);
    });

    testWidgets('a driver with no authoritative team shows no team text', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      // The fixture's unaffiliated entrant is present by name...
      expect(find.text('Unaffiliated Entrant'), findsOneWidget);
      // ...and its unresolved constructor id never becomes a team name.
      expect(find.textContaining('not-synced-team'), findsNothing);
      expect(find.textContaining('Not Synced Team'), findsNothing);
    });

    testWidgets('an unranked entrant shows no false zero position', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      expect(find.text('Reserve Entrant'), findsOneWidget);
    });

    testWidgets('the category selector exposes selected semantics', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
      );
      // `isSemantics` checks only what is asserted, so the selected
      // state is verified without pinning every unrelated flag or action.
      expect(
        tester.getSemantics(find.bySemanticsLabel('Teams').first),
        isSemantics(label: 'Teams', isSelected: true, isButton: true),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel('Drivers').first),
        isSemantics(label: 'Drivers', isSelected: false),
        reason: 'the unselected categories are explicitly not selected',
      );
    });

    testWidgets('every category target meets the minimum touch size', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      for (final String label in <String>['Drivers', 'Teams', 'Circuits']) {
        final Size size = tester.getSize(
          find
              .ancestor(
                of: find.text(label),
                matching: find.byType(ConstrainedBox),
              )
              .first,
        );
        expect(size.height, greaterThanOrEqualTo(48));
      }
    });

    testWidgets('the collections survive a large text scale', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
        textScale: 2.0,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('navigation', () {
    testWidgets('a driver row opens the driver by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets('a team row opens the team by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('BWT Alpine Formula One Team'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
    });

    testWidgets('a circuit row opens the circuit by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Autodromo Nazionale Monza'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);
    });

    testWidgets('the resolved season travels to the detail', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        cards: (int season) => seasonDriverCardsFixture(season: season),
        profile: (int season, String id) =>
            driverProfileFixture(season: season, driverId: id),
      );
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _tallSurface,
        currentSeason: 2024,
        drivers: drivers,
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();

      expect(drivers.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'max-verstappen', season: 2024),
      ]);
    });
  });

  group('scroll preservation', () {
    Future<double> offset(WidgetTester tester) async =>
        scrollOffsetOf(tester, ExploreScreen);

    testWidgets('each category keeps an independent offset', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _shortSurface,
        drivers: FakeDriverRepository(
          cards: (int s) => _longDrivers(season: s),
        ),
        constructors: FakeConstructorRepository(
          cards: (int s) => _longTeams(season: s),
        ),
        circuits: FakeCircuitRepository(
          cards: (int s) => _longCircuits(season: s),
        ),
      );

      await tester.drag(find.byType(ListView).last, const Offset(0, -220));
      await tester.pumpAndSettle();
      final double driversOffset = await offset(tester);
      expect(driversOffset, greaterThan(0));

      await tester.tap(find.text('Teams'));
      await tester.pumpAndSettle();
      expect(await offset(tester), 0, reason: 'a fresh list starts at the top');

      await tester.drag(find.byType(ListView).last, const Offset(0, -120));
      await tester.pumpAndSettle();
      final double teamsOffset = await offset(tester);
      expect(teamsOffset, greaterThan(0));

      await tester.tap(find.text('Drivers'));
      await tester.pumpAndSettle();
      expect(await offset(tester), closeTo(driversOffset, 1));

      await tester.tap(find.text('Teams'));
      await tester.pumpAndSettle();
      expect(await offset(tester), closeTo(teamsOffset, 1));
    });

    testWidgets('a detail round trip restores the originating offset', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _shortSurface,
        circuits: FakeCircuitRepository(
          cards: (int s) => _longCircuits(season: s),
          profile: (int s, String id) =>
              circuitProfileFixture(season: s, circuitId: id),
        ),
      );

      await tester.drag(find.byType(ListView).last, const Offset(0, -200));
      await tester.pumpAndSettle();
      final double before = await offset(tester);
      expect(before, greaterThan(0));

      await tester.tap(find.text('Circuit 4'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(await offset(tester), closeTo(before, 1));
    });

    testWidgets('a bottom-branch switch preserves the category and offset', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _shortSurface,
        constructors: FakeConstructorRepository(
          cards: (int s) => _longTeams(season: s),
        ),
      );

      await tester.tap(find.text('Teams'));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).last, const Offset(0, -150));
      await tester.pumpAndSettle();
      final double before = await offset(tester);
      expect(before, greaterThan(0));

      await tapNav(tester, 'Home');
      await tapNav(tester, 'Explore');

      expect(shellLocation(router), '/explore/teams');
      expect(await offset(tester), closeTo(before, 1));
    });
  });
}
