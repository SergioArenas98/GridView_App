import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/domain/entities/home_dashboard.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../sync/application/resource_refresh_status.dart';
import '../../sync/application/sync_providers.dart';
import '../../sync/domain/app_sync_state.dart';
import '../../sync/domain/sync_resource.dart';
import 'home_state.dart';

/// The Drift-backed Home dashboard stream — the **only** source of Home content.
///
/// Watching it composes what is already stored and can never produce a request:
/// no Grand Prix detail, no result document and no entity profile is fetched
/// because Home displays a summary of one.
final StreamProvider<HomeDashboardView?> homeDashboardProvider =
    StreamProvider<HomeDashboardView?>(
      (Ref ref) => ref.watch(homeRepositoryProvider).watchHomeDashboard(),
    );

/// Owns Home's *presentation* refresh status.
///
/// Startup and foreground refreshes belong to the single application-level
/// synchronization coordinator (ADR 0015), so this controller launches **none**
/// of its own: creating it, rebuilding the widget, receiving a Drift emission,
/// returning from a detail screen or switching bottom-navigation branch all
/// produce exactly zero requests. It mirrors the coordinator's per-resource
/// report, and exposes [refresh] for the user's explicit pull-to-refresh/retry.
class HomeController extends Notifier<HomeRefreshState> {
  @override
  HomeRefreshState build() {
    ref.listen<AppSyncState>(appSyncStateProvider, (
      AppSyncState? _,
      AppSyncState next,
    ) {
      state = _mirror(next, state);
    });
    return _mirror(ref.read(appSyncStateProvider), const HomeRefreshState());
  }

  /// The user's explicit refresh of the current-season core set.
  ///
  /// It goes through the approved manual entry point — the one implementation in
  /// the application — which forces eligibility for a single run while keeping
  /// conditional requests and persisted ETags. Repeated taps coalesce, and the
  /// returned future always completes after success, failure or cancellation, so
  /// a refresh indicator can never hang.
  ///
  /// Detail resources are never in scope: Home owns no Grand Prix, result,
  /// Driver, Team or Circuit synchronization.
  Future<void> refresh() async {
    if (state.home.inProgress) return;
    state = const HomeRefreshState(
      home: RefreshStatus.running,
      driverStandings: RefreshStatus.running,
      constructorStandings: RefreshStatus.running,
    );
    try {
      await refreshCurrentSeasonCore(ref);
    } finally {
      // The listener above normally publishes the terminal statuses; settle them
      // here too in case the run ended without emitting anything new.
      if (ref.mounted && state.home.inProgress) {
        state = _mirror(
          ref.read(appSyncStateProvider),
          const HomeRefreshState(),
        );
      }
    }
  }

  /// Projects an application-level state onto each resource Home renders.
  ///
  /// Matching is strictly per resource, so an unrelated Explore collection's
  /// failure is never Home's error, and one championship's failure never becomes
  /// the other's.
  static HomeRefreshState _mirror(AppSyncState sync, HomeRefreshState current) {
    RefreshStatus? statusOf(bool Function(SyncResource) matches) =>
        resourceRefreshStatus(sync, matches);

    return HomeRefreshState(
      home: statusOf((SyncResource r) => r is HomeSyncResource) ?? current.home,
      calendar:
          statusOf((SyncResource r) => r is CalendarSyncResource) ??
          current.calendar,
      driverStandings:
          statusOf((SyncResource r) => r is DriverStandingsSyncResource) ??
          current.driverStandings,
      constructorStandings:
          statusOf((SyncResource r) => r is ConstructorStandingsSyncResource) ??
          current.constructorStandings,
    );
  }
}

/// The transient refresh status of each resource Home renders, kept apart.
///
/// One resource's failure is never another's: the Home hero's status comes only
/// from `home:<season>`, the calendar-derived modules only from
/// `calendar:<season>`, and each championship only from its own standings key.
class HomeRefreshState {
  const HomeRefreshState({
    this.home = RefreshStatus.idle,
    this.calendar = RefreshStatus.idle,
    this.driverStandings = RefreshStatus.idle,
    this.constructorStandings = RefreshStatus.idle,
  });

  final RefreshStatus home;
  final RefreshStatus calendar;
  final RefreshStatus driverStandings;
  final RefreshStatus constructorStandings;

  /// Whether the manual core run is in flight. Cached content stays visible
  /// throughout; this only drives the progress affordance.
  bool get refreshing =>
      home.inProgress ||
      calendar.inProgress ||
      driverStandings.inProgress ||
      constructorStandings.inProgress;
}

final NotifierProvider<HomeController, HomeRefreshState>
homeControllerProvider = NotifierProvider<HomeController, HomeRefreshState>(
  HomeController.new,
);

/// The derived, typed Home presentation state.
final Provider<HomeState> homeStateProvider = Provider<HomeState>((Ref ref) {
  final AsyncValue<int?> resolvedSeason = ref.watch(currentSeasonProvider);
  final int? season = resolvedSeason.value;
  final AsyncValue<HomeDashboardView?> dashboard = ref.watch(
    homeDashboardProvider,
  );
  final HomeRefreshState status = ref.watch(homeControllerProvider);
  final AppSyncState sync = ref.watch(appSyncStateProvider);
  final DateTime now = ref.watch(clockProvider)();

  // Each module's provenance is read from its own canonical key. Bootstrap's
  // record is deliberately not consulted here: it materializes content but
  // contributes no ETag, provenance or freshness to any individual resource
  // (ADR 0014), so a bootstrap-only Home correctly shows no update time.
  ResourceSyncState? metadata(String? key) =>
      key == null ? null : ref.watch(resourceSyncStateProvider(key)).value;

  final HomeDashboardView? view = dashboard.value;
  final int? resultRound = view?.latestRaceResult == null
      ? null
      : view!.latestCompleted?.round;

  return computeHomeState(
    HomeStateInputs(
      season: season,
      seasonReady: resolvedSeason.hasValue,
      dashboard: view,
      dashboardReady: dashboard.hasValue,
      homeMetadata: metadata(season == null ? null : ResourceKey.home(season)),
      calendarMetadata: metadata(
        season == null ? null : ResourceKey.calendar(season),
      ),
      driverStandingsMetadata: metadata(
        season == null ? null : ResourceKey.driverStandings(season),
      ),
      constructorStandingsMetadata: metadata(
        season == null ? null : ResourceKey.constructorStandings(season),
      ),
      resultMetadata: metadata(
        season == null || resultRound == null
            ? null
            : ResourceKey.grandPrixResults(season, resultRound),
      ),
      refreshing: status.refreshing,
      // Only the Home resource's own failure can become a Home-level error. A
      // calendar or standings failure is scoped to the modules it derives.
      lastFailure: status.home.lastFailure,
      driverStandingsFailed: status.driverStandings.lastFailure != null,
      constructorStandingsFailed:
          status.constructorStandings.lastFailure != null,
      syncSettled: sync is! AppSyncIdle && sync is! AppSyncRunning,
      now: now,
    ),
  );
});
