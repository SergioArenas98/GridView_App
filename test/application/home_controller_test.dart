import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/home/application/home_providers.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/fake_api.dart';

Future<void> _settle([int iterations = 40]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

ProviderContainer _container(FakeGridViewApi api, DateTime now) {
  final GridViewDatabase db = GridViewDatabase.forTesting(
    NativeDatabase.memory(),
  );
  addTearDown(db.close);
  final ProviderContainer container = ProviderContainer(
    overrides: [
      databaseProvider.overrideWithValue(db),
      remoteApiProvider.overrideWithValue(api),
      clockProvider.overrideWithValue(() => now),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  final DateTime fresh = DateTime.utc(2026, 7, 18, 12, 10); // before staleAfter
  final DateTime late = DateTime.utc(2026, 7, 18, 12, 20); // after staleAfter

  test(
    'initial state is loading, then a successful refresh yields fresh data',
    () async {
      final FakeGridViewApi api = FakeGridViewApi();
      final ProviderContainer c = _container(api, fresh);
      c.listen(homeStateProvider, (_, _) {}, fireImmediately: true);

      expect(c.read(homeStateProvider), isA<HomeLoading>());

      await _settle();
      final HomeState state = c.read(homeStateProvider);
      expect(state, isA<HomeReady>());
      expect((state as HomeReady).freshness, FreshnessState.fresh);
      expect(api.homeCalls, 1);
    },
  );

  test('a stale cache is reported stale but still visible', () async {
    final FakeGridViewApi api = FakeGridViewApi();
    final ProviderContainer c = _container(api, late);
    c.listen(homeStateProvider, (_, _) {}, fireImmediately: true);

    await _settle();
    final HomeReady ready = c.read(homeStateProvider) as HomeReady;
    expect(ready.freshness, FreshnessState.stale);
    expect(ready.view.featured.id, '2026-belgian-grand-prix');
  });

  test(
    'first-load failure with no cache surfaces a recoverable error',
    () async {
      final FakeGridViewApi api = FakeGridViewApi()
        ..homeFailure = const ApiFailure(
          kind: ApiFailureKind.networkUnavailable,
        );
      final ProviderContainer c = _container(api, fresh);
      c.listen(homeStateProvider, (_, _) {}, fireImmediately: true);

      await _settle();
      expect(c.read(homeStateProvider), isA<HomeFirstLoadError>());
    },
  );

  test('a refresh failure after a success keeps the cached content', () async {
    final FakeGridViewApi api = FakeGridViewApi();
    final ProviderContainer c = _container(api, fresh);
    c.listen(homeStateProvider, (_, _) {}, fireImmediately: true);
    await _settle();
    expect(c.read(homeStateProvider), isA<HomeReady>());

    api.homeFailure = const ApiFailure(kind: ApiFailureKind.serverUnavailable);
    await c.read(homeControllerProvider.notifier).refresh();
    await _settle();

    final HomeReady ready = c.read(homeStateProvider) as HomeReady;
    expect(ready.refreshError?.kind, ApiFailureKind.serverUnavailable);
    expect(ready.view.featured.id, '2026-belgian-grand-prix');
  });
}
