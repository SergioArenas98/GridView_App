import 'package:freezed_annotation/freezed_annotation.dart';

import 'circuit_dto.dart';
import 'constructor_dto.dart';
import 'driver_dto.dart';
import 'event_dto.dart';
import 'season_entry_dto.dart';
import 'standing_dto.dart';
import 'summary_dto.dart';

part 'detail_dto.freezed.dart';
part 'detail_dto.g.dart';

@freezed
abstract class DriverDetailDto with _$DriverDetailDto {
  const factory DriverDetailDto({
    required DriverDto driver,
    DriverSeasonEntryDto? seasonEntry,
    ConstructorSummaryDto? constructor,
    DriverStandingDto? standing,
  }) = _DriverDetailDto;

  factory DriverDetailDto.fromJson(Map<String, dynamic> json) =>
      _$DriverDetailDtoFromJson(json);
}

@freezed
abstract class ConstructorDetailDto with _$ConstructorDetailDto {
  const factory ConstructorDetailDto({
    required ConstructorDto constructor,
    ConstructorSeasonEntryDto? seasonEntry,
    ConstructorStandingDto? standing,
    List<DriverSummaryDto>? lineup,
  }) = _ConstructorDetailDto;

  factory ConstructorDetailDto.fromJson(Map<String, dynamic> json) =>
      _$ConstructorDetailDtoFromJson(json);
}

@freezed
abstract class CircuitDetailDto with _$CircuitDetailDto {
  const factory CircuitDetailDto({
    required CircuitDto circuit,
    GrandPrixSummaryDto? grandPrix,
  }) = _CircuitDetailDto;

  factory CircuitDetailDto.fromJson(Map<String, dynamic> json) =>
      _$CircuitDetailDtoFromJson(json);
}
