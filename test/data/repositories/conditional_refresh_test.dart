import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

RemoteResult<List<GrandPrixSummaryDto>> _calendar({
  String etag = 'W/"cal1"',
  String source = '2026-07-18T11:55:00Z',
  String generated = '2026-07-18T12:00:00Z',
}) => modifiedListFromFixture<GrandPrixSummaryDto>(
  'calendar/2026.json',
  GrandPrixSummaryDto.fromJson,
  etag: etag,
  sourceUpdatedAt: source,
  generatedAt: generated,
);

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api, now: DateTime.utc(2026, 7, 20));
  });
  tearDown(() => db.close());

  Future<ResourceSyncState?> meta(int season) =>
      db.syncMetadataDao.read(ResourceKey.calendar(season));

  group('calendar conditional refresh', () {
    test(
      'empty cache + 200 caches, persists ETag and success metadata',
      () async {
        api.calendar = (_) => _calendar();
        expect(await h.calendar.readCalendar(2026), isEmpty);

        final RefreshResult r = await h.calendar.refreshCalendar(2026);
        expect(r, isA<RefreshSuccess>());
        expect((r as RefreshSuccess).applied, isTrue);

        final List<GrandPrix> cal = await h.calendar.readCalendar(2026);
        expect(cal, hasLength(5));
        final ResourceSyncState m = (await meta(2026))!;
        expect(m.etag, 'W/"cal1"');
        expect(m.lastSuccessAt, DateTime.utc(2026, 7, 20));
        expect(m.lastFailureCategory, isNull);
      },
    );

    test('a second refresh sends If-None-Match with the stored ETag', () async {
      api.calendar = (_) => _calendar();
      await h.calendar.refreshCalendar(2026);

      String? sent;
      api.calendar = (String? etag) {
        sent = etag;
        return RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
      };
      await h.calendar.refreshCalendar(2026);
      expect(sent, 'W/"cal1"');
    });

    test(
      'existing cache + 304 keeps data and bumps success (non-applied)',
      () async {
        api.calendar = (_) => _calendar();
        await h.calendar.refreshCalendar(2026);

        api.calendar = (String? etag) =>
            RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
        final RefreshResult r = await h.calendar.refreshCalendar(2026);
        expect((r as RefreshSuccess).applied, isFalse);
        expect(await h.calendar.readCalendar(2026), hasLength(5));
        expect((await meta(2026))!.lastSuccessAt, DateTime.utc(2026, 7, 20));
      },
    );

    test('newer snapshot updates; older/equal do not overwrite', () async {
      api.calendar = (_) => _calendar(source: '2026-07-18T11:00:00Z');
      await h.calendar.refreshCalendar(2026);

      // Older source -> rejected, cache preserved, success non-applied.
      api.calendar = (_) =>
          _calendar(etag: 'W/"older"', source: '2026-07-18T06:00:00Z');
      final RefreshResult older = await h.calendar.refreshCalendar(2026);
      expect((older as RefreshSuccess).applied, isFalse);
      expect((await meta(2026))!.etag, 'W/"cal1"');
      expect((await meta(2026))!.lastFailureCategory, 'conflict_older');

      // Equal source + equal content -> idempotent skip.
      api.calendar = (_) => _calendar(source: '2026-07-18T11:00:00Z');
      final RefreshResult equal = await h.calendar.refreshCalendar(2026);
      expect((equal as RefreshSuccess).applied, isFalse);

      // Newer source -> applied.
      api.calendar = (_) => _calendar(
        etag: 'W/"newer"',
        source: '2026-07-18T20:00:00Z',
        generated: '2026-07-18T20:05:00Z',
      );
      final RefreshResult newer = await h.calendar.refreshCalendar(2026);
      expect((newer as RefreshSuccess).applied, isTrue);
      expect((await meta(2026))!.etag, 'W/"newer"');
    });

    test(
      'network failure preserves the cache and records the category',
      () async {
        api.calendar = (_) => _calendar();
        await h.calendar.refreshCalendar(2026);

        api.calendar = (_) => const RemoteFailure<List<GrandPrixSummaryDto>>(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );
        final RefreshResult r = await h.calendar.refreshCalendar(2026);
        expect(
          (r as RefreshFailure).failure.kind,
          ApiFailureKind.networkUnavailable,
        );
        expect(await h.calendar.readCalendar(2026), hasLength(5));
        final ResourceSyncState m = (await meta(2026))!;
        expect(m.etag, 'W/"cal1"', reason: 'etag preserved on failure');
        expect(m.lastSuccessAt, DateTime.utc(2026, 7, 20));
        expect(m.lastFailureCategory, 'networkUnavailable');
      },
    );

    test('empty cache + failure surfaces the failure and no data', () async {
      api.calendar = (_) => const RemoteFailure<List<GrandPrixSummaryDto>>(
        ApiFailure(kind: ApiFailureKind.networkTimeout),
      );
      final RefreshResult r = await h.calendar.refreshCalendar(2026);
      expect(r, isA<RefreshFailure>());
      expect(await h.calendar.readCalendar(2026), isEmpty);
    });

    test('an invalid response preserves the cache', () async {
      api.calendar = (_) => _calendar();
      await h.calendar.refreshCalendar(2026);

      api.calendar = (_) => const RemoteFailure<List<GrandPrixSummaryDto>>(
        ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
      final RefreshResult r = await h.calendar.refreshCalendar(2026);
      expect(r, isA<RefreshFailure>());
      expect(await h.calendar.readCalendar(2026), hasLength(5));
    });

    test(
      '304 with absent local data triggers exactly one unconditional retry',
      () async {
        // Seed metadata with an ETag but NO domain rows (a cache inconsistency).
        await db.syncMetadataDao.upsert(
          ResourceSyncState(
            resourceKey: ResourceKey.calendar(2026),
            season: 2026,
            etag: 'W/"stale"',
            lastSuccessAt: DateTime.utc(2026, 7, 19),
          ),
        );

        // First call (conditional, etag present) -> 304; retry (unconditional,
        // etag null) -> 200.
        api.calendar = (String? etag) => etag == null
            ? _calendar(etag: 'W/"recovered"')
            : RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);

        final RefreshResult r = await h.calendar.refreshCalendar(2026);
        expect((r as RefreshSuccess).applied, isTrue);
        expect(
          api.callsFor('calendar'),
          2,
          reason: 'one conditional + one retry',
        );
        expect(await h.calendar.readCalendar(2026), hasLength(5));
        expect((await meta(2026))!.etag, 'W/"recovered"');
      },
    );

    test(
      '304 with absent local data that stays 304 fails as invalid cache',
      () async {
        await db.syncMetadataDao.upsert(
          ResourceSyncState(
            resourceKey: ResourceKey.calendar(2026),
            season: 2026,
            etag: 'W/"stale"',
            lastSuccessAt: DateTime.utc(2026, 7, 19),
          ),
        );
        // Both the conditional call and the unconditional retry return 304.
        api.calendar = (String? etag) =>
            const RemoteNotModified<List<GrandPrixSummaryDto>>(
              etag: 'W/"stale"',
            );
        final RefreshResult r = await h.calendar.refreshCalendar(2026);
        expect(
          (r as RefreshFailure).failure.kind,
          ApiFailureKind.invalidResponse,
        );
        expect(api.callsFor('calendar'), 2, reason: 'retried exactly once');
        expect(
          (await meta(2026))!.lastFailureCategory,
          SyncFailureCategory.invalidCache,
        );
      },
    );

    test('other seasons remain untouched by a season refresh', () async {
      api.calendar = (_) => _calendar();
      await h.calendar.refreshCalendar(2026);
      expect(await h.calendar.readCalendar(2025), isEmpty);
      expect(await meta(2025), isNull);
    });

    test('the local stream emits only after a commit', () async {
      final List<int> lengths = <int>[];
      final sub = h.calendar
          .watchCalendar(2026)
          .listen((List<GrandPrix> c) => lengths.add(c.length));
      await Future<void>.delayed(const Duration(milliseconds: 20));

      api.calendar = (_) => _calendar();
      await h.calendar.refreshCalendar(2026);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      // A 304 must not produce a new domain emission.
      api.calendar = (String? etag) =>
          RemoteNotModified<List<GrandPrixSummaryDto>>(etag: etag);
      await h.calendar.refreshCalendar(2026);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      await sub.cancel();
      expect(lengths.first, 0, reason: 'initial empty emission');
      expect(lengths, contains(5));
      expect(
        lengths.where((int l) => l == 5).length,
        1,
        reason: 'no duplicate emission on 304',
      );
    });
  });

  group('cross-resource independence', () {
    test('driver and constructor standings sync independently', () async {
      api.driverStandings = (_) => modifiedListFromFixture<DriverStandingDto>(
        'standings/drivers-fractional.json',
        DriverStandingDto.fromJson,
        etag: 'W/"ds"',
      );
      api.constructorStandings = (_) =>
          const RemoteFailure<List<ConstructorStandingDto>>(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );

      final RefreshResult drivers = await h.standings.refreshDriverStandings(
        2026,
      );
      final RefreshResult constructors = await h.standings
          .refreshConstructorStandings(2026);

      expect(drivers, isA<RefreshSuccess>());
      expect(constructors, isA<RefreshFailure>());
      expect(await h.standings.readDriverStandings(2026), isNotEmpty);
      expect(await h.standings.readConstructorStandings(2026), isEmpty);
      // Distinct metadata rows, one succeeded and one failed.
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.driverStandings(2026),
        ))!.lastSuccessAt,
        isNotNull,
      );
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.constructorStandings(2026),
        ))!.lastSuccessAt,
        isNull,
      );
    });
  });
}
