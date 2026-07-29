import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/bootstrap_fixture.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// Proves the composed Home dashboard survives closing and reopening a real
/// on-disk database, renders with **zero** network requests afterwards, and
/// keeps each module's own persisted validator and provenance intact.
void main() {
  late Directory tempDir;
  late File dbFile;

  /// Inside the fixture season, after rounds 11 and 12 have finished.
  final DateTime now = DateTime.utc(2026, 7, 18, 12);

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_home_reopen');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  GridViewDatabase open() =>
      GridViewDatabase.forTesting(NativeDatabase(dbFile));

  Map<String, dynamic> meta(String id) => <String, dynamic>{
    'apiVersion': '1',
    'generatedAt': '2026-07-18T12:00:00Z',
    'sourceUpdatedAt': '2026-07-18T11:55:00Z',
    'requestId': id,
  };

  RemoteResult<HomeDataDto> homeResult({
    String etag = 'W/"home1"',
    Map<String, dynamic>? data,
  }) => modifiedFromJson<HomeDataDto>(
    <String, dynamic>{'data': data ?? homeJson(), 'meta': meta('r-home')},
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
    etag: etag,
  );

  /// Scripts and runs everything a materialized Home dashboard needs: the
  /// season, the calendar, the Home snapshot and both standings tables.
  Future<void> syncEverything(
    RepositoryHarness h,
    ScriptedGridViewApi api, {
    Map<String, dynamic>? home,
  }) async {
    api.calendar = (_) => modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal1"',
    );
    api.home = (_) => homeResult(data: home);
    api.driverStandings = (_) => modifiedListFromFixture<DriverStandingDto>(
      'standings/drivers-fractional.json',
      DriverStandingDto.fromJson,
      etag: 'W/"ds1"',
    );
    api.constructorStandings = (_) =>
        modifiedListFromFixture<ConstructorStandingDto>(
          'standings/constructors.json',
          ConstructorStandingDto.fromJson,
          etag: 'W/"cs1"',
        );

    await h.db.seasonDao.upsertSeason(
      const Season(year: 2026, status: SeasonStatus.active, isCurrent: true),
    );
    expect(await h.calendar.refreshCalendar(2026), isA<RefreshSuccess>());
    expect(await h.home.refreshHome(season: 2026), isA<RefreshSuccess>());
    expect(
      await h.standings.refreshDriverStandings(2026),
      isA<RefreshSuccess>(),
    );
    expect(
      await h.standings.refreshConstructorStandings(2026),
      isA<RefreshSuccess>(),
    );
  }

  Future<HomeDashboardView?> readDashboard(GridViewDatabase db) =>
      db.homeDashboardDao.readDashboard(now);

  test(
    'a complete dashboard survives a close/reopen with no network',
    () async {
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      await syncEverything(RepositoryHarness(db1, api1), api1);

      final HomeDashboardView before = (await readDashboard(db1))!;
      expect(before.focus, isNotNull);
      expect(before.latestCompleted, isNotNull);
      expect(before.upcoming, isNotEmpty);
      expect(before.driverLeaders, isNotEmpty);
      expect(before.constructorLeaders, isNotEmpty);
      await db1.close();

      // --- Second session: a cold open with an API that answers nothing. ---
      final GridViewDatabase db2 = open();
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      addTearDown(db2.close);
      RepositoryHarness(db2, api2);

      final HomeDashboardView after = (await readDashboard(db2))!;
      expect(after.seasonYear, before.seasonYear);
      expect(after.focus!.round, before.focus!.round);
      expect(after.focus!.grandPrix.name, before.focus!.grandPrix.name);
      expect(after.focus!.circuit?.name, before.focus!.circuit?.name);
      expect(after.latestCompleted!.round, before.latestCompleted!.round);
      expect(
        after.upcoming.map((e) => e.round),
        before.upcoming.map((e) => e.round),
      );
      expect(
        after.driverLeaders.single.driverId,
        before.driverLeaders.single.driverId,
      );
      expect(
        after.constructorLeaders.single.constructorId,
        before.constructorLeaders.single.constructorId,
      );
      expect(
        api2.calls,
        isEmpty,
        reason: 'a reopened dashboard needs no network',
      );
    },
  );

  test(
    'a pre-event, race-weekend and post-race Home all reopen offline',
    () async {
      for (final (String label, String status) in <(String, String)>[
        ('pre-event', 'upcoming'),
        ('race weekend', 'in_progress'),
        ('post-race', 'completed'),
      ]) {
        final Directory dir = Directory.systemTemp.createTempSync(
          'gv_home_$label',
        );
        addTearDown(() => dir.deleteSync(recursive: true));
        final File file = File('${dir.path}/gridview_v2.sqlite');

        final Map<String, dynamic> home = Map<String, dynamic>.from(homeJson());
        final Map<String, dynamic> featured = Map<String, dynamic>.from(
          home['featuredEvent'] as Map<String, dynamic>,
        );
        featured['status'] = status;
        home['featuredEvent'] = featured;

        final GridViewDatabase first = GridViewDatabase.forTesting(
          NativeDatabase(file),
        );
        final ScriptedGridViewApi api = ScriptedGridViewApi();
        await syncEverything(RepositoryHarness(first, api), api, home: home);
        await first.close();

        final GridViewDatabase second = GridViewDatabase.forTesting(
          NativeDatabase(file),
        );
        final ScriptedGridViewApi offline = ScriptedGridViewApi();
        RepositoryHarness(second, offline);

        final HomeDashboardView view = (await second.homeDashboardDao
            .readDashboard(now))!;
        expect(
          view.focus!.grandPrix.status,
          EventStatus.fromWire(status),
          reason: label,
        );
        expect(offline.calls, isEmpty, reason: label);
        await second.close();
      }
    },
  );

  test('a season-empty Home reopens as empty, not as missing', () async {
    final Map<String, dynamic> home = Map<String, dynamic>.from(homeJson())
      ..['featuredEvent'] = null
      ..['featuredSession'] = null;

    final GridViewDatabase db1 = open();
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    api1.home = (_) => homeResult(data: home);
    final RepositoryHarness h1 = RepositoryHarness(db1, api1);
    await h1.db.seasonDao.upsertSeason(
      const Season(year: 2026, status: SeasonStatus.active, isCurrent: true),
    );
    expect(await h1.home.refreshHome(season: 2026), isA<RefreshSuccess>());
    await db1.close();

    final GridViewDatabase db2 = open();
    addTearDown(db2.close);
    final HomeDashboardView view = (await readDashboard(db2))!;
    expect(
      view.seasonYear,
      2026,
      reason: 'the representation is materialized for the season',
    );
    expect(view.focus, isNull);
    expect(view.upcoming, isEmpty);
  });

  test(
    'the Home ETag survives and drives the next conditional request',
    () async {
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      await syncEverything(RepositoryHarness(db1, api1), api1);
      await db1.close();

      final GridViewDatabase db2 = open();
      addTearDown(db2.close);
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      final RepositoryHarness h2 = RepositoryHarness(db2, api2);

      final ResourceSyncState? stored = await db2.syncMetadataDao.read(
        ResourceKey.home(2026),
      );
      expect(stored?.etag, 'W/"home1"');

      // A later refresh sends exactly that validator, and the 304 it earns is
      // successful validation rather than a failure.
      api2.home = (String? etag) => etag == 'W/"home1"'
          ? const RemoteNotModified<HomeDataDto>()
          : homeResult(etag: 'W/"home2"');
      expect(await h2.home.refreshHome(season: 2026), isA<RefreshSuccess>());
      expect(api2.lastEtag['home'], 'W/"home1"');
      // A 304 is successful validation: every module is still there.
      expect((await readDashboard(db2))!.focus, isNotNull);
    },
  );

  test('a failed refresh preserves every valid module', () async {
    final GridViewDatabase db = open();
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    final RepositoryHarness h = RepositoryHarness(db, api);
    await syncEverything(h, api);

    api.home = (_) => const RemoteFailure<HomeDataDto>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    api.driverStandings = (_) => const RemoteFailure<List<DriverStandingDto>>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    expect(await h.home.refreshHome(season: 2026), isA<RefreshFailure>());
    expect(
      await h.standings.refreshDriverStandings(2026),
      isA<RefreshFailure>(),
    );

    final HomeDashboardView view = (await readDashboard(db))!;
    expect(view.focus, isNotNull);
    expect(view.driverLeaders, isNotEmpty);
    expect(view.constructorLeaders, isNotEmpty);
    expect(view.upcoming, isNotEmpty);
  });

  test('a bootstrap-only Home is materialized with no Home metadata', () async {
    final GridViewDatabase db1 = open();
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    final RepositoryHarness h1 = RepositoryHarness(db1, api1);
    api1.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    expect(await h1.bootstrap.refreshBootstrap(), isA<RefreshSuccess>());
    await db1.close();

    final GridViewDatabase db2 = open();
    addTearDown(db2.close);
    final HomeDashboardView view = (await readDashboard(db2))!;
    expect(view.seasonYear, 2026);
    expect(view.focus, isNotNull);
    expect(
      await db2.syncMetadataDao.read(ResourceKey.home(2026)),
      isNull,
      reason: 'bootstrap contributes no individual Home provenance (ADR 0014)',
    );
  });

  test(
    'a season transition keeps the old season and renders the new one',
    () async {
      final GridViewDatabase db = open();
      addTearDown(db.close);
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      final RepositoryHarness h = RepositoryHarness(db, api);
      await syncEverything(h, api);

      final int oldRound = (await readDashboard(db))!.focus!.round;

      // The new season arrives: a materialized Home with nothing scheduled yet.
      await db.seasonDao.upsertSeason(
        const Season(
          year: 2026,
          status: SeasonStatus.completed,
          isCurrent: false,
        ),
      );
      await db.seasonDao.upsertSeason(
        const Season(
          year: 2027,
          status: SeasonStatus.upcoming,
          isCurrent: true,
        ),
      );
      final Map<String, dynamic> newHome = Map<String, dynamic>.from(homeJson())
        ..['featuredEvent'] = null
        ..['featuredSession'] = null;
      api.home = (_) => homeResult(etag: 'W/"home-2027"', data: newHome);
      expect(await h.home.refreshHome(season: 2027), isA<RefreshSuccess>());

      final HomeDashboardView view = (await readDashboard(db))!;
      expect(view.seasonYear, 2027);
      expect(
        view.focus,
        isNull,
        reason: 'the new season has nothing scheduled',
      );
      expect(view.driverLeaders, isEmpty, reason: 'no 2027 standings yet');

      // The old season's rows and metadata are untouched on disk.
      expect((await db.calendarDao.calendar(2026)).length, greaterThan(0));
      expect(
        (await db.standingsDao.driverStandingEntries(2026)).length,
        greaterThan(0),
      );
      expect(
        (await db.syncMetadataDao.read(ResourceKey.home(2026)))?.etag,
        'W/"home1"',
      );
      expect(oldRound, isNotNull);
    },
  );

  test('unresolved stubs stay hidden after a reopen', () async {
    final GridViewDatabase db1 = open();
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    final RepositoryHarness h1 = RepositoryHarness(db1, api1);
    await h1.db.seasonDao.upsertSeason(
      const Season(year: 2026, status: SeasonStatus.active, isCurrent: true),
    );
    api1.calendar = (_) => modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal1"',
    );
    api1.home = (_) => homeResult();
    // Standings reference drivers whose identities are never synchronised.
    await db1.standingsDao.replaceDriverStandings(2026, <DriverStanding>[
      const DriverStanding(
        season: 2026,
        driverId: 'never-synced-driver',
        position: 1,
        points: 100,
      ),
    ]);
    expect(await h1.calendar.refreshCalendar(2026), isA<RefreshSuccess>());
    expect(await h1.home.refreshHome(season: 2026), isA<RefreshSuccess>());
    await db1.close();

    final GridViewDatabase db2 = open();
    addTearDown(db2.close);
    final HomeDashboardView view = (await readDashboard(db2))!;
    expect(view.driverLeaders.single.driverName, isNull);
    expect(view.driverLeaders.single.driverId, 'never-synced-driver');
  });
}
