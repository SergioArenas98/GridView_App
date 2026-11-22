import 'dart:math' as math;

import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../../core/theme/tokens/gv_primer_layout.dart';
import '../../../../core/theme/tokens/gv_primer_metrics.dart';
import '../../../../core/widgets/gv_primer_focus.dart';

/// A pinned header above a scrolling body that never overflows a short
/// viewport (Step 55C.15R).
///
/// Normally it lays out exactly as `Column(header, Expanded(body))`: the
/// header stays pinned and the body takes the rest. When the header would
/// leave the body less than [minPinnedBody] (two 48dp targets), as on a
/// 320 × 480 screen at 200% text with the environment strip and the 2 × 2
/// navigation, the header is no longer pinned: the page scrolls, the header
/// scrolls away with it, and the body gets the whole viewport, so no content
/// is clipped and every row stays reachable. Keyboard focus reaches both:
/// bringing a focused item into view scrolls the page as well as the list,
/// and Tab finishes the header before moving into the list.
///
/// Keyboard focus on a block taller than its scroll viewport (XS-34, Step
/// 55C.16R): Flutter's traversal aligns a target's end with the viewport end
/// when moving forward, so a block taller than the visible list (the
/// Standings leader card, an Explore circuit row at 320 @200%) had its top,
/// and the top of its focus ring, hidden under the pinned header. Both
/// traversal groups here use [revealOversizedFocus], which brings such a
/// block's top (with its ring) into view instead; the rest of the block is
/// reached by scrolling, as before. Every target that fits keeps Flutter's
/// default behaviour exactly, and touch scrolling is not involved.
///
/// The decision is measured, not estimated: the header is laid out first,
/// and a change of mode is applied on the next frame. Header and body keep
/// their state across a change of mode, and the normal layout contains no
/// extra scroll view, so its semantics are unchanged.
class PrimerPinnedHeaderLayout extends StatefulWidget {
  const PrimerPinnedHeaderLayout({
    super.key,
    required this.header,
    required this.body,
    this.minPinnedBody = 2 * GvPrimerLayout.minTarget,
  });

  final Widget header;
  final Widget body;

  /// The least body height for which the header stays pinned.
  final double minPinnedBody;

  @override
  State<PrimerPinnedHeaderLayout> createState() =>
      _PrimerPinnedHeaderLayoutState();
}

class _PrimerPinnedHeaderLayoutState extends State<PrimerPinnedHeaderLayout> {
  final GlobalKey _headerKey = GlobalKey(debugLabel: 'pinned-header');
  final GlobalKey _bodyKey = GlobalKey(debugLabel: 'pinned-body');
  bool _scrolling = false;

  void _onMode(bool scrolling) {
    if (!mounted || scrolling == _scrolling) return;
    setState(() => _scrolling = scrolling);
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) {
      final Widget layout = _HeaderBody(
        viewport: constraints.maxHeight,
        minPinnedBody: widget.minPinnedBody,
        scrolling: _scrolling,
        onMode: _onMode,
        children: <Widget>[
          // One traversal group each: Tab finishes the header before the
          // list and never returns to it. With a single group the reading
          // order is geometric, and once the header had scrolled away a
          // tall row sent focus back up to a header control above the
          // viewport, which forward traversal does not scroll into view.
          // Traversal into the list starts in the header's group, so both
          // groups reveal an oversized target's top (XS-34).
          KeyedSubtree(
            key: _headerKey,
            child: FocusTraversalGroup(
              policy: ReadingOrderTraversalPolicy(
                requestFocusCallback: revealOversizedFocus,
              ),
              child: widget.header,
            ),
          ),
          KeyedSubtree(
            key: _bodyKey,
            child: FocusTraversalGroup(
              policy: ReadingOrderTraversalPolicy(
                requestFocusCallback: revealOversizedFocus,
              ),
              child: widget.body,
            ),
          ),
        ],
      );
      if (!_scrolling) return layout;
      return SingleChildScrollView(
        key: const ValueKey<String>('primer-pinned-header-scroll'),
        physics: const ClampingScrollPhysics(),
        child: layout,
      );
    },
  );
}

class _HeaderBody extends MultiChildRenderObjectWidget {
  const _HeaderBody({
    required this.viewport,
    required this.minPinnedBody,
    required this.scrolling,
    required this.onMode,
    required super.children,
  });

  final double viewport;
  final double minPinnedBody;
  final bool scrolling;
  final ValueChanged<bool> onMode;

  @override
  _RenderHeaderBody createRenderObject(BuildContext context) =>
      _RenderHeaderBody(
        viewport: viewport,
        minPinnedBody: minPinnedBody,
        scrolling: scrolling,
        onMode: onMode,
      );

  @override
  void updateRenderObject(BuildContext context, _RenderHeaderBody render) {
    render
      ..viewport = viewport
      ..minPinnedBody = minPinnedBody
      ..scrolling = scrolling
      ..onMode = onMode;
  }
}

class _HeaderBodyParentData extends ContainerBoxParentData<RenderBox> {}

class _RenderHeaderBody extends RenderBox
    with
        ContainerRenderObjectMixin<RenderBox, _HeaderBodyParentData>,
        RenderBoxContainerDefaultsMixin<RenderBox, _HeaderBodyParentData> {
  _RenderHeaderBody({
    required double viewport,
    required double minPinnedBody,
    required bool scrolling,
    required this.onMode,
  }) {
    _viewport = viewport;
    _minPinnedBody = minPinnedBody;
    _scrolling = scrolling;
  }

  ValueChanged<bool> onMode;
  bool? _reported;

  double get viewport => _viewport;
  late double _viewport;
  set viewport(double value) {
    if (value == _viewport) return;
    _viewport = value;
    markNeedsLayout();
  }

  double get minPinnedBody => _minPinnedBody;
  late double _minPinnedBody;
  set minPinnedBody(double value) {
    if (value == _minPinnedBody) return;
    _minPinnedBody = value;
    markNeedsLayout();
  }

  bool get scrolling => _scrolling;
  late bool _scrolling;
  set scrolling(bool value) {
    if (value == _scrolling) return;
    _scrolling = value;
    _reported = null;
    markNeedsLayout();
  }

  bool _clipped = false;

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _HeaderBodyParentData) {
      child.parentData = _HeaderBodyParentData();
    }
  }

  @override
  void performLayout() {
    final RenderBox header = firstChild!;
    final RenderBox body = childAfter(header)!;
    final double width = constraints.maxWidth;
    header.layout(
      BoxConstraints(minWidth: width, maxWidth: width),
      parentUsesSize: true,
    );
    final double headerHeight = header.size.height;
    final double room = _viewport - headerHeight;
    final bool needsScrolling = room < _minPinnedBody;
    if (needsScrolling != _scrolling && _reported != needsScrolling) {
      _reported = needsScrolling;
      SchedulerBinding.instance.addPostFrameCallback(
        (_) => onMode(needsScrolling),
      );
    }
    final double bodyHeight = _scrolling ? _viewport : math.max(room, 0);
    body.layout(BoxConstraints.tightFor(width: width, height: bodyHeight));
    (header.parentData! as _HeaderBodyParentData).offset = Offset.zero;
    (body.parentData! as _HeaderBodyParentData).offset = Offset(
      0,
      headerHeight,
    );
    final double height = _scrolling ? headerHeight + bodyHeight : _viewport;
    size = constraints.constrain(Size(width, height));
    // Only for the one frame before a switch to scrolling: never paint past
    // the box, and never report an overflow for a state that is resolved.
    _clipped = headerHeight > size.height;
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) =>
      defaultHitTestChildren(result, position: position);

  @override
  void paint(PaintingContext context, Offset offset) {
    if (_clipped) {
      context.pushClipRect(
        needsCompositing,
        offset,
        Offset.zero & size,
        defaultPaint,
      );
    } else {
      defaultPaint(context, offset);
    }
  }
}

/// The traversal focus request of [PrimerPinnedHeaderLayout] (XS-34).
///
/// A target that fits in its nearest vertical scroll viewport is handled
/// exactly as [FocusTraversalPolicy.defaultTraversalRequestFocusCallback]
/// does. A target taller than that viewport is aligned by its **top**
/// (every enclosing scroll view, so a scrolled-away header is scrolled too),
/// then moved down by the outward extent of its [GvPrimerFocusTarget] ring,
/// so the ring's top edge is not clipped at the viewport edge. Only one
/// immediate jump per traversal step: nothing animates or repeats.
@visibleForTesting
void revealOversizedFocus(
  FocusNode node, {
  ScrollPositionAlignmentPolicy? alignmentPolicy,
  double? alignment,
  Duration? duration,
  Curve? curve,
}) {
  final BuildContext? context = node.context;
  final ScrollableState? scrollable = context == null
      ? null
      : Scrollable.maybeOf(context);
  final RenderObject? box = context?.findRenderObject();
  final bool oversized =
      scrollable != null &&
      box is RenderBox &&
      box.hasSize &&
      !axisDirectionIsReversed(scrollable.axisDirection) &&
      axisDirectionToAxis(scrollable.axisDirection) == Axis.vertical &&
      scrollable.position.hasViewportDimension &&
      box.size.height > scrollable.position.viewportDimension;
  if (!oversized) {
    FocusTraversalPolicy.defaultTraversalRequestFocusCallback(
      node,
      alignmentPolicy: alignmentPolicy,
      alignment: alignment,
      duration: duration,
      curve: curve,
    );
    return;
  }
  node.requestFocus();
  Scrollable.ensureVisible(context!, duration: Duration.zero);
  final GvPrimerFocusGeometry? geometry = context
      .findAncestorWidgetOfExactType<GvPrimerFocusTarget>()
      ?.geometry;
  final double ring = geometry == null
      ? 0
      : math.max(0, geometry.offset + GvPrimerMetrics.focusRingWidth);
  if (ring > 0) {
    final ScrollPosition position = scrollable.position;
    position.jumpTo(math.max(position.minScrollExtent, position.pixels - ring));
  }
}
