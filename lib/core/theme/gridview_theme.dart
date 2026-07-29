import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gv_semantic_colors.dart';
import 'gv_text_styles.dart';
import 'tokens/tokens.dart';

/// Builds the flagship GridView **dark** theme (Material 3).
///
/// Dark remains GridView's default and its design reference. The light theme
/// below is produced from the same component configuration and the same
/// typographic hierarchy — only the palette differs — so the two can never drift
/// apart structurally.
ThemeData buildGridViewDarkTheme() =>
    _buildTheme(Brightness.dark, GvSemanticColors.dark, GvTextStyles.dark);

/// Builds the GridView **light** theme (Phase 8 §5).
///
/// Same layouts, same information hierarchy, same restrained red emphasis;
/// cool off-white and light-neutral surfaces, contrast-corrected accents, and
/// dark system-bar icons.
ThemeData buildGridViewLightTheme() =>
    _buildTheme(Brightness.light, GvSemanticColors.light, GvTextStyles.light);

ThemeData _buildTheme(
  Brightness brightness,
  GvSemanticColors colors,
  GvTextStyles text,
) {
  final ColorScheme scheme = ColorScheme(
    brightness: brightness,
    primary: colors.accentPrimary,
    onPrimary: colors.onAccentPrimary,
    secondary: colors.accentSecondary,
    onSecondary: colors.onAccentSecondary,
    error: colors.accentPrimary,
    onError: colors.onAccentPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textMuted,
    surfaceContainerHighest: colors.surfaceElevatedAlt,
    outline: colors.divider,
  );

  final ThemeData base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors.background,
    canvasColor: colors.background,
    textTheme: text.textTheme,
    dividerColor: colors.divider,
    extensions: <ThemeExtension<dynamic>>[colors, text],
  );

  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: colors.background,
      foregroundColor: colors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: text.sectionTitle,
      systemOverlayStyle: _overlayFor(brightness, colors),
    ),
    dividerTheme: DividerThemeData(
      color: colors.divider,
      thickness: 1,
      space: 1,
    ),
    cardTheme: CardThemeData(
      color: colors.surfaceElevated,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: const RoundedRectangleBorder(borderRadius: GvRadii.lgAll),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: colors.surfaceElevatedAlt,
      labelStyle: text.label,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(
        horizontal: GvSpacing.sm,
        vertical: GvSpacing.xxs,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: colors.accentPrimaryStrong,
        foregroundColor: colors.onAccentPrimary,
        disabledBackgroundColor: colors.surfaceElevatedAlt,
        disabledForegroundColor: colors.textDisabled,
        elevation: 0,
        minimumSize: const Size(0, GvLayout.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: GvSpacing.lg),
        textStyle: text.label.copyWith(fontSize: 15),
        shape: const RoundedRectangleBorder(borderRadius: GvRadii.mdAll),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        disabledForegroundColor: colors.textDisabled,
        minimumSize: const Size(0, GvLayout.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: GvSpacing.lg),
        side: BorderSide(color: colors.divider),
        textStyle: text.label.copyWith(fontSize: 15),
        shape: const RoundedRectangleBorder(borderRadius: GvRadii.mdAll),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: colors.textPrimary,
        minimumSize: const Size(
          GvLayout.minTouchTarget,
          GvLayout.minTouchTarget,
        ),
        tapTargetSize: MaterialTapTargetSize.padded,
      ),
    ),
  );
}

/// System status- and navigation-bar styling for [brightness].
///
/// The icon brightness is the *inverse* of the surface behind it: light icons on
/// the dark theme's near-black bars, dark icons on the light theme's off-white
/// bars. Getting this wrong is the classic "invisible status bar" bug, so it is
/// derived here once rather than per screen.
SystemUiOverlayStyle _overlayFor(
  Brightness brightness,
  GvSemanticColors colors,
) {
  final bool isDark = brightness == Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: const Color(0x00000000),
    statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
    statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
    systemNavigationBarColor: colors.background,
    systemNavigationBarIconBrightness: isDark
        ? Brightness.light
        : Brightness.dark,
  );
}
