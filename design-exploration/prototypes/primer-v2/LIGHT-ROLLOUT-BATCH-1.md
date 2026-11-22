# Primer V2 Light rollout, Batch 1 (Step 53C): Calendar, Driver Detail, Team Detail

**Primer V2 Light formally closed at the visual-design level (LT-18, Step
53F, 2026-11-13); roles frozen in `LIGHT-THEME-ROLES.md`.**

**Status: approved and visually closed (owner, 2026-11-13, Steps 53C.1 and
53D)** after review of ten representative screenshots and the LT-14
comparison; no new visual blocker. LT-13, LT-14 and LT-15 approved. This
closes no Flutter, Android, TalkBack or accessibility requirement. First full Light screen adaptations on the approved
B Motorsport direction (LT-1), with the approved Step 53B treatments (LT-4,
LT-5, LT-6, LT-11, LT-12). Not Flutter implementation, not Android or
TalkBack evidence, not WCAG certification. Batch 2 (Circuit Detail, GP
Detail, Settings) is in `LIGHT-ROLLOUT-BATCH-2.md`.

- **Prototype:** `cross-screen-refinement/light-rollout-b1/` (`build.py`
  derives 44 pages: the 36 Batch 1 pages and 8 LT-14 specimen pages;
  `light-b1.css` holds this batch's screen roles; `light-b1-alt.css` is the
  rejected LT-13 alternative, kept as the record; `lt14-*.css` are the LT-14
  comparison layers; `checks-b1.mjs`).
- **Structural references (only read):** Calendar = `calendar-stage1/`
  (CT-03, the preferred Calendar direction: title and season rows pinned,
  caption and notices scrolling). Driver and Team = `consolidation-pilot/`
  (pixel-identical to the approved prototypes). Each Light page is compared
  with the same page plus the frozen Dark overlays (DK-1 to DK-3).
- **Light chain:** the approved `light-foundations/` files, unchanged
  (`light-roles.css`, `light-b.css`, `light-bm.css`, `light-53b.css`), then
  `light-b1.css`. No new token, no new hue, no new font or media.
- **Evidence:** `light-rollout-b1/validation-20261113-071945-b1/`
  (`summary.txt`, `results.json`, 17 two-up PNG, 2.4 MB); LT-14:
  `light-rollout-b1/validation-20261113-174306-lt14/` (3 three-up PNG).

## 1. Validation summary (all three screens)

Ten page runs (Calendar default, stale, refreshing + failed; Driver index,
partial, states; Team index, partial, returning, states) at four sizes (EN and
ES 390×844 @100%, EN and ES 320×693 @200%): 40 Light-vs-Dark comparisons.

| Check | Result |
|---|---|
| Structure (DOM, text, attributes, boxes, document height) | 0 differences in 40 of 40 |
| Accessibility tree, Tab order, touch targets | identical in 40 of 40 |
| Layout quality (horizontal scroll, overflow, clipped or spilled text, text under 12.5px) | clean in 40 of 40, as Dark |
| Computed-style differences | colour properties only |
| Rendered text below 4.5:1 (3:1 large) | none, either theme |
| Focus visible at every Tab stop | yes, both themes |
| Focus rings: share of the ring path with a ≥ 3:1 change | 100% at every stop except the navigation tabs, which are 64–68% in **both** themes (ring bottom off-screen with zero insets; known since 53B) |

Percentages describe ring coverage in Chrome emulation; they are not a
compliance claim.

## 2. Calendar

**Roles applied:**
- page, pinned header and rows on the Light page;
- title Graphite; season label and circuit in secondary text;
- dashed "Status unknown" chips at Graphite 70%;
- stale and refresh-failed notices on the light band with an oxide icon;
- the B navigation bar (oxide selected slab, Chalk selected icon);
- hover and pressed tints from the role map.

**Next event:**
- the band becomes the light band (as Home's session band), keeping its
  hairlines;
- the flat Red Oxide round block (DK-2) and its Chalk numeral are unchanged,
  with the shadow taking a Graphite alpha;
- the "Next" label uses the oxide accent;
- the arrow disc becomes Graphite with a Chalk glyph (role map: discs on light
  are Graphite).

**Differences from Dark beyond colour:** none. Stage 1 pinning, chronology,
fixture rows and scroll padding are unchanged, and no sticky element is added.

**Contrast (rendered, EN 390):**

| Element | Dark | Light |
|---|---|---|
| Oxide block vs its band | 2.56 | 5.94 |
| Arrow disc vs band | 13.73 | 17.05 |
| Dashed chip on the page | 6.02 | 6.38 |
| Dashed chip on the band | 5.78 | 6.63 |
| Notice border | 2.13 | 1.60 |

The notice border is LT-8, still pending. The notice is carried by its icon,
words and fill, as in Dark.

**Responsive:** identical to Dark at all four sizes. At 320 @200% the round
number moves above the name and the block becomes a top-left tab.

**Focus:**
- Header buttons and ordinary rows: Graphite on the page, 100%.
- **Next-event row:** Dark draws a Chalk ring above the oxide block (DK-3).
  On the light band Chalk disappears, and Graphite on oxide is 2.80:1.
  - Graphite ring alone: 85% (lowest 2.80, along the block's top edge).
  - With the approved LT-4/LT-5 backing (a 5px inset band of the band colour
    under the ring while focused): **100% (lowest 6.09)** at all four sizes.
  - Nothing changes at rest. This applies an approved rule to a new
    component, so it is listed as LT-15.

**Not rendered by the fixture:**
- **Upcoming, completed and partial states:** the four sample rounds are all
  "Status unknown". The completed style (row opacity 0.72) is accommodated
  but not shown.
- **LT-14:** at 0.72, Light secondary text falls to 3.48:1 by calculation
  (3.53 rendered). Step 53C.1 compares full opacity with the smallest
  justified dimming on an isolated specimen: see §8.
- **Season selector:** none exists in the approved Calendar; the season is a
  label, so there is no selected-season control to adapt.

## 3. Driver Detail

**Roles applied:**
- plate on the light band (no Graphite panel, per LT-3);
- name Graphite; season and nationality in secondary text;
- **number board keeps its approved decorative gradient (DK-6)** and Chalk
  label, so the identity accent is unchanged;
- section titles, hairlines, the 12° championship seam (Graphite alpha) and
  the "View drivers' standings" row;
- the team-link disc becomes Graphite with a Chalk glyph;
- the retry button uses the Graphite primary fill (role map);
- the media scrim fades from the light band (states page geometry only).

**Differences from Dark beyond colour:** none. Through the shared detail app
bar, the back button inherits LT-11 (ring 1px from the button) in Light.

**Contrast (EN 390 and ES 320 @200%):**

| Element | Dark | Light |
|---|---|---|
| Board vs band | 2.06–2.09 | 7.20–7.30 |
| Disc vs page | 15.19 | 15.45 |
| Red Bull tick `#1E41FF` vs row | 2.83 (weak, XS-25) | 5.46, no edge needed |
| Provisional chip outline | 3.96 | 3.85 |

The Light page therefore resolves the Dark tick weakness without any
treatment.

**Responsive:** stacked plate at 320 @200% and the "wide" two-digit rule
unchanged. The Spanish board label "Dorsal de la temporada" wraps the same way
in both themes.

**Focus:** back, team link, standings link, retry and development links are
all 100% in Light (Graphite on the page or band). The back button's focused
neighbours p05 is 4.37 in Light against 1.95–2.82 in Dark.

**Missing data:**
- states 8 (permanent number fallback), 10 (unresolved constructor),
  14–15 (plate without number or code) and 16 (media geometry) carry over
  unchanged;
- the bare plate's name holds the light band alone.

## 4. Team Detail

**Roles applied:**
- banner on the light band (no Graphite panel); name Graphite; season and
  nationality in secondary text;
- championship strip with Graphite-alpha 12° seams; the
  "constructors' standings" row;
- line-up rows on the page, with the boundary words ("Until round 6",
  "From round 7") in the oxide accent;
- power unit and the other facts on the ruled sheet;
- retry button in Graphite; provisional chip outline at Graphite 55%;
- the media scrim fades from the light band.

**Team colour (LT-6 rule applied to its actual surfaces; supplied colours never
change):**

| Element, surface | `#0093CC` Alpine | `#1E41FF` Red Bull (states 10) | `#FF8000` McLaren (states 11) |
|---|---|---|---|
| Banner rail on band `#F7F7F8` | 3.24, no edge | 6.03, no edge (Dark edge dropped) | 2.35, **edge**: Graphite 2px above and below the bar, Graphite pinstripe; edge vs band 17.05 |
| Line-up seam on page `#EBECEE` | 2.94, **edge**: 1px Graphite each side; core vs edge 5.26 | 5.46, no edge (Dark edge dropped) | 2.13, **edge**; core vs edge 7.25 |
| Dark, for reference | 4.64 rail / 5.26 seam, no edge | 2.50 / 2.83, Chalk edge (TM-03) | 6.40 / 7.25, no edge |

**Why the edges flip between themes:**
- No colour can be below 3:1 on both the Dark and the Light surface. Below 3:1
  on `#141518` requires relative luminance under 0.1225; on `#EBECEE` it
  requires over 0.243. The tray/band pair gives 0.1456 and 0.2767.
- So every Dark edge disappears in Light, and only colours that pass in Dark
  can need a Light edge.
- This supports a single runtime rule for XS-25.

**Where the Explore tick rule does not transfer as-is (documented, not
blocking):**
1. **Line-up seam:** Dark widens the seam column to 4px (`.lu--edge`, a
   layout change chosen at build time from Dark contrast). Light keeps the
   Dark geometry and draws the edge outside the 2px seam as a box-shadow that
   follows the 12° slant. It looks the same, but the implementation differs.
   **Open (Step 53C.1):** the seam edge still needs a single shared
   implementation rule, one geometry for both themes (either the 4px column
   or the outside edge), decided before Flutter under LT-6 / XS-25.
2. **Banner rail:** the rail is a 12px bar plus a 3px pinstripe, not a tick,
   so the edge is a top and bottom frame inside the bar (as Dark TM-03)
   rather than a 1px outline. With no edge class in the markup, the McLaren
   pinstripe stays 3px; Dark's edged pinstripe is 2px.
3. **Colour selection:** the selectors stand in for the runtime contrast test
   Flutter would make, as in Step 53B.
4. **Development captions (corrected in Step 53C.1):** captions 10 and 11 on
   the states page quoted the Dark ratios ("2.5:1… Chalk edge", "6.4:1: no
   edge needed"), the opposite of what the Light page shows. The Light
   states pages (`td-states-light*.html`) now carry the Light values:
   "Light: 6.0:1 on the banner, 5.5:1 on the page: no edge needed" (10) and
   "Light: 2.4:1 on the banner, 2.1:1 on the page: Graphite edge on the rail,
   pinstripe and seam" (11). The Dark pages and the pilot keep the original
   captions. They are prototype annotations, not app strings; the HTML diff
   between the Light and Dark states pages is now the stylesheet links and
   these two headings only.
5. **Margin:** Alpine on the band (3.24) passes with little margin. A slightly
   different band value would flip it.

**Responsive:** at 320 @200% the line-up seams are hidden (narrow container),
as in Dark; the banner rail stays. The championship strip wraps to
position-over-points, as in Dark.

**Focus:** back, standings row, line-up rows, retry and development links are
all 100%. No ring crosses a team-coloured surface: line-up rings are inset 3px
inside the row, away from the seam column, and the banner has no focusable
element.

**Empty, unavailable and provisional states** (states 1–4, 7, 8, 13) carry over
unchanged. The returning-driver page (`.lu--plain`) has no seams, so no edge
applies.

## 5. Shared component consistency

| Role | Calendar | Driver | Team | Same as Step 53B roles |
|---|---|---|---|---|
| Page, band, hairlines | ✓ | ✓ | ✓ | yes |
| Graphite text, `#4F525A` secondary, oxide accent | ✓ | ✓ | ✓ | yes |
| Dashed unknown chip (70%), solid status outline (55%) | ✓ | ✓ | ✓ | yes |
| Notices (band, hair-strong border, oxide icon) | ✓ | ✓ | ✓ | yes (border = LT-8, pending) |
| Navigation (oxide slab, Chalk selected icon) | ✓ | n/a | n/a | yes |
| Primary button Graphite | n/a | ✓ | ✓ | yes |
| Arrow discs Graphite on light | ✓ | ✓ | n/a | yes (as Explore `.cx__disc`) |
| Focus: Graphite on light, Chalk on oxide, backing band where a ring crosses another fill | ✓ (LT-15) | ✓ | ✓ | yes (LT-4/LT-5 rule) |
| Decorative gradients (DK-6) kept | n/a | ✓ board | n/a | yes |
| Graphite panels | none | none | none | LT-3 respected; see LT-13 |

## 6. Owner decisions

The owner approved Calendar, Driver Detail and Team Detail at the Light
visual-design level on 2026-11-13 (Step 53C.1), with no new visual blocker.

| # | Decision | Status |
|---|---|---|
| **LT-13** | Driver plate and Team banner in Light: the light band, not the Graphite plane (`light-b1-alt.css`) | **Approved:** both keep the Light heading band; the Graphite alternative is not adopted; the decorative driver plate and the original team colours are preserved |
| **LT-14** | Completed Calendar rows in Light: opacity 0.72 drops secondary text to 3.53:1 rendered | **Approved (Step 53D): 100% opacity, no dimming** in Light; 0.85 rejected (negligible benefit, insufficient margin); §8 |
| **LT-15** | Calendar next-event focus: Graphite ring with the approved 5px band backing (LT-4/LT-5 rule) instead of Dark's Chalk ring | **Approved** (the owner reviewed the ES 320dp, 200% comparison); Flutter and Android focus validation open under XS-31 |
| LT-6 follow-up | Team Detail rail and line-up seam edges as in §4 | Evidence for LT-6; **the seam edge still needs one shared implementation geometry** (§4, item 1); XS-25 open |
| LT-7 to LT-10 | Final and Live chips, notice border (Light 1.60), selected navigation icon, DK-6 in Light | Still pending until their scope is reviewed |

**Still open:** LT-8 (with LT-7, LT-9, LT-10), XS-11, XS-25, XS-31, XS-32
and every Android and TalkBack requirement.

## 7. Screenshots for owner review

All are two-up, left Dark | right Light, unless noted. Folder:
`cross-screen-refinement/light-rollout-b1/validation-20261113-071945-b1/screens/`.

| File | Shows |
|---|---|
| `b1-cal-failed-en-390.png` | Calendar, refreshing caption + refresh-failed notice, full viewport |
| `b1-cal-stale-es-320-200.png` | Calendar, ES stale notice at 320 @200% |
| `b1-cal-focus-next-en-390.png` | Next-event row focused (LT-15) |
| `b1-cal-focus-next-es-320-200.png` | Same, ES 320 @200% (block as top-left tab) |
| `b1-dd-en-390.png` | Driver Detail, full viewport |
| `b1-dd-es-320-200.png` | Driver Detail, ES stacked plate |
| `b1-dd-focus-stint-en-390.png` | Team-link row focused (tick, disc) |
| `b1-dd-states-05-en-390.png` | Partial notice with content (state 5) |
| `b1-dd-states-15-es-320-200.png` | Plate with no number, code or nationality |
| `b1-td-en-390.png` | Team Detail, full viewport (Alpine rail, edged seams) |
| `b1-td-es-320-200.png` | Team Detail, ES 320 @200% |
| `b1-td-focus-lineup-en-390.png` | Line-up row focused, seam edges |
| `b1-td-states-10-en-390.png` | `#1E41FF`: Chalk edge in Dark, none in Light |
| `b1-td-states-11-en-390.png` | `#FF8000`: none in Dark, Graphite edge in Light |
| `b1-td-states-13-es-320-200.png` | Provisional chip, ES 320 @200% |
| `b1-lt13-dd-en-390.png` | Light (approved, LT-13) \| Graphite plate (not adopted) |
| `b1-lt13-td-en-390.png` | Light (approved, LT-13) \| Graphite banner (not adopted) |

## 8. LT-14: completed Calendar rows (Step 53C.1; approved Step 53D)

**Decision (owner, 2026-11-13): A, 100% opacity in Light.** Completion stays
communicated by the chip's existing label, check icon and solid boundary. B
(0.85) is rejected: negligible visual benefit and insufficient contrast
margin. The Italian Grand Prix row below is experimental comparison evidence
only; no approved Calendar data or fixture was changed. The approved
treatment is `lt14-a.css`; `light-b1.css` is unchanged, so the specimen's
"current Light" column stays reproducible as the pre-decision record.

**Specimen.** The approved Calendar fixture renders no completed row, and
marking one of rounds 20–23 completed would invent a status. The comparison
pages (`lt14-*.html`, built from `calendar-stage1/`, which is only read) add
one row taken from an existing approved fixture, the Grand Prix Detail
results pilot: 2026 season, round 12, Italian Grand Prix, Autodromo Nazionale
Monza, chip "Completed" / "Finalizado" with the check icon and the GP pilot's
solid status outline (`lt14-specimen.css`, `gpd.css` verbatim; DK-1 sets its
colour). Round 12 comes before rounds 20–23, so the persisted order holds.
The prototype note says where the row comes from. The approved Calendar
pages and fixtures are unchanged.

**Variants:** Dark (approved 0.72) · current Light (inherits 0.72, measured
only) · **A: full opacity** (`lt14-a.css`) · **B: 0.85** (`lt14-b.css`).

**Why 0.85, not 0.84:** 0.84 keeps secondary text at 4.53:1 but drops the
completed chip's solid status outline to 2.97:1 on the page; 0.85 is the
lowest value that keeps both (4.64 and 3.02 by calculation; 4.71 and 3.04
rendered).

**Rendered contrast, completed row on the page** (identical at EN 390×844
@100% and ES 320×693 @200%; measured with the row centred):

| Element | Dark 0.72 | Light 0.72 (inherited) | **A: Light 1.0** | **B: Light 0.85** |
|---|---|---|---|---|
| Circuit (secondary text, 15px) | 4.68 | **3.53** (fails 4.5) | 6.61 | 4.71 |
| Round number (large) | 4.68 | 3.53 | 6.61 | 4.71 |
| GP name | 8.26 | 6.82 | 15.45 | 10.53 |
| Chip word "Completed" / "Finalizado" | 8.26 | 6.82 | 15.45 | 10.53 |
| Chip status outline (non-text, 3:1) | 2.65 | 2.50 | 3.85 | 3.04 |
| Focus ring (perimeter ≥ 3:1) | 100%, min 4.38 | 100%, min 6.72 | 100%, min 15.45 | 100%, min 10.37 |

The ordinary row after it (round 20) is 6.61 / 15.45 in every Light variant.

**Structure:** in all six Light-vs-Dark comparisons, 0 hard differences;
accessibility tree, Tab order (11 stops; the completed row is stop 3) and
targets identical; layout quality clean (no clipped or missing text, no
horizontal scroll). Only colour properties and the row opacity differ.

**Findings:**
- **Opacity is never the only cue.** The completed state reads the same in all
  three variants through the chip: word, check icon and solid outline, which
  differs from the dashed "Status unknown" chip. In A, nothing is dimmed and
  the row is still clearly completed.
- **B gives little visual benefit.** At 0.85 the GP name moves from Graphite
  to dark grey (#333437) and the secondary text lightens slightly. The
  difference from the neighbouring row is subtle at 100% text and almost
  invisible at 200%. It uses up all the margin: secondary text 4.71 against
  4.5 and outline 3.04 against 3. Any anti-aliasing loss or a later palette
  change would push it under.
- **Opacity also dims the focus ring** (in Dark the Ember ring renders
  #B26954, min 4.38). In Light B it stays well above 3:1, but it is a second,
  unneeded loss.
- **Dark finding (no change made; Dark prototypes stay frozen):** at 0.72
  the Dark completed chip's solid status outline renders 2.65:1, under the
  3:1 that DK-1 gives undimmed outlines. Recorded against CAL-01 and XS-11.
  Formal Dark visual closure (DK-5) did not render this state and does not
  certify it. Completed rows have never been
  rendered (C12), so this is noted for the Flutter implementation and CAL-01,
  not reopened.

**Recommendation at the time: A (full opacity). Approved.**

**Screenshots** (three-up, Dark 0.72 | A Light 1.0 | B Light 0.85), folder
`cross-screen-refinement/light-rollout-b1/validation-20261113-174306-lt14/screens/`:

| File | Shows |
|---|---|
| `lt14-completed-en-390.png` | Completed round 12 above the ordinary round 20, EN 390 @100% |
| `lt14-completed-es-320-200.png` | Completed row alone, ES 320 @200% (at 200% the two rows do not fit between the pinned header and the navigation bar) |
| `lt14-focus-completed-es-320-200.png` | Completed row focused, ES 320 @200% |

## Reproduce

```
cd design-exploration/prototypes/primer-v2/cross-screen-refinement/light-rollout-b1
python build.py            # or --check
node checks-b1.mjs         # [--pages cal,td-states] [--no-screens] [--out <dir>]
node checks-b1.mjs --lt14  # LT-14 specimen only: 4 variants, EN 390 and ES 320 @200%
```
