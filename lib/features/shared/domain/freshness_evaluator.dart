import 'entities/freshness.dart';
import 'entities/sync_state.dart';

/// Whether cached content is currently fresh or stale.
enum FreshnessState { fresh, stale }

/// Evaluates freshness against [now].
///
/// Server-provided `staleAfter` is authoritative; the server `stale` flag is a
/// fallback when no `staleAfter` is supplied. With neither, content is treated
/// as fresh. (Client-side time-based invalidation without server context is
/// deliberately avoided — TRD §16.4.)
FreshnessState evaluateFreshness(DataFreshness freshness, DateTime now) {
  final DateTime? staleAfter = freshness.staleAfter;
  if (staleAfter != null) {
    return now.isAfter(staleAfter)
        ? FreshnessState.stale
        : FreshnessState.fresh;
  }
  if (freshness.stale == true) return FreshnessState.stale;
  return FreshnessState.fresh;
}

/// Evaluates the freshness recorded for a resource in `resource_sync_metadata`.
///
/// Resources whose content carries no snapshot of its own (the season calendar,
/// a result document) still have persisted provenance, so freshness is read from
/// that record rather than re-derived. It applies exactly the same rule as
/// [evaluateFreshness] — there is one freshness policy, not two.
///
/// A resource that has never synchronised successfully has nothing to vouch for
/// its content and is reported stale.
FreshnessState evaluateResourceFreshness(
  ResourceSyncState? state,
  DateTime now,
) {
  if (state == null || state.lastSuccessAt == null) return FreshnessState.stale;
  return evaluateFreshness(
    DataFreshness(
      generatedAt: state.generatedAt ?? state.lastSuccessAt!,
      sourceUpdatedAt: state.sourceUpdatedAt,
      staleAfter: state.staleAfter,
      contentVersion: state.contentVersion,
      stale: state.serverStale,
    ),
    now,
  );
}
