import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_exception.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';

import '../../support/fixtures.dart';

/// A Dio adapter that returns canned responses / errors, so the client is
/// exercised end to end with no live network.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

Dio _dioReturning(Map<String, dynamic> body, {int status = 200}) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = _FakeAdapter(
    (RequestOptions options) async => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    ),
  );
  return dio;
}

Dio _dioThrowing(DioExceptionType type, {Object? error}) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = _FakeAdapter(
    (RequestOptions options) async =>
        throw DioException(requestOptions: options, type: type, error: error),
  );
  return dio;
}

void main() {
  group('DioGridViewApi success', () {
    test('fetchHome parses the envelope and featured event', () async {
      final api = DioGridViewApi(
        _dioReturning(loadFixture('home/pre-event.json')),
      );
      final response = await api.fetchHome();
      expect(response.meta.season, 2026);
      expect(response.data.featuredEvent?.round, 13);
      expect(response.data.freshness.contentVersion, '2026.07.18.1');
    });

    test('fetchGrandPrix parses the full session list', () async {
      final api = DioGridViewApi(
        _dioReturning(loadFixture('grand-prix/standard-weekend.json')),
      );
      final response = await api.fetchGrandPrix(season: 2026, round: 12);
      expect(response.data.round, 12);
      expect(response.data.sessions, hasLength(5));
    });

    test('never claims to use mock data', () {
      expect(
        DioGridViewApi(
          _dioReturning(loadFixture('home/pre-event.json')),
        ).usesMockData,
        isFalse,
      );
    });
  });

  group('DioGridViewApi typed failures', () {
    test('connection error -> networkUnavailable', () async {
      final api = DioGridViewApi(
        _dioThrowing(DioExceptionType.connectionError),
      );
      await expectLater(
        api.fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.networkUnavailable,
          ),
        ),
      );
    });

    test('receive timeout -> networkTimeout', () async {
      final api = DioGridViewApi(_dioThrowing(DioExceptionType.receiveTimeout));
      await expectLater(
        api.fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.networkTimeout,
          ),
        ),
      );
    });

    test('malformed body -> invalidResponse', () async {
      final api = DioGridViewApi(
        _dioReturning(<String, dynamic>{'unexpected': true}),
      );
      await expectLater(
        api.fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.invalidResponse,
          ),
        ),
      );
    });

    test('server error envelope -> serverUnavailable', () async {
      final api = DioGridViewApi(
        _dioReturning(
          loadFixture('errors/upstream-unavailable.json'),
          status: 503,
        ),
      );
      await expectLater(
        api.fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.serverUnavailable,
          ),
        ),
      );
    });

    test('unsupported api version -> unsupportedApiVersion', () async {
      final Map<String, dynamic> body = loadFixture('home/pre-event.json');
      (body['meta'] as Map<String, dynamic>)['apiVersion'] = '2';
      final api = DioGridViewApi(_dioReturning(body));
      await expectLater(
        api.fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.unsupportedApiVersion,
          ),
        ),
      );
    });

    test('404 without an error envelope -> notFound', () async {
      // A 404 badResponse whose body is not a GridView error envelope maps by
      // status code.
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
      dio.httpClientAdapter = _FakeAdapter(
        (RequestOptions options) async => ResponseBody.fromString('{}', 404),
      );
      final api404 = DioGridViewApi(dio);
      await expectLater(
        api404.fetchGrandPrix(season: 2026, round: 99),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.notFound,
          ),
        ),
      );
    });
  });
}
