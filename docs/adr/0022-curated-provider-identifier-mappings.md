# 0022 - Curated provider-identifier mapping registry

- Status: Accepted
- Date: 2026-08-25
- Phase: 9B-3
- Amended: 2026-09-16 —
  [Grand Prix event identity](#amendment-2026-09-16-grand-prix-event-identity)
  (decided 2026-09-16; the **mechanism** was implemented 2026-09-19 and the
  curated **2026 event dataset** was added the same day; the adapter remains
  absent)
- Noted: 2026-09-23 — [current constructor name versus stable ID](#d2---gridview-owns-stable-identity)
  (the curator-approved `sauber` → `Audi` naming decision; the ID is unchanged)
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

> **Note 2026-09-23 - current name versus stable ID.** "Never change" applies
> to the ID. A constructor's current canonical public name and short name
> (`Constructor.name`, `Constructor.shortName`) may change, but only through
> an explicitly curator-approved, repository-recorded decision that keeps the
> ID and leaves each historical season name in its season entry
> ([Domain Model §6.3](../technical/GridView_Domain_Model.md#63-constructor),
> naming layers). A provider value never renames an identity: a new provider
> name or ID is evidence for review, and a mapping still only points at an
> existing identity. The first such decision is the 2026 constructor dataset
> (Provider Evaluation §8.9): Jolpica's observed `constructorId` `audi`, with
> the observed name "Audi", maps to the existing, unchanged ID `sauber`,
> whose current canonical name and short name the curator set to `Audi`. That
> mapping is a curator-authored lineage decision; Jolpica supplied neither the
> `sauber` ID nor the lineage ruling. No `audi` identity exists. The exact 2026
> entrant name is deferred to the 2026 `ConstructorSeasonEntry.fullName`.

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
the valid (source, entity, field, value type) combinations - six when this ADR
was accepted, seven since the 2026-09-16 amendment added the Jolpica event
locator -
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

> **Note 2026-09-23.** The six-constructor figure describes the registry when
> this ADR was accepted. The 2026 constructor dataset (Provider Evaluation §8.9)
> curated `cadillac` and `racing-bulls` and brought the registry to 11. The
> OpenF1 `Cadillac` and `Racing Bulls` values stay unmapped, now with the reason
> `no-approved-provider-mapping`.

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

- Status: Accepted. **Mechanism implemented 2026-09-19** (A5), the curated
  **2026 event dataset** added the same day (A4 status note), and the
  **season-calendar port implemented, fixture-tested and dormant on
  2026-09-20** with the A9 test replacement made in the same change. A
  **season-circuits port** followed on **2026-09-22**, equally dormant
  (Implementation Plan §14.0.17). *A **season-participants** port followed on
  **2026-09-24**, equally dormant (Implementation Plan §14.0.21).* *A race
  **session-classification** port followed on **2026-09-26**, equally
  dormant (Implementation Plan §14.0.22).* Every other Jolpica resource and
  the A7 assembly change are still outstanding
- Date: 2026-09-16
- Phase: 9B, recorded before the first Jolpica calendar adapter slice
- Amends: this ADR's [scope note](#scope-note), and — for coordinated season
  assembly only — the rule in
  [ADR 0023](0023-multi-source-provider-coordination.md) D11 that `hasResults` is
  never rewritten (A7)
- Implements: **nothing when it was recorded.** No registry, TypeScript type,
  JSON Schema, content validator, mapping record, fixture, adapter, test,
  configuration or CI file changed with it. The A5 mechanism — the event
  registry, the `event` mapping entity, their schemas, `validate:content`
  coverage and tests — landed separately on 2026-09-19. **No mapping record,
  no adapter and no configuration change landed with it either.**

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

| Component   | Jolpica source      | Where it is curated                           |
| ----------- | ------------------- | --------------------------------------------- |
| `season`    | `season`            | The existing season qualifier of the key (D3) |
| `round`     | `round`             | The mapping record                            |
| `raceName`  | `raceName`, exact   | The mapping record                            |
| `circuitId` | `Circuit.circuitId` | The mapping record                            |

**The `season` component is the key's existing season qualifier, never a
second season.** D4's key is already season-qualified, and D3 makes the
season-scoped mapping file supply that value, so a record in
`content/seasons/2026/` is a 2026 locator by construction. A record must not
carry its own season alongside it: two season fields could disagree, and a
record whose inner season contradicted its file would pass schema, uniqueness,
target and evidence validation yet never match any lookup — a curated mapping
that looks correct while the calendar fails closed for ever. If an
implementation ever does represent the season inside the record, validation
must reject any record whose inner season differs from its file's season.

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

> **Status on 2026-09-19: the 2026 dataset exists.** One further Jolpica
> calendar request was separately authorized and made on 2026-09-19. Its
> metadata, licence and attribution, the 23 exact observed locators and the
> curator decisions are recorded in
> [Provider Evaluation §8.8](../technical/GridView_Provider_Evaluation.md#88-2026-calendar-observation-and-the-curated-event-dataset-2026-09-19);
> the raw response stays outside the repository. A curator approved all 23
> `eventSlug` identities, the event registry holds exactly those 23, and every
> observed 2026 locator has a reviewed mapping and an evidence-corpus entry.
> That is a point-in-time observation: a later calendar change fails closed
> until another reviewed mapping update (A3). The statements above describe the
> repository when this amendment was accepted.

### A5 - Required implementation shape

> **Implemented as a mechanism on 2026-09-19** (Phase 9B event-registry
> mechanism). All five items below exist, with schemas, `validate:content`
> coverage and tests. **The curated 2026 event dataset was added the same
> day** (A4 status note): 23 identities and 23 mapped locators. No Jolpica
> adapter existed then, and no Worker or GridView runtime has made a provider
> request. The mechanism is dormant and unbundled — no runtime module outside `src/providers/mappings/`
> imports it, and the Worker entry point cannot reach it.
>
> **On 2026-09-20** a **season-calendar-only** Jolpica port was added at
> `src/providers/jolpica/` and consumes this mechanism. It is equally dormant
> and unbundled, still no provider request has been made, and no other
> resource is implemented.

The implementation should:

1. **Extend the mapping entity union with `event`**, and the closed
   source/entity/field combinations with exactly one new member: Jolpica, event,
   the A2 locator. No OpenF1 event combination is added.
2. **Represent the locator as a closed, typed composite value** that fills the
   provider-value position of the existing key — `round`, `raceName` and
   `circuitId` — while the season stays the key's existing qualifier (A2). The
   curated record therefore carries no season of its own, and a schema that
   nonetheless admitted one would need a semantic rule requiring it to equal
   the file's season. Its key encoding must be injective by construction
   (structured, or length-prefixed like the preflight's composite identities),
   never a separator-joined string. Each component's type is part of the key
   (D4). `raceName` and `circuitId` are exact strings, `round` an integer; if
   Jolpica's recorded wire form differs, the implementation defines one strict
   parse, and anything it refuses is `invalid-key` rather than a lenient
   coercion.

   **As implemented (2026-09-19).** The field position carries the literal
   `eventLocator`, which is **GridView's own name for the composite**, not a
   Jolpica field name: the locator spans three Jolpica fields at once, so no
   upstream name describes it, and naming it keeps the five-part key shape
   intact rather than making the field position optional for one entity kind.
   The value is a closed `{ round, raceName, circuitId }` object with
   `additionalProperties: false`; a redundant inner `season` is **rejected**
   rather than reconciled, which is stricter than the fallback this section
   allows and is possible because no inner season is represented. `round`
   carries the existing curated bound (`common.schema.json#/$defs/round`,
   1-40), so the schema and the runtime agree. The key encoding tags the value
   type `locator` and emits the three components as separate length-prefixed
   frames, so the tag determines the frame count and the encoding stays
   injective across scalar and composite keys alike.
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
  `missing-round-classification` gap can never fire. A race that was in fact
  completed, but for which no classification was planned — or whose selected
  classification is the `unavailable` absence document — then publishes with
  `hasResults: false` instead of withholding the season. A classification that
  _was_ planned and produced no candidate still fails the run as
  `resource-unavailable`, unchanged. That fails towards not fabricating, but it
  is a **weaker completeness guarantee** than a source supplying `completed`
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
- **A race that lacks the `date` or `time` its own race session needs for a
  complete start instant fails the complete calendar resource**, also as
  `invalid-payload`. The adapter emits a race session for every calendar event,
  so this is never an optional block.
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

> **Done on 2026-09-20**, in the change that added the season-calendar port.
> The Jolpica file-name assertions in `provider-neutrality.test.ts` and in
> `coordination-containment.test.ts` are replaced by the boundaries above:
> the transitive import closure of `src/index.ts` contains no module under
> `src/providers/jolpica/`, no module outside that directory imports it, no
> production composition constructs it, and no Wrangler declaration names it.
> `deep-validation-gate.test.ts`'s textual `ProviderResourcePort` scan excludes
> the adapter directory on the same reasoning — implementing the port is not
> wiring it. The OpenF1 file-name assertion is untouched. The dry-run Worker
> bundle is byte-identical to the baseline and contains none of the adapter's
> symbols.

### A10 - The weekend format states only what the row's blocks evidence

**Added 2026-09-20.** A5-A9 left one field of the calendar contribution
undecided. The port implemented on 2026-09-20 therefore filled
`GrandPrix.format` on A6's reasoning without an accepted rule of its own, and
recorded that gap rather than hiding it. This closes it, on the same evidence
discipline as A6 and A8: the adapter says what the provider said, and no more.

**The rule.** Read the weekend format from the row's own session blocks, and
from nothing else.

1. **`sprint`** - a valid `Sprint` block **or** a valid `SprintQualifying`
   block is present.
   - **Either block is positive evidence of a sprint weekend**, independently.
   - **Both are not required.**
   - **The missing counterpart is never inferred or created.**
2. **`standard`** - **only** when neither sprint-specific block is present
   **and** all four standard evidence blocks are present and valid:
   `FirstPractice`, `SecondPractice`, `ThirdPractice`, `Qualifying`.
3. **`unknown`** - when neither sprint-specific block is present and the
   complete standard evidence set is not available. **Missing or incomplete
   schedule evidence must never be promoted to `standard`.**

**Why the absence of sprint blocks cannot, by itself, prove `standard`.** The
two sprint blocks are separately optional upstream (A8's premise, and the
reason A10.1 accepts either alone). A calendar published before a round's
detail firms up simply omits its blocks, as does one published while a sprint
is cancelled or unconfirmed. Under an absence rule every one of those rows
would be published as a confidently standard weekend, and the client renders
the format as fact. That is a confident wrong answer of exactly the kind D4 and
D5 forbid, produced from silence. Silence is not evidence.

**Why the complete FP1/FP2/FP3/Qualifying signature is sufficient.** No single
member of that set distinguishes the formats - a sprint weekend carries a first
practice and a qualifying too - but the complete set, *reached only after the
sprint branch has already declined*, does.

The ordering carries the argument, and it is structural rather than
inductive: **the `standard` branch is unreachable while either sprint block is
present**, so no payload carrying sprint evidence can be classified `standard`,
whatever its practice blocks look like. The remaining question is only whether a
weekend with **no sprint evidence at all**, carrying three practices and a
qualifying, could be anything other than standard - and such a payload has
stated the whole shape of a standard weekend and nothing of a sprint one.

**The supporting observation is a single one, and is not load-bearing.**
Provider Evaluation §8.4 records that round 2 of 2026 carried `Sprint` and
`SprintQualifying` and omitted `SecondPractice`/`ThirdPractice`. That is one
observed round, not a documented upstream guarantee, and this amendment does
not generalize it into one. It corroborates the rule; the branch ordering above
is what makes the rule safe.

This is a positive reading of a present signature, not an inference from what is
missing, which is what separates it from the rejected absence rule.

**A block counts as evidence only if it decoded.** `sessions` holds exactly the
blocks that were present *and* produced a complete instant, because a present
block that could not already failed the whole resource as `invalid-payload`
(A8). A malformed or `null` block therefore never becomes evidence of any
format.

**Sessions stay data-driven, and the discriminator never touches them.**

- The ordered normalized `sessions` array remains authoritative.
- `format` must never add, remove, reorder or synthesize a session.
- An unusual but valid combination is represented by its **actual session
  list**, whatever the discriminator answers. A row carrying the complete
  standard signature *and* a sprint is a `sprint` weekend whose session list
  contains all of them, in instant order.
- The discriminator is **descriptive evidence about the list, never a template
  for generating one.**

**The format is never derived from** the event name, the round, the date, the
current time, a comparison with another season, an assumed Formula 1 rule, or
the absence of sprint data alone.

**A8 is unchanged and remains authoritative for session times.** An absent
optional block emits no session; a present block without the complete valid
instant A8 requires makes the provider payload invalid; no session is emitted
with `startTime: null`; no midnight is manufactured, the race time is never
reused and no timezone is inferred. Nullable `endTime`, display metadata and
media fields are unaffected. This amendment required no implementation change
there.

**Scope.** This decision applies to **Jolpica calendar normalization**. It does
not unlock runtime wiring, a provider mode, live traffic, deployment or any
other Jolpica resource; `PROVIDER_MODE` still admits exactly `mock` and `none`.
It changes no enum: `WeekendFormat` already carried `unknown`, and the
Domain Model's per-field note is corrected to say so rather than being widened.

**A later provider format change needs no new decision.** A weekend shape this
rule does not recognize classifies as `unknown` and is carried by its actual
sessions array, which stays correct and complete. The rule fails towards saying
less, never towards inventing a category.

### Rejected alternatives

| Alternative                                  | Why rejected                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Key on `raceName` alone                      | A sponsor-mutable display string. A rename silently becomes a different event, or a lookalike name the same one (D5). |
| Key on `round` (or `season` + `round`)       | Rounds shift when a calendar changes, so a shifted round silently repoints to another event.                          |
| Key on `circuitId` alone                     | One circuit can host two events in a season.                                                                          |
| Derive `eventSlug` from `raceName`           | Slug minting: the public identity would then depend on provider branding (D5).                                        |
| Use OpenF1 `meeting_key` as the event anchor | A provider identifier is never canonical (D2), it is not a Jolpica field, and the OpenF1 path stays fail-closed.      |
| Fuzzy or normalized locator matching         | Produces confident wrong answers (D4, D5).                                                                            |
| Read the absence of both sprint blocks as `standard` (A10) | Publishes a confident format for every row whose schedule detail is simply not published yet. Silence is not evidence. |
| Require **both** sprint blocks for `sprint` (A10) | The two are separately optional upstream, so a cancelled sprint or a partly finalized schedule would lose a sprint designation it plainly has. |
| Derive the format from the event name, round, date or clock (A10) | None is schedule evidence. A round shifts when a calendar changes, and reading a clock is the inference A6 and A8 already forbid. |
| Add a fourth `WeekendFormat` member for "not yet published" (A10) | `unknown` already means exactly that, and a new member would change the public contract and every client that renders it. |

### Consequences of the amendment

**What it records.** The canonical event identity rule, the Jolpica event
locator and its matching, alias, evidence and review rules, the calendar status,
`hasResults`, weekend-format and missing-time semantics, and the dormancy proof
a future adapter must satisfy.

**What it does not do:**

| Item                                         | State                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Event identity decision                      | **Accepted** (2026-09-16)                                                |
| Event registry and `event` mapping support   | **Implemented as a mechanism** (2026-09-19); dormant and unbundled (A5)  |
| Event mapping dataset                        | **Created for 2026** (2026-09-19): 23 identities, 23 locators (A4)       |
| `hasResults` derivation in assembly          | **Not implemented**; the preflight and assembly are unchanged (A7)       |
| Jolpica **season-calendar** port              | **Implemented, fixture-tested and dormant** (2026-09-20); not registered, not constructed by any production composition and absent from the Worker bundle |
| Weekend-format rule (A10)                     | **Decided and implemented** (2026-09-20), in the same change that records it. Three-way evidence rule; no enum, contract or runtime change |
| Jolpica **season-circuits** port             | **Implemented, fixture-tested and dormant** (2026-09-22, Implementation Plan §14.0.17); a separate port that answers only `season-circuits`, resolving every `circuitId` through the curated mapping under D10. Not registered, not constructed by any production composition and absent from the Worker bundle |
| Jolpica **season-participants** port         | **Implemented, fixture-tested and dormant** (2026-09-24, Implementation Plan §14.0.21); two sequential requests resolving every `driverId` and `constructorId` through the curated mapping under D10. Not registered, not constructed by any production composition and absent from the Worker bundle |
| Jolpica race **session-classification** port | **Implemented, fixture-tested and dormant** (2026-09-26, Implementation Plan §14.0.22, [ADR 0023 A2](0023-multi-source-provider-coordination.md#amendment-a2---jolpica-race-result-normalization)); one request per round, resolving the event locator, every `driverId` and every `constructorId` through the curated mapping under D10. Not registered, not constructed by any production composition and absent from the Worker bundle |
| Jolpica adapter, for every other resource     | **Not implemented.** Event schedules, classifications and standings are refused as `resource-unsupported`; this is not a working full adapter. *Participants removed from this row 2026-09-24: see the row above.* *Race classifications removed 2026-09-26: see the row above. Qualifying, sprint and sprint-qualifying classifications stay refused.* |
| `provider-neutrality.test.ts`                | **Replaced** (2026-09-20), in the same change that added the adapter: composition, dependency and configuration dormancy assertions in place of the Jolpica file-name assertion (A9) |
| G1 (live provider mode)                      | **Open**                                                                 |
| G5 (event-aware scheduling), G9 (provenance) | **Open**                                                                 |
| G-l (mapping dataset coverage)               | **Open**; its 2026 event and circuit sub-gaps are both closed           |
| Provider requests                            | **Research only** (~25 on 2026-08-19, 1 on 2026-09-19); none by GridView |

**The calendar adapter is not unblocked.** It stays blocked until the event
registry mechanism and curated event mapping data for the season it serves
actually exist. This amendment defines the implementation path; it does not
shorten it.

> **Status on 2026-09-19.** Both halves now exist for season 2026 and are
> dormant: the mechanism, and the curated dataset of 23 identities and 23
> mapped locators (A4 status note). **The calendar resource is still blocked**:
> All 23 observed Jolpica circuit identifiers are now curated and mapped
> (Provider Evaluation §8.8.1): `albert_park` from §8.4, five approved on
> 2026-09-19 whose canonical GridView circuit already existed, and 17 canonical
> identities approved on 2026-09-20. An event mapping still never implies a
> circuit (A3), so each is its own curated mapping. **Circuit coverage no
> longer blocks the adapter, but the adapter itself remains unimplemented and
> unregistered**, and A7 is not implemented.
>
> **Status on 2026-09-20.** The **season-calendar resource is no longer
> blocked**: its port is implemented, fixture-tested and dormant
> (Implementation Plan §14.0.16). It is still not registered, not constructed
> by any production composition and absent from the Worker bundle; no provider
> request was made and no provider mode was added. **Every other Jolpica
> resource remains unimplemented**, and A7 is still not implemented.
>
> **Status on 2026-09-22.** A second dormant, fixture-tested port now answers
> the **season-circuits** resource (Implementation Plan §14.0.17), on the same
> A9 terms and with a byte-identical Worker bundle. It applies D10 unchanged:
> every `circuitId` resolves through the curated mapping or the whole resource
> fails, so the unexplained 24-circuits-for-23-races observation (Provider
> Evaluation §8.7 M8) needed no new rule and remains open. Participants, event
> schedules, classifications and standings remain unimplemented, as does A7.
>
> **Reference 2026-09-23.** The semantics of the participants resource are
> decided in [ADR 0026](0026-season-participation-semantics-and-derivation.md),
> which applies D10 unchanged to the season drivers and constructors
> endpoints: every row resolves or the whole identity resource fails, and no
> row is dropped. It approves no identity and changes no mapping. `antonelli`
> and the three OpenF1 acknowledgements stay exactly as recorded above.
> Participants remain unimplemented.
>
> **Note 2026-09-23 - 2026 driver dataset.** A later reviewed change (Provider
> Evaluation §8.10) curated and mapped all 32 observed Jolpica `driverId`s.
> Canonical driver IDs are curator-authored slugs of the complete recorded
> given and family name, never a provider `driverId`: `antonelli` maps to the
> new identity `andrea-kimi-antonelli`, and its acknowledgement is removed.
> OpenF1 `driver_number` `12` stays unmapped under D7; its reason is now
> `no-approved-provider-mapping`, because the identity exists but no OpenF1
> mapping to it is approved. The season-2026 dataset holds 93 exact mappings,
> 96 approved evidence identities and three acknowledgements, all OpenF1.
> Participants remain unimplemented.
>
> **Provider requests, precisely.** The "none" statements in this ADR describe
> its own work. Roughly 25 authorized research `GET`s were recorded on
> 2026-08-19 (Provider Evaluation §8.1) and one authorized calendar-evidence
> `GET` on 2026-09-19 (§8.8). GridView's application code, the Worker provider
> client and the rate limiter have made **no** provider request.

`PROVIDER_MODE` still admits exactly `mock` and `none`, staging is `mock` and
production is `none`. Nothing here authorizes a provider request, deployment,
production synchronization or public release, and no licensing conclusion
changes.
