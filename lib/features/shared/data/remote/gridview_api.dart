import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/result_dto.dart';
import '../../../../core/api/dto/season_dto.dart';
import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import 'remote_cancellation.dart';
import 'remote_result.dart';

/// The remote GridView API boundary for the full v1 public contract.
///
/// Every method performs one conditional read and returns a typed
/// [RemoteResult]: [RemoteModified] (200, parsed `data` + `meta` + ETag),
/// [RemoteNotModified] (304, no body) or [RemoteFailure] (a provider-agnostic
/// [ApiFailure]). Nothing transport-specific (Dio) and no provider identifier
/// ever crosses this interface, and no method sends an admin credential or
/// calls an internal route.
///
/// Callers pass the resource's persisted `etag` to enable `If-None-Match`, and
/// an optional [RemoteCancellation] to abort an in-flight request.
abstract interface class GridViewApi {
  /// Whether this data source serves non-authoritative mock data. `true` only
  /// for the dev/staging fixture source; always `false` in production.
  bool get usesMockData;

  // --- Health -------------------------------------------------------------

  /// `GET /v1/status` — service health and metadata (BaseMeta; no snapshot
  /// provenance).
  Future<RemoteResult<StatusDataDto>> fetchStatus({
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Aggregate ----------------------------------------------------------

  /// `GET /v1/bootstrap` — the first-launch aggregate for [season] (or the
  /// current season when null).
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/home` — the precomputed Home view model.
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Seasons ------------------------------------------------------------

  /// `GET /v1/seasons/current` — the current active season.
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/seasons/{season}` — season metadata.
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Calendar -----------------------------------------------------------

  /// `GET /v1/seasons/{season}/calendar` — the ordered season calendar.
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/seasons/{season}/grand-prix/{round}` — full Grand Prix detail.
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/seasons/{season}/grand-prix/{round}/results` — race/sprint result
  /// document (may be `unavailable` with empty entries).
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Standings ----------------------------------------------------------

  /// `GET /v1/seasons/{season}/standings/drivers`.
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/seasons/{season}/standings/constructors`.
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Drivers ------------------------------------------------------------

  /// `GET /v1/seasons/{season}/drivers` — season driver summaries.
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/drivers/{driverId}` — driver detail with season context.
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Constructors -------------------------------------------------------

  /// `GET /v1/seasons/{season}/constructors` — season constructor summaries.
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/constructors/{constructorId}` — constructor detail with season
  /// context.
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Circuits -----------------------------------------------------------

  /// `GET /v1/seasons/{season}/circuits` — full circuits used in the season.
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  /// `GET /v1/circuits/{circuitId}` — circuit detail with season context.
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  });

  // --- Content ------------------------------------------------------------

  /// `GET /v1/content/manifest` — content/media manifest (SnapshotMeta).
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  });
}
