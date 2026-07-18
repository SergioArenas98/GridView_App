// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'constructor_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ConstructorDto _$ConstructorDtoFromJson(Map<String, dynamic> json) =>
    _ConstructorDto(
      id: json['id'] as String,
      name: json['name'] as String,
      shortName: json['shortName'] as String?,
      nationality: json['nationality'] as String?,
      countryCode: json['countryCode'] as String?,
      colorPrimary: json['colorPrimary'] as String?,
      biography: json['biography'] as String?,
      media: (json['media'] as List<dynamic>?)
          ?.map((e) => MediaAssetDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ConstructorDtoToJson(_ConstructorDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'shortName': instance.shortName,
      'nationality': instance.nationality,
      'countryCode': instance.countryCode,
      'colorPrimary': instance.colorPrimary,
      'biography': instance.biography,
      'media': instance.media,
    };
