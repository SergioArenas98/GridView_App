# Status semantics audit (Step 49A)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a step of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](README.md#validation-output).

**Status: audit, 2026-11-11. Read-only.** No prototype, pilot, experiment,
shared file, Flutter file, ARB string, fixture, decision or backlog status was
changed. This audit addresses XS-11 and the related status issues. It is not a
redesign and does not repeat `DESIGN-SYSTEM-CONSOLIDATION.md` §5.7.

**Sources**
- **Authority for supported states:** the Dart domain and presentation code,
  read at `e3e9f88`:
  - `enums.dart`, `standing*.dart`, `participation_span.dart`;
  - `freshness_evaluator.dart`, `home_*` domain;
  - `entity_detail_state.dart`, `entity_detail_scaffold.dart`;
  - `domain_status.dart`, `entity_formatting.dart`;
  - `calendar_dao.dart`, `home_dashboard_dao.dart`;
  - `circuit_repository_impl.dart`, the screen widgets;
  - `app_en.arb` and `app_es.arb`.
- **Authority for current visuals:** the approved prototypes and pilots,
  Calendar Stage 1 (CT-03) and Explore Alternative B (EX-02).
- **Fixtures:** those already in the prototypes (frozen staging and Flutter
  test fixtures). None were invented.
- **Out of scope here:** TalkBack behaviour (XS-02) and device behaviour
  (XS-16).

## 1. Glossary: the distinctions the domain actually supports

These are separate axes, not one enum. A single item can sit on several at
once. For example, round 23 is application-derived "Next" (F), has
provider-reported status unknown (A), and comes from a possibly stale calendar
(E).

| Axis | What it answers | Supported values (Dart) | Rules the code already enforces |
|---|---|---|---|
| **A. Provider-reported lifecycle** | What the source says an event or session is doing | `EventStatus` scheduled, upcoming, in_progress, completed, postponed, cancelled, **unknown**; `SessionStatus` scheduled, live, completed, cancelled, postponed, **unknown**; `WeekendFormat` standard, sprint, **unknown** | Unrecognised wire values become `unknown`. Calendar, GP hero, Home and Circuit always print an explicit "Status unknown" (`required…Label`). The status is never inferred from dates |
| **B. Result certainty** | Is a classification settled? | `ResultStatus` provisional, final, unavailable, unknown (per document); `FinishStatus` finished, lapped, dnf, dns, dsq, dnq, unknown (per entry); `provisional: bool?` per standing row | A null `provisional` means **unspecified, never final**. Standings summarise the rows as unspecified, provisional, mixed or notProvisional; a disagreement is never flattened |
| **C. Ranking** | Where a competitor stands | `position: int?` (null = unranked, never 0); `points: double` (required; a zero is real); ties = several confirmed position 1 | The leader comes only from a confirmed `position == 1`. Tied leaders are never collapsed into one. **There is no "unknown points" state** in the domain |
| **D. Local availability** | Can the app answer at all? | Collection materialization (`hasMaterializedCollection`); Home `HomeModuleAvailability` resolving, unavailable, availableEmpty, available; detail `materialized` (partial vs materialized) and `detailUnavailable`; unresolved identity (name `null`); GP results Unavailable, Loading, Error, Ready | An empty materialized answer is a real answer ("No upcoming events"), distinct from unavailable. A missing name is never replaced by an identifier |
| **E. Freshness and sync** | How current is the cached answer? | `FreshnessState` fresh / stale, or `null` (unknown, never presented); `lastSuccessAt`; `refreshing`; `refreshError` scoped to one resource | Cached content always stays visible. A failure never claims "offline". Staleness is re-evaluated only when a provider recomputes; there is no timer (`DECISIONS-48D.md` §1.1) |
| **F. Application-derived relevance** | What should the user look at? | `RelevantEvent` (next or current), Home focus session, "Starts in 2 days", the Calendar "Next" chip | Derived from dates and `currentRound`, never from status. It sits beside the provider status without replacing it |
| **G. Observed participation span** | When was a competitor observed in a season? | `startRound` / `endRound`, each `int?`: null start = season start of the observed scope; null end = no observed exit (ADR 0026 D6) | Null/null reads "From season start", never "Full season". Team hides a span without an observed boundary (`hasObservedBoundary`) |
| **H. Data origin** | Where does the data come from? | `FixtureDataIdentity` sample, frozen, unverified; `DataSourceStatus` dormant, active, automatic; `usesMockData` banner | Shown in Settings → Data and updates (SI-01); the sample banner sits above content (GP states frame 26) |

## 2. Screen-by-screen comparison matrix

**"Flutter distinguishes?"** says whether the model can tell the condition
apart. **"Accurate"** judges the meaning conveyed, not the styling.

**Classes:**
- **OK**: correct and consistent;
- **Keep**: intentional screen-specific variation;
- **Vis**: visual inconsistency;
- **Copy**: copy or localization;
- **Domain**: needs functional clarification;
- **Device**: device or accessibility validation.

| # | Screen · component | Condition (source) | Flutter distinguishes? | Flutter shows | Primer V2 shows | Accurate? | IDs | Class · action |
|---|---|---|---|---|---|---|---|---|
| H1 | Home · hero | Next event, `EventStatus.unknown` (frozen round 23) | Yes (A + F) | "Next Grand Prix", countdown, "Status unknown" chip in the neutral tone (same tone as the Sprint chip) | Same words; dashed chip | Yes. Relevance and status kept separate | XS-11 | OK |
| H2 | Home · session card | "Next session" on the Race, Mon Nov 9, status unknown | Partly: the focus label checks only `isLive` | "Next session" | Same, plus a dashed "Status unknown" chip | **Possibly not**: "Next" on a fallback session that may be past | HOME-02 | Domain (owner) |
| H3 | Home · latest result | `ResultStatus.final`, winner from the classification | Yes (B) | "Final" chip, winner | Filled Chalk "Final" + check, "Winner" tag (G-5) | Yes | — | OK |
| H4 | Home · upcoming | `availableEmpty` **after excluding the featured round** (`resolveUpcomingEvents(excludeRound: focus.round)`) | Yes (D) | "No upcoming events" | Same, directly below "Next Grand Prix · Round 23" | **Misleading**: reads as "nothing is coming" while round 23 is upcoming. The ARB description says "no further scheduled events" | none (new) | Copy (owner; needs new copy, §7 D2) |
| H5 | Home · leaders, result, upcoming | Unavailable vs empty vs tied vs provisional (`homeLeaderUnavailable`, `HomeTiedLeaders`, provisional badge, `homeResultNotLoaded`, `homeUpcomingUnavailable`) | Yes (C, D) | Distinct strings for each | Not rendered | Not evaluable | HOME-04 | Render from existing fixtures (later) |
| H6 | Home and Calendar · caption | Last successful sync time (E) | Yes | EN "Last successful check: {time}" / ES "Comprobado: {time}" | Same | **ES drops "successful"**: it reads as "checked", even after a failed check | none (new) | Copy (later ARB review) |
| C1 | Calendar (Stage 1) · rows | Every frozen row `EventStatus.unknown` (4 sample rounds, not the season) | Yes (A) | Neutral "Status unknown" chip per row | Dashed chip per row | Yes, but repeated on every row: noisy on a full season, read in each row's name | XS-11, CAL-02, XS-13 | Vis (owner, §7 V1) |
| C2 | Calendar · "Next" | Derived next event (F) beside unknown status (A) | Yes | "Next" + "Status unknown" | Ember block + "Next" + dashed chip | Yes | — | OK |
| C3 | Calendar · completed, cancelled, postponed, current | Provider statuses | Yes | Completed dimmed (non-emphasised); labelled chips | Vocabulary only (`chip.css`); rows not rendered | Not evaluable | CAL-01 | Render from existing fixtures (later) |
| C4 | Calendar · no local calendar | Loading / first-load error / valid empty (`hasMaterializedCalendar`) | Yes (D) | Skeleton, error state, empty state | Not rendered | Not evaluable | CAL-01 | Keep (later) |
| C5 | Calendar · stale **and** failed together | One notice slot; failure wins | Yes (both known) | "Couldn't refresh — showing saved data." only | Same, in content (CT-03) | **Incomplete**: the stale fact is not stated while the failure shows | CT-03 open list | Domain (owner, §7 D3) |
| C6 | Calendar · goes stale while open | Recomputed only on a provider change | **No** (no timer) | Notice appears at the next recompute | Static | Partly | `DECISIONS-48D.md` §1.1 | Domain |
| S1 | Standings · provisional | Summary unspecified / provisional / mixed / notProvisional | Yes (B) | Section notice (all agree) or row badge (mixed); nothing when unspecified | Quiet 13px notice (frame 7); dagger chip on rows (frame 8) | Yes | STD-04 | OK. Weight → STD-04 |
| S2 | Standings · unranked row | `position == null` | Yes (C) | Visible "—"; screen reader "**Position unavailable**" (`standingsUnrankedSemantics`, whose own description says "unranked") | Same (frame 1) | **No**: "unavailable" claims missing data. Elsewhere the same fact reads "Unranked" | none (new) | Copy (owner, §7 D4) |
| S3 | Standings · zero points | `points == 0.0` (required field) | Yes | "0" | "0" | Yes. No "unknown points" state exists to confuse it with | — | OK |
| S4 | Standings · tied leaders | Several confirmed position 1 | Yes | "Tied for the championship lead" on each | Same (frame 2, S-5) | Yes | STD-03 (weight only) | OK |
| S5 | Standings · freshness | Caption, stale, failed with rows | Yes | Caption + notices | Frozen data has no check time; states 9–11 not captured with rows | Not evaluable | STD-01, STD-02 | Later |
| E1 | Explore B · unranked card | `position == null` | Yes | Position field **omitted** | Omitted | Defensible (a card shows what is known), but it is a third treatment of unranked | XS-04 (labels) | Keep, noted under §4 item 3 |
| G1 | GP · hero (and Circuit related event, states gallery) | `EventStatus.unknown` + `WeekendFormat.unknown` (GP frame 8) | Yes (A) | Two neutral chips | Dashed "Status unknown" + "Format unknown" in the **filled context style** (same as "Sprint weekend") | Words yes; the styling presents an unknown as a confirmed fact | XS-11 | Vis (§8 step 1) |
| G2 | GP · session rows | `SessionStatus.unknown` (frame 9) | Yes | "Status unknown" text | Plain secondary text, like "Scheduled"; Home's session card uses the dashed chip | Words yes; visually indistinct and inconsistent | XS-11 | Vis (§8 step 1) |
| G3 | GP · sprint weekend | Sprint sessions scheduled; release is race-only | Yes | Sessions listed; Flutter **still renders sprint classifications** | Sessions listed; only "Race results" | Prototype correct for the race-only scope | GPD-02 | Domain (owner) |
| G4 | GP · result certainty | Document `final` / `provisional` / `unavailable` / `unknown`; no document yet | Yes (B, D) | One chip; tone success (final), info (all three others); "Results not available yet" when there is no document | Final = filled + check; Provisional and Not available = the same outline chip; unknown = dashed (frames 16, 20, 25) | Words yes. "Provisional" has no dagger here (nor in the Driver and Team states galleries), unlike Standings | XS-11, STD-04 | Vis (§7 V2) |
| G5 | GP · DNF / DNS / DSQ / DNQ / lapped / unknown finish | `FinishStatus`; position may be null | Yes | Label; position "—" when absent; no invented points | Word chip, no false zero (frame 22, G-7) | Yes | G-7 | OK |
| G6 | GP · blank event name | Contract allows a blank name | Partly | Empty hero heading | Fallback exists (`grandPrixNameUnavailable`) | **No** in Flutter | GPD-03 | Domain (existing P1) |
| D1 | Driver · span | null/null | Yes (G) | "From season start" | Same | Yes (observed scope, not "full season") | ADR 0026 D6 | OK |
| D2 | Driver · statistics | Unranked, confirmed zeros, podiums not supplied (frame 12) | Yes (C) | "Unranked", zeros shown, podiums omitted | Same | Yes | — | OK |
| D3 | Driver, Team, Circuit · notices | `refreshError` + partial (not materialized) together | Yes, but the notice precedence keeps one: failure > partial > stale | "Update failed" only | Same scaffold | **Incomplete**: a failed first detail sync hides that the profile is partial | XS-22 (icon only) | Domain (owner, §7 D3) |
| T1 | Team · line-up span | null/null without an observed boundary | Yes (G) | Span hidden | Same | Differs from Driver (D1) by design | TEAM-05 | Keep until the owner decides; do not unify silently |
| CI1 | Circuit · related GP | No local `grandPrixEvents` row for (season, circuit) | **No**: absence of a row is read as absence of an event. `refreshCircuit` stores only the circuit, not the contract's `grandPrix` list | "No Grand Prix this season" | Same (Scenario C) — **and in Scenario B (`partial.html`) together with "Some profile information is unavailable"** | **No**, unless the season calendar is materialized | CIR-02 (P1), CIR-04 | Domain (highest, §6) |
| CI2 | Circuit · related event status | `EventStatus` of the linked event | Yes | Labelled chip | Dashed when unknown | Yes | XS-11 (CD-14) | OK |
| CI3 | Circuit · direction | `CircuitDirection.unknown` or null | No (both → "Direction unavailable") | "Direction unavailable" | Same | Acceptable; provider-unknown and missing read alike | — | Keep |
| SE1 | Settings · Data and updates | Data origin and source status (H) | Yes | Origin, source and update policy copy | SI-01 composition | Yes | SI-01, XS-21 | OK. Banner placement → XS-21 |

## 3. Consistent patterns to preserve

- **An explicit word for every status.** "Status unknown" is always printed
  where a lifecycle status belongs: Calendar, GP hero, Home, Circuit. It is
  never left blank and never derived from dates.
- **Derived relevance beside provider status:** "Next" / "Next Grand Prix"
  together with "Status unknown" on the same event.
- **No false zero, no invented value.** An unranked competitor never shows 0.
  Statistics not supplied are omitted (D2). Points are never invented (G5). A
  missing name uses localized "… unavailable" copy, never an identifier.
- **Provisional is never inferred.** A null flag claims nothing, and
  disagreeing rows are marked row by row (S1).
- **Empty is not unavailable.** Home and Calendar keep valid-empty separate
  from not-materialized (H5, C4). The wording only becomes a problem where
  the user cannot see the scope of "empty" (H4).
- **Cached content always stays.** Notices sit above or inside the content
  they describe and never replace it. GP scopes its result notices to the
  results section (frames 17–19).
- **Never colour alone.** Every status carries a word. The pattern (dashed
  outline, filled Chalk + check, dagger, strike icon) reinforces it.
- **Participation words describe what was observed**, never predict the
  season (D1).

## 4. The most important contradictions and ambiguities

Ordered by the risk of misleading users about existence, certainty or
freshness.

1. **Circuit "No Grand Prix this season" is an absence claim the data cannot
   support** (CI1, CIR-02).
   - The approved partial frame shows it directly under "Some profile
     information is unavailable", so the screen asserts certainty and
     uncertainty at once.
   - This is existing Flutter behaviour, faithfully reproduced.
2. **"No upcoming events" directly under "Next Grand Prix · Round 23"** (H4).
   - The module excludes the featured round, so the copy is literally true
     only as "nothing after the next one".
   - This is new: no backlog item covers it.
3. **Unranked has three readings** (S2, D2, E1).
   - The screen reader hears "Position unavailable" in Standings, the details
     show "Unranked", and Explore omits it.
   - "Unavailable" is wrong on the availability axis (D): the position is
     known to be absent, not missing locally.
4. **One notice slot hides a second true fact** (C5, D3).
   - Failure hides stale (Calendar) and failure hides partial (details).
   - The wording that remains is not wrong, but it is incomplete.
5. **Unknown is not visually one thing** (G1, G2, H2).
   - Dashed chips appear on Home, Calendar, the GP hero and Circuit.
   - The GP session list uses plain text that looks like "Scheduled".
   - "Format unknown" uses the confirmed context style.
6. **Provisional has three looks** (S1, G4, H5 badge).
   - Standings uses a dagger chip and caption; GP, Driver and Team use an
     outline chip without a dagger; Home's badge is not rendered (HOME-04).
   - Within GP, "Provisional" and "Not available" look identical.
   - `DESIGN-SYSTEM-CONSOLIDATION.md` §3 lists Driver among the dagger users;
     its states gallery actually uses the outline chip.
7. **The Spanish caption drops "successful"** (H6).
   - "Comprobado: 4:22" does not say the check succeeded.
   - EN "Last successful check" does.

Already tracked and unchanged here: HOME-02 (H2), GPD-02 (G3), GPD-03 (G6),
TEAM-05 (T1), CIR-04 (season-relative copy) and XS-20 (session status gender in
Spanish).

## 5. Recommended shared presentation principles

1. **One axis, one cue family.**
   - **Lifecycle unknown (A):** dashed outline + "Status unknown" / "Format
     unknown", wherever it appears: chip in heroes and rows, dashed inline
     marker in dense lists.
   - **Certainty (B):** "Provisional" always with its dagger, "Final" filled +
     check, so the two never share a style with unavailability.
   - **Availability (D):** secondary-weight text ("… unavailable", "Not
     available"), never a status chip.
   - **Freshness (E):** notices with a cause icon (XS-22).
   - This uses existing patterns, not new colours.
2. **Absence statements only where the data proves completeness.** Copy such
   as "No Grand Prix this season" or "No upcoming events" is shown only when the
   collection that would contain the item is materialized, and its scope must
   be visible.
3. **Unranked is a ranking fact, not missing data.** Visible "—" may stay as a
   compact table mark, but its spoken and labelled meaning should be
   "Unranked".
4. **Stacked facts are not dropped silently.** When failure, stale and partial
   coincide, either show both facts or use wording that keeps the hidden one
   true (owner decision; copy to be checked against the ARB files first).
5. **Repetition scales down, never disappears.** On long lists a repeated
   unknown may become quieter, but it stays present and announced per row.
   The words are kept.
6. **Existing ARB strings first.** Anything that needs new copy (H4, S2, C5,
   D3) goes to a later ARB review, not into prototypes.

## 6. Cases needing domain or data clarification (not visual)

| Case | What is unknown today | What would make a safe statement possible |
|---|---|---|
| CI1 Circuit absence (CIR-02, P1) | Whether the season's calendar is materialized when the circuit page opens; the contract's `CircuitDetail.grandPrix` is parsed but not stored | Show "No Grand Prix this season" only when `calendar:<season>` is materialized (`hasMaterializedCalendar`) **or** the circuit detail's own event list is persisted and materialized. Otherwise a neutral "not available" reading — whose wording needs an ARB decision — and never a definitive absence. A partially downloaded calendar or a single GP-detail row must not count. Historical seasons (CIR-04) need the same rule |
| C6 Stale while open | No time-based recompute | A re-evaluation trigger, e.g. on resume or at the freshness horizon. Synchronization behaviour; product decision |
| C5 and D3 Notice precedence | Which fact wins when two are true | Owner rule: one combined notice, or two lines. Existing strings may cover it (`offlineStaleNotice` + `refreshFailedNotice`); check before any new copy |
| H2 Next session on a fallback session | Whether the fallback session can be past | HOME-02 owner decision (audit §8.4 item 5) |
| G3 Sprint classifications | Release scope vs the renderer | GPD-02 owner decision; the prototype keeps race-only |
| G6 Blank GP name | Hero heading fallback | GPD-03; the string exists |
| T1 Null/null span | Whether Team should match Driver | TEAM-05; Flutter change either way |

## 7. Owner decisions needed before visual changes

- **V1:** Calendar rows with unknown status. Keep the full dashed chip on every
  row (today), or a quieter inline dashed marker with the same words for list
  rows (heroes keep the chip). The words are kept in every row's name either
  way.
- **V2:** One provisional look. The dagger chip everywhere (GP results, Driver
  and Team championship, Home's badge), separated from "Not available".
- **V3:** Confirm principle 1: dashed = lifecycle unknown only. It would also
  apply to "Format unknown" and to GP session rows.
- **D1:** Circuit absence wording until CIR-02 is solved. Keep Flutter's copy
  (and the prototype) unchanged until data work exists, as CIR-02 says ("no
  visual workaround"), or approve an ARB review for a neutral reading.
- **D2:** Home upcoming copy. Accept "No upcoming events", or schedule an ARB
  review for wording scoped to "after the next Grand Prix". No existing string
  says this.
- **D3:** Notice precedence when failure, stale and partial coincide (C5, D3).
- **D4:** Unranked accessible meaning. Change `standingsUnrankedSemantics` to
  the meaning its own ARB description states ("unranked") in a later ARB
  review, and decide whether Explore should show "Unranked" or keep omitting
  it.
- **L1:** Spanish caption `lastUpdatedLabel` "Comprobado: {time}" → whether
  to restore "successful" in a later ARB review.

## 8. Minimal visual-refinement sequence (after owner review)

Each step uses existing strings and fixtures only, is prototype-only, and is
validated with the existing comparison tool.

1. **Unknown lifecycle styling (XS-11, V3).** The first and smallest
   high-value correction:
   - GP session "Status unknown" uses the dashed inline treatment instead of
     plain text;
   - GP and Circuit "Format unknown" use the dashed outline instead of the
     filled context style.

   No copy, layout or data change; screen-reader text unchanged. It removes a
   case where an unknown looks confirmed or like "Scheduled".
2. **Provisional vocabulary (V2).** The dagger on the GP, Driver and Team
   "Provisional" chips, distinct from "Not available".
3. **Calendar repeated unknown (V1).** Only if the owner chooses the quieter
   list marker; measured on the Stage 1 experiment, not the approved
   `calendar/`.
4. **Render the missing states from existing fixtures** (HOME-04, CAL-01,
   STD-02) so that H5, C3–C5 and S5 can be judged visually.
5. **Copy and data items** (H4, H6, S2, C5/D3, CI1) wait for the ARB review and
   the domain decisions in §6. No visual workaround before then.

**Accessibility notes (Chrome evidence only; TalkBack unverified, XS-02):**
- **Status words** are in the accessible names: Calendar rows, Standings
  rows ("…, Provisional"), GP rows ("…, DNF").
- **Unknown vs provisional** can be told apart without colour, by word and
  pattern.
- **Notices:**
  - stale and failure notices are `role="status"`;
  - in Stage 1 they come before the list in reading order;
  - GP results notices are scoped to their section;
  - detail notices sit at the top of the page.
- **Silent omissions** (missing locality, podiums not supplied) are correct
  where the data was not supplied, but nothing tells a screen-reader user that
  a field is missing. This is acceptable under the current rules.
- **Reading noise:** "Status unknown" in every Calendar row name (about 24
  rows on a real season, XS-13) is the main repetition risk (V1).
