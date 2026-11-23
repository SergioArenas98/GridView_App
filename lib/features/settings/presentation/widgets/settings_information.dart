import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_notice.dart';
import '../../../../core/widgets/gv_primer_row_parts.dart';
import '../../../../core/widgets/gv_primer_states.dart';
import 'settings_group.dart';
import 'settings_primer_text.dart';
import 'settings_rows_density.dart';

/// The read-only building blocks of the Settings information screens (Step
/// 55C.13B; `settings/information/information.css`, Dark and Light pairs
/// `light-rollout-b2/info-*`): facts, long-form text and the loading,
/// known-empty and unavailable states. Flat on the page, no card (owner
/// decision SF-13).

/// Space between the app bar and an information screen's first block
/// (`.info { padding-top: 0 } .info > :first-child { margin-top: 20px }`).
const double settingsInformationTop = 20;

/// One part of a composed accessible label, optionally in a language that
/// differs from the interface's.
@immutable
class SettingsSpokenPart {
  const SettingsSpokenPart(this.text, {this.locale});

  final String? text;

  /// The part's language when it is reliably known (SF-13: provider-supplied
  /// English on a Spanish screen), so a screen reader pronounces it
  /// correctly.
  final Locale? locale;
}

/// Joins [parts] into one accessible label, `", "`-separated, dropping every
/// part that is absent or blank (the `settingsSpokenLabel` rule), and marks
/// each part that carries a locale with a [LocaleStringAttribute].
AttributedString settingsAttributedLabel(List<SettingsSpokenPart> parts) {
  final StringBuffer buffer = StringBuffer();
  final List<StringAttribute> attributes = <StringAttribute>[];
  for (final SettingsSpokenPart part in parts) {
    final String? text = part.text?.trim();
    if (text == null || text.isEmpty) continue;
    if (buffer.isNotEmpty) buffer.write(', ');
    final int start = buffer.length;
    buffer.write(text);
    final Locale? locale = part.locale;
    if (locale != null) {
      attributes.add(
        LocaleStringAttribute(
          range: TextRange(start: start, end: buffer.length),
          locale: locale,
        ),
      );
    }
  }
  return AttributedString(buffer.toString(), attributes: attributes);
}

/// The width of [em] ems of [size]px text under [scaler] (the prototype's
/// `max-width` in `em`, which follows the system text size).
double settingsMeasure(TextScaler scaler, double size, double em) =>
    em * scaler.scale(size);

/// How a fact's value reads (`.fact`, `.fact--num`, `.fact--pending`,
/// `.fact--prose`).
enum SettingsFactKind {
  /// A value: 17px, 600.
  value,

  /// A number (API version, season, version, build): as [value], with
  /// tabular lining figures.
  number,

  /// An answer about missing data ("Not available yet"): 500 in
  /// `text.secondary`, quieter than a value.
  pending,

  /// A supplied legal notice: read as text (16px, 400, 1.55, 36em).
  prose,
}

/// What separates a fact from the content above it.
enum SettingsFactRule {
  /// Nothing (the first fact of a list).
  none,

  /// The 1px `line.subtle` hairline inset to the gutter.
  hairline,

  /// The 1.5px dashed `line.strong` rule (`.facts--session`): a runtime
  /// reading, set apart from the fixed build policy above it (SF-16).
  dashed,
}

/// A read-only Settings fact (`.fact`, owner decision SF-17): the label
/// (14px, 600, `text.secondary`) above its value (17px, 600), 12px × 16px
/// padding, never interactive.
///
/// - **Absent values.** A missing or empty value renders nothing, so the
///   screen never claims to know something it does not (the
///   `GvSettingsField` rule, kept).
/// - **Speech.** One node with the combined label "label, value" (SF-13);
///   [valueLocale] marks a value whose language is reliably known.
/// - **Large text.** In a list at most 17em wide (`@container rows`, 15px
///   ems) the value narrows to `wdth` 88; a single word that still does not
///   fit wraps where the line breaker allows. Nothing is truncated.
class SettingsFact extends StatelessWidget {
  const SettingsFact({
    super.key,
    required this.label,
    required this.value,
    this.kind = SettingsFactKind.value,
    this.valueLocale,
    this.rule = SettingsFactRule.none,
  });

  final String label;
  final String? value;
  final SettingsFactKind kind;
  final Locale? valueLocale;
  final SettingsFactRule rule;

  /// Whether the fact has a value to report.
  bool get shows {
    final String? shown = value;
    return shown != null && shown.isNotEmpty;
  }

  /// This fact with [rule] above it.
  SettingsFact withRule(SettingsFactRule rule) => SettingsFact(
    key: key,
    label: label,
    value: value,
    kind: kind,
    valueLocale: valueLocale,
    rule: rule,
  );

  @override
  Widget build(BuildContext context) {
    if (!shows) return const SizedBox.shrink();
    return Semantics(
      container: true,
      attributedLabel: settingsAttributedLabel(<SettingsSpokenPart>[
        SettingsSpokenPart(label),
        SettingsSpokenPart(value, locale: valueLocale),
      ]),
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) =>
              _visual(
                context,
                SettingsRowsDensity.of(
                  constraints.maxWidth,
                  MediaQuery.textScalerOf(context),
                ),
              ),
        ),
      ),
    );
  }

  Widget _visual(BuildContext context, SettingsRowsDensity density) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Stack(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
            vertical: 12,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                label,
                style: SettingsType.factLabel.style().copyWith(
                  color: roles.text.secondary,
                ),
              ),
              const SizedBox(height: 3),
              _value(context, roles, density),
            ],
          ),
        ),
        ...switch (rule) {
          SettingsFactRule.none => const <Widget>[],
          SettingsFactRule.hairline => const <Widget>[
            GvPrimerRowDivider(
              start: GvPrimerLayout.gutter,
              end: GvPrimerLayout.gutter,
            ),
          ],
          SettingsFactRule.dashed => <Widget>[
            Positioned(
              top: 0,
              left: GvPrimerLayout.gutter,
              right: GvPrimerLayout.gutter,
              height: 1.5,
              child: CustomPaint(
                painter: SettingsDashedRulePainter(roles.line.strong),
              ),
            ),
          ],
        },
      ],
    );
  }

  Widget _value(
    BuildContext context,
    GvPrimerRoles roles,
    SettingsRowsDensity density,
  ) {
    final String shown = value!;
    final bool compact = density != SettingsRowsDensity.regular;
    switch (kind) {
      case SettingsFactKind.prose:
        return SettingsMeasure(
          size: SettingsType.reading.size,
          child: Text(
            shown,
            style: SettingsType.reading.style().copyWith(
              color: roles.text.primary,
              locale: valueLocale,
            ),
          ),
        );
      case SettingsFactKind.number:
        return Text(
          shown,
          style: GvPrimerTypography.archivo(
            size: SettingsType.factValue.size,
            weight: SettingsType.factValue.weight,
            width: compact ? 88 : 100,
            height: SettingsType.factValue.height,
            tabularFigures: true,
          ).copyWith(letterSpacing: 0, color: roles.text.primary),
        );
      case SettingsFactKind.value:
      case SettingsFactKind.pending:
        final bool pending = kind == SettingsFactKind.pending;
        return SettingsFitText(
          shown,
          role: SettingsType.factValue,
          widths: compact ? const <double>[88] : null,
          weight: pending ? SettingsType.factPendingWeight : null,
          color: pending ? roles.text.secondary : roles.text.primary,
        );
    }
  }
}

/// A group of facts (`.facts`): the facts that have a value, a hairline
/// between consecutive ones and [leadingRule] above the first
/// (`.facts--supplied` has a hairline, `.facts--session` the dashed rule).
/// Renders nothing when no fact has a value.
class SettingsFactList extends StatelessWidget {
  const SettingsFactList({
    super.key,
    required this.facts,
    this.leadingRule = SettingsFactRule.none,
  });

  final List<SettingsFact> facts;
  final SettingsFactRule leadingRule;

  @override
  Widget build(BuildContext context) {
    final List<SettingsFact> shown = facts
        .where((SettingsFact fact) => fact.shows)
        .toList(growable: false);
    if (shown.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (int i = 0; i < shown.length; i++)
          shown[i].withRule(i == 0 ? leadingRule : SettingsFactRule.hairline),
      ],
    );
  }
}

/// Caps [child] at the reading measure ([em] ems of [size]px text under the
/// system text size), aligned to the start. Nothing is clipped: on a phone
/// the measure is wider than the column.
class SettingsMeasure extends StatelessWidget {
  const SettingsMeasure({
    super.key,
    required this.size,
    required this.child,
    this.em = SettingsType.readingMeasureEm,
  });

  final double size;
  final double em;
  final Widget child;

  @override
  Widget build(BuildContext context) => Align(
    alignment: AlignmentDirectional.centerStart,
    child: ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: settingsMeasure(MediaQuery.textScalerOf(context), size, em),
      ),
      child: child,
    ),
  );
}

/// Long-form Settings text on the gutter (`.lede`, `.explain`, `.prose p`,
/// `.note`): never truncated or clamped, at most 36em wide, [top] pixels
/// below the content above it.
///
/// The default is the reading text of the independence statement, the
/// explanations and the source notices: 16px / 1.55 in `text.primary`.
class SettingsProse extends StatelessWidget {
  const SettingsProse(
    this.text, {
    super.key,
    this.role = SettingsType.reading,
    this.secondary = false,
    this.top = 0,
  });

  /// `.note`: the qualifier under a group, 15px / 1.5 in `text.secondary`,
  /// 12px below it.
  const SettingsProse.note(this.text, {super.key, this.top = 12})
    : role = SettingsType.note,
      secondary = true;

  final String text;
  final SettingsTextRole role;
  final bool secondary;
  final double top;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        top,
        GvPrimerLayout.gutter,
        0,
      ),
      child: SettingsMeasure(
        size: role.size,
        child: Text(
          text,
          style: role.style().copyWith(
            color: secondary ? roles.text.secondary : roles.text.primary,
          ),
        ),
      ),
    );
  }
}

/// `.istate` padding: 10px above, 6px below, on the gutter.
const EdgeInsets _statePadding = EdgeInsets.fromLTRB(
  GvPrimerLayout.gutter,
  10,
  GvPrimerLayout.gutter,
  6,
);

/// A section still loading (`.istate` + `.skel`): one static 20px Primer
/// skeleton bar (SF-13: no pulse), announced once with [semanticLabel].
class SettingsInfoLoading extends StatelessWidget {
  const SettingsInfoLoading({super.key, required this.semanticLabel});

  final String semanticLabel;

  @override
  Widget build(BuildContext context) => Padding(
    padding: _statePadding,
    child: GvPrimerLoading(
      semanticLabel: semanticLabel,
      child: const SettingsMeasure(
        size: GvPrimerLayout.bodyFontSize,
        // As wide as the measure allows (`display: block`), never its
        // intrinsic zero.
        child: GvPrimerSkeleton(height: 20, width: double.infinity, radius: 4),
      ),
    ),
  );
}

/// A known-empty result (`.istate--empty`): plain secondary text, no card.
class SettingsInfoEmpty extends StatelessWidget {
  const SettingsInfoEmpty(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: _statePadding,
      child: SettingsMeasure(
        size: SettingsType.emptyState.size,
        child: Text(
          message,
          style: SettingsType.emptyState.style().copyWith(
            color: roles.text.secondary,
          ),
        ),
      ),
    );
  }
}

/// A record that could not be read (`.notice--unavailable`): the shared
/// [GvPrimerNotice] with the alert cause (SF-13), 8px below the kicker, on
/// the gutter. A polite live region; never an empty list.
class SettingsInfoNotice extends StatelessWidget {
  const SettingsInfoNotice(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      GvPrimerLayout.gutter,
      8,
      GvPrimerLayout.gutter,
      0,
    ),
    child: SettingsMeasure(
      size: GvPrimerLayout.bodyFontSize,
      child: GvPrimerNotice(
        cause: GvPrimerNoticeCause.failure,
        message: message,
      ),
    ),
  );
}
