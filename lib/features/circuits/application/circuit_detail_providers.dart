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

/// The Drift-backed circuit profile for one (season, circuit).
///
/// Circuit identity is stable across seasons; only the related Grand Prix is
/// season-specific, so the season half of the key selects the right event and
/// the right metadata — never a different circuit.
final circuitProfileProvider = StreamProvider.autoDispose
    .family<CircuitProfile?, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final int? season = ref.watch(entityDetailSeasonProvider(scope)).value;
      if (season == null) return const Stream<CircuitProfile?>.empty();
      return ref
          .watch(circuitRepositoryProvider)
          .watchCircuitProfile(season: season, circuitId: scope.entityId);
    });

/// Owns the one on-demand refresh of `circuit:<circuitId>:<season>`.
///
/// Refreshing a circuit detail never refreshes the circuits collection, the
/// Calendar, Home or any other resource.
class CircuitDetailController extends EntityDetailController {
  CircuitDetailController(super.scope);

  @override
  Future<RefreshResult> refreshDetail(
    int season,
    RemoteCancellation? cancellation,
  ) => ref
      .read(circuitRepositoryProvider)
      .refreshCircuit(
        circuitId: scope.entityId,
        season: season,
        cancellation: cancellation,
      );
}

final circuitDetailControllerProvider = NotifierProvider.autoDispose
    .family<CircuitDetailController, EntityDetailStatus, EntityDetailScope>(
      CircuitDetailController.new,
    );

/// The derived, typed Circuit detail state.
///
/// Freshness and materialization come from **exactly**
/// `circuit:<circuitId>:<season>` — never from the circuits collection, never
/// from the Calendar, never from a Grand Prix.
final circuitDetailStateProvider = Provider.autoDispose
    .family<EntityDetailState<CircuitProfile>, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final AsyncValue<int?> resolved = ref.watch(
        entityDetailSeasonProvider(scope),
      );
      final int? season = resolved.value;
      final EntityDetailStatus status = ref.watch(
        circuitDetailControllerProvider(scope),
      );
      final AsyncValue<CircuitProfile?> profile = ref.watch(
        circuitProfileProvider(scope),
      );
      final AsyncValue<ResourceSyncState?> metadata = season == null
          ? const AsyncValue<ResourceSyncState?>.loading()
          : ref.watch(
              resourceSyncStateProvider(
                ResourceKey.circuit(scope.entityId, season),
              ),
            );

      return computeEntityDetailState<CircuitProfile>(
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
