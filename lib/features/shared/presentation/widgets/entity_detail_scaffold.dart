import 'package:flutter/material.dart';

import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/entity_detail_state.dart';
import 'screen_scaffold.dart';

/// Renders an entity detail screen's sealed state, leaving the feature to supply
/// only the body for a real local profile.
///
/// Generic over the feature's profile read model, so Driver, Team and Circuit
/// share one state-to-widget mapping without erasing their own partial states —
/// the optional sections live inside each profile and each screen decides how to
/// present them.
///
/// Cached content always stays visible: a refresh, a refresh failure or a
/// focused detail-unavailable response adds a discreet non-blocking notice above
/// the content instead of replacing it with a loader or an error page. One
/// missing section never becomes a full-page error.
class EntityDetailScaffold<P> extends StatelessWidget {
  const EntityDetailScaffold({
    super.key,
    required this.title,
    required this.state,
    required this.onRetry,
    required this.builder,
  });

  final String title;
  final EntityDetailState<P> state;
  final VoidCallback onRetry;

  /// Builds the scrollable content for a real local profile. It receives the
  /// whole ready state so it can present partial versus materialized sections
  /// accurately.
  final List<Widget> Function(BuildContext context, EntityDetailReady<P> ready)
  builder;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenScaffold(
      title: title,
      body: switch (state) {
        EntityDetailLoading<P>() => const _DetailSkeleton(),
        EntityDetailSeasonUnavailable<P>() => GvErrorState(
          title: l10n.detailSeasonUnavailableTitle,
          message: l10n.detailSeasonUnavailableMessage,
          retryLabel: l10n.retry,
          onRetry: onRetry,
        ),
        EntityDetailNotFound<P>() => GvEmptyState(
          title: l10n.detailNotFoundTitle,
          message: l10n.detailNotFoundMessage,
          icon: Icons.help_outline,
        ),
        EntityDetailFirstLoadError<P>() => GvErrorState(
          title: l10n.detailLoadErrorTitle,
          message: l10n.errorGeneric,
          retryLabel: l10n.retry,
          onRetry: onRetry,
        ),
        // One primary scrollable for the whole page.
        final EntityDetailReady<P> ready => ListView(
          padding: const EdgeInsets.fromLTRB(
            GvLayout.screenPaddingHorizontal,
            GvSpacing.md,
            GvLayout.screenPaddingHorizontal,
            GvSpacing.xxl,
          ),
          children: <Widget>[
            ..._notices(l10n, ready),
            ...builder(context, ready),
          ],
        ),
      },
    );
  }

  /// The non-blocking notices shown above real content.
  ///
  /// Wording stays safe: a failed request never claims the device is offline,
  /// and a collection-derived profile never claims a detail update time.
  List<Widget> _notices(AppLocalizations l10n, EntityDetailReady<P> ready) {
    final List<Widget> notices = <Widget>[];
    if (ready.refreshError != null) {
      notices.add(GvOfflineNotice(message: l10n.detailUpdateFailed));
    } else if (ready.detailUnavailable || !ready.materialized) {
      // Either the detail endpoint says this entity has no detail document, or
      // it has simply never synchronised: in both cases what is on screen is a
      // real but partial summary, and no detail freshness is claimed.
      notices.add(GvOfflineNotice(message: l10n.detailPartialNotice));
    } else if (ready.isStale) {
      notices.add(GvOfflineNotice(message: l10n.detailCachedNotice));
    }
    if (notices.isEmpty) return const <Widget>[];
    return <Widget>[...notices, const SizedBox(height: GvSpacing.md)];
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
      children: <Widget>[
        for (int i = 0; i < 4; i++) ...<Widget>[
          const GvSkeletonCard(),
          const SizedBox(height: GvSpacing.sm),
        ],
      ],
    );
  }
}
