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
| Changes that affect update compatibility | **None.** Same applicationId, same app-signing key. minSdk rises from 21 to 24, so devices on Android 7.0 and older stay on 1.2.1. |

## 2. Approval gates at a glance

| Gate | Action | Depends on |
|---|---|---|
| W0 | Approve the production genesis design (ADR 0025 O-16 amendment) | — |
| W1 | **[PR]** Implement genesis, production ingest admission and the production Worker configuration | W0 |
| W2 | **[approval]** Create the production KV namespace and `ADMIN_TOKEN` secret; **[PR]** commit the KV id | W1 |
| W3 | **[approval]** Deploy `gridview-api-production` | W2 |
| D1 | **[approval]** Capture and review the season-2026 batch | W3 |
| D2 | **[approval]** Run production genesis for season 2026 | W3 |
| D3 | **[approval]** Submit the reviewed batch to production | D1, D2 |
| P1 | **[PR]** Privacy policy and Data safety evidence (PR #82) | — |
| P2 | **[approval]** Publish the policy at https://gridview.netlify.app | P1 |
| A1 | **[PR]** 2.0.0+8 and the production build configuration (this change) | — |
| A2 | **[approval]** Build and sign the release AAB (uploads the R8 mapping) | A1, D3, P2 |
| R1 | **[approval]** Play Console: dedicated upgrade-check tester list on internal testing | — |
| R2 | **[approval]** Upload the AAB to internal testing and release it | A2, R1 |
| R3 | **[approval]** The upgrade check (§8), on one device | R2 |
| R4 | **[approval]** Submit Data safety, Ads = No and the release notes | P2 |
| R5 | **[approval]** Promote the same release to production at 20 % | R3, R4 |
| R6 | **[approval]** Increase to 100 % after the monitoring window | R5 |

## 3. Track W — production Worker

### W0. Production genesis design (decision)

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

### W1. Implementation **[PR]**

- Genesis operation, route and refusals, with tests, per W0.
- `src/ingest/service.ts`: admit `production`.
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
    - the genesis control.
  - Both Durable Object bindings, `PROVIDER_RATE_LIMITER` and
    `SEASON_PUBLICATION_SEQUENCER`.
  - The `GRIDVIEW_DATA` KV binding, with its id added in W2.
  - `[env.production.secrets] required = ["ADMIN_TOKEN"]`.
  - `[env.production.triggers] crons = []`.
  - Observability on, with `invocation_logs = false` and no log line that
    records an IP address or a header. This is the condition behind the Data
    safety answer (`data-safety.md` §3.4).
- **Plan decision W-P:** Workers Free vs Paid. The staging ingest used 269 ms
  of CPU on Free on 2026-10-14 (Free's limit is 10 ms, tolerated
  "infrequently"). The genesis and ingest are owner-run and rare, but a refused
  production ingest would delay a race-weekend update.

### W2. Provisioning **[approval]**, then **[PR]**

```text
npx wrangler kv namespace create GRIDVIEW_DATA --env production
npx wrangler secret put ADMIN_TOKEN --env production   # new value, stored like staging's (DPAPI), never printed
```

Commit the returned KV id to `[env.production]` and validate with
`npm run validate:worker-config` and a `wrangler deploy --dry-run --env production`.

### W3. Deploy **[approval]**

```text
npx wrangler deploy --env production
```

Verify:
- `GET /v1/status` returns `200` with `environment=production` and `maintenance=false`.
- The season resources are unavailable, as W0 item 4 expects.
- `wrangler tail --env production` shows no IP address or header in logs.

Record the deployed version id.

## 4. Track D — reviewed data publication

1. **D1 [approval]: capture and review.**
   - Run `npm run season-batch:generate` (owner-run; about 23 Jolpica `GET`s,
     as on 2026-10-13 and 2026-10-19).
   - Review `manifest.json` and record its SHA-256, as in the staging captures.
2. **D2 [approval]: genesis.** Run the W0 genesis operation for 2026 with the
   production `ADMIN_TOKEN`, and confirm the sequencer reports the season
   active with no release.
3. **D3 [approval]: submit.**
   - Run `npm run season-batch:submission` and send one
     `POST /internal/admin/season/ingest` naming the empty active version.
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

- **P1 [PR]:** PR #82 contains the 2.0.0 policy (`privacy_policies.md`/`.html`)
  and `docs/release/data-safety.md`. Its review items R1–R4 need the owner's
  privacy review.
- **P2 [approval]:** publish `privacy_policies.html` at https://gridview.netlify.app,
  the URL already on the listing and in `config/dart_defines/production.json`.
  It must be live before A2, because the app links to it.
- **R4 [approval]:** in Play Console:
  - submit the Data safety form from `data-safety.md` §3;
  - App content → Ads → **No**, which removes "Contains ads";
  - English and Spanish release notes.

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
| W0 | Production genesis design (ADR 0025 O-16 amendment) | W1 |
| W-P | Workers Free or Paid for production | W3 |
| W-D | API host: `*.workers.dev` (committed) or a custom domain | A2 |
| P-R | Privacy review of `data-safety.md` R1–R4 | R4 |
| M | Ship 2.0.0 with placeholder media (no R2, no approved media) | R5 |
| O | Who runs D1/D3 each race weekend, and the 2027 dataset work | R5 |
