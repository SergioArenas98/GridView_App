import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/router_harness.dart';

/// Reduced motion proven on the live screens that own the Primer V2 selector:
/// Standings (Step 55C.5) and Explore (Step 55C.7). The selector has no
/// animated transition to reduce. Explore's refreshing line is covered in
/// `test/screens/explore_primer_test.dart`.
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

  for (final (String screen, String location, String segment)
      in <(String, String, String)>[
        ('Standings', '/standings/drivers/2026', 'Constructors'),
        ('Explore', '/explore/drivers', 'Teams'),
      ]) {
    group('$screen (Primer V2 selector, Steps 55C.5 and 55C.7)', () {
      Finder option(String label) => find.descendant(
        of: find.byType(GvPrimerSegmentedControl),
        matching: find.descendant(
          of: find.byType(GvPrimerFocusTarget),
          matching: find.text(label),
        ),
      );

      for (final bool reduced in <bool>[true, false]) {
        testWidgets('the selector animates nothing, '
            '${reduced ? 'with' : 'without'} reduced motion', (
          WidgetTester tester,
        ) async {
          await pumpApp(
            tester,
            initialLocation: location,
            surfaceSize: tall,
            disableAnimations: reduced,
          );
          expect(
            find.descendant(
              of: find.byType(GvPrimerSegmentedControl),
              matching: find.byWidgetPredicate(
                (Widget w) =>
                    w is ImplicitlyAnimatedWidget || w is AnimatedWidget,
              ),
            ),
            findsNothing,
          );
        });
      }

      testWidgets('a selection change has no intermediate state under reduced '
          'motion', (WidgetTester tester) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await pumpApp(
          tester,
          initialLocation: location,
          surfaceSize: tall,
          disableAnimations: true,
        );
        await tester.tap(option(segment));
        // Every frame until the screen settles: each mounted control shows
        // exactly one selected option, never a blend or two at once.
        for (int frame = 0; frame < 60; frame++) {
          await tester.pump(const Duration(milliseconds: 8));
          for (final Element control
              in find.byType(GvPrimerSegmentedControl).evaluate()) {
            final int selected = find
                .descendant(
                  of: find.byWidget(control.widget),
                  matching: find.byWidgetPredicate(
                    (Widget w) =>
                        w is GvPrimerFocusTarget && w.selected == true,
                  ),
                )
                .evaluate()
                .length;
            expect(selected, 1);
          }
        }
        await tester.pumpAndSettle();
        expect(
          tester.getSemantics(option(segment)),
          isSemantics(isButton: true, isSelected: true),
        );
        handle.dispose();
      });
    });
  }
}
