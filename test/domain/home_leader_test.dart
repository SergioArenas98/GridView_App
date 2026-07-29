import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/home/domain/home_leader.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';

import '../support/domain_fixtures.dart';

/// The two championships are resolved independently but by identical rules, so
/// each case is asserted for both.
void main() {
  group('drivers', () {
    test('one confirmed position 1 is the leader', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          constructorName: 'Red Bull Racing',
          teamColor: '#1E41FF',
          order: 0,
          position: 1,
          points: 241,
          wins: 6,
        ),
      ]);

      final HomeSingleLeader single = leader as HomeSingleLeader;
      expect(single.entityId, 'max-verstappen');
      expect(single.name, 'Max Verstappen');
      expect(single.points, 241);
      expect(single.teamName, 'Red Bull Racing');
      expect(single.wins, 6);
    });

    test('no confirmed position 1 is unavailable, never the top row', () {
      final HomeLeader leader = resolveDriverLeader(
        // Deliberately empty: the composition only ever supplies confirmed
        // position-1 rows, so "no leader" is exactly "no rows".
        const <DriverStandingEntry>[],
      );
      expect(leader, isA<HomeLeaderUnavailable>());
    });

    test('a tie is preserved rather than collapsed to one competitor', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
        driverStandingEntry(
          driverId: 'lando-norris',
          driverName: 'Lando Norris',
          order: 1,
          position: 1,
          points: 241,
        ),
      ]);

      final HomeTiedLeaders tied = leader as HomeTiedLeaders;
      expect(tied.names, <String>['Max Verstappen', 'Lando Norris']);
      expect(tied.count, 2);
      expect(tied.points, 241);
    });

    test('tied rows with different points claim no shared total', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'a',
          driverName: 'A',
          order: 0,
          position: 1,
          points: 241,
        ),
        driverStandingEntry(
          driverId: 'b',
          driverName: 'B',
          order: 1,
          position: 1,
          points: 240,
        ),
      ]);
      expect((leader as HomeTiedLeaders).points, isNull);
    });

    test('a tie contributes no identifier for an unresolved identity', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
        driverStandingEntry(
          driverId: 'unsynced-driver',
          order: 1,
          position: 1,
          points: 241,
        ),
      ]);

      final HomeTiedLeaders tied = leader as HomeTiedLeaders;
      expect(tied.names, <String>['Max Verstappen']);
      expect(tied.count, 2, reason: 'the tie is still two competitors');
      expect(tied.names.join(), isNot(contains('unsynced-driver')));
    });

    test('an unresolved single leader is unavailable, not humanised', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
      ]);
      expect(leader, isA<HomeLeaderUnavailable>());
    });

    test('a confirmed zero stays zero', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'rookie',
          driverName: 'Rookie Driver',
          order: 0,
          position: 1,
          points: 0,
        ),
      ]);
      expect((leader as HomeSingleLeader).points, 0);
    });

    test('fractional points are preserved exactly', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241.5,
        ),
      ]);
      expect((leader as HomeSingleLeader).points, 241.5);
    });

    test('a missing team association is not guessed', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
      ]);
      final HomeSingleLeader single = leader as HomeSingleLeader;
      expect(single.teamName, isNull);
      expect(single.teamColor, isNull);
    });

    test('provisional state is carried through', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
          provisional: true,
        ),
      ]);
      expect((leader as HomeSingleLeader).provisional, isTrue);
    });

    test('an unspecified wins count stays null, never zero', () {
      final HomeLeader leader = resolveDriverLeader(<DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
      ]);
      expect((leader as HomeSingleLeader).wins, isNull);
    });
  });

  group('constructors', () {
    test('one confirmed position 1 is the leader, season name first', () {
      final HomeLeader leader =
          resolveConstructorLeader(<ConstructorStandingEntry>[
            constructorStandingEntry(
              constructorId: 'red-bull',
              seasonName: 'Oracle Red Bull Racing',
              stableName: 'Red Bull',
              teamColor: '#1E41FF',
              order: 0,
              position: 1,
              points: 402,
            ),
          ]);

      final HomeSingleLeader single = leader as HomeSingleLeader;
      expect(single.entityId, 'red-bull');
      expect(single.name, 'Oracle Red Bull Racing');
      expect(single.points, 402);
    });

    test('no confirmed position 1 is unavailable', () {
      expect(
        resolveConstructorLeader(const <ConstructorStandingEntry>[]),
        isA<HomeLeaderUnavailable>(),
      );
    });

    test('a tie is preserved', () {
      final HomeLeader leader =
          resolveConstructorLeader(<ConstructorStandingEntry>[
            constructorStandingEntry(
              constructorId: 'red-bull',
              stableName: 'Red Bull',
              order: 0,
              position: 1,
              points: 402,
            ),
            constructorStandingEntry(
              constructorId: 'mclaren',
              stableName: 'McLaren',
              order: 1,
              position: 1,
              points: 402,
            ),
          ]);
      expect((leader as HomeTiedLeaders).names, <String>[
        'Red Bull',
        'McLaren',
      ]);
    });

    test('an unresolved single leader is unavailable', () {
      final HomeLeader leader =
          resolveConstructorLeader(<ConstructorStandingEntry>[
            constructorStandingEntry(
              constructorId: 'red-bull',
              order: 0,
              position: 1,
              points: 402,
            ),
          ]);
      expect(leader, isA<HomeLeaderUnavailable>());
    });

    test('a confirmed zero stays zero and fractions are exact', () {
      expect(
        (resolveConstructorLeader(<ConstructorStandingEntry>[
                  constructorStandingEntry(
                    constructorId: 'a',
                    stableName: 'A',
                    order: 0,
                    position: 1,
                    points: 0,
                  ),
                ])
                as HomeSingleLeader)
            .points,
        0,
      );
      expect(
        (resolveConstructorLeader(<ConstructorStandingEntry>[
                  constructorStandingEntry(
                    constructorId: 'a',
                    stableName: 'A',
                    order: 0,
                    position: 1,
                    points: 0.5,
                  ),
                ])
                as HomeSingleLeader)
            .points,
        0.5,
      );
    });
  });
}
