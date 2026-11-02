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
| AU-3 | **The end-to-end demonstration with controlled data** (§8.2): asynchronous, in persistent phases, passed on its acceptance criteria A1–A6. Also on the release commit: the in-process gate in CI and the app half locally. **Pending:** the 2026-10-22 run passed its first release and phone bootstrap and was paused before its race; the asynchronous demonstration has not run | **[approval]** each source load and the schedule; **[record]** the evidence | AU-2 |
| AU-4 | Live staging becomes automatic (§8.3): ledger class and binding plus `coordinated`, then the first provider requests, then the hourly schedule. CPU measured on the first runs (RB-7 check 2) | **[approval]** each of the three; cutover-sensitive | AU-3 |
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
functional. Nobody has to be present at a set time. This replaces the timed
watch, its fixed dates and its rule that every scheduled run needs its own
evidence. AU-3 stays pending until the criteria below pass.

The demonstration answers one question: does a race result, and then a
correction to it, reach the installed app with nobody acting on GridView?
Exact polling cases, planner decisions and request budgets stay proven by the
automated gate (`test/e2e/automatic-updates/gate.test.ts`, ADR 0028 D10 part 1).

#### The phases

Each phase stays observable until the next is explicitly advanced.

| Phase | Who acts | What happens | It lasts until |
|---|---|---|---|
| 1. First result | Nobody | The controlled provider serves round 22's result; GridView fetches, validates and publishes it on its own schedule | The result is served, then it stays served |
| 2. First check | The owner, whenever convenient | Opens the installed app and sees the result | The operator advances, at the latest `T′` + 13 days |
| 3. Advance | The operator | One `kv bulk put` changes the controlled provider's round 22 document to the correction | Immediate |
| 4. Correction | Nobody, then the owner whenever convenient | GridView fetches, validates and publishes the correction; a later app launch shows it | The correction stays served |

Changing the controlled provider is test setup: it stands for Jolpica changing
its data. Nothing is sent to GridView's admin routes at any point, and nothing
is published by hand.

**Waiting periods.** Phase 1 ends about 3 h 20 min after `T′`. Phase 4 ends
within about two days of the advance. Its exact time depends on the cadence,
and no criterion depends on it.

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
correction; a stop or block that needs an operator; a heartbeat stale while
the schedule is live and the monitor can read it.

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
- **Natural settling.** From `T′` + 20 h the phase 1 source answers empty for
  round 22 (see "The hold"), so no deployed run shows a result settling on its
  own, and a correction loaded after `T′` + 24 h is found by a daily check, not
  in the hourly window.
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
treats that as a failed check. The last release keeps serving, the heartbeat
keeps advancing, and unchanged content publishes nothing, so the result stays
visible.

- **Latest advance: `T′` + 13 days.** Round 22 reaches its ceiling at day 14.
  After that a correction would be staged, so do not load it. The demonstration
  has then not passed, and it needs a new plan: round 22 cannot be replayed once
  it is published.
- **Preferred advance: within 5 days of `T′`,** so that the correction is
  published before round 23 starts. A later advance still works, but round 23
  never gets a result, so from `T′` + 7 days 12 h the monitor fails hourly on
  `results-late`, and Home changes again.
- **Expected findings.** A monitor run fails, and GitHub e-mails the owner, for
  `results-late` in two cases only: from the first run until the calendar
  release two hours later (round 22's old start), and from `T′` + 7 days 12 h
  (round 23). Anything else is a real finding.

The hold is test setup in the source file. It changes nothing in GridView.

#### Setup

The demonstration runs on the same Worker as AU-2, with its KV namespace,
Durable Objects, `ADMIN_TOKEN`, genesis and first release, and the e2e app
already installed on the phone (`8caa3be9`). Only the source changes. A run on
2026-10-22 was paused before its race; PR #91 lets the regenerated source move
that race (`controlled-source.test.ts`). The Worker carries that fix since
deployment `6b52bc02`.

Everything below happens in one sitting of about 30 minutes, and each step is
its own **[approval]**:

1. Re-read the e2e and staging state read-only, and confirm the schedule is `[]`.
2. Choose a race instant `T′` at minute 00, at least 4 h ahead and early enough
   that the shifted season stays in 2026; the export refuses otherwise. Generate
   both phases' files outside the repository, once each:

   ```text
   GRIDVIEW_CONTROLLED_SOURCE_OUT=<file> GRIDVIEW_CONTROLLED_RACE_START=<T′>
   GRIDVIEW_CONTROLLED_PHASE=<result, then correction>
   npx vitest run test/e2e/automatic-updates/controlled-source-export.test.ts
   ```

   `result` writes 29 documents, about 125 KB: rounds 1–21 classified, round 22
   racing at `T′` with its result from `T′` + 2 h, and the hold. `correction`
   writes the one document the advance changes. Replay both files' exact bytes
   in-process before loading, the way `controlled-source.test.ts` does. Keep
   the correction file for phase 3.
3. Load the `result` file: `npm exec -- wrangler kv bulk put <file> --binding
   GRIDVIEW_DATA --env e2e --remote`. Read it back. It overwrites the same 29
   keys.
4. Only after that read-back, merge the schedule PR and schedule it. The PR
   must commit `crons = ["17 * * * *"]` for `env.e2e`. Then run `npm exec --
   wrangler triggers deploy --env e2e` from a clean checkout of the merge, and
   confirm through the schedules API.
   - **The first scheduled run must come before round 22's result exists.**
     Have the schedule live at least 1 h before `T′`. If it is not, do not
     schedule it: choose a new `T′` and regenerate. A first run after `T′` + 2 h
     reads the result on round 22's old anchor, and the correction does not
     publish.
   - **The load comes first for the same reason.**
   - The PR changes that one list in `wrangler.toml` and the four tests that
     pin it: `demonstration-worker-config.test.ts`,
     `production-worker-config.test.ts`,
     `staging-season-batch-ingest.test.ts` and the ledger `dormancy.test.ts`.
     Staging and production stay `[]`.
   - Merging changes nothing on Cloudflare. `triggers deploy` sets the
     schedule and keeps the deployed version. Once it is merged, a `wrangler
     deploy --env e2e` from `master` also sets it, because a deploy applies
     the committed list.
   - To stop at once, run `triggers deploy` from a checkout still at `crons =
     []`; from `master` it would only set the schedule again.
5. Merge the observer PR. Merging is its activation: a scheduled workflow runs
   only from `master`, and `.github/workflows/au3-e2e-observer.yml` then runs
   hourly at :27. Each run executes the real `automation-monitor.mjs` against
   the e2e host and keeps 10 public answers verbatim, with their instants, as a
   90-day artifact. It sends public GETs to the e2e origin only, with no
   credential, and has read-only permissions. `workflow_dispatch` takes an extra
   observation at any time.

#### Running the phases

1. **Phase 1, unattended.** Nothing to do. Read A1 at any later time from the
   observer's artifacts or one public GET. If the API has no result at `T′` +
   12 h, stop and diagnose.
2. **Phase 2, the owner.** Open the installed e2e app, do not reinstall it, and
   take a screenshot (A2). Any time after A1, for as long as the phase lasts.
3. **Phase 3, one [approval].** After A1 and A2 and before the latest advance,
   confirm the API still serves 25 points, then load the correction file with
   the same `kv bulk put`. Read it back: exactly one key changes (A3).
4. **Phase 4, unattended.** Read A4 as A1. If the API has not changed two days
   and three hours after the advance, stop and diagnose. Then the owner opens
   the app and takes a screenshot (A5). Any launch after A4 finds the correction,
   because the manifest expires an hour after each release.

#### Removal

The served result outlives the schedule, so removal can wait until A1–A6 are
recorded. Each step is its own **[approval]**:

1. Download the observer artifacts for the two publications, and export any
   persisted logs still within their 7 days as diagnostics.
2. One PR sets `crons = []` for `env.e2e` and deletes the observer workflow, its
   script and its test. The artifacts outlive the workflow by their 90 days.
3. Merge it, run `triggers deploy --env e2e`, and confirm `[]` through the
   schedules API.
4. Record A1–A6 with their evidence, the coverage limits above and any evidence
   gaps. AU-3 is passed only if all six pass.

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
