import '../../data/remote/remote_cancellation.dart';
import '../entities/detail_views.dart';
import '../refresh_result.dart';

/// Domain-facing repository for drivers: the season roster and per-driver detail
/// (identity, current-season entry and standing, composed locally).
///
/// The season roster owns the season's participation entries; driver detail owns
/// the stable identity (biography and media). Both preserve unrelated seasons.
abstract interface class DriverRepository {
  Stream<List<SeasonDriver>> watchSeasonDrivers(int season);
  Stream<DriverDetailView?> watchDriver({
    required int season,
    required String driverId,
  });
  Future<List<SeasonDriver>> readSeasonDrivers(int season);
  Future<DriverDetailView?> readDriver({
    required int season,
    required String driverId,
  });

  Future<RefreshResult> refreshSeasonDrivers(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
  Future<RefreshResult> refreshDriver({
    required String driverId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
