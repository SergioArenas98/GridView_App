import 'package:flutter/widgets.dart';

import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_icons.dart';
import 'gv_primer_status_chip.dart';

/// A status word and its chip treatment, as a row receives it (Step 55B.3).
///
/// Rows know no domain enum: feature code maps its own state (event status,
/// finish status, provisional flag) onto a [GvPrimerChipKind] and passes the
/// localized word. Nothing is inferred here.
@immutable
class GvPrimerStatusLabel {
  const GvPrimerStatusLabel(this.label, this.kind);

  final String label;
  final GvPrimerChipKind kind;

  @override
  bool operator ==(Object other) =>
      other is GvPrimerStatusLabel &&
      other.label == label &&
      other.kind == kind;

  @override
  int get hashCode => Object.hash(label, kind);
}

/// Text shared by the editorial rows, all Archivo, coloured by the caller.
abstract final class GvPrimerRowType {
  /// A row's position or round figure: weight 800, `wdth` [width], tabular
  /// lining figures, tight tracking ([tracking] em), line height 1, at the
  /// already-capped [size] (render with [TextScaler.noScaling]).
  static TextStyle figure({
    required double size,
    double width = 112,
    double tracking = -0.03,
    int weight = 800,
  }) => GvPrimerTypography.archivo(
    size: size,
    weight: weight,
    width: width,
    height: 1,
    tabularFigures: true,
  ).copyWith(letterSpacing: tracking * size);

  /// Kicker above a name ("Winner", "Championship leader", "Next"): 13px,
  /// weight 700, line height 1.2, in `text.accent`.
  static final TextStyle kicker = GvPrimerTypography.archivo(
    size: 13,
    weight: 700,
    height: 1.2,
  );

  /// Unit after a figure ("pts"): 13px, weight 700, no tracking.
  static final TextStyle unit = GvPrimerTypography.archivo(
    size: 13,
    weight: 700,
  );

  /// Unresolved-name fallback ("Name unavailable"): italic, weight 600,
  /// `wdth` 100 (`.cl__name--fallback`), at [size].
  static TextStyle fallback(double size, {double? height}) =>
      GvPrimerTypography.archivo(
        size: size,
        weight: 600,
        height: height,
      ).copyWith(fontStyle: FontStyle.italic);
}

/// The status words of a row as compact chips that wrap (`.chips`, gap 6px),
/// left- or right-aligned.
class GvPrimerRowStatuses extends StatelessWidget {
  const GvPrimerRowStatuses({
    super.key,
    required this.statuses,
    required this.size,
    this.alignment = WrapAlignment.start,
  });

  final List<GvPrimerStatusLabel> statuses;
  final GvPrimerChipSize size;
  final WrapAlignment alignment;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 6,
    runSpacing: 6,
    alignment: alignment,
    children: <Widget>[
      for (final GvPrimerStatusLabel s in statuses)
        GvPrimerStatusChip(label: s.label, kind: s.kind, size: size),
    ],
  );
}

/// The decorative row chevron in `text.secondary` (`.icon`, 24px, or the
/// 16px `.st__go` / `.cl__go`). Hidden from semantics: the row is the link.
class GvPrimerRowChevron extends StatelessWidget {
  const GvPrimerRowChevron({super.key, this.size = 24, this.color});

  final double size;

  /// Defaults to the surface's `text.secondary`.
  final Color? color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: GvPrimerIcon(
      GvPrimerGlyph.chevronRight,
      size: size,
      color: color ?? GvPrimerSurface.of(context).roles.text.secondary,
      strokeWidth: size <= 16
          ? GvPrimerIconStroke.small
          : GvPrimerIconStroke.regular,
    ),
  );
}

/// A 1px hairline (`line.subtle`) across the top of a row, from [start] to
/// [end] logical pixels in from the row's edges. Paints only.
class GvPrimerRowDivider extends StatelessWidget {
  const GvPrimerRowDivider({
    super.key,
    required this.start,
    required this.end,
    this.color,
  });

  final double start;
  final double end;

  /// Defaults to the surface's `line.subtle`.
  final Color? color;

  @override
  Widget build(BuildContext context) => Positioned(
    top: 0,
    left: start,
    right: end,
    height: 1,
    child: ColoredBox(
      color: color ?? GvPrimerSurface.of(context).roles.line.subtle,
    ),
  );
}
