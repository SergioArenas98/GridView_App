# GridView identity catalog - U11 P1 packet: G2 + G3 (+ local G4) on staging

- Status: **UNSIGNED. Nothing in this packet is authorized until the product
  owner signs §9 and that signature is committed.**
- Prepared: 2026-11-22, after G1 acceptance (D0). Staging baseline:
  `gridview-api-staging` version `13c3a90c-4fd8-4794-9fd6-efaf4f950bb6`.
- Scope: one combined packet for sequential operations (owner decision D6).
  Each operation has its own scope, prerequisites, checks, stop conditions
  and durable receipt. **A failure stops every later operation.**
- Not in scope: G5, runtime cutover, hold or release, synchronization,
  provider or proxy requests, publication, optional-driver inventory,
  production, E2E, push or merge.

## 1. Owner decisions this packet needs

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Recommendation |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| P1-a | Accept **SOE-1-B exactly as worded in §2**, including RB-1..RB-4 individually. Not accepted until you sign                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Accept         |
| P1-b | **D12, seed credential.** A seed records its import dossier as created by the seeding credential. The offline verifier, used by G4, the S3 restore check and every future runtime batch, accepts only dossiers created by a credential holding `reviewer`. An installation accepts one seed only, so this choice is permanent. **D12-A:** seed with the single-use `stg-po-bootstrap-1` (`reader`+`reviewer`+`activator`, expiry 2026-11-30T00:00:00.000Z), then validate and activate with `stg-po-activate-1`. **D12-B:** a reviewed code change to the verifier first (not prepared; delays P1). **D12-C:** seed with the activator: rejected, because G4 and runtime batches could never verify the export | D12-A          |
| P1-c | Approve the artifacts in §3 by hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Approve        |
| P1-d | Approve the window in §9: it must start at least 8 h after the signature commit (CC-4 for G3), and end before 2026-11-29T23:00:00Z (bootstrap expiry, with margin)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Your choice    |
| P1-e | Acknowledge the two G4 implementation notes in §6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Acknowledge    |

## 2. SOE-1-B (staging Tier B extension): text for express acceptance

> **SOE-1-B (staging only).** For `gridview-api-staging` and installation
> `c45d60b8-a723-4b6e-8530-750592af2b94`, the product owner, as the sole
> operator, may carry out G2, G3 and G4 holding the reviewer, activator and
> recovery/export custodian roles, without separately identified backup
> reviewer, activator or custodian.
>
> **Remaining unmet, recorded, not waived:** X2 (backup reviewer), X3 (backup
> activator), X4 (backup custodian, for G3 exports), X8 (named primary/backup
> credential assignment), together with SOE-1's X1, X6, X9 and X10.
>
> **Residual risks, each accepted separately:**
>
> - **RB-1:** one person reviews evidence and activates the catalog. No
>   second person checks a review before activation.
> - **RB-2:** the export custodian and the operator are the same person. The
>   only independence is the offline encrypted copy on removable media,
>   whose passphrase only the owner holds.
> - **RB-3:** a lost activator credential blocks activation and admission
>   control until a new one is generated and provisioned. That is a
>   separately approved secret change and a new Worker version.
> - **RB-4 (if D12-A):** one command (the R0 seed) carries a reviewer
>   attestation and an activator action under a single bootstrap
>   credential. Limits: single use, expiry 2026-11-30, and validation and
>   activation still need the separate activator credential, with their own
>   operation IDs and receipts.
>
> **Mitigations (all in force):** separate credentials and operation IDs per
> role (CC-10); exact `--check` then `--preview` before every write; no
> automatic retry; durable receipts checked through `operation inspect`;
> bundled authority stays in force throughout (runtime not selected);
> before/after S5 non-interference snapshots; owner present for every remote
> step; CC-1..CC-11; the eight-hour separation for G3.
>
> **Scope and expiry:** G2, G3 and the local G4 comparisons only. Never G5,
> runtime cutover, optional-driver inventory, E2E or production. Expires with
> SOE-1 (at the latest 2027-02-28), or earlier if a second operator is named,
> the owner withdraws it, or G5 approval is requested.

## 3. Exact artifacts (verified 2026-11-22)

| Artifact                                                     | Identity                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2a config commit (admin `read-only`, third required secret) | `2ad242728765a2d6e5e0b35abc0c9fa8b1a23d4c`                                                                                                                                                                                                                                                                     |
| G2b config commit (admin `review`)                           | `faa91136f81d665bbd782c31d869a608ba302c1a`                                                                                                                                                                                                                                                                     |
| Bundle of both (dry-run from a clean checkout)               | `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8` (= G1, unchanged)                                                                                                                                                                                                                           |
| Deployment checkout                                          | `%TEMP%\gv-u11-p1` (detached, clean, Wrangler 4.112.0)                                                                                                                                                                                                                                                         |
| Credentials secret value, D12-A (4 entries)                  | SHA-256 `ce0ae8e89f6e38c9fb90e911e75709a5cc666d2491e7280881d5427379065aed`, 934 bytes                                                                                                                                                                                                                          |
| Credentials secret value, without bootstrap (3 entries)      | SHA-256 `b6de09a83b14051568a53b64379e96c12fc93f63dfe05ca4edc3073584a55ddb`, 687 bytes                                                                                                                                                                                                                          |
| Credential entries                                           | `stg-po-read-1` [reader], `stg-po-review-1` [reader, reviewer], `stg-po-activate-1` [reader, activator], expiry 2027-02-28T00:00:00.000Z; D12-A adds `stg-po-bootstrap-1` [reader, reviewer, activator], expiry 2026-11-30T00:00:00.000Z. Principal `product-owner`. Digests only; tokens DPAPI-stored locally |
| Seed review file v2                                          | SHA-256 `afba02823433104796c881fb5e37c9fab26b70d61a0a946963100b86e22b93e3`, 614,481 bytes; operation `a1cac7b4-0474-44bb-8880-ee72edd63f6f`                                                                                                                                                                    |
| `seedArtifactHash` / `approvedImportDossierId`               | `sha256:60a968019d46b95f53acaf0eb85fe2ad3d3576bed03ffcfd48c78ebf48d2072e` / `sha256:e5669182663c43969e991561a2affd4a7263d35a1b966d9224635e8828963c76`                                                                                                                                                          |
| Seed content                                                 | R0 `seed.json` `6abc3830…edab7`; catalog `sha256:8a2a62d8…39851`; projection `sha256:ab953da8…c746`; dataset `2026.10.07.1`; dossier non-synthetic, citing the 94 mappings, 101 evidence identities and the dataset version inside the seed's own sources                                                      |
| Recovery before G5                                           | R-1 (`6a60954`, bundled/off/off), R-2 (containment); both unchanged and valid while authority is bundled                                                                                                                                                                                                       |
| Recovery after G5 (prepared, not used in P1)                 | R-3 runtime-strict and R-4 runtime-unbound, derived from `faa9113`; normalized bundle `fb60cc64…`; four exports each                                                                                                                                                                                           |

Supersession note: seed review file v1 (`69591ff1…`) is kept but superseded.
Its dossier text claimed an approval that did not yet exist.

## 4. Local evidence already passed

- **Rehearsal of this exact seed file**, in an isolated local Worker bound to
  `c45d60b8-…`:
  1. bootstrap seed, activator validation and activation, reader export;
  2. offline verification passed;
  3. S3 restore: exact R0 catalog, identical snapshot in a new
     installation;
  4. parity: 0 findings on all three captures, both sides deterministic;
  5. accounting: identical request sequences (22/23/23), Jolpica
     reservations and summaries;
  6. reference equals the verified export.
- **Credentials:** each stored token authenticates, through the Worker's
  own `authenticate()`, to exactly its credential. The bootstrap token is
  refused by the 3-entry value, and an unknown token is refused.
- **Tools:** the secret-put safeguards passed in validate-only mode (hash,
  contract, no BOM, channel self-test). A wrong approved hash aborts before
  any API call. A5 refusal passed locally. The custody script passed:
  restricted ACL, owner, protected inheritance, DPAPI round trip, no
  overwrite. The GnuPG offline round trip passed (AES-256 with integrity
  protection; tampered file and wrong passphrase refused).
- **Code:** targeted tests passed, independent review (no CRITICAL or HIGH;
  MEDIUM items fixed), and the acceptance suite (§8).

## 5. Sequence (owner present for every remote step; one attempt each)

Evidence folder: `~/.gridview/evidence/identity-u11-p1-<date>/`. Tools are
in `~/.gridview/evidence/identity-u11-p1-prep-2026-11-22/` (`ops`,
`credentials`, `seed`, `custody`). Comparators 03-06 come from the G1
folder. Any deviation stops the sequence and is reported. Nothing is
cleared, repaired or retried automatically.

**P1-0 Preflight (within 30 min before M1; all read-only)**

1. Time inside the window. Owner confirms presence. Signature commit
   ≥ 8 h old.
2. `gv-u11-p1` at `2ad2427`, clean. Wrangler 4.112.0. Account `786e24f1…`.
3. `staging-state.mjs` vs `g1v-state.json`: 0 differing fields.
4. G0 GETs vs `g1v-g0`: 200, bodies identical (requestId excluded).
5. 14 public ETags identical.
6. `verify-identity-credentials.ps1` on the approved value: `failures=0`.
7. The value file and seed file hashes equal §3. CLI `seed --check`
   passes.
8. Probe A1 (no token): 404, because admin is still `off`.

**M1 Credentials secret.** `put-identity-credentials.ps1 -ValueFile <D12
value> -ExpectedSha256 <§3 hash>` from an empty directory.

- Expect: `Success! Uploaded secret IDENTITY_REVIEWER_CREDENTIALS`.
- V1: exactly one new version (`triggered_by: secret`); script etag, main
  module, exports, bindings, vars, KV, schedules, E2E and production
  unchanged; secret names = the three. G0 and ETags unchanged. A1 still 404.
- Stop if: no success line, "Creating new Worker", or any other change.

**M2 Deploy G2a.** From `gv-u11-p1` at `2ad2427`:
`npx wrangler deploy --env staging --outdir <ev>/g2a`.

- Expect: no "Created", "Deleted" or "Renamed". `index.js` =
  `fb60cc64…`.
- V2: only `IDENTITY_ADMIN_MODE` changed (to `read-only`). G0 and ETags
  unchanged.
- **A1:** no token → 401.
- **A2:** `identity-as -As read status` → 200, installation `c45d60b8-…`,
  no active revision, sequence 0.
- **A3:** probe, activator POST `{}` to `/seed` → 403
  `IDENTITY_WRITES_DISABLED`.
- **A4:** probe, shared `ADMIN_TOKEN` on an identity route → refused.
- **A5:** wrong installation in the CLI → refused locally.
- **A7:** the G0 operational GETs → 200, unchanged.

**M3 Deploy G2b.** `git checkout --detach faa9113` in `gv-u11-p1` (clean),
then the same deploy command.

- V3: only the admin mode changed (to `review`). G0 and ETags unchanged.
- **A6:** probe, reviewer POST `{}` to `/seed` → 403 `ROLE_REQUIRED`.
- **A2:** repeated.

**M4 Seed.**

1. `identity-as -As bootstrap` (D12-A) with `seed --file
staging-r0-reviewed-seed.v2.json --check`, then `--preview`. The owner
   reviews the delta and parity.
2. Then the same command with `--confirm-reviewed-operation`, once.
3. Expect: proposal `status: proposed`, `catalogHash` =
   `sha256:8a2a62d8…39851`, `parity.exactSeed: true`.
4. Receipt: `operation inspect a1cac7b4-… --family seed`.
5. Lost response: `operation inspect` first. Only the identical file may be
   resubmitted, with `--retry-same-operation`.

**M5 Validate.**

1. `build-g3-followups.mjs validate <proposal> <catalogHash>`. It refuses
   any hash other than R0.
2. `--check`, `--preview`, then execute as `-As activate`.
3. Record `reportHash`; check the receipt.

**M6 Activate.**

1. `build-g3-followups.mjs activate <proposal> <catalogHash>
<reportHash>`.
2. `--check`, `--preview`, then execute as `-As activate`.
3. Check the receipt.

**V6 Readback (as `-As read`).**

- `status`: active revision = the proposal, sequence 1.
- `revision inspect`: catalog `8a2a62d8…`, projection `ab953da8…`, dataset
  `2026.10.07.1`; 94 mappings, 101 evidence records, 7 unresolved
  acknowledgements.
- **Nothing published:** G0 bodies and 14 ETags identical. KV digest
  unchanged. Schedules `[]`.

**E7 Export and custody (local custody steps; the export is a GET).**

1. `identity-as -As read export --revision <active> --out <ev>/export/staging-r0-export.json`.
2. S3: `GRIDVIEW_U11_EXPORT=… GRIDVIEW_U11_RESULT=… npx vitest run
test/identity/integration/u11-staging-export.test.mjs`. Expect `pass`,
   exact R0, identical snapshot, creators include `reviewer`.
3. `custody-store.ps1` into `%USERPROFILE%\.gridview\custody\identity-staging`.
4. Offline copy, run by the owner personally: `gpg --symmetric
--cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count
65011712 --output staging-r0-export.json.gpg staging-r0-export.json`.
   Then decrypt-verify the SHA-256, copy it to removable media, and record
   the media label, date and hash. Pending until shown with evidence;
   required before G4 acceptance.

**G4 Local comparisons (no remote effect).**

1. For each capture (2026-10-07, 2026-10-13, 2026-10-19), from the clean
   RC checkout `gv-u11-rc` (deployed code `6a60954`): side A twice
   (`IDENTITY_CATALOG_MODE` unset), side B twice with the verified
   export.
2. Then `parity-compare.mjs` and the gated
   `u11-parity-accounting.test.ts`.
3. Required: verdict `parity`, 0 findings, and 3/3 accounting.

**V-final.** `staging-state.mjs`, G0, ETags. Operation log and `SHA256SUMS`
manifest. U11 report addendum (local documentation commit only).

## 6. G4 implementation notes (P1-e)

- **Discovery counts** (policy §3.3) do not apply offline. The generator has
  no discovery path, and staging discovery is `off`.
- **Publication eligibility** is compared at generator level: capture
  eligibility, the participation guard and identical summaries. Admission
  into a ledger is not re-run offline. It stays covered by the U8/U10
  suites and by S5-S7.

## 7. Stop conditions and recovery (no automatic action)

- **Any check differs or is ambiguous:** stop, record, report.
- **M1 uncertain:** read versions and secret names first; no second put.
- **M2 or M3 unexpected:** recovery cards C1-C8 apply. R-1 (admin `off`) is
  a forward deploy needing your live decision. Exports are never removed.
- **M4 committed but M5 or M6 fails:** stop. The proposal stays inactive;
  abandoning it needs a separate decision. A non-empty installation is
  never reseeded.
- **Activation is permanent catalog history.** Authority stays `bundled`,
  so public behaviour does not change.
- **Publication or an ETag change at any point:** stop. G0 reads only. No
  purge or republish.

## 8. Code acceptance

**PASSED.** Clean checkout of `40221552c303fbd7ebc4a255bb963fa41a41ad95`
(the final code commit), `npm test -- --maxWorkers=1 --testTimeout=30000`:

- **6,415 passed, 11 skipped, 0 failed, exit 0**: 318 files passed, 5
  skipped (323); 700 s; 2026-11-22 11:49:45Z-12:01:26Z.
- Log SHA-256
  `2b929740710489ebbbb2bd997480acd364c28b9fd76662263f05cb888e217139`.
- **Reconciliation:**
  - passed: 6,386 (RC acceptance) + 29 new tests (parity 12, drain 8,
    role-split 8, R-4 1) = 6,415;
  - skipped: 6 existing opt-in + 5 gated U11 operator tests = 11.

An earlier run with default parallelism, under concurrent load, had 49
failures: 42 timeouts at 5000 ms and one Miniflare ECONNRESET. It is kept as
evidence (log SHA-256 prefix `c9d2c47d8ceea7f2`) and not counted.

## 9. Signature (owner)

> I, the GridView product owner, approve P1 as described above:
>
> - [ ] P1-a: I accept SOE-1-B and each of RB-1, RB-2, RB-3 and RB-4
>       individually.
> - [ ] P1-b: seed credential option: D12-A / D12-B / D12-C (circle one).
> - [ ] P1-c: artifacts by hash, §3, credentials value: 4-entry `ce0ae8e8…`
>       / 3-entry `b6de09a8…`.
> - [ ] P1-d: window: `____-__-__ __:__` to `__:__` UTC (≥ 8 h after this
>       commit; before 2026-11-29T23:00Z).
> - [ ] P1-e: G4 notes acknowledged.
>
> Not approved by this signature: G5, hold or release, runtime cutover,
> synchronization, publication, optional inventory, production, E2E, push
> or merge.
>
> Signed: ____________________ Date (UTC): ____________________
