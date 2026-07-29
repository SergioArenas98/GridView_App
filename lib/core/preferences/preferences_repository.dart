import 'dart:async';

import 'preference_store.dart';
import 'preference_values.dart';

/// The persisted key for each preference. Stable: renaming one would silently
/// reset a user's choice.
abstract final class PreferenceKeys {
  static const String language = 'gv.preference.language';
  static const String theme = 'gv.preference.theme';
  static const String timeDisplay = 'gv.preference.time_display';

  /// Every key the preference domain owns, for tests and diagnostics.
  static const List<String> all = <String>[language, theme, timeDisplay];
}

/// Why a non-fatal preference diagnostic was raised.
enum PreferenceDiagnosticKind {
  /// The store could not be opened at all; defaults are in use for this session.
  storeUnavailable,

  /// A key held a token that no longer maps to a value. The safe default is used
  /// and the key is repaired on the next successful write.
  corruptedValue,

  /// Persisting a user selection failed. Visible state was reverted so it never
  /// diverges silently from what is stored.
  writeFailure,
}

/// A non-fatal preference problem, suitable for the observability boundary.
///
/// It carries the preference **key** and never the stored text, so a corrupted
/// value can never be echoed into a report or onto a screen.
class PreferenceDiagnostic {
  const PreferenceDiagnostic({required this.kind, this.key});

  final PreferenceDiagnosticKind kind;
  final String? key;

  @override
  String toString() => 'PreferenceDiagnostic(${kind.name}, key: $key)';
}

/// The result of a preference write, from the caller's point of view.
enum PreferenceWriteOutcome {
  /// The selection is persisted.
  persisted,

  /// A newer selection for the same preference replaced this one before it was
  /// written. The newer selection wins; this is a success, not a failure.
  superseded,

  /// The selection could not be persisted. Visible state was reverted to the
  /// last stored value and the caller should surface a localized, non-technical
  /// message.
  failed,
}

/// Owns the application's preference snapshot and its persistence.
///
/// One repository owns all three preferences: a preference row never gets its
/// own repository or controller, and no widget ever touches `SharedPreferences`.
///
/// Writes are applied to the visible snapshot immediately and persisted through
/// a single serialized lane. Overlapping writes to the same preference coalesce
/// so the **latest user selection wins**, and a failed write reverts the visible
/// value rather than leaving it silently divergent from storage.
class AppPreferencesRepository {
  AppPreferencesRepository({
    required PreferenceStore store,
    void Function(PreferenceDiagnostic diagnostic)? onDiagnostic,
    bool storeUnavailable = false,
  }) : // A private field cannot be a named parameter, so an initializing formal
       // is not available for either of these.
       // ignore: prefer_initializing_formals
       _store = store,
       // ignore: prefer_initializing_formals
       _onDiagnostic = onDiagnostic {
    if (storeUnavailable) {
      _report(
        const PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.storeUnavailable,
        ),
      );
    }
    _current = _readSnapshot();
    _persisted = _current;
  }

  /// Opens the platform store and builds the repository.
  ///
  /// A store that cannot be opened is **not** a launch failure: the repository
  /// falls back to an in-memory store so the shell still renders with documented
  /// defaults, and raises a [PreferenceDiagnosticKind.storeUnavailable]
  /// diagnostic.
  static Future<AppPreferencesRepository> open({
    void Function(PreferenceDiagnostic diagnostic)? onDiagnostic,
  }) async {
    try {
      return AppPreferencesRepository(
        store: await SharedPreferencesStore.open(),
        onDiagnostic: onDiagnostic,
      );
    } on Object {
      return AppPreferencesRepository(
        store: InMemoryPreferenceStore(),
        onDiagnostic: onDiagnostic,
        storeUnavailable: true,
      );
    }
  }

  final PreferenceStore _store;
  final void Function(PreferenceDiagnostic diagnostic)? _onDiagnostic;

  final StreamController<AppPreferences> _controller =
      StreamController<AppPreferences>.broadcast();

  /// Per-key write generation. A write only takes effect if it is still the
  /// newest selection for its key when its turn in the lane arrives.
  final Map<String, int> _generations = <String, int>{};

  /// The single serialized persistence lane.
  Future<void> _lane = Future<void>.value();

  late AppPreferences _current;

  /// The last snapshot known to match storage, used to revert a failed write.
  late AppPreferences _persisted;

  /// The complete current preference snapshot. Always available synchronously.
  AppPreferences get snapshot => _current;

  /// Emits the complete snapshot on every change. Suitable for a Riverpod
  /// `StreamProvider`; the current value is already available via [snapshot].
  Stream<AppPreferences> get changes => _controller.stream;

  /// Selects the application language.
  Future<PreferenceWriteOutcome> setLanguage(AppLanguagePreference value) {
    return _write(
      key: PreferenceKeys.language,
      token: value.wire,
      apply: (AppPreferences p) => p.copyWith(language: value),
    );
  }

  /// Selects the application theme.
  Future<PreferenceWriteOutcome> setTheme(AppThemePreference value) {
    return _write(
      key: PreferenceKeys.theme,
      token: value.wire,
      apply: (AppPreferences p) => p.copyWith(theme: value),
    );
  }

  /// Selects which clock session instants are displayed in.
  Future<PreferenceWriteOutcome> setTimeDisplay(TimeDisplayPreference value) {
    return _write(
      key: PreferenceKeys.timeDisplay,
      token: value.wire,
      apply: (AppPreferences p) => p.copyWith(timeDisplay: value),
    );
  }

  /// Releases the change stream. Called when the owning provider is disposed.
  Future<void> dispose() => _controller.close();

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  AppPreferences _readSnapshot() {
    return AppPreferences(
      language: AppLanguagePreference.fromWire(
        _validated(
          PreferenceKeys.language,
          AppLanguagePreference.values.map((AppLanguagePreference v) => v.wire),
        ),
      ),
      theme: AppThemePreference.fromWire(
        _validated(
          PreferenceKeys.theme,
          AppThemePreference.values.map((AppThemePreference v) => v.wire),
        ),
      ),
      timeDisplay: TimeDisplayPreference.fromWire(
        _validated(
          PreferenceKeys.timeDisplay,
          TimeDisplayPreference.values.map((TimeDisplayPreference v) => v.wire),
        ),
      ),
    );
  }

  /// Returns the stored token for [key] when it is one of [known], and reports a
  /// corrupted-value diagnostic otherwise.
  ///
  /// An absent key is a normal first launch, not corruption.
  String? _validated(String key, Iterable<String> known) {
    final String? stored = _store.read(key);
    if (stored == null) return null;
    if (known.contains(stored)) return stored;
    _report(
      PreferenceDiagnostic(
        kind: PreferenceDiagnosticKind.corruptedValue,
        key: key,
      ),
    );
    return null;
  }

  // ---------------------------------------------------------------------------
  // Writing
  // ---------------------------------------------------------------------------

  Future<PreferenceWriteOutcome> _write({
    required String key,
    required String token,
    required AppPreferences Function(AppPreferences previous) apply,
  }) {
    final int generation = (_generations[key] ?? 0) + 1;
    _generations[key] = generation;

    _emit(apply(_current));

    final Completer<PreferenceWriteOutcome> done =
        Completer<PreferenceWriteOutcome>();
    _lane = _lane.then((_) async {
      if (_generations[key] != generation) {
        // A newer selection for this preference is already queued. Skipping the
        // stale write is what makes the latest selection win.
        done.complete(PreferenceWriteOutcome.superseded);
        return;
      }
      try {
        await _store.write(key, token);
        _persisted = apply(_persisted);
        done.complete(PreferenceWriteOutcome.persisted);
      } on Object {
        _report(
          PreferenceDiagnostic(
            kind: PreferenceDiagnosticKind.writeFailure,
            key: key,
          ),
        );
        if (_generations[key] == generation) {
          // Revert only this preference, so an unrelated preference selected in
          // the meantime is never erased by another preference's failure.
          _emit(_revertKey(key));
        }
        done.complete(PreferenceWriteOutcome.failed);
      }
    });
    return done.future;
  }

  /// Restores a single preference to its last persisted value, leaving every
  /// other preference exactly as the user currently has it.
  AppPreferences _revertKey(String key) {
    return switch (key) {
      PreferenceKeys.language => _current.copyWith(
        language: _persisted.language,
      ),
      PreferenceKeys.theme => _current.copyWith(theme: _persisted.theme),
      PreferenceKeys.timeDisplay => _current.copyWith(
        timeDisplay: _persisted.timeDisplay,
      ),
      _ => _current,
    };
  }

  void _emit(AppPreferences next) {
    if (next == _current) return;
    _current = next;
    if (!_controller.isClosed) _controller.add(next);
  }

  void _report(PreferenceDiagnostic diagnostic) =>
      _onDiagnostic?.call(diagnostic);
}
