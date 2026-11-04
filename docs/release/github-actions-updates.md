# Automatic updates from GitHub Actions (staging)

**Status: prepared, not active.** Nothing in this document has been deployed, provisioned, scheduled or dispatched. Each step in §8 needs its own owner approval.

## 1. Why

From the staging Worker, Jolpica F1 answered `429` after one or two requests, at 4/s (2026-11-03) and at 1/s (2026-11-04) (`automatic-updates.md` §8.3.1).

- **Hypothesis, not confirmed:** Cloudflare documents that cross-zone Worker subrequests reach other Cloudflare zones with one shared `CF-Connecting-IP`.
- **Measured:** a GitHub-hosted runner completed one full capture (25 GETs, 2 s apart) without a `429` (2026-11-04, run 41918729849). That is one sample, not a guarantee.

This path moves the provider requests to a scheduled GitHub Actions job. Publication stays inside the Worker, through the existing guarded season-batch ingest.

## 2. The path

```text
GitHub Actions (manual now; hourly later)        staging Worker (PROVIDER_MODE = "none")
  plan from state (reconcile.ts)
  probe due rounds: 1 GET each        -> Jolpica F1
  or capture the season: 6 + rounds   -> Jolpica F1
  generate the batch (in process, the repository's generator)
  apply the coordinated state machine
  gate
  GET cutover status ----------------------------> scoped token
  POST season ingest ----------------------------> verify, D14-D16 guard, prepare CAS, publish
                                                    public API -> app: launch or resume
```

What changes, and where:

| Piece | Where | State |
|---|---|---|
| Scoped credential `SEASON_INGEST_TOKEN` | `src/admin/auth.ts` | It opens only the cutover-status read and the ingest, staging only. Committed; not created |
| Staging `PROVIDER_MODE = "none"` | `wrangler.toml` | The ingest refuses under `coordinated` (one provider budget). The ledger class and binding are kept, so returning to the Worker path changes only the mode. Committed; **not deployed** (live staging still runs `coordinated`) |
| The job | `services/edge-api/scripts/auto-update/` | `capture.mjs`, `reconcile.ts`, `orchestrate.ts`, `submit.mjs`, `run.mjs` |
| The workflow | `.github/workflows/season-auto-update-staging.yml` | Manual dispatch with confirmation only. No schedule |
| Public notice | `docs/api/gridview-api-v1.yaml`, `docs/api/README.md` | Amended to describe both automatic paths. **Needs owner approval** (§7) |

**How updates reach the app: unchanged.** The ingest publishes an ordinary sequenced release. The app revalidates what has expired at launch or resume (calendar-horizon `staleAfter`). No app change is needed: the in-app wording ("GridView's service can check this source automatically, on an hourly schedule…") stays true.

## 3. Result and correction policy: what is preserved

The job keeps the coordinated runtime's own per-round `ClassificationRecord`s in its state, and drives them with the runtime's own functions:
- `dueSlot` for when a round is checked;
- `applyClassificationCheck` for what an observation does;
- `classificationRevision` for the revision a published release carries.

Nothing in `automatic-updates.md` §2-§3 is re-implemented.

| Agreed behaviour (`automatic-updates.md` §2-§3) | On this path |
|---|---|
| Polling: first check at race start + 90 min; hourly to + 10 h 30; + 15 h, + 24 h; daily to day 14 | Same slots, **but from + 5 h** (see the first difference below) |
| First result seen twice inside the window (AU-D5); at once from the window's last check | Same (state machine). Scenario test: held at + 5 h 18, published at + 6 h 18 |
| Accepted result confirmed at + 5 h 30, + 9 h 30, + 15 h, + 24 h; settles at + 24 h at the earliest, on deadline at + 14 d | Same |
| Correction before settlement: pending at one sighting, published when the next check returns it | Same. Scenario test: sighted at + 9 h 36, published at + 10 h 36 |
| Changed again: pending replaced; the third replacement raises `unstable-source` | Same. The job logs `attention: unstable-source` |
| A revision seen before is rejected for good (D2.2) | Rejected the same way. **But** see the third difference below |
| Correction after settlement: sighted, then staged; whole season withheld until an operator verifies (E3) and disposes (T12) | Sighted (withheld), then staged; **the job stops** (`staged-correction`) and publishes nothing until a human acts |
| The last valid release keeps serving on every failure | Same: nothing is published unless the ingest's guarded publication commits |

### Differences and manual-review cases (not silently changed: each needs owner acceptance)

1. **Earliest publication is race start + 5 h (+ one hour for the second sighting), not + 1 h 30.**
   - Why: a batch must carry exactly the rounds whose race started at least 5 h before its capture (`isBatchCaptureEligible`, verified by the generator and the ingest; ADR 0028 D5 kept that rule for batches).
   - Before + 5 h nothing is recorded for the round, so no cadence slot is consumed.
   - Between a race start and + 5 h the job captures nothing at all: Jolpica may already serve that round's standings, and a batch without the round would be refused as incoherent.
   - The `results-late` alert (+ 12 h) still holds.
2. **A pending correction or first result withholds the whole batch.** The runtime publishes the other rounds' changes while one round's revision is pending; a batch is one capture and cannot keep the old revision for a single round. The delay is at most one cadence check (one hour inside the window).
3. **A superseded revision that Jolpica keeps serving stops the job** (`superseded-revision-served`). The runtime keeps publishing the accepted revision; a batch of the current capture cannot. **Manual review.**
4. **A staged correction stops the job** (`staged-correction`). The runtime withholds the season and waits for the operator routes (E3/T12) on its ledger. This job's records live in its own state, not the Worker's ledger, so the disposition is a manual edit of the state (§9). **Manual review.**
5. **An eligible round with no result blocks every batch.** For example, a cancelled race whose results never appear. The batch must carry every eligible round, so the generator refuses, and the job reports attention (exit 2) on each capture. The runtime path instead leaves such a round unclassified. **Manual review / curation.**
6. **A refused or ambiguous submission stops the job** (§5). The runtime retries a lost commit through its own recovery; the ingest has no sidecar for an outside caller.

## 4. Requests and limits

- **Probes:** a run probes each due round with one GET while that is cheaper (at most 5).
- **When a full capture runs:** only when a probe sees a body whose revision it has not computed, when an accepted revision is not yet published, or for the daily refresh. A full capture is six season-level GETs plus one per eligible round: 25 today, at most 30.
- **Pacing and stopping:** requests are 2 s apart. The first non-200 ends the run. Nothing is retried in a run.
- **After a `429`:** every run is held for at least 2 h, longer if `Retry-After` asks, at most 24 h.
- **Hourly budget:** the state counts requests in a rolling hour, and a run that could exceed 500 does not start.
- **Typical load:**
  - a race weekend: about 10 probes and 2-3 full captures (about 85 GETs);
  - a quiet day: one full capture (25).
- **Concurrency:** the workflow allows one run at a time and never cancels one. The ingest's `expectedActiveVersion` CAS refuses a submission prepared against a release that is no longer active.

## 5. Failure handling

| Failure | Job | Exit | Next |
|---|---|---|---|
| `429` | That check failed; the run ends; held 2-24 h | 0 | Next run after the hold |
| Other non-200, timeout, network | That check failed; the run ends | 0 | Next hourly run |
| Generator refuses (missing result, unmapped identity, incoherent standings) | Checks failed; nothing submitted | **2** (GitHub notifies) | Next run; curation if it persists |
| First result or correction pending | Withheld | 0 | Next cadence check |
| Unchanged content | Not submitted (the ingest would mint a release that only re-stamps freshness) | 0 | — |
| Staged correction, superseded revision served, accepted round missing | **Stopped** | **3** | Human (§9) |
| Cutover status unreadable, submission builder refuses | **Stopped** | **3** | Human |
| Ingest refused (4xx: stale CAS, verification, admission) | **Stopped**, nothing resent | **3** | Human |
| Ingest ambiguous (no answer, 5xx, unreadable) | **Stopped**; it may have committed; the CAS refuses the same body again | **3** | Human (§9) |
| State missing or undecodable | **Stopped**; never reset silently | **3** | Human: re-bootstrap |

## 6. Credentials, privacy, logs

**Credentials**
- **GitHub side:** the job holds one secret, `STAGING_SEASON_INGEST_TOKEN`, in the GitHub environment `staging-auto-update`, which is restricted to `master`.
- **Worker side:** the token is honoured only in staging, and only for `GET …/cutover/status` and `POST …/season/ingest`. `ADMIN_TOKEN` never leaves the owner's machine.
- **Hardening:**
  - the token is sent only to the allow-listed staging origin, only in `Authorization`, and never logged;
  - `contents: read`, `persist-credentials: false`, actions pinned to commit SHAs, `npm ci --ignore-scripts`.

**Public repository**
- Logs are public. They hold only closed JSON lines (plan, counts, revisions, digests, closed reasons, allow-listed refusal headers).
- No artifact is uploaded, and generated data is never written to disk.
- The Actions cache holds the job's state: per-round revision hashes, instants and holds. No secret and no provider body.

**Data and terms**
- No app-user data is involved.
- GitHub now processes an operator credential and the season data in transit. That belongs in the privacy and processor records review; no compliance claim is made here.
- Jolpica's terms (non-commercial, identified User-Agent, published limits): one identified client, far below the limits; a `429` holds rather than retries.

## 7. Owner decisions this needs

1. Accept the five differences in §3 (in particular the + 5 h earliest publication and the manual-review stops).
2. Approve the amended public notice (`gridview-api-v1.yaml`, "How Jolpica F1 data reaches GridView"). It now describes the Worker path and the scheduled-job path, and says that a Worker which requests Jolpica F1 itself refuses batches. The app string is unchanged.
3. Move staging off `coordinated` (a cutover-sensitive deploy). This makes PR #104 (the Worker's staging cron) inapplicable while this path is chosen.
4. Adapt the monitor (§10) before any schedule. PR #99 (AU-5) as drafted would alert permanently on this path.

## 8. Proposed live staging test (each step separately approved)

All steps run on staging only, after the PRs are reviewed and merged.

| Step | Action | Pass | Recovery if it fails |
|---|---|---|---|
| S0 | Owner: create the environment `staging-auto-update` (deployment branches: `master`) and the Worker secret `SEASON_INGEST_TOKEN` (`wrangler secret put --env staging`, ≥ 32 chars, ≠ `ADMIN_TOKEN`), then the same value as the environment secret `STAGING_SEASON_INGEST_TOKEN` | — | Delete the secret; nothing else uses it |
| S1 | Deploy staging from the merged commit (mode `none`, scoped token honoured), with the usual read-only preflight and post-checks (`staging runbook` §6) | Version live; schedules `[]`; ETags unchanged; the cutover-status GET with the scoped token answers 200; any other admin route with it answers 401 | Forward deploy of the previous commit's configuration (`coordinated`); the ledger class is kept, so no rollback block |
| S2 | ONE dispatch: `mode=bootstrap`, `submit=false` (dry run), ≥ 30 min after the last Jolpica contact | 25 × 200; batch generated; gate `publish` (rounds 18-19 new); no credentialed call | Nothing to undo: no state was saved on a stop, and a dry-run state is discarded by deleting the cache entry |
| S3 | Delete the dry-run cache entry, then ONE dispatch: `mode=bootstrap`, `submit=true` | `published`; `release-diff.mjs` vs `pm1-000000000001d-aed72435`: rounds 18-19 new, standings and Home change, rounds 1-17 instants only; public ETags change once; phone shows R18/R19 after resume | Refused: nothing published, stop, read the reason. Ambiguous: §9. Wrong content: the sequencer's guarded rollback to `…1d` (staging runbook §6), then stop the job |
| S4 | ONE dispatch `mode=scheduled` (`submit=true`) an hour later | `idle` or `unchanged`; no publication | — |
| S5 | Enable `cron: '23 * * * *'` for one race weekend, with the adapted monitor (§10) | Results published per §3; no `429`; no stop | Disable the workflow (`gh workflow disable`); the last release keeps serving |

## 9. Recovery for a stopped job

The job's state is in the Actions cache (`season-auto-update-staging-<run id>`). To act on it:
1. Download it with `gh cache list`.
2. Fix it locally.
3. Restore it, or delete the entries and re-bootstrap.

| Stop | Check | Then |
|---|---|---|
| `ingest-ambiguous` | Cutover status (`ADMIN_TOKEN`, owner's PC): did the active version change? | Changed: clear `stopped`; the next run republishes the same content once (one extra release, no data change). Not changed: clear `stopped` |
| `ingest-refused` | The logged reason (stale, verification, admission) | Stale: another publication happened; clear `stopped`. Verification or admission: fix the cause first |
| `staged-correction` | The round's new revision on Jolpica F1 against the published one | Accept: clear the round's `stagedCorrection` and set its `contentRevision` to the new revision (the operator disposition, done by hand), then clear `stopped`. Reject: keep the published revision, add the new one to `supersededRevisions`, then clear `stopped` |
| `superseded-revision-served` | Whether Jolpica F1 still serves the rejected revision | Wait until it does not, or accept it as above |
| `state-missing` / undecodable | — | Delete the cache entries and dispatch `mode=bootstrap` |

## 10. Monitoring

The existing monitor (`scripts/monitor/automation-monitor.mjs`, `automation-monitor.yml`) reads three public resources.

- **What still works on this path:**
  - `results-late` (no result 12 h after a race start), which the public calendar shows;
  - the resource availability findings.
- **What does not work:** `heartbeat-stale` / `heartbeat-missing`. The heartbeat is `/v1/status.lastSuccessfulSyncAt`, which only the Worker's own coordinated runs write. The ingest writes no sync state, so on this path the heartbeat would read as stale permanently.
- **Adaptation before any schedule:**
  1. run the monitor with `--skip-heartbeat`;
  2. rely on the job's own failure for stops and attention (exit 2 or 3 fails the run, and GitHub e-mails the owner);
  3. add a liveness check for the job itself, because a scheduled workflow that GitHub delays, drops or disables (after 60 days of repository inactivity) fails nothing. The minimal check is a monitor finding `auto-update-stale` that reads the public Actions runs API for `season-auto-update-staging.yml` and fails when no run completed in the last 3 h.

  Item 3 is not implemented here. It belongs with the schedule step (S5), in place of PR #99's heartbeat activation.
