import 'package:flutter/foundation.dart';

import 'error_reporter.dart';
import 'observed_failure.dart';
import 'performance_tracer.dart';

/// The default number of reports retained while activation is in flight.
///
/// Small on purpose. The window is one platform initialization — typically
/// milliseconds — so anything beyond a handful of reports means the app is
/// failing in a loop, and the first few already say why.
const int kDefaultStartupBufferLimit = 16;

/// One report retained during the activation window.
sealed class _BufferedReport {
  const _BufferedReport();
}

class _BufferedFatal extends _BufferedReport {
  const _BufferedFatal(this.details);
  final FlutterErrorDetails details;
}

class _BufferedNonFatal extends _BufferedReport {
  const _BufferedNonFatal(this.failure);
  final ObservedFailure failure;
}

/// A reporter that starts inert, retains what it receives, and later adopts a
/// real reporter and replays the backlog.
///
/// This is what keeps observability off the startup path. `bootstrap` installs
/// the global error handlers against this object **synchronously**, so an error
/// thrown during early startup already has an owner, and then lets the platform
/// initialization complete in the background. Nothing before `runApp` waits for
/// a network-backed SDK.
///
/// ## The activation window
///
/// Errors arriving before adoption are **buffered in memory**, not dropped and
/// not persisted. They are replayed on [adopt], each exactly once and in the
/// order received — fatals and non-fatals share one queue precisely so the
/// original ordering survives.
///
/// The buffer is bounded by [bufferLimit]. **Overflow drops the newest report
/// and keeps the oldest**: the first failure in a cascade is the one that
/// explains the rest, and a crash loop would otherwise evict it. Dropped
/// reports are counted, never silently forgotten.
///
/// [disable] clears the backlog without replaying it, for the case where
/// activation failed or the build turned out to be ineligible.
///
/// [adopt] is one-way: the first real reporter wins, so a late or duplicated
/// activation cannot swap the target underneath a live app. `adopt` performs no
/// `await` between its guard and its assignment, so on Dart's single-threaded
/// event loop two concurrent activations cannot both win.
class DeferredErrorReporter implements ErrorReporter {
  DeferredErrorReporter({this.bufferLimit = kDefaultStartupBufferLimit});

  /// Maximum reports retained before adoption.
  final int bufferLimit;

  final List<_BufferedReport> _buffer = <_BufferedReport>[];

  ErrorReporter? _target;
  bool _resolved = false;
  int _dropped = 0;

  /// Whether a real reporter has been installed.
  bool get hasAdopted => _target != null;

  /// Whether the delegate has been settled either way (adopted or disabled).
  bool get isResolved => _resolved;

  /// Reports currently retained for replay.
  int get bufferedCount => _buffer.length;

  /// Reports discarded because the buffer was full.
  int get droppedCount => _dropped;

  /// Installs [reporter] and replays the backlog. The first call wins.
  void adopt(ErrorReporter reporter) {
    if (_resolved) return;
    _resolved = true;
    _target = reporter;
    _flush(reporter);
  }

  /// Settles the delegate as permanently inert and discards the backlog.
  ///
  /// Used when activation failed or was never attempted. Never throws.
  void disable() {
    if (_resolved) return;
    _resolved = true;
    _buffer.clear();
  }

  void _flush(ErrorReporter reporter) {
    // Copy and clear first, so a replay that somehow re-enters cannot see the
    // same report twice.
    final List<_BufferedReport> pending = List<_BufferedReport>.of(_buffer);
    _buffer.clear();
    for (final _BufferedReport report in pending) {
      // A replay failure must not become a new uncaught error — it would land
      // straight back in the global handler this reporter serves.
      try {
        switch (report) {
          case _BufferedFatal(:final FlutterErrorDetails details):
            reporter.recordFatal(details);
          case _BufferedNonFatal(:final ObservedFailure failure):
            reporter.recordNonFatal(failure);
        }
      } catch (_) {
        // Deliberately swallowed.
      }
    }
  }

  void _retain(_BufferedReport report) {
    if (_buffer.length >= bufferLimit) {
      _dropped++;
      return;
    }
    _buffer.add(report);
  }

  @override
  void recordFatal(FlutterErrorDetails details) {
    final ErrorReporter? target = _target;
    if (target != null) {
      target.recordFatal(details);
      return;
    }
    if (_resolved) return;
    _retain(_BufferedFatal(details));
  }

  @override
  void recordNonFatal(ObservedFailure failure) {
    final ErrorReporter? target = _target;
    if (target != null) {
      target.recordNonFatal(failure);
      return;
    }
    if (_resolved) return;
    _retain(_BufferedNonFatal(failure));
  }
}

/// A tracer that starts as a no-op and may later adopt a real one.
///
/// Unlike the reporter, nothing is buffered: an operation traced before
/// adoption simply runs untraced. A trace is a measurement of an operation that
/// has already finished by the time adoption happens, so there is nothing
/// meaningful to replay — and delaying or re-running the operation to measure
/// it would be far worse than not measuring it.
class DeferredPerformanceTracer implements PerformanceTracer {
  DeferredPerformanceTracer();

  PerformanceTracer _target = const NoopPerformanceTracer();
  bool _resolved = false;

  /// Whether a real tracer has been installed.
  bool get hasAdopted => _resolved && _target is! NoopPerformanceTracer;

  /// Installs [tracer] as the delegate. The first call wins.
  void adopt(PerformanceTracer tracer) {
    if (_resolved) return;
    _resolved = true;
    _target = tracer;
  }

  /// Settles the delegate as permanently inert.
  void disable() {
    _resolved = true;
  }

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) =>
      _target.trace<T>(name, action);
}
