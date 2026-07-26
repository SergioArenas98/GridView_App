import 'package:flutter/material.dart';

import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/session.dart';
import '../domain_status.dart';

/// Renders an ordered weekend schedule, exactly as delivered.
///
/// Standard and sprint weekends use this one data-driven path: nothing here
/// knows which session types to expect, so an added, reordered or unrecognised
/// session simply renders — an unknown type falls back to a localized label
/// instead of disappearing, and cancelled/postponed sessions stay visible with
/// their own label.
///
/// Session times are shown in the event's local timezone (falling back to the
/// device clock) with an explicit zone label, so it is always clear which clock
/// is displayed. A session with no start time shows no time at all — never
/// midnight and never a zero. Calendar/status text wraps to the subtitle and
/// ellipsises; the compact time sits in the trailing slot — safe at large text
/// scales and narrow widths.
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
    final String status = requiredSessionStatusLabel(l10n, session.status);
    final String? dateText = shown == null
        ? null
        : '${shown.weekday} ${shown.dayMonth}';
    final String subtitle = <String>[?dateText, status].join(' · ');

    return GvSessionRow(
      key: ValueKey<String>('session-${session.id}'),
      name: sessionDisplayName(l10n, session),
      statusLabel: subtitle,
      tone: _tone(session.status),
      time: shown == null ? null : '${shown.time} ${shown.zoneLabel}',
    );
  }

  /// Only the states a reader must not miss earn an accent bar: a schedule is
  /// mostly "scheduled" or "completed", and colouring every row would be noise
  /// rather than information. The textual status is always present regardless.
  GvStatusTone _tone(SessionStatus status) => switch (status) {
    SessionStatus.live => GvStatusTone.live,
    SessionStatus.cancelled || SessionStatus.postponed => GvStatusTone.warning,
    SessionStatus.scheduled ||
    SessionStatus.completed ||
    SessionStatus.unknown => GvStatusTone.neutral,
  };
}
