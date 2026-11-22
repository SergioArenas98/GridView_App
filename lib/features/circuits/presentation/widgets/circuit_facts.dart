import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// The circuit length split for the dimension line: [figure] is the
/// locale-formatted number ("7.004" / "7,004"), [unit] what the existing
/// `lengthKilometers` copy puts after it ("km"), [spoken] the whole copy
/// ("7.004 km"), read as one value.
@immutable
class CircuitLength {
  const CircuitLength({
    required this.label,
    required this.figure,
    required this.unit,
    required this.spoken,
  });

  final String label;
  final String figure;
  final String unit;
  final String spoken;
}

/// How a fact's value is set.
enum CircuitFactKind {
  /// A figure (corners, first Grand Prix): expanded, tabular.
  figure,

  /// A word (direction), optionally led by a decorative glyph.
  word,
}

/// One labelled fact of the facts row.
@immutable
class CircuitFact {
  const CircuitFact({
    required this.label,
    required this.value,
    this.kind = CircuitFactKind.figure,
    this.glyph,
  });

  final String label;
  final String value;
  final CircuitFactKind kind;

  /// The decorative direction glyph (known directions only).
  final GvPrimerGlyph? glyph;
}

/// The physical facts of the sheet: the kicker title, the optional length
/// and the remaining facts in reading order.
@immutable
class CircuitFactsData {
  const CircuitFactsData({
    required this.title,
    this.length,
    this.facts = const <CircuitFact>[],
  });

  final String title;
  final CircuitLength? length;
  final List<CircuitFact> facts;
}

/// The sheet's lower half (`.ch__facts`): the ruled kicker (a real `h2`;
/// XS-29 keeps this visual level local), the length as a dimension line
/// and the other facts as one ruled, wrapping row, ending 20px under the
/// last fact (`.spec { padding-bottom: 20px }`).
class CircuitFacts extends StatelessWidget {
  const CircuitFacts({super.key, required this.data, required this.narrow});

  final CircuitFactsData data;

  /// The sheet's narrow container state (smaller figure, 8px arm gap).
  final bool narrow;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final CircuitLength? length = data.length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _Kicker(title: data.title),
          if (length != null) ...<Widget>[
            const SizedBox(height: 14),
            CircuitDimensionLine(length: length, narrow: narrow),
          ],
          if (data.facts.isNotEmpty) ...<Widget>[
            // `.dim + .facts` 16px; `.spec > .facts:first-child` 14px.
            SizedBox(height: length != null ? 16 : 14),
            DecoratedBox(
              key: const ValueKey<String>('circuit-facts-row'),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: roles.line.subtle)),
              ),
              child: Padding(
                padding: const EdgeInsets.only(top: 14),
                child: CircuitFactRow(facts: data.facts),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// `.ch__kicker`: 13px weight 700 secondary, a 1px `line.subtle` rule
/// filling the rest of the line, 12px after the text, centred on it.
class _Kicker extends StatelessWidget {
  const _Kicker({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextStyle style = CircuitFactText.term(roles);
    final Widget text = Semantics(
      header: true,
      child: Text(
        title,
        key: const ValueKey<String>('circuit-facts-kicker'),
        style: style,
      ),
    );
    final Widget rule = SizedBox(
      height: 1,
      child: ColoredBox(color: roles.line.subtle),
    );
    // CSS flex: the text keeps its one-line width and the rule takes what
    // is left; only when the text alone is wider than the line does it wrap
    // (and the rule shrinks to nothing).
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextPainter painter = TextPainter(
          text: TextSpan(
            text: title,
            style: DefaultTextStyle.of(context).style.merge(style),
          ),
          textDirection: TextDirection.ltr,
          textScaler: MediaQuery.textScalerOf(context),
        )..layout();
        final double width = painter.width.ceilToDouble();
        painter.dispose();
        final bool fits = width + 12 <= constraints.maxWidth;
        return Row(
          children: <Widget>[
            if (fits)
              SizedBox(width: width, child: text)
            else
              Expanded(child: text),
            const SizedBox(width: 12),
            if (fits) Expanded(child: rule),
          ],
        );
      },
    );
  }
}

/// The shared text styles of the facts.
abstract final class CircuitFactText {
  /// `dt`: 13px (scales) weight 700, line height 1.25, secondary.
  static TextStyle term(GvPrimerRoles roles) => GvPrimerTypography.archivo(
    size: 13,
    weight: 700,
    height: 1.25,
  ).copyWith(color: roles.text.secondary);

  /// `.fact__fig`: `min(1.75rem, 32px)`, 820, `wdth` 112, −0.02em,
  /// line height 1, tabular.
  static TextStyle figure(GvPrimerRoles roles, TextScaler scaler) {
    final double size = GvPrimerTypography.cappedSize(scaler, 28, 32);
    return GvPrimerTypography.archivo(
      size: size,
      weight: 820,
      width: 112,
      height: 1,
      tabularFigures: true,
    ).copyWith(letterSpacing: -0.02 * size, color: roles.text.primary);
  }

  /// `.fact__word`: `min(1.125rem, 28px)`, 760, `wdth` 90, line height 1.2.
  static TextStyle word(GvPrimerRoles roles, TextScaler scaler) =>
      GvPrimerTypography.archivo(
        size: GvPrimerTypography.cappedSize(scaler, 18, 28),
        weight: 760,
        width: 90,
        height: 1.2,
      ).copyWith(color: roles.text.primary);
}

/// The length as a dimension line (`.dim`): the term, then, 6px below, the
/// value between two arms. Each arm flexes (at least 18px) and is 20px
/// tall: a 1px secondary line through its middle and, at its outer end
/// (2px in), a 2px Chalk tick skewed 12° (the architectural dimension
/// tick). Notation, not a scale: the arms are always full width. The value
/// never wraps: the figure (`min(2.5rem, 44px)`, narrow `min(2.125rem,
/// 36px)`, 830, `wdth` 116, −0.03em, line height 0.95, tabular) and, 6px
/// after it on its baseline, the unit (16px, 700, secondary).
///
/// Tick colour ([tickColor]): Chalk in Dark (the frozen reference). In
/// Light the reference's Chalk measured 1.12:1 on the band and was nearly
/// invisible; Step 55C.11R (owner-approved) uses `line.status` (Graphite
/// 55%, an existing Light role): 3.97:1 on the band, still lighter than the
/// 7.30:1 secondary horizontal rule. Geometry unchanged.
class CircuitDimensionLine extends StatelessWidget {
  const CircuitDimensionLine({
    super.key,
    required this.length,
    required this.narrow,
  });

  final CircuitLength length;
  final bool narrow;

  /// The 12° end-tick colour for [roles]: Chalk in Dark, `line.status` in
  /// Light (Step 55C.11R).
  static Color tickColor(GvPrimerRoles roles) =>
      roles.brightness == Brightness.dark
      ? GvPrimerPalette.chalk100
      : roles.line.status;

  /// Arm height (`.dim__arm { height: 20px }`) and minimum width.
  static const double armHeight = 20;
  static const double armMinWidth = 18;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double size = narrow
        ? GvPrimerTypography.cappedSize(scaler, 34, 36)
        : GvPrimerTypography.cappedSize(scaler, 40, 44);
    final double gap = narrow ? 8 : 12;
    final Widget value = Row(
      key: const ValueKey<String>('circuit-length-value'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: <Widget>[
        Text(
          length.figure,
          softWrap: false,
          textScaler: TextScaler.noScaling,
          style: GvPrimerTypography.archivo(
            size: size,
            weight: 830,
            width: 116,
            height: 0.95,
            tabularFigures: true,
          ).copyWith(letterSpacing: -0.03 * size, color: roles.text.primary),
        ),
        if (length.unit.isNotEmpty) ...<Widget>[
          const SizedBox(width: 6),
          Text(
            length.unit,
            softWrap: false,
            style: GvPrimerTypography.archivo(
              size: 16,
              weight: 700,
              height: 1.45,
            ).copyWith(color: roles.text.secondary),
          ),
        ],
      ],
    );
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(length.label, style: CircuitFactText.term(roles)),
          const SizedBox(height: 6),
          Semantics(
            label: length.spoken,
            child: ExcludeSemantics(
              child: Row(
                children: <Widget>[
                  Expanded(child: _Arm(start: true, roles: roles)),
                  SizedBox(width: gap),
                  value,
                  SizedBox(width: gap),
                  Expanded(child: _Arm(start: false, roles: roles)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Arm extends StatelessWidget {
  const _Arm({required this.start, required this.roles});

  final bool start;
  final GvPrimerRoles roles;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    key: ValueKey<String>(
      start ? 'circuit-dim-arm-start' : 'circuit-dim-arm-end',
    ),
    constraints: const BoxConstraints(
      minWidth: CircuitDimensionLine.armMinWidth,
      minHeight: CircuitDimensionLine.armHeight,
      maxHeight: CircuitDimensionLine.armHeight,
    ),
    child: CustomPaint(
      painter: _ArmPainter(
        start: start,
        line: roles.text.secondary,
        tick: CircuitDimensionLine.tickColor(roles),
      ),
    ),
  );
}

/// One dimension arm: the line through the middle, then the tick, skewed
/// −12° about its centre (CSS `skewX(var(--cut))`, `--cut: -12deg`).
class _ArmPainter extends CustomPainter {
  const _ArmPainter({
    required this.start,
    required this.line,
    required this.tick,
  });

  final bool start;
  final Color line;
  final Color tick;

  @override
  void paint(Canvas canvas, Size size) {
    final double mid = size.height / 2;
    canvas.drawRect(
      Rect.fromLTWH(0, mid, size.width, 1),
      Paint()..color = line,
    );
    final double left = start ? 2 : size.width - 4;
    final double slope = math.tan(12 * math.pi / 180);
    // x' = x − tan12 · (y − mid): the top leans right, as CSS.
    final Path path = Path()
      ..moveTo(left + slope * mid, 0)
      ..lineTo(left + 2 + slope * mid, 0)
      ..lineTo(left + 2 - slope * mid, size.height)
      ..lineTo(left - slope * mid, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = tick);
  }

  @override
  bool shouldRepaint(_ArmPainter old) =>
      old.start != start || old.line != line || old.tick != tick;
}

/// The corners, direction and first Grand Prix row (`.facts`): a flex row
/// that wraps in reading order, 28px between items, 16px between lines;
/// each item grows to share its line's free space (`flex: 1 1 auto`) and is
/// never wider than the line (`min-width: 0`). Terms sit at the top,
/// values on a shared bottom line (`dd { margin-top: auto; padding-top:
/// 6px }`). Each fact is one semantics node read "term, value".
class CircuitFactRow extends StatelessWidget {
  const CircuitFactRow({super.key, required this.facts});

  final List<CircuitFact> facts;

  static const double columnGap = 28;
  static const double rowGap = 16;

  /// The direction glyph (`.fact__dir`: 20px, stroke 2) and its gap.
  static const double glyphSize = 20;
  static const double glyphGap = 6;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final TextStyle ambient = DefaultTextStyle.of(context).style;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final List<double> bases = <double>[
          for (final CircuitFact fact in facts)
            math.min(width, _baseWidth(fact, roles, scaler, ambient)),
        ];
        final List<List<int>> lines = _pack(bases, width);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (int l = 0; l < lines.length; l++) ...<Widget>[
              if (l > 0) const SizedBox(height: rowGap),
              _line(lines[l], bases, width, roles, scaler),
            ],
          ],
        );
      },
    );
  }

  Widget _line(
    List<int> items,
    List<double> bases,
    double width,
    GvPrimerRoles roles,
    TextScaler scaler,
  ) {
    final double used =
        items.fold<double>(0, (double s, int i) => s + bases[i]) +
        columnGap * (items.length - 1);
    final double grow = math.max(0, width - used) / items.length;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int k = 0; k < items.length; k++) ...<Widget>[
            if (k > 0) const SizedBox(width: columnGap),
            SizedBox(
              width: math.min(width, bases[items[k]] + grow),
              child: _Fact(fact: facts[items[k]], roles: roles, scaler: scaler),
            ),
          ],
        ],
      ),
    );
  }

  /// Greedy flex-wrap lines: an item starts a new line when it does not fit
  /// beside the previous ones.
  static List<List<int>> _pack(List<double> bases, double width) {
    final List<List<int>> lines = <List<int>>[];
    List<int> current = <int>[];
    double used = 0;
    for (int i = 0; i < bases.length; i++) {
      final double need = current.isEmpty
          ? bases[i]
          : used + columnGap + bases[i];
      if (current.isNotEmpty && need > width + 0.01) {
        lines.add(current);
        current = <int>[i];
        used = bases[i];
      } else {
        current.add(i);
        used = need;
      }
    }
    if (current.isNotEmpty) lines.add(current);
    return lines;
  }

  /// The item's max-content width: the wider of its term and its value.
  static double _baseWidth(
    CircuitFact fact,
    GvPrimerRoles roles,
    TextScaler scaler,
    TextStyle ambient,
  ) {
    final double term = _measure(
      fact.label,
      ambient.merge(CircuitFactText.term(roles)),
      scaler,
    );
    final double value = switch (fact.kind) {
      CircuitFactKind.figure => _measure(
        fact.value,
        ambient.merge(CircuitFactText.figure(roles, scaler)),
        TextScaler.noScaling,
      ),
      CircuitFactKind.word =>
        (fact.glyph == null ? 0 : glyphSize + glyphGap) +
            _measure(
              fact.value,
              ambient.merge(CircuitFactText.word(roles, scaler)),
              TextScaler.noScaling,
            ),
    };
    // Fractional, as CSS flex: rounding up wraps an item that fits.
    return math.max(term, value);
  }

  static double _measure(String text, TextStyle style, TextScaler scaler) {
    final TextPainter painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
    )..layout();
    final double width = painter.width;
    painter.dispose();
    return width;
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.fact, required this.roles, required this.scaler});

  final CircuitFact fact;
  final GvPrimerRoles roles;
  final TextScaler scaler;

  @override
  Widget build(BuildContext context) {
    final Widget value = switch (fact.kind) {
      CircuitFactKind.figure => Text(
        fact.value,
        textScaler: TextScaler.noScaling,
        style: CircuitFactText.figure(roles, scaler),
      ),
      CircuitFactKind.word => Row(
        children: <Widget>[
          if (fact.glyph case final GvPrimerGlyph glyph) ...<Widget>[
            GvPrimerIcon(
              glyph,
              key: const ValueKey<String>('circuit-direction-glyph'),
              size: CircuitFactRow.glyphSize,
              color: roles.text.accent,
              strokeWidth: 2,
            ),
            const SizedBox(width: CircuitFactRow.glyphGap),
          ],
          Flexible(
            child: Text(
              fact.value,
              textScaler: TextScaler.noScaling,
              style: CircuitFactText.word(roles, scaler),
            ),
          ),
        ],
      ),
    };
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(fact.label, style: CircuitFactText.term(roles)),
          Padding(padding: const EdgeInsets.only(top: 6), child: value),
        ],
      ),
    );
  }
}
