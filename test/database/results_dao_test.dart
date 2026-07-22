import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/results_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';

void main() {
  late GridViewDatabase db;
  late ResultsDao dao;

  setUp(() async {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.resultsDao;
    // Results require an existing parent Grand Prix.
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
  });
  tearDown(() => db.close());

  RaceResult raceOf(List<RaceResultEntry> entries, {FastestLap? fastestLap}) =>
      RaceResult(
        id: '2026-belgian-grand-prix-race-results',
        season: 2026,
        round: 13,
        grandPrixId: '2026-belgian-grand-prix',
        sessionType: SessionType.race,
        status: ResultStatus.finalResult,
        entries: entries,
        fastestLap: fastestLap,
      );

  test(
    'round-trips ordered entries with structured timing and fractional points',
    () async {
      await dao.writeRaceResult(
        raceOf(
          <RaceResultEntry>[
            const RaceResultEntry(
              driverId: 'max-verstappen',
              constructorId: 'red-bull',
              position: 1,
              gridPosition: 1,
              points: 25,
              status: FinishStatus.finished,
              laps: 44,
              elapsedTime: Duration(hours: 1, minutes: 30, seconds: 12),
              fastestLap: true,
            ),
            const RaceResultEntry(
              driverId: 'lewis-hamilton',
              constructorId: 'ferrari',
              position: 2,
              points: 18.5,
              status: FinishStatus.finished,
              gapToLeader: Duration(seconds: 5, milliseconds: 123),
            ),
            const RaceResultEntry(
              driverId: 'retiree',
              constructorId: 'backmarker',
              status: FinishStatus.dnf,
              dnfReason: 'Engine',
            ),
          ],
          fastestLap: const FastestLap(
            driverId: 'max-verstappen',
            time: Duration(minutes: 1, seconds: 44, milliseconds: 500),
            lap: 40,
          ),
        ),
      );

      final RaceResult? result = await dao.raceResult(
        '2026-belgian-grand-prix-race-results',
      );
      expect(result, isNotNull);
      expect(result!.status, ResultStatus.finalResult);
      expect(result.sessionType, SessionType.race);
      expect(result.entries.map((RaceResultEntry e) => e.driverId), <String>[
        'max-verstappen',
        'lewis-hamilton',
        'retiree',
      ]);

      final RaceResultEntry winner = result.entries[0];
      expect(winner.points, 25);
      expect(
        winner.elapsedTime,
        const Duration(hours: 1, minutes: 30, seconds: 12),
      );
      expect(winner.fastestLap, isTrue);

      expect(result.entries[1].points, 18.5);
      expect(
        result.entries[1].gapToLeader,
        const Duration(seconds: 5, milliseconds: 123),
      );

      final RaceResultEntry dnf = result.entries[2];
      expect(dnf.status, FinishStatus.dnf);
      expect(dnf.position, isNull);
      expect(dnf.points, isNull);
      expect(dnf.dnfReason, 'Engine');

      expect(result.fastestLap?.driverId, 'max-verstappen');
      expect(
        result.fastestLap?.time,
        const Duration(minutes: 1, seconds: 44, milliseconds: 500),
      );
      expect(result.fastestLap?.lap, 40);
    },
  );

  test('rewriting a result replaces its entries without duplicates', () async {
    await dao.writeRaceResult(
      raceOf(<RaceResultEntry>[
        const RaceResultEntry(
          driverId: 'a',
          constructorId: 't',
          status: FinishStatus.finished,
        ),
        const RaceResultEntry(
          driverId: 'b',
          constructorId: 't',
          status: FinishStatus.finished,
        ),
      ]),
    );
    await dao.writeRaceResult(
      raceOf(<RaceResultEntry>[
        const RaceResultEntry(
          driverId: 'a',
          constructorId: 't',
          status: FinishStatus.finished,
        ),
      ]),
    );

    final RaceResult? result = await dao.raceResult(
      '2026-belgian-grand-prix-race-results',
    );
    expect(result!.entries, hasLength(1));
    expect(result.entries.single.driverId, 'a');
  });

  test('an unavailable result has no fastest lap and no entries', () async {
    await dao.writeRaceResult(
      RaceResult(
        id: '2026-belgian-grand-prix-sprint-results',
        season: 2026,
        round: 13,
        grandPrixId: '2026-belgian-grand-prix',
        sessionType: SessionType.sprint,
        status: ResultStatus.unavailable,
        entries: const <RaceResultEntry>[],
      ),
    );

    final RaceResult? result = await dao.raceResult(
      '2026-belgian-grand-prix-sprint-results',
    );
    expect(result!.status, ResultStatus.unavailable);
    expect(result.entries, isEmpty);
    expect(result.fastestLap, isNull);
  });

  test(
    'DNF/DNS/DSQ entries round-trip with their null timing combinations',
    () async {
      await dao.writeRaceResult(
        raceOf(<RaceResultEntry>[
          const RaceResultEntry(
            driverId: 'dns-driver',
            constructorId: 't',
            status: FinishStatus.dns,
          ),
          const RaceResultEntry(
            driverId: 'dsq-driver',
            constructorId: 't',
            position: 8,
            status: FinishStatus.dsq,
            laps: 44,
          ),
          const RaceResultEntry(
            driverId: 'dnf-driver',
            constructorId: 't',
            status: FinishStatus.dnf,
            laps: 20,
            dnfReason: 'Gearbox',
          ),
        ]),
      );

      final RaceResult? result = await dao.raceResult(
        '2026-belgian-grand-prix-race-results',
      );
      final RaceResultEntry dns = result!.entries[0];
      expect(dns.status, FinishStatus.dns);
      expect(dns.position, isNull);
      expect(dns.laps, isNull);
      expect(dns.elapsedTime, isNull);
      expect(dns.points, isNull);

      final RaceResultEntry dsq = result.entries[1];
      expect(dsq.status, FinishStatus.dsq);
      expect(dsq.position, 8);
      expect(dsq.laps, 44);

      final RaceResultEntry dnf = result.entries[2];
      expect(dnf.status, FinishStatus.dnf);
      expect(dnf.dnfReason, 'Gearbox');
      expect(dnf.gapToLeader, isNull);
    },
  );

  test('an unknown finish status is preserved as unknown', () async {
    await dao.writeRaceResult(
      raceOf(<RaceResultEntry>[
        const RaceResultEntry(
          driverId: 'x',
          constructorId: 't',
          status: FinishStatus.unknown,
        ),
      ]),
    );
    final RaceResult? result = await dao.raceResult(
      '2026-belgian-grand-prix-race-results',
    );
    expect(result!.entries.single.status, FinishStatus.unknown);
  });

  test(
    'deleting the Grand Prix cascades to its results and result entries',
    () async {
      await dao.writeRaceResult(
        raceOf(<RaceResultEntry>[
          const RaceResultEntry(
            driverId: 'a',
            constructorId: 't',
            status: FinishStatus.finished,
          ),
        ]),
      );
      // Removing the parent event must remove its results and their entries.
      await db.delete(db.grandPrixEvents).go();
      expect(await db.select(db.raceResults).get(), isEmpty);
      expect(await db.select(db.raceResultEntries).get(), isEmpty);
    },
  );

  test('a mid-transaction failure rolls back the whole result write', () async {
    // A valid result is cached first.
    await dao.writeRaceResult(
      raceOf(<RaceResultEntry>[
        const RaceResultEntry(
          driverId: 'a',
          constructorId: 't',
          status: FinishStatus.finished,
        ),
      ]),
    );

    // A rewrite with two entries for the same driver violates the entry primary
    // key mid-transaction: the write must throw and leave the cached result.
    await expectLater(
      dao.writeRaceResult(
        raceOf(<RaceResultEntry>[
          const RaceResultEntry(
            driverId: 'dup',
            constructorId: 't',
            status: FinishStatus.finished,
          ),
          const RaceResultEntry(
            driverId: 'dup',
            constructorId: 't',
            status: FinishStatus.dnf,
          ),
        ]),
      ),
      throwsA(anything),
    );

    final RaceResult? result = await dao.raceResult(
      '2026-belgian-grand-prix-race-results',
    );
    expect(result!.entries, hasLength(1));
    expect(result.entries.single.driverId, 'a');
  });
}
