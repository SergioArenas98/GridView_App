import 'enums.dart';

/// Domain-facing collection read models for the Explore categories.
///
/// These are composed from persisted entities on read (no Drift rows, no DTOs,
/// no Dio) and carry only what the local database actually holds:
///
/// * a value the contract does not supply stays `null` rather than becoming a
///   zero, an empty string or a humanised identifier;
/// * an unresolved referential stub never becomes a card, and never contributes
///   a name or a colour to one;
/// * [orderIndex] is the position the collection query produced; presentation
///   renders it exactly and never re-sorts. Only the circuits collection's
///   order is remotely authoritative (the season calendar's round) — the
///   drivers and teams orders are deterministic product rules, because the
///   schema carries no delivered-order field for their season entries.

/// One driver in a season's Explore roster.
///
/// Exactly **one** card per stable driver identity: a mid-season move produces
/// several participation spans for the same driver, and those collapse into the
/// single relevant span rather than into several cards.
class SeasonDriverCard {
  const SeasonDriverCard({
    required this.season,
    required this.driverId,
    required this.name,
    required this.orderIndex,
    this.shortCode,
    this.raceNumber,
    this.role,
    this.nationality,
    this.countryCode,
    this.constructorId,
    this.teamName,
    this.teamColor,
    this.position,
    this.points,
    this.spanCount = 1,
    this.hasPortraitMedia = false,
  });

  final int season;

  /// The stable identifier. Used for navigation only — never displayed, and
  /// never a fallback for a missing name.
  final String driverId;

  /// The authoritative display name. Never null: a driver whose identity is
  /// still an unresolved stub is omitted from the collection entirely.
  final String name;

  /// This card's position in the roster.
  ///
  /// A deterministic **product ordering rule**, not a provider-delivered one:
  /// race number ascending, unnumbered drivers last, stable name as the
  /// tie-breaker. It can be replaced if the contract later supplies an explicit
  /// collection order.
  final int orderIndex;

  final String? shortCode;

  /// The season race number, or `null` when the season entry carries none.
  /// Distinct from the driver's permanent number.
  final int? raceNumber;

  final DriverRole? role;
  final String? nationality;
  final String? countryCode;

  /// The constructor of the **relevant** participation span, or `null` when no
  /// authoritative span exists. Never taken from a standing row: a standing's
  /// `constructorId` describes the championship table, not participation.
  final String? constructorId;

  /// The season-specific team name for exactly [constructorId] (season branding
  /// first, then the stable identity), or `null` when that constructor is not
  /// resolvable locally. Never derived from [constructorId].
  final String? teamName;

  /// The team's `#RRGGBB` colour, when known. Decorative: it never carries
  /// meaning on its own.
  final String? teamColor;

  /// Championship position, or `null` when unranked or when no standing exists.
  /// A missing position is never presented as zero.
  final int? position;

  /// Championship points, fractional-capable, or `null` when no standing row
  /// exists. A genuine zero total keeps its zero.
  final double? points;

  /// How many participation spans this driver has in the season. `> 1` means the
  /// driver moved mid-season, so a single "current team" statement would be
  /// incomplete.
  final int spanCount;

  /// Whether a portrait asset is known locally. Phase 7C downloads nothing; this
  /// only refines placeholder semantics.
  final bool hasPortraitMedia;

  bool get hasMultipleSpans => spanCount > 1;
}

/// One driver of a team's season line-up, derived from the season's
/// participation entries — never from a stored or guessed list.
class TeamLineupMember {
  const TeamLineupMember({
    required this.driverId,
    required this.name,
    this.shortCode,
    this.raceNumber,
    this.role,
    this.startRound,
    this.endRound,
  });

  /// Stable identifier, for navigation only.
  final String driverId;

  /// Authoritative display name. Never null — an unresolved stub is omitted from
  /// the line-up rather than rendered as a nameless profile.
  final String name;

  final String? shortCode;
  final int? raceNumber;
  final DriverRole? role;

  /// The participation span. `null` bounds mean "from the season start" /
  /// "until the season end"; a bounded span is a mid-season arrival or exit and
  /// stays representable rather than being flattened away.
  final int? startRound;
  final int? endRound;

  bool get isFullSeason => startRound == null && endRound == null;
}

/// One team in a season's Explore list.
class SeasonTeamCard {
  const SeasonTeamCard({
    required this.season,
    required this.constructorId,
    required this.stableName,
    required this.orderIndex,
    this.seasonName,
    this.shortName,
    this.teamColor,
    this.nationality,
    this.countryCode,
    this.powerUnit,
    this.position,
    this.points,
    this.lineup = const <TeamLineupMember>[],
    this.hasLogoMedia = false,
  });

  final int season;

  /// The stable identifier, constant across rebranding. Navigation only.
  final String constructorId;

  /// The stable identity's name. Never null — an unresolved stub is omitted.
  final String stableName;

  /// This card's position in the teams list.
  ///
  /// A deterministic **product ordering rule**, not a provider-delivered one:
  /// the stable constructor name, which rebranding does not vary, so a rebrand
  /// never moves a team.
  final int orderIndex;

  /// The season-specific brand name, when the season entry carries one.
  final String? seasonName;

  final String? shortName;
  final String? teamColor;
  final String? nationality;
  final String? countryCode;
  final String? powerUnit;
  final int? position;
  final double? points;

  /// The season line-up in the roster's authoritative order.
  final List<TeamLineupMember> lineup;

  final bool hasLogoMedia;

  /// Season branding takes precedence for display; the stable identity is the
  /// fallback. Never the identifier.
  String get displayName => seasonName ?? shortName ?? stableName;
}

/// The Grand Prix a circuit hosts in one exact season.
///
/// Event identity and circuit identity stay separate: the event's lap count and
/// race distance belong here, never to the circuit.
class RelatedGrandPrixSummary {
  const RelatedGrandPrixSummary({
    required this.season,
    required this.round,
    this.name,
    this.officialName,
    this.startDate,
    this.endDate,
    this.status,
    this.format,
  });

  final int season;
  final int round;

  /// The event's display name, or `null` when it is not resolvable locally —
  /// presentation supplies localized unavailable copy, never the identifier.
  final String? name;

  final String? officialName;
  final String? startDate;
  final String? endDate;
  final EventStatus? status;
  final WeekendFormat? format;
}

/// One circuit in a season's Explore list.
class SeasonCircuitCard {
  const SeasonCircuitCard({
    required this.season,
    required this.circuitId,
    required this.name,
    required this.orderIndex,
    this.locality,
    this.country,
    this.countryCode,
    this.lengthMeters,
    this.cornerCount,
    this.relatedGrandPrix,
    this.hasLayoutMedia = false,
  });

  final int season;

  /// Stable identifier, for navigation only. Never a missing-name fallback.
  final String circuitId;

  /// Authoritative circuit name. Never null — an unresolved stub is omitted.
  final String name;

  /// The season's calendar order — the round of the event this circuit hosts.
  /// Unlike the drivers and teams collections, this order **is** authoritative:
  /// it comes from the provider's own calendar.
  final int orderIndex;

  final String? locality;
  final String? country;
  final String? countryCode;

  /// Stored in metres exactly as delivered; presentation converts for display.
  final int? lengthMeters;

  final int? cornerCount;

  /// The season-specific related event, or `null` when this circuit hosts none
  /// in this season. Never inferred from the circuit's name.
  final RelatedGrandPrixSummary? relatedGrandPrix;

  final bool hasLayoutMedia;
}
