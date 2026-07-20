import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/vertical_slice_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';

import '../support/domain_fixtures.dart';

/// Focused coverage of the snapshot conflict rule: `sourceUpdatedAt` is the
/// primary ordering boundary; `generatedAt` is only an equal-source tie-breaker;
/// `contentVersion` is compared by equality only. Deterministic UTC timestamps.
void main() {
  late GridViewDatabase db;
  late VerticalSliceDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.verticalSliceDao;
  });
  tearDown(() => db.close());

  // Source revisions.
  final DateTime sourceOld = DateTime.utc(2026, 7, 18, 6);
  final DateTime sourceMid = DateTime.utc(2026, 7, 18, 12);
  final DateTime sourceNew = DateTime.utc(2026, 7, 18, 18);
  // Generation instants (deliberately NOT aligned with source order).
  final DateTime genEarly = DateTime.utc(2026, 7, 18, 10);
  final DateTime genLate = DateTime.utc(2026, 7, 18, 20);

  Future<SnapshotWriteOutcome> writeGp({
    required DateTime source,
    required DateTime generated,
    String content = 'v1',
    EventStatus status = EventStatus.upcoming,
    List<Session>? sessions,
  }) => dao.writeGrandPrixSnapshot(
    grandPrix: belgianGrandPrix(
      status: status,
      sessions: sessions ?? belgianSprintSessions(),
    ),
    freshness: freshness(
      generatedAt: generated,
      sourceUpdatedAt: source,
      contentVersion: content,
    ),
  );

  test('1. later-generated but older-source snapshot is rejected', () async {
    await writeGp(source: sourceMid, generated: genEarly);
    final SnapshotWriteOutcome outcome = await writeGp(
      source: sourceOld, // older source
      generated: genLate, // later generation
    );
    expect(outcome, SnapshotWriteOutcome.rejectedOlder);
  });

  test('2. earlier-generated but newer-source snapshot is applied', () async {
    await writeGp(source: sourceMid, generated: genLate);
    final SnapshotWriteOutcome outcome = await writeGp(
      source: sourceNew, // newer source
      generated: genEarly, // earlier generation
    );
    expect(outcome, SnapshotWriteOutcome.applied);
  });

  test('3. equal source + equal content is an idempotent no-op', () async {
    await writeGp(source: sourceMid, generated: genEarly, content: 'v1');
    final SnapshotWriteOutcome outcome = await writeGp(
      source: sourceMid,
      generated: genLate, // later generation is irrelevant here
      content: 'v1',
    );
    expect(outcome, SnapshotWriteOutcome.skippedUpToDate);
  });

  test(
    '4. equal source + diff content + later generation is applied',
    () async {
      await writeGp(source: sourceMid, generated: genEarly, content: 'v1');
      final SnapshotWriteOutcome outcome = await writeGp(
        source: sourceMid,
        generated: genLate,
        content: 'v2',
      );
      expect(outcome, SnapshotWriteOutcome.applied);
    },
  );

  test(
    '5. equal source + diff content + earlier generation is rejected',
    () async {
      await writeGp(source: sourceMid, generated: genLate, content: 'v1');
      final SnapshotWriteOutcome outcome = await writeGp(
        source: sourceMid,
        generated: genEarly,
        content: 'v2',
      );
      expect(outcome, SnapshotWriteOutcome.rejectedOlder);
    },
  );

  test('6. a rejected snapshot alters no grand_prix/circuit/session/freshness '
      'row', () async {
    // Seed: upcoming, 5 sessions, source = mid.
    await writeGp(
      source: sourceMid,
      generated: genEarly,
      content: 'v1',
      status: EventStatus.upcoming,
      sessions: belgianSprintSessions(),
    );

    // Attempt an older-source snapshot with different content and shape.
    final SnapshotWriteOutcome outcome = await writeGp(
      source: sourceOld,
      generated: genLate,
      content: 'v2',
      status: EventStatus.inProgress,
      sessions: belgianSprintSessions().take(2).toList(),
    );
    expect(outcome, SnapshotWriteOutcome.rejectedOlder);

    // Nothing changed.
    final gpRow = await db.select(db.grandPrixEvents).getSingle();
    expect(gpRow.status, EventStatus.upcoming.wire);
    expect((await db.select(db.sessions).get()).length, 5);
    expect((await db.select(db.circuits).get()).length, 1);
    final snap = await db.select(db.snapshots).getSingle();
    expect(snap.sourceUpdatedAt, sourceMid);
    expect(snap.generatedAt, genEarly);
    expect(snap.contentVersion, 'v1');
  });

  test('7. the stream emits no false update after a rejection, and cached '
      'content stays available', () async {
    final List<GrandPrixDetailView?> emissions = <GrandPrixDetailView?>[];
    final sub = dao.watchGrandPrix(2026, 13).listen(emissions.add);
    await pumpEventQueue();
    expect(emissions, <GrandPrixDetailView?>[null]); // no cache yet

    await writeGp(source: sourceMid, generated: genEarly, content: 'v1');
    await pumpEventQueue();
    expect(emissions.length, 2); // null, then the cached view
    expect(emissions.last, isA<GrandPrixDetailView>());

    // Rejected write: no DB change, so no new emission.
    await writeGp(source: sourceOld, generated: genLate, content: 'v2');
    await pumpEventQueue();
    expect(emissions.length, 2, reason: 'no false data update after rejection');

    // Cache still available and unchanged.
    final GrandPrixDetailView? current = await dao
        .watchGrandPrix(2026, 13)
        .first;
    expect(current, isNotNull);
    expect(current!.grandPrix.status, EventStatus.upcoming);
    expect(current.freshness?.sourceUpdatedAt, sourceMid);

    await sub.cancel();
  });
}
