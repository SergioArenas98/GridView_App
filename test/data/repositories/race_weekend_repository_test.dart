import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/api_response.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/data/repositories/race_weekend_repository_impl.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';

import '../../support/fake_api.dart';
import '../../support/fixtures.dart';

RemoteResult<HomeDataDto> _homeResponse({
  String generatedAt = '2026-07-18T12:00:00Z',
  String sourceUpdatedAt = '2026-07-18T11:55:00Z',
  String? staleAfter = '2026-07-18T12:15:00Z',
  bool stale = false,
}) {
  final Map<String, dynamic> json = loadFixture('home/pre-event.json');
  final Map<String, dynamic> freshness =
      (json['data'] as Map<String, dynamic>)['freshness']
          as Map<String, dynamic>;
  freshness['generatedAt'] = generatedAt;
  freshness['sourceUpdatedAt'] = sourceUpdatedAt;
  freshness['staleAfter'] = staleAfter;
  freshness['stale'] = stale;
  final Map<String, dynamic> meta = json['meta'] as Map<String, dynamic>;
  meta['generatedAt'] = generatedAt;
  meta['sourceUpdatedAt'] = sourceUpdatedAt;
  final ApiResponse<HomeDataDto> parsed = ApiResponse.parse<HomeDataDto>(
    json,
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  );
  return RemoteModified<HomeDataDto>(
    data: parsed.data,
    meta: parsed.meta,
    etag: 'W/"home-$sourceUpdatedAt"',
    requestId: parsed.meta.requestId,
  );
}

RemoteResult<GrandPrixDto> _grandPrixResponse({
  String fixture = 'grand-prix/standard-weekend.json',
  String generatedAt = '2026-07-18T12:00:00Z',
}) {
  final Map<String, dynamic> json = loadFixture(fixture);
  (json['meta'] as Map<String, dynamic>)['generatedAt'] = generatedAt;
  final ApiResponse<GrandPrixDto> parsed = ApiResponse.parse<GrandPrixDto>(
    json,
    (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
  );
  return RemoteModified<GrandPrixDto>(
    data: parsed.data,
    meta: parsed.meta,
    etag: 'W/"gp"',
    requestId: parsed.meta.requestId,
  );
}

void main() {
  late GridViewDatabase db;
  late FakeGridViewApi api;
  late RaceWeekendRepository repo;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = FakeGridViewApi();
    repo = RaceWeekendRepositoryImpl(remote: api, local: db.verticalSliceDao);
  });

  tearDown(() => db.close());

  group('refreshHome', () {
    test(
      'empty database + successful refresh caches and streams the view',
      () async {
        expect(await repo.watchHome().first, isNull);

        api.home = _homeResponse;
        final RefreshResult result = await repo.refreshHome();

        expect(result, isA<RefreshSuccess>());
        expect((result as RefreshSuccess).applied, isTrue);

        final HomeView? view = await repo.watchHome().first;
        expect(view, isNotNull);
        expect(view!.featured.id, '2026-belgian-grand-prix');
        expect(view.featured.sessions, isNotEmpty);
        expect(view.freshness.staleAfter, isNotNull);
      },
    );

    test('network failure with existing cache keeps the cached data', () async {
      api.home = _homeResponse;
      await repo.refreshHome();

      api.homeFailure = const ApiFailure(
        kind: ApiFailureKind.networkUnavailable,
      );
      final RefreshResult result = await repo.refreshHome();

      expect(result, isA<RefreshFailure>());
      expect(
        (result as RefreshFailure).failure.kind,
        ApiFailureKind.networkUnavailable,
      );
      // Cache preserved.
      expect(await repo.watchHome().first, isNotNull);
    });

    test(
      'network failure with no cache surfaces the failure and no data',
      () async {
        api.homeFailure = const ApiFailure(kind: ApiFailureKind.networkTimeout);
        final RefreshResult result = await repo.refreshHome();

        expect(result, isA<RefreshFailure>());
        expect(await repo.watchHome().first, isNull);
      },
    );

    test(
      'an invalid remote response (no featured event) fails cleanly',
      () async {
        api.home = () {
          final Map<String, dynamic> json = loadFixture('home/pre-event.json');
          (json['data'] as Map<String, dynamic>).remove('featuredEvent');
          final ApiResponse<HomeDataDto> parsed =
              ApiResponse.parse<HomeDataDto>(
                json,
                (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
              );
          return RemoteModified<HomeDataDto>(
            data: parsed.data,
            meta: parsed.meta,
          );
        };
        final RefreshResult result = await repo.refreshHome();
        expect(result, isA<RefreshFailure>());
        expect(
          (result as RefreshFailure).failure.kind,
          ApiFailureKind.invalidResponse,
        );
      },
    );

    test('a 304 not-modified is a successful, non-applied refresh', () async {
      api.home = _homeResponse;
      await repo.refreshHome();

      api.home = () => const RemoteNotModified<HomeDataDto>(etag: 'W/"x"');
      final RefreshResult result = await repo.refreshHome();
      expect(result, isA<RefreshSuccess>());
      expect((result as RefreshSuccess).applied, isFalse);
      // Cache preserved.
      expect(await repo.watchHome().first, isNotNull);
    });

    test('a snapshot with newer source data updates the cache', () async {
      api.home = () => _homeResponse(sourceUpdatedAt: '2026-07-18T11:55:00Z');
      await repo.refreshHome();

      api.home = () => _homeResponse(
        sourceUpdatedAt: '2026-07-18T17:55:00Z', // newer source
        generatedAt: '2026-07-18T18:00:00Z',
      );
      final RefreshResult result = await repo.refreshHome();

      expect((result as RefreshSuccess).applied, isTrue);
      final HomeView view = (await repo.watchHome().first)!;
      expect(view.freshness.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 17, 55));
    });

    test(
      'a later-generated snapshot with older source data is rejected',
      () async {
        api.home = () => _homeResponse(
          sourceUpdatedAt: '2026-07-18T17:55:00Z',
          generatedAt: '2026-07-18T18:00:00Z',
        );
        await repo.refreshHome();

        // Generated later, but the source data is older — must NOT overwrite.
        api.home = () => _homeResponse(
          sourceUpdatedAt: '2026-07-18T06:00:00Z',
          generatedAt: '2026-07-18T19:00:00Z',
        );
        final RefreshResult result = await repo.refreshHome();

        expect(result, isA<RefreshSuccess>());
        expect((result as RefreshSuccess).applied, isFalse);
        final HomeView view = (await repo.watchHome().first)!;
        expect(
          view.freshness.sourceUpdatedAt,
          DateTime.utc(2026, 7, 18, 17, 55),
          reason: 'newer cached source data preserved',
        );
      },
    );

    test('a failed refresh never erases valid cached data', () async {
      api.home = _homeResponse;
      await repo.refreshHome();
      final HomeView before = (await repo.watchHome().first)!;

      api.homeFailure = const ApiFailure(
        kind: ApiFailureKind.serverUnavailable,
      );
      await repo.refreshHome();

      final HomeView after = (await repo.watchHome().first)!;
      expect(after.featured.id, before.featured.id);
    });
  });

  group('refreshGrandPrix', () {
    test('detail lookup caches and streams the ordered sessions', () async {
      expect(await repo.watchGrandPrix(season: 2026, round: 12).first, isNull);

      api.grandPrix = _grandPrixResponse;
      final RefreshResult result = await repo.refreshGrandPrix(
        season: 2026,
        round: 12,
      );

      expect(result, isA<RefreshSuccess>());
      final GrandPrixDetailView? view = await repo
          .watchGrandPrix(season: 2026, round: 12)
          .first;
      expect(view, isNotNull);
      expect(view!.grandPrix.sessions, hasLength(5));
      expect(view.grandPrix.sessions.last.type, SessionType.race);
    });

    test(
      'a missing Grand Prix surfaces notFound and no cached detail',
      () async {
        api.grandPrixFailure = const ApiFailure(kind: ApiFailureKind.notFound);
        final RefreshResult result = await repo.refreshGrandPrix(
          season: 2026,
          round: 99,
        );

        expect(result, isA<RefreshFailure>());
        expect(
          (result as RefreshFailure).failure.kind,
          ApiFailureKind.notFound,
        );
        expect(
          await repo.watchGrandPrix(season: 2026, round: 99).first,
          isNull,
        );
      },
    );
  });
}
