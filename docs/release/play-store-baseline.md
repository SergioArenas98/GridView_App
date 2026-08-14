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
  flavor-scoped — while the configuration and the three build-time Gradle
  plugins are production-only. Collection is disabled by manifest policy in all
  flavors and enabled at runtime only by an eligible production build.
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

- **Symbol handling (currently not applicable).** Dart obfuscation is **not**
  enabled: no `--obfuscate` or `--split-debug-info` is used in any build or CI
  workflow, so there is no Flutter symbol file to upload and Dart stack traces
  in a non-obfuscated release are already readable. Android minification is not
  enabled either — the `release` build type sets only `signingConfig`, with no
  `minifyEnabled`, `shrinkResources` or R8/ProGuard configuration — so no
  mapping file is produced. The `com.google.firebase.crashlytics` Gradle plugin
  **is** applied for production and registers its mapping-upload tasks; they
  simply have nothing to upload, and the injected mapping ID is the all-zero
  placeholder. **If obfuscation or minification is ever enabled, symbol/mapping
  upload becomes mandatory before release** or production crash reports become
  unreadable. Native crashes are not captured at all: `firebase-crashlytics-ndk`
  is deliberately absent.

- **Firebase operational verification (blocking for Phase 8 closure).** No
  crash, non-fatal or performance trace has been observed arriving in Firebase
  Console. That requires an authorized release-like production build and console
  access. Automated tests, a successful `Firebase.initializeApp()` and a
  completed Gradle task are **not** evidence of delivery.
