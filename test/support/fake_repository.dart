import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/calendar_repository.dart';
import 'package:gridview/features/shared/domain/repositories/grand_prix_repository.dart';
import 'package:gridview/features/shared/domain/repositories/home_repository.dart';
import 'package:gridview/features/shared/domain/repositories/result_repository.dart';

/// A plain-Dart fake for the Home, Calendar, Grand Prix and Result repositories,
/// for widget tests.
///
/// Widget tests drive the *screens'* rendering of each controller state. The
/// real Drift pipeline is exercised end to end by the DAO, repository and
/// ProviderContainer controller tests (which run with real async). Using plain
/// streams here avoids Drift's stream-query timers, which are incompatible with
/// `pumpAndSettle` under the widget-test `FakeAsync` zone.
///
/// One class implements all four repositories so a single instance backs the
/// `homeRepositoryProvider`, `calendarRepositoryProvider`,
/// `grandPrixRepositoryProvider` and `resultRepositoryProvider` overrides.
class FakeRaceWeekendRepository
    implements
        HomeRepository,
        CalendarRepository,
        GrandPrixRepository,
        ResultRepository {
  FakeRaceWeekendRepository({
    this.home,
    this.calendar,
    this.grandPrix,
    this.results,
    this.homeStream,
    this.calendarStream,
    this.grandPrixStream,
    this.resultsStream,
    this.onRefreshHome,
    this.onRefreshCalendar,
    this.onRefreshGrandPrix,
    this.onRefreshResults,
  });

  /// Static Home value emitted once (used when [homeStream] is null).
  final HomeView? home;

  /// Static calendar emitted once per season (used when [calendarStream] is
  /// null).
  final List<CalendarEntry> Function(int season)? calendar;

  /// Builds the detail value for a (season, round); emitted once when
  /// [grandPrixStream] is null.
  final GrandPrixDetailView? Function(int season, int round)? grandPrix;

  /// Builds the stored classifications for a (season, round).
  final List<RaceResult> Function(int season, int round)? results;

  /// Overrides the Home stream entirely (e.g. a never-emitting stream to hold
  /// the loading state).
  final Stream<HomeView?>? homeStream;
  final Stream<List<CalendarEntry>> Function(int season)? calendarStream;
  final Stream<GrandPrixDetailView?> Function(int season, int round)?
  grandPrixStream;
  final Stream<List<RaceResult>> Function(int season, int round)? resultsStream;

  final Future<RefreshResult> Function()? onRefreshHome;
  final Future<RefreshResult> Function(int season)? onRefreshCalendar;
  final Future<RefreshResult> Function(int season, int round)?
  onRefreshGrandPrix;
  final Future<RefreshResult> Function(int season, int round)? onRefreshResults;

  /// How many times each refresh entry point was called, so a test can assert
  /// that a rebuild produced no extra request.
  int homeRefreshCount = 0;
  int calendarRefreshCount = 0;
  int grandPrixRefreshCount = 0;
  int resultsRefreshCount = 0;

  @override
  Stream<HomeView?> watchHome() => homeStream ?? Stream<HomeView?>.value(home);

  @override
  Future<HomeView?> readHome() => watchHome().first;

  @override
  Stream<List<CalendarEntry>> watchCalendar(int season) {
    if (calendarStream != null) return calendarStream!(season);
    return Stream<List<CalendarEntry>>.value(
      calendar?.call(season) ?? const <CalendarEntry>[],
    );
  }

  @override
  Future<List<CalendarEntry>> readCalendar(int season) =>
      watchCalendar(season).first;

  @override
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  }) {
    if (grandPrixStream != null) return grandPrixStream!(season, round);
    return Stream<GrandPrixDetailView?>.value(grandPrix?.call(season, round));
  }

  @override
  Future<GrandPrixDetailView?> readGrandPrix({
    required int season,
    required int round,
  }) => watchGrandPrix(season: season, round: round).first;

  @override
  Stream<List<RaceResult>> watchResults({
    required int season,
    required int round,
  }) {
    if (resultsStream != null) return resultsStream!(season, round);
    return Stream<List<RaceResult>>.value(
      results?.call(season, round) ?? const <RaceResult>[],
    );
  }

  @override
  Future<List<RaceResult>> readResults({
    required int season,
    required int round,
  }) => watchResults(season: season, round: round).first;

  @override
  Future<int?> materializedSeason() async =>
      (await watchHome().first)?.seasonYear;

  @override
  Stream<int?> watchMaterializedSeason() =>
      watchHome().map((HomeView? view) => view?.seasonYear);

  @override
  Future<RefreshResult> refreshHome({
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    homeRefreshCount++;
    return onRefreshHome?.call() ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshCalendar(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    calendarRefreshCount++;
    return onRefreshCalendar?.call(season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    grandPrixRefreshCount++;
    return onRefreshGrandPrix?.call(season, round) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshResults({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    resultsRefreshCount++;
    return onRefreshResults?.call(season, round) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }
}
