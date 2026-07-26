import '../../data/remote/remote_cancellation.dart';
import '../entities/home_view.dart';
import '../refresh_result.dart';

/// Domain-facing repository for the Home view.
///
/// The UI reads the Drift-backed [watchHome] stream; a refresh performs a
/// conditional remote read and writes the snapshot atomically, after which the
/// stream re-emits. A failed refresh never erases valid cached data.
abstract interface class HomeRepository {
  Stream<HomeView?> watchHome();
  Future<HomeView?> readHome();

  /// The season of the locally materialized Home representation, or `null` when
  /// none has been materialized.
  ///
  /// This is the explicit materialization check the application-level first-use
  /// policy reads. It is independent of whether the season has a featured
  /// event: a season with nothing scheduled that synchronised successfully is
  /// materialized, and it survives a database close/reopen.
  Future<int?> materializedSeason();

  /// Streaming form of [materializedSeason].
  Stream<int?> watchMaterializedSeason();

  /// Refreshes Home for [season]. Home is season-scoped, so the caller must
  /// know the year: it selects the canonical `home:<year>` key whose validator
  /// and metadata the refresh reads and writes.
  Future<RefreshResult> refreshHome({
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
