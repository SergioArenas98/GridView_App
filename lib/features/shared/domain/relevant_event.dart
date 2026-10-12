import 'entities/enums.dart';
import 'entities/grand_prix.dart';
import 'entities/session.dart';

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
/// 2. otherwise the earliest still-eligible event ahead of [now], by start
///    date — the race date standing in for an
///    `unknown` event without dates — with `round` as the stable tie-breaker;
/// 3. otherwise none.
///
/// Policy notes:
/// - **Cancelled** events are never relevant, in progress or upcoming.
/// - **Postponed** events stay eligible while they still carry a date on or
///   after today: they remain on the calendar, only moved. They never win a tie
///   against a non-postponed event, because the round tie-breaker is applied to
///   the delivered chronology rather than to their status.
/// - **Completed** events, and events with a classified race result
///   ([isEventSettled]), are never upcoming.
/// - Missing or malformed dates simply make an event ineligible for the
///   date-based rules; they never throw.
RelevantEvent? resolveRelevantEvent(Iterable<GrandPrix> events, DateTime now) {
  final List<GrandPrix> all = events.toList(growable: false);
  final String today = utcDateString(now);

  GrandPrix? live;
  for (final GrandPrix event in all) {
    if (event.status == EventStatus.cancelled) continue;
    if (!_isInProgress(event, today)) continue;
    // The latest qualifying event wins, mirroring the local "current session"
    // rule: a later round can only be live if the earlier one has finished.
    if (live == null || _roundIsAfter(event, live)) live = event;
  }
  if (live != null) return RelevantEvent(event: live, inProgress: true);

  final int horizon = _horizonRound(all, now, today);
  GrandPrix? next;
  for (final GrandPrix event in all) {
    if (!_isUpcomingCandidate(event, now, today, horizon)) continue;
    if (next == null || _isEarlier(event, next)) next = event;
  }
  return next == null ? null : RelevantEvent(event: next, inProgress: false);
}

/// The season's most recently finished event at [now].
///
/// The single rule shared by the calendar query and the Home dashboard, so the
/// two can never name a different "latest completed Grand Prix". Ordering is by
/// end date descending when both events have one, with `round` as the stable
/// tie-breaker; nothing is inferred from list position.
///
/// What counts as finished depends on whether the status is authoritative:
/// - an **authoritative** status keeps the date rule: the end date is strictly
///   before today, and an event with no usable end date is not a candidate;
/// - an **`unknown`** status (ADR 0022 A6) is never finished because time
///   passed. Only a classified race result (`hasResults`, A7) makes it a
///   candidate, and its status stays `unknown`: the result is the fact, not a
///   lifecycle.
GrandPrix? resolveLatestCompletedEvent(
  Iterable<GrandPrix> events,
  DateTime now,
) {
  final String today = utcDateString(now);
  GrandPrix? latest;
  for (final GrandPrix event in events) {
    if (!_isFinished(event, today)) continue;
    if (latest == null || _isLater(event, latest)) latest = event;
  }
  return latest;
}

/// The season's upcoming events at [now], in the delivered calendar order.
///
/// Policy, applied in exactly one place so Home cannot disagree with the
/// Calendar screen:
/// - **cancelled** events are excluded — a cancelled race is not something the
///   user is waiting for (its status stays visible on the Calendar itself);
/// - **completed** events, and events with a classified race result, are
///   excluded;
/// - **postponed** events are kept, so their real status stays visible;
/// - an event is kept only while it is ahead of [now]. An **authoritative**
///   status keeps the date rule (a start date on or after today), so such an
///   event with no usable start date is excluded rather than guessed at. An
///   **`unknown`** status (ADR 0022 A6) is placed by explicit chronology only:
///   the race session's UTC start instant, strictly after [now]; else the
///   published weekend dates, the last day on or after today; else, with no
///   chronology of its own, a round after every event already settled or
///   behind [now] in the delivered chronology. No date or time is
///   manufactured;
/// - [excludeRound] drops the round already featured elsewhere on the screen,
///   so the same Grand Prix is never shown twice;
/// - [limit] bounds the result; a non-positive limit returns nothing.
///
/// The delivered chronology is authoritative: the input order is preserved and
/// nothing is re-sorted by name or identifier.
List<GrandPrix> resolveUpcomingEvents(
  Iterable<GrandPrix> events,
  DateTime now, {
  int? excludeRound,
  int limit = 3,
}) {
  if (limit <= 0) return const <GrandPrix>[];
  final List<GrandPrix> all = events.toList(growable: false);
  final String today = utcDateString(now);
  final int horizon = _horizonRound(all, now, today);
  final List<GrandPrix> upcoming = <GrandPrix>[];
  for (final GrandPrix event in all) {
    if (excludeRound != null && event.round == excludeRound) continue;
    if (!_isUpcomingCandidate(event, now, today, horizon)) continue;
    upcoming.add(event);
    if (upcoming.length == limit) break;
  }
  return List<GrandPrix>.unmodifiable(upcoming);
}

/// Whether [event] is settled: authoritatively `completed`, or carrying a
/// classified race result (`hasResults`, ADR 0022 A7).
///
/// Settled says nothing new about the lifecycle: an `unknown` event with a
/// result keeps its `unknown` status and is presented as such.
bool isEventSettled(GrandPrix event) =>
    event.status == EventStatus.completed || event.hasResults;

/// The explicit UTC start of the event's race session, when one is stored.
///
/// Only a non-cancelled session of type `race` with a delivered start instant
/// counts; no time is ever derived from a date, another session or the clock.
DateTime? raceStartOf(GrandPrix event) {
  for (final Session session in event.sessions) {
    if (session.type != SessionType.race) continue;
    if (session.status == SessionStatus.cancelled) continue;
    final DateTime? start = session.startTime;
    if (start != null) return start;
  }
  return null;
}

/// Whether a featured event can no longer be presented as the next one at
/// [now]: its status is `unknown`, it has no classified result, and its own
/// race start instant has passed.
///
/// This is how an aging snapshot stops calling a past race "next" without
/// claiming it completed. An authoritative status is never second-guessed here.
bool hasFeaturedEventLapsed(GrandPrix event, DateTime now) {
  if (event.status != EventStatus.unknown || isEventSettled(event)) {
    return false;
  }
  final DateTime? raceStart = raceStartOf(event);
  return raceStart != null && !raceStart.isAfter(now);
}

bool _isUpcomingCandidate(
  GrandPrix event,
  DateTime now,
  String today,
  int horizon,
) {
  if (event.status == EventStatus.cancelled) return false;
  if (isEventSettled(event)) return false;
  return _isAhead(event, now, today, horizon);
}

bool _isAhead(GrandPrix event, DateTime now, String today, int horizon) {
  if (event.status != EventStatus.unknown) {
    final String? start = calendarDateOf(event.startDate);
    return start != null && start.compareTo(today) >= 0;
  }
  final DateTime? raceStart = raceStartOf(event);
  if (raceStart != null) return raceStart.isAfter(now);
  final String? lastDay = _lastDayOf(event);
  if (lastDay != null) return lastDay.compareTo(today) >= 0;
  return event.round > horizon;
}

/// The highest round already behind [now]: settled, or with an explicit race
/// start or a published last day before it. `0` when none is.
int _horizonRound(Iterable<GrandPrix> events, DateTime now, String today) {
  int horizon = 0;
  for (final GrandPrix event in events) {
    if (event.round <= horizon) continue;
    if (isEventSettled(event) || _isBehind(event, now, today)) {
      horizon = event.round;
    }
  }
  return horizon;
}

bool _isBehind(GrandPrix event, DateTime now, String today) {
  final DateTime? raceStart = raceStartOf(event);
  if (raceStart != null) return !raceStart.isAfter(now);
  final String? lastDay = _lastDayOf(event);
  return lastDay != null && lastDay.compareTo(today) < 0;
}

bool _isFinished(GrandPrix event, String today) {
  if (event.status == EventStatus.unknown) return event.hasResults;
  final String? end = calendarDateOf(event.endDate);
  return end != null && end.compareTo(today) < 0;
}

String? _lastDayOf(GrandPrix event) =>
    calendarDateOf(event.endDate) ?? calendarDateOf(event.startDate);

bool _isInProgress(GrandPrix event, String today) {
  if (event.status == EventStatus.inProgress) return true;
  final String? start = calendarDateOf(event.startDate);
  if (start == null) return false;
  final String end = calendarDateOf(event.endDate) ?? start;
  return start.compareTo(today) <= 0 && today.compareTo(end) <= 0;
}

/// Earlier by start date when both events have one; otherwise by round.
bool _isEarlier(GrandPrix candidate, GrandPrix current) {
  final String? candidateStart = _chronologyDateOf(candidate);
  final String? currentStart = _chronologyDateOf(current);
  if (candidateStart != null && currentStart != null) {
    final int byDate = candidateStart.compareTo(currentStart);
    if (byDate != 0) return byDate < 0;
  }
  return candidate.round < current.round;
}

/// Later by end date when both events have one; otherwise by round.
bool _isLater(GrandPrix candidate, GrandPrix current) {
  final String? candidateEnd = calendarDateOf(candidate.endDate);
  final String? currentEnd = calendarDateOf(current.endDate);
  if (candidateEnd != null && currentEnd != null) {
    final int byDate = candidateEnd.compareTo(currentEnd);
    if (byDate != 0) return byDate > 0;
  }
  return candidate.round > current.round;
}

/// The start date used for ordering: the published start date, else the UTC
/// date of the explicit race start.
String? _chronologyDateOf(GrandPrix event) {
  final String? start = calendarDateOf(event.startDate);
  if (start != null) return start;
  final DateTime? raceStart = raceStartOf(event);
  return raceStart == null ? null : utcDateString(raceStart);
}

bool _roundIsAfter(GrandPrix candidate, GrandPrix current) =>
    candidate.round > current.round;

/// Accepts a `YYYY-MM-DD` calendar date, rejecting anything else (including a
/// partial or malformed value) rather than guessing.
///
/// Public because every rule that compares an event to "today" — the calendar
/// chronology here and the Home temporal phase — must parse dates identically;
/// a second private copy is exactly how the two would drift apart.
String? calendarDateOf(String? value) {
  if (value == null || value.length < 10) return null;
  final String date = value.substring(0, 10);
  if (date[4] != '-' || date[7] != '-') return null;
  for (final int index in const <int>[0, 1, 2, 3, 5, 6, 8, 9]) {
    final int code = date.codeUnitAt(index);
    if (code < 0x30 || code > 0x39) return null;
  }
  return date;
}

/// The UTC calendar date of [instant] as `YYYY-MM-DD`, for comparison against
/// [calendarDateOf].
String utcDateString(DateTime instant) {
  final DateTime utc = instant.toUtc();
  final String year = utc.year.toString().padLeft(4, '0');
  final String month = utc.month.toString().padLeft(2, '0');
  final String day = utc.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}
