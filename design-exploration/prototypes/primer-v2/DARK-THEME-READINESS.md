# Primer V2 Dark: visual readiness triage (Step 51A)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a step of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](README.md#validation-output).

**Status: assessment, 2026-11-12, at `3c0fa64`.** Nothing here is decided,
approved or closed. [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) and
[`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md) stay authoritative. No prototype,
pilot, shared file, Flutter file, ARB file or backlog status was changed to
write this document, and no screenshot was generated.

**Owner review (2026-11-12, Step 51B).** The owner accepted the triage and
the sequence 51B → 51C → 51D. The A1–A3 outcomes in §7 are **experimental
directions for 51C, not visual approvals**. A1–A3 stay open. The Step 51B
screenshot selection and the recorded directions are in §8.

**Step 51B closed (2026-11-12).** The owner reviewed all ten screenshots
(§8.4). No new blocking visual problem was found.

**Step 51C (2026-11-12): experiment delivered** (§9).

**Owner review of 51C (2026-11-12).** A1 is approved, the flat Red Oxide
selected fill is approved, the Chalk ring on selected oxide is approved, and
the selected-label underline is rejected (§10).

**Step 51C.1 (2026-11-12): final selection and focus refinement delivered**
(§10). The owner reviewed all ten screenshots and approved the final A1, A2
and A3 visual directions (DK-1 to DK-3).

**Step 51D (2026-11-12): dark visual closure assessment** (§11). The Home
championship-band ring was measured and meets the intended requirements
(DK-4). Roles are frozen in [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md).
**Recommendation: Primer V2 Dark is visually ready to serve as the
reference** for Flutter components, the light design and token
consolidation (DK-5, awaiting owner confirmation). No visual blocker
remains; one non-blocking confirmation (DK-6). The implementation and
device-validation items stay open.

**Step 51E (2026-11-12): Primer V2 Dark formally visually closed** (§12).
- **DK-5 approved:** Dark is the visual design reference for Flutter, Light
  and token consolidation. This is not Android accessibility certification
  or production readiness.
- **DK-6:** the existing decorative gradients are retained.
- **DK-4:** accepted as technically verified in Chrome emulation.

Evidence retention is applied. Light and Flutter implementation have not
started.

**Inputs:** the backlog, decision log, `CORE-DESIGN-DECISIONS.md`,
`DESIGN-SYSTEM-CONSOLIDATION.md`, `HEADER-AND-HEADING-DECISIONS.md`,
`STATUS-VISUAL-DECISIONS.md` §13–15, `STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md`
§9–12, `consolidation-pilot/CONSOLIDATION-SUMMARY.md`, and the shared CSS
(`shared/tokens.css`, `base.css`, `components/chip.css`, `selector.css`,
`nav.css`, `settings/settings.css`, `calendar/calendar.css`). The Step 49
semantic audits were not repeated.

**Contrast method.** Ratios are WCAG relative-luminance values computed from
the CSS colours, with alpha composited on the stated surface. They are not
screen captures. They agree with the published figures (1.88, 2.80, 2.83,
6.1, 7.95).

---

## 1. Current readiness

**Close to visual closure.** Every screen family has a provisionally approved
dark reference. Titles, headings, status vocabulary, notice icons, absence
and ranking wording, and the Calendar header are decided or accepted as
direction (S-1 to S-5, CT-01 to CT-03, VS-1 to VS-7, N-1 to N-7, RK-1 to
RK-5, HM-01, CR-04, L1). The shared foundation has been piloted with 0 px
difference on every family.

**What is genuinely missing is small and all in one area: state boundaries
and selected states.** The open questions there set token values that Flutter
and the light theme both inherit:

- the solid chip outline (1.88:1);
- the selected slab (a gradient start that is not a token);
- one focus-ring case that the backlog does not record yet (§2, A3).

Separately, several approved screens have configurations the owner has never
viewed. That is a review gap, not a design gap (§2, A4).

**Three design blockers, one review gate and one closure record.** That is
three steps (§4).

| Area | State |
|---|---|
| Screen compositions (10 families) | Provisionally approved |
| Titles and section headings (XS-07, XS-29) | Direction accepted (Step 48B). Calendar title CT-01 approved. **No visual work left**; Flutter and device work remain |
| Large-text header (XS-06) | Heuristic. Calendar settled by CT-03. Device data needed |
| Status vocabulary (XS-11, XS-22) | Decided (VS-1, VS-3, VS-4), **except the solid-outline contrast** |
| Selected / focus states (XS-26) | **Open** |
| Team colour (XS-25) | Rule proposed, not decided. Belongs with the light theme (§3) |
| Tokens (XS-28) | Role table proposed (Consolidation §2.2). Flutter migration is a separate decision |
| Light theme (XS-01) | Not started. A provisional `GvColorsLight` stand-in exists only in Settings |

---

## 2. Prioritised remaining gaps

### 2.1 Boundary roles

A ratio alone does not decide whether a boundary must reach 3:1. WCAG 1.4.11
applies to visual information **required** to identify a component or its
state. This table records the role of each boundary.

| Boundary | Ratio (adjacent) | Role | Required indicator? | Class |
|---|---|---|---|---|
| Solid chip outline, `hair-strong` (Scheduled/Upcoming, DNF, Provisional, Not available, cancelled/postponed) | 1.88 ground · 1.91 tray | Shape around a non-interactive label. The word carries the meaning. The solid-vs-dashed pattern is part of the VS-1 vocabulary | **No** for identification: the word suffices, and the dashed border (6.1) stays perceivable against an unboxed word. **But the emphasis is inverted:** unknown is louder than known. Both themes need one `line.strong` value | **A1** |
| Standings provisional marker on the Chalk leader row | 2.2 on Chalk | Same chip, on the inverse surface | Same as above | **A1** |
| Dashed unknown outline, 60% Chalk | 6.1 | Unknown-value pattern (VS-1) | Meets 3:1 | — |
| Selected selector slab, oxide gradient on `tray` (Standings, Explore) | 2.47 (oxide) to 2.89 (`#B04633`) | **State indicator** | **Yes**, it identifies the selected state. Paired cues: label weight 600 → 800 and colour `text-2` → Chalk. The two label colours differ by only 1.91:1. **Constraint:** on `tray`, no fill can reach 3:1 and also keep a Chalk label at ≥ 4.5:1. The fill would need L ≥ 0.1454 against L ≤ 0.1441. On `ground` a narrow band exists (L 0.123–0.144; oxide is 0.111) | **A2** |
| Selected navigation slab, flat oxide on `ground-low` | ≈ 2.8 | State indicator, paired with the Chalk 800 label | Same as above | **A2** |
| Calendar next-event block, Driver plate (gradient) | 2.80 | Key-fact board. Not a control state | No. It is fill drift only (XS-26) | **A2** |
| **Focus ring (Ember) inside a selected selector button** (`.seg__btn:focus-visible`, offset −3px, drawn over the slab) | **2.27–2.66** across the gradient (3.82 on `oxide-deep`) | **Focus indicator**: the only focus cue | **Yes.** This is a real gap. It comes from the CSS, was not captured, and the backlog does not record it. The fix pattern already exists: on Chalk surfaces the ring switches to oxide (`.champ`, `.st--leader`). Chalk on flat oxide gives 5.43:1 | **A3** |
| Focus ring on Chalk surfaces (oxide) | 5.43 where drawn on Chalk. **Corrected in Step 51C:** the Standings leader-row ring is offset 2px *outside* the row, on graphite, and measures **2.80** | Focus indicator | **Not met for the leader row** (§9). Home `.champ` not measured. *(Step 51D: leader row resolved with Ember, DK-3; Home `.champ` measured: the ring is drawn on Chalk only, 4.90–5.43, min 3.82 at the hairline, drawn 1.00; met, DK-4, §11.2)* | **A3** |
| Pressed `raised` (1.32) · hover `tray` (1.13) | — | Transient feedback | No (not a persistent state). Only drift: GP's `.cl__hit:active` uses a 6% Chalk overlay (XS-09) | C |
| Selector container border `hair` (1.36), hairline separators | — | Grouping and decoration | No. The labels identify the controls | E |
| Team-colour tick or rail (`#1E41FF`) | 2.83 ground · 2.50 tray | Decorative identity, never the only carrier | No. The screens are inconsistent (TM-03 edge vs Explore B without one) | B (§3) |
| Completed Calendar row (C12, opacity 0.72; not rendered) | `text-2` 4.68 · outline 1.54 | Text, de-emphasis | Text passes, narrowly | C |

### 2.2 Category A: must resolve before dark-theme visual closure

*(Step 51D: A1–A3 decided as DK-1 to DK-3; A4 closed in Step 51B, §8.4. No
category A item remains, §11.4.)*

| ID | Gap | Backlog | Consequence of deferring |
|---|---|---|---|
| **A1** | **Solid-outline value.** Either raise `line.strong` for solid chips to ≥ 3:1 (about 45% Chalk ≈ 3.96:1; dashed stays 60%), or keep 22% with a recorded rationale. The Standings marker on Chalk takes the matching inverse value (`on-chalk-2` is 6.50:1) | XS-11 (open concern since Step 49E.1; a Step 49 closing condition) | The chip is the most repeated shared component (7 screens). Flutter would build `GvStatusChip`'s replacement on an undecided token, and goldens would churn when it changes. The light theme cannot map `line.strong` without knowing the dark intent. The concern stays open on every status screen |
| **A2** | **Selected fill and selected-cue rule.** Choose flat `brand.surface` everywhere or keep the gradient (then `#B04633` must become a token). Record the selected cue as **slab + weight + label colour + semantics**: no slab on `tray` can reach 3:1 with a Chalk label. Alternatively, ask for a further cue. No new component is needed | XS-26 (Pending decision); Consolidation §5.3 | `#B04633` cannot enter a token table, and the selector, navigation, Calendar block and Driver plate would be implemented twice. A gradient also doubles the light-theme mapping. The selected-state accessibility rationale would stay undocumented for implementers |
| **A3** | **Focus ring on brand surfaces.** Use Chalk where the ring sits on oxide, mirroring the existing oxide-on-Chalk rule. Decide it with A2, because the ratio depends on the fill (Chalk is 4.63 on `#B04633` and 5.43 on oxide) | **XS-31** (proposed in 51A; added as Open in Step 51C, §9) | Keyboard and D-pad focus on the selected segment would fail 3:1 by design. The rule would never reach Flutter's focus theme |
| **A4** | **Review gate on existing evidence**, with no new screenshots: the refinement folders behind DR-02, DR-03, TM-02 and TM-03; Explore B in English, 320dp and 200% (EXP-06); Circuit Spanish/320/200% (CIR-03); the information screens at 320 and 200% (SETT-17) | DRV-02, DRV-03, TEAM-02, TEAM-03, EXP-06, CIR-03, SETT-17 | Without this, Flutter would implement configurations nobody has approved (narrow widths, large text, Spanish), and defects would surface in Flutter, where they cost more to fix. "Visually ready" would rest on automated checks alone |

---

## 3. Issues that can safely wait

### B. Resolve while creating the light theme or shared tokens

| Item | Why it waits | Risk if forgotten |
|---|---|---|
| **XS-25** team-colour rule | The rule has to be relative to the surface. Dark liveries become safe on light and light ones (`#FF8000`) need the edge (Consolidation §9.3), so only the light theme tests it fully. Decorative in dark | Explore/Standings ticks and the Team rail diverge in `GvTeamAccent` |
| **XS-28** Flutter token migration and Archivo | CORE §1.2 D: no theme replacement until **both** appearances are approved | The P0 stays open; it is not a dark visual question |
| Hard-coded colours outside roles: `#1B1D20` (Calendar), the `rgba()` alphas | They are mapped while writing the role table for both themes | Values that cannot be mapped in light |
| Ember as accent text | It fails on light, so light remaps accent text to oxide (5.43:1). Dark is unaffected | — |
| Typography "probably redundant" weights and widths (CORE §1.2 A) | Merge only after visual comparison, best done once in the token sheet | — |

### C. During Flutter component implementation

- XS-09: consolidation, piloted at 0 px. Selector padding 12 vs 10; empty
  state 32/20 vs 28/18, kept as an opt-in variant; one pressed-state rule;
  `.btn:hover` irrelevant on touch.
- XS-27: height-derived 12° geometry, a single `GvLiveryCut` (uncontroversial).
- XS-08: selected-label fallback built into the single nav component (S-3).
  Validated on a device.
- XS-10: Calendar name wrapping. This is the existing S-4/G-9/EX-02 pattern;
  it can be confirmed on paper at any time.
- XS-12: units. XS-29: heading taxonomy codified, no restyle. XS-30, XS-22:
  decided, implementation and tests remain.
- CAL-01, HOME-04, STD-02: unrendered states, built from the existing empty,
  notice and chip vocabulary. C12 dimming keeps `text-2` at 4.68:1; verify
  in Flutter.
- SETT-04: the mail icon (owner preference already stated). SETT-03:
  label/value balance; the owner asked for it, it is typography only and can
  be tuned on the row.
- The dashed border painter (VS-1, XS-28). The `GvStatusChip` shape change.

### D. Android or TalkBack validation

XS-02, XS-03/XS-04 (reading order and label parity), XS-05, XS-06, XS-08,
XS-16, GPD-04/GPD-05 (driver-row discoverability and sibling targets: the
§5.10 chevron rule is the existing-vocabulary answer if device testing shows
a problem), EXP-05, SETT-02, SETT-05, the GP bar's duplicate reading, and
the legibility of the 20px notice icons.

### E. Deferred without blocking the redesign

- **Data-dependent:** XS-13, XS-14, XS-15/EXP-04 (media), STD-06, DRV-07,
  and all fixture items.
- **Audit V1** (Calendar's repeated unknown chips) needs a full season.
- **Polish:** CAL-02/03/04, STD-03/05/07, GPD-06/07/09/10, DRV-05, CIR-05/06,
  HOME-05/06/07, EXP-02/03.
- **Copy, product and legal**, with no visual content: XS-20, XS-23, XS-24,
  STD-04, GPD-02/03/08, DRV-06, TEAM-04/05, CIR-04, SETT-06/07/08/11–16/18–20,
  HOME-01/02.
- XS-21: sample banner, fixture builds only. XS-17: evidence housekeeping.

---

## 4. Recommended minimal sequence

**Step 51B: owner review of existing evidence (A4).** This is review only;
nothing is generated. One consolidated review list, grouped by folder:

- `driver-detail/validation-20261108-141921-refinement/`;
- `team-detail/validation-20261108-152827-refinement/`;
- `explore/comparison-missing-media/validation-20261108-202406/`
  (`after-b-en-*`, `-320x693-*`, `-text200-*`);
- `circuit-detail/validation-20261108-171413-final/` (ES, 320, 200%);
- the `settings/information/` 320×693 and 200% captures.

Do this first: any defect found can be folded into 51C. If the owner prefers
to accept automated evidence for some of these, record that explicitly
instead.

**Step 51C: state boundaries experiment (A1 + A2 + A3 together).** One
experiment in `cross-screen-refinement/`, applied to the pilots only. It
needs no new component and no new copy. Minimum comparisons, current against
proposed, all English at 390×844 @100%:

1. **GP results** with DNF, Provisional and unknown-finish chips: solid
   outline at 22% vs ≥ 3:1.
2. **Standings, top of page**, with the selected segment keyboard-focused
   and the leader row's provisional marker visible. One frame covers the
   flat slab, the Chalk focus ring and the inverse marker border.
3. **Calendar next-event block:** gradient vs flat. The Driver plate is the
   same token; include it only if the owner asks.

None of these changes layout, so check the 320 @200% and Spanish frames
automatically (0 layout difference) rather than through owner screenshots.

**Step 51D: dark closure record.** Documentation only:

- freeze the dark role table (Consolidation §2.2 plus the 51C outcomes);
- map every colour in the approved CSS to a role;
- record the boundary-role table (§2.1) as the accessibility rationale;
- name the authoritative reference per screen (Calendar = `calendar/` plus
  CT-01 plus `cross-screen-refinement/calendar-stage1/`, since Stage 1 is not
  promoted);
- check the §6 criteria.

The light theme starts from this record.

---

## 5. Dependencies for the light theme

1. **The frozen dark role table** (51D). Light remaps roles, not hues.
2. **A1:** the intent for `line.strong` (whether solid outlines reach 3:1)
   carries into light as the same rule.
3. **A2:** a flat `brand.surface` means one value to map. The selected-cue
   rule must hold on the light ground too. Chalk on oxide is 5.43:1 in both
   themes.
4. **A3:** the focus-ring-per-surface rule (Ember on graphite, oxide on
   Chalk, Chalk on oxide) needs a light column.
5. **XS-25:** the team-edge rule is written relative to the surface and
   first exercised in light.
6. **The inverse plane flips:** the Chalk band becomes graphite, and the
   Standings leader row and Home championship band follow it.
7. **Accent text:** Ember becomes oxide on light.
8. **Pilot screens:** Home, Standings and Settings first (Consolidation
   §9.4). Settings' `GvColorsLight` preview stays a stand-in.
9. **XS-28 waits for light approval** (CORE §1.2 D), so the Flutter token
   migration is decided once.

---

## 6. Proposed dark-theme closure criteria

**Dark is visually ready when all of the following hold.** It does not
require every backlog item to close.

**Approved visual and semantic design**
1. Every screen family has a named authoritative dark reference, and the
   owner has viewed it in English and Spanish at 390dp, **and** at 320dp and
   200% text, or has explicitly accepted automated evidence for named
   configurations (A4).
2. A1, A2 and A3 are decided and recorded in the decision log.
3. Every colour in the approved CSS maps to a named role. No uncatalogued
   hex value remains in the role table.
4. Every persistent state indicator (selected, focus, and the unknown/known
   chip pattern) is either ≥ 3:1 against its adjacent colours or has its
   paired cue documented. The focus ring is ≥ 3:1 on every surface it can
   sit on.
5. Text is ≥ 4.5:1, including the dimmed and inverse states, and no text is
   below 13px. Existing evidence holds this; recheck it after 51C.
6. No item remains in category A.

**Outstanding Flutter implementation** (not required for closure; tracked)
- XS-28 migration, decided with light;
- XS-18 delta register;
- the dashed painter and chip shape;
- XS-22, XS-30, HM-01, CR-04, RK-1/RK-3, N-1/N-2/N-4;
- XS-09 component extraction;
- the per-screen P0 differences: EXP-01, DRV-01, TEAM-01, CIR-01, SETT-01,
  SETT-10, GPD-02.

**Outstanding Android and accessibility validation** (required before
release, not for visual closure)
- category D, in full;
- Chrome-only measurements carry no WCAG-compliance claim until device and
  TalkBack checks run.

**Non-blocking future work:** category E, plus audit V1, N-6 and the
manual-refresh feedback, until Stage 1 is authorised and full-season data
exists.

---

## 7. Exact owner decisions needed

1. **Accept this triage:** three design blockers (A1–A3), one review gate
   (A4), and the B–E classification. In particular, XS-25 and XS-28 move to
   the light-theme or token phase.
2. **A4 scope:** review the listed evidence folders, or name the
   configurations whose automated evidence you accept without viewing.
3. **A1:** test a ≥ 3:1 solid outline, or keep 22% with the recorded
   rationale (word-led chip, dashed still distinct). Recommendation: test
   it in 51C.
4. **A2:** flat `brand.surface` for every slab and board, dropping
   `#B04633` (recommended), or keep the gradient as a token. Also confirm the
   selected cue as slab + weight + label colour + semantics.
5. **A3:** the focus ring switches to Chalk on brand surfaces. Allow it to
   be recorded as a new backlog item (proposed XS-31). This document does not
   add it.
6. **Approve Steps 51B → 51C → 51D** as the only work before the light
   theme.
7. **Optional, otherwise C or D:** confirm XS-10 (Calendar wraps names) on
   paper now. Fold SETT-03 (label/value balance) or GPD-04 (driver-row
   chevron) into 51C only if you want them settled visually before Flutter.

---

## 8. Step 51B: owner decisions and screenshot selection

### 8.1 Experimental directions for 51C (not approvals)

| Blocker | Direction to test | Boundaries set by the owner |
|---|---|---|
| **A1** solid chip outline | A stronger shared solid-outline token | It does not have to match the dashed unknown border (6.1:1). The aim is clear distinction and accessibility without making secondary chips too prominent |
| **A2** selected fill | Flat existing Red Oxide (`--oxide`) in place of the `#B04633` gradient. This is the preferred candidate only | Evaluate the fill, label colour, weight and the accessible selected state together. Several cues being present does not by itself establish compliance |
| **A3** focus ring | A Chalk ring on selected Oxide surfaces | Selected and keyboard-focused must stay distinguishable. Check focus visibility and contrast on selected **and** unselected controls |

**Proposed XS-31 (not added to the backlog):** the Ember focus ring drawn
inside a selected selector button sits on the oxide slab at 2.27–2.66:1
(§2.1, A3). This comes from the CSS, was not captured, and is pending owner
visual review in 51C. No backlog entry was changed. *(Step 51C: confirmed by
measurement and added as XS-31, Open; §9.)*

### 8.2 Screenshots for the owner (existing files only)

Ten files, all verified on disk on 2026-11-12. None was generated, copied or
recompressed. All of them are Chrome emulation: **none of them is Android
or TalkBack evidence.** Every file below is a validation capture of the
**approved prototype** for its screen, not a consolidation pilot and not an
isolated experiment. For Driver and Team, the captures are of the
refinement pass (DR-02, DR-03, TM-02, TM-03, provisionally approved, never
visually inspected).

The base folder for every path is `design-exploration/prototypes/primer-v2/`.

| # | Screen and configuration | Folder (under the base) | Filename | What it verifies | Automated result | Git |
|---|---|---|---|---|---|---|
| 1 | Driver Detail, Scenario A, EN, 390×844 @100% | `driver-detail/validation-20261108-141921-refinement/` | `en-a-390x844-01.png` | DR-02 season line and DR-03 "Race number" label on the plate, at the standard size. Hierarchy of the season line, name and nationality against the board | Pass. Overflow, spill, small text and targets all 0. `plate-check.txt`: 0 of 72 plates with problems | Tracked |
| 2 | Driver Detail, Scenario A, ES, 320×693 @200% | same | `es-a-320x693-text200-01.png` | Worst case for the plate: the stacked plate, "Dorsal de la temporada" wrapping to three lines on the board, and the empty lower-left area (related to DRV-05) | Pass (same checks) | Tracked |
| 3 | Team Detail, Scenario A, ES, 320×693 @200% | `team-detail/validation-20261108-152827-refinement/` | `es-a-320x693-text200-02.png` | Line-up order (Doohan, Gasly, Colapinto) and the Ember hand-over spans pairing non-adjacent rows, at large text in Spanish | Pass. `layout-check.txt`: 0 of 160 items with problems | **Ignored, local only** |
| 4 | Team Detail, development states gallery, EN, 390×844 (segment 3) | same | `en-states-390x844-03.png` | TM-03 Chalk edge on `#1E41FF` (frame 10, Red Bull: banner and line-up) beside the unedged `#FF8000` (frame 11, McLaren). Also shows the solid "Provisional" chip (frame 13; relevant to A1). Development gallery, not app UI | Pass (states run 0 problems) | **Ignored, local only** |
| 5 | Explore Alternative B, Drivers, EN, 320×693 @200% | `explore/comparison-missing-media/validation-20261108-202406/` | `after-b-en-drivers-320x693-text200-01.png` | EXP-06: English, narrow and large text. Stacked selector with the gradient slab (A2), stacked 2×2 nav with the selected Explore slab, wrapped name and team, labelled Position/Points, chevron and tick | Pass. `layout-check.txt` 0 problems in all after-b runs | **Ignored, local only** |
| 6 | Explore Alternative B, Teams, ES, 320×693 @200% (second screen) | same | `after-b-es-teams-320x693-text200-02.png` | EXP-06: wrapped long team names, Spanish labels, the `#1E41FF` tick with no edge (the XS-25 inconsistency against item 4), and the stacked nav in Spanish ("Clasificaciones") | Pass | **Ignored, local only** |
| 7 | Circuit Detail, Scenario A, ES, 320×693 @200% | `circuit-detail/validation-20261108-171413-final/` | `es-a-320x693-text200-01.png` | CIR-03: circuit sheet in Spanish at large text. Hyphen-wrapped name, "Datos del circuito" group label, dimension line, facts grid | Pass. `layout-check.txt`: 0 of 160 items with problems | Tracked |
| 8 | Circuit Detail, Scenario A, ES, 320×693 @200% (second screen) | same | `es-a-320x693-text200-02.png` | CIR-03: lap-record figure, related-event row (oxide seam, Chalk disc), season line placement, and the solid "Próximo" chip outline (relevant to A1) | Pass | **Ignored, local only** |
| 9 | Settings information, Data and updates D3 (frozen, DEV), ES, 320×693 @200% | `settings/information/validation-20261108-211707/` | `es-data-frozen-320x693-text200-01.png` | SETT-17: DEV strip plus a two-line variant-C title (the chrome is about 24% of the viewport), and the frozen date breaking at its hyphen ("2026-" / "10-07"; allowed by the rule, for the owner's judgment) | Pass. 108 runs, 0 problems | **Ignored, local only** |
| 10 | Settings information, Acknowledgements, ES, 320 @200%, keyboard focus on the last link | same | `int-es-acknowledgements-keyboard-last-320-200.png` | SETT-17 and focus visibility: the Ember ring on an **unselected** row (the A3 baseline), the S-2 narrowed title "Agradecimientos", the licence title breaking at its real hyphens, a URL breaking anywhere | Pass. `interaction.txt` 126 of 126, focus not hidden under the chrome at 320 @200% | **Ignored, local only** |

**Ignored files** are excluded by the per-folder `validation-*/*.png` rules
in `design-exploration/.gitignore` (for example lines 135 and 195), which
re-include only selected files. They exist only in this local
checkout, so a fresh clone will not have them. No ignore rule was changed.

**Deliberately not selected:**
- English Circuit A/B/C at 390, Spanish Explore B at 390, and Settings
  information at 390×844 (already reviewed by the owner);
- the remaining state galleries;
- duplicate languages of the same frame.

### 8.3 Known limits of the automated evidence

- The checks cover width, overflow, spill, ellipsis, text below 12.5px,
  targets below 48px, mid-word splits, collisions and plate geometry. They
  do not judge hierarchy, balance or emphasis. That is what this review is
  for.
- All captures use Chrome's emulated 200% root scale, not Android 14
  non-linear scaling, with zero system insets (XS-05, XS-06, XS-16).
- Focus is captured only for the Settings information links (item 10). No
  existing capture shows a focused **selected** selector segment. That case
  is left to 51C (A3).
- The Driver and Team refinement captures predate VS-1 to VS-4. The chips
  and notices there show the reviewed vocabulary, not the Step 49E
  decisions.
- None of this is TalkBack evidence. TM-02 ("Team: Alpine") has no visible
  effect and cannot be judged from screenshots.

**Next:** the owner reviews items 1–10. 51C starts only after that review.

### 8.4 Step 51B closure (owner review, 2026-11-12)

- All ten screenshots in §8.2 were reviewed by the owner.
- No new blocking visual problem was found.
- Driver, Team, Explore B, Circuit and Settings information are **accepted at
  the prototype-review level** for the reviewed configurations.
- The existing observations stay with their issues:
  - team colours (XS-25, TEAM-03);
  - large-text bottom navigation (XS-08);
  - solid-outline contrast (XS-11, A1);
  - Settings date wrapping (SETT-17).
- Android, TalkBack, responsive and team-colour concerns **remain open**. No
  device-dependent item was marked complete, and no backlog status changed.

---

## 9. Step 51C: state-boundary experiment (awaiting owner review)

**Experiment:**
[`cross-screen-refinement/dark-state-boundaries/`](cross-screen-refinement/dark-state-boundaries/REPORT.md).
It is derived from the consolidation pilots, which were not modified. It
changes no shared CSS or JS, and no layout, text, accessible name or Tab
order (0 differences in every run). Every differing pixel is inside the chip,
selector or next-event regions. Chrome emulation only.

| | Candidate tested | Measured (390 EN, rendered) | State |
|---|---|---|---|
| **A1** | Solid status outline: Chalk 45% on graphite, on-chalk 55% on Chalk (dashed and alert stay at 60%) | 1.85–1.89 → **3.71–3.96**; Chalk-row marker 2.18 → **3.74** | Experimental direction, not approved |
| **A2** | Flat `--oxide` for the selector slab and Calendar block, plus an optional Chalk underline as the selected cue (`-mark`) | Slab vs tray: worst 1.72 → 2.47 (still < 3:1; not sufficient alone). Label 4.63–7.80 → 5.43. The underline is 5.43 on oxide but collides with Primer's underlined links | Experimental direction, not approved |
| **A3** | The ring takes the colour of the surface it is drawn on | Selected selector 2.27 (29% ≥ 3:1) → **5.43 (100%)**; Standings leader row 2.80 (0%) → **7.44** (Ember); Calendar next-event 2.54 → 5.43 | Experimental direction, not approved |

**Unresolved after the experiment:**

- The unselected selector ring crosses the selected slab's 12° tip at 2.66:1
  (5–8% of its boundary).
- The Calendar ring is hidden under the oxide block at the top left.
- No disabled state exists on these pages, so it is untested.

**Pre-existing, outside A1–A3:** at 320 @200%, focus can sit entirely under
the fixed bottom navigation (Calendar, Standings; REPORT §7.1). It is not
tracked; tracking it is an owner decision.

**XS-31** was added to `DESIGN-BACKLOG.md` as Open (P1), because measurement
confirmed it. XS-11, XS-26, XS-28 and every accessibility item stay open.

**Next:** owner visual review of the REPORT §10 screenshots and the REPORT §9
decisions. Step 51D waits for that review.

---

## 10. Step 51C.1: owner decisions and final selection and focus refinement

### 10.1 Owner decisions on Step 51C (2026-11-12)

| Item | Decision |
|---|---|
| **A1** solid status outline: Chalk 45% on graphite, on-chalk 55% on Chalk | **Approved** (token direction) |
| **A2** flat Red Oxide (`--oxide`) selected fill | **Approved** |
| A2 selected-label underline | **Rejected**: it may be confused with existing link styling |
| **A3** Chalk focus ring on selected oxide controls | **Approved** |
| A3 Ember ring outside the Chalk Standings leader row | **Preferred direction**, pending focused visual review |

**Still requiring validation (51C.1):**
- unselected selector focus;
- partially obscured rings (Calendar next-event, GP winner row);
- the selected-state cue that does not depend on colour.

XS-11, XS-26, XS-28 and XS-31 stay open until 51D records the decisions and
Flutter implements them. All Android and TalkBack items stay open.

### 10.2 Step 51C.1 results (experiment only; REPORT §12)

These are Chrome emulation results at EN 390 @100% and EN/ES 320 @200%. In
every run: the accessibility tree, text, Tab order, targets and fit modes
are unchanged; there is no clipping; and A1 and flat oxide do not regress
(the control is identical).

| Question | Result | Recommendation |
|---|---|---|
| Selection cue: flat slab (A) vs one 12° Chalk cue (B) | B is 5.43:1 with no height or target change, recognisable at 320 @200%. But it reads as a stray "/" before the label. With colour removed, A's filled slab and weight change still read clearly (the slab is 2.47:1, so the state relies on luminance plus weight, not hue) | **Keep A, the flat slab without a cue.** Record the rationale as slab + weight + label colour + selected semantics. Uncertainty remains under a strict 1.4.11 reading, and device and TalkBack checks are pending |
| Chalk ring on every selector option | Unselected focus crossing the selected slab's 12° tip: Ember min 2.66 (92% ≥ 3:1) → Chalk **5.43 (100%)**; stacked 6.57 → 13.41. The ring is an outline and selection is a fill, so they stay distinct | **Chalk on all selector options** |
| Calendar next-event ring | Drawn 0.85 (hidden under the oxide block) → **1.00**, by painting the block below the ring while focused. Nothing changes at rest | Paint focus above decorative blocks |
| GP classification rows | The left edge of **every** row ring was hidden under the rail cell (drawn 0.82) → **1.00**. The winner row's ring is Chalk where it crosses oxide (min 4.63); the winner cell is unchanged | Same rule; Chalk wherever the ring crosses oxide |
| Standings leader row | Ember ring outside the row, 7.44 (51C evidence, unchanged) | Confirm the Ember ring |

**Hidden keyboard focus under the fixed bottom navigation** (320 @200%,
Calendar and Standings). No existing item covered it, so **XS-32** was
created (P1, Open) with Flutter and Android acceptance criteria. No
navigation redesign and no Flutter change.

**Next:** owner visual review of the REPORT §12.6 screenshots. Step 51D (the
dark closure record) waits for that review.

---

## 11. Step 51D: dark visual closure assessment

### 11.1 Decisions recorded (owner, 2026-11-12)

The owner reviewed all ten Step 51C.1 screenshots and approved the final
visual directions. They are recorded in `DESIGN-DECISIONS.md`.

| ID | Approved direction |
|---|---|
| **DK-1 (A1)** | Solid outlines at Chalk 45% on dark surfaces and `on-chalk` 55% on Chalk. The dashed unknown treatment stays stronger |
| **DK-2 (A2)** | Flat existing `--oxide`, in the existing diagonal selected shape, with bold selected text and accessible selected semantics. No selected-label underline. No additional 12° tick |
| **DK-3 (A3)** | Chalk ring on selected and unselected selector buttons. Chalk across oxide in Calendar and GP results. Painting order keeps the whole intended perimeter visible. Ember outside the Chalk Standings leader row, against graphite |

These are approved visual directions, **not** proof of Android or WCAG
compliance.

- **The flat selected fill measures 2.47:1 against the selector
  background.** Its combination with bold text and diagonal geometry is the
  recorded rationale. It does not automatically establish WCAG compliance.
- **Keyboard focus visibility is not complete** until real scrolling and
  system insets are verified in Flutter (XS-32).

### 11.2 Home championship-band ring (the remaining verification)

Measured in the isolated experiment (REPORT §13). The approved Home
prototype and its pilot are unchanged. Chrome emulation at EN 390 @100% and
EN/ES 320 @200%.

| Question | Result |
|---|---|
| Existing style | `.champ :focus-visible { outline-color: var(--oxide); }` on the base 2px ring, offset 3px |
| Surfaces touched | The Chalk band only (`--chalk` → `--chalk-low`). The ring stays inside the band: 15px from the sides, 1px from the bottom edge |
| Rendered contrast along the path | 4.90–5.43 on the band; minimum **3.82** where the first link's ring crosses the hairline divider. 97–98% of ring pixels change by ≥ 3:1 from their unfocused colour |
| Continuously visible | **Yes**, drawn 1.00 on every edge, for both links, at every size |
| Hidden by decoration | **No.** The oxide name seam touches the ring's top edge (same colour, 1px) but does not cover it |
| Reusable approved role | **Yes**: the existing Home treatment, which is the A3 surface rule (a ring on Chalk takes oxide). No new colour |

**Result: it meets the intended requirements. No correction was tested,
because none was needed (DK-4).**

New XS-32 evidence: when Tab reaches these links without further
scrolling, the bottom navigation partly covers "View drivers' standings"
at **390 @100%** (20 of 48px visible). At EN 320 @200% it fully covers
"View constructors' standings".

### 11.3 Role freeze

[`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md) separates three layers:
- colour tokens: the existing `tokens.css` values only. `#B04633` is not a
  token. *(Step 51E correction: it is not retired. It remains a contextual
  decorative value in the retained gradients, §12.)*
- contextual alphas and effects;
- component roles: surfaces and text, selection, Ember accents, solid and
  dashed outlines, and focus on graphite, on oxide, inside Chalk and around
  Chalk cards, including the selected and focused combinations.

No new colour, dimension or typography change. Its §6 lists where the
approved prototypes still differ from the frozen roles.

### 11.4 Closure criteria (§6)

| # | Criterion | Result |
|---|---|---|
| 1 | Named dark reference per family; owner viewed the narrow and large-text configurations, or accepted named automated evidence (A4) | **Met**: A4 closed in Step 51B (§8.4) |
| 2 | A1, A2, A3 decided and recorded | **Met**: DK-1 to DK-3 |
| 3 | Every colour in the approved CSS maps to a named role | **Met**: `DARK-THEME-ROLES.md` §1–2 catalogue every literal in the pilot and shared CSS. `#B04633` is catalogued as a contextual decorative value (wording corrected in Step 51E). The Settings light preview is out of scope |
| 4 | Persistent indicators ≥ 3:1, or paired cue documented; focus ring ≥ 3:1 on every surface | **Met, with a recorded caveat.** Solid outlines 3.71–3.96 (3.74 on Chalk); dashed 6.1. Selected slab 2.47, with the paired cue documented (DK-2), not a compliance claim. Focus ≥ 3:1 on every measured surface (minimum 3.82 Home divider, 4.63 GP winner end). Navigation selected-and-focused judged by geometry only |
| 5 | Text ≥ 4.5:1; nothing below 13px | **Met** on existing evidence. The selected label improves to 5.43 on flat oxide (was 4.63 on the gradient start). No small text in any 51C–51D run |
| 6 | No category A item remains | **Met** |

### 11.5 Readiness decision (recommendation; owner confirmation DK-5)

**Primer V2 Dark is visually ready to serve as the reference** for:
1. **Flutter component implementation:** roles, states and focus rules are
   fixed. Flutter implements the frozen roles, not the prototypes' remaining
   gradient or ring values (`DARK-THEME-ROLES.md` §6).
2. **Primer V2 Light design:** every role has a dark value to remap. The
   focus rule is surface-relative, so it carries over (§5 of the role
   freeze).
3. **Final cross-theme token consolidation (XS-28):** tokens, alphas and
   roles are separated.

**No genuine visual blocker remains.** Things that need a decision or a
check, none of them blocking:
- **DK-6**, the only open confirmation: flat oxide for the three remaining
  gradient boards (Home hero round block, Driver plate, GP winner cell).
  The owner has not seen them flat. One brand-surface value is recommended.
  Deciding later changes no role, because the gradient was never a token.
  *(Step 51E: the owner decided to retain the gradients, §12.)*
- Cosmetic observations: the Home seam touching the focus ring, and the
  1px ring clearance at the band's bottom edge.
- Already tracked: audit V1, N-6 and the manual-refresh feedback stay
  category E.

### 11.6 Kept open (none closed by this step)

- XS-11 (status-boundary and contrast validation);
- XS-26 (selected-state implementation and accessibility verification);
- XS-28 (Flutter shared tokens, dashed border);
- XS-31 (focus-ring implementation, Android validation);
- XS-32 (hidden keyboard focus, now also on Home);
- XS-02 (TalkBack);
- XS-05 (font scaling);
- XS-16 (device);
- XS-01 (light theme).

The only status change is XS-26: Pending decision → Open, because it is now
decided and its implementation remains.

### 11.7 Evidence retention (proposal, not applied)

There are 44 screenshots across the three validation folders. The proposal
keeps 22 screenshots Git-visible (1.2 MB): 20 owner-reviewed comparisons and 2 Step 51D technical-evidence crops. *(Applied in Step 51E, §12.)* The rest stay
local, and every report and script stays tracked. The rules are in the
experiment REPORT §13.5 and
`cross-screen-refinement/EVIDENCE-RETENTION.md`. **`.gitignore` is
unchanged**, and the rules need explicit owner approval. Nothing is staged
or committed.

**Next:** owner confirmation of DK-5 (and optionally DK-6). The light theme
and Flutter implementation have not started.

---

## 12. Step 51E: formal Primer V2 Dark visual closure (2026-11-12)

**Status: Primer V2 Dark is formally visually closed.** This is
documentation and evidence retention only. No prototype, pilot, shared CSS
or JS, Flutter, ARB or backend file changed. No new screenshot or
experiment.

### 12.1 Owner decisions

| ID | Decision |
|---|---|
| **DK-5** | **Approved.** Primer V2 Dark is the visual design reference for Flutter implementation, the Primer V2 Light design and cross-theme token consolidation. This is visual design approval, **not** Android accessibility certification or production readiness |
| **DK-6** | **Retain the existing decorative gradients** on the Home hero round block, the Driver identity plate and the GP winner position cell. Flat oxide applies to selected controls and the DK-2 components only |
| **DK-4** | **Accepted as technically verified in Chrome emulation.** The two Home crops are technical evidence, not owner-reviewed visual approvals. No further Home experiment is required |

### 12.2 Decorative gradients, as they exist (inspected read-only)

| Composition | Selector | Definition | Where |
|---|---|---|---|
| Home hero round block | `.hero__round::before` | `linear-gradient(165deg, #B04633 0%, var(--oxide) 45%, var(--oxide-deep) 100%)` | `refinement-01/styles.css`, `consolidation-pilot/home/home.css` |
| Driver identity plate | `.dp__plate::before` | Same, oxide at 55% | `driver-detail/dd.css`, `consolidation-pilot/driver-detail/dd.css` |
| GP winner position cell | `.cl--winner .cl__pos` | Same, oxide at 55% | `grand-prix-detail/gpd.css`, `consolidation-pilot/grand-prix-detail/gpd.css` |

`#B04633` is the only non-token colour in these gradients.
- It is documented as an **existing contextual decorative value**
  (`effect.brand-gradient`). It is not a shared token, and it is **not
  retired**: it remains in the approved designs.
- The approved prototypes also still draw the selector slab and the
  Calendar next-event block with the same gradient. DK-2 sets flat oxide
  for those in implementation.
- No gradient was created or modified.

### 12.3 Final verification

| # | Check | Result |
|---|---|---|
| 1 | No unresolved visual blocker prevents starting Light | **Confirmed.** DK-6 is decided; no open visual decision remains in category A |
| 2 | All dark roles documented | **Confirmed.** `DARK-THEME-ROLES.md` §1–3, including `effect.brand-gradient` |
| 3 | Decorative gradients described accurately | **Confirmed** (§12.2). `#B04633` is no longer described as retired |
| 4 | The 22 retained screenshots are Git-visible | **Confirmed** with `git ls-files --others --exclude-standard` |
| 5 | Other generated screenshots stay local | **Confirmed.** 22 of 44 ignored, all on disk |
| 6 | No source or report ignored | **Confirmed.** All 22 ignored files are PNG; the HTML, CSS, scripts, `build.py`, REPORT, `results.json` and `summary.txt` are visible |
| 7 | Windows paths checkout-compatible | **Confirmed.** Longest kept path is 175 characters from the repository root: 247 in the redesign worktree and 249 in the main checkout (maximum 255 across all registered worktrees), under 260. `core.longpaths` not enabled |

### 12.4 Still open (unchanged by closure)

| Item | What remains |
|---|---|
| XS-11 | Status boundaries and contrast |
| XS-26 | Selected-state implementation and validation, including the **2.47:1** selected-fill caveat, pending appropriate accessibility evaluation |
| XS-28 | Flutter tokens and dashed borders |
| XS-31 | Focus-ring implementation |
| XS-32 | Focused content obscured by fixed navigation, now with explicit Home acceptance cases: partial occlusion at 390dp, complete occlusion at 320dp @200% |
| XS-02, XS-05, XS-16 | TalkBack, font scaling, device |
| XS-01 | Light theme, not started |

## 13. Step 54C: cross-theme specification (2026-11-13, cross-reference)

The frozen cross-theme specification
([`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md), DD XT-6)
applies to Dark: XT-1 (Home Explore links' ring 4px inside), XT-2 (completed
Calendar rows at 100% opacity; the inherited 0.72 superseded; completed
outline 2.65 → 3.96), XT-3 (shared team-colour geometry; TM-03 geometry
superseded), XT-4 (back-button offset 3px kept), XT-5 (pressed semantics).
No Dark colour changed; Primer V2 Dark stays visually closed (DK-5); every
item in §12.4 stays open.
