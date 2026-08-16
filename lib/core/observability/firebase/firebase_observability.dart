/// **The only file in the application that imports Firebase.**
///
/// Everything else — widgets, controllers, repositories, DAOs, synchronization
/// and media — depends on `ErrorReporter` and `PerformanceTracer`. Keeping the
/// SDK behind this boundary is what lets dev, staging and the entire test suite
/// run with no Firebase project at all, and what keeps a future backend swap a
/// single-file change.
library;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';

import '../../../app/environment/app_environment.dart';
import '../async_error_reporter.dart';
import '../error_reporter.dart';
import '../non_blocking_tracer.dart';
import '../normalized_report_recorder.dart';
import '../observed_failure.dart';
import '../performance_tracer.dart';
import '../throttled_error_reporter.dart';

/// Sends fatal and selected non-fatal errors to Crashlytics.
///
/// This class contributes only the Crashlytics calls. Everything that has to be
/// true about *how* they are made lives elsewhere, and is tested there:
///
/// * [AsyncErrorReporter] makes reporting fire-and-forget and unable to re-enter
///   the global handler, and serializes reports through one FIFO lane;
/// * [NormalizedReportRecorder] writes the complete owned custom-key set before
///   every record, so no report inherits the previous one's context.
///
/// Nothing about either guarantee is reimplemented here, so the tested path and
/// the shipped path cannot drift apart.
class FirebaseErrorReporter implements ErrorReporter {
  /// [environment] is attached to fatal reports, which carry no
  /// [ObservedFailure] to derive it from.
  ///
  /// It defaults to production and is stated rather than assumed: this reporter
  /// is only ever constructed by [activateFirebaseObservability], which runs
  /// solely for an eligible production build, so production is the only value it
  /// can legitimately receive.
  FirebaseErrorReporter(
    FirebaseCrashlytics crashlytics, {
    AppEnvironment environment = AppEnvironment.production,
  }) : _delegate = _buildDelegate(crashlytics, environment);

  final AsyncErrorReporter _delegate;

  @override
  void recordFatal(FlutterErrorDetails details) =>
      _delegate.recordFatal(details);

  @override
  void recordNonFatal(ObservedFailure failure) =>
      _delegate.recordNonFatal(failure);

  static AsyncErrorReporter _buildDelegate(
    FirebaseCrashlytics crashlytics,
    AppEnvironment environment,
  ) {
    final NormalizedReportRecorder recorder = NormalizedReportRecorder(
      setCustomKey: crashlytics.setCustomKey,
      // The failure object itself is the exception: its `toString` is the
      // signature, so Crashlytics groups by failure class rather than by a
      // per-occurrence message.
      recordNonFatal: (ObservedFailure failure) => crashlytics.recordError(
        failure,
        null,
        reason: failure.reason,
        fatal: false,
      ),
      // Crashlytics' own Flutter entry point: it preserves the framework
      // context and library fields rather than flattening them to a message.
      recordFatal: crashlytics.recordFlutterFatalError,
      environment: environment,
    );

    return AsyncErrorReporter(
      recordFatalAsync: recorder.sendFatal,
      recordNonFatalAsync: recorder.sendNonFatal,
    );
  }
}

/// Records custom traces through Firebase Performance Monitoring.
///
/// **Only the traces declared in [TraceName] are recorded here.** The
/// Performance Gradle plugin *is* applied (see
/// `docs/technical/GridView_Observability.md` §3), so the SDK's own build-time
/// instrumentation is present; what it does not do is observe this app's HTTP
/// traffic, because Dio issues requests through Dart's `dart:io` sockets rather
/// than the Android `HttpURLConnection`/OkHttp stacks that instrumentation
/// hooks. Anything not listed in [TraceName] is simply not measured by this
/// class — use DevTools for that.
///
/// This class contributes only the Firebase lifecycle calls. The guarantee that
/// none of them can delay the traced work lives in [NonBlockingPerformanceTracer],
/// which is the class the tracer tests drive, so the tested logic and the
/// shipped logic cannot diverge.
class FirebasePerformanceTracer implements PerformanceTracer {
  FirebasePerformanceTracer(FirebasePerformance performance)
    : _delegate = NonBlockingPerformanceTracer((TraceName name) async {
        final Trace trace = performance.newTrace(name.wireName);
        await trace.start();
        return TraceSession(
          // A two-valued constant attribute: a usable dimension, not a
          // cardinality problem, and it carries nothing about what failed.
          putAttribute: trace.putAttribute,
          stop: trace.stop,
        );
      });

  final NonBlockingPerformanceTracer _delegate;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) =>
      _delegate.trace<T>(name, action);
}

/// The reporter and tracer a successful activation produces.
class FirebaseAdapters {
  const FirebaseAdapters({required this.reporter, required this.tracer});

  final ErrorReporter reporter;
  final PerformanceTracer tracer;
}

/// Initializes Firebase and builds the real adapters.
///
/// Returns `null` when initialization fails for any reason — no Android
/// configuration resources (the dev/staging case, should this ever be called
/// there), no network, a malformed configuration, an unsupported platform. The
/// caller settles its delegates as permanently inert, and the application is
/// unaffected.
///
/// Turning collection on here is deliberate and is the *only* place it happens.
/// The manifest declares `firebase_crashlytics_collection_enabled=false` and
/// `firebase_performance_collection_enabled=false` for every flavor, so a
/// **fresh installation** of any flavor starts with the packaged native SDKs
/// inert; this call is what an eligible production build uses to switch them on,
/// after the Dart policy has been evaluated.
///
/// It does **not** stay that way. The platform SDKs persist this opt-in at a
/// higher priority than the manifest, so a production installation that has
/// activated once begins **later** launches already collecting, before any Dart
/// code runs. "Inert from process start in every flavor" is therefore true only
/// until the first successful production activation, and must not be written
/// without that qualifier. See `docs/technical/GridView_Observability.md` §4.1.
///
/// This is never awaited before `runApp`; see `bootstrap`.
Future<FirebaseAdapters?> activateFirebaseObservability({
  required DateTime Function() now,
}) async {
  try {
    // No `firebase_options.dart` and no explicit [FirebaseOptions]: the default
    // app is read from the native configuration that the Google Services Gradle
    // plugin compiles in for production builds only. Nothing here can invent or
    // point at a project that the repository does not already own.
    await Firebase.initializeApp();

    final FirebaseCrashlytics crashlytics = FirebaseCrashlytics.instance;
    final FirebasePerformance performance = FirebasePerformance.instance;

    // The manifest turned both off for every flavor. This is the deliberate,
    // production-only opt-in, and it is reversible — which is why the permanent
    // `firebase_performance_collection_deactivated` flag is not used.
    await crashlytics.setCrashlyticsCollectionEnabled(true);
    await performance.setPerformanceCollectionEnabled(true);

    return FirebaseAdapters(
      reporter: GuardedErrorReporter(
        ThrottledErrorReporter(FirebaseErrorReporter(crashlytics), now: now),
      ),
      tracer: GuardedPerformanceTracer(FirebasePerformanceTracer(performance)),
    );
  } catch (_) {
    // Degrade to inert. Observability is never a startup dependency.
    return null;
  }
}
