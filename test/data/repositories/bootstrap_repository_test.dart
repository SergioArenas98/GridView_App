import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/bootstrap_fixture.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api);
  });
  tearDown(() => db.close());

  Future<ResourceSyncState?> bootstrapMeta() =>
      db.syncMetadataDao.read(ResourceKey.bootstrap());

  group('accepted bootstrap', () {
    test('an empty database plus a 200 materializes every family', () async {
      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());

      final RefreshResult result = await h.bootstrap.refreshBootstrap();
      expect(result, isA<RefreshSuccess>());
      expect((result as RefreshSuccess).applied, isTrue);

      final Season? season = await db.seasonDao.readCurrentSeason();
      expect(season?.year, 2026);

      expect(await db.calendarDao.countEventsForSeason(2026), 5);
      expect(await db.competitorDao.countDriverSeasonEntries(2026), 8);
      expect(await db.competitorDao.countConstructorSeasonEntries(2026), 6);
      expect(await db.standingsDao.countDriverStandings(2026), 7);
      expect(await db.standingsDao.countConstructorStandings(2026), 6);
      expect(await db.calendarDao.countCircuits(), greaterThanOrEqualTo(5));
      expect(await db.verticalSliceDao.countHomeSnapshot(), 1);
    });

    test(
      'success metadata and the ETag persist under the bootstrap key',
      () async {
        api.bootstrap = (_) =>
            bootstrapModified(bootstrapEnvelope(), etag: 'W/"bootstrap-a"');
        await h.bootstrap.refreshBootstrap();

        final ResourceSyncState meta = (await bootstrapMeta())!;
        expect(meta.etag, 'W/"bootstrap-a"');
        expect(meta.lastSuccessAt, isNotNull);
        expect(meta.lastFailureCategory, isNull);
        expect(meta.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11, 55));
        expect(meta.staleAfter, DateTime.utc(2026, 7, 18, 12, 15));
      },
    );

    test(
      'no individual resource acquires bootstrap metadata or a fabricated ETag',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        for (final String key in <String>[
          ResourceKey.home(2026),
          ResourceKey.currentSeason(),
          ResourceKey.season(2026),
          ResourceKey.calendar(2026),
          ResourceKey.driverStandings(2026),
          ResourceKey.constructorStandings(2026),
          ResourceKey.drivers(2026),
          ResourceKey.constructors(2026),
          ResourceKey.circuits(2026),
          ResourceKey.contentManifest(),
        ]) {
          expect(
            await db.syncMetadataDao.read(key),
            isNull,
            reason: '$key must not inherit the bootstrap representation',
          );
        }
      },
    );

    test('an equal bootstrap is an idempotent no-op', () async {
      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      // Same revision, offered again without a validator.
      final RefreshResult second = await h.bootstrap.refreshBootstrap(
        bypassValidator: true,
      );
      expect(second, isA<RefreshSuccess>());
      expect((second as RefreshSuccess).applied, isFalse);
      expect(second.application, RefreshApplication.idempotent);
    });

    test('an older bootstrap is rejected and preserves the cache', () async {
      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      api.bootstrap = (_) => bootstrapModified(
        bootstrapEnvelope(
          sourceUpdatedAt: '2026-07-01T00:00:00Z',
          calendar: <dynamic>[],
        ),
      );
      final RefreshResult second = await h.bootstrap.refreshBootstrap(
        bypassValidator: true,
      );

      expect(
        (second as RefreshSuccess).application,
        RefreshApplication.rejectedOlder,
      );
      expect(await db.calendarDao.countEventsForSeason(2026), 5);
    });

    test(
      'a contract-invalid bootstrap (no sourceUpdatedAt) preserves the cache',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        api.bootstrap = (_) => bootstrapModified(
          bootstrapEnvelope(sourceUpdatedAt: null, calendar: <dynamic>[]),
        );
        final RefreshResult second = await h.bootstrap.refreshBootstrap(
          bypassValidator: true,
        );

        expect(second, isA<RefreshFailure>());
        expect(
          (second as RefreshFailure).failure.kind,
          ApiFailureKind.invalidResponse,
        );
        expect(await db.calendarDao.countEventsForSeason(2026), 5);
      },
    );
  });

  group('atomicity', () {
    test(
      'one invalid family rolls back every other bootstrap change',
      () async {
        // An inverted participation span is rejected by the DAO inside the
        // transaction, so nothing from this bootstrap may survive.
        final List<dynamic> drivers = driversJson()
            .cast<Map<String, dynamic>>()
            .map(
              (Map<String, dynamic> d) =>
                  Map<String, dynamic>.from(d)..['driverId'] = 'Not A Slug',
            )
            .toList();
        api.bootstrap = (_) =>
            bootstrapModified(bootstrapEnvelope(drivers: drivers));

        final RefreshResult result = await h.bootstrap.refreshBootstrap();
        expect(result, isA<RefreshFailure>());

        expect(await db.calendarDao.countEventsForSeason(2026), 0);
        expect(await db.standingsDao.countDriverStandings(2026), 0);
        expect(await db.verticalSliceDao.countHomeSnapshot(), 0);
        expect(await db.seasonDao.countCurrentSeason(), 0);

        final ResourceSyncState meta = (await bootstrapMeta())!;
        expect(meta.lastSuccessAt, isNull);
        expect(meta.lastFailureCategory, isNotNull);
      },
    );

    test(
      'a transport failure writes nothing and preserves the cache',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        api.bootstrap = (_) => const RemoteFailure<BootstrapDataDto>(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );
        final RefreshResult second = await h.bootstrap.refreshBootstrap();

        expect(second, isA<RefreshFailure>());
        expect(await db.calendarDao.countEventsForSeason(2026), 5);
        final ResourceSyncState meta = (await bootstrapMeta())!;
        expect(meta.etag, isNotNull, reason: 'a failure keeps the validator');
        expect(meta.lastSuccessAt, isNotNull);
      },
    );
  });

  group('304 semantics', () {
    test(
      'a valid bootstrap 304 makes one request and writes no domain rows',
      () async {
        api.bootstrap = (String? etag) => etag == 'W/"bootstrap-a"'
            ? const RemoteNotModified<BootstrapDataDto>(etag: 'W/"bootstrap-a"')
            : bootstrapModified(bootstrapEnvelope(), etag: 'W/"bootstrap-a"');

        await h.bootstrap.refreshBootstrap();
        final int callsAfterFirst = api.callsFor('bootstrap');
        final DateTime? writtenAt =
            (await db.verticalSliceDao.watchHome().first)
                ?.freshness
                .generatedAt;

        final RefreshResult second = await h.bootstrap.refreshBootstrap();
        expect(
          (second as RefreshSuccess).application,
          RefreshApplication.notModified,
        );
        expect(api.callsFor('bootstrap'), callsAfterFirst + 1);
        expect(
          (await db.verticalSliceDao.watchHome().first)?.freshness.generatedAt,
          writtenAt,
        );
      },
    );

    test(
      'a 304 with no recorded bootstrap retries once, unconditionally',
      () async {
        int calls = 0;
        api.bootstrap = (String? etag) {
          calls++;
          return calls == 1
              ? const RemoteNotModified<BootstrapDataDto>()
              : bootstrapModified(bootstrapEnvelope());
        };

        final RefreshResult result = await h.bootstrap.refreshBootstrap();
        expect(result, isA<RefreshSuccess>());
        expect(calls, 2);
        expect(await db.seasonDao.countCurrentSeason(), 1);
      },
    );

    test(
      'a valid but empty bootstrap stays materialized across a later 304',
      () async {
        // A season with nothing scheduled: every collection is legitimately
        // empty and Home carries no featured event.
        Map<String, dynamic> empty() => bootstrapEnvelope(
          calendar: <dynamic>[],
          drivers: <dynamic>[],
          constructors: <dynamic>[],
          circuits: <dynamic>[],
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
          home: emptyHomeJson(),
        );
        api.bootstrap = (String? etag) => etag == 'W/"empty"'
            ? const RemoteNotModified<BootstrapDataDto>()
            : bootstrapModified(empty(), etag: 'W/"empty"');

        expect(await h.bootstrap.refreshBootstrap(), isA<RefreshSuccess>());
        expect(await h.bootstrap.isMaterialized(), isTrue);
        final int callsAfterFirst = api.callsFor('bootstrap');

        // The 304 must be metadata-only: one request, no unconditional retry.
        final RefreshResult second = await h.bootstrap.refreshBootstrap();
        expect(
          (second as RefreshSuccess).application,
          RefreshApplication.notModified,
        );
        expect(api.callsFor('bootstrap'), callsAfterFirst + 1);
      },
    );

    test('a recorded bootstrap with no current-season identity is not a '
        'representation', () async {
      // Metadata says a bootstrap succeeded, but the identity its stored data
      // needs in order to render is absent: the cache is inconsistent, so a
      // 304 must not be trusted.
      await db.syncMetadataDao.upsert(
        ResourceSyncState(
          resourceKey: ResourceKey.bootstrap(),
          etag: 'W/"orphan"',
          lastSuccessAt: DateTime.utc(2026, 7, 18, 12),
        ),
      );
      expect(await h.bootstrap.isMaterialized(), isFalse);

      int calls = 0;
      api.bootstrap = (String? etag) {
        calls++;
        return calls == 1
            ? const RemoteNotModified<BootstrapDataDto>()
            : bootstrapModified(bootstrapEnvelope());
      };
      expect(await h.bootstrap.refreshBootstrap(), isA<RefreshSuccess>());
      expect(calls, 2, reason: 'exactly one unconditional retry');
      expect(await h.bootstrap.isMaterialized(), isTrue);
    });
  });

  group('compact merge safety', () {
    test(
      'a compact driver summary does not erase a synced biography',
      () async {
        api.driver = (_) => modifiedFromFixture<DriverDetailDto>(
          'drivers/detail-full.json',
          (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
        );
        await h.drivers.refreshDriver(driverId: 'max-verstappen', season: 2026);
        final DriverDetailView before = (await h.drivers.readDriver(
          season: 2026,
          driverId: 'max-verstappen',
        ))!;
        expect(before.driver.biography, isNotNull);

        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        final DriverDetailView after = (await h.drivers.readDriver(
          season: 2026,
          driverId: 'max-verstappen',
        ))!;
        expect(after.driver.biography, before.driver.biography);
        expect(after.driver.dateOfBirth, before.driver.dateOfBirth);
        expect(after.driver.nationality, before.driver.nationality);
      },
    );

    test(
      'a compact constructor summary does not erase richer profile data',
      () async {
        api.constructor = (_) => modifiedFromFixture<ConstructorDetailDto>(
          'constructors/detail.json',
          (Object? d) =>
              ConstructorDetailDto.fromJson(d! as Map<String, dynamic>),
        );
        await h.constructors.refreshConstructor(
          constructorId: 'ferrari',
          season: 2026,
        );
        final TeamDetailView before = (await h.constructors.readConstructor(
          season: 2026,
          constructorId: 'ferrari',
        ))!;
        expect(before.constructor.nationality, isNotNull);
        expect(before.constructor.media, isNotEmpty);

        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        final TeamDetailView after = (await h.constructors.readConstructor(
          season: 2026,
          constructorId: 'ferrari',
        ))!;
        expect(after.constructor.nationality, before.constructor.nationality);
        expect(after.constructor.countryCode, before.constructor.countryCode);
        expect(
          after.constructor.media?.length,
          before.constructor.media?.length,
          reason: 'compact summaries never touch detail-owned media',
        );
      },
    );

    test('a compact circuit summary does not erase physical facts', () async {
      api.seasonCircuits = (_) => modifiedListFromFixture<CircuitDto>(
        'circuits/season-circuits.json',
        CircuitDto.fromJson,
      );
      await h.circuits.refreshSeasonCircuits(2026);
      final Circuit before = (await h.circuits.readCircuit(
        'spa-francorchamps',
      ))!.circuit;
      expect(before.lengthMeters, isNotNull);
      expect(before.lapRecord, isNotNull);

      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      final Circuit after = (await h.circuits.readCircuit(
        'spa-francorchamps',
      ))!.circuit;
      expect(after.lengthMeters, before.lengthMeters);
      expect(after.cornerCount, before.cornerCount);
      expect(after.firstGrandPrixYear, before.firstGrandPrixYear);
      expect(after.lapRecord?.time, before.lapRecord?.time);
      expect(after.latitude, before.latitude);
    });

    test(
      'bootstrap calendar summaries do not erase detail-synced sessions',
      () async {
        api.grandPrix = (_) => modifiedFromFixture<GrandPrixDto>(
          'grand-prix/sprint-weekend.json',
          (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
        );
        await h.grandPrix.refreshGrandPrix(season: 2026, round: 13);
        final GrandPrixDetailView before = (await h.grandPrix.readGrandPrix(
          season: 2026,
          round: 13,
        ))!;
        expect(before.grandPrix.sessions, isNotEmpty);

        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        final GrandPrixDetailView after = (await h.grandPrix.readGrandPrix(
          season: 2026,
          round: 13,
        ))!;
        expect(
          after.grandPrix.sessions.length,
          before.grandPrix.sessions.length,
        );
        expect(after.grandPrix.officialName, before.grandPrix.officialName);
      },
    );

    test('bootstrap does not erase stored race results', () async {
      api.grandPrix = (_) => modifiedFromFixture<GrandPrixDto>(
        'grand-prix/standard-weekend.json',
        (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
      );
      await h.grandPrix.refreshGrandPrix(season: 2026, round: 12);
      api.results = (_) => modifiedFromFixture<RaceResultDto>(
        'results/race-timing.json',
        (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
      );
      await h.results.refreshResults(season: 2026, round: 12);
      final List<RaceResult> before = await h.results.readResults(
        season: 2026,
        round: 12,
      );
      expect(before, isNotEmpty);

      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      final List<RaceResult> after = await h.results.readResults(
        season: 2026,
        round: 12,
      );
      expect(after.length, before.length);
    });

    test('unrelated seasons are untouched', () async {
      api.calendar = (_) =>
          modifiedListFromJson<GrandPrixSummaryDto>(<String, dynamic>{
            'data': calendarJson(2025),
            'meta': <String, dynamic>{
              'apiVersion': '1',
              'schemaVersion': 1,
              'season': 2025,
              'generatedAt': '2026-07-18T12:00:00Z',
              'sourceUpdatedAt': '2026-07-18T11:55:00Z',
              'requestId': 'req-test',
            },
          }, GrandPrixSummaryDto.fromJson);
      await h.calendar.refreshCalendar(2025);
      expect(await db.calendarDao.countEventsForSeason(2025), 5);

      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      expect(await db.calendarDao.countEventsForSeason(2025), 5);
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.calendar(2025),
        ))?.lastSuccessAt,
        isNotNull,
      );
    });

    test(
      'stable identities are not duplicated across repeated bootstraps',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();
        final int circuits = await db.calendarDao.countCircuits();

        api.bootstrap = (_) => bootstrapModified(
          bootstrapEnvelope(sourceUpdatedAt: '2026-07-19T11:55:00Z'),
          etag: 'W/"bootstrap-2"',
        );
        await h.bootstrap.refreshBootstrap();

        expect(await db.calendarDao.countCircuits(), circuits);
        expect(await db.competitorDao.countDriverSeasonEntries(2026), 8);
        expect(await db.calendarDao.countEventsForSeason(2026), 5);
      },
    );

    test(
      'a season entry lineup is derived, never stored from the summary',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();

        final List<SeasonConstructor> teams = await h.constructors
            .readSeasonConstructors(2026);
        expect(teams, isNotEmpty);
        final TeamDetailView team = (await h.constructors.readConstructor(
          season: 2026,
          constructorId: 'red-bull',
        ))!;
        expect(team.seasonEntry?.driverLineup, isNull);
        expect(team.lineup.map((d) => d.id), contains('max-verstappen'));
      },
    );
  });

  group('persistence', () {
    test('a bootstrap Home snapshot renders from the local cache', () async {
      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.bootstrap.refreshBootstrap();

      final HomeView? home = await db.verticalSliceDao.watchHome().first;
      expect(home, isNotNull);
      expect(home!.featured!.season, 2026);
    });

    test('a season with no featured event still materializes a Home '
        'representation', () async {
      api.bootstrap = (_) =>
          bootstrapModified(bootstrapEnvelope(home: emptyHomeJson()));

      final RefreshResult result = await h.bootstrap.refreshBootstrap();
      expect(result, isA<RefreshSuccess>());
      expect(await h.bootstrap.isMaterialized(), isTrue);
      expect(await db.calendarDao.countEventsForSeason(2026), 5);

      // The Home snapshot is written and records its season — that is what
      // makes it materialized. It is deliberately not inferred from the
      // presence of a featured event.
      expect(await db.verticalSliceDao.countHomeSnapshot(), 1);
      expect(await db.verticalSliceDao.homeSnapshotSeason(), 2026);
      expect(await h.home.materializedSeason(), 2026);

      // The local read model is a well-defined empty Home, not null.
      final HomeView? view = await db.verticalSliceDao.watchHome().first;
      expect(view, isNotNull);
      expect(view!.seasonYear, 2026);
      expect(view.featured, isNull);
      expect(view.hasFeaturedEvent, isFalse);
    });

    test(
      'a grand prix absent from the calendar is removed with its results',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.bootstrap.refreshBootstrap();
        expect(await db.calendarDao.countEventsForSeason(2026), 5);

        // The season calendar is authoritative: dropping an event necessarily
        // cascades the rows that belong to it.
        api.bootstrap = (_) => bootstrapModified(
          bootstrapEnvelope(
            sourceUpdatedAt: '2026-07-19T11:55:00Z',
            calendar: calendarJson(2026).take(4).toList(),
            home: emptyHomeJson(),
          ),
          etag: 'W/"bootstrap-3"',
        );
        await h.bootstrap.refreshBootstrap();

        expect(await db.calendarDao.countEventsForSeason(2026), 4);
      },
    );
  });
}
