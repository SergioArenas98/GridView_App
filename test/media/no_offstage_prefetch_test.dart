import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/media/media_load_outcome.dart';
import 'package:gridview/core/media/media_loader_scope.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/explore/presentation/explore_cards.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/l10n/app_localizations.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/media_fixtures.dart';
import '../support/router_harness.dart';
import '../support/synthetic_png.dart';

/// P9 — an unvisited navigation branch never fetches media.
///
/// The product claim under test is narrow and permanent: **media requests are
/// caused by what the user actually looks at, never by what the router could
/// eventually show.** Explore is the only branch with a media slot in every row,
/// so an eagerly built (or preloaded) Explore branch would turn a launch into
/// three collections' worth of downloads that nobody asked for — on a metered
/// connection, before the first screen has even settled.
///
/// Two independent mechanisms have to keep holding for that claim to be true,
/// and this file pins both:
///
/// 1. `StatefulShellRoute.indexedStack` must not construct a branch the user has
///    not visited (`StatefulShellBranch.preload` stays at its `false` default).
/// 2. `GvRemoteImage` must resolve its loader lazily, from a post-frame callback
///    below an inherited scope, and must not restart a completed load on an
///    ordinary rebuild.
///
/// The guard would be vacuous if "no request" were simply what this widget tree
/// always does, so two positive controls sit alongside the zero-assertions:
/// visiting a category *does* fetch (`a visited category fetches its own
/// media`), and an offstage-but-built subtree *does* fetch (`the guard is not
/// vacuous`). If either control stops fetching, the guard has stopped proving
/// anything and this file fails.
const Size _surface = Size(400, 900);

/// Owner ids that appear nowhere else, so a cache key can be attributed to
/// exactly one Explore category by inspection.
const String _driverId = 'p9-driver';
const String _teamId = 'p9-team';
const String _circuitId = 'p9-circuit';

/// Media ids embedded in every cache key (`mediaId|version|slot|url`).
const String _driverMediaId = 'p9-driver-portrait-v1';
const String _teamMediaId = 'p9-team-logo-v1';
const String _circuitMediaId = 'p9-circuit-layout-v1';

void main() {
  late Directory tmp;
  late File bytes;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('gv_p9_prefetch');
    bytes = writePng(tmp, 'p9.png', bandedPng(16, 16));
  });

  tearDown(() {
    if (tmp.existsSync()) tmp.deleteSync(recursive: true);
  });

  /// Pumps the real router with all three Explore collections carrying
  /// resolvable media, so "nothing was requested" can only mean the branch was
  /// never built — not that there was nothing to request.
  Future<void> pumpWithExploreMedia(
    WidgetTester tester,
    _CountingLoader loader, {
    String initialLocation = '/',
  }) => pumpApp(
    tester,
    initialLocation: initialLocation,
    surfaceSize: _surface,
    disableAnimations: true,
    mediaLoader: loader,
    drivers: FakeDriverRepository(
      cards: (int season) => <SeasonDriverCard>[
        driverCard(
          season: season,
          driverId: _driverId,
          name: 'P9 Driver',
          order: 0,
          media: entityMediaOf(<MediaAsset>[_driverPortrait]),
        ),
      ],
    ),
    constructors: FakeConstructorRepository(
      cards: (int season) => <SeasonTeamCard>[
        teamCard(
          season: season,
          constructorId: _teamId,
          stableName: 'P9 Team',
          order: 0,
          media: entityMediaOf(
            <MediaAsset>[_teamLogo],
            ownerType: MediaEntityType.constructor,
            ownerId: _teamId,
          ),
        ),
      ],
    ),
    circuits: FakeCircuitRepository(
      cards: (int season) => <SeasonCircuitCard>[
        circuitCard(
          season: season,
          circuitId: _circuitId,
          name: 'P9 Circuit',
          order: 0,
          media: entityMediaOf(
            <MediaAsset>[_circuitLayout],
            ownerType: MediaEntityType.circuit,
            ownerId: _circuitId,
          ),
        ),
      ],
    ),
  );

  group('an unvisited Explore branch', () {
    testWidgets('is not built at launch, so it requests nothing', (
      WidgetTester tester,
    ) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);

      // The launch screen itself owns no media slot, so the strongest true
      // statement is that the loader was never consulted at all.
      expect(loader.probes, isEmpty, reason: 'no cache probe at launch');
      expect(loader.fetches, isEmpty, reason: 'no fetch at launch');
      expect(loader.exploreKeys, isEmpty);
      // The branch really is absent from the tree, not merely quiet. This is
      // the sharper of the two assertions: a hidden branch whose rows happen not
      // to have been laid out yet is still a latent download, so the structural
      // check is what actually pins `preload: false`.
      expect(_exploreBranch, findsNothing);
      expect(
        find.byType(ExploreDriverCardRow, skipOffstage: false),
        findsNothing,
      );
    });

    testWidgets('still requests nothing after 30 simulated seconds on Home', (
      WidgetTester tester,
    ) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);

      // Advanced in one-second slices so any scheduled timer, delayed future or
      // deferred post-frame callback gets a chance to fire. This proves the
      // absence of *scheduled* work; it is not a performance measurement and
      // says nothing about wall-clock behaviour on a device.
      for (int second = 0; second < 30; second++) {
        await tester.pump(const Duration(seconds: 1));
      }

      expect(loader.probes, isEmpty);
      expect(loader.fetches, isEmpty);
      expect(_exploreBranch, findsNothing);
    });

    testWidgets('survives a theme change, a locale change and a settled '
        'rebuild without requesting anything', (WidgetTester tester) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);
      final ProviderContainer container = containerOf(tester);

      // Theme: light, then back to dark. Each write rebuilds MaterialApp and
      // every screen below it.
      for (final AppThemePreference theme in <AppThemePreference>[
        AppThemePreference.light,
        AppThemePreference.dark,
      ]) {
        await container.read(appPreferencesProvider.notifier).setTheme(theme);
        await tester.pumpAndSettle();
      }

      // Locale: Spanish, then English. This rebuilds every localized string on
      // every screen, which is the rebuild most likely to walk the whole tree.
      for (final AppLanguagePreference language in <AppLanguagePreference>[
        AppLanguagePreference.spanish,
        AppLanguagePreference.english,
      ]) {
        await container
            .read(appPreferencesProvider.notifier)
            .setLanguage(language);
        await tester.pumpAndSettle();
      }

      // A final settle so any post-frame callback queued by those rebuilds runs
      // before the assertion.
      await tester.pump();
      await tester.pumpAndSettle();

      expect(loader.probes, isEmpty);
      expect(loader.fetches, isEmpty);
      expect(_exploreBranch, findsNothing);
    });
  });

  group('a visited category', () {
    testWidgets('fetches its own media — the guard is a real constraint', (
      WidgetTester tester,
    ) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);
      expect(loader.fetches, isEmpty);

      await tapNav(tester, 'Explore');

      // Positive control. Same loader, same fixtures, same app: the only thing
      // that changed is that the branch is now visited.
      expect(loader.exploreKeys, isNotEmpty);
      expect(loader.fetches, isNotEmpty);
      expect(loader.driverFetches, isNotEmpty);
      expect(find.byType(ExploreDriverCardRow), findsOneWidget);
    });

    testWidgets('does not prefetch the other two categories', (
      WidgetTester tester,
    ) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);

      // Drivers only. `ExploreScreen` renders exactly the selected collection,
      // so the sibling categories are never constructed even though their data
      // is loaded and carries media.
      await tapNav(tester, 'Explore');
      expect(loader.driverFetches, isNotEmpty);
      expect(loader.teamFetches, isEmpty, reason: 'teams were never opened');
      expect(
        loader.circuitFetches,
        isEmpty,
        reason: 'circuits were never opened',
      );

      // Teams: its own media arrives, and circuits stays untouched.
      await _selectCategory(tester, 'Teams');
      expect(loader.teamFetches, isNotEmpty);
      expect(
        loader.circuitFetches,
        isEmpty,
        reason: 'circuits are still unvisited',
      );
    });

    testWidgets('is not re-fetched when it rebuilds or is revisited', (
      WidgetTester tester,
    ) async {
      final _CountingLoader loader = _CountingLoader(bytes);
      await pumpWithExploreMedia(tester, loader);
      await tapNav(tester, 'Explore');

      final ProviderContainer container = containerOf(tester);
      final List<String> firstFetches = List<String>.of(loader.driverFetches);
      expect(firstFetches, isNotEmpty);
      // Each driver key was fetched exactly once.
      expect(firstFetches.toSet().length, firstFetches.length);
      final int probesAfterFirstLoad = loader.probes.length;

      // 1. An in-place rebuild of the visible category. A locale change is used
      //    deliberately: the row reads `AppLocalizations`, so this genuinely
      //    rebuilds `ExploreDriverCardRow` and hands `GvRemoteImage` a new
      //    widget. A theme change would not — the row's `leading` subtree is
      //    passed as an already-built child and no theme dependency reaches it —
      //    so asserting on a theme change here would prove nothing.
      //    `GvRemoteImage` holds the cache key of the completed load, so the
      //    rebuilt widget must not even re-probe, let alone re-download.
      final GvRemoteImage before = tester.widget<GvRemoteImage>(_rowImage);
      for (final AppLanguagePreference language in <AppLanguagePreference>[
        AppLanguagePreference.spanish,
        AppLanguagePreference.english,
      ]) {
        await container
            .read(appPreferencesProvider.notifier)
            .setLanguage(language);
        await tester.pumpAndSettle();
      }
      expect(
        identical(tester.widget<GvRemoteImage>(_rowImage), before),
        isFalse,
        reason: 'the locale change really did rebuild the row and its image',
      );
      expect(loader.driverFetches, firstFetches);
      expect(
        loader.probes.length,
        probesAfterFirstLoad,
        reason: 'a rebuild must not re-resolve a completed load',
      );

      // 2. A genuine revisit. Switching category replaces the Explore page, so
      //    coming back constructs brand-new row widgets. They are allowed to ask
      //    the cache again — that is what a cache is for — but the completed
      //    download must not be restarted.
      await _selectCategory(tester, 'Teams');
      await _selectCategory(tester, 'Drivers');
      expect(find.byType(ExploreDriverCardRow), findsOneWidget);
      expect(
        loader.driverFetches,
        firstFetches,
        reason: 'a revisit is served from the cache, not re-downloaded',
      );
      expect(
        loader.probes.length,
        greaterThan(probesAfterFirstLoad),
        reason: 'the rebuilt row did consult the cache',
      );
    });
  });

  testWidgets('the guard is not vacuous: an offstage subtree still fetches', (
    WidgetTester tester,
  ) async {
    // The zero-assertions above hold because the branch is never *built*, not
    // because offstage widgets are exempt from loading. This control proves the
    // difference: the identical row, built but hidden, issues its request. If
    // the router ever preloads or eagerly constructs a branch, the guard fails
    // rather than silently passing.
    final _CountingLoader loader = _CountingLoader(bytes);
    await tester.binding.setSurfaceSize(_surface);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        child: MediaLoaderScope(
          loader: loader,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: buildGridViewDarkTheme(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: Offstage(
                child: ExploreDriverCardRow(
                  card: driverCard(
                    driverId: _driverId,
                    name: 'P9 Driver',
                    order: 0,
                    media: entityMediaOf(<MediaAsset>[_driverPortrait]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(loader.driverFetches, isNotEmpty);
  });
}

/// The Explore branch itself, found whether it is on screen or hidden behind
/// the shell's `IndexedStack`.
///
/// `skipOffstage: false` is the whole point: a preloaded branch is built but
/// offstage, and its rows stay unbuilt only because an offstage subtree is never
/// laid out. That is a latent download waiting for the first relayout, not an
/// absence of one, so the guard asserts the branch does not exist at all.
final Finder _exploreBranch = find.byType(ExploreScreen, skipOffstage: false);

/// The single Explore row's image slot.
final Finder _rowImage = find.descendant(
  of: find.byType(ExploreDriverCardRow),
  matching: find.byType(GvRemoteImage),
);

/// Taps one of the three Explore segments by its localized label.
Future<void> _selectCategory(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(
      of: find.byType(GvSegmentedControl),
      matching: find.text(label),
    ),
  );
  await tester.pumpAndSettle();
}

/// A [MediaImageLoader] that records every call and models a real disk cache:
/// a completed fetch becomes a cache hit, so "was this downloaded twice?" is
/// distinguishable from "was the cache consulted twice?".
///
/// Nothing here touches the network, the file system beyond one pre-written
/// temporary PNG, or `flutter_cache_manager`.
class _CountingLoader implements MediaImageLoader {
  _CountingLoader(this._bytes);

  final File _bytes;

  final List<String> probes = <String>[];
  final List<String> fetches = <String>[];

  /// Cache keys whose bytes are already stored.
  final Set<String> _stored = <String>{};

  @override
  Future<File?> cached(MediaImageRequest request) async {
    probes.add(request.cacheKey);
    return _stored.contains(request.cacheKey) ? _bytes : null;
  }

  @override
  Future<MediaLoadOutcome> load(MediaImageRequest request) async {
    fetches.add(request.cacheKey);
    _stored.add(request.cacheKey);
    return MediaLoaded(file: _bytes, fromCache: false);
  }

  /// Every key this loader saw, in either direction.
  Iterable<String> get _allKeys => <String>[...probes, ...fetches];

  /// Keys belonging to any Explore collection, whether probed or fetched.
  Iterable<String> get exploreKeys => _allKeys.where(_isExplore);

  List<String> get driverFetches =>
      fetches.where((String k) => k.contains(_driverMediaId)).toList();
  List<String> get teamFetches =>
      fetches.where((String k) => k.contains(_teamMediaId)).toList();
  List<String> get circuitFetches =>
      fetches.where((String k) => k.contains(_circuitMediaId)).toList();

  static bool _isExplore(String key) =>
      key.contains(_driverMediaId) ||
      key.contains(_teamMediaId) ||
      key.contains(_circuitMediaId);
}

// --- Fixtures ---------------------------------------------------------------
// Each asset carries a thumbnail large enough for a 40px row at the test's
// device pixel ratio, so the selector really does return a request rather than
// declining for want of a usable variant.

final MediaAsset _driverPortrait = portraitAsset(
  id: _driverMediaId,
  owner: _driverId,
);

final MediaAsset _teamLogo = MediaAsset(
  id: _teamMediaId,
  entityType: MediaEntityType.constructor,
  entityId: _teamId,
  category: MediaCategory.logo,
  format: MediaFormat.png,
  version: 'v1',
  aspectRatio: 1,
  variants: MediaVariants(
    thumbnail: variant(
      testMediaUrl(
        'constructors',
        _teamId,
        'v1',
        'thumbnail',
        extension: 'png',
      ),
      width: 160,
      height: 160,
    ),
    detail: variant(
      testMediaUrl('constructors', _teamId, 'v1', 'detail', extension: 'png'),
      width: 960,
      height: 960,
    ),
  ),
);

final MediaAsset _circuitLayout = MediaAsset(
  id: _circuitMediaId,
  entityType: MediaEntityType.circuit,
  entityId: _circuitId,
  category: MediaCategory.circuitLayout,
  format: MediaFormat.png,
  version: 'v1',
  aspectRatio: 16 / 9,
  variants: MediaVariants(
    thumbnail: variant(
      testMediaUrl('circuits', _circuitId, 'v1', 'thumbnail', extension: 'png'),
      width: 160,
      height: 90,
    ),
    detail: variant(
      testMediaUrl('circuits', _circuitId, 'v1', 'detail', extension: 'png'),
      width: 960,
      height: 540,
    ),
  ),
);
