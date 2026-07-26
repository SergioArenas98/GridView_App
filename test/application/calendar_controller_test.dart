import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/calendar/application/calendar_providers.dart';
import 'package:gridview/features/calendar/application/calendar_state.dart';
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

/// Snapshot provenance. [revision] advances `sourceUpdatedAt`, which is what the
/// centralized conflict rule compares — a later snapshot must look newer or it
/// is legitimately rejected in favour of the cache.
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

RemoteResult<List<GrandPrixSummaryDto>> _calendarResult() =>
    modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal"',
    );

RemoteResult<List<GrandPrixSummaryDto>> _emptyCalendarResult() =>
    modifiedListFromJson<GrandPrixSummaryDto>(
      <String, dynamic>{'data': <dynamic>[], 'meta': _meta('r-cal-empty')},
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal-empty"',
    );

RemoteResult<List<GrandPrixSummaryDto>> _calendarFailure(ApiFailureKind kind) =>
    RemoteFailure<List<GrandPrixSummaryDto>>(ApiFailure(kind: kind));

RemoteResult<SeasonDto> _seasonResult(int year) => modifiedFromJson<SeasonDto>(
  <String, dynamic>{
    'data': seasonJson(year),
    'meta': _meta('r-season-$year', revision: year - 2026),
  },
  (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
  etag: 'W/"season-$year"',
);

/// Scripts the endpoints an ordinary current-season core run touches.
void _scriptCore(
  ScriptedGridViewApi api, {
  int year = 2026,
  RemoteResult<List<GrandPrixSummaryDto>> Function()? calendar,
}) {
  api.currentSeason = (String? etag) => _seasonResult(year);
  api.season = (String? etag) => _seasonResult(year);
  api.calendar = (String? etag) => (calendar ?? _calendarResult)();
}

/// Runs the one first-use bootstrap so the database holds a current season,
/// Home and a calendar — then clears the call log so each test measures only
/// what it triggers itself.
Future<void> _primeFirstUse(
  ProviderContainer c,
  ScriptedGridViewApi api,
) async {
  api.bootstrap = (String? etag) => bootstrapModified(bootstrapEnvelope());
  await c.read(appSyncCoordinatorProvider).start();
  await _settle();
  api.bootstrap = null;
  api.calls.clear();
}

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
      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      c.read(calendarControllerProvider);
      await _settle();

      expect(api.calls, isEmpty, reason: 'Calendar never self-refreshes');
    });

    test('rebuilding the derived state creates no request', () async {
      final ProviderContainer c = _container(db, api);
      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      for (int i = 0; i < 5; i++) {
        c.read(calendarStateProvider);
        await _settle(5);
      }
      expect(api.calls, isEmpty);
    });

    test(
      'a manual refresh runs the application coordinator exactly once',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);

        c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
        await c.read(calendarControllerProvider.notifier).refresh();
        await _settle();

        expect(api.callsFor('calendar'), 1);
      },
    );

    test(
      'a manual refresh keeps conditional behaviour (the ETag is sent)',
      () async {
        final ProviderContainer c = _container(db, api);
        await _primeFirstUse(c, api);
        _scriptCore(api);

        c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
        await c.read(calendarControllerProvider.notifier).refresh();
        await _settle();
        await c.read(calendarControllerProvider.notifier).refresh();
        await _settle();

        expect(api.callsFor('calendar'), 2);
        expect(
          api.lastEtag['calendar'],
          'W/"cal"',
          reason: 'forcing eligibility must not drop the validator',
        );
      },
    );

    test('a second refresh while one runs is coalesced', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      final Future<void> first = c
          .read(calendarControllerProvider.notifier)
          .refresh();
      final Future<void> second = c
          .read(calendarControllerProvider.notifier)
          .refresh();
      await Future.wait<void>(<Future<void>>[first, second]);
      await _settle();

      expect(
        api.callsFor('calendar'),
        1,
        reason: 'the in-progress guard collapses the duplicate tap',
      );
    });

    test('the refresh future always completes, even when cancelled', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      final Future<void> refresh = c
          .read(calendarControllerProvider.notifier)
          .refresh();
      c.read(appSyncCoordinatorProvider).cancel();
      await refresh;
      await _settle();

      expect(c.read(calendarControllerProvider).inProgress, isFalse);
    });

    test('a run in progress reports as refreshing and then settles', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      final Completer<void> gate = Completer<void>();
      api.currentSeason = (String? etag) => _seasonResult(2026);
      api.calendar = (String? etag) async {
        await gate.future;
        return _calendarResult();
      };

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      final Future<void> run = c.read(appSyncCoordinatorProvider).refreshNow();
      await _settle(10);
      expect(c.read(calendarControllerProvider).inProgress, isTrue);

      gate.complete();
      await run;
      await _settle();
      expect(c.read(calendarControllerProvider).inProgress, isFalse);
    });
  });

  group('failure attribution', () {
    test('an unrelated core failure is not a Calendar error', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      api.driverStandings = (String? etag) =>
          RemoteFailure<List<DriverStandingDto>>(
            const ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      final CalendarState state = c.read(calendarStateProvider);
      expect(state, isA<CalendarReady>());
      expect((state as CalendarReady).refreshError, isNull);
      expect(c.read(calendarControllerProvider).lastFailure, isNull);
    });

    test('a Calendar failure with cache stays a non-blocking error', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      api.calendar = (String? etag) =>
          _calendarFailure(ApiFailureKind.networkUnavailable);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      final CalendarState state = c.read(calendarStateProvider);
      expect(state, isA<CalendarReady>());
      final CalendarReady ready = state as CalendarReady;
      expect(ready.events, isNotEmpty, reason: 'cache preserved');
      expect(ready.refreshError?.cause, CalendarFailureCause.resourceFailed);
      expect(
        ready.refreshError?.failure?.kind,
        ApiFailureKind.networkUnavailable,
      );
    });

    test('a Calendar failure without cache is a first-load error', () async {
      final ProviderContainer c = _container(db, api);
      // First use establishes the season and Home, but the season has no events
      // yet — so `calendar:2026` has never materialized.
      api.bootstrap = (String? etag) => bootstrapModified(
        bootstrapEnvelope(calendar: <dynamic>[], home: emptyHomeJson()),
      );
      await c.read(appSyncCoordinatorProvider).start();
      await _settle();
      api.bootstrap = null;
      api.calls.clear();

      api.currentSeason = (String? etag) => _seasonResult(2026);
      api.season = (String? etag) => _seasonResult(2026);
      api.calendar = (String? etag) =>
          _calendarFailure(ApiFailureKind.serverUnavailable);

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      final CalendarState state = c.read(calendarStateProvider);
      expect(state, isA<CalendarFirstLoadError>());
      expect(
        (state as CalendarFirstLoadError).failure.cause,
        CalendarFailureCause.resourceFailed,
      );
    });
  });

  group('season scoping', () {
    test('the calendar resource key is exactly the current season', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);

      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      expect(await db.syncMetadataDao.read('calendar:2026'), isNotNull);
      expect(await db.syncMetadataDao.read('calendar:2025'), isNull);
    });

    test('a season transition switches the watched calendar and keeps the '
        'previous season stored', () async {
      final ProviderContainer c = _container(db, api);
      await _primeFirstUse(c, api);
      _scriptCore(api);
      c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      final int before =
          (c.read(calendarStateProvider) as CalendarReady).events.length;
      expect(before, greaterThan(0));

      // The season rolls over; the new season's calendar is legitimately
      // empty. A new season with no usable first-screen cache legitimately
      // prefers bootstrap, so `calendar:2027` materializes on the run after it.
      _scriptCore(api, year: 2027, calendar: _emptyCalendarResult);
      api.bootstrap = (String? etag) => bootstrapModified(
        bootstrapEnvelope(
          season: 2027,
          calendar: <dynamic>[],
          home: emptyHomeJson(),
          generatedAt: '2027-01-10T12:00:00Z',
          sourceUpdatedAt: '2027-01-10T11:00:00Z',
          staleAfter: null,
        ),
      );
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      // The previous season's events are never shown under the new season.
      expect(c.read(calendarStateProvider), isNot(isA<CalendarReady>()));

      api.bootstrap = null;
      await c.read(calendarControllerProvider.notifier).refresh();
      await _settle();

      final CalendarState state = c.read(calendarStateProvider);
      expect(state, isA<CalendarEmpty>());
      expect((state as CalendarEmpty).season, 2027);

      // The previous season's events are still in Drift, just unwatched.
      expect(
        await c.read(calendarRepositoryProvider).readCalendar(2026),
        hasLength(before),
      );
      expect(await db.syncMetadataDao.read('calendar:2026'), isNotNull);
    });
  });
}
