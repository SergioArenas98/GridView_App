import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'preference_store.dart';
import 'preference_values.dart';
import 'preferences_repository.dart';

/// The preference repository for the application's lifetime.
///
/// Bootstrap overrides this with a repository backed by the real platform store
/// **before** the first `MaterialApp` is built, so the theme and locale are
/// correct in the very first frame. The default value keeps widget tests working
/// without ceremony: an in-memory store that starts at the documented defaults.
final Provider<AppPreferencesRepository> appPreferencesRepositoryProvider =
    Provider<AppPreferencesRepository>((Ref ref) {
      final AppPreferencesRepository repository = AppPreferencesRepository(
        store: InMemoryPreferenceStore(),
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

/// The complete current preference snapshot.
///
/// Synchronous by construction: the repository always holds a full snapshot, so
/// there is no loading state and therefore no window in which the shell could
/// render the wrong theme or language.
class AppPreferencesController extends Notifier<AppPreferences> {
  StreamSubscription<AppPreferences>? _subscription;

  @override
  AppPreferences build() {
    final AppPreferencesRepository repository = ref.watch(
      appPreferencesRepositoryProvider,
    );
    _subscription = repository.changes.listen((AppPreferences next) {
      state = next;
    });
    ref.onDispose(() {
      _subscription?.cancel();
      _subscription = null;
    });
    return repository.snapshot;
  }

  /// Selects the application language. Applies immediately; persistence follows.
  Future<PreferenceWriteOutcome> setLanguage(AppLanguagePreference value) =>
      ref.read(appPreferencesRepositoryProvider).setLanguage(value);

  /// Selects the application theme. Applies immediately; persistence follows.
  Future<PreferenceWriteOutcome> setTheme(AppThemePreference value) =>
      ref.read(appPreferencesRepositoryProvider).setTheme(value);

  /// Selects the session-time display mode. Applies immediately.
  Future<PreferenceWriteOutcome> setTimeDisplay(TimeDisplayPreference value) =>
      ref.read(appPreferencesRepositoryProvider).setTimeDisplay(value);
}

/// The application-wide preference snapshot.
final NotifierProvider<AppPreferencesController, AppPreferences>
appPreferencesProvider =
    NotifierProvider<AppPreferencesController, AppPreferences>(
      AppPreferencesController.new,
    );

/// The resolved [ThemeMode] for the current theme preference.
final Provider<ThemeMode> themeModeProvider = Provider<ThemeMode>(
  (Ref ref) => ref.watch(
    appPreferencesProvider.select((AppPreferences p) => p.theme.themeMode),
  ),
);

/// The locale the application is pinned to, or `null` to follow the platform.
final Provider<Locale?> appLocaleProvider = Provider<Locale?>(
  (Ref ref) => ref.watch(
    appPreferencesProvider.select((AppPreferences p) => p.language.locale),
  ),
);

/// Which clock session instants are displayed in.
final Provider<TimeDisplayPreference> timeDisplayPreferenceProvider =
    Provider<TimeDisplayPreference>(
      (Ref ref) => ref.watch(
        appPreferencesProvider.select((AppPreferences p) => p.timeDisplay),
      ),
    );
