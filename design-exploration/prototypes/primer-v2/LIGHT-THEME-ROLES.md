# Primer V2 Light: visual role freeze (Step 53F)

**Status: frozen, 2026-11-13 (Step 53F, formal Primer V2 Light visual
closure, LT-18).** It records the approved Light roles (decision log LT-1 to
LT-17). Primer V2 Light, in the approved **B Motorsport** direction, is the
Light visual design reference for Flutter implementation and cross-theme
token consolidation, alongside the frozen Dark reference
([`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md), DK-5).

**Design approval is not validation.** This is visual design approval, not
Android accessibility certification, not proof of WCAG compliance and not
production readiness. The Flutter, Android, TalkBack, contrast, scrolling and
responsive requirements stay open (§4).

It covers the visual prototypes only. It is not a Flutter token
implementation (XS-28 stays open). [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md)
stays authoritative and [`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md) tracks the
open work. No prototype, pilot, shared CSS or earlier experiment was changed
to write it. The prototypes keep the values they were approved with; §6 lists
where they differ from this freeze.

**Sources.** The Light chain, loaded after the frozen Dark overlays
(`dark-state-boundaries/candidate.css`, `refine-focus.css`):
`light-foundations/light-roles.css` (role map), `light-b.css` (values),
`light-bm.css` (B Motorsport placements), `light-53b.css` (focus and team
edge), `light-rollout-b1/light-b1.css` (Batch 1 roles), `light-rollout-b2/light-b2.css`
(Batch 2 roles, LT-17), plus `light-rollout-b1/lt14-a.css` (LT-14).
Evidence and history: [`LIGHT-THEME-FOUNDATIONS.md`](LIGHT-THEME-FOUNDATIONS.md),
[`LIGHT-ROLLOUT-BATCH-1.md`](LIGHT-ROLLOUT-BATCH-1.md),
[`LIGHT-ROLLOUT-BATCH-2.md`](LIGHT-ROLLOUT-BATCH-2.md),
[`LIGHT-READINESS.md`](LIGHT-READINESS.md).

> **Cross-theme update (Step 54C, 2026-11-13; cross-reference only).** This
> freeze stays authoritative for the Light values; no Light colour changes.
> The frozen cross-theme specification
> ([`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md),
> [`CROSS-THEME-TOKEN-MAP.md`](CROSS-THEME-TOKEN-MAP.md), DD XT-6) resolves
> the items this document left to consolidation:
> - **XT-1:** the three Home Explore links draw the Graphite ring 4px inside
>   the link (fully visible in the clipping strip).
> - **XT-2:** completed Calendar rows at 100% opacity in both themes (§3.4,
>   §5 and the §6 Calendar row: aligned).
> - **XT-3:** shared team-colour geometry (tick 3px, seam 2px, banner 12px,
>   pinstripe 3px; 1px Graphite boundary outside the shape only below 3:1).
>   It supersedes §3.8's inner 2px Graphite frame and Graphite pinstripe for
>   `#FF8000`, the §3.8 "Open" seam geometry and the §6 seam and McLaren
>   pinstripe rows.
> - **XT-4:** the back-button ring keeps its 1px offset in Light (LT-11).
> - **XT-5:** pressed rows Graphite 6% (§3.11), pressed controls `raised`.

**Ratios.** "Computed" values are WCAG relative-luminance ratios from the CSS
colours, alpha composited on the stated surface. "Rendered" values were
measured in Chrome (software raster, DPR 2) against the adjacent pixels.
Chrome emulation is not Android or TalkBack validation.

**Three layers, kept separate (as in the Dark freeze):**
1. **Colour tokens** (§1): the only colour values. Four are new B neutrals
   (LT-2); every other value is an existing Primer V2 colour.
2. **Contextual alphas and effects** (§2): a token at a fixed opacity in one
   context. Not new colours.
3. **Component roles** (§3): which token or alpha a component uses, in which
   state.

Dimensions, offsets (except the two focus offsets in LT-11 and LT-17),
shapes including the 12° cut, typography (Archivo), copy, layout and
semantics are unchanged from Dark.

---

## 1. Colour tokens (light)

Light remaps **roles**, not hues. The prototype names the Light values
`--lt-*` and maps them onto the shared role names (`--ground`, `--text`…).

| Light role (prototype) | Value | Origin | Frozen Light roles |
|---|---|---|---|
| `page` (`--lt-page` → `--ground`) | `#EBECEE` | **New B neutral** (LT-2) | Page surface |
| `band` (`--lt-band` → `--tray`) | `#F7F7F8` | **New B neutral** | Bands (sessions, Calendar next-event, detail headings), notices, selector container, rail, navigation bar base |
| `card` (`--lt-card`) | `#FFFFFF` | White (LT-2) | **Only** the elevated Home Grand Prix hero card |
| `raised` (`--lt-raised` → `--raised`) | `#DCDDE1` | **New B neutral** | Context chip fill, skeleton, pressed tone |
| `text` (`--lt-text` → `--text`) | `#141518` | Existing (Dark `ground` / `on-chalk`) | Primary text, Graphite. **Default focus ring.** Inverse surface (`--lt-inverse`) |
| `inverse-low` (`--lt-inverse-low`) | `#1F2125` | Existing (Dark `tray`) | Start of the inverse gradient; primary button hover; Graphite heading band fill |
| `text-2` (`--lt-text-2` → `--text-2`) | `#4F525A` | Existing (Dark `on-chalk-2`) | Secondary text; unselected labels; unselected Settings mark outline |
| `accent` (`--lt-accent` → `--ember`, `--oxide`) | `#A03E2B` | Existing (Red Oxide) | **Red Oxide** in both of its Light roles: selected fills (flat, DK-2) and accent text and icons on light surfaces (kickers, links, notice icons, "Next") |
| `on-inverse` / Chalk (`--chalk`, `--lt-on-inverse`) | `#ECEAE5` | Existing | Text on Graphite panels; **label on Red Oxide**; focus ring on oxide; check on the Settings mark |
| `on-inverse-2` (`--lt-on-inverse-2`) | `#A9ABB1` | Existing (Dark `text-2`) | Secondary text inside Graphite panels |
| `inverse-accent` / Ember (`--lt-inverse-accent`, `--lt-live`) | `#F08A6C` | Existing | Accent and focus **inside Graphite panels only**; Live chip fill |
| `oxide-deep` | `#7A2E21` | Existing | End stop of the retained decorative gradient only (DK-6) |

**Not a token: `#B04633`.** As in the Dark freeze: the start stop of the
three retained decorative gradients only (§3.13). Never a shared token.

**Superseded in Light:** the Settings provisional preview values
(`GvColorsLight`: `#F1F4F9`, `#C62719`…). In the Light prototype, choosing
Light resolves to these B Motorsport roles (`light-b2.css` 2a).

## 2. Contextual alphas and effects (not colour tokens)

| Proposed role | Composition | Use | Ratio |
|---|---|---|---|
| `line.subtle` (`--lt-hair`) | Graphite 14% | Separators, hairlines, rules | Decorative (computed 1.33 page) |
| `line.strong` (`--lt-hair-strong`) | Graphite 26% | **Notice border (LT-8)**, decorative seams, link underline, dev-only frames | Decorative: computed 1.75 page / 1.77 band; rendered notice border 1.60 page, 1.77 fill |
| **`line.status`** (`--lt-line-status`) | Graphite 55%, solid, 1.5px | Solid status outline on light (Upcoming, Completed, DNF, Lapped, Provisional, Not available) | Computed 3.86 page · 3.97 band; rendered 3.85 |
| **`line.status-inverse`** (`--lt-inverse-line-status`) | Chalk 45%, solid | The same outline inside a Graphite panel (Standings leader marker; GP heading band chips) | Computed 3.83 on `#1F2125`; rendered 3.67–3.71 in the GP band |
| `line.unknown` (`--lt-line-unknown`) | Graphite 70%, **dashed** | Unknown-value outline (VS-1); also the solid alert outline ("Cancelled") | Computed 6.26 page · 6.56 band; rendered 6.38 / 6.63; alert 6.31. Inside the GP band: Chalk 60%, rendered 5.30 |
| `line.inverse` (`--lt-inverse-hair`) | Chalk 12% | Separators inside Graphite panels | Decorative |
| `surface.nav` (`--lt-nav`) | band 96% | Bottom navigation bar | Bar vs page 1.04–1.10 (tonal, decorative) |
| `state.hover` (`--lt-hover`) | Graphite 3% overlay | Row hover | Transient |
| `state.pressed` (`--lt-pressed-soft`) | Graphite 6% overlay | Pressed rows (the band is lighter than the page, so Dark's "pressed = tray" does not carry) | Transient |
| `surface.facts-in-band` | black 16% | GP heading band facts strip (Dark value, inside the Graphite band) | Decorative |
| `effect.watermark` (`--lt-watermark`) | Graphite 10% stroke | GP results watermark numeral | Decorative |
| `effect.shadow` | Graphite alphas: card `0 1px 2px 6%, 0 16px 30px -20px 30%`; inverse plane `0 18px 30px -22px 60%`; navigation `0 -10px 24px -14px 22%`; Home round block `-10px 0 24px -14px 30%`; Calendar next-event block `10px 0 24px -14px 30%`; snackbar `0 16px 32px -12px 45%` | Depth only | Never carries information |
| `effect.scrim` | band to band 86%/20% (Driver), band to band 90%/55% (Team) | Media layer over the light headings | Decorative |
| `effect.sheen` (Graphite band only) | white 4.5% at 168° | GP heading band (scoped Dark role) | Decorative; cleared on light headings |

## 3. Component roles

### 3.1 Surfaces and text

| Text | page `#EBECEE` | band `#F7F7F8` | card `#FFFFFF` | raised `#DCDDE1` |
|---|---|---|---|---|
| Graphite primary | 15.45 | 17.05 | 18.26 | 13.45 |
| `text-2` secondary | 6.61 | 7.30 | 7.82 | 5.76 |
| Red Oxide accent | 5.52 | 6.09 | 6.52 | 4.81 |

Surface separation is tonal and decorative (band 1.10, card 1.18, raised
1.15 against the page), as in Dark. Light surfaces stay predominant: no
Graphite panel outside §3.2.

### 3.2 Graphite editorial panels and the inverse plane (LT-1, LT-3)

Graphite surfaces appear **only** in these approved contexts:

| Context | Treatment |
|---|---|
| Home championship band (inverse plane) | `linear-gradient(170deg, #1F2125, #141518)`, Chalk text, `#A9ABB1` secondary, Ember accent, Chalk 12% separators |
| Standings leader row (inverse plane) | Same gradient and roles; provisional marker in `line.status-inverse` |
| Home hero action strip (B Motorsport) | Graphite strip under the white card, Chalk label, Chalk arrow disc with a Graphite glyph |
| **GP Detail heading band** (B Motorsport) | `#1F2125` with the white sheen; the frozen **Dark roles scoped to the band** (text, chips, round number, oxide diagonal, facts strip black 16%), so it renders exactly as in Dark |

Not editorial panels, but the same inverse role at small scale: arrow discs
(Calendar next event, Driver team link, GP circuit link, Circuit related
Grand Prix), the primary button, the Final chip and the Settings snackbar
(Graphite with Chalk text, 15.45 against the page).

**Not Graphite (approved light headings):** Driver plate and Team banner
(LT-13), Circuit sheet, Calendar next-event band, sessions band, Settings.

### 3.3 Selection (DK-2 carried over)

| Component | Selected | Unselected |
|---|---|---|
| Selector (Standings, Explore) | Flat Red Oxide slab, 12° shape, Chalk 800 label (5.43); slab vs container **6.09** (Dark 2.47) | Band container, `text-2` 600 label (7.30) |
| Bottom navigation (LT-9) | Flat oxide slab behind the icon, slab vs bar **6.09** (Dark 2.92); **icon stays Chalk on the slab (5.43); label turns Graphite 800 (17.05)**, the one rule-level Light variant | `text-2` 600 label (7.30) |
| Settings option lists | Red Oxide mark (5.52 vs page) with a **Chalk check (5.43)**; weight 800 | Empty mark, `text-2` outline (6.61) |
| Settings root value marks | Small Red Oxide mark (5.52) | — |

Selection is a fill plus weight and label colour; focus is an outline
(§3.6). The XS-26 colour limit of Dark disappears in Light, but its
implementation and accessibility verification stay open.

The Calendar next-event block keeps flat oxide (DK-2) on the light band,
Chalk numeral, Light shadow.

### 3.4 Status vocabulary

| Meaning | Light treatment | Rendered |
|---|---|---|
| Known secondary status (Upcoming, Completed, DNF, Lapped, Provisional, Not available) | Solid `line.status` | 3.85 (page) |
| Unknown value (status, format, session, finish) | Dashed `line.unknown`, stronger than solid | 6.38 page / 6.63 band |
| Alert (Cancelled) | Solid `line.unknown` | 6.31 |
| **Final (LT-7, approved)** | Filled inverse chip: Graphite fill, Chalk text, check icon. Inside the GP band: Chalk fill, Graphite text (scoped, as Dark) | — |
| **Live (LT-7: Ember approved as the direction; contextual validation pending)** | Ember fill, Graphite text. The Red Oxide substitution is rejected | Text 7.44; fill 2.08 page, 6.10–6.18 GP band (component specimen only) |
| Context (format, "Sprint weekend") | Raised fill (`#DCDDE1`) | — |
| Calendar completed row (**LT-14**) | **Full opacity (no dimming)**; completion carried by the "Completed" chip's word, check icon and solid outline | Secondary text 6.61, outline 3.85 |

Words, sizes and accessible names are unchanged. Meaning is never colour
alone.

### 3.5 Red Oxide and Ember

- **Red Oxide** `#A03E2B` is, in Light, both the selected fill (flat) and
  the accent on light surfaces: kickers, "Next" / "Siguiente", text links,
  notice icons, the Circuit direction icon, Team hand-over spans, the Explore
  progress segment, the related-event and GP seams (5.52 page, 6.09 band).
  Labels on it are Chalk (5.43); Graphite on oxide (2.80) is never used for
  text or for a focus ring alone.
- **Ember** `#F08A6C` appears **only inside Graphite panels** (accent and
  focus, as in Dark) and as the Live chip fill. Ember is never text or a ring
  on a light surface (2.08 on the page).

### 3.6 Focus by adjacent surface

**Rule (DK-3 carried over): the ring takes the colour that contrasts with the
surface it is drawn on, and is painted above decoration.** Width 2px. Where
it must cross a fill of another colour, a contextual backing band applies
(§3.7).

| Context | Ring | Drawn on | Measured (rendered) |
|---|---|---|---|
| **Default on light surfaces** (rows, links, buttons, chips links, Settings options, Home hero card) | **Graphite** `#141518`; offset 3px outside, or −3px inset on rows | page, band, card | 15.45 / 17.05 / 18.26 computed; 100% of the perimeter at every Batch 1 and 2 stop except the navigation tabs (below); min 15.45 on Circuit and Settings |
| Selected selector option | Chalk, inset −3px | flat oxide | 5.43 |
| **Unselected selector option (LT-4)** | Graphite + backing | band; the selected slab's tip | 100%, min 6.09 (was 92–95%) |
| **Calendar next-event row (LT-15)** | Graphite + backing | band; oxide block | 100%, min 6.09 (was 85%, min 2.80) |
| **GP winner row (LT-5)** | Graphite + backing, above the rail cell | row; retained gradient cell | 100%, min 4.74 (was 82–90%) |
| Standings leader row (ring outside the Graphite card) | Graphite, offset 2px | page | 9.91 |
| Home championship links (inside the Graphite band) | Ember | Graphite band | median 6.88; min 2.66 over 8–14px where it touches the decorative oxide seam (recorded, as Dark DK-4) |
| Inside the GP Graphite band | Ember (scoped) | `#1F2125` | No focusable element in the band today |
| **Detail back button (LT-11)** | Graphite, offset **1px** (was 3px) | app bar; keeps a 1px page gap above the GP band | neighbours p05 4.37 (Dark 1.95–2.82); GP adjacency 1.27 → 15.45 |
| Home hero (LT-12) | Graphite ring on the card; the strip's corners stay square while focused | card, page | — |
| **GP team link (LT-17, shared Dark/Light)** | Graphite, offset **−2px (inside the link)** | row | 100%, min 15.45 (was 98%, ring merged into the driver name) |
| Bottom navigation tabs | Graphite | navigation bar | p05 10.48–17.05; **perimeter 64–68% on screen in both themes** (bottom edge below the viewport with zero insets: XS-31, XS-32) |

**Selected and focused combinations** stay distinct by shape: selection is a
fill, focus an outline; the navigation slab (60×32) never meets the tab ring.

### 3.7 Contextual focus backing (LT-4, LT-5, LT-15)

While a control is focused and its ring would cross a fill of another colour,
a **5px inset band of the surface the control sits on** is painted under the
ring (`box-shadow: inset 0 0 0 5px <surface>`), so the ring contrasts with
what is actually next to it on its whole perimeter. It applies to: the
unselected selector option (band), the GP winner row (page) and the Calendar
next-event row (band). It changes nothing at rest and adds no colour: the
band is the existing surface. Generalisation to other components needs its
own review.

### 3.8 Team-colour edges (LT-6; XS-25)

**Rule:** a supplied team colour below **3:1 against the surface it actually
sits on** gets a **1px edge in that surface's primary text colour** (Graphite
on light, Chalk on graphite). The supplied colour is never changed.

| Surface | Colour (example) | Light result |
|---|---|---|
| Explore tick, page `#EBECEE` | `#FF8000` 2.13, `#0093CC` 2.94 | Graphite 1px edge |
| Team banner rail, band `#F7F7F8` | `#FF8000` 2.35 | Graphite 2px frame inside the bar, Graphite pinstripe |
| Team banner rail, band | `#0093CC` 3.24, `#1E41FF` 6.03 | Plain (Alpine with a narrow margin) |
| Team line-up seam, page | `#FF8000` 2.13, `#0093CC` 2.94 | Graphite 1px edge outside the seam |
| Driver tick / any surface | `#1E41FF` 5.46 | Plain (its Dark edge drops) |

No colour can be below 3:1 on both the Dark and the Light surface, so edges
flip between themes. Flutter implements **one runtime contrast test**; the
prototype's colour selectors stand in for it. **Open:** one shared seam-edge
geometry for both themes (Dark widens the column to 4px, Light draws the
edge outside the 2px seam).

### 3.9 Navigation (LT-9)

Bar: band 96% with the navigation shadow; selected and unselected as §3.3;
focus as §3.6. The responsive large-text layout (two rows at 320 @200%) and
targets are identical to Dark. Native focus visibility, system insets and
scrolling behind the bar stay open (XS-31, XS-32).

### 3.10 Notices (LT-8)

Band fill (1.10 vs page), **Graphite 26% border (1.60 rendered, a supporting
decorative boundary)**, Red Oxide cause icon (6.09 on the fill), Graphite
text. Meaning is carried by the text, icon, fill and position, as in Dark
(border 2.13). The 55% status-outline candidate is not adopted.

### 3.11 Actions

| Action | Treatment |
|---|---|
| Primary button | Graphite fill, Chalk text; hover `#1F2125` |
| Text links | Red Oxide, underlined where Dark underlines (5.52 page) |
| Arrow discs | Graphite disc, Chalk arrow (15.45 vs page); on the Home strip the inverse (Chalk disc, Graphite glyph) |
| Rows | Hover Graphite 3%, pressed Graphite 6% |
| Snackbar (Settings) | Graphite plane, Chalk message, decorative oxide seam |

### 3.12 Loading placeholders (LT-16)

The existing skeleton blocks in the light tones: `linear-gradient(90deg,
band, raised, band)` (`#F7F7F8` → `#DCDDE1`), static, hero block 1.15 against
the page (Dark 1.32). **Kept light on GP Detail and Circuit Detail**; the
Graphite GP placeholder (11.69 against the page) is rejected. Loading
semantics (`role="progressbar"`, "Loading") and geometry unchanged; no
animation added.

### 3.13 Decorative gradients (DK-6, LT-10)

Unchanged in Light: `linear-gradient(165deg, #B04633 0%, oxide 45%,
oxide-deep 100%)` for the Home hero round block; the same with oxide at 55%
for the Driver identity plate and the GP winner position cell. Only their
shadows take the Light alpha. On light they stand out more than in Dark
(Driver board vs band 7.20–7.30, Dark about 2.1; winner cell vs its row
7.65–8.30). No new gradient; Chalk text on them as in Dark.

### 3.14 Component-specific exceptions (approved)

- **GP heading band:** Dark roles scoped to the band (§3.2); its chips,
  round number and oxide diagonal are pixel-identical to Dark.
- **Light identity headings** (Driver, Team, Circuit): band fill, the white
  sheen cleared; Driver board keeps its gradient; media scrims fade from the
  band.
- **Calendar next-event band:** the light band instead of Dark's tray
  gradient; flat oxide block; backing focus (LT-15).
- **Settings:** the selection check is Chalk on oxide; the provisional
  `GvColorsLight` preview is superseded; the snackbar is Graphite.
- **Circuit related Grand Prix disc:** Graphite (Dark Chalk disc would be
  1.05 on the page).
- **Live chip on the page:** tonal fill (2.08); the word carries the state.
- **McLaren banner pinstripe:** stays 3px in the Light prototype (Dark's
  edged pinstripe is 2px); see §6.

## 4. Not settled by this freeze (stays open)

| Item | Status |
|---|---|
| LT-7 Live | Ember direction approved; **contextual validation pending** until an authoritative app screen presents Live |
| XS-11 | Status boundaries in Flutter; Calendar completed-row details (Dark 0.72 dims the completed outline to 2.65:1; Light keeps 100%) |
| XS-25 | Runtime team-colour test; one shared seam-edge geometry |
| XS-26 | Selected-state implementation and accessibility verification |
| XS-28 | Flutter tokens for both themes (the `--lt-*` values are prototype custom properties) |
| XS-31 | Focus-ring implementation: per-surface colour, ring above decoration, contextual backing, LT-11 and **LT-17 as a shared requirement** |
| XS-32 | Keyboard focus behind the fixed bottom navigation; native insets and focus scrolling |
| XS-07 | Long app-bar titles (truncation and fit) |
| XS-02, XS-05, XS-16 | TalkBack, Android font scaling, device rendering, insets, D-pad and switch input |

## 5. Inputs for cross-theme consolidation (not implemented)

**Shared rules (one implementation, a value per theme):**
- Surface roles (`page`, `band`, `raised`, `text`, `text-2`) and the
  inverse plane, which flips (Chalk in Dark, Graphite in Light).
- Flat Red Oxide selection with Chalk labels (5.43 in both).
- Status outlines: `line.status` (Chalk 45% / Graphite 55%), dashed
  `line.unknown` (Chalk 60% / Graphite 70%), `line.status-inverse`.
- The focus rule "ring contrasts with the surface it is drawn on, painted
  above decoration", with a colour per surface and theme (Dark: Ember on
  graphite, Chalk on oxide; Light: Graphite on light, Chalk on oxide, Ember
  inside Graphite panels).
- **LT-17 inward team-link ring (−2px)**, approved for both themes.
- The team-colour edge rule with one runtime contrast test; the edge colour
  is the surface's primary text colour.
- The DK-6 decorative gradients, unchanged in both.
- Notices: band fill, `line.strong` border, accent icon.

**Theme-specific exceptions:**
- **Contextual focus backing** (LT-4, LT-5, LT-15) exists only in Light;
  Dark solves the same crossings with a Chalk ring (DK-3).
- **Graphite editorial panels in Light** (Home band, leader row, Home strip,
  GP band): implement as a Graphite surface scope that applies the Dark
  roles to a subtree, not as new tokens.
- **Accent split:** Dark uses Ember for accent and focus; Light uses Red
  Oxide for accent and Graphite for focus, and Ember only inside Graphite
  panels and for Live.
- **Completed Calendar rows:** Dark 0.72 opacity, Light 100% (LT-14). The
  Dark value dims the completed outline to 2.65:1 (XS-11); aligning them is
  a consolidation decision, not made here.
- **Navigation:** Light keeps a Chalk icon on the oxide slab with a Graphite
  label (LT-9). Insets and focus scrolling are a shared implementation
  concern (XS-31, XS-32).
- **Settings mark check:** Graphite on Ember in Dark, Chalk on oxide in
  Light (an `on-mark` role per theme).
- Back-button offset 1px (LT-11) is approved for Light; Dark keeps 3px
  unless consolidation decides otherwise.

## 6. Prototype values that differ from the freeze

The approved prototypes, pilots and earlier experiments are **unchanged**.
Flutter implements the frozen role, not the prototype value.

| Where | Prototype today | Frozen role | Tracking |
|---|---|---|---|
| Calendar completed row, Light chain (`light-b1.css`) | Inherits Dark's 0.72 opacity (no completed row is rendered by the approved fixture) | 100% opacity (LT-14; `lt14-a.css`) | XS-11 |
| GP team link in the Dark prototypes and pilots | Ring 3px outside | −2px inside (LT-17, shared) | XS-31 |
| Team line-up seam edge | Dark: 4px column (`.lu--edge`); Light: box-shadow outside the 2px seam | One shared geometry, to be decided | XS-25 |
| McLaren banner pinstripe, Light | 3px with a Graphite fill | Same edge rule as Dark's 2px edged pinstripe | XS-25 |
| `--lt-facts` (`light-roles.css`) | Graphite 4% facts strip | Superseded by the Graphite band's black 16% (`light-bm.css`) | — |
| Settings development notes in Light | Describe the superseded provisional preview | Cleanup item (`LIGHT-READINESS.md` §6) | — |
| `light-foundations/` file headers | "EXPERIMENT … not an approved design / palette" | Approved (LT-1 to LT-6); historical files, not edited | — |
