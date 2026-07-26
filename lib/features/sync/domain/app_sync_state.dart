import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/refresh_result.dart';
import 'sync_plan.dart';
import 'sync_resource.dart';

/// What happened to one resource during a run.
///
/// Deliberately narrow: a canonical key, a category and — for a failure — the
/// typed [ApiFailureKind] only. No exception, Dio response, DTO, Drift row,
/// server body or configuration value is ever reachable from here.
enum ResourceSyncOutcomeKind {
  /// A newer snapshot was accepted and written.
  applied,

  /// The refresh succeeded but wrote nothing: a `304`, an idempotent snapshot or
  /// an older snapshot rejected in favour of the cache. The cache is intact.
  unchanged,

  /// Planned but never attempted (the run was cancelled before it started, or
  /// this build cannot dispatch the key).
  skipped,

  /// The refresh failed; the resource keeps its valid cache and its ETag.
  failed,

  /// The refresh was cancelled in flight.
  cancelled,
}

/// The per-resource line of a run report.
class ResourceSyncOutcome {
  const ResourceSyncOutcome({
    required this.resourceKey,
    required this.kind,
    this.failure,
  });

  /// Maps a repository [RefreshResult] into a safe outcome.
  factory ResourceSyncOutcome.fromRefresh(String key, RefreshResult result) {
    return switch (result) {
      RefreshSuccess(:final RefreshApplication application) =>
        ResourceSyncOutcome(
          resourceKey: key,
          kind: application == RefreshApplication.applied
              ? ResourceSyncOutcomeKind.applied
              : ResourceSyncOutcomeKind.unchanged,
        ),
      RefreshFailure(:final ApiFailure failure) => ResourceSyncOutcome(
        resourceKey: key,
        kind: failure.kind == ApiFailureKind.cancelled
            ? ResourceSyncOutcomeKind.cancelled
            : ResourceSyncOutcomeKind.failed,
        failure: failure.kind,
      ),
    };
  }

  const ResourceSyncOutcome.skipped(this.resourceKey)
    : kind = ResourceSyncOutcomeKind.skipped,
      failure = null;

  final String resourceKey;
  final ResourceSyncOutcomeKind kind;

  /// The typed failure category, or null when the resource did not fail.
  final ApiFailureKind? failure;

  bool get isSuccess =>
      kind == ResourceSyncOutcomeKind.applied ||
      kind == ResourceSyncOutcomeKind.unchanged;

  bool get isFailure => kind == ResourceSyncOutcomeKind.failed;
}

/// The application-level synchronization state.
///
/// It lives in memory only: `resource_sync_metadata` remains the durable record
/// for each remote representation, and no run state is persisted to a table.
sealed class AppSyncState {
  const AppSyncState();

  /// The outcomes recorded so far (empty while idle).
  List<ResourceSyncOutcome> get outcomes => const <ResourceSyncOutcome>[];
}

/// No run has started, or the last one has been superseded.
class AppSyncIdle extends AppSyncState {
  const AppSyncIdle();
}

/// A run is in progress.
class AppSyncRunning extends AppSyncState {
  const AppSyncRunning({required this.trigger, this.stage});

  final SyncTrigger trigger;

  /// The stage currently executing, or null before the first stage starts.
  final SyncStage? stage;
}

/// A run finished. [fullSuccess] separates a clean run from one with partial
/// failures; independent resources always continued past a failure.
class AppSyncCompleted extends AppSyncState {
  const AppSyncCompleted({required this.trigger, required this.outcomes});

  final SyncTrigger trigger;

  @override
  final List<ResourceSyncOutcome> outcomes;

  int get successCount =>
      outcomes.where((ResourceSyncOutcome o) => o.isSuccess).length;

  int get failureCount =>
      outcomes.where((ResourceSyncOutcome o) => o.isFailure).length;

  bool get fullSuccess => failureCount == 0;
}

/// The run was cancelled (the app left the foreground, or the scope was
/// disposed). Never reported as a success.
class AppSyncCancelled extends AppSyncState {
  const AppSyncCancelled({required this.trigger, required this.outcomes});

  final SyncTrigger trigger;

  @override
  final List<ResourceSyncOutcome> outcomes;
}

/// No season context could be resolved — locally or remotely — so season-scoped
/// work was skipped. Any season-agnostic work that did run is reported in
/// [outcomes].
class AppSyncSeasonContextUnavailable extends AppSyncState {
  const AppSyncSeasonContextUnavailable({
    required this.trigger,
    required this.outcomes,
  });

  final SyncTrigger trigger;

  @override
  final List<ResourceSyncOutcome> outcomes;
}
