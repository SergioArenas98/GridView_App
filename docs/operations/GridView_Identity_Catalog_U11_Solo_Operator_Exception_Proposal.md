# GridView identity catalog - U11: single-operator staging exception (SOE-1) and risk acceptance

- Date: 2026-11-21
- Status: **PROPOSED. Not accepted.** Documentation only.
- Revision 2 (2026-11-21): corrections after owner review. The owner found
  SOE-1 acceptable in principle for Tier A only; that is **not** formal
  acceptance of SOE-1 or of RS-1 to RS-8. Changes: execution paths and the
  controlled no-sync window (§3.1, §3.2); token recovery and rotation
  consequences (§7.1); RS-3 wording; G0 read-only checks do not depend on
  SOE-1.
- Applies to: U11 staging rollout of the identity catalog
  (`gridview-api-staging`, proposed installation UUID
  `c45d60b8-a723-4b6e-8530-750592af2b94`).
- Release candidate (unchanged): `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`,
  staging bundle `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`,
  clean-checkout acceptance 6,386 passed / 6 skipped / 0 failed (U11 Addendum B).
- Remote effect of this document: **none.** Nothing was deployed, rotated,
  provisioned, seeded, activated, synchronized or published. No provider was
  contacted. Nothing was pushed or merged.

This proposal does **not** mark any backup-operator requirement as satisfied.
Every such requirement stays recorded as **unmet**. The exception only proposes
which staging steps may go ahead while it is unmet, and under which extra
controls.

## 1. Staffing decision (recorded)

Product-owner decision, received 2026-11-21:

- GridView is operated by **one person**.
- The **product owner** personally acts as:
  - primary staging operator;
  - staging release approver.
- **No separate backup operator is available.** No other person is assigned,
  and none is invented here.

Not decided by this statement, and therefore still **unassigned**:

- catalog reviewer;
- catalog activator;
- recovery/export custodian, and its backup.

PO-3 lets one authorized individual hold reviewer and activator. That is
permission, not assignment. These roles are not given to the product owner
automatically, and no credential exists for them.

## 2. Requirements that assume a distinct backup operator

Search scope: `docs/adr`, `docs/operations`, `docs/technical`, `docs/release`
at `1e24e04`. Each row stays in force as written. The status column records
that it is **not met**.

| ID  | Source                                                              | Requirement as written                                                                                                                 | Covers                                   | Status under single-operator staffing                                                      |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| X1  | ADR 0031 D6, first paragraph                                        | "Record named primary and backup coverage before provisioning or staging activation."                                                  | All D6 roles; gates provisioning (G1-G3) | **Not met.** Primary operator recorded; backup cannot be named. Exception SOE-1 proposed   |
| X2  | ADR 0031 D6 table, Reviewer                                         | "backup reviewer coverage"                                                                                                             | Reviewer (G3)                            | **Not met.** Reviewer itself unassigned. Tier B (section 4)                                |
| X3  | ADR 0031 D6 table, Activator                                        | "backup activator coverage"                                                                                                            | Activator (G3)                           | **Not met.** Activator itself unassigned. Tier B                                           |
| X4  | ADR 0031 D6 table, Backup recovery responsibility                   | "Named alternate custodian with verified restore access and documented handover/recovery duty."                                        | Recovery (G3 export, G5)                 | **Not met.** Custodian unassigned. Tier C for cutover (section 4)                          |
| X5  | ADR 0031 D6 table, Provisioning/rollout accountability              | "Named authorized operator and recorded environment-specific approval"                                                                 | G1-G5                                    | **Primary met by the 2026-11-21 decision** (operator and approver named). No backup clause |
| X6  | Runbook §1 ownership table                                          | Primary **and Backup** columns for reviewer, activator, custodian, rollout operator / incident coordinator, publication operator       | All roles                                | **Backup column not met** for any row                                                      |
| X7  | Runbook §1, text below the table                                    | "Owner supplies names, availability, escalation contacts and authority before provisioning." Incident coordinator escalates to the PO. | Availability and escalation              | **Partly met.** Escalation target and operator are the same person (section 6, RS-5)       |
| X8  | U5 admin guide, "Future provisioning, rotation and notifications"   | "assign named primary/backup reviewers, activators and recovery/export custodians"                                                     | Credential provisioning (G2)             | **Not met.** Tier B                                                                        |
| X9  | U8 report, closing paragraph                                        | "U11 must obtain ... named primary/backup roles"                                                                                       | U11 as a whole                           | **Not met** for backup. Exception SOE-1 proposed                                           |
| X10 | U11 report §4, §16 B3, A6, A8, A9 (G1 precondition), A10, B6 item 2 | Derived from X1/X6: "separately identified backup operator", "B3 operator + backup named", "named custodian and backup custodian"      | G1 and later                             | **Not met.** Superseded for G1 only if SOE-1 is accepted (Addendum C)                      |

Related wording that is **not** a backup-operator requirement:

- ADR 0031 D1, ADR 0009 note, design doc PO-3: "a second reviewer is
  recommended" for new or ambiguous identities, with **no mandatory two-person
  quorum**. With one person, that recommendation cannot be followed. This is
  listed as residual risk RS-2. It is not an unmet requirement.
- `docs/release/submission-path-decision.md`: "A second operator, or a stale
  CLI, cannot commit over a newer release." This is a concurrency guarantee,
  not a staffing requirement. Not affected.
- Production checklist (U11 §18 item 4, "Named production roles and
  custodian"): **untouched and outside this exception.**

## 3. Proposed exception SOE-1

> **SOE-1 (staging only).** For the GridView staging Worker
> `gridview-api-staging` and the staging catalog installation
> `c45d60b8-a723-4b6e-8530-750592af2b94` only, the product owner, as sole
> operator, may carry out the gates listed for Tier A in section 4 without a
> separately identified backup operator. Requirements X1, X6, X9 and X10
> remain **unmet** and are recorded as such. They are not waived for any other
> environment. The exception holds only while every compensating control in
> section 5 marked for the gate is in place and evidenced. It is not a
> precedent for E2E, production, runtime cutover or optional-driver
> activation. It ends at the first of: (a) a second operator is named, (b) the
> owner withdraws it, (c) approval of G5 is requested, (d) 2027-02-28. After
> that, a renewal must be recorded explicitly.

Why staging can tolerate this, with the limits of what has been verified:

- Staging has **no cron trigger** (schedules `[]`, read 2026-11-17, U11
  §1.2), so the Worker's `scheduled()` handler is not invoked by Cloudflare.
  This does **not** prove that nothing can run without the operator: the
  Worker can still be driven through HTTP, as section 3.1 lists. The absence
  of synchronization during a window is therefore **demonstrated by
  before/after reads inside a controlled no-sync window (section 3.2)**, not
  assumed from the schedule.
- G1 deploys the catalog **inert**: catalog `bundled`, discovery `off`, admin
  `off`, strict inventory. Public behavior and publication authority do not
  change (U11 §13).
- Production (`62bf40e9`) and E2E (`6b52bc02`) are separate Workers and
  namespaces and are not touched by any staging gate.
- If the operator stops in the middle of a window, staging stays in a defined
  stopping state (section 5, CC-5). No cron advances it. HTTP-triggered work
  is still possible for any holder of a valid staging `ADMIN_TOKEN` (section
  3.1).

### 3.1 Execution paths on the staging Worker

Source examined: release candidate `6a60954` and live staging code `027da5d`,
both read locally on 2026-11-21. Live state is taken from the 2026-11-17
read-only preflight and has **not** been re-read since.

| Path                                                                                                                                                                                                                                                                                                                                                                                                              | What has been verified                                                                                                                                                                                                                                                                                                        | Not verified                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Cron trigger → `scheduled()` (synchronization and publication)                                                                                                                                                                                                                                                                                                                                                 | The handler exists in both versions. Schedules were `[]` for staging, E2E and production on 2026-11-17.                                                                                                                                                                                                                       | Current schedules (re-read in NSW-1)                                                                                                                                               |
| P2 Admin HTTP routes authenticated by the shared `ADMIN_TOKEN`: `/internal/admin/sync/full`, `/sync/resource`, `/rebuild/home`, `/season/ingest`, `/reconciliation/verification` (and its history/rotation routes), `/reconciliation/hold`, `/release-hold`, `/clear-block`, `/disposition`, `/provider/jolpica/calendar-once`, `/publication/cutover/seed`, `/activate`, `/genesis`, `/rollback`, `/cache/purge` | These routes exist in `6a60954` (`src/admin/router.ts` and the route modules). Some can call the provider, commit to the ledger or publish. They run on demand for **any caller holding the current staging token**. The 2026-11-12 operator-reported proxy sync used this path.                                              | Who holds the current token (B1: the local copy is stale, so the current value is not even known to be in custody)                                                                 |
| P3 Durable Object alarms                                                                                                                                                                                                                                                                                                                                                                                          | `027da5d` defines no alarm. In `6a60954`, only `IdentityCatalog` defines `alarm()` (a retention sweep that re-arms itself). It is first armed by an `observe-batch` command, which comes from discovery. With discovery `off` after G1, no catalog alarm is expected. The sequencer, ledger and rate limiter define no alarm. | Remote alarm state (no catalog namespace exists yet)                                                                                                                               |
| P4 Background work after a request (`waitUntil`)                                                                                                                                                                                                                                                                                                                                                                  | In `6a60954`, only the `scheduled()` handler (P1) and discovery persistence (off after G1) use it.                                                                                                                                                                                                                            | Whether public GET routes start any provider or publication work was not re-audited for this note. U11 §1.2 shows public ETags and KV keys unchanged from 2026-11-03 to 2026-11-17 |
| P5 GitHub Actions                                                                                                                                                                                                                                                                                                                                                                                                 | Workflows in `6a60954` and the local `master` ref have no `schedule:` trigger and do not reference `ADMIN_TOKEN` or `/internal/admin`. `automation-monitor` is manual dispatch only.                                                                                                                                          | The remote repository's secrets and workflows on other remote branches (not inspected; no remote reads were made)                                                                  |
| P6 Other Cloudflare principals (account members, API tokens, dashboard actions) able to deploy, change secrets or call the Worker                                                                                                                                                                                                                                                                                 | Every recorded staging deployment was authored by the product owner's account.                                                                                                                                                                                                                                                | Inventory of account members and API tokens with Workers rights                                                                                                                    |
| P7 Work admitted before the window (held leases, uncertain verification or batch intents, pending publication recovery)                                                                                                                                                                                                                                                                                           | Not visible without a valid token (B1).                                                                                                                                                                                                                                                                                       | All of it until G0 runs                                                                                                                                                            |

P2 and P6 are the gaps: nothing technical stops a holder of the token or of a
Cloudflare credential from starting work during a window. The controlled
window below detects such work. It cannot prevent it. This falls under
residual risks RS-1 and RS-4. No production or runtime logic is added or
changed to close it.

### 3.2 Controlled no-sync window (required for G1)

An operator hold is **not** used for G1. Applying one is a remote mutation
that needs its own approval, and a hold stops publication but not ledger
commits (U11 A7).

| Step                     | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NSW-0 Record             | The G1 approval record names the window's start and end (UTC), the operator, and the only permitted operations: the approved G1 deploy plus the reads in NSW-1 and NSW-3.                                                                                                                                                                                                                                                             |
| NSW-1 Pre-window reads   | At most 30 minutes before the upload: the three G0 GETs (no hold or durable block, lease released, no uncertain verification or batch intent, no pending publication recovery; last sync and ledger record versions noted); schedules `[]` for staging, E2E and production; staging deployment list unchanged with `1d858d56` active; KV names digest; public ETags; resolved-versus-live configuration; on-the-day R-1 dry-run hash. |
| NSW-2 During the window  | The operator issues no admin POST, dispatches no GitHub workflow, runs no `wrangler` command other than the approved deploy, and keeps no other operating session open.                                                                                                                                                                                                                                                               |
| NSW-3 Post-deploy reads  | G1v, plus the three G0 GETs again: last sync, lease, intents and ledger record versions **unchanged** from NSW-1; KV digest and public ETags unchanged; schedules still `[]`; E2E and production unchanged.                                                                                                                                                                                                                           |
| Abort before upload      | Any of: a held lease, an uncertain intent, a hold or block not in the baseline, any sync or ledger change since NSW-1, non-empty schedules, an unexpected deployment or version, a changed KV digest, ETag or resolved config, a failed or refused read (401 or 5xx), a dry-run hash other than `fb60cc64…85e3d8`, or the window's end reached. Effect: do not deploy, record the reason, nothing to undo.                            |
| Discrepancy after upload | Stop and record it. Follow the CC-7 recovery card (R-1 or R-2 forward deploy, or leave and re-read). Never roll back to `1d858d56`. Never clear a hold or block to recover.                                                                                                                                                                                                                                                           |

### 3.3 Scope of the exception

What the exception does **not** relax: any technical or publication
safeguard. Holds, durable blocks, D14-D16, strict inventory, individual
credentials, fail-closed admission, forward-only recovery and per-gate
approval stay exactly as specified.

## 4. Requirement tiers: inert deploy versus later gates

| Gate                                                              | Tier | Single-operator position                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 read-only checks                                               | A    | **Does not depend on SOE-1 acceptance.** These read-only checks are already authorized (U11 A6) and may run whenever a valid staging token is available (section 7.1). Repeated as NSW-1 and NSW-3 inside the G1 window.                           |
| G1 first inert staging deploy                                     | A    | Covered by SOE-1 only once SOE-1 is accepted, with CC-1 to CC-9 and CC-11, inside the controlled no-sync window (section 3.2). Remains irreversible for `wrangler rollback` (ends rollback to `1d858d56` and earlier).                             |
| G1v post-deploy reads                                             | A    | Covered by SOE-1.                                                                                                                                                                                                                                  |
| G2 reviewer/activator credentials, admin `read-only` and `review` | B    | **Not covered by SOE-1 acceptance alone.** Needs reviewer and activator to be assigned (PO-3 allows the same individual), CC-10, and a separate SOE-1 extension item (X2, X3, X8) accepted explicitly.                                             |
| G3 seed, validate, activate R0; export readback                   | B    | Same as G2, plus a named recovery/export custodian and restricted storage (B4 in part). Backup custodian (X4) stays unmet and must be listed in the G3 approval.                                                                                   |
| G4 comparison (per B6 decision)                                   | B    | Offline parity (if accepted) has no remote effect beyond one audited export read. Other options need their own review.                                                                                                                             |
| G5 runtime-strict cutover                                         | C    | **Not covered.** Requires B4 in full (custodian, per-store plan, verified export and isolated restore drill), plus either a named backup operator/custodian or a new, separately justified G5 exception. SOE-1 ends when G5 approval is requested. |
| Optional-driver inventory                                         | C    | **Not covered.** Separate owner decision after G5 acceptance, as before.                                                                                                                                                                           |
| Production (any change)                                           | -    | **Excluded.** U11 §18 checklist unchanged, including named production roles and custodian. No staging exception carries over.                                                                                                                      |

## 5. Compensating controls

Each control replaces part of what a second person would provide: a second
check, continuity, and an independent record. "Evidence" is what must exist
before the gate is approved.

| ID    | Control                                   | Compensates for                                 | Required for | Evidence before approval                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ----------------------------------------- | ----------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CC-1  | **Verified forward recovery**             | No second person to improvise recovery          | G1 onward    | On the day of the window, from a clean `6a60954` worktree: R-1 dry-run reproduces `fb60cc64…85e3d8`; R-2 config builds to the A4-recorded bundle after path normalization. Hashes written to the window log. `027da5d`-era builds are forbidden (A4).                                                                                                                                                                                                                                                                              |
| CC-2  | **Secure credential custody**             | Credential loss with nobody else holding access | G0 onward    | Staging `ADMIN_TOKEN` only in the DPAPI store, never printed; Cloudflare OAuth only in process memory. Owner attests (no secret shown) that the Cloudflare account has MFA and that account-recovery codes are stored offline, apart from the workstation. Recovering the token follows section 7.1: placed from authorized secure custody without being shown, or, if unavailable, a staging-only rotation under its own remote-mutation approval. A token is never copied into files, chat, Git, logs or command-line arguments. |
| CC-3  | **Complete operation log**                | No witness                                      | G0 onward    | One log per window: UTC time, exact command, commit, bundle hash, HTTP status, version IDs, outcome. No secrets. At window end a SHA-256 manifest of the log and evidence files is produced and recorded in a local docs commit (hashes only, no local paths, since the repository is public).                                                                                                                                                                                                                                     |
| CC-4  | **Explicit approval checkpoints**         | Self-approval in the moment                     | G1 onward    | A written approval record per gate naming exact values (commit, bundle, UUID, config, permitted operations, abort conditions), committed locally **before** the window. Proposed for irreversible gates (G1, G3): at least 8 hours between the approval record and execution. At the start of the window, a read-back checklist: any value mismatch means abort.                                                                                                                                                                   |
| CC-5  | **Holds, drain and safe stopping points** | Nobody to finish a half-done window             | G1 onward    | G0 shows no operator hold or durable block, the lease released, no uncertain verification or batch intent, no pending publication recovery. No synchronization during the window, demonstrated by the controlled no-sync window (section 3.2: NSW-0 to NSW-3 and its abort conditions), not by the empty schedule alone. Defined stopping states: before upload (nothing changed); after G1 (inert, crons `[]`). Existing holds and blocks are never cleared to make a step pass.                                                  |
| CC-6  | **Durable receipts**                      | Lost response with nobody cross-checking        | G1 onward    | G1: Cloudflare version ID and uploaded bundle hash recorded and compared. G2/G3: every mutation carries an operation ID, and its receipt is read back (`operation inspect`). A lost response is retried only with the same request and operation ID (runbook §8).                                                                                                                                                                                                                                                                  |
| CC-7  | **Documented recovery procedures**        | No second person to recall the procedure        | G1 onward    | A recovery card, written before the window, for each G1 failure: bundle mismatch, binding/namespace anomaly, public ETag change, schedule change, production/E2E change. Each maps to: stop, record, R-1 or R-2 forward deploy, or leave as is and re-read. Rollback to `1d858d56` is listed as impossible after G1.                                                                                                                                                                                                               |
| CC-8  | **Mechanical cross-checks**               | No second pair of eyes                          | G0 onward    | `cf-read.mjs`, `resolved-vs-live.mjs`, `public-etags.mjs` and the bundle-hash comparison run before and after, and their outputs are diffed. Tool-assisted review of the approval record is allowed but **is not counted as an independent human reviewer**.                                                                                                                                                                                                                                                                       |
| CC-9  | **Continuity note**                       | Bus factor of one                               | G1 onward    | A private note (outside the public repository, no secrets) stating where custody lives, the current gate, live version IDs and the recovery card. Lets the owner, or anyone they later authorize, resume from a known state.                                                                                                                                                                                                                                                                                                       |
| CC-10 | **PO-3 separation of operations**         | Same person reviewing and activating            | G2, G3       | Review and activation are separate authenticated operations, with separate operation IDs and audit receipts, never one command. Activation re-reads the reviewed head and hash first. Proposed: separate credential IDs per role even for the same principal, so the audit trail shows which authority acted. No role is assigned and no credential is created by this document.                                                                                                                                                   |
| CC-11 | **Scope containment**                     | Wider blast radius from an unchecked error      | All          | Production and E2E version IDs, schedules and KV digests read before and after each window and confirmed unchanged. No E2E or production command in a staging window.                                                                                                                                                                                                                                                                                                                                                              |

## 6. Residual risks (pending product-owner review; none accepted)

| ID   | Risk                                                                                                                 | Mitigation                     | Remaining exposure                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RS-1 | An operator error goes unnoticed in real time: nobody else watches                                                   | CC-4, CC-8, CC-3               | Errors are caught only after the fact, by checks and logs                                                                                                         |
| RS-2 | The recommended second reviewer for new or ambiguous identities cannot be used                                       | CC-10; R0 is a reviewed corpus | Review quality depends on one person (relevant at G3, not G1)                                                                                                     |
| RS-3 | Operator unavailable: staging cannot be recovered until they return                                                  | CC-5, CC-9, section 3.2        | Staging may stay degraded for an unbounded time. **Pending owner review.** No cron runs, but HTTP-triggered work by a token holder remains possible (section 3.1) |
| RS-4 | Credential loss (workstation, DPAPI profile or Cloudflare account) with nobody else holding access                   | CC-2                           | Losing the Cloudflare account blocks all operations until account recovery                                                                                        |
| RS-5 | Self-approval: approver, operator and escalation target are one person                                               | CC-4 time separation, CC-3     | No independent veto                                                                                                                                               |
| RS-6 | G1 is irreversible for `wrangler rollback`; with one operator there is no second check before the point of no return | CC-1, CC-4, CC-7               | Same irreversibility as before; only forward recovery exists                                                                                                      |
| RS-7 | Local evidence can be altered by the same person who produced it                                                     | CC-3 hash manifests committed  | Hashes show later change, not who made it                                                                                                                         |
| RS-8 | Fatigue or time pressure during a window                                                                             | CC-4 time gap, CC-5 stops      | Residual human error                                                                                                                                              |

## 7. Exact remaining gates

### 7.1 Read-only diagnostics and the staging token (do not need SOE-1)

The three G0 GETs (`CutoverStatus`, `SyncStatus`, `Inspect`) and the
Cloudflare, resolved-config, KV and public-ETag reads are already authorized
(U11 A6 and A9). They may run as soon as a valid staging `ADMIN_TOKEN` is in
custody. **SOE-1 acceptance is a prerequisite for G1, not for these
read-only checks.** They cause no hold, drain or mutation.

Getting a valid token (B1), in order:

1. **Token available through authorized secure custody.** The owner places
   the current value into the existing DPAPI-encrypted local store using the
   existing local procedure. It is never displayed, printed, logged, pasted
   into chat, committed to Git or passed as a command-line argument. This is a
   local action with no remote effect. The G0 GETs then confirm it (HTTP 200).
2. **Token not available.** The only remaining route is a **staging-only
   rotation** of `ADMIN_TOKEN` (`wrangler secret put ADMIN_TOKEN --env
staging`, new value from at least 32 random bytes, placed only in the
   Worker secret and the DPAPI store). This is a **remote mutation**. It needs
   its own explicit authorization, separate from SOE-1 and G1. It is **not
   proposed for approval here and is not done.** If it is ever authorized:
   - it runs in its own controlled window (section 3.2 reads before and after);
   - it creates a **new deployed staging Worker version** (as with `1d858d56`,
     which was `triggered_by: secret`) carrying the same `027da5d` code; there
     is no class change, so it does not move the rollback floor;
   - the baselines change: the active staging version is no longer
     `1d858d56`. The preflight baseline (deployments, versions, resolved
     config, bundle hash of the new version against `7415b82d…`, KV digest,
     public ETags) must be re-read and recorded, and every approval record
     that names the active staging version (the G1 approval, recovery card,
     NSW-1 baseline) must be refreshed before use;
   - any holder of the old value loses admin access, which also closes part of
     the P2 gap (section 3.1).

### 7.2 Before G1 (first inert staging deploy)

G1 stays **NO-GO** until all of these are true and evidenced:

1. **B1 - current staging `ADMIN_TOKEN` verified** by section 7.1 route 1 (or
   route 2, if separately authorized and completed with refreshed
   baselines). The three G0 GETs return 200.
2. **G0 read-only checks pass.** No operator hold or durable block, lease
   released, no uncertain verification or batch intent, no pending
   publication recovery. `cf-read.mjs`, `resolved-vs-live.mjs` and
   `public-etags.mjs` match the recorded baseline (2026-11-17, or the
   refreshed one after a rotation). Staging still on the recorded active
   version (`1d858d56` unless rotated), E2E `6b52bc02`, production
   `62bf40e9`, all with schedules `[]`.
3. **SOE-1 recorded and explicitly accepted** by the product owner, including
   residual risks RS-1 to RS-8 and the statement that X1, X6, X9 and X10 stay
   unmet.
4. **Role record** (from the 2026-11-21 decision): primary staging operator =
   product owner; staging release approver = product owner; backup operator =
   none (SOE-1).
5. **Compensating-control evidence for Tier A**: CC-1 rebuild hashes on the
   day, CC-2 owner attestation, CC-3 log prepared, CC-4 approval record
   committed before the window, CC-7 recovery card, CC-9 continuity note,
   CC-11 baseline reads.
6. **Explicit G1 approval** naming commit `6a60954`, bundle
   `fb60cc64…85e3d8` and UUID `c45d60b8-a723-4b6e-8530-750592af2b94`, and
   accepting that creating `IdentityCatalog` ends `wrangler rollback` to
   `1d858d56` (or its rotated successor) and earlier, with R-1/R-2 as the
   only recovery path.
7. **Controlled no-sync window** (section 3.2): NSW-0 recorded; NSW-1 reads
   clean; no abort condition; uploaded bundle equal to the recorded hash;
   NSW-3 (including G1v) reads clean afterwards.

### 7.3 Later gates (unchanged in substance, restated)

- **G2**: reviewer and activator assigned by the owner (may be the same
  individual under PO-3); individual credentials issued and held per CC-2;
  CC-10; SOE-1 Tier B extension (X2, X3, X8) accepted explicitly.
- **G3**: recovery/export custodian and restricted storage named; backup
  custodian (X4) recorded as unmet in the G3 approval.
- **G4**: B6 comparison-policy decision.
- **G5**: B4 complete (custodian, per-store backup plan, verified export and
  isolated restore drill, PITR decision); a backup operator/custodian **or** a
  new, separate G5 exception; explicit cutover approval. SOE-1 ends here.
- **Optional-driver inventory**: separate decision after G5 acceptance.
- **Production**: U11 §18 checklist, unchanged; no exception applies.

## 8. Proposed acceptance wording (for the owner; not signed)

> I, the product owner and sole GridView operator, accept exception SOE-1 as
> written in `GridView_Identity_Catalog_U11_Solo_Operator_Exception_Proposal.md`
> for staging Tier A gates (G0, G1, G1v). The read-only G0 checks are
> already authorized and do not depend on this acceptance. I accept residual
> risks RS-1 to RS-8.
> I acknowledge that the backup-operator requirements X1, X6, X9 and X10 remain
> unmet and are not waived for any other gate or environment. This acceptance
> does not approve G1. G1 needs its own approval naming commit `6a60954`,
> bundle `fb60cc64…85e3d8` and UUID `c45d60b8-a723-4b6e-8530-750592af2b94`.

## 9. Proposed notes for the normative documents (not applied)

ADR 0031 D6 and runbook §1 are **not edited** by this proposal, so the
original requirement stays visible. If SOE-1 is accepted, the proposed
addition, placed directly below each requirement, is:

> **Staging exception SOE-1 (2026-11-21, owner decision pending/accepted on
> <date>).** GridView has one operator. The backup coverage required above is
> **not met** for staging. Tier A gates (G0, G1, G1v) may go ahead under SOE-1
> with the compensating controls in
> `GridView_Identity_Catalog_U11_Solo_Operator_Exception_Proposal.md`. The
> requirement remains in force for G2-G5, optional-driver activation and
> production unless separately excepted.
