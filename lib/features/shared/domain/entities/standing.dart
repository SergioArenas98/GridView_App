/// Championship points are `double` so fractional/half points are exact.
/// `position` is null when unranked; a genuine zero-point total keeps its zero.
class DriverStanding {
  const DriverStanding({
    required this.season,
    required this.driverId,
    this.constructorId,
    this.position,
    required this.points,
    this.wins,
    this.podiums,
    this.provisional,
  });

  final int season;
  final String driverId;
  final String? constructorId;
  final int? position;
  final double points;
  final int? wins;
  final int? podiums;
  final bool? provisional;
}

class ConstructorStanding {
  const ConstructorStanding({
    required this.season,
    required this.constructorId,
    this.position,
    required this.points,
    this.wins,
    this.provisional,
  });

  final int season;
  final String constructorId;
  final int? position;
  final double points;
  final int? wins;
  final bool? provisional;
}
