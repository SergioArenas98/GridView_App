// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/database/daos/calendar_dao.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/detail_views.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/circuit_repository.dart';
import '../mappers/competitor_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads circuits from the local database and refreshes the season circuits and
/// per-circuit detail via conditional remote reads.
///
/// Circuit identity is stable and shared across seasons, so a sync upserts
/// circuits (identity, physical facts, media) without ever deleting them — a
/// circuit may be referenced by another season's events. Season participation is
/// derived from the authoritative calendar/event data, not stored here.
class CircuitRepositoryImpl extends SyncedRepository
    implements CircuitRepository {
  CircuitRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required CalendarDao local,
  }) : _local = local;

  final CalendarDao _local;

  @override
  Stream<List<Circuit>> watchSeasonCircuits(int season) =>
      _local.watchCircuitsForSeason(season);

  @override
  Stream<CircuitDetailView?> watchCircuit(String circuitId) =>
      _local.watchCircuitDetail(circuitId);

  @override
  Future<List<Circuit>> readSeasonCircuits(int season) =>
      _local.circuitsForSeason(season);

  @override
  Future<CircuitDetailView?> readCircuit(String circuitId) =>
      _local.circuitDetail(circuitId);

  @override
  Future<RefreshResult> refreshSeasonCircuits(
    int season, {
    bool forceRefresh = false,
  }) {
    return refreshResource<List<CircuitDto>>(
      key: ResourceKey.circuits(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchSeasonCircuits(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<CircuitDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<CircuitDto>> m) => _local
          .upsertCircuits(m.data.map(circuitFromDto).toList(growable: false)),
      hasLocalData: () async {
        for (final Circuit c in await _local.circuitsForSeason(season)) {
          if (c.id.isNotEmpty) return true;
        }
        return false;
      },
      forceRefresh: forceRefresh,
    );
  }

  @override
  Future<RefreshResult> refreshCircuit({
    required String circuitId,
    required int season,
    bool forceRefresh = false,
  }) {
    return refreshResource<CircuitDetailDto>(
      key: ResourceKey.circuit(circuitId, season),
      scope: ResourceScope(season: season, entityId: circuitId),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchCircuit(
            circuitId: circuitId,
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<CircuitDetailDto> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<CircuitDetailDto> m) =>
          _local.upsertCircuits(<Circuit>[circuitFromDto(m.data.circuit)]),
      hasLocalData: () async => (await _local.countCircuit(circuitId)) > 0,
      forceRefresh: forceRefresh,
    );
  }
}
