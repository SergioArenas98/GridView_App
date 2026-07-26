import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

/// A `GET /v1/seasons/current` response naming [year] as the current season.
Map<String, dynamic> currentSeasonEnvelope(
  int year, {
  String sourceUpdatedAt = '2026-07-18T11:59:00Z',
}) => <String, dynamic>{
  'data': seasonJson(year),
  'meta': <String, dynamic>{
    'apiVersion': '1',
    'schemaVersion': 1,
    'season': year,
    'generatedAt': '2026-07-18T12:00:00Z',
    'sourceUpdatedAt': sourceUpdatedAt,
    'staleAfter': '2026-07-18T12:15:00Z',
    'contentVersion': '2026.07.18.1',
    'requestId': 'req-test-season',
  },
};

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late SyncHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = SyncHarness(db, api);
  });
  tearDown(() async {
    await h.dispose();
    await db.close();
  });

  test('a new current season is adopted without touching the old one', () async {
    // A full 2026 cache from first use.
    api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    await h.coordinator.start();
    expect(await db.calendarDao.countEventsForSeason(2026), 5);
    expect(await db.standingsDao.countDriverStandings(2026), 7);
    final int drivers2026 = await db.competitorDao.countDriverSeasonEntries(
      2026,
    );
    api.calls.clear();

    // The championship rolls over: the season resource now reports 2027, and
    // bootstrap serves the new season.
    api.currentSeason = (_) => modifiedFromJson<SeasonDto>(
      currentSeasonEnvelope(2027),
      (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
      etag: 'W/"season-2027"',
    );
    api.bootstrap = (_) => bootstrapModified(
      bootstrapEnvelope(
        season: 2027,
        calendar: calendarJson(2027),
        driverStandings: driverStandingsJson(2027),
        constructorStandings: constructorStandingsJson(2027),
        home: homeJson(season: 2027),
        sourceUpdatedAt: '2026-07-18T11:59:00Z',
      ),
      etag: 'W/"bootstrap-2027"',
    );

    await h.coordinator.onForeground();

    // The new season is current and materialized.
    final Season? current = await db.seasonDao.readCurrentSeason();
    expect(current?.year, 2027);
    expect(await db.calendarDao.countEventsForSeason(2027), 5);
    expect(await db.standingsDao.countDriverStandings(2027), 7);

    // Nothing about the previous season was deleted or reset.
    expect(await db.calendarDao.countEventsForSeason(2026), 5);
    expect(await db.standingsDao.countDriverStandings(2026), 7);
    expect(await db.competitorDao.countDriverSeasonEntries(2026), drivers2026);
    expect(await db.seasonDao.readSeason(2026), isNotNull);

    // The previous season's own metadata rows survive untouched.
    expect(await db.syncMetadataDao.read(ResourceKey.bootstrap()), isNotNull);

    // The new season's core resources have no metadata yet: they are treated as
    // never synchronized, not as fresh.
    expect(await db.syncMetadataDao.read(ResourceKey.calendar(2027)), isNull);
    expect(
      await db.syncMetadataDao.read(ResourceKey.driverStandings(2027)),
      isNull,
    );

    expect(h.coordinator.state, isA<AppSyncCompleted>());
  });

  test('a new season with no usable Home cache prefers bootstrap', () async {
    api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    await h.coordinator.start();
    api.calls.clear();

    api.currentSeason = (_) => modifiedFromJson<SeasonDto>(
      currentSeasonEnvelope(2027),
      (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
      etag: 'W/"season-2027"',
    );
    api.bootstrap = (_) => bootstrapModified(
      bootstrapEnvelope(
        season: 2027,
        calendar: calendarJson(2027),
        home: homeJson(season: 2027),
        sourceUpdatedAt: '2026-07-18T11:59:00Z',
      ),
      etag: 'W/"bootstrap-2027"',
    );

    await h.coordinator.onForeground();

    expect(api.callsFor('currentSeason'), 1);
    expect(
      api.callsFor('bootstrap'),
      1,
      reason: 'the new season is fetched as one aggregate, not a fan-out',
    );
    expect(api.callsFor('seasonDrivers'), 0);
    expect(api.callsFor('driverStandings'), 0);

    final HomeView? home = await db.verticalSliceDao.watchHome().first;
    expect(home?.featured?.season, 2027);
  });

  test('no season year is hardcoded anywhere in the plan', () async {
    api.bootstrap = (_) => bootstrapModified(
      bootstrapEnvelope(
        season: 2031,
        calendar: calendarJson(2031),
        driverStandings: driverStandingsJson(2031),
        constructorStandings: constructorStandingsJson(2031),
        home: homeJson(season: 2031),
      ),
    );
    await h.coordinator.start();

    expect((await db.seasonDao.readCurrentSeason())?.year, 2031);
    expect(await db.calendarDao.countEventsForSeason(2031), 5);
    expect(await db.calendarDao.countEventsForSeason(2026), 0);
  });
}
