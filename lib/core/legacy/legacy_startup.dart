import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../preferences/preferences_repository.dart';
import 'legacy_preference_migration.dart';
import 'legacy_storage.dart';
import 'legacy_storage_cleanup.dart';

/// Opens the preference repository after migrating the legacy app's choices.
///
/// The production `openPreferences` startup step. The migration runs first so
/// the repository's synchronous snapshot already holds the migrated values. A
/// store that cannot be opened skips the migration — it is retried next launch
/// — and [AppPreferencesRepository.open] then applies its own documented
/// fallback, so neither step can turn into a launch failure.
Future<AppPreferencesRepository> openPreferencesAfterLegacyMigration({
  void Function(PreferenceDiagnostic diagnostic)? onDiagnostic,
}) async {
  try {
    await LegacyPreferenceMigration(
      store: SharedPreferencesMigrationStore(
        await SharedPreferences.getInstance(),
      ),
      onDiagnostic: onDiagnostic,
    ).run();
  } on Object {
    // Only `getInstance` can throw here; `run` is total. The repository reports
    // the unavailable store itself.
  }
  return AppPreferencesRepository.open(onDiagnostic: onDiagnostic);
}

/// Removes legacy storage once the migration has completed.
///
/// The production `cleanUpLegacyStorage` startup step, which bootstrap runs
/// after the first frame. Never throws.
Future<void> cleanUpLegacyStorage() async {
  try {
    await LegacyStorageCleanup(
      store: SharedPreferencesMigrationStore(
        await SharedPreferences.getInstance(),
      ),
      documentsDirectory: getApplicationDocumentsDirectory,
    ).run();
  } on Object {
    // The store would not open. Nothing was removed; the next launch retries.
  }
}
