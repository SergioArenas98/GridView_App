# U5: individual identity administration and PowerShell CLI

Date: 2026-11-15. Scope: U5 only, local implementation and controlled tests.
The product owner's explicit U5 authorization supersedes historical U5-pending
statements in earlier reports. U6 and subsequent units are not authorized.

## Scope and preservation

Repository: `Gridview-jolpica-proxy`; branch `feat/jolpica-egress-proxy`; HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. The initial branch/HEAD matched.
[The pre-U5 inventory](identity-u5-baseline.json) records Git status, index and
worktree diff hashes, and all 1,432 existing tracked/nonignored file paths,
lengths and SHA-256 hashes before implementation. Ignored dependencies and
transient test data are outside that inventory, matching the earlier U4 method.

[The final comparison](identity-u5-preservation.json) distinguishes every U5
extension/addition from the extensive investigation/U0-U4 work. No original
file is deleted. Earlier modifications in the extended files are retained;
all other 1,414 baseline files remain byte-identical. U5 extends
18 existing files and adds 41 paths. Actual content, mappings,
corrected R0 artifacts, previous reports, lockfile, deployment configuration,
Android identity/signing, provider ports, synchronization and publication
implementation remain unchanged. Two containment expectations are updated for
U5: U3's old whole-Worker dormancy assertion now inspects the synchronization
composition graph, and the Worker provider-neutrality test permits exactly the
same four existing pure catalog-to-curated-profile imports already allowed by
its all-module assertion. Every other exact dependency assertion is retained.
The unchanged season-batch boundary still forbids Worker imports from scripts;
the shared closed guards therefore live under Worker source and are reused by
the CLI. New complementary graph and HTTP tests exclude runtime catalog
consumption, public authority exposure and the test issuer from production.

No UI-redesign worktree was accessed or modified. No commit, push, merge,
remote state read/write, deployment, infrastructure change, operational sync,
publication, real credential or real approval was performed. All new driver
approvals use synthetic canonical IDs in isolated stores; the four November
Jolpica identifiers remain unresolved. Runtime synchronization still consumes
bundled identities. Catalog activation in a local test grants no publication
authority and no U6 runtime consumption.

## Authentication and configuration

New individual routes require all of: an explicit `read-only` or `review` admin
mode, a valid installation UUID, a valid namespace binding and a valid separate
`IDENTITY_REVIEWER_CREDENTIALS` secret. Writes require exactly `review`. Missing
or malformed configuration fails closed; no default credential or operational
fallback exists. No deployment configuration enables these requirements.

The credential secret is a bounded closed array (1-100 entries), each containing
exactly `{credentialId,tokenSha256,principalId,roles,disabled,expiresAt}`. The digest
is 64 lowercase hex characters; IDs are stable bounded ASCII identifiers;
expiry is a canonical UTC millisecond timestamp. Roles are explicit subsets of
`reader`, `reviewer`, `activator`, without duplicates or inheritance. Unknown
fields, duplicate credential IDs/digests, malformed roles, timestamps or flags
invalidate the configuration. Credentials require independently issued random
256-bit-or-greater tokens encoded as unpadded base64url, 43-128 characters.

The receiving Worker and catalog DO independently authenticate Bearer credentials.
Digests use Web Crypto SHA-256 and native Worker timing-safe comparison, with a
fixed-length digest loop for the plain-Node test host. Expired, disabled,
malformed, missing and unknown tokens fail. Principal/credential/roles/time
come from the server, never request-body or client actor headers. The request
capability is private to one authenticated call; U4's test-only issuer remains
outside production routes and the production dependency graph. Synthetic
evidence acceptance is an explicit test-constructor parameter, never a
production environment switch or HTTP field.

Rotation uses a new credential ID/token for the same principal. Audit retains
the original principal, credential ID and honest `individual-bearer` method;
receipt scope follows the stable principal. Revoke by disabling/removing the
old entry or expiry. No real credentials were generated or provisioned.

Identity routing occurs before the legacy shared-token gate. Every other
`/internal/admin/*` operation still requires its existing `ADMIN_TOKEN` and
retains its behavior. Identity tokens grant no sync, rollback, reconciliation,
ingest, cache-purge or publication authority. Shared-token compatibility is
limited to the explicit U2 `read-only` shadow routes, preserving their old
shapes. It authorizes no identity mutation; review mode rejects that shared
credential even if an operator incorrectly reused it in individual configuration.

## Administrative route contracts

Base: `/internal/admin/identity`. All responses use JSON and `Cache-Control:
no-store`, with no wildcard CORS. Individual data responses are versioned with
`schemaVersion:1` and explicit installation identity. Success is
`{data,requestId,replayed}`; errors have the existing bounded
`{error:{code,message,requestId,details?}}` shape. Failed validation and head
conflicts retain bounded report/current-head pointers in `details`; receipt
lookup retains the complete sanitized operation result. Replayed rejections additionally mark
`replayed:true`. Request IDs are generated by the server and correlated across
the namespace hop; client IDs/paths cannot inject credential text into logs.

| Method and suffix                                    | Role                           | Contract                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/health`                                        | reader                         | Catalog head/hash, mode/admission, storage schema and bounded discovery/capacity metrics; no provider call.                                                  |
| GET `/candidates`                                    | reader                         | `season,source,state,entity,unread,cursor,limit`; summaries, nextCursor and asOfSequence.                                                                    |
| GET `/candidates/{hash}`                             | reader                         | Aggregate, material/dossier references, decision summaries and current binding.                                                                              |
| GET `/candidates/{hash}/evidence` or `/observations` | reader                         | Sanitized retained records, bounded stable page.                                                                                                             |
| GET `/evidence/{hash}`                               | reader                         | Sanitized evidence or retained review dossier/closure.                                                                                                       |
| POST `/evidence`                                     | reviewer                       | Candidate CAS, review-dossier claims/references and optional duplicate review; author/hash derived, new candidate version/head returned.                     |
| POST `/bindings/approve`                             | reviewer                       | Exact candidate + targetDriverId + ReviewSupport; creates a proposal only.                                                                                   |
| POST `/drivers/approve`                              | reviewer                       | Explicit driverId/profile/support and complete-catalog duplicate attestation; reserves an ID and proposal only.                                              |
| POST `/drivers/{id}/profiles`                        | reviewer                       | expectedProfileHash, closed profile without ID, support; same canonical ID.                                                                                  |
| POST `/candidates/{hash}/disposition`                | reviewer                       | Version/head, reject/quarantine/reopen, reasonCode/evidenceIds; active identities refused.                                                                   |
| POST `/candidates/{hash}/acknowledge`                | individual reader              | Exact notificationGeneration; U2 acknowledgement in the enclosing transaction.                                                                               |
| GET `/notifications`                                 | reader                         | Current-generation unacknowledged notification backlog; superseded generations retained, no delivery/scheduling.                                             |
| GET `/revisions`                                     | reader                         | `status,cursor,limit`; immutable revision summaries and current validation/status.                                                                           |
| GET `/revisions/{uuid}`                              | reader                         | Complete revision, validation, activation events and exact parent delta.                                                                                     |
| GET `/revisions/{uuid}/export`                       | reader                         | Installation-bound hash-verified wrapper, U4 self-contained lineage and referenced review/import dossier closure; audited by actor/hash.                     |
| POST `/revisions/{uuid}/validate`                    | activator                      | Exact catalogHash/expectedValidatorVersion; durable certificate/report; invalid report is 422.                                                               |
| POST `/revisions/{uuid}/activate`                    | activator                      | Exact catalogHash/validationReportHash; separate valid certificate and current-parent CAS mandatory.                                                         |
| POST `/revisions/{uuid}/abandon`                     | original reviewer or activator | Exact catalogHash; activated revisions refused; labels/ID history retained.                                                                                  |
| GET `/history`                                       | reader                         | `candidateId,revisionId,principalId,afterSequence,cursor,limit`; immutable audit/review history.                                                             |
| GET `/operations/{uuid}`                             | actor or activator             | Required `family`; optional principalId restricted to activator; committed/rejected/unknown receipt.                                                         |
| POST `/seed`                                         | activator                      | Reviewed seed wrapper/hash/import-dossier ID; empty-store-only proposal and parity report, then separate validate/activate.                                  |
| POST `/base-imports`                                 | activator                      | Validated complete sealed-base artifact/hash/support; preserves runtime drivers/profiles and prior binding targets; proposal/delta only.                     |
| POST `/corrections`                                  | reviewer                       | Candidate CAS and affected driver/binding/revision/season/version claims with evidence; append-only correction + decision, admission paused, head unchanged. |
| POST `/admission`                                    | activator                      | Exact expectedAdmissionState plus open/paused; no public-read or in-flight cancellation authority.                                                           |

All POST bodies have exactly `schemaVersion,installationId,operationId,
expectedActiveRevisionId,expectedActivationSequence,reason,payload`.
`Idempotency-Key` must equal the v4 operation UUID. Candidate references have
exact candidate ID/version/evidence head. Revision operations name the exact
revision in the path and exact content hash in the body. Root seed validation
and activation use a null expected active revision and sequence zero. The
shared dependency-free guards define every closed payload; U3/U4 validators
provide deep artifact, dossier, profile and exact-key validation.

Ordinary request bodies are capped at 256 KiB; seed/base imports at 2 MiB, read
incrementally and cancelled on overflow. Ordinary responses/pages are capped
at 256 KiB; revision inspection and exports at 2 MiB. Oversized responses fail
explicitly; no evidence is silently truncated. Lists default to 50, accept
1-100, validate all filters/duplicates and use bounded opaque cursors tied to
installation, operation, filters and a permanent insertion sequence upper
bound. Current state filters can change between reads; submission CAS is final.
The U5 administration namespace call has a 10-second bound; discovery's existing
two-second behavior and all runtime/publication deadlines are unchanged.

Errors distinguish authentication/role refusal, malformed/closed requests,
missing records, stale heads/evidence/profiles, idempotency reuse, invalid
certificates/catalogs, byte limits, throttling and capacity/unavailability.
No raw exception, provider payload, Authorization header, token or digest is
returned or logged. Current credential material pasted into otherwise valid
request text is rejected before persistence. Evidence URL citations are never
fetched. Identity log paths are constant templates and client request-ID headers
are ignored on these routes.

## Workflow, audit, idempotency and recovery

`IdentityAdminWorkflow` extends the established typed `CatalogWorkflow`; it
adds transport adapters, not a second approval/activation state machine. U4
continues to own proposals, immutable decisions, reserved canonical IDs,
labels, validation certificates, parent/evidence freshness and active-pointer
CAS. An abandoned proposal keeps its canonical ID reserved; a later attempt
returns `409 CANONICAL_ID_RESERVED`. Its original migration digest and public authority boundaries are intact.

R0 proof verification is memoized only for byte-identical retained origin
input on one repository instance. Every access rereads SQLite; changed,
malformed or missing bytes revalidate or fail. This removes repeated pure
source/seed derivation during administrative revision traversal. Heads,
candidates, certificates, roles and runtime contexts are never cached, and no
runtime reader/pinning behavior is introduced. Regression tests exercise
corruption, repeated malformed JSON, restoration and removal on the same
instance. Existing freshness, transaction and capacity checks still run.

Minimal typed adapters add atomic candidate-dossier attachment, shared U2
acknowledgement, admission, correction-report decision creation and reviewed
sealed-base imports. Base-import decisions retain exact source bytes and
hashes, rebuild the validated artifact, preserve runtime driver identities and
profiles, forbid new driver bindings/retargets, reserve versions through U4's
allocator and use the same U4 validation/activation flow. Offline export
verification rebuilds these decisions as well. Historical test attribution
remains readable alongside individually authenticated provenance.

Mutation, effect, U4 audit/receipt and HTTP receipt commit in the same real
SQLite transaction. Audit includes server actor/credential/time, reason,
request hash, exact subject and typed event category. The history read also
exposes the immutable review decision, including non-proposal dispositions.
Deterministic bounded rejections have durable receipts; raw authentication,
malformed and availability failures do not create unbounded rejected-request
audit records. Capacity failures roll back rather than acknowledging partial
changes. Reader exports commit an audit by actor/hash without export contents.

Public operation names for existing/new/profile approvals and dispositions
alias U4's `review` family; other operation families retain their names.
Idempotency scope is installation/principal/family/operation UUID. Exact
canonical path/body replay returns the original HTTP result; different content
conflicts. Request IDs and authenticating credential rotation do not alter the
request hash. Concurrent identical calls recover one receipt/audit. A lost
response is resolved by receipt lookup and deliberate identical retry, never a
new activation or silent mutation retry. `unknown` does not prove an earlier
in-flight call cannot still complete.

DO-backed rate counters enforce 60 reads/10 writes per credential per minute,
300 reads/60 writes per installation, and expire after two windows. Known
idempotent replay counts as a read. 429 includes Retry-After; the next window
recovers. Counter cardinality and audit/log volume are bounded separately from
provider quotas. All optional U5 tables count toward the existing logical
capacity budget. Navigation admission and mutation/audit receipts fail closed
when retaining their state is impossible.

## PowerShell workflow and synthetic end-to-end acceptance

[The operator guide](GridView_Identity_Admin_U5_Guide.md) covers transient
process-environment authentication, exact file preparation, evidence inspection,
existing/new/profile approvals, dispositions, notifications, imports, validation,
activation, correction containment, receipt recovery, rotation/revocation and
role requirements with concrete PowerShell commands.

`npm run identity -- ...` invokes a dependency-light Node CLI using repository
script conventions. Tokens are never command arguments. JSON is bounded UTF-8
with optional BOM; paths with spaces are ordinary PowerShell arguments. Shared
closed guards and an offline bundle of the actual U3/U4 validators validate
files before HTTP. Temporary validation artifacts contain code only, never
request data or credentials. `--check` performs no HTTP. `--preview` displays
the exact file/hash, candidate/evidence, current head and proposed change without
submitting. High-impact writes require the exact interactive confirmation or
the deliberately named `--confirm-reviewed-operation` option. Mutation retries
are always explicit; `--retry-same-operation` first checks the durable receipt.

The CLI prints explicit canonical targets/profiles and base changes. Activation
shows the proposal delta, validation and affected season versions. It never
creates canonical IDs from slugs, fetches evidence URLs, calls providers,
starts sync/publication, follows HTTP redirects with credentials or automatically
approves/activates. Errors are bounded operator instructions, not stack traces.

[Fourteen synthetic JSON templates](identity-u5-examples/README.md) demonstrate
an existing-driver dossier/binding, explicit new canonical ID/profile/duplicate
review, profile review, reject/quarantine/reopen, acknowledgement, separate
validation/activation, abandon, correction and admission pause. Their dummy
hashes/head pointers make them unsuitable for live submission; no reusable
credential appears in them.

The real workerd integration Worker exposes synthetic injection only in its
local test bundle. It bootstraps a reviewed synthetic seed through authenticated
HTTP, validates/activates it, records a synthetic observation/dossier, approves
an exact binding to a synthetic canonical driver, proves the head remains
unchanged after approval, then separately validates and activates. It shuts
down Miniflare/workerd, reopens the same SQLite directory, recovers the operation
receipt and replays activation without incrementing the head again. Durable
history preserves actor and credential attribution; SQLite bytes contain no
bearer or digest. Outbound network access is forbidden. Existing real SQLite
U2/U3/U4 restart/rollback/export tests remain in the suite.

## Validation results

The final full suite completed with **6,098 passed, one failed and six existing
skips** (6,105 tests); 292 test files passed, one failed and three were skipped
(296 files). Duration: **897.69 seconds**. Exit status: 1. The implementation is
present, but **U5 acceptance is not fully green and remains open**.

The sole failure is
`test/admin/identity/api.test.ts:303`, in
`performs exact review, separate validation and activation, export and replay with durable attribution`:
the activation POST returned `503 CATALOG_UNAVAILABLE` when 200 was expected.
The test took 33.50 seconds. This is an unexpected HTTP response, not a confirmed
test-runner timeout. Resource contention or the bounded namespace-call timeout
is suspected, but the underlying cause has not been established. No assertion,
authentication rule or test deadline has been relaxed, and no later full run is
claimed. Resolve this intermittent activation failure and rerun the required
gates before marking U5 accepted or authorizing U6/provisioning.

The other 44 U5 tests passed in this full run, including the real local
workerd/SQLite HTTP review, separate validation/activation, shutdown/restart,
receipt replay and durable attribution test. All retained U1-U4 and other
edge-api regression tests passed. The six skips are the existing optional E2E
cases; none was added for U5. The local ignored acceptance log is
`services/edge-api/identity-u5-final-d9e95ed8-c788-4af1-8faa-2f0ee1d2ca08.log`.
The established resource-conscious command is
`npm test -- --maxWorkers=1 --testTimeout=30000`; the test deadline is unchanged.
Live capture, application E2E and controlled-source opt-ins are unset.

Completed supporting checks:

| Check                                                                             | Result                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run typecheck`                                                               | Passed, Worker and script projects.                                            |
| `npm run lint`                                                                    | Passed.                                                                        |
| `npm run format`                                                                  | Passed for edge-api.                                                           |
| `node scripts/identity/compile-schemas.mjs --check`                               | Passed; generated schemas unchanged.                                           |
| `npm run validate:content`                                                        | 18 checked, zero failures.                                                     |
| `npm run validate:fixtures`                                                       | 32 checked, zero failures; 31 strict and one existing expected-tolerance case. |
| `npm run validate:openapi`                                                        | Passed; public OpenAPI unchanged.                                              |
| PowerShell `npm run identity -- approve-existing --file <synthetic-file> --check` | Passed without HTTP or credentials.                                            |
| All synthetic example JSON files                                                  | 14 passed offline validation.                                                  |
| `git diff --check`                                                                | Passed; final preservation check also records the result.                      |

The final source includes 45 U5 tests across authentication, HTTP contracts,
CLI, dependency boundaries and real workerd/SQLite persistence. Coverage includes
reader/reviewer/activator separation and a combined-role individual; shared-token
and spoofed-actor refusal; invalid/expired/disabled/rotated credentials; route
isolation; closed schemas and byte limits; durable replay/conflicting reuse;
stale candidate/evidence/head/certificate conflicts; approval without activation;
separate validation/activation; role-safe evidence/export; receipt access for an
actor without the reader role; PowerShell argument/file handling; secret
containment; rate-limit recovery; restart receipt/audit recovery; zero external
provider requests and zero public/publication authority. The full suite also
retains U1-U4, provider containment, mapping, D14-D16 and publication regressions.

Development validation found and corrected the two obsolete whole-Worker
containment expectations described above, and repeated pure origin-proof work
that caused U4 lifecycle timeouts. Existing lifecycle assertions/deadlines and
the Worker-to-scripts prohibition remain intact. The latest broader focused run
had 70 passes and two unexpected 503 responses on a substantially slower run;
both affected tests passed together in isolation (2 passed, 27 excluded by the
name filter, 65.11 seconds). No test assertion or timeout was relaxed. The full-suite result above is the final measured result; the
remaining activation failure is an open acceptance issue.

## Limitations, operational ownership and U6 gates

This unit proves a local mechanism, not the truth of identity evidence or
operational readiness. Human duplicate-review mistakes remain possible. The
2 MiB self-contained export and 256 MiB logical budgets are admission limits;
large-catalog latency, physical SQLite overhead, retained provenance and
restricted independent backups need environment-specific measurement/drills.
The unresolved activation 503 above is an acceptance blocker. A heavily loaded
local host can exceed the bounded 10-second administrative
namespace call. Such a response is uncertain: inspect the durable receipt and
recover deliberately with the same operation ID; do not assume rollback or
retry automatically. Production latency/capacity remains a provisioning gate.
The existing source importer supports the reviewed source set/season; it is not
an arbitrary catalog editor. Active binding retarget, canonical merge/deletion,
backward-head movement and destructive historical correction remain prohibited.

Reviewer, backup reviewer, activator, backup activator, recovery/export custodian,
backup recovery custodian and provisioning/rollout owner remain **unassigned**.
No named principal or credential is invented. Assign them, define protected
secret delivery/rotation/revocation, verify recovery custody/capacity and obtain
separate environment authorization before provisioning or enabling administration.
No live catalog administration is enabled by code completion or this report.

U6 needs separate PO authorization and retained U5 acceptance. Its future
acceptance must pin one complete catalog/profile/base/metadata context in every
identity-consuming entry point after lease acquisition and before provider
requests; default behavior must remain bundled until separate cutover approval.
Unavailable/invalid required runtime catalogs must cause zero provider calls or
publication attempts with no fallback; mid-run activation must not change an
existing pin; restart receipt, exact version/projection and D14-D16/publication
authority behavior must remain valid. Coordinate later U7 batch provenance and
U8 recovery/cutover gates. None of these runtime consumers, batch-v2 changes,
inventory exceptions, cutovers or staging actions is implemented here.

## Future email extension point

U2 durable notification generations and individual acknowledgements are
preserved. A separately authorized delivery component may consume unknown
required-identity blocks, inventory-only pending backlog and persistent
synchronization-failure state, add explicit thresholds/deduplicated delivery
receipts, and send email. Acknowledgement remains distinct from resolution.
U5 collects no address and adds no SMTP/provider, Resend, Telegram, webhook,
notification scheduling or external message. Operational ownership, delivery
security/retention and rollout need a later approved feature.

## Exact U5 file inventory

Modified existing paths (relative to the pre-U5 worktree):

- `services/edge-api/package.json`
- `services/edge-api/src/admin/router.ts`
- `services/edge-api/src/config/environment.ts`
- `services/edge-api/src/identity/catalog/correction-store.ts`
- `services/edge-api/src/identity/catalog/evidence-store.ts`
- `services/edge-api/src/identity/catalog/repository.ts`
- `services/edge-api/src/identity/catalog/review.ts`
- `services/edge-api/src/identity/catalog/revision-export.ts`
- `services/edge-api/src/identity/catalog/revision-store.ts`
- `services/edge-api/src/identity/catalog/revision.ts`
- `services/edge-api/src/identity/catalog/workflow.ts`
- `services/edge-api/src/identity/durable-object.ts`
- `services/edge-api/src/identity/storage-accounting.ts`
- `services/edge-api/src/index.ts`
- `services/edge-api/src/logging/request-log.ts`
- `services/edge-api/test/identity/catalog/parity.test.ts`
- `services/edge-api/test/providers/provider-neutrality.test.ts`
- `services/edge-api/tsconfig.json`

New paths:

- `docs/operations/GridView_Identity_Admin_U5_Guide.md`
- `docs/operations/GridView_Identity_Catalog_U5.md`
- `docs/operations/identity-u5-baseline.json`
- `docs/operations/identity-u5-examples/README.md`
- `docs/operations/identity-u5-examples/abandon.json`
- `docs/operations/identity-u5-examples/acknowledge.json`
- `docs/operations/identity-u5-examples/activation.json`
- `docs/operations/identity-u5-examples/approve-existing.json`
- `docs/operations/identity-u5-examples/approve-new.json`
- `docs/operations/identity-u5-examples/approve-profile.json`
- `docs/operations/identity-u5-examples/correction.json`
- `docs/operations/identity-u5-examples/evidence-existing.json`
- `docs/operations/identity-u5-examples/evidence-new.json`
- `docs/operations/identity-u5-examples/pause-admission.json`
- `docs/operations/identity-u5-examples/quarantine.json`
- `docs/operations/identity-u5-examples/reject.json`
- `docs/operations/identity-u5-examples/reopen.json`
- `docs/operations/identity-u5-examples/validation.json`
- `docs/operations/identity-u5-preservation.json`
- `services/edge-api/scripts/identity/cli.mjs`
- `services/edge-api/scripts/identity/client.mjs`
- `services/edge-api/scripts/identity/validation.ts`
- `services/edge-api/scripts/identity/validator.mjs`
- `services/edge-api/src/admin/identity/auth.ts`
- `services/edge-api/src/admin/identity/guards.d.mts`
- `services/edge-api/src/admin/identity/guards.mjs`
- `services/edge-api/src/admin/identity/mutations.ts`
- `services/edge-api/src/admin/identity/reads.ts`
- `services/edge-api/src/admin/identity/requests.ts`
- `services/edge-api/src/admin/identity/responses.ts`
- `services/edge-api/src/admin/identity/routes.ts`
- `services/edge-api/src/admin/identity/service.ts`
- `services/edge-api/src/identity/catalog/admin-workflow.ts`
- `services/edge-api/src/identity/catalog/base-import.ts`
- `services/edge-api/test/admin/identity/api.test.ts`
- `services/edge-api/test/admin/identity/auth.test.ts`
- `services/edge-api/test/admin/identity/boundaries.test.ts`
- `services/edge-api/test/admin/identity/cli.test.mjs`
- `services/edge-api/test/admin/identity/local-worker.ts`
- `services/edge-api/test/admin/identity/local.test.mjs`
- `services/edge-api/test/admin/identity/support.ts`

## Corrective investigation and acceptance closure - 2026-11-15

This appended corrective record supersedes the acceptance conclusion above only
where its final measured acceptance result explicitly says so. The original U5
report, its failed acceptance result and its limitations remain historical
evidence. Authorization is limited to this U5 correction. U6 is not authorized.

### Preservation and starting evidence

Work remained in `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`,
HEAD `027da5da59bf6b8c75a3fc432ef4fdc691772528`. Before source/test edits,
[the corrective baseline](identity-u5-correction-baseline.json) recorded branch,
HEAD, complete expanded Git status and all **1,473 tracked/nonignored files**
with byte lengths and SHA-256 hashes. This includes every pre-existing
November/U0-U5 source and document change. As in the original preservation
method, ignored dependencies, retained test logs and transient runtime data are
outside the source inventory. The final comparison is
[identity-u5-correction-preservation.json](identity-u5-correction-preservation.json).

The retained final log was available:
`services/edge-api/identity-u5-final-d9e95ed8-c788-4af1-8faa-2f0ee1d2ca08.log`,
SHA-256 `159b7bd541c19fb901d1c38f90e755d52657587c889a747783e98ab701b54b27`.
It records exactly 6,098 passes, six opt-in skips and the activation 503 at
`api.test.ts:303`; the full run lasted 897.69 seconds and the affected test
33.50 seconds. The earlier retained acceptance log instead records a different
API-test 503; it is not substituted for that final result.

### Request and transaction trace

1. The failing case calls the Worker directly through the local HTTP harness;
   it does not execute the CLI. The CLI uses the same JSON envelope and exact
   operation UUID/`Idempotency-Key`, with no automatic mutation retry.
2. Identity dispatch precedes the legacy shared-token gate. The edge Worker
   verifies configuration, individual bearer and explicit role, route/query,
   write mode and bounded body before forwarding to its installation namespace.
3. `handleIdentityRequest` races the namespace `stub.fetch` against the existing
   **10,000 ms** `within` deadline. `within` clears its timer but does not cancel
   the underlying operation. Its `Error('timeout')` is deliberately sanitized by
   `errorFor`/`failure` to HTTP **503 `CATALOG_UNAVAILABLE`**. That public code
   also covers unclassified exceptions; the code alone cannot identify a cause.
4. The catalog object independently authenticates, creates a request-local
   authority/capability and workflow, validates the closed request, hashes the
   canonical path/body, checks receipt scope and rate-limits. Exact existing
   receipts replay before any mutation. Conflicting reuse returns 409.
5. The adapter checks the named revision/hash and separate validation report.
   `CatalogWorkflow.activate` still verifies the complete revision chain,
   immutable origin proof, full parent delta, evidence, indexes and complete
   certificate. It performs no provider, network or publication request.
6. The synchronous SQLite commit rechecks the exact head/sequence, revision and
   certificate bytes, candidate/evidence freshness and index/key/label integrity.
   Head, revision status, keys, season records, candidate resolution, individual
   audit, U4 operation receipt and U5 HTTP receipt commit together. Failure rolls
   back all those writes. Labels remain proposal allocations; replay allocates
   no new label. No asynchronous work occurs between related transaction writes.
7. The service builds the response from its committed HTTP receipt. The outer
   Worker bounds and reconstructs the response with no-store headers. A timeout
   can return before step 6; a lost response can occur after step 6. Neither
   proves rollback. Durable receipt/head/history and identical deliberate retry
   are the recovery path; `unknown` can coexist with an in-flight operation.

### Confirmed defect, measurements and limits of attribution

The concrete implementation defect was the lifetime of the existing immutable
R0 proof memo. `serveIdentityAdmin` constructs a new `IdentityAdminWorkflow`
for each authenticated request, so a memo owned only by that repository is
discarded after every request. Activation rebuilt the same complete origin
that a preceding validation/review had already verified. This is hundreds of
sequential cryptographic digests plus source/seed derivation, not additional
mutable-authority validation.

Temporary diagnostics timed catalog fetches, recursive revision reads and
origin proofs, and counted/timed real Web Crypto digests. They logged no
credentials, provider evidence or complete private catalogs and have been
removed. Recursive phase times overlap and must not be summed. One ordinary
sample measured review at 518 ms, validation at 573 ms, activation at 674 ms
and export at 558 ms. Activation traversed the two-revision chain twice and
spent approximately 212 ms in the cold origin proof.

The controlled experiment inserted a requested 20 ms queue delay before each
**real** digest only during the activation request; the real SQLite workflow,
authentication, validation, transactions, timeout and assertions remained.
Windows timer granularity made actual waits longer than 20 ms. It was not a
mock storage or a deadline extension.

| Same controlled operation | Before correction | After correction |
| --- | --- | --- |
| Activation digest count, including authentication | 525 | 20 |
| Total measured digest elapsed time | 16,200.39 ms | 573.47 ms |
| Outer HTTP result | 503 `CATALOG_UNAVAILABLE` at 10,042.01 ms | 200 at 1,019.21 ms |
| Head sequence when HTTP returned | 1 | 2 |
| Eventual inner response | 200 at 16,772.47 ms | 200 at 1,019.38 ms |
| Final head sequence / HTTP receipt count | 2 / 1 | 2 / 1 |

An undelayed pre-correction activation measured 629.54 ms, with 525 digests and
30.94 ms of digest elapsed time. The delays model a contended digest service;
they do not claim to reconstruct the historical host scheduler exactly.

This establishes **namespace deadline exhaustion caused by repeated pure
verification under controlled contention**, and demonstrates that the 503 can
precede a successful activation. No storage exception, lock failure, partial
transaction or initialization failure occurred in that reproduction. Native
SQLite operations are synchronous and no transaction spans a digest await.
The retained historical log has no internal exception, phase timing or receipt
snapshot, so its exact original trigger cannot be proven retrospectively.
Actual historical SQLite failure or other exception cannot be categorically
excluded from that log alone. Host-wide resource contention is a plausible
trigger, not a separately proven historical root cause. This is not classified
as a harmless flaky test.

The original harness also closed SQLite immediately in `afterEach`, even
though a timed-out namespace mutation can still be running. That creates a
potential secondary closed-connection error/interference after a failed
assertion. No historical cross-test leak was proven. Cleanup now drains the
tracked in-flight catalog requests before closing the connection, including
failure paths. No unrelated host process was stopped or altered.

### Narrow correction and unchanged policies

`CatalogOriginProof` holds one successfully validated, recursively frozen R0
proof keyed by its exact retained JSON bytes. A catalog DO owns the memo and
passes it to fresh request-local workflows; standalone U4 repositories own
their own memo. Every use still rereads SQLite. Different bytes clear the
previous usable proof and undergo full validation; malformed or failed proofs
are never cached. Missing rows fail before cache access. Restoring identical
validated bytes cannot turn corrupt bytes into a success. A new object/process
starts cold. Concurrent completions populate the memo only while their byte
key still matches. No in-flight I/O promise crosses request lifetimes.

Only that pure proof is reused. Principals, credentials, roles, head, candidates,
revision bodies/statuses, evidence, certificates, labels, receipts and runtime
contexts are never memoized. Complete proposal/parent/certificate/freshness
validation still runs. Both existing full revision traversals are retained;
no required check was removed. The object's memory use is bounded by one
admitted origin plus one proof, rather than a growing per-revision cache.
The ownership follows the documented
[Durable Object instance lifecycle](https://developers.cloudflare.com/durable-objects/reference/in-memory-state/).

The administrative 10-second policy, discovery's two-second policy, test
deadlines, wire errors, byte/storage/capacity limits, role enforcement,
certificate format, exact head CAS, receipt scopes and retry semantics are
unchanged. No automatic mutation retry or new operation ID is introduced.
No runtime catalog consumer or pinning is added.

### Regression and recovery evidence

Six new real-SQLite HTTP regressions cover shared immutable-proof reuse across
individually authenticated requests; revalidation on object restart; changed,
repeated malformed, restored and missing origin bytes; controlled digest
contention; namespace timeout before commit and after commit; receipt-write
rollback; and recovery with the same request. A deterministic timer test checks
no response at 9,999 ms and the existing 503 at 10,000 ms without changing the
production deadline. Before-commit timeout leaves all authoritative rows
unchanged at response time, then the released operation commits exactly once.
After-commit timeout finds head sequence 2 and one committed HTTP receipt.

Recovery recreates the catalog object, reads its committed receipt, repeats
the identical activation twice and compares authoritative SQLite tables byte
for byte. It rejects conflicting operation-ID reuse, a reviewer activation
and invalid authentication; it allocates no extra dataset version or audit.
The rollback test injects a real SQLite trigger failure at HTTP-receipt insert,
after activation changes have begun. Head, candidate, revision state, labels,
audit and both receipt tables remain unchanged; receipt lookup is `unknown`
and the unchanged operation succeeds after removing the fault and restarting.
Rate counters/navigation are kept separate from that authority comparison.
Existing U4 tests still fault every authoritative activation write.

The strengthened real workerd test performs review and separate validation,
commits activation in the actual SQLite DO, deliberately discards its success
response in a **test-only** transport adapter, disposes workerd, restarts it
against the same SQLite files and recovers the exact receipt. Identical replay
succeeds; conflicting reuse fails with 409; only one activation event and the
original proposal's dataset versions remain. Production bundles contain no
test adapter/issuer. Network guards and containment tests retain zero provider
requests and no public sync/publication authority from catalog activation.

### Exact corrective file inventory

Existing baseline files modified:

- `services/edge-api/src/admin/identity/service.ts`: pass the DO-owned pure proof
  into a request-local workflow; authentication/request lifecycle stays local.
- `services/edge-api/src/identity/catalog/admin-workflow.ts`: optional proof
  injection through the existing repository constructor chain.
- `services/edge-api/src/identity/catalog/repository.ts`: delegate the existing
  exact-byte proof memo after the mandatory SQLite read.
- `services/edge-api/src/identity/durable-object.ts`: own one proof per object.
- `services/edge-api/test/admin/identity/support.ts`: track and drain pending
  namespace operations before closing SQLite.
- `services/edge-api/test/admin/identity/api.test.ts`: await that cleanup.
- `services/edge-api/test/admin/identity/local-worker.ts`: test-only lost-response
  fault after the actual commit.
- `services/edge-api/test/admin/identity/local.test.mjs`: strengthen real process
  restart/replay/conflict/audit/version assertions after the lost response.
- `docs/operations/GridView_Identity_Catalog_U5.md`: append this corrective record;
  preserve all original bytes as its prefix.

New retained paths:

- `services/edge-api/src/identity/catalog/origin-proof.ts`.
- `services/edge-api/test/admin/identity/recovery.test.ts`.
- `docs/operations/identity-u5-correction-baseline.json`.
- `docs/operations/identity-u5-correction-preservation.json`.

Temporary diagnostic tests and this section's temporary assembly file are
removed. Ignored local acceptance logs are identified below, not source edits.

### Validation record

Before correction, the exact original test passed in isolation (6.59 s suite)
and all 29 API tests passed together (48.39 s). These did not establish
acceptance. The new immutable-proof reuse regression then failed as intended:
expected one `validateSeed` call across requests, observed two. The controlled
delay reproduction returned the expected problematic 503 and later committed.
The initial sandboxed test attempt could not start (`spawn EPERM`); it was
rerun with authorized local subprocess access. No assertion or deadline was
weakened to hide an unexpected test failure.

| Corrected check | Exact result |
| --- | --- |
| Recovery group before its final contention case was added | 5 passed, 12.18 s suite. |
| Final recovery plus real workerd restart tests | 7 passed in 2 files, 22.07 s. |
| Complete U5 API/CLI and U1-U4 identity group | 286 passed in 31 files, zero skips/failures, 194.07 s. |
| Original failure case repeated sequentially | 5/5 passed; suite durations 5.51, 5.05, 5.09, 5.15 and 5.07 s; each name filter deselected the other 28 API tests. |
| Administration, mapping, provider containment and publication authority | 2,458 passed in 127 files, zero skips/failures, 126.15 s. |
| Typecheck | Both Worker and script projects passed. |
| Lint / edge-api formatting | Both passed. |
| `node scripts/identity/compile-schemas.mjs --check` | Passed; generated validators unchanged. |
| Content validation | 18 checked, zero failures. |
| Fixture/schema validation | 32 checked, zero failures; 31 strict and the existing one expected-tolerance case. |
| Public OpenAPI validation | Passed; public schema unchanged. |
| Full edge-api acceptance and final preservation/diff check | See the final corrective acceptance result below. |

Test runs use `--maxWorkers=1 --testTimeout=30000`; neither test nor production
deadlines changed. Test groups ran sequentially. Only static checks ran beside
the first identity group. Full-suite external opt-ins were verified unset.
Node's experimental SQLite warning is retained; PowerShell may label that
stderr warning `NativeCommandError`, but the successful npm processes exit 0.

Local ignored evidence logs under `services/edge-api`:
`identity-u5-correction-focused.log`, `identity-u5-correction-repeat-1.log`
through `identity-u5-correction-repeat-5.log`,
`identity-u5-correction-containment.log` and `identity-u5-correction-full.log`.
The original acceptance logs remain untouched. Full-suite acceptance, residual
risks and recommended U6 gates are finalized in the following subsection.

### Final corrective acceptance result

**U5 local implementation acceptance is complete as of 2026-11-15.** The
historical failed result above is preserved, not rewritten as a pass. This
accepts the corrected local U5 mechanism against the required regression gates;
it does not claim certainty about an uninstrumented historical exception or
production latency, and it does not authorize U6 or an environment change.

The final full edge-api command was:

```powershell
npm test -- --maxWorkers=1 --testTimeout=30000
```

It exited **0** with **6,105 passed, six existing opt-in skips, zero failures**:
294 files passed and three opt-in files skipped, 297 files / 6,111 test cases
total. It started at 11:17:20 local/UTC and took **377.59 seconds**. All six
new recovery regressions and the unchanged original API assertions were
included. No skip was added; the six existing opt-in skips are unrelated
application/live-capture/controlled-export cases. No full-suite test failure
occurred after correction. The 286-test identity group, 2,458-test containment
group, five exact-test repetitions and static/content/schema checks above also
passed. These results are overlapping checks, not additive test totals.

Final `git diff --check` passed. The final preservation comparison verifies:

- All 1,473 original tracked/nonignored paths still exist.
- **1,464 remain byte-identical** to the pre-correction snapshot.
- Exactly the nine existing paths listed above changed. The report is
  append-only: hashing its original byte-length prefix reproduces its exact
  baseline SHA-256. The other eight changes are the listed U5 correction/tests.
- Exactly four retained paths were added, as listed above. The preservation
  file lists itself as a new path but excludes its own digest to avoid a
  self-referential hash; every other retained source file is inventoried.
- Branch and HEAD match the baseline; the index still matches HEAD.
- Initial investigation, content, mapping, U0-U4, CLI, Android/signing,
  deployment configuration and all other source files are unchanged.

There is no remaining local U5 test/acceptance blocker. Residual operational
risks remain: the historical exception lacks conclusive internal attribution;
cold-start proof validation and larger admitted catalogs require provisioning
latency/memory/capacity measurement; arbitrary stalls or response loss remain
uncertain until receipt recovery; human evidence/duplicate-review mistakes
remain possible. The proof cache is an optimization, never an availability
fallback or an authority source. Existing export/restore custody, named primary
and backup reviewers/activators/recovery owners, secure credential delivery and
separate environment approval remain prerequisites to any provisioning/cutover.
No named owner, real credential or identity approval is invented here.

### Recommended U6 prerequisites and acceptance criteria

These are recommendations for a **separately authorized future unit**, not a
start instruction or an assertion that U6 exists.

Prerequisites: explicit PO authorization for U6, retained U4 and this complete
U5 acceptance evidence, unchanged ADR 0029-0031 authority/version/recovery
contracts, and a reviewed inventory of every identity-consuming entry point.
Retain the U7 batch compatibility and U8 isolated recovery/cutover gates; U6
code completion alone must not enable a runtime environment. Operational
ownership/credential/latency/capacity/backup gates precede provisioning, not
synthetic local implementation.

Future U6 acceptance should demonstrate:

1. One complete immutable catalog/profile/base/metadata context per run, pinned
   after lease/recovery/planning and before provider-port construction or any
   provider request. Nothing-due behavior and existing deadlines remain valid.
2. Scheduled/manual synchronization, verification and identity-consuming
   diagnostics share that admission contract; offline/batch consumers have an
   explicit complete context with later U7 provenance, never hidden defaults.
3. Bundled behavior remains the default until a separate cutover gate. Missing,
   invalid or unavailable required runtime context produces zero provider and
   publication calls, releases the lease and never falls back to a cached head
   or bundled authority. Existing public snapshots remain readable.
4. The accepted two-second pin call and at most one identical run-ID retry fit
   existing coordination/publication budgets. Lost-response/restart recovery
   returns the original pin; conflicting run-ID reuse fails. This U5 origin
   proof memo is not a run pin.
5. Mid-run activation leaves an existing pin unchanged and later runs see the
   later activated revision. Test concurrency, corruption, outage and restart
   against actual SQLite and complete provenance/exports.
6. Exact dataset/projection/base/profile equality, reconciliation hash/schema
   behavior, D14-D16 historical guards and complete sequencer-owned publication
   authority remain intact. No optional-driver inventory mode, U7 batch-v2
   implementation, real curation or deployment is implied.

Work stops at U5. No U6/U7 implementation, cutover, inventory-policy change,
provider-facing request, operational synchronization/publication, credential
provisioning, email, Cloudflare/Webdock modification or deployment occurred.
The UI-redesign worktree was not accessed. No commit, push or merge occurred.
