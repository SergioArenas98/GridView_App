import 'dart:typed_data';
import 'dart:ui';

import 'contrast.dart';

/// Measured visibility of a focus ring in a rendered image.
class RingVisibility {
  const RingVisibility({
    required this.samples,
    required this.visible,
    required this.minContrast,
  });

  /// Points sampled along the ring's centre line (one per logical pixel).
  final int samples;

  /// Samples that are on screen and show the ring colour.
  final int visible;

  /// Lowest contrast between the ring colour and the on-screen pixels just
  /// outside and just inside the ring (adjacent surfaces).
  final double minContrast;

  double get fraction => samples == 0 ? 0 : visible / samples;

  @override
  String toString() =>
      '${(fraction * 100).toStringAsFixed(1)}% visible ($visible/$samples), '
      'min adjacent contrast ${minContrast.toStringAsFixed(2)}';
}

/// Walks [ringCentre] (logical pixels, image origin) in an RGBA [bytes] image
/// of [imageWidth] × [imageHeight] device pixels at [pixelRatio].
///
/// A sample is visible when its centre pixel is on screen and within
/// [tolerance] (0-255 per channel) of [ring]. Adjacent pixels are taken
/// [ringWidth] / 2 + 1.5 logical pixels either side of the centre line; those
/// off screen are skipped (nothing is drawn there).
RingVisibility probeRing({
  required ByteData bytes,
  required int imageWidth,
  required int imageHeight,
  required double pixelRatio,
  required RRect ringCentre,
  required Color ring,
  double ringWidth = 2,
  int tolerance = 40,
}) {
  Color? pixelAt(Offset logical) {
    final int x = (logical.dx * pixelRatio).floor();
    final int y = (logical.dy * pixelRatio).floor();
    if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) return null;
    final int i = (y * imageWidth + x) * 4;
    return Color.fromARGB(
      255,
      bytes.getUint8(i),
      bytes.getUint8(i + 1),
      bytes.getUint8(i + 2),
    );
  }

  bool matches(Color c) =>
      ((c.r - ring.r).abs() * 255) <= tolerance &&
      ((c.g - ring.g).abs() * 255) <= tolerance &&
      ((c.b - ring.b).abs() * 255) <= tolerance;

  int samples = 0;
  int visible = 0;
  double minContrast = double.infinity;
  final double side = ringWidth / 2 + 1.5;
  for (final PathMetric metric
      in (Path()..addRRect(ringCentre)).computeMetrics()) {
    for (double d = 0; d < metric.length; d += 1) {
      final Tangent t = metric.getTangentForOffset(d)!;
      // Clockwise path in y-down space: the outward normal is (ty, -tx).
      final Offset outward = Offset(t.vector.dy, -t.vector.dx);
      samples++;
      final Color? centre = pixelAt(t.position);
      if (centre != null && matches(centre)) visible++;
      for (final Offset n in <Offset>[outward, -outward]) {
        final Color? adjacent = pixelAt(t.position + n * side);
        if (adjacent == null) continue;
        final double c = contrastRatio(
          Color.fromARGB(
            255,
            (ring.r * 255).round(),
            (ring.g * 255).round(),
            (ring.b * 255).round(),
          ),
          adjacent,
        );
        if (c < minContrast) minContrast = c;
      }
    }
  }
  return RingVisibility(
    samples: samples,
    visible: visible,
    minContrast: minContrast,
  );
}
