# Calendar Stage 1 experiment (Step 48E)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a cross-screen experiment of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Status: provisionally approved, 2026-11-11 (Step 48F), as the preferred
Calendar visual and interaction direction** (`../../DESIGN-DECISIONS.md`
CT-03). Stage 1 is the preferred reference. The owner reviewed the six
screenshots marked in §6. Stage 2 (`../calendar-sticky-split/`) is kept as a
historical alternative.

This is a prototype approval only. It is not a final design, a fixture or a
Flutter contract, it is not production-ready, and it is not promoted into the
approved `../../calendar/` source. Every open item in §5 and in
`../calendar-sticky-split/DECISIONS-48D.md` §5 stays open. The conditional
snackbar in §4 is a candidate, not an approved component. The measurements
below are unchanged from Step 48E.

- **Built from** the title-fit variant (`../calendar-title-fit/`, CT-01),
  through `build.py`. Each change is a single asserted substitution;
  `--check` keeps the files current.
- **Unchanged:** the approved `../../calendar/`, the consolidation pilot, the
  title-fit and sticky-split experiments, Flutter and ARB files.
- **Structure:**
  1. title row (title, Refresh, Settings), always pinned;
  2. season row, always pinned;
  3. last-check caption and notices, moved unchanged and in the same order to
     the start of `<main>`;
  4. race entries.
- **No dynamic title release.** The sticky rule is unchanged (`top: 0`).
- **`calendar-stage1.js` does only two things:**
  - It publishes the measured header height. The page uses it, with the
    navigation's height, as scroll padding at the top and bottom.
  - It applies **L1**: a race row focused from the keyboard that is taller than
    the list area is aligned to its top edge. After a text-size or screen-size
    change, a focused row is brought back into view the same way.
- **Versions compared:**
  - **A:** title fit, notices in the header;
  - **B:** Stage 1;
  - **C:** Stage 2, the previous sticky-split experiment with title release.
- **How it was measured:**
  - `stage1-checks.mjs`: A, B and C, geometry and behaviour. A second run was
    byte-identical.
  - The consolidation tool:
    - B against A, with a control run;
    - B against C;
    - EN/ES × 390×844, 320×693, 693×320 × 100/200% × 4 states;
    - keyboard frames: initial, mid-list, round 22 and round 23 focused,
      bottom.
  - Environment: headless Chrome emulation, software raster, safe-area insets
    0. **Nothing here is an Android or TalkBack result.**

## 1. Stage 1 measurements

All figures are in CSS px.

- **Fixed header (title + season):** 112.5 at 200%, 90.75 at 100%. It is the
  same in every state and language, because notices no longer add to it.
- **Bottom navigation:** unchanged from A.
  - 154.78 when stacked: 320 wide at 200%, and Spanish at 390 wide at 200%.
  - 80.89 in landscape at 200% and English at 390×844 at 200%.
  - 68 at 100%.

**List area (space between the header and the navigation, when scrolled)**

| Viewport | A: default | A: worst state | B and C: every state |
|---|---|---|---|
| 320×693 @200% | 425.72 (61.4%) | 166.94 (24.1%), ES stale | **425.72 (61.4%)** |
| 390×844 @200% | 650.61 EN / 576.72 ES | 505.22 EN / 393.53 ES, stale | **650.61 / 576.72** |
| 693×320 @200% | 126.61 (39.6%) | 19.02 (5.9%), EN stale and ES failed/stale | **B 126.61 (39.6%)**, C 170.61 (53.3%) |
| 693×320 @100% | 161.25 (50.4%) | 110.25 (34.5%), failed/stale | **161.25 (50.4%)** |

- **Rows visible mid-list at 320 @200%:** A 0.57–1.37 when a notice shows;
  B 1.44–1.51.
- **Last row:** fully reachable in every portrait case. In A it was 44–80%
  visible with a notice.
- **At the top of the page** the notice is in the content, so the first
  screen looks as before. Default-state full-page frames are pixel-identical to A.
- **Stability:** 0 extra layout writes after settling, in every version and
  case. In the comparison runs, 0 frames were unstable and the control run
  differed by 0 pixels.

**Regression against A (85 runs)**
- Identical: visible text, all 100 focus stops (role, name, locator, link),
  touch targets and quality checks.
- The only quality finding, the landscape "23" numeral spill at 200%, is in A
  as well.
- 61 accessibility trees differ. Each has the same nodes in the same order,
  except that the caption and notices are now under `main` instead of
  `banner`.

## 2. What Stage 2 adds beyond Stage 1

Against Stage 1, Stage 2 changes nothing except landscape at 200%:
- **271 of 365 frames are pixel-identical.** All 94 differing frames are
  693×320 @200%.
- Accessibility trees and all 100 focus stops are identical.
- The only DOM differences are Stage 2's style variables and the
  `data-title-row` attribute.

| 693×320 @200% | Stage 1 (B) | Stage 2 (C) |
|---|---|---|
| Pinned header | 112.5: full title and season | 68.5: season only. A strip of the cut-off title glyphs and icons stays visible above the season row (screenshot below) |
| List area | 126.61 (39.6%) | 170.61 (53.3%), **+44** |
| Rows visible mid-list | 0.75 | 1.02 |
| Rows that fit whole (heights 167.08 for rounds 20–22, 213.56 for round 23) | **0 of 4** | 3 of 4 |
| Keyboard focus | Every row taller than the list area: top always visible; bottom 40.5–41.5 (rounds 20–22) and 86.2–87.6 (round 23) under the navigation | Rounds 20–22 fully visible; round 23's top 20.4–20.8 under the season row (no L1 rule) |
| Settings or Refresh from a row (Step 48D) | No movement: the title row never leaves | The page jumps 162 unless the scroll position is kept |

- Stage 2 would also release the title row on portrait screens up to about
  568 tall at 200% (Step 48D sweep).
- At 320×520 @200%, B's round 22 is 2.88px taller than the list area. With L1
  its top stays visible and 2.97px of its bottom is under the navigation.
- At 100% text and in every portrait size tested, B and C are the same.

## 3. L1–L5 results (`DECISIONS-48D.md` §2)

| Criterion | Result in Chrome | Not demonstrable in Chrome |
|---|---|---|
| **L1** Start visible | **Met in B.** The top of an oversized focused row is 0px hidden in every case: Tab, Shift+Tab from the Home tab back onto round 23, walks over rounds 20–23 in landscape, after rotation, after text 100→200%, and at 320×520. A hides up to 220.45. C hides 20.4–20.8 of round 23 | TalkBack's accessibility-focus movement |
| **L2** Fully reachable | **Met.** Scrolling round 23 to the list's top edge hides 0–0.5 at its top (whole-pixel scroll); scrolling it to the navigation hides 0–0.38 at its bottom. True in A, B and C | Touch scrolling on a device |
| **L3** Focus never entirely hidden | **Met.** Least visible share of a focused row in B: 0.59 (round 23, landscape @200%), with the ring's top edge visible. At 320 @200%: 0 of 76 walk stops hidden, against 26 of 76 in A | Android's focus highlight, the system bars |
| **L4** Complete accessible name | **Partly.** In Chrome the link's name is the whole row ("Round 23 Next Abu Dhabi Grand Prix Yas Marina Circuit Status unknown" / "Ronda 23 Siguiente …"), whatever is visible. It is identical in A, B and C | **Not demonstrable:** TalkBack reading and bringing the row into view. Flutter's row is one semantics node, `calendarEventSemantics`, which needs a device test |
| **L5** No compensation | **Met.** Text stays at 200%, the navigation keeps its height (80.89 / 154.78), and the season row stays pinned | Real navigation heights and insets |

- **Keyboard order:** the same as A in all 24 B and C walks (Refresh, Settings, rounds
  20–23, then the tabs). L1 only scrolls; it never moves focus.
- **Known limit, landscape @200%:** in B no row fits whole, so every focused
  row has its bottom under the navigation (40.5–87.6px). L1 and L2 accept
  this by design; it is what Stage 2 would improve.

## 4. Dynamic-status results

The order follows Flutter:
refreshing → failed → retry → failed again → retry → success → stale →
refresh while stale → success.
It was run at 320×693 and 693×320 @200%, in English and Spanish, once with a
row focused by Tab and once scrolled with nothing focused.

- **B, scrolled:**
  - The header stays at 112.5 throughout.
  - The row being read moves at most 0.7px; Chrome's scroll anchoring adjusts
    the scroll position.
  - The notice is 0px on screen until the user scrolls up.
- **A, scrolled:** the header grows to 335.38 (EN) / 410.97 (ES) during a
  refresh while stale. In landscape the list area falls to −20.67.
- **B, focused row 22, portrait:**
  - English: clear at every step.
  - Spanish: the row ends exactly at the navigation's edge, and sub-pixel
    anchoring leaves 0.66–0.75px under it on some steps. Stage 2 shows the
    same.
  - A: 40–117px under the header (EN), or 154px under the navigation (ES).
- **B, focused row 22, landscape:** the row is oversized. Its top is clear
  throughout, as L1 intends, and its bottom stays 40.6–41.3 under the
  navigation.
- **Same failure twice:** identical geometry each time. Nothing accumulates
  and no scroll drifts.
- **Announcements:** unchanged.
  - Two `role="status"` notices, no `aria-live`, the same in A, B and C.
  - The notice text, its conditions and the failure-over-stale precedence are
    unchanged.
  - Whether a status node off-screen in the DOM announces is a browser matter
    and is not tested. The Flutter risk (an unbuilt sliver) is in
    `DECISIONS-48D.md` §1.2.
- **Back from a Grand Prix:** scroll position and focus restored in all three
  versions. In B, round 22 is clear in portrait; in landscape its top is
  clear (oversized).

### Recommended conditional snackbar for future Flutter work (not implemented)

1. Only for a **newly appearing** problem whose notice is **outside the
   visible band**.
2. Nothing for normal refreshing or for success.
3. Not repeated while the same problem is unresolved. A failure after a
   user-started retry counts as new feedback.
4. Existing ARB text only.
5. One announcement per change: the notice announces while visible, the
   snackbar when it is not.
6. It never changes the scroll position or focus.

**Are the existing strings suitable at large text?** The string length was
measured in the notice's own font (28px at 200%), at the screen width minus a
floating snackbar's assumed 15px margins and 16px padding. This is an estimate,
not a Flutter render.

| String | 320×693 @200% | 390×844 @200% | 693×320 @200% | 390×844 @100% |
|---|---|---|---|---|
| `refreshFailedNotice` EN (38 characters) | 3 lines, ~141 (33% of list area) | 2 lines, ~104 (16%) | 1 line, ~66 (52%) | 1 line |
| `refreshFailedNotice` ES (50 characters) | 4 lines, ~179 (42%) | 3 lines, ~141 (25%) | 2 lines, ~104 (82%) | 2 lines |
| `offlineStaleNotice` EN (62 characters) | 4 lines, ~179 (42%) | 3 lines, ~141 (22%) | 2 lines, ~104 (82%) | 2 lines |
| `offlineStaleNotice` ES (80 characters) | **6 lines, ~255 (60%)** | 4 lines, ~179 (31%) | 2 lines, ~104 (82%) | 2 lines |

**Assessment:**
- **Refresh failure:** the string is short enough for a transient message in
  portrait.
- **Stale:** the string is too long. It runs to 4–6 lines at 320 @200%,
  Material's snackbar guidance allows at most two lines, and a 4-second
  timeout is short for 80 characters.
- **Recommendation:** use the snackbar for **refresh failure only**. Leave
  stale to the in-content notice: it appears without any user action and is
  only re-evaluated when the screen updates (§1.1 of `DECISIONS-48D.md`).
- **Landscape @200%:** any snackbar would cover 52–82% of the list area. It
  must be measured on a device so that it never hides a focused row entirely.
- Shorter stale copy would need a new ARB string, which is out of scope here.

## 5. Remaining limitations

- **Chrome emulation only.**
  - No Android system bars, insets, real fonts, TalkBack or touch.
  - L4, and the screen-reader part of L1 and L3, cannot be shown here.
  - The device tests in `DECISIONS-48D.md` §5 all stand.
- **Landscape at 200%:** no race row fits whole in Stage 1.
- **Flutter has no scroll anchoring.** Notices change above the viewport, so
  rows that stay still in Chrome need explicit compensation in Flutter
  (`DECISIONS-48D.md` §4).
- **Contract change:** the C13/C15 "always visible" contract changes
  intentionally (CT-03). The off-screen cue is a recommendation only.
- **Evidence size:** about 129 MB (B against A, all frames kept) and 29 MB
  (B against C, differing frames only). It is untracked and has no
  `.gitignore` rule.

## 6. Representative screenshots

In each folder's `sw-pilot/diffs/`. `-baseline` is the reference and `-pilot`
is Stage 1. **Reviewed** marks the six screenshots (three pairs) the owner
reviewed in Step 48F.

- **Stage 1 against A**, `validation-20261110-212520-stage1-vs-title-fit/`:
  - **Reviewed:** `es-stale-320x693-200-keyboard-mid-list-{baseline,pilot}.png` (Git-visible copy: `es-stale-320-200-mid-{base,pilot}.png`): the list
    area goes from 24% to 61%.
  - **Reviewed:** `en-failed-320x693-200-keyboard-focused-round-22-{baseline,pilot}.png` (Git-visible copy: `en-failed-320-200-r22-{base,pilot}.png`):
    the row was 155px under the navigation and is now clear.
  - `es-failed-693x320-200-keyboard-focused-round-23-{baseline,pilot}.png`:
    the top was 166px under the header and is now 0.
- **Stage 1 against Stage 2**, `validation-20261110-212520-stage1-vs-stage2/`:
  - **Reviewed:** `en-failed-693x320-200-keyboard-focused-round-23-{baseline,pilot}.png` (Git-visible copy: `en-failed-693-200-r23-{base,pilot}.png`):
    Stage 2 has 44px more list area but leaves a strip of the cut-off title
    and hides round 23's top by 20px. Stage 1 keeps the full title, and round
    23's start is visible with its status chip under the navigation.
  - `en-failed-693x320-200-keyboard-mid-list-{baseline,pilot}.png`.

## 7. Is Stage 2 genuinely necessary?

**No, not for this direction.**

- **Stage 1 meets the Step 48E criteria in Chrome:**
  - the visual identity is kept: default full-page frames are pixel-identical to A;
  - the full title and season are always visible;
  - notices no longer take list space: 61.4% at 320 @200% in every state;
  - focused content is reachable (L1–L3, L5);
  - every race and status value, every link and the keyboard semantics are
    unchanged;
  - nothing new is unstable.
- **Stage 2's gain is confined to landscape (and portrait screens up to about
  568 tall) at 130% text and above.** There it adds 44px, enough for 3 of 4
  rows to fit whole. The costs:
  - a cut-off title strip;
  - a focus jump that needs extra handling;
  - a decision that depends on the content;
  - a pinned sliver header in Flutter.
- **Recommendation:** adopt Stage 1 as the Calendar direction for owner
  review. Keep Stage 2 as an optional refinement, worth revisiting only if
  device testing shows landscape @200% to be a real use case that Stage 1's
  L1–L2 behaviour does not serve well.

## Reproduce

```
python build.py --check
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1.config.mjs [--control]
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1-vs-stage2.config.mjs
node stage1-checks.mjs
```

Evidence:
- `validation-20261110-212520-stage1-vs-title-fit/` (sw-control, sw-pilot);
- `validation-20261110-212520-stage1-vs-stage2/`;
- `validation-20261110-220347-stage1-dynamic/stage1.json`.
