import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12, 10);

  GrandPrixDetailView detailWith({
    DateTime? staleAfter,
    bool freshnessKnown = true,
  }) => GrandPrixDetailView(
    grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
    circuit: circuitSpa(),
    freshness: freshnessKnown
        ? freshness(
            generatedAt: DateTime.utc(2026, 7, 18, 12),
            staleAfter: staleAfter,
          )
        : null,
  );

  GrandPrixDetailState compute({
    GrandPrixDetailView? cache,
    bool streamReady = true,
    bool refreshing = false,
    ApiFailure? lastFailure,
  }) => computeGrandPrixState(
    cache: cache,
    streamReady: streamReady,
    refreshing: refreshing,
    lastFailure: lastFailure,
    now: now,
  );

  test('loading with no cache and no emission', () {
    expect(compute(streamReady: false), isA<GrandPrixLoading>());
  });

  test('not-found after a successful refresh with no cache', () {
    final GrandPrixDetailState state = compute(
      lastFailure: const ApiFailure(kind: ApiFailureKind.notFound),
    );
    expect(state, isA<GrandPrixNotFound>());
  });

  test('first-load network error with no cache', () {
    final GrandPrixDetailState state = compute(
      lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
    );
    expect(state, isA<GrandPrixFirstLoadError>());
  });

  test('cached and fresh', () {
    final GrandPrixDetailState state = compute(
      cache: detailWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 15)),
    );
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.freshness, FreshnessState.fresh);
    expect(ready.view.grandPrix.sessions, hasLength(5));
  });

  test('detail cached only indirectly (no freshness) is treated as stale', () {
    final GrandPrixDetailState state = compute(
      cache: detailWith(freshnessKnown: false),
    );
    expect((state as GrandPrixReady).freshness, FreshnessState.stale);
  });

  test('refreshing keeps cached content and clears the error', () {
    final GrandPrixDetailState state = compute(
      cache: detailWith(staleAfter: DateTime.utc(2026, 7, 18, 12, 15)),
      refreshing: true,
      lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
    );
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.refreshing, isTrue);
    expect(ready.refreshError, isNull);
  });
}
