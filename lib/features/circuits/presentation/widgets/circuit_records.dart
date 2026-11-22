import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';

/// One attribute of the lap record (holder or year).
@immutable
class CircuitRecordAttribute {
  const CircuitRecordAttribute({
    required this.label,
    required this.value,
    this.unavailable = false,
    this.tabular = false,
  });

  final String label;
  final String value;

  /// [value] is localized unavailable copy ("Driver unavailable"): set as a
  /// statement, not a name (PD-13a).
  final bool unavailable;

  /// A figure (the year): tabular.
  final bool tabular;
}

/// The lap record as a timing readout (`.lap`, CI09–CI11): the time as the
/// one large figure, then holder and year. 12px under the section title, on
/// the gutter. No position figure, no seams, no row grammar: it reads
/// neither as a standing nor as a classification.
///
/// - Time (only when present): the term, then, 6px below and 2px to the
///   left, `min(3rem, 52px)`, 830, `wdth` 118, −0.025em, line height 0.92,
///   tabular; never localized (CD-13).
/// - Holder and year: a wrapping row, 36px apart (12px between lines); each
///   term, then 4px below `min(1.1875rem, 30px)`, 780, `wdth` 90, line
///   height 1.2. Unavailable copy: secondary, 600, `wdth` 100 (PD-13a). A
///   1px `line.subtle` rule and 12px separate the row from a time, 16px
///   below it; a year-only record has no rule.
///
/// The holder is never a link and never an identifier.
class CircuitLapRecord extends StatelessWidget {
  const CircuitLapRecord({
    super.key,
    required this.timeLabel,
    this.time,
    this.attributes = const <CircuitRecordAttribute>[],
  });

  final String timeLabel;
  final String? time;
  final List<CircuitRecordAttribute> attributes;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final TextStyle term = GvPrimerTypography.archivo(
      size: 13,
      weight: 700,
      height: 1.25,
    ).copyWith(color: roles.text.secondary);
    final double timeSize = GvPrimerTypography.cappedSize(scaler, 48, 52);
    final double valueSize = GvPrimerTypography.cappedSize(scaler, 19, 30);
    final String? shownTime = time;
    return Padding(
      key: const ValueKey<String>('circuit-lap-record'),
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        12,
        GvPrimerLayout.gutter,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (shownTime != null)
            MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(timeLabel, style: term),
                  const SizedBox(height: 6),
                  Transform.translate(
                    offset: const Offset(-2, 0),
                    child: Text(
                      // A word wider than the line breaks between characters
                      // in Flutter, as `overflow-wrap: anywhere`.
                      shownTime,
                      key: const ValueKey<String>('circuit-lap-time'),
                      textScaler: TextScaler.noScaling,
                      style:
                          GvPrimerTypography.archivo(
                            size: timeSize,
                            weight: 830,
                            width: 118,
                            height: 0.92,
                            tabularFigures: true,
                          ).copyWith(
                            letterSpacing: -0.025 * timeSize,
                            color: roles.text.primary,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          if (attributes.isNotEmpty)
            _attributes(roles, term, valueSize, ruled: shownTime != null),
        ],
      ),
    );
  }

  Widget _attributes(
    GvPrimerRoles roles,
    TextStyle term,
    double size, {
    required bool ruled,
  }) {
    final Widget row = Wrap(
      spacing: 36,
      runSpacing: 12,
      children: <Widget>[
        for (final CircuitRecordAttribute a in attributes)
          MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(a.label, style: term),
                const SizedBox(height: 4),
                Text(
                  a.value,
                  key: a.unavailable
                      ? const ValueKey<String>('circuit-lap-unavailable')
                      : null,
                  textScaler: TextScaler.noScaling,
                  style: a.unavailable
                      ? GvPrimerTypography.archivo(
                          size: size,
                          weight: 600,
                          height: 1.2,
                        ).copyWith(color: roles.text.secondary)
                      : GvPrimerTypography.archivo(
                          size: size,
                          weight: 780,
                          width: 90,
                          height: 1.2,
                          tabularFigures: a.tabular,
                        ).copyWith(color: roles.text.primary),
                ),
              ],
            ),
          ),
      ],
    );
    if (!ruled) return row;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: DecoratedBox(
        key: const ValueKey<String>('circuit-lap-rule'),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: roles.line.subtle)),
        ),
        child: Padding(padding: const EdgeInsets.only(top: 12), child: row),
      ),
    );
  }
}

/// The season line that leads the related section in both states
/// (`.rel__season`, PD-13b): `seasonLabel` with the ready state's season,
/// 4px under the title, 14px weight 600, line height 1.3, secondary.
class CircuitSeasonLine extends StatelessWidget {
  const CircuitSeasonLine(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        4,
        GvPrimerLayout.gutter,
        0,
      ),
      child: Text(
        text,
        key: const ValueKey<String>('circuit-related-season'),
        style: GvPrimerTypography.archivo(
          size: 14,
          weight: 600,
          height: 1.3,
        ).copyWith(color: roles.text.secondary),
      ),
    );
  }
}

/// The no-event statement (`.rel__none`): 14px below the season line, 16px
/// padding on the gutter between `line.subtle` hairlines, 16px weight 650,
/// line height 1.35. Not a card, not a link.
///
/// The copy is the existing `circuitNoRelatedGrandPrix`, shown exactly when
/// the current screen showed it (no related event in the read model). Its
/// correctness when the season's calendar is not materialized is CR-04 /
/// PD-14 / CIR-02, deferred to a separate functional step.
class CircuitNoEvent extends StatelessWidget {
  const CircuitNoEvent(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final BorderSide hairline = BorderSide(color: roles.line.subtle);
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: DecoratedBox(
        key: const ValueKey<String>('circuit-related-none'),
        decoration: BoxDecoration(
          border: Border(top: hairline, bottom: hairline),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
            vertical: 16,
          ),
          child: Text(
            text,
            style: GvPrimerTypography.archivo(
              size: 16,
              weight: 650,
              height: 1.35,
            ).copyWith(color: roles.text.primary),
          ),
        ),
      ),
    );
  }
}
