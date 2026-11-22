# Primer V2: Explore visual prototype

The fourth Primer V2 screen. Home, Calendar and Standings were not modified.
The Standings review decisions and the timestamp verification are recorded in
`../DESIGN-DECISIONS.md`.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | English / Spanish: Drivers, Teams and Circuits |
| `states.html` / `states.es.html` | **Development-only** state fixtures. Not app UI, not production data |
| `build.py` | Generates the four pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of the shared foundation |
| `explore.css` | Explore additions. Header, notice, selector and empty/error rules are copied from Standings and marked as such |
| `states.css` | Fixture-gallery styles only |
| `nav-inset.js` | Byte-identical copy of Home's adaptive navigation script |
| `explore.js` | Presentation only: category switching, independent offsets, selector fit, title fit, header budget |
| `validation-20261107-233303-final/` | **Current** screenshots, metrics, touch targets, selector behaviour |
| `validation-…-pass1`, `-pass2` | Earlier passes, kept. Pass 2 contains the widened-viewport defect described below |

## Sources read

- `lib/features/explore/presentation/explore_screen.dart`,
  `explore_cards.dart`, `explore_collection_view.dart`
- `lib/features/explore/application/explore_ui_state.dart`
- `lib/features/shared/domain/entities/season_card.dart`
- `lib/core/database/daos/competitor_dao.dart` (roster order, team
  derivation)
- `lib/features/shared/presentation/entity_formatting.dart`
- `lib/core/widgets/gv_rows.dart`, `gv_remote_image.dart`
- `content/media/media-rights.json`
- `test/support/entity_fixtures.dart`, `test/screens/explore_widget_test.dart`
- Audit §2.4, §3.7 (ED01–ED09, ET01–ET07, EC01–EC07) and §5.6
- `lib/l10n/app_en.arb`, `app_es.arb`

## Data: development test fixtures, not staging

No Explore values were confirmed from the staging screenshots.

**Why the staging Standings rows weren't reused.** An Explore driver card comes
from a driver's *season entry*:
- There is one card per season-entry identity.
- The team comes from that entry.
- The roster is ordered by race number, unnumbered last, then name.

Building Explore from the staging rows would assume season entries, teams and
race numbers that nobody confirmed.

**What the pages use instead:** the canonical, internally consistent Explore
read-model fixtures in `test/support/entity_fixtures.dart`. All values are
copied verbatim:

| Collection | Fixture | Rows |
|---|---|---|
| Drivers | `seasonDriverCardsFixture` | Max Verstappen (#1 VER, Dutch, Oracle Red Bull Racing, P2, 402.5) · Lando Norris (#4 NOR, British, McLaren Formula 1 Team, P1, 460.5) · Franco Colapinto (#43 COL, BWT Alpine Formula One Team, unranked, 0 pts) · Unaffiliated Entrant (#55, unresolved team, so no team text) · Reserve Entrant (no number, no standing) |
| Teams | `seasonTeamCardsFixture` | BWT Alpine Formula One Team (Renault, P6, 22, GAS · DOO · COL) · McLaren Formula 1 Team (Mercedes, P1, 460.5, NOR) · Oracle Red Bull Racing (no power unit, P2, 402.5, VER) |
| Circuits | `seasonCircuitCardsFixture` | Autodromo Nazionale Monza (Monza, Italy, 5,793 m, Italian Grand Prix 2026-07-10) · Circuit de Spa-Francorchamps (Stavelot, Belgium, 7,004 m, Belgian Grand Prix 2026-07-24) |

**These are fixture values.**
- They contradict the staging Standings snapshot: Norris has 460.5 points here
  and 120 there. The two sets were never merged.
- They are not real-world results.
- Team colours (#1E41FF, #FF8000, #0093CC) are the fixture's own values.
- Country names and nationalities are API-delivered text, so they stay in
  English on the Spanish page.

**The states page adds one more fixture:** the synthetic 22-driver
`_longDrivers` roster from `explore_widget_test.dart` ("Driver 1"…"Driver 22").
It shows a long list.

**Images.** `content/media/media-rights.json` is intentionally empty: no
Formula 1 media has been cleared. Every image slot is therefore the
placeholder. No portraits, logos or circuit maps were generated or borrowed.

## Information preservation

| ID | Element | Prototype |
|---|---|---|
| ED01 | Driver name | Row title |
| ED02 | Team (from the season entry) | Subtitle. Omitted when unresolved (Unaffiliated Entrant) |
| ED03 | Nationality | Subtitle after the team. Omitted when absent |
| ED04 | Position | "Position 2" in the data line. Shown only when non-null; Explore has no unranked placeholder (Colapinto shows points only) |
| ED05 | Points | "Points 402.5" / "Puntos 402,5". The 0 is kept (Colapinto) |
| ED06 | Race number | Right-hand figure, 28px. Omitted when absent (Reserve Entrant) |
| ED07 | Short code | Caption under the race number |
| ED08 | Team accent | 12° tick in the gutter, only when the fixture supplies a valid colour |
| ED09 | Portrait | 48px placeholder slot (person) |
| ET01 | Team display name | Season name, then short name, then stable name |
| ET02–ET03 | Position, points | Data line, only when known |
| ET04 | Power unit | Data line, "Power unit Renault". Omitted for Red Bull |
| ET05 | Line-up summary | Codes in a tracked line ("GAS · DOO · COL"). Not individually tappable |
| ET06 | Team accent | 12° tick |
| ET07 | Team mark | Placeholder slot (shield). Not presented as season livery |
| EC01 | Circuit name | Row title (wraps; "Spa-" breaks at its own hyphen) |
| EC02–EC03 | Locality, country | "Monza, Italy" |
| EC04–EC05 | Related GP, start date | "Italian Grand Prix · Jul 10, 2026" / "10 jul 2026" (`yMMMd`, date-only). The date never breaks internally |
| EC06 | Length | Right-hand figure "5.793" + "km" ("5,793" in Spanish; the app's `NumberFormat` for 5.793 km) |
| EC07 | Circuit image | Placeholder slot (route) |
| Shared | Season heading, category selector, collection-specific empty/error copy, progress line, refresh-failure notice | Present; states on `states.html` |

Not displayed, as in Flutter:
- Corner count, related-event round/status/format/end date, country codes
- Team nationality
- Driver role
- Unranked placeholders

No stable identifier is ever shown.

## Behaviour

- **Selection is route state.**
  - `/explore` opens Drivers. `/explore/teams` and `/explore/circuits` are
    sibling routes; switching uses `go()`, so routes never stack.
  - Leaving and returning through the bottom navigation, or a detail round
    trip, keeps the category, because the branch keeps its route.
  - Re-selecting the active Explore tab returns to the branch root (Drivers).
  - The prototype opens on Drivers. `?category=teams|circuits` stands in for
    the sibling routes (a screenshot aid).
- **Independent offsets.** Each category keeps its own scroll offset
  (`ExploreUiState`: per session, scoped by season).
  `selector-behaviour.txt`: Drivers at 400 → Teams at 0 → Drivers at 400 →
  Circuits at 0 → Teams at 0 → Drivers at 400.
- **No refresh action.** Explore's app bar has Settings only. Startup and
  foreground sync belong to the coordinator. The only request the screen can
  make is a focused **Try again** on an empty or error collection.
- **Freshness.**
  - No timestamp and no stale notice: Explore does not consume them.
  - A thin progress line shows while refreshing.
  - "Update failed" / "No se pudo actualizar" shows on failure and wins over
    the progress line. Cached rows stay.
- **Navigation.** Rows open Driver / Team / Circuit detail by stable id, with
  the season as navigation origin. Here they are static links:
  `#drivers/<id>`, `#constructors/<id>`, `#circuits/<id>`.

## Visual decisions

**A reference library with an identity-figure rail.** Each row reads image
slot → identity → optional figure. The figure is the number that identifies
the entity:
- **Drivers:** the race number, set like a car number, with the short code
  under it.
- **Circuits:** the length in km.
- **Teams:** no such number exists, so the row has no figure and leads with
  the line-up codes instead.

The same row primitive gives three different compositions, because the data
differs.

**Labelled data line.** Flutter shows bare numbers ("2 · 402.5"). Existing
field labels make them readable: "Position 2 · Points 402.5", "Power unit
Renault". The label is grey, the value Chalk and bold, in tabular figures.

**Open slot column.** Hairlines start at the text column, so the image slots
form a quiet column on the left. That is Calendar's inset logic applied to
media. Standings' hairlines run full width, which keeps the ranking and the
library visibly different.

**Placeholders.**
- A 48px square: raised gradient, hairline border, 22px category icon
  (person, shield, route).
- Absent, loading, failed and undecodable images all render the same slot, so
  nothing shifts when an image arrives.
- The slot is decorative; the row text names the entity.

**12° audit.**
- The selected segment (selection meaning, as in Standings and the nav).
- The team-accent tick, in the team colour (livery meaning, the tick Standings
  defined but could not render).
- Nothing else is slanted.

**Large text / narrow container (under 20em).** The slot and the figure share
the first line, and the text takes the full width below. Nothing is
truncated.

## Design-system extensions (proposals; nothing applied to other screens)

| Extension | Why | Where |
|---|---|---|
| Entity row: slot, identity, optional figure | One primitive for three collections. Differs from the ranked row (no index column) and the Calendar row (no round column) | `.ent`, `.lib` |
| Image slot + placeholder | First image slot in Primer. Fixed size, so states can't shift layout | `.ent__media` |
| Labelled data line (`.datum`) | Replaces bare numbers with existing field labels. Label and value wrap apart only when needed | `.ent__data` |
| Identity-figure rail | Race number with code, length with km | `.ent__fig` |
| Team-accent tick, rendered | Standings specified it, but no fixture there had a colour | `.ent[style]` |
| Three-segment selector | Standings' selector generalised. At 200% it stacks to 185px | `.seg` |
| Progress line | Explore's refreshing state. Static under reduced motion | `.progress` |
| **Header budget, second level** | At 320 @200% the stacked three-segment selector alone took 27% of the screen. Now: if the selector bar alone exceeds 25% of the viewport, it scrolls too and only the bottom nav stays fixed. Extends Standings decision 1, which is also pending validation | `explore.js` |

## Validation (Chrome 157 headless, DevTools Protocol, `mobile: true`, DPR 2; 200% = root font size)

Current run: `validation-20261107-233303-final/`. Each cell reads Drivers /
Teams / Circuits.

| Run | Width (inner / client / scroll) | Overflow · text overflow · <12px | Header | Selector | Nav | Clearance above nav (px) |
|---|---|---|---|---|---|---|
| EN 390×844 | 390 / 390 / 390 | 0 · 0 · 0 | pinned 82+77 | regular | regular | 178 / 329 / 411 |
| EN 320×693 | 320 / 320 / 320 | 0 · 0 · 0 | pinned | regular | regular | 24 / 139 / 201 |
| EN 390 @200% | 390 | 0 · 0 · 0 | pinned 104+81 | condensed | condensed | 24 |
| EN 320 @200% | 320 | 0 · 0 · 0 | none (all scroll) | stacked 185 | stacked | 24 |
| ES 390×844 | 390 | 0 · 0 · 0 | pinned | regular | regular | 178 / 290 / 411 |
| ES 320×693 | 320 | 0 · 0 · 0 | pinned | regular | condensed | 24 / 139 / 201 |
| ES 390 @200% | 390 | 0 · 0 · 0 | app bar scrolls | stacked | stacked | 24 |
| ES 320 @200% | 320 | 0 · 0 · 0 | none | stacked | stacked | 24 |
| States EN/ES 390, 320 @200% | exact | 0 · 0 · 0 | – | – | – | – |

- **Title gap** is at least 81px everywhere ("Explorar" fits at full width).
- **Touch targets at 320**, all three categories, EN and ES, all OK:
  - Settings 48×48, segments 93×48, tabs 78×61
  - Driver rows 320×77–113, team rows 320×95–114, circuit rows 320×130
- **Contrast:**
  - Data labels: 7.95
  - Placeholder icons (non-text): 6.02 / 7.02
  - Progress line: 7.44
  - Every other pair is unchanged from earlier screens
- **Impeccable** (`impeccable detect`, engine 4.8.0):
  - Rendered pages: 0 findings for all three categories, EN/ES, at 390×844 and
    320×693, plus the states pages.
  - Source scan: one finding per page, "marquee" on `.progress::after` (an
    infinite horizontal loop). **Reviewed and kept, not suppressed.** It is the
    indeterminate refresh indicator matching Flutter's `LinearProgressIndicator`.
    It is shown only while a collection refreshes, and it is static under
    `prefers-reduced-motion`. A non-moving alternative (opacity pulse) is
    possible if the owner prefers it.
- **Defects found and fixed during validation:**
  1. The circuit date broke mid-date ("Jul / 10, 2026").
  2. At 320 @200% the stacked selector plus the nav left about 51% of the
     screen; fixed with the second-level header budget.
  3. A layout race let the selector's late refit escape the header budget
     (Teams stayed pinned).
  4. **Spanish Teams at 320 @200% widened the layout viewport to 373px.**
     "Unidad de potencia Mercedes" could not wrap.
- **Validation gap closed.** Defect 4 slipped past the overflow check, which
  compared page width with `innerWidth` (which widens with the page). The
  capture script now records `clientWidth` and `visualViewport.width`, and
  every run is checked against the requested width. I re-scanned all earlier
  evidence (Home, Calendar, Standings, 38 runs): no widened viewport anywhere
  else.

## Critical comparison with Home, Calendar and Standings

| | Assessment |
|---|---|
| Visual consistency | **Strong.** Same app bar, selector, notices and nav. The 12° cut keeps its two meanings (selection, livery). Ember appears only as the progress line |
| Artistic personality | **Moderate.** The race-number figures and coloured livery ticks give Drivers character. Teams and Circuits are calmer. With every slot a placeholder, the left column is grey and repetitive. This is the most "library" and least "motorsport" of the four screens |
| Information hierarchy | **Good.** Name → affiliation → labelled data, with one figure on the right. The data labels fix Flutter's ambiguous bare numbers |
| Scannability | **Good for Drivers** (numbers on the right rail, accent ticks). **Fair for Teams** (names wrap to two lines at 320). **Good for Circuits** |
| Information density | **Adequate.** Rows are 77–130px at 320. The labelled data line costs about 20px per row compared with Flutter's single subtitle |
| Placeholders | **Honest and stable** (fixed slots, no shift). **Visually weak**: three icon squares down the column add no information. If media stays uncleared long-term, consider dropping the slot or replacing it with a typographic monogram (e.g. the short code). Both would change the Flutter presentation |
| Navigation clarity | **Good.** Selected tab and selected segment share the oxide slab. Rows are whole links with Flutter-equivalent labels |
| Accessibility | **Good.** AA contrast, 48px targets, `aria-pressed` selector, no clipping, exact viewport widths after the fix. Not done: TalkBack, real Android font scaling |
| Localization | **Good.** All copy from the ARB files, decimal comma, Spanish date order, long Spanish labels wrap cleanly |
| Functional fidelity | **Good.** ED/ET/EC all present or correctly omitted. No search, sort or filter. No refresh action added |

Generic or repetitive:
1. The placeholder column.
2. The repeated "Position / Points" labels on every driver and team row. That
   is clarity bought with repetition; a column header was impossible without
   new copy.
3. Teams has no figure, so it is the plainest of the three.

## Differences from Flutter that need explicit approval

1. **Labelled data line.** Flutter shows bare "2 · 402.5"; the prototype
   shows "Position 2 · Points 402.5" using `fieldPosition` / `fieldPoints` /
   `fieldPowerUnit`.
2. **Layout of the team row's details.** Flutter puts standing, power unit and
   line-up in one subtitle. The prototype gives line-up codes their own line
   and puts the labelled data on another.
3. **Circuit layout.** Length moves to the right-hand figure; location and the
   event get their own lines.
4. **Accessible names:**
   - Flutter's row labels read name, team, standing for drivers (no
     nationality, number or code), name, standing, line-up for teams, and
     name, location, event for circuits.
   - The prototype labels add the missing visible values with field labels,
     e.g. "Max Verstappen, Oracle Red Bull Racing, Nationality Dutch,
     Position 2, Points 402.5, Number 1, VER".
5. **Image slot size:** 48px against Flutter's 40px.
6. **Wrapping instead of truncation:** Flutter's `_RowScaffold` uses
   `maxLines: 1` + ellipsis. This follows Standings decision 4.
7. **Second-level header budget** (proposal, pending validation like Standings
   decision 1).

## Open issues

- **No staging Explore capture.** These screenshots show fixture data; a
  staging capture would be needed to compare density with real roster sizes
  (about 22 drivers, 11 teams, 24 circuits).
- **Placeholder-only media.** Visual judgement of the image slot is
  provisional until cleared media exists.
- **The progress-line "marquee" finding** needs an owner decision: keep the
  sweep, or switch to a non-moving pulse.
- **Not covered:** light theme, TalkBack, device testing, real Android
  non-linear font scaling, and the sample/frozen-data banner (fixture builds
  only).
