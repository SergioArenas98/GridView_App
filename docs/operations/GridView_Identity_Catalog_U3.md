# U3: immutable R0 seed, validation and parity

U3 prepares and validates an offline, immutable representation of the existing
bundled identity corpus. It does not select a runtime catalog, approve an
identity, activate a revision or change synchronization/publication behavior.
No deployment, remote import or infrastructure operation was performed.

## Review artifacts and verified corpus

- [Complete R0 package](identity-seed-r0/seed.json)
- [Import manifest and exact source hashes](identity-seed-r0/manifest.json)
- [Per-binding, profile and unresolved-lookup parity](identity-seed-r0/parity.json)

Recalculation from the current worktree found 33 drivers, 11 constructors,
24 circuits, 23 events, 94 approved mappings, 101 evidence records and seven
unresolved acknowledgements. There was no discrepancy against the approved
33/94/101/7 baseline. The dataset version remains `2026.10.07.1`.

The four November keys (`rafael_camara`, `gabriele_mini`, `freddie_slater`,
`nikola_tsolov`) remain unresolved, as do the three existing OpenF1
acknowledgements. Nothing promotes a discovery candidate or acknowledgement
into a binding. Synthetic test fixtures do not enter the seed.

R0 content hash:
`sha256:c4177cd01b71c4b6bdd4d38aeb813d415f8acdbd9f073d9db6e0f2536be2c0e5`.
Canonical snapshot size: 403,732 bytes. Self-contained export: 555,679 bytes.
Both are below the approved 2 MiB limits.

## Model and provenance

The closed package uses `gridview-identity-seed/1`, catalog schema 1, sequence 0
and `prepared-unactivated`. Its snapshot uses `gridview-identity-catalog/1`.
It carries permanent driver anchors, version-1 profiles and profile hashes,
exact typed/scoped bindings, historical repository import references, evidence,
unresolved cases, sealed non-driver profiles and source documents, and a season
projection with dataset/base-content hashes. Complete snapshots and exports use
the existing canonical JSON and SHA-256 helpers; mapping keys use the existing
key decoder and serializer. Derived indexes use the existing resolver.

This is an offline seed package, not an authenticated `CatalogRevision` or
`ReviewDecision`. `revisionId` and unavailable historical creation/approval
times are explicitly null. Historical import references have deterministic
hashes and null reviewer attribution; they do not invent a principal, credential,
UUID or historical human decision. A later individually authenticated import
must attach its actual actor, time and revision identity. No such operation is
implemented here.

Ten JSON documents supply the complete identity and seasonal base: four
registries, mappings, evidence, season metadata, driver entries, constructor
entries and overrides. Media and attribution remain separately owned content.
Each source carries its repository-relative path, exact UTF-8 bytes/file hash,
semantic hash, actual document version or null, original status, available base
commit and an exact-byte commit only when Git proves that claim. References
retain original record pointers and provenance text. The original `mock` and
`development` labels are preserved; legacy repository content is grandfathered
under the accepted design, not relabeled as new online evidence.

Nine source files match HEAD exactly. The dirty provider-evidence file has
`exactCommit: null`; its exact hash includes the uncommitted investigation.
Its 97 historical records and three historical acknowledgements are checked
against HEAD. The four additions are classified `pending-operator-report`,
never `historical-mapped`. The loader rejects changed historical evidence or
changed verified registry/mapping content. The 101 records comprise 94
historical mapped claims, three historical unresolved claims and four pending
operator reports. Original provider citations remain citations; the tool never
fetches or claims to have recaptured them.

## Shared validation and generation

Static validators are generated from the existing content JSON schemas using
the installed Ajv configuration. Worker-compatible validation executes generated
code, not runtime code generation. `compile-schemas.mjs --check` detects stale
output. Only that generated file is excluded from Prettier; it has no manual
edits. No dependency or schema document was changed.

The existing mapping and driver-entry semantic rules were relocated byte for
byte to `src/identity/catalog/rules/`. Their old script paths re-export the same
implementation. This preserves the repository's prohibition on source imports
from `scripts/` and avoids a weaker duplicate validator. The existing content
validation command still consumes these exact rules.

Validation is all-or-nothing: closed shapes, complete source set, schema/version,
typed keys, season pairing, unique canonical/key records, target existence,
evidence coverage, normalized profile contracts and internal bounds, dataset
relationships, limits and hashes must all pass. The validator reconstructs the
entire snapshot from validated sources and compares every derived member. A
missing profile, sealed registry, evidence reference, changed index or unknown
field rejects the package. No offending record is filtered out.

From `services/edge-api`, regenerate locally with:

```text
node scripts/identity/compile-schemas.mjs --check
node scripts/identity/seed.mjs --out ../../docs/operations/identity-seed-r0
```

Generation forbids network access, verifies all parity assertions before writing
artifacts, and refuses to overwrite differing output. Repeating it against the
same corpus produces identical bytes. Pure `exportSeed`/`importSeed` functions
provide the bounded validated export/import boundary. This command has no
namespace, activation, synchronization or publication path.

## Local SQLite integrity and parity

`SeedStore` is isolated from the production `IdentityCatalog` host. The test host
alone invokes it. Installation metadata uses U2's existing schema checks;
`identity_seed` stores one immutable schema-1 package and its content/export
hashes, and `identity_seed_bindings` stores unique exact keys and binding/target
indexes. A synchronous SQLite transaction inserts the complete package and all
index rows. Reads validate the whole package and exact derived-index parity.

Identical imports replay; conflicting content/provenance cannot overwrite the
seed. Interrupted inserts roll back. An empty catalog may coexist with discovery
candidates, which remain unverified. There is no active pointer, review state
machine, proposal beyond R0, admin mutation route or production wiring.

Tests cover real Node SQLite transactions and an actual Miniflare/workerd SQLite
Durable Object. The latter injects failure inside the seed transaction, disposes
and recreates the entire runtime with the same SQLite directory, verifies exact
export/provenance recovery and replay, and confirms an existing November-key
candidate remains unresolved. Export/reimport into another empty local store
preserves the package. This demonstrates local recovery, not a production backup
or lossless crash-delivery guarantee.

Parity compares every driver profile field, all constructors/circuits/events,
all 94 bindings and seven unresolved cases, plus wrong-type/provider/season and
unknown lookup failures. Synthetic Jolpica fixtures exercise all seven resource
families, complete known inventories and valid calendar/classification/standings
outputs. Representative season document generation is identical with bundled
versus seed-derived profiles. A bundle-graph assertion proves the Worker does
not import any U3 catalog module.

## Limits and U4 gates

R0 deliberately validates the fixed reviewed corpus; it does not admit later
revisions or allocate dataset versions. The offline provenance manifest is not
a signature or an authenticated approval. U4 must verify reviewed source/export
hashes and introduce real import/review attribution under its own authorization.

Before U4, review this exact package and parity report, retain the seven blockers,
and agree the authenticated import/proposal/validation/activation contracts and
optimistic concurrency tests. Future revisions must preserve existing IDs and
bindings, evidence closure, version consistency and append-only protections.
Integrating seed storage into a production host or its combined logical capacity
accounting belongs to that later work; U3 changes no live host/storage schema.

Named reviewer, activator, recovery custodian and backup owners are still
unassigned. Provisioning, staging enablement, verified recovery exports and
production deployment remain separate operational gates. U4 has not begun.

## Validation results (2026-11-14)

| Check                                          | Result                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| U3 tests                                       | 43 passed, including real SQLite DO rollback/restart and export/reimport |
| U1/U2 identity regressions                     | 137 passed                                                               |
| Identity, shared-rule and dormancy focused run | 312 passed across 22 files                                               |
| Full edge-api suite                            | 5,999 passed, six existing opt-in skips; 280 files passed, three skipped |
| Type checking and ESLint                       | Passed                                                                   |
| Package formatting and report formatting/links | Passed                                                                   |
| Generated schema regeneration check            | Passed                                                                   |
| Content validation                             | 18 checks passed, zero failures                                          |
| Repeated artifact generation                   | Exact-byte match; existing artifacts accepted without replacement        |
| `git diff --check`                             | Passed                                                                   |

The final full command was `npm test -- --maxWorkers=1 --testTimeout=30000`
(594.17 seconds). It includes existing mapping, Jolpica adapter, normalization,
publication-contract and November regression tests. Application deadlines and
test assertions were not relaxed.

Earlier validation found source imports from `scripts/`, which failed the
existing dormancy assertion. Relocating the unchanged pure rules and retaining
compatibility re-exports resolved it without changing that test. Exact offline
catalog imports were added to two existing allowlists, while the Worker-only
graph remains unchanged. A subsequent full attempt with five-second defaults
hit timing failures in both new and existing suites and was stopped. The
existing fixture CLI suite passed separately (37 tests); the complete suite
then passed sequentially with the longer test allowance. No unresolved failure
or final-run timeout remains. Coverage percentage was not measured.

The branch remains `feat/jolpica-egress-proxy`, at HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. Nothing is staged or committed.
No live provider request, operational synchronization/publication, deployment,
remote infrastructure change, secret provisioning or notification delivery
occurred. U4 has not begun.

## Exact file inventory and preservation audit

The pre-U3 snapshot contains 73 dirty files. SHA-256 comparison confirms 71
remain byte-identical. Only the two existing boundary tests below were extended
with exact offline catalog import allowances; Worker reachability restrictions
and November regression expectations remain effective. The relocated rule
implementations are byte-identical to their original HEAD files.

### Created by U3 (32)

- `docs/operations/GridView_Identity_Catalog_U3.md`
- `docs/operations/identity-seed-r0/manifest.json`
- `docs/operations/identity-seed-r0/parity.json`
- `docs/operations/identity-seed-r0/seed.json`
- `services/edge-api/scripts/identity/artifacts.ts`
- `services/edge-api/scripts/identity/compile-schemas.mjs`
- `services/edge-api/scripts/identity/corpus.d.mts`
- `services/edge-api/scripts/identity/corpus.mjs`
- `services/edge-api/scripts/identity/seed.mjs`
- `services/edge-api/scripts/lib/driver-entry-rules.d.mts`
- `services/edge-api/scripts/lib/provider-mapping-rules.d.mts`
- `services/edge-api/src/identity/catalog/content-schemas.cjs`
- `services/edge-api/src/identity/catalog/content-schemas.d.cts`
- `services/edge-api/src/identity/catalog/export.ts`
- `services/edge-api/src/identity/catalog/indexes.ts`
- `services/edge-api/src/identity/catalog/model.ts`
- `services/edge-api/src/identity/catalog/rules/driver-entry-rules.d.mts`
- `services/edge-api/src/identity/catalog/rules/driver-entry-rules.mjs`
- `services/edge-api/src/identity/catalog/rules/provider-mapping-rules.d.mts`
- `services/edge-api/src/identity/catalog/rules/provider-mapping-rules.mjs`
- `services/edge-api/src/identity/catalog/seed.ts`
- `services/edge-api/src/identity/catalog/snapshot.ts`
- `services/edge-api/src/identity/catalog/source-spec.json`
- `services/edge-api/src/identity/catalog/sources.ts`
- `services/edge-api/src/identity/catalog/storage.ts`
- `services/edge-api/src/identity/catalog/validate.ts`
- `services/edge-api/test/identity/catalog/parity.test.ts`
- `services/edge-api/test/identity/catalog/seed-local-worker.ts`
- `services/edge-api/test/identity/catalog/seed-local.test.mjs`
- `services/edge-api/test/identity/catalog/seed-storage.test.ts`
- `services/edge-api/test/identity/catalog/seed.test.ts`
- `services/edge-api/test/identity/catalog/validation.test.ts`

### Modified by U3 (5)

- `services/edge-api/.prettierignore`
- `services/edge-api/scripts/lib/driver-entry-rules.mjs`
- `services/edge-api/scripts/lib/provider-mapping-rules.mjs`
- `services/edge-api/test/providers/mappings/mapping-containment.test.ts`
- `services/edge-api/test/providers/provider-neutrality.test.ts`

### Prior uncommitted files (73)

An asterisk marks a prior file also extended by U3. All others are byte-identical
to the pre-U3 snapshot.

- `content/seasons/2026/provider-evidence.development.json`
- `docs/adr/0009-protected-staging-administration-token.md`
- `docs/adr/0020-provider-source-observation-and-reconciliation.md`
- `docs/adr/0022-curated-provider-identifier-mappings.md`
- `docs/adr/0023-multi-source-provider-coordination.md`
- `docs/adr/0024-deep-normalized-contract-validation.md`
- `docs/adr/0025-season-publication-authority-and-rollback-republication.md`
- `docs/adr/0026-season-participation-semantics-and-derivation.md`
- `docs/adr/0028-automatic-end-to-end-season-updates.md`
- `docs/adr/README.md`
- `docs/operations/GridView_Provider_Mapping_Guide.md`
- `docs/technical/GridView_Backend_Scheme.md`
- `docs/technical/GridView_Environments.md`
- `docs/technical/GridView_Implementation_Plan.md`
- `services/edge-api/package-lock.json`
- `services/edge-api/package.json`
- `services/edge-api/src/admin/router.ts`
- `services/edge-api/src/config/environment.ts`
- `services/edge-api/src/index.ts`
- `services/edge-api/src/logging/logger.ts`
- `services/edge-api/src/providers/jolpica/calendar-port.ts`
- `services/edge-api/src/providers/jolpica/circuits-port.ts`
- `services/edge-api/src/providers/jolpica/participants-port.ts`
- `services/edge-api/src/providers/jolpica/results-port.ts`
- `services/edge-api/src/providers/jolpica/standings-port.ts`
- `services/edge-api/src/sync/coordinated/composition.ts`
- `services/edge-api/src/sync/coordinated/run.ts`
- `services/edge-api/test/providers/coordination/coordination-containment.test.ts`
- `services/edge-api/test/providers/mappings/circuit-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/constructor-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/driver-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/mapping-acknowledgement.test.ts`
- `services/edge-api/test/providers/mappings/mapping-containment.test.ts` *
- `services/edge-api/test/providers/provider-neutrality.test.ts` *
- `services/edge-api/test/sync/coordinated/entry-points/proxy-transport.test.ts`
- `docs/adr/0029-persistent-identity-discovery-and-reviewed-runtime-catalog.md`
- `docs/adr/0030-provider-driver-inventory-and-required-identity-closure.md`
- `docs/adr/0031-identity-review-authority-and-catalog-cutover.md`
- `docs/operations/2026-11-12-jolpica-mapping-investigation.md`
- `docs/operations/GridView_Identity_Discovery_U2.md`
- `docs/technical/GridView_Identity_Management_Design.md`
- `services/edge-api/src/admin/identity-routes.ts`
- `services/edge-api/src/identity/client.ts`
- `services/edge-api/src/identity/discovery/boundary.ts`
- `services/edge-api/src/identity/discovery/collector.ts`
- `services/edge-api/src/identity/discovery/extract-jolpica.ts`
- `services/edge-api/src/identity/discovery/keys.ts`
- `services/edge-api/src/identity/discovery/model.ts`
- `services/edge-api/src/identity/discovery/persist.ts`
- `services/edge-api/src/identity/durable-object.ts`
- `services/edge-api/src/identity/factory.ts`
- `services/edge-api/src/identity/local.ts`
- `services/edge-api/src/identity/port.ts`
- `services/edge-api/src/identity/response-decoders.ts`
- `services/edge-api/src/identity/schema.ts`
- `services/edge-api/src/identity/store.ts`
- `services/edge-api/src/identity/wire-decoders.ts`
- `services/edge-api/test/identity/catalog/admin.test.ts`
- `services/edge-api/test/identity/catalog/boundaries.test.ts`
- `services/edge-api/test/identity/catalog/local-persistence.test.mjs`
- `services/edge-api/test/identity/catalog/local-worker.ts`
- `services/edge-api/test/identity/catalog/retention.test.ts`
- `services/edge-api/test/identity/catalog/sqlite-support.ts`
- `services/edge-api/test/identity/catalog/store.test.ts`
- `services/edge-api/test/identity/discovery/boundaries.test.ts`
- `services/edge-api/test/identity/discovery/collector.test.ts`
- `services/edge-api/test/identity/discovery/extractor.test.ts`
- `services/edge-api/test/identity/discovery/keys.test.ts`
- `services/edge-api/test/identity/discovery/parity.test.ts`
- `services/edge-api/test/identity/discovery/shadow.test.ts`
- `services/edge-api/test/identity/discovery/support.ts`
- `services/edge-api/test/identity/discovery/sync-shadow.test.ts`
- `services/edge-api/wrangler.identity-local.toml`

## U3 corrective follow-up (2026-11-14)

The original implementation and validation record above is preserved as history.
The unactivated R0 projection and derived integrity hashes were subsequently
corrected under separate authorization. See the [corrective addendum](GridView_Identity_Catalog_U4_Preflight.md#corrective-addendum-u3-season-projection-integrity-2026-11-14)
for the current hashes, exact file inventory, regression evidence and technical
preflight disposition. Dataset `2026.10.07.1`, canonical identities, mappings
and source provenance remain unchanged. U4 has not resumed.
