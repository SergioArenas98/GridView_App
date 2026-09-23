# GridView - Data-provider mapping guide

## Document information

- Product: GridView
- Document type: Operations guide
- Phase: 9B-3 (curated provider-identifier mapping registry, gap G8)
- Status: Active
- Document date: 2026-08-25
- Related documents:
  - [`../adr/0022-curated-provider-identifier-mappings.md`](../adr/0022-curated-provider-identifier-mappings.md)
  - [`../technical/GridView_Backend_Scheme.md`](../technical/GridView_Backend_Scheme.md) §8
  - [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) §8.5, §8.7
  - [`../technical/GridView_Domain_Model.md`](../technical/GridView_Domain_Model.md) §4.4

> **The registry is dormant.** No provider adapter exists, `PROVIDER_MODE`
> admits exactly `mock` and `none`, and nothing consumes the resolver yet. This
> guide describes the procedure that becomes operational when an adapter and
> the G4 coordinator exist. Following it today is a normal reviewed content
> change and contacts nobody.

---

## 1. What this registry is

GridView issues its own stable public identifiers. A provider's identifier is
**internal**, and the only thing that connects the two is a curated record in
version-controlled content:

| File                                                        | Purpose                                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `content/schemas/provider-mappings.schema.json`             | Structural contract for one mapping record.                                                                           |
| `content/schemas/provider-evidence.schema.json`             | Structural contract for the approved evidence corpus.                                                                 |
| `content/seasons/<year>/provider-mappings.development.json` | The curated mappings for that season.                                                                                 |
| `content/seasons/<year>/provider-evidence.development.json` | Every provider identity the repository already records for that season, and the written reason for any left unmapped. |
| `services/edge-api/src/providers/mappings/`                 | The immutable runtime resolver.                                                                                       |
| `services/edge-api/scripts/lib/provider-mapping-rules.mjs`  | The semantic rules `npm run validate:content` enforces.                                                               |

A mapping is keyed on five things together: **season, source, entity kind,
exact provider field, exact provider value**. Anything less is not a key.

---

## 2. How an unmapped identity is detected

A future adapter that cannot resolve an identity emits one structured log
event and **stops the resource**. It never guesses.

```json
{
  "level": "warn",
  "operation": "provider.mapping.resolve",
  "failureCategory": "provider_mapping_unresolved",
  "providerSourceId": "openf1",
  "season": 2026,
  "providerMappingEntity": "constructor",
  "providerMappingField": "team_name",
  "providerMappingFailure": "unmapped",
  "providerMappingValue": "Cadillac"
}
```

Every field is a bounded enum member, an integer, or the exact provider value
in the single internal diagnostic field `providerMappingValue`. No mapping
record, registry dump, upstream payload or exception body is ever logged.

A malformed key is reported as `invalid-key` and carries **no**
`providerMappingValue` at all: a value that failed validation is exactly the
one that must not be echoed, so the bounded `providerMappingKeyProblem` field
carries the whole diagnosis instead.

`providerMappingFailure` is one of:

| Reason             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unmapped`         | The registry is valid and this identity simply has no curated record. **This is the normal operator case.**                                                                                                                                                                                                                                                                                                  |
| `registry-invalid` | The registry failed validation, so _no_ lookup works. Fix the content; see §8.                                                                                                                                                                                                                                                                                                                               |
| `ambiguous`        | One key was curated with two different targets. Construction rejects this, so it should be unreachable.                                                                                                                                                                                                                                                                                                      |
| `target-missing`   | A record points at a GridView ID that does not exist. Construction rejects this too.                                                                                                                                                                                                                                                                                                                         |
| `invalid-key`      | The adapter produced a malformed provider identity: an unknown source, a mismatched field, a padded/empty/control-character string, or a non-positive or unsafe number. **Fix the adapter, do not curate the value.** The value is deliberately not logged; the bounded `providerMappingKeyProblem` field carries the diagnosis (`not-an-object`, `invalid-season`, `invalid-value`, `invalid-combination`). |

### 2.1 Where to look

- **Staging tail:** `wrangler tail` filtered on `provider_mapping_unresolved`,
  or `npm run check:staging-observability` from `services/edge-api` — which also
  POSTs admin sync and rollback, so not before the season-2026 reclosure in the
  staging runbook's section 6 is complete.
- **Locally:** the same event is emitted by the test harness; see
  `services/edge-api/test/providers/mappings/mapping-containment.test.ts`.

---

## 3. Identifying source, season, entity kind and field

Read them straight off the event — that is what the four bounded fields exist
for. Do not infer them from the value.

1. `providerSourceId` → `jolpica` or `openf1`.
2. `season` → the season the identity was observed in. **Never assume it
   applies to another season.**
3. `providerMappingEntity` → `driver`, `constructor` or `circuit`.
4. `providerMappingField` → the exact upstream field. The valid combinations
   are closed:

| Source    | Entity        | Field           | Value type               |
| --------- | ------------- | --------------- | ------------------------ |
| `jolpica` | `driver`      | `driverId`      | non-empty bounded string |
| `jolpica` | `constructor` | `constructorId` | non-empty bounded string |
| `jolpica` | `circuit`     | `circuitId`     | non-empty bounded string |
| `openf1`  | `driver`      | `driver_number` | positive safe integer    |
| `openf1`  | `constructor` | `team_name`     | non-empty bounded string |
| `openf1`  | `circuit`     | `circuit_key`   | positive safe integer    |

There is no other combination, and there is no `mock` source: the mock provider
emits GridView-owned identities and must never have a mapping.

> **A seventh combination exists for Grand Prix events**: Jolpica, `event`,
> `eventLocator`, the complete event locator, decided by the
> [ADR 0022 amendment of 2026-09-16](../adr/0022-curated-provider-identifier-mappings.md#amendment-2026-09-16-grand-prix-event-identity)
> and implemented on 2026-09-19. The schema, the resolver and
> `validate:content` all support it. **Season 2026 carries 23 curated event
> mappings**, one for every locator observed on 2026-09-19. See §15.

---

## 4. Verifying the intended GridView identity

Open the curated registry that owns the entity kind and **read the ID from it**:

| Entity        | Canonical registry                          |
| ------------- | ------------------------------------------- |
| `driver`      | `content/registries/drivers.mock.json`      |
| `constructor` | `content/registries/constructors.mock.json` |
| `circuit`     | `content/registries/circuits.mock.json`     |

Confirm the entity is the same real-world competitor, constructor or circuit —
by season entry, line-up, results position or location, not by how the name
looks. **Never derive the GridView ID from the provider string.** Jolpica's
`albert_park` maps to `albert-park` because a person checked it, not because
underscores become hyphens.

---

## 5. A genuinely new driver, constructor or circuit

If no canonical GridView identity exists, this is **not** a mapping task.

1. Add the stable identity to the correct curated registry first, following
   the existing public-ID grammar (lowercase ASCII kebab-case) and the rules in
   `content/README.md` and `GridView_Domain_Model.md` §4.
2. Add the season entry, if the entity participates in that season.
3. Only then add the provider mapping.

> **Season entries under ADR 0026 (2026-09-23).** For the Jolpica path, step 2
> no longer means curating a `DriverSeasonEntry` by hand. Under
> [ADR 0026](../adr/0026-season-participation-semantics-and-derivation.md),
> season assembly derives driver participation spans from selected race
> classifications, and a constructor's season entry is emitted for each mapped
> constructor the season endpoint lists. Curation for a new participant is
> therefore the identity (step 1) and the mapping (step 3). This is decided
> but not implemented. The mock `driver-entries` content is development data
> only.

Until step 1 exists, record the identity in the season's
`provider-evidence.development.json` under `acknowledgedUnmapped`, with a
closed-enum `reason` and a written `detail`. That keeps the gap visible and
keeps synchronization failing closed instead of silently dropping a row.

> **An acknowledgement is a temporary blocker, not a mapping.** It records
> _"observed, but no canonical GridView target exists"_. It never means
> _"coverage accepted, so synchronization may continue"_. The runtime is built
> from the mapping file alone: it has no notion of an acknowledgement, still
> answers `unmapped`, and the affected resource still fails closed. Once a
> mapping becomes possible, add the mapping **and delete the acknowledgement**
> — validation rejects an identity that is both mapped and acknowledged.

Reasons are a closed set, so an acknowledgement cannot be turned into a
free-text coverage excuse:

| `reason`                           | Meaning                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `no-canonical-gridview-identity`   | The entity has no curated GridView identity yet. Fix by curating the identity first (§5 step 1). |
| `identity-pending-curation-review` | The GridView identity is disputed or under review.                                               |

Both reasons describe **one exact observed provider identity**, and every
acknowledgement must correspond to an entry in `identities`. A _field-level_
gap - a provider field for which the repository records no approved value at
all, such as OpenF1 `circuit_key` - cannot be written here without fabricating
a provider value. Those are tracked as gap **G-l** in
`../technical/GridView_Provider_Evaluation.md` instead.

Four identities sit in this state today: `Cadillac` and `Racing Bulls`
(OpenF1 `team_name`) and `antonelli` (Jolpica `driverId`) with its OpenF1
`driver_number` `12`. Two of them are half of the four constructor-name
disagreements recorded in Provider Evaluation §8.5. **No circuit is
acknowledged**: all 23 observed season-2026 `circuitId`s are curated and mapped
(§8.8.1).

---

## 6. Adding a mapping without changing a public ID

Append a record to `content/seasons/<year>/provider-mappings.development.json`:

```json
{
  "source": "openf1",
  "entity": "constructor",
  "providerField": "team_name",
  "providerValue": "Alpine",
  "gridviewId": "alpine",
  "evidence": "GridView_Provider_Evaluation.md 8.5 - recorded constructor name disagreement."
}
```

Rules:

- `gridviewId` must already exist. Adding a mapping **never** creates,
  renames or repoints a public ID.
- `providerValue` is the exact upstream value — no trimming, no case change,
  no punctuation cleanup, no transliteration.
- `evidence` is mandatory and must point at something already in this
  repository. **Never commit a contract, a credential, a confidential document
  or a raw provider payload.** Record the existence of the evidence and where
  it lives, exactly as the media-rights register does.
- Add the identity to `provider-evidence.development.json` under `identities`
  too. A mapping for an identity the corpus never recorded is rejected.

---

## 7. Intentional aliases and branding differences

Several provider spellings may resolve to one GridView identity, **but every
alias must be its own explicit record**. There is no alias rule, no "also
accept", no pattern and no wildcard.

`Mercedes` (OpenF1 `team_name`) and `mercedes` (Jolpica `constructorId`) are
two separate curated records that both target `mercedes`. Similarly, Jolpica
`norris` and OpenF1 `driver_number` `1` are two records targeting
`lando-norris`.

This is exactly how the §8.5 branding disagreements are handled: `Alpine`
resolves because someone curated it, and `Alpine F1 Team` — a Jolpica _display
name_, not an identifier — resolves to nothing at all, deliberately.

---

## 8. Correcting a wrong mapping

Through code review, like any other change:

1. Edit or remove the record in the season's mapping file.
2. State in the commit or pull request what was wrong and what the evidence is.
3. Run the checks in §10.
4. Get it reviewed and merged.

There is **no runtime repair path and no admin mutation endpoint**. The
registry is not in KV, not in a Durable Object, not in a database and not
editable from a deployed Worker. A wrong identity is corrected by a reviewed
commit and a deploy, which is what makes the change auditable.

If a wrong mapping already reached published data, correct the mapping and then
re-run synchronization; the publication path replaces the snapshot.

---

## 9. Why duplicate, ambiguous, dangling and malformed records fail

Registry construction is **all-or-nothing**. If any record fails, no index is
exposed and every lookup answers `registry-invalid`. There is no valid subset
and no last-entry-wins overwrite, because a half-loaded identity table is
precisely how a wrong identity gets published.

| Problem                                                                  | Verdict                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| The same complete key twice, even with the same target                   | `duplicate-key`                                         |
| The same complete key with two different targets                         | `ambiguous-key`                                         |
| A target that exists in no registry                                      | `target-missing`                                        |
| A target of the wrong entity kind (a constructor ID on a driver mapping) | `target-missing`                                        |
| An unknown source, or an invalid source/entity/field combination         | `invalid-key-combination`                               |
| A string where an integer is required, or the reverse                    | `invalid-key-combination`                               |
| An empty value, or leading/trailing whitespace                           | `invalid-key-combination`                               |
| A non-integer, zero, negative or unsafe numeric value                    | `invalid-key-combination`                               |
| A target that breaks the public-ID grammar                               | `invalid-target-grammar`                                |
| An unknown property on a curated record                                  | rejected by JSON Schema (`additionalProperties: false`) |
| An approved identity that is neither mapped nor acknowledged             | rejected by the coverage rule                           |

Record order never affects any of this.

---

## 10. Checks that must run

From `services/edge-api`:

```bash
npm run validate:content   # JSON Schema + the semantic mapping rules
npm run typecheck
npm run lint
npm run format
npm test
npm run validate           # includes validate:content in CI
```

`validate:content` is the gate that matters most here: it is the only place
composite-key uniqueness, target existence and evidence coverage are checked.

---

## 11. Why string similarity and slug minting are forbidden

Provider Evaluation §8.5 is the evidence: joining constructors by name across
the two sources matched only **7 of 11**. Four constructors are named
differently — `Alpine`/`Alpine F1 Team`, `Cadillac`/`Cadillac F1 Team`,
`Racing Bulls`/`RB F1 Team`, `Red Bull Racing`/`Red Bull`.

A normalizing or fuzzy matcher would not have solved this. It would have
produced confident wrong answers — `Red Bull Racing` and `Red Bull` are similar
strings belonging to the _same_ team, while `Racing Bulls` and `Red Bull
Racing` are similar strings belonging to _different_ teams. Any threshold that
merges the first pair also risks merging the second.

Minting a GridView ID from a provider slug is the same failure with a worse
outcome: it creates an unstable public identifier that a later branding change
silently repoints, breaking the "public IDs never change" rule in Backend
Scheme §8.1.

So resolution uses exact typed equality only, and an unknown entity fails
validation rather than inventing an identifier.

---

## 12. Mid-season additions

A driver, constructor or circuit that appears mid-season requires a curated
mapping **before** its data can be published. Jolpica returned 31 drivers for a
2026 season with 22 on the grid at any one race (§8.4), so mid-season churn is
expected, not exceptional.

The fail-closed behaviour is the feature: an unmapped mid-season entrant stops
the resource and raises the signal, rather than appearing under a guessed
identifier that later has to be migrated.

**Every season-list identity needs curation, not only racers (ADR 0026,
2026-09-23).** `/{season}/drivers/?limit=100` and
`/{season}/constructors/?limit=100` define the complete identity universe, so
every returned row must be mapped before the participants resource can
publish, including a driver who never appears in a race classification. Such a
driver remains an identity without a participation span. It is never dropped,
and never listed in the season Drivers collection. Whether any of the 31
recorded 2026 driver identities is such a case is unverified, because the
response was not preserved (Provider Evaluation §8.4).

---

## 13. Provider identifiers stay internal

A provider identifier may appear in:

- the curated mapping and evidence content under `content/seasons/<year>/`;
- the internal `providerMappingValue` diagnostic log field;
- narrowly scoped internal tests.

It must **never** appear in:

- a public v1 API response;
- `docs/api/gridview-api-v1.yaml` or any OpenAPI example;
- a public contract fixture under `services/edge-api/test/fixtures/`;
- a published snapshot;
- a Flutter DTO, domain entity or Drift schema;
- a cache key exposed to a client, a request ID, or any error message returned
  by a public route.

This is asserted by tests, not just stated here.

---

## 14. What does not exist

- No admin route creates, edits or deletes a mapping.
- No runtime code writes the registry to KV, a Durable Object or local storage.
- No discovery job invents mappings from observed provider data.
- No provider is contacted by any part of this workflow.
- No Jolpica adapter exists, so nothing resolves the 23 curated 2026 event
  mappings at runtime (§15).

---

## 15. Grand Prix events — decided, not yet operational

> **The mechanism and the 2026 data exist; the adapter does not.** The
> decision is recorded in the
> [ADR 0022 amendment of 2026-09-16](../adr/0022-curated-provider-identifier-mappings.md#amendment-2026-09-16-grand-prix-event-identity)
> and the event registry, the `event` mapping entity, their schemas and their
> `validate:content` rules were implemented on 2026-09-19.
>
> **The 2026 dataset was curated on 2026-09-19.** `content/registries/events.development.json`
> holds 23 curator-approved `eventSlug` identities, and every one of the 23
> Jolpica locators observed that day has a reviewed mapping and an evidence
> entry. The observation, its licence and attribution and the curator decisions
> are recorded in Provider Evaluation §8.8; the raw response is not committed.
> It is a **point-in-time** observation, so a later calendar change fails
> closed until another reviewed update (§15.3).
>
> **Nothing resolves them yet.** No Jolpica adapter exists. All 23 observed
> circuit identifiers are curated and mapped (Provider Evaluation §8.8.1):
> `albert_park` from §8.4, five approved on 2026-09-19 and 17 canonical
> identities approved on 2026-09-20, so **circuit coverage no longer blocks a
> working calendar** - but with no adapter, nothing consumes any of it. The
> only provider requests on record are
> authorized research requests — about 25 on 2026-08-19 and one on 2026-09-19
> — and GridView's own code has made none.

### 15.1 Identity comes from a curated event registry

A curator creates each `eventSlug` in `content/registries/events.development.json`
(`kind: event-registry`), in a reviewed change, following
`GridView_Domain_Model.md` §4. **An accepted `eventSlug` is immutable**: it is
never renamed, repointed or reused, whatever later happens to the race's name
or sponsor. `GrandPrix.id` stays `{season}-{eventSlug}` and is built elsewhere,
never by the registry and never by an adapter.

A registry entry carries an `id` and a human-readable `name` for the reviewer,
and nothing else that could be mistaken for identity: no round, no date, no
circuit and no provider value. Two entries may never claim the same `id`;
`validate:content` rejects a duplicate rather than collapsing it.

No adapter derives, normalizes or mints an `eventSlug`, and a Jolpica
`raceName`, `round` or `circuitId` is never a GridView identity.

### 15.2 The Jolpica event locator

Jolpica publishes no event identifier, so an event mapping is keyed on a
**provider locator**: the complete tuple `season`, `round`, exact `raceName` and
exact Jolpica `circuitId`, within the Jolpica source. It locates one event in
one season's Jolpica calendar; it is not an identity and is never treated as
unique outside that source and season.

The season comes from the file the record lives in — `content/seasons/<year>/`
— exactly as it does for a driver, constructor or circuit mapping (§1). A
record never repeats it, so a locator can never disagree with its own season
and then match nothing. A record that nonetheless carries an inner `season` is
**rejected** by both the schema and the resolver.

The record's `providerField` is the literal `eventLocator`. That is GridView's
own name for the composite, not a Jolpica field name: the locator spans three
Jolpica fields at once, so no upstream field name describes it. Its
`providerValue` is the object `{ round, raceName, circuitId }` — `round` an
integer between 1 and 40, the other two exact strings.

- **Every component must match exactly.** Matching on `raceName`, `round` or
  `circuitId` alone, or on any subset, is forbidden.
- **No fuzzy matching, slugification, case folding or punctuation
  normalization** — §11 applies to every component.
- **An absent, ambiguous or conflicting locator fails closed.** The calendar
  resource stops with the same `provider_mapping_unresolved` signal as any
  other unresolved identity (§2).
- **Two events may share a circuit in one season**, which is why `circuitId`
  never identifies an event on its own.

### 15.3 When the calendar changes

A calendar change, sponsor rename, round shift or circuit change produces a
tuple no record matches, and the calendar fails closed. The fix is a reviewed
mapping update with evidence, never a looser match:

1. Confirm, from recorded evidence, which existing `eventSlug` the changed race
   is. If it is a genuinely new event, create the `eventSlug` first (§5 order).
2. Add the new locator as **its own record** targeting that `eventSlug`. Earlier
   locators may stay as historical aliases (§7); each still matches only its
   own complete tuple.
3. Record the observed tuple in the season's evidence file, and state in the
   pull request what changed and where the evidence lives (§6, §8).

A single observation can never match two events. If two races in one calendar
resolve to the same `eventSlug`, the season candidate is withheld by the
existing `duplicate-identity` check rather than by picking one.

Evidence and review are at least as strict as for drivers, constructors and
circuits: mandatory evidence already in the repository, all four components
recorded as observed, and no component recalled, inferred or completed by hand.
Collecting new evidence from Jolpica is a separately authorized activity.
