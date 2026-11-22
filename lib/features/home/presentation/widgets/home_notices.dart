import 'package:flutter/material.dart';

import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/home_dashboard.dart';
import '../../application/home_state.dart';

/// One Home notice: its cause (which picks the VS-4 icon) and its words.
@immutable
class HomeNoticeSpec {
  const HomeNoticeSpec(this.cause, this.message);

  final GvPrimerNoticeCause cause;
  final String message;

  @override
  bool operator ==(Object other) =>
      other is HomeNoticeSpec &&
      other.cause == cause &&
      other.message == message;

  @override
  int get hashCode => Object.hash(cause, message);

  @override
  String toString() => 'HomeNoticeSpec($cause, $message)';
}

/// The notices a ready Home shows, in order (N-1, N-2, N-3, N-7, VS-4).
///
/// Presentation only, derived from the existing state; nothing here changes
/// how failure, freshness or availability are computed.
///
/// - **Outcome, then freshness** (N-1): a refresh failure never hides stale
///   data; at most one notice of each.
/// - **Combined (N-2)** only when the failure and the staleness concern the
///   same content: the Home resource failed and every stale section is Home's
///   own (its snapshot, or the featured event it supplied). Staleness of any
///   other resource is an aggregate, so the two notices stay separate.
/// - **Completeness (N-3, rule 4):** each unavailable module states it in
///   place; the aggregate "Some information is unavailable" (help icon, O-2)
///   appears only when no other notice does.
/// - Per-standings-table failures add no notice (N-7); a stale table is
///   still covered by the aggregate stale notice.
List<HomeNoticeSpec> homeReadyNotices(HomeReady state, AppLocalizations l10n) {
  final bool failed = state.refreshError != null;
  final bool eventIsHome =
      state.event.focus.source == HomeFocusSource.homeSnapshot;
  final bool homeStale =
      state.homeProvenance.isStale ||
      (eventIsHome && state.event.provenance.isStale);
  final bool otherStale = <HomeSectionFreshness?>[
    if (!eventIsHome) state.event.provenance,
    state.driverLeader.provenance,
    state.teamLeader.provenance,
    state.latestResult?.provenance,
    state.latestResult?.resultProvenance,
    state.upcoming.provenance,
  ].any((HomeSectionFreshness? s) => s?.isStale ?? false);
  final bool stale = state.hasStaleSection;

  if (failed && stale && homeStale && !otherStale) {
    return <HomeNoticeSpec>[
      HomeNoticeSpec(GvPrimerNoticeCause.failure, l10n.homeUpdateFailedStale),
    ];
  }
  final List<HomeNoticeSpec> notices = <HomeNoticeSpec>[
    if (failed)
      HomeNoticeSpec(GvPrimerNoticeCause.failure, l10n.homeUpdateFailed),
    if (stale)
      HomeNoticeSpec(
        GvPrimerNoticeCause.stale,
        l10n.homeSomeInformationOutdated,
      ),
  ];
  if (notices.isEmpty && state.isPartial) {
    notices.add(
      HomeNoticeSpec(
        GvPrimerNoticeCause.incomplete,
        l10n.homeSomeInformationUnavailable,
      ),
    );
  }
  return notices;
}

/// The notices of a valid season with no events. Both facts concern the one
/// Home resource, so a failure over stale data is the combined notice (N-2).
List<HomeNoticeSpec> homeSeasonEmptyNotices(
  HomeSeasonEmpty state,
  AppLocalizations l10n,
) {
  final bool failed = state.refreshError != null;
  final bool stale = state.provenance.isStale;
  if (failed && stale) {
    return <HomeNoticeSpec>[
      HomeNoticeSpec(GvPrimerNoticeCause.failure, l10n.homeUpdateFailedStale),
    ];
  }
  return <HomeNoticeSpec>[
    if (failed)
      HomeNoticeSpec(GvPrimerNoticeCause.failure, l10n.homeUpdateFailed),
    if (stale) HomeNoticeSpec(GvPrimerNoticeCause.stale, l10n.homeCachedNotice),
  ];
}

/// Stacked Primer notices, 12px apart, each its own polite live region.
class HomeNotices extends StatelessWidget {
  const HomeNotices({super.key, required this.notices});

  final List<HomeNoticeSpec> notices;

  @override
  Widget build(BuildContext context) => Column(
    key: const ValueKey<String>('home-notice'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      for (int i = 0; i < notices.length; i++) ...<Widget>[
        if (i > 0) const SizedBox(height: 12),
        GvPrimerNotice(
          key: ValueKey<String>('home-notice-${notices[i].cause.name}'),
          cause: notices[i].cause,
          message: notices[i].message,
        ),
      ],
    ],
  );
}
