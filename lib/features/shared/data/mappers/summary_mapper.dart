import '../../../../core/api/dto/summary_dto.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/constructor.dart';
import '../../domain/entities/driver.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/season_entry.dart';

// Maps the season-collection *summary* DTOs to the domain. A driver summary is
// one season participation span carrying its own entry id and bounds, so a
// driver with a mid-season move maps to several entries and nothing is
// synthesised. A constructor summary carries no entry id; its id is the
// canonical `<season>-<constructorId>` (one entry per team per season).

/// The compact circuit identity carried by a `CircuitSummary` (id, name and,
/// when present, locality/country code). The physical facts, lap record and
/// media stay with the circuit detail sync, so this entity deliberately leaves
/// them null — a null here means "not carried by this summary", never "delete".
Circuit circuitFromCircuitSummaryDto(CircuitSummaryDto dto) => Circuit(
  id: dto.id,
  name: dto.name,
  locality: dto.locality,
  countryCode: dto.countryCode,
);

/// The stable driver identity carried by a season-driver summary (name, code,
/// number, country). Biography and media are left to the driver detail sync.
Driver driverIdentityFromSeasonSummary(SeasonDriverSummaryDto dto) => Driver(
  id: dto.driverId,
  fullName: dto.fullName,
  shortCode: dto.shortCode,
  permanentNumber: dto.permanentNumber,
  countryCode: dto.countryCode,
);

/// Exactly the participation span a summary carries: its `entryId` verbatim —
/// never rebuilt from the season and driver — and its own `startRound` and
/// `endRound`. Null bounds stay null: they describe what has been observed,
/// never a whole season.
DriverSeasonEntry driverSeasonEntryFromSeasonSummary(
  SeasonDriverSummaryDto dto,
  int season,
) => DriverSeasonEntry(
  id: dto.entryId,
  season: season,
  driverId: dto.driverId,
  constructorId: dto.constructorId,
  raceNumber: dto.raceNumber,
  role: dto.role == null ? null : DriverRole.fromWire(dto.role!),
  shortCode: dto.shortCode,
  startRound: dto.startRound,
  endRound: dto.endRound,
);

/// The stable constructor identity carried by a season-constructor summary
/// (base name, short name, base colour). Season branding lives on the entry.
Constructor constructorIdentityFromSeasonSummary(
  SeasonConstructorSummaryDto dto,
) => Constructor(
  id: dto.constructorId,
  name: dto.name,
  shortName: dto.shortName,
  colorPrimary: dto.colorPrimary,
);

/// The constructor's season branding/identity from a summary. The line-up is
/// left null: it is derived from the season's driver entries.
ConstructorSeasonEntry constructorSeasonEntryFromSeasonSummary(
  SeasonConstructorSummaryDto dto,
  int season,
) => ConstructorSeasonEntry(
  id: '$season-${dto.constructorId}',
  season: season,
  constructorId: dto.constructorId,
  fullName: dto.fullName,
  shortName: dto.shortName,
  colorPrimary: dto.colorPrimary,
  colorSecondary: dto.colorSecondary,
  powerUnit: dto.powerUnit,
);
