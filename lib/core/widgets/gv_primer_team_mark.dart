import 'package:flutter/widgets.dart';

import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import 'gv_primer_livery_cut.dart';

/// The approved team-colour shapes (XT-3, token map §4.13), one geometry in
/// both themes and every state.
enum GvPrimerTeamShape {
  /// Explore / Standings tick: 3px wide, both edges at 12°.
  tick,

  /// Team line-up seam: a 2px column, both edges at 12°; never widens.
  seam,

  /// Team banner bar: 12px tall, 12° leading edge.
  bar,

  /// Team banner pinstripe: 3px tall, 12° leading edge (the screen gives it
  /// 46% of the rail).
  pinstripe,
}

/// A decorative team-colour shape (XT-3, XS-25).
///
/// The supplied [color] is drawn as given, never changed, replaced or used
/// for text, and the shape keeps its approved size. When it measures below
/// 3:1 against the opaque surface it actually sits on ([surface], or the
/// page of the enclosing [GvPrimerSurface]), a 1px boundary in that
/// surface's primary text colour (`edge.team`) is painted outside the shape,
/// following its cut, taking no layout. The test runs at runtime
/// ([GvPrimerRoles.teamEdgeFor]).
///
/// The thin dimension is fixed ([thickness]); the other comes from the
/// parent, or from [length]. The diagonal paints beyond the box like CSS
/// `skewX`, so leave room for it. Hidden from semantics: team colour never
/// carries meaning.
class GvPrimerTeamMark extends StatelessWidget {
  const GvPrimerTeamMark({
    super.key,
    required this.shape,
    required this.color,
    this.surface,
    this.length,
  });

  final GvPrimerTeamShape shape;
  final Color color;

  /// The opaque colour under the shape; defaults to the enclosing page.
  final Color? surface;

  /// Height of a tick or seam, width of a bar or pinstripe; `null` fills the
  /// parent.
  final double? length;

  /// The shape's fixed thickness (XT-3).
  static double thicknessOf(GvPrimerTeamShape shape) => switch (shape) {
    GvPrimerTeamShape.tick => 3,
    GvPrimerTeamShape.seam => 2,
    GvPrimerTeamShape.bar => 12,
    GvPrimerTeamShape.pinstripe => 3,
  };

  double get thickness => thicknessOf(shape);

  bool get _vertical =>
      shape == GvPrimerTeamShape.tick || shape == GvPrimerTeamShape.seam;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Color under = surface ?? roles.surface.page;
    return ExcludeSemantics(
      child: SizedBox(
        width: _vertical ? thickness : length,
        height: _vertical ? length : thickness,
        child: CustomPaint(
          painter: GvPrimerTeamMarkPainter(
            shape: shape,
            color: color,
            edge: roles.teamEdgeFor(color, surface: under),
          ),
        ),
      ),
    );
  }
}

/// The painter behind [GvPrimerTeamMark].
class GvPrimerTeamMarkPainter extends CustomPainter {
  const GvPrimerTeamMarkPainter({
    required this.shape,
    required this.color,
    this.edge,
  });

  final GvPrimerTeamShape shape;
  final Color color;

  /// The 1px outside boundary, or `null` when the colour passes 3:1.
  final Color? edge;

  /// The shape's outline in a box of [size].
  static Path pathFor(GvPrimerTeamShape shape, Size size) {
    final GvLiveryCut cut = GvLiveryCut(
      edges: shape == GvPrimerTeamShape.tick || shape == GvPrimerTeamShape.seam
          ? GvLiveryCutEdges.both
          : GvLiveryCutEdges.leading,
    );
    return cut.getOuterPath(Offset.zero & size);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final Path path = pathFor(shape, size);
    final Color? boundary = edge;
    if (boundary != null) {
      // A 2px stroke centred on the outline, then the fill over its inner
      // half: exactly 1px of boundary outside the shape.
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.miter
          ..color = boundary,
      );
    }
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(GvPrimerTeamMarkPainter oldDelegate) =>
      oldDelegate.shape != shape ||
      oldDelegate.color != color ||
      oldDelegate.edge != edge;
}
