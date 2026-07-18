// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'meta_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MetaDto _$MetaDtoFromJson(Map<String, dynamic> json) => _MetaDto(
  apiVersion: json['apiVersion'] as String,
  generatedAt: json['generatedAt'] as String,
  requestId: json['requestId'] as String,
  schemaVersion: (json['schemaVersion'] as num?)?.toInt(),
  season: (json['season'] as num?)?.toInt(),
  sourceUpdatedAt: json['sourceUpdatedAt'] as String?,
  staleAfter: json['staleAfter'] as String?,
  contentVersion: json['contentVersion'] as String?,
);

Map<String, dynamic> _$MetaDtoToJson(_MetaDto instance) => <String, dynamic>{
  'apiVersion': instance.apiVersion,
  'generatedAt': instance.generatedAt,
  'requestId': instance.requestId,
  'schemaVersion': instance.schemaVersion,
  'season': instance.season,
  'sourceUpdatedAt': instance.sourceUpdatedAt,
  'staleAfter': instance.staleAfter,
  'contentVersion': instance.contentVersion,
};
