import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12, 10);

  final GrandPrixDetailView detail = GrandPrixDetailView(
    grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
    circuit: circuitSpa(),
    freshness: freshness(
      generatedAt: DateTime.utc(2026, 7, 18, 12),
      // The cached row's own freshness is no longer what the screen reads: it
      // is already expired here, and the record below decides.
      staleAfter: DateTime.utc(2026, 7, 18, 12, 5),
    ),
  );

  ResourceSyncState record({
    required DateTime generatedAt,
    DateTime? staleAfter,
  }) => ResourceSyncState(
    resourceKey: 'grand-prix:2026:13',
    season: 2026,
    round: 13,
    generatedAt: generatedAt,
    sourceUpdatedAt: DateTime.utc(2026, 7, 18, 11, 55),
    staleAfter: staleAfter,
    contentVersion: '2026.07.18.1',
    lastSuccessAt: DateTime.utc(2026, 7, 18, 12, 1),
  );

  GrandPrixDetailState compute({
    GrandPrixDetailView? cache,
    ResourceSyncState? metadata,
    bool streamReady = true,
    bool refreshing = false,
    ApiFailure? lastFailure,
  }) => computeGrandPrixState(
    cache: cache,
    metadata: metadata,
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

  test('cached and fresh by its own metadata record', () {
    final GrandPrixDetailState state = compute(
      cache: detail,
      metadata: record(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
    );
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.freshness, FreshnessState.fresh);
    expect(ready.view.grandPrix.sessions, hasLength(5));
  });

  test('detail cached only indirectly (no record) is treated as stale', () {
    final GrandPrixDetailState state = compute(cache: detail);
    expect((state as GrandPrixReady).freshness, FreshnessState.stale);
  });

  test(
    'a metadata-only republication moves freshness with the same cached view',
    () {
      final GrandPrixReady before =
          compute(
                cache: detail,
                metadata: record(
                  generatedAt: DateTime.utc(2026, 7, 18, 11),
                  staleAfter: DateTime.utc(2026, 7, 18, 11, 15),
                ),
              )
              as GrandPrixReady;
      final GrandPrixReady after =
          compute(
                cache: detail,
                metadata: record(
                  generatedAt: DateTime.utc(2026, 7, 18, 12),
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
                ),
              )
              as GrandPrixReady;
      expect(before.freshness, FreshnessState.stale);
      expect(after.freshness, FreshnessState.fresh);
      expect(identical(before.view, after.view), isTrue);
    },
  );

  test('refreshing keeps cached content and clears the error', () {
    final GrandPrixDetailState state = compute(
      cache: detail,
      metadata: record(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
      refreshing: true,
      lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
    );
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.refreshing, isTrue);
    expect(ready.refreshError, isNull);
  });
}
