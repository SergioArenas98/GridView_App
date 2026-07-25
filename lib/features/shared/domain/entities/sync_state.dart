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

  /// Returns a copy with the given fields replaced. Immutable update: never
  /// mutates the receiver. Because every field is nullable, a "clear to null"
  /// override is expressed with an explicit sentinel where needed by the caller;
  /// the metadata writer only ever sets fields to concrete new values or leaves
  /// them unchanged, so plain replacement is sufficient here.
  ResourceSyncState copyWith({
    String? resourceKey,
    int? season,
    String? entityId,
    int? round,
    String? etag,
    DateTime? generatedAt,
    DateTime? sourceUpdatedAt,
    DateTime? staleAfter,
    String? contentVersion,
    DateTime? lastAttemptAt,
    DateTime? lastSuccessAt,
    Object? lastFailureCategory = _unset,
    bool? serverStale,
  }) => ResourceSyncState(
    resourceKey: resourceKey ?? this.resourceKey,
    season: season ?? this.season,
    entityId: entityId ?? this.entityId,
    round: round ?? this.round,
    etag: etag ?? this.etag,
    generatedAt: generatedAt ?? this.generatedAt,
    sourceUpdatedAt: sourceUpdatedAt ?? this.sourceUpdatedAt,
    staleAfter: staleAfter ?? this.staleAfter,
    contentVersion: contentVersion ?? this.contentVersion,
    lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
    lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
    // lastFailureCategory is the one field cleared on success, so it accepts an
    // explicit null via the sentinel (null argument means "clear").
    lastFailureCategory: identical(lastFailureCategory, _unset)
        ? this.lastFailureCategory
        : lastFailureCategory as String?,
    serverStale: serverStale ?? this.serverStale,
  );

  static const Object _unset = Object();
}
