# Primer V2: Driver Detail visual prototype

The second Primer V2 detail screen. Home, Calendar, Standings, Explore and
Grand Prix Detail were not modified. No Flutter code was changed.

**Status: visual direction provisionally approved** (owner review,
2026-11-08; `../DESIGN-DECISIONS.md` DR-01). A targeted refinement requested
in that review (season context, number source) is **delivered and awaiting
review** (DR-02, DR-03). The approval covers the visual prototype only and
authorises no Flutter change.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | **Scenario A**: complete profile (English / Spanish) |
| `partial.html` / `partial.es.html` | **Scenario B**: partial, collection-derived profile (no detail sync) |
| `states.html` / `states.es.html` | **Development-only** state fixtures (16 frames). Not app UI, not driver data |
| `build.py` | Generates the six pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of the shared foundation (md5 `0d78851e…`, same as Calendar, Standings, Explore, GP Detail) |
| `dd.css` | Driver Detail additions. App bar, notice, empty/error block and button are copied from `gpd.css` and marked as such |
| `states.css` | Gallery styles, copied from GP Detail, plus the portrait-geometry marker |
| `validation-20261108-141921-refinement/` | **Current**: the refined pages. Screenshots, metrics, touch targets, accessibility tree, plate check, Impeccable output, and the three scripts (`plate.mjs` is new) |
| `validation-20261108-124338-final/` | **Historical evidence: the version the owner reviewed.** Kept unchanged |
| `validation-20261108-124116-pass1/` | Earlier full pass, kept. It predates the Impeccable fixes below |

## Refinement after review (2026-11-08)

Only two visual changes were made. Nothing else in the layout, interactions or
copy changed (one layout consequence of change 2, the wrapping lower row, is
described below).

### 1. Season context (DD-01 → backlog DRV-02)

- **What:** one secondary line directly above the driver's name: "2026 season"
  / "Temporada 2026".
- **String:** the existing `seasonLabel` ARB key ("{season} season" /
  "Temporada {season}"), the same key Circuit Detail already renders with
  `ready.season` and Grand Prix Detail's hero renders with the event season.
  No new string.
- **Value:** `EntityDetailReady.season`, "the exact season this profile was
  composed for" (`entity_detail_state.dart`). It is the origin season handed
  over by `EntityNavigationOrigin` (a historical Standings row keeps its own
  season) or, for a deep link, the locally resolved season. It is printed as a
  plain integer, like every other `seasonLabel` call site.
- **No hardcoded or inferred year.** `build.py` reads the season from the
  fixture (`driverProfileFixture({int season = 2026})`, `driverCard({int
  season = 2026})`); no template contains a year, and the standings link now
  takes the same value (`#standings/drivers/{season}`; it was a literal
  before). Checked by rendering the plate in memory with `season=2024`: the
  output contains "2024 season" / "Temporada 2024" and
  `#standings/drivers/2024`, and no "2026".
- **Season unavailable unchanged.** The plate exists only in the ready state,
  which always has a season. Loading, Season unavailable, Not found and
  First-load error render exactly as before (states frames 1–4).
- **Visually secondary:** the type of Grand Prix Detail's approved
  `.gp__season` (13px, weight 600, secondary text colour). No new colour,
  motif or font.
- **Reading order:** the line sits after the heading in the DOM, so the
  heading still leads (difference 7) and the season is announced immediately
  before the season number: heading "Max Verstappen" → "2026 season" →
  "Nationality: Dutch" → "Race number 1 · VER". Grand Prix Detail puts its
  season line before the heading; this is noted under XS-03.

### 2. Season number vs permanent number (DD-03 → backlog DRV-03)

- **What:** a small label at the top of the number board naming the number it
  shows, using the existing field labels:
  - the relevant span's race number → "Race number" / "Dorsal de la temporada"
    (`driverRaceNumber`, "the driver's number in the selected season");
  - Flutter's fallback to the permanent number (no season race number) →
    "Permanent number" / "Dorsal permanente" (`driverPermanentNumber`, the
    same words the Profile fact uses);
  - no number → no label (code-only board, or no board at all).
- **Nothing replaced or invented.** The board still shows `raceNumber ??
  permanentNumber`, exactly Flutter's hero rule; the Profile card still shows
  "Permanent number 33"; a missing number is never filled.
- **Screen readers:** the board's text alternative now starts with the same
  label: "Race number 1 · VER" (was "#1 · VER"), "Permanent number 33 · VER"
  in the fallback frame. The Profile fact stays "Permanent number: 33", so the
  two values are announced with different names.
- **Repetition:** the participation row's own "Race number 1" (D17, per span)
  is unchanged. For a single-span driver the season number therefore appears
  on the board and in the row, as in Flutter (chip + field). It is kept
  because a mid-season move can have a different number per span.
- **Evidence:** Scenario A (season #1; Profile "Permanent number 33"); states
  frame 8 ('a span with no observed boundary…': no race number, so the board
  reads "Permanent number #33", matching the Profile fact); frame 14
  (collection card #55, a `SeasonDriverCard.raceNumber`, "Race number");
  frame 15 (no number: no board, no label).

**Layout consequence (stacked plate only).** At 320 @200% the label widened
the board enough to break "Dutch" mid-word ("Dutc/h"; found in the first
refinement pass, missed by the spill check because `overflow-wrap` broke the
word instead of spilling). On the stacked plate, nationality and board are now
one wrapping row (`.dp__foot`): nationality never shrinks below its longest
word, and if both cannot share the row the board drops to its own line, still
right-aligned. On the wide plate the wrapper is `display: contents`, so the
reviewed grid is unchanged. The stacked board's left inset now grows with
text size (`max(30px, 1.5em)`), because a taller board moves its 12° edge
further right at the top, where the label's first line sits (the plate check
found "Permanent number" 1px over the edge at 200%).

### Refinement validation (`validation-20261108-141921-refinement/`)

Same 20 runs and scripts as the reviewed version, plus `plate.mjs`.

| Check | Result |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width, all 20 runs |
| Elements outside the viewport | 0 |
| Clipped text | 0 |
| Text spilling out of its box | 0 |
| Text under 12.5px | 0 |
| Touch targets < 48×48 | 0; the eight `*-touch-targets-320*.txt` files are **identical** to the reviewed version's (no target shrank) |
| Plate check (`plate-check.txt`, 24 configurations, 72 plates: EN/ES × A/B/states × 390/320 × 100/200%; the bare plate, frame 15, is single-column and so always listed as "stacked") | **0 problems**: no overlap between season line, name, nationality, label, figure and code (glyph bounds); no board text past the 12° edge; no word split across lines in the season line, name or nationality |
| Missing nationality | Scenario B and frames 5, 14, 15: no empty nationality line; the name keeps its bottom inset; the board sits right |
| Missing season number | Frame 8: "Permanent number #33" on the board, "Permanent number 33" in Profile. Frame 15: no board, no label |
| Number ambiguity | Every plate's text alternative names its number's source (listed per plate in `plate-check.txt`) |
| Reading order | `accessibility-tree.txt`, above. Reduced-motion durations still `0s` |
| Impeccable `detect` (installed 4.8.0, not updated) | **0 findings** (`impeccable-detect.json` = `[]`) on the six pages and three stylesheets. Its standard note that the `.css` files get regex-only rules is kept in `impeccable-detect.txt`; the HTML pages were parsed |

Heights (EN / ES): A 997 / 1004 at 390 (was 995 / 995), 1947 / 2100 at 320
@200% (was 1841 / 1963). B still fits one 390 screen in both languages.

**New contrast pairs:** the label is Chalk on the board, ≥4.63 at the
gradient's lightest stop (13px bold; 26px at 200%); the season line is the
secondary colour on the band, the same pair as the nationality (6.18–7.02).

**Superseded intermediate captures** (the 5.5em label measure, which made the
Spanish board drop to its own line at 320 @200%) were moved out of the
repository to the session scratchpad; they were never reviewed.

### Localization provenance (Spanish pages)

| Value on the Spanish page | Source | Matches Flutter? |
|---|---|---|
| "Dutch", "Hasselt, Belgium", the biography, team names | **API-provided free text.** `docs/api/gridview-api-v1.yaml` `Driver.nationality`, `placeOfBirth`, `biography`, `Constructor.name` are plain `string`/`null`, with no per-language variant, no `Accept-Language` or locale parameter anywhere in the contract. In the prototype the values come from the Flutter test fixture `driverProfileFixture()`, which stands in for that API text | **Yes.** `driver_detail_screen.dart` renders `driver.nationality`, `placeOfBirth` and `biography` verbatim in every locale |
| Labels, headings, roles, spans, notices, "Temporada 2026", board label | **Application strings**, `lib/l10n/app_es.arb` | Yes (verbatim) |
| "30 sept 1997", "402,5" | **Application formatting**: intl `yMMMd` (es), `decimalPattern` | Yes |

Nothing was translated in the prototype. **A coverage gap remains** and is a
product/content gap, not a prototype defect: Spanish users see English
nationality, birthplace and biography text, and nothing in the contract can
deliver Spanish. `countryCode` exists in the contract but is not used for
display; deriving a localized nationality from it would be a Flutter and
product change. Recorded as backlog XS-23 (it also affects Explore, which
shows nationality).

### Media behaviour (portraits)

The image-free composition is provisionally approved; portraits must remain
supported. Flutter today (`_DriverHero`): `GvRemoteImage` with
`MediaSlotPolicy.driverPortrait`, decorative, driver-owned media only;
absent, loading and failed all show the same `person_outline` placeholder.

| Media state | Intended design | Evidence |
|---|---|---|
| Available | Portrait in `.dp__media`, behind the plate, under a left-weighted scrim (opaque tray at the name side, 20% at the right edge); plate height, text and board unchanged; still decorative | Geometry only: states frame 16 (dashed outline). The season line, name and nationality sit over the opaque part of the scrim; the board is opaque oxide above the image |
| Loading | Plate exactly as without media; no icon, no shimmer, no layout change | By construction (same markup without the layer) |
| Missing | Same as loading | Scenario A and B |
| Failed | Same as loading | By construction |

**Limits:** no cleared media exists (`content/media/media-rights.json` is
empty) and no driver fixture has media, so a real portrait under the scrim,
the contrast of the secondary season line over a bright image, and a
portrait's crop at 320dp are **not validated**. No portrait was obtained,
generated or drawn. Dropping the placeholder icon is part of difference 1.
Tracked under backlog XS-15.

No JavaScript: Driver Detail has no presentation preference to simulate.

## Sources read

- `lib/features/drivers/presentation/driver_detail_screen.dart` (`_body`,
  `_team`, `_championship`, `_participation`, `_profileFacts`, `_DriverHero`)
- `lib/features/drivers/application/driver_detail_providers.dart`
- `lib/features/shared/presentation/widgets/entity_detail_scaffold.dart`
  (state mapping, notices, `_DetailSkeleton`), `screen_scaffold.dart`
- `lib/features/shared/application/entity_detail_state.dart`
  (`computeEntityDetailState`), `entity_detail_scope.dart`
- `lib/features/shared/domain/entities/entity_profile.dart` (`DriverProfile`,
  `DriverParticipation`, `hasProfileFacts`, `relevantParticipation`),
  `driver.dart`, `standing.dart`
- `lib/features/shared/domain/participation_span.dart` (`sortBySpanRelevance`),
  `lib/core/database/daos/competitor_dao.dart` (where it is applied)
- `lib/features/shared/presentation/entity_formatting.dart` (`EntityFormatter`),
  `result_formatting.dart`
- `lib/app/router/entity_navigation.dart` (`openEntity`,
  `EntityNavigationOrigin`), and every `RoutePaths.driver(` call site
- `lib/core/widgets/gv_rows.dart` (`GvTeamRow`), `gv_cards.dart`
  (`GvHeroCard`), `gv_remote_image.dart`, `gv_states.dart` (`GvOfflineNotice`)
- `test/screens/entity_detail_widget_test.dart`, `screen_golden_test.dart`,
  `test/application/entity_detail_state_test.dart`,
  `test/support/entity_fixtures.dart`, `fake_entity_repository.dart`,
  `router_harness.dart`, `domain_fixtures.dart` (`syncedMetadata`)
- `lib/l10n/app_en.arb`, `app_es.arb`; intl 0.20.2 `yMMMd` (en `MMM d, y`,
  es `d MMM y`, es short months incl. `sept`)
- Audit §2.2 row 9, §2.4, §3.8 (D01–D24), §4.1–4.5, §5.6, §7.2;
  `../DESIGN-DECISIONS.md`, `../DESIGN-BACKLOG.md`, `../grand-prix-detail/README.md`

## What the current Flutter screen does (summary)

- **Title** is always "Driver" / "Piloto" (`driverTitle`), in every state. Root
  navigator: back button only, no bottom navigation, no refresh action, no
  pull-to-refresh, no progress indicator in the ready state.
- **Season.** The route carries only the driver id; the season arrives as
  `EntityNavigationOrigin.season` from the origin screen, or is resolved
  locally for a deep link. The year is **never printed** on this screen.
- **Hero.** Rounded `GvHeroCard` with the driver portrait as background
  (`GvRemoteImage`, decorative). Absent, loading and failed images all render
  the same `person_outline` placeholder. Above the name: a chip
  `#<number> · <code>`, where number = relevant span's race number, else the
  permanent number. Below: `team · nationality`.
- **Team** section only when the relevant span's team name resolves. The span
  boundary is shown beside it only when there are several spans. It opens
  `/constructors/:id` with the profile's season.
- **Championship** section only with a standing: position (or "Unranked"),
  points, wins and podiums when non-null (zero kept), provisional chip.
  Header action "View drivers' standings" opens the exact-season table.
- **Season participation**: every span, each with team (or "Team
  unavailable"), role (fallback "Role unavailable"), race number when present,
  and boundary ("From season start" / "From round N" / "Until round N" /
  "Rounds A–B"; never "Full season").
- **Profile** card gated by `hasProfileFacts`: nationality, date of birth,
  place of birth, permanent number. A permanent number alone does not open the
  card. **About** only with a non-blank biography.
- **States:** loading skeleton, season unavailable (retry), not found (no
  retry), first-load error (retry), ready. Ready adds one notice: "Update
  failed" > "Some profile information is unavailable" (not materialized, or
  detail 404 with a summary) > "Details may be outdated" (stale).
- **No sample-data banner.** `MockDataBanner` is mounted on Home, Calendar,
  Standings, Explore and GP Detail, not on entity details.

**Entry points** (all `openEntity`, all hand over a season): Explore driver
cards (`card.season`), Standings driver rows (the table's season, so a
historical table opens that season), Home championship leaders (`season`), GP
classification rows (`document.season`), Team Detail line-up rows
(`ready.season`), and direct `/drivers/:driverId` links (season resolved
locally). `openEntity` collapses an immediate A → B → A return (for example
Driver → Team → same Driver) into `pop()`.

## Fixture provenance

**Rule:** each rendered profile is one test's whole input, never merged with
another. Harness context: clock 2026-07-18 12:10Z, `syncedMetadata` (fresh)
unless the test overrides it, season 2026.

**A finding that limits the scenarios:** `driverProfileFixture()` defaults are
Max Verstappen's identity (VER, permanent number 33, Dutch, 1997-09-30,
Hasselt, biography, Red Bull span #1, standing P2 / 402.5 / 7 wins / 14
podiums). Most driver tests override only the name and the field under test,
so "Lando Norris", "Franco Colapinto", "Unaffiliated Entrant", "Reserve
Entrant" and "Zero Points" **inherit Verstappen's code, number, nationality,
birth facts and biography**. Rendering those as whole profiles would show
another person's data under a real name. They are rendered **only for the part
the test actually sets** (spans or standing), and the plate is omitted.

| Use | Source | Values (verbatim) |
|---|---|---|
| **Scenario A**, complete | `router_harness.dart` `defaultFakeDrivers()` = `driverProfileFixture()`; test 'renders a complete profile with no placeholder data' | Max Verstappen · VER · permanent 33 · Dutch · 1997-09-30 · Hasselt, Belgium · biography "A four-time Formula 1 World Champion known for exceptional racecraft." · one span: Oracle Red Bull Racing, `#1E41FF`, race number 1, race driver, no boundaries · standing: position 2, 402.5 points, 7 wins, 14 podiums, provisional null · synced, fresh |
| **Scenario B**, partial | `partialDriverProfileFixture()` with `_neverSynced`; test 'a partial profile renders without claiming detail freshness' | Same identity with permanent number, nationality, birth facts and biography null, no standing; same span; not materialized → "Some profile information is unavailable" |
| States 5 | 'a 404 with a real summary keeps the content visible' | Scenario B's fixture + 404 → same notice |
| States 6 | 'a non-blocking failure keeps cached content visible'; golden `entity_detail_cached_failure` | Scenario A + network failure → "Update failed" |
| States 7 | `entity_detail_state_test.dart` 'a stale materialized detail stays visible and reports stale' | Scenario A + `staleAfter` passed → "Details may be outdated" |
| States 8 | 'a span with no observed boundary never reads as a full season' | Verstappen defaults; span Oracle Red Bull Racing with **no race number, no colour**; no standing → board shows **#33** (permanent fallback). A whole, consistent profile |
| States 9 | 'mid-season spans are both shown, never flattened' | Spans only: BWT Alpine Formula One Team from round 7 (open, relevant); Williams Racing until round 6 |
| States 10 | 'no team association shows no team section or fabricated name' | Spans only: constructor `not-synced-team`, team name null |
| States 11 | 'a reserve role reads as a localized role, never blank' | Spans only: BWT Alpine Formula One Team, reserve |
| States 12 | 'an unranked entrant with zero statistics shows no false zero' | Standing only: position null, 0 points, 0 wins, podiums null |
| States 14, 15 | `seasonDriverCardsFixture()` (Explore collection cards) | Plate only. "Unaffiliated Entrant" #55, no code, no nationality. "Reserve Entrant": no number, no code, no nationality. These cards are internally consistent identities; a collection card is also how a partial profile arises in the app |

**Coverage limits (not invented):**
- **No full mid-season profile.** No test supplies a consistent identity
  together with two spans; the mid-season case is shown as the span list only.
- **No profile with neither number nor code**, nor one with a code but no
  number. The plate rules for those come from collection cards (frames 14–15)
  and from CSS (`dp__plate--code`, untested with data).
- **No provisional standing** in any profile fixture: frame 13 shows the chip
  vocabulary only.
- **No team colour other than `#1E41FF`**, and no red team colour beside the
  Red Oxide board (see issue DD-09).
- **No long names.** Longest: "BWT Alpine Formula One Team". Long text is
  exercised by Spanish copy ("Participación en la temporada", "Desde el inicio
  de la temporada", "Dorsal de la temporada") and 200% text.
- **No media.** `content/media/media-rights.json` is empty and no driver
  fixture has media. No portrait was generated, borrowed or drawn.
- API text stays as delivered on the Spanish pages: "Dutch", "Hasselt,
  Belgium", team names, the English biography.

## Information preservation (audit §3.8)

| ID | Element | Prototype |
|---|---|---|
| D01 | Full name | Plate `h1`, condensed 40px, wraps, never truncated |
| D02 | Hero number | Number board: relevant race number, else permanent number; omitted when both are null (frame 15). `#` kept. **Refinement:** labelled "Race number" or "Permanent number" by source |
| D03 | Short code | On the board under the number; becomes the board's figure when there is no number |
| D04 | Hero team name | **Moved**: the relevant team is the first participation row directly under the plate (difference 3) |
| D05 | Nationality | **Once**, in the plate; screen readers hear "Nationality: Dutch" (difference 2) |
| D06 | Portrait | Decorative layer behind the plate; absent / loading / failed render identically, with no icon (difference 1; geometry in frame 16) |
| D07 | Team link | First span row, only when the relevant team name resolves; label "Open team {name}"; `/constructors/:id` with the profile's season |
| D08 | Relevant span beside the team | Always visible in the link row (Flutter: only with several spans) |
| D09 | Team accent | 12° tick in the team colour on the link row only, as Explore |
| D10 | Position | Figure, or the word "Unranked" / "Sin clasificar" (frame 12). Section absent without a standing |
| D11 | Points | Locale decimal ("402.5" / "402,5"; "0" kept) |
| D12, D13 | Wins, podiums | Shown when non-null; confirmed zero kept; null omitted (frame 12) |
| D14 | Provisional | Outline chip under the figures (frame 13) |
| D15 | Team per span | Row title; "Team unavailable" in italic when unresolved (frame 10); never the id |
| D16 | Role per span | "Race driver" / "Reserve driver" / "Test driver" / "Role unavailable" |
| D17 | Race number per span | Labelled "Race number" / "Dorsal de la temporada", only when present |
| D18 | Span boundary | Every row, first and emphasized; ADR 0026 D6 wording; the space before a round number is non-breaking |
| D19–D21 | Birth date, place, permanent number | Profile fact grid, `yMMMd` with no time-zone conversion; same `hasProfileFacts` gate (a permanent number alone never opens it) |
| D22 | Biography | "About" paragraph, trimmed, only when non-blank |
| D23 | Notices | One notice, Flutter's precedence (frames 5–7, Scenario B) |
| D24 | Standings action | "View drivers' standings" link row, only with a standing |

Not rendered, as in Flutter: career statistics, given and family names as
separate fields, country code or flags, any identifier. **The season year is
now rendered** (refinement, difference 10); Flutter does not print it.

## Visual decisions

**A driver plate.** GP Detail reads round figure | seam | name, left to
right. Driver Detail mirrors it and scales up Explore's driver row (name left;
number and code right):

1. **Plate (full-bleed, square).** Condensed 40px name, nationality under it,
   and the competition number on a **Red Oxide number board** that runs off
   the right edge with a 12° cut. Red Oxide stays an identity surface (Home's
   round block, GP's seam). The board's edge is a skewed layer, so the angle
   is 12° at any height; GP's clip-path winner cell gets steeper on tall rows
   (GPD-10).
2. **Season participation directly under it.** The relevant span is the one
   team link (tick, team name, Chalk arrow disc = "opens an entity", as on
   Home and GP). Every row leads with its boundary, then role, then the
   labelled race number, so a mid-season move reads as two stints and nothing
   reads as a full season.
3. **Championship in Standings' grammar.** Position figure | hairline 12° seam
   | points, then wins and podiums as a labelled line. The hairline is
   deliberately not Red Oxide: Standings reserves the oxide seam for the
   confirmed leader, and Driver Detail shows no leader state.
4. **Profile and About as plain typography.** A labelled fact grid and a
   paragraph; no rounded cards anywhere on the screen.

**Without a portrait** the plate is complete by construction: name, number
board and band are the composition. A future portrait would sit behind the
plate under a left-weighted scrim (frame 16), without changing its height.

**12° audit:** board edge (identity), team tick (data accent, Explore
precedent), championship seam (hairline). Nothing else is slanted.

**Type.** Archivo only. Expanded figures (board 96px, position 72px, points
40px, wins/podiums 20px), condensed names (driver 40px `wdth` 78, teams 19px
`wdth` 84), labels 13–14px, nothing under 13px. Tracking floor −0.04em.

**Large text / narrow.** Container queries:
- Plate under 23em (320dp, or any plate at large text), or a two-or-more-digit
  board under 30em: the name takes the full width; nationality and the board
  share the lower row (figure 72px). The 30em rule exists because "#33" at
  390dp squeezed "Verstappen" into a mid-word break (found in pass 0).
- Championship under 19em: points move under the position; the seam is dropped.

## Behaviour preserved

- Root-navigator detail: back only; no bottom navigation, refresh action,
  pull-to-refresh or ready-state progress, as in Flutter.
- Exact season: the team link and the standings link carry the profile's
  season (static anchors here: `#constructors/red-bull`,
  `#standings/drivers/{season}`, built from the profile season). `openEntity` loop collapse and branch
  restoration are Flutter behaviour, not simulable here (XS-19).
- Relevance order from `sortBySpanRelevance`: open span first, then latest
  start. Only the first span is a link, and only with a resolved name.
- Cached content always stays; notices never replace it; one notice at a time
  with Flutter's precedence. No timestamp is shown (audit §4.3).

## Differences from Flutter that need approval

**Approval status after the 2026-11-08 review.** The owner provisionally
approved the visual direction: expressive identity plate, large number
treatment, current constructor within Season participation, championship
statistics in the existing numerical hierarchy, compact personal information
and biography, an image-free typographic composition, and partial data
without invented values. The table maps that approval onto the nine
differences. A difference the review did not cover is **not** approved.

| # | Difference | Status | Basis |
|---|---|---|---|
| 1 | Hero → driver plate; no placeholder icon | **Covered** (provisional) | "Expressive driver identity plate", "large competition-number treatment", "works without a portrait". Condition: portraits stay supported (Media behaviour); portrait composition unvalidated (XS-15) |
| 2 | Nationality shown once | **Pending decision** | Not named in the review. Same kind as GP G-1, which was approved separately (backlog DRV-01) |
| 3 | Team merged into Season participation | **Covered** (provisional) for the merge | "Current constructor within Season participation". The **section-order change** (participation before Championship) is visible in the reviewed screenshots but was not named: confirm (DRV-01) |
| 4 | Participation fields restyled | **Partly covered** | The participation block's layout is approved. Visually hidden "Role" / "Participation" labels (read by screen readers only) are a semantics choice not named in the review (DRV-01; XS-02) |
| 5 | Championship as figures; standings link row | **Covered** (provisional) | "Championship statistics using the existing numerical hierarchy"; "team and standings navigation" listed as preserved |
| 6 | Profile and About without cards | **Covered** (provisional) | "Compact personal information and biography sections" |
| 7 | Reading order (heading first) | **Pending decision** | Not reviewed; cross-screen policy XS-03 |
| 8 | Team accent as the 12° tick | **Covered** (provisional) | "Constructor accent treatment" listed as preserved |
| 9 | Skeleton shape | **Pending decision** | Development states not part of the review (DRV-01) |
| 10 | **New:** season line on the plate | **Pending decision** (requested by the owner, delivered) | DR-02, backlog DRV-02 |
| 11 | **New:** number-source label on the board | **Pending decision** (requested by the owner, delivered) | DR-03, backlog DRV-03 |

Details of 1–9 as originally delivered:

1. **Hero → driver plate.** The rounded hero card becomes a full-bleed band;
   the `#1 · VER` chip becomes the number board. With no portrait, the plate
   shows no `person_outline` placeholder (Flutter shows one for absent,
   loading and failed alike). Related to XS-15.
2. **Nationality shown once** (plate) instead of hero subtitle + Profile
   field. The Profile field label survives as screen-reader text. Same kind
   of decision as GP G-1 (dates and location once).
3. **Team section merged into Season participation.** The team name leaves
   the hero subtitle; the separate "Team" section disappears; the relevant
   span row is the team link. A single-span driver now sees the team name
   once instead of three times. **Section order changes**: participation
   moves above Championship (Flutter: team, championship, participation).
4. **Participation fields restyled.** Per span: team as the row title,
   boundary first, role, labelled race number. "Role" and "Participation"
   labels are visually hidden (the values describe themselves) but read by
   screen readers.
5. **Championship as figures.** Label/value rows become position | seam |
   points figures with wins/podiums inline. "View drivers' standings" moves
   from the section-header action to a ruled link row under the figures.
6. **Profile and About without cards** (fact grid and paragraph).
7. **Reading order:** name heading first, then nationality, then the board
   (Flutter: chip, then heading, then subtitle). Overlaps XS-03.
8. **Team accent** as Explore's 12° tick instead of `GvTeamRow`'s accent.
9. **Skeleton:** plate-shaped block, label, three rows (Flutter: four
   identical skeleton cards).

## Design-system extensions (proposals; nothing applied to other screens)

| Extension | Why | Where |
|---|---|---|
| Driver plate | Identity without a decorative hero; complete with no portrait; stacked variant | `.dp`, `.dp__grid` |
| Number board (skewed-layer 12° edge) | Constant angle at any height; candidate fix for GP's winner cell (GPD-10) | `.dp__plate`, `::before` |
| Portrait layer contract | Image behind, scrim, no layout change, no icon | `.dp__media` |
| Stint row (overlay link + facts list) | Participation spans with one optional entity link; boundary-first | `.st`, `.st__hit`, `.st__facts` |
| Entity disc, generalised | GP's `.cx__disc` as a stand-alone `.disc` | `.disc` |
| Championship figure group | Position \| seam \| points + labelled stats; narrow stacking | `.ch`, `.ch__main`, `.ch__more` |
| Destination link row | Ruled row + arrow for non-entity destinations (standings) | `.ch__link` |
| Fact grid | Same pattern as GP's fact rail, without the band | `.facts`, `.fact` |
| Entity-detail skeleton | Plate block + rows | `.skel__plate` |
| Season line (refinement) | Reuses Grand Prix Detail's `.gp__season` type for `seasonLabel`; no new token | `.dp__season` |
| Number-source label (refinement) | Existing field label on the board; wraps rather than widening it, never splits a word | `.dp__lab` |
| Wrapping lower row (refinement) | Stacked plate: nationality and board share a row or the board drops below; `display: contents` on the wide plate | `.dp__foot` |

Cross-screen proposals, for separate review: (a) adopt the skewed-layer
technique in GP's winner cell; (b) Team Detail and Circuit Detail should reuse
the plate, stint row and fact grid; (c) the app bar, notice, empty block and
skeleton are now copied into a second detail folder and belong in the core
(XS-09).

## Validation (reviewed version)

This section describes `validation-20261108-124338-final/`, the evidence for
the version the owner reviewed. The refinement's results are under "Refinement
validation" above.

Chrome 157 headless over the DevTools Protocol, `mobile: true`, DPR 2, 200%
text = root font size. Script `capture.mjs` (copied unchanged from GP Detail)
and `a11y.mjs` (new, no dependencies) are in the folder.

20 runs: EN/ES × A/B × 390×844 and 320×693, each at 100% and 200%, plus the
states gallery at 390 and 320 @200% in both languages.

| Check | Result (all 20 runs) |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width |
| Elements outside the viewport | 0 |
| Clipped text (overflow hidden) | 0; the app-bar title never needed its ellipsis |
| Text spilling out of its box | 0 |
| Text under 12.5px | 0 |
| Touch targets < 48×48 | 0 (`*-touch-targets-320*.txt`: Back 48×48; team link 320×94, 320×332 at ES 200%; standings row 320×56, 320×96 at ES 200%; gallery 13/13) |
| Archivo loaded | yes |

Document heights (EN / ES): A 995 / 995 at 390, 1841 / 1963 at 320 @200%;
B fits one 390 screen in both languages, 851 / 965 at 320 @200%.

**Contrast (new pairs):** Chalk on the board 4.63 (light stop) to 5.43
(oxide) to 7.80 (deep stop); the 15px code is bold and sits low on the board
(≥5.4 in practice). Chalk name on the plate 11.8 (lit corner) to 13.4;
nationality (secondary) on the plate 6.18–7.02; Chalk / secondary on ground
15.19 / 7.95; on-chalk on the disc 15.19. Non-text: hairline seam 1.88
(decorative; figures are labelled), team tick `#1E41FF` 2.83 (decorative;
never the only carrier of identity).

**Screen reader (Chrome accessibility tree, `accessibility-tree.txt`):**
Back → "Driver" → [notice] → heading "Max Verstappen" → "Nationality: Dutch"
→ "#1 · VER" → heading "Season participation" → link "Open team Oracle Red
Bull Racing" → Participation "From season start", Role "Race driver", Race
number "1" → heading "Championship" → Position 2, Points 402.5, Wins 7,
Podiums 14 → link "View drivers' standings" → Profile terms → About. The team
name is announced once (inside the link label); the board's visual digits are
`aria-hidden` behind one text alternative. Same structure in Spanish.

**Reduced motion:** the only motion is the 3px nudge on the disc and the
standings arrow; under `prefers-reduced-motion: reduce` both computed
durations are `0s` (checked in `a11y.mjs`). No animation anywhere.

**Impeccable** (`impeccable detect`, engine 4.8.0):
- First run: 16 × warning **cramped-padding** (every plate) and 6 × advisory
  **repeating-gradient stripes**.
  - Cramped padding was **genuine** in Scenario B: with no nationality line,
    the name's descenders sat on the band's bottom hairline. Fixed with a
    bottom inset on the name whenever no nationality follows. On the other
    plates, the trigger was the board meeting that hairline, which also drew
    a faint line across the board's base. The band's bottom hairline was
    removed; the tray-on-ground step still marks the edge.
  - The stripes were my dev-only portrait hatch, loaded on every page from
    `dd.css`. Replaced by a dashed annotation outline, moved to `states.css`.
- Final run, all six pages and three stylesheets: **0 findings, 0 advisories.**
- Impeccable's context step asks for a `PRODUCT.md` (`init`); not created,
  because this brief keeps every change inside this folder. The incumbent
  Primer V2 CSS was used as the design authority, as on the earlier screens.

**Defects found and fixed during validation:**
1. At 200% the stretched skewed team tick leaned past the left edge (outside
   check). Its height is capped at 64px.
2. Two-digit boards (#33, #55) squeezed the name into mid-word breaks at
   390dp ("Verstap/pen", "Unaffilia/ted"). Wider boards now stack below 30em.
3. Spanish 200%: "Desde la ronda / 7" orphaned the round number. The space
   before round numbers is now non-breaking (ARB copy unchanged).
4. Scenario B's name touching the band edge (Impeccable, above).
5. Board base crossed by the band hairline (Impeccable, above).
6. Screen readers lost the "Nationality" label once it was shown only in the
   plate. Restored as visually hidden text.

## Critical assessment

| | Assessment |
|---|---|
| 1. Consistency with Primer V2 | **Strong.** Same tokens, Archivo axes, Chalk disc, notice, app bar and seam grammar; Red Oxide stays an identity surface |
| 2. Distinct identity composition | **Good, with a caveat.** The plate is clearly not GP's band, but the oxide board with a slanted left edge is a close relative of Home's "Round 23" block. Family resemblance or repetition: owner's call |
| 3. Motorsport personality | **Good.** The number board reads as a race-number panel and carries the screen. It is the most expressive detail screen so far |
| 4. Typography and numerals | **Good.** Three clear figure tiers (board, position, points). Position and points labels sit at different heights; deliberate bottom alignment, but it can read as unaligned |
| 5. Information density | **Good** for A (fits ~1.2 screens at 390). B is very short, which is honest for a partial profile |
| 6. Missing-image presentation | **Strong** with a number; **weak** without one: the bare plate (frame 15) is just a name on a band |
| 7. Season and team clarity | **Good.** Boundary-first rows make stints explicit; the one link is unmistakable. **Weakness:** the season year is still invisible (DD-01). *Refinement: now shown as a secondary line on the plate* |
| 8. Navigation usability | **Good.** One entity link (disc), one destination link (arrow), Back. Hit areas are generous |
| 9. Accessibility | **Good in emulation:** AA contrast, 48px targets, no clipping at 200%, a coherent accessibility tree. Not tested with TalkBack |
| 10. Localization | **Good.** Spanish dates, decimal comma, long headings wrap. "Dorsal de la temporada 1" wraps onto three lines at 200%: correct, not elegant |
| 11. Functional fidelity | **Strong** on data (fixture values only, Flutter's gates). Nine presentation differences need approval |
| 12. Incomplete information | **Adequate.** Every absence is handled without placeholders, but partial profiles look sparse and the stacked plate leaves an empty corner (DD-05) |

What still looks weak or generic:
1. **The championship block** is close to the generic "big number, small
   label, supporting stats" template. It is anchored in Standings' grammar,
   but it is the least original part of the page.
2. **The name-only plate** (no number, no code) has no composition left
   beyond type on a band.
3. **The stacked plate with no nationality** (Scenario B at 320, and at 200%)
   leaves a large empty area left of the board.
4. **The single-span participation row** has a lot of empty width; the disc
   floats far from the text on wide phones.
5. **Board vs Home's round block:** the same shape language twice in the app
   may dilute both.

## Issues discovered (not fixed; for review)

**Consolidated into `../DESIGN-BACKLOG.md` on 2026-11-08.** The backlog is
now the place to track them; this table is kept as delivered, with the
mapping:

| Local | Backlog | Note |
|---|---|---|
| DD-01 | DRV-02 | Refinement delivered (season line); awaiting review |
| DD-02, DD-08 | DRV-04 | One fixture-coverage item |
| DD-03 | DRV-03 | Refinement delivered (number label); awaiting review |
| DD-04 | XS-22 | Shared entity-detail notice, so cross-screen |
| DD-05 | DRV-05 | Taller labelled board makes the empty corner larger at 200% |
| DD-06 | XS-14 | Folded into long names (no new item) |
| DD-07 | DRV-06 | |
| DD-09 | DRV-07 | |
| DD-10 | XS-15 | Folded into media (no new item) |
| Localization (refinement) | XS-23 | API free text has no Spanish |

| ID | Issue | Notes |
|---|---|---|
| DD-01 | **Season year is never printed** (Flutter behaviour). From a historical Standings row the page shows that season's data with no visible year. Team Detail has the same gap | Not rendered: "only display information supported by the current presentation rules". Proposal needs an owner decision |
| DD-02 | **Fixture defaults leak identity.** Most driver tests inherit Verstappen's code, number, nationality, birth facts and biography under other names. No consistent full mid-season, no-number or long-name profile exists | Flutter test change, out of scope here |
| DD-03 | **Number source is invisible.** "#33" (permanent fallback) looks identical to a season race number (Flutter does the same) | A source-aware visible label is possible from existing ARB keys; needs a decision |
| DD-04 | **Partial notice uses the offline icon** (`GvOfflineNotice` cloud-off) although the cause is missing detail, not connectivity. Wording is correct | Flutter behaviour; reported only |
| DD-05 | Stacked plate with no nationality leaves an empty lower-left area | Visual polish |
| DD-06 | The 30em stacking rule keys on digit count; a one-digit board with a long single-word name between 23em and 30em is untested | Needs long-name data (XS-14) |
| DD-07 | No leader treatment at position 1, unlike Standings (S-5). Consistent with Flutter | Owner choice |
| DD-08 | Provisional chip shown only as vocabulary; no profile fixture | Data |
| DD-09 | Team accent ticks use real team hues; a red team colour would sit beside the Red Oxide board. Untested | Data |
| DD-10 | Portrait composition validated by geometry only | XS-15, media rights |

## Open issues requiring approval

- After the 2026-11-08 review: differences 2, 7 and 9, the hidden labels in
  4, and the section order in 3 (backlog DRV-01, XS-03).
- The refinement itself: season line (DRV-02) and number-source label
  (DRV-03).
- Superseded: "DD-01 (season year) and DD-03 (number source)" and "the nine
  differences" as originally listed.
- Shared backlog items that apply here unchanged: XS-01 light theme, XS-02
  TalkBack, XS-03 reading order, XS-05 Android font scaling, XS-09 core
  consolidation, XS-14 long names, XS-15 media, XS-16 device testing, XS-19
  navigation behaviour in Flutter.
