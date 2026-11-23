import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/presentation/widgets/primer_pinned_header_layout.dart';
import '../application/explore_providers.dart';
import '../application/explore_state.dart';
import '../application/explore_ui_state.dart';
import 'explore_cards.dart';
import 'explore_collection_view.dart';
import 'widgets/explore_header.dart';
import 'widgets/explore_status.dart';

/// The Explore branch, in Primer V2 (Step 55C.7): the current season's
/// Drivers, Teams and Circuits collections, read from Drift in their
/// deterministic local order, as a reference library (EX-01, EX-02).
///
/// The title row, the season and the category selector are pinned; the
/// selected collection's caption, progress line and notices scroll with its
/// rows (owner-approved DD EF-1, Explore only).
///
/// The three categories are **route-addressable** (`/explore/drivers`,
/// `/explore/teams`, `/explore/circuits`) and rendered by this one screen, so a
/// category switch replaces the page inside the Explore branch instead of
/// stacking a second Explore page. `/explore` is the branch root and opens
/// Drivers.
///
/// Selecting a category is navigation state, never remote-data state: it can
/// never initiate a request. The screen launches no refresh of its own when it
/// is built, when the category changes or when a Drift emission arrives —
/// startup and foreground synchronization of the current-season core set (which
/// includes all three collections) belong to the application coordinator
/// (ADR 0015). The only request this screen can produce is the user's explicit,
/// focused retry of the exact selected collection.
class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, this.category = ExploreCategory.drivers});

  /// The category this route encodes. The branch root defaults to Drivers.
  final ExploreCategory category;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  /// One controller per category — never shared — so the three lists keep
  /// genuinely independent positions. Replaced as a set on a season
  /// transition (see [_followSeason]); never mutated in place.
  late Map<ExploreCategory, ScrollController> _controllers;

  /// The last *known* resolved season the controllers belong to. A transient
  /// unresolved (`null`) season leaves it untouched, so a same-season
  /// recovery never resets the lists.
  int? _season;

  @override
  void initState() {
    super.initState();
    final ExploreUiState ui = ref.read(exploreUiStateProvider);
    _season = ref.read(exploreStateProvider(widget.category)).season;
    _controllers = _controllersAt(
      (ExploreCategory c) => ui.offsetFor(c, _season),
    );
  }

  Map<ExploreCategory, ScrollController> _controllersAt(
    double Function(ExploreCategory category) offset,
  ) => <ExploreCategory, ScrollController>{
    for (final ExploreCategory c in ExploreCategory.values)
      c: ScrollController(initialScrollOffset: offset(c))
        ..addListener(() => _remember(c)),
  };

  /// A genuine transition from one known season to a different known season
  /// starts all three collections at the top: a new season never inherits
  /// another season's offset (Phase 7C navigation contract).
  ///
  /// Runs during build, before the lists are built, so the new controllers are
  /// the ones the new season's scroll views attach. Those views carry a
  /// season-scoped storage key, so the previous season's views are replaced
  /// (detaching the old controllers) and nothing is restored from page storage;
  /// the old controllers are disposed after that frame, once detached.
  void _followSeason(int? season) {
    if (season == null || season == _season) return;
    final int? previous = _season;
    _season = season;
    if (previous == null) return;
    final List<ScrollController> retired = _controllers.values.toList();
    _controllers = _controllersAt((ExploreCategory _) => 0);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final ScrollController c in retired) {
        c.dispose();
      }
    });
  }

  @override
  void dispose() {
    for (final ScrollController c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Records a list's offset without rebuilding anything, so a Drift emission
  /// or a focused refresh never resets a scroll position.
  void _remember(ExploreCategory category) {
    final ScrollController controller = _controllers[category]!;
    if (!controller.hasClients) return;
    ref
        .read(exploreUiStateProvider.notifier)
        .rememberOffset(
          category: category,
          season: ref.read(exploreStateProvider(widget.category)).season,
          offset: controller.offset,
        );
  }

  /// A category change is presentation + navigation only: it never produces a
  /// request. The sibling route replaces the current page, so repeated
  /// switching can never build a Drivers → Teams → Drivers stack.
  void _select(ExploreCategory category) {
    if (category == widget.category) return;
    context.go(switch (category) {
      ExploreCategory.drivers => RoutePaths.exploreDrivers(),
      ExploreCategory.teams => RoutePaths.exploreTeams(),
      ExploreCategory.circuits => RoutePaths.exploreCircuits(),
    });
  }

  Future<void> _retry(ExploreCategory category) =>
      ref.read(exploreControllerProvider.notifier).retry(category);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ExploreScreenState state = ref.watch(
      exploreStateProvider(widget.category),
    );
    final ExploreCategory selected = state.selected;
    final int? season = state.season;
    _followSeason(season);
    final bool showMock = ref.watch(usesMockDataProvider);
    final ExploreStatusFacts facts = switch (selected) {
      ExploreCategory.drivers => ExploreStatusFacts.of(state.drivers),
      ExploreCategory.teams => ExploreStatusFacts.of(state.teams),
      ExploreCategory.circuits => ExploreStatusFacts.of(state.circuits),
    };

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        // Step 55C.15R: the header stays pinned unless it would leave the
        // list less than two targets (a short viewport at large text with the
        // strip and the 2 x 2 navigation); then it scrolls with the page.
        child: PrimerPinnedHeaderLayout(
          header: ExploreHeader(
            season: season == null ? null : l10n.seasonLabel('$season'),
            selected: selected,
            onSelect: _select,
            onOpenSettings: () => context.openSettings(),
          ),
          body: switch (selected) {
            ExploreCategory.drivers => ExploreCollectionView<SeasonDriverCard>(
              key: const ValueKey<String>('explore-drivers'),
              storageKey: 'explore-drivers-list-$_season',
              status: ExploreStatus(facts: facts, showMock: showMock),
              onOffsetCorrected: () => _remember(ExploreCategory.drivers),
              state: state.drivers,
              controller: _controllers[ExploreCategory.drivers]!,
              emptyTitle: l10n.exploreDriversEmptyTitle,
              emptyMessage: l10n.exploreDriversEmptyMessage,
              errorTitle: l10n.exploreDriversErrorTitle,
              emptyIcon: Icons.sports_motorsports_outlined,
              onRetry: () => _retry(ExploreCategory.drivers),
              hasMedia: driverHasMedia,
              itemBuilder:
                  (
                    BuildContext context,
                    SeasonDriverCard card, {
                    required bool mediaColumn,
                    required bool dividerAbove,
                  }) => ExploreDriverCardRow(
                    card: card,
                    mediaColumn: mediaColumn,
                    dividerAbove: dividerAbove,
                  ),
            ),
            ExploreCategory.teams => ExploreCollectionView<SeasonTeamCard>(
              key: const ValueKey<String>('explore-teams'),
              storageKey: 'explore-teams-list-$_season',
              status: ExploreStatus(facts: facts, showMock: showMock),
              onOffsetCorrected: () => _remember(ExploreCategory.teams),
              state: state.teams,
              controller: _controllers[ExploreCategory.teams]!,
              emptyTitle: l10n.exploreTeamsEmptyTitle,
              emptyMessage: l10n.exploreTeamsEmptyMessage,
              errorTitle: l10n.exploreTeamsErrorTitle,
              emptyIcon: Icons.groups_outlined,
              onRetry: () => _retry(ExploreCategory.teams),
              hasMedia: teamHasMedia,
              itemBuilder:
                  (
                    BuildContext context,
                    SeasonTeamCard card, {
                    required bool mediaColumn,
                    required bool dividerAbove,
                  }) => ExploreTeamCardRow(
                    card: card,
                    mediaColumn: mediaColumn,
                    dividerAbove: dividerAbove,
                  ),
            ),
            ExploreCategory.circuits =>
              ExploreCollectionView<SeasonCircuitCard>(
                key: const ValueKey<String>('explore-circuits'),
                storageKey: 'explore-circuits-list-$_season',
                status: ExploreStatus(facts: facts, showMock: showMock),
                onOffsetCorrected: () => _remember(ExploreCategory.circuits),
                state: state.circuits,
                controller: _controllers[ExploreCategory.circuits]!,
                emptyTitle: l10n.exploreCircuitsEmptyTitle,
                emptyMessage: l10n.exploreCircuitsEmptyMessage,
                errorTitle: l10n.exploreCircuitsErrorTitle,
                emptyIcon: Icons.route_outlined,
                onRetry: () => _retry(ExploreCategory.circuits),
                hasMedia: circuitHasMedia,
                itemBuilder:
                    (
                      BuildContext context,
                      SeasonCircuitCard card, {
                      required bool mediaColumn,
                      required bool dividerAbove,
                    }) => ExploreCircuitCardRow(
                      card: card,
                      mediaColumn: mediaColumn,
                      dividerAbove: dividerAbove,
                    ),
              ),
          },
        ),
      ),
    );
  }
}
