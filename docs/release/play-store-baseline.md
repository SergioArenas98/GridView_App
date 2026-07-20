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
