import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/session.dart';

/// Why one session of a weekend is the one Home emphasises.
enum HomeSessionRelevance {
  /// The session is authoritatively live right now.
  live,

  /// The session has not started yet and is the next one up.
  next,

  /// Nothing is live and nothing is still ahead: the most relevant session the
  /// weekend supplied, by delivered order and status.
  latest,
}

/// The one session Home emphasises, and why.
class HomeSessionFocus {
  const HomeSessionFocus({required this.session, required this.relevance});

  final Session session;
  final HomeSessionRelevance relevance;

  bool get isLive => relevance == HomeSessionRelevance.live;
  bool get isNext => relevance == HomeSessionRelevance.next;
}

/// Resolves the current or next session of a weekend from the delivered
/// sessions and an injected [now].
///
/// Pure: no `DateTime.now`, no I/O, and no knowledge of which session types a
/// weekend "should" contain — a standard weekend, a sprint weekend and a format
/// this app version has never seen all take the same path.
///
/// Priority:
/// 1. a session with authoritative **live** status. When several claim it, the
///    latest in the delivered order wins, mirroring the event rule: a later
///    session can only be live once the earlier one has finished;
/// 2. otherwise the **next** non-cancelled session with a known start at or
///    after [now] — the earliest such by start time, with delivered order as the
///    stable tie-breaker;
/// 3. otherwise the most relevant supplied session: the last non-cancelled one
///    in the delivered order (for a finished weekend, the race);
/// 4. otherwise none.
///
/// Policy notes:
/// - a **cancelled** session never becomes the focus, but it is not removed from
///   the schedule the caller renders;
/// - a **postponed** session stays eligible: it is still part of the weekend,
///   and a missing new time simply makes it ineligible for the time-based rule;
/// - a session with **no start time** has no time — never midnight, and never a
///   zero — so it cannot be "next", though it can still be the fallback.
HomeSessionFocus? resolveHomeSessionFocus(
  List<Session> sessions,
  DateTime now,
) {
  Session? live;
  for (final Session session in sessions) {
    if (session.status == SessionStatus.live) live = session;
  }
  if (live != null) {
    return HomeSessionFocus(
      session: live,
      relevance: HomeSessionRelevance.live,
    );
  }

  Session? next;
  DateTime? nextStart;
  for (final Session session in sessions) {
    if (session.status == SessionStatus.cancelled) continue;
    final DateTime? start = session.startTime;
    if (start == null) continue;
    if (start.isBefore(now)) continue;
    if (next == null || start.isBefore(nextStart!)) {
      next = session;
      nextStart = start;
    }
  }
  if (next != null) {
    return HomeSessionFocus(
      session: next,
      relevance: HomeSessionRelevance.next,
    );
  }

  Session? latest;
  for (final Session session in sessions) {
    if (session.status == SessionStatus.cancelled) continue;
    latest = session;
  }
  return latest == null
      ? null
      : HomeSessionFocus(
          session: latest,
          relevance: HomeSessionRelevance.latest,
        );
}

/// The compact subset of a weekend's schedule shown around the focused session.
///
/// The full schedule stays one interaction away on the Grand Prix screen, so
/// Home shows a window of at most [size] sessions centred on the focus, always
/// in the **delivered order** — never re-sorted, never filtered by type. When
/// there is no focus, the first [size] sessions are shown.
List<Session> homeSessionWindow(
  List<Session> sessions,
  Session? focus, {
  int size = 3,
}) {
  if (size <= 0 || sessions.isEmpty) return const <Session>[];
  if (sessions.length <= size) return List<Session>.unmodifiable(sessions);

  final int focusIndex = focus == null
      ? 0
      : sessions.indexWhere((Session s) => s.id == focus.id);
  // Centre the window on the focus, then clamp it inside the schedule so the
  // window is always exactly [size] long.
  int start = (focusIndex < 0 ? 0 : focusIndex) - (size ~/ 2);
  if (start < 0) start = 0;
  if (start + size > sessions.length) start = sessions.length - size;
  return List<Session>.unmodifiable(sessions.sublist(start, start + size));
}
