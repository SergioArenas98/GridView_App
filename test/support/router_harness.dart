import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/app/router/app_router.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/application/home_providers.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/l10n/app_localizations.dart';

import 'domain_fixtures.dart';
import 'fake_repository.dart';

/// The default fake repository backing widget/navigation tests: a fresh Home
/// aggregate, a realistic season calendar and a coherent Grand Prix detail for
/// any (season, round). The real Drift pipeline is exercised in the
/// DAO/repository/controller tests.
FakeRaceWeekendRepository defaultFakeRepository() => FakeRaceWeekendRepository(
  home: homeViewFixture(),
  calendar: (int season) => calendarFixture(season: season),
  grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
);

/// A test host that mirrors [GridViewApp] but exposes locale, text-scale,
/// surface size and animation control so navigation, resilience and golden
/// tests can drive the real router.
class TestApp extends StatelessWidget {
  const TestApp({
    super.key,
    required this.router,
    this.textScale = 1.0,
    this.locale = const Locale('en'),
    this.disableAnimations = false,
    this.padding = EdgeInsets.zero,
  });

  final GoRouter router;
  final double textScale;
  final Locale locale;
  final bool disableAnimations;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
      builder: (BuildContext context, Widget? child) {
        Widget content = MediaQuery.withClampedTextScaling(
          minScaleFactor: textScale,
          maxScaleFactor: textScale,
          child: child!,
        );
        if (disableAnimations || padding != EdgeInsets.zero) {
          final MediaQueryData data = MediaQuery.of(context);
          content = MediaQuery(
            data: data.copyWith(
              disableAnimations: disableAnimations
                  ? true
                  : data.disableAnimations,
              padding: padding != EdgeInsets.zero ? padding : data.padding,
              viewPadding: padding != EdgeInsets.zero
                  ? padding
                  : data.viewPadding,
            ),
            child: content,
          );
        }
        return content;
      },
    );
  }
}

/// Stands in for the application-level synchronization coordinator.
///
/// Home no longer launches its own startup refresh — that is the app
/// coordinator's job — so widget tests that exercise Home's *rendering* need
/// something outside Home to kick off exactly one refresh, just as the
/// coordinator does after the first frame in the real app. Mounting the real
/// coordinator here would drag in the database and the whole repository graph,
/// which these rendering tests deliberately replace with fakes.
class StartupRefreshStandIn extends ConsumerStatefulWidget {
  const StartupRefreshStandIn({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<StartupRefreshStandIn> createState() =>
      _StartupRefreshStandInState();
}

class _StartupRefreshStandInState extends ConsumerState<StartupRefreshStandIn> {
  @override
  void initState() {
    super.initState();
    // After the first frame, exactly like the real coordinator: rendering never
    // waits for a refresh, and no provider is modified during a build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(ref.read(homeControllerProvider.notifier).refresh());
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Pumps the GridView router at [initialLocation] and settles. Wraps the app in
/// a [ProviderScope] backed by the deterministic [defaultFakeRepository] and a
/// fixed clock (before the fixtures' `staleAfter`, so content is fresh).
/// Individual dependencies can be replaced with [repository], [clock],
/// [environment] or [mockData].
Future<GoRouter> pumpApp(
  WidgetTester tester, {
  String initialLocation = '/',
  double textScale = 1.0,
  Size? surfaceSize,
  Locale locale = const Locale('en'),
  bool disableAnimations = false,
  EdgeInsets padding = EdgeInsets.zero,
  FakeRaceWeekendRepository? repository,
  DateTime? clock,
  AppEnvironment environment = AppEnvironment.development,
  bool mockData = false,
  int? currentSeason = 2026,
  ResourceSyncState? Function(String key)? syncMetadata,
  ManualCoreRefresh? onManualRefresh,
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }

  final DateTime now = clock ?? DateTime.utc(2026, 7, 18, 12, 10);
  final FakeRaceWeekendRepository repo = repository ?? defaultFakeRepository();
  final GoRouter router = buildGridViewRouter(initialLocation: initialLocation);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeRepositoryProvider.overrideWithValue(repo),
        calendarRepositoryProvider.overrideWithValue(repo),
        grandPrixRepositoryProvider.overrideWithValue(repo),
        resultRepositoryProvider.overrideWithValue(repo),
        clockProvider.overrideWithValue(() => now),
        appEnvironmentProvider.overrideWithValue(environment),
        usesMockDataProvider.overrideWithValue(mockData),
        // Home, Calendar and Standings are season-scoped. Widget tests replace
        // the data layer with fakes, so the season they render is supplied
        // directly rather than resolved from a database these tests never open.
        currentSeasonResolverProvider.overrideWithValue(
          () async => currentSeason,
        ),
        currentSeasonProvider.overrideWith(
          (Ref ref) => Stream<int?>.value(currentSeason),
        ),
        // The persisted materialization/freshness record. By default every
        // resource reads as successfully synchronised and fresh, so screens
        // render their real content rather than a first-load state.
        // The manual current-season refresh capability. Widget tests drive
        // rendering, so this stands in for the coordinator's whole object
        // graph — mounting the real one would open a database these tests
        // deliberately replace with fakes. It still performs a real calendar
        // refresh through the fake repository, so call counts stay meaningful.
        manualCoreRefreshProvider.overrideWithValue(
          onManualRefresh ??
              () async {
                final int? season = currentSeason;
                if (season == null) return;
                await repo.refreshCalendar(season);
              },
        ),
        resourceSyncStateProvider.overrideWith(
          (Ref ref, String key) => Stream<ResourceSyncState?>.value(
            syncMetadata == null ? syncedMetadata(key) : syncMetadata(key),
          ),
        ),
      ],
      child: StartupRefreshStandIn(
        child: TestApp(
          router: router,
          textScale: textScale,
          locale: locale,
          disableAnimations: disableAnimations,
          padding: padding,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

/// Pumps a single widget inside the GridView theme + localizations, without the
/// router. Used for screens exercised in isolation (e.g. Settings).
Future<void> pumpStandalone(
  WidgetTester tester,
  Widget child, {
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGridViewDarkTheme(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Taps a primary destination in the pill navigation by its label.
Future<void> tapNav(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: find.byType(GvBottomNav), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

/// The router's current location, read via the public route-information
/// provider (no dependency on internal routing-match types).
String shellLocation(GoRouter router) =>
    router.routeInformationProvider.value.uri.toString();

/// The [ProviderContainer] backing the pumped app, so a test can publish an
/// application-level synchronization state exactly as the real coordinator does
/// (feature controllers mirror it; they never produce it).
ProviderContainer containerOf(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(TestApp)));

/// The scroll offset of the first scroll view inside [screen].
double scrollOffsetOf(WidgetTester tester, Type screen) {
  final Finder scrollable = find.descendant(
    of: find.byType(screen),
    matching: find.byType(Scrollable),
  );
  return tester.state<ScrollableState>(scrollable.first).position.pixels;
}
