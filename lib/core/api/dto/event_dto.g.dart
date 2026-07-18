// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'event_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SessionDto _$SessionDtoFromJson(Map<String, dynamic> json) => _SessionDto(
  id: json['id'] as String,
  type: json['type'] as String,
  name: json['name'] as String?,
  startTime: json['startTime'] as String?,
  endTime: json['endTime'] as String?,
  status: json['status'] as String,
);

Map<String, dynamic> _$SessionDtoToJson(_SessionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'name': instance.name,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'status': instance.status,
    };

_GrandPrixDto _$GrandPrixDtoFromJson(Map<String, dynamic> json) =>
    _GrandPrixDto(
      id: json['id'] as String,
      season: (json['season'] as num).toInt(),
      round: (json['round'] as num).toInt(),
      eventSlug: json['eventSlug'] as String,
      name: json['name'] as String,
      officialName: json['officialName'] as String?,
      circuitId: json['circuitId'] as String,
      status: json['status'] as String,
      format: json['format'] as String,
      startDate: json['startDate'] as String?,
      endDate: json['endDate'] as String?,
      timezone: json['timezone'] as String?,
      sessions: (json['sessions'] as List<dynamic>)
          .map((e) => SessionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasResults: json['hasResults'] as bool,
      media: (json['media'] as List<dynamic>?)
          ?.map((e) => MediaAssetDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$GrandPrixDtoToJson(_GrandPrixDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'season': instance.season,
      'round': instance.round,
      'eventSlug': instance.eventSlug,
      'name': instance.name,
      'officialName': instance.officialName,
      'circuitId': instance.circuitId,
      'status': instance.status,
      'format': instance.format,
      'startDate': instance.startDate,
      'endDate': instance.endDate,
      'timezone': instance.timezone,
      'sessions': instance.sessions,
      'hasResults': instance.hasResults,
      'media': instance.media,
    };

_GrandPrixSummaryDto _$GrandPrixSummaryDtoFromJson(Map<String, dynamic> json) =>
    _GrandPrixSummaryDto(
      id: json['id'] as String,
      season: (json['season'] as num).toInt(),
      round: (json['round'] as num).toInt(),
      eventSlug: json['eventSlug'] as String,
      name: json['name'] as String,
      circuitId: json['circuitId'] as String,
      circuitName: json['circuitName'] as String?,
      status: json['status'] as String,
      format: json['format'] as String,
      startDate: json['startDate'] as String?,
      endDate: json['endDate'] as String?,
      timezone: json['timezone'] as String?,
      hasResults: json['hasResults'] as bool,
    );

Map<String, dynamic> _$GrandPrixSummaryDtoToJson(
  _GrandPrixSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'season': instance.season,
  'round': instance.round,
  'eventSlug': instance.eventSlug,
  'name': instance.name,
  'circuitId': instance.circuitId,
  'circuitName': instance.circuitName,
  'status': instance.status,
  'format': instance.format,
  'startDate': instance.startDate,
  'endDate': instance.endDate,
  'timezone': instance.timezone,
  'hasResults': instance.hasResults,
};
