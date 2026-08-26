# 0022 - Curated provider-identifier mapping registry

- Status: Accepted
- Date: 2026-08-25
- Phase: 9B-3
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
