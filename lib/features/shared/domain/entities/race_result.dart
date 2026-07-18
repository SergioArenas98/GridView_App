import 'enums.dart';

class FastestLap {
  const FastestLap({this.driverId, this.time, this.lap});

  final String? driverId;
  final Duration? time;
  final int? lap;
}

/// One classification row. Timing is structured: [elapsedTime]/[gapToLeader] are
/// durations and [lapsBehind] is a whole-lap count. [gapText] is an optional
/// display fallback only.
class RaceResultEntry {
  const RaceResultEntry({
    required this.driverId,
    required this.constructorId,
    this.position,
    this.gridPosition,
    this.points,
    required this.status,
    this.laps,
    this.elapsedTime,
    this.gapToLeader,
    this.lapsBehind,
    this.fastestLap,
    this.dnfReason,
    this.gapText,
  });

  final String driverId;
  final String constructorId;
  final int? position;
  final int? gridPosition;
  final double? points;
  final FinishStatus status;
  final int? laps;
  final Duration? elapsedTime;
  final Duration? gapToLeader;
  final int? lapsBehind;
  final bool? fastestLap;
  final String? dnfReason;
  final String? gapText;
}

/// The classification for a points-awarding session (race or sprint). A
/// not-yet-run session is [ResultStatus.unavailable] with empty [entries].
class RaceResult {
  const RaceResult({
    required this.id,
    required this.season,
    required this.round,
    required this.grandPrixId,
    required this.sessionType,
    required this.status,
    required this.entries,
    this.fastestLap,
  });

  final String id;
  final int season;
  final int round;
  final String grandPrixId;
  final SessionType sessionType;
  final ResultStatus status;
  final List<RaceResultEntry> entries;
  final FastestLap? fastestLap;
}
