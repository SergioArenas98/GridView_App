# Circuit Detail consolidation pilot: report

**Status: technical experiment, 2026-11-09. No decision is made or changed
here.** The reference is the approved `../../circuit-detail/` (CR-01 to
CR-03, provisionally approved). PD-13, CIR-01 to CIR-06 and the core policies
in [`../../CORE-DESIGN-DECISIONS.md`](../../CORE-DESIGN-DECISIONS.md) stay
pending. The approved folder is unmodified. Method and shared files: as the
Driver pilot ([`../driver-detail/REPORT.md`](../driver-detail/REPORT.md)).
Group summary: [`../DETAIL-GROUP-SUMMARY.md`](../DETAIL-GROUP-SUMMARY.md).

**Result: pixel-identical to the approved prototype** in 74 runs (152
screenshot pairs) under deterministic software rendering. Element text, DOM,
computed styles, boxes, accessibility trees (including the event link's
descriptions), focus order, navigation routes and 70 data assertions are
identical in both versions too.

## Files

| Path | What |
|---|---|
| `build.py` | Imports `../../circuit-detail/build.py` **read-only**. Checks that it still reproduces the eight approved pages byte for byte (`--check`), then writes them with one change: the `primer-core.css` link becomes the shared-foundation links |
| `index[.es].html` | Scenario A, complete (Spa, with its related Grand Prix). Diff against the approved file: the head link block only |
| `partial[.es].html` | Scenario B, partial (Monza: no facts, no record, never synced). Same diff |
| `no-event[.es].html` | Scenario C, no Grand Prix in the season. Same diff |
| `states[.es].html` | The 16-frame development gallery. Same diff; its links are sibling pages, present here too |
| `cd.css` | Approved `cd.css` minus the same 10 rules as Driver (now in `../../shared/`), plus a header note. Everything else verbatim, in order |
| `states.css` | Byte-identical copy |
| `validation-20261109-220615-regression/` | `sw-pilot/` (summary, results, 8 accessibility trees, first screenshot per static run) and `sw-control/` |

All in-page links are hash routes (`#back`, `#calendar/<season>/<round>`) or
sibling pages. No link was rewritten.

## 1. Shared rules extracted or reused

The same treatment as Driver and Team:

- **Reused:** tokens, base, `.icon-btn`, section title, chips (including
  `.chip--scheduled`, `.chip--context` and the dashed `.chip--unknown`),
  `[hidden]`, the notice common subset (with the local `text-wrap: pretty`),
  and `.empty` / `.empty__msg` / `.btn`.
- **Extracted:** `.dbar` / `.dbar__title` into `detail-app-bar.css`, and the
  28px / 18px empty-state size into `empty-state-detail.css`.

The linked shared files are the same nine as Driver.

## 2. Circuit-specific rules kept local

- **Circuit sheet:** the tray band, the most condensed name cut (`wdth` 72,
  hyphen-aware `.nobr`) and the location. It also holds the **dimension
  line**: arms with 12° ticks (CR-03), notation and not a scale, CIR-05 open.
  Then come the facts row with the decorative direction glyph, and the
  **media slot**: 16:9, reserved when an asset is selected, loading and
  failed geometry. This is the circuit's technical motif. It shares nothing
  with the Driver plate or the Team banner.
- **Lap record:** the timing readout.
- **Related Grand Prix:** the season line, the `.rx` row (round figure, 12°
  oxide seam, name, date, chips, disc) with its pressed and focus states, and
  the no-event statement.
- **GP chip additions** `.chip--done` / `.chip--alert`, copied from
  `gpd.css`. They stay local because XS-11 is open.
- **Detail-screen leftovers** identical elsewhere but not extracted: `.page`,
  `.page-notice`, `.sec`, `.sec__title`, `.btn:hover`.

## 3. Requirement checks (task §6)

Asserted in both versions, EN and ES, at 390×844 @100% and 320×693 @200%:

- **Identity:**
  - "Circuit de Spa-Francorchamps", Stavelot.
  - Length 7.004 km / 7,004 km, drawn with both dimension arms.
  - 19 corners, clockwise / "Horario", first Grand Prix 1950.
  - The lap record: 1:46.286, Valtteri Bottas, 2018.
- **Related Grand Prix (A):** one link to `#calendar/2026/13`, labelled "Open
  Belgian Grand Prix". Its three `aria-describedby` targets (round, date,
  chips) all exist. The season line sits in the related section. There is no
  media slot, because no asset is selected (CR-02).
- **No linked event (C):** the full sheet and record, the season line, "No
  Grand Prix this season" / "Sin Gran Premio esta temporada", and no link.
- **Partial (B):** one notice and a bare sheet: no length, facts or lap
  record. **The statement "No Grand Prix this season" is the approved copy
  and is reproduced unchanged.** The pilot neither adds nor removes any
  claim. It does not resolve the recorded distinction between a genuinely
  absent event and a season calendar that is missing or incomplete locally
  (`../../DESIGN-DECISIONS.md`, Circuit Detail season statement). That
  remains open. B shows the statement because the golden does, not because
  the pilot infers anything.
- **Gallery:** 16 frames, the loading skeleton, and the media slot's
  `--loading` and `--failed` geometry. No layout, diagram or photograph
  exists or was added.

## 4. Regression results

`../tools/visual-compare.mjs circuit-detail.config.mjs`. Chrome
157.0.8103.38, software raster, DPR 2, mobile with touch, one session.

**Runs (74):**

- 32 static.
- 14 keyboard walks.
- 4 forced-state runs.
- 6 navigation runs.
- 16 data runs.
- 2 reduced-motion runs.

| Run | Pairs | Differing pixels | Text / DOM / style / box / metric diffs | A11y-tree diffs |
|---|---|---|---|---|
| `sw-pilot` (pilot vs approved) | 152 | **0** | 0 | 0 |
| `sw-control` (approved vs itself) | 152 | 0 | 0 | 0 |

Measured, identical in both versions:

- **Layout:** no horizontal scroll; 0 elements outside the viewport; 0
  clipped, spilling or under-12.5px text.
- **Words broken across lines:**
  - none in app copy, at any size: "Spa-Francorchamps" stays whole.
  - the gallery breaks only development captions (file paths, Flutter
    names, "counter-clockwise", "lap-record", "2026-07-10").
- **Contrast:** minimum 7.95:1 on flat backgrounds in the app pages (7.44 in
  the gallery). Text over the sheet's gradient is listed as complex.
- **Touch targets:** 0 under 48×48.
- **Detail app bar:** "Circuit" / "Circuito", never ellipsized, 57px, sticky
  in the scenarios.

## 5. Accessibility and interaction

- **Accessibility trees identical** (8 pages). This includes:
  - the layout image's `role="img"` label in the gallery;
  - the event link's description;
  - "Open Grand Prix name unavailable" for the unnamed event.
- **Keyboard order identical**, with matching focus-ring pixels:
  - A: 2 stops (Back, "Open Belgian Grand Prix");
  - B and C: 1 stop each;
  - each gallery: 12 stops.
- **Forced `:hover` / `:active`:** back button, the related-event row (with
  the disc nudge), and the gallery's retry button. Pixel-identical.
- **Navigation:** every route opens its own hash, nothing leaves the page,
  and Enter activates Back. All six scenario pages. Loop protection (Grand
  Prix → Circuit → the same Grand Prix pops) is Flutter behaviour and cannot
  be simulated here (XS-19).
- **Reduced motion:** identical.

## 6. Regressions and their resolution

None. One assertion was corrected before running: Spanish keeps the
fixture's "Stavelot, Belgium" verbatim, so the location check tests the
locality only. The first recorded run passed (0 differences). It was
superseded by this final run with the corrected keyboard trace (group
summary §6).

## 7. Still open (not resolved by this pilot)

- The absent-event vs incomplete-local-calendar distinction (above).
- CD-08: season-relative copy.
- Difference 6 / PD-13: the season line placement.
- XS-11 / CD-14: the dashed unknown chip.
- XS-27: dimension ticks and the round seam are skewed layers.
- CIR-05 / CIR-06: the scale reading and the 320dp facts wrap.
- XS-15 / CD-12: media validated by geometry only.
- XS-04 / CD-06: the link description.
- XS-07: the title policy.
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
