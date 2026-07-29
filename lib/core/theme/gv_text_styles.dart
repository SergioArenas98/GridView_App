import 'package:flutter/material.dart';

import 'gv_semantic_colors.dart';
import 'tokens/gv_typography.dart';

/// The GridView typographic scale, resolved for the active theme.
///
/// [GvTypography] owns the *metrics* (family, size, height, weight, figures);
/// this extension owns the *colour* each role carries in the active theme. A
/// widget therefore writes `context.gvText.caption` and gets a caption that is
/// muted in both themes, without ever branching on [Brightness].
///
/// The dark instance is intentionally identical, value for value, to the raw
/// [GvTypography] constants it replaces, so migrating a call site cannot change
/// a single dark pixel.
@immutable
class GvTextStyles extends ThemeExtension<GvTextStyles> {
  const GvTextStyles({
    required this.displayXl,
    required this.displayL,
    required this.pageTitle,
    required this.sectionTitle,
    required this.cardTitle,
    required this.bodyL,
    required this.bodyM,
    required this.label,
    required this.caption,
    required this.statValue,
  });

  /// Builds the scale by tinting each role from [colors].
  ///
  /// The role-to-colour mapping is the single place the hierarchy is defined:
  /// titles and statistics are primary, body copy is secondary, labels and
  /// captions are muted. It is shared by both themes, so the two can never drift
  /// apart in hierarchy — only in tone.
  factory GvTextStyles.from(GvSemanticColors colors) {
    return GvTextStyles(
      displayXl: GvTypography.displayXl.copyWith(color: colors.textPrimary),
      displayL: GvTypography.displayL.copyWith(color: colors.textPrimary),
      pageTitle: GvTypography.pageTitle.copyWith(color: colors.textPrimary),
      sectionTitle: GvTypography.sectionTitle.copyWith(
        color: colors.textPrimary,
      ),
      cardTitle: GvTypography.cardTitle.copyWith(color: colors.textPrimary),
      bodyL: GvTypography.bodyL.copyWith(color: colors.textSecondary),
      bodyM: GvTypography.bodyM.copyWith(color: colors.textSecondary),
      label: GvTypography.label.copyWith(color: colors.textMuted),
      caption: GvTypography.caption.copyWith(color: colors.textMuted),
      statValue: GvTypography.statValue.copyWith(color: colors.textPrimary),
    );
  }

  final TextStyle displayXl;
  final TextStyle displayL;
  final TextStyle pageTitle;
  final TextStyle sectionTitle;
  final TextStyle cardTitle;
  final TextStyle bodyL;
  final TextStyle bodyM;
  final TextStyle label;
  final TextStyle caption;
  final TextStyle statValue;

  /// The scale as rendered by the flagship dark theme.
  static final GvTextStyles dark = GvTextStyles.from(GvSemanticColors.dark);

  /// The scale as rendered by the light theme.
  static final GvTextStyles light = GvTextStyles.from(GvSemanticColors.light);

  /// This scale as a Material [TextTheme], so framework widgets that resolve
  /// their own styles stay in the same hierarchy.
  TextTheme get textTheme => TextTheme(
    displayLarge: displayXl,
    displayMedium: displayL,
    headlineLarge: pageTitle,
    titleLarge: sectionTitle,
    titleMedium: cardTitle,
    bodyLarge: bodyL,
    bodyMedium: bodyM,
    labelLarge: label,
    labelSmall: caption,
  );

  @override
  GvTextStyles copyWith({
    TextStyle? displayXl,
    TextStyle? displayL,
    TextStyle? pageTitle,
    TextStyle? sectionTitle,
    TextStyle? cardTitle,
    TextStyle? bodyL,
    TextStyle? bodyM,
    TextStyle? label,
    TextStyle? caption,
    TextStyle? statValue,
  }) {
    return GvTextStyles(
      displayXl: displayXl ?? this.displayXl,
      displayL: displayL ?? this.displayL,
      pageTitle: pageTitle ?? this.pageTitle,
      sectionTitle: sectionTitle ?? this.sectionTitle,
      cardTitle: cardTitle ?? this.cardTitle,
      bodyL: bodyL ?? this.bodyL,
      bodyM: bodyM ?? this.bodyM,
      label: label ?? this.label,
      caption: caption ?? this.caption,
      statValue: statValue ?? this.statValue,
    );
  }

  @override
  GvTextStyles lerp(GvTextStyles? other, double t) {
    if (other == null) return this;
    return GvTextStyles(
      displayXl: TextStyle.lerp(displayXl, other.displayXl, t)!,
      displayL: TextStyle.lerp(displayL, other.displayL, t)!,
      pageTitle: TextStyle.lerp(pageTitle, other.pageTitle, t)!,
      sectionTitle: TextStyle.lerp(sectionTitle, other.sectionTitle, t)!,
      cardTitle: TextStyle.lerp(cardTitle, other.cardTitle, t)!,
      bodyL: TextStyle.lerp(bodyL, other.bodyL, t)!,
      bodyM: TextStyle.lerp(bodyM, other.bodyM, t)!,
      label: TextStyle.lerp(label, other.label, t)!,
      caption: TextStyle.lerp(caption, other.caption, t)!,
      statValue: TextStyle.lerp(statValue, other.statValue, t)!,
    );
  }
}

/// Convenient access to the GridView typographic scale from a [BuildContext].
extension GvTextStylesX on BuildContext {
  GvTextStyles get gvText =>
      Theme.of(this).extension<GvTextStyles>() ?? GvTextStyles.dark;
}
