import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/media/media_cache.dart';
import '../core/media/media_image_loader.dart';
import '../core/media/media_loader_scope.dart';
import '../core/preferences/locale_resolution.dart';
import '../core/preferences/preference_values.dart';
import '../core/preferences/preferences_providers.dart';
import '../core/theme/gridview_theme.dart';
import '../features/shared/presentation/widgets/environment_badge.dart';
import '../l10n/app_localizations.dart';
import 'router/app_router.dart';

/// Root widget of the GridView application.
///
/// Owns the [GoRouter] for the app's lifetime (built once, never rebuilt) and
/// applies the persisted theme and language preferences.
///
/// Preferences resolve **synchronously** from the repository the bootstrap
/// installed, so the very first frame already uses the correct theme and
/// language: there is no loading state here and therefore no window in which the
/// wrong theme or language could flash. A preference change rebuilds only this
/// widget — the router, the database and the synchronization owner below it are
/// untouched, so navigation, scroll position and cached content all survive, and
/// no remote request is issued.
class GridViewApp extends ConsumerStatefulWidget {
  const GridViewApp({super.key, this.router});

  /// Optional router override for tests / deep-link entry. When null, the
  /// default GridView router is built.
  final GoRouter? router;

  @override
  ConsumerState<GridViewApp> createState() => _GridViewAppState();
}

class _GridViewAppState extends ConsumerState<GridViewApp> {
  late final GoRouter _router = widget.router ?? buildGridViewRouter();

  /// The one media loader for the application's lifetime, over the one shared
  /// disk cache. Built here rather than per screen so there is exactly one cache
  /// owner, and built lazily so no image work happens before the first frame:
  /// nothing about Home's first useful render waits on this.
  late final MediaImageLoader _mediaLoader = CachedMediaImageLoader(
    FlutterCacheManagerMediaCache(),
  );

  @override
  Widget build(BuildContext context) {
    final AppLanguagePreference language = ref.watch(
      appPreferencesProvider.select((AppPreferences p) => p.language),
    );
    final ThemeMode themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      onGenerateTitle: (BuildContext context) =>
          AppLocalizations.of(context).appTitle,
      theme: buildGridViewLightTheme(),
      darkTheme: buildGridViewDarkTheme(),
      themeMode: themeMode,
      // A pinned language wins outright; `null` means "follow the platform", and
      // the resolution callback below decides what a platform locale maps to.
      locale: language.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      localeListResolutionCallback:
          (List<Locale>? locales, Iterable<Locale> supported) =>
              resolveAppLocale(
                preference: language,
                platformLocales: locales,
                supportedLocales: supported,
              ),
      routerConfig: _router,
      builder: (BuildContext context, Widget? child) => MediaLoaderScope(
        loader: _mediaLoader,
        child: EnvironmentBadgeOverlay(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
