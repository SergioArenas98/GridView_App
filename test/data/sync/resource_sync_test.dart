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
    DateTime? source,
    DateTime? stale,
    String content = 'c1',
    bool? serverStale,
  }) => RemoteSnapshotMeta(
    etag: etag,
    generatedAt: DateTime.utc(2026, 7, 18, 12),
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
}
