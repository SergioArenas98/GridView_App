// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/database/daos/calendar_dao.dart';
import '../../domain/entities/calendar_entry.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/calendar_repository.dart';
import '../mappers/home_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// Reads the season calendar from the local database and refreshes it via a
/// conditional remote read. A refresh replaces the season's calendar
/// authoritatively (events absent from the payload are removed, cascading their
/// sessions), while preserving unrelated seasons and any richer detail-synced
/// data (sessions, official name, media) on events that persist.
class CalendarRepositoryImpl extends SyncedRepository
    implements CalendarRepository {
  CalendarRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required CalendarDao local,
  }) : _local = local;

  final CalendarDao _local;

  @override
  Stream<List<CalendarEntry>> watchCalendar(int season) =>
      _local.watchCalendarEntries(season);

  @override
  Future<List<CalendarEntry>> readCalendar(int season) =>
      _local.calendarEntries(season);

  @override
  Future<RefreshResult> refreshCalendar(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<List<GrandPrixSummaryDto>>(
      key: ResourceKey.calendar(season),
      scope: ResourceScope(season: season),
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchCalendar(
            season: season,
            etag: etag,
            cancellation: cancellation,
          ),
      metaOf: (RemoteModified<List<GrandPrixSummaryDto>> m) =>
          RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
      writeDomain: (RemoteModified<List<GrandPrixSummaryDto>> m) {
        final List<GrandPrix> events = m.data
            .map((GrandPrixSummaryDto e) => grandPrixFromSummaryDto(e))
            .toList(growable: false);
        final List<Circuit> hostCircuits = <Circuit>[
          for (final GrandPrixSummaryDto e in m.data)
            if (circuitFromSummaryDto(e) case final Circuit c) c,
        ];
        return _local.replaceCalendar(season, events, hostCircuits);
      },
      // A season calendar is an authoritative collection: a successful sync
      // materializes it even when the season legitimately has no events.
      hasLocalRepresentation: collectionRepresentation,
      bypassValidator: bypassValidator,
      cancellation: cancellation,
    );
  }
}
