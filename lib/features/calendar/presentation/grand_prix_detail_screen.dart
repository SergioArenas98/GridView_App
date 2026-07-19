import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../../shared/presentation/widgets/session_list.dart';
import '../application/grand_prix_detail_providers.dart';
import '../application/grand_prix_detail_state.dart';

/// Grand Prix detail. Wired to the same Drift-backed repository as Home: it
/// renders cached content immediately and offline, refreshes without clearing
/// content, and shows a controlled not-found state when a successful refresh
/// determines the Grand Prix does not exist. [season] and [round] are already
/// validated by the router.
class GrandPrixDetailScreen extends ConsumerWidget {
  const GrandPrixDetailScreen({
    super.key,
    required this.season,
    required this.round,
  });

  final int season;
  final int round;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixKey key = (season: season, round: round);
    final GrandPrixDetailState state = ref.watch(grandPrixStateProvider(key));

    return GvScreenScaffold(
      title: l10n.grandPrixTitle,
      body: switch (state) {
        GrandPrixLoading() => const _DetailSkeleton(),
        GrandPrixNotFound() => GvErrorState(
          title: l10n.grandPrixNotFoundTitle,
          message: l10n.grandPrixNotFoundMessage,
          icon: Icons.event_busy_outlined,
          retryLabel: l10n.notFoundGoHome,
          onRetry: () => context.go(RoutePaths.home),
        ),
        GrandPrixFirstLoadError(:final failure) => GvErrorState(
          title: l10n.grandPrixErrorTitle,
          message: failureMessage(l10n, failure),
          retryLabel: l10n.retry,
          onRetry: () =>
              ref.read(grandPrixControllerProvider(key).notifier).refresh(),
        ),
        GrandPrixReady() => _DetailContent(
          season: season,
          round: round,
          state: state,
        ),
      },
    );
  }
}

class _DetailContent extends ConsumerWidget {
  const _DetailContent({
    required this.season,
    required this.round,
    required this.state,
  });

  final int season;
  final int round;
  final GrandPrixReady state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixDetailView view = state.view;
    final bool showMock = ref.watch(usesMockDataProvider);
    final String? statusLabel = eventStatusLabel(l10n, view.grandPrix.status);
    final String circuitName = view.circuit?.name ?? view.grandPrix.circuitId;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: <Widget>[
        if (showMock) ...<Widget>[
          const MockDataBanner(),
          const SizedBox(height: GvSpacing.md),
        ],
        if (state.isStale || state.refreshError != null) ...<Widget>[
          GvOfflineNotice(
            message: state.refreshError != null
                ? l10n.refreshFailedNotice
                : l10n.offlineStaleNotice,
          ),
          const SizedBox(height: GvSpacing.md),
        ],

        // Hero / identity.
        GvHeroCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: <Widget>[
              if (statusLabel != null)
                GvStatusChip(
                  label: statusLabel,
                  tone: toneForEventStatus(view.grandPrix.status),
                ),
              const SizedBox(height: GvSpacing.sm),
              Text(view.grandPrix.name, style: GvTypography.pageTitle),
              const SizedBox(height: GvSpacing.xxs),
              Text(
                '${l10n.roundLabel('${view.grandPrix.round}')} · '
                '${l10n.seasonLabel('${view.grandPrix.season}')}',
                style: GvTypography.bodyM,
              ),
            ],
          ),
        ),
        const SizedBox(height: GvSpacing.xl),

        // Circuit summary (a disabled presentation element in this phase — the
        // circuit detail screen is not part of the vertical slice).
        GvScreenSection(
          title: l10n.grandPrixCircuit,
          child: GvContentCard(
            child: Row(
              children: <Widget>[
                const SizedBox(
                  width: 56,
                  child: GvImagePlaceholder(
                    aspectRatio: 16 / 9,
                    icon: Icons.route_outlined,
                  ),
                ),
                const SizedBox(width: GvSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(circuitName, style: GvTypography.cardTitle),
                      if (view.circuit?.country != null)
                        Text(view.circuit!.country!, style: GvTypography.label),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: GvSpacing.xl),

        // Ordered sessions.
        if (view.grandPrix.sessions.isNotEmpty)
          GvScreenSection(
            title: l10n.grandPrixSessions,
            child: SessionList(
              sessions: view.grandPrix.sessions,
              eventTimeZone: view.grandPrix.timezone,
            ),
          ),
        const SizedBox(height: GvSpacing.xl),

        // Result availability (no fictional classification is shown).
        GvScreenSection(
          title: l10n.grandPrixResults,
          child: Text(
            view.grandPrix.hasResults
                ? l10n.grandPrixResultsAvailable
                : l10n.grandPrixResultsPending,
            style: GvTypography.bodyM,
          ),
        ),
      ],
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: const <Widget>[
        GvSkeletonCard(),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonBlock(width: 120, height: 18),
        SizedBox(height: GvSpacing.md),
        GvSkeletonBlock(height: 48),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 48),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 48),
      ],
    );
  }
}
