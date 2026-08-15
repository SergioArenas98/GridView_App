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
  staging do not exist yet. Until they are approved and created, dev and
  staging builds contain no Firebase configuration and initialize no Firebase
  SDK. Do not create new Firebase projects without approval.
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
- **Collection is off by default everywhere.** The main manifest declares
  `firebase_crashlytics_collection_enabled=false` and
  `firebase_performance_collection_enabled=false` for all flavors, so the
  packaged SDKs are inert from process start. Only an eligible production build
  turns them on at runtime. This is the boundary that matters, because Android
  instantiates `FirebaseInitProvider` before any Dart code runs.
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
- Crashlytics and Performance data have **not** been observed arriving in
  Firebase Console; that needs an authorized release-like production build and
  console access, and remains an external blocker. See
  `GridView_Preferences_And_Settings.md` §6.2 and §7.

## Advertising

- The production AdMob application ID is preserved in
  `android/app/src/production/AndroidManifest.xml` only. Dev and staging
  manifests do not carry it.
- No ads SDK is included in the shell and no advertisement is requested in
  any flavor. When advertising is integrated (Phase 8), dev and staging must
  use Google test ad units exclusively.
- **Decision for v1: advertising is not retained.** No `google_mobile_ads` or
  consent-SDK dependency exists, no ad unit IDs exist, and no approval to ship
  advertising exists in the repository. The preserved manifest `meta-data` is an
  identifier for the published app, not an integration. The Settings → Privacy
  screen reports advertising as disabled, truthfully. See
  `GridView_Preferences_And_Settings.md` §6.1.

## Edge API (Cloudflare Worker)

Wrangler environments are defined in `services/edge-api/wrangler.toml`:

| Environment | Worker name | State |
|---|---|---|
| development | `gridview-api-dev` | Local `wrangler dev` only |
| staging | `gridview-api-staging` | Not provisioned |
| production | `gridview-api-production` | Not provisioned |

No Cloudflare account resources (KV namespaces, R2 buckets, routes, domains,
secrets) exist yet; provisioning happens in Phase 5 with approval. The mobile
shell does not call the Worker.

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
