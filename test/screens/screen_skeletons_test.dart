import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/circuit_list_screen.dart';
import 'package:gridview/features/explore/presentation/constructor_list_screen.dart';
import 'package:gridview/features/explore/presentation/driver_list_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

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
    ('/explore/drivers', DriverListScreen),
    ('/explore/teams', ConstructorListScreen),
    ('/explore/circuits', CircuitListScreen),
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

  testWidgets('a valid but unknown entity id renders a generic placeholder', (
    WidgetTester tester,
  ) async {
    await pumpApp(tester, initialLocation: '/drivers/zz-unknown');
    expect(find.byType(DriverDetailScreen), findsOneWidget);
    expect(find.text('Profile placeholder'), findsOneWidget);
    // The stable id is still shown as a technical identifier, not as the name.
    expect(find.text('zz-unknown'), findsOneWidget);
  });
}
