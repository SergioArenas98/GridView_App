import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';

/// A plain-Dart fake repository for widget tests.
///
/// Widget tests drive the *screens'* rendering of each controller state. The
/// real Drift pipeline is exercised end to end by the DAO, repository and
/// ProviderContainer controller tests (which run with real async). Using plain
/// streams here avoids Drift's stream-query timers, which are incompatible with
/// `pumpAndSettle` under the widget-test `FakeAsync` zone.
class FakeRaceWeekendRepository implements RaceWeekendRepository {
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
  Stream<GrandPrixDetailView?> watchGrandPrix({
    required int season,
    required int round,
  }) {
    if (grandPrixStream != null) return grandPrixStream!(season, round);
    return Stream<GrandPrixDetailView?>.value(grandPrix?.call(season, round));
  }

  @override
  Future<RefreshResult> refreshHome() =>
      onRefreshHome?.call() ??
      Future<RefreshResult>.value(const RefreshSuccess());

  @override
  Future<RefreshResult> refreshGrandPrix({
    required int season,
    required int round,
  }) =>
      onRefreshGrandPrix?.call(season, round) ??
      Future<RefreshResult>.value(const RefreshSuccess());
}
