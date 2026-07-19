import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

void main() {
  testWidgets('GvIconButton exposes its semantic label', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpComponent(
      tester,
      GvIconButton(
        icon: Icons.settings_outlined,
        semanticLabel: 'Settings',
        onPressed: () {},
      ),
    );
    expect(find.bySemanticsLabel('Settings'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('GvSegmentedControl flags the selected segment', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpComponent(
      tester,
      GvSegmentedControl(
        segments: const <String>['Drivers', 'Constructors'],
        selectedIndex: 1,
        onChanged: (_) {},
      ),
    );
    expect(
      tester.getSemantics(find.text('Constructors')),
      isSemantics(isSelected: true, isButton: true),
    );
    expect(
      tester.getSemantics(find.text('Drivers')),
      isSemantics(isSelected: false),
    );
    handle.dispose();
  });

  testWidgets('GvBottomNav flags the selected destination', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
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
    expect(
      tester.getSemantics(find.text('Home')),
      isSemantics(isSelected: true, isButton: true),
    );
    handle.dispose();
  });

  testWidgets('GvStatusChip exposes its label to the semantics tree', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpComponent(
      tester,
      const GvStatusChip(label: 'Live', tone: GvStatusTone.live),
    );
    expect(find.bySemanticsLabel('Live'), findsOneWidget);
    handle.dispose();
  });
}
