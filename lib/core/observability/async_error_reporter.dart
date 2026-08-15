// A named parameter cannot be private, so the fields cannot be initializing
// formals; the callbacks stay private to keep the class's surface minimal.
// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import 'error_reporter.dart';
import 'observed_failure.dart';
import 'serial_report_queue.dart';

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
/// ## Reports are serialized
///
/// Both guarantees are provided by [SerialReportQueue], which additionally runs
/// one report at a time. That matters because a backend report is a *sequence*
/// — set every custom key, then record — against process-global context. Two
/// unawaited sequences would interleave their key writes and cross-attribute
/// the reports. Enqueuing each callback whole makes the sequence atomic without
/// making any caller wait.
///
/// The Firebase adapter builds one of these from Crashlytics calls, and the
/// rejection tests build one from callbacks that reject. Both exercise this
/// class, so the guarantee is proven against the code production runs rather
/// than against a lookalike that reimplements it.
class AsyncErrorReporter implements ErrorReporter {
  AsyncErrorReporter({
    required Future<void> Function(FlutterErrorDetails) recordFatalAsync,
    required Future<void> Function(ObservedFailure) recordNonFatalAsync,
    SerialReportQueue? queue,
  }) : _recordFatalAsync = recordFatalAsync,
       _recordNonFatalAsync = recordNonFatalAsync,
       _queue = queue ?? SerialReportQueue();

  final Future<void> Function(FlutterErrorDetails) _recordFatalAsync;
  final Future<void> Function(ObservedFailure) _recordNonFatalAsync;

  /// The FIFO lane every report goes through.
  ///
  /// Each callback is enqueued **whole**, so a non-fatal's key writes and its
  /// `recordError` are one indivisible unit and a second report cannot mutate
  /// the process-global Crashlytics context in between. Fatals share the lane
  /// too: they read the same context, so letting them overtake a queued
  /// non-fatal would reintroduce exactly the interleaving this prevents.
  final SerialReportQueue _queue;

  /// Queued or in-flight reports. Test-facing.
  int get pendingReports => _queue.pending;

  /// Completes when the lane has drained. **Tests only** — production never
  /// waits for a report.
  Future<void> get settled => _queue.settled;

  @override
  void recordFatal(FlutterErrorDetails details) {
    _queue.add(() => _recordFatalAsync(details));
  }

  @override
  void recordNonFatal(ObservedFailure failure) {
    _queue.add(() => _recordNonFatalAsync(failure));
  }
}
