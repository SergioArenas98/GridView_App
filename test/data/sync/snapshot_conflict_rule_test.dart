import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/snapshot_conflict.dart';

SnapshotRevision _rev({
  DateTime? source,
  String content = 'a',
  DateTime? generated,
}) => SnapshotRevision(
  generatedAt: generated ?? DateTime.utc(2026, 7, 18, 12),
  sourceUpdatedAt: source,
  contentVersion: content,
);

void main() {
  final DateTime t1 = DateTime.utc(2026, 7, 18, 10);
  final DateTime t2 = DateTime.utc(2026, 7, 18, 11);

  group('SnapshotConflict.decide', () {
    test('missing incoming sourceUpdatedAt is rejectedInvalid', () {
      expect(
        SnapshotConflict.decide(_rev(source: null), _rev(source: t1)),
        SnapshotConflictOutcome.rejectedInvalid,
      );
    });

    test('no stored revision applies', () {
      expect(
        SnapshotConflict.decide(_rev(source: t1), null),
        SnapshotConflictOutcome.apply,
      );
    });

    test('stored missing source but incoming present applies (repair)', () {
      expect(
        SnapshotConflict.decide(_rev(source: t1), _rev(source: null)),
        SnapshotConflictOutcome.apply,
      );
    });

    test('older incoming source is rejectedOlder', () {
      expect(
        SnapshotConflict.decide(_rev(source: t1), _rev(source: t2)),
        SnapshotConflictOutcome.rejectedOlder,
      );
    });

    test('newer incoming source applies', () {
      expect(
        SnapshotConflict.decide(_rev(source: t2), _rev(source: t1)),
        SnapshotConflictOutcome.apply,
      );
    });

    test('equal source + equal content is skippedUpToDate', () {
      expect(
        SnapshotConflict.decide(
          _rev(source: t1, content: 'x'),
          _rev(source: t1, content: 'x'),
        ),
        SnapshotConflictOutcome.skippedUpToDate,
      );
    });

    test('equal source + different content: later generatedAt applies', () {
      expect(
        SnapshotConflict.decide(
          _rev(
            source: t1,
            content: 'b',
            generated: DateTime.utc(2026, 7, 18, 13),
          ),
          _rev(
            source: t1,
            content: 'a',
            generated: DateTime.utc(2026, 7, 18, 12),
          ),
        ),
        SnapshotConflictOutcome.apply,
      );
    });

    test(
      'equal source + different content: equal/earlier generatedAt is rejected',
      () {
        expect(
          SnapshotConflict.decide(
            _rev(
              source: t1,
              content: 'b',
              generated: DateTime.utc(2026, 7, 18, 11),
            ),
            _rev(
              source: t1,
              content: 'a',
              generated: DateTime.utc(2026, 7, 18, 12),
            ),
          ),
          SnapshotConflictOutcome.rejectedOlder,
        );
      },
    );

    test('generatedAt never outranks a newer stored source', () {
      // Incoming generated far later, but its source data is older -> rejected.
      expect(
        SnapshotConflict.decide(
          _rev(source: t1, generated: DateTime.utc(2026, 7, 18, 23)),
          _rev(source: t2, generated: DateTime.utc(2026, 7, 18, 12)),
        ),
        SnapshotConflictOutcome.rejectedOlder,
      );
    });
  });
}
