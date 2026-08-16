import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/async_error_reporter.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/observed_failure.dart';

/// Concurrent reports must not cross-contaminate each other's attributes.
///
/// Crashlytics custom keys are process-global: a report is `setCustomKey` for
/// every attribute followed by `recordError`, and the record reads whatever the
/// keys hold *at that moment*. Two unawaited sequences interleave, so a report
/// can be filed under another failure's feature and operation.
///
/// [AsyncErrorReporter] is the class `FirebaseErrorReporter` is built from, and
/// it is the component under test here. The backend is modelled by a fake that
/// reproduces the property that matters — one shared key map, read at record
/// time — so an interleaving would be visible as a wrong attribute set rather
/// than having to be inferred.
const ObservedFailure _first = ObservedFailure(
  kind: ObservedFailureKind.invalidRemoteContract,
  feature: ObservedFeature.home,
  operation: ObservedOperation.resourceRefresh,
  environment: AppEnvironment.production,
);

const ObservedFailure _second = ObservedFailure(
  kind: ObservedFailureKind.localDatabaseFailure,
  feature: ObservedFeature.calendar,
  operation: ObservedOperation.snapshotApply,
  environment: AppEnvironment.production,
);

FlutterErrorDetails _fatal(String message) =>
    FlutterErrorDetails(exception: StateError(message), library: 'test');

/// A stand-in for Crashlytics' process-global custom-key context.
///
/// Deliberately models the hazard rather than avoiding it: [keys] is shared
/// across reports exactly as the real SDK's context is, so nothing but real
/// serialization can keep [recorded] correct.
class _GlobalKeyBackend {
  final Map<String, String> keys = <String, String>{};

  /// Each recorded report, paired with the keys visible when it was recorded.
  final List<MapEntry<String, Map<String, String>>> recorded =
      <MapEntry<String, Map<String, String>>>[];

  /// Every backend call, in order, so interleaving is directly observable.
  final List<String> calls = <String>[];

  /// Gates, so a test can hold one report open while another is submitted.
  final Map<String, Completer<void>> gates = <String, Completer<void>>{};

  /// Failures to inject, by report label.
  final Set<String> failing = <String>{};

  int attempts = 0;

  Future<void> send(String label, Map<String, String> attributes) async {
    attempts++;
    for (final MapEntry<String, String> entry in attributes.entries) {
      calls.add('key:$label:${entry.key}');
      keys[entry.key] = entry.value;
      // An await between key writes: the real SDK's are asynchronous too, and
      // this is precisely where an unserialized second report would cut in.
      await Future<void>.delayed(Duration.zero);
    }

    final Completer<void>? gate = gates[label];
    if (gate != null) {
      await gate.future;
    }

    if (failing.contains(label)) {
      calls.add('fail:$label');
      throw StateError('backend rejected $label');
    }

    calls.add('record:$label');
    recorded.add(
      MapEntry<String, Map<String, String>>(
        label,
        Map<String, String>.of(keys),
      ),
    );
  }
}

/// Wires the backend to the real reporter, labelling by feature so a report is
/// identifiable without carrying anything the contract forbids.
AsyncErrorReporter _reporter(_GlobalKeyBackend backend) => AsyncErrorReporter(
  recordFatalAsync: (FlutterErrorDetails details) => backend.send(
    'fatal:${(details.exception as StateError).message}',
    <String, String>{'kind': 'fatal'},
  ),
  recordNonFatalAsync: (ObservedFailure failure) =>
      backend.send(failure.feature.name, failure.toAttributes()),
);

void main() {
  group('a held report blocks the next one', () {
    test('the second cannot mutate keys before the first records', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      backend.gates['home'] = Completer<void>();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_first);
      // Let the first report get as far as its gate.
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      reporter.recordNonFatal(_second);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(
        backend.calls.where((String c) => c.startsWith('key:calendar')),
        isEmpty,
        reason: 'the queued report must not touch keys while one is in flight',
      );

      backend.gates['home']!.complete();
      await reporter.settled;

      expect(
        backend.recorded.map(
          (MapEntry<String, Map<String, String>> e) => e.key,
        ),
        <String>['home', 'calendar'],
      );
    });

    test('attributes stay with the correct report', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      backend.gates['home'] = Completer<void>();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_first);
      await Future<void>.delayed(Duration.zero);
      reporter.recordNonFatal(_second);

      backend.gates['home']!.complete();
      await reporter.settled;

      expect(backend.recorded, hasLength(2));
      expect(backend.recorded[0].value, _first.toAttributes());
      expect(backend.recorded[1].value, _second.toAttributes());
    });

    test('FIFO order is preserved across many reports', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      final AsyncErrorReporter reporter = _reporter(backend);

      const List<ObservedFeature> order = <ObservedFeature>[
        ObservedFeature.home,
        ObservedFeature.calendar,
        ObservedFeature.standings,
        ObservedFeature.drivers,
      ];
      for (final ObservedFeature feature in order) {
        reporter.recordNonFatal(
          ObservedFailure(
            kind: ObservedFailureKind.invalidRemoteContract,
            feature: feature,
            operation: ObservedOperation.resourceRefresh,
            environment: AppEnvironment.production,
          ),
        );
      }
      await reporter.settled;

      expect(
        backend.recorded.map(
          (MapEntry<String, Map<String, String>> e) => e.key,
        ),
        order.map((ObservedFeature f) => f.name),
      );
    });

    test('fatals share the lane with non-fatals', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_first);
      reporter.recordFatal(_fatal('crash'));
      reporter.recordNonFatal(_second);
      await reporter.settled;

      expect(
        backend.recorded.map(
          (MapEntry<String, Map<String, String>> e) => e.key,
        ),
        <String>['home', 'fatal:crash', 'calendar'],
      );
    });
  });

  group('the lane cannot be broken', () {
    test('a failed report does not poison later ones', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend()
        ..failing.add('home');
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_first);
      reporter.recordNonFatal(_second);
      await reporter.settled;

      expect(backend.calls, contains('fail:home'));
      expect(
        backend.recorded.map(
          (MapEntry<String, Map<String, String>> e) => e.key,
        ),
        <String>['calendar'],
        reason: 'the report behind a failure must still be delivered',
      );
      expect(backend.attempts, 2, reason: 'each attempted exactly once');
    });

    test('a synchronous throw does not break the lane', () async {
      final List<String> recorded = <String>[];
      bool first = true;
      final AsyncErrorReporter reporter = AsyncErrorReporter(
        recordFatalAsync: (FlutterErrorDetails details) async {},
        recordNonFatalAsync: (ObservedFailure failure) {
          if (first) {
            first = false;
            // Not `async`: throws before any future exists.
            throw StateError('threw before returning a future');
          }
          recorded.add(failure.feature.name);
          return Future<void>.value();
        },
      );

      reporter.recordNonFatal(_first);
      reporter.recordNonFatal(_second);
      await reporter.settled;

      expect(recorded, <String>['calendar']);
    });

    test('each report is attempted exactly once', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_first);
      reporter.recordNonFatal(_first);
      await reporter.settled;

      expect(backend.attempts, 2);
      expect(backend.recorded, hasLength(2));
    });
  });

  group('callers never wait', () {
    test('recording returns before the backend does', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      backend.gates['home'] = Completer<void>();
      final AsyncErrorReporter reporter = _reporter(backend);

      bool returned = false;
      reporter.recordNonFatal(_first);
      returned = true;

      expect(returned, isTrue);
      expect(backend.recorded, isEmpty);
      expect(reporter.pendingReports, greaterThan(0));

      backend.gates['home']!.complete();
      await reporter.settled;
      expect(reporter.pendingReports, 0);
    });

    test('buffered startup reports replay through the same lane', () async {
      final _GlobalKeyBackend backend = _GlobalKeyBackend();
      final AsyncErrorReporter reporter = _reporter(backend);
      final DeferredErrorReporter deferred = DeferredErrorReporter();

      deferred.recordNonFatal(_first);
      deferred.recordNonFatal(_second);
      deferred.adopt(reporter);
      await reporter.settled;

      expect(
        backend.recorded.map(
          (MapEntry<String, Map<String, String>> e) => e.key,
        ),
        <String>['home', 'calendar'],
      );
      expect(backend.recorded[0].value, _first.toAttributes());
      expect(backend.recorded[1].value, _second.toAttributes());
    });
  });
}
