import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/domain/repositories/race_weekend_repository.dart';
import 'grand_prix_detail_state.dart';

/// The Drift-backed Grand Prix detail stream, per (season, round). Auto-disposed
/// when the detail screen is popped so controllers never accumulate; the cached
/// data itself survives in Drift.
final grandPrixCacheProvider = StreamProvider.autoDispose
    .family<GrandPrixDetailView?, GrandPrixKey>(
      (Ref ref, GrandPrixKey key) => ref
          .watch(raceWeekendRepositoryProvider)
          .watchGrandPrix(season: key.season, round: key.round),
    );

/// Owns Grand Prix detail refresh orchestration and status for one (season,
/// round). Triggers one refresh on creation and de-duplicates overlapping
/// refreshes.
class GrandPrixController extends Notifier<RefreshStatus> {
  GrandPrixController(this.key);

  final GrandPrixKey key;

  @override
  RefreshStatus build() {
    Future<void>.microtask(refresh);
    return RefreshStatus.idle;
  }

  Future<void> refresh() async {
    if (state.inProgress) return;
    state = RefreshStatus.running;
    final RefreshResult result = await ref
        .read(raceWeekendRepositoryProvider)
        .refreshGrandPrix(season: key.season, round: key.round);
    state = switch (result) {
      RefreshSuccess() => RefreshStatus.idle,
      RefreshFailure(:final ApiFailure failure) => RefreshStatus.idle.failed(
        failure,
      ),
    };
  }
}

final grandPrixControllerProvider = NotifierProvider.autoDispose
    .family<GrandPrixController, RefreshStatus, GrandPrixKey>(
      GrandPrixController.new,
    );

/// The derived, typed Grand Prix detail presentation state.
final grandPrixStateProvider = Provider.autoDispose
    .family<GrandPrixDetailState, GrandPrixKey>((Ref ref, GrandPrixKey key) {
      final AsyncValue<GrandPrixDetailView?> cache = ref.watch(
        grandPrixCacheProvider(key),
      );
      final RefreshStatus status = ref.watch(grandPrixControllerProvider(key));
      final DateTime now = ref.watch(clockProvider)();
      return computeGrandPrixState(
        cache: cache.value,
        streamReady: cache.hasValue,
        refreshing: status.inProgress,
        lastFailure: status.lastFailure,
        now: now,
      );
    });
