import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/gv_primer_effects.dart';
import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_focus.dart';
import 'gv_primer_livery_cut.dart';
import 'gv_primer_row_parts.dart';
import 'gv_primer_status_chip.dart';

/// A Primer V2 Grand Prix classification row (`gpd.css` R01–R14, with DK-1,
/// DK-3, DK-6, LT-5, LT-17, VS-1 and XT-5).
///
/// A timing tower: the position sits in a continuous rail cell at the screen
/// edge (`surface.band`), the confirmed winner's cell is the one decorative
/// brand-gradient block with its 12° trailing cut; the name, an optional
/// separate team link and the values follow. The whole row is one link
/// ([onOpen], [semanticLabel]); the team line is its own 48px link above it
/// ([onOpenTeam], [teamSemanticLabel]), focused after the row.
///
/// Presentation only. The caller decides every word and every state from
/// its own data: the displayed [position] ("—" when there is none), whether
/// this is the confirmed [winner], the finish words in [statuses] (DNF, DNS,
/// DSQ, DNQ and Lapped are [GvPrimerChipKind.known]; an unknown finish is
/// [GvPrimerChipKind.unknown], dashed), and the spoken [semanticLabel]. A
/// missing value is simply absent: no false zero and no invented points.
///
/// Above `21em` (315px at 100% text) the values are a right-hand column;
/// below it they move under the name, so long names and Spanish text keep the
/// full width at 200%.
class GvPrimerResultRow extends StatelessWidget {
  const GvPrimerResultRow({
    super.key,
    required this.position,
    required this.driverName,
    required this.semanticLabel,
    required this.onOpen,
    this.driverNameIsFallback = false,
    this.winner = false,
    this.winnerLabel,
    this.teamName,
    this.teamNameIsFallback = false,
    this.teamSemanticLabel,
    this.onOpenTeam,
    this.points,
    this.pointsUnit,
    this.timing,
    this.statuses = const <GvPrimerStatusLabel>[],
    this.dividerAbove = true,
  }) : assert(!winner || winnerLabel != null, 'A winner row needs its kicker'),
       assert(
         teamName == null || teamSemanticLabel != null,
         'A team link needs its accessible name',
       );

  /// The displayed position, exactly as delivered ("1", "15"), or the
  /// caller's no-position mark ("—").
  final String position;
  final String driverName;

  /// [driverName] is a localized fallback for an unresolved name.
  final bool driverNameIsFallback;

  /// Confirmed race winner: the brand-gradient rail cell, the larger name and
  /// the [winnerLabel] kicker. The caller decides it (one resolved P1).
  final bool winner;
  final String? winnerLabel;

  /// The team line; `null` leaves the row without one.
  final String? teamName;
  final bool teamNameIsFallback;
  final String? teamSemanticLabel;

  /// Opens the team; `null` shows the team name without a link.
  final VoidCallback? onOpenTeam;

  /// Points as displayed ("25", "18.5"); `null` when the result awards none
  /// or none are known.
  final String? points;

  /// The unit after [points] ("pts").
  final String? pointsUnit;

  /// Race time, gap or laps ("1:15:12.345", "+3.210", "+2 laps").
  final String? timing;

  /// Finish words as small chips (DNF, Lapped, "Status unknown"…).
  final List<GvPrimerStatusLabel> statuses;

  /// The row link's accessible name (the visible text is hidden from
  /// semantics so it is read once).
  final String semanticLabel;

  /// Opens the driver; `null` disables the row link.
  final VoidCallback? onOpen;

  /// Draws the hairline above the row (not on the first row).
  final bool dividerAbove;

  /// Gap between the rail and the name column (`.cl` `column-gap`).
  static const double columnGap = 14;

  /// The narrow layout applies at or below this container width in `em`.
  static const double narrowEm = 21;

  /// Rail width under [scaler]: `calc(var(--gutter) + min(2.5rem, 44px))`.
  static double railWidth(TextScaler scaler) =>
      GvPrimerLayout.gutter + GvPrimerLayout.cappedRem(scaler, 2.5, 44);

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData surface = GvPrimerSurface.of(context);
    final GvPrimerRoles roles = surface.roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double rail = railWidth(scaler);

    return GvPrimerFocusTarget(
      onActivate: onOpen,
      role: GvPrimerTargetRole.link,
      semanticLabel: semanticLabel,
      geometry: GvPrimerFocusGeometry.row,
      // The winner row's ring crosses the gradient cell (DK-3, LT-5).
      ringColor: winner ? surface.crossingFocusRing : null,
      backingSurface: winner ? roles.surface.page : null,
      pressedColor: roles.state.pressedRow,
      hoverColor: roles.state.hover,
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final bool narrow =
              constraints.maxWidth <=
              GvPrimerLayout.containerEm(scaler, narrowEm);
          return Stack(
            children: <Widget>[
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: rail,
                child: CustomPaint(
                  painter: GvPrimerRailCellPainter(
                    winner: winner,
                    fill: roles.surface.band,
                    separator: roles.surface.page,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: GvPrimerLayout.gutter),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    minHeight: GvPrimerLayout.minTarget,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      SizedBox(width: rail, child: _position(roles, scaler)),
                      // The name column starts 8px early so the team link's
                      // own padding lines its text up with the name
                      // (`.cl__team { margin-left: -8px; padding: 13px 8px }`).
                      const SizedBox(width: columnGap - _teamInset),
                      Expanded(child: _who(context, roles, scaler, narrow)),
                      if (!narrow && _hasValues) ...<Widget>[
                        const SizedBox(width: columnGap),
                        _values(roles, scaler, narrow: false),
                      ],
                    ],
                  ),
                ),
              ),
              if (dividerAbove)
                GvPrimerRowDivider(
                  start: rail + columnGap,
                  end: GvPrimerLayout.gutter,
                ),
            ],
          );
        },
      ),
    );
  }

  static const double _teamInset = 8;

  bool get _hasValues =>
      points != null || timing != null || statuses.isNotEmpty;

  Widget _position(GvPrimerRoles roles, TextScaler scaler) {
    final double size = winner
        ? GvPrimerTypography.cappedSize(scaler, 30, 36)
        : GvPrimerTypography.cappedSize(scaler, 24, 30);
    return Padding(
      padding: EdgeInsets.only(top: winner ? 11 : 13, right: winner ? 18 : 10),
      child: ExcludeSemantics(
        child: Text(
          position,
          textAlign: TextAlign.right,
          textScaler: TextScaler.noScaling,
          softWrap: false,
          style: GvPrimerRowType.figure(
            size: size,
          ).copyWith(color: winner ? roles.fill.brand.on : roles.text.primary),
        ),
      ),
    );
  }

  Widget _who(
    BuildContext context,
    GvPrimerRoles roles,
    TextScaler scaler,
    bool narrow,
  ) {
    final double nameSize = winner
        ? GvPrimerTypography.cappedSize(scaler, 20, 30)
        : 17;
    final TextStyle nameStyle =
        (driverNameIsFallback
                ? GvPrimerRowType.fallback(
                    nameSize,
                    height: winner ? 1.1 : 1.25,
                  )
                : GvPrimerTypography.archivo(
                    size: nameSize,
                    weight: winner ? 800 : 750,
                    width: winner ? 82 : 86,
                    height: winner ? 1.1 : 1.25,
                  ))
            .copyWith(color: roles.text.primary);
    final String? team = teamName;
    return Padding(
      padding: EdgeInsets.only(top: 12, bottom: team == null ? 12 : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.only(left: _teamInset),
            child: ExcludeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  if (winner)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        winnerLabel!,
                        style: GvPrimerRowType.kicker.copyWith(
                          color: roles.text.accent,
                        ),
                      ),
                    ),
                  Text(
                    driverName,
                    style: nameStyle,
                    textScaler: winner ? TextScaler.noScaling : null,
                  ),
                ],
              ),
            ),
          ),
          if (team != null)
            _GvPrimerTeamLink(
              name: team,
              fallback: teamNameIsFallback,
              semanticLabel: teamSemanticLabel!,
              onOpen: onOpenTeam,
            ),
          if (narrow)
            Padding(
              padding: const EdgeInsets.only(left: _teamInset, bottom: 12),
              child: _values(roles, scaler, narrow: true),
            ),
        ],
      ),
    );
  }

  Widget _values(
    GvPrimerRoles roles,
    TextScaler scaler, {
    required bool narrow,
  }) {
    final double pointsSize = GvPrimerTypography.cappedSize(scaler, 22, 28);
    final List<Widget> items = <Widget>[
      if (points != null)
        Text.rich(
          TextSpan(
            text: points,
            style: GvPrimerRowType.figure(
              size: pointsSize,
              tracking: -0.02,
            ).copyWith(color: roles.text.primary),
            children: <InlineSpan>[
              if (pointsUnit != null)
                TextSpan(
                  text: ' $pointsUnit',
                  // The unit is 13px text: it scales with the text setting.
                  style: GvPrimerRowType.unit.copyWith(
                    fontSize: scaler.scale(13),
                    color: roles.text.secondary,
                  ),
                ),
            ],
          ),
          textScaler: TextScaler.noScaling,
          softWrap: false,
        ),
      if (timing != null)
        Text(
          timing!,
          softWrap: false,
          style: GvPrimerTypography.archivo(
            size: 13,
            weight: 600,
            tabularFigures: true,
          ).copyWith(color: roles.text.secondary),
        ),
      if (statuses.isNotEmpty)
        GvPrimerRowStatuses(
          statuses: statuses,
          size: GvPrimerChipSize.small,
          alignment: narrow ? WrapAlignment.start : WrapAlignment.end,
        ),
    ];
    final Widget body = narrow
        ? Wrap(
            spacing: 10,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: items,
          )
        : Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                for (int i = 0; i < items.length; i++) ...<Widget>[
                  if (i > 0) const SizedBox(height: 4),
                  items[i],
                ],
              ],
            ),
          );
    return ExcludeSemantics(child: body);
  }
}

/// The classification's separate team link: at least 48 × 48, 8px padding
/// either side, underlined secondary text with a trailing 16px chevron kept
/// on the last word; ring 2px inside (LT-17), pressed `state.pressed.control`,
/// hover `surface.band` (XT-5). It hugs its text and chevron (GPD-12, Step
/// 55C.12R), so its ring and target follow the visible link and the rest of
/// the name column stays the driver row's.
class _GvPrimerTeamLink extends StatelessWidget {
  const _GvPrimerTeamLink({
    required this.name,
    required this.fallback,
    required this.semanticLabel,
    required this.onOpen,
  });

  final String name;
  final bool fallback;
  final String semanticLabel;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextStyle base =
        (fallback
                ? GvPrimerRowType.fallback(14, height: 1.25)
                : GvPrimerTypography.archivo(
                    size: 14,
                    weight: 600,
                    height: 1.25,
                  ))
            .copyWith(color: roles.text.secondary);
    final bool linked = onOpen != null;
    final TextStyle nameStyle = base.copyWith(
      decoration: linked ? TextDecoration.underline : null,
      decorationColor: roles.line.strong,
    );
    final Widget text = linked
        ? GvPrimerTrailingChevronText(
            text: name,
            style: nameStyle,
            chevronColor: base.color!,
          )
        : SizedBox(
            width: double.infinity,
            child: Text(name, style: nameStyle),
          );
    final Widget box = ConstrainedBox(
      // At least 48 × 48 (GPD-12): a very short team name keeps a full
      // target once the link hugs its content.
      constraints: const BoxConstraints(
        minHeight: GvPrimerLayout.minTarget,
        minWidth: GvPrimerLayout.minTarget,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 13),
        child: text,
      ),
    );
    if (!linked) return ExcludeSemantics(child: box);
    return GvPrimerFocusTarget(
      onActivate: onOpen,
      role: GvPrimerTargetRole.link,
      semanticLabel: semanticLabel,
      geometry: GvPrimerFocusGeometry.teamLink,
      pressedColor: roles.state.pressedControl,
      hoverColor: roles.surface.band,
      fillRadius: BorderRadius.circular(GvPrimerLayout.radiusSm),
      child: ExcludeSemantics(child: box),
    );
  }
}

/// Paints a classification rail cell: `surface.band` with a 1px page-colour
/// line at its foot (`box-shadow: inset 0 -1px 0 var(--ground)`), or, for the
/// confirmed winner, the decorative brand gradient (DK-6) with the 12°
/// trailing cut derived from the cell's height (XS-27, GPD-10).
class GvPrimerRailCellPainter extends CustomPainter {
  const GvPrimerRailCellPainter({
    required this.winner,
    required this.fill,
    required this.separator,
  });

  final bool winner;
  final Color fill;
  final Color separator;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final Rect rect = Offset.zero & size;
    final double footWidth;
    if (winner) {
      final Path cell = const GvLiveryCut(
        edges: GvLiveryCutEdges.trailing,
      ).getOuterPath(rect);
      canvas.drawPath(
        cell,
        Paint()
          ..shader = GvPrimerEffects.brandGradientPlate
              .toGradient()
              .createShader(rect),
      );
      footWidth = size.width - GvLiveryCut.runFor(size.height);
    } else {
      canvas.drawRect(rect, Paint()..color = fill);
      footWidth = size.width;
    }
    canvas.drawRect(
      Rect.fromLTWH(0, size.height - 1, footWidth, 1),
      Paint()..color = separator,
    );
  }

  @override
  bool shouldRepaint(GvPrimerRailCellPainter oldDelegate) =>
      oldDelegate.winner != winner ||
      oldDelegate.fill != fill ||
      oldDelegate.separator != separator;
}

/// Text followed by a 16px chevron that stays with the last word (the
/// prototype's `.nw` span around the last word and `.cl__go`): the chevron sits 2px
/// after the last line, and when it does not fit there the last word moves
/// to a new line with it. Measured with the ambient text scaler, so the text
/// is never scaled twice and the chevron stays 16px.
class GvPrimerTrailingChevronText extends StatelessWidget {
  const GvPrimerTrailingChevronText({
    super.key,
    required this.text,
    required this.style,
    required this.chevronColor,
  });

  final String text;
  final TextStyle style;
  final Color chevronColor;

  static const double chevronSize = 16;
  static const double gap = 2;

  @override
  Widget build(BuildContext context) {
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final TextDirection direction = Directionality.of(context);
    // Measured in the style the `Text` below actually renders with (the
    // ambient DefaultTextStyle merged with [style]), so the hugging box
    // never re-wraps the paragraph (Step 55C.12F; the test font exposed an
    // inherited letter spacing the bare style did not carry).
    final TextStyle effective = DefaultTextStyle.of(context).style.merge(style);
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double max = constraints.maxWidth;
        TextPainter layout(String value) => TextPainter(
          text: TextSpan(text: value, style: effective),
          textDirection: direction,
          textScaler: scaler,
        )..layout(maxWidth: max);

        String shown = text;
        TextPainter painter = layout(shown);
        LineMetrics last = painter.computeLineMetrics().last;
        final int split = text.trimRight().lastIndexOf(' ');
        if (last.left + last.width + gap + chevronSize > max && split > 0) {
          painter.dispose();
          shown = [
            text.substring(0, split),
            text.substring(split + 1),
          ].join(String.fromCharCode(0x0A));
          painter = layout(shown);
          last = painter.computeLineMetrics().last;
        }
        final List<LineMetrics> lines = painter.computeLineMetrics();
        final double lineTop = lines
            .take(lines.length - 1)
            .fold<double>(0, (double sum, LineMetrics l) => sum + l.height);
        final double left = (last.left + last.width + gap).clamp(
          0,
          (max - chevronSize).clamp(0, double.infinity),
        );
        // The link hugs its content (GPD-12, Step 55C.12R): `.cl__team` is
        // a block inside the `.cl__who` flex column, whose
        // `align-items: flex-start` shrinks it to the text and chevron. The
        // box is the wider of the longest line and the last line's end plus
        // the chevron, never wider than the column.
        final double longest = lines.fold<double>(
          0,
          (double w, LineMetrics l) => math.max(w, l.left + l.width),
        );
        // Rounded up with a 1px slack, so the paragraph laid out again in
        // this box keeps exactly the measured line breaks (a box at the
        // exact longest line can re-wrap it by a sub-pixel).
        final double content =
            math.max(longest, left + chevronSize).ceilToDouble() + 1;
        final double width = max.isFinite ? math.min(max, content) : content;
        final double height = painter.height;
        painter.dispose();
        return SizedBox(
          width: width,
          height: height,
          child: Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              Text(shown, style: style),
              Positioned(
                left: left,
                top: lineTop + (last.height - chevronSize) / 2,
                child: GvPrimerRowChevron(
                  size: chevronSize,
                  color: chevronColor,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
