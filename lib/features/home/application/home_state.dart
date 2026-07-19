import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/entities/home_view.dart';
import '../../shared/domain/freshness_evaluator.dart';

/// The Home screen's typed presentation state.
///
/// The variants are mutually exclusive and cover every case the vertical slice
/// must represent, so the UI never relies on a single ambiguous boolean.
sealed class HomeState {
  const HomeState();
}

/// First load with no cached content yet.
class HomeLoading extends HomeState {
  const HomeLoading();
}

/// First load failed and there is no cached content to fall back to.
class HomeFirstLoadError extends HomeState {
  const HomeFirstLoadError(this.failure);
  final ApiFailure failure;
}

/// Cached content is available. [freshness] distinguishes fresh from stale,
/// [refreshing] indicates a background refresh with content still visible, and
/// [refreshError] is a recoverable refresh failure that kept the cached content.
class HomeReady extends HomeState {
  const HomeReady({
    required this.view,
    required this.freshness,
    this.refreshing = false,
    this.refreshError,
  });

  final HomeView view;
  final FreshnessState freshness;
  final bool refreshing;
  final ApiFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives the Home state from the cache stream and the refresh controller.
///
/// Pure and side-effect free so every state is unit-testable without Riverpod
/// or a widget tree.
HomeState computeHomeState({
  required HomeView? cache,
  required bool streamReady,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required DateTime now,
}) {
  if (cache == null) {
    if (streamReady && !refreshing && lastFailure != null) {
      return HomeFirstLoadError(lastFailure);
    }
    return const HomeLoading();
  }
  return HomeReady(
    view: cache,
    freshness: evaluateFreshness(cache.freshness, now),
    refreshing: refreshing,
    refreshError: refreshing ? null : lastFailure,
  );
}
