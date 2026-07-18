import 'package:freezed_annotation/freezed_annotation.dart';

part 'season_dto.freezed.dart';
part 'season_dto.g.dart';

@freezed
abstract class SeasonDto with _$SeasonDto {
  const factory SeasonDto({
    required int year,
    String? label,
    required String status,
    String? startDate,
    String? endDate,
    int? roundCount,
    int? currentRound,
    required bool isCurrent,
  }) = _SeasonDto;

  factory SeasonDto.fromJson(Map<String, dynamic> json) =>
      _$SeasonDtoFromJson(json);
}
