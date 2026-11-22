# Primer V2 shared foundation (consolidation pilot)

**Status: experiment, 2026-11-08 (Calendar pilot), extended 2026-11-09
(Standings, Explore, then Driver, Team and Circuit Detail pilots), and
2026-11-10 (Grand Prix Detail pilot, the Settings pilot, then the Home
pilot).** Only the pilots load these files: `../consolidation-pilot/`
(Calendar) and its `standings/`, `explore/`, `driver-detail/`,
`team-detail/`, `circuit-detail/`, `grand-prix-detail/`, `settings/` (with
`settings/information/`) and `home/` folders. First-pass summary:
[`../consolidation-pilot/CONSOLIDATION-SUMMARY.md`](../consolidation-pilot/CONSOLIDATION-SUMMARY.md). Every approved prototype still loads its own
`primer-core.css` copy and is unchanged. Nothing here is an approved decision; the policies in
[`../CORE-DESIGN-DECISIONS.md`](../CORE-DESIGN-DECISIONS.md) stay pending.

## What is here

All rules are moved verbatim (values, selectors and comments unchanged) from
`primer-core.css`. That file is byte-identical in its eight folders (MD5
`0d78851e…`), and its 49 rules match the approved Home `refinement-01/styles.css`
rule for rule. Four rule groups were added from the screen stylesheets:

| File | Contents | Source |
|---|---|---|
| `tokens.css` | `:root` palette, cut, gutter, radii, nav height, font | core |
| `base.css` | reset, body type, focus, selection, `.sr-only`, `.num`, `.icon`, `[hidden]` guard, reduced motion | core + `[hidden]` (identical in 8 screen stylesheets) |
| `components/app-bar.css` | `.appbar`, wordmark, season, actions, icon button, freshness | core |
| `components/section-title.css` | 20px `h2` title | core |
| `components/chip.css` | status chip vocabulary | core |
| `components/tag.css` | livery tag | core |
| `components/text-link.css` | text link | core |
| `components/nav.css` | adaptive bottom navigation | core |
| `components/notice.css` | notice: the **common subset** of 8 copies (see its header); the Settings information screens add a reading-width local extension (2026-11-10) | screen stylesheets |
| `components/empty-state.css` | `.empty`, `.empty__msg`, `.btn` (added 2026-11-09) | identical in 6 screen stylesheets |
| `components/empty-state-detail.css` | **opt-in detail-size variant**: `.empty .icon` 28px, `.empty__title` 18px / 1.25 (added 2026-11-09, detail pilots) | identical in gpd.css, dd.css, td.css, cd.css; list screens keep their 32px / 20px locally |
| `components/detail-app-bar.css` | `.dbar`, `.dbar__title`: back + one-line ellipsized title (added 2026-11-09, detail pilots) | identical in gpd.css, dd.css, td.css, cd.css; the back button is the core `.icon-btn` |
| `components/detail-page.css` | `.page`, `.sec`, `.sec__title`: detail-page scaffold (added 2026-11-10, GP pilot; the Driver, Team and Circuit pilots switched to it) | identical in gpd.css, dd.css, td.css, cd.css; `.page-notice` differs (GP) and stays local |
| `components/selector.css` | segmented selector: slab, states, adaptive fit; **without** column count and button padding (added 2026-11-09) | common part of standings.css and explore.css (see its header) |
| `nav-inset.js` | nav fit mode + `--nav-space` | identical in 4 folders (including `refinement-01/`) |
| `title-fit.js` | `GvTitleFit.fit(title)` (rule S-2: width axis 118 → 100 → 84 → 72, then last-resort scale) and `GvTitleFit.attach(title)` (the same triggers for a screen with no header budget) (added 2026-11-10, Step 48B) | `fitTitle`, byte-identical in standings.js and explore.js; the width-step CSS stays in each screen stylesheet |

## Load order

Link only the components a screen uses, in this order, before the screen
stylesheet:

```html
<link rel="stylesheet" href="../shared/tokens.css">
<link rel="stylesheet" href="../shared/base.css">
<link rel="stylesheet" href="../shared/components/app-bar.css">
<link rel="stylesheet" href="../shared/components/detail-app-bar.css"> <!-- detail screens -->
<link rel="stylesheet" href="../shared/components/section-title.css">  <!-- if used -->
<link rel="stylesheet" href="../shared/components/chip.css">
<link rel="stylesheet" href="../shared/components/tag.css">            <!-- if used -->
<link rel="stylesheet" href="../shared/components/text-link.css">      <!-- if used -->
<link rel="stylesheet" href="../shared/components/nav.css">
<link rel="stylesheet" href="../shared/components/notice.css">
<link rel="stylesheet" href="../shared/components/selector.css">       <!-- if used -->
<link rel="stylesheet" href="../shared/components/empty-state.css">    <!-- if used -->
<link rel="stylesheet" href="../shared/components/empty-state-detail.css"> <!-- detail screens, after empty-state -->
<link rel="stylesheet" href="../shared/components/detail-page.css">  <!-- detail screens, last shared file -->
<link rel="stylesheet" href="screen.css">
<script src="../shared/nav-inset.js" defer></script>
<script src="../shared/title-fit.js" defer></script>     <!-- screens with a fitted title, before the screen script -->
```

This keeps the core's cascade order. Screen stylesheets rely on it: for example
Calendar's `.appbar--sticky` sets `padding-bottom` after `.appbar`'s
`padding` shorthand. Prefix the paths with one more `../` from a deeper folder
(the Standings pilot uses `../../shared/`).

## Consumers and local extensions

| Pilot | Shared files linked | Local extensions of shared components |
|---|---|---|
| Calendar (`../consolidation-pilot/`) | tokens, base, app-bar, chip, nav, notice | sticky app bar + `14cqi` title cap; compact list chip (`.ev .chip`) |
| Standings (`../consolidation-pilot/standings/`) | tokens, base, app-bar, chip, nav, notice, selector, empty-state | `.notice { text-wrap: pretty; }`; `.seg` 2 columns + `.seg__btn` 8px 12px; pinned app bar + title-fit CSS (the fit itself: `title-fit.js`, since Step 48B) + header budget; nav selected-label fallback; `.chip--provisional`; list-size `.empty .icon` / `.empty__title` |
| Explore (`../consolidation-pilot/explore/`) | tokens, base, app-bar, chip, nav, notice, selector, empty-state | `.notice { text-wrap: pretty; }`; `.seg` 3 columns + `.seg__btn` 8px 10px; pinned app bar (+ `data-header="none"`) + title-fit CSS (the fit itself: `title-fit.js`, since Step 48B) + header budget; nav selected-label fallback; list-size `.empty .icon` / `.empty__title`; entity rows, chevron, media slot, Alternative B overrides |
| Driver Detail (`../consolidation-pilot/driver-detail/`) | tokens, base, app-bar, detail-app-bar, section-title, chip, notice, empty-state, empty-state-detail, detail-page | `.notice { text-wrap: pretty; }`; `.btn:hover` (Chalk-low); `.chip--outline` (GP addition); `.page-notice`; plate, spans, championship, `.ch__link` row, facts, skeleton |
| Team Detail (`../consolidation-pilot/team-detail/`) | same as Driver | same notice, `.btn:hover`, `.chip--outline`, `.page-notice`; banner, rail and TM-03 edge, championship strip, `.dest` row, line-up, sheet, skeleton |
| Circuit Detail (`../consolidation-pilot/circuit-detail/`) | same as Driver | same notice, `.btn:hover`, `.page-notice`; `.chip--done` / `.chip--alert` (GP additions); sheet, dimension line, facts, lap record, related-event row, media slot, skeleton |
| Settings root + preferences (`../consolidation-pilot/settings/`) | tokens, base, app-bar (for `.icon-btn`) | **none of the shared components beyond the core**: the Settings bar (`.chrome`, `.dbar`, `.dbar__title`, environment strip) is a variant of the detail bar and stays local, as do `.page`, kicker, rows, selection mark, options, snackbar, annotations and gallery (`settings.css`, approved minus `[hidden]`); `settings.js` |
| Settings information (`../consolidation-pilot/settings/information/`) | tokens, base, app-bar, notice, then `../settings.css` | notice **reading-width extension** (margin, 12px 14px padding, 15px / 1.45, 36em, icon offset); facts, long-form text, source block, external-link row, states, S-2 title fit (`information.css`); `information.js` |
| Calendar title-fit **experiment** (`../cross-screen-refinement/calendar-title-fit/`, Step 48B; not approved) | as the Calendar pilot, plus `title-fit.js` | as the Calendar pilot, with the `14cqi` cap replaced by Standings' title-fit rules on `.appbar--sticky`; `calendar-title.js` calls `GvTitleFit.attach` |
| Calendar sticky-split **experiment** (`../cross-screen-refinement/calendar-sticky-split/`, Step 48C; Calendar Stage 2: a retained alternative, not the preferred direction since Step 48F, CT-03) | as the title-fit experiment | as the title-fit experiment (title visually approved, CT-01), with the caption and notices moved into `<main>`; `calendar-header.js` sets the sticky offset and scroll padding |
| Calendar Stage 1 **experiment** (`../cross-screen-refinement/calendar-stage1/`, Step 48E; provisionally approved as the preferred Calendar visual and interaction direction, CT-03; Flutter implementation and real-device validation outstanding) | as the title-fit experiment | as the sticky-split experiment without the title release; `calendar-stage1.js` sets the scroll padding and keeps keyboard focus clear (L1) |
| Home (`../consolidation-pilot/home/`) | tokens, base, app-bar, section-title, chip, tag, text-link, nav, `nav-inset.js` | **none**: Home's 49 core rules are the shared rules verbatim and it adds nothing to them; its 68 composition rules stay in `home.css` (hero and 12° round block, sessions band, Chalk band and seam, result and watermark, upcoming row, Explore strip). Home has no `hidden` attribute, so the base `[hidden]` guard has no effect |
| Grand Prix Detail (`../consolidation-pilot/grand-prix-detail/`) | same as Driver | same notice; **no** `.btn:hover`; `.page-notice` without bottom padding; `.empty--inline`; chip additions (`--done`, `--alert`, `--outline`, `--fastest`, `--sm`); identity band, fact rail, circuit row, timetable, classification and 12° winner cell, skeleton, fixture banner; `gpd.js` |

A **local extension** is a screen rule that adds to a shared component and
loads after it, without changing the shared file. It is how a known,
unresolved divergence (for example `text-wrap: pretty` on the notice) stays
exactly as approved per screen until a decision moves it into, or out of, the
shared file.

## Rules for changing these files

- No visual change without an owner decision. The open drift items (XS-07
  titles, including the detail bars' ellipsis, XS-08 nav fallback, XS-11 status vocabulary, XS-22 notice icons,
  XS-26 selected fill, XS-29 headings) are resolved in a decision first, then
  here.
- A change here reaches every migrated screen. Re-run each migrated screen's
  regression comparison afterwards with
  `../consolidation-pilot/tools/visual-compare.mjs` and that screen's config
  (see `../consolidation-pilot/tools/README.md`).
- Screen compositions (banners, figures, rows' content, screen variants of a
  component) stay in the screen stylesheet.
