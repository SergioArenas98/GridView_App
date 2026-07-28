import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/standings/application/standings_state.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/router_harness.dart';

const Size _tallSurface = Size(400, 2400);

/// No resource has ever synchronised, so nothing is materialized and a profile
/// that is nonetheless present is a **partial**, collection-derived one.
ResourceSyncState? _neverSynced(String key) => null;

void main() {
  group('driver detail', () {
    testWidgets('renders a complete profile with no placeholder data', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
      );

      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(find.text('Max Verstappen'), findsWidgets);
      expect(find.text('Oracle Red Bull Racing'), findsWidgets);
      expect(find.text('Dutch'), findsWidgets);
      expect(find.text('Hasselt, Belgium'), findsOneWidget);
      // Fractional points survive.
      expect(find.text('402.5'), findsOneWidget);
      expect(find.text('7'), findsWidgets);

      // The technical identifier field is gone.
      expect(find.text('Identifier'), findsNothing);
      expect(find.textContaining('max-verstappen'), findsNothing);
      expect(find.text('Profile placeholder'), findsNothing);
    });

    testWidgets('a partial profile renders without claiming detail freshness', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        syncMetadata: _neverSynced,
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
        ),
      );

      expect(find.text('Max Verstappen'), findsWidgets);
      expect(
        find.text('Some profile information is unavailable'),
        findsOneWidget,
      );
      // No empty cards for sections that are genuinely unknown.
      expect(find.text('Profile'), findsNothing);
      expect(find.text('About'), findsNothing);
      expect(find.text('Championship'), findsNothing);
    });

    testWidgets('a missing biography, birth data and standing stay hidden', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/lando-norris',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) => driverProfileFixture(
            season: s,
            driverId: id,
            name: 'Lando Norris',
            biography: null,
            dateOfBirth: null,
            placeOfBirth: null,
            nationality: null,
            permanentNumber: null,
            withStanding: false,
          ),
        ),
      );

      expect(find.text('Lando Norris'), findsWidgets);
      expect(find.text('About'), findsNothing);
      expect(find.text('Date of birth'), findsNothing);
      expect(find.text('Championship'), findsNothing);
      // The screen is still useful: participation is present.
      expect(find.text('Season participation'), findsOneWidget);
    });

    testWidgets(
      'no team association shows no team section or fabricated name',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/drivers/unaffiliated',
          surfaceSize: _tallSurface,
          drivers: FakeDriverRepository(
            profile: (int s, String id) => driverProfileFixture(
              season: s,
              driverId: id,
              name: 'Unaffiliated Entrant',
              participations: <DriverParticipation>[
                participation(
                  season: s,
                  driverId: id,
                  constructorId: 'not-synced-team',
                ),
              ],
              withStanding: false,
            ),
          ),
        );

        expect(find.text('Unaffiliated Entrant'), findsWidgets);
        expect(find.textContaining('not-synced-team'), findsNothing);
        expect(find.text('Team unavailable'), findsOneWidget);
      },
    );

    testWidgets('mid-season spans are both shown, never flattened', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/franco-colapinto',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) => driverProfileFixture(
            season: s,
            driverId: id,
            name: 'Franco Colapinto',
            participations: <DriverParticipation>[
              participation(
                season: s,
                driverId: id,
                constructorId: 'alpine',
                teamName: 'BWT Alpine Formula One Team',
                startRound: 7,
              ),
              participation(
                season: s,
                driverId: id,
                constructorId: 'williams',
                teamName: 'Williams Racing',
                endRound: 6,
                entryId: 'span-2',
              ),
            ],
            withStanding: false,
          ),
        ),
      );

      expect(find.text('BWT Alpine Formula One Team'), findsWidgets);
      expect(find.text('Williams Racing'), findsOneWidget);
      expect(find.text('From round 7'), findsWidgets);
      expect(find.text('Until round 6'), findsOneWidget);
    });

    testWidgets('a reserve role reads as a localized role, never blank', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/reserve',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) => driverProfileFixture(
            season: s,
            driverId: id,
            name: 'Reserve Entrant',
            participations: <DriverParticipation>[
              participation(
                season: s,
                driverId: id,
                constructorId: 'alpine',
                teamName: 'BWT Alpine Formula One Team',
                role: DriverRole.reserve,
              ),
            ],
            withStanding: false,
          ),
        ),
      );
      expect(find.text('Reserve driver'), findsOneWidget);
    });

    testWidgets(
      'an unranked entrant with zero statistics shows no false zero',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/drivers/zero',
          surfaceSize: _tallSurface,
          drivers: FakeDriverRepository(
            profile: (int s, String id) => driverProfileFixture(
              season: s,
              driverId: id,
              name: 'Zero Points',
              standing: DriverStanding(
                season: s,
                driverId: id,
                points: 0,
                wins: 0,
              ),
            ),
          ),
        );

        expect(find.text('Unranked'), findsOneWidget);
        expect(
          find.text('0'),
          findsWidgets,
          reason: 'a confirmed zero is shown',
        );
        // Podiums was never supplied, so it is absent rather than zero.
        expect(find.text('Podiums'), findsNothing);
      },
    );

    testWidgets('a definitive not-found renders a controlled state', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/ghost',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          onRefreshDetail: (String id, int s) async =>
              const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
        ),
      );
      expect(find.text('Not available'), findsOneWidget);
      expect(find.textContaining('ghost'), findsNothing);
    });

    testWidgets('a 404 with a real summary keeps the content visible', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
          onRefreshDetail: (String id, int s) async =>
              const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
        ),
      );
      expect(find.text('Max Verstappen'), findsWidgets);
      expect(
        find.text('Some profile information is unavailable'),
        findsOneWidget,
      );
      expect(find.text('Not available'), findsNothing);
    });

    testWidgets('a transient failure with no content offers a retry', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        onRefreshDetail: (String id, int s) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      await pumpApp(
        tester,
        initialLocation: '/drivers/someone',
        surfaceSize: _tallSurface,
        drivers: drivers,
      );
      expect(find.text("Can't load this profile"), findsOneWidget);
      expect(drivers.detailRefreshCount, 1);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(drivers.detailRefreshCount, 2);
    });

    testWidgets('a non-blocking failure keeps cached content visible', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              driverProfileFixture(season: s, driverId: id),
          onRefreshDetail: (String id, int s) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.networkUnavailable),
          ),
        ),
      );
      expect(find.text('Max Verstappen'), findsWidgets);
      expect(find.text('Update failed'), findsOneWidget);
    });

    testWidgets('the hero name is a semantic heading', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
      );
      expect(
        tester
            .getSemantics(find.text('Max Verstappen').first)
            .getSemanticsData()
            .flagsCollection
            .isHeader,
        isTrue,
      );
    });

    testWidgets('large text does not break the layout', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        textScale: 2.0,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('team detail', () {
    testWidgets('renders season branding, facts and the derived line-up', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/alpine',
        surfaceSize: _tallSurface,
      );

      expect(find.text('BWT Alpine Formula One Team'), findsWidgets);
      expect(
        find.textContaining('Alpine'),
        findsWidgets,
        reason: 'the stable identity remains visible as a fallback',
      );
      expect(find.text('Renault'), findsOneWidget);
      expect(find.text('Enstone, United Kingdom'), findsOneWidget);
      expect(find.text('A526'), findsOneWidget);

      // The line-up, with both mid-season spans representable.
      expect(find.text('Pierre Gasly'), findsOneWidget);
      expect(find.text('Jack Doohan'), findsOneWidget);
      expect(find.text('Franco Colapinto'), findsOneWidget);
      expect(find.textContaining('Until round 6'), findsOneWidget);
      expect(find.textContaining('From round 7'), findsOneWidget);

      expect(find.text('Identifier'), findsNothing);
      expect(find.textContaining('alpine'), findsNothing);
    });

    testWidgets('a partial team profile hides empty fact cards', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/alpine',
        surfaceSize: _tallSurface,
        syncMetadata: _neverSynced,
        constructors: FakeConstructorRepository(
          profile: (int s, String id) =>
              partialTeamProfileFixture(season: s, constructorId: id),
        ),
      );
      expect(find.text('BWT Alpine Formula One Team'), findsWidgets);
      expect(find.text('Team details'), findsNothing);
      expect(find.text('Drivers'), findsNothing);
      expect(
        find.text('Some profile information is unavailable'),
        findsOneWidget,
      );
    });

    testWidgets('an incomplete line-up never invents a name', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/alpine',
        surfaceSize: _tallSurface,
        constructors: FakeConstructorRepository(
          profile: (int s, String id) => teamProfileFixture(
            season: s,
            constructorId: id,
            lineup: const <TeamLineupMember>[],
          ),
        ),
      );
      expect(find.text('Drivers'), findsNothing);
      expect(find.textContaining('Not Synced'), findsNothing);
    });

    testWidgets('a line-up row opens the driver by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/alpine',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Pierre Gasly'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets('the standings action carries the exact season', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/constructors/alpine',
        surfaceSize: _tallSurface,
        currentSeason: 2024,
      );
      await tester.tap(find.text("View constructors' standings"));
      await tester.pumpAndSettle();

      final StandingsScreen standings = tester.widget<StandingsScreen>(
        find.byType(StandingsScreen),
      );
      expect(standings.season, 2024, reason: 'the exact origin season travels');
      expect(standings.championship, StandingsChampionship.constructors);
    });
  });

  group('circuit detail', () {
    testWidgets('renders physical facts, the lap record and the event', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/spa-francorchamps',
        surfaceSize: _tallSurface,
      );

      expect(find.text('Circuit de Spa-Francorchamps'), findsWidgets);
      expect(find.text('Stavelot, Belgium'), findsOneWidget);
      expect(find.text('7.004 km'), findsOneWidget);
      expect(find.text('19'), findsWidgets);
      expect(find.text('Clockwise'), findsOneWidget);
      expect(find.text('1950'), findsOneWidget);
      expect(find.text('1:46.286'), findsOneWidget);
      expect(find.text('Valtteri Bottas'), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);

      expect(find.text('Identifier'), findsNothing);
      expect(find.textContaining('spa-francorchamps'), findsNothing);
    });

    testWidgets('a missing lap-record driver uses localized copy, not an id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/monza',
        surfaceSize: _tallSurface,
        circuits: FakeCircuitRepository(
          profile: (int s, String id) => circuitProfileFixture(
            season: s,
            circuitId: id,
            name: 'Autodromo Nazionale Monza',
            lapRecordDriverName: null,
          ),
        ),
      );
      expect(find.text('Driver unavailable'), findsOneWidget);
      expect(find.textContaining('valtteri-bottas'), findsNothing);
    });

    testWidgets('an unknown direction uses a safe localized fallback', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/monza',
        surfaceSize: _tallSurface,
        circuits: FakeCircuitRepository(
          profile: (int s, String id) => circuitProfileFixture(
            season: s,
            circuitId: id,
            direction: CircuitDirection.unknown,
          ),
        ),
      );
      expect(find.text('Direction unavailable'), findsOneWidget);
    });

    testWidgets('an unnamed related event uses localized unavailable copy', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/monza',
        surfaceSize: _tallSurface,
        circuits: FakeCircuitRepository(
          profile: (int s, String id) => circuitProfileFixture(
            season: s,
            circuitId: id,
            related: relatedGrandPrix(season: s, name: null),
          ),
        ),
      );
      expect(find.text('Grand Prix name unavailable'), findsOneWidget);
      // Never the Phase 3 skeleton placeholder, and never the identifier.
      expect(find.text('Profile placeholder'), findsNothing);
      expect(find.textContaining('spa-francorchamps'), findsNothing);
    });

    testWidgets('no related event this season is a valid state', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/monza',
        surfaceSize: _tallSurface,
        circuits: FakeCircuitRepository(
          profile: (int s, String id) => circuitProfileFixture(
            season: s,
            circuitId: id,
            withRelated: false,
          ),
        ),
      );
      expect(find.text('No Grand Prix this season'), findsOneWidget);
      expect(find.text('Not available'), findsNothing);
    });

    testWidgets('missing physical facts hide the card entirely', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/monza',
        surfaceSize: _tallSurface,
        circuits: FakeCircuitRepository(
          profile: (int s, String id) => circuitProfileFixture(
            season: s,
            circuitId: id,
            lengthMeters: null,
            cornerCount: null,
            direction: null,
            firstGrandPrixYear: null,
            withLapRecord: false,
          ),
        ),
      );
      expect(find.text('Circuit facts'), findsNothing);
      expect(find.text('Lap record'), findsNothing);
      // The circuit is still useful.
      expect(find.text('Circuit de Spa-Francorchamps'), findsWidgets);
    });

    testWidgets('the related event opens the exact season and round', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/spa-francorchamps',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Belgian Grand Prix'));
      await tester.pumpAndSettle();

      final GrandPrixDetailScreen event = tester.widget<GrandPrixDetailScreen>(
        find.byType(GrandPrixDetailScreen),
      );
      expect(event.season, 2026);
      expect(
        event.round,
        13,
        reason: 'the exact related round, from local data',
      );
    });

    testWidgets('race distance and event laps never become circuit identity', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/circuits/spa-francorchamps',
        surfaceSize: _tallSurface,
      );
      // The circuit facts card carries length and corners, never a lap count.
      expect(find.text('Laps'), findsNothing);
    });
  });

  group('season context and on-demand ownership', () {
    testWidgets('a deep link resolves the local current season', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        profile: (int s, String id) =>
            driverProfileFixture(season: s, driverId: id),
      );
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        currentSeason: 2025,
        drivers: drivers,
      );
      expect(drivers.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'max-verstappen', season: 2025),
      ]);
    });

    testWidgets('with no resolvable season nothing is requested', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        profile: (int s, String id) =>
            driverProfileFixture(season: s, driverId: id),
      );
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        currentSeason: null,
        drivers: drivers,
      );
      expect(drivers.detailRefreshCount, 0);
      expect(find.text('Season unavailable'), findsOneWidget);
    });

    testWidgets('opening one detail refreshes nothing else', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = defaultFakeDrivers();
      final FakeConstructorRepository constructors = defaultFakeConstructors();
      final FakeCircuitRepository circuits = defaultFakeCircuits();
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        drivers: drivers,
        constructors: constructors,
        circuits: circuits,
      );

      expect(drivers.detailRefreshCount, 1);
      expect(drivers.collectionRefreshCount, 0);
      expect(constructors.detailRefreshCount, 0);
      expect(constructors.collectionRefreshCount, 0);
      expect(circuits.detailRefreshCount, 0);
      expect(circuits.collectionRefreshCount, 0);
    });

    testWidgets('local content renders before the refresh completes', (
      WidgetTester tester,
    ) async {
      final Completer<RefreshResult> gate = Completer<RefreshResult>();
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tallSurface,
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
          onRefreshDetail: (String id, int s) => gate.future,
        ),
      );
      // Rendering never waited for the request.
      expect(find.text('Max Verstappen'), findsWidgets);

      gate.complete(const RefreshSuccess());
      await tester.pumpAndSettle();
    });
  });
}
