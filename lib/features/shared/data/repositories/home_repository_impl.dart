// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/database/daos/vertical_slice_dao.dart';
import '../../../../core/database/entity_validation.dart';
import '../../domain/entities/grand_prix.dart';
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

/// Reads the Home view from the local database and refreshes it via a
/// conditional remote read, writing the snapshot atomically through the shared
/// pipeline. A Home snapshot with no featured event cannot drive the view, so it
/// is rejected as a typed invalid-response failure that preserves the cache.
class HomeRepositoryImpl extends SyncedRepository implements HomeRepository {
  HomeRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required VerticalSliceDao local,
  }) : _local = local;

  final VerticalSliceDao _local;

  @override
  Stream<HomeView?> watchHome() => _local.watchHome();

  @override
  Future<HomeView?> readHome() => _local.watchHome().first;

  @override
  Future<RefreshResult> refreshHome({
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<HomeDataDto>(
      key: ResourceKey.home(),
      scope: ResourceScope.none,
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchHome(etag: etag, cancellation: cancellation),
      metaOf: (RemoteModified<HomeDataDto> m) => RemoteSnapshotMeta.fromMeta(
        m.meta,
        etag: m.etag,
        serverStale: m.data.freshness.stale,
      ),
      writeDomain: _writeHome,
      hasLocalRepresentation: entityRepresentation(
        () async => (await _local.countHomeSnapshot()) > 0,
      ),
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }

  Future<void> _writeHome(RemoteModified<HomeDataDto> modified) async {
    final HomeDataDto data = modified.data;
    final GrandPrixSummaryDto? featuredDto = data.featuredEvent;
    if (featuredDto == null) {
      // A Home snapshot with no featured event cannot drive the view. Thrown
      // inside the transaction so it rolls back; the pipeline maps this to a
      // typed invalidResponse failure that preserves the cache.
      throw const InvalidEntityException(
        'Home snapshot has no featured event.',
      );
    }
    final List<Session> sessions = data.featuredSession == null
        ? const <Session>[]
        : <Session>[sessionFromDto(data.featuredSession!)];
    final GrandPrix featured = grandPrixFromSummaryDto(
      featuredDto,
      sessions: sessions,
    );
    // The outer pipeline already applied the conflict rule against
    // resource_sync_metadata, so force the snapshot-table write (its own gate
    // only guards direct DAO callers).
    await _local.writeHomeSnapshot(
      featured: featured,
      featuredCircuit: circuitFromSummaryDto(featuredDto),
      freshness: freshnessFromMeta(modified.meta),
      force: true,
    );
  }
}
