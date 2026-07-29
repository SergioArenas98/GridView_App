import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/home/application/home_providers.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';

Future<void> _settle([int iterations = 60]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

/// Inside the fixture season and before the fixtures' `staleAfter`, so content
/// reads as fresh. Every assertion below is pinned to this instant.
final DateTime _now = DateTime.utc(2026, 7, 18, 12);

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

Map<String, dynamic> _meta(String requestId) => <String, dynamic>{
  'apiVersion': '1',
  'generatedAt': '2026-07-18T12:00:00Z',
  'sourceUpdatedAt': '2026-07-18T11:55:00Z',
  'requestId': requestId,
};

RemoteResult<SeasonDto> _seasonResult() => modifiedFromJson<SeasonDto>(
  <String, dynamic>{'data': seasonJson(2026), 'meta': _meta('r-season')},
  (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
  etag: 'W/"season"',
);

RemoteResult<HomeDataDto> _homeResult() => modifiedFromJson<HomeDataDto>(
  <String, dynamic>{'data': homeJson(), 'meta': _meta('r-home')},
  (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  etag: 'W/"home"',
);

/// Scripts every endpoint an ordinary current-season core run touches.
void _scriptCore(ScriptedGridViewApi api) {
  api.currentSeason = (String? etag) => _seasonResult();
  api.season = (String? etag) => _seasonResult();
  api.home = (String? etag) => _homeResult();
  api.calendar = (String? etag) => modifiedListFromFixture<GrandPrixSummaryDto>(
    'calendar/2026.json',
    GrandPrixSummaryDto.fromJson,
    etag: 'W/"cal"',
  );
  api.driverStandings = (String? etag) =>
      modifiedListFromJson<DriverStandingDto>(
        <String, dynamic>{
          'data': driverStandingsJson(2026),
          'meta': _meta('r-ds'),
        },
        DriverStandingDto.fromJson,
        etag: 'W/"ds"',
      );
  api.constructorStandings = (String? etag) =>
      modifiedListFromJson<ConstructorStandingDto>(
        <String, dynamic>{
          'data': constructorStandingsJson(2026),
          'meta': _meta('r-cs'),
        },
        ConstructorStandingDto.fromJson,
        etag: 'W/"cs"',
      );
}

/// Runs the one first-use bootstrap so the database holds a current season and
/// a materialized Home, then clears the call log.
Future<void> _primeFirstUse(
  ProviderContainer c,
  ScriptedGridViewApi api,
) async {
  api.bootstrap = (String? etag) => bootstrapModified(bootstrapEnvelope());
  await c.read(appSyncCoordinatorProvider).start();
  await _settle();
  api.bootstrap = null;
  api.calls.clear();
  api.lastEtag.clear();
}

void _watch(ProviderContainer c) =>
    c.listen(homeStateProvider, (_, _) {}, fireImmediately: true);

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
  });
  tearDown(() => db.close());

  group('refresh ownership', () {
    test('creating the controller performs no request', () async {
      final ProviderContainer c = _container(db, api);
      _watch(c);
      c.read(homeControllerProvider);
      await _settle();

      expect(api.calls, isEmpty, reason: 'Home never self-refreshes');
    });

    test('rebuilding the derived state creates no request', () async {
      final ProviderContainer c = _container(db, api);
      _watch(c);
      for (int i = 0; i < 5; i++) {
        c.read(homeStateProvider);
        await _settle(5);
      }
      expect(api.calls, isEmpty);
    });

    test('watching the dashboard stream creates no request', () async {
      final ProviderContainer c = _container(db, api);
      c.listen(homeDashboardProvider, (_, _) {}, fireImmediately: true);
      await _settle();
      expect(api.calls, isEmpty);
    });

    test('a local commit re-emits without producing a request', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _watch(c);
      await _settle();
      expect(c.read(homeStateProvider), isA<HomeReady>());

      // A later local write — exactly what another feature's sync commits.
      await db.seasonDao.ensureSeason(2025);
      await _settle();

      expect(api.calls, isEmpty);
      expect(c.read(homeStateProvider), isA<HomeReady>());
    });

    test('Home issues no detail or result request of its own', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      expect(api.callsFor('grandPrix'), 0);
      expect(api.callsFor('results'), 0);
      expect(api.callsFor('driver'), 0);
      expect(api.callsFor('constructor'), 0);
      expect(api.callsFor('circuit'), 0);
    });
  });

  group('manual refresh', () {
    test('one user action runs the current-season core set once', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      expect(api.callsFor('home'), 1);
      expect(api.callsFor('calendar'), 1);
      expect(api.callsFor('driverStandings'), 1);
    });

    test('a duplicate tap while one run is in flight is coalesced', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      final Future<void> first = c
          .read(homeControllerProvider.notifier)
          .refresh();
      final Future<void> second = c
          .read(homeControllerProvider.notifier)
          .refresh();
      await Future.wait(<Future<void>>[first, second]);
      await _settle();

      expect(api.callsFor('home'), 1);
    });

    test('forcing eligibility keeps the persisted validator', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();
      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      expect(api.callsFor('home'), 2);
      expect(
        api.lastEtag['home'],
        'W/"home"',
        reason: 'forcing eligibility never discards the stored validator',
      );
    });

    test('a 304 is a success, not a failure', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);
      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      api.home = (String? etag) => const RemoteNotModified<HomeDataDto>();
      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeReady ready = c.read(homeStateProvider) as HomeReady;
      expect(ready.refreshError, isNull);
      expect(ready.refreshing, isFalse);
    });

    test('the refresh always completes after a failure', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.home = (String? etag) => const RemoteFailure<HomeDataDto>(
        ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeReady ready = c.read(homeStateProvider) as HomeReady;
      expect(ready.refreshing, isFalse);
      expect(ready.refreshError?.kind, ApiFailureKind.networkUnavailable);
    });

    test('a retry works after a failure', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.home = (String? etag) => const RemoteFailure<HomeDataDto>(
        ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      _watch(c);
      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      _scriptCore(api);
      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      expect((c.read(homeStateProvider) as HomeReady).refreshError, isNull);
    });
  });

  group('failure scoping', () {
    test('a Home failure with a cache is non-blocking', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.home = (String? etag) => const RemoteFailure<HomeDataDto>(
        ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeState state = c.read(homeStateProvider);
      expect(state, isA<HomeReady>());
      expect((state as HomeReady).event.focus.grandPrix.name, isNotEmpty);
    });

    test(
      'a Home failure without a representation is a first-load error',
      () async {
        final ProviderContainer c = _container(db, api);
        _scriptCore(api);
        api.home = (String? etag) => const RemoteFailure<HomeDataDto>(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );
        _watch(c);

        await c.read(homeControllerProvider.notifier).refresh();
        await _settle();

        expect(c.read(homeStateProvider), isA<HomeFirstLoadError>());
      },
    );

    test('a drivers-standings failure never becomes a Home error', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.driverStandings = (String? etag) =>
          const RemoteFailure<List<DriverStandingDto>>(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeReady ready = c.read(homeStateProvider) as HomeReady;
      expect(
        ready.refreshError,
        isNull,
        reason: 'the failure is scoped to the drivers module',
      );
      expect(ready.driverLeader!.failed, isTrue);
      expect(ready.teamLeader!.failed, isFalse);
    });

    test(
      'a constructors-standings failure never affects the drivers',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        api.constructorStandings = (String? etag) =>
            const RemoteFailure<List<ConstructorStandingDto>>(
              ApiFailure(kind: ApiFailureKind.serverUnavailable),
            );
        _watch(c);

        await c.read(homeControllerProvider.notifier).refresh();
        await _settle();

        final HomeReady ready = c.read(homeStateProvider) as HomeReady;
        expect(ready.teamLeader!.failed, isTrue);
        expect(ready.driverLeader!.failed, isFalse);
        expect(ready.refreshError, isNull);
      },
    );

    test('an unrelated Explore collection failure is ignored', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.seasonDrivers = (String? etag) =>
          const RemoteFailure<List<SeasonDriverSummaryDto>>(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeReady ready = c.read(homeStateProvider) as HomeReady;
      expect(ready.refreshError, isNull);
      expect(ready.driverLeader!.failed, isFalse);
    });

    test('a calendar failure keeps a valid Home snapshot visible', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.calendar = (String? etag) =>
          const RemoteFailure<List<GrandPrixSummaryDto>>(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeState state = c.read(homeStateProvider);
      expect(state, isA<HomeReady>());
      expect((state as HomeReady).refreshError, isNull);
    });
  });

  group('bootstrap provenance', () {
    test(
      'a bootstrap-only Home is ready with no individual freshness',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _watch(c);
        await _settle();

        final HomeReady ready = c.read(homeStateProvider) as HomeReady;
        expect(ready.homeProvenance.lastSuccessAt, isNull);
        expect(ready.homeProvenance.freshness, isNull);
      },
    );

    test(
      'the first individual Home request sends no fabricated ETag',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);
        _watch(c);

        await c.read(homeControllerProvider.notifier).refresh();
        await _settle();

        expect(
          api.lastEtag['home'],
          isNull,
          reason: "the bootstrap validator never becomes Home's",
        );
      },
    );

    test('after a direct Home sync the module reports its own time', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      _watch(c);

      await c.read(homeControllerProvider.notifier).refresh();
      await _settle();

      final HomeReady ready = c.read(homeStateProvider) as HomeReady;
      expect(ready.homeProvenance.lastSuccessAt, isNotNull);
    });
  });
}
