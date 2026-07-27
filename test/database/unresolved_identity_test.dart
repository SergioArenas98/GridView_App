import 'dart:async';
import 'dart:io';

import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/competitor_tables.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart';
import 'package:gridview/core/database/daos/results_dao.dart';
import 'package:gridview/core/database/daos/standings_dao.dart';
import 'package:gridview/core/database/entity_validation.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/database/unresolved_identity.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';

/// Referential stubs: the `drivers` / `constructors` rows that exist only so a
/// foreign key holds while the authoritative identity has not synchronised.
///
/// The rule under test is that a stub is **persistence only**. It satisfies the
/// foreign key and nothing else: no read may turn it into a display name, a
/// collection member or a materialized detail, and no authoritative identity may
/// ever be downgraded into one.
void main() {
  late GridViewDatabase db;
  late StandingsDao standings;
  late CompetitorDao competitors;
  late ResultsDao results;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    standings = db.standingsDao;
    competitors = db.competitorDao;
    results = db.resultsDao;
  });
  tearDown(() => db.close());

  /// The value actually stored in the identity row, read raw — the only place a
  /// test is allowed to look at it.
  Future<String?> storedDriverName(String id) async {
    final DriverRow? row = await (db.select(
      db.drivers,
    )..where((Drivers d) => d.id.equals(id))).getSingleOrNull();
    return row?.fullName;
  }

  Future<String?> storedConstructorName(String id) async {
    final ConstructorRow? row = await (db.select(
      db.constructors,
    )..where((Constructors c) => c.id.equals(id))).getSingleOrNull();
    return row?.name;
  }

  group('driver standings before the driver identity', () {
    Future<void> persistStanding() =>
        standings.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'unsynced-driver',
            position: 4,
            points: 12.5,
            wins: 0,
          ),
        ]);

    test('the standing persists and keeps its stable identifier', () async {
      await persistStanding();
      final List<DriverStandingEntry> rows = await standings
          .driverStandingEntries(2026);
      expect(rows, hasLength(1));
      expect(rows.single.driverId, 'unsynced-driver');
      expect(rows.single.position, 4);
      expect(rows.single.points, 12.5);
      expect(rows.single.wins, 0);
    });

    test('the read model exposes no name at all', () async {
      await persistStanding();
      final DriverStandingEntry row = (await standings.driverStandingEntries(
        2026,
      )).single;

      expect(row.driverName, isNull);
      expect(row.driverShortCode, isNull);
      // Neither the raw identifier nor anything derived from it.
      expect(row.driverName, isNot('unsynced-driver'));
      expect(row.driverName, isNot('Unsynced Driver'));
    });

    test(
      'the stored stub is the marker, never a humanised identifier',
      () async {
        await persistStanding();
        final String? stored = await storedDriverName('unsynced-driver');
        expect(stored, isNotNull, reason: 'the FK parent must exist');
        expect(isUnresolvedIdentityName(stored), isTrue);
        expect(stored, isNot(contains('Unsynced')));
      },
    );

    test('repeated refreshes before identity sync stay idempotent', () async {
      await persistStanding();
      await persistStanding();
      await persistStanding();

      expect(await standings.driverStandingEntries(2026), hasLength(1));
      expect(await competitors.countDriver('unsynced-driver'), 1);
      expect(
        isUnresolvedIdentityName(await storedDriverName('unsynced-driver')),
        isTrue,
      );
    });
  });

  group('constructor standings before the constructor identity', () {
    Future<void> persistStanding() =>
        standings.replaceConstructorStandings(2026, <ConstructorStanding>[
          const ConstructorStanding(
            season: 2026,
            constructorId: 'unsynced-team',
            position: 2,
            points: 88,
          ),
        ]);

    test('the standing persists with no name of any kind', () async {
      await persistStanding();
      final ConstructorStandingEntry row =
          (await standings.constructorStandingEntries(2026)).single;

      expect(row.constructorId, 'unsynced-team');
      expect(row.position, 2);
      expect(row.points, 88);
      expect(row.seasonName, isNull);
      expect(row.stableName, isNull);
      expect(row.displayName, isNull);
      expect(row.teamColor, isNull);
    });

    test('the stored stub is the marker', () async {
      await persistStanding();
      expect(
        isUnresolvedIdentityName(await storedConstructorName('unsynced-team')),
        isTrue,
      );
    });
  });

  test(
    'a driver standing referencing a missing team invents nothing',
    () async {
      await competitors.upsertDrivers(<Driver>[
        const Driver(id: 'known-driver', fullName: 'Known Driver'),
      ]);
      await standings.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'known-driver',
          constructorId: 'unsynced-team',
          position: 1,
          points: 10,
        ),
      ]);

      final DriverStandingEntry row = (await standings.driverStandingEntries(
        2026,
      )).single;
      expect(row.driverName, 'Known Driver');
      // The team reference is preserved for identity, but nothing is displayed.
      expect(row.constructorId, 'unsynced-team');
      expect(row.constructorName, isNull);
      expect(row.teamColor, isNull);
    },
  );

  group('resolution by a later authoritative upsert', () {
    test(
      'a driver upsert resolves the stub and re-emits the real name',
      () async {
        await standings.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'oscar-piastri',
            constructorId: 'mclaren',
            position: 3,
            points: 192.5,
            wins: 2,
          ),
        ]);

        // The stream is observed *before* the identity arrives, so resolution
        // has to be an emission rather than something only a fresh read sees.
        final List<List<DriverStandingEntry>> seen =
            <List<DriverStandingEntry>>[];
        final StreamSubscription<List<DriverStandingEntry>> subscription =
            standings.watchDriverStandingEntries(2026).listen(seen.add);
        addTearDown(subscription.cancel);
        await _until(() => seen.isNotEmpty);
        expect(seen.single.single.driverName, isNull);

        await competitors.upsertDrivers(<Driver>[
          const Driver(
            id: 'oscar-piastri',
            fullName: 'Oscar Piastri',
            shortCode: 'PIA',
          ),
        ]);
        await _until(() => seen.length > 1);

        expect(seen.last.single.driverName, 'Oscar Piastri');
        expect(seen.last.single.driverShortCode, 'PIA');
        // The standing itself and its delivered order survived resolution.
        expect(seen.last.single.position, 3);
        expect(seen.last.single.points, 192.5);
        expect(seen.last.single.wins, 2);
        expect(seen.last.single.orderIndex, 0);
      },
    );

    test(
      'a constructor upsert resolves the stub and season branding applies',
      () async {
        await standings.replaceConstructorStandings(2026, <ConstructorStanding>[
          const ConstructorStanding(
            season: 2026,
            constructorId: 'mclaren',
            position: 1,
            points: 460.5,
            wins: 9,
          ),
        ]);
        expect(
          (await standings.constructorStandingEntries(2026)).single.displayName,
          isNull,
        );

        await competitors.upsertConstructors(<Constructor>[
          const Constructor(id: 'mclaren', name: 'McLaren'),
        ]);
        expect(
          (await standings.constructorStandingEntries(2026)).single.displayName,
          'McLaren',
        );

        // Season branding then takes precedence over the stable name.
        await competitors
            .replaceConstructorSeasonEntries(2026, <ConstructorSeasonEntry>[
              const ConstructorSeasonEntry(
                id: 'cse-mclaren-2026',
                season: 2026,
                constructorId: 'mclaren',
                fullName: 'McLaren Formula 1 Team',
                colorPrimary: '#FF8000',
              ),
            ]);
        final ConstructorStandingEntry resolved =
            (await standings.constructorStandingEntries(2026)).single;
        expect(resolved.displayName, 'McLaren Formula 1 Team');
        expect(resolved.stableName, 'McLaren');
        expect(resolved.teamColor, '#FF8000');
        // The standing survived both writes.
        expect(resolved.position, 1);
        expect(resolved.points, 460.5);
        expect(resolved.wins, 9);
      },
    );

    test(
      'a driver standing referencing a resolved team shows the team',
      () async {
        await standings.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            position: 2,
            points: 232.5,
          ),
        ]);
        await competitors.upsertConstructors(<Constructor>[
          const Constructor(
            id: 'mclaren',
            name: 'McLaren',
            colorPrimary: '#FF8000',
          ),
        ]);

        final DriverStandingEntry row = (await standings.driverStandingEntries(
          2026,
        )).single;
        expect(row.constructorName, 'McLaren');
        expect(row.teamColor, '#FF8000');
      },
    );
  });

  group('a real identity is never downgraded', () {
    test(
      'a standings write never overwrites a synchronised identity',
      () async {
        await competitors.upsertDrivers(<Driver>[
          const Driver(
            id: 'max-verstappen',
            fullName: 'Max Verstappen',
            shortCode: 'VER',
            permanentNumber: 1,
          ),
        ]);
        await competitors.upsertConstructors(<Constructor>[
          const Constructor(
            id: 'red-bull',
            name: 'Red Bull Racing',
            colorPrimary: '#1E41FF',
          ),
        ]);

        // Several standings refreshes, all of which "ensure" the same parents.
        for (int i = 0; i < 3; i++) {
          await standings.replaceDriverStandings(2026, <DriverStanding>[
            const DriverStanding(
              season: 2026,
              driverId: 'max-verstappen',
              constructorId: 'red-bull',
              position: 1,
              points: 241,
            ),
          ]);
          await standings
              .replaceConstructorStandings(2026, <ConstructorStanding>[
                const ConstructorStanding(
                  season: 2026,
                  constructorId: 'red-bull',
                  position: 1,
                  points: 331,
                ),
              ]);
        }

        expect(await storedDriverName('max-verstappen'), 'Max Verstappen');
        expect(await storedConstructorName('red-bull'), 'Red Bull Racing');
        final DriverStandingEntry row = (await standings.driverStandingEntries(
          2026,
        )).single;
        expect(row.driverName, 'Max Verstappen');
        expect(row.driverShortCode, 'VER');
        expect(row.constructorName, 'Red Bull Racing');
        expect(row.teamColor, '#1E41FF');
      },
    );

    test('an authoritative upsert may not store the stub marker', () async {
      await expectLater(
        competitors.upsertDrivers(<Driver>[
          const Driver(id: 'blank-driver', fullName: kUnresolvedIdentityName),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
      await expectLater(
        competitors.upsertConstructors(<Constructor>[
          const Constructor(id: 'blank-team', name: '   '),
        ]),
        throwsA(isA<InvalidEntityException>()),
      );
      // Nothing was written, so no accidental stub was left behind either.
      expect(await competitors.countDriver('blank-driver'), 0);
      expect(await competitors.countConstructor('blank-team'), 0);
    });
  });

  group('stubs are not domain entities', () {
    test('an unresolved driver is not a materialized detail', () async {
      await standings.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'unsynced-driver',
          position: 1,
          points: 1,
        ),
      ]);
      expect(await competitors.driverDetail(2026, 'unsynced-driver'), isNull);

      // …and it becomes one as soon as the identity arrives.
      await competitors.upsertDrivers(<Driver>[
        const Driver(id: 'unsynced-driver', fullName: 'Now Known'),
      ]);
      final DriverDetailView? detail = await competitors.driverDetail(
        2026,
        'unsynced-driver',
      );
      expect(detail?.driver.fullName, 'Now Known');
      // The standing it was created for is still there.
      expect(detail?.standing?.position, 1);
    });

    test('an unresolved constructor is not a materialized detail', () async {
      await standings.replaceConstructorStandings(2026, <ConstructorStanding>[
        const ConstructorStanding(
          season: 2026,
          constructorId: 'unsynced-team',
          position: 1,
          points: 1,
        ),
      ]);
      expect(await competitors.teamDetail(2026, 'unsynced-team'), isNull);

      await competitors.upsertConstructors(<Constructor>[
        const Constructor(id: 'unsynced-team', name: 'Now Known'),
      ]);
      final TeamDetailView? detail = await competitors.teamDetail(
        2026,
        'unsynced-team',
      );
      expect(detail?.constructor.name, 'Now Known');
      expect(detail?.standing?.points, 1);
    });

    test('collection reads exclude unresolved stubs', () async {
      // One real driver and one that only exists as a referential stub, both
      // with a season participation entry.
      await competitors.upsertDrivers(<Driver>[
        const Driver(id: 'real-driver', fullName: 'Real Driver'),
      ]);
      await competitors.upsertConstructors(<Constructor>[
        const Constructor(id: 'real-team', name: 'Real Team'),
      ]);
      await standings.replaceDriverStandings(2026, <DriverStanding>[
        const DriverStanding(
          season: 2026,
          driverId: 'stub-driver',
          constructorId: 'stub-team',
          position: 2,
          points: 1,
        ),
      ]);
      await competitors.replaceDriverSeasonEntries(2026, <DriverSeasonEntry>[
        const DriverSeasonEntry(
          id: 'dse-real',
          season: 2026,
          driverId: 'real-driver',
          constructorId: 'real-team',
          raceNumber: 1,
        ),
        const DriverSeasonEntry(
          id: 'dse-stub',
          season: 2026,
          driverId: 'stub-driver',
          constructorId: 'stub-team',
          raceNumber: 2,
        ),
      ]);
      await competitors
          .replaceConstructorSeasonEntries(2026, <ConstructorSeasonEntry>[
            const ConstructorSeasonEntry(
              id: 'cse-real',
              season: 2026,
              constructorId: 'real-team',
            ),
            const ConstructorSeasonEntry(
              id: 'cse-stub',
              season: 2026,
              constructorId: 'stub-team',
            ),
          ]);

      expect(
        (await competitors.driversForSeason(
          2026,
        )).map((SeasonDriver s) => s.driver.id),
        <String>['real-driver'],
      );
      expect(
        (await competitors.constructorsForSeason(
          2026,
        )).map((SeasonConstructor s) => s.constructor.id),
        <String>['real-team'],
      );
      // The season entries themselves were not lost — only the identity-shaped
      // projection omits them.
      expect(await competitors.countDriverSeasonEntries(2026), 2);
      expect(await competitors.countConstructorSeasonEntries(2026), 2);
      // And the standing that created the stub is intact.
      expect(await standings.driverStandingEntries(2026), hasLength(1));
    });

    test('a classification shows no invented competitor names', () async {
      // A classification needs its parent Grand Prix; the competitors it
      // references have deliberately not synchronised.
      await db
          .into(db.seasons)
          .insert(
            SeasonsCompanion.insert(
              year: const Value<int>(2026),
              status: 'active',
            ),
          );
      await db
          .into(db.circuits)
          .insert(CircuitsCompanion.insert(id: 'spa', name: 'Spa'));
      await db
          .into(db.grandPrixEvents)
          .insert(
            GrandPrixEventsCompanion.insert(
              id: '2026-belgian-grand-prix',
              season: 2026,
              round: 13,
              eventSlug: 'belgian-grand-prix',
              name: 'Belgian Grand Prix',
              circuitId: 'spa',
              status: 'completed',
              format: 'standard',
            ),
          );

      await results.writeRaceResult(
        const RaceResult(
          id: '2026-belgian-grand-prix-race',
          season: 2026,
          round: 13,
          grandPrixId: '2026-belgian-grand-prix',
          sessionType: SessionType.race,
          status: ResultStatus.finalResult,
          entries: <RaceResultEntry>[
            RaceResultEntry(
              driverId: 'unsynced-driver',
              constructorId: 'unsynced-team',
              position: 1,
              points: 25,
              status: FinishStatus.finished,
            ),
          ],
        ),
      );

      final RaceResultEntry entry = (await results.resultsForSeasonRound(
        2026,
        13,
      )).single.entries.single;
      expect(entry.driverId, 'unsynced-driver');
      expect(entry.constructorId, 'unsynced-team');
      expect(entry.driverName, isNull);
      expect(entry.constructorName, isNull);
      // The stub parents exist for the foreign keys, and stay hidden.
      expect(
        isUnresolvedIdentityName(await storedDriverName('unsynced-driver')),
        isTrue,
      );
      expect(
        isUnresolvedIdentityName(await storedConstructorName('unsynced-team')),
        isTrue,
      );
    });
  });

  group('on-disk durability', () {
    late Directory tempDir;
    late File dbFile;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('gridview_stub_reopen');
      dbFile = File('${tempDir.path}/gridview_v2.sqlite');
    });
    tearDown(() {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    });

    test(
      'unresolved standings stay readable and the stub stays hidden',
      () async {
        final GridViewDatabase first = GridViewDatabase.forTesting(
          NativeDatabase(dbFile),
        );
        await first.standingsDao.replaceDriverStandings(2026, <DriverStanding>[
          const DriverStanding(
            season: 2026,
            driverId: 'unsynced-driver',
            constructorId: 'unsynced-team',
            position: 7,
            points: 0.5,
          ),
        ]);
        await first.close();

        final GridViewDatabase reopened = GridViewDatabase.forTesting(
          NativeDatabase(dbFile),
        );
        final DriverStandingEntry row =
            (await reopened.standingsDao.driverStandingEntries(2026)).single;
        expect(row.driverId, 'unsynced-driver');
        expect(row.position, 7);
        expect(row.points, 0.5);
        expect(row.driverName, isNull);
        expect(row.constructorName, isNull);
        expect(
          await reopened.competitorDao.driverDetail(2026, 'unsynced-driver'),
          isNull,
        );

        // Resolution still works after the restart.
        await reopened.competitorDao.upsertDrivers(<Driver>[
          const Driver(id: 'unsynced-driver', fullName: 'Finally Known'),
        ]);
        expect(
          (await reopened.standingsDao.driverStandingEntries(
            2026,
          )).single.driverName,
          'Finally Known',
        );
        await reopened.close();
      },
    );
  });

  test('a historical season may hold unresolved identities', () async {
    await standings.replaceDriverStandings(2019, <DriverStanding>[
      const DriverStanding(
        season: 2019,
        driverId: 'historical-driver',
        position: 1,
        points: 413,
      ),
    ]);
    final DriverStandingEntry row = (await standings.driverStandingEntries(
      2019,
    )).single;
    expect(row.season, 2019);
    expect(row.driverName, isNull);
    expect(row.driverId, 'historical-driver');
    // The current season is untouched by a historical write.
    expect(await standings.driverStandingEntries(2026), isEmpty);
  });

  test('the marker never survives a read of any shape', () async {
    await standings.replaceDriverStandings(2026, <DriverStanding>[
      const DriverStanding(
        season: 2026,
        driverId: 'unsynced-driver',
        constructorId: 'unsynced-team',
        position: 1,
        points: 1,
      ),
    ]);
    await standings.replaceConstructorStandings(2026, <ConstructorStanding>[
      const ConstructorStanding(
        season: 2026,
        constructorId: 'unsynced-team',
        position: 1,
        points: 1,
      ),
    ]);

    final DriverStandingEntry driverRow =
        (await standings.driverStandingEntries(2026)).single;
    final ConstructorStandingEntry teamRow =
        (await standings.constructorStandingEntries(2026)).single;

    for (final String? projected in <String?>[
      driverRow.driverName,
      driverRow.driverShortCode,
      driverRow.constructorName,
      driverRow.teamColor,
      teamRow.seasonName,
      teamRow.stableName,
      teamRow.displayName,
      teamRow.teamColor,
    ]) {
      expect(projected, isNull);
    }
  });

  test('the stub predicate is exact, not a heuristic', () {
    expect(isUnresolvedIdentityName(kUnresolvedIdentityName), isTrue);
    expect(isUnresolvedIdentityName(null), isFalse);
    expect(isUnresolvedIdentityName('Max Verstappen'), isFalse);
    expect(isUnresolvedIdentityName('max-verstappen'), isFalse);
    expect(isUnresolvedIdentityName(' '), isFalse);
    expect(resolvedDisplayName(kUnresolvedIdentityName), isNull);
    expect(resolvedDisplayName(null), isNull);
    expect(resolvedDisplayName('Max Verstappen'), 'Max Verstappen');
  });
}

/// Waits for [condition], driving the event loop. Bounded so a broken
/// expectation fails the test instead of hanging it.
Future<void> _until(bool Function() condition) async {
  for (int i = 0; i < 2000; i++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
  fail('condition was never met');
}
