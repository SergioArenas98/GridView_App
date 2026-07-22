/// Local synchronization bookkeeping for a single resource, mirroring the
/// `resource_sync_metadata` table. Keyed by a canonical resource key built from
/// stable identifiers (never a display name), e.g. `home`, `calendar:2026`,
/// `standings:drivers:2026`, `driver:max-verstappen`, `grand-prix:2026:13`.
///
/// This is local persistence state that Phase 6B's synchronization layer will
/// consume (conditional requests, freshness policy, retry/backoff). Phase 6A
/// only reads and writes it; it makes no synchronization decisions.
class ResourceSyncState {
  const ResourceSyncState({
    required this.resourceKey,
    this.season,
    this.entityId,
    this.round,
    this.etag,
    this.generatedAt,
    this.sourceUpdatedAt,
    this.staleAfter,
    this.contentVersion,
    this.lastAttemptAt,
    this.lastSuccessAt,
    this.lastFailureCategory,
    this.serverStale,
  });

  final String resourceKey;

  /// Scope (populated where applicable).
  final int? season;
  final String? entityId;
  final int? round;

  /// Conditional-request validator, persisted verbatim.
  final String? etag;

  /// Snapshot provenance mirrored from the response `meta`.
  final DateTime? generatedAt;
  final DateTime? sourceUpdatedAt;
  final DateTime? staleAfter;
  final String? contentVersion;

  /// When synchronization was last attempted / last succeeded (UTC).
  final DateTime? lastAttemptAt;
  final DateTime? lastSuccessAt;

  /// Category of the last failure (never a raw message), when the last attempt
  /// failed.
  final String? lastFailureCategory;

  /// Server-provided stale flag, when supplied.
  final bool? serverStale;
}
