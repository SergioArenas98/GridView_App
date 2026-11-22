// Review-only Grand Prix Detail fixtures (Step 55C.12, owner decision XS-13).
//
// SYNTHETIC TEST DATA. Every driver and team name below starts "Synthetic" and
// is invented; no position, time, gap or point value is a real-world result.
// It exists only to judge full-field density, wrapping, scrolling and keyboard
// focus of the Primer V2 classification. It is not a production fixture, is
// never bundled with the app and changes no race data or API contract: it is
// built from the existing `RaceResult` / `RaceResultEntry` domain types
// through the shared `raceResultFixture` helper.
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';

import 'domain_fixtures.dart';

/// Number of entries in [syntheticFullFieldRace].
const int syntheticFullFieldSize = 23;

/// A synthetic 23-entry race classification exercising, in delivered order:
/// - a single resolved P1 (the confirmed winner) and typical finishers with
///   elapsed time, gaps and whole points;
/// - fractional points (12.5, 0.5) and missing points (no false zero);
/// - two entries sharing displayed position 14, rendered as delivered;
/// - lapped finishers (+1 / +2 laps) and a supplied gap-text fallback;
/// - DNF, DNS, DSQ, DNQ and an unknown finish, each without a position;
/// - very long driver and team names, and one unresolved driver name and
///   one unresolved team name (localized fallbacks, ids keep navigating);
/// - a document-level fastest lap held by a non-winner.
RaceResult syntheticFullFieldRace({int season = 2026, int round = 13}) {
  RaceResultEntry finisher(
    int index,
    int? position, {
    String? driverName,
    String? teamName,
    double? points,
    Duration? elapsed,
    Duration? gap,
    int? lapsBehind,
    String? gapText,
    FinishStatus status = FinishStatus.finished,
    bool unresolvedDriver = false,
    bool unresolvedTeam = false,
  }) => RaceResultEntry(
    driverId: 'synthetic-driver-$index',
    constructorId: 'synthetic-team-${(index + 1) ~/ 2}',
    driverName: unresolvedDriver
        ? null
        : driverName ?? 'Synthetic Driver ${_letters[index - 1]}',
    constructorName: unresolvedTeam
        ? null
        : teamName ?? 'Synthetic Team ${(index + 1) ~/ 2}',
    position: position,
    points: points,
    status: status,
    elapsedTime: elapsed,
    gapToLeader: gap,
    lapsBehind: lapsBehind,
    gapText: gapText,
  );

  Duration secs(int s, [int ms = 0]) => Duration(seconds: s, milliseconds: ms);

  return raceResultFixture(
    sessionType: SessionType.race,
    season: season,
    round: round,
    fastestLap: const FastestLap(driverId: 'synthetic-driver-4', lap: 41),
    entries: <RaceResultEntry>[
      finisher(
        1,
        1,
        points: 25,
        elapsed: const Duration(
          hours: 1,
          minutes: 24,
          seconds: 51,
          milliseconds: 207,
        ),
      ),
      finisher(2, 2, points: 18, gap: secs(2, 114)),
      finisher(
        3,
        3,
        driverName: 'Synthetic Maximilian Alexander von Hohenzollern-Lindqvist',
        points: 15,
        gap: secs(7, 980),
      ),
      finisher(4, 4, points: 12.5, gap: secs(12, 45)),
      finisher(5, 5, points: 10, gap: secs(18, 302)),
      finisher(
        6,
        6,
        teamName:
            'Synthetic Extraordinarily Long Constructor Name Formula One Team',
        points: 8,
        gap: secs(24, 777),
      ),
      finisher(7, 7, points: 6, gap: secs(31, 9)),
      finisher(8, 8, points: 4, gap: secs(36, 450)),
      finisher(9, 9, points: 2, gap: secs(44, 618)),
      finisher(10, 10, points: 0.5, gap: secs(51, 3)),
      finisher(11, 11, gap: secs(58, 240)),
      finisher(12, 12, unresolvedDriver: true, gap: secs(63, 801)),
      finisher(13, 13, unresolvedTeam: true, gap: secs(70, 15)),
      finisher(14, 14, gap: secs(77, 500)),
      finisher(15, 14, gap: secs(77, 500)),
      finisher(16, 16, status: FinishStatus.lapped, lapsBehind: 1),
      finisher(17, 17, status: FinishStatus.lapped, lapsBehind: 2),
      finisher(18, 18, gapText: '+1 Lap'),
      finisher(19, null, status: FinishStatus.dnf),
      finisher(20, null, status: FinishStatus.dsq),
      finisher(21, null, status: FinishStatus.dns),
      finisher(22, null, status: FinishStatus.dnq),
      finisher(23, null, status: FinishStatus.unknown),
    ],
  );
}

const List<String> _letters = <String>[
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
];
