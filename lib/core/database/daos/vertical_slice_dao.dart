import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/circuit.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/freshness.dart';
import '../../../features/shared/domain/entities/grand_prix.dart';
import '../../../features/shared/domain/entities/grand_prix_view.dart';
import '../../../features/shared/domain/entities/home_view.dart';
import '../../../features/shared/domain/entities/media.dart';
import '../../../features/shared/domain/entities/season.dart';
import '../../../features/shared/domain/entities/session.dart';
import '../../../features/shared/domain/snapshot_conflict.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../tables.dart';
import '../unresolved_identity.dart';

part 'vertical_slice_dao.g.dart';

/// The outcome of a snapshot write. Every value except [applied] is a non-write
/// that leaves all cached rows untouched.
///
/// - [applied]: the incoming snapshot had newer source data (or repaired an
///   incomplete stored snapshot) and was written.
/// - [rejectedOlder]: the incoming snapshot's source data was older than the
///   cached one; not written (protects newer cached data).
/// - [skippedUpToDate]: same revision as the cached one (equal `sourceUpdatedAt`
///   and `contentVersion`); intentionally not rewritten, so no rows change and
///   no stream re-emits.
/// - [rejectedInvalid]: the incoming snapshot has **no `sourceUpdatedAt`**, which
///   is contract-invalid (SnapshotMeta requires it). Not written, and
///   `generatedAt` is never used as a substitute. The remote layer normally
///   rejects this as a typed failure before it reaches the database; this value
///   is defence in depth for a direct DAO caller.
enum SnapshotWriteOutcome {
  applied,
  rejectedOlder,
  skippedUpToDate,
  rejectedInvalid,
}

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
  /// Each emission re-reads the owner's media, so imagery becomes visible as soon
  /// as it is persisted. Media never *gates* the view: an emission with no
  /// imagery is a complete Home, not a partial one.
  ///
  /// The trigger stays the Home snapshot row alone, deliberately. Media for the
  /// featured event is written in the same transaction as that row, so the
  /// existing emission already carries it; widening the trigger to the media
  /// tables would replace Drift's result-deduplicating query stream with an
  /// emit-per-update one and produce updates where nothing the view shows has
  /// changed.
  Stream<HomeView?> watchHome() {
    final query = select(snapshots)
      ..where((Snapshots s) => s.key.equals(homeSnapshotKey));
    return query.watchSingleOrNull().asyncMap(_composeHome);
  }

  Future<HomeView?> _composeHome(SnapshotRow? snap) async {
    if (snap == null) return null;
    // `focusSeason` is the snapshot's materialization signal: a Home
    // representation always knows which season it describes.
    final int? season = snap.focusSeason;
    if (season == null) return null;

    final SeasonRow? seasonRow = await (select(
      seasons,
    )..where((Seasons s) => s.year.equals(season))).getSingleOrNull();
    final DataFreshness freshness = _freshnessFrom(snap);

    final int? round = snap.focusRound;
    if (round == null) {
      // A season with nothing scheduled yet: a valid, materialized Home with no
      // featured event — never treated as a missing representation.
      return HomeView(
        seasonYear: season,
        season: seasonRow == null ? null : _seasonFrom(seasonRow),
        freshness: freshness,
      );
    }

    final GrandPrixRow? gpRow = await _grandPrixRow(season, round);
    // A focus round whose event row is gone is an inconsistent cache, not an
    // empty season.
    if (gpRow == null) return null;

    final List<Session> sessions = await _sessionsFor(gpRow.id);
    final CircuitRow? circuitRow = await (select(
      circuits,
    )..where((Circuits c) => c.id.equals(gpRow.circuitId))).getSingleOrNull();

    return HomeView(
      seasonYear: season,
      season: seasonRow == null ? null : _seasonFrom(seasonRow),
      featured: _grandPrixFrom(
        gpRow,
        sessions,
        media: await _mediaFor(MediaEntityType.grandPrix, gpRow.id),
      ),
      circuit: _resolvedCircuit(
        circuitRow,
        media: await _mediaFor(MediaEntityType.circuit, gpRow.circuitId),
      ),
      freshness: freshness,
    );
  }

  /// The media owned by one entity, read locally. Never fetches and never
  /// downloads: composing a view only reports what is already persisted, so a
  /// Home or detail read stays a pure local read even when no imagery exists.
  Future<List<MediaAsset>> _mediaFor(MediaEntityType type, String ownerId) =>
      attachedDatabase.mediaDao.mediaForOwner(type, ownerId);

  /// The season of the materialized Home representation, or `null` when no Home
  /// snapshot has been materialized.
  ///
  /// This is the persisted materialization signal the application-level
  /// first-use policy reads. It is deliberately independent of whether the
  /// season has a featured event: an empty season that synchronised
  /// successfully is materialized.
  Future<int?> homeSnapshotSeason() async =>
      (await _snapshotByKey(homeSnapshotKey))?.focusSeason;

  /// Streaming form of [homeSnapshotSeason].
  Stream<int?> watchHomeSnapshotSeason() =>
      (select(snapshots)..where((Snapshots s) => s.key.equals(homeSnapshotKey)))
          .watchSingleOrNull()
          .map((SnapshotRow? row) => row?.focusSeason);

  /// Streams the Grand Prix detail aggregate for (season, round). Emits `null`
  /// until the Grand Prix has been cached. Re-emits whenever its row is written
  /// (both Home and detail syncs upsert the row).
  /// As with [watchHome], each emission re-reads media; the trigger stays the
  /// Grand Prix row, which every media write for the event accompanies.
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
      grandPrix: _grandPrixFrom(
        gpRow,
        sessions,
        media: await _mediaFor(MediaEntityType.grandPrix, gpRow.id),
      ),
      // The circuit's own media travels with the circuit. The Grand Prix hero may
      // fall back to it, but the two owners stay distinguishable so presentation
      // can say which image it is actually showing.
      circuit: _resolvedCircuit(
        circuitRow,
        media: await _mediaFor(MediaEntityType.circuit, gpRow.circuitId),
      ),
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

  /// 1 when the Home snapshot row exists, else 0 (local-presence probe for the
  /// conditional-refresh 304-recovery).
  Future<int> countHomeSnapshot() async {
    final SnapshotRow? row = await _snapshotByKey(homeSnapshotKey);
    return row == null ? 0 : 1;
  }

  /// 1 when the Grand Prix event row for (season, round) exists, else 0.
  Future<int> countGrandPrix(int season, int round) async {
    final GrandPrixRow? row = await _grandPrixRow(season, round);
    return row == null ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Writes (atomic snapshot transactions with the conflict rule)
  // ---------------------------------------------------------------------------

  /// Applies a Home snapshot in one transaction. Idempotent for an equal
  /// `generatedAt`; rejected when the incoming snapshot is older than the
  /// cached one. Featured sessions are upserted additively — the detail sync
  /// owns authoritative full-session replacement.
  /// [homeSeason] is the season the snapshot represents and is what makes it
  /// *materialized*; [featured] may be null for a season with nothing scheduled
  /// yet, which is a valid Home rather than a missing one.
  Future<SnapshotWriteOutcome> writeHomeSnapshot({
    required int homeSeason,
    Season? season,
    GrandPrix? featured,
    Circuit? featuredCircuit,
    required DataFreshness freshness,
    bool force = false,
  }) {
    return transaction(() async {
      validateSeason(homeSeason, field: 'home season');
      if (featured != null) {
        validateSeason(featured.season);
        validateRound(featured.round);
        validateSlug(featured.id, field: 'grand prix id');
        validateSlug(featured.circuitId, field: 'circuitId');
      }
      if (season != null) validateSeason(season.year, field: 'season year');

      // [force] is used when an outer coordinator (ResourceSync against
      // resource_sync_metadata) has already decided to apply; the snapshots-table
      // conflict gate then only guards direct DAO callers.
      if (!force) {
        final SnapshotRow? existing = await _snapshotByKey(homeSnapshotKey);
        final SnapshotWriteOutcome decision = _decideOutcome(
          freshness,
          existing,
        );
        if (decision != SnapshotWriteOutcome.applied) return decision;
      }

      if (season != null) {
        await into(seasons).insertOnConflictUpdate(_seasonCompanion(season));
      }
      await _ensureSeason(homeSeason);

      if (featured != null) {
        await _ensureSeason(featured.season);
        if (featuredCircuit != null) {
          validateDisplayName(featuredCircuit.name, field: 'circuit name');
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
      }

      // The snapshot row records the season unconditionally — that is the
      // materialization signal — and the focus round only when there is a
      // featured event to point at.
      await into(snapshots).insertOnConflictUpdate(
        _snapshotCompanion(
          homeSnapshotKey,
          freshness,
          focusSeason: homeSeason,
          focusRound: featured?.round,
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
    bool force = false,
  }) {
    final String key = grandPrixSnapshotKey(grandPrix.season, grandPrix.round);
    return transaction(() async {
      validateSeason(grandPrix.season);
      validateRound(grandPrix.round);
      validateSlug(grandPrix.id, field: 'grand prix id');
      validateSlug(grandPrix.circuitId, field: 'circuitId');

      if (!force) {
        final SnapshotRow? existing = await _snapshotByKey(key);
        final SnapshotWriteOutcome decision = _decideOutcome(
          freshness,
          existing,
        );
        if (decision != SnapshotWriteOutcome.applied) return decision;
      }

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

  /// Decides whether an incoming snapshot should be applied, rejected, or
  /// skipped, by delegating to the single centralized [SnapshotConflict] rule
  /// (shared with the remote-to-local repositories so the ordering can never
  /// diverge). **`sourceUpdatedAt` is the primary conflict boundary**;
  /// `generatedAt` is only a tie-breaker and never a substitute.
  SnapshotWriteOutcome _decideOutcome(
    DataFreshness incoming,
    SnapshotRow? existing,
  ) {
    final SnapshotConflictOutcome outcome = SnapshotConflict.decide(
      SnapshotRevision.fromFreshness(incoming),
      existing == null
          ? null
          : SnapshotRevision(
              generatedAt: existing.generatedAt,
              sourceUpdatedAt: existing.sourceUpdatedAt,
              contentVersion: existing.contentVersion,
            ),
    );
    return switch (outcome) {
      SnapshotConflictOutcome.apply => SnapshotWriteOutcome.applied,
      SnapshotConflictOutcome.rejectedOlder =>
        SnapshotWriteOutcome.rejectedOlder,
      SnapshotConflictOutcome.skippedUpToDate =>
        SnapshotWriteOutcome.skippedUpToDate,
      SnapshotConflictOutcome.rejectedInvalid =>
        SnapshotWriteOutcome.rejectedInvalid,
    };
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

  /// Ensures a `circuits` row exists as a **referential stub**, through the
  /// single creation path in [CalendarDao] — never a name derived from the
  /// identifier, and never overwriting a circuit that already synchronised.
  Future<void> _ensureCircuit(String id) =>
      attachedDatabase.calendarDao.ensureCircuitIdentity(id);

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

  /// The circuit a snapshot carries is a *summary*: it never holds the
  /// detail-owned physical facts, and an optional field it omits is not a
  /// deletion instruction. Absent values are therefore left out of the
  /// companion so an upsert preserves whatever a detail sync already stored.
  CircuitsCompanion _circuitCompanion(Circuit c) => CircuitsCompanion.insert(
    id: c.id,
    name: c.name,
    locality: _presentOrAbsent(c.locality),
    country: _presentOrAbsent(c.country),
    countryCode: _presentOrAbsent(c.countryCode),
  );

  Value<String?> _presentOrAbsent(String? value) =>
      value == null ? const Value<String?>.absent() : Value<String?>(value);

  GrandPrixEventsCompanion _grandPrixCompanion(GrandPrix g) =>
      GrandPrixEventsCompanion.insert(
        id: g.id,
        season: g.season,
        round: g.round,
        eventSlug: g.eventSlug,
        name: g.name,
        // A snapshot's featured event is a *summary*: it never carries the
        // official name, and its absence is not a deletion instruction. Leaving
        // the column out preserves whatever the detail sync stored.
        officialName: _presentOrAbsent(g.officialName),
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

  /// The domain circuit for [row], or `null` when the row is absent **or** still
  /// an unresolved referential stub: a stub is not a domain circuit, so a
  /// composed view carries no circuit rather than a name derived from the
  /// identifier.
  Circuit? _resolvedCircuit(CircuitRow? row, {List<MediaAsset>? media}) =>
      (row == null || isUnresolvedIdentityName(row.name))
      ? null
      : _circuitFrom(row, media: media);

  Circuit _circuitFrom(CircuitRow r, {List<MediaAsset>? media}) => Circuit(
    id: r.id,
    name: r.name,
    locality: r.locality,
    country: r.country,
    countryCode: r.countryCode,
    media: media,
  );

  Session _sessionFrom(SessionRow r) => Session(
    id: r.id,
    type: SessionType.fromWire(r.type),
    name: r.name,
    startTime: r.startTimeUtc,
    endTime: r.endTimeUtc,
    status: SessionStatus.fromWire(r.status),
  );

  GrandPrix _grandPrixFrom(
    GrandPrixRow r,
    List<Session> sessions, {
    List<MediaAsset>? media,
  }) => GrandPrix(
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
    media: media,
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
}
