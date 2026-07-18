import 'enums.dart';
import 'media.dart';

class LapRecord {
  const LapRecord({this.driverId, this.time, this.year});

  final String? driverId;
  final Duration? time;
  final int? year;
}

class Circuit {
  const Circuit({
    required this.id,
    required this.name,
    this.locality,
    this.country,
    this.countryCode,
    this.latitude,
    this.longitude,
    this.lengthMeters,
    this.cornerCount,
    this.direction,
    this.firstGrandPrixYear,
    this.lapRecord,
    this.media,
  });

  final String id;
  final String name;
  final String? locality;
  final String? country;
  final String? countryCode;
  final double? latitude;
  final double? longitude;
  final int? lengthMeters;
  final int? cornerCount;
  final CircuitDirection? direction;
  final int? firstGrandPrixYear;
  final LapRecord? lapRecord;
  final List<MediaAsset>? media;
}
