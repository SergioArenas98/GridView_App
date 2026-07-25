import '../entities/standing.dart';
import '../refresh_result.dart';

/// Domain-facing repository for driver and constructor championship standings.
/// The two collections synchronize independently and each replaces its season's
/// table atomically (never deleting the stable competitor identities).
abstract interface class StandingsRepository {
  Stream<List<DriverStanding>> watchDriverStandings(int season);
  Stream<List<ConstructorStanding>> watchConstructorStandings(int season);
  Future<List<DriverStanding>> readDriverStandings(int season);
  Future<List<ConstructorStanding>> readConstructorStandings(int season);

  Future<RefreshResult> refreshDriverStandings(
    int season, {
    bool forceRefresh = false,
  });
  Future<RefreshResult> refreshConstructorStandings(
    int season, {
    bool forceRefresh = false,
  });
}
