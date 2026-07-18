// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'media_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MediaVariantDto _$MediaVariantDtoFromJson(Map<String, dynamic> json) =>
    _MediaVariantDto(
      url: json['url'] as String,
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
    );

Map<String, dynamic> _$MediaVariantDtoToJson(_MediaVariantDto instance) =>
    <String, dynamic>{
      'url': instance.url,
      'width': instance.width,
      'height': instance.height,
    };

_MediaVariantsDto _$MediaVariantsDtoFromJson(Map<String, dynamic> json) =>
    _MediaVariantsDto(
      thumbnail: json['thumbnail'] == null
          ? null
          : MediaVariantDto.fromJson(json['thumbnail'] as Map<String, dynamic>),
      card: json['card'] == null
          ? null
          : MediaVariantDto.fromJson(json['card'] as Map<String, dynamic>),
      detail: json['detail'] == null
          ? null
          : MediaVariantDto.fromJson(json['detail'] as Map<String, dynamic>),
      hero: json['hero'] == null
          ? null
          : MediaVariantDto.fromJson(json['hero'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$MediaVariantsDtoToJson(_MediaVariantsDto instance) =>
    <String, dynamic>{
      'thumbnail': instance.thumbnail,
      'card': instance.card,
      'detail': instance.detail,
      'hero': instance.hero,
    };

_MediaAssetDto _$MediaAssetDtoFromJson(Map<String, dynamic> json) =>
    _MediaAssetDto(
      id: json['id'] as String,
      entityType: json['entityType'] as String,
      entityId: json['entityId'] as String?,
      category: json['category'] as String,
      format: json['format'] as String,
      variants: MediaVariantsDto.fromJson(
        json['variants'] as Map<String, dynamic>,
      ),
      aspectRatio: (json['aspectRatio'] as num?)?.toDouble(),
      version: json['version'] as String,
      attribution: json['attribution'] as String?,
      license: json['license'] as String?,
      fallbackCategory: json['fallbackCategory'] as String?,
    );

Map<String, dynamic> _$MediaAssetDtoToJson(_MediaAssetDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'entityType': instance.entityType,
      'entityId': instance.entityId,
      'category': instance.category,
      'format': instance.format,
      'variants': instance.variants,
      'aspectRatio': instance.aspectRatio,
      'version': instance.version,
      'attribution': instance.attribution,
      'license': instance.license,
      'fallbackCategory': instance.fallbackCategory,
    };
