import 'package:flutter_test/flutter_test.dart';

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

import '../support/fake_entity_repository.dart';
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
