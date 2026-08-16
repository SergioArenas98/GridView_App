import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/async_error_reporter.dart';
import 'package:gridview/core/observability/normalized_report_recorder.dart';
import 'package:gridview/core/observability/observed_failure.dart';

/// Sequential context leakage, and the normalization that prevents it.
///
/// Crashlytics custom keys are process-global and survive until overwritten, so
/// serializing reports is not enough: a key one report sets is still attached to
/// the next. Two concrete leaks existed —
///
/// * `ObservedFailure.toAttributes()` omits `preference` when none applies, so a
///   preference failure's `preference=theme` survived into the following
///   ordinary non-fatal;
/// * a fatal wrote no keys at all, so it was filed under whatever failure,
///   feature and operation the previous non-fatal left behind.
///
/// [NormalizedReportRecorder] is the shipped component `FirebaseErrorReporter`
/// is built from, and it is what these tests drive. The backend fake keeps one
/// shared key map — exactly as the SDK's context behaves — and snapshots it at
/// each record, so leakage is directly observable rather than inferred.
const ObservedFailure _ordinary = ObservedFailure(
  kind: ObservedFailureKind.invalidRemoteContract,
  feature: ObservedFeature.home,
  operation: ObservedOperation.resourceRefresh,
  environment: AppEnvironment.production,
);

const ObservedFailure _themePreference = ObservedFailure(
  kind: ObservedFailureKind.localPreferenceFailure,
  feature: ObservedFeature.settings,
  operation: ObservedOperation.preferenceRead,
  environment: AppEnvironment.production,
  preference: ObservedPreference.theme,
);

const ObservedFailure _languagePreference = ObservedFailure(
  kind: ObservedFailureKind.localPreferenceFailure,
  feature: ObservedFeature.settings,
  operation: ObservedOperation.preferenceWrite,
  environment: AppEnvironment.production,
  preference: ObservedPreference.language,
);

FlutterErrorDetails _fatal(String message) => FlutterErrorDetails(
  exception: StateError(message),
  library: 'a library that must never become a custom key',
  context: ErrorDescription('a context that must never become a custom key'),
);

const String _na = NormalizedReportRecorder.notApplicable;

/// The expected wire context for a non-fatal, written in full every time.
Map<String, String> _expected(ObservedFailure failure) => <String, String>{
  ObservedFailure.failureKey: failure.kind.name,
  ObservedFailure.featureKey: failure.feature.name,
  ObservedFailure.operationKey: failure.operation.name,
  ObservedFailure.environmentKey: failure.environment.name,
  ObservedFailure.preferenceKey: failure.preference?.name ?? _na,
};

/// The expected wire context for a fatal: neutral in every dimension it cannot
/// speak to, and never inherited.
const Map<String, String> _expectedFatal = <String, String>{
  ObservedFailure.failureKey: NormalizedReportRecorder.fatalFailure,
  ObservedFailure.featureKey: _na,
  ObservedFailure.operationKey: _na,
  ObservedFailure.environmentKey: 'production',
  ObservedFailure.preferenceKey: _na,
};

/// A stand-in for Crashlytics' process-global custom-key context.
class _Backend {
  /// Shared across reports, exactly as the SDK's context is.
  final Map<String, String> keys = <String, String>{};

  /// Label plus the keys visible at the moment of recording.
  final List<MapEntry<String, Map<String, String>>> recorded =
      <MapEntry<String, Map<String, String>>>[];

  final Set<String> failing = <String>{};
  int attempts = 0;

  Future<void> setCustomKey(String key, String value) async {
    keys[key] = value;
    await Future<void>.delayed(Duration.zero);
  }

  Future<void> record(String label) async {
    attempts++;
    if (failing.contains(label)) {
      throw StateError('backend rejected $label');
    }
    recorded.add(
      MapEntry<String, Map<String, String>>(
        label,
        Map<String, String>.of(keys),
      ),
    );
  }
}

/// The real recorder, wired to the fake backend.
NormalizedReportRecorder _recorder(_Backend backend) =>
    NormalizedReportRecorder(
      setCustomKey: backend.setCustomKey,
      recordNonFatal: (ObservedFailure failure) =>
          backend.record(failure.kind.name),
      recordFatal: (FlutterErrorDetails details) =>
          backend.record('fatal:${(details.exception as StateError).message}'),
      environment: AppEnvironment.production,
    );

/// The real reporter over the real recorder — the full shipped composition.
AsyncErrorReporter _reporter(_Backend backend) {
  final NormalizedReportRecorder recorder = _recorder(backend);
  return AsyncErrorReporter(
    recordFatalAsync: recorder.sendFatal,
    recordNonFatalAsync: recorder.sendNonFatal,
  );
}

void main() {
  group('every report writes the complete owned key set', () {
    test('a preference non-fatal, then an ordinary one', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_themePreference);
      reporter.recordNonFatal(_ordinary);
      await reporter.settled;

      expect(backend.recorded, hasLength(2));
      expect(backend.recorded[0].value, _expected(_themePreference));
      expect(
        backend.recorded[1].value,
        _expected(_ordinary),
        reason: 'the ordinary report must not inherit preference=theme',
      );
      expect(backend.recorded[1].value[ObservedFailure.preferenceKey], _na);
    });

    test('an ordinary non-fatal, then a preference one', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_ordinary);
      reporter.recordNonFatal(_languagePreference);
      await reporter.settled;

      expect(backend.recorded[0].value, _expected(_ordinary));
      expect(backend.recorded[1].value, _expected(_languagePreference));
    });

    test('a preference non-fatal, then a fatal', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_themePreference);
      reporter.recordFatal(_fatal('crash'));
      await reporter.settled;

      expect(backend.recorded[1].value, _expectedFatal);
      // Nothing from the preference report survived into the crash.
      expect(
        backend.recorded[1].value.values,
        isNot(contains(ObservedFeature.settings.name)),
      );
      expect(
        backend.recorded[1].value.values,
        isNot(contains(ObservedPreference.theme.name)),
      );
    });

    test('a fatal, then an ordinary non-fatal', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordFatal(_fatal('crash'));
      reporter.recordNonFatal(_ordinary);
      await reporter.settled;

      expect(backend.recorded[0].value, _expectedFatal);
      expect(backend.recorded[1].value, _expected(_ordinary));
      expect(
        backend.recorded[1].value[ObservedFailure.failureKey],
        isNot(NormalizedReportRecorder.fatalFailure),
      );
    });

    test('two different preference failures', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_themePreference);
      reporter.recordNonFatal(_languagePreference);
      await reporter.settled;

      expect(
        backend.recorded[0].value[ObservedFailure.preferenceKey],
        ObservedPreference.theme.name,
      );
      expect(
        backend.recorded[1].value[ObservedFailure.preferenceKey],
        ObservedPreference.language.name,
      );
      expect(
        backend.recorded[1].value[ObservedFailure.operationKey],
        ObservedOperation.preferenceWrite.name,
      );
    });

    test('a failed report does not leak into the next one', () async {
      final _Backend backend = _Backend()
        ..failing.add(ObservedFailureKind.localPreferenceFailure.name);
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_themePreference);
      reporter.recordNonFatal(_ordinary);
      await reporter.settled;

      expect(backend.attempts, 2, reason: 'each attempted exactly once');
      expect(backend.recorded, hasLength(1));
      expect(backend.recorded.single.value, _expected(_ordinary));
      expect(backend.recorded.single.value[ObservedFailure.preferenceKey], _na);
    });
  });

  group('the written context is exactly the owned set', () {
    test('no key outside the owned set is ever written', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordNonFatal(_themePreference);
      reporter.recordFatal(_fatal('crash'));
      reporter.recordNonFatal(_ordinary);
      await reporter.settled;

      expect(
        backend.keys.keys.toSet(),
        NormalizedReportRecorder.ownedKeys.toSet(),
      );
      for (final MapEntry<String, Map<String, String>> item
          in backend.recorded) {
        expect(
          item.value.keys.toSet(),
          NormalizedReportRecorder.ownedKeys.toSet(),
          reason: '${item.key} wrote an unexpected or incomplete key set',
        );
      }
    });

    test('an attribute outside the owned set is dropped', () async {
      final _Backend backend = _Backend();
      final NormalizedReportRecorder recorder = NormalizedReportRecorder(
        setCustomKey: backend.setCustomKey,
        // A deliberately non-conforming source, to prove the recorder — not the
        // caller — is what bounds the key set.
        recordNonFatal: (ObservedFailure failure) => backend.record('custom'),
        recordFatal: (FlutterErrorDetails details) => backend.record('fatal'),
        environment: AppEnvironment.production,
      );

      await recorder.sendNonFatal(_ordinary);

      expect(
        backend.keys.keys.toSet(),
        NormalizedReportRecorder.ownedKeys.toSet(),
      );
    });

    test('nothing from the exception reaches a custom key', () async {
      final _Backend backend = _Backend();
      final AsyncErrorReporter reporter = _reporter(backend);

      reporter.recordFatal(_fatal('a message that must never be a key'));
      await reporter.settled;

      final String written = backend.recorded.single.value.values.join('|');
      expect(written, isNot(contains('message')));
      expect(written, isNot(contains('library')));
      expect(written, isNot(contains('context')));
    });
  });
}
