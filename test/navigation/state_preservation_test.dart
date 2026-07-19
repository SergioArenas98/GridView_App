import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/driver_list_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';

import '../support/router_harness.dart';

double _homeScrollOffset(WidgetTester tester) {
  final Finder scrollable = find
      .descendant(
        of: find.byType(HomeScreen),
        matching: find.byType(Scrollable),
      )
      .first;
  return tester.state<ScrollableState>(scrollable).position.pixels;
}

void main() {
  testWidgets('a branch preserves its navigation stack across tab switches', (
    WidgetTester tester,
  ) async {
    await pumpApp(tester, initialLocation: '/explore');
    expect(find.byType(ExploreScreen), findsOneWidget);

    // Push the drivers list within the Explore branch.
    await tester.tap(find.text('Drivers'));
    await tester.pumpAndSettle();
    expect(find.byType(DriverListScreen), findsOneWidget);

    // Leave and return to Explore: the pushed list is still there.
    await tapNav(tester, 'Home');
    await tapNav(tester, 'Explore');
    expect(find.byType(DriverListScreen), findsOneWidget);

    // Re-selecting the active branch returns it to its root.
    await tapNav(tester, 'Explore');
    expect(find.byType(DriverListScreen), findsNothing);
    expect(find.byType(ExploreScreen), findsOneWidget);
  });

  testWidgets('a branch preserves its scroll position across tab switches', (
    WidgetTester tester,
  ) async {
    await pumpApp(tester, surfaceSize: const Size(400, 640));

    await tester.drag(
      find.descendant(
        of: find.byType(HomeScreen),
        matching: find.byType(Scrollable),
      ),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();
    final double scrolled = _homeScrollOffset(tester);
    expect(scrolled, greaterThan(0));

    await tapNav(tester, 'Calendar');
    await tapNav(tester, 'Home');

    expect(_homeScrollOffset(tester), closeTo(scrolled, 0.5));
  });

  testWidgets('a detail pushed from a branch returns to that branch on back', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await pumpApp(tester);
    await tapNav(tester, 'Calendar');
    expect(find.byType(CalendarScreen), findsOneWidget);

    unawaited(router.push('/drivers/a-driver'));
    await tester.pumpAndSettle();
    expect(find.byType(DriverDetailScreen), findsOneWidget);

    // Android system back returns to the originating branch, not Home.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(DriverDetailScreen), findsNothing);
    expect(find.byType(CalendarScreen), findsOneWidget);
    expect(shellLocation(router), '/calendar');
  });

  testWidgets('the app-bar back button pops a detail screen', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await pumpApp(tester);
    unawaited(router.push('/circuits/northgate'));
    await tester.pumpAndSettle();

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
