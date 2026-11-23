import 'package:flutter/widgets.dart';

import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_icons.dart';

/// The two approved sizes of the empty and error block
/// (`shared/components/empty-state.css`, `empty-state-detail.css`). Neither is
/// the shared default; the screen chooses.
enum GvPrimerEmptySize {
  /// List screens (Standings, Explore): 32px icon, 20px title capped 30.
  list,

  /// Detail screens (GP, Driver, Team, Circuit): 28px icon, 18px title
  /// capped 28.
  detail,
}

/// The Primer V2 empty, error and not-found block (Flutter's `GvEmptyState`
/// / `GvErrorState` in Primer form): an icon in `text.secondary`, a title, a
/// secondary message up to 36em wide and an optional action (normally a
/// `GvPrimerButton` for retry), left-aligned with 40 / 24px vertical padding
/// on the gutter.
///
/// Every word, the icon and whether a retry exists come from the caller,
/// which keeps the repository and retry behaviour untouched. The icon is
/// decorative; the title and message are read in order.
class GvPrimerEmptyState extends StatelessWidget {
  const GvPrimerEmptyState({
    super.key,
    this.icon,
    this.glyph,
    required this.title,
    this.message,
    this.action,
    this.size = GvPrimerEmptySize.detail,
    this.padding = defaultPadding,
    this.announceTitle = false,
  }) : assert(
         (icon == null) != (glyph == null),
         'Give exactly one of icon and glyph',
       );

  /// A Material icon (the existing placeholders), or [glyph].
  final IconData? icon;

  /// A Primer glyph, as the prototypes' error blocks use the alert icon.
  final GvPrimerGlyph? glyph;
  final String title;
  final String? message;
  final Widget? action;
  final GvPrimerEmptySize size;

  /// The block's padding: [defaultPadding] (`.empty`), or [inlinePadding]
  /// for a section-scoped state inside a screen (`gpd.css` `.empty--inline`,
  /// Grand Prix Detail sessions and results, Step 55C.12).
  final EdgeInsets padding;

  /// Makes the title a heading and the block's one polite live region, so
  /// arriving at the state is announced (the legacy `GvEmptyState` /
  /// `GvErrorState` contract). Opt-in: Grand Prix Detail keeps it for its
  /// page and section states (Step 55C.12); every other screen is unchanged.
  final bool announceTitle;

  /// `.empty`: 40px above, 24px below, on the gutter.
  static const EdgeInsets defaultPadding = EdgeInsets.fromLTRB(
    GvPrimerLayout.gutter,
    40,
    GvPrimerLayout.gutter,
    24,
  );

  /// `.empty--inline`: 12px above, 4px below, on the gutter.
  static const EdgeInsets inlinePadding = EdgeInsets.fromLTRB(
    GvPrimerLayout.gutter,
    12,
    GvPrimerLayout.gutter,
    4,
  );

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final bool list = size == GvPrimerEmptySize.list;
    final double titleSize = list
        ? GvPrimerTypography.cappedSize(scaler, 20, 30)
        : GvPrimerTypography.cappedSize(scaler, 18, 28);
    final double messageWidth = 36 * scaler.scale(GvPrimerLayout.bodyFontSize);
    final Widget titleText = Text(
      title,
      textScaler: TextScaler.noScaling,
      style: GvPrimerTypography.archivo(
        size: titleSize,
        weight: 750,
        width: 96,
        height: list ? 1.2 : 1.25,
      ).copyWith(color: roles.text.primary),
    );
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          ExcludeSemantics(
            child: glyph != null
                ? GvPrimerIcon(
                    glyph!,
                    size: list ? 32 : 28,
                    color: roles.text.secondary,
                  )
                : Icon(icon, size: list ? 32 : 28, color: roles.text.secondary),
          ),
          SizedBox(height: 8 + (list ? 4 : 2)),
          if (announceTitle)
            Semantics(header: true, liveRegion: true, child: titleText)
          else
            titleText,
          if (message != null) ...<Widget>[
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: messageWidth),
              child: Text(
                message!,
                style: GvPrimerTypography.body.copyWith(
                  color: roles.text.secondary,
                ),
              ),
            ),
          ],
          if (action != null) ...<Widget>[
            // The 8px column gap plus the button's own `margin-top: 8px`.
            const SizedBox(height: 16),
            action!,
          ],
        ],
      ),
    );
  }
}

/// A static loading placeholder block (token map §4.10, LT-16):
/// `linear-gradient(90deg, band, raised, band)` in the theme's values, with
/// [radius] corners. No animation is added.
///
/// The colours come from the theme, never from a Graphite-band scope, so
/// Light placeholders stay light on Grand Prix Detail too (LT-16). Shapes are
/// the screen's; wrap a group of blocks in [GvPrimerLoading].
class GvPrimerSkeleton extends StatelessWidget {
  const GvPrimerSkeleton({
    super.key,
    required this.height,
    this.width,
    this.radius = GvPrimerLayout.radiusSm,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles theme = GvPrimerSurface.of(context).themeRoles;
    return SizedBox(
      width: width,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: theme.skeleton.gradient.toGradient(),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

/// Announces a loading region once with the caller's word ("Loading") and
/// hides the placeholder shapes from semantics.
class GvPrimerLoading extends StatelessWidget {
  const GvPrimerLoading({
    super.key,
    required this.semanticLabel,
    required this.child,
  });

  final String semanticLabel;
  final Widget child;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    liveRegion: true,
    label: semanticLabel,
    child: ExcludeSemantics(child: child),
  );
}
