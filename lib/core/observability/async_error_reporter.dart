// A named parameter cannot be private, so the fields cannot be initializing
// formals; the callbacks stay private to keep the class's surface minimal.
// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import 'package:flutter/foundation.dart';

import 'error_reporter.dart';
import 'observed_failure.dart';

/// Adapts a pair of **asynchronous** reporting calls to the synchronous
/// [ErrorReporter] contract, without ever letting one surface as an application
/// error.
///
/// [ErrorReporter] is synchronous by design: no caller may wait on a diagnostic,
/// and no caller may fail because of one. Real backends are asynchronous, so the
/// future each call returns has to be both unawaited and guarded — and the
/// guarding is not optional politeness. An unawaited rejection is an uncaught
/// asynchronous error; `PlatformDispatcher.onError` converts it into a fatal and
/// hands it to `FlutterError.onError`, which is the handler this very reporter
/// serves. A reporting failure would therefore arrive back as a new report,
/// which would fail the same way. That is a loop, not a diagnostic.
///
/// Both halves of the guarantee live here:
///
/// * the returned future is never awaited by the caller, so reporting cannot
///   delay the application;
/// * it is awaited *internally* inside a `try`, so a rejection — or a
///   synchronous throw from the callback, which an `async` body captures the
///   same way — is swallowed at the boundary.
///
/// The Firebase adapter builds one of these from Crashlytics calls, and the
/// rejection tests build one from callbacks that reject. Both exercise this
/// class, so the guarantee is proven against the code production runs rather
/// than against a lookalike that reimplements it.
class AsyncErrorReporter implements ErrorReporter {
  const AsyncErrorReporter({
    required Future<void> Function(FlutterErrorDetails) recordFatalAsync,
    required Future<void> Function(ObservedFailure) recordNonFatalAsync,
  }) : _recordFatalAsync = recordFatalAsync,
       _recordNonFatalAsync = recordNonFatalAsync;

  final Future<void> Function(FlutterErrorDetails) _recordFatalAsync;
  final Future<void> Function(ObservedFailure) _recordNonFatalAsync;

  @override
  void recordFatal(FlutterErrorDetails details) {
    unawaited(_guard(() => _recordFatalAsync(details)));
  }

  @override
  void recordNonFatal(ObservedFailure failure) {
    unawaited(_guard(() => _recordNonFatalAsync(failure)));
  }

  /// Runs [action] to completion and absorbs any outcome.
  ///
  /// Deliberately swallowed, and deliberately not re-reported: a failure to
  /// report is not itself an application fault, and reporting it would recurse
  /// through the same broken path.
  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {
      // See the class doc: this is the loop-breaker.
    }
  }
}
