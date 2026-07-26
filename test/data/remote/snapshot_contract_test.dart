import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/envelope/meta_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/data/remote/snapshot_contract.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/home_repository.dart';

import '../../support/fixtures.dart';
import '../../support/repository_harness.dart';

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
  group('snapshotMetaIsValid', () {
    test('true when sourceUpdatedAt is present', () {
      expect(
        snapshotMetaIsValid(_meta(sourceUpdatedAt: '2026-07-18T11:55:00Z')),
        isTrue,
      );
    });

    test('false when sourceUpdatedAt is missing', () {
      expect(snapshotMetaIsValid(_meta()), isFalse);
    });
  });

  test(
    'DioGridViewApi returns invalidResponse when meta omits sourceUpdatedAt',
    () async {
      final _MutableAdapter adapter = _MutableAdapter();
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
        ..httpClientAdapter = adapter;
      final Map<String, dynamic> body = loadFixture('home/pre-event.json');
      (body['meta'] as Map<String, dynamic>).remove('sourceUpdatedAt');
      adapter.body = body;

      final RemoteResult<Object?> result = await DioGridViewApi(
        dio,
      ).fetchHome();
      expect(result, isA<RemoteFailure<Object?>>());
      expect(
        (result as RemoteFailure).failure.kind,
        ApiFailureKind.invalidResponse,
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
      final HomeRepository repo = RepositoryHarness(
        db,
        DioGridViewApi(dio),
      ).home;

      // Seed a valid Home snapshot.
      adapter.body = loadFixture('home/pre-event.json');
      expect(await repo.refreshHome(season: 2026), isA<RefreshSuccess>());
      final before = await repo.watchHome().first;
      expect(before, isNotNull);

      // Now serve a contract-invalid response (meta without sourceUpdatedAt).
      final Map<String, dynamic> invalid = loadFixture('home/pre-event.json');
      (invalid['meta'] as Map<String, dynamic>).remove('sourceUpdatedAt');
      adapter.body = invalid;

      final RefreshResult result = await repo.refreshHome(season: 2026);
      expect(result, isA<RefreshFailure>());
      expect(
        (result as RefreshFailure).failure.kind,
        ApiFailureKind.invalidResponse,
      );

      // Cached content is unchanged and still available.
      final after = await repo.watchHome().first;
      expect(after, isNotNull);
      expect(after!.featured!.id, before!.featured!.id);
      expect(after.freshness.sourceUpdatedAt, before.freshness.sourceUpdatedAt);
    },
  );
}
