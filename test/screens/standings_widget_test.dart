import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';
import 'package:intl/intl.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// A surface tall enough for the whole fixture table, so content assertions do
/// not depend on scroll position.
const Size _tallSurface = Size(400, 1200);

/// A short surface, so both tables genuinely overflow and can be scrolled.
const Size _shortSurface = Size(400, 500);

/// A full grid, so the lists are long enough to scroll independently.
List<DriverStandingEntry> _fullGrid() => <DriverStandingEntry>[
  for (int i = 0; i < 20; i++)
    driverStandingEntry(
      order: i,
      position: i + 1,
      driverId: 'driver-${i + 1}',
      driverName: 'Driver ${i + 1}',
      constructorId: 'team-${(i ~/ 2) + 1}',
      constructorName: 'Team ${(i ~/ 2) + 1}',
      points: (20 - i) * 10,
      wins: i == 0 ? 5 : 0,
    ),
];

List<ConstructorStandingEntry> _fullTeams() => <ConstructorStandingEntry>[
  for (int i = 0; i < 10; i++)
    constructorStandingEntry(
      order: i,
      position: i + 1,
      constructorId: 'team-${i + 1}',
      seasonName: 'Team ${i + 1} Racing',
      points: (10 - i) * 25,
      wins: i == 0 ? 9 : 0,
    ),
];

FakeStandingsRepository _longTables() => FakeStandingsRepository(
  drivers: (int season) => _fullGrid(),
  constructors: (int season) => _fullTeams(),
);

/// The freshness caption the screen renders for [instant], formatted through the
/// same local-time conversion so the expectation is host-zone independent.
String _updatedLabel(DateTime instant) =>
    'Updated ${DateFormat.Hm('en').format(instant.toLocal())}';

double _tableOffset(WidgetTester tester) {
  final Finder scrollable = find
      .descendant(
        of: find.byType(StandingsScreen),
        matching: find.byType(Scrollable),
      )
      .last;
  return tester.state<ScrollableState>(scrollable).position.pixels;
}

Future<void> _selectConstructors(WidgetTester tester) async {
  await tester.tap(find.text('Constructors'));
  await tester.pumpAndSettle();
}

Future<void> _selectDrivers(WidgetTester tester) async {
  await tester.tap(find.text('Drivers'));
  await tester.pumpAndSettle();
}

void main() {
  group('loading, empty and error states', () {
    testWidgets('an unmaterialized table shows the structured skeleton', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        // The skeleton shimmer is a perpetual animation; reduced motion keeps
        // the frame deterministic.
        disableAnimations: true,
        // No resource metadata at all and no accepted bootstrap.
        syncMetadata: (String key) => null,
        standings: FakeStandingsRepository(
          drivers: (int season) => const <DriverStandingEntry>[],
          constructors: (int season) => const <ConstructorStandingEntry>[],
        ),
      );
      expect(find.byType(GvSkeletonBlock), findsWidgets);
      expect(find.byType(GvEmptyState), findsNothing);
      expect(find.byType(GvErrorState), findsNothing);
      // The selector stays usable while loading.
      expect(find.byType(GvSegmentedControl), findsOneWidget);
    });

    testWidgets('a materialized empty drivers table shows a real empty state', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        standings: FakeStandingsRepository(
          drivers: (int season) => const <DriverStandingEntry>[],
          constructors: (int season) => constructorStandingsFixture(),
        ),
      );
      expect(find.text("No drivers' standings yet"), findsOneWidget);
      expect(find.byType(GvSkeletonBlock), findsNothing);
      expect(find.byType(GvErrorState), findsNothing);
    });

    testWidgets(
      'a materialized empty constructors table shows a real empty state',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/standings/constructors/2026',
          standings: FakeStandingsRepository(
            drivers: (int season) => driverStandingsFixture(),
            constructors: (int season) => const <ConstructorStandingEntry>[],
          ),
        );
        expect(find.text("No constructors' standings yet"), findsOneWidget);
        expect(find.byType(GvSkeletonBlock), findsNothing);
      },
    );

    testWidgets('bootstrap-materialized empty renders empty, not loading', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        // Only bootstrap succeeded, for this exact season.
        syncMetadata: (String key) =>
            key == 'bootstrap' ? syncedMetadata(key) : null,
        standings: FakeStandingsRepository(
          drivers: (int season) => const <DriverStandingEntry>[],
          constructors: (int season) => const <ConstructorStandingEntry>[],
        ),
      );
      expect(find.text("No drivers' standings yet"), findsOneWidget);
      expect(find.byType(GvSkeletonBlock), findsNothing);
      await _selectConstructors(tester);
      expect(find.text("No constructors' standings yet"), findsOneWidget);
    });

    testWidgets('bootstrap-only rows claim no update time', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        syncMetadata: (String key) =>
            key == 'bootstrap' ? syncedMetadata(key) : null,
      );
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.textContaining('Updated'), findsNothing);
      expect(find.byType(GvOfflineNotice), findsNothing);
    });

    testWidgets('a drivers first-load failure shows a section-level error', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2024',
        disableAnimations: true,
        syncMetadata: (String key) => null,
        standings: FakeStandingsRepository(
          drivers: (int season) => const <DriverStandingEntry>[],
          constructors: (int season) => const <ConstructorStandingEntry>[],
          onRefreshDrivers: (int season) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          ),
        ),
      );
      // A manual attempt on a table with no local representation produces the
      // first-load error state.
      await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
      await tester.pumpAndSettle();

      expect(find.byType(GvErrorState), findsOneWidget);
      expect(find.text("Can't load the drivers' standings"), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      // The application shell and the selector remain usable.
      expect(find.byType(GvSegmentedControl), findsOneWidget);
      expect(find.text('Standings'), findsWidgets);
    });

    testWidgets('a constructors first-load failure is scoped to that table', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2024',
        disableAnimations: true,
        syncMetadata: (String key) => null,
        standings: FakeStandingsRepository(
          drivers: (int season) => const <DriverStandingEntry>[],
          constructors: (int season) => const <ConstructorStandingEntry>[],
          onRefreshConstructors: (int season) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          ),
        ),
      );
      await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
      await tester.pumpAndSettle();

      expect(
        find.text("Can't load the constructors' standings"),
        findsOneWidget,
      );
      expect(find.text("Can't load the drivers' standings"), findsNothing);
    });
  });

  group('populated tables', () {
    testWidgets(
      'the drivers table renders positions, names, teams and points',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/standings',
          surfaceSize: _tallSurface,
        );

        expect(find.text('Max Verstappen'), findsOneWidget);
        expect(find.text('2026 season'), findsOneWidget);
        // Team name and wins share the row's secondary line.
        expect(find.text('Red Bull Racing · 6 wins'), findsOneWidget);
        // Integer points drop the meaningless decimal; fractions survive.
        expect(find.text('241'), findsOneWidget);
        expect(find.text('232.5'), findsOneWidget);
        // A confirmed zero is shown as zero.
        expect(find.text('0'), findsWidgets);
        // A confirmed zero wins is shown, not hidden.
        expect(find.text('Ferrari · 0 wins'), findsOneWidget);
        // No placeholder content remains.
        expect(find.text('Alex Driver'), findsNothing);
        expect(find.text('Scuderia Rossa'), findsNothing);
      },
    );

    testWidgets('an unranked row shows an em dash, never a zero position', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(find.text('Reserve Entrant'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
      // Its accessible meaning is explicit rather than silent.
      expect(
        find.bySemanticsLabel(RegExp('Position unavailable, Reserve Entrant')),
        findsOneWidget,
      );
    });

    testWidgets('a row with no team leaves no dangling separator', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      // The reserve entrant has no constructor and no statistics at all.
      expect(find.textContaining(' · '), findsWidgets);
      expect(find.text(' · '), findsNothing);
    });

    testWidgets('the constructors table uses season branding', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2026',
        surfaceSize: _tallSurface,
      );
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
      expect(find.text('460.5'), findsOneWidget);
      // A team with no season branding falls back to its stable name.
      expect(find.text('Ferrari'), findsOneWidget);
    });

    testWidgets('leader emphasis comes from a confirmed position 1 only', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            // Delivered first but *not* position 1, and with the most points.
            driverStandingEntry(
              order: 0,
              driverId: 'unranked-top',
              driverName: 'Unranked Top',
              points: 999,
            ),
            driverStandingEntry(
              order: 1,
              position: 1,
              driverId: 'real-leader',
              driverName: 'Real Leader',
              points: 10,
            ),
          ],
        ),
      );
      expect(
        find.bySemanticsLabel(RegExp('Real Leader.*Championship leader')),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel(RegExp('Unranked Top.*leader')),
        findsNothing,
      );
    });

    testWidgets('several confirmed leaders are announced as tied', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'tied-a',
              driverName: 'Tied A',
              points: 100,
            ),
            driverStandingEntry(
              order: 1,
              position: 1,
              driverId: 'tied-b',
              driverName: 'Tied B',
              points: 100,
            ),
          ],
        ),
      );
      expect(
        find.bySemanticsLabel(RegExp('Tied for the championship lead')),
        findsNWidgets(2),
      );
      // Duplicate displayed positions stay duplicated.
      expect(find.text('1'), findsNWidgets(2));
    });

    testWidgets('rows keep their delivered order', (WidgetTester tester) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 9,
              driverId: 'first-delivered',
              driverName: 'First Delivered',
              points: 1,
            ),
            driverStandingEntry(
              order: 1,
              position: 1,
              driverId: 'second-delivered',
              driverName: 'Second Delivered',
              points: 500,
            ),
          ],
        ),
      );
      final double first = tester.getTopLeft(find.text('First Delivered')).dy;
      final double second = tester.getTopLeft(find.text('Second Delivered')).dy;
      expect(first, lessThan(second));
    });
  });

  group('unresolved identities', () {
    testWidgets('an unresolved identity shows the localized fallback', (
      WidgetTester tester,
    ) async {
      // The identity behind the standing has not synchronised yet, so the read
      // model carries no name at all.
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'unsynced-driver',
              driverName: null,
              constructorId: 'unsynced-team',
              points: 25,
            ),
          ],
          constructors: (int season) => <ConstructorStandingEntry>[
            constructorStandingEntry(
              order: 0,
              position: 1,
              constructorId: 'unsynced-team',
              points: 25,
            ),
          ],
        ),
      );

      expect(find.text('Name unavailable'), findsOneWidget);
      // Never the identifier, and never anything humanised from it.
      expect(find.text('unsynced-driver'), findsNothing);
      expect(find.text('Unsynced Driver'), findsNothing);
      expect(find.textContaining('unsynced'), findsNothing);
      // The row still announces its position and points.
      expect(
        find.bySemanticsLabel(
          'Position 1, Name unavailable, 25 points, Championship leader',
        ),
        findsOneWidget,
      );

      // The same holds for the constructors' table.
      await _selectConstructors(tester);
      expect(find.text('Name unavailable'), findsOneWidget);
      expect(find.text('unsynced-team'), findsNothing);
      expect(find.text('Unsynced Team'), findsNothing);
    });

    testWidgets('an unresolved team leaves the row without a team line', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'known-driver',
              driverName: 'Known Driver',
              constructorId: 'unsynced-team',
              points: 25,
              wins: 1,
            ),
          ],
        ),
      );
      expect(find.text('Known Driver'), findsOneWidget);
      // Wins render; the unavailable team contributes nothing and leaves no
      // dangling separator.
      expect(find.text('1 win'), findsOneWidget);
      expect(find.textContaining('unsynced'), findsNothing);
    });

    testWidgets('a driver row still navigates by its stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'unsynced-driver',
              driverName: null,
              points: 25,
            ),
          ],
        ),
      );
      await tester.tap(find.text('Name unavailable'));
      await tester.pumpAndSettle();

      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'unsynced-driver',
        reason: 'identity and routing survive an unavailable name',
      );
    });
  });

  group('provisional', () {
    testWidgets('rows that all agree show one section-level notice', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'a',
              driverName: 'Row A',
              points: 10,
              provisional: true,
            ),
            driverStandingEntry(
              order: 1,
              position: 2,
              driverId: 'b',
              driverName: 'Row B',
              points: 5,
              provisional: true,
            ),
          ],
        ),
      );
      expect(
        find.text('These standings are provisional and may still change.'),
        findsOneWidget,
      );
      // No repeated chip on every row.
      expect(find.text('Provisional'), findsNothing);
    });

    testWidgets('disagreeing rows are marked individually', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: FakeStandingsRepository(
          drivers: (int season) => <DriverStandingEntry>[
            driverStandingEntry(
              order: 0,
              position: 1,
              driverId: 'a',
              driverName: 'Row A',
              points: 10,
              provisional: true,
            ),
            driverStandingEntry(
              order: 1,
              position: 2,
              driverId: 'b',
              driverName: 'Row B',
              points: 5,
              provisional: false,
            ),
          ],
        ),
      );
      // No false global claim…
      expect(
        find.text('These standings are provisional and may still change.'),
        findsNothing,
      );
      // …and row-level correctness is retained.
      expect(find.textContaining('Provisional'), findsOneWidget);
    });

    testWidgets('a null provisional flag claims nothing', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(
        find.text('These standings are provisional and may still change.'),
        findsNothing,
      );
      expect(find.text('Provisional'), findsNothing);
    });
  });

  group('freshness and failure scoping', () {
    testWidgets("the selected table's own update time is shown", (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        syncMetadata: (String key) => switch (key) {
          'standings:drivers:2026' => syncedMetadata(
            key,
            lastSuccessAt: DateTime.utc(2026, 7, 18, 9, 5),
          ),
          'standings:constructors:2026' => syncedMetadata(
            key,
            lastSuccessAt: DateTime.utc(2026, 7, 18, 11, 45),
          ),
          _ => syncedMetadata(key),
        },
      );
      // Formatted through the same local-time conversion as the screen, so the
      // assertion never depends on the host machine's time zone.
      final String driversTime = _updatedLabel(DateTime.utc(2026, 7, 18, 9, 5));
      final String constructorsTime = _updatedLabel(
        DateTime.utc(2026, 7, 18, 11, 45),
      );
      expect(find.text(driversTime), findsOneWidget);
      expect(find.text(constructorsTime), findsNothing);

      // Switching the selector immediately switches the freshness context.
      await _selectConstructors(tester);
      expect(find.text(constructorsTime), findsOneWidget);
      expect(find.text(driversTime), findsNothing);
    });

    testWidgets('a stale selected table shows a cached-data notice', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        syncMetadata: (String key) =>
            syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
      );
      expect(find.byType(GvOfflineNotice), findsOneWidget);
      expect(
        find.text(
          'This data may be out of date — showing the last saved version.',
        ),
        findsOneWidget,
      );
      // The rows stay visible.
      expect(find.text('Max Verstappen'), findsOneWidget);
    });

    testWidgets('a failed refresh keeps the rows and stays non-blocking', (
      WidgetTester tester,
    ) async {
      final FakeStandingsRepository repo = FakeStandingsRepository(
        drivers: (int season) => driverStandingsFixture(),
        constructors: (int season) => constructorStandingsFixture(),
        onRefreshDrivers: (int season) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2024',
        surfaceSize: _tallSurface,
        standings: repo,
      );

      await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
      await tester.pumpAndSettle();

      expect(find.byType(GvErrorState), findsNothing);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(
        find.text("Couldn't refresh — showing saved data."),
        findsOneWidget,
      );
    });
  });

  group('selector', () {
    testWidgets('Drivers is selected on the first root visit', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsNothing);
    });

    testWidgets('switching the selector issues no request', (
      WidgetTester tester,
    ) async {
      final FakeStandingsRepository repo = _longTables();
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        standings: repo,
      );
      expect(repo.driversRefreshCount, 0);
      expect(repo.constructorsRefreshCount, 0);

      await _selectConstructors(tester);
      await _selectDrivers(tester);
      await _selectConstructors(tester);

      expect(repo.driversRefreshCount, 0);
      expect(repo.constructorsRefreshCount, 0);
    });

    testWidgets('the selection survives a branch switch', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await _selectConstructors(tester);
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);

      await tapNav(tester, 'Home');
      await tapNav(tester, 'Standings');
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
      expect(find.text('Max Verstappen'), findsNothing);
    });

    testWidgets('the selection survives a detail round trip', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await _selectConstructors(tester);

      await tester.tap(find.text('McLaren Formula 1 Team'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
    });

    testWidgets('repeated taps do not stack routes or reset the list', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        standings: _longTables(),
      );
      await tester.drag(find.byType(ListView), const Offset(0, -200));
      await tester.pumpAndSettle();
      final double scrolled = _tableOffset(tester);
      expect(scrolled, greaterThan(0));

      await _selectDrivers(tester);
      await _selectDrivers(tester);

      expect(shellLocation(router), '/standings');
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(_tableOffset(tester), closeTo(scrolled, 0.5));
    });

    testWidgets('a fresh application session defaults back to Drivers', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await _selectConstructors(tester);
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);

      // A new application session. The tree is torn down first so the provider
      // scope really is recreated — nothing about the selection is persisted to
      // disk in Phase 7B, so the new session must start at Drivers.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('McLaren Formula 1 Team'), findsNothing);
    });
  });

  group('scroll preservation', () {
    testWidgets('the two tables keep independent offsets', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        standings: _longTables(),
      );

      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      final double drivers = _tableOffset(tester);
      expect(drivers, greaterThan(0));

      await _selectConstructors(tester);
      // The other table starts at the top of its own authoritative order.
      expect(_tableOffset(tester), 0);
      await tester.drag(find.byType(ListView), const Offset(0, -120));
      await tester.pumpAndSettle();
      final double constructors = _tableOffset(tester);
      expect(constructors, greaterThan(0));
      expect(constructors, isNot(closeTo(drivers, 1)));

      // Switching back restores each table's own position.
      await _selectDrivers(tester);
      expect(_tableOffset(tester), closeTo(drivers, 0.5));
      await _selectConstructors(tester);
      expect(_tableOffset(tester), closeTo(constructors, 0.5));
    });

    testWidgets('a branch switch preserves both offsets', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        standings: _longTables(),
      );
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      final double drivers = _tableOffset(tester);

      await _selectConstructors(tester);
      await tester.drag(find.byType(ListView), const Offset(0, -100));
      await tester.pumpAndSettle();
      final double constructors = _tableOffset(tester);

      await tapNav(tester, 'Calendar');
      await tapNav(tester, 'Standings');

      expect(_tableOffset(tester), closeTo(constructors, 0.5));
      await _selectDrivers(tester);
      expect(_tableOffset(tester), closeTo(drivers, 0.5));
    });

    testWidgets('returning from a Driver detail restores the Drivers offset', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        standings: _longTables(),
      );
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      final double before = _tableOffset(tester);

      await tester.tap(find.text('Driver 8').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(_tableOffset(tester), closeTo(before, 0.5));
    });

    testWidgets(
      'returning from a Constructor detail restores the Constructors offset',
      (WidgetTester tester) async {
        await pumpApp(
          tester,
          initialLocation: '/standings',
          surfaceSize: _shortSurface,
          standings: _longTables(),
        );
        await _selectConstructors(tester);
        await tester.drag(find.byType(ListView), const Offset(0, -150));
        await tester.pumpAndSettle();
        final double before = _tableOffset(tester);
        expect(before, greaterThan(0));

        await tester.tap(find.text('Team 4 Racing').first);
        await tester.pumpAndSettle();
        expect(find.byType(ConstructorDetailScreen), findsOneWidget);

        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(_tableOffset(tester), closeTo(before, 0.5));
      },
    );

    testWidgets('a local stream emission does not reset the list', (
      WidgetTester tester,
    ) async {
      final StreamController<List<DriverStandingEntry>> controller =
          StreamController<List<DriverStandingEntry>>.broadcast();
      addTearDown(controller.close);

      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        // The table starts unmaterialized (the stream has not emitted), so the
        // skeleton shimmer must not keep the frame busy.
        disableAnimations: true,
        standings: FakeStandingsRepository(
          driversStream: (int season) => controller.stream,
          constructors: (int season) => _fullTeams(),
        ),
      );
      controller.add(_fullGrid());
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView), const Offset(0, -250));
      await tester.pumpAndSettle();
      final double before = _tableOffset(tester);
      expect(before, greaterThan(0));

      // A later emission of the same table.
      controller.add(_fullGrid());
      await tester.pumpAndSettle();
      expect(_tableOffset(tester), closeTo(before, 0.5));
    });
  });

  group('navigation', () {
    testWidgets('a driver row opens the driver by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();

      expect(find.byType(DriverDetailScreen), findsOneWidget);
      // The stable GridView id, never the display name.
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'max-verstappen',
      );
    });

    testWidgets('a constructor row opens the constructor by stable id', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2026',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('McLaren Formula 1 Team'));
      await tester.pumpAndSettle();

      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      // The stable id, never the season display name.
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'mclaren',
      );
    });

    testWidgets('system back returns to the Standings branch', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(shellLocation(router), '/standings');
    });
  });

  group('manual refresh', () {
    testWidgets('pull-to-refresh runs the manual core refresh once', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _shortSurface,
        standings: _longTables(),
        onManualRefresh: () async => calls++,
      );

      await tester.fling(find.byType(ListView), const Offset(0, 320), 1000);
      await tester.pumpAndSettle();

      expect(calls, 1);
      // The rows were never replaced by a loader.
      expect(find.text('Driver 1'), findsOneWidget);
    });

    testWidgets('the app-bar action runs the manual core refresh once', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        onManualRefresh: () async => calls++,
      );
      await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
      await tester.pumpAndSettle();
      expect(calls, 1);
    });

    testWidgets('a historical route refreshes only the selected championship', (
      WidgetTester tester,
    ) async {
      final FakeStandingsRepository repo = _longTables();
      int core = 0;
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2024',
        surfaceSize: _tallSurface,
        standings: repo,
        onManualRefresh: () async => core++,
      );
      await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
      await tester.pumpAndSettle();

      expect(repo.driverRefreshSeasons, <int>[2024]);
      expect(repo.constructorRefreshSeasons, isEmpty);
      expect(core, 0, reason: 'no current-season core run for a past season');
    });
  });

  group('accessibility', () {
    testWidgets('a row announces position, name, team, points and wins', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(
        find.bySemanticsLabel(
          'Position 1, Max Verstappen, Red Bull Racing, 241 points, 6 wins, '
          'Championship leader',
        ),
        findsOneWidget,
      );
    });

    testWidgets('the selector exposes selected semantics', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel('Drivers').first),
        isSemantics(isSelected: true, isButton: true),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel('Constructors').first),
        isSemantics(isSelected: false),
      );

      await _selectConstructors(tester);
      expect(
        tester.getSemantics(find.bySemanticsLabel('Constructors').first),
        isSemantics(isSelected: true, isButton: true),
      );
    });

    testWidgets('the refresh action has an explicit label', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      expect(find.bySemanticsLabel('Refresh standings'), findsOneWidget);
    });

    testWidgets('interactive targets are at least 48 logical pixels', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
      );
      for (final Element element
          in find.byType(GvStandingsRow).evaluate().toList()) {
        expect(
          tester.getSize(find.byWidget(element.widget)).height,
          greaterThanOrEqualTo(48),
        );
      }
      final Finder segment = find.text('Constructors');
      expect(tester.getSize(segment).height, greaterThan(0));
      expect(
        tester
            .getSize(
              find
                  .ancestor(of: segment, matching: find.byType(ConstrainedBox))
                  .first,
            )
            .height,
        greaterThanOrEqualTo(48),
      );
    });

    testWidgets('a large text scale keeps position, name and points visible', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        textScale: 2.0,
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('241'), findsOneWidget);
      expect(find.text('1'), findsWidgets);
    });

    testWidgets('Spanish copy and decimal comma render without overflow', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings',
        surfaceSize: _tallSurface,
        locale: const Locale('es'),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Clasificaciones'), findsWidgets);
      expect(find.text('Pilotos'), findsWidgets);
      // Locale-aware decimals: a comma in Spanish.
      expect(find.text('232,5'), findsOneWidget);
      expect(find.text('Red Bull Racing · 6 victorias'), findsOneWidget);
    });
  });
}
