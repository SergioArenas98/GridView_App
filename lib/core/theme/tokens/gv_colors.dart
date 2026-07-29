import 'package:flutter/widgets.dart';

/// Raw GridView color tokens. Source of truth:
/// docs/product/GridView_UI_UX_Design.md section 7. Widgets must read colors
/// from the theme / semantic helpers, not from these raw values directly.
abstract final class GvColors {
  // Background / surface tones (deepest -> most elevated).
  static const Color background = Color(0xFF0B0D12);
  static const Color surface = Color(0xFF11151C);
  static const Color surfaceElevated = Color(0xFF171C24);
  static const Color surfaceElevatedAlt = Color(0xFF202734);

  // Neutral / text tones.
  static const Color textPrimary = Color(0xFFF5F7FA);
  static const Color textSecondary = Color(0xFFD9DEE7);
  static const Color textMuted = Color(0xFFA1AAB8);
  static const Color textDisabled = Color(0xFF697386);
  static const Color divider = Color(0xFF2D3645);

  // Accents.
  static const Color accentPrimary = Color(0xFFFF3B30); // race-energy red

  /// The red used **behind white text** (the filled primary button).
  ///
  /// [accentPrimary] is the decorative/emphasis red and is used for bars, icons,
  /// chips and selection indicators, where it only has to reach the 3:1 required
  /// of a non-text UI component. White on it measures 3.55:1, which is below AA
  /// for the button's 15px label, so filled surfaces use this darker red (4.8:1
  /// with white) instead. Same hue, same role, readable label.
  static const Color accentPrimaryStrong = Color(0xFFDC2626);

  static const Color accentSecondary = Color(0xFF3B82F6); // informational blue

  // Supporting semantic accents.
  static const Color warning = Color(0xFFF59E0B);
  static const Color success = Color(0xFF22C55E);
  static const Color tertiary = Color(0xFF8B5CF6);

  // On-accent foregrounds.
  static const Color onAccentPrimary = Color(0xFFFFFFFF);
  static const Color onAccentSecondary = Color(0xFFFFFFFF);
}
