import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/constructor.dart';
import '../../../features/shared/domain/entities/detail_views.dart';
import '../../../features/shared/domain/entities/driver.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/media.dart';
import '../../../features/shared/domain/entities/season_entry.dart';
import '../../../features/shared/domain/entities/standing.dart';
import '../competitor_tables.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../tables.dart';

part 'competitor_dao.g.dart';

/// Thrown when a batch of [DriverSeasonEntry]s is internally inconsistent — an
/// inverted span (`startRound > endRound`) or two overlapping stints for the
/// same driver in the same season. The write is rejected and no rows change.
class InvalidSeasonEntriesException implements Exception {
  const InvalidSeasonEntriesException(this.message);

  final String message;

  @override
  String toString() => 'InvalidSeasonEntriesException: $message';
}

/// Local data source for competitor identity and season participation.
///
/// Identity upserts ([upsertDrivers]/[upsertConstructors]) preserve the stable
/// row and refresh media through [MediaDao]. Season collections are replaced
/// wholesale per season so obsolete rows never linger. Detail reads compose the
/// stable identity (with media) with the current season entry, standing and —
/// for teams — the ordered line-up. Nothing Drift-shaped escapes.
@DriftAccessor(
  tables: <Type>[
    Drivers,
    Constructors,
    DriverSeasonEntries,
    ConstructorSeasonEntries,
    Seasons,
  ],
)
class CompetitorDao extends DatabaseAccessor<GridViewDatabase>
    with _$CompetitorDaoMixin {
  CompetitorDao(super.db);

  // ---------------------------------------------------------------------------
  // Identity writes
  // ---------------------------------------------------------------------------

  /// Upserts stable driver identities. When a driver's [Driver.media] is
  /// non-null it is refreshed (an empty list clears it); a null list leaves any
  /// existing media untouched.
  Future<void> upsertDrivers(List<Driver> items) {
    return transaction(() async {
      for (final Driver d in items) {
        validateSlug(d.id, field: 'driver id');
        validateCountryCode(d.countryCode, field: 'driver countryCode');
        await into(drivers).insertOnConflictUpdate(_driverCompanion(d));
        if (d.media != null) {
          await attachedDatabase.mediaDao.replaceOwnerMedia(
            MediaEntityType.driver,
            d.id,
            d.media!,
          );
        }
      }
    });
  }

  Future<void> upsertConstructors(List<Constructor> items) {
    return transaction(() async {
      for (final Constructor c in items) {
        validateSlug(c.id, field: 'constructor id');
        validateCountryCode(c.countryCode, field: 'constructor countryCode');
        await into(
          constructors,
        ).insertOnConflictUpdate(_constructorCompanion(c));
        if (c.media != null) {
          await attachedDatabase.mediaDao.replaceOwnerMedia(
            MediaEntityType.constructor,
            c.id,
            c.media!,
          );
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Season participation writes
  // ---------------------------------------------------------------------------

  Future<void> replaceDriverSeasonEntries(
    int season,
    List<DriverSeasonEntry> entries,
  ) {
    return transaction(() async {
      // Reject invalid scalars and invalid/overlapping participation spans
      // before any write, so an invalid batch leaves the cached season
      // untouched (the whole transaction is rolled back / never applied).
      validateSeason(season);
      _validateDriverSpans(entries);
      for (final DriverSeasonEntry e in entries) {
        validateSlug(e.id, field: 'driver season entry id');
        validateSlug(e.driverId, field: 'driverId');
        validateSlug(e.constructorId, field: 'constructorId');
        validateSeason(e.season, field: 'entry season');
        validateRound(e.startRound, field: 'startRound');
        validateRound(e.endRound, field: 'endRound');
      }

      await _ensureSeason(season);
      await (delete(
        driverSeasonEntries,
      )..where((DriverSeasonEntries e) => e.season.equals(season))).go();
      for (final DriverSeasonEntry e in entries) {
        await _ensureDriver(e.driverId);
        await _ensureConstructor(e.constructorId);
        await into(driverSeasonEntries).insert(_driverEntryCompanion(e));
      }
    });
  }

  /// Validates driver participation spans for a season batch. Throws an
  /// [InvalidSeasonEntriesException] when a span is inverted (`startRound >
  /// endRound`) or when two stints for the same driver overlap. A `null`
  /// `startRound`/`endRound` means "from the season start" / "until the season
  /// end" (±infinity) for overlap purposes.
  void _validateDriverSpans(List<DriverSeasonEntry> entries) {
    final Map<String, List<DriverSeasonEntry>> byDriver =
        <String, List<DriverSeasonEntry>>{};
    for (final DriverSeasonEntry e in entries) {
      final int start = e.startRound ?? -1 << 30;
      final int end = e.endRound ?? 1 << 30;
      if (start > end) {
        throw InvalidSeasonEntriesException(
          'Driver season entry ${e.id} has startRound > endRound.',
        );
      }
      (byDriver[e.driverId] ??= <DriverSeasonEntry>[]).add(e);
    }
    for (final MapEntry<String, List<DriverSeasonEntry>> group
        in byDriver.entries) {
      final List<DriverSeasonEntry> stints = group.value
        ..sort(
          (DriverSeasonEntry a, DriverSeasonEntry b) =>
              (a.startRound ?? -1 << 30).compareTo(b.startRound ?? -1 << 30),
        );
      for (int i = 1; i < stints.length; i++) {
        final int prevEnd = stints[i - 1].endRound ?? 1 << 30;
        final int currStart = stints[i].startRound ?? -1 << 30;
        if (currStart <= prevEnd) {
          throw InvalidSeasonEntriesException(
            'Overlapping stints for driver ${group.key} in the same season.',
          );
        }
      }
    }
  }

  /// Replaces a season's constructor entries (branding/identity only). A
  /// constructor's line-up is NOT stored here: it is derived from the season's
  /// [DriverSeasonEntry] rows (the single source of truth for membership), so a
  /// provided [ConstructorSeasonEntry.driverLineup] is intentionally ignored.
  Future<void> replaceConstructorSeasonEntries(
    int season,
    List<ConstructorSeasonEntry> entries,
  ) {
    return transaction(() async {
      validateSeason(season);
      for (final ConstructorSeasonEntry e in entries) {
        validateSlug(e.id, field: 'constructor season entry id');
        validateSlug(e.constructorId, field: 'constructorId');
        validateSeason(e.season, field: 'entry season');
      }

      await _ensureSeason(season);
      await (delete(
        constructorSeasonEntries,
      )..where((ConstructorSeasonEntries e) => e.season.equals(season))).go();
      for (final ConstructorSeasonEntry e in entries) {
        await _ensureConstructor(e.constructorId);
        await into(
          constructorSeasonEntries,
        ).insert(_constructorEntryCompanion(e));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // List reads
  // ---------------------------------------------------------------------------

  /// The season roster: each participating driver paired with its season entry,
  /// ordered by race number (unnumbered last) then full name.
  Future<List<SeasonDriver>> driversForSeason(int season) async {
    final List<DriverSeasonEntryRow> entryRows = await (select(
      driverSeasonEntries,
    )..where((DriverSeasonEntries e) => e.season.equals(season))).get();
    if (entryRows.isEmpty) return const <SeasonDriver>[];

    final Map<String, DriverRow> byId = await _driversById(
      entryRows.map((DriverSeasonEntryRow e) => e.driverId).toSet(),
    );

    final List<SeasonDriver> roster = <SeasonDriver>[];
    for (final DriverSeasonEntryRow e in entryRows) {
      final DriverRow? d = byId[e.driverId];
      if (d == null) continue;
      roster.add(
        SeasonDriver(driver: _driverFrom(d), entry: _driverEntryFrom(e)),
      );
    }
    roster.sort(_bySeasonDriver);
    return roster;
  }

  Future<List<SeasonConstructor>> constructorsForSeason(int season) async {
    final List<ConstructorSeasonEntryRow> entryRows = await (select(
      constructorSeasonEntries,
    )..where((ConstructorSeasonEntries e) => e.season.equals(season))).get();
    if (entryRows.isEmpty) return const <SeasonConstructor>[];

    final Map<String, ConstructorRow> byId = await _constructorsById(
      entryRows.map((ConstructorSeasonEntryRow e) => e.constructorId).toSet(),
    );

    final List<SeasonConstructor> list = <SeasonConstructor>[];
    for (final ConstructorSeasonEntryRow e in entryRows) {
      final ConstructorRow? c = byId[e.constructorId];
      if (c == null) continue;
      list.add(
        SeasonConstructor(
          constructor: _constructorFrom(c),
          entry: _constructorEntryFrom(e),
        ),
      );
    }
    list.sort(
      (SeasonConstructor a, SeasonConstructor b) =>
          a.constructor.name.compareTo(b.constructor.name),
    );
    return list;
  }

  // ---------------------------------------------------------------------------
  // Detail reads
  // ---------------------------------------------------------------------------

  Future<DriverDetailView?> driverDetail(int season, String driverId) async {
    final DriverRow? row = await (select(
      drivers,
    )..where((Drivers d) => d.id.equals(driverId))).getSingleOrNull();
    if (row == null) return null;

    final List<MediaAsset> media = await attachedDatabase.mediaDao
        .mediaForOwner(MediaEntityType.driver, driverId);
    final DriverSeasonEntryRow? entry = await _currentDriverEntry(
      season,
      driverId,
    );
    final DriverStanding? standing = await attachedDatabase.standingsDao
        .driverStanding(season, driverId);

    return DriverDetailView(
      driver: _driverFrom(row, media: media),
      seasonEntry: entry == null ? null : _driverEntryFrom(entry),
      standing: standing,
    );
  }

  Future<TeamDetailView?> teamDetail(int season, String constructorId) async {
    final ConstructorRow? row = await (select(
      constructors,
    )..where((Constructors c) => c.id.equals(constructorId))).getSingleOrNull();
    if (row == null) return null;

    final List<MediaAsset> media = await attachedDatabase.mediaDao
        .mediaForOwner(MediaEntityType.constructor, constructorId);
    final ConstructorSeasonEntryRow? entry =
        await (select(constructorSeasonEntries)..where(
              (ConstructorSeasonEntries e) =>
                  e.season.equals(season) &
                  e.constructorId.equals(constructorId),
            ))
            .getSingleOrNull();
    final ConstructorStanding? standing = await attachedDatabase.standingsDao
        .constructorStanding(season, constructorId);
    final List<Driver> lineup = await _lineupForConstructor(
      season,
      constructorId,
    );

    return TeamDetailView(
      constructor: _constructorFrom(row, media: media),
      seasonEntry: entry == null ? null : _constructorEntryFrom(entry),
      standing: standing,
      lineup: lineup,
    );
  }

  // ---------------------------------------------------------------------------
  // Read helpers
  // ---------------------------------------------------------------------------

  Future<Map<String, DriverRow>> _driversById(Set<String> ids) async {
    final List<DriverRow> rows = await (select(
      drivers,
    )..where((Drivers d) => d.id.isIn(ids))).get();
    return <String, DriverRow>{for (final DriverRow r in rows) r.id: r};
  }

  Future<Map<String, ConstructorRow>> _constructorsById(Set<String> ids) async {
    final List<ConstructorRow> rows = await (select(
      constructors,
    )..where((Constructors c) => c.id.isIn(ids))).get();
    return <String, ConstructorRow>{
      for (final ConstructorRow r in rows) r.id: r,
    };
  }

  /// Picks the participation entry in force for a (season, driver): the open
  /// span (`endRound == null`) if any, else the latest by `startRound`.
  Future<DriverSeasonEntryRow?> _currentDriverEntry(
    int season,
    String driverId,
  ) async {
    final List<DriverSeasonEntryRow> rows =
        await (select(driverSeasonEntries)..where(
              (DriverSeasonEntries e) =>
                  e.season.equals(season) & e.driverId.equals(driverId),
            ))
            .get();
    if (rows.isEmpty) return null;
    rows.sort((DriverSeasonEntryRow a, DriverSeasonEntryRow b) {
      if ((a.endRound == null) != (b.endRound == null)) {
        return a.endRound == null ? -1 : 1;
      }
      return (b.startRound ?? 0).compareTo(a.startRound ?? 0);
    });
    return rows.first;
  }

  /// The constructor's season line-up, derived from the season's driver entries
  /// (the single source of truth for membership), ordered like the season
  /// roster (race number, unnumbered last, then full name).
  Future<List<Driver>> _lineupForConstructor(
    int season,
    String constructorId,
  ) async {
    final List<SeasonDriver> roster = await driversForSeason(season);
    return roster
        .where((SeasonDriver s) => s.entry.constructorId == constructorId)
        .map((SeasonDriver s) => s.driver)
        .toList(growable: false);
  }

  int _bySeasonDriver(SeasonDriver a, SeasonDriver b) {
    final int? na = a.entry.raceNumber;
    final int? nb = b.entry.raceNumber;
    if ((na == null) != (nb == null)) return na == null ? 1 : -1;
    if (na != null && nb != null && na != nb) return na.compareTo(nb);
    return a.driver.fullName.compareTo(b.driver.fullName);
  }

  // ---------------------------------------------------------------------------
  // Reference ensuring
  // ---------------------------------------------------------------------------

  Future<void> _ensureSeason(int year) => into(seasons).insert(
    SeasonsCompanion.insert(
      year: Value<int>(year),
      status: SeasonStatus.unknown.wire,
    ),
    mode: InsertMode.insertOrIgnore,
  );

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

  DriversCompanion _driverCompanion(Driver d) => DriversCompanion.insert(
    id: d.id,
    fullName: d.fullName,
    givenName: Value<String?>(d.givenName),
    familyName: Value<String?>(d.familyName),
    shortCode: Value<String?>(d.shortCode),
    permanentNumber: Value<int?>(d.permanentNumber),
    nationality: Value<String?>(d.nationality),
    countryCode: Value<String?>(d.countryCode),
    dateOfBirth: Value<String?>(d.dateOfBirth),
    placeOfBirth: Value<String?>(d.placeOfBirth),
    biography: Value<String?>(d.biography),
  );

  ConstructorsCompanion _constructorCompanion(Constructor c) =>
      ConstructorsCompanion.insert(
        id: c.id,
        name: c.name,
        shortName: Value<String?>(c.shortName),
        nationality: Value<String?>(c.nationality),
        countryCode: Value<String?>(c.countryCode),
        colorPrimary: Value<String?>(c.colorPrimary),
        biography: Value<String?>(c.biography),
      );

  DriverSeasonEntriesCompanion _driverEntryCompanion(DriverSeasonEntry e) =>
      DriverSeasonEntriesCompanion.insert(
        id: e.id,
        season: e.season,
        driverId: e.driverId,
        constructorId: e.constructorId,
        raceNumber: Value<int?>(e.raceNumber),
        role: Value<String?>(e.role?.wire),
        shortCode: Value<String?>(e.shortCode),
        startRound: Value<int?>(e.startRound),
        endRound: Value<int?>(e.endRound),
      );

  ConstructorSeasonEntriesCompanion _constructorEntryCompanion(
    ConstructorSeasonEntry e,
  ) => ConstructorSeasonEntriesCompanion.insert(
    id: e.id,
    season: e.season,
    constructorId: e.constructorId,
    fullName: Value<String?>(e.fullName),
    shortName: Value<String?>(e.shortName),
    colorPrimary: Value<String?>(e.colorPrimary),
    colorSecondary: Value<String?>(e.colorSecondary),
    powerUnit: Value<String?>(e.powerUnit),
    teamPrincipal: Value<String?>(e.teamPrincipal),
    base: Value<String?>(e.base),
    chassis: Value<String?>(e.chassis),
  );

  Driver _driverFrom(DriverRow r, {List<MediaAsset>? media}) => Driver(
    id: r.id,
    fullName: r.fullName,
    givenName: r.givenName,
    familyName: r.familyName,
    shortCode: r.shortCode,
    permanentNumber: r.permanentNumber,
    nationality: r.nationality,
    countryCode: r.countryCode,
    dateOfBirth: r.dateOfBirth,
    placeOfBirth: r.placeOfBirth,
    biography: r.biography,
    media: media,
  );

  Constructor _constructorFrom(ConstructorRow r, {List<MediaAsset>? media}) =>
      Constructor(
        id: r.id,
        name: r.name,
        shortName: r.shortName,
        nationality: r.nationality,
        countryCode: r.countryCode,
        colorPrimary: r.colorPrimary,
        biography: r.biography,
        media: media,
      );

  DriverSeasonEntry _driverEntryFrom(DriverSeasonEntryRow r) =>
      DriverSeasonEntry(
        id: r.id,
        season: r.season,
        driverId: r.driverId,
        constructorId: r.constructorId,
        raceNumber: r.raceNumber,
        role: r.role == null ? null : DriverRole.fromWire(r.role),
        shortCode: r.shortCode,
        startRound: r.startRound,
        endRound: r.endRound,
      );

  ConstructorSeasonEntry _constructorEntryFrom(ConstructorSeasonEntryRow r) =>
      ConstructorSeasonEntry(
        id: r.id,
        season: r.season,
        constructorId: r.constructorId,
        fullName: r.fullName,
        shortName: r.shortName,
        colorPrimary: r.colorPrimary,
        colorSecondary: r.colorSecondary,
        powerUnit: r.powerUnit,
        teamPrincipal: r.teamPrincipal,
        base: r.base,
        chassis: r.chassis,
        driverLineup: null,
      );

  String _humanizeSlug(String slug) => slug
      .split('-')
      .map(
        (String w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
      )
      .join(' ');
}
