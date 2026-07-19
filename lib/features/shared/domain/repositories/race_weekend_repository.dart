import '../../../../core/api/errors/api_failure.dart';
import '../entities/grand_prix_view.dart';
import '../entities/home_view.dart';

/// Domain-facing repository for the Home / Grand Prix vertical slice.
///
/// The UI always reads from the local Drift-backed streams; a refresh fetches
/// remote data and writes it atomically to the database, after which the stream
/// re-emits. A failed refresh never erases valid cached data.
abstract interface class RaceWeekendRepository {
  /// The Home aggregate (featured Grand Prix + freshness), from the database.
  Stream<HomeView?> watchHome();

  /// The Grand Prix detail aggregate for (season, round), from the database.
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  });

  /// Fetches the Home snapshot and writes it in one atomic transaction.
  Future<RefreshResult> refreshHome();

  /// Fetches a Grand Prix detail snapshot and writes it in one atomic
  /// transaction.
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
  });
}

/// The typed outcome of a refresh. This is the single result pattern for the
/// data/application boundary (recorded in ADR 0006): repositories translate
/// remote/local errors into a sealed [RefreshResult]; the UI reads local
/// streams for content and this result for the transient refresh outcome.
sealed class RefreshResult {
  const RefreshResult();
}

/// The refresh completed. [applied] is `false` when the fetched snapshot was
/// older than the cached one and was intentionally not written (the cache is
/// newer and was preserved).
class RefreshSuccess extends RefreshResult {
  const RefreshSuccess({this.applied = true});

  final bool applied;
}

/// The refresh failed. Cached data (if any) is preserved; [failure] carries the
/// typed, provider-agnostic reason.
class RefreshFailure extends RefreshResult {
  const RefreshFailure(this.failure);

  final ApiFailure failure;
}
