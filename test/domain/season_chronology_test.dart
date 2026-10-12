import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/relevant_event.dart';

import '../support/domain_fixtures.dart';

/// The latest-completed and upcoming rules live beside [resolveRelevantEvent] so
/// the Calendar query and the Home dashboard can never disagree. These cover the
/// two newer rules; [resolveRelevantEvent] itself is covered in
/// `relevant_event_test.dart`.
List<GrandPrix> seasonEvents() =>
    calendarFixture().map((e) => e.grandPrix).toList(growable: false);

GrandPrix event({
  required int round,
  String? startDate,
  String? endDate,
  EventStatus status = EventStatus.scheduled,
}) => belgianGrandPrix(
  round: round,
  status: status,
  startDate: startDate,
  endDate: endDate,
);

void main() {
  // The fixture season: rounds 11 and 12 completed (ending 2026-07-05 and
  // 2026-07-12), round 13 upcoming, then 14 and 15.
  final DateTime now = DateTime.utc(2026, 7, 18, 12);

  group('resolveLatestCompletedEvent', () {
    test('is the most recently finished event', () {
      expect(resolveLatestCompletedEvent(seasonEvents(), now)!.round, 12);
    });

    test('is null when nothing has finished yet', () {
      // Authoritative statuses with no classified result: the date rule
      // decides, and before the season nothing has ended.
      expect(
        resolveLatestCompletedEvent(<GrandPrix>[
          event(
            round: 11,
            startDate: '2026-07-03',
            endDate: '2026-07-05',
            status: EventStatus.completed,
          ),
          event(round: 12, startDate: '2026-07-10', endDate: '2026-07-12'),
        ], DateTime.utc(2026, 1, 1)),
        isNull,
      );
    });

    test('a classified result counts under an authoritative status too', () {
      // The classification arrived before the lifecycle status was refreshed:
      // the event is not upcoming, so it must still be the latest result.
      final List<GrandPrix> events = <GrandPrix>[
        belgianGrandPrix(
          round: 13,
          status: EventStatus.scheduled,
          hasResults: true,
          startDate: '2026-07-24',
          endDate: '2026-07-26',
        ),
      ];
      final DateTime duringWeekend = DateTime.utc(2026, 7, 26, 18);
      expect(resolveLatestCompletedEvent(events, duringWeekend)!.round, 13);
      expect(resolveUpcomingEvents(events, duringWeekend), isEmpty);
    });

    test('an event ending today is not yet "completed"', () {
      expect(
        resolveLatestCompletedEvent(<GrandPrix>[
          event(round: 1, startDate: '2026-07-16', endDate: '2026-07-18'),
        ], now),
        isNull,
      );
    });

    test('the higher round breaks a tie on end date', () {
      expect(
        resolveLatestCompletedEvent(<GrandPrix>[
          event(round: 4, startDate: '2026-07-01', endDate: '2026-07-05'),
          event(round: 2, startDate: '2026-07-01', endDate: '2026-07-05'),
        ], now)!.round,
        4,
      );
    });

    test('an event with no end date is never a candidate', () {
      expect(
        resolveLatestCompletedEvent(<GrandPrix>[
          event(round: 1, startDate: '2026-07-01'),
        ], now),
        isNull,
      );
    });

    test('a malformed end date is ignored rather than guessed at', () {
      expect(
        resolveLatestCompletedEvent(<GrandPrix>[
          event(round: 1, startDate: '2026-07-01', endDate: '07/2026'),
        ], now),
        isNull,
      );
    });

    test('list order does not decide the answer', () {
      final List<GrandPrix> reversed = seasonEvents().reversed.toList();
      expect(resolveLatestCompletedEvent(reversed, now)!.round, 12);
    });
  });

  group('resolveUpcomingEvents', () {
    test('returns the next events in the delivered order', () {
      expect(
        resolveUpcomingEvents(
          seasonEvents(),
          now,
        ).map((GrandPrix e) => e.round),
        <int>[13, 14, 15],
      );
    });

    test('the limit bounds the result', () {
      expect(
        resolveUpcomingEvents(
          seasonEvents(),
          now,
          limit: 2,
        ).map((GrandPrix e) => e.round),
        <int>[13, 14],
      );
    });

    test('a non-positive limit returns nothing', () {
      expect(resolveUpcomingEvents(seasonEvents(), now, limit: 0), isEmpty);
    });

    test('the featured round is excluded so it is never shown twice', () {
      expect(
        resolveUpcomingEvents(
          seasonEvents(),
          now,
          excludeRound: 13,
        ).map((GrandPrix e) => e.round),
        <int>[14, 15],
      );
    });

    test('a cancelled event is excluded from upcoming emphasis', () {
      final List<GrandPrix> events = <GrandPrix>[
        event(
          round: 20,
          startDate: '2026-07-24',
          endDate: '2026-07-26',
          status: EventStatus.cancelled,
        ),
        event(round: 21, startDate: '2026-07-31', endDate: '2026-08-02'),
      ];
      expect(
        resolveUpcomingEvents(events, now).map((GrandPrix e) => e.round),
        <int>[21],
      );
    });

    test('a postponed event stays visible with its own status', () {
      final List<GrandPrix> events = <GrandPrix>[
        event(
          round: 20,
          startDate: '2026-07-24',
          endDate: '2026-07-26',
          status: EventStatus.postponed,
        ),
      ];
      final List<GrandPrix> upcoming = resolveUpcomingEvents(events, now);
      expect(upcoming.single.round, 20);
      expect(upcoming.single.status, EventStatus.postponed);
    });

    test('completed and past events are excluded', () {
      expect(
        resolveUpcomingEvents(
          seasonEvents(),
          now,
        ).map((GrandPrix e) => e.round),
        isNot(contains(11)),
      );
    });

    test('an event with no start date is excluded rather than guessed at', () {
      expect(
        resolveUpcomingEvents(<GrandPrix>[event(round: 20)], now),
        isEmpty,
      );
    });

    test('a rescheduled round is listed by its date, not its round', () {
      final List<GrandPrix> events = <GrandPrix>[
        event(round: 17, startDate: '2026-11-13', endDate: '2026-11-15'),
        event(round: 18, startDate: '2026-10-23', endDate: '2026-10-25'),
        event(round: 19, startDate: '2026-10-30', endDate: '2026-11-01'),
      ];
      final DateTime october = DateTime.utc(2026, 10, 7);
      expect(
        resolveUpcomingEvents(events, october).map((GrandPrix e) => e.round),
        <int>[18, 19, 17],
      );
      // The first upcoming event is always the Calendar's next one.
      expect(resolveRelevantEvent(events, october)!.event.round, 18);
    });

    test('partial dates follow the same selection as the generator', () {
      // Round 2 has no date and only compares by round; rounds 1 and 3
      // compare by date. Mirrors the generator's season-chronology case.
      GrandPrix unknown(int round, {String? startDate, String? endDate}) =>
          calendarEntry(
            round: round,
            name: 'Round $round Grand Prix',
            status: EventStatus.unknown,
            startDate: startDate,
            endDate: endDate,
          ).grandPrix;
      final List<GrandPrix> events = <GrandPrix>[
        unknown(1, startDate: '2026-11-01', endDate: '2026-11-03'),
        unknown(2),
        unknown(3, startDate: '2026-10-01', endDate: '2026-10-03'),
      ];
      final DateTime september = DateTime.utc(2026, 9, 1);
      expect(
        resolveUpcomingEvents(events, september).map((GrandPrix e) => e.round),
        <int>[3, 1, 2],
      );
      expect(resolveRelevantEvent(events, september)!.event.round, 3);
    });

    test('the returned list is unmodifiable', () {
      expect(
        () => resolveUpcomingEvents(seasonEvents(), now).add(event(round: 99)),
        throwsUnsupportedError,
      );
    });
  });
}
