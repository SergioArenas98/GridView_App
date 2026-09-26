import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/mappers/summary_mapper.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/fixtures.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// ADR 0026 D12 items 1 and 2 on the client: every span of the season Drivers
/// collection persists under its own published `entryId`, and every singular
/// read picks the current span, never whichever row comes back first.
///
/// `drivers/season-drivers-split.json` is the generator's own output for a
/// synthetic split (Lawson at racing-bulls to round 11 and at red-bull from
/// round 12, Tsunoda at racing-bulls from round 12, Hadjar ending at round 11).
void main() {
  const int season = 2026;
  const String split = 'drivers/season-drivers-split.json';

  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api);
  });
  tearDown(() => db.close());

  List<Map<String, dynamic>> splitRows() => (loadFixture(split)['data'] as List)
      .cast<Map<String, dynamic>>()
      .map(Map<String, dynamic>.from)
      .toList();

  RemoteResult<List<SeasonDriverSummaryDto>> collection(
    List<Map<String, dynamic>> rows, {
    String etag = 'W/"split-1"',
    String sourceUpdatedAt = '2026-07-18T11:55:00Z',
  }) {
    final Map<String, dynamic> envelope = loadFixture(split);
    envelope['data'] = rows;
    (envelope['meta'] as Map<String, dynamic>)['sourceUpdatedAt'] =
        sourceUpdatedAt;
    return modifiedListFromJson<SeasonDriverSummaryDto>(
      envelope,
      SeasonDriverSummaryDto.fromJson,
      etag: etag,
    );
  }

  Future<void> refreshWith(
    List<Map<String, dynamic>> rows, {
    String etag = 'W/"split-1"',
    String sourceUpdatedAt = '2026-07-18T11:55:00Z',
  }) async {
    api.seasonDrivers = (_) =>
        collection(rows, etag: etag, sourceUpdatedAt: sourceUpdatedAt);
    expect(await h.drivers.refreshSeasonDrivers(season), isA<RefreshSuccess>());
  }

  Future<List<DriverSeasonEntry>> storedEntries() async {
    final List<DriverSeasonEntry> entries =
        (await db.competitorDao.driversForSeason(
          season,
        )).map((SeasonDriver s) => s.entry).toList()..sort(
          (DriverSeasonEntry a, DriverSeasonEntry b) => a.id.compareTo(b.id),
        );
    return entries;
  }

  String describe(DriverSeasonEntry e) =>
      '${e.id}|${e.driverId}|${e.constructorId}|${e.startRound}|${e.endRound}';

  const List<String> expectedEntries = <String>[
    '2026-isack-hadjar|isack-hadjar|red-bull|null|11',
    '2026-liam-lawson|liam-lawson|racing-bulls|null|11',
    '2026-liam-lawson-12|liam-lawson|red-bull|12|null',
    '2026-max-verstappen|max-verstappen|red-bull|null|null',
    '2026-yuki-tsunoda-12|yuki-tsunoda|racing-bulls|12|null',
  ];

  group('transport', () {
    test('both spans decode with distinct entry ids and their own bounds', () {
      final List<SeasonDriverSummaryDto> dtos = splitRows()
          .map(SeasonDriverSummaryDto.fromJson)
          .toList();
      final List<SeasonDriverSummaryDto> lawson = dtos
          .where((SeasonDriverSummaryDto d) => d.driverId == 'liam-lawson')
          .toList();

      expect(dtos, hasLength(5));
      expect(lawson.map((SeasonDriverSummaryDto d) => d.entryId), <String>[
        '2026-liam-lawson',
        '2026-liam-lawson-12',
      ]);
      expect(lawson.first.endRound, 11);
      expect(lawson.last.startRound, 12);
    });

    test('the mapper takes the published entry id, never a rebuilt one', () {
      final SeasonDriverSummaryDto dto = SeasonDriverSummaryDto.fromJson(
        splitRows()[3],
      );
      // Another season argument proves the id is not derived from it.
      final DriverSeasonEntry entry = driverSeasonEntryFromSeasonSummary(
        dto,
        2025,
      );

      expect(entry.id, '2026-liam-lawson-12');
      expect(entry.season, 2025);
      expect(entry.startRound, 12);
      expect(entry.endRound, isNull);
      expect(entry.constructorId, 'red-bull');
    });

    test('a summary without an entry id is refused, not repaired', () {
      final Map<String, dynamic> row = splitRows().first..remove('entryId');

      expect(() => SeasonDriverSummaryDto.fromJson(row), throwsA(anything));
    });
  });

  group('persistence', () {
    test('every span persists under its own entry id', () async {
      await refreshWith(splitRows());

      expect(await db.competitorDao.countDriverSeasonEntries(season), 5);
      expect((await storedEntries()).map(describe), expectedEntries);
    });

    test('a second refresh is idempotent and keeps both spans', () async {
      await refreshWith(splitRows());
      await refreshWith(
        splitRows(),
        etag: 'W/"split-2"',
        sourceUpdatedAt: '2026-07-18T11:56:00Z',
      );

      expect(await db.competitorDao.countDriverSeasonEntries(season), 5);
      expect((await storedEntries()).map(describe), expectedEntries);
    });

    test('a refresh replaces the season set without leftovers', () async {
      await refreshWith(splitRows());
      await refreshWith(
        splitRows()
            .where((Map<String, dynamic> r) => r['driverId'] != 'isack-hadjar')
            .toList(),
        etag: 'W/"split-2"',
        sourceUpdatedAt: '2026-07-18T11:56:00Z',
      );

      expect(
        (await storedEntries()).map((DriverSeasonEntry e) => e.id),
        isNot(contains('2026-isack-hadjar')),
      );
      expect(await db.competitorDao.countDriverSeasonEntries(season), 4);
    });

    test('source order does not change what is stored', () async {
      await refreshWith(splitRows().reversed.toList());

      expect((await storedEntries()).map(describe), expectedEntries);
    });

    test('the identity upsert keeps detail-owned fields', () async {
      api.driver = (_) => modifiedFromFixture<DriverDetailDto>(
        'drivers/detail-full.json',
        (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
      );
      await h.drivers.refreshDriver(driverId: 'max-verstappen', season: season);
      await refreshWith(splitRows());

      final DriverProfile profile = (await db.competitorDao.driverProfile(
        season,
        'max-verstappen',
      ))!;
      expect(profile.driver.biography, isNotNull);
    });
  });

  group('reads', () {
    test('the roster shows one card per driver, on the current span', () async {
      await refreshWith(splitRows());

      final List<SeasonDriverCard> cards = await db.competitorDao
          .seasonDriverCards(season);
      final SeasonDriverCard lawson = cards.singleWhere(
        (SeasonDriverCard c) => c.driverId == 'liam-lawson',
      );
      final SeasonDriverCard hadjar = cards.singleWhere(
        (SeasonDriverCard c) => c.driverId == 'isack-hadjar',
      );

      expect(cards, hasLength(4));
      expect(lawson.constructorId, 'red-bull');
      expect(lawson.spanCount, 2);
      expect(lawson.hasMultipleSpans, isTrue);
      expect(hadjar.constructorId, 'red-bull');
      expect(hadjar.spanCount, 1);
      // Grouping happens after persistence: both spans are still stored.
      expect(await db.competitorDao.countDriverSeasonEntries(season), 5);
    });

    test('driver detail selects the open second span', () async {
      await refreshWith(splitRows().reversed.toList());

      final DriverDetailView detail = (await h.drivers.readDriver(
        season: season,
        driverId: 'liam-lawson',
      ))!;
      final DriverProfile profile = (await db.competitorDao.driverProfile(
        season,
        'liam-lawson',
      ))!;

      expect(detail.seasonEntry?.id, '2026-liam-lawson-12');
      expect(detail.seasonEntry?.constructorId, 'red-bull');
      expect(profile.relevantParticipation?.entry.id, '2026-liam-lawson-12');
      // The historical span stays stored and queryable.
      expect(
        profile.participations.map((DriverParticipation p) => p.entry.id),
        <String>['2026-liam-lawson-12', '2026-liam-lawson'],
      );
    });

    test('with every span closed, the latest start is current', () async {
      await refreshWith(<Map<String, dynamic>>[
        for (final Map<String, dynamic> r in splitRows())
          if (r['entryId'] == '2026-liam-lawson-12')
            (Map<String, dynamic>.from(r)..['endRound'] = 13)
          else
            r,
      ]);

      final DriverDetailView detail = (await h.drivers.readDriver(
        season: season,
        driverId: 'liam-lawson',
      ))!;
      final SeasonDriverCard card = (await db.competitorDao.seasonDriverCards(
        season,
      )).singleWhere((SeasonDriverCard c) => c.driverId == 'liam-lawson');

      expect(detail.seasonEntry?.id, '2026-liam-lawson-12');
      expect(card.constructorId, 'red-bull');
    });

    test('each team line-up lists its own spans, keyed by entry', () async {
      await refreshWith(splitRows());
      await db.competitorDao.upsertConstructorIdentities(<Constructor>[
        const Constructor(id: 'red-bull', name: 'Red Bull'),
        const Constructor(id: 'racing-bulls', name: 'Racing Bulls'),
      ]);
      await db.competitorDao
          .replaceConstructorSeasonEntries(season, <ConstructorSeasonEntry>[
            const ConstructorSeasonEntry(
              id: '2026-red-bull',
              season: season,
              constructorId: 'red-bull',
            ),
            const ConstructorSeasonEntry(
              id: '2026-racing-bulls',
              season: season,
              constructorId: 'racing-bulls',
            ),
          ]);

      final List<SeasonTeamCard> teams = await db.competitorDao.seasonTeamCards(
        season,
      );
      Set<String> lineup(String id) => teams
          .singleWhere((SeasonTeamCard t) => t.constructorId == id)
          .lineup
          .map((TeamLineupMember m) => m.entryId)
          .toSet();

      expect(lineup('red-bull'), <String>{
        '2026-max-verstappen',
        '2026-isack-hadjar',
        '2026-liam-lawson-12',
      });
      expect(lineup('racing-bulls'), <String>{
        '2026-liam-lawson',
        '2026-yuki-tsunoda-12',
      });
    });
  });
}
