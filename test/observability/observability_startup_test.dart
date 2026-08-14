import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/firebase/firebase_observability.dart';
import 'package:gridview/core/observability/observability_bootstrap.dart';
import 'package:gridview/core/observability/observability_providers.dart';
import 'package:gridview/core/observability/observability_status.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/core/observability/performance_tracer.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';

import '../support/fake_observability.dart';

/// Startup orchestration, through the real `installObservability` with the
/// activation seam injected.
///
/// The rule: observability is never a startup dependency. These tests drive the
/// production orchestration — the same function `bootstrap` calls — with an
/// activator that succeeds, fails, throws or never completes.
const ObservedFailure _failure = ObservedFailure(
  kind: ObservedFailureKind.invalidRemoteContract,
  feature: ObservedFeature.home,
  operation: ObservedOperation.resourceRefresh,
  environment: AppEnvironment.production,
);

FlutterErrorDetails _fatal(String message) =>
    FlutterErrorDetails(exception: StateError(message), library: 'test');

void main() {
  group('eligibility decides whether activation is even attempted', () {
    test('a non-eligible build settles inert and never activates', () async {
      bool activatorCalled = false;
      final ObservabilityBootstrap boot = installObservability(
        environment: AppEnvironment.development,
        activator: () async {
          activatorCalled = true;
          return null;
        },
      );
      addTearDown(boot.handlers.restore);
      await boot.activation;

      expect(activatorCalled, isFalse);
      expect(boot.surface.status.value, ObservabilityStatus.disabledByPolicy);
    });

    test('an eligible build reports pending before activation resolves', () {
      final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = installObservability(
        environment: AppEnvironment.production,
        activator: () => never.future,
      );
      addTearDown(boot.handlers.restore);

      expect(boot.surface.status.value, ObservabilityStatus.pending);
    });
  });

  group('activation outcomes', () {
    test('success moves to activated and flushes the buffer once', () async {
      final RecordingErrorReporter reporter = RecordingErrorReporter();
      final RecordingPerformanceTracer tracer = RecordingPerformanceTracer();
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();

      final ObservabilityBootstrap boot = installObservability(
        environment: AppEnvironment.production,
        activator: () => gate.future,
      );
      addTearDown(boot.handlers.restore);

      // An error inside the activation window.
      FlutterError.reportError(_fatal('during activation'));
      expect(reporter.fatals, isEmpty, reason: 'nothing adopted yet');

      gate.complete(FirebaseAdapters(reporter: reporter, tracer: tracer));
      await boot.activation;

      expect(boot.surface.status.value, ObservabilityStatus.activated);
      expect(
        reporter.fatals,
        hasLength(1),
        reason: 'the buffered error is replayed exactly once',
      );
      expect(
        (reporter.fatals.single.exception as StateError).message,
        'during activation',
      );
    });

    test(
      'a null result moves to unavailable and discards the buffer',
      () async {
        final ObservabilityBootstrap boot = installObservability(
          environment: AppEnvironment.production,
          activator: () async => null,
        );
        addTearDown(boot.handlers.restore);

        FlutterError.reportError(_fatal('lost'));
        await boot.activation;

        expect(boot.surface.status.value, ObservabilityStatus.unavailable);
        // Reporting after a failed activation is inert, never an error.
        expect(
          () => FlutterError.reportError(_fatal('after')),
          returnsNormally,
        );
      },
    );

    test('an activator that throws cannot crash startup', () async {
      final ObservabilityBootstrap boot = installObservability(
        environment: AppEnvironment.production,
        activator: () async => throw StateError('activation exploded'),
      );
      addTearDown(boot.handlers.restore);

      await expectLater(boot.activation, completes);
      expect(boot.surface.status.value, ObservabilityStatus.unavailable);
    });
  });

  testWidgets('the app renders while activation is still pending', (
    WidgetTester tester,
  ) async {
    final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
    final ObservabilityBootstrap boot = installObservability(
      environment: AppEnvironment.production,
      activator: () => never.future,
    );
    addTearDown(boot.handlers.restore);

    // The production ordering: install, do not await, render.
    await tester.pumpWidget(
      ProviderScope(
        overrides: <dynamic>[
          observabilityProvider.overrideWithValue(boot.surface),
        ].cast(),
        child: const MaterialApp(home: Text('rendered')),
      ),
    );

    expect(find.text('rendered'), findsOneWidget);
    expect(boot.surface.status.value, ObservabilityStatus.pending);
  });

  group('the startup buffer', () {
    test('retains in order and replays each report exactly once', () async {
      final RecordingErrorReporter reporter = RecordingErrorReporter();
      final DeferredErrorReporter deferred = DeferredErrorReporter();

      deferred.recordFatal(_fatal('first'));
      deferred.recordNonFatal(_failure);
      deferred.recordFatal(_fatal('second'));
      expect(deferred.bufferedCount, 3);

      deferred.adopt(reporter);

      expect(deferred.bufferedCount, 0);
      expect(
        reporter.fatals.map((FlutterErrorDetails d) {
          return (d.exception as StateError).message;
        }),
        <String>['first', 'second'],
      );
      expect(reporter.nonFatals, hasLength(1));

      // A second adopt cannot replay anything again.
      final RecordingErrorReporter second = RecordingErrorReporter();
      deferred.adopt(second);
      expect(second.fatals, isEmpty);
    });

    test('overflow drops the newest and keeps the oldest', () {
      final RecordingErrorReporter reporter = RecordingErrorReporter();
      final DeferredErrorReporter deferred = DeferredErrorReporter(
        bufferLimit: 3,
      );

      for (int i = 0; i < 10; i++) {
        deferred.recordFatal(_fatal('e$i'));
      }

      expect(deferred.bufferedCount, 3);
      expect(deferred.droppedCount, 7);

      deferred.adopt(reporter);
      expect(
        reporter.fatals.map((FlutterErrorDetails d) {
          return (d.exception as StateError).message;
        }),
        <String>['e0', 'e1', 'e2'],
        reason: 'the first failure explains the cascade; keep it',
      );
    });

    test('disable clears the buffer without throwing', () {
      final DeferredErrorReporter deferred = DeferredErrorReporter();
      deferred.recordFatal(_fatal('x'));
      expect(deferred.bufferedCount, 1);

      expect(deferred.disable, returnsNormally);
      expect(deferred.bufferedCount, 0);
      expect(deferred.isResolved, isTrue);
      // Post-disable reports are inert, not buffered and not thrown.
      expect(() => deferred.recordFatal(_fatal('y')), returnsNormally);
      expect(deferred.bufferedCount, 0);
    });

    test('a replay failure cannot become a new uncaught error', () {
      final DeferredErrorReporter deferred = DeferredErrorReporter();
      deferred.recordFatal(_fatal('x'));
      deferred.recordNonFatal(_failure);

      // A reporter that throws on every call, adopted with a full buffer: the
      // replay must swallow, or the error would land back in the global
      // handler this reporter serves.
      expect(
        () => deferred.adopt(const ThrowingErrorReporter()),
        returnsNormally,
      );
    });

    test('the tracer buffers nothing and never delays work', () async {
      final DeferredPerformanceTracer tracer = DeferredPerformanceTracer();
      final RecordingPerformanceTracer real = RecordingPerformanceTracer();

      expect(await tracer.trace(TraceName.syncRun, () async => 1), 1);
      expect(real.started, isEmpty);

      tracer.adopt(real);
      expect(await tracer.trace(TraceName.syncRun, () async => 2), 2);
      expect(real.started, <TraceName>[TraceName.syncRun]);
    });
  });

  testWidgets('observability triggers no API, sync or media work', (
    WidgetTester tester,
  ) async {
    final ObservabilityBootstrap boot = installObservability(
      environment: AppEnvironment.production,
      activator: () async => null,
    );
    addTearDown(boot.handlers.restore);
    await boot.activation;

    final ProviderContainer container = ProviderContainer(
      overrides: <dynamic>[
        appEnvironmentProvider.overrideWithValue(AppEnvironment.development),
        observabilityProvider.overrideWithValue(boot.surface),
      ].cast(),
    );
    addTearDown(container.dispose);

    container.read(errorReporterProvider);
    container.read(performanceTracerProvider);
    container.read(observabilityStatusProvider);
    await tester.pump();

    expect(container.exists(remoteApiProvider), isFalse);
    expect(container.exists(databaseProvider), isFalse);
    expect(container.exists(appSyncCoordinatorProvider), isFalse);
  });
}
