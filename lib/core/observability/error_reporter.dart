import 'package:flutter/foundation.dart';

import 'observed_failure.dart';

/// The application's crash/error reporting boundary.
///
/// Application code depends on this interface, never on Firebase. The Firebase
/// implementation lives behind [FirebaseErrorReporter]; every other environment
/// uses [NoopErrorReporter].
///
/// Implementations must be **total and silent**: a reporter may never throw,
/// never block a caller and never change what the caller returns. Reporting is
/// an observation of a failure, never part of handling it.
abstract interface class ErrorReporter {
  /// Records an error the application could not recover from.
  void recordFatal(FlutterErrorDetails details);

  /// Records one of the deliberately narrow set of unexpected, actionable
  /// failures described by [ObservedFailure].
  void recordNonFatal(ObservedFailure failure);
}

/// The reporter used wherever observability is not eligible: development,
/// staging, tests, and production whose Firebase initialization failed.
///
/// It is not a degraded mode to apologise for — it is the correct behaviour for
/// every environment that has no Firebase project.
class NoopErrorReporter implements ErrorReporter {
  const NoopErrorReporter();

  @override
  void recordFatal(FlutterErrorDetails details) {}

  @override
  void recordNonFatal(ObservedFailure failure) {}
}

/// Wraps a reporter so that a failure inside reporting can never escape into
/// the code that was merely observing something.
///
/// A crash reporter that throws while recording a crash would turn a handled
/// problem into an unhandled one, and a tracing/reporting outage would start
/// changing domain results. Every delegated call is guarded.
class GuardedErrorReporter implements ErrorReporter {
  const GuardedErrorReporter(this._inner);

  final ErrorReporter _inner;

  @override
  void recordFatal(FlutterErrorDetails details) {
    try {
      _inner.recordFatal(details);
    } catch (_) {
      // Swallowed on purpose: see the class doc.
    }
  }

  @override
  void recordNonFatal(ObservedFailure failure) {
    try {
      _inner.recordNonFatal(failure);
    } catch (_) {
      // Swallowed on purpose: see the class doc.
    }
  }
}
