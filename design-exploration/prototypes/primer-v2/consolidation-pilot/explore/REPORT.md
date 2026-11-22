# Explore consolidation pilot: report

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Status: technical experiment, 2026-11-09. No decision is made or changed
here.** The reference is **Alternative B**
(`explore/comparison-missing-media/cue[.es].html`, EX-02, provisionally
approved). The mixed-media column rule (PD-16 / EXP-04) and the core policies
in [`../../CORE-DESIGN-DECISIONS.md`](../../CORE-DESIGN-DECISIONS.md) stay
pending. The baseline, Alternative A, Alternative B and every other approved
prototype are unmodified. The method is that of the Calendar and Standings
pilots ([`../REPORT.md`](../REPORT.md),
[`../standings/REPORT.md`](../standings/REPORT.md)).

**Result: the pilot is pixel-identical to Alternative B and to both Explore
galleries** in 66 runs (285 screenshot pairs) under deterministic rendering.
Element text, DOM, computed styles, boxes, accessibility trees, focus order,
category behaviour and media-state geometry are identical too. Standings and
Calendar still pass after this step's shared and tool changes.

## Files

| Path | What |
|---|---|
| `build.py` | Imports the approved generators **read-only** (`explore/comparison-missing-media/build.py`, which imports `explore/build.py`). Checks that they still reproduce the 6 approved pages byte for byte (`--check`), then writes the pilot pages with only asset and link paths rewritten. Writes nothing outside this folder (bytecode disabled) |
| `cue[.es].html` | Alternative B. Diff against the approved files: the head link block only. Same folder depth, so the nav links are unchanged |
| `media-states[.es].html` | Missing-media gallery. Diff: the head links, plus "Back to Alternative A", which now points to the same approved page (`../../explore/comparison-missing-media/index[.es].html`) |
| `states[.es].html` | The baseline's state-fixture gallery (refreshing, update failed, empty ×3, first-load error, season unavailable, loading, long roster). It is the only existing source for these states; no Alternative B version exists, so its rows keep the baseline media tiles as delivered. Diff: head links, plus "Back to the prototype", which keeps its target (`../../explore/index[.es].html`) |
| `explore.css` | Approved `explore/explore.css` minus the rules now in `../../shared/` (§1) |
| `comparison.css`, `states.css`, `explore.js`, `media-states.js` | Byte-identical copies |
| `validation-20261109-183220-regression/` | `sw-pilot/` (summary, results with per-shot RGBA hashes, 10 accessibility trees, first screenshot per static run) and `sw-control/` |

## 1. Shared rules reused or extracted

| Component | Treatment |
|---|---|
| Tokens, base, app bar, chips, nav, `nav-inset.js` | Reused (Explore's `primer-core.css` and `nav-inset.js` are byte-identical copies) |
| `[hidden]` guard | Reused (`shared/base.css`) |
| Notice | Reused base. Local extension `.notice { text-wrap: pretty; }`, exactly as approved; Calendar is unaffected |
| Empty state (`.empty`, `.empty__msg`, `.btn`) | Reused (`shared/components/empty-state.css`). The gallery's `.btn--state` (comparison.css) still extends it |
| **Selector** | **New `shared/components/selector.css`** (§3) |

## 2. Explore-specific rules kept local

- **Pinned header, title fit and header budget.** The CSS is Standings' plus
  `[data-header="none"]` (the selector bar also scrolls away when it alone
  exceeds 25%), and `explore.js` differs accordingly. These are pending
  policies (S-1, S-2, XS-06, XS-07).
- **Nav selected-label fallback.** Identical to Standings', but pending
  (S-3, XS-08) and not applied to Calendar.
- **Entity rows and media slot** (`.lib`, `.ent*`, `.datum`, codes, figure
  rail, team tick) and **all of `comparison.css`**: Alternative B's lane,
  wider names, the narrow-container reflow, the chevron `.ent__go` and the
  media-state classes.
- **Focus and pressed states** (`.ent__link:hover/:active/:focus-visible`).
  They follow the same pattern as `.st__link` and `.ev__link` but use
  different selectors. Sharing them would need a common class, which means a
  markup change.
- **Entity-row chevron.** `.ent__go` has the same declarations as Standings'
  `.st__go`. Calendar's `.ev__go` differs: no size, stroke or margin, a 24px
  icon, and the Next row's Chalk disc. A shared `GvRowAffordance` needs a
  shared class (markup) and Calendar's variant decided (audit §5.10).
  Recorded, not extracted.
- **Refresh progress line, list-size empty icon and title, skeleton.**

## 3. The three-option selector

The `.seg` rules in Standings and Explore are identical except for two
declarations, so the shared file holds everything else verbatim (slab,
pressed and hover states, focus offset, measuring weight, condensed and
stacked modes). Each screen keeps its own geometry as a local extension:

| | `.seg` columns | `.seg__btn` padding |
|---|---|---|
| Standings | `repeat(2, minmax(0, 1fr))` | `8px 12px` |
| Explore | `repeat(3, minmax(0, 1fr))` | `8px 10px` |

Explore's selector was not changed to Standings' two-option layout. The
stacked mode (`grid-template-columns: 1fr`, specificity 0,2,0) still
overrides each screen's column count. The Standings pilot was switched to the
shared selector in the same step and revalidated (§6); its report has an
addendum. The `#B04633` slab start is kept as approved (XS-26).

## 4. Team-colour contrast (XS-25)

Measured on the pilot and on Alternative B, with identical results. The ticks
render the supplied colour with no edge:

| Colour | Use | On graphite `#141518` |
|---|---|---|
| `#1E41FF` | Red Bull, Max Verstappen | **2.83:1** (below 3:1) |
| `#0093CC` | Alpine | 5.26:1 |
| `#FF8000` | McLaren, Lando Norris | 7.25:1 |

This is the known baseline limitation, not a regression, and the pilot
reproduces it exactly. **Reusing Team Detail's TM-03 treatment** looks
feasible as a separate, future change, not in this pilot:

- TM-03 frames the supplied colour with Chalk (`.tb--edge` / `.lu--edge`). It
  is chosen by `build.py` from a measured contrast, so it would need a
  build-time class on low-contrast rows, which is a markup change.
- It would also need an edge geometry designed for a 3px, 40px-tall tick at
  12°. Team Detail frames a 12px bar and a 4px seam.

That decision belongs to XS-25.

## 5. Missing-media limitations

- **Alternative B lists (all three categories):** 0 media slots and no image
  column, as approved. There are no tiles to load or fail, so B has no
  media-state transitions to test.
- **Media gallery** (`media-states`, the proposal shown with B): a collection
  without references, a mixed collection with one row per state (loaded /
  loading / failed / none ×2), and the interactive list. Switching the live
  list loaded → failed → none → loading → loaded keeps every text box and
  slot box identical (asserted EN/ES, 390@100 and 320@200), and the
  screenshots match the approved gallery pixel for pixel. The "loaded" slot is
  the gallery's tonal stand-in; no image exists, none was added.
- **Not equivalent, by design of the sources:** the approved files contain no
  scenario of a mixed collection on the real Alternative B page (with
  chevrons). The gallery uses Alternative A's rows. Nothing was invented to
  fill that gap. The per-list rule stays a proposal (PD-16).
- The state gallery's rows show the baseline tiles (22 slots), because that is
  the approved fixture page. They are not part of Alternative B.

## 6. Pixel-regression measurements

Run with `../tools/visual-compare.mjs explore.config.mjs`: Chrome
157.0.8103.38, software raster, DPR 2, mobile with touch, one session, stable
frames. The refresh line's looping animation is frozen at 700 ms in both
versions; reduced motion is also run.

**Runs (66):**

- **Static (40):**
  - B: EN/ES × Drivers / Teams / Circuits × 390×844 / 320×693 × 100% / 200%
    (24).
  - Media gallery (8) and state gallery (8) at the same sizes, captured as
    full-page segments.
- **Interaction (26):** 12 keyboard focus walks, 4 forced-state runs, 4
  category scenarios, 4 media-state scenarios and 2 reduced-motion runs.

| Run | Screenshot pairs | Differing pixels | Text / DOM / style / box / metric diffs | A11y-tree diffs |
|---|---|---|---|---|
| `sw-pilot` (pilot vs approved) | 285 | **0** | 0 | 0 |
| `sw-control` (approved vs itself) | 285 | 0 | 0 | 0 |

**Measured, identical in both versions:**

- **Overflow and text:** no horizontal scroll; 0 elements outside the
  viewport; 0 clipped, spilling or under-12.5px text.
- **Mid-word breaks:** none in app copy except "Spa-Francorchamps", which
  breaks at its real hyphen (allowed). The galleries break only
  development-only captions: Flutter state names, file paths and
  `(content/media/…`.
- **Touch targets:** 0 under 48×48 on B and the media gallery. The state
  gallery's "Back to the prototype" annotation link is 131×24 (the approved
  `states.css`, not app UI).
- **Contrast:** minimum 7.02:1 on flat backgrounds (7.44 in the galleries).
- **Title gap:** EN 209.52 / 139.52 / 165.98 / 95.98, ES 199.05 / 129.05 /
  151.16 / 81.16 (390, 320, 390 at 200%, 320 at 200%). The title stays at
  `wdth` 118.
- **Header modes:**
  - pinned at normal text;
  - EN 390 @200% stays pinned with the selector condensed;
  - ES 390 @200% is `scroll` with the selector stacked;
  - both languages at 320 @200% are `none`.
- **Selected nav label:** `wdth` 62 / 700 whenever the nav is condensed or
  stacked (ES 320@100 and all 200% cases); otherwise `wdth` 100 / 800. It
  always fits.

**Category content** is covered by element text and accessibility-tree
equality in every category and both languages, including:

- Drivers: names, team or none, number and code, Position / Points labels,
  missing number, unranked with Points 0.
- Teams: season-aware names, line-up codes (GAS · DOO · COL), points and
  position, power unit when present, team accents.
- Circuits: names, locations, related events, 5.793 / 7.004 km and
  5,793 / 7,004 km.
- Every row's chevron.

## 7. Accessibility and interaction comparison

- **Accessibility trees identical:** 10 page/category trees, saved in
  `sw-pilot/`.
- **Keyboard order identical** in 12 walks: 13 stops on Drivers, 11 on Teams,
  10 on Circuits, with matching focus-ring pixels.
- **Forced `:hover` / `:active`** on the actions, unselected segment, driver
  rows, team row and nav tab: pixel-identical.
- **Category behaviour** (EN/ES, 390@100 and 320@200). Seven assertions hold
  in both versions, with identical states:
  - the first switch opens at the top;
  - a repeated tap changes nothing;
  - Circuits opens at the top;
  - Drivers' offset is restored (400);
  - Teams' offset is restored (120);
  - Enter selects;
  - Space selects.
- **Navigation links:** resolved hrefs are compared per element, and every
  row and tab link resolves to the same target.
- **Reduced motion:** identical computed styles and pixels; the progress line
  is static.

## 8. Regressions and their resolution

None. No difference appeared in any run, so no correction was needed.

Tool changes made for Explore, all narrow:

- `pilotFile` for pages at another depth in the pilot.
- URL normalisation per page.
- `freezeAnimations` for the looping refresh line.
- `scrollTo` steps.
- Each element's own text added to the DOM comparison.

They triggered the Standings and Calendar rechecks below.

## 9. Standings and Calendar after this step

| Check | Pairs | Differing pixels | Other diffs | Folder |
|---|---|---|---|---|
| Standings pilot (now on the shared selector) | 168 | 0 | 0 | `../standings/validation-20261109-183220-recheck/` (+ control 0) |
| Calendar pilot (utility change only) | 119 | 0 | 0 | `../validation-20261109-183220-calendar-recheck/` (+ control 0) |

The earlier evidence folders were not touched.

## 10. Ready for grouped detail-screen consolidation?

**Yes, as a group of four pilots run one at a time:** GP Detail, Driver
Detail, Team Detail and Circuit Detail. The method now covers:

- generated and hand-written pages;
- deeper folders;
- galleries with animations;
- interactive state scenarios;
- shared components with screen geometry kept local.

The utility takes a config per screen.

What the group still needs before or during extraction:

- **Detail app bar:** four identical copies plus the Settings and information
  variants (XS-07 title rule). Share the four, keep the variants local.
- **Chips:** the GP additions are copied into Driver, Team and Circuit; one
  unknown treatment is still open (XS-11).
- **Empty-state sizes:** detail screens use 28px / 18px. Keep them as the
  detail local extension; no default is chosen.
- **Team-colour edge (XS-25):** Team Detail has TM-03. Do not spread it in a
  regression pilot.
- **12° geometry (XS-27):** the GP winner cell's fixed 17px run. Keep it
  local.

The new inconsistencies from all three pilots are recorded under XS-09 in the
backlog: notice wrap, empty-state sizes, selector padding, and the
`data-header="none"` extension. No new backlog ID was created and nothing was
closed or approved.

Nothing beyond Explore was migrated.
