import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/app.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/sync/application/app_sync_lifecycle.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';

/// Pumps the real application shell over a real (in-memory) database and the
/// real synchronization wiring, exactly as `bootstrap()` composes it.
Future<void> pumpRealApp(
  WidgetTester tester,
  GridViewDatabase db,
  ScriptedGridViewApi api,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        databaseProvider.overrideWithValue(db),
        remoteApiProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(
          () => DateTime.utc(2026, 7, 18, 12, 10),
        ),
        appEnvironmentProvider.overrideWithValue(AppEnvironment.development),
        usesMockDataProvider.overrideWithValue(false),
      ],
      child: const AppSyncLifecycleScope(child: GridViewApp()),
    ),
  );
}

/// Advances the widget tree without `pumpAndSettle`.
///
/// These tests deliberately run against the **real** Drift database, whose
/// stream queries keep a periodic timer alive; `pumpAndSettle` would wait for
/// that timer forever. A bounded pump loop flushes the microtasks the
/// synchronization run needs while leaving the timer alone.
Future<void> settle(WidgetTester tester, [int frames = 20]) async {
  for (int i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// Tears the tree down inside the test body and lets Drift's stream-query
/// store run the zero-duration timer it schedules when its streams close, so no
/// timer is left pending when the framework checks at the end of the test.
Future<void> teardownApp(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump(Duration.zero);
  await tester.pump(Duration.zero);
}

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
  });
  tearDown(() => db.close());

  testWidgets(
    'the navigation shell is built before any remote work completes',
    (WidgetTester tester) async {
      // A bootstrap that never completes: construction must not await it.
      api.bootstrap = (_) => Completer<Never>().future;

      await pumpRealApp(tester, db, api);
      await tester.pump();

      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.byType(GvBottomNav), findsOneWidget);
      expect(find.text('Calendar'), findsOneWidget);
      await teardownApp(tester);
    },
  );

  testWidgets(
    'an empty first launch shows the structured shell, not a splash',
    (WidgetTester tester) async {
      api.bootstrap = (_) => Completer<Never>().future;

      await pumpRealApp(tester, db, api);
      await tester.pump();

      // The Home branch renders its loading structure inside the real shell.
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.byType(GvSkeletonCard), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await teardownApp(tester);
    },
  );

  testWidgets('cached Home renders before a delayed response completes', (
    WidgetTester tester,
  ) async {
    // Seed the cache the way a previous launch would have.
    api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    final ProviderContainer seed = ProviderContainer(
      overrides: [
        databaseProvider.overrideWithValue(db),
        remoteApiProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
      ],
    );
    await seed.read(bootstrapRepositoryProvider).refreshBootstrap();
    seed.dispose();

    // Now every remote call hangs: the returning launch must still render.
    final Completer<Never> never = Completer<Never>();
    // Separate statements: a cascade would bind to the arrow's return value.
    api.bootstrap = (_) => never.future;
    api.home = (_) => never.future;
    api.currentSeason = (_) => never.future;
    api.calendar = (_) => never.future;

    await pumpRealApp(tester, db, api);
    await tester.pump();
    await tester.pump();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Belgian Grand Prix'), findsOneWidget);
    await teardownApp(tester);
  });

  testWidgets('startup does not request every v1 endpoint at once', (
    WidgetTester tester,
  ) async {
    api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());

    await pumpRealApp(tester, db, api);
    await settle(tester);

    expect(api.callsFor('bootstrap'), 1);
    for (final String endpoint in <String>[
      'home',
      'calendar',
      'currentSeason',
      'season',
      'driverStandings',
      'constructorStandings',
      'seasonDrivers',
      'seasonConstructors',
      'seasonCircuits',
      'contentManifest',
      'grandPrix',
      'results',
      'driver',
      'constructor',
      'circuit',
    ]) {
      expect(
        api.callsFor(endpoint),
        0,
        reason: '$endpoint must not be requested beside bootstrap',
      );
    }
    await teardownApp(tester);
  });

  testWidgets(
    'synchronization starts only after local rendering is available',
    (WidgetTester tester) async {
      // Record whether the shell was already on screen at the moment the first
      // request was issued.
      bool shellWasRendered = false;
      api.bootstrap = (_) {
        shellWasRendered = find.byType(HomeScreen).evaluate().isNotEmpty;
        return bootstrapModified(bootstrapEnvelope());
      };

      await pumpRealApp(tester, db, api);
      await settle(tester);

      expect(api.callsFor('bootstrap'), 1);
      expect(
        shellWasRendered,
        isTrue,
        reason: 'the run starts after the first frame, never before it',
      );
      await teardownApp(tester);
    },
  );
}
