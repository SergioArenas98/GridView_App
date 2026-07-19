import 'dart:io';

import 'package:dio/dio.dart';

import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/api_response.dart';
import '../../../../core/api/errors/api_exception.dart';
import '../../../../core/api/errors/api_failure.dart';
import '../../../../core/api/errors/error_dto.dart';
import 'gridview_api.dart';

/// The production remote data source: talks to the GridView edge API over HTTPS
/// with Dio and the approved v1 envelope. It maps every transport and contract
/// error to a typed [ApiFailure] and never leaks a Dio type or raw server text.
class DioGridViewApi implements GridViewApi {
  const DioGridViewApi(this._dio);

  final Dio _dio;

  /// The contract version this client understands.
  static const String supportedApiVersion = '1';

  @override
  bool get usesMockData => false;

  @override
  Future<ApiResponse<HomeDataDto>> fetchHome({int? season}) {
    return _get<HomeDataDto>(
      '/v1/home',
      queryParameters: <String, dynamic>{
        'season': season?.toString() ?? 'current',
      },
      parse: (Object? data) => HomeDataDto.fromJson(_asMap(data)),
    );
  }

  @override
  Future<ApiResponse<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
  }) {
    return _get<GrandPrixDto>(
      '/v1/seasons/$season/grand-prix/$round',
      parse: (Object? data) => GrandPrixDto.fromJson(_asMap(data)),
    );
  }

  Future<ApiResponse<T>> _get<T>(
    String path, {
    required T Function(Object? data) parse,
    Map<String, dynamic>? queryParameters,
  }) async {
    final Response<dynamic> response;
    try {
      response = await _dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
      );
    } on DioException catch (e) {
      throw GridViewApiException(_mapDioError(e));
    }
    return _parseEnvelope<T>(response.data, parse);
  }

  ApiResponse<T> _parseEnvelope<T>(
    Object? body,
    T Function(Object? data) parse,
  ) {
    final ApiResponse<T> parsed;
    try {
      parsed = ApiResponse.parse<T>(_asMap(body), parse);
    } catch (_) {
      throw const GridViewApiException(
        ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
    }
    if (parsed.meta.apiVersion != supportedApiVersion) {
      throw GridViewApiException(
        ApiFailure(
          kind: ApiFailureKind.unsupportedApiVersion,
          requestId: parsed.meta.requestId,
        ),
      );
    }
    return parsed;
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
        return const ApiFailure(kind: ApiFailureKind.unknown);
      case DioExceptionType.badResponse:
        return _mapErrorResponse(e.response);
      case DioExceptionType.unknown:
        if (e.error is SocketException) {
          return const ApiFailure(
            kind: ApiFailureKind.networkUnavailable,
            retryable: true,
          );
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
    return _mapStatus(response?.statusCode);
  }

  ApiFailure _mapStatus(int? status) {
    return switch (status) {
      400 => const ApiFailure(kind: ApiFailureKind.invalidRequest),
      404 => const ApiFailure(kind: ApiFailureKind.notFound),
      429 => const ApiFailure(
        kind: ApiFailureKind.rateLimited,
        retryable: true,
      ),
      503 => const ApiFailure(
        kind: ApiFailureKind.serverUnavailable,
        retryable: true,
      ),
      _ => const ApiFailure(kind: ApiFailureKind.invalidResponse),
    };
  }

  Map<String, dynamic> _asMap(Object? value) => value as Map<String, dynamic>;
}
