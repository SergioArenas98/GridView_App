import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../shared/presentation/widgets/primer_detail_states.dart';

/// The Team Detail championship block (`td.css` `.tcw`, T06–T09, T22): the
/// shared stat strip in its Team style (position | points | wins, 12°
/// seams; "Unranked" as a word), the provisional chip, and the ruled
/// destination row to the exact-season Constructors' Standings.
///
/// Vertical rhythm reproduces the prototype's CSS, margins included: 14px
/// above the block, the strip's 1em `<dl>` margin above and below it (15px
/// at 100%, 30px at 200%) collapsing with the next element's own top margin
/// (chip 14, link row 16). Wins are omitted when absent, a confirmed zero
/// is kept.
class TeamChampionship extends StatelessWidget {
  const TeamChampionship({
    super.key,
    required this.stats,
    required this.standingsLabel,
    required this.onOpenStandings,
    this.provisionalLabel,
    this.fitStats = false,
  });

  final List<GvPrimerStat> stats;

  /// The strip's content-aware lines ([GvPrimerStatStrip.fitContent];
  /// Step 55C.10R, owner-approved Step 55C.10F). Off by default; Team
  /// Detail turns it on.
  final bool fitStats;

  /// `resultStatusProvisional` when the standing is provisional.
  final String? provisionalLabel;
  final String standingsLabel;
  final VoidCallback onOpenStandings;

  @override
  Widget build(BuildContext context) {
    final double em = GvPrimerLayout.containerEm(
      MediaQuery.textScalerOf(context),
      1,
    );
    return Column(
      key: const ValueKey<String>('team-championship'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        SizedBox(height: 14 + em),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
          ),
          child: GvPrimerStatStrip(stats: stats, fitContent: fitStats),
        ),
        if (provisionalLabel != null) ...<Widget>[
          SizedBox(height: math.max(em, 14)),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: GvPrimerStatusChip(
                label: provisionalLabel!,
                kind: GvPrimerChipKind.known,
              ),
            ),
          ),
          const SizedBox(height: 16),
        ] else
          SizedBox(height: math.max(em, 16)),
        GvPrimerLinkRow(label: standingsLabel, onActivate: onOpenStandings),
      ],
    );
  }
}

/// One row of the season spec sheet.
@immutable
class TeamSpec {
  const TeamSpec({required this.label, required this.value});

  final String label;
  final String value;
}

/// The season facts as a ruled spec sheet (`td.css` `.sheet`, T15–T18):
/// term and value on a shared baseline in 2fr / 3fr columns 16px apart,
/// 12px above and below each, a `line.subtle` rule above every row and
/// below the last. At or below 20em (320dp at 200%) the value moves under
/// its term, 2px apart. Each row reads as one unit ("Power unit, Renault").
class TeamSpecSheet extends StatelessWidget {
  const TeamSpecSheet({super.key, required this.specs});

  final List<TeamSpec> specs;

  /// Narrow at or below this container width in `em`.
  static const double narrowEm = 20;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final BorderSide rule = BorderSide(color: roles.line.subtle);
    final TextStyle termStyle = GvPrimerTypography.archivo(
      size: 14,
      weight: 400,
      height: 1.35,
    ).copyWith(color: roles.text.secondary);
    final TextStyle valueStyle = GvPrimerTypography.archivo(
      size: 16,
      weight: 650,
      height: 1.3,
    ).copyWith(color: roles.text.primary);
    return Padding(
      key: const ValueKey<String>('team-spec-sheet'),
      padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final bool narrow =
              constraints.maxWidth <=
              GvPrimerLayout.containerEm(
                MediaQuery.textScalerOf(context),
                narrowEm,
              );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              for (final (int i, TeamSpec spec) in specs.indexed)
                DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border(
                      top: rule,
                      bottom: i == specs.length - 1 ? rule : BorderSide.none,
                    ),
                  ),
                  child: Padding(
                    // 12px under the 1px rule (and above the last one).
                    padding: EdgeInsets.only(
                      top: 13,
                      bottom: i == specs.length - 1 ? 13 : 12,
                    ),
                    child: MergeSemantics(
                      child: narrow
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(spec.label, style: termStyle),
                                const SizedBox(height: 2),
                                Text(spec.value, style: valueStyle),
                              ],
                            )
                          : Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: <Widget>[
                                Expanded(
                                  flex: 2,
                                  child: Text(spec.label, style: termStyle),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  flex: 3,
                                  child: Text(spec.value, style: valueStyle),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// The Team Detail loading placeholder (`td.css` `.skel`, TEAM-01 item 11
/// pending): the shared detail skeleton with a 168px banner block and no
/// hairline.
class TeamDetailSkeleton extends StatelessWidget {
  const TeamDetailSkeleton({super.key});

  /// Banner block height (`.skel__banner`).
  static const double bannerHeight = 168;

  @override
  Widget build(BuildContext context) => const PrimerDetailSkeleton(
    blockHeight: bannerHeight,
    listKey: ValueKey<String>('team-detail-skeleton'),
  );
}
