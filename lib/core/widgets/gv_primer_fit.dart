import 'package:flutter/widgets.dart';

import '../theme/tokens/gv_primer_typography.dart';

/// The adaptive label fit shared by the Primer V2 selector and navigation:
/// the first mode in which every label fits on one line wins (`nav-inset.js`,
/// `selector.css` `data-fit`).
enum GvPrimerFit {
  /// Archivo at its normal width (`wdth` 100), one line.
  regular,

  /// Archivo condensed (`wdth` 72), one line.
  condensed,

  /// The layout reflows (selector: one column; navigation: 2 × 2) and labels
  /// wrap, still condensed.
  stacked,
}

/// Archivo `wdth` for labels in [fit].
double gvPrimerFitWidth(GvPrimerFit fit) =>
    fit == GvPrimerFit.regular ? 100 : 72;

/// Picks the first fit in which every label, measured at [measureWeight]
/// (the selected weight, so a change of selection never changes the mode),
/// fits on one line in [maxLabelWidth] under [textScaler].
GvPrimerFit gvPrimerChooseFit({
  required List<String> labels,
  required double fontSize,
  required double maxLabelWidth,
  required TextScaler textScaler,
  int measureWeight = 800,
}) {
  bool allFit(double width) {
    final TextStyle style = GvPrimerTypography.archivo(
      size: fontSize,
      weight: measureWeight,
      width: width,
    );
    for (final String label in labels) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: label, style: style),
        textDirection: TextDirection.ltr,
        textScaler: textScaler,
        maxLines: 1,
      )..layout();
      final double needed = painter.width;
      painter.dispose();
      if (needed > maxLabelWidth + 0.5) return false;
    }
    return true;
  }

  if (allFit(100)) return GvPrimerFit.regular;
  if (allFit(72)) return GvPrimerFit.condensed;
  return GvPrimerFit.stacked;
}
