import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import '../../support/fixtures.dart';

/// A Dio adapter that records the last request and returns a scripted response
/// (or error), so the client is exercised end to end with no live network.
class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter(this.responder);

  final Future<ResponseBody> Function(RequestOptions options) responder;
  RequestOptions? last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    last = options;
    return responder(options);
  }

  @override
  void close({bool force = false}) {}
}

/// An adapter that never returns on its own — it only ends when the request's
/// `CancelToken` is cancelled (dio passes `cancelToken.whenCancel` as
/// `cancelFuture`), then reports a cancel. Used to prove in-flight cancellation.
class _CancelAwareAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    await cancelFuture;
    throw DioException(requestOptions: options, type: DioExceptionType.cancel);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(
  Object body, {
  int status = 200,
  String? etag,
  String? requestId,
}) {
  final Map<String, List<String>> headers = <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    if (etag != null) 'etag': <String>[etag],
    if (requestId != null) 'x-request-id': <String>[requestId],
  };
  return ResponseBody.fromString(
    body is String ? body : jsonEncode(body),
    status,
    headers: headers,
  );
}

({DioGridViewApi api, _RecordingAdapter adapter}) _apiWith(
  Future<ResponseBody> Function(RequestOptions options) responder,
) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  final _RecordingAdapter adapter = _RecordingAdapter(responder);
  dio.httpClientAdapter = adapter;
  return (api: DioGridViewApi(dio), adapter: adapter);
}

DioGridViewApi _throwing(DioExceptionType type, {Object? error}) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = _RecordingAdapter(
    (RequestOptions options) async =>
        throw DioException(requestOptions: options, type: type, error: error),
  );
  return DioGridViewApi(dio);
}

void main() {
  group('path and query construction', () {
    late _RecordingAdapter adapter;
    late DioGridViewApi api;

    setUp(() {
      final r = _apiWith(
        (RequestOptions o) async => _json(loadFixture('home/pre-event.json')),
      );
      api = r.api;
      adapter = r.adapter;
    });

    test('every endpoint builds the OpenAPI path and query', () async {
      await api.fetchStatus();
      expect(adapter.last!.path, '/v1/status');
      expect(adapter.last!.headers.containsKey('If-None-Match'), isFalse);

      await api.fetchBootstrap(season: 2026);
      expect(adapter.last!.path, '/v1/bootstrap');
      expect(adapter.last!.queryParameters, <String, dynamic>{
        'season': '2026',
      });

      await api.fetchBootstrap();
      expect(adapter.last!.queryParameters, <String, dynamic>{
        'season': 'current',
      });

      await api.fetchHome(season: 2026);
      expect(adapter.last!.path, '/v1/home');
      expect(adapter.last!.queryParameters, <String, dynamic>{
        'season': '2026',
      });

      await api.fetchCurrentSeason();
      expect(adapter.last!.path, '/v1/seasons/current');

      await api.fetchSeason(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026');

      await api.fetchCalendar(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/calendar');

      await api.fetchGrandPrix(season: 2026, round: 13);
      expect(adapter.last!.path, '/v1/seasons/2026/grand-prix/13');

      await api.fetchGrandPrixResults(season: 2026, round: 13);
      expect(adapter.last!.path, '/v1/seasons/2026/grand-prix/13/results');

      await api.fetchDriverStandings(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/standings/drivers');

      await api.fetchConstructorStandings(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/standings/constructors');

      await api.fetchSeasonDrivers(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/drivers');

      await api.fetchDriver(driverId: 'max-verstappen', season: 2026);
      expect(adapter.last!.path, '/v1/drivers/max-verstappen');
      expect(adapter.last!.queryParameters, <String, dynamic>{
        'season': '2026',
      });

      await api.fetchSeasonConstructors(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/constructors');

      await api.fetchConstructor(constructorId: 'ferrari', season: 2026);
      expect(adapter.last!.path, '/v1/constructors/ferrari');

      await api.fetchSeasonCircuits(season: 2026);
      expect(adapter.last!.path, '/v1/seasons/2026/circuits');

      await api.fetchCircuit(circuitId: 'spa-francorchamps', season: 2026);
      expect(adapter.last!.path, '/v1/circuits/spa-francorchamps');

      await api.fetchContentManifest();
      expect(adapter.last!.path, '/v1/content/manifest');
    });

    test('If-None-Match is sent only when an ETag is supplied', () async {
      await api.fetchHome();
      expect(adapter.last!.headers.containsKey('If-None-Match'), isFalse);

      await api.fetchHome(etag: 'W/"abc"');
      expect(adapter.last!.headers['If-None-Match'], 'W/"abc"');
    });

    test('no Authorization or admin header is ever sent', () async {
      await api.fetchHome(etag: 'W/"abc"');
      final Map<String, dynamic> headers = adapter.last!.headers;
      expect(
        headers.keys.map((String k) => k.toLowerCase()),
        isNot(contains('authorization')),
      );
      expect(
        headers.keys.any((String k) => k.toLowerCase().contains('token')),
        isFalse,
      );
    });
  });

  group('conditional responses', () {
    test(
      '200 yields RemoteModified with data, meta, ETag and request id',
      () async {
        final r = _apiWith(
          (RequestOptions o) async => _json(
            loadFixture('home/pre-event.json'),
            etag: 'W/"gv1-home"',
            requestId: 'req-42',
          ),
        );
        final RemoteResult<Object?> result = await r.api.fetchHome();
        expect(result, isA<RemoteModified<Object?>>());
        final modified = result as RemoteModified;
        expect(modified.etag, 'W/"gv1-home"');
        expect(modified.requestId, 'req-42');
        expect(modified.meta.season, 2026);
      },
    );

    test(
      '304 yields RemoteNotModified with the ETag and no body parse',
      () async {
        final r = _apiWith(
          (RequestOptions o) async =>
              _json('', status: 304, etag: 'W/"unchanged"', requestId: 'req-7'),
        );
        final RemoteResult<Object?> result = await r.api.fetchHome(
          etag: 'W/"unchanged"',
        );
        expect(result, isA<RemoteNotModified<Object?>>());
        final notModified = result as RemoteNotModified;
        expect(notModified.etag, 'W/"unchanged"');
        expect(notModified.requestId, 'req-7');
      },
    );

    test(
      'a 304 with an empty body and no ETag header keeps the sent ETag',
      () async {
        final r = _apiWith(
          (RequestOptions o) async => ResponseBody.fromString('', 304),
        );
        final RemoteResult<Object?> result = await r.api.fetchGrandPrix(
          season: 2026,
          round: 13,
          etag: 'W/"kept"',
        );
        expect(result, isA<RemoteNotModified<Object?>>());
        expect((result as RemoteNotModified).etag, 'W/"kept"');
      },
    );
  });

  group('typed failures (returned, not thrown)', () {
    Future<ApiFailure> failureOf(RemoteResult<Object?> r) async {
      expect(r, isA<RemoteFailure<Object?>>());
      return (r as RemoteFailure).failure;
    }

    test('connection error -> networkUnavailable', () async {
      final f = await failureOf(
        await _throwing(DioExceptionType.connectionError).fetchHome(),
      );
      expect(f.kind, ApiFailureKind.networkUnavailable);
    });

    test('receive timeout -> networkTimeout', () async {
      final f = await failureOf(
        await _throwing(DioExceptionType.receiveTimeout).fetchHome(),
      );
      expect(f.kind, ApiFailureKind.networkTimeout);
    });

    test('a pre-cancelled request -> cancelled', () async {
      final r = _apiWith(
        (RequestOptions o) async => _json(loadFixture('home/pre-event.json')),
      );
      final RemoteCancellation cancellation = RemoteCancellation()..cancel();
      final f = await failureOf(
        await r.api.fetchHome(cancellation: cancellation),
      );
      expect(f.kind, ApiFailureKind.cancelled);
    });

    test('cancelling an in-flight request -> cancelled', () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = _CancelAwareAdapter();
      final DioGridViewApi api = DioGridViewApi(dio);
      final RemoteCancellation cancellation = RemoteCancellation();
      final Future<RemoteResult<Object?>> pending = api.fetchHome(
        cancellation: cancellation,
      );
      // Let the request reach the adapter, then cancel it in flight.
      await Future<void>.delayed(Duration.zero);
      cancellation.cancel();
      final f = await failureOf(await pending);
      expect(f.kind, ApiFailureKind.cancelled);
    });

    test('404 error envelope -> notFound', () async {
      final r = _apiWith(
        (RequestOptions o) async =>
            _json(loadFixture('errors/season-not-found.json'), status: 404),
      );
      final f = await failureOf(
        await r.api.fetchGrandPrix(season: 2026, round: 99),
      );
      expect(f.kind, ApiFailureKind.notFound);
    });

    test('429 -> rateLimited (retryable)', () async {
      final r = _apiWith(
        (RequestOptions o) async => _json(<String, dynamic>{}, status: 429),
      );
      final f = await failureOf(await r.api.fetchHome());
      expect(f.kind, ApiFailureKind.rateLimited);
      expect(f.retryable, isTrue);
    });

    test('503 error envelope -> serverUnavailable', () async {
      final r = _apiWith(
        (RequestOptions o) async =>
            _json(loadFixture('errors/upstream-unavailable.json'), status: 503),
      );
      final f = await failureOf(await r.api.fetchHome());
      expect(f.kind, ApiFailureKind.serverUnavailable);
    });

    test('an invalid envelope (wrong shape) -> invalidResponse', () async {
      final r = _apiWith(
        (RequestOptions o) async =>
            _json(<String, dynamic>{'unexpected': true}),
      );
      final f = await failureOf(await r.api.fetchHome());
      expect(f.kind, ApiFailureKind.invalidResponse);
    });

    test('malformed JSON -> invalidResponse', () async {
      final r = _apiWith((RequestOptions o) async => _json('{not json'));
      final f = await failureOf(await r.api.fetchHome());
      expect(f.kind, ApiFailureKind.invalidResponse);
    });

    test('unsupported api version -> unsupportedApiVersion', () async {
      final Map<String, dynamic> body = loadFixture('home/pre-event.json');
      (body['meta'] as Map<String, dynamic>)['apiVersion'] = '2';
      final r = _apiWith((RequestOptions o) async => _json(body));
      final f = await failureOf(await r.api.fetchHome());
      expect(f.kind, ApiFailureKind.unsupportedApiVersion);
    });

    test(
      'a snapshot whose meta omits sourceUpdatedAt -> invalidResponse',
      () async {
        final Map<String, dynamic> body = loadFixture('home/pre-event.json');
        (body['meta'] as Map<String, dynamic>).remove('sourceUpdatedAt');
        final r = _apiWith((RequestOptions o) async => _json(body));
        final f = await failureOf(await r.api.fetchHome());
        expect(f.kind, ApiFailureKind.invalidResponse);
      },
    );

    test('status tolerates BaseMeta without sourceUpdatedAt', () async {
      final r = _apiWith(
        (RequestOptions o) async => _json(loadFixture('status/ok.json')),
      );
      final RemoteResult<Object?> result = await r.api.fetchStatus();
      expect(result, isA<RemoteModified<Object?>>());
    });
  });

  test('never claims to use mock data', () {
    final r = _apiWith(
      (RequestOptions o) async => _json(loadFixture('home/pre-event.json')),
    );
    expect(r.api.usesMockData, isFalse);
  });
}
