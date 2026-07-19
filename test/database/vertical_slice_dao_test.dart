import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/vertical_slice_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

import '../support/domain_fixtures.dart';

void main() {
  late GridViewDatabase db;
  late VerticalSliceDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.verticalSliceDao;
  });

  tearDown(() => db.close());

  final DateTime t0 = DateTime.utc(2026, 7, 18, 12);
  final DateTime t1 = DateTime.utc(2026, 7, 18, 13);

  group('schema', () {
    test('schema version is 1', () {
      expect(db.schemaVersion, 1);
    });

    test('all vertical-slice tables are created', () async {
      final List<QueryRow> rows = await db
          .customSelect(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
          )
          .get();
      final Set<String> names = rows
          .map((QueryRow r) => r.read<String>('name'))
          .toSet();
      expect(
        names,
        containsAll(<String>[
          'seasons',
          'circuits',
          'grand_prix',
          'sessions',
          'snapshots',
        ]),
      );
    });
  });

  group('foreign keys', () {
    test('are enabled (pragma on)', () async {
      final QueryRow row = await db
          .customSelect('PRAGMA foreign_keys')
          .getSingle();
      expect(row.data.values.first, 1);
    });

    test('a session cannot reference a missing Grand Prix', () async {
      await expectLater(
        db
            .into(db.sessions)
            .insert(
              SessionsCompanion.insert(
                id: 'orphan',
                grandPrixId: 'does-not-exist',
                type: 'race',
                status: 'scheduled',
                orderIndex: 0,
              ),
            ),
        throwsA(anything),
      );
    });

    test('removing a Grand Prix cascades to its sessions', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: t0),
      );
      expect(await db.select(db.sessions).get(), isNotEmpty);

      await (db.delete(
        db.grandPrixEvents,
      )..where((g) => g.id.equals('2026-belgian-grand-prix'))).go();

      expect(await db.select(db.sessions).get(), isEmpty);
    });
  });

  group('home snapshot', () {
    test(
      'applies season, circuit, grand prix, session and freshness atomically',
      () async {
        final SnapshotWriteOutcome outcome = await dao.writeHomeSnapshot(
          season: season2026(),
          featured: belgianGrandPrix(),
          featuredCircuit: circuitSpa(),
          freshness: freshness(generatedAt: t0),
        );

        expect(outcome, SnapshotWriteOutcome.applied);
        expect((await db.select(db.seasons).get()).length, 1);
        expect((await db.select(db.circuits).get()).length, 1);
        expect((await db.select(db.grandPrixEvents).get()).length, 1);
        expect((await db.select(db.sessions).get()).length, 1);
        expect((await db.select(db.snapshots).get()).length, 1);
      },
    );

    test('repeated identical sync is idempotent (no duplicates)', () async {
      Future<void> sync() => dao.writeHomeSnapshot(
        season: season2026(),
        featured: belgianGrandPrix(),
        featuredCircuit: circuitSpa(),
        freshness: freshness(generatedAt: t0),
      );

      await sync();
      await sync();
      await sync();

      expect((await db.select(db.seasons).get()).length, 1);
      expect((await db.select(db.grandPrixEvents).get()).length, 1);
      expect((await db.select(db.sessions).get()).length, 1);
    });

    test('preserves null optional values', () async {
      await dao.writeHomeSnapshot(
        featured: belgianGrandPrix(), // officialName is null
        featuredCircuit: circuitSpa(),
        freshness: freshness(generatedAt: t0),
      );
      final GrandPrixRow row = await db.select(db.grandPrixEvents).getSingle();
      expect(row.officialName, isNull);
    });
  });

  group('grand prix snapshot', () {
    test('replaces obsolete sessions without duplicates', () async {
      // First sync: full 5-session sprint weekend.
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: t0),
      );
      expect((await db.select(db.sessions).get()).length, 5);

      // Newer sync: only two sessions remain.
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(
          sessions: belgianSprintSessions().take(2).toList(),
        ),
        freshness: freshness(generatedAt: t1),
      );

      final List<SessionRow> sessions = await db.select(db.sessions).get();
      expect(sessions.length, 2);
      expect(
        sessions.map((SessionRow s) => s.id).toSet().length,
        2,
        reason: 'no duplicate session ids',
      );
    });

    test('stores sessions with explicit ascending order', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: t0),
      );
      final GrandPrixDetailView? view = await dao
          .watchGrandPrix(2026, 13)
          .first;
      expect(view, isNotNull);
      expect(
        view!.grandPrix.sessions.map((Session s) => s.type).toList(),
        <SessionType>[
          SessionType.practice1,
          SessionType.sprintQualifying,
          SessionType.sprint,
          SessionType.qualifying,
          SessionType.race,
        ],
      );
    });

    test('rolls back the whole transaction on a mid-write failure', () async {
      final List<Session> duplicated = <Session>[
        raceSessionBelgian(),
        raceSessionBelgian(), // duplicate primary key -> insert throws
      ];
      await expectLater(
        dao.writeGrandPrixSnapshot(
          grandPrix: belgianGrandPrix(sessions: duplicated),
          freshness: freshness(generatedAt: t0),
        ),
        throwsA(anything),
      );
      // Nothing from the failed transaction is persisted.
      expect(await db.select(db.grandPrixEvents).get(), isEmpty);
      expect(await db.select(db.snapshots).get(), isEmpty);
    });
  });

  group('snapshot version conflict rule', () {
    test('a newer snapshot updates the cached data', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(status: EventStatus.upcoming),
        freshness: freshness(generatedAt: t0),
      );
      final SnapshotWriteOutcome outcome = await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(status: EventStatus.inProgress),
        freshness: freshness(generatedAt: t1),
      );

      expect(outcome, SnapshotWriteOutcome.applied);
      final GrandPrixRow row = await db.select(db.grandPrixEvents).getSingle();
      expect(row.status, EventStatus.inProgress.wire);
    });

    test('an older snapshot is rejected and does not overwrite', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(status: EventStatus.inProgress),
        freshness: freshness(generatedAt: t1),
      );
      final SnapshotWriteOutcome outcome = await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(status: EventStatus.upcoming),
        freshness: freshness(generatedAt: t0), // older
      );

      expect(outcome, SnapshotWriteOutcome.rejectedOlder);
      final GrandPrixRow row = await db.select(db.grandPrixEvents).getSingle();
      expect(
        row.status,
        EventStatus.inProgress.wire,
        reason: 'newer cached data retained',
      );
    });

    test('an equal snapshot is applied idempotently', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: t0),
      );
      final SnapshotWriteOutcome outcome = await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
        freshness: freshness(generatedAt: t0),
      );
      expect(outcome, SnapshotWriteOutcome.applied);
      expect((await db.select(db.sessions).get()).length, 5);
    });
  });

  group('value fidelity', () {
    test('UTC instants round-trip in UTC', () async {
      await dao.writeGrandPrixSnapshot(
        grandPrix: belgianGrandPrix(sessions: <Session>[raceSessionBelgian()]),
        freshness: freshness(generatedAt: t0),
      );
      final SessionRow row = await db.select(db.sessions).getSingle();
      expect(row.startTimeUtc, isNotNull);
      expect(row.startTimeUtc!.isUtc, isTrue);
      expect(row.startTimeUtc, DateTime.utc(2026, 7, 26, 13));
    });

    test('unknown enum values remain representable as unknown', () async {
      final GrandPrix withUnknown = GrandPrix(
        id: '2026-mystery-grand-prix',
        season: 2026,
        round: 14,
        eventSlug: 'mystery-grand-prix',
        name: 'Mystery Grand Prix',
        circuitId: 'spa-francorchamps',
        status: EventStatus.fromWire('teleported'), // -> unknown
        format: WeekendFormat.fromWire('marbles'), // -> unknown
        sessions: const <Session>[],
        hasResults: false,
      );
      await dao.writeGrandPrixSnapshot(
        grandPrix: withUnknown,
        freshness: freshness(generatedAt: t0),
      );
      final GrandPrixDetailView? view = await dao
          .watchGrandPrix(2026, 14)
          .first;
      expect(view!.grandPrix.status, EventStatus.unknown);
      expect(view.grandPrix.format, WeekendFormat.unknown);
    });
  });

  group('DAO stream emissions', () {
    test('watchHome emits null then the composed view after a write', () async {
      final List<HomeView?> emissions = <HomeView?>[];
      final sub = dao.watchHome().listen(emissions.add);
      await pumpEventQueue();
      expect(emissions, <HomeView?>[null]);

      await dao.writeHomeSnapshot(
        season: season2026(),
        featured: belgianGrandPrix(),
        featuredCircuit: circuitSpa(),
        freshness: freshness(generatedAt: t0),
      );
      await pumpEventQueue();

      expect(emissions.last, isA<HomeView>());
      final HomeView view = emissions.last!;
      expect(view.featured.id, '2026-belgian-grand-prix');
      expect(view.season?.year, 2026);
      await sub.cancel();
    });

    test('watchGrandPrix emits the detail view with its circuit', () async {
      await dao.writeHomeSnapshot(
        season: season2026(),
        featured: belgianGrandPrix(),
        featuredCircuit: circuitSpa(),
        freshness: freshness(generatedAt: t0),
      );
      final GrandPrixDetailView? view = await dao
          .watchGrandPrix(2026, 13)
          .first;
      expect(view, isNotNull);
      expect(view!.grandPrix.round, 13);
      expect(view.circuit?.name, 'Circuit de Spa-Francorchamps');
    });
  });
}
