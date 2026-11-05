# GridView 2.0.0 — production release plan

Prepared 2026-10-20 at `6aefcbf`. This plan takes the reconstruction from its
current state (staging only, production never deployed) to a staged Google Play
production rollout of **2.0.0 (versionCode 8)** as an update to the existing
`com.sejuma.gridview` listing.

> **Amended 2026-10-21: automatic updates are a release requirement**
> ([ADR 0028](../adr/0028-automatic-end-to-end-season-updates.md),
> [`automatic-updates.md`](automatic-updates.md)). A newly available result
> must reach the app with no manual capture or submission. PR #85's
> `PROVIDER_MODE = "none"` and empty cron are an interim bootstrap state.
> Track D's capture (D1) and submission (D3) leave the production path;
> genesis (D2) stays. Gates AU-0 to AU-8 are added, and A0 and R5 depend on
> them.

> **Product scope of 2.0.0 (owner, 2026-10-21; ADR 0028 D12).** The first
> Google Play release keeps the current public scope: the **full weekend
> schedule**, but **race results only**, published and displayed. Free
> practice, qualifying, sprint qualifying and sprint results are a future
> product update. Nothing in this plan, PR #86, the release notes or the store
> listing may present 2.0.0 as delivering results for every session.
>
> **Race-result polling (ADR 0028 D5).** The first check is the first hourly
> tick at or after the scheduled race start + 90 minutes - the start of
> polling, not evidence that the race has finished. While no valid, complete
> result exists it repeats hourly through + 10 h 30 min, then backs off to
> + 15 h, + 24 h and daily to day 14. Gate AU-3 covers delayed starts,
> unusually long races, missing and partial results, a late Jolpica
> publication and the request budget.

Nothing in this document is authorized by the change that adds it. Every step
marked **[approval]** is a separate owner authorization, given in that order.
Steps marked **[PR]** are reviewable repository changes.

## 1. Release identity (AGENTS.md report)

| Item | Value |
|---|---|
| applicationId | `com.sejuma.gridview` (production flavor; dev/staging add `.dev`/`.staging`) |
| namespace | `com.sejuma.gridview` |
| version | `2.0.0+8`. Play Console's highest registered versionCode is 7 (legacy 1.2.1, confirmed 2026-10-20). |
| Signing files | `android/key.properties` (ignored) → the upload keystore it names. Play App Signing re-signs with the app-signing key. |
| Upload certificate SHA-256 | `98:D7:CC:74:16:2E:50:A3:DB:C5:8E:A0:41:8A:E8:09:C4:1A:D1:0C:6F:09:50:79:93:4E:D6:E7:09:D4:6D:5E`, registered in Play Console and equal to the local keystore |
| App-signing certificate SHA-256 | `98:BD:6C:76:08:20:FE:84:7E:25:D5:73:8A:73:5D:74:20:4E:76:09:5F:0F:73:E9:A7:40:7D:C5:F9:47:C3:B5` |
| Changes that affect update compatibility | **One: the minSdk rises from 21 to 24.** The applicationId and app-signing key are the same, so every device on API 24 or later receives the update. **Devices on API 21–23 (Android 5.0 to 6.0.1) cannot receive 2.0.0.** Existing installs there stay on 1.2.1, which has no working backend. New installs there get 1.2.1 only if versionCode 7 is retained (D-T1, §5); otherwise the app is unavailable to them. Android 7.0 (API 24) remains eligible. |

## 2. Approval gates at a glance

| Gate | Action | Depends on |
|---|---|---|
| W0 | **[done]** Production genesis design and implementation (ADR 0025 O-16 amendment), PR #84, merged 2026-10-20 as `527444b` | — |
| W-P | **[decided 2026-10-20: A, Workers Paid]** The submission path (`submission-path-decision.md`). **Bought 2026-10-21** (AU-1) | W0 |
| W1 | **[done]** The production Worker configuration, without the KV binding: PR #85, merged 2026-10-21 as `65388ba` | W0, W-P |
| W2 | **[done]** The namespace `gridview-snapshots-production` (`d76328b37da343db92d927142c072593`), created 2026-10-22; its id committed by PR #92, merged 2026-10-22 as `09e0686`. The `ADMIN_TOKEN` value was generated in W3 | W1 |
| W3 | **[done 2026-10-22]** First deploy of `gridview-api-production` from `09e0686`, supplying `ADMIN_TOKEN` with `--secrets-file`: version `62bf40e9-426f-40b7-9fc1-44ab4c42999b`, bootstrap configuration (W3 below) | W2 |
| D1 | **Superseded 2026-10-21** (ADR 0028 D3): no capture. Kept only as the manual fallback in `none` mode | — |
| D2 | **[approval]** Run production genesis for season 2026. It waits until the automatic production configuration (AU-7, `automatic-updates.md` §8.4) is deployed | W3, the AU-7 configuration deployed |
| D3 | **Superseded 2026-10-21** (ADR 0028 D3): the first release is published automatically after genesis (AU-7). Kept only as the manual fallback | — |
| AU-0…AU-8 | Automatic updates: code (AU-0), Workers Paid (AU-1), the isolated demonstration Worker (AU-2), **the end-to-end demonstration with controlled data (AU-3)**, live staging automatic (AU-4), monitor schedule (AU-5), alert drill (AU-6), production automatic (AU-7), release-candidate check (AU-8) — `automatic-updates.md` §7 | W1, W-P; AU-7 also D2 and D-A |
| P1 | **[PR]** Privacy policy (covering 1.x and 2.0.0) and Data safety evidence (PR #82) | — |
| P2 | **[approval]** Publish the policy at https://gridview.netlify.app | P1 |
| P0 | **[approval]** Correct the live Data safety form now: state 0 (the 1.x AdMob and Firebase rows), Ads = **Yes** (PR #82 `data-safety.md` §1.3) | P2, P-R (the Alpha build was inspected on 2026-10-22, §5.1 step 2) |
| P3 | **[approval]** Data safety in transition state T, Ads = **Yes** | P2, P-R, W3 and AU-7 verification; before Production rollout R5 |
| A1 | **[PR]** 2.0.0+8 and the production build configuration (this change) | — |
| A0 | **[record]** Release-candidate gate, pre-build part (Implementation Plan §15.8) on the exact merged commit A2 builds | A1, P1, AU-3, every W/D/AU PR merged |
| A0b | **[record]** Signed AAB and artifact checks before upload; Play installation and live performance after rollout starts | Artifact: A2, before R5; live checks: R5 and R3, before R6 |
| A2 | **[approval]** Build and sign the release AAB (uploads the R8 mapping) | A0, A1, P2, AU-7 (production live and holding its first automatic release; D3 is superseded) |
| R1 | **Not used:** no internal tester list (owner decision, 2026-11-05) | — |
| R2 | **Not used:** no internal testing release (owner decision, 2026-11-05) | — |
| R3 | **[record]** Owner checks the Play-delivered upgrade on the live Production release (§8) | R5 and availability to the owner's account; before R6 |
| R4 | **[approval]** Release notes, which describe race results only (ADR 0028 D12); D-T1 **decided 2026-11-05: versionCode 7 is not retained** | P3 |
| R5 | **[approval]** Submit the signed AAB directly to Production and start the planned 20% rollout after Google review | A2, A0, A0b artifact checks, P3, R4, AU-7, AU-8 |
| R6 | **[approval]** Increase to 100% after the owner checks the live update and the monitoring window passes | R5, R3 and live A0b checks |
| R7 | **[approval]** Data safety final state F, Ads = **No**, once no 1.x artifact is distributed on any non-internal track | R6, D-T1, Alpha retired (§5.1) |

## 3. Track W — production Worker

### W0. Production genesis design — PR #84

> **Status 2026-10-20.** The design is written as ADR 0025 D12, "Amendment
> (2026-10-20): production genesis (O-16)", and implemented in **PR #84** (merged 2026-10-20 as `527444b`), with
> no configuration change. The text below the list records the problem as it
> stood. What PR #84 decided differs from the expectations listed there in
> four places:
>
> - The control is `SEASON_PUBLICATION_CUTOVER_CONTROL = "genesis:2026"`, a
>   third phase of the existing control, not a new variable.
> - The season is recorded as `genesis`: authoritative, with no release. It
>   becomes `active` only when the first batch commits.
> - Public season reads answer `503 SNAPSHOT_NOT_READY` until then, and
>   `/v1/status` stays `200` with `currentSeason: null`.
> - Production ingest also requires that `genesis:` control, and the first
>   submission names `expectedActiveVersion: null`
>   (`season-batch:submission --first-release`).

Production cannot publish today, and no configuration change alone fixes it:

- `POST /internal/admin/season/ingest` refuses any environment but staging
  (`environment-not-permitted`, `src/ingest/service.ts`).
- Ingest also needs a sequenced, activated season (`authority-not-sequenced`).
  The only way to reach that state is the D12 cutover, which refuses production
  (`environment-not-staging`, `src/publication/cutover/service.ts`). Its seed
  step also imports an existing legacy KV release, which a new production
  namespace does not have (`active-inventory-empty`).
- Production declares no `SEASON_PUBLICATION_SEQUENCER` binding.

ADR 0025 already records the way forward: **O-16** (curator decision C3)
approves "a separate production genesis design, a sequencer-genesis amendment
to this ADR, only for a season with no earlier release". It is not yet written.
The amendment must decide:

1. **Genesis operation.** A production-only, authenticated operation that
   initializes one season's sequencer as *active with no release*. It is
   permitted only when the season has no legacy KV inventory and no sequencer
   state, and is gated by its own control value (for example
   `SEASON_PUBLICATION_GENESIS = "2026"`). It cannot seed or activate an
   existing release.
2. **First publication.** How the D14–D16 guard and the `prepare` CAS treat
   the first release of a genesis season (no predecessor; the batch submission
   names the empty active version).
3. **Rollback.** A genesis season's first release has no `previousVersion`;
   rollback must refuse rather than fall back to the legacy pointers.
4. **Public reads before the first release.** Expected: the season resources
   are unavailable and `/v1/status` stays healthy; the app shows its empty or
   unavailable states.
5. **Ingest admission.** Admit `production` alongside `staging`, unchanged
   otherwise (attribution `active`, `PROVIDER_MODE` not `coordinated`,
   sequenced authority). This revises the runbook statement "Production never
   ingests".

### W1. Production configuration **[PR]**

> **Status 2026-10-22: merged in PR #85** (`65388ba`, 2026-10-21), not
> deployed. PR #85 committed everything below except the `GRIDVIEW_DATA` KV
> binding, because Wrangler 4.112 creates a new namespace on deploy for a KV
> binding with no `id`. W2 created the namespace and its PR commits the real
> id (W2 below).
> - PR #85 committed persisted Workers Logs **off** as the fail-safe while
>   D-L was open.
> - PR #86 (ADR 0028 D8) then turned them on, with `invocation_logs = false`
>   and production's line restrictions (D-L below).

- *(Done in PR #84: the genesis operation, route and refusals with tests, and
  the `production` ingest admission.)*
- `wrangler.toml` `[env.production]`:
  - `workers_dev = true` and `preview_urls = false`. The API URL is then
    `https://gridview-api-production.sejuma18.workers.dev`, the value committed
    in `config/dart_defines/production.json`. A custom domain would need a
    domain and a change to that file.
  - vars:
    - `ENVIRONMENT = "production"` and `PROVIDER_MODE = "none"`;
    - `PUBLIC_BASE_URL`;
    - `SEASON_PUBLICATION_AUTHORITY = "sequencer"`;
    - `SEASON_BATCH_INGEST = "2026"`;
    - `SEASON_PUBLICATION_CUTOVER_CONTROL = "genesis:2026"`.
  - Both Durable Object bindings, `PROVIDER_RATE_LIMITER` and
    `SEASON_PUBLICATION_SEQUENCER`, with the `[exports.SeasonPublicationSequencer]`
    SQLite entry. Durable Objects on Workers Free must be SQLite-backed, which
    this one is.
  - The sequencer inertness test (`test/publication/sequencer/inertness.test.ts`)
    asserts that production declares no sequencer binding. It must be
    reframed, not deleted, in the same PR.
  - The `GRIDVIEW_DATA` KV binding, with its id added in W2
    (`d76328b37da343db92d927142c072593`).
  - `[env.production.secrets] required = ["ADMIN_TOKEN"]`.
  - `[env.production.triggers] crons = []`.
  - Observability on, with `invocation_logs = false` and no log line that
    records an IP address or a header. This is the condition behind the Data
    safety answer (`data-safety.md` §3.4).
  - **Owner decision D-L: persisted application logs.**
    `invocation_logs = false` does not stop the Worker's own
    `request.completed` lines (route template, request ID, status, duration,
    cache outcome) from persisting in Workers Logs. Either:
    - **keep them**, and declare App interactions with the App functionality
      purpose (PR #82 `data-safety.md` §3.4, R8); or
    - **disable persisted logs** for production
      (`[env.production.observability] enabled = false`).

    **Resolved on the engineering side 2026-10-21 by ADR 0028 D8**, a third
    option: logs persist for automatic operation, but in production the
    Worker writes no `request.completed` line for a public request, keeps
    `request.failed` without the request ID, and logs refused internal paths
    as `/internal/*`. App traffic is not stored, so no App interactions row
    is needed for Worker logs. The owner accepted PR #82's privacy wording
    for it on 2026-10-23 (AU-D3).

### W-P. Cost of genesis and submissions, and the submission path (decision)

**Correction.** An earlier version of this section cited 269 ms, the staging
ingest of 2026-10-14. **The latest staging ingest, on 2026-10-19, used 362 ms
of CPU** on Workers Free (`wrangler tail`: outcome ok, wall time 15.4 s). It
read the active release first, which the 2026-10-14 ingest did not.

**Limits** (Cloudflare docs, read 2026-10-20):

- **Workers Free:** 10 ms CPU per HTTP request. Each isolate has "built-in
  flexibility" for occasional overruns. A Worker that "starts hitting the limit
  consistently" is terminated with error 1102 (`exceededCpu`).
- **Subrequests:** 50 external and 1,000 to Cloudflare services per
  invocation.
- **KV on Free:** 100,000 reads and 1,000 writes per day.
- **Durable Objects on Free:** SQLite-backed only. 100,000 requests and
  100,000 rows written per day, and 13,000 GB-s.

**Measured** on the PR #84 branch, in memory, with the real 2026-10-19
submission body (407,580 B, 117 documents). Node 24 on Windows, timer
resolution 15.6 ms, so single figures are ±16 ms. Nothing contacted Cloudflare.

| Step | Local CPU | Workers estimate |
|---|---|---|
| Genesis request (one admin request, two KV reads, two DO calls), averaged over 300 calls | 0.1–0.4 ms warm; ≤16 ms on the first, cold call | about 1 ms; **fits 10 ms** |
| First batch of a genesis season (no predecessor read) | 93–157 ms warm, 218–251 ms cold | about 250–360 ms |
| Each later batch (reads the active release) | 124–172 ms warm, 219–234 ms cold | **362 ms measured** on staging, 2026-10-19 |
| of which: batch verification | about 65 ms | |
| of which: revision hashing, 117 documents | about 39 ms | |
| of which: generation, contract validation, JSON | about 1 ms each | |

Staging ran about 1.5–2.5 times the local figures. So **each submission costs
25–36 times the Free CPU limit**, and the first one is no exception.

Other budgets fit easily. One release writes about 121 KV keys, so at most
eight releases a day stay within 1,000 writes. One release makes about 260 KV
operations and about 6 DO calls, within the 1,000-subrequest limit.

**Assessment.** Two staging submissions were tolerated (2026-10-14 and
2026-10-19). Cloudflare documents no guarantee for that, so the current
single-request ingest is **not a reliable production path on Free**.

If the CPU limit terminates a submission:

- *Before `finalize`:* the operation expires after 15 minutes. The next
  attempt collects its candidate. Nothing is published.
- *After `finalize`, before the post-commit metadata:* the release is
  committed, but `meta:current-season` may not be written. For a genesis
  season's first release, `/v1/seasons/current` would then stay
  `503 SNAPSHOT_NOT_READY` until the next release. The retry is refused as
  stale, because the release committed.

**Decision W-P: see `submission-path-decision.md`.** It compares the two
reliable candidates:

- **A. Workers Paid, with the existing guarded ingest.** No code change. It
  costs USD 5.00 a month before tax at the assumed usage, and the measured
  362 ms is about 80× below the Paid CPU limit.
- **B. A Free-plan redesign.** The operator verifies and prepares offline,
  writes with `wrangler kv bulk put`, and the Worker only runs the small
  `prepare` and `finalize` steps. That document shows how B would keep
  validation, release visibility, concurrency control, retries and recovery
  after partial writes. **B is not described as reliable**: its CPU budget,
  including the Durable Object side, and its failure handling are untested.

Keeping the single request on Free is listed there only as an explicitly
accepted risk.

**Decided 2026-10-20: A, Workers Paid.** D3 follows Path A. Buying the plan
was a separate owner step: **done 2026-10-21** (AU-1).

> **2026-10-21:** D3 is superseded by automatic publication (ADR 0028), which
> needs Workers Paid for the same reason (O-10). Buying the plan is gate AU-1,
> before AU-2 and before W3.

Public traffic on Free is a separate budget. Each uncached public read is one
Worker request, one Durable Object request and two KV reads, against 100,000
of each per day. The current install base ("100+ downloads") is far below
that, but growth would need monitoring.

### W2. Provisioning **[approval]**, then **[PR]**

Every Worker command in tracks W and D runs from `services/edge-api`, which
holds the `package.json` and `wrangler.toml` they need. The staging runbook
does the same.

```text
cd services/edge-api
npm.cmd exec -- wrangler kv namespace create gridview-snapshots-production --binding GRIDVIEW_DATA
```

Run it **without `--env`**. Wrangler 4.112 titles a namespace
`<env>-<argument>`, so the earlier `GRIDVIEW_DATA --env production` would
have created `production-GRIDVIEW_DATA` instead of following staging's
`gridview-snapshots-staging` and e2e's `gridview-snapshots-e2e`
(`automatic-updates.md` §8.1 step 1). For a TOML configuration Wrangler only
prints a snippet and edits nothing. In Git Bash, `npx wrangler …` is the same.

> **Step 1 done 2026-10-22T19:46:08Z** (owner-authorized, run once): namespace
> `gridview-snapshots-production`, id `d76328b37da343db92d927142c072593`,
> empty. Before and after, Wrangler used account `786e24f1…e6bf`; the staging
> and e2e namespaces were unchanged and no production Worker existed.

Commit the returned KV id to `[env.production]` as `[[env.production.kv_namespaces]]`
with `binding = "GRIDVIEW_DATA"`. The PR replaces the `kv_namespaces`
`toEqual([])` assertion in `test/config/production-worker-config.test.ts`
with one that pins exactly this binding, an id different from staging's and
e2e's that appears once. Validate with `npm run validate:worker-config` and a
`wrangler deploy --dry-run --env production`.

The W2 PR keeps production's **bootstrap configuration**:
`PROVIDER_MODE = "none"`, no reconciliation ledger, `crons = []`. The
coordinated (automatic-updates) production configuration is the later gate
AU-7 (`automatic-updates.md` §8.4), its own PR and approvals.

**Do not run `wrangler secret put ADMIN_TOKEN --env production` here.** For a
Worker that does not exist yet, Wrangler 4.112 first creates one, uploading a
placeholder script (`export default { fetch() {} }`), and confirms by default
in non-interactive use. That would be an unreviewed first deployment. Generate
the new value now and store it as staging's is stored (DPAPI, never printed).
It is uploaded with the first deploy in W3.

### W3. Deploy **[approval]**

> **Status 2026-10-22: deployed** under the owner's authorization, from
> `09e0686`.
> - Version **`62bf40e9-426f-40b7-9fc1-44ab4c42999b`**, deployed
>   2026-10-22.
> - Bootstrap configuration: `PROVIDER_MODE = "none"`, the production KV
>   namespace bound and empty, no reconciliation ledger, `crons = []`, and
>   no genesis or season data.
> - The checks below passed. `/v1/status` returned `200`; the season
>   resources answered `404 SEASON_NOT_FOUND`, and `/v1/seasons/current`
>   answered `503 SNAPSHOT_NOT_READY`. The deployed settings show logs
>   persisted with `invocation_logs = false`. The dashboard's Workers Logs
>   held no event for the public requests sent after the deploy.
> - **Agreed sequence:** W3 was deployed now, with the bootstrap
>   configuration. D2 waits until the later automatic production
>   configuration (AU-7, `automatic-updates.md` §8.4) is deployed. That
>   deploy replaces this version; it is not a first deploy, so it needs no
>   `--secrets-file`.

The first deploy supplies the required secret. Without one, Wrangler refuses
because `[env.production.secrets] required = ["ADMIN_TOKEN"]`.

```text
cd services/edge-api
npx wrangler deploy --env production --secrets-file <file outside the repository>
```

The file holds one line, `ADMIN_TOKEN=<value>`. It is written from the
DPAPI-stored value just before the deploy, and deleted right after. Later
deploys need no file: Wrangler binds a required secret that is already set
as inherited.

Verify:
- `GET /v1/status` returns `200` with `environment=production` and `maintenance=false`.
- The season resources are unavailable, as W0 item 4 expects.
- **Persisted Workers Logs match ADR 0028 D8**, which resolves D-L. This is
  the premise of P3 (PR #82 `data-safety.md` §3.4). `wrangler tail` cannot
  prove it: it is a real-time stream, carries request metadata itself, and
  stores nothing.
  - The deployed version's configuration has `invocation_logs = false`.
    Check `npx wrangler versions view <version-id> --env production` or the
    dashboard's Observability settings.
  - Send a few public requests, then query the Workers Logs dataset in the
    dashboard (Observability → Logs) for that window. Expect no invocation
    record and no line for those requests: production writes no
    `request.completed` line for a public request.

Record the deployed version id.

## 4. Track D — reviewed data publication

> **Superseded for production on 2026-10-21 by automatic updates** (ADR 0028;
> `automatic-updates.md` §8.4). Production runs genesis (D2) and then publishes
> its first and every later release automatically. D1, D3 and the recurring
> submissions below remain only as the **manual fallback** with
> `PROVIDER_MODE = "none"`, and are not a release step. The text is kept as
> written.

1. **D1 [approval]: capture and review.** Two separate steps.
   - **Capture (network).** Record one Jolpica capture: about 23 `GET`s, in
     the format of `services/edge-api/scripts/season-batch/README.md`,
     "Capture format", as on 2026-10-13 and 2026-10-19.
     - No capture tool is in this repository; the generator README says so.
     - The operator used the private script `~/.gridview/frozen/<date>/scripts/capture.sh`.
     - Committing a capture tool is open decision D-C (§9).
   - **Generate (offline).** From `services/edge-api`, run
     `npm run season-batch:generate -- --capture <capture-dir> --out <new-output-dir>`.
     - It replays the capture and sends no request.
     - Both directories must be outside the repository.
   - Review `manifest.json` and record its SHA-256, as in the staging captures.
   **Admin authentication for D2 and D3.** Every `/internal/admin/...`
   request, GET or POST, is refused with 401 unless it sends
   `Authorization: Bearer <production ADMIN_TOKEN>`. Use the staging
   runbook's secret-safe pattern (§6, standings-predecessor gate), with the
   production host and a separate variable:

   ```powershell
   $env:GRIDVIEW_PRODUCTION_ADMIN_TOKEN = Read-Host "Production admin token"  # not echoed or logged
   $base = "https://gridview-api-production.sejuma18.workers.dev"
   $headers = @{ Authorization = "Bearer $env:GRIDVIEW_PRODUCTION_ADMIN_TOKEN" }
   try {
     # one request per approved step, for example:
     $r = Invoke-WebRequest -Uri "$base/internal/admin/publication/cutover/status?season=2026" -Method Get -Headers $headers -UseBasicParsing
     "$($r.StatusCode) $($r.Content)"
   } finally {
     Remove-Item Env:\GRIDVIEW_PRODUCTION_ADMIN_TOKEN
   }
   ```

   - For a POST, add `-Method Post -ContentType "application/json" -Body
     $json`. For D3 on Path A, use `-InFile <submission file>`, which keeps the
     batch body off the command line.
   - The token is never placed in a URL or a file inside the repository, and
     never printed.

2. **D2 [approval]: genesis.** Authenticate each request as above.
   - Send one `POST /internal/admin/publication/cutover/genesis` with
     `{season: 2026, genesisIdentity, confirmGenesis: true}` and the production
     `ADMIN_TOKEN`.
   - Confirm that `GET /internal/admin/publication/cutover/status?season=2026`
     reports `state: genesis` with no active version.
   - Confirm that `/v1/seasons/2026` answers `503 SNAPSHOT_NOT_READY`.
   - A lost answer is safe to retry with the same identity.
3. **D3 [approval]: submit.** The procedure depends on the path W-P chose.
   Every path publishes the first release against the empty predecessor, so
   a retry after a commit is refused as `guard-predecessor-stale`.
   - **Path A, Workers Paid** (`submission-path-decision.md` §3).
     - From `services/edge-api`, run
       `npm run season-batch:submission -- … --first-release`.
     - Send one `POST /internal/admin/season/ingest` whose body carries
       `"expectedActiveVersion": null`.
   - **Path B, the Free-plan redesign** (§4 there).
     - Only once its PR has merged and its §4.7 tests and measurements have
       passed.
     - Follow that PR's procedure: `prepare` naming no active release, then
       `wrangler kv bulk put` of the documents baked offline, with read-back,
       then `finalize`, then the metadata request.
     - Never use `/internal/admin/season/ingest` on Free.
   - **The single request on Free**, only if the owner explicitly accepts the
     risk.
     - Use the same command and request as Path A.
     - It may end with error 1102. If that happens after the commit, the
       current-season pointer may be missing until the next release.
   - Expect `applied`.
   - Verify:
     - the public documents equal the batch, apart from the publish-time
       freshness stamps;
     - `/v1/status`;
     - `attributionVersion = data-sources-v2`.
4. **Ongoing operations.** Production data then changes only through this
   reviewed path.
   - Each later race weekend of 2026 needs a capture and review (as D1) and a
     **recurring submission**, which is not D3's first-release procedure.
     `--first-release` and `"expectedActiveVersion": null` are for the first
     release of a `genesis` season only; once a release is active, they are
     refused as `guard-predecessor-stale`. For every later batch:
     - before building the body, read the active release (authenticated
       `GET /internal/admin/publication/cutover/status?season=2026`), record
       its `activeVersion`, and stop if an operation is prepared;
     - review the batch against that release, then build the body with
       `npm run season-batch:submission -- --batch <batch-dir> --manifest-sha256 <reviewed-hex> --expected-active-version <activeVersion> --out <file>`;
     - send it once to `POST /internal/admin/season/ingest` and expect
       `applied` with `previousVersion` equal to the recorded version;
     - on `guard-predecessor-stale`, read the status again: if the active
       release is the one just submitted, stop; otherwise review again
       against the new release.

     This is the staging runbook's procedure (section 6, "Guarded
     season-batch ingest"), run against production.
   - The calendar-horizon freshness policy tells the app when its data is
     due.
   - Season 2027 needs its curated event, circuit and participant datasets
     before its first batch.
   - This is an owner commitment for as long as the app is live.

## 5. Track P — privacy and store declarations

**The transition between 1.2.1 and 2.0.0.** Play's Data safety form describes
"the sum ... across all its versions currently distributed on Google Play",
closed and open tracks included. 1.2.1 shows Google AdMob ads with no consent
message, and 1.x builds stay distributed in any of these cases:

- during a staged rollout below 100%;
- if versionCode 7 is retained for API 21–23.

Closed Alpha (versionCode 2) was paused on 2026-11-05 (§5.1).

The details are in PR #82, `data-safety.md` §1.

- **P1 [PR]:** PR #82 contains:
  - the policy (`privacy_policies.md`/`.html`), which covers 1.x in section 3.4
    and 2.0.0 everywhere else;
  - `docs/release/data-safety.md`.

  Its review items (data-safety R1–R9) need the owner's privacy review, P-R,
  before **any** Data safety submission (P0, P3, R7). **No external review
  is planned (owner, 2026-11-05):** P-R is the owner's decision on each open
  item, on the evidence and official guidance in PR #82 `privacy-self-assessment.md`.
  None of those items is settled by that change. Data-safety item R7 is
  the controller naming. The owner confirmed it on 2026-10-20: Sergio Arenas
  del Amo, an individual in Ireland, publishing as Sejuma, with no registered
  business. The Play listing still shows Spain (PR #82 `data-safety.md` §6).
  **Recorded 2026-11-05:** Ireland is the intended country for the Play
  listing. Changing it is a separate Play Console step, not done.
- **P2 [approval]:** publish `privacy_policies.html` at https://gridview.netlify.app,
  the URL already on the listing and in `config/dart_defines/production.json`.
  - It must be live before P3 and A2.
  - Publish only the version that covers 1.x. A 2.0.0-only text must never
    replace the live page while 1.x is distributed.
- **P3 precondition.** W3 verified the deployed Worker logging settings and
  the absence of logs for the ordinary public requests tested. AU-7 repeats
  that check on its deployed version. The draft makes no blanket claim
  that Cloudflare's IP processing is ephemeral and no assertion about
  metadata on an unobserved error. The owner declined a separate error
  test (`privacy-self-assessment.md` Q2 and Q3).
- **P0 [approval]:** in Play Console, correct the live form now to **state
  0**: the 1.x rows only (AdMob and Firebase Cloud Messaging), with Ads
  **Yes**. The live "No data collected" is already inaccurate for 1.2.1.
  State 0 does not depend on 2.0.0 or on the production Worker.
- **P3 [approval]:** submit Data safety in **state T**: the 2.0.0 Firebase
  rows plus the 1.x rows (AdMob and Firebase Cloud Messaging), with Ads
  **Yes**.
  - Submit before the first Production rollout (R5). No testing-track
    submission is planned for 2.0.0. Keep the 1.x disclosures until no 1.x
    artifact is distributed on a non-internal track.
  - Apply the draft scopes for Cloudflare IP processing and technical error
    logs (`privacy-self-assessment.md` Q2 and Q3); the existing W3/AU-7
    deployment check still applies. No separate error test is planned.
- **R4 [approval]:**
  - English and Spanish release notes. They name race results only, never
    practice, qualifying or sprint results (ADR 0028 D12).
  - **D-T1, decided by the owner on 2026-11-05:** versionCode 7 is not
    retained for API 21–23. The legacy backend is dead, so 1.2.1 shows ads
    but no data. Installed 1.2.1 copies there stay as they are (policy
    section 3.4), and new installs there are no longer offered (§1).

### 5.1 Retiring the old Alpha artefact (versionCode 2)

This is a separate plan, not a test stage: 2.0.0 is **not** promoted to the
Alpha track.

Facts (Play Console Help, *Set up an open, closed, or internal test*, read
2026-10-20):

- **Ending a test.** "Manage track", then the **Pause track** button. After
  that, "testers do not receive updates, but the app will remain installed on
  their device."
- **Superseded tracks.** When every bundle on a track is outranked by a higher
  versionCode on the fallback track, the track is **Superseded**: "None of the
  app bundles on the track serve users, as all users receive an app bundle
  from the fallback track." The owner's Play Console screenshots initially
  showed Alpha as active, then paused and inactive after the owner paused it
  on 2026-11-05 (steps 1, 3 and 4).

Steps (each owner-run; only step 3 changes Play Console):

1. **Read the Alpha track's status** in Play Console, read-only: Superseded,
   Active or Paused. Record it. **Done 2026-11-05 from the owner's
   screenshots:** active, 1.0.0 (versionCode 2) available to selected
   testers; Production shows 1.2.1 (versionCode 7) available on Google
   Play (PR #82 `data-safety.md` §1.2).
2. **Settle what versionCode 2 contains: done 2026-10-22.** It was
   downloaded read-only from the App bundle explorer. It is 1.0.0, with the
   same Google Mobile Ads and Firebase SDKs as versionCode 7 and no Unity Ads
   (PR #82 `data-safety.md` §3.5, §1.4 step 0).
3. **Pause the Alpha track: done by the owner on 2026-11-05** (D-T2).
4. **Verify:** the owner's follow-up screenshot on 2026-11-05 shows the
   paused banner and Inactive track summary. The release card still lists
   1.0.0 with its tester-availability label. Before R7, verify that no other
   open or closed track is distributing versionCode 1–7.
5. Existing Alpha installs keep whatever they have (Play says so). They are
   covered by the policy's 1.x section, which stays published (PR #82 policy
   §9).

Pausing the track, or any other Play step, stops **distribution** only. It
does not stop 1.x copies that are already installed from requesting ads. They
keep requesting them until the device updates to 2.0.0 or the app is
uninstalled. Stopping ad serving to them is a separate AdMob step: D-A,
archiving the 1.x ad units listed in PR #82 `data-safety.md` §3.6. The
2026-11-04 inspection found seven active, all versionCode 7's; versionCode
2's extra unit was already retired. On 2026-11-05 the owner removed all
seven remaining units and provided a screenshot confirming the removal.

Not used: promoting 2.0.0 to Alpha to replace versionCode 2. That would make a
closed test of 2.0.0, which §7 does not need.
- **R7 [approval]:** after R6 (100%), and once no 1.x artifact is distributed
  on any non-internal track, submit Data safety in **state F** and set App
  content → Ads → **No**. This removes "Contains ads".

## 6. Track A — release candidate

**A1 [PR] (this change):**
- `pubspec.yaml` → `2.0.0+8`.
- `config/dart_defines/production.json` is the only define source for release
  builds. `test/release/production_defines_test.dart` keeps it a production,
  HTTPS, non-staging configuration (Implementation Plan §15.6).

**16 KB page size: verified 2026-10-20** on a production-flavor profile APK built
at `6aefcbf` with NDK 27.0.12077973:
- every native library (`libapp`, `libflutter`, `libsqlite3`, `libdartjni` and
  `libdatastore_shared_counter`, for arm64-v8a, armeabi-v7a and x86_64) has
  ELF `LOAD` alignment of 16 KB or 64 KB;
- the libraries are stored uncompressed;
- `zipalign -c -P 16 -v 4` passes.

No NDK change is needed for 16 KB. A2 re-checks the release AAB, and Play's
bundle explorer shows the result after upload.

**A0 and A0b [record]: release-candidate gate.** Implementation Plan §15.8
lists what the candidate must pass. Record each item against the **exact
merged commit** A2 builds, never a branch head or an older run.

- **A0 (before A2):** every item that does not need the AAB.
- **A0b:** verify the signed production AAB before R5. Record the Play
  installation and live performance after R5, before increasing to 100%
  at R6. This release-specific sequence supersedes the internal-installation
  and testing-track steps in Implementation Plan §§15.8 and 16.2.

| §15.8 item | Part | Evidence for that commit |
|---|---|---|
| Formatting and static analysis; unit, widget, database and migration tests; golden tests | A0 | The green `Flutter quality gates` CI run on that commit (`flutter analyze`, format, the full `flutter test`) |
| Backend and contract tests | A0 | The green `Edge API quality gates` and `Canonical golden freshness` runs (typecheck, lint, format, the full vitest suite, `npm run validate`) |
| Integration tests | A0 | The same edge suite's Worker-level tests. Any Flutter integration test is run locally on that commit and recorded. |
| Production AAB build and artifact checks | A0b, before R5 | A2 and artifact checks below |
| Production Play installation | A0b, before R6 | The owner's live upgrade check (R3) |
| Performance targets | A0b | The Performance traces from R3's controlled upgrade against the targets in Implementation Plan §15.4 |
| Security review | A0 | CodeQL and the secret scan green on that commit, plus a recorded review of the release diff |
| Privacy review | A0 | Every open privacy item in PR #82 `privacy-self-assessment.md` §5 (R2 scope, R6, R8 API lines, R9 as Q1a-Q1c, §6.1, Q6) decided by the owner and recorded in `data-safety.md` §4.1. **No external review is planned (owner, 2026-11-05)**; an item still open blocks A2 |
| Provider legal gate | A0 | ADR 0019 and Implementation Plan §14.2, re-confirmed for automatic publication of race results (ADR 0028 D11, D12); Jolpica's terms and rate limits re-read from its public repository, without contacting the API |

A failing, missing or stale A0 item blocks A2. A failing artifact check
blocks R5; a failing or missing live A0b check blocks R6.

**A2 [approval]: build and sign.** Run from a clean checkout of the merged
commit, in PowerShell, with the API live and holding data (W3, D2, then the
first automatic release of AU-7; D3 is superseded) and the
policy published (P2):

```text
$env:ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping = "true"
flutter build appbundle --release --flavor production --dart-define-from-file=config/dart_defines/production.json
Remove-Item Env:ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping
```

The variable authorizes the Crashlytics mapping upload for this one
invocation, as `play-store-baseline.md` requires. Keep the Gradle output as the
upload record.

**Use a fresh clone or a new worktree, never the everyday checkout.** On
2026-11-04 a production profile build in the everyday checkout packaged a
stale `libapp.so` from 2026-10-20, with no API URL in it. Gradle's
`merged_jni_libs` and `stripped_native_libs` outputs kept the old library,
and the fresh Dart snapshot stopped at `intermediates/flutter/…/jniLibs`. The
same build from a new worktree of the same commit was correct. Only the
endpoint check below caught the difference. A2 does not proceed unless
every check below passes. The offline kit's `verify-aab.py`
(`~/.gridview/evidence/release-candidate-offline-kit-2026-11-04/`) runs them
all.

Artifact checks before upload:
- **Identity:** versionCode 8, versionName 2.0.0, `com.sejuma.gridview`,
  target 36, min 24, not debuggable.
- **Signer:** the upload certificate above.
- **16 KB:** checked over `bundletool build-apks`.
- **Endpoint:** the production URL is present in `libapp.so`, and no
  `staging` host is.
- **Permissions:** only those listed in `data-safety.md` §2.
- **Hash:** record the AAB's SHA-256.

## 7. Track R — Google Play

**Owner decision, 2026-11-05:** no tester list or testing-track release for
2.0.0. R1 and R2 are not used. Submit the signed AAB directly to Production.
This does not start a release or change the planned staged percentages.

1. **R4 [approval].** Prepare the store declarations and release notes (§5).
2. **R5 [approval].** Create the Production release with the verified A2 AAB,
   submit it for Google review, and start the staged rollout at **20%**.
3. **R3 [record].** The owner checks the live Play-delivered upgrade (§8)
   once the update is offered to their account. Do not increase the rollout
   before this check; a staged rollout may not reach that account immediately.

4. **R6 [approval].** Increase to 100 % once the monitoring window passes.
   - **Window:** at least 48 hours, or a race weekend.
   - **Pass criteria** (the Implementation Plan §16.3 signals that apply to
     2.0.0):
     - **crash-free users** for 2.0.0 (8) at least as high as 1.2.1's in
       Android vitals, and no new fatal in Crashlytics;
     - no ANR cluster in Android vitals;
     - **startup traces** (Performance `_app_start`) within the §15.4 target
       and not regressed against R3's controlled upgrade;
     - **API errors:** non-fatal network or sync failures in Crashlytics, and
       5xx responses in the production Workers metrics, with no sustained
       rise over the first 24 hours of the rollout. A healthy `/v1/status` is
       necessary but not sufficient;
     - **snapshot age:** `/v1/status` `snapshotAgeSeconds` consistent with
       the last reviewed batch;
     - **image failures:** no new image-loading non-fatal cluster;
     - **migration failures:** no preference-migration non-fatal
       (`feature=settings`) cluster;
     - **store reviews:** no new review reporting lost settings, missing data
       or crashes;
     - no ingest needed outside the reviewed path.
     - Provider quota and ad initialization do not apply: production has no
       provider mode, and 2.0.0 has no ads.
   - **Halt criteria:** any of the above failing. Halt the rollout in Play
     Console. Play cannot lower a versionCode, so the fix ships forward as
     2.0.1 (9).

If the owner does not receive the staged update immediately, keep the rollout
at its initial percentage until the check is possible. Do not create an
internal or closed track. The old Alpha track is already paused (§5.1).

## 8. The upgrade check (R3): one controlled, Play-delivered upgrade

One device, one pass, about 30 minutes, on the exact AAB released in R5,
delivered by Google Play from the live Production rollout.

**Preconditions:**
- A Play Store device on **API 36** (the current Android version, a matrix
  row), with 4 KB memory pages, signed in with the owner's ordinary Play account.
- GridView **1.2.1 installed from Play production**, with Spanish and dark
  mode chosen in 1.2.1. 1.2.1's own backend no longer answers, so its cache
  stays empty, which 2.0.0 never reads anyway.
- The 2.0.0 update is visible for that account in the public Play listing.

**Steps:**

1. **Before:**
   - `dumpsys package com.sejuma.gridview` shows versionCode 7 and installer
     `com.android.vending`;
   - `apksigner verify --print-certs` on the pulled base APK shows the
     app-signing certificate.
2. Update from the public Google Play listing when 2.0.0 is offered.
   **Do not open the app.**
3. **After the update** (still unopened):
   - versionCode 8 and installer `com.android.vending`;
   - the **same** signer certificate.
4. **First launch offline.** Turn on airplane mode and do the first 2.0.0
   launch:
   - no crash;
   - the UI is in Spanish and dark, because the migration needs no network;
   - Home shows its bounded unavailable or empty state.

   Force-stop and turn airplane mode off.
5. **Cold launch online:**
   - the UI is in Spanish and dark (the 1.x choices migrated);
   - Home shows production season-2026 data, with no "Sample data" banner;
   - Settings shows 2.0.0, and the privacy-policy link opens the published
     policy.
6. **Relaunch** (force-stop, then launch):
   - the state is unchanged;
   - switch the theme to light and relaunch: light persists.
7. Relaunch in airplane mode: cached content renders.
8. After 30 minutes, Crashlytics shows no fatal or non-fatal for 2.0.0 (8),
   and `gv_sync_run` appears in Performance.

**Pass:** record the live result before R6. **Fail:** halt the staged
rollout, record the failure, and fix forward with a new versionCode.

**Coverage:** R3 is the owner's live check, not a testing-track phase.
The automated legacy-cache and migration checks remain part of the
release-candidate verification. No extra Play testing track is required.

This check does not prove that the 1.x Hive files were deleted. A Play build is
not debuggable, so they cannot be inspected; the unit tests cover the cleanup
(`GridView_Legacy_Migration.md` §4).

## 9. Open decisions

| # | Decision | Needed before |
|---|---|---|
| W0 | Production genesis design (ADR 0025 O-16 amendment): **done**, PR #84 merged as `527444b` | — |
| W-P | Submission path (`submission-path-decision.md`): **decided 2026-10-20, A, Workers Paid** (USD 5/month before tax, existing ingest). **Bought 2026-10-21** (AU-1; Workers Paid is the current plan of the Wrangler account) | — |
| D-T1 | Retain versionCode 7 for API 21–23 or not. **Decided by the owner on 2026-11-05: not retained** (§5, R4). The release step itself is separate | R4, R7 |
| D-T2 | Retire the Alpha artefact (versionCode 2) by pausing the track (§5.1). Promoting 2.0.0 to Alpha is not planned. **Done by the owner on 2026-11-05.** Play Console shows the track paused and inactive | R7 |
| D-A | **Done by the owner on 2026-11-05.** AdMob confirmed that the seven remaining GridView ad units were removed. The eighth known unit was already retired. This disables serving for those units without removing the advertising SDK from installed copies (PR #82 `data-safety.md` §3.6) | AU-7 |
| D-DEL | Add an in-app control that deletes the installation's Firebase data (`FirebaseInstallations.delete()`), or not. **Decided by the owner on 2026-10-23: no control.** 2.0.0 keeps its current functionality, Data safety answers **No** to deletion requests, and the policy says no verified procedure exists and one installation's data cannot be found or deleted (PR #82 `data-safety.md` R3). The remaining privacy obligations stay with P-R | — |
| D-R | **Owner decision 2026-11-05:** direct Production submission, without internal or closed testing or a tester list. The owner verifies the Play-delivered update on the live rollout (§§7–8) | R5, R6 |
| D-C | Commit a reviewed Jolpica capture tool to the repository, or keep the private operator script | D1 |
| D-L | Production persisted application logs. **Engineering resolved 2026-10-21 by ADR 0028 D8:** persisted, invocation logs off, no public-request line and no client data or credential stored. The privacy wording was accepted by the owner on 2026-10-23 (AU-D3, PR #82) | — |
| D-U | The previously agreed automated legacy-cache coverage remains. The owner moved the Play-delivered check to the live Production rollout and removed the prerelease testing-track gate on 2026-11-05 (§8) | R3, R6 |
| W-D | API host: `*.workers.dev` (committed) or a custom domain | A2 |
| P-R | Privacy review of PR #82 `data-safety.md` (see `privacy-self-assessment.md` §5). **Draft work recorded:** the owner accepted the 1.2.1 Firebase collection purpose, declined additional error-log tests, paused Alpha, confirmed the Play non-trader status and removed the seven remaining AdMob units. The policy draft reflects these facts. **No external review is planned.** The legacy registration basis, the remaining legacy-processing and address questions, and the limits of Cloudflare processing remain documented. Draft completion is not approval to publish the policy or submit a declaration | P0 |
| S-0 | 2.0.0 keeps Firebase Crashlytics and Performance Monitoring and ships no push notifications (no Messaging SDK; the build's dependency check forbids it). **Decided by the owner on 2026-11-05** | — |
| M | Ship 2.0.0 with placeholder media (no approved media). **Decided by the owner on 2026-11-05:** ship with placeholder images if approved images are not ready | R5 |
| O | **Changed 2026-10-21:** nobody runs D1/D3 each race weekend (automatic). Who answers alerts and staged corrections (ADR 0028 D6, D9), and the 2027 dataset work. **Decided by the owner on 2026-11-05:** the owner handles the alerts and the staged corrections that need a decision, through GitHub e-mail alerts (AU-D4), and their delivery is verified before they are relied on. The 2027 dataset work is not part of this decision and stays open | R5 |
| AU-D1, AU-D5 | **Accepted by the owner for 2.0.0 on 2026-10-21, including their documented limitations** (ADR 0028 D13; `automatic-updates.md` §9): AU-D1, O-5(a), a staged correction freezes the season until an operator acts; AU-D5, a first race result inside the window is seen twice before it is published, which reduces but does not remove the risk of a short classification shown as "Final". The acceptance authorises no merge, purchase, provisioning, deployment or activation | — |
| AU-D2…AU-D4 | D-A before AU-7 and the privacy wording for Worker logs: **both accepted by the owner on 2026-10-23** (AU-D2, AU-D3). The alert channel (AU-D4): **GitHub e-mail, accepted by the owner on 2026-11-05**, with delivery verified before the alerts are relied on (`automatic-updates.md` §9) | AU-7 |
