// ignore_for_file: prefer_initializing_formals
import '../../../../core/database/daos/sync_metadata_dao.dart';
import '../../../../core/database/gridview_database.dart';
import '../../domain/entities/sync_state.dart';
import '../../domain/snapshot_conflict.dart';
import 'resource_snapshot.dart';

/// Notified when an error escapes [ResourceSync.applySnapshot], with the
/// canonical resource key and the error. The error is always rethrown; the
/// observer only watches.
typedef SnapshotApplyObserver = void Function(String key, Object error);

/// Safe, provider-agnostic `lastFailureCategory` values. Never a raw message.
abstract final class SyncFailureCategory {
  /// The incoming snapshot's source data was older than the cached one.
  static const String conflictOlder = 'conflict_older';

  /// The incoming snapshot was contract-invalid (no sourceUpdatedAt).
  static const String invalidSnapshot = 'invalid_snapshot';

  /// A 304 was received but the local domain data is absent, and the
  /// unconditional retry did not recover it.
  static const String invalidCache = 'invalid_cache';
}

/// The transactional writer for `resource_sync_metadata` and its owning domain
/// rows. It is the single place that applies the [SnapshotConflict] rule to a
/// modified snapshot and keeps the resource's freshness/validator metadata in
/// step with the domain write (§4, §5, §10): a domain write and its success
/// metadata are committed together, and a metadata failure rolls the domain
/// write back.
///
/// It owns no HTTP concerns and makes no refresh-policy decisions (that is the
/// repository's / Phase 6B2's job); it only persists outcomes.
class ResourceSync {
  ResourceSync(this._db, {SnapshotApplyObserver? onApplyError})
    : _onApplyError = onApplyError;

  final GridViewDatabase _db;

  /// Observes an error that escaped [applySnapshot]'s transaction.
  ///
  /// A plain callback, deliberately not an observability type: this class stays
  /// ignorant of what an observer does. It is the single place in the
  /// application where "the transport succeeded but the write did not" is
  /// visible, which is why the materialization report is raised here rather
  /// than in each repository.
  final SnapshotApplyObserver? _onApplyError;

  SyncMetadataDao get _meta => _db.syncMetadataDao;

  /// Applies a modified snapshot for [key] atomically.
  ///
  /// Reads the stored metadata, decides via the centralized conflict rule, and:
  /// - **apply** → runs [writeDomain] and commits full success metadata (ETag,
  ///   provenance, `lastSuccessAt`, cleared failure) in the same transaction;
  /// - **skippedUpToDate** → no domain write; records a successful validation
  ///   (refreshes ETag, `lastSuccessAt`, clears failure) so no stream re-emits;
  /// - **rejectedOlder** / **rejectedInvalid** → no domain write; records a safe
  ///   conflict category and preserves the cached ETag and provenance.
  ///
  /// Returns the conflict outcome. If [writeDomain] throws, the whole
  /// transaction rolls back and no success metadata is left behind.
  Future<SnapshotConflictOutcome> applySnapshot({
    required String key,
    required ResourceScope scope,
    required RemoteSnapshotMeta incoming,
    required DateTime at,
    required Future<void> Function() writeDomain,
  }) async {
    try {
      return await _applySnapshot(
        key: key,
        scope: scope,
        incoming: incoming,
        at: at,
        writeDomain: writeDomain,
      );
    } catch (error) {
      // Observe, then rethrow untouched: the caller's rollback handling and the
      // typed failure it returns are unchanged by the fact that anyone watched.
      _observeApplyError(key, error);
      rethrow;
    }
  }

  /// Runs the observer without letting it affect the failure being reported.
  void _observeApplyError(String key, Object error) {
    final SnapshotApplyObserver? observe = _onApplyError;
    if (observe == null) return;
    try {
      observe(key, error);
    } catch (_) {
      // Observation never changes an outcome.
    }
  }

  Future<SnapshotConflictOutcome> _applySnapshot({
    required String key,
    required ResourceScope scope,
    required RemoteSnapshotMeta incoming,
    required DateTime at,
    required Future<void> Function() writeDomain,
  }) {
    return _db.transaction(() async {
      final ResourceSyncState? stored = await _meta.read(key);
      final SnapshotConflictOutcome outcome = SnapshotConflict.decide(
        incoming.revision,
        _storedRevision(stored),
      );

      switch (outcome) {
        case SnapshotConflictOutcome.apply:
          await writeDomain();
          await _meta.upsert(_applied(stored, key, scope, incoming, at));
        case SnapshotConflictOutcome.skippedUpToDate:
          await _meta.upsert(
            _validated(stored, key, scope, at, newEtag: incoming.etag),
          );
        case SnapshotConflictOutcome.rejectedOlder:
          await _meta.upsert(
            _rejected(
              stored,
              key,
              scope,
              at,
              SyncFailureCategory.conflictOlder,
            ),
          );
        case SnapshotConflictOutcome.rejectedInvalid:
          await _meta.upsert(
            _rejected(
              stored,
              key,
              scope,
              at,
              SyncFailureCategory.invalidSnapshot,
            ),
          );
      }
      return outcome;
    });
  }

  /// Records a `304 Not Modified` validation: bumps `lastAttemptAt` and
  /// `lastSuccessAt`, clears the last failure, and updates the ETag only when the
  /// server supplied a replacement. Snapshot provenance is preserved unchanged —
  /// no new snapshot metadata is invented from the current clock. No domain rows
  /// are touched.
  Future<void> recordNotModified(
    String key,
    ResourceScope scope,
    DateTime at, {
    String? newEtag,
  }) async {
    final ResourceSyncState? stored = await _meta.read(key);
    await _meta.upsert(_validated(stored, key, scope, at, newEtag: newEtag));
  }

  /// Records a failed attempt: bumps `lastAttemptAt`, sets a safe
  /// [category], and preserves the ETag, provenance and `lastSuccessAt` so
  /// valid cached data survives. Never treats the attempt as a success.
  Future<void> recordFailure(
    String key,
    ResourceScope scope,
    String category,
    DateTime at,
  ) async {
    final ResourceSyncState? stored = await _meta.read(key);
    await _meta.upsert(_failed(stored, key, scope, at, category));
  }

  /// Reads the stored metadata (for its ETag) or null when never synced.
  Future<ResourceSyncState?> read(String key) => _meta.read(key);

  // --- Metadata builders (immutable merges) -------------------------------

  SnapshotRevision? _storedRevision(ResourceSyncState? s) {
    if (s == null || s.generatedAt == null) return null;
    return SnapshotRevision(
      generatedAt: s.generatedAt!,
      sourceUpdatedAt: s.sourceUpdatedAt,
      contentVersion: s.contentVersion,
    );
  }

  ResourceSyncState _base(
    ResourceSyncState? stored,
    String key,
    ResourceScope scope,
  ) => (stored ?? ResourceSyncState(resourceKey: key)).copyWith(
    resourceKey: key,
    season: scope.season,
    entityId: scope.entityId,
    round: scope.round,
  );

  ResourceSyncState _applied(
    ResourceSyncState? stored,
    String key,
    ResourceScope scope,
    RemoteSnapshotMeta m,
    DateTime at,
  ) => ResourceSyncState(
    // A modified snapshot fully replaces the provenance; only the scope carries
    // over. Null values (e.g. an absent serverStale) are set, not preserved.
    resourceKey: key,
    season: scope.season,
    entityId: scope.entityId,
    round: scope.round,
    etag: m.etag ?? stored?.etag,
    generatedAt: m.generatedAt,
    sourceUpdatedAt: m.sourceUpdatedAt,
    staleAfter: m.staleAfter,
    contentVersion: m.contentVersion,
    serverStale: m.serverStale,
    lastAttemptAt: at,
    lastSuccessAt: at,
    lastFailureCategory: null,
  );

  ResourceSyncState _validated(
    ResourceSyncState? stored,
    String key,
    ResourceScope scope,
    DateTime at, {
    String? newEtag,
  }) => _base(stored, key, scope).copyWith(
    etag: newEtag,
    lastAttemptAt: at,
    lastSuccessAt: at,
    lastFailureCategory: null,
  );

  ResourceSyncState _rejected(
    ResourceSyncState? stored,
    String key,
    ResourceScope scope,
    DateTime at,
    String category,
  ) => _base(
    stored,
    key,
    scope,
  ).copyWith(lastAttemptAt: at, lastFailureCategory: category);

  ResourceSyncState _failed(
    ResourceSyncState? stored,
    String key,
    ResourceScope scope,
    DateTime at,
    String category,
  ) => _base(
    stored,
    key,
    scope,
  ).copyWith(lastAttemptAt: at, lastFailureCategory: category);
}
