import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/refresh_result.dart';
import '../../sync/application/resource_refresh_status.dart';
import '../../sync/application/sync_providers.dart';
import '../../sync/domain/app_sync_state.dart';
import '../../sync/domain/sync_resource.dart';
import 'explore_state.dart';

/// The Drift-backed drivers collection for one season, as presentation cards.
///
/// Keyed by season so a season transition switches to a different resource
/// rather than mutating one: the previous season's rows stay in Drift, simply
/// unwatched.
final exploreDriverCardsProvider =
    StreamProvider.family<List<SeasonDriverCard>, int>(
      (Ref ref, int season) =>
          ref.watch(driverRepositoryProvider).watchSeasonDriverCards(season),
    );

/// The Drift-backed teams collection for one season. An independent resource
/// with independent metadata — never derived from the drivers collection.
final exploreTeamCardsProvider =
    StreamProvider.family<List<SeasonTeamCard>, int>(
      (Ref ref, int season) =>
          ref.watch(constructorRepositoryProvider).watchSeasonTeamCards(season),
    );

/// The Drift-backed circuits collection for one season, in calendar order.
final exploreCircuitCardsProvider =
    StreamProvider.family<List<SeasonCircuitCard>, int>(
      (Ref ref, int season) =>
          ref.watch(circuitRepositoryProvider).watchSeasonCircuitCards(season),
    );

/// The three collections' transient refresh statuses, kept apart.
///
/// One collection's failure is never another's: the drivers status is only ever
/// derived from `drivers:<season>`, the teams status only from
/// `constructors:<season>` and the circuits status only from
/// `circuits:<season>`.
@immutable
class ExploreRefreshState {
  const ExploreRefreshState({
    this.drivers = RefreshStatus.idle,
    this.teams = RefreshStatus.idle,
    this.circuits = RefreshStatus.idle,
  });

  final RefreshStatus drivers;
  final RefreshStatus teams;
  final RefreshStatus circuits;

  RefreshStatus of(ExploreCategory category) => switch (category) {
    ExploreCategory.drivers => drivers,
    ExploreCategory.teams => teams,
    ExploreCategory.circuits => circuits,
  };

  ExploreRefreshState withStatus(
    ExploreCategory category,
    RefreshStatus status,
  ) => switch (category) {
    ExploreCategory.drivers => ExploreRefreshState(
      drivers: status,
      teams: teams,
      circuits: circuits,
    ),
    ExploreCategory.teams => ExploreRefreshState(
      drivers: drivers,
      teams: status,
      circuits: circuits,
    ),
    ExploreCategory.circuits => ExploreRefreshState(
      drivers: drivers,
      teams: teams,
      circuits: status,
    ),
  };
}

/// Owns the Explore screen's *presentation* refresh status — never its content.
///
/// It deliberately starts **no** refresh when it is created, none when a
/// category is selected and none when a widget rebuilds: startup and foreground
/// refresh of the current-season core set belong to the single application-level
/// coordinator (ADR 0015), and the three Explore collections are part of that
/// core set. What this does instead is mirror the coordinator's report for the
/// three exact collection resources, and expose [retry] for the user's explicit
/// recovery action.
class ExploreController extends Notifier<ExploreRefreshState> {
  int? _season;
  RemoteCancellation? _cancellation;

  @override
  ExploreRefreshState build() {
    _season = ref.watch(currentSeasonProvider).value;

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
      const ExploreRefreshState(),
      _season,
    );
  }

  /// The user-triggered focused recovery for exactly one collection.
  ///
  /// This is feature recovery, not a recreation of startup or foreground
  /// synchronization policy. It issues **one** conditional request for
  /// `<category>:<season>` — retaining that resource's persisted ETag — and
  /// touches nothing else: not Calendar, not Home, not Standings and not the
  /// other two Explore collections.
  ///
  /// Repeated taps collapse (the running status is claimed before the first
  /// await, and the repository's per-resource deduplication catches the rest).
  /// The returned future always completes — after success, failure or
  /// cancellation — so an indicator can never hang. Cached cards stay visible
  /// throughout.
  Future<void> retry(ExploreCategory category) async {
    if (state.of(category).inProgress) return;
    // Read the season at retry time rather than relying on a build-time
    // snapshot, so a retry can never target a season the screen has moved on
    // from — and never runs at all without one.
    final int? season = ref.read(currentSeasonProvider).value ?? _season;
    if (season == null) return;
    state = state.withStatus(category, RefreshStatus.running);

    final RefreshResult result = switch (category) {
      ExploreCategory.drivers =>
        await ref
            .read(driverRepositoryProvider)
            .refreshSeasonDrivers(season, cancellation: _cancellation),
      ExploreCategory.teams =>
        await ref
            .read(constructorRepositoryProvider)
            .refreshSeasonConstructors(season, cancellation: _cancellation),
      ExploreCategory.circuits =>
        await ref
            .read(circuitRepositoryProvider)
            .refreshSeasonCircuits(season, cancellation: _cancellation),
    };
    if (!ref.mounted) return;
    state = state.withStatus(category, _statusOf(result));
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

  /// Maps an application-level state onto the three collection statuses.
  ///
  /// Matching is strictly scoped to `drivers:<season>`, `constructors:<season>`
  /// and `circuits:<season>`: another season's collection, another category, or
  /// any unrelated core resource (Home, Calendar, Standings, …) never becomes
  /// this collection's error.
  static ExploreRefreshState _mirror(
    AppSyncState sync,
    ExploreRefreshState current,
    int? season,
  ) {
    if (season == null) {
      return sync is AppSyncRunning
          ? const ExploreRefreshState(
              drivers: RefreshStatus.running,
              teams: RefreshStatus.running,
              circuits: RefreshStatus.running,
            )
          : current;
    }
    return ExploreRefreshState(
      drivers:
          resourceRefreshStatus(
            sync,
            (SyncResource r) =>
                r is SeasonDriversSyncResource && r.year == season,
          ) ??
          current.drivers,
      teams:
          resourceRefreshStatus(
            sync,
            (SyncResource r) =>
                r is SeasonConstructorsSyncResource && r.year == season,
          ) ??
          current.teams,
      circuits:
          resourceRefreshStatus(
            sync,
            (SyncResource r) =>
                r is SeasonCircuitsSyncResource && r.year == season,
          ) ??
          current.circuits,
    );
  }
}

final NotifierProvider<ExploreController, ExploreRefreshState>
exploreControllerProvider =
    NotifierProvider<ExploreController, ExploreRefreshState>(
      ExploreController.new,
    );

/// The derived, typed Explore presentation state for one selected category.
///
/// All three collections are derived independently from their own local stream,
/// their own persisted metadata and their own refresh status; the selected
/// category only decides which one is shown, never how any of them is computed.
final exploreStateProvider =
    Provider.family<ExploreScreenState, ExploreCategory>((
      Ref ref,
      ExploreCategory selected,
    ) {
      final AsyncValue<int?> resolved = ref.watch(currentSeasonProvider);
      final int? season = resolved.value;
      final ExploreRefreshState status = ref.watch(exploreControllerProvider);
      final AppSyncState sync = ref.watch(appSyncStateProvider);
      final DateTime now = ref.watch(clockProvider)();

      AsyncValue<List<SeasonDriverCard>>? drivers;
      AsyncValue<List<SeasonTeamCard>>? teams;
      AsyncValue<List<SeasonCircuitCard>>? circuits;
      AsyncValue<ResourceSyncState?>? driversMeta;
      AsyncValue<ResourceSyncState?>? teamsMeta;
      AsyncValue<ResourceSyncState?>? circuitsMeta;
      if (season != null) {
        drivers = ref.watch(exploreDriverCardsProvider(season));
        teams = ref.watch(exploreTeamCardsProvider(season));
        circuits = ref.watch(exploreCircuitCardsProvider(season));
        driversMeta = ref.watch(
          resourceSyncStateProvider(ResourceKey.drivers(season)),
        );
        teamsMeta = ref.watch(
          resourceSyncStateProvider(ResourceKey.constructors(season)),
        );
        circuitsMeta = ref.watch(
          resourceSyncStateProvider(ResourceKey.circuits(season)),
        );
      }
      // Bootstrap's own record. It is read for one thing only — whether an
      // accepted bootstrap materialized *this* season's collections — and
      // contributes no ETag, provenance or freshness to any of them.
      final AsyncValue<ResourceSyncState?> bootstrap = ref.watch(
        resourceSyncStateProvider(ResourceKey.bootstrap()),
      );
      final bool settled = sync is! AppSyncIdle && sync is! AppSyncRunning;

      return ExploreScreenState(
        selected: selected,
        season: season,
        drivers: computeExploreCollectionState<SeasonDriverCard>(
          season: season,
          seasonReady: resolved.hasValue,
          cards: drivers?.value,
          metadata: driversMeta?.value,
          metadataReady: driversMeta?.hasValue ?? false,
          bootstrapMetadata: bootstrap.value,
          bootstrapMetadataReady: bootstrap.hasValue,
          refreshing: status.drivers.inProgress,
          lastFailure: status.drivers.lastFailure,
          syncSettled: settled,
          now: now,
        ),
        teams: computeExploreCollectionState<SeasonTeamCard>(
          season: season,
          seasonReady: resolved.hasValue,
          cards: teams?.value,
          metadata: teamsMeta?.value,
          metadataReady: teamsMeta?.hasValue ?? false,
          bootstrapMetadata: bootstrap.value,
          bootstrapMetadataReady: bootstrap.hasValue,
          refreshing: status.teams.inProgress,
          lastFailure: status.teams.lastFailure,
          syncSettled: settled,
          now: now,
        ),
        circuits: computeExploreCollectionState<SeasonCircuitCard>(
          season: season,
          seasonReady: resolved.hasValue,
          cards: circuits?.value,
          metadata: circuitsMeta?.value,
          metadataReady: circuitsMeta?.hasValue ?? false,
          bootstrapMetadata: bootstrap.value,
          bootstrapMetadataReady: bootstrap.hasValue,
          refreshing: status.circuits.inProgress,
          lastFailure: status.circuits.lastFailure,
          syncSettled: settled,
          now: now,
        ),
      );
    });
