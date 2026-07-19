import 'entities/freshness.dart';

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
