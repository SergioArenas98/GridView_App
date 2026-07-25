import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/season.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../tables.dart';

part 'season_dao.g.dart';

/// Local data source for season identity: the current-season pointer and
/// per-season metadata.
///
/// Writes upsert a single season row; setting the current season additionally
/// clears the `isCurrent` flag on every other season so exactly one season is
/// ever current. Reads return domain [Season]s. Nothing Drift-shaped escapes.
@DriftAccessor(tables: <Type>[Seasons])
class SeasonDao extends DatabaseAccessor<GridViewDatabase>
    with _$SeasonDaoMixin {
  SeasonDao(super.db);

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  /// Upserts one season's metadata. Does not touch other seasons.
  Future<void> upsertSeason(Season season) {
    return transaction(() async {
      validateSeason(season.year, field: 'season year');
      await into(seasons).insertOnConflictUpdate(_companion(season));
    });
  }

  /// Marks [season] as the single current season: clears `isCurrent` on all
  /// other seasons and upserts this one with `isCurrent = true`, atomically.
  Future<void> setCurrentSeason(Season season) {
    return transaction(() async {
      validateSeason(season.year, field: 'current season year');
      await (update(seasons)
            ..where((Seasons s) => s.year.equals(season.year).not()))
          .write(const SeasonsCompanion(isCurrent: Value<bool>(false)));
      await into(seasons).insertOnConflictUpdate(
        _companion(season).copyWith(isCurrent: const Value<bool>(true)),
      );
    });
  }

  /// Ensures a minimal season row exists (for foreign-key integrity), never
  /// clobbering a fully-synchronised season row.
  Future<void> ensureSeason(int year) => into(seasons).insert(
    SeasonsCompanion.insert(
      year: Value<int>(year),
      status: SeasonStatus.unknown.wire,
    ),
    mode: InsertMode.insertOrIgnore,
  );

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  Future<Season?> readSeason(int year) async {
    final SeasonRow? row = await (select(
      seasons,
    )..where((Seasons s) => s.year.equals(year))).getSingleOrNull();
    return row == null ? null : _fromRow(row);
  }

  Stream<Season?> watchSeason(int year) =>
      (select(seasons)..where((Seasons s) => s.year.equals(year)))
          .watchSingleOrNull()
          .map((SeasonRow? r) => r == null ? null : _fromRow(r));

  Future<Season?> readCurrentSeason() async {
    final SeasonRow? row = await (select(
      seasons,
    )..where((Seasons s) => s.isCurrent.equals(true))).getSingleOrNull();
    return row == null ? null : _fromRow(row);
  }

  Stream<Season?> watchCurrentSeason() =>
      (select(seasons)..where((Seasons s) => s.isCurrent.equals(true)))
          .watchSingleOrNull()
          .map((SeasonRow? r) => r == null ? null : _fromRow(r));

  Future<int> countSeason(int year) async {
    final SeasonRow? row = await (select(
      seasons,
    )..where((Seasons s) => s.year.equals(year))).getSingleOrNull();
    return row == null ? 0 : 1;
  }

  Future<int> countCurrentSeason() async {
    final List<SeasonRow> rows = await (select(
      seasons,
    )..where((Seasons s) => s.isCurrent.equals(true))).get();
    return rows.length;
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  SeasonsCompanion _companion(Season s) => SeasonsCompanion.insert(
    year: Value<int>(s.year),
    status: s.status.wire,
    label: Value<String?>(s.label),
    startDate: Value<String?>(s.startDate),
    endDate: Value<String?>(s.endDate),
    roundCount: Value<int?>(s.roundCount),
    currentRound: Value<int?>(s.currentRound),
    isCurrent: Value<bool>(s.isCurrent),
  );

  Season _fromRow(SeasonRow r) => Season(
    year: r.year,
    label: r.label,
    status: SeasonStatus.fromWire(r.status),
    startDate: r.startDate,
    endDate: r.endDate,
    roundCount: r.roundCount,
    currentRound: r.currentRound,
    isCurrent: r.isCurrent,
  );
}
