import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/relevant_event.dart';

import '../support/domain_fixtures.dart';

/// The shared chronology rules over a calendar whose statuses are all
/// `unknown` and whose weekend dates are absent, which is exactly what the
/// Jolpica calendar publishes (ADR 0022 A6, A8). The only chronology facts are
/// the classified-result flag (A7) and, where a session is stored, the race
/// session's explicit UTC start.
///
/// Every case pins an explicit instant; nothing reads the host clock.
void main() {
  // The 2026-10-07 frozen-APK capture instant.
  final DateTime capture = DateTime.utc(2026, 10, 7, 22, 41, 45, 852);

  Session race(int round, DateTime start) => Session(
    id: '2026-round-$round-grand-prix-race',
    type: SessionType.race,
    startTime: start,
    status: SessionStatus.unknown,
  );

  GrandPrix event(
    int round, {
    bool hasResults = false,
    DateTime? raceStart,
    EventStatus status = EventStatus.unknown,
    String? startDate,
    String? endDate,
  }) => calendarEntry(
    round: round,
    name: 'Round $round Grand Prix',
    status: status,
    hasResults: hasResults,
    startDate: startDate,
    endDate: endDate,
    sessions: raceStart == null
        ? const <Session>[]
        : <Session>[race(round, raceStart)],
  ).grandPrix;

  /// 23 rounds, classified through [classifiedThrough]. Only round 17 carries
  /// a stored race session, as on a phone whose Home snapshot featured it.
  List<GrandPrix> frozenSeason({int classifiedThrough = 16}) =>
      List<GrandPrix>.generate(23, (int index) {
        final int round = index + 1;
        return event(
          round,
          hasResults: round <= classifiedThrough,
          raceStart: round == 17 ? DateTime.utc(2026, 10, 11, 12) : null,
        );
      });

  List<int> rounds(Iterable<GrandPrix> events) =>
      events.map((GrandPrix e) => e.round).toList(growable: false);

  group('at the capture instant', () {
    test('round 17 is next, round 16 is the latest result, round 1 is not '
        'upcoming', () {
      final List<GrandPrix> season = frozenSeason();

      final RelevantEvent relevant = resolveRelevantEvent(season, capture)!;
      expect(relevant.event.round, 17);
      expect(relevant.inProgress, isFalse);
      expect(resolveLatestCompletedEvent(season, capture)!.round, 16);
      expect(rounds(resolveUpcomingEvents(season, capture)), <int>[17, 18, 19]);
      expect(
        rounds(resolveUpcomingEvents(season, capture)),
        isNot(contains(1)),
      );
    });

    test('Home (focus round 17 excluded) and Calendar list the same '
        'chronology', () {
      final List<GrandPrix> season = frozenSeason();
      expect(
        rounds(resolveUpcomingEvents(season, capture, excludeRound: 17)),
        <int>[18, 19, 20],
      );
    });

    test('the featured event has not lapsed', () {
      final GrandPrix round17 = frozenSeason()[16];
      expect(hasFeaturedEventLapsed(round17, capture), isFalse);
    });

    test('a result never changes the unknown status', () {
      final GrandPrix latest = resolveLatestCompletedEvent(
        frozenSeason(),
        capture,
      )!;
      expect(latest.status, EventStatus.unknown);
      expect(isEventSettled(latest), isTrue);
    });
  });

  group('pre-season', () {
    test('with nothing settled or behind, the first round is next', () {
      final List<GrandPrix> season = frozenSeason(classifiedThrough: 0);
      final DateTime february = DateTime.utc(2026, 2, 1);

      expect(resolveRelevantEvent(season, february)!.event.round, 1);
      expect(resolveLatestCompletedEvent(season, february), isNull);
    });
  });

  group('an event weekend in progress', () {
    test('the event stays next until its own race starts', () {
      final GrandPrix weekend = calendarEntry(
        round: 17,
        name: 'Round 17 Grand Prix',
        status: EventStatus.unknown,
        sessions: <Session>[
          Session(
            id: '2026-round-17-grand-prix-practice-1',
            type: SessionType.practice1,
            startTime: DateTime.utc(2026, 10, 9, 9, 30),
            status: SessionStatus.unknown,
          ),
          race(17, DateTime.utc(2026, 10, 11, 12)),
        ],
      ).grandPrix;
      final List<GrandPrix> season = <GrandPrix>[
        event(16, hasResults: true),
        weekend,
        event(18),
      ];
      final DateTime saturday = DateTime.utc(2026, 10, 10, 15);

      expect(resolveRelevantEvent(season, saturday)!.event.round, 17);
      expect(hasFeaturedEventLapsed(weekend, saturday), isFalse);
    });

    test('an authoritative in_progress status still wins', () {
      final List<GrandPrix> season = <GrandPrix>[
        event(16, hasResults: true),
        event(17, status: EventStatus.inProgress),
        event(18),
      ];
      final RelevantEvent relevant = resolveRelevantEvent(season, capture)!;
      expect(relevant.event.round, 17);
      expect(relevant.inProgress, isTrue);
    });
  });

  group('missing session times', () {
    test('undated rounds follow the last settled round in delivered order', () {
      final List<GrandPrix> season = <GrandPrix>[
        event(1, hasResults: true),
        event(2, hasResults: true),
        event(3),
        event(4),
      ];
      expect(resolveRelevantEvent(season, capture)!.event.round, 3);
      expect(rounds(resolveUpcomingEvents(season, capture)), <int>[3, 4]);
      expect(resolveLatestCompletedEvent(season, capture)!.round, 2);
    });

    test('an undated round before a settled one is never upcoming', () {
      final List<GrandPrix> season = <GrandPrix>[
        event(1),
        event(2, hasResults: true),
        event(3),
      ];
      expect(rounds(resolveUpcomingEvents(season, capture)), <int>[3]);
    });

    test('published weekend dates still place an unknown event', () {
      final List<GrandPrix> season = <GrandPrix>[
        event(1, startDate: '2026-03-06', endDate: '2026-03-08'),
        event(2, startDate: '2026-10-09', endDate: '2026-10-11'),
      ];
      expect(resolveRelevantEvent(season, capture)!.event.round, 2);
      // Its dates passed, but an unknown status with no result is not finished.
      expect(resolveLatestCompletedEvent(season, capture), isNull);
    });

    test('a focus with no stored race time never lapses', () {
      expect(hasFeaturedEventLapsed(event(17), capture), isFalse);
    });
  });

  group('a season with no future races', () {
    test('nothing is next and the final classified round is latest', () {
      final List<GrandPrix> season = frozenSeason(classifiedThrough: 23);
      final DateTime december = DateTime.utc(2026, 12, 31);

      expect(resolveRelevantEvent(season, december), isNull);
      expect(resolveUpcomingEvents(season, december), isEmpty);
      expect(resolveLatestCompletedEvent(season, december)!.round, 23);
    });
  });

  group('an aging frozen snapshot', () {
    // Five days after the capture: round 17's stored race start has passed and
    // the frozen data has no classification for it.
    final DateTime aged = DateTime.utc(2026, 10, 12, 9);

    test('the featured round 17 lapses without being completed', () {
      final GrandPrix round17 = frozenSeason()[16];
      expect(hasFeaturedEventLapsed(round17, aged), isTrue);
      expect(isEventSettled(round17), isFalse);
      expect(round17.status, EventStatus.unknown);
    });

    test('Calendar moves on to round 18; round 16 stays the latest result', () {
      final List<GrandPrix> season = frozenSeason();
      expect(resolveRelevantEvent(season, aged)!.event.round, 18);
      expect(rounds(resolveUpcomingEvents(season, aged)), <int>[18, 19, 20]);
      expect(resolveLatestCompletedEvent(season, aged)!.round, 16);
    });

    test('an authoritative focus is never second-guessed by the clock', () {
      final GrandPrix scheduled = event(
        17,
        status: EventStatus.scheduled,
        raceStart: DateTime.utc(2026, 10, 11, 12),
      );
      expect(hasFeaturedEventLapsed(scheduled, aged), isFalse);
    });
  });
}
