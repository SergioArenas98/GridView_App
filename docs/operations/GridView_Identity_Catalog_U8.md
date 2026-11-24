# U8 — local migration, isolation, recovery and cutover rehearsal

Date: 2026-11-15. **U8 local acceptance complete, including the recovery-verifier correction.**
Earlier passing checks are retained as history; corrected acceptance is explicit below.
U8 authorizes local synthetic operations only.
U9/U10/U11, real curation, remote configuration/provisioning, live providers,
operational synchronization/publication and production remain unauthorized.

## Baseline and scope

Work is restricted to `Gridview-jolpica-proxy`, branch
`feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. Initial HEAD/branch matched and
the index was empty. [The new session inventory](identity-u8-session-baseline.json)
records expanded Git status, index and byte length/SHA-256 for all **1,505**
tracked/nonignored existing files. The earlier `identity-u8-baseline.json`
already existed and is preserved. No original report, artifact or log is
replaced. Ignored dependencies/runtime caches are outside this source inventory.

All new runtime inspection, fault and recovery hooks live exclusively under
`services/edge-api/test/identity/integration/`. The production Worker graph,
catalog state machine, public API, Flutter/Android, dependencies, real content,
provider transports/limits, reconciliation/publication implementation and
actual environment configuration are not changed by this rehearsal.

The governing documents were reviewed: design §§9–13/U8, ADRs 0029–0031,
U4, complete U5 including corrective acceptance, U6 and U7 including canonical
export correction; the existing environment, staging, publication,
reconciliation/operator and automatic-update recovery procedures. Historical
pending-unit statements are read with the owner's current explicit U8 approval.

## Mandatory R0 and U7 preflight

The offline generator reproduced all three artifacts into a newly created
temporary directory. Exact SHA-256 matches:

| Artifact        | SHA-256                                                            |
| --------------- | ------------------------------------------------------------------ |
| `seed.json`     | `6abc3830314c2c08fad2c3577141ca548b0b7e3a2109d7acf66e3c85448edab7` |
| `manifest.json` | `bdbaeb3792056c9d7a4e4e81633b2ce66dc7f458f55642994999de9e3bcd1fe1` |
| `parity.json`   | `372b67eaa9ca1b8043ee1604e80961beb66274b9c95e70a40b165ec63b6d6f46` |

Catalog hash:
`sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851`.
Season projection:
`sha256:ab953da8b44e80f7d9bc87fd948a32b0c67785eaa15c4d50348f0a4f8b7cc746`.
Dataset is `2026.10.07.1`; counts remain 33 drivers, 11 constructors,
24 circuits, 23 events, 94 mappings, 101 evidence records and seven unresolved
acknowledgements. Typed keys, genuine repository-import provenance and unknown
historical facts remain intact. No canonical identity is inferred from a slug.

Preflight command from `services/edge-api`:

```powershell
npm test -- test/identity/catalog/seed.test.ts test/identity/catalog/validation.test.ts test/identity/catalog/parity.test.ts test/identity/catalog/projection.test.ts test/identity/catalog/seed-storage.test.ts test/identity/catalog/seed-local.test.mjs test/season-batch/catalog-v2.test.ts --maxWorkers=1 --testTimeout=30000
```

Result: **95 passed in seven files**, zero failures/skips/timeouts, **66.06 s**.
Log: `services/edge-api/identity-u8-preflight-authorized.log`. Initial sandbox
startup failed before tests; authorized local execution passed. Standalone
regeneration also initially hit `spawn EPERM`, then passed with authorized
local subprocess access. No material seed inconsistency was found.

The corrected U7 contract is retained exactly:

```text
identityCatalog.exportSha256 = verified U5 exportHash
```

It includes `sha256:` and commits the canonical complete administrative wrapper,
excluding only its own hash. File formatting is not authority. New synthetic
batches are freshly generated/reviewed against that verified export; obsolete
raw-digest artifacts/receipts are neither relabeled nor rewritten.

## Local lifecycle and isolation design

The test Worker subclasses the actual SQLite `IdentityCatalog` solely to permit
explicit synthetic test evidence and finite inspection/fault hooks. U5's
individually authenticated administrative routes own seed, validation,
activation, exports and receipt recovery. U4's state machine is not bypassed.
The actual Worker guarded ingest, actual SQLite lease ledger and publication
sequencer are included in the restore/publication rehearsal. All outbound
Worker requests throw. Host HTTP is allowed only on loopback for Miniflare.
`cf:false` disables unrelated Miniflare CF metadata fetching.

Each installation uses a distinct UUID, `unsafeUniqueKey` local namespace,
temporary SQLite/KV directories and independently generated ephemeral test
authentication. Labels are staging, staging and production to test the
staging/E2E collision explicitly. These are local simulations; no real
namespace, credential or service is provisioned. Production-equivalent tests
turn off synthetic admission and must refuse synthetic decisions.

The three final controlled comparisons passed with zero unexplained semantic
differences: round-1 coverage made **7** requests and generated **101** documents;
round-2 made **8** requests and generated **102** documents; round-3 made **9**
requests and generated **103** documents. Within each case, all three modes
matched exactly, including limiter reservations and public snapshot content.
The independent isolation, held/drained transition, mid-run activation/outage,
forward-recovery and real SQLite restart/restore cases all passed.

Lifecycle phases cover empty installation/schema, reviewed R0 import, separate
validation/activation, complete readback/export verification, durable pin,
lost-response recovery and actual dispose/reopen against persisted SQLite.
R0's 101 source-evidence records and seven unresolved acknowledgements are
retained inside the exact immutable snapshot and origin. They are not fabricated
new U2 provider observations: discovery tables/counters initially remain empty.
Separate synthetic observations exercise the durable candidate/review backlog.
Wrong persisted installation, wrong object name/namespace, wrong export,
cross-credential/operation/batch submissions and reseeding populated state are
negative cases. Existing IDs and namespaces are not defaulted from ENVIRONMENT.

## Comparison and transition acceptance surface

The three deterministic complete comparison cases use synthetic classifications
through rounds 1, 2 and 3 with fixed clocks. Each compares bundled, diagnostic
compare and runtime R0 over the existing guarded Worker synchronization path.
Assertions cover exact request ordering/counts and limiter reservations;
effective bindings, canonical profiles, season projection/metadata; complete
ledger snapshots and generated public documents; and prepare/finalize counts.
The same resource/documents include calendar, circuits, participants, all
eligible classifications and both standings. Internal provenance envelopes
are intentionally excluded from effective-content equality.

Separate cases require diagnostic-only outage/disagreement, zero runtime
provider/publication admission on catalog outage, and unchanged public output.
The hold/drain exercise checks released leases, no publishing disposition,
sequencer transition state, preserved holds/blocks and unchanged snapshots
through runtime selection and parity-safe bundled recovery. It never releases
a hold or clears a durable block to manufacture publication. Fresh runtime
publication is exercised by the independent complete-run cases.

Mid-run synthetic profile activation and configuration changes must leave the
admitted run on its original context; the next run adopts the new revision and
dataset. Classification content and reconciliation acceptance must not reset.
The runtime-only bit closes new legacy-v1 admission permanently. Historical
activation replay recovers an old receipt without changing the active head;
a new backward-head request must fail. Compatible runtime code/schema and
append-only history remain necessary after runtime-dependent publication.

## Recovery artifact and restoration boundaries

U5 revision export is independently verified for canonical wrapper commitment,
complete U4 lineage, original sources/evidence/decisions, exact mappings/profiles
and dataset relationships. It is **not a complete operational database backup**:
run pins, activation/HTTP/batch receipts, operational audit, candidate backlog,
admission flags, leases, publication sequencer and KV state have other owners.

The allowed minimal test recovery helper copies a **stopped local persistence
tree** only into a different empty test-prefixed temporary directory. Its
manifest retains the verified revision export and complete file sizes/hashes,
installation/head/activation checkpoint. It checks file inventory and SQLite
integrity/schema/head before writing. No restore endpoint, SQL import API or
production recovery mechanism is added. Source directories and backups remain
isolated local artifacts; they are never deployed.

A cold-copy replay explicitly retains receipt-bound installation identity but
receives newly supplied test credentials; the old bearer must fail. It is a
quarantined duplicate for verification, not a second operational installation.
Readback must preserve exact authoritative tables, pins, batch receipt,
publication and public snapshot data. Separately, fresh-installation R0
reconstruction uses a new UUID/namespace/authentication and U5 seed/validate/
activate: effective semantics match but original receipts and authority are
not inherited. This distinction prevents revision-export integrity from being
misrepresented as general operational restoration.

[The corrected evidence index](identity-u8-evidence-final.json) records SHA-256/length and paths
for all ten final full-suite evidence groups, including the complete recovery
manifest's path/hash, checked active checkpoint and hash-identified cold backup
directory. The selected operational backup contains **131 files**. The full
manifest and stopped SQLite/KV tree remain local test evidence; neither is a
signed backup, approved long-term custody or a deployed restore facility.

The final restore case additionally activates a separately reviewed synthetic
profile revision before backup. The cold copy preserves two revisions, active
sequence 2, `hasRuntimeOnlyActivation: true`, the original R0 run pin and complete
batch receipt, while the previously published snapshot remains unchanged.
Both the original individual bearer and the original operational bearer are
refused by the restored test Worker. Fresh R0 reconstruction deliberately uses
the original root package; it does not relabel the synthetic child as R0.

Corrupt/incomplete/unsupported/wrong-installation/outdated artifacts, missing
provenance and unsafe paths are refused. No restore overwrites a nonempty
store. Cloudflare PITR is not executed or locally simulated as a platform
capability. A future approved operational backup/PITR procedure must reconcile
catalog, externally retained audit, immutable published references, sequencer,
ledger and KV before reopening admission. Worker code rollback cannot roll back
Durable Object schema/data.

## Failure, discovery and publication coverage

The new integration scenarios complement, rather than replace, U1–U7 tests.
The final validation must include these existing authoritative cases:

| Design scenarios           | Required retained evidence                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T17/T18                    | Runtime pre-admission outage/invalid state, real SQLite restart, migration interruption/unknown schema; context and pin tests                                          |
| T19/T20                    | U5 auth/API/CLI/recovery/roles; U4 proposal/activation races, transactional faults and dataset reservations                                                            |
| T21/T22                    | Corrected canonical U7 export/batch-v2 and v1 gates, stale/cross-installation/mid-batch activation, unchanged classification hashes                                    |
| T30/T31 strict equivalents | Actual guarded ingest/publication, missing round/driver fact/changed constructor, stale predecessor and concurrent wider/narrower candidates                           |
| T32                        | Three actual local SQLite namespaces/installations, staging/E2E sharing one environment label, cross-authority refusal                                                 |
| T33                        | Unmodified public v1 contract and separately reported available Flutter database/offline/contract tests                                                                |
| T34/T35                    | November strict 25-request synthetic regression and seven unresolved acknowledgements; provider containment/replay-only, public reads and no new operational authority |

Existing U5 tests recover uncertain before/after-commit namespace timeouts with
the original ID/receipt, including unknown/unavailable receipts. Existing U6
tests cover lost pin replies, one identical retry, cancellation/budget/lease
expiry while loading and outage after admission. U7 covers uncertain batch
completion/prepared receipts and lease release. No new operation ID is used
to recover an uncertain mutation. Ambiguity remains recovery-required.

U1/U2 tests retain invalid decoding, known/unknown keys, repeated observation,
storage failure, bounded collector overflow/loss metrics, notification-generation
deduplication and restart semantics. The U8 larger-history test additionally
measures real persisted pins/candidate/receipt/notification counts. No
exactly-once claim is made for unacknowledged observations. Email, scheduling,
Resend, Telegram and webhooks are absent.

## Measurements and limitations

Measurements come from this Windows local Node/Miniflare/workerd environment,
not staging/production. Per-run JSON evidence is retained under ignored
`services/edge-api/.wrangler/u8-evidence/`; the final reviewed summary records
selected artifacts and hashes. Temporary SQLite trees are retained for local
inspection. Source/profile changes are synthetic and test-only.

Initial successful R0 lifecycle sample: empty schema/health 324.76 ms, seed
import 1,819.02 ms, independent validation 3,693.60 ms, recovered pin 709.39 ms,
restart receipt 735.41 ms, workerd complete context 1,629 ms. Independent Node
export validation took 7,501.36 ms and complete local lineage/context
verification 5,707.60 ms. These different phases must not be summed as one
namespace latency. Restart workerd readiness was 3,656.26 ms in that sample.
Catalog-only conservative logical accounting was 4,438,204 bytes; the actual
SQLite catalog database reported 2,510,848 bytes. Physical metadata, WAL and KV
files are recorded separately, not equated to logical admission accounting.

Initial 43-case focused-run measurements (same policies, a less contended local
sample; the recovery-verifier correction and its separate measurements follow):

| Phase                                                                      | Milliseconds |
| -------------------------------------------------------------------------- | -----------: |
| Cold workerd readiness, including local bundle setup                       |       817.19 |
| Empty schema creation and administrative health                            |        54.63 |
| Reviewed R0 import                                                         |       638.90 |
| Independent administrative validation                                      |       495.37 |
| Pin/recovery request and response                                          |       367.22 |
| Independent export verification in Node                                    |       560.86 |
| Restart workerd readiness                                                  |       580.92 |
| Administrative activation-receipt read after restart                       |        23.52 |
| Complete context admission/verification inside workerd                     |       522.00 |
| Independent complete context verification in Node                          |       421.60 |
| Verified isolated cold-copy restoration, excluding subsequent Worker start |     1,051.00 |
| Independent new-installation R0 reconstruction                             |     1,756.61 |

The controlled larger history retains **32 pins and 64 synthetic observations**.
Pin minimum/mean/maximum were **282.46 / 342.71 / 408.31 ms**. Full shared logical
accounting grew from **4,434,890 to 4,822,713 bytes**; catalog/optional-operational
accounting alone grew from **4,433,866 to 4,513,730 bytes**. Catalog SQL database
size was **2,990,080 bytes**; individual SQLite/metadata/WAL/KV file sizes are in
the evidence. Repeated and restarted observations add no duplicate candidate,
material observation, notification generation or observation receipt. The
earlier larger-history sample measured 528.67–1,042.01 ms pins and is retained
separately; these are observations, not a latency guarantee.

This is R0-scale evidence plus a small synthetic operational history. It
does not certify 10,000 drivers, 100,000 mappings, 4,096 revisions, 16,384
decision/audit operations or 256 MiB logical occupancy. The tighter 2 MiB
snapshot/self-contained-export limit still wins. No capacity or timeout is
enlarged, and no immutable evidence is evicted to admit writes. Near-limit
operational measurement/custody remains a future deployment gate.

## Intermediate errors and final validation

All attempts are reported separately from final acceptance. Initial test
harness global-fetch refusal also blocked Miniflare host loopback, producing
two 30-second timeouts before that attempt was stopped. The revised guard
permits only host loopback while Worker outbound remains throwing.
New monolithic lifecycle scenarios then exceeded the unchanged 30-second test
budget. They were separated into explicit sequential integration phases, with
new setup hooks using the same 30-second resource-conscious limit; production
deadlines were unchanged. A host-bridged context call failed its two identical
pin attempts; the actual Worker policy is now exercised inside workerd without
adding a second host HTTP hop to the namespace deadline, while independent
Node lineage verification is measured separately. The actual Worker sample
passed in 1,629 ms. None of these failed attempts is represented as acceptance.

A subsequent complete U8 iteration had **28 passes and seven failures** in
537.76 s: two compare diagnostics timed out across the extra host/default-Worker
bridge, four aggregate integration cases exceeded 30 seconds, and the timed-out
capacity phase left its following observation fixture unset. The fixture now
uses Miniflare's actual namespace proxy for Node-driven synchronization and
bounded phases for history/restore checks; no production timer changed. The
next iteration had **40 passes and two failures** in 251.62 s. Both were harness
expectations/cleanup: Miniflare correctly returned HTTP 500 for a wrong persisted
installation instead of rejecting its host promise; the failed expectation had
left that fixture on its deliberately incorrect configuration. The test asserts
the actual refusal and always restores its local configuration in `finally`.
The independent expected reseed refusal then recovers its original 409.

Lint initially found 19 undefined Node-global references in the new non-test
`.mjs` helpers. Explicit Node imports fixed them; ESLint configuration and
assertions were not weakened. Local Wrangler type generation initially hit
sandbox `spawn EPERM`, then succeeded with authorized local subprocess access,
metrics disabled and a new ignored U8 output file. No prior generated type file
was overwritten. No dependency update was performed in response to CLI notices.

Intermediate logs: `identity-u8-preflight.log`,
`identity-u8-preflight-authorized.log`, `identity-u8-sqlite-first.log`,
`identity-u8-focused-second.log`, `identity-u8-harness-diagnostic.log`,
`identity-u8-harness-diagnostic-2.log`, `identity-u8-restart-third.log`,
`identity-u8-restart-phases.log`, `identity-u8-typecheck-first.log`,
`identity-u8-lint-first.log`, `identity-u8-focused-fourth.log`,
`identity-u8-lint-final.log`. Typecheck's initial run exited 0; the initial lint
run was interrupted and is not a pass. Some diagnostic commands printed their
results directly; retained log files are not claimed for those executions.

Initial focused command `npm test -- test/identity/integration --maxWorkers=1
--testTimeout=30000` exited 0: **43 passed in five files**, zero failures,
timeouts or skips, **86.89 s**. See
[the focused log](../../services/edge-api/identity-u8-focused-final.log).
It includes the strengthened two-revision restore/irreversible-flag case.

| Validation                          | Result                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, Worker and scripts      | Passed; `identity-u8-typecheck-final.log`                                                                                                   |
| ESLint                              | Passed; `identity-u8-lint-second.log`                                                                                                       |
| Whole edge-api Prettier check       | Passed                                                                                                                                      |
| Curated content                     | 18 checks, zero failures; 94/101/7 and original dataset preserved                                                                           |
| API fixtures                        | 32 checked, zero failures; original one tolerance-only fixture retained                                                                     |
| Generated identity-schema freshness | `node scripts/identity/compile-schemas.mjs --check` passed                                                                                  |
| OpenAPI                             | Passed, schema unchanged                                                                                                                    |
| Local configuration                 | Wrangler 4.112.0 generated `.wrangler/identity-u8-worker-configuration.d.ts`; actual configuration unchanged                                |
| U5 CLI command reference            | `node scripts/identity/cli.mjs --help` verified, no HTTP                                                                                    |
| External opt-ins                    | All seven app/capture/export controls checked unset                                                                                         |
| Initial full edge-api suite         | **6,246 passed, six existing skips, zero failures/timeouts**; 307 passed files / three skipped (310 total), **902.11 s**, exit 0            |
| Separate Flutter                    | **143 passed in ten files**, zero failures/skips, exit 0; pinned SDK 3.44.0, source/lockfile unchanged                                      |
| Final preservation / whitespace     | All **1,505** original files byte-identical, zero missing; branch/HEAD/index and prior expanded status entries preserved; diff check passed |

The full command was `npm test -- --maxWorkers=1 --testTimeout=30000`.
[The final full log](../../services/edge-api/identity-u8-full-final.log) includes
all U1–U7 identity/admin/security/role/batch/canonical-export regressions,
coordinated sync and verification, reconciliation/lease/sequencer and D14–D16
guards, provider transport/network containment, public API and all 43 new U8
cases. The six skips remain the original app/capture/export opt-ins in three
files; no new skip or deadline change was introduced. These counts overlap the
focused run and must not be added to it. This first full run preceded the
recovery-verifier correction below; its passing result did not establish backup
immutability and is superseded for U8 acceptance by the corrected full run.

The first Flutter `--no-pub` attempt could not start because this worktree had
no resolved package configuration. `flutter --no-version-check pub get --offline
--enforce-lockfile` then prepared the existing versions from the local cache.
The lockfile retained SHA-256
`291a2de40c4a343b437a42a296b4a596536218fe465a419d5e99aa3cabd18444`.
The separate final command used `flutter --no-version-check test --no-pub
--concurrency=1` with the seven database/repository/sync files from design T33
plus `mapping_test.dart`, `dto_parsing_test.dart` and `api_failure_test.dart`.
[The Flutter result summary](../../services/edge-api/identity-u8-flutter-result.log)
records the exact command and the 143-pass result. Existing Drift multiple-
database debug warnings appeared during deliberate on-disk reopen cases and
were not suppressed. There was no UI-redesign access or Flutter/Android edit.

## Exact U8 inventory, preservation and future gates

### Corrective final inspection: immutable cold backup

After the initial 43-case/6,246-case checks passed, the final independent
131-file checksum pass found **eight changed `*.sqlite-shm` files** in the backup
source. Main database, WAL and publication bytes had not changed. The test
verifier had opened the original backup with Node SQLite `readOnly:true`;
SQLite still updated its shared WAL-index. The initial restore's semantic
assertions passed but did not prove a byte-immutable, reusable backup. The
initial acceptance statement was therefore premature and was reopened before
delivery. The failure evidence is retained in
`identity-u8-cold-copy-final-check-failure.log`; original manifests and earlier
evidence/preservation files are retained, not relabeled as corrected results.

The new reuse regression failed as expected before the fix: **one failed,
14 passed**, 13.26 s (`identity-u8-cold-copy-red.log`). The narrow test-only fix
copies hash-verified files into a private inspection directory, opens SQLite
there, rechecks the entire original inventory afterward, and verifies each
source file again when copying to the empty restore target. No file or hash is
excluded, including SHM/WAL. This follows the distinction between database/WAL
content and SQLite's [shared WAL-index](https://www.sqlite.org/walformat.html).
No production code, schema, deadline, capacity threshold or authority rule
changed.

The corrected focused command passed **44 tests in five files**, zero failures,
timeouts or skips, **61.94 s** (`identity-u8-cold-copy-focused.log`). The exact
same backup/manifest restored into two separate empty targets while every
original byte remained unchanged. An independent post-test check also verified
all **131** files, with no additions, losses or hash differences. Typecheck,
ESLint and whole-package formatting passed again. Earlier
6,246/43 results above remain historical evidence rather than the correction's
acceptance result.

**Corrected final acceptance:** `npm test -- --maxWorkers=1
--testTimeout=30000` exited **0** with **6,247 passed**, the same **six existing
opt-in skips**, zero failures/timeouts; **307 passed files and three skipped
(310 total)**, **670.29 seconds**. All **44 U8 tests** are included. See
[the corrected full log](../../services/edge-api/identity-u8-cold-copy-full-final.log)
and [corrected focused log](../../services/edge-api/identity-u8-cold-copy-focused.log).
No production/test code changed after this corrected full run. The separate
143-pass Flutter result remains applicable: client source and its lockfile are
byte-identical, and the correction touches only the Node test recovery helper
and its regression.

The corrected full-suite artifact was independently rechecked after completion:
all **131 files**, including all SHM/WAL files, retained their exact manifest
size/hash and no file was added or lost. The final evidence index records that
check and the complete cold-backup location. Corrected full-run samples were
726.85 ms cold readiness, 51.47 ms schema/health, 524.27 ms import, 416.54 ms
validation, 309.75 ms recovered pin, 433.69 ms export verification, 485.25 ms
restart readiness, 20.25 ms receipt read, 423 ms workerd context load and
282.75 ms independent Node context verification. Cold-copy restore was
784.60 ms and independent R0 reconstruction 1,409.15 ms. The 32-pin larger
history's maximum was 281.57 ms; shared logical storage was 4,822,725 bytes.
These are local observations, not a production latency/capacity certification.

Added tests/support under `services/edge-api/test/identity/integration/`:
`local-worker.ts`, `support.mjs`, `recovery.mjs`, `cutover.test.mjs`,
`isolation.test.mjs`, `restart.test.mjs`, `restore.test.mjs`,
`capacity.test.mjs`. Added review documents: this report,
[operator runbook](GridView_Identity_Catalog_Runbook.md),
[configuration proposal](GridView_Identity_Catalog_Staging_Proposal.diff),
and five JSON records: `identity-u8-session-baseline.json`,
`identity-u8-evidence.json`, `identity-u8-preservation.json`,
`identity-u8-evidence-final.json`, `identity-u8-preservation-final.json`.
The first evidence/preservation records retain the pre-correction snapshot.
There are **16 added
tracked/nonignored paths**, including the preservation artifact itself, and
**zero modified pre-existing files**. The machine-readable
[corrected preservation comparison](identity-u8-preservation-final.json) lists every path,
byte length/hash and unchanged original. It excludes its own hash to avoid a
self-reference. Ignored logs/generated types/runtime evidence are separately
identified; older evidence files were not overwritten.

No commit/push/merge/reset/discard/clean or UI-redesign-worktree access occurs.
No actual staging/production configuration is changed. Source preservation,
index/branch/HEAD and `git diff --check` all passed after final verification.

**U8's local acceptance criteria are met:** exact R0 parity, three complete
comparison runs without semantic differences, verified installation isolation,
successful isolated recovery, preserved publication authority and a complete
reviewable future staging runbook/configuration proposal. There is no remaining
local U8 acceptance blocker. This establishes R0-scale local mechanism safety;
it does not establish remote readiness, maximum-capacity performance, evidence
truth beyond the reviewed repository corpus or a platform operational backup.

U9/U10 implementation remains unauthorized; strict inventory and unknown
required-identity blockers are preserved. U11 must obtain separate staging
authorization, named primary/backup roles, actual build/artifact identification,
environment-specific namespaces/UUIDs/secrets, remote latency/capacity and
operational recovery proof, controlled comparison and hold/drain approval.
Production requires its own explicit approval and separate real evidence.
