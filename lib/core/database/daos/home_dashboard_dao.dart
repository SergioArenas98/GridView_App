import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/calendar_entry.dart';
import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/grand_prix.dart';
import '../../../features/shared/domain/entities/home_dashboard.dart';
import '../../../features/shared/domain/entities/race_result.dart';
import '../../../features/shared/domain/entities/season.dart';
import '../../../features/shared/domain/entities/standing_entry.dart';
import '../../../features/shared/domain/relevant_event.dart';
import '../gridview_database.dart';
import '../result_tables.dart';
import '../standing_tables.dart';
import '../tables.dart';

part 'home_dashboard_dao.g.dart';

/// How many upcoming events the Home dashboard carries.
///
/// One documented presentation rule, applied in the composition rather than in a
/// widget, so the module is bounded for every caller and no screen has to
/// re-slice a longer list while building.
const int kHomeUpcomingEventLimit = 3;

/// Composes the Home dashboard from the normalized local data.
///
/// This is a **read-only composition** over resources other DAOs already own: it
/// creates no table, writes nothing and caches nothing. Each module is read
/// straight from the resource that owns it —
///
/// - the featured event, its circuit and its sessions: the persisted Home
///   snapshot's `focusSeason` / `focusRound`, resolved against the same calendar
///   rows the Calendar screen reads;
/// - the latest completed event and the upcoming events: the season calendar,
///   through the shared chronology rules;
/// - the two championship leaders: the two standings tables, through the same
///   read models the Standings screen renders;
/// - the optional race-result enrichment: whatever result document is *already*
///   cached — Home never asks for one.
///
/// so the contract's `HomeData.latestCompletedEvent`, `driverLeader`,
/// `constructorLeader` and `upcomingEvents` are reconstructed rather than
/// persisted a second time. Nothing Drift-shaped escapes.
@DriftAccessor(
  tables: <Type>[
    Snapshots,
    Seasons,
    GrandPrixEvents,
    Sessions,
    Circuits,
    DriverStandings,
    ConstructorStandings,
    RaceResults,
  ],
)
class HomeDashboardDao extends DatabaseAccessor<GridViewDatabase>
    with _$HomeDashboardDaoMixin {
  HomeDashboardDao(super.db);

  static const String _homeSnapshotKey = 'home';

  /// Streams the Home dashboard, re-emitting whenever any resource it composes
  /// from commits.
  ///
  /// Emits `null` until a Home representation has been materialized for a
  /// season. [now] is the injected clock: the chronology rules are evaluated
  /// once per emission rather than inside a widget build.
  Stream<HomeDashboardView?> watchDashboard(DateTime Function() now) =>
      _watch(<ResultSetImplementation<dynamic, dynamic>>[
        snapshots,
        seasons,
        grandPrixEvents,
        sessions,
        circuits,
        driverStandings,
        constructorStandings,
        raceResults,
      ], () => readDashboard(now()));

  /// Reads the Home dashboard once at [now].
  Future<HomeDashboardView?> readDashboard(DateTime now) async {
    final SnapshotRow? snapshot =
        await (select(snapshots)
              ..where((Snapshots s) => s.key.equals(_homeSnapshotKey)))
            .getSingleOrNull();
    if (snapshot == null) return null;

    // `focusSeason` is the materialization signal: a Home representation always
    // knows which season it describes, and a snapshot that does not is not a
    // usable representation.
    final int? season = snapshot.focusSeason;
    if (season == null) return null;

    final Season? seasonRow = await attachedDatabase.seasonDao.readSeason(
      season,
    );
    // The season's events exactly as the Calendar screen reads them: same rows,
    // same circuit-resolution rule, same order. Home therefore cannot disagree
    // with the Calendar about a name, a status or a host circuit.
    final List<CalendarEntry> entries = await attachedDatabase.calendarDao
        .calendarEntries(season);

    final HomeFocus? focus = _resolveFocus(entries, snapshot.focusRound, now);
    final CalendarEntry? latest = _entryFor(
      entries,
      resolveLatestCompletedEvent(
        entries.map((CalendarEntry e) => e.grandPrix),
        now,
      )?.round,
    );

    return HomeDashboardView(
      seasonYear: season,
      season: seasonRow,
      focus: focus,
      latestCompleted: latest,
      latestRaceResult: latest == null
          ? null
          : await _cachedRaceResult(season, latest.round),
      upcoming:
          resolveUpcomingEvents(
                entries.map((CalendarEntry e) => e.grandPrix),
                now,
                excludeRound: focus?.round,
                limit: kHomeUpcomingEventLimit,
              )
              .map((GrandPrix e) => _entryFor(entries, e.round)!)
              .toList(growable: false),
      driverLeaders: await _driverLeaders(season),
      constructorLeaders: await _constructorLeaders(season),
    );
  }

  /// The featured event.
  ///
  /// The persisted Home focus is authoritative whenever it names a round that
  /// still exists in this season — a contract-defined completed focus is never
  /// replaced by the next race just because the calendar can already identify
  /// one. Only when the snapshot names **no** focus round at all does the shared
  /// relevant-event rule supply a safe calendar fallback, which is also what the
  /// Calendar screen highlights.
  HomeFocus? _resolveFocus(
    List<CalendarEntry> entries,
    int? focusRound,
    DateTime now,
  ) {
    if (focusRound != null) {
      final CalendarEntry? entry = _entryFor(entries, focusRound);
      if (entry != null) {
        return HomeFocus(
          grandPrix: entry.grandPrix,
          circuit: entry.circuit,
          source: HomeFocusSource.homeSnapshot,
        );
      }
      // A focus round whose event row is gone is an inconsistent cache; fall
      // through to the calendar rather than render a fabricated event.
    }
    final RelevantEvent? relevant = resolveRelevantEvent(
      entries.map((CalendarEntry e) => e.grandPrix),
      now,
    );
    if (relevant == null) return null;
    final CalendarEntry entry = _entryFor(entries, relevant.event.round)!;
    return HomeFocus(
      grandPrix: entry.grandPrix,
      circuit: entry.circuit,
      source: HomeFocusSource.calendarFallback,
    );
  }

  CalendarEntry? _entryFor(List<CalendarEntry> entries, int? round) {
    if (round == null) return null;
    for (final CalendarEntry entry in entries) {
      if (entry.round == round) return entry;
    }
    return null;
  }

  /// The already-cached **race** classification for a round, or `null`.
  ///
  /// Strictly the race document: a sprint classification is a different session
  /// with its own winner and is never substituted. Nothing here triggers a
  /// request — an absent document simply means the result resource has not been
  /// synchronised, which is not an error for Home.
  Future<RaceResult?> _cachedRaceResult(int season, int round) async {
    final List<RaceResult> results = await attachedDatabase.resultsDao
        .resultsForSeasonRound(season, round);
    for (final RaceResult result in results) {
      if (result.sessionType == SessionType.race) return result;
    }
    return null;
  }

  /// The drivers' rows holding a **confirmed** `position == 1`, in the delivered
  /// order.
  ///
  /// Reads the Standings read model so identities, season branding and the
  /// "never humanise an identifier" rule are exactly the ones the Standings
  /// screen applies. Filtering on a confirmed position is what keeps a leader
  /// from ever being inferred from a maximum points total or a row's place in
  /// the list.
  Future<List<DriverStandingEntry>> _driverLeaders(int season) async {
    final List<DriverStandingEntry> rows = await attachedDatabase.standingsDao
        .driverStandingEntries(season);
    return rows
        .where((DriverStandingEntry r) => r.position == 1)
        .toList(growable: false);
  }

  Future<List<ConstructorStandingEntry>> _constructorLeaders(int season) async {
    final List<ConstructorStandingEntry> rows = await attachedDatabase
        .standingsDao
        .constructorStandingEntries(season);
    return rows
        .where((ConstructorStandingEntry r) => r.position == 1)
        .toList(growable: false);
  }

  Stream<T> _watch<T>(
    List<ResultSetImplementation<dynamic, dynamic>> tables,
    Future<T> Function() read,
  ) async* {
    yield await read();
    yield* attachedDatabase
        .tableUpdates(TableUpdateQuery.onAllTables(tables))
        .asyncMap((_) => read());
  }
}
