// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'driver_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DriverDto _$DriverDtoFromJson(Map<String, dynamic> json) => _DriverDto(
  id: json['id'] as String,
  fullName: json['fullName'] as String,
  givenName: json['givenName'] as String?,
  familyName: json['familyName'] as String?,
  shortCode: json['shortCode'] as String?,
  permanentNumber: (json['permanentNumber'] as num?)?.toInt(),
  nationality: json['nationality'] as String?,
  countryCode: json['countryCode'] as String?,
  dateOfBirth: json['dateOfBirth'] as String?,
  placeOfBirth: json['placeOfBirth'] as String?,
  biography: json['biography'] as String?,
  media: (json['media'] as List<dynamic>?)
      ?.map((e) => MediaAssetDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$DriverDtoToJson(_DriverDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fullName': instance.fullName,
      'givenName': instance.givenName,
      'familyName': instance.familyName,
      'shortCode': instance.shortCode,
      'permanentNumber': instance.permanentNumber,
      'nationality': instance.nationality,
      'countryCode': instance.countryCode,
      'dateOfBirth': instance.dateOfBirth,
      'placeOfBirth': instance.placeOfBirth,
      'biography': instance.biography,
      'media': instance.media,
    };
