# Team Detail consolidation pilot: report

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
here.** The reference is the approved `../../team-detail/` with its
refinement (TM-01 to TM-03, provisionally approved). PD-12, TEAM-01 to
TEAM-06 and the core policies in
[`../../CORE-DESIGN-DECISIONS.md`](../../CORE-DESIGN-DECISIONS.md) stay
pending. The approved folder is unmodified. Method and shared files: as the
Driver pilot ([`../driver-detail/REPORT.md`](../driver-detail/REPORT.md)).
Group summary: [`../DETAIL-GROUP-SUMMARY.md`](../DETAIL-GROUP-SUMMARY.md).

**Result: pixel-identical to the approved prototype** in 74 runs
(187 screenshot pairs) under deterministic software rendering. Element
text, DOM, computed styles, boxes, accessibility trees, focus order,
navigation routes and 86 data assertions are identical in both
versions too.

## Files

| Path | What |
|---|---|
| `build.py` | Imports `../../team-detail/build.py` **read-only**. Checks that it still reproduces the eight approved pages byte for byte (`--check`), then writes them with one change: the `primer-core.css` link becomes the shared-foundation links |
| `index[.es].html` | Scenario A, complete (the Alpine fixture). Diff against the approved file: the head link block only |
| `returning[.es].html` | Scenario B, a returning driver (two entries for one driver). Same diff |
| `partial[.es].html` | Scenario C, partial (banner only). Same diff |
| `states[.es].html` | The 14-frame development gallery. Same diff; its links are sibling pages, present here too |
| `td.css` | Approved `td.css` minus the same 10 rules as Driver (now in `../../shared/`), plus a header note. Everything else verbatim, in order |
| `states.css` | Byte-identical copy |
| `validation-20261109-220615-regression/` | `sw-pilot/` (summary, results, 8 accessibility trees, first screenshot per static run) and `sw-control/` |

All in-page links are hash routes (`#back`, `#drivers/<id>`,
`#standings/constructors/<season>`) or sibling pages. No link was rewritten.

## 1. Shared rules extracted or reused

The same treatment as Driver Detail:

- **Reused:** tokens, base, `.icon-btn`, section title, chips, `[hidden]`,
  the notice common subset (with the local `text-wrap: pretty`), and
  `.empty` / `.empty__msg` / `.btn`.
- **Extracted:** `.dbar` / `.dbar__title` into `detail-app-bar.css`, and the
  28px / 18px empty-state size into `empty-state-detail.css`.

The linked shared files are the same nine as Driver.

## 2. Team-specific rules kept local

- **Entrant banner:**
  - the season line;
  - the season-aware name;
  - the stable constructor name with its visually hidden "Team" term (TM-02);
  - nationality;
  - the **team-colour livery rail** cut at 12° with `clip-path` (XS-27);
  - the **TM-03 Chalk edge** (`.tb--edge`), applied by `build.py` from a
    measured contrast, unchanged.
- **Line-up:**
  - car rows with number and code;
  - the team-colour seam and its `.lu--edge` variant;
  - the Ember observed-boundary text;
  - the hit area with pressed and focus states, and the chevron.
- **Championship strip** (position | points | wins) and its `.dest` row.
- **Spec sheet, About, skeleton.**
- **Detail-screen leftovers** identical elsewhere but not extracted:
  `.page`, `.page-notice`, `.sec`, `.sec__title`, `.about`, `.chip--outline`,
  `.btn:hover`.

`.dest` has the same declarations as Driver's `.ch__link`, but a different
class. Sharing it needs a common class, which is a markup change. It is
recorded, not extracted (group summary §3).

## 3. Requirement checks (task §5)

Asserted in both versions, EN and ES, at 390×844 @100% and 320×693 @200%:

- **Identity:** the season-aware name "BWT Alpine Formula One Team", the
  stable identity "Alpine" and the season line (2026).
- **Alpine roster:**
  - exactly three distinct entries: `2026-jack-doohan`, `2026-pierre-gasly`,
    `2026-franco-colapinto-7`. Nothing is merged into a current-driver list.
  - **ordering unchanged:** DOO #7, GAS #10, COL #43 (the DAO's roster order,
    TD-02).
  - roles kept on every row.
- **Spans:**
  - Doohan "Until round 6" / "Hasta la ronda 6", Colapinto "From round 7" /
    "Desde la ronda 7";
  - **Gasly's null/null entry shows its role and no span**;
  - **"From season start" / "Desde el inicio de la temporada" appears on no
    Team page**, gallery included. Driver Detail's wording was not
    introduced; the difference stays open (TEAM-05).
- **Links:** every entry links its own driver.
- **Colour:**
  - Alpine `#0093CC` on the banner and the line-up, with no edge, since it
    is above 3:1;
  - in the gallery, the Chalk edge appears on `#1E41FF` (Red Bull) only,
    both on the banner and the line-up. TM-03 is preserved.
- **Championship:** three figures, the constructors' standings route, and
  the power unit "Renault".
- **Returning driver (B):** two entries for one driver,
  `2026-jack-doohan` and `2026-jack-doohan-12`, "Until round 6" before "From
  round 12".
- **Partial (C):** one notice and the banner only. No line-up, championship
  or About is invented.

## 4. Regression results

`../tools/visual-compare.mjs team-detail.config.mjs`. Chrome 157.0.8103.38,
software raster, DPR 2, mobile with touch, one session.

**Runs (74):**

- 32 static: 8 pages × 2 sizes × 2 text scales.
- 14 keyboard walks.
- 4 forced-state runs.
- 6 navigation runs.
- 16 data runs.
- 2 reduced-motion runs.

| Run | Pairs | Differing pixels | Text / DOM / style / box / metric diffs | A11y-tree diffs |
|---|---|---|---|---|
| `sw-pilot` (pilot vs approved) | 187 | **0** | 0 | 0 |
| `sw-control` (approved vs itself) | 187 | 0 | 0 | 0 |

Measured, identical in both versions:

- **Layout:** no horizontal scroll; 0 elements outside the viewport; 0
  clipped, spilling or under-12.5px text.
- **Words broken across lines:** none in app copy. The gallery breaks only
  development captions (file paths, Flutter names, "line-up",
  "full-season").
- **Contrast:** minimum 7.44:1 on flat backgrounds. That is the Ember
  boundary text; Chalk and secondary text are higher.
- **Touch targets:** 0 under 48×48.
- **Detail app bar:** "Team" / "Equipo", never ellipsized, 57px, sticky in
  the scenarios.

## 5. Accessibility and interaction

- **Accessibility trees identical** (8 pages).
- **Keyboard order identical**, with matching focus-ring pixels:
  - A: 5 stops (Back, "View constructors' standings", then Doohan, Gasly and
    Colapinto: Championship comes before Drivers, TM-01);
  - B: 4 stops;
  - C: 1 stop;
  - each gallery: 15 stops.
- **Same accessible name on two stops:** B's two rows both read "Open driver
  Jack Doohan", as in the approved page. This is recorded, not classified:
  label parity is XS-04 and TD difference 7.
- **Forced `:hover` / `:active`:** back button, destination row, first
  line-up hit area, first row hover (chevron colour), and the gallery's
  retry button. Pixel-identical.
- **Navigation:** every route opens its own hash, nothing leaves the page,
  and Enter activates Back. All six scenario pages.
- **Reduced motion:** identical.

## 6. Regressions and their resolution

None in the pilot. The first recorded run (removed and replaced) had two
assertions false in **both** versions: my config double-escaped two regular
expressions (`/\\D/`). After the fix, the assertions were re-checked
offline against that run's recorded data (all true), and the whole config
was re-run. That run passed too, and was then superseded by this final run
with the corrected keyboard trace (group summary §6). The baseline was not
touched.

## 7. Still open (not resolved by this pilot)

- XS-25: one team-colour contrast rule. Team keeps TM-03; Driver's tick and
  Explore's do not have it.
- XS-27: the rail uses height-derived `clip-path`, the seam a skew.
- TEAM-05: the null/null wording difference from Driver.
- TEAM-02: no visible stable-name label.
- XS-03 / XS-04: reading order and label parity.
- XS-07: the title policy.
- XS-11: the provisional chip.
- PD-12 / TEAM-01: Flutter differences.
- Device checks.

## Addendum 2026-11-10: detail-page scaffold

During the Grand Prix pilot, `.page`, `.sec` and `.sec__title`, identical in
the four detail stylesheets, moved to the new
`../../shared/components/detail-page.css`. This pilot's stylesheet dropped
those rules and links the file last among the shared files. Nothing else
changed. Re-run against the approved prototype:
`validation-20261110-070509-recheck/` (0 differing pixels, 0 other differences,
control 0; see `../DETAIL-GROUP-SUMMARY.md`). The 2026-11-09 evidence above
is unchanged.
