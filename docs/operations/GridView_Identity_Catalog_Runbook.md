# Identity catalog operator runbook — U8 local rehearsal / future rollout

This is a review artifact. **NOT EXECUTED / FUTURE APPROVAL REQUIRED** applies
to every remote inspection, secret/configuration change, deployment, import,
activation, synchronization and publication below. U8 authorizes only isolated
local tests. A passing local test does not establish remote readiness. U11
needs separate staging/E2E authorization; production always needs its own change
approval. U9/U10 remain separate units and strict inventory remains mandatory.

## 1. Ownership and approval record

| Responsibility                          | Primary    | Backup     |
| --------------------------------------- | ---------- | ---------- |
| Evidence reviewer                       | Unassigned | Unassigned |
| Catalog activator                       | Unassigned | Unassigned |
| Restricted export/recovery custodian    | Unassigned | Unassigned |
| Rollout operator / incident coordinator | Unassigned | Unassigned |
| Publication/reconciliation operator     | Unassigned | Unassigned |

Owner supplies names, availability, escalation contacts and authority before
provisioning. One person may hold reviewer and activator roles, but review,
validation and activation remain separate operations. Incident coordinator
escalates unresolved identity/historical corrections to the product owner;
there is no break-glass publication procedure.

> **Staging exception SOE-1 (accepted by the product owner on 2026-11-21).**
> GridView has one operator. The product owner is the primary staging
> operator and the staging release approver. The **Backup** column above is
> **not met** and is **not waived**; the table is left as written. For staging
> Tier A gates G0, G1 and G1v only (`gridview-api-staging`, installation
> `c45d60b8-a723-4b6e-8530-750592af2b94`), work may go ahead without a backup
> operator under SOE-1: CC-1 to CC-11 are mandatory at their gates (including
> the eight-hour separation before an irreversible operation and the
> controlled no-sync window), RS-1 to RS-8 are accepted within that scope, and
> the exception expires at the latest on 2027-02-28. Reviewer, activator,
> custodian and incident-coordinator rows stay unassigned. G2-G5,
> optional-driver activation, E2E and production are not excepted. Acceptance
> authorizes no gate. Record:
> [SOE-1](GridView_Identity_Catalog_U11_Solo_Operator_Exception_Proposal.md).

Approve the exact environment, Worker/build and artifact hashes, individual
credential/secret plan, namespace lifecycle, affected seasons, controlled source,
permitted operations and recovery build. Existing licensing, PRD and release
gates remain in force. Authorization to deploy does not authorize live provider
requests or publication. Resolve each permission explicitly in the change record.

## 2. Identify immutable artifacts before any change

U8 source baseline is branch `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`, with extensive uncommitted work.
HEAD alone does not identify a deployable build. Bind the future reviewed build
to every source byte (including U0–U8 changes), lockfile, generated schemas,
configuration proposal, test evidence and recovery-compatible bundle. Record
the resulting build digest and actual deployment version after the separately
authorized deployment; neither identifier is invented here.

Reviewed files in `docs/operations/identity-seed-r0/`:

| Artifact        | Exact file SHA-256, without prefix                                 |
| --------------- | ------------------------------------------------------------------ |
| `seed.json`     | `6abc3830314c2c08fad2c3577141ca548b0b7e3a2109d7acf66e3c85448edab7` |
| `manifest.json` | `bdbaeb3792056c9d7a4e4e81633b2ce66dc7f458f55642994999de9e3bcd1fe1` |
| `parity.json`   | `372b67eaa9ca1b8043ee1604e80961beb66274b9c95e70a40b165ec63b6d6f46` |

R0 catalog is
`sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851`;
2026 projection is
`sha256:ab953da8b44e80f7d9bc87fd948a32b0c67785eaa15c4d50348f0a4f8b7cc746`.
Dataset stays `2026.10.07.1`: 33 drivers, 11 constructors, 24 circuits,
23 events, 94 exact typed mappings, 101 provenance-bearing evidence records
and seven unresolved acknowledgements. Check the manifest's ten source files
against their actual bytes and dirty-source provenance. Never claim HEAD
contains bytes it does not contain or infer an identity from a provider slug.

Four Jolpica keys `rafael_camara`, `gabriele_mini`, `freddie_slater`,
`nikola_tsolov` and the three OpenF1 acknowledgements remain unresolved.
Acknowledgement is not lookup resolution. Stop on any unexplained difference.

Safe local checks, from `services/edge-api` (no HTTP/provider calls):

```powershell
npm run identity -- --help
npm test -- test/identity/integration --maxWorkers=1 --testTimeout=30000
node scripts/identity/compile-schemas.mjs --check
npm run validate:content
npm run validate:fixtures
npm run validate:openapi
```

For byte regeneration, `node scripts/identity/seed.mjs --out` requires a new
local directory argument. U8 used a uniquely named temporary directory and
compared its three files with the reviewed files. The tool refuses conflicting
output. It never imports or activates a catalog.

## 3. Environment and declarative class preservation

Review [the proposed diff](GridView_Identity_Catalog_Staging_Proposal.diff).
It is documentation with non-runnable placeholders, not applied configuration.
`wrangler.toml` stays byte-identical in U8. Preserve the existing top-level
`ProviderRateLimiter` and `SeasonPublicationSequencer` exports, and all three
staging/E2E exports including `ReconciliationLedger`. Environment export maps
replace the top-level map: retain every existing class. Add only the intended
environment's `[env.<name>.exports.IdentityCatalog]`, `storage = "sqlite"`,
and Worker-local `IDENTITY_CATALOG` binding. No `script_name` cross-binding,
renaming, removal, transfer, legacy `[[migrations]]` or production export change.
This follows the repository convention and Cloudflare's
[declarative class lifecycle](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).

Staging and E2E both use `ENVIRONMENT=staging`. They nevertheless require
different persisted UUIDs, Worker-local namespaces, credentials, controlled
source/KV, receipts and histories. Object routing is
`identity:<IDENTITY_INSTALLATION_ID>`. The implementation's actual routing,
rather than the earlier design's generic domain name, governs inspection.
Record actual namespace identities after future provisioning; none is assigned
or queried by U8. A wrong namespace may yield an empty catalog; it must never
seed implicitly. A wrong persisted installation must refuse initialization.

Keep crons explicitly empty, current provider/proxy settings, publication
authority, KV IDs and required secrets unchanged. The committed staging
configuration already contains separately gated coordinated-mode/ledger changes;
do not deploy it as a routine identity-only change. Reconcile committed versus
actually deployed state under the future approval using the
[staging runbook](GridView_Staging_Edge_Runbook.md) and
[environment record](../technical/GridView_Environments.md). Their historical
observations are not a fresh remote audit.

## 4. Individual secrets and rotation

Provision per-environment `IDENTITY_REVIEWER_CREDENTIALS` through the approved
secret mechanism, never a plain Wrangler variable. Retain existing required
secrets and append this secret name only in the later admin-enablement change.
Use the closed array defined in the [U5 guide](GridView_Identity_Admin_U5_Guide.md):
credential ID, SHA-256 token digest, stable principal ID, explicit roles,
disabled flag and UTC expiry. Generate tokens from at least 32 random bytes.
No real credential or digest is in this runbook or the U8 artifacts.

Distribute tokens privately. Reader, reviewer and activator do not inherit one
another. Identity credentials cannot authorize sync, reconciliation, rollback
or ingestion. The operational `ADMIN_TOKEN` cannot mutate the catalog. Disable
shared-token catalog read compatibility before runtime cutover; use individual
inspection in review mode. Rotate to a new credential ID/token for the same
principal, verify it, disable the old entry, then verify refusal of the old
credential. Preserve old audit attribution. Never put a bearer in a URL,
argument, review JSON, log or Git. Follow U5's secure PowerShell process-
environment entry/cleanup procedure; do not dump that environment.

## 5. Inspect, shadow, seed, validate and activate

Future remote CLI use must set the individually approved HTTPS
`GRIDVIEW_IDENTITY_URL`, `GRIDVIEW_IDENTITY_INSTALLATION_ID` and transient
`GRIDVIEW_IDENTITY_TOKEN` as in U5. All commands below are verified repository
syntax; placeholder arguments require real reviewed values. They were not
sent remotely by U8.

Read-only catalog operations (exports/history can append administrative audit):

```powershell
npm run identity -- status
npm run identity -- revisions list
npm run identity -- revision inspect '<revision-uuid>'
npm run identity -- candidates list --season 2026 --source jolpica --state unresolved --limit 20
npm run identity -- notifications list
npm run identity -- history --revision-id '<revision-uuid>'
npm run identity -- export --revision '<revision-uuid>' --out '.\restricted\catalog-review.json'
```

Check installation, schema, active head/sequence/hash, admission, capacity and
dataset readback. Empty installation must have no active revision. Existing
nonempty state is an investigation gate, not permission to reseed.
Count R0's 101 original evidence records and seven unresolved acknowledgements
in the complete revision/export. They are preserved repository-import records;
do not mistake discovery-table counters for seed parity or fabricate provider
observations to populate those counters.

With separate permission for controlled shadow checks, enable `shadow` while
bundled/strict remains authoritative. Use known/unknown/invalid synthetic
fixtures only in an isolated test installation. Check exact requests and
outcomes, accepted/persisted/replayed/dropped counts, notification generations,
storage failure and restart recovery. Repeated observation IDs deduplicate;
unacknowledged losses are not exactly-once delivery. No email or scheduler is
enabled. Disable discovery without deleting its evidence if stopped.

Prepare the exact U5 reviewed seed wrapper with honest import dossier and
non-synthetic reviewed provenance for the intended future environment. Do not
copy local synthetic authorization decisions into staging/production. U8
synthetic imports are test fixtures only. Files contain installation, operation
UUID, expected head/sequence, reason and payload; actor/time come from server.

**Mutation — NOT EXECUTED / FUTURE APPROVAL REQUIRED:**

```powershell
npm run identity -- seed --file '.\reviews\reviewed-seed.json' --check
npm run identity -- seed --file '.\reviews\reviewed-seed.json' --preview
npm run identity -- seed --file '.\reviews\reviewed-seed.json'
npm run identity -- validate '<proposal-uuid>' --file '.\reviews\validation.json' --preview
npm run identity -- validate '<proposal-uuid>' --file '.\reviews\validation.json'
npm run identity -- activate '<proposal-uuid>' --file '.\reviews\activation.json' --preview
npm run identity -- activate '<proposal-uuid>' --file '.\reviews\activation.json'
```

Validation names the exact catalog hash/validator. Activation names that hash
and validation report hash, under the separately inspected parent/sequence.
Inspect the complete delta, labels and certificate before approval. Import
creates a proposal only. Activation must read back sequence 1, exact R0,
complete mappings/profiles and unchanged dataset. It publishes nothing.

## 6. Export, custody and recovery gate

Keep bounded exports in independently controlled restricted storage, with build,
source manifest, canonical commitment and reviewed audit record. Verify U5
`exportHash` over its complete wrapper excluding only that field. U7's
`identityCatalog.exportSha256` is **that verified prefixed value**, not a hash
of local file spelling. Regenerate and re-review obsolete synthetic raw-digest
v2 artifacts, manifests, submissions and dependent descriptors; never relabel.

| Recovery material                      | Supplies                                                                                                                  | Does not establish                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U4/U5 revision export                  | Complete revision lineage, source/evidence/decision closure, mappings/profiles, dataset commitments, installation binding | Full operational SQLite history, pins, activation certificates/sequences, all audit/HTTP/batch receipts, irreversible admission flags, lease or publication state |
| U8 stopped local persistence-tree copy | Exact local DO/KV state and manifest hashes, verified by reopening isolated workerd                                       | Remote Cloudflare backup/PITR, cross-installation import authority, remote KV consistency                                                                         |
| Fresh installation reconstruction      | New UUID/namespace/credentials, U5 seed/validate/activate and effective R0 parity                                         | Original receipts, original operational actor authority or original head UUID                                                                                     |
| Point-in-time database recovery        | Platform database history under separate approved procedure                                                               | Automatic reconciliation with published releases and externally retained audit                                                                                    |

There is no general production restore endpoint. U8's `test/identity/integration/recovery.mjs`
works only with stopped, test-prefixed temporary directories and an empty
target. Its manifest binds full file inventory/digests, verified revision
export, expected installation, head and activation sequence, then checks SQLite
integrity/schema/head before copying. Never copy files while workerd is writing.
The checker opens SQLite only on a private inspection copy. Even read-only
connections can change WAL-index shared memory; the original backup must never
be opened by its verifier. All main/WAL/SHM/blob file hashes remain mandatory,
are rechecked after inspection and at copy time, and the same artifact must
restore twice into different empty stores without changing any source byte.
This accounts for SQLite's [WAL-index behavior](https://www.sqlite.org/walformat.html).
Never import over a populated/live store. Recovery copies retain receipt-bound
installation identity explicitly, under quarantine and freshly supplied test
credentials; fresh-installation reconstruction uses a different UUID and no
inherited receipts. Old credentials are not in the backup and must fail there.

Before remote runtime cutover, the custodian must approve and rehearse a
platform-specific operational backup/recovery plan covering catalog, sequencer,
ledger, KV publication, audit and secrets separately. U8's cold copy is not
that plan's deployed implementation. Cloudflare
[SQLite storage/PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
is a separate facility; do not turn it into catalog rollback. Preserve the
latest externally reviewed checkpoint and published identity references;
outdated/incomplete/corrupt/unsupported recovery material means stop.

## 7. Compare gate, holds and runtime-strict selection

**Authoritative ledgers (staging, production); ADR 0031 amendment, accepted
2026-11-22.** Comparison evidence for staging consists of (a) three
independent offline catalog-parity comparisons against a verified U5 export
of the staging catalog, and (b) the staging operational checks S1-S7. Never
write a controlled, replayed or synthetic observation into the staging
reconciliation ledger: an operator hold prevents publication, not ledger
confirmations. Coordinated compare runs on a controlled source are allowed
only on an isolated Worker with its own ledger, and are labelled as that
environment's evidence. Tooling: `scripts/identity/parity-compare.mjs` and
the gated `test/season-batch/u11-parity-accounting.test.ts`.

**Isolated ledgers only (local, E2E, isolated Worker); unchanged original
text, kept as the requirement there and as history for staging:**
Require at least three complete controlled runs per intended deployment,
with identical recorded provider inputs and fixed clocks. Compare exact request
counts/order and limiter attempts; all resource families/profiles/metadata;
classification revisions/accepted state; reconciliation decisions; generated
documents, publication eligibility and existing public snapshot data. Compare
effective content, not intentionally different provenance envelopes. Require
zero unexplained differences, losses or overflow. Compare disagreement/outage
must remain diagnostic; bundled stays authoritative. Runtime outage must fail
before provider calls with no fallback. Use separately authorized controlled
evidence, never a hidden live capture.

Before runtime selection: verify U6/U7 compatibility, immutable recovery build,
current schema, active export/receipt readback, three-run evidence, strict
inventory and no runtime-only content. Pause new admissions if incident
containment requires it. Apply the existing operator hold for each affected
season. The existing read-only route is
`GET /internal/admin/reconciliation?season=2026`; it requires operational
authentication. `POST /internal/admin/reconciliation/hold` takes
`{season,expectedSeasonRecordVersion,operationId}`. Follow the staging runbook's
operator procedure; all future remote calls require approval.

Stop new manual/scheduled/verification/batch initiators. Wait for held leases
to release or expire under existing fencing; inspect rather than force-delete.
Reconcile every uncertain verification/batch intent with its original operation
receipt. Verify no `publishing` disposition or unresolved sequencer transition,
no unknown batch completion and no pending publication recovery. A hold alone
does not prove an already admitted run has drained. Missing inspection or
ambiguous receipt means **recovery required**, no cutover.

Only then select runtime/strict in the reviewed configuration. A fresh run
must pin before provider construction/requests and retain that pin throughout.
Existing runs never change mode halfway through execution. Rehearse outage
after pin, mid-run activation and restart. Preserve holds and durable blocks;
catalog activation cannot clear either. A held test run correctly makes no
publication. Release a hold only through separately approved operator action
after inspection; release is consent for the next guarded publication, not a
test shortcut. Never clear a durable block to obtain a successful demonstration.

## 8. Monitoring and lost responses

Record active revision/sequence, dataset/projection, pin adoption and latency,
complete context load time, administrative deadlines, logical/physical storage,
backlog age, discovery losses/failures, stale/conflicting operations, required
unknown rows, hold/block reasons and D14–D16 refusals. Retain existing
coordination/publication budgets, two-second pin attempts (one identical retry),
ten-second admin namespace deadline and all byte/capacity caps. R0 measurements
do not certify the accepted maximum. Stop rather than enlarge limits to pass.

Timeout/lost response never proves failure. Preserve exact request bytes,
operation ID, principal and family; inspect the authoritative receipt/head:

```powershell
npm run identity -- operation inspect '<operation-uuid>' --family activate
npm run identity -- history --revision-id '<revision-uuid>'
```

If committed, recover its stored result. If unavailable/unknown, retain the
hold and recovery-required status: an earlier call may still commit. Deliberate
retry uses the same request and ID, never a new mutation ID. CLI
`--retry-same-operation` first reads the receipt. Pin recovery retains the
original run/season/purpose and admitting fence as provenance; reacquire the
real operational lease separately. Batch receipt and sequencer recovery must
agree; a catalog pin is not proof of publication. Keep current public snapshots
readable during catalog outages.

## 9. Recovery builds and rollback restrictions

Before runtime, disable compare/discovery and keep accumulated evidence.
Parity-equal R0 can deliberately return to bundled only after hold/drain,
effective-content and publication-history review. No error-triggered fallback.
After runtime-only changes, older bundled builds may lack profiles/bindings,
versions or required public references. Deploy only a compatible runtime reader
retaining current namespace, SQLite schema and complete immutable history.
The irreversible runtime-only flag permanently closes new legacy-v1 admission.

Replaying an old activation receipt is historical recovery, not head movement.
No new activation may select a previous head. After runtime-dependent
publication preserve published references; historical correction needs its own
approved workflow. D14 lost rounds, D15 lost facts/changed constructor and D16
stale predecessor always refuse while keeping the existing snapshot. Approval
and activation never authorize publication. Worker code rollback does not undo
DO schema/data; removing an export/namespace can destroy state and is forbidden.

Stop/escalate on parity drift, wrong installation/namespace/credential, missing
provenance, unknown schema, failed migration, corrupt export, unreviewed delta,
capacity/deadline failure, unknown mutation outcome, undrained activity,
unexpected provider request, public schema drift or changed immutable history.
Preserve artifacts and holds; notify the assigned incident coordinator through
the owner's agreed channel. U8 implements no notification delivery.

## 10. Separate subsequent approvals

U9 optional-driver inventory and U10 required-reference closure require separate
implementation and acceptance. Current contexts enforce `strict/1`; the design's
`IDENTITY_INVENTORY_MODE` is not an implemented U8 environment field. Do not add
it as an operational variable or select `optional-drivers`. Unknown required race/standings identities and missing
profiles remain full-season blockers. Neither phase permits selective resource
publication or predecessor-based reconstruction.

U11 must recheck actual deployed state, assign people, verify credentials,
capacity and remote recovery, review the concrete configuration/build diff,
and obtain environment-specific approval before any rollout. Production needs
a different installation/namespace/secrets, real reviewed evidence and its own
explicit change approval. No staging acceptance or document authorizes it.
