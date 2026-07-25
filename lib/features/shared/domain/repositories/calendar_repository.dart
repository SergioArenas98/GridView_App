import '../entities/grand_prix.dart';
import '../refresh_result.dart';

/// Domain-facing repository for the season calendar (ordered Grand Prix
/// summaries). Reads come from the local database; a refresh replaces the
/// season's calendar atomically, preserving unrelated seasons.
abstract interface class CalendarRepository {
  Stream<List<GrandPrix>> watchCalendar(int season);
  Future<List<GrandPrix>> readCalendar(int season);
  Future<RefreshResult> refreshCalendar(
    int season, {
    bool forceRefresh = false,
  });
}
