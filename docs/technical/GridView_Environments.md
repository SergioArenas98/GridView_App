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
  (`android/app/src/production/google-services.json`) is preserved unchanged
  and applies only to production builds: the Google services Gradle plugin is
  applied exclusively to production tasks (`android/app/build.gradle`).
- **Pending:** dedicated Firebase projects/configurations for development and
  staging do not exist yet. Until they are approved and created, dev and
  staging builds contain no Firebase configuration and no Firebase SDK is
  initialized anywhere in the shell. Do not create new Firebase projects
  without approval.
- The Firebase Dart SDKs are integrated in Phase 8 (Implementation Plan,
  section 13.5).
- **Phase 8A did not integrate them.** There is still no FlutterFire
  dependency, no `firebase_options.dart` and no Firebase initialization
  anywhere in the shell, so Crashlytics and Performance Monitoring must not be
  claimed to work. The configuration is production-only and therefore
  incomplete; activation is an external blocker. The platform-neutral
  observability boundary is Phase 8C. See
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

## Flutter SDK pin

The exact Flutter SDK is pinned with FVM in `.fvmrc` and CI reads the same
value. Local usage:

```text
dart pub global activate fvm
fvm install        # installs the pinned version from .fvmrc
fvm flutter <cmd>  # run Flutter through the pinned SDK
```

`.fvm/` is ignored; only `.fvmrc` is committed.
