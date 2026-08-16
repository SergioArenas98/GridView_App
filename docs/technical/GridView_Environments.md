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
| staging | `gridview-api-staging` | **Contradictory — see below. Requires re-verification.** |
| production | `gridview-api-production` | Not provisioned |

> **Unresolved contradiction: the staging Worker's provisioning status.**
>
> This table says staging is "Not provisioned". Earlier operational evidence
> from the Phase 5B workstream records the opposite: a **public staging Worker
> observed responding** to an unauthenticated `GET /v1/status`, reporting
> `environment=staging`. Both statements are in the project's history and they
> cannot both be current.
>
> This is recorded rather than resolved. Settling it means querying Cloudflare,
> which is an external service, and Phase 8C-3 does not touch the edge API.
> **The staging Worker's provisioning status requires re-verification in its
> owning phase (5B).** Until that happens, treat neither the table row nor the
> earlier observation as authoritative, and do not build any Phase 8 claim on
> either.
>
> Nothing in the mobile application depends on the answer: the shell does not
> call the Worker in any shipped flavor, and production remains unprovisioned
> under both readings.

Production Cloudflare account resources (KV namespaces, R2 buckets, routes,
domains, secrets) do not exist; provisioning happens with approval in the owning
phase.

## Media delivery

| Environment | Media R2 bucket | Public media base URL |
|---|---|---|
| development | none | none |
| staging | **not provisioned** | none |
| production | **not provisioned** | none |

`wrangler.toml` binds a KV namespace for staging and nothing else. **No media
bucket exists in any environment**, so no image has ever been published and no
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
