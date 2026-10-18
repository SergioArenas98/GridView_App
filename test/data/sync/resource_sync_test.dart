import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/sync/resource_snapshot.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/snapshot_conflict.dart';

/// Exercises the metadata semantics (§4) and transaction boundaries (§10) of the
/// [ResourceSync] writer directly against a real in-memory database.
void main() {
  late GridViewDatabase db;
  late ResourceSync sync;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    sync = ResourceSync(db);
  });
  tearDown(() => db.close());

  const String key = 'content:manifest';
  const ResourceScope scope = ResourceScope.none;

  RemoteSnapshotMeta meta({
    String etag = 'W/"1"',
    DateTime? generated,
    DateTime? source,
    DateTime? stale,
    String content = 'c1',
    bool? serverStale,
  }) => RemoteSnapshotMeta(
    etag: etag,
    generatedAt: generated ?? DateTime.utc(2026, 7, 18, 12),
    sourceUpdatedAt: source ?? DateTime.utc(2026, 7, 18, 11),
    staleAfter: stale,
    contentVersion: content,
    serverStale: serverStale,
  );

  test('a modified apply commits full success metadata', () async {
    int writes = 0;
    final SnapshotConflictOutcome outcome = await sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(stale: DateTime.utc(2026, 7, 18, 18), serverStale: false),
      at: DateTime.utc(2026, 7, 20),
      writeDomain: () async => writes++,
    );
    expect(outcome, SnapshotConflictOutcome.apply);
    expect(writes, 1);

    final ResourceSyncState s = (await sync.read(key))!;
    expect(s.etag, 'W/"1"');
    expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11));
    expect(s.staleAfter, DateTime.utc(2026, 7, 18, 18));
    expect(s.contentVersion, 'c1');
    expect(s.serverStale, isFalse);
    expect(s.lastAttemptAt, DateTime.utc(2026, 7, 20));
    expect(s.lastSuccessAt, DateTime.utc(2026, 7, 20));
    expect(s.lastFailureCategory, isNull);
  });

  test('a metadata failure rolls back the domain write', () async {
    // Seed a prior success so we can prove no partial change survives.
    await sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(),
      at: DateTime.utc(2026, 7, 20),
      writeDomain: () async {},
    );
    // A domain write that throws must roll back and leave no success metadata
    // update behind.
    await expectLater(
      sync.applySnapshot(
        key: key,
        scope: scope,
        incoming: meta(etag: 'W/"2"', source: DateTime.utc(2026, 7, 18, 12)),
        at: DateTime.utc(2026, 7, 21),
        writeDomain: () async => throw StateError('domain boom'),
      ),
      throwsA(isA<StateError>()),
    );
    final ResourceSyncState s = (await sync.read(key))!;
    expect(
      s.etag,
      'W/"1"',
      reason: 'the failed attempt did not update the etag',
    );
    expect(s.lastSuccessAt, DateTime.utc(2026, 7, 20));
  });

  test(
    'a 304 preserves provenance and bumps success, clears failure',
    () async {
      await sync.applySnapshot(
        key: key,
        scope: scope,
        incoming: meta(stale: DateTime.utc(2026, 7, 18, 18)),
        at: DateTime.utc(2026, 7, 20),
        writeDomain: () async {},
      );
      await sync.recordFailure(
        key,
        scope,
        'network',
        DateTime.utc(2026, 7, 20, 1),
      );

      await sync.recordNotModified(
        key,
        scope,
        DateTime.utc(2026, 7, 22),
        newEtag: null,
      );
      final ResourceSyncState s = (await sync.read(key))!;
      // Provenance unchanged; no new snapshot metadata invented from the clock.
      expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11));
      expect(s.staleAfter, DateTime.utc(2026, 7, 18, 18));
      expect(s.contentVersion, 'c1');
      expect(s.etag, 'W/"1"', reason: 'no replacement etag supplied');
      expect(s.lastSuccessAt, DateTime.utc(2026, 7, 22));
      expect(s.lastFailureCategory, isNull);
    },
  );

  test('a 304 updates the etag only when the server supplies one', () async {
    await sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(etag: 'W/"1"'),
      at: DateTime.utc(2026, 7, 20),
      writeDomain: () async {},
    );
    await sync.recordNotModified(
      key,
      scope,
      DateTime.utc(2026, 7, 22),
      newEtag: 'W/"1b"',
    );
    expect((await sync.read(key))!.etag, 'W/"1b"');
  });

  test(
    'a failure preserves etag/provenance and does not bump success',
    () async {
      await sync.applySnapshot(
        key: key,
        scope: scope,
        incoming: meta(),
        at: DateTime.utc(2026, 7, 20),
        writeDomain: () async {},
      );
      await sync.recordFailure(
        key,
        scope,
        'upstreamUnavailable',
        DateTime.utc(2026, 7, 23),
      );
      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.etag, 'W/"1"');
      expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11));
      expect(s.lastAttemptAt, DateTime.utc(2026, 7, 23));
      expect(s.lastSuccessAt, DateTime.utc(2026, 7, 20));
      expect(s.lastFailureCategory, 'upstreamUnavailable');
    },
  );

  test('an older snapshot is rejected with a safe conflict category', () async {
    await sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(source: DateTime.utc(2026, 7, 18, 15)),
      at: DateTime.utc(2026, 7, 20),
      writeDomain: () async {},
    );
    int writes = 0;
    final SnapshotConflictOutcome outcome = await sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(
        etag: 'W/"old"',
        source: DateTime.utc(2026, 7, 18, 6), // older
      ),
      at: DateTime.utc(2026, 7, 21),
      writeDomain: () async => writes++,
    );
    expect(outcome, SnapshotConflictOutcome.rejectedOlder);
    expect(writes, 0, reason: 'no domain write for a rejected snapshot');
    final ResourceSyncState s = (await sync.read(key))!;
    expect(s.etag, 'W/"1"', reason: 'cached etag preserved');
    expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 15));
    expect(s.lastAttemptAt, DateTime.utc(2026, 7, 21));
    expect(s.lastSuccessAt, DateTime.utc(2026, 7, 20), reason: 'not a success');
    expect(s.lastFailureCategory, SyncFailureCategory.conflictOlder);
  });

  group('identical content from a later publication (ADR 0005 amendment)', () {
    final DateTime firstAt = DateTime.utc(2026, 7, 20);
    final DateTime secondAt = DateTime.utc(2026, 7, 21);

    Future<void> seed() => sync.applySnapshot(
      key: key,
      scope: scope,
      incoming: meta(
        stale: DateTime.utc(2026, 7, 18, 12, 15),
        serverStale: true,
      ),
      at: firstAt,
      writeDomain: () async {},
    );

    Future<(SnapshotConflictOutcome, int)> revalidate(
      RemoteSnapshotMeta incoming,
    ) async {
      int writes = 0;
      final SnapshotConflictOutcome outcome = await sync.applySnapshot(
        key: key,
        scope: scope,
        incoming: incoming,
        at: secondAt,
        writeDomain: () async => writes++,
      );
      return (outcome, writes);
    }

    test('takes the publication fields without a domain write', () async {
      await seed();
      final (SnapshotConflictOutcome outcome, int writes) = await revalidate(
        meta(
          etag: 'W/"2"',
          generated: DateTime.utc(2026, 7, 21, 9),
          stale: DateTime.utc(2026, 7, 25, 20),
        ),
      );

      expect(outcome, SnapshotConflictOutcome.skippedUpToDate);
      expect(writes, 0, reason: 'identical content is never rewritten');
      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.generatedAt, DateTime.utc(2026, 7, 21, 9));
      expect(s.staleAfter, DateTime.utc(2026, 7, 25, 20));
      expect(
        s.serverStale,
        isNull,
        reason: 'the later publication carries no stale flag; null is set',
      );
      expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 11));
      expect(s.contentVersion, 'c1');
      expect(s.etag, 'W/"2"');
      expect(s.lastSuccessAt, secondAt);
      expect(s.lastFailureCategory, isNull);
    });

    test(
      'an equal generatedAt (the same publication) changes nothing',
      () async {
        await seed();
        final (SnapshotConflictOutcome outcome, int writes) = await revalidate(
          meta(etag: 'W/"1"', stale: DateTime.utc(2026, 7, 25, 20)),
        );

        expect(outcome, SnapshotConflictOutcome.skippedUpToDate);
        expect(writes, 0);
        final ResourceSyncState s = (await sync.read(key))!;
        expect(s.generatedAt, DateTime.utc(2026, 7, 18, 12));
        expect(s.staleAfter, DateTime.utc(2026, 7, 18, 12, 15));
        expect(s.serverStale, isTrue);
        expect(s.lastSuccessAt, secondAt, reason: 'still a validation');
      },
    );

    test(
      'an earlier generatedAt (an older cached copy) changes nothing',
      () async {
        await seed();
        final (SnapshotConflictOutcome outcome, int writes) = await revalidate(
          meta(
            generated: DateTime.utc(2026, 7, 18, 6),
            stale: DateTime.utc(2026, 7, 30),
          ),
        );

        expect(outcome, SnapshotConflictOutcome.skippedUpToDate);
        expect(writes, 0);
        final ResourceSyncState s = (await sync.read(key))!;
        expect(s.generatedAt, DateTime.utc(2026, 7, 18, 12));
        expect(s.staleAfter, DateTime.utc(2026, 7, 18, 12, 15));
      },
    );

    test('a 304 never moves the publication fields', () async {
      await seed();
      await sync.recordNotModified(key, scope, secondAt, newEtag: 'W/"2"');

      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.generatedAt, DateTime.utc(2026, 7, 18, 12));
      expect(s.staleAfter, DateTime.utc(2026, 7, 18, 12, 15));
      expect(s.serverStale, isTrue);
      expect(s.lastSuccessAt, secondAt);
    });

    test(
      'differing content keeps the generatedAt tie-break (rule 4)',
      () async {
        await seed();
        final (SnapshotConflictOutcome outcome, int writes) = await revalidate(
          meta(
            generated: DateTime.utc(2026, 7, 21, 9),
            content: 'c2',
            stale: DateTime.utc(2026, 7, 25, 20),
          ),
        );

        expect(outcome, SnapshotConflictOutcome.apply);
        expect(writes, 1);
        expect((await sync.read(key))!.contentVersion, 'c2');
      },
    );
  });

  group('a record ordered within the season it was accepted under', () {
    // The content manifest: its payload names no season, so its repository
    // supplies the locally current season as the accepted scope.
    const ResourceScope outgoing = ResourceScope(season: 2025);
    const ResourceScope incomingSeason = ResourceScope(season: 2026);

    Future<void> seedOutgoing() => sync.applySnapshot(
      key: key,
      scope: outgoing,
      incoming: meta(
        generated: DateTime.utc(2026, 7, 21, 9),
        stale: DateTime.utc(2026, 7, 21, 9, 15),
      ),
      at: DateTime.utc(2026, 7, 21, 9, 1),
      writeDomain: () async {},
      orderedWithinSeason: true,
    );

    Future<(SnapshotConflictOutcome, int)> accept(
      ResourceScope accepted,
      RemoteSnapshotMeta incoming,
    ) async {
      int writes = 0;
      final SnapshotConflictOutcome outcome = await sync.applySnapshot(
        key: key,
        scope: accepted,
        incoming: incoming,
        at: DateTime.utc(2026, 7, 22),
        writeDomain: () async => writes++,
        orderedWithinSeason: true,
      );
      return (outcome, writes);
    }

    test('identical content accepted under a new season applies with its '
        'own, earlier instant', () async {
      await seedOutgoing();
      final (SnapshotConflictOutcome outcome, int writes) = await accept(
        incomingSeason,
        meta(
          etag: 'W/"2"',
          generated: DateTime.utc(2026, 7, 20, 8),
          stale: DateTime.utc(2026, 7, 27),
        ),
      );

      expect(outcome, SnapshotConflictOutcome.apply);
      expect(writes, 1);
      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.season, 2026);
      expect(
        s.generatedAt,
        DateTime.utc(2026, 7, 20, 8),
        reason: 'the outgoing instant orders nothing in the new season',
      );
      expect(s.staleAfter, DateTime.utc(2026, 7, 27));
      expect(s.etag, 'W/"2"');
    });

    test('an older sourceUpdatedAt and different content under a new season '
        'still apply', () async {
      await seedOutgoing();
      final (SnapshotConflictOutcome outcome, int writes) = await accept(
        incomingSeason,
        meta(
          etag: 'W/"2"',
          generated: DateTime.utc(2026, 7, 20, 8),
          source: DateTime.utc(2026, 7, 18, 6),
          content: 'c2',
        ),
      );

      expect(outcome, SnapshotConflictOutcome.apply);
      expect(writes, 1);
      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.season, 2026);
      expect(s.generatedAt, DateTime.utc(2026, 7, 20, 8));
      expect(s.sourceUpdatedAt, DateTime.utc(2026, 7, 18, 6));
      expect(s.contentVersion, 'c2');
      expect(s.lastFailureCategory, isNull);
    });

    test(
      'accepted with no current season, it applies without a season',
      () async {
        await seedOutgoing();
        final (SnapshotConflictOutcome outcome, _) = await accept(
          ResourceScope.none,
          meta(generated: DateTime.utc(2026, 7, 20, 8)),
        );

        expect(outcome, SnapshotConflictOutcome.apply);
        final ResourceSyncState s = (await sync.read(key))!;
        expect(s.generatedAt, DateTime.utc(2026, 7, 20, 8));
        expect(s.season, isNull);
      },
    );

    test('within one season the conflict rule is unchanged', () async {
      await seedOutgoing();
      final (SnapshotConflictOutcome outcome, int writes) = await accept(
        outgoing,
        meta(source: DateTime.utc(2026, 7, 18, 6), content: 'c2'),
      );

      expect(outcome, SnapshotConflictOutcome.rejectedOlder);
      expect(writes, 0);
      expect((await sync.read(key))!.generatedAt, DateTime.utc(2026, 7, 21, 9));
    });

    test('a 304 keeps the recorded season', () async {
      await seedOutgoing();
      await sync.recordNotModified(key, scope, DateTime.utc(2026, 7, 22));

      final ResourceSyncState s = (await sync.read(key))!;
      expect(s.season, 2025);
      expect(s.generatedAt, DateTime.utc(2026, 7, 21, 9));
    });
  });

  test('a rejected payload never re-scopes a stored record', () async {
    // A record scoped from its payload but ordered across seasons, as the
    // bootstrap is.
    await sync.applySnapshot(
      key: key,
      scope: const ResourceScope(season: 2025),
      incoming: meta(),
      at: DateTime.utc(2026, 7, 21),
      writeDomain: () async {},
    );
    final SnapshotConflictOutcome outcome = await sync.applySnapshot(
      key: key,
      scope: const ResourceScope(season: 2026),
      incoming: meta(
        etag: 'W/"old"',
        source: DateTime.utc(2026, 7, 18, 6),
        content: 'c2',
      ),
      at: DateTime.utc(2026, 7, 22),
      writeDomain: () async {},
    );

    expect(outcome, SnapshotConflictOutcome.rejectedOlder);
    final ResourceSyncState s = (await sync.read(key))!;
    expect(s.season, 2025, reason: 'the season still describes the content');
    expect(s.lastFailureCategory, SyncFailureCategory.conflictOlder);
  });
}
