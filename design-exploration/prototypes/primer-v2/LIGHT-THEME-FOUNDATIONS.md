# Primer V2 Light: foundations and palette exploration (Step 53A)

**Status: exploration, 2026-11-12. Neither direction is approved.** Nothing
here is a decision until the owner answers §9. This is a palette, surface and
semantic-role exploration on representative components only. It is not a
complete Light theme, not a screen conversion, not a Flutter token change and
not evidence of WCAG or Android compliance.

**Step 53A.1 follow-up (§11):**
- The owner reviewed the Step 53A comparisons. Direction B is the preferred
  starting point, and A reads too muted.
- §11 tests one controlled refinement, "B Motorsport".
- §1–§11 are kept unchanged as the Step 53A and 53A.1 records. A and the
  original B are historical references.

**Owner decisions, Step 53B (2026-11-12; recorded in
[`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md)):**
- **LT-1 approved:** B Motorsport is the Primer V2 Light visual direction,
  with both refinements (Home hero action strip, GP Detail heading band).
- **LT-2 approved with conditions:** the B neutrals are the Light baseline,
  pending wider component validation.
- **LT-3 approved with conditions:** Graphite editorial panels only in the
  reviewed contexts.
- **Unresolved:** LT-4, LT-5 and LT-6 (§12 proposes corrections).
- **Still open:** XS-25, XS-31, XS-32 and the device and accessibility items.

This is visual-direction approval, not Flutter implementation or WCAG
certification. Shared component roles and focus: §12.

**Owner decisions, Step 53C (2026-11-13), after the ten §12.6 comparisons:**
- **Approved (visual level):** LT-4, LT-5, LT-11, LT-12 as proposed in §12.5.
- **LT-6 approved as the preferred shared visual rule,** subject to
  validation in other team-colour contexts and to Flutter/Android
  implementation. XS-25 stays open.
- **Still pending:** LT-7 to LT-10, until their scope is reviewed.
- **Batch 1 rollout** (Calendar, Driver Detail, Team Detail):
  [`LIGHT-ROLLOUT-BATCH-1.md`](LIGHT-ROLLOUT-BATCH-1.md).

**Owner decisions, Step 53C.1 (2026-11-13):** Batch 1 approved at the Light
visual-design level, no new visual blocker. LT-13 approved (Driver and Team
keep the Light heading band; the Graphite alternative is not adopted). LT-15
approved (Calendar next-event focus backing; Flutter and Android focus
validation under XS-31). **LT-14 approved (Step 53D):** completed Calendar
rows keep 100% opacity in Light (`LIGHT-ROLLOUT-BATCH-1.md` §8). Batch 1 is
visually closed; Batch 2 (Circuit, GP Detail, Settings) is in
`LIGHT-ROLLOUT-BATCH-2.md` (approved, Step 53E: LT-7 Final, LT-8 keep 26%,
LT-10, LT-17 for Light). Readiness review: `LIGHT-READINESS.md`. Still open:
LT-7 (Live), LT-9, LT-16, LT-17 for Dark, XS-25 (including one shared
seam-edge geometry), XS-31, XS-32 and Android validation. Primer V2 Light is
not formally closed.

**Formal closure, Step 53F (2026-11-13, LT-18):** Primer V2 Light, B
Motorsport, is formally approved at the visual-design level; LT-9, LT-16 and
LT-17 (shared Dark/Light) approved; LT-7 Live keeps Ember with contextual
validation pending. Frozen roles: [`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md).
Not Flutter, Android or WCAG approval. This document stays the exploration
record: its "EXPERIMENT" and "proposed" wording below describes the steps as
they were, and Direction A and the rejected options stay as history.

§12.5 below is kept as the Step 53B record.

- **Reference:** Primer V2 Dark as frozen in
  [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md) (DK-1 to DK-6, approved). Light
  remaps those **roles**; it does not invert the hues.
- **Experiment:**
  [`cross-screen-refinement/light-foundations/`](cross-screen-refinement/light-foundations/).
- **Unchanged:** Flutter, ARB, the approved Dark prototypes, the
  consolidation pilots, the earlier experiments, `shared/` and the frozen Dark
  roles. They were only read.
- **Flutter, inspected read-only:** `lib/core/theme/` already builds a light
  `ThemeData` from `GvSemanticColors.light` (`GvColorsLight`: cool
  `#F1F4F9` background, `#C62719` red, blue secondary). It is the pre-Primer
  palette that Settings previews as a labelled stand-in (SP-01). It is **not**
  an input to the values below. The constraint it does impose: one semantic
  colour set per brightness, read through `context.gvColors`, guarded by
  `theme_contrast_test.dart`. A Light role table therefore has to be a flat
  list of named roles, which is what §3 provides (XS-28 decides the
  migration).

**Ratios.** "Computed" values are WCAG relative-luminance ratios of the CSS
colours, with alpha composited on the stated surface. "Rendered" values were
measured in headless Chrome 157 (software raster, DPR 2, mobile emulation,
root font size for 200%) against the adjacent rendered pixels. Chrome
emulation is not Android or TalkBack validation.

---

## 1. Design objectives

1. **Same identity, other light.** Graphite type, Chalk, Red Oxide and the
   12° livery cut stay the identity. No new brand colour, font or medium.
2. **Roles, not inversion.** Each frozen Dark role gets a Light value chosen
   for its job. Several Dark tokens carry two roles. For example, `--chalk` is
   both "label on oxide" and "inverse surface", and `--ember` is both
   "accent" and "focus ring". Light separates them (§3.4).
3. **Keep one contrasting plane per screen.** Dark gives Chalk to the Home
   championship band and the Standings leader row. Light gives those planes
   graphite: the "dark editorial element retained within Light".
4. **Status meaning unchanged.** Solid known-status outline ≥ 3:1. Dashed
   unknown outline stronger than solid. Confirmed = filled. Word first,
   never colour alone.
5. **Focus distinct from selection.** Focus is an outline whose colour
   contrasts with the surface it is drawn on. Selection is a fill.
6. **Geometry frozen.** No dimension, offset, shape, type or order changes.
   Only colours, backgrounds, shadows and outline colours change.
7. **Smallest new-token set.** Reuse existing Primer V2 colours. Name every
   new neutral and justify it.

## 2. The two directions

Both directions share every text, accent, status, focus and inverse role
(§3.2 to §3.4). They differ only in the **surface strategy**.

### Direction A: Warm Editorial

The page is warm paper, and Chalk panels are set into it, like a printed
page with tinted sidebars.
- Bands, notices, the selector container, the GP rail and the editorial card
  are Chalk `#ECEAE5`, one step *darker* than the page: tonal, inset
  surfaces.
- Drop shadows are almost absent; the card edge is a 5% Graphite hairline.
- The navigation bar is Chalk, the same sunken relation as Dark's
  `ground-low` bar.

**One new colour: Paper `#F5F4F0`.** Everything else is an existing Primer V2
value or an alpha of Graphite or Chalk.

### Direction B: Neutral Contrast

The page is neutral grey (`#EBECEE`), and near-white tiles are *raised* above
it.
- Bands, notices, the selector container, the rail and the navigation bar are
  `#F7F7F8`.
- The one elevated editorial card is white `#FFFFFF` with a soft shadow.
- Hairlines are 2 points stronger (14% / 26%).

**Three new neutrals** (`#EBECEE`, `#F7F7F8`, `#DCDDE1`). White is used only
for the single elevated card, not as a general surface.

## 3. Proposed values and semantic roles

Files: [`light-a.css`](cross-screen-refinement/light-foundations/light-a.css),
[`light-b.css`](cross-screen-refinement/light-foundations/light-b.css) (values)
and
[`light-roles.css`](cross-screen-refinement/light-foundations/light-roles.css)
(which role uses which value). **New** marks a colour that is not already a
Primer V2 value.

### 3.1 Surfaces

| Role | Dark (frozen) | A: Warm Editorial | B: Neutral Contrast |
|---|---|---|---|
| Main background (`--ground`) | `#141518` | **Paper `#F5F4F0` (new)** | **`#EBECEE` (new)** |
| Secondary surface: bands, notices, selector container, GP rail (`--tray`) | `#1F2125` | Chalk `#ECEAE5` | **`#F7F7F8` (new)** |
| Elevated card: Home editorial GP card | Lit graphite panel (`effect.*`) | Chalk `#ECEAE5` + 5% Graphite inset hairline, no drop shadow | White `#FFFFFF` + soft shadow |
| Raised: pressed, context chip, skeleton (`--raised`) | `#2A2D32` | chalk-low `#E2DFD8` | **`#DCDDE1` (new)** |
| Navigation bar (`surface.nav`) | `ground-low` 96% | Chalk 96% (sunken, as in Dark) | `#F7F7F8` 96% (raised) |
| Content panels: GP facts strip | Black 16% | Graphite 4% | Graphite 4% |
| Hover / pressed overlays | Chalk 3% / 6% | Graphite 3% / 6% | Graphite 3% / 6% |
| Shadows | Black 16–90% | Graphite 20–55%, softer | Graphite 6–60%, softer |

Computed separation (decorative, no information): page vs secondary surface
1.09 (A) / 1.10 (B); page vs card 1.09 (A) / 1.18 (B). Dark: 1.13 / 1.09.

### 3.2 Text, accent and lines (identical in A and B)

| Role | Dark (frozen) | Light (A and B) | Computed |
|---|---|---|---|
| Primary text | Chalk | **Graphite `#141518`** (= `on-chalk`) | 15.19–17.05 (A), 15.45–18.26 (B) |
| Secondary text, unselected labels | `text-2` `#A9ABB1` | **`on-chalk-2` `#4F525A`** | ≥ 6.50 (A), ≥ 6.61 (B) on page and bands; 5.87 / 5.76 on raised |
| Accent text and icons: kickers, "Next session", links, notice icon, Explore icons | Ember `#F08A6C` | **Red Oxide `#A03E2B`** (Ember on light is 2.08–2.23) | 5.43–5.93 (A), 5.52–6.52 (B) |
| `line.subtle` (`--hair`) | Chalk 12% | Graphite 12% (A) / 14% (B) | Decorative, 1.28 |
| `line.strong` (`--hair-strong`): notice border, seams, dev frames | Chalk 22% | Graphite 22% (A) / 26% (B) | Decorative, 1.60 / 1.77 |
| `line.status`: solid known-status outline | Chalk 45% | **Graphite 55%** | 3.84–3.96 (A), 3.85–4.05 (B) |
| `line.unknown`: dashed unknown outline | Chalk 60% | **Graphite 70%**, dashed | 6.19–6.46 (A), 6.22–6.78 (B); stronger than solid |
| Watermark (Home "22") | Chalk 11% stroke | Graphite 10% stroke | Decorative |

### 3.3 Status, selection and focus (identical in A and B)

| Role | Dark (frozen) | Light (A and B) |
|---|---|---|
| Solid chip (Completed, DNF, Provisional) | `line.status` | Graphite 55% on the light surfaces |
| Dashed chip (Status unknown) | `line.unknown` | Graphite 70%, dashed |
| Solid alert chip | Chalk 60% solid | Graphite 70% solid (as strong as dashed, as in Dark) |
| Confirmed chip (Final) | Chalk fill, graphite text + check | **Graphite fill, Chalk text** + check (15.19). Still "filled" |
| Live chip (not rendered here) | Ember fill, graphite text | Ember fill, graphite text (7.44); fill vs page 2.08–2.23. See LT-7 |
| Selected selector option | Flat oxide slab, Chalk 800 label | **Unchanged**: flat oxide, Chalk 800 label (5.43) |
| Unselected selector option | Tray, `text-2` 600 | Light tray, `#4F525A` 600 (6.50 A / 7.30 B) |
| Selected navigation tab | Oxide slab, icon and label in `--text` (Chalk) | Oxide slab. **Icon Chalk, label Graphite** 800 (one rule added, §3.4) |
| Unselected navigation tab | `text-2` 600 | `#4F525A` 600 |
| Focus ring on a light surface (default) | Ember on graphite | **Graphite `#141518`** |
| Focus ring on oxide (selected selector option) | Chalk | Chalk (unchanged) |
| Focus ring on an unselected selector option | Chalk (it can cross the slab tip) | **Graphite.** Chalk does not transfer (1.0 on Chalk tray). Residual at the slab tip, §6 L1 |
| Focus ring inside the inverse plane (Home championship links) | Oxide on Chalk | **Ember on graphite** (6.57–7.44) |
| Focus ring outside the leader row | Ember on graphite | Graphite on the page (the default ring) |
| Focus ring on the GP winner row (above the retained gradient cell) | Chalk | Graphite. Residual over the cell, §6 L2 |
| Notices: stale, refresh failed (error); provisional = status line | Tray + `hair-strong` border + Ember icon, text carries meaning | Secondary surface + `hair-strong` + **oxide icon**; text carries meaning |
| Team-colour tick | Supplied colour, no edge | Supplied colour, no edge (unchanged). Light flips which liveries are weak, §6 L3 |

### 3.4 Inverse plane and role separations (identical in A and B)

| Role | Dark (frozen) | Light (A and B) |
|---|---|---|
| Inverse plane: Home championship band, Standings leader row | Chalk → chalk-low gradient | **Graphite: tray `#1F2125` → ground `#141518`** (existing Dark values) |
| Text on the inverse plane | `on-chalk` / `on-chalk-2` | Chalk / Dark `text-2` `#A9ABB1` (13.41–15.19 / 7.02–7.95) |
| Accent on the inverse plane: leader position, kicker, links | Oxide (5.43 on Chalk) | **Ember** (6.57–7.44 on graphite): Ember's Dark rule "accent on graphite only" |
| Livery seam on the inverse plane | Oxide on Chalk | Oxide on graphite (2.47–2.80, decorative; see LT-3) |
| Solid outline on the inverse plane (leader Provisional marker) | `on-chalk` 55% | Chalk 45% = Dark `line.status` (rendered 3.92) |
| Small inverse controls: round arrow discs, primary button, pressed state toggle | Chalk fill, graphite glyph | Graphite fill, Chalk glyph |
| Retained decorative gradients (DK-6): Home round block, GP winner cell (Driver plate not rendered) | `effect.brand-gradient` | **Unchanged gradient.** Chalk text ≥ 4.63; shadow softened to Graphite 30% |

**Role separations Light needs (Dark tokens with two jobs):**
- `--chalk`: "label on oxide" keeps Chalk; "inverse surface" becomes graphite.
- `--ember`: "accent" becomes oxide on light, and stays Ember on the inverse
  plane; "focus ring" becomes graphite.
- `--text` on the selected navigation tab: Dark uses it for icon and label.
  In Light, graphite on the oxide slab is 2.80, so the icon keeps Chalk and
  only the label takes graphite. This is the one place where a Dark *rule*,
  not only a value, needs a Light variant.

### 3.5 New Light-specific tokens (proposal)

| Direction | New colours | Justification |
|---|---|---|
| A | **Paper `#F5F4F0`** | Chalk alone cannot be both the page and the panel. Paper is the lightest warm step that keeps Graphite at 16.59, oxide at 5.93 and lets Chalk read as a tinted panel |
| B | **`#EBECEE`** page, **`#F7F7F8`** band, **`#DCDDE1`** raised (+ white for one card) | No neutral light grey exists in Primer V2. All three are hue-matched to Graphite's slight cool cast |

Everything else is an existing value: Graphite, `on-chalk-2`, Chalk,
chalk-low, oxide, Ember, Dark tray and Dark `text-2`, or an alpha of
Graphite or Chalk. No new hue.

## 4. Rendered contrast measurements

Run: `validation-20261112-220528-53a/` (`summary.txt`, `results.json`). Every
Light page is measured beside its Dark reference with the same fixture.

### 4.1 Text

**Text, all pages:** 204 visible text runs per variant and size. No run is
below 4.5:1 in either Light direction, at EN 390×844 @100% or ES 320×693 @200%.
The lowest rendered values are:

| | A | B | Dark reference |
|---|---|---|---|
| Lowest | 5.43: Chalk on oxide (selected label, Winner tag), oxide on Chalk ("Next session") | 5.43 (Chalk on oxide); oxide on page 5.52 | 5.00 (oxide link on the Chalk band gradient) |
| Secondary text | 6.50 on Chalk bands, 7.10 on the page; 5.98 on the GP facts strip | 6.61 on the page, 7.30 on bands | 7.02–7.95 |
| Accent text on the page | 5.93 | 5.52 | Ember 7.44 |
| Inverse plane | Chalk 13.88–14.46; `#A9ABB1` 7.19–7.73; Ember 6.65–6.96 | Same | — |
| Navigation labels | 6.04–6.56 | 6.74–7.30 | — |

Text under a stretched link (Home editorial card, GP classification rows) is
covered by the link overlay, so it is not sampled. Computed values:
- Home card "Starts in 2 days": oxide on the card, 5.43 (A) / 6.52 (B).
- Card kicker and circuit: 6.50 (A) / 7.82 (B).
- Card title: 15.19 / 18.26.
- Round label and number: Chalk on the retained gradient, ≥ 4.63
  (unchanged).
- GP "Winner" kicker: oxide on the page, 5.93 / 5.52.

### 4.2 Fills and boundaries (EN 390×844 @100%)

| Sample | Dark | A | B |
|---|---|---|---|
| **Selected selector slab vs selector container** | **2.47** | **5.43** | **6.09** |
| **Selected navigation slab vs bar** | 2.92 | 5.48 | 6.09 |
| Inverse band vs page (Home) | 15.05 | 14.82 | 13.80 |
| Leader row vs page (Standings) | 14.39 | 14.99 | 13.55 |
| Editorial card vs page | 1.09 | 1.09 | 1.21 |
| Sessions band / selector container / GP rail vs page | 1.13–1.14 | 1.09 | 1.10 |
| Navigation bar vs page | 1.04–1.05 | 1.08–1.17 | 1.04–1.10 |
| Notice fill vs page | 1.13 | 1.09 | 1.10 |
| Notice border vs page (decorative) | 2.13 | 1.75 | 1.60 |
| Team tick `#1E41FF` vs row (Explore) | 2.83 | 5.86 | 5.46 |
| Team tick `#FF8000` vs row (Explore) | 7.25 | **2.29** | **2.13** |
| Team tick `#0093CC` (Teams tab, hidden; computed) | 5.26 | 2.89–3.16 | 2.94–3.24 |

### 4.3 Status chips (rendered border pixel vs pixel outside)

| Chip | Dark | A | B |
|---|---|---|---|
| Dashed "Status unknown", Home card | 5.58 | 6.30 | 6.88 |
| Dashed "Status unknown", sessions band | 5.73 | 6.30 | 6.63 |
| Solid "Completed", GP band | 3.71 | 3.80 | 3.96 |
| Solid "DNF", GP classification | 3.96 | 3.90 | 3.85 |
| Solid "Provisional" on the inverse plane | 3.74 (on Chalk) | 3.92 (on graphite) | 3.92 |

Dashed remains stronger than solid in both directions. Every solid outline is
≥ 3:1.

### 4.4 Focus rings (element centred, adjacent rendered pixels)

| Component | Dark | A | B |
|---|---|---|---|
| App-bar buttons, rows, links, Explore entries, navigation tabs | Ember 7.44–7.75 | Graphite 11.6–16.59 | Graphite 9.91–17.05 |
| Home editorial card (ring outside the card) | Ember, median 7.81 | Graphite, median 16.59 | Graphite, median 12.93 |
| Selected selector option (Chalk, inset) | 5.43, 100% | 5.43, 100% | 5.43, 100% |
| **Unselected selector option** | Chalk 5.43, 100% | **Graphite, min 2.80, 92% (Standings) / 89% (Explore) ≥ 3** | Same as A |
| Standings leader row (ring outside the row) | Ember 7.44 | Graphite 11.6, 100% | Graphite 9.91, 100% |
| Home championship link (inside the inverse plane) | Oxide, median 5.19 | Ember, median 6.88; min 2.66 over 8–14 px of the oxide seam | Same as A |
| GP back button | Ember, min 1.38 (circuit image) | Graphite 4.08 | Graphite 3.84 |
| **GP winner row (above the retained gradient cell)** | Chalk, min 4.63, 100% | **Graphite, min 2.06, 91% ≥ 3** (83% at ES 320 @200%) | Same as A |
| GP team links | Ember; ring touches its own label text (88% ≥ 3) | Graphite (85%) | Graphite (85%) |

The adjacency of the GP team-link ring to its own label text exists in Dark
too: it is a geometry property, not a Light regression.

## 5. Component comparisons

Owner composites are 3-up, left to right **Dark | Light A | Light B**, at CSS
pixels, from the same fixture and geometry (§10).

| Component | Transfers without structural change? | Notes |
|---|---|---|
| Main navigation | **Yes** (colours only) | One added rule: the selected icon keeps Chalk on the slab while the label turns graphite. Slab contrast doubles (2.92 → 5.48 / 6.09) |
| Editorial Grand Prix card (Home) | **Yes** | The lit graphite panel effect has no Light equivalent and is dropped. Card = Chalk tonal panel (A) or white elevated card (B). Round block gradient retained (DK-6). Arrow disc inverts to graphite |
| Standings leader card | **Yes** | Becomes the graphite inverse plane with an Ember position and kicker. The oxide seam is weaker on graphite (decorative) |
| Segmented selector | **Yes** | **The flat oxide slab (DK-2) transfers unchanged and passes 3:1 in Light** (5.43 / 6.09). The Dark "Chalk ring on every option" rule does **not** transfer (L1) |
| Status chips | **Yes** | Graphite 55% solid, 70% dashed, graphite-filled Final |
| Notice | **Yes** | Oxide icon; border weaker than Dark (decorative) |
| Team-colour accent | **Yes** (no change) | Contrast flips: dark liveries become safe, light ones (orange, cyan) fall below 3:1 (L3) |
| Home championship band | **Yes** | Graphite plane; Ember links and focus |
| GP winner cell | **Yes** (DK-6 unchanged) | Focus ring residual (L2) |

**Layout and semantics, every page and size** (Home, Standings, Standings
states, Explore, GP results; EN 390×844 @100% and ES 320×693 @200%; Light A
and Light B, each against Dark):
- 0 structural differences: no element, text, attribute or box changes, and
  only colour properties change in the computed styles.
- Accessibility tree identical; Tab order and target sizes identical.
- Adaptive fit modes identical: selector and navigation regular at 390,
  stacked at 320 @200%.
- Layout-quality metrics identical. The one listed "spill", Home's Winner
  tag at 390, is pre-existing and identical in Dark.
- Every Tab stop shows a ring when centred.
- Rings hidden where the Tab key leaves them occur at the same stops in Dark,
  A and B (pre-existing XS-32: fixed navigation at 320 @200%).

## 6. Accessibility concerns

**Improvements over Dark (Chrome emulation):**
- The XS-26 limit disappears in Light: selected slab vs container 5.43 / 6.09
  (Dark 2.47); navigation slab 5.48 / 6.09 (Dark 2.92).
- Every solid outline is ≥ 3:1 and the dashed outline stays stronger.
- All text is ≥ 5.43:1.

**Open concerns:**

| # | Concern | Measured | Options (LT decision) |
|---|---|---|---|
| L1 | Unselected selector focus ring crosses the selected slab's 12° tip | Graphite on oxide 2.80, over 8–11% of the ring; 100% elsewhere ≥ 3 | Accept and record; or a near-black focus "ink" (`#000` is 3.22 on oxide: a new value); or a two-tone ring (needs its own experiment). No single colour passes ≥ 3 on both oxide and a light tray except near-black (LT-4) |
| L2 | GP winner row ring over the retained gradient cell | Graphite: 3.28 on `#B04633`, 2.80 on oxide, 1.95 on `oxide-deep`; rendered min 2.06, 91% ≥ 3 (83% at 200%) | Same family of options as L1; near-black still fails on `oxide-deep` (2.24). Or a Light treatment of the DK-6 cell (DARK-THEME-ROLES §5 leaves it open) (LT-5) |
| L3 | Team-colour ticks: the weak set flips | `#FF8000` 2.13–2.29, `#0093CC` 2.89–3.24 on Light; `#1E41FF` 5.46–5.86 (was 2.83) | Ticks are never the only identity cue, so this is not a 1.4.11 failure. Mirror TM-03 in Light (graphite edge below 3:1) or leave as XS-25 decides (LT-6) |
| L4 | Notice boundary weaker | Border 1.60–1.75 (Dark 2.13); fill 1.09–1.10 | Decorative; the text and icon carry the meaning. Strengthen only if the owner wants the panel to read as a box (LT-8) |
| L5 | Surface separation is tonal | Card / band / rail vs page 1.09–1.21 | Decorative, as in Dark (1.09–1.14). B separates more |
| L6 | Oxide livery seam on the inverse plane | 2.47–2.80 on graphite (5.43 on Chalk in Dark); the Ember link ring touches it at 2.66 over 8–14 px | Decorative; the seam never carries information (LT-3) |
| L7 | Focus hidden behind the fixed navigation | Same stops in Dark, A and B at 320 @200% (Home, Standings, Explore) | Unchanged: XS-32 |

**Caveats preserved:** XS-11, XS-26 (Flutter implementation and verification
remain open; only the colour limit is gone in Light), XS-28, XS-31, XS-32,
XS-25, XS-02, XS-05 and XS-16 stay open. None of the measurements above is a
WCAG compliance claim. They are Chrome emulation measurements of prototype
CSS.

**Not exercised here:**
- The Live chip (not rendered).
- The Driver identity plate (DK-6).
- The Calendar next-event block.
- Settings, hover and pressed states (values set, not reviewed).
- Skeletons.
- Media scrims.
- `::selection` (left as Dark: oxide fill, Chalk text, which passes in both
  themes).

## 7. Advantages and limitations

### Direction A: Warm Editorial

**Advantages**
- One new colour.
- Chalk, the identity's light colour, becomes the Light panel colour, so the
  brand reads the same in both themes.
- The warm page keeps oxide warm and avoids clinical white.
- Its tonal "inset" panels are closest to the editorial, print-like Dark
  composition.
- The sunken Chalk navigation mirrors Dark's.

**Limitations**
- The weakest separation: card vs page 1.09, relying on a hairline.
- Secondary text on Chalk bands is 6.50 (still ≥ 4.5).
- Accent text on Chalk is the tightest value in either direction (5.43).
- Paper can read slightly yellow on cool-tinted displays (not
  device-checked).

### Direction B: Neutral Contrast

**Advantages**
- Clearer hierarchy: card vs page 1.21; raised tiles and the white card read
  as elevation.
- The highest values: oxide 6.09 on bands, slab 6.09.
- A familiar Android "surface container" structure, which may map more
  directly onto Material surface roles in Flutter.

**Limitations**
- Three new neutrals plus white.
- Cooler and more generic: the warm editorial character (Chalk) disappears
  from the surfaces and survives only in the inverse plane and the labels.
- The white card plus shadow adds a visual language (elevation) that Dark
  does not use.
- The page is darker than A, so accent text on the page is lower (5.52 vs
  5.93).

## 8. Recommended direction

**Recommendation: Direction A (Warm Editorial).** One optional refinement
to assess in the next step: borrow B's slightly stronger hairlines (14% /
26%) if A's tonal separation reads too faint on a device.

Reasons:
- It needs one new colour.
- It keeps Chalk as the brand's light surface.
- It mirrors Dark's composition: tonal bands, a sunken navigation and one
  contrasting plane.
- Its measured values are equivalent to B for every information-bearing role
  (text ≥ 5.43, solid ≥ 3.80, dashed ≥ 6.30, slab 5.43).

B's advantages are in decorative separation, which carries no information.

The recommendation does not change L1 and L2. They are colour-independent of
the A/B choice and need their own decision.

## 9. Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| **LT-1** | Choose the Light surface direction: A (Warm Editorial), B (Neutral Contrast) or a stated hybrid | A |
| **LT-2** | Accept the new Light token(s): A: Paper `#F5F4F0` only; B: `#EBECEE`, `#F7F7F8`, `#DCDDE1` (+ white card) | Per LT-1 |
| **LT-3** | Accept the inverse plane in Light: the Home championship band and the Standings leader row become graphite (Dark tray → ground), with Chalk text, Ember accent and Ember focus inside; the oxide seam is kept as decoration (2.47–2.80) | Accept |
| **LT-4** | Light focus: Graphite ring on light surfaces, Chalk on oxide, Ember inside the inverse plane. For the unselected selector option (L1), choose: **(a)** accept the 2.80 tip residual (8–11% of the ring), **(b)** a near-black focus ink (`#000`, 3.22 on oxide: a new value), or **(c)** commission a two-tone-ring experiment | (a) for the exploration, with (c) before Flutter |
| **LT-5** | GP winner row ring over the retained gradient cell (L2): **(a)** accept the residual (min 2.06, 91%), **(b)** two-tone-ring experiment (shared with LT-4 c), or **(c)** decide a Light treatment of the DK-6 cell, without changing the Dark gradient | (b) |
| **LT-6** | Team-colour accents in Light (L3): mirror TM-03 with a graphite edge below 3:1, or defer to XS-25's single rule | Defer to XS-25, with the Light numbers recorded |
| **LT-7** | Status fills: Final = graphite fill with Chalk text (accept?); Live (not rendered) = keep the Ember fill with graphite text (7.44; fill vs page 2.08–2.23) or move to oxide fill with Chalk text (collides with the Winner tag) | Accept Final; keep Ember Live |
| **LT-8** | Notice border: keep Graphite 22% (decorative, 1.75) or strengthen | Keep |
| **LT-9** | Accept the one rule-level Light variant: the selected navigation icon keeps Chalk on the oxide slab while its label turns graphite | Accept |
| **LT-10** | Confirm that the DK-6 decorative gradients stay unchanged in Light (Home round block and GP winner cell verified; Driver plate not rendered), with the shadow softened | Confirm |

After LT-1 to LT-5, the next step would be a Light role freeze candidate
(the counterpart of `DARK-THEME-ROLES.md`), followed by Light on the remaining
components. **No full Light screen conversion starts before the owner
approves a direction.**

## 10. Representative screenshots

Folder:
`cross-screen-refinement/light-foundations/validation-20261112-220528-53a/screens/`.
**Local only since Step 54D:** these 14 images (superseded by Step 53A.1 and
the frozen roles) are excluded from Git by `design-exploration/.gitignore`;
a fresh checkout has this run's `summary.txt` and `results.json`, not the
images. `light-foundations/checks.mjs` regenerates comparable (not
bit-identical) images. Each image is a 3-up composite, **Dark | Light A | Light B**, downscaled to
CSS pixels. Measurements were taken at DPR 2.

**Primary: EN 390×844 @100%, first viewport**

| File | Shows |
|---|---|
| `53a-home-en-390.png` | Navigation, editorial GP card, dashed chips, sessions band, start of the inverse band |
| `53a-st-index-en-390.png` | Segmented selector (selected and unselected), leader card, rows, navigation |
| `53a-ex-cue-en-390.png` | Three-option selector, team-colour ticks (`#1E41FF`, `#FF8000`) |
| `53a-gp-results-en-390.png` | Solid chips (Completed), context chip, GP band, facts strip, Final chip, winner gradient cell |
| `53a-st-states-en-390.png` | Development fixture gallery header |

**Crops: EN 390**

| File | Shows |
|---|---|
| `53a-st-states-notices-en-390.png` | Stale and refresh-failed notices |
| `53a-st-states-08-marker-en-390.png` | Provisional marker on the inverse leader row |
| `53a-st-focus-selected-en-390.png` | Focus on the selected option (Chalk on oxide) |
| `53a-st-focus-unselected-en-390.png` | Focus on the unselected option (L1: graphite crossing the slab tip) |
| `53a-st-focus-leader-en-390.png` | Focus outside the leader row |
| `53a-home-focus-champ-link-en-390.png` | Ember focus inside the inverse band |
| `53a-gp-focus-winner-en-390.png` | Winner-row focus over the retained gradient cell (L2) |

**Focused check: ES 320×693 @200%**

| File | Shows |
|---|---|
| `53a-home-es-320-200.png` | Home at 200% (stacked navigation, round strip) |
| `53a-st-index-es-320-200.png` | Standings at 200% (stacked selector, stacked navigation) |

## Reproduce

From `cross-screen-refinement/light-foundations/`:
- `python build.py`: writes 30 pages (5 pilot pages × Dark / Light A / Light B
  × EN / ES).
- `python build.py --check`: verifies the written pages are current.
- `node checks.mjs`: Chrome 157 at the path in the script; writes a new
  `validation-<stamp>-53a/` folder.
- Since Step 53A.1, `python build.py` writes 36 pages: the 30 above,
  byte-identical, plus 6 `*-light-bm` pages.
- `node checks.mjs --step 53a1`: writes a new `validation-<stamp>-53a1/`
  folder (§11).
- Since Step 53B, `python build.py` writes 46 pages: the 36 above,
  byte-identical, plus `ex-cue-light-bm` and 8 `*-light-53b` pages.
- `node checks.mjs --step 53b`: writes a new `validation-<stamp>-53b/`
  folder (§12).

Dependency-free: Python stdlib, Node built-ins, Chrome DevTools Protocol.

---

## 11. Step 53A.1: B Motorsport (refinement of Direction B)

**Status: exploration, 2026-11-12, not approved.**

**Brief:**
- Light should feel energetic, recognisably Formula 1 and confident, while
  staying predominantly light.
- One refinement of B, on three areas only: the Home GP hero, the GP Detail
  heading and results, and the Standings leader card as a consistency
  reference.
- Same palette, roles, geometry, typography, content and semantics.

**File:**
[`light-bm.css`](cross-screen-refinement/light-foundations/light-bm.css). It
is loaded after `light-roles.css` and `light-b.css` on Home, GP results and
Standings only.

**No new colour.** Every value is an existing Primer V2 Dark value: ground,
tray, raised, Chalk, `text-2`, Ember and the Dark alphas.

### 11.1 What changed, and why

| Area | B (Step 53A) | B Motorsport | Role change | Why |
|---|---|---|---|---|
| **Home GP hero** | White card; the "View Grand Prix" action row is white under a hairline; graphite arrow disc | White card unchanged; **the action row becomes a Graphite strip** (`#141518`) with a Chalk label and a Chalk arrow disc with a graphite arrow (the Dark disc) | Action row: card surface → inverse surface. Disc: inverse → Chalk | The card now has a hard, high-contrast base, like a timing strip. With the oxide round block above it, the hero reads as a broadcast graphic rather than a generic white card. The red stays limited to the round block |
| **GP Detail identity band** (round, name, chips, facts) | Near-white band `#F7F7F8`, graphite type, oxide seam | **The band becomes the page's Graphite editorial plane**: Dark tray `#1F2125` with Dark's white 4.5% sheen. The frozen Dark roles are scoped to the band (Chalk type, `text-2`, the Dark chip outline and raised chip, black 16% facts strip) | Identity band: secondary surface → inverse plane (as Home's championship band and Standings' leader row already are) | Gives GP Detail the one contrasting plane every other Light screen has. The large round number in Chalk on graphite with the oxide seam is the strongest "Formula 1" cue available without new colour or size. The rest of the page stays light |
| GP Detail results (classification) | Light rail, retained oxide gradient winner cell, graphite Final chip | **Unchanged** | — | B is already strong here: the winner cell is the only red cell. A graphite timing-tower rail was considered and rejected: every row's focus ring would then cross graphite and light at once, turning the LT-5 residual into a problem on every row |
| Standings leader card | Graphite inverse row, Ember position and kicker | **Unchanged** (0 elements differ) | — | Already the reference treatment that the two changes above align with |
| Explore, navigation, selector, chips, notices | — | **Unchanged** | — | No cross-component consistency issue found |

**Not done, on purpose:**
- **Red Oxide fills were not extended** (for example, an oxide action strip).
  Flat oxide stays reserved for selected controls and the DK-2 components, so
  a red surface never reads as a selected state. Functional state (oxide
  slab, Chalk 800 label) and decorative emphasis (graphite planes, the
  retained gradients) stay distinguishable.
- No card was made dark beyond these two areas.
- No size, type or layout change.

**Graphite coverage (first viewport, EN 390):**
- Home: Graphite grows by one 52px strip.
- GP Detail: the top band, about 240px of 844, is graphite.
- Both screens stay predominantly light.

### 11.2 Validation (Chrome emulation only)

Run: `cross-screen-refinement/light-foundations/validation-20261112-224333-53a1/`.
It covers Home, GP results and Standings, at EN 390×844 @100% and ES 320×693
@200%. The Dark reference, B and B Motorsport were each measured.

**Structure, B Motorsport against Dark (and B against Dark):**
- 0 structural differences.
- Accessibility tree, Tab order, target sizes and adaptive fit modes
  identical.
- Layout-quality metrics identical (no new clipping).
- Navigation unchanged.

**Elements whose colours differ between B and B Motorsport:**
- Home: 6 element parts, all inside `.hero__action` (the strip, label and
  arrow disc).
- GP results: 18 element parts, all inside `.gp` (the band, chips, round,
  seam, name and facts).
- Standings: 0.

**Contrast of the modified components** (rendered, EN 390×844 @100%, unless marked computed):

| Sample | B | B Motorsport |
|---|---|---|
| Hero action label vs its row | 18.26 (graphite on white) | 15.19 (Chalk on graphite) |
| Hero action strip vs the white card above | 1.00 (same surface, hairline only) | 18.26 |
| Hero arrow disc vs its row / glyph vs disc | 18.26 / 15.19 | 15.19 / 15.32 |
| GP band vs page | 1.10 | 13.15 |
| GP round number / name | 17.05 | 13.41 |
| GP round label, season | 7.30 | 6.69–6.85 |
| GP facts: labels / values | 6.74 / 15.75 (computed) | 7.44 (computed) / 14.31 |
| GP "Standard weekend" context chip | 13.45 | 11.49 (Chalk on Dark raised) |
| GP "Completed" solid outline | 3.96 | 3.71 (the DK-1 Dark value) |

No rendered text run is below 4.5:1 in either variant.

**Focus side effects (recorded, not resolved):**
- **GP back button (new in B Motorsport):** the graphite ring's lower edge
  meets the graphite band. Minimum 1.27, 97% of the ring ≥ 3 (B: 3.84, 100%).
  This belongs to the LT-4 family.
- **Home hero:** the graphite ring (offset 3px, outside the card) runs
  parallel to the graphite strip with a 3px page gap. 96% of the ring is
  ≥ 3:1 against adjacent pixels (B: 100%).
- **Unchanged from B:** LT-4 (unselected selector ring 2.80), LT-5 (GP winner
  ring min 2.06), LT-6 and XS-25 (team colours), and XS-32 (the same hidden
  stops at 320 @200%).

No focus or team-colour compliance is claimed.

### 11.3 Comparison screenshots (B | B Motorsport, 2-up)

Folder: `cross-screen-refinement/light-foundations/validation-20261112-224333-53a1/screens/`.

| File | Shows |
|---|---|
| `53a1-home-en-390.png` | Home first viewport: hero with action strip |
| `53a1-home-focus-hero-en-390.png` | Hero focus ring with the strip |
| `53a1-gp-results-en-390.png` | GP Detail first viewport: graphite identity band |
| `53a1-gp-results-classification-en-390.png` | Results section (unchanged, as a check) |
| `53a1-st-index-en-390.png` | Standings (unchanged consistency reference) |
| `53a1-home-hero-es-320-200.png` | ES 320 @200%: hero action strip |
| `53a1-gp-results-es-320-200.png` | ES 320 @200%: identity band with wrapped chips and title |

### 11.4 Recommendation and remaining decisions

**Recommendation: B Motorsport** as the LT-1 candidate (Direction B, with the
§11.1 refinements). It adds the confidence the owner asked for using only
existing graphite planes. It keeps flat oxide reserved for state. It brings
GP Detail in line with the one-contrasting-plane rule that Home and
Standings already follow. Its only cost is the two minor ring adjacencies
above.

If the owner prefers the hero without the strip, the GP band change stands
on its own; the two are independent.

**Still open:**
- **LT-1:** B or B Motorsport, including which of the two §11.1 changes to
  keep.
- **LT-2:** B's three neutrals. B Motorsport adds none.
- **LT-3:** the inverse plane, now also the GP identity band.
- **LT-4 and LT-5:** focus residuals, plus the two new adjacencies (GP back
  button, Home hero).
- **LT-6 / XS-25:** team-colour edges.
- **LT-7 to LT-10:** as in §9.
- **XS-32:** unchanged.

Light screen conversion does not start before the owner's visual review and
an LT-1 decision.

---

## 12. Step 53B: Light component roles and focus refinement

**Status: exploration, 2026-11-12. The corrections are proposals; LT-4, LT-5
and LT-6 stay unresolved until the owner decides.**

**Base:** the approved B Motorsport composition (LT-1).

**File:**
[`light-53b.css`](cross-screen-refinement/light-foundations/light-53b.css),
loaded after `light-bm.css` on Home, Standings, GP results and Explore.

**Scope of the change:**
- Items 1–4 apply only while an element shows keyboard focus.
- Item 5 (team ticks) is the only resting-state change.
- No new colour. No change to size, layout, target, Tab order, accessible
  name or semantics.
- No Light screen conversion.

**Run:** `cross-screen-refinement/light-foundations/validation-20261112-232123-53b/`.
- Variants: Dark reference, B Motorsport and 53B.
- Sizes: EN 390×844 @100%, EN 320×693 @200% and ES 320×693 @200%.
- Selected-and-focused combinations: selected selector option, selected
  navigation tab and winner row.

### 12.1 Proposed shared Light component roles

Values are the approved B / B Motorsport values. Rendered contrast is from
the runs in §4, §11 and §12. **Graphite panels** are the LT-3 contexts only:
- Home championship band;
- Standings leader row;
- Home hero action strip;
- GP Detail heading band.

#### Navigation and selectors

| Element | Treatment |
|---|---|
| **Navigation: bar** | `#F7F7F8` 96% with a Graphite 14% top line |
| **Navigation: unselected tab** | `#4F525A`, weight 600 (6.74–7.30) |
| **Navigation: selected tab** | Flat oxide slab (6.09 against the bar), **Chalk icon on the slab**, Graphite 800 label, `aria-current` |
| **Navigation: focus** | Graphite ring, offset 3px (17.05). With zero insets the ring's bottom edge falls below the screen, in Dark and Light alike (§12.4) |
| **Segmented selector: container** | `#F7F7F8` with a Graphite 14% border |
| **Segmented selector: unselected** | `#4F525A`, weight 600 |
| **Segmented selector: selected** | Flat oxide slab (6.09 against the container; it was 2.47 in Dark), Chalk 800 label (5.43), `aria-pressed` |
| **Segmented selector: focus** | Selected: Chalk inset ring on oxide (5.43, unchanged). Unselected: Graphite inset ring **plus a 5px band of the container colour under it (53B, §12.2)** |

#### Status chips and notices

| Element | On light surfaces | On Graphite panels |
|---|---|---|
| **Solid status chip** (Completed, DNF, Provisional) | Graphite 55%, 1.5px (rendered 3.85–3.96) | Chalk 45% = DK-1 (3.71–3.92) |
| **Dashed unknown chip** | Graphite 70%, dashed (6.63–6.88). **Stronger than solid** | Chalk 60%, dashed (the Dark value) |
| **Solid alert chip** | Graphite 70% solid, as strong as dashed (as in Dark) | Same |
| **Confirmed chip** (Final) | Graphite fill, Chalk text (15.19), check icon | Chalk fill, Graphite text |
| **Live chip** | Not rendered; LT-7 open | — |
| **Notices** (stale data, refresh failed) | Band fill, Graphite 26% border (decorative), oxide icon from the VS-4 vocabulary, Graphite text; the text carries the meaning. Provisional is a status line, not a notice | — |

#### Actions, cards and focus

| Element | Treatment |
|---|---|
| **Primary action** (`.btn`) | Graphite fill, Chalk label (15.19). The Home hero strip is the hero's own editorial action (LT-1), not a general button style |
| **Secondary actions** | Text links: oxide (5.52 on the page, 6.09 on bands) or Graphite with an arrow. Arrow discs: Graphite with a Chalk arrow on light; Chalk with a Graphite arrow on Graphite |
| **Light editorial card** | White `#FFFFFF` with a soft shadow, Home hero only. Content bands `#F7F7F8` |
| **Graphite editorial panels** | Chalk text, `#A9ABB1` secondary, Ember accent, oxide seams (decorative). Panel against the page 13.15–14.99 |
| **Focus on a light surface** | Graphite, 2px |
| **Focus on Red Oxide** | Chalk, 2px |
| **Focus inside a Graphite panel** | Ember, 2px |
| **Focus where a ring would cross another fill** | The ring keeps its own surface under it: a 5px band of the control's surface colour between the ring and the fill (selector tip, winner gradient cell), extending DK-3 |
| **Focus next to a panel edge** | A ring must end clear of an adjacent panel (back button) |

**Functional state vs decorative emphasis:**
- Flat oxide fill = selected (selector, navigation).
- Graphite panels, the oxide round block and the winner gradient =
  decoration, never state.
- A focus ring is always an outline, never a fill.

### 12.2 Focus corrections: original vs corrected

**Measures used:**
- **Perimeter:** the share of positions along the ring's intended path
  (sides, one diagonal per corner arc, or a circle) where some pixel changes
  by ≥ 3:1 between the focused and unfocused states. The weakest value is in
  brackets.
- **Adjacency:** the ring colour against the pixels touching it.

Percentages describe how much of a ring is affected. **They do not establish
compliance.**

| Case | Original (B Motorsport) | Corrected (53B) | Correction |
|---|---|---|---|
| **LT-4: selector, unselected option focused**, Standings and Explore, EN 390 | Perimeter 95% / 92% (weakest 2.80: Graphite over the oxide slab tip) | **Perimeter 100% (weakest 6.09)** | 5px inset band of the selector surface (`--tray`) while focused. The tip is cut locally only while the neighbour has focus; the selected slab, its label and `aria-pressed` are unchanged |
| LT-4 at 320 @200% (stacked selector, no tip under the ring) | 100% (17.05) | 100% (17.05) | No change needed |
| LT-4: selected option focused | 100% (5.43) | 100% (5.43) | Unchanged (Chalk on oxide) |
| **LT-5: GP winner row focused** | Perimeter 90% (weakest 2.04) at EN 390; 82% (1.99) at 320 @200% | **Perimeter 100% (weakest 4.81 / 4.74 / 4.78)** | 5px inset band of the row surface (`--ground`) under the ring while focused. The DK-6 gradient is unchanged at rest; no column was made dark |
| GP ordinary row, non-finisher (DNF) row | 100% (15.45) | 100% (15.45) | Unchanged; no correction applied |
| **Home hero (ring on the card)** | Ring 100% (12.81). **But** the global focus radius (6px) rounded the strip's top corners while focused, cutting two white notches into the approved strip (adjacency 1.00) | Ring 100% (12.81); adjacency 12.47; strip intact | `.hero__action:focus-visible { border-radius: 0 }`. The card clip keeps the bottom corners round |
| **GP Detail back button** | The ring (offset 3 + 2px) ended exactly at y = 57, the band's top edge: adjacency 1.27, 97% ≥ 3 | **Adjacency 15.45, 100% ≥ 3** at all three sizes | Offset 3 → 1px for this button only. A 1px page gap and the bar's hairline now separate ring and band. Alternative not chosen: a page-colour band outside the ring, which would bite into the band |

**Painting geometry (measured):**
- **Back button:** the button box is y 4–52, the ring 52–57 and the app bar
  0–57 (sticky, z-index 6). The band starts at y = 57. The ring was not
  drawn over the band; its outer edge met it.
- **Home hero:** the ring stays 3px outside the card at every point. The
  Step 53A.1 "96%" was partly a measurement artefact: the window followed the
  link rather than the card that draws the ring. Step 53B measures the
  ring-drawing element.

**Structure and composition, every page and size** (24 comparisons with Dark):
- 0 structural differences.
- Accessibility tree, Tab order, targets and fit modes identical.
- No new clipping. The only listed "spill", Home's Winner tag, is
  pre-existing and identical in Dark.
- No rendered text below 4.5:1.
- **Resting-state difference B Motorsport → 53B:** only the team-tick edge
  on Explore (one element rule). Home, Standings and GP are pixel-for-pixel
  the approved composition until something is focused.

### 12.3 Team colours (LT-6 / XS-25)

Fixture colours, measured against the surface each one sits on:

| Colour | Light page `#EBECEE` | Light band `#F7F7F8` | White card | Dark ground | Dark tray |
|---|---|---|---|---|---|
| `#1E41FF` (Red Bull fixture) | 5.46 | 6.03 | 6.45 | **2.83** | **2.50** |
| `#FF8000` (McLaren) | **2.13** | **2.35** | **2.52** | 7.25 | 6.40 |
| `#0093CC` (Alpine fixture) | **2.94** | 3.24 | 3.47 | 5.26 | 4.64 |

**Proposed rule: one rule for both themes.** It mirrors TM-03.
- When a team colour is below 3:1 against the surface it sits on, it gets a
  1px edge in that surface's primary text colour.
- On Light the edge is Graphite; on Dark it is Chalk.
- The supplied colour is never changed.
- The test runs at runtime against the actual surface (`GvTeamAccent`
  already computes contrast). The prototype uses the fixture colour values
  only as a stand-in.

**Why it works:**
- A colour that is weak against a surface is close to that surface's
  lightness.
- So it is strong against the surface's text colour: at least about 5:1 on
  Light (Graphite) and on Dark (Chalk).
- Examples: `#FF8000` against the Graphite edge is 7.25; `#1E41FF` against a
  Chalk edge is 5.37; `#0093CC` against the Graphite edge is 5.26.
- The edge itself is 15.45 against the page.

**Recognition:**
- The tick keeps its colour and its 12° shape.
- The row already names the team ("McLaren Formula 1 Team"), so identity is
  never carried by colour alone.
- No replacement colours.

**Limitations:**
- The edge widens the tick's visual footprint by 1px on each side (no layout
  effect).
- Thin edges on a 3px skewed tick need a device check (Android rendering,
  XS-16).
- `#0093CC` passes on bands (3.24) but not on the page (2.94), so the
  result depends on the surface.
- **Explored only on the Explore tick here.** Team Detail (TM-03 already),
  Driver Detail and the Standings tick (not rendered) are untested in Light.
- XS-25 is not closed: Flutter and device checks remain.

### 12.4 Unresolved caveats

**Pre-existing and identical in Dark (not caused by Light; recorded for
XS-31 and XS-32):**
- **Navigation tabs:** with zero system insets, the ring's bottom edge falls
  below the screen. Perimeter 68% at 390, and 64% for the selected tab at
  320 @200%. On a device the gesture-bar inset may or may not reveal it.
- **GP team links:** the ring crosses the driver name's glyphs. Perimeter
  98%, Dark too.
- **Home championship links:** the oxide seam covers about 2px of the ring.
  Dark too (DK-4 accepted).
- **Keyboard focus hidden behind the fixed navigation** at 320 @200% on
  Home, Standings and Explore: XS-32.

**Other caveats:**
- The mask band changes the decorative fill locally while focused: the
  slab's tip and a 5px frame of the winner cell. This extends DK-3's "ring
  above decoration".
- Chrome emulation only: no Android, TalkBack, D-pad or switch-input
  validation (XS-02, XS-05, XS-16).
- Flutter needs custom focus painting for the mask band and per-surface ring
  colours (XS-31).

### 12.5 Owner decisions needed

| # | Decision | Recommendation |
|---|---|---|
| **LT-4** | Accept the surface band under the unselected selector option's ring (100%, weakest 6.09) | Accept |
| **LT-5** | Accept the row-surface band under the winner row's ring (100%, weakest 4.74), with the DK-6 gradient unchanged at rest | Accept |
| **LT-11** (new) | GP Detail back button: offset 1px, or keep 3px with a page-colour band outside the ring | 1px |
| **LT-12** (new) | Home hero: suppress the global focus radius on the action strip (a correction of an unintended change to the approved strip) | Accept |
| **LT-6** | Accept the single team-colour edge rule (surface text colour, below 3:1, computed at runtime), for Light and as the shared XS-25 rule for Dark | Accept as the XS-25 proposal; keep XS-25 open |
| LT-7 to LT-10 | Final and Live chips, notice border, selected navigation icon, DK-6 in Light (from §9) | Still open |

After these decisions, the next step would be a Light role freeze candidate.
**No Light screen rollout starts before owner review.**

### 12.6 Screenshots for owner review (B Motorsport | 53B, 2-up)

Folder:
`cross-screen-refinement/light-foundations/validation-20261112-232123-53b/screens/`.

| File | Shows |
|---|---|
| `53b-st-focus-unselected-en-390.png` | LT-4: unselected option focused (Standings) |
| `53b-ex-focus-unselected-en-390.png` | LT-4: three-option selector, "Teams" focused (Explore) |
| `53b-st-focus-selected-en-390.png` | Selected option focused (unchanged, check) |
| `53b-gp-focus-winner-en-390.png` | LT-5: winner row focused |
| `53b-gp-focus-dnf-en-390.png` | Non-finisher row focused (unchanged, check) |
| `53b-gp-focus-back-en-390.png` | Back button ring against the heading band |
| `53b-home-focus-hero-en-390.png` | Hero focus with the strip intact |
| `53b-ex-team-ticks-en-390.png` | LT-6: team ticks (orange edged, blue unchanged) |
| `53b-st-focus-unselected-es-320-200.png` | ES 320 @200%: stacked selector, unselected focused |
| `53b-gp-focus-winner-es-320-200.png` | ES 320 @200%: winner row focused |
