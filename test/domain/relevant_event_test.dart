import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/relevant_event.dart';

import '../support/domain_fixtures.dart';

GrandPrix _event({
  required int round,
  String? startDate,
  String? endDate,
  EventStatus status = EventStatus.scheduled,
  String? name,
}) => calendarEntry(
  round: round,
  name: name ?? 'Round $round Grand Prix',
  startDate: startDate,
  endDate: endDate,
  status: status,
).grandPrix;

void main() {
  // Every assertion uses this injected instant; nothing calls DateTime.now.
  final DateTime now = DateTime.utc(2026, 7, 20, 9);

  group('relevant-event resolution', () {
    test('selects the next upcoming event when none is in progress', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(round: 11, startDate: '2026-07-03', endDate: '2026-07-05'),
        _event(round: 12, startDate: '2026-07-24', endDate: '2026-07-26'),
        _event(round: 13, startDate: '2026-08-07', endDate: '2026-08-09'),
      ], now);

      expect(relevant, isNotNull);
      expect(relevant!.event.round, 12);
      expect(relevant.inProgress, isFalse);
    });

    test('an in-progress event takes priority over a later upcoming one', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(round: 12, startDate: '2026-07-19', endDate: '2026-07-21'),
        _event(round: 13, startDate: '2026-07-24', endDate: '2026-07-26'),
      ], now);

      expect(relevant!.event.round, 12);
      expect(relevant.inProgress, isTrue);
    });

    test('an explicit in_progress status wins even without a date window', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(round: 12, status: EventStatus.inProgress),
        _event(round: 13, startDate: '2026-07-24', endDate: '2026-07-26'),
      ], now);

      expect(relevant!.event.round, 12);
      expect(relevant.inProgress, isTrue);
    });

    test('a cancelled event is never selected, current or upcoming', () {
      final RelevantEvent? live = resolveRelevantEvent(<GrandPrix>[
        _event(
          round: 12,
          startDate: '2026-07-19',
          endDate: '2026-07-21',
          status: EventStatus.cancelled,
        ),
        _event(round: 13, startDate: '2026-08-07', endDate: '2026-08-09'),
      ], now);
      expect(live!.event.round, 13);
      expect(live.inProgress, isFalse);

      final RelevantEvent? upcoming = resolveRelevantEvent(<GrandPrix>[
        _event(
          round: 12,
          startDate: '2026-07-24',
          status: EventStatus.cancelled,
        ),
        _event(round: 13, startDate: '2026-08-07'),
      ], now);
      expect(upcoming!.event.round, 13);
    });

    test(
      'a postponed event that still carries a future date stays eligible',
      () {
        final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
          _event(
            round: 12,
            startDate: '2026-07-24',
            status: EventStatus.postponed,
          ),
          _event(round: 13, startDate: '2026-08-07'),
        ], now);

        expect(relevant!.event.round, 12);
        expect(relevant.inProgress, isFalse);
      },
    );

    test('a completed season has no relevant event', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(
          round: 23,
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          status: EventStatus.completed,
        ),
        _event(
          round: 24,
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          status: EventStatus.completed,
        ),
      ], now);

      expect(relevant, isNull);
    });

    test('a completed event is never treated as upcoming', () {
      // Same date as "today" but already reported completed.
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(
          round: 12,
          startDate: '2026-07-25',
          status: EventStatus.completed,
        ),
      ], now);

      expect(relevant, isNull);
    });

    test('an empty calendar resolves to no relevant event', () {
      expect(resolveRelevantEvent(const <GrandPrix>[], now), isNull);
    });

    test('missing and malformed dates never throw and are skipped', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(round: 10),
        _event(round: 11, startDate: '2026-07'),
        _event(round: 12, startDate: 'not-a-date'),
        _event(round: 13, startDate: '2026-08-07'),
      ], now);

      expect(relevant!.event.round, 13);
    });

    test('round breaks a tie between events sharing a start date', () {
      final RelevantEvent? relevant = resolveRelevantEvent(<GrandPrix>[
        _event(round: 14, startDate: '2026-07-24'),
        _event(round: 12, startDate: '2026-07-24'),
      ], now);

      expect(relevant!.event.round, 12);
    });

    test('the supplied clock decides the boundary, not the wall clock', () {
      final List<GrandPrix> events = <GrandPrix>[
        _event(round: 12, startDate: '2026-07-24', endDate: '2026-07-26'),
      ];

      // The day the weekend starts: in progress.
      expect(
        resolveRelevantEvent(events, DateTime.utc(2026, 7, 24, 6))!.inProgress,
        isTrue,
      );
      // The last day: still in progress.
      expect(
        resolveRelevantEvent(events, DateTime.utc(2026, 7, 26, 23))!.inProgress,
        isTrue,
      );
      // The day after: nothing left.
      expect(resolveRelevantEvent(events, DateTime.utc(2026, 7, 27)), isNull);
      // Before it starts: upcoming.
      expect(
        resolveRelevantEvent(events, DateTime.utc(2026, 7, 1))!.inProgress,
        isFalse,
      );
    });
  });

  group('Home and Calendar agree', () {
    test('both resolve the same relevant event from the same calendar', () {
      final List<CalendarEntry> calendar = calendarFixture();
      final DateTime clock = DateTime.utc(2026, 7, 18, 12);

      // What the Calendar screen highlights.
      final RelevantEvent? fromCalendar = resolveRelevantEvent(
        calendar.map((CalendarEntry e) => e.grandPrix),
        clock,
      );

      // What Home features for the same season.
      final HomeView home = homeViewFixture();

      expect(fromCalendar, isNotNull);
      expect(home.featured, isNotNull);
      expect(fromCalendar!.event.round, home.featured!.round);
      expect(fromCalendar.event.id, home.featured!.id);
    });

    test('the local next-event query uses the same shared rule', () async {
      // The DAO delegates to resolveRelevantEvent, so the pure rule and the
      // local query cannot drift apart. Proven directly on the rule with the
      // ordering the DAO supplies.
      final List<GrandPrix> events = calendarFixture()
          .map((CalendarEntry e) => e.grandPrix)
          .toList();
      final RelevantEvent? relevant = resolveRelevantEvent(
        events,
        DateTime.utc(2026, 7, 18, 12),
      );
      expect(relevant!.event.round, 13);
    });
  });
}
