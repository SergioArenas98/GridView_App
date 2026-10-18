import 'dart:async';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_providers.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_api.dart';

Future<void> _settle([int iterations = 40]) async {
  for (int i = 0; i < iterations; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

const GrandPrixKey belgianKey = (season: 2026, round: 13);

ProviderContainer _container(
  FakeGridViewApi api,
  GridViewDatabase db,
  DateTime now,
) {
  final ProviderContainer container = ProviderContainer(
    overrides: [
      databaseProvider.overrideWithValue(db),
      remoteApiProvider.overrideWithValue(api),
      clockProvider.overrideWithValue(() => now),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12, 30); // past staleAfter

  test('a successful detail refresh yields ordered sessions', () async {
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase.memory(),
    );
    addTearDown(db.close);
    final FakeGridViewApi api = FakeGridViewApi();
    final ProviderContainer c = _container(api, db, now);
    c.listen(
      grandPrixStateProvider(belgianKey),
      (_, _) {},
      fireImmediately: true,
    );

    expect(c.read(grandPrixStateProvider(belgianKey)), isA<GrandPrixLoading>());

    await _settle();
    final GrandPrixDetailState state = c.read(
      grandPrixStateProvider(belgianKey),
    );
    expect(state, isA<GrandPrixReady>());
    expect((state as GrandPrixReady).view.grandPrix.sessions, hasLength(5));
    expect(api.grandPrixCalls, 1);
  });

  test('a missing Grand Prix yields a controlled not-found state', () async {
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase.memory(),
    );
    addTearDown(db.close);
    final FakeGridViewApi api = FakeGridViewApi()
      ..grandPrixFailure = const ApiFailure(kind: ApiFailureKind.notFound);
    final ProviderContainer c = _container(api, db, now);
    c.listen(
      grandPrixStateProvider(belgianKey),
      (_, _) {},
      fireImmediately: true,
    );

    await _settle();
    expect(
      c.read(grandPrixStateProvider(belgianKey)),
      isA<GrandPrixNotFound>(),
    );
  });

  test('cached detail is shown offline even when refresh fails', () async {
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase.memory(),
    );
    addTearDown(db.close);

    // Seed the cache directly (simulating an earlier successful sync).
    await db.verticalSliceDao.writeGrandPrixSnapshot(
      grandPrix: belgianGrandPrix(sessions: belgianSprintSessions()),
      freshness: freshness(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
      ),
    );

    final FakeGridViewApi api = FakeGridViewApi()
      ..grandPrixFailure = const ApiFailure(
        kind: ApiFailureKind.networkUnavailable,
      );
    final ProviderContainer c = _container(api, db, now);
    c.listen(
      grandPrixStateProvider(belgianKey),
      (_, _) {},
      fireImmediately: true,
    );

    await _settle();
    final GrandPrixDetailState state = c.read(
      grandPrixStateProvider(belgianKey),
    );
    expect(state, isA<GrandPrixReady>());
    final GrandPrixReady ready = state as GrandPrixReady;
    expect(ready.view.grandPrix.sessions, hasLength(5));
    expect(ready.refreshError?.kind, ApiFailureKind.networkUnavailable);
  });

  test(
    'a later publication of identical detail updates freshness metadata only',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      // First publication: generatedAt 12:00, staleAfter 12:15; now is 12:30.
      final FakeGridViewApi api = FakeGridViewApi();
      final ProviderContainer c = _container(api, db, now);
      c.listen(
        grandPrixStateProvider(belgianKey),
        (_, _) {},
        fireImmediately: true,
      );
      await _settle();
      expect(
        (c.read(grandPrixStateProvider(belgianKey)) as GrandPrixReady)
            .freshness,
        FreshnessState.stale,
      );

      Future<List<Object>> domainRows() async => <Object>[
        ...await db.select(db.seasons).get(),
        ...await db.select(db.circuits).get(),
        ...await db.select(db.grandPrixEvents).get(),
        ...await db.select(db.sessions).get(),
        ...await db.select(db.snapshots).get(),
        ...await db.select(db.grandPrixMedia).get(),
      ];
      final List<Object> before = await domainRows();
      final List<TableUpdate> domainUpdates = <TableUpdate>[];
      final StreamSubscription<Set<TableUpdate>> watch = db
          .tableUpdates(
            TableUpdateQuery.onAllTables(
              <ResultSetImplementation<dynamic, dynamic>>[
                db.seasons,
                db.circuits,
                db.grandPrixEvents,
                db.sessions,
                db.snapshots,
                db.grandPrixMedia,
              ],
            ),
          )
          .listen(domainUpdates.addAll);
      addTearDown(watch.cancel);

      // The same content again, from a later publication with a new expiry.
      api.grandPrix = () => grandPrixResponseFixture(
        generatedAt: '2026-07-18T12:20:00Z',
        staleAfter: '2026-07-18T13:00:00Z',
        etag: 'W/"gp-republished"',
      );
      await c.read(grandPrixControllerProvider(belgianKey).notifier).refresh();
      await _settle();

      expect(api.grandPrixCalls, 2);
      expect(domainUpdates, isEmpty, reason: 'no domain table was written');
      expect(await domainRows(), before);
      final ResourceSyncState record = (await db.syncMetadataDao.read(
        ResourceKey.grandPrix(2026, 13),
      ))!;
      expect(record.generatedAt, DateTime.utc(2026, 7, 18, 12, 20));
      expect(record.staleAfter, DateTime.utc(2026, 7, 18, 13));
      expect(record.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11, 55));
      expect(record.etag, 'W/"gp-republished"');
      expect(
        (c.read(grandPrixStateProvider(belgianKey)) as GrandPrixReady)
            .freshness,
        FreshnessState.fresh,
      );
    },
  );
}
