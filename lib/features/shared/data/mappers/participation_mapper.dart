import '../../../../core/api/dto/season_entry_dto.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/season_entry.dart';

DriverSeasonEntry driverSeasonEntryFromDto(DriverSeasonEntryDto dto) =>
    DriverSeasonEntry(
      id: dto.id,
      season: dto.season,
      driverId: dto.driverId,
      constructorId: dto.constructorId,
      raceNumber: dto.raceNumber,
      role: dto.role == null ? null : DriverRole.fromWire(dto.role),
      shortCode: dto.shortCode,
      startRound: dto.startRound,
      endRound: dto.endRound,
    );

ConstructorSeasonEntry constructorSeasonEntryFromDto(
  ConstructorSeasonEntryDto dto,
) => ConstructorSeasonEntry(
  id: dto.id,
  season: dto.season,
  constructorId: dto.constructorId,
  fullName: dto.fullName,
  shortName: dto.shortName,
  colorPrimary: dto.colorPrimary,
  colorSecondary: dto.colorSecondary,
  powerUnit: dto.powerUnit,
  teamPrincipal: dto.teamPrincipal,
  base: dto.base,
  chassis: dto.chassis,
  driverLineup: dto.driverLineup,
);
