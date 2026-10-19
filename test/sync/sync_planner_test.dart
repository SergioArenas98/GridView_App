import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/domain/resource_due_rule.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';
import 'package:gridview/features/sync/domain/sync_planner.dart';
import 'package:gridview/features/sync/domain/sync_resource.dart';

final DateTime now = DateTime.utc(2026, 7, 18, 12);

/// Synced successfully and not due: the server gave an expiry in the future and
/// did not flag it stale.
ResourceSyncState fresh(String key) => ResourceSyncState(
  resourceKey: key,
  lastSuccessAt: now.subtract(const Duration(minutes: 1)),
  staleAfter: now.add(const Duration(minutes: 15)),
  serverStale: false,
);

SyncPlanInput input({
  SyncTrigger trigger = SyncTrigger.startup,
  int? currentSeason = 2026,
  bool hasUsableFirstScreenCache = true,
  bool bootstrapMaterialized = true,
  bool bootstrapAttempted = false,
  Map<String, ResourceSyncState?> metadata =
      const <String, ResourceSyncState?>{},
  Set<String> dueKeys = const <String>{},
}) => SyncPlanInput(
  trigger: trigger,
  now: now,
  currentSeason: currentSeason,
  hasUsableFirstScreenCache: hasUsableFirstScreenCache,
  bootstrapMaterialized: bootstrapMaterialized,
  metadata: metadata,
  dueKeys: dueKeys,
  bootstrapAttempted: bootstrapAttempted,
);

/// Every core key for [season], all recorded as fresh.
Map<String, ResourceSyncState?> allFresh(int? season) =>
    <String, ResourceSyncState?>{
      for (final String key in SyncPlanner.expectedCoreKeys(season))
        key: fresh(key),
    };

void main() {
  group('due rule', () {
    test('a missing metadata row is never synchronized, so it is due', () {
      expect(isResourceDue(null, now), isTrue);
    });

    test('a null lastSuccessAt is due', () {
      expect(
        isResourceDue(const ResourceSyncState(resourceKey: 'x'), now),
        isTrue,
      );
    });

    test('serverStale true is due even with a future staleAfter', () {
      expect(
        isResourceDue(
          ResourceSyncState(
            resourceKey: 'x',
            lastSuccessAt: now,
            staleAfter: now.add(const Duration(hours: 1)),
            serverStale: true,
          ),
          now,
        ),
        isTrue,
      );
    });

    test('staleAfter exactly equal to now is due', () {
      expect(
        isResourceDue(
          ResourceSyncState(
            resourceKey: 'x',
            lastSuccessAt: now,
            staleAfter: now,
          ),
          now,
        ),
        isTrue,
      );
    });

    test('staleAfter later than now is not due', () {
      expect(
        isResourceDue(
          ResourceSyncState(
            resourceKey: 'x',
            lastSuccessAt: now,
            staleAfter: now.add(const Duration(milliseconds: 1)),
          ),
          now,
        ),
        isFalse,
      );
    });

    test('a success with no staleAfter and serverStale false is not due', () {
      expect(
        isResourceDue(
          ResourceSyncState(
            resourceKey: 'x',
            lastSuccessAt: now,
            serverStale: false,
          ),
          now,
        ),
        isFalse,
      );
    });
  });

  group('first-use policy', () {
    test('no usable cache plans bootstrap, and nothing beside it', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(hasUsableFirstScreenCache: false, bootstrapMaterialized: false),
      );
      expect(plan.resourceKeys, <String>[ResourceKey.bootstrap()]);
    });

    test(
      'after a successful bootstrap the run does not fan out to every endpoint',
      () {
        // The coordinator ends the run on a successful bootstrap; the planner
        // never widens a bootstrap plan into the individual resources.
        final SyncPlan plan = SyncPlanner.plan(
          input(hasUsableFirstScreenCache: false),
        );
        expect(plan.stages, hasLength(1));
        expect(plan.stages.single.stage, SyncStage.bootstrap);
      },
    );

    test('a usable cache never forces bootstrap', () {
      final SyncPlan plan = SyncPlanner.plan(input());
      expect(plan.resourceKeys, isNot(contains(ResourceKey.bootstrap())));
    });

    test('a failed bootstrap recovers with season context and the minimum Home '
        'resource only', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(hasUsableFirstScreenCache: false, bootstrapAttempted: true),
      );
      expect(plan.resourceKeys, <String>[
        ResourceKey.currentSeason(),
        ResourceKey.season(2026),
        ResourceKey.home(2026),
      ]);
      expect(
        plan.resourceKeys,
        isNot(contains(ResourceKey.calendar(2026))),
        reason: 'only the minimum Home resource, not the whole first screen',
      );
      expect(
        plan.resourceKeys,
        isNot(contains(ResourceKey.driverStandings(2026))),
        reason: 'a failed bootstrap is not compensated with all collections',
      );
    });

    test(
      'a locally resolved season makes the recovery Home use that exact year',
      () {
        final SyncPlan plan = SyncPlanner.plan(
          input(
            currentSeason: 2031,
            hasUsableFirstScreenCache: false,
            bootstrapAttempted: true,
          ),
        );
        expect(plan.resourceKeys, contains(ResourceKey.home(2031)));
        expect(plan.resourceKeys, isNot(contains(ResourceKey.home(2026))));
      },
    );

    test(
      'with no season at all the recovery plan only resolves the season',
      () {
        final SyncPlan plan = SyncPlanner.plan(
          input(
            currentSeason: null,
            hasUsableFirstScreenCache: false,
            bootstrapAttempted: true,
          ),
        );
        // Home is season-scoped: there is no canonical key to build, so it is
        // not planned at all. The coordinator re-plans after stage 1 resolves a
        // season.
        expect(plan.resourceKeys, <String>[ResourceKey.currentSeason()]);
        expect(plan.seasonContextResolved, isFalse);
      },
    );
  });

  group('due filtering', () {
    test('an automatic run with everything fresh plans nothing', () {
      final SyncPlan plan = SyncPlanner.plan(input(metadata: allFresh(2026)));
      expect(plan.isEmpty, isTrue);
      expect(plan.resourceKeys, isEmpty);
    });

    test('a missing metadata row is planned', () {
      final Map<String, ResourceSyncState?> metadata = allFresh(2026)
        ..remove(ResourceKey.calendar(2026));
      final SyncPlan plan = SyncPlanner.plan(input(metadata: metadata));
      expect(plan.resourceKeys, <String>[ResourceKey.calendar(2026)]);
    });

    test('a key returned by the persisted due query is planned', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(
          metadata: allFresh(2026),
          dueKeys: <String>{ResourceKey.driverStandings(2026)},
        ),
      );
      expect(plan.resourceKeys, <String>[ResourceKey.driverStandings(2026)]);
    });

    test('a manual run ignores due eligibility', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual, metadata: allFresh(2026)),
      );
      expect(plan.forcesEligibility, isTrue);
      expect(plan.resourceKeys, <String>[
        ResourceKey.currentSeason(),
        ResourceKey.season(2026),
        ResourceKey.home(2026),
        ResourceKey.calendar(2026),
        ResourceKey.driverStandings(2026),
        ResourceKey.constructorStandings(2026),
        ResourceKey.drivers(2026),
        ResourceKey.constructors(2026),
        ResourceKey.circuits(2026),
        ResourceKey.contentManifest(),
      ]);
    });
  });

  group('coverage and ordering', () {
    test('the automatic core set is exactly the documented inventory', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual),
      );
      expect(plan.resourceKeys.toSet(), <String>{
        ResourceKey.currentSeason(),
        ResourceKey.season(2026),
        ResourceKey.home(2026),
        ResourceKey.calendar(2026),
        ResourceKey.driverStandings(2026),
        ResourceKey.constructorStandings(2026),
        ResourceKey.drivers(2026),
        ResourceKey.constructors(2026),
        ResourceKey.circuits(2026),
        ResourceKey.contentManifest(),
      });
    });

    test('detail and historical resources are never planned', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual),
      );
      for (final String key in <String>[
        ResourceKey.grandPrix(2026, 13),
        ResourceKey.grandPrixResults(2026, 13),
        ResourceKey.driver('max-verstappen', 2026),
        ResourceKey.constructor('red-bull', 2026),
        ResourceKey.circuit('spa-francorchamps', 2026),
        ResourceKey.calendar(2024),
        ResourceKey.driverStandings(2024),
      ]) {
        expect(plan.resourceKeys, isNot(contains(key)));
      }
    });

    test('stage order is deterministic and season-scoped work is grouped', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual),
      );
      expect(plan.stages.map((SyncPlanStage s) => s.stage), <SyncStage>[
        SyncStage.seasonContext,
        SyncStage.firstScreen,
        SyncStage.championship,
        SyncStage.exploreAndContent,
      ]);
    });

    test('Home appears exactly once in a plan', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual),
      );
      expect(
        plan.resourceKeys
            .where((String k) => k == ResourceKey.home(2026))
            .length,
        1,
      );
    });

    test('planning is deterministic for identical inputs', () {
      final SyncPlanInput i = input(
        trigger: SyncTrigger.foreground,
        metadata: allFresh(2026)..remove(ResourceKey.home(2026)),
      );
      expect(
        SyncPlanner.plan(i).resourceKeys,
        SyncPlanner.plan(i).resourceKeys,
      );
    });

    test('no season is hardcoded — the plan follows the supplied year', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(trigger: SyncTrigger.manual, currentSeason: 2031),
      );
      expect(plan.resourceKeys, contains(ResourceKey.calendar(2031)));
      expect(plan.resourceKeys, isNot(contains(ResourceKey.calendar(2026))));
    });

    test(
      'the content manifest is planned independently of any season context',
      () {
        final SyncPlan plan = SyncPlanner.plan(
          input(trigger: SyncTrigger.manual, currentSeason: null),
        );
        expect(plan.resourceKeys, contains(ResourceKey.contentManifest()));
        // Home is season-scoped: without a season there is no canonical key, so
        // it is not planned. Non-season-scoped work never justifies an unscoped
        // Home request.
        expect(
          plan.resourceKeys.where((String k) => k.startsWith('home')),
          isEmpty,
        );
        expect(plan.seasonContextResolved, isFalse);
        for (final String key in plan.resourceKeys) {
          expect(key, isNot(contains('2026')));
        }
      },
    );
  });

  group('release convergence (ADR 0025 D4, amendment of 2026-10-14)', () {
    final DateTime p1 = DateTime.utc(2026, 7, 18, 11);
    final DateTime p2 = DateTime.utc(2026, 7, 18, 11, 30);
    final String manifestKey = ResourceKey.contentManifest();
    final String calendarKey = ResourceKey.calendar(2026);

    /// Fresh by its own expiry, recorded from the release at [generatedAt].
    ResourceSyncState at(String key, DateTime? generatedAt, {int? season}) =>
        ResourceSyncState(
          resourceKey: key,
          season: season,
          generatedAt: generatedAt,
          lastSuccessAt: now.subtract(const Duration(minutes: 1)),
          staleAfter: now.add(const Duration(days: 7)),
          serverStale: false,
        );

    Map<String, ResourceSyncState?> releaseMetadata({
      DateTime? calendar,
      DateTime? manifest,
      int? calendarSeason = 2026,
      int? manifestSeason = 2026,
    }) => <String, ResourceSyncState?>{
      ...allFresh(2026),
      for (final String key in SyncPlanner.expectedCoreKeys(2026))
        key: at(key, p2, season: 2026),
      calendarKey: at(calendarKey, calendar, season: calendarSeason),
      manifestKey: at(manifestKey, manifest, season: manifestSeason),
    };

    List<String> plannedKeys(SyncPlan plan) => <String>[
      for (final SyncPlanStage stage in plan.stages)
        for (final SyncResource resource in stage.resources) resource.key,
    ];

    test('a record from an earlier release than the manifest is due', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(
          metadata: releaseMetadata(calendar: p1, manifest: p2),
        ),
      );
      expect(plannedKeys(plan), <String>[calendarKey]);
    });

    test('a record from the same or a later release is not due', () {
      for (final DateTime calendar in <DateTime>[
        p2,
        p2.add(const Duration(minutes: 1)),
      ]) {
        final SyncPlan plan = SyncPlanner.plan(
          input(
            metadata: releaseMetadata(calendar: calendar, manifest: p2),
          ),
        );
        expect(plannedKeys(plan), isEmpty);
      }
    });

    test('nothing is compared without both publication instants', () {
      expect(
        plannedKeys(
          SyncPlanner.plan(
            input(metadata: releaseMetadata(calendar: p1, manifest: null)),
          ),
        ),
        isEmpty,
      );
      expect(
        plannedKeys(
          SyncPlanner.plan(
            input(metadata: releaseMetadata(calendar: null, manifest: p2)),
          ),
        ),
        isEmpty,
      );
    });

    test('a record of another season is never compared with the manifest', () {
      final SyncPlan plan = SyncPlanner.plan(
        input(
          metadata: releaseMetadata(
            calendar: p1,
            manifest: p2,
            calendarSeason: 2025,
          ),
        ),
      );
      expect(plannedKeys(plan), isEmpty);
    });

    test('a manifest accepted under another season is never compared', () {
      // After a season transition the stored manifest can still hold the
      // outgoing season's instant, later than any of the new season's.
      for (final int? manifestSeason in <int?>[2025, null]) {
        final SyncPlan plan = SyncPlanner.plan(
          input(
            metadata: releaseMetadata(
              calendar: p1,
              manifest: p2,
              manifestSeason: manifestSeason,
            ),
          ),
        );
        expect(plannedKeys(plan), isEmpty, reason: 'manifest $manifestSeason');
      }
    });

    test('nothing is compared without a resolved current season', () {
      expect(
        isBehindManifestRelease(
          at(calendarKey, p1),
          at(manifestKey, p2),
          currentSeason: null,
        ),
        isFalse,
      );
    });

    test('a key already refreshed in this run is not made due again', () {
      final SyncPlan plan = SyncPlanner.plan(
        SyncPlanInput(
          trigger: SyncTrigger.foreground,
          now: now,
          currentSeason: 2026,
          hasUsableFirstScreenCache: true,
          bootstrapMaterialized: true,
          metadata: releaseMetadata(calendar: p1, manifest: p2),
          attemptedKeys: <String>{calendarKey},
        ),
      );
      expect(plannedKeys(plan), isEmpty);
    });

    test('the per-run guard never hides an expired resource', () {
      final Map<String, ResourceSyncState?> metadata =
          releaseMetadata(calendar: p1, manifest: p2)
            ..[calendarKey] = fresh(calendarKey).copyWith(
              generatedAt: p1,
              staleAfter: now.subtract(const Duration(minutes: 1)),
            );
      final SyncPlan plan = SyncPlanner.plan(
        SyncPlanInput(
          trigger: SyncTrigger.foreground,
          now: now,
          currentSeason: 2026,
          hasUsableFirstScreenCache: true,
          bootstrapMaterialized: true,
          metadata: metadata,
          attemptedKeys: <String>{calendarKey},
        ),
      );
      expect(plannedKeys(plan), <String>[calendarKey]);
    });

    test('the manifest is never due through its own instant', () {
      expect(
        isBehindManifestRelease(
          at(manifestKey, p1, season: 2026),
          at(manifestKey, p2, season: 2026),
          currentSeason: 2026,
        ),
        isFalse,
      );
    });

    test('a record without a recorded success is left to the due rule', () {
      expect(
        isBehindManifestRelease(
          ResourceSyncState(resourceKey: calendarKey, generatedAt: p1),
          at(manifestKey, p2, season: 2026),
          currentSeason: 2026,
        ),
        isFalse,
      );
    });

    group("Home's cached latest race result", () {
      const GrandPrixResultsSyncResource shown = GrandPrixResultsSyncResource(
        2026,
        17,
      );
      final String resultKey = shown.key;

      bool behind({
        ResourceSyncState? result,
        GrandPrixResultsSyncResource latest = shown,
        int? currentSeason = 2026,
        DateTime? manifest,
        Set<String> attemptedKeys = const <String>{},
      }) => SyncPlanner.isLatestResultBehindRelease(
        shown: latest,
        currentSeason: currentSeason,
        result: result,
        manifest: at(manifestKey, manifest ?? p2, season: 2026),
        attemptedKeys: attemptedKeys,
      );

      test('is refreshed when its record is behind the release', () {
        expect(behind(result: at(resultKey, p1, season: 2026)), isTrue);
      });

      test('a result never loaded stays on demand', () {
        expect(behind(result: null), isFalse);
        expect(
          behind(
            result: ResourceSyncState(
              resourceKey: resultKey,
              season: 2026,
              generatedAt: p1,
            ),
          ),
          isFalse,
          reason: 'no recorded success',
        );
      });

      test('a result on the current release is not refreshed, even when its '
          'own expiry has passed', () {
        final ResourceSyncState expired = at(
          resultKey,
          p2,
          season: 2026,
        ).copyWith(staleAfter: now.subtract(const Duration(minutes: 1)));
        expect(behind(result: expired), isFalse);
      });

      test('is attempted at most once per run', () {
        expect(
          behind(
            result: at(resultKey, p1, season: 2026),
            attemptedKeys: <String>{resultKey},
          ),
          isFalse,
        );
      });

      test('a result of another season is never refreshed', () {
        expect(
          behind(
            result: at(resultKey, p1, season: 2025),
            latest: const GrandPrixResultsSyncResource(2025, 17),
          ),
          isFalse,
        );
        expect(
          behind(result: at(resultKey, p1, season: 2026), currentSeason: null),
          isFalse,
        );
      });

      test('a plan never contains it: it is no automatic core resource', () {
        final SyncPlan plan = SyncPlanner.plan(
          input(
            trigger: SyncTrigger.manual,
            metadata: <String, ResourceSyncState?>{
              ...releaseMetadata(calendar: p1, manifest: p2),
              resultKey: at(resultKey, p1, season: 2026),
            },
          ),
        );
        expect(plannedKeys(plan), isNot(contains(resultKey)));
      });
    });
  });
}
