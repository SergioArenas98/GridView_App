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

- **Staging tail:** `npm run check:staging-observability` from
  `services/edge-api`, or `wrangler tail` filtered on
  `provider_mapping_unresolved`.
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

Five identities sit in this state today: `Cadillac` and `Racing Bulls`
(OpenF1 `team_name`), `antonelli` (Jolpica `driverId`) with its OpenF1
`driver_number` `12`, and `hungaroring` (Jolpica `circuitId`). Two of them are
half of the four constructor-name disagreements recorded in Provider Evaluation
§8.5.

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
