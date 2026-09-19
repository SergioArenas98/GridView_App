# 0022 - Curated provider-identifier mapping registry

- Status: Accepted
- Date: 2026-08-25
- Phase: 9B-3
- Amended: 2026-09-16 —
  [Grand Prix event identity](#amendment-2026-09-16-grand-prix-event-identity)
  (decision only; nothing implemented)
- Closes: gap **G8** (Provider Evaluation §14.4 **G-e**, Backend Scheme
  §8.1) — **the mechanism only.** The mapping **dataset** is deliberately
  limited to identifiers already recorded in Provider Evaluation §8; live
  provider coverage is incomplete and is tracked separately as **G-l**.
- Related: [0019](0019-formula-one-provider-legal-gate.md),
  [0020](0020-provider-source-observation-and-reconciliation.md),
  [0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)

## Context

GridView issues its own stable public identifiers, and
[GridView_Backend_Scheme.md](../technical/GridView_Backend_Scheme.md) §8.1
already requires that a mapping file resolve provider IDs to GridView IDs, that
provider identifiers stay internal, and that an **unknown provider entity fail
synchronization validation** instead of silently creating an unstable ID.

The Phase 9A feasibility check turned that requirement from a principle into a
measured necessity. Comparing OpenF1 and Jolpica on the same event
([GridView_Provider_Evaluation.md](../technical/GridView_Provider_Evaluation.md)
§8.5), race results, driver championship and constructor championship agreed
exactly — but joining **constructors by name matched only 7 of 11**:

| OpenF1 `team_name` | Jolpica `Constructor.name` |
| ------------------ | -------------------------- |
| Alpine             | Alpine F1 Team             |
| Cadillac           | Cadillac F1 Team           |
| Racing Bulls       | RB F1 Team                 |
| Red Bull Racing    | Red Bull                   |

§8.7 records the rest of the identity problem: OpenF1 publishes **no stable
driver or team identifier** (M1, M2), so a driver join must go through
`driver_number`, and a team join through a display string. Jolpica's slugs
(`driverId`, `constructorId`, `circuitId`) are the only durable anchors either
source offers.

No adapter exists yet, so nothing consumed a mapping. But G8 blocked G4: an
adapter cannot be written without deciding how identity crosses the boundary.

## Decision

Add a **curated, version-controlled, season-qualified provider-identifier
mapping registry**, validated both structurally and semantically, exposed
through an immutable typed resolver that fails closed.

### D1 - A curated registry is mandatory, not an optimization

Four of eleven constructors are named differently by the two sources. There is
no automatic rule that resolves that correctly, so the mapping has to be
curated data reviewed by a person. This is a requirement, not a convenience.

### D2 - GridView owns stable identity

Public IDs are GridView's, are lowercase and URL-safe, and never change after a
spelling or branding update. Provider identifiers are internal. A mapping
**points at an identity that already exists**; it never creates one, and no
provider ID is ever converted into a new GridView ID.

The precedence recorded in Backend Scheme §9 is preserved: driver, team and
circuit identity come from the curated GridView registry, with provider mapping
as the secondary source.

### D3 - Every mapping is season-qualified, Jolpica included

For OpenF1 this is forced. `driver_number` is reassigned between seasons and
the champion's `1` is a per-season choice (§8.7 M2), so a driver number can
never be a cross-season key. In the checked-in 2026 evidence, `1` is Norris.

Jolpica slugs are usually stable across seasons, and scoping them per season is
still the right call: it stops an old participation or identity assumption
being carried silently into a new season, it matches the existing
`content/seasons/<year>/` layout, and it means one rule covers both sources
rather than two rules that differ per source. The cost is one reviewed file per
season, which is the cadence curated content already follows.

### D4 - Exact typed matching, and nothing else

Resolution is exact equality on a five-part key: season, source, entity kind,
exact provider field, exact provider value — with the **value's type as part of
the key**, so integer `1` and string `"1"` can never collide and no JavaScript
object-key coercion applies.

Explicitly forbidden: case folding, trimming before lookup, punctuation
removal, Unicode transliteration, whitespace collapsing, slug generation,
substring/prefix/suffix matching, display-name fallback, Levenshtein or fuzzy
matching, numeric/string coercion, falling back from one provider field to
another, and automatic alias creation.

### D5 - Why automatic string matching and slug minting are rejected

A fuzzy matcher would not have solved §8.5; it would have produced confident
wrong answers. `Red Bull Racing` and `Red Bull` are similar strings naming the
**same** team, while `Racing Bulls` and `Red Bull Racing` are similar strings
naming **different** teams. Any similarity threshold that merges the first pair
is at risk of merging the second, and the failure is silent.

Minting a GridView ID from a provider slug is worse: it manufactures a public
identifier whose stability depends on the provider's branding, which
contradicts Backend Scheme §8.1 directly.

### D6 - Version-controlled content, not KV, Durable Objects, a database or an admin endpoint

The registry is curated data with the same lifecycle as the driver,
constructor and circuit registries, so it lives beside them under `content/`
and is validated by the same command.

Rejected alternatives:

| Alternative             | Why rejected                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers KV              | Identity would become mutable runtime state with eventual consistency ([ADR 0010](0010-workers-kv-consistency-limitation.md)). Two isolates could disagree about who a driver is.            |
| Durable Object          | Correct for the rate limiter's _mutable_ reservation state ([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)); wrong here. This data never changes at runtime. |
| Database                | No database exists at the edge, and adding one for immutable content is unjustified.                                                                                                         |
| Admin mutation endpoint | Identity decisions need review, evidence and history. A live endpoint gives none of those and creates a way to repoint a public ID without a commit.                                         |

Because the registry is immutable content with no mutator, it is safe to cache
at module scope — the opposite of per-request accounting and quota state.

### D7 - Validation is both structural and semantic

JSON Schema 2020-12 owns one record's shape: a closed discriminated union of
the six valid (source, entity, field, value type) combinations,
`additionalProperties: false` at every boundary, bounded strings, no empty
value, no leading or trailing whitespace, no control characters, safe-integer
bounds, and the public-ID grammar on every target.

JSON Schema **cannot** express composite-key uniqueness, existence of a target
in another file, or coverage of the approved evidence. Those live in
`scripts/lib/provider-mapping-rules.mjs` and run inside the existing
`npm run validate:content`, so there is still exactly one content-validation
command.

A second curated file, `provider-evidence.development.json`, records every
provider identity the repository already has evidence for. Validation fails
unless each one is either mapped or explicitly acknowledged as unmapped with a
**closed-enum** blocking reason (free prose goes in a separate `detail` field,
so an acknowledgement cannot become an arbitrary coverage excuse).

**An acknowledgement is a temporary blocker, never a mapping.** It records
"observed, but no canonical GridView target exists". It never means "coverage
accepted, so synchronization may continue": the runtime is built from the
mapping file alone, has no notion of an acknowledgement, still answers
`unmapped`, and the affected resource still fails closed. An acknowledgement
that survives after its mapping is added is a validation error, so it cannot
harden into a second, weaker way of satisfying coverage.

The narrow, honest guarantee is therefore: **a newly approved identity fails
validation until it is either mapped or explicitly acknowledged** — not "until
it is mapped". Both are reviewed decisions; only one of them makes the identity
resolvable. And a
mapping cannot be invented for a value the repository never recorded.

### D8 - One invalid record blocks the whole resolver

Construction is all-or-nothing. If any record is malformed, ambiguous,
duplicated or dangling, no index is exposed: the registry enters an invalid
state whose every lookup answers `registry-invalid`. There is no valid subset
and no last-entry-wins overwrite.

A partially loaded identity table is precisely how a wrong identity reaches
publication — it would resolve most entities correctly and quietly misresolve
the ones the broken records were meant to cover. Failing the whole registry
turns that into a loud, immediate, reviewable failure.

### D9 - Several explicit aliases may target one identity

Multiple provider keys resolving to one GridView ID is required by §8.5 and is
allowed — **but only when each alias is its own curated record**. There is no
alias rule, pattern or wildcard.

`Mercedes` (OpenF1 `team_name`) and `mercedes` (Jolpica `constructorId`) are
two records targeting `mercedes`. Jolpica `norris` and OpenF1 `driver_number`
`1` are two records targeting `lando-norris`. The Jolpica _display_ names from
§8.5 — `Alpine F1 Team`, `RB F1 Team`, `Red Bull` — are deliberately not keys
at all, because Jolpica is keyed on its stable slug precisely because its
rendered name disagrees with OpenF1.

### D10 - Provider identifiers remain internal

A provider identifier may appear in the curated mapping and evidence content,
in the bounded internal `providerMappingValue` diagnostic log field, and in
narrowly scoped internal tests. It must never reach a public v1 response, the
OpenAPI schema, a public contract fixture, a published snapshot, a Flutter DTO,
Drift, a client-visible cache key, a request ID or a public error message.

An unmapped identity produces one bounded structured event — source, season,
entity kind, provider field, closed failure reason, and the bounded exact value
— and stops the resource. It never becomes a guessed ID, an empty result or a
row quietly dropped from an otherwise accepted resource.

## Consequences

### What this delivers

- The identity decision an adapter needs is made, recorded and enforced.
- Unknown provider entities fail synchronization validation, as §8.1 requires.
- The four recorded constructor-name disagreements are regression-pinned.
  Two of them (`Alpine`, `Red Bull Racing`) have a resolvable **OpenF1
  `team_name`** mapping. That is one half of each pair: the other half is a
  Jolpica `Constructor.name`, which is a _display name_ and never a lookup key,
  because Jolpica is keyed on its stable `constructorId` slug. Neither pair is
  reconciled end to end — reconciliation is G4 and G9, which remain open.

### What stays dormant

**No adapter consumes this registry.** `PROVIDER_MODE` still admits exactly
`mock` and `none`, staging is `mock`, production is `none`, and the mock
provider emits GridView-owned identities so it neither needs nor may have a
mapping — `mock` is not a member of the mapping-source union at all. A test
asserts that no runtime module outside `src/providers/mappings/` imports it.

### Coverage is bounded by recorded evidence

Only identities already recorded in this repository are seeded. Nothing was
fetched, scraped, inferred from a display name or recalled from memory. Two of
the four §8.5 constructors — `Cadillac` and `Racing Bulls` — have **no
canonical GridView constructor identity** (the curated registry holds six
constructors against the eleven on the recorded grid), so they are left
unmapped with a written reason rather than having an ID minted for them. No
OpenF1 `circuit_key` value is recorded anywhere, so no OpenF1 circuit mapping
could be seeded.

This does **not** establish live-provider coverage.

### Still open

G4, G5 and G9 remain open. G1 and G3 remain open. Both provider adapters and
the reconciliation coordinator remain unimplemented. OpenF1 remains fail-closed
pending a justified maximum-session-duration bound ([ADR 0020](0020-provider-source-observation-and-reconciliation.md) §5).
Nothing here authorizes production synchronization or public release, no
provider was contacted, and no licensing conclusion changes.

## Scope note

Meeting and session mappings are deliberately **not** added. No authoritative
contract requires them in this phase, and neither has a curated GridView
registry to point at. `meeting_key` and `session_key` are stable OpenF1
integers and can be added later under the same model if a contract requires it.

> **Amended 2026-09-16.** Grand Prix **event** identity is no longer deferred:
> the [amendment below](#amendment-2026-09-16-grand-prix-event-identity)
> decides a curated event registry and a Jolpica event locator. OpenF1
> `meeting_key` and `session_key` mappings remain excluded, exactly as stated
> above.

---

## Amendment 2026-09-16: Grand Prix event identity

- Status: Accepted — **decision only**
- Date: 2026-09-16
- Phase: 9B, recorded before the first Jolpica calendar adapter slice
- Amends: this ADR's [scope note](#scope-note), and — for coordinated season
  assembly only — the rule in
  [ADR 0023](0023-multi-source-provider-coordination.md) D11 that `hasResults` is
  never rewritten (A7)
- Implements: **nothing.** No registry, TypeScript type, JSON Schema, content
  validator, mapping record, fixture, adapter, test, configuration or CI file
  changes with it.

### Amendment context

On 2026-09-16, at `master` `88f3b18`, the first dormant Jolpica adapter slice —
the `season-calendar` resource — was stopped before any edit. The repository
had no approved way to turn a Jolpica race object into a canonical GridView
event:

- `GrandPrix.id` must be `{season}-{eventSlug}`
  ([Domain Model](../technical/GridView_Domain_Model.md) §4.2, §6.5). Every
  `Session.id` and race-result `id` is derived from it (`contract/identity.ts`),
  and the `event-identity`, `session-event` and `result-identity` preflight
  relations enforce all three by exact equality
  ([ADR 0024](0024-deep-normalized-contract-validation.md)).
- A Jolpica race object carries `season`, `round`, `raceName`, a `Circuit` with
  its `circuitId`, `date`, an optional UTC `time` and optional session blocks
  ([Provider Evaluation](../technical/GridView_Provider_Evaluation.md) §8.4).
  **It carries no event identifier.**
- `content/registries/` holds drivers, constructors and circuits only. There is
  no curated event registry, and no `eventSlug` appears anywhere in `content/`.
- `providerMappingEntities` is `driver | constructor | circuit`.
- Deriving a slug from `raceName` is slug minting, which D2, D4, D5,
  [Mapping Guide](../operations/GridView_Provider_Mapping_Guide.md) §11 and
  Domain Model §4.4 all forbid.

Each Jolpica field is a flawed key on its own. `raceName` is a sponsor-mutable
display string, `round` shifts when a calendar changes, and one `circuitId` can
host two events in the same season.

The same slice also needed four calendar semantics that no document defined:
the lifecycle status of an event and its sessions, who owns `hasResults`, what
happens when a date or time is missing, and how an adapter's dormancy is proven
once its files carry an honest name.

**No existing accepted decision resolves event identity differently.** This
ADR's scope note deferred it. Domain Model §4.1's normalization rules describe
how a **curator** forms a slug when one is first created; they never allowed an
adapter to create one.

### A1 - A curated GridView event registry owns `eventSlug`

GridView adds a **curated, version-controlled event registry** beside the
driver, constructor and circuit registries, with the same lifecycle (D6).

- A **curator** creates an `eventSlug`, following the public-ID grammar and
  Domain Model §4.1, in a reviewed repository change — exactly like adding a
  driver.
- **An accepted `eventSlug` is immutable.** It is never renamed, repointed at
  another event or reused. Later spelling, branding or sponsor changes never
  alter it.
- `GrandPrix.id` remains `{season}-{eventSlug}`, built by
  `canonicalGrandPrixId`. The public identity, the OpenAPI contract and every
  existing preflight relation are unchanged.
- **No provider adapter may derive, normalize or mint an `eventSlug`.** An
  adapter only _resolves_ one, through a curated mapping (A2–A4). D2 applies
  unchanged: a mapping points at an identity that already exists.
- **Provider display names, rounds and circuit identifiers are never canonical
  GridView identities**, whatever they happen to look like.

An `eventSlug` is season-independent (Domain Model §6.5): the same slug recurs
every season. The season qualifier lives in `GrandPrix.id` and in the
season-qualified mapping (D3).

### A2 - The Jolpica event locator is a complete, season-scoped tuple

Jolpica provides no stable event identifier. GridView therefore defines a
season-scoped, explicitly curated **provider locator** — the complete tuple:

| Component   | Jolpica source      |
| ----------- | ------------------- |
| `season`    | `season`            |
| `round`     | `round`             |
| `raceName`  | `raceName`, exact   |
| `circuitId` | `Circuit.circuitId` |

**The tuple is a provider locator, not a canonical identity.** It is internal
(D10), it is never published, it never builds any GridView ID, and it is
never treated as unique outside its source and season.

Matching rules:

- **Every component must agree exactly.** A tuple that differs in any
  component is a different locator.
- **Matching on `raceName`, `round` or `circuitId` alone — or on any proper
  subset of the tuple — is forbidden.**
- **No fuzzy matching, slugification, case folding or punctuation
  normalization**, and none of the other transformations D4 forbids (trimming,
  transliteration, whitespace collapsing, numeric/string coercion, cross-field
  fallback) applies to any component.
- **An absent, ambiguous or conflicting locator fails closed as
  _mapping-unresolved_.** In the existing vocabulary, the adapter returns the
  `mapping-failure` outcome and raises the bounded
  `provider_mapping_unresolved` signal with its closed reason (`unmapped`,
  `registry-invalid`, `ambiguous`, `target-missing` or `invalid-key`). The
  `season-calendar` contribution then yields no candidate. An unresolved event
  is never dropped from an otherwise accepted calendar (D10).

Using a display string such as `raceName` in the public `name` field is an
ordinary normalization question outside this amendment. What D10 forbids is
publishing the locator, or any provider identifier, as identity.

### A3 - Calendar changes, aliases and uniqueness

- **A calendar change, sponsor rename, round shift or circuit change requires a
  reviewed mapping update with evidence.** Until that update lands, the new
  tuple matches no record and the calendar fails closed. That cost is
  deliberate: it is the loud failure that replaces a silent misidentification.
- **Several historical locator aliases may map to the same immutable
  `eventSlug`**, each as its own curated record (D9). An alias never widens
  matching: each record still matches only its own complete tuple.
- **A single provider observation must never match more than one event.** A
  complete tuple is exactly one key, and one key curated with two targets fails
  the whole registry (D8). If two _different_ observations in one calendar
  resolve to the same `eventSlug`, the season candidate carries one
  `GrandPrix.id` twice and the existing `duplicate-identity` relation withholds
  it. Nothing resolves that by picking one.
- **Two canonical events may use the same circuit in one season.** A
  `circuitId` therefore never implies an event, and an event mapping never
  implies a circuit: the event's own `circuitId` field is still resolved,
  independently, through the existing circuit mapping.
- **A locator is never globally unique.** The same tuple in another season is a
  different key (D3). A locator from another source is never an alias of it.

### A4 - Evidence and review are at least as strict as existing mappings

- Every event mapping record carries mandatory `evidence` that points at
  something already in this repository (Mapping Guide §6). All four components
  must be recorded as observed. None may be recalled from memory, inferred from
  a display name or completed by hand.
- Every recorded locator joins the season's evidence corpus. Validation fails
  unless it is either mapped or acknowledged with a closed-enum reason, and an
  acknowledgement remains a blocker, never a mapping (D7).
- The `eventSlug` a mapping targets is created in the same reviewed change or
  an earlier one, never inferred at review time (Mapping Guide §5 order).
- A locator correction is a reviewed commit stating what changed and on what
  evidence (Mapping Guide §8). There is no runtime repair path, admin endpoint,
  KV, Durable Object or database store for it.
- Gathering new evidence from Jolpica is a separately authorized activity, and
  this amendment authorizes none. **No complete locator is recorded in the
  repository today**: Provider Evaluation §8.2 records season 2026 / round 11
  and §8.4 records `hungaroring`, but no exact `raceName` is recorded as an
  observed provider value. No event mapping could be seeded without new
  evidence.

### A5 - Required implementation shape (not implemented)

The future implementation should:

1. **Extend the mapping entity union with `event`**, and the closed
   source/entity/field combinations with exactly one new member: Jolpica, event,
   the A2 locator. No OpenF1 event combination is added.
2. **Represent the locator as a closed, typed composite value** that fills the
   provider-value position of the existing key. Its key encoding must be
   injective by construction (structured, or length-prefixed like the
   preflight's composite identities), never a separator-joined string. Each
   component's type is part of the key (D4). `raceName` and `circuitId` are
   exact strings. `season` and `round` are integers; if Jolpica's recorded wire
   form differs, the implementation defines one strict parse, and anything it
   refuses is `invalid-key` rather than a lenient coercion.
3. **Extend `CanonicalRegistries` with events**, built from the curated event
   registry, so `target-missing` covers event targets too.
4. **Add JSON Schema and `validate:content` coverage**: a schema for the event
   registry and for the new mapping and evidence members, closed with
   `additionalProperties: false`, plus semantic rules for complete-tuple key
   uniqueness, target existence in the event registry and evidence coverage.
5. **Keep D8 and D10 unchanged**: all-or-nothing construction, and one bounded
   signal whose diagnostic representation of a tuple stays within D10's
   bounds.

### A6 - Calendar event and session status is `unknown`

- **Jolpica calendar data supplies no trustworthy lifecycle status.** The
  Jolpica calendar adapter emits `unknown` for every `GrandPrix.status` and
  every `Session.status`.
- **It must not infer completion from the current clock**, nor from dates or
  elapsed time.
- **A stronger status may only come from a separately selected resource or a
  future event-aware state mechanism.** This amendment implements neither G5
  nor G9.

Verified consequences at `88f3b18`:

- `unknown` is a valid enum member at the coordination boundary (ADR 0024).
- `requiresRaceClassification('unknown')` is `false`
  (`season-assembly.ts`), so for a calendar sourced this way the
  `missing-round-classification` gap can never fire. A completed race whose
  classification is missing publishes with `hasResults: false` instead of
  withholding the season. That fails towards not fabricating, but it is a
  **weaker completeness guarantee** than a source that supplies `completed`
  receives, and it stays weaker until a stronger status exists.
- The client's relevant-event rules are date-based
  (`lib/features/shared/domain/relevant_event.dart`) and tolerate `unknown`,
  and status presentation renders no label for it
  (`lib/features/shared/presentation/domain_status.dart`).

### A7 - `hasResults` is owned by season assembly

- **A calendar contribution must not infer result availability.** Its
  provisional `hasResults` value is `false`, and that value is evidence in
  neither direction.
- **The complete-season assembler owns the final value.**
- **It may be `true` only when a valid race-results resource for the same
  canonical event was selected.** Calendar data, elapsed time and provider
  status codes are insufficient evidence.

**Verified against the season-integrity checks at `88f3b18`:**

| Check                  | Current behaviour                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assembleSeasonSource` | Copies each calendar event as supplied, except that a selected `event-schedule` replaces its `sessions`. `hasResults` is taken verbatim from the calendar contribution.                 |
| Classified rounds      | Assembly admits `sessionType: 'race'` classifications only. A round counts as classified only when its selected classification carries `final` or `provisional` (`isClassifiedResult`). |
| `event-has-results`    | `hasResults` must equal, exactly, whether that round is classified. Both mismatch directions withhold the whole candidate.                                                              |
| `result-event`         | Each result's `grandPrixId` must name the calendar event at its round, so the round join _is_ the canonical-event join whenever the preflight passes.                                   |
| ADR 0023 D11           | "`hasResults` is never rewritten."                                                                                                                                                      |

**Without an adjustment the rule is safe but not publishable.** A provisional
`false` passes only for rounds with no classified race result. The first round
with a selected `final` or `provisional` race classification fails
`event-has-results` and withholds the whole season, preserving last-known-good.

**Required future implementation adjustment** (not made here; no check changes
in this amendment):

1. Before the preflight, assembly sets each event's `hasResults` to exactly
   whether its round is in the classified-round set assembly already computes.
   A selected document that is `unavailable` or `unknown` yields `false`. That
   is the precise form of the rule above: the race-results resource must be
   selected **and** classified. Without the second half, `event-has-results`
   would reject the season.
2. `event-has-results` and `result-event` stay unchanged. The first becomes an
   invariant that holds by construction and still catches an assembly defect.
   No relation is added or removed.
3. Assembly tests gain derivation cases — a provisional `false` with a
   classified race result becomes `true`; with an `unavailable` result it stays
   `false`; a non-race classification never makes it `true` — while the
   relation tests in `season-identity-integrity.test.ts` remain valid as they
   are.
4. **ADR 0023's statements that `hasResults` "is never rewritten" and that "no
   flag is rewritten" to repair a disagreement are amended for coordinated
   season assembly.** The flag is **derived** by assembly from selected
   classifications; it is not **repaired**. No classification is fabricated,
   discarded or invented to justify `true`.

### A8 - Missing dates and times are never manufactured

- **No midnight, end-of-day or other timestamp is manufactured**, and fetch time
  is never substituted.
- **An entirely absent optional session block remains absent**: no session is
  emitted for it.
- **A session block that is present but cannot produce a complete RFC 3339
  instant fails the calendar resource as `invalid-payload`.**
- **A race that lacks the `date` or `time` needed for the race session the
  adapter emits for every event, with its start instant, fails the complete
  calendar resource**, also as `invalid-payload`.
- **The end-of-day fallback in Provider Evaluation §10.4** (`date` at
  `23:59:59` UTC) is a future reconciliation scheduling anchor. It does not
  alter public session timestamps, and the adapter must not reuse it.

**Precision about the contract.** The normalized contract types
`Session.startTime` as nullable (`contract/types.ts`,
`contract/normalized/entities.ts`), so ADR 0024's validator would accept `null`.
Failing the resource is therefore **an adapter normalization rule this
amendment adopts, stricter than the contract**, not a contract requirement: a
session Jolpica did deliver is never published with a silently absent start.
`invalid-payload` is the right existing reason because the response was read and
could not be normalized under these rules. It stays attempted, is counted once
and is never selected (ADR 0023, ADR 0024).

A calendar in which any present session lacks a usable instant therefore
publishes no new calendar, and last-known-good stays published. Provider
Evaluation §8.4 records a UTC `time` on the 2026 race objects. It does not
record whether every 2026 session block carries one.

### A9 - Dormancy is proven by composition, not by file names

`provider-neutrality.test.ts` asserts that no file name under `src/providers/`
contains `jolpica`. That was a sound proxy while no adapter could exist, but it
is **not a sustainable architectural test**: it lets a real adapter pass by
choosing a neutral name, and fails an honest one that is fully dormant.

A future adapter may use an honest path such as `src/providers/jolpica/`. Its
dormancy is proven through dependency and composition boundaries instead:

- `src/index.ts` does not import or construct it;
- no environment resolver selects it;
- `ProviderMode` remains `mock | none`;
- `SynchronizationService` remains on its current path;
- no Worker bundle entry point can reach its transport;
- no configuration or binding enables it.

This follows the precedent the mapping registry and the coordinator already set:
each is proven dormant by asserting that no runtime module outside its own
directory imports it.

**This amendment does not modify `provider-neutrality.test.ts`.** When adapter
implementation begins, its "no Jolpica file name" assertion must be replaced by
assertions of the boundaries above, in the same change that adds the adapter.
The OpenF1 file-name assertion is outside this decision.

### Rejected alternatives

| Alternative                                  | Why rejected                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Key on `raceName` alone                      | A sponsor-mutable display string. A rename silently becomes a different event, or a lookalike name the same one (D5). |
| Key on `round` (or `season` + `round`)       | Rounds shift when a calendar changes, so a shifted round silently repoints to another event.                          |
| Key on `circuitId` alone                     | One circuit can host two events in a season.                                                                          |
| Derive `eventSlug` from `raceName`           | Slug minting: the public identity would then depend on provider branding (D5).                                        |
| Use OpenF1 `meeting_key` as the event anchor | A provider identifier is never canonical (D2), it is not a Jolpica field, and the OpenF1 path stays fail-closed.      |
| Fuzzy or normalized locator matching         | Produces confident wrong answers (D4, D5).                                                                            |

### Consequences of the amendment

**What it records.** The canonical event identity rule, the Jolpica event
locator and its matching, alias, evidence and review rules, the calendar status,
`hasResults` and missing-time semantics, and the dormancy proof a future adapter
must satisfy.

**What it does not do:**

| Item                                         | State                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Event identity decision                      | **Accepted** (2026-09-16)                                                |
| Event registry and `event` mapping support   | **Not implemented**                                                      |
| Event mapping dataset                        | **Not created**; no complete locator is recorded (A4)                    |
| `hasResults` derivation in assembly          | **Not implemented**; the preflight and assembly are unchanged (A7)       |
| Jolpica adapter, for any resource            | **Not implemented and not registered**                                   |
| `provider-neutrality.test.ts`                | **Unchanged**; its replacement is required when adapter work begins (A9) |
| G1 (live provider mode)                      | **Open**                                                                 |
| G5 (event-aware scheduling), G9 (provenance) | **Open**                                                                 |
| G-l (mapping dataset coverage)               | **Open**, and now also covers event locators                             |
| Provider requests                            | **None, ever.** No provider was contacted.                               |

**The calendar adapter is not unblocked.** It stays blocked until the event
registry mechanism and curated event mapping data for the season it serves
actually exist. This amendment defines the implementation path; it does not
shorten it.

`PROVIDER_MODE` still admits exactly `mock` and `none`, staging is `mock` and
production is `none`. Nothing here authorizes a provider request, deployment,
production synchronization or public release, and no licensing conclusion
changes.
