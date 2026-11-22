import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'tokens/gv_primer_palette.dart';

/// An approved Primer V2 gradient, recorded exactly as the frozen
/// specification writes it: a CSS `linear-gradient` angle with colour stops.
///
/// The angle keeps CSS semantics (0° points up, angles turn clockwise, and the
/// gradient line is sized so the 0% and 100% stops land on the box corners),
/// so a widget renders the approved composition at any aspect ratio instead
/// of an approximation fixed to one shape. [toGradient] produces the Flutter
/// [LinearGradient].
@immutable
class GvPrimerGradient {
  const GvPrimerGradient({
    required this.angleDegrees,
    required this.colors,
    required this.stops,
  });

  /// CSS gradient angle, in degrees.
  final double angleDegrees;
  final List<Color> colors;

  /// Stop positions from 0 to 1, one per colour ([LinearGradient] asserts the
  /// lengths match when [toGradient] builds it).
  final List<double> stops;

  /// This gradient as a Flutter [LinearGradient] with CSS angle semantics.
  LinearGradient toGradient() => LinearGradient(
    colors: colors,
    stops: stops,
    transform: GvCssAngleGradientTransform(angleDegrees),
  );

  /// Interpolates two gradients for theme transitions. Gradients of a
  /// different shape (angle or stop count) cannot be blended meaningfully, so
  /// they switch at the midpoint.
  static GvPrimerGradient? lerp(
    GvPrimerGradient? a,
    GvPrimerGradient? b,
    double t,
  ) {
    if (identical(a, b)) return a;
    if (a == null || b == null) return t < 0.5 ? a : b;
    if (a.angleDegrees != b.angleDegrees ||
        a.colors.length != b.colors.length) {
      return t < 0.5 ? a : b;
    }
    return GvPrimerGradient(
      angleDegrees: a.angleDegrees,
      colors: <Color>[
        for (int i = 0; i < a.colors.length; i++)
          Color.lerp(a.colors[i], b.colors[i], t)!,
      ],
      stops: <double>[
        for (int i = 0; i < a.stops.length; i++)
          a.stops[i] + (b.stops[i] - a.stops[i]) * t,
      ],
    );
  }
}

/// Maps a horizontal [LinearGradient] (the default `centerLeft` to
/// `centerRight`) onto the CSS gradient line for [angleDegrees].
///
/// CSS defines the gradient line through the box centre, pointing at the
/// angle, with length `|w·sin θ| + |h·cos θ|`; this transform scales the
/// horizontal line to that length and rotates it about the centre.
class GvCssAngleGradientTransform extends GradientTransform {
  const GvCssAngleGradientTransform(this.angleDegrees);

  final double angleDegrees;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    if (bounds.width == 0) return null;
    final double theta = angleDegrees * math.pi / 180;
    final double length =
        (bounds.width * math.sin(theta)).abs() +
        (bounds.height * math.cos(theta)).abs();
    final Offset c = bounds.center;
    return Matrix4.identity()
      ..translateByDouble(c.dx, c.dy, 0, 1)
      ..rotateZ(theta - math.pi / 2)
      ..scaleByDouble(length / bounds.width, 1, 1, 1)
      ..translateByDouble(-c.dx, -c.dy, 0, 1);
  }
}

/// Theme-invariant Primer V2 decorative effects (layer 5).
///
/// Effects never carry information and are never reused as roles. The three
/// retained decorative gradients are identical in Dark and Light (DK-6,
/// LT-10); only their shadows differ per theme, and shadows are deferred to
/// the shared widgets that draw them.
abstract final class GvPrimerEffects {
  /// Start stop of the retained brand gradient. A contextual value, not a
  /// token: it exists only inside the two gradients below (DK-6).
  static const Color _brandGradientStart = Color(0xFFB04633);

  /// `effect.brand-gradient` for the Home hero round block:
  /// `linear-gradient(165deg, #B04633 0%, oxide 45%, oxide-deep 100%)`.
  static const GvPrimerGradient brandGradientHero = GvPrimerGradient(
    angleDegrees: 165,
    colors: <Color>[
      _brandGradientStart,
      GvPrimerPalette.oxide600,
      GvPrimerPalette.oxide700,
    ],
    stops: <double>[0, 0.45, 1],
  );

  /// `effect.brand-gradient` with oxide at 55%, for the Driver identity plate
  /// and the GP winner position cell.
  static const GvPrimerGradient brandGradientPlate = GvPrimerGradient(
    angleDegrees: 165,
    colors: <Color>[
      _brandGradientStart,
      GvPrimerPalette.oxide600,
      GvPrimerPalette.oxide700,
    ],
    stops: <double>[0, 0.55, 1],
  );

  /// End stop of the Dark band lighting. A Dark lighting value inside an
  /// effect, never a role.
  static const Color _bandLightingEnd = Color(0xFF1B1D20);

  /// Dark band lighting (Calendar current row, Home):
  /// `linear-gradient(180deg, tray 0%, #1B1D20 100%)`, as in the approved
  /// Calendar and Home prototypes. Light uses the flat band instead, so this
  /// effect has no Light value.
  static const GvPrimerGradient bandLightingDark = GvPrimerGradient(
    angleDegrees: 180,
    colors: <Color>[GvPrimerPalette.graphite800, _bandLightingEnd],
    stops: <double>[0, 1],
  );

  /// Shadow under the inverse plane (Standings leader row): Dark
  /// `0 16px 28px -22px` black 90% (`standings.css`); Light
  /// `0 18px 30px -22px` Graphite 60% (`LIGHT-THEME-ROLES.md` `effect.shadow`).
  /// Depth only, never information.
  static List<BoxShadow> inversePlaneShadow(Brightness brightness) =>
      brightness == Brightness.dark
      ? const <BoxShadow>[
          BoxShadow(
            color: Color(0xE6000000),
            offset: Offset(0, 16),
            blurRadius: 28,
            spreadRadius: -22,
          ),
        ]
      : <BoxShadow>[
          BoxShadow(
            color: GvPrimerPalette.graphite900.withValues(alpha: 0.60),
            offset: const Offset(0, 18),
            blurRadius: 30,
            spreadRadius: -22,
          ),
        ];

  /// Shadow beside the Calendar next-event round block: `10px 0 24px -14px`,
  /// black 60% in Dark (`calendar.css`), Graphite 30% in Light
  /// (`LIGHT-THEME-ROLES.md` `effect.shadow`).
  static List<BoxShadow> roundBlockShadow(Brightness brightness) => <BoxShadow>[
    BoxShadow(
      color: brightness == Brightness.dark
          ? const Color(0x99000000)
          : GvPrimerPalette.graphite900.withValues(alpha: 0.30),
      offset: const Offset(10, 0),
      blurRadius: 24,
      spreadRadius: -14,
    ),
  ];
}
