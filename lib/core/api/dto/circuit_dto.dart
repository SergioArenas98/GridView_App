import 'package:freezed_annotation/freezed_annotation.dart';

import 'media_dto.dart';

part 'circuit_dto.freezed.dart';
part 'circuit_dto.g.dart';

@freezed
abstract class LapRecordDto with _$LapRecordDto {
  const factory LapRecordDto({String? driverId, int? timeMillis, int? year}) =
      _LapRecordDto;

  factory LapRecordDto.fromJson(Map<String, dynamic> json) =>
      _$LapRecordDtoFromJson(json);
}

@freezed
abstract class CircuitDto with _$CircuitDto {
  const factory CircuitDto({
    required String id,
    required String name,
    String? locality,
    String? country,
    String? countryCode,
    double? latitude,
    double? longitude,
    int? lengthMeters,
    int? cornerCount,
    String? direction,
    int? firstGrandPrixYear,
    LapRecordDto? lapRecord,
    List<MediaAssetDto>? media,
  }) = _CircuitDto;

  factory CircuitDto.fromJson(Map<String, dynamic> json) =>
      _$CircuitDtoFromJson(json);
}
