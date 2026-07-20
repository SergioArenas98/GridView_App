import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/envelope/meta_dto.dart';
import 'package:gridview/core/api/errors/api_exception.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/snapshot_contract.dart';
import 'package:gridview/features/shared/data/repositories/race_weekend_repository_impl.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';

import '../../support/fixtures.dart';

class _MutableAdapter implements HttpClientAdapter {
  Map<String, dynamic> body = <String, dynamic>{};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode(body),
    200,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

MetaDto _meta({String? sourceUpdatedAt}) => MetaDto(
  apiVersion: '1',
  generatedAt: '2026-07-18T12:00:00Z',
  requestId: 'req-1',
  sourceUpdatedAt: sourceUpdatedAt,
);

void main() {
  group('requireSnapshotMeta', () {
    test('passes when sourceUpdatedAt is present', () {
      expect(
        () =>
            requireSnapshotMeta(_meta(sourceUpdatedAt: '2026-07-18T11:55:00Z')),
        returnsNormally,
      );
    });

    test('throws invalidResponse when sourceUpdatedAt is missing', () {
      expect(
        () => requireSnapshotMeta(_meta()),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.invalidResponse,
          ),
        ),
      );
    });
  });

  test(
    'DioGridViewApi rejects a snapshot whose meta omits sourceUpdatedAt',
    () async {
      final _MutableAdapter adapter = _MutableAdapter();
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = adapter;
      final Map<String, dynamic> body = loadFixture('home/pre-event.json');
      (body['meta'] as Map<String, dynamic>).remove('sourceUpdatedAt');
      adapter.body = body;

      await expectLater(
        DioGridViewApi(dio).fetchHome(),
        throwsA(
          isA<GridViewApiException>().having(
            (GridViewApiException e) => e.failure.kind,
            'kind',
            ApiFailureKind.invalidResponse,
          ),
        ),
      );
    },
  );

  test(
    'a missing-source refresh fails and never touches cached rows',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      final _MutableAdapter adapter = _MutableAdapter();
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = adapter;
      final RaceWeekendRepository repo = RaceWeekendRepositoryImpl(
        remote: DioGridViewApi(dio),
        local: db.verticalSliceDao,
      );

      // Seed a valid Home snapshot.
      adapter.body = loadFixture('home/pre-event.json');
      expect(await repo.refreshHome(), isA<RefreshSuccess>());
      final before = await repo.watchHome().first;
      expect(before, isNotNull);

      // Now serve a contract-invalid response (meta without sourceUpdatedAt).
      final Map<String, dynamic> invalid = loadFixture('home/pre-event.json');
      (invalid['meta'] as Map<String, dynamic>).remove('sourceUpdatedAt');
      adapter.body = invalid;

      final RefreshResult result = await repo.refreshHome();
      expect(result, isA<RefreshFailure>());
      expect(
        (result as RefreshFailure).failure.kind,
        ApiFailureKind.invalidResponse,
      );

      // Cached content is unchanged and still available.
      final after = await repo.watchHome().first;
      expect(after, isNotNull);
      expect(after!.featured.id, before!.featured.id);
      expect(after.freshness.sourceUpdatedAt, before.freshness.sourceUpdatedAt);
    },
  );
}
