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

/// One credit line that must be displayed for stored media.
///
/// The unit of an acknowledgement is the *credit*, not the asset and certainly
/// not the size variant: several variants of one asset — and several assets from
/// one rights holder — collapse to a single line. It deliberately carries no
/// media id and no URL, because neither is a human-readable label.
class MediaAttribution {
  const MediaAttribution({
    required this.category,
    required this.attribution,
    this.license,
  });

  /// What kind of media the credit covers, so a line stays associated with a
  /// meaningful subject rather than floating free.
  final MediaCategory category;

  /// The credit text exactly as the rights record supplied it.
  final String attribution;

  /// The licence or permission basis, when one was supplied.
  final String? license;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MediaAttribution &&
          other.category == category &&
          other.attribution == attribution &&
          other.license == license;

  @override
  int get hashCode => Object.hash(category, attribution, license);
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
