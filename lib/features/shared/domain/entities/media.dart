import 'enums.dart';

class MediaVariant {
  const MediaVariant({required this.url, this.width, this.height});

  final String url;
  final int? width;
  final int? height;
}

class MediaVariants {
  const MediaVariants({this.thumbnail, this.card, this.detail, this.hero});

  final MediaVariant? thumbnail;
  final MediaVariant? card;
  final MediaVariant? detail;
  final MediaVariant? hero;
}

class MediaAsset {
  const MediaAsset({
    required this.id,
    required this.entityType,
    this.entityId,
    required this.category,
    required this.format,
    required this.variants,
    this.aspectRatio,
    required this.version,
    this.attribution,
    this.license,
    this.fallbackCategory,
  });

  final String id;
  final MediaEntityType entityType;
  final String? entityId;
  final MediaCategory category;
  final MediaFormat format;
  final MediaVariants variants;
  final double? aspectRatio;
  final String version;
  final String? attribution;
  final String? license;
  final String? fallbackCategory;
}
