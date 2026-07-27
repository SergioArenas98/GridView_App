import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'standings_state.dart';

/// The Standings branch's transient, presentation-only session state: which
/// championship is selected and each table's remembered scroll offset.
///
/// It holds no content and performs no synchronization. It lives for the
/// application session (a root-scope provider), so the selection and both scroll
/// offsets survive a bottom-navigation branch switch, a Driver/Constructor
/// detail round trip and every local stream emission — and reset to Drivers at
/// the top on a fresh launch, because nothing is persisted to disk in Phase 7B.
///
/// Immutable: every change produces a new value rather than mutating this one.
class StandingsUiState {
  const StandingsUiState({
    this.selected = StandingsChampionship.drivers,
    this.season,
    this.driversOffset = 0,
    this.constructorsOffset = 0,
  });

  /// Drivers on the first visit of an application session.
  final StandingsChampionship selected;

  /// The season the remembered offsets belong to. Offsets are only restored for
  /// the same season: a season transition starts the new season's tables at the
  /// top instead of at a stale position.
  final int? season;

  final double driversOffset;
  final double constructorsOffset;

  /// The remembered offset for [championship] in [season], or `0` when the
  /// offsets belong to a different season.
  double offsetFor(StandingsChampionship championship, int? season) {
    if (season != this.season) return 0;
    return switch (championship) {
      StandingsChampionship.drivers => driversOffset,
      StandingsChampionship.constructors => constructorsOffset,
    };
  }

  StandingsUiState copyWith({
    StandingsChampionship? selected,
    int? season,
    double? driversOffset,
    double? constructorsOffset,
  }) => StandingsUiState(
    selected: selected ?? this.selected,
    season: season ?? this.season,
    driversOffset: driversOffset ?? this.driversOffset,
    constructorsOffset: constructorsOffset ?? this.constructorsOffset,
  );
}

/// Owns [StandingsUiState]. Creating it starts **no** refresh and reads no
/// content: selecting a championship is a presentation change only, never a
/// request.
class StandingsUiController extends Notifier<StandingsUiState> {
  @override
  StandingsUiState build() => const StandingsUiState();

  /// Selects a championship. Idempotent, so a repeated tap changes nothing (and
  /// therefore rebuilds nothing and recreates no scroll position).
  void select(StandingsChampionship championship) {
    if (state.selected == championship) return;
    state = state.copyWith(selected: championship);
  }

  /// Remembers [offset] for [championship] within [season].
  ///
  /// A season change drops the previous season's offsets rather than applying
  /// them to a different table; the prior branch session's cached rows on disk
  /// are untouched either way.
  void rememberOffset({
    required StandingsChampionship championship,
    required int? season,
    required double offset,
  }) {
    final bool sameSeason = season == state.season;
    final double drivers = sameSeason ? state.driversOffset : 0;
    final double constructors = sameSeason ? state.constructorsOffset : 0;
    state = StandingsUiState(
      selected: state.selected,
      season: season,
      driversOffset: championship == StandingsChampionship.drivers
          ? offset
          : drivers,
      constructorsOffset: championship == StandingsChampionship.constructors
          ? offset
          : constructors,
    );
  }
}

final NotifierProvider<StandingsUiController, StandingsUiState>
standingsUiStateProvider =
    NotifierProvider<StandingsUiController, StandingsUiState>(
      StandingsUiController.new,
    );
