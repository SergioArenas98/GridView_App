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

/// The Drift-backed driver profile for one (season, driver).
///
/// `autoDispose` and keyed by both halves, so leaving the screen releases the
/// subscription and the same driver viewed in two seasons is two independent
/// streams.
final driverProfileProvider = StreamProvider.autoDispose
    .family<DriverProfile?, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final int? season = ref.watch(entityDetailSeasonProvider(scope)).value;
      if (season == null) return const Stream<DriverProfile?>.empty();
      return ref
          .watch(driverRepositoryProvider)
          .watchDriverProfile(season: season, driverId: scope.entityId);
    });

/// Owns the one on-demand refresh of `driver:<driverId>:<season>`.
///
/// Refreshing a driver detail never refreshes the drivers collection, the teams
/// or circuits collections, Standings, Calendar or Home.
class DriverDetailController extends EntityDetailController {
  DriverDetailController(super.scope);

  @override
  Future<RefreshResult> refreshDetail(
    int season,
    RemoteCancellation? cancellation,
  ) => ref
      .read(driverRepositoryProvider)
      .refreshDriver(
        driverId: scope.entityId,
        season: season,
        cancellation: cancellation,
      );
}

final driverDetailControllerProvider = NotifierProvider.autoDispose
    .family<DriverDetailController, EntityDetailStatus, EntityDetailScope>(
      DriverDetailController.new,
    );

/// The derived, typed Driver detail state.
///
/// Freshness and materialization come from **exactly**
/// `driver:<driverId>:<season>` — never from the drivers collection, never from
/// bootstrap, never from Standings.
final driverDetailStateProvider = Provider.autoDispose
    .family<EntityDetailState<DriverProfile>, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final AsyncValue<int?> resolved = ref.watch(
        entityDetailSeasonProvider(scope),
      );
      final int? season = resolved.value;
      final EntityDetailStatus status = ref.watch(
        driverDetailControllerProvider(scope),
      );
      final AsyncValue<DriverProfile?> profile = ref.watch(
        driverProfileProvider(scope),
      );
      final AsyncValue<ResourceSyncState?> metadata = season == null
          ? const AsyncValue<ResourceSyncState?>.loading()
          : ref.watch(
              resourceSyncStateProvider(
                ResourceKey.driver(scope.entityId, season),
              ),
            );

      return computeEntityDetailState<DriverProfile>(
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
