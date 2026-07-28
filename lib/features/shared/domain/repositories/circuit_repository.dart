import '../../data/remote/remote_cancellation.dart';
import '../entities/circuit.dart';
import '../entities/detail_views.dart';
import '../entities/entity_profile.dart';
import '../entities/season_card.dart';
import '../refresh_result.dart';

/// Domain-facing repository for circuits: the circuits used in a season and
/// per-circuit detail (identity, physical facts, media and related events).
/// Season participation is derived from the authoritative calendar/event data.
abstract interface class CircuitRepository {
  Stream<List<Circuit>> watchSeasonCircuits(int season);
  Stream<CircuitDetailView?> watchCircuit(String circuitId);
  Future<List<Circuit>> readSeasonCircuits(int season);
  Future<CircuitDetailView?> readCircuit(String circuitId);

  /// The season's circuits as presentation read models, in the season's
  /// authoritative calendar order, each with its season-specific related event.
  Stream<List<SeasonCircuitCard>> watchSeasonCircuitCards(int season);
  Future<List<SeasonCircuitCard>> readSeasonCircuitCards(int season);

  /// Circuit detail for one exact season, or `null` when no real identity exists
  /// locally. Circuit identity is stable; only the related event is
  /// season-specific.
  Stream<CircuitProfile?> watchCircuitProfile({
    required int season,
    required String circuitId,
  });
  Future<CircuitProfile?> readCircuitProfile({
    required int season,
    required String circuitId,
  });

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
