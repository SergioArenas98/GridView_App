import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/domain/collection_materialization.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';
import 'package:gridview/features/standings/application/standings_state.dart';

import '../support/domain_fixtures.dart';

final DateTime _now = DateTime.utc(2026, 7, 18, 12, 10);

const ApiFailure _offline = ApiFailure(kind: ApiFailureKind.networkUnavailable);

/// Derives one drivers' table state. Every input is explicit so each variant is
/// reachable without Riverpod or a widget tree.
StandingsTableState<DriverStandingEntry> driversState({
  int? season = 2026,
  bool seasonReady = true,
  List<DriverStandingEntry>? rows = const <DriverStandingEntry>[],
  ResourceSyncState? metadata,
  bool metadataReady = true,
  ResourceSyncState? bootstrap,
  bool bootstrapReady = true,
  bool refreshing = false,
  ApiFailure? lastFailure,
  bool syncSettled = true,
}) => computeStandingsTableState<DriverStandingEntry>(
  season: season,
  seasonReady: seasonReady,
  rows: rows,
  provisionalOf: (List<DriverStandingEntry> r) =>
      r.map((DriverStandingEntry e) => e.provisional),
  metadata: metadata,
  metadataReady: metadataReady,
  bootstrapMetadata: bootstrap,
  bootstrapMetadataReady: bootstrapReady,
  refreshing: refreshing,
  lastFailure: lastFailure,
  syncSettled: syncSettled,
  now: _now,
);

StandingsTableState<ConstructorStandingEntry> constructorsState({
  int? season = 2026,
  List<ConstructorStandingEntry>? rows = const <ConstructorStandingEntry>[],
  ResourceSyncState? metadata,
  ResourceSyncState? bootstrap,
  bool refreshing = false,
  ApiFailure? lastFailure,
}) => computeStandingsTableState<ConstructorStandingEntry>(
  season: season,
  seasonReady: true,
  rows: rows,
  provisionalOf: (List<ConstructorStandingEntry> r) =>
      r.map((ConstructorStandingEntry e) => e.provisional),
  metadata: metadata,
  metadataReady: true,
  bootstrapMetadata: bootstrap,
  bootstrapMetadataReady: true,
  refreshing: refreshing,
  lastFailure: lastFailure,
  syncSettled: true,
  now: _now,
);

void main() {
  group('materialization', () {
    test('direct metadata plus rows is ready', () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        rows: driverStandingsFixture(),
        metadata: syncedMetadata('standings:drivers:2026'),
      );
      expect(state, isA<StandingsReady<DriverStandingEntry>>());
      final StandingsReady<DriverStandingEntry> ready =
          state as StandingsReady<DriverStandingEntry>;
      expect(ready.rows, hasLength(5));
      expect(ready.freshness, FreshnessState.fresh);
      expect(ready.lastSuccessAt, isNotNull);
    });

    test('direct metadata with zero rows is a valid empty table', () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        metadata: syncedMetadata('standings:drivers:2026'),
      );
      expect(state, isA<StandingsEmpty<DriverStandingEntry>>());
      expect(
        (state as StandingsEmpty<DriverStandingEntry>).freshness,
        FreshnessState.fresh,
      );
    });

    test(
      'a same-season bootstrap materializes rows without individual freshness',
      () {
        final StandingsTableState<DriverStandingEntry> state = driversState(
          rows: driverStandingsFixture(),
          bootstrap: syncedMetadata('bootstrap'),
        );
        final StandingsReady<DriverStandingEntry> ready =
            state as StandingsReady<DriverStandingEntry>;
        // Bootstrap contributes materialization only: no freshness, and no
        // "updated at" claim for a resource that has never synchronised.
        expect(ready.freshness, isNull);
        expect(ready.isStale, isFalse);
        expect(ready.lastSuccessAt, isNull);
      },
    );

    test('a same-season bootstrap makes an empty table empty, not loading', () {
      final StandingsTableState<DriverStandingEntry> drivers = driversState(
        bootstrap: syncedMetadata('bootstrap'),
      );
      final StandingsTableState<ConstructorStandingEntry> constructors =
          constructorsState(bootstrap: syncedMetadata('bootstrap'));
      expect(drivers, isA<StandingsEmpty<DriverStandingEntry>>());
      expect(
        (drivers as StandingsEmpty<DriverStandingEntry>).freshness,
        isNull,
      );
      expect(constructors, isA<StandingsEmpty<ConstructorStandingEntry>>());
      expect(
        (constructors as StandingsEmpty<ConstructorStandingEntry>)
            .lastSuccessAt,
        isNull,
      );
    });

    test('no matching materialization stays loading', () {
      expect(driversState(), isA<StandingsLoading<DriverStandingEntry>>());
      expect(
        constructorsState(),
        isA<StandingsLoading<ConstructorStandingEntry>>(),
      );
    });

    test("an older season's bootstrap does not materialize this season", () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        bootstrap: syncedMetadata('bootstrap', season: 2025),
      );
      expect(state, isA<StandingsLoading<DriverStandingEntry>>());
    });

    test('an unsuccessful bootstrap attempt materializes nothing', () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        bootstrap: const ResourceSyncState(
          resourceKey: 'bootstrap',
          season: 2026,
          lastAttemptAt: null,
        ),
      );
      expect(state, isA<StandingsLoading<DriverStandingEntry>>());
    });

    test('one championship never materializes the other', () {
      // Only the drivers' resource has synchronised.
      expect(
        driversState(metadata: syncedMetadata('standings:drivers:2026')),
        isA<StandingsEmpty<DriverStandingEntry>>(),
      );
      expect(
        constructorsState(),
        isA<StandingsLoading<ConstructorStandingEntry>>(),
      );

      // And the other way around.
      expect(
        constructorsState(
          metadata: syncedMetadata('standings:constructors:2026'),
        ),
        isA<StandingsEmpty<ConstructorStandingEntry>>(),
      );
      expect(driversState(), isA<StandingsLoading<DriverStandingEntry>>());
    });

    test('the shared collection rule is used, not a private copy', () {
      // Standings and Calendar share one materialization rule.
      expect(
        hasMaterializedCollection(
          season: 2026,
          metadata: null,
          bootstrapMetadata: syncedMetadata('bootstrap'),
        ),
        isTrue,
      );
      expect(
        hasMaterializedCollection(
          season: 2026,
          metadata: null,
          bootstrapMetadata: syncedMetadata('bootstrap', season: 2025),
        ),
        isFalse,
      );
      expect(
        hasMaterializedCollection(
          season: null,
          metadata: syncedMetadata('standings:drivers:2026'),
          bootstrapMetadata: null,
        ),
        isFalse,
      );
    });
  });

  group('season and readiness', () {
    test('an unresolved season is loading while an app run is still going', () {
      expect(
        driversState(season: null, seasonReady: false),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
      expect(
        driversState(season: null, syncSettled: false),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
      expect(
        driversState(season: null, refreshing: true),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
    });

    test('a settled run with no season is a first-load error', () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        season: null,
      );
      expect(state, isA<StandingsFirstLoadError<DriverStandingEntry>>());
      final StandingsFailure failure =
          (state as StandingsFirstLoadError<DriverStandingEntry>).failure;
      expect(failure.cause, StandingsFailureCause.seasonUnresolved);
      expect(failure.failure, isNull);
    });

    test('a stream that has not emitted yet is loading', () {
      expect(
        driversState(rows: null, metadata: syncedMetadata('x')),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
    });

    test('metadata that has not loaded yet is loading', () {
      expect(
        driversState(metadataReady: false),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
      expect(
        driversState(bootstrapReady: false),
        isA<StandingsLoading<DriverStandingEntry>>(),
      );
    });
  });

  group('failures', () {
    test('no materialization plus a failure is a first-load error', () {
      final StandingsTableState<DriverStandingEntry> state = driversState(
        lastFailure: _offline,
      );
      expect(state, isA<StandingsFirstLoadError<DriverStandingEntry>>());
      final StandingsFailure failure =
          (state as StandingsFirstLoadError<DriverStandingEntry>).failure;
      expect(failure.cause, StandingsFailureCause.resourceFailed);
      expect(failure.failure, _offline);
    });

    test('cached rows survive a failure as a non-blocking notice', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: driverStandingsFixture(),
                metadata: syncedMetadata('standings:drivers:2026'),
                lastFailure: _offline,
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.rows, isNotEmpty);
      expect(state.refreshError?.failure, _offline);
    });

    test('a valid empty table survives a failure as empty', () {
      final StandingsEmpty<DriverStandingEntry> state =
          driversState(
                metadata: syncedMetadata('standings:drivers:2026'),
                lastFailure: _offline,
              )
              as StandingsEmpty<DriverStandingEntry>;
      expect(state.refreshError, isNotNull);
    });

    test('a refresh in flight hides the previous failure', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: driverStandingsFixture(),
                metadata: syncedMetadata('standings:drivers:2026'),
                refreshing: true,
                lastFailure: _offline,
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.refreshing, isTrue);
      expect(state.refreshError, isNull);
    });

    test("one table's failure is not the other's", () {
      final StandingsScreenState screen = StandingsScreenState(
        selected: StandingsChampionship.drivers,
        season: 2026,
        drivers: driversState(lastFailure: _offline),
        constructors: constructorsState(
          rows: constructorStandingsFixture(),
          metadata: syncedMetadata('standings:constructors:2026'),
        ),
      );
      expect(
        screen.drivers,
        isA<StandingsFirstLoadError<DriverStandingEntry>>(),
      );
      expect(
        screen.constructors,
        isA<StandingsReady<ConstructorStandingEntry>>(),
      );
      // The retained state is immediately available when the selector switches.
      expect(
        (screen.constructors as StandingsReady<ConstructorStandingEntry>)
            .refreshError,
        isNull,
      );
    });
  });

  group('freshness', () {
    test('a passed staleAfter is stale', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: driverStandingsFixture(),
                metadata: syncedMetadata(
                  'standings:drivers:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 9),
                ),
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.freshness, FreshnessState.stale);
      expect(state.isStale, isTrue);
    });

    test('a staleAfter still in the future is fresh', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: driverStandingsFixture(),
                metadata: syncedMetadata(
                  'standings:drivers:2026',
                  staleAfter: DateTime.utc(2026, 7, 18, 12, 11),
                ),
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.freshness, FreshnessState.fresh);
    });

    test('unknown freshness is never stale and never fresh', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: driverStandingsFixture(),
                bootstrap: syncedMetadata('bootstrap'),
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.freshness, isNull);
      expect(state.isStale, isFalse);
    });

    test('each table reports its own freshness only', () {
      final StandingsScreenState screen = StandingsScreenState(
        selected: StandingsChampionship.constructors,
        season: 2026,
        drivers: driversState(
          rows: driverStandingsFixture(),
          metadata: syncedMetadata(
            'standings:drivers:2026',
            lastSuccessAt: DateTime.utc(2026, 7, 18, 9),
          ),
        ),
        constructors: constructorsState(
          rows: constructorStandingsFixture(),
          metadata: syncedMetadata(
            'standings:constructors:2026',
            lastSuccessAt: DateTime.utc(2026, 7, 18, 11),
          ),
        ),
      );
      expect(
        (screen.drivers as StandingsReady<DriverStandingEntry>).lastSuccessAt,
        DateTime.utc(2026, 7, 18, 9),
      );
      expect(
        (screen.constructors as StandingsReady<ConstructorStandingEntry>)
            .lastSuccessAt,
        DateTime.utc(2026, 7, 18, 11),
      );
    });
  });

  group('provisional summary', () {
    test('all null is unspecified — never "final"', () {
      expect(
        summariseProvisional(<bool?>[null, null]),
        StandingsProvisionalSummary.unspecified,
      );
      expect(
        summariseProvisional(const <bool?>[]),
        StandingsProvisionalSummary.unspecified,
      );
    });

    test('every stated flag true is a section-level provisional', () {
      expect(
        summariseProvisional(<bool?>[true, true, null]),
        StandingsProvisionalSummary.provisional,
      );
    });

    test('disagreement stays mixed rather than a false global state', () {
      expect(
        summariseProvisional(<bool?>[true, false]),
        StandingsProvisionalSummary.mixed,
      );
    });

    test('all stated flags false claims nothing', () {
      expect(
        summariseProvisional(<bool?>[false, false, null]),
        StandingsProvisionalSummary.notProvisional,
      );
    });

    test('a ready table carries its rows\' summary', () {
      final StandingsReady<DriverStandingEntry> state =
          driversState(
                rows: <DriverStandingEntry>[
                  driverStandingEntry(
                    driverId: 'a',
                    driverName: 'A',
                    order: 0,
                    points: 1,
                    provisional: true,
                  ),
                ],
                metadata: syncedMetadata('standings:drivers:2026'),
              )
              as StandingsReady<DriverStandingEntry>;
      expect(state.provisional, StandingsProvisionalSummary.provisional);
    });
  });

  group('screen state', () {
    test('selectedRefreshing follows the selected table only', () {
      final StandingsScreenState drivers = StandingsScreenState(
        selected: StandingsChampionship.drivers,
        season: 2026,
        drivers: driversState(
          rows: driverStandingsFixture(),
          metadata: syncedMetadata('standings:drivers:2026'),
          refreshing: true,
        ),
        constructors: constructorsState(
          rows: constructorStandingsFixture(),
          metadata: syncedMetadata('standings:constructors:2026'),
        ),
      );
      expect(drivers.selectedRefreshing, isTrue);

      final StandingsScreenState constructors = StandingsScreenState(
        selected: StandingsChampionship.constructors,
        season: 2026,
        drivers: drivers.drivers,
        constructors: drivers.constructors,
      );
      expect(constructors.selectedRefreshing, isFalse);
    });
  });
}
