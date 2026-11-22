# Primer V2: screen titles, large-text header and section headings (Step 48A)

**Status: decision preparation, 2026-11-10, at `e3e9f88`.** Nothing here is
approved, applied or closed. Scope is limited to XS-07 (titles), XS-06
(large-text header) and XS-29 (section headings). `DESIGN-DECISIONS.md` and
`DESIGN-BACKLOG.md` stay authoritative. No prototype, pilot, shared file,
Flutter file or backlog status was changed to write this document.

**Owner review (2026-11-10, Step 48B).**
- The three title variants (§1) and the section-heading taxonomy (§3) are
  accepted as the direction for further refinement. They are **not**
  formally approved for Flutter implementation.
- No visual section-heading restyle is needed. XS-29 stays open: editorial
  titles shared, group labels one semantic role, composition labels
  screen-specific, identity headings not generic.
- The only change authorised for experimentation is Calendar's title at
  320 @200%. See `cross-screen-refinement/calendar-title-fit/REPORT.md`,
  which also covers the owner's sticky-header direction for Calendar
  (season persistent, notices scroll, no whole-header release at 25%).

**Owner review (2026-11-10, Step 48C).**
- The 34px adaptive Calendar title (Step 48B, English and Spanish at
  320 @200%) is **visually approved for the experimental design direction**
  (`DESIGN-DECISIONS.md` CT-01). This is a prototype approval, not a
  Flutter approval: Android and TalkBack validation are pending, and XS-07
  stays open.
- The shared `shared/title-fit.js` is retained.
- The sticky-header split is under experiment, starting from that variant:
  `cross-screen-refinement/calendar-sticky-split/REPORT.md`. XS-06 stays
  open.
- Step 48D: the split is provisionally visually approved as the preferred
  direction (CT-02, prototype only). Open owner decisions:
  `calendar-sticky-split/DECISIONS-48D.md` §6.
- Step 48F (2026-11-11): **Stage 1** (`cross-screen-refinement/calendar-stage1/`)
  is provisionally approved as the preferred Calendar visual and interaction
  direction (CT-03): the title row and season row stay pinned, the caption
  and notices scroll with the content, and there is no dynamic title
  release. Stage 2 (`calendar-sticky-split/`, title release) is kept as a
  historical alternative. Prototype approval only: not production-ready,
  not promoted into `calendar/`; Android, TalkBack and Flutter validation,
  XS-06 and XS-07 stay open.

**Basis.** `CORE-DESIGN-DECISIONS.md` §3, `DESIGN-SYSTEM-CONSOLIDATION.md`
§5.1, §5.2, §5.9, `consolidation-pilot/CONSOLIDATION-SUMMARY.md` §5. The rules
come from the pilot stylesheets and scripts (identical to the approved
references: 0 differing pixels). The measurements come from the latest
recheck `results.json` files and the screen READMEs. All evidence is Chrome
emulation. Values marked *est.* are worked out from CSS and captured gaps, and
were not measured.

**Summary**

- **One visible change is needed:** Calendar's title at 320 @200% (§5).
- **Section headings already follow a coherent set.** XS-29 needs a rule,
  not a restyle.
- **Keep the 25% threshold as a provisional heuristic.** It should be
  measured against the usable height (§2).

---

## 1. Screen titles: three variants

| | **A. Main navigation** | **B. Detail** | **C. Settings and information** |
|---|---|---|---|
| Screens | Home, Calendar, Standings, Explore | Grand Prix, Driver, Team, Circuit | Settings root, its three preferences, the four information screens |
| Structure | Title (Home: wordmark) + season row; Refresh / Settings, 48dp | Back (48dp) + compact title; full name in the content heading (`h1`) | Back (48dp) + title; the title **is** the page `h1` |
| Type | 24px, capped at 34px, 800, `wdth` 118 | 18px, capped at 26px, 800, `wdth` 88 | 21px, uncapped, 800, `wdth` 88, `text-wrap: balance` |
| Lines | One line | One line | Targets: 2 lines normally, 3 at 200%. These are not limits: a longer title keeps wrapping |
| Fit order | Width axis 118 → 100 → 84 → 72, then scale a single word to its column (S-2) | Ellipsis, at a fixed width | Wrap between words; a single word that does not fit narrows 88 → 76 → 66 → 62, then scales (S-2) |
| Ellipsis | Never | Bar only, while the route holds the full heading | Never |
| Pinning | Home scrolls. Calendar is sticky. Standings and Explore are pinned, under the header budget (§2) | Bar pinned (57px; never near the budget) | Chrome pinned (bar + DEV/STAGING strip) |
| Accessible title | `h1`, full text | One heading: the content `h1`. The bar text names the route and is not a second heading | `h1`, full text |

**Clarifications to `CORE-DESIGN-DECISIONS.md` §3**, from the inspection:

1. **B, "on the same screen" means on the same route.** That is, reachable
   by scrolling up and by heading navigation, not visible in the viewport.
   Once the banner scrolls away, the ellipsized bar is the only visible name.
   That is acceptable, because the `h1` is one heading jump away.
2. **B keeps the event name in the GP bar** (Flutter `grandPrixScreenTitle()`
   parity). It gives context after the banner scrolls away. Driver, Team and
   Circuit show the entity type ("Driver" / "Piloto", and so on), so they
   never truncate and never repeat the `h1`.
3. **Step 44 stress evidence** (`consolidation-pilot/grand-prix-detail/REPORT.md` §3):
   - "Barcelona-Catalunya Grand Prix" ellipsizes at 390 @200%, 320 @100% and
     320 @200%. "United States Grand Prix" ellipsizes at 320 @200% only. The
     approved fixtures never truncate.
   - In every frame, the full name stays in the `h1` (it wraps at the real
     hyphen), in the bar text and in the accessibility tree. Back stays 48×48
     and the bar stays 57px.
   - **Conclusion:** B's ellipsis loses no information. No narrowing step is
     recommended for the bar.
4. **Duplicate announcement exists only in GP.** The bar `<p>` and the `h1`
   both read "Belgian Grand Prix" in linear TalkBack order. It is not a
   second heading, since the bar is not a header. **Recommendation:** in
   Flutter, keep the bar title as the route name (announced on entry) and
   keep it out of the linear reading order, so that the `h1` is read once.
   This is a semantics change with no visual effect, and TalkBack must
   confirm it (§6).
5. **C, root Settings allows mid-word breaks.** It sets
   `overflow-wrap: break-word`, while the information screens use
   `overflow-wrap: normal` plus the S-2 fit. No root title string overflows
   today. The longest single words, "mostrado" and "Language", are about 150
   of about 246px at 320 @200% (*est.*). **Recommendation:** apply the
   information rule to root Settings as a code alignment. No visible change
   is expected.
6. **Caps.** A (34px) and B (26px) are display caps on chrome titles. In
   B, the uncapped full name sits in the `h1`. C is uncapped, because there
   the title is the only heading. Flutter would need
   `TextScaler.clamp` on the A and B titles, which interacts with Android 14
   non-linear scaling (XS-05).

## 2. Large-text header rule

**Verdict: a provisional implementation heuristic, not a reliable design
rule yet.** Its formulation needs correcting before device validation.

**Rule to keep (design intent, stable).**
- Pinned chrome must not crowd the content.
- When it does, the **title row yields first**, then a second-level
  selector (Explore). The bottom navigation never yields.
- The 48dp targets are never traded away.
- The navigation fallback (XS-08) is unchanged while this is evaluated.

**Trigger (provisional, today).** The rule fires when the pinned top region
is larger than 25% of the viewport height.

### 2.1 What the evidence shows

| Header | Measured | Fires at |
|---|---|---|
| Standings / Explore (app bar + selector) | 82+77px (100%), 104+81px (200%) | 320 @200% (EN, ES). 390 @200% ES, because the selector stacks. Explore second level (selector 185px = 27%) at 320 @200% |
| Calendar sticky block (title, season, caption, notice) | about 92px (390), about 113px (320 @200%) = 16% | **Never**, in the captured default state. The stale and failed notices are **inside** the sticky block, and their height at 320 @200% was not measured |
| Detail bars | 57px; the title is capped | Never |
| Settings root chrome | 114px at 320 @200%, ES, 2-line title = 16% | Never |
| Information chrome (with DEV strip) | 167px at 320 @200%, ES, 2-line title = 24% | Never, but within 1% |
| Home | Scrolls with the content | Not applicable |

### 2.2 Why 25% is not yet a reliable rule

1. **The denominator is not defined.** `standings.js` and `explore.js`
   divide by `window.innerHeight`, which emulation measured with zero
   system insets.
   - On a device, the status bar, the display cutout and gesture or
     3-button navigation take about 50–100dp.
   - Information chrome at 167px goes from 24% to about 27% of a 620dp
     usable height, so it would release. In production it has no DEV strip,
     about 121px (*est.*), so it would not.
   - Standings EN 390 @200% (185 of 844 = 22%) moves to about 24% (*est.*).
   - **Device insets alone can flip outcomes that emulation reported as
     inside the budget.**
2. **It ignores the bottom navigation,** the largest fixed cost at large
   text: 155px stacked = 22% of 693px.
   - A header exactly at 25% plus the stacked nav leaves 53% for content.
   - Settings, which has no nav, is judged by the same number.
3. **Re-evaluation is tied to content.** The prototype re-measures on any
   body resize, such as a selector switch or a notice appearing. Flutter
   should re-evaluate only on layout inputs: size, insets, text scale,
   locale and orientation.

### 2.3 Recommended formulation, to validate

- **Usable height** `H` = viewport height − top inset − bottom system inset.
  Count the DEV/STAGING strip as chrome. Do not subtract the app's own
  bottom navigation.
- **Release the title row** when pinned top chrome is greater than
  `0.25 × H`. **Release the selector** when it alone is greater than
  `0.25 × H` (Explore).
- **Record the content window** `(H − pinned top − nav) / H` on every
  device run, as the acceptance metric. The target is at least 50%. It is
  not a second trigger. Explore's second level releases at 51%, which shows
  that the two measures differ.
- **Decide on layout-input changes only.** No hysteresis is needed if the
  title row's height does not depend on the mode (true in the prototypes).
- **Release by scrolling the row away, never by a jump.** After a mode
  change while scrolled, keep the focused or anchored item visible, so that
  a re-pinned header cannot cover it.
- **Spanish triggers earlier** (stacked selector at 390 @200%, scaled
  "Clasificaciones"). Every device run covers EN and ES.

**Not to be applied silently elsewhere.** The formulation changes nothing in
the emulation evidence, where insets are 0. It stays on Standings and Explore
until the device data exists. For Calendar it raises an owner question
(§7, item 4).

## 3. Semantic section-heading variants

The inspection narrows XS-29. **Calendar and Standings have no section
headings.** Their only heading is the `h1`. Their "kickers" (`.ev__kicker`
"Next", `.st__kicker` "Championship leader") are in-row `<span>`s, not `h2`s.
The real `h2` difference is the 13px group label beside the 20px title. On
one screen, it appears only in Circuit.

| Variant | Typography | Spacing | Colour, divider | Use |
|---|---|---|---|---|
| **1. Editorial section title** (`.section-title`, shared) | 20px, capped at 30px; 700; `wdth` 106; −0.01em; line-height 1.2 | 32px between sections (Home column gap, detail `.sec` margin); gutter-aligned; 12–14px to content. Optional trailing status (Home "Final" chip, GP `.sec__head`): flex-wrap, gap 8 / 12 | `text.primary`; no divider | Top-level sections of content screens: Home (4), GP (2), Driver (4), Team (4), Circuit (Lap record, This season's Grand Prix) |
| **2. Group label** (`.kicker`, `.ch__kicker`, GP `.day__label`) | 13px, uncapped; 700; `wdth` 100; line-height 1.25. GP day label: 14px | 4–6px to the first row; groups 28px apart (row lists) or 32px (long-form) | `text.secondary` (7.95:1) + trailing `line.subtle` hairline; a dashed `line.strong` rule for the Developer group | Groups of rows or fields on utility and information screens (Settings, Acknowledgements, Privacy), and a group **inside a composition** (Circuit sheet facts, as `h2`; GP schedule days, as `h3`) |
| **3. Composition label** (screen-specific; not a section heading) | 13–15px; 600–700; normal width | Inside its composition | Colour by surface: Ember for live, next or winner; Red Oxide on Chalk; `text.secondary` or `on-chalk-2`. **No trailing rule** | Home `hero__kind`, `leader__label` (`h2`s labelling a composition), `hero__round-label`; Calendar "Next"; Standings leader; GP "Circuit", "Winner" |
| **Identity headings** (excluded) | Display names | — | — | Detail `h1`s, Home `hero__name` / `result__event`, Acknowledgements `source__name`. Never flattened into 1 or 2 |

**Selection rule.**
- Page-level sections of an editorial or detail screen use variant 1.
- Groups of rows or fields, and groups inside a composition, use variant 2.
- Sibling sections in the same region never mix 1 and 2.
- The trailing rule marks variant 2 only.

**Hierarchy inversions are intentional.** In two places a small label
heads a larger identity:
- Circuit: "Circuit facts", then the dimension figures;
- Acknowledgements: 13px "Data sources", then the 22px `source__name` `h3`.

Heading levels stay correct (`h2` → `h3`), so TalkBack heading navigation is
unaffected.

## 4. Cross-screen mapping

| Screen / component | Current rule | Canonical | Visible change | Accessibility | Regression risk |
|---|---|---|---|---|---|
| Home app bar | Wordmark, 34px cap, scrolls, no fit | A | **No** (fixed brand word fits) | `h1` "GridView" | None |
| Calendar app bar | Sticky block; `min(1.5rem, 34px, 14cqi)` | A + S-2 fit | **Yes**, 320 @200% only (§5) | Larger title; same name | Low: header about +9px (*est.*) |
| Standings, Explore app bar | Pinned; S-2 fit; budget | A (reference) | No | — | None |
| GP detail bar | Event name, one line, ellipsis, `<p>` | B | No | Duplicate linear reading of the name: fix in semantics | Medium (TalkBack) |
| Driver, Team, Circuit bars | Entity-type label | B | No | No duplication | None |
| Settings root bar | `h1`, 21px, wraps, `break-word` | C + S-2 fit | No (code alignment) | Prevents a future mid-word break | Low |
| Information bars | `h1`, 21px, wraps, S-2 fit | C (reference) | No | — | None |
| Header budget, Standings / Explore | 25% of `innerHeight` | §2.3 formulation | No in emulation; possible on devices | Content window gains | Medium (devices) |
| Header budget, Calendar / Settings / information | Not applied | Owner decision (§7, item 4) | No | — | — |
| Section titles: Home, GP, Driver, Team, Circuit | Shared `.section-title` | 1 | No (already consistent) | `h2` | None |
| Settings and information group headings | `.kicker` `h2` | 2 | No | `h2` | None |
| Circuit "Circuit facts" | `.ch__kicker` `h2` in the sheet | 2 (group in a composition) | No: CIR-06 hierarchy point resolved by rule | `h2` kept (CR-01 condition) | None |
| GP schedule day labels | `.day__label` `h3`, 14px | 2 (nested) | No; 14 vs 13 is a "merge only after comparison" candidate, not proposed | `h3` | None |
| Calendar, Standings, GP, Home in-composition labels | Per screen | 3 | No | Home's two are `h2`s; keep | None |

**Leave alone:** the shared `.section-title`; the Settings and information
group labels; every composition label; every identity heading; the B bars
for Driver, Team and Circuit; the Standings and Explore title fit; the C
title size and wrapping.

## 5. Exact visible changes

**Only change proposed: Calendar title fit, 320×693 @200%, EN and ES.** At
320dp the brand column is about 184px, so `14cqi` ≈ 25.8px, below the 34px
cap that Standings reaches.

- **EN "Calendar":** about 25.8 → 34px at `wdth` 118, still one line, with
  the gap to the actions about 60 → 20px (*est.*, from the captured
  `titleGap` 59.5).
- **ES "Calendario":** about 25.8 → 34px, and narrows to about `wdth` 100
  (*est.*, from the captured gap 33.6).
- **Unchanged:** 390 @100/200% and 320 @100%, where the cap does not bind
  (captured gaps 44–139px).
- **Sticky block:** about 113 → 122px (*est.*), still below 25%.

**Conditional changes**, appearing only if the owner approves §7 item 4 and
a device run triggers them:
- Calendar's header scrolling away at 320 @200% with a notice showing;
- information chrome releasing on development builds.

**No visible change:** the GP semantics fix and the root-Settings S-2
alignment.

## 6. Risks and unresolved device checks

- **Insets:**
  - a 320dp-class device (or emulator) and a 390–412dp device, at 100% and
    200%, with gesture and with 3-button navigation, EN and ES;
  - record `H`, the pinned top height, the nav height and the content
    window (XS-06, XS-16).
- **Android 14 non-linear scaling:** large text grows less than 2× (XS-05).
  Emulated 200% overstates title and heading heights, and understates
  nothing, so the evidence is conservative for headers.
- **Calendar notice states:** the sticky block's height at 320 @200% with
  the stale or failed notice. Not measured; probably over 25%.
- **Scroll stability:**
  - change text scale or orientation while scrolled with the budget active;
  - the focused row stays visible;
  - there is no jump when the row is released or restored.
- **TalkBack:**
  - GP bar plus `h1` read once;
  - Settings and information `h1` in the bar read once (today Privacy and
    legal repeats its title, Accessibility §4.4);
  - heading navigation across Home's composition `h2`s and Circuit's
    group `h2` (`CORE` §2.6, item 7).
- **Flutter cost:** A and C need a measured, growing header (`SliverAppBar`
  or `SliverPersistentHeader` with `TextPainter` at the current
  `TextScaler`). B maps to the Material `AppBar`. Width-axis fit depends on
  bundling Archivo (XS-28, SETT-09).

## 7. Decisions requiring owner approval

1. **The three title variants in §1, with clarifications 1–6.** In
   particular: the B ellipsis condition means the same route; the GP bar
   keeps the event name; the GP bar title is kept out of linear reading.
2. **Calendar adopts the S-2 title fit** in place of `14cqi`. This is the
   one visible change. Test it in the pilot first (§8, step 1).
3. **The header threshold is a provisional heuristic** with the §2.3
   formulation (usable height, layout-input re-evaluation, content-window
   metric). It stays on Standings and Explore until the device data exists.
4. **Calendar under the budget:** if a notice makes the sticky block exceed
   the budget, the whole block, including the season, would scroll away.
   This departs from Flutter's always-visible season (C01). Should the
   notice stay pinned, scroll, or should the season yield?
5. **The section-heading set in §3** (variants 1–3, selection rule,
   identity headings excluded). With it, the CIR-06 hierarchy point is
   resolved by rule, with no visual change.
6. **A backlog wording correction, not made here:** XS-29's "Calendar and
   Standings kickers" are in-row labels, not `h2`s.
7. **Root Settings adopts the S-2 title fit** (no visible change).

## 8. Implementation and regression sequence (after approval)

Each step runs in the pilots only, then re-runs **every** pilot against its
approved reference with a control. Earlier evidence is never overwritten,
and unexpected differences must be 0.

1. **Shared title fit.**
   - Extract `fitTitle` from `standings.js` and `explore.js` into
     `shared/title-fit.js`. Expected: 0 differences in all 11 pilots.
   - Then switch the Calendar pilot to it and drop the `14cqi` rule.
     Expected differences: only the header of the 320 @200% EN and ES
     captures (default, refreshing, stale, failed, focus).
   - Log `titleGap` and the header height.
2. **Owner review** of those Calendar captures. Stop if rejected.
3. **Root Settings S-2 alignment** in the Settings pilot. Expected: 0
   differences across root and preferences (441 pairs).
4. **Group label to `shared/`,** only after decision 5. The spacing stays a
   local extension. Expected: 0 differences in Settings, information and
   Circuit. The GP day label stays local.
5. **Measurement probe, no behaviour change:**
   - the pinned top height, `H` and the content window, in the Calendar,
     Settings and information captures;
   - including Calendar's stale and failed states at 320 @200%.
   - This resolves decision 4 with numbers.
6. **Device pass** (§6) on an implementation or a device-hosted build,
   recording which one.
7. **Flutter:** only after explicit authorisation; goldens regenerated
   deliberately.
