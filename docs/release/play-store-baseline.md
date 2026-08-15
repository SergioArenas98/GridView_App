# Google Play baseline

- Production package: com.sejuma.gridview
- Highest published versionCode: PENDING - must be confirmed in Play Console
  before preparing any release. The local project is `1.2.1+7` (versionCode 7),
  but 7 must NOT be assumed to be the highest value registered in Play Console.
- Current versionName: 1.2.1 (local project; Play Console value pending
  confirmation)
- Play App Signing enabled: Yes
- Upload key available: Yes - a new upload key has been created; its
  registration is pending Google Play approval
- Upload key alias: PENDING (record after the new upload key is approved)
- App-signing certificate SHA-256: PENDING (record from Play Console)
- Upload certificate SHA-256: PENDING (new upload key awaiting approval)
- Date checked: 2026-07-18

## Rules

- Do not prepare a release until every PENDING value above is confirmed.
- The next release must use a versionCode strictly greater than the highest
  value registered in Play Console.
- Release signing credentials are loaded from ignored local files or CI
  secrets. Never commit `.jks`, `.keystore`, `key.properties`, passwords or
  private certificates.

## Release-readiness items

- **Android NDK version (added Phase 4).** A native transitive dependency
  pulled in by Drift/`sqlite3_flutter_libs` (`jni`) requests **NDK
  28.2.13676358**, while `android/app/build.gradle` pins `ndkVersion
  27.0.12077973`. The Flutter/Android toolchain reports the mismatch as a
  **backward-compatible warning** and all debug flavors (dev/staging/production)
  build successfully. This must be **revisited before the first production
  release AAB** — decide whether to bump `ndkVersion` to 28.2 (or higher common
  version) and re-verify the signed AAB. It is intentionally **not** changed
  outside a dedicated, reviewed Android-config change.

- **Firebase SDKs (added Phase 8C-1).** `firebase_core`,
  `firebase_crashlytics` and `firebase_performance` ship in the app. The native
  components are packaged in **every** flavor — Dart dependencies are not
  flavor-scoped — and so are the three build-time Gradle plugins. What is
  production-only is the configuration and the two tasks that consume it:
  `process<Variant>GoogleServices`, and `uploadCrashlyticsMappingFile<Variant>`
  which additionally requires the `release` build type and explicit
  authorization, and is disabled by default.
  Collection starts off by manifest default on a fresh installation of every
  flavor and is enabled at runtime only by an eligible production build. **That
  runtime opt-in is persisted by the platform SDKs at a higher priority than the
  manifest**, so a production installation that has activated once begins later
  launches with collection already on, before Dart runs — relevant to the Data
  Safety declaration below, which must describe collection from app start rather
  than from a Dart-side decision. Dev and staging are structurally excluded:
  separate application IDs, no Firebase configuration, and the production
  activation never runs for them.
  Transitively present: **Firebase Remote Config and ABT**, required internally
  by Performance Monitoring, plus a measurement-connector interop stub. Absent:
  any Firebase Analytics implementation, advertising SDK, Messaging,
  Authentication and `firebase-crashlytics-ndk`. See
  `../technical/GridView_Observability.md`.

- **Data Safety declaration (blocking for release).** The Play Data Safety form
  must be updated before publishing to cover what Firebase may process in a
  production build: Firebase Installation IDs and Crashlytics Installation
  UUIDs, IP addresses, crash traces and exception information, device/OS/RAM/
  disk/network metadata, session lifecycle data, and Performance Monitoring
  configuration traffic. GridView itself sets no Firebase user identifier and
  attaches no domain IDs, URLs or payloads as attributes — its non-fatal reports
  carry four enum-derived values. This item records technical behaviour; the
  declaration needs a legal/privacy review, not an engineering assertion.

- **Privacy policy URL (blocking for release).** `PRIVACY_POLICY_URL` is still
  unset, so a production build shows no policy affordance at all. A published
  policy describing the collection above, plus the URL, is a release blocker.

- **Symbol handling.** Dart obfuscation is **not** enabled: no `--obfuscate` or
  `--split-debug-info` is used in any build or CI workflow, so there is no
  Flutter symbol file to upload and Dart stack traces in a non-obfuscated release
  are already readable.

  Android minification **is** enabled, contrary to what this document previously
  recorded. `android/app/build.gradle` sets only `signingConfig` on the `release`
  build type, but the Flutter Gradle plugin sets `minifyEnabled true` and
  `shrinkResources true` on it, so every release variant runs R8 and produces
  `build/app/outputs/mapping/<variant>/mapping.txt`. The JVM side of a production
  release is therefore obfuscated.

  **Mapping upload is off by default and is not part of ordinary verification.**
  It requires the production flavor, the `release` build type *and* the explicit
  Gradle property `gridviewCrashlyticsUploadMapping=true`; with the property
  absent — every local build and every CI job — no variant can upload. An
  ordinary local production release build therefore generates the mapping and
  uploads nothing.

  **A published production release must still have its mapping uploaded**, or
  JVM frames in its crash reports are unreadable. That is the authorized release
  step's job: it sets
  `ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping=true` for its own single
  invocation and retains the task output as the record that the upload occurred.
  A local temporary directory is not such a record. See
  `../technical/GridView_Observability.md` §3.1.

  Native crashes are not captured at all: `firebase-crashlytics-ndk` is
  deliberately absent.

- **Firebase operational verification (blocking for Phase 8 closure).** No
  crash, non-fatal or performance trace has been observed arriving in Firebase
  Console. That requires an authorized release-like production build and console
  access. Automated tests, a successful `Firebase.initializeApp()` and a
  completed Gradle task are **not** evidence of delivery.
