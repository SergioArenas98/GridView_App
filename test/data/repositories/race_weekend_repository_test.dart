import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/api_response.dart';
import 'package:gridview/core/api/errors/api_exception.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/repositories/race_weekend_repository_impl.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';

import '../../support/fixtures.dart';

/// A programmable [GridViewApi] fake with no live transport.
class _FakeApi implements GridViewApi {
  ApiResponse<HomeDataDto> Function()? home;
  ApiResponse<GrandPrixDto> Function()? grandPrix;
  ApiFailure? homeFailure;
  ApiFailure? grandPrixFailure;

  @override
  bool get usesMockData => false;

  @override
  Future<ApiResponse<HomeDataDto>> fetchHome({int? season}) async {
    if (homeFailure != null) throw GridViewApiException(homeFailure!);
    return home!();
  }

  @override
  Future<ApiResponse<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
  }) async {
    if (grandPrixFailure != null) throw GridViewApiException(grandPrixFailure!);
    return grandPrix!();
  }
}

ApiResponse<HomeDataDto> _homeResponse({
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
  return ApiResponse.parse<HomeDataDto>(
    json,
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  );
}

ApiResponse<GrandPrixDto> _grandPrixResponse({
  String fixture = 'grand-prix/standard-weekend.json',
  String generatedAt = '2026-07-18T12:00:00Z',
}) {
  final Map<String, dynamic> json = loadFixture(fixture);
  (json['meta'] as Map<String, dynamic>)['generatedAt'] = generatedAt;
  return ApiResponse.parse<GrandPrixDto>(
    json,
    (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
  );
}

void main() {
  late GridViewDatabase db;
  late _FakeApi api;
  late RaceWeekendRepository repo;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = _FakeApi();
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
          return ApiResponse.parse<HomeDataDto>(
            json,
            (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
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

    test('a newer snapshot updates the cache', () async {
      api.home = () => _homeResponse(generatedAt: '2026-07-18T12:00:00Z');
      await repo.refreshHome();

      api.home = () => _homeResponse(
        generatedAt: '2026-07-18T18:00:00Z',
        stale: true,
        staleAfter: '2026-07-18T12:15:00Z',
      );
      final RefreshResult result = await repo.refreshHome();

      expect((result as RefreshSuccess).applied, isTrue);
      final HomeView view = (await repo.watchHome().first)!;
      expect(view.freshness.generatedAt, DateTime.utc(2026, 7, 18, 18));
    });

    test('an older snapshot is rejected and preserves newer cache', () async {
      api.home = () => _homeResponse(generatedAt: '2026-07-18T18:00:00Z');
      await repo.refreshHome();

      api.home = () => _homeResponse(generatedAt: '2026-07-18T06:00:00Z');
      final RefreshResult result = await repo.refreshHome();

      expect(result, isA<RefreshSuccess>());
      expect((result as RefreshSuccess).applied, isFalse);
      final HomeView view = (await repo.watchHome().first)!;
      expect(view.freshness.generatedAt, DateTime.utc(2026, 7, 18, 18));
    });

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
