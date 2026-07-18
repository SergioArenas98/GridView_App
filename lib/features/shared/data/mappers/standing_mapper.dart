import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../domain/entities/freshness.dart';
import '../../domain/entities/standing.dart';
import 'wire.dart';

DriverStanding driverStandingFromDto(DriverStandingDto dto) => DriverStanding(
  season: dto.season,
  driverId: dto.driverId,
  constructorId: dto.constructorId,
  position: dto.position,
  points: dto.points,
  wins: dto.wins,
  podiums: dto.podiums,
  provisional: dto.provisional,
);

ConstructorStanding constructorStandingFromDto(ConstructorStandingDto dto) =>
    ConstructorStanding(
      season: dto.season,
      constructorId: dto.constructorId,
      position: dto.position,
      points: dto.points,
      wins: dto.wins,
      provisional: dto.provisional,
    );

DataFreshness dataFreshnessFromDto(DataFreshnessDto dto) => DataFreshness(
  generatedAt: DateTime.parse(dto.generatedAt).toUtc(),
  sourceUpdatedAt: instantFromWire(dto.sourceUpdatedAt),
  staleAfter: instantFromWire(dto.staleAfter),
  contentVersion: dto.contentVersion,
  stale: dto.stale,
);
