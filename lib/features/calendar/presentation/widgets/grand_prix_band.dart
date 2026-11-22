import 'dart:math' as math;

import 'package:flutter/semantics.dart';
import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../shared/presentation/widgets/primer_detail_parts.dart';

/// One labelled fact of the band's fact rail (Dates, Location).
@immutable
class GrandPrixBandFact {
  const GrandPrixBandFact(this.label, this.value);

  final String label;
  final String value;
}

/// The Grand Prix identity band (`gpd.css` `.gp`, GP02–GP09; Step 55C.12):
/// a full-bleed typographic sheet, the round figure | the 12° Red Oxide
/// seam | the season, the event name and the official name, with the status
/// and format chips above and the labelled fact rail (Dates, Location)
/// below. No image (GP10 / XS-15): the band is complete on its own.
///
/// Both themes draw it on Graphite (`surface.band` of the
/// [GvPrimerSurfaceKind.graphiteBand] scope: the Dark tray in Dark, the
/// approved Graphite heading band in Light, LT-1) with the 4.5% white sheen,
/// `line.subtle` hairlines and Dark text roles. The fact rail darkens it
/// with black at 16%.
///
/// **Wide** (the band's content wider than 20em of body text): the round
/// word above an 88px figure (capped at 104), then the seam, then the
/// season, name and official name. **Narrow** (320dp, or large text): a
/// 64px figure (capped at 72) with the seam and the round word and season
/// beside it; the name and official name take the full width below.
///
/// Reading order (prototype): chips, "Round 13", season, name (a header),
/// official name, then each fact as one node. Presentation only: every word
/// and every omission is the caller's.
class GrandPrixBand extends StatelessWidget {
  const GrandPrixBand({
    super.key,
    required this.chips,
    required this.roundWord,
    required this.round,
    required this.roundSpoken,
    required this.season,
    required this.name,
    this.nameUnavailable = false,
    this.officialName,
    this.facts = const <GrandPrixBandFact>[],
    this.topHairline = false,
  });

  final List<GvPrimerStatusLabel> chips;

  /// The word of `roundLabel` without its number ("Round" / "Ronda").
  final String roundWord;

  /// The round figure ("13").
  final String round;

  /// The whole spoken round ("Round 13" / "Ronda 13").
  final String roundSpoken;

  /// The season line ("2026 season" / "Temporada 2026").
  final String season;

  /// The event name, or the caller's localized unavailable copy.
  final String name;

  /// [name] is the localized fallback for a missing name (GPD-03): drawn in
  /// the approved secondary style, still the page's heading.
  final bool nameUnavailable;
  final String? officialName;
  final List<GrandPrixBandFact> facts;

  /// Draws the top hairline: the band follows a notice block instead of
  /// sitting flush under the app bar (`.page-notice + .gp`).
  final bool topHairline;

  /// The narrow layout applies at or below this content width in `em`.
  static const double narrowEm = 20;

  /// Whether a band whose content is [width] wide is narrow under [scaler]
  /// (`@container gp (max-width: 20em)`).
  static bool isNarrow(double width, TextScaler scaler) =>
      width <= GvPrimerLayout.containerEm(scaler, narrowEm);

  /// The fact rail's darkening (`rgba(0, 0, 0, 0.16)`), a contextual value.
  static const Color factRailShade = Color(0x29000000);

  @override
  Widget build(BuildContext context) {
    return GvPrimerSurface(
      kind: GvPrimerSurfaceKind.graphiteBand,
      child: Builder(
        builder: (BuildContext context) {
          final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
          final BorderSide hairline = BorderSide(color: roles.line.subtle);
          return Semantics(
            container: true,
            explicitChildNodes: true,
            child: DecoratedBox(
              key: const ValueKey<String>('gp-band'),
              position: DecorationPosition.foreground,
              decoration: BoxDecoration(
                border: Border(
                  top: topHairline ? hairline : BorderSide.none,
                  bottom: hairline,
                ),
              ),
              // Two layers, as the CSS background list: the band fill, then
              // the sheen over it (a BoxDecoration ignores its colour when it
              // has a gradient).
              child: ColoredBox(
                key: const ValueKey<String>('gp-band-fill'),
                color: roles.surface.band,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PrimerDetailHeading.darkSheen.toGradient(),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          GvPrimerLayout.gutter,
                          16,
                          GvPrimerLayout.gutter,
                          facts.isEmpty ? 18 : 0,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            if (chips.isNotEmpty) ...<Widget>[
                              _ordered(
                                _Order.chips,
                                Wrap(
                                  key: const ValueKey<String>('gp-band-chips'),
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: <Widget>[
                                    for (final GvPrimerStatusLabel c in chips)
                                      GvPrimerStatusChip(
                                        label: c.label,
                                        kind: c.kind,
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                            LayoutBuilder(
                              builder:
                                  (BuildContext context, BoxConstraints c) =>
                                      isNarrow(
                                        c.maxWidth,
                                        MediaQuery.textScalerOf(context),
                                      )
                                      ? _narrow(context, roles, c.maxWidth)
                                      : _wide(context, roles, c.maxWidth),
                            ),
                          ],
                        ),
                      ),
                      if (facts.isNotEmpty) ...<Widget>[
                        // The rail's 16px margin, on the band itself.
                        const SizedBox(height: 16),
                        _ordered(_Order.facts, _factRail(roles)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _wide(BuildContext context, GvPrimerRoles roles, double width) {
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double figureSize = GvPrimerTypography.cappedSize(scaler, 88, 104);
    // The grid's `auto` column: the wider of the round word and the figure,
    // whose `margin-left: -3px` takes 3px off its contribution.
    final double column = math.max(
      _measure(roundWord, _roundWordStyle(roles), scaler),
      _measure(round, _figureStyle(roles, figureSize), TextScaler.noScaling) -
          3,
    );
    final double nameWidth = math.max(
      0,
      width - column - 16 - _Seam.width - 16,
    );
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SizedBox(
            width: column,
            child: _roundBlock(
              roles,
              figureSize: figureSize,
              figureTop: 6,
              stacked: true,
            ),
          ),
          const SizedBox(width: 16),
          const _Seam(),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _season(roles),
                ..._names(
                  context,
                  roles,
                  scaler,
                  nameTop: 6,
                  maxWidth: nameWidth,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The one-line width of [text] in [style] under [scaler].
  static double _measure(String text, TextStyle style, TextScaler scaler) {
    final TextPainter painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    final double width = painter.width;
    painter.dispose();
    return width;
  }

  static TextStyle _figureStyle(GvPrimerRoles roles, double size) =>
      GvPrimerTypography.archivo(
        size: size,
        weight: 850,
        width: 125,
        height: 0.82,
        tabularFigures: true,
      ).copyWith(letterSpacing: -0.05 * size, color: roles.text.primary);

  static TextStyle _roundWordStyle(GvPrimerRoles roles) =>
      GvPrimerTypography.archivo(
        size: 13,
        weight: 700,
        height: 1.2,
      ).copyWith(color: roles.text.secondary);

  Widget _narrow(BuildContext context, GvPrimerRoles roles, double width) {
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _roundBlock(
                roles,
                figureSize: GvPrimerTypography.cappedSize(scaler, 64, 72),
                figureTop: 0,
                stacked: false,
              ),
              const SizedBox(width: 14),
              const _Seam(),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    ExcludeSemantics(child: _roundWord(roles)),
                    const SizedBox(height: 2),
                    _season(roles),
                  ],
                ),
              ),
            ],
          ),
        ),
        ..._names(context, roles, scaler, nameTop: 14, maxWidth: width),
      ],
    );
  }

  /// The round figure, with the round word above it when [stacked] (wide).
  /// Read once as [roundSpoken]; the visible parts are hidden.
  Widget _roundBlock(
    GvPrimerRoles roles, {
    required double figureSize,
    required double figureTop,
    required bool stacked,
  }) {
    final Widget figure = Padding(
      padding: EdgeInsets.only(top: figureTop),
      child: Transform.translate(
        offset: const Offset(-3, 0),
        child: Text(
          round,
          key: const ValueKey<String>('gp-band-round'),
          textScaler: TextScaler.noScaling,
          softWrap: false,
          overflow: TextOverflow.visible,
          style: _figureStyle(roles, figureSize),
        ),
      ),
    );
    return Semantics(
      container: true,
      sortKey: const OrdinalSortKey(_Order.round),
      label: roundSpoken,
      child: ExcludeSemantics(
        child: Align(
          alignment: Alignment.topLeft,
          child: stacked
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[_roundWord(roles), figure],
                )
              : figure,
        ),
      ),
    );
  }

  Widget _roundWord(GvPrimerRoles roles) =>
      Text(roundWord, style: _roundWordStyle(roles));

  Widget _season(GvPrimerRoles roles) => _ordered(
    _Order.season,
    Text(
      season,
      key: const ValueKey<String>('gp-band-season'),
      style: GvPrimerTypography.archivo(
        size: 13,
        weight: 600,
        height: 1.2,
      ).copyWith(color: roles.text.secondary),
    ),
  );

  List<Widget> _names(
    BuildContext context,
    GvPrimerRoles roles,
    TextScaler scaler, {
    required double nameTop,
    required double maxWidth,
  }) {
    final double size = GvPrimerTypography.cappedSize(scaler, 32, 40);
    final TextStyle nameStyle = nameUnavailable
        ? GvPrimerTypography.archivo(
            size: size,
            weight: 650,
            width: 96,
            height: 1,
          ).copyWith(color: roles.text.secondary)
        : GvPrimerTypography.archivo(
            size: size,
            weight: 800,
            width: 78,
            height: 1,
          ).copyWith(letterSpacing: -0.01 * size, color: roles.text.primary);
    final String? official = officialName;
    return <Widget>[
      SizedBox(height: nameTop),
      SizedBox(
        width: balancedWidth(
          name,
          DefaultTextStyle.of(context).style.merge(nameStyle),
          maxWidth,
        ),
        child: Semantics(
          container: true,
          sortKey: const OrdinalSortKey(_Order.name),
          header: true,
          child: Text(
            name,
            key: const ValueKey<String>('gp-band-name'),
            textScaler: TextScaler.noScaling,
            style: nameStyle,
          ),
        ),
      ),
      if (official != null) ...<Widget>[
        const SizedBox(height: 8),
        _ordered(
          _Order.official,
          Text(
            official,
            key: const ValueKey<String>('gp-band-official'),
            style: GvPrimerTypography.archivo(
              size: 14,
              weight: 400,
              height: 1.35,
            ).copyWith(color: roles.text.secondary),
          ),
        ),
      ],
    ];
  }

  /// Wraps [child] in its own semantics node at [order] in the band's
  /// traversal, so the band reads in the prototype's order whatever the
  /// geometry (wide or narrow).
  static Widget _ordered(double order, Widget child) => Semantics(
    container: true,
    explicitChildNodes: true,
    sortKey: OrdinalSortKey(order),
    child: child,
  );

  /// At most this many lines are balanced; longer text keeps greedy wrapping.
  static const int balanceMaxLines = 6;

  /// The width `text-wrap: balance` gives [text] in [style] within
  /// [maxWidth]: the narrowest box that keeps the greedy line count (up to
  /// [balanceMaxLines] lines), never narrower than the longest word, so a
  /// word is never split between characters. The rule of the Circuit sheet
  /// and Team banner names (Steps 55C.10, 55C.11), kept local so Grand Prix
  /// Detail does not depend on those features.
  static double balancedWidth(String text, TextStyle style, double maxWidth) {
    if (!maxWidth.isFinite || maxWidth <= 0) return maxWidth;
    int linesAt(double width) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout(maxWidth: width);
      final int lines = painter.computeLineMetrics().length;
      painter.dispose();
      return lines;
    }

    final int target = linesAt(maxWidth);
    if (target <= 1 || target > balanceMaxLines) return maxWidth;
    double longest = 0;
    for (final String word in text.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      final TextPainter painter = TextPainter(
        text: TextSpan(text: word, style: style),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout();
      longest = math.max(longest, painter.width);
      painter.dispose();
    }
    double low = math.min(maxWidth, math.max(maxWidth / target, longest));
    double high = maxWidth;
    while (high - low > 0.5) {
      final double mid = (low + high) / 2;
      if (linesAt(mid) <= target) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return math.min(maxWidth, high.ceilToDouble() + 1);
  }

  Widget _factRail(GvPrimerRoles roles) => DecoratedBox(
    key: const ValueKey<String>('gp-band-facts'),
    decoration: BoxDecoration(
      color: factRailShade,
      border: Border(top: BorderSide(color: roles.line.subtle)),
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        12,
        GvPrimerLayout.gutter,
        14,
      ),
      child: GvPrimerFactGrid(
        minEm: 10,
        rowGap: 10,
        children: <Widget>[
          for (final GrandPrixBandFact fact in facts)
            GvPrimerFact(
              label: fact.label,
              value: fact.value,
              size: GvPrimerFactSize.compact,
            ),
        ],
      ),
    ),
  );
}

/// The band's reading order (prototype): chips, "Round 13", season, the
/// heading, the official name, the facts.
abstract final class _Order {
  static const double chips = 0;
  static const double round = 1;
  static const double season = 2;
  static const double name = 3;
  static const double official = 4;
  static const double facts = 5;
}

/// The band's 4px Red Oxide seam (`.gp__seam`): the full height of the
/// identity block less 2px above and 4px below, skewed −12° about its
/// centre. Decorative.
class _Seam extends StatelessWidget {
  const _Seam();

  static const double width = 4;

  @override
  Widget build(BuildContext context) {
    final Color color = GvPrimerSurface.of(context).roles.fill.brand.fill;
    return Padding(
      padding: const EdgeInsets.only(top: 2, bottom: 4),
      child: SizedBox(
        key: const ValueKey<String>('gp-band-seam'),
        width: width,
        child: CustomPaint(painter: _SeamPainter(color)),
      ),
    );
  }
}

class _SeamPainter extends CustomPainter {
  const _SeamPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final double shift = math.tan(12 * math.pi / 180) * size.height / 2;
    canvas.drawPath(
      Path()
        ..moveTo(shift, 0)
        ..lineTo(size.width + shift, 0)
        ..lineTo(size.width - shift, size.height)
        ..lineTo(-shift, size.height)
        ..close(),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(_SeamPainter old) => old.color != color;
}
