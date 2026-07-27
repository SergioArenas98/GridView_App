import '../../data/remote/remote_cancellation.dart';
import '../entities/standing.dart';
import '../entities/standing_entry.dart';
import '../refresh_result.dart';

/// Domain-facing repository for driver and constructor championship standings.
/// The two collections synchronize independently and each replaces its season's
/// table atomically (never deleting the stable competitor identities).
///
/// Reads come in two shapes, both in the delivered order: the bare standings,
/// and the [DriverStandingEntry] / [ConstructorStandingEntry] read models that
/// join the competitor identity and season branding a championship table shows.
abstract interface class StandingsRepository {
  Stream<List<DriverStanding>> watchDriverStandings(int season);
  Stream<List<ConstructorStanding>> watchConstructorStandings(int season);
  Future<List<DriverStanding>> readDriverStandings(int season);
  Future<List<ConstructorStanding>> readConstructorStandings(int season);

  /// The drivers' table as presentation read models, in delivered order.
  Stream<List<DriverStandingEntry>> watchDriverStandingEntries(int season);

  /// The constructors' table as presentation read models, in delivered order.
  Stream<List<ConstructorStandingEntry>> watchConstructorStandingEntries(
    int season,
  );

  Future<List<DriverStandingEntry>> readDriverStandingEntries(int season);
  Future<List<ConstructorStandingEntry>> readConstructorStandingEntries(
    int season,
  );

  Future<RefreshResult> refreshDriverStandings(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
  Future<RefreshResult> refreshConstructorStandings(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
