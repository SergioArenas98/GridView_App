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

## Advertising

- The production AdMob application ID is preserved in
  `android/app/src/production/AndroidManifest.xml` only. Dev and staging
  manifests do not carry it.
- No ads SDK is included in the shell and no advertisement is requested in
  any flavor. When advertising is integrated (Phase 8), dev and staging must
  use Google test ad units exclusively.

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
