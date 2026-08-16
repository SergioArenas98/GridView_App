import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/performance_tracer.dart';

import '../support/fake_observability.dart';

/// A tracer that mirrors the Firebase adapter's start/stop lifecycle without
/// Firebase, so the `finally` contract can be asserted directly.
class _LifecycleTracer implements PerformanceTracer {
  final List<String> events = <String>[];
  bool failOnStart = false;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) async {
    bool started = false;
    if (failOnStart) {
      events.add('start-failed:${name.wireName}');
    } else {
      events.add('start:${name.wireName}');
      started = true;
    }
    TraceOutcome outcome = TraceOutcome.success;
    try {
      return await action();
    } catch (_) {
      outcome = TraceOutcome.failure;
      rethrow;
    } finally {
      if (started) {
        events.add('${TraceOutcome.attributeKey}=${outcome.wireValue}');
        events.add('stop:${name.wireName}');
      }
    }
  }
}

void main() {
  group('trace names', () {
    test('every name is short, prefixed and fixed', () {
      for (final TraceName name in TraceName.values) {
        expect(name.wireName, startsWith('gv_'));
        expect(name.wireName.length, lessThanOrEqualTo(100));
        expect(RegExp(r'^[a-z0-9_]+$').hasMatch(name.wireName), isTrue);
      }
    });

    test('the traced surface stays small and low-frequency', () {
      // Guards the "a few stable boundaries" rule against drift into one trace
      // per row, frame or image. Raising this bound is a deliberate decision.
      expect(TraceName.values, hasLength(2));
      expect(TraceName.values, contains(TraceName.databaseOpen));
      expect(TraceName.values, contains(TraceName.syncRun));
    });
  });

  group('a trace always stops, and records its outcome', () {
    test('on success', () async {
      final _LifecycleTracer tracer = _LifecycleTracer();
      await tracer.trace(TraceName.syncRun, () async => 1);
      expect(tracer.events, <String>[
        'start:gv_sync_run',
        'outcome=success',
        'stop:gv_sync_run',
      ]);
    });

    test('on failure', () async {
      final _LifecycleTracer tracer = _LifecycleTracer();
      await expectLater(
        tracer.trace(TraceName.syncRun, () async => throw StateError('x')),
        throwsStateError,
      );
      expect(tracer.events, <String>[
        'start:gv_sync_run',
        'outcome=failure',
        'stop:gv_sync_run',
      ]);
    });

    test('on an error-completed future', () async {
      final _LifecycleTracer tracer = _LifecycleTracer();
      final Completer<int> completer = Completer<int>();

      final Future<int> traced = tracer.trace(
        TraceName.databaseOpen,
        () => completer.future,
      );
      completer.completeError(StateError('failed open'));

      await expectLater(traced, throwsStateError);
      expect(tracer.events, <String>[
        'start:gv_database_open',
        'outcome=failure',
        'stop:gv_database_open',
      ]);
    });

    test('the outcome vocabulary stays two constant values', () {
      // No `cancelled`: a cancelled synchronization run completes normally, so
      // the trace boundary genuinely cannot distinguish it and inventing the
      // value would misreport it.
      expect(TraceOutcome.values, hasLength(2));
      expect(TraceOutcome.values.map((TraceOutcome o) => o.wireValue), <String>[
        'success',
        'failure',
      ]);
      expect(TraceOutcome.attributeKey, 'outcome');
    });

    test('a trace that will not start still runs the action', () async {
      final _LifecycleTracer tracer = _LifecycleTracer()..failOnStart = true;
      final int result = await tracer.trace(TraceName.syncRun, () async => 42);

      expect(result, 42);
      expect(tracer.events, <String>['start-failed:gv_sync_run']);
    });
  });

  group('tracing failure cannot change the traced operation', () {
    test('a throwing tracer still returns the action result', () async {
      const GuardedPerformanceTracer guarded = GuardedPerformanceTracer(
        ThrowingPerformanceTracer(),
      );

      final String result = await guarded.trace(
        TraceName.syncRun,
        () async => 'domain result',
      );

      expect(result, 'domain result');
    });

    test('a throwing tracer still propagates the action error', () async {
      const GuardedPerformanceTracer guarded = GuardedPerformanceTracer(
        ThrowingPerformanceTracer(),
      );

      await expectLater(
        guarded.trace(
          TraceName.syncRun,
          () async => throw StateError('domain'),
        ),
        throwsStateError,
      );
    });
  });

  group('deferred tracing', () {
    test('work before adoption runs untraced rather than waiting', () async {
      final DeferredPerformanceTracer deferred = DeferredPerformanceTracer();
      final RecordingPerformanceTracer real = RecordingPerformanceTracer();

      expect(deferred.hasAdopted, isFalse);
      expect(await deferred.trace(TraceName.syncRun, () async => 1), 1);
      expect(real.started, isEmpty);

      deferred.adopt(real);
      expect(await deferred.trace(TraceName.syncRun, () async => 2), 2);

      expect(real.started, <TraceName>[TraceName.syncRun]);
      expect(real.stopped, <TraceName>[TraceName.syncRun]);
    });

    test('adoption is one-way', () async {
      final DeferredPerformanceTracer deferred = DeferredPerformanceTracer();
      final RecordingPerformanceTracer first = RecordingPerformanceTracer();
      final RecordingPerformanceTracer second = RecordingPerformanceTracer();

      deferred.adopt(first);
      deferred.adopt(second);
      await deferred.trace(TraceName.databaseOpen, () async => 0);

      expect(first.started, hasLength(1));
      expect(second.started, isEmpty);
    });
  });
}
