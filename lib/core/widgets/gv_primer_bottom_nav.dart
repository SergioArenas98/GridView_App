import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';

import '../theme/gv_primer_components.dart';
import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_fit.dart';
import 'gv_primer_focus.dart';
import 'gv_primer_icons.dart';
import 'gv_primer_livery_cut.dart';

/// A destination in [GvPrimerBottomNav]: a label and either a Material icon or
/// a Primer stroke glyph (Standings uses [GvPrimerGlyph.standings]).
@immutable
class GvPrimerNavItem {
  const GvPrimerNavItem({
    required this.label,
    this.icon,
    this.glyph,
    this.selectedLabelFallback = false,
  }) : assert((icon == null) != (glyph == null));

  final String label;
  final IconData? icon;
  final GvPrimerGlyph? glyph;

  /// Whether this destination's label, while selected in a condensed or
  /// stacked bar, drops to `wdth` 62 and weight 700 (S-3, XS-08: the
  /// Standings and Explore prototypes, `standings.css` / `explore.css`).
  /// Off by default, as on Home and Calendar, whose references keep the
  /// regular selected label. Selection stays marked by the slab, the
  /// selected colour and the semantics flag.
  final bool selectedLabelFallback;
}

/// The Primer V2 bottom navigation (`nav.css`, LT-9): the app shell's
/// navigation since Step 55C.15 (`AppShell`), which replaced the legacy
/// floating-pill bar.
///
/// - Bar: `surface.nav` to the screen edge, a `line.subtle` top hairline and
///   the theme's navigation shadow; content sits above the system bottom
///   inset (`MediaQuery.paddingOf`), which is added to the 68 minimum height,
///   never a constant.
/// - Selected: flat Red Oxide 60×32 slab cut at 12° behind the icon; icon
///   Chalk; label weight 800, Chalk (Dark) or Graphite (Light).
///   Unselected: `text.secondary`, weight 600. A destination may opt in to
///   the selected-label fallback ([GvPrimerNavItem.selectedLabelFallback]).
/// - Semantics: one button per destination with the `selected` flag (as the
///   legacy bar); Tab / D-pad stops; Enter and Space activate.
/// - Focus: the page-family ring (Ember / Graphite) **2px inside** the tab
///   ([GvPrimerFocusGeometry.navTab], Step 55B.2.1), so the whole ring stays
///   on screen with a zero bottom inset and inside the bar's side padding.
/// - Fit: regular → condensed (`wdth` 72) → stacked 2 × 2 with wrapping
///   labels. Flutter has no automatic hyphenation, so a word wider than its
///   tab breaks between letters where CSS would hyphenate.
///
/// Used as `Scaffold.bottomNavigationBar`, the scaffold lays the body out
/// above the bar, so scrolled content and a focused element in the body end
/// above it rather than behind it.
class GvPrimerBottomNav extends StatelessWidget {
  const GvPrimerBottomNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelect,
    @visibleForTesting this.focusGeometry = GvPrimerFocusGeometry.navTab,
  }) : assert(items.length == 4);

  final List<GvPrimerNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  /// The tab focus-ring geometry. Always [GvPrimerFocusGeometry.navTab] in
  /// the app; overridable only so tests and review captures can measure the
  /// superseded outward ring against it.
  final GvPrimerFocusGeometry focusGeometry;

  /// Minimum bar height above the system inset (`--nav-min`).
  static const double minHeight = 68;
  static const double _fontSize = 13;
  static const double _sidePadding = 4;
  static const double _tabSidePadding = 2;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final EdgeInsets insets = MediaQuery.paddingOf(context);
    final TextScaler scaler = MediaQuery.textScalerOf(context);

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double content =
            constraints.maxWidth -
            2 * _sidePadding -
            insets.left -
            insets.right;
        final GvPrimerFit fit = gvPrimerChooseFit(
          labels: <String>[for (final GvPrimerNavItem i in items) i.label],
          fontSize: _fontSize,
          maxLabelWidth: content / items.length - 2 * _tabSidePadding,
          textScaler: scaler,
        );
        final bool stacked = fit == GvPrimerFit.stacked;
        List<Widget> tabs(int from, int to) => <Widget>[
          for (int i = from; i < to; i++)
            Expanded(
              child: _PrimerTab(
                item: items[i],
                selected: i == selectedIndex,
                fit: fit,
                roles: roles,
                focusGeometry: focusGeometry,
                onTap: () => onSelect(i),
              ),
            ),
        ];
        Widget row(List<Widget> children) => IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        );

        // The shadow is painted outside the bar only: like a CSS outer
        // box-shadow, it must not show through the translucent bar.
        return CustomPaint(
          painter: GvPrimerOuterShadowPainter(roles.navShadow),
          child: Container(
            decoration: BoxDecoration(
              color: roles.nav.bar,
              border: Border(top: BorderSide(color: roles.line.subtle)),
            ),
            constraints: BoxConstraints(minHeight: minHeight + insets.bottom),
            padding: EdgeInsets.fromLTRB(
              _sidePadding + insets.left,
              stacked ? 4 : 6,
              _sidePadding + insets.right,
              insets.bottom,
            ),
            child: stacked
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      row(tabs(0, 2)),
                      const SizedBox(height: 2),
                      row(tabs(2, 4)),
                    ],
                  )
                : row(tabs(0, 4)),
          ),
        );
      },
    );
  }
}

/// Paints [shadows] around a rectangle but never inside it, as a CSS outer
/// `box-shadow` does; Flutter's [BoxShadow] decoration would otherwise show
/// through a translucent surface.
class GvPrimerOuterShadowPainter extends CustomPainter {
  const GvPrimerOuterShadowPainter(this.shadows);

  final List<BoxShadow> shadows;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect box = Offset.zero & size;
    canvas.save();
    canvas.clipPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(box.inflate(200)),
        Path()..addRect(box),
      ),
    );
    for (final BoxShadow shadow in shadows) {
      canvas.drawRect(
        box.shift(shadow.offset).inflate(shadow.spreadRadius),
        shadow.toPaint(),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(GvPrimerOuterShadowPainter oldDelegate) =>
      !listEquals(oldDelegate.shadows, shadows);
}

class _PrimerTab extends StatelessWidget {
  const _PrimerTab({
    required this.item,
    required this.selected,
    required this.fit,
    required this.roles,
    required this.focusGeometry,
    required this.onTap,
  });

  final GvPrimerNavItem item;
  final GvPrimerFocusGeometry focusGeometry;
  final bool selected;
  final GvPrimerFit fit;
  final GvPrimerRoles roles;
  final VoidCallback onTap;

  /// The icon well and its slab (`.tab__icon`).
  static const Size iconWell = Size(60, 32);

  Widget _icon(Color color) {
    final GvPrimerGlyph? glyph = item.glyph;
    if (glyph != null) {
      return GvPrimerIcon(glyph, size: 24, color: color);
    }
    return Icon(item.icon, size: 24, color: color);
  }

  @override
  Widget build(BuildContext context) {
    final GvPrimerNavRoles nav = roles.nav;
    final bool stacked = fit == GvPrimerFit.stacked;
    final bool fallback =
        selected && item.selectedLabelFallback && fit != GvPrimerFit.regular;
    return GvPrimerFocusTarget(
      selected: selected,
      onActivate: onTap,
      ringColor: nav.focus,
      geometry: focusGeometry,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerBottomNav._tabSidePadding,
            vertical: 4,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              SizedBox.fromSize(
                size: iconWell,
                child: DecoratedBox(
                  decoration: selected
                      ? ShapeDecoration(
                          color: nav.selectedSlab,
                          shape: const GvLiveryCut(radius: 4),
                        )
                      : const BoxDecoration(),
                  child: Center(
                    child: _icon(selected ? nav.selectedIcon : nav.unselected),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.label,
                textAlign: TextAlign.center,
                maxLines: stacked ? null : 1,
                softWrap: stacked,
                style:
                    GvPrimerTypography.archivo(
                      size: GvPrimerBottomNav._fontSize,
                      weight: fallback ? 700 : (selected ? 800 : 600),
                      width: fallback ? 62 : gvPrimerFitWidth(fit),
                      height: 1.15,
                    ).copyWith(
                      color: selected ? nav.selectedLabel : nav.unselected,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
