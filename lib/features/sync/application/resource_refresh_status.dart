import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/refresh_status.dart';
import '../domain/app_sync_state.dart';
import '../domain/sync_resource.dart';
import '../domain/sync_resource_parser.dart';

/// Projects the application-level synchronization state onto **one** feature
/// resource's transient refresh status.
///
/// Feature controllers no longer launch their own startup/foreground refreshes;
/// they mirror the coordinator's report for the exact resource they render. A
/// run is matched by parsing each canonical key through the shared parser rather
/// than by comparing strings, so a caller never has to assemble a key itself.
///
/// Returns `null` when the state says nothing about this resource — an idle
/// coordinator — so the caller can keep whatever status it already had. A
/// finished run that never planned the resource reports plain idle: an unrelated
/// resource's failure is never this feature's error.
RefreshStatus? resourceRefreshStatus(
  AppSyncState state,
  bool Function(SyncResource resource) matches,
) {
  if (state is AppSyncRunning) return RefreshStatus.running;
  if (state is AppSyncIdle) return null;

  for (final ResourceSyncOutcome outcome in state.outcomes) {
    if (!matches(SyncResourceParser.parse(outcome.resourceKey))) continue;
    final ApiFailureKind? failure = outcome.failure;
    if (outcome.isFailure && failure != null) {
      return RefreshStatus.idle.failed(ApiFailure(kind: failure));
    }
    return RefreshStatus.idle;
  }
  return RefreshStatus.idle;
}
