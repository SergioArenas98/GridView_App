import 'package:freezed_annotation/freezed_annotation.dart';

part 'summary_dto.freezed.dart';
part 'summary_dto.g.dart';

@freezed
abstract class DriverSummaryDto with _$DriverSummaryDto {
  const factory DriverSummaryDto({
    required String id,
    required String fullName,
    String? shortCode,
    int? permanentNumber,
    String? countryCode,
  }) = _DriverSummaryDto;

  factory DriverSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$DriverSummaryDtoFromJson(json);
}

@freezed
abstract class ConstructorSummaryDto with _$ConstructorSummaryDto {
  const factory ConstructorSummaryDto({
    required String id,
    required String name,
    String? shortName,
    String? colorPrimary,
  }) = _ConstructorSummaryDto;

  factory ConstructorSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$ConstructorSummaryDtoFromJson(json);
}

@freezed
abstract class CircuitSummaryDto with _$CircuitSummaryDto {
  const factory CircuitSummaryDto({
    required String id,
    required String name,
    String? locality,
    String? countryCode,
  }) = _CircuitSummaryDto;

  factory CircuitSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$CircuitSummaryDtoFromJson(json);
}

@freezed
abstract class SeasonDriverSummaryDto with _$SeasonDriverSummaryDto {
  const factory SeasonDriverSummaryDto({
    required String driverId,
    required String fullName,
    String? shortCode,
    int? permanentNumber,
    int? raceNumber,
    String? countryCode,
    required String constructorId,
    String? role,
  }) = _SeasonDriverSummaryDto;

  factory SeasonDriverSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$SeasonDriverSummaryDtoFromJson(json);
}

@freezed
abstract class SeasonConstructorSummaryDto with _$SeasonConstructorSummaryDto {
  const factory SeasonConstructorSummaryDto({
    required String constructorId,
    required String name,
    String? fullName,
    String? shortName,
    String? colorPrimary,
    String? colorSecondary,
    String? powerUnit,
    List<String>? driverLineup,
  }) = _SeasonConstructorSummaryDto;

  factory SeasonConstructorSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$SeasonConstructorSummaryDtoFromJson(json);
}
