import 'package:flutter/material.dart';

import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../application/explore_state.dart';

/// Renders one Explore collection's sealed state as a lazy, single-column list.
///
/// Generic over the collection's card type so the three categories share one
/// state-to-widget mapping without erasing their distinct read models. It knows
/// nothing about repositories, Riverpod, Drift or DTOs — it receives an already
/// derived state and a row builder.
///
/// Cached cards always stay visible: a refresh or a failure adds a discreet,
/// non-blocking notice above the list rather than replacing it. A valid empty
/// collection renders as an empty state, never as a loader.
class ExploreCollectionView<C> extends StatelessWidget {
  const ExploreCollectionView({
    super.key,
    required this.state,
    required this.controller,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.errorTitle,
    required this.emptyIcon,
    required this.onRetry,
    required this.itemBuilder,
  });

  final ExploreCollectionState<C> state;

  /// This category's own controller. Never shared with another category.
  final ScrollController controller;

  final String emptyTitle;
  final String emptyMessage;
  final String errorTitle;
  final IconData emptyIcon;
  final VoidCallback onRetry;
  final Widget Function(BuildContext context, C card) itemBuilder;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      ExploreCollectionLoading<C>() => const _ExploreSkeleton(),
      ExploreCollectionFirstLoadError<C>(:final ExploreFailure failure) =>
        _ExploreError(
          title: failure.cause == ExploreFailureCause.seasonUnresolved
              ? l10n.exploreSeasonUnavailableTitle
              : errorTitle,
          message: failure.cause == ExploreFailureCause.seasonUnresolved
              ? l10n.exploreSeasonUnavailableMessage
              : l10n.errorGeneric,
          onRetry: onRetry,
        ),
      ExploreCollectionEmpty<C>(
        :final bool refreshing,
        :final ExploreFailure? refreshError,
      ) =>
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _Notices(refreshing: refreshing, refreshError: refreshError),
            Expanded(
              child: GvEmptyState(
                title: emptyTitle,
                message: emptyMessage,
                icon: emptyIcon,
                actionLabel: l10n.retry,
                onAction: onRetry,
              ),
            ),
          ],
        ),
      ExploreCollectionReady<C>(
        :final List<C> cards,
        :final bool refreshing,
        :final ExploreFailure? refreshError,
      ) =>
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _Notices(refreshing: refreshing, refreshError: refreshError),
            Expanded(
              child: ListView.separated(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(
                  GvLayout.screenPaddingHorizontal,
                  0,
                  GvLayout.screenPaddingHorizontal,
                  GvSpacing.xxl,
                ),
                itemCount: cards.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: GvSpacing.xxs),
                itemBuilder: (BuildContext context, int index) =>
                    itemBuilder(context, cards[index]),
              ),
            ),
          ],
        ),
    };
  }
}

/// The non-blocking notices rendered above cached content: a refresh failure and
/// a discreet in-progress indicator.
///
/// Deliberately never claims the device is offline — one failed request does not
/// prove that — and never conveys state by colour alone.
class _Notices extends StatelessWidget {
  const _Notices({required this.refreshing, required this.refreshError});

  final bool refreshing;
  final ExploreFailure? refreshError;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (refreshError == null && !refreshing) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        0,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
      ),
      child: refreshError != null
          ? GvOfflineNotice(message: l10n.exploreUpdateFailed)
          : const LinearProgressIndicator(minHeight: 2),
    );
  }
}

class _ExploreSkeleton extends StatelessWidget {
  const _ExploreSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        0,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: <Widget>[
        for (int i = 0; i < 6; i++) ...<Widget>[
          const GvSkeletonCard(),
          const SizedBox(height: GvSpacing.xxs),
        ],
      ],
    );
  }
}

class _ExploreError extends StatelessWidget {
  const _ExploreError({
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvErrorState(
      title: title,
      message: message,
      retryLabel: l10n.retry,
      onRetry: onRetry,
    );
  }
}
