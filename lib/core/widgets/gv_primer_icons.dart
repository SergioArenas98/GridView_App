import 'package:flutter/widgets.dart';

/// Primer V2 stroke glyphs where no Material icon matches the approved
/// prototype closely enough (Step 55B.2.1; row chevron and arrow added in
/// Step 55B.3 for the editorial rows; the VS-4 notice causes in Step 55B.4;
/// the Home Explore pictograms in Step 55C.3).
/// Each is drawn from the prototype's own SVG coordinates (24-unit viewBox,
/// round caps and joins), so proportions
/// and stroke style are the reference's. Every other icon stays a Material
/// placeholder.
enum GvPrimerGlyph {
  /// Standings: three vertical bars (prototype `#i-standings`:
  /// `M18 20V10`, `M12 20V4`, `M6 20v-6`).
  standings,

  /// Cancelled: circle with a top-left → bottom-right diagonal (prototype
  /// `#i-ban`: `circle r=10`, `m4.9 4.9 14.2 14.2`). Material's `block` has
  /// the opposite diagonal.
  ban,

  /// Row affordance: chevron (prototype `#i-chevron`: `m9 18 6-6-6-6`).
  chevronRight,

  /// Calendar next-event disc: arrow (prototype `#i-arrow`: `M5 12h14`,
  /// `m12 5 7 7-7 7`).
  arrowRight,

  /// Notice cause: refresh failure and the combined failure + stale notice
  /// (VS-4; prototype `#i-alert`: `circle r=10`, `M12 8v4`, `M12 16h.01`).
  alert,

  /// Notice cause: stale data (VS-4; `#i-clock`: `circle r=10`,
  /// `M12 6v6l4 2`).
  clock,

  /// Notice cause: incomplete information (VS-4; `#i-help`: `circle r=10`,
  /// `M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3`, `M12 17h.01`).
  help,

  /// Explore: drivers (prototype `#i-driver`:
  /// `M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2`, `circle cx=12 cy=7 r=4`).
  driver,

  /// Explore: teams (prototype `#i-team`:
  /// `M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2`, `circle cx=9 cy=7 r=4`,
  /// `M22 21v-2a4 4 0 0 0-3-3.87`, `M16 3.13a4 4 0 0 1 0 7.75`).
  team,

  /// Explore: circuits (prototype `#i-circuit`: `circle cx=6 cy=19 r=3`,
  /// `M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15`,
  /// `circle cx=18 cy=5 r=3`).
  circuit,

  /// Circuit Detail: clockwise direction (Step 55C.11; prototype `#i-cw`:
  /// `M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8`, `M21 3v5h-5`).
  rotateCw,

  /// Circuit Detail: counter-clockwise direction (Step 55C.11; prototype
  /// `#i-ccw`: `M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,
  /// `M3 3v5h5`).
  rotateCcw,

  /// Grand Prix Detail: fastest-lap chip stopwatch (Step 55C.12; prototype
  /// `#i-timer`: `M10 2h4`, `m12 14 3-3`, `circle cx=12 cy=14 r=8`).
  timer,

  /// Settings: the check inside a selected option's 12° mark (Step 55C.13A;
  /// prototype `#i-check`: `M20 6 9 17l-5-5`).
  check,

  /// Settings: the trailing Send feedback glyph (Step 55C.13A, owner
  /// decision SETT-04: the mail icon instead of the prototype's external
  /// arrow). Drawn in the same stroke family as the other glyphs: an
  /// envelope `rect x=2 y=4 width=20 height=16 rx=2` with the flap
  /// `m22 7-10 6L2 7`.
  mail,

  /// Settings information screens: the trailing glyph of a row that opens a
  /// destination outside GridView (Step 55C.13B; prototype `#i-open`:
  /// `M14 4h6v6`, `M20 4 11 13`,
  /// `M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5`). It
  /// replaces the in-app chevron, so a row that leaves GridView never looks
  /// like one that navigates inside it.
  openExternal,
}

/// Stroke widths in viewBox units, as the prototype's CSS sets them.
abstract final class GvPrimerIconStroke {
  /// `.icon` (24px navigation and inline icons).
  static const double regular = 1.75;

  /// `.icon--sm` (status-chip icons).
  static const double small = 2.25;
}

/// Paints a [GvPrimerGlyph] at [size] in [color]. Decorative: it adds no
/// semantics, like an [Icon] without a label; the surrounding widget carries
/// the meaning.
class GvPrimerIcon extends StatelessWidget {
  const GvPrimerIcon(
    this.glyph, {
    super.key,
    required this.size,
    required this.color,
    this.strokeWidth = GvPrimerIconStroke.regular,
  });

  final GvPrimerGlyph glyph;
  final double size;
  final Color color;

  /// Stroke width in viewBox units (scaled with [size], as in SVG).
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(
      painter: GvPrimerGlyphPainter(glyph, color, strokeWidth),
    ),
  );
}

/// The painter behind [GvPrimerIcon].
class GvPrimerGlyphPainter extends CustomPainter {
  const GvPrimerGlyphPainter(this.glyph, this.color, this.strokeWidth);

  final GvPrimerGlyph glyph;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    switch (glyph) {
      case GvPrimerGlyph.standings:
        canvas
          ..drawLine(const Offset(18, 20), const Offset(18, 10), paint)
          ..drawLine(const Offset(12, 20), const Offset(12, 4), paint)
          ..drawLine(const Offset(6, 20), const Offset(6, 14), paint);
      case GvPrimerGlyph.ban:
        canvas
          ..drawCircle(const Offset(12, 12), 10, paint)
          ..drawLine(const Offset(4.9, 4.9), const Offset(19.1, 19.1), paint);
      case GvPrimerGlyph.chevronRight:
        canvas.drawPath(
          Path()
            ..moveTo(9, 18)
            ..lineTo(15, 12)
            ..lineTo(9, 6),
          paint,
        );
      case GvPrimerGlyph.alert:
        canvas
          ..drawCircle(const Offset(12, 12), 10, paint)
          ..drawLine(const Offset(12, 8), const Offset(12, 12), paint)
          ..drawLine(const Offset(12, 16), const Offset(12.01, 16), paint);
      case GvPrimerGlyph.clock:
        canvas
          ..drawCircle(const Offset(12, 12), 10, paint)
          ..drawPath(
            Path()
              ..moveTo(12, 6)
              ..lineTo(12, 12)
              ..lineTo(16, 14),
            paint,
          );
      case GvPrimerGlyph.help:
        canvas
          ..drawCircle(const Offset(12, 12), 10, paint)
          ..drawPath(
            Path()
              ..moveTo(9.09, 9)
              ..arcToPoint(
                const Offset(14.92, 10),
                radius: const Radius.circular(3),
              )
              ..cubicTo(14.92, 12, 11.92, 13, 11.92, 13),
            paint,
          )
          ..drawLine(const Offset(12, 17), const Offset(12.01, 17), paint);
      // SVG arcs: sweep-flag 0 is counter-clockwise on screen
      // (`clockwise: false`), sweep-flag 1 clockwise; every arc here is the
      // small one.
      case GvPrimerGlyph.driver:
        canvas
          ..drawPath(
            Path()
              ..moveTo(19, 21)
              ..lineTo(19, 19)
              ..arcToPoint(
                const Offset(15, 15),
                radius: const Radius.circular(4),
                clockwise: false,
              )
              ..lineTo(9, 15)
              ..arcToPoint(
                const Offset(5, 19),
                radius: const Radius.circular(4),
                clockwise: false,
              )
              ..lineTo(5, 21),
            paint,
          )
          ..drawCircle(const Offset(12, 7), 4, paint);
      case GvPrimerGlyph.team:
        canvas
          ..drawPath(
            Path()
              ..moveTo(16, 21)
              ..lineTo(16, 19)
              ..arcToPoint(
                const Offset(12, 15),
                radius: const Radius.circular(4),
                clockwise: false,
              )
              ..lineTo(6, 15)
              ..arcToPoint(
                const Offset(2, 19),
                radius: const Radius.circular(4),
                clockwise: false,
              )
              ..lineTo(2, 21),
            paint,
          )
          ..drawCircle(const Offset(9, 7), 4, paint)
          ..drawPath(
            Path()
              ..moveTo(22, 21)
              ..lineTo(22, 19)
              ..arcToPoint(
                const Offset(19, 15.13),
                radius: const Radius.circular(4),
                clockwise: false,
              ),
            paint,
          )
          ..drawPath(
            Path()
              ..moveTo(16, 3.13)
              ..arcToPoint(
                const Offset(16, 10.88),
                radius: const Radius.circular(4),
              ),
            paint,
          );
      case GvPrimerGlyph.circuit:
        canvas
          ..drawCircle(const Offset(6, 19), 3, paint)
          ..drawPath(
            Path()
              ..moveTo(9, 19)
              ..lineTo(17.5, 19)
              ..arcToPoint(
                const Offset(17.5, 12),
                radius: const Radius.circular(3.5),
                clockwise: false,
              )
              ..lineTo(6.5, 12)
              ..arcToPoint(
                const Offset(6.5, 5),
                radius: const Radius.circular(3.5),
              )
              ..lineTo(15, 5),
            paint,
          )
          ..drawCircle(const Offset(18, 5), 3, paint);
      case GvPrimerGlyph.rotateCw:
        canvas
          ..drawPath(
            Path()
              ..moveTo(21, 12)
              ..arcToPoint(
                const Offset(12, 3),
                radius: const Radius.circular(9),
                largeArc: true,
              )
              ..cubicTo(14.52, 3, 16.93, 4, 18.74, 5.74)
              ..lineTo(21, 8),
            paint,
          )
          ..drawPath(
            Path()
              ..moveTo(21, 3)
              ..lineTo(21, 8)
              ..lineTo(16, 8),
            paint,
          );
      case GvPrimerGlyph.rotateCcw:
        canvas
          ..drawPath(
            Path()
              ..moveTo(3, 12)
              ..arcToPoint(
                const Offset(12, 3),
                radius: const Radius.circular(9),
                largeArc: true,
                clockwise: false,
              )
              ..arcToPoint(
                const Offset(5.26, 5.74),
                radius: const Radius.circular(9.75),
                clockwise: false,
              )
              ..lineTo(3, 8),
            paint,
          )
          ..drawPath(
            Path()
              ..moveTo(3, 3)
              ..lineTo(3, 8)
              ..lineTo(8, 8),
            paint,
          );
      case GvPrimerGlyph.arrowRight:
        canvas
          ..drawLine(const Offset(5, 12), const Offset(19, 12), paint)
          ..drawPath(
            Path()
              ..moveTo(12, 5)
              ..lineTo(19, 12)
              ..lineTo(12, 19),
            paint,
          );
      case GvPrimerGlyph.timer:
        canvas
          ..drawLine(const Offset(10, 2), const Offset(14, 2), paint)
          ..drawLine(const Offset(12, 14), const Offset(15, 11), paint)
          ..drawCircle(const Offset(12, 14), 8, paint);
      case GvPrimerGlyph.check:
        canvas.drawPath(
          Path()
            ..moveTo(20, 6)
            ..lineTo(9, 17)
            ..lineTo(4, 12),
          paint,
        );
      case GvPrimerGlyph.mail:
        canvas
          ..drawRRect(
            RRect.fromRectAndRadius(
              const Rect.fromLTWH(2, 4, 20, 16),
              const Radius.circular(2),
            ),
            paint,
          )
          ..drawPath(
            Path()
              ..moveTo(22, 7)
              ..lineTo(12, 13)
              ..lineTo(2, 7),
            paint,
          );
      case GvPrimerGlyph.openExternal:
        canvas
          ..drawPath(
            Path()
              ..moveTo(14, 4)
              ..lineTo(20, 4)
              ..lineTo(20, 10),
            paint,
          )
          ..drawLine(const Offset(20, 4), const Offset(11, 13), paint)
          ..drawPath(
            Path()
              ..moveTo(18, 14)
              ..lineTo(18, 19)
              ..arcToPoint(
                const Offset(17, 20),
                radius: const Radius.circular(1),
              )
              ..lineTo(5, 20)
              ..arcToPoint(
                const Offset(4, 19),
                radius: const Radius.circular(1),
              )
              ..lineTo(4, 7)
              ..arcToPoint(const Offset(5, 6), radius: const Radius.circular(1))
              ..lineTo(10, 6),
            paint,
          );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(GvPrimerGlyphPainter oldDelegate) =>
      oldDelegate.glyph != glyph ||
      oldDelegate.color != color ||
      oldDelegate.strokeWidth != strokeWidth;
}
