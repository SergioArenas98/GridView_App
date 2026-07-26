import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/refresh_result.dart';
import '../../shared/domain/repositories/bootstrap_repository.dart';
import '../../shared/domain/repositories/calendar_repository.dart';
import '../../shared/domain/repositories/circuit_repository.dart';
import '../../shared/domain/repositories/constructor_repository.dart';
import '../../shared/domain/repositories/content_repository.dart';
import '../../shared/domain/repositories/driver_repository.dart';
import '../../shared/domain/repositories/grand_prix_repository.dart';
import '../../shared/domain/repositories/home_repository.dart';
import '../../shared/domain/repositories/result_repository.dart';
import '../../shared/domain/repositories/season_repository.dart';
import '../../shared/domain/repositories/standings_repository.dart';
import '../domain/sync_resource.dart';

/// The single typed registry mapping a [SyncResource] to the repository call
/// that refreshes it.
///
/// The application coordinator decides *what* and *when*; this dispatcher is the
/// only place that says *which repository method*. No refresh logic is
/// reimplemented here — conditional requests, ETag persistence, the conflict
/// rule, domain writes and per-key deduplication all stay inside the repository
/// each call lands in.
///
/// A [UnsupportedSyncResource] resolves to null: this build cannot dispatch that
/// key, so the run records a safe skipped outcome, leaves the metadata row alone
/// and carries on.
class ResourceRefreshDispatcher {
  const ResourceRefreshDispatcher({
    required this.bootstrap,
    required this.season,
    required this.home,
    required this.calendar,
    required this.standings,
    required this.drivers,
    required this.constructors,
    required this.circuits,
    required this.content,
    required this.grandPrix,
    required this.results,
  });

  final BootstrapRepository bootstrap;
  final SeasonRepository season;
  final HomeRepository home;
  final CalendarRepository calendar;
  final StandingsRepository standings;
  final DriverRepository drivers;
  final ConstructorRepository constructors;
  final CircuitRepository circuits;
  final ContentRepository content;
  final GrandPrixRepository grandPrix;
  final ResultRepository results;

  /// Refreshes [resource], or returns null when this build cannot dispatch it.
  ///
  /// [cancellation] is the run-level handle: cancelling it aborts every request
  /// still in flight and releases each repository's in-flight slot.
  Future<RefreshResult>? refresh(
    SyncResource resource, {
    RemoteCancellation? cancellation,
  }) {
    return switch (resource) {
      BootstrapSyncResource() => bootstrap.refreshBootstrap(
        cancellation: cancellation,
      ),
      CurrentSeasonSyncResource() => season.refreshCurrentSeason(
        cancellation: cancellation,
      ),
      SeasonMetadataSyncResource(:final int year) => season.refreshSeason(
        year,
        cancellation: cancellation,
      ),
      HomeSyncResource(:final int year) => home.refreshHome(
        season: year,
        cancellation: cancellation,
      ),
      CalendarSyncResource(:final int year) => calendar.refreshCalendar(
        year,
        cancellation: cancellation,
      ),
      DriverStandingsSyncResource(:final int year) =>
        standings.refreshDriverStandings(year, cancellation: cancellation),
      ConstructorStandingsSyncResource(:final int year) =>
        standings.refreshConstructorStandings(year, cancellation: cancellation),
      SeasonDriversSyncResource(:final int year) =>
        drivers.refreshSeasonDrivers(year, cancellation: cancellation),
      SeasonConstructorsSyncResource(:final int year) =>
        constructors.refreshSeasonConstructors(
          year,
          cancellation: cancellation,
        ),
      SeasonCircuitsSyncResource(:final int year) =>
        circuits.refreshSeasonCircuits(year, cancellation: cancellation),
      ContentManifestSyncResource() => content.refreshContentManifest(
        cancellation: cancellation,
      ),
      GrandPrixSyncResource(:final int year, :final int round) =>
        grandPrix.refreshGrandPrix(
          season: year,
          round: round,
          cancellation: cancellation,
        ),
      GrandPrixResultsSyncResource(:final int year, :final int round) =>
        results.refreshResults(
          season: year,
          round: round,
          cancellation: cancellation,
        ),
      DriverDetailSyncResource(:final String driverId, :final int year) =>
        drivers.refreshDriver(
          driverId: driverId,
          season: year,
          cancellation: cancellation,
        ),
      ConstructorDetailSyncResource(
        :final String constructorId,
        :final int year,
      ) =>
        constructors.refreshConstructor(
          constructorId: constructorId,
          season: year,
          cancellation: cancellation,
        ),
      CircuitDetailSyncResource(:final String circuitId, :final int year) =>
        circuits.refreshCircuit(
          circuitId: circuitId,
          season: year,
          cancellation: cancellation,
        ),
      UnsupportedSyncResource() => null,
    };
  }
}
