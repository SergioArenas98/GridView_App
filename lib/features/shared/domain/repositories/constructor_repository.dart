import '../../data/remote/remote_cancellation.dart';
import '../entities/detail_views.dart';
import '../refresh_result.dart';

/// Domain-facing repository for constructors: the season list and per-team
/// detail (identity, season branding, standing and derived line-up).
///
/// The season list owns the season's constructor entries; team detail owns the
/// stable identity (biography and media). The line-up is derived from the
/// season's driver entries — never a stored duplicate.
abstract interface class ConstructorRepository {
  Stream<List<SeasonConstructor>> watchSeasonConstructors(int season);
  Stream<TeamDetailView?> watchConstructor({
    required int season,
    required String constructorId,
  });
  Future<List<SeasonConstructor>> readSeasonConstructors(int season);
  Future<TeamDetailView?> readConstructor({
    required int season,
    required String constructorId,
  });

  Future<RefreshResult> refreshSeasonConstructors(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
  Future<RefreshResult> refreshConstructor({
    required String constructorId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
