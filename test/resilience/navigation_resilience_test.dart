import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/router_harness.dart';

/// Locations that exercise the shell chrome and representative content.
const List<String> _locations = <String>[
  '/',
  '/calendar',
  '/standings/drivers/2026',
  '/explore',
  '/calendar/2026/3',
  '/drivers/a-driver',
];

void main() {
  for (final String location in _locations) {
    testWidgets('$location renders at 2.0x text scale without overflow', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: location,
        textScale: 2.0,
        surfaceSize: const Size(390, 900),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('$location renders at 320px width without overflow', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: location,
        surfaceSize: const Size(320, 720),
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Spanish content lays out on a narrow phone without overflow', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/standings/constructors/2026',
      locale: const Locale('es'),
      surfaceSize: const Size(320, 720),
    );
    expect(tester.takeException(), isNull);
    // Confirms Spanish actually loaded (segment + title).
    expect(find.byType(StandingsScreen), findsOneWidget);
    expect(find.text('Constructores'), findsWidgets);
  });

  testWidgets('content is not hidden behind the nav with a bottom safe area', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      surfaceSize: const Size(390, 780),
      padding: const EdgeInsets.only(bottom: 34),
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(GvBottomNav), findsOneWidget);
  });

  testWidgets('screens render with animations disabled (reduced motion)', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/standings/drivers/2026',
      disableAnimations: true,
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(StandingsScreen), findsOneWidget);
  });
}
