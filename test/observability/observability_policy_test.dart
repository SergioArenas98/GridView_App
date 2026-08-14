import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/observability/observability_policy.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/core/observability/throttled_error_reporter.dart';

import '../support/fake_observability.dart';

void main() {
  group('the non-fatal allowlist', () {
    test('reports only unexpected, actionable failures', () {
      expect(
        ObservabilityPolicy.classifyApiFailure(ApiFailureKind.invalidResponse),
        ObservedFailureKind.invalidRemoteContract,
      );
      expect(
        ObservabilityPolicy.classifyApiFailure(
          ApiFailureKind.unsupportedApiVersion,
        ),
        ObservedFailureKind.unsupportedApiVersion,
      );
      expect(
        ObservabilityPolicy.classifyApiFailure(ApiFailureKind.configuration),
        ObservedFailureKind.impossibleConfiguration,
      );
    });

    test('never reports ordinary operational states', () {
      // Each of these is already represented in the UI and says nothing about
      // a defect. Reporting them would bury the three categories above.
      const List<ApiFailureKind> operational = <ApiFailureKind>[
        ApiFailureKind.networkUnavailable,
        ApiFailureKind.networkTimeout,
        ApiFailureKind.cancelled,
        ApiFailureKind.rateLimited,
        ApiFailureKind.serverUnavailable,
        ApiFailureKind.maintenance,
        ApiFailureKind.notFound,
        ApiFailureKind.invalidRequest,
        ApiFailureKind.unknown,
      ];

      for (final ApiFailureKind kind in operational) {
        expect(
          ObservabilityPolicy.classifyApiFailure(kind),
          isNull,
          reason: '${kind.name} is an operational state, not a defect',
        );
      }
    });

    test('every ApiFailureKind is classified deliberately', () {
      // A new failure category must not silently inherit "report" or "ignore":
      // the switch is exhaustive, so this fails to compile-or-run if one is
      // added without a decision.
      for (final ApiFailureKind kind in ApiFailureKind.values) {
        expect(
          () => ObservabilityPolicy.classifyApiFailure(kind),
          returnsNormally,
        );
      }
    });
  });

  group('context is bounded and redacted', () {
    test('a resource key never reaches the report', () {
      // Canonical keys embed stable identifiers. These are the exact shapes
      // ResourceKey builds.
      const Map<String, ObservedFeature> keys = <String, ObservedFeature>{
        'driver:max-verstappen:2026': ObservedFeature.drivers,
        'constructor:red-bull-racing:2026': ObservedFeature.constructors,
        'circuit:spa-francorchamps:2026': ObservedFeature.circuits,
        'grand-prix:2026:13': ObservedFeature.grandPrix,
        'grand-prix-results:2026:13': ObservedFeature.results,
        'standings:drivers:2026': ObservedFeature.standings,
        'calendar:2026': ObservedFeature.calendar,
        'home:2026': ObservedFeature.home,
        'season:current': ObservedFeature.season,
        'bootstrap': ObservedFeature.bootstrap,
        'content:manifest': ObservedFeature.content,
      };

      keys.forEach((String key, ObservedFeature expected) {
        final ObservedFailure failure = ObservedFailure(
          kind: ObservedFailureKind.invalidRemoteContract,
          feature: ObservedFeature.fromResourceKey(key),
          operation: ObservedOperation.resourceRefresh,
          environment: AppEnvironment.production,
        );

        expect(failure.feature, expected, reason: key);

        final String serialized = failure.toAttributes().values.join('|');
        expect(
          serialized.contains('max-verstappen'),
          isFalse,
          reason: 'an entity id must never be attached',
        );
        expect(
          serialized.contains('2026'),
          isFalse,
          reason: 'a season must never be attached',
        );
        expect(serialized.contains(':'), isFalse);
      });
    });

    test('an unknown or hostile key collapses to a fixed value', () {
      for (final String key in <String>[
        '',
        'https://api.example.com/v1/home?token=secret',
        'snapshot:2026:v7:home',
        'x' * 5000,
      ]) {
        expect(ObservedFeature.fromResourceKey(key), ObservedFeature.other);
      }
    });

    test('attributes are a fixed set of enum-derived values', () {
      const ObservedFailure failure = ObservedFailure(
        kind: ObservedFailureKind.localDatabaseFailure,
        feature: ObservedFeature.home,
        operation: ObservedOperation.snapshotApply,
        environment: AppEnvironment.production,
      );

      final Map<String, String> attributes = failure.toAttributes();
      expect(attributes.keys.toSet(), <String>{
        'failure',
        'feature',
        'operation',
        'environment',
      });
      expect(attributes['failure'], 'localDatabaseFailure');
      expect(attributes['feature'], 'home');
      expect(attributes['operation'], 'snapshotApply');
      expect(attributes['environment'], 'production');
      expect(failure.reason, 'gridview.localDatabaseFailure');
    });

    test('the attribute space is bounded by the enum product', () {
      final int combinations =
          ObservedFailureKind.values.length *
          ObservedFeature.values.length *
          ObservedOperation.values.length;
      // Small enough to be a dimension in a console rather than a cardinality
      // problem, and it cannot grow at runtime because every field is an enum.
      expect(combinations, lessThan(500));
    });
  });

  group('flood suppression', () {
    test('the first occurrence is reported and repeats are dropped', () {
      final NonFatalThrottle throttle = NonFatalThrottle(
        window: const Duration(minutes: 5),
      );
      final DateTime start = DateTime.utc(2026, 8, 13, 12);
      const ObservedFailure failure = ObservedFailure(
        kind: ObservedFailureKind.invalidRemoteContract,
        feature: ObservedFeature.calendar,
        operation: ObservedOperation.resourceRefresh,
        environment: AppEnvironment.production,
      );

      expect(throttle.allow(failure, start), isTrue);
      expect(throttle.allow(failure, start), isFalse);
      expect(
        throttle.allow(failure, start.add(const Duration(minutes: 4))),
        isFalse,
      );
      expect(
        throttle.allow(failure, start.add(const Duration(minutes: 5))),
        isTrue,
      );
    });

    test('different signatures do not suppress one another', () {
      final NonFatalThrottle throttle = NonFatalThrottle();
      final DateTime now = DateTime.utc(2026, 8, 13, 12);

      const ObservedFailure calendar = ObservedFailure(
        kind: ObservedFailureKind.invalidRemoteContract,
        feature: ObservedFeature.calendar,
        operation: ObservedOperation.resourceRefresh,
        environment: AppEnvironment.production,
      );
      const ObservedFailure home = ObservedFailure(
        kind: ObservedFailureKind.invalidRemoteContract,
        feature: ObservedFeature.home,
        operation: ObservedOperation.resourceRefresh,
        environment: AppEnvironment.production,
      );

      expect(throttle.allow(calendar, now), isTrue);
      expect(throttle.allow(home, now), isTrue);
    });

    test('a retry loop produces one report, not one per attempt', () {
      final RecordingErrorReporter inner = RecordingErrorReporter();
      DateTime clock = DateTime.utc(2026, 8, 13, 12);
      final ThrottledErrorReporter reporter = ThrottledErrorReporter(
        inner,
        now: () => clock,
      );

      const ObservedFailure failure = ObservedFailure(
        kind: ObservedFailureKind.localDatabaseFailure,
        feature: ObservedFeature.standings,
        operation: ObservedOperation.snapshotApply,
        environment: AppEnvironment.production,
      );

      for (int i = 0; i < 200; i++) {
        clock = clock.add(const Duration(seconds: 1));
        reporter.recordNonFatal(failure);
      }

      expect(inner.nonFatals, hasLength(1));
    });

    test('fatal errors are never throttled', () {
      final RecordingErrorReporter inner = RecordingErrorReporter();
      final ThrottledErrorReporter reporter = ThrottledErrorReporter(
        inner,
        now: () => DateTime.utc(2026, 8, 13, 12),
      );

      for (int i = 0; i < 3; i++) {
        reporter.recordFatal(
          FlutterErrorDetails(exception: StateError('$i'), library: 'test'),
        );
      }

      // A crash is singular; losing one would be worse than a duplicate.
      expect(inner.fatals, hasLength(3));
    });
  });
}
