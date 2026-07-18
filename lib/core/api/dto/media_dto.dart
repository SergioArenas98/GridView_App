import 'package:freezed_annotation/freezed_annotation.dart';

part 'media_dto.freezed.dart';
part 'media_dto.g.dart';

/// One sized image variant. Enum-like `category`/`format` are carried as raw
/// strings at the DTO boundary; the mapper resolves them with an `unknown`
/// fallback.
@freezed
abstract class MediaVariantDto with _$MediaVariantDto {
  const factory MediaVariantDto({
    required String url,
    int? width,
    int? height,
  }) = _MediaVariantDto;

  factory MediaVariantDto.fromJson(Map<String, dynamic> json) =>
      _$MediaVariantDtoFromJson(json);
}

@freezed
abstract class MediaVariantsDto with _$MediaVariantsDto {
  const factory MediaVariantsDto({
    MediaVariantDto? thumbnail,
    MediaVariantDto? card,
    MediaVariantDto? detail,
    MediaVariantDto? hero,
  }) = _MediaVariantsDto;

  factory MediaVariantsDto.fromJson(Map<String, dynamic> json) =>
      _$MediaVariantsDtoFromJson(json);
}

@freezed
abstract class MediaAssetDto with _$MediaAssetDto {
  const factory MediaAssetDto({
    required String id,
    required String entityType,
    String? entityId,
    required String category,
    required String format,
    required MediaVariantsDto variants,
    double? aspectRatio,
    required String version,
    String? attribution,
    String? license,
    String? fallbackCategory,
  }) = _MediaAssetDto;

  factory MediaAssetDto.fromJson(Map<String, dynamic> json) =>
      _$MediaAssetDtoFromJson(json);
}
