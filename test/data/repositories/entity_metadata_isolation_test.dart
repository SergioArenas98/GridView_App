import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// Collection and detail resources are **independent** representations.
///
/// Each owns its own canonical key, its own ETag and its own success record. A
/// collection never validates a detail and a detail never validates a
/// collection, so the first detail request after a collection sync carries no
/// fabricated validator and a later `304` uses only the detail's own ETag.
void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  const int season = 2026;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api, now: DateTime.utc(2026, 7, 20));
  });
  tearDown(() => db.close());

  /// A response envelope with the shared provenance these tests rely on.
  Map<String, dynamic> envelope(
    Object? data, {
    String source = '2026-07-18T11:55:00Z',
  }) => <String, dynamic>{
    'data': data,
    'meta': <String, dynamic>{
      'apiVersion': '1',
      'generatedAt': '2026-07-18T12:00:00Z',
      'sourceUpdatedAt': source,
      'requestId': 'r-1',
    },
  };

  RemoteResult<List<SeasonDriverSummaryDto>> driversCollection({
    String etag = 'W/"drivers-1"',
  }) => modifiedListFromJson<SeasonDriverSummaryDto>(
    envelope(<Map<String, dynamic>>[
      <String, dynamic>{
        'driverId': 'max-verstappen',
        'fullName': 'Max Verstappen',
        'shortCode': 'VER',
        'raceNumber': 1,
        'constructorId': 'red-bull',
      },
    ]),
    SeasonDriverSummaryDto.fromJson,
    etag: etag,
  );

  RemoteResult<DriverDetailDto> driverDetail({
    String etag = 'W/"driver-detail-1"',
    String biography = 'A four-time Formula 1 World Champion.',
    String source = '2026-07-18T11:55:00Z',
    String id = 'max-verstappen',
    String fullName = 'Max Verstappen',
  }) => modifiedFromJson<DriverDetailDto>(
    envelope(<String, dynamic>{
      'driver': <String, dynamic>{
        'id': id,
        'fullName': fullName,
        'shortCode': 'VER',
        'permanentNumber': 33,
        'nationality': 'Dutch',
        'dateOfBirth': '1997-09-30',
        'biography': biography,
      },
    }, source: source),
    (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
    etag: etag,
  );

  RemoteResult<List<CircuitDto>> circuitsCollection({
    String etag = 'W/"circuits-1"',
  }) => modifiedListFromJson<CircuitDto>(
    envelope(<Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'monza',
        'name': 'Autodromo Nazionale Monza',
        'locality': 'Monza',
        'country': 'Italy',
      },
    ]),
    CircuitDto.fromJson,
    etag: etag,
  );

  RemoteResult<CircuitDetailDto> circuitDetail({
    String etag = 'W/"circuit-detail-1"',
    String id = 'monza',
    String name = 'Autodromo Nazionale Monza',
  }) => modifiedFromJson<CircuitDetailDto>(
    envelope(<String, dynamic>{
      'circuit': <String, dynamic>{
        'id': id,
        'name': name,
        'lengthMeters': 5793,
        'cornerCount': 11,
      },
    }),
    (Object? d) => CircuitDetailDto.fromJson(d! as Map<String, dynamic>),
    etag: etag,
  );

  RemoteResult<List<SeasonConstructorSummaryDto>> teamsCollection({
    String etag = 'W/"teams-1"',
  }) => modifiedListFromJson<SeasonConstructorSummaryDto>(
    envelope(<Map<String, dynamic>>[
      <String, dynamic>{
        'constructorId': 'red-bull',
        'name': 'Red Bull',
        'fullName': 'Oracle Red Bull Racing',
      },
    ]),
    SeasonConstructorSummaryDto.fromJson,
    etag: etag,
  );

  RemoteResult<ConstructorDetailDto> teamDetail({
    String etag = 'W/"team-detail-1"',
    String id = 'red-bull',
    String name = 'Red Bull',
  }) => modifiedFromJson<ConstructorDetailDto>(
    envelope(<String, dynamic>{
      'constructor': <String, dynamic>{
        'id': id,
        'name': name,
        'nationality': 'Austrian',
        'biography': 'The Milton Keynes squad.',
      },
    }),
    (Object? d) => ConstructorDetailDto.fromJson(d! as Map<String, dynamic>),
    etag: etag,
  );

  group('drivers', () {
    test('a collection 200 creates only its own metadata', () async {
      api.seasonDrivers = (_) => driversCollection();
      expect(
        await h.drivers.refreshSeasonDrivers(season),
        isA<RefreshSuccess>(),
      );

      final ResourceSyncState? collection = await db.syncMetadataDao.read(
        ResourceKey.drivers(season),
      );
      expect(collection?.etag, 'W/"drivers-1"');
      expect(collection?.lastSuccessAt, isNotNull);
      // The detail resource earned nothing.
      expect(
        await db.syncMetadataDao.read(
          ResourceKey.driver('max-verstappen', season),
        ),
        isNull,
      );
    });

    test(
      'the first detail request after a collection sends no validator',
      () async {
        api.seasonDrivers = (_) => driversCollection();
        await h.drivers.refreshSeasonDrivers(season);

        api.driver = (_) => driverDetail();
        await h.drivers.refreshDriver(
          driverId: 'max-verstappen',
          season: season,
        );

        expect(
          api.lastEtag['driver'],
          isNull,
          reason: 'the collection ETag is never reused for a detail',
        );
      },
    );

    test('a later detail 304 uses only its own persisted ETag', () async {
      api.driver = (_) => driverDetail();
      await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season);

      api.seasonDrivers = (_) => driversCollection();
      await h.drivers.refreshSeasonDrivers(season);

      api.driver = (String? etag) => etag == 'W/"driver-detail-1"'
          ? const RemoteNotModified<DriverDetailDto>()
          : driverDetail();
      final RefreshResult result = await h.drivers.refreshDriver(
        driverId: 'max-verstappen',
        season: season,
      );

      expect(api.lastEtag['driver'], 'W/"driver-detail-1"');
      expect(
        (result as RefreshSuccess).application,
        RefreshApplication.notModified,
      );
      // The collection kept its own, different validator.
      expect(
        (await db.syncMetadataDao.read(ResourceKey.drivers(season)))?.etag,
        'W/"drivers-1"',
      );
    });

    test('a collection sync does not materialize a detail', () async {
      api.seasonDrivers = (_) => driversCollection();
      await h.drivers.refreshSeasonDrivers(season);

      // Real summary content exists...
      final List<SeasonDriverCard> cards = await h.drivers
          .readSeasonDriverCards(season);
      expect(cards.single.name, 'Max Verstappen');
      final DriverProfile? profile = await h.drivers.readDriverProfile(
        season: season,
        driverId: 'max-verstappen',
      );
      expect(profile, isNotNull);
      // ...but the detail resource has no record of its own.
      expect(
        await db.syncMetadataDao.read(
          ResourceKey.driver('max-verstappen', season),
        ),
        isNull,
        reason: 'a partial profile never claims detail materialization',
      );
      expect(profile!.driver.biography, isNull);
    });

    test(
      'an unresolved stub is not a valid representation for 304 recovery',
      () async {
        // A standings sync creates a referential stub for a driver that has never
        // been synchronised as an identity.
        await db.competitorDao.ensureDriverIdentity('ghost-driver');
        expect(await db.competitorDao.countDriver('ghost-driver'), 1);
        expect(
          await db.competitorDao.hasResolvedDriver('ghost-driver'),
          isFalse,
        );

        // A 304 arrives with a stored ETag but no real local detail: the pipeline
        // must retry unconditionally exactly once rather than accept the stub.
        await db.syncMetadataDao.upsert(
          ResourceSyncState(
            resourceKey: ResourceKey.driver('ghost-driver', season),
            season: season,
            entityId: 'ghost-driver',
            etag: 'W/"stale"',
          ),
        );
        final List<String?> sentEtags = <String?>[];
        api.driver = (String? etag) {
          sentEtags.add(etag);
          if (etag != null) {
            return const RemoteNotModified<DriverDetailDto>();
          }
          return driverDetail(
            id: 'ghost-driver',
            fullName: 'Ghost Driver',
            etag: 'W/"resolved"',
          );
        };

        final RefreshResult result = await h.drivers.refreshDriver(
          driverId: 'ghost-driver',
          season: season,
        );

        expect(sentEtags, <String?>['W/"stale"', null]);
        expect(result, isA<RefreshSuccess>());
        expect(
          await db.competitorDao.hasResolvedDriver('ghost-driver'),
          isTrue,
        );
      },
    );
  });

  group('teams', () {
    test('collection and detail keep separate validators', () async {
      api.seasonConstructors = (_) => teamsCollection();
      await h.constructors.refreshSeasonConstructors(season);
      api.constructor = (_) => teamDetail();
      await h.constructors.refreshConstructor(
        constructorId: 'red-bull',
        season: season,
      );

      expect(api.lastEtag['constructor'], isNull);
      expect(
        (await db.syncMetadataDao.read(ResourceKey.constructors(season)))?.etag,
        'W/"teams-1"',
      );
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.constructor('red-bull', season),
        ))?.etag,
        'W/"team-detail-1"',
      );
    });

    test(
      'an unresolved stub does not suppress the 304 recovery retry',
      () async {
        await db.competitorDao.ensureConstructorIdentity('ghost-team');
        await db.syncMetadataDao.upsert(
          ResourceSyncState(
            resourceKey: ResourceKey.constructor('ghost-team', season),
            season: season,
            entityId: 'ghost-team',
            etag: 'W/"stale"',
          ),
        );
        final List<String?> sentEtags = <String?>[];
        api.constructor = (String? etag) {
          sentEtags.add(etag);
          if (etag != null) {
            return const RemoteNotModified<ConstructorDetailDto>();
          }
          return teamDetail(
            id: 'ghost-team',
            name: 'Ghost Team',
            etag: 'W/"resolved"',
          );
        };

        await h.constructors.refreshConstructor(
          constructorId: 'ghost-team',
          season: season,
        );
        expect(sentEtags, <String?>['W/"stale"', null]);
        expect(
          await db.competitorDao.hasResolvedConstructor('ghost-team'),
          isTrue,
        );
      },
    );
  });

  group('circuits', () {
    test('collection and detail keep separate validators', () async {
      api.seasonCircuits = (_) => circuitsCollection();
      await h.circuits.refreshSeasonCircuits(season);
      api.circuit = (_) => circuitDetail();
      await h.circuits.refreshCircuit(circuitId: 'monza', season: season);

      expect(
        api.lastEtag['circuit'],
        isNull,
        reason: 'the collection ETag is never reused for a detail',
      );
      expect(
        (await db.syncMetadataDao.read(ResourceKey.circuits(season)))?.etag,
        'W/"circuits-1"',
      );
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.circuit('monza', season),
        ))?.etag,
        'W/"circuit-detail-1"',
      );
    });

    test('a later circuit detail 304 uses its own ETag', () async {
      api.circuit = (_) => circuitDetail();
      await h.circuits.refreshCircuit(circuitId: 'monza', season: season);
      api.circuit = (String? etag) => etag == 'W/"circuit-detail-1"'
          ? const RemoteNotModified<CircuitDetailDto>()
          : circuitDetail();

      final RefreshResult result = await h.circuits.refreshCircuit(
        circuitId: 'monza',
        season: season,
      );
      expect(api.lastEtag['circuit'], 'W/"circuit-detail-1"');
      expect(
        (result as RefreshSuccess).application,
        RefreshApplication.notModified,
      );
    });

    test(
      'an unresolved stub does not suppress the 304 recovery retry',
      () async {
        await db.calendarDao.ensureCircuitIdentity('ghost-circuit');
        expect(await db.calendarDao.countCircuit('ghost-circuit'), 1);
        expect(
          await db.calendarDao.hasResolvedCircuit('ghost-circuit'),
          isFalse,
        );

        await db.syncMetadataDao.upsert(
          ResourceSyncState(
            resourceKey: ResourceKey.circuit('ghost-circuit', season),
            season: season,
            entityId: 'ghost-circuit',
            etag: 'W/"stale"',
          ),
        );
        final List<String?> sentEtags = <String?>[];
        api.circuit = (String? etag) {
          sentEtags.add(etag);
          if (etag != null) {
            return const RemoteNotModified<CircuitDetailDto>();
          }
          return circuitDetail(
            id: 'ghost-circuit',
            name: 'Ghost Circuit',
            etag: 'W/"resolved"',
          );
        };

        await h.circuits.refreshCircuit(
          circuitId: 'ghost-circuit',
          season: season,
        );
        expect(sentEtags, <String?>['W/"stale"', null]);
        expect(
          await db.calendarDao.hasResolvedCircuit('ghost-circuit'),
          isTrue,
        );
      },
    );
  });

  group('cross-resource independence', () {
    test('one collection failing leaves the other two untouched', () async {
      api.seasonDrivers = (_) => driversCollection();
      api.seasonConstructors = (_) =>
          const RemoteFailure<List<SeasonConstructorSummaryDto>>(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          );
      api.seasonCircuits = (_) => circuitsCollection();

      await h.drivers.refreshSeasonDrivers(season);
      final RefreshResult teams = await h.constructors
          .refreshSeasonConstructors(season);
      await h.circuits.refreshSeasonCircuits(season);

      expect(teams, isA<RefreshFailure>());
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.drivers(season),
        ))?.lastSuccessAt,
        isNotNull,
      );
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.circuits(season),
        ))?.lastSuccessAt,
        isNotNull,
      );
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.constructors(season),
        ))?.lastSuccessAt,
        isNull,
      );
    });

    test('an older detail snapshot preserves newer local content', () async {
      api.driver = (_) => driverDetail(biography: 'Newer biography.');
      await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season);

      // An older source revision arrives.
      api.driver = (_) => driverDetail(
        biography: 'Older biography.',
        source: '2026-07-01T00:00:00Z',
        etag: 'W/"older"',
      );
      final RefreshResult result = await h.drivers.refreshDriver(
        driverId: 'max-verstappen',
        season: season,
      );

      expect(
        (result as RefreshSuccess).application,
        RefreshApplication.rejectedOlder,
      );
      final DriverProfile profile = (await h.drivers.readDriverProfile(
        season: season,
        driverId: 'max-verstappen',
      ))!;
      expect(profile.driver.biography, 'Newer biography.');
    });
  });
}
