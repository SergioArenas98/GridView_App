import 'package:flutter/material.dart';

import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/entities/session.dart';
import '../domain_status.dart';

/// Renders an ordered weekend schedule. Session times are shown in the event's
/// local timezone (falling back to the device clock) with an explicit zone
/// label, so it is always clear which clock is displayed. Calendar/status text
/// wraps to the subtitle and ellipsises; the compact time sits in the trailing
/// slot — safe at large text scales and narrow widths.
class SessionList extends StatelessWidget {
  const SessionList({super.key, required this.sessions, this.eventTimeZone});

  final List<Session> sessions;
  final String? eventTimeZone;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final SessionTimePresenter presenter = SessionTimePresenter(
      locale: Localizations.localeOf(context).languageCode,
    );

    return Column(
      children: <Widget>[
        for (final Session session in sessions) _row(l10n, presenter, session),
      ],
    );
  }

  Widget _row(
    AppLocalizations l10n,
    SessionTimePresenter presenter,
    Session session,
  ) {
    final DisplayedTime? shown = presenter.formatInstant(
      session.startTime,
      eventTimeZone: eventTimeZone,
    );
    final String? status = sessionStatusLabel(l10n, session.status);
    final String? dateText = shown == null
        ? null
        : '${shown.weekday} ${shown.dayMonth}';
    final String subtitle = <String?>[
      dateText,
      status,
    ].whereType<String>().join(' · ');

    return GvSessionRow(
      key: ValueKey<String>('session-${session.id}'),
      name: sessionDisplayName(session),
      statusLabel: subtitle.isEmpty ? null : subtitle,
      time: shown == null ? null : '${shown.time} ${shown.zoneLabel}',
    );
  }
}
