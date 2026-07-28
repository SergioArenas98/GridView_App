import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/circuits/application/circuit_detail_providers.dart';
import 'package:gridview/features/constructors/application/team_detail_providers.dart';
import 'package:gridview/features/drivers/application/driver_detail_providers.dart';
import 'package:gridview/features/shared/application/entity_detail_controller.dart';
import 'package:gridview/features/shared/application/entity_detail_scope.dart';
import 'package:gridview/features/shared/application/entity_detail_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';

Future<void> _settle([int iterations = 10]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// The on-demand detail controllers' ownership rules (ADR 0015).
///
/// A detail is not part of the current-season core set: opening one requests
/// **exactly** its own resource, at most once per entry, for the exact resolved
/// season — and nothing else. Without a season it makes no request at all.
void main() {
  const int currentSeason = 2026;
  const int historicalSeason = 2021;

  late FakeDriverRepository drivers;
  late FakeConstructorRepository constructors;
  late FakeCircuitRepository circuits;

  ProviderContainer container({int? localCurrentSeason = currentSeason}) {
    final ProviderContainer c = ProviderContainer(
      overrides: [
        driverRepositoryProvider.overrideWithValue(drivers),
        constructorRepositoryProvider.overrideWithValue(constructors),
        circuitRepositoryProvider.overrideWithValue(circuits),
        currentSeasonProvider.overrideWith(
          (Ref ref) => Stream<int?>.value(localCurrentSeason),
        ),
        resourceSyncStateProvider.overrideWith(
          (Ref ref, String key) => Stream<ResourceSyncState?>.value(
            ResourceSyncState(resourceKey: key),
          ),
        ),
        clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  setUp(() {
    drivers = FakeDriverRepository(
      profile: (int s, String id) =>
          driverProfileFixture(season: s, driverId: id),
    );
    constructors = FakeConstructorRepository(
      profile: (int s, String id) =>
          teamProfileFixture(season: s, constructorId: id),
    );
    circuits = FakeCircuitRepository(
      profile: (int s, String id) =>
          circuitProfileFixture(season: s, circuitId: id),
    );
  });

  /// Subscribes to a driver detail exactly as the screen does, and settles.
  Future<ProviderSubscription<Object?>> openDriver(
    ProviderContainer c,
    EntityDetailScope scope,
  ) async {
    c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
    final ProviderSubscription<Object?> sub = c.listen(
      driverDetailStateProvider(scope),
      (_, _) {},
      fireImmediately: true,
    );
    await _settle();
    return sub;
  }

  group('season context', () {
    test('an origin season is used exactly, never the current one', () async {
      final ProviderContainer c = container();
      await openDriver(
        c,
        const EntityDetailScope(
          entityId: 'max-verstappen',
          originSeason: historicalSeason,
        ),
      );
      expect(drivers.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'max-verstappen', season: historicalSeason),
      ]);
    });

    test(
      'a deep link with no origin resolves the local current season',
      () async {
        final ProviderContainer c = container();
        await openDriver(
          c,
          const EntityDetailScope(entityId: 'max-verstappen'),
        );
        expect(drivers.detailRefreshes, <DetailRefreshCall>[
          (entityId: 'max-verstappen', season: currentSeason),
        ]);
      },
    );

    test('no resolvable season makes no request at all', () async {
      final ProviderContainer c = container(localCurrentSeason: null);
      await openDriver(c, const EntityDetailScope(entityId: 'max-verstappen'));
      expect(drivers.detailRefreshCount, 0);
      expect(
        c.read(
          driverDetailStateProvider(
            const EntityDetailScope(entityId: 'max-verstappen'),
          ),
        ),
        isA<EntityDetailSeasonUnavailable<DriverProfile>>(),
      );
    });

    test(
      'the same entity in two seasons is two independent controllers',
      () async {
        final ProviderContainer c = container();
        await openDriver(
          c,
          const EntityDetailScope(
            entityId: 'max-verstappen',
            originSeason: 2026,
          ),
        );
        await openDriver(
          c,
          const EntityDetailScope(
            entityId: 'max-verstappen',
            originSeason: 2021,
          ),
        );
        expect(drivers.detailRefreshes, <DetailRefreshCall>[
          (entityId: 'max-verstappen', season: 2026),
          (entityId: 'max-verstappen', season: 2021),
        ]);
      },
    );
  });

  group('exactly one request per entry', () {
    test('opening a driver requests only that driver detail', () async {
      final ProviderContainer c = container();
      await openDriver(c, const EntityDetailScope(entityId: 'lando-norris'));

      expect(drivers.detailRefreshCount, 1);
      // Nothing else was touched.
      expect(drivers.collectionRefreshCount, 0);
      expect(constructors.detailRefreshCount, 0);
      expect(constructors.collectionRefreshCount, 0);
      expect(circuits.detailRefreshCount, 0);
      expect(circuits.collectionRefreshCount, 0);
    });

    test(
      're-reading the state (a rebuild) creates no duplicate request',
      () async {
        final ProviderContainer c = container();
        const EntityDetailScope scope = EntityDetailScope(
          entityId: 'lando-norris',
        );
        await openDriver(c, scope);
        for (int i = 0; i < 5; i++) {
          c.read(driverDetailStateProvider(scope));
        }
        await _settle();
        expect(drivers.detailRefreshCount, 1);
      },
    );

    test('repeated local emissions create no duplicate request', () async {
      final StreamController<DriverProfile?> emissions =
          StreamController<DriverProfile?>.broadcast();
      addTearDown(emissions.close);
      drivers = FakeDriverRepository(
        profileStream: (int s, String id) => emissions.stream,
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(
        entityId: 'lando-norris',
      );
      await openDriver(c, scope);

      for (int i = 0; i < 4; i++) {
        emissions.add(driverProfileFixture(driverId: 'lando-norris'));
        await _settle(2);
      }
      expect(drivers.detailRefreshCount, 1);
    });

    test('opening a team requests only that team detail', () async {
      final ProviderContainer c = container();
      c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
      c.listen(
        teamDetailStateProvider(const EntityDetailScope(entityId: 'alpine')),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();

      expect(constructors.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'alpine', season: currentSeason),
      ]);
      expect(constructors.collectionRefreshCount, 0);
      expect(drivers.detailRefreshCount, 0);
      expect(circuits.detailRefreshCount, 0);
    });

    test('opening a circuit requests only that circuit detail', () async {
      final ProviderContainer c = container();
      c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
      c.listen(
        circuitDetailStateProvider(const EntityDetailScope(entityId: 'monza')),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();

      expect(circuits.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'monza', season: currentSeason),
      ]);
      expect(circuits.collectionRefreshCount, 0);
      expect(drivers.detailRefreshCount, 0);
      expect(constructors.detailRefreshCount, 0);
    });
  });

  group('local content renders before the refresh completes', () {
    test(
      'a cached summary is available while the request is in flight',
      () async {
        final Completer<RefreshResult> gate = Completer<RefreshResult>();
        drivers = FakeDriverRepository(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
          onRefreshDetail: (String id, int s) => gate.future,
        );
        final ProviderContainer c = container();
        const EntityDetailScope scope = EntityDetailScope(
          entityId: 'max-verstappen',
        );
        await openDriver(c, scope);

        final EntityDetailState<DriverProfile> state = c.read(
          driverDetailStateProvider(scope),
        );
        expect(state, isA<EntityDetailReady<DriverProfile>>());
        final ready = state as EntityDetailReady<DriverProfile>;
        expect(ready.refreshing, isTrue);
        expect(ready.profile.driver.fullName, 'Max Verstappen');
        expect(
          ready.materialized,
          isFalse,
          reason: 'partial, not materialized',
        );

        gate.complete(const RefreshSuccess());
        await _settle();
      },
    );
  });

  group('failure, not-found, cancellation and retry', () {
    test('a 404 with no local entity becomes a definitive not-found', () async {
      drivers = FakeDriverRepository(
        onRefreshDetail: (String id, int s) async =>
            const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(entityId: 'ghost');
      await openDriver(c, scope);

      expect(
        c.read(driverDetailStateProvider(scope)),
        isA<EntityDetailNotFound<DriverProfile>>(),
      );
    });

    test('a 404 with a real local summary keeps the partial content', () async {
      drivers = FakeDriverRepository(
        profile: (int s, String id) =>
            partialDriverProfileFixture(season: s, driverId: id),
        onRefreshDetail: (String id, int s) async =>
            const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(
        entityId: 'max-verstappen',
      );
      await openDriver(c, scope);

      final ready =
          c.read(driverDetailStateProvider(scope))
              as EntityDetailReady<DriverProfile>;
      expect(ready.detailUnavailable, isTrue);
      expect(ready.profile.driver.fullName, 'Max Verstappen');
    });

    test('a transient failure with no local entity is recoverable', () async {
      drivers = FakeDriverRepository(
        onRefreshDetail: (String id, int s) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(entityId: 'someone');
      await openDriver(c, scope);

      expect(
        c.read(driverDetailStateProvider(scope)),
        isA<EntityDetailFirstLoadError<DriverProfile>>(),
      );

      // Retry issues exactly one more request for the same resource.
      await c.read(driverDetailControllerProvider(scope).notifier).retry();
      expect(drivers.detailRefreshCount, 2);
      expect(
        drivers.detailRefreshes
            .map((DetailRefreshCall r) => r.entityId)
            .toSet(),
        <String>{'someone'},
      );
    });

    test(
      'a cancellation clears the transient state and stays retryable',
      () async {
        drivers = FakeDriverRepository(
          onRefreshDetail: (String id, int s) async =>
              const RefreshFailure(ApiFailure(kind: ApiFailureKind.cancelled)),
        );
        final ProviderContainer c = container();
        const EntityDetailScope scope = EntityDetailScope(entityId: 'someone');
        await openDriver(c, scope);

        final EntityDetailStatus status = c.read(
          driverDetailControllerProvider(scope),
        );
        expect(status.refresh.inProgress, isFalse);
        expect(status.refresh.lastFailure, isNull);
        expect(status.notFound, isFalse);

        await c.read(driverDetailControllerProvider(scope).notifier).retry();
        expect(drivers.detailRefreshCount, 2);
      },
    );

    test('a successful retry clears a previous not-found', () async {
      bool firstCall = true;
      drivers = FakeDriverRepository(
        onRefreshDetail: (String id, int s) async {
          if (firstCall) {
            firstCall = false;
            return const RefreshFailure(
              ApiFailure(kind: ApiFailureKind.notFound),
            );
          }
          return const RefreshSuccess();
        },
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(entityId: 'someone');
      await openDriver(c, scope);
      expect(c.read(driverDetailControllerProvider(scope)).notFound, isTrue);

      await c.read(driverDetailControllerProvider(scope).notifier).retry();
      expect(c.read(driverDetailControllerProvider(scope)).notFound, isFalse);
    });

    test('repeated retries while one is in flight collapse into one', () async {
      final Completer<RefreshResult> gate = Completer<RefreshResult>();
      drivers = FakeDriverRepository(
        onRefreshDetail: (String id, int s) => gate.future,
      );
      final ProviderContainer c = container();
      const EntityDetailScope scope = EntityDetailScope(entityId: 'someone');
      await openDriver(c, scope);
      expect(drivers.detailRefreshCount, 1);

      final EntityDetailController controller = c.read(
        driverDetailControllerProvider(scope).notifier,
      );
      final Future<void> a = controller.retry();
      final Future<void> b = controller.retry();
      gate.complete(const RefreshSuccess());
      await Future.wait(<Future<void>>[a, b]);

      expect(
        drivers.detailRefreshCount,
        1,
        reason: 'the entry request was still in flight',
      );
    });

    test('retry makes no request without a resolvable season', () async {
      final ProviderContainer c = container(localCurrentSeason: null);
      const EntityDetailScope scope = EntityDetailScope(entityId: 'someone');
      await openDriver(c, scope);
      await c.read(driverDetailControllerProvider(scope).notifier).retry();
      expect(drivers.detailRefreshCount, 0);
    });
  });

  group('team and circuit season propagation', () {
    test('a historical team detail requests its exact season', () async {
      final ProviderContainer c = container();
      c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
      c.listen(
        teamDetailStateProvider(
          const EntityDetailScope(
            entityId: 'alpine',
            originSeason: historicalSeason,
          ),
        ),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();
      expect(constructors.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'alpine', season: historicalSeason),
      ]);
    });

    test('a circuit opened from a Grand Prix uses that event season', () async {
      final ProviderContainer c = container();
      c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
      c.listen(
        circuitDetailStateProvider(
          const EntityDetailScope(entityId: 'monza', originSeason: 2019),
        ),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();
      expect(circuits.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'monza', season: 2019),
      ]);
    });
  });
}
