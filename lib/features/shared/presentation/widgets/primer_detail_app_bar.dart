import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// The Primer V2 detail app bar shared by Driver, Team and Circuit Detail
/// (`detail-app-bar.css` `.dbar`; extracted from Driver Detail in Step
/// 55C.10 without a rendering change): back action and a one-line title on
/// the page colour, a `line.subtle` hairline below, pinned above the
/// scrolling profile.
///
/// Geometry: 48px back column, 4px gap, title `min(1.125rem, 26px)` weight
/// 800 `wdth` 88, ellipsized on one line (Flutter parity; the unified title
/// rule XS-07 is not applied); 56px plus the hairline; 6px left and 16px
/// right padding.
///
/// Behaviour is the Material `AppBar`'s, unchanged: the back action exists
/// only when the route can pop (or implies dismissal), it calls
/// `Navigator.maybePop`, its name and tooltip are the platform's localized
/// "Back", and the title names the route and is a header. A direct deep link
/// with nothing to pop to keeps the empty back column, so the title never
/// moves.
///
/// Circuit Detail adopted it unchanged in Step 55C.11 and Grand Prix Detail
/// in Step 55C.12. Settings (Step 55C.13A) has its own wrapping-title bar
/// and reuses only [PrimerDetailBackButton].
class PrimerDetailAppBar extends StatelessWidget {
  const PrimerDetailAppBar({super.key, required this.title, this.backKey});

  final String title;

  /// The key of the back action's focus target, so each screen's tests can
  /// find it (`driver-detail-back`, `team-detail-back`).
  final Key? backKey;

  /// The bar's height without the hairline (`min-height: 56px`).
  static const double height = 56;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final ModalRoute<Object?>? route = ModalRoute.of(context);
    final bool canPop =
        (route?.canPop ?? false) || (route?.impliesAppBarDismissal ?? false);
    final double titleSize = GvPrimerTypography.cappedSize(
      MediaQuery.textScalerOf(context),
      18,
      26,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: roles.surface.page,
        border: Border(bottom: BorderSide(color: roles.line.subtle)),
      ),
      child: Padding(
        // 4px below plus the 1px hairline, which paints over the box edge.
        padding: const EdgeInsets.fromLTRB(6, 4, GvPrimerLayout.gutter, 5),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: height - 8),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: GvPrimerLayout.minTarget,
                child: canPop
                    ? PrimerDetailBackButton(targetKey: backKey)
                    : null,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Semantics(
                  namesRoute: true,
                  header: true,
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textScaler: TextScaler.noScaling,
                    style: GvPrimerTypography.archivo(
                      size: titleSize,
                      weight: 800,
                      width: 88,
                      height: 1.25,
                    ).copyWith(color: roles.text.primary),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 48px round back action (`.icon-btn.dbar__back`): the arrow glyph
/// (`#i-back`, the mirror of the shared arrow), hover `surface.band`,
/// pressed `state.pressed.control`.
///
/// Focus: the circular 24px ring approved for Driver Detail (Step 55C.9F)
/// and Team Detail (Step 55C.10), and for Circuit Detail (Step 55C.11), at
/// the per-theme offset (XT-4: 3px Dark, 1px Light). Only these three
/// screens use it; the shared rounded-rectangle
/// back-button geometry ([GvPrimerFocusGeometry.backButton]) is unchanged
/// for every other screen.
///
/// Public since Step 55C.13A, unchanged, so the Settings app bar
/// (`SettingsAppBar`) reuses the same circular Back instead of a copy.
class PrimerDetailBackButton extends StatelessWidget {
  const PrimerDetailBackButton({super.key, this.targetKey});

  final Key? targetKey;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final String label = MaterialLocalizations.of(context).backButtonTooltip;
    const BorderRadius round = BorderRadius.all(Radius.circular(24));
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: GvPrimerFocusTarget(
        key: targetKey,
        onActivate: () => Navigator.maybePop(context),
        semanticLabel: label,
        geometry: GvPrimerFocusGeometry(
          offset: GvPrimerFocusGeometry.backButton(roles).offset,
          radius: GvPrimerLayout.minTarget / 2,
        ),
        hoverColor: roles.surface.band,
        pressedColor: roles.state.pressedControl,
        fillRadius: round,
        child: SizedBox.square(
          dimension: GvPrimerLayout.minTarget,
          child: Center(
            child: Transform.flip(
              flipX: true,
              child: GvPrimerIcon(
                GvPrimerGlyph.arrowRight,
                size: 24,
                color: roles.text.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
