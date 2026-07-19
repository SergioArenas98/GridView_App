import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

void main() {
  testWidgets('GvPrimaryButton fires onPressed and is disabled when null', (
    WidgetTester tester,
  ) async {
    int taps = 0;
    await pumpComponent(
      tester,
      GvPrimaryButton(label: 'Go', onPressed: () => taps++),
    );
    await tester.tap(find.text('Go'));
    expect(taps, 1);

    await pumpComponent(tester, const GvPrimaryButton(label: 'Off'));
    expect(
      tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
      isNull,
    );
  });

  testWidgets('GvPrimaryButton in loading state ignores taps', (
    WidgetTester tester,
  ) async {
    int taps = 0;
    await pumpComponent(
      tester,
      GvPrimaryButton(label: 'Load', isLoading: true, onPressed: () => taps++),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
      isNull,
    );
    expect(taps, 0);
  });

  testWidgets('GvSegmentedControl reports the tapped index', (
    WidgetTester tester,
  ) async {
    int selected = 0;
    await pumpComponent(
      tester,
      StatefulBuilder(
        builder: (BuildContext context, StateSetter setState) {
          return GvSegmentedControl(
            segments: const <String>['Drivers', 'Constructors'],
            selectedIndex: selected,
            onChanged: (int i) => setState(() => selected = i),
          );
        },
      ),
    );
    await tester.tap(find.text('Constructors'));
    await tester.pumpAndSettle();
    expect(selected, 1);
  });

  testWidgets('GvBottomNav reports the tapped destination', (
    WidgetTester tester,
  ) async {
    int index = 0;
    await pumpComponent(
      tester,
      StatefulBuilder(
        builder: (BuildContext context, StateSetter setState) {
          return GvBottomNav(
            selectedIndex: index,
            onSelect: (int i) => setState(() => index = i),
            items: const <GvBottomNavItem>[
              GvBottomNavItem(icon: Icons.home_outlined, label: 'Home'),
              GvBottomNavItem(icon: Icons.explore_outlined, label: 'Explore'),
            ],
          );
        },
      ),
    );
    await tester.tap(find.text('Explore'));
    await tester.pump();
    expect(index, 1);
  });

  testWidgets('GvErrorState retry button invokes onRetry', (
    WidgetTester tester,
  ) async {
    int retries = 0;
    await pumpComponent(
      tester,
      GvErrorState(
        title: 'Oops',
        message: 'Failed',
        retryLabel: 'Retry',
        onRetry: () => retries++,
      ),
    );
    await tester.tap(find.text('Retry'));
    expect(retries, 1);
  });
}
