import '../../data/remote/remote_cancellation.dart';
import '../entities/season.dart';
import '../refresh_result.dart';

/// Domain-facing repository for season identity: the current season and
/// per-season metadata. Reads come from the local database; a refresh performs a
/// conditional remote read and writes atomically.
abstract interface class SeasonRepository {
  Stream<Season?> watchCurrentSeason();
  Stream<Season?> watchSeason(int season);
  Future<Season?> readCurrentSeason();
  Future<Season?> readSeason(int season);

  Future<RefreshResult> refreshCurrentSeason({
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
  Future<RefreshResult> refreshSeason(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
