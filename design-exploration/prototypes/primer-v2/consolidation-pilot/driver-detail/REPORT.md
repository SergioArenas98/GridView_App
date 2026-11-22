# Driver Detail consolidation pilot: report

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
here.** The reference is the approved `../../driver-detail/` with its
refinement (DR-01 to DR-03, provisionally approved). PD-11 and the core
policies in [`../../CORE-DESIGN-DECISIONS.md`](../../CORE-DESIGN-DECISIONS.md)
stay pending. The approved folder is unmodified. Method: the Explore pilot's
([`../explore/REPORT.md`](../explore/REPORT.md)). Group summary:
[`../DETAIL-GROUP-SUMMARY.md`](../DETAIL-GROUP-SUMMARY.md).

**Result: pixel-identical to the approved prototype** in 56 runs (146
screenshot pairs) under deterministic software rendering. Element text, DOM,
computed styles, boxes, accessibility trees, focus order, navigation routes
and 76 data assertions are identical in both versions too.

## Files

| Path | What |
|---|---|
| `build.py` | Imports `../../driver-detail/build.py` **read-only** (main() not called, bytecode disabled). Checks that it still reproduces the six approved pages byte for byte (`--check`), then writes them with one change: the `primer-core.css` link becomes the shared-foundation links |
| `index[.es].html` | Scenario A (complete). Diff against the approved file: the head link block only |
| `partial[.es].html` | Scenario B (404 with a real summary: partial notice). Same diff |
| `states[.es].html` | The 16-frame development gallery. Same diff. Its links (`index`, `partial`) are sibling pages, present here too |
| `dd.css` | Approved `dd.css` minus 10 rules now in `../../shared/` (§1), plus a header note. Everything else verbatim, in order |
| `states.css` | Byte-identical copy |
| `validation-20261109-220615-regression/` | `sw-pilot/` (summary, results with per-shot RGBA hashes, 6 accessibility trees, first screenshot per static run) and `sw-control/` |

No link needed rewriting: every in-page link is a hash route (`#back`,
`#constructors/<id>`, `#standings/drivers/<season>`) or a sibling page.

## 1. Shared rules extracted or reused

| Rule | Treatment |
|---|---|
| Tokens, base, `.icon-btn`, section title, chips | Reused (the folder's `primer-core.css` is byte-identical to the others) |
| `[hidden]` guard | Reused (`shared/base.css`) |
| `.dbar`, `.dbar__title` | **Extracted** to the new `shared/components/detail-app-bar.css` (identical in four detail screens) |
| `.notice`, `.notice .icon` | Reused common subset (`notice.css`). Local extension `.notice { text-wrap: pretty; }`, as approved |
| `.empty`, `.empty__msg`, `.btn` | Reused (`empty-state.css`) |
| `.empty .icon` 28px, `.empty__title` 18px | **Extracted** to the new opt-in `shared/components/empty-state-detail.css` (identical in four detail screens; list screens keep 32px / 20px locally) |

Shared files linked, in cascade order: tokens, base, app-bar,
detail-app-bar, section-title, chip, notice, empty-state,
empty-state-detail, then `dd.css`. `tag`, `text-link` and `nav` are not
linked: no element uses them (detail screens have no bottom navigation).

## 2. Driver-specific rules kept local

- **Identity plate:** the Red Oxide number board with its 12° skewed layer,
  the number-source label (DR-03), the season line (DR-02), the code-only and
  bare variants, the two stacking container queries, and the portrait layer.
  This is Driver's identity treatment, not a shared "hero".
- **Season participation:** span rows, the team-colour tick (skewed, height
  capped), the fallback team style and the hit area with its pressed and focus
  states.
- **Championship:** position | 12° seam | points, the narrow stacking query,
  the "more" row and the `.ch__link` destination row.
- **Profile facts, About, skeleton.**
- **Detail-screen leftovers** identical elsewhere but not extracted (see the
  group summary §3): `.page`, `.page-notice`, `.sec`, `.sec__title`,
  `.chip--outline`, `.disc`, `.btn:hover`, `.nw`.

## 3. Requirement checks (task §4)

Asserted in both versions, EN and ES, at 390×844 @100% and 320×693 @200%
(data runs), and covered everywhere else by text, attribute and
accessibility-tree equality:

- Season number on the board with its source label ("Race number" /
  "Dorsal de la temporada", #1, VER), and the **permanent number kept apart**
  in Profile ("Permanent number 33").
- Season context on the plate (2026).
- **Unknown participation start unchanged:** the null/null span reads "From
  season start" / "Desde el inicio de la temporada", Driver's existing rule.
- The relevant span links its team (`#constructors/red-bull`); position,
  points (402.5 / 402,5), wins, podiums and the standings route.
- Biography present on A; on B the nationality, biography, championship and
  permanent number are **omitted, not invented**, under one partial notice.
- Gallery: 16 frames, the loading skeleton, three empty states with two
  retries, the permanent-number fallback that says so, the mid-season move
  (two spans, one link), the unresolved constructor (fallback style, no
  link), and a bare plate without a board.

## 4. Regression results

`../tools/visual-compare.mjs driver-detail.config.mjs`. Chrome
157.0.8103.38, software raster, DPR 2, mobile with touch, one session.

**Runs (56):**

- 24 static: 6 pages (A, B and the gallery, EN and ES) × 390×844 / 320×693
  × 100% / 200%. Scenarios are scrolled; galleries are captured as full-page
  segments.
- 10 keyboard walks: the scenarios at 390@100 and 320@200, plus each
  gallery.
- 4 forced-state runs.
- 4 navigation runs.
- 12 data runs.
- 2 reduced-motion runs.

| Run | Pairs | Differing pixels | Text / DOM / style / box / metric diffs | A11y-tree diffs |
|---|---|---|---|---|
| `sw-pilot` (pilot vs approved) | 146 | **0** | 0 | 0 |
| `sw-control` (approved vs itself) | 146 | 0 | 0 | 0 |

Measured, identical in both versions:

- **Layout:** no horizontal scroll; 0 elements outside the viewport; 0
  clipped, spilling or under-12.5px text.
- **Words broken across lines:** none in app copy. The gallery breaks only
  development captions (file paths, Flutter names, "non-blocking" at its
  hyphen).
- **Contrast:** minimum 7.95:1 on flat backgrounds in the app pages (7.44 in
  the gallery). Text on the plate's gradient and on the board's slab is
  listed as complex, not measured.
- **Touch targets:** 0 under 48×48. The smallest is the back button, 48×48.
- **Detail app bar:** "Driver" / "Piloto", never ellipsized. Height 57px at
  every size: the 56px minimum plus the hairline, including 200%. Sticky in
  the scenarios; static inside gallery frames (`states.css`).

## 5. Accessibility and interaction

- **Accessibility trees identical** (6 pages, saved in `sw-pilot/`).
- **Keyboard order identical**, with matching focus-ring pixels: A has 3
  stops (Back, "Open team Oracle Red Bull Racing", "View drivers'
  standings"), B has 2, each gallery 13. The trace now records each stop's
  computed role and accessible name, a structural locator and its href (for
  example
  `link "Open team Oracle Red Bull Racing" main.page > section.sec:nth-child(2) > ul.stints > li.st > a.st__hit <page>/index.html#constructors/red-bull`).
- **Forced `:hover` / `:active`:** back button, span link (with the disc
  nudge), standings row and the gallery's retry button. Pixel-identical.
- **Navigation:** every link opens its own hash route, no link leaves the
  page, and Enter on Back opens `#back`. True in both versions, all four
  pages.
- **Reduced motion:** identical computed styles and pixels.

These are equality results. They do not confirm or refute the open reading
order (XS-03, Driver difference 7) or label parity (XS-04).

## 6. Regressions and their resolution

None in the pilot. Two of my own assertions failed in both versions on the
first control run: they expected English number formatting and guessed
Spanish labels. I corrected them from the approved Spanish pages ("Dorsal de
la temporada", "402,5") before the recorded runs. An earlier recorded run
also passed (0 differences). It was discarded when the keyboard trace's href
field was corrected (group summary §6), and the evidence here is the re-run
with the final tool. The baseline was not touched.

## 7. Still open (not resolved by this pilot)

XS-03 / XS-04 (reading order, label parity), XS-07 (title policy: the bar
still ellipsizes), XS-11 (provisional / unknown chip styling: the outline
chip stays local), XS-25 (the span tick renders the supplied colour without
an edge), XS-27 (12° geometry: board, tick and seam stay skewed layers),
PD-11 / DRV-01 (Flutter differences), and every device-only check (XS-02,
XS-05, XS-16).

## Addendum 2026-11-10: detail-page scaffold

During the Grand Prix pilot, `.page`, `.sec` and `.sec__title`, identical in
the four detail stylesheets, moved to the new
`../../shared/components/detail-page.css`. This pilot's stylesheet dropped
those rules and links the file last among the shared files. Nothing else
changed. Re-run against the approved prototype:
`validation-20261110-070509-recheck/` (0 differing pixels, 0 other differences,
control 0; see `../DETAIL-GROUP-SUMMARY.md`). The 2026-11-09 evidence above
is unchanged.
