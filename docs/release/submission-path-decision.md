# Production submission path: Workers Paid or a Free-plan redesign

Decision W-P in `production-release-plan.md` §3. Prepared on 2026-10-20 at
master `527444b`, which includes PR #84 (production genesis). Nothing was
purchased, enabled, provisioned or deployed.

## 1. The problem in one paragraph

A reviewed season batch is published by one authenticated
`POST /internal/admin/season/ingest`. That request:

- re-verifies the whole batch;
- regenerates the documents;
- runs the D14/D15 guard;
- prepares, writes and finalizes the release through the sequencer.

On staging, which runs on Workers Free, it used **362 ms of CPU on 2026-10-19**
(269 ms on 2026-10-14). The Free limit is **10 ms per request**, with only
undocumented "flexibility" for occasional overruns (error 1102 otherwise). The
request succeeded twice, but nothing guarantees that it will keep succeeding.
The genesis request costs about 0.1–0.4 ms locally and fits Free. Only
submissions need a decision.

## 2. Summary

| | **A. Workers Paid, existing guarded ingest** | **B. Free plan, operator-driven two-phase redesign** |
|---|---|---|
| Code change | None. Production configuration only (W1) | New ADR 0025 decision, new admin routes, an offline publisher CLI, tests |
| CPU per Worker request | 362 ms measured, against a 30 s default limit (configurable to 5 min): about 80× headroom | Expected to be small, but **not measured**. The sequencer `prepare` call itself has used up to 18 ms on staging (see §4.6) |
| Validation | Unchanged: the Worker re-verifies every batch | Moves to the operator's machine (same code). The Worker checks shape and the binding only, unless chunked server-side verification is added (§4.1) |
| Visibility, concurrency, retries, recovery | Unchanged and tested (PR #73, PR #84; two staging submissions) | Reuse the same sequencer mechanisms. **Untested** in this flow (§4) |
| Reliability claim | Yes, within Cloudflare's documented Paid limits | **None yet.** Only after the tests in §4.7 pass |
| Time to production | W1 plus a plan change | A design PR, an implementation PR and a staging measurement before W1 |
| Monthly cost | **USD 5.00 before tax** at the assumed usage (§3) | USD 0 |
| Main risk | Recurring cost; the plan is account-wide | Unproven CPU budget (including the Durable Object side); a new trust and failure surface around direct KV writes |

**Recommendation.** **A** is the lower-risk path: it needs no new code, and
its only cost is the monthly fee. **B** is feasible but cannot be called
reliable until §4.7 passes. Choose **B** only if a recurring USD 5 is ruled
out, and accept that W1 and D3 wait for it.

## 3. Path A: Workers Paid

**What changes.** The Cloudflare account moves to Workers Paid. Nothing in the
repository changes beyond W1's production configuration. The guarded ingest
runs exactly as tested.

**Prices** (Cloudflare, *Workers pricing*, last updated 2026-10-02):

- **Base:** USD 5 per month minimum for the account.
- **Workers:** 10 M requests and 30 M CPU-ms included each month. Above
  that, USD 0.30 per million requests and USD 0.02 per million CPU-ms.
- **KV:** included each month: 10 M reads, 1 M writes, 1 M deletes, 1 M
  lists and 1 GB stored.
- **Durable Objects:** included each month: 1 M requests (then USD 0.15 per
  million), 400,000 GB-s, 25 billion SQLite rows read, 50 M rows written and
  5 GB-month stored.

**Usage assumptions** (one month, production only):

| Driver | Assumption | Monthly use | Included |
|---|---|---|---|
| Submissions | Up to 8 (two per race weekend, plus corrections) | about 3 s CPU, about 970 KV writes, about 1,100 KV reads | 30 M CPU-ms; 1 M writes; 10 M reads |
| Genesis | Once, ever | negligible | — |
| Public reads | 1,000 active devices × 30 uncached API requests a day (generous: the listing shows "100+ downloads") | 0.9 M Worker requests; 0.9 M DO lookups (`readAuthority`); 1.8 M KV reads | 10 M; 1 M; 10 M |
| DO duration | 0.9 M short lookups (each well under 50 ms at 128 MB) | under 6,000 GB-s | 400,000 |
| Storage | One season's releases, under 50 MB | well under 1 GB | 1 GB |

**Expected cost: USD 5.00 per month before tax.** Spanish VAT at 21% would
make it about USD 6.05, if Cloudflare charges VAT on this account.

The first threshold the assumptions approach is the **1 M included Durable
Object requests**. That is about 1,100 active devices at 30 requests a day.
Each further million costs USD 0.15. Every other line stays more than ten times
below its included amount.

**Side effects to accept:**

- The plan is a property of the account, so **staging also runs under
  Paid**. Staging behaviour stays the same, minus the Free CPU risk.
- The Free daily request caps (100,000 Worker requests and 100,000 DO
  requests a day) no longer limit public traffic.
- Billing needs a payment method on the Cloudflare account.

**Not done:** nothing was purchased or enabled.

## 4. Path B: Free-plan redesign (operator-driven two-phase publication)

The heavy work moves to the operator's machine, which runs the repository's
own code. The Worker keeps every authority decision in the sequencer.

```text
offline   verify batch (verifySeasonBatch) -> generate (generateSnapshotSet)
          -> read the active release from KV -> D14/D15 guard, publication
          instant, contract validation, revisions, manifest commitment
Worker    POST prepare  {season, perKeyRevisions, sourceOrderingInput,
                         expectedManifestCommitment, expectedPredecessor}
          -> sequencer prepare (CAS, single-flight, epoch, timestamps)
          <- {epoch, token, candidateVersion, assignedTimestamps}
offline   bake the assigned timestamps -> wrangler kv bulk put (documents,
          then __inventory, then __publication_metadata) -> read back
Worker    POST finalize {season, epoch, token, manifestCommitment}
Worker    POST metadata (current season, content metadata), idempotent
```

The sections below show how each required property would be preserved, and
**what is still unproven**.

### 4.1 Validation

| Check | Today (one request) | Path B |
|---|---|---|
| Batch digest, curated content, attribution, deep source validation, regeneration equality | Worker | Operator's machine. It is the same `verifySeasonBatch`, which the submission builder already runs |
| D14/D15 guard against the active release | Worker reads the predecessor | Operator reads the predecessor's results documents from KV and derives the guard |
| Binding the guard to the committed release | Sequencer `prepare` (expected-predecessor CAS) | **Unchanged.** A stale or altered predecessor read is refused inside `prepare` |
| Contract validation of every document | Worker | Operator's machine |
| Written documents match the prepared revisions | Implied: the same process writes what it hashed | **Not proven by default.** As in D4 today, the attestation is trusted. Option B+: chunked `verify` requests that read K documents from KV and compare their revisions with the sequencer's prepared rows, before `finalize`. Its CPU per chunk is untested |

Trust moves from "the Worker re-checks everything" to "the operator's machine
checks, and the sequencer binds". The operator's Cloudflare credentials can
already deploy arbitrary code, so no new privilege is created. But a defect
in the offline tool is no longer caught by a second, independent run.

### 4.2 Release visibility

- Public reads resolve the active version **only from the sequencer**
  (`src/public/router.ts`, PR #84). The router never lists or guesses
  versions.
- Candidate keys live under a version that `prepare` allocated to one epoch,
  so a partial or complete bulk write is **invisible until `finalize`
  commits**. This is the same property today's candidate write relies on.
- **Order.** The documents go first, the inventory after them, and the sidecar
  last, as `SequencedPublicationService.writeCandidate` does.
- **Read-back gate.** The CLI calls `finalize` only after reading back every
  key it wrote: 117 reads, about 0.1% of the Free daily read budget.
- **Unproven:** KV's eventual visibility between the bulk API and the
  Worker's reads after `finalize`. D6's bounded fallback to the previous
  version covers a lagging document today, and the same applies here. The
  first release of a genesis season has **no previous version**, so a
  lagging document there answers 503 until it propagates.

### 4.3 Concurrency control

The protections are unchanged, because they live in the sequencer:

- **Single flight:** a second `prepare` is `operation-in-progress`.
- **Epoch and token fencing:** only the holder finalizes.
- **Predecessor CAS** at `prepare`, with the invariant re-asserted at
  `finalize`.
- **Version ownership:** a candidate version belongs to one epoch forever.

A second operator, or a stale CLI, cannot commit over a newer release.

### 4.4 Retries

| Lost answer or failure | Behaviour |
|---|---|
| `prepare` answer lost | The CLI must **not** prepare again. The live operation blocks a new `prepare` until its 15-minute TTL expires. The next `prepare` then retires it into the pending-cleanup slot (D5), and the CLI drains it. |
| Bulk put fails part-way | Re-run the same bulk put. The keys are immutable and owned by this epoch, so re-writing identical values is idempotent. The KV limit of one write per second applies per key, and these are distinct keys. |
| `finalize` answer lost | Re-drive `finalize` once with the same epoch and token, which is idempotent and replays `committed`. Then read the authority once. This is the D4 rule today (Amendment 2026-09-27), moved into the CLI. |
| Metadata write lost | Re-send it. It is idempotent: the same current season and the same content metadata. |
| Retry after a commit | `prepare` against the old predecessor is `stale-predecessor`. No duplicate release is possible. |

### 4.5 Recovery after partial writes

- **Before `finalize`, nothing is visible.** Either path cleans up:
  - **Cancel** (holding the token), then **authorize cleanup**, then
    `wrangler kv bulk delete` of the candidate's keys, then **acknowledge**.
  - **Abandon:** the TTL expires, the next `prepare` moves the orphan into
    the single pending-cleanup slot, and the CLI drains it the same way.

  Both are the existing D5 protocol. Path B needs admin routes for cancel,
  authorize and acknowledge, because today only the Worker drives them.
- **After `finalize`, before metadata:** the release is committed and served.
  Only the current-season pointer may lag, and re-sending the metadata
  request fixes it. That is better than the single request, where a CPU kill
  at this point leaves the pointer missing until the next release.

### 4.6 CPU budget (untested)

Each Worker request does the following:

- **`prepare`:** parses about 15–20 KB of JSON (about 117 revisions),
  validates the shape and makes one sequencer call.
- **`finalize`:** one call.
- **Cleanup:** one call each.
- **Metadata:** two KV writes.

These are expected to be a few milliseconds each. They have **not been
measured**.

The **Durable Object side is the open risk.** On staging (Free), sequencer
calls have used **up to 18 ms of CPU** with no termination. The Cloudflare
pages read on 2026-10-20 do not say whether Free Durable Objects get the
30-second default or the Workers 10 ms. `prepare` writes 117 per-key rows in
one transaction, and that cost is unmeasured too.

### 4.7 What must pass before B may be called reliable

1. **Staging measurements** (Free): `wrangler tail` CPU for `prepare`,
   `finalize`, cleanup and metadata, both the Worker and the Durable Object
   side. Every value must be under 10 ms across at least five runs, with no
   `exceededCpu` outcome.
2. **Tests**, in-process as PR #84's are:
   - a bulk write failing part-way, then retried;
   - a lost `prepare` answer, then the TTL expiry and pending-cleanup drain;
   - a lost `finalize` answer, then one re-drive and one read;
   - concurrent CLIs;
   - a stale predecessor read;
   - a commit followed by a metadata failure, then a re-send;
   - cancel and cleanup of a partial candidate.
3. **Read-after-write check** from the CLI against real KV, with the
   visibility delay recorded.
4. If option B+ is chosen: chunked server-side verification under 10 ms per
   chunk.
5. **Free budgets:**
   - about 121 KV writes per release, against 1,000 a day;
   - a cleanup that deletes up to about 120 keys;
   - public traffic, which on Free is capped at 100,000 Worker requests and
     100,000 DO requests a day (the Paid assumptions in §3 would approach the
     DO cap at about 3,300 active devices).

**Estimated work:** an ADR 0025 decision, then one implementation PR (admin
routes, CLI, tests) of a size similar to PR #84, then a staging measurement
window. Until all of it lands, D3 cannot run on Path B.

## 5. Owner decision

- **A:** approve Workers Paid. W1 then proceeds with the existing ingest. The
  purchase is a separate owner step, not done here.
- **B:** approve the redesign. W1 and D3 then wait for its PR and §4.7.
- **Neither:** accept the single request on Free, knowing it may fail with
  error 1102 (`production-release-plan.md` §3 W-P). This is not recommended.

## Sources

- Cloudflare, *Workers pricing* (last updated 2026-10-02):
  https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare, *Workers limits* (last updated 2026-10-12):
  https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare, *KV limits* (2026-10-08) and *Durable Objects limits*
  (2026-06-01) and *pricing* (2026-10-18).
- Staging CPU: the 2026-10-14 and 2026-10-19 submission records (operator
  evidence, outside the repository).
- Local measurements: ADR 0025 D12, "Amendment (2026-10-20)", Free-plan cost.
