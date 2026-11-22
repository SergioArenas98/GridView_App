# Primer V2 Light rollout, Batch 2 (Step 53D): Circuit Detail, Grand Prix Detail, Settings

**Primer V2 Light formally closed at the visual-design level (LT-18, Step
53F, 2026-11-13); roles frozen in `LIGHT-THEME-ROLES.md`. LT-16 and LT-17
(shared) approved in Step 53F.**

**Status: approved at the Light visual-design level (owner, 2026-11-13,
Step 53E)** after review of twelve screenshots; the Batch 2 rollout is
accepted. Approved with it: LT-7 (Final), LT-8 (keep 26%), LT-10, LT-17 (for
Light). Pending: LT-7 Live, LT-9, LT-16, LT-17 as a shared Dark rule (see
`LIGHT-READINESS.md`). The remaining approved Primer V2 screens in Light, on
the approved B Motorsport direction (LT-1) with the approved Light roles and
focus corrections (LT-2 to LT-6, LT-11 to LT-15). Not Flutter
implementation, not Android or TalkBack evidence, not WCAG certification.
Primer V2 Light as a whole is **not** formally closed.

- **Prototype:** `cross-screen-refinement/light-rollout-b2/` (`build.py`
  derives 132 pages; `light-b2.css` holds this batch's screen roles;
  `lt8-notice.css` and `lt-team-ring.css` are comparison-only;
  `checks-b2.mjs`).
- **Light chain, reused unchanged:** `light-foundations/` (`light-roles.css`,
  `light-b.css`, `light-bm.css`, `light-53b.css`), then
  `light-rollout-b1/light-b1.css` (Batch 1 shared roles), then
  `light-b2.css`. No new token, no new hue, no new font, image or dependency.
- **Evidence:** `light-rollout-b2/validation-20261113-180746-b2/` (14 two-up
  PNG, `summary.txt`, `results.json`, 4.3 MB); LT-8:
  `validation-20261113-191838-lt8/` (2 three-up PNG); team-link ring:
  `validation-20261113-194111-tl/` (2 three-up PNG).

## 1. Source inventory (authoritative, only read)

| Screen | Source | Pages |
|---|---|---|
| Circuit Detail | `consolidation-pilot/circuit-detail/` (pixel-identical to the approved prototype) | index (linked event), partial (Scenario B), no-event (calendar confirmed complete), states (22 frames) |
| Circuit Detail, CR-04 | `cross-screen-refinement/circuit-absence/` (visually approved, Step 49B.2) | unknown-association, partial-unknown (the unsupported "No Grand Prix this season" block omitted) |
| Grand Prix Detail | `consolidation-pilot/grand-prix-detail/` | index (Scenario A, upcoming), results (Scenario B), states (26 frames), stress-title (long app-bar titles) |
| Settings root and preferences | `consolidation-pilot/settings/` | root (production), non-production, production without contact, Language, Theme, Time display, states (5 frames) |
| Settings information | `consolidation-pilot/settings/information/` | About (+ unresolved), Data and updates (+ frozen, sample, season unavailable, unverified), Privacy (+ non-production, starting, unconfirmed), Acknowledgements (+ frozen), states (11 frames) |

Plus two Settings scenarios through the prototype's own URL switch: root and
Theme with Light chosen (`?theme=light`).

**Already represented in Light before this batch (reused, not rebuilt):**
GP results with the Graphite heading band (LT-1, Step 53A.1), the winner-row
focus backing (LT-5) and the back-button ring (LT-11), all from
`light-foundations/`; the results page is rebuilt here only so it sits in the
same chain as the rest of GP Detail. Circuit, GP index and states, and every
Settings page had no Light state before.

**Approved for implementation but not in any source page** (not recreated
here, so nothing is invented): VS-1 dashed outlines for GP "Format unknown",
session "Status unknown" and finish "Status unknown", and VS-4 cause icons on
notices. Both are pure vocabulary choices: their Light roles already exist
(dashed unknown outline 6.38 on the page, 5.30 on the GP band; notice icon in
the oxide accent, 6.09 on the notice fill).

## 2. Validation summary

31 pages and 2 Settings scenarios at four sizes (EN and ES 390×844 @100%, EN
and ES 320×693 @200%): **132 Light-vs-Dark comparisons, 656 Tab stops.**

| Check | Result |
|---|---|
| Structure (DOM, text, attributes, boxes, document height) | 0 differences in 132 of 132 |
| Accessibility tree, Tab order, touch targets | identical in 132 of 132 |
| Layout quality (horizontal scroll, overflow, clipped or spilled text, text under 12.5px) | clean, except the GP stress-title page at 320 @200%, where long app-bar titles truncate by design (XS-07); identical in Dark |
| Computed-style differences | colour properties only |
| Rendered text below 4.5:1 (3:1 large) | none, either theme |
| Focus visible at every Tab stop | yes, both themes; no ring hidden where the Tab key leaves it |
| Ring perimeter (share with a ≥ 3:1 change) | 100% at every stop except the GP team links: 98–99% in **both** themes (§4) |
| Lowest ring contrast on its path (other stops) | Circuit and Settings 15.45; GP 4.74, the winner row with the approved LT-5 backing (as Step 53B) |

Chrome emulation only. Percentages describe ring coverage; they are not a
compliance claim.

## 3. Circuit Detail

**Roles applied:** page, light heading sheet (the 4.5% white sheen cleared,
as LT-13 did for the Driver plate and Team banner), Graphite name, secondary
location and labels, dimension line and fact rules in Graphite alphas, the
related Grand Prix row with its oxide 12° seam, solid "Upcoming" outline
(DK-1 role) and dashed "Status unknown", context chip on the raised fill,
notices on the light band, skeleton blocks in the raised tone, Graphite
primary buttons. **No Graphite panel** (LT-3).

**One screen role (`light-b2.css` 1):** the related Grand Prix arrow disc.
Dark draws a Chalk disc; on the light page Chalk is no longer a contrasting
fill (1.05:1), so the disc takes the small-inverse-control role already used
by GP Detail's circuit disc, Driver's team disc and the Calendar next-event
disc: Graphite disc, Chalk arrow. Row hover and pressed take the role map's
tints.

| Element (rendered) | Dark | Light |
|---|---|---|
| Related disc vs page | 15.19 | 15.45 |
| Related oxide seam vs page | 2.80 | 5.52 |
| Heading sheet vs page (tonal, decorative) | 1.13 | 1.10 |
| Solid "Upcoming" outline | 3.96 | 3.85 |
| Dashed "Status unknown" outline | 6.02 | 6.38 |

**Long names, missing data, CR-04:** "Circuit de Spa-Francorchamps" and
"Autodromo Nazionale Monza" wrap exactly as in Dark at every size. Scenario B
(partial profile) keeps its notice and drops the missing facts; the CR-04
pages omit the related block with no gap or residue. **Focus:** back button
and related row 100% (Graphite on the page, min 15.45; back-button focused
neighbours p05 4.37, Dark 2.04–2.39, through LT-11).

## 4. Grand Prix Detail

**Kept as approved:** the Graphite heading band (LT-1) with Dark roles scoped
inside it, so its chips, round number, oxide diagonal and facts strip are
pixel-identical to Dark; light sessions band; results and classification in
their approved Light treatment, the winner row's retained gradient cell
(DK-6) and the LT-5 focus backing; back button LT-11; Graphite circuit disc.
No dark position column, no result-layout change. **No new rule was needed
for GP Detail.**

**Statuses (rendered):** solid "Upcoming" / "Completed" outlines in the band
3.67–3.71 (Dark identical); dashed "Status unknown" in the band 5.30; result
"Provisional", "Lapped", "DNF" outlines on the page 3.85 (Dark 3.96);
"Cancelled" alert outline 6.31 (Dark 6.04); "Final" is the filled inverse
chip (Graphite with Chalk text, LT-7). Winner cell vs the light row 7.65–8.3
(Dark 1.81–1.97: the cell is decorative in both). Spanish "Formato
desconocido" wraps at 320 @200% as approved (VS-5).

**Known team-link focus issue (measured, not caused by Light):** the
classification team link's ring is drawn 3px outside its 48px box, so its top
edge crosses the descenders of the driver name just above. Perimeter 98–99%
in **both** themes; in Light the ring and the name are both Graphite, so the
crossing reads as the ring merging into the name (focused neighbours p05
1.00 at 390; Dark 2.04).
- **Isolated candidate** (`lt-team-ring.css`, comparison only): the same
  ring drawn 2px **inside** the link (`outline-offset: -2px`), as the row
  overlay and the circuit link already do. The label starts 13px inside the
  box, so the ring clears both texts: **100%, min 15.45, p05 11.48–15.45**,
  at EN 390 and ES 320 @200%. Focus-only; target, label, order and rest state
  unchanged; structure identical (4 of 4).
- **Step 53E:** approved for Light and moved into `light-b2.css` 4, so the
  Light GP pages now draw the inside ring (the `validation-20261113-180746-b2`
  evidence predates it). Dark verification: `LIGHT-READINESS.md` §5.
- It is geometry, not colour, so it would apply to both themes: proposed as
  **LT-17** for owner review and XS-31. The Dark prototypes are not changed.

**Loading skeleton:** the detail skeleton's hero block stays a neutral light
placeholder (raised-tone gradient), as on Driver and Team; on load it becomes
the Graphite band. Proposed as **LT-16** (keep neutral) rather than
silently drawing a Graphite placeholder.

## 5. Settings

**Roles applied:** page, rows and kickers with Graphite text and hairlines,
secondary descriptions, Red Oxide selection marks (the existing `--ember`
mapping already gives oxide), dashed annotation boxes, Graphite primary
button, text links in the oxide accent, the staging badge's dashed outline in
secondary text (6.61; Dark 7.95). **No Graphite panel.**

**Screen roles (`light-b2.css` 2):**
- **Selection mark check:** Graphite on oxide is 2.80:1, so the check takes
  Chalk (5.43:1), as every label on Red Oxide does. Selected mark vs page
  5.52; unselected mark outline 6.61; small value mark 5.52.
- **Snackbar:** the inverse plane flips to Graphite with Chalk text (15.45 vs
  page), as the Standings leader row; its oxide seam is decorative (L6).
- **The provisional light preview is superseded.** The Settings pilot shows
  "Light" through Flutter's old `GvColorsLight` values (blue-grey page,
  `#C62719` mark). In the Light pages, choosing Light (and the states
  gallery's frame 5) now resolves to the same B Motorsport roles as every
  other screen. Labels, behaviour, persistence and the theme options are
  unchanged; no ARB or Flutter change.
- **Gallery focus stand-in** (`.opt.is-focus`) takes the Graphite ring.

**Documented, not changed:** three development annotations in the Settings
pilot still describe the superseded preview ("Prototype only: provisional
light preview… Not the Primer V2 light design", the states hub link "Theme:
Light selected (provisional light preview)" and gallery caption 5). They keep
their words in Light so the structural comparison stays exact (changing them
would shift every box below the hub links). They are prototype notes, not app
copy; the owner screenshot of the Theme screen is cropped above the note.

**Long text and URLs:** the attribution and licensing text (Jolpica F1,
CC BY-NC-SA 4.0, source notice, terms link) and the long privacy and data
explanations wrap identically to Dark at every size; no horizontal scroll.
**Focus:** rows, options, links and buttons are 100% (Graphite, min 15.45);
the option ring is inset and never meets the selected mark.

## 6. Shared component consistency

| Role | Circuit | GP | Settings | Same as approved roles |
|---|---|---|---|---|
| Page, band, raised, hairlines | ✓ | ✓ | ✓ | yes |
| Graphite text, `#4F525A` secondary, oxide accent | ✓ | ✓ (light parts) | ✓ | yes |
| Graphite editorial panel | none | heading band only (LT-1) | none | LT-3 |
| Solid status outline 55%, dashed unknown 70% | ✓ | ✓ | n/a | yes (DK-1, VS-1) |
| Small inverse controls (discs, primary button) Graphite | ✓ (new: related disc) | ✓ | ✓ button | yes |
| Labels on Red Oxide in Chalk | seam only | ✓ | ✓ (new: mark check) | yes |
| Inverse plane Graphite | n/a | n/a | ✓ (new: snackbar) | yes |
| Notices (band fill, 26% border, oxide icon) | ✓ | ✓ | ✓ | yes (LT-8 pending) |
| Focus: Graphite on light; LT-5, LT-11 | ✓ | ✓ | ✓ | yes |
| DK-6 gradients kept | n/a | ✓ winner cell | n/a | yes (LT-10) |

## 7. LT-7 to LT-10 (definitions from `LIGHT-THEME-FOUNDATIONS.md` §9)

| # | Definition | Batch 2 evidence | Status / recommendation |
|---|---|---|---|
| **LT-7** | Final = Graphite fill with Chalk text; Live = keep Ember fill with Graphite text (or oxide fill) | Final renders in GP results and states (filled inverse chip with check, on the page). Live renders on no approved page | **Final: accept** (evidence now on GP Detail). **Live: still pending**, no rendered evidence |
| **LT-8** | Notice border: keep Graphite 26% (decorative) or strengthen | Measured and compared below | **Recommend keep 26%**; a stronger option is ready if wanted |
| **LT-9** | Selected navigation icon keeps Chalk on the oxide slab while its label turns Graphite | None: no Batch 2 screen has the bottom navigation | Still pending (Batch 1 and 53A evidence only) |
| **LT-10** | DK-6 decorative gradients unchanged in Light, shadow softened | Home round block (53A), Driver plate (Batch 1), GP winner cell (here, 7.65–8.3 vs its row) | **Recommend confirm**: all three are now verified in Light |

**LT-8 analysis.** The Light notice is identified by its text (≥ 4.5:1), its
cause icon in the oxide accent (6.09:1 on the fill), its fill (1.10 vs page)
and its place in the flow (a `role="status"` message above the content it
qualifies). It is not an interactive control and has no state to
distinguish, so the boundary is not needed to identify the component. Dark
works the same way: its border is 2.13:1, also below 3:1. The minimal
stronger treatment was still tested (`lt8-notice.css`): the border takes the
approved solid status-outline role (Graphite 55%, DK-1) with nothing else
changed.

| Notice (rendered) | Dark | Light, current (26%) | Light, candidate (55%) |
|---|---|---|---|
| Border vs page | 2.13 | 1.60 | 3.58 |
| Border vs its fill | 1.88 | 1.77 | 3.96 |
| Fill vs page | 1.13 | 1.10 | 1.10 |
| Icon vs fill | 6.57 | 6.09 | 6.09 |

Structure identical in all 12 comparisons (Circuit partial, GP states,
Settings information states; EN 390, ES 320 @200%). The candidate gives a
crisper box but makes notices as loud as status chips, which they are not;
recommendation: **keep 26%** (LT-8 "Keep"), the candidate stays available.

## 8. Owner decisions (Step 53E)

Approved: LT-7 Final, LT-8 (keep 26%), LT-10, LT-17 for Light. Pending: LT-7
Live, LT-9, LT-16, LT-17 for Dark. The table below is the Step 53D request,
kept as the record.

| # | Decision | Recommendation |
|---|---|---|
| **LT-7** (Final part) | Final chip in Light = Graphite fill, Chalk text, check | Accept; Live stays pending |
| **LT-8** | Notice border 26% (decorative) or 55% status outline | Keep 26% |
| **LT-10** | DK-6 gradients unchanged in Light | Confirm |
| **LT-16** (new) | GP/Circuit loading skeleton hero stays a neutral light placeholder, not a Graphite block | Keep neutral |
| **LT-17** (new) | GP team-link ring drawn 2px inside the link (both themes; Flutter under XS-31) | Accept as a cross-theme focus fix; Dark prototypes unchanged until the owner decides |

**No new visual blocker.** Still open: LT-7 (Live), LT-9, XS-11, XS-25,
XS-31, XS-32, XS-07 (title fit), and every Android and TalkBack requirement.

## 9. Screenshots for owner review

Two-up, left Dark | right Light, folder
`cross-screen-refinement/light-rollout-b2/validation-20261113-180746-b2/screens/`:

| File | Shows |
|---|---|
| `b2-cd-en-390.png` | Circuit Detail, full viewport (light sheet, Graphite related disc) |
| `b2-cd-partial-unknown-es-320-200.png` | Circuit, ES partial profile, CR-04 (notice, long name) |
| `b2-cd-unknown-assoc-bottom-en-390.png` | Circuit, CR-04: related block omitted, page end |
| `b2-cd-focus-related-en-390.png` | Related Grand Prix row focused |
| `b2-gp-en-390.png` | GP Detail, Graphite heading band and sessions |
| `b2-gp-title-es-320-200.png` | Long app-bar titles, ES 320 @200% |
| `b2-gp-states-08-es-320-200.png` | Unknown event status and format in the band |
| `b2-gp-states-25-en-390.png` | Classification status vocabulary (Final, Provisional, unknown, Not available) |
| `b2-set-index-es-320-200.png` | Settings root, ES 320 @200% (oxide value marks) |
| `b2-set-theme-light-chosen-en-390.png` | Theme with Light chosen: provisional preview (Dark prototype) vs Primer V2 Light |
| `b2-set-focus-option-en-390.png` | Theme option focused |
| `b2-set-states-03-es-320-200.png` | Save failure with the snackbar |
| `b2-info-data-es-320-200.png` | Data and updates, ES 320 @200% |
| `b2-info-acknowledgements-en-390.png` | Attribution and licensing text |

Three-up comparisons: `validation-20261113-191838-lt8/screens/`
`lt8-cd-partial-en-390.png`, `lt8-info-states-02-es-320-200.png` (Dark |
Light 26% | Light 55%); `validation-20261113-194111-tl/screens/`
`tl-gp-results-focus-team-en-390.png`,
`tl-gp-results-focus-team-es-320-200.png` (Dark | Light | Light with the
inside ring).

## Reproduce

```
cd design-exploration/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2
python build.py            # or --check
node checks-b2.mjs         # [--pages cd-index,set-theme-themelight] [--no-screens] [--out <dir>]
node checks-b2.mjs --lt8   # notice boundary comparison
node checks-b2.mjs --tl    # team-link ring comparison
```
