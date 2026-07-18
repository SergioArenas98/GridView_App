import 'enums.dart';

/// A driver's participation for a team over a span of a season. A mid-season
/// change is two entries with different [startRound]/[endRound] spans; driver
/// identity never changes.
class DriverSeasonEntry {
  const DriverSeasonEntry({
    required this.id,
    required this.season,
    required this.driverId,
    required this.constructorId,
    this.raceNumber,
    this.role,
    this.shortCode,
    this.startRound,
    this.endRound,
  });

  final String id;
  final int season;
  final String driverId;
  final String constructorId;
  final int? raceNumber;
  final DriverRole? role;
  final String? shortCode;
  final int? startRound;
  final int? endRound;
}

/// A team's season-specific branding and line-up. Rebranding varies these
/// fields across seasons while the stable [constructorId] stays constant.
class ConstructorSeasonEntry {
  const ConstructorSeasonEntry({
    required this.id,
    required this.season,
    required this.constructorId,
    this.fullName,
    this.shortName,
    this.colorPrimary,
    this.colorSecondary,
    this.powerUnit,
    this.teamPrincipal,
    this.base,
    this.chassis,
    this.driverLineup,
  });

  final String id;
  final int season;
  final String constructorId;
  final String? fullName;
  final String? shortName;
  final String? colorPrimary;
  final String? colorSecondary;
  final String? powerUnit;
  final String? teamPrincipal;
  final String? base;
  final String? chassis;
  final List<String>? driverLineup;
}
