import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'api_config.dart';

/// Builds the shared [Dio] client for the GridView API.
///
/// Applies the environment base URL, the TRD timeout budget, a correlation
/// request-id header, and development-only safe logging (method, path, status
/// and request id — never response bodies, keys or query values that could be
/// sensitive).
Dio buildGridViewDio(ApiConfig config, {bool enableSafeLogging = false}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: config.baseUrl,
      connectTimeout: config.connectTimeout,
      receiveTimeout: config.receiveTimeout,
      sendTimeout: config.sendTimeout,
      responseType: ResponseType.json,
      headers: <String, dynamic>{'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
        options.headers.putIfAbsent('X-Request-Id', _generateRequestId);
        handler.next(options);
      },
    ),
  );

  if (enableSafeLogging) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onResponse: (Response<dynamic> r, ResponseInterceptorHandler handler) {
          debugPrint(
            'GridViewApi <- ${r.statusCode} ${r.requestOptions.method} '
            '${r.requestOptions.path}',
          );
          handler.next(r);
        },
        onError: (DioException e, ErrorInterceptorHandler handler) {
          debugPrint(
            'GridViewApi !! ${e.type.name} ${e.requestOptions.method} '
            '${e.requestOptions.path} (${e.response?.statusCode ?? '-'})',
          );
          handler.next(e);
        },
      ),
    );
  }

  return dio;
}

final Random _random = Random();

String _generateRequestId() {
  final int now = DateTime.now().toUtc().microsecondsSinceEpoch;
  final int noise = _random.nextInt(1 << 32);
  return 'gv-${now.toRadixString(16)}-${noise.toRadixString(16)}';
}
