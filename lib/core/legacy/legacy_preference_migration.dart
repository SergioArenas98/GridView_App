import '../preferences/preference_values.dart';
import '../preferences/preferences_repository.dart';
import 'legacy_storage.dart';

/// What happened to one legacy preference.
enum LegacyValueOutcome {
  /// The legacy key is absent: the user never made that choice, so the new
  /// default applies.
  absent,

  /// The legacy choice was written under the reconstruction key.
  migrated,

  /// The reconstruction key already holds a **valid** value. A choice made in
  /// this app always wins over a legacy one, so the legacy value is ignored.
  alreadySet,

  /// The reconstruction key held a corrupt value (unknown token or wrong
  /// type), so it was not a usable choice; the valid legacy choice replaced
  /// it rather than being lost to the default.
  replacedCorrupt,

  /// A valid legacy choice this app cannot honour (a language it does not
  /// offer). The new default applies.
  unsupported,

  /// The legacy value has an unexpected type or content. The new default
  /// applies; startup is unaffected.
  invalid,

  /// Writing the migrated value failed. The migration stays incomplete and is
  /// retried on the next launch.
  writeFailed,

  /// The legacy or reconstruction key could not be read. This is **not**
  /// [absent]: the migration stays incomplete, so the cleanup cannot delete a
  /// choice that was never seen, and the next launch retries.
  readFailed,
}

/// The overall result of one [LegacyPreferenceMigration.run].
enum LegacyMigrationStatus {
  /// The marker was already present; nothing was read or written.
  alreadyCompleted,

  /// Every preference was handled and the marker is stored.
  completed,

  /// Something could not be read or persisted. No marker was stored, legacy
  /// storage is left in place, and the next launch runs the migration again.
  incomplete,
}

class LegacyMigrationResult {
  const LegacyMigrationResult({
    required this.status,
    this.language,
    this.theme,
  });

  final LegacyMigrationStatus status;

  /// Null when the migration did not reach the preference.
  final LegacyValueOutcome? language;
  final LegacyValueOutcome? theme;

  @override
  String toString() =>
      'LegacyMigrationResult(${status.name}, language: ${language?.name}, '
      'theme: ${theme?.name})';
}

/// Maps a raw legacy `languageCode` onto the reconstruction's language.
///
/// Only the two languages this app ships are migrated, and only as an
/// **explicit** choice: the legacy selector pinned the app to the chosen
/// language regardless of the device locale, which is exactly what
/// [AppLanguagePreference.english] and [AppLanguagePreference.spanish] mean.
/// Nothing is mapped to [AppLanguagePreference.system] — the legacy app had no
/// such option.
({LegacyValueOutcome outcome, AppLanguagePreference? value}) mapLegacyLanguage(
  Object? raw,
) {
  if (raw == null) return (outcome: LegacyValueOutcome.absent, value: null);
  if (raw is! String) return (outcome: LegacyValueOutcome.invalid, value: null);
  return switch (raw) {
    LegacyLanguageCodes.english => (
      outcome: LegacyValueOutcome.migrated,
      value: AppLanguagePreference.english,
    ),
    LegacyLanguageCodes.spanish => (
      outcome: LegacyValueOutcome.migrated,
      value: AppLanguagePreference.spanish,
    ),
    _ when LegacyLanguageCodes.unsupported.contains(raw) => (
      outcome: LegacyValueOutcome.unsupported,
      value: null,
    ),
    _ => (outcome: LegacyValueOutcome.invalid, value: null),
  };
}

/// Maps a raw legacy `isDarkMode` onto the reconstruction's theme.
///
/// The legacy app only ever had two fixed themes and stored the key only when
/// the user flipped the switch, so `true`/`false` are explicit dark/light
/// choices. Anything that is not a bool is invalid.
({LegacyValueOutcome outcome, AppThemePreference? value}) mapLegacyTheme(
  Object? raw,
) {
  if (raw == null) return (outcome: LegacyValueOutcome.absent, value: null);
  if (raw is! bool) return (outcome: LegacyValueOutcome.invalid, value: null);
  return (
    outcome: LegacyValueOutcome.migrated,
    value: raw ? AppThemePreference.dark : AppThemePreference.light,
  );
}

/// Carries the legacy app's language and theme choices into the reconstruction
/// preference keys, once.
///
/// Runs before `AppPreferencesRepository` is built, so the first frame already
/// shows the migrated theme and language.
///
/// * **Idempotent.** A stored [LegacyMigrationMarker] short-circuits the run.
///   Without it, a rerun yields the same result: a reconstruction key that
///   already holds a valid value is never overwritten. A corrupt one is
///   replaced by a valid legacy choice.
/// * **Total.** [run] never throws. Unknown, corrupt or wrongly-typed legacy
///   values resolve to the new defaults; a failed read or write leaves the
///   migration incomplete for the next launch rather than blocking this one.
/// * **Non-destructive.** Legacy storage is not touched here; see
///   `LegacyStorageCleanup`, which removes it only after a completed migration
///   and a rendered first frame.
///
/// Consent is deliberately absent: the legacy app never persisted any consent
/// state, so there is nothing whose meaning could be shown to be equivalent.
class LegacyPreferenceMigration {
  LegacyPreferenceMigration({
    required LegacyMigrationStore store,
    void Function(PreferenceDiagnostic diagnostic)? onDiagnostic,
  }) : // A private field cannot be a named parameter, so an initializing formal
       // is not available for either of these.
       // ignore: prefer_initializing_formals
       _store = store,
       // ignore: prefer_initializing_formals
       _onDiagnostic = onDiagnostic;

  final LegacyMigrationStore _store;
  final void Function(PreferenceDiagnostic diagnostic)? _onDiagnostic;

  Future<LegacyMigrationResult> run() async {
    try {
      if (_store.readRaw(LegacyMigrationMarker.key) ==
          LegacyMigrationMarker.completed) {
        return const LegacyMigrationResult(
          status: LegacyMigrationStatus.alreadyCompleted,
        );
      }

      final LegacyValueOutcome languageOutcome = await _migrate(
        legacyKey: LegacyPreferenceKeys.languageCode,
        key: PreferenceKeys.language,
        map: (Object? raw) {
          final mapped = mapLegacyLanguage(raw);
          return (outcome: mapped.outcome, token: mapped.value?.wire);
        },
        validTokens: AppLanguagePreference.values.map(
          (AppLanguagePreference v) => v.wire,
        ),
      );

      final LegacyValueOutcome themeOutcome = await _migrate(
        legacyKey: LegacyPreferenceKeys.isDarkMode,
        key: PreferenceKeys.theme,
        map: (Object? raw) {
          final mapped = mapLegacyTheme(raw);
          return (outcome: mapped.outcome, token: mapped.value?.wire);
        },
        validTokens: AppThemePreference.values.map(
          (AppThemePreference v) => v.wire,
        ),
      );

      final bool persisted =
          !_blocksCompletion(languageOutcome) &&
          !_blocksCompletion(themeOutcome) &&
          await _write(
            LegacyMigrationMarker.key,
            LegacyMigrationMarker.completed,
          );

      return LegacyMigrationResult(
        status: persisted
            ? LegacyMigrationStatus.completed
            : LegacyMigrationStatus.incomplete,
        language: languageOutcome,
        theme: themeOutcome,
      );
    } on Object {
      return const LegacyMigrationResult(
        status: LegacyMigrationStatus.incomplete,
      );
    }
  }

  static bool _blocksCompletion(LegacyValueOutcome outcome) =>
      outcome == LegacyValueOutcome.writeFailed ||
      outcome == LegacyValueOutcome.readFailed;

  /// Migrates one preference: reads the legacy value, maps it, and writes it
  /// unless the reconstruction key already holds a valid choice.
  Future<LegacyValueOutcome> _migrate({
    required String legacyKey,
    required String key,
    required ({LegacyValueOutcome outcome, String? token}) Function(Object? raw)
    map,
    required Iterable<String> validTokens,
  }) async {
    final Object? raw;
    try {
      raw = _store.readRaw(legacyKey);
    } on Object {
      return LegacyValueOutcome.readFailed;
    }
    final mapped = map(raw);
    final String? token = mapped.token;
    if (mapped.outcome != LegacyValueOutcome.migrated || token == null) {
      return mapped.outcome;
    }

    final Object? current;
    try {
      current = _store.readRaw(key);
    } on Object {
      return LegacyValueOutcome.readFailed;
    }
    // Only a valid token is a choice worth keeping. A corrupt one would render
    // as the default anyway, so it must not cost the user their legacy choice.
    final bool currentIsValid =
        current is String && validTokens.contains(current);
    if (currentIsValid) return LegacyValueOutcome.alreadySet;

    if (!await _write(key, token)) return LegacyValueOutcome.writeFailed;
    return current == null
        ? LegacyValueOutcome.migrated
        : LegacyValueOutcome.replacedCorrupt;
  }

  Future<bool> _write(String key, String value) async {
    try {
      await _store.writeString(key, value);
      return true;
    } on Object {
      // The same diagnostic a failed Settings write raises, so it reaches the
      // existing preference non-fatal path carrying only an enum.
      _onDiagnostic?.call(
        PreferenceDiagnostic(
          kind: PreferenceDiagnosticKind.writeFailure,
          key: key,
        ),
      );
      return false;
    }
  }
}
