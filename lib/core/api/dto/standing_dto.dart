import 'package:freezed_annotation/freezed_annotation.dart';

part 'standing_dto.freezed.dart';
part 'standing_dto.g.dart';

@freezed
abstract class DriverStandingDto with _$DriverStandingDto {
  const factory DriverStandingDto({
    required int season,
    required String driverId,
    String? constructorId,
    int? position,
    required double points,
    int? wins,
    int? podiums,
    bool? provisional,
  }) = _DriverStandingDto;

  factory DriverStandingDto.fromJson(Map<String, dynamic> json) =>
      _$DriverStandingDtoFromJson(json);
}

@freezed
abstract class ConstructorStandingDto with _$ConstructorStandingDto {
  const factory ConstructorStandingDto({
    required int season,
    required String constructorId,
    int? position,
    required double points,
    int? wins,
    bool? provisional,
  }) = _ConstructorStandingDto;

  factory ConstructorStandingDto.fromJson(Map<String, dynamic> json) =>
      _$ConstructorStandingDtoFromJson(json);
}
