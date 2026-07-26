import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/domain/entities/race_result.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/refresh_result.dart';
import 'grand_prix_detail_state.dart';
import 'grand_prix_results_state.dart';

/// The Drift-backed Grand Prix detail stream, per (season, round). Auto-disposed
/// when the detail screen is popped so controllers never accumulate; the cached
/// data itself survives in Drift.
final grandPrixCacheProvider = StreamProvider.autoDispose
    .family<GrandPrixDetailView?, GrandPrixKey>(
      (Ref ref, GrandPrixKey key) => ref
          .watch(grandPrixRepositoryProvider)
          .watchGrandPrix(season: key.season, round: key.round),
    );

/// The Drift-backed classification stream for the same (season, round). Sprint
/// and race documents arrive together and stay separate.
final grandPrixResultsCacheProvider = StreamProvider.autoDispose
    .family<List<RaceResult>, GrandPrixKey>(
      (Ref ref, GrandPrixKey key) => ref
          .watch(resultRepositoryProvider)
          .watchResults(season: key.season, round: key.round),
    );

/// Owns Grand Prix **detail** refresh for one (season, round).
///
/// Detail is an on-demand resource: opening a valid route requests it exactly
/// once, and a widget rebuild never produces a second request because the
/// notifier is built once per provider lifetime. Disposal cancels the in-flight
/// request, releasing the repository's per-key slot so a later visit can retry.
class GrandPrixController extends Notifier<RefreshStatus> {
  GrandPrixController(this.key);

  final GrandPrixKey key;

  RemoteCancellation? _cancellation;

  @override
  RefreshStatus build() {
    final RemoteCancellation cancellation = RemoteCancellation();
    _cancellation = cancellation;
    ref.onDispose(cancellation.cancel);
    // Exactly one automatic on-demand request per opened route. Rendering never
    // waits for it: the local stream is already subscribed.
    Future<void>.microtask(refresh);
    return RefreshStatus.idle;
  }

  Future<void> refresh() async {
    if (state.inProgress) return;
    state = RefreshStatus.running;
    final RefreshResult result = await ref
        .read(grandPrixRepositoryProvider)
        .refreshGrandPrix(
          season: key.season,
          round: key.round,
          cancellation: _cancellation,
        );
    // The screen may have been popped while the request was in flight; the
    // cancellation has already released the repository slot.
    if (!ref.mounted) return;
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

/// Owns Grand Prix **result** refresh for one (season, round).
///
/// Eligibility, not a timer, drives it (ADR 0015 keeps lifecycle policy in the
/// application coordinator; detail and results stay feature-owned):
///
/// - stored classifications make the resource eligible, so entering the screen
///   revalidates them conditionally exactly once;
/// - with nothing stored, the event's own `hasResults` decides — an upcoming
///   event never asks for a classification that does not exist;
/// - a detail refresh that flips `hasResults` from false to true triggers
///   exactly one request, and no further local emission repeats it;
/// - a failed automatic attempt is not retried automatically; the user's retry
///   calls [refresh] directly.
class GrandPrixResultsController extends Notifier<RefreshStatus> {
  GrandPrixResultsController(this.key);

  final GrandPrixKey key;

  RemoteCancellation? _cancellation;
  bool _requested = false;

  /// Whether the one automatic on-demand request has already been scheduled.
  bool get requested => _requested;

  @override
  RefreshStatus build() {
    final RemoteCancellation cancellation = RemoteCancellation();
    _cancellation = cancellation;
    ref.onDispose(cancellation.cancel);

    ref.listen<AsyncValue<GrandPrixDetailView?>>(
      grandPrixCacheProvider(key),
      (
        AsyncValue<GrandPrixDetailView?>? _,
        AsyncValue<GrandPrixDetailView?> _,
      ) => _evaluate(),
    );
    ref.listen<AsyncValue<List<RaceResult>>>(
      grandPrixResultsCacheProvider(key),
      (AsyncValue<List<RaceResult>>? _, AsyncValue<List<RaceResult>> _) =>
          _evaluate(),
    );
    Future<void>.microtask(_evaluate);
    return RefreshStatus.idle;
  }

  void _evaluate() {
    if (_requested) return;
    final AsyncValue<List<RaceResult>> results = ref.read(
      grandPrixResultsCacheProvider(key),
    );
    final AsyncValue<GrandPrixDetailView?> detail = ref.read(
      grandPrixCacheProvider(key),
    );
    // Wait until both local reads have produced a value, so eligibility is
    // decided on real local state rather than on "not loaded yet".
    if (!results.hasValue || !detail.hasValue) return;

    final bool hasStored = (results.value ?? const <RaceResult>[]).any(
      (RaceResult r) => r.entries.isNotEmpty,
    );
    final bool advertised = detail.value?.grandPrix.hasResults ?? false;
    if (!hasStored && !advertised) return;

    _requested = true;
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (state.inProgress) return;
    state = RefreshStatus.running;
    final RefreshResult result = await ref
        .read(resultRepositoryProvider)
        .refreshResults(
          season: key.season,
          round: key.round,
          cancellation: _cancellation,
        );
    if (!ref.mounted) return;
    state = switch (result) {
      RefreshSuccess() => RefreshStatus.idle,
      RefreshFailure(:final ApiFailure failure) => RefreshStatus.idle.failed(
        failure,
      ),
    };
  }
}

final grandPrixResultsControllerProvider = NotifierProvider.autoDispose
    .family<GrandPrixResultsController, RefreshStatus, GrandPrixKey>(
      GrandPrixResultsController.new,
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

/// The derived, typed result-section state — independent of the detail state.
final grandPrixResultsStateProvider = Provider.autoDispose
    .family<GrandPrixResultsState, GrandPrixKey>((Ref ref, GrandPrixKey key) {
      final AsyncValue<List<RaceResult>> cache = ref.watch(
        grandPrixResultsCacheProvider(key),
      );
      final AsyncValue<GrandPrixDetailView?> detail = ref.watch(
        grandPrixCacheProvider(key),
      );
      final RefreshStatus status = ref.watch(
        grandPrixResultsControllerProvider(key),
      );
      final AsyncValue<ResourceSyncState?> metadata = ref.watch(
        resourceSyncStateProvider(
          ResourceKey.grandPrixResults(key.season, key.round),
        ),
      );
      final DateTime now = ref.watch(clockProvider)();
      return computeGrandPrixResultsState(
        results: cache.value,
        streamReady: cache.hasValue,
        expected: detail.value?.grandPrix.hasResults ?? false,
        metadata: metadata.value,
        refreshing: status.inProgress,
        lastFailure: status.lastFailure,
        now: now,
      );
    });
