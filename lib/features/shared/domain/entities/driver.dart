import 'media.dart';

/// Stable driver identity and biography. Season role, team and race number live
/// on [DriverSeasonEntry], not here.
class Driver {
  const Driver({
    required this.id,
    required this.fullName,
    this.givenName,
    this.familyName,
    this.shortCode,
    this.permanentNumber,
    this.nationality,
    this.countryCode,
    this.dateOfBirth,
    this.placeOfBirth,
    this.biography,
    this.media,
  });

  final String id;
  final String fullName;
  final String? givenName;
  final String? familyName;
  final String? shortCode;
  final int? permanentNumber;
  final String? nationality;
  final String? countryCode;
  final String? dateOfBirth;
  final String? placeOfBirth;
  final String? biography;
  final List<MediaAsset>? media;
}
