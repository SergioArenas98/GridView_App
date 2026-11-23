import 'package:flutter/material.dart';

import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/calendar_entry.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../../shared/presentation/primer_status_kinds.dart';

/// How a Calendar row is emphasised. Decided by the screen from the existing
/// relevant-event rule; the row never derives it.
enum CalendarRowEmphasis {
  none,

  /// The next event (C10): band, flat oxide round block, the "Next" kicker and
  /// the arrow disc.
  next,

  /// The event in progress (C11): the same band and block, no kicker; its
  /// status chip carries the state.
  current,
}

/// One Calendar round as a Primer V2 race row ([GvPrimerRaceRow]).
///
/// Built only from values that exist: the round, the name, the circuit when
/// resolved, a details line of locality, country and the weekend's
/// calendar-only date range (missing parts dropped with their separator), and
/// the event's own status word with its chip kind, plus the sprint format when
/// it applies. A completed row is drawn at full strength (XT-2); an unknown
/// status is the dashed chip (VS-1), whatever the date.
class CalendarEventRow extends StatelessWidget {
  const CalendarEventRow({
    super.key,
    required this.entry,
    required this.emphasis,
    required this.onOpen,
    this.dividerAbove = true,
  });

  final CalendarEntry entry;
  final CalendarRowEmphasis emphasis;
  final VoidCallback onOpen;
  final bool dividerAbove;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EventStatus status = entry.grandPrix.status;
    final String statusLabel = requiredEventStatusLabel(l10n, status);
    // The same calendar-only formatting the legacy card used: no time-zone
    // conversion, so the shown dates never shift.
    final String? dateRange = SessionTimePresenter(
      locale: Localizations.localeOf(context).languageCode,
    ).formatDateRange(entry.grandPrix.startDate, entry.grandPrix.endDate);
    final String? location = _joined(<String>[
      ?entry.locality,
      ?entry.country,
    ], ', ');
    final bool next = emphasis == CalendarRowEmphasis.next;

    return GvPrimerRaceRow(
      round: '${entry.round}',
      name: entry.grandPrix.name,
      circuit: entry.circuitName,
      details: _joined(<String>[?location, ?dateRange], ' · '),
      highlighted: emphasis != CalendarRowEmphasis.none,
      highlightLabel: next ? l10n.calendarNextLabel : null,
      dividerAbove: dividerAbove,
      statuses: <GvPrimerStatusLabel>[
        GvPrimerStatusLabel(statusLabel, primerEventStatusKind(status)),
        if (entry.grandPrix.format == WeekendFormat.sprint)
          GvPrimerStatusLabel(
            weekendFormatLabel(l10n, WeekendFormat.sprint),
            GvPrimerChipKind.context,
          ),
      ],
      semanticLabel: l10n.calendarEventSemantics(
        entry.grandPrix.name,
        '${entry.round}',
        <String>[
          if (next) l10n.calendarNextLabel,
          statusLabel,
          if (entry.grandPrix.format == WeekendFormat.sprint)
            weekendFormatLabel(l10n, WeekendFormat.sprint),
          ?entry.circuitName,
          ?location,
          ?dateRange,
        ].join(', '),
      ),
      onOpen: onOpen,
    );
  }

  static String? _joined(List<String> parts, String separator) =>
      parts.isEmpty ? null : parts.join(separator);
}
