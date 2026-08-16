import 'package:flutter/foundation.dart';
import 'package:gridview/core/observability/error_reporter.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/core/observability/performance_tracer.dart';

/// A deterministic reporter that records instead of transmitting.
///
/// No Firebase type is reachable from here, which is the point: the whole test
/// suite exercises the observability policy without a Firebase project, a
/// network or a platform channel.
class RecordingErrorReporter implements ErrorReporter {
  final List<FlutterErrorDetails> fatals = <FlutterErrorDetails>[];
  final List<ObservedFailure> nonFatals = <ObservedFailure>[];

  /// Every attribute map actually handed to the backend.
  List<Map<String, String>> get attributes => nonFatals
      .map((ObservedFailure f) => f.toAttributes())
      .toList(growable: false);

  void clear() {
    fatals.clear();
    nonFatals.clear();
  }

  @override
  void recordFatal(FlutterErrorDetails details) => fatals.add(details);

  @override
  void recordNonFatal(ObservedFailure failure) => nonFatals.add(failure);
}

/// A reporter whose every method throws, for proving that a broken reporter
/// cannot change application behaviour.
class ThrowingErrorReporter implements ErrorReporter {
  const ThrowingErrorReporter();

  @override
  void recordFatal(FlutterErrorDetails details) =>
      throw StateError('reporter is broken');

  @override
  void recordNonFatal(ObservedFailure failure) =>
      throw StateError('reporter is broken');
}

/// A tracer that records which traces started, how each finished, and how many
/// were in flight at once.
///
/// Mirrors the Firebase adapter's lifecycle — start, record the outcome, stop
/// in a `finally` — so the contract can be asserted without Firebase.
class RecordingPerformanceTracer implements PerformanceTracer {
  final List<TraceName> started = <TraceName>[];
  final List<TraceName> stopped = <TraceName>[];
  final List<TraceOutcome> outcomes = <TraceOutcome>[];

  int _inFlight = 0;

  /// The highest number of traces open simultaneously.
  int peakConcurrency = 0;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) async {
    started.add(name);
    _inFlight++;
    if (_inFlight > peakConcurrency) peakConcurrency = _inFlight;

    TraceOutcome outcome = TraceOutcome.success;
    try {
      return await action();
    } catch (_) {
      outcome = TraceOutcome.failure;
      rethrow;
    } finally {
      outcomes.add(outcome);
      stopped.add(name);
      _inFlight--;
    }
  }
}

/// A tracer that throws when asked to start a trace.
class ThrowingPerformanceTracer implements PerformanceTracer {
  const ThrowingPerformanceTracer();

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) =>
      throw StateError('tracer is broken');
}
