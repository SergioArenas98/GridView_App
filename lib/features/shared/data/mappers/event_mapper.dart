import '../../../../core/api/dto/event_dto.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/session.dart';
import 'media_mapper.dart';
import 'wire.dart';

Session sessionFromDto(SessionDto dto) => Session(
  id: dto.id,
  type: SessionType.fromWire(dto.type),
  name: dto.name,
  startTime: instantFromWire(dto.startTime),
  endTime: instantFromWire(dto.endTime),
  status: SessionStatus.fromWire(dto.status),
);

GrandPrix grandPrixFromDto(GrandPrixDto dto) => GrandPrix(
  id: dto.id,
  season: dto.season,
  round: dto.round,
  eventSlug: dto.eventSlug,
  name: dto.name,
  officialName: dto.officialName,
  circuitId: dto.circuitId,
  status: EventStatus.fromWire(dto.status),
  format: WeekendFormat.fromWire(dto.format),
  startDate: dto.startDate,
  endDate: dto.endDate,
  timezone: dto.timezone,
  sessions: dto.sessions.map(sessionFromDto).toList(),
  hasResults: dto.hasResults,
  media: mediaListFromDto(dto.media),
);
