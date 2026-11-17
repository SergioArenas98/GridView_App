# GridView identity catalog - U9: explicit optional driver inventory

**Status:** implemented and validated **locally only**. Nothing is committed, pushed,
merged, deployed or activated. No remote environment, Cloudflare resource, Webdock
host, credential, catalog or provider endpoint was touched.

> **Optional inventory handling alone does not authorize publication.** U9 produces
> and strictly validates private inventory accounting. It deliberately cannot be
> selected by any operational configuration, and season assembly explicitly refuses
> an inventory-bearing participants payload. Whole-season publication under the
> optional policy requires U10 (required-reference closure and the private-field
> removal boundary) and the separately approved phase-3 enablement gate.

Worktree `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`, index empty before and after.
Authorities: design §8.1-8.4, §11, §12 and unit U9; ADRs 0029-0031; PO-2 (the
optional exception applies only to drivers).

## 1. Summary

U9 separates five concepts that the participants resource previously conflated:

| Concept                               | U9 representation                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Provider-observed driver inventory    | Every strictly decoded driver row, counted in `driverInventory.providerRowCount`              |
| Verified canonical profile            | `drivers` (complete pinned profiles, provider order) and `driverInventory.resolved`           |
| Unresolved inventory-only observation | `driverInventory.unresolved[{candidateId, reason: "unmapped"}]`; no ID, profile, team or span |
| Required race/standings identity      | Unchanged: results and standings normalizers stay all-or-nothing                              |
| Accepted race participation           | Unchanged: assembly-derived spans only; `driverEntries` stays empty for participants          |

Under an explicit `optional-drivers` policy, a strictly decoded driver page whose
**only** identity problem is the registry's exact `unmapped` answer is accounted
privately and the existing constructors request is then made. Every other problem
fails the whole resource exactly as strict mode does. Strict is the default, and
strict behaviour, payload shape, request order and attempt accounting are
unchanged.

## 2. Exact new and modified files

All paths are under `services/edge-api/` unless prefixed.

**New (5 source/test files):**

- `src/identity/inventory/model.ts` - closed policy type, accounting types,
  policy reader, context-derived operational policy, observation hash, digest.
- `src/identity/inventory/normalize.ts` - `normalizeDriverInventory`, over an
  injected exact resolver, so `src/identity/inventory/` imports no mapping
  module (the existing mapping-containment allow-list is unchanged).
- `src/identity/inventory/validate.ts` - closed accounting validator.
- `test/providers/jolpica/driver-inventory.test.ts` - 53 tests.
- `test/sync/coordinated/entry-points/inventory-mode.test.ts` - 3 Worker-level gate tests.

**Modified (12 pre-existing files, U9 hunks only):**

| File                                                             | U9 change                                                                                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/providers/jolpica/participants-normalizer.ts`               | New `normalizeSeasonDriverInventory` adapter; strict `normalizeSeasonDrivers` untouched                                     |
| `src/providers/jolpica/participants-port.ts`                     | `inventoryPolicy` option; strict branch unchanged; separate optional branch; shared `decodeDrivers` (same U1 capture point) |
| `src/providers/coordination/resource.ts`                         | `SeasonParticipantsPayload` (strict) and `InventorySeasonParticipantsPayload` closed variants                               |
| `src/providers/coordination/payload-contract.ts`                 | Policy-aware closed wrapper; `validateParticipantsInventory`                                                                |
| `src/providers/coordination/coordinator.ts`                      | Trusted `inventoryPolicy` option; digest recomputed on the detached snapshot; closed accounting validation                  |
| `src/providers/coordination/season-assembly.ts`                  | Explicit pre-U10 refusal of any participants payload carrying `driverInventory`                                             |
| `src/sync/coordinated/composition.ts`                            | One context-derived (strict-only) policy handed to both port and coordinator                                                |
| `src/config/environment.ts`                                      | `IDENTITY_INVENTORY_MODE`, `resolveIdentityInventoryMode`, `resolveOperationalInventoryMode`                                |
| `src/identity/catalog/run-context.ts`                            | `identityConfiguration` records `inventoryMode: 'strict'` and refuses `optional-drivers`                                    |
| `src/logging/logger.ts`                                          | Bounded `identityUnresolvedCount` log field (count only)                                                                    |
| `test/providers/coordination/payload-contract.test.ts`           | One U9 closed-wrapper case                                                                                                  |
| `test/providers/coordination/candidate-payload-snapshot.test.ts` | One U9 detachment case                                                                                                      |

`outcome.ts`, `port.ts` (`detachPayload` already deep-clones every field) and
`participants-payload.ts` needed no change. No public type, schema, fixture,
content, OpenAPI, Flutter, Drift, wrangler or batch-format file changed.

## 3. Private inventory model and accounting invariants

```text
driverInventory: {
  policyVersion: 1,
  catalogHash: Hash,              // trusted run context, never provider data
  providerRowCount: integer,      // every decoded row
  resolved:   [{ driverId: CanonicalId, observationKeyHash: Hash }],  // provider order
  unresolved: [{ candidateId: Hash, reason: "unmapped" }],            // ascending candidateId
  projectionDigest: Hash
}
```

- `Hash` is the established `sha256:<64 hex>` identity hash.
- `candidateId` is the **exact U1 identity** `candidateIdFor(key)`
  (`gv-identity-candidate/1` over the shared canonical key serialization), so the
  accounting and the discovery store name the same candidate.
- `observationKeyHash` is `identityHash("gv-identity-inventory-observation/1" +
canonicalKey(key))`, domain-separated from candidate IDs so a resolved and an
  unresolved row can never collide.
- `projectionDigest` is `hashIdentityProjection` over
  `{format: "gridview-driver-inventory/1", policyVersion, catalogHash,
providerRowCount, resolved, unresolved}`.

Enforced (normalizer on production, validator on admission):
`providerRowCount = resolved.length + unresolved.length`; unique observation
hashes; unique candidate IDs; no candidate equal to an observation hash; unique
canonical drivers; `resolved` IDs exactly equal to `drivers` IDs in order;
`driverEntries` empty; catalog hash equal to the trusted policy; supported
version only; closed objects at every level (no unknown fields); ascending
`unresolved` order; recomputed digest equality; at most 100 rows (the decoded
page cap). Problems are closed codes (`missing-accounting`, `shape`,
`policy-version`, `catalog-hash`, `row-count`, `identifier`, `hash`, `reason`,
`duplicate-observation`, `duplicate-candidate`, `duplicate-driver`,
`unresolved-order`, `projection-mismatch`, `driver-entries`,
`projection-digest`) and never carry a value.

## 4. Policy selection and operational gating

```text
DriverInventoryPolicy = { mode: "strict" }
                      | { mode: "optional-drivers", policyVersion: 1, catalogHash }
```

- `IDENTITY_INVENTORY_MODE=strict|optional-drivers` is parsed strictly; absent is
  `strict`; any other value (including case or whitespace variants) is a
  `ConfigurationError`.
- **Operational gate:** `resolveOperationalInventoryMode` accepts only `strict`.
  `optional-drivers` is recognised vocabulary but refused while building
  `identityConfiguration`, for bundled, compare and runtime catalog modes alike.
  A Worker so configured answers the coordinated run with the bounded
  configuration 500 before any lease, limiter reservation, provider request,
  preparation or storage write (proven at the entry point).
- The composition derives one policy per run via `inventoryPolicyForContext`,
  which accepts only the U6 context's `strict/1` value, and hands the same frozen
  policy to the participants port and the coordinator. A configuration or context
  claiming anything else is a `catalog-invalid` refusal.
- The U6 run-context model (`inventoryPolicyVersion: 'strict/1'`) and the U7
  batch reference (`inventoryPolicy: 'strict-v1'` only in `matchesCatalog`) were
  **not widened**: strict runtime batch admission remains until U10.
- Optional normalization is reachable only by constructing the port and
  coordinator directly with `optionalDriverInventoryPolicy(context.catalogHash)`,
  which is what the isolated U9 tests do with a real sealed bundled context.
- Malformed injected policies are wiring errors (`TypeError` in the port,
  `CoordinatorConfigurationError` in the coordinator); the reader takes own data
  properties only and never invokes accessors.

## 5. Normalization and constructor-request flow

1. Fetch the drivers page through the existing hardened client.
2. Strictly decode envelope, pagination and every row (unchanged decoder; U1
   evidence capture still happens only after a successful decode).
3. Resolve each exact typed key against the pinned registry.
4. Partition: `resolved` rows; rows whose failure reason is exactly `unmapped`;
   anything else is a **blocking** failure (`invalid-key`, `registry-invalid`,
   `ambiguous`, `target-missing`).
5. Blocking failure: `mapping-failure`, constructors never requested.
   Contradictions: duplicate canonical driver, duplicate observation/candidate,
   invalid pinned profile and an `unmapped` key the U1 candidate grammar refuses
   (`candidate-id-refused`, unreachable while both validators agree) become a
   logged `invalid-payload`; a mapped target without a
   profile becomes `mapping-failure` (same as strict). Malformed input never
   becomes an unresolved identity.
6. Otherwise build verified profiles (`media: null`, deep-validated) in provider
   order and the accounting, log only `identityUnresolvedCount`, and continue.
7. Cancellation/limiter checks run exactly as before; then the existing
   constructors request, decoded and resolved with **unchanged strict rules**.
8. Return both lists, constructor entries, empty `driverEntries` and
   `driverInventory`; no partial payload on any constructor failure.

## 6. Deep validation and detachment

- The coordinator validates against its **own trusted policy**. A strict
  coordinator refuses any participants payload carrying `driverInventory`
  (closed wrapper, `unknown-property`). An optional coordinator uses a separate
  closed wrapper that **requires** the field, then the closed accounting rules.
  There is no permissive "extra keys allowed" mode.
- Hashing is asynchronous and attribution is not, so the digest is recomputed in
  `runOperation` on the coordinator's detached `structuredClone` snapshot as it
  arrives and carried with the normalized result. Strict mode never awaits there,
  so its scheduling is unchanged. The value digested is the value validated,
  stored and selected; the adapter's object is unreachable.
- A self-consistent payload resealed for another catalog fails: catalog identity
  comes from the run context only.
- Mutating the adapter's object after submission (accounting, counts, catalog
  hash, profiles) does not change the selected candidate.

## 7. Discovery integration and failure containment

- Unchanged U1/U2 seam: the participants port calls the existing
  `captureDiscovery` after a successful strict decode, in both modes; the
  bounded collector, notification deduplication, provenance, two-second drain
  budget and no-raw-payload rules are U2's and were not modified.
- Candidate IDs in the accounting equal those the U1 extractor produces for the
  same page (tested).
- Accounting never depends on storage: with a store that always rejects, the
  outcome stays a valid candidate admitted by the optional coordinator, and the
  failure text never reaches a log. A throwing sink leaves the outcome
  byte-identical. Collector overflow and duplicate captures do not alter
  accounting. A discovery write never authorizes an identity.
- No provider request was added for discovery.

## 8. Strict-mode parity

- Existing participants, results, standings, resource-port, coordination,
  discovery, identity-context, provider-neutrality and boundary suites passed
  before any new test was written (54 files, 1,381 tests).
- Implicit and explicit strict produce identical outcomes and the exact closed
  five-key payload; an unknown driver still ends the resource after one request.
- The November synthetic regression in
  `test/sync/coordinated/entry-points/proxy-transport.test.ts` is **unchanged**
  (25 HTTP 200, 22 selected / 3 unavailable, no constructors request, no
  publication). It remains a synthetic strict-mode model, not proof of the real
  incident's causes.

## 9. Optional-mode request-count differences

| Scenario (synthetic, coordinator with real ports)                          | Strict requests                         | Optional requests                                                               |
| -------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Participants + race 1 + driver standings, two unknown drivers in all three | drivers, results/1, driverstandings (3) | drivers, **constructors**, results/1, driverstandings (4)                       |
| Resource outcome                                                           | all three unavailable                   | participants selected; results and standings unavailable (`mapping-unresolved`) |

Exactly one additional, real constructors attempt; no new endpoint; limiter
reserved once per real request; attempt references in transport order; a
deferral or cancellation before constructors is `interrupted` with only the
drivers attempt; a failed constructors transport reports both attempts.

## 10. No-public-leak verification

- `driverInventory`, `observationKeyHash` and `optional-drivers` occur only in
  the eight internal source modules listed above; zero occurrences in
  `docs/api`, Flutter `lib/`, `content/` or public/contract source.
- OpenAPI validation and generated identity-schema freshness passed unchanged.
- Assembly copies only named collections, and now explicitly refuses an
  inventory-bearing payload (`inconsistent-references`, `missing: []`,
  `relations: []`), proven against an otherwise complete run that assembles
  successfully without the field. No `ProviderSeasonSource`, snapshot, dataset or
  classification hash can contain the accounting before U10's removal boundary.
- `validateSeasonReferences` and public driver/race models are unchanged.

## 11. Test and validation results

All commands ran in `services/edge-api` with synthetic data and throwing
network transports. Ignored logs: `identity-u9-full-final.log`,
`identity-u9-validators.log`, `identity-u9-lint.log`.

| Validation                                | Result                                                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-test parity (existing suites, see §8) | 54 files, 1,381 passed                                                                                                                                                 |
| Focused U9 + extended suites              | `driver-inventory` 53, `inventory-mode` 3, payload-contract +1, candidate-snapshot +1: all pass                                                                        |
| Focused regression set (final code)       | 14 files, 721 passed: all Jolpica adapters, mapping containment, provider neutrality, payload contract, snapshot, entry-point gate                                     |
| TypeScript (Worker and scripts)           | `npm run typecheck` passed                                                                                                                                             |
| ESLint (whole package)                    | Passed                                                                                                                                                                 |
| Prettier (whole package)                  | Passed                                                                                                                                                                 |
| Curated content / API fixtures            | 18 checked, 0 failed / 32 checked, 0 failed                                                                                                                            |
| Generated identity-schema freshness       | `node scripts/identity/compile-schemas.mjs --check` exit 0                                                                                                             |
| OpenAPI                                   | Valid, schema unchanged                                                                                                                                                |
| Wrangler local types                      | Generated to ignored `.wrangler/identity-u9-worker-configuration.d.ts`; configuration unchanged                                                                        |
| **Final full edge-api suite**             | `npm test -- --maxWorkers=1 --testTimeout=30000`: **6,305 passed, 6 existing opt-in skips, 0 failures/timeouts**; 309 passed + 3 skipped files (312); 763.03 s; exit 0 |
| `git diff --check`                        | Passed (see §12)                                                                                                                                                       |
| Independent read-only code review         | No critical/high findings; two low notes applied (closed `candidate-id-refused` diagnostic, production-source guard test)                                              |

6,305 = U8's 6,247 + 58 new U9 tests; the six skips are the unchanged
app/capture/export opt-ins. Flutter was **not** rerun: no Flutter, Dart, public
schema, OpenAPI or fixture byte changed, so U8's 143-pass result is unaffected.

**Intermediate failures, reported honestly.** (1) The first full run (698.55 s)
had **one failure**: `test/providers/mappings/mapping-containment.test.ts`
refused the new inventory modules' direct `providers/mappings` imports. The
assertion was **not** relaxed or extended: the modules were refactored to use the
existing `discovery/keys` re-export, the U1 key type and an injected resolver,
and the final full run above includes that test passing. (2) During development
several new U9 test expectations were wrong (a default parameter masking strict
mode, a URL helper that already carried `?limit=100`, a valid `Red Bull`-style
key mistaken for malformed, a profile field that is not validated); the tests
were corrected, never the production assertions.

## 12. Preservation comparison

- Baseline: `identity-u9-baseline.json`, recorded before any edit (1,521 files
  with byte lengths and SHA-256; branch, HEAD, full status; empty index).
- Comparison: `identity-u9-preservation.json` lists every current path with its
  state. **1,509 baseline files are byte-identical**, **12 modified**, **0
  missing**; added: 5 source/test files, this report, the baseline, the
  preservation record and `identity-u9-changes.patch`.
- Distinguishing U9 from U0-U8: 7 of the 12 modified files still equalled HEAD
  at baseline, so their U9 diff is `git diff HEAD`. For the other 5
  (`participants-port.ts`, `composition.ts`, `environment.ts`,
  `run-context.ts`, `logger.ts`) the pre-U9 bytes were reconstructed by
  reversing exactly the U9 edits, and **every reconstruction matches its
  baseline SHA-256**: no earlier-unit content in those files was altered.
- `identity-u9-changes.patch` holds the U9-only diff of all modified and new
  code files and applies cleanly to the pre-U9 tree (verified with
  `git apply --check` in an isolated copy). It does not apply to HEAD, because
  earlier units are uncommitted.
- Branch `feat/jolpica-egress-proxy`, HEAD `027da5da59bf6b8c75a3fc432ef4fdc691772528`,
  index empty; no commit, push, merge, reset, discard, clean, stash or reformat
  of unrelated files; `wt-ui-redesign` not accessed.

## 13. Remaining limitations and risks

- **No positive publication path.** By design; U10 owns closure, removal of the
  private field and the guarded publication demonstration (T23 positive, T25).
- The coordinator cannot verify `candidateId`/`observationKeyHash` against
  provider keys (they are private by design); it verifies format, uniqueness,
  ordering, counts, profile equality, catalog binding and digest. The digest is
  an integrity checksum over the projection, not an authentication code.
- The assembly refusal reuses the existing `inconsistent-references` gap, which
  settles as `blocked`. It is unreachable operationally (strict composition and
  strict coordinator reject the field first) and U10 replaces it.
- Strict mode still logs `unmapped` driver keys through the existing mapping
  signal; optional mode logs only a count for accounted rows.
- The 100-row ceiling mirrors the participants page limit; a larger census
  already fails decoding as an incomplete page.
- Optional mode was exercised only with synthetic data and the bundled R0
  context; no runtime-catalog or staging evidence exists or was sought.

## 14. U10 integration requirements and acceptance gates

1. Consume `InventorySeasonParticipantsPayload` only after coordinator
   validation; never re-derive or trust accounting elsewhere.
2. Implement `season-identity-closure.ts` exactly as design §8.2: required IDs
   from selected results, fastest laps, driver standings, derived spans and
   lineup references; load missing verified profiles from the same pinned
   context; refuse missing profiles as `inconsistent-references`.
3. Replace the U9 assembly refusal with an explicit validated boundary that
   removes `driverInventory` before constructing `ProviderSeasonSource`, with a
   test that the public source/snapshot/hashes contain no accounting.
4. Widen the run-context `inventoryPolicyVersion` and the U7
   `inventoryPolicy` admission (`optional-driver-inventory-v1`) together, with
   provenance recorded in run and batch manifests.
5. Replace `resolveOperationalInventoryMode`'s refusal only behind the separate
   phase-3 owner gate; keep runtime catalog authority mandatory for optional mode
   and keep bundled/compare unable to enable it.
6. Prove T23 (positive guarded publication), T24, T25-T28, T30 (D14/D15), T31
   (D16), T34 (phase-3 accounting) and no leak, using real guarded harnesses.
7. Keep results/standings normalizers all-or-nothing and the strict November
   regression unchanged.
