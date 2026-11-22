# Primer V2 Light: readiness review (Steps 53E and 53F)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a step of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](README.md#validation-output).

**Status: final. Primer V2 Light is formally approved at the visual-design
level (LT-18, Step 53F, 2026-11-13)**, after the owner reviewed the six
Step 53E screenshots; no visual blocker remains. Roles are frozen in
[`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md). This is not Flutter
implementation approval, not Android or TalkBack validation and not proof of
WCAG compliance. Every ratio below is a Chrome measurement (software raster,
DPR 2, zero insets).

**Owner decisions, Step 53F:** LT-9 approved (navigation as is; native focus,
insets and scrolling under XS-31/XS-32); LT-16 approved (light placeholders
kept, the Graphite GP candidate rejected); LT-17 approved as a shared
Dark/Light rule and a Flutter requirement for both themes; LT-7 Live: Ember
kept as the preferred direction, Red Oxide rejected, contextual validation
pending. Sections 2 to 10 are the Step 53E assessment, kept as written; §11
to §13 are the Step 53F closure work.

**Step 54A (2026-11-13): the visual-coverage gap of §11 is closed.** The five
approved variants that existed only in Dark experiment pages (HM-01, N-2,
VS-1, VS-3, VS-4) are now rendered in the frozen Light roles and validated
against their approved Dark sources (§14). LT-18 is unchanged. This is not
Flutter, Android or TalkBack validation. Still open: LT-7 Live contextual
validation (§3) and every Flutter and Android requirement (§8). **The owner
reviewed the nine Step 54A screenshots (§17) and approved all five Light
variants; Step 54A is closed (2026-11-13).** Cross-theme consolidation
continues in [`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md)
(Step 54B).

Evidence for this step: `cross-screen-refinement/light-rollout-b2/`
(`build.py` variants `dark-tl`, `light-s16`, the `live-chip` specimen and
the coverage pages; `checks-b2.mjs --dtl`, `--lt16`, `--live`, `--pages`).

## 1. Approved visual direction and screen families

**Direction:** B Motorsport (LT-1), B neutrals (LT-2), Graphite editorial
panels only in reviewed contexts (LT-3), with LT-4 to LT-6 and LT-10 to
LT-15, LT-7 Final, LT-8 and LT-17 (Light) approved.

| Family | Light prototype | Owner status |
|---|---|---|
| Home | `light-foundations/` (light-53b) | Approved (53A.1, 53B) |
| Standings (index) | `light-foundations/` (light-53b) | Approved (53A.1, 53B) |
| Explore (cue) | `light-foundations/` (light-53b) | Approved (53A.1, 53B) |
| Calendar (Stage 1, with states) | `light-rollout-b1/` | Approved, Batch 1 closed |
| Driver Detail, Team Detail | `light-rollout-b1/` | Approved, Batch 1 closed |
| Circuit Detail (incl. CR-04), GP Detail (all states), Settings (root, preferences, information) | `light-rollout-b2/` | Approved, Batch 2 accepted (Step 53E) |
| Standings states, Explore states and media states | `light-rollout-b2/` (coverage completion, Step 53E) | Included in the LT-18 closure on structural evidence; no owner screenshot was taken (§6) |

## 2. LT-16: loading-state continuity

Compared: the detail skeleton (gallery frame 1) beside the loaded screen's top
at the same height; for GP also a Graphite placeholder candidate
(`lt16-skeleton.css`: the hero block in the band's own `#1F2125`/`#2A2D32`).

| | Light placeholder (current) | Graphite placeholder (candidate) |
|---|---|---|
| Hero block vs page | 1.15 (Dark's placeholder: 1.32) | 11.69 |
| Continuity on load, GP | light block → Graphite band (one large tonal change) | none for the band |
| Continuity on load, Circuit | none (light → light sheet) | n/a (not applied) |
| On not-found or first-load failure | stays light (those states are light) | Graphite block → light error state |
| Semantics | `role="progressbar"`, "Loading" | unchanged |

**Findings.** The candidate removes the band's tonal change on success, but it
makes an empty placeholder the loudest element on the screen (11.69:1, where
a skeleton should stay quiet as in Dark, 1.32) and moves the flash to the
error paths instead. The generic app bar ("Grand Prix") already shows the
content is not there yet. Circuit's light placeholder is already continuous.
**Recommendation: keep the existing light placeholder (LT-16) for both.** No
animation, content or structure was added; structure identical (4 of 4).

## 3. LT-7: Live status

**Source found, no rendered example.** No approved screen or fixture renders
Live. The state is defined: `EventStatus.inProgress` and `SessionStatus.live`
map to the ARB key `eventStateLive` ("Live" / "En directo",
`lib/features/shared/presentation/domain_status.dart`), a Flutter widget test
uses a live session (`test/screens/home_widget_test.dart`, "Live now"), and
`shared/components/chip.css` carries the accommodated `.chip--live` rule.
One isolated component specimen (`live-chip-*.html`, generated, labelled as a
specimen, no status put on a real round) shows the chip in the GP heading
band and on the page beside existing status chips.

| Live chip (rendered, EN 390 and ES 320 @200%) | Dark | Light (current role: Ember fill, Graphite text) | Light alternative (oxide fill, Chalk text) |
|---|---|---|---|
| Text on fill | 7.44 | 7.44 | 5.43 |
| Fill vs page | 7.44 | 2.08 | 5.52 |
| Fill vs Graphite band | 6.10–6.18 | 6.10–6.18 | 2.29–2.32 |

The word carries the state in every variant; the Ember fill is the only warm
filled status chip, so it stays distinct from the outlined and dashed chips
even where its fill is tonal on the light page. The oxide alternative fails
inside the Graphite band and would share the fill of the Winner tag and of
selection. **Recommendation: keep the Ember role for Live.** Because no
approved screen renders Live in context (Home "Live now", GP in progress),
**in-context visual validation stays pending**; this limitation does not block
the other screens.

## 4. LT-9: bottom navigation

Reviewed from the existing evidence (Batch 1 Calendar at four sizes; Step 53A
measurements), with no new HTML experiment.

| Bottom navigation (rendered) | Dark | Light |
|---|---|---|
| Selected slab vs bar | 2.92 | 6.09 |
| Selected icon, Chalk on oxide | 5.43 | 5.43 |
| Selected label | 15.82 | 17.05 (Graphite) |
| Unselected labels | 8.29 | 7.30 |
| Focus ring vs neighbours (p05) | 3.28–7.75 | 10.48–17.05 |
| Ring perimeter on screen | 64–68% (bottom edge below the viewport) | **same** |
| Targets, layout at 320 @200% (two rows) | — | identical to Dark |

**Findings.** Every visual role is at least as clear as in Dark; selection is
carried by the slab, the icon and the label weight, not colour alone. The
only shortfall is shared with Dark and is geometric: with zero system insets
the ring's bottom edge falls outside the viewport (64–68% of its path), and
at 320 @200% keyboard focus on content can sit behind the fixed bar (XS-32,
Home, Standings, Explore). Browser emulation cannot establish native
safe-area or focus-scrolling behaviour. **Classification: LT-9 is visually
ready; only native validation remains (XS-31, XS-32, XS-02, XS-05, XS-16).**
Recommend approving the visual rule.

## 5. LT-17 on Dark (isolated verification)

The same rule (`outline-offset: -2px` on `.cl__team:focus-visible`) on the
frozen Dark chain (`dark-tl`), GP results, four sizes. Dark prototypes and
pilots unchanged.

| Team links (3 per size) | Dark today | Dark with the inside ring |
|---|---|---|
| Ring perimeter ≥ 3:1 | 98% (winner row), 100% others | **100% every link, every size** |
| Lowest change on the ring path | 1.15–1.80 (winner) | 7.44 |
| Structure, accessibility tree, Tab order, targets | — | identical (4 of 4) |

- **Winner and ordinary rows (EN 390):** the outside ring touches or crosses
  the driver name above it ("Max Verstappen", "Lando Norris"); the inside
  ring clears it. At 320 @200% the Ferrari row's outside ring also runs into
  the "DNF" chip below; the inside ring clears both.
- **Multiline Spanish link (ES 320 @200%):** "Red Bull / Racing" wraps; the
  inside ring encloses both lines and clears the name and the points line.
- **One note:** in the Ferrari row at 320 @200% the inside ring's left edge
  sits about 4px from the grey label glyphs, so its focused-neighbour p05 is
  1.88 (Dark today 5.59, where the outside ring instead runs into the "DNF"
  chip and the driver name). The ring does not cross any text and stays 100%
  visible. Light, same row: p05 4.02.

**Recommendation: no regression; adopt LT-17 as a shared cross-theme focus
rule** (owner approval needed; Flutter under XS-31). LT-17 is now in the
Light role file (`light-b2.css` 4).

## 6. Final screen inventory

Audit of the approved Primer V2 families and states against the Light
prototypes. **Genuine gaps found: two, closed in this step by validation,
not redesign.**

- **Explore states and media states** (`consolidation-pilot/explore/`) had
  never been rendered in Light; **Standings states** had only the Step 53A
  render, before B Motorsport and the 53B corrections. They now run in the
  final Light chain (no new rule needed): 12 comparisons
  (`light-rollout-b2/validation-20261113-203116-cov/`, no screenshots):
  accessibility tree, Tab order (16, 28 and 20 stops) and targets
  identical; layout clean; every ring 100%; no text below threshold. The
  only structural difference is the Explore refresh line's `transform`, an
  infinite CSS animation (`explore.css` 72) caught at different phases in
  the two captures, not a Light change.
- **Approved but not in any pilot page** (corrected in Step 53F: they are
  rendered only in Dark experiment pages, never in Light; see §11): VS-1
  dashed outlines for GP format, session and finish unknown and VS-4 cause
  icons (`status-visual-consistency/`, whose pages also carry the rejected
  VS-2 dagger); VS-3 (Standings marker without the dagger; the pilot still
  shows it); the N-2 combined notice wording (`notice-coexistence/`); HM-01
  (Home without the empty "Upcoming events" section,
  `home-upcoming-omit/`). HOME-04, CAL-01 and STD-01 states are not rendered
  in either theme (backlog).
- **Not gaps:** the original `calendar/` prototype (superseded by Stage 1,
  CT-03); historical experiments.

**Outdated developer-only Light annotations** (documented for later cleanup;
changing them would shift layout or touch historical experiments):
- Settings pilot, shown in Light: the `data-show="light"` note ("Prototype
  only: provisional light preview… Not the Primer V2 light design, which is
  still pending."), the states hub link "Theme: Light selected (provisional
  light preview)" / "Tema: Claro seleccionado (vista clara provisional)" and
  gallery caption 5 ("Provisional light preview of the Theme screen…").
  Rewording moves every box below the hub links.
- `light-foundations/` CSS headers and page comments still say "EXPERIMENT /
  EXPLORATION (Step 53A), not an approved design / palette", although LT-1 to
  LT-6 are approved. Historical experiment files: not edited.
- Corrected in this step (comment only, no layout): `light-rollout-b2/lt-team-ring.css`
  no longer says "not adopted".

## 7. Outstanding decisions (Step 53E request; decided in Step 53F)

Decided: LT-9 approved; LT-16 approved (keep light); LT-17 approved as a
shared rule; LT-7 Live Ember kept, contextual validation pending. The table
is the Step 53E request, kept as the record.

| # | Item | Recommendation |
|---|---|---|
| LT-7 Live | Ember fill with Graphite text; in-context validation pending (no approved Live screen) | Keep Ember; keep in-context validation pending |
| LT-9 | Selected icon Chalk on the oxide slab, label Graphite | Approve visually; native validation under XS-31/XS-32 |
| LT-16 | Loading placeholder stays light | Keep light |
| LT-17 (Dark) | Inside team-link ring as a shared rule | Adopt (no regression) |
| Coverage pages | Standings states, Explore states and media states in Light | Review the summary (§6) |

## 8. Remaining accessibility and device requirements (all open)

XS-11 (status boundaries in Flutter), XS-25 (team-colour rule, including one
shared seam-edge geometry), XS-26 and XS-28 (selected state and tokens in
Flutter), XS-31 (focus-ring implementation per surface, LT-17 included),
XS-32 (keyboard focus behind the fixed navigation), XS-02, XS-05, XS-16
(TalkBack, font scaling, device rendering, insets, D-pad and switch input).
None of the measurements here is Android, TalkBack or WCAG evidence.

## 9. Visual blockers and recommendation (Step 53E; closure granted in Step 53F)

**No genuine visual blocker.** Recommendation: **Primer V2 Light is ready for
formal visual closure** once the owner decides LT-9, LT-16 and LT-17 (Dark)
and accepts the coverage pages, with LT-7 Live recorded as validated at the
component level only, pending an approved in-context example. Closure would
be visual-design closure, not Flutter, Android or accessibility readiness.

## 10. Screenshots for owner review

Folder `cross-screen-refinement/light-rollout-b2/`:

| File | Shows |
|---|---|
| `validation-20261113-203330-lt16/screens/lt16-gp-en-390.png` | GP: Light placeholder \| Graphite candidate \| loaded screen |
| `validation-20261113-203330-lt16/screens/lt16-cd-en-390.png` | Circuit: Light placeholder \| loaded screen |
| `validation-20261113-200522-live/screens/live-chip-en-390.png` | Live chip: Dark \| Light (Ember) \| oxide alternative |
| `validation-20261113-200522-live/screens/live-chip-es-320-200.png` | Same, "En directo", ES 320 @200% |
| `validation-20261113-200413-dtl/screens/dtl-winner-en-390.png` | Dark winner row team link: today \| inside ring |
| `validation-20261113-200413-dtl/screens/dtl-multiline-es-320-200.png` | Dark multiline Spanish team link: today \| inside ring |

LT-9 needs no new screenshot: `light-rollout-b1/validation-20261113-071945-b1/screens/b1-cal-stale-es-320-200.png`
(two-row bar at 200%) and `b1-cal-failed-en-390.png` (one row) already show it.

## 11. Screen coverage (Step 53F, from existing evidence only)

No page was regenerated for this check. Every approved screen family and its
approved state and information pages has a Light rendering in the final
chain, with structural, focus and contrast evidence:

| Family | Approved source pages | Light pages | Evidence (validation folder) |
|---|---|---|---|
| Home | `consolidation-pilot/home/index` | `light-foundations/home-light-53b` | `validation-20261112-232123-53b` |
| Calendar | `calendar-stage1/index` (CT-03) with refreshing, stale, failed | `light-rollout-b1/cal-light` (`?state=`) | `validation-20261113-071945-b1`; completed row: `-174306-lt14` |
| Standings | index; states | `light-foundations/st-index-light-53b`; `light-rollout-b2/st-states-light` | `-232123-53b`; `-203116-cov` |
| Explore | cue; states; media-states | `light-foundations/ex-cue-light-53b`; `light-rollout-b2/ex-states-light`, `ex-media-states-light` | `-232123-53b`; `-203116-cov` |
| Grand Prix Detail | index, results, states (26 frames), stress-title | `light-rollout-b2/gp-*-light` | `-180746-b2`; LT-17 `-194111-tl`, `-200413-dtl`; LT-16 `-203330-lt16` |
| Driver Detail | index, partial, states | `light-rollout-b1/dd-*-light` | `-071945-b1` |
| Team Detail | index, partial, returning, states | `light-rollout-b1/td-*-light` | `-071945-b1` |
| Circuit Detail | index, partial, no-event, states; CR-04 unknown-association, partial-unknown | `light-rollout-b2/cd-*-light` | `-180746-b2` |
| Settings | root, non-production, production without contact, Language, Theme (also with Light chosen), Time, states | `light-rollout-b2/set-*-light` | `-180746-b2` |
| Settings information | About (2), Data and updates (5), Privacy (4), Acknowledgements (2), states | `light-rollout-b2/info-*-light` | `-180746-b2` |

**Genuine coverage gaps (reported, not claimed complete).** Five approved
variants exist only in Dark experiment pages and have **no rendered Light
evidence**: HM-01 (Home without the empty "Upcoming events" section), N-2
(combined notice wording), VS-1 (dashed GP format, session and finish
unknown), VS-3 (Standings marker without the dagger) and VS-4 (notice cause
icons). Each uses only frozen Light roles that are validated elsewhere
(dashed `line.unknown` 6.38, the notice role, Red Oxide icons 6.09, the
Home page without a section), so none is a visual blocker. They should be
rendered once from their sources in both themes when implemented, or in a
later prototype step if the owner wants Light pixels first. The LT-7 Live
chip has component-level evidence only.

**Closed in Step 54A:** all five are now rendered in Light and validated
(§14). The paragraph above is kept as the Step 53F record.

## 12. Cross-theme consolidation (inputs, not implemented)

Shared rules and theme-specific exceptions are listed in
`LIGHT-THEME-ROLES.md` §5. In short: one surface, selection, status-outline,
notice and team-edge implementation with a value per theme; the focus rule
"ring contrasts with the surface it is drawn on" with per-surface colours per
theme; LT-17 shared; Light-only contextual backing and Graphite surface
scopes; Dark 0.72 vs Light 100% completed rows (XS-11); navigation insets and
focus scrolling as shared native requirements (XS-31, XS-32). No Flutter
migration or shared CSS change was started.

## 13. Evidence retention

Proposal (not applied): `cross-screen-refinement/LIGHT-EVIDENCE-RETENTION.md`
(audited and corrected in Step 54A, its §"Step 54A audit").

## 14. Step 54A: the five remaining Light variants

Experiment: `cross-screen-refinement/light-coverage-gaps/` (`build.py`,
`checks-gaps.mjs`; no stylesheet of its own). Each page is derived from the
approved Dark experiment page, which is only read, in two variants: `dark`
(frozen Dark overlays, DK-1 to DK-3) and `light` (the frozen Light chain
named in `LIGHT-THEME-ROLES.md`, including `lt14-a.css` and `light-b2.css`
with LT-17). No new token, colour, rule, copy, fixture, icon or status.

**Sources and the two corrections.** Both bring a source page to its later
approved state and add nothing new:

| Variant | Light page (`*-light[.es].html`) | Approved Dark source (only read) |
|---|---|---|
| HM-01 | `hm01` | `home-upcoming-omit/index` (Step 49B.1, approved 49B.2) |
| VS-1 | `gp-states` (frames 8 format and status, 9 session, 22 finish); `cd-states` (frame 13 format) | `status-visual-consistency/gp-states`, `cd-states` (Steps 49E–49E.2). **Correction:** the GP page also carried the VS-2 dagger on "Provisional" (2 aria-hidden spans), rejected by the owner; removed |
| VS-3 | `st-states` (frame 8) | `status-visual-consistency/st-states` (Step 49E.1, approved 49E.2) |
| VS-4 + N-2 | `notices-combined-partial` (alert + help), `notices-stale` (clock) | `status-visual-consistency/notices-proposed-*` (Steps 49E.1–49E.2; combined text = N-2 wording B) |
| N-2 on Calendar | `cal-n2` (`?state=failed,stale&copy=b`) | `notice-coexistence/calendar` (Step 49D.2, approved 49D.3). **Correction:** that page marks the combined notice with cloud-off, which VS-4 (Calendar included) replaced with alert; the existing alert symbol is copied verbatim from the Driver Detail sprite |

**Method.** `checks-gaps.mjs` (measurement code copied verbatim from
`checks-b2.mjs`) at EN 390×844 @100% and ES 320×693 @200% (`--all-sizes`
adds the other two). For each page and size: the **source page loaded in
place** (with the correction applied in the page) is the content, geometry
and semantics reference; Light is compared with it and with the Dark
variant (same markup). Every computed-style difference must be a colour
property. Chrome only (software raster, DPR 2, zero insets).

**Results** (`light-coverage-gaps/validation-20261113-213543-54a/`):

| Check | HM-01 | VS-1 GP | VS-1 Circuit | VS-3 | VS-4 + N-2 (detail) | VS-4 stale | N-2 Calendar |
|---|---|---|---|---|---|---|---|
| Structure vs approved source (text, boxes, element tree, layout quality) | identical | identical | identical | identical | identical | identical¹ | identical |
| Accessibility tree, Tab order, targets vs source and vs Dark | identical | identical | identical | identical | identical | identical | identical |
| Clipped, spilled or missing text; horizontal scroll | none² | none | none | none | none | none | none |
| Rendered text below 4.5:1 (3:1 large) | none | none | none | none | none | none | none |
| Focus visible at every stop | yes | yes | yes | yes | yes | yes | yes |

¹ Light vs Dark lists 7 non-colour entries on Driver Detail's `.ch`
(background-layer longhands such as `background-position: 0% 0%` →
`0% 0%, 0% 0%`). Cause: `light-b2.css` line 70, `.ch { background-image:
none, none; }`, written for the Circuit heading sheet, also matches Driver
Detail's championship block, which has no background image. One more
background layer with nothing in it: no visual effect. Injecting
`light-b2.css` into the approved Batch 1 `dd-index-light` page gives
**identical pixels** and accessibility tree (regression run). A selector
hygiene note for consolidation, not a Light issue; the file is not edited.

² *Corrected in Step 54B.* The layout-quality metric does flag one "spill"
on HM-01: the Home "Winner" / "Ganador" tag, identically in the source, Dark
and Light, and already in the approved Step 53B Home evidence. Its cause is
the tag's 12° skewed background (`.tag::before`, `skewX`), which widens the
element's scroll width by about 3px; the word itself is fully inside the tag
(visible in `hm01-bottom-es-320-200.png`). Nothing is clipped; the Step 54A
table originally said "none" without this note.

**Status distinction (rendered, border pixel against the pixel outside):**

| Status | Surface | Dark | Light |
|---|---|---|---|
| Dashed unknown: format, event status (GP heading band) | Graphite band, Dark roles scoped | 5.32–5.45 | 5.32–5.45 (identical, as approved) |
| Dashed unknown: session, finish, Circuit format, Calendar event | page | 6.02 | **6.38** |
| Dashed unknown: Home hero (white card) / sessions band | card / band | 5.58 / 5.73 | 6.88 / 6.63 |
| Solid known: Provisional, DNF, DNS, DSQ, DNQ, Lapped, Not available, Upcoming | page | 3.96 | 3.85 |
| Solid alert: Cancelled, Postponed | page | 6.04 | 6.31 |
| VS-3 marker "Provisional" (no dagger), leader row | Chalk row (Dark) / Graphite row (Light) | 3.74–3.75 | 3.92 |

Dashed stays stronger than solid in both themes, and the dash pattern, not
contrast alone, carries the distinction. The provisional marker keeps its
word, size and accessible name; only its leader-row surface flips, as frozen
(`line.status-inverse`, LIGHT-THEME-ROLES §2).

**Notices (VS-4, N-2).** Text, icon and role identical in source, Dark and
Light: alert "Couldn't refresh. Saved data may be out of date." / "No se
pudo actualizar. Los datos guardados pueden estar desactualizados." (detail
and Calendar), help on "Some profile information is unavailable", clock on
"Details may be outdated". Light notice role as frozen (LT-8): icon 6.09 on
the fill (Dark 6.57), fill 1.10 against the page, border 1.60 against the
page (decorative). The N-2 wording wraps to the same line count as in Dark
(EN 1 line at 390; ES 5 lines at 320 @200%).

**Regression of existing Light roles.** The frozen chain was injected into
each family's approved Light page (Home 53B, Driver index and partial,
Calendar failed, Standings, GP and Circuit states): identical pixels,
accessibility tree and computed styles everywhere except the Driver `.ch`
note above (`validation-20261113-220037-54a-regress/`).

**Coverage status.** All five previously uncovered variants are rendered and
validated in Light. **The visual-coverage gap recorded in §11 is closed.**
Precisely what remains outside it, unchanged by this step:
- **VS-4 elsewhere:** the notices in the GP, Circuit, Standings and Explore
  state galleries still use cloud-off **in both themes**, because those
  pilot pages predate VS-4 and no Dark page ever applied it there (the
  Standings dagger is the same kind of pilot lag). VS-4 itself is now
  rendered in Light for all three icons; applying it per screen is
  implementation work.
- **Home "Some information is unavailable" with the help icon** (VS-4, O-2)
  is rendered in neither theme.
- **LT-7 Live:** contextual validation still pending (§3).
- **HOME-04, CAL-01, STD-01 states:** not rendered in either theme (§6).

## 15. Issue found (pre-existing, both themes)

**Home Explore links: the focus ring is clipped.** The link ring is drawn
3px outside the link (computed `outline-offset: 3px`) and the strip has
`overflow: hidden` (`home.css`, `.explore__strip`), so only the segments
between links stay visible: 20% of the ring for "Drivers" and "Circuits",
40% for "Teams" at 390 @100%; 41% and 82% at 320 @200% (stacked). Measured
identically in Dark and Light, and already present (unflagged) in the Step
53B Home evidence (`validation-20261112-232123-53b`). Visible parts contrast
well (Light p05 12.69–17.05, Dark 4.78–6.57). Not caused by HM-01 or by
Light. Recommended for XS-31 (an inside ring, as LT-17 did for team links,
or no clipping); no change made. Screenshot in §17.

Also re-observed, unchanged: the navigation tab ring at 64–68% (XS-31,
XS-32) and Home stops hidden under the navigation at 320 @200% (XS-32), in
both themes.

## 16. Cross-theme consolidation questions (recorded, not answered)

1. **Calendar completed rows.** Light has the approved 100% opacity (LT-14).
   Dark keeps its approved 0.72, which drops the "Completed" chip outline to
   2.65:1 (CAL-01, XS-11). **Question:** adopt one shared full-opacity rule
   for both themes during consolidation, with completion carried by the
   chip's word, check icon and solid outline?
2. **Team-colour seams.** The contextual contrast-based edge rule (LT-6) is
   kept as approved. The geometry differs today: Dark widens the line-up
   column to 4px (`.lu--edge`); Light draws a 1px Graphite edge outside the
   2px seam (box-shadow); the McLaren banner pinstripe is 2px edged in Dark
   and 3px in Light. **Question:** define one shared border geometry for
   both themes before Flutter implementation (XS-25).

Neither is implemented; no Dark or Light file was changed for them.

**Answered in Step 54C (2026-11-13):** question 1 by XT-2 (completed rows at
100% in both themes), question 2 by XT-3 (shared team-colour geometry); the
§15 Explore focus issue by XT-1 (ring 4px inside the link). See
[`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md) (frozen, XT-6).

## 17. Screenshots for owner review (Step 54A)

Two-up, left Dark | right Light. Folder
`cross-screen-refinement/light-coverage-gaps/validation-20261113-213543-54a/screens/`:

| File | Shows |
|---|---|
| `hm01-bottom-es-320-200.png` | HM-01: Home end, ES 320 @200% (the view approved in 49B.2): result, then Explore, no upcoming section |
| `vs1-gp-08-format-es-320-200.png` | VS-1: event status and format unknown, dashed, in the GP Graphite band ("Formato desconocido" on two lines, VS-5) |
| `vs1-gp-09-session-en-390.png` | VS-1: session status unknown (dashed) beside Cancelled and Postponed (solid alert) |
| `vs1-gp-22-finish-en-390.png` | VS-1: finish unknown (dashed) beside Lapped, DNF, DNS, DSQ, DNQ (solid) |
| `vs3-st-08-es-320-200.png` | VS-3: Standings leader marker "Provisional" without the dagger |
| `n2-vs4-detail-es-320-200.png` | N-2 + VS-4: combined notice (alert) above the incomplete-profile notice (help) |
| `vs4-stale-en-390.png` | VS-4: stale notice (clock) |
| `n2-calendar-en-390.png` | N-2 on Calendar with the alert icon |

Issue §15: `light-coverage-gaps/validation-20261113-220312-54a-explore/screens/hm01-focus-explore-teams-en-390.png`
("Teams" focused: only the left and right ring segments are visible).
