import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_livery_cut.dart';

/// Value size of a [GvPrimerFact]: the two approved sizes, chosen by the
/// screen (Step 55B.4.1).
enum GvPrimerFactSize {
  /// 16px values on the page: Driver Detail profile facts (`dd.css`
  /// `.fact dd`). The default.
  regular,

  /// 15px values in a heading's fact rail: Grand Prix dates and location
  /// (`gpd.css` `.fact dd`).
  compact,
}

/// One labelled fact (`<div class="fact"><dt>…</dt><dd>…</dd></div>`): a
/// 13px `text.secondary` label above a weight-650 value that wraps.
///
/// Read as one unit ("Place of birth, Hasselt, Belgium"). An absent value is
/// simply not shown by the caller; [unavailable] renders the caller's
/// existing "Not available" wording in `text.secondary` (§3.3). Nothing is
/// formatted here.
class GvPrimerFact extends StatelessWidget {
  const GvPrimerFact({
    super.key,
    required this.label,
    required this.value,
    this.size = GvPrimerFactSize.regular,
    this.unavailable = false,
  });

  final String label;
  final String value;
  final GvPrimerFactSize size;
  final bool unavailable;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: GvPrimerTypography.archivo(
              size: 13,
              weight: 400,
              height: 1.3,
            ).copyWith(color: roles.text.secondary),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style:
                GvPrimerTypography.archivo(
                  size: size == GvPrimerFactSize.regular ? 16 : 15,
                  weight: unavailable ? 400 : 650,
                  height: 1.3,
                ).copyWith(
                  color: unavailable
                      ? roles.text.secondary
                      : roles.text.primary,
                ),
          ),
        ],
      ),
    );
  }
}

/// A responsive grid of facts (CSS `repeat(auto-fit, minmax(min(100%,
/// 9.5em), 1fr))`, with [minEm] in place of 9.5). As many equal columns as fit at
/// least [minEm] `em` of the 15px body text (so fewer at large text), down to
/// one; a short last row keeps the column width.
class GvPrimerFactGrid extends StatelessWidget {
  const GvPrimerFactGrid({
    super.key,
    required this.children,
    this.minEm = 9.5,
    this.columnGap = 20,
    this.rowGap = 14,
  });

  final List<Widget> children;

  /// Minimum column width in `em`: 9.5 (Driver profile), 10 (GP fact rail).
  final double minEm;
  final double columnGap;

  /// Row gap: 14 (Driver profile), 10 (GP fact rail).
  final double rowGap;

  /// The column count for [width] under [scaler].
  static int columnsFor(
    double width,
    TextScaler scaler, {
    double minEm = 9.5,
    double columnGap = 20,
  }) {
    final double min = math.min(
      width,
      GvPrimerLayout.containerEm(scaler, minEm),
    );
    return math.max(1, ((width + columnGap) / (min + columnGap)).floor());
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) {
      final int columns = columnsFor(
        constraints.maxWidth,
        MediaQuery.textScalerOf(context),
        minEm: minEm,
        columnGap: columnGap,
      );
      final List<Widget> rows = <Widget>[];
      for (int start = 0; start < children.length; start += columns) {
        final int end = math.min(start + columns, children.length);
        rows.add(
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              for (int i = start; i < start + columns; i++) ...<Widget>[
                if (i > start) SizedBox(width: columnGap),
                Expanded(
                  child: i < end ? children[i] : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int i = 0; i < rows.length; i++) ...<Widget>[
            if (i > 0) SizedBox(height: rowGap),
            rows[i],
          ],
        ],
      );
    },
  );
}

/// The emphasis of a [GvPrimerStat] value. Figure caps and line heights
/// come from the strip's [GvPrimerStatStripStyle].
enum GvPrimerStatKind {
  /// The lead figure (championship position): 72px, capped 80, weight 850,
  /// `wdth` 125, line height 0.8, nudged 3px left.
  lead,

  /// A figure (points, wins): 40px, weight 800, `wdth` 112; capped at 44px
  /// with line height 0.86 (Team) or 48px with 0.9 (Driver).
  figure,

  /// A word in place of a lead figure ("Unranked"): 28px, capped 34, weight
  /// 800, `wdth` 82, line height 1.05, wraps.
  word,
}

/// One cell of a [GvPrimerStatStrip]: a 13px weight-700 label above its
/// value, with an optional unit after the value. Read as one unit
/// ("Points, 120").
@immutable
class GvPrimerStat {
  const GvPrimerStat({
    required this.label,
    required this.value,
    this.kind = GvPrimerStatKind.figure,
    this.unit,
  });

  final String label;
  final String value;
  final GvPrimerStatKind kind;

  /// A unit after the value, styled like the row units (13px, 700,
  /// `text.secondary`); `null` for none.
  final String? unit;
}

/// The two approved championship-strip geometries (Step 55B.4.1), measured
/// on the frozen Light Batch 1 pages in Chrome at 390 @100% and 320 @200%.
@immutable
class GvPrimerStatStripStyle {
  const GvPrimerStatStripStyle._({
    required this.seamSpansRow,
    required this.cellGap,
    required this.rowGap,
    required this.narrowEm,
    required this.figureCap,
    required this.figureLineHeight,
    required this.figureGap,
    required this.wordGap,
  });

  /// Team Detail (`td.css` `.tc`): the seam belongs to the cell after it,
  /// from 2px below that cell's top to its foot, inside its 22px left
  /// padding; cells align at their foot; points and wins cap at 44px (line
  /// height 0.86), 8px under their label; narrow at 20em with an 18px gap.
  static const GvPrimerStatStripStyle team = GvPrimerStatStripStyle._(
    seamSpansRow: false,
    cellGap: 22,
    rowGap: 18,
    narrowEm: 20,
    figureCap: 44,
    figureLineHeight: 0.86,
    figureGap: 8,
    wordGap: 8,
  );

  /// Driver Detail (`dd.css` `.ch`): the seam is a 2px column of its own,
  /// the full height of the row, with 18px on each side; points cap at 48px
  /// (line height 0.9), 6px under their label, at the foot of the row; the
  /// "Unranked" word sits 10px under its label; narrow at 19em with a 16px
  /// gap.
  static const GvPrimerStatStripStyle driver = GvPrimerStatStripStyle._(
    seamSpansRow: true,
    cellGap: 18,
    rowGap: 16,
    narrowEm: 19,
    figureCap: 48,
    figureLineHeight: 0.9,
    figureGap: 6,
    wordGap: 10,
  );

  /// The seam is a full-height column of its own (Driver).
  final bool seamSpansRow;

  /// Team: each cell's side padding, the seam inside the left one. Driver:
  /// the gap on each side of the seam column.
  final double cellGap;

  /// Gap between the lead line and the others when narrow.
  final double rowGap;

  /// Narrow at or below this container width in `em` of the body text.
  final double narrowEm;

  /// Maximum size of a [GvPrimerStatKind.figure] value.
  final double figureCap;
  final double figureLineHeight;

  /// Space between a label and a figure value.
  final double figureGap;

  /// Space between a label and a word value.
  final double wordGap;
}

/// The championship stat strip shared by Driver (`dd.css` `.ch`) and Team
/// Detail (`td.css` `.tc`): labelled figures in a row, divided by 2px 12°
/// `line.strong` seams, values sharing a bottom line. The last cell takes
/// the remaining width. [style] selects the approved geometry of each
/// screen ([GvPrimerStatStripStyle.team] by default).
///
/// At or below the style's narrow width the first cell stands alone and the
/// others share the next line; the seam before the second cell is dropped
/// (Team: points and wins; Driver: points alone).
///
/// The space above and below the strip belongs to the screen. In the
/// prototypes it is the browser's default `<dl>` margin, 1em of the body
/// text (15px at 100%, 30px at 200%), which Step 55C reproduces when it
/// composes the screen.
class GvPrimerStatStrip extends StatelessWidget {
  const GvPrimerStatStrip({
    super.key,
    required this.stats,
    this.style = GvPrimerStatStripStyle.team,
    this.fitContent = false,
  });

  final List<GvPrimerStat> stats;
  final GvPrimerStatStripStyle style;

  /// Content-aware lines (Step 55C.10R candidate, off by default; every
  /// existing consumer keeps the layout above unchanged).
  ///
  /// When `true`, the layout the style's narrow rule picks is kept whenever
  /// the actual content fits it, measured with the rendered fonts and text
  /// scale: every cell but the last at its unwrapped width, the last at
  /// least as wide as its longest label word and its whole value, plus the
  /// approved gaps and seams. When it does not fit, the cells after the
  /// first move to the next line; if they still do not fit side by side,
  /// each takes its own line. Font sizes, styles, seams, semantics, the
  /// reading order and the value strings never change, a label never splits
  /// inside a word and a value is never clipped.
  final bool fitContent;

  /// Seam width (`.tc__cell + .tc__cell::before`, `.ch__seam`).
  static const double seamWidth = 2;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) {
      final TextScaler scaler = MediaQuery.textScalerOf(context);
      final bool narrow =
          constraints.maxWidth <=
          GvPrimerLayout.containerEm(scaler, style.narrowEm);
      if (stats.isEmpty) return const SizedBox.shrink();
      if (fitContent) {
        final List<int> lines = lineLengths(
          stats,
          constraints.maxWidth,
          scaler,
          style: style,
          narrow: narrow,
          ambient: DefaultTextStyle.of(context).style,
        );
        if (lines.length == 1) return _row(stats, scaler);
        final List<Widget> children = <Widget>[];
        int start = 0;
        for (final int length in lines) {
          if (children.isNotEmpty) {
            children.add(SizedBox(height: style.rowGap));
          }
          children.add(_row(stats.sublist(start, start + length), scaler));
          start += length;
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        );
      }
      if (!narrow || stats.length == 1) {
        return _row(stats, scaler);
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _row(stats.take(1).toList(), scaler),
          SizedBox(height: style.rowGap),
          _row(stats.skip(1).toList(), scaler),
        ],
      );
    },
  );

  /// The [fitContent] lines for [stats] in [width]: the number of cells on
  /// each line, in order. The first candidate whose every line fits wins:
  /// one line (not when [narrow]), then the first cell alone with the rest
  /// on one line, then one cell per line (kept even if a cell alone is
  /// wider than [width]).
  static List<int> lineLengths(
    List<GvPrimerStat> stats,
    double width,
    TextScaler scaler, {
    required GvPrimerStatStripStyle style,
    required bool narrow,
    TextStyle? ambient,
  }) {
    final int n = stats.length;
    if (n <= 1) return <int>[n];
    final List<List<int>> candidates = <List<int>>[
      if (!narrow) <int>[n],
      <int>[1, n - 1],
      List<int>.filled(n, 1),
    ];
    final TextStyle base = ambient ?? const TextStyle();
    final List<(double, double)> widths = <(double, double)>[
      for (final GvPrimerStat stat in stats)
        _StatText(stat, scaler, style).contentWidths(base),
    ];
    // Between two cells: Team, the right padding of one and the left
    // padding (seam inside) of the next; Driver, a gap, the seam, a gap.
    final double between = style.seamSpansRow
        ? 2 * style.cellGap + seamWidth
        : 2 * style.cellGap;
    bool fits(int start, int length) {
      double total = (length - 1) * between;
      for (int i = start; i < start + length; i++) {
        final (double max, double min) = widths[i];
        total += i == start + length - 1 ? min : max;
      }
      return total <= width;
    }

    for (final List<int> candidate in candidates) {
      int start = 0;
      bool ok = true;
      for (final int length in candidate) {
        if (!fits(start, length)) {
          ok = false;
          break;
        }
        start += length;
      }
      if (ok) return candidate;
    }
    return candidates.last;
  }

  Widget _row(List<GvPrimerStat> cells, TextScaler scaler) {
    final double gap = style.cellGap;
    Widget cell(int i) => _StatCell(cells[i], scaler, style);
    if (style.seamSpansRow) {
      return IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (int i = 0; i < cells.length; i++) ...<Widget>[
              if (i > 0) ...<Widget>[
                SizedBox(width: gap),
                const _StatSeam(top: 0),
                SizedBox(width: gap),
              ],
              if (i == cells.length - 1) Expanded(child: cell(i)) else cell(i),
            ],
          ],
        ),
      );
    }
    Widget padded(int i) {
      final Widget content = Padding(
        padding: EdgeInsets.only(
          left: i == 0 ? 0 : gap,
          right: i == cells.length - 1 ? 0 : gap,
        ),
        child: cell(i),
      );
      if (i == 0) return content;
      // The seam spans only this cell's own height.
      return Stack(
        children: <Widget>[
          content,
          const Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: GvPrimerStatStrip.seamWidth,
            child: _StatSeam(top: 2),
          ),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        for (int i = 0; i < cells.length; i++)
          if (i == cells.length - 1) Expanded(child: padded(i)) else padded(i),
      ],
    );
  }
}

/// A stat cell's text styles (without colour), shared by [_StatCell] and the
/// [GvPrimerStatStrip.fitContent] measurement so both use the same metrics.
class _StatText {
  _StatText(this.stat, this.scaler, this.style);

  final GvPrimerStat stat;
  final TextScaler scaler;
  final GvPrimerStatStripStyle style;

  /// 13px weight 700, line height 1.2, scaled by the ambient scaler.
  static TextStyle get label =>
      GvPrimerTypography.archivo(size: 13, weight: 700, height: 1.2);

  /// The value style at its capped size (render with
  /// [TextScaler.noScaling]) and the space under the label.
  (TextStyle, double) get value {
    final (
      double size,
      int weight,
      double width,
      double height,
      double tracking,
      double gap,
    ) = switch (stat.kind) {
      GvPrimerStatKind.lead => (
        GvPrimerTypography.cappedSize(scaler, 72, 80),
        850,
        125.0,
        0.8,
        -0.04,
        8.0,
      ),
      GvPrimerStatKind.figure => (
        GvPrimerTypography.cappedSize(scaler, 40, style.figureCap),
        800,
        112.0,
        style.figureLineHeight,
        -0.03,
        style.figureGap,
      ),
      GvPrimerStatKind.word => (
        GvPrimerTypography.cappedSize(scaler, 28, 34),
        800,
        82.0,
        1.05,
        0.0,
        style.wordGap,
      ),
    };
    return (
      GvPrimerTypography.archivo(
        size: size,
        weight: weight,
        width: width,
        height: height,
        tabularFigures: stat.kind != GvPrimerStatKind.word,
      ).copyWith(letterSpacing: tracking * size),
      gap,
    );
  }

  /// The unit after the value (13px scaled, weight 700).
  TextStyle get unit =>
      GvPrimerTypography.archivo(size: scaler.scale(13), weight: 700);

  /// The cell's unwrapped width and its narrowest unbroken width: the
  /// label whole or its longest word, against the whole value with its
  /// unit (a value never wraps or clips), each merged with [ambient] as
  /// the rendered `Text` is.
  (double, double) contentWidths(TextStyle ambient) {
    double measure(String text, TextStyle s, TextScaler t) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: text, style: ambient.merge(s)),
        textDirection: TextDirection.ltr,
        textScaler: t,
        maxLines: 1,
      )..layout();
      final double w = painter.width;
      painter.dispose();
      return w;
    }

    final (TextStyle valueStyle, double _) = value;
    final TextPainter valuePainter = TextPainter(
      text: TextSpan(
        text: stat.value,
        style: ambient.merge(valueStyle),
        children: <InlineSpan>[
          if (stat.unit != null) TextSpan(text: ' ${stat.unit}', style: unit),
        ],
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
      maxLines: 1,
    )..layout();
    final double valueWidth = valuePainter.width;
    valuePainter.dispose();
    final double labelWidth = measure(stat.label, label, scaler);
    double longestWord = 0;
    for (final String word in stat.label.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      longestWord = math.max(longestWord, measure(word, label, scaler));
    }
    // Rounded up, as the paragraph's own layout is.
    return (
      math.max(labelWidth, valueWidth).ceilToDouble() + 1,
      math.max(longestWord, valueWidth).ceilToDouble() + 1,
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell(this.stat, this.scaler, this.style);

  final GvPrimerStat stat;
  final TextScaler scaler;
  final GvPrimerStatStripStyle style;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final _StatText text = _StatText(stat, scaler, style);
    final (TextStyle valueBase, double gap) = text.value;
    Widget value = Text.rich(
      TextSpan(
        text: stat.value,
        style: valueBase.copyWith(color: roles.text.primary),
        children: <InlineSpan>[
          if (stat.unit != null)
            TextSpan(
              text: ' ${stat.unit}',
              style: text.unit.copyWith(color: roles.text.secondary),
            ),
        ],
      ),
      textScaler: TextScaler.noScaling,
    );
    if (stat.kind == GvPrimerStatKind.lead) {
      value = Transform.translate(offset: const Offset(-3, 0), child: value);
    }
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          Text(
            stat.label,
            style: _StatText.label.copyWith(color: roles.text.secondary),
          ),
          SizedBox(height: gap),
          value,
        ],
      ),
    );
  }
}

/// The 2px `line.strong` seam between stat cells, skewed 12° about its
/// centre, [top] px below the top of its box to the bottom. Decorative.
class _StatSeam extends StatelessWidget {
  const _StatSeam({required this.top});

  final double top;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: top),
    child: SizedBox(
      width: GvPrimerStatStrip.seamWidth,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: GvPrimerSurface.of(context).roles.line.strong,
          shape: const GvLiveryCut(),
        ),
      ),
    ),
  );
}
