import '../../shared/domain/entities/sync_state.dart';

/// The in-memory twin of `SyncMetadataDao.readDueResources`' SQL predicate.
///
/// A resource is due at [now] when any of these holds:
///
/// 1. it has never synchronised successfully (`lastSuccessAt` is null);
/// 2. the server flagged it stale (`serverStale` is true), even if `staleAfter`
///    is in the future or null;
/// 3. its server-provided expiry has passed (`staleAfter` is non-null and
///    `<= now`).
///
/// A successfully-synced resource with a null `staleAfter` and `serverStale` not
/// true is **not** due: freshness is entirely server-provided and the client
/// invents no fallback TTL.
///
/// A **missing metadata row** ([state] is null) means the resource has never
/// been synchronised, so it is due. The SQL query can only return rows that
/// exist, which is exactly why the planner merges the expected core keys with
/// the query's result rather than trusting the query alone.
///
/// [now] is always supplied by the caller — nothing here reads the wall clock —
/// and the `<=` boundary is deliberate: a `staleAfter` exactly equal to [now] is
/// due.
bool isResourceDue(ResourceSyncState? state, DateTime now) {
  if (state == null) return true;
  if (state.lastSuccessAt == null) return true;
  if (state.serverStale ?? false) return true;
  final DateTime? staleAfter = state.staleAfter;
  return staleAfter != null && !staleAfter.isAfter(now);
}
