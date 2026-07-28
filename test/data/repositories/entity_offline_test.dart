import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
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

/// Proves that the Explore collections and the entity details survive closing
/// and reopening a real on-disk database, that a reopened cache renders with
/// **no network at all**, and that the next conditional request uses each
/// resource's own persisted validator.
void main() {
  late Directory tempDir;
  late File dbFile;

  const int season = 2026;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('gridview_entity_reopen');
    dbFile = File('${tempDir.path}/gridview_v2.sqlite');
  });
  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  Map<String, dynamic> envelope(Object? data) => <String, dynamic>{
    'data': data,
    'meta': <String, dynamic>{
      'apiVersion': '1',
      'generatedAt': '2026-07-18T12:00:00Z',
      'sourceUpdatedAt': '2026-07-18T11:55:00Z',
      'requestId': 'r-1',
    },
  };

  RemoteResult<List<SeasonDriverSummaryDto>> driversCollection() =>
      modifiedListFromJson<SeasonDriverSummaryDto>(
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
        etag: 'W/"drivers-1"',
      );

  RemoteResult<List<SeasonConstructorSummaryDto>> teamsCollection() =>
      modifiedListFromJson<SeasonConstructorSummaryDto>(
        envelope(<Map<String, dynamic>>[
          <String, dynamic>{
            'constructorId': 'red-bull',
            'name': 'Red Bull',
            'fullName': 'Oracle Red Bull Racing',
            'powerUnit': 'Honda RBPT',
          },
        ]),
        SeasonConstructorSummaryDto.fromJson,
        etag: 'W/"teams-1"',
      );

  RemoteResult<List<CircuitDto>> circuitsCollection() =>
      modifiedListFromJson<CircuitDto>(
        envelope(<Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'spa-francorchamps',
            'name': 'Circuit de Spa-Francorchamps',
            'locality': 'Stavelot',
            'country': 'Belgium',
          },
        ]),
        CircuitDto.fromJson,
        etag: 'W/"circuits-1"',
      );

  RemoteResult<DriverDetailDto> driverDetail() =>
      modifiedFromJson<DriverDetailDto>(
        envelope(<String, dynamic>{
          'driver': <String, dynamic>{
            'id': 'max-verstappen',
            'fullName': 'Max Verstappen',
            'nationality': 'Dutch',
            'biography': 'A four-time Formula 1 World Champion.',
          },
        }),
        (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
        etag: 'W/"driver-detail-1"',
      );

  RemoteResult<ConstructorDetailDto> teamDetail() =>
      modifiedFromJson<ConstructorDetailDto>(
        envelope(<String, dynamic>{
          'constructor': <String, dynamic>{
            'id': 'red-bull',
            'name': 'Red Bull',
            'nationality': 'Austrian',
            'biography': 'The Milton Keynes squad.',
          },
        }),
        (Object? d) =>
            ConstructorDetailDto.fromJson(d! as Map<String, dynamic>),
        etag: 'W/"team-detail-1"',
      );

  RemoteResult<CircuitDetailDto> circuitDetail() =>
      modifiedFromJson<CircuitDetailDto>(
        envelope(<String, dynamic>{
          'circuit': <String, dynamic>{
            'id': 'spa-francorchamps',
            'name': 'Circuit de Spa-Francorchamps',
            'lengthMeters': 7004,
            'cornerCount': 19,
          },
        }),
        (Object? d) => CircuitDetailDto.fromJson(d! as Map<String, dynamic>),
        etag: 'W/"circuit-detail-1"',
      );

  /// Synchronises every Explore collection, every detail and the calendar (so a
  /// circuit has a related event) into [dbFile], then closes it.
  Future<void> seedFirstSession() async {
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    // Assigned as separate statements: in a cascade, an arrow body binds to the
    // cascade's return rather than to the field being set.
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.seasonDrivers = (_) => driversCollection();
    api.seasonConstructors = (_) => teamsCollection();
    api.seasonCircuits = (_) => circuitsCollection();
    api.driver = (_) => driverDetail();
    api.constructor = (_) => teamDetail();
    api.circuit = (_) => circuitDetail();
    api.calendar = (_) => modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal-1"',
    );
    final RepositoryHarness h = RepositoryHarness(db, api);

    expect(await h.calendar.refreshCalendar(season), isA<RefreshSuccess>());
    expect(await h.drivers.refreshSeasonDrivers(season), isA<RefreshSuccess>());
    expect(
      await h.constructors.refreshSeasonConstructors(season),
      isA<RefreshSuccess>(),
    );
    expect(
      await h.circuits.refreshSeasonCircuits(season),
      isA<RefreshSuccess>(),
    );
    expect(
      await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season),
      isA<RefreshSuccess>(),
    );
    expect(
      await h.constructors.refreshConstructor(
        constructorId: 'red-bull',
        season: season,
      ),
      isA<RefreshSuccess>(),
    );
    expect(
      await h.circuits.refreshCircuit(
        circuitId: 'spa-francorchamps',
        season: season,
      ),
      isA<RefreshSuccess>(),
    );
    await db.close();
  }

  test('all three collections and details survive a close/reopen', () async {
    await seedFirstSession();

    // --- Second session: a repository whose remote refuses every call. ---
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(db.close);
    final ScriptedGridViewApi offline = ScriptedGridViewApi();
    final RepositoryHarness h = RepositoryHarness(db, offline);

    final List<SeasonDriverCard> drivers = await h.drivers
        .readSeasonDriverCards(season);
    final List<SeasonTeamCard> teams = await h.constructors.readSeasonTeamCards(
      season,
    );
    final List<SeasonCircuitCard> circuits = await h.circuits
        .readSeasonCircuitCards(season);

    expect(drivers.single.name, 'Max Verstappen');
    expect(drivers.single.teamName, 'Oracle Red Bull Racing');
    expect(teams.single.displayName, 'Oracle Red Bull Racing');
    expect(teams.single.powerUnit, 'Honda RBPT');
    // The calendar's own host circuits are persisted too, so the collection
    // holds the whole season in calendar order.
    final SeasonCircuitCard spa = circuits.firstWhere(
      (SeasonCircuitCard c) => c.circuitId == 'spa-francorchamps',
    );
    expect(spa.name, 'Circuit de Spa-Francorchamps');
    expect(
      spa.relatedGrandPrix,
      isNotNull,
      reason: 'the related event is derived from the persisted calendar',
    );
    expect(
      circuits.map((SeasonCircuitCard c) => c.orderIndex).toList(),
      orderedEquals(
        circuits.map((SeasonCircuitCard c) => c.orderIndex).toList()..sort(),
      ),
      reason: 'the season calendar order survives the reopen',
    );

    // Details, including their detail-owned sections.
    final DriverProfile driver = (await h.drivers.readDriverProfile(
      season: season,
      driverId: 'max-verstappen',
    ))!;
    expect(driver.driver.biography, 'A four-time Formula 1 World Champion.');
    expect(driver.relevantParticipation?.constructorId, 'red-bull');

    final TeamProfile team = (await h.constructors.readTeamProfile(
      season: season,
      constructorId: 'red-bull',
    ))!;
    expect(team.constructor.biography, 'The Milton Keynes squad.');
    expect(team.lineup.single.name, 'Max Verstappen');

    final CircuitProfile circuit = (await h.circuits.readCircuitProfile(
      season: season,
      circuitId: 'spa-francorchamps',
    ))!;
    expect(circuit.circuit.lengthMeters, 7004);
    expect(circuit.relatedGrandPrix!.season, season);

    // Nothing was fetched to render any of it.
    expect(offline.calls, isEmpty);
  });

  test('each resource keeps its own ETag across a reopen', () async {
    await seedFirstSession();

    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    final RepositoryHarness h = RepositoryHarness(db, api);

    expect(
      (await db.syncMetadataDao.read(ResourceKey.drivers(season)))?.etag,
      'W/"drivers-1"',
    );
    expect(
      (await db.syncMetadataDao.read(ResourceKey.constructors(season)))?.etag,
      'W/"teams-1"',
    );
    expect(
      (await db.syncMetadataDao.read(ResourceKey.circuits(season)))?.etag,
      'W/"circuits-1"',
    );
    expect(
      (await db.syncMetadataDao.read(
        ResourceKey.driver('max-verstappen', season),
      ))?.etag,
      'W/"driver-detail-1"',
    );

    // The next conditional request sends exactly that resource's own validator.
    api.driver = (_) => const RemoteNotModified<DriverDetailDto>();
    api.seasonDrivers = (_) =>
        const RemoteNotModified<List<SeasonDriverSummaryDto>>();
    await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season);
    await h.drivers.refreshSeasonDrivers(season);

    expect(api.lastEtag['driver'], 'W/"driver-detail-1"');
    expect(api.lastEtag['seasonDrivers'], 'W/"drivers-1"');
  });

  test('a bootstrap-only empty collection survives a reopen', () async {
    // A first session where only bootstrap succeeded, and it carried no drivers.
    final GridViewDatabase db1 = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    await db1.syncMetadataDao.upsert(
      ResourceSyncState(
        resourceKey: ResourceKey.bootstrap(),
        season: season,
        lastSuccessAt: DateTime.utc(2026, 7, 18, 11, 55),
        etag: 'W/"bootstrap-1"',
      ),
    );
    await db1.close();

    final GridViewDatabase db2 = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(db2.close);

    final ResourceSyncState? bootstrap = await db2.syncMetadataDao.read(
      ResourceKey.bootstrap(),
    );
    expect(bootstrap?.season, season);
    expect(bootstrap?.lastSuccessAt, isNotNull);
    // The individual collections earned nothing of their own and remain due.
    for (final String key in <String>[
      ResourceKey.drivers(season),
      ResourceKey.constructors(season),
      ResourceKey.circuits(season),
    ]) {
      expect(await db2.syncMetadataDao.read(key), isNull);
    }
  });

  test('a failed detail refresh preserves the persisted content', () async {
    await seedFirstSession();

    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(db.close);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    api.driver = (_) => const RemoteFailure<DriverDetailDto>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    final RepositoryHarness h = RepositoryHarness(db, api);

    expect(
      await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season),
      isA<RefreshFailure>(),
    );
    final DriverProfile driver = (await h.drivers.readDriverProfile(
      season: season,
      driverId: 'max-verstappen',
    ))!;
    expect(driver.driver.biography, 'A four-time Formula 1 World Champion.');
  });

  test('another season stays isolated across a reopen', () async {
    await seedFirstSession();

    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(db.close);
    final RepositoryHarness h = RepositoryHarness(db, ScriptedGridViewApi());

    expect(await h.drivers.readSeasonDriverCards(2025), isEmpty);
    expect(await h.constructors.readSeasonTeamCards(2025), isEmpty);
    expect(await h.circuits.readSeasonCircuitCards(2025), isEmpty);
    // The stable circuit identity is shared across seasons, but the 2025 detail
    // simply has no related event.
    final CircuitProfile? circuit2025 = await h.circuits.readCircuitProfile(
      season: 2025,
      circuitId: 'spa-francorchamps',
    );
    expect(circuit2025, isNotNull);
    expect(circuit2025!.relatedGrandPrix, isNull);
    // ...while 2026 still has its own.
    expect(
      (await h.circuits.readCircuitProfile(
        season: season,
        circuitId: 'spa-francorchamps',
      ))!.relatedGrandPrix,
      isNotNull,
    );
  });

  test(
    'an unresolved stub stays hidden, then resolves, across a reopen',
    () async {
      final GridViewDatabase db1 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      await db1.competitorDao.ensureDriverIdentity('late-driver');
      await db1.close();

      final GridViewDatabase db2 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      expect(await db2.competitorDao.hasResolvedDriver('late-driver'), isFalse);
      expect(
        await db2.competitorDao.driverProfile(season, 'late-driver'),
        isNull,
        reason: 'a stub never materializes a detail, even after a reopen',
      );

      // A later authoritative sync resolves the same row.
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      api.driver = (_) => modifiedFromJson<DriverDetailDto>(
        envelope(<String, dynamic>{
          'driver': <String, dynamic>{
            'id': 'late-driver',
            'fullName': 'Late Driver',
          },
        }),
        (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
        etag: 'W/"late-1"',
      );
      final RepositoryHarness h = RepositoryHarness(db2, api);
      await h.drivers.refreshDriver(driverId: 'late-driver', season: season);
      await db2.close();

      final GridViewDatabase db3 = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      addTearDown(db3.close);
      expect(await db3.competitorDao.hasResolvedDriver('late-driver'), isTrue);
      expect(
        (await db3.competitorDao.driverProfile(
          season,
          'late-driver',
        ))?.driver.fullName,
        'Late Driver',
      );
    },
  );
}
