import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/circuit.dart';
import '../../../features/shared/domain/entities/detail_views.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/grand_prix.dart';
import '../../../features/shared/domain/entities/media.dart';
import '../../../features/shared/domain/entities/session.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../tables.dart';

part 'calendar_dao.g.dart';

/// Local queries over the calendar spine plus full circuit persistence: ordered
/// calendars, the next and latest-completed events, the current session,
/// circuits by season and full circuit detail (with its physical facts, media
/// and related events).
///
/// Writes to the *event* tables are owned by [VerticalSliceDao] (Home / Grand
/// Prix snapshots), which persists only summary circuit rows. Full circuit
/// identity — the v2 physical/geographic columns and media — is written here via
/// [upsertCircuits]. Nothing Drift-shaped escapes: reads return domain entities
/// and domain views.
@DriftAccessor(tables: <Type>[GrandPrixEvents, Sessions, Circuits])
class CalendarDao extends DatabaseAccessor<GridViewDatabase>
    with _$CalendarDaoMixin {
  CalendarDao(super.db);

  // ---------------------------------------------------------------------------
  // Circuit identity writes
  // ---------------------------------------------------------------------------

  /// Upserts full circuit identities (all v1 + v2 columns) and refreshes their
  /// media (a non-null [Circuit.media] replaces it; an empty list clears it; a
  /// null list leaves existing media untouched).
  Future<void> upsertCircuits(List<Circuit> items) {
    return transaction(() async {
      for (final Circuit c in items) {
        validateSlug(c.id, field: 'circuit id');
        validateCountryCode(c.countryCode, field: 'circuit countryCode');
        await into(circuits).insertOnConflictUpdate(_circuitCompanion(c));
        if (c.media != null) {
          await attachedDatabase.mediaDao.replaceOwnerMedia(
            MediaEntityType.circuit,
            c.id,
            c.media!,
          );
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Calendar / events
  // ---------------------------------------------------------------------------

  /// The season calendar, ordered by round ascending, each event carrying its
  /// ordered sessions.
  Future<List<GrandPrix>> calendar(int season) async {
    final List<GrandPrixRow> rows =
        await (select(grandPrixEvents)
              ..where((GrandPrixEvents g) => g.season.equals(season))
              ..orderBy(<OrderClauseGenerator<GrandPrixEvents>>[
                (GrandPrixEvents g) => OrderingTerm(expression: g.round),
              ]))
            .get();
    final List<GrandPrix> events = <GrandPrix>[];
    for (final GrandPrixRow row in rows) {
      events.add(_grandPrixFrom(row, await _sessionsFor(row.id)));
    }
    return events;
  }

  /// The next event of the season: the earliest-dated event on or after [now]
  /// (round breaks ties). Returns `null` when the season has no upcoming event.
  Future<GrandPrix?> nextEvent(int season, DateTime now) async {
    final String today = _dateString(now);
    final GrandPrixRow? row =
        await (select(grandPrixEvents)
              ..where(
                (GrandPrixEvents g) =>
                    g.season.equals(season) &
                    g.startDate.isNotNull() &
                    g.startDate.isBiggerOrEqualValue(today),
              )
              ..orderBy(<OrderClauseGenerator<GrandPrixEvents>>[
                (GrandPrixEvents g) => OrderingTerm(expression: g.startDate),
                (GrandPrixEvents g) => OrderingTerm(expression: g.round),
              ])
              ..limit(1))
            .getSingleOrNull();
    if (row == null) return null;
    return _grandPrixFrom(row, await _sessionsFor(row.id));
  }

  /// The most recently finished event of the season: the latest event whose
  /// end date is strictly before [now].
  Future<GrandPrix?> latestCompletedEvent(int season, DateTime now) async {
    final String today = _dateString(now);
    final GrandPrixRow? row =
        await (select(grandPrixEvents)
              ..where(
                (GrandPrixEvents g) =>
                    g.season.equals(season) &
                    g.endDate.isNotNull() &
                    g.endDate.isSmallerThanValue(today),
              )
              ..orderBy(<OrderClauseGenerator<GrandPrixEvents>>[
                (GrandPrixEvents g) => OrderingTerm(
                  expression: g.endDate,
                  mode: OrderingMode.desc,
                ),
                (GrandPrixEvents g) =>
                    OrderingTerm(expression: g.round, mode: OrderingMode.desc),
              ])
              ..limit(1))
            .getSingleOrNull();
    if (row == null) return null;
    return _grandPrixFrom(row, await _sessionsFor(row.id));
  }

  /// The session in progress at [now] (its window contains [now]); the latest
  /// such session wins when several qualify. Returns `null` when none is live.
  Future<Session?> currentSession(DateTime now) async {
    final SessionRow? row =
        await (select(sessions)
              ..where(
                (Sessions s) =>
                    s.startTimeUtc.isSmallerOrEqualValue(now) &
                    (s.endTimeUtc.isNull() |
                        s.endTimeUtc.isBiggerOrEqualValue(now)),
              )
              ..orderBy(<OrderClauseGenerator<Sessions>>[
                (Sessions s) => OrderingTerm(
                  expression: s.startTimeUtc,
                  mode: OrderingMode.desc,
                ),
              ])
              ..limit(1))
            .getSingleOrNull();
    return row == null ? null : _sessionFrom(row);
  }

  // ---------------------------------------------------------------------------
  // Circuits
  // ---------------------------------------------------------------------------

  /// The distinct circuits hosting the season's events, ordered by name. These
  /// are summaries (no media); use [circuitDetail] for the full circuit.
  Future<List<Circuit>> circuitsForSeason(int season) async {
    final List<GrandPrixRow> events = await (select(
      grandPrixEvents,
    )..where((GrandPrixEvents g) => g.season.equals(season))).get();
    final Set<String> circuitIds = events
        .map((GrandPrixRow g) => g.circuitId)
        .toSet();
    if (circuitIds.isEmpty) return const <Circuit>[];

    final List<CircuitRow> rows =
        await (select(circuits)
              ..where((Circuits c) => c.id.isIn(circuitIds))
              ..orderBy(<OrderClauseGenerator<Circuits>>[
                (Circuits c) => OrderingTerm(expression: c.name),
              ]))
            .get();
    return rows.map((CircuitRow r) => _circuitFrom(r)).toList(growable: false);
  }

  /// Full circuit detail: the circuit (with its physical facts and media) plus
  /// the events it hosts, ordered by season then round.
  Future<CircuitDetailView?> circuitDetail(String circuitId) async {
    final CircuitRow? row = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(circuitId))).getSingleOrNull();
    if (row == null) return null;

    final List<MediaAsset> media = await attachedDatabase.mediaDao
        .mediaForOwner(MediaEntityType.circuit, circuitId);
    final List<GrandPrixRow> eventRows =
        await (select(grandPrixEvents)
              ..where((GrandPrixEvents g) => g.circuitId.equals(circuitId))
              ..orderBy(<OrderClauseGenerator<GrandPrixEvents>>[
                (GrandPrixEvents g) => OrderingTerm(expression: g.season),
                (GrandPrixEvents g) => OrderingTerm(expression: g.round),
              ]))
            .get();
    final List<GrandPrix> events = <GrandPrix>[];
    for (final GrandPrixRow e in eventRows) {
      events.add(_grandPrixFrom(e, await _sessionsFor(e.id)));
    }

    return CircuitDetailView(
      circuit: _circuitFrom(row, media: media),
      relatedGrandPrix: events,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Future<List<Session>> _sessionsFor(String grandPrixId) async {
    final List<SessionRow> rows =
        await (select(sessions)
              ..where((Sessions s) => s.grandPrixId.equals(grandPrixId))
              ..orderBy(<OrderClauseGenerator<Sessions>>[
                (Sessions s) => OrderingTerm(expression: s.orderIndex),
              ]))
            .get();
    return rows.map(_sessionFrom).toList(growable: false);
  }

  String _dateString(DateTime d) {
    final DateTime u = d.toUtc();
    final String y = u.year.toString().padLeft(4, '0');
    final String m = u.month.toString().padLeft(2, '0');
    final String day = u.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  // ---------------------------------------------------------------------------
  // Mapping (row -> domain)
  // ---------------------------------------------------------------------------

  GrandPrix _grandPrixFrom(GrandPrixRow r, List<Session> sessions) => GrandPrix(
    id: r.id,
    season: r.season,
    round: r.round,
    eventSlug: r.eventSlug,
    name: r.name,
    officialName: r.officialName,
    circuitId: r.circuitId,
    status: EventStatus.fromWire(r.status),
    format: WeekendFormat.fromWire(r.format),
    startDate: r.startDate,
    endDate: r.endDate,
    timezone: r.timezone,
    sessions: sessions,
    hasResults: r.hasResults,
  );

  Session _sessionFrom(SessionRow r) => Session(
    id: r.id,
    type: SessionType.fromWire(r.type),
    name: r.name,
    startTime: r.startTimeUtc,
    endTime: r.endTimeUtc,
    status: SessionStatus.fromWire(r.status),
  );

  CircuitsCompanion _circuitCompanion(Circuit c) => CircuitsCompanion.insert(
    id: c.id,
    name: c.name,
    locality: Value<String?>(c.locality),
    country: Value<String?>(c.country),
    countryCode: Value<String?>(c.countryCode),
    latitude: Value<double?>(c.latitude),
    longitude: Value<double?>(c.longitude),
    lengthMeters: Value<int?>(c.lengthMeters),
    cornerCount: Value<int?>(c.cornerCount),
    direction: Value<String?>(c.direction?.wire),
    firstGrandPrixYear: Value<int?>(c.firstGrandPrixYear),
    lapRecordDriverId: Value<String?>(c.lapRecord?.driverId),
    lapRecordTimeMillis: Value<int?>(c.lapRecord?.time?.inMilliseconds),
    lapRecordYear: Value<int?>(c.lapRecord?.year),
  );

  Circuit _circuitFrom(CircuitRow r, {List<MediaAsset>? media}) => Circuit(
    id: r.id,
    name: r.name,
    locality: r.locality,
    country: r.country,
    countryCode: r.countryCode,
    latitude: r.latitude,
    longitude: r.longitude,
    lengthMeters: r.lengthMeters,
    cornerCount: r.cornerCount,
    direction: r.direction == null
        ? null
        : CircuitDirection.fromWire(r.direction),
    firstGrandPrixYear: r.firstGrandPrixYear,
    lapRecord: _lapRecordFrom(r),
    media: media,
  );

  LapRecord? _lapRecordFrom(CircuitRow r) {
    if (r.lapRecordDriverId == null &&
        r.lapRecordTimeMillis == null &&
        r.lapRecordYear == null) {
      return null;
    }
    return LapRecord(
      driverId: r.lapRecordDriverId,
      time: r.lapRecordTimeMillis == null
          ? null
          : Duration(milliseconds: r.lapRecordTimeMillis!),
      year: r.lapRecordYear,
    );
  }
}
