# GridView Primer V2 theme foundation (Step 55A)

Status: **migration complete (2026-11-22, Step 55C.16R).** Every production
screen, the app shell, the environment strip and the fixture banner render
with Primer V2 in Dark and Light. The current overview and the guidance for
new screens are in
[GridView_Design_System.md](GridView_Design_System.md), the primary entry
point; this document is the **implementation record**: the per-screen
contracts, owner decisions, exceptions and tests, kept in the order the
migration happened (§6a–§6r, §7). Statements in earlier sections that
describe a then-current state ("not activated", "the app shell still uses
the legacy bar", "no widget reads `GvPrimerRoles`") are correct for the step
that wrote them and are superseded by the later sections; §1 and §8 carry
dated notes where that matters. What is still open: the legacy Material layer
(SF-19 remainder, XS-33), NF-04, SETT-18 and all device validation (§6r, §8).

The original Step 55A status read: foundation installed (Step 55A) plus the
first shared components and Archivo (Step 55B.1); not activated; XS-28 stays
open until every screen has migrated and the legacy palette is retired.

Authority, highest first (see `CROSS-THEME-CONSOLIDATION.md` §0):
`design-exploration/prototypes/primer-v2/DESIGN-DECISIONS.md` (XT-1 to XT-6,
LT-1 to LT-18, DK-1 to DK-6), then `CROSS-THEME-CONSOLIDATION.md` and
`CROSS-THEME-TOKEN-MAP.md` (frozen, XT-6), then `DARK-THEME-ROLES.md` and
`LIGHT-THEME-ROLES.md`. Prototypes and pilots are evidence only.

## 1. How it fits the existing theme

> **Current state (2026-11-22).** Every production widget now reads
> `GvPrimerRoles`; the legacy extensions and the `ColorScheme` built from them
> remain only as the Material layer (`MaterialApp`, `Scaffold`, tooltip and
> snackbar defaults, the ambient text style) and for the development
> catalogue, and were not replaced from the Primer roles (SF-19 remainder,
> XS-33; see §6q and §6r). The paragraphs below record the Step 55A design.

There is still one theme system. `buildGridViewDarkTheme()` and
`buildGridViewLightTheme()` (one builder, `gridview_theme.dart`) install a third
`ThemeExtension`, `GvPrimerRoles`, next to the legacy `GvSemanticColors` and
`GvTextStyles`. The `ColorScheme`, `TextTheme` and Material component themes are
still built from the legacy extensions, and no widget reads `GvPrimerRoles`, so
nothing rendered changes. A migration step moves a widget from
`context.gvColors` to `context.gvPrimer`; when the last call site has moved, the
legacy palette and the `ColorScheme` mapping are replaced from the Primer roles.

Theme preference, persistence, `ThemeMode.system` resolution, routing and
startup are untouched: `MaterialApp.router` still selects between the same two
`ThemeData` objects, and the Primer roles travel inside them.

## 2. The five layers in Flutter

| Spec layer | Flutter type | File |
|---|---|---|
| 1. Raw values (15 primitives) | `GvPrimerPalette` (never read by widgets) | `lib/core/theme/tokens/gv_primer_palette.dart` |
| 2. Semantic roles | `GvPrimerRoles.surface` / `.text` / `.fill` (`GvPrimerSurfaceRoles`, `GvPrimerTextRoles`, `GvPrimerFillRoles`, `GvPrimerPair`) | `gv_primer_roles.dart`, `gv_primer_role_groups.dart` |
| 3. Contextual alpha, boundary, focus | `.line` (`GvPrimerLineRoles`, `GvPrimerOutline`), `.state` (`GvPrimerStateRoles`), `.focus` (`GvPrimerFocusRoles`), `.teamEdge` / `.teamEdgeFor()` | same |
| 4. Component roles | `.nav`, `.selector`, `.statusChip`, `.notice`, `.action`, `.skeleton` (built on demand from layers 2–3) | `gv_primer_components.dart` |
| 5. Decorative effects | `GvPrimerEffects` (brand gradients, Dark band lighting), `GvPrimerGradient`, `GvCssAngleGradientTransform`; `.bandLighting`, `.surface.inverse` | `gv_primer_effects.dart` |
| Shared metrics | `GvPrimerMetrics` (1.5px outline, 2px ring, 5px backing, focus offsets) | `lib/core/theme/tokens/gv_primer_metrics.dart` |
| Surface scopes (token map §6) | `GvPrimerScope` + `GvPrimerRoles.forScope()` | `gv_primer_roles.dart` |

Access: `context.gvPrimer` (falls back to Dark, like `context.gvColors`).

Contextual alphas are stored as the primitive at an exact float opacity
(`withValues(alpha: …)`), so a test can prove each one is a primitive at the
specified alpha and never a new colour. `#B04633` and `#1B1D20` exist only as
private constants inside `GvPrimerEffects`.

`GvPrimerGradient` records a gradient as the specification writes it (CSS
angle and stops). `toGradient()` applies `GvCssAngleGradientTransform`, which
reproduces CSS angle semantics (0% and 100% on the box corners) at any aspect
ratio.

## 3. Role mapping

| Token-map role | Dark | Light | Flutter |
|---|---|---|---|
| `surface.page` / `band` / `raised` | graphite-900 / 800 / 700 | `#EBECEE` / `#F7F7F8` / `#DCDDE1` | `surface.page` / `.band` / `.raised` |
| `surface.card` | — | `#FFFFFF` (Home hero only) | `surface.card` (`null` in Dark) |
| `surface.nav` | graphite-950 96% | band 96% | `surface.nav` |
| `surface.inverse` | 170° chalk-100 → chalk-200 | 170° graphite-800 → 900 | `surface.inverse` (`GvPrimerGradient`) |
| `text.primary` / `secondary` / `accent` | chalk-100 / slate-400 / ember | graphite-900 / slate-600 / oxide | `text.*` |
| `brand.*`, `live.*`, `final.*`, `mark.*`, `disc.*`, `button.*`, `snackbar.*` | token map §2 | token map §2 | `fill.brand`, `.live`, `.finalChip`, `.mark`, `.disc`, `.button` (+ `.buttonHover`), `.snackbar` |
| `line.subtle` / `strong` / `status` / `status-inverse` / `unknown` / `inverse` | Chalk 12 / 22 / 45%, Graphite 55%, Chalk 60%, Graphite 14% | Graphite 14 / 26 / 55%, Chalk 45%, Graphite 70%, Chalk 12% | `line.*`; outlines `line.statusKnown`, `.statusKnownInverse`, `.statusUnknown` (dashed), `.statusAlert` |
| `state.hover` / `pressed.row` / `pressed.control` (XT-5) | Chalk 3% / tray / raised | Graphite 3% / Graphite 6% / raised | `state.*` |
| `focus.ring` by surface (§4.11) | Ember on page; Chalk on oxide; oxide in the Chalk plane | Graphite on page; Chalk on oxide; Ember in the Graphite plane | `focus.onPage` / `.onBrand` / `.onInverse` |
| Contextual focus backing (LT-4/5/15) | none (Chalk ring, DK-3) | 5px band of the host surface | `focus.crossingBacking`, `GvPrimerMetrics.focusBackingWidth`, `selector.unselectedFocusBacking` |
| Back-button offset (XT-4) | 3px | 1px | `focus.backButtonOffset` |
| `edge.team` (XT-3) | `text.primary` of the surface | same | `teamEdge`, `teamEdgeFor(team, surface:)` (uses `GvTeamAccent.needsBoundary`, < 3:1) |
| Navigation (LT-9) | Chalk label | Graphite label | `nav.*` |
| Selector | Chalk unselected ring | Graphite ring + backing | `selector.*` |
| Notice, links, discs, button, snackbar, skeleton | §4.8–§4.10 | same | `notice`, `action`, `skeleton` |
| `effect.brand-gradient` (DK-6, LT-10) | identical | identical | `GvPrimerEffects.brandGradientHero` (oxide 45%), `.brandGradientPlate` (oxide 55%) |
| Band lighting | 180° tray → `#1B1D20` | flat band | `bandLighting` (`null` in Light) |

Scopes: `forScope(GvPrimerScope.inverse)` returns the Dark Chalk plane in Dark
(text Graphite / `on-chalk-2` / oxide, `line.status-inverse`, `line.inverse`
separators, oxide focus) and the Dark roles in Light;
`forScope(GvPrimerScope.graphiteBand)` returns the Dark roles. In the Dark Chalk
plane only the roles the token map names are swapped; every other role is
inherited from Dark and has not been reviewed for that plane.

## 4. Deferred to shared widgets (later steps)

The theme supplies colours and stated metrics only. These stay with the shared
widgets, each under its backlog item:

- **Focus ring painting** (XS-31, XS-32): overlay above decoration, inset and
  outset offsets, the backing band, never clipped by an ancestor, focus
  scrolling clear of pinned headers and the navigation bar.
- **Dashed outline** (XS-28, XS-11): a custom painter. The dash pattern is not
  in the frozen specification (the prototypes use the browser's `dashed`
  style), so it needs a decision before the painter is written.
- **12° livery cut** (XS-27): one height-derived clipper; the 60×32 navigation
  slab and the selector slab geometry.
- **Surface scope widget**: applying `forScope()` to a subtree (for example a
  `Theme` override); the role resolution exists, the widget does not.
- **Team-colour shapes** (XS-25, XT-3): tick 3px, seam 2px, banner bar 12px,
  pinstripe 3px, and the 1px outside stroke.
- **Effects without a complete frozen value**: Dark shadows (stated only as
  "black 16–90%"), the Light shadow set, scrims, sheen, watermark, the Dark
  Home hero lit panel composition and the GP facts strip.
- **Dark unselected Settings mark outline**: the token map does not give a
  value ("outline (Dark)"). Step 55C.13A draws it as the approved prototype
  does (`text.secondary`, 2px, both themes); not separately confirmed by the
  owner (DD SF-17).
- **Pressed motion** (the existing 160ms ease-out on Settings rows) and
  reduced-motion handling.

## 5. Legacy tokens to replace

Replaced as screens migrate, not in this step: `GvColors`, `GvColorsLight`,
`GvSemanticColors` and the `ColorScheme` mapping in `_buildTheme`;
`GvElevation.surfaceForStep` (reads `GvColors` directly); `GvTypography` and
`GvFonts` (Sora/Inter pending → Archivo); `GvRadii.md` 12 (Primer 14);
`GvLayout.screenPaddingHorizontal` 20 (Primer gutter 16); the golden harness
background (`GvColors.background`). The legacy `accentSecondary` (blue),
`success`, `warning`, `info`, `stale` and `tertiary` roles have **no Primer V2
counterpart**: Primer carries status by outline pattern and word, not hue, so
each call site needs its Primer mapping decided when it migrates.

## 6. Typography (Step 55B.1)

Archivo Version 2.001 is bundled from google/fonts (`ofl/archivo`, revision
`95f4904`), one variable file, `assets/fonts/archivo/Archivo-Variable.ttf`
(`wght` 100–900, default 600; `wdth` 62–125). Provenance, checksums and the
OFL: `assets/fonts/archivo/README.md`. The licence is registered with
`LicenseRegistry` from `bootstrap()` (`gv_font_licenses.dart`); the app has no
screen that opens a licence page yet.

`GvPrimerTypography.archivo(size, weight, width, height, tabularFigures)`
builds Primer styles; `chipLabel` (13/600/1.2) and `body` (15/400/1.45) are
the only named roles so far. Measured in the Flutter 3.44 test engine:
`FontWeight` drives the `wght` axis with no synthetic bold, and an explicit
`wght` variation overrides `FontWeight`. Styles therefore carry the nearest
standard `FontWeight` and add an explicit `wght` only for 650 / 750 / 820 /
830 / 850. Caveat: for those intermediate weights the platform bold-text
setting cannot raise the weight, because the explicit axis value wins.
Device (Impeller) rendering is not verified by these tests.

The legacy `TextTheme` and `GvFonts` are unchanged; only Primer V2 widgets and
the catalogue use Archivo. The italic file is not bundled.

## 6a. Shared components (Step 55B.1)

| Component | Type | Notes |
|---|---|---|
| Surface context | `GvPrimerSurface` (kind: page, inverse, graphiteBand, brand; optional preview `roles`) + `GvPrimerSurface.of` → `GvPrimerSurfaceData` (`roles`, `themeRoles`, `foreground`, `focusRing`, outlines) | An inherited value; no `ThemeData` is nested. Brand keeps the enclosing roles. Nested scopes resolve from the theme. |
| Status chip | `GvPrimerStatusChip(label, kind, size)` with `GvPrimerChipKind` known, completed, unknown, cancelled, postponed, finalResult, live, context; `GvPrimerChipSize` regular (min 30, 6/12 padding) and small (min 24, 3/8) | New widget; the legacy `GvStatusChip` (tone dot, pill) is unchanged and still used by every screen. One semantics node, the word. Labels wrap. Icons: Material `check_rounded`, `block`, `pause_circle_outline`, 14px, decorative. |
| Outline | `GvPrimerOutlinePainter` | Solid and dashed share geometry (stroke inside the box, radius 8). Dashes: whole cycles fitted to the perimeter. **Dash 2.5 / gap 2.5 is an initial choice for owner review**, measured from the approved Chrome captures. |
| Focus | `GvPrimerFocusRing` (paint only), `GvPrimerFocusRingPainter`, `GvPrimerFocusGeometry` (standard +3, row −3, selector −3, teamLink −2, homeExplore −4, leaderRow +2, backButton per theme), `GvPrimerFocusTarget` (keyboard highlight, Enter/Space/tap activation, button or link semantics) | Ring painted above the child, no size change, no animation. Backing painted only where the theme uses it (Light). Opt-in: legacy focus indicators are untouched. |
| Catalogue | `PrimerCatalogueSection` / `PrimerThemePanel`, appended to the development catalogue | Identical Dark and Light specimens; Live labelled as an unvalidated specimen. |

Review captures (not goldens): `flutter test
tool/primer_review/capture_primer_catalogue_test.dart` writes
`build/primer-review/primer-{dark,light}-{390-100,320-200}.png`.

Still deferred: the 12° clipper (XS-27) and slab geometry, the CSS rule that
rounds every focused element to 6px (a component that needs it clips itself),
team shapes (XS-25), focus scrolling (XS-32), shadows and other effects.

## 6b. Geometry, selector and navigation (Step 55B.2)

| Component | Type | Notes |
|---|---|---|
| 12° cut | `GvLiveryCut` (`ShapeBorder`; edges `both`, `leading`, `trailing`; optional radius) | One primitive for every diagonal (XS-27). `both` = CSS `skewX(-12deg)` about the centre with skewed rounded corners; `leading`/`trailing` = one-edge cuts. Run always `height · tan 12°` (the GP winner cell's fixed 17px is replaced). Used as a fill behind content (`ShapeDecoration`) or, only for coloured shapes, as a clip. Hit areas stay rectangular. |
| Fit | `GvPrimerFit`, `gvPrimerChooseFit` | regular → condensed (`wdth` 72) → stacked, measured at weight 800 so a selection change never changes the mode. |
| Segmented control | `GvPrimerSegmentedControl` | Band container (1px `line.subtle`, radius 12, 3px padding, clips the slab overhang), flat oxide slab (`GvLiveryCut` r6, 4px overhang), Archivo 15 / 600 → 800. Button + `selected` semantics, Tab / Enter / Space. Slabs are drawn in a layer under all options so a focus ring or the Light backing is never covered by a neighbour's slab. Stacked = one column. The legacy `GvSegmentedControl` is unchanged and still used by Standings and Explore. |
| Bottom navigation | `GvPrimerBottomNav` (takes the existing `GvBottomNavItem`) | `surface.nav`, top hairline, theme shadow painted outside the bar only (`GvPrimerOuterShadowPainter`; Flutter's `BoxShadow` would show through the translucent bar). Height 68 + `MediaQuery.paddingOf(context).bottom`; side insets added. Tabs ≥ 56 high, 60×32 slab (`GvLiveryCut` r4). Stacked = 2 × 2. The app shell still uses the legacy bar. |
| Focus target | `GvPrimerFocusTarget` gains `selected` and `ButtonActivateIntent`; `GvPrimerFocusGeometry.selector` follows the 9px option corner | |
| Icon scaling | Superseded by Step 55B.2.1 (option B) | See §6c. |
| Nav shadow role | `GvPrimerRoles.navShadow` | Dark from `nav.css`, Light from `LIGHT-THEME-ROLES.md` §2. |

Known limits and checks that need Android (not established by widget tests):

- **XS-31, navigation ring.** Corrected in Step 55B.2.1 (§6c): the tab ring is
  now 2px inside the tab. Android check: 3-button and gesture navigation,
  ring fully visible on every tab, both themes.
- **XS-32, focus scrolling.** As `Scaffold.bottomNavigationBar` the body ends
  above the bar and Flutter's traversal scrolls a focused item clear of it
  (tested with a 24dp inset). Android check: keyboard, D-pad and switch access
  with real insets and 200% text; a focused element is never under the bar or
  a pinned header.
- **Safe areas.** Height and padding follow `MediaQuery.paddingOf` (tested at 0,
  24 and 48). Android check: edge-to-edge on API 35+, landscape side insets,
  display cutouts.
- **Shadow.** The `flutter_tester` renderer used for the review captures does
  not apply `MaskFilter.blur`, so the navigation shadow is not visible in them;
  the painter's geometry is tested. Android check: shadow appearance.
- **Hyphenation.** Flutter does not hyphenate; a stacked label wider than its
  tab breaks between letters where CSS would hyphenate (not triggered by the
  current EN/ES labels at 320dp, 200%).
- **Light selector backing at the corner.** The 5px backing follows the
  option's 9px corner (as the CSS `box-shadow` does), so a sliver of the
  neighbouring slab tip remains visible outside the ring at the rounded corner.

Review captures: `flutter test tool/primer_review/capture_primer_viewports_test.dart`
→ `build/primer-review/55b2/`.

## 6c. Navigation focus and icon refinements (Step 55B.2.1)

**Navigation focus ring.** `GvPrimerFocusGeometry.navTab` (offset −2,
`GvPrimerMetrics.focusOffsetNavTab`) is used by `GvPrimerBottomNav` only; no
other geometry changed. −2 is the smallest inward offset that keeps the whole
2px ring inside the tab (its outer edge lies on the tab edge), so it cannot
leave the screen or the bar's side padding. Measured on 2x renders
(`ring-visibility.md`), every theme × 390 @100% / 320 @200% × inset 0 / 8 /
24 × all four tabs:

| Ring | Visible share of the ring | Lowest adjacent contrast |
|---|---|---|
| Superseded, 3px outside | 52.6% to 100%; the last tab never above 87% even with a 24dp inset | Dark 1.07, Light 2.34 at some stacked-layout positions (superseded; cause not investigated) |
| **2px inside** | **100% in all 48 cases** | **Dark 7.70 (Ember), Light 17.05 (Graphite)** |

The ring stays at least 2px clear of the selected slab (tested at 390 and
320); tab sizes, semantics and keyboard behaviour are unchanged.

**Navigation height** (measured; content height is the bar above the system
inset):

| Layout | Content | + 24dp inset |
|---|---|---|
| One row (390 @100%) | 68 | 92 |
| 2 × 2 (320 @200%, ES) | 155 (1 hairline + 4 + 74 + 2 + 74) | 179 |

**Status icons (option B, owner-approved).** `GvPrimerStatusChip.iconSizeFor`:
14px at 100%, 18px at 200%, linear in the label's effective scale
(`scaler.scale(13) / 13`, so Android's non-linear scaling is respected) and
clamped to [14, 18]. Label size, weight, spacing, outlines and semantics are
unchanged. The comparison enum is removed.

**Glyphs.** `GvPrimerIcon` / `GvPrimerGlyph` draw two prototype icons from
their SVG coordinates with the prototype's stroke (round caps; 1.75 viewBox
units for 24px, 2.25 for chip icons): **Standings** (three bars, used by the
Primer navigation through `GvPrimerNavItem(glyph:)`; the production shell
keeps its trophy) and **Cancelled** (ban with the top-left → bottom-right
diagonal, used by the status chip). Other Material placeholders unchanged.
`GvPrimerBottomNav` now takes `GvPrimerNavItem` (label + Material icon or
glyph).

Review captures and measurements: `flutter test
tool/primer_review/capture_primer_55b21_test.dart` → `build/primer-review/55b21/`.

## 6d. Editorial rows (Step 55B.3)

Three shared, data-agnostic row families in `lib/core/widgets/`, shown in the
development catalogue only; no production screen uses them. Each takes
display strings, a list of `GvPrimerStatusLabel(word, GvPrimerChipKind)` and
the spoken `semanticLabel` from the caller, which keeps every domain decision
(winner, leader, next event, finish and event status, unranked) outside the
design system.

| Widget | Prototype | States |
|---|---|---|
| `GvPrimerResultRow` | `gpd.css` `.cl` (R01–R14) | Winner (brand-gradient rail cell, height-derived 12° trailing cut, kicker, larger name), classified, position "—", points + unit, time / gap / laps, small finish chips (known solid, unknown dashed), separate 48px team link with trailing chevron (ring −2, LT-17), unresolved-name fallback, missing team / values |
| `GvPrimerStandingsRow` | `standings.css` `.st` (ST01–ST18) | Ordinary row, leader card (`surface.inverse` scope, accent figure and kicker, 3px Red Oxide 12° seam, unit, ring +2 outside in the page colour), unranked "—", tied leaders (`followsLeader`), provisional marker (word only, VS-3), missing points, unbroken detail parts |
| `GvPrimerRaceRow` | `calendar.css` `.ev`, Calendar Stage 1 | Ordinary row, completed (100%, XT-2), unknown / upcoming / cancelled chips (compact), next event (band, flat oxide block leaning 12° into the column gap, kicker, larger name, arrow disc, ring Chalk / Graphite + band backing, LT-15), details line |

Shared pieces: `gv_primer_row_parts.dart` (status labels, chevron, hairline, row type
styles), `GvPrimerLayout` (gutter, radii, `rem` and container-query lengths
under the effective text scale), `GvPrimerTypography.cappedSize` (display
figures `min(<rem>, <px>)`), `GvPrimerEffects.inversePlaneShadow` /
`roundBlockShadow`, the `chevronRight` and `arrowRight` glyphs, and the
compact chip size (26px, `.ev .chip`). Narrow layouts switch at the
prototypes' container widths: GP 21em, Standings 20em, Calendar 19em, in em
of the 15px body text (315 / 300 / 285px at 100%).

**Shared primitives extended.** `GvPrimerFocusTarget` gains a container
`semanticLabel` (nested targets stay their own nodes), pressed and hover
fills (XT-5: whole target, behind the content, no geometry or focus change; a
press that starts on a nested target presses only that target; hover only
from hovering pointers) and draws its ring only on **primary** focus (found
in this step: a focused team link also lit its row's ring).
`GvPrimerSurfaceData.crossingFocusRing` gives the ring that crosses a fill
(Chalk in Dark, page focus + backing in Light). Ring radii now follow each
component: rows 4px, team link 8px, leader card 14px (offsets unchanged).

**Measured in Flutter** (`ring-visibility.md`; 7 focus cases × 2 themes × 2
viewports): every ring 100% visible. Ring against the page or band: Dark
Ember 5.46–7.44, Light Graphite 9.78–15.45. Lower adjacent values have two
causes, both geometric and shared with the prototype: the team-link ring's
outer edge lies on the link edge, next to the name's glyphs above it (Dark
1.16–2.04, Light 1.00); and in Light the 5px backing follows the 4px row
corner, so a few gradient or oxide pixels remain at the outer corners
(winner 2.04–2.18, next event 2.80). Dark rings that cross a fill read 4.63
(winner) and 5.43 (next event).

**Leader card pressed (Step 55B.3.1).** Hover keeps the approved flat plane
(the inverse gradient's first stop). Pressed paints
`GvPrimerRoles.pressedOverlay` of the inverse scope over the whole card:
the plane's own primary text at 6% (Graphite over Chalk in Dark, Chalk over
Graphite in Light), the mechanism Light's `state.pressed.row` already uses
(Graphite 6%, which it equals on the Light page). A derived role: no new
colour, no change to any existing role or scope; the Dark row `tray` is never
drawn on the Chalk card. Measured (`build/primer-review/55b31/leader-states.md`,
card padding sampled at top and bottom): pressed differs from rest by
1.12–1.16 (uniform over the gradient), from hover by more; name text 11.8–13.3
on the pressed card; labels, figure, seam, radius, shadow and target
unchanged; ring 100% visible during a mouse press. Keyboard activation keeps
the ring; a touch press returns Flutter to touch highlight mode, which hides
the keyboard ring (the platform's `:focus-visible` behaviour).

The Dark GP classification row presses to `state.pressed.row` (`tray`) as
the specification states; the prototype's Chalk 6% stays XS-09.

Review evidence: `node tool/primer_review/capture_primer_55b3_refs.mjs`
(Chrome crops of the frozen pages) then `flutter test
tool/primer_review/capture_primer_55b3_test.dart` → `build/primer-review/55b3/`.

## 6e. Remaining shared components (Step 55B.4)

Inventory against the frozen documents and the approved Dark and Light
pages (`consolidation-pilot/`, `light-rollout-b1/`, `light-rollout-b2/`,
`status-visual-consistency/`):

| Family | Widget | Prototype source | Consumers in the approved screens |
|---|---|---|---|
| Section title | `GvPrimerSectionTitle` | `section-title.css` (20px `h2`) | Home, GP, Driver, Team, Circuit |
| Notice | `GvPrimerNotice` + `GvPrimerNoticeCause` | `notice.css`, VS-4, N-2 | Standings, Explore, GP, Driver, Team, Circuit, Settings information |
| Facts | `GvPrimerFact`, `GvPrimerFactGrid` | `dd.css` / `gpd.css` `.fact` | Driver profile, GP fact rail |
| Stat strip | `GvPrimerStatStrip`, `GvPrimerStat` | `td.css` `.tc`, `dd.css` `.ch` | Team and Driver championship |
| Team colour | `GvPrimerTeamMark` + `GvPrimerTeamShape` | XT-3, `seam-dark.css`, `seam-light.css` | Explore and Standings tick, Team seam, banner bar and pinstripe |
| Actions | `GvPrimerArrowDisc`, `GvPrimerButton`, `GvPrimerLinkRow` | `.disc` / `.cx__disc` / `.rx__disc`; `.btn`; `.ch__link` = `.dest` | Driver, GP, Circuit, Calendar; every empty and error block; Driver and Team |
| States | `GvPrimerEmptyState` (list / detail), `GvPrimerSkeleton`, `GvPrimerLoading` | `empty-state.css`, `empty-state-detail.css`, LT-16 | Standings, Explore, GP, Driver, Team, Circuit |

Glyphs added: `alert`, `clock`, `help` (VS-4 paths). Everything reads roles
from `GvPrimerSurface` (notice, disc, button, skeleton component roles
already existed); no colour, token or theme was added.

**Screen variants (Step 55B.4.1).** The approved differences between
screens are explicit parameters, not separate widgets:

| Variant | Team Detail | Driver Detail | Selected by |
|---|---|---|---|
| Championship strip | seam inside the next cell (its height, 2px down, 22px padding), cells foot-aligned; points cap 44px, line height 0.86, 8px under the label; narrow at 20em, 18px gap | seam as its own full-height column, 18px either side; points cap 48px, line height 0.9, 6px under the label; word 10px under; narrow at 19em, 16px gap | `GvPrimerStatStripStyle.team` (default) / `.driver` |
| Fact values | 16px (Driver profile, default) | 15px (GP fact rail) | `GvPrimerFactSize.regular` / `.compact` |
| Empty block | list (32px icon, 20px title) | detail (28px icon, 18px title) | `GvPrimerEmptySize` |
| Button hover | Driver, Team, Circuit (XS-09) | not on GP and list screens | `GvPrimerButton(hover:)` |

Measured in Chrome (`light-rollout-b1/td-index-light`, `dd-index-light`):
the strips themselves match Flutter at 390 @100% and 320 @200% (Team 81 /
198px tall, Driver 81 / 200px). The extra space around them in the
prototypes is the browser's default `<dl>` margin, 1em of the body text
(15px at 100%, 30px at 200%), which belongs to the screen composition: Step
55C reproduces it when it places the strip (`GvPrimerLayout.containerEm(scaler,
1)`), and the strip stays free of outer spacing.

**Pill button pressed (Step 55B.4.1).** `button.on` at 6% over the pill
(the inverse-plane `pressedOverlay` mechanism; the button shares that
colour pair); with `hover` on, the overlay is blended over `button.hover`,
so pressed is always one step beyond hover (Dark Chalk-200 → about 1.1:1
darker; Light Graphite-800 → about 1.1:1 lighter). XT-5 `state.pressed.control`
(`raised`) is not used on the inverse pill: the label would sit on a fill of
almost its own colour. Geometry, label, ring and semantics unchanged; no
animation. The button is the only consumer of this blend; rows and the
leader card are unchanged.

**Deferred to Step 55C (screen compositions, one consumer):** app bars and
the detail back button; Home hero, round block, livery tag and text links;
Driver plate and number board, `ch__more` inline stats; Team banner layout,
line-up rows and spec sheet; Circuit sheet, dimension figure and figure
facts; GP identity band and schedule; Settings option list, snackbar and
environment strip; per-screen skeleton shapes.

**Isolated decisions (not implemented):** the 13px kicker heading with a
trailing rule is a second level for the same heading role (XS-29 pending);
the prototypes' 3px hover nudge on discs and text links is motion and is
not added.

**Measured differences (flutter_tester vs Chrome):** structure, sizes and
colours match in all 16 comparisons; Archivo renders about 4% wider in
Flutter, so the N-2 notice wraps to two lines at 390 @100% (the same
renderer difference accepted for the GP rows); the Light notice reference
still shows the superseded cloud-off icon (VS-4 help in Flutter).

Review evidence: `node tool/primer_review/capture_primer_55b4_refs.mjs` then
`flutter test tool/primer_review/capture_primer_55b4_test.dart` →
`build/primer-review/55b4/`. Step 55B.4.1 strips:
`node tool/primer_review/capture_primer_55b41_refs.mjs` then
`flutter test tool/primer_review/capture_primer_55b41_test.dart` →
`build/primer-review/55b41/`.

**Step 55B status (Step 55B.5, 2026-11-14).** The owner approved the Step
55B.4.1 results (stat-strip variants, fact sizes, pill-button pressed
behaviour) and considers Step 55B complete at the Flutter shared-component
level. The Step 55B.4.1 review screenshots have not been individually
owner-reviewed; the approval rests on the reported measurements and results.

Final Step 55B inventory (all in `lib/core/widgets/`, catalogue only):
surface context and status chip, outline, focus ring and target (55B.1);
livery cut, fit, segmented control, bottom navigation (55B.2); icons and
glyphs (55B.2.1, 55B.3, 55B.4); result, standings and race rows with their
row parts (55B.3); section title, notice, facts, stat strip, team mark,
actions, empty / skeleton / loading states (55B.4, 55B.4.1).

Still open: Android, TalkBack, native focus and device (Impeller) validation
(XS-02, XS-05, XS-16); the isolated decisions above (XS-29, hover nudge);
the screen compositions listed for Step 55C; no production screen or
navigation shell uses these widgets yet.

## 6f. Calendar initial positioning (Step 55C.2.1, owner-approved N-6)

The owner approved a narrow production version of N-6, including the two
extensions below (the deferred decision and top-aligned oversized rows).
DESIGN-DECISIONS records N-6 as **Approved** for Calendar only (2026-11-14,
rules (a)–(f)); this section is the implementation of that record, and N-6
is not a rule for other screens.
It lives in `CalendarScrollAnchor` and `CalendarScreen` only; Calendar
state, providers, repositories, sync and routing are unchanged, and the Stage 1
structure (pinned title and season; caption and notices scrolling) is
unchanged.

- **One decision per branch session.** On the first `CalendarReady` render
  whose inputs have all answered, the screen takes exactly one of three
  actions: reveal the first notice, reveal the current or next round, or
  keep the position. The decision is never taken again: later Drift
  emissions, background refreshes, a notice appearing afterwards, tab
  switches and Grand Prix detail returns never move the list. The `State`
  (controller and anchor) outlives tab switches and detail visits.
- **Notice first.** When a failure or stale notice is shown (the combined
  N-2 notice, or the first in N-1 order; Calendar state can never show two),
  the list moves only as far as needed to show the whole notice below the
  pinned header and above the navigation. Usually that is no move at all, so
  the caption above stays visible. A notice taller than the viewport is
  aligned by its top. Offset zero alone is not enough: at 320×693 @200% the
  stale notice starts at 312 px in a visible area of 150–604 px.
- **Otherwise the round.** The existing bounded convergence (at most three
  estimate jumps over post-frame callbacks) is unchanged, except that a row
  taller than the viewport is now aligned by its top. Previously, at 320 @200%,
  the 760 px emphasised row opened with its first 46 px under the header.
- **Deferred until the inputs answer.** `CalendarReady` is published as soon
  as rows exist, possibly before three other inputs have answered: the
  `calendar:<season>` sync record (freshness, so whether the stale notice
  shows), the bootstrap record (fallback freshness) and the stored season row
  (which row is relevant). The screen waits, without a timer, until those
  exact providers have answered (a value or an error). They are already
  watched by `calendarStateProvider`, so nothing new is requested. The
  screen selects only their readiness, and stops watching once the decision
  is taken. If those state inputs change, this check must follow them; a
  `freshnessResolved` flag on the state would remove the duplication, but it
  belongs to the application layer and was out of scope.
- **The user always wins.** A drag, pull or wheel scroll, or any scroll
  before positioning starts, cancels every pending step. A position that is
  no longer the controller's initial offset when positioning starts
  (restored or user-moved) is kept.

Tests: `test/screens/calendar_initial_position_test.dart`, mutation-checked
for each rule.

Still open:
- native Android and TalkBack validation;
- real-device scrolling and system-inset validation;
- keyboard scroll commands during an already-running multi-step anchor
  adjustment;
- a freshness dependency that never resolves (the list then stays at its
  start);
- owner visual review of Home and Calendar (done: approved in Step 55C.4).

## 6g. Calendar contextual jump action (Step 55C.2.2, XS-19)

An owner-approved, limited addition to Calendar Stage 1. It is user-initiated
navigation after a notice-first opening; N-6 (§6f) stays the only automatic
positioning and is unchanged. It is recorded under backlog XS-19, and is not
a rule for other screens.

- **What.** `CalendarJumpAction` in `calendar_status_block.dart`, directly
  after the notice inside the scrolling status block. It is not part of
  `GvPrimerNotice`, scrolls away with the notice, and is never pinned or
  floating.
- **Look.** A text action in `text.primary`, weight 700 at body size, with the
  trailing arrow glyph, built from `GvPrimerFocusTarget`, existing roles only
  and no new token. Hover is `state.hover`; pressed is
  `state.pressed.control`. The ring is standard; the target is at least 48dp;
  Enter and Space activate it. It is one button node named by its visible
  words, read after the notice and before the first round.
- **Wording** (ARB `calendarGoToNextAction`, `calendarGoToCurrentAction`).
  The current variant is used exactly when the shared selection
  (`resolveRelevantEvent`) marks the event in progress; nothing is inferred
  from time on its own.
- **Shown only** with a failure or stale notice and the relevant row in the
  list: never during loading, in an empty season, without a relevant race, or
  without a notice. Showing it moves nothing.
- **Activation.** `CalendarScrollAnchor.jumpToItem` runs the same convergence
  towards the same item as the opening without a notice, with the same
  alignment (top alignment for an oversized row). It moves at once when the
  row is built, otherwise within at most three frames, with no animation, so
  it suits reduced motion. A user scroll during those frames cancels it.
  Earlier user scrolling does not block it (the user asked). It never opens
  Grand Prix Detail, never changes the route, and spends any still-pending
  automatic decision. Restoration (tabs, detail) is unchanged.

Tests: `test/screens/calendar_jump_action_test.dart` (a deterministic
synthetic 23-round season; no private data), mutation-checked. Still open:
full-season device validation (Android, TalkBack, real scrolling) and the
remaining XS-19 items.

## 6h. Standings (Step 55C.5; decisions Step 55C.5.1; visually approved Step 55C.6)

The production Standings screen in Primer V2, Dark and Light, on the
existing Riverpod state (`standingsStateProvider`, `standingsUiStateProvider`,
`StandingsController`), routes and repositories, all unchanged.

| Approved section | Flutter |
|---|---|
| Title row, season (ST01) | `StandingsHeader` (`standings_header.dart`): `CalendarTitle` (S-2 fit) and `HomeIconButton` reused unmodified; season row `-4px` |
| Selector bar (ST02) | `StandingsSelectorBar`: `GvPrimerSegmentedControl` in a group labelled "Championship", hairline below |
| Ranking rows, leader card (ST03–ST14, S-5) | `StandingsRankRow` (`standings_table.dart`) over `GvPrimerStandingsRow`; leader = confirmed `position == 1`, tied wording when several; `pts` unit from the existing `homePointsValue` template |
| Team accent (ST08 / ST13, XT-3) | `GvPrimerTeamMark` tick only when a colour is stored; prototype position (6px in, 16px down), fixed 40dp length (Explore's), not stretched (owner-approved, DD SF-3) |
| Status (ST15–ST18, PD-03) | `StandingsStatusBlock` (`standings_status_block.dart`), first item of each table's own list |
| Loading / empty / error (ST19) | `StandingsSkeleton` (6 × 56px), `StandingsEmptyTable`, `StandingsErrorTable` (`GvPrimerEmptyState`, list size, retry `GvPrimerButton`) |

- **Status placement (owner-approved, DD SF-1, Standings only).** Title,
  season and selector are pinned; the caption and notices are the first item
  of the selected table's own scrolling list, before the rows in reading
  order. Table offsets stay independent and a background refresh never moves
  the user's position. This supersedes, for production Standings, the
  prototype's pinned status area, which would take 41–78.5% of the viewport
  at 320×693 @200% (Spanish stale notice: 78.5%). Calendar's N-6 automatic
  positioning does not apply to Standings.
- **Header budget (DD SF-2; S-1 / XS-06 open).** Measured at 320×693 @200%
  (`build/primer-review/55c5/metrics.md`, flutter_tester, insets 0): pinned
  header 235px = 33.9%, list viewport 53.2% above the legacy navigation. The
  S-1 title-row release is not implemented; both stay pending Android device
  evaluation with real system insets.
- **Freshness caption (logic accepted, DD SF-2; PD-03 / STD-01 open).**
  "Refreshing…" while the selected table refreshes; otherwise "Last
  successful check: HH:mm" only from that table's own `lastSuccessAt`;
  nothing for a bootstrap-materialized table; never Home's or the other
  championship's time. No timestamp is invented for the staging reference. The Spanish L1 wording is not applied
  (XS-30), as on Home and Calendar.
- **Notices.** N-2 combines failure and staleness of the selected table (one
  resource); either alone keeps its existing string; VS-4 icons.
- **Semantics.** RK-1 implemented: an unranked row reads "Unranked" / "Sin
  clasificar" (`positionUnranked`); the visible "—" is unchanged. Header
  reading order: title, Refresh, Settings, season, selector.
- **Shared fix (55C.5).** `GvPrimerStandingsRow.detailsLine`: a details part
  stays unbroken while it fits one line; a part wider than a whole line keeps
  its ordinary spaces, so "Red Bull Racing" wraps between words in the
  leader card at 320 @200% instead of breaking inside a word. Lines that fit
  are unchanged. Regression test in `primer_rows_test.dart`.

Tests: `test/screens/standings_primer_test.dart`; existing
`standings_widget_test.dart` finders moved to the Primer widgets (assertions
kept). Review evidence: `node tool/primer_review/capture_standings_55c5_refs.mjs`
then `flutter test tool/primer_review/capture_standings_55c5_test.dart` →
`build/primer-review/55c5/`. The nine Standings goldens were re-baselined
on the canonical Linux platform after the owner's visual approval (Step
55C.6, §7).

## 6i. Explore (Step 55C.7; decisions Step 55C.7.1; visually approved Step 55C.8)

The production Explore screen (Drivers, Teams, Circuits) in Primer V2, Dark
and Light, on the existing Riverpod state (`exploreStateProvider`,
`exploreControllerProvider`, `exploreUiStateProvider`), routes
(`/explore/drivers|teams|circuits`) and repositories, all unchanged. Visual
reference: EX-02 Alternative B (`explore/comparison-missing-media/cue.html`),
latest chain `cross-theme-54b/ex-cue-{dark,light}-seam` (LT-1, XT-3); states
from `light-rollout-b2/ex-states-{dark,light}` (their cloud-off notice icon is
superseded by VS-4). Detail screens are not migrated.

| Approved section | Flutter |
|---|---|
| Title row, season | `ExploreHeader` (`widgets/explore_header.dart`): `CalendarTitle` and `HomeIconButton` reused unmodified; Settings only (Explore has no refresh action) |
| Category selector | `ExploreSelectorBar`: `GvPrimerSegmentedControl` (option padding 10, Explore's), group "Explore category", hairline below |
| Status | `ExploreStatus` (`widgets/explore_status.dart`) as the first sliver of the selected collection's own `CustomScrollView` (`ExploreStatusSliver`, `explore_collection_view.dart`), before the rows (owner-approved DD EF-1) |
| Rows (EX-01, EX-02, RK-2) | `ExploreEntityRow` (`widgets/explore_entity_row.dart`) via `ExploreDriverCardRow`, `ExploreTeamCardRow`, `ExploreCircuitCardRow` (`explore_cards.dart`) |
| Team accent (XT-3) | `GvPrimerTeamMark` tick, 3 × 40px, 18px from the row top, in the 16px accent lane; supplied colour unchanged; 1px boundary only below 3:1 |
| Loading / empty / error | `ExploreSkeleton` (six 76px rows, two lines at the rows' text column, no squares without a media column; DD EF-4), `GvPrimerEmptyState` (list size) with the existing icons and retry `GvPrimerButton`; first-load error uses the alert glyph |

- **Rows.** Name (17px, 750, `wdth` 94; 86 in the narrow layout), secondary
  lines, the team's tracked line-up codes, the labelled data line ("Position
  2 · Points 402.5 · Power unit Renault", existing `field*` keys), the
  identity figure (driver number + code; circuit length + "km" from the
  `lengthKilometers` template), and the 16px row chevron. At or below 20em
  (every 200% configuration) the row stacks: driver figure first, inline;
  circuit figure after the details; chevron at the top. Names wrap; nothing
  is truncated.
- **RK-2.** An unranked position is omitted; known points, including 0, are
  kept. Spoken names use `standingsPositionSemantics` / `standingsPointsSemantics`
  ("Position 2", "402.5 points"). The remaining parts of each label are the
  legacy ones (driver: name, team; team: name, line-up; circuit: name,
  location, event): fuller labels stay pending (EXP-01 difference 4, PD-07).
- **Media (DD EF-3, accepted for now; PD-16 / EXP-04 open).** The column is
  decided per collection from the read model before anything loads: no
  media reference in the list → no image column (EX-02); at least one →
  every row reserves the existing 40dp `GvRemoteImage` slot (thumbnail
  request, decorative, existing placeholder), so loading, failure and
  absence never move the text. The approved media inventory is empty, so
  production shows the no-media layout. The loading skeleton follows the
  same deterministic policy (EF-4): with no card known yet there is no
  reference and so no slot; a future collection with media would reflow
  once when it loads.
- **Status (N-1, N-2, VS-4; DD EF-2).** Only the selected collection's own
  state, in order: "Last successful check: HH:mm" from that resource's own
  `lastSuccessAt` (kept while a refresh runs; absent for a
  bootstrap-materialized collection; never another resource's time); the
  progress line while it refreshes (2px `line.subtle` track, 40%
  `text.accent` sweep, static at 30% under reduced motion; PD-05 open); the
  fixture banner; the notices. Failure alone `exploreUpdateFailed`; stale
  alone `offlineStaleNotice` (the established out-of-date notice); both →
  `refreshFailedStaleNotice` (N-2). A bootstrap-materialized collection is
  never stale.
- **Placement (DD EF-1, Explore only).** Pinned: title, season, Settings,
  selector. Scrolling: caption, progress line, notices, rows. The status is
  its own sliver: when it changes height while the list is scrolled
  (`constraints.scrollOffset > 0`) it returns the difference as a
  `scrollOffsetCorrection`, so the viewport relays out in the same frame and
  the rows on screen do not move; a post-frame callback records the
  corrected offset in `ExploreUiState`. At the top the new status is
  revealed. N-6 is not applied. Measured (`build/primer-review/55c7/metrics.md`,
  flutter_tester, insets 0): pinned header 287px = 41.4% at 320×693 @200%
  and 160px = 19.0% at 390×844 @100% in every status state; scrollable
  viewport 317px (45.7%) and 604px (71.6%) above the legacy navigation
  (previously up to 73.4% pinned, 95px of list). S-1 / XS-06 stay open.
- **Season transition (Step 55C.8.1, owner-approved correction).** A new
  season never inherits another season's scroll offset (Phase 7C navigation
  contract). `_ExploreScreenState` keeps the last known resolved season; when
  it changes from one known season to a different known season, the three
  category controllers are replaced by new ones at offset 0 during that build
  and the replaced ones are disposed after the frame, once their scroll views
  have detached. Each list's `PageStorageKey` carries the category and that
  known season (`explore-drivers-list-2027`), so the new season's views are
  new scroll views and nothing is restored from page storage. A transient
  unresolved (`null`) season, a repeated emission of the same season, a Drift
  or sync-record emission, a refresh, a category switch, a branch switch and
  a Detail round trip do not reset anything. The audit (real router and
  providers) found the stale offset when the new rows were already stored
  and for another category after a branch round trip (both already present
  at `e42a2eb`), and after a loading state or an offstage transition
  (introduced by the season-independent storage key of Step 55C.7).
  Application season selection, providers, routing and persistence are
  unchanged.

Tests: `test/screens/explore_primer_test.dart` (Step 55C.7.1 adds the
placement matrix EN/ES × 390@100% / 320@200% × Dark/Light, reading order,
row stability across refresh outcomes, three-category offsets, the caption
and the skeleton geometry); existing Explore, media, navigation,
reduced-motion and badge-layout tests moved to the Primer widgets (the "no
media renders a placeholder" assertion now asserts no image column, per
EX-02; Explore drags target its `CustomScrollView`). Step 55C.8.1 adds the
`season transition` group to `test/screens/explore_widget_test.dart`
(scenarios A to E: stored rows, rows after a loading state, Teams then a
Home → Explore switch, an offstage transition, same-season data; plus
repeated same-season emissions, a transient unresolved season, a refreshed
sync record, and the new season's independent offsets across a category
switch and a Detail round trip), driven through an optional
`currentSeasonStream` on `pumpApp` (`test/support/router_harness.dart`;
existing callers unchanged). Review evidence: `node tool/primer_review/capture_explore_55c7_refs.mjs`
then `flutter test tool/primer_review/capture_explore_55c7_test.dart` →
`build/primer-review/55c7/`. The owner visually approved Explore in both
themes (Step 55C.8: all three collections, EN 390dp/100% and ES 320dp/200%,
EF-1 to EF-4 as implemented); the 12 Explore goldens (4 screen, 2 Light, 6
media) were then re-baselined on the canonical Linux platform (§7). Still
open: PD-16 / EXP-04 (real-media layout), PD-05 (progress animation), PD-07
(fuller spoken labels), S-1 / XS-06 (native header evaluation), and Android,
TalkBack, D-pad, switch access, native focus, scrolling, real system insets
and font scaling.

## 6j. Driver Detail (Step 55C.9; visually approved Step 55C.9F)

The production Driver Detail in Primer V2, Dark and Light, on the existing
state (`driverDetailStateProvider`, `driverDetailControllerProvider`),
route (`/drivers/:driverId` on the root navigator), `EntityNavigationOrigin`
season hand-over and DAO relevance order (`sortBySpanRelevance`), all
unchanged. Visual reference: `light-rollout-b1/dd-{index,partial,states}-{dark,light}`
(DR-01, DR-02, DR-03; LT-13; DK-6 / LT-10). The shared
`EntityDetailScaffold` is untouched (Team and Circuit still use it); Driver
Detail composes its own Primer scaffold.

| Approved section | Flutter (`lib/features/drivers/presentation/`) |
|---|---|
| Detail app bar | `widgets/driver_detail_app_bar.dart`: 48px back column, title 18px capped 26 (one line, ellipsis), hairline; back = mirrored shared arrow glyph, ring `GvPrimerFocusGeometry.backButton` (XT-4); shown only when the route can pop (Material `AppBar` rule), `Navigator.maybePop`, localized "Back" |
| Identity plate + number board | `widgets/driver_plate.dart`: season line (DR-02), condensed name (the heading), nationality once, Red Oxide board with the number-source label (DR-03); stacked at ≤ 23em, or ≤ 30em for a multi-digit or code-only board; bare without number and code |
| Season participation | `widgets/driver_stint_row.dart`: every span; the relevant span with a resolved team is the one link (whole row, "Open team …", arrow disc, row focus geometry); XT-3 tick (3px) in the 4px lane, link row only |
| Championship | `widgets/driver_championship.dart`: `GvPrimerStatStrip` (`.driver`), inline wins/podiums, provisional chip, `GvPrimerLinkRow` to the exact-season Drivers' Standings; the prototype's `<dl>` margins reproduced |
| Profile, About | `GvPrimerFactGrid` / `GvPrimerFact`; 16px paragraph |
| Notices, loading, messages | `widgets/driver_detail_states.dart` |

- **Notices (N-1, N-2, VS-4).** All about the one `driver:<id>:<season>`
  resource: failure `detailUpdateFailed`, stale `detailCachedNotice`, both
  → `refreshFailedStaleNotice`; then incomplete `detailPartialNotice`, which
  a failure never hides. One block at the top of the scrolling content,
  12px between notices; no N-6 / EF-1 positioning.
- **Media.** No portrait request (the approved inventory is empty) → no
  layer and no placeholder. With a request: the existing `GvRemoteImage`
  slot behind the approved scrim, never sizing the plate. Step 55C.9R
  (XS-15): the plate passes the new opt-in `GvRemoteImage(showPlaceholder:
  false)`, so pending and failed media leave the slot empty (same size,
  state keys, requests, fade-in and semantics; every other consumer keeps
  the default placeholder). Residual: in Dark the scrim is drawn while the
  image is pending or failed and masks the 4.5% sheen on the left of the
  plate (Light unaffected).
- **DD-06 / XS-14 (Option B approved and active, Step 55C.9F; DD DF-1).**
  With a one-digit board the wide plate split "Verstappen" / "Hulkenberg" at
  346–360dp @100%. Driver Detail passes `stackForUnbrokenName: true`: the
  plate also stacks when the name's longest word, measured as rendered, is
  wider than the name column; only those widths change
  (`build/primer-review/55c9r/`,
  `tool/primer_review/capture_driver_55c9r_test.dart`).
- **Back focus ring (Step 55C.9F; DD DF-3).** Circular on the round button
  (`GvPrimerFocusGeometry(offset: backButton offset, radius: 24)`, local to
  `driver_detail_app_bar.dart`).
- **Approval (Step 55C.9F).** Visually approved in Dark and Light (DD DF-1 to
  DF-6). Still open: Android, TalkBack, D-pad, switch access, real font
  scaling, real-portrait validation, the Dark sheen under the scrim while a
  portrait is pending or failed.
- **Measurement.** The board's width and the stacked row's share decision
  use `TextPainter` metrics merged with the inherited `DefaultTextStyle`
  (which carries Material's 0.25 letter spacing), rounded up.
- **Not applied / open:** PD-11 / DRV-01 (nationality once, section order,
  hidden "Participation"/"Role" terms, skeleton shape: implemented as
  prototyped, still pending), PD-06 / XS-03 (reading order: heading →
  season → nationality → board, as prototyped), XS-07 (title rule), XS-15,
  `text-wrap: balance` (no Flutter equivalent).

- **Standings link (Step 55C.9N, functional fix).** Driver and Team Detail
  opened their Standings table with `openEntity`, which pushed a location
  inside the `StatefulShellRoute` above a root-navigator entity page. Whenever
  the shell was already in the stack (the detail opened from Home, Explore,
  another entity or a non-matching table) that built a second shell with the
  same branch navigator keys and failed go_router's
  `!keyReservation.contains(key)` assertion (reproduced at `7d5aa59`). Both
  links now use `openBranchDestination` (`entity_navigation.dart`): `pop` when
  the detail was opened from exactly that table (season, championship and
  scroll kept), otherwise `go`, the branch switch Home's own Standings
  actions already use. Entity-to-entity links still use `openEntity`. Tests:
  `test/navigation/detail_standings_navigation_test.dart`.

Tests: `test/screens/driver_detail_primer_test.dart`. Review evidence:
`node tool/primer_review/capture_driver_55c9_refs.mjs` then
`flutter test tool/primer_review/capture_driver_55c9_test.dart` →
`build/primer-review/55c9/`. The Driver goldens are not re-baselined.

- **Step 55C.10 extraction.** The app bar, the notice rule and block, the
  full-page message, the skeleton base, the heading sheen and the About
  paragraph now live in `lib/features/shared/presentation/widgets/primer_detail_*.dart`
  (§6k); the Driver files keep aliases and Driver's rendering, semantics,
  tests and goldens are unchanged.

## 6k. Team Detail (Step 55C.10; visually approved Step 55C.10F)

The production Team Detail in Primer V2, Dark and Light, on the existing
state (`teamDetailStateProvider`, `teamDetailControllerProvider`), route
(`/constructors/:constructorId` on the root navigator), `EntityNavigationOrigin`
season hand-over and read-model line-up order (`_byRosterOrder` in the DAO),
all unchanged. Visual reference: `light-rollout-b1/td-{index,partial,returning,states}-{dark,light}`
(TM-01, TM-02, TM-03 principle; LT-13), with the team-colour edges taken from
`cross-theme-54b/td-states-{dark,light}-seam` (XT-3). `td-index-light-alt`
(the rejected Graphite band) is not used. `EntityDetailScaffold` is
untouched; Circuit Detail is now its only consumer.

| Approved section | Flutter |
|---|---|
| Detail app bar | shared `PrimerDetailAppBar` (below), title `constructorTitle`, back key `team-detail-back` |
| Entrant banner | `constructors/presentation/widgets/team_banner.dart`: season line (`seasonLabel`, ready-state season), the season-aware name as the heading (36px capped 40, weight 820, `wdth` 90, balanced lines, max 15em), the stable name only when it differs (read "Team: …", TM-02) and the nationality shown once (or the bare country code), split by a 12° `line.strong` hairline; the XT-3 rail (3px pinstripe over 46%, 4px, 12px bar to the right edge) only with a colour; band surface, Dark sheen, no card, no placeholder |
| Championship | `widgets/team_sections.dart` `TeamChampionship`: `GvPrimerStatStrip` (`.team`: position \| points \| wins, "Unranked" word, null wins omitted), provisional known chip, `GvPrimerLinkRow` to the exact-season Constructors' Standings through `openBranchDestination` (Step 55C.9N, unchanged) |
| Drivers | `widgets/team_lineup.dart`: one row per participation span in the supplied order, keyed by `entryId`; figure column (number over code, 3.5em, right-aligned), 2px XT-3 seam, name, span (only with an observed boundary) then role, 16px chevron; whole row is the link "Open driver {name}" with the row focus geometry; plain list (no figure column, no seam) when no row has a number or code; narrow at ≤ 20em (figures share the chevron line, seam dropped) |
| Team details | `TeamSpecSheet`: ruled 2fr / 3fr spec sheet, value under term at ≤ 20em; present values only |
| About | shared `PrimerDetailAbout` (no card) |
| Notices, loading, messages | shared `PrimerDetailNotices` / `detailNotices`, `PrimerDetailMessage`; `TeamDetailSkeleton` = shared `PrimerDetailSkeleton` with the 168px banner block |

- **Section order.** Notices, banner, Championship, Drivers (TM-01:
  Championship before Drivers), Team details, About; 32px apart; 32px above
  the bottom inset. The "Team information" card is gone (TEAM-01 item 3,
  implemented as prototyped, still pending).
- **Line-up contracts.** Rows come in the read model's order, never
  re-sorted; a returning driver keeps one row per span; a row with neither
  boundary prints no span (never a full-season claim); unresolved stubs are
  omitted upstream; the row opens `/drivers/<stable id>` with the profile's
  season through `openEntity`. The space before a round number is
  non-breaking, as on Driver Detail (copy unchanged).
- **Participation span (Ember).** `text.accent`, weight 700, tabular: Ember
  `#F08A6C` on the Dark page (7.4:1), Red Oxide `#A03E2B` on the Light page
  (5.5:1); both pass 4.5:1 for 14px text. No new colour or token.
- **Team colour (XT-3, XS-25).** `GvPrimerTeamMark` with the runtime 3:1
  test against the surface each shape sits on (rail: `surface.band`; seam:
  page). Verified boundaries: `#1E41FF` rail and seam in Dark (Chalk), none
  in Light; `#FF8000` rail and seam in Light (Graphite), none in Dark;
  `#0093CC` seam only in Light (2.94 on the page), rail none (3.24 on the
  band). Supplied colours unchanged; sizes identical with or without a
  boundary; no layout change. The banner clips the rail's boundary at its
  right and bottom edges, as `.tb { overflow: hidden }` does. Without a
  colour the seam is a `line.strong` hairline (prototype fallback). XS-25
  stays open for device validation.
- **Media (T05).** The constructor's stable imagery (`MediaSlotPolicy.constructorMark`)
  only, as a decorative layer behind the banner under the approved scrim,
  with `GvRemoteImage(showPlaceholder: false)` (existing API, unchanged):
  absent, pending and failed media render the banner identically, no shield
  icon. It is never presented as a season livery (no season media field
  exists). Same residual as Driver Detail: in Dark the scrim masks the sheen
  while media is pending or failed.
- **Semantics.** Banner: name (heading), season line, "Team: Alpine",
  "Nationality: French". Each row: the link "Open driver {name}" (visible
  name hidden inside it), then "Race number N", the code, "Participation,
  …" and "Role, …", each exactly once, only when present (TD difference 7;
  XS-04 pending). Section titles are headings; spec rows read as one unit.
- **Back focus (Step 55C.10, owner-approved).** The circular 24px ring of
  Driver Detail (3px Dark, 1px Light), 48×48 target, placement, keyboard
  activation and `Navigator.maybePop` unchanged; shared with Driver only.
- **Text balance.** `text-wrap: balance` on the name is approximated by
  narrowing the heading's box to the smallest width that keeps the greedy
  line count (≤ 6 lines, `TeamBanner.balancedWidth`).

**Shared detail components (owner option A).** Moved from the Driver feature
to `lib/features/shared/presentation/widgets/` without a rendering change:
`primer_detail_app_bar.dart` (`PrimerDetailAppBar`, with the circular back
ring and a `backKey`), `primer_detail_notices.dart` (`DetailNoticeSpec`,
`detailNotices`, `PrimerDetailNotices` with a `blockKey`),
`primer_detail_states.dart` (`PrimerDetailMessage`, `PrimerDetailSkeleton`
with `blockHeight` / `blockDivider`), `primer_detail_parts.dart`
(`PrimerDetailHeading.darkSheen`, `PrimerDetailAbout`). Driver keeps its
names as aliases (`typedef DriverDetailAppBar`, `typedef DriverNoticeSpec`,
`driverDetailNotices`, `DriverDetailSkeleton` composing the shared skeleton,
`DriverPlate.darkSheen` referring to the shared sheen), passes its own keys,
and its tests, tools and goldens are unchanged. Kept local because they are
not genuinely shared: the Driver plate and Team banner, the stint row and
line-up row, the two championship blocks (Driver's inline statistics and
`.driver` strip versus Team's `.team` strip), the profile fact grid and the
spec sheet. Regression evidence: all Driver tests and the three Driver
goldens pass unchanged after the extraction (Windows).

**Implemented prototype differences (documented, not approved by default):**
TEAM-01 items 3 (nationality once), 9 (About without a card) and 11
(skeleton); DR-02 season line; XS-03 reading order (heading before the
season line); XS-04 row semantics; balance approximation; the
non-breaking round number. Measured against Chrome
(`ref-geometry.json` / `flutter-geometry.json`): whole pages within 3px at
390 @100% and 6px at 320 @200% (sub-pixel row heights accumulating), banner,
rail, strip, rows, seams and figures within 1px.

**Findings for owner review.** (1) With figures beyond any real season
(4-digit fractional points) the shared strip's last cell becomes too narrow
at 390 @100% and 320 @200% and "Wins" / "Victorias" split mid-word; the
prototype's CSS degenerates at the same place (`state-stress-figures.png`).
Realistic figures render cleanly (`state-long-names.png`). Step 55C.10R
(below) prepares the correction as an opt-in candidate. (2) A 3-digit race number no longer wraps inside the figure
column; it overflows towards the start, as the CSS flex item does.

**Step 55C.10R: stat-strip stress case (approved and active since Step
55C.10F).** The owner
approved Team Detail's composition, long names, team colours and failed
media, and asked for the stress case above to be corrected rather than
inherited from the frozen prototype. Root cause: the strip keeps one line
until the style's em-based narrow width (20em Team), so wide figures leave
the expanded last cell narrower than its label's longest word; Flutter then
breaks the word ("Wins" 2.4px wide and 64px tall at 390 @100%; "Victo|rias"
at 320 @200%). Candidate: `GvPrimerStatStrip(fitContent: true)`, off by
default, so Driver, the catalogue and the current Team screen are
unchanged. When on, the layout the narrow rule picks is kept whenever the
real content fits (every cell but the last unwrapped, the last at least its
longest label word and its whole value, plus the approved gaps and seams,
measured with the rendered Archivo metrics, ambient style and text scale);
otherwise Points and Wins move below Position, and if they still do not
fit side by side each takes its own line. Sizes, styles, seams, semantics,
reading order and the localized values are unchanged; this is an
intentional responsive improvement over the frozen Chrome prototype.
Measured (`build/primer-review/55c10r/measurements.json`): stress EN 390
@100% → Position, then Points | Wins (strip 140 → 158px, no wrap); stress
ES 320 @200% → three lines (229 → 293px, no wrap); 22 / 0 and 666 / 21 in
both themes, both languages and both sizes, plus unranked, empty-points and
zero cases: boxes identical to the default strip. `TeamChampionship`
exposes it as `fitStats` (default `false`); Team Detail passes `true`
(Step 55C.10F); Driver Detail and the catalogue keep the default. Tests:
`test/design_system/primer_stat_strip_fit_test.dart`.
Evidence: `flutter test tool/primer_review/capture_team_55c10r_test.dart`.

**Approval (Step 55C.10F, 2026-11-15).** The owner visually approved Team
Detail in Dark and Light: composition, banner and stable-name presentation,
Championship before Drivers, line-up spans and Ember accents, XT-3 team
colours, Team details and About, Back and row focus, failed-media state,
long names, and the content-aware stat strip (activated: ordinary values
keep the approved row, wide values stack under Position). Driver Detail is
unchanged by the shared-component extraction and by the strip change (its
tests and goldens pass; the strip keeps `fitContent: false`). The two Team
goldens were re-baselined on the canonical Linux platform (§7).

Still open (not certified): TalkBack (XS-03 reading order, XS-04 row
semantics), XS-25 device validation of team colours, native Android, D-pad,
switch access, real system font scaling and real media. Tests:
`test/screens/team_detail_primer_test.dart`. Review evidence:
`node tool/primer_review/capture_team_55c10_refs.mjs` then
`flutter test tool/primer_review/capture_team_55c10_test.dart` →
`build/primer-review/55c10/`.

## 6l. Circuit Detail (Step 55C.11; visually approved Step 55C.11R; CR-04 Step 55C.11C; final approval and goldens Step 55C.11F)

The production Circuit Detail in Primer V2, Dark and Light, on the existing
state (`circuitDetailStateProvider`, `circuitDetailControllerProvider`),
route (`/circuits/:circuitId` on the root navigator), `EntityDetailScope`
season hand-over, refresh scope (`circuit:<id>:<season>`) and related-event
read model, all unchanged. Visual reference:
`light-rollout-b2/cd-{index,partial,no-event,states}-{dark,light}` (LT-18),
states frame 13 from `light-coverage-gaps/cd-states-*` (Step 54A: explicit
unknown format dashed), VS-4 notice icons. The CR-04 comparison pages
(`cd-unknown-assoc`, `cd-partial-unknown`, `cd-partial-light-n8`) are not
used. Owner decisions: PD-13a/b/c Option A, circular Back focus,
scaffold retirement, PD-15 and PD-07 / XS-04 and XS-29 kept open
(DESIGN-DECISIONS "Circuit Detail Flutter decisions", CF-1 to CF-6).

| Approved section | Flutter (`lib/features/circuits/presentation/`) |
|---|---|
| Detail app bar | shared `PrimerDetailAppBar`, title `circuitTitle`, back key `circuit-detail-back` (circular ring, CF-2) |
| Notices, messages | shared `detailNotices` / `PrimerDetailNotices` (N-1, N-2), `PrimerDetailMessage` (season unavailable with retry, not found, first-load error with retry) |
| Circuit sheet | `widgets/circuit_sheet.dart` `CircuitSheet`: band surface, Dark sheen (`PrimerDetailHeading.darkSheen`), Light flat; name as the heading (40px capped 44, narrow 34/36; 820, `wdth` 72; balanced, max 14em, never split mid-word; a hyphenated word of ≤ 18 characters kept whole by a word joiner, semantics label unchanged); location (15px 600 secondary); `CircuitMediaFrame` only when an asset is selected |
| Circuit facts | `widgets/circuit_facts.dart`: ruled 13px kicker (`h2`, XS-29 local level); `CircuitDimensionLine` (term, value between two flexing arms with 2px Chalk ticks skewed 12°; figure 40/44, narrow 34/36, 830, `wdth` 116; unit 16px secondary); `CircuitFactRow` (corners, direction with `rotateCw` / `rotateCcw` in `text.accent`, first Grand Prix; CSS flex-wrap emulated: 28px / 16px gaps, items grow to share their line, values on a shared bottom line) |
| Lap record | `widgets/circuit_records.dart` `CircuitLapRecord`: timing readout (48/52, 830, `wdth` 118), ruled holder / year row (19/30, 780, `wdth` 90); unavailable holder secondary 600 (PD-13a); year-only record without the rule |
| This season's Grand Prix | `CircuitSeasonLine` in both states (PD-13b); `widgets/circuit_event_row.dart` `CircuitEventRow` (round word + figure 44/48 `wdth` 125, 4px Red Oxide seam 48–76px skewed 12°, name 19/30, date, chips, `GvPrimerArrowDisc`; narrow at ≤ 20em: round, seam and disc on the first line); `CircuitNoEvent` statement between hairlines |
| Loading | `widgets/circuit_detail_skeleton.dart` `CircuitDetailSkeleton` (PD-13c): 232px block, then label 140×18 + 88px row twice (48 / 14 / 24 / 14px), static, announced once |

- **Gates and formatting (unchanged).** Facts only with `hasPhysicalFacts`;
  null direction omitted, explicit unknown reads "Direction unavailable"
  without a glyph; lap record only with `hasLapRecord`; holder only with a
  driver id, never a link, never the identifier; race distance and lap count
  never shown. Length = the existing `lengthKilometers` copy split around its
  locale number for the dimension line ("7.004" / "7,004" + "km"), read as
  one value; lap time unlocalized (CD-13); date `yMMMd`.
- **Related event.** Opens `/calendar/<event season>/<round>` through
  `openEntity` (Grand Prix → Circuit → same Grand Prix still pops); an
  unnamed event keeps navigation (PD-13a style). Status chip only with a
  status (`primerEventStatusKind`; unknown dashed), format chip only with a
  format (context; explicit unknown dashed, Step 54A). Semantics kept: one
  button "Open {name}" (PD-07 / XS-04 open).
- **Media.** `MediaSlotPolicy.circuitLayout`. No asset: no frame, no icon.
  Selected asset: 16:9 frame (`--ground-low`: Graphite 950 Dark, Light band)
  with eight 14 × 1.5px registration marks; pending = empty frame; failed, or
  a selected asset without an acceptable variant = the decorative 32px route
  glyph (`GvPrimerGlyph.circuit`, the prototype's `#i-route`). A layout
  diagram is labelled "Track layout of {circuit}"; a photograph is
  decorative. New opt-in `GvRemoteImage(failedPlaceholder:)`, used only with
  `showPlaceholder: false`; every other consumer unchanged. No production
  media asset was added.
- **Glyphs.** `GvPrimerGlyph.rotateCw` / `rotateCcw` drawn from the
  prototype's `#i-cw` / `#i-ccw` paths; existing glyphs unchanged.
- **Scaffold retirement (CF-3).** `EntityDetailScaffold`
  (`shared/presentation/widgets/entity_detail_scaffold.dart`) had Circuit as
  its last consumer; after the migration no production, test or tool code
  referenced it, and it was removed. The legacy widgets it used
  (`GvScreenScaffold`, `GvErrorState`, `GvEmptyState`, `GvSkeletonCard`,
  `GvOfflineNotice`) remain for Grand Prix Detail, Settings and others. The
  §6j/§6k mentions of the scaffold describe the state at those steps.
- **Deliberate deviations from Chrome.** (1) The kicker keeps the CSS flex
  behaviour (text one line, rule takes the rest) via measurement. (2) The
  wide event row without any chip centres the name against the full row
  height (the grid's second empty track is not emulated; no reference
  fixture has neither status nor format). (3) **Light dimension ticks (Step
  55C.11R, owner-approved CF-7):** the frozen reference's Chalk measured
  1.12:1 on the Light band; Light now uses `line.status` (Graphite 55%),
  3.97:1, lighter than the 7.30:1 rule (`CircuitDimensionLine.tickColor`).
  Dark keeps Chalk, pixel-identical; geometry unchanged. (4) Font
  metrics (accepted, as Driver DF-5): Primer text inherits Material's 0.25
  letter spacing from the ambient style, so at EN 320 @200% "Direction"
  takes its own line in the facts row (Chrome fits Corners and Direction on
  one line by about 3px); the page is 87px taller there. Typography was not
  altered to force the wrap. Measured against Chrome otherwise: whole pages
  within 4px at 390 @100% and equal at ES 320 @200%; sheet, dimension line,
  lap record, event row, seam, disc and media frame within a few px.
- **CR-04 / PD-14 / CIR-02 (Step 55C.11C, C-R1).**
  `circuitEventAssociationProvider` combines the watched profile's related
  event with `hasMaterializedCalendar(season: resolved season, metadata: calendar:<season>, bootstrapMetadata: bootstrap)` (`calendar_state.dart` → `hasMaterializedCollection`):

  | State | Condition | Shown |
  |---|---|---|
  | A. Linked | related event stored for (resolved season, circuit) | section, season line, event row (calendar not required) |
  | B. Confirmed absence | no event, season calendar materialized (stale or failed refresh included, CD-2) | section, season line, "No Grand Prix this season" |
  | C. Unknown | no event, season calendar not materialized | whole section omitted |
  | Resolving | profile, season or metadata still loading | whole section omitted (never a premature absence) |

  Reactive (Drift streams): a calendar sync that adds or removes the event,
  or materializes or clears the calendar, moves the screen between A, B and
  C. No calendar request is started; the circuit-scoped refresh, event
  selection, navigation and every other section are unchanged. CD-3
  (persisting `CircuitDetail.grandPrix`) deferred.
- **Freshness limitation (open).** Notices describe only
  `circuit:<id>:<season>`; a stale calendar behind a B statement is not
  signalled, and circuit freshness is never presented as calendar freshness.
  Smallest future correction: in B only, derive the calendar's presented
  freshness and show an existing stale notice when stale (owner decision on
  placement and copy; no new copy in this step).
- **Still open:** PD-15 (wording on historical seasons), PD-07 / XS-04,
  XS-29, native Android, TalkBack, D-pad, switch access, real system font
  scaling and real media.

**Approval (Step 55C.11R, 2026-11-15).** The owner visually approved the
composition in Dark and Light (related-event layout, unknown states, focus,
large-text wrapping, partial notice) with the CF-7 Light tick correction.
CR-04 was re-assessed (§8 of `STATUS-ABSENCE-DECISIONS.md`) and then
implemented in Step 55C.11C (§9; see the CR-04 bullet above).

**Final approval (Step 55C.11F, 2026-11-15).** The owner formally approved
the Dark and Light design, complete / partial / responsive layouts, the
CR-04 confirmed-absence and unknown-association presentations and the CF-7
Light strokes; no further visual refinement. The three Circuit goldens were
re-baselined on canonical Linux (§7). Deferred: the calendar-specific stale
notice for the B statement, CD-3. Open: PD-15, PD-07 / XS-04, XS-29 and the
device checks above; no Android or TalkBack certification is claimed.

Tests: `test/screens/circuit_detail_primer_test.dart`. Review evidence:
`node tool/primer_review/capture_circuit_55c11_refs.mjs` then
`flutter test tool/primer_review/capture_circuit_55c11_test.dart` →
`build/primer-review/55c11/`; Light tick before/after:
`flutter test tool/primer_review/compose_circuit_55c11r_test.dart` →
`build/primer-review/55c11r/ticks-light-*.png`.

## 6m. Grand Prix Detail (Step 55C.12; GPD-12 Step 55C.12R; visually approved and canonical goldens Step 55C.12F)

The production Grand Prix Detail in Primer V2, Dark and Light, on the
existing state (`grandPrixStateProvider`, `grandPrixResultsStateProvider`
and both controllers), route (`/calendar/:season/:round`, root navigator),
refresh scope (`grand-prix:<season>:<round>` and its results resource) and
navigation helpers, all unchanged. Visual reference:
`light-rollout-b2/gp-{index,results,title,states}-{dark,light}` (LT-18);
states frames 8, 9 and 22 from `light-coverage-gaps/gp-states-*` (VS-1
dashed unknowns); the Dark team-link ring from `gp-results-dark-tl`
(LT-17). Not used: `gp-states-light-n8` (LT-8) and `gp-states-light-s16`
(rejected Graphite skeleton, LT-16). Owner decisions GF-1 to GF-8
(DESIGN-DECISIONS "Grand Prix Detail Flutter decisions").

| Approved section | Flutter (`lib/features/calendar/presentation/`) |
|---|---|
| Detail app bar | shared `PrimerDetailAppBar`; title policy `grandPrixScreenTitle` unchanged (trimmed name, else "Grand Prix"); back key `gp-detail-back`; circular 24px ring (3px Dark, 1px Light) |
| Notices | `widgets/grand_prix_notices.dart`: `grandPrixEventNotices` (screen block, above the band) and `grandPrixResultsNotices` (under the first classification's title and chip); rendered with the shared `PrimerDetailNotices` / `DetailNoticeSpec`; fixture banner (`MockDataBanner`, unchanged) above them |
| Identity band | `widgets/grand_prix_band.dart` `GrandPrixBand`: `graphiteBand` scope (Graphite fill in both themes, Dark text roles), Dark sheen layered over the fill, `line.subtle` hairline below (and above after a notice block); chips (status via `primerEventStatusKind`, format context or dashed unknown); round word + figure 88/104 (`wdth` 125, 850, -0.05em, line 0.82), 4px Red Oxide seam skewed 12 degrees, season, name as the heading (32/40, 800, `wdth` 78; balanced, never split mid-word), official name; fact rail (black 16%, `GvPrimerFactGrid` 10em, compact facts: Dates, Location). Narrow at <= 20em (320dp, or large text): figure 64/72 with seam, round word and season beside it; name and official name full width. No image (GP10 / XS-15) |
| Circuit row | `widgets/grand_prix_circuit_row.dart` `GrandPrixCircuitRow`: kicker, name 19/30 (omitted when unresolved), accent "View circuit", `GvPrimerArrowDisc`; one link named "View circuit, {name}"; >= 72px; hover `state.hover`, pressed `state.pressed.row`, row ring |
| Sessions | `widgets/grand_prix_schedule.dart` `GrandPrixSchedule`: title, zones (event zone only when present, device zone always), day headers per run of consecutive same-day sessions (`runsByDay`), rows with the time first in a `7.5rem` column (22/28 tabular + 13px zone, second clock 13px with its own day when it crosses midnight), name 17px, status word or small chip (`primerSessionStatusKind`: Live, Cancelled, Postponed, dashed unknown); narrow at <= 22em: time above the name; inline empty state (clock glyph) |
| Results | `widgets/grand_prix_results.dart`: `GrandPrixResultsArea` (unavailable / loading / error inline, ready) and `GrandPrixClassificationSection` (title + `primerResultStatusKind` chip, then `GvPrimerResultRow` per entry) |
| Loading | `widgets/grand_prix_detail_skeleton.dart` `GrandPrixDetailSkeleton`: 12px, 212px band block between hairlines, label 120x18, three 48px rows (28 / 14 / 8px), theme colours (LT-16), announced once |
| Page states | not found (event-busy placeholder icon, "Go to Home") and first-load error (alert glyph, retry) as detail-size `GvPrimerEmptyState`, no button hover (XS-09) |

- **Additive shared definitions.** `GvPrimerChipKind.fastestLap` (the
  context chip's raised fill with the new `GvPrimerGlyph.timer`, the
  prototype's `#i-timer`); `primerSessionStatusKind`,
  `primerResultStatusKind`, `primerFinishStatusKind` in
  `primer_status_kinds.dart`; `GvPrimerEmptyState.padding` /
  `inlinePadding` (`.empty--inline`) and the opt-in `announceTitle`
  (heading + live region, the legacy `GvEmptyState` contract), used only
  by Grand Prix Detail. Every other consumer is unchanged.
- **Results rules (unchanged).** Delivered order, duplicates and missing
  positions ("—") kept; missing points omitted; timing elapsed, then gap,
  then laps behind > 0, then supplied text; fastest lap from the entry flag
  or the document's driver; "Finished" hidden visually, kept in the label;
  finish chips known, unknown dashed; unresolved names are localized
  fallbacks and identifiers keep navigating; driver and team open with the
  classification's season through `openEntity`. Winner (G-5): exactly
  `resolveHomeRaceWinner` (race, not unavailable, one P1, resolved name):
  gradient cell, "Winner" kicker and ", Winner" appended to the row label
  (XS-04 stays open). Sprint and other documents keep their own titled
  sections with the same rows and never the winner treatment (GPD-02).
- **Two resources (N-1 / N-2).** Event failure + event stale: one combined
  notice; event failure alone: `refreshFailedNotice`; event stale:
  `offlineStaleNotice`; in a remote build results-only staleness is the
  top stale notice and is never combined with an event failure (two
  notices). The results section shows its own failure; in a fixture build
  also its own staleness, combined with its failure. A results failure
  never removes the band or the schedule; a detail first-load failure shows
  no results area. N-4 not implemented.
- **Reading order (PD-06 / XS-03).** The band is one semantics container
  with ordinal keys: chips, "Round 13", season, heading, official name,
  facts. Each session row is one merged node read time, name, status.
- **Deliberate deviations from Chrome.** (1) The notice icons follow VS-4
  (alert / clock), not the states gallery's superseded cloud-off. (2) The
  empty-state flag and event-busy icons stay Material placeholders. (3)
  Sub-pixel text measurement can wrap a name one word earlier than Chrome
  at 320 @200% ("Charles Leclerc": 229.1px in a 230px column). (4)
  Geometry otherwise within 2px of Chrome on Scenarios A and B (page
  heights -4 / -1px).
- **GPD-12 team-link width (Step 55C.12R, owner-approved correction;
  implemented, owner visual and device validation pending).** The shared
  `GvPrimerResultRow` team link filled the name column; it now hugs its
  text and chevron, as the reference (`.cl__who` flex column,
  `align-items: flex-start`). `GvPrimerTrailingChevronText` reports the
  wider of its longest line and its last line + chevron, rounded up with a
  1px slack so the paragraph keeps its measured breaks, never wider than
  the column; the link keeps 48dp height and gains a 48dp minimum width.
  Ring (2px inside, LT-17), padding, colours, labels, semantics, focus
  order and activation unchanged. Measured link widths (DPR-independent
  logical px), EN 390 @100%: Red Bull Racing 222.4 → 138, McLaren 244.5 →
  92, Ferrari 251.4 → 78 (Chrome 136.1 / 90.2 / 76.3); ES 320 @200%: 238 →
  126 / 148 / 120 (Chrome 238 / 146.4 / 118.7). Deliberate deviation: a
  wrapped team name hugs its longest line, while Chrome's shrink-to-fit
  block takes the full column once its text wraps. Consumers: Grand Prix
  Detail and the development catalogue (same prototype). Evidence
  `build/primer-review/55c12r/team-link-*.png`.
  **Step 55C.12F measurement fix.** Inspecting the canonical goldens showed
  "Red Bull Racing" re-wrapped to "Red" / "Bull" with "Racing" clipped:
  the link measured its text in the bare style while the `Text` renders
  with the ambient `DefaultTextStyle` merged in (an inherited letter
  spacing the flutter_test font made visible). It now measures in the same
  merged style. Every link is 1–5px wider than at Step 55C.12R (McLaren
  92 → 94 at EN 390; Chrome 90.2) and the chevron no longer overlaps the
  last letter by ~2px; no other change. Guarded by
  `test/screens/grand_prix_team_link_test_font_test.dart` (never loads
  Archivo; failed before the fix).
- **Final approval and canonical validation (Step 55C.12F, 2026-11-16).**
  The owner visually approved Grand Prix Detail in Dark and Light (band,
  facts, circuit row, schedule, results, winner, 320 @200%, GPD-12, N-2
  notices, the synthetic 23-entry field; the extra "Charles Leclerc" line
  at 320 @200% accepted). Six goldens re-baselined in
  `ghcr.io/cirruslabs/flutter:3.44.0` on an ls-files copy:
  `grand_prix_detail_loaded`, `grand_prix_detail_staging_badge_es`,
  `grand_prix_standard_upcoming`, `grand_prix_completed_results`,
  `grand_prix_result_error`, `light_grand_prix`; the other 70 are
  byte-identical to `cffa874` (SHA-256). Linux golden suite 76/76; a full
  `--update-goldens` of all 76 gave zero drift. Not Android accessibility
  certification or production readiness.
- **Legacy files removed.** `grand_prix_hero.dart`,
  `grand_prix_event_info.dart`, `grand_prix_results_section.dart` and
  `shared/presentation/widgets/session_list.dart` had no production, test
  or tool consumer after the migration. `EventHeroImage` is kept, unused,
  for the deferred XS-15 decision. `GvSessionRow`, `GvResultRow`,
  `GvOfflineNotice`, `GvErrorState` and `GvEmptyState` remain (other
  screens and design-system tests).

Tests: `test/screens/grand_prix_detail_primer_test.dart`; review fixture
`test/support/grand_prix_review_fixtures.dart` (synthetic 23-entry field,
XS-13). Review evidence: `node tool/primer_review/capture_gp_55c12_refs.mjs`,
then `flutter test tool/primer_review/capture_gp_55c12_test.dart`
(`build/primer-review/55c12/`).

## 6n. Settings root and preferences (Step 55C.13A; root typography Step 55C.13AR; visually approved and canonical goldens Step 55C.13AF)

The Settings root (`/settings`) and the Language, Theme and Time display
screens (`/settings/{language,theme,time}`) in Primer V2, Dark and Light.
**Four of the eight Settings routes**: Data and updates, Acknowledgements,
Privacy and legal and About followed in Step 55C.13B (§6o). Routes (root navigator), destinations, groups, conditional rows,
preference values, defaults, keys and the `AppPreferencesRepository`
contract (immediate apply, one write queue, per-preference rollback,
silent supersession) are unchanged. Visual reference: `settings/` (Dark
composition) and `light-rollout-b2/set-*-{dark,light}[.es]` (LT-18);
token map §4.12 and §4.9. Owner decisions DD SF-1 to SF-20 ("Settings
Flutter decisions"; SF-20 is the Step 55C.13AR root typography
revision).

| Approved part | Flutter (`lib/features/settings/presentation/`) |
|---|---|
| App bar | `widgets/settings_app_bar.dart` `SettingsAppBar`: the detail bar's geometry (48px back column, 4px gap, 56px + `line.subtle` hairline, 6 / 16px padding) with a wrapping, uncapped 21px / 800 / `wdth` 88 title (page heading, names the route; HEADER-AND-HEADING variant C); one overlong word narrows 88 → 76 → 66 → 62 (S-2), never the size; since Step 55C.13BR2 a **single-word** title still too wide at 62 takes the reference's last-resort scale, at most 13% below its system-scaled size (SF-10R; §6o). Back: the shared circular `PrimerDetailBackButton` (made public, unchanged). `SettingsPrimerScaffold` adds the page colour and the 40px + safe-area end padding |
| Groups | `widgets/settings_group.dart` `SettingsGroup`: 13px / 700 `text.secondary` kicker as a heading, 1px `line.subtle` trailing rule (>= 24px; dashed 1.5px `line.strong`, shared dash pattern, for Developer); 20px above the first group, 28px above the others |
| Root rows | `widgets/settings_navigation_row.dart` `SettingsNavigationRow`: flat, inset hairline, >= 60px; title 17 / 600 (+ description 14px `text.secondary`) or label 14 / 600 `text.secondary` above the value 19 / 750 / `wdth` 92 with the 10 x 14 `mark.selected` mark; trailing chevron, mail glyph (Send feedback, SF-4) or nothing (static row); one button node "title, value, description"; pressed `state.pressed.control`, hover `surface.band`, ring 2px 3px inside, 6px corner, page focus colour; keyboard focus restoration after Back (SF-9). Large text (SF-20, 55C.13AR): `widgets/settings_rows_density.dart` `SettingsRowsDensity` gives every row of the list one width-axis tier from the list width in `em` of the 15px list font under the system text size, as the reference container query: regular (title 100, value 92, mark gap 9px), compact <= 17em (88 / 76, 7px), narrow <= 12.5em (70 / 66, value tracking -0.01em, 7px); a single word that still does not fit narrows further only within the role's steps. Measured inside the row, below its semantics node |
| Options | `widgets/settings_option_list.dart` `SettingsOptionList` / `SettingsOption`: 26 x 20 mark (`widgets/settings_selection_mark.dart`: 2px `text.secondary` outline / `mark.selected` fill + 16px `mark.on` check, `GvLiveryCut` radius 3), label 17px 550 (800 selected), explanation 15px `text.secondary` <= 34em; >= 64px; one node: radio (`checked`, `selected`, mutually exclusive group) + button, name "label, explanation", no ", Selected" suffix (SF-6, SF-7); Enter / Space; one stop per option (SF-8) |
| Choice screen | `preference_choice_screen.dart` `PreferenceChoiceScreen` (API and keys kept): 12px above the options; messenger and message captured before the write; only `failed` is reported; back key `settings-choice-back` |
| Snackbar | `widgets/settings_snackbar.dart` `showSettingsSnackbar` + `SettingsSnackbarContent`: a floating Material `SnackBar` with its own fill, elevation, padding and clip cleared (queue, timing, dismissal and the live region kept; `SnackBarTheme` untouched), drawing `snackbar.fill` / `snackbar.on`, 4px oxide seam at 12°, radius 8, 16px insets, shadow black 70% (Dark) / Graphite 45% (Light); ignores an unmounted messenger. `openSettingsExternalLink` reports a failed Send feedback hand-off with it (no URL). Step 55C.13B extends it to the information screens (SF-15) and retires `openExternalLink` |
| Text | `widgets/settings_primer_text.dart`: `SettingsType` roles and `SettingsFitText` (selective width axis for the app-bar title and options, SF-10 / SF-11; the root rows pass their list tier's steps, SF-20); tracking pinned to 0 (`letter-spacing: normal`; the ambient Material 0.25px is XS-33) |

- **Additive shared definitions.** `GvPrimerGlyph.check` (prototype
  `#i-check`) and `GvPrimerGlyph.mail` (SETT-04 / SF-4; envelope in the shared stroke
  family); `PrimerDetailBackButton` exposed from `primer_detail_app_bar.dart`
  with no rendering change (Driver, Team, Circuit and Grand Prix Detail
  unchanged; their goldens pass).
- **Kept.** `widgets/settings_rows.dart` (information screens until Step
  55C.13B; the `GvSettingsRow` tests; removed in Step 55C.13BR, §6o),
  `screen_sections.dart` (removed in Step 55C.13BR), `GvScreenScaffold`
  (NotFoundScreen), the legacy core widgets (catalogue), environment strip,
  badge, `MockDataBanner`, bottom navigation and the Material theme layer.
  `GvSettingsOption` is no longer used by a screen.
- **Focus restoration.** In every tested path (app-bar Back by keyboard,
  system Back, a language change on the child screen) Flutter's route focus
  scope already returns focus to the row; the row's own keyboard-gated
  request after its awaited `push` is a safeguard, never applied after a
  touch.
- **Final approval and canonical validation (Step 55C.13AF, 2026-11-21).**
  The owner visually approved the root (Dark and Light, 390 @100% and
  320 @200%), SF-20, the three preference screens, the option marks and
  states, the snackbar, the wrapping app bar, "Agradecimientos" and the
  mail glyph. Nine goldens re-baselined in
  `ghcr.io/cirruslabs/flutter:3.44.0` on an ls-files copy: `settings_root_dark_en`, `settings_root_dark_es`, `settings_root_light`, `settings_root_production`, `settings_root_large_text_narrow`, `settings_language`, `settings_theme`, `settings_time`, `settings_time_large_text_narrow`;
  the other 67 are byte-identical to `9576162` (SHA-256). Linux golden
  suites 76/76; two full `--update-goldens` runs gave zero drift. Linux
  full suite 3,155 passed / 1 skipped / 0 failed; Windows 3,152 / 1 / 3
  (accepted exceptions only). Four of the eight Settings routes; Step
  55C.13B pending. XS-33, real Android font scaling, TalkBack, D-pad,
  switch access and device persistence stay open. Not Android
  accessibility certification or production readiness.
- **Known differences from the reference.** Options narrow per label, not
  per list (SF-11; the root follows the list tier since 55C.13AR, SF-20);
  no `text-wrap: balance` on the title; the
  environment strip keeps its legacy style (SF-12). Rendered by
  flutter_tester; no device, TalkBack or real font-scaling validation.

Tests: `test/screens/settings_primer_test.dart`. Review evidence:
`node tool/primer_review/capture_settings_55c13a_refs.mjs`, then
`flutter test tool/primer_review/capture_settings_55c13a_test.dart`
(`build/primer-review/55c13a/`; the 55C.13AR before / after root
comparisons in `build/primer-review/55c13ar/`).

## 6o. Settings information screens (Step 55C.13B; visually approved Step 55C.13BR; SF-10R Step 55C.13BR2; final approval and canonical goldens Step 55C.13BF)

Data and updates (`/settings/data`), Acknowledgements
(`/settings/acknowledgements`), Privacy and legal (`/settings/privacy`) and
App information (`/settings/about`) in Primer V2, Dark and Light. With
§6n, all eight Settings routes are on Primer V2. **Visually approved by
the owner in Step 55C.13BR (2026-11-21) for the twelve reviewed scenarios;
the English "Acknowledgements" title at 320dp @200% follows SF-10R
(Step 55C.13BR2), approved in Step 55C.13BF with the canonical goldens.** Routes, keys, providers, the
attribution record, the package-metadata reader, the external-link
allow-list and every truth condition are unchanged; no network work, no
ARB change. Visual reference: `settings/information/` (SI-01 to SI-04) and
`light-rollout-b2/info-*-{dark,light}[.es]` (LT-18); owner decisions DD
SF-13 to SF-18 (Step 55C.13B).

| Approved part | Flutter (`lib/features/settings/presentation/`) |
|---|---|
| Frame | `SettingsPrimerScaffold` + `SettingsAppBar` (§6n, unchanged; S-2 title fit, SF-10); content starts 20px below the bar (`settingsInformationTop`); 40px + safe-area end padding |
| Sections | `SettingsGroup.information` (`.isec`): the §6n kicker and rule, 32px above, 4px below the kicker. Root groups unchanged |
| Facts (SF-17) | `widgets/settings_information.dart` `SettingsFact` / `SettingsFactList` (`.fact`, `.facts`): label 14 / 600 `text.secondary` above the value 17 / 600, 12 x 16px padding, inset `line.subtle` hairline between facts; numbers with tabular lining figures; "Not available yet" 500 in `text.secondary`; supplied notices as prose (16 / 400 / 1.55, <= 36em); a missing or empty value renders nothing (the `GvSettingsField` rule). One node with the combined label "label, value" (SF-13). In a list <= 17em of the 15px font the value takes `wdth` 88 (`SettingsRowsDensity`) |
| Session line (SF-16) | Privacy: Crash reporting, Performance monitoring, Advertising, then this session's line as its own `SettingsFactList` under the 1.5px dashed `line.strong` rule (`SettingsDashedRulePainter`, made public from `settings_group.dart`, no rendering change), directly above the diagnostics note; the "Privacy" kicker (`settingsPrivacy`), no repeated screen title. The session line keeps its conditions (production policy and an activation other than `notConfigured`) and still follows the live activation |
| Reading text | `SettingsProse` (`.lede`, `.explain`, `.prose p`): 16 / 400 / 1.55, `text.primary`, <= 36em; `SettingsProse.note` (`.note`): 15 / 400 / 1.5 `text.secondary`, 12px below. Nothing truncated |
| External links (SF-13) | `widgets/settings_external_link_row.dart` `SettingsExternalLinkRow` (`.xrow`): the Settings row (>= 60px, inset hairline, title 17 / 600 with the list's width tier) with the new trailing `GvPrimerGlyph.openExternal` (20px, `text.secondary`) instead of the chevron; value 16 / 650, displayed address 15 / 500 `text.secondary`, description 14px `text.secondary` <= 34em. One **button** focus stop (never a link role), name "title, value, address, description"; pressed `state.pressed.control`, hover `surface.band`, the Settings focus ring; Enter / Space. Opens through `openSettingsExternalLink` |
| Missing-policy explanation (SF-13) | Non-production only, no policy: a static `SettingsNavigationRow` (no action, title `text.secondary`, hairline above) 24px below the note; wording unchanged. Production with no policy shows nothing |
| Attribution (SF-14) | `widgets/data_source_attribution_card.dart` `DataSourceAttributionCard` (name and keys kept, no card): 8px above, provider name as a heading 22 / 800 / `wdth` 96, the four notices 12px apart, supplied credit / copyright / notice as prose facts under a hairline (12px above), then the project, terms (only when recorded) and licence rows; sources 40px apart. Licence tokens wrap naturally; nothing is inserted into or replaced in a legal string |
| Provider language (SF-13) | `DataSourceAttributionCard.recordTextLocale` (`en`): the record's licence title and supplied notices carry a `LocaleStringAttribute` in the spoken label and `TextStyle.locale` in the text. The bundled record is repository-owned, single-valued and written in English; it has no language tag, so a localized record must revisit this (SETT-20). GridView copy, provider names, licence names and media credits are not marked |
| States (SF-13) | `SettingsInfoLoading`: one static 20px `GvPrimerSkeleton` (radius 4, full measure) in `GvPrimerLoading` ("Loading", announced once) instead of the pulsing legacy block; `SettingsInfoEmpty`: plain `text.secondary` 16 / 1.5; `SettingsInfoNotice`: the shared `GvPrimerNotice` (alert cause, live region) for an unreadable record. A media read that has not answered or failed stays the loading block (SETT-14) |
| Snackbar (SF-15) | Every failed external hand-off (attribution links, privacy policy) shows the §6n Primer snackbar with `settingsOpenFailed`; the URL is never shown; `SnackBarTheme` untouched; the legacy `openExternalLink` is removed |

- **Additive shared definitions.** `GvPrimerGlyph.openExternal`
  (prototype `#i-open`); `SettingsGroup.information`; the public
  `SettingsDashedRulePainter`; Settings roles `factLabel`, `factValue`,
  `reading`, `note`, `emptyState`, `sourceName`, `linkValue`,
  `linkAddress`. No other shared component changed.
- **Legacy retirement (Step 55C.13BR).** `widgets/settings_rows.dart`
  (`GvSettingsRow`, `GvSettingsField`, `GvSettingsOption`) and
  `shared/presentation/widgets/screen_sections.dart` (`GvScreenSection`,
  `GvDetailField`, `GvInfoCard`) are **removed**: after the migration their
  only consumers were tests. The five `GvSettingsRow` accessible-name tests
  now run against `SettingsNavigationRow` (same `settingsSpokenLabel`
  rule; the value-plus-description order on the rule itself, since the
  Primer row draws a value or a description, never both); the Circuit
  Detail "no legacy card" assertion now checks `GvContentCard`, which the
  retired `GvInfoCard` rendered. `GvScreenScaffold` (NotFoundScreen) and
  the catalogue's legacy core widgets kept.
- **Known differences from the reference.** "BY-NC-SA" may break at a
  hyphen (SF-14; the reference keeps it whole); a displayed address breaks
  at Flutter's line-break opportunities (after "/"), not at any character;
  the unreadable-record notice uses the shared 14px notice, not the
  reference's 15px reading variant; the skeleton is the shared Primer
  gradient (LT-16), not a solid bar; the English app-bar title
  "Acknowledgements" at 320dp @200% broke inside the word at `wdth` 62
  ("Acknowledgeme" / "nts", Step 55C.13BR); the owner rejected that and
  approved SF-10R (below);
  an overlong single-word provider name breaks as in the reference
  (`overflow-wrap: break-word`). Fact positions within 1.5dp of Chrome at
  390 @100% and 320 @200% (4.7dp on long Spanish Privacy, 25dp cumulative
  over the 4,700px Spanish Acknowledgements at 320 @200%).
- **SF-10R single-word title fallback (Step 55C.13BR2).**
  `settingsSingleWordFitSize` in `widgets/settings_primer_text.dart`,
  opted into only by `SettingsAppBar` (`SettingsFitText.maxSingleWordReduction`
  = `SettingsType.appBarTitleMaxReduction`, 0.13). After the S-2 width
  steps, a title that is **one word** and still wider than its column at
  `wdth` 62 is scaled with the reference's formula
  (`floor(size x column x 100 / needed) / 100`, CSS px after the system
  text size), checked again after scaling and lowered by 0.01px steps if
  a non-linear scaler needs it, and applied only when the result is at
  most 13% below the system-scaled size; otherwise the approved size is
  kept and the word wraps (no partial shrink). Multi-word titles never
  shrink. Measured: "Acknowledgements" 320dp @200% 42 → 36.60px on one
  line (Chrome 36.63px), 46px tall instead of 106px; 320dp @175%
  36.75 → 36.60px; beyond the bound (300dp @200%, 300dp @250%, 320dp
  @250%) the approved size and wrapping, as before. "Agradecimientos" at
  320dp @200%, every 390dp @100% title and every multi-word title keep
  42px / 21px and their line counts. Heading text, label, Back (48 x 48,
  ring, navigation) unchanged; Dark and Light identical. Detail screens'
  `PrimerDetailAppBar` untouched.
- **Final approval and canonical validation (Step 55C.13BF, 2026-11-21).**
  The owner visually approved SF-10R ("Acknowledgements" on one line at
  about 36.6px, Dark and Light, 320dp @200%), all four information
  screens and their reviewed states, and the retirement of
  `settings_rows.dart` and `screen_sections.dart`. **All eight Settings
  routes are visually migrated to Primer V2.** Twelve goldens re-baselined
  in `ghcr.io/cirruslabs/flutter:3.44.0` on a `git ls-files` copy of the
  working tree: `settings_about`, `settings_acknowledgements_empty`, `settings_acknowledgements_populated`, `settings_acknowledgements_sources`, `settings_acknowledgements_staging_badge`, `settings_data`, `settings_data_frozen_en`, `settings_data_frozen_es`, `settings_privacy_configured`, `settings_privacy_production`, `settings_privacy_unconfigured` (`test/settings/goldens/`) and `test/media/goldens/acknowledgements_with_credits.png`. The other 64 of the 76 goldens are byte-identical
  to `08a1009` (SHA-256). Linux: golden suites 76/76; a second full
  `--update-goldens` run gave zero drift across all 76; full suite
  3,244 passed / 1 skipped / 0 failed. `flutter analyze` clean.
  **Capture-density correction (Step 55C.13BF2, a test-stability fix, not
  a visual change).** At 1x (390 x 844, a sub-tree capture of
  `AcknowledgementsScreen`) `acknowledgements_with_credits` differed by
  2.99% on Windows, only on horizontal text-block edges (platform
  anti-aliasing), over the unchanged 2% tolerance. Its test in
  `test/media/media_golden_test.dart` now captures the app root, as the
  Settings goldens do, so the image is rendered at the test view's 3x
  density (1170 x 2532) with the same 390 x 844dp layout (the test asserts
  the screen fills the window); regenerated alone on Linux. Windows: that
  golden differs by 1.08% and passes; full suite 3,241 passed / 1 skipped
  / 3 failed, the three accepted exceptions only (`primary_shell_nav`,
  `explore_drivers_no_media`, `explore_teams_media_dark`). Not a fourth
  exception.
  The golden test font ignores `wdth`, so SF-10R and the width tiers are
  guarded by the Archivo widget tests, not by the goldens. Not production
  readiness or Android accessibility certification.
- **Still open.** XS-33; SETT-07, SETT-09, SETT-11, SETT-14, SETT-18, SETT-20;
  SF-12; SF-19; TalkBack, D-pad, switch access, real Android font scaling,
  device persistence and the cross-screen accessibility checks. Not
  production readiness.

Tests: `test/screens/settings_information_primer_test.dart`. Review
evidence: `node tool/primer_review/capture_settings_55c13b_refs.mjs`, then
`flutter test tool/primer_review/capture_settings_55c13b_test.dart`
(`build/primer-review/55c13b/`).

## 6p. NotFoundScreen (Step 55C.14; visually approved and canonical goldens Step 55C.14F)

The router's recoverable not-found / invalid-link screen in Primer V2,
Dark and Light. **No prototype exists** (owner decision DD NF-1, option A).
It is composed from the approved Grand Prix Detail page-state precedent
(§6m "Page states"). Router, `NotFoundKind`, strings, icons and the
recovery route are unchanged.

| Part | Flutter (`lib/features/shared/presentation/not_found_screen.dart`) |
|---|---|
| Frame | `Scaffold` on `surface.page`, `SafeArea(bottom: false)`; in the Standings branch it sits inside the shell above the bottom navigation (Primer V2 since Step 55C.15), elsewhere above the shell |
| App bar (NF-2) | shared `PrimerDetailAppBar`, title `appTitle` ("GridView"), back key `not-found-back`; Back only when the route can pop (pushed, or Calendar below an invalid Grand Prix); circular 24px ring 3px Dark / 1px Light |
| Body (NF-3, NF-4) | private `_NotFoundBody`: `ListView` (bottom safe-area padding) with a detail-size `GvPrimerEmptyState(announceTitle: true)`: 28px Material icon in `text.secondary` (`explore_off_outlined` unknown route, `link_off_outlined` invalid parameters), title 18/28 capped, message <= 36em |
| Action (NF-5) | `GvPrimerButton` `not-found-home` (inverse pill, no hover, XS-09), left-aligned, `context.go(RoutePaths.home)`, or the router's `onGoHome` for the invalid Standings routes (NF-02 correction, Step 55C.15 §6q) |
| Semantics (NF-6) | the block is wrapped in `Semantics(explicitChildNodes: true)`, so the title alone is heading + the one live region and the message is its own node (the list item would otherwise merge them; GPD-13) |

- **Retired.** `shared/presentation/widgets/screen_scaffold.dart`
  (`GvScreenScaffold`, NF-7): no production, test or tool consumer
  remained. The two Settings absence checks now assert `SettingsAppBar`
  present and `GvAppBar` absent. Legacy core widgets kept for the
  catalogue and the design-system tests.
- **Known pre-existing behaviour.** NF-02: the Standings branch keeps
  an invalid location after recovery. This is a confirmed functional
  defect; its correction is scheduled for the Step 55C.15 navigation
  work, and it is not changed here.
- **Final approval and canonical validation (Step 55C.14F,
  2026-11-21).** The owner visually approved the screen: Dark and
  Light, both kinds, conditional Back, focus rings, Spanish at 320dp
  @200%, root and in-shell placement, and the scaffold removal.
  - Four goldens added in `ghcr.io/cirruslabs/flutter:3.44.0` on a
    `git ls-files` copy:
    - `not_found_unknown_dark` and `not_found_unknown_light`: direct
      entry, no Back, 390 x 844 @100%, 1170 x 2532.
    - `not_found_invalid_dark`: invalid Grand Prix deep link, Back
      present, 1170 x 2532.
    - `not_found_invalid_light_large_text`: invalid driver id,
      Spanish, 320 x 693 @200%, 960 x 2079.
  - Linux: golden suites 80/80; the 76 earlier goldens byte-identical
    to `4839d28` (SHA-256); a second regeneration with zero drift;
    full suite 3,304 passed / 1 skipped / 0 failed; `flutter analyze`
    clean.
  - Windows: 3,301 passed / 1 skipped / 3 failed, the three accepted
    exceptions only.
  - The wrapper job's exit 1 came from its final log display
    (`tail -3` over several files, which GNU tail rejects). Every
    validation step inside the container exited 0 (Step 55C.14G
    audit).
  - GPD-13 (the same semantics boundary for Grand Prix Detail page
    states) is approved as a separate accessibility correction.
- **Still open.** NF-02 (Step 55C.15), GPD-13, SF-19, TalkBack, D-pad,
  switch access and real Android font scaling. Not production
  readiness.

Tests: `test/screens/not_found_primer_test.dart`. Review evidence:
`flutter test tool/primer_review/capture_not_found_55c14_test.dart`
(`build/primer-review/55c14/`; Flutter only).

## 6q. Global surfaces: app shell, environment strip, fixture banner (Step 55C.15; owner decisions and corrections Step 55C.15R; visually approved and canonical goldens Step 55C.15F)

The last legacy-styled shared surfaces moved to Primer V2. Decisions:
DESIGN-DECISIONS "Step 55C.15 global UI integration" (GI-1 to GI-9).

| Part | Flutter |
|---|---|
| Shell (GI-1) | `lib/app/router/app_shell.dart`: `AppShell` (now stateful) uses `GvPrimerBottomNav` as `Scaffold.bottomNavigationBar` on `surface.page`. Destinations Home, Calendar, Standings (`GvPrimerGlyph.standings`), Explore; Material icons otherwise as in the catalogue |
| Selected-label fallback (GI-2) | `GvPrimerNavItem.selectedLabelFallback` (default off): when selected in the condensed or 2 × 2 fit, the label is `wdth` 62, weight 700 (S-3, `standings.css` / `explore.css`). On for Standings and Explore |
| NF-02 (GI-3) | `lib/app/router/shell_branch_resets.dart` (`ShellBranchResets`, one per router); `NotFoundScreen.onGoHome` for the invalid Standings routes; `AppShell._onSelect` consumes the reset, `didUpdateWidget` drops it on any other activation of the branch |
| Strip and badge (GI-4, GI-8) | `features/shared/presentation/widgets/environment_badge.dart`: strip on `surface.page` (a `Material`, so the text cannot inherit the app's fallback error style), padding `max(6, inset)` / gutter / 6; badge = `GvPrimerOutlinePainter` **continuous** `text.secondary` (the dashed outline was rejected, D3 / GI-4R), radius 999, Archivo 13/700/1.3, 0.26px tracking, `text.primary`, one semantics node. The app below the strip is a semantics container (non-production only) |
| Short viewports (GI-10) | `features/shared/presentation/widgets/primer_pinned_header_layout.dart` (Standings and Explore): the same layout as `Column(header, Expanded(body))` while the header leaves the list 96dp (two targets). Below that, the page scrolls: the header scrolls away and the list gets the whole viewport. The mode is measured (the header is laid out first) and applied on the next frame; header and body keep their state through `GlobalKey`s and are separate focus traversal groups |
| Banner (GI-5, approved D4) | `features/shared/presentation/widgets/mock_data_banner.dart`: `text.accent` 1.5px outline, `GvPrimerLayout.radiusSm`, 8 × 12, Archivo 14/700/1.45 centred; one semantics node; provider logic and wording unchanged |

- **Retired (GI-7).** `core/widgets/gv_bottom_nav.dart` (`GvBottomNav`,
  `GvBottomNavItem`) and its catalogue section; `GvLoadingSemantics`
  (`gv_skeleton.dart`) and its test group; `toneForEventStatus` /
  `toneForFinishStatus` (`domain_status.dart`). The legacy-navigation
  tests in `component_behavior_test.dart` (keyboard, activation, pointer,
  target, semantics) now drive `GvPrimerBottomNav`; the legacy-only ring
  and tap tests are covered by `primer_navigation_test.dart` and
  `primer_nav_focus_test.dart`.
- **Kept, with consumers.**
  - Catalogue only: `GvAppBar` (the catalogue's own app bar), buttons,
    cards, rows, section header (also the Primer catalogue section
    header), segmented control, skeleton blocks, states, status chip,
    `GvAdContainer`. The design-system goldens `component_sheet_light`,
    `data_card`, `primary_button`, `standings_row_leader` and
    `status_chips` cover them.
  - Production: `GvRemoteImage` (Driver, Team, Circuit, Explore, event
    hero) and its `GvImagePlaceholder` fallback; `GvStatusTone` (via
    `gv_rows`, catalogue).
  - Material theme layer: `gridview_theme.dart` (`MaterialApp` theme,
    `appBarTheme.systemOverlayStyle` with the legacy
    `systemNavigationBarColor`, the ambient text theme behind XS-33),
    plus `GvRadii.sm` in `GvPrimerStatusChip` (same 8px value). Retiring
    it would change already-approved rendering, so it stays (SF-19
    remainder). **Corrected in Step 55C.16 (§6r):** the
    `appBarTheme.systemOverlayStyle` was in fact applied by nothing in
    production once the Material `AppBar`s were gone; the system bars are
    now owned by `GvPrimerSystemOverlay` (XS-35).
- **Tests whose font changed.** `calendar_initial_position_test.dart`,
  `environment_badge_layout_test.dart` and two Explore scroll tests now
  load Archivo. The Primer bar picks its fit from measured label widths,
  and with the test font it would take the 2 × 2 layout at sizes where
  the app shows one row. One Calendar N-6 case moved to Spanish so it
  still exercises the scroll-past path at real metrics.
- **Large text (D1, GI-6R, GI-11).** The two-row navigation is approved at
  320 @200% (155px; the legacy pill was 89px). Tests that measured
  viewport shares or above-the-fold rows now check real-content
  reachability with `test/support/reachability.dart`: each block is
  scrolled whole into the area between the pinned header and the
  navigation and takes a tap there; a block taller than that area (the
  Standings leader card, a Spanish Explore status, a circuit row) is
  checked line by line.
- **Golden impact (D2, GI-9R).** Every golden that captures the shell or
  the strip is outdated by design (manifest in the Step 55C.15R report).
  Canonical goldens keep the Ahem test font. Ahem draws each glyph as a 1em
  square, so every navigation label measures wider than in Archivo and the
  bar renders 2 × 2 in every shell golden, even at 390 @100% where the app
  shows one row. Real-font layout is covered by the Archivo layout tests
  and the review captures.

- **Final approval and canonical validation (Step 55C.15F, 2026-11-22).**
  The owner visually approved the combined step.
  - Goldens: 38 re-baselined; 10 added by
    `test/screens/global_ui_golden_test.dart`; 90 in total.
  - The added goldens are each cropped to one surface with the test font:
    - the navigation, Standings selected, at 390 @100% and 320 @200%, Dark
      and Light;
    - the DEV and STAGING strip, Dark and Light;
    - the banner, Dark and Light.
  - Neither the navigation nor the strip is a repaint boundary, so the
    test crops the nearest boundary's image to the surface.
  - Linux (`cirruslabs/flutter:3.44.0`): goldens 90 / 90; the 42 others
    byte-identical to `4b5a6d5`; second regeneration with zero drift; full
    suite 3,400 passed / 1 skipped / 0 failed; `flutter analyze` clean.
  - Windows: 3,397 passed / 1 skipped / 3 failed, the accepted exceptions
    only (`explore_drivers_no_media` 2.10%, `explore_teams_media_dark`
    2.16%, `primary_shell_nav` 2.26%).
  - The fixture banner in the 320 × 480 STAGING frames: present and
    reachable in the scrolling status block, below the visible area on
    opening; evidence in the `combo-staging-banner-*-at-banner-*`
    captures.
  - NF-02 closed. SF-19 stays open for the Material theme layer: system
    overlay colours, the ambient text theme (XS-33) and the defaults that
    approved screens rely on.

Tests: `test/app/app_shell_primer_test.dart`,
`test/app/environment_primer_test.dart`,
`test/app/short_viewport_primer_test.dart` (the 320 × 480 @200% regression),
`test/navigation/nf02_branch_recovery_test.dart`,
`test/screens/global_ui_golden_test.dart` (ten isolated goldens). Review evidence:
`node tool/primer_review/capture_shell_55c15_refs.mjs`, then
`flutter test tool/primer_review/capture_shell_55c15_test.dart`
(`build/primer-review/55c15/`).

## 6r. Cross-screen corrective pass (Step 55C.16R)

Four corrections from the Step 55C.16 audit, implemented together. None
changes a pixel of an approved composition; the 90 canonical goldens are
unchanged (see the validation record in DESIGN-DECISIONS, Step 55C.16R).

- **GPD-13: Grand Prix Detail page-state semantics.** `_PageMessage`
  (`grand_prix_detail_screen.dart`) wraps its `GvPrimerEmptyState` in
  `Semantics(explicitChildNodes: true)`, the NotFound solution (DD NF-6).
  Without it the list item merged the title and the message into the one
  heading and live region ("Grand Prix not found
We couldn't find…").
  Now the title alone is the heading and the page's only live region, the
  message is its own node (neither heading nor live region), and the
  button keeps its label. Section-level states were already separate and
  are unchanged.
- **NF-03: invalid Standings branch re-entry.** `ShellBranchResets` now also
  counts the invalid pages each branch is showing. The invalid-Standings
  `NotFoundScreen` is wrapped in `ShellBranchInvalidPage`, which reports
  itself while it is mounted. It finds its branch through its own navigator
  (`StatefulShellBranch.navigatorKey`), never from a URL or a hard-coded
  index; above the shell it reports nothing. `AppShell._onSelect` opens a
  branch at its initial location when a recovery requested it (NF-02) or
  the branch still shows an invalid page (`shouldReset`). This reuses
  `goBranch(initialLocation: true)`, so there is one shell root and no
  route change. A count, not a flag, because a replacing invalid page
  mounts before the old one is disposed.
- **XS-35: production system bars.** `GvPrimerSystemOverlay`
  (`lib/core/theme/gv_primer_system_overlay.dart`) wraps the app in
  `GridViewApp.builder`, above the router and the environment strip, in
  every environment. `gvPrimerSystemOverlayStyle(roles)` uses existing
  Primer roles only:
  - status bar transparent; icons light on Dark, dark on Light (iOS
    `statusBarBrightness` = the theme);
  - navigation bar `surface.nav` composited over `surface.page` (opaque),
    the colour the Primer bottom navigation renders, with inverse icons;
  - divider and contrast enforcement left to the platform, as before.

  The environment strip no longer sets the legacy style of its own.
  `appBarTheme.systemOverlayStyle` is kept, unused except by the
  development catalogue's `GvAppBar` (SF-19 remainder). Platform notes:
  on Android 14 and earlier with three-button navigation the system draws a
  separate navigation-bar strip in this colour; with gesture navigation the
  strip is thin; where Android 15+ enforces edge-to-edge (target SDK 36) the
  colour is ignored and the app's own surfaces, which already extend into
  the inset, show through. No platform configuration changed. Widget tests
  verify only what the app asks `SystemChrome` for, not device rendering.
- **XS-34: keyboard focus on oversized blocks.** Both traversal groups of
  `PrimerPinnedHeaderLayout` (Standings, Explore) use
  `ReadingOrderTraversalPolicy(requestFocusCallback: revealOversizedFocus)`.
  A target that fits its vertical scroll viewport is handled exactly as
  Flutter's default callback; a taller one is aligned by its top in every
  enclosing scroll view, then moved down by its ring's outward extent
  (`geometry.offset + focusRingWidth`, 4px for the leader card), so the top
  and its ring are visible. The rest is reached by scrolling. Traversal
  order, touch scrolling and every other screen are unchanged. Measured at
  320 @200% (flutter_tester): the Standings leader card top was hidden by
  2.9px (EN) and 38.9px (ES), an Explore circuit row by 58.7px; now 0px,
  with the card at y 239 under a list starting at 235.

Deferred, unchanged: NF-04 (benign stale URI; reopen if router refresh,
`refreshListenable`, state restoration, route observers or analytics, or a
web build are introduced), XS-33 (ambient 0.25px letter spacing), the rest
of SF-19 (MaterialApp, Scaffold, Tooltip and snackbar defaults, the
catalogue, production media placeholders) and SETT-18 (licensing gate).

Tests: `test/screens/grand_prix_detail_primer_test.dart` group
"page-state semantics (GPD-13)" (6),
`test/navigation/nf03_branch_reentry_test.dart` (15),
`test/app/system_overlay_test.dart` (11),
`test/app/oversized_focus_test.dart` (13). The test harness's `TestApp`
installs `GvPrimerSystemOverlay` as `GridViewApp` does.

Device checks still open: TalkBack on the Grand Prix page states;
system-bar rendering on Android 14 or earlier with three-button and gesture
navigation and on Android 15+, in Dark and Light, with a production build;
keyboard, D-pad and switch access on the oversized blocks.

## 7. Tests

Step 55C.14 adds `test/screens/not_found_primer_test.dart` (56 tests,
all through the real router):
- both kinds in both themes: page surface, detail block, icon role,
  inverse pill without hover;
- English and Spanish copy;
- distinct icons;
- semantics: route heading, body heading as the one live region, the
  message as its own node, the decorative icon, the button name;
- recovery by tap, Enter and Space, from every entry, to exactly one Home
  shell with nothing to pop;
- 48dp pill and visible rings, the circular Back ring per theme, keyboard
  order;
- Back absent on root-only entries and present when pushed (app-bar and
  system Back) and on an invalid Grand Prix (returns to Calendar);
- root versus Standings-shell placement;
- the responsive matrix (2 themes x EN/ES x 2 kinds x 390 @100% / 320
  @200%), the shell at 320 @200% and a short viewport that scrolls to the
  pill;
- no legacy presentation widget.

`settings_primer_test.dart` and `settings_information_primer_test.dart`
replace their `GvScreenScaffold` absence checks (scaffold retired).
Step 55C.14F adds `_notFoundGoldens` to `screen_golden_test.dart`: the
four NF-8 goldens, each asserting the screen and its Back state before
capture. The repository now holds 80 golden PNGs.

Step 55C.13B adds `test/screens/settings_information_primer_test.dart`
(71 tests): the gallery scenarios D1-D5 and frame 10 (data modes,
unlocalized capture date, pending season style, tabular numbers, spacing),
I1-I2 and an empty build number, P1-P4 and frame 9 (heading, session order
and dashed rule, live activation changes, policy action and its failure,
static missing-policy row), A1-A2 and frames 1-5 (static announced
skeletons with their size, the Primer notice as a live region, the omitted
section, a failed media read kept loading, media credits as facts),
several sources 40dp apart with supplied notices and an absent terms link,
button roles and meaningful labels of the three links and their recorded
destinations, the Primer snackbar on failure, English language marks on
provider text in Spanish, intact legal strings (no inserted characters),
Enter / Space and the focus ring on a link row, Back with focus
restoration for all four routes, heading semantics, Dark / Light x EN / ES
x 390 @100% / 320 @200% with whole text, no overflow and 48dp targets, the
fact width tier and the pinned S-2 title fallback. Legacy test updates
(finders only): the back-button helpers in `settings_widget_test.dart` and
`settings_navigation_test.dart`, and the production-layout branch of
`environment_badge_layout_test.dart`; `router_harness.dart` gains an
optional `mediaAttributionsStream`. Step 55C.13BR extends the S-2 title
test (full plain text and heading label, no overlap with Back, inside the
viewport, Back 48dp and still popping), ports the five legacy
`GvSettingsRow` accessible-name tests in `settings_widget_test.dart` to
`SettingsNavigationRow` (six tests: title only, description, title and
value, the title-value-description order on `settingsSpokenLabel`, blank
parts, each part spoken once) and replaces the Circuit Detail `GvInfoCard`
absence check with `GvContentCard`. Step 55C.13BR2 replaces the S-2
title pin with an "SF-10R single-word title fallback" group (17 tests):
the fitted English title in Dark and Light (36.6px, one line, `wdth` 62,
within the 13% bound, column width, heading label, Back ring and
navigation), identical Dark / Light layout, nine titles that keep 21px
and their line counts (Spanish single word, 390dp @100% titles, the
multi-word titles at 320dp @200%), the three out-of-bound configurations
wrapping at the approved size, a language change re-fitting the title,
and the helper's guards; the rendering matrix no longer exempts
"Acknowledgements" from the whole-word check.

Step 55C.13A adds `test/screens/settings_primer_test.dart` (47 tests): root
variants (production with and without a contact, non-production status row,
developer catalogue without its icon, mail glyph once), row heights and
spoken names, kicker and title headings, pressed fill; the three choice
screens (one checked radio, no "Selected" suffix, explanation in the label,
selected mark and weight); theme and language applied in place with Back to
the same root; time display reaching an open Grand Prix; failed write with
rollback and the Primer snackbar in a live region (Dark and Light),
per-preference rollback, silent supersession, a failure after a language
rebuild; Enter / Space and one stop per option; focus restoration (keyboard
Back, system Back after a language change, never after touch); Dark / Light x
EN 390 @100% / ES 320 @200% for all four screens with whole text and no
broken word; the selective width axis and the S-2 title fit. Legacy test
updates: finders in `settings_widget_test.dart`,
`settings_navigation_test.dart` and `environment_badge_layout_test.dart`,
plus the radio test's "Selected" assertion, now its absence (SF-6); `router_harness.dart` gains an
optional `preferenceStore`. Step 55C.13AR (SF-20) replaces the per-text
value test with a "compact root rows" group (58 tests in the file): the
tier boundaries against the Chrome measurement, one width and tracking for
every root title and value, line counts equal to Chrome's, whole text,
unabbreviated spoken names, the mark gap and targets at EN / ES 390 @100%,
390 @200%, 360 @175%, 320 @150% and 320 @200%; and unchanged per-label
option typography. Step 55C.13AF extends the time-display propagation
test to Home (the Calendar list shows unconverted dates; its session
times are the Grand Prix route).

Step 55C.12 adds `test/screens/grand_prix_detail_primer_test.dart` (55
tests, 63 with the Step 55C.12R GPD-12 group, plus 2 in
`grand_prix_team_link_test_font_test.dart` (Step 55C.12F, the test font): team-link bounds against the
rendered content per theme at EN 390 @100% and ES 320 @200% (short,
one-letter, long and wrapped names, no re-wrap), ring on the link bounds
2px inside, pointer beside / on the link, Enter and Space on row and link,
unchanged names; the original 55 cover: band chips, round, season, heading semantics and order, GPD-03
fallback, official-name rules, dashed unknowns, fact-rail gates, Graphite
fill in both themes, wide / narrow thresholds; circuit row label,
unresolved name and loop prevention; run-length grouping, delivered order,
repeated days, session chips, PD-06 node order, no invented time, Device /
Event / Both and a midnight crossing, zone visibility, narrow schedule;
winner rules (sprint, tie, unresolved, unavailable), pts unit, timing,
finish and fastest-lap chips, the synthetic full field, Spanish formatting,
results states; the two-resource notice matrix, placement and N-2; loading,
not-found and error announcements; separate driver / team targets, focus
order, 48dp, rings, full-field keyboard reach; the responsive matrix (both
themes x EN/ES x 390 @100% / 320 @200%)). Legacy tests updated only where
they pinned the old presentation: `grand_prix_widget_test.dart` (finders:
band, Primer app bar, session and result row types, "pts"),
`screen_semantics_test.dart` (Grand Prix landmarks; the "Circuit" heading
is now the row kicker), `expired_freshness_notice_test.dart` and
`vertical_slice_widget_test.dart` (Primer row / notice types),
`environment_badge_layout_test.dart` (the Primer app bar is a pinned
header). The six Grand Prix goldens (`grand_prix_detail_loaded`,
`grand_prix_detail_staging_badge_es`, `grand_prix_standard_upcoming`,
`grand_prix_completed_results`, `grand_prix_result_error`,
`light_grand_prix`) were re-baselined on canonical Linux in Step 55C.12F.


Step 55C.11 adds `test/screens/circuit_detail_primer_test.dart` (59 tests,
60 with the Step 55C.11R tick-colour test, 76 with the Step 55C.11C CR-04
group, plus 14 in `test/application/circuit_event_association_test.dart`;
the original 59 cover:
structure per theme, season line in both states and on a historical season,
facts gates, direction glyphs, holder gate and PD-13a style, lap-record
gates, identifier and lap-count absence, Spanish formatting, length
semantics, related navigation with the exact season and round, unnamed
event, chip kinds including the dashed unknown format, seam and disc
geometry, narrow row, refresh scope, season unavailable, deep link,
keyboard, focus rings, N-1 / N-2 notices, skeleton geometry, full-page
states, media absent / pending / failed / photograph, the responsive matrix
(both themes × EN/ES × 390 @100% / 320 @200% × index, long names, media),
`.nobr`, narrow thresholds, reading order, headings, targets and insets).
Legacy tests updated only where they pinned the old Circuit presentation:
`entity_detail_widget_test.dart` (the visible name carries a word joiner;
the length is figure + unit). Expected golden failures before approval:
`circuit_detail_complete`, `circuit_detail_partial`, `light_circuit_detail`
(not regenerated). Windows full suite at Step 55C.11: 2,995 passed, 1
skipped, 6 failed = those three plus the three accepted Windows-only
exceptions (`primary_shell_nav`, `explore_drivers_no_media`,
`explore_teams_media_dark`); `flutter analyze` clean.

Step 55C.11F re-baselines exactly the three Circuit goldens
(`circuit_detail_complete`, `circuit_detail_partial`,
`light_circuit_detail`) in the canonical Linux container
(`ghcr.io/cirruslabs/flutter:3.44.0`, `.fvmrc` 3.44.0) on a
`git ls-files -co --exclude-standard` copy of the tree; the other 73 are
byte-identical to `3c6d527`. The partial golden omits the related section
(its fixture has no materialized calendar, CR-04 C); the complete golden's
related row lies below the 844dp fold with the wide Ahem test font (state A
is covered by the widget tests); the Light golden shows the `line.status`
strokes. Linux (`ghcr.io/cirruslabs/flutter:3.44.0`): golden suite 76/76, a second full regeneration with zero drift, full suite 3,032 passed, 1 skipped, 0 failed, `flutter analyze` clean. Windows: 3,029 passed, 1 skipped, 3 failed (the accepted exceptions `primary_shell_nav`, `explore_drivers_no_media`, `explore_teams_media_dark`), `flutter analyze` clean.

Step 55C.10 adds `test/screens/team_detail_primer_test.dart` (62 tests:
structure, season line, stable name and nationality, missing data, strip,
spec sheet, line-up order, spans, plain and narrow lists, XT-3 boundaries per
theme, Ember contrast, historical Standings → Team → Driver → Standings
navigation, deep link, keyboard, focus rings, N-1 / N-2 notices, skeleton,
full-page states, media, responsive matrix, reading order, headings,
targets, insets and the shared-component aliases). Legacy tests updated only
where they pinned the old layout: `entity_detail_widget_test.dart`
(non-breaking round number), `router_test.dart` (the line-up row is beyond
the 600px fold and the list's cache), `a11y/screen_semantics_test.dart` (new
landmark order). Step 55C.10R/F add
`test/design_system/primer_stat_strip_fit_test.dart` (44 tests) and two
screen-level strip tests (Team on, Driver off; stress figures stack in
both themes at 390 @100% and 320 @200%).

Step 55C.10F re-baselines exactly the two Team goldens
(`team_detail_complete`, `team_detail_partial`) in the canonical Linux
container (`ghcr.io/cirruslabs/flutter:3.44.0`, `.fvmrc` 3.44.0) on a
`git ls-files -co --exclude-standard` copy of the tree; only those two PNGs
differ from HEAD, the other 74 are byte-identical. Linux: golden suite
76/76, a second full regeneration with zero drift, full suite 2,942 passed,
1 skipped, 0 failed. On Windows the three accepted exceptions remain
(`primary_shell_nav`, `explore_drivers_no_media`,
`explore_teams_media_dark`); tolerance unchanged.

Step 55C.8 re-baselines the 12 goldens changed by the approved Explore
migration: four screen goldens (`explore_drivers_populated`,
`explore_teams_populated`, `explore_circuits_populated`, `explore_empty`),
two Light goldens (`light_explore`, `light_explore_first_load`) and six media
goldens (`explore_drivers_media_dark`, `explore_drivers_no_media`,
`explore_drivers_media_failed`, `explore_teams_media_dark`,
`explore_circuits_media_dark`, `explore_drivers_media_light`), rendered on
the canonical Linux platform (Flutter 3.44.0 container). The media goldens
record the EF-3 policy with fixture images only (no column without a media
reference; the uniform 40dp slot otherwise); they authorize no real media.
The other 64 baselines are byte-unchanged and a second regeneration produced
zero drift. The same Ahem limitation applies; content, wording and semantics
are pinned by the Explore widget, Primer, media and accessibility tests.
On Windows, two of these Linux baselines exceed the 2% local tolerance by
font anti-aliasing edge drift only (no layout change), as `primary_shell_nav`
does: `explore_drivers_no_media` 2.18% and `explore_teams_media_dark` 2.26%.
They pass on Linux. The owner accepted them (Step 55C.8) as Windows-only
text-rasterization exceptions, alongside the earlier `primary_shell_nav`
exception (2.43%); the tolerance stays at 2%, the baselines are unchanged and
the tests are not disabled. Canonical verification is the local Linux
container run (76/76 goldens), not a GitHub Actions run.

Step 55C.6 re-baselines the nine goldens changed by the approved Standings
migration (`standings_loading`, `standings_drivers_populated`,
`standings_constructors_populated`, `standings_fractional_tied`,
`standings_empty`, `standings_stale`, `standings_refresh_failure`,
`light_standings`, `light_standings_stale`), rendered on the canonical Linux
platform (Flutter 3.44.0 container); the other 67 baselines are
byte-unchanged and a second regeneration produced zero drift. The same Ahem
limitation applies; content, wording and semantics are pinned by the
Standings widget, Primer and accessibility tests.

Step 55C.4 re-baselines the 15 goldens changed by the approved Home and
Calendar migrations: 10 Home (`home_pre_event`, `home_race_weekend`,
`home_post_race`, `home_season_empty`, `home_partial`, `home_season_finale`,
`home_cached_stale`, `home_tied_leaders`, `home_large_text_narrow`,
`light_home`), the shell golden `primary_shell_nav`, and 4 Calendar
(`calendar_empty`, `calendar_populated`, `calendar_stale`, `light_calendar`).
They were rendered on the canonical Linux platform (Flutter 3.44.0, the
command in `render-canonical-goldens.yml`), and the other 61 baselines are
byte-unchanged. Golden tests use the Ahem test font, so text renders as blocks
and Material Icons glyphs render as hollow squares: the legacy navigation icons,
the app-bar refresh and settings icons, and the empty-state icon. Primer painted
glyphs render normally. This is a test-rendering limitation, not the production
design. Content, wording and semantics are pinned by the Home and Calendar
widget, layout and semantics tests.

Step 55B.4 adds `primer_shared_test.dart` (section title size, cap,
header and surface colour; notice icons, roles, live region, contrast and
wrapping; fact semantics, auto-fit columns and stacking; both stat-strip seam
geometries, narrow layout, sizes, units and semantics; team-mark geometry,
runtime boundary on page and band in both themes, rendered 1px edge; disc,
button and link row roles, targets, keyboard, ring, hover and pressed; empty
state sizes, LT-16 skeleton colours, loading announcement; every catalogue
specimen unclipped with ≥ 48×48 targets at 390 @100% and 320 @200%).

Step 55B.3 adds `primer_rows_test.dart` (winner, finish chips, missing
data, fallbacks, keyboard order and primary-focus rings, activation, pressed
and nested press, semantics, crossing rings, narrow layouts and the trailing
chevron; leader scope, seam, ring, unranked, tied, provisional, unbroken
details, hover; completed at 100%, status vocabulary, next-event block and
ring, a rendered ring probe, number column and hairlines; every specimen
unclipped with ≥ 48×48 targets at 390 @100% and 320 @200% in both themes).

Step 55B.2.1 adds `primer_nav_focus_test.dart` (ring geometry, 100% ring
visibility and ≥ 3:1 adjacent contrast over 48 renders, the superseded
ring's loss, slab clearance, targets and semantics; measured heights; focus
scrolling above the 2 × 2 bar; icon sizes at 100 / 150 / 200 / 300% and under
a non-linear scaler, rendered size and centring; glyph shapes and use).

Step 55B.2 adds `primer_navigation_test.dart` (cut geometry and angle at
every height, rounded and one-edge cuts; selector semantics, keyboard,
slab, weights, focus colours, rendered ring and backing above the slab tip,
fit modes, targets, decorative hit area; navigation order, semantics, roles,
safe area, keyboard, fit modes, targets, ring versus the screen edge, focus
scrolling, outer shadow; icon-scale sizes, centring, semantics, two-line
labels).

Step 55B.1 adds `primer_typography_test.dart` (asset declaration and size,
style construction, real-font weight and width metrics, no synthetic bold,
Spanish glyph coverage, catalogue specimens, licence registration and its
bootstrap call) and `primer_components_test.dart` (surface resolution in every
context, chip outlines, icons, fills, nested contexts, semantics, 100% and
200% wrapping, dash fitting and rendering, focus visibility, activation,
size, semantics, colour by surface, backing, geometry, paint order, reduced
motion, disabled targets, catalogue rendering). Step 55A tests:

- `test/design_system/primer_roles_test.dart`: the 15 primitives exactly;
  contextual and superseded values excluded; Dark and Light values against
  token-map literals; every contextual role is a primitive at its exact alpha;
  outline patterns; focus rules and metrics; computed ratios (text ≥ 4.5,
  solid status ≥ 3 with dashed stronger, labels on fills ≥ 4.5, rings ≥ 3,
  spot values 15.19 / 15.45 / 5.52 / 3.96 / 3.86 / 5.43, the recorded Dark slab
  limit 2.47); scopes; component roles; team boundary with the XT-3 colours;
  brand gradients, band lighting and the CSS angle transform; lerp.
- `test/design_system/primer_theme_integration_test.dart`: both builders
  install the extension next to the unchanged legacy extensions; literal
  legacy `ThemeData` values pinned for both themes; preference pinning and
  `ThemeMode.system` in the real app; `context.gvPrimer` fallback.

## 8. Compatibility limitations

> **Current state (2026-11-22).** The migration is complete. The first and
> the last two bullets below were written during it: the legacy palette now
> survives only in the Material layer and the catalogue (SF-19 remainder);
> `primary_shell_nav.png` was re-baselined with the Primer navigation shell in
> Step 55C.15F and is no longer temporary; its Windows rasterization exception
> is still accepted, together with `explore_drivers_no_media` and
> `explore_teams_media_dark` (current figures in
> [`../testing/README.md`](../testing/README.md) "Canonical goldens
> (Primer V2)").

- Two palettes coexist until the migration completes; widgets must not mix
  them inside one component.
- `forScope()` returns shared instances; a scope nested in a scope is not
  specified.
- Ratios are computed WCAG values with alpha composited in sRGB, not device
  measurements; Android, TalkBack and device validation stay open (XS-02,
  XS-05, XS-16).
- `primary_shell_nav.png` is a **temporary baseline**. It captures the migrated
  Home inside the legacy `GvBottomNav` shell, which stays until the Primer V2
  navigation shell is integrated (`GvPrimerBottomNav` exists but is not wired
  into the app shell). In the test renderer, the legacy bar's labels show as
  grey Ahem blocks and its icons as hollow squares. This is a known
  test-rendering limitation, not the intended production design. Re-render the
  baseline when the shell migrates.
- `primary_shell_nav` captures a text-dense Home at 1×. Windows and Linux font
  rasterization differ by 2.43% on it, above the 2% tolerance, so it fails on a
  Windows developer machine and passes on the canonical Linux renderer (CI).
  The other 14 re-baselined goldens pass on both platforms.
