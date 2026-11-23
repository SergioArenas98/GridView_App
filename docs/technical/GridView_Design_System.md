# GridView - Design System

## Document information

- Product: GridView
- Document type: Design System (implementation), **primary entry point**
- Status: **Primer V2 is implemented on every production screen, in Dark and
  Light** (completed 2026-11-22, Step 55C.16R). This document describes the
  system as it ships and links to the detailed records instead of repeating
  them.
- Detailed documents:
  - [GridView_Primer_V2_Theme_Foundation.md](GridView_Primer_V2_Theme_Foundation.md):
    the per-screen implementation record (contracts, decisions, exceptions,
    tests), in the order the migration happened.
  - [GridView_Accessibility.md](GridView_Accessibility.md): accessibility
    evidence levels, the Primer V2 contracts (§2a) and known limitations.
  - [GridView_Navigation.md](GridView_Navigation.md): shell, routes, branch
    restoration and recovery.
  - [`../testing/README.md`](../testing/README.md) "Canonical goldens
    (Primer V2)": golden suites and the regeneration procedure.
  - [GridView_Media.md](GridView_Media.md): remote media architecture.
- Design record (authoritative for design intent):
  [`design-exploration/prototypes/primer-v2/`](../../design-exploration/prototypes/primer-v2/README.md),
  in particular
  [`DESIGN-DECISIONS.md`](../../design-exploration/prototypes/primer-v2/DESIGN-DECISIONS.md)
  (decision IDs cited in code comments, such as LT-, XT-, XS-, VS-, N-),
  [`DESIGN-BACKLOG.md`](../../design-exploration/prototypes/primer-v2/DESIGN-BACKLOG.md)
  (open and deferred work),
  [`CROSS-THEME-CONSOLIDATION.md`](../../design-exploration/prototypes/primer-v2/CROSS-THEME-CONSOLIDATION.md)
  and
  [`CROSS-THEME-TOKEN-MAP.md`](../../design-exploration/prototypes/primer-v2/CROSS-THEME-TOKEN-MAP.md)
  (the frozen cross-theme specification).
- Superseded: the pre-Primer visual direction in
  `../product/GridView_UI_UX_Design.md` (palette, Sora/Inter pairing) is
  historical; it is not the source of truth for tokens any more.
- Document date: 2026-11-22

---

## 1. Primer V2 principles

Primer V2 ("Motorsport Editorial") is the approved visual system. Its rules,
which every screen follows:

- **One signature move: the 12° livery cut.** A single diagonal, the CSS
  `skewX(-12deg)` of the prototypes, marks the GridView identity at several
  scales: the selected navigation slab, the segmented-control slab, the round
  block and the winner and leader seams. It is one primitive
  (`GvLiveryCut`), never redrawn per screen (XS-27).
- **One typeface, the width axis as hierarchy.** Archivo throughout. Figures
  are expanded and tabular; names are condensed; labels and body text run at
  normal width, in sentence case, never in tracked capitals (§4).
- **Meaning by word and shape, never by hue alone.** Status is a word plus an
  outline pattern: solid for a known state, dashed for an unknown value,
  filled for Final and Live (VS-1 to VS-7). Colour adds emphasis; it is never
  the only carrier.
- **Two themes, one component set.** Dark (graphite, chalk, red oxide, ember)
  and Light (the approved "B Motorsport" direction) share every component and
  geometry; only roles differ (XT-1 to XT-6).
- **Data fidelity.** A screen shows only values the data supplies. A missing
  value is omitted or shown as an explicit unknown; it never becomes a zero,
  a guessed name or an invented count. Team colours are decorative accents
  with a contrast boundary where needed (XT-3).
- **Accessible by construction.** 48dp targets, visible focus rings,
  heading and live-region semantics, and layouts that stay usable at 320dp
  and 200% text (§8).

## 2. Where things live

```text
lib/core/theme/
├── tokens/
│   ├── gv_primer_palette.dart     the 15 Primer primitives (never read by widgets)
│   ├── gv_primer_typography.dart  Archivo style builder
│   ├── gv_primer_layout.dart      gutter 16, radii 8/14/20, 48dp target, rem helpers
│   ├── gv_primer_metrics.dart     outline, ring, backing and focus offsets
│   └── gv_colors*.dart, gv_spacing.dart, ...   legacy tokens (Material layer, catalogue)
├── gv_primer_roles.dart           GvPrimerRoles ThemeExtension (+ context.gvPrimer)
├── gv_primer_role_groups.dart     surface / text / fill / line / state / focus groups
├── gv_primer_components.dart      component roles (nav, selector, chip, notice, ...)
├── gv_primer_effects.dart         brand gradients, Dark band lighting
├── gv_primer_surface.dart         GvPrimerSurface: page, inverse, graphite band, brand
├── gv_primer_system_overlay.dart  status and navigation bar style (XS-35)
├── gv_font_licenses.dart          Archivo OFL registration
├── gridview_theme.dart            buildGridViewDarkTheme() / buildGridViewLightTheme()
└── gv_semantic_colors.dart, gv_text_styles.dart   legacy extensions
lib/core/widgets/gv_primer_*.dart  shared Primer components (§6)
lib/core/widgets/gv_*.dart         legacy components: catalogue only, plus GvRemoteImage
lib/features/shared/presentation/widgets/primer_*.dart   detail-page and pinned-header parts
lib/features/dev/catalogue/        development-only component catalogue
```

## 3. Themes: Dark and Light

- `buildGridViewDarkTheme()` and `buildGridViewLightTheme()` (one builder in
  `gridview_theme.dart`) install the `GvPrimerRoles` extension with the frozen
  Dark and Light roles. Widgets read them through `context.gvPrimer`.
- The theme is a persisted user preference (System, Light, Dark), resolved by
  `MaterialApp.router` as before; see
  [GridView_Preferences_And_Settings.md](GridView_Preferences_And_Settings.md) §3.
- `GvPrimerSystemOverlay` wraps the app in `GridViewApp.builder` and sets the
  system bars from Primer roles: transparent status bar with theme-matched
  icons, navigation bar in the colour of the Primer bottom navigation
  (Theme Foundation §6r, XS-35).
- **The legacy Material layer still exists** (`ColorScheme`, `TextTheme` and
  component themes built from `GvSemanticColors` / `GvTextStyles`). No
  production screen draws with it any more, but `MaterialApp`, `Scaffold`,
  tooltip and snackbar defaults, the ambient text style (XS-33) and the
  development catalogue still depend on it. Retiring it would change approved
  rendering, so it stays until a dedicated step (SF-19 remainder). New code
  must not read `context.gvColors` or legacy tokens for Primer surfaces.

## 4. Typography: Archivo

- Archivo 2.001, one variable file (`assets/fonts/archivo/Archivo-Variable.ttf`,
  `wght` 100–900, `wdth` 62–125), bundled under the SIL Open Font License 1.1.
  Provenance and checksums: `assets/fonts/archivo/README.md`; the licence is
  registered with `LicenseRegistry` at startup (`gv_font_licenses.dart`).
- Styles come from `GvPrimerTypography.archivo(size, weight, width, ...)`.
  Styles carry the nearest standard `FontWeight` and add an explicit `wght`
  variation only for intermediate weights (650, 750, 820, 830, 850); for those,
  the platform bold-text setting cannot raise the weight.
- Width is part of the hierarchy: expanded tabular figures (round, points,
  times), condensed names, normal-width labels. Long titles and labels use
  measured fits (`GvPrimerFit`: regular, then condensed, then stacked) rather
  than truncation.
- The legacy Sora/Inter pairing was never bundled and is not used.
- Tests that measure real layout load Archivo (`test/support/primer_fonts.dart`);
  golden tests deliberately keep the Ahem test font (§10).

Details: Theme Foundation §6.

## 5. Colour and surface roles

The cross-theme token map is implemented in five layers (Theme Foundation §2
and §3):

| Layer | Flutter |
|---|---|
| Raw values (15 primitives) | `GvPrimerPalette`, private to the role builders |
| Semantic roles | `GvPrimerRoles.surface` / `.text` / `.fill` |
| Contextual alpha, boundary, focus | `.line`, `.state`, `.focus`, `.teamEdgeFor()` |
| Component roles | `.nav`, `.selector`, `.statusChip`, `.notice`, `.action`, `.skeleton` |
| Decorative effects | `GvPrimerEffects` (brand gradients, Dark band lighting) |

- **Surfaces.** `surface.page`, `band`, `raised`, `nav`, the inverse plane
  and (Light only) `card`. A subtree that sits on a different plane declares
  it with `GvPrimerSurface(kind: page | inverse | graphiteBand | brand)`;
  components read foreground, outline and focus colours from
  `GvPrimerSurface.of(context)` so they adapt to the plane they are on.
- **No new colours.** Every contextual value is a primitive at an exact alpha;
  `test/design_system/primer_roles_test.dart` proves it against the token map.
- **Team colours** are applied only through `teamEdgeFor` / `GvTeamAccent`,
  with a 1px boundary where the colour is below 3:1 against its surface (XT-3).
- The legacy blue `accentSecondary`, `success`, `warning`, `info`, `stale`
  and `tertiary` roles have no Primer counterpart; Primer carries status by
  outline and word.

## 6. Component architecture

Shared components are **data-agnostic**: they take formatted strings, kinds,
slots and callbacks. They never import DTOs, domain entities, repositories,
Riverpod or Drift; feature code maps its own state onto their inputs (for
example a domain status onto a `GvPrimerChipKind`).

| Family | Components (`lib/core/widgets/`) |
|---|---|
| Geometry and fit | `GvLiveryCut`, `GvPrimerFit`, `GvPrimerOutlinePainter` (solid and dashed) |
| Focus | `GvPrimerFocusTarget`, `GvPrimerFocusRing`, `GvPrimerFocusGeometry` |
| Status | `GvPrimerStatusChip` (`GvPrimerChipKind`, two sizes), `GvPrimerRowStatuses`, `GvPrimerNotice` |
| Navigation and selection | `GvPrimerBottomNav` (`GvPrimerNavItem`), `GvPrimerSegmentedControl` |
| Editorial rows | `GvPrimerRaceRow`, `GvPrimerResultRow`, `GvPrimerStandingsRow`, row parts (chevron, divider, status label) |
| Facts and figures | `GvPrimerFact`, `GvPrimerFactGrid`, `GvPrimerStat`, `GvPrimerStatStrip` |
| Headings and actions | `GvPrimerSectionTitle`, `GvPrimerButton`, `GvPrimerLinkRow`, `GvPrimerArrowDisc` |
| States | `GvPrimerEmptyState`, `GvPrimerSkeleton`, `GvPrimerLoading` |
| Identity | `GvPrimerTeamMark`, `GvPrimerIcon` / `GvPrimerGlyph` |
| Media | `GvRemoteImage` with `GvImagePlaceholder` (§13) |

Feature-level shared parts (`lib/features/shared/presentation/widgets/`):
`PrimerDetailAppBar` and `PrimerDetailBackButton` (the pinned detail header),
`PrimerDetailNotices`, `PrimerDetailMessage` / `PrimerDetailSkeleton` (full-page
states), `PrimerDetailAbout` and `PrimerPinnedHeaderLayout` (§7).

Per-component contracts (sizes, semantics, rings, wrapping) are in Theme
Foundation §6a–§6e.

### When a new shared component is justified

Add one only when a visual pattern is reused across features and benefits from
a single accessible implementation. Prefer composing the existing components;
a one-off layout stays in its feature.

## 7. Navigation, layout and responsive behaviour

- **Bottom navigation.** `AppShell` uses `GvPrimerBottomNav` as
  `Scaffold.bottomNavigationBar`, so content always ends above it. Four
  destinations (Home, Calendar, Standings, Explore), icon above a full label,
  the selected tab on a 60×32 oxide slab with bold label and `selected`
  semantics. Height 68dp plus the system inset. The bar picks one row, a
  condensed row or a 2 × 2 grid from measured label widths; at 320dp @200%
  it is 2 × 2 (155dp, owner-approved D1). Standings and Explore use a narrower
  selected-label fallback (GI-2). Routing behaviour is in
  [GridView_Navigation.md](GridView_Navigation.md) §1.
- **Pinned headers.** Detail screens (Grand Prix, Driver, Team, Circuit) and
  NotFound pin a `PrimerDetailAppBar`; the Settings screens pin a
  `SettingsAppBar` built on the same `PrimerDetailBackButton`.
  Standings and Explore pin title, season and selector through
  `PrimerPinnedHeaderLayout`: the header stays pinned while it leaves the list
  at least 96dp (two targets); on a shorter viewport the whole page scrolls so
  content stays reachable (GI-10). Status captions and notices scroll with the
  content instead of being pinned (SF-1). Calendar pins its title and season
  and places the list once per branch session (N-6, Theme Foundation §6f).
- **Gutters and widths.** 16dp screen gutter (`GvPrimerLayout.gutter`).
  Prototype `rem` lengths scale with the text scaler and are capped where the
  specification says `min(<rem>, <px>)`; lists switch to a narrow layout at
  their measured container width, not at a fixed device breakpoint.
- **Large text.** Every screen is verified at 390dp @100% and 320dp @200%
  in both themes and both languages. Where a block is taller than the space
  between the pinned header and the navigation, it is reachable line by line
  (`test/support/reachability.dart`), and keyboard focus reveals its top
  (XS-34).

## 8. Accessibility and focus contracts

Summary; the evidence and limitations are in
[GridView_Accessibility.md](GridView_Accessibility.md) §2a and §4.

- Every interactive element has a hit area of at least 48 × 48dp
  (`GvPrimerLayout.minTarget`), even when the visible control is smaller.
- Focus is shown by a 2px ring painted above the element, never clipped, in
  the colour defined per surface (Ember on Dark page, Graphite on Light page,
  Chalk on oxide; a 5px backing band in Light where the ring crosses a
  surface edge). Geometry per component is in `GvPrimerFocusGeometry`.
- Enter and Space activate every focus target; traversal follows reading
  order, with the pinned header and the list as separate traversal groups.
- Screen and section titles are headings; one live region per page state
  (loading, error, notice), never merged with the message below it.
- Status words are always present; outlines and colour never carry meaning
  alone. Computed contrast: text ≥ 4.5:1, labels on fills ≥ 4.5:1, focus rings
  and solid status outlines ≥ 3:1. Recorded exception: the Dark segmented
  slab against its container is 2.47:1, accepted as a limit with the bold
  label and selected semantics carrying the state.
- These are Flutter-semantics (Level 1) results from `flutter_tester`.
  TalkBack, Switch Access and physical-device validation of Primer V2 have not
  been performed.

## 9. Implementing a new screen

1. Start from the design record: find the approved prototype and the
   decisions for the screen in `DESIGN-DECISIONS.md`, and the open items in
   `DESIGN-BACKLOG.md`. If there is no approved design, get one approved
   first; do not improvise a new visual pattern.
2. Build from the shared components (§6) and roles (§5). Read colours only
   through `context.gvPrimer` or `GvPrimerSurface.of(context)`; never through
   legacy tokens or literals.
3. Use `PrimerDetailAppBar` for a detail page or `PrimerPinnedHeaderLayout`
   for a pinned title with a scrolling list; put status captions and notices
   in the scrolling content.
4. Keep the screen data-agnostic at the widget boundary and respect data
   fidelity: omit or mark unknown values, never invent them.
5. Add every user-visible string to both ARB files (English and Spanish).
6. Test: semantics (headings, live regions, labels), 48dp targets, focus
   rings and keyboard activation, Dark and Light × EN and ES × 390dp @100% and
   320dp @200% with no overflow or broken words, short viewports, and
   real-font layout with Archivo where measurement matters.
7. Add or update canonical goldens only on Linux through the procedure in
   [`../testing/README.md`](../testing/README.md), and record the screen's
   contracts and decisions in the Theme Foundation record and, for design
   decisions, in `DESIGN-DECISIONS.md`.

## 10. Golden tests and review captures

- **Canonical goldens:** 90 PNG baselines from six suites, rendered on Linux
  with Flutter 3.44.0 and the Ahem test font, checked by a zero-drift
  freshness job in CI. Ahem draws every glyph as a square, so goldens pin
  layout, colour and geometry, not real typography; for example every shell
  golden shows the 2 × 2 navigation. Procedure, suites and the accepted
  Windows exceptions: [`../testing/README.md`](../testing/README.md).
- **Review captures** (not goldens, not committed): the
  `tool/primer_review/` scripts render the approved HTML prototypes with
  headless Chrome (`capture_*_refs.mjs`) and the Flutter screens with Archivo
  (`capture_*_test.dart`) into `build/primer-review/`, for side-by-side visual
  review. They read the prototypes under
  `design-exploration/prototypes/primer-v2/cross-screen-refinement/`.

## 11. Known limitations and deferred issues

The backlog
([`DESIGN-BACKLOG.md`](../../design-exploration/prototypes/primer-v2/DESIGN-BACKLOG.md))
is the authoritative list. The ones that matter most when working on the UI:

- **Device validation not done:** TalkBack and screen-reader behaviour
  (XS-02), real Android font scaling (XS-05), device rendering, safe areas and
  scrolling (XS-16), system-bar rendering on Android 14 and 15+, and keyboard,
  D-pad and Switch Access on real hardware. All Primer V2 evidence is
  `flutter_tester` and Chrome emulation.
- **Legacy Material layer kept** (SF-19 remainder, §3), including the ambient
  0.25px letter spacing on Primer text (XS-33).
- **NF-04:** a stale router URI after an invalid Grand Prix recovery; benign
  today, with recorded reopen conditions (router refresh, state restoration,
  route observers, web).
- **Goldens use Ahem** (GI-9, D2): real typography is covered by Archivo
  layout tests and review captures, not by goldens.
- **Data licensing (SETT-18):** commercial-use compatibility of the CC BY-NC-SA
  4.0 data credit is unresolved; GridView stays free and unmonetised while it
  relies on non-commercial sources (ADR 0019 C2–C4).

## 12. Legacy components and the development catalogue

The pre-Primer components (`GvAppBar`, buttons, cards, `GvSectionHeader`,
`GvSegmentedControl`, rows, skeleton blocks, states, `GvStatusChip`,
`GvAdContainer`) are no longer used by any production screen. They remain for
the development catalogue and are covered by five design-system goldens.
`GvBottomNav`, the screen and entity-detail scaffolds, the old Calendar and
Grand Prix widgets and the Settings rows were removed. The Phase 7 refinements
to the legacy rows are recorded in this document's Git history.

`ComponentCatalogueScreen` is a development-only gallery of every component
and its states (legacy and Primer, Dark and Light, long text, large text,
narrow width). It is **unreachable in production**: `open()` refuses to
navigate in production, and only non-production builds show its entry
(Settings → Developer → Component catalogue).

`GvAdContainer` is catalogue-only. Advertising is not retained for v1
([ADR 0018](../adr/0018-advertising-not-retained-for-v1.md)): no advertising
or consent SDK is packaged and no production route constructs it.

## 13. Media policy

`GvImagePlaceholder` is the fallback for every no-image state. `GvRemoteImage`
renders remote imagery. It takes **primitives only**: a validated URL, a cache
identity, a size, a placeholder icon, an optional label. It knows nothing about
`Driver`, `Constructor`, `Circuit`, `GrandPrix`, `MediaAsset`, a repository, a
Riverpod `Ref`, a Drift row or a DTO. Choosing *which* image belongs in a slot
happens before the widget is built, in a pure selector.

- Every hero and every row leading slot reserves its aspect ratio from the first
  frame, so content never shifts when bytes arrive or fail to.
- No media, loading, a rejected URL, a network failure, an HTTP failure, a decode
  failure and a missing loader all resolve to the **same placeholder at the same
  size**. There is no broken-image icon, no error text, no exception, no URL and
  no identifier on screen.
- A failure never produces a page-level error and never touches the surrounding
  text or navigation.
- A subtree with no `MediaLoaderScope` renders placeholders and requests nothing,
  so no widget test can reach the network by accident.
- No production asset URL is hardcoded, and no logo, portrait or circuit outline
  is bundled.
- Accessibility is decided slot by slot: an image beside text that already names
  its subject is decorative, while a circuit layout diagram is informative.
- Missing media never removes core text content.
- Media attribution and licence notices are shown in Settings →
  Acknowledgements; their wording and the provider restrictions are unchanged
  by Primer V2.

Full architecture: [GridView_Media.md](GridView_Media.md).

## 14. Rules

- No raw colour, spacing or radius literals in widgets: use Primer roles and
  `GvPrimerLayout` / `GvPrimerMetrics`.
- No API, DTO, repository or controller imports in `lib/core/theme` or
  `lib/core/widgets`.
- No ad, Firebase, Worker, Drift or provider dependency in design-system code.
- Never mix legacy and Primer roles inside one component.
- The production `applicationId` (`com.sejuma.gridview`) and Android signing
  are never changed by design-system work.
