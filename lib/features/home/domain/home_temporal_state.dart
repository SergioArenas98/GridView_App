import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/grand_prix.dart';
import '../../shared/domain/relevant_event.dart';
import 'home_session_focus.dart';

/// Where the season currently is, relative to the featured Grand Prix.
///
/// This decides only *emphasis* — which module leads the dashboard. Every
/// module stays truthful in every phase: a phase never hides a status, invents
/// a time or claims something the data did not say.
enum HomeTemporalPhase {
  /// The relevant event is still ahead and nothing is live. The next session or
  /// the event start is emphasised.
  preEvent,

  /// The event or one of its sessions is authoritatively in progress. The
  /// current session leads; otherwise the next session of the weekend does.
  raceWeekend,

  /// The featured event is completed — the authoritative Home focus is a
  /// finished event. The latest result summary gains prominence.
  postRace,
}

/// Resolves the Home temporal phase from the featured event, its focused
/// session and an injected [now].
///
/// Pure and total: it never calls `DateTime.now`, never throws, and maps every
/// input — including an unknown status and an incomplete or malformed date — to
/// a safe phase.
///
/// Order of authority:
/// 1. a **live** session, or an event the server says is `in_progress`, is a
///    race weekend. Authoritative live status outranks the calendar dates,
///    because the server knows about delays the dates cannot express;
/// 2. a **completed** event is post-race;
/// 3. otherwise, today falling inside `[startDate, endDate]` is a race weekend;
/// 4. otherwise pre-event.
///
/// A **cancelled** event resolves to [HomeTemporalPhase.preEvent] rather than
/// disappearing or being treated as completed: the card stays visible and its
/// status label — never the phase — is what tells the user it is cancelled. A
/// **postponed** event is treated the same way, and keeps its own status.
HomeTemporalPhase resolveHomeTemporalPhase({
  required GrandPrix event,
  required HomeSessionFocus? sessionFocus,
  required DateTime now,
}) {
  if (sessionFocus?.isLive ?? false) return HomeTemporalPhase.raceWeekend;
  if (event.status == EventStatus.inProgress) {
    return HomeTemporalPhase.raceWeekend;
  }
  if (event.status == EventStatus.completed) return HomeTemporalPhase.postRace;
  if (_isWithinWeekend(event, now)) return HomeTemporalPhase.raceWeekend;
  return HomeTemporalPhase.preEvent;
}

/// Whether today falls inside the event's `[startDate, endDate]` window.
///
/// Dates are compared as `YYYY-MM-DD` strings, exactly as the shared
/// relevant-event rule does, so the two can never disagree. An incomplete or
/// malformed date simply makes the window unusable — it is never guessed at and
/// never throws.
bool _isWithinWeekend(GrandPrix event, DateTime now) {
  final String? start = calendarDateOf(event.startDate);
  if (start == null) return false;
  final String end = calendarDateOf(event.endDate) ?? start;
  final String today = utcDateString(now);
  return start.compareTo(today) <= 0 && today.compareTo(end) <= 0;
}
