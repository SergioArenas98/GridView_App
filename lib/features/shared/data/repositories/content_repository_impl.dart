import '../../../../core/api/dto/view_dto.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/sync_state.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/content_repository.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Refreshes the curated content/media manifest via a conditional remote read.
///
/// The manifest is metadata only — no image bytes are ever downloaded and no
/// domain rows are written. The manifest's own `contentVersion` is persisted in
/// the resource sync metadata so the app can decide whether long-lived profile
/// content needs refreshing.
class ContentRepositoryImpl extends SyncedRepository
    implements ContentRepository {
  ContentRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
  });

  @override
  Future<String?> readContentVersion() async =>
      (await sync.read(ResourceKey.contentManifest()))?.contentVersion;

  @override
  Future<RefreshResult> refreshContentManifest({bool forceRefresh = false}) {
    return refreshResource<ContentManifestDto>(
      key: ResourceKey.contentManifest(),
      scope: ResourceScope.none,
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchContentManifest(etag: etag, cancellation: cancellation),
      metaOf: (RemoteModified<ContentManifestDto> m) => RemoteSnapshotMeta(
        // Persist the manifest's own content version (the meaningful value the
        // app checks), keeping the snapshot provenance from the response meta.
        etag: m.etag,
        generatedAt: DateTime.parse(m.meta.generatedAt).toUtc(),
        sourceUpdatedAt: m.meta.sourceUpdatedAt == null
            ? null
            : DateTime.parse(m.meta.sourceUpdatedAt!).toUtc(),
        staleAfter: m.meta.staleAfter == null
            ? null
            : DateTime.parse(m.meta.staleAfter!).toUtc(),
        contentVersion: m.data.contentVersion,
      ),
      // The manifest has no domain rows; the write is a metadata-only commit.
      writeDomain: (RemoteModified<ContentManifestDto> m) async {},
      hasLocalData: () async {
        final ResourceSyncState? state = await sync.read(
          ResourceKey.contentManifest(),
        );
        return state?.lastSuccessAt != null;
      },
      forceRefresh: forceRefresh,
    );
  }
}
