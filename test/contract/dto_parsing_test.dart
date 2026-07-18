import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/season_entry_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/meta_dto.dart';
import 'package:gridview/core/api/errors/error_dto.dart';

import '../support/fixtures.dart';

typedef DtoParser = Object Function(Map<String, dynamic> json);

final Map<String, DtoParser> singleParsers = {
  'StatusData': StatusDataDto.fromJson,
  'BootstrapData': BootstrapDataDto.fromJson,
  'HomeData': HomeDataDto.fromJson,
  'ContentManifest': ContentManifestDto.fromJson,
  'Season': SeasonDto.fromJson,
  'GrandPrix': GrandPrixDto.fromJson,
  'GrandPrixSummary': GrandPrixSummaryDto.fromJson,
  'RaceResult': RaceResultDto.fromJson,
  'DriverStanding': DriverStandingDto.fromJson,
  'ConstructorStanding': ConstructorStandingDto.fromJson,
  'SeasonDriverSummary': SeasonDriverSummaryDto.fromJson,
  'SeasonConstructorSummary': SeasonConstructorSummaryDto.fromJson,
  'DriverDetail': DriverDetailDto.fromJson,
  'ConstructorDetail': ConstructorDetailDto.fromJson,
  'Circuit': CircuitDto.fromJson,
  'CircuitDetail': CircuitDetailDto.fromJson,
  'DriverSeasonEntry': DriverSeasonEntryDto.fromJson,
  'ConstructorSeasonEntry': ConstructorSeasonEntryDto.fromJson,
};

void main() {
  final manifest = loadManifest();

  test('every manifested fixture has a DTO parser', () {
    for (final entry in manifest.where((e) => e.type != 'error')) {
      expect(
        singleParsers.containsKey(entry.data),
        isTrue,
        reason: 'no parser registered for ${entry.data}',
      );
    }
  });

  group('Flutter parses every fixture', () {
    for (final entry in manifest) {
      test(entry.file, () {
        if (entry.type == 'error') {
          expect(ErrorEnvelopeDto.fromJson(loadFixture(entry.file)), isNotNull);
          return;
        }

        final parser = singleParsers[entry.data]!;

        if (entry.type == 'entity') {
          for (final item in loadFixtureList(entry.file)) {
            expect(parser(item as Map<String, dynamic>), isNotNull);
          }
          return;
        }

        final body = loadFixture(entry.file);
        expect(
          MetaDto.fromJson(body['meta'] as Map<String, dynamic>),
          isNotNull,
        );
        final data = body['data'];
        if (entry.dataKind == 'array') {
          for (final item in data as List) {
            expect(parser(item as Map<String, dynamic>), isNotNull);
          }
        } else {
          expect(parser(data as Map<String, dynamic>), isNotNull);
        }
      });
    }
  });
}
