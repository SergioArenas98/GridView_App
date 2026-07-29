import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/home/domain/home_session_focus.dart';
import 'package:gridview/features/home/domain/home_temporal_state.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

import '../support/domain_fixtures.dart';

/// The temporal resolver is pure and clock-injected: every case below pins an
/// explicit UTC instant, and none of them can pass by reading the host clock.
void main() {
  // Belgian GP weekend is 2026-07-24 .. 2026-07-26.
  final DateTime beforeWeekend = DateTime.utc(2026, 7, 18, 12);
  final DateTime duringWeekend = DateTime.utc(2026, 7, 25, 12);
  final DateTime afterWeekend = DateTime.utc(2026, 8, 1, 12);

  HomeTemporalPhase phaseOf(
    GrandPrix event, {
    required DateTime now,
    HomeSessionFocus? sessionFocus,
  }) => resolveHomeTemporalPhase(
    event: event,
    sessionFocus: sessionFocus,
    now: now,
  );

  group('pre-event', () {
    test('an upcoming event before its weekend is pre-event', () {
      expect(
        phaseOf(belgianGrandPrix(), now: beforeWeekend),
        HomeTemporalPhase.preEvent,
      );
    });

    test('a scheduled event before its weekend is pre-event', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.scheduled),
          now: beforeWeekend,
        ),
        HomeTemporalPhase.preEvent,
      );
    });
  });

  group('race weekend', () {
    test('a live session wins over every date consideration', () {
      final Session live = Session(
        id: 's-live',
        type: SessionType.race,
        startTime: DateTime.utc(2026, 7, 18, 13),
        status: SessionStatus.live,
      );
      expect(
        phaseOf(
          belgianGrandPrix(),
          now: beforeWeekend,
          sessionFocus: const HomeSessionFocus(
            session: Session(
              id: 's-live',
              type: SessionType.race,
              status: SessionStatus.live,
            ),
            relevance: HomeSessionRelevance.live,
          ),
        ),
        HomeTemporalPhase.raceWeekend,
        reason: 'authoritative live status outranks the calendar dates',
      );
      expect(live.status, SessionStatus.live);
    });

    test('an in-progress event with no live session is a race weekend', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.inProgress),
          now: beforeWeekend,
        ),
        HomeTemporalPhase.raceWeekend,
      );
    });

    test('today inside the weekend window is a race weekend', () {
      expect(
        phaseOf(belgianGrandPrix(), now: duringWeekend),
        HomeTemporalPhase.raceWeekend,
      );
    });

    test('the first and last day of the window are inclusive', () {
      expect(
        phaseOf(belgianGrandPrix(), now: DateTime.utc(2026, 7, 24)),
        HomeTemporalPhase.raceWeekend,
      );
      expect(
        phaseOf(belgianGrandPrix(), now: DateTime.utc(2026, 7, 26, 23, 59)),
        HomeTemporalPhase.raceWeekend,
      );
      expect(
        phaseOf(belgianGrandPrix(), now: DateTime.utc(2026, 7, 27)),
        HomeTemporalPhase.preEvent,
        reason: 'the day after the window is no longer a race weekend',
      );
    });
  });

  group('post-race', () {
    test('a completed focus is post-race', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.completed),
          now: afterWeekend,
        ),
        HomeTemporalPhase.postRace,
      );
    });

    test('a completed focus stays post-race inside its own date window', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.completed),
          now: duringWeekend,
        ),
        HomeTemporalPhase.postRace,
        reason: 'the authoritative status is not overridden by the dates',
      );
    });
  });

  group('safe presentation of unusual data', () {
    test('an unknown status never throws and never claims a weekend', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.unknown),
          now: beforeWeekend,
        ),
        HomeTemporalPhase.preEvent,
      );
    });

    test('a postponed event keeps a safe phase', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.postponed),
          now: beforeWeekend,
        ),
        HomeTemporalPhase.preEvent,
      );
    });

    test('a cancelled focus does not become completed', () {
      expect(
        phaseOf(
          belgianGrandPrix(status: EventStatus.cancelled),
          now: afterWeekend,
        ),
        HomeTemporalPhase.preEvent,
        reason: 'its cancelled status is what the card shows, not the phase',
      );
    });

    test('missing dates resolve without throwing', () {
      expect(
        phaseOf(
          belgianGrandPrix(startDate: null, endDate: null),
          now: duringWeekend,
        ),
        HomeTemporalPhase.preEvent,
      );
    });

    test('a malformed date is ignored rather than guessed at', () {
      expect(
        phaseOf(
          belgianGrandPrix(startDate: '2026-07', endDate: 'not-a-date'),
          now: duringWeekend,
        ),
        HomeTemporalPhase.preEvent,
      );
    });

    test('a start date with no end date uses the start as the window', () {
      expect(
        phaseOf(
          belgianGrandPrix(startDate: '2026-07-25', endDate: null),
          now: duringWeekend,
        ),
        HomeTemporalPhase.raceWeekend,
      );
    });
  });
}
