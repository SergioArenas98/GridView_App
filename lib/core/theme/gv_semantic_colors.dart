import 'package:flutter/material.dart';

import 'tokens/gv_colors.dart';
import 'tokens/gv_colors_light.dart';

/// Every semantic colour role GridView widgets are allowed to read.
///
/// The extension carries the *whole* palette — not only the roles that do not
/// fit Material's [ColorScheme] — so a feature widget never reaches for a raw
/// token and never branches on [Brightness] itself. Adding the light theme is
/// therefore a change of one value here, not a change in every widget.
///
/// Accessed via `context.gvColors`.
@immutable
class GvSemanticColors extends ThemeExtension<GvSemanticColors> {
  const GvSemanticColors({
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.surfaceElevatedAlt,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.divider,
    required this.accentPrimary,
    required this.accentPrimaryStrong,
    required this.accentSecondary,
    required this.onAccentPrimary,
    required this.onAccentSecondary,
    required this.heroScrimTop,
    required this.heroScrimBottom,
    required this.success,
    required this.warning,
    required this.info,
    required this.stale,
    required this.tertiary,
  });

  // Surfaces.
  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color surfaceElevatedAlt;

  // Text.
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDisabled;

  // Lines.
  final Color divider;

  // Accents.
  final Color accentPrimary;

  /// The red used behind white text (filled primary surfaces). See
  /// `GvColors.accentPrimaryStrong`.
  final Color accentPrimaryStrong;
  final Color accentSecondary;
  final Color onAccentPrimary;
  final Color onAccentSecondary;

  /// The two stops of the hero scrim, top then bottom.
  ///
  /// A hero draws text over arbitrary imagery, so the image is faded toward the
  /// page background to give that text a readable base. Both stops are therefore
  /// theme-owned: a hardcoded dark scrim would turn the light theme's dark text
  /// into dark-on-dark. The bottom stop is the theme background at 80%, which is
  /// what makes the fade read as "into the page" rather than as a grey wash.
  final Color heroScrimTop;
  final Color heroScrimBottom;

  // Status.
  final Color success;
  final Color warning;
  final Color info;
  final Color stale;
  final Color tertiary;

  /// The flagship GridView dark palette.
  static const GvSemanticColors dark = GvSemanticColors(
    background: GvColors.background,
    surface: GvColors.surface,
    surfaceElevated: GvColors.surfaceElevated,
    surfaceElevatedAlt: GvColors.surfaceElevatedAlt,
    textPrimary: GvColors.textPrimary,
    textSecondary: GvColors.textSecondary,
    textMuted: GvColors.textMuted,
    textDisabled: GvColors.textDisabled,
    divider: GvColors.divider,
    accentPrimary: GvColors.accentPrimary,
    accentPrimaryStrong: GvColors.accentPrimaryStrong,
    accentSecondary: GvColors.accentSecondary,
    onAccentPrimary: GvColors.onAccentPrimary,
    onAccentSecondary: GvColors.onAccentSecondary,
    heroScrimTop: Color(0x33000000),
    heroScrimBottom: Color(0xCC0B0D12),
    success: GvColors.success,
    warning: GvColors.warning,
    info: GvColors.accentSecondary,
    stale: GvColors.warning,
    tertiary: GvColors.tertiary,
  );

  /// The light palette. Same roles, same hierarchy, contrast-corrected accents.
  static const GvSemanticColors light = GvSemanticColors(
    background: GvColorsLight.background,
    surface: GvColorsLight.surface,
    surfaceElevated: GvColorsLight.surfaceElevated,
    surfaceElevatedAlt: GvColorsLight.surfaceElevatedAlt,
    textPrimary: GvColorsLight.textPrimary,
    textSecondary: GvColorsLight.textSecondary,
    textMuted: GvColorsLight.textMuted,
    textDisabled: GvColorsLight.textDisabled,
    divider: GvColorsLight.divider,
    accentPrimary: GvColorsLight.accentPrimary,
    accentPrimaryStrong: GvColorsLight.accentPrimaryStrong,
    accentSecondary: GvColorsLight.accentSecondary,
    onAccentPrimary: GvColorsLight.onAccentPrimary,
    onAccentSecondary: GvColorsLight.onAccentSecondary,
    heroScrimTop: Color(0x33FFFFFF),
    heroScrimBottom: Color(0xCCF1F4F9),
    success: GvColorsLight.success,
    warning: GvColorsLight.warning,
    info: GvColorsLight.accentSecondary,
    stale: GvColorsLight.warning,
    tertiary: GvColorsLight.tertiary,
  );

  @override
  GvSemanticColors copyWith({
    Color? background,
    Color? surface,
    Color? surfaceElevated,
    Color? surfaceElevatedAlt,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? textDisabled,
    Color? divider,
    Color? accentPrimary,
    Color? accentPrimaryStrong,
    Color? accentSecondary,
    Color? onAccentPrimary,
    Color? onAccentSecondary,
    Color? heroScrimTop,
    Color? heroScrimBottom,
    Color? success,
    Color? warning,
    Color? info,
    Color? stale,
    Color? tertiary,
  }) {
    return GvSemanticColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      surfaceElevatedAlt: surfaceElevatedAlt ?? this.surfaceElevatedAlt,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      textDisabled: textDisabled ?? this.textDisabled,
      divider: divider ?? this.divider,
      accentPrimary: accentPrimary ?? this.accentPrimary,
      accentPrimaryStrong: accentPrimaryStrong ?? this.accentPrimaryStrong,
      accentSecondary: accentSecondary ?? this.accentSecondary,
      onAccentPrimary: onAccentPrimary ?? this.onAccentPrimary,
      onAccentSecondary: onAccentSecondary ?? this.onAccentSecondary,
      heroScrimTop: heroScrimTop ?? this.heroScrimTop,
      heroScrimBottom: heroScrimBottom ?? this.heroScrimBottom,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
      stale: stale ?? this.stale,
      tertiary: tertiary ?? this.tertiary,
    );
  }

  @override
  GvSemanticColors lerp(GvSemanticColors? other, double t) {
    if (other == null) return this;
    return GvSemanticColors(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      surfaceElevatedAlt: Color.lerp(
        surfaceElevatedAlt,
        other.surfaceElevatedAlt,
        t,
      )!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      accentPrimary: Color.lerp(accentPrimary, other.accentPrimary, t)!,
      accentPrimaryStrong: Color.lerp(
        accentPrimaryStrong,
        other.accentPrimaryStrong,
        t,
      )!,
      accentSecondary: Color.lerp(accentSecondary, other.accentSecondary, t)!,
      onAccentPrimary: Color.lerp(onAccentPrimary, other.onAccentPrimary, t)!,
      onAccentSecondary: Color.lerp(
        onAccentSecondary,
        other.onAccentSecondary,
        t,
      )!,
      heroScrimTop: Color.lerp(heroScrimTop, other.heroScrimTop, t)!,
      heroScrimBottom: Color.lerp(heroScrimBottom, other.heroScrimBottom, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      stale: Color.lerp(stale, other.stale, t)!,
      tertiary: Color.lerp(tertiary, other.tertiary, t)!,
    );
  }
}

/// Convenient access to GridView semantic colors from a [BuildContext].
extension GvSemanticColorsX on BuildContext {
  GvSemanticColors get gvColors =>
      Theme.of(this).extension<GvSemanticColors>() ?? GvSemanticColors.dark;
}
