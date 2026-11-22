import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/presentation/widgets/mock_data_banner.dart';

/// One Standings notice: its cause (the VS-4 icon) and its words.
@immutable
class StandingsNoticeSpec {
  const StandingsNoticeSpec(this.cause, this.message);

  final GvPrimerNoticeCause cause;
  final String message;

  @override
  bool operator ==(Object other) =>
      other is StandingsNoticeSpec &&
      other.cause == cause &&
      other.message == message;

  @override
  int get hashCode => Object.hash(cause, message);

  @override
  String toString() => 'StandingsNoticeSpec($cause, $message)';
}

/// The selected table's notices (N-1, N-2, VS-4), from that table's own state.
///
/// Both facts belong to one resource, the selected championship's
/// `standings:<championship>:<season>`: the refresh failure is that resource's
/// own (`StandingsTableState.refreshError`; neither the other championship nor
/// an unrelated core resource ever reaches it) and the freshness is that
/// resource's own, or, until it has a record, the freshness of the bootstrap
/// representation that materialized these same rows. So a failure over stale
/// data concerns the same content and reads as the one combined N-2 notice;
/// either alone keeps its existing string. Standings has no
/// incomplete-information state, so no help notice exists here.
List<StandingsNoticeSpec> standingsNotices({
  required bool failed,
  required bool stale,
  required AppLocalizations l10n,
}) {
  if (failed && stale) {
    return <StandingsNoticeSpec>[
      StandingsNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      ),
    ];
  }
  return <StandingsNoticeSpec>[
    if (failed)
      StandingsNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedNotice,
      ),
    if (stale)
      StandingsNoticeSpec(GvPrimerNoticeCause.stale, l10n.offlineStaleNotice),
  ];
}

/// The selected table's status (ST15–ST18) at the start of its scrolling
/// content: the freshness line, the whole-table provisional caption, the
/// sample-data banner where it applies, then the notices.
///
/// Everything here is scoped to one resource (PD-03 / STD-01):
/// - "Refreshing…" while that table refreshes;
/// - otherwise "Last successful check: HH:mm" only from that table's **own**
///   `lastSuccessAt`: never Home's, never the other championship's, and never
///   a bootstrap time (a bootstrap-materialized table claims no check time);
/// - nothing when neither applies.
class StandingsStatusBlock extends StatelessWidget {
  const StandingsStatusBlock({
    super.key,
    required this.lastSuccessAt,
    required this.refreshing,
    required this.failed,
    required this.stale,
    required this.showMock,
    this.provisional = false,
  });

  final DateTime? lastSuccessAt;
  final bool refreshing;
  final bool failed;
  final bool stale;
  final bool showMock;

  /// Every row that states it is provisional: one caption for the table.
  final bool provisional;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final DateTime? updated = lastSuccessAt;
    final String? freshness = refreshing
        ? l10n.standingsRefreshingLabel
        : updated == null
        ? null
        : l10n.lastUpdatedLabel(
            DateFormat.Hm(
              Localizations.localeOf(context).languageCode,
            ).format(updated.toLocal()),
          );
    final List<String> lines = <String>[
      ?freshness,
      if (provisional) l10n.standingsProvisionalNotice,
    ];
    final List<StandingsNoticeSpec> notices = standingsNotices(
      failed: failed,
      stale: stale,
      l10n: l10n,
    );
    if (lines.isEmpty && notices.isEmpty && !showMock) {
      return const SizedBox.shrink();
    }
    final TextStyle lineStyle = GvPrimerTypography.archivo(
      size: 13,
      weight: 400,
      height: 1.35,
    ).copyWith(color: roles.text.secondary);

    final List<Widget> children = <Widget>[
      if (freshness != null)
        Semantics(
          container: true,
          child: Text(
            freshness,
            key: const ValueKey<String>('standings-freshness'),
            style: lineStyle,
          ),
        ),
      if (provisional)
        Semantics(
          container: true,
          child: Text(
            l10n.standingsProvisionalNotice,
            key: const ValueKey<String>('standings-provisional'),
            style: lineStyle,
          ),
        ),
      if (showMock) const MockDataBanner(),
      for (final StandingsNoticeSpec notice in notices)
        GvPrimerNotice(
          key: ValueKey<String>('standings-notice-${notice.cause.name}'),
          cause: notice.cause,
          message: notice.message,
        ),
    ];
    return Padding(
      key: const ValueKey<String>('standings-status'),
      // `.status`: 4px between caption lines, a notice 6px further down; 12px
      // before the first row.
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        2,
        GvPrimerLayout.gutter,
        12,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (final (int i, Widget child) in children.indexed) ...<Widget>[
            if (i > 0) SizedBox(height: child is Semantics ? 4 : 10),
            child,
          ],
        ],
      ),
    );
  }
}
