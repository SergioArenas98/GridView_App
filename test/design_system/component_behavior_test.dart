import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
      GvPrimaryButton(
        label: 'Load',
        isLoading: true,
        loadingLabel: 'Loading',
        onPressed: () => taps++,
      ),
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

  testWidgets('GvStandingsRow omits every value the caller does not supply', (
    WidgetTester tester,
  ) async {
    // No team, no statistic and no badge: the secondary line is absent rather
    // than rendered as an empty container or a dangling separator.
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '—',
        name: 'Unranked Entrant',
        points: '0',
      ),
    );
    expect(find.text('Unranked Entrant'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
    expect(find.textContaining('·'), findsNothing);
  });

  testWidgets('GvStandingsRow joins the values it is given', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        stat: '6 wins',
        badgeLabel: 'Provisional',
        points: '210.5',
      ),
    );
    expect(find.text('Red Bull Racing · 6 wins · Provisional'), findsOneWidget);
  });

  testWidgets('GvStandingsRow keeps a two-digit position on one line', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(position: '19', name: 'A driver', points: '0'),
    );
    // A wrapped position would be twice as tall as a single line.
    final Size single = tester.getSize(find.text('19'));
    expect(
      single.height,
      lessThan(40),
      reason: 'the leading slot grows instead of wrapping the position',
    );
  });

  testWidgets('GvStandingsRow exposes one explicit reading order', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        points: '210.5',
        isLeader: true,
        semanticLabel:
            'Position 1, Max Verstappen, Red Bull Racing, 210.5 points, '
            'Championship leader',
        onTap: () {},
      ),
    );
    expect(
      find.bySemanticsLabel(
        'Position 1, Max Verstappen, Red Bull Racing, 210.5 points, '
        'Championship leader',
      ),
      findsOneWidget,
    );
  });

  // --- Keyboard, D-pad and switch-access operability -----------------------
  //
  // The two primary navigation controls are hand-built from GestureDetector,
  // so before this group they answered a pointer and nothing else: a hardware
  // keyboard, a TV remote's D-pad and switch access could all see them but not
  // reach them. These tests place focus on a control for real and send the
  // activation the platform sends for real.
  group('primary navigation controls are operable without a pointer', () {
    setUp(() {
      // Pinned so focus behaviour is deterministic: the manager otherwise
      // starts in touch mode on a mobile test platform.
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(() {
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic;
      });
    });

    /// The focus node of the focusable wrapper that owns [label].
    FocusNode focusNodeFor(WidgetTester tester, String label) =>
        Focus.of(tester.element(find.text(label)));

    Future<void> pumpSegmented(WidgetTester tester, ValueChanged<int> sink) =>
        pumpComponent(
          tester,
          GvSegmentedControl(
            segments: const <String>['Drivers', 'Constructors'],
            selectedIndex: 0,
            onChanged: sink,
          ),
        );

    Future<void> pumpNav(WidgetTester tester, ValueChanged<int> sink) =>
        pumpComponent(
          tester,
          GvBottomNav(
            selectedIndex: 0,
            onSelect: sink,
            items: const <GvBottomNavItem>[
              GvBottomNavItem(icon: Icons.home_outlined, label: 'Home'),
              GvBottomNavItem(icon: Icons.explore_outlined, label: 'Explore'),
            ],
          ),
        );

    testWidgets('a segment is reachable by keyboard traversal', (
      WidgetTester tester,
    ) async {
      await pumpSegmented(tester, (_) {});

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(focusNodeFor(tester, 'Drivers').hasPrimaryFocus, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(focusNodeFor(tester, 'Constructors').hasPrimaryFocus, isTrue);
    });

    testWidgets('a focused segment activates with Enter', (
      WidgetTester tester,
    ) async {
      int? changed;
      await pumpSegmented(tester, (int i) => changed = i);

      focusNodeFor(tester, 'Constructors').requestFocus();
      await tester.pump();
      expect(focusNodeFor(tester, 'Constructors').hasPrimaryFocus, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();

      expect(changed, 1);
    });

    testWidgets('a focused segment activates with Space', (
      WidgetTester tester,
    ) async {
      int? changed;
      await pumpSegmented(tester, (int i) => changed = i);

      focusNodeFor(tester, 'Constructors').requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();

      expect(changed, 1);
    });

    testWidgets('a focused segment activates on the standard activation '
        'intents a D-pad centre or switch access raises', (
      WidgetTester tester,
    ) async {
      int? changed;
      await pumpSegmented(tester, (int i) => changed = i);

      final FocusNode node = focusNodeFor(tester, 'Constructors');
      node.requestFocus();
      await tester.pump();

      Actions.invoke(node.context!, const ActivateIntent());
      await tester.pump();
      expect(changed, 1);

      changed = null;
      Actions.invoke(node.context!, const ButtonActivateIntent());
      await tester.pump();
      expect(changed, 1);
    });

    testWidgets('a destination is reachable by keyboard traversal', (
      WidgetTester tester,
    ) async {
      await pumpNav(tester, (_) {});

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();

      expect(focusNodeFor(tester, 'Home').hasPrimaryFocus, isTrue);
    });

    testWidgets('a focused destination activates with Enter, with Space and '
        'on the standard activation intent', (WidgetTester tester) async {
      int? selected;
      await pumpNav(tester, (int i) => selected = i);

      final FocusNode node = focusNodeFor(tester, 'Explore');
      node.requestFocus();
      await tester.pump();
      expect(node.hasPrimaryFocus, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(selected, 1);

      selected = null;
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(selected, 1);

      selected = null;
      Actions.invoke(node.context!, const ActivateIntent());
      await tester.pump();
      expect(selected, 1);

      selected = null;
      Actions.invoke(node.context!, const ButtonActivateIntent());
      await tester.pump();
      expect(selected, 1);
    });

    testWidgets('pointer activation still works alongside focus', (
      WidgetTester tester,
    ) async {
      int? selected;
      await pumpNav(tester, (int i) => selected = i);

      await tester.tap(find.text('Explore'));
      await tester.pump();
      expect(selected, 1);
    });

    testWidgets('a focused control keeps its 48dp target and its size', (
      WidgetTester tester,
    ) async {
      await pumpNav(tester, (_) {});
      final Finder destination = find
          .ancestor(
            of: find.text('Home'),
            matching: find.byType(ConstrainedBox),
          )
          .first;
      final Size resting = tester.getSize(destination);
      expect(resting.height, greaterThanOrEqualTo(48.0));

      focusNodeFor(tester, 'Home').requestFocus();
      await tester.pumpAndSettle();

      expect(tester.getSize(destination), resting);
    });

    testWidgets('focus changes neither the button nor the selected semantics', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpNav(tester, (_) {});

      focusNodeFor(tester, 'Explore').requestFocus();
      await tester.pumpAndSettle();

      expect(
        tester.getSemantics(find.text('Home')),
        isSemantics(isButton: true, isSelected: true),
      );
      expect(
        tester.getSemantics(find.text('Explore')),
        isSemantics(isButton: true, isSelected: false),
      );
      handle.dispose();
    });
  });

  // --- Focus indication ----------------------------------------------------
  //
  // A ring that is always painted is a redesign, not an accessibility fix; a
  // ring that never appears leaves a keyboard user unable to see where they
  // are. Both halves are asserted, and the resting appearance is the one the
  // golden baselines already record.
  group('focus indication appears only while focus is present', () {
    setUp(() {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(() {
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic;
      });
    });

    /// The foreground decoration painted over [label]'s control, which is where
    /// a focus ring must live: a foreground decoration cannot change layout.
    Decoration? foregroundOf(WidgetTester tester, String label) {
      final Finder box = find
          .ancestor(of: find.text(label), matching: find.byType(Container))
          .first;
      return tester.widget<Container>(box).foregroundDecoration;
    }

    testWidgets('a segment paints no focus ring until it is focused', (
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

      expect(
        foregroundOf(tester, 'Constructors'),
        isNull,
        reason: 'an unfocused control must look exactly as it did before',
      );

      Focus.of(tester.element(find.text('Constructors'))).requestFocus();
      await tester.pumpAndSettle();

      expect(foregroundOf(tester, 'Constructors'), isNotNull);
    });

    testWidgets('a destination paints no focus ring until it is focused', (
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

      expect(foregroundOf(tester, 'Explore'), isNull);

      Focus.of(tester.element(find.text('Explore'))).requestFocus();
      await tester.pumpAndSettle();

      expect(foregroundOf(tester, 'Explore'), isNotNull);
    });
  });
}
