import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/errors/api_failure.dart';
import '../../../../core/database/daos/vertical_slice_dao.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/grand_prix_view.dart';
import '../../domain/entities/home_view.dart';
import '../../domain/entities/session.dart';
import '../../domain/repositories/race_weekend_repository.dart';
import '../mappers/event_mapper.dart';
import '../mappers/freshness_mapper.dart';
import '../mappers/home_mapper.dart';
import '../remote/gridview_api.dart';
import '../remote/remote_result.dart';

/// The vertical-slice repository implementation.
///
/// Reads come straight from the local [VerticalSliceDao] streams. A refresh
/// issues a typed conditional read and, on a [RemoteModified] response, maps the
/// DTOs explicitly to domain entities and writes them through one atomic
/// snapshot transaction. A [RemoteFailure] becomes a typed [RefreshFailure] so a
/// failed refresh never erases valid cached data, and a [RemoteNotModified] is a
/// successful validation that leaves the cache untouched.
class RaceWeekendRepositoryImpl implements RaceWeekendRepository {
  const RaceWeekendRepositoryImpl({
    required GridViewApi remote,
    required VerticalSliceDao local,
  }) : _remote = remote,
       _local = local;

  // ignore_for_file: prefer_initializing_formals
  final GridViewApi _remote;
  final VerticalSliceDao _local;

  @override
  Stream<HomeView?> watchHome() => _local.watchHome();

  @override
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  }) => _local.watchGrandPrix(season, round);

  @override
  Future<RefreshResult> refreshHome() async {
    final RemoteResult<HomeDataDto> result = await _remote.fetchHome();
    switch (result) {
      case RemoteModified<HomeDataDto>(:final HomeDataDto data, :final meta):
        final featuredDto = data.featuredEvent;
        if (featuredDto == null) {
          // A Home snapshot with no featured event cannot drive this slice.
          return const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.invalidResponse),
          );
        }
        final List<Session> sessions = data.featuredSession == null
            ? const <Session>[]
            : <Session>[sessionFromDto(data.featuredSession!)];
        final GrandPrix featured = grandPrixFromSummaryDto(
          featuredDto,
          sessions: sessions,
        );
        // The conflict key comes from the response meta: SnapshotMeta requires
        // sourceUpdatedAt (the remote layer already rejected a snapshot whose
        // meta is missing it).
        final SnapshotWriteOutcome outcome = await _local.writeHomeSnapshot(
          featured: featured,
          featuredCircuit: circuitFromSummaryDto(featuredDto),
          freshness: freshnessFromMeta(meta),
        );
        return RefreshSuccess(applied: outcome == SnapshotWriteOutcome.applied);
      case RemoteNotModified<HomeDataDto>():
        return const RefreshSuccess(applied: false);
      case RemoteFailure<HomeDataDto>(:final failure):
        return RefreshFailure(failure);
    }
  }

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
  }) async {
    final RemoteResult<GrandPrixDto> result = await _remote.fetchGrandPrix(
      season: season,
      round: round,
    );
    switch (result) {
      case RemoteModified<GrandPrixDto>(:final GrandPrixDto data, :final meta):
        final SnapshotWriteOutcome outcome = await _local
            .writeGrandPrixSnapshot(
              grandPrix: grandPrixFromDto(data),
              freshness: freshnessFromMeta(meta),
            );
        return RefreshSuccess(applied: outcome == SnapshotWriteOutcome.applied);
      case RemoteNotModified<GrandPrixDto>():
        return const RefreshSuccess(applied: false);
      case RemoteFailure<GrandPrixDto>(:final failure):
        return RefreshFailure(failure);
    }
  }
}
