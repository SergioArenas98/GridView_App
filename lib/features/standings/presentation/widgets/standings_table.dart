import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../standings_row_view.dart';

/// Space above the scrolling content (`.stand { padding-top: 8px }`) and below
/// it (24px; the shell already reserves the navigation's height and inset).
const EdgeInsets standingsContentPadding = EdgeInsets.only(top: 8, bottom: 24);

/// The championship table: the selected table's status block, then its rows in
/// their delivered order, as one lazy list with its own controller and
/// [PageStorageKey], so each table keeps its own position.
class StandingsList extends StatelessWidget {
  const StandingsList({
    super.key,
    required this.keyPrefix,
    required this.storageKey,
    required this.controller,
    required this.onRefresh,
    required this.status,
    required this.rows,
    required this.pointsUnit,
    required this.onOpen,
  });

  final String keyPrefix;
  final String storageKey;
  final ScrollController controller;
  final Future<void> Function() onRefresh;
  final Widget status;
  final List<StandingsRowView> rows;

  /// The localized unit under the leader's points ("pts").
  final String pointsUnit;
  final void Function(String entityId) onOpen;

  /// List items before the first row: the status block.
  static const int _leading = 1;

  @override
  Widget build(BuildContext context) {
    return StandingsRefresh(
      onRefresh: onRefresh,
      child: ListView.builder(
        // Keeps this table's own position when the other one is shown and
        // this list is rebuilt.
        key: PageStorageKey<String>(storageKey),
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: standingsContentPadding,
        itemCount: rows.length + _leading,
        itemBuilder: (BuildContext context, int item) {
          if (item < _leading) return status;
          final int index = item - _leading;
          final StandingsRowView row = rows[index];
          final bool afterLeader = index > 0 && rows[index - 1].isLeader;
          return StandingsRankRow(
            key: ValueKey<String>('$keyPrefix-${row.entityId}'),
            row: row,
            pointsUnit: pointsUnit,
            // Hairlines run between ordinary rows only: none above the first
            // row, none on a leader card and none directly under one.
            dividerAbove: index > 0 && !afterLeader,
            followsLeader: afterLeader,
            onOpen: () => onOpen(row.entityId),
          );
        },
      ),
    );
  }
}

/// One ranking row: the shared [GvPrimerStandingsRow] (ordinary row, or the
/// leader card for a confirmed position 1), plus the decorative team-colour
/// tick when the standing supplies a colour (ST08 / ST13, XT-3).
///
/// The tick sits where the prototype's `.st--accent` tick does (6px into the
/// link, 16px from its top) at the XT-3 tick geometry (3px, 12°), drawn by
/// [GvPrimerTeamMark] with the supplied colour unchanged and its 1px boundary
/// only below 3:1 against the surface it sits on (the page, or the leader's
/// inverse plane). Its length is Explore's fixed 40px tick (`.ent` tick):
/// the Standings CSS stretched it to the row (`bottom: 16px`), which was
/// never rendered (STD-06) and, in rows several lines tall at 200% text,
/// leaned across the leader's position figure and past the screen edge. It is
/// hidden from semantics and ignores pointers, so it never changes the row's
/// target, reading order or focus.
class StandingsRankRow extends StatelessWidget {
  const StandingsRankRow({
    super.key,
    required this.row,
    required this.pointsUnit,
    required this.dividerAbove,
    required this.followsLeader,
    required this.onOpen,
  });

  final StandingsRowView row;
  final String pointsUnit;
  final bool dividerAbove;
  final bool followsLeader;
  final VoidCallback onOpen;

  /// The tick's inset from the link's leading edge and top, and its length.
  static const double tickStart = 6;
  static const double tickTop = 16;
  static const double tickLength = 40;

  @override
  Widget build(BuildContext context) {
    final String? provisional = row.provisionalLabel;
    final Widget base = GvPrimerStandingsRow(
      position: row.position,
      name: row.name,
      nameIsFallback: row.nameIsFallback,
      leaderLabel: row.leaderLabel,
      details: row.details,
      statuses: <GvPrimerStatusLabel>[
        if (provisional != null)
          GvPrimerStatusLabel(provisional, GvPrimerChipKind.known),
      ],
      points: row.points,
      pointsUnit: row.isLeader ? pointsUnit : null,
      semanticLabel: row.semanticLabel,
      onOpen: onOpen,
      dividerAbove: dividerAbove && !row.isLeader,
      followsLeader: row.isLeader && followsLeader,
    );
    final Color? accent = row.accentColor;
    if (accent == null) return base;

    final Widget tick;
    final Offset at;
    if (row.isLeader) {
      // The leader card is inset 8px (4px above unless it follows another
      // leader, 6px below); the tick sits on its inverse plane.
      final Color plane = GvPrimerSurface.of(
        context,
      ).themeRoles.surface.inverse.colors.first;
      tick = GvPrimerSurface(
        kind: GvPrimerSurfaceKind.inverse,
        child: GvPrimerTeamMark(
          shape: GvPrimerTeamShape.tick,
          color: accent,
          surface: plane,
          length: tickLength,
        ),
      );
      at = Offset(8 + tickStart, (followsLeader ? 0 : 4) + tickTop);
    } else {
      tick = GvPrimerTeamMark(
        shape: GvPrimerTeamShape.tick,
        color: accent,
        length: tickLength,
      );
      at = const Offset(tickStart, tickTop);
    }
    return Stack(
      children: <Widget>[
        base,
        Positioned(
          left: at.dx,
          top: at.dy,
          width: GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.tick),
          height: tickLength,
          child: IgnorePointer(
            child: KeyedSubtree(
              key: ValueKey<String>('standings-tick-${row.entityId}'),
              child: tick,
            ),
          ),
        ),
      ],
    );
  }
}

/// A materialized table that legitimately has no rows. A real state — not a
/// loader and not an error — and still refreshable.
class StandingsEmptyTable extends StatelessWidget {
  const StandingsEmptyTable({
    super.key,
    required this.title,
    required this.message,
    required this.status,
    required this.onRefresh,
  });

  final String title;
  final String message;
  final Widget status;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return StandingsRefresh(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: standingsContentPadding,
        children: <Widget>[
          status,
          GvPrimerEmptyState(
            icon: Icons.emoji_events_outlined,
            title: title,
            message: message,
            size: GvPrimerEmptySize.list,
          ),
        ],
      ),
    );
  }
}

/// A section-level first-load error: the shell, the season context and the
/// selector all stay usable, and retry targets exactly this table's resource.
class StandingsErrorTable extends StatelessWidget {
  const StandingsErrorTable({
    super.key,
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: <Widget>[
        GvPrimerEmptyState(
          icon: Icons.emoji_events_outlined,
          title: title,
          message: message,
          size: GvPrimerEmptySize.list,
          action: GvPrimerButton(label: l10n.retry, onPressed: onRetry),
        ),
      ],
    );
  }
}

/// The structured loading placeholder, shown only while the selected table has
/// no materialized local representation: six static 56px blocks in the
/// theme's placeholder colours (`.skeleton`, LT-16), announced once.
class StandingsSkeleton extends StatelessWidget {
  const StandingsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: <Widget>[
        GvPrimerLoading(
          semanticLabel: AppLocalizations.of(context).a11yLoading,
          child: Padding(
            key: const ValueKey<String>('standings-skeleton'),
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
              vertical: 8,
            ),
            child: Column(
              children: <Widget>[
                for (int i = 0; i < 6; i++) ...<Widget>[
                  if (i > 0) const SizedBox(height: 4),
                  const GvPrimerSkeleton(height: 56),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Pull-to-refresh in Primer roles: the accent spinner on the band.
class StandingsRefresh extends StatelessWidget {
  const StandingsRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: roles.text.accent,
      backgroundColor: roles.surface.band,
      child: child,
    );
  }
}
