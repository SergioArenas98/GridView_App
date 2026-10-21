// The app half of release gate AU-3 (ADR 0028 D10;
// `docs/release/automatic-updates.md`).
//
// The real data layer - `AppSyncCoordinator`, every repository, the Drift
// database and the production Dio client - refreshes over HTTP from a local
// server that hosts the real edge Worker in coordinated mode with controlled
// Jolpica data (`services/edge-api/test/e2e/automatic-updates/app-gate.test.ts`).
// Between launches the server only runs the Worker's scheduled handler; no
// admin request, capture or submission is ever made.
//
// Skipped unless that edge test starts it with
// `--dart-define=GRIDVIEW_E2E_BASE_URL=http://127.0.0.1:<port>`.

import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/network/api_config.dart';
import 'package:gridview/core/network/gridview_dio.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/sync/application/app_sync_coordinator.dart';
import 'package:gridview/features/sync/data/resource_refresh_dispatcher.dart';

import '../support/repository_harness.dart';

const String baseUrl = String.fromEnvironment('GRIDVIEW_E2E_BASE_URL');

/// The edge stage's control surface. It is served by the test server, never
/// by the Worker.
class Stage {
  Stage(this.base);

  final String base;
  final HttpClient _http = HttpClient();

  Future<Map<String, Object?>> _call(String method, String path) async {
    final HttpClientRequest request = await _http.openUrl(
      method,
      Uri.parse('$base$path'),
    );
    final HttpClientResponse response = await request.close();
    final String body = await response.transform(utf8.decoder).join();
    if (response.statusCode != 200) {
      throw StateError('$method $path -> ${response.statusCode} $body');
    }
    return jsonDecode(body) as Map<String, Object?>;
  }

  /// The Worker's scheduled handler, hourly at minute 17, up to [to].
  Future<Map<String, Object?>> advance(String to) =>
      _call('POST', '/__e2e/advance?to=${Uri.encodeQueryComponent(to)}');

  Future<Map<String, Object?>> state() => _call('GET', '/__e2e/state');

  void close() => _http.close(force: true);
}

/// One app launch at [now]: a fresh coordinator over the same database, as a
/// process restart builds it.
class Launch {
  Launch(GridViewDatabase db, DateTime now)
    : repositories = RepositoryHarness(
        db,
        DioGridViewApi(buildGridViewDio(const ApiConfig(baseUrl: baseUrl))),
        now: now,
      ) {
    coordinator = AppSyncCoordinator(
      dispatcher: ResourceRefreshDispatcher(
        bootstrap: repositories.bootstrap,
        season: repositories.season,
        home: repositories.home,
        calendar: repositories.calendar,
        standings: repositories.standings,
        drivers: repositories.drivers,
        constructors: repositories.constructors,
        circuits: repositories.circuits,
        content: repositories.content,
        grandPrix: repositories.grandPrix,
        results: repositories.results,
      ),
      seasons: repositories.season,
      home: repositories.home,
      bootstrap: repositories.bootstrap,
      metadata: db.syncMetadataDao,
      now: repositories.now,
    );
  }

  final RepositoryHarness repositories;
  late final AppSyncCoordinator coordinator;
}

void main() {
  test(
    'a newly available result, and its correction, reach the app with no '
    'manual capture or submission',
    () async {
      final Stage stage = Stage(baseUrl);
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      final List<Launch> launches = <Launch>[];
      Future<Launch> launch(String at) async {
        final Launch l = Launch(db, DateTime.parse(at));
        launches.add(l);
        await l.coordinator.start();
        return l;
      }

      Future<bool> roundOneClassified(Launch l) async {
        final List<CalendarEntry> calendar = await l.repositories.calendar
            .readCalendar(2026);
        return calendar
            .firstWhere((CalendarEntry e) => e.grandPrix.round == 1)
            .grandPrix
            .hasResults;
      }

      Future<double?> winnerPoints(Launch l) async {
        final List<RaceResult> results = await l.repositories.results
            .readResults(season: 2026, round: 1);
        if (results.isEmpty) return null;
        return results.first.entries
            .firstWhere((RaceResultEntry e) => e.position == 1)
            .points;
      }

      try {
        final Map<String, Object?> start = await stage.state();
        final String raceStart = start['raceStart']! as String;
        DateTime at(int hours, [int minutes = 0]) => DateTime.parse(
          raceStart,
        ).add(Duration(hours: hours, minutes: minutes));

        // First use, then a normal launch: the season before the race.
        await launch(start['now']! as String);
        Launch l = await launch(
          DateTime.parse(
            start['now']! as String,
          ).add(const Duration(minutes: 5)).toIso8601String(),
        );
        expect(await roundOneClassified(l), isFalse);

        // The race. Only the Worker's hourly runs happen; its first check is
        // the first tick at or after the start + 90 min, + 2 h 17 min, and
        // Jolpica has the result from + 2 h.
        await stage.advance(at(2, 17).toIso8601String());
        l = await launch(at(2, 30).toIso8601String());
        expect(await roundOneClassified(l), isTrue);
        // The user opens the Grand Prix.
        await l.repositories.results.refreshResults(season: 2026, round: 1);
        expect(await winnerPoints(l), 25);

        // Jolpica corrects the classification 8 h after the start; the
        // Worker sights it at the + 9 h 30 min confirmation and, pending,
        // corroborates and publishes it on the next hourly tick, + 11 h 17.
        final Map<String, Object?> corrected = await stage.advance(
          at(11, 17).toIso8601String(),
        );
        expect(corrected['releases'], greaterThanOrEqualTo(3));
        l = await launch(at(11, 30).toIso8601String());
        // Converged without reopening the Grand Prix: the launch's release
        // follow-up refreshed the cached result.
        expect(await winnerPoints(l), 26);
      } finally {
        for (final Launch l in launches) {
          await l.coordinator.dispose();
        }
        await db.close();
        stage.close();
      }
    },
    skip: baseUrl.isEmpty
        ? 'Started by services/edge-api test/e2e/automatic-updates/app-gate.test.ts'
        : false,
    timeout: const Timeout(Duration(minutes: 5)),
  );
}
