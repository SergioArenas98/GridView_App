import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/calendar/application/grand_prix_results_state.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';

const ApiFailure _offline = ApiFailure(kind: ApiFailureKind.networkUnavailable);

RaceResult _race() => raceResultFixture(
  sessionType: SessionType.race,
  entries: <RaceResultEntry>[
    const RaceResultEntry(
      driverId: 'max-verstappen',
      constructorId: 'red-bull',
      position: 1,
      points: 25,
      status: FinishStatus.finished,
    ),
  ],
);

RaceResult _sprint() => raceResultFixture(
  sessionType: SessionType.sprint,
  entries: <RaceResultEntry>[
    const RaceResultEntry(
      driverId: 'oscar-piastri',
      constructorId: 'mclaren',
      position: 1,
      points: 8,
      status: FinishStatus.finished,
    ),
  ],
);

/// A document that exists but carries no classification — exactly what a
/// not-yet-run session persists.
RaceResult _unavailable() => raceResultFixture(
  sessionType: SessionType.race,
  status: ResultStatus.unavailable,
  entries: const <RaceResultEntry>[],
);

GrandPrixResultsState _state({
  List<RaceResult>? results,
  bool streamReady = true,
  bool expected = false,
  ResourceSyncState? metadata,
  bool refreshing = false,
  ApiFailure? lastFailure,
  DateTime? now,
}) => computeGrandPrixResultsState(
  results: results,
  streamReady: streamReady,
  expected: expected,
  metadata: metadata,
  refreshing: refreshing,
  lastFailure: lastFailure,
  now: now ?? DateTime.utc(2026, 7, 26, 18),
);

void main() {
  final ResourceSyncState synced = syncedMetadata(
    'grand-prix-results:2026:13',
    lastSuccessAt: DateTime.utc(2026, 7, 26, 17),
    staleAfter: DateTime.utc(2026, 7, 26, 17, 30),
  );

  group('nothing stored', () {
    test('an upcoming event that expects nothing is unavailable', () {
      expect(
        _state(results: const <RaceResult>[], expected: false),
        isA<GrandPrixResultsUnavailable>(),
      );
    });

    test('an event that advertises results is loading', () {
      expect(
        _state(results: const <RaceResult>[], expected: true),
        isA<GrandPrixResultsLoading>(),
      );
    });

    test(
      'a successful sync with nothing stored is unavailable, not an error',
      () {
        expect(
          _state(
            results: const <RaceResult>[],
            expected: true,
            metadata: synced,
          ),
          isA<GrandPrixResultsUnavailable>(),
        );
      },
    );

    test('a stored but empty document is not a visible classification', () {
      expect(
        _state(results: <RaceResult>[_unavailable()], metadata: synced),
        isA<GrandPrixResultsUnavailable>(),
      );
    });

    test('a failure with no cache is a scoped recoverable error', () {
      final GrandPrixResultsState state = _state(
        results: const <RaceResult>[],
        expected: true,
        lastFailure: _offline,
      );
      expect(state, isA<GrandPrixResultsError>());
      expect((state as GrandPrixResultsError).failure, _offline);
    });

    test('a refresh in progress outranks a previous failure', () {
      expect(
        _state(
          results: const <RaceResult>[],
          refreshing: true,
          lastFailure: _offline,
        ),
        isA<GrandPrixResultsLoading>(),
      );
    });

    test('a stream that has not emitted yet is loading', () {
      expect(
        _state(results: null, streamReady: false),
        isA<GrandPrixResultsLoading>(),
      );
    });
  });

  group('stored classifications', () {
    test('sprint and race documents coexist and stay separate', () {
      final GrandPrixResultsState state = _state(
        results: <RaceResult>[_sprint(), _race()],
        metadata: synced,
      );
      expect(state, isA<GrandPrixResultsReady>());
      final GrandPrixResultsReady ready = state as GrandPrixResultsReady;
      expect(ready.documents, hasLength(2));
      expect(ready.documents[0].sessionType, SessionType.sprint);
      expect(ready.documents[1].sessionType, SessionType.race);
      expect(ready.documents[0].entries.first.driverId, 'oscar-piastri');
      expect(ready.documents[1].entries.first.driverId, 'max-verstappen');
    });

    test('cached results are shown even when nothing advertises them', () {
      final GrandPrixResultsState state = _state(
        results: <RaceResult>[_race()],
        expected: false,
        metadata: synced,
      );
      expect(state, isA<GrandPrixResultsReady>());
      expect((state as GrandPrixResultsReady).documents, hasLength(1));
    });

    test('an empty document alongside a real one is filtered out', () {
      final GrandPrixResultsReady ready =
          _state(
                results: <RaceResult>[_race(), _unavailable()],
                metadata: synced,
              )
              as GrandPrixResultsReady;
      expect(ready.documents, hasLength(1));
      expect(ready.documents.single.entries, hasLength(1));
    });

    test('a refresh failure keeps the cached classifications visible', () {
      final GrandPrixResultsReady ready =
          _state(
                results: <RaceResult>[_race()],
                metadata: synced,
                lastFailure: _offline,
              )
              as GrandPrixResultsReady;
      expect(ready.documents, hasLength(1));
      expect(ready.refreshError, _offline);
    });

    test('a refresh in progress keeps content and reports no failure', () {
      final GrandPrixResultsReady ready =
          _state(
                results: <RaceResult>[_race()],
                metadata: synced,
                refreshing: true,
                lastFailure: _offline,
              )
              as GrandPrixResultsReady;
      expect(ready.refreshing, isTrue);
      expect(ready.refreshError, isNull);
      expect(ready.documents, hasLength(1));
    });

    test('result freshness is evaluated from its own metadata record', () {
      expect(
        (_state(
                  results: <RaceResult>[_race()],
                  metadata: synced,
                  now: DateTime.utc(2026, 7, 26, 17, 20),
                )
                as GrandPrixResultsReady)
            .freshness,
        FreshnessState.fresh,
      );
      expect(
        (_state(
                  results: <RaceResult>[_race()],
                  metadata: synced,
                  now: DateTime.utc(2026, 7, 26, 18),
                )
                as GrandPrixResultsReady)
            .freshness,
        FreshnessState.stale,
      );
    });
  });
}
