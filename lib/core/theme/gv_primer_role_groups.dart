import 'package:flutter/material.dart';

import 'gv_primer_effects.dart';

/// Primer V2 role groups held by `GvPrimerRoles`.
///
/// Each group is one layer (or one family) of the frozen five-layer model in
/// `CROSS-THEME-TOKEN-MAP.md`: semantic roles (§2) and contextual alpha,
/// boundary and focus roles (§3). Every group is immutable and interpolates
/// for theme transitions.

Color _lerp(Color a, Color b, double t) => Color.lerp(a, b, t)!;

/// Surface roles (token map §2, `surface.*`).
@immutable
class GvPrimerSurfaceRoles {
  const GvPrimerSurfaceRoles({
    required this.page,
    required this.band,
    required this.raised,
    required this.card,
    required this.nav,
    required this.inverse,
  });

  /// `surface.page`.
  final Color page;

  /// `surface.band`: bands, notices, selector container, rail.
  final Color band;

  /// `surface.raised`: context chip, skeleton, pressed controls.
  final Color raised;

  /// `surface.card`: the Light Home hero card only. Dark has no card (its Home
  /// hero is a lit panel, a decorative effect), so this is `null` in Dark.
  final Color? card;

  /// `surface.nav`: the bottom navigation bar (a contextual alpha).
  final Color nav;

  /// `surface.inverse`: the one contrasting plane per screen (Home
  /// championship band, Standings leader row), a gradient in both themes.
  final GvPrimerGradient inverse;

  static GvPrimerSurfaceRoles lerp(
    GvPrimerSurfaceRoles a,
    GvPrimerSurfaceRoles b,
    double t,
  ) => GvPrimerSurfaceRoles(
    page: _lerp(a.page, b.page, t),
    band: _lerp(a.band, b.band, t),
    raised: _lerp(a.raised, b.raised, t),
    card: t < 0.5 ? a.card : b.card,
    nav: _lerp(a.nav, b.nav, t),
    inverse: GvPrimerGradient.lerp(a.inverse, b.inverse, t)!,
  );
}

/// Text roles (token map §2, `text.*`).
@immutable
class GvPrimerTextRoles {
  const GvPrimerTextRoles({
    required this.primary,
    required this.secondary,
    required this.accent,
  });

  /// `text.primary`. Also the default focus ring on the Light page family and
  /// the team-colour boundary (`edge.team`).
  final Color primary;

  /// `text.secondary`.
  final Color secondary;

  /// `text.accent`: kickers, "Next", text links, notice icons and the other
  /// accent uses listed in the token map.
  final Color accent;

  static GvPrimerTextRoles lerp(
    GvPrimerTextRoles a,
    GvPrimerTextRoles b,
    double t,
  ) => GvPrimerTextRoles(
    primary: _lerp(a.primary, b.primary, t),
    secondary: _lerp(a.secondary, b.secondary, t),
    accent: _lerp(a.accent, b.accent, t),
  );
}

/// A filled surface and the foreground drawn on it.
@immutable
class GvPrimerPair {
  const GvPrimerPair({required this.fill, required this.on});

  final Color fill;
  final Color on;

  static GvPrimerPair lerp(GvPrimerPair a, GvPrimerPair b, double t) =>
      GvPrimerPair(fill: _lerp(a.fill, b.fill, t), on: _lerp(a.on, b.on, t));
}

/// Filled semantic roles (token map §2): brand, chips, marks, discs, the
/// primary button and the snackbar.
@immutable
class GvPrimerFillRoles {
  const GvPrimerFillRoles({
    required this.brand,
    required this.live,
    required this.finalChip,
    required this.mark,
    required this.disc,
    required this.button,
    required this.buttonHover,
    required this.snackbar,
  });

  /// `brand.surface` / `brand.on`: flat Red Oxide (DK-2) with Chalk.
  final GvPrimerPair brand;

  /// `live.fill` / `live.on` (LT-7 contextual validation pending).
  final GvPrimerPair live;

  /// `final.fill` / `final.on`: the filled inverse Final chip.
  final GvPrimerPair finalChip;

  /// `mark.selected` / `mark.on`: the Settings option mark and its check.
  final GvPrimerPair mark;

  /// `disc.fill` / `disc.on`: arrow discs.
  final GvPrimerPair disc;

  /// `button.primary` / `button.on`: the inverse pill button.
  final GvPrimerPair button;

  /// Primary-button hover. Dark uses it on Driver, Team and Circuit only
  /// (drift XS-09).
  final Color buttonHover;

  /// `snackbar.fill` / `snackbar.on`. The oxide seam is [brand].
  final GvPrimerPair snackbar;

  static GvPrimerFillRoles lerp(
    GvPrimerFillRoles a,
    GvPrimerFillRoles b,
    double t,
  ) => GvPrimerFillRoles(
    brand: GvPrimerPair.lerp(a.brand, b.brand, t),
    live: GvPrimerPair.lerp(a.live, b.live, t),
    finalChip: GvPrimerPair.lerp(a.finalChip, b.finalChip, t),
    mark: GvPrimerPair.lerp(a.mark, b.mark, t),
    disc: GvPrimerPair.lerp(a.disc, b.disc, t),
    button: GvPrimerPair.lerp(a.button, b.button, t),
    buttonHover: _lerp(a.buttonHover, b.buttonHover, t),
    snackbar: GvPrimerPair.lerp(a.snackbar, b.snackbar, t),
  );
}

/// A status-chip outline: a contextual colour and its stroke pattern. Width
/// is `GvPrimerMetrics.statusOutlineWidth` for every outline.
@immutable
class GvPrimerOutline {
  const GvPrimerOutline({required this.color, required this.dashed});

  final Color color;

  /// `true` only for the unknown-value boundary (VS-1). Painting the dash is a
  /// shared-widget responsibility; the dash pattern is not yet specified.
  final bool dashed;
}

/// Contextual alpha and boundary lines (token map §3, `line.*`). Each value
/// is a primitive at a fixed opacity, valid on the surface the token map
/// states; none is a colour of its own.
@immutable
class GvPrimerLineRoles {
  const GvPrimerLineRoles({
    required this.subtle,
    required this.strong,
    required this.status,
    required this.statusInverse,
    required this.unknown,
    required this.inverse,
  });

  /// `line.subtle`: decorative separators.
  final Color subtle;

  /// `line.strong`: notice border, seams, link underline, dev frames.
  final Color strong;

  /// `line.status`: known secondary status outline (≥ 3:1).
  final Color status;

  /// `line.status-inverse`: the same outline inside `surface.inverse`.
  final Color statusInverse;

  /// `line.unknown`: dashed unknown value; the same alpha solid is an alert.
  final Color unknown;

  /// `line.inverse`: separators inside `surface.inverse`.
  final Color inverse;

  /// Known secondary status (Upcoming, Completed, DNF, Provisional…): solid.
  GvPrimerOutline get statusKnown =>
      GvPrimerOutline(color: status, dashed: false);

  /// Known status on the inverse plane: solid.
  GvPrimerOutline get statusKnownInverse =>
      GvPrimerOutline(color: statusInverse, dashed: false);

  /// Unknown value (event status, format, session, finish): dashed (VS-1).
  GvPrimerOutline get statusUnknown =>
      GvPrimerOutline(color: unknown, dashed: true);

  /// Alert (Cancelled, Postponed): the unknown alpha, solid.
  GvPrimerOutline get statusAlert =>
      GvPrimerOutline(color: unknown, dashed: false);

  static GvPrimerLineRoles lerp(
    GvPrimerLineRoles a,
    GvPrimerLineRoles b,
    double t,
  ) => GvPrimerLineRoles(
    subtle: _lerp(a.subtle, b.subtle, t),
    strong: _lerp(a.strong, b.strong, t),
    status: _lerp(a.status, b.status, t),
    statusInverse: _lerp(a.statusInverse, b.statusInverse, t),
    unknown: _lerp(a.unknown, b.unknown, t),
    inverse: _lerp(a.inverse, b.inverse, t),
  );
}

/// Transient interaction states (token map §3, XT-5).
@immutable
class GvPrimerStateRoles {
  const GvPrimerStateRoles({
    required this.hover,
    required this.pressedRow,
    required this.pressedControl,
  });

  /// `state.hover`: row hover, on hovering devices only.
  final Color hover;

  /// `state.pressed.row`: pressed rows on the page.
  final Color pressedRow;

  /// `state.pressed.control`: pressed icon buttons, Settings rows and
  /// options, GP team link.
  final Color pressedControl;

  static GvPrimerStateRoles lerp(
    GvPrimerStateRoles a,
    GvPrimerStateRoles b,
    double t,
  ) => GvPrimerStateRoles(
    hover: _lerp(a.hover, b.hover, t),
    pressedRow: _lerp(a.pressedRow, b.pressedRow, t),
    pressedControl: _lerp(a.pressedControl, b.pressedControl, t),
  );
}

/// Keyboard-focus colours by the surface the ring is drawn on (token map
/// §4.11, DK-3) and the theme-specific focus rules.
@immutable
class GvPrimerFocusRoles {
  const GvPrimerFocusRoles({
    required this.onPage,
    required this.onBrand,
    required this.onInverse,
    required this.crossingBacking,
    required this.backButtonOffset,
  });

  /// Ring on the page family (page, band, raised, card, nav), including the
  /// ring drawn outside the Standings leader row.
  final Color onPage;

  /// Ring on flat oxide (selected slab, next-event block, winner cell).
  final Color onBrand;

  /// Ring inside `surface.inverse`.
  final Color onInverse;

  /// Whether a ring that crosses a fill of another colour gets the 5px
  /// backing band of its host surface (Light, LT-4/LT-5/LT-15). Dark solves
  /// the same crossings with a Chalk ring (DK-3), so it is `false` there.
  final bool crossingBacking;

  /// Detail back-button ring offset: 3px Dark, 1px Light (XT-4, LT-11).
  final double backButtonOffset;

  static GvPrimerFocusRoles lerp(
    GvPrimerFocusRoles a,
    GvPrimerFocusRoles b,
    double t,
  ) => GvPrimerFocusRoles(
    onPage: _lerp(a.onPage, b.onPage, t),
    onBrand: _lerp(a.onBrand, b.onBrand, t),
    onInverse: _lerp(a.onInverse, b.onInverse, t),
    crossingBacking: t < 0.5 ? a.crossingBacking : b.crossingBacking,
    backButtonOffset: t < 0.5 ? a.backButtonOffset : b.backButtonOffset,
  );
}
