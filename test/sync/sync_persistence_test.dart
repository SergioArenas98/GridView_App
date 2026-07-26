import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';
import 'app_sync_coordinator_test.dart' show scriptCoreEndpoints;

/// Proves the offline-first promise end to end against a real on-disk database:
/// a first-use bootstrap survives a close/reopen, a returning launch renders
/// with no network at all, and the next conditional request reuses the
/// persisted ETag.
void main() {
  late Directory tempDir;
  late File dbFile;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_sync_reopen');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  GridViewDatabase open() =>
      GridViewDatabase.forTesting(NativeDatabase(dbFile));

  test('a first-use bootstrap survives close and reopen', () async {
    GridViewDatabase db = open();
    ScriptedGridViewApi api = ScriptedGridViewApi()
      ..bootstrap = (_) =>
          bootstrapModified(bootstrapEnvelope(), etag: 'W/"bootstrap-disk"');
    SyncHarness h = SyncHarness(db, api);

    await h.coordinator.start();
    expect(await db.calendarDao.countEventsForSeason(2026), 5);
    await h.dispose();
    await db.close();

    // Reopen: everything the bootstrap transaction wrote is still there.
    db = open();
    api = ScriptedGridViewApi();
    h = SyncHarness(db, api);
    addTearDown(() async {
      await h.dispose();
      await db.close();
    });

    expect(await db.calendarDao.countEventsForSeason(2026), 5);
    expect(await db.standingsDao.countDriverStandings(2026), 7);
    expect(await db.competitorDao.countDriverSeasonEntries(2026), 8);
    expect((await db.seasonDao.readCurrentSeason())?.year, 2026);

    final ResourceSyncState meta = (await db.syncMetadataDao.read(
      ResourceKey.bootstrap(),
    ))!;
    expect(meta.etag, 'W/"bootstrap-disk"');
    expect(meta.lastSuccessAt, isNotNull);
    expect(meta.staleAfter, isNotNull);
  });

  test('a returning launch renders cached Home with no network', () async {
    GridViewDatabase db = open();
    ScriptedGridViewApi api = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    SyncHarness h = SyncHarness(db, api);
    await h.coordinator.start();
    await h.dispose();
    await db.close();

    // Reopen with a data source that fails every call: the cache still renders.
    db = open();
    api = ScriptedGridViewApi();
    api.bootstrap = (_) => const RemoteFailure<BootstrapDataDto>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    h = SyncHarness(db, api);
    addTearDown(() async {
      await h.dispose();
      await db.close();
    });

    final HomeView? home = await db.verticalSliceDao.watchHome().first;
    expect(home, isNotNull);
    expect(home!.featured.season, 2026);
    expect(
      api.calls,
      isEmpty,
      reason: 'reading the cache never touches the network',
    );
  });

  test('a foreground 304 after reopen reuses the persisted ETag', () async {
    GridViewDatabase db = open();
    ScriptedGridViewApi api = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    SyncHarness h = SyncHarness(db, api);
    await h.coordinator.start();
    scriptCoreEndpoints(api);
    await h.coordinator.onForeground();
    final String? calendarEtag = (await db.syncMetadataDao.read(
      ResourceKey.calendar(2026),
    ))?.etag;
    expect(calendarEtag, isNotNull);
    await h.dispose();
    await db.close();

    db = open();
    api = ScriptedGridViewApi();
    scriptCoreEndpoints(api);
    h = SyncHarness(db, api);
    addTearDown(() async {
      await h.dispose();
      await db.close();
    });

    // Everything is due again from the app's point of view only if the server
    // says so; force the run to prove the stored validator is sent.
    await h.coordinator.refreshNow();
    expect(api.lastEtag['calendar'], calendarEtag);
    expect(api.lastEtag['home'], isNotNull);
  });

  test('a failed foreground refresh preserves the cached content', () async {
    GridViewDatabase db = open();
    ScriptedGridViewApi api = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    SyncHarness h = SyncHarness(db, api);
    await h.coordinator.start();
    await h.dispose();
    await db.close();

    db = open();
    api = ScriptedGridViewApi();
    scriptCoreEndpoints(api);
    api.home = (_) => const RemoteFailure<HomeDataDto>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    h = SyncHarness(db, api);
    addTearDown(() async {
      await h.dispose();
      await db.close();
    });

    await h.coordinator.onForeground();

    final HomeView? home = await db.verticalSliceDao.watchHome().first;
    expect(home, isNotNull, reason: 'a failure never clears valid cache');
    expect(await db.calendarDao.countEventsForSeason(2026), 5);
    final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
    expect(state.fullSuccess, isFalse);
    expect(state.successCount, greaterThan(0));
  });

  test('a valid empty collection stays valid across a reopen', () async {
    GridViewDatabase db = open();
    ScriptedGridViewApi api = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(
        bootstrapEnvelope(
          calendar: <dynamic>[],
          drivers: <dynamic>[],
          constructors: <dynamic>[],
          circuits: <dynamic>[],
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
          home: emptyHomeJson(),
        ),
        etag: 'W/"empty-disk"',
      );
    SyncHarness h = SyncHarness(db, api);
    await h.coordinator.start();
    expect(await h.repositories.bootstrap.isMaterialized(), isTrue);
    await h.dispose();
    await db.close();

    db = open();
    api = ScriptedGridViewApi();
    int bootstrapCalls = 0;
    api.bootstrap = (String? etag) {
      bootstrapCalls++;
      expect(etag, 'W/"empty-disk"');
      return const RemoteNotModified<BootstrapDataDto>();
    };
    h = SyncHarness(db, api);
    addTearDown(() async {
      await h.dispose();
      await db.close();
    });

    expect(await h.repositories.bootstrap.isMaterialized(), isTrue);
    await h.repositories.bootstrap.refreshBootstrap();
    expect(
      bootstrapCalls,
      1,
      reason: 'an empty but synchronized bootstrap needs no recovery retry',
    );
  });

  test(
    'no synchronized core screen needs live network after a bootstrap',
    () async {
      GridViewDatabase db = open();
      final ScriptedGridViewApi api = ScriptedGridViewApi()
        ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      SyncHarness h = SyncHarness(db, api);
      await h.coordinator.start();
      await h.dispose();
      await db.close();

      db = open();
      final ScriptedGridViewApi offline = ScriptedGridViewApi();
      h = SyncHarness(db, offline);
      addTearDown(() async {
        await h.dispose();
        await db.close();
      });

      // Every core read model resolves from the local database alone.
      expect(await db.verticalSliceDao.watchHome().first, isNotNull);
      expect(await h.repositories.calendar.readCalendar(2026), hasLength(5));
      expect(
        await h.repositories.standings.readDriverStandings(2026),
        hasLength(7),
      );
      expect(
        await h.repositories.standings.readConstructorStandings(2026),
        hasLength(6),
      );
      expect(
        await h.repositories.drivers.readSeasonDrivers(2026),
        hasLength(8),
      );
      expect(
        await h.repositories.constructors.readSeasonConstructors(2026),
        hasLength(6),
      );
      expect(
        await h.repositories.circuits.readSeasonCircuits(2026),
        isNotEmpty,
      );
      expect(offline.calls, isEmpty);
    },
  );
}
