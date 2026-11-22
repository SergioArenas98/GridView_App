# Primer V2: cross-theme visual specification (Steps 54B and 54C)

<!-- primer-v2-status-notice -->
> **Implemented (2026-11-22).** This document remains authoritative for
> design intent. It is implemented in Flutter (`lib/core/theme/`,
> `lib/core/widgets/gv_primer_*.dart`); accepted implementation
> exceptions are recorded in [GridView_Primer_V2_Theme_Foundation.md](../../../docs/technical/GridView_Primer_V2_Theme_Foundation.md),
> and the current overview is [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md).
> Validation folders cited as evidence (`validation-*/`) are not part of the
> published repository; see [Validation output](README.md#validation-output).

**Status: frozen for implementation, 2026-11-13 (Step 54C, DD XT-6).** It
consolidates the approved Primer V2 Dark (DK-1 to DK-6, closed DK-5) and
Light (LT-1 to LT-18, closed LT-18; coverage completed in Step 54A) into one
component and token specification with theme-specific values and documented
exceptions, including the owner's Step 54C decisions XT-1 to XT-6. No
aesthetic decision was reopened and neither theme was redesigned.

**Visual design approval, not validation.** This is not Flutter
implementation (XS-28 open), not Android accessibility certification and not
WCAG compliance. Every ratio is a Chrome measurement (software raster, DPR 2,
zero insets); the acceptance criteria in §7 are verified in Flutter and on
devices.

Companion: [`CROSS-THEME-TOKEN-MAP.md`](CROSS-THEME-TOKEN-MAP.md) (five token
layers, component-by-component Dark/Light resolution, surface scopes).
Evidence: `cross-screen-refinement/cross-theme-54b/` (`build.py`,
`checks-54b.mjs`, `explore-focus.css`, `seam-dark.css`, `seam-light.css`).

## 0. Implementation authority

For Flutter, in this order; a higher entry wins over every lower one:

1. **[`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md)**, the decision log. A later
   approved decision supersedes an earlier one and every prototype
   treatment (here: XT-1 to XT-6, LT-1 to LT-18, DK-1 to DK-6, VS-1 to VS-7,
   N-1 to N-7, HM-01, CR-04, RK-*).
2. **This specification and the token map** (XT-6): the shared component and
   token rules for both themes.
3. **The frozen theme role documents**, for each theme's values:
   [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md) and
   [`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md) (each carries a Step 54C
   cross-reference block). Where a freeze left an item to consolidation,
   this specification resolves it.
4. **The approved semantic refinements:**
   [`STATUS-ABSENCE-DECISIONS.md`](STATUS-ABSENCE-DECISIONS.md),
   [`STATUS-NOTICE-DECISIONS.md`](STATUS-NOTICE-DECISIONS.md),
   [`STATUS-VISUAL-DECISIONS.md`](STATUS-VISUAL-DECISIONS.md),
   [`STATUS-RANKING-DECISIONS.md`](STATUS-RANKING-DECISIONS.md),
   [`HEADER-AND-HEADING-DECISIONS.md`](HEADER-AND-HEADING-DECISIONS.md).
5. **Historical evidence, never an instruction by itself:** the approved
   screen prototypes (`calendar/`, `standings/`, `refinement-01/`,
   `grand-prix-detail/`…), the consolidation pilots
   (`consolidation-pilot/`), every experiment under `cross-screen-refinement/`
   and every validation folder. They show what was reviewed when it was
   reviewed. Where they differ from 1–4 (§5, and §6 of each freeze), Flutter
   follows 1–4. [`DESIGN-SYSTEM-CONSOLIDATION.md`](DESIGN-SYSTEM-CONSOLIDATION.md)
   (Step 38A) is a superseded proposal kept for its inventory.

[`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md) stays the list of open work; no item
is closed by this specification.

## 1. Summary

- **One widget hierarchy, two value sets.** Every shared component resolves
  roles from the active theme and from its **surface scope** (page, inverse
  plane, Light Graphite band). No Dark-only or Light-only widget exists; the
  theme-specific mechanisms (Light contextual focus backing, Light Graphite
  scopes) are scope and role rules.
- **No new colour.** 15 primitives: 11 existing Primer V2 values and the 4
  approved Light neutrals (`#EBECEE`, `#F7F7F8`, `#FFFFFF`, `#DCDDE1`), plus
  the contextual `#B04633` and the Dark lighting values inside effects.
- **Approved in Step 54C:** XT-1 Home Explore inward ring 4px; XT-2
  completed Calendar rows at 100% in both themes; XT-3 shared team-colour
  geometry; XT-4 back-button offsets per theme; XT-5 pressed semantics with
  theme values; XT-6 this freeze.

## 2. Token model (full tables in the token map)

| Layer | Content | Rule |
|---|---|---|
| 1. Raw colour values | 15 primitives | Only literals; never read by widgets |
| 2. Semantic roles | `surface.*`, `text.*`, `brand.*`, `live.*`, `final.*`, `mark.*`, `disc.*`, `button.*`, `snackbar.*` | One value per theme |
| 3. Contextual alpha and boundary roles | `line.subtle`, `line.strong`, `line.status`, `line.status-inverse`, `line.unknown` (dashed; same alpha solid = alert), `line.inverse`, `state.hover`, `state.pressed.row`, `state.pressed.control`, `focus.ring`, `edge.team` | Alphas of primitives on a stated surface |
| 4. Component roles | Chip, notice, selector, navigation, rows, Settings mark, discs, buttons, team shapes, skeleton | Map a component state to layers 2–3 |
| 5. Decorative effects | `effect.brand-gradient` (with `#B04633`), Dark lit panel and band lighting, sheen, scrims, shadows, watermark | Never carry information; never reused as roles |

Preserved without change: the Dark palette; the Light B neutrals; the Red
Oxide (selection, Light accent) versus Ember (Dark accent and focus; Light
only inside Graphite panels and for Live) split; Light Graphite panels in
their approved contexts only; the DK-6 gradients; surface-dependent focus
colours.

**Typography and geometry (shared, unchanged).** Archivo variable (wdth
62–125, wght 100–900) as used in the approved prototypes: width axis as
hierarchy (figures expanded, names condensed), 13px text floor, tabular
lining numerals, sentence case, "narrow before wrap, wrap before scale".
Gutter 16px; radii 8 / 14 / 20 and pill; targets ≥ 48×48; focus ring 2px;
status outlines 1.5px; the 12° livery cut height-derived everywhere (XS-27,
GPD-10). Bundling Archivo in Flutter is part of XS-28.

**How one component resolves.** `StatusChip(unknown)` is a 1.5px dashed
outline with its own word everywhere: Dark page Chalk 60% (6.02); Light page
Graphite 70% (6.38); inside the Light GP heading band (Graphite scope, Dark
roles) Chalk 60% (5.32–5.45).

## 3. Shared component specification

Each entry: shared geometry and behaviour · theme values · contextual
exceptions · selection and focus · accessibility · backlog. Values: token
map §4.

| Component | Shared geometry and behaviour | Theme-dependent values | Contextual exceptions | Selection and focus | Accessibility | Backlog |
|---|---|---|---|---|---|---|
| **Backgrounds and surfaces** | Page, full-bleed bands, inset hairlines, no cards as structure; one inverse plane per screen | page / band / raised; Light card (Home hero only) | Light Graphite scopes: Home championship band, leader row, Home hero strip, GP heading band (LT-3) | — | Surface separation is decorative (1.10–1.18) | XS-28, XS-09 |
| **App bars** | Primary (title + season) and detail (back + title); sticky; header budget | page | Back-button ring offset per theme (XT-4) | Ring per surface | Titles never truncate (rule open) | XS-07, XS-06, XS-08 |
| **Navigation** | Four tabs; regular → condensed → stacked 2×2; 60×32 flat oxide slab, 12° | bar `surface.nav`; selected label Chalk (Dark) / Graphite (Light, LT-9) | — | Slab + weight + label colour + `selected`; ring per surface | Targets ≥ 48; safe areas (§3.2) | XS-26, XS-31, XS-32, XS-08 |
| **Segmented control** | Band container, flat oxide 12° slab, `selected` semantics | slab vs container 2.47 (Dark) / 6.09 (Light) | Light unselected focus: 5px band backing (LT-4) | Selected: Chalk inset ring; unselected: Chalk (Dark) / Graphite + backing (Light) | Selection never colour alone | XS-26, XS-31 |
| **Race rows and cards** | Calendar row (round column, name, circuit, chip, chevron); next-event flat oxide block; whole-row link | text roles; next-event band (Dark lighting effect / Light flat band) | Next-event ring painted above the block: Chalk (Dark) / Graphite + backing (LT-15) | Ring −3px on rows | **Completed rows at 100% in both themes (XT-2)** | XS-11, CAL-01, XS-19 |
| **Standings rows and leader card** | Ranking rows; leader row = inverse plane; compact provisional marker with the word only (VS-3) + table caption | inverse plane Chalk (Dark) / Graphite (Light) | Leader accent oxide (Dark) / Ember (Light) | Leader ring outside the row, offset 2px: Ember (Dark) / Graphite (Light) | Marker word and name unchanged | XS-11, STD-04, STD-01 |
| **Driver, Team, Circuit details** | Shared detail scaffold (app bar, notice block, sections, fact rows, states); editorial headings per entity | headings band + sheen (Dark) / band, sheen cleared (Light, LT-13) | Driver plate DK-6 gradient; Circuit related disc Graphite in Light | Team link ring 2px inside (LT-17, both) | Names never truncated | DRV-01, TEAM-01, CIR-01 |
| **Status chips** | Solid known, dashed unknown (VS-1), solid alert, filled Final, filled Live, raised context, oxide Winner tag | `line.status` / `line.unknown`; `final.*`; `live.*` | In the Light GP band: Dark values (scope) | — | Solid ≥ 3:1; dashed stronger; pattern + word | XS-11, XS-28, LT-7 Live pending |
| **Notices** | Band fill, `line.strong` border, cause icon (VS-4), `role="status"`; N-1 order; N-2 combined wording; N-6 positioning | fill and border per theme; icon Ember (Dark) / oxide (Light) | — | Not focusable | Text carries meaning; icons decorative | XS-22, XS-02, XS-16, XS-19 |
| **Actions and links** | Text links (underlined where Dark underlines), inverse pill button ≥ 48, arrow discs, chevron rows | `text.accent`; `button.*`; `disc.*` | Light Home strip disc inverted | Ring per surface; pressed §3.1 | Targets ≥ 48 | XS-09 |
| **Loading and missing data** | §3.3 | skeleton band → raised per theme | Light placeholders stay light on GP and Circuit (LT-16) | — | Loading announced once; no added motion | DRV-01 9, TEAM-01 11, CIR-01 10 |
| **Keyboard focus** | 2px ring; colour from the surface it is drawn on; painted above decoration; never clipped by an ancestor | Ember / Graphite on the page family; Chalk on oxide; oxide inside the Dark Chalk plane; Ember inside Light Graphite | Light-only 5px backing (LT-4/5/15); offsets 3px, −3px rows, −2px GP team links (LT-17), **−4px Home Explore links (XT-1)**, back button 3px Dark / 1px Light (XT-4) | Selection = fill, focus = outline | 100% of the ring visible; ≥ 3:1 against adjacent pixels | XS-31, XS-32 |
| **Team-colour accents** | **XT-3:** tick 3px, seam 2px, banner bar 12px, pinstripe 3px, 12° cut, same size with or without a boundary | boundary = `text.primary` of the surface (Chalk / Graphite) | Boundaries flip between themes (no colour is below 3:1 on both) | — | Team colour never carries meaning or text | XS-25 |
| **Settings controls** | Option list with 12° mark, `checked`, no "Selected" suffix; root value marks; snackbar | mark Ember + Graphite check (Dark) / oxide + Chalk check (Light) | Provisional `GvColorsLight` preview superseded | Inset ring per surface; pressed `control` | Polite snackbar region | SETT-07, SETT-01 |
| **Decorative gradients** | Home hero round block, Driver plate, GP winner cell | identical in both themes | Shadows take each theme's alpha | GP winner ring above the cell (Chalk / Graphite + backing) | Not a state indicator | — |

### 3.1 Pressed state (XT-5)

**Shared semantics:** transient feedback on the whole target while it is
pressed; no change of geometry, focus ring, selection or semantics; not a
persistent state. Motion: only the existing 160ms background ease-out on
Settings rows and options; nothing under reduced motion. Hover only on
devices that hover (`(hover: hover)`), `state.hover`.

| Approved prototypes (inventory) | Dark | Light |
|---|---|---|
| Rows on the page: Calendar, Standings, Explore, Driver standing and championship links, Team destination and line-up, Circuit related GP, GP circuit row | `tray` | Graphite 6% where Batch 1/2 remapped (Calendar, Driver, Team, Circuit); Standings, Explore and the GP circuit row inherit the band (lighter than the page) |
| GP classification rows | Chalk 6% (drift) | Graphite 6% |
| Controls: icon buttons, Settings rows and options, GP team link | `raised` | `raised` (`#DCDDE1`) |

**Specification:** `state.pressed.row` = `tray` (Dark) / Graphite 6% (Light,
LIGHT-THEME-ROLES §3.11); `state.pressed.control` = `raised` (both).
**Pending implementation validation:** the Dark GP classification row (built
with Chalk 6%, not `tray`; XS-09) and every pressed appearance on a device;
no pressed state was captured in any owner screenshot.

### 3.2 Navigation and safe areas

- The bottom bar draws `surface.nav` to the screen edge; its content sits
  above the system navigation inset (prototype: `nav-inset.js` sets
  `--nav-space`; Flutter: the platform inset, never a constant).
- Scrolling content reserves the bar's height plus the inset, so the last
  row and any notice can scroll clear of the bar.
- A keyboard-focused element is scrolled clear of the pinned header and the
  bar (XS-32); the tab ring is fully visible with real insets (today 64–68%
  in emulation with zero insets, both themes).
- Pinned headers respect the header budget (XS-06) and the title rule
  (XS-07). Rotation and system text scaling never hide the focused element.

### 3.3 Loading and missing data

- **Loading:** static skeleton blocks per screen in each theme's band →
  raised gradient; `progressbar` "Loading" announced once; Light keeps light
  placeholders (LT-16).
- **Absent value:** the element vanishes (GP missing locality, country, time
  zone); no false zero and no invented points (GP results).
- **Unknown value:** dashed outline with its own word (VS-1).
- **Unavailable:** secondary text with the existing copy ("Not available").
- **Unresolved names:** the existing localized fallbacks; ids keep
  navigating.
- **Absence statements** only when supported: Circuit "No Grand Prix this
  season" only with a complete season calendar (CR-04); Home omits the
  empty upcoming section only in the HM-01 state.
- **Failure and staleness:** notices per N-1, N-2, VS-4; first-load failure
  and not-found use the shared empty/error states with retry where the
  source offers it.

## 4. Approved semantic and visual rules

1. **HM-01:** omit the secondary "Upcoming events" section only when the
   hero is "Next Grand Prix" (pre-event) **and** the upcoming list is
   available but empty.
2. **N-1, N-2:** one combined notice when refresh failure and stale data
   concern the same content: EN "Couldn't refresh. Saved data may be out of
   date." / ES "No se pudo actualizar. Los datos guardados pueden estar
   desactualizados." Conditions stay separate internally; an incomplete
   profile keeps its own notice. ARB requirement: §8.
3. **VS-1:** dashed outline = unknown event status, weekend format, session
   status, race-result finish, each with its own wording.
4. **VS-2 rejected, VS-3:** no dagger on any "Provisional" marker; Standings
   keeps its compact chip with the word and the whole-table caption.
5. **VS-4:** notice icons by cause: alert (failure; combined), clock (stale),
   help (incomplete information, including Home's "Some information is
   unavailable"). Decorative, non-interactive.
6. **LT-17:** GP team-link ring 2px inside the link, both themes.
7. **XT-1:** Home Explore links' ring 4px inside the link, both themes; not
   a global inset.
8. **Selection** (DK-2): flat oxide + weight + label colour + semantics.
   **Focus** (DK-3): ring by adjacent surface, above decoration, never
   clipped.
9. **Status distinctions:** solid known (≥ 3:1), dashed unknown (stronger),
   solid alert, filled Final, filled Live, raised context; words carry the
   state.
10. **XT-2:** completed Calendar rows at 100% in both themes.
11. **XT-3:** shared team-colour geometry and contextual boundary.
12. **XT-4, XT-5, CR-04, N-6, N-7, VS-5, LT-16, DK-6, LT-10** as recorded.

## 5. Superseded treatments (historical files unchanged)

Flutter must not copy these from older pages.

| Superseded treatment | Where it is still visible | Authoritative rule |
|---|---|---|
| "Upcoming events" section with its empty state under "Next Grand Prix" | `refinement-01/`, `consolidation-pilot/home/`, root `index.html`; `light-foundations/home-*`; `dark-state-boundaries/` | HM-01 |
| Dagger on "Provisional" | `standings/`, `consolidation-pilot/standings/`; `shared/components/chip.css` and READMEs ("dagger + word"); `status-visual-consistency/` (VS-2 pages), `light-foundations/`, `light-rollout-b2/st-states-*`, `dark-state-boundaries/` | VS-2 rejected, VS-3 |
| Non-dashed unknown statuses: session "Status unknown" as plain text, format unknown as the filled context chip, finish unknown as the solid outline | `grand-prix-detail/`, `circuit-detail/`, `consolidation-pilot/grand-prix-detail/states`, `consolidation-pilot/circuit-detail/states`; `light-rollout-b2/gp-states-*`, `cd-states-*` (incl. `b2-gp-states-08-es-320-200.png`); `dark-state-boundaries/` | VS-1 |
| Generic cloud-off icon on every notice | All prototypes and pilots; most experiments; Flutter `GvOfflineNotice` for the partial notice | VS-4 (XS-22) |
| Separate failure and stale notices for the same content | `calendar-stage1/` states; GP and detail galleries where both apply | N-2 |
| Earlier status outlines: Chalk 22% (1.88), Standings marker 35% | Approved prototypes, pilots, `shared/components/chip.css` | DK-1 `line.status` 45% / `line.status-inverse` 55%; Light 55% |
| Gradient selected controls and Calendar next-event block (`#B04633` → oxide → oxide-deep) | `shared/components/selector.css`, `calendar.css` | DK-2 flat oxide |
| Old focus geometry: Ember on oxide; ring under the next-event block and the GP rail cell; oxide ring outside the leader row; team-link ring outside; Explore links' ring outside the clipping strip | Approved prototypes and pilots; `light-rollout-b2/gp-results-light` before `light-b2.css` 4 | DK-3, LT-17, XT-1 |
| Dark Calendar completed-row dimming (0.72); the same inherited in the Light chain | `calendar/`, `calendar-stage1/`, `consolidation-pilot/calendar.css`; `light-rollout-b1/light-b1.css` chain | XT-2 (LT-14) |
| Theme-dependent team-seam widths: Dark 4px seam column, inner Chalk frame and Chalk pinstripe (TM-03); Light inner Graphite frame and Graphite pinstripe; Dark ticks without a boundary | `team-detail/`, `consolidation-pilot/team-detail/`, `explore/`; `light-rollout-b1/td-*`, `light-foundations/ex-cue-*` | XT-3 |
| Earlier provisional Light preview (`GvColorsLight`, "provisional light preview" notes) | `consolidation-pilot/settings/` and its Light renderings | LIGHT-THEME-ROLES §1 |
| "EXPERIMENT … not an approved palette" headers | `light-foundations/` CSS and pages | LT-1 to LT-6 approved |
| Original Calendar prototype | `calendar/` | Calendar Stage 1 (CT-03) |
| Flutter tokens (`#0B0D12`, `#FF3B30`, gutter 20, radius 12, no Archivo) | `lib/` (not touched) | This model, after XS-28 |

## 6. Cross-theme experiment findings (decided in Step 54C)

Sizes: EN 390×844 @100% and ES 320×693 @200%, both themes. The three
experiments are isolated evidence; their pages are not prototypes.

### 6.1 XT-1: Home Explore focus (XS-31)

**Cause.** The links' 2px ring was drawn 3px outside the link; the strip
(`.explore__strip`, radius 14px, 1px border) has `overflow: hidden`, so only
the segments between links survived. **Approved:** the same ring (colour,
width, 6px radius) 4px inside the link (`explore-focus.css`).

| Offset (`validation-20261113-221827-sweep`) | Ring visible | Weakest point | Ring to separator | Ring to icon and label |
|---|---|---|---|---|
| +3px (superseded) | 20–82% | top and bottom edges missing | — | — |
| −2px (the LT-17 value) | 99–100% | outer corners clipped by the strip radius | overlaps (−1px) | 12px |
| −3px | 99–100% | corners 1.48–2.47 | touches (0px) | 11px |
| **−4px (XT-1)** | **100% everywhere** | min 6.30 Dark / 16.42 Light | 1–2px clear | 10px |
| −5px, −6px | 100% | — | 2–4px | 9–8px |

At −4px (`validation-20261113-222328-focus`): p05 6.57 (Dark, Ember on band)
and 17.05 (Light, Graphite on band); accessibility tree, Tab order (14
stops), targets (118.66×84 at 390; 286×71.5 at 320 @200%) and layout
identical; the offset exists only while focused. Shared criterion: a focus
ring is never clipped by an ancestor; inside a clipping, rounded container
it is drawn inside the control, clear of the corner radius and separators.

### 6.2 XT-2: Calendar completed rows (XS-11, CAL-01)

Fixture: the LT-14 specimen (Calendar Stage 1 plus the round 12 Italian
Grand Prix completed row from the GP Detail results fixture), **experimental
evidence only**; no Calendar fixture or approved prototype changed. Only
difference between Dark 0.72 and Dark 100%: the completed link's `opacity`.

| Completed row, rendered | Dark 0.72 (superseded) | **Dark 100% (XT-2)** | Light 100% (LT-14) |
|---|---|---|---|
| Round number, circuit (secondary) | 4.68 | **7.95** | 6.61 |
| Name, chip label | 8.26 | **15.19** | 15.45 |
| "Completed" outline (solid) | 2.65 (below 3:1) | **3.96** | 3.85 |
| Focus ring on the row (min, perimeter) | 4.38, 100% (the opacity dimmed the ring) | **7.44**, 100% | 15.45, 100% |
| Other rows' "Status unknown" (dashed) | 6.02 | 6.02 | 6.38 |

Completion stays unambiguous through the solid outline, check icon and word
against the dashed unknown rounds; the next event keeps its flat oxide
block. The fixture has no Calendar "Upcoming" chip, so completed versus a
known upcoming round is distinguished through the chip vocabulary (solid
with check vs solid without), not a rendered pair.

### 6.3 XT-3: team-colour geometry (XS-25)

| Shape (colour, surface) | Superseded | **Shared (XT-3)** |
|---|---|---|
| Explore tick `#1E41FF`, Dark page (2.83) | 3px, no boundary | 3px + 1px Chalk outside, boundary 15.19 |
| Explore tick `#FF8000`, Light page (2.13) | 3px + 1px Graphite, 15.45 | unchanged |
| Line-up seam `#1E41FF`, Dark page (2.83) | 2px core + 1px Chalk each side **in a 4px column** (name moved 2px) | 2px + 1px Chalk outside **in the 2px column**, 14.93 |
| Line-up seam `#FF8000`, Light page (2.13) | 2px + 1px Graphite outside, 15.45 | unchanged |
| Banner bar `#1E41FF`, Dark (2.5 band, 2.83 page below) | 8px team inside a 2px Chalk frame | 12px team + 1px Chalk outline |
| Banner bar `#FF8000`, Light (2.35 band, 2.13 page below) | 8px team inside a 2px Graphite frame | 12px team + 1px Graphite outline |
| Pinstripe `#1E41FF`, Dark | 2px Chalk line, no team colour; rail 18px | 3px team + 1px Chalk outline (13.41); rail 19px |
| Pinstripe `#FF8000`, Light | 3px Graphite line, no team colour | 3px team + 1px Graphite outline (17.05) |
| `#1E41FF` in Light (5.46 / 6.03) | Dark's 4px column and 2px pinstripe, no boundary | 2px column, 3px pinstripe, no boundary |

(`validation-20261113-230502-seam`.) Explore: 0 structural differences (the
boundary is paint only). Team Detail: only the returns to the unedged sizes
(seam column 4px → 2px at 390, hidden at 320 @200% by the narrow-list rule;
pinstripe 2px → 3px). Dark shared versus Light shared: identical geometry.
Accessibility tree, Tab order and targets identical; no text below
threshold. Representative colours only (`#1E41FF`, `#FF8000`, `#0093CC` from
the existing fixtures); no team colour invented or altered.

## 7. Flutter and Android acceptance criteria

Verified in Flutter and on Android devices, not in Chrome; every item stays
open until then (XS-02, XS-05, XS-16). Each criterion follows an approved
decision.

1. **Tokens (XS-28):** widgets read only roles (layers 2–4) from one theme
   extension per theme; no literal colours in widgets; the 15 primitives,
   `#B04633` only inside `effect.brand-gradient`.
2. **Text:** ≥ 4.5:1 (≥ 3:1 large) against the actual surface in both themes,
   including inside scopes and on the DK-6 gradients (Chalk ≥ 4.63).
3. **Status boundaries (XS-11):** solid known outline ≥ 3:1; dashed unknown
   stronger and visibly dashed; completed Calendar rows at 100% opacity with
   their chip (XT-2); the Live chip validated in an app context (LT-7).
4. **Selection (XS-26):** slab + weight + label colour + `selected` /
   `checked` semantics; Dark slab 2.47 recorded as a limit, not a compliance
   claim; no "Selected" suffix.
5. **Focus (XS-31):** 2px ring in the colour for the surface it is drawn on,
   ≥ 3:1 against adjacent pixels, painted above decoration, 100% of its path
   visible and never clipped by an ancestor; offsets 3px, −3px rows, −2px GP
   team links (LT-17), −4px Home Explore links (XT-1), back button 3px Dark /
   1px Light (XT-4); Light backing band where the ring crosses a fill (LT-4,
   LT-5, LT-15).
6. **Focus not obscured (XS-32):** with real insets, 200% text, keyboard,
   D-pad and switch input, a focused element is scrolled clear of the pinned
   header and the bottom navigation; the Home cases in XS-32 pass.
7. **Team colours (XS-25):** runtime contrast test against the actual
   surface; 1px boundary in the surface's text colour outside the shape only
   below 3:1; shape sizes per XT-3 in both themes; colour never carries
   meaning or text; checked on every component that renders a team colour.
8. **Pressed (XT-5):** row and control roles per theme; geometry and focus
   unchanged; Dark GP classification rows decided with evidence.
9. **Targets:** ≥ 48×48, unchanged by theme, focus or pressed state.
10. **Titles (XS-07) and text scaling (XS-05):** 200% without clipping,
    truncation of names or horizontal scroll; Android non-linear scaling.
11. **TalkBack (XS-02):** names and reading order (XS-03, XS-04), live
    regions for notices and the snackbar, decorative icons and team shapes
    hidden.
12. **Motion:** nothing essential animated; reduced motion respected.

## 8. Owner decisions (Step 54C)

| # | Decision | Disposition |
|---|---|---|
| D1 | Home Explore inward ring | **Approved: XT-1** (4px inside, Home Explore links only) |
| D2 | Completed Calendar rows | **Approved: XT-2** (100% in both themes) |
| D3 | Team-colour geometry | **Approved: XT-3** (TM-03 geometry superseded, principle kept) |
| D4 | Back-button focus | **XT-4:** Light 1px (LT-11) and Dark 3px retained; same visibility principle, context-specific geometry; no shared inset without evidence |
| D5 | Pressed rows | **XT-5:** shared semantics, theme values (§3.1); Dark GP classification rows and device appearance pending implementation validation |
| D6 | Specification freeze | **XT-6:** this document and the token map frozen for implementation; consistent with both role freezes (cross-referenced) |
| D7 | Flutter migration | **Not started.** XS-28 open; mapping in §9, criteria in §7 |
| D8 | N-2 wording | **Kept as approved;** ARB implementation required (below) |

**D8, ARB requirement (no ARB edited).** The combined wording is not in the
ARB files. Existing references (`lib/l10n/app_en.arb`, `app_es.arb`):
`refreshFailedNotice` ("Couldn't refresh — showing saved data." / "No se
pudo actualizar — mostrando datos guardados.") and `offlineStaleNotice`
("This data may be out of date — showing the last saved version." / "Estos
datos pueden estar desactualizados — mostrando la última versión
guardada."), used by `calendar_screen.dart`, `grand_prix_detail_screen.dart`
and `standings_screen.dart`; detail screens use `detailUpdateFailed` /
`detailCachedNotice`, Home `homeUpdateFailed` / `homeSomeInformationOutdated`,
Explore `exploreUpdateFailed` / `exploreCachedNotice`. Implementation adds
the approved EN and ES strings exactly as recorded in N-2 (with a
description), shows them only when failure and staleness concern the same
content, and keeps the existing keys for the single conditions. No
alternative translation is proposed.

Still open and not decided here: LT-7 Live in context; XS-07 titles; XS-06
header budget; XS-03/XS-04 reading order; media policy (EXP-04, XS-15).

## 9. Flutter implementation mapping (no Flutter change in this step)

| Specification | Flutter mapping |
|---|---|
| Layers 1–4 | Private primitives; one `ThemeExtension` (e.g. `PrimerRoles`) with a Dark and a Light instance; Material `ColorScheme` derived from it only where Material widgets need it |
| Surface scopes | An inherited `PrimerSurfaceScope` (page, inverse, graphite band) that swaps roles for a subtree |
| Typography | Bundled Archivo variable font; text styles with `FontVariation('wdth', …)` |
| 12° cut | One height-derived `GvLiveryCut` clipper / painter (XS-27) |
| Status chip | One `StatusChip` with solid / dashed (custom painter, XS-28) / filled variants |
| Notice | One `Notice` with a cause icon (alert, clock, help) and the N-2 combined case |
| Focus | Ring painted in an overlay above decoration with per-surface colour, inset or outset offset and optional backing band (XS-31) |
| Team shapes | `TeamAccent` with the runtime contrast test and the 1px outside stroke (XT-3) |
| Selection | `Selector`, `BottomNav`, `OptionList` sharing the flat oxide slab / mark |
| Pressed | `state.pressed.row` / `state.pressed.control` through the theme extension (XT-5) |
| Rows and details | Row scaffold with an affordance slot; shared detail scaffold; skeleton primitives |

Goldens are regenerated deliberately per theme; TalkBack and device checks
follow the first implemented screens. Shared widgets stay data-agnostic.

## 10. Owner-reviewed screenshots (Step 54B, approved in Step 54C)

Folder `cross-screen-refinement/cross-theme-54b/`:

| File | Shows |
|---|---|
| `validation-20261113-222328-focus/screens/ef-first-en-390.png` | Explore "Drivers" focused: Dark today \| Dark −4px \| Light today \| Light −4px |
| `validation-20261113-222328-focus/screens/ef-middle-en-390.png` | Same, "Teams" |
| `validation-20261113-222328-focus/screens/ef-last-es-320-200.png` | Same, "Circuitos", ES 320 @200% (stacked) |
| `validation-20261113-222328-cal/screens/cal-completed-en-390.png` | Completed row: Dark 0.72 \| Dark 100% \| Light 100% |
| `validation-20261113-222328-cal/screens/cal-completed-es-320-200.png` | Same, ES 320 @200% |
| `validation-20261113-222328-cal/screens/cal-focus-completed-en-390.png` | Completed row focused, same three |
| `validation-20261113-230502-seam/screens/seam-td-10-en-390.png` | Team Detail frame 10 `#1E41FF`: Dark today \| Dark shared \| Light today \| Light shared |
| `validation-20261113-230502-seam/screens/seam-td-11-en-390.png` | Team Detail frame 11 `#FF8000`, same four |
| `validation-20261113-230502-seam/screens/seam-ex-ticks-en-390.png` | Explore driver ticks (`#1E41FF`, `#FF8000`), same four |

## 11. Reproduce

```
cd cross-screen-refinement/cross-theme-54b
python build.py --check
node checks-54b.mjs --sweep
node checks-54b.mjs --focus
node checks-54b.mjs --cal
node checks-54b.mjs --seam
```

Evidence retention and the checkpoint scope:
[`CHECKPOINT-PREPARATION-54C.md`](CHECKPOINT-PREPARATION-54C.md).
