import '../../data/remote/remote_cancellation.dart';
import '../entities/circuit.dart';
import '../entities/detail_views.dart';
import '../refresh_result.dart';

/// Domain-facing repository for circuits: the circuits used in a season and
/// per-circuit detail (identity, physical facts, media and related events).
/// Season participation is derived from the authoritative calendar/event data.
abstract interface class CircuitRepository {
  Stream<List<Circuit>> watchSeasonCircuits(int season);
  Stream<CircuitDetailView?> watchCircuit(String circuitId);
  Future<List<Circuit>> readSeasonCircuits(int season);
  Future<CircuitDetailView?> readCircuit(String circuitId);

  Future<RefreshResult> refreshSeasonCircuits(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
  Future<RefreshResult> refreshCircuit({
    required String circuitId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
