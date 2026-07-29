import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/home/domain/home_race_winner.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';

import '../support/domain_fixtures.dart';

RaceResultEntry entry({
  required String driverId,
  String? driverName,
  String? constructorName,
  int? position,
  String constructorId = 'red-bull',
  FinishStatus status = FinishStatus.finished,
}) => RaceResultEntry(
  driverId: driverId,
  constructorId: constructorId,
  driverName: driverName,
  constructorName: constructorName,
  position: position,
  status: status,
);

void main() {
  test('no cached classification means no winner, not an error', () {
    expect(resolveHomeRaceWinner(null), isNull);
  });

  test('one confirmed position 1 with a resolved identity wins', () {
    final HomeRaceWinner? winner = resolveHomeRaceWinner(
      raceResultFixture(
        sessionType: SessionType.race,
        entries: <RaceResultEntry>[
          entry(
            driverId: 'lando-norris',
            driverName: 'Lando Norris',
            constructorName: 'McLaren',
            position: 2,
          ),
          entry(
            driverId: 'max-verstappen',
            driverName: 'Max Verstappen',
            constructorName: 'Red Bull Racing',
            position: 1,
          ),
        ],
      ),
    );

    expect(winner!.driverId, 'max-verstappen');
    expect(winner.name, 'Max Verstappen');
    expect(winner.teamName, 'Red Bull Racing');
  });

  test('the winner is not the first stored row', () {
    final HomeRaceWinner? winner = resolveHomeRaceWinner(
      raceResultFixture(
        sessionType: SessionType.race,
        entries: <RaceResultEntry>[
          entry(driverId: 'first-row', driverName: 'First Row', position: 7),
          entry(
            driverId: 'real-winner',
            driverName: 'Real Winner',
            position: 1,
          ),
        ],
      ),
    );
    expect(winner!.driverId, 'real-winner');
  });

  test('a sprint classification is never read as the race winner', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.sprint,
          entries: <RaceResultEntry>[
            entry(
              driverId: 'oscar-piastri',
              driverName: 'Oscar Piastri',
              position: 1,
            ),
          ],
        ),
      ),
      isNull,
    );
  });

  test('no entry with position 1 produces no winner', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.race,
          entries: <RaceResultEntry>[
            entry(driverId: 'a', driverName: 'A', position: 2),
            entry(driverId: 'b', driverName: 'B', position: 3),
          ],
        ),
      ),
      isNull,
    );
  });

  test('null positions never become a winner', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.race,
          entries: <RaceResultEntry>[
            entry(driverId: 'a', driverName: 'A'),
            entry(driverId: 'b', driverName: 'B'),
          ],
        ),
      ),
      isNull,
    );
  });

  test('two entries claiming position 1 pick no winner arbitrarily', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.race,
          entries: <RaceResultEntry>[
            entry(driverId: 'a', driverName: 'A', position: 1),
            entry(driverId: 'b', driverName: 'B', position: 1),
          ],
        ),
      ),
      isNull,
    );
  });

  test('an unresolved winner identity is never exposed', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.race,
          entries: <RaceResultEntry>[
            entry(driverId: 'max-verstappen', position: 1),
          ],
        ),
      ),
      isNull,
      reason: 'a stable identifier is not a display name',
    );
  });

  test('an unavailable classification yields no winner', () {
    expect(
      resolveHomeRaceWinner(
        raceResultFixture(
          sessionType: SessionType.race,
          status: ResultStatus.unavailable,
          entries: const <RaceResultEntry>[],
        ),
      ),
      isNull,
    );
  });

  test('a provisional classification can still name a winner', () {
    final HomeRaceWinner? winner = resolveHomeRaceWinner(
      raceResultFixture(
        sessionType: SessionType.race,
        status: ResultStatus.provisional,
        entries: <RaceResultEntry>[
          entry(driverId: 'a', driverName: 'A', position: 1),
        ],
      ),
    );
    expect(winner!.name, 'A');
  });

  test('a winner with no stored team keeps the team absent', () {
    final HomeRaceWinner? winner = resolveHomeRaceWinner(
      raceResultFixture(
        sessionType: SessionType.race,
        entries: <RaceResultEntry>[
          entry(driverId: 'a', driverName: 'A', position: 1),
        ],
      ),
    );
    expect(winner!.teamName, isNull);
  });
}
