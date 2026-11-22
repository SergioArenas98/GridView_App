# Calendar title-fit experiment (Step 48B)

**Status: experiment, 2026-11-10.** This is not an approved design, a
fixture or a Flutter contract.

- **What changed:** one intentional visual change, authorised for
  experimentation only. Calendar's title at 320dp with 200% text uses the
  shared title fit instead of the `14cqi` cap.
- **What did not change:** the approved Calendar prototype
  (`../../calendar/`) and the Calendar consolidation pilot
  (`../../consolidation-pilot/`).
- **Decision records:** `DESIGN-DECISIONS.md` and `DESIGN-BACKLOG.md` are
  unchanged. XS-07, XS-06 and XS-29 stay open.
- **Basis:** `../../HEADER-AND-HEADING-DECISIONS.md`.

## 1. Shared title-fit extraction

`../../shared/title-fit.js` holds `GvTitleFit.fit(title)` and
`GvTitleFit.attach(title)`.

- **`fit`** is the `fitTitle` body from `standings.js` and `explore.js`,
  moved verbatim. It was byte-identical in both, approved and pilot copies
  alike. The only change is that it takes the title as a parameter.
- **Unchanged:**
  - the width steps (118 → 100 → 84 → 72);
  - the last-resort single-word scale;
  - the `+1` tolerance.
- **`attach`** reproduces the triggers of Standings' layout pass for a
  screen with no header budget:
  - body `ResizeObserver` (next frame);
  - window `resize`;
  - `document.fonts.ready`;
  - one immediate pass.
- **Standings and Explore pilots:** `fitTitle` now calls
  `GvTitleFit.fit(title)` inside their own layout pass. That keeps the order
  "fit, then measure the header budget", and every trigger, the header
  budget and Explore's `gv:layout` re-check unchanged.
  - Their generators (`standings/build.py`, `explore/build.py`) add one
    `<script src="../../shared/title-fit.js" defer>` line before the screen
    script.
  - The generated pages differ from before by that line only.
- **The width-step CSS stays local** to each screen
  (`.appbar--pinned .wordmark[data-fit=…]`, identical in both). Moving it
  would change its selectors, and the title policy is not approved.

**Not extracted:** the header budget. Standings and Explore differ
(Explore's second level), and the threshold is a diagnostic, not a rule.

## 2. Standings and Explore regression

Run with `../../consolidation-pilot/tools/visual-compare.mjs`, unchanged:
software raster, Chrome 157.0.8103.39, DPR 2, mobile emulation with touch.
Each pilot run was paired with a baseline-vs-baseline control.

| Pilot | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Behaviour asserts | Control |
|---|---|---|---|---|---|---|---|
| Standings | 39 | 168 | **0** | 0 | 0 | 6 / 6 in both versions (selector, scroll restore, Enter, Space) | 0 |
| Explore Alternative B | 66 | 285 | **0** | 0 | 0 | 10 / 10 in both versions (categories, restore, keys; media gallery geometry) | 0 |

- **Title-fit probes:** `data-fit`, the inline size and `--appbar-h` are
  compared between baseline and pilot, and are identical. This includes
  "Clasificaciones", scaled at 320 @200%.
- **Evidence:**
  - `../../consolidation-pilot/standings/validation-20261110-130945-title-fit-recheck/`;
  - `../../consolidation-pilot/explore/validation-20261110-130945-title-fit-recheck/`.
- **Other pilots not re-run.** The only shared change is a new file that
  no other pilot loads. No existing shared file changed.

## 3. Calendar experiment

**Files** (`build.py` derives every file from the pilot by asserted single
substitutions; `--check` verifies they are current):
- `index.html`, `index.es.html`: the pilot markup. Only the comment, the
  shared paths, two script tags and the Home tab path (same target) differ.
- `calendar.css`: the pilot's, with the two `14cqi` rules replaced by
  Standings' four title-fit rules, re-scoped to `.appbar--sticky`.
- `calendar-title.js`: a three-line `GvTitleFit.attach`.
- `calendar-states.js`: verbatim.

**Size rule.** No size was hardcoded. The title keeps the shared wordmark
size, `min(1.5rem, 34px)`. The fit loop narrows the width axis or scales,
measuring the real column.

**Comparison.**
- Config: `calendar-title-fit.config.mjs`, baseline = the approved
  `../../calendar/`, 45 runs, 147 screenshot pairs.
- Coverage:
  - EN and ES; 390×844 and 320×693; 100% and 200%;
  - every header state (default, refreshing, stale, failed), with full
    scroll capture;
  - six focus walks, forced pointer states, reduced motion;
  - four scroll, text-scale and focus-visibility step runs.
- Evidence: `validation-20261110-132548-experiment/`.
- Control: 0 differing pixels and 0 differences of any kind.

### 3.1 Title (measured: computed style and layout boxes)

| Case | Before (approved) | After (experiment) |
|---|---|---|
| EN 320 @200% | 25.76px, `wdth` 118; text 132.47px; gap to actions 59.53px | **34px, `wdth` 118** (fit `w118`, no narrowing); text 174.83px; gap **17.17px** |
| ES 320 @200% | 25.76px, `wdth` 118; text 158.41px; gap 33.59px | **34px, `wdth` 100** (fit `w100`); text 179.63px; gap **12.38px** |
| EN, ES 320 @100% | 24px, `wdth` 118; gap 68.58 / 44.42px | identical |
| EN, ES 390 @100% | 24px, `wdth` 118; gap 138.58 / 114.42px | identical |
| EN, ES 390 @200% | 34px, `wdth` 118; gap 87.17 / 52.92px | identical |

- **Title column:** 184px at 320, 254px at 390.
- **Every case:** one line, fully visible, no last-resort scale.

**Against the Step 48A CSS estimates:**
- EN size about 34px: confirmed.
- ES about `wdth` 100: confirmed.
- EN gap about 20px: measured 17.17px.
- Header about +9px: **wrong, measured 0**. The title box grows from 28.33
  to 37.39px, but stays inside the 48px row set by the action buttons. The
  row is vertically centred, so it does not grow.

### 3.2 Changed regions and downstream movement (measured)

- **Pixels:** only at 320×693 @200%, in every state and both languages.
  The single box is `[34,44]–[382,94]` device px (EN) and
  `[34,44]–[390,94]` (ES), about CSS x 17–195, y 22–47: the title glyphs.
  It is the same box in every screenshot of a run, including the focus
  walks and the scrolled step captures, because the header is sticky.
- **Element boxes:** only the brand column and `h1` change (y 21.83 →
  17.30, height 28.33 → 37.39).
- **Unchanged elements:** header height, season row, notices, list, rows
  and nav are identical. Document height is identical in all 45 runs.
- **Structural differences:** expected and the same in every run, with no
  pixels where the size does not bind:
  - `data-fit` on the `h1`;
  - `white-space: nowrap`, `max-width: 100%` on the `h1`;
  - `min-width: 0` and no `container-type` on the brand column.

### 3.3 Header, list space and navigation (measured, identical before and after)

| 320×693 @200% | Header | Content window (header → nav) | List visible at top | Nav |
|---|---|---|---|---|
| EN, ES default | 112.50px (16.2%) | 425.72px (61.4%) | 310.94 / 274.55px | stacked 154.78px |
| EN, ES refreshing | 152.19px (22.0%) | 386.03px (55.7%) | 271.25 / 234.86px | stacked |
| EN failed | 257.89px (37.2%) | 280.33px (40.5%) | 165.55px | stacked |
| EN stale | 295.69px (42.7%) | 242.53px (35.0%) | 127.75px | stacked |
| ES failed | 295.69px (42.7%) | 242.53px (35.0%) | 91.36px | stacked |
| ES stale | **371.28px (53.6%)** | **166.94px (24.1%)** | **15.77px** | stacked |

- **Navigation is the same in every run:** regular 68px, condensed 81px,
  stacked 155px. It is stacked at 320 @200% and ES 390 @200%, and condensed
  at ES 320 @100%. The selected-label fallback is not applied (as approved
  for Calendar).
- **Other checks** (all runs, both versions):
  - no horizontal scroll, clipping, spill or text outside the viewport;
  - no word broken mid-word;
  - minimum contrast 7.95:1;
  - 10 / 10 targets at least 48×48 (Refresh and Settings stay 48×48).

### 3.4 Accessibility, keyboard and scroll (measured)

- **Accessibility tree:** identical in all 45 runs (the `<title>` is
  unchanged).
- **Keyboard order:** the six walks, 10 stops each, are identical in role,
  name, locator and target (Refresh, Settings, rounds 20–23, Home,
  Calendar, Standings, Explore).
- **Scroll position:** scrollY is identical in both versions:
  - at 300px;
  - after a resize event (300);
  - after text 200 → 100% → 200% while scrolled (default 122 / 146;
    failed 192 / 291: the browser's scroll anchoring, the same in both).
  - The title refits on the text-scale change (`w118` at both scales) with
    no other state difference.
- **Focus visibility (a pre-existing issue, not caused by the experiment):**
  - With the failed notice at 320 @200%, a focused round row lands 64px
    (EN) or 101px (ES) under the sticky header, in both versions. The row
    top is at 194px; the header bottom is at 258px (EN) or 296px (ES).
  - In the default state the row is clear (header bottom 112.5px).
  - Calendar sets no `scroll-padding-top`. See §5.

## 4. Representative screenshots

They are local evidence: the screenshot folders have no `.gitignore` rule
yet, so they show as untracked.

| Case | Before | After | Diff mask |
|---|---|---|---|
| EN 320 @200% | `…/sw-pilot/diffs/en-default-320x693-200-01-baseline.png` | `…-01-pilot.png` | `…-01-diff.png` |
| ES 320 @200% | `…/diffs/es-default-320x693-200-01-baseline.png` | `…-01-pilot.png` | `…-01-diff.png` |
| EN, ES stale 320 @200% | `…/diffs/{en,es}-stale-320x693-200-01-baseline.png` | `…-01-pilot.png` | `…-01-diff.png` |
| EN, ES failed 320 @200% | `…/diffs/{en,es}-failed-320x693-200-01-baseline.png` | `…-01-pilot.png` | `…-01-diff.png` |
| EN, ES 320 @100%; 390 @100%, @200% | identical (0 px): `…/sw-pilot/screens/{en,es}-default-{320x693-100,390x844-100,390x844-200}-01.png` | same file | none |

Here `…` is `validation-20261110-132548-experiment/sw-pilot`.

## 5. Calendar sticky header: current structure and the smallest separation

The owner's direction:
- the season is persistent;
- the large title may scroll away when necessary;
- notices scroll with the content;
- no whole-header release at 25%.

**Current sticky elements.** One `header.appbar.appbar--sticky` (sticky,
top 0) holds the `h1` and actions row, `p#season`, `p.freshness` and both
notices (`p.notice[role=status]`). The bottom nav is `position: fixed`.
Because the notices sit inside the sticky block, they cost list space
(§3.3): at ES 320 @200% stale, the list window falls to 24% of the screen,
with 16px of list visible.

**Markup change required.** A sticky box sticks only inside its parent, so
`#season` cannot outlive a scrolling header while it is a child of it.
`display: contents` would avoid moving it, but it drops the header's grid
and risks its landmark role, so it is not recommended.

**Smallest viable split.** Reuse Standings' approved two-part pinned header
(`.appbar--pinned` + `.pinbar` with `--appbar-h`):

1. `header.appbar`: the `h1` and actions only. Pinned normally. Under the
   diagnostic, this title row alone is released by switching sticky to
   static, as Standings does (S-1). That never jumps, because a sticky box
   keeps its flow space.
2. A sticky season bar directly after it, holding `p#season`. Keep the id:
   `ol.rounds` is `aria-labelledby="season"`.
3. The freshness caption and both notices move to the start of `main.cal`,
   before the prototype note and the list. DOM order and reading order are
   unchanged (title, season, status, list).

**Projected effect** (derived from measured heights, not captured). The
pinned region becomes the default 112.5px at 320 @200% in every state, so
the content window is 425.7px (61.4%) instead of 166.9–386.0px. Below 25%,
nothing is released at any tested size. The release then matters only on
devices with system insets, or at larger text.

**Accessibility of the notices.**
- They stay `role="status"` polite live regions, so announcement does not
  depend on scroll position.
- A refresh failure that arrives while the list is scrolled would be
  announced but not seen. It needs a visible transient cue (for example the
  snackbar pattern) or acceptance that it appears at the list top.
- The freshness caption could stay with the season; it is one line at
  100% and may wrap at 200%. Owner decision.

**Scroll and focus risks.**
- **Inserting or removing a notice above the viewport moves the list.**
  Browsers anchor scroll; Flutter does not by default (a sliver above the
  viewport changes offsets). It needs explicit offset correction.
- **Other offsets must count the notice height:** the first-open anchor
  (round 23, XS-19) and the focus restored on return from Grand Prix
  Detail.
- **Focus clearance:** `scroll-padding-top` (or Flutter's `ensureVisible`
  alignment) equal to the pinned height. This fixes the obscured-focus
  issue in §3.4.
- **Actions:** releasing the title row also releases Refresh and Settings,
  as in Standings today. They are reachable by scrolling up.

**Bottom navigation.** Unaffected. It stays fixed, and its stacked 155px
(22%) is the larger fixed cost at 320 @200%. Pinned season bar plus nav
leaves the 61% window above.

**Minimum further evidence**, only if the owner wants to see it before
deciding: one frame pair of the split at EN 320 @200% stale (at the top,
and scrolled 300px). It would answer whether the freshness caption stays
with the season. The space question is already answered by the
measurements.

## 6. Section headings (XS-29): reviewed direction, recorded

- **Editorial section headings** stay shared (`components/section-title.css`).
- **Group labels** have one semantic role: groups of rows or fields, and
  groups inside a composition.
- **Composition labels** stay screen-specific.
- **Identity headings** are not forced into generic section styles.
- No visual change is requested. XS-29 is not closed or approved.

## 7. Assessment

**Recommended for owner review:**
- The fit gives Calendar the same 34px title as Standings and Explore at
  320 @200%.
- It narrows only where needed (ES `wdth` 100).
- It leaves 12.38px or more of space before the 48px actions.
- It moves nothing else: header, list, focus order, accessibility tree
  and scroll positions are identical.

**Still open:**
- device validation (system insets, Android non-linear scaling, XS-05);
- the sticky-header split (§5), which addresses a measured list-space
  problem unrelated to the title.

## Reproduce

```sh
python build.py --check
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-title-fit.config.mjs
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-title-fit.config.mjs --control
```

The experiment run exits 1 by design: its differences are the experiment.
