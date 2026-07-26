import '../../../../core/api/dto/summary_dto.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/constructor.dart';
import '../../domain/entities/driver.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/season_entry.dart';

// Maps the season-collection *summary* DTOs to the domain. Summaries carry a
// competitor's stable identity fields plus their season participation, but no
// composite entry id, so the participation id is synthesised deterministically
// from the season and stable id (`<season>-<slug>`) — stable across syncs and
// unique within the season (one summary per competitor per season).

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

/// The driver's season participation from a summary. `startRound`/`endRound` are
/// null (whole season); a mid-season split is expressed by the detail sync.
DriverSeasonEntry driverSeasonEntryFromSeasonSummary(
  SeasonDriverSummaryDto dto,
  int season,
) => DriverSeasonEntry(
  id: '$season-${dto.driverId}',
  season: season,
  driverId: dto.driverId,
  constructorId: dto.constructorId,
  raceNumber: dto.raceNumber,
  role: dto.role == null ? null : DriverRole.fromWire(dto.role!),
  shortCode: dto.shortCode,
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
