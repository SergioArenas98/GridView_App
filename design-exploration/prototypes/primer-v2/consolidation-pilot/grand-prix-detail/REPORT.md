# Grand Prix Detail consolidation pilot: report

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Status: technical experiment, 2026-11-10. No decision is made or changed
here.** The reference is the approved `../../grand-prix-detail/` (G-1 to G-9,
provisionally approved). Its nine Flutter differences, the sprint-results
release question and the core policies in
[`../../CORE-DESIGN-DECISIONS.md`](../../CORE-DESIGN-DECISIONS.md) stay
pending. The approved folder is unmodified. Method: as the Driver, Team and
Circuit pilots ([`../driver-detail/REPORT.md`](../driver-detail/REPORT.md)).
Family summary: [`../DETAIL-GROUP-SUMMARY.md`](../DETAIL-GROUP-SUMMARY.md).

**Result: pixel-identical to the approved prototype** in 105 runs
(385 screenshot pairs) under deterministic software rendering. Element
text, DOM, computed styles, boxes, accessibility trees, focus order, resolved
navigation targets and 144 data and title assertions are identical in
both versions too. It also covers app-bar truncation, via a labelled
development-only stress page (§3).

## Files

| Path | What |
|---|---|
| `build.py` | Imports `../../grand-prix-detail/build.py` **read-only** (build() not called, bytecode disabled). Checks that it still reproduces the six approved pages byte for byte (`--check`), then writes them with one change: the `primer-core.css` link becomes the shared-foundation links. It also writes the stress page (§3) |
| `index[.es].html` | Scenario A, upcoming. Diff against the approved file: the head link block only |
| `results[.es].html` | Scenario B, completed with results. Same diff |
| `states[.es].html` | The 26-frame development gallery. Same diff; its links (including `index.html?time=event|both`) are sibling pages, present here too |
| `gpd.css` | Approved `gpd.css` minus 13 rules now in `../../shared/` (§1), plus a header note and three pointer comments. Everything else verbatim, in order |
| `gpd.js`, `states.css` | Byte-identical copies. `gpd.js` keeps the `?time=device|event|both` presentation aid |
| `stress-title/title[.es].html` and `stress-title/baseline/title[.es].html` | **Development-only** title stress page (§3): the same markup, the same file name, the pilot's assets vs the approved assets |
| `validation-20261110-073121-regression/` | `sw-pilot/` (summary, results, accessibility trees, first screenshot per static run) and `sw-control/` |

## 1. Shared components reused or extracted

| Rule | Treatment |
|---|---|
| Tokens, base, `.icon-btn`, section title, core chips, `[hidden]` | Reused |
| `.dbar`, `.dbar__title` | Reused `detail-app-bar.css`. GP's copy was identical (verified 2026-11-09, re-checked). The `title` attribute on `.dbar__title` is markup from the generator, preserved |
| `.notice`, `.notice .icon` | Reused common subset; local `.notice { text-wrap: pretty; }` |
| `.empty`, `.empty__msg`, `.btn` | Reused `empty-state.css`. GP's `.empty--inline` modifier stays local and still follows `.empty` in the cascade |
| `.empty .icon` 28px, `.empty__title` 18px | Reused `empty-state-detail.css`. GP's sizes are identical to Driver, Team and Circuit |
| `.page`, `.sec`, `.sec__title` | **Extracted** to the new `shared/components/detail-page.css`. They are identical in all four detail stylesheets, and the Driver, Team and Circuit pilots switched to it in this step (rechecked, §7) |

Shared files linked, in cascade order: tokens, base, app-bar,
detail-app-bar, section-title, chip, notice, empty-state,
empty-state-detail, detail-page, then `gpd.css`.

## 2. Grand Prix-specific rules kept local

- **`.page-notice`:** `12px gutter 0`. The other detail screens have bottom
  padding too.
- **No `.btn:hover`.** Driver, Team and Circuit have one; GP never did. The
  forced-hover run on the gallery's retry button is identical in both
  versions, so no hover was introduced.
- **Chip additions:** `--done`, `--alert`, `--outline`, `--fastest`, `--sm`,
  `.icon--sm`. Unchanged (XS-11).
- **Identity band:** round figure | 12° oxide seam | season, name and
  official name, plus the fact rail and its 20em container query.
- **Circuit row `.cx`** with its disc nudge; **timetable** (`.sched`, `.day`,
  `.sess`, the time-zone caption, the clock modes); **classification**
  (`.cls`, `.cl`, the position rail, team links).
- **Winner cell** with the fixed 17px 12° `clip-path` run (XS-27, GPD-10).
- **Results section variants** (`.sec__head`, `.sec__notice`), the skeleton
  and the fixture banner.
- **Pressed states:** `.cl__hit:active` uses a 6% Chalk overlay, unlike the
  tray used by `.cx` and the other detail rows. It is kept as approved.

## 3. Long-title truncation

**Coverage gap in the approved fixtures.** No GP title truncates, at any
tested size or in either language. Measured in both versions: "Belgian Grand
Prix" and "Italian Grand Prix" need 316px at 390 and 246px at 320, which is
exactly the available width, including at 200%. The Spanish pages keep the
delivered English event names. The gallery's generic "Grand Prix" / "Gran
Premio" fits too.

**Development-only stress test** (`stress-title/`). It is labelled on the
page as not app UI, not a fixture, not race data and not a design proposal.
Each frame renders the approved `appbar()` and `hero()` with Scenario A's
fixture and one substitution: the event name, taken from the project's 2026
event registry (`content/registries/events.development.json`). The official
name is removed. No production fixture was changed. The baseline copy links
the approved `primer-core.css` / `gpd.css`; the pilot copy links the shared
foundation. Identical in both versions:

| Event name (registry) | 390×844 100% | 390×844 200% | 320×693 100% | 320×693 200% |
|---|---|---|---|---|
| "Barcelona-Catalunya Grand Prix" (30 chars) | fits (316 px) | **ellipsis** (316 of 375 px) | **ellipsis** (246 of 259 px) | **ellipsis** (246 of 375 px) |
| "United States Grand Prix" (24 chars) | fits | fits | fits | **ellipsis** (246 of 286 px) |

The same holds in English and Spanish. In every frame and size, in both
versions:

- **Compact title:** one line, ellipsized, exactly as approved. No new
  truncation rule was added, and the global title policy (XS-07) is
  untouched.
- **Full name kept:**
  - in the identity heading (`h1`), which wraps at the real hyphen
    ("Barcelona-" / "Catalunya") and is never truncated;
  - in the bar's `title` attribute;
  - in the bar's text.
- **Back stays usable:** 48×48 at every size and scale. The bar is 57px (56
  minimum plus the hairline). The title starts after the back button, ends
  inside the bar's padding, and never overlaps it. Keyboard focus reaches
  Back first (2 stops per stress page).
- **Accessible information is not lost.** The accessibility tree holds the
  bar's StaticText and its inline text box as the full "Barcelona-Catalunya
  Grand Prix". The ellipsis is visual only, and the heading has the full
  name too. The quality metrics list the ellipsized bar title as "clipped"
  in both versions: that is the truncation itself.
- **Pre-existing artifact, not introduced:** `hero()` writes
  `id="gp-name"` for every band. A page with several bands therefore has
  duplicate ids, and a later band's region takes the first band's name: 5
  times in the approved gallery, and in the stress page's second frame. On
  real screens there is one band per page. Recorded, not changed.

Not covered: Flutter's own title semantics. The final rule (wrap, narrow,
last-resort scale, or ellipsis with a full-name label) needs device
validation (XS-07, consolidation §5.1). TalkBack was not used.

## 4. Accessibility and interaction

- **Accessibility trees identical:** every page and clock mode, plus the
  stress pages.
- **Keyboard order identical**, with matching focus-ring pixels:
  - A: 2 stops (Back, "View circuit, Circuit de Spa-Francorchamps");
  - B: 8 stops (Back, circuit, then a driver row and its team link for each
    of the 3 rows);
  - each gallery: 46 stops;
  - each stress page: 2 stops.

  Each stop records its role, accessible name, locator and resolved target.
- **Forced `:hover` / `:active`:** Back, the circuit row (with the disc
  nudge), the winner's row (its overlay over the Oxide cell), a team link,
  and the gallery's retry button (no hover rule in either version).
  Pixel-identical.
- **Navigation:** every route opens its own hash: `#back`,
  `#circuits/spa-francorchamps` / `#circuits/monza`,
  `#drivers/<id>` and `#constructors/<id>` per classification row. Nothing
  leaves the page, and Enter activates Back. A and B, EN and ES.
- **Touch targets:** 0 under 48×48 in app pages.
- **Contrast:** minimum 7.44:1 on flat backgrounds.
- **Reduced motion:** identical, including Scenario A in the Both-clocks
  mode.

## 5. Race and sprint-session fixture coverage

Asserted in both versions, EN and ES, at 390×844 @100% and 320×693 @200%:

- **A, upcoming Belgian Grand Prix:**
  - round 13, the 2026 season, the official name "Formula 1 Mock Belgian
    Grand Prix 2026";
  - Upcoming + Sprint weekend chips;
  - circuit row to `#circuits/spa-francorchamps`;
  - **five sessions in delivered order:** Practice 1, Sprint Qualifying,
    Sprint, Qualifying, Race, in all three clock modes. All read Scheduled /
    Programada. Sprint sessions stay in the schedule.
  - Device clock by default: 10:30 UTC. Event clock: 12:30 CEST. Both: CEST
    first, then UTC. Europe/Brussels and UTC are shown as time zones.
  - No classification; "Results not available yet" / "Resultados aún no
    disponibles".
- **B, completed Italian Grand Prix:**
  - round 12, Completed / Finalizado, no official name;
  - **exactly one race classification:** "Race results", Final. **No sprint
    results** are shown or invented (release scope, race only).
  - order and positions as delivered: 1 Verstappen, 2 Norris, — Leclerc;
  - **winner highlight on row 1 only**, with the "Winner" / "Ganador"
    kicker;
  - 25 pts, 1:15:12.345; 18 pts, +3.210; Leclerc shows DNF, with no points,
    timing or position invented;
  - each row's driver and team routes.
- **Gallery:**
  - 26 frames, loading skeleton(s), three retries, and a generic title while
    loading or failed;
  - every visible bar with a heading carries the full name.
  - The gallery also holds, covered by text and accessibility-tree
    equality:
    - stale and refresh-failed notices; missing locality, country and time
      zone; unresolved circuit name;
    - unknown status and format; unknown, cancelled and postponed sessions;
      no start time; no sessions;
    - the event and both clocks, and a day-crossing time;
    - results loading, unavailable, failure, and refresh failed with saved
      rows; remote stale aggregation;
    - provisional; fastest lap; the finish statuses; duplicate positions;
      unresolved names; the status vocabulary; the fixture banner.
- **Not covered by any fixture:** a long Grand Prix name (stress page only),
  a 20-row race, sprint classifications (deliberately: race-only).

## 6. Pixel-regression results

`../tools/visual-compare.mjs grand-prix-detail.config.mjs`. Chrome
157.0.8103.39 (updated from .38 overnight; every 2026-11-10 run, the six rechecks included, used .39), software raster, DPR 2, mobile with touch, one session.

**Runs (105):**

- 64 static:
  - A and B, each in three clock modes, × EN/ES × 2 sizes × 2 scales (48);
  - the gallery (8) and the stress page (8), as full-page segments.
- 12 keyboard walks.
- 6 forced-state runs.
- 4 navigation runs.
- 16 data runs.
- 3 reduced-motion runs.

| Run | Pairs | Differing pixels | Text / DOM / style / box / metric diffs | A11y-tree diffs |
|---|---|---|---|---|
| `sw-pilot` (pilot vs approved) | 385 | **0** | 0 | 0 |
| `sw-control` (approved vs itself) | 385 | 0 | 0 | 0 |

Identical in both versions:

- **Layout:** no horizontal scroll; 0 elements outside the viewport.
- **Text:** no spilling or under-12.5px text. The only "clipped" text is the
  stress page's ellipsized bar title.
- **Words broken across lines:** real hyphens only in app copy
  ("Spa-Francorchamps", "Barcelona-Catalunya"). Development captions also
  break: the galleries' (`states.css` sets `hyphens: auto` on frame titles)
  and the stress page's (a file path, an opening quote).

## 7. Regressions and their resolution

None in the six approved pages, in any run. The first recorded run had 14
runs with differences, **all on the development-only stress page**, and 0
pixels:

- The baseline and pilot stress copies sat in one folder under different
  file names, so `href="#back"` resolved to different documents. Fixed:
  same file name, separate `baseline/` folder.
- An unbreakable registry path in the page note caused horizontal scroll at
  200% in both versions. It was moved to the frame captions, which wrap.
- One assertion was wrong: the Spanish event chip is "Finalizado"; sessions
  read "Finalizada".

The run was discarded and replaced by this one. The baseline was not
touched.

## 8. Open questions (unchanged by this pilot)

- G-1 to G-9 and the nine Flutter differences in the approved README, for
  example the visible Winner, the "pts" unit, the team-link layout, and name
  wrapping.
- **Sprint results:** the renderer still draws sprint classifications, while
  2.0.0 is race-only (audit §6.6, §8.4). Flutter tests assert separate sprint
  and race sections; the prototype shows race only.
- XS-07 / XS-06 (title policy, header budget), XS-11 (the "Status unknown"
  session state as grey text vs dashed chips), XS-27 / GPD-10 (the winner
  cell's fixed run), XS-03 / XS-04 (reading order and labels), XS-22 (notice
  icons), XS-12 (points unit).
- The blank-name hero heading (open; the app-bar fallback is closed), the
  `_raceDocument()` id, the duplicate `gp-name` id in multi-band galleries,
  and a long-name / 20-row fixture.
- Device, TalkBack and Android font scaling.
