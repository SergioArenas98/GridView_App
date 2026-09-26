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
  [0024](0024-deep-normalized-contract-validation.md),
  [0025](0025-season-publication-authority-and-rollback-republication.md)

> **What "Accepted" means here.** This ADR records an **architecture
> decision only**. None of the mechanism it describes exists in code: there is
> no Jolpica drivers, constructors or race-results port, no participation
> derivation in season assembly, no new integrity relation and no
> driver-detail fix. No schema, contract, content, test, configuration or
> runtime path changes with it. No provider evidence was captured for it and
> no provider was contacted. `PROVIDER_MODE` still admits exactly `mock` and
> `none`. The decision stays dormant until each prerequisite in
> [What stays open](#what-stays-open) is separately implemented.

> **Implementation note 2026-09-24.** The identity half of D2, D10 and D11
> now exists as a dormant, fixture-tested Jolpica `season-participants`
> port (Implementation Plan §14.0.21). It makes the two D13 requests in
> sequence and returns the canonical drivers and constructors plus one
> `ConstructorSeasonEntry` per constructor, all of which **the port owns**.
> `driverEntries` is **always empty** there, because spans remain
> assembly-owned (D3-D7, D11), and the port assigns no driver to a
> constructor. Reporting both requests needed
> [ADR 0023 amendment A1](0023-multi-source-provider-coordination.md#amendment-a1---ordered-attempts-and-interrupted-executions).
> The port is not registered with any coordinator, is absent from every
> Worker bundle and has never contacted the provider. Participation-span
> derivation, the race-results port and every D12 publication prerequisite
> remain unimplemented. This decision itself is unchanged.

> **Implementation note 2026-09-26.** The race-classification half of D11
> now exists as a dormant, fixture-tested Jolpica race-results port
> ([ADR 0023 amendment A2](0023-multi-source-provider-coordination.md#amendment-a2---jolpica-race-result-normalization),
> Implementation Plan §14.0.22). It returns one normalized `RaceResult` per
> round with every row, DNS and retired rows included, and it produces **no**
> span, season entry or `hasResults` value. It is not registered with any
> coordinator, is absent from every Worker bundle and was not used to
> contact the provider. Span derivation in season assembly, the A7
> `hasResults` correction, D12 items 1-13 and the D14-D16 guards remain
> unimplemented. This decision itself is unchanged.

> **Implementation note 2026-09-26 (split participation).** D12 items 1 to 5
> are implemented and tested (Implementation Plan §14.0.23). The public
> `SeasonDriverSummary` gains the required `entryId`, `startRound` and
> `endRound`, and `GET /v1/seasons/{season}/drivers` publishes one row per
> `DriverSeasonEntry` (item 1). Driver detail selects the open span, else the
> latest effective start, on the server and in the client (item 2). The
> client renders null/null as "From season start" and never as "Full season"
> (item 3). `canonicalDriverSeasonEntryId` implements D7 and the closed
> `driver-entry-identity` relation enforces it (item 4). The closed
> `result-entry-span` and `driver-entry-support` relations prove
> classification-to-span and span-to-classification integrity (item 5). Items
> 6 to 13, span derivation in season assembly, A7 and D14 to D16 remain
> **unimplemented**. All four Jolpica ports stay dormant and unregistered, no
> provider was contacted, and nothing was deployed. This decision itself is
> unchanged.

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
   selections and there is no per-resource carry-over (G9 is open). D14 and
   D15 do not change this: they consult the authoritative snapshot only to
   refuse a publication that would lose classified coverage or a published
   participation fact, never to supply a row.
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

> **Evidence note 2026-09-26.** The private capture of the 2026 rounds 1-14
> race results (Provider Evaluation §8.11; hashes in
> [ADR 0023 A2.2](0023-multi-source-provider-coordination.md#a22---evidence))
> answers this. Jolpica lists non-starters as `Did not start` with
> `positionText "W"`: seven rows in rounds 1, 2 and 5. Each is a present row
> and therefore a participation fact, and the race-results port keeps every
> one (A2 C-6).

### D4 - Round accounting

Every calendar round is in exactly one of these states:

| State | Meaning | Effect |
|---|---|---|
| Selected classified round | A race classification for the round is selected and is `final` or `provisional` | Accounted. Each row is a participation observation |
| Explicitly cancelled round | Cancellation is established by an **accepted curated record** | Accounted, and skipped for continuity. No observation, no synthetic span |
| Future round | A calendar round after the **coverage horizon**: the later of the latest selected classified round in this run and the latest classified round in the authoritative snapshot (D14) | Not yet observed. Never closes an open span |
| Unaccounted round | A calendar round at or before the coverage horizon that is neither classified in this run nor curated as cancelled: its result is missing, unavailable or unknown | **Withholds** the participants candidate |
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
- "Future" is **never** determined only from the latest classified round
  available in the current run. A round the authoritative snapshot already
  publishes as classified is never future, and its absence from this run's
  selection withholds the candidate (D14).

> **Revised 2026-09-23, during review and before this ADR was merged.** An
> earlier draft defined a future round as one after the latest selected
> classified round **of the current run**. Review found that a run in which
> already published rounds were temporarily unavailable would then treat them
> as future and could publish truncated spans, or even an empty roster. The
> coverage horizon and D14 replaced that definition. The draft rule never
> reached a client and was never implemented.

### D5 - Span derivation

Spans are a pure function of the complete selected classification set,
**rebuilt from scratch on every run**. They are never patched field by field,
so a non-destructive provider correction, one that only adds participation
facts, is absorbed by rebuilding. No span, row or round is carried forward
from an earlier run. Rebuilding from scratch **does not authorize historical
truncation**: a rebuilt candidate that covers fewer classified rounds than the
authoritative snapshot is withheld (D14), and so is one that removes or
reassigns an already published participation fact (D15).

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
   That absence is an observation about the later round only. It is not the
   deletion of the driver's participation fact from an earlier round, and it
   does not trip the D15 guard, which compares each previously published
   round with the same round in the candidate.
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
  change that span's ID, because the span boundary itself changed. A
  correction that moves the start **earlier** only adds participation facts.
  One that moves it **later** removes an already published fact, so under D15
  it is withheld until a separately accepted correction mechanism exists.
- At most one span of a driver has a null `startRound` (only a span beginning
  at the season's first selected classified race round, D6), and two spans of
  one driver can never share a non-null `startRound` (D5 rule 6), so two
  spans **of the same driver** never share an ID.
- The rule is **not** globally injective across drivers. `GridViewId` allows a
  driver ID to end in a numeric segment, so the base entry of a driver
  `foo-7` and the round-7 entry of a driver `foo` both render as
  `{season}-foo-7`. The grammar alone therefore does not prevent collisions,
  and the OpenAPI description and example do not prove injectivity either.
- Every candidate season must validate its derived entry IDs across the
  **complete** `driverEntries` collection before publication. Any collision
  fails the complete candidate publication, and the previous valid snapshot
  remains live. Neither entry is silently dropped, merged or automatically
  renamed, and no alternative separator or encoding is applied.
- Resolving a real collision requires an explicit curator and contract
  decision before that dataset can publish. The current curated driver IDs do
  not exercise this case, so it is a fail-closed future risk, not a present
  dataset conflict.
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
>
> **Revised again 2026-09-23, during review and before this ADR was merged.**
> The start-boundary text first said that two derived spans "never share an
> ID". That holds only within one driver: review showed that the base ID of a
> driver whose ID ends in a numeric segment can equal a suffixed ID of another
> driver. The ID syntax is unchanged. The overstatement was replaced by the
> cross-collection uniqueness validation above and in D12.

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
- An empty pre-season Drivers collection may be published **only** while no
  authoritative snapshot of the season has yet published a classified round.
  Once one has, a run with no selected classified round is a coverage
  regression and is withheld (D14); it is never republished as pre-season.
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
10. **The classified-round coverage guard (D14).** Before publishing, the
    candidate's classified-round set must be checked to contain every
    classified round of the authoritative snapshot, and the whole candidate
    withheld otherwise. This needs a read of the authoritative snapshot, or of
    equivalent durable coverage metadata, that season assembly does not have
    today: `season-assembly.ts` reads nothing from an earlier publication. If
    the guard relies on persisted coverage metadata rather than the active
    release itself, it depends on the open **G9** persistence gap. Neither is
    implemented. This guard alone is not sufficient: item 12 is also
    required, and both must run as item 13 requires.
11. **Global season-entry ID uniqueness (D7).** A closed validation over the
    complete derived `driverEntries` collection must reject the whole
    candidate on any duplicate entry ID, including a cross-driver collision
    between a base and a suffixed ID. No entry is dropped, merged or renamed.
    Item 4 alone does not satisfy this: a deterministic per-entry rule is not
    a uniqueness proof.
12. **The participation-fact non-regression guard (D15).** Before publishing,
    every canonical participation fact
    `(season, round, canonicalDriverId, canonicalConstructorId)` of the
    authoritative snapshot must exist unchanged in the candidate, and the
    whole candidate is withheld otherwise. It needs the same read of the
    authoritative snapshot, or of equivalent durable participation metadata,
    as item 10, with the same possible **G9** dependency. Item 5 does not
    satisfy it, because item 5 validates only the rows selected in the
    current run. Not implemented.
13. **Atomic comparison and publication (D16).** Items 10 and 12 must compare
    against the same authoritative version that the candidate will replace,
    serialized with publication for the season through the ADR 0025
    publication authority or protected by an equivalent compare-and-swap on
    the authoritative version. A candidate whose comparison version is no
    longer authoritative at publication is stale and never publishes. Not
    implemented.

> **Implementation note 2026-09-26.** Items 1 to 5 are implemented
> (Implementation Plan §14.0.23):
>
> 1. `SeasonDriverSummary` carries `entryId`, `startRound` and `endRound`; the
>    generator emits one row per entry, drivers in first-entry order and each
>    driver's spans chronologically, and the client stores `entryId` verbatim.
> 2. `selectCurrentDriverEntry` (server) and `sortBySpanRelevance` (client)
>    pick the open span, else the latest effective start.
> 3. `participationFullSeason` and both `isFullSeason` getters are removed;
>    null/null reads "From season start" / "Desde el inicio de la temporada".
> 4. `canonicalDriverSeasonEntryId` and the `driver-entry-identity` relation.
> 5. `result-entry-span` (every selected classified race row lies in exactly
>    one span of its driver naming its constructor) and `driver-entry-support`
>    (every span is observed at its opening round, its `startRound` or the
>    first classified round when null, and at its closing round, its
>    `endRound` or the latest classified round when null; a non-null start at
>    the first classified round is refused because D8 spells it null).
>
> The collection-wide uniqueness check item 11 asks for is the existing
> `duplicate-identity` category `driver-season-entry-id`, now tested against a
> cross-driver D7 collision. Item 11 still stays open as a prerequisite,
> because no derived `driverEntries` collection exists yet for it to run on.
> Items 6 to 13 are unimplemented.

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

### D14 - Classified-round coverage never regresses

Added 2026-09-23, during review and before this ADR was merged. A candidate
publication can **never** reduce the classified-round coverage already present
in the currently authoritative season snapshot (the active release, ADR 0007).

- Any round already represented by a selected classified result in the
  authoritative snapshot remains accounted for in every later run. It is never
  reclassified as future (D4).
- Before publishing, the candidate's classified-round set must **contain every
  classified round** present in the authoritative snapshot.
- If a previously published classified round is unavailable, unresolved or
  absent from the new selection, the **entire** update is withheld and the
  previous snapshot remains live.
- Rebuilding spans from scratch (D5) does **not** authorize historical
  truncation.
- An empty pre-season Drivers collection may be published only when no
  authoritative snapshot has yet published a classified round (D9).
- Any intentional removal or rollback of previously published classified
  coverage requires a separate accepted decision or a curated recovery
  operation. It never happens implicitly because a provider response is
  temporarily incomplete.

**Previous state is a guard, not an input.** D5 still derives spans only from
the current run's selected rows, and no row, span or round is carried forward
from an earlier run. The authoritative snapshot, or equivalent durable coverage
metadata, is consulted only to compare classified-round sets, and under D15
participation facts, and refuse a regressive publication. It never contributes
a row or a span to the candidate.

The guard requires access to that snapshot or metadata, which season assembly
does not have today. It is a D12 publication prerequisite (item 10), and where
it depends on persisted coverage metadata it depends on the open G9 gap. It is
not implemented. It must execute atomically with publication (D16).

> **Complemented 2026-09-23, during review and before this ADR was merged.**
> Review found that round-level containment is necessary but not sufficient:
> a still-`final` but truncated classification keeps its round present, so
> this guard passes while D5 rebuilds from the reduced rows and closes or
> drops a published driver's span. D15 adds a row-level guard, and D16
> requires both guards to be atomic with publication. The round-level guard
> above is unchanged and remains required. The earlier wording of the
> paragraph above, which limited the consultation to classified-round sets,
> is superseded by the version shown.

### D15 - Published participation facts never regress

Added 2026-09-23, during review and before this ADR was merged. Non-regression
applies to the canonical participation facts **within** previously published
rounds, not only to the set of covered rounds.

A **canonical participation fact** is the tuple
`(season, round, canonicalDriverId, canonicalConstructorId)`. Each selected
classified race-result row (D3) contributes exactly one fact.

- Before publication, the **authoritative fact set** is derived from the
  currently authoritative snapshot, and the **candidate fact set** from the
  newly selected classified results.
- Every fact in the authoritative set must also exist, **unchanged**, in the
  candidate set.
- A candidate **may add** new participation facts.
- A candidate **may not automatically remove** a previously published driver
  from a round.
- A candidate **may not automatically replace** that driver's constructor for
  a previously published round. The changed constructor is a new fact while
  the old fact disappears, so the candidate is withheld.
- The comparison covers only the facts used to derive season spans. It does
  **not** freeze unrelated race-result fields such as finishing position,
  status, points or ordering.
- If any authoritative fact is missing or replaced, the **complete** candidate
  update is rejected and the previous snapshot stays live.
- The missing row is **never** copied into the rebuilt candidate. The previous
  snapshot is a publication guard, not an input or a row-level carry-over
  source.
- Rebuilding spans from scratch (D5) never authorizes the deletion or
  reassignment of an already published participation fact.
- A provider response alone cannot authorize a destructive historical
  correction.
- A genuine removal, constructor reassignment or other destructive correction
  requires a separately accepted, reviewed correction mechanism. That
  mechanism is **not** defined or implemented by this ADR. Until it exists,
  ambiguous destructive corrections fail closed.

**Absence in a later round is not deletion.** The guard compares each
previously published round with **the same round** in the candidate. A later
classified round in which a driver is absent still closes that driver's span
normally (D5 rule 4); the earlier round's fact is still present in the
candidate, so nothing regresses.

D14 and D15 are both required. D14 alone passes a truncated round that stays
present. D15 does not replace D14, because the coverage horizon (D4) and the
pre-season rule (D9) are defined over classified rounds, not facts, and D14 is
what keeps a previously published round accounted for. The guard needs the
same read of the authoritative snapshot, or of equivalent durable
participation metadata, as D14, with the same possible G9 dependency. It is a
D12 publication prerequisite (item 12) and is not implemented.

> **Superseded wording, 2026-09-23, during review and before this ADR was
> merged.** Adding D15 replaced three earlier statements. D5 said that "a
> provider correction is absorbed by rebuilding"; only a non-destructive
> correction is. D5 and Context item 5 named classified coverage as the only
> thing a rebuilt candidate could not lose; published participation facts are
> now protected too. D14 limited the consultation of previous state to
> classified-round sets; it now also covers participation facts. None of the
> earlier wording reached a client or was implemented.

### D16 - Comparison and publication are atomic

Added 2026-09-23, during review and before this ADR was merged. The D14
round-coverage check and the D15 participation-fact check must execute against
**the same authoritative version** that the candidate will replace.

- The comparison with the authoritative snapshot and the publication must be
  serialized for the same season through the accepted
  [ADR 0025](0025-season-publication-authority-and-rollback-republication.md)
  publication authority, or protected by an equivalent compare-and-swap on the
  authoritative version.
- If the authoritative version changes after the comparison and before
  publication, the candidate is **stale**.
- A stale candidate is rejected, or rebuilt and checked again. It **never**
  publishes on the strength of the earlier comparison.
- Two overlapping runs must not both pass against the same old snapshot and
  then let the narrower candidate overwrite the wider one.

This is an implementation prerequisite (D12 item 13), **not** a claim that
this serialization exists today. Reading the active release inside season
assembly, outside the publication authority's commit, would leave a
time-of-check to time-of-use gap and does not satisfy it.

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

  > **Note 2026-09-23.** A later reviewed change, the 2026 constructor
  > dataset (Provider Evaluation §8.9, Implementation Plan §14.0.19),
  > recorded the season constructor list captured that day and curated and
  > mapped all 11 Jolpica constructor identifiers. `audi` continues `sauber`, and `rb` maps
  > to `racing-bulls`. The OpenF1 `Cadillac` and `Racing Bulls`
  > acknowledgements stay unmapped with the reason
  > `no-approved-provider-mapping`. **Driver identities and mappings remain
  > incomplete**, no drivers, constructors or participants port exists, and
  > every other item in this list stays open.

  > **Note 2026-09-23 (drivers).** A further reviewed change, the 2026 driver
  > dataset (Provider Evaluation §8.10, Implementation Plan §14.0.20),
  > recorded the season driver list captured that day and curated and mapped
  > all 32 Jolpica driver identifiers, including the nine name-only rows, as
  > identity-only registry rows. `antonelli` maps to `andrea-kimi-antonelli`
  > and no longer blocks. OpenF1 `12` stays acknowledged and unmapped, now with
  > the reason `no-approved-provider-mapping`. Jolpica participant identity
  > coverage for 2026 is therefore complete, and both registries keep
  > `status: mock`. **No drivers, constructors or participants port exists**,
  > no span is derived, the per-round race results are still not preserved,
  > and every other item in this list stays open.

  > **Note 2026-09-26 (race results).** The race results of 2026 rounds 1-14
  > were captured on 2026-09-24 under separate authorisation and are
  > preserved privately, not committed (Provider Evaluation §8.11). They hold
  > 308 rows naming 23 drivers and 11 constructors, and every one maps. Seven
  > rows are non-starters (D3), and results carry a car number that no
  > contract field uses (D8). The nine identity-only drivers without a race
  > did not race in rounds 1-14.

- **Ports.** The Jolpica drivers and constructors identity normalization and
  the race-results port are not implemented.

  > **Note 2026-09-24.** The drivers and constructors identity normalization
  > now exists as a dormant, unregistered `season-participants` port
  > (Implementation Plan §14.0.21). The race-results port and everything
  > else in this list remain open.

  > **Note 2026-09-26.** The race-results port now exists as a dormant,
  > unregistered port (Implementation Plan §14.0.22). Everything else in this
  > list remains open.

- **Validation and fixes.** Assembly derivation and the new integrity
  relations are not implemented, nor is the driver-detail current-span fix.

  > **Note 2026-09-26.** The integrity relations and the driver-detail fix
  > are implemented (§14.0.23). Assembly derivation is still not.
- **Split-span publication.** The contract and client change that lets the
  season Drivers collection carry split spans is undecided (D12).

  > **Note 2026-09-26.** Real evidence now triggers D12 item 1. Applying D5
  > privately to the rounds 1-14 rows gives 24 spans for 23 drivers:
  > `liam-lawson` drove for `racing-bulls` in rounds 1-11 and for `red-bull`
  > from round 12, when `yuki-tsunoda` joined `racing-bulls` and
  > `isack-hadjar` stopped appearing. Those spans are evidence only, not
  > published or committed content, and any candidate carrying the two
  > `liam-lawson` spans stays unpublishable until item 1 is implemented.

  > **Note 2026-09-26.** Item 1 is implemented: the season Drivers
  > collection carries one row per span (§14.0.23). A candidate with split
  > spans still cannot publish through coordination, because derivation,
  > A7 and items 6 to 13 are open.
- **Provisional-source participation.** Whether a selected OpenF1 race
  classification may create participation is undecided, and must be settled
  before OpenF1 is unlocked (D3).
- **Split-span ID rule implementation.** The start-boundary ID rule is
  decided (D7) but not implemented.

  > **Note 2026-09-26.** Implemented and enforced by `driver-entry-identity`
  > (§14.0.23).
- **Global entry-ID uniqueness.** The rule is not injective across drivers.
  The cross-collection uniqueness validation (D12 item 11) is not
  implemented, and a real collision would need a curator and contract
  decision.

  > **Note 2026-09-26.** The existing `duplicate-identity` check covers every
  > `driverEntries` id and is now tested against a cross-driver D7
  > collision (§14.0.23). Item 11 stays open until it runs over a derived
  > collection.
- **Classified-coverage non-regression.** The D14 guard and the read of the
  authoritative snapshot or durable coverage metadata it needs are not
  implemented (D12 item 10), and may depend on G9.
- **Participation-fact non-regression.** The D15 row-level guard is not
  implemented (D12 item 12). No correction mechanism for a genuine removal or
  constructor reassignment is defined, so such corrections fail closed.
- **Atomic comparison and publication.** Binding the D14 and D15 comparisons
  to the authoritative version the candidate replaces, through the ADR 0025
  publication authority or an equivalent compare-and-swap, is not implemented
  (D16, D12 item 13).
- **Client "Full season" inference.** The Flutter client still renders
  null/null as "Full season". Removing that inference is a mandatory
  publication prerequisite (D12 item 3), and it is not implemented.

  > **Note 2026-09-26.** Implemented: null/null reads "From season start"
  > in every supported locale (§14.0.23).
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

> **Note 2026-09-26.** The `2026-jack-doohan` span now has `startRound: null`
> (was `1`) in the mock content and in the two contract fixtures derived from
> it, so its existing ID is the D7 one (§14.0.23). The mock line-up remains
> authored rather than derived, so it is not participation-consistent with
> the mock classification; it is published only through the mock path, which
> does not run the coordinated integrity gate.

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
- [ADR 0025](0025-season-publication-authority-and-rollback-republication.md)
  (the per-season publication authority D16 relies on)
