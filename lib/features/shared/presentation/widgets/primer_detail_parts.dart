import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';

/// Values shared by the Primer V2 Driver and Team Detail headings (the
/// driver plate and the team banner; extracted in Step 55C.10).
abstract final class PrimerDetailHeading {
  /// Dark heading sheen (token map §5 "Sheen": white 4.5% on detail
  /// headings, cleared on the Light headings, LT-13):
  /// `linear-gradient(168deg, rgba(255,255,255,.045) 0%, transparent 46%)`.
  /// A contextual decorative value, not a role or token.
  static const GvPrimerGradient darkSheen = GvPrimerGradient(
    angleDegrees: 168,
    colors: <Color>[Color(0x0BFFFFFF), Color(0x00FFFFFF)],
    stops: <double>[0, 0.46],
  );
}

/// The trimmed biography of a Driver or Team Detail (`.about`, Driver and
/// Team only: 16px, line height 1.55, at most 38em wide, on the gutter, no
/// card). The 10px above it and the section title belong to the screen.
class PrimerDetailAbout extends StatelessWidget {
  const PrimerDetailAbout(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final double measure = 38 * MediaQuery.textScalerOf(context).scale(16);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: measure),
          child: Text(
            text,
            style: GvPrimerTypography.archivo(
              size: 16,
              weight: 400,
              height: 1.55,
            ).copyWith(color: roles.text.primary),
          ),
        ),
      ),
    );
  }
}
