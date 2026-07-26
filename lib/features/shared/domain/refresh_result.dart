import '../../../core/api/errors/api_failure.dart';

/// How a successful refresh related to the already-cached representation.
///
/// Every value except [applied] left the cached domain rows untouched; they
/// differ only in *why* nothing was written, which the application-level
/// synchronization report surfaces per resource.
enum RefreshApplication {
  /// A newer snapshot was accepted and written to the local database.
  applied,

  /// `304 Not Modified` — the stored representation is still valid; only the
  /// synchronization metadata was refreshed.
  notModified,

  /// A `200` carrying the same revision as the cached one: an idempotent no-op,
  /// deliberately not rewritten so no stream re-emits.
  idempotent,

  /// A `200` carrying an older source revision, rejected to protect the newer
  /// cached data.
  rejectedOlder,
}

/// The typed outcome of a repository refresh. This is the single result pattern
/// for the data/application boundary (ADR 0006): repositories translate
/// remote/local outcomes into a sealed [RefreshResult]; the UI reads local
/// streams for content and this result only for the transient refresh outcome.
sealed class RefreshResult {
  const RefreshResult();
}

/// The refresh completed without error.
///
/// [applied] is `true` only when the fetched snapshot changed local domain rows;
/// [application] says precisely which non-writing case occurred otherwise. In
/// every non-applied case the cache was preserved.
class RefreshSuccess extends RefreshResult {
  const RefreshSuccess({this.application = RefreshApplication.applied});

  final RefreshApplication application;

  /// Whether local domain rows changed.
  bool get applied => application == RefreshApplication.applied;
}

/// The refresh failed. Cached data (if any) is preserved; [failure] carries the
/// typed, provider-agnostic reason.
class RefreshFailure extends RefreshResult {
  const RefreshFailure(this.failure);

  final ApiFailure failure;
}
