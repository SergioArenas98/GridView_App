// Step 55C.11C: the pure CR-04 decision (C-R1). Completeness is exactly
// hasMaterializedCalendar for the screen's resolved season; staleness never
// removes it (CD-2). Every value is a test fixture.
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/circuits/application/circuit_event_association.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../support/domain_fixtures.dart';

ResourceSyncState _calendar(int season, {DateTime? staleAfter}) =>
    syncedMetadata(
      ResourceKey.calendar(season),
      season: season,
      staleAfter: staleAfter,
    );

ResourceSyncState _bootstrap(int season) =>
    syncedMetadata(ResourceKey.bootstrap(), season: season);

/// A record that was attempted but never succeeded (a failed first sync).
ResourceSyncState _neverSucceeded(String key, int season) => ResourceSyncState(
  resourceKey: key,
  season: season,
  lastAttemptAt: DateTime.utc(2026, 7, 18),
);

CircuitEventAssociation _decide({
  int? season = 2026,
  bool profileReady = true,
  bool related = false,
  bool calendarReady = true,
  ResourceSyncState? calendar,
  bool bootstrapReady = true,
  ResourceSyncState? bootstrap,
}) => circuitEventAssociation(
  season: season,
  profileReady: profileReady,
  hasRelatedEvent: related,
  calendarMetadataReady: calendarReady,
  calendarMetadata: calendar,
  bootstrapMetadataReady: bootstrapReady,
  bootstrapMetadata: bootstrap,
);

void main() {
  group('A. a stored related event is linked, whatever the calendar', () {
    test('1. calendar materialized', () {
      expect(
        _decide(related: true, calendar: _calendar(2026)),
        CircuitEventAssociation.linked,
      );
    });
    test('2. calendar not materialized (a single snapshot row)', () {
      expect(_decide(related: true), CircuitEventAssociation.linked);
    });
    test('metadata still loading does not hide a stored event', () {
      expect(
        _decide(related: true, calendarReady: false, bootstrapReady: false),
        CircuitEventAssociation.linked,
      );
    });
  });

  group('B. confirmed absence only with a materialized season calendar', () {
    test('3. own calendar record for the season', () {
      expect(
        _decide(calendar: _calendar(2026)),
        CircuitEventAssociation.confirmedNone,
      );
    });
    test('7. accepted bootstrap for this exact season (offline)', () {
      expect(
        _decide(bootstrap: _bootstrap(2026)),
        CircuitEventAssociation.confirmedNone,
      );
    });
    test('10. stale materialized calendar stays materialized (CD-2)', () {
      expect(
        _decide(calendar: _calendar(2026, staleAfter: DateTime.utc(2000))),
        CircuitEventAssociation.confirmedNone,
      );
    });
  });

  group('C. unknown without a materialized season calendar', () {
    test('4 / 6. no calendar and no bootstrap', () {
      expect(_decide(), CircuitEventAssociation.unknown);
    });
    test('8. a bootstrap for another season never materializes', () {
      expect(
        _decide(bootstrap: _bootstrap(2025)),
        CircuitEventAssociation.unknown,
      );
    });
    test('11. a materialized calendar of another season is never used', () {
      // The caller reads `calendar:<resolved season>`; a 2026 record handed
      // in for a 2024 screen would be a caller bug, but the bootstrap scope
      // and the season match still refuse to materialize 2024.
      expect(
        _decide(season: 2024, bootstrap: _bootstrap(2026)),
        CircuitEventAssociation.unknown,
      );
    });
    test('an attempted but never successful calendar sync is unknown', () {
      expect(
        _decide(
          calendar: _neverSucceeded(ResourceKey.calendar(2026), 2026),
          bootstrap: _neverSucceeded(ResourceKey.bootstrap(), 2026),
        ),
        CircuitEventAssociation.unknown,
      );
    });
  });

  group('resolving: never a premature absence', () {
    test('5. calendar metadata still loading', () {
      expect(_decide(calendarReady: false), CircuitEventAssociation.resolving);
    });
    test('bootstrap metadata still loading', () {
      expect(
        _decide(calendar: _calendar(2026), bootstrapReady: false),
        CircuitEventAssociation.resolving,
      );
    });
    test('profile not ready', () {
      expect(
        _decide(profileReady: false, calendar: _calendar(2026)),
        CircuitEventAssociation.resolving,
      );
    });
    test('season not resolved', () {
      expect(_decide(season: null), CircuitEventAssociation.resolving);
    });
  });
}
