// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'standing_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DriverStandingDto _$DriverStandingDtoFromJson(Map<String, dynamic> json) =>
    _DriverStandingDto(
      season: (json['season'] as num).toInt(),
      driverId: json['driverId'] as String,
      constructorId: json['constructorId'] as String?,
      position: (json['position'] as num?)?.toInt(),
      points: (json['points'] as num).toDouble(),
      wins: (json['wins'] as num?)?.toInt(),
      podiums: (json['podiums'] as num?)?.toInt(),
      provisional: json['provisional'] as bool?,
    );

Map<String, dynamic> _$DriverStandingDtoToJson(_DriverStandingDto instance) =>
    <String, dynamic>{
      'season': instance.season,
      'driverId': instance.driverId,
      'constructorId': instance.constructorId,
      'position': instance.position,
      'points': instance.points,
      'wins': instance.wins,
      'podiums': instance.podiums,
      'provisional': instance.provisional,
    };

_ConstructorStandingDto _$ConstructorStandingDtoFromJson(
  Map<String, dynamic> json,
) => _ConstructorStandingDto(
  season: (json['season'] as num).toInt(),
  constructorId: json['constructorId'] as String,
  position: (json['position'] as num?)?.toInt(),
  points: (json['points'] as num).toDouble(),
  wins: (json['wins'] as num?)?.toInt(),
  provisional: json['provisional'] as bool?,
);

Map<String, dynamic> _$ConstructorStandingDtoToJson(
  _ConstructorStandingDto instance,
) => <String, dynamic>{
  'season': instance.season,
  'constructorId': instance.constructorId,
  'position': instance.position,
  'points': instance.points,
  'wins': instance.wins,
  'provisional': instance.provisional,
};
