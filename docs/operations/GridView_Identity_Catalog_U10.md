# GridView identity catalog - U10: required identity closure and complete guarded publication

**Status:** implemented and validated **locally only**. The acceptance full
run on the final code was clean: 6,381 passed, 6 opt-in skips, 0 failed (§15). Nothing is committed,
pushed, merged, deployed or activated. No remote environment, Cloudflare
resource, Webdock host, credential, catalog, provider endpoint or email path was
touched. No real identity, mapping or alias was approved. U11 is not started.

> **The optional policy is implemented but enabled nowhere.** No committed
> configuration selects `IDENTITY_INVENTORY_MODE=optional-drivers` (enforced by
> a test). Selecting it in staging is U11's separately authorized step.

Worktree `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`, index empty before and after.
Authorities: design §6.3-6.4, §8.1-8.4, §9.2, §11, §12 (T23-T35) and unit U10;
ADRs 0029, 0030 (PO-2) and 0031; U5-U9 reports.

## 1. Summary

U10 completes phase 3:

- A pure, deterministic **required-identity closure**
  (`season-identity-closure.ts`) supplies profiles for drivers that selected
  results, fastest laps, standings, derived spans or constructor lineups require
  but the provider inventory omits, **only** from the run's pinned catalog.
- Season assembly now has a **validated consumption boundary** for the private
  `driverInventory` accounting, replacing U9's refusal. The accounting is
  re-checked against the run's own policy and pinned catalog, consumed, and
  never reaches `ProviderSeasonSource`.
- **One immutable inventory policy per run** now flows end to end:
  configuration → durable pin request → `IdentityRunContext` → participants
  port, coordinator and assembly → batch-v2 `identityCatalog.inventoryPolicy`.
- The operational gate accepts `optional-drivers` **only** with runtime catalog
  authority, a UUID installation and a catalog binding. Bundled, compare,
  incomplete runtime and unknown values are configuration refusals. Nothing
  falls back to strict.
- Strict stays the default, and strict behavior, payloads, pins, receipts,
  request accounting and snapshots are byte-for-byte unchanged.

The complete positive case runs through the real guarded publisher in three
harnesses: the in-process and Durable Object sequencer transports, the
node:sqlite catalog batch-ingest path, and a persistent workerd SQLite
installation (§9, §12).

## 2. Exact file inventory

All paths are under `services/edge-api/` unless prefixed.

**New source (2):**

| File                                                    | Purpose                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/providers/coordination/season-identity-closure.ts` | Pure closure: `requiredDriverIds`, `closeSeasonDriverIdentities`, closed problem codes, `PinnedDriverProfiles`/`SeasonIdentityContext` types |
| `src/identity/catalog/closure-profiles.ts`              | `pinnedDriverProfiles(context)`: read-only view over an admitted context's profiles and verified season driver bindings                      |

**New tests (6):**

| File                                                               | Scope                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `test/providers/coordination/identity-closure.test.ts`             | Pure closure and assembly boundary (26 tests)                 |
| `test/providers/coordination/identity-closure-publication.test.ts` | Guarded publication, both sequencer transports (16 tests)     |
| `test/providers/coordination/identity-closure-support.ts`          | Shared synthetic fixtures (not a test file)                   |
| `test/identity/catalog/inventory-policy.test.ts`                   | Config gate, pin schemas, vocabulary, committed envs (10)     |
| `test/ingest/catalog-v2-optional.test.ts`                          | Generator + node:sqlite catalog guarded ingest (11)           |
| `test/identity/integration/optional-inventory.test.mjs`            | Persistent workerd SQLite catalog, Worker sync and ingest (9) |

**Modified (19 pre-existing files, U10 hunks only):**

| File                                                        | U10 change                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/providers/coordination/season-assembly.ts`             | Optional `identity` input; policy/accounting boundary; closure before source construction       |
| `src/providers/coordination/season-integrity.ts`            | Two relations appended: `driver-inventory-context`, `required-driver-profile` (assembly-only)   |
| `src/providers/coordination/coordinated-publication.ts`     | Optional `identity` option passed to assembly                                                   |
| `src/sync/coordinated/composition.ts`                       | Configuration ↔ context policy cross-check; identity context for publication                    |
| `src/identity/inventory/model.ts`                           | Closed `inventoryPolicyVersions`, batch mapping, runtime-only `inventoryPolicyForContext`       |
| `src/identity/catalog/run-context.ts`                       | Config gate, `pinRequestFor`, policy-bearing contexts, export policy, admission defence         |
| `src/identity/catalog/pin-contract.ts`                      | `PinRequest` = schema 1 (strict, unchanged) \| schema 2 (optional)                              |
| `src/identity/catalog/batch-admission.ts`                   | Admission request schema 2; policy-bound pin; v2 requires `legacy: false`                       |
| `src/config/environment.ts`                                 | `resolveOperationalInventoryMode(value, catalogMode)`                                           |
| `src/ingest/catalog-reference.ts`                           | Reference policy from context; exact policy equality in `matchesCatalog`                        |
| `src/ingest/catalog-admission.ts`                           | Context pin request matches the admission schema                                                |
| `src/ingest/service.ts`                                     | Admission request from the installation policy; legacy v1 refused under optional                |
| `scripts/season-batch/generate.ts`                          | `inventoryPolicy` input; one policy for port, coordinator, assembly; `inventory-policy-invalid` |
| `scripts/season-batch/cli-guards.mjs`, `cli.mjs`            | Explicit `--inventory-policy` flag (never from the environment)                                 |
| `scripts/identity/catalog-file.ts`                          | Passes the generation policy to `contextFromExport`                                             |
| `test/providers/jolpica/driver-inventory.test.ts`           | Two U9 gate tests updated to the U10 gate (superseded by design, not relaxed)                   |
| `test/sync/coordinated/entry-points/inventory-mode.test.ts` | +3 U10 gate cases                                                                               |
| `test/season-batch/cli.test.mjs`                            | +1 flag-parsing case                                                                            |

No public type, OpenAPI document, Flutter/Dart file, Drift schema, fixture,
content file, wrangler configuration or generated schema changed.

## 3. Required identity closure algorithm

```text
required = driverIds of every selected race result entry
         ∪ every non-null selected fastestLap.driverId
         ∪ every selected driver standing
         ∪ every derived (and contributed) participation span driver
         ∪ every driver in a non-null constructor lineup
output   = verified inventory profiles (provider order)
         ++ (required − inventory IDs), in exact UTF-16 code-unit order
```

- Inputs are the selected, validated resources after coordination and span
  derivation, and the pinned profile view. There is no network, clock, mutable
  catalog head or global driver list.
- Each inventory profile must be unique and equal (structurally, after
  `media: null`) to the pinned profile of its ID.
- Each supplemented ID is loaded from the same pinned view and must exist,
  answer for the same ID, pass `validateDriver`, and have a verified Jolpica
  driver binding for the season in the pinned revision.
- The closure returns profiles and the supplemented ID list only. It cannot
  create spans, teams, constructor associations or identities.
- Closed problems: `duplicate-inventory-driver`, `inventory-profile-mismatch`,
  `missing-profile`, `contradictory-profile`, `invalid-profile`,
  `unbound-profile`. They never carry a value.

## 4. Ordering and profile validation rules

- Verified inventory order is preserved exactly.
- Supplemented IDs are appended in locale-independent exact code-unit order
  (`'alpha-2-driver' < 'alpha-driver'` is tested).
- Profiles from the context are deep-validated here as well, not only those
  that passed through a provider port.
- Contradictions are refusals: a known key with a dangling target or invalid
  profile is never treated as an optional unknown.
- Equality is structural (independent of key order). This applies the review
  finding that strict `===` would make a future non-scalar `Driver` field fail
  spuriously.

## 5. Integration with selected resources and season assembly

`assembleSeasonSource(run, metadata, identity?)` keeps every existing step and
its order (`run-not-completed`, `resource-unavailable`,
`missing-required-resource`, round classification, OpenF1 participation
refusal, span derivation, standings horizon). U10 adds:

1. **Policy/payload agreement** (after required resources are present):
   - no identity input + accounting present → the exact U9 refusal
     (`inconsistent-references`, no relation);
   - identity input whose policy and payload disagree in either direction →
     `driver-inventory-context`;
   - optional policy: the pinned profiles' catalog hash must equal the policy
     catalog hash, and the closed U9 validator is re-run against the run's own
     policy → otherwise `driver-inventory-context`.
2. **Closure** (optional only, after span derivation and standings coherence):
   a failure maps to `driver-inventory-context` (duplicate or mismatched
   inventory profile) or `required-driver-profile` (missing, contradictory,
   invalid or unbound required profile), both under `inconsistent-references`.
3. **Unchanged** source construction from named public collections, then the
   unchanged `validateSeasonReferences`.

Strict runs never consult the pinned profiles (tested: zero lookups), and
assembly with a strict identity context equals assembly without one.

## 6. Internal accounting consumption and public removal boundary

`driverInventory` is read only by `Object.hasOwn` and the boundary validator.
`ProviderSeasonSource` is built field by field from public collections, so the
accounting is never placed in an intermediate public object. Tests serialize the
assembled source, every generated and stored document, the handed candidate set,
batch artifacts' `source`/`documents`, public API responses and logs, and assert
the absence of `driverInventory`, `candidateId`, `observationKeyHash`,
`projectionDigest`, `unmapped`, `inventoryPolicy`, the catalog hash, unknown
provider keys and the candidate IDs' hex.

## 7. Whole-run policy selection and pin/retry behavior

| Configuration                                           | Result                                       |
| ------------------------------------------------------- | -------------------------------------------- |
| any catalog mode, inventory absent or `strict`          | strict, unchanged                            |
| `runtime` + `optional-drivers` + UUID + binding         | optional, pinned with schema 2               |
| `bundled` / `compare` + `optional-drivers`              | `ConfigurationError` (bounded 500, no lease) |
| `runtime` + `optional-drivers`, missing UUID or binding | `ConfigurationError`                         |
| unknown/malformed inventory value                       | `ConfigurationError`                         |

- **Selection mechanism:** the existing closed `IDENTITY_INVENTORY_MODE`
  variable, which design §11.1 defines as the phase-3 control with its own owner
  gate. No endpoint, automatic activation or new privilege was added.
  Enabling it is an explicit configuration change reserved for U11.
- **Durable provenance:** the pin request is the run's durable identity.
  Strict requests remain the exact schema-1 shape, so stored strict pins and
  receipts are byte-identical. Optional requests are schema 2 with
  `inventoryPolicy: "optional-driver-inventory-v1"`. Because replay compares the
  complete stored request, the same run ID under another policy is a
  `pin-run-conflict`, never a reinterpretation (tested in SQLite, including
  after a workerd restart). No SQLite schema migration was needed: the request
  is already stored as JSON text.
- **Consistency:** the context's `inventoryPolicyVersion` derives from the
  admitted pin request. Composition refuses a configuration/context mismatch,
  and an optional configuration without a context (legacy direct wiring). Port,
  coordinator and assembly all receive the same frozen policy.
- **Immutability:** a mid-run change to `IDENTITY_INVENTORY_MODE`, catalog
  activation or catalog outage after the pin does not alter the run (tested).
  The next independently admitted run adopts the new revision.
- **Defence in depth:** `admitIdentityContext` refuses bundled/compare/unknown
  inventory modes before any catalog call. `inventoryPolicyForContext` requires
  runtime authority for `optional-drivers/1`, so a relabeled bundled context
  cannot obtain the optional policy.
- Policy selection is not an identity-content revision and does not allocate a
  dataset version. R0 hashes, mappings and the dataset label are untouched.
- U6 limits are unchanged: two-second per-attempt pin bound, one identical
  retry, no provider call before admission, 240/300-second budgets.

## 8. Batch-v2 inventory-policy compatibility

- `generateSeasonBatch({ inventoryPolicy })` and the CLI flag
  `--inventory-policy strict-v1|optional-driver-inventory-v1` select the policy
  explicitly. Absent means `strict-v1`. Optional requires `identityMode:
runtime` with a verified local catalog export; otherwise
  `inventory-policy-invalid`. One export revision and one policy govern the
  participants port, coordinator, closure and catalog reference.
- The artifact and manifest carry identical `identityCatalog` blocks.
  `exportSha256` remains the verified canonical U5 `exportHash`, prefixed and
  unchanged by the policy (tested).
- The Worker pins with the installation's trusted policy (admission request
  schema 2 and pin schema 2) and requires exact reference equality
  (`matchesCatalog`) including `inventoryPolicy`. Strict artifacts are refused
  by optional installations and optional artifacts by strict ones
  (`catalog-reference-mismatch`).
- Relabeling: editing the label in the artifact, or in both files, without a
  new reviewed manifest digest is refused. A re-anchored relabel is a new
  unreviewed manifest. A strict installation still refuses its optional label.
  The Worker cannot prove which provider inventory produced a batch (§17).
- Stale revisions are refused. The same operation ID under another policy fails
  closed (`batch-operation-conflict` → `catalog-admission-refused`). An
  identical committed operation replays its receipt without a second
  publication.
- New v1 (legacy) ingestion under the optional policy is refused before any
  catalog call (`runtime-batch-requires-u7`); schema-2 admission requires
  `legacy: false`. Historical v1 archives stay readable, and the irreversible U7
  v1 closure is unchanged.

## 9. Positive guarded-publication evidence

| Scenario                                         | Harness                                     | Result                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| T23 inventory-only unknown                       | In-process + DO sequencer                   | `applied`, 1 guarded call, 0 legacy calls, no private field in stored documents                                                        |
| T23                                              | node:sqlite catalog batch ingest            | `applied`; restart replays the identical receipt; 1 receipt; pin and receipt record schema 2                                           |
| T23                                              | workerd SQLite catalog, Worker manual sync  | 1 finalize; request list **equal** to a fully mapped strict run, constructors directly after drivers; equal reservations; pin schema 2 |
| T23                                              | workerd SQLite catalog, Worker batch ingest | lost-response 503, then same-ID recovery `applied`; restart replay identical; public `drivers` data unchanged                          |
| T25 curated debutant absent from inventory       | all four harnesses                          | Published; profile appended after inventory; spans equal to the strict derivation; `driver:{id}` document present                      |
| T26 inventory-only verified (FP1-style) identity | assembly                                    | Profile present, no span, no lineup                                                                                                    |
| T27 returning/transfer/multi-constructor         | assembly                                    | Split spans preserved; null multi-constructor standing kept                                                                            |

## 10. Negative required-identity and constructor cases

All of the following withhold before publication with zero guarded calls, or
are rejected by the guard, and leave the active version and its stored
documents byte-identical:

- T24: unknown driver in a required race classification (FakePort
  `mapping-failure` and the workerd Worker with a real results body), and in
  driver standings → whole resource unavailable.
- Missing or unbound pinned profile → `inconsistent-references` /
  `required-driver-profile`.
- T28: unknown result constructor (`result-entry-constructor`), missing
  constructor profile, unprofiled lineup driver (`required-driver-profile`).
- T29: forged count, catalog hash, policy version, duplicate candidate,
  reordered unresolved or resolved rows, invalid reason or extra key at the
  boundary → `driver-inventory-context`. Forged digest, resealed other-catalog
  accounting and inconsistent rows are refused by the coordinator as
  `invalid-payload`.
- T17: unavailable or corrupt catalog before admission → zero provider
  requests, reservations and finalizes.
- Policy disagreement in either direction → `driver-inventory-context`.

## 11. D14-D16 and reconciliation regression results

Under the optional policy, over both sequencer transports:

- D14: a candidate missing a published classified round →
  `guard-round-coverage-regression`.
- D15: removed fact → `guard-participation-fact-removed`; replaced constructor
  → `guard-constructor-replaced`.
- Wider/narrower: a narrower candidate after a wider commit is rejected
  (D14) against the committed version.
- D16: a loser preparing after the winner committed → prepare
  `stale-predecessor`, publication `failed`/`guard-predecessor-stale`, nothing
  written.

No publication threshold, eligibility, sequencing, reconciliation, settling or
classification-revision rule changed. All existing reconciliation, lease,
guard and sequencer suites ran in the full suite (§15).

## 12. Real SQLite restart, replay and uncertainty tests

- workerd persistent SQLite (`optional-inventory.test.mjs`): R0 seeded,
  validated and activated for an explicit installation; optional and strict
  syncs; mid-run activation plus mode change plus catalog outage after the pin;
  new run adopts the later revision; policy-conflicting retries refused; pins
  replay identically after restart; optional batch ingest with lost-response
  recovery and restart replay.
- node:sqlite (`catalog-v2-optional.test.ts`): receipt replay after object
  restart with one receipt row; stale revision; conflicting reuse.
- Evidence JSON (ignored): `.wrangler/u8-evidence/u10-optional-*.json`.

## 13. Strict-mode and November incident parity

- Strict requests, payloads (five keys), early exit, failure reasons, U6 pins
  (schema 1), U7 references (`strict-v1`) and snapshots are unchanged. Strict
  assembly never touches the closure. Every pre-existing suite passes except
  the timing-sensitive cases in §15.
- `test/sync/coordinated/entry-points/proxy-transport.test.ts` is
  byte-identical to the baseline (25 HTTP 200, 22 selected, 3 unavailable, no
  constructors, no publication). It remains a synthetic strict model, not proof
  of the real incident's cause.
- The distinct phase-3 scenario (workerd harness) shows strict with an unknown
  inventory driver making no constructors request and publishing nothing,
  while optional makes the real constructors request and publishes. The U9
  coordinator-level request-count table still holds.

## 14. Flutter and API compatibility

- No public schema, OpenAPI, DTO, Drift, frozen-APK, hash algorithm, app
  identifier or signing byte changed. OpenAPI validation passes unchanged.
- Flutter 3.44.0 with `flutter --no-version-check test --no-pub
--concurrency=1` on U8's ten files (T33 database/repository/sync plus
  contract mapping, DTO parsing and API failure): **143 passed**, exit 0.
  `pubspec.lock` SHA-256 `291a2de4…d18444` is unchanged. Log:
  `services/edge-api/.wrangler/identity-u10-flutter.log`.
- `wt-ui-redesign` was not accessed.

## 15. Full test and validator results

All commands ran in `services/edge-api` with synthetic data and throwing
network transports. Logs are in the ignored `.wrangler/` directory
(`identity-u10-*.log`).

> **Acceptance full run 3, the U10 result of record** (2026-11-17,
> `npm test -- --maxWorkers=1 --testTimeout=30000`, the same command as runs 1
> and 2, final U10 code, log `.wrangler/identity-u10-full-acceptance.log`,
> SHA-256 `be94fa9e…68ef326`): **6,381 passed, 6 existing opt-in skips, 0
> failed**. 314 test files passed and 3 were skipped (317). Exit 0. It ran
> from 17:35:07Z to 17:52:39Z, and Vitest reports 1,049.57 s.
>
> - Conditions: the machine was kept awake for the whole run by a
>   per-process `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)`
>   wrapper. Nothing else resource-intensive was running (CPU load about 13%
>   at start; no Opera and no active Flutter test run).
> - Unchanged: all timeouts, operational deadlines and assertions. That
>   includes the 30 s test timeout, the 2 s admission bound, the 10 s setup
>   hook and the discovery drain budget.
> - No source or test change was made for this run. Before it started, the
>   tree was checked against `identity-u10-preservation.json`: all 1,541
>   recorded files were byte-identical, no unrecorded file was present, the
>   index was empty and HEAD was `027da5d`.
>
> The two time-based failures in run 2 did not recur. This is consistent with
> the overnight sleep and load explanation, but it does not prove it.
>
> **Test-count reconciliation.** U9 executed 6,305 tests (6,305 passed, 0
> failed). U10 run 2 executed 6,381 (6,379 passed, 2 failed). The difference
> is exactly 76 executed tests, which matches the per-file tally of 76 new
> tests. The earlier "74 above U9" figure compared passed counts only, and
> left out run 2's two failed tests. Run 3 confirms 6,381 executed, all
> passing. The 6 skips are the same existing opt-in cases in every run.
>
> **Historical run 2, retained as evidence** (final code, log
> `.wrangler/identity-u10-full-final.log`, SHA-256 `1db3779e…a255159ff0d`):
> 6,379 passed, 6 existing opt-in skips and 2 failed. 312 test files passed, 2
> failed and 3 were skipped (317). An earlier version of this section said
> "314 of 317 files passed"; that figure was wrong. The recorded 63,285 s
> duration spans an overnight machine sleep. Both failures were time-based and
> in files U10 did not touch:
>
> - `identity/discovery/shadow.test.ts`: a background write did not land
>   within its drain budget.
> - `coordination-containment.test.ts`, case 35: 30 s timeout.
>
> A rerun of both files on the final code gave 31 passed, 0 failed. Run 3
> above then passed both files within the full suite.

| Validation                                                  | Result                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (Worker and scripts), `npm run typecheck`        | Passed, 0 errors                                                                                                                                              |
| ESLint (whole package)                                      | Passed, 0 problems                                                                                                                                            |
| Prettier (whole package)                                    | Passed                                                                                                                                                        |
| `git diff --check`                                          | Passed                                                                                                                                                        |
| OpenAPI (`validate:openapi`)                                | Valid, schema unchanged                                                                                                                                       |
| Curated content / API fixtures                              | 18 checked, 0 failed / 32 checked, 0 failed                                                                                                                   |
| Generated identity-schema freshness                         | `compile-schemas.mjs --check` exit 0                                                                                                                          |
| Local Worker types                                          | Generated to ignored `.wrangler/identity-u10-worker-configuration.d.ts`; configuration unchanged                                                              |
| Pre-change focused regression (94 files)                    | 1 failure, then fixed (see below); 1,918 passed                                                                                                               |
| New/touched suites, final code                              | `identity-closure` 26 + `identity-closure-publication` 16, `inventory-policy` 10, `inventory-mode` 6, `cli.test.mjs`, `driver-inventory`: 5 files, 135 passed |
| `optional-inventory.test.mjs` (workerd SQLite)              | 9 passed (low-load run)                                                                                                                                       |
| `catalog-v2-optional.test.ts` (node:sqlite)                 | 11 passed (low-load run)                                                                                                                                      |
| Pre-existing U7 `catalog-v2.test.ts`                        | 34/35 in the same low-load run; the remaining case passed twice in isolation (timing, §17)                                                                    |
| Flutter (ten T33/contract files)                            | 143 passed, exit 0                                                                                                                                            |
| Independent read-only code review                           | Approve; no critical or high findings; one medium applied (structural profile equality); low notes recorded in §17                                            |
| **Full run 1** (before the final review fix and test split) | 6,335 passed, 6 opt-in skips, **30 failed**, 2,442 s (U9: 763 s)                                                                                              |
| **Full run 2** (final code, historical)                     | 6,379 passed, 6 opt-in skips, 2 time-based failures in untouched files; both files then 31/31 passed                                                          |
| **Full run 3, acceptance** (final code, machine awake)      | **6,381 passed, 6 opt-in skips, 0 failed**, 1,049.57 s, exit 0                                                                                                |
| Static and Flutter applicability at run 3                   | Tree byte-identical to the preservation record, so the TypeScript, ESLint, Prettier, OpenAPI, fixture, schema and Flutter results above still apply           |

**Intermediate failures, reported honestly.**

1. The first focused run failed `coordination-containment.test.ts`, because
   the new `closure-profiles.ts` imported the coordination package. The
   allow-list was **not** extended. The module now declares a structurally
   identical interface, and the test passes unchanged.
2. Several new-test expectations were wrong and were corrected, never the
   production assertions: an over-lenient "malformed profile" sample (empty
   name is valid), the D16 loser status (`failed`, not `rejected`, matching
   the established contract), a synthetic port using an invalid failure reason
   instead of the real `mapping-failure` outcome, and a public-response
   comparison that included response metadata.
3. Full run 1: all 30 failures were in the two node:sqlite batch-ingest files
   (28 in the pre-existing U7 `catalog-v2.test.ts`, 2 in the new optional
   companion). 24 were its unchanged ten-second setup hook timing out and 4
   were admissions exceeding the unchanged two-second bound. That run took
   3.2× U9's duration under heavy unrelated machine load (Opera and several
   `flutter_tester` processes from another session). Low-load measurements put
   the hook at 2-3 s and admission at 0.9-1.3 s, and the reruns above pass. No
   deadline or timeout was raised.

## 16. Preservation comparison against pre-U10 work

- Baseline `identity-u10-baseline.json`, recorded before any edit: 1,530 files
  with byte lengths and SHA-256, branch, HEAD, full status and an empty index.
  At baseline the tree was byte-identical to the U9 final preservation record
  (only the U9 patch and record files were added after it).
- `identity-u10-preservation.json` lists every current path with its state:
  **1,511 baseline files are byte-identical**, **19 modified**, **0 missing**.
  Added: 8 code/test files, this report, the baseline, the preservation record
  and `identity-u10-changes.patch`.
- Distinguishing U10 from U0-U9: 3 modified files equalled HEAD at baseline
  (`coordinated-publication.ts`, `season-integrity.ts`, `cli.test.mjs`). For
  the other 16, pre-U10 bytes were reconstructed by reversing exactly the U10
  hunks, and **every reconstruction matches its baseline SHA-256**.
- `identity-u10-changes.patch` holds the U10-only diff of the 19 modified and 8
  new code/test files. It applies cleanly to the reconstructed pre-U10 files
  (`git apply --check`, isolated copy). It does not apply to HEAD, because
  earlier units are uncommitted.
- R0 seed and content (all 94 mappings, 101 evidence records, 7
  acknowledgements, dataset `2026.10.07.1`, corrected R0 hashes) are
  byte-identical. No wrangler, content, `lib/`, API or Flutter file changed. No
  commit, push, merge, reset, clean, stash or reformat of unrelated files.

## 17. Remaining limitations, risks and blockers

- **Timing-sensitive local harnesses.** The node:sqlite batch-ingest suites
  (pre-existing U7 `catalog-v2.test.ts` and the new optional companion) depend
  on the unchanged two-second admission call and a ten-second setup hook. Under
  heavy unrelated machine load they fail by timeout. Isolated measurements put
  admission at 0.9-1.3 s (schema 2 no slower than schema 1) and the setup hook
  at 2-3 s. No deadline was raised. Staging latency evidence remains U11's.
- **Provenance limit.** The Worker cannot prove which provider inventory
  produced a batch. A re-anchored relabel of a strict artifact as optional
  is a new unreviewed manifest; the controls are the reviewed manifest digest,
  exact installation policy and catalog equality, and existing capture review.
  A strict-valid season is also optional-valid, so such a relabel cannot
  publish data the optional policy forbids.
- **Diagnostics granularity.** Four closure problems share the
  `required-driver-profile` relation (review finding, low). The closed problem
  code is not logged separately; operators distinguish cases with catalog
  read-only tools.
- Inventory-only detail disappearance is not protected by D14/D15, as the
  design states. No profile-deletion policy was added.
- `contextFromExport` defaults to strict when no policy is passed. Both
  production callers pass it explicitly.
- Only synthetic data and the reviewed R0 corpus were used. There is no live
  provider, staging or production evidence.

## 18. Exact prerequisites for U11 staging rollout

1. Explicit owner authorization for U11 and for the separate phase-3
   inventory gate (design §11.3 step 8; ADR 0030 D4), distinct from the runtime
   cutover approval.
2. Staging already cut over to `IDENTITY_CATALOG_MODE=runtime` with strict
   inventory, a verified active revision, an exported recovery artifact and a
   real staging `IDENTITY_INSTALLATION_ID` UUID plus `IDENTITY_CATALOG` binding.
   The optional policy is refused otherwise.
3. A reviewed staging-only configuration change adding
   `IDENTITY_INVENTORY_MODE=optional-drivers`, applied under an operator hold
   with active runs drained. The inventory-policy test enforcing "no committed
   environment" must be updated in the same reviewed change to allow exactly
   that staging environment.
4. Controlled staging scenarios: positive inventory-only unknown, curated
   debutant, unknown required race/standings rows, constructor contradictions,
   catalog outage, mid-run activation, policy-conflicting retry, and
   optional batch ingest. Record request accounting including the additional
   constructors attempt, pin/admission latency, withhold reasons and the
   absence of private fields.
5. Recovery drill: return to strict under hold/drain and confirm strict
   withholding resumes, published facts remain, and schema-2 pins stay readable.
6. Production remains untouched. A separate production change proposal is
   required.
