import 'package:flutter/material.dart';

import 'tokens/gv_colors.dart';

/// Semantic colors that do not map cleanly onto Material's [ColorScheme] slots.
/// Accessed via `Theme.of(context).extension<GvSemanticColors>()` or the
/// `context.gvColors` helper.
@immutable
class GvSemanticColors extends ThemeExtension<GvSemanticColors> {
  const GvSemanticColors({
    required this.success,
    required this.warning,
    required this.info,
    required this.stale,
    required this.divider,
    required this.surfaceElevated,
    required this.surfaceElevatedAlt,
    required this.textMuted,
    required this.textDisabled,
  });

  final Color success;
  final Color warning;
  final Color info;
  final Color stale;
  final Color divider;
  final Color surfaceElevated;
  final Color surfaceElevatedAlt;
  final Color textMuted;
  final Color textDisabled;

  static const GvSemanticColors dark = GvSemanticColors(
    success: GvColors.success,
    warning: GvColors.warning,
    info: GvColors.accentSecondary,
    stale: GvColors.warning,
    divider: GvColors.divider,
    surfaceElevated: GvColors.surfaceElevated,
    surfaceElevatedAlt: GvColors.surfaceElevatedAlt,
    textMuted: GvColors.textMuted,
    textDisabled: GvColors.textDisabled,
  );

  @override
  GvSemanticColors copyWith({
    Color? success,
    Color? warning,
    Color? info,
    Color? stale,
    Color? divider,
    Color? surfaceElevated,
    Color? surfaceElevatedAlt,
    Color? textMuted,
    Color? textDisabled,
  }) {
    return GvSemanticColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
      stale: stale ?? this.stale,
      divider: divider ?? this.divider,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      surfaceElevatedAlt: surfaceElevatedAlt ?? this.surfaceElevatedAlt,
      textMuted: textMuted ?? this.textMuted,
      textDisabled: textDisabled ?? this.textDisabled,
    );
  }

  @override
  GvSemanticColors lerp(GvSemanticColors? other, double t) {
    if (other == null) return this;
    return GvSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      stale: Color.lerp(stale, other.stale, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      surfaceElevatedAlt: Color.lerp(
        surfaceElevatedAlt,
        other.surfaceElevatedAlt,
        t,
      )!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
    );
  }
}

/// Convenient access to GridView semantic colors from a [BuildContext].
extension GvSemanticColorsX on BuildContext {
  GvSemanticColors get gvColors =>
      Theme.of(this).extension<GvSemanticColors>() ?? GvSemanticColors.dark;
}
