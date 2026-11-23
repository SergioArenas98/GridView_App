import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// One labelled fact of a stint row: an optional visible term and a value.
/// A [hiddenLabel] is read by screen readers only (DRV-01 item 4, pending).
@immutable
class DriverStintFact {
  const DriverStintFact({
    required this.value,
    this.label,
    this.hiddenLabel,
    this.emphasis = DriverStintEmphasis.none,
  });

  final String value;

  /// A visible term before the value ("Race number").
  final String? label;

  /// A term read by screen readers only ("Participation", "Role").
  final String? hiddenLabel;
  final DriverStintEmphasis emphasis;
}

/// How a stint fact value stands out from the secondary line.
enum DriverStintEmphasis {
  /// Secondary text (the role).
  none,

  /// The span boundary: primary text, weight 650 (`.st__span`).
  span,

  /// A number: primary text, weight 700, tabular (`.st__v`).
  number,
}

/// One season-participation span (`dd.css` `.st`, D07–D09, D15–D18): the
/// team-colour tick, the team as the row title, then the boundary, the role
/// and the labelled race number.
///
/// The relevant span with a resolved team is the one team link
/// ([onOpen]): the whole row is the target, announced as [linkLabel] ("Open
/// team …") with the visible team name hidden, closed by the arrow disc,
/// ring 3px inside the row. Every other row is plain text; an unresolved team
/// reads "Team unavailable" in italic, never the identifier.
///
/// The tick is the shared XT-3 tick (3px, 12°, 1px boundary below 3:1
/// against the page) in the prototype's 4px lane, top-aligned and between
/// 40 and 64px tall; no colour, no tick.
class DriverStintRow extends StatelessWidget {
  const DriverStintRow({
    super.key,
    required this.teamName,
    required this.facts,
    this.teamColor,
    this.teamUnavailable = false,
    this.onOpen,
    this.linkLabel,
    this.dividerAbove = false,
  }) : assert((onOpen == null) == (linkLabel == null));

  final String teamName;
  final List<DriverStintFact> facts;
  final Color? teamColor;

  /// [teamName] is the localized "Team unavailable" fallback.
  final bool teamUnavailable;
  final VoidCallback? onOpen;
  final String? linkLabel;

  /// A hairline above the row, from the gutter + 18px to the gutter.
  final bool dividerAbove;

  /// The tick lane width (`grid-template-columns: 4px …`).
  static const double laneWidth = 4;

  /// Minimum row height (`.st { min-height: 72px }`).
  static const double minHeight = 72;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final bool link = onOpen != null;
    final double teamSize = GvPrimerTypography.cappedSize(scaler, 19, 30);
    final TextStyle teamStyle = teamUnavailable
        ? GvPrimerTypography.archivo(
            size: teamSize,
            weight: 600,
            height: 1.15,
          ).copyWith(fontStyle: FontStyle.italic, color: roles.text.secondary)
        : GvPrimerTypography.archivo(
            size: teamSize,
            weight: 800,
            width: 84,
            height: 1.15,
          ).copyWith(color: roles.text.primary);
    final Widget team = Text(
      teamName,
      textScaler: TextScaler.noScaling,
      style: teamStyle,
    );

    final Widget row = Stack(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
            vertical: 14,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: minHeight - 28),
            child: Stack(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const SizedBox(width: laneWidth),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          // Inside the link the name is part of its label.
                          if (link) ExcludeSemantics(child: team) else team,
                          const SizedBox(height: 4),
                          _StintFacts(facts: facts),
                        ],
                      ),
                    ),
                    if (link) ...<Widget>[
                      const SizedBox(width: 14),
                      const GvPrimerArrowDisc(),
                    ],
                  ],
                ),
                if (teamColor != null)
                  Positioned(
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: laneWidth,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 64),
                        child: SizedBox(
                          key: const ValueKey<String>('driver-stint-tick'),
                          height: double.infinity,
                          width: GvPrimerTeamMark.thicknessOf(
                            GvPrimerTeamShape.tick,
                          ),
                          child: GvPrimerTeamMark(
                            shape: GvPrimerTeamShape.tick,
                            color: teamColor!,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (dividerAbove)
          Positioned(
            top: 0,
            left: GvPrimerLayout.gutter + 18,
            right: GvPrimerLayout.gutter,
            height: 1,
            child: ColoredBox(color: roles.line.subtle),
          ),
      ],
    );
    if (!link) return row;
    return GvPrimerFocusTarget(
      onActivate: onOpen,
      role: GvPrimerTargetRole.link,
      semanticLabel: linkLabel,
      geometry: GvPrimerFocusGeometry.row,
      pressedColor: roles.state.pressedRow,
      hoverColor: roles.state.hover,
      child: row,
    );
  }
}

/// `.st__facts`: a wrapping line, 16px apart (2px between lines), each fact
/// its own wrapping pair 6px apart; 14px secondary text, line height 1.35.
class _StintFacts extends StatelessWidget {
  const _StintFacts({required this.facts});

  final List<DriverStintFact> facts;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextStyle base = GvPrimerTypography.archivo(
      size: 14,
      weight: 400,
      height: 1.35,
    ).copyWith(color: roles.text.secondary);
    TextStyle valueStyle(DriverStintEmphasis emphasis) => switch (emphasis) {
      DriverStintEmphasis.none => base,
      DriverStintEmphasis.span => GvPrimerTypography.archivo(
        size: 14,
        weight: 650,
        height: 1.35,
      ).copyWith(color: roles.text.primary),
      DriverStintEmphasis.number => GvPrimerTypography.archivo(
        size: 14,
        weight: 700,
        height: 1.35,
        tabularFigures: true,
      ).copyWith(color: roles.text.primary),
    };
    return Wrap(
      spacing: 16,
      runSpacing: 2,
      children: <Widget>[
        for (final DriverStintFact fact in facts)
          // Read as one unit, the hidden term first ("Participation, From
          // season start"), as the prototype's visually hidden `<dt>`.
          MergeSemantics(
            child: Semantics(
              label: fact.hiddenLabel,
              child: Wrap(
                spacing: 6,
                children: <Widget>[
                  if (fact.label case final String label)
                    Text(label, style: base),
                  Text(fact.value, style: valueStyle(fact.emphasis)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
