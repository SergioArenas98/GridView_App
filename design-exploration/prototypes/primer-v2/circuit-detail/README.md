# Primer V2: Circuit Detail visual prototype

The fourth Primer V2 detail screen. No other prototype and no Flutter code
was modified. The central decision log and backlog were **not** updated: this
prototype has not been visually reviewed yet.

**Status: delivered, awaiting review.** Nothing here is approved, and nothing
authorises a Flutter change.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | **Scenario A**: complete circuit (location, all four physical facts, lap record, related Grand Prix) |
| `partial.html` / `partial.es.html` | **Scenario B**: partial circuit (no physical facts, no lap record, no media, never synced → partial notice; also no related event, as in the golden) |
| `no-event.html` / `no-event.es.html` | **Scenario C**: complete circuit with no Grand Prix in the selected season |
| `states.html` / `states.es.html` | **Development-only** state fixtures (16 frames). Not app UI, not circuit data |
| `build.py` | Generates the eight pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of the shared foundation (md5 `0d78851e…`, same as every other screen) |
| `cd.css` | Circuit Detail styles. App bar, notice, empty block, button and section spacing are copied from `../team-detail/td.css`; two chip additions from `../grand-prix-detail/gpd.css`; both marked |
| `states.css` | Gallery styles, copied from Team Detail; the media-geometry marker targets the circuit media slot |
| `validation-20261108-171413-final/` | Screenshots, metrics, touch targets, accessibility tree (with descriptions), layout check, `data-check.txt`, Impeccable output (source and rendered), and the five scripts |

No JavaScript: the screen has no presentation preference to simulate.

## Sources read

- `lib/features/circuits/presentation/circuit_detail_screen.dart` (`_body`,
  `_facts`, `_lapRecord`, `_relatedGrandPrix`, `_CircuitHero`),
  `application/circuit_detail_providers.dart`
- `lib/features/shared/domain/entities/entity_profile.dart` (`CircuitProfile`:
  `media`, `hasPhysicalFacts`, `hasLapRecord`), `circuit.dart` (`Circuit`,
  `LapRecord`), `season_card.dart` (`RelatedGrandPrixSummary`)
- `lib/core/database/daos/calendar_dao.dart` (`circuitProfile`,
  `_lapRecordDriverName`, `_relatedGrandPrixFrom`)
- `lib/features/shared/presentation/entity_formatting.dart` (`kilometres`,
  `count`, `year`, `direction`, `lapTime`, `calendarDate`, `joinDetails`),
  `result_formatting.dart` (`elapsed`), `domain_status.dart`
  (`requiredEventStatusLabel`, `toneForEventStatus`, `weekendFormatLabel`)
- `lib/features/shared/domain/media/media_slot_policy.dart`
  (`circuitLayout`), `widgets/entity_detail_scaffold.dart`,
  `application/entity_detail_state.dart`, `lib/app/router/entity_navigation.dart`,
  `grand_prix_event_info.dart` and `explore_cards.dart` (the season each
  origin hands over)
- `test/screens/entity_detail_widget_test.dart` ('circuit detail' group),
  `screen_golden_test.dart` (circuit complete / partial) and the goldens
  `circuit_detail_complete.png`, `circuit_detail_partial.png`,
  `test/application/entity_detail_state_test.dart`,
  `test/database/entity_collection_read_model_test.dart`,
  `calendar_dao_test.dart`, `test/navigation/entity_graph_navigation_test.dart`,
  `grand_prix_widget_test.dart` (Navigation group),
  `test/a11y/identifier_leak_test.dart`, `test/support/entity_fixtures.dart`,
  `router_harness.dart`
- `lib/l10n/app_en.arb`, `app_es.arb`
- Audit §2.2 row 11, §3.10 (CI01–CI18), §5.6, §8; `../DESIGN-DECISIONS.md`,
  `../DESIGN-BACKLOG.md`, the Grand Prix, Driver and Team Detail prototypes

## What the current Flutter screen does (summary)

- **Title** always "Circuit" / "Circuito" (`circuitTitle`). Root navigator:
  back only, no bottom navigation, no refresh control. Route
  `/circuits/:circuitId`; the id is never displayed.
- **Hero** (`_CircuitHero`, `GvHeroCard`): 16:9 `GvRemoteImage` of the
  circuit's **own** media, `MediaSlotPolicy.circuitLayout` (layout diagram,
  then hero, then thumbnail). Heading = `circuit.name`; subtitle =
  `joinDetails([locality, country], ', ')`. A selected layout diagram is
  **informative** (`circuitLayoutImage(name)`, "Track layout of …"); any
  other image is decorative. No asset, loading, rejected or failed: the
  `route_outlined` placeholder icon, decorative.
- **Section order:** hero → Circuit facts → Lap record → This season's Grand
  Prix.
- **Circuit facts** only when `hasPhysicalFacts` (any of length, corners,
  direction, first GP year). Length `lengthKilometers(decimalPattern(m/1000))`
  ("7.004 km", "7,004 km"); corners `decimalPattern`; direction shown
  whenever non-null (unknown → "Direction unavailable"); first GP year without
  grouping.
- **Lap record** only when `hasLapRecord` (a record with a time **or** a
  year; a holder id alone is not enough). Time via the shared elapsed
  formatter ("1:46.286"); the Driver row only when a driver id exists, with
  `lapRecordDriverName ?? "Driver unavailable"`; year when present. The
  holder is not a link.
- **Related Grand Prix** (`circuitRelatedGrandPrix`, "This season's Grand
  Prix"): the season's own event (earliest round at this circuit in that
  season, from local data). A `GvContentCard`: name (or
  `grandPrixNameUnavailable`), `joinDetails([Round N, yMMMd date])`, a status
  chip when `status != null` (unknown → "Status unknown"), a format chip when
  `format != null`. Semantic label "Open {name}"; children excluded. Tap →
  `openEntity(/calendar/{season}/{round}, season: event.season)`.
- **No related event:** a card with one field, label `seasonLabel(ready.season)`
  ("2026 season"), value "No Grand Prix this season". The **only** place the
  year is printed (audit §8).
- **States** (shared scaffold): loading skeleton, season unavailable, not
  found (missing row or unresolved stub), first-load error, ready; one
  notice by precedence "Update failed" > "Some profile information is
  unavailable" (not materialized) > "Details may be outdated".
- **Not rendered:** coordinates, map, lap count, race distance, endDate,
  officialName, countryCode, a history paragraph, holder navigation.

## Fixture provenance

**Rule:** each rendered profile is one test's whole input, never merged with
another. Harness season 2026; default sync metadata = synced (no notice).

| Use | Source | Values (verbatim) |
|---|---|---|
| **Scenario A**, complete | `router_harness.dart` `defaultFakeCircuits()` = `circuitProfileFixture()`; 'renders physical facts, the lap record and the event'; golden 'circuit detail complete' | "Circuit de Spa-Francorchamps", Stavelot, Belgium, 7004 m, 19 corners, clockwise, first GP 1950; record `valtteri-bottas` 1:46.286 (2018), holder "Valtteri Bottas"; related: 2026 round 13 "Belgian Grand Prix", 2026-07-24, upcoming, sprint |
| **Scenario B**, partial | `screen_golden_test.dart` 'golden: circuit detail partial' (`syncMetadata: (key) => null`) | "Autodromo Nazionale Monza", Monza, Italy; every fact null; no lap record; no related event; never synced → "Some profile information is unavailable" |
| **Scenario C**, no event | 'no related event this season is a valid state' (`circuitProfileFixture(withRelated: false)`, route `/circuits/monza`) | Scenario A's profile without the related event; the route id `monza` is never displayed |
| States 1–4 | Shared scaffold states | ARB copy only |
| States 5, 6 | Shared notice rules over Scenario A's sheet | "Update failed", "Details may be outdated" |
| State 7 | 'missing physical facts hide the card entirely' | Spa, every fact null, `withLapRecord: false`, related event kept |
| State 8 | 'an unknown direction uses a safe localized fallback' | Scenario A with `CircuitDirection.unknown` (sheet only) |
| State 9 | `entity_collection_read_model_test.dart` 'an unresolvable lap-record holder yields no name, never an id' | `LapRecord(driverId: 'ghost-driver', year: 2004)`, no time, name null (record only) |
| State 10 | 'a missing lap-record driver uses localized copy, not an id' | Default record, `lapRecordDriverName: null` (record only; see CD-02) |
| State 11 | 'an unnamed related event uses localized unavailable copy' | `relatedGrandPrix(name: null)` (related section only) |
| State 12 | `seasonCircuitCardsFixture()` Monza card's `relatedGrandPrix` | Round 12 "Italian Grand Prix", 2026-07-10, standard; status keeps the fixture default (upcoming). The same `RelatedGrandPrixSummary` type, rendered alone |
| States 13, 14 | Vocabulary only (no fixture) | "Status unknown" / "Format unknown" chips; the three direction labels |
| States 15, 16 | `_CircuitHero` media rules; `calendar_dao_test.dart` `spa-layout-v1` (`circuitLayout` asset, no bytes) | Geometry only: diagram slot (labelled), loading, failed |

**Coverage limits (not invented):**
- **No circuit media** in any profile fixture; `content/media/media-rights.json`
  is empty. Nothing was downloaded, drawn or generated; no track outline
  appears anywhere.
- No **counter-clockwise** circuit; no record with a **time but no holder id**;
  no widget fixture for a **holder-only** record (the gate is verified in
  `data-check.txt` from the rule, not rendered); no lap time over an hour.
- Related event: no **null or explicit-unknown status**, no completed, live,
  postponed or cancelled event, no missing start date, no unknown format.
- No circuit opened for a **season other than 2026**; no circuit without
  locality or country; no locality/name longer than "Circuit de
  Spa-Francorchamps" (28 characters).
- API text stays as delivered on the Spanish pages: circuit names,
  "Stavelot, Belgium", "Monza, Italy", "Belgian Grand Prix", "Valtteri Bottas".

## Information preservation (audit §3.10, CI01–CI18)

| ID | Element | Prototype |
|---|---|---|
| CI01 | Circuit name | Sheet `h1`, `circuit.name` verbatim; wraps, never truncated; a hyphenated word of ≤18 characters is kept whole, longer ones may break at the hyphen only |
| CI02 | Locality | Location line, `joinDetails([locality, country], ', ')`; omitted part leaves no separator |
| CI03 | Country | Same line ("Stavelot, Belgium"); absent line when both are null |
| CI04 | Circuit image | 16:9 slot below the location, **only when an asset is selected**: diagram informative (`role="img"`, "Track layout of {name}"), photograph decorative, loading = empty frame, failed = decorative route icon. No asset: no slot (difference 1). Frames 15, 16 |
| CI05 | Length | Dimension line, `lengthKilometers` with the locale decimal ("7.004 km" / "7,004 km"); absent when null, never 0 |
| CI06 | Corners | Figure, `decimalPattern`; absent when null |
| CI07 | Direction | Word from the ARB (`Clockwise` / `Counter-clockwise` / `Direction unavailable`), omitted only for null; a decorative rotate glyph for the two known directions only (frames 8, 14) |
| CI08 | First GP year | Figure, no grouping ("1950") |
| CI09 | Lap-record time | Large timing figure, shared elapsed format; absent without a time (frame 9) |
| CI10 | Holder | Row only with a driver id; unresolved → "Driver unavailable" / "Piloto no disponible", secondary style; never the id (frames 9, 10). No link |
| CI11 | Record year | Plain year ("2018", "2004") |
| CI12 | Related GP name | Row title; null → "Grand Prix name unavailable", secondary style (frame 11) |
| CI13 | Round | "Round" label + figure; read as "Round 13" (`roundLabel`) |
| CI14 | Start date | `yMMMd` ("Jul 24, 2026" / "24 jul 2026"); absent when null |
| CI15 | Status | Chip only when non-null; explicit unknown = dashed "Status unknown" (frame 13); never inferred from the date |
| CI16 | Format | Tray chip when non-null ("Sprint weekend", "Standard weekend") |
| CI17 | No-event statement + season | Season line + "No Grand Prix this season"; no card, no link (B, C) |
| CI18 | Notices | One notice, scaffold precedence (B, frames 5, 6) |

Not rendered, as in Flutter: coordinates, `countryCode`, lap count, race
distance, `endDate`, `officialName`, any identifier (`data-check.txt` scans
every page).

## Visual decisions

**A circuit sheet, not a hero card.** Driver Detail's identity is the oxide
number board; Team Detail's is the entrant banner with a livery rail. A
circuit has neither a number nor a colour, and its imagery is unavailable,
so the identity is built from what it does have: a long name and four
physical facts. The tray band reads as a technical sheet:

1. **Name** in Primer's most condensed cut (`wdth` 72, 40px, 36px on narrow
   sheets), balanced; **location** in the secondary colour.
2. **Media slot** (when an asset exists): a 16:9 frame with corner
   registration marks, so a future layout diagram sits like a drawing above
   its title block.
3. **Circuit facts** as the sheet's lower half, under a ruled kicker: the
   physical facts are stable circuit identity, so they live in the sheet;
   everything season-scoped stays outside it.
4. **Length as a dimension line**: the value sits between two arms whose
   outer ends carry 12° ticks, the architectural dimension tick. It is
   notation, not a scale: the arms are always full width.
5. **Corners, direction, first Grand Prix** as one ruled row of figures (the
   direction is a word with a rotate glyph in Ember), wrapping in reading
   order.

**Lap record as a timing readout.** One large expanded figure (48px) for the
time, then a ruled row with holder and year. No position figure, no seams,
no row grammar, so it reads neither as a standing nor as a classification.
Unavailable copy is set lighter and secondary: a statement, not a name.

**Related Grand Prix as a preview of its destination.** The row repeats
Grand Prix Detail's identity grammar in miniature (round figure | 12° oxide
seam | event name) and uses the Chalk disc, Primer's entity-destination
affordance (GP Detail's circuit row, Driver Detail's team row). Going
Circuit → Grand Prix → Circuit lands on two screens that visibly point at
each other.

**12° audit:** the two dimension ticks and the round seam. Nothing else is
slanted. Red Oxide appears only in the round seam (Grand Prix Detail's
signature, appropriate for a link to it).

**Type.** Archivo only. Figures expanded (length 40px, record 48px, round
44px, corners/year 28px); names condensed (circuit 40px `wdth` 72, event
19px `wdth` 84); labels 13–14px; nothing under 13px.

## Missing media

- The design is complete without imagery: Scenario A has no slot, no empty
  hero and no placeholder icon.
- **No layout shift:** the slot exists only when the profile selected an
  asset, which is known before first paint. Its 16:9 geometry is then
  reserved: loading and failed keep the same size (frame 16).
- **Informative imagery:** a selected `circuitLayout` asset gets
  `role="img"` and the existing `circuitLayoutImage` label; it conveys the
  track shape, which no adjacent text states. A photograph (hero or
  thumbnail fallback) is decorative, as in Flutter.
- Failed keeps Flutter's decorative `route` placeholder. The existing but
  unused ARB string `circuitLayoutPlaceholder` ("Circuit layout
  unavailable") was **not** used (CD-01).
- Not validated: a real diagram's crop and legibility at 320dp, light/dark
  diagram artwork on the tray, or a photograph inside a frame designed for
  diagrams (CD-12).

## Season context

- Origins (unchanged): Explore passes the card's season
  (`explore_cards.dart`); Grand Prix Detail passes the event's season
  (`grand_prix_event_info.dart`); a deep link resolves the local current
  season; season unavailable is the shared retry state (frame 2). No year is
  hardcoded: `build.py` reads `profile.season` (`data-check.txt` renders 2024
  from the same code).
- **Proposal:** the season line ("2026 season" / "Temporada 2026",
  `seasonLabel` with the ready state's season) leads the related section in
  **both** states, under "This season's Grand Prix". Flutter prints it only
  in the no-event state.
- **Why not in the header** (unlike Driver DR-02 and Team): circuit identity
  is stable. Putting a year above the name would suggest the circuit, its
  length or its lap record are season-specific. The year sits exactly where
  the season-scoped content starts.
- Risk: when opened for a past season (e.g. from a 2024 Grand Prix), the
  heading still says "This season's Grand Prix" (CD-08); the season line
  states which season is meant.

## Navigation

- Circuit → related Grand Prix only: `href="#calendar/{season}/{round}"`,
  the event's own season and round (`data-check.txt`). No other destination
  was added; the record holder is not a link; no bottom navigation.
- Loop protection is Flutter behaviour, not simulable in HTML: `openEntity`
  pops instead of pushing when the destination equals the origin route, so
  Grand Prix → Circuit → the same Grand Prix returns to the existing route
  ('Grand Prix → Circuit → the same Grand Prix pops'). Unchanged (XS-19).

## Localization

- Labels, direction values, notices, round, season and date patterns come
  from the ARB files and Intl patterns: `yMMMd` "Jul 24, 2026" / "24 jul
  2026"; the locale decimal "7.004" / "7,004".
- The lap time is **not localized** in Flutter (`ResultFormatter.elapsed`):
  "1:46.286" in both languages, so the Spanish page shows a decimal point in
  the time beside a decimal comma in the length. Faithful, but worth knowing
  (CD-13).
- Long Spanish strings exercised: "El Gran Premio de esta temporada",
  "Sin Gran Premio esta temporada", "Fin de semana al sprint", "Primer Gran
  Premio", "Parte de la información del perfil no está disponible",
  "Nombre del Gran Premio no disponible" (frame 11).
- API names untranslated: "Belgian Grand Prix" on the Spanish page,
  "Abrir Belgian Grand Prix" as the link label (Flutter does the same).

## Differences from Flutter that need approval

| # | Difference | Affects | Notes |
|---|---|---|---|
| 1 | Hero card → circuit sheet; no 16:9 hero and no route icon without an asset; the name no longer overlays the image; slot below the location when an asset exists | Missing-media behaviour | As Driver/Team difference 1 (Team: approved with conditions). Loading/failed keep geometry and Flutter's icon |
| 2 | Circuit facts moved into the sheet; the `GvInfoCard` and section-title styling replaced by a kicker (still an `h2`) | Heading hierarchy (visual level only) | Section order unchanged |
| 3 | Length as a dimension line; other facts as a figure row; decorative rotate glyph beside the direction word | — | Words and values unchanged |
| 4 | Lap record as a timing readout; unavailable holder in secondary style | — | Text unchanged |
| 5 | Related event card → row link: round figure + oxide seam + Chalk disc; "Round N · date" split into figure and date line | — | Destination and exact season/round unchanged |
| 6 | Season line in the related state too (Flutter: no-event state only); no year in the header | Historical season context | Shares the DR-02 question, with a different placement |
| 7 | No-event card → season line + statement row | — | Copy unchanged |
| 8 | Event link semantics: label "Open {name}" kept, plus an accessible description (round, date, status, format) that Flutter excludes | Screen-reader semantics | Cross-screen XS-04 |
| 9 | Unnamed event name in secondary style | — | Copy unchanged |
| 10 | Skeleton shape (sheet block, labels, rows) | — | Flutter: hero + cards |

## Design-system extensions (proposals; nothing applied to other screens)

| Extension | Why | Where |
|---|---|---|
| Circuit sheet | Stable identity (name, location, facts, media) in one band; season content outside it | `.ch` |
| Dimension line | A length stated in technical notation, using the 12° as the tick; reusable for any single length | `.dim` |
| Facts row | Labelled figures/words wrapping in reading order, values on a shared bottom line | `.facts`, `.fact` |
| Timing readout | One elapsed time as the display figure, attribution below | `.lap` |
| Event preview row | Grand Prix Detail's identity in miniature as an entity link; reusable wherever an event is linked (Home, Explore circuits) | `.rx` |
| Season-scoped statement | Season line + plain statement for a valid absence; no empty card | `.rel__season`, `.rel__none` |
| Media drawing frame | 16:9 slot with registration marks, reserved only when an asset is selected | `.ch__media` |

Reused, not restyled: detail app bar, notice, empty block, button, chips,
Chalk disc (now copied into a fourth folder, XS-09).

## Validation (`validation-20261108-171413-final/`)

Chrome headless over the DevTools Protocol, `mobile: true`, DPR 2, 200% text
= root font size. `capture.mjs` copied from Team Detail; `a11y.mjs` copied
with the reduced-motion selector pointed at `.rx__disc` and accessible
descriptions added to the dump; `layout.mjs` adapted (sheet, record, event
row; a break at a real hyphen is allowed); `data-check.py` is new.

28 capture runs: EN/ES × A/B/C × 390×844 and 320×693, each at 100% and
200%, plus the states gallery at 390 and 320 @200% in both languages.

| Check | Result |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width, all 28 runs |
| Elements outside the viewport / clipped text / spill / text under 12.5px | 0 / 0 / 0 / 0, all 28 runs |
| Touch targets < 48×48 | 0. `*-touch-targets-320*.txt`: Back 48×48; event row 320×175 at 320dp (EN and ES), 320×307 (EN) / 320×338 (ES) at 200%; gallery 12/12 |
| Layout check (`layout-check.txt`, 32 configurations, 160 blocks) | 0 problems: no glyph collisions (name, location, kicker, length value, labels, facts, dimension arms, media frame; time, holder, year; round, name, date, seam, chips, disc); no mid-word break |
| Data fidelity (`data-check.txt`) | 0 failures: test-asserted values ("Stavelot, Belgium", "7.004 km", "1:46.286", "1950"), Spanish decimal and date, all gates (holder-only record, null vs unknown direction and status), exact link target, season line not hardcoded, no identifier and no lap count or race distance on any page |
| Reading order (`accessibility-tree.txt`) | Back → "Circuit" → h1 name → location → h2 Circuit facts → Length 7.004 km → Corners 19 → Direction Clockwise → First Grand Prix 1950 → h2 Lap record → Time → Driver → Year → h2 This season's Grand Prix → "2026 season" → link "Open Belgian Grand Prix" [description: Round 13 Jul 24, 2026 Upcoming Sprint weekend]. Frame 15: image "Track layout of Circuit de Spa-Francorchamps" |
| Reduced motion | The only motion (3px disc nudge on hover) computes to `0s` |
| Impeccable `detect` (installed 4.8.0, not updated) | **0 findings** on the eight pages and three stylesheets (`impeccable-detect.json`), and 0 on the eight pages rendered at 390×844 over a local server (`impeccable-detect-rendered.json`) |
| Archivo loaded | yes, all runs |

Document heights (EN / ES): A 854 / 854 at 390, 1417 / 1448 at 320 @200%;
B fits one screen except 320 @200% (698 / 736); C 844 at 390, 1230 at 320
@200%.

**Contrast:** Chalk on the sheet 13.41, on ground 15.19; secondary text 7.02
on the sheet, 7.95 on ground; Ember direction glyph 6.57 on the sheet;
dimension line (secondary) 7.02 and ticks (Chalk) 13.41; registration marks
7.02. Decorative only: oxide seam 2.80 on ground (as Grand Prix Detail); the
media frame's fill against the sheet 1.17 (its corners carry the edge).

**Defects found and fixed during validation:**
1. At 390 the balanced name broke after "Spa-" ("Circuit de Spa- /
   Francorchamps"). Hyphenated words of ≤18 characters are now kept whole.
2. At 200% the event row never switched to its narrow layout: the row was
   its own query container, and a container cannot query itself. The query
   now targets the section; chips also span under the disc.
3. A year-only record kept a rule above holder and year (Impeccable
   cramped-padding warning). The rule now exists only after a time.

## Critical assessment

| | Assessment |
|---|---|
| 1. Consistency with Primer V2 | **Strong.** Same tokens, axes, app bar, notice, chips and disc; the event row is GP Detail's own grammar |
| 2. Distinctiveness from Driver/Team | **Good.** No board, no colour rail, no three-figure strip, no seams between figures. The dimension line and the sheet are new. Weakest link: the tray band with a big condensed name is still the shared detail opening |
| 3. Motorsport personality | **Moderate–good.** Technical rather than racy: drafting notation, timing figure, round seam. No kerbs, flags or telemetry, by design. Without a layout diagram the screen never shows what the circuit looks like, which is the most motorsport thing about a circuit |
| 4. Circuit identity | **Good.** The name dominates; location is quiet. The 40px condensed name is the largest text on the page, as it should be |
| 5. Technical data hierarchy | **Good.** Length leads (the one dimension line), then three equal figures. Risk: the dimension line can be read as a scale bar (CD-09) |
| 6. Lap-record readability | **Strong.** One figure, two labelled attributes; reads as a timing board, not a ranking |
| 7. Related-event navigation | **Good.** Clear link, exact destination, previews GP Detail. Costs ~100px; chips wrap on narrow and large text |
| 8. Missing media | **Strong** by construction; no empty hero. But the diagram slot's placement (between location and facts) is unvalidated with real artwork |
| 9. Information density | **Good.** A fits ~1 screen at 390; nothing repeated. B is sparse (correctly: the data is sparse) |
| 10. Accessibility | **Good in emulation:** AA contrast, 48px targets, heading hierarchy h1/h2, reading order matches visual order, informative image labelled. Not tested with TalkBack |
| 11. Localization | **Good.** Long Spanish headings wrap; API text untouched; time not localized (Flutter) |
| 12. Fidelity | **Strong** on data and gates; ten presentation differences need approval |

What still looks weak or repetitive:
1. The kicker-style "Circuit facts" `h2` is visually a level below the other
   `h2`s ("Lap record") — deliberate (facts are part of the sheet) but
   inconsistent.
2. At 320dp the facts row puts "First Grand Prix" alone on a second line,
   leaving a gap beside it (CD-10).
3. The partial scenario (B) is a name, a location and a statement: complete,
   but the plainest screen in the app.
4. Large figures now appear on every detail screen (number, position,
   round, length, time); the hierarchy holds within each screen, but the
   family risks feeling uniform.

## Issues discovered (not fixed; for review)

| ID | Issue | Notes |
|---|---|---|
| CD-01 | **Unused ARB strings:** `circuitLayoutPlaceholder` ("Circuit layout unavailable"), `circuitLayout` ("Layout"), `circuitInformation` ("Circuit information") exist but no screen uses them | Failed/absent media has no text in Flutter or the prototype. Owner: keep, use or remove |
| CD-02 | **Fixture leakage:** 'a missing lap-record driver…' and 'an unnamed related event…' rename or re-route Spa's profile ("Autodromo Nazionale Monza" over Stavelot, Belgium, 7.004 km); 'Real Circuit' in the identifier test; route `/circuits/monza` with Spa's profile in four tests | Rendered only the parts each test is about (frames 10, 11). Same pattern as DRV-04 / TEAM-06 |
| CD-03 | Two fixtures describe the same venue differently: GP Detail's location "Spa, Belgium" vs the circuit's locality "Stavelot" | Different owners (event vs circuit); both rendered verbatim |
| CD-04 | **Coverage gaps:** listed under "Coverage limits" (media, counter-clockwise, time-only record, null/unknown/other event statuses, other seasons, missing location parts, long names) | Existing fixtures only |
| CD-05 | **Season shown only in the no-event state** (audit §8) | Difference 6 proposes a uniform season line in the related section |
| CD-06 | **Event link semantics** omit round, date, status and format | Difference 8; XS-04 |
| CD-07 | Partial notice uses the offline icon | XS-22 |
| CD-08 | "This season's Grand Prix" / "No Grand Prix this season" when the screen was opened for a past season | Copy is Flutter's; the season line mitigates; owner may want season-neutral copy (new copy) |
| CD-09 | The dimension line could be read as a scale | Notation only; no proportional length is drawn |
| CD-10 | Facts row at 320dp leaves "First Grand Prix" alone on the second line | Visual polish |
| CD-11 | Shared chrome copied into a fourth folder | XS-09 |
| CD-12 | Media validated by geometry only; a photograph (hero/thumbnail fallback) would sit in a frame designed for diagrams | XS-15 |
| CD-13 | Spanish page: "1:46.286" (point, unlocalized formatter) beside "7,004 km" (comma) | Flutter behaviour; reported only |
| CD-14 | Explicit "Status unknown" is a dashed chip, as elsewhere | XS-11 |

## Accessibility limitations

- All evidence is Chrome emulation; no TalkBack, no real device, no Android
  font scaling (XS-02, XS-05, XS-16).
- The event link's description is a proposal (difference 8).
- The layout image label is Flutter's; no real diagram was available to
  judge whether "Track layout of {circuit}" is a sufficient alternative.
- Light theme not designed (XS-01).

## Open issues requiring approval

- Differences 1–10.
- CD-01 (unused strings), CD-05/difference 6 (season line placement),
  CD-08 (season-relative copy), CD-06/difference 8 (link semantics).
- Not started, as instructed: Settings, any Flutter change, any update to
  `../DESIGN-DECISIONS.md` or `../DESIGN-BACKLOG.md`.
