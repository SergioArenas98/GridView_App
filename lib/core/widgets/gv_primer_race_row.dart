import 'package:flutter/material.dart';

import '../theme/gv_primer_effects.dart';
import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_focus.dart';
import 'gv_primer_icons.dart';
import 'gv_primer_livery_cut.dart';
import 'gv_primer_row_parts.dart';
import 'gv_primer_status_chip.dart';

/// A Primer V2 Calendar race row (`calendar.css` C01–C12, Calendar Stage 1,
/// with DK-2, DK-3, LT-15, XT-2 and XT-5).
///
/// The running order: a large round figure in an open number column, the
/// Grand Prix name, the circuit, an optional details line, the status words
/// as compact chips and a chevron. The whole row is one link.
///
/// With [highlighted] the row takes the next-event treatment: the band
/// (Dark band lighting, Light flat band) between hairlines, the flat Red
/// Oxide round block flush with the band's top-left edge with its 12° edge
/// leaning into the column gap (DK-2), the optional accent [highlightLabel]
/// kicker ("Next"), the larger name and the arrow disc. Its focus ring is
/// painted above the block: Chalk in Dark, Graphite with the 5px band
/// backing in Light (LT-15).
///
/// Presentation only. The caller decides which row is highlighted, maps its
/// event status onto [statuses] (completed → [GvPrimerChipKind.completed],
/// solid with a check; an unknown status → [GvPrimerChipKind.unknown],
/// dashed; a known upcoming status → [GvPrimerChipKind.known]) and supplies
/// the spoken [semanticLabel]. A completed row is never dimmed (XT-2). The
/// pinned header, the season and scrolling belong to the screen.
///
/// At or below `19em` (285px at 100% text) the figure moves onto its own line
/// above the name and the block becomes a top-left tab.
class GvPrimerRaceRow extends StatelessWidget {
  const GvPrimerRaceRow({
    super.key,
    required this.round,
    required this.name,
    required this.semanticLabel,
    required this.onOpen,
    this.circuit,
    this.details,
    this.statuses = const <GvPrimerStatusLabel>[],
    this.highlighted = false,
    this.highlightLabel,
    this.dividerAbove = true,
  });

  /// The round number as displayed ("20").
  final String round;
  final String name;

  /// The circuit name; `null` when unresolved and not shown.
  final String? circuit;

  /// An optional line under the circuit, already formatted by the caller
  /// ("Locality, Country · 6–8 Nov", parts dropped with their separator).
  final String? details;

  /// The event's status words as compact chips.
  final List<GvPrimerStatusLabel> statuses;

  /// The next-event treatment.
  final bool highlighted;

  /// The kicker above a highlighted row's name ("Next"); `null` for none.
  final String? highlightLabel;

  final String semanticLabel;

  /// Opens the Grand Prix; `null` disables the row.
  final VoidCallback? onOpen;

  /// Ordinary rows: draws the hairline from the name column to the gutter
  /// (the number column stays open). Never drawn on or under a highlighted
  /// row.
  final bool dividerAbove;

  static const double _columnGap = 16;

  /// The narrow layout applies at or below this container width in `em`.
  static const double narrowEm = 19;

  /// Number column: `min(4rem, 68px)`.
  static double numberColumn(TextScaler scaler) =>
      GvPrimerLayout.cappedRem(scaler, 4, 68);

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData surface = GvPrimerSurface.of(context);
    final GvPrimerRoles roles = surface.roles;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final bool narrow =
            constraints.maxWidth <=
            GvPrimerLayout.containerEm(scaler, narrowEm);
        if (!highlighted) {
          return Stack(
            children: <Widget>[
              GvPrimerFocusTarget(
                onActivate: onOpen,
                role: GvPrimerTargetRole.link,
                semanticLabel: semanticLabel,
                geometry: GvPrimerFocusGeometry.row,
                pressedColor: roles.state.pressedRow,
                hoverColor: roles.state.hover,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 72),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      GvPrimerLayout.gutter,
                      12,
                      GvPrimerLayout.gutter,
                      14,
                    ),
                    child: _ordinary(roles, scaler, narrow),
                  ),
                ),
              ),
              if (dividerAbove)
                GvPrimerRowDivider(
                  start: narrow
                      ? GvPrimerLayout.gutter
                      : GvPrimerLayout.gutter +
                            numberColumn(scaler) +
                            _columnGap,
                  end: GvPrimerLayout.gutter,
                ),
            ],
          );
        }
        final GvPrimerGradient? lighting = roles.bandLighting;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: lighting == null ? roles.surface.band : null,
              gradient: lighting?.toGradient(),
              border: Border.symmetric(
                horizontal: BorderSide(color: roles.line.subtle),
              ),
            ),
            child: ClipRect(
              child: GvPrimerFocusTarget(
                onActivate: onOpen,
                role: GvPrimerTargetRole.link,
                semanticLabel: semanticLabel,
                geometry: GvPrimerFocusGeometry.row,
                ringColor: surface.crossingFocusRing,
                backingSurface: roles.surface.band,
                pressedColor: roles.state.pressedRow,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 72),
                  child: Padding(
                    padding: const EdgeInsets.only(
                      right: GvPrimerLayout.gutter,
                      bottom: 18,
                    ),
                    child: _highlighted(surface, scaler, narrow),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _ordinary(GvPrimerRoles roles, TextScaler scaler, bool narrow) {
    final Widget number = ExcludeSemantics(
      child: Text(
        round,
        textAlign: narrow ? TextAlign.left : TextAlign.right,
        softWrap: false,
        textScaler: TextScaler.noScaling,
        style: GvPrimerRowType.figure(
          size: GvPrimerTypography.cappedSize(scaler, 38, 44),
          tracking: -0.04,
        ).copyWith(color: roles.text.secondary),
      ),
    );
    final Widget body = _body(roles, scaler, highlighted: false);
    const Widget chevron = GvPrimerRowChevron();
    if (narrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(child: number),
              const SizedBox(width: _columnGap),
              chevron,
            ],
          ),
          const SizedBox(height: 6),
          body,
        ],
      );
    }
    return Row(
      children: <Widget>[
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              SizedBox(width: numberColumn(scaler), child: number),
              const SizedBox(width: _columnGap),
              Expanded(child: body),
            ],
          ),
        ),
        const SizedBox(width: _columnGap),
        chevron,
      ],
    );
  }

  Widget _highlighted(
    GvPrimerSurfaceData surface,
    TextScaler scaler,
    bool narrow,
  ) {
    final GvPrimerRoles roles = surface.roles;
    final Brightness brightness = surface.themeRoles.brightness;
    final Widget number = Text(
      round,
      textAlign: narrow ? TextAlign.left : TextAlign.right,
      softWrap: false,
      textScaler: TextScaler.noScaling,
      style: GvPrimerRowType.figure(
        size: GvPrimerTypography.cappedSize(scaler, 44, 50),
        width: 118,
        tracking: -0.04,
      ).copyWith(color: roles.fill.brand.on),
    );
    final Widget block = ExcludeSemantics(
      child: CustomPaint(
        painter: GvPrimerRoundBlockPainter(
          color: roles.fill.brand.fill,
          shadows: GvPrimerEffects.roundBlockShadow(brightness),
        ),
        child: narrow
            ? Padding(
                padding: const EdgeInsets.fromLTRB(
                  GvPrimerLayout.gutter,
                  10,
                  26,
                  10,
                ),
                child: number,
              )
            : SizedBox(
                width: GvPrimerLayout.gutter + numberColumn(scaler),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 12, 10, 12),
                  child: number,
                ),
              ),
      ),
    );
    final Widget body = _body(roles, scaler, highlighted: true);
    final Widget disc = ExcludeSemantics(
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: roles.fill.disc.fill,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: GvPrimerIcon(
          GvPrimerGlyph.arrowRight,
          size: 24,
          color: roles.fill.disc.on,
        ),
      ),
    );
    if (narrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              block,
              const Spacer(),
              Padding(padding: const EdgeInsets.only(top: 16), child: disc),
            ],
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: GvPrimerLayout.gutter),
            child: body,
          ),
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        block,
        const SizedBox(width: _columnGap),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: <Widget>[
                Expanded(child: body),
                const SizedBox(width: _columnGap),
                disc,
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _body(
    GvPrimerRoles roles,
    TextScaler scaler, {
    required bool highlighted,
  }) {
    final TextStyle nameStyle = highlighted
        ? GvPrimerTypography.archivo(
            size: GvPrimerTypography.cappedSize(scaler, 22, 40),
            weight: 800,
            width: 84,
            height: 1.08,
          )
        : GvPrimerTypography.archivo(
            size: 18,
            weight: 750,
            width: 88,
            height: 1.15,
          ).copyWith(letterSpacing: -0.01 * 18);
    final String? kicker = highlighted ? highlightLabel : null;
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (kicker != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                kicker,
                style: GvPrimerRowType.kicker.copyWith(
                  color: roles.text.accent,
                ),
              ),
            ),
          Text(
            name,
            style: nameStyle.copyWith(color: roles.text.primary),
            textScaler: highlighted ? TextScaler.noScaling : null,
          ),
          if (circuit != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                circuit!,
                style: GvPrimerTypography.body.copyWith(
                  color: roles.text.secondary,
                ),
              ),
            ),
          if (details != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                details!,
                style: GvPrimerTypography.archivo(
                  size: 13,
                  weight: 400,
                  height: 1.45,
                ).copyWith(color: roles.text.secondary),
              ),
            ),
          if (statuses.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: GvPrimerRowStatuses(
                statuses: statuses,
                size: GvPrimerChipSize.compact,
              ),
            ),
        ],
      ),
    );
  }
}

/// Paints the next-event round block: flat `brand.surface` (DK-2), flush
/// with its box's top-left corner, its trailing edge leaning 12° into the
/// column gap (the top edge is `height · tan 12°` longer than the bottom:
/// `skewX(-12deg)` about the bottom-left corner), with its decorative shadow
/// (depth only).
class GvPrimerRoundBlockPainter extends CustomPainter {
  const GvPrimerRoundBlockPainter({required this.color, required this.shadows});

  final Color color;
  final List<BoxShadow> shadows;

  static Path blockPath(Rect rect) {
    final double run = GvLiveryCut.runFor(rect.height);
    return Path()
      ..moveTo(rect.left, rect.top)
      ..lineTo(rect.right + run, rect.top)
      ..lineTo(rect.right, rect.bottom)
      ..lineTo(rect.left, rect.bottom)
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final Rect rect = Offset.zero & size;
    for (final BoxShadow shadow in shadows) {
      // A negative spread shrinks the shape before it is offset and blurred.
      final Rect shadowRect = rect
          .inflate(shadow.spreadRadius)
          .shift(shadow.offset);
      if (shadowRect.isEmpty) continue;
      canvas.drawPath(blockPath(shadowRect), shadow.toPaint());
    }
    canvas.drawPath(blockPath(rect), Paint()..color = color);
  }

  @override
  bool shouldRepaint(GvPrimerRoundBlockPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.shadows != shadows;
}
