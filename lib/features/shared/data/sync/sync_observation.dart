/// Turns synchronization outcomes into the narrow set of reportable failures.
///
/// This is the only place that decides *what to report* about synchronization,
/// and it sits outside both `RefreshCoordinator` and `ResourceSync` so neither
/// of them gains an observability dependency. There are exactly two hooks, both
/// wired once in the composition root:
///
/// * [observeRefreshOutcomes] — every completed resource refresh, so remote
///   contract, API-version and configuration faults are seen once per run
///   regardless of which of the twelve repositories issued it;
/// * [observeSnapshotApplyErrors] — every error escaping a snapshot
///   transaction, the single point where "the fetch worked and the write did
///   not" is observable.
///
/// Neither hook can influence the operation it observes.
library;

import '../../../../app/environment/app_environment.dart';
import '../../../../core/database/daos/competitor_dao.dart'
    show InvalidSeasonEntriesException;
import '../../../../core/database/daos/media_dao.dart'
    show InvalidMediaOwnershipException;
import '../../../../core/database/entity_validation.dart'
    show InvalidEntityException;
import '../../../../core/observability/error_reporter.dart';
import '../../../../core/observability/observability_policy.dart';
import '../../../../core/observability/observed_failure.dart';
import '../../domain/refresh_result.dart';
import 'refresh_coordinator.dart';
import 'resource_sync.dart';

/// Builds the refresh-outcome observer for a build.
///
/// Successes, cancellations and every ordinary operational failure are dropped
/// by [ObservabilityPolicy]; only what survives it is reported.
RefreshOutcomeObserver observeRefreshOutcomes({
  required ErrorReporter reporter,
  required AppEnvironment environment,
}) {
  return (String key, RefreshResult result) {
    if (result is! RefreshFailure) return;
    final ObservedFailureKind? kind = ObservabilityPolicy.classifyApiFailure(
      result.failure.kind,
    );
    if (kind == null) return;
    reporter.recordNonFatal(
      ObservedFailure(
        kind: kind,
        // The canonical key is never attached; only its bounded family.
        feature: ObservedFeature.fromResourceKey(key),
        operation: ObservedOperation.resourceRefresh,
        environment: environment,
      ),
    );
  };
}

/// Builds the snapshot-apply observer for a build.
///
/// ## One owner per failure
///
/// The three typed validation exceptions are **not** reported here, and that is
/// the whole point of this function's shape. They are raised by the DAOs while
/// rejecting a *remote payload*, and `SyncedRepository` converts each one into
/// `RefreshFailure(invalidResponse)`, which [observeRefreshOutcomes] then
/// reports as `invalidRemoteContract`. Reporting them here as well produced two
/// non-fatals for one fault, with two different signatures — so the throttle
/// could not collapse them either, and the same defect appeared twice under two
/// names, one of which was wrong.
///
/// What is left is the genuine local fault: an error that escaped the
/// transaction without being one of the typed rejections, meaning the database
/// failed a write that should have succeeded. That one propagates as a thrown
/// error rather than a `RefreshFailure`, so the coordinator's error branch runs
/// and it is never observed at the refresh boundary — exactly once, here.
SnapshotApplyObserver observeSnapshotApplyErrors({
  required ErrorReporter reporter,
  required AppEnvironment environment,
}) {
  return (String key, Object error) {
    if (error is InvalidEntityException ||
        error is InvalidSeasonEntriesException ||
        error is InvalidMediaOwnershipException) {
      // Owned by the refresh boundary. See the doc above.
      return;
    }
    reporter.recordNonFatal(
      ObservedFailure(
        kind: ObservedFailureKind.localDatabaseFailure,
        feature: ObservedFeature.fromResourceKey(key),
        operation: ObservedOperation.snapshotApply,
        environment: environment,
      ),
    );
  };
}
