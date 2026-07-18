import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/constructor_dto.dart';
import '../../../../core/api/dto/driver_dto.dart';
import '../../../../core/api/dto/season_dto.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/constructor.dart';
import '../../domain/entities/driver.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/season.dart';
import 'media_mapper.dart';
import 'wire.dart';

Season seasonFromDto(SeasonDto dto) => Season(
  year: dto.year,
  label: dto.label,
  status: SeasonStatus.fromWire(dto.status),
  startDate: dto.startDate,
  endDate: dto.endDate,
  roundCount: dto.roundCount,
  currentRound: dto.currentRound,
  isCurrent: dto.isCurrent,
);

Driver driverFromDto(DriverDto dto) => Driver(
  id: dto.id,
  fullName: dto.fullName,
  givenName: dto.givenName,
  familyName: dto.familyName,
  shortCode: dto.shortCode,
  permanentNumber: dto.permanentNumber,
  nationality: dto.nationality,
  countryCode: dto.countryCode,
  dateOfBirth: dto.dateOfBirth,
  placeOfBirth: dto.placeOfBirth,
  biography: dto.biography,
  media: mediaListFromDto(dto.media),
);

Constructor constructorFromDto(ConstructorDto dto) => Constructor(
  id: dto.id,
  name: dto.name,
  shortName: dto.shortName,
  nationality: dto.nationality,
  countryCode: dto.countryCode,
  colorPrimary: dto.colorPrimary,
  biography: dto.biography,
  media: mediaListFromDto(dto.media),
);

LapRecord? lapRecordFromDto(LapRecordDto? dto) => dto == null
    ? null
    : LapRecord(
        driverId: dto.driverId,
        time: durationFromMillis(dto.timeMillis),
        year: dto.year,
      );

Circuit circuitFromDto(CircuitDto dto) => Circuit(
  id: dto.id,
  name: dto.name,
  locality: dto.locality,
  country: dto.country,
  countryCode: dto.countryCode,
  latitude: dto.latitude,
  longitude: dto.longitude,
  lengthMeters: dto.lengthMeters,
  cornerCount: dto.cornerCount,
  direction: dto.direction == null
      ? null
      : CircuitDirection.fromWire(dto.direction),
  firstGrandPrixYear: dto.firstGrandPrixYear,
  lapRecord: lapRecordFromDto(dto.lapRecord),
  media: mediaListFromDto(dto.media),
);
