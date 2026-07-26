import 'sync_resource.dart';

/// What caused a synchronization run.
enum SyncTrigger {
  /// The one automatic run that follows the first render after process start.
  startup,

  /// An automatic run caused by a genuine background → resumed transition.
  foreground,

  /// A user-initiated refresh of the current-season core set.
  manual,
}

/// One stage of a [SyncPlan]: an ordered position plus the independent
/// resources scheduled inside it.
class SyncPlanStage {
  const SyncPlanStage(this.stage, this.resources);

  final SyncStage stage;

  /// Deterministically ordered; may run concurrently, bounded by the
  /// coordinator's injected concurrency limit.
  final List<SyncResource> resources;

  bool get isEmpty => resources.isEmpty;
}

/// A deterministic, fully-resolved synchronization plan.
///
/// The plan is data, not behaviour: it names typed resources in stage order and
/// says nothing about how any individual resource is refreshed. Producing it is
/// pure — same inputs, same plan, no clock and no I/O.
class SyncPlan {
  const SyncPlan({
    required this.trigger,
    required this.stages,
    required this.season,
    required this.forcesEligibility,
    required this.seasonContextResolved,
  });

  final SyncTrigger trigger;

  /// Non-empty stages only, in execution order.
  final List<SyncPlanStage> stages;

  /// The season the season-scoped commands were built for, or null when none
  /// could be resolved locally.
  final int? season;

  /// True for a manual run: resources are scheduled regardless of due
  /// eligibility. It never implies dropping ETags — conditional requests and
  /// persisted validators are retained.
  final bool forcesEligibility;

  /// False when no season context was available, so season-scoped commands were
  /// skipped. Season-agnostic work may still have been planned.
  final bool seasonContextResolved;

  bool get isEmpty => stages.every((SyncPlanStage s) => s.isEmpty);

  /// Every resource in the plan, in stage then intra-stage order.
  List<SyncResource> get resources => <SyncResource>[
    for (final SyncPlanStage stage in stages) ...stage.resources,
  ];

  /// The canonical keys in plan order (diagnostics and tests).
  List<String> get resourceKeys =>
      resources.map((SyncResource r) => r.key).toList(growable: false);
}
