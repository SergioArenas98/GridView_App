# Automatic updates: operating design, release gates and activation

Prepared 2026-10-21 on `feat/automatic-updates` (stacked on PR #85). The
decision record is [ADR 0028](../adr/0028-automatic-end-to-end-season-updates.md).

**Nothing in this document is authorized by the change that adds it.** When
it was written no environment selected `coordinated`, bound the
reconciliation ledger or had a schedule. Since then the demonstration Worker
(AU-2, AU-3) and, committed but not deployed, staging (AU-4 step 1, §8.3)
select `coordinated` and bind the ledger; no environment has a schedule.
Every step marked **[approval]** below is a separate owner authorization,
given in order.

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
| Workers Logs | 7 days kept. The included allowance (20 M events a month, then USD 0.60 a million) applies only until 2026-12-01; from then on Workers Logs uses Cloudflare Observability pricing, so assume no included allowance and re-read the price before AU-7 | A few lines a run, about 3,000 a month |
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
run e-mails the owner through GitHub's own notifications; the AU-6 drill
verified that delivery on 2026-10-22 (§7). Known limits:

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
| AU-1 | Workers Paid bought (the plan is account-wide, so staging gets it too). **Done 2026-10-21:** read-only, the dashboard shows Workers Paid active, renewing 2026-11-21, on account `786e24f1…e6bf`, the account Wrangler uses; one invoice that day, USD 5.00, paid (the invoice itself, and so any VAT line, was not opened) | **[approval]** owner | — |
| AU-2 | The isolated demonstration Worker `gridview-api-e2e`: create its KV namespace, commit `[env.e2e]` (§8.1) with the real id, deploy it, run its genesis. **Done 2026-10-21:** all four steps (§8.1) | **[approval]** each, **[PR]** | AU-0, AU-1 |
| AU-3 | **The end-to-end demonstration with controlled data** (§8.2): asynchronous, in persistent phases, passed on its acceptance criteria A1–A6. Also on the release commit: the in-process gate in CI and the app half locally. **Passed 2026-11-03:** one bounded asynchronous run from `F` = 2026-11-02 20:17Z published the result at the 22:17Z run and its correction at the 00:17Z run with nobody acting on GridView, and the installed app showed both; A1–A6 evidenced, the operator's record accepted by the owner (§8.2, "Result"). The e2e schedule is stopped. The two parts on the release commit stay due with it (AU-8) | **[approval]** each source load and the schedule, which one bounded approval may cover; **[record]** the evidence | AU-2 |
| AU-4 | Live staging becomes automatic (§8.3): ledger class and binding plus `coordinated`, then the first provider requests, then the hourly schedule. CPU measured on the first runs (RB-7 check 2). **Prepared 2026-11-03:** step 1's configuration, the `automatic` attribution record (`data-sources-v3`, owner decision of that day) and the app and API wording committed; the first runs rehearsed in process against `…1d`; nothing deployed | **[approval]** each of the three; cutover-sensitive | AU-3 |
| AU-5 | The monitor's hourly `schedule:` for staging | **[approval]**, **[PR]** | AU-4, AU-6 |
| AU-6 | Alert drill: run the workflow with `simulate_failure`; the owner confirms the e-mail arrived (closes OD-1). **Passed 2026-10-22:** one owner-authorised dispatch against staging (`skip_heartbeat`, `simulate_failure`), [run 39852057415](https://github.com/SergioArenas98/GridView_App/actions/runs/39852057415) on `master` at `09e0686`, failed as expected with the single finding `simulated-failure` (pendingRound 18); the owner confirmed, with a screenshot, that GitHub's failure e-mail for it arrived at 21:49 Irish time (20:49Z) the same day. OD-1 is closed. The workflow is still manual-only: no monitor schedule was enabled (that is AU-5), and no Worker schedule changed | **[approval]**, **[record]** | AU-0 |
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
   gridview-snapshots-e2e`, **without** `--env`. Wrangler 4.112 titles a
   namespace `<env>-<argument>`, so `GRIDVIEW_DATA --env e2e` would create
   `e2e-GRIDVIEW_DATA` instead of following staging's
   `gridview-snapshots-staging`. Without `--env` the command reads no
   environment block, so it can run before the block is committed. For a TOML
   configuration Wrangler only prints a snippet and edits nothing. Record the
   id.
   **Done 2026-10-21:** `gridview-snapshots-e2e`, id
   `f8970084eef14b6a8e24db521d015df3`, after Workers Paid (AU-1) was
   confirmed active on the same account.
2. Commit the block, with that id, and flip the dormancy tests that pin
   `coordinated`, the ledger, the controlled source and the cron as absent, so
   that they allow them in `env.e2e` only. They stay pinned for staging and
   production.

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
   id = "f8970084eef14b6a8e24db521d015df3"

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
   **Done 2026-10-21:** deployed once at 23:12Z from a clean checkout of
   master `38d84ed`, after Workers Paid was re-read as the current plan.
   Version `91ff2541-e771-488c-b167-038ae1ca7d86`, with three SQLite Durable
   Object namespaces and no schedule. The token is kept outside the
   repository. Staging was unchanged: Worker `453af4fb`, its two namespaces,
   no schedule, active `pm1-000000000001d-aed72435`, and the same public ETags.
4. Genesis: one authenticated `POST
   /internal/admin/publication/cutover/genesis` with `{"season": 2026,
   "genesisIdentity": "gridview-e2e-2026-genesis-01", "confirmGenesis":
   true}`. Then `GET /internal/admin/publication/cutover/status?season=2026`
   must show `genesis`, and `/v1/seasons/2026` must answer `503`.
   **Done 2026-10-21:** one POST at 23:17:41Z. It returned 200 with outcome
   `created` and fingerprint `genesis1:374357a9…6a8b`. Status then showed
   `genesis`, authoritative, with no active or previous version.
   `/v1/seasons/2026` went from `404 SEASON_NOT_FOUND` before genesis to
   `503 SNAPSHOT_NOT_READY` with `retryable: true` after it. The namespace
   still holds no key, the schedule is still empty, and staging was unchanged.
   That status read was the last admin request sent to the Worker.

### 8.2 The demonstration (AU-3)

**Revised by the owner on 2026-11-02.** The demonstration is asynchronous and
functional. The owner does not have to be present at a set time. The
operator's session does stay on through an evening run, to observe, advance
and stop. This replaces the timed watch, its fixed dates and its rule that every
scheduled run needs its own evidence. It passed on 2026-11-03 (see "Result");
the procedure stays for a later run.

The demonstration answers one question: does a race result, and then a
correction to it, reach the installed app with nobody acting on GridView?
Exact polling cases, planner decisions and request budgets stay proven by the
automated gate (`test/e2e/automatic-updates/gate.test.ts`, ADR 0028 D10 part 1).

#### Result

**Passed on 2026-11-03,** on one bounded owner approval of 2026-11-02:
`F` = 2026-11-02 20:17Z (`T′` 17:00Z), the schedule set from PR #97's head
`f57ec0f`, the observer run from PR #96's head `94b17e7`. Phone times are Irish
time, which is UTC in November.

| # | Evidence |
|---|---|
| A1 | `200` at 22:18:30Z, Norris on 25, release `generatedAt` 22:17:44.031Z, from the `F` + 2 h run |
| A2 | The owner's screenshots at 22:20: the result's entries as served, and Home on round 23 |
| A3 | The correction loaded once at 22:28Z, read back at 22:30Z: exactly one controlled key changed |
| A4 | `200` at 00:18:30Z, Norris on 26, release `generatedAt` 00:17:39.521Z, from the `F` + 4 h run. The only data change from A1 is the winner's points |
| A5 | The owner's screenshot at 04:22 from the installed app: Norris on 26, the entries matching A4. The owner confirmed no reinstall between the two checks |
| A6 | The operator's only writes were the two loads and the schedule on and off: no admin request, manual publication, deploy, merge or retry. Accepted by the owner |

Every hourly run from `F` to `F` + 4 h wrote its heartbeat and matched the
in-process rehearsal. The monitor's only findings were the expected
`results-late` before the result. The schedule was stopped at 00:19Z from
`master`; the schedules API showed `[]` for e2e, staging and production, and at
04:24Z the heartbeat had not moved since the 00:17 run. Staging and production
kept their versions and public answers. Evidence gaps, none failing: the results
screen is titled "Gran Premio" without naming Qatar, so both screenshots identify
round 22 by their entries; persisted logs were not exported. The operator keeps
the record and its files outside the repository. The coverage limits below
apply. Round 22 is published on the e2e Worker and cannot be replayed, so a
later run needs a new plan.

#### The phases

Each phase stays observable until the next is explicitly advanced.

| Phase | Who acts | What happens | It lasts until |
|---|---|---|---|
| 1. First result | GridView, with the operator observing | The controlled provider serves round 22's result; GridView fetches, validates and publishes it on its own schedule | The result is served, then it stays served |
| 2. First check | The owner, whenever convenient | Opens the installed app and sees the result | The operator advances, at the latest `T′` + 12 days |
| 3. Advance | The operator | One `kv bulk put` changes the controlled provider's round 22 document to the correction | Immediate |
| 4. Correction | GridView, then the owner whenever convenient | GridView fetches, validates and publishes the correction; a later app launch shows it | The correction stays served |

Changing the controlled provider is test setup: it stands for Jolpica changing
its data. Nothing is sent to GridView's admin routes at any point, and nothing
is published by hand.

**Timing.** The whole demonstration fits one evening when the advance is on
time, with `F` the first scheduled run:

| Run | What it does |
|---|---|
| `F` | Reads the moved calendar. No result exists yet |
| `F` + 1 h | Sights the result, pending |
| `F` + 2 h | Sees it again and publishes it |
| `F` + 3 h | Confirmation: sights a correction loaded by then, pending |
| `F` + 4 h | Sees it again and publishes it |

Five hourly runs are the shortest normal sequence. An in-process search of
every race anchor found none shorter, because a calendar change takes effect at
the next run, each publication needs two sightings an hour apart, and an
accepted result is re-read only at its confirmation slots. A later advance
loses nothing: loaded after `F` + 3 h, the correction is published at `F` + 8 h,
and later still within about two days. No criterion depends on these times.

#### Acceptance criteria

All six must pass. The record keeps each one's evidence with its instant.

| # | Criterion | Evidence |
|---|---|---|
| A1 | The API serves round 22's result automatically: `/grand-prix/22/results` answers `200` with the winner on 25 points | An observer run's verbatim answer, or the operator's saved public GET, with its instant and the release's `generatedAt` |
| A2 | The installed app shows that result. Before round 23's start, Home has also moved on to round 23 | The owner's phone screenshot, with the time visible |
| A3 | The advance changed only the controlled provider: one key, read back byte for byte | The load's record and its read-back |
| A4 | The API serves the correction automatically: the winner on 26 points, from a later release than A1's | As A1 |
| A5 | The installed app shows the correction, at a launch after A4, with no reinstall | As A2 |
| A6 | Only the automatic path published. The operator's record shows that the only writes were the two source loads and the schedule, with no admin request after genesis and no manual publication | The operator's record, as the owner accepts it |

**Failure.** Any of these fails the demonstration: a result or correction that
never reaches the API or the app; a wrong winner or points; a staged
correction; a stop or block that needs an operator; a heartbeat that goes
stale after the first scheduled run, while the schedule is live.

**Missing logs are not a failure.** A persisted line that cannot be found, an
observer run GitHub dropped, or an hour with no sample is a diagnostic evidence
gap. The record lists the gap and the demonstration continues. Persisted
Workers Logs are incomplete: they dropped every event of the 2026-10-22 15:17Z
run, which did run. So the absence of a line proves nothing either way, and A6
rests on the operator's record, not on an empty search.

#### Coverage limits

These are what this demonstration does **not** show:

- **When.** It says nothing about polling instants, the hourly window, the
  second sighting (AU-D5) or the back-off. `gate.test.ts` proves those.
- **Every run.** The hourly heartbeat, each scheduled run and each monitor
  verdict are sampled, not proven one by one. Request budgets and the planner's
  decisions stay in the automated tests.
- **Natural settling.** An evening run ends before anything settles. From
  `T′` + 20 h the phase 1 source answers empty for round 22 (see "The hold"), so
  no deployed run shows a result settling on its own, and a correction loaded
  after `T′` + 24 h is found by a daily check, not in the hourly window.
- **A real race day.** The race anchor is synthetic and already past when the
  source is loaded, so the first check, a delayed start and the hours before a
  result are not shown here.
- **Failure paths.** A post-settlement correction, an outage, a lost commit, an
  incomplete page and a late publication stay in `gate.test.ts`.
- **Live data and production.** The data is controlled and the Worker is the
  isolated staging-class `gridview-api-e2e`. Real Jolpica traffic is AU-4 and
  production is AU-7.
- **The app.** It is the installed e2e build on one phone, checked at launch.
  `app-gate.test.ts` covers the data layer. Background behaviour is not covered.
- **The commit.** The genesis and the first release came from `91ff2541`; the
  later releases come from the deployed commit. The in-process gate on the
  release commit covers the path from genesis.

#### The hold

A correction must reach an unsettled result. A result settles at `T′` + 24 h,
and a correction after that is staged and stops the season for an operator
(§3), which this demonstration must not need. So phase 1's source keeps the
result unsettled: from `T′` + 20 h round 22's document answers empty. GridView
treats that as a failed check and withholds those runs, so nothing publishes.
The last release keeps serving, the heartbeat keeps advancing, and the result
stays visible.

- **Latest advance: `T′` + 12 days.** Never load the correction later. Round
  22's last check is at day 14, and a correction first read there is staged,
  which stops the season for an operator. Any load after the `T′` + 13 days
  00:17 run ends that way, so this limit leaves a day's margin. Past it the
  demonstration has not passed and needs a new plan: round 22 cannot be replayed
  once it is published.
- **Preferred advance: in the hour after the result,** which finishes in one
  evening. Otherwise within 5 days of `T′`, so that the correction is published
  before round 23 starts. A later advance still works, but Home changes again
  once round 23 has started.
- **Expected findings.** A monitor run fails, and GitHub e-mails the owner, in
  three cases only:
  - `heartbeat-stale`, before the first scheduled run writes its heartbeat;
  - `results-late`, from then until the result is published two hours later
    (round 22's old start);
  - `results-late`, hourly from `T′` + 7 days 12 h until the removal, in any
    phase, because round 23 never gets a result.

  Anything else is a real finding.

The hold is test setup in the source file. It changes nothing in GridView.

#### Setup

The demonstration runs on the same Worker as AU-2, with its KV namespace,
Durable Objects, `ADMIN_TOKEN`, genesis and first release, and the e2e app
already installed on the phone (`8caa3be9`). Only the source changes. A run on
2026-10-22 was paused before its race; PR #91 lets the regenerated source move
that race (`controlled-source.test.ts`). The Worker carries that fix since
deployment `6b52bc02`.

Each step below is an **[approval]**. The owner may give one approval for the
whole bounded sequence, naming `F`, the reviewed commits it runs from, and any
retry with a later `F` it allows.

1. Re-read the e2e and staging state read-only, and confirm the schedule is `[]`.
2. Choose `F`, the first `:17` run the steps below can reach. The race instant
   is `T′` = `F` − 3 h 17 min, at minute 00, already past. The shifted season
   must stay in 2026; the export refuses otherwise. From a clean checkout of
   `master`, which carries the phases since PR #97, generate both phases' files
   outside the repository, once each:

   ```text
   GRIDVIEW_CONTROLLED_SOURCE_OUT=<file> GRIDVIEW_CONTROLLED_RACE_START=<T′>
   GRIDVIEW_CONTROLLED_PHASE=<result, then correction>
   npx vitest run test/e2e/automatic-updates/controlled-source-export.test.ts
   ```

   `result` writes 29 documents, about 125 KB: rounds 1–21 classified, round 22
   raced at `T′` with its result from `T′` + 4 h, which is `F` + 43 min, and the
   hold. `correction` writes the one document the advance changes. Confirm both:
   29 entries with round 22's document ending empty, and exactly 1 entry. Replay
   both files' exact bytes in-process before loading, the way
   `controlled-source.test.ts` does. Keep the correction file for phase 3.
3. Load the `result` file: `npm exec -- wrangler kv bulk put <file> --binding
   GRIDVIEW_DATA --env e2e --remote`. Read it back. It overwrites the same 29
   keys.
4. Only after that read-back, and before `F`, schedule it from a clean checkout
   of the reviewed schedule PR's head. The PR must commit `crons = ["17 * * * *"]` for `env.e2e`.
   Run `npm exec -- wrangler triggers deploy --env e2e` there, and confirm through
   the schedules API. The PR is not merged for the run, so `master` stays at
   `crons = []` and stays the stop.
   - **Do not merge the PR until Removal step 4 has returned it to `crons = []`.**
     Merged with the cron, `master` would set the schedule again instead of
     stopping it. Until then the PR head's `wrangler.toml` says scheduled, even
     after the stop.
   - **The first scheduled run must come before round 22's result exists.**
     Confirm from `/v1/status`, read with `Cache-Control: no-cache`, that the
     heartbeat moved at `F`. If it has not by `F` + 30 min, stop before `F` + 43
     min, choose a new `F` and regenerate. A first run after that reads the
     result on round 22's old anchor, and the correction does not publish. Round
     22 cannot be replayed after that. The heartbeat shows that the run happened,
     not that it read the calendar; the read-back in step 3 covers the calendar
     document.
   - **The load comes first for the same reason.**
   - The PR changes that one list in `wrangler.toml` and the four tests that
     pin it: `demonstration-worker-config.test.ts`,
     `production-worker-config.test.ts`,
     `staging-season-batch-ingest.test.ts` and the ledger `dormancy.test.ts`.
     Staging and production stay `[]`.
   - `triggers deploy` sets the schedule and keeps the deployed version. A
     `wrangler deploy --env e2e` from that checkout would set it too, because a
     deploy applies the committed list.
   - To stop at once, run `triggers deploy` from a clean checkout of `master`,
     after confirming that it resolves e2e to `[]`.
5. Observe from the operator's machine. After each scheduled run, run the
   observer once from PR #96's head (`94b17e7`): `node scripts/monitor/au3-e2e-observer.mjs
   --out <dir>`. It executes the real `automation-monitor.mjs` against the e2e
   host and keeps 10 public answers verbatim, with their instants. It sends
   public GETs to the e2e origin only, with no credential. If the run will
   outlast the operator's session, merging PR #96 runs the same script hourly
   from GitHub instead, with 90-day artifacts. Merging is its activation, and the
   removal then deletes it.

#### Running the phases

1. **Phase 1.** Nobody acts on GridView. The operator confirms the first run,
   then reads A1 from the observer's record or one public GET. If the API has no
   result at `F` + 4 h, stop and diagnose.
2. **Phase 2, the owner.** Open the installed e2e app, do not reinstall it, and
   take a screenshot (A2). Any time after A1, for as long as the phase lasts.
3. **Phase 3, one [approval].** After A1 and A2 and before the latest advance,
   confirm the API still serves 25 points, then load the correction file with
   the same `kv bulk put`. Read it back: exactly one key changes (A3). To finish
   the same evening, load it at least 5 minutes before the `F` + 3 h run, which
   allows for KV propagation. A later load only moves phase 4.
4. **Phase 4.** Nobody acts on GridView. Read A4 as A1. If the API has not changed two days
   and three hours after the advance, stop and diagnose. Then the owner opens
   the app and takes a screenshot (A5). Any launch after A4 finds the correction,
   because the manifest expires an hour after each release.

#### Removal

The served result outlives the schedule, so the Worker can stop as soon as A4
passes, before the owner's second phone check. Each step is an **[approval]**,
which the sequence's one approval may cover:

1. Run `npm exec -- wrangler triggers deploy --env e2e` from a clean checkout of
   `master`, after confirming that it resolves e2e to `[]`. Confirm `[]` through
   the schedules API; with an empty list the command can print "Deployed" and never
   exit, so verify, then end it.
2. Save the observer records, and export any persisted logs still within their
   7 days as diagnostics.
3. Record A1–A6 with their evidence, the coverage limits above and any evidence
   gaps. AU-3 is passed only if all six pass.
4. Before the schedule PR merges, its branch returns to `crons = []` and reverts
   the four tests that pin the schedule (Setup, step 4), so `master` never
   carries a cron. If PR #96 was merged, disable its workflow at the stop, and
   delete the workflow, script and test in a separate PR.

### 8.3 Live staging (AU-4)

**Prepared 2026-11-03; nothing deployed.** The AU-4 PR commits step 1's
configuration (`[env.staging]`: `PROVIDER_MODE = "coordinated"`, the staging
exports table restating both existing classes plus `ReconciliationLedger`,
the `RECONCILIATION_LEDGER` binding, still `crons = []`) and the
attribution record `data-sources-v3`, which credits Jolpica F1 as
`automatic` (owner decision 2026-11-03, superseding the batches-only wording
of 2026-10-13; it is not a legal clearance). Live staging is still
`453af4fb-…` (`none`, two Durable Object namespaces, active
`pm1-000000000001d-aed72435`). Merging the PR deploys nothing.

**Rehearsed in process** (`test/e2e/automatic-updates/staging-first-run-rehearsal.test.ts`,
opt-in, over the 2026-10-19 capture that `…1d` was published from, seeded as
`…1d` and credited `data-sources-v2`; the committed staging variables, a
ledger over the real class, the real limiter and hardened client; no network):

| Instant | Run 1 | Run 2 (forced publication) |
|---|---|---|
| 2026-10-19T19:00Z (Jolpica as captured) | 1 request (`/races/`), plan `observation`, nothing published | 23 requests (6 season resources + rounds 1-17); one release published; 117 documents, none added or removed; the only content change is `content:manifest` `attributionVersion` `data-sources-v2` → `data-sources-v3`, every other document differs in instants only |
| 2026-11-04T10:00Z (rounds 18 and 19 raced, answered as not yet published) | 1 request, nothing published | 25 requests (rounds 18 and 19 added); `withheld`, `classification-unavailable`; `…1d` keeps serving |

In the real step 2 Jolpica will serve rounds 18 and 19, so the second run is
expected to publish them with the standings after round 19. That is the
difference to review, together with the attribution version and freshness.
The in-process run took 173 ms of Node wall time; Workers CPU is measured at
step 2.

**What the deploy cannot undo.** Creating the `ReconciliationLedger` class is
a Durable Object class lifecycle change. Cloudflare refuses `wrangler
rollback` across one, so after step 1 no rollback can reach `453af4fb-…` or
any earlier version, permanently. Redeploying an older commit also fails,
because its staging exports table lacks the class. Rollback stays possible
between versions deployed after step 1, as long as none changes a class
again. Never remove the class from `exports`: deleting a class is permanent
and destroys the ledger's data. Only staging is affected: the demonstration
Worker and production are separate scripts.

Every step below is its own **[approval]**; each is cutover-sensitive
(staging runbook §6, "Automatic updates on staging (AU-4)", which holds the
commands and checks).

0. **Preflight, read-only.** Clean checkout of the merged commit; `npm ci`,
   typecheck, tests; `wrangler deploy --env staging --dry-run` lists the three
   Durable Object bindings, `PROVIDER_MODE=coordinated`, no schedule; live
   staging re-read (§2 of the runbook): `453af4fb` at 100 %, schedules `[]`,
   two namespaces, active `…1d`, the 52 public ETags recorded. Check
   `wrangler deploy`, `tail` and `triggers deploy` flags with `--help`.
1. **[approval] Deploy** step 1's configuration. Expect a new version, a
   third namespace (`ReconciliationLedger`), schedules still `[]`, the same
   active release and public ETags (a deploy publishes nothing), and the
   ingest refusing as `provider-mode-coordinated`. Nothing runs: there is no
   schedule. Stop on any other difference.
2. **[approval] The first live provider requests:** two authenticated
   `POST /internal/admin/sync/full?season=2026`, a few minutes apart, with
   `wrangler tail --env staging --format json` open. The first sends one
   request (the calendar); the second sends 6 + one per raced round (25
   today) and is expected to publish.
   - Record each run's CPU from the tail (RB-7 check 2); compare with the
     15-minute cron limit and the 362 ms ingest.
   - Compare the new release with `…1d` document by document. Expected:
     `attributionVersion` `data-sources-v3`, instants, rounds 18-19 results,
     standings, Home and the calendar's classified flags. Any other
     difference is a stop: review it before step 3.
   - Manual runs corroborate nothing (O-8) and do not beat the heartbeat.
3. **[approval] The hourly schedule:** a PR committing `crons = ["17 * * * *"]`
   and `wrangler triggers deploy --env staging`. Soak through one race
   weekend; the next are São Paulo (R20, 2026-11-08 17:00Z, first check
   19:17Z), Las Vegas (R21, 2026-11-22 04:00Z) and Qatar (R22, 2026-11-29
   16:00Z). Then AU-5 schedules the monitor.

The staging app needs a build with the new wording (`data-sources-v3`)
before an installed staging app describes the automatic path; installing it
is its own approval.

**Recovery.** None of these needs a Worker rollback:

- **Stop the schedule** (after step 3): set `crons = []` and run `wrangler
  triggers deploy --env staging`. Schedules are not part of a version, so this
  changes no code. Nothing publishes afterwards.
- **Stop every coordinated run, keep the ledger's data:** deploy a commit
  without the `RECONCILIATION_LEDGER` binding but with the three exports.
  Runs stop at `ledger-unbound` before any request.
- **Fall back to manual batches:** deploy `PROVIDER_MODE = "none"` with the
  exports and the binding kept. The ingest is admitted again (the
  `automatic` record admits a batch). A batch generated before
  `data-sources-v3` is refused as `attribution-mismatch`; regenerate it at
  the deployed commit. The calendar-horizon policy is shared, so releases
  re-stamp consistently.
- **A bad automatic release:** under `coordinated`, a release rollback
  needs a hold first: `POST /internal/admin/reconciliation/hold`, then
  `POST /internal/admin/rollback?season=2026`; the D14/D15 guard still
  applies. Keep the hold until the cause is fixed: releasing it is consent,
  and the next run republishes through every guard, including what the
  rollback replaced. Runbook §6, "Reconciliation operator routes".
- **A code defect:** a forward fix, deployed from a commit that keeps the
  three exports.

### 8.4 Production (AU-7)

PR #85's configuration is the interim state. The W2 PR (2026-10-22) commits
only the production KV id and keeps that bootstrap configuration
(`PROVIDER_MODE = "none"`, no ledger, `crons = []`). The coordinated
configuration comes afterwards, in its own AU-7 PR, once AU-7's
prerequisites hold. That PR commits:

- `PROVIDER_MODE = "coordinated"`;
- the production exports table with the three classes, and the
  `RECONCILIATION_LEDGER` binding;
- `crons = []`.

Then:

1. **Deploy [approval]:** the AU-7 configuration. Then read the Workers Logs
   for two public GETs, which must leave **no** event. W3 itself already
   happened: on 2026-10-22 the bootstrap configuration was deployed as
   version `62bf40e9-426f-40b7-9fc1-44ab4c42999b` (`production-release-plan.md`
   W3), so this deploy replaces that version and needs no `--secrets-file`.
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
