# GridView 2.0.0 — production release plan

Prepared 2026-10-20 at `6aefcbf`. This plan takes the reconstruction from its
current state (staging only, production never deployed) to a staged Google Play
production rollout of **2.0.0 (versionCode 8)** as an update to the existing
`com.sejuma.gridview` listing.

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
| W-P | **[decision]** The submission path: Workers Paid or the Free-plan redesign (`submission-path-decision.md`) | W0 |
| W1 | **[PR]** The production Worker configuration, plus whatever W-P requires | W0, W-P |
| W2 | **[approval]** Create the production KV namespace and `ADMIN_TOKEN` secret; **[PR]** commit the KV id | W1 |
| W3 | **[approval]** Deploy `gridview-api-production` | W2 |
| D1 | **[approval]** Capture and review the season-2026 batch | W3 |
| D2 | **[approval]** Run production genesis for season 2026 | W3 |
| D3 | **[approval]** Submit the reviewed batch to production | D1, D2 |
| P1 | **[PR]** Privacy policy (covering 1.x and 2.0.0) and Data safety evidence (PR #82) | — |
| P2 | **[approval]** Publish the policy at https://gridview.netlify.app | P1 |
| P0 | **[approval]** Correct the live Data safety form now: state 0 (1.x AdMob rows), Ads = **Yes** (PR #82 `data-safety.md` §1.3) | P2, P-R, §5.1 step 2 or step 3 (Alpha inspected or paused) |
| P3 | **[approval]** Data safety in transition state T, Ads = **Yes** | P2, W3 (production logging verified off in persisted Workers Logs); before R2 |
| A1 | **[PR]** 2.0.0+8 and the production build configuration (this change) | — |
| A0 | **[record]** Release-candidate gate, pre-build part (Implementation Plan §15.8) on the exact merged commit A2 builds | A1, P1, D3, every W/D PR merged |
| A0b | **[record]** Release-candidate gate, post-build part: the AAB, the internal installation and performance | A2, R2, R3 |
| A2 | **[approval]** Build and sign the release AAB (uploads the R8 mapping) | A0, A1, D3, P2 |
| R1 | **[approval]** Play Console: dedicated upgrade-check tester list on internal testing | — |
| R2 | **[approval]** Upload the AAB to internal testing and release it | A2, R1, P3 |
| R3 | **[approval]** The controlled upgrade (§8): one Play-delivered upgrade of the final candidate, plus the owner's approval (D-U) of the replacements for the matrix rows one pass cannot cover | R2 |
| R4 | **[approval]** Release notes; decide D-T1 (retain versionCode 7 or not) | P3 |
| R5 | **[approval]** Promote the same release to production at 20 % | R3, R4, A0, A0b (every §15.8 item recorded as passed) |
| R6 | **[approval]** Increase to 100 % after the monitoring window | R5 |
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
  - The `GRIDVIEW_DATA` KV binding, with its id added in W2.
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
accepted risk. The plan does not assume Paid; buying it is an owner step.

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
npx wrangler kv namespace create GRIDVIEW_DATA --env production
npx wrangler secret put ADMIN_TOKEN --env production   # new value, stored like staging's (DPAPI), never printed
```

Commit the returned KV id to `[env.production]` and validate with
`npm run validate:worker-config` and a `wrangler deploy --dry-run --env production`.

### W3. Deploy **[approval]**

```text
cd services/edge-api
npx wrangler deploy --env production
```

Verify:
- `GET /v1/status` returns `200` with `environment=production` and `maintenance=false`.
- The season resources are unavailable, as W0 item 4 expects.
- **Production logging is off in persisted Workers Logs.** This is the
  premise of P3. `wrangler tail` cannot prove it: it is a real-time stream,
  carries request metadata itself, and stores nothing.
  - The deployed version's configuration shows observability with
    `invocation_logs = false`. Check `npx wrangler versions view <version-id>
    --env production` or the dashboard's Observability settings.
  - Send a few public requests, then query the Workers Logs dataset in the
    dashboard (Observability → Logs) for that window. It holds no invocation
    record with request metadata, and no application line with an IP address
    or a header.

Record the deployed version id.

## 4. Track D — reviewed data publication

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
   - Each later race weekend of 2026 needs a capture and a submission (D1 and
     D3). The calendar-horizon freshness policy tells the app when its data is
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
- if versionCode 7 is retained for API 21–23;
- while the closed "Alpha" track serves versionCode 2.

The details are in PR #82, `data-safety.md` §1.

- **P1 [PR]:** PR #82 contains:
  - the policy (`privacy_policies.md`/`.html`), which covers 1.x in section 3.4
    and 2.0.0 everywhere else;
  - `docs/release/data-safety.md`.

  Its review items (data-safety R1–R8) need the owner's privacy review, P-R,
  before **any** Data safety submission (P0, P3, R7). Data-safety item R7 is
  the controller
  naming: the policy now names the individual the Play listing shows,
  publishing as Sejuma, in Spain.
- **P2 [approval]:** publish `privacy_policies.html` at https://gridview.netlify.app,
  the URL already on the listing and in `config/dart_defines/production.json`.
  - It must be live before P3 and A2.
  - Publish only the version that covers 1.x. A 2.0.0-only text must never
    replace the live page while 1.x is distributed.
- **P3 precondition.** The Data safety answer that API traffic is processed
  ephemerally (`data-safety.md` §3.4, data-safety review item R2) holds only once production logging is
  off. W1 must commit `invocation_logs = false` for `[env.production]`, and W3
  must verify it on the deployed Worker, before P3 is submitted.
- **P0 [approval]:** in Play Console, correct the live form now to **state
  0**: the 1.x AdMob rows only, with Ads **Yes**. The live "No data collected"
  is already inaccurate for 1.2.1. State 0 does not depend on 2.0.0 or on the
  production Worker.
- **P3 [approval]:** submit Data safety in **state T**: the 2.0.0 Firebase
  rows plus the 1.x AdMob rows, with Ads **Yes**.
  - Play counts closed, open and production tracks, and exempts only apps that
    are active exclusively on internal testing. GridView is not internal-only,
    so this plan takes the conservative reading and submits state T before
    the internal upload (R2), not just before production (R5).
- **R4 [approval]:**
  - English and Spanish release notes.
  - **D-T1:** do not retain versionCode 7 for API 21–23 (recommended). The
    legacy backend is dead, so 1.2.1 shows ads but no data.

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
  from the fallback track." versionCode 2 is below production's versionCode 7,
  so the Alpha track is probably Superseded already. That has not been read in
  the Console.

Steps (each owner-run; only step 3 changes Play Console):

1. **Read the Alpha track's status** in Play Console, read-only: Superseded,
   Active or Paused. Record it.
2. **Settle what versionCode 2 contains** before any declaration relies on it.
   Either inspect it in the App bundle explorer against PR #82
   `data-safety.md` §3.5, or skip the inspection because step 3 runs first.
   This is PR #82 §1.4 step 0.
3. **Pause the Alpha track** (Manage track → Pause track). This ends the
   test whatever step 1 found. It must happen before P0 if versionCode 2 was
   not inspected, and in any case before R7.
4. **Verify:** the track shows Paused, and no release on any closed or open
   track names versionCode 1–7.
5. Existing Alpha installs keep whatever they have (Play says so). They are
   covered by the policy's 1.x section, which stays published (PR #82 policy
   §9).

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
- **A0b (after R3, before R5):** the three items that do: the production AAB
  build, the internal installation and the performance targets.

| §15.8 item | Part | Evidence for that commit |
|---|---|---|
| Formatting and static analysis; unit, widget, database and migration tests; golden tests | A0 | The green `Flutter quality gates` CI run on that commit (`flutter analyze`, format, the full `flutter test`) |
| Backend and contract tests | A0 | The green `Edge API quality gates` and `Canonical golden freshness` runs (typecheck, lint, format, the full vitest suite, `npm run validate`) |
| Integration tests | A0 | The same edge suite's Worker-level tests. Any Flutter integration test is run locally on that commit and recorded. |
| Production AAB build; internal Play installation | A0b | A2 and R2 |
| Performance targets | A0b | The Performance traces from R3's controlled upgrade against the targets in Implementation Plan §15.4 |
| Security review | A0 | CodeQL and the secret scan green on that commit, plus a recorded review of the release diff |
| Privacy review | A0 | PR #82's R1–R8 answered by the owner |
| Provider legal gate | A0 | ADR 0019 and Implementation Plan §14.2, re-confirmed for the batch D3 published |

A failing, missing or stale A0 item blocks A2. A failing A0b item blocks R5.

**A2 [approval]: build and sign.** Run from a clean checkout of the merged
commit, in PowerShell, with the API live and holding data (W3, D3) and the
policy published (P2):

```text
$env:ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping = "true"
flutter build appbundle --release --flavor production --dart-define-from-file=config/dart_defines/production.json
Remove-Item Env:ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping
```

The variable authorizes the Crashlytics mapping upload for this one
invocation, as `play-store-baseline.md` requires. Keep the Gradle output as the
upload record.

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

1. **R1 [approval].** Create an email list, *GridView upgrade check*, containing
   only the owner's test account. Select it on internal testing and deselect
   the existing *Testers* list (19 users) so no one else receives the
   candidate.
2. **R2 [approval].** Create the internal testing release with the A2 AAB
   (versionCode 8) and roll it out.
3. **R3 [approval].** The upgrade check in §8.
4. **R4 [approval].** The store declarations in §5. They are reviewed with
   the production submission.
5. **R5 [approval].** Promote the **same** release to production, a
   staged rollout at **20 %**. This goes through Google review.
6. **R6 [approval].** Increase to 100 % once the monitoring window passes.
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

**No closed-testing stage (owner decision, 2026-10-20).** Between internal
testing and production there is **one controlled, Play-delivered upgrade of
the final candidate** (R3). Implementation Plan §16.2's closed-testing and
monitoring stage is not used. A closed stage was considered against the two
reasons that could justify one:

- **Play Console requirement: none applies.** Play's closed-testing rule (12
  testers for 14 days, *App testing requirements for new personal developer
  accounts*) applies to personal accounts created after 13 November 2023,
  before production access. GridView has had production access since 2025.
  The owner should still confirm that the Console shows no such requirement
  when R5 is created.
- **Risks the controlled upgrade cannot test:**
  - device and OS diversity;
  - crash, ANR and API-error rates across many users;
  - real-network variety.

  A closed track of about 19 testers samples these weakly. The **staged
  production rollout** samples them better, with a halt: R5 starts at 20 %,
  R6 gates 100 % on the §16.3 signals, and Play can halt a rollout. One risk
  neither covers is a failure that appears only after days of use; the R6
  window (48 hours or a race weekend) is the mitigation.

  No remaining risk needs closed testing, so no closed gate is kept.
  Retiring the old Alpha artefact is planned separately (§5.1).

## 8. The upgrade check (R3): one controlled, Play-delivered upgrade

One device, one pass, about 30 minutes, on the exact candidate R5 promotes,
delivered by Play from internal testing.

**Preconditions:**
- A Play Store device on **API 36** (the current Android version, a matrix
  row), with 4 KB memory pages, signed in with the upgrade-check tester
  account.
- GridView **1.2.1 installed from Play production**, with Spanish and dark
  mode chosen in 1.2.1. 1.2.1's own backend no longer answers, so its cache
  stays empty, which 2.0.0 never reads anyway.
- The tester has not yet opted in to internal testing.

**Steps:**

1. **Before:**
   - `dumpsys package com.sejuma.gridview` shows versionCode 7 and installer
     `com.android.vending`;
   - `apksigner verify --print-certs` on the pulled base APK shows the
     app-signing certificate.
2. Opt in through the internal-testing link and update from the Play Store.
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

**Pass:** every step holds. **Fail:** stop before R5, record the failure, and
fix forward with a new versionCode.

**Coverage of the §15.3 upgrade matrix** (Implementation Plan §15.3;
`GridView_Legacy_Migration.md` §5). The single pass covers five rows. The
rest are not Play-delivered passes. They are named replacements that the owner
approves, or not, as D-U. R3 is a release gate only with both.

| Matrix row | Coverage |
|---|---|
| Empty legacy cache; dark theme; alternate language | The pass (steps 4–6) |
| No network | The pass (step 4: first launch offline) |
| Current Android version | The pass, on an API 36 device |
| Slow network | **Replacement (D-U):** the same candidate as a **Play-signed universal APK** (Play Console → App bundle explorer → versionCode 8 → "Download signed universal APK", a read-only download). Install it on an emulator with throttled network ("EDGE" profile) and do the first launch. Not Play-delivered; it tests the app's timeouts, not the upgrade path, which the pass covers. |
| Older supported Android version | **Replacement (D-U):** the same Play-signed universal APK, installed over the Play-signed 1.2.1 universal APK (versionCode 7, same download) on an **API 24** emulator (the new minSdk), with the pass's steps 4–6. Both carry the app-signing key, so the update installs. An APK extracted with `bundletool` would carry the upload or debug key and fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. A pass on a physical API 24–26 Play device can be added if one is available. |
| **Populated legacy cache** | **Not reproducible through Play.** 1.2.1's backend is dead, so a Play-installed 1.2.1 cannot fill its Hive cache; only a device or backup from before the shutdown could. Proposed replacement: the unit tests over the genuine Hive fixture (`test/fixtures/legacy/`, `GridView_Legacy_Migration.md` §4), plus a populated pass if a pre-shutdown device exists. **Needs D-U.** |
| **Corrupted legacy cache** | **Not reproducible on a Play build**, which is not debuggable, so its files cannot be altered. Proposed replacement: the corrupt-key and failed-read unit tests from PR #81. **Needs D-U.** |

This check does not prove that the 1.x Hive files were deleted. A Play build is
not debuggable, so they cannot be inspected; the unit tests cover the cleanup
(`GridView_Legacy_Migration.md` §4).

## 9. Open decisions

| # | Decision | Needed before |
|---|---|---|
| W0 | Production genesis design (ADR 0025 O-16 amendment): **done**, PR #84 merged as `527444b` | — |
| W-P | Submission path (`submission-path-decision.md`): A, Workers Paid (USD 5/month, existing ingest); B, Free-plan redesign (untested, needs a PR and the §4.7 tests); or explicitly accept the single request on Free. Nothing is bought by this plan | W1, D3 |
| D-T1 | Retain versionCode 7 for API 21–23 or not (recommended: not) | R4, R7 |
| D-T2 | Retire the Alpha artefact (versionCode 2) by pausing the track (§5.1). Promoting 2.0.0 to Alpha is not planned | P0 or R7 |
| D-R | Confirm no closed-testing stage: one controlled Play-delivered upgrade (R3), then the staged rollout (§7) | R5 |
| D-C | Commit a reviewed Jolpica capture tool to the repository, or keep the private operator script | D1 |
| D-L | Production persisted application logs: keep them (and declare App interactions) or disable them (W1; PR #82 §3.4, R8) | W1, P3 |
| D-U | Approve the replacements for the upgrade-matrix rows the single pass does not cover: slow network, older Android, and populated and corrupted legacy cache (§8). Or supply devices for them | R3 |
| W-D | API host: `*.workers.dev` (committed) or a custom domain | A2 |
| P-R | Privacy review of PR #82 `data-safety.md` review items R1–R8 (not the R-track gates) | P0 |
| M | Ship 2.0.0 with placeholder media (no R2, no approved media) | R5 |
| O | Who runs D1/D3 each race weekend, and the 2027 dataset work | R5 |
