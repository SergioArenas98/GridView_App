# U4: immutable review, revisions and atomic activation

Implementation date: 2026-11-14. Scope: U4 only, locally implemented and
validated. U5 and all subsequent units remain unauthorized. No deployed
environment was changed and no catalog was activated outside isolated tests.

## Corrected R0 preflight

The complete corrective addendum in
[the preflight report](GridView_Identity_Catalog_U4_Preflight.md) was reviewed.
Before implementation, the offline generator reproduced seed, manifest and
parity bytes from the actual current repository sources. The corrected seed
validator, source-byte/provenance validation, parity, projection, export/import
and SQLite seed tests passed: **73 tests in six files**, zero skips or timeouts
(20.72 seconds). The generated-schema freshness check also passed.

| Preserved value                                                    | Result                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Drivers / constructors / circuits / events                         | 33 / 11 / 24 / 23                                                         |
| Verified mappings / evidence records / unresolved acknowledgements | 94 / 101 / 7                                                              |
| Dataset label                                                      | `2026.10.07.1`                                                            |
| Season projection                                                  | `sha256:ab953da8b44e80f7d9bc87fd948a32b0c67785eaa15c4d50348f0a4f8b7cc746` |
| Catalog content                                                    | `sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851` |
| Exact seed.json file hash                                          | `6abc3830314c2c08fad2c3577141ca548b0b7e3a2109d7acf66e3c85448edab7`        |
| Exact manifest.json file hash                                      | `bdbaeb3792056c9d7a4e4e81633b2ce66dc7f458f55642994999de9e3bcd1fe1`        |
| Exact parity.json file hash                                        | `372b67eaa9ca1b8043ee1604e80961beb66274b9c95e70a40b165ec63b6d6f46`        |

Repeated final generation preserved these bytes. The old projection and old R0
package remain incompatible with the corrected validator; no fallback was
introduced. The four November Jolpica keys and three OpenF1 acknowledgements
remain unresolved. Technical parity does not independently approve historical
real-world claims or grant deployment/activation authority.

## Worktree and preservation

All work used `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. No reset, staging, commit, push,
merge, or UI-redesign worktree modification occurred.

[The resume baseline](identity-u4-resume-baseline.json) records 1,405 existing
tracked/nonignored files with SHA-256 hashes and all 113 pre-existing expanded
dirty paths, before implementation or artifact generation. It preserves the
earlier investigation, U0-U3 work, original U4 preflight inventory and U3
corrective inventory as separate history. Ignored dependencies and transient
local test directories are outside this inventory.

Only six pre-existing files were extended by U4. No pre-existing file is
missing; the other 1,399 files retain their exact bytes. In particular, all
actual content sources, source mappings, corrected R0 artifacts, previous
reports, Android configuration, dependencies, deployment configuration,
provider ports, synchronization and publication implementation are preserved.
[The final preservation comparison](identity-u4-preservation.json) lists every
U4 addition and each before/after hash for the six extensions.

## Review and revision state machines

`IdentityReviewPort` is the typed internal contract; `CatalogWorkflow` implements
it over the existing installation-scoped SQLite storage. The isolated test
host extends U2's `IdentityCatalog` and uses its same storage. Production's
Worker graph has no catalog mechanism dependency, as the unchanged U3 parity
guard verifies. U4 adds no production HTTP route or CLI. The shared storage
accounting helper only counts optional stored bytes; it selects no identities.

The test-only capability issuer is outside production source. A WeakMap binds
opaque issued capabilities to logical principals and roles; a body-shaped
principal has no authority. The mechanism fails closed without an injected
authority, requires the requested role and an explicit isolated-test authority,
and stores server-assigned time, principal and credential attribution. The
honest authentication marker is `test-logical-principal`, not a claim that U5
individual credentials already exist.

An unresolved candidate can receive an immutable binding/new-driver approval,
rejection or quarantine. Approval writes a decision and complete proposal and
moves the candidate to `approved-pending`; it does not change the active head.
Explicit reopening of rejected/quarantined/archived candidates checks versions,
records a new decision and advances review/notification generations. Resolved
candidates require a correction request rather than an ordinary disposition.
Rejection never creates a mapping or makes a required provider row acceptable.

Binding/new-driver requests name the complete exact typed key and explicit
canonical target. Every approval requires supporting immutable dossier evidence
and rationale. New profiles are closed normalized driver profiles with bounds;
new IDs require explicit ID review, exact parent catalog hash, the complete
canonical ID list, evidence and duplicate-review attestation. Same-name creation
requires a distinction rationale. No name matcher, provider-slug ID generator,
inferred alias or cross-season inheritance is implemented.

Review dossiers retain closed claims, bounded references and exact supporting
observation/repository closure. Citations are credential-free HTTPS without
query or fragment and are never fetched. Synthetic/controlled provenance cannot
be relabeled by setting the dossier's synthetic flag to false. Referenced
observation/material evidence is protected from U2 retention. Historical seed
provenance and unavailable historical reviewers remain unchanged.

Proposals contain complete snapshots, a parent ID/hash, sequence, provenance,
decisions, evidence, canonical profiles/bindings, season projections and reserved
dataset labels. Mutable status is separate: `proposed`, `validated`,
`activated`, `abandoned`, `stale`. Only the singleton head denotes currentness;
previously activated revisions remain historically activated.

Every child snapshot is deterministically rebuilt from its immutable activated
parent and reviewed decision, then compared in full. This rejects deletion,
retargeting, merging, omitted required members, evidence replacement, sealed-base
changes, duplicate keys and unknown fields, including tampering accompanied by
a recomputed content hash. Profile updates add a version under the same anchor.
Canonical-ID reservations remain permanent after abandonment. Unactivated key
reservations may be released; immutable decisions, exports, status/audit history
and dataset reservations remain.

## SQLite schema and migrations

The existing U2 version-1 tables and installation metadata are preserved. U4
adds its own ordered `identity_catalog_migrations` ledger, version 1, recording
the SHA-256 of the canonical migration statement array:
`sha256:60be003373ecca8f2d92bf29aa089b29f177f8e2d295e8de41c62edfc7424e07`.
Unknown versions or changed migration hashes refuse service. Migration DDL and
its receipt use one synchronous transaction; no reset or destructive upgrade is
used. Restart can safely finish singleton-head initialization after migration.

The eighteen `identity_catalog_*` data tables are `head`, `origin`, `decisions`,
`dossiers`, `revisions`, `statuses`, `certificates`, `operations`, `audit`,
`anchors`, `keys`, `labels`, `seasons`, `drivers`, `bindings`, `evidence`,
`corrections` and `correction_events`. Foreign keys and unique constraints cover
revision parents, revision indexes, exact-key reservations, canonical anchors,
operation scope and season/date/suffix labels. Remaining cross-record rules are
checked within the authoritative transaction. There are no cascading deletes.

Closed decoders and complete rebuild/hash/index comparisons validate stored
revisions and certificates. Operations retain canonical request bytes and their
hash, response bytes/hash and outcome. Keys are unique per installation;
operation IDs are scoped by principal and operation family. Same ID/different
content conflicts; matching retry returns the original durable response.

Admission checks enforce 4,096 revisions, 16,384 decision/audit operations,
10,000 drivers, 100,000 bindings, 2 MiB snapshots, 2 MiB self-contained revision
exports and the 256 MiB logical budget. SQL byte aggregation avoids loading the
entire history for accounting. Discovery and reviewed writes share accounting;
no history is evicted to admit another write. Physical SQLite page/index usage
still needs operational measurement before deployment.

## Certificates and activation guarantees

Validation checks full root-source closure or complete parent delta, normalized
profiles, the complete existing `ProviderMappingRegistry`, exact keys/targets,
duplicates, evidence coverage/provenance, append-only invariants, projection and
dataset relationships, indexes, schema compatibility, capacity, candidate
versions and evidence freshness. Invalid semantic proposals receive invalid
certificates; malformed/unsupported storage shapes are refused outright.

Certificates bind revision content and the entire proposal-envelope hash,
parent ID/hash, `gridview-identity-validator/u4.1`, candidate versions/evidence
heads, exact reviewed evidence state, report hash, actor and validation time.
Material changes cannot reuse a certificate. A second validation does not
rewrite the proposal or its earlier certificate.

Activation is an explicit separate operation. Expensive pure verification and
hashing occur before the synchronous write transaction. Inside that transaction
the mechanism checks the expected head/sequence, exact persisted proposal and
certificate, status, evidence/candidate freshness, reservation constraints and
snapshot indexes; changes the head; preserves the one-way runtime-only/legacy
admission flags; records the activated status, keys and season relationships;
resolves associated candidates; and writes the audit event and operation
receipt. Any exception rolls back every write.

Competing proposals may coexist. Unique label planning uses CAS and bounded
retry of reservation planning against the same reviewed head, without merging
or rebasing reviewer intent. Exactly one activation against that head wins. A
loser records `CATALOG_HEAD_CONFLICT` and durable stale status. Activated history
is never rewritten as stale. An uncertain response is recovered with its
original operation ID, including after restart.

Activation has no provider, synchronization, reconciliation, operator-hold,
publication or public-data dependency. It cannot clear an existing hold or
publish a snapshot. The legacy-admission bit is recorded only; U4 connects no
batch admission consumer.

## Dataset versions, corrections and export recovery

`projectSeasons` calls the corrected U3 `hashSeasonProjection` helper. There is
no second effective-content algorithm. Evidence/provenance changes remain
covered by full catalog integrity but excluded from season projections. Dossier
creation and review dispositions create no public content version. Effective
profile or exact binding changes update the affected projections.

R0 reserves `2026.10.07.1` first. Later affected seasons reserve server-UTC
`YYYY.MM.DD.N` labels with monotonically increasing suffixes, unique per season.
Unaffected seasons retain labels. Tests cover concurrent reservations, retained
abandoned suffixes, clock regression, binding/profile changes and season
isolation. The synthetic local examples allocate `2026.11.14.1`, then
`2026.11.14.2`; evidence alone allocates neither. No source metadata was edited.

Correction records name existing identities, bindings, revisions and seasons,
suspected published-version assertions, evidence and rationale. A reviewed
correction request and separately idempotent report retain their attribution.
Status events append with an expected previous-event CAS. Reporting pauses new
identity admission in the internal head; it does not alter existing operational
holds. No merge, historical rewrite, retarget, force-publication or backward
head operation exists. Published references remain assertions for future
incident review against publication authority.

Each bounded revision export contains the exact seed sources, complete current
snapshot/evidence, immutable decisions and parent-header lineage. The offline
`verifyRevisionExport` rebuilds that lineage and checks every resulting catalog
hash before returning a verified immutable revision. This is offline integrity
verification, not an external authenticity signature or an administrative
database-restore command.

## Test and validation evidence

Final full-suite result: **6,054 passed, six existing opt-in skips, zero failures
or timeouts**; 288 files passed and three skipped (291 total), 510.60 seconds.
This includes all 25 U4 cases, U1-U3 identity behavior, corrected projection/R0
integrity and export/import, mapping/Jolpica normalization, D14-D16 guards and
publication-authority regressions. The final concurrency test additionally
requires both competing same-candidate reviews to have valid dossiers and
asserts rejection specifically at the candidate/evidence CAS.

| Required check                                                      | Final result                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Corrected R0 preflight                                              | 73 passed; exact expected semantic and artifact hashes                          |
| Focused U4 lifecycle, certificates, races, abandonment and recovery | Passed; 25 cases covered by the full suite                                      |
| Corrected projection, U1-U3, mappings and normalization             | Passed in the complete suite                                                    |
| Real persisted SQLite DO migration, interruption and restart        | Both U4 tests passed; prior U2/U3 local tests also passed                       |
| D14-D16 and publication authority                                   | Passed in the complete suite; production code unchanged                         |
| Type checking, ESLint and package formatting                        | Passed                                                                          |
| Content validation                                                  | 18 checks, zero failures                                                        |
| OpenAPI and API fixtures                                            | Valid; 32 fixtures checked, zero failures (one existing tolerance-only fixture) |
| Generated identity schemas                                          | Fresh; `compile-schemas.mjs --check` passed                                     |
| Repeated R0 generation/source-byte verification                     | Identical artifacts; all ten manifest source hashes match                       |
| Operational document/inventory formatting                           | Passed                                                                          |
| Preservation and whitespace                                         | No missing files; six U4 extensions; `git diff --check` passed                  |

The six skips remain in
`test/e2e/automatic-updates/{staging-first-run-rehearsal,controlled-source-export,app-gate}.test.ts`.
They require separately enabled capture/export/Flutter workflows; their guards
remain unchanged and were not enabled. No validation failure or timeout remains.

Commands run from `services/edge-api`:

```text
npx vitest run test/identity/catalog/seed.test.ts test/identity/catalog/validation.test.ts test/identity/catalog/parity.test.ts test/identity/catalog/projection.test.ts test/identity/catalog/seed-storage.test.ts test/identity/catalog/seed-local.test.mjs --maxWorkers=1 --testTimeout=30000
npx vitest run test/identity --maxWorkers=1 --testTimeout=30000
npx vitest run test/identity/catalog/u4- test/identity/catalog/parity.test.ts --maxWorkers=1 --testTimeout=30000
npm test -- --maxWorkers=1 --testTimeout=30000
npm run typecheck
npm run lint
npm run format
npm run validate:content
npm run validate:openapi
npm run validate:fixtures
node scripts/identity/compile-schemas.mjs --check
node scripts/identity/seed.mjs --out ../../docs/operations/identity-seed-r0
git diff --check
```

The focused U4/parity run passed 34 tests in eight files (98.97 seconds), zero
skips/timeouts. Three additional capacity, receipt-integrity and exact correction
reference cases were then added and included in final validation. Tests use offline fixtures and throwing
network transports. U4's test-only HTTP adapter is compiled exclusively into a
local Miniflare/workerd test bundle, never the production Worker.

The real local SQLite tests migrate an existing U2 candidate, activate only
synthetic/local R0 revisions, persist a reviewed proposal, discard an activation
response, dispose the runtime, reopen the same SQLite directory and recover the
exact receipt, head, candidate and export. A separate real-DO test interrupts
activation, confirms no head/receipt, restarts and retries the same operation.
No test or application deadline was increased.

Deterministic fault-injecting SQLite hosts test all seven activation writes,
including audit/receipt failures, and every catalog migration statement. A
separate deterministic reservation storage double tests pure effective-content
semantics. Complete state dumps remain identical after failed transactions;
successful retries activate once. Other cases cover same-candidate reviews,
different canonical targets, competing canonical-ID creation, competing
proposals/activations, stale material evidence, repeated nonmaterial sightings,
abandonment, immutable old profiles, unsafe references, corrupt certificates,
recomputed-hash tampering, unknown schemas and response/request corruption.

Development failures were corrected and are not omitted: the initial seven
lifecycle cases failed because a fixture passed branded in-process observations
to the wire decoder and the migration digest used compact JSON; the fixture now
serializes the wire form and the digest uses the existing canonical helper. One
new invalid-schema test initially expected a certificate instead of outright
closed-schema refusal; its expectation now verifies that refusal. The first
broad identity run had 230 passes and one production-dependency-guard failure
(124.16 seconds). The accounting import was moved outside `catalog/`; the
unchanged guard then passed. A literal wildcard Vitest filter found no tests
(exit 1); the supported `u4-` path filter replaced it. Initial type/lint errors
and shell quoting/format-command syntax errors were corrected. Existing test
assertions, resource contracts and deadlines were not weakened.

The first full-suite attempt had 6,052 passes, one mapping-import-containment
failure and six existing skips, across 287 passing files, one failing file and
three skipped files (655.36 seconds). U4's utility imports were moved behind
the existing identity ownership modules; no allowlist or assertion was changed.
The mapping containment and production graph retest passed 37 tests in two
files (7.69 seconds). Final review also tightened correction binding references
to compare exact binding IDs, rather than treating any matching hash in a
binding body as membership. The subsequent lifecycle/validation run passed 13
tests in two files (91.43 seconds), including that negative case. The complete
suite was then rerun against the final implementation.

The strengthened valid-dossier concurrency rerun passed all five cases in
23.73 seconds after the complete suite. The losing same-candidate review is
asserted to fail specifically with `candidate-evidence-conflict`, rather than
being rejected for insufficient evidence. Final type, lint, formatting and
preservation checks were repeated without any application-code change.

Node emitted its existing experimental SQLite warning. No test timeout or
opt-in staging/capture workflow was enabled or relaxed. No dependency was
updated in response to tool update notices.

## Complete U4 file inventory

Modified pre-existing files:

- `services/edge-api/src/identity/catalog/model.ts`: admit immutable reviewed
  driver versions and reviewed binding provenance; seed bytes/validator remain
  exact.
- `services/edge-api/src/identity/port.ts`: candidate latest-decision references
  also admit reviewed UUID decisions.
- `services/edge-api/src/identity/response-decoders.ts`: validate those UUIDs
  while retaining legacy hash references.
- `services/edge-api/src/identity/store.ts`: include optional reviewed-storage
  bytes in the shared installation budget.
- `services/edge-api/src/identity/discovery/keys.ts`: expose the existing exact
  key serializer through the approved identity utility owner.
- `services/edge-api/src/identity/catalog/indexes.ts`: own complete reviewed
  registry construction with the existing strict registry builder, keeping the
  original mapping import-containment assertions intact.

New source files under `services/edge-api/src/identity/`:

- `storage-accounting.ts`
- `catalog/activation.ts`
- `catalog/correction.ts`
- `catalog/correction-store.ts`
- `catalog/dataset-version.ts`
- `catalog/evidence-store.ts`
- `catalog/port.ts`
- `catalog/repository.ts`
- `catalog/review.ts`
- `catalog/revision.ts`
- `catalog/revision-export.ts`
- `catalog/revision-store.ts`
- `catalog/schema.ts`
- `catalog/workflow.ts`

New tests/support under `services/edge-api/test/identity/catalog/`:

- `u4-authority.ts`
- `u4-concurrency.test.ts`
- `u4-dataset.test.ts`
- `u4-export.test.ts`
- `u4-lifecycle.test.ts`
- `u4-local-worker.ts`
- `u4-local.test.mjs`
- `u4-support.ts`
- `u4-transactions.test.ts`
- `u4-validation.test.ts`

New operational documents under `docs/operations/`:

- `identity-u4-resume-baseline.json`
- `identity-u4-preservation.json`
- `GridView_Identity_Catalog_U4.md`

## Remaining dependencies and U5 gates

The implementation proves local state-machine and recovery behavior, not the
truth of a person's identity, deployment readiness or operational capacity at
the accepted maximum. Human duplicate-review mistakes remain possible. Physical
SQLite usage, large-catalog latency, independently controlled export custody and
environment-specific restore drills remain operational rollout gates. The
bounded self-contained export may become the first admission limit as decision
lineage grows; admission refuses rather than truncates history.

Before U5, require separate product-owner authorization; retain successful U4
acceptance; provision no credentials under this unit; assign named primary and
backup reviewer, activator and recovery/export responsibilities; implement and
test individual authentication/role derivation, rotation/revocation, shared-token
mutation refusal, bounded closed administrative requests and reviewable CLI
operations. Connect those future surfaces through the typed port without
exposing test capabilities or inventing historical attribution. Corrected R0
parity is mandatory before any future import gate.

U6 runtime pinning, U7 batch-v2 integration, inventory-policy changes,
operational synchronization/publication, notifications, Cloudflare/Webdock
operations and staging/production deployment have not begun. Those require
their own unit and environment approvals. Existing D14-D16 and publication
authority protections remain authoritative. Stop after local U4 validation.
