import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart'
    show InvalidSeasonEntriesException;
import 'package:gridview/core/database/daos/media_dao.dart'
    show InvalidMediaOwnershipException;
import 'package:gridview/core/database/entity_validation.dart'
    show InvalidEntityException;
import 'package:gridview/core/observability/error_reporter.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/data/sync/sync_observation.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/fake_observability.dart';

/// The two synchronization observation hooks.
///
/// Both are wired once in the composition root, so these tests are the proof
/// that the policy is applied for *every* repository rather than the ones
/// someone remembered to instrument.
void main() {
  late RecordingErrorReporter reporter;

  setUp(() => reporter = RecordingErrorReporter());

  group('refresh outcomes', () {
    RefreshOutcomeObserver observer() => observeRefreshOutcomes(
      reporter: reporter,
      environment: AppEnvironment.production,
    );

    test('a successful refresh reports nothing', () {
      for (final RefreshApplication application in RefreshApplication.values) {
        observer()('calendar:2026', RefreshSuccess(application: application));
      }
      expect(reporter.nonFatals, isEmpty);
    });

    test('an offline or cancelled refresh reports nothing', () {
      const List<ApiFailureKind> expected = <ApiFailureKind>[
        ApiFailureKind.networkUnavailable,
        ApiFailureKind.networkTimeout,
        ApiFailureKind.cancelled,
        ApiFailureKind.serverUnavailable,
        ApiFailureKind.rateLimited,
        ApiFailureKind.maintenance,
        ApiFailureKind.notFound,
      ];

      for (final ApiFailureKind kind in expected) {
        observer()('home:2026', RefreshFailure(ApiFailure(kind: kind)));
      }

      expect(reporter.nonFatals, isEmpty);
    });

    test('an invalid contract is reported with a bounded feature', () {
      observer()(
        'driver:max-verstappen:2026',
        const RefreshFailure(ApiFailure(kind: ApiFailureKind.invalidResponse)),
      );

      expect(reporter.nonFatals, hasLength(1));
      final ObservedFailure failure = reporter.nonFatals.single;
      expect(failure.kind, ObservedFailureKind.invalidRemoteContract);
      expect(failure.feature, ObservedFeature.drivers);
      expect(failure.operation, ObservedOperation.resourceRefresh);
      expect(
        failure.toAttributes().values.join(),
        isNot(contains('verstappen')),
      );
    });

    test('an unsupported API version is reported', () {
      observer()(
        'bootstrap',
        const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.unsupportedApiVersion),
        ),
      );

      expect(
        reporter.nonFatals.single.kind,
        ObservedFailureKind.unsupportedApiVersion,
      );
    });

    test('an impossible production configuration is reported', () {
      observer()(
        'home:2026',
        const RefreshFailure(ApiFailure(kind: ApiFailureKind.configuration)),
      );

      expect(
        reporter.nonFatals.single.kind,
        ObservedFailureKind.impossibleConfiguration,
      );
    });
  });

  group('snapshot apply errors', () {
    SnapshotApplyObserver observer() => observeSnapshotApplyErrors(
      reporter: reporter,
      environment: AppEnvironment.production,
    );

    test('every typed validation exception is left to the refresh boundary', () {
      // These are raised while rejecting a *remote payload*. Reporting them
      // here as well produced two non-fatals for one fault, under two different
      // signatures the throttle could not collapse, one of which blamed local
      // persistence for a service defect.
      observer()(
        'standings:drivers:2026',
        const InvalidEntityException('negative points'),
      );
      observer()(
        'drivers:2026',
        const InvalidSeasonEntriesException('bad entries'),
      );
      observer()(
        'grand-prix:2026:13',
        const InvalidMediaOwnershipException('two owners'),
      );

      expect(reporter.nonFatals, isEmpty);
    });

    test('any other error is a local database failure', () {
      observer()('calendar:2026', StateError('disk is on fire'));

      final ObservedFailure failure = reporter.nonFatals.single;
      expect(failure.kind, ObservedFailureKind.localDatabaseFailure);
      expect(failure.operation, ObservedOperation.snapshotApply);
      // The message never travels: only the enum does.
      expect(failure.toAttributes().values.join(), isNot(contains('disk')));
    });
  });

  group('observation cannot change behaviour', () {
    test('a throwing observer does not break the coordinator', () async {
      final RefreshCoordinator coordinator = RefreshCoordinator(
        onOutcome: (String key, RefreshResult result) =>
            throw StateError('observer exploded'),
      );

      final RefreshResult result = await coordinator.run(
        'calendar:2026',
        () async => const RefreshSuccess(),
      );

      expect(result, isA<RefreshSuccess>());
      expect(coordinator.isInFlight('calendar:2026'), isFalse);
    });

    test('a throwing reporter does not break the observer', () {
      final RefreshOutcomeObserver observe = observeRefreshOutcomes(
        reporter: GuardedErrorReporter(const ThrowingErrorReporter()),
        environment: AppEnvironment.production,
      );

      expect(
        () => observe(
          'home:2026',
          const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.invalidResponse),
          ),
        ),
        returnsNormally,
      );
    });

    test('a failed refresh still releases its in-flight slot', () async {
      final RefreshCoordinator coordinator = RefreshCoordinator(
        onOutcome: (String key, RefreshResult result) {},
      );

      await expectLater(
        coordinator.run('home:2026', () async => throw StateError('boom')),
        throwsStateError,
      );

      expect(coordinator.isInFlight('home:2026'), isFalse);
    });

    test('collapsed duplicate refreshes are observed once', () async {
      final List<String> observed = <String>[];
      final RefreshCoordinator coordinator = RefreshCoordinator(
        onOutcome: (String key, RefreshResult result) => observed.add(key),
      );

      Future<RefreshResult> slow() async {
        await Future<void>.delayed(const Duration(milliseconds: 1));
        return const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.invalidResponse),
        );
      }

      await Future.wait<RefreshResult>(<Future<RefreshResult>>[
        coordinator.run('home:2026', slow),
        coordinator.run('home:2026', slow),
        coordinator.run('home:2026', slow),
      ]);

      expect(observed, <String>['home:2026']);
    });
  });
}
