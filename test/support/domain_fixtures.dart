import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/freshness.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/season.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

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

/// Builds a domain [DataFreshness]. A real snapshot always carries a source
/// revision, so [sourceUpdatedAt] defaults to [generatedAt] when not given.
/// Tests that need the contract-invalid "no source" case build [DataFreshness]
/// directly instead of calling this helper.
DataFreshness freshness({
  required DateTime generatedAt,
  DateTime? staleAfter,
  DateTime? sourceUpdatedAt,
  String? contentVersion = '2026.07.18.1',
  bool? stale = false,
}) => DataFreshness(
  generatedAt: generatedAt,
  sourceUpdatedAt: sourceUpdatedAt ?? generatedAt,
  staleAfter: staleAfter,
  contentVersion: contentVersion,
  stale: stale,
);

/// A fresh-by-default Home view aggregate for widget tests.
HomeView homeViewFixture({
  DataFreshness? withFreshness,
  int seasonYear = 2026,
}) => HomeView(
  seasonYear: seasonYear,
  featured: belgianGrandPrix(sessions: <Session>[raceSessionBelgian()]),
  circuit: circuitSpa(),
  freshness:
      withFreshness ??
      freshness(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
);

/// A calendar entry for a season/round with explicit dates and status, so a
/// test can pin exactly which event the relevant-event rule should select.
CalendarEntry calendarEntry({
  required int round,
  required String name,
  int season = 2026,
  String? startDate,
  String? endDate,
  EventStatus status = EventStatus.scheduled,
  WeekendFormat format = WeekendFormat.standard,
  Circuit? circuit,
  String circuitId = 'spa-francorchamps',
  bool hasResults = false,
  List<Session> sessions = const <Session>[],
}) => CalendarEntry(
  grandPrix: GrandPrix(
    id: '$season-${name.toLowerCase().replaceAll(' ', '-')}',
    season: season,
    round: round,
    eventSlug: name.toLowerCase().replaceAll(' ', '-'),
    name: name,
    circuitId: circuit?.id ?? circuitId,
    status: status,
    format: format,
    startDate: startDate,
    endDate: endDate,
    timezone: 'Europe/Brussels',
    sessions: sessions,
    hasResults: hasResults,
  ),
  circuit: circuit,
);

/// A small but realistic season calendar: two completed rounds, the Belgian GP
/// (round 13, sprint) upcoming, then two later rounds.
List<CalendarEntry> calendarFixture({int season = 2026}) => <CalendarEntry>[
  calendarEntry(
    season: season,
    round: 11,
    name: 'British Grand Prix',
    startDate: '2026-07-03',
    endDate: '2026-07-05',
    status: EventStatus.completed,
    circuit: const Circuit(
      id: 'silverstone',
      name: 'Silverstone Circuit',
      locality: 'Silverstone',
      country: 'United Kingdom',
    ),
    hasResults: true,
  ),
  calendarEntry(
    season: season,
    round: 12,
    name: 'Italian Grand Prix',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    status: EventStatus.completed,
    circuit: const Circuit(id: 'monza', name: 'Monza', country: 'Italy'),
    hasResults: true,
  ),
  calendarEntry(
    season: season,
    round: 13,
    name: 'Belgian Grand Prix',
    startDate: '2026-07-24',
    endDate: '2026-07-26',
    status: EventStatus.upcoming,
    format: WeekendFormat.sprint,
    circuit: circuitSpa(),
  ),
  calendarEntry(
    season: season,
    round: 14,
    name: 'Hungarian Grand Prix',
    startDate: '2026-08-07',
    endDate: '2026-08-09',
    circuit: const Circuit(
      id: 'hungaroring',
      name: 'Hungaroring',
      locality: 'Mogyoród',
      country: 'Hungary',
    ),
  ),
  calendarEntry(
    season: season,
    round: 15,
    name: 'Dutch Grand Prix',
    startDate: '2026-08-21',
    endDate: '2026-08-23',
    circuit: const Circuit(id: 'zandvoort', name: 'Zandvoort'),
  ),
];

/// Synchronization metadata for a resource that synchronised successfully.
ResourceSyncState syncedMetadata(
  String key, {
  DateTime? lastSuccessAt,
  DateTime? staleAfter,
  bool? serverStale = false,
  int? season = 2026,
}) => ResourceSyncState(
  resourceKey: key,
  season: season,
  etag: 'W/"$key"',
  generatedAt: lastSuccessAt ?? DateTime.utc(2026, 7, 18, 12),
  sourceUpdatedAt: lastSuccessAt ?? DateTime.utc(2026, 7, 18, 12),
  staleAfter: staleAfter,
  lastAttemptAt: lastSuccessAt ?? DateTime.utc(2026, 7, 18, 12),
  lastSuccessAt: lastSuccessAt ?? DateTime.utc(2026, 7, 18, 12),
  serverStale: serverStale,
);

/// A classification document for (season, round) with [entries] in the exact
/// order supplied.
RaceResult raceResultFixture({
  required SessionType sessionType,
  required List<RaceResultEntry> entries,
  int season = 2026,
  int round = 13,
  ResultStatus status = ResultStatus.finalResult,
  FastestLap? fastestLap,
}) => RaceResult(
  id: '$season-belgian-grand-prix-${sessionType.wire}',
  season: season,
  round: round,
  grandPrixId: '$season-belgian-grand-prix',
  sessionType: sessionType,
  status: status,
  entries: entries,
  fastestLap: fastestLap,
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
