import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/tokens/tokens.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

/// Every interactive shared component must expose a hit area of at least
/// [GvLayout.minTouchTarget] (48) logical pixels, even when its visible icon or
/// control is smaller. These tests fail if any control regresses below 48.
void main() {
  const double min = GvLayout.minTouchTarget;

  Size sizeOf(WidgetTester tester, Finder finder) => tester.getSize(finder);

  testWidgets('GvIconButton hit area is at least 48x48', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvIconButton(
        icon: Icons.settings_outlined,
        semanticLabel: 'Settings',
        onPressed: () {},
      ),
    );
    final Size size = sizeOf(tester, find.byType(IconButton));
    expect(size.width, greaterThanOrEqualTo(min));
    expect(size.height, greaterThanOrEqualTo(min));
  });

  testWidgets('GvPrimaryButton is at least 48 tall', (
    WidgetTester tester,
  ) async {
    await pumpComponent(tester, GvPrimaryButton(label: 'Go', onPressed: () {}));
    expect(
      sizeOf(tester, find.byType(ElevatedButton)).height,
      greaterThanOrEqualTo(min),
    );
  });

  testWidgets('GvSecondaryButton is at least 48 tall', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvSecondaryButton(label: 'Cancel', onPressed: () {}),
    );
    expect(
      sizeOf(tester, find.byType(OutlinedButton)).height,
      greaterThanOrEqualTo(min),
    );
  });

  testWidgets('GvSegmentedControl segments are at least 48 tall', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvSegmentedControl(
        segments: const <String>['Drivers', 'Constructors'],
        selectedIndex: 0,
        onChanged: (_) {},
      ),
    );
    for (final String label in <String>['Drivers', 'Constructors']) {
      final Finder segment = find.ancestor(
        of: find.text(label),
        matching: find.byType(GestureDetector),
      );
      expect(sizeOf(tester, segment).height, greaterThanOrEqualTo(min));
    }
  });

  testWidgets('GvBottomNav destinations are at least 48 tall', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvBottomNav(
        selectedIndex: 0,
        onSelect: (_) {},
        items: const <GvBottomNavItem>[
          GvBottomNavItem(icon: Icons.home_outlined, label: 'Home'),
          GvBottomNavItem(icon: Icons.explore_outlined, label: 'Explore'),
        ],
      ),
    );
    for (final String label in <String>['Home', 'Explore']) {
      final Finder item = find.ancestor(
        of: find.text(label),
        matching: find.byType(GestureDetector),
      );
      expect(sizeOf(tester, item).height, greaterThanOrEqualTo(min));
    }
  });

  testWidgets('tappable GvContentCard hit area is at least 48 tall', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvContentCard(onTap: () {}, child: const Text('Compact')),
    );
    expect(
      sizeOf(tester, find.byType(InkWell)).height,
      greaterThanOrEqualTo(min),
    );
  });
}
