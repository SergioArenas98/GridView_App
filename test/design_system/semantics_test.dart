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
        GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: 'Loading',
          onPressed: () {},
        ),
      );

      // The name survives the spinner replacing it, and the whole thing is
      // still one disabled button rather than an unnamed one.
      expect(labelOccurrences(tester, 'Try again'), 1);
      final SemanticsData data = nodeLabelled(tester, 'Try again, Loading');
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

    testWidgets('the loading state is trimmed before it is spoken', (
      WidgetTester tester,
    ) async {
      // A blank label is no longer reachable — the component asserts against it
      // (see component_catalogue_test.dart) — but surrounding whitespace on an
      // otherwise real label must not become part of the spoken name.
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: '  Loading  ',
          onPressed: () {},
        ),
      );

      expect(renderedLabels(tester), contains('Try again, Loading'));
      handle.dispose();
    });

    testWidgets('the loading state changes neither the spinner nor the button '
        'size', (WidgetTester tester) async {
      await pumpComponent(
        tester,
        const GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: 'Loading',
        ),
      );
      final Size before = tester.getSize(find.byType(ElevatedButton));

      // A much longer localized state must not move a pixel: the label is
      // semantics-only.
      await pumpComponent(
        tester,
        const GvPrimaryButton(
          label: 'Try again',
          isLoading: true,
          loadingLabel: 'Cargando, por favor espera un momento',
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.getSize(find.byType(ElevatedButton)), before);
    });
  });
}
