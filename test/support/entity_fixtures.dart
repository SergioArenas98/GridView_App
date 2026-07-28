import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

/// Deterministic Explore/entity-detail fixtures.
///
/// They deliberately include the awkward cases the contract allows: a driver
/// with no team association, a driver with two mid-season participation spans, a
/// rebranded constructor, an unranked entrant, a confirmed zero, fractional
/// points and a circuit with no related event.

// --- Collection cards -------------------------------------------------------

SeasonDriverCard driverCard({
  required String driverId,
  required String name,
  required int order,
  int season = 2026,
  String? shortCode,
  int? raceNumber,
  DriverRole? role = DriverRole.race,
  String? nationality,
  String? countryCode,
  String? constructorId,
  String? teamName,
  String? teamColor,
  int? position,
  double? points,
  int spanCount = 1,
  bool hasPortraitMedia = false,
}) => SeasonDriverCard(
  season: season,
  driverId: driverId,
  name: name,
  orderIndex: order,
  shortCode: shortCode,
  raceNumber: raceNumber,
  role: role,
  nationality: nationality,
  countryCode: countryCode,
  constructorId: constructorId,
  teamName: teamName,
  teamColor: teamColor,
  position: position,
  points: points,
  spanCount: spanCount,
  hasPortraitMedia: hasPortraitMedia,
);

/// A realistic drivers collection: a leader, a fractional-points entrant, a
/// confirmed zero, a driver whose team is not resolvable and an unranked
/// reserve.
List<SeasonDriverCard> seasonDriverCardsFixture({int season = 2026}) =>
    <SeasonDriverCard>[
      driverCard(
        season: season,
        order: 0,
        driverId: 'max-verstappen',
        name: 'Max Verstappen',
        shortCode: 'VER',
        raceNumber: 1,
        nationality: 'Dutch',
        countryCode: 'NL',
        constructorId: 'red-bull',
        teamName: 'Oracle Red Bull Racing',
        teamColor: '#1E41FF',
        position: 2,
        points: 402.5,
      ),
      driverCard(
        season: season,
        order: 1,
        driverId: 'lando-norris',
        name: 'Lando Norris',
        shortCode: 'NOR',
        raceNumber: 4,
        nationality: 'British',
        constructorId: 'mclaren',
        teamName: 'McLaren Formula 1 Team',
        teamColor: '#FF8000',
        position: 1,
        points: 460.5,
      ),
      // Two participation spans: one identity, one card.
      driverCard(
        season: season,
        order: 2,
        driverId: 'franco-colapinto',
        name: 'Franco Colapinto',
        shortCode: 'COL',
        raceNumber: 43,
        constructorId: 'alpine',
        teamName: 'BWT Alpine Formula One Team',
        position: null,
        points: 0,
        spanCount: 2,
      ),
      // A real driver whose constructor is still an unresolved stub: no team
      // name, no team colour, and never the identifier in their place.
      driverCard(
        season: season,
        order: 3,
        driverId: 'unaffiliated-entrant',
        name: 'Unaffiliated Entrant',
        raceNumber: 55,
        constructorId: 'not-synced-team',
      ),
      // Unranked reserve: no position, no points at all.
      driverCard(
        season: season,
        order: 4,
        driverId: 'reserve-entrant',
        name: 'Reserve Entrant',
        role: DriverRole.reserve,
      ),
    ];

TeamLineupMember lineupMember({
  required String driverId,
  required String name,
  String? shortCode,
  int? raceNumber,
  DriverRole? role = DriverRole.race,
  int? startRound,
  int? endRound,
}) => TeamLineupMember(
  driverId: driverId,
  name: name,
  shortCode: shortCode,
  raceNumber: raceNumber,
  role: role,
  startRound: startRound,
  endRound: endRound,
);

SeasonTeamCard teamCard({
  required String constructorId,
  required String stableName,
  required int order,
  int season = 2026,
  String? seasonName,
  String? shortName,
  String? teamColor,
  String? nationality,
  String? countryCode,
  String? powerUnit,
  int? position,
  double? points,
  List<TeamLineupMember> lineup = const <TeamLineupMember>[],
  bool hasLogoMedia = false,
}) => SeasonTeamCard(
  season: season,
  constructorId: constructorId,
  stableName: stableName,
  orderIndex: order,
  seasonName: seasonName,
  shortName: shortName,
  teamColor: teamColor,
  nationality: nationality,
  countryCode: countryCode,
  powerUnit: powerUnit,
  position: position,
  points: points,
  lineup: lineup,
  hasLogoMedia: hasLogoMedia,
);

/// A realistic teams collection, including a rebranded constructor whose stable
/// identity is unchanged and a team with a mid-season line-up change.
List<SeasonTeamCard> seasonTeamCardsFixture({int season = 2026}) =>
    <SeasonTeamCard>[
      teamCard(
        season: season,
        order: 0,
        constructorId: 'alpine',
        stableName: 'Alpine',
        seasonName: 'BWT Alpine Formula One Team',
        shortName: 'Alpine',
        teamColor: '#0093CC',
        powerUnit: 'Renault',
        position: 6,
        points: 22,
        lineup: <TeamLineupMember>[
          lineupMember(
            driverId: 'pierre-gasly',
            name: 'Pierre Gasly',
            shortCode: 'GAS',
            raceNumber: 10,
          ),
          // Mid-season exit and arrival: two spans, both representable.
          lineupMember(
            driverId: 'jack-doohan',
            name: 'Jack Doohan',
            shortCode: 'DOO',
            raceNumber: 7,
            endRound: 6,
          ),
          lineupMember(
            driverId: 'franco-colapinto',
            name: 'Franco Colapinto',
            shortCode: 'COL',
            raceNumber: 43,
            startRound: 7,
          ),
        ],
      ),
      teamCard(
        season: season,
        order: 1,
        constructorId: 'mclaren',
        stableName: 'McLaren',
        seasonName: 'McLaren Formula 1 Team',
        teamColor: '#FF8000',
        powerUnit: 'Mercedes',
        position: 1,
        points: 460.5,
        lineup: <TeamLineupMember>[
          lineupMember(
            driverId: 'lando-norris',
            name: 'Lando Norris',
            shortCode: 'NOR',
            raceNumber: 4,
          ),
        ],
      ),
      // Rebranded: the season name differs from the stable identity, which is
      // itself unchanged and still decides the collection's order.
      teamCard(
        season: season,
        order: 2,
        constructorId: 'red-bull',
        stableName: 'Red Bull',
        seasonName: 'Oracle Red Bull Racing',
        teamColor: '#1E41FF',
        position: 2,
        points: 402.5,
        lineup: <TeamLineupMember>[
          lineupMember(
            driverId: 'max-verstappen',
            name: 'Max Verstappen',
            shortCode: 'VER',
            raceNumber: 1,
          ),
        ],
      ),
    ];

RelatedGrandPrixSummary relatedGrandPrix({
  int season = 2026,
  int round = 13,
  String? name = 'Belgian Grand Prix',
  String? startDate = '2026-07-24',
  String? endDate = '2026-07-26',
  EventStatus? status = EventStatus.upcoming,
  WeekendFormat? format = WeekendFormat.sprint,
}) => RelatedGrandPrixSummary(
  season: season,
  round: round,
  name: name,
  startDate: startDate,
  endDate: endDate,
  status: status,
  format: format,
);

SeasonCircuitCard circuitCard({
  required String circuitId,
  required String name,
  required int order,
  int season = 2026,
  String? locality,
  String? country,
  String? countryCode,
  int? lengthMeters,
  int? cornerCount,
  RelatedGrandPrixSummary? related,
  bool hasLayoutMedia = false,
}) => SeasonCircuitCard(
  season: season,
  circuitId: circuitId,
  name: name,
  orderIndex: order,
  locality: locality,
  country: country,
  countryCode: countryCode,
  lengthMeters: lengthMeters,
  cornerCount: cornerCount,
  relatedGrandPrix: related,
  hasLayoutMedia: hasLayoutMedia,
);

/// A realistic circuits collection in **calendar** order (round), which is
/// deliberately not alphabetical so a test can prove the authoritative order is
/// used.
List<SeasonCircuitCard> seasonCircuitCardsFixture({int season = 2026}) =>
    <SeasonCircuitCard>[
      circuitCard(
        season: season,
        order: 12,
        circuitId: 'monza',
        name: 'Autodromo Nazionale Monza',
        locality: 'Monza',
        country: 'Italy',
        countryCode: 'IT',
        lengthMeters: 5793,
        cornerCount: 11,
        related: relatedGrandPrix(
          season: season,
          round: 12,
          name: 'Italian Grand Prix',
          startDate: '2026-07-10',
          endDate: '2026-07-12',
          format: WeekendFormat.standard,
        ),
      ),
      circuitCard(
        season: season,
        order: 13,
        circuitId: 'spa-francorchamps',
        name: 'Circuit de Spa-Francorchamps',
        locality: 'Stavelot',
        country: 'Belgium',
        countryCode: 'BE',
        lengthMeters: 7004,
        cornerCount: 19,
        related: relatedGrandPrix(season: season),
      ),
    ];

// --- Detail profiles --------------------------------------------------------

DriverParticipation participation({
  required String constructorId,
  String? teamName,
  String? teamColor,
  int season = 2026,
  String? entryId,
  int? raceNumber,
  DriverRole? role = DriverRole.race,
  String? shortCode,
  int? startRound,
  int? endRound,
  String driverId = 'max-verstappen',
}) => DriverParticipation(
  entry: DriverSeasonEntry(
    id: entryId ?? '$season-$driverId-$constructorId',
    season: season,
    driverId: driverId,
    constructorId: constructorId,
    raceNumber: raceNumber,
    role: role,
    shortCode: shortCode,
    startRound: startRound,
    endRound: endRound,
  ),
  teamName: teamName,
  teamColor: teamColor,
);

/// A complete driver profile: identity, biography, one participation span and a
/// championship standing.
DriverProfile driverProfileFixture({
  int season = 2026,
  String driverId = 'max-verstappen',
  String name = 'Max Verstappen',
  String? shortCode = 'VER',
  int? permanentNumber = 33,
  String? nationality = 'Dutch',
  String? dateOfBirth = '1997-09-30',
  String? placeOfBirth = 'Hasselt, Belgium',
  String? biography =
      'A four-time Formula 1 World Champion known for exceptional racecraft.',
  List<DriverParticipation>? participations,
  DriverStanding? standing,
  bool withStanding = true,
}) => DriverProfile(
  driver: Driver(
    id: driverId,
    fullName: name,
    shortCode: shortCode,
    permanentNumber: permanentNumber,
    nationality: nationality,
    dateOfBirth: dateOfBirth,
    placeOfBirth: placeOfBirth,
    biography: biography,
  ),
  season: season,
  participations:
      participations ??
      <DriverParticipation>[
        participation(
          season: season,
          driverId: driverId,
          constructorId: 'red-bull',
          teamName: 'Oracle Red Bull Racing',
          teamColor: '#1E41FF',
          raceNumber: 1,
          shortCode: shortCode,
        ),
      ],
  standing: withStanding
      ? (standing ??
            DriverStanding(
              season: season,
              driverId: driverId,
              constructorId: 'red-bull',
              position: 2,
              points: 402.5,
              wins: 7,
              podiums: 14,
            ))
      : null,
);

/// A driver known only from the season collection: real identity, a season
/// entry, but no detail-owned biography or birth facts.
DriverProfile partialDriverProfileFixture({
  int season = 2026,
  String driverId = 'max-verstappen',
  String name = 'Max Verstappen',
}) => driverProfileFixture(
  season: season,
  driverId: driverId,
  name: name,
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  withStanding: false,
);

/// A complete team profile with a mid-season line-up.
TeamProfile teamProfileFixture({
  int season = 2026,
  String constructorId = 'alpine',
  String stableName = 'Alpine',
  String? seasonName = 'BWT Alpine Formula One Team',
  String? nationality = 'French',
  String? biography = 'The Enstone-based team competing as Alpine since 2021.',
  String? powerUnit = 'Renault',
  String? teamPrincipal = 'Team Principal',
  String? base = 'Enstone, United Kingdom',
  String? chassis = 'A526',
  ConstructorStanding? standing,
  List<TeamLineupMember>? lineup,
}) => TeamProfile(
  constructor: Constructor(
    id: constructorId,
    name: stableName,
    nationality: nationality,
    biography: biography,
    colorPrimary: '#0093CC',
  ),
  season: season,
  seasonEntry: ConstructorSeasonEntry(
    id: '$season-$constructorId',
    season: season,
    constructorId: constructorId,
    fullName: seasonName,
    shortName: stableName,
    colorPrimary: '#0093CC',
    powerUnit: powerUnit,
    teamPrincipal: teamPrincipal,
    base: base,
    chassis: chassis,
  ),
  standing:
      standing ??
      ConstructorStanding(
        season: season,
        constructorId: constructorId,
        position: 6,
        points: 22,
        wins: 0,
      ),
  lineup:
      lineup ??
      <TeamLineupMember>[
        lineupMember(
          driverId: 'pierre-gasly',
          name: 'Pierre Gasly',
          shortCode: 'GAS',
          raceNumber: 10,
        ),
        lineupMember(
          driverId: 'jack-doohan',
          name: 'Jack Doohan',
          shortCode: 'DOO',
          raceNumber: 7,
          endRound: 6,
        ),
        lineupMember(
          driverId: 'franco-colapinto',
          name: 'Franco Colapinto',
          shortCode: 'COL',
          raceNumber: 43,
          startRound: 7,
        ),
      ],
);

/// A team known only from the season collection: real identity and branding, but
/// no detail-owned facts or biography.
TeamProfile partialTeamProfileFixture({
  int season = 2026,
  String constructorId = 'alpine',
}) => TeamProfile(
  constructor: Constructor(id: constructorId, name: 'Alpine'),
  season: season,
  seasonEntry: ConstructorSeasonEntry(
    id: '$season-$constructorId',
    season: season,
    constructorId: constructorId,
    fullName: 'BWT Alpine Formula One Team',
  ),
);

/// A complete circuit profile with physical facts, a lap record and the season's
/// related event.
CircuitProfile circuitProfileFixture({
  int season = 2026,
  String circuitId = 'spa-francorchamps',
  String name = 'Circuit de Spa-Francorchamps',
  String? locality = 'Stavelot',
  String? country = 'Belgium',
  int? lengthMeters = 7004,
  int? cornerCount = 19,
  CircuitDirection? direction = CircuitDirection.clockwise,
  int? firstGrandPrixYear = 1950,
  LapRecord? lapRecord,
  bool withLapRecord = true,
  String? lapRecordDriverName = 'Valtteri Bottas',
  RelatedGrandPrixSummary? related,
  bool withRelated = true,
}) => CircuitProfile(
  circuit: Circuit(
    id: circuitId,
    name: name,
    locality: locality,
    country: country,
    lengthMeters: lengthMeters,
    cornerCount: cornerCount,
    direction: direction,
    firstGrandPrixYear: firstGrandPrixYear,
    lapRecord: withLapRecord
        ? (lapRecord ??
              const LapRecord(
                driverId: 'valtteri-bottas',
                time: Duration(minutes: 1, seconds: 46, milliseconds: 286),
                year: 2018,
              ))
        : null,
  ),
  season: season,
  relatedGrandPrix: withRelated
      ? (related ?? relatedGrandPrix(season: season))
      : null,
  lapRecordDriverName: lapRecordDriverName,
);
