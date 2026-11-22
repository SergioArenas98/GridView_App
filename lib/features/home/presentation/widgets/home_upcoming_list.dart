import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/calendar_entry.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../../domain/home_module_availability.dart';
import '../home_formatting.dart';
import '../home_status_kinds.dart';
import 'home_primer_parts.dart';

/// Upcoming events (`refinement-01` `.upcoming`).
///
/// Four distinct outcomes, never blurred into one: nothing is known yet (a
/// silent placeholder, or the stored events while the record is read); the
/// calendar cannot answer ("Upcoming events unavailable"); it answered that no
/// races remain ("No upcoming events"); it listed them (Primer Calendar rows,
/// so Home and Calendar never disagree about a name, status or circuit). The
/// "View Calendar" link stays in every outcome.
///
/// Whether the section exists at all is the screen's decision (HM-01).
/// Rows are full-bleed (they carry their own gutter); the title and the
/// one-line outcomes sit on the gutter.
class HomeUpcomingSection extends StatelessWidget {
  const HomeUpcomingSection({
    super.key,
    required this.module,
    required this.format,
    required this.onOpen,
    required this.onOpenCalendar,
  });

  final HomeUpcomingModule module;
  final HomeFormatter format;
  final void Function(CalendarEntry entry) onOpen;
  final VoidCallback onOpenCalendar;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool showList = switch (module.availability) {
      HomeModuleAvailability.available => true,
      HomeModuleAvailability.resolving => module.events.isNotEmpty,
      _ => false,
    };
    final String? message = switch (module.availability) {
      HomeModuleAvailability.unavailable => l10n.homeUpcomingUnavailable,
      HomeModuleAvailability.availableEmpty => l10n.homeNoUpcomingEvents,
      _ => null,
    };
    final Widget link = HomeTextLink(
      label: l10n.homeViewCalendar,
      accent: true,
      onActivate: onOpenCalendar,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
          ),
          child: GvPrimerSectionTitle(l10n.homeUpcoming),
        ),
        const SizedBox(height: 6),
        if (showList) ...<Widget>[
          for (int i = 0; i < module.events.length; i++)
            _row(context, l10n, module.events[i], first: i == 0),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
            ),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: link,
            ),
          ),
        ] else
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: roles.line.subtle)),
              ),
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 16,
                  children: <Widget>[
                    if (message != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: HomeReadable(
                          child: Text(
                            message,
                            style: homeTextStyle(color: roles.text.secondary),
                          ),
                        ),
                      )
                    else
                      // Not known yet: asserts neither "nothing here" nor
                      // "unavailable", and keeps the row's height stable.
                      const SizedBox(
                        key: ValueKey<String>('home-upcoming-resolving'),
                        width: 0,
                        height: 34,
                      ),
                    link,
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _row(
    BuildContext context,
    AppLocalizations l10n,
    CalendarEntry entry, {
    required bool first,
  }) {
    final EventStatus status = entry.grandPrix.status;
    final String statusLabel = requiredEventStatusLabel(l10n, status);
    final String? location = _joined(<String>[
      ?entry.locality,
      ?entry.country,
    ], ', ');
    final String? dateRange = format.dateRange(
      entry.grandPrix.startDate,
      entry.grandPrix.endDate,
    );
    final String? details = _joined(<String>[?location, ?dateRange], ' · ');
    return GvPrimerRaceRow(
      key: ValueKey<String>('home-upcoming-${entry.season}-${entry.round}'),
      round: '${entry.round}',
      name: entry.grandPrix.name,
      circuit: entry.circuitName,
      details: details,
      dividerAbove: true,
      statuses: <GvPrimerStatusLabel>[
        GvPrimerStatusLabel(statusLabel, homeEventStatusKind(status)),
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
          statusLabel,
          ?entry.circuitName,
          ?location,
          ?dateRange,
        ].join(', '),
      ),
      onOpen: () => onOpen(entry),
    );
  }
}

/// The present parts joined, or `null` when none is present.
String? _joined(List<String> parts, String separator) =>
    parts.isEmpty ? null : parts.join(separator);
