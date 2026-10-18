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

/// Whether [state] belongs to an earlier publication than the stored content
/// [manifest], so the cached copy did not converge on the release the server
/// says is current (ADR 0025 D4, amendment of 2026-10-14).
///
/// The server stamps one `generatedAt` on every document of a release and a
/// strictly later one on each later release of a season, and it serves the
/// manifest from the current season's active release. A current-season record
/// whose `generatedAt` is strictly earlier than the manifest's was therefore
/// served from an older release - typically a CDN or edge cache answering
/// with an old `200` or `304` after a new batch - and is due again even though
/// its own `staleAfter` has not passed.
///
/// It is never due through this rule when:
///
/// - either side has no recorded success or no `generatedAt` (a resource with
///   no record is already due under [isResourceDue]);
/// - [state] is the manifest itself;
/// - [state] is scoped to a season other than [currentSeason]: publication
///   instants are ordered per season;
/// - [manifest] was not accepted under [currentSeason] (its recorded season
///   differs, or none is recorded). The manifest's payload names no season, so
///   its record carries the season that was current when it was accepted.
///   After a season transition the stored manifest can still hold the
///   outgoing season's instant, which orders nothing in the new season.
///
/// It compares only stored values and reads no clock. A server that broke the
/// contract could only make a resource due once per run (the planner applies
/// this rule to a key at most once per run), never loop.
bool isBehindManifestRelease(
  ResourceSyncState? state,
  ResourceSyncState? manifest, {
  required int? currentSeason,
}) {
  if (state == null || manifest == null) return false;
  if (state.resourceKey == manifest.resourceKey) return false;
  if (state.lastSuccessAt == null || manifest.lastSuccessAt == null) {
    return false;
  }
  final DateTime? stateInstant = state.generatedAt;
  final DateTime? releaseInstant = manifest.generatedAt;
  if (stateInstant == null || releaseInstant == null) return false;
  if (currentSeason == null || manifest.season != currentSeason) return false;
  final int? season = state.season;
  if (season != null && season != currentSeason) return false;
  return stateInstant.isBefore(releaseInstant);
}
