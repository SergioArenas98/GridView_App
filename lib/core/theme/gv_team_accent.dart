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
}
