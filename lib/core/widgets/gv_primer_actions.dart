import 'package:flutter/widgets.dart';

import '../theme/gv_primer_components.dart';
import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_focus.dart';
import 'gv_primer_icons.dart';

/// The arrow disc that closes an entity link row (`disc.*`, token map §2):
/// Driver team link (`.disc`), GP circuit link (`.cx__disc`), Circuit
/// related Grand Prix (`.rx__disc`), all 44px; the Calendar next-event disc
/// is 36px. Chalk disc with a Graphite arrow in Dark, Graphite disc with a
/// Chalk arrow in Light.
///
/// Decorative: the row it sits in is the link, carries the name and the
/// focus ring. The prototypes' 3px hover nudge is motion and is not added.
class GvPrimerArrowDisc extends StatelessWidget {
  const GvPrimerArrowDisc({super.key, this.size = defaultSize});

  /// The entity-row disc size.
  static const double defaultSize = 44;

  final double size;

  @override
  Widget build(BuildContext context) {
    final GvPrimerActionRoles roles = GvPrimerSurface.of(context).roles.action;
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: roles.disc.fill,
          shape: BoxShape.circle,
        ),
        child: GvPrimerIcon(
          GvPrimerGlyph.arrowRight,
          size: 24,
          color: roles.disc.on,
        ),
      ),
    );
  }
}

/// The inverse pill button (`.btn`, `button.*`): at least 48px tall, 20px
/// side padding, weight-700 label; Chalk with Graphite text in Dark,
/// Graphite with Chalk text in Light. Used for retry in the empty and error
/// blocks. Focus ring 3px outside, following the pill, in the page focus
/// colour.
///
/// [hover] applies `button.hover`, which the approved Driver, Team and
/// Circuit Detail use and Grand Prix Detail and the list screens do not
/// (drift, XS-09): the screen decides.
///
/// Pressed (Step 55B.4.1): the label colour `button.on` at
/// [GvPrimerRoles.pressedOverlayAlpha] (6%) over the whole pill, the
/// [GvPrimerRoles.pressedOverlay] mechanism approved for the inverse plane,
/// which shares the button's colour pair (Chalk / Graphite in Dark,
/// Graphite / Chalk in Light). XT-5's `state.pressed.control` (`raised`)
/// is not used: on the inverse pill it would put the label on a fill of
/// almost its own colour. Geometry, label, ring and semantics are unchanged;
/// no animation.
///
/// With [hover] on, `button.hover` is itself about one 6% step from rest, so
/// the overlay is blended over the hover colour instead: pressed always
/// reads one step beyond hover, never the same colour ([pressedFill]).
class GvPrimerButton extends StatelessWidget {
  const GvPrimerButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.hover = false,
  });

  final String label;

  /// `null` disables the button.
  final VoidCallback? onPressed;
  final bool hover;

  /// The pressed fill: `button.on` at 6% over the pill, or, when [hover] is
  /// on, that overlay blended over `button.hover` (opaque).
  static Color pressedFill(GvPrimerActionRoles roles, {required bool hover}) {
    final Color overlay = roles.button.on.withValues(
      alpha: GvPrimerRoles.pressedOverlayAlpha,
    );
    return hover ? Color.alphaBlend(overlay, roles.buttonHover) : overlay;
  }

  static const GvPrimerFocusGeometry focusGeometry = GvPrimerFocusGeometry(
    offset: 3,
    radius: 999,
  );

  @override
  Widget build(BuildContext context) {
    final GvPrimerActionRoles roles = GvPrimerSurface.of(context).roles.action;
    const BorderRadius pill = BorderRadius.all(Radius.circular(999));
    // The base fill sits outside the target so the hover fill, drawn by
    // the target behind its content, replaces it.
    return DecoratedBox(
      decoration: BoxDecoration(color: roles.button.fill, borderRadius: pill),
      child: GvPrimerFocusTarget(
        onActivate: onPressed,
        geometry: focusGeometry,
        hoverColor: hover ? roles.buttonHover : null,
        pressedColor: pressedFill(roles, hover: hover),
        fillRadius: pill,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: GvPrimerLayout.minTarget,
            minWidth: GvPrimerLayout.minTarget,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Center(
              widthFactor: 1,
              heightFactor: 1,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: GvPrimerTypography.archivo(
                  size: 15,
                  weight: 700,
                  height: 1.45,
                ).copyWith(color: roles.button.on),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A full-width destination link row with a trailing arrow, between hairlines
/// (Driver `.ch__link`, Team `.dest`: identical rules under two names,
/// XS-09): the championship's own standings link. At least 56px tall,
/// weight-700 label in the primary text colour, `line.subtle` above and
/// below; ring 3px inside (rows), pressed `state.pressed.row`, hover
/// `state.hover`. The space above it is the screen's.
class GvPrimerLinkRow extends StatelessWidget {
  const GvPrimerLinkRow({
    super.key,
    required this.label,
    required this.onActivate,
  });

  final String label;

  /// `null` disables the row.
  final VoidCallback? onActivate;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final BorderSide hairline = BorderSide(color: roles.line.subtle);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(top: hairline, bottom: hairline),
      ),
      child: GvPrimerFocusTarget(
        onActivate: onActivate,
        role: GvPrimerTargetRole.link,
        geometry: GvPrimerFocusGeometry.row,
        pressedColor: roles.state.pressedRow,
        hoverColor: roles.state.hover,
        child: ConstrainedBox(
          // 56 including the hairlines, which paint over the box edges
          // (CSS `box-sizing: border-box`).
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
              vertical: 8,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    label,
                    style: GvPrimerTypography.archivo(
                      size: 15,
                      weight: 700,
                      height: 1.3,
                    ).copyWith(color: roles.text.primary),
                  ),
                ),
                const SizedBox(width: 12),
                ExcludeSemantics(
                  child: GvPrimerIcon(
                    GvPrimerGlyph.arrowRight,
                    size: 24,
                    color: roles.text.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
