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

/// A Primer V2 Standings ranking row, or the championship leader card
/// (`standings.css` ST01–ST18, with DK-1, DK-3, DK-4, VS-3, RK-1 and XT-5).
///
/// A timing-sheet line: position and points form two numeric rails, the name
/// and an optional details line sit between them, a chevron closes the row.
/// With [leaderLabel] the row becomes the one contrasting plane of the
/// screen (`surface.inverse`: Chalk in Dark, Graphite in Light), with the
/// accent position and kicker, a 12° Red Oxide seam, the larger figure and its
/// unit; its focus ring sits 2px outside the card in the page's focus colour.
///
/// Presentation only. The caller decides the leader from a confirmed
/// position 1 (never from an unranked entry; tied leaders each get the
/// treatment with the tied wording), the displayed [position] ("—" for an
/// unranked row), the provisional row marker in [statuses] (the word only,
/// no dagger: VS-2 rejected, VS-3) and the spoken [semanticLabel] (an
/// unranked row reads "Unranked", RK-1). Missing points or details are
/// absent, never a false zero.
///
/// At or below `20em` (300px at 100% text) the points move under the name so
/// names keep the full width.
class GvPrimerStandingsRow extends StatelessWidget {
  const GvPrimerStandingsRow({
    super.key,
    required this.position,
    required this.name,
    required this.semanticLabel,
    required this.onOpen,
    this.nameIsFallback = false,
    this.leaderLabel,
    this.details = const <String>[],
    this.statuses = const <GvPrimerStatusLabel>[],
    this.points,
    this.pointsUnit,
    this.dividerAbove = true,
    this.followsLeader = false,
  });

  /// The displayed position ("1", "9") or the caller's unranked mark ("—").
  final String position;
  final String name;

  /// [name] is a localized fallback for an unresolved identity.
  final bool nameIsFallback;

  /// The leader kicker ("Championship leader", "Tied for the championship
  /// lead"); non-null makes this row the leader card.
  final String? leaderLabel;

  /// The parts of the secondary line under the name, already localized by
  /// the caller (`['McLaren', '3 wins']`), shown joined by " · ". Each part
  /// stays on one line (the prototype's `nowrap` stat); lines break only
  /// after a separator. Empty for none.
  final List<String> details;

  /// Row markers as small chips (the provisional marker in mixed tables).
  final List<GvPrimerStatusLabel> statuses;

  /// Points as displayed ("120", "0.5"); `null` when unknown.
  final String? points;

  /// The unit under the leader's figure ("pts"). The approved design shows it
  /// on the leader card only (XS-12 stays open), so ordinary rows ignore it.
  final String? pointsUnit;

  final String semanticLabel;

  /// Opens the competitor; `null` disables the row.
  final VoidCallback? onOpen;

  /// Ordinary rows: draws the full-width hairline above the row. Never drawn
  /// on the leader card or directly under it.
  final bool dividerAbove;

  /// Leader card directly after another leader card (tied leaders): no top
  /// margin (`.st--leader + .st--leader { margin-top: 0 }`).
  final bool followsLeader;

  bool get _leader => leaderLabel != null;

  static const double _columnGap = 12;

  /// U+00A0 NO-BREAK SPACE.
  static final String _noBreakSpace = String.fromCharCode(0x00A0);

  /// The narrow layout applies at or below this container width in `em`.
  static const double narrowEm = 20;

  /// The secondary line from [parts], joined by " · " with the separator kept
  /// with the part before it, so a line breaks only after a separator.
  ///
  /// Each part is kept whole with no-break spaces (the prototype's `nowrap`
  /// stat, "3 wins") while it fits on one line of [maxWidth]. A part wider
  /// than a whole line (a long team name at 200% text in the leader card)
  /// keeps its ordinary spaces, so it wraps between words like the
  /// prototype's team text instead of being broken inside a word.
  static String detailsLine(
    List<String> parts, {
    required TextStyle style,
    required TextScaler scaler,
    required double maxWidth,
    required TextDirection direction,
  }) {
    bool fits(String text) =>
        !maxWidth.isFinite ||
        _width(text, style, scaler, direction) <= maxWidth;

    final List<String> kept = <String>[
      for (final (int i, String part) in parts.indexed)
        () {
          final String whole = part.replaceAll(' ', _noBreakSpace);
          final String measured = i < parts.length - 1
              ? '$whole$_noBreakSpace·'
              : whole;
          return fits(measured) ? whole : part;
        }(),
    ];
    return kept.join('$_noBreakSpace· ');
  }

  /// The single-line width of [text] in [style].
  static double _width(
    String text,
    TextStyle style,
    TextScaler scaler,
    TextDirection direction,
  ) {
    final TextPainter painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: direction,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    final double width = painter.width;
    painter.dispose();
    return width;
  }

  /// Position column: `min(2.75rem, 46px)`.
  static double positionColumn(TextScaler scaler) =>
      GvPrimerLayout.cappedRem(scaler, 2.75, 46);

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData page = GvPrimerSurface.of(context);
    final GvPrimerRoles roles = page.roles;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final bool narrow =
            constraints.maxWidth <=
            GvPrimerLayout.containerEm(scaler, narrowEm);
        if (!_leader) {
          return Stack(
            children: <Widget>[
              GvPrimerFocusTarget(
                onActivate: onOpen,
                role: GvPrimerTargetRole.link,
                semanticLabel: semanticLabel,
                geometry: GvPrimerFocusGeometry.row,
                pressedColor: roles.state.pressedRow,
                hoverColor: roles.state.hover,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    GvPrimerLayout.gutter,
                    12,
                    GvPrimerLayout.gutter - 4,
                    13,
                  ),
                  child: _content(context, scaler, narrow),
                ),
              ),
              if (dividerAbove)
                const GvPrimerRowDivider(
                  start: GvPrimerLayout.gutter,
                  end: GvPrimerLayout.gutter,
                ),
            ],
          );
        }
        final GvPrimerRoles theme = page.themeRoles;
        final Color flatPlane = theme.surface.inverse.colors.first;
        final BorderRadius radius = BorderRadius.circular(
          GvPrimerLayout.radiusMd,
        );
        return Padding(
          padding: EdgeInsets.fromLTRB(8, followsLeader ? 0 : 4, 8, 6),
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: theme.surface.inverse.toGradient(),
              borderRadius: radius,
              boxShadow: GvPrimerEffects.inversePlaneShadow(theme.brightness),
            ),
            child: GvPrimerFocusTarget(
              onActivate: onOpen,
              role: GvPrimerTargetRole.link,
              semanticLabel: semanticLabel,
              // Outside the card, on the page: the page's focus colour.
              geometry: GvPrimerFocusGeometry.leaderRow,
              ringColor: page.focusRing,
              // Hover: the approved flat plane (its first gradient stop).
              // Pressed (owner-reviewed, Step 55B.3.1): the plane's own
              // primary text at 6% over the card, never the Dark row `tray`.
              pressedColor: theme
                  .forScope(GvPrimerScope.inverse)
                  .pressedOverlay,
              hoverColor: flatPlane,
              fillRadius: radius,
              child: GvPrimerSurface(
                kind: GvPrimerSurfaceKind.inverse,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    GvPrimerLayout.gutter - 8,
                    14,
                    GvPrimerLayout.gutter - 8 - 4,
                    15,
                  ),
                  child: Builder(
                    builder: (BuildContext context) =>
                        _content(context, scaler, narrow),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _content(BuildContext context, TextScaler scaler, bool narrow) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final double posColumn = positionColumn(scaler);
    final Widget pos = SizedBox(
      width: posColumn,
      child: ExcludeSemantics(
        child: Text(
          position,
          textAlign: TextAlign.right,
          softWrap: false,
          textScaler: TextScaler.noScaling,
          style: GvPrimerRowType.figure(
            size: _leader
                ? GvPrimerTypography.cappedSize(scaler, 36, 40)
                : GvPrimerTypography.cappedSize(scaler, 28, 32),
          ).copyWith(color: _leader ? roles.text.accent : roles.text.secondary),
        ),
      ),
    );
    final Widget who = _who(roles, scaler);
    final Widget? pts = _points(roles, scaler, narrow);
    const Widget chevron = GvPrimerRowChevron(size: 16);

    if (!narrow) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64 - 12 - 13),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: <Widget>[
                  pos,
                  const SizedBox(width: _columnGap),
                  Expanded(child: who),
                  if (pts != null) ...<Widget>[
                    const SizedBox(width: _columnGap),
                    pts,
                  ],
                ],
              ),
            ),
            const SizedBox(width: _columnGap),
            chevron,
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: <Widget>[
            pos,
            const SizedBox(width: _columnGap),
            Expanded(child: who),
            const SizedBox(width: _columnGap),
            // No baseline: sits at the top, nudged 4px (`margin-top: 4px`).
            const Padding(padding: EdgeInsets.only(top: 4), child: chevron),
          ],
        ),
        if (pts != null) ...<Widget>[
          const SizedBox(height: 6),
          Padding(
            padding: EdgeInsets.only(left: posColumn + _columnGap),
            child: pts,
          ),
        ],
      ],
    );
  }

  Widget _who(GvPrimerRoles roles, TextScaler scaler) {
    final double nameSize = _leader
        ? GvPrimerTypography.cappedSize(scaler, 20, 36)
        : 17;
    final TextStyle nameStyle =
        (nameIsFallback
                ? GvPrimerRowType.fallback(
                    nameSize,
                    height: _leader ? 1.1 : 1.2,
                  )
                : GvPrimerTypography.archivo(
                    size: nameSize,
                    weight: _leader ? 800 : 750,
                    width: _leader ? 84 : 86,
                    height: _leader ? 1.1 : 1.2,
                  ).copyWith(letterSpacing: _leader ? null : -0.005 * 17))
            .copyWith(color: roles.text.primary);
    final TextStyle detailsStyle = GvPrimerTypography.archivo(
      size: 14,
      weight: 400,
      height: 1.3,
    ).copyWith(color: roles.text.secondary);
    final Widget column = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (_leader)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: ExcludeSemantics(
              child: Text(
                leaderLabel!,
                style: GvPrimerRowType.kicker.copyWith(
                  color: roles.text.accent,
                ),
              ),
            ),
          ),
        ExcludeSemantics(
          child: Text(
            name,
            style: nameStyle,
            textScaler: _leader ? TextScaler.noScaling : null,
          ),
        ),
        if (details.isNotEmpty || statuses.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: ExcludeSemantics(
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  if (details.isNotEmpty)
                    LayoutBuilder(
                      builder: (BuildContext context, BoxConstraints box) =>
                          Text(
                            detailsLine(
                              details,
                              style: detailsStyle,
                              scaler: scaler,
                              maxWidth: box.maxWidth,
                              direction: Directionality.of(context),
                            ),
                            style: detailsStyle,
                          ),
                    ),
                  for (final GvPrimerStatusLabel s in statuses)
                    GvPrimerStatusChip(
                      label: s.label,
                      kind: s.kind,
                      size: GvPrimerChipSize.small,
                    ),
                ],
              ),
            ),
          ),
      ],
    );
    if (!_leader) return column;
    // `padding-left: 14px; margin-left: -2px`, with the 3px 12° Red Oxide seam
    // at its left edge (4px above, 2px below the block).
    return CustomPaint(
      // Seams are `brand.surface` in both themes (token map §2).
      painter: GvPrimerLeaderSeamPainter(color: roles.fill.brand.fill),
      child: Padding(padding: const EdgeInsets.only(left: 12), child: column),
    );
  }

  Widget? _points(GvPrimerRoles roles, TextScaler scaler, bool narrow) {
    final String? value = points;
    if (value == null) return null;
    if (!_leader) {
      return ExcludeSemantics(
        child: Text(
          value,
          softWrap: false,
          textScaler: TextScaler.noScaling,
          style: GvPrimerRowType.figure(
            size: GvPrimerTypography.cappedSize(scaler, 24, 30),
            tracking: -0.02,
          ).copyWith(color: roles.text.primary),
        ),
      );
    }
    final TextStyle figureStyle = GvPrimerRowType.figure(
      size: GvPrimerTypography.cappedSize(scaler, 32, 40),
      tracking: -0.04,
      weight: 850,
    ).copyWith(color: roles.text.primary);
    final Widget figure = Text(
      value,
      softWrap: false,
      textScaler: TextScaler.noScaling,
      style: figureStyle,
    );
    final String? unit = pointsUnit;
    final TextStyle unitStyle = GvPrimerRowType.unit.copyWith(
      color: roles.text.secondary,
    );
    final Widget? unitText = unit == null
        ? null
        : Text(unit, softWrap: false, style: unitStyle);
    final Widget body = unitText == null
        ? figure
        : narrow
        // Figure and unit on one baseline (`.st--leader .st__pts` in the
        // narrow container); only when they cannot share the line (a very
        // wide total) does the unit drop under the figure, so the row never
        // overflows.
        ? LayoutBuilder(
            builder: (BuildContext context, BoxConstraints box) {
              final TextDirection direction = Directionality.of(context);
              final double need =
                  _width(value, figureStyle, TextScaler.noScaling, direction) +
                  4 +
                  _width(unit!, unitStyle, scaler, direction);
              if (need <= box.maxWidth) {
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    figure,
                    const SizedBox(width: 4),
                    unitText,
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[figure, unitText],
              );
            },
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              figure,
              Padding(padding: const EdgeInsets.only(top: 2), child: unitText),
            ],
          );
    return ExcludeSemantics(child: body);
  }
}

/// The leader's 3px Red Oxide seam (`brand.surface`), skewed −12° about its top-left corner
/// (`transform: skewX(var(--cut)); transform-origin: top left`), from 4px
/// above to 2px below the box it decorates, starting 2px before it (the
/// name column's `margin-left: -2px`, whose `padding-left: 14px` leaves the
/// text 12px in). Decorative; paints outside its box without clipping.
class GvPrimerLeaderSeamPainter extends CustomPainter {
  const GvPrimerLeaderSeamPainter({required this.color});

  final Color color;

  static const double width = 3;

  @override
  void paint(Canvas canvas, Size size) {
    const double top = -4;
    const double left = -2;
    final double bottom = size.height + 2;
    final double run = GvLiveryCut.runFor(math.max(0, bottom - top));
    canvas.drawPath(
      Path()
        ..moveTo(left, top)
        ..lineTo(left + width, top)
        ..lineTo(left + width - run, bottom)
        ..lineTo(left - run, bottom)
        ..close(),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(GvPrimerLeaderSeamPainter oldDelegate) =>
      oldDelegate.color != color;
}
