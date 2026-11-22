# Primer V2: cross-theme token and component map (Steps 54B and 54C)

**Status: frozen for implementation, 2026-11-13 (Step 54C, DD XT-6). Not a
Flutter token file** (XS-28 open). Companion to [`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md),
which holds the findings, decisions and acceptance criteria. Every value
comes from the frozen role documents ([`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md),
DK-1 to DK-6; [`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md), LT-1 to LT-18)
or from an approved decision in [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md).
**No new colour and no new global token is introduced.** Role names are
the ones the freezes already use; where a freeze names a role only in one
theme, the other theme's value is the one that freeze records for the same
job. The Step 54C decisions XT-1 to XT-5 are included.

The model has five layers. A widget never reads layer 1: it asks for a role
(layers 2 to 4) and receives the value of the active theme **and of the
surface scope it sits in** (§6).

---

## 1. Raw colour values (primitives)

The only colour literals. Names are descriptive, for the token file; they
carry no role.

| Primitive | Value | Origin |
|---|---|---|
| `graphite-950` | `#101113` | Dark `ground-low` |
| `graphite-900` | `#141518` | Dark `ground`; Light `text` / inverse surface |
| `graphite-800` | `#1F2125` | Dark `tray`; Light `inverse-low` and GP heading band |
| `graphite-700` | `#2A2D32` | Dark `raised` |
| `slate-600` | `#4F525A` | Dark `on-chalk-2`; Light `text-2` |
| `slate-400` | `#A9ABB1` | Dark `text-2`; Light `on-inverse-2` |
| `chalk-100` | `#ECEAE5` | Dark `text` / inverse surface; Light `on-inverse` |
| `chalk-200` | `#E2DFD8` | Dark inverse gradient end |
| `neutral-l-page` | `#EBECEE` | Light page (LT-2) |
| `neutral-l-band` | `#F7F7F8` | Light band (LT-2) |
| `neutral-l-card` | `#FFFFFF` | Light Home hero card only (LT-2) |
| `neutral-l-raised` | `#DCDDE1` | Light raised (LT-2) |
| `oxide-600` | `#A03E2B` | Red Oxide |
| `oxide-700` | `#7A2E21` | Gradient end only (DK-6) |
| `ember-400` | `#F08A6C` | Ember |

**Contextual value, not a primitive token:** `#B04633`, the start stop of the
three retained decorative gradients (DK-6, LT-10). It lives inside
`effect.brand-gradient` (§5) and nowhere else.

**Out of scope, superseded:** Flutter's `GvColors` / `GvColorsLight` values
(`#0B0D12`, `#FF3B30`, `#F1F4F9`, `#C62719`…) and the Settings provisional
preview. They are replaced by this model (XS-28, XS-18).

## 2. Semantic colour roles (theme-dependent)

| Role | Dark | Light | Notes |
|---|---|---|---|
| `surface.page` | graphite-900 | neutral-l-page | Page |
| `surface.band` | graphite-800 (`tray`) | neutral-l-band | Bands, notices, selector container, rail |
| `surface.raised` | graphite-700 | neutral-l-raised | Context chip, skeleton, Dark pressed |
| `surface.card` | — (Dark has no card; the Home hero is a lit panel, §5) | neutral-l-card | Home hero card only |
| `surface.nav` | graphite-950 at 96% | neutral-l-band at 96% | Bottom navigation (alpha in §3) |
| `surface.inverse` | chalk-100 → chalk-200 gradient | graphite-800 → graphite-900 gradient (170°) | The one contrasting plane: Home championship band, Standings leader row (§6) |
| `text.primary` | chalk-100 | graphite-900 | Also the **default focus ring on the page family** and the **team edge** colour |
| `text.secondary` | slate-400 | slate-600 | |
| `text.accent` | ember-400 | oxide-600 | Kickers, "Next", relative starts, text links, notice icons, direction icon, hand-over spans, Explore progress |
| `brand.surface` | oxide-600 (flat) | oxide-600 (flat) | Selected slabs, Calendar next-event block, Winner tag, seams (DK-2) |
| `brand.on` | chalk-100 | chalk-100 | Label and focus ring on oxide (5.43 both) |
| `live.fill` / `live.on` | ember-400 / graphite-900 | ember-400 / graphite-900 | Live chip (LT-7 contextual validation pending) |
| `final.fill` / `final.on` | chalk-100 / graphite-900 | graphite-900 / chalk-100 | Final chip = inverse chip (LT-7 Final) |
| `mark.selected` / `mark.on` | ember-400 / graphite-900 | oxide-600 / chalk-100 | Settings option mark and its check |
| `disc.fill` / `disc.on` | chalk-100 / graphite-900 | graphite-900 / chalk-100 | Arrow discs (Calendar, Driver team link, GP circuit link, Circuit related GP). Light Home strip disc: inverse of the strip |
| `button.primary` / `button.on` / hover | chalk-100 / graphite-900 / chalk-200 (Driver, Team, Circuit only; drift XS-09) | graphite-900 / chalk-100 / graphite-800 | Inverse pill button, ≥ 48px |
| `snackbar.fill` / `snackbar.on` | chalk-100 / graphite-900 | graphite-900 / chalk-100 | Oxide seam both |

## 3. Contextual alpha and boundary roles

| Role | Dark | Light | Rule |
|---|---|---|---|
| `line.subtle` | chalk-100 12% | graphite-900 14% | Decorative separators |
| `line.strong` | chalk-100 22% | graphite-900 26% | Notice border (decorative, LT-8), seams, underline, dev frames |
| `line.status` | chalk-100 45%, solid 1.5px | graphite-900 55%, solid 1.5px | Known secondary status, ≥ 3:1 (rendered 3.71–3.96 / 3.85) |
| `line.status-inverse` | graphite-900 55% (on Chalk) | chalk-100 45% (on Graphite) | Same chip inside `surface.inverse` |
| `line.unknown` | chalk-100 60%, **dashed** | graphite-900 70%, **dashed** | Unknown value (VS-1); stronger than solid (6.02 / 6.38). Same alpha **solid** = alert ("Cancelled", "Postponed") |
| `line.inverse` | graphite-900 14% | chalk-100 12% | Separators inside `surface.inverse` |
| `state.hover` | chalk-100 3% | graphite-900 3% | Row hover |
| `state.pressed.row` | `surface.band` (`tray`) | graphite-900 6% | Pressed rows on the page (XT-5). Dark GP classification rows are built with chalk-100 6% (drift XS-09): pending implementation validation |
| `state.pressed.control` | `surface.raised` | `surface.raised` | Pressed icon buttons, Settings rows and options, GP team link (XT-5) |
| `focus.ring` | per surface (§4.11) | per surface (§4.11) | 2px |
| `edge.team` | `text.primary` of the surface | `text.primary` of the surface | 1px outside the shape, no layout, only below 3:1 against the actual surface (XT-3) |

## 4. Component roles (one component, resolved per theme)

### 4.1 Surfaces and app bars

| Component | Shared geometry and behaviour | Dark | Light |
|---|---|---|---|
| Page, bands | Full-bleed bands, inset hairlines, no cards as structure | page / band | page / band |
| Primary app bar | Title + season; title fit rule (XS-07 open); header budget (XS-06) | page | page |
| Detail app bar | Back button + title; ring offset per LT-11 | page; back ring offset 3px | page; back ring offset **1px** (LT-11) |
| GP heading band | Identity band, facts strip | `surface.band` + sheen | **Graphite scope** (Dark roles applied to the band, §6) |
| Driver plate, Team banner, Circuit sheet | Editorial headings (per entity) | band + sheen | band, sheen cleared (LT-13) |
| Calendar next-event band | Band with flat oxide block | band gradient (`effect.band-lighting`) | band (LT-15 backing on focus) |

### 4.2 Navigation

| | Dark | Light |
|---|---|---|
| Bar | `surface.nav`, nav shadow | `surface.nav`, Light nav shadow |
| Selected | Flat oxide slab (60×32, 12°) behind the icon; Chalk icon; Chalk 800 label | Same slab; Chalk icon; **Graphite 800 label** (LT-9) |
| Unselected | `text.secondary` 600 | `text.secondary` 600 |
| Focus | Ember ring | Graphite ring |
| Shared | Regular → condensed → stacked 2×2 at large text; targets ≥ 48; insets and focus scrolling native (XS-31, XS-32) | |

### 4.3 Segmented control (selector)

Shared: band container, 12° flat oxide slab, Chalk 800 selected label,
`text.secondary` 600 unselected, `selected` semantics. Selected focus: Chalk
inset −3px (both). Unselected focus: **Dark** Chalk ring (DK-3, crosses the
slab tip at 13.41); **Light** Graphite ring + 5px band backing (LT-4).
Slab vs container 2.47 Dark (recorded limit, XS-26) / 6.09 Light.

### 4.4 Rows and race cards

| | Shared | Dark | Light |
|---|---|---|---|
| Calendar row | Round column, name, circuit, status chip, chevron | text roles | text roles |
| Completed row | Chip "Completed" + check + `line.status`; **100% opacity, no dimming (XT-2)** | 100% | 100% |
| Next-event row | Flat oxide block, Chalk numeral; ring painted above the block | Chalk ring | Graphite ring + 5px band backing (LT-15) |
| GP classification | Winner row with DK-6 cell; separate team link | Winner ring Chalk | Winner ring Graphite + 5px page backing (LT-5) |
| Team link | Ring **−2px inside** the link (LT-17, both) | Ember | Graphite |
| Hover / pressed | `state.hover` (hovering devices only) / `state.pressed.row` | | |

### 4.5 Standings rows and leader card

Shared: ranking row anatomy; leader row = `surface.inverse` (one per
screen); provisional marker = compact `line.status-inverse` chip **with the
word only** (VS-3), whole-table caption kept. Leader ring outside the row:
Dark Ember offset 2px (on graphite), Light Graphite offset 2px (on the page).
Leader accent: oxide on Chalk (Dark), Ember on Graphite (Light).

### 4.6 Driver, Team and Circuit details

Shared detail scaffold (app bar, notice block, sections, fact rows,
empty/error states). Editorial headings per entity (§4.1). Decorative Driver
plate gradient (DK-6). Team rail and line-up seam: §4.13. Circuit related GP
disc: `disc.*`. Skeleton: §4.10.

### 4.7 Status chips

| Meaning | Shared shape | Dark | Light |
|---|---|---|---|
| Known secondary (Upcoming, Completed + check, DNF, DNS, DSQ, DNQ, Lapped, Provisional, Not available) | 1.5px solid outline, word | `line.status` | `line.status` |
| Unknown value (event status, format, session, finish) | 1.5px **dashed** outline, own wording (VS-1) | `line.unknown` | `line.unknown`; inside the GP Graphite band: Dark value (scope) |
| Alert (Cancelled, Postponed) | solid, icon + word | `line.unknown` alpha, solid | same |
| Final | filled inverse, check | `final.*` | `final.*`; in the GP band: Chalk fill (scope) |
| Live | filled, word | `live.*` | `live.*` (in-context validation pending) |
| Context ("Sprint weekend") | raised fill | `surface.raised` | `surface.raised` |
| Winner tag | flat oxide, 12° | `brand.*` | `brand.*` |

Words, sizes and accessible names are identical in both themes; "Formato
desconocido" may wrap to two lines (VS-5).

### 4.8 Notices

Shared: band fill, `line.strong` border, cause icon in `text.accent`,
`role="status"`, text carries the meaning. Icons (VS-4): **alert** = refresh
failure and the combined failure + stale notice (N-2 wording), **clock** =
stale, **help** = incomplete information. Rendered: icon 6.57 Dark / 6.09
Light on the fill; border 2.13 / 1.60 (decorative).

### 4.9 Actions and links

Text links `text.accent`, underlined where Dark underlines (underline colour
`line.strong`). Primary button and arrow discs: inverse roles (§2). Snackbar:
`snackbar.*` with oxide seam.

### 4.10 Loading placeholders

Static skeleton `linear-gradient(90deg, band, raised, band)` in each theme's
values (LT-16 keeps Light placeholders light, also on GP). Semantics
`progressbar` "Loading"; no added animation; reduced motion respected.

### 4.11 Keyboard focus (per adjacent surface)

Rule (DK-3, carried into Light): **the ring takes the colour that contrasts
with the surface it is drawn on, is painted above decoration, and is never
clipped by an ancestor.** Width 2px.

| Drawn on | Dark | Light |
|---|---|---|
| Page family (page, band, raised, card, nav) | Ember | Graphite (`text.primary`) |
| Flat oxide (selected slab, next-event block, winner cell) | Chalk | Chalk |
| Inside `surface.inverse` | Oxide (Home championship links, DK-4) | Ember (Graphite band) |
| Around the leader row (outside, offset 2px) | Ember | Graphite |
| Crossing a fill of another colour | Chalk ring passes both (DK-3) | 5px backing band of the host surface (LT-4, LT-5, LT-15) |

Offsets: 3px outside (default), −3px on rows, **−2px team links (LT-17)**,
back button 3px Dark / 1px Light (XT-4), **−4px Home Explore links (XT-1)**, never clipped by an
ancestor.

### 4.12 Settings controls

Option list: 12° mark, `mark.selected` + `mark.on` check, weight 800,
`checked` semantics, no "Selected" suffix; unselected mark outline
`text.secondary` (Light) / outline (Dark). Root value marks: small
`mark.selected`. Snackbar §4.9. Environment strip unchanged.

### 4.13 Team-colour accents and boundaries (XT-3)

| Shape | Size (both themes, every state) | Edge when team vs adjacent surface < 3:1 |
|---|---|---|
| Explore / Standings tick | 3px, 12° | 1px `edge.team` outside |
| Team line-up seam | 2px column, 12° | 1px `edge.team` outside; column never widens |
| Team banner bar | 12px, 12° lead | 1px `edge.team` outline around the bar |
| Team banner pinstripe | 3px, 46% width, 12° lead | 1px `edge.team` outline; keeps the team colour |

The supplied colour is never changed, replaced or used for text. The test
runs at runtime against the surface the shape sits on (XS-25).

### 4.14 Decorative gradients and effects

See §5. Never state indicators; unchanged in both themes.

## 5. Decorative effects

| Effect | Dark | Light |
|---|---|---|
| `effect.brand-gradient` (DK-6, LT-10) | `linear-gradient(165deg, #B04633 0%, oxide-600 45%, oxide-700 100%)` (Home hero round block); oxide at 55% (Driver plate, GP winner cell) | identical |
| Home hero | Lit panel (`#2A2C31`, `#202226`, `#1A1B1F`) | White card + Graphite action strip (B Motorsport) |
| Band lighting | tray → `#1B1D20` (Calendar current row, Home) | band (flat) |
| Sheen | white 4.5% on detail heroes and the GP band | GP band only (scoped); cleared on light headings |
| Scrims | tray 20–90% over media | band to band 86%/20% (Driver), 90%/55% (Team) |
| Shadows | black 16–90% | graphite alphas (card, inverse plane, nav, round blocks, snackbar) |
| Watermark | Chalk 11% stroke | Graphite 10% stroke |

`#2A2C31`, `#202226`, `#1A1B1F`, `#1B1D20` are Dark lighting values inside
effects, like `#B04633`: never roles.

Typography (Archivo, width axis, 13px floor, tabular figures), the 12° cut
(height-derived, XS-27), radii 8/14/20 and spacing are shared and unchanged.

## 6. Surface scopes (how one widget renders both themes)

A surface scope replaces the semantic roles for a subtree; widgets are
unchanged.

| Scope | Dark | Light |
|---|---|---|
| `page` (default) | Dark roles | Light roles |
| `inverse` (Home championship band, Standings leader row) | Chalk plane: `text.primary` = graphite-900, `text.accent` = oxide (on Chalk), focus = oxide, `line.status` = `line.status-inverse` | Graphite plane: Dark roles (Chalk text, Ember accent and focus, Chalk 45% status) |
| `graphite-band` (Light GP heading band, Home hero strip) | — (already Dark) | Dark roles for the subtree, band `#1F2125` |

**Resolution example** (`StatusChip(kind: unknown)` in three places):

| Placement | Border | Text |
|---|---|---|
| Dark page | dashed chalk-100 60% (6.02) | chalk-100 |
| Light page | dashed graphite-900 70% (6.38) | graphite-900 |
| Light GP band (graphite-band scope) | dashed chalk-100 60% (5.32–5.45) | chalk-100 |

The same widget, the same geometry and the same accessible name in each.
