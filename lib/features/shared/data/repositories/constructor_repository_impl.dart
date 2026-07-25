// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/database/daos/competitor_dao.dart';
import '../../domain/entities/constructor.dart';
import '../../domain/entities/detail_views.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/constructor_repository.dart';
import '../mappers/competitor_mapper.dart';
import '../mappers/summary_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads constructors from the local database and refreshes the season list and
/// per-team detail via conditional remote reads.
///
/// The season list owns the season's constructor entries (branding), replaced
/// only for that season. Team detail owns the stable identity (biography and
/// media). The line-up is derived from the season's driver entries — never a
/// stored duplicate — so a constructor sync never persists a line-up.
class ConstructorRepositoryImpl extends SyncedRepository
    implements ConstructorRepository {
  ConstructorRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required CompetitorDao local,
  }) : _local = local;

  final CompetitorDao _local;

  @override
  Stream<List<SeasonConstructor>> watchSeasonConstructors(int season) =>
      _local.watchConstructorsForSeason(season);

  @override
  Stream<TeamDetailView?> watchConstructor({
    required int season,
    required String constructorId,
  }) => _local.watchTeamDetail(season, constructorId);

  @override
  Future<List<SeasonConstructor>> readSeasonConstructors(int season) =>
      _local.constructorsForSeason(season);

  @override
  Future<TeamDetailView?> readConstructor({
    required int season,
    required String constructorId,
  }) => _local.teamDetail(season, constructorId);

  @override
  Future<RefreshResult> refreshSeasonConstructors(
    int season, {
    bool forceRefresh = false,
  }) {
    return refreshResource<List<SeasonConstructorSummaryDto>>(
      key: ResourceKey.constructors(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchSeasonConstructors(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<SeasonConstructorSummaryDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<SeasonConstructorSummaryDto>> m) async {
        await _local.upsertConstructorIdentities(
          m.data
              .map(constructorIdentityFromSeasonSummary)
              .toList(growable: false),
        );
        await _local.replaceConstructorSeasonEntries(
          season,
          m.data
              .map(
                (SeasonConstructorSummaryDto c) =>
                    constructorSeasonEntryFromSeasonSummary(c, season),
              )
              .toList(growable: false),
        );
      },
      hasLocalRepresentation: collectionRepresentation,
      forceRefresh: forceRefresh,
    );
  }

  @override
  Future<RefreshResult> refreshConstructor({
    required String constructorId,
    required int season,
    bool forceRefresh = false,
  }) {
    return refreshResource<ConstructorDetailDto>(
      key: ResourceKey.constructor(constructorId, season),
      scope: ResourceScope(season: season, entityId: constructorId),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchConstructor(
            constructorId: constructorId,
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<ConstructorDetailDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<ConstructorDetailDto> m) =>
          _local.upsertConstructors(<Constructor>[
            constructorFromDto(m.data.constructor),
          ]),
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.countConstructor(constructorId)) > 0,
      ),
      forceRefresh: forceRefresh,
    );
  }
}
