# 0026 - Season participation semantics and derivation

- Status: Accepted
- Date: 2026-09-23
- Phase: 9B
- Amends: [0023](0023-multi-source-provider-coordination.md) D11 (season
  assembly gains a participation-derivation step, by reference, in the same
  way [ADR 0022 amendment A7](0022-curated-provider-identifier-mappings.md#a7---hasresults-is-owned-by-season-assembly)
  did for `hasResults`); `GridView_Domain_Model.md` §6.7 (the meaning of a
  null `startRound`/`endRound` and the split-span identity)
- Related: [0007](0007-versioned-kv-publication-active-pointer.md),
  [0020](0020-provider-source-observation-and-reconciliation.md),
  [0022](0022-curated-provider-identifier-mappings.md),
  [0023](0023-multi-source-provider-coordination.md),
  [0024](0024-deep-normalized-contract-validation.md)

> **What "Accepted" means here.** This ADR records an **architecture
> decision only**. None of the mechanism it describes exists in code: there is
> no Jolpica drivers, constructors or race-results port, no participation
> derivation in season assembly, no new integrity relation and no
> driver-detail fix. No schema, contract, content, test, configuration or
> runtime path changes with it. No provider evidence was captured for it and
> no provider was contacted. `PROVIDER_MODE` still admits exactly `mock` and
> `none`. The decision stays dormant until each prerequisite in
> [What stays open](#what-stays-open) is separately implemented.

## Context

The coordinated `season-participants` resource is one payload carrying four
collections (`coordination/payload-contract.ts`): `drivers`, `constructors`,
`driverEntries` and `constructorEntries`. Nothing decided how a real provider
fills them. Two dormant Jolpica ports exist (`season-calendar` and
`season-circuits`); participants were refused as `resource-unsupported`
precisely because this question was open.

The repository already forces several answers:

1. **The identity inventory must cover every entrant ever published.** The
   referential preflight (`season-integrity.ts`) fails `result-entry-driver`,
   `result-entry-constructor`, `driver-standing-driver` and
   `driver-entry-driver` unless each referenced identity is in the
   participants resource. A published earlier-round classification naming a
   driver who has since left therefore requires that driver in `drivers[]`, so
   the resource cannot be "the current line-up".
2. **A season identity list cannot create participation.** A
   `DriverSeasonEntry` requires `constructorId`, and Jolpica's
   `/{season}/drivers/` carries no team (Provider Evaluation §8.4).
3. **The published Drivers collection is one row per `driverEntries` item**
   (`snapshots/generator.ts`), while a driver detail document is generated for
   every `drivers[]` identity. An identity without a span is therefore already
   representable without appearing in the season list.
4. **Every fetched provider row must resolve** (ADR 0022 D10), so the set of
   endpoints fetched defines the curation burden.
5. **Last-known-good is snapshot-level.** Assembly publishes from one run's
   selections and there is no per-resource carry-over (G9 is open).
6. **Jolpica event status is `unknown`** (ADR 0022 A6), so the ADR 0023 D11
   status table never *requires* a classification for a Jolpica round. A rule
   that needs complete round accounting must state it itself.

The recorded evidence is thin. The 2026-08-19 research pass observed 31
`/2026/drivers/` rows and 11 `/2026/constructors/` rows (Provider Evaluation
§8.4) but did not preserve them, so 29 driver and 9 constructor identifiers
are unrecorded. The same pass recorded 22 driver-standings rows at round 11,
so whether any of the extra 9 driver identities ever raced is **unverified**.
This decision was prepared from repository sources only, in a private redacted
decision pack (SHA-256
`a7697f3b127016ab789d85f1ac30df4d574613a84126f197f191f8fbebbb6396`); no
provider data was captured for it.

## Decision

**Model F: identity inventories from the season endpoints, race participation
derived by season assembly from the selected race classifications.**

### D1 - What `season-participants` means

`season-participants` carries two different things, and never mixes them:

- the **identity inventory**: every driver and constructor the reconciled
  source lists for the season, each resolved to a curated GridView identity;
- **race participation**: `DriverSeasonEntry` spans derived from observed race
  classifications, and one `ConstructorSeasonEntry` per season constructor.

It is **not** a line-up and **not** general weekend participation. A span
records that a driver appeared in race classifications for one constructor
over a run of rounds; it says nothing about practice, testing, reserve duty or
announced plans.

Driver and constructor identity remain separate from season participation
(Domain Model §2, §3). Driver numbers are never durable identities (Provider
Evaluation §8.7 M2, ADR 0022 D3).

### D2 - The identity inventory

- `GET /ergast/f1/{season}/drivers/?limit=100` defines the complete
  provider-observed **driver** identity universe for the season.
- `GET /ergast/f1/{season}/constructors/?limit=100` defines the complete
  provider-observed **constructor** identity universe for the season.
- Every returned row must resolve through a curated, season-qualified mapping
  (ADR 0022 D2-D5). One unmapped or invalid row fails the **complete**
  identity resource. No provider row is silently dropped (ADR 0022 D10).
- Identity facts come from the curated registries, as for circuits. Provider
  display fields (`Constructor.name`, given and family names) never become
  canonical content.
- The 31 driver identities observed for 2026 **remain identities even if some
  never receive a participation span**. They are not flattened into a
  22-driver grid.
- A driver identity with no span may exist in identity and detail data. It is
  **never** invented into the public season Drivers collection, which is built
  only from `driverEntries`.
- These endpoints **never** create a `DriverSeasonEntry`.

**Mapping status is unchanged by this ADR.** No identity is approved or
minted here. The Jolpica `antonelli` acknowledgement remains a blocker for any
Jolpica participants or race-result publication until a canonical driver
identity and mapping are separately approved. The OpenF1 acknowledgements for
`driver_number` `12`, `Cadillac` and `Racing Bulls` are outside this Jolpica
decision and remain unchanged; OpenF1 has no participants capability (ADR 0023
D4) and stays locked (D5).

### D3 - The only source of participation

A `DriverSeasonEntry` is derived **only** from a **selected, available and
classified Jolpica race-result row**: a row of the `race` classification that
the coordinator selected for the run, whose status is `final` or
`provisional`. That is the same classified-round set assembly already
computes for A7.

None of the following creates, extends or closes a span:

- `/{season}/drivers/` or `/{season}/constructors/`;
- driver standings or constructor standings;
- qualifying alone;
- sprint or sprint-qualifying alone (a sprint-only appearance creates no
  `DriverSeasonEntry`);
- practice participation;
- calendar presence;
- a clock or a scheduled date;
- external reputation or an expected or announced line-up;
- an unselected, unavailable, invalid or rejected result document.

**Provisional classifications.** ADR 0023 D4 and D8 allow a provisional
OpenF1 race classification to be selected when no reconciled contribution
exists. OpenF1 is locked (D5), so no such classification can be selected
today. This decision derives participation from Jolpica rows only. A selected
race classification from any other source therefore produces no span, and
under D12 its rows cannot be placed in a span, so the candidate is withheld.
That is the intended fail-closed outcome. **Before the OpenF1 path is
unlocked**, a separate decision must settle whether participation derives
from a selected provisional classification or whether provisional race
fallback is excluded from coordinated publication.

One normalized race-result row observes exactly one driver, one constructor
and one round. A row is participation whatever its finishing status: finished,
retired, not classified, disqualified or not started, **if the row is
present**. Whether Jolpica lists non-starters in 2026 race results is
unrecorded and must be established by evidence before implementation.

### D4 - Round accounting

Every calendar round is in exactly one of these states:

| State | Meaning | Effect |
|---|---|---|
| Selected classified round | A race classification for the round is selected and is `final` or `provisional` | Accounted. Each row is a participation observation |
| Explicitly cancelled round | Cancellation is established by an **accepted curated record** | Accounted, and skipped for continuity. No observation, no synthetic span |
| Future round | A calendar round after the latest selected classified round | Not yet observed. Never closes an open span |
| Unaccounted round | A calendar round before the latest selected classified round that is neither classified nor curated as cancelled: its result is missing, unavailable or unknown | **Withholds** the participants candidate |
| Provider-invalid round | A planned race classification that is invalid, rejected, contradictory or unmapped | **Withholds** the participants candidate |

Rules:

- Absence of future evidence is not evidence of exit. A future round never
  closes an open span.
- A missing or unavailable intermediate classification **never** closes a span.
- If selected classifications exist after an unaccounted earlier round, the
  candidate is withheld and the previous valid snapshot remains live.
- Cancellation is **never** inferred from an absence of results, from the
  calendar or from a clock. It is established only by an accepted curated
  record. No such record or schema exists yet; until one is separately
  reviewed and added, a cancelled round below the latest classified round
  withholds the candidate.
- There is **no** clock-based "this round should have happened" rule.
- Missing, malformed or contradictory round data fails the complete candidate;
  partial spans are never published.

### D5 - Span derivation

Spans are a pure function of the complete selected classification set,
**rebuilt from scratch on every run**. They are never patched field by field,
so a provider correction is absorbed by rebuilding.

1. A driver's first selected classified race observation **starts** a span.
2. The next **accounted** race round (skipping only curated cancellations)
   with the driver present for the **same** constructor **extends** the span.
   Numeric round adjacency alone is never sufficient: continuity depends on
   every relevant race round being accounted for (D4).
3. A selected classified round showing the driver with a **different**
   constructor **closes** the previous span at the driver's previous observed
   race round and **opens** a new span at the current round.
4. A later accounted classified round in which the driver is **absent**
   **closes** the open span at the driver's previous observed race round.
5. A later return creates a **new** span, even with the same constructor as
   an earlier span.
6. Two spans for one driver may not overlap (the existing
   `driver-entry-span` rule, including its treatment of touching spans).
7. Every span contains at least one selected classified race observation.
8. Every selected classified race-result row falls inside **exactly one**
   driver span with the same driver and constructor.
9. Two constructors for one driver in one round are contradictory and
   invalidate the candidate.
10. Duplicate driver rows for one round invalidate the candidate.

### D6 - Open-span meaning

`GridView_Domain_Model.md` §6.7 is amended. The previous text read a null
`endRound` as "until the season end", which in an in-progress season would
predict participation. The accepted meaning is:

- `startRound: null`: participation was already in effect at the beginning of
  the season's observed scope, meaning the span begins at the season's first
  selected classified race round.
- `endRound: null`: no later accepted race-classification observation has yet
  established the driver's exit from that span.

A null end **does not** assert that the driver will remain with the
constructor until the season ends. When the season is complete and no later
observation closed the span, null remains the valid representation of "no
observed exit". The contract is unchanged: both fields are already nullable
integers. Null/null alone therefore never proves participation for the
complete season. The Flutter client currently renders it as "Full season",
which contradicts this meaning; correcting that is a publication prerequisite
(D12 item 3).

### D7 - `DriverSeasonEntry` identity

The previously undefined split-span convention is resolved. A span's ID is
determined by its **own accepted start boundary**, never by its ordinal
position among the driver's spans:

- If `startRound` is `null`, the ID is the base identity
  `{season}-{driverId}`.
- If `startRound` is non-null, the ID is `{season}-{driverId}-{startRound}`.

The rule applies identically whether the span is the driver's first observed
span, only span or a later span, and whether a later span is a return to the
same constructor or a move to a different one. For example:

| Span | ID |
|---|---|
| Observed from the season start, no observed exit | `2026-max-verstappen` |
| Driver's first appearance at round 7 | `2026-franco-colapinto-7` |
| A later return beginning at round 12 | `{season}-{driverId}-12` |

Consequences:

- "First span" is not an identity condition. A driver who joins mid-season
  receives a suffixed ID even when that is the driver's only span.
- The ID is a strict function of the entry's own `season`, `driverId` and
  `startRound`. It stays deterministic when a provider correction inserts an
  **earlier** span: the earlier span takes its own ID, and no existing later
  span is renamed.
- A correction that changes a span's accepted `startRound` may legitimately
  change that span's ID, because the span boundary itself changed.
- At most one span of a driver has a null `startRound` (only a span beginning
  at the season's first selected classified race round, D6), and two spans of
  one driver can never share a non-null `startRound` (D5 rule 6), so two
  derived spans never share an ID.
- The driver's identity never changes, and no provider identifier is ever
  copied into an ID.
- The rule matches the existing OpenAPI `DriverSeasonEntry.id` description and
  example (`2026-franco-colapinto-7`) and the mid-season entry in the current
  mock data (`2026-franco-colapinto-10`, `startRound: 10`). The OpenAPI
  contract is unchanged.

This uses the existing `GridViewId` grammar
(`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 96 characters). The suffix is the
decimal accepted start round, joined with the existing hyphen separator.

> **Revised 2026-09-23, during review and before this ADR was merged.** An
> earlier draft of D7 gave the base ID to a driver's "first or only" span and
> suffixed only later spans. Review found that a correction inserting an
> earlier span would then rename an already published later span, and that the
> draft disagreed with the OpenAPI example for an incoming mid-season seat. It
> was replaced by the start-boundary rule above. The draft rule never reached
> the canonical documentation and was never implemented.

### D8 - Field policy

Nothing is populated from identity display data because a similar string is
available.

| Field | Value |
|---|---|
| `DriverSeasonEntry.raceNumber` | `null`. The normalized race classification carries no accepted season car-number field. Career `permanentNumber` is never substituted |
| `DriverSeasonEntry.role` | `race`, because the span exists only through accepted race-classification rows. `reserve` and `test` are never produced by this derivation |
| `DriverSeasonEntry.shortCode` | `null` unless separately supplied by an accepted season-specific source |
| `DriverSeasonEntry.startRound` | `null` when the span begins at the season's first selected classified race round; otherwise the span's first observed round. It selects the base or suffixed ID (D7) |
| `DriverSeasonEntry.endRound` | `null` while no accepted later observation proves exit; otherwise the span's final observed race round |
| `ConstructorSeasonEntry.fullName`, `shortName`, colours, `powerUnit`, `teamPrincipal`, `base`, `chassis` | `null` unless separately sourced |
| `ConstructorSeasonEntry.driverLineup` | `null` in the provider-produced entry. The line-up is derived from driver spans (`GridView_Local_Data.md` §10.3) |

### D9 - Before the first race

- Before the first selected classified race result, the season may contain
  mapped driver and constructor identities but **zero** `DriverSeasonEntry`
  rows.
- GridView does **not** publish a guessed pre-season line-up. Standings and
  announced line-ups are never a silent fallback.
- The empty pre-season Drivers collection is an accepted temporary product
  limitation, not a provider failure.
- Curated pre-season participation could be introduced only by a future,
  separately reviewed decision and dataset.
- Once the first classification is selected, assembly derives spans from the
  accumulated selected classification set.

### D10 - Constructor season entries

- Each mapped constructor in the season constructor identity resource receives
  one `ConstructorSeasonEntry` with identity `{season}-{constructorId}` (the
  existing `constructor-entry-identity` rule).
- Optional seasonal branding fields remain `null` unless separately sourced
  (D8).
- The line-up is derived from `DriverSeasonEntry` spans and is **not** accepted
  as a second source of truth.
- A constructor listed by the season endpoint with no observed driver span
  still exists as an identity and a season entry.
- Unknown constructor identities fail closed (D2).

### D11 - Ownership

| Responsibility | Owner |
|---|---|
| Driver and constructor identity normalization (D2, D10) | The future Jolpica drivers and constructors identity normalization behind the single `season-participants` resource. It emits identities and constructor entries **only**, and no participation span |
| Normalized race classifications | The future Jolpica race-results port |
| Selecting the classification documents | The coordinator (ADR 0023 D8), **before** any span is derived |
| Participation-span derivation (D3-D7) | **Season assembly**, from the exact rows it selected for publication |

Published participation and published race classifications therefore come
from the **same selected normalized rows** and cannot disagree. The
participants mechanism issues **no** result request of its own.

This amends ADR 0023 D11 by reference: for coordinated assembly, the
participants contribution's `driverEntries` carries no participation evidence,
and assembly derives the final collection. That is a derivation, not a
repair: nothing is fabricated, discarded or invented. Whether the contribution
carries an empty list or the field is otherwise reconciled is an
implementation detail of the future change. This ADR changes no contract, but
publishing a driver with more than one span needs the separately decided
contract change in D12.

### D12 - Validation and publication

Required of the future implementation:

- The existing `driver-entry-span` relation stays.
- The participants candidate is **atomic**. Partial spans are never
  published, and on incomplete or contradictory evidence the previous valid
  snapshot remains live (ADR 0023 D11, ADR 0007).

**Publication prerequisites.** No ADR 0026-derived span may reach a client
until **every** item below holds. Each is a separate prerequisite, and none is
implemented by this decision:

1. **Season Drivers collection support for split spans.** The generator emits
   one `SeasonDriverSummary` per `driverEntries` row, and that schema carries
   neither the entry `id` nor `startRound`/`endRound`. The client
   (`summary_mapper.dart`) therefore gives every summary the ID
   `{season}-{driverId}` with null bounds, and two spans of one driver would
   collide on the primary key inside `replaceDriverSeasonEntries`, rolling
   back the refresh. A separately decided contract (public DTO) and client
   change must let the summary carry more than one span per driver without an
   ID collision and without flattening, or publish one explicitly selected
   summary per driver. Until it exists, a candidate in which any driver has
   more than one span must not be published.
2. **Driver detail selects the current relevant span**, rather than taking
   the first entry: the open span, else the latest `startRound`, as the client
   already does (`GridView_Local_Data.md` §10.2). Today
   `snapshots/generator.ts` takes the first matching entry. That known defect
   must be fixed.
3. **The Flutter client stops inferring "Full season" from null/null.**
   `EntityFormatter.participationSpan`
   (`lib/features/shared/presentation/entity_formatting.dart`) renders
   `startRound == null && endRound == null` as the localized "Full season"
   (`participationFullSeason`), and the `isFullSeason` getters on
   `TeamLineupMember` (`season_card.dart`) and `DriverParticipation`
   (`entity_profile.dart`) classify the same value as full-season. Under D6,
   null/null means only that participation was already in effect at the
   beginning of the observed season scope **and** that no later accepted
   observation has established an exit. It does not prove participation for
   the complete season, so the client must not render "Full season" from
   null/null alone. Until explicit completed-season evidence exists, the
   presentation must use non-predictive wording, such as "From season start"
   or a reviewed equivalent. The final string is product copy for that change
   to settle; the normative requirement is only that "Full season" is never
   inferred from null/null. This correction and its tests are mandatory
   before any ADR 0026-derived span reaches a client.
4. **A deterministic implementation of the D7 ID rule**: base ID when
   `startRound` is null, `-{startRound}` suffix otherwise, computed from the
   entry's own fields.
5. **Bidirectional classification-to-span integrity.** A new closed
   season-integrity relation proves that every selected race classification
   row belongs to **exactly one** matching driver span, and its inverse proves
   that every driver span is supported by **at least one** selected
   classification row.
6. **A7 (`hasResults` derivation).** It remains a separate required assembly
   change. It shares the classified-round input and does not depend on this
   decision, but no season with a classified round can publish through
   coordination until A7 exists.
7. **OpenF1 participation stays blocked.** A selected OpenF1 race
   classification creates no span, so the candidate is withheld (D3), until a
   separate decision settles provisional-source participation.
8. **Participant identities and mappings are complete** for every
   `/drivers/` and `/constructors/` row (D2). They are incomplete today.
9. **Provider evidence is captured.** The season drivers and constructors
   responses and the per-round race results are not preserved, and capturing
   them needs separate authorization.

### D13 - Requests and scheduling

- Identity refresh requires `GET /ergast/f1/{season}/drivers/?limit=100` and
  `GET /ergast/f1/{season}/constructors/?limit=100` (for 2026:
  `/2026/drivers/?limit=100` and `/2026/constructors/?limit=100`).
- Explicit `limit=100` is mandatory. The recorded driver response had 31 rows
  and Jolpica defaults to 30 (Provider Evaluation §8.7 M10). A response whose
  `total` exceeds the rows returned, or exceeds 100, fails the resource.
- Participation derivation **reuses** the already selected race
  classifications. It issues no second request for a race result and
  introduces **no** independent event-aware participants schedule.
- No `/current/last` or `/next` shortcut is permitted (§8.7 M9).
- The quota model must later count identity requests and race-result requests
  at their actual owning resources. The documented weekly "participants and
  circuits (3 calls)" budget line (Provider Evaluation §11.2) must be
  reconciled with this ownership before runtime wiring.
- No request volume has been measured for any of this.

## Resolved choices

The seven choices the decision pack left open are settled:

| # | Choice | Accepted answer |
|---|---|---|
| 1 | Identity universe | All `/drivers/` and `/constructors/` rows; identity-only drivers are kept, never flattened (D2) |
| 2 | `raceNumber` | `null`; no accepted season car-number field exists (D8) |
| 3 | `role` | `race`, by construction (D8) |
| 4 | Pre-season content | Zero spans before the first classified race, accepted as a temporary limitation; curated pre-season participation needs its own future decision (D9) |
| 5 | Cancelled rounds | Excluded from continuity only through an accepted curated record; never inferred (D4) |
| 6 | Sprint-only appearances | Never create a `DriverSeasonEntry` (D3) |
| 7 | Classification-to-span integrity | A new closed relation in both directions: every row in exactly one span, every span supported by a row (D12) |

## Consequences

### What this delivers

- A single meaning for `season-participants`, with identity and participation
  owned by different components.
- A span model with one source, whose published spans and published results
  cannot disagree.
- An in-season open-span meaning that predicts nothing, and a split-span
  identity determined by each span's own start boundary, which stays stable
  when an earlier span is inserted.
- No new provider request class and no new schedule.

### What stays open

- **Provider captures.** The season drivers and constructors responses and
  the per-round race results needed to curate and verify this model are not
  preserved. Whether any of the extra 2026 driver identities raced, whether
  results carry a car number and how non-starters are represented are all
  unrecorded.
- **Identities and mappings.** The driver and constructor identities and
  mappings are incomplete: 29 of 31 Jolpica driver and 9 of 11 Jolpica
  constructor identifiers are unrecorded, and both registries are still
  `status: mock`.
- **Acknowledgements.** `antonelli` still blocks. OpenF1 `12`, `Cadillac` and
  `Racing Bulls` are unchanged.
- **Ports.** The Jolpica drivers and constructors identity normalization and
  the race-results port are not implemented.
- **Validation and fixes.** Assembly derivation and the new integrity
  relations are not implemented, nor is the driver-detail current-span fix.
- **Split-span publication.** The contract and client change that lets the
  season Drivers collection carry split spans is undecided (D12).
- **Provisional-source participation.** Whether a selected OpenF1 race
  classification may create participation is undecided, and must be settled
  before OpenF1 is unlocked (D3).
- **Split-span ID rule implementation.** The start-boundary ID rule is
  decided (D7) but not implemented.
- **Client "Full season" inference.** The Flutter client still renders
  null/null as "Full season". Removing that inference is a mandatory
  publication prerequisite (D12 item 3), and it is not implemented.
- **Cancelled rounds.** There is no curated cancelled-round record or schema.
- **A7** `hasResults` is not implemented.
- **Runtime.** Runtime wiring, G1 (live provider mode) and provider activation
  do not exist.
- **Quota.** Reconciliation of the weekly participants budget line is
  outstanding.

### Non-conforming development data

The mock `content/seasons/2026/driver-entries.mock.json` and the contract
fixtures derived from it predate this decision:

- They give a round-1 span (`2026-jack-doohan`) an explicit `startRound: 1`,
  where D6 gives `null`. With D6's `null`, the existing ID is already the one
  D7 gives.

Their single-span, mid-season entry `2026-franco-colapinto-10` with
`startRound: 10` already matches D7.

They are `NON-AUTHORITATIVE` and remain valid against the schema. This decision
does not change them. They are to be brought into line when the derivation is
implemented.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| A - season identity lists only | Contract-valid but participation-empty: no span can carry a `constructorId` |
| B - current active line-up | Structurally invalid: published earlier-round results require departed drivers in `drivers[]`. It also destroys span history and needs per-round evidence anyway |
| C - participants built from results, identity from results | Duplicates result requests. It needs a round set a port cannot own. It narrows the 31 identities without an accepted rule, and it has no identities before round 1 |
| D - qualifying as the entry list | A qualifying appearance without a race start would create a race span. 2026 qualifying structure is unrecorded, and there is no documented pre-weekend entry list |
| E - the participants port fetches every round's results | The strongest alternative. It keeps assembly unchanged, but it reads each classification twice at different times, so published spans can contradict published results. It also costs extra requests on every refresh and needs its own schedule |

## References

- `GridView_Domain_Model.md` §2, §3, §4.2, §6.7, §6.8, §9 (M6)
- `GridView_Local_Data.md` §2, §10.2, §10.3
- `GridView_Backend_Scheme.md` §9
- `GridView_Provider_Evaluation.md` §8.4, §8.5, §8.7 (M2, M9, M10), §11.2
- `GridView_Provider_Mapping_Guide.md` §5, §12
- `GridView_Implementation_Plan.md` §14.0.18
- [ADR 0022](0022-curated-provider-identifier-mappings.md) D2-D10, A6, A7, A9
- [ADR 0023](0023-multi-source-provider-coordination.md) D1, D3, D4, D8, D10,
  D11
