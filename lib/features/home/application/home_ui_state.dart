import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Home's transient, presentation-only session state: the dashboard's remembered
/// scroll offset.
///
/// It holds no content and performs no synchronization. It lives for the
/// application session (a root-scope provider), so the offset survives a
/// bottom-navigation branch switch, a detail round trip and every local stream
/// emission — and resets on a fresh launch, because nothing is persisted to disk.
///
/// Immutable: every change produces a new value rather than mutating this one.
class HomeUiState {
  const HomeUiState({this.season, this.offset = 0});

  /// The season the remembered offset belongs to. A season transition starts the
  /// new season's dashboard at the top rather than at a stale position, while
  /// leaving the branch itself perfectly valid.
  final int? season;

  final double offset;

  /// The remembered offset for [season], or `0` when it belongs to another one.
  double offsetFor(int? season) => season == this.season ? offset : 0;
}

/// Owns [HomeUiState]. Creating it starts **no** refresh and reads no content.
class HomeUiController extends Notifier<HomeUiState> {
  @override
  HomeUiState build() => const HomeUiState();

  /// Records the dashboard's offset without rebuilding anything, so a Drift
  /// emission or a background refresh never resets the scroll position.
  void rememberOffset({required int? season, required double offset}) {
    state = HomeUiState(season: season, offset: offset);
  }
}

final NotifierProvider<HomeUiController, HomeUiState> homeUiStateProvider =
    NotifierProvider<HomeUiController, HomeUiState>(HomeUiController.new);
