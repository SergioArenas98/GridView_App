# U7: catalog-aware offline batches and verified ingestion

Implementation date: 2026-11-15. Scope: U7 only, local synthetic implementation
and validation. No real identity approval, catalog activation, synchronization,
batch publication, deployed configuration, credential, email, commit, push or
merge occurred. Synthetic publications below exist only inside isolated local
test storage. U8 and later units remain separately authorized work.

## Authority and preservation

This work follows technical design sections 9.2, 11, 12 and U7; ADRs 0029–0031;
the U3 corrected R0 provenance, U4 complete revision exports, U5 including its
corrective acceptance, U6 context/pin protocol, and the existing recorded-batch
and guarded-ingest contracts. PRD scope and implementation-plan gates remain.

The branch is `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. The index was empty before work.
[The pre-U7 inventory](identity-u7-baseline.json) records expanded Git status,
index, byte lengths and SHA-256 for all 1,490 tracked/nonignored existing files.
As in U6, this source inventory excludes ignored dependencies, runtime state,
tool caches and transient logs. It is not a pre-edit hash inventory of those
ignored files. No earlier source/report/artifact was deleted or reset; the
UI-redesign worktree was not accessed.

[The final preservation comparison](identity-u7-preservation.json) distinguishes
unchanged original files, deliberate U7 extensions, additions and missing paths.
Every original source-inventory path remains present: 1,464 byte-identical,
26 intentionally extended. The inventory includes earlier untracked U0–U6 work.
Previous reports, investigation, R0 files, all curated registries and mappings,
dependencies/lockfile, public schemas/fixtures, Flutter, Android/signing and
deployment configurations retain their pre-U7 bytes. Only ignored generated
local Worker types and test/tool runtime files were regenerated.

## Exact U7 file inventory

All service paths below are relative to `services/edge-api/`. Hashes and lengths
are in the preservation comparison; this list distinguishes U7 from pre-existing
uncommitted work in the same files.

New production/tool modules:

- `scripts/identity/catalog-file.ts`: bounded local export-byte verification.
- `src/identity/catalog/admin-export.ts`: shared exact U5 export spelling/hash.
- `src/identity/catalog/batch-admission.ts`: installation-scoped SQLite receipts.
- `src/ingest/catalog-admission.ts`: bounded namespace-only admission client.
- `src/ingest/catalog-reference.ts`: closed reference decoder and profile checks.

New test modules:

- `test/season-batch/catalog-v2.test.ts`.
- `test/ingest/catalog-v2.test.ts`.
- `test/identity/catalog/batch-local.test.mjs`.
- `test/identity/catalog/u7-local-worker.ts` (isolated host, never production).

Existing modules intentionally extended:

- `scripts/season-batch/cli.mjs`, `cli-guards.mjs`, `generate.ts`, `README.md`.
- `scripts/season-batch/submission.ts`, `submission-cli.mjs`, `submission-guards.mjs`.
- `scripts/season-batch/fixtures.ts`, `fixtures-cli.mjs`, `fixtures-guards.mjs`,
  `frozen-apk.mjs`.
- `src/admin/identity/reads.ts`: share U5 wrapper construction without changing
  its authentication, audit, returned structure or CLI bytes.
- `src/config/environment.ts`: optional installation-scoped v1 gate, unset in
  every committed environment.
- `src/identity/catalog/pin-contract.ts`: `season-batch` purpose.
- `src/identity/catalog/run-context.ts`: share complete verified lineage context
  construction with offline exports; offline contexts have no durable pin.
- `src/identity/durable-object.ts`: private namespace receipt endpoints.
- `src/identity/storage-accounting.ts`: account for retained batch receipts.
- `src/index.ts`: wire runtime context, existing lease and recovery authority.
- `src/ingest/batch-verification.ts`, `service.ts`, `submission.ts`.
- `src/publication/commands.ts`, `src/publication/sequenced/service.ts`: optional
  prepared-candidate receipt callback before candidate writes; failure uses the
  existing cancel/cleanup path. Existing guards/prepare/finalize still decide.
- `src/sync/coordinated/composition.ts`: refuse offline contexts without a pin
  as operational runtime contexts.
- `test/sync/coordinated/operator/operator.test.ts` and
  `test/sync/coordinated/ledger/dormancy.test.ts`: enumerate exactly the newly
  authorized ingest lease consumer; retain all other dependency exclusions.

Repository additions: this report, `identity-u7-baseline.json` and
`identity-u7-preservation.json`. Validation logs use distinct `identity-u7-*`
filenames; no previous unit's log is replaced.

## Private schema v2 and dispatch

Artifact and manifest retain the complete v1 payload and add precisely one
`identityCatalog` property. Their `schemaVersion` and the manifest generator's
version are exactly 2. Submission v2 embeds those two files and adds an explicit
v4 UUID `operationId`; its other fields and 2 MiB body bound remain unchanged.
The v1 decoder stays available. Unknown versions, mixed versions, extra fields,
missing members and artifact/manifest provenance disagreement are refused.
Existing canonical artifact size/digest, reviewed manifest digest, capture
digest, per-document digests and regeneration checks remain mandatory.

| Reference member                                           | Exact admitted representation                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `format`                                                   | `gridview-identity-catalog-ref/1`                                                                                                 |
| `installationId`, `revisionId`                             | Lower-case v4 UUID, existing identity UUID grammar                                                                                |
| `catalogHash`, `seasonProjectionHash`, `baseContentDigest` | `sha256:` plus 64 lower-case hexadecimal characters, existing U3 hash representation                                              |
| `datasetVersion`                                           | String, at most 32 characters, `YYYY.MM.DD.<positive suffix>` grammar; complete lineage validates the actual allocation and value |
| `exportSha256`                                             | Exactly 64 lower-case hexadecimal characters; SHA-256 of exact U5 CLI file bytes                                                  |
| `inventoryPolicy`                                          | Closed `strict-v1` or reserved `optional-driver-inventory-v1` vocabulary; only `strict-v1` is operational in U7                   |

Season is bound by the existing artifact/manifest/submission season and the
validated season projection/pin, with runtime seasons limited by the existing
1950–2200 catalog protocol. No internal reference enters a public document,
OpenAPI v1 schema, fixture DTO, APK asset, Flutter model or Drift table.

## Verified local export semantics

The operator obtains a reviewed revision separately through U5's authenticated,
read-only `identity export --revision ... --out ...` command. Generation never
invokes that command, contacts a namespace or reads provider/Cloudflare state.

Three distinct integrity values are deliberately retained:

1. U5 `exportHash` is `hashIdentityProjection` of the complete administrative
   wrapper **without** `exportHash`, with U3's `sha256:` prefix.
2. U4 revision/seed/lineage hashes prove the full self-contained reconstruction
   from exact R0 source bytes, typed mappings and reviewed immutable decisions.
3. V2 `exportSha256` is ordinary SHA-256 of the **exact UTF-8 local file**,
   including U5 CLI's final LF. It is neither value above.

The file must retain U5 CLI's two-space JSON spelling, outer property order,
canonical nested lineage order and final LF. BOMs, CRLF/reformatting, bare U4
lineage files, truncation, wrong installation/season, contradictory wrapper
members and oversized files fail before ports or artifacts exist. Keep the
original export; do not reserialize it to prepare a batch.

The reader bounds file bytes at 2 MiB, uses fatal UTF-8 decoding, validates the
closed wrapper and wrapper hash, compares duplicate revision/decision bodies,
validates referenced dossier closure and hashes, and reuses the complete U3/U4
revision verifier plus U6 context construction. It checks schema, full content
hash, sealed base, all profiles, full typed registry, projection and dataset.
Supported base content is still the U6 sealed base; unsupported base is refused,
never completed from Git defaults. Current attribution remains deployed policy.

Offline verification establishes the export's own complete lineage and bindings.
It cannot discover an activation that happened after the operator exported the
file without violating offline-only generation. A valid historical export may
still produce review material; new admission against a later active revision is
independently refused by the Worker. There is no invented age-based freshness
rule or hidden live-head lookup.

The Worker reproduces the exact U5 wrapper from its independently validated pin
and retained administrative import closure, then hashes U5 CLI's exact file
spelling. Thus even a newly re-anchored artifact and manifest that agree on a
forged file digest cannot authorize ingestion. No extra export-file field was
introduced in the submission. Extracting shared U5 wrapper construction preserves
the prior administration mechanism and bytes.

## Offline generation and fixture preparation

`season-batch:generate` accepts `--identity-mode runtime --installation-id <uuid>
--catalog-export <local-file>` alongside existing capture/output arguments.
Runtime has no bundled default. All five ports receive that one complete
context's registry, participant profiles, circuit profiles and event names;
assembly receives its metadata. Replay transport, unrecorded URL exceptions,
complete capture inventory and classifications remain unchanged.

Bundled/default generation remains v1 and needs no catalog. Compare retains
explicit bundled authority and cannot silently produce v2; supplying a runtime
export with compare is refused. No provider adapter, request plan or transport
was changed.

V2 submission preparation also requires the local export, installation and
stable operation UUID, validates the exact reviewed file digest, and runs the
Worker verifier locally. Fixture conversion and frozen preparation accept the
same private export/installation inputs. Public fixture files and the existing
frozen descriptor structure remain unchanged. Provenance stays in the private
reviewed artifact/manifest; the frozen build never copies it into assets.

## Guarded admission, identity integrity and publication

Existing Worker authentication, environment/provider-mode/season/attribution
gates and sequencer selection precede the request. Runtime requires its catalog
binding and the **existing** reconciliation season lease. After decoding it
acquires that lease, pins once using the operation ID and fence, verifies the
complete context, and compares every provenance member and the exact export
file digest. An invalid or unavailable catalog cannot create a public candidate.

Driver, constructor and circuit profiles are compared in full with the pinned
curated lookups after the approved Jolpica transformation: explicit `media:
null`. Known ID plus substituted name/facts/media is refused. Every submitted
inventory identity must also have an applicable exact season/source binding.
Events use the pinned event name, locator round and circuit resolution; the
normalizer's catalog-owned/null event fields are checked. Deep source validators
still enforce cross-resource references, classifications and standings; Worker
regeneration still compares every submitted document. These checks establish
normalized consistency, **not** which raw provider record produced a row.
Human review of complete recorded sources remains necessary.

Publication uses the same guarded publisher with the reviewed predecessor.
Lease, expiry, holds and durable blocks are checked before intent and again
after preparation. The prepared version is recorded before candidate writes;
failure cancels through the existing sequencer. D14–D16, historical guards,
source ordering, revisions, prepare CAS and finalize remain authoritative.
The catalog object has no publication port and never chooses a version.

## V1 compatibility and irreversible closure

Bundled authority may continue the approved reviewed v1 workflow. Archives
remain decodable. Runtime new v1 is refused as `runtime-batch-requires-u7` unless
all of the following are proven together:

- `IDENTITY_BATCH_V1_COMPATIBILITY_INSTALLATION_ID` exactly equals the explicit
  installation UUID. It is absent in committed configurations; U7 did not
  enable it in any deployed environment.
- The independently pinned full catalog content hash equals the exact corrected
  approved R0 `sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851`.
- Complete lineage validates; revision and activation sequence are exactly 1,
  and durable activated history contains only that root.
- U4's persisted `seedDigest` matches R0, `legacyV1AdmissionEnabled` is true and
  `hasRuntimeOnlyActivation` is false.
- Full normalized profile, metadata, source-review and publication verification
  also succeeds against that context.

U4 already supplies the minimal durable one-way compatibility state: its
activation transaction ORs `hasRuntimeOnlyActivation` and closes the legacy bit
when effective data changes. U7 consumes that state instead of adding another
catalog authority. A reviewed compensating profile can restore the R0 season
projection but cannot restore the gate. Missing/contradictory history fails
closed; present-head similarity never substitutes for history. No exception was
enabled outside isolated tests.

## Receipts, concurrency, stale submissions and uncertainty

An additive versioned SQLite migration adds `identity_batch_receipts` beside the
existing run pins. Each receipt binds the installation, operation, complete
canonical submission digest, legacy/v2 authority, admission time and pinned
export digest. Reacquired lease fences and the current opt-in configuration
cannot relabel an already committed logical operation. Rows use integrity hashes
and existing shared capacity accounting; no receipt eviction was introduced.

New operations must match the current active pin. Head changes during acquisition
or before durable admission refuse the operation. A pin acquired during a failed
attempt cannot later admit an old revision after activation. Once admitted, the
operation retains its old full context through activation/restart. Identical
complete receipts return the original result without a new pin/publication,
even during current catalog corruption. Conflicting operation-ID reuse fails.

Namespace calls retry the same request within the existing 2-second bounded
protocol. An admission committed behind a lost response is recovered by that
same ID. A publication whose terminal receipt persisted is returned exactly.
If completion persistence was lost after publication, a retained prepared version
is confirmed against the existing sequencer active/previous version and validated
private sidecar, then stored as an idempotent recovered result, without publishing
again. `recovered: true` marks this case; maintenance fields describe recovery's
own no-op, not invented success of the lost call's maintenance.

An intent with no recoverable prepared version, unreadable sidecar, or no retained
authoritative proof remains `batch-recovery-required`. It is not rebuilt or
republished automatically. Existing sequencer TTL/predecessor and receipt
inspection govern operator recovery. This fail-closed case must be included in
later operational recovery procedures. Ordinary stale batches must be regenerated
from a fresh explicit export and reviewed again, never relabeled.

## Real SQLite and restart evidence

`batch-local.test.mjs` builds only the isolated test host, launches workerd with
three SQLite Durable Object namespaces (catalog, existing ledger, existing
sequencer) plus isolated local snapshot KV, seeds/validates/activates a synthetic
catalog, and submits through the actual authenticated Worker ingest route.
The real guarded publisher commits a synthetic release. The harness disposes
workerd, reopens the same persistence directory and proves exact receipt replay
and conflicting reuse refusal. It asserts at least three actual `.sqlite`
files. Outbound service always throws. No production class/config was replaced.

The focused service suite additionally uses real SQLite transactions and the
real guarded sequencer publication service for forged profiles/provenance,
mid-batch activation, stale admission, lost completion, corrupt catalog replay,
and permanent v1 closure including a compensating R0-looking revision. Existing
U6 real workerd pin/head-race/restart and U5 persistence tests remain mandatory.

## Public/Flutter compatibility and strict policy

R0 v2 and bundled v1 generate equal public documents. Converted fixture files
contain no catalog reference fields. Existing public OpenAPI and fixtures remain
byte-identical, with 31 strict fixtures plus the one expected tolerance fixture.
The edge-api contract suites cover the Flutter-facing payloads; no Flutter SDK,
APK build, Drift migration or Android release action is part of this validation.
Application ID remains `com.sejuma.gridview` by unchanged project bytes.

The 94 mappings, 101 evidence identities and all seven unresolved acknowledgements
remain unchanged. November strict-mode incidents remain regression fixtures.
No optional unresolved inventory, required-reference closure, invented IDs,
alias/name matching, skipped rows, partial-resource publication or historical
classification rewrite was implemented.

## Validation results

Final validation completed successfully. No deadline, assertion, authentication
rule or guard was weakened. Tests remained local and used synthetic data.

| Check                                                   | Local result                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial focused generation/verifier tests               | 61 passed. Initial TDD load failed for the not-yet-created module; first sandbox launch hit `spawn EPERM`, then authorized local execution worked.                   |
| Broad identity/admin/batch/ingest/provider regression   | 2,447 passed, one failed. Sole failure: literal namespace URL triggered provider containment; client now follows the U6 constant URL convention, assertion retained. |
| Focused U7 generation/ingest/actual workerd persistence | 43 passed before the final additional fault cases.                                                                                                                   |
| TypeScript                                              | Passed after correcting test-clock typing.                                                                                                                           |
| ESLint                                                  | Passed after removing an unused import.                                                                                                                              |
| Prettier                                                | Passed after formatting only U7-touched files.                                                                                                                       |
| Content                                                 | 18 checked, zero failures; 94 mappings / 101 evidence / seven unresolved unchanged.                                                                                  |
| API fixtures                                            | 32 checked, zero failures; one existing expected-tolerance case.                                                                                                     |
| OpenAPI                                                 | Passed, source unchanged.                                                                                                                                            |
| Generated identity schemas                              | `compile-schemas.mjs --check` passed, generated bytes unchanged.                                                                                                     |
| Local Worker types                                      | Passed, Wrangler 4.112.0; metrics disabled, ignored local output only.                                                                                               |
| Full suite / final focused checks                       | 6,196 passed, six existing skips, zero failures/timeouts; final focused 62 passed.                                                                                   |
| Preservation / whitespace                               | Passed: 1,490 originals present; 1,464 identical, 26 deliberate extensions, zero missing; `git diff --check` passed.                                                 |

Intermediate fixture setup errors (using `set` on `FixedClock`, wrong predecessor
and a test genesis fingerprint) were corrected in test inputs. No production
guard or deadline was relaxed to accommodate them. Existing opt-in integration
skips remain separately reported; no remote integration gate was enabled.

The first complete run is retained in `identity-u7-full-first.log`: **6,186
passed, two failed, six existing skips**, 300 passed files / two failed / three
skipped (305 total), 655.20 seconds. Both failures were exact source-graph
inventories for the newly required existing lease consumer/resolver call. Their
allowlists now name only that U7 addition; runtime containment assertions and
lease semantics were not relaxed. This run preceded the final added fault tests
and final source verification; it is not represented as final acceptance.

The final focused command passed **62 tests across five files**, no failures,
timeouts or skips, in 107.23 seconds (`identity-u7-focused-final.log`). This
contains 51 U7-specific cases plus the eleven existing exact dependency-boundary
checks. The timeout case uses the existing production admission timeout rather
than shortening or enlarging it. Six full-suite skips remain the original
opt-ins in `app-gate.test.ts`, `controlled-source-export.test.ts` and
`staging-first-run-rehearsal.test.ts`; their app/capture/export controls were
checked unset, and no new skip was added.

The final complete command, `npm test -- --maxWorkers=1 --testTimeout=30000`,
exited 0 with **6,196 passed, six existing skips, zero failures and zero
timeouts**, 302 passed files / three skipped (305 total), **697.30 seconds**.
See [the final full log](identity-u7-full-final.log) and
[the final focused log](identity-u7-focused-final.log). The complete run includes
U1–U6 identity and administration, actual SQLite pin/restart and U5 API/CLI,
season-batch/fixture/submission, guarded ingest/source validation, mapping and
Jolpica adapters, reconciliation/lease/sequencer, D14–D16 and historical guards,
provider containment/network dormancy, public API and Flutter-facing contract
checks. It ran after final code changes. Subsequent edits only finalized this
report and its preservation artifact.

Final TypeScript, ESLint, Prettier and generated-schema freshness checks also
passed. `git diff --check` passed, branch/HEAD/index stayed unchanged and every
pre-existing expanded Git status entry remains present. Preservation has eleven
added source/document paths plus the comparison output itself, which is excluded
from its own hash inventory to avoid a recursive self-hash.

## Performance, capacity and operational prerequisites

Proof is local synthetic scale, not deployed latency/capacity certification.
The corrected R0 has 33 drivers, 11 constructors, 24 circuits, 23 events,
94 bindings and a 403,732-byte snapshot. Full export wrapper, lineage and profile
verification run before generation/admission. Local file remains capped at
2 MiB, submission at 2 MiB, and namespace response at the U6 4 MiB bound; existing
256 MiB shared logical catalog capacity includes new receipt rows. No limit was
enlarged and no history was evicted. Repeated admitted verification adds work;
near-limit catalogs and long-lived receipt retention need later capacity review.
The 107.23-second focused run and 697.30-second complete run include cold
compilation, fixture construction, full lineage checks and isolated workerd
startup/restart. They are wall-clock acceptance observations, not request latency
or production throughput measurements. No deployment CPU/latency claim is made.

Before any operational use, operators need named review/recovery ownership,
approved restricted export custody, the installation UUID, bound existing lease
and catalog namespaces, and a runtime-compatible build. Keep original U5 files
and reviewed submission bytes. Optional-driver policy and deployed v1 exception
remain off. The existing operator holds, recovery receipts and predecessor
inspection procedures remain necessary for unresolved intent/maintenance cases.

## Recommended U8 acceptance gates; no U8 work performed

Separately authorize U8 before provisioning, restore/cutover rehearsal or live
configuration. Require verified export custody and isolated restore, exact R0
parity and seven unresolved identities, explicit installation separation,
reviewer/backup/activator/recovery ownership, drained season leases and batch
operations, verified active revision/dataset readback, receipt/uncertainty
recovery, retention/cold-start capacity measurements and rollback-capable runtime
code. Recheck T21/T33/T35 and D14–D16 before any cutover. U9/U10 inventory,
U11 staging and production changes require their own authorization.

## Corrective addendum: canonical U5 export commitment (2026-11-15)

This addendum supersedes the raw-file `exportSha256` definition and file-spelling
requirements above. The original report remains historical evidence, including
its earlier validation results. This correction is U7 only; no U8 work,
deployment, remote operation, real identity approval or real publication occurred.

### Confirmed cause and authoritative contract

The original implementation verified U5's canonical wrapper hash, but then used
a new SHA-256 of local file bytes as the v2 reference. It reproduced that file
spelling on the Worker and tested formatting as authority. This was an
implementation interpretation error: the approved contract required the existing
U5 canonical commitment. U5 itself already provided the correct mechanism; no
replacement algorithm was necessary. Earlier passing tests embodied the same
incorrect interpretation and therefore did not establish acceptance of that
product-owner decision.

The corrected contract is exactly:

```text
identityCatalog.exportSha256 = verified U5 exportHash
```

The complete `sha256:<64 lower-case hex>` string is copied verbatim. U5 computes
`hashIdentityProjection(wrapperWithoutExportHash)`, which uses the existing
`canonicalJson` serialization and existing SHA-256 mechanism. The commitment
covers the full administrative wrapper: installation, revision, decisions,
review/import evidence and complete U4 lineage. Its own `exportHash` field is
excluded. Neither file bytes, pretty-printed JSON, the inner lineage alone nor
a second hash of the `exportHash` string defines the reference.

### Exact affected inventory and verification

All service paths are relative to `services/edge-api/`:

- `src/identity/catalog/admin-export.ts`: retain U5 wrapper construction and
  canonical `exportHash`; remove the competing file-spelling hash helpers.
- `scripts/identity/catalog-file.ts`: retain bounded fatal UTF-8/JSON parsing,
  closed wrapper and schema checks, independent canonical wrapper-hash
  verification, duplicate-body consistency, evidence closure and complete U4
  lineage verification. Copy the verified prefixed hash into the reference;
  remove file-spelling authority. Evidence checks now precede context creation.
- `src/ingest/catalog-reference.ts`: require the existing exact prefixed hash
  grammar for `exportSha256`; all other closed reference fields remain unchanged.
- `src/identity/catalog/batch-admission.ts`: reconstruct the same U5 wrapper
  from independently verified pinned lineage and retained import provenance;
  persist its canonical `exportHash` verbatim in the durable receipt. Receipt
  decoding requires that prefixed representation.
- `scripts/season-batch/submission.ts`: compare against the verified local
  wrapper commitment rather than hashing the export file bytes.
- `scripts/season-batch/README.md`: correct current operator instructions.
- `test/season-batch/catalog-v2.test.ts`: canonical equality, alternate JSON
  serialization, tampering, wrapper/lineage integrity, schema representation,
  deterministic generation, submission and fixture parity.
- `test/ingest/catalog-v2.test.ts`: well-formed forged canonical commitments,
  explicit rejection of obsolete raw digests and double hashes on guarded ingest.
- `test/identity/catalog/batch-local.test.mjs`: compact equivalent export,
  exact U5 commitment in both files, forged-commitment rejection through the
  authenticated Worker route, successful real SQLite ingest and restart replay.
- `docs/operations/GridView_Identity_Catalog_U7.md`: this appended correction.

Added files: `identity-u7-canonical-correction-baseline.json` and
`identity-u7-canonical-correction-preservation.json` in this operations directory.
Distinct `identity-u7-canonical-correction-*.log` files retain validation output.
No earlier report, inventory or log is overwritten.

Generation remains replay-only and never fetches a catalog. Semantically
identical valid JSON may use different whitespace, line endings, property order
or escapes without changing its canonical commitment. The 2 MiB file bound,
strict closed schemas, provenance and complete lineage remain mandatory; changed
content with an unchanged hash, forged hashes, contradictory wrappers or invalid
inner lineage still fail. Artifact/manifest file digests and reviewed manifest
integrity continue to hash their existing exact canonical artifact formats.

Worker acceptance still compares the submitted commitment against the value
derived independently from its authoritative pin, not agreement between two
client strings. Full installation/revision/catalog/projection/dataset/base,
mapping/profile validation and source/capture review remain active. No export
file or additional field is transmitted. The existing season lease, receipts,
uncertain-response recovery, stale-admission checks, sequencer, reconciliation,
D14–D16 and irreversible v1 closure are unchanged.

### Compatibility and preservation

Unreleased synthetic v2 artifacts made with the old raw digest must be regenerated
and re-reviewed, including dependent manifests/submissions and their digests.
Dependent frozen-fixture descriptors and review digests must also be regenerated;
their public DTO shapes remain unchanged.
Do not relabel them in place or reuse a conflicting operation ID. Old raw-digest
batch receipts fail closed under the corrected decoder; no automatic receipt
rewrite or storage reset is introduced. Use fresh isolated synthetic test state
for regenerated fixtures and retain old artifacts as historical evidence.

V1 archives and their compatibility gate are unchanged. Public snapshot schemas,
fixture DTOs, Flutter/Android, the R0 dataset/provenance, mappings and all seven
unresolved acknowledgements are unchanged. The original U7 was local-only and
this patch performs no deployment or remote state change; no deployed U7
protocol is assumed and no deployed data migration is required for this local
correction. This is not a fresh audit of external deployment state.

The baseline captures all tracked/nonignored Git files plus ignored operations
artifacts, including the three original U7 validation logs. Dependencies and
runtime caches are excluded. Final preservation checks compare byte lengths and
SHA-256, branch/HEAD/index and every pre-existing expanded Git-status entry. The
original report prefix is independently checked against its baseline byte hash;
only this addendum is appended.

### Corrective validation and acceptance

Before source corrections, the updated canonical tests failed as expected:
**five failed, seventeen passed**. One proved raw-digest inequality with U5;
four exposed the obsolete file-spelling refusal. The initial corrected generation
run then passed **22 tests**. These intermediate results are retained separately
from final acceptance: the red run is saved in the correction red log, and the
initial green run was observed in local tool output. No deadline, assertion or
lineage validation was weakened.

Final focused validation passed **116 tests across seven files**, no failures,
timeouts or skips, in **166.36 seconds**. It covers corrected offline generation,
guarded ingest, U5 administration API/CLI, U6 contexts/pins and real local SQLite
ingest/restart/replay. The actual authenticated Worker route refuses a forged
canonical commitment even when both reviewed files agree on it, then accepts the
valid compact-JSON export and recovers its identical result after workerd restart.

The final complete command, `npm test -- --maxWorkers=1 --testTimeout=30000`,
exited 0: **6,203 passed, six existing opt-in skips, zero failures and zero
timeouts**, 302 passed files / three skipped (305 total), **585.45 seconds**.
This includes all U1–U7 identity, batch, publication, D14–D16, reconciliation,
lease/sequencer, provider-containment and public/Flutter-facing regressions.
The app, controlled-export and capture opt-in controls were checked unset.

Typecheck, ESLint, Prettier, content validation (18 checked), fixture validation
(32 checked; the one existing expected-tolerance case retained), OpenAPI and
`compile-schemas.mjs --check` all passed. `git diff --check` passed. No new skip,
deadline increase, network opt-in or weakened identity/publication check was used.
No Cloudflare/Webdock operation or Worker configuration change was required.

Evidence:

- [Expected failing contract tests](identity-u7-canonical-correction-red.log).
- [Final focused validation](identity-u7-canonical-correction-focused.log).
- [Final complete suite](identity-u7-canonical-correction-full.log).
- [Pre-correction inventory](identity-u7-canonical-correction-baseline.json).
- [Preservation comparison](identity-u7-canonical-correction-preservation.json).

The preservation comparison covers **1,505 original files**, including earlier
operations artifacts: **1,495 byte-identical, ten intentional corrective
extensions, zero missing**. Branch, HEAD, index and all pre-existing Git-status
entries remain unchanged/present. The original report's first **26,579 bytes**
retain SHA-256 `7413dce45dc806744b8f93facaf7f5a0e6932336ba92df457a73c3b7134a1b5e`.
The comparison excludes its own output from recursive self-hashing. All earlier
inventories/logs and all canonical data, R0 provenance, mappings and unresolved
acknowledgements retain their original bytes.

**U7 acceptance now satisfies the explicitly approved canonical export contract.**
This is local synthetic proof, not a deployed activation or publication. The
corrected digest has no formatting dependency; the remaining compatibility risk
is accidental reuse of obsolete unreleased raw-digest artifacts/receipts, which
are refused and must be regenerated/re-reviewed as described above.

Remaining operational prerequisites from U7 still apply: explicit installation,
restricted export custody, reviewed capture, a complete active catalog and the
existing publication authority. An offline file cannot discover a subsequent
activation; the Worker remains responsible for authoritative freshness at new
admission. Optional-driver policy remains disabled. U8 requires separate
authorization and has not begun.
