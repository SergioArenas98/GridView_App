import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/calendar_entry.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/presentation/domain_status.dart';

/// How prominently a calendar row is presented.
enum CalendarEventEmphasis {
  /// An ordinary row.
  none,

  /// The event happening now.
  current,

  /// The next event up.
  next,
}

/// One calendar row: round, Grand Prix name, circuit and location, the weekend
/// date range and a localized event-state label.
///
/// Every state is communicated by text as well as by tone — the accent bar and
/// the chip colour only reinforce a label that is always present, and a
/// completed event is de-emphasised without hiding anything. No remote imagery
/// is used: the card is information-led.
class CalendarEventCard extends StatelessWidget {
  const CalendarEventCard({
    super.key,
    required this.entry,
    this.emphasis = CalendarEventEmphasis.none,
    this.onTap,
  });

  final CalendarEntry entry;
  final CalendarEventEmphasis emphasis;
  final VoidCallback? onTap;

  bool get _emphasized => emphasis != CalendarEventEmphasis.none;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EventStatus status = entry.grandPrix.status;
    final String statusLabel = requiredEventStatusLabel(l10n, status);
    final bool dimmed = status == EventStatus.completed && !_emphasized;

    final SessionTimePresenter presenter = SessionTimePresenter(
      locale: Localizations.localeOf(context).languageCode,
    );
    final String? dateRange = presenter.formatDateRange(
      entry.grandPrix.startDate,
      entry.grandPrix.endDate,
    );
    final String? location = _location();

    return Semantics(
      button: onTap != null,
      label: l10n.calendarEventSemantics(
        entry.grandPrix.name,
        '${entry.round}',
        <String>[
          if (emphasis == CalendarEventEmphasis.next) l10n.calendarNextLabel,
          statusLabel,
          ?location,
          ?dateRange,
        ].join(', '),
      ),
      child: ExcludeSemantics(
        child: Opacity(
          opacity: dimmed ? 0.72 : 1,
          child: GvContentCard(
            onTap: onTap,
            padding: const EdgeInsets.symmetric(
              horizontal: GvSpacing.md,
              vertical: GvSpacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                if (_emphasized) ...<Widget>[
                  Container(
                    width: 4,
                    height: 44,
                    decoration: BoxDecoration(
                      color: gvToneColor(context, toneForEventStatus(status)),
                      borderRadius: GvRadii.pillAll,
                    ),
                  ),
                  const SizedBox(width: GvSpacing.sm),
                ],
                SizedBox(
                  width: 32,
                  child: Text(
                    '${entry.round}',
                    textAlign: TextAlign.center,
                    style: context.gvText.statValue.copyWith(fontSize: 18),
                  ),
                ),
                const SizedBox(width: GvSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        entry.grandPrix.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.gvText.cardTitle.copyWith(fontSize: 16),
                      ),
                      if (_subtitle(dateRange, location) case final String s)
                        Text(
                          s,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: context.gvText.label,
                        ),
                      const SizedBox(height: GvSpacing.xs),
                      // Chips live inside the bounded column so they ellipsise
                      // rather than overflow at large text scales.
                      Wrap(
                        spacing: GvSpacing.xs,
                        runSpacing: GvSpacing.xxs,
                        children: <Widget>[
                          if (emphasis == CalendarEventEmphasis.next)
                            GvStatusChip(
                              label: l10n.calendarNextLabel,
                              tone: GvStatusTone.live,
                            ),
                          GvStatusChip(
                            label: statusLabel,
                            tone: toneForEventStatus(status),
                          ),
                          if (entry.grandPrix.format == WeekendFormat.sprint)
                            GvStatusChip(
                              label: weekendFormatLabel(
                                l10n,
                                WeekendFormat.sprint,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The circuit / location / dates line, built only from values that exist.
  String? _subtitle(String? dateRange, String? location) {
    final List<String> parts = <String>[
      ?entry.circuitName,
      ?location,
      ?dateRange,
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  String? _location() {
    final List<String> parts = <String>[?entry.locality, ?entry.country];
    return parts.isEmpty ? null : parts.join(', ');
  }
}
