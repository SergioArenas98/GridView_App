import 'package:flutter/painting.dart';

import 'settings_primer_text.dart';

/// The width-axis tier of the Settings root row list (Step 55C.13AR, owner
/// decision SF-20): one treatment for every row in the list, as the
/// reference's container query gives it (`settings.css`):
///
/// ```css
/// .srows { container: rows / inline-size; }
/// @container rows (max-width: 17em) {
///   .srow__value { font-variation-settings: "wdth" 76; gap: 7px; }
///   .srow__title { font-variation-settings: "wdth" 88; }
/// }
/// @container rows (max-width: 12.5em) {
///   .srow__value { font-variation-settings: "wdth" 66; letter-spacing: -0.01em; }
///   .srow__title { font-variation-settings: "wdth" 70; }
/// }
/// ```
///
/// The query is in `em` of the list, whose font size is the body's 15px
/// (`0.9375rem`) under the system text size, so the tier reacts to text
/// size as well as screen width (Chrome measurement, 55C.13AR):
///
/// | list width ≤ | at 100% | at 150% | at 200% | tier       |
/// |--------------|---------|---------|---------|------------|
/// | (wider)      |         |         |         | [regular]  |
/// | 17em         | 255     | 382.5   | 510     | [compact]  |
/// | 12.5em       | 187.5   | 281.25  | 375     | [narrow]   |
///
/// So 390dp at 100% is [regular], 390dp at 200% and 320dp at 130–150% are
/// [compact], and 320dp at 175–200% is [narrow]. Only the row title and the
/// preference value change; the label, description, kicker, app bar and the
/// preference-choice options keep their own treatment.
enum SettingsRowsDensity {
  /// The approved widths: title 100, value 92, mark gap 9px.
  regular(titleWidth: 100, valueWidth: 92, markGap: 9),

  /// `max-width: 17em`: title 88, value 76, mark gap 7px.
  compact(titleWidth: 88, valueWidth: 76, markGap: 7),

  /// `max-width: 12.5em`: title 70, value 66 with -0.01em tracking, mark gap
  /// 7px.
  narrow(
    titleWidth: 70,
    valueWidth: 66,
    markGap: 7,
    valueLetterSpacingEm: -0.01,
  );

  const SettingsRowsDensity({
    required this.titleWidth,
    required this.valueWidth,
    required this.markGap,
    this.valueLetterSpacingEm = 0,
  });

  /// `wdth` of `.srow__title`.
  final double titleWidth;

  /// `wdth` of `.srow__value`.
  final double valueWidth;

  /// `.srow__value { gap }`: between the small mark and the value.
  final double markGap;

  /// `.srow__value { letter-spacing }` in `em` of the value.
  final double valueLetterSpacingEm;

  /// The list's font size before the system text size (`0.9375rem`).
  static const double listFontSize = 15;

  /// `@container rows (max-width: 17em)`.
  static const double compactMaxEm = 17;

  /// `@container rows (max-width: 12.5em)`.
  static const double narrowMaxEm = 12.5;

  /// The tier for a row list [listWidth] logical pixels wide under
  /// [textScaler]. An unbounded width is [regular].
  static SettingsRowsDensity of(double listWidth, TextScaler textScaler) {
    if (!listWidth.isFinite) return regular;
    final double em = textScaler.scale(listFontSize);
    if (listWidth <= narrowMaxEm * em) return narrow;
    if (listWidth <= compactMaxEm * em) return compact;
    return regular;
  }

  /// The title's width steps: this tier's width, then only the role's
  /// narrower steps, as the readable fallback for a single word that would
  /// otherwise break (SETT-09). The fallback never widens a row past its
  /// tier.
  List<double> get titleWidths =>
      _from(titleWidth, SettingsType.rowTitle.widths);

  /// The value's width steps, as [titleWidths].
  List<double> get valueWidths =>
      _from(valueWidth, SettingsType.rowValue.widths);

  /// The value's tracking in logical pixels under [textScaler] (Flutter does
  /// not scale `letterSpacing` with the text size; `em` does).
  double valueLetterSpacing(TextScaler textScaler) => valueLetterSpacingEm == 0
      ? 0
      : valueLetterSpacingEm * textScaler.scale(SettingsType.rowValue.size);

  static List<double> _from(double start, List<double> steps) =>
      List<double>.unmodifiable(<double>[
        start,
        ...steps.where((double w) => w < start),
      ]);
}
