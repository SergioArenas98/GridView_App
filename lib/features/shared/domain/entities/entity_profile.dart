import 'circuit.dart';
import 'constructor.dart';
import 'driver.dart';
import 'enums.dart';
import 'season_card.dart';
import 'season_entry.dart';
import 'standing.dart';

/// Domain-facing **detail** read models for the Driver, Team and Circuit
/// screens.
///
/// Each is composed locally from whatever is persisted, so a screen can render
/// immediately from a collection-derived summary and progressively gain the
/// detail-owned sections. They deliberately do **not** claim that the detail
/// endpoint synchronised: that is metadata, evaluated separately against the
/// exact detail resource key (ADR 0014).
///
/// A profile is only ever built around a **real** identity. An unresolved
/// referential stub yields `null`, never a nameless profile.

/// One of a driver's participation spans in a season, with the team it was for.
class DriverParticipation {
  const DriverParticipation({
    required this.entry,
    this.teamName,
    this.teamColor,
  });

  final DriverSeasonEntry entry;

  /// The season-specific display name of exactly [DriverSeasonEntry.constructorId],
  /// or `null` when that constructor is not resolvable locally. Never derived
  /// from the identifier, and never guessed from unrelated season data.
  final String? teamName;

  final String? teamColor;

  String get constructorId => entry.constructorId;
  int? get raceNumber => entry.raceNumber;
  DriverRole? get role => entry.role;
  int? get startRound => entry.startRound;
  int? get endRound => entry.endRound;

  bool get isFullSeason => entry.startRound == null && entry.endRound == null;
}

/// Driver detail: the stable identity plus everything the local database knows
/// about that driver in one exact season.
class DriverProfile {
  const DriverProfile({
    required this.driver,
    required this.season,
    this.participations = const <DriverParticipation>[],
    this.standing,
  });

  /// The authoritative identity. Never a referential stub.
  final Driver driver;

  /// The season this profile was composed for. Every season-scoped field below
  /// belongs to exactly this season.
  final int season;

  /// Every participation span in [season], ordered by `startRound` (open spans
  /// first). A mid-season move keeps both spans rather than flattening them into
  /// one false "current team".
  final List<DriverParticipation> participations;

  final DriverStanding? standing;

  String get driverId => driver.id;

  /// The single relevant span, or `null` when the season has none: the open span
  /// (`endRound == null`) if any, else the latest by `startRound`.
  DriverParticipation? get relevantParticipation =>
      participations.isEmpty ? null : participations.first;

  /// Whether more than one span exists, so presentation must not state a single
  /// "current team" as if it were the whole season.
  bool get hasMultipleParticipations => participations.length > 1;

  /// Whether any detail-owned biography/profile field is present. Used to hide
  /// the section entirely instead of rendering an empty card.
  bool get hasProfileFacts =>
      driver.dateOfBirth != null ||
      driver.placeOfBirth != null ||
      driver.nationality != null ||
      (driver.biography?.trim().isNotEmpty ?? false) ||
      driver.givenName != null ||
      driver.familyName != null;
}

/// Team detail: stable identity, the season's branding and facts, the
/// championship standing and the derived line-up.
class TeamProfile {
  const TeamProfile({
    required this.constructor,
    required this.season,
    this.seasonEntry,
    this.standing,
    this.lineup = const <TeamLineupMember>[],
  });

  /// The authoritative stable identity. Never a referential stub, and never
  /// replaced by season branding — rebranding varies the display name, not the
  /// identity.
  final Constructor constructor;

  final int season;
  final ConstructorSeasonEntry? seasonEntry;
  final ConstructorStanding? standing;

  /// The season line-up, derived from the season's driver participation entries
  /// (the single source of truth for membership). Unresolved driver stubs are
  /// omitted rather than rendered as nameless profiles.
  final List<TeamLineupMember> lineup;

  String get constructorId => constructor.id;

  /// Season branding first, then the stable identity. Never the identifier.
  String get displayName =>
      seasonEntry?.fullName ?? seasonEntry?.shortName ?? constructor.name;

  /// The stable identity name, shown as a fallback only when it differs from
  /// what is already displayed.
  String? get stableFallbackName =>
      constructor.name == displayName ? null : constructor.name;

  /// Whether any season fact is present, so an empty facts card is never shown.
  bool get hasSeasonFacts =>
      seasonEntry?.powerUnit != null ||
      seasonEntry?.teamPrincipal != null ||
      seasonEntry?.base != null ||
      seasonEntry?.chassis != null;

  bool get hasProfileFacts =>
      constructor.nationality != null ||
      constructor.countryCode != null ||
      (constructor.biography?.trim().isNotEmpty ?? false);
}

/// Circuit detail: the stable circuit identity and physical facts, plus the one
/// related Grand Prix for the selected season.
class CircuitProfile {
  const CircuitProfile({
    required this.circuit,
    required this.season,
    this.relatedGrandPrix,
    this.lapRecordDriverName,
  });

  /// The authoritative identity. Never a referential stub.
  final Circuit circuit;

  final int season;

  /// The event this circuit hosts in exactly [season], or `null` when it hosts
  /// none. No related event is a valid state, not an error.
  final RelatedGrandPrixSummary? relatedGrandPrix;

  /// The lap-record holder's authoritative name, or `null` when the identity is
  /// unknown or still an unresolved stub. Presentation then uses localized
  /// unavailable copy — never the driver identifier.
  final String? lapRecordDriverName;

  String get circuitId => circuit.id;

  /// Whether any physical fact is present, so an empty facts card is never
  /// shown. Race distance and event lap count are deliberately absent: they
  /// belong to the event, not to circuit identity.
  bool get hasPhysicalFacts =>
      circuit.lengthMeters != null ||
      circuit.cornerCount != null ||
      circuit.direction != null ||
      circuit.firstGrandPrixYear != null;

  bool get hasLapRecord =>
      circuit.lapRecord != null &&
      (circuit.lapRecord!.time != null || circuit.lapRecord!.year != null);
}
