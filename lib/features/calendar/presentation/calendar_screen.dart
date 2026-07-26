import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/domain/relevant_event.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../application/calendar_providers.dart';
import '../application/calendar_state.dart';
import 'widgets/calendar_event_card.dart';
import 'widgets/calendar_scroll_anchor.dart';

/// The Calendar branch root: the locally resolved current season's events, read
/// from Drift in their persisted (round) order.
///
/// The screen never launches a refresh of its own — startup and foreground
/// synchronization belong to the application coordinator — so building it, or
/// rebuilding it, can never produce a request. Pull-to-refresh (and the app-bar
/// action) go through the coordinator's manual current-season entry point.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  final ScrollController _controller = ScrollController();
  final GlobalKey _anchorKey = GlobalKey();
  late final CalendarScrollAnchor _anchor = CalendarScrollAnchor(
    controller: _controller,
    anchorKey: _anchorKey,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _refresh() =>
      ref.read(calendarControllerProvider.notifier).refresh();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final CalendarState state = ref.watch(calendarStateProvider);

    return GvScreenScaffold(
      title: l10n.calendarTitle,
      showSettingsAction: true,
      extraActions: <Widget>[
        GvIconButton(
          key: const ValueKey<String>('calendar-refresh'),
          icon: Icons.refresh,
          semanticLabel: l10n.calendarRefreshAction,
          onPressed: _refresh,
        ),
      ],
      body: switch (state) {
        CalendarLoading() => const _CalendarSkeleton(),
        CalendarFirstLoadError(:final CalendarFailure failure) => GvErrorState(
          title: switch (failure.cause) {
            CalendarFailureCause.seasonUnresolved =>
              l10n.calendarSeasonUnavailableTitle,
            CalendarFailureCause.resourceFailed => l10n.calendarErrorTitle,
          },
          message: failure.failure == null
              ? l10n.calendarSeasonUnavailableMessage
              : failureMessage(l10n, failure.failure!),
          icon: Icons.calendar_month_outlined,
          retryLabel: l10n.retry,
          onRetry: _refresh,
        ),
        CalendarEmpty() => _CalendarEmpty(state: state, onRefresh: _refresh),
        CalendarReady() => _CalendarList(
          state: state,
          anchor: _anchor,
          anchorKey: _anchorKey,
          controller: _controller,
          onRefresh: _refresh,
        ),
      },
    );
  }
}

/// Season context, freshness and the offline/stale notice. Kept outside the
/// scroll view so the season a user is looking at is always visible and the list
/// index of an event is exactly its position in the season.
class _CalendarHeader extends ConsumerWidget {
  const _CalendarHeader({
    required this.season,
    required this.lastSuccessAt,
    required this.isStale,
    required this.refreshing,
    required this.refreshError,
  });

  final int season;
  final DateTime? lastSuccessAt;
  final bool isStale;
  final bool refreshing;
  final CalendarFailure? refreshError;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool showMock = ref.watch(usesMockDataProvider);
    final DateTime? updated = lastSuccessAt;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(l10n.seasonLabel('$season'), style: GvTypography.sectionTitle),
          if (refreshing || updated != null) ...<Widget>[
            const SizedBox(height: GvSpacing.xxs),
            Text(
              l10n.lastUpdatedLabel(
                refreshing
                    ? '…'
                    : DateFormat.Hm(
                        Localizations.localeOf(context).languageCode,
                      ).format(updated!.toLocal()),
              ),
              style: GvTypography.caption,
            ),
          ],
          if (showMock) ...<Widget>[
            const SizedBox(height: GvSpacing.sm),
            const MockDataBanner(),
          ],
          if (refreshError != null || isStale) ...<Widget>[
            const SizedBox(height: GvSpacing.sm),
            GvOfflineNotice(
              message: refreshError != null
                  ? l10n.refreshFailedNotice
                  : l10n.offlineStaleNotice,
            ),
          ],
        ],
      ),
    );
  }
}

class _CalendarList extends StatelessWidget {
  const _CalendarList({
    required this.state,
    required this.anchor,
    required this.anchorKey,
    required this.controller,
    required this.onRefresh,
  });

  final CalendarReady state;
  final CalendarScrollAnchor anchor;
  final GlobalKey anchorKey;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final List<CalendarEntry> events = state.events;
    final RelevantEvent? relevant = state.relevant;
    final int relevantIndex = relevant == null
        ? -1
        : events.indexWhere((CalendarEntry e) => e.id == relevant.event.id);

    // One-time positioning: never repeated for a later Drift emission, a
    // background refresh or a return from the detail screen.
    if (relevantIndex > 0) {
      anchor.start(index: relevantIndex, itemCount: events.length);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _CalendarHeader(
          season: state.season,
          lastSuccessAt: state.lastSuccessAt,
          isStale: state.isStale,
          refreshing: state.refreshing,
          refreshError: state.refreshError,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView.separated(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(
                GvLayout.screenPaddingHorizontal,
                0,
                GvLayout.screenPaddingHorizontal,
                GvSpacing.xxl,
              ),
              itemCount: events.length,
              separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.sm),
              itemBuilder: (BuildContext context, int index) {
                final CalendarEntry entry = events[index];
                final bool isRelevant = index == relevantIndex;
                final Widget card = CalendarEventCard(
                  key: ValueKey<String>('calendar-event-${entry.round}'),
                  entry: entry,
                  emphasis: !isRelevant
                      ? CalendarEventEmphasis.none
                      : (relevant!.inProgress
                            ? CalendarEventEmphasis.current
                            : CalendarEventEmphasis.next),
                  onTap: () => context.openEntity(
                    RoutePaths.grandPrix(
                      season: entry.season,
                      round: entry.round,
                    ),
                  ),
                );
                // The anchored row carries the global key the one-time initial
                // positioning scrolls to.
                return isRelevant
                    ? KeyedSubtree(key: anchorKey, child: card)
                    : card;
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// A materialized calendar that legitimately has no events. A real state — not
/// a loader and not an error — and still refreshable.
class _CalendarEmpty extends StatelessWidget {
  const _CalendarEmpty({required this.state, required this.onRefresh});

  final CalendarEmpty state;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _CalendarHeader(
          season: state.season,
          lastSuccessAt: state.lastSuccessAt,
          isStale: state.isStale,
          refreshing: state.refreshing,
          refreshError: state.refreshError,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: <Widget>[
                SizedBox(height: MediaQuery.sizeOf(context).height * 0.12),
                GvEmptyState(
                  title: l10n.calendarEmptyTitle,
                  message: l10n.calendarEmptyMessage,
                  icon: Icons.event_busy_outlined,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CalendarSkeleton extends StatelessWidget {
  const _CalendarSkeleton();

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
        GvSkeletonBlock(width: 140, height: 20),
        SizedBox(height: GvSpacing.lg),
        GvSkeletonBlock(height: 72),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 72),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 72),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 72),
      ],
    );
  }
}
