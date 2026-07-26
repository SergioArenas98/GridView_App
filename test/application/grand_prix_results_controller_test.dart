import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_providers.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/calendar/application/grand_prix_results_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import '../support/fake_api.dart';
import '../support/scripted_api.dart';

Future<void> _settle([int iterations = 60]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

/// The completed Italian GP (round 12) — the event the shared result fixture
/// belongs to.
const GrandPrixKey italian = (season: 2026, round: 12);

/// The in-progress Belgian sprint weekend (round 13) — `hasResults: false`.
const GrandPrixKey belgian = (season: 2026, round: 13);

final DateTime _now = DateTime.utc(2026, 7, 18, 12, 30);

ProviderContainer _container(GridViewDatabase db, GridViewApi api) {
  final ProviderContainer c = ProviderContainer(
    overrides: [
      databaseProvider.overrideWithValue(db),
      remoteApiProvider.overrideWithValue(api),
      clockProvider.overrideWithValue(() => _now),
    ],
  );
  addTearDown(c.dispose);
  return c;
}

RemoteResult<GrandPrixDto> _detail(
  String fixture, {
  String etag = 'W/"gp"',
  String? sourceUpdatedAt,
}) => modifiedFromFixture<GrandPrixDto>(
  'grand-prix/$fixture.json',
  (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
  etag: etag,
  sourceUpdatedAt: sourceUpdatedAt,
);

RemoteResult<RaceResultDto> _raceResult({String etag = 'W/"res"'}) =>
    modifiedFromFixture<RaceResultDto>(
      'results/race-timing.json',
      (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
      etag: etag,
    );

/// Subscribes to both derived states, exactly as the screen does.
void _open(ProviderContainer c, GrandPrixKey key) {
  c.listen(grandPrixStateProvider(key), (_, _) {}, fireImmediately: true);
  c.listen(
    grandPrixResultsStateProvider(key),
    (_, _) {},
    fireImmediately: true,
  );
  c.read(grandPrixResultsControllerProvider(key));
}

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
  });
  tearDown(() => db.close());

  group('detail on demand', () {
    test('opening a route triggers exactly one detail request', () async {
      api.grandPrix = (String? etag) => _detail('sprint-weekend');
      final ProviderContainer c = _container(db, api);
      _open(c, belgian);
      await _settle();

      expect(api.callsFor('grandPrix'), 1);
      expect(c.read(grandPrixStateProvider(belgian)), isA<GrandPrixReady>());
    });

    test('reading the state repeatedly produces no further request', () async {
      api.grandPrix = (String? etag) => _detail('sprint-weekend');
      final ProviderContainer c = _container(db, api);
      _open(c, belgian);
      await _settle();
      for (int i = 0; i < 5; i++) {
        c.read(grandPrixStateProvider(belgian));
        await _settle(5);
      }

      expect(api.callsFor('grandPrix'), 1);
    });

    test('a retry after a failure issues a new request', () async {
      api.grandPrix = (String? etag) => RemoteFailure<GrandPrixDto>(
        const ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      final ProviderContainer c = _container(db, api);
      _open(c, belgian);
      await _settle();
      expect(api.callsFor('grandPrix'), 1);
      expect(
        c.read(grandPrixStateProvider(belgian)),
        isA<GrandPrixFirstLoadError>(),
      );

      api.grandPrix = (String? etag) => _detail('sprint-weekend');
      await c.read(grandPrixControllerProvider(belgian).notifier).refresh();
      await _settle();

      expect(api.callsFor('grandPrix'), 2);
      expect(c.read(grandPrixStateProvider(belgian)), isA<GrandPrixReady>());
    });

    test('the resource keys are exactly season/round scoped', () async {
      api.grandPrix = (String? etag) => _detail('sprint-weekend');
      api.results = (String? etag) => RemoteFailure<RaceResultDto>(
        const ApiFailure(kind: ApiFailureKind.notFound),
      );
      final ProviderContainer c = _container(db, api);
      _open(c, belgian);
      await _settle();

      expect(await db.syncMetadataDao.read('grand-prix:2026:13'), isNotNull);
      expect(await db.syncMetadataDao.read('grand-prix:2026:12'), isNull);
    });

    test('a route season may differ from the stored current season', () async {
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      final ProviderContainer c = _container(db, api);
      // No current season has ever been resolved; the explicit route still
      // works because detail is keyed by its own (season, round).
      expect(await c.read(currentSeasonResolverProvider)(), isNull);

      _open(c, italian);
      await _settle();

      final GrandPrixDetailState state = c.read(
        grandPrixStateProvider(italian),
      );
      expect(state, isA<GrandPrixReady>());
      expect((state as GrandPrixReady).view.grandPrix.season, 2026);
      expect(state.view.grandPrix.round, 12);
    });
  });

  group('result eligibility', () {
    test('an upcoming event with hasResults false requests nothing', () async {
      api.grandPrix = (String? etag) => _detail('upcoming');
      final ProviderContainer c = _container(db, api);
      _open(c, (season: 2026, round: 14));
      await _settle();

      expect(api.callsFor('grandPrix'), 1);
      expect(api.callsFor('results'), 0);
      expect(
        c.read(grandPrixResultsStateProvider((season: 2026, round: 14))),
        isA<GrandPrixResultsUnavailable>(),
      );
    });

    test('hasResults true triggers exactly one result request', () async {
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => _raceResult();
      final ProviderContainer c = _container(db, api);
      _open(c, italian);
      await _settle();

      expect(api.callsFor('results'), 1);
      final GrandPrixResultsState state = c.read(
        grandPrixResultsStateProvider(italian),
      );
      expect(state, isA<GrandPrixResultsReady>());
      expect((state as GrandPrixResultsReady).documents, hasLength(1));
      expect(state.documents.single.entries, hasLength(5));
    });

    test('repeated local emissions never repeat the result request', () async {
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => _raceResult();
      final ProviderContainer c = _container(db, api);
      _open(c, italian);
      await _settle();
      expect(api.callsFor('results'), 1);

      // Force several more local commits on the watched tables.
      for (int i = 0; i < 3; i++) {
        await c.read(grandPrixControllerProvider(italian).notifier).refresh();
        await _settle(10);
      }

      expect(
        api.callsFor('results'),
        1,
        reason: 'eligibility fires once, not per emission',
      );
    });

    test(
      'a detail refresh that flips hasResults false to true requests results '
      'exactly once',
      () async {
        // Round 12 first advertises no results…
        api.grandPrix = (String? etag) => modifiedFromFixture<GrandPrixDto>(
          'grand-prix/standard-weekend.json',
          (Object? d) => GrandPrixDto.fromJson(<String, dynamic>{
            ...d! as Map<String, dynamic>,
            'hasResults': false,
          }),
          etag: 'W/"gp-no-results"',
        );
        api.results = (String? etag) => _raceResult();

        final ProviderContainer c = _container(db, api);
        _open(c, italian);
        await _settle();
        expect(api.callsFor('results'), 0, reason: 'nothing to ask for yet');

        // …then a later detail refresh reports that they exist.
        // A genuinely newer snapshot, or the conflict rule would rightly keep
        // the cached one.
        api.grandPrix = (String? etag) => _detail(
          'standard-weekend',
          etag: 'W/"gp-with-results"',
          sourceUpdatedAt: '2026-07-19T11:55:00Z',
        );
        await c.read(grandPrixControllerProvider(italian).notifier).refresh();
        await _settle();

        expect(api.callsFor('results'), 1);

        // A further detail refresh must not ask again.
        await c.read(grandPrixControllerProvider(italian).notifier).refresh();
        await _settle();
        expect(api.callsFor('results'), 1);
      },
    );

    test('cached results are rendered even when hasResults is false', () async {
      // Session 1: sync the detail and its classification.
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => _raceResult();
      final ProviderContainer c1 = _container(db, api);
      _open(c1, italian);
      await _settle();
      expect(api.callsFor('results'), 1);
      c1.dispose();

      // Session 2: the event now claims it has no results. The stored
      // classification still renders, and revalidation runs once.
      api.grandPrix = (String? etag) => modifiedFromFixture<GrandPrixDto>(
        'grand-prix/standard-weekend.json',
        (Object? d) => GrandPrixDto.fromJson(<String, dynamic>{
          ...d! as Map<String, dynamic>,
          'hasResults': false,
        }),
        etag: 'W/"gp-flag-cleared"',
        sourceUpdatedAt: '2026-07-19T11:55:00Z',
      );
      final ProviderContainer c2 = _container(db, api);
      _open(c2, italian);
      await _settle();

      final GrandPrixResultsState state = c2.read(
        grandPrixResultsStateProvider(italian),
      );
      expect(state, isA<GrandPrixResultsReady>());
      expect((state as GrandPrixResultsReady).documents, hasLength(1));
    });
  });

  group('independence', () {
    test('a result failure never replaces valid detail', () async {
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => RemoteFailure<RaceResultDto>(
        const ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );
      final ProviderContainer c = _container(db, api);
      _open(c, italian);
      await _settle();

      expect(c.read(grandPrixStateProvider(italian)), isA<GrandPrixReady>());
      expect(
        c.read(grandPrixResultsStateProvider(italian)),
        isA<GrandPrixResultsError>(),
      );
    });

    test('a detail failure never erases cached detail or results', () async {
      // Session 1: everything synced.
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => _raceResult();
      final ProviderContainer c1 = _container(db, api);
      _open(c1, italian);
      await _settle();
      c1.dispose();

      // Session 2: the detail endpoint is down.
      api.grandPrix = (String? etag) => RemoteFailure<GrandPrixDto>(
        const ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      final ProviderContainer c2 = _container(db, api);
      _open(c2, italian);
      await _settle();

      final GrandPrixDetailState detail = c2.read(
        grandPrixStateProvider(italian),
      );
      expect(detail, isA<GrandPrixReady>());
      expect((detail as GrandPrixReady).view.grandPrix.sessions, hasLength(5));
      expect(detail.refreshError?.kind, ApiFailureKind.networkUnavailable);
      expect(
        c2.read(grandPrixResultsStateProvider(italian)),
        isA<GrandPrixResultsReady>(),
      );
    });

    test('a result retry targets only the result resource', () async {
      api.grandPrix = (String? etag) => _detail('standard-weekend');
      api.results = (String? etag) => RemoteFailure<RaceResultDto>(
        const ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );
      final ProviderContainer c = _container(db, api);
      _open(c, italian);
      await _settle();
      expect(api.callsFor('grandPrix'), 1);
      expect(api.callsFor('results'), 1);

      api.results = (String? etag) => _raceResult();
      await c
          .read(grandPrixResultsControllerProvider(italian).notifier)
          .refresh();
      await _settle();

      expect(api.callsFor('grandPrix'), 1, reason: 'detail untouched');
      expect(api.callsFor('results'), 2);
      expect(
        c.read(grandPrixResultsStateProvider(italian)),
        isA<GrandPrixResultsReady>(),
      );
    });
  });

  group('cancellation', () {
    test('disposing the detail scope cancels the in-flight request', () async {
      final _CancellationAwareApi cancellable = _CancellationAwareApi();
      final ProviderContainer c = _container(db, cancellable);
      _open(c, belgian);
      await _settle(5);

      expect(cancellable.detailToken, isNotNull);
      expect(cancellable.detailToken!.isCancelled, isFalse);

      c.dispose();
      expect(
        cancellable.detailToken!.isCancelled,
        isTrue,
        reason: 'popping the screen aborts the request in flight',
      );
      expect(cancellable.resultToken?.isCancelled ?? true, isTrue);
      await _settle();

      // Nothing was committed, and a later visit retries cleanly.
      expect(await db.verticalSliceDao.countGrandPrix(2026, 13), 0);

      cancellable.release();
      final ProviderContainer c2 = _container(db, cancellable);
      _open(c2, belgian);
      await _settle();
      expect(await db.verticalSliceDao.countGrandPrix(2026, 13), 1);
    });
  });
}

/// A remote fake that records the cancellation token each on-demand request was
/// given and holds the detail request open until [release] is called, so the
/// test can observe cancellation while a request is genuinely in flight.
class _CancellationAwareApi extends BaseFakeGridViewApi {
  final Completer<void> _gate = Completer<void>();

  RemoteCancellation? detailToken;
  RemoteCancellation? resultToken;

  void release() {
    if (!_gate.isCompleted) _gate.complete();
  }

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async {
    detailToken = cancellation;
    await _gate.future;
    if (cancellation?.isCancelled ?? false) {
      return RemoteFailure<GrandPrixDto>(
        const ApiFailure(kind: ApiFailureKind.cancelled),
      );
    }
    return _detail('sprint-weekend');
  }

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async {
    resultToken = cancellation;
    return RemoteFailure<RaceResultDto>(
      const ApiFailure(kind: ApiFailureKind.notFound),
    );
  }
}
