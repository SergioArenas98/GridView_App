import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// One inline championship statistic (`.ch__more`): "Wins 7".
@immutable
class DriverInlineStat {
  const DriverInlineStat({required this.label, required this.value});

  final String label;
  final String value;
}

/// The Driver Detail championship block (`dd.css` `.ch`, D10–D14, D24): the
/// shared stat strip in its Driver style (position | 2px 12° seam | points;
/// "Unranked" as a word), wins and podiums as a ruled inline line, the
/// provisional chip, and the ruled destination row to the exact-season
/// Drivers' Standings.
///
/// Vertical rhythm reproduces the prototype's CSS, margins included: 14px
/// above the block, the strip's 1em `<dl>` margin above and below it (15px
/// at 100%, 30px at 200%) collapsing with the next element's own top margin
/// (inline line 18, chip 14, link row 16). Each part is omitted when its
/// data is absent; a confirmed zero is kept.
class DriverChampionship extends StatelessWidget {
  const DriverChampionship({
    super.key,
    required this.stats,
    required this.more,
    required this.standingsLabel,
    required this.onOpenStandings,
    this.provisionalLabel,
  });

  /// Position (lead figure or word) and points.
  final List<GvPrimerStat> stats;
  final List<DriverInlineStat> more;

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
    // The strip's bottom margin collapses with the first following element.
    double after(double ownTop) => math.max(em, ownTop);
    final List<Widget> tail = <Widget>[
      if (more.isNotEmpty) ...<Widget>[
        SizedBox(height: after(18)),
        _InlineStats(stats: more),
      ],
      if (provisionalLabel != null) ...<Widget>[
        SizedBox(height: more.isEmpty ? after(14) : 14),
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
      ],
      SizedBox(
        height: more.isEmpty && provisionalLabel == null ? after(16) : 16,
      ),
      GvPrimerLinkRow(label: standingsLabel, onActivate: onOpenStandings),
    ];
    return Column(
      key: const ValueKey<String>('driver-championship'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        SizedBox(height: 14 + em),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
          ),
          child: GvPrimerStatStrip(
            stats: stats,
            style: GvPrimerStatStripStyle.driver,
          ),
        ),
        ...tail,
      ],
    );
  }
}

/// `.ch__more`: a hairline, 12px, then label/value pairs on a shared
/// baseline, 28px apart (6px between wrapped lines). Label 14px weight 600
/// secondary; value `min(1.25rem, 28px)` weight 800 `wdth` 112, tabular.
class _InlineStats extends StatelessWidget {
  const _InlineStats({required this.stats});

  final List<DriverInlineStat> stats;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double valueSize = GvPrimerTypography.cappedSize(scaler, 20, 28);
    // One paragraph per pair, rendered unscaled with the label pre-scaled,
    // so label and value share a baseline and a long pair wraps instead of
    // overflowing (the CSS pair cannot wrap; at 320 @200% a long Spanish
    // label fills the line).
    final TextStyle labelStyle = GvPrimerTypography.archivo(
      size: scaler.scale(14),
      weight: 600,
      height: 1.45,
    ).copyWith(color: roles.text.secondary);
    final TextStyle valueStyle = GvPrimerTypography.archivo(
      size: valueSize,
      weight: 800,
      width: 112,
      height: 1.1,
      tabularFigures: true,
    ).copyWith(color: roles.text.primary);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: roles.line.subtle)),
        ),
        child: Padding(
          // 12px under the 1px hairline.
          padding: const EdgeInsets.only(top: 13),
          child: Wrap(
            spacing: 28,
            runSpacing: 6,
            children: <Widget>[
              for (final DriverInlineStat stat in stats)
                Text.rich(
                  TextSpan(
                    children: <InlineSpan>[
                      TextSpan(text: stat.label, style: labelStyle),
                      const WidgetSpan(child: SizedBox(width: 8)),
                      TextSpan(text: stat.value, style: valueStyle),
                    ],
                  ),
                  textScaler: TextScaler.noScaling,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
