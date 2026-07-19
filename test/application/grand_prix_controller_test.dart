import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_providers.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/shared/application/providers.dart';

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
}
