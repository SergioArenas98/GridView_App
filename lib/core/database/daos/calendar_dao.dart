import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/calendar_entry.dart';
import '../../../features/shared/domain/entities/circuit.dart';
import '../../../features/shared/domain/entities/detail_views.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/grand_prix.dart';
import '../../../features/shared/domain/entities/media.dart';
import '../../../features/shared/domain/entities/session.dart';
import '../../../features/shared/domain/relevant_event.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../tables.dart';
import '../unresolved_identity.dart';

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
        validateDisplayName(c.name, field: 'circuit name');
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

  /// Upserts the *compact* circuit identity carried by a `CircuitSummary`
  /// (id, name and — when supplied — locality and country code) without ever
  /// clobbering the richer detail-synced columns (coordinates, length, corner
  /// count, direction, first Grand Prix year, lap record) or media.
  ///
  /// An optional field the summary omits is **not** a deletion instruction: it
  /// is simply left out of the companion, so the stored value survives.
  Future<void> upsertCircuitSummaries(List<Circuit> items) {
    return transaction(() async {
      for (final Circuit c in items) {
        validateSlug(c.id, field: 'circuit id');
        validateDisplayName(c.name, field: 'circuit name');
        validateCountryCode(c.countryCode, field: 'circuit countryCode');
        await into(
          circuits,
        ).insertOnConflictUpdate(_compactCircuitCompanion(c));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Calendar collection write (season-scoped replacement)
  // ---------------------------------------------------------------------------

  /// Replaces a season's calendar with [events] (Grand Prix summaries) and their
  /// host [circuits] (summaries), in one transaction. Preserves unrelated
  /// seasons. Events absent from [events] are removed (cascading their
  /// sessions); events that persist keep their detail-synced sessions,
  /// `officialName` and media (the summary companion leaves those columns
  /// untouched). This is authoritative for which events exist in the season; it
  /// never invents sessions (calendar summaries carry none).
  Future<void> replaceCalendar(
    int season,
    List<GrandPrix> events,
    List<Circuit> hostCircuits,
  ) {
    return transaction(() async {
      validateSeason(season);
      for (final GrandPrix e in events) {
        validateSlug(e.id, field: 'grand prix id');
        validateSlug(e.circuitId, field: 'circuitId');
        validateSeason(e.season, field: 'event season');
        validateRound(e.round, field: 'event round');
      }
      for (final Circuit c in hostCircuits) {
        validateSlug(c.id, field: 'circuit id');
        validateDisplayName(c.name, field: 'circuit name');
        validateCountryCode(c.countryCode, field: 'circuit countryCode');
      }

      await attachedDatabase.seasonDao.ensureSeason(season);

      // Summary circuits refresh only the columns they carry (id + name),
      // preserving richer detail-synced circuit facts and media.
      for (final Circuit c in hostCircuits) {
        await into(
          circuits,
        ).insertOnConflictUpdate(_summaryCircuitCompanion(c));
      }
      // Ensure every referenced circuit exists (FK), without clobbering names.
      for (final GrandPrix e in events) {
        await ensureCircuitIdentity(e.circuitId);
      }

      final Set<String> keepIds = events.map((GrandPrix e) => e.id).toSet();
      await (delete(grandPrixEvents)..where(
            (GrandPrixEvents g) =>
                g.season.equals(season) & g.id.isNotIn(keepIds),
          ))
          .go();

      for (final GrandPrix e in events) {
        await into(
          grandPrixEvents,
        ).insertOnConflictUpdate(_summaryEventCompanion(e));
      }
    });
  }

  /// Streams the season calendar; re-emits after any calendar/session commit.
  Stream<List<GrandPrix>> watchCalendar(int season) => _watch(
    <ResultSetImplementation<dynamic, dynamic>>[grandPrixEvents, sessions],
    () => calendar(season),
  );

  /// The season calendar joined with each event's host circuit summary, in the
  /// persisted round order. The circuit is `null` only when its row is absent.
  Future<List<CalendarEntry>> calendarEntries(int season) async {
    final List<GrandPrix> events = await calendar(season);
    if (events.isEmpty) return const <CalendarEntry>[];

    final Set<String> circuitIds = events
        .map((GrandPrix e) => e.circuitId)
        .toSet();
    final List<CircuitRow> rows = await (select(
      circuits,
    )..where((Circuits c) => c.id.isIn(circuitIds))).get();
    // An identity that is still an unresolved referential stub is not a domain
    // circuit, so it is treated exactly like an absent row: the entry carries no
    // circuit rather than a name derived from the identifier.
    final Map<String, Circuit> byId = <String, Circuit>{
      for (final CircuitRow r in rows)
        if (!isUnresolvedIdentityName(r.name)) r.id: _circuitFrom(r),
    };

    return events
        .map(
          (GrandPrix e) =>
              CalendarEntry(grandPrix: e, circuit: byId[e.circuitId]),
        )
        .toList(growable: false);
  }

  /// Streams [calendarEntries]; re-emits after any calendar/session/circuit
  /// commit.
  Stream<List<CalendarEntry>> watchCalendarEntries(int season) =>
      _watch(<ResultSetImplementation<dynamic, dynamic>>[
        grandPrixEvents,
        sessions,
        circuits,
      ], () => calendarEntries(season));

  Future<int> countEventsForSeason(int season) async {
    final List<GrandPrixRow> rows = await (select(
      grandPrixEvents,
    )..where((GrandPrixEvents g) => g.season.equals(season))).get();
    return rows.length;
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

  /// The season's relevant event at [now]: the one in progress, else the next
  /// eligible one. Returns `null` when the season has nothing left to show.
  ///
  /// The rule itself lives in [resolveRelevantEvent] so Home, the Calendar
  /// screen and this query can never disagree; the DAO only supplies the
  /// authoritative chronology it already stores (a season is at most a few dozen
  /// rows, so resolving in Dart costs nothing and keeps one implementation).
  Future<GrandPrix?> nextEvent(int season, DateTime now) async {
    final RelevantEvent? relevant = resolveRelevantEvent(
      await calendar(season),
      now,
    );
    return relevant?.event;
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
    // A referential stub is never a collection member.
    return rows
        .where((CircuitRow r) => !isUnresolvedIdentityName(r.name))
        .map((CircuitRow r) => _circuitFrom(r))
        .toList(growable: false);
  }

  /// Streams the circuits used in a season (derived from the season's events);
  /// re-emits after any circuit/event commit.
  Stream<List<Circuit>> watchCircuitsForSeason(int season) => _watch(
    <ResultSetImplementation<dynamic, dynamic>>[grandPrixEvents, circuits],
    () => circuitsForSeason(season),
  );

  /// Streams full circuit detail; re-emits after any circuit/event/session/media
  /// commit.
  Stream<CircuitDetailView?> watchCircuitDetail(String circuitId) =>
      _watch(<ResultSetImplementation<dynamic, dynamic>>[
        circuits,
        grandPrixEvents,
        sessions,
        attachedDatabase.circuitMedia,
        attachedDatabase.mediaAssets,
        attachedDatabase.mediaAssetVariants,
      ], () => circuitDetail(circuitId));

  Future<int> countCircuit(String id) async {
    final CircuitRow? row = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(id))).getSingleOrNull();
    return row == null ? 0 : 1;
  }

  Future<int> countCircuits() async {
    final List<CircuitRow> rows = await select(circuits).get();
    return rows.length;
  }

  /// Full circuit detail: the circuit (with its physical facts and media) plus
  /// the events it hosts, ordered by season then round.
  Future<CircuitDetailView?> circuitDetail(String circuitId) async {
    final CircuitRow? row = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(circuitId))).getSingleOrNull();
    // A row that exists only to satisfy a foreign key is not a materialized
    // circuit detail.
    if (row == null || isUnresolvedIdentityName(row.name)) return null;

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

  /// Emits an initial value, then re-emits after any commit to [tables].
  Stream<T> _watch<T>(
    List<ResultSetImplementation<dynamic, dynamic>> tables,
    Future<T> Function() read,
  ) async* {
    yield await read();
    yield* attachedDatabase
        .tableUpdates(TableUpdateQuery.onAllTables(tables))
        .asyncMap((_) => read());
  }

  /// Ensures a `circuits` row exists for [id] as a **referential stub** — the
  /// single creation path for one, shared with [VerticalSliceDao].
  ///
  /// An event can be persisted before the circuit collection has synchronised.
  /// The stored name is [kUnresolvedIdentityName], never a name derived from the
  /// identifier. `INSERT OR IGNORE` makes this idempotent and means a circuit
  /// identity that already synchronised is never downgraded.
  Future<void> ensureCircuitIdentity(String id) => into(circuits).insert(
    CircuitsCompanion.insert(id: id, name: kUnresolvedIdentityName),
    mode: InsertMode.insertOrIgnore,
  );

  /// A partial circuit companion carrying only the summary columns (id + name),
  /// so an upsert never clobbers detail-synced physical facts or media.
  CircuitsCompanion _summaryCircuitCompanion(Circuit c) =>
      CircuitsCompanion.insert(id: c.id, name: c.name);

  /// A partial circuit companion for a compact `CircuitSummary`: id and name,
  /// plus locality/country code **only when the summary carries them**. Absent
  /// optional values are omitted from the companion rather than written as
  /// null, so an upsert never erases richer stored data.
  CircuitsCompanion _compactCircuitCompanion(Circuit c) =>
      CircuitsCompanion.insert(
        id: c.id,
        name: c.name,
        locality: c.locality == null
            ? const Value<String?>.absent()
            : Value<String?>(c.locality),
        countryCode: c.countryCode == null
            ? const Value<String?>.absent()
            : Value<String?>(c.countryCode),
      );

  /// A partial event companion carrying only the summary columns; `officialName`
  /// and sessions are left untouched so a detail sync's richer data survives.
  GrandPrixEventsCompanion _summaryEventCompanion(GrandPrix g) =>
      GrandPrixEventsCompanion.insert(
        id: g.id,
        season: g.season,
        round: g.round,
        eventSlug: g.eventSlug,
        name: g.name,
        circuitId: g.circuitId,
        status: g.status.wire,
        format: g.format.wire,
        startDate: Value<String?>(g.startDate),
        endDate: Value<String?>(g.endDate),
        timezone: Value<String?>(g.timezone),
        hasResults: Value<bool>(g.hasResults),
      );

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
