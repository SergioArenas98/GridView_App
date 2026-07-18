import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_entry_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/features/shared/data/mappers/competitor_mapper.dart';
import 'package:gridview/features/shared/data/mappers/event_mapper.dart';
import 'package:gridview/features/shared/data/mappers/participation_mapper.dart';
import 'package:gridview/features/shared/data/mappers/result_mapper.dart';
import 'package:gridview/features/shared/data/mappers/standing_mapper.dart';
import 'package:gridview/features/shared/domain/entities/entities.dart';

import '../support/fixtures.dart';

Map<String, dynamic> _data(String file) =>
    loadFixture(file)['data'] as Map<String, dynamic>;

GrandPrix _grandPrix(String file) =>
    grandPrixFromDto(GrandPrixDto.fromJson(_data(file)));

void main() {
  group('sprint and standard weekends share one model', () {
    final sprint = _grandPrix('grand-prix/sprint-weekend.json');
    final standard = _grandPrix('grand-prix/standard-weekend.json');

    test('sprint weekend carries sprint sessions', () {
      expect(sprint.format, WeekendFormat.sprint);
      expect(
        sprint.sessions.map((s) => s.type),
        containsAll([SessionType.sprintQualifying, SessionType.sprint]),
      );
    });

    test('standard weekend carries a third practice', () {
      expect(standard.format, WeekendFormat.standard);
      expect(
        standard.sessions.map((s) => s.type),
        contains(SessionType.practice3),
      );
    });
  });

  test('unknown enum values map to unknown', () {
    final gp = _grandPrix('grand-prix/unknown-enum-status.json');
    expect(gp.status, EventStatus.unknown);
    expect(gp.sessions.first.type, SessionType.unknown);
  });

  test('unknown additive fields are ignored safely', () {
    final gp = _grandPrix('grand-prix/unknown-additive.json');
    expect(gp.status, EventStatus.completed);
    expect(gp.sessions, hasLength(1));
  });

  test('UTC instants and IANA timezone strings stay distinct', () {
    final gp = _grandPrix('grand-prix/standard-weekend.json');
    final race = gp.sessions.firstWhere((s) => s.type == SessionType.race);
    expect(race.startTime, isNotNull);
    expect(race.startTime!.isUtc, isTrue);
    expect(gp.timezone, 'Europe/Rome');
  });

  test('missing optional fields remain null, never zero or empty', () {
    final driver = driverFromDto(
      DriverDetailDto.fromJson(
        _data('drivers/detail-missing-optional.json'),
      ).driver,
    );
    expect(driver.biography, isNull);
    expect(driver.media, isNull);
    expect(driver.countryCode, isNull);
    expect(driver.dateOfBirth, isNull);
  });

  test('fractional and zero championship points are preserved', () {
    final standings =
        (loadFixture('standings/drivers-fractional.json')['data'] as List)
            .map(
              (e) => driverStandingFromDto(
                DriverStandingDto.fromJson(e as Map<String, dynamic>),
              ),
            )
            .toList();
    final piastri = standings.firstWhere((s) => s.driverId == 'oscar-piastri');
    expect(piastri.points, 192.5);
    final colapinto = standings.firstWhere(
      (s) => s.driverId == 'franco-colapinto',
    );
    expect(colapinto.points, 0.0);
    expect(colapinto.position, isNull);
  });

  test('mid-season entries preserve round spans', () {
    final entries =
        loadFixtureList('entities/driver-season-entries-alpine.json')
            .map(
              (e) => driverSeasonEntryFromDto(
                DriverSeasonEntryDto.fromJson(e as Map<String, dynamic>),
              ),
            )
            .toList();
    final doohan = entries.firstWhere((e) => e.driverId == 'jack-doohan');
    expect(doohan.endRound, 9);
    final colapinto = entries.firstWhere(
      (e) => e.driverId == 'franco-colapinto',
    );
    expect(colapinto.startRound, 10);
    expect(colapinto.endRound, isNull);
  });

  test('constructor rebranding preserves stable constructor identity', () {
    final entries = loadFixtureList('entities/constructor-rebranding.json')
        .map(
          (e) => constructorSeasonEntryFromDto(
            ConstructorSeasonEntryDto.fromJson(e as Map<String, dynamic>),
          ),
        )
        .toList();
    expect(entries.map((e) => e.constructorId).toSet(), {'sauber'});
    expect(entries.map((e) => e.fullName).toSet().length, 2);
  });

  test('structured race timing values are preserved', () {
    final result = raceResultFromDto(
      RaceResultDto.fromJson(_data('results/race-timing.json')),
    );
    final winner = result.entries[0];
    expect(winner.elapsedTime, const Duration(milliseconds: 4512345));
    expect(winner.gapToLeader, isNull);
    expect(winner.points, 12.5);

    final gapped = result.entries[1];
    expect(gapped.gapToLeader, const Duration(milliseconds: 3456));
    expect(gapped.fastestLap, isTrue);

    final lapped = result.entries[3];
    expect(lapped.status, FinishStatus.lapped);
    expect(lapped.lapsBehind, 1);

    final dnf = result.entries[4];
    expect(dnf.status, FinishStatus.dnf);
    expect(dnf.position, isNull);
    expect(dnf.points, isNull);
  });
}
