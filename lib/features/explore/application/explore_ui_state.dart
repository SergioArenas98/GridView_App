import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'explore_state.dart';

/// The Explore branch's transient, presentation-only session state: each
/// category's remembered scroll offset.
///
/// The **selected category is route state**, not held here: it is encoded in the
/// location (`/explore/drivers`, `/explore/teams`, `/explore/circuits`), so a
/// bottom-navigation branch switch preserves it through the shell's own branch
/// state and an explicit URL opens the category it encodes.
///
/// This object holds no content and performs no synchronization. It lives for
/// the application session (a root-scope provider), so all three offsets survive
/// a category switch, a bottom-navigation branch switch, an entity-detail round
/// trip and every local stream emission — and reset on a fresh launch, because
/// nothing is persisted to disk in Phase 7C.
///
/// Immutable: every change produces a new value rather than mutating this one.
class ExploreUiState {
  const ExploreUiState({
    this.season,
    this.driversOffset = 0,
    this.teamsOffset = 0,
    this.circuitsOffset = 0,
  });

  /// The season the remembered offsets belong to. Offsets are only restored for
  /// the same season: a season transition starts the new season's lists at the
  /// top instead of at a stale position, without disturbing the rows already
  /// stored on disk for the previous season.
  final int? season;

  final double driversOffset;
  final double teamsOffset;
  final double circuitsOffset;

  /// The remembered offset for [category] in [season], or `0` when the offsets
  /// belong to a different season.
  double offsetFor(ExploreCategory category, int? season) {
    if (season != this.season) return 0;
    return switch (category) {
      ExploreCategory.drivers => driversOffset,
      ExploreCategory.teams => teamsOffset,
      ExploreCategory.circuits => circuitsOffset,
    };
  }
}

/// Owns [ExploreUiState]. Creating it starts **no** refresh and reads no
/// content: remembering a scroll position is a presentation change only, never a
/// request.
class ExploreUiController extends Notifier<ExploreUiState> {
  @override
  ExploreUiState build() => const ExploreUiState();

  /// Remembers [offset] for [category] within [season].
  ///
  /// A season change drops the previous season's offsets rather than applying
  /// them to a different list; the prior branch session's cached rows on disk
  /// are untouched either way.
  void rememberOffset({
    required ExploreCategory category,
    required int? season,
    required double offset,
  }) {
    final bool sameSeason = season == state.season;
    final double drivers = sameSeason ? state.driversOffset : 0;
    final double teams = sameSeason ? state.teamsOffset : 0;
    final double circuits = sameSeason ? state.circuitsOffset : 0;
    state = ExploreUiState(
      season: season,
      driversOffset: category == ExploreCategory.drivers ? offset : drivers,
      teamsOffset: category == ExploreCategory.teams ? offset : teams,
      circuitsOffset: category == ExploreCategory.circuits ? offset : circuits,
    );
  }
}

final NotifierProvider<ExploreUiController, ExploreUiState>
exploreUiStateProvider = NotifierProvider<ExploreUiController, ExploreUiState>(
  ExploreUiController.new,
);
