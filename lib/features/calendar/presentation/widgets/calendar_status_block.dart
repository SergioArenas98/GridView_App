import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/presentation/widgets/mock_data_banner.dart';
import '../../application/calendar_state.dart';

/// Which Grand Prix the XS-19 jump action targets, from the authoritative
/// relevant-event selection: the event in progress, or the next one.
enum CalendarJumpTarget { current, next }

/// One Calendar notice: its cause (the VS-4 icon) and its words.
@immutable
class CalendarNoticeSpec {
  const CalendarNoticeSpec(this.cause, this.message);

  final GvPrimerNoticeCause cause;
  final String message;

  @override
  bool operator ==(Object other) =>
      other is CalendarNoticeSpec &&
      other.cause == cause &&
      other.message == message;

  @override
  int get hashCode => Object.hash(cause, message);

  @override
  String toString() => 'CalendarNoticeSpec($cause, $message)';
}

/// The Calendar's notices (N-1, N-2, VS-4), from the Calendar's own state.
///
/// Both facts belong to one resource, `calendar:<season>`: the refresh failure
/// is that resource's ([CalendarFailureCause.resourceFailed]; an unrelated core
/// failure never reaches Calendar state) and the freshness is that resource's.
/// So a failure over stale data is the same content and reads as the one
/// combined N-2 notice; either alone keeps its existing string. The Calendar
/// has no incomplete-information state, so no help notice exists here.
List<CalendarNoticeSpec> calendarNotices({
  required bool failed,
  required bool stale,
  required AppLocalizations l10n,
}) {
  if (failed && stale) {
    return <CalendarNoticeSpec>[
      CalendarNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      ),
    ];
  }
  return <CalendarNoticeSpec>[
    if (failed)
      CalendarNoticeSpec(GvPrimerNoticeCause.failure, l10n.refreshFailedNotice),
    if (stale)
      CalendarNoticeSpec(GvPrimerNoticeCause.stale, l10n.offlineStaleNotice),
  ];
}

/// The status information at the start of the scrolling content (Stage 1):
/// the last-check caption (only while refreshing, or when the Calendar
/// resource has its own successful check), the sample-data banner where it
/// applies, then the notices. It scrolls with the rows, in the reading order
/// after the pinned season row and before the first round.
class CalendarStatusBlock extends StatelessWidget {
  const CalendarStatusBlock({
    super.key,
    required this.lastSuccessAt,
    required this.refreshing,
    required this.failed,
    required this.stale,
    required this.showMock,
    this.firstNoticeKey,
    this.jumpTarget,
    this.onJump,
  });

  final DateTime? lastSuccessAt;
  final bool refreshing;
  final bool failed;
  final bool stale;
  final bool showMock;

  /// Attached to the first notice in reading order, so the screen's one-time
  /// initial positioning can bring it into view (N-6).
  final GlobalKey? firstNoticeKey;

  /// The XS-19 action after the notices ("Go to next / current Grand Prix"),
  /// shown only with a notice, a target and a handler.
  final CalendarJumpTarget? jumpTarget;
  final VoidCallback? onJump;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final DateTime? updated = lastSuccessAt;
    final List<CalendarNoticeSpec> notices = calendarNotices(
      failed: failed,
      stale: stale,
      l10n: l10n,
    );
    final bool caption = refreshing || updated != null;
    if (!caption && notices.isEmpty && !showMock) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (caption)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Semantics(
                container: true,
                child: Text(
                  l10n.lastUpdatedLabel(
                    refreshing
                        ? '…'
                        : DateFormat.Hm(
                            Localizations.localeOf(context).languageCode,
                          ).format(updated!.toLocal()),
                  ),
                  key: const ValueKey<String>('calendar-freshness'),
                  style: GvPrimerTypography.archivo(
                    size: 13,
                    weight: 400,
                    height: 1.35,
                  ).copyWith(color: roles.text.secondary),
                ),
              ),
            ),
          if (showMock)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: MockDataBanner(),
            ),
          for (final (int i, CalendarNoticeSpec notice) in notices.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: KeyedSubtree(
                key: i == 0 ? firstNoticeKey : null,
                child: GvPrimerNotice(
                  key: ValueKey<String>('calendar-notice-${notice.cause.name}'),
                  cause: notice.cause,
                  message: notice.message,
                ),
              ),
            ),
          if (notices.isNotEmpty && jumpTarget != null && onJump != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: CalendarJumpAction(
                  key: const ValueKey<String>('calendar-jump'),
                  label: switch (jumpTarget!) {
                    CalendarJumpTarget.current =>
                      l10n.calendarGoToCurrentAction,
                    CalendarJumpTarget.next => l10n.calendarGoToNextAction,
                  },
                  onActivate: onJump!,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The XS-19 action right after a Calendar notice: a text action in the
/// primary text colour, weight 700, with the trailing arrow, as the existing
/// Primer text links. One button node named by its visible words; at least
/// 48dp; Enter and Space activate it; the standard outer focus ring; hover and
/// pressed from the existing roles. It repositions the list only.
class CalendarJumpAction extends StatelessWidget {
  const CalendarJumpAction({
    super.key,
    required this.label,
    required this.onActivate,
  });

  final String label;
  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    const BorderRadius corners = BorderRadius.all(Radius.circular(4));
    return GvPrimerFocusTarget(
      onActivate: onActivate,
      semanticLabel: label,
      hoverColor: roles.state.hover,
      pressedColor: roles.state.pressedControl,
      fillRadius: corners,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: GvPrimerLayout.minTarget,
            minWidth: GvPrimerLayout.minTarget,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Flexible(
                child: Text(
                  label,
                  style: GvPrimerTypography.archivo(
                    size: GvPrimerLayout.bodyFontSize,
                    weight: 700,
                    height: 1.3,
                  ).copyWith(color: roles.text.primary),
                ),
              ),
              const SizedBox(width: 8),
              GvPrimerIcon(
                GvPrimerGlyph.arrowRight,
                size: 24,
                color: roles.text.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
