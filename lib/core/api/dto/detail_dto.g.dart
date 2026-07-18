// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'detail_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DriverDetailDto _$DriverDetailDtoFromJson(Map<String, dynamic> json) =>
    _DriverDetailDto(
      driver: DriverDto.fromJson(json['driver'] as Map<String, dynamic>),
      seasonEntry: json['seasonEntry'] == null
          ? null
          : DriverSeasonEntryDto.fromJson(
              json['seasonEntry'] as Map<String, dynamic>,
            ),
      constructor: json['constructor'] == null
          ? null
          : ConstructorSummaryDto.fromJson(
              json['constructor'] as Map<String, dynamic>,
            ),
      standing: json['standing'] == null
          ? null
          : DriverStandingDto.fromJson(
              json['standing'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$DriverDetailDtoToJson(_DriverDetailDto instance) =>
    <String, dynamic>{
      'driver': instance.driver,
      'seasonEntry': instance.seasonEntry,
      'constructor': instance.constructor,
      'standing': instance.standing,
    };

_ConstructorDetailDto _$ConstructorDetailDtoFromJson(
  Map<String, dynamic> json,
) => _ConstructorDetailDto(
  constructor: ConstructorDto.fromJson(
    json['constructor'] as Map<String, dynamic>,
  ),
  seasonEntry: json['seasonEntry'] == null
      ? null
      : ConstructorSeasonEntryDto.fromJson(
          json['seasonEntry'] as Map<String, dynamic>,
        ),
  standing: json['standing'] == null
      ? null
      : ConstructorStandingDto.fromJson(
          json['standing'] as Map<String, dynamic>,
        ),
  lineup: (json['lineup'] as List<dynamic>?)
      ?.map((e) => DriverSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ConstructorDetailDtoToJson(
  _ConstructorDetailDto instance,
) => <String, dynamic>{
  'constructor': instance.constructor,
  'seasonEntry': instance.seasonEntry,
  'standing': instance.standing,
  'lineup': instance.lineup,
};

_CircuitDetailDto _$CircuitDetailDtoFromJson(Map<String, dynamic> json) =>
    _CircuitDetailDto(
      circuit: CircuitDto.fromJson(json['circuit'] as Map<String, dynamic>),
      grandPrix: json['grandPrix'] == null
          ? null
          : GrandPrixSummaryDto.fromJson(
              json['grandPrix'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$CircuitDetailDtoToJson(_CircuitDetailDto instance) =>
    <String, dynamic>{
      'circuit': instance.circuit,
      'grandPrix': instance.grandPrix,
    };
