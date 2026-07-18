import '../../../../core/api/dto/media_dto.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/media.dart';

MediaVariant mediaVariantFromDto(MediaVariantDto dto) =>
    MediaVariant(url: dto.url, width: dto.width, height: dto.height);

MediaVariant? _variantOrNull(MediaVariantDto? dto) =>
    dto == null ? null : mediaVariantFromDto(dto);

MediaVariants mediaVariantsFromDto(MediaVariantsDto dto) => MediaVariants(
  thumbnail: _variantOrNull(dto.thumbnail),
  card: _variantOrNull(dto.card),
  detail: _variantOrNull(dto.detail),
  hero: _variantOrNull(dto.hero),
);

MediaAsset mediaAssetFromDto(MediaAssetDto dto) => MediaAsset(
  id: dto.id,
  entityType: MediaEntityType.fromWire(dto.entityType),
  entityId: dto.entityId,
  category: MediaCategory.fromWire(dto.category),
  format: MediaFormat.fromWire(dto.format),
  variants: mediaVariantsFromDto(dto.variants),
  aspectRatio: dto.aspectRatio,
  version: dto.version,
  attribution: dto.attribution,
  license: dto.license,
  fallbackCategory: dto.fallbackCategory,
);

List<MediaAsset>? mediaListFromDto(List<MediaAssetDto>? dtos) =>
    dtos?.map(mediaAssetFromDto).toList();
