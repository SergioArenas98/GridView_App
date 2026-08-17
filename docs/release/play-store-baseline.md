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
  carry five owned custom keys whose values are enum-derived or fixed bounded
  constants. This item records technical behaviour; the
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

  **The Phase 8C-1 mapping-upload incident remains possible and unverified in
  both directions** — it can be neither confirmed nor ruled out, because no
  retained record covers the window. It is recorded in
  `../technical/GridView_Observability.md` §9.4 and must not be restated as
  either "it happened" or "it did not". Phase 8C-2 performed **no** mapping or
  symbol upload, and neither did Phase 8C-3.

  `firebase-crashlytics-ndk` is deliberately absent, so crashes originating in
  **native (C/C++) libraries** are not captured. Android runtime and JVM
  failures remain in Crashlytics scope.

- **Firebase operational verification — DONE (Phase 8C-2, 2026-08-16).** No longer
  a blocker. Both passes are confirmed in Firebase Console.

  The **release-like** pass ran from a signed, R8-minified production **release
  APK** on the dedicated emulator, because a debug build does not exercise release
  compilation or artifact behaviour. `minifyProductionReleaseWithR8` executed, the
  installed package was **not debuggable**, and its SHA-256 matched the artifact
  just built. Its controlled fatal is **Console-confirmed** — matched by a unique
  release-like marker and its exact UTC timestamp, for `1.2.1 (7)` on Android 16,
  classified as a **fatal** failure, one event affecting one installation, carrying
  `environment=production`, `failure=fatal` and `notApplicable` for `feature`,
  `operation` and `preference`. Its `gv_sync_run` sample is Console-confirmed for
  `1.2.1 (7)` at approximately **9.71 s**; `outcome=success` rests on retained SDK
  evidence and was not independently displayed in Console. That APK was installed
  only on the dedicated emulator; **no AAB was produced, nothing was published**,
  and mapping upload stayed fail-closed — the verbose build log contains no
  `uploadCrashlyticsMappingFile`/`uploadCrashlyticsSymbolFile` task at all, and no
  `-x` exclusion was used. **Exactly one additional fatal and one additional
  Performance sample were produced, under explicit authorization; no additional
  non-fatal was generated.**

  The earlier production-**debug** pass is fully confirmed:
  - the fatal arrived for `1.2.1 (7)` at 11:39:45 UTC, classified by Firebase as
    fatal;
  - the non-fatal arrived for `1.2.1 (7)` at 11:31:25 UTC as one recoverable
    event, signature
    `ObservedFailure(localPreferenceFailure|settings|preferenceWrite|timeDisplay)`;
  - both carry the complete five-key normalized context with the correct
    `notApplicable` sentinels, and the fatal inherited none of the preceding
    non-fatal's context;
  - no raw preference key, user data, URL or Firebase identifier was exposed, and
    no GridView user identifier is set — Console's "1 affected user" reflects one
    affected *installation*;
  - `gv_sync_run` is visible for `1.2.1 (7)`, one sample, ≈ 3.19 s. Its
    `outcome=success` attribute rests on retained SDK evidence and was **not**
    independently visible in the reviewed Console screenshot.

  `gv_database_open` was not observed and is not expected to be: it is a
  best-effort trace normally missed during startup for a documented timing reason.
  That is an accepted design decision, not an outstanding item.

  The distinction that made this meaningful still holds for any future claim:
  automated tests, a successful `Firebase.initializeApp()` and a completed Gradle
  task are **not** evidence of delivery, and neither is an accepted HTTP batch —
  only a Console record is. Equally, one controlled event proves delivery for that
  path at that moment; it does not guarantee future availability or behaviour under
  every device condition.

  Phase 8C-2 changed **no** Firebase configuration, product, retention, alert,
  permission or billing setting, created no project or app, deleted nothing
  remotely, produced **no AAB**, performed no Play Console operation, and uploaded
  no mapping file or native symbols — mapping upload remained fail-closed and
  unauthorized throughout. All three controlled events remain stored in the
  production Firebase project. Both temporary verification harnesses were fully
  removed and must not be reintroduced.

- **Accessibility state (added Phase 8C-3).** GridView retains an automated
  accessibility baseline — 111 `test/a11y` tests inside a 1977-test suite,
  covering semantics, reading order, touch targets, contrast, reduced motion and
  200% text in EN and ES. One **populated** TalkBack review was executed on a
  dedicated emulator with human-heard confirmation.

  **No accessibility certification is claimed**, and Google Play has not reviewed
  or approved GridView's accessibility state.

  That review confirmed four duplicate-announcement findings, a
  focus-restoration gap and one unrepeated keyboard observation. They are
  **documented and unfixed** in `../technical/GridView_Accessibility.md` §4 and
  are **non-blocking product debt** under the current product-priority decision:
  each affects only how a screen reader narrates an otherwise complete,
  correctly ordered and fully touch-operable screen.

  Accessibility warnings may still appear in Play's pre-launch report. **Review
  them during release preparation.** Escalate one only if it prevents a core
  flow, hides required content, creates an unusable touchscreen interaction, or
  reveals a broader functional regression — the known findings do not meet that
  threshold.

- **Performance acceptance (added Phase 8C-3).** Provisional measurements exist
  in `../technical/GridView_Performance.md`, taken on a **flagship** reference
  handset with **no approved media present**. **Representative mid-range
  performance acceptance remains open and is deferred to Phase 10**; real-media
  decode and populated cache-pressure measurements are deferred to the
  media-publication owner. Neither is satisfied, and neither is a release
  blocker on its own — but neither may be described as passed.

## Remaining release blockers

Unchanged by Phase 8C-2, and both still open:

1. **Privacy-policy URL not configured** — `PRIVACY_POLICY_URL` is unset, so a
   production build shows no policy affordance.
2. **Play Data Safety declaration outstanding** — must cover the Firebase
   processing categories listed above; needs legal/privacy review.

Plus the pre-existing items above: every `PENDING` Play Console value, and the
Android NDK version decision before the first release AAB.

**External prerequisites, still open and owned outside engineering.** None is
marked complete: Formula 1 **media rights and attribution approval**, **R2
provisioning**, media upload and manifest publication (no R2 bucket exists in any
environment, so nothing has ever been published); and **production provider legal
approval** with the production provider itself. These are tracked in
`../technical/GridView_Implementation_Plan.md`.

**Phase 8C-2 itself is complete** — nothing about Firebase observability is
outstanding. Every other pre-existing release requirement remains governed by
`../technical/GridView_Implementation_Plan.md`.

## Known limitations (not blockers)

- **No NDK / native-library crash capture.** `firebase-crashlytics-ndk` is
  deliberately absent and **explicitly outside ADR 0016's scope**, so crashes
  originating in C/C++ libraries are not recorded; Android runtime and JVM failures
  still are. Adding it is a possible future enhancement requiring its own scope
  decision. It does **not** need to be implemented before release, and must not be
  recorded as a blocker.
- **`gv_database_open` is best-effort** and normally absent on startup, for the
  timing reason documented in `../technical/GridView_Observability.md` §6. An
  accepted design decision, not an outstanding item.
