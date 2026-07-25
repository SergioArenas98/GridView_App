import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/result_dto.dart';
import '../../../../core/api/dto/season_dto.dart';
import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/errors/api_failure.dart';
import 'gridview_api.dart';
import 'remote_cancellation.dart';
import 'remote_result.dart';

/// The reasons a build's remote data source is misconfigured.
enum MisconfigurationReason {
  /// Remote mode was selected (or defaulted) but no `API_BASE_URL` is set.
  missingBaseUrl,

  /// Fixture mode was requested in a production build, which is forbidden.
  fixtureForbiddenInProduction,
}

/// A remote data source used when the build is misconfigured.
///
/// It is **not** a mock source ([usesMockData] is `false`, so no "sample data"
/// banner is shown) and it never returns fixture content. Every call returns a
/// controlled [ApiFailureKind.configuration] failure, so a misconfigured
/// production build (or a fixture mode requested in production) surfaces a clear,
/// typed configuration error instead of silently constructing
/// `FixtureGridViewApi`.
class MisconfiguredGridViewApi implements GridViewApi {
  const MisconfiguredGridViewApi(this.reason);

  final MisconfigurationReason reason;

  @override
  bool get usesMockData => false;

  RemoteResult<T> _fail<T>() =>
      RemoteFailure<T>(const ApiFailure(kind: ApiFailureKind.configuration));

  @override
  Future<RemoteResult<StatusDataDto>> fetchStatus({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<StatusDataDto>();

  @override
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<BootstrapDataDto>();

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<HomeDataDto>();

  @override
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<SeasonDto>();

  @override
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<SeasonDto>();

  @override
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<GrandPrixSummaryDto>>();

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<GrandPrixDto>();

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<RaceResultDto>();

  @override
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<DriverStandingDto>>();

  @override
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<ConstructorStandingDto>>();

  @override
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<SeasonDriverSummaryDto>>();

  @override
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<DriverDetailDto>();

  @override
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<SeasonConstructorSummaryDto>>();

  @override
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<ConstructorDetailDto>();

  @override
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<List<CircuitDto>>();

  @override
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<CircuitDetailDto>();

  @override
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _fail<ContentManifestDto>();
}
