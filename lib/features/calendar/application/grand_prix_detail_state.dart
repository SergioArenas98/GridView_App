import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';

/// A stable (season, round) key for the Grand Prix detail provider family.
typedef GrandPrixKey = ({int season, int round});

/// The Grand Prix detail screen's typed presentation state.
sealed class GrandPrixDetailState {
  const GrandPrixDetailState();
}

/// First load with no cached detail yet.
class GrandPrixLoading extends GrandPrixDetailState {
  const GrandPrixLoading();
}

/// A successful refresh determined the Grand Prix does not exist, and there is
/// no cached detail — a controlled, recoverable not-found state.
class GrandPrixNotFound extends GrandPrixDetailState {
  const GrandPrixNotFound();
}

/// First load failed (network/server) with no cached detail to fall back to.
class GrandPrixFirstLoadError extends GrandPrixDetailState {
  const GrandPrixFirstLoadError(this.failure);
  final ApiFailure failure;
}

/// Cached detail is available.
class GrandPrixReady extends GrandPrixDetailState {
  const GrandPrixReady({
    required this.view,
    required this.freshness,
    this.refreshing = false,
    this.refreshError,
  });

  final GrandPrixDetailView view;
  final FreshnessState freshness;
  final bool refreshing;
  final ApiFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives the Grand Prix detail state. Pure and side-effect free.
///
/// Freshness is read from the detail resource's own `resource_sync_metadata`
/// record ([metadata]), exactly like the result section and the Calendar, so a
/// later publication of identical content can move it without rewriting the
/// cached detail rows (ADR 0005, 2026-10-14 amendment). A detail cached only
/// indirectly (e.g. from the Home snapshot) has no record yet; it is treated as
/// stale so the UI shows content immediately while a detail refresh completes.
GrandPrixDetailState computeGrandPrixState({
  required GrandPrixDetailView? cache,
  required ResourceSyncState? metadata,
  required bool streamReady,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required DateTime now,
}) {
  if (cache == null) {
    if (!streamReady || refreshing || lastFailure == null) {
      return const GrandPrixLoading();
    }
    if (lastFailure.kind == ApiFailureKind.notFound) {
      return const GrandPrixNotFound();
    }
    return GrandPrixFirstLoadError(lastFailure);
  }
  return GrandPrixReady(
    view: cache,
    freshness: evaluateResourceFreshness(metadata, now),
    refreshing: refreshing,
    refreshError: refreshing ? null : lastFailure,
  );
}
