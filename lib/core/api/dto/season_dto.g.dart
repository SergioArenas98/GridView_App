// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'season_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SeasonDto _$SeasonDtoFromJson(Map<String, dynamic> json) => _SeasonDto(
  year: (json['year'] as num).toInt(),
  label: json['label'] as String?,
  status: json['status'] as String,
  startDate: json['startDate'] as String?,
  endDate: json['endDate'] as String?,
  roundCount: (json['roundCount'] as num?)?.toInt(),
  currentRound: (json['currentRound'] as num?)?.toInt(),
  isCurrent: json['isCurrent'] as bool,
);

Map<String, dynamic> _$SeasonDtoToJson(_SeasonDto instance) =>
    <String, dynamic>{
      'year': instance.year,
      'label': instance.label,
      'status': instance.status,
      'startDate': instance.startDate,
      'endDate': instance.endDate,
      'roundCount': instance.roundCount,
      'currentRound': instance.currentRound,
      'isCurrent': instance.isCurrent,
    };
