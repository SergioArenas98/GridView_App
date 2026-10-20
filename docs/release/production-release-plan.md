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
| W0 | **[PR #84]** Production genesis design and implementation (ADR 0025 O-16 amendment) | — |
| W-P | **[decision]** The Free-plan path for submissions (§3, W-P) | W0 |
| W1 | **[PR]** The production Worker configuration, plus whatever W-P requires | W0, W-P |
| W2 | **[approval]** Create the production KV namespace and `ADMIN_TOKEN` secret; **[PR]** commit the KV id | W1 |
| W3 | **[approval]** Deploy `gridview-api-production` | W2 |
| D1 | **[approval]** Capture and review the season-2026 batch | W3 |
| D2 | **[approval]** Run production genesis for season 2026 | W3 |
| D3 | **[approval]** Submit the reviewed batch to production | D1, D2 |
| P1 | **[PR]** Privacy policy (covering 1.x and 2.0.0) and Data safety evidence (PR #82) | — |
| P2 | **[approval]** Publish the policy at https://gridview.netlify.app | P1 |
| P3 | **[approval]** Data safety in transition state T, Ads = **Yes** (PR #82 `data-safety.md` §1.3) | P2, W3 (production logging verified off) |
| A1 | **[PR]** 2.0.0+8 and the production build configuration (this change) | — |
| A2 | **[approval]** Build and sign the release AAB (uploads the R8 mapping) | A1, D3, P2 |
| R1 | **[approval]** Play Console: dedicated upgrade-check tester list on internal testing | — |
| R2 | **[approval]** Upload the AAB to internal testing and release it | A2, R1 |
| R3 | **[approval]** The upgrade check (§8), on one device | R2 |
| R4 | **[approval]** Release notes; decide D-T1 (retain versionCode 7 or not) and D-T2 (closed Alpha versionCode 2) | P3 |
| R5 | **[approval]** Promote the same release to production at 20 % | R3, R4 |
| R6 | **[approval]** Increase to 100 % after the monitoring window | R5 |
| R7 | **[approval]** Data safety final state F, Ads = **No**, once no 1.x artifact is distributed on any non-internal track | R6, D-T1, D-T2 |

## 3. Track W — production Worker

### W0. Production genesis design — PR #84

> **Status 2026-10-20.** The design is written as ADR 0025 D12, "Amendment
> (2026-10-20): production genesis (O-16)", and implemented in **PR #84**, with
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
### W-P. Free-plan cost of genesis and submissions (decision)

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

**Reliable paths that stay on Free** (each needs its own design and PR):

1. **Recommended: operator-driven two-phase publication.**
   - The operator's machine runs what the Worker runs today, with the same
     code: verification, generation, the D14/D15 guard against the predecessor
     it reads, revisions, the publication instant, and timestamp baking. The
     submission builder already runs the first two.
   - The Worker exposes only small authenticated steps:
     - `prepare`, with about 117 revisions, under 15 KB;
     - `finalize`;
     - the post-commit metadata write.
   - The candidate documents are written with `wrangler kv bulk put` under the
     version `prepare` allocated. No Worker CPU is spent on them.
   - Every Worker request stays well under 10 ms. The sequencer still binds the
     predecessor, single-flight, the timestamps and the commit.
   - **Trade-off.** The Worker no longer re-verifies the documents it commits.
     Trust rests on the operator's Cloudflare credentials, which can already
     deploy any code, so no privilege is added.
   - Needs an ADR 0025 decision, admin routes and an offline publisher CLI.
2. **Conditional: verification inside a Durable Object.**
   - The Worker forwards the body (parsing it costs about 1 ms) to a Durable
     Object that verifies, generates and writes.
   - Cloudflare documents a 30 s default CPU budget per Durable Object request,
     but the Free-plan pages do not say whether Free gets it. On staging,
     sequencer calls have used up to 18 ms on Free without termination, which
     is weak evidence.
   - Usable only after an owner-authorized staging probe shows Free Durable
     Objects running a full verification without `exceededCpu`.
3. **Not recommended: chunking the ingest into about 30–60 requests.**
   Verification is whole-batch, and per-chunk re-verification would need new
   staged state. It is complex and still close to 10 ms per request.

**Owner decision W-P.** Pick one of these paths, or explicitly accept the
unreliable single-request ingest. That means accepting that a race-weekend
update may fail with error 1102 and must be retried, with the post-commit gap
above. The plan does not assume the Paid plan. Paid would remove the limit
(5 min CPU), but that is the owner's choice.

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
- `wrangler tail --env production` shows no IP address or header in logs.

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
2. **D2 [approval]: genesis.**
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
   - **Path 1, operator-driven two-phase publication (recommended).**
     - Follow the procedure that path's PR delivers: an authenticated `prepare`
       naming no active release, then `wrangler kv bulk put` of the documents
       baked offline, then `finalize`, then the post-commit metadata.
     - Do **not** use `/internal/admin/season/ingest`. That single request is
       what W-P measured at 25–36 times the Free CPU limit.
     - This path does not exist yet: D3 waits for its PR.
   - **Path 2, verification inside a Durable Object.**
     - Only after the staging probe passed and that PR merged.
     - Run `npm run season-batch:submission -- … --first-release` (from
       `services/edge-api`) and send the body to the route that PR
       designates.
   - **Single request, explicitly accepted by the owner.**
     - Run `npm run season-batch:submission -- … --first-release` and send one
       `POST /internal/admin/season/ingest`, whose body carries
       `"expectedActiveVersion": null`.
     - Accept that error 1102 may end it. If it ends after the commit, the
       current-season pointer may be missing until the next release (W-P).
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

  Its review items R1–R7 need the owner's privacy review. R7 is the controller
  naming: the policy now names the individual the Play listing shows,
  publishing as Sejuma, in Spain.
- **P2 [approval]:** publish `privacy_policies.html` at https://gridview.netlify.app,
  the URL already on the listing and in `config/dart_defines/production.json`.
  - It must be live before P3 and A2.
  - Publish only the version that covers 1.x. A 2.0.0-only text must never
    replace the live page while 1.x is distributed.
- **P3 precondition.** The Data safety answer that API traffic is processed
  ephemerally (`data-safety.md` §3.4, R2) holds only once production logging is
  off. W1 must commit `invocation_logs = false` for `[env.production]`, and W3
  must verify it on the deployed Worker, before P3 is submitted.
- **P3 [approval]:** in Play Console, submit Data safety in **state T**: the
  2.0.0 Firebase rows plus the 1.x AdMob rows. Keep Ads **Yes**.
  - The live "No data collected" is already inaccurate for 1.2.1, so P3 need
    not wait for 2.0.0.
- **R4 [approval]:**
  - English and Spanish release notes.
  - **D-T1:** do not retain versionCode 7 for API 21–23 (recommended). The
    legacy backend is dead, so 1.2.1 shows ads but no data.
  - **D-T2:** deactivate the closed "Alpha" track, or replace its build.
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
5. **R5 [approval].** Promote the **same** internal release to production, a
   staged rollout at **20 %**. This goes through Google review.
6. **R6 [approval].** Increase to 100 % once the monitoring window passes.
   - **Window:** at least 48 hours, or a race weekend.
   - **Pass criteria:**
     - no new fatal in Crashlytics for 2.0.0 (8);
     - no ANR cluster in Android vitals;
     - production `/v1/status` healthy;
     - no ingest needed outside the reviewed path.
   - **Halt criteria:** any of the above failing. Halt the rollout in Play
     Console. Play cannot lower a versionCode, so the fix ships forward as
     2.0.1 (9).

## 8. The upgrade check (R3)

One device, one pass, about 20 minutes. It uses the exact candidate that R5
promotes.

**Preconditions:**
- A Play Store device with 4 KB memory pages, signed in with the upgrade-check
  tester account.
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
3. **After the update:**
   - versionCode 8 and installer `com.android.vending`;
   - the **same** signer certificate.
4. **Cold launch:**
   - the UI is in Spanish and dark (the 1.x choices migrated);
   - Home shows production season-2026 data, with no "Sample data" banner;
   - Settings shows 2.0.0, and the privacy-policy link opens the published
     policy.
5. **Relaunch** (force-stop, then launch):
   - the state is unchanged;
   - switch the theme to light and relaunch: light persists.
6. Relaunch in airplane mode: cached content renders.
7. After 30 minutes, Crashlytics shows no fatal or non-fatal for 2.0.0 (8),
   and `gv_sync_run` appears in Performance.

**Pass:** every step holds. **Fail:** stop before R5, record the failure, and
fix forward with a new versionCode.

This check does not prove that the 1.x Hive files were deleted. A Play build is
not debuggable, so they cannot be inspected; the unit tests cover the cleanup
(`GridView_Legacy_Migration.md` §4).

## 9. Open decisions

| # | Decision | Needed before |
|---|---|---|
| W0 | Production genesis design (ADR 0025 O-16 amendment): review and merge PR #84 | W1 |
| W-P | Free-plan submission path (§3 W-P): two-phase operator publication, a Durable Object probe, or accept the unreliable single request. Paid is not assumed | W1, D3 |
| D-T1 | Retain versionCode 7 for API 21–23 or not (recommended: not) | R4, R7 |
| D-T2 | Closed "Alpha" track (versionCode 2): deactivate or replace | R7 |
| D-C | Commit a reviewed Jolpica capture tool to the repository, or keep the private operator script | D1 |
| W-D | API host: `*.workers.dev` (committed) or a custom domain | A2 |
| P-R | Privacy review of `data-safety.md` R1–R4 | R4 |
| M | Ship 2.0.0 with placeholder media (no R2, no approved media) | R5 |
| O | Who runs D1/D3 each race weekend, and the 2027 dataset work | R5 |
