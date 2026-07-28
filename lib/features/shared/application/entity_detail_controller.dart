import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/errors/api_failure.dart';
import '../data/remote/remote_cancellation.dart';
import '../domain/refresh_result.dart';
import 'entity_detail_scope.dart';
import 'refresh_status.dart';

/// A detail controller's transient status: whether its own refresh is running,
/// the last failure it produced, and whether the resource definitively reports
/// the entity does not exist.
///
/// Content never lives here — it comes from the Drift-backed profile stream.
@immutable
class EntityDetailStatus {
  const EntityDetailStatus({
    this.refresh = RefreshStatus.idle,
    this.notFound = false,
  });

  final RefreshStatus refresh;

  /// A definitive `404` from **this** detail resource. Cleared by a later
  /// successful refresh, so a re-created or corrected entity recovers.
  final bool notFound;

  EntityDetailStatus copyWith({RefreshStatus? refresh, bool? notFound}) =>
      EntityDetailStatus(
        refresh: refresh ?? this.refresh,
        notFound: notFound ?? this.notFound,
      );
}

/// Base controller for an **on-demand** entity detail resource.
///
/// Ownership rules (ADR 0015): Driver, Team and Circuit details are not part of
/// the current-season core set, so they are never refreshed by
/// `AppSyncCoordinator`'s startup or foreground plan, and opening one never
/// refreshes Calendar, Home, Standings or any collection. Instead this
/// controller:
///
/// 1. triggers **at most one** refresh of its exact resource key when a valid
///    page opens with a resolved season;
/// 2. never awaits that request before the screen renders — content comes from
///    the local stream and appears immediately;
/// 3. never schedules a duplicate on a widget rebuild or a Drift emission (the
///    request is claimed once per resolved season);
/// 4. cancels on dispose;
/// 5. stays retryable after a failure or a cancellation;
/// 6. leans on the repository's per-resource deduplication as defence in depth.
///
/// A season that cannot be resolved produces **no request at all**: a
/// season-scoped detail endpoint is never called without a season.
abstract class EntityDetailController extends Notifier<EntityDetailStatus> {
  EntityDetailController(this.scope);

  final EntityDetailScope scope;

  /// Refreshes exactly this controller's own detail resource for [season].
  /// Implementations call one repository method and nothing else.
  Future<RefreshResult> refreshDetail(
    int season,
    RemoteCancellation? cancellation,
  );

  int? _requestedSeason;
  bool _requested = false;
  RemoteCancellation? _cancellation;

  /// The season this controller resolved, or `null` when none could be.
  int? get resolvedSeason => ref.read(entityDetailSeasonProvider(scope)).value;

  @override
  EntityDetailStatus build() {
    final int? season = ref.watch(entityDetailSeasonProvider(scope)).value;

    final RemoteCancellation cancellation = RemoteCancellation();
    _cancellation = cancellation;
    ref.onDispose(cancellation.cancel);

    // A different season is a different resource: it earns its own single
    // request. The same season never does, however often this rebuilds.
    if (season != _requestedSeason) {
      _requestedSeason = season;
      _requested = false;
    }

    final EntityDetailStatus initial = _requested
        ? state
        : const EntityDetailStatus();

    if (season != null && !_requested) {
      _requested = true;
      // Scheduled off the build so the screen renders local content first and
      // state is never mutated during a build.
      Future<void>.microtask(() => _refresh(season));
      return initial.copyWith(refresh: RefreshStatus.running);
    }
    return initial;
  }

  /// The user-triggered retry after a failure or a cancellation.
  ///
  /// Repeated taps collapse into one in-flight request, and the returned future
  /// always completes — after success, failure or cancellation — so an indicator
  /// can never hang.
  Future<void> retry() async {
    if (state.refresh.inProgress) return;
    final int? season = resolvedSeason;
    if (season == null) return;
    _requested = true;
    _requestedSeason = season;
    state = state.copyWith(refresh: RefreshStatus.running);
    await _refresh(season, alreadyRunning: true);
  }

  Future<void> _refresh(int season, {bool alreadyRunning = false}) async {
    if (!alreadyRunning && ref.mounted && !state.refresh.inProgress) {
      state = state.copyWith(refresh: RefreshStatus.running);
    }
    final RefreshResult result = await refreshDetail(season, _cancellation);
    if (!ref.mounted) return;
    switch (result) {
      case RefreshSuccess():
        // A success clears a previous not-found: the entity exists again.
        state = const EntityDetailStatus();
      case RefreshFailure(:final ApiFailure failure):
        switch (failure.kind) {
          // A cancelled request is not a user-facing failure; it simply clears
          // the transient state and stays retryable.
          case ApiFailureKind.cancelled:
            state = state.copyWith(refresh: RefreshStatus.idle);
          case ApiFailureKind.notFound:
            state = const EntityDetailStatus(notFound: true);
          default:
            state = EntityDetailStatus(
              refresh: RefreshStatus.idle.failed(failure),
              notFound: false,
            );
        }
    }
  }
}
