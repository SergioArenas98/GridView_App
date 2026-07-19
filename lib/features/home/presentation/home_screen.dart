import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/time/session_time.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/home_view.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../../shared/presentation/widgets/session_list.dart';
import '../application/home_providers.dart';
import '../application/home_state.dart';

/// Home screen. The season context, next Grand Prix hero, weekend sessions and
/// freshness/offline notice are driven by the Drift-backed [homeStateProvider].
/// Cached content renders immediately; a skeleton shows only when there is no
/// cached content yet. Championship/results sections are out of this vertical
/// slice and are shown as clearly non-authoritative placeholders, never as
/// fictional data.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeState state = ref.watch(homeStateProvider);

    return GvScreenScaffold(
      title: l10n.appTitle,
      showSettingsAction: true,
      body: switch (state) {
        HomeLoading() => const _HomeSkeleton(),
        HomeFirstLoadError(:final failure) => GvErrorState(
          title: l10n.homeErrorTitle,
          message: failureMessage(l10n, failure),
          retryLabel: l10n.retry,
          onRetry: () => ref.read(homeControllerProvider.notifier).refresh(),
        ),
        HomeReady() => _HomeContent(state: state),
      },
    );
  }
}

class _HomeContent extends ConsumerWidget {
  const _HomeContent({required this.state});

  final HomeReady state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeView view = state.view;
    final int seasonYear = view.season?.year ?? view.featured.season;
    final bool showMock = ref.watch(usesMockDataProvider);
    final String? statusLabel = eventStatusLabel(l10n, view.featured.status);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: <Widget>[
        Text(l10n.seasonLabel('$seasonYear'), style: GvTypography.displayL),
        const SizedBox(height: GvSpacing.xs),
        _FreshnessLine(state: state),
        if (showMock) ...<Widget>[
          const SizedBox(height: GvSpacing.md),
          const MockDataBanner(),
        ],
        if (state.isStale || state.refreshError != null) ...<Widget>[
          const SizedBox(height: GvSpacing.md),
          GvOfflineNotice(
            message: state.refreshError != null
                ? l10n.refreshFailedNotice
                : l10n.offlineStaleNotice,
          ),
        ],
        const SizedBox(height: GvSpacing.xl),

        // Next Grand Prix hero.
        GvScreenSection(
          title: l10n.homeNextGrandPrix,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              GvHeroCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    if (statusLabel != null)
                      GvStatusChip(
                        label: statusLabel,
                        tone: toneForEventStatus(view.featured.status),
                      ),
                    const SizedBox(height: GvSpacing.sm),
                    Text(view.featured.name, style: GvTypography.pageTitle),
                    const SizedBox(height: GvSpacing.xxs),
                    Text(
                      _heroSubtitle(context, view),
                      style: GvTypography.bodyM,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: GvSpacing.sm),
              GvPrimaryButton(
                label: l10n.homeOpenGrandPrix,
                icon: Icons.arrow_forward,
                onPressed: () => context.openEntity(
                  RoutePaths.grandPrix(
                    season: view.featured.season,
                    round: view.featured.round,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: GvSpacing.xl),

        // Weekend sessions / status.
        if (view.featured.sessions.isNotEmpty)
          GvScreenSection(
            title: l10n.homeSessions,
            child: SessionList(
              sessions: view.featured.sessions,
              eventTimeZone: view.featured.timezone,
            ),
          ),
        const SizedBox(height: GvSpacing.xl),

        // Out-of-slice sections: non-authoritative placeholder (never fictional
        // standings/results).
        GvScreenSection(
          title: l10n.homeLeaders,
          child: GvEmptyState(
            title: l10n.homeMoreComingTitle,
            message: l10n.homeMoreComingMessage,
            icon: Icons.leaderboard_outlined,
          ),
        ),
      ],
    );
  }

  String _heroSubtitle(BuildContext context, HomeView view) {
    final SessionTimePresenter presenter = SessionTimePresenter(
      locale: Localizations.localeOf(context).languageCode,
    );
    final String? dateRange = presenter.formatDateRange(
      view.featured.startDate,
      view.featured.endDate,
    );
    return <String?>[
      view.circuit?.name,
      dateRange,
    ].whereType<String>().join(' · ');
  }
}

class _FreshnessLine extends StatelessWidget {
  const _FreshnessLine({required this.state});

  final HomeReady state;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final DateTime local = state.view.freshness.generatedAt.toLocal();
    final String time = DateFormat.Hm(
      Localizations.localeOf(context).languageCode,
    ).format(local);
    return Text(
      state.refreshing ? l10n.homeUpdated('…') : l10n.homeUpdated(time),
      style: GvTypography.caption,
    );
  }
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

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
        GvSkeletonBlock(width: 160, height: 28),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonCard(),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonBlock(width: 140, height: 18),
        SizedBox(height: GvSpacing.md),
        GvSkeletonBlock(height: 48),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 48),
      ],
    );
  }
}
