# Primer V2: Team Detail visual prototype

<!-- primer-v2-status-notice -->
> **Historical record.** This document describes an early per-screen prototype that the approved Dark and Light references replaced. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../README.md#validation-output).

The third Primer V2 detail screen. No other prototype and no Flutter code
was modified.

**Status: visual direction provisionally approved** (owner review,
2026-11-08; `../DESIGN-DECISIONS.md` TM-01). The targeted refinement requested
in that review is **delivered and awaiting review** (TM-02, TM-03; backlog
TEAM-01 to TEAM-06). The approval covers the visual prototype only and
authorises no Flutter change.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | **Scenario A**: complete team (season branding, championship, a mid-season line-up change, season facts, biography) |
| `returning.html` / `returning.es.html` | **Scenario B**: a driver who leaves and returns: two rows, one per participation span |
| `partial.html` / `partial.es.html` | **Scenario C**: partial, collection-derived team (no detail sync): banner only |
| `states.html` / `states.es.html` | **Development-only** state fixtures (14 frames). Not app UI, not team data. Frames 10 and 11 now include each card's line-up |
| `build.py` | Generates the eight pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of the shared foundation (md5 `0d78851e…`, same as every other screen) |
| `td.css` | Team Detail styles. App bar, notice, empty block, button, section and destination link row are copied from `../driver-detail/dd.css` and marked as such |
| `states.css` | Gallery styles, copied from Driver Detail; the media-geometry marker targets the banner |
| `validation-20261108-152827-refinement/` | **Current**: the refined pages. Screenshots, metrics, touch targets, accessibility tree, layout check, `data-check.txt` (ordering, boundaries, naming, colour edge), Impeccable output, and the four scripts (`data-check.py` is new) |
| `validation-20261108-150419-final/` | **Historical evidence: the version the owner reviewed.** Kept unchanged |

No JavaScript: Team Detail has no presentation preference to simulate.

## Refinement after review (2026-11-08)

Three targeted corrections and one verification. The composition, section
order and every other behaviour are unchanged.

### 1. Line-up order now reproduces the app (was TD-02)

**Confirmed rule** (`lib/core/database/daos/competitor_dao.dart`,
`_byRosterOrder`, applied by `_seasonLineups` before the profile reaches the
widget; the widget renders the list as received):

1. a member with a race number comes before one without;
2. race number ascending;
3. driver full name, Dart `String.compareTo` (UTF-16 code units, so
   case-sensitive);
4. start round ascending, a null start counted as 0.

The reviewed prototype rendered the fixture's list order (Gasly #10, Doohan
#7, Colapinto #43), which is what widget tests see because the fake
repository bypasses the DAO. `build.py` now applies the same comparator
(`roster_order`, a new list; the fixture list is not modified), so Scenario A
reads **Doohan #7, Gasly #10, Colapinto #43**. Frame 8 (no numbers) now reads
Doohan before Gasly (name order); Scenario B (same driver, no numbers) keeps
"until round 6" before "from round 12" (start 0 before 12). Nothing is sorted
by start round to bring a hand-over together.

`data-check.txt` re-sorts every fixture line-up from all input permutations
and gets the same order each time. Not exercised by any fixture: equal race
numbers with different names, and mixed numbered/unnumbered line-ups.

**Hand-over across non-adjacent rows.** An observed boundary is now set in
Ember (`.lu__span`, 7.44:1 on the page) instead of Chalk: "Until round 6" on
Doohan's row and "From round 7" on Colapinto's row are the only Ember text in
the list, so the pair is found at a glance with Gasly's row between them. The
words carry the meaning; no connector, timeline or re-sorting was added.

### 2. Null participation boundaries (verified, unchanged)

- Every entry keeps its row, keyed by `entryId`; nothing is deduplicated by
  driver id (`data-check.txt`: A three rows, B two rows for one driver).
- An entry with `startRound == null` and `endRound == null` still renders its
  row (Gasly in A; both rows in frame 8).
- **Wording follows the current Team Detail rule, which differs from Driver
  Detail:** `constructor_detail_screen.dart` `_lineup` shows the span only
  when `hasObservedBoundary` (at least one boundary known). So a null/null
  row shows its role and **no span**; "From season start" never appears on
  Team Detail. Driver Detail always shows the formatter's text, including
  "From season start" for null/null.
- The formatter's four cases are unchanged ARB copy (`data-check.txt`):
  null/null "From season start", null/end "Until round N", start/null "From
  round N", start/end "Rounds N–M" (en dash, as in the ARB file).
- No "Full season" anywhere; a null end is never presented as "until the
  last race".
- Whether Team Detail should also show "From season start" (consistency
  with Driver Detail) is an open decision (backlog TEAM-05). It would be a
  Flutter change.

### 3. Stable constructor identity (was TD-04)

- **Existing labels reviewed.** No ARB string names the stable identity as
  distinct from the season entrant name. Candidates: `fieldTeam` ("Team" /
  "Equipo", "a team association"), `constructorTitle` ("Team"),
  `standingsConstructors` ("Constructors", plural), `constructorInformation`
  ("Team information"). A **visible** "Team" label beside "Alpine" would
  imply that "BWT Alpine Formula One Team" is not the team, so none was
  added.
- **Semantic clarification:** the meta line is now a term list with
  visually hidden terms: screen readers hear **"Team: Alpine"** and
  **"Nationality: French"** (`fieldTeam`, `fieldNationality`). "Team" is the
  product word for a constructor (`constructorTitle`; the screen's own
  title), and `TeamProfile.constructor` is "the authoritative stable
  identity", so the term is accurate. A bare country code (Flutter's
  fallback) gets no term.
- **Visual distinction unchanged:** stable name in Chalk weight 750, a 12°
  hairline, nationality in the secondary colour.
- **Remaining ambiguity:** sighted users get no wording that says "Alpine"
  is the constructor's stable name; and "Team: Alpine" after the heading
  "BWT Alpine Formula One Team" names two things "team". A precise visible
  label would need new copy (backlog TEAM-02).
- The heading remains `displayName`; the stable name still appears only when
  it differs (frame 9: none).

### 4. Dark team colours (was TD-07)

- The supplied colour is never changed. `build.py` measures it against its
  surface (banner `--tray`, page `--ground`) with the WCAG ratio, as
  `GvTeamAccent.foregroundOn` measures contrast rather than using a
  luminance threshold.
- **Below 3:1** (WCAG 1.4.11 non-text contrast), the colour is framed with
  Chalk, a Primer neutral, not a new colour:
  - banner rail: 2px Chalk above and below the 12px bar (the colour keeps
    the middle 8px), and the pinstripe becomes a 2px Chalk line;
  - line-up seam: the colour keeps its 2px core with a 1px Chalk line either
    side (the seam column widens from 2px to 4px).
  - Chalk is 13.41:1 on the banner and 15.19:1 on the page, so the shapes'
    edges exceed 3:1.
- **3:1 or above:** unchanged. `#0093CC` 4.64 / 5.26 and `#FF8000` 6.40 / 7.25
  need no edge; only `#1E41FF` (2.50 / 2.83) gets it.
- Verified with existing fixtures in both places: frame 10 now shows the Red
  Bull card's banner **and** its line-up (Max Verstappen VER #1), frame 11 the
  McLaren card's (Lando Norris NOR #4), as a light-colour comparison.
- Team identity never depends on colour: the name is always text, and the
  rail and seams are absent when no colour is supplied.

### 5. Partial banner (reviewed, unchanged)

The banner has **no fixed or minimum height**: its height is its content plus
22px above and 24px below. Without colour, media and nationality (Scenario C)
it holds only the season line, the entrant name and the stable name, with no
rail, so no empty band remains. No adjustment was needed; missing data stays
omitted.

## Sources read

- `lib/features/constructors/presentation/constructor_detail_screen.dart`
  (`_body`, `_championship`, `_lineup`, `_seasonFacts`, `_profileFacts`,
  `_TeamHero`), `application/team_detail_providers.dart`
- `lib/features/shared/domain/entities/entity_profile.dart` (`TeamProfile`:
  `displayName`, `stableFallbackName`, `hasSeasonFacts`, `hasProfileFacts`,
  `media`), `season_card.dart` (`TeamLineupMember`, `hasObservedBoundary`),
  `season_entry.dart` (`ConstructorSeasonEntry`), `constructor.dart`,
  `standing.dart`
- `lib/core/database/daos/competitor_dao.dart` (`teamProfile`,
  `_seasonLineups`, `_byRosterOrder`), `lib/features/shared/domain/participation_span.dart`
- `lib/features/shared/presentation/entity_formatting.dart` (`role`,
  `participationSpan`, `position`, `joinDetails`),
  `widgets/entity_detail_scaffold.dart`, `lib/core/widgets/gv_rows.dart`
  (`GvDriverRow`), `lib/core/theme/gv_team_accent.dart`,
  `lib/app/router/entity_navigation.dart`
- `test/screens/entity_detail_widget_test.dart` ('team detail' group),
  `test/application/entity_detail_state_test.dart`,
  `test/navigation/entity_graph_navigation_test.dart`,
  `test/support/entity_fixtures.dart`, `router_harness.dart`
- `lib/l10n/app_en.arb`, `app_es.arb`
- Audit §2.2 row 10, §3.9 (T01–T22); `../DESIGN-DECISIONS.md`,
  `../DESIGN-BACKLOG.md`, `../driver-detail/README.md`, the Standings and
  Explore prototypes

## What the current Flutter screen does (summary)

- **Title** always "Team" / "Equipo" (`constructorTitle`). Root navigator:
  back only, no bottom navigation, no refresh control. The route is
  `/constructors/:constructorId`; "Team" is product vocabulary,
  "Constructor" stays the domain and route vocabulary.
- **Season.** The route carries only the constructor id. The season arrives
  as `EntityNavigationOrigin.season` (a historical Standings row keeps its
  season) or is resolved locally for a deep link. **The year is never
  printed** (audit §3.9). Season unavailable → retry state, nothing requested.
- **Hero** (`_TeamHero`, `GvHeroCard`): 16:9 decorative image of the
  constructor's **stable** media (`constructorMark`), shield placeholder for
  absent/loading/failed; a 48×4 accent bar in `seasonEntry.colorPrimary ??
  constructor.colorPrimary` when parseable; heading `displayName` =
  `seasonEntry.fullName ?? seasonEntry.shortName ?? constructor.name`;
  subtitle `stableFallbackName · (nationality ?? countryCode)`, where the
  stable name appears only when it differs from the heading.
- **Section order:** hero → Championship → Drivers → Team details → Team
  information → About.
- **Championship** only with a standing: Position (or "Unranked"), Points
  (`fmt.points ?? ''`), Wins when non-null (zero kept); provisional chip only
  when `true`; header action "View constructors' standings" opens the exact
  season table.
- **Drivers** only with a non-empty line-up: one `GvDriverRow` per
  `TeamLineupMember`, keyed `team-lineup-<entryId>`, in the order the read
  model supplies. Subtitle `role · span`, the span only when
  `hasObservedBoundary`; trailing race number and short code when present;
  semantic label "Open driver {name}" replaces the row's other semantics;
  tap → `openEntity(/drivers/:id, season)`.
- **Line-up order in the app** (`_byRosterOrder`): numbered before
  unnumbered, race number ascending, then name, then start round. Unresolved
  driver stubs are omitted upstream; the season entry's `driverLineup` is
  deliberately ignored.
- **Team details** only when one of power unit, principal, base, chassis is
  present (each optional). **Team information**: nationality only (gated by
  `hasProfileFacts`, which also counts `countryCode`, so a code-only team
  opens no card). **About** only with a non-blank biography.
- **States** (shared scaffold): loading skeleton, season unavailable,
  not found, first-load error, ready; one notice by precedence: "Update
  failed" > "Some profile information is unavailable" > "Details may be
  outdated".
- **Navigation:** `openEntity` collapses an immediate A → B → A return
  (Team → Driver → same Team) into `pop()`; every hop carries the season.

## Fixture provenance

**Rule:** each rendered profile is one test's whole input, never merged with
another. Harness: season 2026 unless the test sets another.

| Use | Source | Values (verbatim) |
|---|---|---|
| **Scenario A**, complete | `router_harness.dart` `defaultFakeConstructors()` = `teamProfileFixture()`; test 'renders season branding, facts and the derived line-up' | Constructor `alpine`, stable name "Alpine", nationality "French", colour `#0093CC`, biography "The Enstone-based team competing as Alpine since 2021." · season entry: full name "BWT Alpine Formula One Team", short name "Alpine", colour `#0093CC`, power unit "Renault", principal "Team Principal", base "Enstone, United Kingdom", chassis "A526" · standing: position 6, 22 points, 0 wins · line-up (in this order): Pierre Gasly GAS #10; Jack Doohan DOO #7 until round 6; Franco Colapinto COL #43 from round 7; all race drivers |
| **Scenario B**, returning driver | 'a driver who returns to the team keeps one row per span' | `teamProfileFixture` with line-up: Jack Doohan until round 6 (entry `2026-jack-doohan`), Jack Doohan from round 12 (entry `2026-jack-doohan-12`); no numbers or codes; race driver |
| **Scenario C**, partial | `partialTeamProfileFixture()` under `_neverSynced`; 'a partial team profile hides empty fact cards' | Constructor "Alpine" only; season entry full name "BWT Alpine Formula One Team"; no colour, nationality, biography, facts, standing or line-up → "Some profile information is unavailable" |
| States 5, 6 | Shared notice rules (tested on Driver detail) over Scenario A's banner | "Update failed", "Details may be outdated" |
| States 7 | 'an incomplete line-up never invents a name' | Scenario A with an empty line-up: no Drivers section |
| States 8 | `test/navigation/entity_graph_navigation_test.dart` (Explore → team → driver) | Line-up only: Pierre Gasly, Jack Doohan, no number, code or boundary |
| States 9 | `entity_detail_state_test.dart` 'a team whose branding equals its stable name shows no fallback' | `teamProfileFixture(seasonName: null)` → display "Alpine" (season short name), no fallback line |
| States 10, 11 | `seasonTeamCardsFixture()` (Explore collection cards; banner only) | "Oracle Red Bull Racing" / stable "Red Bull", `#1E41FF`; "McLaren Formula 1 Team" / "McLaren", `#FF8000`. A collection card is how a partial team profile arises |
| States 12 | 'the standings action carries the exact season' (`currentSeason: 2024`) | `teamProfileFixture(season: 2024)`: the harness's season-agnostic values under 2024. **Not 2024 data**; shown only for the season line and the standings link |

**Findings that limit the scenarios:**
- **Line-up order.** The fixture lists Gasly #10, Doohan #7, Colapinto #43,
  which is what widget tests render (the fake repository bypasses the DAO).
  The app's DAO (`_byRosterOrder`) delivers 7, 10, 43. **Since the
  refinement the prototype applies the DAO's order** (Doohan, Gasly,
  Colapinto); the fixture data is unchanged.
- **"Team Principal"** is the fixture's literal principal value, a stand-in,
  not a name. It is rendered verbatim and reads like a repeated label.
- Fixtures that rename the team ('Real Team' in the identifier-leak test,
  'Red Bull' in the navigation test) inherit Alpine's nationality, facts and
  biography under another name. They were **not** rendered as profiles (same
  leakage as Driver Detail's DD-02).

**Coverage limits (not invented):**
- **Rebranding across seasons** (one constructor id, different entrant names
  in two seasons) has no fixture. What exists: season name vs stable name
  within one season (A, frames 10, 11) and branding equal to the stable name
  (frame 9).
- **No season entry at all** (display = `constructor.name`), **country code
  without nationality**, **unranked team**, **provisional standing** (chip
  vocabulary only, frame 13), **unknown role in a line-up**, **mixed line-ups**
  (some rows with numbers, some without), **long sponsor names** beyond "BWT
  Alpine Formula One Team" (27 characters), and **more than three spans**.
- **No media**: `content/media/media-rights.json` is empty; nothing was
  acquired or generated.
- API text stays as delivered on the Spanish pages: team names, "French",
  "Enstone, United Kingdom", "Team Principal", the English biography.

## Information preservation (audit §3.9, T01–T22)

| ID | Element | Prototype |
|---|---|---|
| T01 | Season-aware name | Banner `h1`: `fullName ?? shortName ?? constructor.name`; wraps, never truncated |
| T02 | Stable name | Banner meta line, Chalk, only when it differs (A, frames 10, 11; absent in frame 9). Screen readers: term "Team" (refinement) |
| T03 | Nationality / country code | Banner meta line, secondary colour; screen readers: term "Nationality"; a bare country code gets no term (no fixture) |
| T04 | Team accent | Livery rail (12px bar + 3px pinstripe, cut at 12°) and the line-up seams; only when a colour is supplied; season colour first; Chalk edge when the colour is below 3:1 on its surface (refinement) |
| T05 | Team image | Decorative layer behind the banner, constructor's stable imagery only; absent/loading/failed render identically, no shield icon (frame 14 geometry) |
| T06 | Position | Figure, or "Unranked" word style (CSS ready, no fixture); section absent without a standing (C) |
| T07 | Points | Locale decimal ("22"; "402,5" style in Spanish); empty when null, never 0 |
| T08 | Wins | Third figure, only when non-null; confirmed 0 kept (A) |
| T09 | Provisional | Outline chip under the strip (frame 13) |
| T10 | Driver name | One row per span, keyed by `entryId` (`data-entry`); a returning driver has two rows (B); rows in the app's roster order (refinement) |
| T11 | Role | "Race driver" / "Reserve driver" / "Test driver" / "Role unavailable" (fallback in the generator; no fixture) |
| T12 | Observed span | Only when a boundary exists (Ember, refinement); "Until round 6", "From round 7", "Rounds A–B"; never "Full season"; null/null rows keep their row and show no span (A, frame 8) |
| T13 | Race number | Figure column, "Race number" for screen readers |
| T14 | Short code | Under the number |
| T15–T18 | Power unit, principal, base, chassis | Spec sheet rows, each only when present; sheet absent when none (C) |
| T19 | Nationality field | **Shown once**, in the banner; the "Team information" card, whose only field it is, is therefore not rendered (difference 3) |
| T20 | Biography | "About" paragraph, trimmed, only when non-blank |
| T21 | Notices | One notice, scaffold precedence (C, frames 5, 6) |
| T22 | Action labels | "View constructors' standings" link row; each row link "Open driver {name}" |

Not rendered, as in Flutter: `colorSecondary`, `driverLineup`, constructor
`shortName` as a separate field, identifiers, career statistics.

## Visual decisions

**An entrant banner, not a plate.** Driver Detail's identity is the oxide
number board; a team has no number, and inventing a code or abbreviation was
ruled out. The banner is typographic and full width:

1. Season line → **entrant name** (heavy, `wdth` 90, balanced over two or
   three lines: team names are long) → **stable name** in Chalk, a 12°
   hairline, **nationality** in the secondary colour (a name and a fact, told
   apart by weight and colour, not only by position).
2. **Livery rail** along the banner's lower edge: a 12px bar from the text
   edge to the right edge and a 3px pinstripe over its right half, both cut
   at 12°, in the single supplied team colour (no tints, no secondary
   colour). Without a colour there is no rail and no substitute.
3. Red Oxide is **not** used on this screen. It stays Primer's identity
   surface (Home's round block, GP's seam, Driver's board) and must not look
   like a team colour.

**Championship strip.** Position | points | wins as three figures with 12°
hairline seams (Standings' figure grammar). Unlike Driver Detail, wins is a
peer figure, not a secondary line; there are no podiums for teams. Narrow or
large text: position alone, then points | wins.

**Line-up as car rows.** Number (expanded 28px) and code in a fixed figure
column, a 12° seam in the team colour, then the driver name, the observed span
(Chalk, first) and the role. The chevron is Standings' list affordance; the
Chalk disc stays reserved for a single entity destination. With no number or
code in the whole list the column and seam drop (B, frame 8).

**Season facts as a spec sheet.** Ruled label | value rows, stacking at
narrow widths; reads as a technical sheet rather than a profile card.

**12° audit:** banner meta separator, livery rail and pinstripe, championship
seams, line-up seams. Nothing else is slanted.

**Type.** Archivo only. Figures expanded (position 72px, points/wins 40px,
car numbers 28px); names condensed (entrant 36px `wdth` 90, drivers 19px `wdth`
84); labels 13–14px; nothing under 13px.

## Season context

- "2026 season" / "Temporada 2026" above the entrant name: the existing
  `seasonLabel` string with the ready state's season, the same treatment as
  Driver Detail's refinement (pending review there, DR-02) and Grand Prix
  Detail's season line.
- **Differs from Flutter**, which prints no year on Team Detail (audit
  §3.9).
- No hardcoded year: `build.py` reads it from the fixture's `season`; the
  standings link uses the same value (`#standings/constructors/{season}`).
  Frame 12 shows a fixture opened for 2024: "2024 season" and
  `#standings/constructors/2024`.
- Season unavailable unchanged (frame 2): the banner exists only in the ready
  state.

## Constructor naming and rebranding

- The heading follows `displayName` exactly; the stable name is never
  substituted for the season name, and is shown below only when it differs.
- The stable constructor id drives the route and the row keys; no id is
  printed anywhere (checked: no `alpine`, `red-bull`, `mclaren` text on any
  page outside URLs).
- A historical season name is shown as that season's name, with no "formerly"
  or "now" wording (none exists in the ARB files, and none is implied).
- Cross-season rebranding cannot be demonstrated: no fixture has the same
  constructor id with different entrant names in two seasons.

## Media

- Flutter: `GvRemoteImage` with `MediaSlotPolicy.constructorMark`, 16:9,
  decorative, shield placeholder when absent, loading or failed. The media is
  the constructor's **stable** imagery; `ConstructorSeasonEntry` has no media
  field, so a season-specific livery cannot be expressed.
- Prototype: a decorative layer behind the banner under a left-weighted scrim
  (frame 14, dashed geometry only). Absent, loading and failed render the
  banner exactly as without media, with no shield (difference 1).
- **Risk to keep in mind:** under a historical season name, a current mark
  would sit behind an older entrant name. The scrim keeps it a background, but
  any future car photograph must not be presented as that season's livery.
- Not validated: a real mark behind the text, its crop at 320dp, or the
  season line's contrast over a bright image.

## Localization

- Labels, roles, spans, notices and the season line come from the ARB files;
  dates do not appear; points use the locale decimal pattern.
- Team names, nationality, base, principal and biography are API text and
  stay as delivered (no language variant in the contract; same finding as
  Driver Detail, backlog XS-23).
- Long Spanish strings exercised: "Ver clasificación de constructores",
  "Datos del equipo", "Unidad de potencia", "Director de equipo", "Desde la
  ronda 7", "Hasta la ronda 6", "Dorsal de la temporada" (screen readers).
  The space before a round number is non-breaking (ARB copy unchanged).

## Differences from Flutter that need approval

**Review status after the 2026-11-08 review** (TM-01). The owner accepted:
season-aware typographic banner; stable identity when distinct; optional
team-colour accents; three-figure championship; compact line-up rows; one row
per span; spec sheet; image-free composition with future media support; the
existing section order (Championship before Drivers). Passing automated
checks is not treated as approval.

| # | Difference | Status | Affects | Basis |
|---|---|---|---|---|
| 1 | Hero card → entrant banner; no shield placeholder; rail instead of accent bar | **Approved with conditions** | Missing-media behaviour | "Typographic team banner", "image-free composition with future media support". Condition: approved constructor media stays supported; absent/loading/failed render identically; stable imagery is never presented as a season livery |
| 2 | Season line (Flutter prints no year) | **Partially covered** | Historical season context | The line is part of the reviewed banner, but printing the year is a Flutter difference shared with Driver Detail DR-02 / DRV-02, still undecided |
| 3 | Nationality once; "Team information" card dropped | **Still requires a decision** | Information visibility | Not named in the review; same question as Driver Detail difference 2 (TEAM-01) |
| 4 | Stable name + nationality as name/fact meta line | **Covered** (visual) | Screen-reader semantics (refinement) | "Stable constructor identity when distinct". The refinement's "Team:" term is pending (TM-02, TEAM-02) |
| 5 | Three-figure strip; standings action as a link row | **Covered** | Navigation | "Three-figure championship presentation"; the standings destination and its exact season are preserved |
| 6 | Line-up row layout (figure column, span before role, chevron) | **Covered** | Ordering (refinement) | "Compact driver line-up rows", "one row per participation span". The Ember span emphasis is a refinement detail, pending with TM-02/TM-03 review |
| 7 | Line-up semantics (number, code, span, role announced; Flutter's label replaces them) | **Still requires a decision** | Screen-reader semantics, navigation | Not visual; cross-screen XS-04. Link label "Open driver {name}" and destination unchanged |
| 8 | Team colour on line-up seams | **Approved with conditions** | Information visibility | "Optional team-colour accents". Conditions: never the only carrier of identity; non-text contrast met (Chalk edge below 3:1, TM-03); absent when no colour is supplied |
| 9 | Spec sheet; About without a card | **Partially covered** | — | "Spec sheet" accepted; About without a card not named for Team (Driver Detail's equivalent was accepted as "compact biography", DR-01) (TEAM-01) |
| 10 | Reading order: heading before the season line | **Still requires a decision** | Screen-reader semantics, historical season context | Cross-screen XS-03 |
| 11 | Skeleton shape | **Still requires a decision** | — | Development states were not part of the review (TEAM-01) |

Not a difference any more: **line-up order** (now the app's `_byRosterOrder`).
Approved and unchanged: **section order** (Championship before Drivers).

Details of 1–11 as originally delivered:

1. **Hero card → entrant banner.** Full-bleed, square, no image card; no
   shield placeholder without media; the 48×4 accent bar becomes the livery
   rail. (As Driver Detail difference 1.)
2. **Season line** (new; Flutter prints no year). (As Driver Detail DR-02.)
3. **Nationality shown once** (banner); the "Team information" card, whose
   only field is nationality, disappears. (As Driver Detail difference 2.)
4. **Stable name and nationality** styled as name + fact with a 12°
   separator instead of one `·`-joined subtitle.
5. **Championship as a three-figure strip**; the standings action moves from
   the section header to a link row below. (As Driver Detail difference 5.)
6. **Line-up row layout:** number and code move from trailing to a leading
   figure column; a seam in the team colour; span before role (Flutter:
   `role · span`); Standings' chevron.
7. **Line-up semantics:** Flutter's row label "Open driver {name}" replaces
   all other row semantics, so role, span, number and code are not
   announced. The prototype keeps that link label and exposes number, code,
   span and role as following text. Overlaps XS-04.
8. **Team colour on the line-up seams** (Flutter uses the accent only in the
   hero; `GvDriverRow.accentColor` is not passed for the line-up).
9. **Season facts as a spec sheet; About without a card.**
10. **Reading order:** heading first, season line after it in the DOM while
    shown above it. (As Driver Detail difference 7; XS-03.)
11. **Skeleton:** banner block, label, three rows (Flutter: four cards).

Section order is **unchanged** from Flutter (Championship before Drivers).
Driver Detail moved participation above Championship (pending, DRV-01);
whether the two screens should agree is an open question (TD-10).

## Design-system extensions (proposals; nothing applied to other screens)

| Extension | Why | Where |
|---|---|---|
| Entrant banner | Typographic team identity; complete without media or colour | `.tb`, `.tb__meta` |
| Livery rail | One supplied colour as a controlled accent; clip-path 12° cut, never past the viewport, never under text | `.tb__rail`, `.tb__pin`, `.tb__bar` |
| Name + fact meta line | Distinguishes a stable name from a fact without new copy | `.tb__stable`, `.tb__sep`, `.tb__nat` |
| Three-figure championship strip | Teams have wins but no podiums; narrow stacking | `.tc` |
| Car row | Span-keyed list row: figure column, team-colour seam, span-first facts, overlay link + chevron | `.lu`, `.lu__row` |
| Spec sheet | Ruled label/value rows for optional technical facts | `.sheet` |
| Destination link row (shared) | Now used by Driver and Team detail | `.dest` (= Driver's `.ch__link`) |

The app bar, notice, empty block, button and skeleton are now copied into a
third detail folder (XS-09).

## Validation (`validation-20261108-150419-final/`)

Chrome 157 headless over the DevTools Protocol, `mobile: true`, DPR 2, 200%
text = root font size. `capture.mjs` and `a11y.mjs` copied from Driver Detail
(`a11y.mjs` with its reduced-motion selector pointed at `.dest .icon`);
`layout.mjs` is new (adapted from Driver Detail's `plate.mjs`).

28 runs: EN/ES × A/B/C × 390×844 and 320×693, each at 100% and 200%, plus the
states gallery at 390 and 320 @200% in both languages.

| Check | Result |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width, all 28 runs |
| Elements outside the viewport | 0 (the first pass found the skewed rail's corner 2px past the edge; now clipped with `clip-path`) |
| Clipped text | 0 |
| Text spilling out of its box | 0 |
| Text under 12.5px | 0 |
| Touch targets < 48×48 | 0. `*-touch-targets-320*.txt`: Back 48×48; standings row 320×56 (320×96 at ES 200%); driver rows 320×73 at 100% (139–179 tall at 200%); gallery 13/13 |
| Layout check (`layout-check.txt`, 32 configurations, 144 banners and rows) | 0 problems: no overlap between season line, name, stable name, nationality and rail, or between number, code, name and facts (glyph bounds); no word split across lines |
| Reading order (`accessibility-tree.txt`) | Back → "Team" → heading entrant name → season → stable name → "Nationality: French" → Championship (Position 6, Points 22, Wins 0) → "View constructors' standings" → per row: link "Open driver …", "Race number 10", "GAS", Participation, Role → Team details terms → About |
| Reduced motion | The only motion (3px arrow nudge on the standings row) computes to `0s` |
| Impeccable `detect` (installed 4.8.0, not updated) | **0 findings** (`impeccable-detect.json` = `[]`) on eight pages and three stylesheets |
| Archivo loaded | yes |

Document heights (EN / ES): A 1168 / 1168 at 390, 2187 / 2148 at 320 @200%; B
1095 / 1095, 1978 / 1939; C fits one screen in every configuration.

**Contrast:** Chalk on the banner 13.41, on ground 15.19; secondary text (season
line, nationality, labels, codes) 7.02 on the banner, 7.95 on ground. Team
colours are decorative, never text and never the only carrier of meaning:
`#0093CC` 4.64 / 5.26 (banner / ground), `#FF8000` 6.40 / 7.25, `#1E41FF`
**2.50 / 2.83** (below 3:1: the Red Bull rail and seams are faint; TD-07).

**Defects found and fixed during validation:**
1. The livery rail's skewed corner extended 2px past the viewport (outside
   check). Replaced the transform with a `clip-path` cut.
2. In the narrow championship strip, "Points" kept its seam indent because a
   sibling rule out-ranked the narrow rule. Fixed the selector.

## Critical assessment

| | Assessment |
|---|---|
| 1. Consistency with Primer V2 | **Strong.** Same tokens, axes, app bar, notice, link row and seam grammar; Red Oxide deliberately absent |
| 2. Distinctiveness from Driver Detail | **Moderate.** The banner (no board, livery rail) and the car rows are clearly different. The championship strip, section rhythm, link row and the seam/tick motif are close relatives of Driver Detail's. Side by side they read as siblings, not as the same screen with a different name |
| 3. Team identity | **Good with a colour, plain without one.** Scenario C (no colour, no media) is just type on a band: complete, but the least characterful state in the app |
| 4. Constructor colours | **Good.** One colour, rail and seams only, never under text. Dark blues (`#1E41FF`) are faint; a near-black colour would vanish (no fixture) |
| 5. Championship readability | **Good.** Three labelled figures; position dominant; zero wins kept. Labels sit at two heights (bottom-aligned figures), as on Driver Detail |
| 6. Line-up clarity | **Good.** Span-first facts make arrivals and exits explicit; the number column scans like a timing screen |
| 7. Mid-season semantics | **Good, with one risk.** Nothing says "full season", and rows are never merged. But an unbounded row (Gasly) shows no span at all, beside rows that do, which a reader may take as "all season". That is Flutter's rule (T12), unchanged |
| 8. Information density | **Good.** A fits about 1.4 screens at 390; nothing is repeated |
| 9. Missing media | **Strong** by construction; the banner never shows an empty image slot |
| 10. Accessibility | **Good in emulation:** AA text contrast, 48px targets, coherent reading order, row facts announced. Not tested with TalkBack; the stable name is announced without context (TD-04) |
| 11. Localization | **Good.** Long Spanish labels wrap; API text untouched; the narrow line-up layout keeps names whole at 200% |
| 12. Functional fidelity | **Strong** on data and conditions; eleven presentation differences need approval |

**More than two drivers.** Scenario A has three spans. Read top to bottom,
"Gasly · Doohan until round 6 · Colapinto from round 7" is understandable
because the spans are explicit. Two caveats: the order is the order supplied,
not chronological, and in the app (race-number order) Gasly would sit between
Doohan and Colapinto and split the hand-over visually. Also, with four or
more spans the list stays a flat column of rows; grouping by span was not
added, because the brief rules out new timelines and reordering.

What still looks weak or repetitive:
1. The championship strip is Driver Detail's block with wins promoted.
2. The 12° seam now appears in Explore, Standings, Driver and Team rows; it
   risks becoming wallpaper.
3. The colourless banner (C) has no identity device beyond type.
4. The spec sheet's left column is wide for four short labels on 390dp.

## Issues discovered (not fixed; for review)

**Consolidated into `../DESIGN-BACKLOG.md` on 2026-11-08** (evidence:
`validation-20261108-150419-final/`, reviewed; `validation-20261108-152827-refinement/`,
refinement). Mapping:

| Local | Backlog | Note |
|---|---|---|
| TD-01 | DRV-02 (extended) | One decision for the season line on Driver and Team detail |
| TD-02 | TEAM-04 | Prototype order corrected; the remaining question (hand-overs split by race-number order) is product |
| TD-03, TD-05, TD-06 | TEAM-06 | One fixture-coverage item |
| TD-04 | TEAM-02 | Semantic term delivered; visible label needs copy |
| TD-07 | TEAM-03 | Chalk edge delivered; awaiting review |
| TD-08 | XS-22 (extended) | |
| TD-09 | XS-15 (extended) | |
| TD-10 | DRV-01 (extended) | Team's order approved; Driver's change still pending |
| TD-11 | TEAM-05 | Null/null rows show no span on Team, "From season start" on Driver |
| TD-12 | XS-09 (extended) | |
| Differences 3, 9 (About), 11 | TEAM-01 | Not covered by TM-01 |

| ID | Issue | Notes |
|---|---|---|
| TD-01 | **Season year not printed in Flutter** (audit §3.9); the prototype shows it | Same decision as Driver Detail DR-02 / DRV-02 |
| TD-02 | **Line-up order:** fixture order (10, 7, 43) differs from the DAO's race-number order (7, 10, 43); in the app a hand-over pair can be split by an unrelated row | Flutter behaviour; owner may want span-aware ordering (would be a Flutter change) |
| TD-03 | **"Team Principal"** is the fixture's literal principal value | Fixture quality; rendered verbatim |
| TD-04 | **Stable name has no label:** no ARB string says what "Alpine" is beside "BWT Alpine Formula One Team"; screen readers hear "Alpine" with no context (as Flutter's subtitle) | Needs copy if wanted |
| TD-05 | **Coverage gaps:** cross-season rebrand, no season entry, code-only nationality, unranked, provisional, unknown role, mixed line-up, long sponsor names, more than three spans | Existing fixtures only |
| TD-06 | A mixed line-up (some rows numbered) leaves an empty figure column on unnumbered rows | Untested with data |
| TD-07 | `#1E41FF` rail/seams 2.5:1 against the banner; a near-black team colour would disappear | Decorative; consider a hairline edge if the owner wants visibility guaranteed |
| TD-08 | Partial notice uses the offline icon | Same as backlog XS-22 |
| TD-09 | Media validated by geometry only; stable mark behind a historical season name | Backlog XS-15 |
| TD-10 | Section order: Championship before Drivers here (Flutter), participation before Championship on Driver Detail (pending DRV-01) | Cross-screen consistency decision |
| TD-11 | An unbounded line-up row shows no span beside bounded rows; may read as "all season" | Flutter rule T12; owner question |
| TD-12 | Shared chrome copied into a third folder | Backlog XS-09 |

## Accessibility limitations

- All evidence is Chrome emulation; no TalkBack, no real device, no Android
  font scaling (XS-02, XS-05, XS-16).
- Row semantics differ from Flutter's (difference 7) and need a decision
  under XS-04.
- The stable name is announced without a label (TD-04).
- Light theme not designed (XS-01).

## Refinement validation (`validation-20261108-152827-refinement/`)

Same 28 capture runs and scripts as the reviewed version, plus
`data-check.py`.

| Check | Result |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width, all 28 runs |
| Outside / clipped / spill / text under 12.5px | 0 / 0 / 0 / 0 in all 28 runs |
| Touch targets < 48×48 | 0; all twelve `*-touch-targets-320*.txt` hold the **same target set and sizes** as the reviewed version (row order changed with the line-up) |
| Layout check (`layout-check.txt`, 32 configurations, 160 banners and rows) | **0 problems** (no collisions, no mid-word breaks) |
| Ordering, boundaries, naming, colour edge (`data-check.txt`) | **0 failures** (listed above) |
| Reading order (`accessibility-tree.txt`) | heading → "2026 season" → term "Team" "Alpine" → term "Nationality" "French" → Championship → link "Open driver Jack Doohan", "Race number 7", "DOO", Participation "Until round 6", Role → Gasly → Colapinto → Team details → About |
| Reduced motion | `0s` |
| Impeccable `detect` (installed 4.8.0, not updated) | **0 findings** (`impeccable-detect.json` = `[]`) |

**Defect found and fixed during the refinement:** at 200% the dark-colour
line-up (frame 10) kept the wide 4px-seam column rule inside the narrow
layout, squeezing "Verstappen" into a mid-word break (layout check). A narrow
override now follows the edge rule. Those intermediate captures were moved
out of the repository to the session scratchpad; they were never reviewed.

Heights (EN / ES): A 1183 / 1183 at 390; C still fits one screen in every
configuration.

## Open issues requiring approval

- After the 2026-11-08 review: differences 3, 7, 10, 11, the season-line
  part of 2 and the About part of 9 (backlog TEAM-01, DRV-02, XS-03, XS-04).
- The refinement: "Team:" term (TEAM-02), Chalk edge for dark colours
  (TEAM-03), Ember span emphasis.
- TEAM-04 (hand-overs split by race-number order), TEAM-05 (null/null rows
  show no span).
- Superseded: the eleven differences and TD-01 to TD-11 as originally
  listed.
