import 'dart:math' as math;

import 'package:flutter/painting.dart';

/// Primer V2 shared layout values (logical pixels), identical in both themes
/// (`CROSS-THEME-CONSOLIDATION.md` §2, `shared/tokens.css`).
///
/// The legacy `GvRadii` / `GvSpacing` scales (gutter 20, radius 12) are a
/// different system and stay untouched for the legacy widgets.
abstract final class GvPrimerLayout {
  /// Screen gutter (`--gutter`).
  static const double gutter = 16;

  /// Radii (`--radius-sm`, `--radius-md`, `--radius-lg`).
  static const double radiusSm = 8;
  static const double radiusMd = 14;
  static const double radiusLg = 20;

  /// Minimum touch target in both dimensions.
  static const double minTarget = 48;

  /// The root font size the prototypes' `rem` lengths are relative to.
  static const double rootFontSize = 16;

  /// The body font size the editorial lists inherit (`base.css` 0.9375rem);
  /// their container queries are written in `em` of it.
  static const double bodyFontSize = 15;

  /// How a `rem` length scales under [scaler]: what it does to the 16px root
  /// (non-linear scalers enlarge small text more than large text).
  static double remScale(TextScaler scaler) =>
      scaler.scale(rootFontSize) / rootFontSize;

  /// A layout length written `min(<rem>rem, <cap>px)` in the prototypes:
  /// [rem] root units, never wider than [cap] pixels.
  static double cappedRem(TextScaler scaler, double rem, double cap) =>
      math.min(rem * rootFontSize * remScale(scaler), cap);

  /// The width below which a list written `@container (max-width: <em>em)`
  /// switches to its narrow layout, under [scaler].
  static double containerEm(TextScaler scaler, double em) =>
      em * scaler.scale(bodyFontSize);
}
