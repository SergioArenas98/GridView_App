import 'media.dart';

/// Stable constructor identity. Season name, livery and line-up live on
/// [ConstructorSeasonEntry], not here.
class Constructor {
  const Constructor({
    required this.id,
    required this.name,
    this.shortName,
    this.nationality,
    this.countryCode,
    this.colorPrimary,
    this.biography,
    this.media,
  });

  final String id;
  final String name;
  final String? shortName;
  final String? nationality;
  final String? countryCode;
  final String? colorPrimary;
  final String? biography;
  final List<MediaAsset>? media;
}
