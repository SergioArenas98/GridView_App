// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'result_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FastestLapDto _$FastestLapDtoFromJson(Map<String, dynamic> json) =>
    _FastestLapDto(
      driverId: json['driverId'] as String?,
      timeMillis: (json['timeMillis'] as num?)?.toInt(),
      lap: (json['lap'] as num?)?.toInt(),
    );

Map<String, dynamic> _$FastestLapDtoToJson(_FastestLapDto instance) =>
    <String, dynamic>{
      'driverId': instance.driverId,
      'timeMillis': instance.timeMillis,
      'lap': instance.lap,
    };

_RaceResultEntryDto _$RaceResultEntryDtoFromJson(Map<String, dynamic> json) =>
    _RaceResultEntryDto(
      driverId: json['driverId'] as String,
      constructorId: json['constructorId'] as String,
      position: (json['position'] as num?)?.toInt(),
      gridPosition: (json['gridPosition'] as num?)?.toInt(),
      points: (json['points'] as num?)?.toDouble(),
      status: json['status'] as String,
      laps: (json['laps'] as num?)?.toInt(),
      elapsedTimeMillis: (json['elapsedTimeMillis'] as num?)?.toInt(),
      gapToLeaderMillis: (json['gapToLeaderMillis'] as num?)?.toInt(),
      lapsBehind: (json['lapsBehind'] as num?)?.toInt(),
      fastestLap: json['fastestLap'] as bool?,
      dnfReason: json['dnfReason'] as String?,
      gapText: json['gapText'] as String?,
    );

Map<String, dynamic> _$RaceResultEntryDtoToJson(_RaceResultEntryDto instance) =>
    <String, dynamic>{
      'driverId': instance.driverId,
      'constructorId': instance.constructorId,
      'position': instance.position,
      'gridPosition': instance.gridPosition,
      'points': instance.points,
      'status': instance.status,
      'laps': instance.laps,
      'elapsedTimeMillis': instance.elapsedTimeMillis,
      'gapToLeaderMillis': instance.gapToLeaderMillis,
      'lapsBehind': instance.lapsBehind,
      'fastestLap': instance.fastestLap,
      'dnfReason': instance.dnfReason,
      'gapText': instance.gapText,
    };

_RaceResultDto _$RaceResultDtoFromJson(Map<String, dynamic> json) =>
    _RaceResultDto(
      id: json['id'] as String,
      season: (json['season'] as num).toInt(),
      round: (json['round'] as num).toInt(),
      grandPrixId: json['grandPrixId'] as String,
      sessionType: json['sessionType'] as String,
      status: json['status'] as String,
      entries: (json['entries'] as List<dynamic>)
          .map((e) => RaceResultEntryDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      fastestLap: json['fastestLap'] == null
          ? null
          : FastestLapDto.fromJson(json['fastestLap'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$RaceResultDtoToJson(_RaceResultDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'season': instance.season,
      'round': instance.round,
      'grandPrixId': instance.grandPrixId,
      'sessionType': instance.sessionType,
      'status': instance.status,
      'entries': instance.entries,
      'fastestLap': instance.fastestLap,
    };
