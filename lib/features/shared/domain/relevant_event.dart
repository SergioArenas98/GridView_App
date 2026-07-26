import 'entities/enums.dart';
import 'entities/grand_prix.dart';

/// The relevant event of a season and *why* it is relevant.
class RelevantEvent {
  const RelevantEvent({required this.event, required this.inProgress});

  final GrandPrix event;

  /// True when the event is happening now (rather than being the next one up).
  final bool inProgress;
}

/// Resolves the one event a season screen should highlight, from the
/// authoritative calendar and an injected [now].
///
/// This is the single rule shared by Home and Calendar so the two can never
/// disagree about which event is relevant. It is pure: no `DateTime.now`, no
/// I/O, no sorting by display name and no inference of round order from
/// identifiers — the supplied chronology is authoritative.
///
/// Priority:
/// 1. an event currently in progress — the server said so, or today falls inside
///    its `[startDate, endDate]` window;
/// 2. otherwise the earliest still-eligible event dated on or after today
///    (`startDate`, with `round` as the stable tie-breaker);
/// 3. otherwise none.
///
/// Policy notes:
/// - **Cancelled** events are never relevant, in progress or upcoming.
/// - **Postponed** events stay eligible while they still carry a date on or
///   after today: they remain on the calendar, only moved. They never win a tie
///   against a non-postponed event, because the round tie-breaker is applied to
///   the delivered chronology rather than to their status.
/// - **Completed** events are never upcoming.
/// - Missing or malformed dates simply make an event ineligible for the
///   date-based rules; they never throw.
RelevantEvent? resolveRelevantEvent(Iterable<GrandPrix> events, DateTime now) {
  final String today = _dateString(now);

  GrandPrix? live;
  for (final GrandPrix event in events) {
    if (event.status == EventStatus.cancelled) continue;
    if (!_isInProgress(event, today)) continue;
    // The latest qualifying event wins, mirroring the local "current session"
    // rule: a later round can only be live if the earlier one has finished.
    if (live == null || _roundIsAfter(event, live)) live = event;
  }
  if (live != null) return RelevantEvent(event: live, inProgress: true);

  GrandPrix? next;
  for (final GrandPrix event in events) {
    if (event.status == EventStatus.cancelled) continue;
    if (event.status == EventStatus.completed) continue;
    final String? start = _calendarDate(event.startDate);
    if (start == null || start.compareTo(today) < 0) continue;
    if (next == null || _isEarlier(event, start, next)) next = event;
  }
  return next == null ? null : RelevantEvent(event: next, inProgress: false);
}

bool _isInProgress(GrandPrix event, String today) {
  if (event.status == EventStatus.inProgress) return true;
  final String? start = _calendarDate(event.startDate);
  if (start == null) return false;
  final String end = _calendarDate(event.endDate) ?? start;
  return start.compareTo(today) <= 0 && today.compareTo(end) <= 0;
}

bool _isEarlier(GrandPrix candidate, String candidateStart, GrandPrix current) {
  final String? currentStart = _calendarDate(current.startDate);
  if (currentStart == null) return true;
  final int byDate = candidateStart.compareTo(currentStart);
  if (byDate != 0) return byDate < 0;
  return candidate.round < current.round;
}

bool _roundIsAfter(GrandPrix candidate, GrandPrix current) =>
    candidate.round > current.round;

/// Accepts a `YYYY-MM-DD` calendar date, rejecting anything else (including a
/// partial or malformed value) rather than guessing.
String? _calendarDate(String? value) {
  if (value == null || value.length < 10) return null;
  final String date = value.substring(0, 10);
  if (date[4] != '-' || date[7] != '-') return null;
  for (final int index in const <int>[0, 1, 2, 3, 5, 6, 8, 9]) {
    final int code = date.codeUnitAt(index);
    if (code < 0x30 || code > 0x39) return null;
  }
  return date;
}

String _dateString(DateTime instant) {
  final DateTime utc = instant.toUtc();
  final String year = utc.year.toString().padLeft(4, '0');
  final String month = utc.month.toString().padLeft(2, '0');
  final String day = utc.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}
