import 'package:freezed_annotation/freezed_annotation.dart';

part 'result_dto.freezed.dart';
part 'result_dto.g.dart';

@freezed
abstract class FastestLapDto with _$FastestLapDto {
  const factory FastestLapDto({String? driverId, int? timeMillis, int? lap}) =
      _FastestLapDto;

  factory FastestLapDto.fromJson(Map<String, dynamic> json) =>
      _$FastestLapDtoFromJson(json);
}

@freezed
abstract class RaceResultEntryDto with _$RaceResultEntryDto {
  const factory RaceResultEntryDto({
    required String driverId,
    required String constructorId,
    int? position,
    int? gridPosition,
    double? points,
    required String status,
    int? laps,
    int? elapsedTimeMillis,
    int? gapToLeaderMillis,
    int? lapsBehind,
    bool? fastestLap,
    String? dnfReason,
    String? gapText,
  }) = _RaceResultEntryDto;

  factory RaceResultEntryDto.fromJson(Map<String, dynamic> json) =>
      _$RaceResultEntryDtoFromJson(json);
}

@freezed
abstract class RaceResultDto with _$RaceResultDto {
  const factory RaceResultDto({
    required String id,
    required int season,
    required int round,
    required String grandPrixId,
    required String sessionType,
    required String status,
    required List<RaceResultEntryDto> entries,
    FastestLapDto? fastestLap,
  }) = _RaceResultDto;

  factory RaceResultDto.fromJson(Map<String, dynamic> json) =>
      _$RaceResultDtoFromJson(json);
}
