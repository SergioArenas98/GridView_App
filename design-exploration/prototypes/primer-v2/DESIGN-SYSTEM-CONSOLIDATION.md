# Primer V2: design-system consolidation (Step 38A)

**Status: proposal, 2026-11-08. Nothing in this document is an approved
decision.** Every recommendation below is labelled **Proposal** and needs the
owner's approval before it changes a prototype, the backlog's status of an
item, or Flutter. [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) stays the
authoritative record of decisions and [`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md)
the authoritative list of open work. No backlog item is closed by this
document. No prototype HTML, CSS, generator or script was changed to write it.
The genuinely new drift found by this audit was recorded in the backlog as
XS-26 (selected fill), XS-27 (12° geometry), XS-28 (Flutter foundation
tokens, P0) and XS-29 (section-heading levels); XS-07 was widened to the
detail app bars. Everything else cites an existing ID.

> **Update 2026-11-12 (Steps 51D–51E).** The dark colour roles are frozen in
> [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md), from approved decisions
> DD DK-1 to DK-6. Primer V2 Dark is formally visually closed (DK-5). Where
> it differs from §2.1–2.2, the role freeze applies:
> - the per-surface focus ring replaces the single Ember `state.focus`;
> - `line.status` at Chalk 45% replaces `line.strong` for solid status
>   outlines;
> - flat `brand.surface` replaces the gradient for selected controls and
>   the Calendar next-event block. §5.3 is decided (DD DK-2);
> - the decorative gradients on the Home hero round block, Driver plate and
>   GP winner cell are **retained** (DD DK-6). `oxide-500` (`#B04633`) stays
>   there as a contextual decorative value, not a token.
>
> The proposal text below is kept as it was written.

## 0. Scope and sources

**Approved visual references used** (the versions the decision log names; no
earlier exploration substituted):

| Screen | Reference | Decision status |
|---|---|---|
| Home | `refinement-01/` (not the baseline `index.html` / `styles.css` at the folder root) | Provisionally approved |
| Calendar | `calendar/` | Provisionally approved |
| Standings | `standings/` | Provisionally approved (S-1 to S-5) |
| Explore | **Alternative B**, `explore/comparison-missing-media/cue[.es].html` (EX-02), on the `explore/` baseline structure (EX-01) | Provisionally approved; media policy open (PD-16) |
| Grand Prix Detail | `grand-prix-detail/` | Provisionally approved (G-1 to G-9) |
| Driver Detail | `driver-detail/` with the refinement (DR-01 to DR-03) | Provisionally approved |
| Team Detail | `team-detail/` with the refinement (TM-01 to TM-03) | Provisionally approved |
| Circuit Detail | `circuit-detail/` (CR-01 to CR-03) | Provisionally approved |
| Settings | `settings/` root and preferences (SP-01) | Provisionally approved |
| Settings information | `settings/information/` (SI-01 to SI-04) | Provisionally approved; not production-ready |

**Read for this audit:** the pre-redesign audit
(`../../GridView_Pre_Redesign_UI_UX_Audit.md`), `../../shared-reference-data.md`,
the decision log and backlog, every screen README, all 26 stylesheets and the
scripts that change layout (`nav-inset.js`, `standings.js`, `explore.js`,
`settings.js`, `information.js`); Flutter `lib/core/theme/` (tokens, semantic
colours, `gv_team_accent.dart`, text styles), `lib/core/widgets/` (17 shared
widgets); `docs/technical/GridView_Design_System.md`,
`docs/technical/GridView_Accessibility.md`, `docs/product/GridView_UI_UX_Design.md`.

**Evidence level.** Everything is Chrome emulation plus owner screenshot
review. No device, TalkBack or Android font-scaling evidence exists for any
Primer V2 screen (XS-02, XS-05, XS-16).

## 1. Summary

Primer V2 is already one visual language: one family (Archivo, width axis as
hierarchy), one palette (graphite, Chalk, Red Oxide, Ember), one signature
(the 12° livery cut), open composition on graphite with hairlines instead of
cards. What it is not yet is one **system**: the foundation is copied into
eight folders, components were re-derived per screen, and a handful of rules
(titles, selected fills, 12° geometry, section headings, team-colour edges,
status vocabulary) drifted. Flutter's current tokens are a different visual
system altogether (different palette, gutter, radii, no Archivo).

The most valuable shared pieces are: the token set; the bottom navigation;
the selector; the detail app bar; the list row with trailing affordance
(Standings, Calendar, Explore B, GP circuit row, Settings); the status chip
vocabulary; the notice; the read-only fact row; the section heading; the
empty/error/loading blocks. Banners, boards and championship figures are
deliberately different per screen and should stay screen compositions built
from shared tokens, not one generic "hero" component.

## 2. Proposed canonical tokens (Proposal)

### 2.1 Colour: primitives (dark, today's prototype values)

From `primer-core.css` (byte-identical in eight folders, SHA-256 `3ed7b68bb3…`)
and `refinement-01/styles.css`:

| Primitive | Value | Contrast on graphite |
|---|---|---|
| `graphite-900` (ground) | `#141518` | — |
| `graphite-950` (ground-low) | `#101113` | — |
| `graphite-800` (tray) | `#1F2125` | — |
| `graphite-700` (raised) | `#2A2D32` | — |
| `chalk-100` (text, Chalk) | `#ECEAE5` | 15.19:1 |
| `chalk-200` (chalk-low) | `#E2DFD8` | — |
| `slate-400` (text-2) | `#A9ABB1` | 7.95:1 (7.02 on tray, 6.02 on raised) |
| `oxide-600` | `#A03E2B` | **2.80:1** (surface only); Chalk on it 5.43:1 |
| `oxide-700` (oxide-deep) | `#7A2E21` | — |
| `oxide-500` (gradient start, **uncatalogued**) | `#B04633` | Chalk on it 4.63:1 |
| `ember-400` | `#F08A6C` | 7.44:1 |
| `ink-on-chalk` / `ink-on-chalk-2` | `#141518` / `#4F525A` | 6.50:1 (`on-chalk-2` on Chalk) |
| hairlines | Chalk at 12% / 22%; ink at 14% on Chalk | decorative |

### 2.2 Colour: semantic roles (Proposal)

*Superseded for dark by [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md) (Step 51D)
where they differ: `state.focus`, `line.strong` for status outlines, and the
gradient fill on selected controls (decorative gradients retained, DK-6).*

Name roles, not hues, so the light theme can remap them (§9):

| Role | Dark value | Used for | Rule |
|---|---|---|---|
| `surface.ground` | graphite-900 | Page | — |
| `surface.sunken` | graphite-950 | Nav background (at 96%) | — |
| `surface.tray` | graphite-800 | Bands, notices, hover | — |
| `surface.raised` | graphite-700 | Pressed, skeleton | — |
| `surface.inverse` | chalk-100 | Home championship band, snackbar, Chalk arrow disc | Text on it uses `ink-*` |
| `text.primary` / `text.secondary` | chalk-100 / slate-400 | All text | Secondary never below 4.5:1 on its surface |
| `text.accent` | ember-400 | Relative start, "Next session", text links, focus ring | Only accent text on graphite |
| `brand.surface` | oxide-600 | Selected slabs, round blocks, Winner tag, seams, identity board | **Never text on graphite; never the only state cue** (2.80:1 is below the 3:1 non-text floor) |
| `brand.surface-strong` | oxide-700 | Gradient end, pressed brand | — |
| `brand.text-on-inverse` | oxide-600 | Links and leader position on Chalk (5.43:1) | Only on `surface.inverse` |
| `line.subtle` / `line.strong` / `line.inverse` | hair / hair-strong / hair-chalk | Separators, outlines | Decorative; dashed `line.strong` = "not confirmed / not fixed" |
| `team.accent` | supplied `#RRGGBB` | Ticks, rails, seams | §2.7 |
| `state.focus` | ember-400, 2px | Focus ring | Every interactive element |

**Finding (drift, XS-26 below):** the oxide gradient
`linear-gradient(165deg, #B04633, oxide, oxide-deep)` fills the selected
selector slab (Standings, Explore), Calendar's next-event round block and the
Driver identity plate, while Home's selected navigation slab, the Winner tag
and Settings' marks use flat oxide. `#B04633` is not a token.

### 2.3 Typography (Proposal)

One family, **Archivo** variable (wdth 62–125, wght 100–900, OFL). Flutter has
no family set today (`GvTypography.heading/body = null`, "pending → Sora /
Inter"): adopting Archivo is a Flutter decision (XS-28).

| Role | Size | Weight / width | Where |
|---|---|---|---|
| `display.figure` | 44–92px (Home 68/92, Calendar 38–50, Standings 28–40, Driver board) | 800–850, wdth 112–125, tabular | Round, points, race number, time |
| `display.name` | 22–30px | 750–800, wdth 78–88 | GP, driver, team names in banners |
| `title.screen` | 18–21px | 800, wdth 88 | App-bar title (§5.1 drift) |
| `title.section` | 20px | 700, wdth 106 | Home `section-title`, detail `.sec__title` |
| `label.kicker` | 13px | 700, secondary, with trailing rule | Settings, information, Circuit sheet, Calendar/Standings kickers |
| `body.reading` | 16px / 1.55, measure 36em | 400 | Legal and explanatory text (information screens) |
| `body.default` | 15px / 1.45 | 400–600 | Rows, sub-lines |
| `label.small` | 13px minimum | 600–700 | Chips, captions, badges |

Rules already proven across screens (Proposal to codify):
- **Width axis as hierarchy:** figures expanded, names condensed, labels and
  body at normal width.
- **13px floor** for any text (all validation runs measured < 12.5px: 0).
- **Tabular lining numerals** for every figure, column and time.
- **No tracked capitals; sentence case.**
- **Narrow before wrap, wrap before scale:** on a narrow container (in em,
  so it reacts to text size), narrow `wdth` first; wrap between words;
  scale down only a single word that still cannot fit (S-2; information
  screens' title fit).

### 2.4 Spacing, surfaces, borders (Proposal)

| Token | Prototype | Flutter today | Proposal |
|---|---|---|---|
| Gutter | 16px everywhere | `screenPaddingHorizontal` 20 | 16 (decision: XS-28) |
| Row min height | 48 (targets), rows 60–76 | `minTouchTarget` 48 | Keep 48 floor; row heights per pattern |
| Radii | 8 / 14 / 20 | 8 / 12 / 20 / 28 / pill | 8 / 14 / 20 + pill |
| Separators | Hairline inset to the gutter, full-bleed press fill | Card borders | Inset hairline |
| Surfaces | Open on graphite; full-bleed tray bands; one Chalk band | `GvInfoCard`, `GvContentCard` | **No cards** as page structure (SP-01 aspect 2 approves this for Settings) |
| Depth | Three planes: lit panel with soft offset shadow (Home hero), Chalk band, watermark | Elevation tokens | Keep three planes; no zero-offset glows |

### 2.5 The 12° livery cut (Proposal)

`--cut: -12deg` exists in the core. Uses found:

| Use | Screens | Meaning | Implementation |
|---|---|---|---|
| Selected navigation slab | Home, Calendar, Standings, Explore | Current destination | `skewX` pseudo, flat oxide |
| Selected selector slab | Standings, Explore | Current option | `skewX` pseudo, oxide **gradient** |
| Round / identity block | Home hero, Calendar next event, Driver plate | Key fact board | `skewX` pseudo; gradient on Calendar and Driver, flat on Home |
| Winner tag / livery tag | Home, GP Detail | Client-derived key fact | `skewX` pseudo (Home), `clip-path` with fixed 17px run (GP winner cell, GPD-10) |
| Seams (2–4px) | Home championship, Driver championship, Team strip and line-up, Circuit lap record, GP identity band | Separates a figure from its context | `skewX` on a thin element |
| Team-colour tick / rail | Standings, Explore, Team banner | Team identity (decorative) | `skewX` pseudo (ticks); `clip-path` with `tan(12°) = 0.2126` (Team rail) |
| Selection mark | Settings options and root values | Selected / current value | `skewX` pseudo, outline vs Ember fill + check |
| Snackbar seam | Settings | Brand detail on Chalk | `skewX` |
| Dimension-line ends | Circuit | Measurement ends | `skewX` |

**Proposal:** one rule for every use: the cut is the **leading or trailing
edge at 12° from vertical**, drawn so the angle is exact at any height.
`skewX(var(--cut))` on a pseudo-element satisfies this for slabs and seams;
`clip-path` must compute its run from the element height (`tan(12°) × h`), as
Team Detail does, never a fixed pixel run (GPD-10). In Flutter: one
`GvLiveryCut` clipper/painter taking an edge and the angle.

### 2.6 Motion (Proposal)

Present: row press fills (160ms), nav icon nudge, snackbar slide (260ms),
Explore's indeterminate refresh line (EXP-02), Flutter's skeleton pulse. Every
prototype zeroes transitions under reduced motion. Proposal: one ease-out
(`cubic-bezier(0.16, 1, 0.3, 1)`), 160 / 260ms, no looping motion except a
loading indicator, all of it off under reduced motion (Flutter already
static-renders skeletons when animations are disabled).

### 2.7 Team colour (Proposal)

Flutter: `GvTeamAccent` picks a readable foreground by measured contrast, and
team colour is decorative by rule (UI/UX §7.2, §18). Prototypes: ticks and
rails in the supplied colour; Team Detail alone adds a Chalk edge below 3:1
(TM-03). Proposal: **one rule everywhere** (XS-25): team colour never carries
meaning alone; below 3:1 against its surface it gets the TM-03 Chalk edge;
text is never set in a team colour.

## 3. Component and pattern inventory

Classification: **1** shared and consistent · **2** shared but duplicated ·
**3** similar but intentionally different · **4** inconsistent, needs a
decision · **5** screen-specific, do not abstract.

| Pattern | Screens | Class | Notes and references | Proposal |
|---|---|---|---|---|
| Tokens (`primer-core.css`) | All except Home (own copy in `styles.css`) | **2** | Copied byte-identical into 8 folders; Home's values identical but separate (XS-09) | One `primer-tokens.css` |
| Bottom navigation (adaptive regular → condensed → stacked) | Home, Calendar, Standings, Explore | **2**, with a **4** | Core plus `nav-inset.js`; Standings/Explore add the selected-label fallback (`wdth` 62, 700), not applied to Home/Calendar (S-3, XS-08) | One component with the fallback |
| Primary app bar (wordmark / title + season) | Home, Calendar, Standings, Explore | **4** | Home wordmark; Calendar `14cqi` cap; Standings/Explore width-axis fit + header budget (S-2, XS-07) | One title rule (§5.1) |
| Header budget (pinned area ≤25%) | Standings, Explore (second level) | **4** | Accepted pending validation (S-1, XS-06); Calendar not adopted | Adopt everywhere with a pinned header, after device check |
| Detail app bar (back + title) | GP, Driver, Team, Circuit, Settings, information | **2** + **4** | Four identical copies (18px, capped 26px, **ellipsis**); Settings variant 21px, uncapped, **wraps**; information adds S-2 fit | One `DetailAppBar`; title rule needs a decision (§5.1) |
| Environment strip (DEV / STAGING) | Settings, information; GP states | **1** | Own strip above the bar; text not localized (SETT-08) | Shared |
| Selector (segmented, 12° slab) | Standings, Explore | **2** | Copied; `aria-pressed`; gradient slab | Shared `GvSelector` |
| Option list (radio, 12° mark) | Settings Language/Theme/Time | **1** | SP-01 aspects 4, 5 | Shared `GvOptionList` |
| List row with trailing chevron | Standings, Calendar, Explore B, GP circuit row, Settings rows | **2** | `.st__go`, `.ev__go`, Explore B chevron, `.srow__go`: same 16–24px secondary glyph, different classes | One `GvRowAffordance` (chevron / open-in-new / mail) |
| External-link row | Settings feedback, information links | **3** | Information uses Flutter's open-in-new; Settings feedback uses an arrow, owner prefers the mail icon (SETT-04) | Same row, glyph per destination type |
| Entity rows (driver / team / circuit) | Explore B, Standings, Team line-up, GP classification | **3** | Same anatomy (identity, sub-line, right figure, chevron), different data | Shared row skeleton; screen-specific content |
| Ranking row + leader row | Standings | **5** | Chalk leader strip, oxide position (S-5) | Keep |
| Classification row (winner, chips, team link) | GP Detail | **5** | Separate driver and team targets (G-8, GPD-04, GPD-05) | Keep; shares chip and row tokens |
| Event row (round column) | Calendar; Circuit related event | **3** | Round number column; Circuit's row adds oxide seam + Chalk disc (CR-01 aspect 7) | Shared round-figure token |
| Status chips | Home, Calendar, GP, Driver, Team, Circuit, Standings | **2** + **4** | Core vocabulary plus GP additions copied into Driver/Team/Circuit (`chip--outline`, `--done`, `--alert`, `--fastest`); unknown = dashed chip on Home/Calendar/GP event, plain grey text for GP session (XS-11) | One chip set; one unknown treatment |
| Provisional marker (dagger + word) | Standings only (Driver, GP and Team use the plain outline chip) | **1** | Quiet 13px caption (STD-04). **Superseded 2026-11-12:** the dagger is not a shared convention (DD VS-2 rejected); Standings drops it in the future implementation (DD VS-3) | Word-led outline chip everywhere; Standings keeps its compact size and caption |
| Notice (tray, hairline, Ember icon) | Standings, Explore, GP, Driver, Team, Circuit, information | **2** | Copied; offline icon also used for "partial" (XS-22) | Shared `GvNotice` with icon per cause |
| Freshness caption | Home ("last check"), Standings (per table, STD-01) | **3** | Different sources by rule | Shared style, separate data |
| Section heading | Home `section-title` 20px; detail `.sec__title`; Settings/information/Circuit kicker 13px with rule; Calendar/Standings kickers | **4** | Two visual levels for `h2` (CIR-06) | Decide one `h2` style plus one kicker (§5.9) |
| Read-only fact row (label above value) | Information screens; Driver/Team/Circuit fact layouts | **3** | Information `.fact`; detail "spec sheet" and "profile facts" are figure rows | Shared `GvFactRow`; detail spec sheets stay compositions |
| Championship figures | Home Chalk band; Driver stats; Team three-figure strip | **3** | Intentional per screen (TM-01, DR-01) | Shared figure tokens only |
| Detail banners (identity plate, entrant banner, circuit sheet, GP identity band) | Driver, Team, Circuit, GP | **5** | Editorial identity per entity (DR-01, TM-01, CR-01, G-1) | Keep; share tokens, cut, season line |
| Season line | Driver, Team (header), Circuit (related section), GP | **4** | DR-02 approves Driver/Team header; Circuit placement open (CIR-01) | Decide placement once |
| Dimension line | Circuit | **5** | CR-03, CIR-05 | Keep |
| Lap-record readout / timing figure | Circuit, GP (session time) | **3** | Tabular figure + seam | Shared figure tokens |
| Snackbar (Chalk, oxide seam) | Settings, information | **1** | Polite status region | Shared |
| Empty / error block | Standings, Explore, GP, Driver, Team, Circuit | **2** | `.empty`, `.btn` copied | Shared `GvEmptyState` / `GvErrorState` restyle |
| Loading skeleton | Standings, Explore, GP, Driver, Team, Circuit, information | **4** | Shapes differ and three are pending (DRV-01 9, TEAM-01 11, CIR-01 10); information bar is static, Flutter pulses | Shared skeleton primitives; shapes per screen |
| Image slot / missing media | Explore (EX-02: none without references), Home hero, GP hero, Driver portrait, Team mark, Circuit 16:9 slot | **4** | No common rule yet (EXP-04, XS-15, CR-02) | One media-slot policy (§5.6) |
| Sample / frozen-data banner | GP states only | **4** | Never placed in main layouts (XS-21) | Decide placement |
| Focus ring | All | **1** | 2px Ember, offset 3px (-3px inside rows) | Shared |
| Pressed / hover | All rows | **1** | Tray hover only under `(hover: hover)`; raised on press | Shared |
| Watermark plane | Home latest result | **5** | HOME-05 | Keep |

## 4. Cross-screen usage matrix

● uses it · ○ uses a variant · — not used

| Pattern | Home | Cal | Std | Exp B | GP | Drv | Team | Circ | Set | Info |
|---|---|---|---|---|---|---|---|---|---|---|
| Tokens (core) | ○ own copy | ● | ● | ● | ● | ● | ● | ● | ● | ● (loads `../`) |
| Bottom nav | ● | ● | ○ fallback | ○ fallback | — | — | — | — | — | — |
| Primary app bar | ○ wordmark | ○ cqi cap | ○ fit + budget | ○ fit + budget | — | — | — | — | — | — |
| Detail app bar | — | — | — | — | ● | ● | ● | ● | ○ wraps | ○ wraps + fit |
| Selector | — | — | ● | ● | — | — | — | — | — | — |
| Option list | — | — | — | — | — | — | — | — | ● | — |
| Row + chevron | — | ● | ● | ● | ○ circuit row | ○ links | ○ links | ○ event row | ● | ○ open-in-new |
| Status chips | ● | ● | ○ provisional | — | ● + additions | ○ | ○ | ○ | — | — |
| Notice | — | ○ | ● | ● | ● | ● | ● | ● | — | ● |
| Section heading | `section-title` | kicker | kicker | — | `.sec__title` | `.sec__title` | `.sec__title` | `.sec__title` + kicker | kicker | kicker |
| 12° cut | ● ×4 | ● | ● ×3 | ● ×2 | ● ×2 | ● ×3 | ● ×4 | ● ×2 | ● ×2 | — |
| Team accent | — | — | ● tick (no data) | ● tick | — | ● | ● rail + edge | — | — | — |
| Image slot | ○ hero (unvalidated) | — | — | ○ none (EX-02) | ○ hero | ○ portrait | ○ mark | ○ 16:9 | — | — |
| Skeleton | — | — | ● | ● | ● | ● | ● | ● | — | ○ static |
| Empty / error | — | — (CAL-01) | ● | ● | ● | ● | ● | ● | — | ○ notice |
| Snackbar | — | — | — | — | — | — | — | — | ● | ● |

## 5. Design drift

### Genuine inconsistencies (need a decision)

| # | Topic | What differs | Existing IDs | Proposal |
|---|---|---|---|---|
| 5.1 | Screen titles | Detail bars ellipsize (Flutter parity); Settings/information wrap uncapped; Standings narrows the width axis then scales; Calendar caps at `14cqi`; Home has its own wordmark | XS-07, S-2, SP-01 aspect 9 | **Proposal:** all titles wrap between words, narrow before scaling, never truncate; scale only a single overlong word (S-2). Extend XS-07 |
| 5.2 | Large-text header | Header budget in Standings and Explore; Calendar keeps a sticky header that leaves ~61% at 320 @200%; detail bars always sticky (information screens' chrome reaches 167px, 24% of 693px, at 320 @200% with the DEV strip and a two-line Spanish title) | XS-06, XS-08 | Apply the 25% budget to every pinned header after device validation |
| 5.3 | Selected states | Nav: flat oxide slab + bold Chalk label; selector: oxide gradient slab + `aria-pressed`; Settings: Ember-filled mark + check + weight; Flutter selector: `#FF3B30` fill failing 4.5:1 (Accessibility §4.11) | S-3, XS-26 | **Proposal:** flat `brand.surface` for all slabs (drop `#B04633`), always paired with weight change; Ember mark stays for option lists. **Decided 2026-11-12 (DD DK-2):** flat oxide; slab 2.47:1 on tray, paired cue recorded, not a compliance claim |
| 5.4 | 12° geometry | `skewX` pseudo (exact angle), `clip-path` with `tan(12°)` (exact), `clip-path` with fixed 17px (steeper at 200%) | GPD-10, XS-27 | Height-derived geometry only (§2.5) |
| 5.5 | Team-colour contrast | Chalk edge below 3:1 on Team Detail only; Explore/Standings ticks without | XS-25, TEAM-03, STD-06, DRV-07 | One rule (§2.7) |
| 5.6 | Missing media and image slots | Explore: no column without references (EX-02); Flutter: 40px reserved slot; Circuit: 16:9 slot only when an asset exists; Driver portrait layer by geometry; Home/GP heroes never validated | EXP-04, EXP-01 diff 5, XS-15, CR-02 | One media-slot policy per collection / per hero, decided with real licensed media |
| 5.7 | Unknown / provisional / unavailable | Dashed chip (Home, Calendar, GP event); plain grey "Status unknown" (GP session); provisional dagger caption; "Driver unavailable" secondary text (Circuit); "Not available yet" secondary weight (information); partial notice with offline icon | XS-11, STD-04, XS-22, CIR-01 | **Proposal:** dashed outline = unknown/unconfirmed everywhere (chip or inline); secondary weight = absent value; notice icon names the cause. **Decided 2026-11-12:** dashed outline for unknown values (DD VS-1); no dagger on Provisional (VS-2, VS-3); alert / clock / help notice icons (VS-4) |
| 5.8 | Units | "pts" only on the Standings leader row and on every GP row; Driver/Team championship figures labelled differently | XS-12, G-6 | One rule: unit on every points figure that stands alone, omitted inside labelled columns |
| 5.9 | Section headings | 20px `section-title` vs 13px kicker with rule for the same `h2` level | CIR-06, XS-29 | One `h2` style per screen type, kicker only for groups inside a sheet |
| 5.10 | Row affordances | Chevrons on Standings, Calendar, Explore B, Settings; GP driver row has none while its team link has an underline + chevron | GPD-04, EXP-05 | Every whole-row destination ends with the chevron; separate in-row links keep their own affordance |
| 5.11 | Text wrapping | Wrap approved for Standings (S-4), GP (G-9), Explore (EX-02); Calendar still `maxLines: 2`; detail bars truncate | XS-10, XS-07 | Wrap everywhere; no truncation of names |
| 5.12 | Reading order | Visual order (Calendar round first, GP time first) vs Flutter name-first; Driver season line after heading, GP before | XS-03, XS-04, PD-06, PD-07 | Owner policy first; then one rule |
| 5.13 | Light theme | Not designed for any screen; Settings has a labelled provisional `GvColorsLight` preview; information pages none | XS-01 | §9 |
| 5.14 | Flutter foundation | Flutter tokens are another system: background `#0B0D12`, accent `#FF3B30`, blue secondary, gutter 20, radius 12, no Archivo | XS-18, XS-28 | Decide token migration before any component work |

### Intentional editorial variation (keep)

- Detail banners differ per entity (identity plate with number board, entrant
  banner with team rail, circuit sheet with dimension line, GP identity band
  with fact rail): approved individually (DR-01, TM-01, CR-01, G-1).
- Championship figures: Home Chalk band, Driver statistics, Team three-figure
  strip (approved per screen).
- Home's watermark, hero panel and sessions band; Calendar's next-event block.
- Settings and the information screens have no board or figure by design
  (SP-01, SI-01 to SI-04).
- Explore Teams has no right-hand figure (EXP-03 is polish, not drift).
- Spanish runs longer: rows wrap or narrow rather than truncate; this is
  responsive behaviour, not a separate layout.

## 6. Responsive and accessibility rules (Proposal, consolidating proven practice)

**Widths and text.** Design at 390dp, verify at 320dp; 200% text must not
clip, truncate names, scroll horizontally or split a word mid-word (a break
at a real hyphen is allowed; URLs may break anywhere). Container queries are
in em of the component so they react to text size and width alike. Figures
are currently capped with `min()` (e.g. `min(1.75rem, 32px)`): proposal to
keep caps only on display figures and never on reading text, and to validate
Android 14 non-linear scaling before accepting the caps (XS-05).

**Order of adaptation:** narrow width axis → wrap between words → stack (a
figure moves to its own line, nav stacks 2 × 2) → scale a single overlong
word as the last resort.

**Header budget:** pinned chrome ≤ 25% of the viewport, otherwise the app-bar
row scrolls away (S-1, pending validation).

**Targets and focus:** every interactive element ≥ 48 × 48; 2px Ember focus
ring; Tab order = reading order; focused rows kept clear of sticky chrome
(`scroll-padding-top`).

**Colour:** text ≥ 4.5:1, large text and non-text indicators ≥ 3:1; never
colour alone (selection = shape + weight; status = word + border pattern);
oxide surfaces are below 3:1 on graphite and therefore always paired with a
second cue.

**Semantics:** one `h1` per screen; sections `h2`; entity headings `h3`;
selection as radio/pressed state, never a spoken "Selected" suffix (Settings
difference 6, Accessibility §4.1); polite status regions for notices and
snackbars; loading announced once; whole-row links named title-first unless
XS-03 decides otherwise; provider-supplied English on Spanish pages marked
`lang="en"`.

**Motion:** §2.6.

## 7. Decisions needed from the owner before consolidation

Ordered by how much later work depends on them. None is decided here.

1. **Foundation migration (XS-28, with XS-18):** adopt Primer V2's
   palette, 16px gutter, radii and Archivo in Flutter, replacing the current
   tokens. Includes bundling Archivo (OFL) and the variable `wdth` axis
   (SETT-09).
2. **Reading-order and semantic-label policy (XS-03, XS-04)**, already P0.
3. **Title rule (§5.1, XS-07):** wrap + narrow + last-resort scale for every
   title, including detail bars that ellipsize today.
4. **Header budget everywhere (XS-06)** after device validation.
5. **Selected-state fill (§5.3, XS-26):** flat oxide vs gradient.
6. **Status vocabulary (XS-11, XS-22, STD-04):** one unknown treatment, cause
   icons for notices, provisional weight.
7. **Section-heading levels (§5.9, XS-29; CIR-06).**
8. **Team-colour contrast rule (XS-25).**
9. **Media-slot policy (EXP-04, XS-15, CR-02, EXP-01 difference 5)**, ideally
   with licensed media in hand.
10. **Units (XS-12)** and **row affordances (GPD-04)**.
11. **Light theme approach (XS-01, §9).**
12. Per-screen pending differences remain separate decisions: EXP-01,
    DRV-01, TEAM-01, CIR-01, SETT-01, SETT-10, GPD-02, PD-02.

## 8. Reducing duplicated CSS (Proposal)

Current duplication: `primer-core.css` ×8 (identical), detail app bar ×4
identical + 2 variants, chip additions ×4 (GP, Driver, Team, Circuit),
`.notice` / `.empty` / `.btn` / `.seg` / skeleton copied between Standings,
Explore and the detail screens, Home's tokens in its own file. Hard-coded
colours outside tokens: `#B04633` (4 files), `#1B1D20` (Calendar), several
`rgba()` Chalk/black alphas.

Proposed structure for the next prototype pass (only after approval; nothing
moved now):

```
primer-v2/system/
  tokens.css        primitives + semantic roles (dark), light role map (draft)
  base.css          reset, type, focus, selection, icons, reduced motion
  components/
    nav.css  app-bar.css  detail-bar.css  selector.css  option-list.css
    row.css  chip.css  notice.css  fact.css  states.css  snackbar.css
    livery-cut.css  team-accent.css  media-slot.css
  nav-inset.js  title-fit.js  header-budget.js
```

Each screen then keeps only its compositions (banners, figures, rows'
content). Migration order: tokens → base → detail bar and nav → row/chip/
notice/states → per-screen cleanup, re-running each folder's existing
validation scripts after every step so the approved screenshots stay
pixel-comparable. The reviewed validation folders stay untouched as evidence.

## 9. Light-theme strategy (Proposal)

Primer V2 is dark-first and no light design exists (XS-01). Flutter ships
System / Light / Dark, so a light theme is required before release.

1. Remap **roles**, not hues (§2.2). Candidate light roles: ground = Chalk
   family (`#ECEAE5`; a lighter companion to be chosen and measured), text = graphite, secondary ≥ 4.5:1
   (`#4F525A` is 6.50:1 on Chalk), brand surface = oxide (Chalk on oxide
   5.43:1 already passes), accent text = oxide on light (5.43:1) instead of
   Ember (Ember fails on light), hairlines = ink alphas.
2. The inverse plane flips: the Chalk championship band becomes a graphite
   band in light, so each screen keeps one contrasting plane.
3. Team-colour edges re-evaluate against the light ground (dark liveries
   become safe, light ones such as `#FF8000` need the edge).
4. Prototype light on three screens first (Home, Standings, Settings), owner
   review, then the rest.
5. Settings' current preview maps Flutter's `GvColorsLight`; it stays a
   labelled stand-in and must not be read as the design.

## 10. HTML/CSS → Flutter mapping (Proposal)

| Prototype pattern | Flutter today | Proposal |
|---|---|---|
| Tokens | `GvColors`, `GvColorsLight`, `GvSpacing`, `GvRadii`, `GvTypography` (no family) | Rewrite values to Primer roles; add `ThemeExtension` for brand/inverse/team roles |
| Archivo width axis | — | Bundled variable font; `FontVariation('wdth', …)` text styles; fallback = static condensed cut |
| Bottom nav (adaptive) | `GvBottomNav` | Restyle; add condensed/stacked modes and the selected-label fallback |
| Primary / detail app bar | `GvAppBar` (single line) | Title that wraps, narrows, last-resort scales; header-budget `SliverAppBar` behaviour |
| Selector | `GvSegmentedControl` (fails 4.5:1, §4.11) | Primer selector: oxide slab + Chalk weight change, `selected` semantics |
| Option list | `GvSettingsOption` (radio glyph + "Selected" suffix) | 12° mark, `checked` only, no suffix (SETT-07) |
| Row + chevron / external | `GvSettingsRow`, `GvDriverRow`, `GvTeamRow`, `GvCircuitRow`, `GvStandingsRow`, `GvResultRow`, `GvSessionRow` | Shared row scaffold with an affordance slot (chevron / open-in-new / mail); feature rows keep their content |
| Fact row | `GvSettingsField`, info cards | `GvFactRow` (label above value, omits empty) |
| Status chip | `GvStatusChip` (dot + label) | Primer chip set (outline / dashed / filled Chalk / Ember live) |
| Notice | `GvOfflineNotice` | `GvNotice` with cause icon (XS-22) |
| Empty / error / skeleton | `GvEmptyState`, `GvErrorState`, `GvSkeletonBlock` | Restyle; skeleton shapes per screen |
| Cards | `GvInfoCard`, `GvContentCard`, `GvHeroCard`, `GvDataCard` | Retire as page structure; keep only where a composition is a card by design (Home hero panel) |
| 12° cut | — | `GvLiveryCut` clipper / painter (height-derived) |
| Team accent | `GvTeamAccent` | Add the < 3:1 edge rule |
| Media slot | `GvRemoteImage`, `GvImagePlaceholder`, `MediaSlotPolicy` | Keep the state model; add the collection-level column rule once EXP-04 is decided |
| Snackbar | Material `SnackBar` | Themed Chalk snackbar with seam |
| Screen compositions (banners, figures, classification, dimension line) | Feature widgets | Stay feature code built from tokens |

`docs/technical/GridView_Design_System.md` §6 rules still apply: shared
widgets stay data-agnostic; no literals in widgets.

## 11. Ordered preparation plan (Proposal)

1. **Owner decisions 1–3 of §7** (foundation, reading order, titles). Nothing
   below starts without them.
2. **Close the review gaps that change design input:** EXP-06, CIR-03,
   SETT-17, the refinement inspections (DRV-02, DRV-03, TEAM-02, TEAM-03).
3. **Token sheet** (`system/tokens.css`) built from `primer-core.css` values
   plus the role names; no visual change, verified by re-running every
   folder's captures and comparing to the reviewed screenshots.
4. **Shared components in the prototypes** (§8), one at a time, each with its
   folder's validation re-run.
5. **Remaining drift decisions** (§7 items 4–10) applied in the shared
   components.
6. **Light-theme prototype** on three screens (§9), owner review.
7. **Implementation delta register** (XS-18) completed per screen.
8. **Flutter preparation plan** (separate step): tokens and font first, then
   app bars and navigation, then rows/chips/notices, then screens; goldens
   regenerated deliberately; TalkBack and device validation (XS-02, XS-05,
   XS-16) after the first implemented screens.

## 12. Not decided or closed by this document

All backlog items stay open, including every P0 (XS-03, XS-04, XS-18,
XS-28, EXP-01, GPD-02, DRV-01, TEAM-01, CIR-01, SETT-01, SETT-10),
licensing (SETT-18, SETT-20), accessibility (XS-02, SETT-02, SETT-11) and
device work (XS-05, XS-16). The information screens are not production-ready.
