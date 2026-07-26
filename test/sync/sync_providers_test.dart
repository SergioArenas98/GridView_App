import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/sync/application/app_sync_coordinator.dart';
import 'package:gridview/features/sync/application/app_sync_lifecycle.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';

ProviderContainer container(
  GridViewDatabase db,
  ScriptedGridViewApi api, {
  int concurrency = kDefaultSyncConcurrency,
}) {
  final ProviderContainer c = ProviderContainer(
    overrides: [
      databaseProvider.overrideWithValue(db),
      remoteApiProvider.overrideWithValue(api),
      clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
      syncConcurrencyProvider.overrideWithValue(concurrency),
    ],
  );
  addTearDown(c.dispose);
  return c;
}

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
  });
  tearDown(() => db.close());

  group('provider graph', () {
    test('every dependency is override-friendly', () {
      final ProviderContainer c = container(db, api, concurrency: 2);
      expect(c.read(databaseProvider), same(db));
      expect(c.read(remoteApiProvider), same(api));
      expect(c.read(syncConcurrencyProvider), 2);
      expect(c.read(appSyncCoordinatorProvider), isA<AppSyncCoordinator>());
    });

    test(
      'one database instance backs every repository and the coordinator',
      () {
        final ProviderContainer c = container(db, api);
        // Reading the whole graph must never open a second database.
        c.read(resourceRefreshDispatcherProvider);
        c.read(appSyncCoordinatorProvider);
        expect(c.read(databaseProvider), same(db));
        expect(
          identical(c.read(databaseProvider), c.read(databaseProvider)),
          isTrue,
        );
      },
    );

    test('the aggregate state provider needs no database of its own', () {
      // A feature controller can observe application synchronization without
      // pulling in the data layer at all.
      final ProviderContainer c = ProviderContainer();
      addTearDown(c.dispose);
      expect(c.read(appSyncStateProvider), isA<AppSyncIdle>());
    });

    test(
      'the coordinator publishes its state through the state provider',
      () async {
        final ProviderContainer c = container(db, api);
        final List<AppSyncState> seen = <AppSyncState>[];
        c.listen<AppSyncState>(
          appSyncStateProvider,
          (AppSyncState? _, AppSyncState next) => seen.add(next),
        );

        await c.read(appSyncCoordinatorProvider).start();
        await Future<void>.delayed(Duration.zero);

        expect(seen.whereType<AppSyncRunning>(), isNotEmpty);
        expect(seen.last, isA<AppSyncCompleted>());
        expect(c.read(appSyncStateProvider), isA<AppSyncCompleted>());
      },
    );

    test('disposing the scope cancels the run in flight', () async {
      final ProviderContainer c = container(db, api);
      final Completer<void> gate = Completer<void>();
      api.bootstrap = (_) async {
        await gate.future;
        return bootstrapModified(bootstrapEnvelope());
      };

      final AppSyncCoordinator coordinator = c.read(appSyncCoordinatorProvider);
      final Future<void> run = coordinator.start();
      await Future<void>.delayed(Duration.zero);
      c.dispose();
      gate.complete();
      await run;

      expect(coordinator.state, isNot(isA<AppSyncCompleted>()));
      // A disposed coordinator schedules nothing further.
      await coordinator.refreshNow();
      expect(api.callsFor('currentSeason'), 0);
    });

    test('the manual entry point needs no BuildContext', () async {
      final ProviderContainer c = container(db, api);
      await refreshCurrentSeasonCore(c.read(_refProvider));
      expect(c.read(appSyncStateProvider), isA<AppSyncState>());
    });
  });

  group('lifecycle bridge', () {
    testWidgets(
      'the startup run happens after the first frame, not during it',
      (WidgetTester tester) async {
        final Completer<void> gate = Completer<void>();
        api.bootstrap = (_) async {
          await gate.future;
          return bootstrapModified(bootstrapEnvelope());
        };

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              databaseProvider.overrideWithValue(db),
              remoteApiProvider.overrideWithValue(api),
              clockProvider.overrideWithValue(
                () => DateTime.utc(2026, 7, 18, 12),
              ),
            ],
            child: const AppSyncLifecycleScope(
              child: Directionality(
                textDirection: TextDirection.ltr,
                child: Text('shell'),
              ),
            ),
          ),
        );

        // The shell is on screen while bootstrap is still hanging.
        expect(find.text('shell'), findsOneWidget);
        await tester.pump();
        expect(api.callsFor('bootstrap'), 1);
        gate.complete();
        await tester.pumpAndSettle();
      },
    );

    testWidgets('a rebuild never triggers synchronization', (
      WidgetTester tester,
    ) async {
      final ValueNotifier<int> rebuilds = ValueNotifier<int>(0);
      addTearDown(rebuilds.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            databaseProvider.overrideWithValue(db),
            remoteApiProvider.overrideWithValue(api),
            clockProvider.overrideWithValue(
              () => DateTime.utc(2026, 7, 18, 12),
            ),
          ],
          child: AppSyncLifecycleScope(
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: ValueListenableBuilder<int>(
                valueListenable: rebuilds,
                builder: (BuildContext context, int value, _) => Text('$value'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final int afterStartup = api.callsFor('bootstrap');

      for (int i = 0; i < 5; i++) {
        rebuilds.value = i + 1;
        await tester.pumpAndSettle();
      }
      expect(api.callsFor('bootstrap'), afterStartup);
    });

    testWidgets('only a genuine background → resumed transition refreshes', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            databaseProvider.overrideWithValue(db),
            remoteApiProvider.overrideWithValue(api),
            clockProvider.overrideWithValue(
              () => DateTime.utc(2026, 7, 18, 12),
            ),
          ],
          child: const AppSyncLifecycleScope(
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Text('shell'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      api.calls.clear();

      // A transient inactive → resumed (an iOS overlay) is not a return from
      // the background.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(api.calls, isEmpty);

      // A real background → resumed is.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(api.calls, isNotEmpty);
    });

    testWidgets('no BuildContext is retained by the coordinator', (
      WidgetTester tester,
    ) async {
      final ProviderContainer c = container(db, api);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: const AppSyncLifecycleScope(
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Text('shell'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tearing the whole tree down leaves the coordinator perfectly usable:
      // it never held on to anything from the widget layer.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      expect(c.read(appSyncCoordinatorProvider).state, isA<AppSyncState>());
    });
  });
}

/// Exposes a [Ref] so the context-free manual entry point can be called from a
/// plain test.
final Provider<Ref> _refProvider = Provider<Ref>((Ref ref) => ref);
