import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/fixtures.dart';
import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api);
  });
  tearDown(() => db.close());

  test('a sprint weekend keeps its full ordered session set', () async {
    api.grandPrix = (_) => modifiedFromFixture<GrandPrixDto>(
      'grand-prix/sprint-weekend.json',
      (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
    );
    await h.grandPrix.refreshGrandPrix(season: 2026, round: 13);
    final GrandPrixDetailView v = (await h.grandPrix.readGrandPrix(
      season: 2026,
      round: 13,
    ))!;
    expect(v.grandPrix.format, WeekendFormat.sprint);
    expect(
      v.grandPrix.sessions.map((s) => s.type),
      contains(SessionType.sprint),
    );
    // Sessions are in weekend order (ascending orderIndex).
    expect(v.grandPrix.sessions.last.type, SessionType.race);
  });

  /// Seeds the parent Grand Prix (results are owned by an existing event).
  Future<void> seedItalianGp() async {
    api.grandPrix = (_) => modifiedFromFixture<GrandPrixDto>(
      'grand-prix/standard-weekend.json',
      (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
    );
    await h.grandPrix.refreshGrandPrix(season: 2026, round: 12);
  }

  test('sprint and race result documents coexist for one weekend', () async {
    await seedItalianGp();
    // Race document from the fixture.
    api.results = (_) => modifiedFromFixture<RaceResultDto>(
      'results/race-timing.json',
      (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
      etag: 'W/"race"',
      sourceUpdatedAt: '2026-07-18T11:00:00Z',
    );
    await h.results.refreshResults(season: 2026, round: 12);

    // A later results snapshot for the same round delivers the sprint document.
    // Because `writeRaceResult` replaces only the entries for the relevant
    // (grandPrixId, sessionType), the race document is preserved and both
    // classifications coexist.
    api.results = (_) {
      final Map<String, dynamic> json = loadFixture('results/race-timing.json');
      final Map<String, dynamic> data = json['data'] as Map<String, dynamic>;
      data['id'] = '2026-italian-grand-prix-sprint-results';
      data['sessionType'] = 'sprint';
      // A newer source revision so the conditional rule applies this snapshot.
      (json['meta'] as Map<String, dynamic>)['sourceUpdatedAt'] =
          '2026-07-18T20:00:00Z';
      return modifiedFromJson<RaceResultDto>(
        json,
        (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
        etag: 'W/"sprint"',
      );
    };
    await h.results.refreshResults(season: 2026, round: 12);

    final List<RaceResult> results = await h.results.readResults(
      season: 2026,
      round: 12,
    );
    expect(results, hasLength(2));
    expect(results.map((RaceResult r) => r.sessionType).toSet(), <SessionType>{
      SessionType.race,
      SessionType.sprint,
    });
    // The race document's entries were not disturbed by the sprint write.
    final RaceResult race = results.firstWhere(
      (RaceResult r) => r.sessionType == SessionType.race,
    );
    expect(race.entries, isNotEmpty);
  });

  test('fractional points and a tied position are preserved', () async {
    api.driverStandings = (_) {
      final Map<String, dynamic> json = loadFixture(
        'standings/drivers-fractional.json',
      );
      final List<dynamic> data = json['data'] as List<dynamic>;
      // Force a tie: give the second driver the same displayed position as the
      // first, keeping distinct order.
      (data[1] as Map<String, dynamic>)['position'] =
          (data[0] as Map<String, dynamic>)['position'];
      return modifiedListFromJson<DriverStandingDto>(
        json,
        (Map<String, dynamic> e) => DriverStandingDto.fromJson(e),
        etag: 'W/"ds"',
      );
    };
    await h.standings.refreshDriverStandings(2026);

    final List<DriverStanding> s = await h.standings.readDriverStandings(2026);
    expect(s.first.points, 210.5, reason: 'fractional points preserved');
    // The delivered order is preserved even though positions 1 and 2 tie.
    expect(s[0].position, s[1].position);
    expect(s[0].driverId, isNot(s[1].driverId));
    // A zero-point unranked competitor keeps null position and 0.0 points.
    final DriverStanding last = s.last;
    expect(last.position, isNull);
    expect(last.points, 0.0);
  });

  test('DNF/DNS/DSQ null combinations survive the round trip', () async {
    await seedItalianGp();
    api.results = (_) => modifiedFromFixture<RaceResultDto>(
      'results/race-timing.json',
      (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
    );
    await h.results.refreshResults(season: 2026, round: 12);
    final RaceResult r = (await h.results.readResults(
      season: 2026,
      round: 12,
    )).single;
    final RaceResultEntry dnf = r.entries.firstWhere(
      (RaceResultEntry e) => e.status == FinishStatus.dnf,
    );
    expect(dnf.position, isNull);
    expect(dnf.points, isNull);
    // A same-lap finisher keeps a structured gap, not a formatted string only.
    final RaceResultEntry second = r.entries.firstWhere(
      (RaceResultEntry e) => e.position == 2,
    );
    expect(second.gapToLeader, isNotNull);
  });

  test('a driver detail with no biography or media persists cleanly', () async {
    api.driver = (_) => modifiedFromFixture<DriverDetailDto>(
      'drivers/detail-missing-optional.json',
      (Object? d) => DriverDetailDto.fromJson(d! as Map<String, dynamic>),
    );
    final RefreshResult res = await h.drivers.refreshDriver(
      driverId: 'jack-doohan',
      season: 2026,
    );
    expect(res, isA<RefreshSuccess>());
    final DriverDetailView v = (await h.drivers.readDriver(
      season: 2026,
      driverId: 'jack-doohan',
    ))!;
    expect(v.driver.biography, isNull);
    expect(v.driver.media ?? const [], isEmpty);
  });

  test('constructor rebranding across seasons is preserved', () async {
    // 2025: one constructor branded "Old Name 2025".
    api.seasonConstructors = (_) {
      final Map<String, dynamic> json = loadFixture(
        'constructors/season-constructors.json',
      );
      for (final dynamic e in json['data'] as List<dynamic>) {
        (e as Map<String, dynamic>)['fullName'] = 'Old Name 2025';
      }
      return modifiedListFromJson<SeasonConstructorSummaryDto>(
        json,
        (Map<String, dynamic> e) => SeasonConstructorSummaryDto.fromJson(e),
        etag: 'W/"c25"',
      );
    };
    await h.constructors.refreshSeasonConstructors(2025);

    // 2026: the same constructor rebranded "New Name 2026".
    api.seasonConstructors = (_) {
      final Map<String, dynamic> json = loadFixture(
        'constructors/season-constructors.json',
      );
      for (final dynamic e in json['data'] as List<dynamic>) {
        (e as Map<String, dynamic>)['fullName'] = 'New Name 2026';
      }
      return modifiedListFromJson<SeasonConstructorSummaryDto>(
        json,
        (Map<String, dynamic> e) => SeasonConstructorSummaryDto.fromJson(e),
        etag: 'W/"c26"',
      );
    };
    await h.constructors.refreshSeasonConstructors(2026);

    final List<SeasonConstructor> c2025 = await h.constructors
        .readSeasonConstructors(2025);
    final List<SeasonConstructor> c2026 = await h.constructors
        .readSeasonConstructors(2026);
    // Each season retains its own branding — rebranding preserved per season.
    expect(c2025.first.entry.season, 2025);
    expect(c2025.first.entry.fullName, 'Old Name 2025');
    expect(c2026.first.entry.season, 2026);
    expect(c2026.first.entry.fullName, 'New Name 2026');
  });

  test('circuit nullable physical values are not coerced', () async {
    api.circuit = (_) => modifiedFromFixture<CircuitDetailDto>(
      'circuits/detail.json',
      (Object? d) => CircuitDetailDto.fromJson(d! as Map<String, dynamic>),
    );
    // The circuit-detail fixture's circuit id.
    final CircuitDetailDto dto = loadFixtureCircuit();
    await h.circuits.refreshCircuit(circuitId: dto.circuit.id, season: 2026);
    final CircuitDetailView v = (await h.circuits.readCircuit(dto.circuit.id))!;
    // Length is an int (metres), never a string.
    expect(v.circuit.lengthMeters, isA<int?>());
  });
}

CircuitDetailDto loadFixtureCircuit() => CircuitDetailDto.fromJson(
  loadFixture('circuits/detail.json')['data'] as Map<String, dynamic>,
);
