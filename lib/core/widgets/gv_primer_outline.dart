import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/widgets.dart';

import '../theme/gv_primer_role_groups.dart';
import '../theme/tokens/gv_primer_metrics.dart';

/// Paints a Primer V2 status outline (solid or dashed) inside its box.
///
/// Like a CSS `border` with `box-sizing: border-box`, the stroke lies fully
/// inside the bounds and follows the outer corner [radius], so a solid and a
/// dashed chip have exactly the same geometry and only the pattern differs.
///
/// Dashed: the stroke is split along the whole rounded perimeter into a whole
/// number of dash + gap cycles, scaled slightly to fit, so there is never a
/// truncated dash, a doubled dash at the seam or a gap that swallows a corner,
/// whatever size text scaling gives the chip. The pattern lengths default to
/// [GvPrimerMetrics.dashLength] / [GvPrimerMetrics.dashGap], an initial choice
/// pending owner review.
class GvPrimerOutlinePainter extends CustomPainter {
  const GvPrimerOutlinePainter({
    required this.outline,
    required this.radius,
    this.strokeWidth = GvPrimerMetrics.statusOutlineWidth,
    this.dashLength = GvPrimerMetrics.dashLength,
    this.dashGap = GvPrimerMetrics.dashGap,
  });

  final GvPrimerOutline outline;

  /// Outer corner radius of the box.
  final double radius;
  final double strokeWidth;
  final double dashLength;
  final double dashGap;

  /// The rounded rectangle the stroke's centre line follows in [size].
  RRect strokePath(Size size) {
    final double inset = strokeWidth / 2;
    final Rect rect = (Offset.zero & size).deflate(inset);
    return RRect.fromRectAndRadius(
      rect,
      Radius.circular(math.max(0, radius - inset)),
    );
  }

  /// The dash and gap actually drawn on a perimeter of [length]: a whole
  /// number of cycles, each scaled by the same factor.
  ({int count, double dash, double gap}) fitDashes(double length) {
    final double period = dashLength + dashGap;
    final int count = math.max(1, (length / period).round());
    final double scale = length / (count * period);
    return (count: count, dash: dashLength * scale, gap: dashGap * scale);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = outline.color
      ..isAntiAlias = true;
    final RRect rrect = strokePath(size);
    if (!outline.dashed) {
      canvas.drawRRect(rrect, paint);
      return;
    }
    final Path path = Path()..addRRect(rrect);
    for (final PathMetric metric in path.computeMetrics()) {
      final ({int count, double dash, double gap}) fit = fitDashes(
        metric.length,
      );
      for (int i = 0; i < fit.count; i++) {
        final double start = i * (fit.dash + fit.gap);
        canvas.drawPath(metric.extractPath(start, start + fit.dash), paint);
      }
    }
  }

  @override
  bool shouldRepaint(GvPrimerOutlinePainter oldDelegate) =>
      oldDelegate.outline.color != outline.color ||
      oldDelegate.outline.dashed != outline.dashed ||
      oldDelegate.radius != radius ||
      oldDelegate.strokeWidth != strokeWidth ||
      oldDelegate.dashLength != dashLength ||
      oldDelegate.dashGap != dashGap;
}
