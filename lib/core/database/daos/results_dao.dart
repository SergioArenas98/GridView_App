import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/race_result.dart';
import '../competitor_tables.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../result_tables.dart';

part 'results_dao.g.dart';

/// Local data source for race/sprint classifications.
///
/// A [RaceResult] is written in one transaction: its row is upserted and its
/// classification entries are replaced wholesale (obsolete rows never linger),
/// preserving the classification order via an explicit index. Durations are
/// stored as whole milliseconds and reconstructed into [Duration]s on read.
/// The parent Grand Prix must already exist (results are synchronised after
/// their event); referenced drivers/constructors are ensured defensively.
@DriftAccessor(
  tables: <Type>[RaceResults, RaceResultEntries, Drivers, Constructors],
)
class ResultsDao extends DatabaseAccessor<GridViewDatabase>
    with _$ResultsDaoMixin {
  ResultsDao(super.db);

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  Future<void> writeRaceResult(RaceResult result) {
    return transaction(() async {
      validateSlug(result.id, field: 'race result id');
      validateSlug(result.grandPrixId, field: 'grandPrixId');
      validateSeason(result.season, field: 'result season');
      validateRound(result.round, field: 'result round');
      for (final RaceResultEntry e in result.entries) {
        validateSlug(e.driverId, field: 'driverId');
        validateSlug(e.constructorId, field: 'constructorId');
      }

      final String? fastestLapDriver = result.fastestLap?.driverId;
      if (fastestLapDriver != null) await _ensureDriver(fastestLapDriver);

      await into(raceResults).insertOnConflictUpdate(_resultCompanion(result));

      await (delete(
        raceResultEntries,
      )..where((RaceResultEntries e) => e.raceResultId.equals(result.id))).go();
      for (int i = 0; i < result.entries.length; i++) {
        final RaceResultEntry entry = result.entries[i];
        await _ensureDriver(entry.driverId);
        await _ensureConstructor(entry.constructorId);
        await into(
          raceResultEntries,
        ).insert(_entryCompanion(result.id, entry, i));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  Future<RaceResult?> raceResult(String id) async {
    final RaceResultRow? row = await (select(
      raceResults,
    )..where((RaceResults r) => r.id.equals(id))).getSingleOrNull();
    if (row == null) return null;
    return _resultFrom(row, await _entriesFor(id));
  }

  Future<List<RaceResult>> resultsForGrandPrix(String grandPrixId) async {
    final List<RaceResultRow> rows =
        await (select(raceResults)
              ..where((RaceResults r) => r.grandPrixId.equals(grandPrixId))
              ..orderBy(<OrderClauseGenerator<RaceResults>>[
                (RaceResults r) => OrderingTerm(expression: r.sessionType),
              ]))
            .get();
    final List<RaceResult> results = <RaceResult>[];
    for (final RaceResultRow row in rows) {
      results.add(_resultFrom(row, await _entriesFor(row.id)));
    }
    return results;
  }

  Future<List<RaceResultEntry>> _entriesFor(String resultId) async {
    final List<RaceResultEntryRow> rows =
        await (select(raceResultEntries)
              ..where((RaceResultEntries e) => e.raceResultId.equals(resultId))
              ..orderBy(<OrderClauseGenerator<RaceResultEntries>>[
                (RaceResultEntries e) => OrderingTerm(expression: e.orderIndex),
              ]))
            .get();
    return rows.map(_entryFrom).toList(growable: false);
  }

  // ---------------------------------------------------------------------------
  // Reference ensuring
  // ---------------------------------------------------------------------------

  Future<void> _ensureDriver(String id) => into(drivers).insert(
    DriversCompanion.insert(id: id, fullName: _humanizeSlug(id)),
    mode: InsertMode.insertOrIgnore,
  );

  Future<void> _ensureConstructor(String id) => into(constructors).insert(
    ConstructorsCompanion.insert(id: id, name: _humanizeSlug(id)),
    mode: InsertMode.insertOrIgnore,
  );

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  RaceResultsCompanion _resultCompanion(RaceResult r) =>
      RaceResultsCompanion.insert(
        id: r.id,
        season: r.season,
        round: r.round,
        grandPrixId: r.grandPrixId,
        sessionType: r.sessionType.wire,
        status: r.status.wire,
        fastestLapDriverId: Value<String?>(r.fastestLap?.driverId),
        fastestLapTimeMillis: Value<int?>(r.fastestLap?.time?.inMilliseconds),
        fastestLapLap: Value<int?>(r.fastestLap?.lap),
      );

  RaceResultEntriesCompanion _entryCompanion(
    String resultId,
    RaceResultEntry e,
    int order,
  ) => RaceResultEntriesCompanion.insert(
    raceResultId: resultId,
    driverId: e.driverId,
    constructorId: e.constructorId,
    position: Value<int?>(e.position),
    gridPosition: Value<int?>(e.gridPosition),
    points: Value<double?>(e.points),
    status: e.status.wire,
    laps: Value<int?>(e.laps),
    elapsedTimeMillis: Value<int?>(e.elapsedTime?.inMilliseconds),
    gapToLeaderMillis: Value<int?>(e.gapToLeader?.inMilliseconds),
    lapsBehind: Value<int?>(e.lapsBehind),
    fastestLap: Value<bool?>(e.fastestLap),
    dnfReason: Value<String?>(e.dnfReason),
    gapText: Value<String?>(e.gapText),
    orderIndex: order,
  );

  RaceResult _resultFrom(RaceResultRow r, List<RaceResultEntry> entries) =>
      RaceResult(
        id: r.id,
        season: r.season,
        round: r.round,
        grandPrixId: r.grandPrixId,
        sessionType: SessionType.fromWire(r.sessionType),
        status: ResultStatus.fromWire(r.status),
        entries: entries,
        fastestLap: _fastestLapFrom(r),
      );

  FastestLap? _fastestLapFrom(RaceResultRow r) {
    if (r.fastestLapDriverId == null &&
        r.fastestLapTimeMillis == null &&
        r.fastestLapLap == null) {
      return null;
    }
    return FastestLap(
      driverId: r.fastestLapDriverId,
      time: _durationOrNull(r.fastestLapTimeMillis),
      lap: r.fastestLapLap,
    );
  }

  RaceResultEntry _entryFrom(RaceResultEntryRow r) => RaceResultEntry(
    driverId: r.driverId,
    constructorId: r.constructorId,
    position: r.position,
    gridPosition: r.gridPosition,
    points: r.points,
    status: FinishStatus.fromWire(r.status),
    laps: r.laps,
    elapsedTime: _durationOrNull(r.elapsedTimeMillis),
    gapToLeader: _durationOrNull(r.gapToLeaderMillis),
    lapsBehind: r.lapsBehind,
    fastestLap: r.fastestLap,
    dnfReason: r.dnfReason,
    gapText: r.gapText,
  );

  Duration? _durationOrNull(int? millis) =>
      millis == null ? null : Duration(milliseconds: millis);

  String _humanizeSlug(String slug) => slug
      .split('-')
      .map(
        (String w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
      )
      .join(' ');
}
