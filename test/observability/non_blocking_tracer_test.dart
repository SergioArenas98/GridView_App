import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/observability/non_blocking_tracer.dart';
import 'package:gridview/core/observability/performance_tracer.dart';

/// Tracing must add no wait to the application path.
///
/// [NonBlockingPerformanceTracer] is the class `FirebasePerformanceTracer` is
/// built from, so these tests drive the shipped lifecycle logic with controlled
/// completers standing in for the Performance platform channel. No Firebase type
/// appears here and no platform channel is used.
///
/// The decisive cases use completers that are **never completed**: if the tracer
/// awaited `start()` or `stop()` anywhere on the application path, those tests
/// would time out rather than fail, which is itself an unambiguous signal.
void main() {
  group('a start that never completes', () {
    test('does not delay the action or the caller', () async {
      final Completer<TraceSession?> never = Completer<TraceSession?>();
      bool ran = false;

      const NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        _neverStart,
      );

      final int result = await tracer.trace(TraceName.databaseOpen, () async {
        ran = true;
        return 7;
      });

      expect(ran, isTrue, reason: 'the action must run without waiting');
      expect(result, 7);
      expect(never.isCompleted, isFalse);
    });

    test('propagates the original error and stack untouched', () async {
      const NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        _neverStart,
      );
      final StateError original = StateError('the real failure');
      StackTrace? seenStack;
      Object? seen;

      try {
        await tracer.trace<void>(TraceName.syncRun, () async {
          throw original;
        });
      } catch (error, stack) {
        seen = error;
        seenStack = stack;
      }

      expect(identical(seen, original), isTrue);
      expect(seenStack, isNotNull);
      expect(seenStack.toString(), isNotEmpty);
    });
  });

  group('a stop that never completes', () {
    test('does not delay the result', () async {
      final Completer<void> neverStops = Completer<void>();
      final List<String> attributes = <String>[];

      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer((
        TraceName name,
      ) async {
        return TraceSession(
          putAttribute: (String key, String value) =>
              attributes.add('$key=$value'),
          stop: () => neverStops.future,
        );
      });

      final int result = await tracer.trace(
        TraceName.databaseOpen,
        () async => 42,
      );

      expect(result, 42);
      // Let finalization get as far as it can; it must hang on stop, not here.
      await Future<void>.delayed(Duration.zero);
      expect(attributes, <String>['outcome=success']);
      expect(neverStops.isCompleted, isFalse);
    });
  });

  group('ordinary lifecycle', () {
    test('records success and stops exactly once', () async {
      final List<String> events = <String>[];

      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer((
        TraceName name,
      ) async {
        events.add('start:${name.wireName}');
        return TraceSession(
          putAttribute: (String key, String value) =>
              events.add('attribute:$key=$value'),
          stop: () async => events.add('stop'),
        );
      });

      final int result = await tracer.trace(TraceName.syncRun, () async => 1);
      await Future<void>.delayed(Duration.zero);

      expect(result, 1);
      expect(events, <String>[
        'start:gv_sync_run',
        'attribute:outcome=success',
        'stop',
      ]);
    });

    test('records failure and still stops exactly once', () async {
      final List<String> events = <String>[];

      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer((
        TraceName name,
      ) async {
        return TraceSession(
          putAttribute: (String key, String value) =>
              events.add('attribute:$key=$value'),
          stop: () async => events.add('stop'),
        );
      });

      await expectLater(
        tracer.trace<void>(TraceName.syncRun, () async {
          throw StateError('boom');
        }),
        throwsStateError,
      );
      await Future<void>.delayed(Duration.zero);

      expect(events, <String>['attribute:outcome=failure', 'stop']);
    });

    test('the action is invoked exactly once', () async {
      int invocations = 0;
      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        (TraceName name) async =>
            TraceSession(putAttribute: (_, _) {}, stop: () async {}),
      );

      await tracer.trace(TraceName.databaseOpen, () async {
        invocations++;
        return 0;
      });

      expect(invocations, 1);
    });
  });

  group('lifecycle failures are swallowed', () {
    test('a start that rejects leaves the action untouched', () async {
      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        (TraceName name) async => throw StateError('start rejected'),
      );

      expect(await tracer.trace(TraceName.databaseOpen, () async => 5), 5);
      await Future<void>.delayed(Duration.zero);
    });

    test('a start that throws synchronously is absorbed', () async {
      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        (TraceName name) => throw StateError('threw before any future'),
      );

      expect(await tracer.trace(TraceName.syncRun, () async => 6), 6);
      await Future<void>.delayed(Duration.zero);
    });

    test('a null session is tolerated', () async {
      const NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer(
        _nullStart,
      );

      expect(await tracer.trace(TraceName.syncRun, () async => 8), 8);
      await Future<void>.delayed(Duration.zero);
    });

    test('attribute and stop failures do not surface', () async {
      final NonBlockingPerformanceTracer tracer = NonBlockingPerformanceTracer((
        TraceName name,
      ) async {
        return TraceSession(
          putAttribute: (_, _) => throw StateError('attribute failed'),
          stop: () async => throw StateError('stop failed'),
        );
      });

      expect(await tracer.trace(TraceName.databaseOpen, () async => 9), 9);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
    });
  });
}

Future<TraceSession?> _neverStart(TraceName name) =>
    Completer<TraceSession?>().future;

Future<TraceSession?> _nullStart(TraceName name) async => null;
