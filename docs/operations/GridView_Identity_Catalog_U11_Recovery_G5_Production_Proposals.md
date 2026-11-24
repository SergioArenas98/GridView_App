# GridView identity catalog - U11: recovery plan, G5, optional inventory and production (proposals)

- Date: 2026-11-22. Status: **PROPOSALS ONLY.** Nothing here is accepted,
  activated or authorized. Each item names the separate decision it needs.
- Covers owner decisions D7 (backup and PITR), D8 (G5 exception), D9
  (stability), D10 (production exception), D11 (optional-inventory timing),
  plus local tasks L10 and L11.

## 1. Recovery configurations

| Config              | Authority          | Catalog binding | Exports | Valid while                                                  | Status                                       |
| ------------------- | ------------------ | --------------- | ------- | ------------------------------------------------------------ | -------------------------------------------- |
| R-1 (`6a60954`)     | bundled, admin off | yes             | 4       | authority is bundled and no runtime-only facts are published | built, `fb60cc64…`                           |
| R-2 (containment)   | bundled            | removed         | 4       | same as R-1                                                  | built, normalized `fb60cc64…`                |
| R-3 runtime-strict  | runtime, strict    | yes             | 4       | after G5                                                     | built from `faa9113`, normalized `fb60cc64…` |
| R-4 runtime-unbound | runtime, strict    | removed         | 4       | S6 drill; containment after G5                               | built from `faa9113`, normalized `fb60cc64…` |

- **R-4 behaviour.** A manual run with runtime authority and no binding
  ends `failed / identity / catalog-unavailable`. It sends zero provider
  requests, prepares and finalizes nothing, keeps the active version and
  releases the lease. A bundled control run proceeds. This is pinned by
  `cutover.test.mjs` ("U11 R-4").
- **After runtime-only facts are published,** R-1 and R-2 are no longer
  operational recovery. Recovery is R-3 or R-4 only, regenerated from the
  G5 commit by `make-recovery-configs.mjs`.
- **Admin mode (D14, decided 2026-11-22).** Identity admin is `read-only`
  in R-3, R-4 and the G5 config:
  - built as `wrangler.r3-runtime-strict.admin-read-only.toml` and
    `wrangler.r4-runtime-unbound.admin-read-only.toml` from `faa9113`;
  - normalized bundle `fb60cc64…`, four exports each.
  - G5 verification is unaffected: hold, drain, S6/S7 runs and Inspect use
    the operational `ADMIN_TOKEN` routes, and catalog status, inspection
    and export are GETs.
  - What is lost: the in-place catalog admission pause (an activator
    write). Containment during G5 is R-4.
  - Re-enabling `review` is a separate, controlled decision.

## 2. Backup and restore (D7)

### 2.1 What Cloudflare PITR is (official docs, read 2026-11-22)

- **Scope.** SQLite-backed Durable Objects only: "restore a Durable
  Object's embedded SQLite database to any point in the past 30 days".
  Covers SQL and key-value data in the object.
- **API.** Exists only inside the object's own code, through
  `ctx.storage.getCurrentBookmark()`, `getBookmarkForTime(t)` and
  `onNextSessionRestoreBookmark(b)`. The restore takes effect after a
  restart (`ctx.abort()`). It is reversible through the bookmark that
  `onNextSessionRestoreBookmark` returns. Not available in local
  development. The docs describe no REST, dashboard or Wrangler restore,
  and say nothing about alarms, cost or in-flight requests.
- **Workers KV.** No point-in-time recovery is documented.
- **GridView today.** No class calls these methods (searched
  2026-11-22). PITR therefore **cannot be used** for the catalog, ledger,
  sequencer or limiter without new code: a guarded bookmark-capture route
  and a restore path inside each class. That is a separately reviewed code
  change and a deployment (decision **D13**).
- **Not a consistent backup.** PITR is per object and approximate in time,
  so it is never a transactionally consistent backup across the catalog,
  ledger, sequencer and KV.

### 2.2 Recovery matrix, per store

| Store                         | Authoritative content                                         | Primary recovery                                                                                                                                                  | Supplementary                                            | Restore order     | Tested                                          |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------- | ----------------------------------------------- |
| IdentityCatalog DO            | revisions, decisions, evidence, receipts, pins                | verified U5 export, then fresh R0 reconstruction in a **new** installation; history beyond R0 is rebuilt from the export lineage (revisions, decisions, evidence) | PITR if D13 is built; bookmark recorded before each gate | 1                 | local S3 (rehearsed); remote: no                |
| ReconciliationLedger DO       | observations, classification, leases, publication disposition | none can be exported today. Ledger state is rebuilt from provider truth through normal runs; not restorable from a GridView artifact                              | PITR if D13 is built                                     | 2                 | no                                              |
| SeasonPublicationSequencer DO | cutover authority, versions, fingerprints                     | existing ADR 0025 activation and republication procedures                                                                                                         | PITR if D13 is built                                     | 3                 | procedures documented, not drilled for identity |
| KV snapshots                  | public documents, pointers                                    | republication from the sequencer authority (ADR 0025); key-name digest recorded at every gate                                                                     | none (no KV PITR)                                        | 4                 | digest checks only                              |
| Admin audit                   | in the catalog DO                                             | part of the catalog export                                                                                                                                        | —                                                        | with 1            | as 1                                            |
| Secret names                  | Cloudflare                                                    | DPAPI-held tokens; digest value files kept privately                                                                                                              | —                                                        | before any deploy | rotation procedure (E8)                         |

**Restore principles:**

- never restore over a non-empty store;
- restore into new installations;
- reconcile against the sequencer before any publication;
- every remote restore needs its own approval.

**Residual risk:** no remote restore of Durable Object state has been
tested, for any store.

### 2.3 D13 assessment (2026-11-22): **G5 BLOCKED**

The owner prefers exports, per-store backup and reconstruction to PITR,
provided every required store has a complete, safe and tested recovery
path. Today only the catalog does, so G5 is blocked.

| Store                                                                                            | Recoverable by export or reconstruction?                                                                                               | Tested                                                    | Status                                                                                          |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| IdentityCatalog content (revisions, decisions, evidence, lineage)                                | Yes: verified U5 export, then reconstruction in a new installation (S3)                                                                | Locally (S3 rehearsal); repeated on the real export in P1 | **Adequate** for R0                                                                             |
| Catalog operation receipts and run pins                                                          | **No**: receipts and pins do not carry over to a reconstructed installation (U8 restore test)                                          | n/a                                                       | **Not recoverable**: recorded loss; acceptable only if no in-flight operation exists at failure |
| ReconciliationLedger (observations, classification, settlement, leases, publication disposition) | **No**: no export or import facility; rebuilding by re-observation would restart confirmations and could not reproduce settled history | No                                                        | **BLOCKER B-G5-1**                                                                              |
| SeasonPublicationSequencer (cutover authority, active and previous versions, fingerprints)       | **Partly**: ADR 0025 activation and republication procedures exist; restoring sequencer state itself is not possible                   | Not drilled for this purpose                              | **BLOCKER B-G5-2**                                                                              |
| KV public snapshots                                                                              | **Partly**: republication from sequencer authority (ADR 0025); key-name digest recorded at every gate; no KV backup feature            | No drill evidence in U11                                  | **BLOCKER B-G5-3**                                                                              |
| Admin audit evidence                                                                             | Catalog part: through the export lineage. Operational logs: Cloudflare persisted logs only                                             | Catalog part: S3                                          | **Partial**: recorded limitation                                                                |

**Smallest adequate fix (proposal; needs code review, its own approval and
an isolated drill):**

1. **PITR instrumentation** for the IdentityCatalog, ReconciliationLedger
   and SeasonPublicationSequencer classes:
   - an operator-authenticated `GET bookmark` (`getCurrentBookmark`), so
     the bookmark of every gate is recorded;
   - a `POST restore` (`onNextSessionRestoreBookmark` plus `ctx.abort()`),
     refused unless a hold is applied and the request names the exact
     expected bookmark;
   - every call recorded.

   PITR is the only mechanism Cloudflare supports for these SQLite objects,
   and it is not available locally.

2. **Drill on an isolated Cloudflare Worker** (a new script name and new
   namespaces, never staging): capture a bookmark, mutate, restore, verify,
   and undo through the returned bookmark. Needs separate approval for that
   Worker.
3. **A KV snapshot artifact:**
   - a GET-only key-and-value export with a digest per key, taken at each
     gate;
   - a republication drill from sequencer authority on the same isolated
     Worker.

Until 1-3 are done and accepted, G5 stays blocked. P1 is not affected: G3
creates only catalog state, which the export path covers.

## 3. G5 single-operator exception (D8), draft for review; not accepted

> **SOE-G5 (staging only, runtime-strict cutover).** For
> `gridview-api-staging` and installation `c45d60b8-…`, the product owner
> as sole operator may execute the G5 sequence (hold, drain, S6 on R-4,
> runtime-strict deploy, S7 under hold, and hold release on a separate live
> confirmation) without a backup operator. It applies only if all of these
> hold:
>
> 1. **Recovery stronger than G3:**
>    - a verified export less than 24 h old at cutover, held in custody,
>      with its offline encrypted copy evidenced;
>    - an isolated restore (S3) passed on that same export;
>    - R-3 and R-4 regenerated from the G5 commit and dry-run-matched on
>      the day.
> 2. **Bookmarks, if D13 is implemented:** a PITR bookmark captured and
>    recorded for the catalog, ledger and sequencer immediately before
>    cutover.
> 3. **No publication before checks:** no runtime-only content may be
>    published before S7 passes. The hold is released only on the owner's
>    live confirmation, after reviewing S7.
> 4. **Fail-closed proven on the real Worker (S6):** zero provider requests
>    and `catalog-unavailable`, under hold and drain, before cutover.
> 5. **Abort rules:**
>    - any unexplained difference, latency outside the existing deadlines,
>      unexpected request, or publication under hold means R-4 (containment)
>      on live confirmation, and stop;
>    - never a return to bundled after runtime-dependent output exists.
> 6. **One cutover attempt per window**, owner present for its whole
>    duration, eight-hour separation from approval.
> 7. **Continuity:** the CC-9 note is updated with the G5 state before the
>    window.
>
> **Remaining unmet:** X1-X10 as recorded. **Additional risk RG-1:** if the
> single operator becomes unavailable mid-G5, staging can stay held (safe,
> stale) until they return. **Expiry:** the G5 window only.

## 4. Stability after G5 (D9), proposed criterion; authorizes nothing

- **Criterion.** Three individually authorized, monitored, genuine runtime
  synchronization runs, each driven by a real provider change or a
  scheduled need. Each must show:
  - one pinned revision for the whole run;
  - request counts within the existing budget;
  - no unexpected request;
  - no unexplained identity, classification or publication difference
    against the bundled-era expectation;
  - publication outcomes consistent with the existing guards.
- **Never:** extra provider traffic only to raise the count; forced
  publication; cleared reconciliation state; relaxed withholding.
- **If three meaningful runs are not possible** (rate limits, season over,
  legitimate withholding), the alternative evidence is:
  - each run that did occur;
  - offline parity on any new capture;
  - G0 non-interference over the period;
  - a written owner judgement naming the gap.

## 5. Optional-driver staging activation (D11, L10), P3 skeleton; not started

- **Preconditions:** G5 accepted; stability evidence (§4); verified active
  revision and export.
- **Config proposal (L10).** Staging only:
  `IDENTITY_INVENTORY_MODE = "optional-drivers"`. The committed-config
  guard (inventory acceptance 37) currently forbids naming it, so P3 needs
  a reviewed, staging-only guard change; production and E2E stay
  forbidden. `resolveOperationalInventoryMode` already requires runtime
  authority for it.
- **Scenarios:** U11 prompt §16, through controlled sources only.
- **Recovery:** remove the variable under hold and drain, then forward
  deploy.
- **Timing:** an eight-hour interval from approval to execution (D11). The
  interval starts only once the evidence and the signed P3 exist.

## 6. Production readiness (L11) and production exception (D10), proposals

**L11 prerequisites (unchanged U11 §18):**

- staging accepted through runtime-strict;
- an independent production installation UUID, namespace and credentials,
  never shared with staging or E2E;
- a production seed prepared independently from the approved corpus;
- a production-only config diff;
- a rehearsed production backup plan;
- named production roles and custodian;
- separate explicit approval.

**SOE-P (draft for review; not accepted).** Production has greater impact
(real users, no disposable ledger), so a single-operator exception needs
more than SOE-1:

- independent recovery: a production export and offline copy, a production
  S3 restore, and production R-3/R-4 equivalents;
- a production PITR bookmark capability (D13), shown working before
  cutover;
- a longer separation: 24 h from approval for state-creating gates;
- a staged exposure plan: hold through the first runtime run, then release
  on confirmation;
- an external escalation contact for incidents (not an operator), recorded
  in the continuity note;
- an expiry no later than the first production release after cutover.

**Not waivable even under SOE-P:**

- separate credentials per role (CC-10);
- no automatic retry;
- fail-closed runtime admission;
- historical publication guards;
- the ban on writing controlled observations into the production ledger;
- explicit production approval.

## 7. Decisions these proposals add

- **D13 (decided 2026-11-22, conditional):** G5 is blocked by
  B-G5-1..3 (§2.3). Decide whether to authorize the smallest adequate fix
  (§2.3, items 1-3).
- **D14:** decided: `read-only` (§1).
- Review and accept or amend: SOE-G5 (§3), the stability criterion (§4) and
  SOE-P (§6).
