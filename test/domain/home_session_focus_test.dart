import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/home/domain/home_session_focus.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

import '../support/domain_fixtures.dart';

Session session(
  String id, {
  SessionType type = SessionType.practice1,
  DateTime? startsAt,
  SessionStatus status = SessionStatus.scheduled,
}) => Session(id: id, type: type, startTime: startsAt, status: status);

void main() {
  final DateTime now = DateTime.utc(2026, 7, 25, 12);

  group('priority', () {
    test('a live session wins over an earlier scheduled one', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('fp1', startsAt: DateTime.utc(2026, 7, 25, 14)),
        session('race', status: SessionStatus.live),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.relevance, HomeSessionRelevance.live);
      expect(focus.isLive, isTrue);
    });

    test('the latest live session wins when several claim it', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('sprint', status: SessionStatus.live),
        session('race', status: SessionStatus.live),
      ], now);

      expect(
        focus!.session.id,
        'race',
        reason: 'a later session can only be live once the earlier finished',
      );
    });

    test('the next scheduled session wins when none is live', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('fp1', startsAt: DateTime.utc(2026, 7, 25, 10)),
        session('quali', startsAt: DateTime.utc(2026, 7, 25, 16)),
        session('race', startsAt: DateTime.utc(2026, 7, 25, 14)),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.relevance, HomeSessionRelevance.next);
      expect(focus.isNext, isTrue);
    });

    test('a session starting exactly now is still "next"', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('race', startsAt: now),
      ], now);
      expect(focus!.relevance, HomeSessionRelevance.next);
    });

    test('a finished weekend falls back to the last supplied session', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('fp1', startsAt: DateTime.utc(2026, 7, 24, 10)),
        session('race', startsAt: DateTime.utc(2026, 7, 24, 14)),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.relevance, HomeSessionRelevance.latest);
    });

    test('no sessions produces no focus', () {
      expect(resolveHomeSessionFocus(const <Session>[], now), isNull);
    });
  });

  group('status handling', () {
    test('a cancelled session never becomes the focus', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session(
          'sprint',
          startsAt: DateTime.utc(2026, 7, 25, 13),
          status: SessionStatus.cancelled,
        ),
        session('race', startsAt: DateTime.utc(2026, 7, 25, 15)),
      ], now);

      expect(focus!.session.id, 'race');
    });

    test('an all-cancelled weekend produces no focus', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('fp1', status: SessionStatus.cancelled),
        session('race', status: SessionStatus.cancelled),
      ], now);
      expect(focus, isNull);
    });

    test('a postponed session stays eligible', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session(
          'race',
          startsAt: DateTime.utc(2026, 7, 25, 15),
          status: SessionStatus.postponed,
        ),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.session.status, SessionStatus.postponed);
    });

    test('an unknown session type is still selectable', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session(
          'mystery',
          type: SessionType.unknown,
          startsAt: DateTime.utc(2026, 7, 25, 15),
        ),
      ], now);

      expect(focus!.session.type, SessionType.unknown);
    });
  });

  group('missing times', () {
    test('a session with no start time cannot be "next"', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('undated'),
        session('race', startsAt: DateTime.utc(2026, 7, 25, 15)),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.relevance, HomeSessionRelevance.next);
    });

    test('an undated schedule falls back without inventing a time', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(<Session>[
        session('fp1'),
        session('race'),
      ], now);

      expect(focus!.session.id, 'race');
      expect(focus.relevance, HomeSessionRelevance.latest);
      expect(
        focus.session.startTime,
        isNull,
        reason: 'a missing time stays missing — never midnight',
      );
    });
  });

  group('weekend formats are data-driven', () {
    test('a sprint weekend selects from the delivered order', () {
      final HomeSessionFocus? focus = resolveHomeSessionFocus(
        belgianSprintSessions(),
        DateTime.utc(2026, 7, 25, 11),
      );
      expect(focus!.session.id, '2026-belgian-grand-prix-qualifying');
    });

    test('a reordered schedule is honoured exactly as delivered', () {
      final List<Session> reordered = <Session>[
        session('race', startsAt: DateTime.utc(2026, 7, 25, 15)),
        session('quali', startsAt: DateTime.utc(2026, 7, 25, 13)),
      ];
      final HomeSessionFocus? focus = resolveHomeSessionFocus(reordered, now);
      expect(
        focus!.session.id,
        'quali',
        reason: 'selection is by time, not by an assumed session sequence',
      );
    });
  });

  group('schedule window', () {
    final List<Session> five = <Session>[
      session('a'),
      session('b'),
      session('c'),
      session('d'),
      session('e'),
    ];

    test('a short schedule is returned whole, in order', () {
      final List<Session> window = homeSessionWindow(<Session>[
        session('a'),
        session('b'),
      ], session('a'));
      expect(window.map((Session s) => s.id), <String>['a', 'b']);
    });

    test('the window centres on the focus', () {
      final List<Session> window = homeSessionWindow(five, session('c'));
      expect(window.map((Session s) => s.id), <String>['b', 'c', 'd']);
    });

    test('the window clamps at the start of the schedule', () {
      final List<Session> window = homeSessionWindow(five, session('a'));
      expect(window.map((Session s) => s.id), <String>['a', 'b', 'c']);
    });

    test('the window clamps at the end of the schedule', () {
      final List<Session> window = homeSessionWindow(five, session('e'));
      expect(window.map((Session s) => s.id), <String>['c', 'd', 'e']);
    });

    test('no focus shows the first sessions of the weekend', () {
      final List<Session> window = homeSessionWindow(five, null);
      expect(window.map((Session s) => s.id), <String>['a', 'b', 'c']);
    });

    test('an empty schedule produces an empty window', () {
      expect(homeSessionWindow(const <Session>[], null), isEmpty);
    });
  });
}
