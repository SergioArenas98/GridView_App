import 'package:flutter/widgets.dart';

import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_typography.dart';

/// The Primer V2 section title, the 20px `h2` level
/// (`shared/components/section-title.css`): Archivo 700, `wdth` 106, −0.01em
/// tracking, line height 1.2, capped at 30px under large text, in the
/// primary text colour of the surface it sits on. Announced as a heading.
///
/// Only this level is shared. The 13px kicker with a trailing rule (Settings,
/// information screens, Circuit sheet, Calendar and Standings kickers) is a
/// second visual level for the same heading role that XS-29 has not decided,
/// so it stays with its screens. Placement (gutter, the 32px section gap,
/// a trailing chip as on GP results) is the screen's.
class GvPrimerSectionTitle extends StatelessWidget {
  const GvPrimerSectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final double size = GvPrimerTypography.cappedSize(
      MediaQuery.textScalerOf(context),
      20,
      30,
    );
    return Semantics(
      header: true,
      child: Text(
        text,
        textScaler: TextScaler.noScaling,
        style:
            GvPrimerTypography.archivo(
              size: size,
              weight: 700,
              width: 106,
              height: 1.2,
            ).copyWith(
              letterSpacing: -0.01 * size,
              color: GvPrimerSurface.of(context).foreground,
            ),
      ),
    );
  }
}
