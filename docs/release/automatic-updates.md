# Automatic updates: operating design, release gates and activation

Prepared 2026-10-21 on `feat/automatic-updates` (stacked on PR #85). The
decision record is [ADR 0028](../adr/0028-automatic-end-to-end-season-updates.md).

**Nothing in this document is authorized by the change that adds it.** No
environment selects `coordinated`, binds the reconciliation ledger or has a
schedule. No provider was contacted, nothing was deployed, and no Cloudflare
plan, trigger, Play Console or AdMob setting was changed. Every step marked
**[approval]** below is a separate owner authorization, given in order.

**Requirement (owner, 2026-10-21).** A newly available race result must reach
the app without a manual capture or submission. PR #85's
`PROVIDER_MODE = "none"` and empty cron are an interim bootstrap state. A Play
release proceeds only through gates AU-3 and AU-7.

**Scope (owner, 2026-10-21; ADR 0028 D12).** The first Google Play release
shows the full weekend schedule but publishes and displays **race results
only**. Free practice, qualifying, sprint qualifying and sprint results are a
future product update; this path neither requests nor publishes them.

## 1. The path

```text
Cron 17 * * * *  ->  planner (what is due, from the ledger)
                 ->  Jolpica, via the routing port, hardened client, global limiter
                 ->  decode, curated mapping, deep validation, settling state machine
                 ->  publishability, no-change gate, intent gate
                 ->  D14-D16 guard, sequencer prepare (CAS) and finalize
                 ->  public API (calendar-horizon staleAfter)
                 ->  app: launch or resume revalidates what has expired
```

What activation adds to an environment is configuration only:
`PROVIDER_MODE = "coordinated"`, the `ReconciliationLedger` class and its
`RECONCILIATION_LEDGER` binding, and the cron. Each is committed in the same
PR as its deploy authorization (ADR 0028 D2).

## 2. When it runs, and when a result appears

The race-result polling plan (ADR 0028 D5):

1. **Start of polling:** the first hourly tick at or after the scheduled race
   start + 90 minutes. It is the start of polling, not evidence that the race
   has finished.
2. **Initial window:** while no valid, complete result has been accepted (or
   while a differing revision is pending), every hourly tick through race
   start + 10 h 30 min: ten checks.
3. **Back-off:** + 15 h, + 24 h, then daily to day 14. A round still without a
   result is then abandoned and flagged.
4. **Accepted result:** confirmed only at + 5 h 30 min and + 9 h 30 min, then
   the back-off. It settles at + 24 h at the earliest (three confirmations).
5. **First result seen twice (AU-D5, accepted by the owner for 2.0.0 on
   2026-10-21, with its limitation; §9):** inside
   the window, the check that first finds a result holds it pending, and the
   next successful check (normally the next hourly tick) publishes it only if
   it returns the same result. From the window's last check on, a first result is published at
   once. Settling is unchanged: the pair counts as one confirmation.

| Resource | Checked |
|---|---|
| Race classification, no accepted result | first tick at or after race start + 1 h 30 min; hourly through + 10 h 30 min; + 15 h, + 24 h; daily to day 14 |
| Race classification, accepted result | + 5 h 30 min, + 9 h 30 min, + 15 h, + 24 h; daily while unsettled; settled on deadline at + 14 days |
| Calendar | every 6 h |
| Standings (both) | daily in season, weekly off season, and in every publication run |
| Participants, circuits | weekly |
| Every classified round | in every publication run, so at least weekly |

**Example: the 2026 United States Grand Prix (round 18).** It starts
2026-10-25T20:00Z, so polling starts at 21:30Z and the first check is the
**22:17Z** tick. If the race is delayed or Jolpica has not published yet, the
23:17Z tick and every hourly tick to **07:17Z** on 2026-10-26 ask again (ten
checks), then **11:17Z** and **20:17Z**, then daily. A result first served by
22:17Z is published at **23:17Z**, when the next tick sees it again; one first
served by the 07:17Z tick is published at once. The app shows the result at
its next launch or resume, because everything it holds expired at the race
start.

Targets, not guarantees, because Jolpica guarantees neither timing nor uptime:

- published one hourly tick after the first tick at which Jolpica serves a
  complete result, when that is within the window, and at once at its last
  check (by race start + 11 h 17 min for a race at minute 00);
- reconciled data within 24 h (ADR 0020 I5);
- the monitor alerts at race start + 12 h if no result was published, after
  the window's last check.

**Valid and complete.** An empty answer, a page with fewer rows than its
`total`, missing positions, no winner, an unknown status or an unmapped
identity is never accepted: the check fails, the last release keeps serving,
and the next hourly tick asks again. A short classification whose page is
self-consistent cannot be detected (curator decision C-1), and the API serves
an accepted result as `final`. Seeing a first result twice (item 5) keeps a
short page that Jolpica completes within the hour from ever being published.
It does not prove completeness: a short page served unchanged for an hour is
still published, then replaced through corroboration once the complete one
appears (§3, AU-D5).

## 3. Corrections

| Case | What happens | Measured in the gate |
|---|---|---|
| Changed before the result settles | Pending at one sighting; published when the next cadence check returns it again. Inside the window that is the next hourly tick | Corrected 8 h after the start: sighted at + 10 h 17 min, published at + 11 h 17 min |
| A short but self-consistent result, completed within the hour | Never published: the complete one replaces the pending short one, and is published when seen again | Short at + 2 h, complete from + 3 h: only the complete one is published, at + 4 h 17 min |
| A short but self-consistent result, served unchanged for an hour | Published as `final`; the complete one is sighted at the next confirmation, pending, then published an hour later | Short at + 2 h, complete from + 4 h: short published at + 3 h 17 min, replaced at + 7 h 17 min |
| Changed again | The pending revision is replaced; three replacements in a row raise `unstable-source` | — |
| A revision seen before | Rejected for good (D2.2) | — |
| Changed after settlement | Sighted, then staged; the **whole season is withheld** (O-5(a)) until an operator verifies (E3) and disposes (T12) | Staged; round 2's new result withheld; heartbeat stops |

The operator path for a staged correction is in the staging runbook, section
6, "Reconciliation operator routes" and "Operator verification".

## 4. Budgets on Workers Paid

| Budget | Limit | GridView's use |
|---|---|---|
| Jolpica burst | 4 requests/s | Pacer at least 260 ms apart (≤ 3.85/s); the global limiter enforces 4/s for all callers |
| Jolpica sustained | 500 requests/h | At most 6 + classified rounds per run, so ≤ 29 an hour. A missing result adds up to ten hourly runs per race, still one an hour; seeing a first result twice adds one run per race. The gate measured ≤ 9 per run and < 200 a day across two race weekends with one result that never appeared (asked 12 times in its first 30 h) |
| Cron CPU | 15 min for an hourly trigger | A publication run does the generation, validation and guard the ingest measured at 362 ms on staging, plus ≤ 29 response parses; a nothing-due tick takes milliseconds. Measured at AU-4 before relying on it |
| Cron wall time | 15 min | Coordination aborts at 240 s; publication starts only within 300 s and with 300 s of the 10-minute lease left |
| Subrequests | 10,000 per invocation | A season-end publication: about 300 KV operations, 260 cache deletes and 40 Durable Object calls, plus ≤ 29 fetches |
| KV writes | 1 M a month included | About 121 a publication, ≤ 6 publications a weekend; the heartbeat 24 a day |
| Workers Logs | 20 M events a month included; 7 days kept | A few lines a run, about 3,000 a month |
| Cost | USD 5/month base | Unchanged from `submission-path-decision.md` §3 |

## 5. Failure handling

**The last valid release keeps serving on every failure below.** Nothing is
visible until the sequencer's `finalize` commits.

| Failure | Effect | Retry |
|---|---|---|
| Result not yet published by Jolpica (empty race list), incomplete page, delayed start, long race | The check fails; the run is withheld | The next hourly tick through + 10 h 30 min, then + 15 h, + 24 h, daily to day 14 |
| Jolpica 5xx, timeout, 429, block | The check is counted as failed; the run is withheld; the heartbeat stops if no check succeeded, and idle ticks do not restart it until an observation succeeds | Next hourly run; a 429's `Retry-After` is honoured |
| Limiter deferral | Not a check; withheld | At the limiter's `retryAt` |
| Invalid payload, unmapped identity | Withheld; the mapping needs curation | Next check, after curation |
| D14/D15 guard refusal | Blocked; the heartbeat stops | Operator |
| Staged correction | The season is withheld; the heartbeat stops | Operator (E3, T12) |
| Run budget exhausted | Withheld before anything is reserved | Next hourly run |
| CPU or platform kill mid-publication | The `publishing` mark stays; the next run resolves it from the sidecar | Next hourly run; no duplicate (gate: lost commit answer) |
| Ledger unavailable | Nothing planned, nothing sent | Next hourly run |

**Duplicate prevention:**

- one fenced lease per season, so a concurrent run gets `run-in-progress`;
- the no-change gate compares the candidate digest with the serving release;
- the sequencer's single-flight `prepare`, predecessor CAS and epoch fencing;
- a strictly increasing ordering input.

A release that only re-stamps freshness is never minted. A legitimate content
change, such as Home's featured event moving on at a race start, is.

## 6. Alerts (ADR 0028 D9)

`services/edge-api/scripts/monitor/automation-monitor.mjs` sends three public
GETs, with no credential, and fails on any of these:

| Finding | When |
|---|---|
| `heartbeat-stale` / `heartbeat-missing` | `/v1/status.lastSuccessfulSyncAt` older than 3 h, or absent |
| `results-late` | The earliest event neither cancelled nor classified started more than 12 h ago |
| `status-unavailable`, `calendar-unavailable`, `event-unavailable` | The resource could not be read after one retry |

```text
node scripts/monitor/automation-monitor.mjs --base-url https://gridview-api-staging.sejuma18.workers.dev --skip-heartbeat
```

(`--skip-heartbeat` only before the environment is automatic.)

`.github/workflows/automation-monitor.yml` runs it, **manual-only**. A failed
run e-mails the owner through GitHub's own notifications. Known limits:

- GitHub can delay scheduled runs;
- GitHub disables scheduled workflows in a public repository after 60 days
  without repository activity. Check the workflow is enabled whenever the
  monthly Cloudflare invoice arrives.

**Diagnosis**, not delivery, uses the persisted Workers Logs (7 days):

- `sync.coordinated.observation` (one line a run);
- `sync.coordinated.heartbeat` (a failed heartbeat write);
- `reconciliation.attention`;
- `publication.*`.

## 7. Release gates

| Gate | Action | Authorization | Depends on |
|---|---|---|---|
| AU-0 | This change merged, dormant: genesis-capable coordinated runs, calendar horizon, the + 90 min / hourly / back-off polling plan, heartbeat, production logging design, monitor, controlled source, gate tests | **[PR]** | PR #85 |
| AU-1 | Workers Paid bought (the plan is account-wide, so staging gets it too) | **[approval]** owner | — |
| AU-2 | The isolated demonstration Worker `gridview-api-e2e`: create its KV namespace, commit `[env.e2e]` (§8.1) with the real id, deploy it, run its genesis | **[approval]** each, **[PR]** | AU-0, AU-1 |
| AU-3 | **The end-to-end demonstration with controlled data** (§8.2). Also on the release commit: the in-process gate in CI and the app half locally | **[approval]** the KV load and the schedule; **[record]** the evidence | AU-2 |
| AU-4 | Live staging becomes automatic (§8.3): ledger class and binding plus `coordinated`, then the first provider requests, then the hourly schedule. CPU measured on the first runs (RB-7 check 2) | **[approval]** each of the three; cutover-sensitive | AU-3 |
| AU-5 | The monitor's hourly `schedule:` for staging | **[approval]**, **[PR]** | AU-4, AU-6 |
| AU-6 | Alert drill: run the workflow with `simulate_failure`; the owner confirms the e-mail arrived (closes OD-1) | **[approval]**, **[record]** | AU-0 |
| AU-7 | Production automatic (§8.4): W2/W3 with the production delta, genesis, the first automatic release, persisted logs verified free of app traffic, the monitor scheduled for production | **[approval]** each | AU-4 soak (one race weekend published automatically), AU-6, D-A (§9) |
| AU-8 | Release-candidate check: on the exact commit A2 builds, `gate.test.ts` and the app half pass, and staging and production heartbeats are fresh | **[record]** | AU-7, before R5 |

In `production-release-plan.md`: A0 (the release-candidate gate) requires
AU-3, and R5 (the 20 % rollout) requires AU-7 and AU-8.

## 8. Procedures

Every command runs from `services/edge-api`. In Windows PowerShell write
`npm.cmd`. Each numbered step is its own authorization. Before relying on
staging facts, re-read live staging read-only (staging runbook §2, "Live
staging state").

### 8.1 The demonstration Worker (AU-2)

1. Create its namespace: `npm exec -- wrangler kv namespace create
   GRIDVIEW_DATA --env e2e` (after the block below is committed without
   `kv_namespaces`, as W1 did for production). Record the id.
2. Commit the block, with that id, and flip the dormancy tests that pin
   `coordinated`, the ledger and the cron as absent. They stay pinned for
   staging and production.

   ```toml
   [env.e2e]
   name = "gridview-api-e2e"
   workers_dev = true
   preview_urls = false

   [env.e2e.vars]
   ENVIRONMENT = "staging"
   PROVIDER_MODE = "coordinated"
   CONTROLLED_PROVIDER_SOURCE = "kv"
   PUBLIC_BASE_URL = "https://gridview-api-e2e.sejuma18.workers.dev"
   SEASON_PUBLICATION_AUTHORITY = "sequencer"
   SEASON_PUBLICATION_CUTOVER_CONTROL = "genesis:2026"

   # A named environment's exports table replaces the top-level one.
   [env.e2e.exports.ProviderRateLimiter]
   type = "durable-object"
   storage = "sqlite"
   [env.e2e.exports.SeasonPublicationSequencer]
   type = "durable-object"
   storage = "sqlite"
   [env.e2e.exports.ReconciliationLedger]
   type = "durable-object"
   storage = "sqlite"

   [[env.e2e.durable_objects.bindings]]
   name = "PROVIDER_RATE_LIMITER"
   class_name = "ProviderRateLimiter"
   [[env.e2e.durable_objects.bindings]]
   name = "SEASON_PUBLICATION_SEQUENCER"
   class_name = "SeasonPublicationSequencer"
   [[env.e2e.durable_objects.bindings]]
   name = "RECONCILIATION_LEDGER"
   class_name = "ReconciliationLedger"

   [[env.e2e.kv_namespaces]]
   binding = "GRIDVIEW_DATA"
   id = "<the id from step 1>"

   [env.e2e.secrets]
   required = ["ADMIN_TOKEN"]

   # Empty at deploy; the schedule is AU-3's own step.
   [env.e2e.triggers]
   crons = []

   [env.e2e.observability]
   enabled = true
   head_sampling_rate = 1
   [env.e2e.observability.logs]
   enabled = true
   persist = true
   invocation_logs = false
   ```

   `test/e2e/automatic-updates/stage.ts` pins the same values as
   `DEMONSTRATION_DELTA`; the PR adds a config test that the committed block
   resolves to them.
3. Deploy with a fresh secret: `npm exec -- wrangler deploy --env e2e
   --secrets-file <temporary file outside the repository>`. Delete the file
   immediately. Expect three Durable Object namespaces for `gridview-api-e2e`.
   Staging's two are untouched, and staging's rollback history is unaffected.
4. Genesis: one authenticated `POST
   /internal/admin/publication/cutover/genesis` with `{"season": 2026,
   "genesisIdentity": "gridview-e2e-2026-genesis-01", "confirmGenesis":
   true}`. Then `GET /internal/admin/publication/cutover/status?season=2026`
   must show `genesis`, and `/v1/seasons/2026` must answer `503`.

### 8.2 The demonstration (AU-3)

1. Choose a race instant `T` at minute 00, at least 4 h ahead and early
   enough that the shifted season stays in 2026; the export refuses
   otherwise. Generate the source outside the repository:

   ```text
   GRIDVIEW_CONTROLLED_SOURCE_OUT=<file> GRIDVIEW_CONTROLLED_RACE_START=<T>
   npx vitest run test/e2e/automatic-updates/controlled-source-export.test.ts
   ```

   This produces 29 documents, about 125 KB: rounds 1–21 classified,
   round 22 racing at `T` with its result from `T` + 2 h, and a correction
   from `T` + 8 h.
2. **[approval]** Load it: `npm exec -- wrangler kv bulk put <file> --binding
   GRIDVIEW_DATA --env e2e --remote`. This is the only operator action on the
   data, and it stands for Jolpica publishing. Nothing is sent to GridView's
   admin routes.
3. **[approval]** Schedule it: commit `crons = ["17 * * * *"]` for `env.e2e`
   and run `npm exec -- wrangler triggers deploy --env e2e`, at least 3 h
   before `T`.
4. Install the staging app built for `https://gridview-api-e2e.sejuma18.workers.dev`
   (a phone step of its own) and open it once before `T`.
5. Watch, read-only. Pass criteria:

   | Instant | Expect |
   |---|---|
   | First tick | Bootstrap (one KV read for the calendar); no release |
   | Second tick | First release, previous version `null`, rounds 1–21 served |
   | `T` + 0:17, + 1:17 | A release only if a run is due; Home moves on to round 23; round 22 not asked for yet |
   | `T` + 2:17 | First check of round 22 (the first tick at or after `T` + 1:30): its result sighted, pending; no release |
   | `T` + 3:17 | Seen again: its result published |
   | App, next launch | Shows the round 22 result |
   | `T` + 6:17 | Confirmation; no release |
   | `T` + 10:17 | The correction sighted, pending; no release |
   | `T` + 11:17 | The correction published; the app converges at its next launch |
   | Throughout | `lastSuccessfulSyncAt` advances hourly; the monitor passes; no admin request appears in the logs after genesis |

   Then remove the schedule (`crons = []`, `triggers deploy`).

### 8.3 Live staging (AU-4)

1. **[approval]** Deploy `[env.staging]` with `PROVIDER_MODE =
   "coordinated"`, the staging exports table restating both existing classes
   plus `ReconciliationLedger`, the `RECONCILIATION_LEDGER` binding, and still
   `crons = []`.
   - **Irreversible for rollback:** creating the ledger class blocks `wrangler
     rollback` to every earlier version, permanently (decision pack
     2026-10-07).
   - Expect a third Durable Object namespace. The ingest then refuses
     (`coordinated`).
2. **[approval]** The first live provider requests: one authenticated manual
   `POST /internal/admin/sync/full?season=2026` (bootstrap calendar: one
   request), then one more (a forced publication run: 6 + 17 requests today).
   - Measure CPU with `wrangler tail --format json`.
   - Compare the release with `pm1-…1d` document by document. Expect only
     freshness and anything Jolpica changed since 2026-10-19; treat any other
     difference as a stop and review it before step 3.
   - Check the Wrangler 4.112 `kv bulk put` and `tail` flags with `--help`
     first.
   - Manual runs corroborate nothing (O-8).
3. **[approval]** The hourly schedule: `crons = ["17 * * * *"]`, `triggers
   deploy`. Soak through one race weekend; the R18 example in §2 is the first
   chance.

**Stop:** set `crons = []` and run `triggers deploy`. Nothing publishes. **Fall
back to manual batches:** deploy `PROVIDER_MODE = "none"` with the ledger
binding kept; the ingest is admitted again. The calendar-horizon policy is
shared, so releases re-stamp consistently.

### 8.4 Production (AU-7)

PR #85's configuration is the interim state. At W2/W3, the production PR
commits:

- the KV id;
- `PROVIDER_MODE = "coordinated"`;
- the production exports table with the three classes, and the
  `RECONCILIATION_LEDGER` binding;
- `crons = []`.

Then:

1. **W3, deploy [approval]:** with `--secrets-file`. Then read the Workers Logs
   for two public GETs, which must leave **no** event.
2. **D2, genesis [approval].**
3. **[approval] Schedule:** `crons = ["17 * * * *"]`, `triggers deploy`. The
   first two ticks bootstrap and publish the first release, from genesis, with
   no capture or submission.
4. **[approval] Monitor:** schedule it for production (AU-5 for production).

## 9. Owner decisions

On 2026-10-21 the owner explicitly accepted **AU-D1** and **AU-D5** for
version 2.0.0, including their documented limitations (ADR 0028 D13).
AU-D2, AU-D3 and AU-D4 remain open. Accepting a decision authorises no merge,
purchase, provisioning, deployment or activation; those stay the separately
authorised steps of §7 and §8.

| # | Decision | Status / recommendation |
|---|---|---|
| AU-D1 | O-5(a): a staged correction withholds the whole season until an operator acts | **Accepted by the owner for 2.0.0 on 2026-10-21, with its limitation:** keep O-5(a), with the 3 h heartbeat alert; a staged correction holds every later change, a new race result included, until an operator disposes of it. O-5(b) (per-round carry-over) is a later design change |
| AU-D2 | D-A, archive the 1.x AdMob units, before Jolpica data is published automatically in production (ADR 0028 D11) | Yes, before AU-7 |
| AU-D3 | Privacy wording for production Worker logs (PR #82, still open; D-L engineering resolved by ADR 0028 D8) | Say that Worker logs store no app-user data and are kept 7 days |
| AU-D4 | The alert channel: GitHub e-mail (committed) or an additional Cloudflare custom alert (beta, webhook) | GitHub e-mail first; revisit when the beta ends |
| AU-D5 | A short but self-consistent race classification cannot be told from a complete one (curator decision C-1), and the API serves it as `final`. Options: keep publishing a first result at once (documented limitation); publish it as `provisional` and confirm it later (a contract change: the revision hashes `status`, and `provisional` means the provisional source); or see it twice before the first publication | **Accepted by the owner for 2.0.0 on 2026-10-21, with the limitation below** (implemented on PR #86): see a first result twice inside the window (§2 item 5, ADR 0028 D5 item 5). One hour of latency, no contract, API or app change. **Limitation:** Two matching observations reduce the risk of publishing a transient short classification; they do not prove that a classification is complete, and a short result Jolpica serves unchanged for an hour or more may still appear as "Final" until it is corrected (§3). A field-size completeness rule stays out: it can wrongly withhold a legitimately smaller field |
