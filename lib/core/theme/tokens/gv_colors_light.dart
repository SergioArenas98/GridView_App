import 'package:flutter/widgets.dart';

/// Raw GridView **light** colour tokens (Phase 8 §5).
///
/// The light theme keeps the dark theme's information hierarchy and restrained
/// red emphasis; it is a re-tone, not a redesign. Surfaces are cool off-white
/// and light neutrals rather than large areas of harsh pure white — pure white
/// is reserved for small elevated cards, where it reads as elevation.
///
/// Accents are darkened relative to the dark theme because the dark theme's
/// saturated accents do not reach text contrast on a light surface. Team colours
/// are unchanged in both themes: they are decorative, never semantic, and any
/// text placed on them goes through `GvTeamAccent.foregroundOn`.
///
/// Widgets must read colours from the theme (`context.gvColors`), not from these
/// raw values directly. Every pair below is asserted by the contrast tests in
/// `test/design_system/theme_contrast_test.dart`.
abstract final class GvColorsLight {
  // Background / surface tones (deepest -> most elevated).
  static const Color background = Color(0xFFF1F4F9);
  static const Color surface = Color(0xFFF7F9FC);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceElevatedAlt = Color(0xFFE5EAF2);

  // Neutral / text tones.
  static const Color textPrimary = Color(0xFF0F131A);
  static const Color textSecondary = Color(0xFF333C4A);
  static const Color textMuted = Color(0xFF566070);
  static const Color textDisabled = Color(0xFF7A8493);
  static const Color divider = Color(0xFFC7D0DE);

  // Accents. Darkened for contrast on light surfaces; the hue and the
  // "restrained red" role are preserved.
  static const Color accentPrimary = Color(0xFFC62719); // race-energy red

  /// The red used behind white text. On light surfaces the emphasis red already
  /// reaches 5.7:1 with white, so no darker variant is needed.
  static const Color accentPrimaryStrong = accentPrimary;
  static const Color accentSecondary = Color(0xFF1D4ED8); // informational blue

  // Supporting semantic accents.
  static const Color warning = Color(0xFF9A5B08);
  static const Color success = Color(0xFF12703A);
  static const Color tertiary = Color(0xFF5B21B6);

  // On-accent foregrounds.
  static const Color onAccentPrimary = Color(0xFFFFFFFF);
  static const Color onAccentSecondary = Color(0xFFFFFFFF);
}
