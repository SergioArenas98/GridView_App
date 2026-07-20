import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/app/router/app_router.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';
import 'package:gridview/l10n/app_localizations.dart';

import 'domain_fixtures.dart';
import 'fake_repository.dart';

/// The default fake repository backing widget/navigation tests: a fresh Home
/// aggregate and a coherent Grand Prix detail for any (season, round). The real
/// Drift pipeline is exercised in the DAO/repository/controller tests.
FakeRaceWeekendRepository defaultFakeRepository() => FakeRaceWeekendRepository(
  home: homeViewFixture(),
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
  RaceWeekendRepository? repository,
  DateTime? clock,
  AppEnvironment environment = AppEnvironment.development,
  bool mockData = false,
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }

  final DateTime now = clock ?? DateTime.utc(2026, 7, 18, 12, 10);
  final GoRouter router = buildGridViewRouter(initialLocation: initialLocation);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        raceWeekendRepositoryProvider.overrideWithValue(
          repository ?? defaultFakeRepository(),
        ),
        clockProvider.overrideWithValue(() => now),
        appEnvironmentProvider.overrideWithValue(environment),
        usesMockDataProvider.overrideWithValue(mockData),
      ],
      child: TestApp(
        router: router,
        textScale: textScale,
        locale: locale,
        disableAnimations: disableAnimations,
        padding: padding,
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
