import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/bootstrap_fixture.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// Offline-first behaviour of the two standings collections against a real
/// on-disk database: what survives a close/reopen, what a bootstrap-materialized
/// table looks like after a restart, and that a failed refresh of one
/// championship never touches the other's cached rows.
void main() {
  late Directory tempDir;
  late File dbFile;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_standings_offline');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  GridViewDatabase open() =>
      GridViewDatabase.forTesting(NativeDatabase(dbFile));

  RemoteResult<List<DriverStandingDto>> drivers({String etag = 'W/"ds1"'}) =>
      modifiedListFromFixture<DriverStandingDto>(
        'standings/drivers-fractional.json',
        DriverStandingDto.fromJson,
        etag: etag,
      );

  RemoteResult<List<ConstructorStandingDto>> constructors({
    String etag = 'W/"cs1"',
  }) => modifiedListFromFixture<ConstructorStandingDto>(
    'standings/constructors.json',
    ConstructorStandingDto.fromJson,
    etag: etag,
  );

  test(
    'both collections, their rows and their ETags survive a reopen',
    () async {
      // --- First session ---
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.driverStandings = (_) => drivers();
      api1.constructorStandings = (_) => constructors();
      final RepositoryHarness h1 = RepositoryHarness(db1, api1);

      expect(
        await h1.standings.refreshDriverStandings(2026),
        isA<RefreshSuccess>(),
      );
      expect(
        await h1.standings.refreshConstructorStandings(2026),
        isA<RefreshSuccess>(),
      );
      final int driverRows = (await h1.standings.readDriverStandingEntries(
        2026,
      )).length;
      final int teamRows = (await h1.standings.readConstructorStandingEntries(
        2026,
      )).length;
      expect(driverRows, greaterThan(0));
      expect(teamRows, greaterThan(0));
      await db1.close();

      // --- Second session: a cold start with no network at all ---
      final GridViewDatabase db2 = open();
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      final RepositoryHarness h2 = RepositoryHarness(db2, api2);

      final List<DriverStandingEntry> reopenedDrivers = await h2.standings
          .readDriverStandingEntries(2026);
      final List<ConstructorStandingEntry> reopenedTeams = await h2.standings
          .readConstructorStandingEntries(2026);
      expect(reopenedDrivers, hasLength(driverRows));
      expect(reopenedTeams, hasLength(teamRows));
      expect(api2.calls, isEmpty, reason: 'reading the cache is offline-only');

      // Fractional points and the delivered order survived exactly.
      expect(reopenedDrivers.first.points, 210.5);
      expect(
        reopenedDrivers.map((DriverStandingEntry r) => r.orderIndex),
        List<int>.generate(driverRows, (int i) => i),
      );

      // Each resource kept its own validator.
      expect(
        (await db2.syncMetadataDao.read(
          ResourceKey.driverStandings(2026),
        ))?.etag,
        'W/"ds1"',
      );
      expect(
        (await db2.syncMetadataDao.read(
          ResourceKey.constructorStandings(2026),
        ))?.etag,
        'W/"cs1"',
      );

      // --- A later revalidation sends the selected resource's own validator ---
      api2.driverStandings = (String? etag) =>
          RemoteNotModified<List<DriverStandingDto>>(etag: etag);
      expect(
        await h2.standings.refreshDriverStandings(2026),
        isA<RefreshSuccess>(),
      );
      expect(api2.lastEtag['driverStandings'], 'W/"ds1"');
      expect(
        api2.callsFor('constructorStandings'),
        0,
        reason: "the other championship's validator is never used or sent",
      );
      // A 304 emitted no false content change.
      expect(
        await h2.standings.readDriverStandingEntries(2026),
        hasLength(driverRows),
      );
      await db2.close();
    },
  );

  test(
    'bootstrap-materialized rows survive a reopen with no metadata',
    () async {
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      final RepositoryHarness h1 = RepositoryHarness(db1, api1);
      expect(await h1.bootstrap.refreshBootstrap(), isA<RefreshSuccess>());
      final int driverRows = (await h1.standings.readDriverStandingEntries(
        2026,
      )).length;
      final int teamRows = (await h1.standings.readConstructorStandingEntries(
        2026,
      )).length;
      expect(driverRows, greaterThan(0));
      expect(teamRows, greaterThan(0));
      await db1.close();

      final GridViewDatabase db2 = open();
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      final RepositoryHarness h2 = RepositoryHarness(db2, api2);

      expect(
        await h2.standings.readDriverStandingEntries(2026),
        hasLength(driverRows),
      );
      expect(
        await h2.standings.readConstructorStandingEntries(2026),
        hasLength(teamRows),
      );
      // Bootstrap fabricated no individual metadata, so neither table claims an
      // update time and both remain due for their first individual sync.
      expect(
        await db2.syncMetadataDao.read(ResourceKey.driverStandings(2026)),
        isNull,
      );
      expect(
        await db2.syncMetadataDao.read(ResourceKey.constructorStandings(2026)),
        isNull,
      );
      final ResourceSyncState? boot = await db2.syncMetadataDao.read(
        ResourceKey.bootstrap(),
      );
      expect(boot?.season, 2026);
      expect(api2.calls, isEmpty);

      // The first individual request sends no fabricated validator.
      api2.driverStandings = (_) => drivers(etag: 'W/"ds-first"');
      await h2.standings.refreshDriverStandings(2026);
      expect(api2.lastEtag['driverStandings'], isNull);
      expect(
        (await db2.syncMetadataDao.read(
          ResourceKey.driverStandings(2026),
        ))?.etag,
        'W/"ds-first"',
      );
      expect(
        await db2.syncMetadataDao.read(ResourceKey.constructorStandings(2026)),
        isNull,
        reason: 'only its own resource earned metadata',
      );
      await db2.close();
    },
  );

  test(
    'a bootstrap-materialized empty table survives a reopen as empty',
    () async {
      final GridViewDatabase db1 = open();
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.bootstrap = (_) => bootstrapModified(
        bootstrapEnvelope(
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
        ),
      );
      final RepositoryHarness h1 = RepositoryHarness(db1, api1);
      await h1.bootstrap.refreshBootstrap();
      await db1.close();

      final GridViewDatabase db2 = open();
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      final RepositoryHarness h2 = RepositoryHarness(db2, api2);

      // Empty, and distinguishable from "never synchronised" only through the
      // persisted bootstrap record — never through a row count.
      expect(await h2.standings.readDriverStandingEntries(2026), isEmpty);
      expect(await h2.standings.readConstructorStandingEntries(2026), isEmpty);
      final ResourceSyncState? boot = await db2.syncMetadataDao.read(
        ResourceKey.bootstrap(),
      );
      expect(boot?.lastSuccessAt, isNotNull);
      expect(boot?.season, 2026);
      expect(
        await db2.syncMetadataDao.read(ResourceKey.driverStandings(2026)),
        isNull,
      );
      expect(
        await db2.syncMetadataDao.read(ResourceKey.constructorStandings(2026)),
        isNull,
      );
      await db2.close();
    },
  );

  test('a failed refresh of one championship preserves both caches', () async {
    final GridViewDatabase db = open();
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.driverStandings = (_) => drivers();
    api.constructorStandings = (_) => constructors();
    final RepositoryHarness h = RepositoryHarness(db, api);
    await h.standings.refreshDriverStandings(2026);
    await h.standings.refreshConstructorStandings(2026);
    final int driverRows = (await h.standings.readDriverStandingEntries(
      2026,
    )).length;
    final int teamRows = (await h.standings.readConstructorStandingEntries(
      2026,
    )).length;

    // The drivers' resource now fails.
    api.driverStandings = (_) => RemoteFailure<List<DriverStandingDto>>(
      const ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    expect(
      await h.standings.refreshDriverStandings(2026),
      isA<RefreshFailure>(),
    );
    expect(
      await h.standings.readDriverStandingEntries(2026),
      hasLength(driverRows),
      reason: 'cached rows are never deleted because a refresh failed',
    );
    expect(
      await h.standings.readConstructorStandingEntries(2026),
      hasLength(teamRows),
      reason: 'the other championship is untouched',
    );
    // Its validator and last success are preserved for the next attempt.
    final ResourceSyncState? meta = await db.syncMetadataDao.read(
      ResourceKey.driverStandings(2026),
    );
    expect(meta?.etag, 'W/"ds1"');
    expect(meta?.lastSuccessAt, isNotNull);

    // And the same in the other direction.
    api.constructorStandings = (_) =>
        RemoteFailure<List<ConstructorStandingDto>>(
          const ApiFailure(kind: ApiFailureKind.serverUnavailable),
        );
    expect(
      await h.standings.refreshConstructorStandings(2026),
      isA<RefreshFailure>(),
    );
    expect(
      await h.standings.readConstructorStandingEntries(2026),
      hasLength(teamRows),
    );
    await db.close();
  });

  test('an old season survives a current-season transition', () async {
    final GridViewDatabase db = open();
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.driverStandings = (_) => drivers();
    final RepositoryHarness h = RepositoryHarness(db, api);
    await h.standings.refreshDriverStandings(2026);
    final int rows2026 = (await h.standings.readDriverStandingEntries(
      2026,
    )).length;

    // A new season's table is written; the previous one is not deleted.
    await db.standingsDao.replaceDriverStandings(2027, <DriverStanding>[
      const DriverStanding(
        season: 2027,
        driverId: 'max-verstappen',
        position: 1,
        points: 25,
      ),
    ]);

    expect(
      await h.standings.readDriverStandingEntries(2026),
      hasLength(rows2026),
    );
    expect(await h.standings.readDriverStandingEntries(2027), hasLength(1));
    expect(
      await db.syncMetadataDao.read(ResourceKey.driverStandings(2026)),
      isNotNull,
    );
    await db.close();
  });
}
