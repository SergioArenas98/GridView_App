import '../../shared/domain/entities/sync_state.dart';
import 'resource_due_rule.dart';
import 'sync_plan.dart';
import 'sync_resource.dart';

/// How much of the core set a plan is allowed to cover.
enum SyncPlanScope {
  /// First use: the aggregate only. Nothing is scheduled beside it — the point
  /// of bootstrap is to replace a fan-out of individual requests, not to join
  /// one.
  bootstrapOnly,

  /// The recovery plan after a failed bootstrap: season context plus the
  /// minimum Home resource, and nothing else. Compensating for a failed
  /// bootstrap by launching every collection is explicitly not the behaviour.
  minimalFirstScreen,

  /// The normal plan: season context, first screen, championship, then the
  /// explore collections and the content manifest.
  coreSet,
}

/// Everything the planner needs, gathered by the coordinator before planning.
///
/// The planner reads no clock, touches no database and performs no I/O: given
/// these inputs it always produces the same plan.
class SyncPlanInput {
  const SyncPlanInput({
    required this.trigger,
    required this.now,
    required this.currentSeason,
    required this.hasUsableFirstScreenCache,
    required this.bootstrapMaterialized,
    required this.metadata,
    this.dueKeys = const <String>{},
    this.bootstrapAttempted = false,
  });

  final SyncTrigger trigger;

  /// The supplied UTC instant. Freshness is evaluated against this and never
  /// against `DateTime.now()`.
  final DateTime now;

  /// The locally resolved current season, or null when none is stored.
  final int? currentSeason;

  /// Whether the first screen can already render from cache (see
  /// `firstUseCachePredicate`).
  final bool hasUsableFirstScreenCache;

  /// Whether a bootstrap representation is locally materialized.
  final bool bootstrapMaterialized;

  /// Stored metadata for the expected core keys. A key absent from this map — or
  /// mapped to null — has no metadata row and counts as never synchronised.
  final Map<String, ResourceSyncState?> metadata;

  /// Keys the persisted due query returned. Merged with, never trusted instead
  /// of, the expected-key evaluation: the query can only return rows that exist.
  final Set<String> dueKeys;

  /// True once this run has already tried bootstrap, so it is never planned
  /// twice.
  final bool bootstrapAttempted;
}

/// Builds the deterministic staged plan for one synchronization run.
///
/// It decides **what** to refresh and **in which order**; how any single
/// resource is refreshed stays entirely with its repository.
abstract final class SyncPlanner {
  static SyncPlan plan(SyncPlanInput input) {
    final SyncPlanScope scope = _scopeFor(input);
    final bool forces = input.trigger == SyncTrigger.manual;
    final int? season = input.currentSeason;

    if (scope == SyncPlanScope.bootstrapOnly) {
      return SyncPlan(
        trigger: input.trigger,
        stages: const <SyncPlanStage>[
          SyncPlanStage(SyncStage.bootstrap, <SyncResource>[
            BootstrapSyncResource(),
          ]),
        ],
        season: season,
        forcesEligibility: forces,
        seasonContextResolved: season != null,
      );
    }

    final List<SyncPlanStage> stages = scope == SyncPlanScope.minimalFirstScreen
        ? _minimalStages(season)
        : coreStages(season);

    final List<SyncPlanStage> eligible = <SyncPlanStage>[
      for (final SyncPlanStage stage in stages)
        if (_eligible(stage, input, forces) case final SyncPlanStage s
            when !s.isEmpty)
          s,
    ];

    return SyncPlan(
      trigger: input.trigger,
      stages: eligible,
      season: season,
      forcesEligibility: forces,
      seasonContextResolved: season != null,
    );
  }

  /// The full staged inventory of automatic core resources for [season],
  /// before due filtering.
  ///
  /// This is the single definition of "what an automatic run covers": the
  /// planner filters it, and the coordinator reads the same list to decide which
  /// metadata rows to load. A season-scoped resource — Home included — is simply
  /// omitted when no season context exists, because there is no canonical key to
  /// build. Only the genuinely season-agnostic resources (the current-season
  /// lookup itself and the content manifest) stay plannable, so an unresolved
  /// season leaves the run with season resolution to do and nothing else.
  ///
  /// Detail and historical resources are absent by design — they are refreshed
  /// on demand by whichever feature opens them.
  static List<SyncPlanStage> coreStages(int? season) => <SyncPlanStage>[
    SyncPlanStage(SyncStage.seasonContext, <SyncResource>[
      const CurrentSeasonSyncResource(),
      if (season != null) SeasonMetadataSyncResource(season),
    ]),
    SyncPlanStage(SyncStage.firstScreen, <SyncResource>[
      if (season != null) HomeSyncResource(season),
      if (season != null) CalendarSyncResource(season),
    ]),
    SyncPlanStage(SyncStage.championship, <SyncResource>[
      if (season != null) DriverStandingsSyncResource(season),
      if (season != null) ConstructorStandingsSyncResource(season),
    ]),
    SyncPlanStage(SyncStage.exploreAndContent, <SyncResource>[
      if (season != null) SeasonDriversSyncResource(season),
      if (season != null) SeasonConstructorsSyncResource(season),
      if (season != null) SeasonCircuitsSyncResource(season),
      const ContentManifestSyncResource(),
    ]),
  ];

  /// The recovery stages after a failed bootstrap: season context, then the
  /// **minimum** Home resource for the resolved season.
  ///
  /// Home is season-scoped, so with no season there is nothing to plan beyond
  /// resolving one. The coordinator re-plans once stage 1 has resolved a season,
  /// which is how Home is reached with the right canonical year — never through
  /// an unscoped request whose metadata is assigned after the fact.
  static List<SyncPlanStage> _minimalStages(int? season) => <SyncPlanStage>[
    SyncPlanStage(SyncStage.seasonContext, <SyncResource>[
      const CurrentSeasonSyncResource(),
      if (season != null) SeasonMetadataSyncResource(season),
    ]),
    SyncPlanStage(SyncStage.firstScreen, <SyncResource>[
      if (season != null) HomeSyncResource(season),
    ]),
  ];

  /// The canonical keys of every automatic core resource for [season], plus the
  /// bootstrap key. These are the "expected" keys whose metadata is loaded
  /// directly, so a resource with **no metadata row at all** is still seen.
  static List<String> expectedCoreKeys(int? season) => <String>[
    const BootstrapSyncResource().key,
    for (final SyncPlanStage stage in coreStages(season))
      for (final SyncResource resource in stage.resources) resource.key,
  ];

  static SyncPlanScope _scopeFor(SyncPlanInput input) {
    if (input.hasUsableFirstScreenCache) return SyncPlanScope.coreSet;
    if (!input.bootstrapAttempted) return SyncPlanScope.bootstrapOnly;
    return SyncPlanScope.minimalFirstScreen;
  }

  static SyncPlanStage _eligible(
    SyncPlanStage stage,
    SyncPlanInput input,
    bool forces,
  ) => SyncPlanStage(stage.stage, <SyncResource>[
    for (final SyncResource resource in stage.resources)
      if (resource.isAutomaticCore && _isDue(resource, input, forces)) resource,
  ]);

  /// A manual run forces eligibility; an automatic run refreshes only what
  /// server-provided freshness says is due, merging the persisted due query with
  /// a direct evaluation that also covers resources with no metadata row at all.
  static bool _isDue(SyncResource resource, SyncPlanInput input, bool forces) {
    if (forces) return true;
    if (input.dueKeys.contains(resource.key)) return true;
    return isResourceDue(input.metadata[resource.key], input.now);
  }
}
