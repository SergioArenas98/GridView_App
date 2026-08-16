import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/router_harness.dart';

/// Reduced motion proven on the live screens that own a [GvSegmentedControl]:
/// Standings and Explore.
///
/// The component test in test/design_system/reduced_motion_test.dart proves the
/// control honours the setting. This file proves two further things that only a
/// real screen can show:
///
/// 1. the screen actually delivers the platform setting down to the control —
///    a component can be perfectly correct and still never receive the
///    MediaQuery value in the real widget tree; and
/// 2. the selected-state transition, as the user experiences it on the screen,
///    completes without any intermediate animated state.
///
/// Worth recording, because it is not obvious from the widget code: on both
/// screens a segment change is delivered by a route change (`context.go`), so
/// the control is rebuilt at its new selection rather than animated in place.
/// The reduced-motion branch is therefore asserted directly on the mounted
/// control, which fails if the branch is removed, rather than inferred from a
/// transition the live screen does not actually run.
void main() {
  const Size tall = Size(390, 1600);

  /// The animation duration the mounted segmented control is configured with.
  Duration segmentDuration(WidgetTester tester) => tester
      .widget<AnimatedContainer>(
        find
            .descendant(
              of: find.byType(GvSegmentedControl),
              matching: find.byType(AnimatedContainer),
            )
            .first,
      )
      .duration;

  /// Every pill colour currently being painted by a segmented control.
  ///
  /// Read off the [Container] that [AnimatedContainer] builds, so these are the
  /// values on screen this frame rather than the targets. Two controls can be
  /// mounted at once while a route change runs; both are inspected.
  Set<Color?> paintedColours(WidgetTester tester) {
    final Finder animated = find.descendant(
      of: find.byType(GvSegmentedControl),
      matching: find.byType(AnimatedContainer),
    );
    return find
        .descendant(of: animated, matching: find.byType(Container))
        .evaluate()
        .map((Element element) => (element.widget as Container).decoration)
        .whereType<BoxDecoration>()
        .map((BoxDecoration decoration) => decoration.color)
        .toSet();
  }

  for (final (String screen, String location, String segment)
      in <(String, String, String)>[
        ('Standings', '/standings/drivers/2026', 'Constructors'),
        ('Explore', '/explore/drivers', 'Teams'),
      ]) {
    testWidgets('$screen hands reduced motion to its segmented control', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: location,
        surfaceSize: tall,
        disableAnimations: true,
      );

      expect(
        segmentDuration(tester),
        Duration.zero,
        reason: 'the platform setting must reach the mounted control',
      );
    });

    testWidgets('$screen still animates its segmented control when animations '
        'are enabled', (WidgetTester tester) async {
      // The guard: without it, "zero duration" could hold for reasons
      // unrelated to reduced motion and removing the branch would fail nothing.
      await pumpApp(tester, initialLocation: location, surfaceSize: tall);

      expect(segmentDuration(tester), GvMotion.fast);
    });

    testWidgets('$screen completes its selection change with no intermediate '
        'animated state under reduced motion', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpApp(
        tester,
        initialLocation: location,
        surfaceSize: tall,
        disableAnimations: true,
      );
      final Color accent = tester
          .element(find.byType(GvSegmentedControl))
          .gvColors
          .accentPrimary;

      await tester.tap(
        find
            .descendant(
              of: find.byType(GvSegmentedControl),
              matching: find.text(segment),
            )
            .first,
      );

      // Every frame from the tap until the screen settles: a segment is either
      // unselected or selected, and never a blend of the two.
      final Set<Color?> seen = <Color?>{};
      for (int frame = 0; frame < 60; frame++) {
        await tester.pump(const Duration(milliseconds: 8));
        seen.addAll(paintedColours(tester));
      }
      await tester.pumpAndSettle();

      expect(seen, everyElement(anyOf(Colors.transparent, accent)));
      expect(seen, contains(accent), reason: 'the change must actually happen');
      expect(
        tester.getSemantics(
          find
              .descendant(
                of: find.byType(GvSegmentedControl),
                matching: find.text(segment),
              )
              .first,
        ),
        isSemantics(isButton: true, isSelected: true),
      );
      handle.dispose();
    });
  }
}
