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

import '../async_error_reporter.dart';
import '../error_reporter.dart';
import '../observed_failure.dart';
import '../performance_tracer.dart';
import '../throttled_error_reporter.dart';

/// Sends fatal and selected non-fatal errors to Crashlytics.
///
/// This class contributes only the two Crashlytics calls. Making them safe —
/// unawaited so they cannot delay the app, internally awaited inside a `try` so
/// a rejection cannot re-enter the global handler — is [AsyncErrorReporter]'s
/// job, and that is the class the rejection tests drive. Nothing about the
/// guarantee is reimplemented here, so the tested path and the shipped path
/// cannot drift apart.
class FirebaseErrorReporter implements ErrorReporter {
  FirebaseErrorReporter(FirebaseCrashlytics crashlytics)
    : _delegate = AsyncErrorReporter(
        // Crashlytics' own Flutter entry point: it preserves the framework
        // context and library fields rather than flattening them to a message.
        recordFatalAsync: crashlytics.recordFlutterFatalError,
        recordNonFatalAsync: (ObservedFailure failure) =>
            _send(crashlytics, failure),
      );

  final AsyncErrorReporter _delegate;

  @override
  void recordFatal(FlutterErrorDetails details) =>
      _delegate.recordFatal(details);

  @override
  void recordNonFatal(ObservedFailure failure) =>
      _delegate.recordNonFatal(failure);

  static Future<void> _send(
    FirebaseCrashlytics crashlytics,
    ObservedFailure failure,
  ) async {
    // Bounded enum-derived keys only; see [ObservedFailure].
    for (final MapEntry<String, String> entry
        in failure.toAttributes().entries) {
      await crashlytics.setCustomKey(entry.key, entry.value);
    }
    // The failure object itself is the exception: its `toString` is the
    // signature, so Crashlytics groups by failure class rather than by a
    // per-occurrence message.
    await crashlytics.recordError(
      failure,
      null,
      reason: failure.reason,
      fatal: false,
    );
  }
}

/// Records custom traces through Firebase Performance Monitoring.
///
/// **Only the traces declared in [TraceName] are recorded.** The Performance
/// Gradle plugin is deliberately not applied, so there is no bytecode
/// instrumentation, and automatic HTTP monitoring would not observe this app's
/// requests in any case: Dio issues them through Dart's own `dart:io` sockets,
/// not Android's `HttpURLConnection`/OkHttp, which is what that instrumentation
/// hooks. Anything not listed in [TraceName] is simply not measured here — use
/// DevTools for that.
class FirebasePerformanceTracer implements PerformanceTracer {
  const FirebasePerformanceTracer(this._performance);

  final FirebasePerformance _performance;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) async {
    Trace? trace;
    try {
      trace = _performance.newTrace(name.wireName);
      await trace.start();
    } catch (_) {
      // A trace that will not start must not stop the work it was measuring.
      trace = null;
    }

    TraceOutcome outcome = TraceOutcome.success;
    try {
      return await action();
    } catch (_) {
      outcome = TraceOutcome.failure;
      rethrow;
    } finally {
      // `finally`, so both outcomes close the trace exactly once.
      final Trace? started = trace;
      if (started != null) {
        try {
          // A two-valued constant attribute: a usable dimension, not a
          // cardinality problem, and it carries nothing about what failed.
          started.putAttribute(TraceOutcome.attributeKey, outcome.wireValue);
        } catch (_) {
          // Deliberately swallowed; the trace is still worth stopping.
        }
        try {
          await started.stop();
        } catch (_) {
          // Deliberately swallowed.
        }
      }
    }
  }
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
/// `firebase_performance_collection_enabled=false` for every flavor, so the
/// packaged native SDKs are inert from process start; this call is what an
/// eligible production build uses to switch them on, after the Dart policy has
/// been evaluated.
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
