import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/a11y_harness.dart';
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

  // --- GvPrimaryButton across its three states -----------------------------
  //
  // Loading replaces the label with a spinner, and a spinner carries no text —
  // so a screen-reader user who triggered the action lost the button's name at
  // exactly the moment they needed confirmation of what was running.
  group('GvPrimaryButton keeps its name in every state', () {
    testWidgets('an enabled button is a named, enabled button', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvPrimaryButton(label: 'Try again', onPressed: () {}),
      );

      final SemanticsData data = nodeLabelled(tester, 'Try again');
      expect(data.flagsCollection.isButton, isTrue);
      expect(data.flagsCollection.isEnabled.toBoolOrNull(), isNot(false));
      handle.dispose();
    });

    testWidgets('a disabled button keeps its name and reports disabled', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(tester, const GvPrimaryButton(label: 'Try again'));

      final SemanticsData data = nodeLabelled(tester, 'Try again');
      expect(data.flagsCollection.isButton, isTrue);
      expect(data.flagsCollection.isEnabled.toBoolOrNull(), isFalse);
      handle.dispose();
    });

    testWidgets('a loading button keeps its name', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvPrimaryButton(label: 'Try again', isLoading: true, onPressed: () {}),
      );

      expect(labelOccurrences(tester, 'Try again'), 1);
      final SemanticsData data = nodeLabelled(tester, 'Try again');
      expect(data.flagsCollection.isButton, isTrue);
      expect(
        data.flagsCollection.isEnabled.toBoolOrNull(),
        isFalse,
        reason: 'it may stay non-activatable while the work runs',
      );
      handle.dispose();
    });

    testWidgets('a loading button appends its localized state once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: 'Loading',
          onPressed: () {},
        ),
      );

      expect(renderedLabels(tester), contains('Try again, Loading'));
      expect(labelOccurrences(tester, 'Loading'), 1);
      expect(labelOccurrences(tester, 'Try again'), 1);
      handle.dispose();
    });

    testWidgets('a blank loading state is omitted rather than appended', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: '  ',
          onPressed: () {},
        ),
      );

      expect(renderedLabels(tester), contains('Try again'));
      handle.dispose();
    });

    testWidgets('loading changes neither the spinner nor the button size', (
      WidgetTester tester,
    ) async {
      await pumpComponent(
        tester,
        const GvPrimaryButton(label: 'Try again', isLoading: true),
      );
      final Size before = tester.getSize(find.byType(ElevatedButton));

      await pumpComponent(
        tester,
        const GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: 'Loading',
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.getSize(find.byType(ElevatedButton)), before);
    });
  });
}
