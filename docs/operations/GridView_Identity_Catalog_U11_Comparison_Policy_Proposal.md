# Proposed amendment - offline catalog-parity comparisons for U11 staging

- Date: 2026-11-17
- Status: **ACCEPTED by the product owner on 2026-11-22 (U11 decision D4)**,
  as the staging G4 method. Applied to ADR 0031 (amendment under D6) and to
  runbook §7. The original status line read "PROPOSED. Not accepted."
- Implementation notes (2026-11-22), set out for the owner in the P1 packet
  §6:
  - **Discovery counts (§3.3)** do not apply offline: the season-batch
    generator has no discovery path, and staging discovery is `off`.
  - **Publication eligibility** is compared at generator level: capture
    eligibility, the participation guard and identical summaries.
    Admission into a ledger is not re-run offline; it stays covered by the
    U8/U10 suites and by S5-S7.
- Affects: [ADR 0031](../adr/0031-identity-review-authority-and-catalog-cutover.md)
  D6; [design](../technical/GridView_Identity_Management_Design.md) §11.3
  step 5; [runbook](GridView_Identity_Catalog_Runbook.md) §7;
  [U11 report](GridView_Identity_Catalog_U11.md) Addendum A, A7.

## 1. Why the accepted wording cannot be executed safely on staging

ADR 0031 D6 requires "at least three controlled complete compare runs plus
unknown-inventory, unknown-required, invalid-payload, storage-outage and
mid-run-activation cases". Runbook §7 requires them "per intended deployment".

On the staging Worker, a complete compare run is a real coordinated
synchronization. Verified at release candidate `6a60954`:

- **Ledger writes under a hold.** A hold stops publication before anything is
  prepared or sent (`outcome/publish.ts`). But the run still commits its
  observations to the **real staging reconciliation ledger**
  (`observation/observe.ts`, `recordRunObservations` → `ledger.commit`).
- **Replays counted as confirmations.** An identical re-observation increments
  `consecutiveConfirmations` and can settle a record
  (`policy/classification.ts`, T1). The ledger's provenance field is only
  `absent | reconciled`: it cannot tell a replay from a provider response.
- **The live source is not controlled.** Staging's only provider path is the
  live proxy to Jolpica. The controlled KV source can be selected on staging,
  but it is a configuration error together with the proxy transport, and
  under it replays still enter the ledger as above.

So a "controlled" staging compare run either sends live provider traffic or
writes replayed observations into the authoritative ledger as if Jolpica had
confirmed them. Either way it could settle real rounds and shape the next real
publication after the hold is released. Neither is acceptable evidence
collection.

Design §11.3 step 5 already states the intent: "Volume can be synthetic; no
live provider call is required to establish mechanism parity." The proposal
keeps that intent and moves the provider-dependent part off the staging
ledger.

## 2. Proposed replacement text

### 2.1 ADR 0031 - proposed "Amendment (U11 comparison method)"

> **Amendment (proposed 2026-11-17, U11).** For an environment whose
> reconciliation ledger is authoritative (staging, production), the "three
> controlled complete compare runs" of D6 are satisfied by **three
> independent offline catalog-parity comparisons** (§3), plus the mandatory
> environment-specific checks S1-S7 (§4). No controlled, recorded or
> synthetic provider observation may be written into that environment's
> authoritative reconciliation ledger to satisfy a comparison count.
> Environments with an isolated, disposable ledger (local, E2E or an isolated
> staging-class Worker) may still run coordinated compare runs on a
> controlled source. Their results are labelled with that environment and are
> never reported as staging evidence. Runtime-strict cutover still requires
> every other D6 gate. This amendment changes how comparison evidence is
> collected. It does not change acceptance criteria, deadlines, guards or the
> zero-unexplained-difference rule.

### 2.2 Runbook §7 - proposed replacement of its first paragraph

> Comparison evidence for staging consists of (a) three independent offline
> catalog-parity comparisons against a verified U5 export of the staging
> catalog, and (b) the staging operational checks S1-S7. Never write a
> controlled, replayed or synthetic observation into the staging
> reconciliation ledger: an operator hold prevents publication, not ledger
> confirmations. Coordinated compare runs on a controlled source are allowed
> only on an isolated Worker with its own ledger, and are labelled as that
> environment's evidence.

## 3. The offline catalog-parity comparison

### 3.1 Inputs

| Input             | Requirement                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code              | The **deployed release-candidate commit**, proven by the staging bundle hash (for `6a60954`: `fb60cc64…85e3d8`). A different commit invalidates the comparison.                                                                                                                                                                                                                       |
| Catalog           | One authenticated read-only U5 export of the **active staging revision**, obtained by an individual `reader` credential after activation. `exportHash` verified. Revision ID, catalog hash `sha256:8a2a62d8…39851`, projection `sha256:ab953da8…c746`, dataset `2026.10.07.1` and installation `c45d60b8-…` must equal the live `identity status` / `revision inspect` readback (S2). |
| Captures          | Three independent reviewed recorded captures with per-file SHA-256 manifests, available today: `2026-10-07`, `2026-10-13`, `2026-10-19` (local `~/.gridview/frozen/<date>/capture`). Each is reviewed for completeness and provenance before use.                                                                                                                                     |
| Transport         | The generator's replay transport only: it sends nothing and throws on any unrecorded URL. No proxy, Jolpica or OpenF1 request.                                                                                                                                                                                                                                                        |
| Clock and process | Fixed per capture; a fresh process per execution.                                                                                                                                                                                                                                                                                                                                     |

### 3.2 Procedure, per capture (C1, C2, C3)

```text
# A: bundled authority (today's staging behavior)
npm run season-batch:generate -- --capture <capture> --out <out>/bundled

# B: the exported staging catalog, strict inventory
npm run season-batch:generate -- --capture <capture> --out <out>/runtime \
  --identity-mode runtime --installation-id c45d60b8-a723-4b6e-8530-750592af2b94 \
  --catalog-export <restricted>/staging-r0-export.json --inventory-policy strict-v1
```

Then compare A with B, and run each side twice to prove determinism. The
comparison harness is a small reviewed script added before G4. It only reads
the two output trees. It does not exist yet and is part of this proposal's
implementation.

### 3.3 Compared, with zero unexplained differences required

- recorded request sequence and count, and simulated limiter reservations;
- every exact typed key resolution and every canonical profile;
- calendar, circuits, participants, race classifications, driver and
  constructor standings (normalized payloads);
- the assembled season source, every generated public document (byte for
  byte), and the content and snapshot revisions;
- the publication-eligibility decision on the same in-memory ledger state;
- discovery counts in an isolated in-memory store.

Excluded only: the intentionally different private provenance envelopes. The
v2 `identityCatalog` reference block is checked separately for exact equality
with the export (installation, revision, hashes, `exportSha256` = the verified
prefixed `exportHash`, `strict-v1`).

### 3.4 What the three offline comparisons prove

- The **activated staging catalog content**, exactly as exported, resolves
  every provider key and profile identically to the bundled authority for
  three independent real seasons' inputs.
- Running the **deployed code** with that catalog produces byte-identical
  public output and identical publication eligibility.
- The export is complete, bound to the staging installation, and consistent
  with the live head readback.
- Strict inventory behavior and request accounting are unchanged for those
  inputs.

### 3.5 What they do not prove

- The staging Worker's **live pin path**: Durable Object RPC, the 2-second pin
  deadline with one identical retry, full context-load latency, and admission
  under the real lease and budgets.
- Fail-closed behavior on Cloudflare: catalog unavailable or misbound means
  zero provider requests.
- Correct namespace binding at runtime, and real restart/eviction recovery of
  the deployed object.
- Discovery persistence on staging; compare-mode logging on the Worker.
- Any property of production.

## 4. Mandatory staging-specific checks (unchanged in strength)

| ID  | Check                                                                                                                                                                                                                                         | Provider traffic     | Ledger/KV writes                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------- |
| S1  | Deployed identity: version, uploaded bundle = RC hash, four exports, `IDENTITY_CATALOG` binding to the new namespace, vars, schedules `[]`, production/E2E unchanged                                                                          | None                 | None                                      |
| S2  | Catalog readback by an individual reader: installation, active revision/sequence, catalog and projection hashes, dataset, capacity, schema                                                                                                    | None                 | Audit rows only                           |
| S3  | Verified U5 export, custody recorded, restore into a **separate isolated** test installation with parity                                                                                                                                      | None                 | None on staging                           |
| S4  | Authorization boundaries: shared `ADMIN_TOKEN` cannot mutate the catalog; reader/reviewer/activator separation; identity credentials refused on sync/rollback/purge routes                                                                    | None                 | Refused-request logs only                 |
| S5  | Non-interference across the whole comparison phase: Inspect, sequencer cutover status, KV key-name digest and public ETags identical before and after (apart from request IDs and catalog audit)                                              | None                 | Must show none                            |
| S6  | Runtime fail-closed drill before cutover, under an operator hold with drained activity: one run with the catalog binding removed (recovery R-2) must refuse before any provider request (`catalog-unavailable`), with zero requests in logs   | Must be zero         | Run bookkeeping only; separately approved |
| S7  | First runtime-strict run (cutover gate G5, separately approved, live proxy traffic): pin and context latency within the existing deadlines, one pinned revision for the whole run, no unexpected request; publication withheld under the hold | Live, approved at G5 | Normal real observations                  |

The unknown-inventory, unknown-required, invalid-payload, storage-outage and
mid-run-activation scenarios remain covered by the existing local suites
(U6-U10). They are not re-run against the staging ledger. S6 is the staging
counterpart of the outage scenario.

## 5. Acceptance is not silently redefined

Under this proposal, staging comparison acceptance = all three offline
comparisons with zero unexplained differences **and** S1-S5 passed. S6 and S7
remain runtime-cutover gates. If the owner rejects the proposal, the accepted
D6 wording stands. Staging comparison then stays **unmet** until an isolated
staging-class Worker is approved, or until the owner explicitly accepts ledger
effects (Addendum A, A7, option 3, not recommended).

## 6. Decision requested (not implied)

1. Accept or reject §2.1 as an ADR 0031 amendment and §2.2 as the runbook text.
2. If accepted: approve the comparison harness as a reviewed local tooling
   change, and name the reader who will take the staging export at G4.
