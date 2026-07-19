import 'package:flutter/widgets.dart';

import 'gv_colors.dart';

/// Intended font families. The approved pairing is Sora (headings) + Inter
/// (body/UI). The licensed font assets are NOT yet in the repository, so these
/// are `null` and text falls back to the platform font. When the licensed
/// Sora/Inter TTFs are added under `assets/fonts/` and declared in `pubspec.yaml`,
/// set these to `'Sora'` / `'Inter'`. See docs/technical/GridView_Design_System.md.
abstract final class GvFonts {
  static const String? heading = null; // pending -> 'Sora'
  static const String? body = null; // pending -> 'Inter'
}

/// Typographic scale. Source: GridView_UI_UX_Design.md section 8.
/// Sizes are unscaled; Android text scaling is applied by the framework.
abstract final class GvTypography {
  static const List<FontFeature> _tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  static const TextStyle displayXl = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 42,
    height: 1.1,
    fontWeight: FontWeight.w700,
    color: GvColors.textPrimary,
  );

  static const TextStyle displayL = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 34,
    height: 1.15,
    fontWeight: FontWeight.w700,
    color: GvColors.textPrimary,
  );

  static const TextStyle pageTitle = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 28,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: GvColors.textPrimary,
  );

  static const TextStyle sectionTitle = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 20,
    height: 1.25,
    fontWeight: FontWeight.w600,
    color: GvColors.textPrimary,
  );

  static const TextStyle cardTitle = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 18,
    height: 1.3,
    fontWeight: FontWeight.w600,
    color: GvColors.textPrimary,
  );

  static const TextStyle bodyL = TextStyle(
    fontFamily: GvFonts.body,
    fontSize: 16,
    height: 1.45,
    fontWeight: FontWeight.w400,
    color: GvColors.textSecondary,
  );

  static const TextStyle bodyM = TextStyle(
    fontFamily: GvFonts.body,
    fontSize: 14,
    height: 1.45,
    fontWeight: FontWeight.w400,
    color: GvColors.textSecondary,
  );

  static const TextStyle label = TextStyle(
    fontFamily: GvFonts.body,
    fontSize: 12,
    height: 1.3,
    fontWeight: FontWeight.w500,
    color: GvColors.textMuted,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: GvFonts.body,
    fontSize: 11,
    height: 1.3,
    fontWeight: FontWeight.w400,
    color: GvColors.textMuted,
  );

  /// Large statistics (points, positions, countdowns) with tabular figures.
  static const TextStyle statValue = TextStyle(
    fontFamily: GvFonts.heading,
    fontSize: 24,
    height: 1.1,
    fontWeight: FontWeight.w700,
    color: GvColors.textPrimary,
    fontFeatures: _tabular,
  );
}
