# U6: whole-run identity context and durable runtime catalog reader

Implementation date: 2026-11-15. Scope: U6 only, local implementation and
synthetic validation. U7 and later units are not authorized by this report.
No real identity approval, remote activation, operational synchronization,
publication, provisioning, deployment, commit, push or merge was performed.

## Authority and preservation baseline

The technical design sections 6.3, 11 and U6, ADRs 0029–0031, the U4 report,
the entire U5 report including its corrective acceptance, and the U5 operating
guide govern this implementation. Earlier reports retain their original bytes
and historical unit boundaries. The U5 origin proof remains a pure validation
optimization; it is never a run pin or a replacement for SQLite admission.

Work used only `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. The UI-redesign worktree was not
accessed. Before editing, Git status, branch and HEAD were checked and
[the U6 baseline](identity-u6-baseline.json) recorded the complete expanded
status and SHA-256/byte length of all **1,477 tracked/nonignored existing files**.
Ignored dependencies, existing local runtime state and transient logs are
outside that source inventory. No reset, checkout, staging or cleanup of prior
work was used.

The final machine-readable [preservation comparison](identity-u6-preservation.json)
lists every unchanged, intentionally modified, added and missing path, with
before/after hashes. Earlier November investigation, U0–U5 modifications and
untracked files remain present. In particular, content registries/mappings,
the corrected R0 artifacts, previous reports, dependencies, Android/signing,
public API/Flutter, provider transports/limiters, reconciliation and publication
authority implementations are unchanged by U6.

## Implementation and exact source inventory

All service paths below are relative to `services/edge-api/`.

New production modules:

- `src/identity/catalog/bundled-context.ts`: explicit complete reviewed bundled
  inputs and sealed base documents, using existing exact-key/profile utilities.
- `src/identity/catalog/pin-contract.ts`: closed run/pin decoders, identity of a
  logical execution and immutable pin receipt protocol.
- `src/identity/catalog/pin.ts`: additive SQLite migration and authoritative,
  durable, installation-scoped pin admission/recovery.
- `src/identity/catalog/run-context.ts`: complete immutable context construction,
  verified lineage reader, bounded pin client and diagnostic comparison.

New test modules:

- `test/identity/catalog/run-context.test.ts`.
- `test/identity/catalog/pin-local.test.mjs`.
- `test/identity/catalog/batch-boundary.test.ts`.
- `test/identity/catalog/u6-support.ts` (isolated synthetic profile proposal).
- `test/sync/coordinated/identity-context.test.ts`.
- `test/sync/coordinated/identity-verification.test.ts`.

Pre-existing source/tooling modules intentionally modified:

- `src/config/environment.ts`: strict catalog-mode parser; absent means bundled.
- `src/identity/catalog/projection.ts`: narrow its structural input type to the
  fields the existing projection actually reads; projection algorithm unchanged.
- `src/identity/durable-object.ts`: namespace-only pin operation on the existing
  object; share its existing pure origin proof, never mutable admission state.
- `src/identity/storage-accounting.ts`: include optional run-pin bytes in the
  existing shared logical capacity budget.
- `src/identity/factory.ts`: discovery provenance comes from the admitted run
  context, rather than a separate bundled resolver/hash in runtime executions.
- `src/index.ts`: explicit configuration for coordinated entry points and v1
  ingest; defer discovery creation until the complete context exists.
- `src/providers/factory.ts`: refuse the legacy bundled/mock provider path in
  runtime mode, including its test override; existing public reads remain usable.
- `src/logging/logger.ts`: closed `equal|different|unavailable` comparison field.
- `src/sync/coordinated/composition.ts`: separate transport/dependency admission
  from context-dependent port construction; explicitly inject all five families.
- `src/sync/coordinated/observation/observe.ts`: lease/recovery/plan/context/ports
  ordering, bounded identity failures, lease/budget rechecks and cleanup.
- `src/sync/coordinated/operator/verification.ts`: context admission after target
  and replay checks, under the existing lease; stable verification run identity.
- `src/sync/coordinated/run.ts`: remove the earlier pre-lease discovery factory
  invocation; preserve existing trigger, publication and recovery semantics.
- `src/sync/coordinated/calendar-single-get.ts` and `egress-identity.ts`: compose
  only the hardened transport; neither diagnostic resolves provider identities.
- `src/ingest/service.ts`: reject runtime v1 both at admission and direct ingest.
- `scripts/season-batch/generate.ts`: complete explicit bundled context and
  injections; runtime/invalid-mode rejection before reading capture content.
- `scripts/season-batch/cli.mjs`: pass only the explicit catalog mode into the
  generator; no new manifest, artifact or submission fields.

Pre-existing test modules intentionally modified:

- `test/identity/catalog/parity.test.ts` and
  `test/admin/identity/boundaries.test.ts`: permit the U6 pure reader while
  retaining exclusion of administration/write authority and all identity
  dependencies from the public-read graph.
- `test/identity/catalog/u4-local-worker.ts`: explicitly isolated synthetic
  reader host, allowing U6 to read synthetic child revisions in actual workerd.
- `test/providers/provider-neutrality.test.ts`: enumerate the four additional
  pure profile edges from bundled/runtime context construction. Direct provider
  origins, global fetch, port creation and registration guards remain enforced.
- `test/providers/mappings/mapping-containment.test.ts`: add only the exact
  bundled/runtime context utility imports to the existing mapping ownership
  allowlist; preserve its blanket rejection of any other mapping consumer.
- `test/season-batch/dormancy.test.ts`: permit only the one nonsecret CLI mode
  read; all other environment/network/credential restrictions remain enforced.
- `test/sync/coordinated/observation/dormancy.test.ts`,
  `operator/operator.test.ts`, `outcome/dormancy.test.ts` and
  `policy/dormancy.test.ts`: enumerate the exact context/metadata dependency.

Repository-level additions are this report, `identity-u6-baseline.json` and
`identity-u6-preservation.json`. No package, lockfile, deployment configuration,
mapping, canonical identity, public schema or application DTO was changed by U6.

## Complete identity-consuming entry-point inventory

| Entry point or seam                                                        | U6 identity authority and boundary                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled coordinated synchronization, `index.ts` → `runCoordinatedSync`   | Admit once after existing lease, authoritative recovery and due-work planning. Nothing due does not pin or build ports.                                                                                     |
| Manual full coordinated synchronization, `/internal/admin/sync/full`       | Same admission/orchestration; existing forced-publication/cadence rules retained.                                                                                                                           |
| Operator staged-classification verification                                | Existing target/generation/replay/eligibility checks first; then pin under its lease before its one provider request. Never publishes.                                                                      |
| Calendar adapter normalization                                             | Supplied pinned resolver and event names through the complete context. It is not a second independently composed operational entry point.                                                                   |
| Calendar-once diagnostic, `/internal/admin/provider/jolpica/calendar-once` | Raw HTTP count/status diagnostic; intentionally never decodes/resolves canonical identities. Transport-only composition, no pin, ledger or publication.                                                     |
| Jolpica egress-identity diagnostic                                         | Transport-only `/test/` probe; no identity resolution and no unnecessary catalog pin.                                                                                                                       |
| Offline recorded season-batch generation                                   | Complete explicit bundled context; replay-only transport. Runtime v1 rejected pending U7. CLI passes explicit mode.                                                                                         |
| Worker batch admission and direct ingest                                   | Bundled/compare v1 retain the reviewed workflow. Runtime v1 always rejected before verification/publication, including a direct-call bypass attempt.                                                        |
| Batch manifest/submission/fixture preparation                              | Existing v1 archive/review tooling remains explicitly bundled compatibility tooling. It cannot authorize runtime ingestion; Worker and generation gates remain authoritative. No submission/schema changes. |
| Legacy full/resource/home synchronization using mock/none                  | Runtime cannot obtain the legacy bundled provider, even through `__PROVIDER`. Existing failed `provider-unavailable` outcome; no provider requests/publication.                                             |
| Mock provider and fixture generation invoked directly by tests/tooling     | Explicit bundled test fixtures; no runtime authority or catalog selection.                                                                                                                                  |
| Seed preparation, validation, parity/export tooling and U5 administration  | Existing complete reviewed artifacts and immutable catalog validation. These are not provider execution/publication entry points and do not acquire run pins.                                               |
| Pure normalizers and five Jolpica port constructors                        | Legacy-compatible optional defaults remain for explicit bundled adapter tests. Operational/runtime construction is confined to the guarded composition; recorded generation explicitly supplies all inputs. |
| Outcome metadata helper / guarded publication bridge                       | Operational runtime always supplies pinned metadata. Existing bundled test/legacy compatibility defaults remain. Catalog has no publication command/lease authority.                                        |
| Discovery evidence side effect                                             | Uses the same run ID, catalog reference and resolver. It remains best effort and cannot authorize a provider row or publication.                                                                            |
| Public router/snapshot reads                                               | No catalog dependency, pin or identity resolution; served snapshots stay available during runtime admission failures.                                                                                       |

Source searches cover all `new Jolpica*`, `providerMappingRegistry`, curated
profile/event lookup and bundled registry/season metadata imports in `src` and
tooling. Module-graph tests guard the actual emitted graph, including orphan
runtime modules; no direct operational constructor path was left unreviewed.

## Context structure and provenance

`IdentityRunContext` contains run ID; explicit installation ID; selected mode
and authority; season; runtime revision ID or explicit bundled null revision;
complete content hash; effective season projection and its U3 hash; dataset
label; the complete verified resolver and bindings; all canonical driver,
constructor, circuit and event profiles; participant/circuit/name lookups;
immutable base document references/digests; season metadata; `strict/1`
inventory policy; and the original durable pin when runtime-authoritative.

Bundled compatibility has an explicit `bundled-repository` installation marker
when no installation UUID was configured. It is not an `ENVIRONMENT` alias or
a runtime installation. Compare/runtime catalog calls require the explicit
installation UUID and that Worker's own binding. Routing uses
`identity:<installation UUID>`; the object independently checks its persisted
installation. Staging and E2E cannot be identified by their shared environment
string. No namespace/configuration changes were made.

Runtime loading reuses U4's complete revision-export lineage verifier, U3 source
and profile validation, the corrected effective projection helper, hashing and
the established complete mapping-registry builder. It verifies the pin request,
receipt hash, revision/hash, projection, dataset and sealed base together. No
partial registry/profile subset is exposed. Unsupported sealed base content
fails admission rather than merging current Git data into runtime profiles.
Legal attribution remains the explicitly supported deployed policy and is
included in the context's immutable references. Runtime metadata comes from
the pinned base, with the U4-assigned dataset label.

Objects, arrays, profile data and projections are deeply frozen. The resolver's
internal index is hidden behind bound existing resolver methods; no mutable Map
is exposed. Event names use an immutable view. Curated lookup methods return
detached values, so modifying a caller's returned profile cannot change the
context. A private WeakSet admits only complete constructed contexts; a forged
or spread partial context cannot be passed into runtime composition.

Bundled and runtime content hashes intentionally have different provenance
envelopes. R0 parity compares the effective content, complete profiles/bindings,
base references, metadata and outputs, not equality of those envelope hashes.
Catalog revision IDs/hashes stay private and do not enter classification hashes
or public v1 documents. Public `contentVersion` remains the dataset label.

## Durable admission and recovery protocol

The namespace-only `POST /run-pin` is served by the existing `IdentityCatalog`
DO. It is not a new publicly routed administrative endpoint. It accepts a
closed schema-v1 request with run ID, installation, season, purpose and
available lease fence. Purposes are scheduled, manual, operator verification
and identity-consuming calendar diagnostics (the current raw diagnostic needs
none). It receives no provider key, reviewer token or publication command.

Two additive tables, `identity_run_pin_migrations` and `identity_run_pins`,
retain their own format/version and immutable pin receipts. Existing U2/U4
migration bytes, their checksums and ledger schema v1 are unchanged. Pin rows
reference immutable catalog revisions, with canonical original request/receipt
bytes and receipt hash. Shared capacity accounting includes their bytes;
capacity exhaustion refuses new admission instead of evicting historical pins.

For a new run, the repository verifies open admission, an activated head and
its activation sequence, the entire revision/lineage/indexes, exact season and
dataset relationships. Hashing/expensive pure validation is outside the SQL
transaction. The synchronous admission transaction rechecks the exact head,
revision bytes, profile/binding indexes and activated season relationship,
then inserts the pin and checks capacity atomically. Exceptions roll it back.
There is no await between related writes. A concurrent head change refuses
admission; an isolate active-head cache is never consulted as authority.

For an existing run ID, the repository verifies the stored receipt and loads
that exact revision. A changed installation, season, purpose or schema fails
explicitly. Activation or admission pause cannot replace an existing pin. A
later new run can select the newly activated revision. Missing/corrupt snapshot,
profile, index, season relationship or receipt hash invalidates the entire pin.

The logical execution identity is run ID/installation/season/purpose/schema.
Lease fence is first-admission provenance, not a replacement publication lease.
Recovery under a reacquired season lease retains the **original admitting
fence and receipt unchanged**. This does not authorize an old fence: the
existing operational lease is acquired/rechecked independently. Each client's
two attempts have identical bytes, including their current fence. Operator
verification uses its operation UUID as stable run ID, so an uncertain record
write followed by a retry cannot silently adopt a later revision.

Each pin attempt, including response-body reading, is limited to **2,000 ms**
(10,000 ms since the ADR 0031 amendment of 2026-11-23),
with at most one identical retry. Both attempts and complete context validation
consume the existing run budget. No coordination, publication-intent,
verification, provider or U5 administrative deadline was enlarged.

## Synchronization and lease integration

The order is dependency/configuration admission → existing fenced season
lease → authoritative publication read/reconciliation/recovery → existing
planner → complete identity admission if work is due → identity-dependent port
construction → provider requests → unchanged observation, reconciliation,
guarded whole-season publication and lease cleanup.

The early runtime contains only the ledger reference. Transport-only diagnostics
construct only pacer/client. All five operational resource families receive
the exact same resolver object; participants also receive the same canonical
driver/constructor lookup, circuits the same circuit lookup, calendar the same
event names, and publication the same pinned metadata. There is no mid-run
lookup of the active catalog and no runtime branch left on optional bundled
constructor defaults.

Before transport, the orchestration rechecks cancellation/budget and lease time,
including after context loading and shadow setup. Failed runtime admission
returns bounded `catalog-unavailable`/`catalog-invalid`, makes zero provider
requests and publication attempts, and releases its acquired lease. Expired
leases may correctly refuse release; the existing fence/expiry rules still
control cleanup. Verification uses its existing precondition result surface
with those same bounded causes and unchanged target/lease authority.

Completed contexts need no further catalog I/O. Catalog outage after admission
cannot mutate their profiles, mappings or metadata. U6 introduces no mandatory
completion-receipt write or separate completion authority: a missing or failing
post-run catalog channel cannot duplicate publication. Existing sequencer and
ledger recovery alone determine publication/verification outcomes. The pin is
the durable identity receipt, even if a caller loses its response.

## Modes, publication and batch boundary

- **Bundled** is the absent-variable default. No pin or additional provider
  request is made; complete reviewed bundled inputs remain authoritative.
- **Compare** pins/verifies diagnostically when available, emits only a bounded
  equality/difference/unavailable code and uses the bundled context for all
  provider normalization and publication. Diagnostic failure cannot substitute
  runtime data or change the selected identity authority.
- **Runtime** requires a complete authoritative pin/context. Binding,
  installation, admission or snapshot failures never fall back to bundled data
  or a cached revision. Legacy/mock execution cannot bypass that rule.

Strict exact typed mappings, season scope, required classifications/inventory,
driver-span derivation, standings-round coherence and whole-season assembly
are unchanged. Unknown drivers still fail their complete resource. No optional
driver inventory, identity closure or row filtering was added. Catalog activation
does not touch reconciliation confirmation records or publish anything.
D14/D15 predecessor content guards, D16 CAS, sequencer ordering, publication
recovery and release ownership retain their existing implementations.

New runtime-authoritative v1 batch generation and ingestion are explicitly
rejected with `runtime-batch-requires-u7`, including seed R0. U6 intentionally
does not invent an R0 v1 admission gate: bundled/compare preserve the reviewed
v1 workflow, while all runtime v1 submission remains closed pending U7. Offline
generation has explicit complete bundled inputs and a replay-only transport.
Invalid generator modes fail explicitly. Archived v1 parsing/review remains
available; readability is not permission to ingest it under runtime authority.
No batch v2, new manifest fields, submission changes or hidden export/network
fetch was implemented.

## Synthetic activation, SQLite and performance evidence

Tests activate only isolated local synthetic revisions. “R10/R11” denotes the
old/new test revisions; actual revision UUIDs are generated by the fixture.
One test starts a complete run with R10, verifies a durable pin exists before
the first provider transport invocation, activates a synthetic reviewed profile
revision R11 there, and then removes catalog availability. Run A publishes or
withholds only under the existing rules with R10 profiles/metadata/mappings;
the next run pins R11. Results data remains identical, dataset metadata changes
as U4 requires, and no classification corroboration is reset.

Equivalent verification tests activate during the sole classification request,
retain the old context for that operation, and obtain R11 on a new operation.
Identical already-recorded verification replay sends nothing and does not pin.
An unavailable verification-record write followed by activation and a new lease
recovers the original operation's pin instead of silently repinning.

The actual workerd test uses `Miniflare` with SQLite-backed `IdentityCatalog`,
persisted files in a verified temporary directory and a throwing outbound
transport. It seeds/validates/activates locally, pins R10, discards the caller's
success, activates synthetic R11, disposes workerd, recreates it on the same
SQLite files, and recovers the exact R10 receipt. A new run reads R11. Both
contexts verify with the complete offline lineage reader. Conflicting run ID
and installation reuse fail, and actual `.sqlite` files are asserted present.
Separate SQLite tests inject receipt-write rollback and corrupt complete data.

In the explicit final focused run, local workerd measured **386 ms cold pin**
and **454 ms restart recovery** (request plus response decoding). These are
synthetic R0-scale observations, not production guarantees. The complete
workerd seed/profile/activation/restart scenario took 4.331 seconds; that
scenario includes several distinct administrative operations, not one pin.
The focused run's complete-context parity test took 1.776 seconds including
seed setup, SQL activation, pin, bundled context and runtime lineage checking.
Timers deterministically assert no retry at 1,999 ms, the single identical
retry at 2,000 ms, and failure after the second 2,000 ms attempt. No real clock
deadline was relaxed to obtain a pass.

## Validation record

Commands run from `services/edge-api`, using one Vitest worker and
`--testTimeout=30000`, with external opt-ins left disabled. Results overlap
and must not be added together.

| Check                                                                                                                   | Final result                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused U6, pure/SQLite context, operational parity/verification, batch gates and selected graph regressions            | 82 passed in 8 files, zero skips/failures, 67.79 seconds; final additional legacy-boundary test and full-suite acceptance recorded below.                                                                                                                                                                               |
| U1–U6, U5 admin/CLI, coordinated synchronization, verification, provider-neutrality and batch/ingest intermediate group | 1,538 passed, 3 failed in 99 files, 290.25 seconds. The three failures were the new internal RPC URL's textual containment check, the preserved missing-season batch outcome, and one obsolete pre-U6 graph expectation. All corrected; final acceptance must pass their unchanged functional/containment requirements. |
| Initial coordinated/U1 parity group                                                                                     | 918 passed, 5 obsolete graph assertions failed; updated only the authorized U6 reader edges.                                                                                                                                                                                                                            |
| Typecheck                                                                                                               | Both Worker and scripts passed after correcting new type errors.                                                                                                                                                                                                                                                        |
| ESLint / package formatting                                                                                             | Passed.                                                                                                                                                                                                                                                                                                                 |
| Generated catalog validators                                                                                            | `node scripts/identity/compile-schemas.mjs --check` passed; generated bytes unchanged.                                                                                                                                                                                                                                  |
| Curated content                                                                                                         | 18 checked, zero failures; 94 mappings, 101 evidence identities, seven unresolved acknowledgements and dataset `2026.10.07.1` retained.                                                                                                                                                                                 |
| API fixtures                                                                                                            | 32 checked, zero failures: 31 strict and one existing expected-tolerance fixture.                                                                                                                                                                                                                                       |
| Public OpenAPI                                                                                                          | Passed; schema bytes unchanged.                                                                                                                                                                                                                                                                                         |
| Local Wrangler configuration type generation                                                                            | Passed; only ignored `worker-configuration.d.ts` generated. No remote operation.                                                                                                                                                                                                                                        |
| Full edge-api suite                                                                                                     | 6,145 passed, six existing opt-in skips, zero failures/timeouts; 299 files passed and three skipped (302 total), 472.06 seconds.                                                                                                                                                                                        |
| Preservation / `git diff --check`                                                                                       | All 1,477 original files present; 1,450 byte-identical, 27 intentional U6 extensions, 13 added paths; branch/HEAD/index preserved; whitespace check passed.                                                                                                                                                             |

The first full acceptance run is retained separately as
`identity-u6-full-first.log`: **6,144 passed, one failed, six existing skips**,
298 files passed / one failed / three skipped, 472.17 seconds. Its sole failure
was the pre-U6 mapping-import allowlist. The exact four new reader utility
imports were added; the 25-case containment suite then passed in 2.06 seconds.
The subsequent complete suite above passed every test, including that guard
and all 40 U6-specific cases, with no extra skip or enlarged timeout.

Earlier development attempts had these observed results (overlapping checks,
not cumulative totals):

| Attempt                            | Observed result                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| First new context/SQLite group     | 18 failed, one passed, 15.22 seconds; migration execution/base checks and fixture problems described below.                  |
| Second context/SQLite group        | Two failed, 17 passed, 22.66 seconds; fixture command shape and the intentional corruption fixture's foreign-key constraint. |
| First combined U6 group            | Two failed, 29 passed, 35.35 seconds; synthetic reader authority and profile-review reason fixture.                          |
| Corrected four-file U6 group       | 33 passed, zero failures, 43.24 seconds.                                                                                     |
| Added legacy-path assertion        | One failed, 15 passed, 18.76 seconds; expected `skipped` instead of the actual `failed` refusal.                             |
| Corrected legacy/operational group | 16 passed, zero failures, 18.69 seconds.                                                                                     |

Initial Node/Vitest and Wrangler attempts were blocked by sandbox `spawn EPERM`;
they were rerun with authorized local subprocess access. Those startup failures
are not passing tests or product failures. Intermediate implementation failures
included lazy SQLite migration execution in the test adapter, stripped `$schema`
base parity, test fixture/review shapes and synthetic authority, plus new type
errors; these were corrected without changing operational deadlines. The new
legacy-boundary assertion initially expected `skipped`; the existing service
correctly returned the stronger `failed / provider-unavailable`, and the test
now asserts that established result. No guard or deadline was weakened.
Node's experimental SQLite warning remains visible in logs.

Ignored local logs include `identity-u6-initial.log`, `identity-u6-context.log`,
`identity-u6-focused.log`, `identity-u6-regressions.log`,
`identity-u6-final-focused.log`, `identity-u6-final-boundary.log`,
`identity-u6-containment-final.log`, `identity-u6-final-recheck.log`,
`identity-u6-full-first.log` and `identity-u6-full.log`. Some U6 development log
names were reused during iteration; final logs and the first full failure are
retained separately. Earlier U0–U5 acceptance logs were not modified.

## Remaining operational gates and U7 prerequisites

U6 local acceptance does not authorize a mode switch. Production configuration
is unchanged, and no committed environment has gained an identity catalog
binding or runtime selection. A future authorized deployment needs each
Worker's **own** SQLite `IdentityCatalog` binding named `IDENTITY_CATALOG`, its
own explicit `IDENTITY_INSTALLATION_ID`, the applicable independently reviewed
SQLite class/export declaration and retained namespace identity, reviewed seed,
individual administration configuration, and recovery ownership. E2E must not
borrow staging's namespace/installation just because both say `staging`.
No namespace IDs, real credentials or human assignments are invented here.

Before U7: retain corrected R0/export provenance, U4 dataset relationships and
U5 administrative recovery; design explicit local verified-export input and
private batch v2 provenance; preserve the v1 runtime refusal until an approved
compatibility policy exists; test full source/profile/projection/policy equality
and stale/replayed submissions under the existing sequencer guard. No public
schema or Flutter change is implied. U8 still owns isolated restore/cutover
rehearsal; U9/U10 own inventory relaxation/identity closure; U11 owns separately
authorized staging rollout.

Larger catalogs/lineages, digest contention, storage capacity and cold-start
latency need measurement before deployment. The fixed two-second attempts may
fail closed under stalls; this report does not propose extending budgets.
Pins accumulate under existing logical capacity and are not silently evicted.
New sealed base content must be supported by the reviewed deployed build;
arbitrary base imports are deliberately not merged at admission. A lost pin
response may leave a durable receipt without an executing provider run, which
is safe and recoverable by its original logical run ID. Hard-stop publication
uncertainty remains the existing ledger/sequencer recovery's responsibility.

Stop at U6. No real approval/activation, provider-facing request, operational
sync/publication, email, Cloudflare/Webdock modification, deployment, UI-redesign
work or Git commit/push/merge is part of this implementation.

## Final local acceptance and preservation

**U6 local implementation acceptance is complete.** The final full edge-api
command `npm test -- --maxWorkers=1 --testTimeout=30000` exited 0 with
**6,145 passed, six existing opt-in skips, zero failures and zero timeouts**.
There were 299 passing files and three skipped files, 302 files / 6,151 cases
total. It started at 13:12:46 UTC and took **472.06 seconds**. Its 40 additional
U6 cases cover complete contexts, all five ports, actual SQLite restart,
idempotency, corruption, activation, verification, compare behavior, runtime
batch/legacy refusal, lease cleanup and budget/cancellation boundaries. All
U1–U5, corrected projection/seed, API/CLI, adapter, limiter/proxy, reconciliation,
D14–D16 and sequenced publication regressions passed in that run. U5's existing
10-second administrative deadline and its recovery assertions remain unchanged.

The six skips are the existing opt-ins in
`test/e2e/automatic-updates/app-gate.test.ts`,
`controlled-source-export.test.ts` and `staging-first-run-rehearsal.test.ts`.
Their app/capture/export environment controls were verified unset. No new skip
or live provider/capture opt-in was enabled.

After the full run, a **35-test, three-file strengthened recheck** passed with
zero failures/skips in **45.40 seconds**. It ensures every context test has a
throwing global network guard, faults the actual namespace transport already
captured by the run after admission, asserts precisely one catalog call for
run A and two after run B, and drives both raw calendar and egress diagnostics
in runtime mode with a binding that throws if used. It also measures full
lineage/context loading separately. No production implementation changed
after the successful full-suite run.

This last persisted-workerd measurement was **382 ms pin, 462 ms restart pin
recovery, 279 ms complete client context verification/loading**. The entire
seed/review/activation/pin/restart scenario took 4.174 seconds. These are
additional isolated local observations; the earlier measurements remain above
as recorded. Neither sample establishes production or maximum-capacity latency.

Final Worker/script typecheck, ESLint, package Prettier and generated-schema
freshness checks all exited 0. Content, fixtures, OpenAPI and local Wrangler
configuration checks above passed. Root operational report/inventory formatting
and `git diff --check` also passed.

The final preservation comparison establishes:

- All **1,477** pre-U6 tracked/nonignored paths still exist.
- **1,450** retain identical bytes and SHA-256 hashes.
- Exactly **27** earlier files have intentional U6 changes, enumerated in this
  report and individually hashed before/after in the preservation artifact.
- Exactly **13** retained paths were added: four production modules, six test
  modules and the three U6 operational/report/inventory files. The preservation
  artifact lists itself without its own digest to avoid a self-referential hash.
- The complete expanded original/final Git status is retained. Branch and HEAD
  match the baseline, and the index still matches HEAD.
- Previous investigation/identity reports, original content/mappings and seed
  package, dependencies, all Android/signing and Flutter files, deployment
  configuration, public schema/fixtures and publication/reconciliation/transport
  implementations remain byte-identical to their pre-U6 versions.

There is no remaining local U6 acceptance blocker. The operational risks,
provisioning/custody/capacity gates and separately authorized U7–U11 boundaries
above remain open. Work stops at U6; no U7 implementation or deployed mode
change was started.
