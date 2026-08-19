import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

/// Reduced motion at the component level.
///
/// "Remove animations" is an accessibility setting, not a preference: for a
/// user with a vestibular disorder an unrequested transition is the defect.
/// [GvSkeletonBlock] already honours it; the segmented control did not, and its
/// selection transition is the one motion a user cannot avoid, because it fires
/// on the control they just operated.
void main() {
  /// The selected-pill colour the segment is currently painting.
  ///
  /// Read off the rendered [Container] that [AnimatedContainer] builds, so it
  /// is the value on screen this frame rather than the target value.
  Color? paintedColor(WidgetTester tester, int segment) {
    final Finder box = find.descendant(
      of: find.byType(AnimatedContainer).at(segment),
      matching: find.byType(Container),
    );
    final Decoration? decoration = tester
        .widget<Container>(box.first)
        .decoration;
    return (decoration! as BoxDecoration).color;
  }

  Future<void> pumpAt(
    WidgetTester tester,
    int selectedIndex, {
    required bool disableAnimations,
  }) => pumpComponent(
    tester,
    GvSegmentedControl(
      segments: const <String>['Drivers', 'Constructors'],
      selectedIndex: selectedIndex,
      onChanged: (_) {},
    ),
    disableAnimations: disableAnimations,
  );

  testWidgets('GvSegmentedControl finishes its selection change in the very '
      'first frame when animations are disabled', (WidgetTester tester) async {
    await pumpAt(tester, 0, disableAnimations: true);
    await pumpAt(tester, 1, disableAnimations: true);

    // No time has been allowed to pass, so an animated control would still be
    // showing its start value here.
    final BuildContext context = tester.element(
      find.byType(GvSegmentedControl),
    );
    expect(paintedColor(tester, 1), context.gvColors.accentPrimary);
    expect(paintedColor(tester, 0), Colors.transparent);
  });

  testWidgets('GvSegmentedControl still animates its selection change when '
      'animations are enabled', (WidgetTester tester) async {
    await pumpAt(tester, 0, disableAnimations: false);
    await pumpAt(tester, 1, disableAnimations: false);

    final BuildContext context = tester.element(
      find.byType(GvSegmentedControl),
    );
    // The guard for the test above: with motion allowed the newly selected
    // segment has not reached its final colour in the first frame, so the
    // reduced-motion assertion cannot pass vacuously.
    expect(paintedColor(tester, 1), isNot(context.gvColors.accentPrimary));

    await tester.pumpAndSettle();
    expect(paintedColor(tester, 1), context.gvColors.accentPrimary);
  });

  testWidgets('reduced motion changes neither the size nor the resting '
      'appearance of the control', (WidgetTester tester) async {
    await pumpAt(tester, 1, disableAnimations: false);
    await tester.pumpAndSettle();
    final Size animated = tester.getSize(find.byType(GvSegmentedControl));
    final Color? animatedColor = paintedColor(tester, 1);

    await pumpAt(tester, 1, disableAnimations: true);
    await tester.pumpAndSettle();

    expect(tester.getSize(find.byType(GvSegmentedControl)), animated);
    expect(paintedColor(tester, 1), animatedColor);
  });

  testWidgets('GvSegmentedControl keeps its selected-state semantics under '
      'reduced motion', (WidgetTester tester) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpAt(tester, 1, disableAnimations: true);

    expect(
      tester.getSemantics(find.text('Constructors')),
      isSemantics(isSelected: true, isButton: true),
    );
    expect(
      tester.getSemantics(find.text('Drivers')),
      isSemantics(isSelected: false, isButton: true),
    );
    handle.dispose();
  });
}
