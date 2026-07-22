import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

void main() {
  late GridViewDatabase db;
  late CompetitorDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.competitorDao;
  });
  tearDown(() => db.close());

  MediaAsset portrait(String id, String owner) => MediaAsset(
    id: id,
    entityType: MediaEntityType.driver,
    entityId: owner,
    category: MediaCategory.portrait,
    format: MediaFormat.webp,
    variants: const MediaVariants(
      thumbnail: MediaVariant(url: 'https://cdn/thumb.webp'),
    ),
    version: 'v1',
  );

  test(
    'driver detail composes identity+media, current entry and standing',
    () async {
      await dao.upsertDrivers(<Driver>[
        Driver(
          id: 'max-verstappen',
          fullName: 'Max Verstappen',
          permanentNumber: 1,
          media: <MediaAsset>[portrait('max-portrait-v1', 'max-verstappen')],
        ),
      ]);
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-max-verstappen',
          season: 2026,
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
          role: DriverRole.race,
        ),
      ]);
      await db.standingsDao.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          position: 1,
          points: 310,
        ),
      ]);

      final DriverDetailView? detail = await dao.driverDetail(
        2026,
        'max-verstappen',
      );
      expect(detail, isNotNull);
      expect(detail!.driver.fullName, 'Max Verstappen');
      expect(detail.driver.media, hasLength(1));
      expect(detail.seasonEntry?.constructorId, 'red-bull');
      expect(detail.seasonEntry?.role, DriverRole.race);
      expect(detail.standing?.points, 310);
    },
  );

  test(
    'drivers-by-season roster orders by race number (unnumbered last)',
    () async {
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-b',
          season: 2026,
          driverId: 'b',
          constructorId: 't',
          raceNumber: 44,
        ),
        const DriverSeasonEntry(
          id: '2026-a',
          season: 2026,
          driverId: 'a',
          constructorId: 't',
          raceNumber: 1,
        ),
        const DriverSeasonEntry(
          id: '2026-c',
          season: 2026,
          driverId: 'c',
          constructorId: 't',
        ),
      ]);

      final List<SeasonDriver> roster = await dao.driversForSeason(2026);
      expect(roster.map((SeasonDriver s) => s.driver.id), <String>[
        'a',
        'b',
        'c',
      ]);
    },
  );

  test(
    'team detail derives the ordered line-up from driver season entries',
    () async {
      await dao.upsertConstructors(<Constructor>[
        const Constructor(id: 'red-bull', name: 'Red Bull'),
      ]);
      await dao.upsertDrivers(<Driver>[
        const Driver(id: 'yuki-tsunoda', fullName: 'Yuki Tsunoda'),
        const Driver(id: 'max-verstappen', fullName: 'Max Verstappen'),
      ]);
      // Membership is the single source of truth: the drivers whose season entry
      // points at red-bull. The other-team driver must be excluded.
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-yuki-tsunoda',
          season: 2026,
          driverId: 'yuki-tsunoda',
          constructorId: 'red-bull',
          raceNumber: 22,
        ),
        const DriverSeasonEntry(
          id: '2026-max-verstappen',
          season: 2026,
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
        const DriverSeasonEntry(
          id: '2026-other',
          season: 2026,
          driverId: 'other',
          constructorId: 'other-team',
          raceNumber: 5,
        ),
      ]);
      // A provided driverLineup is intentionally ignored (derived from entries).
      await dao.replaceConstructorSeasonEntries(2026, <ConstructorSeasonEntry>[
        const ConstructorSeasonEntry(
          id: '2026-red-bull',
          season: 2026,
          constructorId: 'red-bull',
          fullName: 'Oracle Red Bull Racing',
          driverLineup: <String>['this-is-ignored'],
        ),
      ]);

      final TeamDetailView? detail = await dao.teamDetail(2026, 'red-bull');
      expect(detail, isNotNull);
      expect(detail!.seasonEntry?.fullName, 'Oracle Red Bull Racing');
      expect(detail.lineup.map((Driver d) => d.id), <String>[
        'max-verstappen',
        'yuki-tsunoda',
      ]);

      final List<SeasonConstructor> teams = await dao.constructorsForSeason(
        2026,
      );
      expect(teams, hasLength(1));
      expect(teams.single.constructor.name, 'Red Bull');
    },
  );

  test(
    'overlapping stints for the same driver are rejected transactionally',
    () async {
      // A valid single stint is cached first.
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-a-solo',
          season: 2026,
          driverId: 'a',
          constructorId: 't',
          raceNumber: 1,
        ),
      ]);

      // A batch where the same driver's two stints overlap (both cover round 5)
      // must be rejected, leaving the cached entry untouched.
      await expectLater(
        dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
          const DriverSeasonEntry(
            id: '2026-a-1',
            season: 2026,
            driverId: 'a',
            constructorId: 'team-a',
            endRound: 6,
          ),
          const DriverSeasonEntry(
            id: '2026-a-2',
            season: 2026,
            driverId: 'a',
            constructorId: 'team-b',
            startRound: 5,
          ),
        ]),
        throwsA(isA<InvalidSeasonEntriesException>()),
      );

      final List<SeasonDriver> roster = await dao.driversForSeason(2026);
      expect(roster, hasLength(1));
      expect(roster.single.entry.id, '2026-a-solo');
    },
  );

  test('an inverted stint span (startRound > endRound) is rejected', () async {
    await expectLater(
      dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-bad',
          season: 2026,
          driverId: 'a',
          constructorId: 't',
          startRound: 10,
          endRound: 3,
        ),
      ]),
      throwsA(isA<InvalidSeasonEntriesException>()),
    );
    expect(await dao.driversForSeason(2026), isEmpty);
  });

  test(
    'non-overlapping consecutive stints for one driver are accepted',
    () async {
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-a-1',
          season: 2026,
          driverId: 'a',
          constructorId: 'team-a',
          endRound: 9,
        ),
        const DriverSeasonEntry(
          id: '2026-a-2',
          season: 2026,
          driverId: 'a',
          constructorId: 'team-b',
          startRound: 10,
        ),
      ]);
      expect(await dao.driversForSeason(2026), hasLength(2));
    },
  );

  test(
    'constructor rebrand keeps the stable id and varies the season entry',
    () async {
      await dao.upsertConstructors(<Constructor>[
        const Constructor(id: 'sauber', name: 'Sauber'),
      ]);
      await dao.replaceConstructorSeasonEntries(2025, <ConstructorSeasonEntry>[
        const ConstructorSeasonEntry(
          id: '2025-sauber',
          season: 2025,
          constructorId: 'sauber',
          fullName: 'Stake F1 Team',
        ),
      ]);
      await dao.replaceConstructorSeasonEntries(2026, <ConstructorSeasonEntry>[
        const ConstructorSeasonEntry(
          id: '2026-sauber',
          season: 2026,
          constructorId: 'sauber',
          fullName: 'Audi',
        ),
      ]);

      // Writing 2026 leaves the unrelated 2025 entry intact.
      final TeamDetailView? d2025 = await dao.teamDetail(2025, 'sauber');
      final TeamDetailView? d2026 = await dao.teamDetail(2026, 'sauber');
      expect(d2025!.constructor.id, 'sauber');
      expect(d2026!.constructor.id, 'sauber');
      expect(d2025.seasonEntry?.fullName, 'Stake F1 Team');
      expect(d2026.seasonEntry?.fullName, 'Audi');
    },
  );

  test('an unknown driver role is preserved as unknown', () async {
    await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
      const DriverSeasonEntry(
        id: '2026-x',
        season: 2026,
        driverId: 'x',
        constructorId: 't',
        role: DriverRole.unknown,
      ),
    ]);
    final DriverDetailView? detail = await dao.driverDetail(2026, 'x');
    expect(detail!.seasonEntry?.role, DriverRole.unknown);
  });

  test(
    'driver detail picks the open span for a mid-season team change',
    () async {
      await dao.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: '2026-x-team-a',
          season: 2026,
          driverId: 'x',
          constructorId: 'team-a',
          endRound: 9,
        ),
        const DriverSeasonEntry(
          id: '2026-x-team-b',
          season: 2026,
          driverId: 'x',
          constructorId: 'team-b',
          startRound: 10,
        ),
      ]);

      final DriverDetailView? detail = await dao.driverDetail(2026, 'x');
      expect(detail!.seasonEntry?.constructorId, 'team-b');
    },
  );
}
