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
}
