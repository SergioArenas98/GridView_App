import 'dart:async';

import 'performance_tracer.dart';

/// One started platform trace, reduced to the two calls this layer needs.
///
/// Platform-neutral on purpose: the Firebase adapter builds one of these from a
/// `Trace`, and tests build one from controlled completers, so both drive the
/// same lifecycle logic.
class TraceSession {
  const TraceSession({required this.putAttribute, required this.stop});

  /// Records the outcome attribute. Synchronous; failures are swallowed.
  final void Function(String key, String value) putAttribute;

  /// Ends the trace. May never complete — nothing waits on it.
  final Future<void> Function() stop;
}

/// Begins a platform trace, or returns null when one cannot be started.
typedef TraceSessionStarter = Future<TraceSession?> Function(TraceName name);

/// Runs the action inside a trace **without ever making the action wait**.
///
/// The previous implementation awaited `start()` before invoking the action and
/// `stop()` before returning its result. Both are platform-channel calls, so a
/// slow or hung Performance channel delayed the database open or the
/// synchronization run itself, and then delayed the completed result on the way
/// back out. A timeout would not fix that: it would only bound the delay, and
/// the requirement is that observability adds *no* wait to the application path.
///
/// So the ordering here is deliberate:
///
/// 1. trace setup is started and **not awaited** — the returned future is held,
///    not blocked on;
/// 2. the action is invoked immediately and its result or error propagates
///    untouched;
/// 3. finalization — attribute then stop — is fire-and-forget, so a `start` or
///    `stop` future that never completes can never delay the action or its
///    caller.
///
/// The consequence is accepted openly: if the platform never finishes starting
/// the trace, that measurement is simply lost. A lost measurement is a strictly
/// better outcome than a delayed database open.
class NonBlockingPerformanceTracer implements PerformanceTracer {
  const NonBlockingPerformanceTracer(this._start);

  final TraceSessionStarter _start;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) async {
    // Held, never awaited before the action. `_beginQuietly` is async, so a
    // synchronous throw from the starter is captured into the future rather
    // than escaping here.
    final Future<TraceSession?> pending = _beginQuietly(name);

    TraceOutcome outcome = TraceOutcome.success;
    try {
      return await action();
    } catch (_) {
      outcome = TraceOutcome.failure;
      // `rethrow` rather than a wrapped throw, so the original error *and* its
      // stack trace reach the caller unchanged.
      rethrow;
    } finally {
      // Deliberately unawaited: the result is already on its way out, and the
      // trace must not hold it back. `_finishQuietly` can never throw, so this
      // cannot become an uncaught asynchronous error either.
      unawaited(_finishQuietly(pending, outcome));
    }
  }

  Future<TraceSession?> _beginQuietly(TraceName name) async {
    try {
      return await _start(name);
    } catch (_) {
      // A trace that will not start must not disturb the work it measured.
      return null;
    }
  }

  Future<void> _finishQuietly(
    Future<TraceSession?> pending,
    TraceOutcome outcome,
  ) async {
    try {
      final TraceSession? session = await pending;
      if (session == null) {
        return;
      }
      try {
        session.putAttribute(TraceOutcome.attributeKey, outcome.wireValue);
      } catch (_) {
        // The trace is still worth stopping without its attribute.
      }
      try {
        await session.stop();
      } catch (_) {
        // Nothing left to do; the measurement is lost, the app is unaffected.
      }
    } catch (_) {
      // Unreachable in practice — both inner calls are already guarded — but
      // this method is unawaited, so it must be total by construction.
    }
  }
}
