import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';

/// Schema-version and initial-migration coverage for Drift version 1.
///
/// v1 is the initial schema, so there is no prior version to migrate from; these
/// tests pin the version, prove `onCreate` produces the full schema with the
/// expected columns and constraints, and guard the (season, round) uniqueness
/// rule. Future schema bumps must add explicit step tests here.
void main() {
  late GridViewDatabase db;

  setUp(() => db = GridViewDatabase.forTesting(NativeDatabase.memory()));
  tearDown(() => db.close());

  test('initial schema version is 1', () {
    expect(db.schemaVersion, 1);
  });

  test('grand_prix carries the expected columns', () async {
    final List<QueryRow> info = await db
        .customSelect('PRAGMA table_info(grand_prix)')
        .get();
    final Set<String> columns = info
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();
    expect(
      columns,
      containsAll(<String>[
        'id',
        'season',
        'round',
        'event_slug',
        'name',
        'official_name',
        'circuit_id',
        'status',
        'format',
        'start_date',
        'end_date',
        'timezone',
        'has_results',
      ]),
    );
  });

  test('sessions store an explicit order index', () async {
    final List<QueryRow> info = await db
        .customSelect('PRAGMA table_info(sessions)')
        .get();
    final Set<String> columns = info
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();
    expect(columns, contains('order_index'));
  });

  test(
    '(season, round) uniqueness is enforced beyond the id primary key',
    () async {
      await db
          .into(db.seasons)
          .insert(
            SeasonsCompanion.insert(year: const Value(2026), status: 'active'),
          );
      await db
          .into(db.circuits)
          .insert(CircuitsCompanion.insert(id: 'spa', name: 'Spa'));

      GrandPrixEventsCompanion event(String id) =>
          GrandPrixEventsCompanion.insert(
            id: id,
            season: 2026,
            round: 13,
            eventSlug: 'belgian-grand-prix',
            name: 'Belgian Grand Prix',
            circuitId: 'spa',
            status: 'upcoming',
            format: 'sprint',
          );

      await db
          .into(db.grandPrixEvents)
          .insert(event('2026-belgian-grand-prix'));
      await expectLater(
        db.into(db.grandPrixEvents).insert(event('2026-belgian-duplicate')),
        throwsA(anything),
      );
    },
  );
}
