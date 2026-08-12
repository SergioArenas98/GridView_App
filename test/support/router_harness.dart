import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/app/router/app_router.dart';
import 'package:gridview/core/preferences/locale_resolution.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/time/device_time_zone.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/settings/application/app_info.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/l10n/app_localizations.dart';

import 'domain_fixtures.dart';
import 'entity_fixtures.dart';
import 'fake_entity_repository.dart';
import 'fake_repository.dart';

/// The default fake repository backing widget/navigation tests: a fresh Home
/// aggregate, a realistic season calendar and a coherent Grand Prix detail for
/// any (season, round). The real Drift pipeline is exercised in the
/// DAO/repository/controller tests.
FakeRaceWeekendRepository defaultFakeRepository() => FakeRaceWeekendRepository(
  home: homeViewFixture(),
  dashboard: homeDashboardFixture(),
  calendar: (int season) => calendarFixture(season: season),
  grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
);

/// The default fake standings repository: both championship tables populated for
/// any season, with a confirmed leader, fractional points, a confirmed zero and
/// an unranked entrant.
FakeStandingsRepository defaultFakeStandings() => FakeStandingsRepository(
  drivers: (int season) => driverStandingsFixture(season: season),
  constructors: (int season) => constructorStandingsFixture(season: season),
);

/// The default fake Explore/entity repositories: all three collections populated
/// for any season, and a complete profile for any entity id.
///
/// Each is independent, with its own refresh counters, so a navigation or
/// rendering test can prove that one collection's or one detail's request never
/// touched another resource.
FakeDriverRepository defaultFakeDrivers() => FakeDriverRepository(
  cards: (int season) => seasonDriverCardsFixture(season: season),
  profile: (int season, String driverId) =>
      driverProfileFixture(season: season, driverId: driverId),
);

FakeConstructorRepository defaultFakeConstructors() =>
    FakeConstructorRepository(
      cards: (int season) => seasonTeamCardsFixture(season: season),
      profile: (int season, String constructorId) =>
          teamProfileFixture(season: season, constructorId: constructorId),
    );

FakeCircuitRepository defaultFakeCircuits() => FakeCircuitRepository(
  cards: (int season) => seasonCircuitCardsFixture(season: season),
  profile: (int season, String circuitId) =>
      circuitProfileFixture(season: season, circuitId: circuitId),
);

/// A test host that mirrors [GridViewApp] but exposes locale, text-scale,
/// surface size and animation control so navigation, resilience and golden
/// tests can drive the real router.
class TestApp extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    // Theme and language resolve from the seeded preferences by exactly the
    // production rules, so a test exercises the real behaviour: [locale] is the
    // *platform* locale here, and an explicit language preference overrides it
    // just as it does on a device.
    final AppLanguagePreference language = ref.watch(
      appPreferencesProvider.select((AppPreferences p) => p.language),
    );
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewLightTheme(),
      darkTheme: buildGridViewDarkTheme(),
      themeMode: ref.watch(themeModeProvider),
      locale: resolveAppLocale(
        preference: language,
        platformLocales: <Locale>[locale],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
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
  FakeRaceWeekendRepository? repository,
  FakeStandingsRepository? standings,
  FakeDriverRepository? drivers,
  FakeConstructorRepository? constructors,
  FakeCircuitRepository? circuits,
  DateTime? clock,
  AppEnvironment environment = AppEnvironment.development,
  bool mockData = false,
  int? currentSeason = 2026,
  ResourceSyncState? Function(String key)? syncMetadata,

  /// Full control of each metadata stream, so a test can hold a record
  /// unresolved and then emit it. Takes precedence over [syncMetadata].
  Stream<ResourceSyncState?> Function(String key)? syncMetadataStream,
  ManualCoreRefresh? onManualRefresh,
  String deviceTimeZone = 'UTC',

  /// The persisted preference snapshot the app starts from. Seeded through a
  /// real in-memory repository rather than stubbed, so a test exercises the same
  /// read path production does.
  AppPreferences preferences = AppPreferences.defaults,

  /// Public external configuration. Defaults to nothing configured, so a test
  /// must opt in to a policy URL or contact address.
  ExternalLinkConfig linkConfig = const ExternalLinkConfig(),

  /// Records external launches instead of performing them, so no test ever opens
  /// a browser or an email client.
  ExternalLinkLauncher? linkLauncher,

  /// Package metadata. Defaults to a deterministic fake, never a platform
  /// channel.
  AppInfoReader appInfoReader = const FakeAppInfoReader(
    AppInfo(appName: 'GridView', version: '9.9.9', buildNumber: '42'),
  ),

  /// The platform brightness the app sees, pinned so `AppThemePreference.system`
  /// is deterministic in tests and goldens.
  Brightness platformBrightness = Brightness.dark,

  /// The stored media credits the acknowledgements screen reads. Supplied here
  /// rather than through a database, because these tests deliberately replace
  /// the data layer with fakes and never open Drift.
  List<MediaAttribution> mediaAttributions = const <MediaAttribution>[],
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }

  // Pinned on the platform dispatcher, not in a MediaQuery below the app:
  // `ThemeMode.system` is resolved by MaterialApp itself, from the brightness
  // reported *above* it, so an override installed in `builder:` would never
  // reach theme selection and every test would silently get the host default.
  tester.platformDispatcher.platformBrightnessTestValue = platformBrightness;
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

  final DateTime now = clock ?? DateTime.utc(2026, 7, 18, 12, 10);
  final FakeRaceWeekendRepository repo = repository ?? defaultFakeRepository();
  final FakeStandingsRepository standingsRepo =
      standings ?? defaultFakeStandings();
  final FakeDriverRepository driverRepo = drivers ?? defaultFakeDrivers();
  final FakeConstructorRepository constructorRepo =
      constructors ?? defaultFakeConstructors();
  final FakeCircuitRepository circuitRepo = circuits ?? defaultFakeCircuits();
  final GoRouter router = buildGridViewRouter(initialLocation: initialLocation);
  final AppPreferencesRepository preferenceRepository =
      AppPreferencesRepository(
        store: InMemoryPreferenceStore(
          initial: <String, String>{
            PreferenceKeys.language: preferences.language.wire,
            PreferenceKeys.theme: preferences.theme.wire,
            PreferenceKeys.timeDisplay: preferences.timeDisplay.wire,
          },
        ),
      );
  addTearDown(preferenceRepository.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeRepositoryProvider.overrideWithValue(repo),
        calendarRepositoryProvider.overrideWithValue(repo),
        grandPrixRepositoryProvider.overrideWithValue(repo),
        resultRepositoryProvider.overrideWithValue(repo),
        standingsRepositoryProvider.overrideWithValue(standingsRepo),
        driverRepositoryProvider.overrideWithValue(driverRepo),
        constructorRepositoryProvider.overrideWithValue(constructorRepo),
        circuitRepositoryProvider.overrideWithValue(circuitRepo),
        clockProvider.overrideWithValue(() => now),
        // Pinned so rendering never depends on the host machine's time zone:
        // a developer machine and the Linux CI runner report different names
        // for the same instant, which would make goldens machine-specific.
        deviceTimeZoneProvider.overrideWithValue(
          DeviceTimeZone.iana(deviceTimeZone),
        ),
        appPreferencesRepositoryProvider.overrideWithValue(
          preferenceRepository,
        ),
        externalLinkConfigProvider.overrideWithValue(linkConfig),
        externalLinkLauncherProvider.overrideWithValue(
          linkLauncher ?? RecordingExternalLinkLauncher(),
        ),
        appInfoReaderProvider.overrideWithValue(appInfoReader),
        mediaAttributionsProvider.overrideWith(
          (Ref ref) => Stream<List<MediaAttribution>>.value(mediaAttributions),
        ),
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
          (Ref ref, String key) =>
              syncMetadataStream?.call(key) ??
              Stream<ResourceSyncState?>.value(
                syncMetadata == null ? syncedMetadata(key) : syncMetadata(key),
              ),
        ),
      ],
      // No startup stand-in: every Phase 7 screen reads its content from a
      // Drift-backed stream and refreshes nothing on creation (ADR 0015), so a
      // pumped screen produces no request at all. `onManualRefresh` therefore
      // counts only genuine user actions.
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
  Size? surfaceSize,
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }
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
