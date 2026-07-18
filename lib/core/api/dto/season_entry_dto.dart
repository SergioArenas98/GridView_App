import 'package:freezed_annotation/freezed_annotation.dart';

part 'season_entry_dto.freezed.dart';
part 'season_entry_dto.g.dart';

@freezed
abstract class DriverSeasonEntryDto with _$DriverSeasonEntryDto {
  const factory DriverSeasonEntryDto({
    required String id,
    required int season,
    required String driverId,
    required String constructorId,
    int? raceNumber,
    String? role,
    String? shortCode,
    int? startRound,
    int? endRound,
  }) = _DriverSeasonEntryDto;

  factory DriverSeasonEntryDto.fromJson(Map<String, dynamic> json) =>
      _$DriverSeasonEntryDtoFromJson(json);
}

@freezed
abstract class ConstructorSeasonEntryDto with _$ConstructorSeasonEntryDto {
  const factory ConstructorSeasonEntryDto({
    required String id,
    required int season,
    required String constructorId,
    String? fullName,
    String? shortName,
    String? colorPrimary,
    String? colorSecondary,
    String? powerUnit,
    String? teamPrincipal,
    String? base,
    String? chassis,
    List<String>? driverLineup,
  }) = _ConstructorSeasonEntryDto;

  factory ConstructorSeasonEntryDto.fromJson(Map<String, dynamic> json) =>
      _$ConstructorSeasonEntryDtoFromJson(json);
}
