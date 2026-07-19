import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/freshness.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

/// Deterministic domain fixtures for the vertical-slice tests. These mirror the
/// shared edge-API fixtures (Belgian GP round 13, sprint; Italian GP round 12,
/// standard) but are expressed as domain entities.

Season season2026({
  SeasonStatus status = SeasonStatus.active,
  int currentRound = 13,
  bool isCurrent = true,
}) => Season(
  year: 2026,
  label: '2026 FIA Formula One World Championship',
  status: status,
  startDate: '2026-03-08',
  endDate: '2026-11-22',
  roundCount: 24,
  currentRound: currentRound,
  isCurrent: isCurrent,
);

Circuit circuitSpa() => const Circuit(
  id: 'spa-francorchamps',
  name: 'Circuit de Spa-Francorchamps',
  locality: 'Spa',
  country: 'Belgium',
  countryCode: 'BE',
);

Session raceSessionBelgian({SessionStatus status = SessionStatus.scheduled}) =>
    Session(
      id: '2026-belgian-grand-prix-race',
      type: SessionType.race,
      name: 'Race',
      startTime: DateTime.utc(2026, 7, 26, 13),
      status: status,
    );

/// The Belgian GP (round 13, sprint). [sessions] defaults to the featured race
/// session only, matching what the Home snapshot supplies.
GrandPrix belgianGrandPrix({
  List<Session>? sessions,
  EventStatus status = EventStatus.upcoming,
  bool hasResults = false,
  String? officialName,
}) => GrandPrix(
  id: '2026-belgian-grand-prix',
  season: 2026,
  round: 13,
  eventSlug: 'belgian-grand-prix',
  name: 'Belgian Grand Prix',
  officialName: officialName,
  circuitId: 'spa-francorchamps',
  status: status,
  format: WeekendFormat.sprint,
  startDate: '2026-07-24',
  endDate: '2026-07-26',
  timezone: 'Europe/Brussels',
  sessions: sessions ?? <Session>[raceSessionBelgian()],
  hasResults: hasResults,
);

/// The full ordered sprint-weekend session list for the Belgian GP.
List<Session> belgianSprintSessions() => <Session>[
  Session(
    id: '2026-belgian-grand-prix-practice-1',
    type: SessionType.practice1,
    name: 'Practice 1',
    startTime: DateTime.utc(2026, 7, 24, 10, 30),
    status: SessionStatus.scheduled,
  ),
  Session(
    id: '2026-belgian-grand-prix-sprint-qualifying',
    type: SessionType.sprintQualifying,
    name: 'Sprint Qualifying',
    startTime: DateTime.utc(2026, 7, 24, 14, 30),
    status: SessionStatus.scheduled,
  ),
  Session(
    id: '2026-belgian-grand-prix-sprint',
    type: SessionType.sprint,
    name: 'Sprint',
    startTime: DateTime.utc(2026, 7, 25, 10),
    status: SessionStatus.scheduled,
  ),
  Session(
    id: '2026-belgian-grand-prix-qualifying',
    type: SessionType.qualifying,
    name: 'Qualifying',
    startTime: DateTime.utc(2026, 7, 25, 14),
    status: SessionStatus.scheduled,
  ),
  raceSessionBelgian(),
];

DataFreshness freshness({
  required DateTime generatedAt,
  DateTime? staleAfter,
  DateTime? sourceUpdatedAt,
  String? contentVersion = '2026.07.18.1',
  bool? stale = false,
}) => DataFreshness(
  generatedAt: generatedAt,
  sourceUpdatedAt: sourceUpdatedAt,
  staleAfter: staleAfter,
  contentVersion: contentVersion,
  stale: stale,
);

/// A fresh-by-default Home view aggregate for widget tests.
HomeView homeViewFixture({DataFreshness? withFreshness}) => HomeView(
  featured: belgianGrandPrix(sessions: <Session>[raceSessionBelgian()]),
  circuit: circuitSpa(),
  freshness:
      withFreshness ??
      freshness(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
);

/// A fresh-by-default Grand Prix detail aggregate for (season, round), with the
/// full sprint-weekend session list.
GrandPrixDetailView grandPrixDetailFixture(
  int season,
  int round, {
  DataFreshness? withFreshness,
}) => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '$season-belgian-grand-prix',
    season: season,
    round: round,
    eventSlug: 'belgian-grand-prix',
    name: 'Belgian Grand Prix',
    circuitId: 'spa-francorchamps',
    status: EventStatus.upcoming,
    format: WeekendFormat.sprint,
    startDate: '2026-07-24',
    endDate: '2026-07-26',
    timezone: 'Europe/Brussels',
    sessions: belgianSprintSessions(),
    hasResults: false,
  ),
  circuit: circuitSpa(),
  freshness:
      withFreshness ??
      freshness(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
);
