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
  Future<RefreshResult> refreshHome({bool forceRefresh = false});
}
