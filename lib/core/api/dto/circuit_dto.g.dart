// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'circuit_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_LapRecordDto _$LapRecordDtoFromJson(Map<String, dynamic> json) =>
    _LapRecordDto(
      driverId: json['driverId'] as String?,
      timeMillis: (json['timeMillis'] as num?)?.toInt(),
      year: (json['year'] as num?)?.toInt(),
    );

Map<String, dynamic> _$LapRecordDtoToJson(_LapRecordDto instance) =>
    <String, dynamic>{
      'driverId': instance.driverId,
      'timeMillis': instance.timeMillis,
      'year': instance.year,
    };

_CircuitDto _$CircuitDtoFromJson(Map<String, dynamic> json) => _CircuitDto(
  id: json['id'] as String,
  name: json['name'] as String,
  locality: json['locality'] as String?,
  country: json['country'] as String?,
  countryCode: json['countryCode'] as String?,
  latitude: (json['latitude'] as num?)?.toDouble(),
  longitude: (json['longitude'] as num?)?.toDouble(),
  lengthMeters: (json['lengthMeters'] as num?)?.toInt(),
  cornerCount: (json['cornerCount'] as num?)?.toInt(),
  direction: json['direction'] as String?,
  firstGrandPrixYear: (json['firstGrandPrixYear'] as num?)?.toInt(),
  lapRecord: json['lapRecord'] == null
      ? null
      : LapRecordDto.fromJson(json['lapRecord'] as Map<String, dynamic>),
  media: (json['media'] as List<dynamic>?)
      ?.map((e) => MediaAssetDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$CircuitDtoToJson(_CircuitDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'locality': instance.locality,
      'country': instance.country,
      'countryCode': instance.countryCode,
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'lengthMeters': instance.lengthMeters,
      'cornerCount': instance.cornerCount,
      'direction': instance.direction,
      'firstGrandPrixYear': instance.firstGrandPrixYear,
      'lapRecord': instance.lapRecord,
      'media': instance.media,
    };
