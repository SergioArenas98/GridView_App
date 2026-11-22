# Event-absence decisions: Circuit Detail and Home (Step 49B)

**Status: decision document, 2026-11-11. Two directions accepted by the
owner (Step 49B.1) and visually approved for future implementation (Step
49B.2, §7); pending Flutter behaviour and test validation; nothing
implemented in Flutter.**

- **Circuit Detail:** C-R1 (DESIGN-DECISIONS CR-04, backlog CIR-02, "Accepted
  pending validation").
- **Home:** H-R1 (DESIGN-DECISIONS HM-01, new backlog HOME-08, "Accepted
  pending validation").
- **No new copy is approved.** C-R2 and H-R2 are not adopted.
- **Experiments:** results in §5; Flutter implementation and test notes in §6;
  owner visual review and evidence retention in §7.
- **Unchanged:** Flutter, ARB files, the database, the API contract, the
  approved prototypes and their consolidation pilots.
- **Scope:** two absence messages flagged in `STATUS-SEMANTICS-AUDIT.md`:
  - Circuit Detail "No Grand Prix this season" (audit CI1, backlog CIR-02);
  - Home "No upcoming events" (audit H4, now backlog HOME-08).
- **Code read at `e3e9f88`.** Paths are relative to `lib/` unless stated.

## Ranking

| Rank | Correction | User impact | Complexity | Needs ARB approval |
|---|---|---|---|---|
| 1 | **Home H-R1:** hide the empty Upcoming section while the hero says "Next Grand Prix" | Medium–high: **visible today** (frozen staging data, every season finale), a direct contradiction | Low: one condition in `home_screen.dart`, widget tests | No |
| 2 | **Circuit C-R1:** claim absence only when the season calendar is materialized; otherwise omit the statement | High severity (a false fact). Low exposure today: current entry points always have the event (§1.2) | Low–medium: provider + presentation + tests; no schema change | No |
| 3 | **Home H-R2:** "No other upcoming events" instead of hiding (alternative to H-R1) | Same as H-R1, keeps the section and its "View Calendar" action | Low | **Yes** (new string) |
| 4 | **Circuit C-R2:** an explicit "Grand Prix information unavailable" line instead of omitting it (on top of C-R1) | Small: better for screen readers than silence | Low | **Yes** (new string) |
| 5 | **Circuit C-R3:** persist the API's per-circuit `grandPrix` association (including an explicit null) | Low today: extends confirmed absence to seasons whose calendar was never synchronised | High: schema, migration, write path, tests | No (data only) |

Ranks 1 and 2 are independent and can ship separately. Rank 3 replaces rank 1
only if the owner prefers to keep the section; rank 4 only adds to rank 2.

---

## 1. Circuit Detail: "No Grand Prix this season" (CIR-02)

### 1.1 Existing behaviour

- **Query:** `CalendarDao.circuitProfile(season, circuitId)`
  (`core/database/daos/calendar_dao.dart`) reads the circuit row, then the
  **first** `grandPrixEvents` row matching that season and circuit
  (`orderBy round, limit 1`).
  - `relatedGrandPrix` is that row, or `null`.
  - A null circuit row, or an unresolved stub, means no profile.
- **Watching:** `watchCircuitProfile` re-reads on any change to `circuits`,
  `grandPrixEvents`, `drivers` or media.
- **Provider:** `circuitDetailStateProvider`
  (`features/circuits/application/circuit_detail_providers.dart`) takes
  freshness and materialization only from `circuit:<circuitId>:<season>`.
  `materialized` refers to the **circuit** resource, never the calendar.
- **Screen:** `_relatedGrandPrix` (`circuit_detail_screen.dart`) behaves as
  follows:
  - when `relatedGrandPrix == null` it always renders the season line + "No
    Grand Prix this season";
  - otherwise it renders a card linking to the event.
  - No other condition is checked.
- **Notices:** `entity_detail_scaffold.dart` applies the precedence update
  failed > partial ("Some profile information is unavailable") > stale. All
  three describe the circuit resource only.

### 1.2 Data evidence

| Evidence | What it establishes |
|---|---|
| Writers of `grandPrixEvents` | **`replaceCalendar`** (calendar sync and accepted bootstrap) is authoritative for a season: it deletes events missing from the delivered list. **`writeHomeSnapshot`** inserts the featured event only, additively. **`writeGrandPrixSnapshot`** inserts one event, additively. So a season can hold a few rows without its calendar ever being synchronised |
| Calendar completeness | `hasMaterializedCalendar(season, metadata, bootstrapMetadata)` (`calendar_state.dart` → `collection_materialization.dart`) is true only when `calendar:<season>` has synchronised once, or an accepted bootstrap applied this exact season. It is never derived from the row count. Calendar and Home already use it; Circuit Detail does not |
| API contract | `GET /v1/seasons/{season}/calendar` returns the ordered season list (`docs/api/gridview-api-v1.yaml`). `GET /v1/circuits/{circuitId}?season=` returns `CircuitDetail { circuit, grandPrix: GrandPrixSummary \| null }`, the server's own answer for that season |
| Circuit refresh | `refreshCircuit` (`circuit_repository_impl.dart`) parses `CircuitDetailDto` but writes only `upsertCircuits([...circuit])`. **The `grandPrix` answer is discarded** |
| Entry points | **GP Detail** "View circuit" passes the event's own season, and that event row exists. **Explore circuits** are built from that season's `grandPrixEvents` rows (`seasonCircuitCards`), so every card has an event. **No deep links** exist (`AndroidManifest.xml` has the launcher intent only) and there is no notification routing. A route without a handed-over season resolves to the current season |

**Consequence:**
- Through today's UI, Circuit Detail opens with its event row present, so it
  shows case A.
- The false absence is reachable by construction only through:
  - a future entry point (deep link, notification, lap-record or historical
    browsing);
  - a route without a season before the current calendar exists;
  - a test fixture (the approved `partial.html` comes from one).

  CIR-02's "reachable by construction, not reproduced" stands.

### 1.3 What the app can and cannot distinguish today

| Case | Distinguishable today? | How |
|---|---|---|
| **A. Known linked event** | **Yes** | A row exists for (season, circuit). It came from the authoritative calendar or from a Home or Grand Prix snapshot of that very event |
| **B. Confirmed absence** | **Yes, derivable without any schema change, but not used** | No row **and** `hasMaterializedCalendar(season)`. The materialized calendar is the complete delivered list for the season |
| **C. Unknown association** | **Yes, derivable, not used** | No row **and** the season calendar is not materialized |
| Resolving | Yes | The calendar or bootstrap metadata has not been read yet. Assert nothing, as `HomeModuleAvailability.resolving` does |

**What it cannot know:**
- **Absence for a season whose calendar was never synchronised** (e.g. a
  historical season). Only the discarded `CircuitDetail.grandPrix` could
  answer it (C-R3).
- **Changes made after the last successful calendar sync.** A materialized
  but stale calendar proves absence only as of its last check.
- **A second event at the same circuit in one season.** The query and the
  contract both carry only one event, the earliest round. This does not affect
  the absence claim.

### 1.4 Recommended safe UI behaviour (C-R1)

| State | Shown |
|---|---|
| A. Linked | Unchanged: season line + event card |
| B. Confirmed absence (calendar materialized, no row) | Unchanged: season line + "No Grand Prix this season" |
| C. Unknown (calendar not materialized, no row) | **Omit the related-Grand Prix section.** Make no claim |
| Resolving | Omit the section until known. No placeholder flicker, no claim |

- **Why omit.** It needs no new copy. Silence makes no false claim, and the
  page's own notices still describe the circuit data.
- **C-R2**, if approved, replaces the omission with an explicit line.
- **Stale calendar in B:** keep the statement. Cached content stays visible
  (the same rule as Calendar and Home). Downgrading stale to "unknown" is
  owner decision CD-2.

### 1.5 Necessary changes

- **C-R1 (no schema or persistence change).**
  - In `circuitDetailStateProvider`, or a small provider beside it, read
    `resourceSyncStateProvider(ResourceKey.calendar(season))` and the
    bootstrap record. Compute `hasMaterializedCalendar` for the **detail's
    season**, not the current season.
  - Expose a three-value association (linked / none / unknown, plus
    resolving) to `_relatedGrandPrix`.
  - No new request: Circuit Detail must not start a calendar sync, which
    matches the coordinator rule.
- **C-R3 (optional, persistence):**
  - store the contract's `CircuitDetail.grandPrix` per (circuit, season),
    including an explicit null, in a new table or column;
  - add a migration;
  - write it in `refreshCircuit`'s `writeDomain`;
  - let `circuitProfile` use it when the calendar is not materialized.

  Not needed for any entry point that exists today.

### 1.6 Copy

| Use | Key | English | Spanish | Status |
|---|---|---|---|---|
| Section heading | `circuitRelatedGrandPrix` | This season's Grand Prix | El Gran Premio de esta temporada | Existing |
| Confirmed absence (B) | `circuitNoRelatedGrandPrix` | No Grand Prix this season | Sin Gran Premio esta temporada | Existing; season-relative wording on historical seasons stays CIR-04 |
| Unknown (C), only with C-R2 | `circuitRelatedGrandPrixUnavailable` (proposed) | Grand Prix information unavailable | Información del Gran Premio no disponible | **New: needs ARB approval.** Follows the existing "… unavailable" pattern; deliberately not "offline", because a failed request never claims offline |

### 1.7 Offline and partial-data implications

- **First launch offline with an accepted bootstrap:** the calendar is
  materialized, so B is truthful.
- **No bootstrap and no calendar:** C, so nothing is claimed.
- **Calendar refresh failed over a cached calendar:** still materialized, so B
  holds as of the last success. Circuit Detail does not show the calendar's
  freshness (CD-2).
- **Partial circuit profile** ("Some profile information is unavailable"):
  independent of the association. The approved `partial.html` contradiction
  disappears whenever its calendar is not materialized: the absence line is
  omitted.
- **Bootstrap for another season** never materializes this season. That rule
  is already part of `hasMaterializedCollection`.

### 1.8 Tests required (when implemented)

- **Decision function:** linked / none / unknown / resolving, including:
  - own calendar record present or absent;
  - bootstrap for the same season vs another season;
  - metadata not yet read.
- **Provider:**
  - no calendar, but a Home-snapshot row for a **different** circuit → unknown;
  - no calendar, but a Grand Prix snapshot row for **this** circuit → linked;
  - calendar materialized, no row → none;
  - stale calendar → none;
  - calendar replacement removes the event while the page is open → none.
- **Widget:**
  - each state's visible text in English and Spanish;
  - "No Grand Prix this season" never rendered in unknown or resolving;
  - the section absent in unknown (C-R1), or the new line present (C-R2);
  - screen-reader text;
  - no flicker from resolving to none.
- **Existing tests** that expect "No Grand Prix this season" (e.g.
  `test/screens/entity_detail_widget_test.dart` line 623) must give their
  fixture a materialized calendar. Fixture setup only; assertions unchanged.
- **Prototype (later, if approved):** an "unknown association" frame in the
  Circuit states gallery, and `partial.html` re-checked.

### 1.9 Remaining owner decisions

- **CD-1: decided 2026-11-11.** Omit only the unsupported absence block
  (C-R1). No new copy (C-R2 not adopted).
- **CD-2 (open):** Whether a **complete but stale** materialized calendar still
  supports "No Grand Prix this season". Recommended: yes, as with all cached
  content. Not decided by the Step 49B.2 visual approval.
- **CD-3 (open):** Whether to schedule C-R3 (persist the contract's association)
  before any new entry point (deep links, historical seasons) is added.
- **CIR-04** (season-relative wording on historical seasons) stays separate.

---

## 2. Home: "No upcoming events"

### 2.1 Existing behaviour

- **Featured event:** `HomeDashboardDao` resolves the Home snapshot's
  `focusRound` against the season calendar (`_resolveFocus`). The hero kind
  comes from the temporal phase (`home_formatting.dart`):
  - `preEvent` → "Next Grand Prix";
  - `raceWeekend` → "Current Grand Prix";
  - `postRace` → "Latest Grand Prix".
- **Upcoming list:**
  - `resolveUpcomingEvents(calendar, now, excludeRound: focus.round, limit: 3,
    seasonCurrentRound)` (`shared/domain/relevant_event.dart`).
  - Rules: upcoming candidates only (horizon rule for unknown statuses),
    cancelled excluded, and **the featured round excluded**.
- **Availability:** `HomeModuleAvailability`, from calendar materialization
  (`home_state.dart`). It is never derived from the row count, and never
  downgraded by a stale record or a refresh failure.
- **Rendering** (`home_screen.dart`), always under the title "Upcoming events"
  with the "View Calendar" action:

| Availability | Rendered |
|---|---|
| `resolving` | Cached rows, or a quiet placeholder |
| `unavailable` | "Upcoming events unavailable" |
| `availableEmpty` | "No upcoming events" |
| `available` | Up to 3 rows |

### 2.2 Exact meaning and the contradiction

- **Meaning.** `availableEmpty` means: the complete, materialized calendar has
  **no upcoming event other than the featured one**.
- **When it is truthful:**
  - in `raceWeekend` ("Current Grand Prix") and `postRace` ("Latest Grand
    Prix"), because the featured event is not upcoming;
  - when there is no featured event.
- **The contradiction appears only in `preEvent`:** the hero says "Next Grand
  Prix · Round 23" and, directly below, "Upcoming events — No upcoming events".
  - The frozen staging data shows exactly this (the approved Home prototype,
    `refinement-01/`).
  - In practice it occurs every season, in the days before the finale.

The three requested distinctions, as the code has them:

| Distinction | Present today? |
|---|---|
| No additional loaded events to display | Not a separate state. The list is computed from **all** materialized calendar rows; a row from a Home or Grand Prix snapshot alone does not make the calendar available |
| No future events in a complete calendar | `availableEmpty`. Complete as of the last successful calendar sync; Home's own freshness notice covers staleness |
| Calendar unavailable | `unavailable` → "Upcoming events unavailable" (truthful, unchanged) |

- **What Home cannot know:** events the source has not published yet, and
  changes made after the last successful sync.
- **No completeness gap needs fixing:** the issue is purely the phrasing next
  to a featured upcoming event.

### 2.3 Recommended correction

- **H-R1 (recommended, no new copy).** When the phase is `preEvent` **and**
  the upcoming module is `availableEmpty`, **omit the Upcoming section**.
  - The hero already answers "what is next". Every other case is unchanged.
  - Cost: that one state loses the section's "View Calendar" action. The
    Calendar tab stays in the navigation, and the hero opens the Grand Prix.
- **H-R2 (alternative, new copy).** Keep the section in that state and show
  "No other upcoming events".
  - Same condition; the existing string stays for every other state.
  - It makes the end of the season explicit without a completeness claim
    beyond the existing one.
- **Rejected:**
  - "This is the last Grand Prix of the season": a derived claim, and
    cancellations and unpublished rounds make it riskier;
  - renaming the section;
  - changing `resolveUpcomingEvents`: the rule is shared and correct.

### 2.4 Necessary changes

- Presentation only: one condition in `home_screen.dart`. The phase is already
  resolved for the hero.
- No change to data, persistence, the dashboard query, `resolveUpcomingEvents`
  or the snapshot.

### 2.5 Copy

| Use | Key | English | Spanish | Status |
|---|---|---|---|---|
| Section title | `homeUpcoming` | Upcoming events | Próximos eventos | Existing |
| Empty, featured not upcoming | `homeNoUpcomingEvents` | No upcoming events | No hay próximos eventos | Existing; unchanged |
| Calendar unavailable | `homeUpcomingUnavailable` | Upcoming events unavailable | Próximos eventos no disponibles | Existing |
| Empty while featured is "Next Grand Prix" (H-R2 only) | `homeNoOtherUpcomingEvents` (proposed) | No other upcoming events | No hay otros eventos próximos | **New: needs ARB approval** |

### 2.6 Offline and partial-data implications

- **Offline with a cached, materialized calendar:** unchanged, and H-R1 or
  H-R2 applies.
- **Calendar not materialized:** `unavailable`. Unchanged and truthful, even if
  a featured row from the Home snapshot exists.
- **Resolving:** unchanged; no claim.
- **Stale calendar or refresh failure:** availability unchanged. Home's
  existing stale or failed notice covers it.

### 2.7 Tests required (when implemented)

- **Widget tests, phase × availability:**
  - `preEvent` × `availableEmpty` → section absent (H-R1), or the new string
    (H-R2);
  - `raceWeekend` and `postRace` × `availableEmpty` → existing "No upcoming
    events";
  - `preEvent` × `available` → list without the featured round;
  - `unavailable` and `resolving` in each phase → unchanged;
  - no featured event × `availableEmpty` → existing string.
- **Both languages and screen-reader text** for the visible case.
- **Regression:** two existing tests assert "No upcoming events" with the
  default focus fixture (`homeFocusFixture` defaults to `EventStatus.upcoming`,
  i.e. `preEvent`): `test/screens/home_widget_test.dart` "no upcoming events
  shows a concise line, not an error" and `test/a11y/screen_semantics_test.dart`
  "available-empty announces its own, different copy exactly once". They
  encode the contradiction and must be updated deliberately. The finale test
  (completed focus, `postRace`) stays as it is.
- **Prototype (later, if approved):** the frozen Home scenario
  (`refinement-01/`, approved; consolidation pilot) is exactly `preEvent` ×
  `availableEmpty`. Its update needs owner approval, because it changes an
  approved composition.

### 2.8 Remaining owner decisions

- **HD-1: decided 2026-11-11.** H-R1: hide the secondary section only when the
  hero is "Next Grand Prix" and the list is `availableEmpty`. H-R2 not
  adopted.
- **HD-2: decided.** No existing issue covered the finding (HOME-02 is the
  "Next session" label; HOME-04 is unrendered states; HOME-07 is Spanish
  wrapping), so HOME-08 was created.

---

## 3. Other audit findings, kept as recorded (no action in this step)

All stay in `STATUS-SEMANTICS-AUDIT.md`. No backlog ID was created or changed:

- **Unranked vs "Position unavailable":** audit S2, decision D4.
- **Failure, stale and partial notices together:** audit C5 and D3, decision
  D3; CT-03 open item.
- **Spanish "Comprobado" caption:** audit H6, decision L1.
- **Unknown status and format styling:** audit G1 and G2, XS-11, decision V3.
- **Provisional styling:** audit G4 and S1, STD-04, decision V2.

## 5. Validation experiments (Step 49B.1)

**Setup**
- Development-only variants, built by `build.py` from the consolidation pilots
  (each pixel-identical to the approved prototype), which are read and never
  written.
- Compared with the consolidation tool, unchanged; a control run is included.
- Environment: headless Chrome, software raster, DPR 2, safe-area insets 0.
- Matrix: English and Spanish × 390×844 and 320×693 × 100% and 200%.

**Capture adjustment**
- The tool pairs frames by index, but the variants are shorter. The automatic
  full-scroll capture was therefore replaced by anchored captures: top, a
  middle anchor, bottom.
- Home's keyboard walk takes the baseline's 15 stops in both versions.
- Home's inherited data probe and assertions read the removed link
  null-safely, in the experiment config only.

**Home** (`cross-screen-refinement/home-upcoming-omit/`,
`validation-20261111-201457-experiment/`)

| Check | Result |
|---|---|
| Control | 33 runs, 197 pairs, 0 differing pixels, 0 DOM, 0 accessibility differences |
| Change | Only the "Upcoming events" section is removed: its heading, "No upcoming events" and the "View Calendar" link. The accessibility tree loses exactly that region and adds nothing |
| Pixels | Top frames identical. Frames below the latest result move up by the removed section. Section spacing stays an even 32px (5 gaps before → 4 after, at every tested size) |
| Assertions | All pilot assertions hold except the two expected: "upcoming-known-empty" (section gone) and "every-link-opens-its-own-route" (13 → 12 routes; "View Calendar" removed). Hero, sessions, leaders, result, Explore and navigation records unchanged in English and Spanish |
| Navigation | The Calendar tab remains (`#calendar`); every other route opens |
| Keyboard | In all 8 walks, the experiment's order equals the pilot's order minus "View Calendar" / "Ver calendario" |
| Quality | 33/33 runs identical to the pilot. The only flag, a "Winner" / "Ganador" tag spill, already exists in the pilot |
| Copy | No string added or changed |

**Circuit Detail** (`cross-screen-refinement/circuit-absence/`,
`validation-20261111-194301-experiment/`)

| Page (baseline → experiment) | Result |
|---|---|
| Linked event (`index` → `index`) | Identical: all frames, the DOM and the accessibility tree; linked event `#calendar/2026/13` |
| Confirmed absence (`no-event` → `no-event`) | Identical: "No Grand Prix this season" / "Sin Gran Premio esta temporada" |
| Unknown association (`no-event` → `unknown-association`) | Only the related-Grand Prix block is removed: heading, "2026 season" and the absence statement. Circuit identity, facts and lap record kept; 10 of 14 frames identical (the rest is the removed block) |
| Partial profile, unknown (`partial` → `partial-unknown`) | The approved contradiction ("Some profile information is unavailable" + "No Grand Prix this season") is gone. The partial notice and bare sheet are kept; the page now shows only the notice and the circuit identity |

- **Control:** 75 runs, 127 pairs, 0 differences.
- **Bottom spacing:** 32px in every page, so no empty gap.
- **Links:** every link opens; Back works.
- **Focus stops:** 20/20 identical once the file name in the link is set aside.
- **Quality:** no findings. Only the count of checked text pairs falls (24 → 21).
- **"No absence claim" assertion:** baseline false, experiment true on both
  unknown pages, as intended.

**Labelling.** The development-only condition (calendar completeness not
established) is stated in each page's HTML comment, its meta description,
its file name and `build.py`. No visible label was added, so the screens stay
comparable.

**Representative screenshots for owner review** (in each folder's
`sw-pilot/diffs/`; `-baseline` = pilot, `-pilot` = experiment):
- **Home:** `en-390x844-100-capture-bottom-{baseline,pilot}.png`,
  `es-320x693-200-capture-bottom-{baseline,pilot}.png`.
- **Circuit, partial profile:**
  `en-partial-unknown-390x844-100-capture-top-{baseline,pilot}.png`,
  `es-partial-unknown-320x693-200-capture-top-{baseline,pilot}.png`.
- **Circuit, unknown association:**
  `en-unknown-association-390x844-100-capture-bottom-{baseline,pilot}.png`.
- **Unchanged states** (no diff files):
  `sw-pilot/screens/en-index-390x844-100-capture-*.png` (linked) and
  `sw-pilot/screens/en-no-event-390x844-100-capture-*.png` (confirmed
  absence).

**Observation for review.** The partial profile with an unknown association
is now very sparse: identity and notice only. That is accurate, because
nothing else is known. Whether it needs any further treatment is a visual
judgement, not a semantic issue.

## 6. Flutter implementation and test notes (not implemented)

**Circuit condition (CR-04)**

| Association | Condition |
|---|---|
| `linked` | `relatedGrandPrix != null` |
| `confirmedNone` | `relatedGrandPrix == null` **and** `hasMaterializedCalendar(season: detailSeason, metadata: resourceSync(calendar:<detailSeason>), bootstrapMetadata: resourceSync(bootstrap))` |
| `unknown` | `relatedGrandPrix == null` and not materialized |
| `resolving` | Either metadata read still loading; render nothing |

- `detailSeason` is the screen's resolved season: the origin season, or the
  current season for a route without one. It is never another season.
- **Never derive completeness** from `countEventsForSeason` or the number of
  stored rows: the Home and Grand Prix snapshots insert single rows.
- **Partially cached calendar:** a Home-snapshot or Grand Prix-snapshot row
  without a materialized calendar gives `linked` for that circuit and
  `unknown` for every other circuit, never `confirmedNone`.
- **Offline:**
  - an accepted bootstrap for this exact season materializes the calendar, so
    `confirmedNone` is truthful;
  - no bootstrap and no calendar → `unknown`;
  - a failed refresh over a cached calendar stays materialized.
- **Historical season** (an origin season other than the current one): the
  calendar is normally never synchronised for it, so the result is `unknown`
  unless that season's calendar or bootstrap record exists. CD-3 would extend
  this.
- **Tests:** as in §1.8, plus:
  - a historical origin season with a materialized *current* calendar must stay
    `unknown`;
  - a bootstrap record for another season must not materialize;
  - widget tests check that the absence block is not in the semantics tree
    for `unknown` or `resolving`.
  - Existing test to adjust: `test/screens/entity_detail_widget_test.dart`
    line 623 expects "No Grand Prix this season". Its fixture must give the
    season a materialized calendar; the assertion is unchanged.

**Home condition (HM-01)**
- **Hide** the upcoming section when `phase == preEvent` (the hero's "Next
  Grand Prix") **and** `upcoming.availability == availableEmpty`.
- **Unchanged:** `resolving` (cached rows or placeholder), `unavailable`
  ("Upcoming events unavailable"), `available` (list), and `availableEmpty` in
  `raceWeekend` / `postRace` or with no featured event ("No upcoming events").
- **Tests to update deliberately** (they encode the contradiction, because
  `homeFocusFixture` defaults to `EventStatus.upcoming`, i.e. `preEvent`):
  - `test/screens/home_widget_test.dart`, "no upcoming events shows a concise
    line, not an error": expect the section to be absent;
  - `test/a11y/screen_semantics_test.dart`, "available-empty announces its
    own, different copy exactly once": the label occurs 0 times in
    `preEvent`; add the `postRace` variant, where it occurs once.
- **Keep:** "the season finale is never reported as missing information"
  (completed focus, `postRace`).
- **New tests:**
  - phase × availability, as in §2.7;
  - the semantics tree has no "Upcoming events" heading in the hidden state;
  - the Calendar tab is still reachable;
  - **offline:** a cached materialized calendar applies the same rule;
  - **partial:** the featured row only, with no calendar → `unavailable`,
    still shown.

## 4. Unavoidable dependencies

- **Circuit:** none for C-R1. It uses the existing materialization rule and
  sync metadata. Confirmed absence for seasons whose calendar is never
  synchronised needs C-R3 (persistence).
- **Home:** none. Presentation only.
- **ARB:** only if the owner chooses C-R2 or H-R2.

## 7. Owner visual review and evidence retention (Step 49B.2)

**Decision, 2026-11-11.** The owner reviewed the six screenshots below and
visually approved both directions for future implementation:
- **HM-01 (HOME-08):** omit the secondary upcoming section only when the
  hero is "Next Grand Prix" **and** there are no additional upcoming events.
- **CR-04 (CIR-02):** show "No Grand Prix this season" only when the selected
  season's calendar is confirmed complete; otherwise omit the unsupported
  absence block.

**Reviewed screenshots** (`-baseline` = approved pilot, `-pilot` =
experiment; each in the folder's `sw-pilot/diffs/`):

| View | Folder | Files |
|---|---|---|
| Spanish Home, 320×693 @200% | `home-upcoming-omit/validation-20261111-201457-experiment/` | `es-320x693-200-capture-bottom-{baseline,pilot}.png` |
| Spanish Circuit, partial profile, 320×693 @200% | `circuit-absence/validation-20261111-194301-experiment/` | `es-partial-unknown-320x693-200-capture-top-{baseline,pilot}.png`; Git-visible copies `es-partial-320-200-top-{base,pilot}.png` |
| English Circuit, unknown event association, 390×844 @100% | `circuit-absence/validation-20261111-194301-experiment/` | `en-unknown-association-390x844-100-capture-bottom-{baseline,pilot}.png`; Git-visible copies `en-unknown-assoc-390-100-bottom-{base,pilot}.png` |

**What the approval does not change**
- CIR-02 and HOME-08 stay **Accepted pending validation**. They close only
  after the Flutter behaviour and tests in §1.8, §2.7 and §6 are validated.
- **Home:** the omission depends on both the featured-event context
  (pre-event, "Next Grand Prix") and the empty secondary upcoming
  collection. It is never generalised to every empty upcoming list.
- **Circuit:** completeness refers to the selected season. An empty local
  event query is not evidence of absence.
- No new copy, empty-state card or decorative content compensates for the
  missing information, including on the sparse partial-profile page.
- **CD-2 stays open:** whether a complete but stale calendar still supports
  the absence statement. CD-3 also stays open.
- Flutter, ARB, backend, domain models and synchronisation are unchanged.

**Evidence retention** (`design-exploration/.gitignore`, narrow rules as for
Steps 48B-48F):
- Tracked: experiment sources (`build.py`, configs, HTML, CSS), every
  `results.json` and `summary.txt`, and the six reviewed screenshots.
- Local only: both experiments' `sw-control/screens/` and
  `sw-pilot/screens/`, and the other `sw-pilot/diffs/` files (other
  pairs and diff masks).
- Nothing deleted; all evidence remains on disk.

## 8. Step 55C.11R re-verification of CR-04 (2026-11-15, assessment only)

Re-checked against the code after the Primer V2 Circuit Detail migration
(Step 55C.11). Nothing was implemented; providers, repositories, schema,
synchronisation, API and ARB are unchanged.

**Current data flow (unchanged since §1).**
- `circuitProfileProvider` → `CircuitRepository.watchCircuitProfile` →
  `CalendarDao.circuitProfile(season, circuitId)`: the circuit row plus the
  earliest `grandPrixEvents` row for (season, circuit), or `null`.
- `circuitDetailStateProvider` reads only `circuit:<circuitId>:<season>`
  metadata. `refreshCircuit` writes only the circuit
  (`upsertCircuits`); the contract's `CircuitDetail.grandPrix` is parsed and
  discarded.
- Event writers: `replaceCalendar` (calendar sync and accepted bootstrap,
  authoritative: deletes the season's events missing from the payload);
  `VerticalSliceDao` Home and Grand Prix snapshots (one event each,
  additive). So rows can exist without a calendar.
- The Primer screen renders the season line + "No Grand Prix this season"
  whenever `relatedGrandPrix == null` (preserved on purpose in Step 55C.11).

**Completeness evidence.**

| Case | Signal | Trustworthy? |
|---|---|---|
| A. Related event present | a stored row for (season, circuit) | Yes: it came from the authoritative calendar or from a snapshot of that very event |
| B. Calendar complete, no event | no row **and** `hasMaterializedCalendar(season: detailSeason, metadata: calendar:<detailSeason>, bootstrapMetadata: bootstrap)` | Yes, as of the last successful sync: `lastSuccessAt` on the season's own calendar record, or an accepted bootstrap whose own season scope is that season (`collection_materialization.dart`). Never derived from row counts |
| C. Unknown / incomplete | no row and not materialized | Yes (by elimination) |
| Resolving | either metadata read still loading | Assert nothing |

A successful *circuit* request, an empty local event list or a missing
related event is never treated as completeness.

**Recommended implementation (C-R1, as approved in CD-1 and visually in
Step 49B.2).**
- A pure function `circuitEventAssociation` → `linked` / `confirmedNone` /
  `unknown` / `resolving`, and a small provider beside
  `circuitDetailStateProvider` reading
  `resourceSyncStateProvider(ResourceKey.calendar(detailSeason))` and
  `resourceSyncStateProvider(ResourceKey.bootstrap())`. No calendar request
  is started from Circuit Detail.
- Screen: `linked` → section with the season line and the event row;
  `confirmedNone` → section with the season line and "No Grand Prix this
  season"; `unknown` and `resolving` → the whole related section omitted
  (heading, season line and statement, as `cd-partial-unknown` /
  `cd-unknown-assoc`). Every other circuit fact and notice unchanged.
- No ARB, schema, API or synchronisation change.

**Edge cases.**
- *Offline first launch with an accepted bootstrap for the season:*
  materialized → B truthful. *No bootstrap and no calendar:* C, omitted.
- *Cached calendar, refresh failed:* still materialized → B as of the last
  success. *Stale calendar:* B is kept only if CD-2 is decided "yes"
  (recommended, like all cached content).
- *Missing / historical season:* a season whose calendar was never
  synchronised is C unless its own calendar or bootstrap record exists; a
  materialized current calendar never materializes another season. A Grand
  Prix origin always has its event row → A.
- *Partial synchronisation:* a Home or Grand Prix snapshot row gives A for
  its circuit and C for every other circuit, never B.
- *Bootstrap for another season:* not materializing (season-scope match).
- *Calendar replaced while the page is open:* the watched query and metadata
  update; an event removed from a materialized calendar becomes B.
- *Season unavailable:* unchanged (no request, retry).

**Contract or localization changes.** None for C-R1. CD-3 (optional, C-R3)
would persist the contract's per-season association (new table or column,
schema migration, `refreshCircuit` write, DAO read) to answer historical
seasons without a calendar; not needed for today's entry points.

**Test impact.** The harness's default sync metadata marks every key synced,
so existing "No Grand Prix this season" tests stay B. Fixtures with no
metadata (`syncMetadata: (key) => null`), including the
`circuit_detail_partial` golden, become C and lose the related section:
re-baseline the three Circuit goldens only after CR-04 is implemented and
approved. New tests as in §1.8 and §6.

## 9. Step 55C.11C implementation of CR-04 (2026-11-15)

Implemented as C-R1, owner-authorised; owner review pending.

- **Decision:** `circuitEventAssociation(season, profileReady,
  hasRelatedEvent, calendarMetadataReady, calendarMetadata,
  bootstrapMetadataReady, bootstrapMetadata)` → `linked` / `confirmedNone` /
  `unknown` / `resolving`
  (`lib/features/circuits/application/circuit_event_association.dart`).
  A stored event is `linked` even while metadata loads; otherwise any input
  still loading is `resolving`; otherwise `hasMaterializedCalendar(season: resolved season, metadata: calendar:<season>, bootstrapMetadata: bootstrap)` (`calendar_state.dart` → `hasMaterializedCollection`) decides
  `confirmedNone` versus `unknown`.
- **Provider:** `circuitEventAssociationProvider(scope)` watches the circuit
  profile (unchanged selection: earliest round), `calendar:<resolved
  season>` and `bootstrap` metadata — all Drift streams, so the screen moves
  between A, B and C without reopening. It never requests the calendar.
- **Screen:** A → section + row; B → section + season line + "No Grand Prix
  this season"; C and resolving → the whole related section omitted.
- **CD-2 (approved):** stale and failed-refresh calendars stay
  materialized. **CD-3:** deferred, not a dependency.
- **Freshness limitation (open):** the page's notices are the circuit
  resource's (`detailNotices`). A stale or failed *calendar* is not
  signalled next to the B statement, and the circuit's metadata is never
  presented as calendar freshness. Smallest future correction (needs an
  owner decision on placement and copy, no new copy now): in state B only,
  derive the calendar's presented freshness (`presentedFreshness` for
  `calendar:<season>` with the bootstrap fallback, as the Calendar does) and,
  when stale, show an existing stale notice for that statement.
- **Tests:** `test/application/circuit_event_association_test.dart` (14) and
  the "CR-04 related Grand Prix association" group in
  `test/screens/circuit_detail_primer_test.dart` (16): cases 1–15 of the
  Step 55C.11C brief, in both themes for C. The harness's default metadata is
  synced, so the existing "No Grand Prix this season" assertions stay B;
  no existing assertion relied on the empty list alone.
