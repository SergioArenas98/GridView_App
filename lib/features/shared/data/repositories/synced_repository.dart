import '../../../../core/api/errors/api_failure.dart';
import '../../../../core/database/daos/competitor_dao.dart'
    show InvalidSeasonEntriesException;
import '../../../../core/database/daos/media_dao.dart'
    show InvalidMediaOwnershipException;
import '../../../../core/database/entity_validation.dart'
    show InvalidEntityException;
import '../../domain/refresh_result.dart';
import '../../domain/snapshot_conflict.dart';
import '../remote/gridview_api.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/refresh_coordinator.dart';
import '../sync/resource_snapshot.dart';
import '../sync/resource_sync.dart';

/// A conditional remote fetch for one resource, parameterised by ETag and
/// cancellation.
typedef ResourceFetch<T> =
    Future<RemoteResult<T>> Function({
      String? etag,
      RemoteCancellation? cancellation,
    });

/// Base class for the remote-to-local repositories.
///
/// It centralizes the conditional-refresh pipeline shared by every resource so
/// each repository only supplies the resource-specific pieces (the fetch, the
/// snapshot meta, the transactional domain write and a local-presence check):
///
/// 1. read the persisted ETag and issue a conditional request;
/// 2. on `200` apply the snapshot atomically through [ResourceSync] (conflict
///    rule + domain write + success metadata);
/// 3. on `304` record a validation — unless the local domain data is absent, in
///    which case retry exactly once unconditionally and, if that still fails to
///    deliver data, report a typed invalid-cache failure;
/// 4. on failure preserve the cache and record a safe failure category.
///
/// Concurrent refreshes of the same canonical key are collapsed by the shared
/// [RefreshCoordinator].
abstract class SyncedRepository {
  SyncedRepository({
    required this.remote,
    required this.sync,
    required this.coordinator,
    required this.now,
  });

  final GridViewApi remote;
  final ResourceSync sync;
  final RefreshCoordinator coordinator;
  final DateTime Function() now;

  /// Runs the full conditional-refresh pipeline for [key], deduplicated per key.
  Future<RefreshResult> refreshResource<T>({
    required String key,
    required ResourceScope scope,
    required ResourceFetch<T> fetch,
    required RemoteSnapshotMeta Function(RemoteModified<T> modified) metaOf,
    required Future<void> Function(RemoteModified<T> modified) writeDomain,
    required Future<bool> Function() hasLocalData,
    RemoteCancellation? cancellation,
    bool forceRefresh = false,
  }) {
    return coordinator.run(
      key,
      () => _run<T>(
        key: key,
        scope: scope,
        fetch: fetch,
        metaOf: metaOf,
        writeDomain: writeDomain,
        hasLocalData: hasLocalData,
        cancellation: cancellation,
        forceRefresh: forceRefresh,
      ),
    );
  }

  Future<RefreshResult> _run<T>({
    required String key,
    required ResourceScope scope,
    required ResourceFetch<T> fetch,
    required RemoteSnapshotMeta Function(RemoteModified<T>) metaOf,
    required Future<void> Function(RemoteModified<T>) writeDomain,
    required Future<bool> Function() hasLocalData,
    required RemoteCancellation? cancellation,
    required bool forceRefresh,
  }) async {
    final String? storedEtag = forceRefresh
        ? null
        : (await sync.read(key))?.etag;
    final RemoteResult<T> result = await fetch(
      etag: storedEtag,
      cancellation: cancellation,
    );

    // `is`-checks (not switch object patterns) are used deliberately: the
    // code-generation toolchain's parser mis-reads a generic type-argument
    // pattern (`RemoteModified<T>`) in a switch as a comparison expression.
    if (result is RemoteModified<T>) {
      return _apply<T>(key, scope, result, metaOf, writeDomain);
    }
    if (result is RemoteNotModified<T>) {
      if (await hasLocalData()) {
        await sync.recordNotModified(key, scope, now(), newEtag: result.etag);
        return const RefreshSuccess(applied: false);
      }
      // 304 but the local domain data is absent: the cache is inconsistent.
      // Retry exactly once, unconditionally (no If-None-Match).
      final RemoteResult<T> retry = await fetch(cancellation: cancellation);
      if (retry is RemoteModified<T>) {
        return _apply<T>(key, scope, retry, metaOf, writeDomain);
      }
      if (retry is RemoteFailure<T>) {
        await sync.recordFailure(key, scope, retry.failure.kind.name, now());
        return RefreshFailure(retry.failure);
      }
      // A second 304 (still no data): the cache/protocol is inconsistent.
      await sync.recordFailure(
        key,
        scope,
        SyncFailureCategory.invalidCache,
        now(),
      );
      return const RefreshFailure(
        ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
    }
    final RemoteFailure<T> failure = result as RemoteFailure<T>;
    await sync.recordFailure(key, scope, failure.failure.kind.name, now());
    return RefreshFailure(failure.failure);
  }

  Future<RefreshResult> _apply<T>(
    String key,
    ResourceScope scope,
    RemoteModified<T> modified,
    RemoteSnapshotMeta Function(RemoteModified<T>) metaOf,
    Future<void> Function(RemoteModified<T>) writeDomain,
  ) async {
    final SnapshotConflictOutcome outcome;
    try {
      outcome = await sync.applySnapshot(
        key: key,
        scope: scope,
        incoming: metaOf(modified),
        at: now(),
        writeDomain: () => writeDomain(modified),
      );
    } on InvalidSeasonEntriesException {
      return _rejectInvalidPayload(key, scope);
    } on InvalidMediaOwnershipException {
      return _rejectInvalidPayload(key, scope);
    } on InvalidEntityException {
      return _rejectInvalidPayload(key, scope);
    }

    switch (outcome) {
      case SnapshotConflictOutcome.apply:
        return const RefreshSuccess(applied: true);
      case SnapshotConflictOutcome.skippedUpToDate:
      case SnapshotConflictOutcome.rejectedOlder:
        return const RefreshSuccess(applied: false);
      case SnapshotConflictOutcome.rejectedInvalid:
        return const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.invalidResponse),
        );
    }
  }

  /// A domain-validation rejection: the whole transaction rolled back, so the
  /// cache is preserved. Record a safe category and report a typed failure.
  Future<RefreshResult> _rejectInvalidPayload(
    String key,
    ResourceScope scope,
  ) async {
    await sync.recordFailure(
      key,
      scope,
      SyncFailureCategory.invalidSnapshot,
      now(),
    );
    return const RefreshFailure(
      ApiFailure(kind: ApiFailureKind.invalidResponse),
    );
  }
}
