import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../application/explore_state.dart';
import 'widgets/explore_entity_row.dart';

/// Builds one row: the card, whether the collection has an image column, and
/// whether a hairline runs above it.
typedef ExploreRowBuilder<C> =
    Widget Function(
      BuildContext context,
      C card, {
      required bool mediaColumn,
      required bool dividerAbove,
    });

/// Space above the scrolling content (`.lib-page { padding-top: 4px }`) and
/// below it (24px; the shell already reserves the navigation's height and
/// inset).
const EdgeInsets exploreContentPadding = EdgeInsets.only(top: 4, bottom: 24);

/// Renders one Explore collection's sealed state, in Primer V2.
///
/// Generic over the collection's card type so the three categories share one
/// state-to-widget mapping without erasing their distinct read models. It knows
/// nothing about repositories, Riverpod, Drift or DTOs: it receives an already
/// derived state, the selected collection's [status] block and a row builder.
///
/// The status is the first item of the collection's own scrolling list, before
/// the rows in reading order (owner-approved DD EF-1). When it changes height
/// while the user is scrolled into the list (a refresh starts, succeeds or
/// fails), the offset is corrected by the same amount in that layout pass, so
/// the rows on screen do not move; at the very top the new status is simply
/// revealed. Cached cards always stay visible, and a valid empty collection
/// renders as an empty state, never as a loader.
class ExploreCollectionView<C> extends StatelessWidget {
  const ExploreCollectionView({
    super.key,
    required this.state,
    required this.controller,
    required this.storageKey,
    required this.status,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.errorTitle,
    required this.emptyIcon,
    required this.onRetry,
    required this.hasMedia,
    required this.itemBuilder,
    this.onOffsetCorrected,
  });

  final ExploreCollectionState<C> state;

  /// This category's own controller. Never shared with another category.
  final ScrollController controller;

  /// The list's [PageStorageKey] value, one per category and season, so a
  /// season transition never restores another season's position.
  final String storageKey;

  /// The selected collection's status block (caption, progress, notices).
  final Widget status;

  final String emptyTitle;
  final String emptyMessage;
  final String errorTitle;
  final IconData emptyIcon;
  final VoidCallback onRetry;

  /// Whether a card has a media reference: decides the collection's image
  /// column once, from the read model, before anything loads (DD EF-3).
  final bool Function(C card) hasMedia;
  final ExploreRowBuilder<C> itemBuilder;

  /// Called after the offset was corrected for a status height change, so the
  /// remembered per-category offset follows (a layout-time correction notifies
  /// no scroll listener).
  final VoidCallback? onOffsetCorrected;

  /// The status sliver: the list's 4px top padding, then the status block.
  Widget _status() => ExploreStatusSliver(
    onCorrected: onOffsetCorrected,
    child: Padding(
      padding: EdgeInsets.only(top: exploreContentPadding.top),
      child: status,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      // No card is known yet, so no media reference is either: the
      // deterministic policy gives no image column (DD EF-4).
      ExploreCollectionLoading<C>() => const ExploreSkeleton(),
      ExploreCollectionFirstLoadError<C>(:final ExploreFailure failure) =>
        _ExploreBlock(
          child: GvPrimerEmptyState(
            key: const ValueKey<String>('explore-error'),
            glyph: GvPrimerGlyph.alert,
            title: failure.cause == ExploreFailureCause.seasonUnresolved
                ? l10n.exploreSeasonUnavailableTitle
                : errorTitle,
            message: failure.cause == ExploreFailureCause.seasonUnresolved
                ? l10n.exploreSeasonUnavailableMessage
                : l10n.errorGeneric,
            size: GvPrimerEmptySize.list,
            action: GvPrimerButton(label: l10n.retry, onPressed: onRetry),
          ),
        ),
      ExploreCollectionEmpty<C>() => CustomScrollView(
        key: PageStorageKey<String>(storageKey),
        controller: controller,
        slivers: <Widget>[
          _status(),
          SliverPadding(
            padding: EdgeInsets.only(bottom: exploreContentPadding.bottom),
            sliver: SliverToBoxAdapter(
              child: GvPrimerEmptyState(
                key: const ValueKey<String>('explore-empty'),
                icon: emptyIcon,
                title: emptyTitle,
                message: emptyMessage,
                size: GvPrimerEmptySize.list,
                action: GvPrimerButton(label: l10n.retry, onPressed: onRetry),
              ),
            ),
          ),
        ],
      ),
      ExploreCollectionReady<C>(:final List<C> cards) => _list(cards),
    };
  }

  Widget _list(List<C> cards) {
    final bool mediaColumn = cards.any(hasMedia);
    return CustomScrollView(
      // Keeps this category's own position when another one is shown.
      key: PageStorageKey<String>(storageKey),
      controller: controller,
      slivers: <Widget>[
        _status(),
        SliverPadding(
          padding: EdgeInsets.only(bottom: exploreContentPadding.bottom),
          sliver: SliverList.builder(
            itemCount: cards.length,
            itemBuilder: (BuildContext context, int index) => itemBuilder(
              context,
              cards[index],
              mediaColumn: mediaColumn,
              dividerAbove: index > 0,
            ),
          ),
        ),
      ],
    );
  }
}

/// The status block as its own sliver, ahead of the rows, holding the rows
/// still when the block changes height.
///
/// While the viewport's top is inside or past the block (its scroll offset is
/// above 0), a change of the block's extent is returned as a
/// [SliverGeometry.scrollOffsetCorrection], so the viewport corrects the
/// offset and lays out again in the same frame with the rows exactly where
/// they were: a refresh that starts, succeeds or fails never moves what the
/// user is reading, however far down the list they are. At the very top
/// (offset 0) the block grows into view, so the user sees the new notice.
/// A first layout (a new list, a category switch) never corrects.
class ExploreStatusSliver extends SingleChildRenderObjectWidget {
  const ExploreStatusSliver({
    super.key,
    required super.child,
    this.onCorrected,
  });

  /// Called after the frame in which the offset was corrected (the viewport's
  /// correction notifies no scroll listener).
  final VoidCallback? onCorrected;

  @override
  RenderExploreStatusSliver createRenderObject(BuildContext context) =>
      RenderExploreStatusSliver(onCorrected: onCorrected);

  @override
  void updateRenderObject(
    BuildContext context,
    RenderExploreStatusSliver renderObject,
  ) {
    renderObject.onCorrected = onCorrected;
  }
}

/// The render object behind [ExploreStatusSliver].
class RenderExploreStatusSliver extends RenderSliverToBoxAdapter {
  RenderExploreStatusSliver({this.onCorrected});

  VoidCallback? onCorrected;
  double? _extent;

  @override
  void performLayout() {
    super.performLayout();
    final double extent = geometry!.scrollExtent;
    final double? previous = _extent;
    _extent = extent;
    if (previous == null || previous == extent) return;
    if (constraints.scrollOffset <= 0) return;
    geometry = SliverGeometry(scrollOffsetCorrection: extent - previous);
    SchedulerBinding.instance.addPostFrameCallback((_) => onCorrected?.call());
  }
}

/// An empty or error block that scrolls when it is taller than the space.
class _ExploreBlock extends StatelessWidget {
  const _ExploreBlock({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.only(bottom: 24),
    children: <Widget>[child],
  );
}

/// The structured loading placeholder, shown only while the selected
/// collection has no materialized local representation, laid out as the rows
/// it stands for (DD EF-4): six static 76px rows whose two lines start at the
/// row's text column, in the theme's placeholder colours (LT-16), announced
/// once.
///
/// With [mediaColumn] each row also reserves the 40px slot at the gutter, as
/// the rows of a collection with a media column do. While loading, no card
/// (and so no media reference) is known yet, so the collection view passes the
/// deterministic answer, no column; with the approved media inventory empty
/// that is also what the loaded rows show, so nothing appears or disappears.
class ExploreSkeleton extends StatelessWidget {
  const ExploreSkeleton({super.key, this.mediaColumn = false});

  final bool mediaColumn;

  @override
  Widget build(BuildContext context) {
    final double start = mediaColumn
        ? GvPrimerLayout.gutter
        : GvPrimerLayout.gutter + ExploreEntityRow.lane;
    return ListView(
      padding: exploreContentPadding,
      children: <Widget>[
        GvPrimerLoading(
          semanticLabel: AppLocalizations.of(context).a11yLoading,
          child: Padding(
            key: const ValueKey<String>('explore-skeleton'),
            // The row's own insets: text column on the left, the chevron's
            // gutter on the right.
            padding: EdgeInsets.fromLTRB(start, 0, GvPrimerLayout.gutter, 0),
            child: Column(
              children: <Widget>[
                for (int i = 0; i < 6; i++)
                  SizedBox(
                    key: ValueKey<String>('explore-skeleton-row-$i'),
                    height: 76,
                    child: Row(
                      children: <Widget>[
                        if (mediaColumn) ...<Widget>[
                          const GvPrimerSkeleton(
                            key: ValueKey<String>('explore-skeleton-slot'),
                            width: ExploreEntityRow.mediaSlot,
                            height: ExploreEntityRow.mediaSlot,
                          ),
                          const SizedBox(width: ExploreEntityRow.mediaGap),
                        ],
                        const Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              GvPrimerSkeleton(height: 12, radius: 6),
                              SizedBox(height: 8),
                              FractionallySizedBox(
                                widthFactor: 0.6,
                                alignment: AlignmentDirectional.centerStart,
                                child: GvPrimerSkeleton(height: 12, radius: 6),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
