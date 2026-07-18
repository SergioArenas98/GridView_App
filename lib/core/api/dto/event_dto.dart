import 'package:freezed_annotation/freezed_annotation.dart';

import 'media_dto.dart';

part 'event_dto.freezed.dart';
part 'event_dto.g.dart';

@freezed
abstract class SessionDto with _$SessionDto {
  const factory SessionDto({
    required String id,
    required String type,
    String? name,
    String? startTime,
    String? endTime,
    required String status,
  }) = _SessionDto;

  factory SessionDto.fromJson(Map<String, dynamic> json) =>
      _$SessionDtoFromJson(json);
}

@freezed
abstract class GrandPrixDto with _$GrandPrixDto {
  const factory GrandPrixDto({
    required String id,
    required int season,
    required int round,
    required String eventSlug,
    required String name,
    String? officialName,
    required String circuitId,
    required String status,
    required String format,
    String? startDate,
    String? endDate,
    String? timezone,
    required List<SessionDto> sessions,
    required bool hasResults,
    List<MediaAssetDto>? media,
  }) = _GrandPrixDto;

  factory GrandPrixDto.fromJson(Map<String, dynamic> json) =>
      _$GrandPrixDtoFromJson(json);
}

@freezed
abstract class GrandPrixSummaryDto with _$GrandPrixSummaryDto {
  const factory GrandPrixSummaryDto({
    required String id,
    required int season,
    required int round,
    required String eventSlug,
    required String name,
    required String circuitId,
    String? circuitName,
    required String status,
    required String format,
    String? startDate,
    String? endDate,
    String? timezone,
    required bool hasResults,
  }) = _GrandPrixSummaryDto;

  factory GrandPrixSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$GrandPrixSummaryDtoFromJson(json);
}
