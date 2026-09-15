# GridView - Environment configuration

Status: living document, updated as environments gain real configuration.

## Flutter build flavors

| Flavor | Application ID | versionName | Purpose |
|---|---|---|---|
| dev | `com.sejuma.gridview.dev` | `<base>-dev` | Local development |
| staging | `com.sejuma.gridview.staging` | `<base>-staging` | Pre-production validation |
| production | `com.sejuma.gridview` | `<base>` | Google Play releases |

The production application ID must never change. The base versionCode and
versionName come from `pubspec.yaml` and are governed by
`../release/play-store-baseline.md`.

The Dart-side environment is selected with a build-time define that should
always match the flavor:

```text
flutter run   --flavor dev        --dart-define=APP_ENV=development
flutter build apk --debug --flavor dev --dart-define=APP_ENV=development
flutter build appbundle --flavor production --dart-define=APP_ENV=production
```

Unknown or missing `APP_ENV` values fall back to `development`
(`lib/app/environment/app_environment.dart`), so a misconfigured build can
never behave as production. Non-production builds show a technical
environment badge in the UI.

### Staging backup and restore isolation

`com.sejuma.gridview.staging` never backs up, transfers or restores
application data. The staging source set (`android/app/src/staging/`) gives
every staging build type's merged manifest three layers, each excluding every
application-data domain, credential- and device-protected alike:

- `android:allowBackup="false"` - no cloud backup and no cloud restore,
  including restore-at-install;
- `android:dataExtractionRules` (Android 12 and higher) - exclude-only
  `cloud-backup` and `device-transfer` sections. This is the layer that closes
  device-to-device transfer: for an app targeting Android 12 or higher,
  `allowBackup="false"` does not;
- `android:fullBackupContent` (Android 11 and lower) - the same exclusions for
  legacy Auto Backup.

Dev and production receive none of this and keep the platform defaults they
had before. `:app:verifyStagingBackupPolicy` asserts all of it in CI, from the
nine merged manifests and the two rule files.

This is the contract-migration alternative of the historical-floor
precondition in
[ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary).
Four layers of evidence are recorded separately:

- **Implementation.** PR #27, merged as `35a59e8`. CI runs
  `verifyStagingBackupPolicy`.
- **Protected artifact verification (2026-09-14).** A staging debug APK built
  from `35a59e8` carries `allowBackup="false"` and both rule files. All nine
  domains are excluded in both the cloud-backup and device-transfer sections,
  with no include rule and no BackupAgent.
- **Device evidence (2026-09-14).**
  - That APK was installed once on the reference phone, the HONOR DNP-NX9
    (the Honor 400 Pro). It was never launched and restored no data. It was
    then cleared and uninstalled.
  - Backup Manager still started its restore-at-install workflow for the
    package, but the transport delivered no package.
  - The four locally retained staging APKs built before this change were
    deleted.
- **D12 evidence.** Season 2026's client baseline is recorded through
  `authorized-client-baseline-reset` in
  [ADR 0025, "What the authorized client-baseline reset supplies (2026-09-14)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-authorized-client-baseline-reset-supplies-2026-09-14).
  That record also corrects the invalidated 2026-09-13 decommissioning
  record.

Limits that still apply:

- a historical cloud backup dataset, if one exists, is not claimed to have been
  deleted - this change is meant to stop it being restored, not to erase it;
- the exclusion layers have not been exercised against a real backup payload;
- staging APKs built before this change must never be installed or used;
- checkpoint, seed and activation remain pending.

## Remote data source

The remote data source is chosen deliberately at build time from two defines,
`DATA_SOURCE` and `API_BASE_URL` (`lib/features/shared/application/providers.dart`,
`remoteApiProvider`):

- `DATA_SOURCE=remote` (default) — talk to the real GridView API over HTTPS;
  requires a valid `API_BASE_URL`.
- `DATA_SOURCE=fixture` — serve the bundled OpenAPI-valid fixtures under
  `assets/dev_fixtures/`. **Deliberate and non-production only.** It shows the
  "Sample data" banner (`usesMockDataProvider`).

Fixture mode is **never** inferred from a missing `API_BASE_URL`: it requires the
explicit `DATA_SOURCE=fixture` value, and a missing or malformed `DATA_SOURCE`
resolves to `remote` (`DataSourceConfig.parse`), so a misconfiguration can never
silently enable fixtures.

Selection truth table:

| Environment | `DATA_SOURCE` | `API_BASE_URL` | Source |
|---|---|---|---|
| dev / staging | `remote` (or missing/malformed) | valid | `DioGridViewApi` |
| dev / staging | `remote` (or missing/malformed) | missing | controlled configuration failure (`MisconfiguredGridViewApi`) — **not** fixtures |
| dev / staging | `fixture` | any | `FixtureGridViewApi` (Sample data banner) |
| production | `remote` (or missing/malformed) | valid | `DioGridViewApi` |
| production | `remote` (or missing/malformed) | missing | controlled configuration failure |
| production | `fixture` (attempted) | any | controlled configuration failure — production **never** constructs `FixtureGridViewApi` |

A `MisconfiguredGridViewApi` is not a mock source (`usesMockData` is `false`, so
no banner); every call returns a typed `ApiFailureKind.configuration` failure.

Common commands:

```text
# Local dev against the bundled fixtures (deliberate fixture mode).
flutter run --flavor dev --dart-define=APP_ENV=development --dart-define=DATA_SOURCE=fixture

# Dev/staging against a real HTTP endpoint (a local Worker or staging edge API).
flutter run --flavor staging --dart-define=APP_ENV=staging \
  --dart-define=DATA_SOURCE=remote \
  --dart-define=API_BASE_URL=https://gridview-api-staging.example.workers.dev

# Production always talks to the real API; a missing API_BASE_URL is a
# controlled configuration failure, never fixtures.
flutter build appbundle --flavor production --dart-define=APP_ENV=production \
  --dart-define=API_BASE_URL=https://api.gridview.example

# Manual (non-CI) staging orchestration smoke: first-use bootstrap, close/reopen
# and a returning conditional-revalidation pass over public routes only.
flutter test tool/staging_smoke.dart \
  --dart-define=DATA_SOURCE=remote \
  --dart-define=API_BASE_URL=https://gridview-api-staging.example.workers.dev
```

None of this touches Android flavors, application IDs or Gradle configuration —
it is purely Dart build-time defines.

Whatever the environment, the data source only decides *where* representations
come from. *When* they are fetched is the application synchronization
coordinator's decision (`docs/technical/GridView_Synchronization.md` §11): the
shell and any cached content always render first, one run starts after the first
frame, and refreshes follow server-provided freshness rather than any
environment-specific interval.

## Firebase

- The production Firebase configuration
  (`android/app/src/production/google-services.json`) is preserved unchanged and
  applies only to production builds: the Google services Gradle plugin is applied
  to every variant, but its `process<Variant>GoogleServices` task is enabled for
  the production flavor alone (`android/app/build.gradle`). The scoping is by
  variant, never by the requested task name.
- **Pending:** dedicated Firebase projects/configurations for development and
  staging do not exist yet. Until they are approved and created, dev and staging
  builds contain **no Firebase configuration** and never initialize the **Dart
  adapters**. They are not free of the SDK itself — see the packaging note below,
  which is the accurate statement. Do not create new Firebase projects without
  approval.
- **Phase 8C-1 integrated the SDKs.** `firebase_core`, `firebase_crashlytics`
  and `firebase_performance` are dependencies; exactly one file
  (`lib/core/observability/firebase/firebase_observability.dart`) imports them,
  and a test enforces that. There is still **no** `firebase_options.dart` and no
  new configuration file: the default app comes from the existing production
  `google-services.json`, which is byte-identical.
- **The native Firebase components are packaged in every flavor.** Dart
  dependencies are not flavor-scoped, so `FirebaseInitProvider` and the
  Crashlytics, Performance, Sessions, Installations, Remote Config and ABT
  registrars appear in the dev, staging and production manifests alike. Only the
  *configuration* and the two build tasks that consume it are production-only;
  the plugins themselves are applied everywhere. Do not state that no Firebase
  SDK is initialized outside production.
- **Collection starts off on a fresh installation of every flavor.** The main
  manifest declares `firebase_crashlytics_collection_enabled=false` and
  `firebase_performance_collection_enabled=false` for all flavors, and only an
  eligible production build ever turns them on at runtime. This is the boundary
  that matters, because Android instantiates `FirebaseInitProvider` before any
  Dart code runs.
- **The runtime opt-in persists, so the manifest is a default and not a
  per-launch rule.** A successful production activation writes a preference the
  SDKs read at a higher priority than the manifest, and it survives process
  death. A production installation that has activated once therefore begins
  **later** launches with native collection already on, before Dart runs. Do
  **not** write that the packaged SDKs are inert from process start in every
  flavor: it is true only until the first successful production activation.
  Dev and staging are structurally unaffected — different application IDs, no
  Firebase configuration, and the production activation never runs for them.
- **A failed activation proves only that this process's Dart adapters were
  unavailable.** It is not evidence that a previously persisted native override
  is off, and no document, status value or user-facing string may imply that.
- `isObservabilityEligible` returns true for `production` only and governs the
  **Dart adapters**. Development, staging and tests resolve to a no-op reporter
  and tracer.
- **Flavor and `APP_ENV` are bound by a build gate.** `validate<Variant>Environment`
  in `android/app/build.gradle` fails the build unless dev↔development,
  staging↔staging and production↔production, and fails when `APP_ENV` is absent.
  Contradictory artifacts can no longer be produced.
- Dev and staging still build with **no** `google-services.json`. Verified: a
  production build runs `processProductionDebugGoogleServices` and emits
  resources with `google_app_id` and `project_id = gridview-fb20f`; the task is
  disabled for dev and staging, which emit neither. The Crashlytics build-ID
  injection tasks run for every variant and prove nothing about configuration.
- Firebase initialization is never awaited before `runApp`; it degrades to inert
  on any failure. See `GridView_Observability.md` and
  [ADR 0016](../adr/0016-production-only-firebase-observability.md).
- **No Firebase Analytics implementation**, no advertising SDK, no Messaging or
  Authentication, and no Crashlytics NDK. **Remote Config and ABT *are* present
  as transitive native components of Performance Monitoring** — GridView has no
  Remote Config Dart API or product feature. A transitive
  `firebase-measurement-connector` interop stub is present and is not Analytics.
  The Android facts are asserted by the Gradle gate
  `verify<Variant>FirebaseDependencies`; the Dart lockfile test covers only
  direct Dart packages.
- Crashlytics and Performance data **have** been observed arriving in Firebase
  Console (**Phase 8C-2, complete, 2026-08-16**), from two passes on a dedicated
  emulator: a production **debug** build contributed a controlled fatal, a
  controlled non-fatal and a `gv_sync_run` sample; a **release-like** pass from a
  signed, R8-minified, non-debuggable production release APK contributed a further
  Console-confirmed controlled fatal (correct five owned keys) and a
  Console-confirmed `gv_sync_run` at ≈ 9.71 s. Keep the three evidence levels
  apart: produced locally, accepted by ingestion (HTTP 200), observed in Console —
  only the last is delivery, and `outcome=success` on that trace rests on retained
  SDK evidence rather than Console display. No mapping or symbol upload occurred,
  no AAB was built and nothing was published. See `GridView_Observability.md` §9
  and `GridView_Preferences_And_Settings.md` §6.2 and §7.

## Advertising

**Decided and closed: advertising is not retained for v1.** See
[ADR 0018](../adr/0018-advertising-not-retained-for-v1.md). The PRD (§17) says
advertising *may* remain, which makes it optional rather than mandatory, and the
decision deadline in `GridView_Implementation_Plan.md` §25 — before Phase 8
production integration — passed with no approval to integrate it.

- No `google_mobile_ads` or consent/UMP dependency exists, no ad unit ID exists,
  no ad request exists, and nothing initializes an advertising SDK at runtime.
  `android/app/build.gradle` lists `com.google.android.gms:play-services-ads`
  and `play-services-ads-identifier` in its **forbidden** dependency set, so
  `verify<Variant>FirebaseDependencies` fails the build if either is ever
  resolved into a variant.
- The production AdMob **application ID** is preserved in
  `android/app/src/production/AndroidManifest.xml` only; dev and staging
  manifests do not carry it. It is published-app identity (§2.6 of the
  Implementation Plan), and it is **inert**: an application ID is read by the
  Google Mobile Ads SDK at initialization, and that SDK is neither packaged nor
  initialized. It is unchanged by this decision.
- `GvAdContainer` remains a **development catalogue component only**. It
  reserves layout space and performs no ad initialization, it is constructed
  only by the component catalogue, and the catalogue is unreachable from every
  live production route (`ComponentCatalogueScreen.open` refuses to navigate in
  production).
- **Dev and staging require no test ad units.** The earlier instruction to use
  Google test identifiers outside production presumed an integration; with no
  integration there is nothing to point at a test unit.
- The Settings → Privacy screen reports advertising as disabled, truthfully. See
  `GridView_Preferences_And_Settings.md` §6.1.
- Reintroducing advertising later requires a new reviewed phase: a superseding
  architecture decision, consent/privacy analysis, test identifiers outside
  production, and a measured startup impact. It is not an incremental change to
  Phase 8.

## Edge API (Cloudflare Worker)

Wrangler environments are defined in `services/edge-api/wrangler.toml`:

| Environment | Worker name | State |
|---|---|---|
| development | `gridview-api-dev` | Local `wrangler dev` only |
| staging | `gridview-api-staging` | **Publicly reachable, observed 2026-08-17.** See below for exactly what that does and does not establish. Redeployed 2026-09-12 as version `00012c06-6c09-4b2f-b24c-02d6e51ec08d` (season-2026 admission closure; superseded version `985115b7-abb3-4346-8845-d8ff41c80cf6`). Redeployed twice more on 2026-09-13, for the season-2026 recovery window: reopening version `38b5169a-6e3b-4e44-aed1-89ef74c0995c`, then reclosure version `c35f99c0-9e89-4dd7-8fbe-449d295fb567`, carrying `seed:2026`. Redeployed on 2026-09-15 as version `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c`, which adds `SEASON_PUBLICATION_AUTHORITY = "sequencer"`, keeps `seed:2026`, and is current. See the Durable Object state below. |
| production | `gridview-api-production` | Not provisioned |

> **Staging: public availability observed; administrative state not verified.**
>
> The earlier contradiction in this table — "Not provisioned" against Phase 5B's
> record of a responding public Worker — is resolved **in the direction of
> availability**, on the evidence date only.
>
> **Observed during the Phase 8C-3 verification (2026-08-17), read-only and
> public:**
>
> - `GET /v1/status` returned `200` and reported `environment=staging`,
>   `apiVersion=1`, `maintenance=false`.
> - The public season, calendar, standings, Explore-collection and entity-detail
>   resources were available and populated for season 2026.
> - The staging mobile application **synchronized successfully** against it over
>   ordinary public `GET` traffic, so the earlier note that "the shell does not
>   call the Worker in any shipped flavor" is superseded: a staging build with an
>   explicit `API_BASE_URL` does call it, and did.
>
> **What this does not establish.** No administrative route was called, no
> Cloudflare dashboard, API or tooling was accessed, and `ADMIN_TOKEN` was never
> handled. Deployment ownership, configuration, bindings, secrets, retention and
> future availability were **not** verified and must not be inferred from public
> HTTP behaviour. This records that the service answered on that date — nothing
> about how it is configured or who maintains it.
>
> Production remains unprovisioned, and nothing above changes that.

Production Cloudflare account resources (KV namespaces, R2 buckets, routes,
domains, secrets) do not exist; provisioning happens with approval in the owning
phase.

## Media delivery

| Environment | Media R2 bucket | Public media base URL |
|---|---|---|
| development | none | none |
| staging | **not provisioned** | none |
| production | **not provisioned** | none |

`wrangler.toml` binds a KV namespace for staging, and declares the
`PROVIDER_RATE_LIMITER` Durable Object binding in development, staging and
production ([ADR 0021](../adr/0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)).
Bindings are not inherited by named environments, so each declares it; the
SQLite `exports` entry is declared once, because SQLite-backed storage is what
Durable Objects require on the Workers Free plan.

**The rate-limiter Durable Object is provisioned in staging only, and
unused.** The 2026-09-12 staging deployment (version
`985115b7-abb3-4346-8845-d8ff41c80cf6`) created its staging namespace;
production has never been deployed and has none. Provisioning is not use: no
provider adapter exists and no production module constructs the hardened
provider client, so nothing reserves through it. What keeps staging off the
network is `PROVIDER_MODE = mock` plus the absence of any live adapter - not
the binding. Wherever the namespace is unbound, every provider reservation
resolves to `unavailable` - the fail-closed default, under which no outbound
provider request can be issued at all.

`SEASON_PUBLICATION_AUTHORITY` (ADR 0025, Phase 9B-6b) is **`sequencer` in
live staging** since 2026-09-15 (version `cccdcf11-…`), and in `env.staging`
as committed. It is unset in development and production. An absent, empty or unrecognised value resolves to `legacy` and
never throws, so the composition builds the existing `SnapshotPublisher` and the
public router performs no Durable Object lookup. The exact string `sequencer`
selects the two-phase path when a sequencer port is reachable, and **fails
closed when one is not**: that combination resolves to an explicit
sequencer-unavailable authority, never back to `legacy`, so a deployment that
lost the binding after a cutover cannot resume reading or mutating legacy KV
pointers.

**The `SeasonPublicationSequencer` Durable Object is provisioned in staging
only, and disabled.** `wrangler.toml` declares
`[exports.SeasonPublicationSequencer]` with SQLite storage and binds
`SEASON_PUBLICATION_SEQUENCER` for **`env.staging` only** (staging cutover
preparation slice, 2026-09-10); the class is a named export of the Worker entry
point, which is how Wrangler resolves it. There is still **no `[[migrations]]`
block and no production binding**. The 2026-09-12 staging deployment (version
`985115b7-abb3-4346-8845-d8ff41c80cf6`) created the staging namespace. Since
2026-09-15, live staging selects `sequencer`, so publications and public reads
look the sequencer up. Season 2026 was seeded that day and has not been
activated. A `seeded` season is not authoritative, so **staging still uses
legacy pointers for every season, and production has never been deployed.**

| Durable Object state | development | staging | production |
|---|---|---|---|
| `[exports]` entries (both classes) | shared, once | shared, once | shared, once |
| `PROVIDER_RATE_LIMITER` binding declared | yes (local `wrangler dev` only) | yes | yes |
| `SEASON_PUBLICATION_SEQUENCER` binding declared | none | yes | **none** |
| Namespaces provisioned on Cloudflare | none | **both, 2026-09-12** (version `985115b7-…`); since 2026-09-15 the sequencer is looked up, and the rate limiter still is not | none - never deployed |
| Authority mode set | no | **live: yes** (`sequencer`, since 2026-09-15, version `cccdcf11-…`); **committed: yes** (`sequencer`) | no |
| Cutover control set | no | **live: yes** (`seed:2026`: first deployed 2026-09-12 as version `00012c06-…`, absent only during the 2026-09-13 recovery window, restored as version `c35f99c0-…`, and kept by `cccdcf11-…`); **committed: yes** (`activate:2026`, prepared 2026-09-15, not deployed; below) | no |

`SEASON_PUBLICATION_CUTOVER_CONTROL` (ADR 0025 D12) is live in staging only —
`seed:2026`, deployed 2026-09-12 — and remains unset in development and
production. `env.staging` now commits `activate:2026` instead (below). It accepts exactly `seed:<supported season>` or
`activate:<supported season>`; an absent or empty value is disabled and
preserves today's behaviour exactly. A **malformed non-empty value is a bounded
`ConfigurationError`** — the same failure an unknown `PROVIDER_MODE` produces,
surfacing as a 500 that carries no raw value in either the response or the log
line — because an operator who mistyped the control believes a season is paused,
and resolving that to "disabled" would leave the season openly mutable
underneath them.

**Season-2026 admission closure — DONE, 2026-09-12.** The authenticated
operator explicitly selected season 2026, and
`services/edge-api/wrangler.toml` declares
`SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"` under `[env.staging.vars]`
only. A separately authorized `wrangler deploy --env staging` uploaded this
configuration from operator-recorded source revision
`d3de839a7b297c060e6e4ee7cf1d9974a198be93`, replacing staging version
`985115b7-abb3-4346-8845-d8ff41c80cf6` with
`00012c06-6c09-4b2f-b24c-02d6e51ec08d` at 100% traffic. Season 2026's legacy
publication and rollback admission is now closed in deployed staging.
`SEASON_PUBLICATION_AUTHORITY` remains absent everywhere, so this closure
neither seeds nor activates anything.

**Temporary season-2026 reopening configuration — prepared 2026-09-13, not
deployed.** The D12 checkpoint audit found that no retained season-2026
version records an exact `__inventory`, so the seed cannot run, and no existing
release may be given a reconstructed or backfilled one.
The reopening configuration (PR #23) removes
`SEASON_PUBLICATION_CUTOVER_CONTROL` from `[env.staging.vars]` in
`services/edge-api/wrangler.toml`. **Live staging is unchanged**: version
`00012c06-…` still carries `seed:2026`, so season 2026's admission remains
closed. Only a separately authorized, time-bounded
`wrangler deploy --env staging` would reopen it, for exactly one
inventory-bearing publication, after which a further authorized deployment
restores `seed:2026` before any client reset, checkpoint or seed. While the
reopening configuration is committed without the reclosure, routine staging
deployment is prohibited — see the staging runbook, section 6.

**Season-2026 reclosure configuration — prepared 2026-09-13, not deployed.**
Prepared after the reopening configuration and before any reopening
deployment, it restores exactly
`SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"` under `[env.staging.vars]`
— its only change from the reopening configuration — so the committed file
again declares what the 2026-09-12 paragraph above describes, and what live
staging carries. It is that further authorized deployment: deployed only
immediately after the one publication, never before it.

**Season-2026 recovery window — executed 2026-09-13.** This supersedes the "not
deployed" and "live staging is unchanged" statements in the two paragraphs
above, which were true when written. Under separate authorization, which also
covered rotating `ADMIN_TOKEN`:
- Version `38b5169a-6e3b-4e44-aed1-89ef74c0995c` (reopening, from `master`
  `d50ef2f8daa6e0292274e97a5effe231951cc9fd`, 18:29:21Z UTC) omitted the
  control and rotated the secret.
- Exactly one manual full synchronization published
  `20260913183106443-4f683541` with its exact `__inventory`.
- Version `c35f99c0-9e89-4dd7-8fbe-449d295fb567` (reclosure, from
  `549bb5f3f3ee3963727a816b96fa39752355e9cd`, 18:31:58Z UTC) restored
  `seed:2026`.

Live staging is closed again. `SEASON_PUBLICATION_AUTHORITY` stayed absent
and `PROVIDER_MODE` stayed `mock`, and nothing was seeded or activated.
Production is untouched. Until the reclosure configuration is merged,
`master` omits the control, so routine staging deployment of `master` stays
prohibited. Record:
[staging runbook, "Recovery window record (2026-09-13)"](../operations/GridView_Staging_Edge_Runbook.md#recovery-window-record-2026-09-13).

When it *is* set, it closes **that one season's** legacy publication and
rollback admission before `SnapshotPublisher` is reached (bounded reason
`season-paused-for-cutover`), leaves every other season working, keeps the
operator cache purge available, and leaves public reads resolving through the
legacy authority. It is an admission-closure boundary, **not** a quiescence
guarantee: it stops new mutators from starting and claims nothing about an
invocation admitted before it was deployed.

**Season-2026 seed authority — prepared 2026-09-15, not deployed.** The
operator approved the exact season-2026 cutover checkpoint on 2026-09-15. Its
derived fingerprint, which is not a checkpoint field, is
`cutover1:38f726065f8cbb7f46525c213013936b9673cdccbb0128ca45a0ecfccd7c9ac2`.
The seed refuses unless the authority mode is exactly `sequencer`, so
`services/edge-api/wrangler.toml` now selects
`SEASON_PUBLICATION_AUTHORITY = "sequencer"` under `[env.staging.vars]` only,
and keeps `seed:2026`.
- Merging it deploys nothing. Live staging keeps the authority absent until a
  separately authorized, cutover-sensitive deployment (staging runbook,
  section 6).
- Even once it is deployed, `uninitialized` and `seeded` seasons stay on
  legacy pointers until a separately authorized activation, and `seed:2026`
  keeps season 2026's mutators paused.
- No seed has run.

Record:
[ADR 0025 D12, "What the approved checkpoint and seed-authority preparation supply (2026-09-15)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-approved-checkpoint-and-seed-authority-preparation-supply-2026-09-15).

**Season-2026 seed — committed 2026-09-15; activation phase prepared, not
deployed.** This supersedes the "Merging it deploys nothing" and "No seed has
run" statements above, which were true when written.
- A separately authorized, cutover-sensitive deployment made the authority
  live as staging version `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c`, keeping
  `seed:2026`.
- A separately authorized seed then presented the approved checkpoint
  verbatim, once, at 2026-09-15T20:33:07.492Z UTC. It committed season 2026 as
  `seeded` on the first attempt, under the approved fingerprint.
- The season is **not active**. The sequencer is not authoritative for it, the
  legacy pointers and public responses are unchanged, and no activation
  receipt exists.
- `services/edge-api/wrangler.toml` now replaces `seed:2026` with
  `activate:2026` under `[env.staging.vars]`. That value permits the
  activation route and refuses another seed. It keeps season 2026's
  publication and rollback closed until the sequencer positively reports the
  season `active` and authoritative. A failed or `unavailable` lookup fails
  closed.
- Merging it deploys nothing. Deploying it is a cutover-sensitive step that
  needs its own authorization, and it activates nothing either.
- Activation is a separate authenticated request. It must re-present the
  approved checkpoint exactly, with `confirmActivation: true`.
- A successful activation alone resumes season 2026's publication and
  rollback, through `SequencedPublicationService`. No further configuration
  change is needed. The legacy `active:2026` and `previous:2026` pointers are
  not written and remain historical context.
- Smoke and latency verification stay separately authorized.

Record:
[ADR 0025 D12, "What the season-2026 seed supplies (2026-09-15)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-season-2026-seed-supplies-2026-09-15).

**No media bucket exists in any environment**, so no image has ever been published and no
production CDN host appears anywhere in this repository — fabricating one would
put URLs into a manifest that nothing serves.

The public media base URL is therefore always supplied by the operator at
publication time and validated with the same HTTPS rule the app applies to a
media URL.

On the client, media URL policy is decided by `MediaUrlPolicy`, not by
environment inference:

| Policy | Accepts |
|---|---|
| `MediaUrlPolicy.strict` (staging, production) | HTTPS only, non-empty host, no embedded credentials, no control characters |
| `MediaUrlPolicy.developmentLoopback` | the above, plus `http` on `localhost` / `127.0.0.1` |

The loopback relaxation must be **injected explicitly**. No environment
selects it, and there is no configuration that makes arbitrary `http`
acceptable. Tests use a fake loader rather than relaxing the policy.

See [GridView_Media.md](GridView_Media.md).

## Flutter SDK pin

The exact Flutter SDK is pinned with FVM in `.fvmrc` and CI reads the same
value. Local usage:

```text
dart pub global activate fvm
fvm install        # installs the pinned version from .fvmrc
fvm flutter <cmd>  # run Flutter through the pinned SDK
```

`.fvm/` is ignored; only `.fvmrc` is committed.
