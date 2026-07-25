// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/result_dto.dart';
import '../../../../core/database/daos/results_dao.dart';
import '../../domain/entities/race_result.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/result_repository.dart';
import '../mappers/result_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads race/sprint result documents from the local database and refreshes them
/// via a conditional remote read.
///
/// The results endpoint returns one document per request; a sprint weekend's
/// sprint and race documents coexist for the same event. The write replaces only
/// the delivered `(grandPrixId, sessionType)` classification, preserving the
/// other document and fractional points / nullable timing combinations. A
/// not-yet-run session is `status = unavailable` with no entries — persisted as
/// such, never fabricated.
class ResultRepositoryImpl extends SyncedRepository
    implements ResultRepository {
  ResultRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required ResultsDao local,
  }) : _local = local;

  final ResultsDao _local;

  @override
  Stream<List<RaceResult>> watchResults({
    required int season,
    required int round,
  }) => _local.watchResultsForSeasonRound(season, round);

  @override
  Future<List<RaceResult>> readResults({
    required int season,
    required int round,
  }) => _local.resultsForSeasonRound(season, round);

  @override
  Future<RefreshResult> refreshResults({
    required int season,
    required int round,
    bool forceRefresh = false,
  }) {
    return refreshResource<RaceResultDto>(
      key: ResourceKey.grandPrixResults(season, round),
      scope: ResourceScope(season: season, round: round),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchGrandPrixResults(
            season: season,
            round: round,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<RaceResultDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<RaceResultDto> m) =>
          _local.writeRaceResult(raceResultFromDto(m.data)),
      hasLocalData: () async {
        // The document family for this (season, round) is present when any
        // result document — of any session type — is cached.
        return (await _local.countResultsForSeasonRound(season, round)) > 0;
      },
      forceRefresh: forceRefresh,
    );
  }
}
