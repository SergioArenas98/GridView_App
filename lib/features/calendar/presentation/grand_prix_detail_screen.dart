import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/domain/entities/race_result.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../../shared/presentation/widgets/session_list.dart';
import '../application/grand_prix_detail_providers.dart';
import '../application/grand_prix_detail_state.dart';
import '../application/grand_prix_results_state.dart';
import 'widgets/grand_prix_event_info.dart';
import 'widgets/grand_prix_hero.dart';
import 'widgets/grand_prix_results_section.dart';

/// Grand Prix detail: identity, the weekend's factual block, every persisted
/// session in delivered order and the stored classifications.
///
/// Everything renders from Drift. Detail and results are two independent
/// on-demand resources: each is requested at most once when the route opens,
/// cached content stays visible while either refreshes, and a failure in one
/// never blanks the other. [season] and [round] are already validated by the
/// router.
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
    // Mounting the results controller is what makes the result resource
    // eligible; it decides for itself whether a request is warranted.
    ref.watch(grandPrixResultsControllerProvider(key));

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
        GrandPrixReady() => _DetailContent(gpKey: key, state: state),
      },
    );
  }
}

class _DetailContent extends ConsumerWidget {
  const _DetailContent({required this.gpKey, required this.state});

  final GrandPrixKey gpKey;
  final GrandPrixReady state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixDetailView view = state.view;
    final bool showMock = ref.watch(usesMockDataProvider);
    final GrandPrixResultsState results = ref.watch(
      grandPrixResultsStateProvider(gpKey),
    );
    final String deviceTimeZone = ref.watch(deviceTimeZoneLabelProvider);

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
        // Detail freshness only — the result section keeps its own record.
        if (state.isStale || state.refreshError != null) ...<Widget>[
          GvOfflineNotice(
            message: state.refreshError != null
                ? l10n.refreshFailedNotice
                : l10n.offlineStaleNotice,
          ),
          const SizedBox(height: GvSpacing.md),
        ],

        GrandPrixHero(view: view),
        const SizedBox(height: GvSpacing.xl),

        GvScreenSection(
          title: l10n.grandPrixCircuit,
          child: GrandPrixEventInfo(view: view, deviceTimeZone: deviceTimeZone),
        ),
        const SizedBox(height: GvSpacing.xl),

        GvScreenSection(
          title: l10n.grandPrixSessions,
          child: view.grandPrix.sessions.isEmpty
              ? GvEmptyState(
                  title: l10n.grandPrixNoSessionsTitle,
                  message: l10n.grandPrixNoSessionsMessage,
                  icon: Icons.schedule_outlined,
                )
              : SessionList(
                  sessions: view.grandPrix.sessions,
                  eventTimeZone: view.grandPrix.timezone,
                ),
        ),
        const SizedBox(height: GvSpacing.xl),

        _ResultsArea(gpKey: gpKey, state: results),
      ],
    );
  }
}

/// The result area. Independent of the detail state above it: it can be loading,
/// unavailable or failed without ever removing the weekend information.
class _ResultsArea extends ConsumerWidget {
  const _ResultsArea({required this.gpKey, required this.state});

  final GrandPrixKey gpKey;
  final GrandPrixResultsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);

    return switch (state) {
      GrandPrixResultsUnavailable() => GvScreenSection(
        title: l10n.grandPrixResults,
        child: GvEmptyState(
          title: l10n.grandPrixResultsUnavailableTitle,
          message: l10n.grandPrixResultsPending,
          icon: Icons.flag_outlined,
        ),
      ),
      GrandPrixResultsLoading() => GvScreenSection(
        title: l10n.grandPrixResults,
        child: const Column(
          children: <Widget>[
            GvSkeletonBlock(height: 56),
            SizedBox(height: GvSpacing.sm),
            GvSkeletonBlock(height: 56),
          ],
        ),
      ),
      GrandPrixResultsError(:final failure) => GvScreenSection(
        title: l10n.grandPrixResults,
        child: GvErrorState(
          title: l10n.grandPrixResultsErrorTitle,
          message: failureMessage(l10n, failure),
          icon: Icons.flag_outlined,
          retryLabel: l10n.retry,
          onRetry: () => ref
              .read(grandPrixResultsControllerProvider(gpKey).notifier)
              .refresh(),
        ),
      ),
      final GrandPrixResultsReady ready => _ResultsReady(state: ready),
    };
  }
}

class _ResultsReady extends StatelessWidget {
  const _ResultsReady({required this.state});

  final GrandPrixResultsReady state;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // Cached classifications stay visible while their own resource
        // refreshes or after it fails.
        if (state.isStale || state.refreshError != null) ...<Widget>[
          GvOfflineNotice(
            message: state.refreshError != null
                ? l10n.refreshFailedNotice
                : l10n.offlineStaleNotice,
          ),
          const SizedBox(height: GvSpacing.md),
        ],
        for (final RaceResult document in state.documents) ...<Widget>[
          GrandPrixResultSection(
            key: ValueKey<String>('results-${document.id}'),
            document: document,
          ),
          const SizedBox(height: GvSpacing.xl),
        ],
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
