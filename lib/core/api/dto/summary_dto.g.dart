// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'summary_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DriverSummaryDto _$DriverSummaryDtoFromJson(Map<String, dynamic> json) =>
    _DriverSummaryDto(
      id: json['id'] as String,
      fullName: json['fullName'] as String,
      shortCode: json['shortCode'] as String?,
      permanentNumber: (json['permanentNumber'] as num?)?.toInt(),
      countryCode: json['countryCode'] as String?,
    );

Map<String, dynamic> _$DriverSummaryDtoToJson(_DriverSummaryDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fullName': instance.fullName,
      'shortCode': instance.shortCode,
      'permanentNumber': instance.permanentNumber,
      'countryCode': instance.countryCode,
    };

_ConstructorSummaryDto _$ConstructorSummaryDtoFromJson(
  Map<String, dynamic> json,
) => _ConstructorSummaryDto(
  id: json['id'] as String,
  name: json['name'] as String,
  shortName: json['shortName'] as String?,
  colorPrimary: json['colorPrimary'] as String?,
);

Map<String, dynamic> _$ConstructorSummaryDtoToJson(
  _ConstructorSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
  'colorPrimary': instance.colorPrimary,
};

_CircuitSummaryDto _$CircuitSummaryDtoFromJson(Map<String, dynamic> json) =>
    _CircuitSummaryDto(
      id: json['id'] as String,
      name: json['name'] as String,
      locality: json['locality'] as String?,
      countryCode: json['countryCode'] as String?,
    );

Map<String, dynamic> _$CircuitSummaryDtoToJson(_CircuitSummaryDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'locality': instance.locality,
      'countryCode': instance.countryCode,
    };

_SeasonDriverSummaryDto _$SeasonDriverSummaryDtoFromJson(
  Map<String, dynamic> json,
) => _SeasonDriverSummaryDto(
  driverId: json['driverId'] as String,
  fullName: json['fullName'] as String,
  shortCode: json['shortCode'] as String?,
  permanentNumber: (json['permanentNumber'] as num?)?.toInt(),
  raceNumber: (json['raceNumber'] as num?)?.toInt(),
  countryCode: json['countryCode'] as String?,
  constructorId: json['constructorId'] as String,
  role: json['role'] as String?,
);

Map<String, dynamic> _$SeasonDriverSummaryDtoToJson(
  _SeasonDriverSummaryDto instance,
) => <String, dynamic>{
  'driverId': instance.driverId,
  'fullName': instance.fullName,
  'shortCode': instance.shortCode,
  'permanentNumber': instance.permanentNumber,
  'raceNumber': instance.raceNumber,
  'countryCode': instance.countryCode,
  'constructorId': instance.constructorId,
  'role': instance.role,
};

_SeasonConstructorSummaryDto _$SeasonConstructorSummaryDtoFromJson(
  Map<String, dynamic> json,
) => _SeasonConstructorSummaryDto(
  constructorId: json['constructorId'] as String,
  name: json['name'] as String,
  fullName: json['fullName'] as String?,
  shortName: json['shortName'] as String?,
  colorPrimary: json['colorPrimary'] as String?,
  colorSecondary: json['colorSecondary'] as String?,
  powerUnit: json['powerUnit'] as String?,
  driverLineup: (json['driverLineup'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$SeasonConstructorSummaryDtoToJson(
  _SeasonConstructorSummaryDto instance,
) => <String, dynamic>{
  'constructorId': instance.constructorId,
  'name': instance.name,
  'fullName': instance.fullName,
  'shortName': instance.shortName,
  'colorPrimary': instance.colorPrimary,
  'colorSecondary': instance.colorSecondary,
  'powerUnit': instance.powerUnit,
  'driverLineup': instance.driverLineup,
};
