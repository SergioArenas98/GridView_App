import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/domain/entities/home_view.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/refresh_result.dart';
import '../../sync/application/sync_providers.dart';
import '../../sync/domain/app_sync_state.dart';
import 'home_state.dart';

/// The Drift-backed Home stream. Keep-alive so Home content persists across
/// normal branch navigation without re-fetching. This is the only source of
/// Home content — the refresh status below never carries data.
final StreamProvider<HomeView?> homeCacheProvider = StreamProvider<HomeView?>(
  (Ref ref) => ref.watch(homeRepositoryProvider).watchHome(),
);

/// Owns Home's *presentation* refresh status.
///
/// Automatic startup and foreground refreshes of Home belong to the single
/// application-level synchronization coordinator, so this controller no longer
/// launches one of its own: a second competing startup request would be a known
/// duplicate that per-key deduplication should never have to absorb. Instead it
/// mirrors the coordinator's outcome for the Home resource, and keeps
/// [refresh] for the user's explicit retry / pull-to-refresh.
class HomeController extends Notifier<RefreshStatus> {
  @override
  RefreshStatus build() {
    ref.listen<AppSyncState>(appSyncStateProvider, (
      AppSyncState? _,
      AppSyncState next,
    ) {
      final RefreshStatus? mapped = _statusFor(next);
      if (mapped != null) state = mapped;
    });
    return _statusFor(ref.read(appSyncStateProvider)) ?? RefreshStatus.idle;
  }

  /// The user's explicit refresh. It still deduplicates against itself, and the
  /// repository's per-key coordinator collapses it with any concurrent
  /// application-level refresh of the same resource.
  Future<void> refresh() async {
    if (state.inProgress) return;
    state = RefreshStatus.running;
    final RefreshResult result = await ref
        .read(homeRepositoryProvider)
        .refreshHome();
    state = switch (result) {
      RefreshSuccess() => RefreshStatus.idle,
      RefreshFailure(:final ApiFailure failure) => RefreshStatus.idle.failed(
        failure,
      ),
    };
  }

  /// Maps an application-level state onto Home's status, or null when it says
  /// nothing about Home (an idle coordinator, or a finished run that never
  /// planned Home).
  static RefreshStatus? _statusFor(AppSyncState state) {
    if (state is AppSyncRunning) return RefreshStatus.running;
    if (state is AppSyncIdle) return null;

    for (final ResourceSyncOutcome outcome in state.outcomes) {
      if (outcome.resourceKey != ResourceKey.home()) continue;
      final ApiFailureKind? failure = outcome.failure;
      if (outcome.isFailure && failure != null) {
        return RefreshStatus.idle.failed(ApiFailure(kind: failure));
      }
      return RefreshStatus.idle;
    }
    return RefreshStatus.idle;
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
