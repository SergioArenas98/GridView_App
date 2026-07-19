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

## 9. Rules

- No raw colour/spacing/radius literals in widgets — use tokens.
- No API/DTO/repository/controller imports in `lib/core/theme` or
  `lib/core/widgets`.
- No ad, Firebase, Worker, Drift or provider dependency in design-system code.
- The production `applicationId` (`com.sejuma.gridview`) and Android signing are
  never changed by design-system work.
