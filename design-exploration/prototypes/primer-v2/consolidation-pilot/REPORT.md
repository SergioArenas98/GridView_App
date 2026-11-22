# Calendar consolidation pilot: report

**Status: technical experiment, 2026-11-08. No decision is made or changed
here.** The three policies in [`../CORE-DESIGN-DECISIONS.md`](../CORE-DESIGN-DECISIONS.md)
remain pending owner approval, and every backlog item stays open. The approved
`calendar/` prototype and all other approved prototypes are unmodified. The
audit this builds on is [`../DESIGN-SYSTEM-CONSOLIDATION.md`](../DESIGN-SYSTEM-CONSOLIDATION.md)
(§8, §11 step 3), which this report does not repeat.

**Result: the pilot renders pixel-identical to the approved Calendar** in all
39 configurations (130 screenshot pairs) under deterministic rendering. It
also has identical computed styles, boxes, accessibility tree, focus order and
pointer states.

## Files

| Path | What |
|---|---|
| `../shared/` | Canonical foundation: `tokens.css`, `base.css`, `components/` (app bar, section title, chip, tag, text link, nav, notice), `nav-inset.js`, `README.md` (load order, change rules) |
| `index.html`, `index.es.html` | Calendar markup, byte-for-byte except the `<link>`/`<script>` block (shared files instead of `primer-core.css` / `nav-inset.js`) and one HTML comment |
| `calendar.css` | `../calendar/calendar.css` minus the `[hidden]` guard and the two `.notice` base rules (now shared). Every other rule is unchanged |
| `calendar-states.js` | Identical copy (screen-specific state preview) |
| `validation-20261108-224601-regression/` | `compare.mjs` (harness) and four runs: `sw-pilot/`, `sw-control/`, `gpu-pilot/`, `gpu-control/` |

## 1. Which shared files were actually identical

Verified by hash, then rule by rule with a parser (selectors, at-rule context
and declarations normalised):

- **`primer-core.css`: identical in all 8 folders** (calendar, standings,
  explore, grand-prix-detail, driver-detail, team-detail, circuit-detail,
  settings; MD5 `0d78851eb21ce06b5f2a3c78cbc003fd`). The Settings information
  screens and Explore's `comparison-missing-media/` load it from `../`.
- **All 49 core rules also exist, identically, in Home's
  `refinement-01/styles.css`.** Home repeats them inline instead of loading
  the core.
- **`nav-inset.js`: identical in 4 folders** (calendar, standings, explore,
  refinement-01).
- **`[hidden] { display: none !important; }`: identical in 8 screen
  stylesheets** (calendar, standings, explore, gpd, dd, td, cd, settings).
  Home has no `hidden` elements and no guard.
- **`.notice`: not identical.** Calendar's copy has 8 declarations. Standings,
  Explore, GP, Driver, Team and Circuit have the same 8 plus
  `text-wrap: pretty`. `.notice .icon` is identical in those 7 files.
  `information.css` has a deliberate reading-width variant.

## 2. Common rules extracted

| Shared file | Rules | Origin |
|---|---|---|
| `tokens.css` | `:root` (1) | core |
| `base.css` | 16 (14 base + reduced motion from the core, + `[hidden]`) | core; `[hidden]` from 8 screen files |
| `components/app-bar.css` | 9 | core |
| `components/section-title.css` | 1 | core |
| `components/chip.css` | 7 | core |
| `components/tag.css` | 2 | core |
| `components/text-link.css` | 4 | core |
| `components/nav.css` | 10 | core |
| `components/notice.css` | 2 | the **common subset** of the notice copies |

Static check: shared total = 52 rules = all 49 core rules + `[hidden]` + 2
notice rules, with no value changed. The pilot's effective rule set equals
the baseline's minus 7 rules for components Calendar never uses
(`section-title`, `tag`, `text-link`; no matching markup). Order changed only
for `[hidden]` and reduced motion (both `!important`, so order-independent)
and `.notice` (no competing rule at the same specificity).

`text-wrap: pretty` was **not** chosen for or against. It stays out of the
shared notice, and the six screens that have it would keep it locally when
migrated. This divergence is not in the backlog yet. It belongs under XS-09
(shared notice) if the owner wants it tracked; the backlog was not edited.

## 3. Rules that stayed screen-specific

In `calendar.css`, deliberately:

- **Sticky header variant** (`.appbar--sticky`, season row, `14cqi` title
  cap, notice placement). The title rule and header budget are open (XS-07,
  XS-06), and Standings/Explore use a different pinned variant.
- **Running order** (`.rounds`, `.ev*`, round column, hairlines, narrow-
  container reflow): a screen composition.
- **Compact list chip** (`.ev .chip`): a Calendar extension. GP Detail has
  other chip additions; one chip set waits for XS-11.
- **Next-event band and round block**, including the hard-coded `#1B1D20`
  band end and the `#B04633` gradient start (XS-26; no token added).
- **`.proto-note`**: a prototype annotation, Calendar only.

## 4. Validation results

Harness: `validation-20261108-224601-regression/compare.mjs`. It uses one
headless Chrome 157.0.8103.38 session with baseline and pilot loaded back to
back per configuration. Both use the same device metrics (DPR 2, mobile
emulation, touch), the same `?state=` query, the same 200% root text scale
(as in earlier validations), and Archivo from the same cached Google Fonts
response. Each screenshot is retaken until two consecutive frames match, then
compared as decoded RGBA.

**Configurations (39):** EN/ES × 390×844 / 320×693 × 100% / 200% text ×
default / refreshing / stale / failed (32). Plus keyboard Tab through all 10
stops at 390@100% and 320@200%, EN and ES (4); forced `:hover` / `:active` on
icon button, ordinary row, Next row and nav tab, EN and ES (2); and
`prefers-reduced-motion: reduce` (1).

| Run | Rendering | Screenshot pairs | Differing pixels | Style/box diffs | A11y-tree diffs | Focus order |
|---|---|---|---|---|---|---|
| `sw-pilot` | software raster | 130 | **0** (130/130 PNGs byte-identical) | 0 | 0 | identical ×4 |
| `sw-control` (Calendar vs itself) | software raster | 130 | 0 | 0 | 0 | identical ×4 |
| `gpu-pilot` | Chrome default (GPU) | 130 | 4,274 in 1 pair, max delta 1/255 | 0 | 0 | identical ×4 |
| `gpu-control` (Calendar vs itself) | Chrome default (GPU) | 130 | 13,767 in 4 pairs, max delta 130/255 | 0 | 0 | identical ×4 |

Per configuration, the harness compared each of the 126 body elements:
bounding box (0.01px), every computed property (including `::before` and
`::after`), the `:root` computed style, document height, nav fit mode and
`--nav-space`. All 39 configurations matched on every one. Fonts matched too:
3 Archivo faces loaded and `document.fonts.check('16px Archivo')` true in
both versions every time.

**Interpreting the GPU runs.** On Chrome's default GPU path, the Next row's
round block varies slightly from one page load to the next. That block is an
oxide gradient on a 12° skewed pseudo-element with a blurred shadow, and the
variation appears when the same file is loaded twice. The control run, with
no CSS change at all, shows more of it than the pilot. Software raster
removes it in both runs. The single GPU-mode pilot diff sits in the same
region (`gpu-pilot/diffs/`). **None of the differences comes from the
consolidation.**

**Accessibility and interaction:** the accessibility trees are identical
(document URLs normalised; saved in `sw-pilot/accessibility-tree-{en,es}.txt`).
Tab order is the same in all four focus runs, with matching focus-ring
pixels. Hover/active screenshots and reduced-motion computed transitions are
identical. Touch-target sizes are identical. Screens from the canonical run
are in `sw-pilot/pilot-screens/`.

**Limits of this evidence:** Chrome emulation only, as for every Primer V2
screen. There is no device, TalkBack or Android font-scaling evidence (XS-02,
XS-05, XS-16). Both versions need network access for Archivo on first load.

## 5. Unresolved CSS dependencies

1. **Cascade order is a contract.** Screen stylesheets must load after the
   shared files: `.appbar--sticky` overrides a longhand of `.appbar`'s
   `padding`. This is documented in `../shared/README.md`.
2. **`nav-inset.js` ↔ CSS.** The script writes `data-fit` on `.tabbar` and
   `--nav-space` on `<html>`. `nav.css` styles the modes; screen page padding
   reads `--nav-space` with a `--nav-min` fallback.
3. **Notice divergence** (§2): `text-wrap: pretty` is unresolved, and the
   information screens keep their own variant.
4. **Core selectors re-targeted by screens.** `settings.css` adds custom
   properties on `:root`, and `information.css` adds `scroll-padding` on
   `html`. Migrating those screens must keep them loaded after `tokens.css`
   and `base.css`.
5. **Screen extensions of shared components** are still screen-level: the
   Standings/Explore nav selected-label fallback (S-3, XS-08), pinned app bar
   with title fit (S-2, XS-07), GP chip additions and Calendar's compact chip
   (XS-11).
6. **Hard-coded values outside tokens** remain in screen files: `#B04633`
   (XS-26), `#1B1D20` (Calendar, and Home's styles.css). Calendar's round
   block uses the gradient stops `#B04633 0% / oxide 45%`, as Home's hero
   does. The selector slabs and the Driver plate use 55%. This is recorded as
   an observation for XS-26, not decided here.
7. **Home is not on the core.** Its 49 inline copies would be removed only
   when Home migrates. `[hidden]` in `base.css` would then reach Home too
   (harmless today: Home has no `hidden` elements).

## 6. Is the approach safe to extend?

**Yes, with the same method.** Copy the screen into an isolated pilot, link
only the shared files it uses, and move only verbatim rules or a documented
common subset. Then run `compare.mjs` against the approved folder in
software-raster mode with its control. The zero-pixel result plus identical
computed styles is strong evidence that pure reorganisation is safe. The
risks are in what this pilot did not exercise: screens that override core
selectors (Settings, information) and components whose copies disagree
(notice, detail app bar, chips).

The harness is currently Calendar-specific: its paths, the 10-stop focus walk
and the forced-state selectors. It needs per-screen parameters before reuse.

## 7. Proposed next screen

**Standings.** It shares everything Calendar uses (core, identical
`nav-inset.js`, `[hidden]`, notice) and adds the three conditions this pilot
did not test:

- a screen keeping `text-wrap: pretty` on top of the shared notice subset;
- a screen extension layered on a shared component (the nav selected-label
  fallback over `nav.css`);
- a second app-bar variant (pinned, with title fit in `standings.js`) on the
  shared `.appbar`.

Explore would follow and reuse the selector extraction that Standings
prepares. The detail screens (GP, Driver, Team, Circuit) come after that,
with the identical detail app bar as their first new shared component.

Nothing beyond the Calendar pilot was migrated.
