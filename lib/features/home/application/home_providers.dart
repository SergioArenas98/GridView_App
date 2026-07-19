import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/domain/entities/home_view.dart';
import '../../shared/domain/repositories/race_weekend_repository.dart';
import 'home_state.dart';

/// The Drift-backed Home stream. Keep-alive so Home content persists across
/// normal branch navigation without re-fetching.
final StreamProvider<HomeView?> homeCacheProvider = StreamProvider<HomeView?>(
  (Ref ref) => ref.watch(raceWeekendRepositoryProvider).watchHome(),
);

/// Owns Home refresh orchestration and status. Triggers one refresh on creation
/// and de-duplicates overlapping refreshes.
class HomeController extends Notifier<RefreshStatus> {
  @override
  RefreshStatus build() {
    Future<void>.microtask(refresh);
    return RefreshStatus.idle;
  }

  Future<void> refresh() async {
    if (state.inProgress) return; // dedupe overlapping refreshes
    state = RefreshStatus.running;
    final RefreshResult result = await ref
        .read(raceWeekendRepositoryProvider)
        .refreshHome();
    state = switch (result) {
      RefreshSuccess() => RefreshStatus.idle,
      RefreshFailure(:final ApiFailure failure) => RefreshStatus.idle.failed(
        failure,
      ),
    };
  }
}

final NotifierProvider<HomeController, RefreshStatus> homeControllerProvider =
    NotifierProvider<HomeController, RefreshStatus>(HomeController.new);

/// The derived, typed Home presentation state.
final Provider<HomeState> homeStateProvider = Provider<HomeState>((Ref ref) {
  final AsyncValue<HomeView?> cache = ref.watch(homeCacheProvider);
  final RefreshStatus status = ref.watch(homeControllerProvider);
  final DateTime now = ref.watch(clockProvider)();
  return computeHomeState(
    cache: cache.value,
    streamReady: cache.hasValue,
    refreshing: status.inProgress,
    lastFailure: status.lastFailure,
    now: now,
  );
});
