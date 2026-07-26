import '../../data/remote/remote_cancellation.dart';
import '../entities/race_result.dart';
import '../refresh_result.dart';

/// Domain-facing repository for race/sprint result documents of a Grand Prix
/// (by season and round). Sprint and race documents for the same event coexist;
/// a refresh replaces only the delivered document's classification atomically.
abstract interface class ResultRepository {
  Stream<List<RaceResult>> watchResults({
    required int season,
    required int round,
  });
  Future<List<RaceResult>> readResults({
    required int season,
    required int round,
  });
  Future<RefreshResult> refreshResults({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
