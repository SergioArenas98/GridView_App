import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/relevant_event.dart';
import '../../shared/presentation/domain_status.dart';
import '../application/calendar_providers.dart';
import '../application/calendar_state.dart';
import 'widgets/calendar_event_row.dart';
import 'widgets/calendar_header.dart';
import 'widgets/calendar_scroll_anchor.dart';
import 'widgets/calendar_status_block.dart';

/// The Calendar branch root, in Primer V2 (Step 55C.2, Calendar Stage 1): the
/// locally resolved current season's events, read from Drift in their persisted
/// (round) order, as a running order of race rows.
///
/// The title row and the season row are pinned above the list; the last-check
/// caption and the notices scroll with the rows (CT-03). The screen never
/// launches a refresh of its own — startup and foreground synchronization belong
/// to the application coordinator — so building it, or rebuilding it, can never
/// produce a request. Pull-to-refresh and the header action go through the
/// coordinator's manual current-season entry point.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  final ScrollController _controller = ScrollController();
  final GlobalKey _anchorKey = GlobalKey();
  final GlobalKey _noticeKey = GlobalKey();
  late final CalendarScrollAnchor _anchor = CalendarScrollAnchor(
    controller: _controller,
    anchorKey: _anchorKey,
    noticeKey: _noticeKey,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _refresh() =>
      ref.read(calendarControllerProvider.notifier).refresh();

  /// Whether the one-time initial positioning may be decided now.
  ///
  /// [CalendarReady] is published as soon as the season's rows exist, before
  /// its other asynchronous inputs necessarily answer: the `calendar:<season>`
  /// sync record (its freshness, so whether the stale notice shows), the
  /// bootstrap record (the fallback freshness) and the stored season row (where
  /// an undated event sits, so which row is relevant). Deciding on rows alone
  /// could jump to the next race and then have the stale notice appear above
  /// the viewport. So the decision waits, without any timer, until each of
  /// those exact providers has answered (a value or an error; they are the ones
  /// [calendarStateProvider] already watches, so nothing new is requested).
  /// While it waits the list rests at its start, and a user scroll meanwhile
  /// cancels the positioning. Once decided, nothing is watched any more.
  bool _positionInputsSettled(int season) {
    if (_anchor.decided) return true;
    bool answered<T>(AsyncValue<T> value) => value.hasValue || value.hasError;
    return ref.watch(
          resourceSyncStateProvider(
            ResourceKey.calendar(season),
          ).select(answered),
        ) &&
        ref.watch(
          resourceSyncStateProvider(ResourceKey.bootstrap()).select(answered),
        ) &&
        ref.watch(calendarSeasonProvider(season).select(answered));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final CalendarState state = ref.watch(calendarStateProvider);
    final GvPrimerRoles roles = context.gvPrimer;

    final int? season = switch (state) {
      CalendarReady(:final int season) => season,
      CalendarEmpty(:final int season) => season,
      _ => null,
    };

    final Widget body = switch (state) {
      CalendarLoading() => const _CalendarSkeleton(),
      CalendarFirstLoadError(:final CalendarFailure failure) => ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          GvPrimerEmptyState(
            glyph: GvPrimerGlyph.alert,
            title: switch (failure.cause) {
              CalendarFailureCause.seasonUnresolved =>
                l10n.calendarSeasonUnavailableTitle,
              CalendarFailureCause.resourceFailed => l10n.calendarErrorTitle,
            },
            message: failure.failure == null
                ? l10n.calendarSeasonUnavailableMessage
                : failureMessage(l10n, failure.failure!),
            size: GvPrimerEmptySize.list,
            action: GvPrimerButton(label: l10n.retry, onPressed: _refresh),
          ),
        ],
      ),
      CalendarEmpty() => _CalendarEmpty(state: state, onRefresh: _refresh),
      CalendarReady(:final int season) => _CalendarList(
        state: state,
        anchor: _anchor,
        anchorKey: _anchorKey,
        noticeKey: _noticeKey,
        controller: _controller,
        positionInputsSettled: _positionInputsSettled(season),
        onRefresh: _refresh,
      ),
    };

    return Scaffold(
      backgroundColor: roles.surface.page,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CalendarHeader(
              season: season == null ? null : l10n.seasonLabel('$season'),
              onRefresh: _refresh,
              onOpenSettings: () => context.openSettings(),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

/// Space above the scrolling content (`.cal { padding-top: 12px }`) and below
/// it (24px; the shell already reserves the navigation's height and inset).
const EdgeInsets _contentPadding = EdgeInsets.only(top: 12, bottom: 24);

class _CalendarList extends ConsumerWidget {
  const _CalendarList({
    required this.state,
    required this.anchor,
    required this.anchorKey,
    required this.noticeKey,
    required this.controller,
    required this.positionInputsSettled,
    required this.onRefresh,
  });

  final CalendarReady state;
  final CalendarScrollAnchor anchor;
  final GlobalKey anchorKey;
  final GlobalKey noticeKey;
  final ScrollController controller;

  /// Whether the inputs of the one-time initial positioning have all answered.
  final bool positionInputsSettled;
  final Future<void> Function() onRefresh;

  /// List items before the first round: the status block.
  static const int _leading = 1;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<CalendarEntry> events = state.events;
    final RelevantEvent? relevant = state.relevant;
    final int relevantIndex = relevant == null
        ? -1
        : events.indexWhere((CalendarEntry e) => e.id == relevant.event.id);

    final bool failed = state.refreshError != null;
    final bool stale = state.isStale;
    final int anchorItem = relevantIndex + _leading;
    final int itemCount = events.length + _leading;

    // XS-19: with a notice shown and a relevant row in the list, the status
    // block offers "Go to next / current Grand Prix". Its presence moves
    // nothing; only activation does, through the same anchor and target as
    // the opening without a notice.
    final CalendarJumpTarget? jumpTarget =
        (failed || stale) && relevantIndex >= 0
        ? (relevant!.inProgress
              ? CalendarJumpTarget.current
              : CalendarJumpTarget.next)
        : null;

    // The one-time initial positioning (owner-approved N-6, Step 55C.2.1),
    // decided on the first render whose inputs have all answered and never
    // again: not for a later Drift emission, a background refresh, a notice
    // that appears afterwards or a return from another tab or the detail
    // screen. A failure or stale notice comes first (the combined N-2 notice,
    // or the first in reading order); otherwise the current or next round.
    if (positionInputsSettled) {
      if (failed || stale) {
        anchor.revealNotice();
      } else if (relevantIndex > 0) {
        anchor.revealItem(index: anchorItem, itemCount: itemCount);
      } else {
        anchor.keep();
      }
    }

    return _CalendarRefresh(
      onRefresh: onRefresh,
      // Reports the user's own scrolling, which always wins over a pending
      // initial positioning.
      child: NotificationListener<ScrollNotification>(
        onNotification: anchor.handleScrollNotification,
        child: ListView.builder(
          controller: controller,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: _contentPadding,
          itemCount: events.length + _leading,
          itemBuilder: (BuildContext context, int item) {
            if (item < _leading) {
              return CalendarStatusBlock(
                lastSuccessAt: state.lastSuccessAt,
                refreshing: state.refreshing,
                failed: failed,
                stale: stale,
                showMock: ref.watch(usesMockDataProvider),
                firstNoticeKey: noticeKey,
                jumpTarget: jumpTarget,
                onJump: () =>
                    anchor.jumpToItem(index: anchorItem, itemCount: itemCount),
              );
            }
            final int index = item - _leading;
            final CalendarEntry entry = events[index];
            final bool isRelevant = index == relevantIndex;
            final Widget row = CalendarEventRow(
              key: ValueKey<String>('calendar-event-${entry.round}'),
              entry: entry,
              emphasis: !isRelevant
                  ? CalendarRowEmphasis.none
                  : (relevant!.inProgress
                        ? CalendarRowEmphasis.current
                        : CalendarRowEmphasis.next),
              // Hairlines run between ordinary rows only: none above the first
              // round, and none on or under the emphasised row.
              dividerAbove: index > 0 && index - 1 != relevantIndex,
              onOpen: () => context.openEntity(
                RoutePaths.grandPrix(season: entry.season, round: entry.round),
              ),
            );
            // The anchored row carries the global key the one-time initial
            // positioning scrolls to.
            return isRelevant ? KeyedSubtree(key: anchorKey, child: row) : row;
          },
        ),
      ),
    );
  }
}

/// A materialized calendar that legitimately has no events. A real state — not
/// a loader and not an error — and still refreshable.
class _CalendarEmpty extends ConsumerWidget {
  const _CalendarEmpty({required this.state, required this.onRefresh});

  final CalendarEmpty state;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _CalendarRefresh(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: _contentPadding,
        children: <Widget>[
          CalendarStatusBlock(
            lastSuccessAt: state.lastSuccessAt,
            refreshing: state.refreshing,
            failed: state.refreshError != null,
            stale: state.isStale,
            showMock: ref.watch(usesMockDataProvider),
          ),
          GvPrimerEmptyState(
            icon: Icons.event_busy_outlined,
            title: l10n.calendarEmptyTitle,
            message: l10n.calendarEmptyMessage,
            size: GvPrimerEmptySize.list,
          ),
        ],
      ),
    );
  }
}

/// Pull-to-refresh in Primer roles: the accent spinner on the band.
class _CalendarRefresh extends StatelessWidget {
  const _CalendarRefresh({required this.onRefresh, required this.child});

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = context.gvPrimer;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: roles.text.accent,
      backgroundColor: roles.surface.band,
      child: child,
    );
  }
}

/// The static first-load frame under the pinned header: placeholder rows in
/// the running order's shape (round column, name and circuit lines), theme
/// placeholders without animation (LT-16), announced once.
class _CalendarSkeleton extends StatelessWidget {
  const _CalendarSkeleton();

  @override
  Widget build(BuildContext context) {
    final double column = GvPrimerRaceRow.numberColumn(
      MediaQuery.textScalerOf(context),
    );
    Widget row(int i) => Padding(
      key: i == 0 ? const ValueKey<String>('calendar-skeleton') : null,
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        12,
        GvPrimerLayout.gutter,
        14,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          GvPrimerSkeleton(width: column, height: 38),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                GvPrimerSkeleton(height: 20),
                SizedBox(height: 8),
                GvPrimerSkeleton(width: 160, height: 16),
              ],
            ),
          ),
        ],
      ),
    );
    return ListView(
      padding: _contentPadding,
      children: <Widget>[
        GvPrimerLoading(
          semanticLabel: AppLocalizations.of(context).a11yLoading,
          child: Column(children: <Widget>[for (int i = 0; i < 4; i++) row(i)]),
        ),
      ],
    );
  }
}
