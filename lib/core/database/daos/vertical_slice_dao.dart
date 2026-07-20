import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/circuit.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/freshness.dart';
import '../../../features/shared/domain/entities/grand_prix.dart';
import '../../../features/shared/domain/entities/grand_prix_view.dart';
import '../../../features/shared/domain/entities/home_view.dart';
import '../../../features/shared/domain/entities/season.dart';
import '../../../features/shared/domain/entities/session.dart';
import '../gridview_database.dart';
import '../tables.dart';

part 'vertical_slice_dao.g.dart';

/// The outcome of a snapshot write.
///
/// - [applied]: the incoming snapshot was newer and was written.
/// - [rejectedOlder]: the incoming snapshot was older than the cached one and
///   was not written (protects newer cached data).
/// - [skippedUpToDate]: the incoming snapshot is the same revision as the cached
///   one (equal `sourceUpdatedAt` and `contentVersion`); it was intentionally
///   not rewritten, so no rows change and no stream re-emits.
///
/// Both [rejectedOlder] and [skippedUpToDate] are non-writes and map to
/// `RefreshSuccess(applied: false)` at the repository boundary.
enum SnapshotWriteOutcome { applied, rejectedOlder, skippedUpToDate }

/// Local data source for the Phase 4 vertical slice.
///
/// This is the only place Drift rows exist. Reads return domain entities and
/// domain views; writes accept domain entities and translate them to Drift
/// companions inside a single transaction. Nothing Drift-shaped escapes.
@DriftAccessor(
  tables: <Type>[Seasons, Circuits, GrandPrixEvents, Sessions, Snapshots],
)
class VerticalSliceDao extends DatabaseAccessor<GridViewDatabase>
    with _$VerticalSliceDaoMixin {
  VerticalSliceDao(super.db);

  static const String homeSnapshotKey = 'home';

  static String grandPrixSnapshotKey(int season, int round) =>
      'grand_prix:$season:$round';

  // ---------------------------------------------------------------------------
  // Reads (Drift-backed streams -> domain views)
  // ---------------------------------------------------------------------------

  /// Streams the Home aggregate. Emits `null` until a Home snapshot exists.
  /// Re-emits whenever the Home snapshot is (re)written.
  Stream<HomeView?> watchHome() {
    final query = select(snapshots)
      ..where((Snapshots s) => s.key.equals(homeSnapshotKey));
    return query.watchSingleOrNull().asyncMap(_composeHome);
  }

  Future<HomeView?> _composeHome(SnapshotRow? snap) async {
    if (snap == null) return null;
    final int? season = snap.focusSeason;
    final int? round = snap.focusRound;
    if (season == null || round == null) return null;

    final GrandPrixRow? gpRow = await _grandPrixRow(season, round);
    if (gpRow == null) return null;

    final List<Session> sessions = await _sessionsFor(gpRow.id);
    final SeasonRow? seasonRow = await (select(
      seasons,
    )..where((Seasons s) => s.year.equals(season))).getSingleOrNull();
    final CircuitRow? circuitRow = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(gpRow.circuitId))).getSingleOrNull();

    return HomeView(
      season: seasonRow == null ? null : _seasonFrom(seasonRow),
      featured: _grandPrixFrom(gpRow, sessions),
      circuit: circuitRow == null ? null : _circuitFrom(circuitRow),
      freshness: _freshnessFrom(snap),
    );
  }

  /// Streams the Grand Prix detail aggregate for (season, round). Emits `null`
  /// until the Grand Prix has been cached. Re-emits whenever its row is written
  /// (both Home and detail syncs upsert the row).
  Stream<GrandPrixDetailView?> watchGrandPrix(int season, int round) {
    final query = select(grandPrixEvents)
      ..where(
        (GrandPrixEvents g) => g.season.equals(season) & g.round.equals(round),
      );
    return query.watchSingleOrNull().asyncMap(
      (GrandPrixRow? row) => _composeGrandPrix(row, season, round),
    );
  }

  Future<GrandPrixDetailView?> _composeGrandPrix(
    GrandPrixRow? gpRow,
    int season,
    int round,
  ) async {
    if (gpRow == null) return null;
    final List<Session> sessions = await _sessionsFor(gpRow.id);
    final CircuitRow? circuitRow = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(gpRow.circuitId))).getSingleOrNull();
    final SnapshotRow? snap = await _snapshotByKey(
      grandPrixSnapshotKey(season, round),
    );
    return GrandPrixDetailView(
      grandPrix: _grandPrixFrom(gpRow, sessions),
      circuit: circuitRow == null ? null : _circuitFrom(circuitRow),
      freshness: snap == null ? null : _freshnessFrom(snap),
    );
  }

  Future<GrandPrixRow?> _grandPrixRow(int season, int round) =>
      (select(grandPrixEvents)..where(
            (GrandPrixEvents g) =>
                g.season.equals(season) & g.round.equals(round),
          ))
          .getSingleOrNull();

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

  Future<SnapshotRow?> _snapshotByKey(String key) => (select(
    snapshots,
  )..where((Snapshots s) => s.key.equals(key))).getSingleOrNull();

  // ---------------------------------------------------------------------------
  // Writes (atomic snapshot transactions with the conflict rule)
  // ---------------------------------------------------------------------------

  /// Applies a Home snapshot in one transaction. Idempotent for an equal
  /// `generatedAt`; rejected when the incoming snapshot is older than the
  /// cached one. Featured sessions are upserted additively — the detail sync
  /// owns authoritative full-session replacement.
  Future<SnapshotWriteOutcome> writeHomeSnapshot({
    Season? season,
    required GrandPrix featured,
    Circuit? featuredCircuit,
    required DataFreshness freshness,
  }) {
    return transaction(() async {
      final SnapshotRow? existing = await _snapshotByKey(homeSnapshotKey);
      final SnapshotWriteOutcome decision = _decideOutcome(freshness, existing);
      if (decision != SnapshotWriteOutcome.applied) return decision;

      if (season != null) {
        await into(seasons).insertOnConflictUpdate(_seasonCompanion(season));
      }
      await _ensureSeason(featured.season);

      if (featuredCircuit != null) {
        await into(
          circuits,
        ).insertOnConflictUpdate(_circuitCompanion(featuredCircuit));
      } else {
        await _ensureCircuit(featured.circuitId);
      }

      await into(
        grandPrixEvents,
      ).insertOnConflictUpdate(_grandPrixCompanion(featured));

      for (final Session s in featured.sessions) {
        await into(sessions).insertOnConflictUpdate(
          _sessionCompanion(s, featured.id, _canonicalOrder(s.type)),
        );
      }

      await into(snapshots).insertOnConflictUpdate(
        _snapshotCompanion(
          homeSnapshotKey,
          freshness,
          focusSeason: featured.season,
          focusRound: featured.round,
        ),
      );
      return SnapshotWriteOutcome.applied;
    });
  }

  /// Applies a Grand Prix detail snapshot in one transaction. Idempotent for an
  /// equal `generatedAt`; rejected when older than the cached snapshot.
  /// Sessions are replaced wholesale so obsolete sessions never linger and no
  /// duplicates are produced.
  Future<SnapshotWriteOutcome> writeGrandPrixSnapshot({
    required GrandPrix grandPrix,
    required DataFreshness freshness,
  }) {
    final String key = grandPrixSnapshotKey(grandPrix.season, grandPrix.round);
    return transaction(() async {
      final SnapshotRow? existing = await _snapshotByKey(key);
      final SnapshotWriteOutcome decision = _decideOutcome(freshness, existing);
      if (decision != SnapshotWriteOutcome.applied) return decision;

      await _ensureSeason(grandPrix.season);
      await _ensureCircuit(grandPrix.circuitId);
      await into(
        grandPrixEvents,
      ).insertOnConflictUpdate(_grandPrixCompanion(grandPrix));

      await (delete(
        sessions,
      )..where((Sessions s) => s.grandPrixId.equals(grandPrix.id))).go();
      for (int i = 0; i < grandPrix.sessions.length; i++) {
        await into(
          sessions,
        ).insert(_sessionCompanion(grandPrix.sessions[i], grandPrix.id, i));
      }

      await into(
        snapshots,
      ).insertOnConflictUpdate(_snapshotCompanion(key, freshness));
      return SnapshotWriteOutcome.applied;
    });
  }

  /// Decides whether an incoming snapshot should be applied, rejected as older,
  /// or skipped as an identical revision.
  ///
  /// **`sourceUpdatedAt` is the primary conflict boundary** — the age/revision
  /// of the underlying source data. A snapshot *generated* later can still carry
  /// *older* source data, so `generatedAt` must never outrank `sourceUpdatedAt`.
  ///
  /// 1. incoming source older than stored → reject.
  /// 2. incoming source newer than stored → apply.
  /// 3. equal source + equal `contentVersion` → skip (idempotent, no rewrite).
  /// 4. equal source + differing `contentVersion` → `generatedAt` is a
  ///    deterministic tie-breaker: a strictly later `generatedAt` applies; an
  ///    equal or earlier one is rejected.
  ///
  /// `contentVersion` is compared by equality only (never assumed sortable).
  /// When `sourceUpdatedAt` is unavailable on either side (older data that
  /// predates the field), ordering falls back to `generatedAt`.
  SnapshotWriteOutcome _decideOutcome(
    DataFreshness incoming,
    SnapshotRow? existing,
  ) {
    if (existing == null) return SnapshotWriteOutcome.applied;

    final DateTime? incomingSource = incoming.sourceUpdatedAt;
    final DateTime? storedSource = existing.sourceUpdatedAt;

    if (incomingSource != null && storedSource != null) {
      if (incomingSource.isBefore(storedSource)) {
        return SnapshotWriteOutcome.rejectedOlder;
      }
      if (incomingSource.isAfter(storedSource)) {
        return SnapshotWriteOutcome.applied;
      }
      // Equal source revision.
      if (incoming.contentVersion == existing.contentVersion) {
        return SnapshotWriteOutcome.skippedUpToDate;
      }
      // Differing content at the same source revision: generatedAt tie-break.
      return incoming.generatedAt.isAfter(existing.generatedAt)
          ? SnapshotWriteOutcome.applied
          : SnapshotWriteOutcome.rejectedOlder;
    }

    // Fallback: no comparable source revision — order by generatedAt.
    if (incoming.generatedAt.isBefore(existing.generatedAt)) {
      return SnapshotWriteOutcome.rejectedOlder;
    }
    if (incoming.generatedAt.isAfter(existing.generatedAt)) {
      return SnapshotWriteOutcome.applied;
    }
    return incoming.contentVersion == existing.contentVersion
        ? SnapshotWriteOutcome.skippedUpToDate
        : SnapshotWriteOutcome.applied;
  }

  /// Ensures a minimal season row exists so Grand Prix foreign keys resolve.
  /// Never clobbers a fully-synchronised season row.
  Future<void> _ensureSeason(int year) => into(seasons).insert(
    SeasonsCompanion.insert(
      year: Value<int>(year),
      status: SeasonStatus.unknown.wire,
    ),
    mode: InsertMode.insertOrIgnore,
  );

  /// Ensures a circuit row exists (non-authoritative name), preserving any
  /// real name already synchronised from a Home/calendar snapshot.
  Future<void> _ensureCircuit(String id) => into(circuits).insert(
    CircuitsCompanion.insert(id: id, name: _humanizeSlug(id)),
    mode: InsertMode.insertOrIgnore,
  );

  // ---------------------------------------------------------------------------
  // Companion builders (domain -> Drift)
  // ---------------------------------------------------------------------------

  SeasonsCompanion _seasonCompanion(Season s) => SeasonsCompanion.insert(
    year: Value<int>(s.year),
    status: s.status.wire,
    label: Value<String?>(s.label),
    startDate: Value<String?>(s.startDate),
    endDate: Value<String?>(s.endDate),
    roundCount: Value<int?>(s.roundCount),
    currentRound: Value<int?>(s.currentRound),
    isCurrent: Value<bool>(s.isCurrent),
  );

  CircuitsCompanion _circuitCompanion(Circuit c) => CircuitsCompanion.insert(
    id: c.id,
    name: c.name,
    locality: Value<String?>(c.locality),
    country: Value<String?>(c.country),
    countryCode: Value<String?>(c.countryCode),
  );

  GrandPrixEventsCompanion _grandPrixCompanion(GrandPrix g) =>
      GrandPrixEventsCompanion.insert(
        id: g.id,
        season: g.season,
        round: g.round,
        eventSlug: g.eventSlug,
        name: g.name,
        officialName: Value<String?>(g.officialName),
        circuitId: g.circuitId,
        status: g.status.wire,
        format: g.format.wire,
        startDate: Value<String?>(g.startDate),
        endDate: Value<String?>(g.endDate),
        timezone: Value<String?>(g.timezone),
        hasResults: Value<bool>(g.hasResults),
      );

  SessionsCompanion _sessionCompanion(
    Session s,
    String grandPrixId,
    int order,
  ) => SessionsCompanion.insert(
    id: s.id,
    grandPrixId: grandPrixId,
    type: s.type.wire,
    name: Value<String?>(s.name),
    startTimeUtc: Value<DateTime?>(s.startTime),
    endTimeUtc: Value<DateTime?>(s.endTime),
    status: s.status.wire,
    orderIndex: order,
  );

  SnapshotsCompanion _snapshotCompanion(
    String key,
    DataFreshness f, {
    int? focusSeason,
    int? focusRound,
  }) => SnapshotsCompanion.insert(
    key: key,
    generatedAt: f.generatedAt,
    sourceUpdatedAt: Value<DateTime?>(f.sourceUpdatedAt),
    staleAfter: Value<DateTime?>(f.staleAfter),
    contentVersion: Value<String?>(f.contentVersion),
    serverStale: Value<bool?>(f.stale),
    focusSeason: Value<int?>(focusSeason),
    focusRound: Value<int?>(focusRound),
  );

  // ---------------------------------------------------------------------------
  // Row -> domain
  // ---------------------------------------------------------------------------

  Season _seasonFrom(SeasonRow r) => Season(
    year: r.year,
    label: r.label,
    status: SeasonStatus.fromWire(r.status),
    startDate: r.startDate,
    endDate: r.endDate,
    roundCount: r.roundCount,
    currentRound: r.currentRound,
    isCurrent: r.isCurrent,
  );

  Circuit _circuitFrom(CircuitRow r) => Circuit(
    id: r.id,
    name: r.name,
    locality: r.locality,
    country: r.country,
    countryCode: r.countryCode,
  );

  Session _sessionFrom(SessionRow r) => Session(
    id: r.id,
    type: SessionType.fromWire(r.type),
    name: r.name,
    startTime: r.startTimeUtc,
    endTime: r.endTimeUtc,
    status: SessionStatus.fromWire(r.status),
  );

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

  DataFreshness _freshnessFrom(SnapshotRow r) => DataFreshness(
    generatedAt: r.generatedAt,
    sourceUpdatedAt: r.sourceUpdatedAt,
    staleAfter: r.staleAfter,
    contentVersion: r.contentVersion,
    stale: r.serverStale,
  );

  int _canonicalOrder(SessionType t) => switch (t) {
    SessionType.practice1 => 0,
    SessionType.practice2 => 1,
    SessionType.practice3 => 2,
    SessionType.sprintQualifying => 3,
    SessionType.sprint => 4,
    SessionType.qualifying => 5,
    SessionType.race => 6,
    SessionType.unknown => 7,
  };

  String _humanizeSlug(String slug) => slug
      .split('-')
      .map(
        (String w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
      )
      .join(' ');
}
