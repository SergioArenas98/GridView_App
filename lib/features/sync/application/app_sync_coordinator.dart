// ignore_for_file: prefer_initializing_formals
import 'dart:async';
import 'dart:math' as math;

import '../../../core/database/daos/sync_metadata_dao.dart';
import '../../shared/data/remote/remote_cancellation.dart';
import '../../shared/domain/entities/home_view.dart';
import '../../shared/domain/entities/season.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/refresh_result.dart';
import '../../shared/domain/repositories/bootstrap_repository.dart';
import '../../shared/domain/repositories/home_repository.dart';
import '../../shared/domain/repositories/season_repository.dart';
import '../data/resource_refresh_dispatcher.dart';
import '../domain/app_sync_state.dart';
import '../domain/first_screen_cache.dart';
import '../domain/sync_plan.dart';
import '../domain/sync_planner.dart';
import '../domain/sync_resource.dart';

/// The maximum number of resource refreshes a single stage runs at once.
///
/// Injected rather than hard-coded at the call site so tests can pin it, and
/// deliberately *not* a global HTTP lock: whole runs are serialised, but the
/// independent resources inside one stage overlap.
const int kDefaultSyncConcurrency = 4;

/// The one application-level synchronization boundary.
///
/// It owns cross-resource policy and application lifecycle orchestration:
/// first-use bootstrap policy, current-season resolution, due-resource planning,
/// the startup run, the foreground run, manual current-season refresh, stage
/// ordering, bounded concurrency, aggregate run state and run cancellation.
///
/// It owns none of the per-resource mechanics. DTO parsing, HTTP handling, ETag
/// persistence, the snapshot-conflict comparison and every domain write stay in
/// the Phase 6B1 repositories; this class only decides *what* to refresh and
/// *when*, then reports what happened.
///
/// There is exactly one automatic owner: [start] runs once after the first
/// render, [onForeground] runs on a genuine background → resumed transition, and
/// feature controllers never schedule their own lifecycle refreshes.
class AppSyncCoordinator {
  AppSyncCoordinator({
    required ResourceRefreshDispatcher dispatcher,
    required SeasonRepository seasons,
    required HomeRepository home,
    required BootstrapRepository bootstrap,
    required SyncMetadataDao metadata,
    required DateTime Function() now,
    int maxConcurrency = kDefaultSyncConcurrency,
  }) : _dispatcher = dispatcher,
       _seasons = seasons,
       _home = home,
       _bootstrap = bootstrap,
       _metadata = metadata,
       _now = now,
       _maxConcurrency = math.max(1, maxConcurrency);

  final ResourceRefreshDispatcher _dispatcher;
  final SeasonRepository _seasons;
  final HomeRepository _home;
  final BootstrapRepository _bootstrap;
  final SyncMetadataDao _metadata;
  final DateTime Function() _now;
  final int _maxConcurrency;

  final StreamController<AppSyncState> _states =
      StreamController<AppSyncState>.broadcast();

  AppSyncState _state = const AppSyncIdle();

  /// The active run, or null when idle. Whole runs are serialised.
  Future<void>? _active;

  /// At most one forced follow-up may be queued behind the active run, however
  /// many times the user taps refresh.
  bool _pendingManual = false;
  Completer<void>? _pendingManualDone;

  RemoteCancellation? _cancellation;
  bool _cancelled = false;
  bool _startupDone = false;
  bool _disposed = false;

  /// The current aggregate state.
  AppSyncState get state => _state;

  /// Aggregate state changes. Broadcast; the current value is available
  /// synchronously from [state].
  Stream<AppSyncState> get states => _states.stream;

  /// Whether a run is in flight (diagnostics and tests).
  bool get isRunning => _active != null;

  /// The one automatic run that follows the first render. Idempotent: calling it
  /// again after the first launch does nothing, so the initial `resumed`
  /// lifecycle notification can never duplicate it.
  Future<void> start() {
    if (_disposed || _startupDone) return _active ?? Future<void>.value();
    _startupDone = true;
    return _trigger(SyncTrigger.startup);
  }

  /// A genuine background → resumed transition. Freshness is evaluated at the
  /// moment the run begins. Duplicate automatic triggers while a run is active
  /// join it instead of queueing a second one.
  Future<void> onForeground() {
    if (_disposed) return Future<void>.value();
    if (!_startupDone) {
      // The first resumed notification of the process is the startup run.
      return start();
    }
    return _trigger(SyncTrigger.foreground);
  }

  /// The user-initiated refresh of the current-season core set.
  ///
  /// It forces **eligibility** — resources that are not due are refreshed
  /// anyway — while keeping conditional requests and persisted ETags. It never
  /// bypasses validators; that is a separate low-level repository option.
  /// Callable without a `BuildContext`.
  Future<void> refreshNow() {
    if (_disposed) return Future<void>.value();
    final Future<void>? active = _active;
    if (active != null) {
      _pendingManual = true;
      final Completer<void> done = _pendingManualDone ??=
          Completer<void>.sync();
      return done.future;
    }
    return _trigger(SyncTrigger.manual);
  }

  /// Cancels the active run: no further resource commands are scheduled, every
  /// in-flight request is aborted (releasing each repository's in-flight slot),
  /// and any queued follow-up is resolved rather than left dangling. A later
  /// resume or manual refresh starts a fresh run normally.
  void cancel() {
    _cancelled = true;
    _cancellation?.cancel();
    _resolvePendingManual();
  }

  /// Cancels any work and closes the state stream.
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    cancel();
    await _states.close();
  }

  // --- Run orchestration ---------------------------------------------------

  Future<void> _trigger(SyncTrigger trigger) {
    final Future<void>? active = _active;
    // An automatic trigger during an active run joins it: one run at a time,
    // no queued reruns.
    if (active != null) return active;

    final Future<void> run = _run(trigger);
    _active = run;
    unawaited(
      run
          .whenComplete(() {
            if (identical(_active, run)) _active = null;
            _startPendingManual();
          })
          .catchError((Object _) {}),
    );
    return run;
  }

  void _startPendingManual() {
    if (!_pendingManual) return;
    _pendingManual = false;
    final Completer<void>? done = _pendingManualDone;
    _pendingManualDone = null;
    if (_disposed || _cancelled) {
      done?.complete();
      return;
    }
    final Future<void> followUp = _trigger(SyncTrigger.manual);
    if (done != null) {
      unawaited(followUp.whenComplete(done.complete).catchError((Object _) {}));
    }
  }

  void _resolvePendingManual() {
    _pendingManual = false;
    final Completer<void>? done = _pendingManualDone;
    _pendingManualDone = null;
    if (done != null && !done.isCompleted) done.complete();
  }

  Future<void> _run(SyncTrigger trigger) async {
    _cancelled = false;
    final RemoteCancellation cancellation = RemoteCancellation();
    _cancellation = cancellation;

    final List<ResourceSyncOutcome> outcomes = <ResourceSyncOutcome>[];
    _emit(AppSyncRunning(trigger: trigger));

    bool bootstrapAttempted = false;
    bool seasonRePlanned = false;
    SyncPlan plan = await _plan(trigger, bootstrapAttempted: false);

    while (true) {
      if (_cancelled) break;

      if (_isBootstrapPlan(plan)) {
        await _executeStage(plan.stages.first, outcomes, cancellation);
        bootstrapAttempted = true;
        final ResourceSyncOutcome? result = outcomes.isEmpty
            ? null
            : outcomes.last;
        // A successful bootstrap (200 or a valid 304) ends the run: the UI now
        // renders from that one transaction, and the individual endpoints keep
        // their own metadata for a later foreground, manual or feature refresh.
        if (_cancelled || result == null || result.isSuccess) break;
        // Bootstrap failed. The shell stays usable and every partial cache is
        // preserved; recover with the minimal first-screen plan, never a
        // compensating fan-out of all collections.
        plan = await _plan(trigger, bootstrapAttempted: true);
        continue;
      }

      // Stage 1 first: a changed current season must be resolved before any
      // season-scoped command is built.
      final SyncPlanStage? seasonStage = _stageOf(
        plan,
        SyncStage.seasonContext,
      );
      if (seasonStage != null) {
        await _executeStage(seasonStage, outcomes, cancellation);
      }
      if (_cancelled) break;

      final int? resolvedSeason = await _localSeason();
      if (!seasonRePlanned && resolvedSeason != plan.season) {
        // The season changed under us (a season transition, or the very first
        // successful current-season sync). Re-plan against it: previous-season
        // data stays exactly where it is, and a new season with no usable Home
        // cache legitimately prefers bootstrap.
        seasonRePlanned = true;
        plan = await _plan(trigger, bootstrapAttempted: bootstrapAttempted);
        continue;
      }

      for (final SyncPlanStage stage in plan.stages) {
        if (stage.stage == SyncStage.seasonContext) continue;
        if (_cancelled) break;
        await _executeStage(stage, outcomes, cancellation);
      }
      break;
    }

    // Season context is judged on the state the run actually left behind: a
    // successful bootstrap establishes the season even though the plan was
    // built before one existed.
    _finish(trigger, outcomes, seasonResolved: await _localSeason() != null);
  }

  void _finish(
    SyncTrigger trigger,
    List<ResourceSyncOutcome> outcomes, {
    required bool seasonResolved,
  }) {
    if (_cancelled) {
      _emit(AppSyncCancelled(trigger: trigger, outcomes: outcomes));
      return;
    }
    if (!seasonResolved) {
      _emit(
        AppSyncSeasonContextUnavailable(trigger: trigger, outcomes: outcomes),
      );
      return;
    }
    _emit(AppSyncCompleted(trigger: trigger, outcomes: outcomes));
  }

  SyncPlanStage? _stageOf(SyncPlan plan, SyncStage stage) {
    for (final SyncPlanStage s in plan.stages) {
      if (s.stage == stage) return s;
    }
    return null;
  }

  bool _isBootstrapPlan(SyncPlan plan) =>
      plan.stages.length == 1 && plan.stages.first.stage == SyncStage.bootstrap;

  // --- Planning inputs -----------------------------------------------------

  Future<SyncPlan> _plan(
    SyncTrigger trigger, {
    required bool bootstrapAttempted,
  }) async {
    final DateTime now = _now().toUtc();
    final int? season = await _localSeason();
    final HomeView? home = await _home.readHome();
    final List<ResourceSyncState> due = await _metadata.readDueResources(now);

    final Map<String, ResourceSyncState?> metadata =
        <String, ResourceSyncState?>{};
    for (final String key in SyncPlanner.expectedCoreKeys(season)) {
      metadata[key] = await _metadata.read(key);
    }

    return SyncPlanner.plan(
      SyncPlanInput(
        trigger: trigger,
        now: now,
        currentSeason: season,
        hasUsableFirstScreenCache: hasUsableFirstScreenCache(
          currentSeason: season,
          homeFeaturedSeason: home?.featured.season,
        ),
        bootstrapMaterialized: await _bootstrap.isMaterialized(),
        metadata: metadata,
        dueKeys: due.map((ResourceSyncState s) => s.resourceKey).toSet(),
        bootstrapAttempted: bootstrapAttempted,
      ),
    );
  }

  Future<int?> _localSeason() async {
    final Season? season = await _seasons.readCurrentSeason();
    return season?.year;
  }

  // --- Bounded stage execution ---------------------------------------------

  /// Runs one stage's resources concurrently, never more than [_maxConcurrency]
  /// at a time, appending outcomes in deterministic plan order.
  ///
  /// A failure never stops the stage: independent resources continue, and no
  /// transaction spans more than one resource.
  Future<void> _executeStage(
    SyncPlanStage stage,
    List<ResourceSyncOutcome> outcomes,
    RemoteCancellation cancellation,
  ) async {
    _emit(AppSyncRunning(trigger: _triggerOf(_state), stage: stage.stage));

    final List<SyncResource> resources = stage.resources;
    final List<ResourceSyncOutcome?> slots = List<ResourceSyncOutcome?>.filled(
      resources.length,
      null,
    );
    int next = 0;

    Future<void> worker() async {
      while (true) {
        if (_cancelled) return;
        final int index = next;
        if (index >= resources.length) return;
        next = index + 1;
        slots[index] = await _refresh(resources[index], cancellation);
      }
    }

    final int workers = math.min(_maxConcurrency, resources.length);
    await Future.wait<void>(<Future<void>>[
      for (int i = 0; i < workers; i++) worker(),
    ]);

    for (int i = 0; i < resources.length; i++) {
      outcomes.add(slots[i] ?? ResourceSyncOutcome.skipped(resources[i].key));
    }
  }

  Future<ResourceSyncOutcome> _refresh(
    SyncResource resource,
    RemoteCancellation cancellation,
  ) async {
    final Future<RefreshResult>? refresh = _dispatcher.refresh(
      resource,
      cancellation: cancellation,
    );
    // A key this build cannot dispatch: record a safe skip, leave its metadata
    // row untouched and carry on.
    if (refresh == null) return ResourceSyncOutcome.skipped(resource.key);
    final RefreshResult result = await refresh;
    return ResourceSyncOutcome.fromRefresh(resource.key, result);
  }

  SyncTrigger _triggerOf(AppSyncState state) => switch (state) {
    AppSyncRunning(:final SyncTrigger trigger) => trigger,
    AppSyncCompleted(:final SyncTrigger trigger) => trigger,
    AppSyncCancelled(:final SyncTrigger trigger) => trigger,
    AppSyncSeasonContextUnavailable(:final SyncTrigger trigger) => trigger,
    AppSyncIdle() => SyncTrigger.startup,
  };

  void _emit(AppSyncState state) {
    _state = state;
    if (!_states.isClosed) _states.add(state);
  }
}
