import 'package:shared_preferences/shared_preferences.dart';

/// The narrow key/value persistence seam the preference domain depends on.
///
/// Reads are **synchronous** so the shell can resolve the theme and locale in
/// the same frame it is built, without a wrong-theme flash. The backing store is
/// loaded once during bootstrap; from then on it serves an in-memory snapshot.
///
/// Preferences never use Drift: this is the only preference persistence
/// mechanism in the application.
abstract interface class PreferenceStore {
  /// The persisted token for [key], or `null` when absent.
  ///
  /// A store that cannot read returns `null` rather than throwing, so a damaged
  /// store degrades to documented defaults instead of blocking launch.
  String? read(String key);

  /// Persists [value] under [key]. Throws when the write fails so the caller can
  /// keep visible and persisted state convergent.
  Future<void> write(String key, String value);
}

/// The production [PreferenceStore], backed by `SharedPreferences`.
class SharedPreferencesStore implements PreferenceStore {
  SharedPreferencesStore(this._prefs);

  final SharedPreferences _prefs;

  /// Opens the platform preference store.
  ///
  /// Throws when the platform channel is unavailable; [AppPreferencesRepository]
  /// callers treat that as a read failure and continue with safe defaults.
  static Future<SharedPreferencesStore> open() async =>
      SharedPreferencesStore(await SharedPreferences.getInstance());

  @override
  String? read(String key) {
    try {
      return _prefs.getString(key);
    } on Object {
      // A value stored under a different type (a legacy int/bool, say) must not
      // crash the read. It is reported as absent and repaired by the next write.
      return null;
    }
  }

  @override
  Future<void> write(String key, String value) async {
    final bool ok = await _prefs.setString(key, value);
    if (!ok) {
      throw StateError('Failed to persist preference "$key".');
    }
  }
}

/// A deterministic in-memory [PreferenceStore] for tests and for the fallback
/// path when the platform store cannot be opened.
///
/// [failingKeys] makes a write to a specific key fail so failure handling can be
/// exercised without a platform channel.
class InMemoryPreferenceStore implements PreferenceStore {
  InMemoryPreferenceStore({
    Map<String, String>? initial,
    Set<String> failingKeys = const <String>{},
  }) : _values = <String, String>{...?initial},
       // A private field cannot be a named parameter, so an initializing formal
       // is not available here.
       // ignore: prefer_initializing_formals
       _failingKeys = failingKeys;

  final Map<String, String> _values;
  final Set<String> _failingKeys;

  /// The tokens currently persisted, for assertions.
  Map<String, String> get values => Map<String, String>.unmodifiable(_values);

  @override
  String? read(String key) => _values[key];

  @override
  Future<void> write(String key, String value) async {
    if (_failingKeys.contains(key)) {
      throw StateError('Simulated preference write failure for "$key".');
    }
    _values[key] = value;
  }
}
