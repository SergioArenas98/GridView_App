import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/api_response.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import 'fixtures.dart';

/// A base [GridViewApi] fake whose every endpoint returns a `notFound` failure
/// by default. Test fakes extend this and override only the endpoints they need,
/// so no live transport is ever used.
abstract class BaseFakeGridViewApi implements GridViewApi {
  @override
  bool get usesMockData => false;

  RemoteResult<T> notFound<T>() =>
      RemoteFailure<T>(const ApiFailure(kind: ApiFailureKind.notFound));

  @override
  Future<RemoteResult<StatusDataDto>> fetchStatus({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<StatusDataDto>();

  @override
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<BootstrapDataDto>();

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<HomeDataDto>();

  @override
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<SeasonDto>();

  @override
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<SeasonDto>();

  @override
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<GrandPrixSummaryDto>>();

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<GrandPrixDto>();

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<RaceResultDto>();

  @override
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<DriverStandingDto>>();

  @override
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<ConstructorStandingDto>>();

  @override
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<SeasonDriverSummaryDto>>();

  @override
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<DriverDetailDto>();

  @override
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<SeasonConstructorSummaryDto>>();

  @override
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<ConstructorDetailDto>();

  @override
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<List<CircuitDto>>();

  @override
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<CircuitDetailDto>();

  @override
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => notFound<ContentManifestDto>();
}

/// A programmable Home/Grand Prix [GridViewApi] fake for
/// provider/controller/widget tests. No live transport; each response and
/// failure is scripted.
class FakeGridViewApi extends BaseFakeGridViewApi {
  RemoteResult<HomeDataDto> Function()? home;
  RemoteResult<GrandPrixDto> Function()? grandPrix;
  ApiFailure? homeFailure;
  ApiFailure? grandPrixFailure;
  int homeCalls = 0;
  int grandPrixCalls = 0;

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async {
    homeCalls++;
    if (homeFailure != null) return RemoteFailure<HomeDataDto>(homeFailure!);
    return (home ?? homeResponseFixture)();
  }

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async {
    grandPrixCalls++;
    if (grandPrixFailure != null) {
      return RemoteFailure<GrandPrixDto>(grandPrixFailure!);
    }
    return (grandPrix ?? grandPrixResponseFixture)();
  }
}

RemoteResult<HomeDataDto> homeResponseFixture({
  String generatedAt = '2026-07-18T12:00:00Z',
  String? staleAfter = '2026-07-18T12:15:00Z',
  bool stale = false,
}) {
  final Map<String, dynamic> json = loadFixture('home/pre-event.json');
  final Map<String, dynamic> freshness =
      (json['data'] as Map<String, dynamic>)['freshness']
          as Map<String, dynamic>;
  freshness['generatedAt'] = generatedAt;
  freshness['staleAfter'] = staleAfter;
  freshness['stale'] = stale;
  (json['meta'] as Map<String, dynamic>)['generatedAt'] = generatedAt;
  final ApiResponse<HomeDataDto> parsed = ApiResponse.parse<HomeDataDto>(
    json,
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  );
  return RemoteModified<HomeDataDto>(
    data: parsed.data,
    meta: parsed.meta,
    etag: 'W/"home-$generatedAt"',
    requestId: parsed.meta.requestId,
  );
}

RemoteResult<GrandPrixDto> grandPrixResponseFixture({
  String fixture = 'grand-prix/sprint-weekend.json',
}) {
  final Map<String, dynamic> json = loadFixture(fixture);
  final ApiResponse<GrandPrixDto> parsed = ApiResponse.parse<GrandPrixDto>(
    json,
    (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
  );
  return RemoteModified<GrandPrixDto>(
    data: parsed.data,
    meta: parsed.meta,
    etag: 'W/"gp-${parsed.data.id}"',
    requestId: parsed.meta.requestId,
  );
}
