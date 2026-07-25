import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

void main() {
  group('RefreshCoordinator', () {
    test('two refreshes for the same key run the action once', () async {
      final RefreshCoordinator c = RefreshCoordinator();
      int calls = 0;
      final Completer<void> gate = Completer<void>();
      Future<RefreshResult> action() async {
        calls++;
        await gate.future;
        return const RefreshSuccess();
      }

      final Future<RefreshResult> a = c.run('home:current', action);
      final Future<RefreshResult> b = c.run('home:current', action);
      expect(c.isInFlight('home:current'), isTrue);

      gate.complete();
      await Future.wait(<Future<RefreshResult>>[a, b]);
      expect(calls, 1, reason: 'the second call joined the in-flight run');
      expect(c.isInFlight('home:current'), isFalse);
    });

    test('different keys run independently', () async {
      final RefreshCoordinator c = RefreshCoordinator();
      int home = 0;
      int calendar = 0;
      final Completer<void> gate = Completer<void>();
      final Future<RefreshResult> a = c.run('home:current', () async {
        home++;
        await gate.future;
        return const RefreshSuccess();
      });
      final Future<RefreshResult> b = c.run('calendar:2026', () async {
        calendar++;
        await gate.future;
        return const RefreshSuccess();
      });
      expect(c.isInFlight('home:current'), isTrue);
      expect(c.isInFlight('calendar:2026'), isTrue);

      gate.complete();
      await Future.wait(<Future<RefreshResult>>[a, b]);
      expect(home, 1);
      expect(calendar, 1);
    });

    test('a failed run releases the key so a retry re-runs', () async {
      final RefreshCoordinator c = RefreshCoordinator();
      int calls = 0;
      Future<RefreshResult> failing() async {
        calls++;
        return const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );
      }

      await c.run('home:current', failing);
      expect(c.isInFlight('home:current'), isFalse);
      await c.run('home:current', failing);
      expect(calls, 2, reason: 'the slot was released after the first failure');
    });

    test('a thrown action releases the key', () async {
      final RefreshCoordinator c = RefreshCoordinator();
      await expectLater(
        c.run('home:current', () async => throw StateError('boom')),
        throwsA(isA<StateError>()),
      );
      expect(c.isInFlight('home:current'), isFalse);
      // A subsequent run works.
      final RefreshResult r = await c.run(
        'home:current',
        () async => const RefreshSuccess(),
      );
      expect(r, isA<RefreshSuccess>());
    });
  });
}
