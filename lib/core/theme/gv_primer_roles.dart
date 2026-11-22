import 'package:flutter/material.dart';

import 'gv_primer_components.dart';
import 'gv_primer_effects.dart';
import 'gv_primer_role_groups.dart';
import 'gv_team_accent.dart';
import 'tokens/gv_primer_palette.dart';

/// Where a subtree sits, for Primer V2 surface scopes (token map §6).
enum GvPrimerScope {
  /// The default page family.
  page,

  /// The one contrasting plane per screen: Home championship band, Standings
  /// leader row. Chalk in Dark, Graphite in Light.
  inverse,

  /// The Light Graphite band (GP heading band, Home hero strip): Dark roles
  /// for the subtree. In Dark it is the page itself.
  graphiteBand,
}

/// The approved Primer V2 visual roles, resolved for one theme.
///
/// Source: the frozen cross-theme specification
/// (`design-exploration/prototypes/primer-v2/CROSS-THEME-CONSOLIDATION.md`,
/// `CROSS-THEME-TOKEN-MAP.md`, DD XT-6) and the frozen role documents
/// (`DARK-THEME-ROLES.md`, `LIGHT-THEME-ROLES.md`). No colour outside
/// [GvPrimerPalette] and the contextual values inside [GvPrimerEffects] is
/// introduced.
///
/// **Foundation only (Step 55A).** Both GridView themes install this
/// extension next to the legacy `GvSemanticColors`, built by the same theme
/// builder, so it is available through the existing infrastructure
/// (`context.gvPrimer`). No widget reads it yet, so nothing rendered changes;
/// screens move onto it one migration step at a time, after which the legacy
/// palette is retired (XS-28). It is the replacement for `GvSemanticColors`,
/// not a second theme system.
///
/// Layers, kept separate as the specification requires:
/// 1. raw values: [GvPrimerPalette] (never read by widgets);
/// 2. semantic roles: [surface], [text], [fill];
/// 3. contextual alpha, boundary and focus roles: [line], [state], [focus],
///    [teamEdge];
/// 4. component roles: [nav], [selector], [statusChip], [notice], [action],
///    [skeleton] (built on demand from layers 2 and 3);
/// 5. decorative effects: [bandLighting] here, the theme-invariant brand
///    gradients in [GvPrimerEffects].
@immutable
class GvPrimerRoles extends ThemeExtension<GvPrimerRoles> {
  const GvPrimerRoles({
    required this.brightness,
    required this.surface,
    required this.text,
    required this.fill,
    required this.line,
    required this.state,
    required this.focus,
    required this.navSelectedLabel,
    required this.selectorUnselectedFocus,
    required this.bandLighting,
    required this.navShadow,
  });

  /// The theme these roles belong to. Used only to resolve [forScope].
  final Brightness brightness;

  final GvPrimerSurfaceRoles surface;
  final GvPrimerTextRoles text;
  final GvPrimerFillRoles fill;
  final GvPrimerLineRoles line;
  final GvPrimerStateRoles state;
  final GvPrimerFocusRoles focus;

  /// Selected bottom-navigation label: Chalk (Dark) / Graphite (Light, LT-9).
  final Color navSelectedLabel;

  /// Unselected selector focus ring: Chalk (Dark, DK-3) / Graphite (Light,
  /// LT-4).
  final Color selectorUnselectedFocus;

  /// Band lighting (`effect`): Dark tray gradient; `null` in Light, which
  /// draws the flat band.
  final GvPrimerGradient? bandLighting;

  /// Bottom-navigation shadow (`effect`): Dark `0 -12px 24px -12px` black 60%
  /// (`nav.css`); Light `0 -10px 24px -14px` Graphite 22%
  /// (`LIGHT-THEME-ROLES.md` §2).
  final List<BoxShadow> navShadow;

  // ---------------------------------------------------------------------------
  // Theme instances.
  // ---------------------------------------------------------------------------

  /// Primer V2 Dark (DK-1 to DK-6, with XT-1 to XT-5).
  static final GvPrimerRoles dark = GvPrimerRoles(
    brightness: Brightness.dark,
    surface: GvPrimerSurfaceRoles(
      page: GvPrimerPalette.graphite900,
      band: GvPrimerPalette.graphite800,
      raised: GvPrimerPalette.graphite700,
      card: null,
      nav: GvPrimerPalette.graphite950.withValues(alpha: 0.96),
      inverse: const GvPrimerGradient(
        angleDegrees: 170,
        colors: <Color>[GvPrimerPalette.chalk100, GvPrimerPalette.chalk200],
        stops: <double>[0, 1],
      ),
    ),
    text: const GvPrimerTextRoles(
      primary: GvPrimerPalette.chalk100,
      secondary: GvPrimerPalette.slate400,
      accent: GvPrimerPalette.ember400,
    ),
    fill: const GvPrimerFillRoles(
      brand: GvPrimerPair(
        fill: GvPrimerPalette.oxide600,
        on: GvPrimerPalette.chalk100,
      ),
      live: GvPrimerPair(
        fill: GvPrimerPalette.ember400,
        on: GvPrimerPalette.graphite900,
      ),
      finalChip: GvPrimerPair(
        fill: GvPrimerPalette.chalk100,
        on: GvPrimerPalette.graphite900,
      ),
      mark: GvPrimerPair(
        fill: GvPrimerPalette.ember400,
        on: GvPrimerPalette.graphite900,
      ),
      disc: GvPrimerPair(
        fill: GvPrimerPalette.chalk100,
        on: GvPrimerPalette.graphite900,
      ),
      button: GvPrimerPair(
        fill: GvPrimerPalette.chalk100,
        on: GvPrimerPalette.graphite900,
      ),
      buttonHover: GvPrimerPalette.chalk200,
      snackbar: GvPrimerPair(
        fill: GvPrimerPalette.chalk100,
        on: GvPrimerPalette.graphite900,
      ),
    ),
    line: GvPrimerLineRoles(
      subtle: GvPrimerPalette.chalk100.withValues(alpha: 0.12),
      strong: GvPrimerPalette.chalk100.withValues(alpha: 0.22),
      status: GvPrimerPalette.chalk100.withValues(alpha: 0.45),
      statusInverse: GvPrimerPalette.graphite900.withValues(alpha: 0.55),
      unknown: GvPrimerPalette.chalk100.withValues(alpha: 0.60),
      inverse: GvPrimerPalette.graphite900.withValues(alpha: 0.14),
    ),
    state: GvPrimerStateRoles(
      hover: GvPrimerPalette.chalk100.withValues(alpha: 0.03),
      pressedRow: GvPrimerPalette.graphite800,
      pressedControl: GvPrimerPalette.graphite700,
    ),
    focus: const GvPrimerFocusRoles(
      onPage: GvPrimerPalette.ember400,
      onBrand: GvPrimerPalette.chalk100,
      onInverse: GvPrimerPalette.oxide600,
      crossingBacking: false,
      backButtonOffset: 3,
    ),
    navSelectedLabel: GvPrimerPalette.chalk100,
    selectorUnselectedFocus: GvPrimerPalette.chalk100,
    bandLighting: GvPrimerEffects.bandLightingDark,
    navShadow: const <BoxShadow>[
      BoxShadow(
        color: Color(0x99000000),
        offset: Offset(0, -12),
        blurRadius: 24,
        spreadRadius: -12,
      ),
    ],
  );

  /// Primer V2 Light, B Motorsport (LT-1 to LT-18, with XT-1 to XT-5).
  static final GvPrimerRoles light = GvPrimerRoles(
    brightness: Brightness.light,
    surface: GvPrimerSurfaceRoles(
      page: GvPrimerPalette.neutralLightPage,
      band: GvPrimerPalette.neutralLightBand,
      raised: GvPrimerPalette.neutralLightRaised,
      card: GvPrimerPalette.neutralLightCard,
      nav: GvPrimerPalette.neutralLightBand.withValues(alpha: 0.96),
      inverse: const GvPrimerGradient(
        angleDegrees: 170,
        colors: <Color>[
          GvPrimerPalette.graphite800,
          GvPrimerPalette.graphite900,
        ],
        stops: <double>[0, 1],
      ),
    ),
    text: const GvPrimerTextRoles(
      primary: GvPrimerPalette.graphite900,
      secondary: GvPrimerPalette.slate600,
      accent: GvPrimerPalette.oxide600,
    ),
    fill: const GvPrimerFillRoles(
      brand: GvPrimerPair(
        fill: GvPrimerPalette.oxide600,
        on: GvPrimerPalette.chalk100,
      ),
      live: GvPrimerPair(
        fill: GvPrimerPalette.ember400,
        on: GvPrimerPalette.graphite900,
      ),
      finalChip: GvPrimerPair(
        fill: GvPrimerPalette.graphite900,
        on: GvPrimerPalette.chalk100,
      ),
      mark: GvPrimerPair(
        fill: GvPrimerPalette.oxide600,
        on: GvPrimerPalette.chalk100,
      ),
      disc: GvPrimerPair(
        fill: GvPrimerPalette.graphite900,
        on: GvPrimerPalette.chalk100,
      ),
      button: GvPrimerPair(
        fill: GvPrimerPalette.graphite900,
        on: GvPrimerPalette.chalk100,
      ),
      buttonHover: GvPrimerPalette.graphite800,
      snackbar: GvPrimerPair(
        fill: GvPrimerPalette.graphite900,
        on: GvPrimerPalette.chalk100,
      ),
    ),
    line: GvPrimerLineRoles(
      subtle: GvPrimerPalette.graphite900.withValues(alpha: 0.14),
      strong: GvPrimerPalette.graphite900.withValues(alpha: 0.26),
      status: GvPrimerPalette.graphite900.withValues(alpha: 0.55),
      statusInverse: GvPrimerPalette.chalk100.withValues(alpha: 0.45),
      unknown: GvPrimerPalette.graphite900.withValues(alpha: 0.70),
      inverse: GvPrimerPalette.chalk100.withValues(alpha: 0.12),
    ),
    state: GvPrimerStateRoles(
      hover: GvPrimerPalette.graphite900.withValues(alpha: 0.03),
      pressedRow: GvPrimerPalette.graphite900.withValues(alpha: 0.06),
      pressedControl: GvPrimerPalette.neutralLightRaised,
    ),
    focus: const GvPrimerFocusRoles(
      onPage: GvPrimerPalette.graphite900,
      onBrand: GvPrimerPalette.chalk100,
      onInverse: GvPrimerPalette.ember400,
      crossingBacking: true,
      backButtonOffset: 1,
    ),
    navSelectedLabel: GvPrimerPalette.graphite900,
    selectorUnselectedFocus: GvPrimerPalette.graphite900,
    bandLighting: null,
    navShadow: <BoxShadow>[
      BoxShadow(
        color: GvPrimerPalette.graphite900.withValues(alpha: 0.22),
        offset: const Offset(0, -10),
        blurRadius: 24,
        spreadRadius: -14,
      ),
    ],
  );

  /// The Dark Chalk plane (`inverse` scope in Dark, token map §6).
  ///
  /// Only the roles the token map names are swapped: text (Graphite primary,
  /// `on-chalk-2` secondary, oxide accent), the status outline
  /// (`line.status-inverse`), separators (`line.inverse`) and the focus ring
  /// (oxide, DK-4). Every other role is inherited from Dark unchanged and has
  /// not been reviewed for the Chalk plane; a widget must not draw it there
  /// until it is.
  static final GvPrimerRoles _darkChalkPlane = dark.copyWith(
    text: const GvPrimerTextRoles(
      primary: GvPrimerPalette.graphite900,
      secondary: GvPrimerPalette.slate600,
      accent: GvPrimerPalette.oxide600,
    ),
    line: GvPrimerLineRoles(
      subtle: dark.line.inverse,
      strong: dark.line.strong,
      status: dark.line.statusInverse,
      statusInverse: dark.line.statusInverse,
      unknown: dark.line.unknown,
      inverse: dark.line.inverse,
    ),
    focus: GvPrimerFocusRoles(
      onPage: dark.focus.onInverse,
      onBrand: dark.focus.onBrand,
      onInverse: dark.focus.onInverse,
      crossingBacking: dark.focus.crossingBacking,
      backButtonOffset: dark.focus.backButtonOffset,
    ),
  );

  /// The roles a subtree in [scope] reads (token map §6). A scope replaces
  /// the roles; the widget and its geometry are unchanged.
  ///
  /// - [GvPrimerScope.inverse]: Dark → the Chalk plane; Light → Dark roles
  ///   (Chalk text, Ember accent and focus, Chalk 45% status).
  /// - [GvPrimerScope.graphiteBand]: Dark roles in both themes.
  ///
  /// LT-16: Light loading placeholders stay light on GP Detail, so a
  /// skeleton must not be placed in the [GvPrimerScope.graphiteBand] scope.
  GvPrimerRoles forScope(GvPrimerScope scope) => switch (scope) {
    GvPrimerScope.page => this,
    GvPrimerScope.inverse =>
      brightness == Brightness.dark ? _darkChalkPlane : dark,
    GvPrimerScope.graphiteBand => dark,
  };

  // ---------------------------------------------------------------------------
  // Contextual boundary.
  // ---------------------------------------------------------------------------

  /// `edge.team`: the team-colour boundary is the surface's primary text
  /// colour (XT-3).
  Color get teamEdge => text.primary;

  /// Alpha of [pressedOverlay]: the 6% of Light's `state.pressed.row`.
  static const double pressedOverlayAlpha = 0.06;

  /// Pressed feedback on a surface that has no pressed fill of its own: the
  /// surface's primary text colour at 6%, painted over it. It is the
  /// mechanism Light's `state.pressed.row` already uses (Graphite 6% on the
  /// page, which this equals), applied to the roles of a scope.
  ///
  /// Used by the Standings leader card on the inverse plane (Step 55B.3.1):
  /// Graphite 6% over Chalk in Dark, Chalk 6% over Graphite in Light. The
  /// inverse scope inherits Dark's `tray` row fill, which must never be
  /// drawn on the Chalk card. A derived role: no new colour, and no existing
  /// role or scope changes.
  Color get pressedOverlay =>
      text.primary.withValues(alpha: pressedOverlayAlpha);

  /// The 1px boundary for a decorative [team] colour drawn on the opaque
  /// [surface], or `null` when none is needed (contrast ≥ 3:1, XT-3). The
  /// supplied team colour is never changed.
  Color? teamEdgeFor(Color team, {required Color surface}) =>
      GvTeamAccent.needsBoundary(team, surface: surface) ? teamEdge : null;

  // ---------------------------------------------------------------------------
  // Component roles (layer 4), built from layers 2 and 3.
  // ---------------------------------------------------------------------------

  GvPrimerNavRoles get nav => GvPrimerNavRoles(
    bar: surface.nav,
    selectedSlab: fill.brand.fill,
    selectedIcon: fill.brand.on,
    selectedLabel: navSelectedLabel,
    unselected: text.secondary,
    focus: focus.onPage,
  );

  GvPrimerSelectorRoles get selector => GvPrimerSelectorRoles(
    container: surface.band,
    selectedSlab: fill.brand.fill,
    selectedLabel: fill.brand.on,
    unselectedLabel: text.secondary,
    selectedFocus: focus.onBrand,
    unselectedFocus: selectorUnselectedFocus,
    unselectedFocusBacking: focus.crossingBacking ? surface.band : null,
  );

  GvPrimerStatusChipRoles get statusChip => GvPrimerStatusChipRoles(
    known: line.statusKnown,
    knownInverse: line.statusKnownInverse,
    unknown: line.statusUnknown,
    alert: line.statusAlert,
    label: text.primary,
    live: fill.live,
    finalChip: fill.finalChip,
    contextFill: surface.raised,
    winner: fill.brand,
  );

  GvPrimerNoticeRoles get notice => GvPrimerNoticeRoles(
    fill: surface.band,
    border: line.strong,
    icon: text.accent,
    text: text.primary,
  );

  GvPrimerActionRoles get action => GvPrimerActionRoles(
    link: text.accent,
    linkUnderline: line.strong,
    button: fill.button,
    buttonHover: fill.buttonHover,
    disc: fill.disc,
    snackbar: fill.snackbar,
    snackbarSeam: fill.brand.fill,
  );

  GvPrimerSkeletonRoles get skeleton => GvPrimerSkeletonRoles(
    gradient: GvPrimerGradient(
      angleDegrees: 90,
      colors: <Color>[surface.band, surface.raised, surface.band],
      stops: const <double>[0, 0.5, 1],
    ),
  );

  // ---------------------------------------------------------------------------
  // ThemeExtension.
  // ---------------------------------------------------------------------------

  @override
  GvPrimerRoles copyWith({
    Brightness? brightness,
    GvPrimerSurfaceRoles? surface,
    GvPrimerTextRoles? text,
    GvPrimerFillRoles? fill,
    GvPrimerLineRoles? line,
    GvPrimerStateRoles? state,
    GvPrimerFocusRoles? focus,
    Color? navSelectedLabel,
    Color? selectorUnselectedFocus,
    GvPrimerGradient? bandLighting,
    List<BoxShadow>? navShadow,
  }) {
    return GvPrimerRoles(
      brightness: brightness ?? this.brightness,
      surface: surface ?? this.surface,
      text: text ?? this.text,
      fill: fill ?? this.fill,
      line: line ?? this.line,
      state: state ?? this.state,
      focus: focus ?? this.focus,
      navSelectedLabel: navSelectedLabel ?? this.navSelectedLabel,
      selectorUnselectedFocus:
          selectorUnselectedFocus ?? this.selectorUnselectedFocus,
      bandLighting: bandLighting ?? this.bandLighting,
      navShadow: navShadow ?? this.navShadow,
    );
  }

  @override
  GvPrimerRoles lerp(GvPrimerRoles? other, double t) {
    if (other == null) return this;
    return GvPrimerRoles(
      brightness: t < 0.5 ? brightness : other.brightness,
      surface: GvPrimerSurfaceRoles.lerp(surface, other.surface, t),
      text: GvPrimerTextRoles.lerp(text, other.text, t),
      fill: GvPrimerFillRoles.lerp(fill, other.fill, t),
      line: GvPrimerLineRoles.lerp(line, other.line, t),
      state: GvPrimerStateRoles.lerp(state, other.state, t),
      focus: GvPrimerFocusRoles.lerp(focus, other.focus, t),
      navSelectedLabel: Color.lerp(
        navSelectedLabel,
        other.navSelectedLabel,
        t,
      )!,
      selectorUnselectedFocus: Color.lerp(
        selectorUnselectedFocus,
        other.selectorUnselectedFocus,
        t,
      )!,
      bandLighting: GvPrimerGradient.lerp(bandLighting, other.bandLighting, t),
      navShadow: BoxShadow.lerpList(navShadow, other.navShadow, t)!,
    );
  }
}

/// Access to the Primer V2 roles from a [BuildContext].
extension GvPrimerRolesX on BuildContext {
  GvPrimerRoles get gvPrimer =>
      Theme.of(this).extension<GvPrimerRoles>() ?? GvPrimerRoles.dark;
}
