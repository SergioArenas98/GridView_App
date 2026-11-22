# Primer V2: core design-system decisions for owner review

**Status: refined proposals, 2026-11-08 (Step 38B).** The owner accepted the
general direction of all three for further consolidation. **This is not final
approval:** none of the policies is approved, and XS-28, XS-03, XS-04, XS-07
and XS-06 stay open. The decision log ([`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md))
and backlog ([`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md)) remain authoritative.
Current Flutter behaviour is preserved until implementation is explicitly
authorised. Background: [`DESIGN-SYSTEM-CONSOLIDATION.md`](DESIGN-SYSTEM-CONSOLIDATION.md).

Each policy below has the same six parts: principle, conditions, exceptions,
implementation risks, verification still required, owner approval remaining.

---

## 1. Primer V2 as the Flutter visual reference (XS-28)

### 1.1 Recommended principle

Primer V2 is the intended Flutter visual reference: its **semantic colour
roles**, **Archivo** typography, **radii 8 / 14 / 20 / pill**, the **12°
visual language** (an edge 12° from vertical, run = `tan(12°) × height`), and
a **16dp content-alignment reference** with intentional edge-to-edge surfaces.
It is reproduced with native Flutter equivalents for visual fidelity, not by
translating CSS. Offline-first behaviour is preserved: nothing is fetched at
runtime.

Spacing, precisely: text, figures and headings align to 16dp; full-bleed
surfaces are deliberate (tray bands, the Chalk band, the Standings leader
strip, detail banners, row press fills, Explore B's 16dp accent lane);
alignment rails (Calendar round column, Standings position column, GP rail)
are columns inside the inset, not paddings. No screen is forced onto one
global padding value.

### 1.2 Conditions

**A. Typography variations: no reduction without a visual check.** The
prototypes use 14 weights and 21 widths. Classified by role (selectors
traced in every approved stylesheet):

| Class | Weights | Widths | Basis |
|---|---|---|---|
| **Essential: role steps** | 400 reading text · 500 season and secondary values · 600 labels, chips, body emphasis (29 uses) · 700 section titles, kickers, links (50) · 750 names in rows (15) · 800 titles, selected labels, figures (47) · 850 hero figures and leader points (8) | Figures 106, 112, 118, 125 · names 78 (display names: hero, plate, GP), 88 (titles, row names) · normal 100 | Used across several screens for one role |
| **Essential: approved behaviours** | 550 → 800 Settings option label (the weight change is a selection cue, SP-01 aspect 5) | Fit sequences: 118 / 100 / 84 / 72 (S-2 titles), 92 / 76 / 66 (Settings values), 88 / 76 / 66 / 62 (information titles), 72 and 62 (nav and selector fallbacks, S-3), 70 and 78 (Settings narrow rules) · 94 (Explore B names, EX-02) | Part of an approved rule or reference |
| **Probably redundant: merge only after visual comparison** | 650 (9 uses: GP/Driver/Circuit fact values; between 600 and 700) · 760, 780, 820, 830 (1–3 uses each, Circuit and Team name tuning) · 900 (Home "22" watermark outline) | 82, 84, 86, 90 (a 82–90 cluster of name widths) · 116 (Circuit dimension number, one use) · 80 (Home latest-result event name) · 96 (empty-state titles, unavailable names) | One screen or one element; near a role step |
| **Prototype chrome only** | — | 80 and 62 on gallery captions; 96 gallery title | Not app UI |

Proposal: keep every essential value; compare each "probably redundant" value
against its nearest step on the reviewed screenshots before merging. No
reduction is proposed without that comparison.

**B. Licence, verified in the actual files.** Inspected 2026-11-08 from the
Google Fonts repository (`google/fonts`, `ofl/archivo/`), files downloaded to
a scratch folder for reading only (not added to the project):

| Item | Finding |
|---|---|
| `OFL.txt` | "Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)" · "licensed under the SIL Open Font License, Version 1.1" · **no Reserved Font Name declared** (the header names none) |
| `Archivo[wdth,wght].ttf` (658,596 bytes) | `name` 0 (copyright) as above · `name` 13: "This Font Software is licensed under the SIL Open Font License, Version 1.1" · `name` 5: Version 2.001 · `OS/2 fsType` 0 (installable embedding) · 834 glyphs · 9 named instances |
| Axes (`fvar`) | `wght` 100–900 (default 600) · `wdth` 62–125 (default 100). Matches the range every prototype loads |
| `METADATA.pb` | `license: "OFL"`, designer Omnibus-Type |

Consequences under OFL 1.1: bundling in the app, including a commercial
release, is permitted. The copyright notice and licence must accompany the
distribution, the font may not be sold by itself, and because no Reserved
Font Name is declared, a subset may keep the name (keeping the notice). The
italic file (741,368 bytes) is not needed: no prototype uses italics. **Still
to do at implementation:** re-check the exact file version bundled, and decide
where the licence is shown (the app has no licence page; `LicenseRegistry`
plus a reachable licence view is one option).

**C. Variable-font support, checked against this project's SDK.** The project
pins **Flutter 3.44.0** (`.fvmrc`; CI reads the same version; Dart 3.12.0).
In that SDK (`dart:ui` and `painting/text_style.dart`):
- `TextStyle.fontVariations: List<FontVariation>` exists; `FontVariation.width`
  (`wdth`) and `FontVariation.weight` (`wght`) are named constructors.
- `FontWeight` accepts **arbitrary values** (1–1000). For a variable font it
  "will set the value of the `wght` axis", and the SDK docs say to prefer
  `FontWeight` over `FontVariation.weight`. **Correction to the previous
  version of this document**, which advised not to rely on `FontWeight`
  alone.
- Width has no `FontWeight`-like shortcut: each style sets
  `FontVariation.width(88)` and so on.
- Fonts are rendered by Flutter's own engine, so Android's system font APIs
  are not involved (default `minSdk` 24 in this SDK).
- Not yet verified on a device: rendering of every axis value, performance,
  `lerp` between styles during theme animation.

**D. No theme replacement until dark and light both exist.** Theme selection
(System / Dark / Light, preference `AppThemePreference`) is a functional
requirement. Flutter's current theme is replaced only when Primer V2 roles are
defined and approved for **both** appearances (XS-01). No interim mixing of a
Primer dark theme with the current light palette.

### 1.3 Exceptions

- Screen compositions (banners, number board, Chalk band, dimension line,
  watermark) stay feature widgets built from tokens.
- Cards remain only where a composition is a card by design (Home hero
  panel).
- The uncatalogued gradient start `#B04633` is not adopted until XS-26 is
  decided.

### 1.4 Implementation risks

- Large golden churn when the theme switches; best done in one deliberate
  step once both appearances exist.
- About 0.64 MB added for the roman variable font (before any subsetting).
- Native equivalents with no direct CSS counterpart: container queries in em
  (`LayoutBuilder` + `TextScaler`), dashed outlines (`CustomPainter`), the
  12° cut (`CustomClipper`; skewing interactive widgets would skew hit areas),
  `text-wrap: balance/pretty` (no equivalent), `min()` figure caps
  (`TextScaler.clamp`, interacts with Android 14 non-linear scaling, XS-05).
- `ThemeExtension`s are needed for roles `ColorScheme` lacks (brand surface,
  inverse, team edge).

### 1.5 Verification still required

Owner visual comparison for each "probably redundant" variation; device check
of axis rendering and performance; APK size measurement; light-theme design
and contrast (XS-01); OLED legibility (XS-16).

### 1.6 Owner approval remaining

> Approve Primer V2 (roles, Archivo, radii, the 12° language, 16dp content
> alignment with intentional edge-to-edge surfaces) as the Flutter visual
> reference, built natively and offline, **on conditions A–D**: keep essential
> typography variations and merge others only after visual comparison;
> bundle Archivo under OFL 1.1 with its notice; use `FontWeight` for weight
> and `FontVariation.width` for width; and replace the theme only when dark
> and light are both designed and approved. Separately decide where the font
> licence is shown.

---

## 2. Accessibility reading order (XS-03, XS-04)

### 2.1 Recommended principle

**Component-specific logical reading order**, not one concatenation template.
Every meaningful visible fact is accessible, but not necessarily in one label:
it may be in the accessible name, a description, or a reachable semantic
child. One action has one focus target. Decoration is silent. State comes
from semantic flags. Nothing is announced twice.

Where each kind of information goes:

| Channel (Flutter) | Holds | Rule |
|---|---|---|
| **Name** (`label`) of an actionable row | What identifies the destination plus the few facts needed to choose it | Concise; in the component order below |
| **Value** (`value`) | A current value of a control (Settings row's current theme) | Not repeated in the label |
| **Description** (`hint`) | Supplementary visible text not needed to decide (an option's explanation) | Never the only place for essential facts: TalkBack users can turn hints off |
| **Reachable children** | Facts that are content, not part of an action (detail facts, sections, headings) | Traversable in reading order; not merged into a parent action |
| **Flags** | `selected`, `checked`, `inMutuallyExclusiveGroup`, `header`, `button`, `link` | No spoken words that duplicate a flag ("Selected") |
| **Silent** | 12° slabs, seams, ticks, marks; team colour; chevrons and open-in-new glyphs; the Home "22" watermark; rotate glyph and dimension-line arms; separators | A number is silent only when the same value is already spoken |

**Starting points per component** (not rigid templates):

| Component | Logical order |
|---|---|
| Calendar event row | Round → event identity (name, circuit) → status → relevant details (dates) |
| Standings row | Position → competitor (name, team) → points → other results (wins, leader, provisional) |
| Explore row | Entity name and identity → relevant facts (team or location, standing, number, length) |
| GP sessions | Day (group heading) → time → session name → status |
| GP results | Position → driver → team → result details (status, points, timing, winner, fastest lap) |
| Driver / Team / Circuit detail | Heading, then the season line it qualifies, then sections and fields in their meaningful order |
| Settings | Option or row name → current value → selection state by flag |

**Focus targets.** A row is one target. A second target exists only for a
genuinely different destination (GP result row → driver; in-row team link →
team, G-8). The two are siblings, never nested; the row's name does not
mention the other action.

### 2.2 Examples from existing fixtures (proposed wording; not implemented)

Existing ARB strings only (`roundLabel`, `standingsPositionSemantics`,
`standingsPointsSemantics`, status labels, `standingsLeaderSemantics`).

| Row (fixture) | Proposed | Flutter today |
|---|---|---|
| Calendar, Abu Dhabi GP (frozen staging H04–H10) | Name: "Round 23, Abu Dhabi Grand Prix, Yas Marina Circuit, Status unknown", followed by the dates; button | "Abu Dhabi Grand Prix, round 23, Status unknown, …" |
| Standings, drivers' leader (H23–H25) | "Position 1, Lando Norris, McLaren, 120 points, Championship leader"; button | Same order today |
| Explore driver, Colapinto (`seasonDriverCardsFixture`: team "BWT Alpine Formula One Team", 43, COL, points 0, position null) | Name: "Franco Colapinto, BWT Alpine Formula One Team"; then the visible facts (race number 43, COL, 0 points); no position, because none is shown | "Franco Colapinto, BWT Alpine Formula One Team, …" (number and code omitted, EXP-01 difference 4) |
| GP session, Race (H16–H18) | Heading "Mon Nov 9"; row: "17:00 GMT, Race, Status unknown" | Name → day · status → time |
| GP result, Qatar winner (H35–H38) | Row: "Position 1, Lando Norris, McLaren, Winner" (+ points or timing when supplied); separate link "Open team McLaren" | Bare "1, Lando Norris, McLaren, …"; no Winner |
| Settings Theme option | Radio "Dark", checked (state from the flag; position in group from the platform) | "Dark, Selected" + checked (double, Accessibility §4.1) |
| Settings root row | Button "Theme", value "Dark" | "Theme, Dark" in one label (same spoken result) |

### 2.3 Conditions

- Current Flutter labels stay until implementation is authorised; each
  change updates the existing widget tests deliberately.
- Labels reuse existing ARB strings; new spoken wording needs owner and
  translator review.
- TalkBack validation is mandatory before adoption (§2.6).

### 2.4 Exceptions

- The season line is read after the heading although it sits above the name
  visually (DR-02, TM-02), so heading navigation lands on the name.
- Notices and snackbars are polite live regions, not part of row names.
- API free text is announced as delivered (XS-23); English provider text on
  Spanish screens carries an English locale where the platform supports it
  (`attributedLabel` with `LocaleStringAttribute`, to verify).

### 2.5 Implementation risks

- Splitting facts between name and children changes `Semantics` structure
  that `ExcludeSemantics` currently flattens; rows must stay one focus target.
- Sibling row + link needs care so `MergeSemantics` does not swallow the
  link (GPD-05).
- Moving Settings values to `value` changes how some screen readers phrase
  them; it must not regress the "label, value" reading.

### 2.6 Verification still required (TalkBack, device)

1. Calendar round-first and GP time-first orders against today's name-first.
2. Verbosity of GP result and Explore rows.
3. Whether `hint` descriptions are heard with usage hints off.
4. Sibling row + team link: focus order, hit areas (GPD-05).
5. Season line after heading with heading navigation.
6. Radio group: one state announcement; keyboard and D-pad (SETT-02).
7. Duplicate title announcements (Accessibility §4.3, §4.4; topic 3).
8. Locale switching for English spans in Spanish.

### 2.7 Owner approval remaining

> Approve the component-specific reading orders in §2.1 as the design
> reference; the channel rules (concise names, values, non-essential
> descriptions, reachable children, flags instead of words, silent
> decoration); one focus target per action, with sibling targets only for
> different destinations. Approve the two order changes from today's Flutter
> (Calendar round first; GP sessions time first) **only after** the TalkBack
> checks in §2.6.

---

## 3. Screen titles (XS-07)

### 3.1 Recommended principle

Three variants. Titles are never clipped and stay fully accessible; reading
text is never shrunk. The only size reduction is the last resort for a single
word that still does not fit after the width axis reaches its floor (S-2).
Back, Refresh and Settings keep 48dp targets; the title takes the remaining
width.

| | **A. Main navigation** (Home, Calendar, Standings, Explore) | **B. Detail** (GP, Driver, Team, Circuit) | **C. Settings and information** |
|---|---|---|---|
| Structure | Title (Home: wordmark) + season context; Refresh / Settings | Contextual app bar (Back + short title) **plus** the full content heading | Back + title; the title is the page heading |
| Lines | One line target; single-word titles narrow (118 → 100 → 84 → 72), last-resort scale | App bar one line; content heading wraps as needed | **Targets:** two lines normally, three at 200% text; not clipping limits: a longer title keeps wrapping |
| 320dp / 390dp / 200% | Narrow first at 320 and 200%; never ellipsis | App bar may ellipsize; content heading wraps and narrows, never truncated | Wraps; single long word narrows 88 → 62, then last-resort scale |
| Fixed or scrolls | Pinned, unless the proposed header threshold releases the app-bar row (below) | App bar pinned; heading scrolls with content | Pinned, same threshold |
| Visual ellipsis | Never | **Only in the app bar, and only while the full heading is on the same screen** | Never |
| Accessible title | Full text, header | One screen heading (the content heading, full text); the app-bar title names the route with full text, not exposed as a second heading | Full text, header |

**Header threshold (proposed, not a requirement):** when pinned chrome would
exceed about 25% of the usable viewport, the app-bar row scrolls away and
only selectors stay pinned (S-1, XS-06). The 25% figure is a starting point to
validate against Flutter's real constraints:
- "Usable viewport" = height minus system insets (status bar, display
  cutout, gesture or button navigation), with the DEV/STAGING strip counted
  as chrome.
- Decide pinning on layout changes (size, text scale, orientation), never
  mid-scroll.
- Release the row by scrolling it away with the content, never by a jump;
  keep the scroll position anchored when text scale or orientation changes.
- Never trade away the 48dp targets to meet the threshold.

### 3.2 Conditions

- Variant B ellipsis requires the full contextual heading to be present on
  the same screen (it is, in every approved detail banner). If a detail
  layout lacks a full heading, B falls back to C rules.
- The same title is not announced twice (§3.5).
- Width-axis narrowing depends on topic 1 (Archivo variable). Without it the
  order is wrap → last-resort scale.

### 3.3 Exceptions

- Home keeps its wordmark composition; variant A governs fit and actions.
- Unresolved names use the existing fallback (`grandPrixScreenTitle()`,
  V-01); the hero blank-name gap stays GPD-03.

### 3.4 Implementation risks

- B is close to today's Material `AppBar` (one line, ellipsis, fixed
  `kToolbarHeight`); A and C need a growing header: `SliverAppBar` with a
  computed height or a `SliverPersistentHeader` measuring the title with
  `TextPainter` at the current `TextScaler`.
- Title measurement on every layout pass (low-end devices).
- Threshold logic must react to insets and text scale without oscillating
  (hysteresis may be needed).

### 3.5 Verification still required

- TalkBack: variant B's route name plus content heading announced once, not
  twice (today Privacy and legal repeats its title, Accessibility §4.4).
- The threshold on real devices at 320dp-class widths, 200% text, with
  gesture and button navigation (XS-06, XS-08, XS-05).
- No scroll jump when the app-bar row is released or restored.
- Worst-case Spanish titles: "Clasificaciones" (A), "Agradecimientos" and
  "Información de la aplicación" (C), validated so far in emulation only.

### 3.6 Owner approval remaining

> Approve the three title variants: A one-line titles that narrow before a
> last-resort single-word scale, never ellipsized; B a one-line contextual
> app bar that may ellipsize only while the full heading is on the screen,
> with that heading wrapping and never truncated; C page-heading titles with
> two-line (normal) and three-line (200%) targets that keep wrapping beyond
> them. Approve the 25% header threshold **as a proposal to validate** on
> devices against real insets and text scaling, applied without scroll jumps
> and never at the cost of 48dp targets.
