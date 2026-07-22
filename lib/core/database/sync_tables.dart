import 'package:drift/drift.dart';

// Resource-level synchronization metadata (added in schema v2).
//
// This table is provisioned by schema v2 so that Phase 6B (remote repositories,
// ETag/conditional requests, per-resource freshness and sync orchestration) can
// persist its bookkeeping without another schema migration. Phase 6A defines the
// table and minimal local CRUD access (`SyncMetadataDao`) only; it wires no
// synchronization behaviour.
//
// The primary key is a canonical resource key built from stable identifiers,
// never a display name — e.g. `home`, `calendar:2026`, `standings:drivers:2026`,
// `driver:max-verstappen`, `grand-prix:2026:13`. The season/entity/round scope
// is also stored in dedicated columns (where applicable) so Phase 6B can query
// by scope without parsing the key. Instants are stored as ISO-8601 UTC text via
// `storeDateTimeAsText`.

@DataClassName('ResourceSyncMetadataRow')
@TableIndex(name: 'idx_resource_sync_stale_after', columns: {#staleAfter})
@TableIndex(
  name: 'idx_resource_sync_season_stale',
  columns: {#season, #staleAfter},
)
class ResourceSyncMetadata extends Table {
  /// Canonical resource key (stable identifiers only, never a display name).
  TextColumn get resourceKey => text()();

  // --- Scope (populated where applicable). ---
  IntColumn get season => integer().nullable()();

  /// The scoped entity slug (driver/constructor/circuit/grand-prix), when the
  /// resource is entity-scoped.
  TextColumn get entityId => text().nullable()();
  IntColumn get round => integer().nullable()();

  /// Strong or weak validator returned by the API, persisted verbatim for
  /// conditional (`If-None-Match`) requests.
  TextColumn get etag => text().nullable()();

  /// Snapshot provenance mirrored from the response `meta` (UTC instants).
  DateTimeColumn get generatedAt => dateTime().nullable()();
  DateTimeColumn get sourceUpdatedAt => dateTime().nullable()();
  DateTimeColumn get staleAfter => dateTime().nullable()();
  TextColumn get contentVersion => text().nullable()();

  /// When synchronization of this resource was last attempted (UTC).
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();

  /// When this resource last synchronized successfully (UTC).
  DateTimeColumn get lastSuccessAt => dateTime().nullable()();

  /// Category of the last failure (e.g. `upstream_unavailable`, `invalid`,
  /// `network`), when the last attempt failed. Never a raw error message.
  TextColumn get lastFailureCategory => text().nullable()();

  /// Server-provided stale flag, when supplied.
  BoolColumn get serverStale => boolean().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{resourceKey};
}
