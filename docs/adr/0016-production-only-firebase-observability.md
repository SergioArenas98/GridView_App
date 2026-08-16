# ADR 0016: Production-only Firebase observability behind an application boundary

- Status: Accepted
- Date: 2026-08-13

## Context

Phase 8C-1 adds crash reporting and performance monitoring. The repository owns
exactly one Firebase configuration:
`android/app/src/production/google-services.json`, project `gridview-fb20f`,
registered for the Android package `com.sejuma.gridview`. That is the real
production application id of the published app.

Dev and staging builds carry `applicationIdSuffix` `.dev` and `.staging`, so
that configuration does not describe them. There is no dev or staging Firebase
project, and creating one needs account access and approval that do not exist in
this repository.

Two failure modes were available and both had to be closed:

1. **Pointing non-production builds at the production project.** It is the
   easiest thing to do — the configuration is right there — and it poisons the
   published app's crash data with developer noise, sends test traffic to a
   project the release depends on, and makes every Crashlytics number untrue.
2. **Making observability a startup dependency.** Firebase initialization is
   platform and network adjacent. Awaited before `runApp`, a slow or wedged
   handshake becomes a slow or wedged launch, and the app's own guarantee that
   the shell and cached content render before any remote work would be broken by
   the very system meant to observe it.

## Decision

**Production is the only eligible environment for the Dart adapters.**
`isObservabilityEligible` returns true only for `AppEnvironment.production`.
Everything else resolves to an inert surface.

**But eligibility cannot be the collection boundary, and this ADR does not
pretend otherwise.** The Dart packages are not flavor-scoped, so the native
Firebase components — `FirebaseInitProvider` and the Crashlytics, Performance,
Sessions, Installations, Remote Config and ABT registrars — are packaged in
every flavor, and Android instantiates the provider during application startup,
before any Dart code runs. The real boundary is therefore the manifest:
`firebase_crashlytics_collection_enabled=false` and
`firebase_performance_collection_enabled=false` for all flavors, with the
eligible production build opting in at runtime. The permanent
`firebase_performance_collection_deactivated` flag is not used, because it could
not be reversed for the production build this integration exists for.

For dev and staging the missing `google_app_id` is a second, independent
obstacle. It is not the policy, and it would stop being an obstacle the moment a
configuration file was added by accident; the manifest flags would not.

**The manifest is a starting default, not a per-launch guarantee.** The runtime
opt-in is persisted by the platform SDKs and read at a higher priority than the
manifest, so it outlives the process. A production installation begins its first
launch with collection off, turns it on when activation succeeds, and begins
**every later launch with collection already on, before Dart runs**. This is
accepted deliberately: it is how the Android SDKs implement a reversible opt-in,
and the alternative — the permanent deactivation flag — cannot be reversed at
all.

Two consequences follow, and both are load-bearing. First, the claim that the
packaged SDKs are "inert from process start in every flavor" is false after the
first successful production activation, and has been removed everywhere. Second,
a failed activation proves only that *this process's* Dart adapters were
unavailable; it is not evidence that a persisted native override is off. Nothing
may present it as such — which is why the user-facing screen discloses the
build's `DiagnosticsPolicy` and reports activation only as a scoped statement
about this app's own reporting.

Dev and staging are unaffected structurally, not by convention: separate
application IDs mean separate installations and storage, they own no Firebase
configuration, and `activateFirebaseObservability` is never called for them, so
no override can ever be written for them.

**Flavor and `APP_ENV` are bound at build time.** They used to be independent
identities compared only after native startup, which allowed a production
artifact whose Dart layer believed observability was off while the native SDKs
were fully configured, and the inverse. `validate<Variant>Environment` now fails
the build unless they match, and fails when `APP_ENV` is absent.

The absence of dev/staging Firebase projects is recorded as an **external
blocker**. It is not permission to reuse the production one.

**Firebase lives behind one application-owned boundary.** Application code
depends on `ErrorReporter` and `PerformanceTracer`. Exactly one file —
`lib/core/observability/firebase/firebase_observability.dart` — imports
`firebase_*`, and a test asserts that this stays true. No widget, controller,
repository, DAO, synchronization or media file may import Firebase. This is what
lets dev, staging and the whole test suite run with no Firebase project at all.

No service locator was introduced. The surface is supplied through the existing
Riverpod composition root like every other dependency.

**Activation never blocks the first frame.** `bootstrap` installs the global
error handlers synchronously against a `DeferredErrorReporter`, so startup
errors already have an owner, then activates Firebase with `unawaited`. The
delegates start as no-ops and adopt the real implementations if and when
activation succeeds. `activateFirebaseObservability` returns `null` instead of
throwing, so failure, absence of configuration, an unsupported platform or a
handshake that never returns all degrade to the same inert behaviour.

Adoption is one-way and idempotent: the first real implementation wins, so a
duplicated or late activation cannot swap the target underneath a running app.

**The documented Android integration is applied, not skipped.** The
`com.google.firebase.crashlytics` (3.0.7) and `com.google.firebase.firebase-perf`
(2.0.2) Gradle plugins are applied alongside `com.google.gms.google-services`.

All three are applied **unconditionally**. They were first applied only when the
requested task name contained "production", which is not an application
boundary: `assemble`, `build`, `assembleRelease`, `bundle` and IDE-driven
configuration all build production variants without naming them, so those paths
produced production artifacts with none of this tooling, while a mixed-flavor
invocation applied production tooling to dev. Production scoping now attaches to
the two tasks that actually consume the production configuration —
`process<Variant>GoogleServices` and `uploadCrashlyticsMappingFile<Variant>` —
which is a property of the variant being built rather than of the command line.

**Variant scoping was necessary but not sufficient for the upload task.** Scoping
it to the production flavor stopped staging from reaching it, but left a network
write to the published project as an ordinary side effect of compiling a
production release locally — and one such possible, unverified upload occurred
during this phase's own verification. Local compilation must not mutate remote
state. Mapping upload therefore now requires three independent conditions: the
production flavor, the `release` build type, and the explicit Gradle property
`gridviewCrashlyticsUploadMapping=true`, evaluated exactly and case-sensitively,
with a present-but-unusable value throwing rather than defaulting either way.

Two boundaries enforce it, because the supported plugin switch cannot express
the whole rule: the official `mappingFileUploadEnabled` is build-type scoped, so
it carries the authorization half and keeps the plugin from registering the task
at all by default, while a per-variant task gate adds the production-flavor half.
`-x` is explicitly rejected as a mechanism: a safe default that depends on the
operator remembering a flag is not a default.

Crashlytics build-ID and version-control-info injection run for every variant;
they need no configuration file and identify no project. Mapping upload is
production-only and does real work there: the Flutter Gradle plugin minifies the
`release` build type, so every release variant produces a mapping file.

Applying the Performance plugin completes the supported integration; it does
**not** make Firebase observe Dio traffic, which goes through `dart:io` sockets.

**Native crash capture is out of scope.** `firebase-crashlytics-ndk` is absent
and stays absent without separate authorization, so native crashes are not
captured.

**No new Firebase artifacts.** No `firebase_options.dart`, no
`flutterfire configure`, no new project, no new configuration file. The default
app is read from the native resources the Google Services Gradle plugin compiles
in.

## Consequences

- Crash and performance data exist only for production builds. Verifying them
  requires a production artifact and Firebase Console access, which is why Phase
  8C-1 was reported as *code complete, external verification pending*. **That
  verification was carried out in Phase 8C-2 (2026-08-16) and the decisions above
  hold in practice**, in two passes. From a production **debug** build, a
  controlled fatal, a controlled non-fatal and the `gv_sync_run` trace were
  confirmed in Firebase Console; the **two crash reports** carried the complete
  five-key normalized context with correct sentinels and no inherited context.
  That five-key context is a property of fatal and non-fatal **reports** only — a
  custom trace carries the two-valued `outcome` attribute and nothing else, so
  `gv_sync_run` must never be described as carrying the crash schema.
  A production debug build proves flavor selection and Firebase routing, because
  eligibility keys off `APP_ENV` rather than the build type, but it does not
  exercise release compilation, R8/minification or release artifact behaviour. A
  second pass therefore ran from a signed, R8-minified production **release APK**
  (`minifyProductionReleaseWithR8` executed; the installed package was **not**
  debuggable and matched the built artifact). Its controlled fatal is
  **Console-confirmed** by unique marker and timestamp, classified fatal, with the
  five owned keys correct; its `gv_sync_run` is Console-confirmed at ≈ 9.71 s,
  though `outcome=success` rests on retained SDK evidence rather than direct
  Console display. **Phase 8C-2 is therefore complete**, and the implementation
  plan's release-like criterion was satisfied rather than weakened. Mapping upload
  remained absent and unauthorized — never `-x`-excluded — and no AAB was built or
  published. See `../technical/GridView_Observability.md` §9.
- Dev and staging are observably inert. A developer cannot "test Crashlytics
  locally" — deliberately, because the only way to do so would be to send
  developer crashes to the published app's project.
- A production build whose Firebase initialization fails is indistinguishable
  from an inert one at runtime, and the app is unaffected. This is the intended
  trade: observability degrades silently rather than degrading the app. It also
  means failure is not information: the app cannot tell a first-ever failure
  from a failure on an installation carrying a persisted collection override, so
  it reports the failure as unconfirmed rather than as anything being off.
- Because the traced and reported paths are inert outside production, their
  behaviour is proven by tests against fakes rather than by observing real
  telemetry. A green suite is evidence about code, never evidence of delivery.
- Build proof of the isolation is mechanical: a production build runs
  `processProductionDebugGoogleServices` and emits resources containing
  `google_app_id` and `project_id`; the same task is disabled for dev and
  staging, so their artifacts carry neither. The Crashlytics *injection* tasks
  run for every variant and are not part of this proof — they identify no
  project. `verifyAndroidBuildPolicy` asserts the enablement pattern for all
  nine variants in CI, so this is a regression gate rather than a one-off
  observation.
- Remote Config and ABT ship in every APK as transitive components of
  Performance Monitoring. GridView has no Remote Config Dart API and no product
  feature using it, but the components are present and must be disclosed.
- The Privacy screen discloses the build's `DiagnosticsPolicy` for crash and
  performance reporting, and reports `ObservabilityActivation` only as a scoped
  statement about this app's own reporting during the current session. It cannot
  claim diagnostics are running before activation finishes, and it cannot claim
  collection is off after activation fails.
- **Non-blocking activation costs the startup measurements, and that price is
  accepted.** Because activation is never awaited, anything traced before the
  deferred tracer adopts runs untraced. Phase 8C-2 measured the window on a real
  device: the database is opened lazily during the first frame, ~1–2 s after Dart
  startup, while activation completed ~2.1–3.9 s after it. The database is opened
  at most once per `GridViewDatabase` instance — in practice once per
  `ProviderScope`, and the ordinary shell has one — so `gv_database_open` is
  normally **absent**, and the **startup** `gv_sync_run` is lost the same way;
  later foreground, resumed and manual runs are recorded normally, and one such run
  is what Phase 8C-2 confirmed in Console. The instrumentation is kept as a best-effort signal — a scope
  created after adoption still produces the trace — and is explicitly **not**
  repaired by replaying it (Firebase's `Trace` API cannot backdate a start, so the
  duration would be fabricated), by delaying the database open, or by restructuring
  activation. Any of those would trade this ADR's central invariant for one
  optional measurement. `../technical/GridView_Observability.md` §6 records the
  detail.
- **The persisted collection override was externally observed**, not merely
  derived from the SDK contract: on a fresh installation the SDK reported
  collection disabled by the manifest default, activation enabled it by API, and
  every later launch enabled it by API at process start — roughly 4.7 s before Dart
  ran. The manifest value is confirmed to be a fresh-install default rather than a
  per-launch enforcement boundary, exactly as decided above. Dev and staging remain
  structurally isolated and were not, and cannot be, affected.
- No NDK or native-library crash support is included. This is a **known
  limitation and explicitly outside this ADR's scope**, not a release blocker:
  adding `firebase-crashlytics-ndk` is a possible future enhancement that needs its
  own scope decision, and nothing may record it as work required before release.
- **No build performed by a developer or by CI can mutate remote state.** The
  only network-mutating task is mapping upload, and it is off unless explicitly
  authorized. The cost is that a real release now has one deliberate extra step;
  that is the intended trade, because the alternative made every local
  production compile an unannounced write to the published project.

## Alternatives rejected

- **Reuse the production project for dev/staging.** Rejected: it corrupts the
  published app's crash data and sends unapproved traffic to a live project.
- **Generate dev/staging Firebase projects.** Rejected: out of scope and
  unauthorized; requires account access this repository does not have.
- **Await `Firebase.initializeApp()` before `runApp`.** Rejected: makes launch
  depend on a platform/network handshake, contradicting the synchronization
  policy in [ADR 0015](0015-application-synchronization-policy.md) that
  rendering never waits on remote work.
- **A global singleton or service locator for the reporter.** Rejected: the
  project already composes dependencies through Riverpod, and a second
  mechanism would exist solely for observability.
