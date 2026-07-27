import 'package:flutter/widgets.dart';

import 'tokens/gv_colors.dart';

/// Helpers for applying team colors as accents safely. Team colors are decorative
/// and may fail contrast, so they must never be the sole carrier of meaning
/// (GridView_UI_UX_Design.md sections 7.2, 18).
abstract final class GvTeamAccent {
  /// A contrast-safe foreground (near-black or near-white) for content placed on
  /// [background], chosen by relative luminance.
  static Color foregroundOn(Color background) {
    return background.computeLuminance() > 0.45
        ? GvColors.background
        : GvColors.textPrimary;
  }

  /// Whether a readable foreground on [background] is dark.
  static bool prefersDarkForeground(Color background) =>
      background.computeLuminance() > 0.45;

  /// Parses a contract `#RRGGBB` team colour.
  ///
  /// Returns `null` for a missing or malformed value so a caller simply renders
  /// no accent: a colour is decorative, so an unparseable one is never a failure
  /// and never a fabricated default team colour.
  static Color? parse(String? hex) {
    if (hex == null) return null;
    final String value = hex.trim();
    if (value.length != 7 || !value.startsWith('#')) return null;
    final int? rgb = int.tryParse(value.substring(1), radix: 16);
    if (rgb == null) return null;
    return Color(0xFF000000 | rgb);
  }
}
