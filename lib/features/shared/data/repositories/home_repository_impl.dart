// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/database/daos/home_dashboard_dao.dart';
import '../../../../core/database/daos/vertical_slice_dao.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/home_dashboard.dart';
import '../../domain/entities/home_view.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/session.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/home_repository.dart';
import '../mappers/event_mapper.dart';
import '../mappers/freshness_mapper.dart';
import '../mappers/home_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads the Home view and the composed Home dashboard from the local database,
/// and refreshes the Home representation via a conditional remote read that
/// writes the snapshot atomically through the shared pipeline.
///
/// A Home snapshot with **no featured event** is a season with nothing scheduled
/// yet: a valid, materialized representation rather than an invalid payload. The
/// dashboard read is composition only — it issues no request of any kind, and in
/// particular never asks for a Grand Prix detail or a result document.
class HomeRepositoryImpl extends SyncedRepository implements HomeRepository {
  HomeRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required VerticalSliceDao local,
    required HomeDashboardDao dashboard,
  }) : _local = local,
       _dashboard = dashboard;

  final VerticalSliceDao _local;
  final HomeDashboardDao _dashboard;

  @override
  Stream<HomeView?> watchHome() => _local.watchHome();

  /// Composes the dashboard against [SyncedRepository]'s injected clock — the
  /// one the rest of this repository already reads time from, so a test pins a
  /// single "now" rather than two that can silently disagree.
  @override
  Stream<HomeDashboardView?> watchHomeDashboard() =>
      _dashboard.watchDashboard(now);

  @override
  Future<HomeView?> readHome() => _local.watchHome().first;

  @override
  Future<int?> materializedSeason() => _local.homeSnapshotSeason();

  @override
  Stream<int?> watchMaterializedSeason() => _local.watchHomeSnapshotSeason();

  @override
  Future<RefreshResult> refreshHome({
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<HomeDataDto>(
      key: ResourceKey.home(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) => remote
          .fetchHome(season: season, etag: etag, cancellation: cancellation),
      metaOf: (RemoteModified<HomeDataDto> m) => RemoteSnapshotMeta.fromMeta(
        m.meta,
        etag: m.etag,
        serverStale: m.data.freshness.stale,
      ),
      writeDomain: (RemoteModified<HomeDataDto> m) => _writeHome(m, season),
      // The representation exists only when the materialized Home belongs to
      // *this* season: a snapshot left over from another season cannot validate
      // a `304` for this one.
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.homeSnapshotSeason()) == season,
      ),
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }

  Future<void> _writeHome(
    RemoteModified<HomeDataDto> modified,
    int season,
  ) async {
    final HomeDataDto data = modified.data;
    final GrandPrixSummaryDto? featuredDto = data.featuredEvent;
    // A Home with no featured event is a season with nothing scheduled yet: a
    // valid, materialized representation, not an invalid payload. The snapshot
    // still records its season, which is what makes it materialized.
    final GrandPrix? featured = featuredDto == null
        ? null
        : grandPrixFromSummaryDto(
            featuredDto,
            sessions: data.featuredSession == null
                ? const <Session>[]
                : <Session>[sessionFromDto(data.featuredSession!)],
          );
    // The outer pipeline already applied the conflict rule against
    // resource_sync_metadata, so force the snapshot-table write (its own gate
    // only guards direct DAO callers).
    await _local.writeHomeSnapshot(
      homeSeason: season,
      featured: featured,
      featuredCircuit: featuredDto == null
          ? null
          : circuitFromSummaryDto(featuredDto),
      freshness: freshnessFromMeta(modified.meta),
      force: true,
    );
  }
}
