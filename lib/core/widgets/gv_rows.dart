import 'package:flutter/material.dart';

import '../theme/theme.dart';
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
      color: emphasized ? context.gvColors.surfaceElevated : Colors.transparent,
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
                  _content(context, constraints.maxWidth),
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
  Widget _content(BuildContext context, double width) {
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
                style: context.gvText.cardTitle.copyWith(fontSize: 16),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                child: title,
              ),
              if (subtitle != null)
                DefaultTextStyle.merge(
                  style: context.gvText.label,
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
    this.secondaryTime,
    this.tone = GvStatusTone.neutral,
    this.statusLabel,
    this.onTap,
  });

  final String name;
  final String? time;

  /// A second clock for the same instant, shown under [time].
  ///
  /// Only supplied when the user asked to see both clocks *and* the two differ;
  /// the caller never passes the same value twice. It is rendered smaller and
  /// muted so the pair reads as one time with two zones rather than as two
  /// competing times.
  final String? secondaryTime;
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
      trailing: time == null ? null : _time(context),
    );
  }

  Widget _time(BuildContext context) {
    final Text primary = Text(
      time!,
      textAlign: TextAlign.end,
      style: context.gvText.label.copyWith(fontSize: 13),
    );
    if (secondaryTime == null) return primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        primary,
        Text(
          secondaryTime!,
          textAlign: TextAlign.end,
          style: context.gvText.caption,
        ),
      ],
    );
  }
}

/// A championship-table row: a displayed position, the competitor's name, an
/// optional secondary line (team, statistics, a status marker), a score value
/// and restrained leader emphasis.
///
/// Every value is a plain string the caller has already formatted, and every
/// optional one is simply not rendered when absent — so a missing team leaves no
/// dangling separator and a missing statistic never becomes a false zero. The
/// component knows nothing about drivers, constructors, repositories, Riverpod,
/// Drift or DTOs.
class GvStandingsRow extends StatelessWidget {
  const GvStandingsRow({
    super.key,
    required this.position,
    required this.name,
    this.team,
    required this.points,
    this.stat,
    this.badgeLabel,
    this.isLeader = false,
    this.accentColor,
    this.onTap,
    this.semanticLabel,
  });

  /// The displayed position exactly as the caller supplies it. Duplicates are
  /// allowed, and a caller with no position supplies its own placeholder.
  final String position;
  final String name;
  final String? team;
  final String points;

  /// A secondary statistic (e.g. wins), already formatted and localized.
  final String? stat;

  /// A short status marker for this row (e.g. a provisional marker).
  final String? badgeLabel;

  /// Restrained emphasis for a confirmed leader. Reinforced by [semanticLabel]
  /// rather than carried by colour alone.
  final bool isLeader;
  final Color? accentColor;
  final VoidCallback? onTap;

  /// Replaces the row's merged child semantics with one explicit reading order.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final List<String> details = <String>[?team, ?stat, ?badgeLabel];
    return _RowScaffold(
      onTap: onTap,
      semanticLabel: semanticLabel,
      emphasized: isLeader,
      accentColor: accentColor,
      // A minimum width keeps single- and double-digit positions aligned, while
      // still letting a wider value (a two-digit position at a large text
      // scale, or the unranked placeholder) take the room it needs on one line
      // instead of wrapping into a second row.
      leading: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 32),
        child: Text(
          position,
          textAlign: TextAlign.center,
          maxLines: 1,
          style: context.gvText.statValue.copyWith(fontSize: 18),
        ),
      ),
      title: Text(name),
      subtitle: details.isEmpty ? null : Text(details.join(' · ')),
      trailing: Text(
        points,
        style: context.gvText.statValue.copyWith(fontSize: 18),
      ),
    );
  }
}

/// A driver list row: the driver's name, an optional already-composed secondary
/// line, an optional short code and an optional number.
///
/// Every value is a plain string the caller has already formatted and
/// localized, and every optional one is simply not rendered when absent — so a
/// missing team leaves no dangling separator and a missing number never becomes
/// a false zero. The component knows nothing about drivers as a domain, about
/// repositories, Riverpod, Drift or DTOs.
class GvDriverRow extends StatelessWidget {
  const GvDriverRow({
    super.key,
    required this.name,
    this.team,
    this.subtitle,
    this.leading,
    this.number,
    this.shortCode,
    this.accentColor,
    this.onTap,
    this.semanticLabel,
  });

  final String name;

  /// A team name rendered as the secondary line. Superseded by [subtitle] when
  /// the caller has composed a richer line of its own.
  final String? team;

  /// An already-composed secondary line. Takes precedence over [team].
  final String? subtitle;

  final Widget? leading;
  final String? number;

  /// A short competitor code (e.g. `VER`), rendered beneath the number.
  final String? shortCode;

  /// A restrained team accent. Never the sole carrier of identity.
  final Color? accentColor;

  final VoidCallback? onTap;

  /// Replaces the row's merged child semantics with one explicit reading order.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final String? secondary = subtitle ?? team;
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      accentColor: accentColor,
      semanticLabel: semanticLabel,
      title: Text(name),
      subtitle: secondary == null ? null : Text(secondary),
      trailing: _trailing(context),
    );
  }

  Widget? _trailing(BuildContext context) {
    final String? value = number;
    final String? code = shortCode;
    if (value == null && code == null) return null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (value != null)
          Text(value, style: context.gvText.statValue.copyWith(fontSize: 18)),
        if (code != null)
          Text(code, style: context.gvText.label.copyWith(fontSize: 13)),
      ],
    );
  }
}

/// A team list row: the team's display name, an optional secondary line and a
/// restrained team accent.
class GvTeamRow extends StatelessWidget {
  const GvTeamRow({
    super.key,
    required this.name,
    this.subtitle,
    this.leading,
    this.accentColor,
    this.onTap,
    this.semanticLabel,
  });

  final String name;
  final String? subtitle;
  final Widget? leading;

  /// A restrained team accent. Never the sole carrier of identity.
  final Color? accentColor;

  final VoidCallback? onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      accentColor: accentColor,
      semanticLabel: semanticLabel,
      title: Text(name),
      subtitle: subtitle == null ? null : Text(subtitle!),
    );
  }
}

/// A circuit list row: the circuit's name and an optional secondary line
/// (location, related event, physical summary — already composed by the caller).
class GvCircuitRow extends StatelessWidget {
  const GvCircuitRow({
    super.key,
    required this.name,
    this.location,
    this.leading,
    this.trailing,
    this.onTap,
    this.semanticLabel,
  });

  final String name;
  final String? location;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      leading: leading,
      trailing: trailing,
      semanticLabel: semanticLabel,
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
          style: context.gvText.statValue.copyWith(fontSize: 18),
        ),
      ),
      title: Text(driverName),
      subtitle: _subtitle(teamText, inlineTeam: !hasSecondaryAction),
      trailing: _trailing(context),
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
                          style: context.gvText.label,
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

  Widget? _trailing(BuildContext context) {
    final String? time = timeOrGap;
    final String? value = score;
    if (time == null && value == null) return null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (value != null)
          Text(value, style: context.gvText.statValue.copyWith(fontSize: 18)),
        if (time != null)
          Text(time, style: context.gvText.label.copyWith(fontSize: 13)),
      ],
    );
  }
}
