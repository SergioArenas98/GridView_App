import 'dart:math' as math;

import 'package:flutter/painting.dart';

/// The bundled Primer V2 typeface.
///
/// Archivo, Version 2.001, from google/fonts `ofl/archivo` (SIL Open Font
/// License 1.1). One variable file (`wght` 100–900, `wdth` 62–125) is declared
/// in `pubspec.yaml`; provenance and checksum in
/// `assets/fonts/archivo/README.md`.
abstract final class GvPrimerFonts {
  static const String archivo = 'Archivo';
}

/// Primer V2 text styles (Archivo), used only by Primer V2 components and the
/// development catalogue. The legacy `GvTypography` / `TextTheme` are
/// unchanged.
///
/// **Weight behaviour (measured in Flutter 3.44, Step 55B.1).** Flutter maps a
/// [FontWeight] onto Archivo's `wght` axis by itself, with no synthetic bold,
/// and an explicit `wght` [FontVariation] overrides the [FontWeight]. So a
/// style always carries the nearest standard [FontWeight] (which keeps the
/// platform "bold text" setting meaningful) and adds an explicit `wght` only
/// for the approved intermediate weights (650, 750, 820, 830, 850), which no
/// [FontWeight] step can express. Width is the `wdth` axis (100 = normal).
///
/// Colour is never part of these styles: a component applies the role colour
/// of the surface it sits on.
abstract final class GvPrimerTypography {
  /// An Archivo style at the given CSS-equivalent [weight] (100–900) and
  /// [width] (`wdth`, 62–125).
  static TextStyle archivo({
    required double size,
    required int weight,
    double width = 100,
    double? height,
    bool tabularFigures = false,
  }) {
    assert(weight >= 100 && weight <= 900);
    assert(width >= 62 && width <= 125);
    final bool standardStep = weight % 100 == 0;
    return TextStyle(
      fontFamily: GvPrimerFonts.archivo,
      fontSize: size,
      height: height,
      fontWeight: _nearestWeight(weight),
      fontVariations: <FontVariation>[
        if (!standardStep) FontVariation('wght', weight.toDouble()),
        if (width != 100) FontVariation('wdth', width),
      ],
      fontFeatures: tabularFigures
          ? const <FontFeature>[
              FontFeature.tabularFigures(),
              FontFeature.liningFigures(),
            ]
          : null,
    );
  }

  /// The nearest standard [FontWeight] to a CSS weight (ties round down, so a
  /// 650 reports as w600 and a 750 as w700).
  static FontWeight _nearestWeight(int weight) {
    final int index = ((weight - 50) / 100).ceil() - 1;
    return FontWeight.values[index.clamp(0, FontWeight.values.length - 1)];
  }

  /// The rendered size of a display figure written `min(<size>, <cap>px)`
  /// (Android-like capping of large figures): [size] scaled by [scaler], never
  /// above [cap]. Render it with [TextScaler.noScaling], since the scaling is
  /// already applied.
  static double cappedSize(TextScaler scaler, double size, double cap) =>
      math.min(scaler.scale(size), cap);

  /// Body copy: 15px, line height 1.45, weight 400, width 100 (`base.css`).
  static final TextStyle body = archivo(size: 15, weight: 400, height: 1.45);

  /// Status-chip label: 13px (the Primer text floor), weight 600, line height
  /// 1.2 (`chip.css`).
  static final TextStyle chipLabel = archivo(
    size: 13,
    weight: 600,
    height: 1.2,
  );
}
