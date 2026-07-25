// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/database/daos/standings_dao.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/standing.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/standings_repository.dart';
import '../mappers/standing_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads championship standings from the local database and refreshes the driver
/// and constructor collections independently. Each refresh replaces its season's
/// table atomically, preserving the delivered order and the stable competitor
/// identities (only standing rows are replaced).
class StandingsRepositoryImpl extends SyncedRepository
    implements StandingsRepository {
  StandingsRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required StandingsDao local,
  }) : _local = local;

  final StandingsDao _local;

  @override
  Stream<List<DriverStanding>> watchDriverStandings(int season) =>
      _local.watchDriverStandingsForSeason(season);

  @override
  Stream<List<ConstructorStanding>> watchConstructorStandings(int season) =>
      _local.watchConstructorStandingsForSeason(season);

  @override
  Future<List<DriverStanding>> readDriverStandings(int season) =>
      _local.driverStandingsForSeason(season);

  @override
  Future<List<ConstructorStanding>> readConstructorStandings(int season) =>
      _local.constructorStandingsForSeason(season);

  @override
  Future<RefreshResult> refreshDriverStandings(
    int season, {
    bool forceRefresh = false,
  }) {
    return refreshResource<List<DriverStandingDto>>(
      key: ResourceKey.driverStandings(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchDriverStandings(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<DriverStandingDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<DriverStandingDto>> m) =>
          _local.replaceDriverStandings(
            season,
            m.data.map(driverStandingFromDto).toList(growable: false),
          ),
      hasLocalRepresentation: collectionRepresentation,
      forceRefresh: forceRefresh,
    );
  }

  @override
  Future<RefreshResult> refreshConstructorStandings(
    int season, {
    bool forceRefresh = false,
  }) {
    return refreshResource<List<ConstructorStandingDto>>(
      key: ResourceKey.constructorStandings(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchConstructorStandings(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<ConstructorStandingDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<ConstructorStandingDto>> m) =>
          _local.replaceConstructorStandings(
            season,
            m.data.map(constructorStandingFromDto).toList(growable: false),
          ),
      hasLocalRepresentation: collectionRepresentation,
      forceRefresh: forceRefresh,
    );
  }
}
