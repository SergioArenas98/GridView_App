import 'package:flutter/widgets.dart';

/// Helpers for applying team colors as accents safely. Team colors are decorative
/// and may fail contrast, so they must never be the sole carrier of meaning
/// (GridView_UI_UX_Design.md sections 7.2, 18).
abstract final class GvTeamAccent {
  /// A contrast-safe foreground (near-black or near-white) for content placed on
  /// [background].
  ///
  /// The choice is made by **measured WCAG contrast**, not by comparing
  /// luminance against a threshold. A fixed threshold picks the wrong side for
  /// mid-luminance liveries — a saturated orange sits just below any sensible
  /// cut-off yet is far more readable with dark text than light — so it could
  /// return a foreground at barely 2.3:1. Measuring both candidates and keeping
  /// the better one is correct for every colour by construction.
  /// The candidates are pure black and pure white rather than GridView's near-
  /// black and near-white neutrals. A team colour is arbitrary brand input, and
  /// for the hardest cases — a saturated mid-luminance red such as `#E8002D` —
  /// the extra headroom is exactly what carries the pair over 4.5:1 (4.70:1 with
  /// pure white, 4.38:1 with the near-white neutral).
  static Color foregroundOn(Color background) =>
      prefersDarkForeground(background) ? _pureBlack : _pureWhite;

  /// Whether a readable foreground on [background] is dark.
  static bool prefersDarkForeground(Color background) =>
      _contrast(_pureBlack, background) >= _contrast(_pureWhite, background);

  static const Color _pureBlack = Color(0xFF000000);
  static const Color _pureWhite = Color(0xFFFFFFFF);

  /// WCAG 2.1 contrast ratio between two opaque colours.
  static double _contrast(Color a, Color b) {
    final double la = a.computeLuminance();
    final double lb = b.computeLuminance();
    final double lighter = la > lb ? la : lb;
    final double darker = la > lb ? lb : la;
    return (lighter + 0.05) / (darker + 0.05);
  }

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
