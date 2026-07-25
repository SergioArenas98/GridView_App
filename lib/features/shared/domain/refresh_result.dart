import '../../../core/api/errors/api_failure.dart';

/// The typed outcome of a repository refresh. This is the single result pattern
/// for the data/application boundary (ADR 0006): repositories translate
/// remote/local outcomes into a sealed [RefreshResult]; the UI reads local
/// streams for content and this result only for the transient refresh outcome.
sealed class RefreshResult {
  const RefreshResult();
}

/// The refresh completed without error.
///
/// [applied] is `true` only when the fetched snapshot changed local domain rows.
/// It is `false` for a `304 Not Modified`, an idempotent up-to-date snapshot, or
/// an older snapshot that was intentionally rejected — in every such case the
/// cache was preserved.
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
