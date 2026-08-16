# GridView Observability

Status: **Phase 8C-2 is COMPLETE (2026-08-16).** External Firebase verification is
confirmed in Console from **two** passes:

| Pass | Artifact | Console arrival |
|---|---|---|
| production **debug** | debug build, no R8 | **confirmed** — fatal, non-fatal and `gv_sync_run` all observed |
| production **release** | signed release APK, R8/minified, not debuggable | **confirmed** — controlled fatal and a `gv_sync_run` sample observed |

The release-like pass exists because a debug build proves flavor selection and
Firebase routing but does **not** exercise release compilation, R8/minification or
release artifact behaviour, and
[`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §13.9 requires
crash reports from a staging/release-like build. That criterion is now satisfied;
it was not weakened to get there. See §9.

What this does **not** establish: Play-distributed behaviour, behaviour under every
device or network condition, future Firebase availability, or anything about
mapping/symbol handling — no mapping was ever uploaded.

The distinction that governs every claim here: a green test suite, a successful
`Firebase.initializeApp()`, a completed Gradle task and a compiled custom trace
are evidence about *code*; an accepted HTTP batch is evidence of *submission*;
only Console is evidence of *arrival*. §9 keeps the three separate, and nothing
below may collapse them.

The distinction that governed Phase 8C-1 still governs every future claim here: a
green test suite, a successful `Firebase.initializeApp()`, a completed Gradle task
and a compiled custom trace are evidence about *code*; an accepted HTTP batch is
evidence of *submission*; only Console is evidence of *arrival*. §9 keeps the
three separate, and nothing below may collapse them.

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
  async_error_reporter.dart      AsyncErrorReporter — the fire-and-forget guard
  serial_report_queue.dart       SerialReportQueue — the FIFO reporting lane
  normalized_report_recorder.dart NormalizedReportRecorder — complete key set
  non_blocking_tracer.dart       NonBlockingPerformanceTracer + TraceSession
  preference_observation.dart    PreferenceDiagnostic -> ObservedFailure
  observability_activation.dart  ObservabilityActivation (this process's adapters)
  diagnostics_policy.dart        DiagnosticsPolicy (this build's configuration)
  observability.dart             Observability (reporter + tracer + activation), eligibility
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
  crashes originating in **native (C/C++) libraries** are not captured. This is
  narrower than "no native crashes": Android runtime and JVM failures — Dart
  errors routed through the global handlers, and uncaught Java/Kotlin exceptions
  — remain in Crashlytics scope. What is missing is the signal-level handler
  that records a native segfault or abort.

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
| `uploadCrashlyticsMappingFile<Variant>` | **nothing, by default** — production `release` only, and only under explicit authorization (§3.1) | it is the one task in this build that mutates state outside the machine running it |

Everything else the plugins register is harmless off production:
`injectCrashlyticsMappingFileId<Variant>` and
`injectCrashlyticsVersionControlInfo<Variant>` exist for every variant, need no
configuration file, and write a build-local resource. Their presence in a dev
task graph is expected, and is not evidence of a dev Firebase integration —
without `google_app_id` there is no project to report to.

**Release builds are minified.** The Flutter Gradle plugin sets
`minifyEnabled true` and `shrinkResources true` on the `release` build type; this
project's `build.gradle` does not set either. Every release variant therefore
runs R8 and produces a real `build/app/outputs/mapping/<variant>/mapping.txt`.
Debug and profile builds are not minified and have no mapping file.

### 3.1 Four different things, deliberately not conflated

Local artifacts are routinely mistaken for evidence of an upload. They are not.

| # | Thing | Where it happens | What it proves |
|---|---|---|---|
| 1 | **R8 mapping generation** | local, every minified release variant, always | that the build obfuscated JVM code and wrote `mapping.txt`. Nothing left the machine. |
| 2 | **Mapping-file-ID generation** | local, `injectCrashlyticsMappingFileId<Variant>`, every variant | that a build-local identifier resource was written. It identifies no project and is **not** proof of upload. |
| 3 | **Upload eligibility** | production flavor + `release` build type + explicit authorization | that an upload *would be permitted*. Still not proof one occurred. |
| 4 | **Confirmed remote upload** | requires retained task-level or HTTP success output from the build | the only thing that proves Firebase accepted a mapping file. It **cannot** be inferred from a temporary directory or any local file. |

**Authorization.** Upload requires the Gradle property
`gridviewCrashlyticsUploadMapping`, evaluated exactly and case-sensitively:

| Property state | Result |
|---|---|
| absent | disabled — the normal case for every local build and every CI job |
| exactly `false` | disabled |
| exactly `true` | authorized |
| present but empty | `GradleException` |
| anything else (`TRUE`, `1`, `yes`, padded, typo) | `GradleException` |

A present-but-unusable value fails rather than defaulting, because both defaults
are wrong: silently disabling discards an authorized release upload, and
silently enabling performs an unauthorized one.

Two independent boundaries enforce it. The official Crashlytics DSL
(`mappingFileUploadEnabled`, build-type scoped) is set from the authorization
value on `release`, so with no authorization the plugin does not register the
upload task at all; and the per-variant task gate additionally requires the
production flavor, which the build-type-scoped DSL cannot express.

The property is an authorization switch, not a credential: it holds no secret,
and it is never placed in `gradle.properties`, a CI environment block or a local
template. A future authorized release step — and only that step — may set
`ORG_GRADLE_PROJECT_gridviewCrashlyticsUploadMapping=true` for its own
invocation. The equivalent direct form is
`-PgridviewCrashlyticsUploadMapping=true`, but note that ordinary
`flutter build` commands do not forward arbitrary `-P` arguments to Gradle,
which is why the environment-variable form is the practical one.

**An ordinary `flutter build apk --release --flavor production` generates the
mapping locally and uploads nothing.** No flag, no `-x` and nothing for the
operator to remember: the safe behaviour is encoded in the project
configuration.

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

### 4.1 The runtime opt-in persists, so the manifest is a default and not a rule

The manifest values are the **starting** state of an installation, not a
per-launch guarantee. `setCrashlyticsCollectionEnabled` and
`setPerformanceCollectionEnabled` write a persisted preference that the SDKs
read at a **higher priority than the manifest**, and that preference survives
process death. The consequence, stated plainly for a production installation:

| Launch | Native collection at process start | Why |
|---|---|---|
| first ever | **off** | no persisted override yet, so the manifest `false` applies |
| first ever, after activation succeeds | **on** | the runtime opt-in ran and was persisted |
| every later launch | **on, before Dart runs** | the persisted override outranks the manifest |
| every later launch, if activation then fails | **still on** | the override is unrelated to this process's Dart adapters |

So the claim "the packaged SDKs are inert from process start in every flavor"
is **false for a production installation that has activated at least once**, and
it has been removed. The accurate statement is narrower: *collection starts off
on a fresh installation of any flavor, and only a production build can ever turn
it on.*

**This table was externally observed during Phase 8C-2, not merely derived from
the SDK contract.** On the dedicated clean emulator the Crashlytics SDK logged
`automatic data collection DISABLED by firebase_crashlytics_collection_enabled
manifest flag` on the first launch of a fresh installation, then `ENABLED by API`
once the production activation ran. On every subsequent launch of that same
installation it logged `ENABLED by API` **at process start, roughly 4.7 seconds
before any Dart code ran** — the persisted override, applied ahead of the
manifest, exactly as described above. The manifest value is therefore confirmed
to be a fresh-install default rather than a per-launch enforcement boundary.

Dev and staging remain structurally isolated by their separate application IDs
and their absence of Firebase configuration; nothing in this observation applies
to them, and nothing about it was or could be tested for them.

**Dev and staging are unaffected, and this is structural rather than a
convention.** They carry the `.dev` and `.staging` application-ID suffixes, so
they are different installations with separate storage; they own no
`google-services.json`, so the default `FirebaseApp` cannot initialize; and they
are ineligible, so `activateFirebaseObservability` is never called for them.
There is no path by which an override could be written for a non-production
installation, and none by which a production one could be read by them.

**What a failed activation proves, exactly.** It proves that *this process's*
Dart reporter and tracer were unavailable. It does **not** prove that a
previously persisted native override is off, and nothing — in the code, the UI
or these documents — may present it that way. This is why the Privacy screen
discloses the build's diagnostics **policy** and reports only whether *this
app's own* reporting could be confirmed this session (§7).

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
| any | padded, e.g. `" production "` | **build fails** — the value is compared exactly |

Duplicates fail on purpose. Two sources disagreeing about the environment is a
configuration fault whether or not they happen to match today, and silently
picking one is how the flavor and the environment drifted apart to begin with.

**The comparison is byte-for-byte, and that is load-bearing.** Dart matches the
compile-time string exactly — `AppEnvironment.parse` accepts `production` or
`staging` and falls back to `development` for everything else, padding included.
A gate that trimmed before comparing would therefore accept a value Dart
*rejects*: `--dart-define="APP_ENV= production "` would pass the flavor gate and
produce an artifact carrying the production application ID, the production
Firebase configuration and the production-only Gradle tasks, while the Dart layer
resolved to `development` — observability disabled, the production guards off,
and `DATA_SOURCE=fixture` honoured, which the production branch otherwise
forbids. Nothing is trimmed, case-folded or otherwise normalized; only the tokens
declared in `requiredAppEnvForFlavor` are accepted. (Trimming the outer Base64
*entry* before decoding is unrelated and remains.)

`verifyAppEnvParser` rejects leading/trailing/surrounding spaces, leading and
trailing tabs, leading and trailing newlines, CRLF padding and wrong casing —
for every declared flavor — plus the combination that made this severe: a padded
production token alongside `DATA_SOURCE=fixture`.

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
| `:app:verifyAppEnvParser` | the dart-define parser against synthetic input — the exhaustive flavor×`APP_ENV` matrix, missing, unknown, empty and duplicate `APP_ENV`, values containing `=` or `,`, malformed Base64, file/flag equivalence, an undeclared flavor |
| `:app:verifyMappingUploadPolicy` | the pure mapping-upload authorization rule across 3 flavors × 3 build types × {absent, `false`, `true`} — exactly one combination eligible, none eligible without authorization, dev/staging and debug/profile never eligible, and every malformed value throwing. Performs no upload and reads no real property. |
| `:app:verifyAndroidBuildPolicy` | over all nine variants: the three plugins are applied; `process<Variant>GoogleServices` is production-only; `uploadCrashlyticsMappingFile<Variant>` matches the authorization rule, so with the property absent it is disabled or absent everywhere; no `uploadCrashlyticsSymbolFile<Variant>` exists; release variants still minify locally; Crashlytics mapping-ID injection exists for production; both environment gates are wired to the resource merge and neither to the pre-build |

Neither needs a secret, signing key, device or network beyond the dependency
resolution an ordinary build already performs.

Dev and staging still build with no Firebase configuration file.

## 6. Activation, status and startup

```
WidgetsFlutterBinding.ensureInitialized()
runBootstrap(BootstrapOperations(...))       <- the tested orchestration
  installObservability(environment)          <- installs handlers synchronously
      not eligible -> delegates disabled, activation = notConfigured
      eligible     -> activation = pending, started, NEVER awaited
  ensureTimeZonesInitialized() / preferences <- local only
  runApp(...)
      activation resolves -> active | unavailable
```

`bootstrap()` adds only the binding and the environment; the ordering itself
lives in `runBootstrap`, which production and `bootstrap_orchestration_test.dart`
both call. The test injects the four operations, so the sequence under test is
the sequence that ships rather than a reconstruction of it.

`ObservabilityActivation` has four values: `notConfigured`, `pending`, `active`,
`unavailable`. It describes **this process's Dart adapters and nothing else** —
`active` is not a claim that any payload reached Firebase, and `unavailable` is
not a claim that native collection is off (§4.1). The build-level fact lives in
the separate `DiagnosticsPolicy`.

Errors arriving in the activation window are **buffered in memory**, bounded at
16 reports, replayed exactly once and in order on adoption, and discarded
without throwing if activation fails. Overflow **drops the newest and keeps the
oldest** — the first failure in a cascade explains the rest. Nothing is
persisted, and a replay failure cannot become a new uncaught error.

Observability initialization issues no API request, opens no database, schedules
no synchronization and touches no media.

### Reporting failures cannot re-enter the app

`ErrorReporter` is synchronous, but the Crashlytics calls behind it are not, so
every real report is a future that nobody awaits. An unawaited rejection is an
uncaught asynchronous error, and `PlatformDispatcher.onError` would convert it
into a fatal and hand it to `FlutterError.onError` — the handler the failing
reporter serves. That is a loop, not a diagnostic.

`AsyncErrorReporter` is the single place that closes it: it awaits the call
internally inside a `try` and swallows the outcome. `FirebaseErrorReporter`
supplies the two Crashlytics calls and reimplements none of the guarding, so
`async_reporter_rejection_test.dart` — which drives `AsyncErrorReporter` with
rejecting callbacks and asserts, inside a guarded zone, that nothing escapes —
tests the shipped path. That suite also proves its own detector by showing an
*unguarded* rejection does escape, so it cannot pass vacuously.

### Reports are serialized, because custom keys are process-global

A Crashlytics report is not one call but a sequence: `setCustomKey` for every
attribute, then `recordError`, which reads whatever the keys hold at that moment.
Those keys are **process-global**. Two reports started close together — concurrent
resource refreshes, or several buffered startup reports replayed at once — would
interleave their key writes, and the second `recordError` would be filed under the
first failure's feature and operation. The attributes would still be bounded
enums; they would simply describe the wrong failure, which is worse than having
none.

`SerialReportQueue` is a FIFO lane that runs one report at a time, with each
callback enqueued **whole** so the sequence is atomic. Fatals share the lane, since
they read the same context. The lane is unbreakable by construction: a synchronous
throw, a rejected future or a failing backend call is swallowed and the chain
continues, because a queue that stops at its first failure goes silent exactly when
something is wrong. It stays fire-and-forget — `add` returns immediately and no
application path can await it.

`report_serialization_test.dart` holds the first report open with a completer,
submits a second, and asserts no key write happens before the first is recorded,
that attributes stay with their own report, FIFO order, exactly-once attempts, and
that a failed report does not poison the ones behind it. Removing the lane fails
8 of its 9 tests.

**Serialization alone is not enough**, because the same process-global keys also
leak *sequentially*: whatever one report sets is still attached to the next.
`NormalizedReportRecorder` closes that by writing the complete owned key set on
every send — see §7. `report_context_normalization_test.dart` drives the shipped
recorder through the six ordering cases that matter (preference→ordinary,
ordinary→preference, preference→fatal, fatal→ordinary, two different preference
failures, failed→next) and asserts on each recorded item that all five keys are
present, that the values match only that report, that absent fields hold the
sentinel and that no unexpected key exists. Restoring the omitted preference
fails 8 of its 9 tests; skipping fatal normalization fails 2.

### Tracing never makes the application wait

`Trace.start()` and `Trace.stop()` are platform-channel calls. Awaiting `start`
before the action delayed the database open or the synchronization run itself;
awaiting `stop` delayed the completed result on the way back out. A timeout would
only bound that delay, and the requirement is that observability adds *no* wait.

`NonBlockingPerformanceTracer` starts the trace without awaiting it, invokes the
action immediately, and finalizes — attribute, then stop — fire-and-forget. The
original result or error, and its stack, propagate untouched, and the action runs
exactly once. `FirebasePerformanceTracer` supplies only the Firebase lifecycle
calls through the platform-neutral `TraceSession` seam, so the tested logic is the
shipped logic. The accepted cost is stated plainly: if the platform never finishes
starting a trace, that measurement is lost — which is strictly better than a
delayed database open.

`non_blocking_tracer_test.dart` uses completers that are never completed for both
`start` and `stop`; reintroducing either await makes exactly those three tests
time out.

### Preference faults reach the same reporter

`AppPreferencesRepository` raises a `PreferenceDiagnostic` for three faults that
are invisible to the user by design — the store would not open, a stored token no
longer maps to a value, a write failed and the visible value was reverted. Each is
what a non-fatal is for: unexpected, actionable, already handled gracefully.

`runBootstrap` supplies the sink, because it is the only place holding the reporter
the global handlers were installed against. `observedPreferenceFailure` maps the
diagnostic onto `localPreferenceFailure` / `settings` / `preferenceStoreOpen` |
`preferenceRead` | `preferenceWrite`, and collapses the stored key through
`ObservedPreference.fromKey` so a known preference is identified and anything else
becomes `other`. The raw key, the stored value, the exception and any message are
all absent by construction — every field remains an enum.

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
| database open | `gv_database_open` | at most once per `GridViewDatabase` instance — in practice once per `ProviderScope`, **not** once per OS process. **Best-effort: normally missed on startup — see below.** |
| sync run | `gv_sync_run` | once per startup / genuine foreground / manual run; the coordinator serialises runs, so two are never open at once. The **startup** run is subject to the same limitation |

Each records a two-valued `outcome` attribute (`success` / `failure`) and stops
in a `finally`. There is deliberately **no `cancelled`**: a cancelled
synchronization run completes normally, so the trace boundary cannot distinguish
it and inventing the value would misreport it.

#### Both traces are best-effort, and `gv_database_open` is normally absent

Custom traces are recorded only once the deferred tracer has adopted the real
one. Phase 8C-2 measured both sides of that window on a real device:

| | Timing after Dart startup |
|---|---|
| database opened (lazily, during the first frame) | ~1–2 s |
| Firebase Performance activation completed | ~2.1–3.9 s |

A database is opened **at most once per `GridViewDatabase` instance** — in
practice once per `ProviderScope` that constructs the provider. The ordinary
application shell has one such scope, so a normal launch opens one database; a
process containing several scopes, as tests and a future multi-scope shell would
create, opens one per scope. It is **not** a per-process quantity, and describing
it that way would state the wrong trace-frequency guarantee.

The **initial** instance is opened lazily on first use during the first frame,
inside the activation window, while `DeferredPerformanceTracer` is still
delegating to the no-op. So on an ordinary launch that first open is not recorded,
and across the Phase 8C-2 runs `gv_database_open` was never produced. The
**startup** `gv_sync_run` is lost the same way; later foreground, resumed and
manual runs fall outside the window and are recorded normally, which is what Phase
8C-2 observed in both the debug and the release pass.

This is a timing race, not a wiring fault: `performanceTracerProvider` hands out
the shared `DeferredPerformanceTracer`, which adopts **in place**, so a database
instance opened **after** adoption still produces the trace. That is exactly why
the instrumentation is kept as a best-effort signal rather than removed — the
trace is reachable, just not by the first open of an ordinary launch.

**The decision is to accept this, and it is deliberate.** Every alternative is
worse than an absent measurement:

- *Replaying the trace on adoption* is impossible without lying. Firebase's
  `Trace` API has only `start()`/`stop()` and cannot backdate a start, so a
  replayed trace would report a fabricated duration.
- *Awaiting activation before the database is opened* would make observability a
  startup dependency and break the guarantee that rendering never waits on a
  platform/network handshake — the very thing ADR 0016 exists to prevent.
- *Restructuring activation* to win the race would trade a real architectural
  invariant for one optional measurement.

So: do not delay the database open, do not replay the trace, do not fabricate a
duration, and do not restructure activation to chase it. **Startup instrumentation
must never block application work**, and an unrecorded measurement is the accepted
cost of that rule. The absence of `gv_database_open` is not a defect and was not a
Phase 8C-2 closure blocker — the externally confirmed post-activation
`gv_sync_run` satisfies the Performance requirement.

## 7. Privacy and data processing

**What GridView does.** It sets no Firebase user identifier, and attaches no
GridView domain IDs, slugs, URLs, query strings, synchronized payloads or
exception text as observability attributes. Its traces carry a two-valued
outcome.

Every report — fatal or non-fatal — writes the same **complete set of five owned
custom keys**: `failure`, `feature`, `operation`, `environment`, `preference`.
The values are **enum-derived or fixed bounded constants**, which is the accurate
narrower claim: a dimension that does not apply to a report is written as the
fixed sentinel `notApplicable`, and a fatal — which has no `ObservedFailure` to
derive from — is written as the fixed `fatal` plus the environment. Nothing is
taken from an exception's message, library, context or stack.

Writing the set *completely, every time* is the point. Crashlytics custom keys
are process-global and survive until overwritten, so an omitted key keeps the
previous report's value: before this, a preference failure's `preference=theme`
leaked into the next ordinary non-fatal, and a fatal inherited whatever feature
and operation the last non-fatal left behind. `NormalizedReportRecorder` starts
from a fully neutral template and overlays the report, so no owned key is ever
stale and no key outside the owned set is written at all.

**Confirmed in Console (Phase 8C-2).** A controlled non-fatal populating all five
keys was followed, in the same session, by a controlled fatal. Console showed the
fatal carrying `failure=fatal`, `environment=production` and `notApplicable` for
`feature`, `operation` and `preference` — so it inherited none of the preceding
non-fatal's `settings` / `preferenceWrite` / `timeDisplay` context. §9 records the
full observation.

**GridView-owned keys are not the only keys Console displays.** Firebase also
shows `flutter_error_exception` and `flutter_error_reason`, which are generated by
FlutterFire's own reporting entry point. They are plugin metadata, not
application-owned keys, and their presence is expected — the "no unexpected
GridView-owned custom key" guarantee covers the five keys in this section and does
not extend to what the plugin attaches on its own behalf.

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

**Settings → Privacy** separates the two facts, because only one of them is
knowable:

| Row | Source | dev / staging | production |
|---|---|---|---|
| Crash reporting | `DiagnosticsPolicy` | Disabled | Configured |
| Performance monitoring | `DiagnosticsPolicy` | Disabled | Configured |
| App reporting this session | `ObservabilityActivation` | *(not shown)* | Starting → Active / Not confirmed |
| Advertising | constant | Disabled | Disabled |

The diagnostics rows state the **build's policy**, which is fixed at build time
and identical on every launch. The session row is the only live claim, and it is
scoped in words to this app's own reporting.

A failed activation therefore reads **"Not confirmed"**, never "Disabled". The
app cannot see the platform's collection state, and after §4.1 it cannot infer
it either: the same screen has to be truthful on a first-ever failed launch and
on an installation that succeeded last week and left a persisted override
enabled. "Not confirmed" is true in both; "Disabled" would be false in the
second. The session row disappears entirely where there is nothing to report.

The copy names no manifest, adapter, persisted override or SDK component — those
are implementation facts, and this screen is not the place for them. It exposes
no technical identifier, URL or exception detail. English and Spanish copy are
maintained in parity, and `privacy_status_test.dart` covers every state
including the indistinguishable one.

**Google Play Data Safety** must be updated before release to cover the
categories above. **The hosted privacy-policy URL remains unset and is an
external release blocker.**

## 8. Symbols and obfuscation

- Dart obfuscation is **not** enabled; no `--obfuscate` or `--split-debug-info`
  anywhere. Flutter symbol upload is therefore **not currently applicable**.
- Android minification **is** enabled. This project's `build.gradle` sets only
  `signingConfig` on `release`, but the Flutter Gradle plugin sets
  `minifyEnabled true` and `shrinkResources true` on that build type, so every
  release variant runs R8 and writes a real
  `build/app/outputs/mapping/<variant>/mapping.txt`. That generation is local and
  unconditional (§3.1 item 1).
- **Mapping upload is off by default and is not part of local verification.** It
  requires production + `release` + explicit authorization (§3.1). A published
  production release still needs the mapping uploaded — otherwise JVM frames in
  its crash reports are unreadable — so the authorized release step must set the
  property and retain its task output as the record that the upload happened.
- **No NDK or native-library crash capture**, by dependency:
  `firebase-crashlytics-ndk` is absent and stays absent without separate
  authorization. Android runtime and JVM failures are still captured; what is
  missing is the signal-level handler for C/C++ crashes.
- **No mapping file and no native symbols have ever been uploaded under
  authorization.** Phase 8C-2 built a production **debug** variant only; mapping
  upload stayed fail-closed throughout, `gridviewCrashlyticsUploadMapping` was
  never set, and the build's task graph contained no
  `uploadCrashlyticsMappingFile<Variant>` or `uploadCrashlyticsSymbolFile<Variant>`
  task at all. (§9.4 records a separate, earlier, possible-but-unverified upload
  from Phase 8C-1, before the default was changed.)
- Phase 8C-2 **did** send controlled signals, and exactly these: one fatal and one
  non-fatal plus a `gv_sync_run` trace from a production **debug** build, and then
  — under separate explicit authorization — exactly **one further fatal and one
  further `gv_sync_run` sample** from a production **release** APK. **No second
  non-fatal was ever produced.** See §9.

  **No further *controlled* crash, non-fatal or custom-trace signal was produced** —
  which is the accurate, narrower claim. It is not a claim that nothing else left
  the device: once collection is enabled, the SDKs also send installation and
  session metadata and Performance Monitoring's own configuration traffic, exactly
  as §7 records. Those are unavoidable properties of the SDKs, not GridView
  signals, and a privacy or release audit must read §7 rather than this list.

## 9. Verification status

**Phase 8C-2 is complete.** Two passes were run on 2026-08-16, both on the same
dedicated, clean emulator with no prior GridView installation, both with
`APP_ENV=production`, and **both confirmed in Firebase Console**.

Three levels of evidence are kept distinct throughout, because collapsing them is
how a delivery claim becomes untrue:

| Level | What it proves |
|---|---|
| SDK log line | the Dart/native SDK produced and persisted the record locally |
| HTTP 200 from the ingestion endpoint | Firebase **accepted the submission** |
| Console record | the data **arrived and is queryable** |

### 9.1 What was confirmed — production **debug** pass

**Crashlytics fatal** — `com.sejuma.gridview`, version `1.2.1 (7)`,
2026-08-16 11:39:45 UTC, classified by Firebase as a **fatal** failure. The
exception text contains the controlled marker
`Bad state: GridView Phase 8C-2 controlled fatal - 2026-08-16T11:39:45.435442Z`.
It travelled the shipped path — an uncaught asynchronous error routed through
`PlatformDispatcher.onError` → `FlutterError.reportError` → `FlutterError.onError`
→ the installed reporter. `FirebaseCrashlytics.crash()` was never called. Owned
keys in Console:

| Key | Value |
|---|---|
| `environment` | `production` |
| `failure` | `fatal` |
| `feature` | `notApplicable` |
| `operation` | `notApplicable` |
| `preference` | `notApplicable` |

**Crashlytics non-fatal** — version `1.2.1 (7)`, 2026-08-16 11:31:25 UTC,
classified as one recoverable event, signature
`ObservedFailure(localPreferenceFailure|settings|preferenceWrite|timeDisplay)`,
reason `gridview.localPreferenceFailure`. Owned keys in Console:

| Key | Value |
|---|---|
| `environment` | `production` |
| `failure` | `localPreferenceFailure` |
| `feature` | `settings` |
| `operation` | `preferenceWrite` |
| `preference` | `timeDisplay` |

**Non-inheritance is confirmed.** The two reports were produced in that order, in
the **same session**, precisely so the fatal's context could be checked against
the non-fatal that preceded it. The fatal shows the neutral sentinel in all three
inapplicable dimensions rather than the non-fatal's `settings` / `preferenceWrite`
/ `timeDisplay`, which is `NormalizedReportRecorder` working end to end against a
real backend rather than a fake.

**Redaction is confirmed.** No raw preference key, user data, domain identifier,
URL, query string, payload, credential or Firebase identifier appeared on either
report. Both also carry FlutterFire's own `flutter_error_exception` and
`flutter_error_reason` metadata; those are plugin-generated, not GridView-owned,
and are expected (§7).

**No GridView user identifier is set.** The SDK logged `No userId set for
session`. Console attributing the crash to one affected user reflects **one
affected installation** — Crashlytics counts installations — and is not evidence
that a custom Firebase user ID was assigned.

**Performance** — the custom trace `gv_sync_run` is visible in Console for version
`1.2.1 (7)`, one sample, duration ≈ 3.19 s.

**One deliberate limit on that last claim.** The retained SDK evidence for that
exact trace recorded `outcome=success` and a duration of 3193.757 ms, and the
Performance batch carrying it was accepted with HTTP 200. The Console screenshot
reviewed for closure confirms **the trace and its duration**, but does not itself
display the `outcome` attribute. So: trace arrival and duration are
Console-confirmed; `outcome=success` rests on the retained SDK evidence and is not
independently Console-confirmed. It is recorded that way on purpose.

`gv_database_open` was **not** observed, and is not expected to be on an ordinary
launch — see §6 for the timing reason and the decision to keep it as a best-effort
signal.

### 9.1.1 Production **release** pass — Console-confirmed

The debug pass proves flavor selection, Firebase routing and the normalized
context, but it does not exercise release compilation, R8/minification or release
artifact behaviour, which the implementation plan's exit criteria require. A second
pass therefore ran from a **signed production release APK** — R8/minified, and
**not debuggable**, confirmed from the installed package flags — whose SHA-256 was
checked equal to the artifact just built, installed on the same dedicated emulator.

| Signal | Local SDK evidence | Ingestion | Console |
|---|---|---|---|
| controlled fatal, 2026-08-16 14:29:20 UTC | recorded via the shipped `recordFlutterFatalError` path; `No userId set for session`; enqueued to DataTransport | **HTTP 200** at 14:29:48 UTC | **confirmed** |
| `gv_sync_run`, 2026-08-16 14:30:13 UTC | `outcome=success`, duration 9707.958 ms | **HTTP 200** at 14:30:53 UTC | **confirmed**, ≈ 9.71 s |

**The fatal is Console-confirmed**, matched by its unique marker
`GridView Phase 8C-2 release-like controlled fatal - 2026-08-16T14:29:20.462587Z`
and that exact timestamp: Firebase application `gridview (android)`, application ID
`com.sejuma.gridview`, version `1.2.1 (7)`, Android 16, classified as a **fatal**
failure, one event affecting one installation. It travelled the same shipped path
as the debug pass — an uncaught asynchronous error through
`PlatformDispatcher.onError` → `FlutterError.reportError` → `FlutterError.onError`
→ the reporter. `FirebaseCrashlytics.crash()` was not used.

Owned keys in Console for that fatal:

| Key | Value |
|---|---|
| `environment` | `production` |
| `failure` | `fatal` |
| `feature` | `notApplicable` |
| `operation` | `notApplicable` |
| `preference` | `notApplicable` |

Console additionally shows FlutterFire's `flutter_error_exception` and
`flutter_error_reason` — plugin-generated, not GridView-owned keys (§7). Console's
affected-user count is one affected **installation**; it establishes no custom user
ID, and the retained SDK evidence independently records `No userId set`.

**The release-like `gv_sync_run` is Console-confirmed** for version `1.2.1 (7)` at
approximately **9.71 s**. One boundary is kept explicit: Console confirms the
trace's arrival, version and duration, while **`outcome=success` rests on the
retained SDK evidence and was not independently displayed in Console**.

Exactly one fatal was produced. The harness wrote a persisted repeat-guard before
signalling, and a clean relaunch confirmed it went inert rather than repeating. **No
additional non-fatal was produced in this pass.**

Two build-safety facts about that APK, both from the retained verbose log:
`:app:minifyProductionReleaseWithR8` **executed**, and the log contains **zero**
occurrences of `uploadCrashlyticsMappingFile<Variant>` or
`uploadCrashlyticsSymbolFile<Variant>` — none registered, none scheduled, and **no
`-x` exclusion used**, so the safe default held on its own. Mapping upload stayed
fail-closed with no authorization property set anywhere: not in the environment,
not in repository or user Gradle properties. A mapping file was generated locally,
as every minified release does (§3.1 item 1); nothing was uploaded. No AAB was
produced and nothing was published.

### 9.2 What Phase 8C-2 deliberately did not do

- **No Firebase configuration change of any kind** — no product, retention,
  alert, permission or billing setting was touched, no project or app was created,
  and nothing remote was deleted.
- **No AAB, no publication, no Play Console access.** A release **APK** was built
  for the release-like pass (§9.1.1); it was installed only on the dedicated
  emulator and distributed nowhere.
- **No mapping-file or native-symbol upload.** Authorization was absent
  throughout and the upload task was never registered (§8).
- **All three controlled events remain stored in the production Firebase
  project** — the debug pass's fatal and non-fatal, and the release pass's fatal.
  They were deliberately not deleted, so this record stays checkable.
- Both temporary verification harnesses were **fully removed** from the working
  tree. Each was compile-time gated behind a define absent from every ordinary
  build, added no UI, route or production-reachable trigger, and **must not be
  reintroduced**. There is still no force-crash control, hidden crash route or
  automatic test exception anywhere in the app.

### 9.3 Still not verifiable from this repository

Dev/staging observability (no projects exist, and reusing production is
forbidden); Data Safety accuracy; the hosted privacy policy. One controlled event
proves delivery for that path at that moment — it is not a guarantee of future
availability, nor of behaviour under every device or network condition, and a
locally installed release APK does not prove Play-distributed behaviour.

### 9.4 Incident — one possible, unverified mapping upload

During Phase 8C-1 verification, a local
`flutter build apk --release --flavor production` ran with mapping upload
enabled by default, because the task was scoped by flavor alone. What is known:

- **Confirmed:** the upload task was scheduled and enabled; local preparation
  artifacts were created for `productionRelease` and for no other variant; an
  APK was produced. The equivalent staging release build, with the task
  disabled, produced no such artifacts.
- **Inferred, not proven:** that the task executed.
- **Not proven, and not provable now:** that Firebase received or accepted
  anything. The build's task-level output was not retained, and no daemon log
  covers the window. It is therefore recorded as a **possible, unverified
  mapping upload** — the local temporary directory is not evidence of a remote
  upload (§3.1 item 4).
- **Did not occur:** any crash, non-fatal or performance event upload — the real
  activation path is never reached by the test suite and no device was used; any
  APK or AAB publication; any Play Console operation; any Firebase configuration
  change.

No attempt was made to confirm the upload through Firebase, to re-run the task
or to delete anything remotely. The default was then changed to fail closed
(§3.1), so this cannot recur without explicit authorization.

**Every statement in this subsection is scoped to Phase 8C-1.** The controlled
events described in §9.1 were sent later, deliberately, under explicit
authorization, from a production **debug** build — a variant that can never reach
the upload task. Phase 8C-2 uploaded no mapping file and no symbols, and did not
revisit or attempt to confirm this incident.

## 10. Known follow-ups

- `firebase_performance` applies its own Kotlin Gradle Plugin; Flutter warns
  that future versions will fail to build for apps whose plugins do this.
  **Accepted toolchain debt** for this phase: no AGP 9 or Kotlin migration is in
  scope, and the warning is expected in every build log.
- Gradle 8.11.1, AGP 8.9.1 and Kotlin 2.0.21 are below the versions Flutter
  warns it will soon require. Pre-existing, and accepted on the same terms.
- ~~Three Privacy-screen golden baselines need regeneration.~~ **Done** — the
  canonical Linux baselines were regenerated and committed during Phase 8C-1
  (`test(settings): update canonical privacy goldens`). All five golden suites
  pass with zero drift. Canonical baselines remain Linux-owned and are never
  regenerated locally.
- **`gv_database_open` is best-effort and normally absent on startup.** Accepted
  deliberately rather than tracked as a defect; §6 records the timing measurements
  and why every alternative is worse. Revisit only if the trace becomes load
  bearing, and never by delaying the database open or fabricating a duration.
- **No NDK / native-library crash capture — a known limitation, not a release
  blocker.** `firebase-crashlytics-ndk` is deliberately outside ADR 0016's scope
  and stays absent without a separate scope decision, so C/C++ crashes are not
  recorded while Android runtime and JVM failures still are. Adding it is a
  possible future enhancement; nothing in this repository requires it before
  release, and it must not be listed as a blocker.
- **The two Play blockers** — an unset privacy-policy URL and the outstanding Data
  Safety declaration — remain open. See `../release/play-store-baseline.md`. Every
  other pre-existing release requirement stays governed by
  `GridView_Implementation_Plan.md`.
