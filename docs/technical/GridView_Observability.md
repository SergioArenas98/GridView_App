# GridView Observability

Status: **Phase 8C-1 code complete, external observability verification
pending.** The code, gates, tests and builds described here are done and
verified locally. **No crash, non-fatal or trace has been observed arriving in
Firebase Console**, because that requires an authorized release-like production
build and console access. A green test suite, a successful
`Firebase.initializeApp()`, a completed Gradle task and a compiled custom trace
are evidence about *code*, never about telemetry delivery.

Decisions: [ADR 0016](../adr/0016-production-only-firebase-observability.md)
(environment isolation, native collection policy and non-blocking activation)
and [ADR 0017](../adr/0017-selected-non-fatal-reporting.md) (non-fatal
allowlist, single ownership and redaction).

---

## 1. Architecture

Application code depends on two small interfaces and never on Firebase.

```
lib/core/observability/
  observed_failure.dart          ObservedFailureKind / Feature / Operation / ObservedFailure
  error_reporter.dart            ErrorReporter, Noop…, Guarded…
  performance_tracer.dart        TraceName, TraceOutcome, PerformanceTracer, Noop…, Guarded…
  observability_status.dart      ObservabilityStatus, StaticObservabilityStatus
  observability.dart             Observability (reporter + tracer + status), eligibility
  observability_policy.dart      ObservabilityPolicy, NonFatalThrottle
  throttled_error_reporter.dart  non-fatal flood suppression
  deferred_observability.dart    Deferred reporter (bounded startup buffer) + tracer
  global_error_handlers.dart     install + ownership-aware restoration
  observability_bootstrap.dart   installObservability — the orchestration seam
  observability_providers.dart   Riverpod wiring
  firebase/
    firebase_observability.dart  the ONLY file importing firebase_*
```

`lib/features/shared/data/sync/sync_observation.dart` maps synchronization
outcomes onto the reporting policy. It is the only place that decides what
synchronization reports.

**The boundary is enforced by a test.** `observability_isolation_test.dart`
scans `lib/` and asserts that exactly one file imports `package:firebase_`.

No service locator was added; the surface is supplied through the existing
Riverpod composition root.

## 2. What is actually packaged

**Firebase native components ship in every flavor.** The Dart packages
`firebase_core`, `firebase_crashlytics` and `firebase_performance` are ordinary
dependencies, so their Android artifacts — and everything those pull in — are in
the dev, staging and production APKs alike. `FirebaseInitProvider` and the
component registrars appear in all three merged manifests. What is
production-only is the *Firebase configuration* (`google-services.json`) and the
two build tasks that consume it (§3) — not the plugins, and not the SDKs.

Resolved on every variant's runtime classpath, verified by the Gradle gate
`verify<Variant>FirebaseDependencies`:

| Artifact | Why it is there |
|---|---|
| `firebase-crashlytics` | intentional |
| `firebase-perf` | intentional |
| `firebase-config` (**Remote Config**) | **transitive** — Performance Monitoring declares it and uses it for its own internal configuration |
| `firebase-abt` (A/B Testing) | transitive, pulled by `firebase-config` |
| `firebase-installations` | transitive — provides the Firebase Installation ID |
| `firebase-sessions` | transitive — session lifecycle |
| `firebase-measurement-connector` | transitive **interop stub**, not an Analytics implementation |
| `firebase-datatransport` | transitive — the upload backend |

Absent, and asserted absent by the same gate: `firebase-analytics` and
`firebase-analytics-impl`, `play-services-measurement*`, `play-services-ads*`,
`firebase-messaging`, `firebase-auth`, `firebase-crashlytics-ndk`.

Precisely stated:

- GridView has **no direct Remote Config Dart API and no Remote Config product
  feature**. The native component is present because Performance Monitoring
  requires it.
- GridView includes **no Firebase Analytics implementation** and records no
  Analytics events. A measurement-connector artifact is transitive and is not
  the Analytics implementation.
- **No NDK crash capture.** `firebase-crashlytics-ndk` is not a dependency, so
  native crashes are not captured at all. Nothing in this integration should be
  read as claiming otherwise.

A Dart lockfile cannot show any of this, which is why the Dart-side test is
scoped to *direct Dart packages* and the Android facts live in the Gradle gate.

## 3. Android build integration

Three build-time plugins, declared in `android/settings.gradle` and applied
**unconditionally** in `android/app/build.gradle`:

| Plugin | Version | Provides |
|---|---|---|
| `com.google.gms.google-services` | 4.4.4 | generates `google_app_id`, `project_id`, API-key string resources |
| `com.google.firebase.crashlytics` | 3.0.7 | build/mapping ID injection, mapping and native-symbol upload tasks |
| `com.google.firebase.firebase-perf` | 2.0.2 | Performance build-time configuration and instrumentation |

They were previously applied only when the requested task name contained
"production". That was never an application boundary: `gradlew assemble`,
`build`, `assembleRelease`, `bundle` and IDE-driven configuration all build
production variants without naming them, so each of those paths produced a
production artifact with no Google Services processing, no Crashlytics injection
and no environment validation — and a mixed-flavor invocation had the opposite
failure, applying production tooling to dev.

What is genuinely production-only is not plugin *application* but two **tasks**,
scoped by variant rather than by what someone typed:

| Task | Enabled for | Why |
|---|---|---|
| `process<Variant>GoogleServices` | production only | `google-services.json` registers `com.sejuma.gridview` alone — there is no `.dev` or `.staging` client, and non-production must stay buildable with no Firebase configuration at all |
| `uploadCrashlyticsMappingFile<Variant>` | production only | resolves the Firebase application ID from the Google Services output non-production does not have, and uploads over the network |

Everything else the plugins register is harmless off production:
`injectCrashlyticsMappingFileId<Variant>` and
`injectCrashlyticsVersionControlInfo<Variant>` exist for every variant, need no
configuration file, and write a build-local resource. Their presence in a dev
task graph is expected, and is not evidence of a dev Firebase integration —
without `google_app_id` there is no project to report to.

**Release builds are minified, so mapping upload is real.** The Flutter Gradle
plugin sets `minifyEnabled true` and `shrinkResources true` on the `release`
build type; this project's `build.gradle` does not set either. Every release
variant therefore runs R8 and produces a real
`build/app/outputs/mapping/<variant>/mapping.txt`. That is exactly why the upload
task must be scoped: before it was, `assembleStagingRelease` reached
`uploadCrashlyticsMappingFileStagingRelease` with no Firebase application ID to
resolve. Debug and profile builds are not minified and have no mapping file.

**Applying the Performance plugin does not make Firebase observe GridView's
network traffic.** Its automatic instrumentation hooks Android's HTTP stacks;
Dio issues requests through Dart's own `dart:io` sockets. The plugin completes
the supported Android integration — the two custom Dart traces in §6 remain the
evidence-backed instrumentation.

## 4. Collection policy — the native boundary

The Dart eligibility gate **cannot** be the collection boundary. Android
instantiates `FirebaseInitProvider` during application startup, before any Dart
code runs, so a Dart-side check can only decide what the Dart adapters do
afterwards.

`android/app/src/main/AndroidManifest.xml` therefore declares, for **every**
flavor:

```xml
<meta-data android:name="firebase_crashlytics_collection_enabled"  android:value="false" />
<meta-data android:name="firebase_performance_collection_enabled"  android:value="false" />
```

Merged-manifest values, verified per flavor:

| Flavor | crashlytics | performance | `firebase_performance_collection_deactivated` | `google_app_id` |
|---|---|---|---|---|
| dev | `false` | `false` | not declared | absent |
| staging | `false` | `false` | not declared | absent |
| production | `false` | `false` | not declared | present |

The eligible production build opts in at runtime, in
`activateFirebaseObservability`, via `setCrashlyticsCollectionEnabled(true)` and
`setPerformanceCollectionEnabled(true)`. The permanent
`firebase_performance_collection_deactivated` flag is deliberately **not** used:
it cannot be reversed at runtime and would disable the production build this
integration exists for.

For dev and staging the missing `google_app_id` is a second, independent
obstacle — the default `FirebaseApp` cannot initialize without it. It is not the
policy. The manifest flags are, and they stay correct even if a configuration
file is introduced later by accident.

## 5. Environment identity and the build gate

Two environment identities used to exist independently — the Android product
flavor and the Dart `APP_ENV` define — and nothing compared them until after
native startup. `android/app/build.gradle` now binds them:

```groovy
ext.requiredAppEnvForFlavor = [dev: "development", staging: "staging", production: "production"]
```

`validate<Variant>Environment` runs in the assembled variant's build graph and
fails the build before an installable artifact is accepted.

| Flavor | `APP_ENV` | Result |
|---|---|---|
| dev | development | builds |
| staging | staging | builds |
| production | production | builds |
| dev | production | **build fails** — flavor/APP_ENV mismatch |
| staging | production | **build fails** — flavor/APP_ENV mismatch |
| production | development | **build fails** — flavor/APP_ENV mismatch |
| production | *(missing)* | **build fails** — missing `--dart-define=APP_ENV` |
| any | supplied twice | **build fails** — even when the two values agree |

Duplicates fail on purpose. Two sources disagreeing about the environment is a
configuration fault whether or not they happen to match today, and silently
picking one is how the flavor and the environment drifted apart to begin with.

**Where the gate is attached matters.** It hangs off each variant's *resource
merge*, not its pre-build. `variant.preBuildProvider` is genuinely per-variant
and would be the obvious earlier choice, but AGP keys native-build configuration
by build type and ABI alone — `configureCMakeDebug[arm64-v8a]` and friends —
and each of those depends on **every** flavor's pre-build of that build type.
This project has a native build, so `assembleDevDebug` pulls in
`preProductionDebugBuild`; a gate anchored there made a dev build run the
production validator and fail. Resource merging carries no such coupling.
`verifyAndroidBuildPolicy` asserts both halves — the gates are on the resource
merge, and they are *not* on the pre-build — so the regression cannot return
unnoticed.

Two tasks make this a repository-owned regression gate rather than a manual
observation, and both run in CI:

| Task | Asserts |
|---|---|
| `:app:verifyAppEnvParser` | the dart-define parser against synthetic input — missing, unknown, mismatched and duplicate `APP_ENV`, values containing `=` or `,`, malformed Base64, an undeclared flavor |
| `:app:verifyAndroidBuildPolicy` | over all nine variants: the three plugins are applied; `process<Variant>GoogleServices` and `uploadCrashlyticsMappingFile<Variant>` are enabled for production only; Crashlytics mapping-ID injection exists for production; both gates are wired to the resource merge and neither is wired to the pre-build |

Neither needs a secret, signing key, device or network beyond the dependency
resolution an ordinary build already performs.

Dev and staging still build with no Firebase configuration file.

## 6. Activation, status and startup

```
WidgetsFlutterBinding.ensureInitialized()
installObservability(environment)            <- installs handlers synchronously
    not eligible -> delegates disabled, status = disabledByPolicy
    eligible     -> status = pending, activation started, NEVER awaited
ensureTimeZonesInitialized() / preferences   <- local only
runApp(...)
    activation resolves -> status = activated | unavailable
```

`ObservabilityStatus` has four values: `disabledByPolicy`, `pending`,
`activated`, `unavailable`. `activated` means *this process's Dart adapters are
attached*; it is not a claim that any payload reached Firebase.

Errors arriving in the activation window are **buffered in memory**, bounded at
16 reports, replayed exactly once and in order on adoption, and discarded
without throwing if activation fails. Overflow **drops the newest and keeps the
oldest** — the first failure in a cascade explains the rest. Nothing is
persisted, and a replay failure cannot become a new uncaught error.

Observability initialization issues no API request, opens no database, schedules
no synchronization and touches no media.

### Fatal-error ownership

| Boundary | Owns | Reports |
|---|---|---|
| `FlutterError.onError` | framework errors, and converted async errors | **yes — sole reporter** |
| `PlatformDispatcher.instance.onError` | uncaught root-isolate async errors | **no** — converts and returns `true` |
| guarded zone | *not used* | n/a |

Restoration is **ownership-aware**: each handler is reinstated only if the
currently installed value is still the exact closure this registration
installed, so a later owner is never overwritten. Restoration is idempotent.

There is no force-crash control, hidden crash route or automatic test exception
anywhere in the app.

### Non-fatal policy — one owner per failure

| Kind | Reported by | Trigger |
|---|---|---|
| `invalidRemoteContract` | refresh boundary | `invalidResponse`, **including payloads rejected by DAO validation** |
| `unsupportedApiVersion` | refresh boundary | `unsupportedApiVersion` |
| `impossibleConfiguration` | refresh boundary | `configuration` |
| `localDatabaseFailure` | persistence boundary | a non-validation error escaping the snapshot transaction |

The three typed validation exceptions (`InvalidEntityException`,
`InvalidSeasonEntriesException`, `InvalidMediaOwnershipException`) are **not**
reported at the persistence boundary. They reject a *remote payload*, and
`SyncedRepository` converts each into `RefreshFailure(invalidResponse)`, so the
refresh boundary is the single owner. Reporting both produced two non-fatals for
one fault under two signatures the throttle could not collapse, one of which
blamed local persistence for a service defect. There is consequently no
`persistenceInvariantViolation` member.

Never reported: offline, timeout, cancellation, revalidation, rate limiting,
server unavailability, maintenance, not-found, invalid request, unknown server
codes, missing or failed media, empty data, stale-but-usable data.

Context is four enum fields — failure, feature, operation, environment. No field
can hold an identifier, URL, query string, payload, credential, KV key or
exception text. Repeats of a signature are suppressed for five minutes; fatals
are never throttled.

### Traces

| Trace | Wire name | Frequency |
|---|---|---|
| database open | `gv_database_open` | once per `GridViewDatabase` instance — in practice once per `ProviderScope`, **not** once per OS process |
| sync run | `gv_sync_run` | once per startup / genuine foreground / manual run; the coordinator serialises runs, so two are never open at once |

Each records a two-valued `outcome` attribute (`success` / `failure`) and stops
in a `finally`. There is deliberately **no `cancelled`**: a cancelled
synchronization run completes normally, so the trace boundary cannot distinguish
it and inventing the value would misreport it.

## 7. Privacy and data processing

**What GridView does.** It sets no Firebase user identifier, and attaches no
GridView domain IDs, slugs, URLs, query strings, synchronized payloads or
exception text as observability attributes. Its non-fatal reports carry four
enum-derived values; its traces carry a two-valued outcome.

**What Firebase may process** once collection is enabled in a production build:

- Firebase Installation IDs and Crashlytics Installation UUIDs;
- IP addresses, as an unavoidable property of the SDKs' network calls;
- crash traces and exception information;
- device, OS, RAM, disk and network metadata;
- session lifecycle data (`firebase-sessions`);
- Performance Monitoring configuration traffic, which uses Remote Config
  internally.

That list replaces the earlier absolute claim that no personal data is involved.
The narrower and accurate statement is the one above: **GridView does not
intentionally attach identifying data; the Firebase SDKs process the categories
listed.** No legal conclusion is drawn here — this records technical behaviour
so the privacy and Data Safety review can be accurate.

**Settings → Privacy** reports the live `ObservabilityStatus` (Disabled /
Starting / Enabled / Unavailable) and states that diagnostic components are
included in every version of the app while transmission is restricted by policy.
It never claims diagnostics are running merely because the build was eligible,
and it exposes no technical identifier, URL or exception detail. English and
Spanish copy are maintained in parity.

**Google Play Data Safety** must be updated before release to cover the
categories above. **The hosted privacy-policy URL remains unset and is an
external release blocker.**

## 8. Symbols and obfuscation

- Dart obfuscation is **not** enabled; no `--obfuscate` or `--split-debug-info`
  anywhere. Flutter symbol upload is therefore **not currently applicable**.
- Android minification is **not** enabled (`release` sets only `signingConfig`),
  so no mapping file is produced and none is uploaded. The Crashlytics plugin's
  upload tasks exist but have nothing to upload.
- **No NDK crash capture**, by dependency: `firebase-crashlytics-ndk` is absent.
- No symbols were uploaded and no test crash or trace was sent.

## 9. Verification status

**Not verifiable from this repository:** a real Crashlytics fatal, a selected
non-fatal or a Performance trace arriving in Firebase Console; dev/staging
observability (no projects exist); Data Safety accuracy; the hosted privacy
policy. Sending a test event is prohibited during this local phase.

## 10. Known follow-ups

- `firebase_performance` applies its own Kotlin Gradle Plugin; Flutter warns
  that future versions will fail to build for apps whose plugins do this.
- Gradle 8.11.1, AGP 8.9.1 and Kotlin 2.0.21 are below the versions Flutter
  warns it will soon require. Pre-existing.
- Three Privacy-screen golden baselines need regeneration through the Linux
  canonical workflow after the copy change in this phase (see the testing docs).
