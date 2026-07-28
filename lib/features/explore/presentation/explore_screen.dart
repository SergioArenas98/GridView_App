import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../application/explore_providers.dart';
import '../application/explore_state.dart';
import '../application/explore_ui_state.dart';
import 'explore_cards.dart';
import 'explore_collection_view.dart';

/// The Explore branch: the current season's Drivers, Teams and Circuits
/// collections, read from Drift in their authoritative local order.
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
  /// genuinely independent positions.
  late final Map<ExploreCategory, ScrollController> _controllers;

  @override
  void initState() {
    super.initState();
    final ExploreUiState ui = ref.read(exploreUiStateProvider);
    final int? season = ref.read(exploreStateProvider(widget.category)).season;
    _controllers = <ExploreCategory, ScrollController>{
      for (final ExploreCategory c in ExploreCategory.values)
        c: ScrollController(initialScrollOffset: ui.offsetFor(c, season))
          ..addListener(() => _remember(c)),
    };
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

    return GvScreenScaffold(
      title: l10n.exploreTitle,
      showSettingsAction: true,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _ExploreHeader(season: state.season),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              GvLayout.screenPaddingHorizontal,
              0,
              GvLayout.screenPaddingHorizontal,
              GvSpacing.sm,
            ),
            child: Semantics(
              label: l10n.exploreCategorySelector,
              container: true,
              child: GvSegmentedControl(
                segments: <String>[
                  l10n.exploreDrivers,
                  l10n.exploreTeams,
                  l10n.exploreCircuits,
                ],
                selectedIndex: selected.index,
                onChanged: (int index) =>
                    _select(ExploreCategory.values[index]),
              ),
            ),
          ),
          Expanded(
            child: switch (selected) {
              ExploreCategory.drivers =>
                ExploreCollectionView<SeasonDriverCard>(
                  key: const ValueKey<String>('explore-drivers'),
                  state: state.drivers,
                  controller: _controllers[ExploreCategory.drivers]!,
                  emptyTitle: l10n.exploreDriversEmptyTitle,
                  emptyMessage: l10n.exploreDriversEmptyMessage,
                  errorTitle: l10n.exploreDriversErrorTitle,
                  emptyIcon: Icons.sports_motorsports_outlined,
                  onRetry: () => _retry(ExploreCategory.drivers),
                  itemBuilder: (BuildContext context, SeasonDriverCard card) =>
                      ExploreDriverCardRow(card: card),
                ),
              ExploreCategory.teams => ExploreCollectionView<SeasonTeamCard>(
                key: const ValueKey<String>('explore-teams'),
                state: state.teams,
                controller: _controllers[ExploreCategory.teams]!,
                emptyTitle: l10n.exploreTeamsEmptyTitle,
                emptyMessage: l10n.exploreTeamsEmptyMessage,
                errorTitle: l10n.exploreTeamsErrorTitle,
                emptyIcon: Icons.groups_outlined,
                onRetry: () => _retry(ExploreCategory.teams),
                itemBuilder: (BuildContext context, SeasonTeamCard card) =>
                    ExploreTeamCardRow(card: card),
              ),
              ExploreCategory.circuits =>
                ExploreCollectionView<SeasonCircuitCard>(
                  key: const ValueKey<String>('explore-circuits'),
                  state: state.circuits,
                  controller: _controllers[ExploreCategory.circuits]!,
                  emptyTitle: l10n.exploreCircuitsEmptyTitle,
                  emptyMessage: l10n.exploreCircuitsEmptyMessage,
                  errorTitle: l10n.exploreCircuitsErrorTitle,
                  emptyIcon: Icons.route_outlined,
                  onRetry: () => _retry(ExploreCategory.circuits),
                  itemBuilder: (BuildContext context, SeasonCircuitCard card) =>
                      ExploreCircuitCardRow(card: card),
                ),
            },
          ),
        ],
      ),
    );
  }
}

/// The season context and the mock-data banner. Freshness, notices and progress
/// belong to the selected collection and are rendered with its content, so
/// switching the selector immediately switches that context.
class _ExploreHeader extends ConsumerWidget {
  const _ExploreHeader({required this.season});

  final int? season;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final int? value = season;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const MockDataBanner(),
          if (value != null)
            Text(l10n.seasonLabel('$value'), style: GvTypography.label),
        ],
      ),
    );
  }
}
