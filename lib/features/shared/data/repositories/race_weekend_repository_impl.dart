import '../../../../core/api/errors/api_exception.dart';
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

/// The vertical-slice repository implementation.
///
/// Reads come straight from the local [VerticalSliceDao] streams. A refresh
/// fetches remote DTOs, maps them explicitly to domain entities, and writes
/// them through one atomic snapshot transaction. Any [GridViewApiException] is
/// caught here and turned into a typed [RefreshFailure] so a failed refresh
/// never erases valid cached data and never leaks a transport error to the UI.
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
    try {
      final response = await _remote.fetchHome();
      final featuredDto = response.data.featuredEvent;
      if (featuredDto == null) {
        // A Home snapshot with no featured event cannot drive this slice.
        return const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.invalidResponse),
        );
      }

      final List<Session> sessions = response.data.featuredSession == null
          ? const <Session>[]
          : <Session>[sessionFromDto(response.data.featuredSession!)];
      final GrandPrix featured = grandPrixFromSummaryDto(
        featuredDto,
        sessions: sessions,
      );

      final SnapshotWriteOutcome outcome = await _local.writeHomeSnapshot(
        featured: featured,
        featuredCircuit: circuitFromSummaryDto(featuredDto),
        freshness: freshnessFromDto(response.data.freshness),
      );
      return RefreshSuccess(applied: outcome == SnapshotWriteOutcome.applied);
    } on GridViewApiException catch (e) {
      return RefreshFailure(e.failure);
    }
  }

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
  }) async {
    try {
      final response = await _remote.fetchGrandPrix(
        season: season,
        round: round,
      );
      final SnapshotWriteOutcome outcome = await _local.writeGrandPrixSnapshot(
        grandPrix: grandPrixFromDto(response.data),
        freshness: freshnessFromMeta(response.meta),
      );
      return RefreshSuccess(applied: outcome == SnapshotWriteOutcome.applied);
    } on GridViewApiException catch (e) {
      return RefreshFailure(e.failure);
    }
  }
}
