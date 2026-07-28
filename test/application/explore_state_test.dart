import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/explore/application/explore_state.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/entity_fixtures.dart';

/// The Explore collection state derivation, in isolation.
///
/// Materialization is decided by persisted synchronization metadata — the
/// collection's own record, or an accepted bootstrap for the exact same season —
/// and never by the number of rows. A bootstrap-only collection is therefore a
/// valid, present representation that nonetheless claims **no** freshness of its
/// own (ADR 0014).
void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12);
  const int season = 2026;

  ResourceSyncState synced({
    required String key,
    int? scopeSeason,
    DateTime? staleAfter,
    DateTime? lastSuccessAt,
  }) => ResourceSyncState(
    resourceKey: key,
    season: scopeSeason,
    lastSuccessAt: lastSuccessAt ?? now.subtract(const Duration(minutes: 5)),
    generatedAt: now.subtract(const Duration(minutes: 5)),
    staleAfter: staleAfter,
  );

  ExploreCollectionState<SeasonDriverCard> derive({
    int? forSeason = season,
    bool seasonReady = true,
    List<SeasonDriverCard>? cards,
    ResourceSyncState? metadata,
    bool metadataReady = true,
    ResourceSyncState? bootstrap,
    bool bootstrapReady = true,
    bool refreshing = false,
    ApiFailure? lastFailure,
    bool syncSettled = true,
  }) => computeExploreCollectionState<SeasonDriverCard>(
    season: forSeason,
    seasonReady: seasonReady,
    cards: cards,
    metadata: metadata,
    metadataReady: metadataReady,
    bootstrapMetadata: bootstrap,
    bootstrapMetadataReady: bootstrapReady,
    refreshing: refreshing,
    lastFailure: lastFailure,
    syncSettled: syncSettled,
    now: now,
  );

  group('materialization', () {
    test('own metadata + rows is ready with its own freshness', () {
      final state = derive(
        cards: seasonDriverCardsFixture(),
        metadata: synced(key: 'drivers:2026'),
      );
      expect(state, isA<ExploreCollectionReady<SeasonDriverCard>>());
      final ready = state as ExploreCollectionReady<SeasonDriverCard>;
      expect(ready.cards, hasLength(5));
      expect(ready.freshness, FreshnessState.fresh);
      expect(ready.lastSuccessAt, isNotNull);
    });

    test('own metadata + zero rows is empty, not loading', () {
      final state = derive(
        cards: const <SeasonDriverCard>[],
        metadata: synced(key: 'drivers:2026'),
      );
      expect(state, isA<ExploreCollectionEmpty<SeasonDriverCard>>());
      expect(
        (state as ExploreCollectionEmpty<SeasonDriverCard>).freshness,
        FreshnessState.fresh,
      );
    });

    test(
      'same-season bootstrap + rows is ready without individual freshness',
      () {
        final state = derive(
          cards: seasonDriverCardsFixture(),
          metadata: null,
          bootstrap: synced(key: 'bootstrap', scopeSeason: season),
        );
        final ready = state as ExploreCollectionReady<SeasonDriverCard>;
        expect(ready.cards, isNotEmpty);
        expect(
          ready.freshness,
          isNull,
          reason:
              'bootstrap provenance is never borrowed as this resource\'s own',
        );
        expect(
          ready.lastSuccessAt,
          isNull,
          reason: 'no fabricated update time',
        );
        expect(ready.isStale, isFalse, reason: 'unknown is not stale');
      },
    );

    test('same-season bootstrap + zero rows is empty without freshness', () {
      final state = derive(
        cards: const <SeasonDriverCard>[],
        metadata: null,
        bootstrap: synced(key: 'bootstrap', scopeSeason: season),
      );
      final empty = state as ExploreCollectionEmpty<SeasonDriverCard>;
      expect(empty.freshness, isNull);
      expect(empty.lastSuccessAt, isNull);
    });

    test(
      'an older season bootstrap does not materialize the current season',
      () {
        final state = derive(
          cards: const <SeasonDriverCard>[],
          metadata: null,
          bootstrap: synced(key: 'bootstrap', scopeSeason: 2025),
        );
        expect(state, isA<ExploreCollectionLoading<SeasonDriverCard>>());
      },
    );

    test('no matching materialization is loading, not empty', () {
      final state = derive(cards: const <SeasonDriverCard>[]);
      expect(state, isA<ExploreCollectionLoading<SeasonDriverCard>>());
    });

    test('a stale boundary is reported as stale', () {
      final state = derive(
        cards: seasonDriverCardsFixture(),
        metadata: synced(
          key: 'drivers:2026',
          staleAfter: now.subtract(const Duration(minutes: 1)),
        ),
      );
      expect(
        (state as ExploreCollectionReady<SeasonDriverCard>).isStale,
        isTrue,
      );
    });
  });

  group('season resolution', () {
    test('an unresolved season while settling is loading', () {
      expect(
        derive(forSeason: null, seasonReady: false),
        isA<ExploreCollectionLoading<SeasonDriverCard>>(),
      );
      expect(
        derive(forSeason: null, syncSettled: false),
        isA<ExploreCollectionLoading<SeasonDriverCard>>(),
      );
    });

    test('a settled unresolved season is a first-load error', () {
      final state = derive(forSeason: null);
      expect(state, isA<ExploreCollectionFirstLoadError<SeasonDriverCard>>());
      expect(
        (state as ExploreCollectionFirstLoadError<SeasonDriverCard>)
            .failure
            .cause,
        ExploreFailureCause.seasonUnresolved,
      );
    });
  });

  group('failures', () {
    test('no local data plus a failure is a first-load error', () {
      final state = derive(
        cards: const <SeasonDriverCard>[],
        lastFailure: const ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      expect(state, isA<ExploreCollectionFirstLoadError<SeasonDriverCard>>());
      expect(
        (state as ExploreCollectionFirstLoadError<SeasonDriverCard>)
            .failure
            .cause,
        ExploreFailureCause.resourceFailed,
      );
    });

    test('cached cards survive a failure as a non-blocking refresh error', () {
      final state = derive(
        cards: seasonDriverCardsFixture(),
        metadata: synced(key: 'drivers:2026'),
        lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
      );
      final ready = state as ExploreCollectionReady<SeasonDriverCard>;
      expect(ready.cards, isNotEmpty, reason: 'content is never replaced');
      expect(ready.refreshError, isNotNull);
      expect(ready.refreshError!.cause, ExploreFailureCause.resourceFailed);
    });

    test('a failure is not reported while a refresh is still running', () {
      final state = derive(
        cards: seasonDriverCardsFixture(),
        metadata: synced(key: 'drivers:2026'),
        refreshing: true,
        lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
      );
      final ready = state as ExploreCollectionReady<SeasonDriverCard>;
      expect(ready.refreshing, isTrue);
      expect(ready.refreshError, isNull);
    });
  });

  group('screen state', () {
    ExploreScreenState screen(ExploreCategory selected) => ExploreScreenState(
      selected: selected,
      season: season,
      drivers: ExploreCollectionReady<SeasonDriverCard>(
        season: season,
        cards: seasonDriverCardsFixture(),
        freshness: FreshnessState.fresh,
        refreshing: true,
      ),
      teams: const ExploreCollectionLoading<SeasonTeamCard>(),
      circuits: ExploreCollectionFirstLoadError<SeasonCircuitCard>(
        const ExploreFailure.resource(
          ApiFailure(kind: ApiFailureKind.serverUnavailable),
        ),
      ),
    );

    test('the three categories are derived independently', () {
      final ExploreScreenState state = screen(ExploreCategory.drivers);
      expect(state.drivers, isA<ExploreCollectionReady<SeasonDriverCard>>());
      expect(state.teams, isA<ExploreCollectionLoading<SeasonTeamCard>>());
      expect(
        state.circuits,
        isA<ExploreCollectionFirstLoadError<SeasonCircuitCard>>(),
        reason: "one collection's failure is never another's error",
      );
    });

    test('progress is scoped to the selected collection', () {
      expect(screen(ExploreCategory.drivers).selectedRefreshing, isTrue);
      expect(screen(ExploreCategory.teams).selectedRefreshing, isFalse);
      expect(screen(ExploreCategory.circuits).selectedRefreshing, isFalse);
    });
  });

  test('every category is route-addressable by its own segment', () {
    expect(ExploreCategory.drivers.segment, 'drivers');
    expect(ExploreCategory.teams.segment, 'teams');
    expect(ExploreCategory.circuits.segment, 'circuits');
  });
}
