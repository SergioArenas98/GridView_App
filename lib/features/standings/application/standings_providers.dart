import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/standing_entry.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/refresh_result.dart';
import '../../sync/application/resource_refresh_status.dart';
import '../../sync/application/sync_providers.dart';
import '../../sync/domain/app_sync_state.dart';
import '../../sync/domain/sync_resource.dart';
import 'standings_state.dart';
import 'standings_ui_state.dart';

/// What a Standings screen instance is bound to by its route.
///
/// A `null` [routeSeason] is the season-agnostic branch root (`/standings`),
/// which resolves the locally current season; a value is an explicit,
/// already-validated route season, rendered exactly and never substituted by the
/// current year.
///
/// [routeChampionship] is the championship an explicit route encodes. At the
/// branch root it is `null` and the session selection decides, so the root stays
/// season- **and** championship-agnostic.
@immutable
class StandingsScope {
  const StandingsScope({this.routeSeason, this.routeChampionship});

  const StandingsScope.root() : routeSeason = null, routeChampionship = null;

  final int? routeSeason;
  final StandingsChampionship? routeChampionship;

  bool get isRoot => routeSeason == null;

  @override
  bool operator ==(Object other) =>
      other is StandingsScope &&
      other.routeSeason == routeSeason &&
      other.routeChampionship == routeChampionship;

  @override
  int get hashCode => Object.hash(routeSeason, routeChampionship);
}

/// The season a scope actually renders.
///
/// At the branch root this follows [currentSeasonProvider], so a season
/// transition re-points the screen at the new season's resources without a route
/// change and without a hardcoded year. An explicit route resolves immediately
/// to its own validated season.
final standingsSeasonProvider =
    Provider.family<AsyncValue<int?>, StandingsScope>((
      Ref ref,
      StandingsScope scope,
    ) {
      final int? routeSeason = scope.routeSeason;
      if (routeSeason != null) return AsyncValue<int?>.data(routeSeason);
      return ref.watch(currentSeasonProvider);
    });

/// The Drift-backed drivers' standings stream for one season.
///
/// Keyed by season so a season transition switches to a different resource
/// rather than mutating one: the previous season's rows stay in Drift, simply
/// unwatched.
final driverStandingsCacheProvider =
    StreamProvider.family<List<DriverStandingEntry>, int>(
      (Ref ref, int season) => ref
          .watch(standingsRepositoryProvider)
          .watchDriverStandingEntries(season),
    );

/// The Drift-backed constructors' standings stream for one season. A separate
/// resource with separate metadata — never derived from the drivers' table.
final constructorStandingsCacheProvider =
    StreamProvider.family<List<ConstructorStandingEntry>, int>(
      (Ref ref, int season) => ref
          .watch(standingsRepositoryProvider)
          .watchConstructorStandingEntries(season),
    );

/// The two championships' transient refresh statuses, kept apart.
///
/// One table's failure is never the other's: the drivers' status is only ever
/// derived from `standings:drivers:<season>` and the constructors' status only
/// from `standings:constructors:<season>`.
@immutable
class StandingsRefreshState {
  const StandingsRefreshState({
    this.drivers = RefreshStatus.idle,
    this.constructors = RefreshStatus.idle,
  });

  final RefreshStatus drivers;
  final RefreshStatus constructors;

  RefreshStatus of(StandingsChampionship championship) =>
      switch (championship) {
        StandingsChampionship.drivers => drivers,
        StandingsChampionship.constructors => constructors,
      };

  StandingsRefreshState copyWith({
    RefreshStatus? drivers,
    RefreshStatus? constructors,
  }) => StandingsRefreshState(
    drivers: drivers ?? this.drivers,
    constructors: constructors ?? this.constructors,
  );

  StandingsRefreshState withStatus(
    StandingsChampionship championship,
    RefreshStatus status,
  ) => switch (championship) {
    StandingsChampionship.drivers => copyWith(drivers: status),
    StandingsChampionship.constructors => copyWith(constructors: status),
  };
}

/// Owns the Standings screen's *presentation* refresh status — never its
/// content.
///
/// It deliberately starts **no** refresh when it is created, and none when the
/// selector changes: startup and foreground refresh of the current-season core
/// set belong to the single application-level coordinator (ADR 0015), so
/// building or rebuilding this screen can never produce a request. What it does
/// instead is mirror that coordinator's report for the two exact standings
/// resources, and expose [refresh] for the user's pull-to-refresh / retry.
class StandingsController extends Notifier<StandingsRefreshState> {
  StandingsController(this.scope);

  final StandingsScope scope;

  int? _season;
  RemoteCancellation? _cancellation;

  @override
  StandingsRefreshState build() {
    _season = ref.watch(standingsSeasonProvider(scope)).value;

    final RemoteCancellation cancellation = RemoteCancellation();
    _cancellation = cancellation;
    ref.onDispose(cancellation.cancel);

    ref.listen<AppSyncState>(appSyncStateProvider, (
      AppSyncState? _,
      AppSyncState next,
    ) {
      state = _mirror(next, state, _season);
    });
    return _mirror(
      ref.read(appSyncStateProvider),
      const StandingsRefreshState(),
      _season,
    );
  }

  /// The user-initiated refresh for the currently [selected] table.
  ///
  /// Current season (branch root, or an explicit route whose season *is* the
  /// locally current one): the Phase 6B2 manual core run, which forces
  /// eligibility for one run while keeping conditional requests and persisted
  /// ETags, and refreshes both standings resources. Its outcome is then
  /// interpreted per resource.
  ///
  /// A historical explicit route: exactly one focused request for the selected
  /// championship's own `standings:*:<routeSeason>` resource — conditional, with
  /// its persisted ETag, and never for the other championship or for any
  /// current-season key. The comparison reads the locally stored current season
  /// (no request), so a historical route can never send the coordinator after
  /// the current season's keys.
  ///
  /// The returned future always completes — after success, failure or
  /// cancellation — so a refresh indicator can never hang.
  Future<void> refresh(StandingsChampionship selected) async {
    if (state.of(selected).inProgress) return;
    if (scope.isRoot) {
      // The branch root is always the current-season core set — even when no
      // season has been resolved yet, which is exactly what the coordinator is
      // there to fix.
      await _coreRefresh(selected);
      return;
    }
    final int season = scope.routeSeason!;
    // Claimed before the first await so a duplicate tap is still collapsed.
    state = state.withStatus(selected, RefreshStatus.running);
    final int? current = await ref.read(currentSeasonResolverProvider)();
    if (!ref.mounted) return;
    if (current == season) {
      await _coreRefresh(selected);
      return;
    }
    await _exactRefresh(selected, season);
  }

  /// The current-season core run. Both standings resources are in scope, so both
  /// show progress; the report is then mirrored per resource.
  Future<void> _coreRefresh(StandingsChampionship selected) async {
    state = const StandingsRefreshState(
      drivers: RefreshStatus.running,
      constructors: RefreshStatus.running,
    );
    try {
      await refreshCurrentSeasonCore(ref);
    } finally {
      // The listener above normally publishes the terminal statuses; settle
      // them here too in case the run ended without emitting anything new.
      if (ref.mounted && state.of(selected).inProgress) {
        state = _mirror(
          ref.read(appSyncStateProvider),
          const StandingsRefreshState(),
          _season,
        );
      }
    }
  }

  /// One focused refresh of exactly the selected championship's resource for
  /// [season]. Nothing else is touched. The running status is already claimed by
  /// the caller.
  Future<void> _exactRefresh(StandingsChampionship selected, int season) async {
    final RefreshResult result = switch (selected) {
      StandingsChampionship.drivers =>
        await ref
            .read(standingsRepositoryProvider)
            .refreshDriverStandings(season, cancellation: _cancellation),
      StandingsChampionship.constructors =>
        await ref
            .read(standingsRepositoryProvider)
            .refreshConstructorStandings(season, cancellation: _cancellation),
    };
    if (!ref.mounted) return;
    state = state.withStatus(selected, _statusOf(result));
  }

  /// A cancelled request is not a user-facing failure: it clears the transient
  /// refresh state instead of surfacing an error.
  static RefreshStatus _statusOf(RefreshResult result) => switch (result) {
    RefreshSuccess() => RefreshStatus.idle,
    RefreshFailure(:final ApiFailure failure) =>
      failure.kind == ApiFailureKind.cancelled
          ? RefreshStatus.idle
          : RefreshStatus.idle.failed(failure),
  };

  /// Maps an application-level state onto both standings statuses.
  ///
  /// Matching is strictly scoped to `standings:drivers:<season>` and
  /// `standings:constructors:<season>`: another season's standings, the other
  /// championship, or any unrelated core resource (Home, Calendar, …) never
  /// becomes this table's error.
  static StandingsRefreshState _mirror(
    AppSyncState sync,
    StandingsRefreshState current,
    int? season,
  ) {
    if (season == null) {
      final bool running = sync is AppSyncRunning;
      return running
          ? const StandingsRefreshState(
              drivers: RefreshStatus.running,
              constructors: RefreshStatus.running,
            )
          : current;
    }
    final RefreshStatus? drivers = resourceRefreshStatus(
      sync,
      (SyncResource resource) =>
          resource is DriverStandingsSyncResource && resource.year == season,
    );
    final RefreshStatus? constructors = resourceRefreshStatus(
      sync,
      (SyncResource resource) =>
          resource is ConstructorStandingsSyncResource &&
          resource.year == season,
    );
    return StandingsRefreshState(
      drivers: drivers ?? current.drivers,
      constructors: constructors ?? current.constructors,
    );
  }
}

final standingsControllerProvider =
    NotifierProvider.family<
      StandingsController,
      StandingsRefreshState,
      StandingsScope
    >(StandingsController.new);

/// The derived, typed Standings presentation state for one scope.
///
/// Both tables are derived independently from their own local stream, their own
/// persisted metadata and their own refresh status; the selected championship
/// only decides which one is shown, never how either is computed.
final standingsStateProvider =
    Provider.family<StandingsScreenState, StandingsScope>((
      Ref ref,
      StandingsScope scope,
    ) {
      final AsyncValue<int?> resolved = ref.watch(
        standingsSeasonProvider(scope),
      );
      final int? season = resolved.value;
      final StandingsRefreshState status = ref.watch(
        standingsControllerProvider(scope),
      );
      final AppSyncState sync = ref.watch(appSyncStateProvider);
      final DateTime now = ref.watch(clockProvider)();
      // An explicit route selects the championship it encodes; the branch root
      // follows the session selection (Drivers on the first visit).
      final StandingsChampionship selected =
          scope.routeChampionship ??
          ref.watch(
            standingsUiStateProvider.select(
              (StandingsUiState ui) => ui.selected,
            ),
          );

      AsyncValue<List<DriverStandingEntry>>? drivers;
      AsyncValue<List<ConstructorStandingEntry>>? constructors;
      AsyncValue<ResourceSyncState?>? driversMeta;
      AsyncValue<ResourceSyncState?>? constructorsMeta;
      if (season != null) {
        drivers = ref.watch(driverStandingsCacheProvider(season));
        constructors = ref.watch(constructorStandingsCacheProvider(season));
        driversMeta = ref.watch(
          resourceSyncStateProvider(ResourceKey.driverStandings(season)),
        );
        constructorsMeta = ref.watch(
          resourceSyncStateProvider(ResourceKey.constructorStandings(season)),
        );
      }
      // Bootstrap's own record. It is read for one thing only — whether an
      // accepted bootstrap materialized *this* season's collections — and
      // contributes no ETag, provenance or freshness to either resource.
      final AsyncValue<ResourceSyncState?> bootstrap = ref.watch(
        resourceSyncStateProvider(ResourceKey.bootstrap()),
      );
      final bool settled = sync is! AppSyncIdle && sync is! AppSyncRunning;

      return StandingsScreenState(
        selected: selected,
        season: season,
        drivers: computeStandingsTableState<DriverStandingEntry>(
          season: season,
          seasonReady: resolved.hasValue,
          rows: drivers?.value,
          provisionalOf: (List<DriverStandingEntry> rows) =>
              rows.map((DriverStandingEntry r) => r.provisional),
          metadata: driversMeta?.value,
          metadataReady: driversMeta?.hasValue ?? false,
          bootstrapMetadata: bootstrap.value,
          bootstrapMetadataReady: bootstrap.hasValue,
          refreshing: status.drivers.inProgress,
          lastFailure: status.drivers.lastFailure,
          syncSettled: settled,
          now: now,
        ),
        constructors: computeStandingsTableState<ConstructorStandingEntry>(
          season: season,
          seasonReady: resolved.hasValue,
          rows: constructors?.value,
          provisionalOf: (List<ConstructorStandingEntry> rows) =>
              rows.map((ConstructorStandingEntry r) => r.provisional),
          metadata: constructorsMeta?.value,
          metadataReady: constructorsMeta?.hasValue ?? false,
          bootstrapMetadata: bootstrap.value,
          bootstrapMetadataReady: bootstrap.hasValue,
          refreshing: status.constructors.inProgress,
          lastFailure: status.constructors.lastFailure,
          syncSettled: settled,
          now: now,
        ),
      );
    });
