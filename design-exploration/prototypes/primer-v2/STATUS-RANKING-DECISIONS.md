# Ranking and missing-value semantics (Step 49C)

**Status: decision document, 2026-11-11. RK-1 to RK-5 accepted by the owner
(§9); RK-4 provisionally, with conditions.** Nothing implemented: Flutter,
the tests, ARB files, the contract, the backend, the importer, the prototypes
and the consolidation pilots are unchanged. Tracking: XS-11, EXP-01, HOME-09,
TEAM-06 (DESIGN-DECISIONS RK-1 to RK-5).

- **Continues:** XS-11 and `STATUS-SEMANTICS-AUDIT.md` S2, E1, D2 and
  decision D4.
- **Code read at `e3e9f88`.** `lib/` and `test/` paths are relative to the
  repository root; the backend is `services/edge-api/`.
- **Screens:** Standings, Driver Detail, Team Detail, Explore (Flutter and
  Alternative B). Home only for championship leaders, Grand Prix Detail only
  for the classification/championship boundary.

## Summary

| # | Finding | Severity | Smallest correction | New copy |
|---|---|---|---|---|
| R1 | Standings reads an unranked row as "**Position unavailable**" ("Posición no disponible"). By contract, a null position **means unranked** (a known fact), and no "unknown position" state exists | Accessibility misinformation | Screen-reader text only: reuse the existing `positionUnranked` ("Unranked" / "Sin clasificar"). Visible "—" unchanged | No |
| R2 | Flutter Explore prints position and points as **bare numbers** (`3 · 120`), visibly and to the screen reader. For an unranked competitor only the points remain, so "12" can be read as 12th place | Visible + accessible ambiguity | Labelled data line already approved for Explore (EX-01 difference 1); spoken text gets words. Omitting an unranked position stays | No |
| R3 | Home shows "**No leader yet**" when the table **does** have one confirmed leader whose name is not stored locally | Visible misinformation (by construction) | Show the existing "Leader unavailable" for that case | No (ARB description only) |
| R4 | Home tied leaders list only the names that are stored. With one name missing, "Tied leaders" shows a single name; the known count is unused | Minor | Owner decision; no change proposed | — |

**No screen shows a false zero, and none hides a meaningful value.** A
missing standing never becomes 0, a confirmed 0 is always shown, and missing
result points are omitted.

---

## 1. Supported semantic states (grounded in code)

### 1.1 Championship standings

| State | Source and type | Distinguishable in the client? | Notes |
|---|---|---|---|
| **Ranked** | `position: int?` with a value ≥ 1 (`DriverStandingDto`, `ConstructorStandingDto`; Drift `integer().nullable()`) | Yes | |
| **Unranked** | `position == null` in a **present** standing row | Yes | Domain model §standings: "`null` if unranked" (`docs/technical/GridView_Domain_Model.md` lines 649, 663). `standing.dart`, `standing_entry.dart` and the tables say the same |
| **Position unknown / unavailable** | — | **Not a state** | Unranked is the contract's only meaning of null. The active Jolpica decoder refuses the **whole table** when a row has no strict numeric position or `positionText` differs (`standings-payload.ts` `readPosition`, problem `position`). No display token ("-", "D") is mapped, so an unknown position is never published. Only the mock provider publishes a null position (`generated-snapshots.test.ts` line 42) |
| **Known points, including 0** | `points: double`, **required** in DTO, table and entities | Yes | A zero is always real |
| **Unknown points** | — | **Not a state in standings** | The audit's axis C already says this. It exists only in two other places: (a) Explore cards, `points == null` when **no standing row exists** (`season_card.dart`); (b) race-result entries, `points: double?` (contract `RaceResultEntry.points: number \| null`; Jolpica always supplies them) |
| **Tie** | Several rows with the same `position`; `orderIndex` keeps the delivered order | Yes (client), **unreachable today** | The client and contract accept it (`repository_domain_test.dart` line 107). The Jolpica decoder refuses duplicate positions (`checkPositions`, `duplicate-position`). Only a tie **at position 1** is announced (`hasTiedLeaders`; Home `HomeTiedLeaders`); lower ties render as delivered, with no claim |
| **Table not downloaded** | Materialization of `standings:<kind>:<season>` | Yes, per table | Standings: `StandingsLoading` / `StandingsFirstLoadError` / `StandingsEmpty` / `StandingsReady`. Home: `resolving` / `unavailable` / `availableEmpty` / `available` |
| **No standing for this competitor** | Driver/Team detail `profile.standing == null`; Explore card position **and** points null | **Partly** | Detail cannot tell "table not downloaded" from "competitor not in the table": both omit the Championship section (safe, no claim). The detail payload's own `standing` is parsed and **not stored** (`driver_repository_impl.dart` line 139, "composed from the roster/standings syncs"), the same pattern as CIR-02 |
| `wins` | `int?` | Yes | Jolpica always supplies it. Null is omitted; 0 is shown |
| `podiums` | `int?` | Yes | Jolpica never supplies it (`standings-normalizer.ts` "S-7": `podiums: null`), so it is always omitted with real data |

### 1.2 Race classification (Grand Prix Detail, Home latest result)

| State | Source | Meaning |
|---|---|---|
| Classified position | `RaceResultEntry.position: int?` | Finishing place in **that session** |
| Not classified | `position == null`, set by the normalizer `classified ? row.position : null` | Retired, did not start and similar rows. Paired with `FinishStatus` |
| Finish status | `FinishStatus` finished, lapped, dnf, dns, dsq, dnq, unknown | Independent of any championship value |
| Result points | `points: double?` | 0 is real; null is omitted |

**No championship value is derived from a classification**, nor the reverse.
Home's race winner requires a confirmed race `position == 1` (`home_race_winner.dart`).

---

## 2. Screen-by-screen discrepancy matrix

EN / ES values are the ARB strings. "Proto" is the approved prototype or its
consolidation pilot (pixel-identical).

| ID | Screen · condition | Flutter visible | Flutter accessible | Proto | Correct? | Existing item |
|---|---|---|---|---|---|---|
| ST-1 | Standings · ranked | "3" | "Position 3, {name}, {team}, 120 points, …" / "Posición 3, …, 120 puntos" | Same | Yes | — |
| ST-2 | Standings · **unranked** | "—" (`standingsUnrankedPosition`) | "**Position unavailable**, {name}, …" / "**Posición no disponible**, …" (`standingsUnrankedSemantics`, whose ARB description says "unranked") | Same (`standings/states.html` frame 1, "Position unavailable, Unranked Top, 999 points") | **No** (R1) | Audit S2, D4 |
| ST-3 | Standings · zero points | "0" | "0 points" / "0 puntos" | "0" | Yes | Audit S3 |
| ST-4 | Standings · tie at position 1 | "1" on each row, leader emphasis | "…, Tied for the championship lead" / "Empatado en el liderato del campeonato", once per row | Same (frame 2) | Yes | STD-03 (weight only) |
| ST-5 | Standings · tie below 1 | Duplicate positions as delivered | "Position 5" on each row, no tie wording | Not rendered | Yes (no claim); unreachable with Jolpica | — |
| ST-6 | Standings · unranked row above ranked rows | Delivered order kept, "—" | Unranked first | Same ("Unranked Top", 999 points, top of frame 1) | Yes: order is not re-derived, and nothing implies a rank | — |
| ST-7 | Standings · table missing / empty | Skeleton, first-load error, valid empty | Same states | Partly rendered | Yes | STD-01, STD-02 |
| DT-1 | Driver Detail · ranked | "Position" / "3" | Two text nodes in a row ("Position", "3"); no merged label | Same | Yes; reading as one pair needs TalkBack check | XS-02 |
| DT-2 | Driver Detail · **unranked** | "Position" / "**Unranked**" / "**Sin clasificar**" (`positionUnranked`) | Same words | Same (`driver-detail/states.html` frame 12) | Yes | Audit D2 |
| DT-3 | Driver Detail · zeros, podiums missing | "0" points, "0" wins; podiums omitted | Same | Same | Yes | Audit D2 |
| DT-4 | Driver/Team Detail · no standing | Championship section omitted | Omitted | Not rendered | Yes (safe); cannot tell "not downloaded" from "not in the table" | DRV-04 fixtures |
| TM-1 | Team Detail · ranked / unranked | Same formatter as Driver (`EntityFormatter.position`) | Same | Unranked **not prototyped** | Yes in code; not evidenced visually | TEAM-06 |
| TM-2 | Driver/Team Detail · position 1 | No leader treatment | — | Same | Consistent with Flutter | DRV-06 |
| EX-1 | **Flutter** Explore · ranked | "{team} · {nationality} · **3 · 120**" | "{name}, {team}, **3 · 120**" (no "position", no "points") | Labelled: "Position 2" / "Points 402.5" visible; aria "…, Position 2, Points 402.5, …" | **No** in Flutter (R2); prototype correct | EXP-01 difference 1 (approved), XS-04 |
| EX-2 | **Flutter** Explore · **unranked with points** | "… · **0**" (fixture Colapinto: `position: null`, `points: 0`) | "…, **0**" | "Points 0", no Position datum (`comparison-missing-media/cue.html`) | **No** in Flutter: a bare number can read as a place (R2). Prototype correct | Audit E1, XS-04 |
| EX-3 | Explore · no standing row | Standing omitted | Omitted | Omitted | Yes | — |
| HM-1 | Home · single confirmed leader | Name, team, "241 pts" | "{championship}, {name}, {team}, 241 points" | Rendered | Yes | — |
| HM-2 | Home · tied leaders | "Tied leaders" / "Líderes empatados", stored names, shared points or none | Same | Not rendered | Yes | HOME-04 |
| HM-3 | Home · table not materialized | "Leader unavailable" / "Líder no disponible" | Same | Not rendered | Yes | HOME-04 |
| HM-4 | Home · materialized, no confirmed position 1 | "No leader yet" / "Aún no hay líder" | Same | Not rendered | Yes | HOME-04 |
| HM-5 | Home · materialized, **one position 1 with no stored name** | "**No leader yet**" | Same | Not rendered | **No** (R3): a leader exists | none (new) |
| HM-6 | Home · tie with an unstored name | "Tied leaders" + only the stored names (may be one) | Same | Not rendered | Partly (R4) | HOME-04 |
| GP-1 | Grand Prix · classified row | "3", driver, team, points | "3, {driver}, {team}, Finished, 15 Points" | Same structure | Yes; classification only, no championship value | XS-12 (unit) |
| GP-2 | Grand Prix · DNF / DNS / DSQ / DNQ | "—", status chip, points as delivered | Position omitted, status spoken | Word chip, no false zero (G-7) | Yes; no championship rank implied | Audit G5 |
| GP-3 | Grand Prix · result points null | Omitted | Omitted | Omitted | Yes; never turned into 0 | — |

---

## 3. Correct behaviour to preserve

- **Null position never becomes 0** and never the list index (Standings,
  details, Explore).
- **Confirmed zeros stay visible:** points, wins, and a 0-point leader on
  Home.
- **Absent optional statistics are omitted**, never zero: wins, podiums,
  Explore points with no standing, result points.
- **Delivered order is authoritative.** An unranked row keeps its delivered
  place, and no order is recomputed from points.
- **The leader comes only from a confirmed `position == 1`**, never from
  maximum points or the first row. Ties are never collapsed. A tie on
  position without a tie on points shows no shared total
  (`HomeTiedLeaders.points == null`).
- **The leader is announced once per row** in Standings: "Championship leader"
  or "Tied for the championship lead".
- **Table-level availability is separate from per-row facts.** "Leader
  unavailable" (not materialized) differs from "No leader yet" (materialized,
  no position 1).
- **Classification and championship stay apart.** Grand Prix rows are
  session places with a finish status; no DNF/DNS/DSQ implies a championship
  position, and missing result points are omitted.
- **Season scope and spans are unchanged.** Detail standings belong to the
  exact detail season; participation spans keep ADR 0026 D6 (TEAM-05 stays
  separate).
- **Explore omits an unranked position.** With the labelled data line, the
  remaining "Points 0" cannot be taken for a place. Adding "Unranked" to
  every unranked card would only make screens identical.

## 4. Misleading visible or accessible wording

1. **R1, Standings (accessible only).** "Position unavailable" /
   "Posición no disponible" says the data is missing (availability axis D).
   The fact is that the competitor is unranked (ranking axis C), which
   Driver and Team Detail already say: "Unranked" / "Sin clasificar". The
   label is never appropriate today, because the client has no "unknown
   position" state. It would become appropriate only if the contract added
   one, and that is not proposed.
2. **R2, Flutter Explore (visible and accessible).** Two unlabelled numbers.
   When the position is absent, the single remaining number (points) sits
   where a place would be expected. The screen reader hears "3 · 120" or
   "0" with no unit. The approved prototype already fixes this with labels.
3. **R3, Home (visible).** "No leader yet" asserts that nobody leads, while
   a confirmed position 1 exists and only its identity is missing. It is
   reachable whenever standings are stored before the roster or identities
   (identity stubs, `GridView_Local_Data.md` §9). It is shown even though
   `resolveDriverLeader` deliberately treats this case as "unavailable":
   `HomeLeaderUnavailable` merges "no confirmed leader" and "unresolved
   identity", and `availabilityOf(isEmpty: true)` turns both into
   `availableEmpty`.
4. **Minor, not proposed for change:** Grand Prix row labels start with a
   bare position ("3, Max Verstappen, …") and use the label-case "15 Points".
   These stay with XS-04 and XS-12.

## 5. Recommended shared mapping

| Condition | Visible | Accessible | Missing-value rule | Number format |
|---|---|---|---|---|
| Ranked | Position number; in labelled contexts under "Position" | "Position {n}" (`standingsPositionSemantics`) | — | Integer, no grouping |
| **Unranked** (present row, null position) | Tables: "—"; detail and labelled contexts: "Unranked" / "Sin clasificar"; Explore: datum omitted | "**Unranked**" / "**Sin clasificar**" (`positionUnranked`), once, where the position would be read. Explore: nothing | Never 0, never blank in a table | — |
| No standing row / table not local | Section, datum or card standing omitted; table-level states as today | Omitted; table-level messages as today | No per-competitor claim | — |
| Points known (incl. 0) | Locale number, trailing zeros dropped, never rounded (`ResultFormatter.points`) | "{n} points" (`standingsPointsSemantics`) | 0 always shown | `25`, `25.5` / `25,5` |
| Points absent (cards, result rows only) | Omitted | Omitted | Never 0 | — |
| Tie at position 1 | "1" on each tied row, leader emphasis | "Tied for the championship lead", once per row | Never one leader | — |
| Tie below 1 | Duplicate numbers as delivered | "Position {n}" each | No tie wording | — |
| Race classification | Place or "—" + finish status | Place (when present) + status | Points omitted when null | As above |

**Screen-reader text alone resolves R1.** No visual change is needed: "—"
stays the compact table mark, as the audit's principle 3 already proposed.
R2 is visible in Flutter but already designed (EX-01 difference 1). R3 is a
copy-selection fix using an existing string. **No new chips, colours or
indicators.**

**Repetition:** "Unranked" appears once per unranked row, where the position
would otherwise be read, and never as an extra status suffix. Ranked rows
gain nothing.

## 6. Proposed EN/ES text

**No new strings are needed.**

| Use | Key | EN | ES | Change |
|---|---|---|---|---|
| R1, Standings unranked row label | `positionUnranked` (existing) | Unranked | Sin clasificar | Reuse in `StandingsFormatter.positionSemantics`. `standingsUnrankedSemantics` then becomes unused, and its removal is left to a later ARB clean-up |
| R2, Explore labels | `fieldPosition`, `fieldPoints`, `standingsPositionSemantics`, `standingsPointsSemantics` (existing) | Position / Points; "Position {n}", "{n} points" | Posición / Puntos; "Posición {n}", "{n} puntos" | None |
| R3, Home unresolved leader | `homeLeaderUnavailable` (existing) | Leader unavailable | Líder no disponible | Text unchanged. At the next ARB review, widen its **description** ("not materialized, or the confirmed leader's identity is not stored") |

**Alternative for R1 (not recommended):** change the value of
`standingsUnrankedSemantics` to "Unranked" / "Sin clasificar". It gives the
same result but keeps two keys for one meaning, and it edits ARB copy.

**Spanish note (owner check, optional):** "Sin clasificar" is existing,
approved copy. In a race context, "clasificado" also means classified at the
finish. In the championship context the meaning is clear, so no change is
proposed.

## 7. Required future Flutter and test changes (not implemented)

**Flutter**
1. **R1:** in `lib/features/standings/presentation/standings_row_view.dart`,
   `positionSemantics(null)` returns `l10n.positionUnranked`. The visible
   `position()` is unchanged.
2. **R2:** implement the labelled Explore data line approved in EX-01
   (`lib/features/explore/presentation/explore_cards.dart`):
   - visible "Position" / "Points" labels;
   - semantic parts `standingsPositionSemantics(n)` and
     `standingsPointsSemantics(p)`;
   - an unranked position is still omitted;
   - this belongs to the EXP-01 / XS-04 implementation, not a separate change.
3. **R3:** let Home tell "no confirmed position 1" from "position 1 with an
   unresolved identity". For example, `HomeLeaderUnavailable` carries a
   reason, or a separate `HomeLeaderUnresolved`, and the latter maps to
   `homeLeaderUnavailable`. It is a presentation read model only: no DTO,
   table or contract change. Availability stays computed from
   materialization.
4. **Prototype follow-up after approval:** `standings/states[.es].html` frame
   1 and its consolidation pilot use the old label. Change them only when
   the owner approves R1; untouched here.

**Tests: currently assert the incorrect wording**
- `test/screens/standings_widget_test.dart` lines 257–271, "an unranked row
  shows an em dash, never a zero position", expects
  `'Position unavailable, Reserve Entrant'`. Change the expectation to
  `'Unranked, Reserve Entrant'` and keep the "—" assertion.

**Tests: protect known zeros (keep)**
- `test/screens/entity_detail_widget_test.dart` around line 240 ("Unranked" +
  "0" with zero statistics).
- `test/domain/home_leader_test.dart`, "a confirmed zero stays zero".
- `test/database/entity_collection_read_model_test.dart` lines 216–217
  (unranked is not zero; confirmed zero points kept).
- Standings fixture Franco Colapinto, position 19 with 0 points
  (`test/support/domain_fixtures.dart`).

**Tests: cover unranked and missing (keep)**
- `standings_widget_test.dart` line 257 (with the wording change above).
- `entity_detail_widget_test.dart` line 258 ("Unranked") and lines 75 and 103
  (partial profiles with no standing → no Championship section; there is no
  dedicated test for a complete profile whose table is not downloaded).
- `explore_widget_test.dart` line 444, "an unranked entrant shows no false
  zero position". **Weak:** its "Reserve Entrant" card has no standing at
  all, so it tests "no standing", not "unranked with points", and it only
  checks the name is present.

**Tests: cover ties (keep)**
- `standings_widget_test.dart` line 337.
- `home_widget_test.dart` line 412.
- `home_leader_test.dart` lines 61–106, including the different-points and
  unresolved-name ties.
- `repository_domain_test.dart` line 107.
- Goldens `screen_golden_test.dart` lines 221 and 858.
- `home_navigation_test.dart` lines 183 and 217.

**Tests: `home_widget_test.dart` lines 460–470** ("a materialized table with
no leader yet says so") are correct and stay, because there is genuinely no
position 1.

**New cases needed**
- **Explore:** an unranked card **with points** (Colapinto: `position:
  null`, `points: 0`). The visible text is labelled "Points" and no position
  datum appears. The semantic label contains "0 points" and no bare number
  or "Position".
- **Explore:** the ranked card's semantic label contains "Position 3" and
  "120 points".
- **Standings:** the semantics tree for an unranked row contains no
  "unavailable" / "no disponible". Spanish variant: "Sin clasificar,
  Reserve Entrant".
- **Constructors table:** an unranked row. The constructors fixture has
  three rows, all ranked.
- **Team Detail:** an unranked standing ("Unranked", zeros shown). Fixture
  gap TEAM-06.
- **Home:** a materialized table with one position 1 whose name is not
  stored shows "Leader unavailable" and never "No leader yet". The domain
  half already exists (`home_leader_test.dart` line 109).

**Not changed:** sports ranking rules, delivered order, tie handling, the
standings contract, the Jolpica decoder's refusal of non-numeric or
duplicate positions.

## 8. Remaining owner decisions

- **RK-1 (R1):** approve "Unranked" / "Sin clasificar" as the accessible
  meaning of an unranked Standings row by reusing `positionUnranked`. It
  closes audit decision D4 (first half).
- **RK-2 (E1, D4 second half):** confirm that Explore keeps **omitting** an
  unranked position, together with the labelled data line (recommended),
  rather than showing "Unranked" on the card.
- **RK-3 (R3):** approve "Leader unavailable" for a confirmed leader whose
  identity is not stored. No new copy; a future ARB description update only.
- **RK-4 (R4):** tied leaders with an unstored name. Keep it (recommended
  for now: the names shown are true and the module links to Standings) or
  use the existing `count` later, which would need new copy.
- **RK-5 (tracking):** where to record R1–R3 after review. R1 and R3 have
  no backlog item; R2 is covered by EXP-01 / XS-04. Recommended: extend
  XS-11's scope note for R1, and add one Home item for R3. No IDs are
  created and no statuses changed until the owner decides.

Out of scope and unchanged: the stale-calendar question (CD-2), the
provisional look (V2), unknown-status styling (V3) and Driver/Team leader
treatment (DRV-06).

## 9. Owner decisions recorded (2026-11-11)

| Decision | Outcome | Tracking |
|---|---|---|
| **RK-1** | Accepted. An unranked Standings row is announced "Unranked" / "Sin clasificar" (existing `positionUnranked`); visible "—" kept; "Position unavailable" never means unranked | XS-11 (widened) |
| **RK-2** | Accepted. Labelled "Position" / "Points" (Alternative B); unranked position omitted; known points, including 0, kept; no isolated number that could read as a position. No Explore redesign | EXP-01 (difference 1 note) |
| **RK-3** | Accepted. "Leader unavailable" when a first-place standing exists but the name is not stored; "No leader yet" only when the standings establish no leader | **HOME-09 (new, P1)**. HOME-04 was checked: it covers prototype rendering of these states, not the Flutter wording |
| **RK-4** | Provisionally accepted with conditions (below) | No new item |
| **RK-5** | Accepted. Tests recorded in each item; implementation stays open until the Flutter tests pass | XS-11, EXP-01, HOME-09, TEAM-06 |

**RK-4 conditions checked against today's presentation**

| Condition | Home (`home_leader_card.dart`) | Standings |
|---|---|---|
| The tie is stated | Yes: title "Tied leaders" / "Líderes empatados", also in the label | Yes: "Tied for the championship lead" on every tied row |
| No invented name | Yes: only stored names; never an identifier | Yes: "Name unavailable" on an unnamed row |
| One visible name never reads as the sole leader | Met: the plural title always precedes the names, and the card opens Standings, where every tied row appears | Met: each tied row is announced as tied |

No current presentation fails the conditions, so no future correction is
recorded. **Weakness kept (not a failure):** with an unnamed tied
competitor, Home does not say how many share first place (`count` is
unused). Stating it would need new copy, which RK-4 does not request.
HOME-04 still covers rendering these states in the prototype.

**Importer note.** The Jolpica decoder refuses repeated positions and
non-numeric positions, so ties and unranked rows cannot arrive with real data
today, although the model and the client represent both. The importer is
unchanged.

**Tests (open until they pass in Flutter)**

| Screen | Tests | Item |
|---|---|---|
| Standings | Unranked expectation becomes "Unranked, Reserve Entrant"; Spanish "Sin clasificar, …"; no "unavailable" in an unranked label; an unranked constructors row | XS-11 |
| Explore | Unranked card with points: "Points" label, "0 points" spoken, no position datum; ranked card label contains "Position 3" and "120 points" | EXP-01 |
| Team Detail | Unranked standing shows "Unranked" with zeros (fixture gap) | TEAM-06 |
| Home | Materialized table with one unnamed position 1: "Leader unavailable", never "No leader yet"; existing no-leader and domain tests kept | HOME-09 |
