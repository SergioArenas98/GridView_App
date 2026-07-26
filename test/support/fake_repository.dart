import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/grand_prix_repository.dart';
import 'package:gridview/features/shared/domain/repositories/home_repository.dart';

/// A plain-Dart fake for the Home and Grand Prix repositories, for widget tests.
///
/// Widget tests drive the *screens'* rendering of each controller state. The
/// real Drift pipeline is exercised end to end by the DAO, repository and
/// ProviderContainer controller tests (which run with real async). Using plain
/// streams here avoids Drift's stream-query timers, which are incompatible with
/// `pumpAndSettle` under the widget-test `FakeAsync` zone.
///
/// One class implements both repositories so a single instance backs both the
/// [homeRepositoryProvider] and [grandPrixRepositoryProvider] overrides.
class FakeRaceWeekendRepository implements HomeRepository, GrandPrixRepository {
  FakeRaceWeekendRepository({
    this.home,
    this.grandPrix,
    this.homeStream,
    this.grandPrixStream,
    this.onRefreshHome,
    this.onRefreshGrandPrix,
  });

  /// Static Home value emitted once (used when [homeStream] is null).
  final HomeView? home;

  /// Builds the detail value for a (season, round); emitted once when
  /// [grandPrixStream] is null.
  final GrandPrixDetailView? Function(int season, int round)? grandPrix;

  /// Overrides the Home stream entirely (e.g. a never-emitting stream to hold
  /// the loading state).
  final Stream<HomeView?>? homeStream;
  final Stream<GrandPrixDetailView?> Function(int season, int round)?
  grandPrixStream;

  final Future<RefreshResult> Function()? onRefreshHome;
  final Future<RefreshResult> Function(int season, int round)?
  onRefreshGrandPrix;

  @override
  Stream<HomeView?> watchHome() => homeStream ?? Stream<HomeView?>.value(home);

  @override
  Future<HomeView?> readHome() => watchHome().first;

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
  }) =>
      onRefreshHome?.call() ??
      Future<RefreshResult>.value(const RefreshSuccess());

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) =>
      onRefreshGrandPrix?.call(season, round) ??
      Future<RefreshResult>.value(const RefreshSuccess());
}
