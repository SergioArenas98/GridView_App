import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/entity_detail_state.dart';

/// One notice of a Primer V2 detail status block: the cause picks the icon
/// (VS-4), the message is existing copy. Shared by Driver, Team and Circuit
/// Detail (extracted from Driver Detail in Step 55C.10).
@immutable
class DetailNoticeSpec {
  const DetailNoticeSpec(this.cause, this.message);

  final GvPrimerNoticeCause cause;
  final String message;

  @override
  bool operator ==(Object other) =>
      other is DetailNoticeSpec &&
      other.cause == cause &&
      other.message == message;

  @override
  int get hashCode => Object.hash(cause, message);

  @override
  String toString() => 'DetailNoticeSpec($cause, $message)';
}

/// The notices of a ready entity detail, all about **one** resource: the
/// exact `<entity>:<id>:<season>` detail the state was derived from.
///
/// N-1 (approved): failure, stale and incomplete stay independently
/// representable, in that order, at most one of each, and a failure never
/// conceals an incomplete profile. N-2 (approved wording): a failure and
/// stale data of the same detail resource read as one combined notice
/// (`refreshFailedStaleNotice`). A partial profile can never also be stale
/// (`EntityDetailReady.freshness` is `null` unless materialized), so at most
/// two notices show. Wording otherwise unchanged: `detailUpdateFailed`,
/// `detailCachedNotice`, `detailPartialNotice`.
List<DetailNoticeSpec> detailNotices(
  EntityDetailReady<Object?> ready,
  AppLocalizations l10n,
) {
  final bool failed = ready.refreshError != null;
  final bool incomplete = ready.detailUnavailable || !ready.materialized;
  return <DetailNoticeSpec>[
    if (failed && ready.isStale)
      DetailNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      )
    else if (failed)
      DetailNoticeSpec(GvPrimerNoticeCause.failure, l10n.detailUpdateFailed)
    else if (ready.isStale)
      DetailNoticeSpec(GvPrimerNoticeCause.stale, l10n.detailCachedNotice),
    if (incomplete)
      DetailNoticeSpec(
        GvPrimerNoticeCause.incomplete,
        l10n.detailPartialNotice,
      ),
  ];
}

/// The status block at the top of a detail's scrolling content
/// (`.page-notice`): 12px above and below, on the gutter, 12px between
/// stacked notices (notice-coexistence `.page-notice > .notice + .notice`).
/// Absent when there is nothing to report. It scrolls with the profile, as
/// in the approved Driver, Team and Circuit prototypes; no screen-specific
/// positioning rule (Calendar N-6, Explore EF-1) is applied.
class PrimerDetailNotices extends StatelessWidget {
  const PrimerDetailNotices({super.key, required this.notices, this.blockKey});

  final List<DetailNoticeSpec> notices;

  /// The key of the block when it is shown (`driver-detail-notices`,
  /// `team-detail-notices`).
  final Key? blockKey;

  @override
  Widget build(BuildContext context) {
    if (notices.isEmpty) return const SizedBox.shrink();
    return Padding(
      key: blockKey,
      padding: const EdgeInsets.symmetric(
        horizontal: GvPrimerLayout.gutter,
        vertical: 12,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int i = 0; i < notices.length; i++) ...<Widget>[
            if (i > 0) const SizedBox(height: 12),
            GvPrimerNotice(
              cause: notices[i].cause,
              message: notices[i].message,
            ),
          ],
        ],
      ),
    );
  }
}
