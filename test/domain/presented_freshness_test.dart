import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/features/shared/domain/collection_materialization.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

final DateTime _staleAfter = DateTime.utc(2026, 7, 18, 12, 15);
final DateTime _before = DateTime.utc(2026, 7, 18, 12, 10);
final DateTime _after = DateTime.utc(2026, 7, 18, 12, 30);

ResourceSyncState _bootstrap({int season = 2026, DateTime? staleAfter}) =>
    syncedMetadata('bootstrap', season: season, staleAfter: staleAfter);

FreshnessState? _presented({
  ResourceSyncState? metadata,
  ResourceSyncState? bootstrap,
  bool fallback = true,
  int? season = 2026,
  DateTime? now,
}) => presentedFreshness(
  season: season,
  metadata: metadata,
  bootstrapMetadata: bootstrap,
  bootstrapFallback: fallback,
  now: now ?? _after,
);

void main() {
  group('presentedFreshness', () {
    test('a resource with its own record presents only that record', () {
      // Its own record is fresh while bootstrap's has expired.
      expect(
        _presented(
          metadata: syncedMetadata('calendar:2026'),
          bootstrap: _bootstrap(staleAfter: _staleAfter),
        ),
        FreshnessState.fresh,
      );
      // Its own record has expired while bootstrap's is fresh.
      expect(
        _presented(
          metadata: syncedMetadata('calendar:2026', staleAfter: _staleAfter),
          bootstrap: _bootstrap(),
        ),
        FreshnessState.stale,
      );
    });

    test('a bootstrap-only resource presents the bootstrap record', () {
      final ResourceSyncState bootstrap = _bootstrap(staleAfter: _staleAfter);

      expect(_presented(bootstrap: bootstrap), FreshnessState.stale);
      expect(
        _presented(bootstrap: bootstrap, now: _before),
        FreshnessState.fresh,
      );
    });

    test('an exact staleAfter instant is still fresh', () {
      expect(
        _presented(
          bootstrap: _bootstrap(staleAfter: _staleAfter),
          now: _staleAfter,
        ),
        FreshnessState.fresh,
      );
    });

    test('the fallback off keeps a bootstrap-only resource unknown', () {
      expect(
        _presented(
          bootstrap: _bootstrap(staleAfter: _staleAfter),
          fallback: false,
        ),
        isNull,
      );
    });

    test('another season\'s bootstrap is never borrowed', () {
      expect(
        _presented(
          bootstrap: _bootstrap(season: 2025, staleAfter: _staleAfter),
        ),
        isNull,
      );
    });

    test('no season, or no accepted bootstrap, stays unknown', () {
      expect(
        _presented(
          bootstrap: _bootstrap(staleAfter: _staleAfter),
          season: null,
        ),
        isNull,
      );
      expect(_presented(), isNull);
      expect(
        _presented(
          bootstrap: const ResourceSyncState(
            resourceKey: 'bootstrap',
            season: 2026,
          ),
        ),
        isNull,
      );
    });

    test('a failed own attempt with no success falls back to bootstrap', () {
      final ResourceSyncState attempted = ResourceSyncState(
        resourceKey: 'calendar:2026',
        season: 2026,
        lastAttemptAt: _after,
      );

      expect(
        _presented(
          metadata: attempted,
          bootstrap: _bootstrap(staleAfter: _staleAfter),
        ),
        FreshnessState.stale,
      );
    });
  });
}
