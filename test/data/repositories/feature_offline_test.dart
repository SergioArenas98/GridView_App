import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/calendar/application/calendar_providers.dart';
import 'package:gridview/features/calendar/application/calendar_state.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_providers.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/calendar/application/grand_prix_results_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../../support/bootstrap_fixture.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// Proves the Phase 7A features work from a real on-disk database after a
/// close/reopen, with no network at all: the Calendar, the Grand Prix detail and
/// both classifications render from Drift, persisted ETags drive the next
/// conditional request, and a `304` or a failure never disturbs what is on
/// screen.
void main() {
  late Directory tempDir;
  late File dbFile;

  final DateTime now = DateTime.utc(2026, 7, 18, 12);
  const GrandPrixKey italian = (season: 2026, round: 12);

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_feature_offline');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  GridViewDatabase open() =>
      GridViewDatabase.forTesting(NativeDatabase(dbFile));

  ProviderContainer container(GridViewDatabase db, ScriptedGridViewApi api) {
    final ProviderContainer c = ProviderContainer(
      overrides: [
        databaseProvider.overrideWithValue(db),
        remoteApiProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(() => now),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  Future<void> settle([int iterations = 60]) async {
    for (int i = 0; i < iterations; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
  }

  RemoteResult<List<GrandPrixSummaryDto>> calendar({
    String etag = 'W/"cal1"',
  }) => modifiedListFromFixture<GrandPrixSummaryDto>(
    'calendar/2026.json',
    GrandPrixSummaryDto.fromJson,
    etag: etag,
  );

  RemoteResult<List<GrandPrixSummaryDto>> emptyCalendar({
    String etag = 'W/"cal-empty"',
  }) => modifiedListFromJson<GrandPrixSummaryDto>(
    <String, dynamic>{
      'data': <dynamic>[],
      'meta': <String, dynamic>{
        'apiVersion': '1',
        'generatedAt': '2026-07-18T12:00:00Z',
        'sourceUpdatedAt': '2026-07-18T11:55:00Z',
        'requestId': 'r-cal-empty',
      },
    },
    GrandPrixSummaryDto.fromJson,
    etag: etag,
  );

  RemoteResult<SeasonDto> currentSeason({String etag = 'W/"season"'}) =>
      modifiedFromFixture<SeasonDto>(
        'seasons/current.json',
        (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
        etag: etag,
      );

  RemoteResult<GrandPrixDto> detail({
    String fixture = 'standard-weekend',
    String etag = 'W/"gp1"',
  }) => modifiedFromFixture<GrandPrixDto>(
    'grand-prix/$fixture.json',
    (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
    etag: etag,
  );

  /// The shared race classification, plus a sprint document for the same event
  /// so both survive together.
  RemoteResult<RaceResultDto> raceResult({String etag = 'W/"res-race"'}) =>
      modifiedFromFixture<RaceResultDto>(
        'results/race-timing.json',
        (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
        etag: etag,
      );

  RaceResult sprintDocument() => const RaceResult(
    id: '2026-italian-grand-prix-sprint-results',
    season: 2026,
    round: 12,
    grandPrixId: '2026-italian-grand-prix',
    sessionType: SessionType.sprint,
    status: ResultStatus.finalResult,
    entries: <RaceResultEntry>[
      RaceResultEntry(
        driverId: 'lando-norris',
        constructorId: 'mclaren',
        position: 1,
        points: 8,
        status: FinishStatus.finished,
      ),
    ],
  );

  /// One synchronised session: calendar, Grand Prix detail, both result
  /// documents. Returns the number of calendar events written.
  Future<int> seed() async {
    final GridViewDatabase db = open();
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.currentSeason = (String? etag) => currentSeason();
    api.calendar = (String? etag) => calendar();
    api.grandPrix = (String? etag) => detail();
    api.results = (String? etag) => raceResult();
    final RepositoryHarness h = RepositoryHarness(db, api, now: now);

    await h.season.refreshCurrentSeason();
    await h.calendar.refreshCalendar(2026);
    await h.grandPrix.refreshGrandPrix(season: 2026, round: 12);
    await h.results.refreshResults(season: 2026, round: 12);
    // A second document for the same event, written directly: the sprint and
    // race classifications coexist under one (season, round).
    await db.resultsDao.writeRaceResult(sprintDocument());

    final int events = (await h.calendar.readCalendar(2026)).length;
    await db.close();
    return events;
  }

  test('the calendar survives a reopen and renders with no network', () async {
    final int events = await seed();
    expect(events, greaterThan(0));

    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    final ProviderContainer c = container(db, api);
    c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
    await settle();

    final CalendarState state = c.read(calendarStateProvider);
    expect(state, isA<CalendarReady>());
    expect((state as CalendarReady).events, hasLength(events));
    expect(state.events.first.circuitName, isNotNull);
    expect(api.calls, isEmpty, reason: 'rendering never reaches the network');
  });

  test('Grand Prix detail and both classifications survive a reopen', () async {
    await seed();

    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    // Offline: every on-demand refresh fails.
    api.grandPrix = (String? etag) => RemoteFailure<GrandPrixDto>(
      const ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    api.results = (String? etag) => RemoteFailure<RaceResultDto>(
      const ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );

    final ProviderContainer c = container(db, api);
    c.listen(grandPrixStateProvider(italian), (_, _) {}, fireImmediately: true);
    c.listen(
      grandPrixResultsStateProvider(italian),
      (_, _) {},
      fireImmediately: true,
    );
    c.read(grandPrixResultsControllerProvider(italian));
    await settle();

    // Cached detail: still complete, with a non-blocking failure.
    final GrandPrixDetailState state = c.read(grandPrixStateProvider(italian));
    expect(state, isA<GrandPrixReady>());
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.view.grandPrix.sessions, hasLength(5));
    expect(ready.view.circuit?.name, isNotNull);
    expect(ready.refreshError?.kind, ApiFailureKind.networkUnavailable);

    // Cached classifications: both documents, still separate.
    final GrandPrixResultsState results = c.read(
      grandPrixResultsStateProvider(italian),
    );
    expect(results, isA<GrandPrixResultsReady>());
    final GrandPrixResultsReady stored = results as GrandPrixResultsReady;
    expect(stored.documents, hasLength(2));
    expect(
      stored.documents.map((RaceResult r) => r.sessionType),
      containsAll(<SessionType>[SessionType.race, SessionType.sprint]),
    );
    expect(stored.refreshError, isNotNull);
  });

  test('persisted ETags drive the next on-demand validation', () async {
    await seed();

    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.grandPrix = (String? etag) =>
        RemoteNotModified<GrandPrixDto>(etag: etag);
    api.results = (String? etag) =>
        RemoteNotModified<RaceResultDto>(etag: etag);

    final ProviderContainer c = container(db, api);
    c.listen(grandPrixStateProvider(italian), (_, _) {}, fireImmediately: true);
    c.listen(
      grandPrixResultsStateProvider(italian),
      (_, _) {},
      fireImmediately: true,
    );
    c.read(grandPrixResultsControllerProvider(italian));
    await settle();

    expect(api.lastEtag['grandPrix'], 'W/"gp1"');
    expect(api.lastEtag['results'], 'W/"res-race"');
  });

  test('a 304 after a reopen does not rewrite the visible data', () async {
    await seed();

    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.grandPrix = (String? etag) =>
        RemoteNotModified<GrandPrixDto>(etag: etag);

    final ProviderContainer c = container(db, api);
    final List<String> emissions = <String>[];
    c.listen(grandPrixCacheProvider(italian), (
      AsyncValue<GrandPrixDetailView?>? _,
      AsyncValue<GrandPrixDetailView?> next,
    ) {
      if (next.hasValue) emissions.add(next.value?.grandPrix.id ?? 'none');
    }, fireImmediately: true);
    // Opening the screen is what triggers the one on-demand validation.
    c.listen(grandPrixStateProvider(italian), (_, _) {}, fireImmediately: true);
    await settle();

    expect(api.callsFor('grandPrix'), 1);
    expect(
      emissions,
      hasLength(1),
      reason: 'a validation writes no domain rows, so nothing re-emits',
    );
    final ResourceSyncState? meta = await db.syncMetadataDao.read(
      'grand-prix:2026:12',
    );
    expect(meta?.lastSuccessAt, isNotNull);
  });

  test('a valid empty calendar stays empty across a reopen', () async {
    final GridViewDatabase db1 = open();
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    api1.currentSeason = (String? etag) => currentSeason();
    api1.calendar = (String? etag) => emptyCalendar();
    final RepositoryHarness h1 = RepositoryHarness(db1, api1, now: now);
    await h1.season.refreshCurrentSeason();
    await h1.calendar.refreshCalendar(2026);
    await db1.close();

    final GridViewDatabase db2 = open();
    addTearDown(db2.close);
    final ScriptedGridViewApi api2 = ScriptedGridViewApi();
    api2.calendar = (String? etag) =>
        RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
    final ProviderContainer c = container(db2, api2);
    c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
    await settle();

    expect(
      c.read(calendarStateProvider),
      isA<CalendarEmpty>(),
      reason: 'a materialized empty calendar is never a loading state',
    );
  });

  test('a Grand Prix with no sessions is still renderable', () async {
    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.grandPrix = (String? etag) => modifiedFromFixture<GrandPrixDto>(
      'grand-prix/standard-weekend.json',
      (Object? d) => GrandPrixDto.fromJson(<String, dynamic>{
        ...d! as Map<String, dynamic>,
        'sessions': <dynamic>[],
      }),
      etag: 'W/"gp-no-sessions"',
    );

    final ProviderContainer c = container(db, api);
    c.listen(grandPrixStateProvider(italian), (_, _) {}, fireImmediately: true);
    await settle();

    final GrandPrixDetailState state = c.read(grandPrixStateProvider(italian));
    expect(state, isA<GrandPrixReady>());
    expect((state as GrandPrixReady).view.grandPrix.sessions, isEmpty);
    expect(state.view.grandPrix.name, 'Italian Grand Prix');
  });

  test('a bootstrap-materialized empty calendar survives a reopen without a '
      'loader', () async {
    // Session 1: one accepted first-use bootstrap for a season with no
    // events yet. The calendar endpoint itself is never called.
    final GridViewDatabase db1 = open();
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    api1.bootstrap = (String? etag) => bootstrapModified(
      bootstrapEnvelope(calendar: <dynamic>[], home: emptyHomeJson()),
    );
    await RepositoryHarness(db1, api1, now: now).bootstrap.refreshBootstrap();
    expect(await db1.syncMetadataDao.read('calendar:2026'), isNull);
    await db1.close();

    // Session 2: reopened before the calendar endpoint has ever synced.
    final GridViewDatabase db2 = open();
    addTearDown(db2.close);
    final ScriptedGridViewApi api2 = ScriptedGridViewApi();
    final ProviderContainer c = container(db2, api2);
    c.listen(calendarStateProvider, (_, _) {}, fireImmediately: true);
    await settle();

    final CalendarState state = c.read(calendarStateProvider);
    expect(
      state,
      isA<CalendarEmpty>(),
      reason: 'an accepted bootstrap applied the collection',
    );
    // Bootstrap lends no validator and no freshness to the calendar.
    expect((state as CalendarEmpty).freshness, isNull);
    expect(state.lastSuccessAt, isNull);
    expect(await db2.syncMetadataDao.read('calendar:2026'), isNull);
    expect(api2.calls, isEmpty, reason: 'rendering never reaches the network');
  });

  test(
    'a later calendar sync creates and uses only its own metadata',
    () async {
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.bootstrap = (String? etag) => bootstrapModified(
        bootstrapEnvelope(calendar: <dynamic>[], home: emptyHomeJson()),
      );
      await RepositoryHarness(db1, api1, now: now).bootstrap.refreshBootstrap();
      final ResourceSyncState? boot = await db1.syncMetadataDao.read(
        'bootstrap',
      );
      await db1.close();

      final GridViewDatabase db2 = open();
      addTearDown(db2.close);
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      api2.calendar = (String? etag) => calendar(etag: 'W/"cal-own"');
      final RepositoryHarness h = RepositoryHarness(db2, api2, now: now);
      await h.calendar.refreshCalendar(2026);

      // The first conditional request carried no validator: bootstrap's ETag is
      // never borrowed.
      expect(api2.lastEtag['calendar'], isNull);
      final ResourceSyncState? meta = await db2.syncMetadataDao.read(
        'calendar:2026',
      );
      expect(meta?.etag, 'W/"cal-own"');
      expect(meta?.lastSuccessAt, isNotNull);
      expect(meta?.etag, isNot(boot?.etag));
      expect(await h.calendar.readCalendar(2026), isNotEmpty);
    },
  );

  test('the previous season stays on disk after a season transition', () async {
    await seed();

    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.calendar = (String? etag) => emptyCalendar(etag: 'W/"cal-2027"');
    final RepositoryHarness h = RepositoryHarness(db, api, now: now);
    await h.calendar.refreshCalendar(2027);

    final List<CalendarEntry> previous = await h.calendar.readCalendar(2026);
    expect(previous, isNotEmpty);
    expect(await h.calendar.readCalendar(2027), isEmpty);
    expect(await db.syncMetadataDao.read('calendar:2026'), isNotNull);
    expect(await db.syncMetadataDao.read('calendar:2027'), isNotNull);
  });
}
