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
  });

  final Widget? leading;
  final Widget title;
  final Widget? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? accentColor;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
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
            child: Row(
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
                  trailing!,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

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

class GvResultRow extends StatelessWidget {
  const GvResultRow({
    super.key,
    required this.position,
    required this.driverName,
    this.team,
    this.timeOrGap,
    this.accentColor,
    this.onTap,
  });

  final String position;
  final String driverName;
  final String? team;
  final String? timeOrGap;
  final Color? accentColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _RowScaffold(
      onTap: onTap,
      accentColor: accentColor,
      leading: SizedBox(
        width: 28,
        child: Text(
          position,
          textAlign: TextAlign.center,
          style: GvTypography.statValue.copyWith(fontSize: 18),
        ),
      ),
      title: Text(driverName),
      subtitle: team == null ? null : Text(team!),
      trailing: timeOrGap == null
          ? null
          : Text(timeOrGap!, style: GvTypography.label.copyWith(fontSize: 13)),
    );
  }
}
