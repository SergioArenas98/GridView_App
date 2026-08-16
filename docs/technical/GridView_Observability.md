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
| database open | `gv_database_open` | once per `GridViewDatabase` instance — in practice once per `ProviderScope`, **not** once per OS process |
| sync run | `gv_sync_run` | once per startup / genuine foreground / manual run; the coordinator serialises runs, so two are never open at once |

Each records a two-valued `outcome` attribute (`success` / `failure`) and stops
in a `finally`. There is deliberately **no `cancelled`**: a cancelled
synchronization run completes normally, so the trace boundary cannot distinguish
it and inventing the value would misreport it.

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
- No symbols were uploaded and no test crash or trace was sent.

## 9. Verification status

**Not verifiable from this repository:** a real Crashlytics fatal, a selected
non-fatal or a Performance trace arriving in Firebase Console; dev/staging
observability (no projects exist); Data Safety accuracy; the hosted privacy
policy. Sending a test event is prohibited during this local phase. **External
Firebase Console verification therefore remains outstanding**, and no claim in
this document should be read as evidence of delivery.

Also not verifiable here: the persisted collection override of §4.1. Its
behaviour is documented from the platform SDKs' contract, not observed, because
observing it would require a real production installation and console access.

### 9.1 Incident — one possible, unverified mapping upload

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

## 10. Known follow-ups

- `firebase_performance` applies its own Kotlin Gradle Plugin; Flutter warns
  that future versions will fail to build for apps whose plugins do this.
  **Accepted toolchain debt** for this phase: no AGP 9 or Kotlin migration is in
  scope, and the warning is expected in every build log.
- Gradle 8.11.1, AGP 8.9.1 and Kotlin 2.0.21 are below the versions Flutter
  warns it will soon require. Pre-existing, and accepted on the same terms.
- Three Privacy-screen golden baselines need regeneration through the Linux
  canonical workflow after the copy changes in this phase (see the testing docs).
  The disclosure rework moved them further from the committed baselines —
  `settings_privacy_unconfigured` 13.02%, `settings_privacy_configured` 12.18%,
  `settings_privacy_production` 10.23% — because the diagnostics note grew and
  the row values changed. They are **not** regenerated locally: the canonical
  baselines are Linux-owned.
