import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/sync_metadata_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

void main() {
  late GridViewDatabase db;
  late SyncMetadataDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.syncMetadataDao;
  });
  tearDown(() => db.close());

  test('read returns null for an unknown resource key', () async {
    expect(await dao.read('nope:2026'), isNull);
  });

  test('upsert stores scope and provenance under a canonical key', () async {
    await dao.upsert(
      ResourceSyncState(
        resourceKey: ResourceKey.grandPrix(2026, 13),
        season: 2026,
        round: 13,
        etag: 'W/"gp13"',
        generatedAt: DateTime.utc(2026, 7, 20, 10),
        lastAttemptAt: DateTime.utc(2026, 7, 20, 10),
        lastFailureCategory: 'upstream_unavailable',
      ),
    );

    final ResourceSyncState? s = await dao.read(
      ResourceKey.grandPrix(2026, 13),
    );
    expect(s, isNotNull);
    expect(s!.season, 2026);
    expect(s.round, 13);
    expect(s.etag, 'W/"gp13"');
    expect(s.lastFailureCategory, 'upstream_unavailable');
  });

  test('upsert overwrites the previous state for the same key', () async {
    await dao.upsert(
      ResourceSyncState(
        resourceKey: ResourceKey.home(2026),
        season: 2026,
        lastAttemptAt: DateTime.utc(2026, 1, 1),
        lastFailureCategory: 'network',
      ),
    );
    // A later successful sync clears the failure and records the success.
    await dao.upsert(
      ResourceSyncState(
        resourceKey: ResourceKey.home(2026),
        season: 2026,
        etag: 'W/"home2"',
        lastAttemptAt: DateTime.utc(2026, 1, 2),
        lastSuccessAt: DateTime.utc(2026, 1, 2),
      ),
    );

    final ResourceSyncState? s = await dao.read(ResourceKey.home(2026));
    expect(s!.etag, 'W/"home2"');
    expect(s.lastSuccessAt, DateTime.utc(2026, 1, 2));
    expect(s.lastFailureCategory, isNull);
  });
}
