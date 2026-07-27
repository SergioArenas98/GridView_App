import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/standings/application/standings_providers.dart';
import 'package:gridview/features/standings/application/standings_state.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';

Future<void> _settle([int iterations = 60]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

final DateTime _now = DateTime.utc(2026, 7, 18, 12);

const StandingsScope _root = StandingsScope.root();

ProviderContainer _container(GridViewDatabase db, ScriptedGridViewApi api) {
  final ProviderContainer c = ProviderContainer(
    overrides: [
      databaseProvider.overrideWithValue(db),
      remoteApiProvider.overrideWithValue(api),
      clockProvider.overrideWithValue(() => _now),
    ],
  );
  addTearDown(c.dispose);
  return c;
}

Map<String, dynamic> _meta(String requestId, {int revision = 0}) {
  final DateTime source = DateTime.utc(
    2026,
    7,
    18,
    11,
    55,
  ).add(Duration(days: revision));
  return <String, dynamic>{
    'apiVersion': '1',
    'generatedAt': source.add(const Duration(minutes: 5)).toIso8601String(),
    'sourceUpdatedAt': source.toIso8601String(),
    'requestId': requestId,
  };
}

RemoteResult<SeasonDto> _seasonResult(int year) => modifiedFromJson<SeasonDto>(
  <String, dynamic>{
    'data': seasonJson(year),
    'meta': _meta('r-season-$year', revision: year - 2026),
  },
  (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
  etag: 'W/"season-$year"',
);

RemoteResult<List<GrandPrixSummaryDto>> _calendarResult() =>
    modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal"',
    );

RemoteResult<HomeDataDto> _homeResult(int year) =>
    modifiedFromJson<HomeDataDto>(
      <String, dynamic>{
        'data': homeJson(season: year),
        'meta': _meta('r-home-$year', revision: year - 2026),
      },
      (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
      etag: 'W/"home-$year"',
    );

RemoteResult<List<DriverStandingDto>> _driversResult({
  int season = 2026,
  String etag = 'W/"ds"',
  List<dynamic>? rows,
}) => modifiedListFromJson<DriverStandingDto>(
  <String, dynamic>{
    'data': rows ?? driverStandingsJson(season),
    'meta': _meta('r-ds-$season'),
  },
  DriverStandingDto.fromJson,
  etag: etag,
);

RemoteResult<List<ConstructorStandingDto>> _constructorsResult({
  int season = 2026,
  String etag = 'W/"cs"',
  List<dynamic>? rows,
}) => modifiedListFromJson<ConstructorStandingDto>(
  <String, dynamic>{
    'data': rows ?? constructorStandingsJson(season),
    'meta': _meta('r-cs-$season'),
  },
  ConstructorStandingDto.fromJson,
  etag: etag,
);

/// Scripts every endpoint an ordinary current-season core run touches.
void _scriptCore(ScriptedGridViewApi api, {int year = 2026}) {
  api.currentSeason = (String? etag) => _seasonResult(year);
  api.season = (String? etag) => _seasonResult(year);
  api.calendar = (String? etag) => _calendarResult();
  api.driverStandings = (String? etag) => _driversResult(season: year);
  api.constructorStandings = (String? etag) =>
      _constructorsResult(season: year);
}

/// Runs the one first-use bootstrap so the database holds a current season and
/// both standings collections, then clears the call log.
Future<void> _primeFirstUse(
  ProviderContainer c,
  ScriptedGridViewApi api, {
  List<dynamic>? driverStandings,
  List<dynamic>? constructorStandings,
}) async {
  api.bootstrap = (String? etag) => bootstrapModified(
    bootstrapEnvelope(
      driverStandings: driverStandings,
      constructorStandings: constructorStandings,
    ),
  );
  await c.read(appSyncCoordinatorProvider).start();
  await _settle();
  api.bootstrap = null;
  api.calls.clear();
}

StandingsScreenState _state(ProviderContainer c, [StandingsScope? scope]) =>
    c.read(standingsStateProvider(scope ?? _root));

void _watch(ProviderContainer c, [StandingsScope? scope]) => c.listen(
  standingsStateProvider(scope ?? _root),
  (_, _) {},
  fireImmediately: true,
);

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
  });
  tearDown(() => db.close());

  group('ownership', () {
    test('creating the controller performs no request', () async {
      final ProviderContainer c = _container(db, api);
      _watch(c);
      c.read(standingsControllerProvider(_root));
      await _settle();

      expect(api.calls, isEmpty, reason: 'Standings never self-refreshes');
    });

    test('rebuilding the derived state creates no request', () async {
      final ProviderContainer c = _container(db, api);
      _watch(c);
      for (int i = 0; i < 5; i++) {
        _state(c);
        await _settle(5);
      }
      expect(api.calls, isEmpty);
    });

    test('an explicit route creates no request either', () async {
      final ProviderContainer c = _container(db, api);
      const StandingsScope scope = StandingsScope(
        routeSeason: 2024,
        routeChampionship: StandingsChampionship.constructors,
      );
      _watch(c, scope);
      c.read(standingsControllerProvider(scope));
      await _settle();
      expect(api.calls, isEmpty);
    });
  });

  group('current-season manual refresh', () {
    test('one user action runs the coordinator once for both tables', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      expect(api.callsFor('driverStandings'), 1);
      expect(api.callsFor('constructorStandings'), 1);
    });

    test('forcing eligibility keeps the persisted validators', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();
      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      expect(api.callsFor('driverStandings'), 2);
      expect(api.lastEtag['driverStandings'], 'W/"ds"');
      expect(api.lastEtag['constructorStandings'], 'W/"cs"');
    });

    test('a duplicate tap while one run is in flight is coalesced', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      final Future<void> first = c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      final Future<void> second = c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await Future.wait<void>(<Future<void>>[first, second]);
      await _settle();

      expect(api.callsFor('driverStandings'), 1);
    });

    test(
      'the refresh future completes even when the run is cancelled',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        _watch(c);

        final Future<void> refresh = c
            .read(standingsControllerProvider(_root).notifier)
            .refresh(StandingsChampionship.drivers);
        c.read(appSyncCoordinatorProvider).cancel();
        await refresh;
        await _settle();

        final StandingsRefreshState status = c.read(
          standingsControllerProvider(_root),
        );
        expect(status.drivers.inProgress, isFalse);
        expect(status.constructors.inProgress, isFalse);
      },
    );

    test('a run in progress reports refreshing and then settles', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      final Completer<void> gate = Completer<void>();
      _scriptCore(api);
      api.driverStandings = (String? etag) async {
        await gate.future;
        return _driversResult();
      };
      _watch(c);

      final Future<void> run = c.read(appSyncCoordinatorProvider).refreshNow();
      await _settle(10);
      expect(
        c.read(standingsControllerProvider(_root)).drivers.inProgress,
        isTrue,
      );

      gate.complete();
      await run;
      await _settle();
      expect(
        c.read(standingsControllerProvider(_root)).drivers.inProgress,
        isFalse,
      );
    });
  });

  group('failure attribution', () {
    test('an unrelated core failure is not a standings error', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.calendar = (String? etag) => RemoteFailure<List<GrandPrixSummaryDto>>(
        const ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );
      _watch(c);

      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      final StandingsScreenState state = _state(c);
      expect(state.drivers, isA<StandingsReady<DriverStandingEntry>>());
      expect(
        (state.drivers as StandingsReady<DriverStandingEntry>).refreshError,
        isNull,
      );
    });

    test(
      "the constructors' failure never becomes the drivers' error",
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        api.constructorStandings = (String? etag) =>
            RemoteFailure<List<ConstructorStandingDto>>(
              const ApiFailure(kind: ApiFailureKind.serverUnavailable),
            );
        _watch(c);

        await c
            .read(standingsControllerProvider(_root).notifier)
            .refresh(StandingsChampionship.drivers);
        await _settle();

        final StandingsRefreshState status = c.read(
          standingsControllerProvider(_root),
        );
        expect(status.drivers.lastFailure, isNull);
        expect(
          status.constructors.lastFailure?.kind,
          ApiFailureKind.serverUnavailable,
        );

        final StandingsScreenState state = _state(c);
        expect(
          (state.drivers as StandingsReady<DriverStandingEntry>).refreshError,
          isNull,
        );
        // …and the constructors' cached rows are still visible with a notice.
        final StandingsReady<ConstructorStandingEntry> constructors =
            state.constructors as StandingsReady<ConstructorStandingEntry>;
        expect(constructors.rows, isNotEmpty);
        expect(constructors.refreshError, isNotNull);
      },
    );

    test(
      "the drivers' failure never becomes the constructors' error",
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        api.driverStandings = (String? etag) =>
            RemoteFailure<List<DriverStandingDto>>(
              const ApiFailure(kind: ApiFailureKind.networkUnavailable),
            );
        _watch(c);

        await c
            .read(standingsControllerProvider(_root).notifier)
            .refresh(StandingsChampionship.constructors);
        await _settle();

        final StandingsRefreshState status = c.read(
          standingsControllerProvider(_root),
        );
        expect(status.constructors.lastFailure, isNull);
        expect(
          status.drivers.lastFailure?.kind,
          ApiFailureKind.networkUnavailable,
        );
      },
    );

    test(
      'a selected failure without materialization is a first-load error',
      () async {
        final ProviderContainer c = _container(db, api);
        // The season and Home are cached (so a run plans the core set rather
        // than preferring bootstrap) but nothing has ever materialized the
        // standings — neither their endpoints nor an accepted bootstrap.
        api.currentSeason = (String? etag) => _seasonResult(2026);
        api.season = (String? etag) => _seasonResult(2026);
        api.home = (String? etag) => _homeResult(2026);
        api.calendar = (String? etag) => _calendarResult();
        await c.read(seasonRepositoryProvider).refreshCurrentSeason();
        await c.read(homeRepositoryProvider).refreshHome(season: 2026);
        await c.read(calendarRepositoryProvider).refreshCalendar(2026);
        await _settle();
        expect(await db.syncMetadataDao.read('bootstrap'), isNull);

        api.driverStandings = (String? etag) =>
            RemoteFailure<List<DriverStandingDto>>(
              const ApiFailure(kind: ApiFailureKind.serverUnavailable),
            );
        _watch(c);
        await c
            .read(standingsControllerProvider(_root).notifier)
            .refresh(StandingsChampionship.drivers);
        await _settle();

        final StandingsScreenState state = _state(c);
        expect(
          state.drivers,
          isA<StandingsFirstLoadError<DriverStandingEntry>>(),
        );
        expect(
          (state.drivers as StandingsFirstLoadError<DriverStandingEntry>)
              .failure
              .cause,
          StandingsFailureCause.resourceFailed,
        );
      },
    );

    test('a retry after a failure issues a new request', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.driverStandings = (String? etag) =>
          RemoteFailure<List<DriverStandingDto>>(
            const ApiFailure(kind: ApiFailureKind.networkUnavailable),
          );
      _watch(c);
      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();
      expect(
        c.read(standingsControllerProvider(_root)).drivers.lastFailure,
        isNotNull,
      );

      api.driverStandings = (String? etag) => _driversResult();
      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      expect(
        c.read(standingsControllerProvider(_root)).drivers.lastFailure,
        isNull,
      );
      expect(api.callsFor('driverStandings'), 2);
    });
  });

  group('bootstrap materialization', () {
    test(
      'an empty bootstrap standings collection renders as empty, not loading',
      () async {
        final ProviderContainer c = _container(db, api);
        _watch(c);
        await _primeFirstUse(
          c,
          api,
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
        );

        final StandingsScreenState state = _state(c);
        expect(state.drivers, isA<StandingsEmpty<DriverStandingEntry>>());
        expect(
          state.constructors,
          isA<StandingsEmpty<ConstructorStandingEntry>>(),
        );
        // …borrowing no freshness and claiming no update time.
        final StandingsEmpty<DriverStandingEntry> drivers =
            state.drivers as StandingsEmpty<DriverStandingEntry>;
        expect(drivers.freshness, isNull);
        expect(drivers.lastSuccessAt, isNull);
      },
    );

    test('bootstrap-materialized rows carry no individual freshness', () async {
      final ProviderContainer c = _container(db, api);
      _watch(c);
      await _primeFirstUse(c, api);

      final StandingsReady<DriverStandingEntry> drivers =
          _state(c).drivers as StandingsReady<DriverStandingEntry>;
      expect(drivers.rows, isNotEmpty);
      expect(drivers.freshness, isNull);
      expect(drivers.lastSuccessAt, isNull);
      expect(drivers.isStale, isFalse);
    });

    test('bootstrap creates no standings metadata or ETag', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);

      expect(await db.syncMetadataDao.read('standings:drivers:2026'), isNull);
      expect(
        await db.syncMetadataDao.read('standings:constructors:2026'),
        isNull,
      );
      final ResourceSyncState? boot = await db.syncMetadataDao.read(
        'bootstrap',
      );
      expect(boot?.lastSuccessAt, isNotNull);
      expect(boot?.season, 2026);
    });

    test('the first individual request after bootstrap sends no validator and '
        'creates only its own metadata', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      api.driverStandings = (String? etag) => _driversResult();
      _watch(c);

      await c.read(standingsRepositoryProvider).refreshDriverStandings(2026);
      await _settle();

      expect(api.callsFor('driverStandings'), 1);
      expect(
        api.lastEtag['driverStandings'],
        isNull,
        reason: 'bootstrap contributes no validator',
      );
      final ResourceSyncState? drivers = await db.syncMetadataDao.read(
        'standings:drivers:2026',
      );
      expect(drivers?.etag, 'W/"ds"');
      expect(
        await db.syncMetadataDao.read('standings:constructors:2026'),
        isNull,
        reason: 'only its own resource earned metadata',
      );
    });

    test('a later individual refresh sends its own persisted ETag', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      api.driverStandings = (String? etag) => _driversResult();
      api.constructorStandings = (String? etag) => _constructorsResult();
      _watch(c);

      await c.read(standingsRepositoryProvider).refreshDriverStandings(2026);
      await c
          .read(standingsRepositoryProvider)
          .refreshConstructorStandings(2026);
      await _settle();
      await c.read(standingsRepositoryProvider).refreshDriverStandings(2026);
      await _settle();

      expect(
        api.lastEtag['driverStandings'],
        'W/"ds"',
        reason: 'its own validator, never the other table\'s',
      );
      expect(api.lastEtag['constructorStandings'], isNull);
    });
  });

  group('historical explicit route', () {
    test(
      'refreshes only the selected championship for the exact route season',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        api.driverStandings = (String? etag) => _driversResult(season: 2024);

        const StandingsScope scope = StandingsScope(
          routeSeason: 2024,
          routeChampionship: StandingsChampionship.drivers,
        );
        _watch(c, scope);
        await c
            .read(standingsControllerProvider(scope).notifier)
            .refresh(StandingsChampionship.drivers);
        await _settle();

        expect(api.callsFor('driverStandings'), 1);
        expect(
          api.callsFor('constructorStandings'),
          0,
          reason: 'the other championship is never refreshed automatically',
        );
        // Exactly the route season's key, and no current-season key.
        expect(
          await db.syncMetadataDao.read('standings:drivers:2024'),
          isNotNull,
        );
        expect(await db.syncMetadataDao.read('standings:drivers:2026'), isNull);
        expect(api.callsFor('currentSeason'), 0);
        expect(api.callsFor('calendar'), 0);
      },
    );

    test('the constructors route refreshes only its own key', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      api.constructorStandings = (String? etag) =>
          _constructorsResult(season: 2024);

      const StandingsScope scope = StandingsScope(
        routeSeason: 2024,
        routeChampionship: StandingsChampionship.constructors,
      );
      _watch(c, scope);
      await c
          .read(standingsControllerProvider(scope).notifier)
          .refresh(StandingsChampionship.constructors);
      await _settle();

      expect(api.callsFor('constructorStandings'), 1);
      expect(api.callsFor('driverStandings'), 0);
      expect(
        await db.syncMetadataDao.read('standings:constructors:2024'),
        isNotNull,
      );
      expect(
        await db.syncMetadataDao.read('standings:constructors:2026'),
        isNull,
      );
    });

    test('a historical refresh keeps its own conditional validator', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      api.driverStandings = (String? etag) =>
          _driversResult(season: 2024, etag: 'W/"ds-2024"');

      const StandingsScope scope = StandingsScope(
        routeSeason: 2024,
        routeChampionship: StandingsChampionship.drivers,
      );
      _watch(c, scope);
      await c
          .read(standingsControllerProvider(scope).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();
      await c
          .read(standingsControllerProvider(scope).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      expect(api.callsFor('driverStandings'), 2);
      expect(api.lastEtag['driverStandings'], 'W/"ds-2024"');
    });

    test(
      'an explicit route on the current season uses the safe core path',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);

        const StandingsScope scope = StandingsScope(
          routeSeason: 2026,
          routeChampionship: StandingsChampionship.drivers,
        );
        _watch(c, scope);
        await c
            .read(standingsControllerProvider(scope).notifier)
            .refresh(StandingsChampionship.drivers);
        await _settle();

        // The coordinator ran the current-season core set.
        expect(api.callsFor('currentSeason'), 1);
        expect(api.callsFor('driverStandings'), 1);
        expect(api.callsFor('constructorStandings'), 1);
      },
    );

    test(
      'a historical failure with no local rows is a first-load error',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        api.driverStandings = (String? etag) =>
            RemoteFailure<List<DriverStandingDto>>(
              const ApiFailure(kind: ApiFailureKind.notFound),
            );

        const StandingsScope scope = StandingsScope(
          routeSeason: 2019,
          routeChampionship: StandingsChampionship.drivers,
        );
        _watch(c, scope);
        await c
            .read(standingsControllerProvider(scope).notifier)
            .refresh(StandingsChampionship.drivers);
        await _settle();

        final StandingsScreenState state = _state(c, scope);
        expect(state.season, 2019);
        expect(
          state.drivers,
          isA<StandingsFirstLoadError<DriverStandingEntry>>(),
        );
        // The current season's cached rows are untouched.
        expect(
          await c.read(standingsRepositoryProvider).readDriverStandings(2026),
          isNotEmpty,
        );
      },
    );
  });

  group('season scoping', () {
    test('a season transition switches the watched keys', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);
      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      final int before =
          (_state(c).drivers as StandingsReady<DriverStandingEntry>)
              .rows
              .length;
      expect(before, greaterThan(0));
      expect(_state(c).season, 2026);

      // The season rolls over. A new season with no usable cache prefers
      // bootstrap; the 2027 tables are legitimately empty.
      _scriptCore(api, year: 2027);
      api.bootstrap = (String? etag) => bootstrapModified(
        bootstrapEnvelope(
          season: 2027,
          calendar: <dynamic>[],
          home: emptyHomeJson(),
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
          generatedAt: '2027-01-10T12:00:00Z',
          sourceUpdatedAt: '2027-01-10T11:00:00Z',
          staleAfter: null,
        ),
      );
      await c
          .read(standingsControllerProvider(_root).notifier)
          .refresh(StandingsChampionship.drivers);
      await _settle();

      expect(_state(c).season, 2027);
      // The previous season's rows are never shown under the new season.
      expect(_state(c).drivers, isA<StandingsEmpty<DriverStandingEntry>>());
      // …and they are still on disk, simply unwatched.
      expect(
        await c.read(standingsRepositoryProvider).readDriverStandings(2026),
        hasLength(before),
      );
      expect(
        await db.syncMetadataDao.read('standings:drivers:2026'),
        isNotNull,
      );
    });
  });
}
