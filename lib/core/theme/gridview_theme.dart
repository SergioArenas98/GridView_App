import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gv_semantic_colors.dart';
import 'tokens/tokens.dart';

const ColorScheme _darkScheme = ColorScheme(
  brightness: Brightness.dark,
  primary: GvColors.accentPrimary,
  onPrimary: GvColors.onAccentPrimary,
  secondary: GvColors.accentSecondary,
  onSecondary: GvColors.onAccentSecondary,
  error: GvColors.accentPrimary,
  onError: Color(0xFFFFFFFF),
  surface: GvColors.surface,
  onSurface: GvColors.textPrimary,
  onSurfaceVariant: GvColors.textMuted,
  surfaceContainerHighest: GvColors.surfaceElevatedAlt,
  outline: GvColors.divider,
);

const TextTheme _textTheme = TextTheme(
  displayLarge: GvTypography.displayXl,
  displayMedium: GvTypography.displayL,
  headlineLarge: GvTypography.pageTitle,
  titleLarge: GvTypography.sectionTitle,
  titleMedium: GvTypography.cardTitle,
  bodyLarge: GvTypography.bodyL,
  bodyMedium: GvTypography.bodyM,
  labelLarge: GvTypography.label,
  labelSmall: GvTypography.caption,
);

const SystemUiOverlayStyle _systemOverlay = SystemUiOverlayStyle(
  statusBarColor: Color(0x00000000),
  statusBarBrightness: Brightness.dark,
  statusBarIconBrightness: Brightness.light,
  systemNavigationBarColor: GvColors.background,
  systemNavigationBarIconBrightness: Brightness.light,
);

/// The GridView dark-first Material 3 theme. Light theme is intentionally not
/// implemented in Phase 3A; the token and extension architecture supports adding
/// one later.
ThemeData buildGridViewDarkTheme() {
  final ThemeData base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: _darkScheme,
    scaffoldBackgroundColor: GvColors.background,
    canvasColor: GvColors.background,
    textTheme: _textTheme,
    dividerColor: GvColors.divider,
    extensions: const <ThemeExtension<dynamic>>[GvSemanticColors.dark],
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: GvColors.background,
      foregroundColor: GvColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: GvTypography.sectionTitle,
      systemOverlayStyle: _systemOverlay,
    ),
    dividerTheme: const DividerThemeData(
      color: GvColors.divider,
      thickness: 1,
      space: 1,
    ),
    cardTheme: const CardThemeData(
      color: GvColors.surfaceElevated,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: GvRadii.lgAll),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: GvColors.surfaceElevatedAlt,
      labelStyle: GvTypography.label,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(
        horizontal: GvSpacing.sm,
        vertical: GvSpacing.xxs,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: GvColors.accentPrimary,
        foregroundColor: GvColors.onAccentPrimary,
        disabledBackgroundColor: GvColors.surfaceElevatedAlt,
        disabledForegroundColor: GvColors.textDisabled,
        elevation: 0,
        minimumSize: const Size(0, GvLayout.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: GvSpacing.lg),
        textStyle: GvTypography.label.copyWith(fontSize: 15),
        shape: const RoundedRectangleBorder(borderRadius: GvRadii.mdAll),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: GvColors.textPrimary,
        disabledForegroundColor: GvColors.textDisabled,
        minimumSize: const Size(0, GvLayout.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: GvSpacing.lg),
        side: const BorderSide(color: GvColors.divider),
        textStyle: GvTypography.label.copyWith(fontSize: 15),
        shape: const RoundedRectangleBorder(borderRadius: GvRadii.mdAll),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: GvColors.textPrimary,
        minimumSize: const Size(
          GvLayout.minTouchTarget,
          GvLayout.minTouchTarget,
        ),
        tapTargetSize: MaterialTapTargetSize.padded,
      ),
    ),
  );
}
