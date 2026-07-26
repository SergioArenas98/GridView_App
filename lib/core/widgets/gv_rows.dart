import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';
import 'gv_status_chip.dart';

/// Shared layout for GridView list-row shells: an optional leading slot and left
/// accent bar, a title/subtitle column, and an optional trailing slot.
class _RowScaffold extends StatelessWidget {
  const _RowScaffold({
    this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.accentColor,
    this.emphasized = false,
    this.semanticLabel,
  });

  final Widget? leading;
  final Widget title;
  final Widget? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? accentColor;
  final bool emphasized;

  /// Replaces the row's merged child semantics with one explicit label, so a
  /// screen reader announces the row's values in a useful order.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final Widget row = _row(context);
    final String? label = semanticLabel;
    if (label == null) return row;
    return Semantics(
      label: label,
      button: onTap != null,
      onTap: onTap,
      child: ExcludeSemantics(child: row),
    );
  }

  Widget _row(BuildContext context) {
    return Material(
      color: emphasized ? GvColors.surfaceElevated : Colors.transparent,
      borderRadius: GvRadii.mdAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvSpacing.sm,
              vertical: GvSpacing.sm,
            ),
            child: LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) =>
                  _content(constraints.maxWidth),
            ),
          ),
        ),
      ),
    );
  }

  /// The row body. [width] is the space the row actually has, so the trailing
  /// slot can be capped rather than laid out unbounded (a Row gives a non-flex
  /// child infinite width, which turns a long value at a large text scale into
  /// an overflow instead of a wrap).
  Widget _content(double width) {
    final double? trailingMax = width.isFinite
        ? width * _trailingMaxFraction
        : null;
    return Row(
      children: <Widget>[
        if (accentColor != null) ...<Widget>[
          Container(
            width: 4,
            height: 32,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: GvRadii.pillAll,
            ),
          ),
          const SizedBox(width: GvSpacing.sm),
        ],
        if (leading != null) ...<Widget>[
          leading!,
          const SizedBox(width: GvSpacing.sm),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              DefaultTextStyle.merge(
                style: GvTypography.cardTitle.copyWith(fontSize: 16),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                child: title,
              ),
              if (subtitle != null)
                DefaultTextStyle.merge(
                  style: GvTypography.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  child: subtitle!,
                ),
            ],
          ),
        ),
        if (trailing != null) ...<Widget>[
          const SizedBox(width: GvSpacing.sm),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: trailingMax ?? double.infinity,
            ),
            child: trailing,
          ),
        ],
      ],
    );
  }
}

/// How much of a row the trailing slot may occupy before its content wraps.
const double _trailingMaxFraction = 0.45;

class GvSessionRow extends StatelessWidget {
  const GvSessionRow({
    super.key,
    required this.name,
    this.time,
    this.tone = GvStatusTone.neutral,
    this.statusLabel,
    this.onTap,
  });

  final String name;
  final String? time;
  final GvStatusTone tone;
  final String? statusLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      // The tone reinforces the (always present) textual status label with a
      // restrained accent bar; it never carries the meaning on its own.
      accentColor: tone == GvStatusTone.neutral
          ? null
          : gvToneColor(context, tone),
      title: Text(name),
      subtitle: statusLabel == null ? null : Text(statusLabel!),
      trailing: time == null
          ? null
          : Text(time!, style: GvTypography.label.copyWith(fontSize: 13)),
    );
  }
}

class GvStandingsRow extends StatelessWidget {
  const GvStandingsRow({
    super.key,
    required this.position,
    required this.name,
    this.team,
    required this.points,
    this.isLeader = false,
    this.accentColor,
    this.onTap,
  });

  final String position;
  final String name;
  final String? team;
  final String points;
  final bool isLeader;
  final Color? accentColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      emphasized: isLeader,
      accentColor: accentColor,
      leading: SizedBox(
        width: 28,
        child: Text(
          position,
          textAlign: TextAlign.center,
          style: GvTypography.statValue.copyWith(fontSize: 18),
        ),
      ),
      title: Text(name),
      subtitle: team == null ? null : Text(team!),
      trailing: Text(
        points,
        style: GvTypography.statValue.copyWith(fontSize: 18),
      ),
    );
  }
}

class GvDriverRow extends StatelessWidget {
  const GvDriverRow({
    super.key,
    required this.name,
    this.team,
    this.leading,
    this.number,
    this.onTap,
  });

  final String name;
  final String? team;
  final Widget? leading;
  final String? number;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      title: Text(name),
      subtitle: team == null ? null : Text(team!),
      trailing: number == null
          ? null
          : Text(number!, style: GvTypography.statValue.copyWith(fontSize: 18)),
    );
  }
}

class GvTeamRow extends StatelessWidget {
  const GvTeamRow({
    super.key,
    required this.name,
    this.subtitle,
    this.leading,
    this.accentColor,
    this.onTap,
  });

  final String name;
  final String? subtitle;
  final Widget? leading;
  final Color? accentColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      accentColor: accentColor,
      title: Text(name),
      subtitle: subtitle == null ? null : Text(subtitle!),
    );
  }
}

class GvCircuitRow extends StatelessWidget {
  const GvCircuitRow({
    super.key,
    required this.name,
    this.location,
    this.leading,
    this.onTap,
  });

  final String name;
  final String? location;
  final Widget? leading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      title: Text(name),
      subtitle: location == null ? null : Text(location!),
    );
  }
}

/// A classification row: displayed position, the primary name, an optional
/// secondary name with its **own** action, a status label, a timing/gap value, a
/// score value and an optional badge.
///
/// Every value is optional and purely presentational — the component knows
/// nothing about drivers, constructors or results. Anything the caller does not
/// supply is simply not rendered, so a missing value never becomes a false zero.
///
/// The primary action and the secondary action occupy two **separate**, stacked
/// hit areas (each at least [GvLayout.minTouchTarget] tall), so there are no
/// nested competing tap regions and each exposes its own button semantics.
class GvResultRow extends StatelessWidget {
  const GvResultRow({
    super.key,
    required this.position,
    required this.driverName,
    this.team,
    this.statusLabel,
    this.badgeLabel,
    this.timeOrGap,
    this.score,
    this.accentColor,
    this.onTap,
    this.semanticLabel,
    this.onTeamTap,
    this.teamSemanticLabel,
  });

  /// The displayed position. Duplicated positions are allowed; the caller
  /// supplies whatever the classification says (or a placeholder of its own).
  final String position;
  final String driverName;
  final String? team;

  /// A short finish/status label rendered next to the secondary name.
  final String? statusLabel;

  /// An optional accolade (e.g. a fastest-lap marker).
  final String? badgeLabel;

  /// Elapsed time, gap or laps-behind text — already formatted by the caller.
  final String? timeOrGap;

  /// A score value (e.g. points), already formatted by the caller.
  final String? score;

  final Color? accentColor;
  final VoidCallback? onTap;
  final String? semanticLabel;

  /// The secondary name's own action, rendered as a separate hit area.
  final VoidCallback? onTeamTap;
  final String? teamSemanticLabel;

  @override
  Widget build(BuildContext context) {
    final String? teamText = team;
    final bool hasSecondaryAction = teamText != null && onTeamTap != null;

    final Widget primary = _RowScaffold(
      onTap: onTap,
      semanticLabel: semanticLabel,
      accentColor: accentColor,
      leading: SizedBox(
        width: 32,
        child: Text(
          position,
          textAlign: TextAlign.center,
          style: GvTypography.statValue.copyWith(fontSize: 18),
        ),
      ),
      title: Text(driverName),
      subtitle: _subtitle(teamText, inlineTeam: !hasSecondaryAction),
      trailing: _trailing(),
    );

    if (!hasSecondaryAction) return primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        primary,
        Padding(
          padding: const EdgeInsets.only(left: GvSpacing.xl),
          child: Semantics(
            button: true,
            label: teamSemanticLabel,
            child: ExcludeSemantics(
              excluding: teamSemanticLabel != null,
              child: Material(
                color: Colors.transparent,
                borderRadius: GvRadii.mdAll,
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onTeamTap,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: GvLayout.minTouchTarget,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: GvSpacing.sm,
                      ),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          teamText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GvTypography.label,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget? _subtitle(String? teamText, {required bool inlineTeam}) {
    final List<String> parts = <String>[
      if (inlineTeam && teamText != null) teamText,
      ?statusLabel,
      ?badgeLabel,
    ];
    return parts.isEmpty ? null : Text(parts.join(' · '));
  }

  Widget? _trailing() {
    final String? time = timeOrGap;
    final String? value = score;
    if (time == null && value == null) return null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (value != null)
          Text(value, style: GvTypography.statValue.copyWith(fontSize: 18)),
        if (time != null)
          Text(time, style: GvTypography.label.copyWith(fontSize: 13)),
      ],
    );
  }
}
