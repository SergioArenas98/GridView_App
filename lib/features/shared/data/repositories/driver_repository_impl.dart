// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/database/daos/competitor_dao.dart';
import '../../domain/entities/constructor.dart';
import '../../domain/entities/detail_views.dart';
import '../../domain/entities/driver.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/season_entry.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/driver_repository.dart';
import '../mappers/competitor_mapper.dart';
import '../mappers/summary_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads drivers from the local database and refreshes the season roster and
/// per-driver detail via conditional remote reads.
///
/// The season roster owns the season's participation entries (replaced only for
/// that season, preserving mid-season stints and other seasons). Driver detail
/// owns the stable identity (biography and media); it never rewrites the season
/// roster or standings — those are composed locally on read.
class DriverRepositoryImpl extends SyncedRepository
    implements DriverRepository {
  DriverRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required CompetitorDao local,
  }) : _local = local;

  final CompetitorDao _local;

  @override
  Stream<List<SeasonDriver>> watchSeasonDrivers(int season) =>
      _local.watchDriversForSeason(season);

  @override
  Stream<DriverDetailView?> watchDriver({
    required int season,
    required String driverId,
  }) => _local.watchDriverDetail(season, driverId);

  @override
  Future<List<SeasonDriver>> readSeasonDrivers(int season) =>
      _local.driversForSeason(season);

  @override
  Future<DriverDetailView?> readDriver({
    required int season,
    required String driverId,
  }) => _local.driverDetail(season, driverId);

  @override
  Future<RefreshResult> refreshSeasonDrivers(
    int season, {
    bool forceRefresh = false,
  }) {
    return refreshResource<List<SeasonDriverSummaryDto>>(
      key: ResourceKey.drivers(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchSeasonDrivers(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<SeasonDriverSummaryDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<SeasonDriverSummaryDto>> m) async {
        final List<Driver> identities = m.data
            .map(driverIdentityFromSeasonSummary)
            .toList(growable: false);
        final List<DriverSeasonEntry> entries = m.data
            .map(
              (SeasonDriverSummaryDto d) =>
                  driverSeasonEntryFromSeasonSummary(d, season),
            )
            .toList(growable: false);
        // Identity upsert first (preserves detail-owned bio/media), then the
        // season's participation collection is replaced.
        await _local.upsertDriverIdentities(identities);
        await _local.replaceDriverSeasonEntries(season, entries);
      },
      hasLocalData: () async =>
          (await _local.countDriverSeasonEntries(season)) > 0,
      forceRefresh: forceRefresh,
    );
  }

  @override
  Future<RefreshResult> refreshDriver({
    required String driverId,
    required int season,
    bool forceRefresh = false,
  }) {
    return refreshResource<DriverDetailDto>(
      key: ResourceKey.driver(driverId, season),
      scope: ResourceScope(season: season, entityId: driverId),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchDriver(
            driverId: driverId,
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<DriverDetailDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<DriverDetailDto> m) async {
        // Detail owns the stable identity + biography + media only. The season
        // entry and standing are composed from the roster/standings syncs.
        final Driver driver = driverFromDto(m.data.driver);
        await _local.upsertDrivers(<Driver>[driver]);
        final ConstructorSummaryDto? team = m.data.constructor;
        if (team != null) {
          await _local.upsertConstructorIdentities(<Constructor>[
            Constructor(
              id: team.id,
              name: team.name,
              shortName: team.shortName,
              colorPrimary: team.colorPrimary,
            ),
          ]);
        }
      },
      hasLocalData: () async => (await _local.countDriver(driverId)) > 0,
      forceRefresh: forceRefresh,
    );
  }
}
