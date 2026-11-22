# Primer V2 Dark: visual role freeze (Step 51D)

<!-- primer-v2-status-notice -->
> **Implemented (2026-11-22).** This document remains authoritative for
> design intent. It is implemented in Flutter (`lib/core/theme/`,
> `lib/core/widgets/gv_primer_*.dart`); accepted implementation
> exceptions are recorded in [GridView_Primer_V2_Theme_Foundation.md](../../../docs/technical/GridView_Primer_V2_Theme_Foundation.md),
> and the current overview is [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md).
> Validation folders cited as evidence (`validation-*/`) are not part of the
> published repository; see [Validation output](README.md#validation-output).

**Status: frozen, 2026-11-12 (Step 51E, formal Primer V2 Dark visual
closure).** It records the approved dark roles (decision log DK-1 to DK-6).
**DK-5 (approved):** Primer V2 Dark is the visual design reference for
Flutter implementation, the Primer V2 Light design and cross-theme token
consolidation.

**Design approval is not validation.** This is visual design approval, not
Android accessibility certification and not production readiness. The
Flutter, Android, TalkBack, contrast, scrolling and responsive requirements
stay open (§4).

It covers the visual prototypes only. It is not a Flutter
token implementation (XS-28 stays Pending decision), not a light-theme design
(XS-01), and not proof of Android or WCAG compliance.
[`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) stays authoritative and
[`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md) tracks the open work. No prototype,
consolidation pilot or shared CSS was changed to write it. The prototypes
keep the values they were approved with, and §6 lists where they differ
from this freeze.

**What it supersedes.** It supersedes the dark colour proposal in
[`DESIGN-SYSTEM-CONSOLIDATION.md`](DESIGN-SYSTEM-CONSOLIDATION.md) §2.1–2.2,
where the two differ (focus, selected fill, status outlines). Evidence
sources:
- [`DARK-THEME-READINESS.md`](DARK-THEME-READINESS.md);
- the experiment
  [`cross-screen-refinement/dark-state-boundaries/REPORT.md`](cross-screen-refinement/dark-state-boundaries/REPORT.md)
  (Steps 51C, 51C.1 and 51D).

> **Cross-theme update (Step 54C, 2026-11-13; cross-reference only).** This
> freeze stays authoritative for the Dark values; no Dark colour changes. The
> frozen cross-theme specification
> ([`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md),
> [`CROSS-THEME-TOKEN-MAP.md`](CROSS-THEME-TOKEN-MAP.md), DD XT-6) adds shared
> rules that apply to Dark and take precedence where this document is
> silent or older:
> - **XT-1:** the three Home Explore links draw the Ember ring 4px inside the
>   link (fully visible in the clipping strip).
> - **XT-2:** completed Calendar rows at 100% opacity; the inherited 0.72 is
>   superseded (completed outline 2.65 → 3.96).
> - **XT-3:** shared team-colour geometry (tick 3px, seam 2px, banner 12px,
>   pinstripe 3px; 1px Chalk boundary outside the shape only below 3:1);
>   TM-03's widened seam column, inner Chalk frame and Chalk pinstripe are
>   superseded.
> - **XT-4:** the back-button ring keeps its 3px offset in Dark.
> - **XT-5:** pressed rows use `tray` and pressed controls `raised` (§2's
>   single `state.pressed` row summarised the controls); GP classification
>   rows' Chalk 6% stays pending implementation validation.
> - **LT-17:** team-link ring 2px inside the link, shared with Light.

**Ratios.** "Computed" values are WCAG relative-luminance ratios from the CSS
colours, with alpha composited on the stated surface. "Rendered" values were
measured in Chrome (software raster, DPR 2) against the adjacent pixels.
Chrome emulation is not Android or TalkBack validation.

**Three layers, kept separate:**
1. **Colour tokens.** These are the only colour values. They are the existing
   `shared/tokens.css` values, and no new colour was introduced.
2. **Contextual alphas.** A token at a fixed opacity in one context. They are
   not new colours. They are named so Flutter and the light theme map them
   once.
3. **Component roles.** Which token or alpha a component uses, in which
   state.

Component dimensions, offsets, shapes (including the 12° cut) and typography
are unchanged by this freeze.

---

## 1. Colour tokens (dark)

| Token | Value | Frozen dark roles |
|---|---|---|
| `--ground` | `#141518` | Page surface |
| `--ground-low` | `#101113` | Sunken surface: the bottom navigation (at 96%) |
| `--tray` | `#1F2125` | Bands, notices, selector container |
| `--raised` | `#2A2D32` | Pressed state, skeleton |
| `--chalk` (= `--text`) | `#ECEAE5` | Primary text on graphite. Inverse surface (Home championship band, Standings leader row). Selected label. **Focus ring on oxide** |
| `--chalk-low` | `#E2DFD8` | End of the inverse-surface gradient |
| `--text-2` | `#A9ABB1` | Secondary text; unselected selector label |
| `--oxide` | `#A03E2B` | **Brand surface, flat:** selected slabs (selector, navigation), Calendar next-event block, Winner tag, seams. **Text and focus ring on Chalk** |
| `--oxide-deep` | `#7A2E21` | End stop of the retained decorative brand gradient (`effect.brand-gradient`, DK-6, §2). It is also used by the prototypes' selected slabs and Calendar block, which DK-2 replaces with flat oxide (§6). No flat role of its own |
| `--ember` | `#F08A6C` | Accent text and icons on graphite. Live chip fill. Settings option mark. **Focus ring on graphite** |
| `--on-chalk` | `#141518` | Text on Chalk and on Ember (Live chip, 7.44:1) |
| `--on-chalk-2` | `#4F525A` | Secondary text on Chalk (6.50:1) |

**Not a token, and not retired: `#B04633`.** It is an existing contextual
decorative value: the start stop of the brand gradient.
- **It stays** in the three retained decorative gradients: the Home hero
  round block, the Driver identity plate and the GP winner position cell
  (DK-6, `effect.brand-gradient`, §2).
- The approved prototypes still draw the selector slab and the Calendar
  next-event block with it. For those components, DK-2 sets flat `--oxide`
  in implementation (§6).
- It must not become a shared token or be reused outside these
  compositions.

*(Corrected in Step 51E. Step 51D had called it retired.)*

**Out of scope:** the Settings light preview values in `settings.css`
(`:root[data-theme="light"]`, `.is-light-provisional`). They map Flutter's
`GvColorsLight` and stay a labelled stand-in (SP-01, XS-01).

## 2. Contextual alphas and effects (not colour tokens)

| Proposed role | Composition | Use | Ratio |
|---|---|---|---|
| `line.subtle` (`--hair`) | Chalk 12% | Separators, selector container border | Decorative (1.36 on tray) |
| `line.strong` (`--hair-strong`) | Chalk 22% | Notice border, decorative seams and ticks, link underline colour, dev-only frames | Decorative (1.88 on ground). **No longer the solid status outline** |
| **`line.status`** (A1) | Chalk 45%, solid, 1.5px | Solid status chip outline on graphite (Scheduled/Upcoming, Done, DNF, Provisional, Not available) | Computed 3.96 ground · 3.81 tray; rendered 3.71–3.96 |
| **`line.status-inverse`** (A1) | `on-chalk` 55%, solid | The same chip on Chalk (Standings provisional marker in the leader row) | Computed 3.84 Chalk · 3.72 chalk-low; rendered 3.74 |
| `line.unknown` | Chalk 60%, **dashed** | Unknown-value outline (VS-1), unchanged and still the stronger treatment | Computed 6.1 ground · 5.72 tray |
| `line.inverse` (`--hair-chalk`) | `on-chalk` 14% | Separators on Chalk | Decorative |
| `surface.nav` | `ground-low` 96% | Bottom navigation | — |
| `state.hover` | Chalk 3% overlay | Row hover | Transient |
| `state.pressed` | `raised`; GP `.cl__hit:active` uses Chalk 6% (drift, XS-09) | Pressed rows | Transient |
| **`effect.brand-gradient`** (editorial decoration, DK-6) | `linear-gradient(165deg, #B04633 0%, var(--oxide) 45%, var(--oxide-deep) 100%)` for the Home hero round block (`.hero__round::before`); the same with oxide at 55% for the Driver identity plate (`.dp__plate::before`) and the GP winner position cell (`.cl--winner .cl__pos`). Identical in the approved prototypes and the pilots | Retained exactly as approved. Not a state indicator. Flat oxide (DK-2) is **not** extended to it. No new gradient may be created and these may not be modified | Chalk text on it ≥ 4.63 (on the `#B04633` stop); the GP winner focus ring (Chalk) min 4.63 |
| `effect.*` (decorative lighting) | Home hero lit panel (`#2A2C31`, `#202226`, `#1A1B1F`); tray-to-`#1B1D20` band gradient (Calendar current row, Home); white 4.5% sheen on detail heroes; tray scrims 20–90% over media; black shadows 16–90%; Chalk 11% watermark stroke | Depth and lighting | Never carries information, so no ratio is required. Flutter equivalents are decided with XS-28 |

## 3. Component roles

### 3.1 Surfaces and text

- Text on graphite: Chalk primary (15.19 on ground), `text-2` secondary
  (7.95 ground, 7.02 tray).
- Text on Chalk: `on-chalk` / `on-chalk-2`. Oxide for links and the leader
  position (5.43).
- One inverse (Chalk) plane per screen: the Home championship band and the
  Standings leader row.

### 3.2 Selection (A2, DK-2)

| Component | Selected | Unselected |
|---|---|---|
| Selector (Standings, Explore) | **Flat `--oxide` slab** in the existing diagonal (12°) shape, Chalk 800 label, `aria-pressed="true"` | Tray, `text-2` 600 label |
| Bottom navigation | Flat oxide skewed slab behind the icon, Chalk 800 label (unchanged) | `text-2` 600 |
| Settings option lists | Ember mark, check and weight (unchanged) | Empty mark |

**Measured limit, recorded and not resolved.** The flat slab is **2.47:1**
against the selector background (tray), below the 3:1 non-text guideline.
On tray, no fill can reach 3:1 and also keep a Chalk label at ≥ 4.5:1.
The selected state is carried by:
- the filled slab and its luminance step;
- the label weight, 600 → 800;
- the label colour, `text-2` → Chalk;
- the selected semantics.

In a grayscale check it still reads as selected. **This combination is the
recorded design rationale. It is not a WCAG compliance claim.** XS-26
tracks implementation and accessibility verification.

**Rejected:** the selected-label underline (it may be read as a link).
**Not adopted:** an extra 12° selection tick (it reads as a stray "/").

The Calendar next-event block is a key-fact board, not a selection. It uses
the same flat oxide (it is one of the components approved in DK-2).

**Scope of flat oxide:** selected controls and the components named in DK-2
only. It is not extended to unrelated editorial decoration. The three
decorative gradients keep their approved appearance (DK-6, §2).

### 3.3 Status outlines (A1 and VS-1, DK-1)

| Meaning | Treatment |
|---|---|
| Known secondary status (Scheduled/Upcoming, Done, DNF, Provisional, Not available) | Solid `line.status` (graphite) or `line.status-inverse` (Chalk) |
| Unknown value (status, format, session, finish) | Dashed `line.unknown`, stronger than solid |
| Live | Ember fill, `on-chalk` text |

Chip sizes, words and accessible names are unchanged. The solid outline is
now ≥ 3:1. The dashed unknown outline stays the more prominent treatment.

### 3.4 Ember accents

Ember is the accent role **on graphite only**: kickers, "Next session",
relative starts, text links, notice icons, the Circuit direction icon,
Explore's progress line, Team hand-over spans, the Live chip fill, the
Settings option mark and the focus ring on graphite. Ember is never text on
Chalk (2.04).

### 3.5 Focus (A3, DK-3 and DK-4)

**Rule: the ring takes the colour that contrasts with the surface it is drawn
on, not the colour of the component it belongs to.** A ring that can cross
two surfaces takes the colour that passes on both. The ring is always
painted above decorative fills (blocks, rail cells, seams), so its whole
intended perimeter stays visible. Width 2px; offsets unchanged.

| Context | Ring | Drawn on | Measured (rendered unless stated) |
|---|---|---|---|
| **Focus on graphite** (default: rows, links, Home hero container, navigation tabs, Settings options) | Ember, offset 3px outside, or −3px inset on rows | ground, tray, raised, navigation | Computed 7.44 / 6.57 / 5.63 / 7.70. GP ordinary rows 5.52, drawn 1.00 |
| **Focus on oxide: selector** (selected **and** unselected options) | Chalk, inset −3px | Flat oxide (selected); tray (unselected, which can cross the selected slab's tip) | 5.43 on oxide, 13.41 on tray; 100% of the boundary ≥ 3:1 |
| **Focus on oxide: Calendar next-event row** | Chalk, painted above the block | Oxide block and tray | 5.43; drawn 0.85 → 1.00 |
| **Focus on oxide: GP winner row** | Chalk, painted above the rail cell | Retained decorative gradient cell (DK-6) and tray | Minimum 4.63 (on the `#B04633` end), 100% ≥ 3:1; drawn 0.82 → 1.00 |
| **Focus inside a Chalk surface** (Home championship links) | Oxide, offset 3px (the existing approved Home treatment) | Chalk band | Band 4.90–5.43; minimum 3.82 where it crosses the `line.inverse` divider; drawn 1.00. **Technically verified in Chrome emulation** (Step 51D, DK-4) |
| **Focus around a Chalk card** (Standings leader row; ring outside the row) | **Ember**, offset 2px | Graphite outside the row | 7.44 (was oxide at 2.80) |

**Selected and focused combinations:**

| State | Selector | Bottom navigation | Settings option |
|---|---|---|---|
| Unselected, focused | Chalk outline on tray; no fill; `text-2` 600 label | Ember ring around the tab | Ember inset ring |
| Selected, unfocused | Flat oxide slab; Chalk 800 label | Oxide slab behind the icon; Chalk 800 label | Ember mark and check |
| Selected, focused | Slab plus inset Chalk ring | Slab plus Ember ring outside the tab. The slab (60×32) never meets the ring. **Geometry only, not pixel-measured** | Mark plus Ember inset ring |

Focus is an outline and selection is a fill, so shape keeps them distinct.

## 4. Not settled by this freeze (stays open)

| Item | Status |
|---|---|
| XS-11 | Status-boundary and contrast validation in Flutter; Calendar repeated unknown labels (audit V1) |
| XS-26 | Selected-state implementation and accessibility verification, including the 2.47:1 slab |
| XS-28 | Flutter shared tokens and the dashed border. Decided together with light |
| XS-31 | Focus-ring implementation (per-surface colour, ring above decoration) and Android validation |
| XS-32 | Keyboard focus hidden behind the fixed bottom navigation. **Keyboard focus visibility is not complete** until real scrolling and system insets are verified in Flutter |
| XS-02, XS-05, XS-16 | TalkBack, Android font scaling, device rendering, insets, D-pad and switch input |

## 5. Inputs for the light theme

- Light remaps **roles**, not hues: every row in §1–§3 needs a light value.
- The focus rule already carries over: the ring contrasts with the surface
  it is drawn on. When the inverse plane flips to graphite in light, its
  ring flips with it.
- Ember fails on light, so accent text and focus on the light ground need
  their own value (the consolidation proposal suggests oxide, 5.43).
- `line.status` and `line.unknown` keep their intent: solid ≥ 3:1, dashed
  stronger.
- A flat brand surface is one value to map. Chalk on oxide is 5.43 in both
  themes.
- The three retained decorative gradients (DK-6) need their own light
  treatment, decided in the light design. They are not derived from a
  shared token.

## 6. Prototype values that differ from the freeze

The approved prototypes, pilots and shared CSS are **unchanged**. Flutter
implements the frozen role, not the prototype value.

| Where | Prototype today | Frozen role | Tracking |
|---|---|---|---|
| Selector slab (`shared/components/selector.css`) | Gradient `#B04633` → oxide → oxide-deep | Flat oxide | XS-26 |
| Calendar next-event block (`calendar.css`) | Same gradient | Flat oxide | XS-26 |
| Solid status outline (`chip.css` and screen CSS) | `hair-strong` 22% (1.88) | `line.status` 45% | XS-11 |
| Standings provisional marker on Chalk | `on-chalk` 35% (2.2) | `line.status-inverse` 55% | XS-11 |
| Selector focus | Ember | Chalk on every option | XS-31 |
| Calendar next-event ring | Ember, hidden under the block at the top left | Chalk, painted above the block | XS-31 |
| GP classification rows | Ring's left edge under the rail cell | Ring above the rail; Chalk on the winner row | XS-31 |
| Standings leader-row ring | Oxide outside the row (2.80) | Ember | XS-31 |

### 6.1 Retained as approved (DK-6)

The Home hero round block, the Driver identity plate and the GP winner
position cell keep their existing decorative gradient (`effect.brand-gradient`,
§2). Flutter reproduces them as they are. They are not differences from the
freeze.
