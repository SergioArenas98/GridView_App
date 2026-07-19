import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
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
/// A detail cached only indirectly (e.g. from the Home snapshot) has no detail
/// freshness yet; it is treated as stale so the UI shows content immediately
/// while a detail refresh completes.
GrandPrixDetailState computeGrandPrixState({
  required GrandPrixDetailView? cache,
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
  final FreshnessState freshness = cache.freshness == null
      ? FreshnessState.stale
      : evaluateFreshness(cache.freshness!, now);
  return GrandPrixReady(
    view: cache,
    freshness: freshness,
    refreshing: refreshing,
    refreshError: refreshing ? null : lastFailure,
  );
}
