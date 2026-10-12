import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/home/domain/home_session_focus.dart';
import 'package:gridview/features/home/domain/home_temporal_state.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/relevant_event.dart';

import '../support/domain_fixtures.dart';

/// The phone side of the shared cross-layer chronology cases
/// (`test/fixtures/chronology/cross_layer_cases.json`). The Edge API test
/// `services/edge-api/test/snapshots/cross-layer-chronology.test.ts` holds the
/// generator to each case's `server` block; this test writes exactly what the
/// phone would store from those documents and holds Home and the Calendar to
/// its `phone` block (ADR 0022 A11).
///
/// What the phone stores, and nothing more: the calendar summaries (no
/// sessions), the Season row with the published `currentRound`, the Home focus
/// with its race session, and race sessions only for the Grand Prix screens
/// listed in `phone.storedRaceRounds`. Every race time is never assumed.
void main() {
  final Map<String, dynamic> fixture =
      jsonDecode(
            File(
              'test/fixtures/chronology/cross_layer_cases.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  final List<Map<String, dynamic>> cases = (fixture['cases'] as List<dynamic>)
      .cast<Map<String, dynamic>>();

  GrandPrix grandPrix(Map<String, dynamic> event, {required bool withRace}) {
    final int round = event['round'] as int;
    final String id = '2026-round-$round-grand-prix';
    final String? race = event['race'] as String?;
    return calendarEntry(
      round: round,
      name: 'Round $round Grand Prix',
      status: EventStatus.fromWire(event['status'] as String),
      hasResults: event['hasResults'] as bool,
      startDate: event['startDate'] as String?,
      endDate: event['endDate'] as String?,
      sessions: withRace && race != null
          ? <Session>[
              Session(
                id: '$id-race',
                type: SessionType.race,
                startTime: DateTime.parse(race),
                status: SessionStatus.unknown,
              ),
            ]
          : const <Session>[],
    ).grandPrix;
  }

  test('the shared cases are present', () {
    expect(cases.length, greaterThanOrEqualTo(4));
  });

  for (final Map<String, dynamic> testCase in cases) {
    test(testCase['name'] as String, () async {
      final DateTime now = DateTime.parse(
        testCase['referenceInstant'] as String,
      );
      final Map<String, dynamic> server =
          testCase['server'] as Map<String, dynamic>;
      final Map<String, dynamic> phone =
          testCase['phone'] as Map<String, dynamic>;
      final List<Map<String, dynamic>> events =
          (testCase['events'] as List<dynamic>).cast<Map<String, dynamic>>();
      final Set<int> storedRaceRounds =
          (phone['storedRaceRounds'] as List<dynamic>).cast<int>().toSet();
      final int? featuredRound = server['featuredRound'] as int?;

      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      await db.seasonDao.upsertSeason(
        Season(
          year: 2026,
          status: SeasonStatus.active,
          isCurrent: true,
          currentRound: server['currentRound'] as int?,
        ),
      );
      // The calendar collection: summaries only, no sessions.
      await db.calendarDao.replaceCalendar(2026, <GrandPrix>[
        for (final Map<String, dynamic> e in events)
          grandPrix(e, withRace: false),
      ], const <Circuit>[]);
      // Grand Prix screens the user opened store their sessions.
      for (final Map<String, dynamic> e in events) {
        if (!storedRaceRounds.contains(e['round'])) continue;
        await db.verticalSliceDao.writeGrandPrixSnapshot(
          grandPrix: grandPrix(e, withRace: true),
          freshness: freshness(generatedAt: now),
          force: true,
        );
      }
      // The Home snapshot: the featured event with its race session.
      await db.verticalSliceDao.writeHomeSnapshot(
        homeSeason: 2026,
        featured: featuredRound == null
            ? null
            : grandPrix(
                events.firstWhere(
                  (Map<String, dynamic> e) => e['round'] == featuredRound,
                ),
                withRace: true,
              ),
        freshness: freshness(generatedAt: now),
        force: true,
      );

      final HomeDashboardView view = (await db.homeDashboardDao.readDashboard(
        now,
      ))!;
      final List<GrandPrix> calendar = await db.calendarDao.calendar(2026);
      final RelevantEvent? calendarRelevant = resolveRelevantEvent(
        calendar,
        now,
        seasonCurrentRound: server['currentRound'] as int?,
      );

      expect(view.focus?.round, phone['homeFocusRound'], reason: 'Home focus');
      expect(
        view.upcoming.map((CalendarEntry e) => e.round).toList(),
        phone['homeUpcomingRounds'],
        reason: 'Home upcoming',
      );
      expect(
        (await db.calendarDao.nextEvent(2026, now))?.round,
        phone['calendarNextRound'],
        reason: 'CalendarDao.nextEvent',
      );
      expect(calendarRelevant?.event.round, phone['calendarNextRound']);
      expect(calendarRelevant?.inProgress, phone['calendarInProgress']);
      expect(
        view.latestCompleted?.round,
        phone['latestRound'],
        reason: 'latest result',
      );
      // Home and the Calendar always agree on the next event, and Home's first
      // upcoming event never precedes it.
      expect(view.focus?.round, calendarRelevant?.event.round);

      // No published status is rewritten on the way through.
      for (final GrandPrix stored in calendar) {
        final Map<String, dynamic> source = events.firstWhere(
          (Map<String, dynamic> e) => e['round'] == stored.round,
        );
        expect(stored.status.wire, source['status']);
      }
      final HomeFocus? focus = view.focus;
      if (focus != null && !isEventSettled(focus.grandPrix)) {
        expect(
          resolveHomeTemporalPhase(
            event: focus.grandPrix,
            sessionFocus: resolveHomeSessionFocus(focus.sessions, now),
            now: now,
          ),
          isNot(HomeTemporalPhase.postRace),
        );
      }
    });
  }
}
