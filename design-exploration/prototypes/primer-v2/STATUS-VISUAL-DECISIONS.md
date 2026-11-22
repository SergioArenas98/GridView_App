# Visual consistency of information states (Step 49E)

**Status: closed, 2026-11-12 (Step 49E.2, §15).** All seven owner decisions
are recorded; the visual exploration is complete.
- **Approved:** VS-1 (dashed outline for every unknown value, including the
  unknown finish), VS-3 (Standings marker without the dagger), VS-4 (alert,
  clock and help notice icons), VS-5, VS-7.
- **Rejected:** VS-2. **Unchanged:** VS-6.
- Recorded in `DESIGN-DECISIONS.md` (VS-1 to VS-7) and `DESIGN-BACKLOG.md`
  (XS-11, XS-22, XS-28, XS-02, XS-16, XS-18, STD-04). XS-22 moved from
  Pending decision to Open; no item closed.
- **Not implemented:** visual prototypes only. Flutter, Android, TalkBack and
  contrast requirements stay open (§15).
- **Unchanged:** Flutter, the tests, ARB files, the contract, domain models,
  approved prototypes, consolidation pilots, Calendar experiments and shared
  CSS/JS. The prototypes, pilots and `chip.css` still show the Standings
  dagger as reviewed; VS-2 and VS-3 supersede their description.
- **Experiment:** `cross-screen-refinement/status-visual-consistency/`
  (`build.py`, `checks.mjs`, `checks-49e1.mjs`, 22 derived pages); evidence
  in `validation-20261111-233337-experiment/` (25 screenshots) and
  `validation-20261112-065316-49e1/` (5 screenshots). 15 owner-reviewed
  screenshots Git-visible, the rest local (§15).
- **Scope of the evidence:** Chrome emulation only (software raster, DPR 2).
  **No Android or TalkBack validation.** §1–§14 are the Step 49E and 49E.1
  record, unchanged.

## Summary

| | Finding | Genuine inconsistency? | Recommendation |
|---|---|---|---|
| A1 | "Format unknown" uses the **filled context chip**, the look of a confirmed "Sprint weekend" / "Standard weekend" (GP hero, Circuit related event) | **Yes** | Dashed outline, same as "Status unknown"; the words stay different |
| A2 | Grand Prix session "Status unknown" is **plain grey text**, like the confirmed "Scheduled" | **Yes** | Compact dashed chip, beside the existing compact chips for Cancelled and Postponed |
| A3 | Classification finish "Status unknown" uses the **solid outline** shared with DNF, DNS, DSQ, DNQ and Lapped | **Yes** | Compact dashed chip |
| — | Event / result-document "Status unknown" is dashed in Calendar, the GP hero, Home, the Circuit related event and the GP certainty vocabulary | No: already consistent | Keep |
| B1 | "Provisional" has two looks: the Standings row marker is outline + "†" + word; GP results, Driver and Team use the plain outline chip, **identical to "Not available"** (GP) | **Yes** | Outline + "†" + word everywhere; Standings keeps its compact size |
| C1 | Every notice uses the **cloud-off (offline) icon**, also for a server failure, staleness or a missing detail document; stacked notices show two identical icons | **Yes** (XS-22) | Existing cause icons: alert (failure, failure + stale), clock (stale), help (incomplete) |

---

## 1. Current inconsistencies verified

**Primer V2 vocabulary as documented** (`shared/components/chip.css`): "unknown
= dashed outline; confirmed (Final) = filled Chalk + check …
`.chip--context` ("Race weekend", "Sprint": tray fill),
`.chip--provisional` (dagger + word)". The approved pages diverge from it:

| Where (pilot) | State | Today | Matches the vocabulary? |
|---|---|---|---|
| Calendar rows; Home session card; GP hero; Circuit related event; GP certainty vocabulary (states frame 25) | Event / result status unknown | `chip--unknown` (dashed) | Yes |
| GP states frame 8; Circuit states | Weekend format unknown | `chip--context` (filled), same as confirmed formats | **No** |
| GP states frame 9 | Session status unknown | Plain secondary text (`.sess__state`), same as "Scheduled" | **No** |
| GP states frame 22 | Finish status unknown | `chip--outline chip--sm` (solid), same as DNF | **No** |
| Standings states frame 8 (mixed table) | Provisional row | `chip--provisional`: outline + "†" (`aria-hidden`) + word, 24px | Yes |
| Standings states frame 7 (uniform table) | Provisional table | Section caption "These standings are provisional and may still change." | Yes (STD-04: weight only) |
| GP states frames 20, 25; Driver and Team states | Provisional classification / standing | `chip--outline` + word, 30px; "Not available" identical | **No** |
| Every notice (Calendar, GP, details, Home) | Failure, stale, incomplete, combined | `i-cloud-off` | Implies "offline"; never the only carrier (text always present) |

**Flutter today** (read-only):
- **Status chips:** `GvStatusChip` is a tone dot + label. Event "unknown",
  every weekend format (including the confirmed "Sprint weekend") and
  Driver/Team "Provisional" use the neutral tone. GP result statuses use
  success for Final and info for provisional, unavailable and unknown.
- **Standings:** the badge is the word "Provisional" (no dagger).
- **Notices:** `GvOfflineNotice` uses `Icons.cloud_off_outlined` for every
  notice.
- Flutter has **no dashed or dagger** concept. These are Primer V2 changes,
  belonging to the implementation delta (XS-18) and the token decision
  (XS-28).

**What the Standings dagger is (verified):**
- **Not a reference mark.** In a mixed table (frame 8), the only place it
  appears, there is no explanatory note. A uniform table uses the caption
  instead and shows no daggers.
- **Not an accessibility convention.** It is `aria-hidden`; the accessible
  name is "…, Provisional".
- **A deliberate vocabulary cue, not decoration.** It is the non-colour shape
  that the documented vocabulary assigns to "provisional" (`chip.css`;
  `standings/README.md` ST15 "† Provisional"). It carries no information
  beyond the word.
- **Risk:** in typography a dagger conventionally points to a footnote, so a
  reader may look for a note that does not exist.

## 2. Semantic constraints

1. **No new words or states.** Only existing labels:
   - "Status unknown" / "Estado desconocido";
   - "Format unknown" / "Formato desconocido";
   - "Provisional";
   - "Not available" / "No disponible";
   - the four notice texts, including the Step 49D.3 combined wording.
2. **An unknown event status and an unknown weekend format are different
   facts.** They may share a pattern but keep their own words and chips.
3. **Unknown ≠ provisional ≠ confirmed ≠ unavailable.**
   - Unknown: the provider gave no recognised value.
   - Provisional: known but not final.
   - Final: confirmed.
   - Not available: no classification exists.
4. **Never colour alone.** Each state keeps its word; the pattern (dashed,
   filled + check, dagger, icon) only reinforces it.
5. **No finality implied.** A provisional marker must never look like Final
   (filled + check).
6. **Icons are never the only carrier.** Notice text alone distinguishes
   failure, staleness and incompleteness.
7. **Source statuses unchanged.** Presentation only; nothing is inferred
   from dates.

## 3. Recommended shared patterns

| State family | Pattern | Size by context |
|---|---|---|
| **Unknown provider value**: event status, weekend format, session status, finish status, result-document status | **Dashed outline** (`chip--unknown`) + existing word | 30px chip in heroes and sections; compact 24px (`chip--sm`) in session and classification rows |
| Confirmed context: Sprint / Standard weekend | Filled context chip (unchanged) | 30px |
| Confirmed session status: Scheduled | Plain secondary text (unchanged) | — |
| Session exceptions: Cancelled / Postponed | Compact solid chip + icon (unchanged) | 24px |
| **Provisional** | **Outline + "†" (`aria-hidden`) + "Provisional"** | 30px in sections and detail cards; 24px row marker in Standings (exception) |
| Final | Filled Chalk + check (unchanged) | 30px |
| Not available (classification document) | Outline + word (unchanged); now distinct from Provisional through the dagger | 30px |
| **Notice: refresh failure, and failure + stale (combined)** | Existing notice + **`i-alert`** (Flutter `Icons.error_outline`, already the error-state icon) | — |
| **Notice: stale** | Existing notice + **`i-clock`** (already in the GP sprite; Flutter `Icons.schedule_outlined` exists in the app) | — |
| **Notice: incomplete profile** | Existing notice + **`i-help`** (already the not-found icon; Flutter `Icons.help_outline`) | — |

- `cloud-off` would leave the notices: the app never claims "offline" for a
  failure (`STATUS-NOTICE-DECISIONS.md`).
- The combined notice takes the failure icon because the failure is its first
  fact; the text states the staleness.

## 4. Intentional exceptions to retain

- **Standings:**
  - the uniform-table caption, not a chip per row (STD-04 decides its
    weight);
  - the 24px compact row marker (dense rows).
- **Calendar rows:** the repeated dashed chip per row stays until audit
  decision V1 (a quieter inline marker in long lists) is taken. Not changed
  here.
- **Session rows:** confirmed statuses stay plain text. Only exceptions
  (Cancelled, Postponed, now unknown) are chips.
- **"Not available":** keeps the plain outline. Moving it to secondary text
  (audit principle "availability is never a status chip") would be a larger
  change and is not needed once Provisional carries the dagger.
- **Notice layout and colours:** unchanged (Step 49D.2 provisional visual
  approval). Only the icon glyph differs.

## 5. Experimental before/after comparisons

Current = the consolidation pilot; proposed = this experiment. The matrix is
EN and ES × 390×844 @100% and 320×693 @200%. Accessible text and tab order
were compared for each.

| Comparison | Change | Height impact | Notes |
|---|---|---|---|
| A1 GP hero, A4 Circuit related event | "Format unknown" filled → dashed | +0px @100%; EN +2px @200%; **ES +33px @200%**: "Formato desconocido" wraps to 2 lines inside the dashed chip (the 1.5px border tips it over the width) | Not clipped; legible (screen `A1-…-es-320x693-200`) |
| A2 GP sessions | "Status unknown" text → compact dashed chip | Status line 16.9 → 24px @100%; 33.8 → 39.2px @200% (frame +7 / +5px) | Reads as an exception, like Cancelled and Postponed |
| A3 Classification row | Finish "Status unknown" solid → dashed | 0px | Border contrast 1.88:1 → 6.1:1 against the ground |
| B1–B4 GP results, certainty vocabulary, Driver, Team | "Provisional" gains "†" | Chip 93 → 108px wide @100%, 161 → 183px @200%. Two chip rows re-wrap: GP ES 390 section head +32px; vocabulary EN 320 @200% +49px | Accessible text unchanged ("Provisional"); now distinct from "Not available" |
| C Notices (failure + partial; combined + partial, hypothetical; stale) | cloud-off → alert / help / clock | 0px in every case | Text identical; icons stay `aria-hidden` |

**Every comparison (32 frames, 12 notice pairs):**
- accessible text unchanged and tab order unchanged;
- no chip clipped;
- notice heights identical.

## 6. Accessibility and large-text findings

- **Meaning without colour:** every state keeps its word. The patterns are
  shape cues (dashed border, dagger glyph, icon), not hue.
- **Contrast:**
  - the dashed unknown border is 6.1:1 against the ground (rgba Chalk 0.6);
  - the solid outline chips (DNF, Provisional, Not available, Upcoming) use
    `hair-strong` at 1.88:1. That is below the 3:1 non-text guideline if the
    border were the identifier; it is not (the word is), so this is not a
    failure, but it is why the outline alone cannot separate Provisional from
    Not available.
- **Screen readers:**
  - the dagger is `aria-hidden`, so "Provisional" is heard once, without
    "dagger";
  - in Flutter the glyph would need excluding from semantics (for example
    `ExcludeSemantics`);
  - notice icons stay decorative.
- **Large text:**
  - nothing clips;
  - Spanish "Formato desconocido" takes 2 lines at 320 @200% in the dashed
    chip;
  - the wider Provisional chip re-wraps two chip rows (+32 / +49px);
  - "Estado desconocido" was already 2 lines in compact classification
    chips at 320 @200%, and still is.
- **Icon distinctness:** alert (!), help (?) and clock share a circular
  outline and differ by the inner glyph at 20px. That is distinct in the
  screenshots, but check legibility on a device at small sizes (XS-16). The
  text remains sufficient.
- **Localization:** no new copy. The dagger is language-neutral.
  Spanish labels are longer: check wrapping in Flutter's chip widget
  (currently pill-shaped with a dot).
- **Not validated:** Android rendering of dashed borders (Flutter has no
  built-in dashed border; it would need a custom painter or
  `DottedBorder`-style widget, a design-system decision), TalkBack (XS-02)
  and devices (XS-16).

## 7. Exact owner decisions required

1. **VS-1:** adopt **dashed outline = unknown provider value** as the shared
   convention. This includes "Format unknown" (A1), the session "Status
   unknown" as a compact chip (A2) and the finish "Status unknown" (A3). It
   widens audit decision V3 ("lifecycle unknown only") to every unknown
   provider value.
2. **VS-2:** provisional, choose one:
   - **(a) recommended:** "†" + "Provisional" outline chip everywhere (GP
     results, Driver, Team; Standings already); accept the footnote
     connotation (the word is always present, the glyph is hidden from
     assistive technology);
   - **(b):** keep the plain outline for Provisional and instead move "Not
     available" out of the chip vocabulary (secondary text). Larger change.
   This closes audit decision V2.
3. **VS-3:** keep the Standings exceptions: compact 24px row marker; caption
   for uniform tables (weight still STD-04).
4. **VS-4 (XS-22):** adopt cause icons from the existing set:
   - alert for failure and the combined failure + stale notice;
   - clock for stale;
   - help for incomplete;
   - retire cloud-off from notices.
5. **VS-5:** accept the Spanish 2-line "Formato desconocido" chip at 320
   @200% (no copy change).
6. **VS-6:** confirm that Calendar per-row repetition (V1) stays out of this
   change.
7. **VS-7:** evidence retention for `status-visual-consistency/` after review
   (currently untracked, not ignored).

Backlog items affected once decided: XS-11, XS-22, STD-04 (weight only),
XS-18 (delta), XS-28 (dashed border in Flutter tokens). No status has
changed.

## 8. Representative screenshot paths

In `cross-screen-refinement/status-visual-consistency/validation-20261111-233337-experiment/screens/`:
- **Unknown format:** `A1-gp-hero-unknown-current-es-320x693-200.png`,
  `A1-gp-hero-unknown-proposed-es-320x693-200.png`
- **Unknown session:** `A2-gp-session-unknown-current-en-320x693-200.png`,
  `A2-gp-session-unknown-proposed-en-320x693-200.png`
- **Unknown finish:** `A3-gp-finish-unknown-current-en-390x844-100.png`,
  `A3-gp-finish-unknown-proposed-en-390x844-100.png`
- **Certainty vocabulary:** `B2-gp-certainty-vocabulary-current-en-390x844-100.png`,
  `B2-gp-certainty-vocabulary-proposed-en-390x844-100.png` (Git-visible
  copies `B2-certainty-{current,proposed}-en-390.png`)
- **Standings reference:** `B0-standings-dagger-reference-en-390x844-100.png`
- **Stacked notices:** `C-combined-partial-current-es-320x693-200.png`,
  `C-combined-partial-proposed-es-320x693-200.png`
  (hypothetical combination: failure + stale + incomplete is not reachable on detail screens, because a partial profile has no detail freshness; `C-failed-partial-*` shows the reachable pair; Step 49F.1)
- **Stale notice:** `C-stale-current-en-390x844-100.png`,
  `C-stale-proposed-en-390x844-100.png`

The other 12 screenshots in the folder cover the same comparisons in the other
language or viewport (Circuit format, Driver provisional, failure + partial).

**Reproduce:** `python build.py` (with `--check` to verify), then
`node checks.mjs`, both in the experiment folder.

## 9. Owner review recorded (Step 49E.1, 2026-11-12)

The owner reviewed eight screenshots from the Step 49E experiment.

| Decision | Outcome |
|---|---|
| **VS-1** | **Approved** for the reviewed examples: dashed outline for the unknown weekend format ("Format unknown" / "Formato desconocido") and the unknown session status (compact dashed chip). The **unknown finish** treatment stays **pending** its screenshot review (§12) |
| **VS-2** | **Rejected:** no dagger is added to "Provisional" across the app. GP results, Driver and Team keep the outline chip with the word |
| **VS-3** | Standings keeps its compact row marker and its whole-table caption. **Removing its dagger** is evaluated (§10), with no other Standings change |
| **VS-4** | **Approved as the design direction:** distinct notice icons. The **alert icon for refresh failure is visually approved**. The incomplete-profile icon needs a final semantic check (§11). The stale icon (clock) is presented for review (§12) |
| **VS-5** | **Approved:** the two-line Spanish "Formato desconocido" at 320px and 200% text |
| **VS-6** | **Upheld:** Calendar's per-row unknown-status repetition does not change |

No backlog item is closed. The Flutter and device requirements stand:
- the dashed border needs Flutter support (XS-28);
- TalkBack (XS-02) and device checks (XS-16).

With VS-2 rejected, "Provisional" and "Not available" keep the same outline
in Grand Prix results (§1 B1). That remains a known overlap carried by the
words only. It is recorded, and the outline is not redesigned in this step.

## 10. Standings provisional marker without the dagger (VS-3)

**Comparison.** `st-states[.es].html` is derived from the Standings pilot's
`states` page. Only the `aria-hidden` "†" is removed from the compact row
marker in the mixed table (frame 8). Unchanged:
- the marker size, outline and word;
- the whole-table caption (frame 7);
- the row's accessible name.

Evidence: `validation-20261112-065316-49e1/` (`checks-49e1.mjs`, 5
screenshots, 0.5 MB).

| | 390×844 @100% (EN, ES) | 320×693 @200% (EN, ES) |
|---|---|---|
| Marker | "† Provisional" 99.6×24 → "Provisional" 85.4×24 px | 175.1×37.2 → 152.8×37.2 px |
| Height, frame height | unchanged | unchanged |
| Accessible text, row label, tab order | unchanged: "Position 1, Row A, 10 points, Championship leader, Provisional" | unchanged |
| Caption "These standings are provisional and may still change." | unchanged | unchanged |
| Clipping | none | none |

**Recommendation: remove the dagger.**
- The dagger points to no note.
- Screen readers never hear it.
- With VS-2 rejected, it is the only dagger left in the app. Removing it
  makes "Provisional" one word-led outline chip everywhere; Standings keeps
  only its compact size.
- Meaning is unchanged: the word carries it, and the compact marker still
  differs from the filled Final chip and the dashed unknown chip.
- **Documentation follow-up if approved:**
  - `chip.css`'s vocabulary comment ("provisional (dagger + word)");
  - `standings/README.md` ST15.

  Both are left unchanged here.

## 11. Incomplete-profile icon: semantic check

**Available icons.** The Primer V2 vocabulary has 30 symbols across every
approved page:
- back, alert, cloud-off, arrow, chevron, help, open, check;
- the four tab icons and settings, external, refresh;
- route, cw, ccw, clock, team, driver, circuit, timer, pause, flag,
  event-x, ban, shield, helmet, trophy.

**There is no information ("i") icon.** The closest candidates:

| Icon | Fit for "Some profile information is unavailable" |
|---|---|
| **help (?)** | Already used **non-interactively** for missing information: the detail "not found" empty state in the prototypes and in Flutter (`Icons.help_outline`, `entity_detail_scaffold.dart`). Distinct from the alert used for failure. Risk: "?" can suggest a help action; mitigated because the notice has no button or focus and the text is explicit |
| alert (!) | Already the approved failure icon; reusing it would make failure and incomplete look alike again |
| cloud-off | Implies connectivity; the cause is missing detail (XS-22) |
| clock, flag, shield and others | No semantic fit |

**Result:**
- No information icon exists, and none was added.
- Within the existing vocabulary, **help (?) is the only suitable choice**,
  and it already carries the "information not available" meaning in this
  app.
- No new screenshot was needed: the reviewed
  `C-combined-partial-proposed-*` (hypothetical combination, not reachable
  on detail screens) and `C-failed-partial-proposed-*` (reachable) already
  show it.
- **Owner option (not proposed here):** add one information icon to the
  vocabulary later (for example Lucide "info", matching the existing Lucide
  set; `Icons.info_outline` in Flutter). That would be a new asset and needs
  explicit approval.

## 12. Existing evidence for the remaining reviews (not regenerated)

In `validation-20261111-233337-experiment/screens/`:
- **Unknown finish (VS-1, pending):**
  `A3-gp-finish-unknown-current-en-390x844-100.png` (solid outline, same as
  DNF) vs `A3-gp-finish-unknown-proposed-en-390x844-100.png` (compact
  dashed). Measured: no height change; border contrast 1.88:1 → 6.1:1;
  accessible text and tab order unchanged.
- **Stale notice icon (VS-4):** `C-stale-current-en-390x844-100.png`
  (cloud-off) vs `C-stale-proposed-en-390x844-100.png` (clock). Text and
  height unchanged.
- **Standings dagger reference:**
  `B0-standings-dagger-reference-en-390x844-100.png` (current). It pairs
  with the new `D-standings-marker-proposed-en-390x844-100.png`.

## 13. Contrast and Android accessibility considerations (recorded separately)

**Solid-outline contrast**, not redesigned in this step:
- the outline chips (DNF, Provisional, Not available, Upcoming, the Standings
  marker on dark rows) use `hair-strong`: **1.88:1** against the ground;
- the Standings marker on the Chalk leader row uses a dark border at
  **2.2:1**;
- both are below the 3:1 non-text guideline (WCAG 1.4.11).

**Open accessibility concern** (corrected Step 49F.1): the text label does
not resolve it, and the outline alone cannot separate states. A future
chip-border review (XS-11 / XS-28) decides whether the solid outline needs at
least 3:1. The dashed
unknown border is 6.1:1.

**Android, unverified:**
- Flutter has no dashed border built in (custom painter or equivalent;
  XS-28);
- the chip shape changes from Flutter's pill-with-dot;
- system font scaling, especially the two-line Spanish format chip;
- notice icons at 20px on device (alert, help and clock share a circular
  outline);
- TalkBack: chip labels unchanged, icons decorative, the "Provisional" name
  unchanged (XS-02);
- the dagger, if kept anywhere, excluded from semantics.

## 14. Screenshots for final owner review

1. **Standings without the dagger:**
   - `validation-20261112-065316-49e1/screens/D-standings-marker-current-en-320x693-200.png`
     vs `D-standings-marker-proposed-en-320x693-200.png`;
   - the same pair in Spanish (`-es-320x693-200`);
   - `D-standings-marker-proposed-en-390x844-100.png`, with
     `B0-standings-dagger-reference-en-390x844-100.png` as its current.
2. **Unknown finish:** the A3 pair (§12).
3. **Stale icon:** the C-stale pair (§12).
4. **Incomplete-profile icon:** no new image; the already reviewed
   `C-combined-partial-proposed-es-320x693-200.png` shows "?" (§11;
   hypothetical combination, not reachable on detail screens).

## 15. Final owner decisions (Step 49E.2, 2026-11-12)

The owner reviewed the final screenshots from Step 49E.1.

| Decision | Outcome |
|---|---|
| **VS-1** | **Approved.** The existing dashed outline marks unknown values: unknown event status, unknown weekend format, unknown session status and unknown race-result finish. Each keeps its own existing wording |
| **VS-2** | **Rejected.** The dagger is not extended to Provisional indicators |
| **VS-3** | **Approved.** The Standings provisional marker drops the dagger in the future implementation. Compact form, outline, wording and the whole-table caption stay |
| **VS-4** | **Approved.** Existing icons: **alert** for refresh failure and the combined failure + stale notice; **clock** for stale data; **help (?)** for incomplete profile information, and for Home's "Some information is unavailable" (O-2, Step 49F.1). Icons are decorative; the text alone communicates each meaning |
| **VS-5** | **Approved.** Spanish "Formato desconocido" may wrap to two lines at 320px and 200% text |
| **VS-6** | **Unchanged.** Calendar's repeated unknown-status labels keep today's presentation. Audit V1 remains an **open design question**, not an approved decision (corrected Step 49F.1, O-3; XS-11, CAL-02, XS-13) |
| **VS-7** | **Approved.** Reviewed evidence kept with narrow, experiment-specific ignore rules (below) |

**Documentation corrected.**
- `DESIGN-DECISIONS.md`: VS-1 to VS-7 in the index; a "Status visual
  decisions" section; the "Rejected" line now names N-5 and VS-2.
- `DESIGN-SYSTEM-CONSOLIDATION.md`: the provisional-marker row no longer
  calls the dagger a shared pattern (and no longer lists Driver as a user);
  §5.7 cites the decisions.
- `DESIGN-BACKLOG.md`: XS-11 (treatment chosen; solid-outline contrast
  review), XS-22 (decided, now Open for implementation), XS-28 (dashed
  border), XS-02, XS-16, XS-18, STD-04.
- **Not edited (approved prototypes or shared components):**
  `shared/components/chip.css` ("provisional (dagger + word)"), `README.md`
  (Home status vocabulary), `standings/README.md` (ST15 and the component
  table). They describe the prototypes as reviewed; VS-2 and VS-3 supersede
  them. `STATUS-SEMANTICS-AUDIT.md` V2 ("dagger everywhere") is a historical
  proposal, answered by VS-2.

**Evidence retention (VS-7).** Rules in `design-exploration/.gitignore`
ignore each `screens/` folder's contents and re-include the reviewed files.
Sources, generators, scripts, CSS, HTML, `results.json` and `summary.txt`
stay Git-visible. Every screenshot stays on disk.
- `validation-20261111-233337-experiment/screens/` (13 of 25 visible, the rest local):
  - `A1-gp-hero-unknown-current-es-320x693-200.png`
  - `A1-gp-hero-unknown-proposed-es-320x693-200.png`
  - `A2-gp-session-unknown-current-en-320x693-200.png`
  - `A2-gp-session-unknown-proposed-en-320x693-200.png`
  - `A3-gp-finish-unknown-current-en-390x844-100.png`
  - `A3-gp-finish-unknown-proposed-en-390x844-100.png`
  - `B0-standings-dagger-reference-en-390x844-100.png`
  - `B2-certainty-current-en-390.png` (copy of `B2-gp-certainty-vocabulary-current-en-390x844-100.png`)
  - `B2-certainty-proposed-en-390.png` (copy of `B2-gp-certainty-vocabulary-proposed-en-390x844-100.png`)
  - `C-combined-partial-current-es-320x693-200.png`
  - `C-combined-partial-proposed-es-320x693-200.png`
    (hypothetical combination: failure + stale + incomplete is not reachable on detail screens, because a partial profile has no detail freshness; `C-failed-partial-*` shows the reachable pair; Step 49F.1)
  - `C-stale-current-en-390x844-100.png`
  - `C-stale-proposed-en-390x844-100.png`
- `validation-20261112-065316-49e1/screens/` (2 of 5 visible): `D-standings-marker-current-en-320x693-200.png` and `D-standings-marker-proposed-en-320x693-200.png`, the complete
  same-language Standings before/after pair from one run. The Spanish pair
  and `D-standings-marker-proposed-en-390x844-100.png` stay local.
- 15 visible screenshots, 1.37 MB; 30 on disk, 2.39 MB.

**Open requirements.** The visual approval closes none of these.
- **Flutter:** a dashed border (XS-28, XS-11); the chip shape changes from
  `GvStatusChip`'s pill-with-dot; notice icons excluded from semantics
  (XS-22); the Standings marker without the dagger; the delta register
  (XS-18).
- **Contrast:** solid outlines 1.88:1 (`hair-strong`) and the Standings
  marker on the Chalk leader row 2.2:1, below the 3:1 non-text guideline
  (WCAG 1.4.11). An **open accessibility concern**, not resolved by the text
  label; review tracked in XS-11. The dashed border measures 6.1:1.
- **Android:** TalkBack (XS-02); device rendering, legibility of the 20px
  icons, and system font scaling, including the two-line Spanish chip
  (XS-16).
- **Other accessibility and design-system items** stay as they are,
  including XS-11, XS-22 and XS-28.
- All measurements are Chrome emulation. They support no WCAG-compliance or
  production-readiness claim.
