// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'season_entry_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DriverSeasonEntryDto _$DriverSeasonEntryDtoFromJson(
  Map<String, dynamic> json,
) => _DriverSeasonEntryDto(
  id: json['id'] as String,
  season: (json['season'] as num).toInt(),
  driverId: json['driverId'] as String,
  constructorId: json['constructorId'] as String,
  raceNumber: (json['raceNumber'] as num?)?.toInt(),
  role: json['role'] as String?,
  shortCode: json['shortCode'] as String?,
  startRound: (json['startRound'] as num?)?.toInt(),
  endRound: (json['endRound'] as num?)?.toInt(),
);

Map<String, dynamic> _$DriverSeasonEntryDtoToJson(
  _DriverSeasonEntryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'season': instance.season,
  'driverId': instance.driverId,
  'constructorId': instance.constructorId,
  'raceNumber': instance.raceNumber,
  'role': instance.role,
  'shortCode': instance.shortCode,
  'startRound': instance.startRound,
  'endRound': instance.endRound,
};

_ConstructorSeasonEntryDto _$ConstructorSeasonEntryDtoFromJson(
  Map<String, dynamic> json,
) => _ConstructorSeasonEntryDto(
  id: json['id'] as String,
  season: (json['season'] as num).toInt(),
  constructorId: json['constructorId'] as String,
  fullName: json['fullName'] as String?,
  shortName: json['shortName'] as String?,
  colorPrimary: json['colorPrimary'] as String?,
  colorSecondary: json['colorSecondary'] as String?,
  powerUnit: json['powerUnit'] as String?,
  teamPrincipal: json['teamPrincipal'] as String?,
  base: json['base'] as String?,
  chassis: json['chassis'] as String?,
  driverLineup: (json['driverLineup'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$ConstructorSeasonEntryDtoToJson(
  _ConstructorSeasonEntryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'season': instance.season,
  'constructorId': instance.constructorId,
  'fullName': instance.fullName,
  'shortName': instance.shortName,
  'colorPrimary': instance.colorPrimary,
  'colorSecondary': instance.colorSecondary,
  'powerUnit': instance.powerUnit,
  'teamPrincipal': instance.teamPrincipal,
  'base': instance.base,
  'chassis': instance.chassis,
  'driverLineup': instance.driverLineup,
};
