import 'package:flutter/gestures.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// Real-content reachability checks for scrolling screens under the fixed
/// bottom navigation (Step 55C.15R).
///
/// They replace assertions that depended on how much of a screen the legacy
/// navigation left visible (a fixed share of the viewport, a row "above the
/// fold"). What they protect is the usability contract itself: every piece
/// of content can be scrolled into the visible area between the pinned header
/// and the navigation, it is then whole (or, for a block taller than that
/// area, every line of it can be), and it receives pointer input there,
/// instead of the navigation or the header.

/// The visible list area: the scroll viewport, clipped to below [header] and
/// above [navigation].
Rect visibleListArea(
  WidgetTester tester, {
  required Finder scrollable,
  required Finder header,
  required Finder navigation,
}) {
  final Rect viewport = tester.getRect(scrollable);
  return Rect.fromLTRB(
    viewport.left,
    viewport.top > tester.getRect(header).bottom
        ? viewport.top
        : tester.getRect(header).bottom,
    viewport.right,
    viewport.bottom < tester.getRect(navigation).top
        ? viewport.bottom
        : tester.getRect(navigation).top,
  );
}

bool _inside(Rect area, Rect r) =>
    r.top >= area.top - 0.5 &&
    r.bottom <= area.bottom + 0.5 &&
    r.left >= area.left - 0.5 &&
    r.right <= area.right + 0.5;

/// Whether a pointer at [point] reaches [target] (or one of its descendants)
/// rather than something drawn over it.
bool receivesPointer(WidgetTester tester, Finder target, Offset point) {
  final RenderObject box = tester.renderObject(target);
  for (final HitTestEntry entry in tester.hitTestOnBinding(point).path) {
    final HitTestTarget hit = entry.target;
    if (hit is! RenderObject) continue;
    for (RenderObject? n = hit; n != null; n = n.parent) {
      if (identical(n, box)) return true;
    }
  }
  return false;
}

/// Scrolls [target] into view through [scrollable] and checks it is
/// reachable: whole inside the visible area when it fits, otherwise every
/// text line of it can be brought whole into the area, and in both cases a
/// pointer at its visible centre reaches it.
Future<void> expectReachable(
  WidgetTester tester, {
  required Finder target,
  required Finder scrollable,
  required Finder header,
  required Finder navigation,
  required String reason,
}) async {
  if (target.evaluate().isEmpty) {
    await tester.scrollUntilVisible(target, 120, scrollable: scrollable);
  }
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  final Rect area = visibleListArea(
    tester,
    scrollable: scrollable,
    header: header,
    navigation: navigation,
  );
  expect(area.height, greaterThan(0), reason: '$reason: no visible area');
  final Rect r = tester.getRect(target);
  if (r.height <= area.height + 0.5) {
    expect(
      _inside(area, r),
      isTrue,
      reason: '$reason: $r is not whole in the visible area $area',
    );
  } else {
    // Taller than the visible area: it can never be seen at once, so each
    // line of it must be reachable on its own.
    final List<Element> lines = find
        .descendant(of: target, matching: find.byType(RichText))
        .evaluate()
        .toList();
    expect(lines, isNotEmpty, reason: '$reason: no text to traverse');
    for (final Element line in lines) {
      await tester.ensureVisible(
        find.byElementPredicate((Element e) => e == line),
      );
      await tester.pumpAndSettle();
      final Rect l = tester.getRect(
        find.byElementPredicate((Element e) => e == line),
      );
      expect(
        _inside(area, l),
        isTrue,
        reason: '$reason: line $l cannot be scrolled whole into $area',
      );
    }
  }
  final Rect now = tester.getRect(target);
  final Rect shown = now.intersect(area);
  expect(shown.isEmpty, isFalse, reason: '$reason: not on screen');
  expect(
    receivesPointer(tester, target, shown.center),
    isTrue,
    reason: '$reason: a tap at ${shown.center} does not reach it',
  );
}

/// Scrolls [scrollable] to its end (repeated, as lazy lists grow their
/// extent while building) and settles.
Future<void> scrollToEnd(WidgetTester tester, Finder scrollable) async {
  for (int i = 0; i < 4; i++) {
    final ScrollPosition p = tester.state<ScrollableState>(scrollable).position;
    p.jumpTo(p.maxScrollExtent);
    await tester.pumpAndSettle();
  }
}
