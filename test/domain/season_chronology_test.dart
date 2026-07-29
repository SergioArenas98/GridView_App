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
      expect(
        resolveLatestCompletedEvent(seasonEvents(), DateTime.utc(2026, 1, 1)),
        isNull,
      );
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

    test('the returned list is unmodifiable', () {
      expect(
        () => resolveUpcomingEvents(seasonEvents(), now).add(event(round: 99)),
        throwsUnsupportedError,
      );
    });
  });
}
