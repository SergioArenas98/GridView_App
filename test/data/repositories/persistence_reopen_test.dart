import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/fixtures.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// Proves that synchronized resource data — domain rows, ETags and freshness
/// metadata — survives closing and reopening a real on-disk database, and that a
/// reopened cache renders with no network and uses its persisted ETag for the
/// next conditional request.
void main() {
  late Directory tempDir;
  late File dbFile;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_repo_reopen');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  RemoteResult<List<GrandPrixSummaryDto>> calendar({
    String etag = 'W/"cal1"',
  }) => modifiedListFromFixture<GrandPrixSummaryDto>(
    'calendar/2026.json',
    GrandPrixSummaryDto.fromJson,
    etag: etag,
  );

  RemoteResult<List<DriverStandingDto>> standings({String etag = 'W/"ds1"'}) =>
      modifiedListFromFixture<DriverStandingDto>(
        'standings/drivers-fractional.json',
        (Map<String, dynamic> e) => DriverStandingDto.fromJson(e),
        etag: etag,
      );

  test(
    'synchronized data, ETags and freshness survive a close/reopen',
    () async {
      // --- First session: sync a calendar and driver standings on disk. ---
      final GridViewDatabase db1 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.calendar = (_) => calendar();
      api1.driverStandings = (_) => standings();
      final RepositoryHarness h1 = RepositoryHarness(db1, api1);

      expect(await h1.calendar.refreshCalendar(2026), isA<RefreshSuccess>());
      expect(
        await h1.standings.refreshDriverStandings(2026),
        isA<RefreshSuccess>(),
      );
      final int events = (await h1.calendar.readCalendar(2026)).length;
      final int drivers = (await h1.standings.readDriverStandings(2026)).length;
      expect(events, greaterThan(0));
      expect(drivers, greaterThan(0));
      await db1.close();

      // --- Second session: reopen with an OFFLINE API (every call fails). ---
      final GridViewDatabase db2 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      final ScriptedGridViewApi offline = ScriptedGridViewApi();
      // No responders scripted -> every endpoint returns notFound; but we never
      // call the network for a read, proving offline rendering from cache.
      final RepositoryHarness h2 = RepositoryHarness(db2, offline);

      // Domain data renders with no network.
      expect(await h2.calendar.readCalendar(2026), hasLength(events));
      final List<DriverStanding> reopened = await h2.standings
          .readDriverStandings(2026);
      expect(reopened, hasLength(drivers));
      // Fractional points survived intact.
      expect(reopened.first.points, 210.5);

      // ETags + freshness metadata survived.
      final ResourceSyncState calMeta = (await db2.syncMetadataDao.read(
        ResourceKey.calendar(2026),
      ))!;
      expect(calMeta.etag, 'W/"cal1"');
      expect(calMeta.lastSuccessAt, isNotNull);
      expect(calMeta.sourceUpdatedAt, isNotNull);
      final ResourceSyncState dsMeta = (await db2.syncMetadataDao.read(
        ResourceKey.driverStandings(2026),
      ))!;
      expect(dsMeta.etag, 'W/"ds1"');
      await db2.close();
    },
  );

  test('a 304 after reopen uses the persisted ETag', () async {
    // First session: sync the calendar (persists ETag W/"cal1").
    final GridViewDatabase db1 = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    final ScriptedGridViewApi api1 = ScriptedGridViewApi();
    api1.calendar = (_) => calendar(etag: 'W/"persisted"');
    await RepositoryHarness(db1, api1).calendar.refreshCalendar(2026);
    await db1.close();

    // Reopen: the next refresh must send If-None-Match with the persisted ETag,
    // and a 304 keeps the cache without a domain rewrite.
    final GridViewDatabase db2 = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    String? sentEtag;
    final ScriptedGridViewApi api2 = ScriptedGridViewApi();
    api2.calendar = (String? etag) {
      sentEtag = etag;
      return RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
    };
    final RepositoryHarness h2 = RepositoryHarness(db2, api2);

    final RefreshResult r = await h2.calendar.refreshCalendar(2026);
    expect(sentEtag, 'W/"persisted"', reason: 'reopened cache reused its ETag');
    expect((r as RefreshSuccess).applied, isFalse);
    final List<CalendarEntry> cal = await h2.calendar.readCalendar(2026);
    expect(cal, isNotEmpty, reason: 'cache intact after a reopen + 304');
    await db2.close();
  });

  test(
    'a valid EMPTY collection survives close/reopen and stays valid on a 304',
    () async {
      // First session: sync an authoritative EMPTY calendar (zero events).
      final GridViewDatabase db1 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      final ScriptedGridViewApi api1 = ScriptedGridViewApi();
      api1.calendar = (_) {
        final Map<String, dynamic> json = loadFixture('calendar/2026.json');
        json['data'] = <dynamic>[];
        return modifiedListFromJson<GrandPrixSummaryDto>(
          json,
          GrandPrixSummaryDto.fromJson,
          etag: 'W/"empty"',
        );
      };
      final RefreshResult first = await RepositoryHarness(
        db1,
        api1,
      ).calendar.refreshCalendar(2026);
      expect((first as RefreshSuccess).applied, isTrue);
      await db1.close();

      // Reopen: the empty collection is still a materialized representation, so a
      // 304 makes no unconditional retry and no domain write.
      final GridViewDatabase db2 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      addTearDown(db2.close);
      final ScriptedGridViewApi api2 = ScriptedGridViewApi();
      api2.calendar = (String? etag) =>
          RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
      final RepositoryHarness h2 = RepositoryHarness(db2, api2);

      final RefreshResult r = await h2.calendar.refreshCalendar(2026);
      expect((r as RefreshSuccess).applied, isFalse);
      expect(
        api2.callsFor('calendar'),
        1,
        reason: 'no unconditional retry for a valid empty collection',
      );
      expect(await h2.calendar.readCalendar(2026), isEmpty);
      final ResourceSyncState meta = (await db2.syncMetadataDao.read(
        ResourceKey.calendar(2026),
      ))!;
      expect(meta.etag, 'W/"empty"');
      expect(meta.lastSuccessAt, isNotNull);
    },
  );
}
