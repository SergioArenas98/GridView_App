import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/explore/application/explore_providers.dart';
import 'package:gridview/features/explore/application/explore_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';

Future<void> _settle([int iterations = 8]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// The Explore controller's ownership rules.
///
/// Explore collections are current-season **core** resources owned by the
/// application coordinator (ADR 0015). This controller therefore never produces
/// a request of its own on creation, on a category switch or on a rebuild — only
/// the user's explicit, focused retry does, and that targets exactly one
/// collection.
void main() {
  const int season = 2026;

  late FakeDriverRepository drivers;
  late FakeConstructorRepository constructors;
  late FakeCircuitRepository circuits;

  ProviderContainer container({int? currentSeason = season}) {
    final ProviderContainer c = ProviderContainer(
      overrides: [
        driverRepositoryProvider.overrideWithValue(drivers),
        constructorRepositoryProvider.overrideWithValue(constructors),
        circuitRepositoryProvider.overrideWithValue(circuits),
        currentSeasonProvider.overrideWith(
          (Ref ref) => Stream<int?>.value(currentSeason),
        ),
        // The persisted materialization record, supplied directly so these
        // controller tests never open a database.
        resourceSyncStateProvider.overrideWith(
          (Ref ref, String key) => Stream<ResourceSyncState?>.value(
            ResourceSyncState(
              resourceKey: key,
              season: currentSeason,
              lastSuccessAt: DateTime.utc(2026, 7, 18, 11, 55),
            ),
          ),
        ),
        clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  /// Keeps the season stream alive and lets it deliver before an assertion.
  Future<void> warmUp(ProviderContainer c) async {
    c.listen(currentSeasonProvider, (_, _) {}, fireImmediately: true);
    c.listen(exploreControllerProvider, (_, _) {}, fireImmediately: true);
    await _settle();
  }

  int totalRefreshes() =>
      drivers.collectionRefreshCount +
      constructors.collectionRefreshCount +
      circuits.collectionRefreshCount;

  setUp(() {
    drivers = FakeDriverRepository(
      cards: (int s) => seasonDriverCardsFixture(season: s),
    );
    constructors = FakeConstructorRepository(
      cards: (int s) => seasonTeamCardsFixture(season: s),
    );
    circuits = FakeCircuitRepository(
      cards: (int s) => seasonCircuitCardsFixture(season: s),
    );
  });

  group('no automatic requests', () {
    test('creating the controller produces no request', () async {
      final ProviderContainer c = container();
      c.listen(exploreControllerProvider, (_, _) {}, fireImmediately: true);
      await _settle();
      expect(totalRefreshes(), 0);
    });

    test('deriving every category produces no request', () async {
      final ProviderContainer c = container();
      for (final ExploreCategory category in ExploreCategory.values) {
        c.listen(
          exploreStateProvider(category),
          (_, _) {},
          fireImmediately: true,
        );
      }
      await _settle();
      expect(totalRefreshes(), 0);
    });

    test('switching category repeatedly produces no request', () async {
      final ProviderContainer c = container();
      for (int i = 0; i < 3; i++) {
        for (final ExploreCategory category in ExploreCategory.values) {
          c.read(exploreStateProvider(category));
        }
      }
      await _settle();
      expect(totalRefreshes(), 0);
    });

    test('re-reading the same state (a rebuild) produces no request', () async {
      final ProviderContainer c = container();
      c.listen(
        exploreStateProvider(ExploreCategory.drivers),
        (_, _) {},
        fireImmediately: true,
      );
      for (int i = 0; i < 5; i++) {
        c.read(exploreStateProvider(ExploreCategory.drivers));
      }
      await _settle();
      expect(totalRefreshes(), 0);
    });
  });

  group('focused retry', () {
    test('targets only the selected collection', () async {
      final ProviderContainer c = container();
      await warmUp(c);
      await c
          .read(exploreControllerProvider.notifier)
          .retry(ExploreCategory.teams);

      expect(constructors.collectionRefreshSeasons, <int>[season]);
      expect(drivers.collectionRefreshCount, 0);
      expect(circuits.collectionRefreshCount, 0);
    });

    test('each category retries exactly its own resource', () async {
      final ProviderContainer c = container();
      await warmUp(c);
      final ExploreController controller = c.read(
        exploreControllerProvider.notifier,
      );
      await controller.retry(ExploreCategory.drivers);
      await controller.retry(ExploreCategory.circuits);

      expect(drivers.collectionRefreshSeasons, <int>[season]);
      expect(circuits.collectionRefreshSeasons, <int>[season]);
      expect(constructors.collectionRefreshCount, 0);
    });

    test('retries the exact resolved season, never a hardcoded year', () async {
      final ProviderContainer c = container(currentSeason: 2024);
      await warmUp(c);
      await c
          .read(exploreControllerProvider.notifier)
          .retry(ExploreCategory.drivers);
      expect(drivers.collectionRefreshSeasons, <int>[2024]);
    });

    test('makes no request at all when no season is resolved', () async {
      final ProviderContainer c = container(currentSeason: null);
      await warmUp(c);
      await c
          .read(exploreControllerProvider.notifier)
          .retry(ExploreCategory.drivers);
      expect(totalRefreshes(), 0);
    });

    test('repeated taps collapse into one in-flight request', () async {
      final Completer<RefreshResult> gate = Completer<RefreshResult>();
      drivers = FakeDriverRepository(
        cards: (int s) => seasonDriverCardsFixture(season: s),
        onRefreshCollection: (int s) => gate.future,
      );
      final ProviderContainer c = container();
      await warmUp(c);
      final ExploreController controller = c.read(
        exploreControllerProvider.notifier,
      );

      final Future<void> first = controller.retry(ExploreCategory.drivers);
      final Future<void> second = controller.retry(ExploreCategory.drivers);
      final Future<void> third = controller.retry(ExploreCategory.drivers);
      gate.complete(const RefreshSuccess());
      await Future.wait(<Future<void>>[first, second, third]);

      expect(drivers.collectionRefreshCount, 1);
    });

    test('a failure is surfaced without discarding cached content', () async {
      drivers = FakeDriverRepository(
        cards: (int s) => seasonDriverCardsFixture(season: s),
        onRefreshCollection: (int s) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      final ProviderContainer c = container();
      await warmUp(c);
      c.listen(
        exploreStateProvider(ExploreCategory.drivers),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();
      await c
          .read(exploreControllerProvider.notifier)
          .retry(ExploreCategory.drivers);
      await _settle();

      final ExploreRefreshState status = c.read(exploreControllerProvider);
      expect(status.drivers.lastFailure, isNotNull);
      expect(status.teams.lastFailure, isNull);
      expect(status.circuits.lastFailure, isNull);

      final ExploreScreenState state = c.read(
        exploreStateProvider(ExploreCategory.drivers),
      );
      expect(state.drivers, isA<ExploreCollectionReady<SeasonDriverCard>>());
      expect(
        (state.drivers as ExploreCollectionReady<SeasonDriverCard>).cards,
        isNotEmpty,
      );
    });

    test(
      'a cancellation clears the transient state instead of failing',
      () async {
        drivers = FakeDriverRepository(
          cards: (int s) => seasonDriverCardsFixture(season: s),
          onRefreshCollection: (int s) async =>
              const RefreshFailure(ApiFailure(kind: ApiFailureKind.cancelled)),
        );
        final ProviderContainer c = container();
        await warmUp(c);
        await c
            .read(exploreControllerProvider.notifier)
            .retry(ExploreCategory.drivers);

        final ExploreRefreshState status = c.read(exploreControllerProvider);
        expect(status.drivers.inProgress, isFalse);
        expect(status.drivers.lastFailure, isNull);
      },
    );

    test(
      'the future always completes, so an indicator can never hang',
      () async {
        drivers = FakeDriverRepository(
          onRefreshCollection: (int s) async =>
              const RefreshFailure(ApiFailure(kind: ApiFailureKind.unknown)),
        );
        final ProviderContainer c = container();
        await warmUp(c);
        await expectLater(
          c
              .read(exploreControllerProvider.notifier)
              .retry(ExploreCategory.drivers),
          completes,
        );
      },
    );
  });

  group('season scoping', () {
    test('every collection is watched under the resolved season', () async {
      final ProviderContainer c = container(currentSeason: 2024);
      await warmUp(c);
      c.listen(
        exploreStateProvider(ExploreCategory.drivers),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();
      expect(
        c.read(exploreStateProvider(ExploreCategory.drivers)).season,
        2024,
      );
    });

    test(
      'an unresolved season leaves every category without a season',
      () async {
        final ProviderContainer c = container(currentSeason: null);
        await warmUp(c);
        c.listen(
          exploreStateProvider(ExploreCategory.teams),
          (_, _) {},
          fireImmediately: true,
        );
        await _settle();
        expect(
          c.read(exploreStateProvider(ExploreCategory.teams)).season,
          isNull,
        );
        expect(totalRefreshes(), 0);
      },
    );
  });
}
