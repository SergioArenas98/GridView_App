import '../../data/remote/remote_cancellation.dart';
import '../entities/calendar_entry.dart';
import '../refresh_result.dart';

/// Domain-facing repository for the season calendar: the ordered Grand Prix
/// summaries joined with their host circuit summaries, as [CalendarEntry]
/// domain read models. Reads come from the local database; a refresh replaces
/// the season's calendar atomically, preserving unrelated seasons.
abstract interface class CalendarRepository {
  Stream<List<CalendarEntry>> watchCalendar(int season);
  Future<List<CalendarEntry>> readCalendar(int season);
  Future<RefreshResult> refreshCalendar(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
