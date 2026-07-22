import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/calendar_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

void main() {
  late GridViewDatabase db;
  late CalendarDao dao;

  Future<void> insertEvent({
    required String id,
    required int round,
    required String circuitId,
    required String status,
    required String startDate,
    required String endDate,
    String format = 'standard',
  }) => db
      .into(db.grandPrixEvents)
      .insert(
        GrandPrixEventsCompanion.insert(
          id: id,
          season: 2026,
          round: round,
          eventSlug: id,
          name: id,
          circuitId: circuitId,
          status: status,
          format: format,
          startDate: Value<String?>(startDate),
          endDate: Value<String?>(endDate),
        ),
      );

  setUp(() async {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.calendarDao;

    // Events reference the season via a foreign key.
    await db
        .into(db.seasons)
        .insert(
          SeasonsCompanion.insert(
            year: const Value<int>(2026),
            status: 'active',
          ),
        );

    await dao.upsertCircuits(<Circuit>[
      Circuit(
        id: 'spa',
        name: 'Circuit de Spa-Francorchamps',
        latitude: 50.4372,
        longitude: 5.9714,
        lengthMeters: 7004,
        cornerCount: 19,
        direction: CircuitDirection.clockwise,
        firstGrandPrixYear: 1950,
        lapRecord: const LapRecord(
          driverId: 'valtteri-bottas',
          time: Duration(minutes: 1, seconds: 46, milliseconds: 286),
          year: 2018,
        ),
        media: const <MediaAsset>[
          MediaAsset(
            id: 'spa-layout-v1',
            entityType: MediaEntityType.circuit,
            entityId: 'spa',
            category: MediaCategory.circuitLayout,
            format: MediaFormat.png,
            variants: MediaVariants(
              detail: MediaVariant(url: 'https://cdn/spa.png'),
            ),
            version: 'v1',
          ),
        ],
      ),
      const Circuit(id: 'monaco', name: 'Circuit de Monaco'),
    ]);

    await insertEvent(
      id: '2026-monaco-grand-prix',
      round: 5,
      circuitId: 'monaco',
      status: 'completed',
      startDate: '2026-05-22',
      endDate: '2026-05-24',
    );
    await insertEvent(
      id: '2026-belgian-grand-prix',
      round: 13,
      circuitId: 'spa',
      status: 'scheduled',
      startDate: '2026-07-24',
      endDate: '2026-07-26',
      format: 'sprint',
    );
    await db
        .into(db.sessions)
        .insert(
          SessionsCompanion.insert(
            id: '2026-belgian-grand-prix-race',
            grandPrixId: '2026-belgian-grand-prix',
            type: 'race',
            status: 'scheduled',
            orderIndex: 6,
            startTimeUtc: Value<DateTime?>(DateTime.utc(2026, 7, 26, 13)),
            endTimeUtc: Value<DateTime?>(DateTime.utc(2026, 7, 26, 15)),
          ),
        );
  });
  tearDown(() => db.close());

  test('calendar is ordered by round and preserves weekend formats', () async {
    final List<GrandPrix> calendar = await dao.calendar(2026);
    expect(calendar.map((GrandPrix g) => g.round), <int>[5, 13]);
    expect(calendar.last.sessions, hasLength(1));
    // Standard and sprint weekends use the same shape; the format round-trips.
    expect(calendar.first.format, WeekendFormat.standard);
    expect(calendar.last.format, WeekendFormat.sprint);
  });

  test('nextEvent is the earliest event on/after now', () async {
    final GrandPrix? next = await dao.nextEvent(2026, DateTime.utc(2026, 6, 1));
    expect(next?.id, '2026-belgian-grand-prix');
  });

  test('latestCompletedEvent is the most recent finished event', () async {
    final GrandPrix? latest = await dao.latestCompletedEvent(
      2026,
      DateTime.utc(2026, 6, 1),
    );
    expect(latest?.id, '2026-monaco-grand-prix');
  });

  test(
    'currentSession returns the session whose window contains now',
    () async {
      final Session? live = await dao.currentSession(
        DateTime.utc(2026, 7, 26, 14),
      );
      expect(live?.id, '2026-belgian-grand-prix-race');

      final Session? none = await dao.currentSession(
        DateTime.utc(2026, 7, 26, 16),
      );
      expect(none, isNull);
    },
  );

  test('circuitsForSeason returns hosting circuits ordered by name', () async {
    final List<Circuit> circuits = await dao.circuitsForSeason(2026);
    expect(circuits.map((Circuit c) => c.id), <String>['monaco', 'spa']);
  });

  test(
    'circuitDetail returns the full circuit with media and related events',
    () async {
      final CircuitDetailView? detail = await dao.circuitDetail('spa');
      expect(detail, isNotNull);
      final Circuit c = detail!.circuit;
      expect(c.lengthMeters, 7004);
      expect(c.cornerCount, 19);
      expect(c.direction, CircuitDirection.clockwise);
      expect(c.latitude, 50.4372);
      expect(c.firstGrandPrixYear, 1950);
      expect(c.lapRecord?.driverId, 'valtteri-bottas');
      expect(
        c.lapRecord?.time,
        const Duration(minutes: 1, seconds: 46, milliseconds: 286),
      );
      expect(c.media, hasLength(1));
      expect(c.media?.single.category, MediaCategory.circuitLayout);

      expect(detail.relatedGrandPrix.map((GrandPrix g) => g.id), <String>[
        '2026-belgian-grand-prix',
      ]);
    },
  );
}
