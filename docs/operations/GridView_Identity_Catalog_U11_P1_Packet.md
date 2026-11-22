# GridView identity catalog - U11 P1 packet: G2 + G3 (+ local G4) on staging

- Status: **UNSIGNED. Nothing in this packet is authorized, and the
  eight-hour interval has not started, until the product owner signs §9 and
  that signature is committed.**
- Prepared: 2026-11-22, after G1 acceptance (D0). Revised the same day for
  owner decisions D12-A, D13, D14 and P1-e. Staging baseline:
  `gridview-api-staging` version `13c3a90c-4fd8-4794-9fd6-efaf4f950bb6`.
- Scope: one combined packet for sequential operations (D6). Each operation
  has its own scope, prerequisites, checks, stop conditions and durable
  receipt. **A failure stops every later operation.**
- Not in scope: G5, runtime cutover, hold or release, synchronization,
  provider or proxy requests, publication, optional-driver inventory,
  production, E2E, push or merge.

## 1. Owner decisions recorded (2026-11-22) and still to sign

- **D12-A, selected.** A dedicated temporary bootstrap credential performs
  the R0 seed only. Validation and activation use the ordinary activator
  credential. The bootstrap is revoked immediately after the seed and its
  readback, before validation (§4).
- **D13.** Exports, per-store backup and reconstruction are preferred over
  PITR, with conditions. Assessment: G5 is **blocked** until the ledger,
  sequencer and KV have a tested recovery method
  (`GridView_Identity_Catalog_U11_Recovery_G5_Production_Proposals.md` §2).
  This does not block P1.
- **D14.** Identity admin is `read-only` in R-3, R-4 and the G5 config.
  Re-enabling `review` is a separate decision. Not used in P1.
- **P1-e, acknowledged as limitations of the offline method only.**
  Discovery counts do not apply offline. Publication eligibility is compared
  at generator level. Neither waives S1-S7, runtime binding checks,
  reconciliation safeguards, fail-closed validation or live publication
  safety before G5.
- **To sign (§9):** SOE-1-B with RB-1..RB-4 individually (§2); artifacts by
  hash (§3); operations (§5); window (§6).

## 2. SOE-1-B (staging Tier B extension): exact text for express acceptance

> **SOE-1-B (staging only).** For `gridview-api-staging` and installation
> `c45d60b8-a723-4b6e-8530-750592af2b94`, the product owner, as the sole
> operator, may carry out G2, G3 and the local G4 comparisons holding the
> reviewer, activator and recovery/export custodian roles, without
> separately identified backup reviewer, activator or custodian.
>
> **Remaining unmet, recorded, not waived:** X2 (backup reviewer), X3
> (backup activator), X4 (backup custodian, for G3 exports), X8 (named
> primary/backup credential assignment), and SOE-1's X1, X6, X9 and X10.
>
> **RB-1, single reviewer and activator.**
>
> - Risk: one person reviews the R0 evidence and activates the catalog. No
>   second person checks a review before activation.
> - Consequence: a wrong mapping in R0 would become the active catalog
>   unchallenged. It cannot be removed, only corrected by a later reviewed
>   revision.
> - Mitigations:
>   - R0 is the byte-identical regeneration of the reviewed corpus at
>     `027da5d`, with tamper and provenance checks;
>     `catalogHash` must equal `sha256:8a2a62d8…39851`;
>   - validation and activation use the activator credential with their own
>     operation IDs and receipts;
>   - authority stays `bundled`, so no runtime resolution uses the catalog
>     before G5;
>   - G4 parity must show zero differences against bundled before G5.
>
> **RB-2, custodian is the operator.**
>
> - Risk: the export custodian and the operator are the same person.
> - Consequence: no independent party holds the recovery copy. If the
>   owner's workstation and offline media were both lost, the catalog could
>   be rebuilt from R0 only. Later revisions would be lost (none exist in
>   P1).
> - Mitigations:
>   - a restricted ACL folder (owner and protected inheritance enforced),
>     plus a DPAPI copy;
>   - an offline GnuPG AES-256 copy on removable media whose passphrase only
>     the owner holds, evidenced before G4 acceptance;
>   - the S3 restore check on the same export.
>
> **RB-3, lost activator credential.**
>
> - Risk: the activator token is lost (DPAPI profile loss or deletion).
> - Consequence: activation and admission control are blocked until a new
>   credential is generated and provisioned. That is a separately approved
>   secret change, which creates a new Worker version. Public behaviour is
>   unaffected.
> - Mitigations: the token store is restricted to the owner's account;
>   rotation creates a new credential ID (U5 procedure); a reader-only
>   credential keeps inspection possible.
>
> **RB-4, temporary bootstrap credential (D12-A).**
>
> - Risk: one credential holds reviewer and activator authority together,
>   so the seed command carries a reviewer attestation and an activator
>   action under one token. While it is live, that token could also perform
>   other reviewer or activator writes.
> - It is **not technically single-use.** Only one seed is enforced, because
>   a seed is accepted only by an empty catalog. Its other authority is
>   limited by time instead:
>   - it is added to the secret only immediately before the seed (M4a);
>   - it is removed immediately after the seed and its readback (M4r);
>   - its `expiresAt`, 2026-11-23T13:00:00.000Z (the window end), is the
>     backstop if removal failed.
> - Consequence:
>   - its credential ID stays permanently in the seed dossier's `createdBy`
>     (the verifier needs that reviewer role);
>   - every secret change creates a new Worker version (two for its
>     lifecycle);
>   - if revocation could not be confirmed, P1 stops after the seed: the
>     proposal stays inactive and authority stays `bundled`.
> - Mitigations:
>   - its live window is a few minutes, in review mode, owner present;
>   - its only planned use is the exact seed file `afba0282…`;
>   - revocation is verified (bootstrap → 401, others → 200) before any
>     validation;
>   - pinned locally by the test "U11 G3 D12-A: bootstrap revoked after the
>     seed".
>
> **Controls in force:**
>
> - CC-1..CC-11, including CC-10 (separate credentials and operation IDs);
> - `--check` then `--preview` before every write;
> - no automatic retry; receipts checked through `operation inspect`;
> - before/after S5 snapshots; owner present for every remote step;
> - the eight-hour separation for G3.
>
> **Scope and expiry:** G2, G3 and the local G4 comparisons only. Never G5,
> runtime cutover, optional-driver inventory, E2E or production. Expires
> with SOE-1 (at the latest 2027-02-28), or earlier if a second operator is
> named, the owner withdraws it, or G5 approval is requested.

## 3. Exact artifacts

| Artifact                                                                                                                                                                     | Identity                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2a config commit (admin `read-only`, third required secret)                                                                                                                 | `2ad242728765a2d6e5e0b35abc0c9fa8b1a23d4c`                                                                                                            |
| G2b config commit (admin `review`)                                                                                                                                           | `faa91136f81d665bbd782c31d869a608ba302c1a`                                                                                                            |
| Bundle of both (dry-run from the clean checkout)                                                                                                                             | `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8` (= G1)                                                                             |
| Deployment checkout                                                                                                                                                          | `%TEMP%\gv-u11-p1`, clean, Wrangler 4.112.0                                                                                                           |
| Credentials value **V3** (M1, M4r): `stg-po-read-1` [reader], `stg-po-review-1` [reader, reviewer], `stg-po-activate-1` [reader, activator], expiry 2027-02-28T00:00:00.000Z | SHA-256 `b6de09a83b14051568a53b64379e96c12fc93f63dfe05ca4edc3073584a55ddb`, 687 bytes                                                                 |
| Credentials value **V4** (M4a): V3 plus `stg-po-bootstrap-1` [reader, reviewer, activator], expiry 2026-11-23T13:00:00.000Z                                                  | SHA-256 `f43640c2e77f3523450690a46f6a62678e294f0e18a74adbeb5fdbc345ca0c6b`, 934 bytes                                                                 |
| Seed review file v2                                                                                                                                                          | SHA-256 `afba02823433104796c881fb5e37c9fab26b70d61a0a946963100b86e22b93e3`, 614,481 bytes; operation `a1cac7b4-0474-44bb-8880-ee72edd63f6f`           |
| `seedArtifactHash` / `approvedImportDossierId`                                                                                                                               | `sha256:60a968019d46b95f53acaf0eb85fe2ad3d3576bed03ffcfd48c78ebf48d2072e` / `sha256:e5669182663c43969e991561a2affd4a7263d35a1b966d9224635e8828963c76` |
| Seed content                                                                                                                                                                 | R0 `seed.json` `6abc3830…edab7`; catalog `sha256:8a2a62d8…39851`; projection `sha256:ab953da8…c746`; dataset `2026.10.07.1`; non-synthetic dossier    |
| Recovery during P1                                                                                                                                                           | R-1 (`6a60954`, bundled/off/off) and R-2 (containment), unchanged                                                                                     |

All values are principal `product-owner`, digests only. Tokens stay
DPAPI-stored locally. Superseded and kept: seed file v1 `69591ff1…` (its
dossier claimed an approval that did not yet exist), and V4 with the
2026-11-30 expiry (`ce0ae8e8…`).

## 4. D12-A bootstrap lifecycle and revocation

1. **Absent during G2.** M1 puts V3, so the bootstrap does not exist on
   staging while the admin configs change.
2. **Add (M4a, remote mutation).** Immediately before the seed, in review
   mode: `put-identity-credentials.ps1 -ValueFile V4 -ExpectedSha256
f43640c2…`. The same verified BOM-safe classic `secret put` as E8
   creates one new Worker version (`triggered_by: secret`). Verify:
   - bootstrap `/health` → 200;
   - script etag, exports and bindings unchanged.
3. **Use (M4).** Exactly one seed with file `afba0282…`.
4. **Readback before revocation (V4).** As reader, both rehearsed:
   - `operation inspect a1cac7b4-… --family seed` → `committed`;
   - `revision inspect <proposal>`: `catalogHash` = R0, status
     `proposed`, matching the seed response's exact-seed parity.

   The dossier's provenance (non-synthetic, creator holding `reviewer`,
   resolved references) is verified offline on the export in S3 (E7).

5. **Revoke (M4r, remote mutation).** `put-identity-credentials.ps1
-ValueFile V3 -ExpectedSha256 b6de09a8…`, again one new Worker version.
   This **replaces the whole value**, so the bootstrap entry no longer
   exists server-side. Every request with its token fails authentication
   (401), as rehearsed.
6. **Verify revocation (V4r), before any validation:**
   - bootstrap `/health` → 401;
   - reader and activator `/health` → 200;
   - the proposal is still readable;
   - exactly one new version; code, exports and bindings unchanged.
7. **Failure handling.** If M4r reports no success, is uncertain or V4r
   fails:
   - stop; read versions and secret names; do not run M5;
   - one further M4r attempt with V3 only on the owner's live decision;
   - if revocation still cannot be confirmed, P1 ends at the seed: the
     proposal stays inactive, authority stays `bundled`, and the bootstrap
     dies at 13:00:00Z;
   - validation resumes in a later window only after revocation is
     verified.
8. **Local cleanup after V4r:** the DPAPI bootstrap file is deleted and its
   deletion recorded. Its digest stays in V4 as evidence.

## 5. Sequence (owner present for every remote step; one attempt each)

Evidence folder: `~/.gridview/evidence/identity-u11-p1-<date>/`. Tools are
in `identity-u11-p1-prep-2026-11-22/{ops,credentials,seed,custody}`. The
wrapper is invoked as `& identity-as.ps1 -As … -CliArgs @(…)`. Any deviation
stops the sequence and is reported. Nothing is cleared, repaired or retried
automatically.

**Remote mutations, in order (8):**

1. M1, secret V3;
2. M2, deploy G2a;
3. M3, deploy G2b;
4. M4a, secret V4;
5. M4, seed;
6. M4r, secret V3;
7. M5, validate;
8. M6, activate.

Plus GET-only reads and one GET export.

**P1-0 Preflight (≤ 30 min before M1, read-only)**

1. Time inside the window. Owner present. Signature commit ≥ 8 h old.
2. `gv-u11-p1` at `2ad2427`, clean. Wrangler 4.112.0. Account `786e24f1…`.
3. `staging-state.mjs` vs `g1v-state.json`: 0 differing fields.
4. G0 GETs vs `g1v-g0`: identical (requestId excluded).
5. 14 ETags identical.
6. `verify-identity-credentials.ps1` on V3 and V4: `failures=0`.
7. Value file hashes and seed file hash = §3. CLI `seed --check` passes.
8. Probe A1 → 404 (admin `off`).

**M1, secret V3.** Expect `Success! Uploaded secret
IDENTITY_REVIEWER_CREDENTIALS`.

- V1: one new version (`secret`); etag, main module, exports, bindings,
  vars, KV, schedules, E2E and production unchanged; secret names = 3. G0
  and ETags unchanged. A1 → 404.

**M2, deploy G2a.** `npx wrangler deploy --env staging --outdir <ev>/g2a`.

- Expect: no Created, Deleted or Renamed; `index.js` = `fb60cc64…`.
- V2: only the admin mode changed (to `read-only`). G0 and ETags unchanged.
- **A1:** no token → 401.
- **A2:** reader `status` → 200, `c45d60b8-…`, no active revision,
  sequence 0.
- **A3:** activator POST `{}` to `/seed` → 403 `IDENTITY_WRITES_DISABLED`.
- **A4:** `ADMIN_TOKEN` on an identity route → refused.
- **A5:** wrong installation → refused locally.
- **A7:** G0 GETs → 200, unchanged.

**M3, deploy G2b.** `git checkout --detach faa9113` (clean), then the same
command.

- V3: only the admin mode changed (to `review`).
- **A6:** reviewer POST `{}` to `/seed` → 403 `ROLE_REQUIRED`.
- **A2:** repeated.

**M4a → M4 → V4 → M4r → V4r.** As in §4. The seed runs `--check`, then
`--preview`, then `--confirm-reviewed-operation` as `-As bootstrap`. Expect:

- `status: proposed`;
- `catalogHash` = `sha256:8a2a62d8…39851`;
- `parity.exactSeed: true`.

A lost response means `operation inspect` first. Only the identical file may
be resubmitted, with `--retry-same-operation`.

**M5, validate (activator).** `build-g3-followups.mjs validate <proposal>
<catalogHash>`; it refuses a non-R0 hash. Then `--check`, `--preview`,
execute. Record `reportHash` and check the receipt.

**M6, activate (activator).** `build-g3-followups.mjs activate <proposal>
<catalogHash> <reportHash>`. Then `--check`, `--preview`, execute, check
the receipt.

**V6, readback (reader).**

- Active revision = the proposal, sequence 1. Catalog `8a2a62d8…`,
  projection `ab953da8…`, dataset `2026.10.07.1`.
- 94 mappings, 101 evidence records, 7 unresolved acknowledgements.
- **Nothing published:** G0 and 14 ETags identical. KV digest unchanged.
  Schedules `[]`.

**E7, export and custody.**

1. Reader export to `<ev>/export/staging-r0-export.json`.
2. S3: the gated `u11-staging-export.test.mjs` → `pass`, exact R0,
   identical snapshot, creators include `reviewer`.
3. `custody-store.ps1` into `%USERPROFILE%\.gridview\custody\identity-staging`.
4. Offline copy by the owner personally: `gpg --symmetric --cipher-algo
AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712`.
   Decrypt-verify, copy to removable media, and record the media label,
   date and hash. Pending until evidenced; required before G4 acceptance.

**G4, local only.**

1. For each capture, from the clean RC checkout `6a60954`: side A twice
   (`IDENTITY_CATALOG_MODE` unset), side B twice with the verified export.
2. Then `parity-compare.mjs` and the gated `u11-parity-accounting.test.ts`.
3. Required: `parity`, 0 findings, 3/3 accounting.

**V-final.** State snapshot, G0 and ETags; `SHA256SUMS` manifest; U11
report addendum (local documentation commit).

**Stop conditions:**

- any differing or ambiguous result → stop, record, report;
- M1, M4a or M4r uncertain → read versions and secret names first;
- M2 or M3 unexpected → recovery cards C1-C8; R-1 only on a live decision;
  exports never removed;
- seed committed but a later step fails → the proposal stays inactive;
  abandoning it needs a separate decision; never reseed;
- any publication or ETag change → stop; G0 reads only; no purge or
  republish.

## 6. Proposed window

- **Monday 2026-11-23, 10:00-13:00 UTC**, owner-supervised.
- **Earliest permissible start:** the later of 10:00:00Z and the signature
  commit plus 8 h. A 10:00Z start needs the signature committed by
  **2026-11-23T02:00:00Z**. If it is committed later, the start moves to
  commit + 8 h.
- **Hard end 13:00:00Z** (the bootstrap backstop expiry). The seed (M4) must
  complete before 12:45Z, otherwise M4a is not started. Validation and
  activation may finish before 13:00Z. Otherwise they wait for a newly
  approved window, with the proposal inactive and authority bundled.
- A different window means V4 is rebuilt with a new expiry (a new hash) and
  this packet is amended before signature.

## 7. Evidence and code acceptance

- **Rehearsal of the exact seed file** in an isolated local Worker bound to
  `c45d60b8-…`:
  - seed by bootstrap, validation and activation by activator, reader
    export;
  - offline verification passed; S3: exact R0, identical snapshot;
  - parity 0 findings on 3/3 captures, both sides deterministic;
  - accounting identical (22/23/23 requests).
- **Revocation lifecycle**, pinned locally: bootstrap removed after the
  seed → 401 on reads and writes; validate, activate, export, offline
  verification and pin pass with the ordinary credentials.
- **Credentials:** V3 and V4 verified through the Worker's own
  `authenticate()`, with gated exit codes.
- **Tools:** all secret-put safeguards pass in validate-only mode.
- **Acceptance:** clean `40221552c303fbd7ebc4a255bb963fa41a41ad95`,
  `npm test -- --maxWorkers=1 --testTimeout=30000`:
  - **6,415 passed, 11 skipped, 0 failed, exit 0**; log `2b929740…`;
  - reconciliation: 6,386 + 29 new tests;
  - an earlier run under load with default parallelism failed with 42
    timeouts (log `c9d2c47d…`); kept, not counted.
- **After acceptance,** only the revocation rehearsal test was added
  (`role-split.test.mjs`, 12/12, targeted). No production or tooling code
  changed.
- **Independent review:** no CRITICAL or HIGH. The 7 MEDIUM items are
  fixed. LOW items open, and accepted as operational:
  - the DPAPI copy is decryptable by any process running as the owner;
  - orphan files if generation fails mid-run (recoverable through
    BuildValue);
  - the CLI `--preview` prints the whole 600 KB seed request.

## 8. Signature (owner)

> I, the GridView product owner, approve P1 as described above:
>
> - [ ] SOE-1-B accepted, and RB-1 ☐, RB-2 ☐, RB-3 ☐ and RB-4 ☐ each
>       accepted individually (§2).
> - [ ] Artifacts by hash (§3): V3 `b6de09a8…`, V4 `f43640c2…`, seed
>       `afba0282…`, G2a `2ad2427`, G2b `faa9113`, bundle `fb60cc64…`.
> - [ ] The D12-A lifecycle and revocation (§4) and the sequence of eight
>       remote mutations (§5).
> - [ ] Window: 2026-11-23, 10:00-13:00 UTC, starting no earlier than this
>       signature commit plus 8 h (§6).
>
> Not approved by this signature: G5, hold or release, runtime cutover,
> synchronization, publication, optional inventory, production, E2E, push
> or merge.
>
> Signed: ____________________ Date (UTC): ____________________

---

## Amendment A1: owner governance decision (2026-11-22, message received about 15:45Z)

Recorded verbatim in substance from the product owner's written instruction.
It **supersedes** for this rollout the internal eight-hour waiting periods
(CC-4 as applied to P1 and to later same-day gates) and the proposed
2026-11-23 window. Earlier approvals and records are not rewritten.

- **P1 approved by the product owner** (written instruction; no separate
  signature form):
  - SOE-1-B accepted, with RB-1, RB-2, RB-3 and RB-4 each accepted as worded
    in §2. The owner confirmed that wording contains no further material
    risk or obligation.
  - D12-A approved: the bootstrap lifecycle of §4, with revocation verified
    immediately after the seed readback.
  - D14 approved: `read-only` identity administration in R-3 and R-4.
  - Artifacts as listed in §3: V3 `b6de09a8…`, V4 `f43640c2…`; V4 kept, its
    bootstrap expiry 2026-11-23T13:00:00.000Z serving as the backstop.
  - Operations as listed in §5, including all eight remote mutations, their
    checks and stop conditions.
- **Window:** 2026-11-22, from this amendment's commit, owner available for
  supervision. No further internal waiting period.
- **Also authorized today:** the real export, custody, isolated restore and
  the three G4 comparisons. Implementation and isolated testing of G5
  recovery, with no mutation of the staging ledger or published data.
- **Still requiring the owner's live confirmation before execution:**
  - the G5 runtime-strict cutover;
  - the hold release;
  - any production deployment, after production-specific recovery has been
    verified.
- **Unchanged:**
  - safeguards: fail-closed behaviour, reconciliation and publication;
  - stop rules: any failed check stops the affected sequence.
