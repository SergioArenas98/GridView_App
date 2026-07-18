import '../../../../core/api/dto/result_dto.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/race_result.dart';
import 'wire.dart';

FastestLap? fastestLapFromDto(FastestLapDto? dto) => dto == null
    ? null
    : FastestLap(
        driverId: dto.driverId,
        time: durationFromMillis(dto.timeMillis),
        lap: dto.lap,
      );

RaceResultEntry raceResultEntryFromDto(RaceResultEntryDto dto) =>
    RaceResultEntry(
      driverId: dto.driverId,
      constructorId: dto.constructorId,
      position: dto.position,
      gridPosition: dto.gridPosition,
      points: dto.points,
      status: FinishStatus.fromWire(dto.status),
      laps: dto.laps,
      elapsedTime: durationFromMillis(dto.elapsedTimeMillis),
      gapToLeader: durationFromMillis(dto.gapToLeaderMillis),
      lapsBehind: dto.lapsBehind,
      fastestLap: dto.fastestLap,
      dnfReason: dto.dnfReason,
      gapText: dto.gapText,
    );

RaceResult raceResultFromDto(RaceResultDto dto) => RaceResult(
  id: dto.id,
  season: dto.season,
  round: dto.round,
  grandPrixId: dto.grandPrixId,
  sessionType: SessionType.fromWire(dto.sessionType),
  status: ResultStatus.fromWire(dto.status),
  entries: dto.entries.map(raceResultEntryFromDto).toList(),
  fastestLap: fastestLapFromDto(dto.fastestLap),
);
