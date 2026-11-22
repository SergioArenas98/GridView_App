# GridView identity catalog - U11: G2-G5 preparation (proposals only)

- Date: 2026-11-21. Status: **preparation. Nothing here is accepted,
  authorized or executed.**
- Each gate needs its own explicit owner approval. Under CC-4, the proposed
  eight-hour separation applies to irreversible or state-creating gates
  (G3; G5 by extension).
- Depends on G1 (approved; window 2026-11-22 11:00-12:00 UTC). Everything
  below assumes a successful inert G1. If G1 does not happen, this document
  waits.

Legend: **[L]** local preparation complete · **[E]** existing verified
evidence · **[S]** awaits the deployed staging catalog · **[A]** awaits a
specific owner authorization · **[R]** verifiable only by remote execution.

## 1. G2: catalog administration (read-only, then review)

### 1.1 Role assignment proposal [A]

PO-3 allows one individual to hold every role. No assignment exists until
the owner accepts this.

| Credential ID (proposed) | Principal                   | Roles                 | Use                                 |
| ------------------------ | --------------------------- | --------------------- | ----------------------------------- |
| `stg-po-review-1`        | `product-owner` (stable ID) | `reader`, `reviewer`  | Inspect; dossiers; approvals        |
| `stg-po-activate-1`      | `product-owner`             | `reader`, `activator` | Seed, validate, activate; admission |

- Two credentials for one person (CC-10): every audit receipt shows which
  authority acted, and review and activation can never share a command.
- Expiry: proposed **2027-02-28T00:00:00Z** at the latest, aligned with
  SOE-1.
- The recovery/export custodian also needs `reader`. It uses
  `stg-po-review-1`, or a third reader-only credential if the owner prefers
  strict separation.

### 1.2 SOE-1 Tier B extension (proposal, not accepted) [A]

> **SOE-1-B (staging only).** For `gridview-api-staging` and installation
> `c45d60b8-…94`, the product owner as sole operator may carry out G2, G3
> and G4 without separately identified backup reviewer, activator or
> custodian.
>
> - X2, X3, X4 (for G3 exports) and X8 remain **unmet** and are recorded as
>   such.
> - Controls: CC-1 to CC-11 at their gates, including CC-10 (separate
>   credentials and operations) and, for G3, the eight-hour separation.
> - Additional risks:
>   - **RB-1:** the same person reviews and activates identities;
>   - **RB-2:** the export custodian and the operator are the same person;
>     a single local custody copy and offline media are the only
>     independence;
>   - **RB-3:** a lost activator credential blocks activation until
>     re-provisioned.
> - Expires with SOE-1 (2027-02-28 at the latest). G5, optional inventory,
>   E2E and production are excluded.

### 1.3 Credential provisioning procedure [L; execution A]

All local, before any remote step:

1. Generate each token in memory: 32 bytes from the CSPRNG, unpadded
   base64url (43 characters). The U5 rules allow 43-128 characters.
2. DPAPI-store each token as a separate candidate (CurrentUser), in the
   existing private credentials folder. Never print it.
3. Compute `tokenSha256` (64 lowercase hex) in memory.
4. Build the closed JSON array in memory: `credentialId`, `tokenSha256`,
   `principalId`, `roles`, `disabled:false`, `expiresAt` (canonical UTC).
   Only digests leave the machine.
5. Remote, under the G2 approval: classic
   `wrangler secret put IDENTITY_REVIEWER_CREDENTIALS --name gridview-api-staging`
   from an empty directory, with the value on stdin. Use the **BOM-safe
   channel** (v2 method: UTF-8 without preamble plus a dummy self-test). A
   new secret creates one new version; there is no class change.
6. Verify the secret names (three expected) and that code, exports and
   bindings are unchanged.

### 1.4 Configuration changes (proposal diff; not applied) [A]

The repository config is not changed by this document. G2 needs a reviewed
config commit on top of `6a60954`, a new dry-run and a new release identity.
The bundle is expected to stay `fb60cc64…`, because vars do not enter
`index.js`; that must be verified.

```diff
 [env.staging.vars]
-IDENTITY_ADMIN_MODE = "off"
+IDENTITY_ADMIN_MODE = "read-only"   # step G2a; "review" in step G2b
 [env.staging.secrets]
-required = ["ADMIN_TOKEN", "JOLPICA_PROXY_TOKEN"]
+required = ["ADMIN_TOKEN", "JOLPICA_PROXY_TOKEN", "IDENTITY_REVIEWER_CREDENTIALS"]
```

Order:

1. The secret first, otherwise the deploy's required-secret check fails.
2. G2a: deploy `read-only` and verify.
3. G2b: deploy `review` and verify.

Catalog stays `bundled`, discovery `off`, inventory strict. Admin routes
work only when the mode is `read-only` or `review`, the installation UUID
is valid and the credentials parse (`src/admin/identity/auth.ts`).

### 1.5 Authentication and authorization checklist [R]

| #   | Check                                                              | Expected                                    |
| --- | ------------------------------------------------------------------ | ------------------------------------------- |
| A1  | `status` without a token                                           | 401                                         |
| A2  | `status` with `stg-po-review-1` (G2a)                              | 200; empty installation, no active revision |
| A3  | A mutating command `--check`/`--preview` in `read-only` mode       | Refused                                     |
| A4  | The shared `ADMIN_TOKEN` on `/internal/admin/identity/*`           | Refused (ADR 0009 amendment)                |
| A5  | Wrong installation ID in the CLI                                   | Refused                                     |
| A6  | Reviewer credential on an activator-only command (G2b `--preview`) | Refused                                     |
| A7  | Existing operational routes (G0 GETs) with `ADMIN_TOKEN`           | 200, unchanged                              |

Tokens enter only through `Read-Host -AsSecureString` into a transient
`GRIDVIEW_IDENTITY_TOKEN` (U5 guide).

### 1.6 Operation IDs, receipts, failure and recovery [L]

- Every mutation file carries its own operation UUID, expected head and
  sequence. Review and activation never share one.
- A lost response means `operation inspect` first. Retry only with the same
  request and ID (runbook §8).
- Revocation: `disabled:true`, or remove the entry and put the secret again.
- Return to admin `off`: R-1 forward deploy. Post-G1 versions share the
  class, so `wrangler rollback` between them is technically possible, but
  forward deploy remains the documented path.

### 1.7 G2 approval packet (template, unsigned)

> I approve G2 on `gridview-api-staging`:
>
> 1. `secret put IDENTITY_REVIEWER_CREDENTIALS` with the digest-only entries
>    `<ids, roles, expiry>`;
> 2. deploy commit `<config commit>` (bundle `<hash>`), admin `read-only`,
>    with checks A1, A2, A4, A5 and A7;
> 3. after verification, deploy `<commit>` with admin `review`, with checks
>    A3 and A6.
>
> No seed, validation, activation, discovery, sync or publication. SOE-1-B
> accepted: `<yes/no>`. Window `<…>`.

## 2. G3: R0 installation

### 2.1 Inputs and provenance [E/L]

- R0 files in `docs/operations/identity-seed-r0/`:
  - `seed.json`
    `6abc3830314c2c08fad2c3577141ca548b0b7e3a2109d7acf66e3c85448edab7`;
  - `manifest.json`
    `bdbaeb3792056c9d7a4e4e81633b2ce66dc7f458f55642994999de9e3bcd1fe1`;
  - `parity.json`
    `372b67eaa9ca1b8043ee1604e80961beb66274b9c95e70a40b165ec63b6d6f46`.
  - All three re-hashed 2026-11-21 and equal to the runbook.
- Provenance: corpus checks anchored to `027da5d`. Regeneration is
  byte-identical, and five kinds of tampering plus a non-descendant HEAD
  are refused (U11 B2). Repeat both on the G3 day.
- **[L, pending]** The U5 reviewed seed wrapper
  (`gridview-reviewed-seed/1`, `seedArtifactHash`,
  `approvedImportDossierId`) with an honest staging import dossier is not
  built yet. It is a local task before G3, with no remote effect, and its
  hashes go into the G3 approval.

### 2.2 Sequence (activator credential unless noted) [R; A]

1. `status` (reader): installation `c45d60b8-…94`, empty, no active
   revision. Anything else is an investigation, never a reseed.
2. `seed --file <wrapper> --check`, then `--preview`, then the execution.
   Record the operation ID and receipt.
3. `revision inspect <proposal>` (reader): delta, labels, certificate.
4. `validate <proposal> --file validation.json` (`--preview`, then the
   execution); record `reportHash`.
5. `activate <proposal> --file activation.json` (`validationReportHash`;
   `--preview`, then the execution).
6. Readback:
   - active sequence 1, exact R0;
   - complete mappings and profiles;
   - 101 original evidence records;
   - seven unresolved acknowledgements;
   - dataset `2026.10.07.1` unchanged;
   - **nothing published** (G0 GETs and ETags unchanged).
7. `export --revision <active> --out <restricted>/staging-r0-export.json`.
   Verify `exportHash` over the complete wrapper.

### 2.3 Custody, restore and backup [A/L]

- **Custodian proposal:** the product owner as recovery/export custodian.
  The backup custodian (X4) is unmet; RB-2 applies.
- **Restricted storage proposal:**
  - a dedicated folder in the private GridView directory with a
    current-user-only ACL (like the credentials folder);
  - plus one offline encrypted copy on removable media;
  - exports never go into Git.
- **Isolated restore:** fresh-installation reconstruction locally, as in
  the U8 rehearsal. The export goes into an isolated local Worker with a
  new UUID and fresh test credentials; then compare effective R0 parity.
  Original receipts and head UUID are not expected to carry over.
- **Backup plan (needed before G5, B4):** per store (catalog DO, ledger DO,
  sequencer DO, KV snapshots, admin audit, secrets names). PITR is
  undecided. **Remaining risk:** there is no tested remote restore of DO
  state.

### 2.4 Abort conditions

- A non-empty installation.
- A wrapper or seed hash mismatch.
- Any unexpected delta, `--check` or `--preview` failure, or a lost
  response without a receipt.
- Any publication or ETag change.
- Readback counts that differ.
- An `exportHash` that fails verification.

Lost response: inspect the receipt, never re-send with a new ID.

### 2.5 G3 approval packet (template, unsigned)

> I approve G3 on staging installation `c45d60b8-…94`:
>
> - seed with wrapper `<hash>` (artifact `<seedArtifactHash>`);
> - validate, then activate the resulting proposal;
> - readback and one export, held by custodian `<name/role>` in
>   `<storage>`.
>
> Committed at least eight hours before execution. No discovery, compare,
> runtime, sync or publication. Window `<…>`.

## 3. G4: offline catalog-parity comparisons

- **Method:** the existing proposal
  `GridView_Identity_Catalog_U11_Comparison_Policy_Proposal.md`. It holds
  the ADR 0031 and runbook amendment text, the procedure, the compared
  items and staging checks S1-S7. **Still awaiting the owner's decision;
  not adopted.**
- **Captures [E, verified 2026-11-21]:** per-file SHA-256 against each
  `capture.json`.

  | Capture    | Response files verified | Mismatches / missing | `capture.json` SHA-256 (prefix) |
  | ---------- | ----------------------- | -------------------- | ------------------------------- |
  | 2026-10-07 | 22                      | 0 / 0                | `279de9dd24cf8ef9`              |
  | 2026-10-13 | 23                      | 0 / 0                | `708ed333b907f4e2`              |
  | 2026-10-19 | 23                      | 0 / 0                | `32295ad5d12e9d49`              |

- **Execution [S]:** needs the verified staging export from G3.
  - For each capture, generate (A) bundled and (B) runtime with
    `--catalog-export`, `--installation-id c45d60b8-…94` and
    `--inventory-policy strict-v1`.
  - Use the replay transport only (it throws on unrecorded URLs), a fixed
    clock and a fresh process; run each side twice.
- **Compare (zero unexplained differences):**
  - request count, order and limiter reservations;
  - resolution and profiles;
  - every resource family;
  - generated documents (effective content);
  - publication eligibility.
- **[A, implementation]** The comparison harness, a small read-only diff
  script over two output trees, does not exist yet. It is a code addition
  needing its own authorization and review.
- **Never** write replay observations into the live staging ledger.
- **Evidence template per capture:**
  - capture hash;
  - code commit and bundle;
  - export revision ID and `exportHash`;
  - A and B output-tree hashes (two runs each);
  - difference list (must be empty or explained);
  - verdict.

## 4. G5: runtime-strict cutover readiness checklist

All required; each is **[S]** or **[A]** today.

1. R0 active and read back; export verified; isolated restore passed (G3).
2. Custodian, restricted storage and per-store backup plan approved; PITR
   decision made (B4).
3. Three accepted parity comparisons (G4) and the policy decision.
4. S1-S5 passed (comparison policy §4). S6, the fail-closed drill with
   binding removal under hold and drain, passed. **Corrected 2026-11-22:** the
   drill uses R-4 (runtime authority, catalog binding removed). R-2 keeps
   `bundled`, which never consults the catalog, so it cannot show the
   fail-closed refusal, and after runtime cutover no bundled config is a
   valid recovery.
5. Pin behaviour on the real Worker: a fresh run pins before provider
   construction; two-second attempts with one identical retry; latency
   within budget (S7 on the first runtime run).
6. Hold applied (separately approved) and drained:
   - leases released or expired;
   - every uncertain intent reconciled with its receipt;
   - no `publishing` disposition, unknown batch completion or pending
     publication recovery.
7. Public snapshots and publication history protected: no runtime-only
   content before cutover.
8. Config: `IDENTITY_CATALOG_MODE=runtime`; strict inventory; discovery
   off unless separately approved.
9. Forward recovery after runtime-only changes: a compatible runtime
   reader. Never return to bundled once runtime-dependent output exists.
10. G5 approval: names everything above, a separate hold-release approval,
    the eight-hour separation, and **SOE-1 does not cover G5** (a backup
    operator or a new exception is required).

## 5. Optional-driver inventory and production: dependencies

- **Optional inventory (staging):**
  - G5 accepted and stable;
  - verified active revision and export;
  - a reviewed staging-only `IDENTITY_INVENTORY_MODE = "optional-drivers"`
    and committed-environment guard adjustment;
  - the scenarios in the U11 prompt §16 via controlled sources only;
  - a strict recovery path (remove the var under hold and drain);
  - a separate owner decision.
- **Production:** the U11 §18 checklist, unchanged:
  - staging accepted through runtime-strict;
  - independent production UUID, namespace and credentials;
  - a seed prepared independently from the approved corpus;
  - named production roles and custodian (no SOE-1 carry-over);
  - a production backup plan rehearsed;
  - a production-only config diff;
  - separate explicit approval.

## 6. Owner decisions, in dependency order

1. **G1** in the approved window (already authorized; supervised session).
2. **G2:** accept the role proposal (§1.1) and SOE-1-B (§1.2); approve the
   G2 packet; authorize the G2 config commit.
3. **G3:** accept custodian and restricted storage (§2.3); authorize
   building the seed wrapper; approve the G3 packet (eight hours).
4. **G4:** decide the comparison policy (adopt or reject the proposal);
   authorize the comparison harness implementation.
5. **B4:** approve the per-store backup plan and the PITR decision.
6. **G5:** a backup operator or a new G5 exception; hold-release approval;
   G5 packet.
7. Optional inventory, then production: separate decisions.
