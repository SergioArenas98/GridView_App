import '../../../../core/api/dto/event_dto.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/session.dart';

/// Maps a Grand Prix summary (as carried by Home/calendar responses) to a
/// domain [GrandPrix]. Summaries have no `officialName`, no media and no
/// embedded session list, so [sessions] is supplied separately (e.g. the
/// featured session from the Home view model).
GrandPrix grandPrixFromSummaryDto(
  GrandPrixSummaryDto dto, {
  List<Session> sessions = const <Session>[],
}) => GrandPrix(
  id: dto.id,
  season: dto.season,
  round: dto.round,
  eventSlug: dto.eventSlug,
  name: dto.name,
  circuitId: dto.circuitId,
  status: EventStatus.fromWire(dto.status),
  format: WeekendFormat.fromWire(dto.format),
  startDate: dto.startDate,
  endDate: dto.endDate,
  timezone: dto.timezone,
  sessions: sessions,
  hasResults: dto.hasResults,
);

/// Builds the host circuit summary from a Grand Prix summary, when the summary
/// carries the circuit's display name. Returns `null` when only the id is known
/// (the local layer then keeps any richer, previously-synced circuit row).
Circuit? circuitFromSummaryDto(GrandPrixSummaryDto dto) {
  final String? name = dto.circuitName;
  if (name == null) return null;
  return Circuit(id: dto.circuitId, name: name);
}
