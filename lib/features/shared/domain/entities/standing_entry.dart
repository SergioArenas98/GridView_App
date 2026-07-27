import 'standing.dart';

/// One row of a championship table as read from the local database.
///
/// A domain-only read model (no Drift rows, no DTOs) composed from the persisted
/// standing plus the competitor identity and season branding it references. Only
/// what the contract actually supplies is carried: a name that is not stored
/// locally yet stays `null` rather than becoming a humanised identifier, and a
/// team is never guessed for a standing that names no constructor.
class DriverStandingEntry {
  const DriverStandingEntry({
    required this.standing,
    required this.orderIndex,
    this.driverName,
    this.driverShortCode,
    this.constructorName,
    this.teamColor,
  });

  final DriverStanding standing;

  /// The authoritative delivered order of this row inside its season's table.
  /// Rendering follows it exactly — never a locally recomputed order.
  final int orderIndex;

  /// The driver's stable display name, or `null` when the identity row is not
  /// present locally. Never derived from [driverId].
  final String? driverName;

  /// The driver's stable short code (e.g. `VER`), when known.
  final String? driverShortCode;

  /// The display name of **exactly** [constructorId] for this season: the
  /// season-specific branding when stored, else the stable constructor name.
  ///
  /// `null` when the standing names no constructor, or when that constructor is
  /// not present locally. A driver's team is never inferred from their season
  /// participation entries.
  final String? constructorName;

  /// The team's primary colour as a `#RRGGBB` string, when known. Decorative
  /// only: it never carries meaning on its own.
  final String? teamColor;

  int get season => standing.season;
  String get driverId => standing.driverId;
  String? get constructorId => standing.constructorId;

  /// The championship position, or `null` when the competitor is unranked. A
  /// missing position is never presented as zero.
  int? get position => standing.position;

  /// Championship points, fractional-capable and never rounded.
  double get points => standing.points;

  int? get wins => standing.wins;
  int? get podiums => standing.podiums;
  bool? get provisional => standing.provisional;
}

/// One row of the constructors' championship table as read from the local
/// database.
class ConstructorStandingEntry {
  const ConstructorStandingEntry({
    required this.standing,
    required this.orderIndex,
    this.seasonName,
    this.stableName,
    this.teamColor,
  });

  final ConstructorStanding standing;

  /// The authoritative delivered order of this row inside its season's table.
  final int orderIndex;

  /// The season-specific team name (rebranding varies it per season), when
  /// stored.
  final String? seasonName;

  /// The stable constructor identity's name, when the identity row is present.
  final String? stableName;

  /// The team's primary colour as a `#RRGGBB` string, when known.
  final String? teamColor;

  /// Season branding first, then the stable identity. Never the identifier: a
  /// display name is presentation, never identity.
  String? get displayName => seasonName ?? stableName;

  int get season => standing.season;
  String get constructorId => standing.constructorId;
  int? get position => standing.position;
  double get points => standing.points;
  int? get wins => standing.wins;
  bool? get provisional => standing.provisional;
}
