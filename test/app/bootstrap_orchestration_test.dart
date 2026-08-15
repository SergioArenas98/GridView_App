import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/bootstrap.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/firebase/firebase_observability.dart';
import 'package:gridview/core/observability/observability_activation.dart';
import 'package:gridview/core/observability/observability_bootstrap.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';

import '../support/fake_observability.dart';

/// Startup orchestration, through the function production actually runs.
///
/// `bootstrap()` delegates to [runBootstrap] and adds nothing but the binding
/// and the environment, so these tests drive the real ordering rather than a
/// reconstruction of it. Only the four startup operations are injected: no
/// Firebase, no platform channel, no Android service.
///
/// The steps are recorded in a shared log so ordering is asserted as one
/// sequence rather than as four independent facts.
class _Recorder {
  final List<String> steps = <String>[];
  final List<Widget> apps = <Widget>[];

  /// The handler installed before bootstrap ran, so a step can prove routing
  /// was already taken over by the time it executed.
  FlutterExceptionHandler? handlerBeforeBootstrap;

  /// Whether `FlutterError.onError` had already changed when timezones loaded.
  bool? handlersInstalledAtTimeZones;

  /// Whether activation was still unresolved when the app was handed over.
  ObservabilityActivation? statusAtRunApp;

  /// The diagnostic sink bootstrap handed to the preference repository, so a
  /// test can drive it exactly as the repository would.
  void Function(PreferenceDiagnostic)? preferenceSink;
}

/// Builds operations that record their order and never touch a platform.
BootstrapOperations _operations(
  _Recorder recorder, {
  required ObservabilityActivator activator,
  ObservabilityBootstrap Function()? install,
  void Function()? onRunApplication,
}) {
  late ObservabilityBootstrap installed;
  return BootstrapOperations(
    environment: AppEnvironment.production,
    installObservability: () {
      recorder.steps.add('observability');
      installed =
          install?.call() ??
          installObservability(
            environment: AppEnvironment.production,
            activator: activator,
          );
      return installed;
    },
    ensureTimeZones: () {
      recorder.steps.add('timezones');
      recorder.handlersInstalledAtTimeZones = !identical(
        FlutterError.onError,
        recorder.handlerBeforeBootstrap,
      );
    },
    openPreferences:
        ({void Function(PreferenceDiagnostic diagnostic)? onDiagnostic}) async {
          recorder.steps.add('preferences');
          // Captured rather than invoked: the production repository would call this
          // whenever the store misbehaves, so a test can drive the real sink.
          recorder.preferenceSink = onDiagnostic;
          return AppPreferencesRepository(
            store: InMemoryPreferenceStore(),
            onDiagnostic: onDiagnostic,
          );
        },
    runApplication: (Widget app) {
      recorder.steps.add('runApp');
      recorder.apps.add(app);
      recorder.statusAtRunApp = installed.surface.status.value;
      onRunApplication?.call();
    },
  );
}

DeferredErrorReporter _reporterOf(ObservabilityBootstrap boot) =>
    boot.surface.reporter as DeferredErrorReporter;

FlutterErrorDetails _fatal(String message) =>
    FlutterErrorDetails(exception: StateError(message), library: 'test');

/// Runs [body] in a guarded zone and returns whatever escaped asynchronously.
///
/// An empty list is positive evidence: an uncaught asynchronous error raised
/// anywhere inside the zone — including by a future nobody awaited — is
/// delivered to the zone's handler and would appear here.
Future<List<Object>> _escaping(Future<void> Function() body) async {
  final List<Object> escaped = <Object>[];
  final Completer<void> finished = Completer<void>();

  runZonedGuarded<void>(() async {
    try {
      await body();
    } finally {
      if (!finished.isCompleted) finished.complete();
    }
  }, (Object error, StackTrace stack) => escaped.add(error));

  await finished.future;
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
  return escaped;
}

void main() {
  late _Recorder recorder;

  setUp(() {
    recorder = _Recorder()..handlerBeforeBootstrap = FlutterError.onError;
  });

  group('ordering', () {
    test('the four startup steps run in the documented order', () async {
      final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => never.future),
      );
      addTearDown(boot.handlers.restore);

      expect(recorder.steps, <String>[
        'observability',
        'timezones',
        'preferences',
        'runApp',
      ]);
    });

    test('global handlers are installed before startup continues', () async {
      final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => never.future),
      );
      addTearDown(boot.handlers.restore);

      expect(
        recorder.handlersInstalledAtTimeZones,
        isTrue,
        reason: 'timezone loading must already be covered by error routing',
      );
      expect(boot.handlers.ownsFlutterHandler, isTrue);
    });

    test('runApp is reached without waiting for activation', () async {
      // An activator that never completes: if bootstrap awaited it, this test
      // would time out instead of failing.
      final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => never.future),
      );
      addTearDown(boot.handlers.restore);

      expect(recorder.apps, hasLength(1));
      expect(recorder.statusAtRunApp, ObservabilityActivation.pending);
    });

    test('bootstrap performs no step beyond the four declared ones', () async {
      final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => never.future),
      );
      addTearDown(boot.handlers.restore);

      // Observability contributes handler installation and an unawaited
      // activation, and nothing else: no request, no database, no scheduled
      // synchronization, no media work. (That activation itself stays inert is
      // asserted in observability_startup_test.dart.)
      expect(recorder.steps, hasLength(4));
      expect(recorder.apps.single, isA<ProviderScope>());
    });
  });

  group('preference diagnostics reach the installed reporter', () {
    /// Drives the sink bootstrap actually handed to the repository, so this
    /// covers the production wiring rather than a re-creation of it.
    Future<List<ObservedFailure>> reportedFor(
      PreferenceDiagnostic diagnostic,
    ) async {
      final RecordingErrorReporter real = RecordingErrorReporter();
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();

      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => gate.future),
      );
      addTearDown(boot.handlers.restore);

      expect(
        recorder.preferenceSink,
        isNotNull,
        reason: 'bootstrap must supply a diagnostic sink, never leave it null',
      );
      recorder.preferenceSink!(diagnostic);

      gate.complete(
        FirebaseAdapters(reporter: real, tracer: RecordingPerformanceTracer()),
      );
      await boot.activation;
      return real.nonFatals;
    }

    test('an unopenable store is reported', () async {
      final List<ObservedFailure> reported = await reportedFor(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.storeUnavailable,
        ),
      );

      expect(reported, hasLength(1));
      final ObservedFailure failure = reported.single;
      expect(failure.kind, ObservedFailureKind.localPreferenceFailure);
      expect(failure.feature, ObservedFeature.settings);
      expect(failure.operation, ObservedOperation.preferenceStoreOpen);
      expect(failure.environment, AppEnvironment.production);
      // A whole-store failure concerns no single preference.
      expect(failure.preference, ObservedPreference.other);
    });

    test('a corrupted token is reported against its preference', () async {
      final List<ObservedFailure> reported = await reportedFor(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.corruptedValue,
          key: 'gv.preference.theme',
        ),
      );

      expect(reported, hasLength(1));
      expect(reported.single.operation, ObservedOperation.preferenceRead);
      expect(reported.single.preference, ObservedPreference.theme);
    });

    test('a failed write is reported against its preference', () async {
      final List<ObservedFailure> reported = await reportedFor(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.writeFailure,
          key: 'gv.preference.language',
        ),
      );

      expect(reported, hasLength(1));
      expect(reported.single.operation, ObservedOperation.preferenceWrite);
      expect(reported.single.preference, ObservedPreference.language);
    });

    test('an unknown key collapses instead of reaching the report', () async {
      final List<ObservedFailure> reported = await reportedFor(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.corruptedValue,
          key: 'gv.preference.something_added_later',
        ),
      );

      expect(reported.single.preference, ObservedPreference.other);
      // Structural, not stylistic: no attribute may carry the raw key.
      expect(
        reported.single.toAttributes().values,
        isNot(contains(contains('something_added_later'))),
      );
    });

    test('every attribute stays enum-derived', () async {
      final List<ObservedFailure> reported = await reportedFor(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.writeFailure,
          key: 'gv.preference.time_display',
        ),
      );

      expect(reported.single.toAttributes(), <String, String>{
        'failure': 'localPreferenceFailure',
        'feature': 'settings',
        'operation': 'preferenceWrite',
        'environment': 'production',
        'preference': 'timeDisplay',
      });
    });
  });

  group('activation resolves after the app is handed over', () {
    test('an error while pending enters the bounded buffer', () async {
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => gate.future),
      );
      addTearDown(boot.handlers.restore);

      FlutterError.reportError(_fatal('while pending'));

      final DeferredErrorReporter reporter = _reporterOf(boot);
      expect(reporter.bufferedCount, 1);
      expect(reporter.hasAdopted, isFalse);
      expect(reporter.bufferLimit, kDefaultStartupBufferLimit);

      gate.complete(null);
      await boot.activation;
    });

    test('success adopts the reporter and replays exactly once', () async {
      final RecordingErrorReporter real = RecordingErrorReporter();
      final RecordingPerformanceTracer tracer = RecordingPerformanceTracer();
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();

      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => gate.future),
      );
      addTearDown(boot.handlers.restore);

      FlutterError.reportError(_fatal('during activation'));
      expect(real.fatals, isEmpty, reason: 'nothing adopted yet');

      gate.complete(FirebaseAdapters(reporter: real, tracer: tracer));
      await boot.activation;

      expect(boot.surface.status.value, ObservabilityActivation.active);
      expect(real.fatals, hasLength(1));
      expect(
        (real.fatals.single.exception as StateError).message,
        'during activation',
      );
      expect(_reporterOf(boot).bufferedCount, 0);
    });

    test('a null activation disables and clears the buffer', () async {
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => gate.future),
      );
      addTearDown(boot.handlers.restore);

      FlutterError.reportError(_fatal('lost'));
      expect(_reporterOf(boot).bufferedCount, 1);

      gate.complete(null);
      await boot.activation;

      final DeferredErrorReporter reporter = _reporterOf(boot);
      expect(boot.surface.status.value, ObservabilityActivation.unavailable);
      expect(reporter.bufferedCount, 0);
      expect(reporter.isResolved, isTrue);
      // Reporting after a failed activation stays inert rather than throwing.
      expect(() => FlutterError.reportError(_fatal('after')), returnsNormally);
      expect(reporter.bufferedCount, 0);
    });

    test('the status changes after the app was handed over', () async {
      final Completer<FirebaseAdapters?> gate = Completer<FirebaseAdapters?>();
      final ObservabilityBootstrap boot = await runBootstrap(
        _operations(recorder, activator: () => gate.future),
      );
      addTearDown(boot.handlers.restore);

      expect(recorder.statusAtRunApp, ObservabilityActivation.pending);

      gate.complete(
        FirebaseAdapters(
          reporter: RecordingErrorReporter(),
          tracer: RecordingPerformanceTracer(),
        ),
      );
      await boot.activation;

      expect(boot.surface.status.value, ObservabilityActivation.active);
    });
  });

  group('a failing activation cannot break startup', () {
    test('a thrown activation never escapes', () async {
      late ObservabilityBootstrap boot;

      final List<Object> escaped = await _escaping(() async {
        boot = await runBootstrap(
          _operations(
            recorder,
            activator: () async => throw StateError('activation exploded'),
          ),
        );
        await boot.activation;
      });
      addTearDown(boot.handlers.restore);

      expect(escaped, isEmpty);
      expect(recorder.steps, hasLength(4));
      expect(boot.surface.status.value, ObservabilityActivation.unavailable);
    });

    test('an asynchronously rejected activation never escapes', () async {
      late ObservabilityBootstrap boot;

      final List<Object> escaped = await _escaping(() async {
        boot = await runBootstrap(
          _operations(
            recorder,
            activator: () =>
                Future<FirebaseAdapters?>.error(StateError('rejected later')),
          ),
        );
        await boot.activation;
      });
      addTearDown(boot.handlers.restore);

      expect(escaped, isEmpty);
      expect(boot.surface.status.value, ObservabilityActivation.unavailable);
      expect(
        recorder.apps,
        hasLength(1),
        reason: 'the app was handed over despite the failure',
      );
    });
  });
}
