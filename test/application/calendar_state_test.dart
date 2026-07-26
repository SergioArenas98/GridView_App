import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/calendar/application/calendar_state.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

const ApiFailure _offline = ApiFailure(kind: ApiFailureKind.networkUnavailable);

CalendarState _state({
  int? season = 2026,
  bool seasonReady = true,
  List<CalendarEntry>? events,
  ResourceSyncState? metadata,
  bool metadataReady = true,
  ResourceSyncState? bootstrapMetadata,
  bool bootstrapMetadataReady = true,
  bool refreshing = false,
  ApiFailure? lastFailure,
  bool syncSettled = true,
  DateTime? now,
}) => computeCalendarState(
  season: season,
  seasonReady: seasonReady,
  events: events,
  metadata: metadata,
  metadataReady: metadataReady,
  bootstrapMetadata: bootstrapMetadata,
  bootstrapMetadataReady: bootstrapMetadataReady,
  refreshing: refreshing,
  lastFailure: lastFailure,
  syncSettled: syncSettled,
  now: now ?? DateTime.utc(2026, 7, 18, 12, 5),
);

/// An accepted bootstrap that applied [season]'s collections.
ResourceSyncState acceptedBootstrap({int season = 2026}) => ResourceSyncState(
  resourceKey: 'bootstrap',
  season: season,
  etag: 'W/"bootstrap-1"',
  generatedAt: DateTime.utc(2026, 7, 18, 12),
  sourceUpdatedAt: DateTime.utc(2026, 7, 18, 11, 55),
  staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  lastAttemptAt: DateTime.utc(2026, 7, 18, 12),
  lastSuccessAt: DateTime.utc(2026, 7, 18, 12),
);

void main() {
  final ResourceSyncState synced = syncedMetadata(
    'calendar:2026',
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  );

  group('loading', () {
    test('no resolved season and nothing settled is loading', () {
      expect(
        _state(season: null, seasonReady: false, syncSettled: false),
        isA<CalendarLoading>(),
      );
    });

    test('a resolved season whose stream has not emitted is loading', () {
      expect(_state(events: null), isA<CalendarLoading>());
    });

    test('no metadata yet and no events is loading, never empty', () {
      expect(
        _state(events: const <CalendarEntry>[], metadata: null),
        isA<CalendarLoading>(),
      );
    });

    test('metadata that has never succeeded is not a materialization', () {
      expect(
        _state(
          events: const <CalendarEntry>[],
          metadata: const ResourceSyncState(
            resourceKey: 'calendar:2026',
            etag: 'W/"x"',
          ),
        ),
        isA<CalendarLoading>(),
      );
    });
  });

  group('first-load error', () {
    test('an unresolvable season becomes a controlled recoverable state', () {
      final CalendarState state = _state(season: null);
      expect(state, isA<CalendarFirstLoadError>());
      expect(
        (state as CalendarFirstLoadError).failure.cause,
        CalendarFailureCause.seasonUnresolved,
      );
      expect(state.failure.failure, isNull);
    });

    test('an unresolved season is not an error until a run has settled', () {
      expect(_state(season: null, syncSettled: false), isA<CalendarLoading>());
    });

    test('no representation plus a failure is a first-load error', () {
      final CalendarState state = _state(
        events: const <CalendarEntry>[],
        metadata: null,
        lastFailure: _offline,
      );
      expect(state, isA<CalendarFirstLoadError>());
      expect(
        (state as CalendarFirstLoadError).failure.cause,
        CalendarFailureCause.resourceFailed,
      );
      expect(state.failure.failure, _offline);
    });

    test('a failure while still refreshing stays loading', () {
      expect(
        _state(
          events: const <CalendarEntry>[],
          lastFailure: _offline,
          refreshing: true,
        ),
        isA<CalendarLoading>(),
      );
    });
  });

  group('empty', () {
    test('a materialized empty calendar is a valid empty state', () {
      final CalendarState state = _state(
        events: const <CalendarEntry>[],
        metadata: synced,
      );
      expect(state, isA<CalendarEmpty>());
      expect((state as CalendarEmpty).season, 2026);
      expect(state.lastSuccessAt, synced.lastSuccessAt);
    });

    test('a valid empty calendar keeps a non-blocking refresh failure', () {
      final CalendarState state = _state(
        events: const <CalendarEntry>[],
        metadata: synced,
        lastFailure: _offline,
      );
      expect(state, isA<CalendarEmpty>());
      expect((state as CalendarEmpty).refreshError?.failure, _offline);
    });
  });

  group('ready', () {
    test('cached events render with the relevant event resolved', () {
      final CalendarState state = _state(
        events: calendarFixture(),
        metadata: synced,
      );
      expect(state, isA<CalendarReady>());
      final CalendarReady ready = state as CalendarReady;
      expect(ready.events, hasLength(5));
      expect(ready.relevantEventId, '2026-belgian-grand-prix');
      expect(ready.relevant!.inProgress, isFalse);
    });

    test('the persisted order is preserved exactly', () {
      final CalendarReady ready =
          _state(events: calendarFixture(), metadata: synced) as CalendarReady;
      expect(ready.events.map((CalendarEntry e) => e.round), <int>[
        11,
        12,
        13,
        14,
        15,
      ]);
    });

    test('a refresh failure keeps the cached events visible', () {
      final CalendarState state = _state(
        events: calendarFixture(),
        metadata: synced,
        lastFailure: _offline,
      );
      expect(state, isA<CalendarReady>());
      final CalendarReady ready = state as CalendarReady;
      expect(ready.events, hasLength(5));
      expect(ready.refreshError?.cause, CalendarFailureCause.resourceFailed);
    });

    test('a refresh in progress reports no failure and keeps content', () {
      final CalendarReady ready =
          _state(
                events: calendarFixture(),
                metadata: synced,
                refreshing: true,
                lastFailure: _offline,
              )
              as CalendarReady;
      expect(ready.refreshing, isTrue);
      expect(ready.refreshError, isNull);
      expect(ready.events, hasLength(5));
    });

    test('cached events render even before metadata has been read', () {
      final CalendarState state = _state(
        events: calendarFixture(),
        metadata: null,
        metadataReady: false,
      );
      expect(state, isA<CalendarReady>());
      // The calendar resource has no record of its own yet: freshness is
      // unknown, which is neither fresh nor stale.
      final CalendarReady ready = state as CalendarReady;
      expect(ready.freshness, isNull);
      expect(ready.isStale, isFalse);
    });
  });

  group('freshness', () {
    test('before staleAfter the calendar is fresh', () {
      final CalendarReady ready =
          _state(
                events: calendarFixture(),
                metadata: synced,
                now: DateTime.utc(2026, 7, 18, 12, 14, 59),
              )
              as CalendarReady;
      expect(ready.freshness, FreshnessState.fresh);
      expect(ready.isStale, isFalse);
    });

    test('after staleAfter the calendar is stale', () {
      final CalendarReady ready =
          _state(
                events: calendarFixture(),
                metadata: synced,
                now: DateTime.utc(2026, 7, 18, 12, 15, 1),
              )
              as CalendarReady;
      expect(ready.freshness, FreshnessState.stale);
      expect(ready.isStale, isTrue);
    });

    test('a server stale flag makes it stale without a staleAfter', () {
      final CalendarReady ready =
          _state(
                events: calendarFixture(),
                metadata: syncedMetadata('calendar:2026', serverStale: true),
              )
              as CalendarReady;
      expect(ready.freshness, FreshnessState.stale);
    });
  });

  group('bootstrap materialization', () {
    test('an accepted bootstrap for this season materializes an empty '
        'calendar', () {
      final CalendarState state = _state(
        metadata: null,
        events: const <CalendarEntry>[],
        bootstrapMetadata: acceptedBootstrap(),
      );
      expect(state, isA<CalendarEmpty>());
      expect((state as CalendarEmpty).season, 2026);
    });

    test(
      'an accepted bootstrap never claims individual calendar freshness',
      () {
        final CalendarEmpty empty =
            _state(
                  metadata: null,
                  events: const <CalendarEntry>[],
                  bootstrapMetadata: acceptedBootstrap(),
                )
                as CalendarEmpty;
        expect(empty.freshness, isNull, reason: 'no record of its own');
        expect(empty.isStale, isFalse);
        expect(empty.lastSuccessAt, isNull);
      },
    );

    test('an accepted bootstrap for this season renders stored events', () {
      final CalendarState state = _state(
        metadata: null,
        events: calendarFixture(),
        bootstrapMetadata: acceptedBootstrap(),
      );
      expect(state, isA<CalendarReady>());
      expect((state as CalendarReady).events, hasLength(5));
    });

    test('a bootstrap from an older season materializes nothing', () {
      expect(
        _state(
          season: 2027,
          metadata: null,
          events: const <CalendarEntry>[],
          bootstrapMetadata: acceptedBootstrap(season: 2026),
        ),
        isA<CalendarLoading>(),
      );
    });

    test('a bootstrap that never succeeded materializes nothing', () {
      expect(
        _state(
          metadata: null,
          events: const <CalendarEntry>[],
          bootstrapMetadata: const ResourceSyncState(
            resourceKey: 'bootstrap',
            season: 2026,
            lastFailureCategory: 'networkUnavailable',
          ),
        ),
        isA<CalendarLoading>(),
      );
    });

    test('a bootstrap-materialized calendar keeps a failed later refresh '
        'non-blocking', () {
      final CalendarState state = _state(
        metadata: null,
        events: const <CalendarEntry>[],
        bootstrapMetadata: acceptedBootstrap(),
        lastFailure: _offline,
      );
      expect(state, isA<CalendarEmpty>());
      final CalendarEmpty empty = state as CalendarEmpty;
      expect(empty.refreshError?.cause, CalendarFailureCause.resourceFailed);
      expect(empty.freshness, isNull);
    });

    test('the calendar record stays the preferred freshness source', () {
      final CalendarEmpty empty =
          _state(
                metadata: syncedMetadata(
                  'calendar:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
                ),
                events: const <CalendarEntry>[],
                bootstrapMetadata: acceptedBootstrap(),
              )
              as CalendarEmpty;
      expect(empty.freshness, FreshnessState.fresh);
      expect(empty.lastSuccessAt, isNotNull);
    });

    test('an unread bootstrap record is not yet an answer', () {
      expect(
        _state(
          metadata: null,
          events: const <CalendarEntry>[],
          bootstrapMetadata: null,
          bootstrapMetadataReady: false,
        ),
        isA<CalendarLoading>(),
      );
    });
  });

  group('the materialization predicate', () {
    test('direct calendar success materializes', () {
      expect(
        hasMaterializedCalendar(
          season: 2026,
          metadata: syncedMetadata('calendar:2026'),
          bootstrapMetadata: null,
        ),
        isTrue,
      );
    });

    test('an accepted bootstrap for the same season materializes', () {
      expect(
        hasMaterializedCalendar(
          season: 2026,
          metadata: null,
          bootstrapMetadata: acceptedBootstrap(),
        ),
        isTrue,
      );
    });

    test('an accepted bootstrap for another season does not', () {
      expect(
        hasMaterializedCalendar(
          season: 2027,
          metadata: null,
          bootstrapMetadata: acceptedBootstrap(season: 2026),
        ),
        isFalse,
      );
    });

    test('a bootstrap with no recorded season does not', () {
      expect(
        hasMaterializedCalendar(
          season: 2026,
          metadata: null,
          bootstrapMetadata: ResourceSyncState(
            resourceKey: 'bootstrap',
            lastSuccessAt: DateTime.utc(2026, 7, 18, 12),
          ),
        ),
        isFalse,
      );
    });

    test('no season resolves to not materialized', () {
      expect(
        hasMaterializedCalendar(
          season: null,
          metadata: syncedMetadata('calendar:2026'),
          bootstrapMetadata: acceptedBootstrap(),
        ),
        isFalse,
      );
    });
  });

  group('season scoping', () {
    test('a season transition carries the new season through the state', () {
      final CalendarReady ready =
          _state(
                season: 2027,
                events: calendarFixture(season: 2027),
                metadata: syncedMetadata('calendar:2027', season: 2027),
                now: DateTime.utc(2027, 3, 1),
              )
              as CalendarReady;
      expect(ready.season, 2027);
      expect(ready.events.every((CalendarEntry e) => e.season == 2027), isTrue);
    });
  });
}
