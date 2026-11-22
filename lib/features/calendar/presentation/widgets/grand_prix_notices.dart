import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../application/grand_prix_detail_state.dart';
import '../../application/grand_prix_results_state.dart';

/// The notices of Grand Prix Detail, which presents **two independent
/// resources**: the event detail (`grand-prix:<season>:<round>`) and its
/// results. Approved policy (DD N-1, N-2; `STATUS-NOTICE-DECISIONS.md`
/// "Same content" for Grand Prix; Step 55C.12):
///
/// - failure, then stale, at most one of each per scope (N-1); Grand Prix has
///   no incomplete state;
/// - failure and staleness read as one combined notice
///   (`refreshFailedStaleNotice`, N-2) **only when both are about the same
///   resource**;
/// - the screen notices (top of the scroll content) belong to the event; in
///   a remote build they also carry the results' staleness, so an event
///   failure with results-only staleness shows two notices
///   (`refreshFailedNotice`, then `offlineStaleNotice`) — never the combined
///   wording, which would claim the event is stale;
/// - the results section keeps its own failure; in a fixture build it also
///   states its own staleness (combined with its own failure, N-2).
///
/// Existing strings only. A retry-in-progress keeps no notice (N-4 is not
/// implemented here): the states clear `refreshError` while refreshing.
List<DetailNoticeSpec> grandPrixEventNotices({
  required GrandPrixReady detail,
  required GrandPrixResultsState results,
  required bool remoteFreshness,
  required AppLocalizations l10n,
}) {
  final bool eventFailed = detail.refreshError != null;
  final bool eventStale = detail.isStale;
  final bool resultsStale =
      remoteFreshness && results is GrandPrixResultsReady && results.isStale;
  if (eventFailed && eventStale) {
    return <DetailNoticeSpec>[
      DetailNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      ),
    ];
  }
  return <DetailNoticeSpec>[
    if (eventFailed)
      DetailNoticeSpec(GvPrimerNoticeCause.failure, l10n.refreshFailedNotice),
    if (eventStale || resultsStale)
      DetailNoticeSpec(GvPrimerNoticeCause.stale, l10n.offlineStaleNotice),
  ];
}

/// The results resource's own notices, shown inside the result area under
/// the first classification's title and status chip (states frame 18).
///
/// Its failure always shows here. Its staleness shows here only in a
/// fixture build; a remote build states it once at the top
/// ([grandPrixEventNotices]). When both describe the results here, they are
/// one combined notice (N-2).
List<DetailNoticeSpec> grandPrixResultsNotices({
  required GrandPrixResultsReady results,
  required bool remoteFreshness,
  required AppLocalizations l10n,
}) {
  final bool failed = results.refreshError != null;
  final bool staleHere = results.isStale && !remoteFreshness;
  if (failed && staleHere) {
    return <DetailNoticeSpec>[
      DetailNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      ),
    ];
  }
  return <DetailNoticeSpec>[
    if (failed)
      DetailNoticeSpec(GvPrimerNoticeCause.failure, l10n.refreshFailedNotice),
    if (staleHere)
      DetailNoticeSpec(GvPrimerNoticeCause.stale, l10n.offlineStaleNotice),
  ];
}
