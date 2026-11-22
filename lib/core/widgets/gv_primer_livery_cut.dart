import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Which edges of a box carry the Primer V2 12° livery cut.
enum GvLiveryCutEdges {
  /// Both vertical edges slant: the box skewed by −12° about its centre,
  /// exactly like CSS `transform: skewX(-12deg)` (selector slab, navigation
  /// slab, livery tag). Rounded corners skew with it.
  both,

  /// Only the leading (left) edge slants; the top-left corner moves right by
  /// `height · tan 12°` (Team banner bar and pinstripe, `clip-path`).
  leading,

  /// Only the trailing (right) edge slants; the bottom-right corner moves left
  /// by `height · tan 12°` (GP winner cell; the prototypes' fixed 17px run is
  /// replaced by the height-derived run, XS-27, GPD-10).
  trailing,
}

/// The Primer V2 12° livery cut as a [ShapeBorder]: one geometric primitive
/// for every diagonal in the design (XS-27).
///
/// The run is always derived from the height (`height · tan 12°`), so the
/// angle holds at any height and any text scale, and every edge leans the
/// same way ("/"). It paints nothing itself:
///
/// - as a **fill**, `DecoratedBox(decoration: ShapeDecoration(color: …,
///   shape: GvLiveryCut(…)))` behind content, which is never clipped;
/// - as a **clip**, `ClipPath(clipper: ShapeBorderClipper(shape: …))`, only
///   for shapes that are themselves the coloured element (a team bar), never
///   around text, icons or focus rings.
///
/// A box's hit area stays its rectangle: the cut is decoration only.
@immutable
class GvLiveryCut extends ShapeBorder {
  const GvLiveryCut({this.edges = GvLiveryCutEdges.both, this.radius = 0})
    : assert(radius >= 0);

  /// tan 12°: the horizontal run per unit of height.
  static final double slope = math.tan(12 * math.pi / 180);

  final GvLiveryCutEdges edges;

  /// Corner radius before skewing ([GvLiveryCutEdges.both] only): 6 for the
  /// selector slab, 4 for the navigation slab, 0 for the livery tag.
  final double radius;

  /// The horizontal run of the diagonal for a box of [height].
  static double runFor(double height) => height * slope;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) {
    switch (edges) {
      case GvLiveryCutEdges.both:
        final Path box = Path()
          ..addRRect(
            RRect.fromRectAndRadius(
              rect,
              Radius.circular(
                math.min(radius, math.min(rect.width, rect.height) / 2),
              ),
            ),
          );
        // skewX(-12deg) about the centre: x' = x - tan12 · (y - centreY).
        final double cy = rect.center.dy;
        final Matrix4 skew = Matrix4.identity()
          ..setEntry(0, 1, -slope)
          ..setEntry(0, 3, slope * cy);
        return box.transform(skew.storage);
      case GvLiveryCutEdges.leading:
        final double run = math.min(runFor(rect.height), rect.width);
        return Path()
          ..moveTo(rect.left + run, rect.top)
          ..lineTo(rect.right, rect.top)
          ..lineTo(rect.right, rect.bottom)
          ..lineTo(rect.left, rect.bottom)
          ..close();
      case GvLiveryCutEdges.trailing:
        final double run = math.min(runFor(rect.height), rect.width);
        return Path()
          ..moveTo(rect.left, rect.top)
          ..lineTo(rect.right, rect.top)
          ..lineTo(rect.right - run, rect.bottom)
          ..lineTo(rect.left, rect.bottom)
          ..close();
    }
  }

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      getOuterPath(rect, textDirection: textDirection);

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {}

  @override
  ShapeBorder scale(double t) => GvLiveryCut(edges: edges, radius: radius * t);

  @override
  bool operator ==(Object other) =>
      other is GvLiveryCut && other.edges == edges && other.radius == radius;

  @override
  int get hashCode => Object.hash(edges, radius);
}
