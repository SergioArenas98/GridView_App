import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/sync_state.dart';
import '../gridview_database.dart';
import '../sync_tables.dart';

part 'sync_metadata_dao.g.dart';

/// Local access to resource synchronization metadata: CRUD ([upsert]/[read])
/// plus the due/stale lookup ([readDueResources]/[watchDueResources]) that
/// Phase 6B's orchestration consumes. Phase 6A owns this local query only; the
/// behaviour that acts on it — conditional (`If-None-Match`) requests, refresh
/// policy, scheduling and retry — is Phase 6B and is not implemented here.
/// Nothing Drift-shaped escapes.
@DriftAccessor(tables: <Type>[ResourceSyncMetadata])
class SyncMetadataDao extends DatabaseAccessor<GridViewDatabase>
    with _$SyncMetadataDaoMixin {
  SyncMetadataDao(super.db);

  Future<void> upsert(ResourceSyncState state) =>
      into(resourceSyncMetadata).insertOnConflictUpdate(_companion(state));

  Future<ResourceSyncState?> read(String resourceKey) async {
    final ResourceSyncMetadataRow? row =
        await (select(resourceSyncMetadata)..where(
              (ResourceSyncMetadata m) => m.resourceKey.equals(resourceKey),
            ))
            .getSingleOrNull();
    return row == null ? null : _fromRow(row);
  }

  /// The resources locally **due** for refresh at [now] (a supplied UTC instant
  /// — the DAO never calls `DateTime.now`). A resource is due when any holds:
  ///
  /// 1. it has never synchronised successfully (`lastSuccessAt` is null);
  /// 2. the server flagged it stale (`serverStale` is true), even if
  ///    `staleAfter` is in the future or null;
  /// 3. its expiry has passed (`staleAfter` is non-null and `<= now`).
  ///
  /// A successfully-synced resource with a null `staleAfter` and `serverStale`
  /// not true is **not** due. Optionally scoped to [season]. This is the local
  /// query only — deciding whether/when to actually refresh is Phase 6B.
  ///
  /// Ordered deterministically: never-successful first, then server-stale, then
  /// oldest `staleAfter`, with `resourceKey` as the stable final tie-breaker.
  Future<List<ResourceSyncState>> readDueResources(
    DateTime now, {
    int? season,
  }) async {
    final List<ResourceSyncMetadataRow> rows =
        await (select(resourceSyncMetadata)
              ..where((ResourceSyncMetadata m) => _dueWhere(m, now, season))
              ..orderBy(_dueOrder))
            .get();
    return rows.map(_fromRow).toList(growable: false);
  }

  /// Streaming form of [readDueResources]; re-emits when the metadata changes.
  Stream<List<ResourceSyncState>> watchDueResources(
    DateTime now, {
    int? season,
  }) {
    return (select(resourceSyncMetadata)
          ..where((ResourceSyncMetadata m) => _dueWhere(m, now, season))
          ..orderBy(_dueOrder))
        .watch()
        .map(
          (List<ResourceSyncMetadataRow> rows) =>
              rows.map(_fromRow).toList(growable: false),
        );
  }

  Expression<bool> _dueWhere(
    ResourceSyncMetadata m,
    DateTime now,
    int? season,
  ) {
    final Expression<bool> due =
        m.lastSuccessAt.isNull() |
        m.serverStale.equals(true) |
        (m.staleAfter.isNotNull() & m.staleAfter.isSmallerOrEqualValue(now));
    return season == null ? due : (due & m.season.equals(season));
  }

  List<OrderClauseGenerator<ResourceSyncMetadata>> get _dueOrder =>
      <OrderClauseGenerator<ResourceSyncMetadata>>[
        // Never-successful resources first.
        (ResourceSyncMetadata m) => OrderingTerm(
          expression: m.lastSuccessAt.isNull(),
          mode: OrderingMode.desc,
        ),
        // Then server-stale resources.
        (ResourceSyncMetadata m) => OrderingTerm(
          expression: m.serverStale.equals(true),
          mode: OrderingMode.desc,
        ),
        // Then the oldest expiry.
        (ResourceSyncMetadata m) => OrderingTerm(expression: m.staleAfter),
        // Stable final tie-breaker.
        (ResourceSyncMetadata m) => OrderingTerm(expression: m.resourceKey),
      ];

  ResourceSyncMetadataCompanion _companion(ResourceSyncState s) =>
      ResourceSyncMetadataCompanion.insert(
        resourceKey: s.resourceKey,
        season: Value<int?>(s.season),
        entityId: Value<String?>(s.entityId),
        round: Value<int?>(s.round),
        etag: Value<String?>(s.etag),
        generatedAt: Value<DateTime?>(s.generatedAt),
        sourceUpdatedAt: Value<DateTime?>(s.sourceUpdatedAt),
        staleAfter: Value<DateTime?>(s.staleAfter),
        contentVersion: Value<String?>(s.contentVersion),
        lastAttemptAt: Value<DateTime?>(s.lastAttemptAt),
        lastSuccessAt: Value<DateTime?>(s.lastSuccessAt),
        lastFailureCategory: Value<String?>(s.lastFailureCategory),
        serverStale: Value<bool?>(s.serverStale),
      );

  ResourceSyncState _fromRow(ResourceSyncMetadataRow r) => ResourceSyncState(
    resourceKey: r.resourceKey,
    season: r.season,
    entityId: r.entityId,
    round: r.round,
    etag: r.etag,
    generatedAt: r.generatedAt,
    sourceUpdatedAt: r.sourceUpdatedAt,
    staleAfter: r.staleAfter,
    contentVersion: r.contentVersion,
    lastAttemptAt: r.lastAttemptAt,
    lastSuccessAt: r.lastSuccessAt,
    lastFailureCategory: r.lastFailureCategory,
    serverStale: r.serverStale,
  );
}
