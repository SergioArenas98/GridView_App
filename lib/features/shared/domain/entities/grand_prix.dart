import 'enums.dart';
import 'media.dart';
import 'session.dart';

/// A season-scoped Grand Prix edition. `startDate`/`endDate` are calendar-only
/// strings; `timezone` is the event-local IANA zone, kept distinct from any UTC
/// instant. Standard and sprint weekends share this model — the difference is
/// the set of session types in [sessions].
class GrandPrix {
  const GrandPrix({
    required this.id,
    required this.season,
    required this.round,
    required this.eventSlug,
    required this.name,
    this.officialName,
    required this.circuitId,
    required this.status,
    required this.format,
    this.startDate,
    this.endDate,
    this.timezone,
    required this.sessions,
    required this.hasResults,
    this.media,
  });

  final String id;
  final int season;
  final int round;
  final String eventSlug;
  final String name;
  final String? officialName;
  final String circuitId;
  final EventStatus status;
  final WeekendFormat format;
  final String? startDate;
  final String? endDate;
  final String? timezone;
  final List<Session> sessions;
  final bool hasResults;
  final List<MediaAsset>? media;
}
