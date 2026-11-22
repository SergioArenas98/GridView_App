import 'package:flutter/widgets.dart';

import '../../../../core/theme/tokens/gv_primer_typography.dart';

/// One Settings text role (`settings/settings.css`): Archivo at a size in
/// logical pixels that scales with the system text size (the prototype's
/// `rem`, never capped), a CSS weight, a line height and the approved
/// width-axis steps.
///
/// [widths] starts with the approved width and lists the narrower steps the
/// approved large-text rules allow, in order. Only [SettingsFitText] walks
/// past the first one.
@immutable
class SettingsTextRole {
  const SettingsTextRole({
    required this.size,
    required this.weight,
    required this.height,
    this.widths = const <double>[100],
  });

  final double size;
  final int weight;
  final double height;
  final List<double> widths;

  /// The style at width step [width] (defaults to the approved width).
  ///
  /// Tracking is pinned to the reference's `letter-spacing: normal` (0)
  /// unless [letterSpacing] (logical pixels) says otherwise: the ambient
  /// Material `DefaultTextStyle` would otherwise add its 0.25px per glyph,
  /// which pushes a single long word ("Agradecimientos" at 320dp @200%) past
  /// the width the approved title rule fits it in.
  TextStyle style({double? width, int? weight, double letterSpacing = 0}) =>
      GvPrimerTypography.archivo(
        size: size,
        weight: weight ?? this.weight,
        width: width ?? widths.first,
        height: height,
      ).copyWith(letterSpacing: letterSpacing);
}

/// The Settings type scale (Step 55C.13A), from `settings.css`.
///
/// Width steps: the app-bar title follows the approved S-2 title rule
/// (88 → 76 → 66 → 62, SF-10). An option label takes the narrower widths of
/// the prototype's large-text rules (`@container rows`) only for the text
/// whose longest word would otherwise not fit ([SettingsFitText], SF-11).
/// A root row's title and value take their list's tier, the same for every
/// row (`SettingsRowsDensity`, SF-20, Step 55C.13AR). Nothing is scaled
/// down, capped or truncated.
abstract final class SettingsType {
  /// `.dbar__title`: 21px (1.3125rem, uncapped), 800, `wdth` 88, 1.25.
  static const SettingsTextRole appBarTitle = SettingsTextRole(
    size: 21,
    weight: 800,
    height: 1.25,
    widths: <double>[88, 76, 66, 62],
  );

  /// The most a single-word app-bar title may shrink, as a fraction of its
  /// system-scaled size, when it does not fit even at the narrowest width
  /// step (owner decision SF-10R, Step 55C.13BR2). The reference's
  /// last-resort S-2 step takes "Acknowledgements" from 42px to 36.63px at
  /// 320dp @200% (12.8%).
  static const double appBarTitleMaxReduction = 0.13;

  /// `.kicker`: 13px, 700, 1.25, `text.secondary`.
  static const SettingsTextRole kicker = SettingsTextRole(
    size: 13,
    weight: 700,
    height: 1.25,
  );

  /// `.srow__title`: 17px, 600, 1.3.
  static const SettingsTextRole rowTitle = SettingsTextRole(
    size: 17,
    weight: 600,
    height: 1.3,
    widths: <double>[100, 88, 70],
  );

  /// `.srow__label`: 14px, 600, 1.3, `text.secondary` (owner decision
  /// 55C.13A-3: the prototype's hierarchy is kept).
  static const SettingsTextRole rowLabel = SettingsTextRole(
    size: 14,
    weight: 600,
    height: 1.3,
  );

  /// `.srow__value`: 19px, 750, `wdth` 92, 1.25.
  static const SettingsTextRole rowValue = SettingsTextRole(
    size: 19,
    weight: 750,
    height: 1.25,
    widths: <double>[92, 76, 66],
  );

  /// `.srow__desc`: 14px, 400, 1.4, `text.secondary`.
  static const SettingsTextRole rowDescription = SettingsTextRole(
    size: 14,
    weight: 400,
    height: 1.4,
  );

  /// `.opt__label`: 17px, 550 (800 when selected), 1.3.
  static const SettingsTextRole optionLabel = SettingsTextRole(
    size: 17,
    weight: 550,
    height: 1.3,
    widths: <double>[100, 88, 78],
  );

  /// The selected option label's weight (`.opt[aria-checked="true"]`).
  static const int optionLabelSelectedWeight = 800;

  /// `.opt__desc`: 15px, 400, 1.4, `text.secondary`.
  static const SettingsTextRole optionDescription = SettingsTextRole(
    size: 15,
    weight: 400,
    height: 1.4,
  );

  // --- Information screens (Step 55C.13B, `settings/information/
  // information.css`) ---

  /// `.fact dt`: 14px, 600, 1.3, `text.secondary` (owner decision SF-17).
  static const SettingsTextRole factLabel = SettingsTextRole(
    size: 14,
    weight: 600,
    height: 1.3,
  );

  /// `.fact dd`: 17px, 600, 1.35 (SF-17). A fact list at most 17em wide
  /// sets it at `wdth` 88 (`@container rows`).
  static const SettingsTextRole factValue = SettingsTextRole(
    size: 17,
    weight: 600,
    height: 1.35,
    widths: <double>[100, 88],
  );

  /// `.fact--pending dd`: the "Not available yet" answer, 500 in
  /// `text.secondary`.
  static const int factPendingWeight = 500;

  /// `.lede`, `.explain`, `.prose p`, `.fact--prose dd`: 16px, 400, 1.55,
  /// at most 36em wide.
  static const SettingsTextRole reading = SettingsTextRole(
    size: 16,
    weight: 400,
    height: 1.55,
  );

  /// `.note`: 15px, 400, 1.5, `text.secondary`.
  static const SettingsTextRole note = SettingsTextRole(
    size: 15,
    weight: 400,
    height: 1.5,
  );

  /// `.istate--empty`: 16px, 400, 1.5, `text.secondary`.
  static const SettingsTextRole emptyState = SettingsTextRole(
    size: 16,
    weight: 400,
    height: 1.5,
  );

  /// `.source__name`: 22px, 800, `wdth` 96, 1.2.
  static const SettingsTextRole sourceName = SettingsTextRole(
    size: 22,
    weight: 800,
    height: 1.2,
    widths: <double>[96],
  );

  /// `.xrow__value`: 16px, 650, 1.35.
  static const SettingsTextRole linkValue = SettingsTextRole(
    size: 16,
    weight: 650,
    height: 1.35,
  );

  /// `.xrow__value--link`: a displayed address, 15px, 500, 1.35,
  /// `text.secondary`.
  static const SettingsTextRole linkAddress = SettingsTextRole(
    size: 15,
    weight: 500,
    height: 1.35,
  );

  /// The reading measure of long-form text (`max-width: 36em`).
  static const double readingMeasureEm = 36;

  /// The measure of a link row's description (`.xrow .srow__desc`).
  static const double linkDescriptionMeasureEm = 34;

  /// `.snack__msg`: 15px, 600, 1.35.
  static const SettingsTextRole snackbar = SettingsTextRole(
    size: 15,
    weight: 600,
    height: 1.35,
  );
}

final RegExp _whiteSpace = RegExp(r'\s+');

/// The first width step of [widths] (defaults to the role's) at which the
/// longest word of [text] fits in [maxWidth], measured at [weight] (defaults
/// to the role's weight) and [letterSpacing] over [ambient] (the inherited
/// [DefaultTextStyle], as [Text] merges it) under [textScaler]; the last step
/// when none does.
///
/// Words are separated by white space only, so the measure never relies on
/// a break inside a word.
double settingsFitWidth({
  required String text,
  required SettingsTextRole role,
  required double maxWidth,
  required TextScaler textScaler,
  TextStyle? ambient,
  int? weight,
  List<double>? widths,
  double letterSpacing = 0,
}) {
  final List<double> steps = widths ?? role.widths;
  if (steps.length == 1 || !maxWidth.isFinite) return steps.first;
  final List<String> words = text
      .split(_whiteSpace)
      .where((String w) => w.isNotEmpty)
      .toList(growable: false);
  if (words.isEmpty) return steps.first;
  for (final double width in steps) {
    final TextStyle style = (ambient ?? const TextStyle()).merge(
      role.style(width: width, weight: weight, letterSpacing: letterSpacing),
    );
    bool fits = true;
    for (final String word in words) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: word, style: style),
        textDirection: TextDirection.ltr,
        textScaler: textScaler,
        maxLines: 1,
      )..layout();
      final double needed = painter.width;
      painter.dispose();
      if (needed > maxWidth + 0.5) {
        fits = false;
        break;
      }
    }
    if (fits) return width;
  }
  return steps.last;
}

/// The bounded last-resort size of a single-word title (owner decision
/// SF-10R, Step 55C.13BR2), or `null` when none applies.
///
/// Ports the reference's S-2 last resort (`information.js` `fitOne`): after
/// the width steps, a title still wider than its column is scaled to
/// `floor(size × column × 100 / needed) / 100` (CSS px, after the system
/// text size). Here it applies only when:
/// - [text] is one word (no white space): multi-word titles keep wrapping;
/// - that word does not fit [maxWidth] at [width], the narrowest step the
///   caller reached, at the role's system-scaled size;
/// - the size that makes it fit is at most [maxReduction] below the
///   system-scaled size. Beyond that bound nothing is reduced at all: the
///   word keeps the approved size and wraps where the line breaker allows
///   (the readable fallback), because a smaller size that still splits
///   the word gains nothing.
///
/// The result is a logical font size, before [textScaler], so the system
/// text size still applies to it; it is checked against the column again
/// after scaling, so a non-linear scaler never leaves the word too wide.
double? settingsSingleWordFitSize({
  required String text,
  required SettingsTextRole role,
  required double width,
  required double maxWidth,
  required TextScaler textScaler,
  required double maxReduction,
  TextStyle? ambient,
  int? weight,
  double letterSpacing = 0,
}) {
  if (!maxWidth.isFinite || maxWidth <= 0) return null;
  final String word = text.trim();
  if (word.isEmpty || _whiteSpace.hasMatch(word)) return null;

  double measure(double size) {
    final TextStyle style = (ambient ?? const TextStyle()).merge(
      role
          .style(width: width, weight: weight, letterSpacing: letterSpacing)
          .copyWith(fontSize: size),
    );
    final TextPainter painter = TextPainter(
      text: TextSpan(text: word, style: style),
      textDirection: TextDirection.ltr,
      textScaler: textScaler,
      maxLines: 1,
    )..layout();
    final double needed = painter.width;
    painter.dispose();
    return needed;
  }

  final double needed = measure(role.size);
  if (needed <= maxWidth + 0.5) return null;

  final double scaled = textScaler.scale(role.size);
  if (scaled <= 0) return null;
  final double floor = scaled * (1 - maxReduction);
  // The reference's formula, in CSS px after the system text size.
  double target = (scaled * maxWidth * 100 / needed).floorToDouble() / 100;
  while (target >= floor - 1e-9) {
    final double logical = role.size * target / scaled;
    if (measure(logical) <= maxWidth + 0.5) return logical;
    target = ((target * 100).roundToDouble() - 1) / 100;
  }
  return null;
}

/// Settings text that wraps between words and narrows Archivo's width axis
/// only when its longest word would otherwise not fit (owner decisions
/// 55C.13A-10 and -11, SETT-09).
///
/// - Multi-word text wraps normally; the size is never reduced and nothing
///   is truncated or clipped.
/// - A single overlong word ("Agradecimientos", "Predeterminado" at 320dp
///   @200%) takes the first approved width step at which it fits. If even
///   the narrowest step is too wide, the narrowest step is kept and the word
///   wraps where the line breaker allows: the readable fallback, never a
///   smaller size.
/// - The displayed string and its accessible text are exactly [text].
///
/// [measureWeight] lets a label whose weight changes with selection pick its
/// width at the heavier weight, so selecting it never changes the width.
///
/// [widths] replaces the role's steps: a Settings root row passes the steps
/// from its list's compact tier onwards (`SettingsRowsDensity`), so every row
/// in the list starts from the same width. [letterSpacing] is in logical
/// pixels.
class SettingsFitText extends StatelessWidget {
  const SettingsFitText(
    this.text, {
    super.key,
    required this.role,
    required this.color,
    this.weight,
    this.measureWeight,
    this.widths,
    this.letterSpacing = 0,
    this.maxSingleWordReduction,
  });

  final String text;
  final SettingsTextRole role;
  final Color color;

  /// Rendered weight; defaults to the role's.
  final int? weight;

  /// Weight used to choose the width step; defaults to [weight].
  final int? measureWeight;

  /// Width steps to choose from; defaults to the role's.
  final List<double>? widths;

  /// Tracking in logical pixels (the reference's `normal`, 0, by default).
  final double letterSpacing;

  /// Opts in to the bounded single-word last resort (SF-10R,
  /// [settingsSingleWordFitSize]); `null` (the default) never changes the
  /// size. Only the Settings app-bar title passes it.
  final double? maxSingleWordReduction;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) {
      final TextScaler scaler = MediaQuery.textScalerOf(context);
      final TextStyle ambient = DefaultTextStyle.of(context).style;
      final double width = settingsFitWidth(
        text: text,
        role: role,
        maxWidth: constraints.maxWidth,
        textScaler: scaler,
        ambient: ambient,
        weight: measureWeight ?? weight,
        widths: widths,
        letterSpacing: letterSpacing,
      );
      final double? reduction = maxSingleWordReduction;
      final double? size = reduction == null
          ? null
          : settingsSingleWordFitSize(
              text: text,
              role: role,
              width: width,
              maxWidth: constraints.maxWidth,
              textScaler: scaler,
              maxReduction: reduction,
              ambient: ambient,
              weight: measureWeight ?? weight,
              letterSpacing: letterSpacing,
            );
      return Text(
        text,
        softWrap: true,
        style: role
            .style(width: width, weight: weight, letterSpacing: letterSpacing)
            .copyWith(color: color, fontSize: size),
      );
    },
  );
}
