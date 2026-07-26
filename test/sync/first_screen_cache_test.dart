import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/sync/domain/first_screen_cache.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

/// The first-use cache predicate is about **materialization**, never about
/// whether the season happens to have a featured Grand Prix. A current season
/// with no scheduled events is a valid Home empty state and a usable cache: it
/// must not send the app back through bootstrap on every restart.
void main() {
  group('predicate', () {
    test('a materialized Home for the current season is usable', () {
      expect(
        hasUsableFirstScreenCache(
          currentSeason: 2026,
          materializedHomeSeason: 2026,
        ),
        isTrue,
      );
    });

    test('no materialized Home is not usable', () {
      expect(
        hasUsableFirstScreenCache(
          currentSeason: 2026,
          materializedHomeSeason: null,
        ),
        isFalse,
      );
    });

    test('a Home belonging to another season is not usable', () {
      expect(
        hasUsableFirstScreenCache(
          currentSeason: 2027,
          materializedHomeSeason: 2026,
        ),
        isFalse,
      );
    });

    test('no current season is not usable', () {
      expect(
        hasUsableFirstScreenCache(
          currentSeason: null,
          materializedHomeSeason: 2026,
        ),
        isFalse,
      );
    });
  });

  group('against a real database', () {
    late GridViewDatabase db;
    late ScriptedGridViewApi api;
    late SyncHarness h;

    /// A bootstrap for a season that has nothing scheduled yet.
    Map<String, dynamic> emptySeasonBootstrap({int season = 2026}) =>
        bootstrapEnvelope(
          season: season,
          calendar: <dynamic>[],
          drivers: <dynamic>[],
          constructors: <dynamic>[],
          circuits: <dynamic>[],
          driverStandings: <dynamic>[],
          constructorStandings: <dynamic>[],
          home: emptyHomeJson(),
        );

    setUp(() {
      db = GridViewDatabase.forTesting(NativeDatabase.memory());
      api = ScriptedGridViewApi();
      h = SyncHarness(db, api);
    });
    tearDown(() async {
      await h.dispose();
      await db.close();
    });

    test('a current season with no events counts as usable cache', () async {
      api.bootstrap = (_) => bootstrapModified(emptySeasonBootstrap());
      await h.coordinator.start();

      expect(await db.seasonDao.countCurrentSeason(), 1);
      expect(await h.repositories.home.materializedSeason(), 2026);
      expect(
        hasUsableFirstScreenCache(
          currentSeason: 2026,
          materializedHomeSeason: await h.repositories.home
              .materializedSeason(),
        ),
        isTrue,
      );
    });

    test('an empty season produces a defined local empty read model', () async {
      api.bootstrap = (_) => bootstrapModified(emptySeasonBootstrap());
      await h.coordinator.start();

      final HomeView? view = await h.repositories.home.readHome();
      expect(view, isNotNull, reason: 'an empty season still renders');
      expect(view!.seasonYear, 2026);
      expect(view.featured, isNull);
      expect(view.hasFeaturedEvent, isFalse);
      expect(view.freshness.generatedAt, isNotNull);
    });

    test(
      'a Home from an older season does not make the cache usable',
      () async {
        // Materialize 2026, then make 2027 current without a 2027 Home.
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.coordinator.start();
        expect(await h.repositories.home.materializedSeason(), 2026);

        await db.seasonDao.setCurrentSeason(
          (await db.seasonDao.readSeason(2026))!,
        );
        expect(
          hasUsableFirstScreenCache(
            currentSeason: 2027,
            materializedHomeSeason: await h.repositories.home
                .materializedSeason(),
          ),
          isFalse,
        );
      },
    );
  });

  group('across a close and reopen', () {
    late Directory tempDir;
    late File dbFile;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('gridview_empty_home');
      dbFile = File('${tempDir.path}/gridview_v2.sqlite');
    });
    tearDown(() {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    });

    test(
      'a valid empty Home survives reopen and startup does not bootstrap again',
      () async {
        GridViewDatabase db = GridViewDatabase.forTesting(
          NativeDatabase(dbFile),
        );
        ScriptedGridViewApi api = ScriptedGridViewApi()
          ..bootstrap = (_) => bootstrapModified(
            bootstrapEnvelope(
              calendar: <dynamic>[],
              drivers: <dynamic>[],
              constructors: <dynamic>[],
              circuits: <dynamic>[],
              driverStandings: <dynamic>[],
              constructorStandings: <dynamic>[],
              home: emptyHomeJson(),
            ),
          );
        SyncHarness h = SyncHarness(db, api);
        await h.coordinator.start();
        expect(api.callsFor('bootstrap'), 1);
        await h.dispose();
        await db.close();

        // Restart: the empty Home is still materialized, so the returning
        // launch must NOT go through bootstrap again.
        db = GridViewDatabase.forTesting(NativeDatabase(dbFile));
        api = ScriptedGridViewApi();
        h = SyncHarness(db, api);
        addTearDown(() async {
          await h.dispose();
          await db.close();
        });

        expect(await h.repositories.home.materializedSeason(), 2026);
        await h.coordinator.start();
        expect(
          api.callsFor('bootstrap'),
          0,
          reason: 'an empty but materialized Home is usable cache',
        );
      },
    );
  });
}
