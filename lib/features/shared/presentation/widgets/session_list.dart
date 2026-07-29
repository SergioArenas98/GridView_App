import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/time/session_time.dart';
import '../../../../core/time/session_time_scope.dart';
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
/// Session times are rendered by the one application-wide presentation-time
/// policy, so they follow the user's Device/Event/Both preference and always
/// carry an explicit zone label — it is never ambiguous which clock is shown. In
/// Both mode the device clock appears as a second line, and only when it
/// actually differs from the event clock. A session with no start time shows no
/// time at all — never midnight and never a zero. Calendar/status text wraps to the subtitle and
/// ellipsises; the compact time sits in the trailing slot — safe at large text
/// scales and narrow widths.
class SessionList extends ConsumerWidget {
  const SessionList({super.key, required this.sessions, this.eventTimeZone});

  final List<Session> sessions;
  final String? eventTimeZone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final SessionTimePresenter presenter = sessionTimePresenterOf(context, ref);

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
    final PresentedTime? shown = presenter.present(
      session.startTime,
      eventTimeZone: eventTimeZone,
    );
    final String status = requiredSessionStatusLabel(l10n, session.status);
    final String subtitle = <String>[
      ?shown?.primary.dayLabel,
      status,
    ].join(' · ');

    return GvSessionRow(
      key: ValueKey<String>('session-${session.id}'),
      name: sessionDisplayName(l10n, session),
      statusLabel: subtitle,
      tone: _tone(session.status),
      time: shown == null
          ? null
          : '${shown.primary.time} ${shown.primary.zoneLabel}',
      // A conversion that moves the session onto a different calendar day keeps
      // the day visible on the second line rather than showing a bare clock time
      // that silently belongs to another date.
      secondaryTime: shown?.secondary == null
          ? null
          : <String>[
              if (shown!.crossesDay) shown.secondary!.dayLabel,
              shown.secondary!.time,
              shown.secondary!.zoneLabel,
            ].join(' '),
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
