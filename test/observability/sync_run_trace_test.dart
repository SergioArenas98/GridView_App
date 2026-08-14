import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/observability/performance_tracer.dart';

import '../support/fake_observability.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';
import '../sync/app_sync_coordinator_test.dart' show scriptCoreEndpoints;

/// `gv_sync_run` against the real coordinator.
///
/// The trace is only defensible as low-frequency if runs genuinely cannot
/// overlap. That is a property of the coordinator, not of the tracer — the
/// Firebase adapter creates a fresh `Trace` per call and would happily open two
/// with the same name — so it is asserted here, on the real object.
void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RecordingPerformanceTracer tracer;
  late SyncHarness harness;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    tracer = RecordingPerformanceTracer();
    scriptCoreEndpoints(api);
    harness = SyncHarness(db, api, tracer: tracer);
  });

  tearDown(() async {
    await harness.dispose();
    await db.close();
  });

  test('a startup run produces exactly one successful trace', () async {
    await harness.coordinator.start();

    expect(tracer.started, <TraceName>[TraceName.syncRun]);
    expect(tracer.stopped, <TraceName>[TraceName.syncRun]);
    expect(tracer.outcomes, <TraceOutcome>[TraceOutcome.success]);
    expect(tracer.peakConcurrency, 1);
  });

  test('concurrent triggers join the active run, not a second trace', () async {
    // Three simultaneous triggers, one run: the coordinator returns the
    // in-flight future rather than starting another.
    await Future.wait<void>(<Future<void>>[
      harness.coordinator.start(),
      harness.coordinator.onForeground(),
      harness.coordinator.start(),
    ]);

    expect(tracer.started, hasLength(1));
    expect(
      tracer.peakConcurrency,
      1,
      reason: 'two traces with the same name must never be open at once',
    );
  });

  test(
    'a manual request during a run is serialised, never concurrent',
    () async {
      final Future<void> startup = harness.coordinator.start();
      // Queued behind the active run rather than starting its own.
      final Future<void> manual = harness.coordinator.refreshNow();
      await Future.wait<void>(<Future<void>>[startup, manual]);

      expect(
        tracer.peakConcurrency,
        1,
        reason: 'the pending manual follow-up must not open a concurrent trace',
      );
      expect(tracer.started.length, tracer.stopped.length);
      for (final TraceName name in tracer.started) {
        expect(name, TraceName.syncRun);
      }
    },
  );

  test('a subsequent foreground run traces again, one at a time', () async {
    await harness.coordinator.start();
    await harness.coordinator.onForeground();

    expect(tracer.started, hasLength(2));
    expect(tracer.peakConcurrency, 1);
    expect(tracer.outcomes, everyElement(TraceOutcome.success));
  });

  test('the no-op tracer leaves the run observably unchanged', () async {
    final GridViewDatabase plainDb = GridViewDatabase.forTesting(
      NativeDatabase.memory(),
    );
    final ScriptedGridViewApi plainApi = ScriptedGridViewApi();
    scriptCoreEndpoints(plainApi);
    final SyncHarness plain = SyncHarness(plainDb, plainApi);
    addTearDown(() async {
      await plain.dispose();
      await plainDb.close();
    });

    await plain.coordinator.start();

    // Same terminal state as the traced run above: tracing is side-effect free.
    expect(plain.coordinator.isRunning, isFalse);
  });
}
