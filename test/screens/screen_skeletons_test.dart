import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/a11y_harness.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

void main() {
  final List<(String, Type)> screens = <(String, Type)>[
    ('/', HomeScreen),
    ('/calendar', CalendarScreen),
    ('/calendar/2026/3', GrandPrixDetailScreen),
    ('/standings', StandingsScreen),
    ('/standings/drivers/2026', StandingsScreen),
    ('/standings/constructors/2026', StandingsScreen),
    ('/explore', ExploreScreen),
    ('/explore/drivers', ExploreScreen),
    ('/explore/teams', ExploreScreen),
    ('/explore/circuits', ExploreScreen),
    ('/drivers/a-driver', DriverDetailScreen),
    ('/constructors/scuderia-rossa', ConstructorDetailScreen),
    ('/circuits/northgate', CircuitDetailScreen),
    ('/settings', SettingsScreen),
  ];

  for (final (String location, Type type) in screens) {
    testWidgets('renders the skeleton at $location without errors', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: location);
      expect(find.byType(type), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  // A skeleton is decoration: a screen reader sees nothing at all unless the
  // loading state says so, and says it once. These screens are exactly the ones
  // that swap their whole content for repeated placeholder shapes, so a
  // per-shape announcement would be both silent-by-omission and deafening once
  // added naively.
  group('a loading screen announces itself exactly once', () {
    final List<(String, String)> loadingScreens = <(String, String)>[
      ('Home', '/'),
      ('Calendar', '/calendar'),
      ('Grand Prix', '/calendar/2026/3'),
      ('Standings', '/standings'),
      ('Explore drivers', '/explore/drivers'),
      ('Explore teams', '/explore/teams'),
      ('Explore circuits', '/explore/circuits'),
      ('Driver detail', '/drivers/a-driver'),
      ('Team detail', '/constructors/scuderia-rossa'),
      ('Circuit detail', '/circuits/northgate'),
    ];

    /// Nothing stored and nothing materialized, so every screen holds its
    /// genuine first-load frame. Reduced motion makes the pulsing placeholder
    /// static, so the frame settles instead of animating forever.
    Future<void> pumpLoading(
      WidgetTester tester,
      String location, {
      Locale locale = const Locale('en'),
    }) => pumpApp(
      tester,
      initialLocation: location,
      locale: locale,
      repository: FakeRaceWeekendRepository(),
      standings: FakeStandingsRepository(),
      drivers: FakeDriverRepository(),
      constructors: FakeConstructorRepository(),
      circuits: FakeCircuitRepository(),
      syncMetadata: (String key) => null,
      disableAnimations: true,
      surfaceSize: const Size(390, 1400),
    );

    for (final (String name, String location) in loadingScreens) {
      testWidgets('$name announces "Loading" once and nothing else repeats', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await pumpLoading(tester, location);

        expect(find.byType(GvLoadingSemantics), findsOneWidget);
        expect(
          labelOccurrences(tester, 'Loading'),
          1,
          reason: 'one announcement per screen, never one per skeleton shape',
        );
        handle.dispose();
      });

      testWidgets('$name announces the Spanish loading copy', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await pumpLoading(tester, location, locale: const Locale('es'));

        expect(labelOccurrences(tester, 'Cargando'), 1);
        expect(labelOccurrences(tester, 'Loading'), 0);
        handle.dispose();
      });
    }

    testWidgets('the skeleton shapes contribute no semantics of their own', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpLoading(tester, '/standings');

      // Six identical blocks; the announcement is the loading frame's, and the
      // blocks themselves are excluded rather than merely unlabelled.
      expect(find.byType(GvSkeletonBlock), findsWidgets);
      expect(
        renderedLabels(tester).where((String l) => l.contains('Loading')),
        hasLength(1),
      );
      handle.dispose();
    });
  });

  testWidgets('an unknown route renders the not-found skeleton', (
    WidgetTester tester,
  ) async {
    await pumpApp(tester, initialLocation: '/does/not/exist');
    expect(find.byType(NotFoundScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('an entity id with no local identity never displays the id', (
    WidgetTester tester,
  ) async {
    // No local identity yet, so the screen holds its loading state. Reduced
    // motion makes the design system's skeleton render static, so the test
    // settles deterministically instead of chasing a perpetual animation.
    await pumpApp(
      tester,
      initialLocation: '/drivers/zz-unknown',
      drivers: FakeDriverRepository(),
      disableAnimations: true,
    );
    expect(find.byType(DriverDetailScreen), findsOneWidget);
    // The stable id is never shown, humanised or used as a display name.
    expect(find.textContaining('zz-unknown'), findsNothing);
    expect(find.textContaining('Zz Unknown'), findsNothing);
  });
}
