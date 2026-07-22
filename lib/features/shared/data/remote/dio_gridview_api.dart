import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';

import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/result_dto.dart';
import '../../../../core/api/dto/season_dto.dart';
import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/api_response.dart';
import '../../../../core/api/errors/api_failure.dart';
import '../../../../core/api/errors/error_dto.dart';
import 'gridview_api.dart';
import 'remote_cancellation.dart';
import 'remote_result.dart';
import 'snapshot_contract.dart';

/// The production remote data source: talks to the GridView edge API over HTTPS
/// with Dio and the approved v1 envelope. It issues conditional (`If-None-Match`)
/// reads, treats `304` as a first-class [RemoteNotModified] success, and maps
/// every transport and contract error to a typed [ApiFailure]. It never leaks a
/// Dio type or raw server text, and never sends an admin credential.
class DioGridViewApi implements GridViewApi {
  const DioGridViewApi(this._dio);

  final Dio _dio;

  /// The contract version this client understands.
  static const String supportedApiVersion = '1';

  @override
  bool get usesMockData => false;

  // --- Health -------------------------------------------------------------

  @override
  Future<RemoteResult<StatusDataDto>> fetchStatus({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<StatusDataDto>(
    '/v1/status',
    parse: (Object? d) => StatusDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
    requireSnapshot: false,
  );

  // --- Aggregate ----------------------------------------------------------

  @override
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<BootstrapDataDto>(
    '/v1/bootstrap',
    queryParameters: _seasonQuery(season),
    parse: (Object? d) => BootstrapDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<HomeDataDto>(
    '/v1/home',
    queryParameters: _seasonQuery(season),
    parse: (Object? d) => HomeDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Seasons ------------------------------------------------------------

  @override
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<SeasonDto>(
    '/v1/seasons/current',
    parse: (Object? d) => SeasonDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<SeasonDto>(
    '/v1/seasons/$season',
    parse: (Object? d) => SeasonDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Calendar -----------------------------------------------------------

  @override
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<GrandPrixSummaryDto>>(
    '/v1/seasons/$season/calendar',
    parse: (Object? d) =>
        _list(d, (Map<String, dynamic> e) => GrandPrixSummaryDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<GrandPrixDto>(
    '/v1/seasons/$season/grand-prix/$round',
    parse: (Object? d) => GrandPrixDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<RaceResultDto>(
    '/v1/seasons/$season/grand-prix/$round/results',
    parse: (Object? d) => RaceResultDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Standings ----------------------------------------------------------

  @override
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<DriverStandingDto>>(
    '/v1/seasons/$season/standings/drivers',
    parse: (Object? d) =>
        _list(d, (Map<String, dynamic> e) => DriverStandingDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<ConstructorStandingDto>>(
    '/v1/seasons/$season/standings/constructors',
    parse: (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => ConstructorStandingDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Drivers ------------------------------------------------------------

  @override
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<SeasonDriverSummaryDto>>(
    '/v1/seasons/$season/drivers',
    parse: (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => SeasonDriverSummaryDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<DriverDetailDto>(
    '/v1/drivers/$driverId',
    queryParameters: _seasonQuery(season),
    parse: (Object? d) => DriverDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Constructors -------------------------------------------------------

  @override
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<SeasonConstructorSummaryDto>>(
    '/v1/seasons/$season/constructors',
    parse: (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => SeasonConstructorSummaryDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<ConstructorDetailDto>(
    '/v1/constructors/$constructorId',
    queryParameters: _seasonQuery(season),
    parse: (Object? d) => ConstructorDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Circuits -----------------------------------------------------------

  @override
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<List<CircuitDto>>(
    '/v1/seasons/$season/circuits',
    parse: (Object? d) =>
        _list(d, (Map<String, dynamic> e) => CircuitDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<CircuitDetailDto>(
    '/v1/circuits/$circuitId',
    queryParameters: _seasonQuery(season),
    parse: (Object? d) => CircuitDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Content ------------------------------------------------------------

  @override
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _get<ContentManifestDto>(
    '/v1/content/manifest',
    parse: (Object? d) => ContentManifestDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Core conditional GET ----------------------------------------------

  Future<RemoteResult<T>> _get<T>(
    String path, {
    required T Function(Object? data) parse,
    Map<String, dynamic>? queryParameters,
    String? etag,
    RemoteCancellation? cancellation,
    bool requireSnapshot = true,
  }) async {
    final CancelToken cancelToken = CancelToken();
    if (cancellation != null) {
      if (cancellation.isCancelled) {
        cancelToken.cancel();
      } else {
        unawaited(
          cancellation.whenCancelled.then((_) {
            if (!cancelToken.isCancelled) cancelToken.cancel();
          }),
        );
      }
    }

    final Response<dynamic> response;
    try {
      response = await _dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
        cancelToken: cancelToken,
        options: Options(
          headers: etag == null
              ? null
              : <String, dynamic>{'If-None-Match': etag},
          // Accept 304 as a success so Dio does not raise it as an error; 4xx/5xx
          // still throw and are mapped to typed failures below.
          validateStatus: (int? s) =>
              s != null &&
              (s == HttpStatus.notModified || (s >= 200 && s < 300)),
        ),
      );
    } on DioException catch (e) {
      return RemoteFailure<T>(_mapDioError(e));
    }

    final String? responseEtag = _headerValue(response, HttpHeaders.etagHeader);
    final String? requestId = _headerValue(response, 'x-request-id');

    if (response.statusCode == HttpStatus.notModified) {
      return RemoteNotModified<T>(
        etag: responseEtag ?? etag,
        requestId: requestId,
      );
    }

    return _parseEnvelope<T>(
      response.data,
      parse,
      etag: responseEtag,
      requestId: requestId,
      requireSnapshot: requireSnapshot,
    );
  }

  RemoteResult<T> _parseEnvelope<T>(
    Object? body,
    T Function(Object? data) parse, {
    required String? etag,
    required String? requestId,
    required bool requireSnapshot,
  }) {
    final ApiResponse<T> parsed;
    try {
      parsed = ApiResponse.parse<T>(_asMap(body), parse);
    } catch (_) {
      return RemoteFailure<T>(
        ApiFailure(kind: ApiFailureKind.invalidResponse, requestId: requestId),
      );
    }
    if (parsed.meta.apiVersion != supportedApiVersion) {
      return RemoteFailure<T>(
        ApiFailure(
          kind: ApiFailureKind.unsupportedApiVersion,
          requestId: requestId ?? parsed.meta.requestId,
        ),
      );
    }
    if (requireSnapshot && !snapshotMetaIsValid(parsed.meta)) {
      // A snapshot response missing sourceUpdatedAt is contract-invalid; reject
      // before it can reach the conflict rule or the database.
      return RemoteFailure<T>(
        ApiFailure(
          kind: ApiFailureKind.invalidResponse,
          requestId: requestId ?? parsed.meta.requestId,
        ),
      );
    }
    return RemoteModified<T>(
      data: parsed.data,
      meta: parsed.meta,
      etag: etag,
      requestId: requestId ?? parsed.meta.requestId,
    );
  }

  ApiFailure _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiFailure(
          kind: ApiFailureKind.networkTimeout,
          retryable: true,
        );
      case DioExceptionType.connectionError:
        return const ApiFailure(
          kind: ApiFailureKind.networkUnavailable,
          retryable: true,
        );
      case DioExceptionType.badCertificate:
        return const ApiFailure(kind: ApiFailureKind.networkUnavailable);
      case DioExceptionType.cancel:
        return const ApiFailure(kind: ApiFailureKind.cancelled);
      case DioExceptionType.badResponse:
        return _mapErrorResponse(e.response);
      case DioExceptionType.unknown:
        if (e.error is SocketException) {
          return const ApiFailure(
            kind: ApiFailureKind.networkUnavailable,
            retryable: true,
          );
        }
        if (e.error is FormatException) {
          // A malformed (non-JSON) body failed to decode.
          return const ApiFailure(kind: ApiFailureKind.invalidResponse);
        }
        return const ApiFailure(kind: ApiFailureKind.unknown);
    }
  }

  ApiFailure _mapErrorResponse(Response<dynamic>? response) {
    final Object? data = response?.data;
    if (data is Map<String, dynamic> && data['error'] is Map<String, dynamic>) {
      try {
        return ApiFailure.fromError(
          ErrorDto.fromJson(data['error'] as Map<String, dynamic>),
        );
      } catch (_) {
        // Fall through to status-based mapping.
      }
    }
    return _mapStatus(
      response?.statusCode,
      requestId: response == null
          ? null
          : _headerValue(response, 'x-request-id'),
    );
  }

  ApiFailure _mapStatus(int? status, {String? requestId}) {
    return switch (status) {
      400 => ApiFailure(
        kind: ApiFailureKind.invalidRequest,
        requestId: requestId,
      ),
      404 => ApiFailure(kind: ApiFailureKind.notFound, requestId: requestId),
      429 => ApiFailure(
        kind: ApiFailureKind.rateLimited,
        retryable: true,
        requestId: requestId,
      ),
      503 => ApiFailure(
        kind: ApiFailureKind.serverUnavailable,
        retryable: true,
        requestId: requestId,
      ),
      _ => ApiFailure(
        kind: ApiFailureKind.invalidResponse,
        requestId: requestId,
      ),
    };
  }

  /// The optional `season` query (year or the literal `current`). Always sent
  /// for `SeasonQuery` endpoints so the server never has to infer the default.
  static Map<String, dynamic> _seasonQuery(int? season) => <String, dynamic>{
    'season': season?.toString() ?? 'current',
  };

  static List<D> _list<D>(
    Object? data,
    D Function(Map<String, dynamic> element) fromJson,
  ) {
    final List<dynamic> items = data! as List<dynamic>;
    return items
        .map((Object? e) => fromJson(e! as Map<String, dynamic>))
        .toList(growable: false);
  }

  static String? _headerValue(Response<dynamic> response, String name) =>
      response.headers.value(name);

  Map<String, dynamic> _asMap(Object? value) => value! as Map<String, dynamic>;
}
