import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/application/entity_detail_controller.dart';
import '../../shared/application/entity_detail_scope.dart';
import '../../shared/application/entity_detail_state.dart';
import '../../shared/application/providers.dart';
import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/entities/entity_profile.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/refresh_result.dart';

/// The Drift-backed team profile for one (season, constructor).
final teamProfileProvider = StreamProvider.autoDispose
    .family<TeamProfile?, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final int? season = ref.watch(entityDetailSeasonProvider(scope)).value;
      if (season == null) return const Stream<TeamProfile?>.empty();
      return ref
          .watch(constructorRepositoryProvider)
          .watchTeamProfile(season: season, constructorId: scope.entityId);
    });

/// Owns the one on-demand refresh of `constructor:<constructorId>:<season>`.
///
/// Refreshing a team detail never refreshes the teams collection, the drivers or
/// circuits collections, Standings, Calendar or Home.
class TeamDetailController extends EntityDetailController {
  TeamDetailController(super.scope);

  @override
  Future<RefreshResult> refreshDetail(
    int season,
    RemoteCancellation? cancellation,
  ) => ref
      .read(constructorRepositoryProvider)
      .refreshConstructor(
        constructorId: scope.entityId,
        season: season,
        cancellation: cancellation,
      );
}

final teamDetailControllerProvider = NotifierProvider.autoDispose
    .family<TeamDetailController, EntityDetailStatus, EntityDetailScope>(
      TeamDetailController.new,
    );

/// The derived, typed Team detail state.
///
/// Freshness and materialization come from **exactly**
/// `constructor:<constructorId>:<season>` — never from the teams collection,
/// never from bootstrap, never from a driver's detail.
final teamDetailStateProvider = Provider.autoDispose
    .family<EntityDetailState<TeamProfile>, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final AsyncValue<int?> resolved = ref.watch(
        entityDetailSeasonProvider(scope),
      );
      final int? season = resolved.value;
      final EntityDetailStatus status = ref.watch(
        teamDetailControllerProvider(scope),
      );
      final AsyncValue<TeamProfile?> profile = ref.watch(
        teamProfileProvider(scope),
      );
      final AsyncValue<ResourceSyncState?> metadata = season == null
          ? const AsyncValue<ResourceSyncState?>.loading()
          : ref.watch(
              resourceSyncStateProvider(
                ResourceKey.constructor(scope.entityId, season),
              ),
            );

      return computeEntityDetailState<TeamProfile>(
        season: season,
        seasonReady: resolved.hasValue,
        profile: profile.value,
        profileReady: profile.hasValue,
        metadata: metadata.value,
        metadataReady: metadata.hasValue,
        refreshing: status.refresh.inProgress,
        lastFailure: status.refresh.lastFailure,
        notFound: status.notFound,
        now: ref.watch(clockProvider)(),
      );
    });
