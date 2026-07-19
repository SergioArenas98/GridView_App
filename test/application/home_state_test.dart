import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12, 10);

  HomeView viewWith({DateTime? staleAfter, bool? stale}) => HomeView(
    featured: belgianGrandPrix(),
    freshness: freshness(
      generatedAt: DateTime.utc(2026, 7, 18, 12),
      staleAfter: staleAfter,
      stale: stale,
    ),
  );

  HomeState compute({
    HomeView? cache,
    bool streamReady = true,
    bool refreshing = false,
    ApiFailure? lastFailure,
  }) => computeHomeState(
    cache: cache,
    streamReady: streamReady,
    refreshing: refreshing,
    lastFailure: lastFailure,
    now: now,
  );

  test('initial loading with no cache and no emission yet', () {
    expect(compute(streamReady: false), isA<HomeLoading>());
  });

  test('no cache while a first refresh is running is loading', () {
    expect(compute(refreshing: true), isA<HomeLoading>());
  });

  test('first-load failure with no cache', () {
    final HomeState state = compute(
      lastFailure: const ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    expect(state, isA<HomeFirstLoadError>());
    expect(
      (state as HomeFirstLoadError).failure.kind,
      ApiFailureKind.networkUnavailable,
    );
  });

  test('cached and fresh', () {
    final HomeState state = compute(
      cache: viewWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 15)),
    );
    expect(state, isA<HomeReady>());
    final HomeReady ready = state as HomeReady;
    expect(ready.freshness, FreshnessState.fresh);
    expect(ready.refreshing, isFalse);
    expect(ready.refreshError, isNull);
  });

  test('cached and stale', () {
    final HomeState state = compute(
      cache: viewWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 5)),
    );
    expect((state as HomeReady).freshness, FreshnessState.stale);
    expect(state.isStale, isTrue);
  });

  test('refreshing while cached content remains visible', () {
    final HomeState state = compute(
      cache: viewWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 15)),
      refreshing: true,
    );
    final HomeReady ready = state as HomeReady;
    expect(ready.refreshing, isTrue);
    expect(ready.refreshError, isNull);
  });

  test('recoverable refresh failure keeps cached content', () {
    final HomeState state = compute(
      cache: viewWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 15)),
      lastFailure: const ApiFailure(kind: ApiFailureKind.serverUnavailable),
    );
    final HomeReady ready = state as HomeReady;
    expect(ready.refreshError?.kind, ApiFailureKind.serverUnavailable);
    expect(ready.view.featured.id, '2026-belgian-grand-prix');
  });
}
