# GridView - Design System

## Document information

- Product: GridView
- Document type: Design System (implementation)
- Status: Phase 3A
- Related documents:
  - `../product/GridView_UI_UX_Design.md` (source of truth for palette, type
    scale, radius and spacing)
  - `GridView_TRD.md` (sections 27-28: theming and accessibility)
- Document date: 2026-07-19

---

## 1. Scope

Phase 3A implements the reusable visual foundation only: design tokens,
typography, the dark-first theme, and data-agnostic shared components, plus a
development-only component catalogue. No feature screens, navigation, data, Drift,
Worker calls, Firebase, ads or remote images are part of this phase.

## 2. Layout

```text
lib/core/theme/
├── tokens/            strongly-typed design tokens
│   ├── gv_colors.dart, gv_spacing.dart, gv_radii.dart, gv_elevation.dart
│   ├── gv_icon_sizes.dart, gv_motion.dart, gv_layout.dart, gv_typography.dart
│   └── tokens.dart    (barrel)
├── gv_semantic_colors.dart   ThemeExtension for semantic colours (+ context.gvColors)
├── gv_team_accent.dart       contrast-safe team-accent foreground helper
├── gridview_theme.dart       buildGridViewDarkTheme()
└── theme.dart                (barrel)
lib/core/widgets/     shared, data-agnostic components (+ widgets.dart barrel)
lib/features/dev/catalogue/   development-only component catalogue
```

## 3. Tokens

All colour, spacing, radius, elevation, icon-size, motion and layout values come
from `lib/core/theme/tokens`. **Do not hard-code raw colour, spacing or radius
literals in widgets** — read them from a token class or the theme.

- `GvColors` — backgrounds, neutrals/text, red primary and blue secondary
  accents, semantic success/warning, tertiary. Source: UI/UX section 7.
- `GvSpacing` — 4/8/12/16/20/24/32/40.
- `GvRadii` — 8/12/20/28 and pill; plus ready-made `BorderRadius` constants.
- `GvElevation` — subtle shadows and a tonal-surface helper (dark surfaces prefer
  tonal layering over heavy shadows).
- `GvIconSizes`, `GvMotion` (durations + curves), `GvLayout` (screen padding,
  max content width).

Semantic colours that do not fit Material's `ColorScheme` (success, warning,
info, stale, extra surfaces) live in the `GvSemanticColors` theme extension,
reached via `context.gvColors`.

## 4. Typography

Hierarchy (UI/UX section 8): `displayXl`, `displayL`, `pageTitle`, `sectionTitle`,
`cardTitle`, `bodyL`, `bodyM`, `label`, `caption`, and `statValue` (tabular
figures for numbers). The approved pairing is **Sora** (headings) + **Inter**
(body/UI).

**Font assets are not yet in the repository.** The licensed Sora/Inter TTFs must
be sourced before bundling; until then `GvFonts.heading`/`GvFonts.body` are
`null` and text falls back to the platform font. To add them later: place the
licensed TTFs under `assets/fonts/`, declare them in `pubspec.yaml`, and set
`GvFonts.heading = 'Sora'` / `GvFonts.body = 'Inter'`. Do not commit unverified
font files. The legacy Formula 1 fonts must not be used.

## 5. Theme

`buildGridViewDarkTheme()` is a dark-first Material 3 theme built from the tokens:
colour scheme, text theme, system status/navigation-bar styling, and component
themes for the common Material controls (app bar, card, chip, elevated/outlined/
icon buttons, dividers). A full light theme is intentionally deferred; the token
and extension architecture supports adding one later without touching component
code.

Team colours are decorative and may fail contrast, so they are applied only as
accents through `GvTeamAccent.foregroundOn(...)`, never as the sole carrier of
meaning.

## 6. Components

Shared components (in `lib/core/widgets`) are reusable and **data-agnostic**: they
accept simple presentation values, colours, slots and callbacks. They **must not
import API DTOs, domain entities, repositories or feature controllers.** Feature
code maps its own state onto simple inputs (for example, a domain `EventStatus`
onto a `GvStatusTone`).

Implemented: `GvAppBar`, `GvSectionHeader`, `GvBottomNav`, `GvPrimaryButton`,
`GvSecondaryButton`, `GvIconButton`, `GvSegmentedControl`, `GvStatusChip`,
`GvHeroCard`, `GvContentCard`, `GvDataCard`, `GvSessionRow`, `GvStandingsRow`,
`GvDriverRow`, `GvTeamRow`, `GvCircuitRow`, `GvResultRow`, `GvSkeletonBlock`,
`GvSkeletonCard`, `GvEmptyState`, `GvErrorState`, `GvOfflineNotice`,
`GvImagePlaceholder`, `GvAdContainer` (reserved space only — **no** ad
initialization).

### When a new shared component is justified

Add a shared component only when a visual pattern is reused across features and
benefits from a single accessible implementation. A one-off screen layout does
not need to become a shared component. Prefer composing existing components.

## 7. Accessibility

Every component follows the baseline (UI/UX section 18, TRD section 28):

- Semantics on important controls; icon-only buttons carry a label.
- Interactive touch targets are at least 48 logical px (`GvLayout.minTouchTarget`);
  the visible icon or control may be smaller, but the hit area is not. Buttons,
  icon buttons, segmented controls, bottom-nav destinations and tappable cards
  all enforce this minimum.
- Information is never conveyed by colour alone (status chips pair a dot with a
  text label; selected states also change weight and expose a selected flag).
- No fixed heights that clip scaled text; rows use `minHeight` and ellipsis.
- Reduced-motion is respected (skeletons render static when animations are
  disabled).

## 8. Development component catalogue

`ComponentCatalogueScreen` is a development-only gallery of every component and
its states, including long English/Spanish text, large text scaling, team accents
and narrow-phone width. It is **unreachable in production**: `open()` refuses to
navigate when the environment is production, and only non-production builds show
its entry point.

Open it: run a dev or staging build and tap **Settings → Developer → Component
catalogue**. (Before Phase 3B the entry lived on the placeholder shell home
screen; it moved to Settings when the navigation shell landed.)

Navigation, routing and the screen skeletons that consume these components are
documented in `GridView_Navigation.md`.

## 8b. Phase 7A component changes

Three data-agnostic refinements were made while wiring the Calendar and Grand
Prix features. None of them knows about a domain entity, a repository, Riverpod
or Drift; feature widgets map their own state into primitive inputs.

- **`gvToneColor(context, tone)`** was extracted from `GvStatusChip` so a chip, a
  row accent and any other status affordance resolve the same semantic colour.
  The chip's rendering is unchanged.
- **`GvSessionRow.tone`** now actually renders: a non-neutral tone adds a
  restrained accent bar. Feature code deliberately reserves it for the states a
  reader must not miss (live, cancelled, postponed) — colouring every scheduled
  or completed row would be noise. The textual status label is always present,
  so meaning is never carried by colour alone.
- **`GvResultRow`** gained optional `statusLabel`, `badgeLabel`, `score`,
  `semanticLabel`, `onTeamTap` and `teamSemanticLabel`. Every value is optional
  and purely presentational: anything the caller omits is not rendered, so a
  missing value never becomes a false zero. The primary action and the secondary
  (team) action occupy **separate, stacked** hit areas, each at least
  `GvLayout.minTouchTarget` tall and each exposing its own button semantics — no
  nested competing tap regions. `semanticLabel` replaces the row's merged child
  semantics with one explicit label so a screen reader announces position,
  driver, team, status and score in a useful order.

A row's trailing slot is now capped at a fraction of the row width. A `Row`
gives a non-flex child unbounded width, which turned a long value (a race time
at a large text scale) into an overflow instead of a wrap; capping it keeps the
title readable and lets the value wrap.

The component catalogue examples and the design-system tests were updated with
these components.

## 8c. Phase 7B component changes

Two data-agnostic refinements were made while wiring the Standings feature. Both
stay primitive: `GvStandingsRow` still takes only already-formatted strings and
knows nothing about drivers, constructors, repositories, Riverpod, Drift or DTOs,
and both championship tables use the same component.

- **`GvStandingsRow`** gained optional `stat`, `badgeLabel` and `semanticLabel`.
  `stat` and `badgeLabel` join the existing `team` on the row's secondary line
  with the shared ` · ` separator; anything the caller omits is simply not
  rendered, so a missing team leaves no dangling separator and a missing
  statistic never becomes a false zero. `semanticLabel` replaces the row's merged
  child semantics with one explicit label, so a screen reader announces position,
  name, team, points, statistics and status (leader, tied leader, provisional) in
  a useful order — leader emphasis therefore has a semantic equivalent and is
  never carried by colour or elevation alone.
- The row's **leading position slot** changed from a fixed 28 px box to a 32 px
  *minimum* width with a single line. Single- and double-digit positions stay
  aligned, while a wider value — a two-digit position at a large text scale, or
  the localized unranked em dash — takes the room it needs instead of wrapping
  onto a second line and misaligning the row. This regenerated the
  `standings_row_leader` design-system golden.
- **`GvTeamAccent.parse`** turns a contract `#RRGGBB` team colour into a `Color`,
  returning `null` for a missing or malformed value. A team colour is decorative,
  so an unparseable one renders no accent rather than failing or substituting a
  fabricated default. Accents remain thin bars; they never carry meaning alone.

The component catalogue gained a provisional row with a two-digit position and a
row with no team and no statistics, and the design-system behaviour tests cover
the new slots, the omission rules and the single-line position.


## 8d. Phase 7C component changes

Phase 7C introduced no new component. Three existing ones gained optional,
backward-compatible parameters, and one layout defect was fixed.

### `GvSectionHeader` — overflow-safe trailing action

The trailing action is now `Flexible` with a single-line ellipsis, so a long
localized label (Spanish `Ver clasificación de constructores`) or a large text
scale no longer overflows the row.

- The title (`Expanded`) and the action (`Flexible`) each have flex 1, so the
  title always keeps at least half the row and stays usable.
- Ellipsis is **visual only**: the complete label remains the semantic label, so
  assistive technology reads the whole action.
- The target still meets `GvLayout.minTouchTarget` in both dimensions.
- No tooltip was added — the design system does not use tooltips for section
  actions, and a truncated label must not silently acquire one.

Verified in `test/design_system/section_header_test.dart` for both locales at 1x
and 2x text scale, at 390 px and 320 px widths.

### `GvDriverRow`

- `subtitle` — an already-composed secondary line, taking precedence over the
  existing `team` (which is retained, so existing call sites are unchanged).
- `shortCode` — rendered beneath the number in the trailing slot.
- `accentColor` — a restrained team accent, never the sole carrier of identity.
- `semanticLabel` — one explicit reading order for the whole row.

### `GvTeamRow` / `GvCircuitRow`

- `semanticLabel` on both; `trailing` on `GvCircuitRow`.

All new parameters are optional and default to the previous behaviour, so every
existing user and every existing golden remains valid.

### Media policy (Phase 8B)

Phase 7C shipped media **fallbacks**; Phase 8B added the media system around
them. `GvImagePlaceholder` is unchanged and remains the fallback for every
no-image state.

`GvRemoteImage` renders remote imagery. It takes **primitives only** — a
validated URL, a cache identity, a size, a placeholder icon, an optional label —
and knows nothing about `Driver`, `Constructor`, `Circuit`, `GrandPrix`,
`MediaAsset`, a repository, a Riverpod `Ref`, a Drift row or a DTO. Choosing
*which* image belongs in a slot happens before the widget is built, in a pure
selector.

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
- Initials are never derived from an identifier; team treatment uses the
  contrast-safe accent from `GvTeamAccent`, which returns `null` for a missing or
  malformed colour rather than inventing one.
- Accessibility is decided slot by slot rather than by marking every image
  informative: an image beside text that already names its subject is decorative,
  while a circuit layout diagram is informative, because the shape of the track is
  information no adjacent text states.
- Missing media never removes core text content: every row and every detail
  screen stays fully usable and navigable without it.

Full architecture — ownership, variant selection, URL policy, cache limits, the
loader boundary and publication — is in [GridView_Media.md](GridView_Media.md).

## 9. Rules

- No raw colour/spacing/radius literals in widgets — use tokens.
- No API/DTO/repository/controller imports in `lib/core/theme` or
  `lib/core/widgets`.
- No ad, Firebase, Worker, Drift or provider dependency in design-system code.
- The production `applicationId` (`com.sejuma.gridview`) and Android signing are
  never changed by design-system work.
