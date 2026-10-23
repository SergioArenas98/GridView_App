# ADR 0028: Automatic end-to-end season updates

- Status: Accepted
- Date: 2026-10-21

## Context

On 2026-10-21 the owner made **end-to-end automatic updates a release
requirement**: a race result must travel from the source to the app with no
operator capture or submission. The same day the owner fixed the first Google
Play release's product scope - the full weekend schedule, but **race results
only** (D12) - and the race-result polling plan (D5): the first check at the
first hourly tick at or after the scheduled race start + 90 minutes, then
hourly while no valid, complete result exists, through a bounded window, then
backing off. Until then the only path that reached real
data was operator-driven: capture about 23 Jolpica `GET`s, review the batch
offline, submit it to `POST /internal/admin/season/ingest` (ADR 0025 D12,
PR #73; twice on staging, 2026-10-14 and 2026-10-19). PR #85's production
configuration (`PROVIDER_MODE = "none"`, `crons = []`) assumed that model.

The automatic path already exists in the code, **dormant**: the coordinated
runtime (ADR 0020 C1–E4, entry points, run budget, ledger resolver; ADR 0023;
ADR 0025). It observes Jolpica through one hardened, rate-limited boundary,
reconciles every classification through the settling state machine, and
publishes through the same D14–D16 guard and sequencer the ingest uses. It
was parked on 2026-10-07 only because the account was on Workers Free: O-10
found it infeasible there (10 ms CPU, 50 external subrequests). On
2026-10-20 the owner chose Workers Paid (W-P = A), not yet bought.

Four gaps stood between that code and automatic operation:

1. **Production could not start automatically.** A coordinated run refused a
   season the sequencer reports `genesis` (`authority-not-authoritative`), so
   production's first release still needed a capture and a submission
   (release plan D1, D3).
2. **Freshness would regress.** `freshnessPolicyFor` gave `coordinated` the
   fixed 15-minute interval. The coordinated runtime publishes only changed
   content (O-12), so unchanged data would be called stale 15 minutes after
   every release. It also made a `none`→`coordinated` switch cross the
   rollback re-stamping constraint (ADR 0005, amendment of 2026-10-19).
3. **Nothing public showed that the automation was alive.** A coordinated run
   writes no `SyncState`, so `/v1/status.lastSuccessfulSyncAt` stays at the
   last legacy sync, and OD-1 requires *verified* alert delivery before
   production.
4. **The production logging decision (D-L) was open**, with persisted logs off
   as the fail-safe in PR #85. With them off, nothing about a failed automatic
   run would survive for diagnosis.

### Jolpica's current terms (re-read 2026-10-21, from its public GitHub docs; the API was not contacted)

- *Terms of Use*, last updated 2025-08-27: data under CC BY-NC-SA 4.0; "freely
  available for non-commercial use"; commercial use by contact; "abuse or
  excessive use may result in temporary or permanent blocking", "may block
  without notice"; no uptime or correctness guarantee; terms may change, with
  changes announced on the repository.
- *Rate limits*: unauthenticated burst **4 requests/second**, sustained
  **500 requests/hour**, no daily limit; HTTP 429 on breach. Token access is
  "still being implemented", and the page warns that limits "will decrease"
  when it and a new API roll out. It asks clients to cache. No User-Agent
  requirement is stated now; GridView still sends its identifying one.

These match ADR 0019 and ADR 0021 (recorded 2026-08-19).

### Cloudflare (Workers Paid, docs last updated 2026-10-12)

Cron Triggers at an interval of an hour or more get **15 minutes of CPU** and
15 minutes of wall time; 10,000 subrequests per invocation; Workers Logs keep
7 days, 20 M events a month included (volume pricing from 2026-12-01).
Cloudflare's own custom alerts on observability data are **in beta**, with
webhook, chat and incident-tool destinations (not e-mail).

## Decision

### D1. Automatic updates are the operating model

The coordinated runtime is GridView's operating model in staging and
production. `PROVIDER_MODE = "none"` with the guarded ingest is an **interim
bootstrap state and a manual fallback**, never the plan for running the
season. A Play release does not proceed on the assumption that an operator
captures and submits batches after races; it is gated on AU-3 and AU-7
(`docs/release/automatic-updates.md`).

### D2. The path, and what activation adds

Source retrieval → validation → guarded publication → app refresh:

1. **Schedule.** One Cron Trigger, `17 * * * *` (O-7). Every tick runs
   `runCoordinatedSync` for the current season.
2. **Plan.** The G5 planner (ADR 0020 C2) decides what is due from the ledger
   alone; nothing due sends nothing.
3. **Retrieve.** One coordination through the Jolpica routing port, the
   hardened client and the global `ProviderRateLimiter` (ADR 0021), paced at
   least 260 ms apart, under the run budget (240 s coordination deadline).
4. **Validate.** Every response is decoded, mapped through the curated
   registries (ADR 0022) and deep-validated (ADR 0024); each classification
   goes through the settling state machine (ADR 0020 §4).
5. **Publish.** The whole season candidate, if publishable (O-5), passes the
   no-change gate (O-12), the intent gate, the D14–D16 guard and the
   sequencer's `prepare` CAS and `finalize` (ADR 0025).
6. **Refresh.** The app revalidates on launch and resume (ADR 0015), by the
   calendar horizon of what it holds (D4), with conditional requests.

Activation is configuration only: `PROVIDER_MODE = "coordinated"`, the
`ReconciliationLedger` class registration and `RECONCILIATION_LEDGER` binding,
and the cron. Each is committed only with its deploy authorization, as PR-E
precedent requires, because creating the ledger class permanently blocks
`wrangler rollback` to every earlier version (staging deployment decision
pack, 2026-10-07).

### D3. Production starts automatically from genesis

A coordinated run accepts a season the sequencer reports `genesis`:
authoritative, no release. It has nothing to reconcile, so the run plans from
the snapshot its lease read; a `publishing` slot left before any release is
resolved as not published; and the first publication binds the empty
predecessor **the authority itself reports** (ADR 0025 D12, amendment of
2026-10-20). A predecessor that merely cannot be read is still never empty;
`uninitialized` and `seeded` seasons are still refused. Production therefore
needs one authenticated genesis request (release plan D2), and **no capture
and no submission**: D1 and D3 leave the production path.

### D4. Automatic releases carry the calendar horizon

`freshnessPolicyFor` gives `coordinated` the `calendar-horizon` policy, as
`none` has; only `mock` keeps the interval. A release's data documents expire
at the earliest sprint or race start it does not classify, the content
manifest after an hour, and a release published after that start falls back
to 15 minutes, so a client re-checks often while a result is due. `none` and
`coordinated` now re-stamp a rollback identically, which removes the
mode-switch constraint between them (ADR 0005 amendment of 2026-10-19).

### D5. When it runs, and how soon a result appears

The race classification's polling plan (owner instruction of 2026-10-21). It
replaces ADR 0020 C2's dense checks at race start + 5 h, + 9 h, + 15 h and
+ 24 h; the settling rules are unchanged.

1. **Start of polling.** The first eligible check is the **first hourly tick
   at or after the scheduled race start + 90 minutes**. That instant starts
   polling; it is **not** evidence that the race has finished. A delayed
   start, a red-flagged race and a source still loading the result all answer
   "no result yet", and the next tick asks again.
2. **Initial window.** While no valid, complete result has been accepted, the
   round is asked for on **every hourly tick through race start + 10 h
   30 min**: ten checks (slots 1-10). A differing revision pending
   corroboration is asked for hourly too, because it withholds the whole
   season (O-5(a)) until the next check resolves it.
3. **Back-off.** Then race start + 15 h and + 24 h, then daily to day 14 (slots
   11-25). A round never reconciled by day 14 is abandoned
   (`never-reconciled-abandoned`) and flagged; nothing is asked again.
4. **An accepted result** with nothing pending takes only the confirmation
   checks: + 5 h 30 min and + 9 h 30 min inside the window, then the back-off.
   It is not re-read hourly. Settlement is unchanged: three confirmations,
   never before + 24 h.
5. **A first result is seen twice before it is published.** **Product
   decision AU-D5, accepted by the owner for 2.0.0 on 2026-10-21 together
   with the limitation below (D13);** the code on PR #86 implements it. Its
   limitation: two matching observations
   reduce the risk of publishing a transient short classification; they do
   not prove that a classification is complete, and a short result Jolpica
   serves unchanged for an hour or more may still appear as "Final" until it
   is corrected. A cadence check in slots 1-9 that finds a round's first
   valid result holds it pending, and the next successful cadence check
   publishes it only if it returns the same revision; a different one
   replaces the pending one, as any change pending does (T4), and must itself
   be seen twice. A failed or deferred check leaves it pending. Inside the
   window the next check is the next hourly tick, so this normally costs one
   hour. The pair counts as **one** confirmation, as any first write does:
   two reads an hour apart are not the three spaced confirmations settling
   needs, so settling is unchanged. From slot 10 on - the window's last
   check, the back-off and the ceiling - a
   first result is published at once, as before, because the next check is
   hours or days away and a pending round withholds the whole season until
   then. A manual run (O-8) still writes at once. This amends ADR 0020's T0
   (Provider Evaluation §10.4.1), which wrote a first result without
   corroboration, for the window only.

Why the window ends at + 10 h 30 min: a race lasts at most about three hours,
suspensions included; weather can delay a start or a restart by hours; and
Jolpica publishes after the race and states no delay or timing guarantee. Ten hourly checks cover a start delayed
by about four hours, a three-hour race and several hours of publication lag,
at a bounded cost (D11). A later result is still found by the back-off.

| Resource | Cadence |
|---|---|
| Race classification, no accepted result | the first tick at or after race start + 1 h 30 min; hourly through + 10 h 30 min; + 15 h, + 24 h; daily to day 14 |
| Race classification, accepted result | + 5 h 30 min, + 9 h 30 min, + 15 h, + 24 h; daily while unsettled; hourly within the window while a change is pending; settled on deadline at day 14 |
| Calendar | every 6 h |
| Driver and constructor standings | daily in season, weekly off season, and in every publication run |
| Participants, circuits | weekly |
| Every classified round | re-read in every publication run (O-3), so at least weekly |

**Latency.** For a race at minute 00 the window's ticks are + 2 h 17 min,
+ 3 h 17 min, … + 11 h 17 min. A result Jolpica serves by a tick is sighted
at that tick and published at the next one (item 5), or at once at the
window's last check. The gate measures + 3 h 17 min for a result available
two hours after the start, + 5 h 17 min for an unusually long race, + 7 h
17 min for a start delayed by three hours, and + 11 h 17 min both for a
result first served an hour before the window's last check and for one first
served by it. The window's latest publication is therefore unchanged.
A result first served after + 10 h 30 min waits for the back-off: + 15 h
17 min, + 24 h 17 min, or a daily check. The I5 objective - reconciled data
within 24 hours - is an objective and not a guarantee, because Jolpica
guarantees neither timing nor uptime. **The app** shows the result at its
next launch or resume after publication: its data expired at the race start,
so that refresh revalidates and receives the new release. There is no push.

**Valid and complete.** A result is accepted only when it decodes strictly,
maps every identity through the curated registries, passes deep validation
(ADR 0022, ADR 0024) and is complete by its own page: an empty race list
(C-9), a page carrying fewer rows than its `total`, a gap in the positions or
no winner all make the check fail, so nothing is accepted and the next hourly
tick asks again. A classification that is **short but self-consistent** cannot
be told from a complete one (curator decision C-1: a decoded classification is
final, and the API serves it as `final`). Item 5 narrows that risk without
claiming to remove it:

- a short page that Jolpica completes **within the hour** is never
  published: the gate serves it from + 2 h and the complete one from + 3 h,
  and the only release is the complete one, at + 4 h 17 min;
- a short page served **unchanged for an hour or more** is still published
  as `final`, because two equal sightings do not prove a classification
  complete. The complete one is sighted at the next confirmation check and,
  pending, published one hourly tick later through the unchanged
  corroboration (D6): the gate publishes the short one at + 3 h 17 min and
  replaces it at + 7 h 17 min.

Publishing a first result as `provisional` and confirming it later was
rejected for 2.0.0: a classification's revision is the hash of the published
document, `status` included, so a status that changes without the content
breaks the rule that an accepted and a published revision are equal exactly
when the content is (`classification-revision.ts`), and `provisional`
denotes the provisional source (Provider Evaluation §10.9). A field-size completeness
rule would need a curator decision. Either is a future contract change.

**The manual batch fallback is unchanged.** Its capture rule
(`isBatchCaptureEligible`, PR #73) keeps the former five-hour threshold, so a
committed batch reconverts byte for byte.

### D6. Corrections

The settling state machine (ADR 0020 §4, D2.1–D2.9) decides, unchanged:

- **Before settlement**, a differing classification is pending, and is
  published when the next cadence check returns it again (D2.1). Inside the
  window the next check is the next hourly tick (D5). The gate shows a
  correction made 8 h after the start sighted at the + 9 h 30 min
  confirmation (+ 10 h 17 min) and published at + 11 h 17 min. A third
  revision replaces the pending one; three replacements in a row raise
  `unstable-source`.
- A **superseded** revision is never applied again (D2.2).
- **After settlement** (three confirmations from + 24 h on), a differing
  revision is sighted once and staged at its second sighting (D2.5). Under
  O-5(a) the **whole season is withheld** until an operator verifies and
  disposes of it (ADR 0020 E3, T12): even a new race result waits. The
  heartbeat stops (D7), so the monitor alerts within hours (D9). The gate
  demonstrates this.

### D7. A heartbeat the public can read

After a **scheduled** run that is healthy - nothing due, or an observation or
publication that settled without a refusal, block or stop, whose
coordination completed, and of whose requests at least one was a successful
observation - and whose season the closing ledger read finds neither held,
durably blocked nor publication-blocked, the run writes the season's `SyncState` with its
instant as `lastCompletedAt` (and the release it published, if any).
`GET /v1/status` already serves it as `lastSuccessfulSyncAt`. Manual runs
never beat. A scheduled run that sent provider requests and observed nothing
records `lastFailedAt` (not served publicly), and while that mark is newer
than the last beat, a run that sent no request does not beat either: between
races a failed calendar refresh is rescheduled six hours ahead, and the idle
ticks in between must not hide the outage. The next successful observation
beats and clears the mark. A failed write is one `warn` line and never fails the run. The
value stops moving when the cron stops, when runs fail, when every check
fails (Jolpica down or blocking GridView), and when the season needs an
operator.

### D8. Production logging (resolves D-L)

Production persists Workers Logs (`observability.enabled = true`,
`head_sampling_rate = 1`, `logs.persist = true`) with Cloudflare's
**invocation logs off**, so only the Worker's own lines are stored, for
Cloudflare's 7-day retention. Those lines carry **no personal data and no
credential**:

- a **public** request writes no `request.completed` line in production, and
  a failed one writes `request.failed` without its request ID, which the
  client receives and could keep with a crash report;
- a caller's `X-Request-ID` is adopted only as an opaque token
  (`[0-9A-Za-z-]{1,64}`), anywhere, so free text never reaches a response or
  a line;
- an internal request the admin router refused before routing (`401`,
  `404`) is logged as `/internal/*`, so no unauthenticated caller's path is
  persisted;
- what remains is the scheduled runs, the operator's own admin requests and
  failures, in the closed `LogEvent` vocabulary, with credential keys
  redacted wherever they appear.

App traffic is therefore not stored, so the Worker's logs add no Data safety
row. The first production deploy verifies it (AU-7). Whether the privacy
policy says so is the owner's decision in PR #82, which stays open.

### D9. Alerts: outside-in, from public data, with a verified delivery path

`services/edge-api/scripts/monitor/automation-monitor.mjs` reads three public
resources (`/v1/status`, the season calendar, the earliest unclassified
event) and fails on:

- `heartbeat-stale`: `lastSuccessfulSyncAt` older than **3 hours** (three
  missed hourly runs), or missing;
- `results-late`: the earliest event that is neither cancelled nor classified
  started more than **12 hours** ago (after the window's last check, at
  + 10 h 30 min, made at + 11 h 17 min);
- an unreadable status, calendar or event.

It needs no credential and can read nothing an app user could not. The
GitHub Actions workflow `automation-monitor.yml` runs it, and a failed run
notifies the owner by GitHub's own e-mail. It is committed **manual-only**:
adding its hourly `schedule:` is AU-5, after a drill
(`simulate_failure`) proves the alert reaches the owner (AU-6, closing OD-1).
Persisted logs (D8) and the `reconciliation.attention` line serve diagnosis,
not delivery. Cloudflare's beta custom alerts may be added later as a second
path; nothing depends on them.

### D10. The end-to-end gate, with controlled data

Release gate AU-3 has three parts, each run on the exact commit to be
released:

1. **In-process** (`test/e2e/automatic-updates/gate.test.ts`, in CI): the
   real Worker on the committed `[env.staging]` and `[env.production]`
   variables plus the activation delta, the real sequencer and ledger
   Durable Object classes behind their clients, the real limiter logic on the
   test clock, controlled Jolpica data, the scheduled handler at minute 17 of
   every hour, and **public GETs only** (the stage refuses an admin path). It
   covers the first check at + 1 h 30 min; an on-time race, an unusually long
   race, a delayed start and a result first served at the window's last check;
   a late Jolpica publication found by the back-off; a result that never
   appears (bounded checks, then none); a structurally incomplete page and a
   short but self-consistent classification; a pre-settlement correction; a
   post-settlement correction; an outage; a lost commit answer; production
   from genesis; and the request budget with a missing result.
2. **App** (`app-gate.test.ts` with `GRIDVIEW_E2E_APP=1`, locally): the
   Flutter data layer itself - `AppSyncCoordinator`, every repository, Drift
   and the production Dio client - launches against the same stage over HTTP
   and receives the result, then the correction, with no reopening.
3. **Deployed** (separately authorized): an **isolated** staging-class Worker,
   `gridview-api-e2e`, born by genesis, whose Jolpica transport reads a
   **time-aware controlled source from its own KV namespace**
   (`CONTROLLED_PROVIDER_SOURCE = "kv"`, admitted only in a coordinated
   staging Worker, a configuration error in production). One load before the
   race plays the weekend hands-free; the staging app built for that host
   shows the result. It is isolated so that controlled data never enters
   staging's real `pm1-…1d` lineage, which D14 would make forward-only.

### D11. Compliance

- **Volume.** At most 6 + the classified rounds per publication run (29 at
  season end), one run an hour, so at most 29 requests in any hour against
  500; one run's pace stays under 4/s, and the global limiter enforces both
  windows for every caller. The hourly window (D5) adds at most ten such runs
  per race, still one an hour. A tenfold cut in the limits would still leave
  room.
- **Caching.** GridView publishes snapshots; the app never calls Jolpica.
- **Attribution and licence.** Unchanged: `data-sources-v2`, CC BY-NC-SA 4.0
  (ADR 0019, PR #54).
- **Blocking.** A block or outage withholds; the last release keeps serving
  and `results-late` alerts.
- **Non-commercial use.** 2.0.0 carries no advertising (ADR 0018). The 1.x
  installs still request AdMob banners under the same listing until the ad
  units are archived (release plan D-A; PR #82 §3.6). They never showed
  Jolpica data, but the listing that distributes it earns ad revenue meanwhile.
  ADR 0019 forbids indirect monetisation, so **D-A should precede automatic
  publication of Jolpica data in production**. Recorded as an owner decision,
  not taken here. *(The owner accepted it on 2026-10-23, as AU-D2: archive
  before AU-7. The AdMob operation is separate and not done.)*

### D12. Product scope of the first Google Play release: race results only

2.0.0 shows the **full weekend schedule** - every practice, sprint
qualifying, sprint, qualifying and race session, with its time - and
publishes and displays **race results only**.

- The automatic path requests only the race classification
  (`/{season}/{round}/results/`), and the batch fallback captures the same.
  No free practice, qualifying, sprint qualifying or sprint result is
  requested, reconciled, published or displayed.
- Championship standings are Jolpica's standings, which count sprint points;
  the sprint classification itself is not shown.
- The app's results store can hold a sprint document, but nothing in 2.0.0
  publishes one.
- Results for free practice, qualifying, sprint qualifying and sprint are a
  **future product update**. Each needs its own provider resource, curated
  status vocabulary, polling plan, publication guard and gate. This ADR and
  PR #86 deliver none of them.

### D13. Owner acceptance of AU-D1 and AU-D5 (2026-10-21)

On 2026-10-21 the owner explicitly accepted AU-D1 and AU-D5
(`docs/release/automatic-updates.md` §9) for version 2.0.0, including their
documented limitations:

- **AU-D1, O-5(a).** A staged correction withholds the whole season until an
  operator verifies and disposes of it (D6); even a new race result waits.
  The heartbeat stops and the monitor alerts (D7, D9); nothing releases the
  season automatically. O-5(b), per-round carry-over, stays a later design
  change.
- **AU-D5, a first result seen twice (D5 item 5).** Two matching
  observations reduce the risk of publishing a transient short
  classification; they do not prove that a classification is complete, and
  a short result Jolpica serves unchanged for an hour or more may still
  appear as "Final" until it is corrected. A first result inside the window
  appears about an hour later than it would without the rule (+ 3 h 17 min
  instead of + 2 h 17 min for a race starting on the hour).

This records product decisions only. It authorises no merge, purchase,
provisioning, deployment or activation; each stays a separately authorised
step (`automatic-updates.md` §7, §8). AU-D2, AU-D3 and AU-D4 remain open.
*(On 2026-10-23 the owner accepted AU-D2 and AU-D3 in PR #82; AU-D4 remains
open.)*

## Consequences

- No environment is automatic yet. Everything here is dormant until the
  separately authorized steps of `docs/release/automatic-updates.md`.
- Production's track D shrinks to genesis; recurring submissions disappear.
  The ingest remains for `none` mode and as a fallback.
- `/v1/status`'s `lastSuccessfulSyncAt` becomes the coordinated heartbeat,
  and its ETag changes hourly while healthy.
- Production logs exist for diagnosis, and contain nothing about app users.
- O-5(a) means one rejected correction can freeze a season until an operator
  acts. The alert makes that visible; it does not make it automatic. The
  owner accepted this for 2.0.0 (AU-D1, D13).
- The race cadence has 25 slots instead of 17, and the ledger's check-index
  and confirmation bounds follow. Schema version 1 is refined in place, as
  ADR 0020 did before, because no ledger record exists in any environment:
  the class has never been registered or bound.
- A missing result costs up to ten hourly publication runs per race instead
  of one at + 5 h; each is withheld before generation, so it costs requests,
  not KV writes.
- A first result inside the window is published an hour after it is first
  seen (D5 item 5). The sighting run is withheld whole, so for that hour no
  other change in the season is published either; it costs one more
  publication run's requests per race, and no KV write.

## Alternatives considered

- **Scheduled capture and submission outside the Worker** (GitHub Actions
  running the generator and posting to the ingest). Rejected: it puts the
  production `ADMIN_TOKEN` in a third party, duplicates the reconciliation
  the coordinated runtime already does, has no corroboration, and GitHub
  disables scheduled workflows after 60 days of repository inactivity.
- **Ingest-only with an hourly self-capture in the Worker.** Rejected: it
  would rebuild the coordinated runtime without the settling state machine.
- **Cloudflare custom alerts as the only alert path.** Rejected for now: beta,
  and webhook-only delivery needs a further service.
- **Keeping the 15-minute interval for coordinated releases.** Rejected (D4).

## References

- ADR 0005 (amendment of 2026-10-19), 0015, 0018, 0019, 0020 (C2 cadence,
  amended by D5), 0021, 0022, 0023 (A2, curator decisions C-1 and C-9), 0024,
  0025 (D12 and its 2026-10-20 amendment), 0026.
- `docs/product/GridView_PRD.md` §9.3 (the first release's results scope).
- `docs/release/automatic-updates.md` (gates AU-0 to AU-8, activation).
- `docs/release/production-release-plan.md`, `submission-path-decision.md`.
- Jolpica F1, *Terms of Use* (last updated 2025-08-27) and *Rate Limits*,
  https://github.com/jolpica/jolpica-f1 (`TERMS.md`, `docs/rate_limits.md`).
- Cloudflare, *Workers limits* and *Workers Logs* (last updated 2026-10-12);
  Cloudflare blog, observability announcement of 2026-10-02 (custom alerts in
  beta), https://blog.cloudflare.com/one-observability-platform.
