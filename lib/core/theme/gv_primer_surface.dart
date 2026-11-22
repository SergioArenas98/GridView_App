import 'package:flutter/material.dart';

import 'gv_primer_role_groups.dart';
import 'gv_primer_roles.dart';

/// The kind of surface a Primer V2 subtree is drawn on.
enum GvPrimerSurfaceKind {
  /// The page family (page, band, raised, card, navigation).
  page,

  /// The one contrasting plane per screen: Home championship band, Standings
  /// leader row (Chalk in Dark, Graphite in Light).
  inverse,

  /// The Light Graphite band (GP heading band, Home hero strip): Dark roles.
  graphiteBand,

  /// A flat Red Oxide fill (selected slab, Calendar next-event block, winner
  /// cell): Chalk content and a Chalk focus ring in both themes.
  brand,
}

/// The roles a Primer V2 component reads where it sits: the theme's roles,
/// resolved for the surface scope (token map §6), plus the per-surface
/// foreground and focus colour.
@immutable
class GvPrimerSurfaceData {
  const GvPrimerSurfaceData({
    required this.kind,
    required this.roles,
    required this.themeRoles,
  });

  final GvPrimerSurfaceKind kind;

  /// Already resolved for [kind]; a component reads it as it would on a page.
  final GvPrimerRoles roles;

  /// The unscoped roles of the theme this subtree renders in. Nested surfaces
  /// resolve from these.
  final GvPrimerRoles themeRoles;

  /// Primary content colour on this surface.
  Color get foreground => kind == GvPrimerSurfaceKind.brand
      ? roles.fill.brand.on
      : roles.text.primary;

  /// Keyboard-focus ring colour for a ring drawn on this surface (DK-3).
  Color get focusRing => kind == GvPrimerSurfaceKind.brand
      ? roles.focus.onBrand
      : roles.focus.onPage;

  /// Ring colour for a ring drawn on this surface that crosses a fill of
  /// another colour (the GP winner cell, the Calendar next-event block):
  /// Chalk in Dark, which passes both (DK-3); the page focus colour in Light,
  /// which pairs it with the 5px backing band of the host surface (LT-5,
  /// LT-15; [GvPrimerFocusRoles.crossingBacking]).
  Color get crossingFocusRing =>
      roles.focus.crossingBacking ? roles.focus.onPage : roles.focus.onBrand;

  /// Known-status outline on this surface (`line.status-inverse` is already
  /// swapped in by the inverse scope).
  GvPrimerOutline get statusKnown => roles.line.statusKnown;

  /// Unknown-value outline (dashed) on this surface.
  GvPrimerOutline get statusUnknown => roles.line.statusUnknown;

  /// Alert outline (solid, unknown alpha) on this surface.
  GvPrimerOutline get statusAlert => roles.line.statusAlert;

  @override
  bool operator ==(Object other) =>
      other is GvPrimerSurfaceData &&
      other.kind == kind &&
      identical(other.roles, roles) &&
      identical(other.themeRoles, themeRoles);

  @override
  int get hashCode => Object.hash(kind, roles, themeRoles);
}

/// Declares the surface a subtree is drawn on, so Primer V2 components inside
/// resolve text, outlines and focus colours for it.
///
/// A plain inherited value: it swaps no [ThemeData] and paints nothing. One
/// widget tree serves Dark and Light; the roles come from the active theme's
/// [GvPrimerRoles], or from [roles] where a development preview shows a theme
/// other than the app's.
///
/// Resolution:
/// - [GvPrimerSurfaceKind.page]: the theme's roles;
/// - [GvPrimerSurfaceKind.inverse] and [GvPrimerSurfaceKind.graphiteBand]:
///   [GvPrimerRoles.forScope] of the theme's roles (a scope nested inside
///   another scope is not specified, so it resolves from the theme, not from
///   the outer scope);
/// - [GvPrimerSurfaceKind.brand]: the enclosing surface's roles, with the
///   brand foreground and focus colour.
class GvPrimerSurface extends StatelessWidget {
  const GvPrimerSurface({
    super.key,
    required this.kind,
    this.roles,
    required this.child,
  });

  final GvPrimerSurfaceKind kind;

  /// Explicit theme roles for this subtree (development previews only).
  final GvPrimerRoles? roles;

  final Widget child;

  /// The surface data for [context]; a page of the active theme when no
  /// [GvPrimerSurface] is above it.
  static GvPrimerSurfaceData of(BuildContext context) {
    final _GvPrimerSurfaceScope? scope = context
        .dependOnInheritedWidgetOfExactType<_GvPrimerSurfaceScope>();
    if (scope != null) return scope.data;
    final GvPrimerRoles theme = context.gvPrimer;
    return GvPrimerSurfaceData(
      kind: GvPrimerSurfaceKind.page,
      roles: theme,
      themeRoles: theme,
    );
  }

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData parent = GvPrimerSurface.of(context);
    final GvPrimerRoles theme = roles ?? parent.themeRoles;
    final GvPrimerRoles resolved = switch (kind) {
      GvPrimerSurfaceKind.page => theme,
      GvPrimerSurfaceKind.inverse => theme.forScope(GvPrimerScope.inverse),
      GvPrimerSurfaceKind.graphiteBand => theme.forScope(
        GvPrimerScope.graphiteBand,
      ),
      GvPrimerSurfaceKind.brand => roles ?? parent.roles,
    };
    return _GvPrimerSurfaceScope(
      data: GvPrimerSurfaceData(kind: kind, roles: resolved, themeRoles: theme),
      child: child,
    );
  }
}

class _GvPrimerSurfaceScope extends InheritedWidget {
  const _GvPrimerSurfaceScope({required this.data, required super.child});

  final GvPrimerSurfaceData data;

  @override
  bool updateShouldNotify(_GvPrimerSurfaceScope oldWidget) =>
      data != oldWidget.data;
}
