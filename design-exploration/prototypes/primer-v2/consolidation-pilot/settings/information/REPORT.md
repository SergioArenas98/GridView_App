# Settings information screens: consolidation pilot report

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../README.md#validation-output).

**Status: technical experiment, 2026-11-10 (Step 45).** No decision is made
or changed here. The approved prototype `../../../settings/information/` is
unmodified. Group summary:
[`../../SETTINGS-GROUP-SUMMARY.md`](../../SETTINGS-GROUP-SUMMARY.md).

## Scope

Thirteen scenario pages in English and Spanish, as approved (SI-01 to
SI-04), and the eleven-frame development gallery:

| Screen | Scenarios |
|---|---|
| Data and updates | D1 remote production; D2 bundled sample; D3 frozen capture of 2026-10-07; D4 unverified origin; D5 current season unavailable |
| Data and updates, "Not configured" | gallery frame 10 (the only existing fixture: production configured for fixtures, SETT-13) |
| Acknowledgements | A1 production record loaded, media known empty; A2 development frozen capture (the status is overridden) |
| Acknowledgements, other states | gallery frames: loading, unreadable record, record with no sources, credits unknown, credits populated, active and dormant test sources, open failure |
| Privacy and legal | P1 policy + Active; P2 policy + Starting; P3 no policy + Not confirmed; P4 development, no policy (missing-policy explanation) |
| Privacy and legal, other states | gallery frame 9: production whose diagnostics never activate (no session line) |
| App information | I1 metadata resolved (golden fixture); I2 metadata unreadable |

## How the pilot is built

- `build.py` imports the approved generator read-only. That generator reads
  the ARB files and **`content/attribution/data-sources.json` itself**, so
  the record comes from the repository source and is never retyped.
- One change per page: `../primer-core.css` becomes
  `../../../shared/tokens.css`, `base.css`, `components/app-bar.css` and
  `components/notice.css`.
- `../settings.css` (the root pilot's copy), `information.css` and
  `information.js` keep their links.
- `--check` confirms all 28 approved pages are reproduced byte for byte and
  that `information.js` is identical.
- **Back links:** `../index[.es].html` and `../non-production[.es].html` now
  resolve to the root pilot, as the approved pages resolve to the approved
  root. The comparison normalises both Settings roots to `<settings>/`
  (`sharedRoots`), so the targets compare equal.

## 1. Components reused

- **Core:** tokens, base and app-bar (Back), as for the root. The root
  `settings.css` brings rows, kicker, snackbar, annotations and gallery.
- **Shared notice (new for Settings).** The approved `.notice` rule was a
  complete copy. Seven of its declarations equal the shared notice's: flex,
  alignment, gap, radius, tray, border, and the icon's size and colour.
  `information.css` now keeps only the reading-width variant:
  - margin;
  - 12px 14px padding;
  - 15px / 1.45 text;
  - 36em measure;
  - the icon's 1px offset.

  The rendered notice is identical (see the results). The notice header in
  `shared/components/notice.css` records this; no shared rule changed.

## 2. Components newly extracted

None. Facts (`.fact`, label above value), long-form text, the attribution
source block, the external-link row (`.xrow`) and the states (`.istate`,
`.skel`) have no second consumer. Driver and Circuit Detail have `.fact` and
`.skel` classes with different rules.

## 3. Intentional Settings-specific variants (kept local)

- **App-bar title:** the approved multi-line rule plus the S-2 fit
  (`information.js`), which narrows the width axis for one overlong word
  ("Agradecimientos" at 320 @200%) and scales only as a last resort. The
  title is never truncated. No detail-bar behaviour is applied.
- **Notice:** the reading-width variant above.
- **Acknowledgements external rows:** keep Flutter's open-in-new glyph.

## 4. Regression results

Final evidence: `validation-20261110-094550-regression/` (`sw-pilot`,
`sw-control`), Chrome 157.0.8103.39, software raster. Long pages use
viewport-step captures to the end of the document, with coverage recorded
per run; the gallery uses full-page segments.

| Version | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Assertions true in both versions | Scroll coverage complete |
|---|---|---|---|---|---|---|---|
| Pilot vs baseline | 206 | 392 | **0** | 0 | 0 | 296 / 296 | 105 / 105 |
| Control (baseline vs baseline) | 206 | 392 | 0 | 0 | 0 | 296 / 296 | 105 / 105 |

The longest page, Spanish Acknowledgements at 320×693 with 200% text, is
4,700px tall and was captured in 8 viewport steps to its end. In every run,
in both versions:
- no horizontal scroll;
- 0 clipped, spilled, outside-viewport or sub-12.5px text;
- no target under 48×48;
- lowest contrast 7.44:1.

## 5. Content equivalence and localization

**Content equivalence.** Every check reads its expected value from the ARB
files or `data-sources.json` and must hold in both versions:

- **Acknowledgements:**
  - the independence statement first;
  - the heading order Data → Data sources → provider `h3` → Media;
  - the data-source value: "GridView service" on A1, the frozen label with
    2026-10-07 on A2.
- **The provider notices, verbatim:**
  - operational status: Automatic on A1, the frozen-capture status on A2;
  - modification notice;
  - licence notice, with the provider and licence filled in;
  - non-endorsement statement.
- **The licensor-supplied notices, verbatim:** "Source notice" carries the
  record's English warranty disclaimer. Absent credit and copyright notices
  render nothing.
- **External links, exactly:**
  - project, terms and licence `href`s;
  - the displayed host and path;
  - the licence name and its full title;
  - `target="_blank"`, `rel="noopener noreferrer"` and the open-in-new glyph.
- **Media credits:** "known empty" on A1 and A2. The gallery covers loading,
  unreadable, populated and open-failure states.
- **Spanish pages.** The provider notice and the licence title stay English,
  with `lang="en"`, exactly as approved (SETT-20, unchanged). The complete
  Spanish 390×844 composition (SI-02), including its lower section, renders
  pixel-identically. Licensing compatibility (SETT-18) is not affected by
  CSS.
- **Data and updates:**
  - environment, data source, API version and current season in order, with
    the right explanation for each mode;
  - D5 keeps the offline explanation with no season stored, as tracked by
    SETT-16, not rewritten;
  - no refresh or synchronization action.
- **Privacy and legal:**
  - statement, "Privacy" heading and diagnostics note;
  - crash and performance policy (configured or disabled), advertising
    disabled;
  - the session line only in production with an activation reading;
  - the policy button only when a policy is configured;
  - the missing-policy explanation only outside production;
  - no switches or permissions.
  - The note still says "The line above" / "La línea anterior", the ARB
    text unchanged (SETT-12).
- **App information:**
  - application name;
  - a version row and a build row when resolved (I1), both omitted when
    unreadable (I2);
  - the statement last.

  The check does not fix the numbers: they are the golden fixture of a
  value Flutter resolves at runtime.
- **No text lost:** in every run, both versions have 0 clipped, spilled,
  outside-viewport or sub-12.5px text elements, and identical text content
  and boxes.

## 6. Accessibility and interaction findings

- **Keyboard order:** all stops are named. Acknowledgements:
  1. "Back"
  2. "Source project, github.com/jolpica/jolpica-f1"
  3. "Terms of use, github.com/jolpica/jolpica-f1/blob/main/TERMS.md"
  4. "License, CC BY-NC-SA 4.0, Creative Commons
     Attribution-NonCommercial-ShareAlike 4.0 International"

  Privacy P1 is "Back" then button "Read the privacy policy". Data, App
  information and P4 have only "Back". The gallery has only its fifteen
  hub links; the frames are inert.
- **External opening:**
  - with `openfail=1`, an attribution link shows `settingsOpenFailed`, does
    not navigate and keeps focus;
  - the privacy-policy button reveals the prototype annotation, with no
    address shown;
  - with `openfail=1`, the button shows the message only.
- **Pointer states:** forced `:hover` / `:active` on the external rows, the
  policy button, the static row and Back are identical.
- **Touch targets** are at least 48×48 in every run. Reduced motion is
  identical.
- **No spoken "leaves GridView" cue:** still open (SETT-11). An identical
  tree does not make that accessible.
- **Baseline observation (both versions, not a regression):**
  - at 320×693 (100% and 200%), the capture date "2026-10-07" (D3, A2)
    breaks across lines at its own hyphens;
  - so does "Attribution-NonCommercial-ShareAlike" in the licence title, at
    every size;
  - URLs break by design (`overflow-wrap: anywhere`).

  The approved rules allow breaks at real hyphens and keep only
  "BY-NC-SA" whole. Recorded under SETT-17 (unreviewed 320 / 200%
  captures).

## 7. Differences from Flutter that remain open

Unchanged by this pilot:
- the README's 20 differences: PD-19, SETT-10;
- SETT-11, 12, 13, 14, 16, 18, 19 and 20;
- SETT-15: fixture gaps;
- SETT-17: captures not owner-reviewed.

## Reproduce

```sh
cd consolidation-pilot/settings/information && python build.py --check && python build.py
cd ../../tools
node visual-compare.mjs settings-information.config.mjs --out ../settings/information/validation-<stamp>-regression/sw-pilot
node visual-compare.mjs settings-information.config.mjs --control --shots none --out ../settings/information/validation-<stamp>-regression/sw-control
```
