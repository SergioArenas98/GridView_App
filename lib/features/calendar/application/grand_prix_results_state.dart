import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/entities/race_result.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';

/// The Grand Prix result section's typed presentation state.
///
/// It is deliberately **separate** from the detail state: a result failure never
/// replaces valid Grand Prix detail, and a detail failure never erases cached
/// results.
sealed class GrandPrixResultsState {
  const GrandPrixResultsState();
}

/// No classification is stored and none is expected yet (an upcoming event, or a
/// resource that successfully reported nothing). Not an error.
class GrandPrixResultsUnavailable extends GrandPrixResultsState {
  const GrandPrixResultsUnavailable();
}

/// No classification is stored yet and one is being fetched.
class GrandPrixResultsLoading extends GrandPrixResultsState {
  const GrandPrixResultsLoading();
}

/// No classification is stored and the fetch failed — recoverable, scoped to
/// this section.
class GrandPrixResultsError extends GrandPrixResultsState {
  const GrandPrixResultsError(this.failure);

  final ApiFailure failure;
}

/// Stored classifications are available. Sprint and race documents coexist and
/// are never merged; entry order is exactly as delivered.
class GrandPrixResultsReady extends GrandPrixResultsState {
  const GrandPrixResultsReady({
    required this.documents,
    required this.freshness,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  /// The stored documents that actually carry a classification, in their
  /// persisted order.
  final List<RaceResult> documents;

  final FreshnessState freshness;
  final DateTime? lastSuccessAt;
  final bool refreshing;

  /// A refresh failure that kept the cached classifications visible.
  final ApiFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives the result-section state.
///
/// Cached classifications always win: once a document with entries is stored it
/// is rendered regardless of what a later compact or detail `hasResults` flag
/// says. [expected] only decides what to show when there is nothing stored.
GrandPrixResultsState computeGrandPrixResultsState({
  required List<RaceResult>? results,
  required bool streamReady,
  required bool expected,
  required ResourceSyncState? metadata,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required DateTime now,
}) {
  final List<RaceResult> stored = <RaceResult>[
    for (final RaceResult r in results ?? const <RaceResult>[])
      if (r.entries.isNotEmpty) r,
  ];

  if (stored.isNotEmpty) {
    return GrandPrixResultsReady(
      documents: stored,
      freshness: evaluateResourceFreshness(metadata, now),
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshing ? null : lastFailure,
    );
  }

  if (refreshing) return const GrandPrixResultsLoading();
  if (lastFailure != null) return GrandPrixResultsError(lastFailure);

  // A recorded success with nothing stored is a definitive "not classified yet",
  // even when the event summary still advertises results.
  if (metadata?.lastSuccessAt != null) {
    return const GrandPrixResultsUnavailable();
  }
  if (!streamReady) return const GrandPrixResultsLoading();
  return expected
      ? const GrandPrixResultsLoading()
      : const GrandPrixResultsUnavailable();
}
