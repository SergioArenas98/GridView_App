import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/async_error_reporter.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/global_error_handlers.dart';
import 'package:gridview/core/observability/observed_failure.dart';

/// Asynchronous reporting failures, proven against the production guard.
///
/// [AsyncErrorReporter] is the class `FirebaseErrorReporter` is built from, so
/// these tests drive the shipped code path with callbacks that reject instead of
/// callbacks that talk to Crashlytics. No Firebase type appears here and no
/// Firebase initialization happens — the seam is the two `Future`-returning
/// callbacks, which is the smallest one that keeps the guarantee testable.
///
/// Escape is detected with a guarded zone rather than by inspection: an
/// unawaited rejection is delivered to the zone's error handler, so an empty
/// list is positive evidence that nothing escaped. The first test proves the
/// detector itself works, so a later green run cannot be vacuous.
const ObservedFailure _failure = ObservedFailure(
  kind: ObservedFailureKind.invalidRemoteContract,
  feature: ObservedFeature.home,
  operation: ObservedOperation.resourceRefresh,
  environment: AppEnvironment.production,
);

FlutterErrorDetails _details(String message) =>
    FlutterErrorDetails(exception: StateError(message), library: 'test');

/// Runs [body] in a guarded zone and returns everything that escaped.
///
/// Two event-loop turns after the body, so a rejection scheduled by an unawaited
/// future has certainly been delivered before the list is read.
Future<List<Object>> _escaping(void Function() body) async {
  final List<Object> escaped = <Object>[];
  runZonedGuarded(body, (Object error, StackTrace stack) => escaped.add(error));
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
  return escaped;
}

/// A reporter whose asynchronous calls always reject, counting attempts.
///
/// The rejection is the point; the counters exist so a test can prove the call
/// was really attempted (not skipped) and attempted exactly once (not retried
/// or recursed into).
class _RejectingCalls {
  int fatals = 0;
  int nonFatals = 0;

  AsyncErrorReporter get reporter => AsyncErrorReporter(
    recordFatalAsync: (FlutterErrorDetails details) async {
      fatals++;
      throw StateError('crashlytics rejected the fatal');
    },
    recordNonFatalAsync: (ObservedFailure failure) async {
      nonFatals++;
      throw StateError('crashlytics rejected the non-fatal');
    },
  );
}

void main() {
  group('the escape detector itself', () {
    test('an unguarded rejected future does escape to the zone', () async {
      final List<Object> escaped = _unguardedEscape();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(
        escaped,
        hasLength(1),
        reason: 'if this ever passes empty, every other test here is vacuous',
      );
    });
  });

  group('a rejected reporting future never escapes', () {
    test('a rejected fatal report is absorbed', () async {
      final _RejectingCalls calls = _RejectingCalls();

      final List<Object> escaped = await _escaping(
        () => calls.reporter.recordFatal(_details('boom')),
      );

      expect(escaped, isEmpty);
      expect(calls.fatals, 1, reason: 'the call was attempted, not skipped');
    });

    test('a rejected non-fatal report is absorbed', () async {
      final _RejectingCalls calls = _RejectingCalls();

      final List<Object> escaped = await _escaping(
        () => calls.reporter.recordNonFatal(_failure),
      );

      expect(escaped, isEmpty);
      expect(calls.nonFatals, 1);
    });

    test('a callback that throws synchronously is absorbed too', () async {
      final AsyncErrorReporter reporter = AsyncErrorReporter(
        // Not `async`: this throws before any future exists.
        recordFatalAsync: (FlutterErrorDetails details) =>
            throw StateError('threw before returning a future'),
        recordNonFatalAsync: (ObservedFailure failure) async {},
      );

      final List<Object> escaped = await _escaping(
        () => reporter.recordFatal(_details('boom')),
      );

      expect(escaped, isEmpty);
    });

    test('reporting a failure produces no second report', () async {
      final _RejectingCalls calls = _RejectingCalls();

      final List<Object> escaped = await _escaping(() {
        calls.reporter.recordFatal(_details('boom'));
        calls.reporter.recordNonFatal(_failure);
      });

      expect(escaped, isEmpty);
      // One attempt each. A reporter failure that was itself reported would
      // re-enter this reporter and show up as extra attempts.
      expect(calls.fatals, 1);
      expect(calls.nonFatals, 1);
    });
  });

  group('the original application error survives a failing reporter', () {
    test('the previous handler still receives the untouched details', () async {
      final _RejectingCalls calls = _RejectingCalls();
      final List<FlutterErrorDetails> presented = <FlutterErrorDetails>[];

      final FlutterExceptionHandler? previous = FlutterError.onError;
      FlutterError.onError = presented.add;
      addTearDown(() => FlutterError.onError = previous);

      final GlobalErrorHandlerRegistration handlers =
          installGlobalErrorHandlers(calls.reporter);
      addTearDown(handlers.restore);

      final FlutterErrorDetails original = _details('the real failure');
      final List<Object> escaped = await _escaping(
        () => FlutterError.reportError(original),
      );

      expect(escaped, isEmpty);
      expect(calls.fatals, 1, reason: 'reporting was attempted and rejected');
      expect(presented, hasLength(1));
      expect(
        identical(presented.single, original),
        isTrue,
        reason: 'the reporting failure must not replace or wrap the original',
      );
      expect(
        (presented.single.exception as StateError).message,
        'the real failure',
      );
    });
  });

  group('buffered replay cannot leak a rejected future', () {
    test('adoption replays into a rejecting reporter safely', () async {
      final _RejectingCalls calls = _RejectingCalls();
      final DeferredErrorReporter deferred = DeferredErrorReporter();

      deferred.recordFatal(_details('first'));
      deferred.recordNonFatal(_failure);
      expect(deferred.bufferedCount, 2);

      final List<Object> escaped = await _escaping(
        () => deferred.adopt(calls.reporter),
      );

      expect(escaped, isEmpty);
      expect(deferred.bufferedCount, 0);
      expect(calls.fatals, 1);
      expect(calls.nonFatals, 1);
    });

    test('reports after adoption still follow the replay policy', () async {
      final List<String> order = <String>[];
      final DeferredErrorReporter deferred = DeferredErrorReporter();

      final AsyncErrorReporter reporter = AsyncErrorReporter(
        recordFatalAsync: (FlutterErrorDetails details) async {
          order.add((details.exception as StateError).message);
          throw StateError('rejected');
        },
        recordNonFatalAsync: (ObservedFailure failure) async {
          order.add('non-fatal');
          throw StateError('rejected');
        },
      );

      deferred.recordFatal(_details('buffered-1'));
      deferred.recordFatal(_details('buffered-2'));

      final List<Object> escaped = await _escaping(() {
        deferred.adopt(reporter);
        // Arriving after adoption: passed straight through, never buffered.
        deferred.recordFatal(_details('live-3'));
        deferred.recordNonFatal(_failure);
      });

      expect(escaped, isEmpty);
      expect(order, <String>[
        'buffered-1',
        'buffered-2',
        'live-3',
        'non-fatal',
      ], reason: 'buffered reports replay once, in order, before live ones');
      expect(deferred.bufferedCount, 0);
      expect(deferred.hasAdopted, isTrue);
    });

    test('an overflowing buffer still replays without escaping', () async {
      final _RejectingCalls calls = _RejectingCalls();
      final DeferredErrorReporter deferred = DeferredErrorReporter(
        bufferLimit: 2,
      );

      deferred.recordFatal(_details('kept-1'));
      deferred.recordFatal(_details('kept-2'));
      deferred.recordFatal(_details('dropped-newest'));

      expect(deferred.bufferedCount, 2);
      expect(deferred.droppedCount, 1);

      final List<Object> escaped = await _escaping(
        () => deferred.adopt(calls.reporter),
      );

      expect(escaped, isEmpty);
      expect(calls.fatals, 2, reason: 'the oldest two, exactly once each');
    });
  });
}

/// Deliberately unguarded, to prove [_escaping] can see an escape at all.
List<Object> _unguardedEscape() {
  final List<Object> escaped = <Object>[];
  runZonedGuarded(() {
    unawaited(Future<void>.error(StateError('unguarded')));
  }, (Object error, StackTrace stack) => escaped.add(error));
  return escaped;
}
