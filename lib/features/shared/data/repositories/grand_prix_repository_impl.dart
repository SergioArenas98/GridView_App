// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/database/daos/media_dao.dart';
import '../../../../core/database/daos/vertical_slice_dao.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/grand_prix_view.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/grand_prix_repository.dart';
import '../mappers/event_mapper.dart';
import '../mappers/freshness_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads Grand Prix detail from the local database and refreshes it via a
/// conditional remote read. The event, its ordered sessions and its media are
/// written atomically; sessions are replaced wholesale so obsolete ones never
/// linger and event identity never duplicates.
class GrandPrixRepositoryImpl extends SyncedRepository
    implements GrandPrixRepository {
  GrandPrixRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required VerticalSliceDao local,
    required MediaDao media,
  }) : _local = local,
       _media = media;

  final VerticalSliceDao _local;
  final MediaDao _media;

  @override
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  }) => _local.watchGrandPrix(season, round);

  @override
  Future<GrandPrixDetailView?> readGrandPrix({
    required int season,
    required int round,
  }) => _local.watchGrandPrix(season, round).first;

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<GrandPrixDto>(
      key: ResourceKey.grandPrix(season, round),
      scope: ResourceScope(season: season, round: round),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchGrandPrix(
            season: season,
            round: round,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<GrandPrixDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<GrandPrixDto> m) async {
        final GrandPrix gp = grandPrixFromDto(m.data);
        // The pipeline already applied the conflict rule; force the write.
        await _local.writeGrandPrixSnapshot(
          grandPrix: gp,
          freshness: freshnessFromMeta(m.meta),
          force: true,
        );
        if (gp.media != null) {
          await _media.replaceOwnerMedia(
            MediaEntityType.grandPrix,
            gp.id,
            gp.media!,
          );
        }
      },
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.countGrandPrix(season, round)) > 0,
      ),
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }
}
