import '../../data/remote/remote_cancellation.dart';
import '../entities/grand_prix_view.dart';
import '../refresh_result.dart';

/// Domain-facing repository for Grand Prix detail (by season and round).
///
/// The UI reads the Drift-backed [watchGrandPrix] stream; a refresh performs a
/// conditional remote read and writes the detail (event, ordered sessions,
/// circuit relation and media) atomically. A failed refresh preserves the cache.
abstract interface class GrandPrixRepository {
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  });
  Future<GrandPrixDetailView?> readGrandPrix({
    required int season,
    required int round,
  });
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
