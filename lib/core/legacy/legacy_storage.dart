import 'package:shared_preferences/shared_preferences.dart';

/// What the legacy application (`legacy-mobile-v1.2.1`, versionCode 7) left on
/// a device, read from its source rather than from the plan.
///
/// The legacy app and this one resolve the same `shared_preferences` package
/// (identical lockfile hash) and both call `SharedPreferences.getInstance()`, so
/// the legacy keys live in the very store `AppPreferencesRepository` uses. They
/// are listed here **only** so the migration can read them once and the cleanup
/// can remove them; nothing else in the app may depend on them.
///
/// See `docs/technical/GridView_Legacy_Migration.md`.
abstract final class LegacyPreferenceKeys {
  /// `LanguageProvider.setLocale` wrote `locale.languageCode` here (a String),
  /// only after the user picked a language and only for one of
  /// the codes in [LegacyLanguageCodes].
  static const String languageCode = 'languageCode';

  /// `ThemeProvider._saveThemeToPrefs` wrote a bool here, only when the user
  /// toggled the theme switch: `true` dark, `false` light.
  static const String isDarkMode = 'isDarkMode';

  static const List<String> all = <String>[languageCode, isDarkMode];
}

/// The language codes the legacy selector could persist (`L10n.all`).
abstract final class LegacyLanguageCodes {
  static const String english = 'en';
  static const String spanish = 'es';

  /// Offered by the legacy app, not by this one.
  static const Set<String> unsupported = <String>{'it', 'pt', 'fr', 'de', 'ca'};
}

/// The legacy Hive files, all in the application documents directory.
///
/// `main.dart` called `Hive.initFlutter(appDocumentDir.path)` — an absolute
/// path, so `hive_flutter` used the documents directory itself — and opened a
/// single box, `cache`. Hive 2.2.3 names a box's files `<box>.hive`,
/// `<box>.hivec` (a compaction left mid-rename) and `<box>.lock`. The box held
/// only raw API response bodies and a `last_cache_update` timestamp: nothing in
/// it is migrated.
abstract final class LegacyHiveFiles {
  static const List<String> all = <String>[
    'cache.hive',
    'cache.hivec',
    'cache.lock',
  ];
}

/// The marker recording that the legacy preference migration completed.
///
/// Written last, so its presence means every migrated value is already stored.
/// It is a reconstruction key (`gv.` namespace) and is never removed.
abstract final class LegacyMigrationMarker {
  static const String key = 'gv.migration.legacy_preferences';
  static const String completed = 'v1';
}

/// The raw key/value access the migration and the cleanup need, and nothing
/// more.
///
/// Separate from `PreferenceStore` on purpose: that seam is String-only and
/// serves the typed preference domain, while the legacy theme is a bool and the
/// legacy keys must be removable.
abstract interface class LegacyMigrationStore {
  /// The stored value for [key] whatever its type, or `null` when absent or
  /// unreadable. Never throws.
  Object? readRaw(String key);

  /// Persists [value] under [key]. Throws when the write fails.
  Future<void> writeString(String key, String value);

  /// Removes [key]. Throws when the removal fails.
  Future<void> remove(String key);
}

/// The production [LegacyMigrationStore], over the same `SharedPreferences`
/// instance the preference repository reads.
class SharedPreferencesMigrationStore implements LegacyMigrationStore {
  SharedPreferencesMigrationStore(this._prefs);

  final SharedPreferences _prefs;

  @override
  Object? readRaw(String key) {
    try {
      return _prefs.get(key);
    } on Object {
      return null;
    }
  }

  @override
  Future<void> writeString(String key, String value) async {
    if (!await _prefs.setString(key, value)) {
      throw StateError('Failed to persist "$key".');
    }
  }

  @override
  Future<void> remove(String key) async {
    if (!await _prefs.remove(key)) {
      throw StateError('Failed to remove "$key".');
    }
  }
}
