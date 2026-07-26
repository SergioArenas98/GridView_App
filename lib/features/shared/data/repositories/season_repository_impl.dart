// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/season_dto.dart';
import '../../../../core/database/daos/season_dao.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/season.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/season_repository.dart';
import '../mappers/competitor_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads season identity from the local database and refreshes it via a
/// conditional remote read. The current season is stored with a single
/// `isCurrent` flag; per-season metadata never disturbs other seasons.
class SeasonRepositoryImpl extends SyncedRepository
    implements SeasonRepository {
  SeasonRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required SeasonDao local,
  }) : _local = local;

  final SeasonDao _local;

  @override
  Stream<Season?> watchCurrentSeason() => _local.watchCurrentSeason();

  @override
  Stream<Season?> watchSeason(int season) => _local.watchSeason(season);

  @override
  Future<Season?> readCurrentSeason() => _local.readCurrentSeason();

  @override
  Future<Season?> readSeason(int season) => _local.readSeason(season);

  @override
  Future<RefreshResult> refreshCurrentSeason({
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<SeasonDto>(
      key: ResourceKey.currentSeason(),
      scope: ResourceScope.none,
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchCurrentSeason(etag: etag, cancellation: cancellation),
      metaOf: (RemoteModified<SeasonDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<SeasonDto> m) =>
          _local.setCurrentSeason(seasonFromDto(m.data)),
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.countCurrentSeason()) > 0,
      ),
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }

  @override
  Future<RefreshResult> refreshSeason(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<SeasonDto>(
      key: ResourceKey.season(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) => remote
          .fetchSeason(season: season, etag: etag, cancellation: cancellation),
      metaOf: (RemoteModified<SeasonDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<SeasonDto> m) =>
          _local.upsertSeason(seasonFromDto(m.data)),
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.countSeason(season)) > 0,
      ),
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }
}
