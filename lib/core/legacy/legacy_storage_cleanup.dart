import 'dart:io';

import 'package:path/path.dart' as p;

import 'legacy_storage.dart';

enum LegacyCleanupStatus {
  /// The migration has not completed, so nothing was removed.
  skippedMigrationIncomplete,

  /// Every legacy file and key is gone (or never existed).
  cleaned,

  /// At least one item could not be removed. Whatever could be removed was;
  /// the rest is retried on the next launch.
  failed,
}

/// Removes what the legacy app left behind: its Hive `cache` box files and its
/// two preference keys.
///
/// Runs only when [LegacyMigrationMarker] is stored — so a legacy choice is
/// never deleted before it was carried over — and is scheduled by bootstrap
/// after the first frame of a launch, so a launch that cannot render never
/// destroys anything.
///
/// The legacy Hive data is **never opened or read**: no API cache, image path,
/// timestamp or provider data can reach the Drift database through here. Only
/// the exact files in [LegacyHiveFiles] are deleted; every other file in the
/// documents directory, including `gridview_v2.sqlite`, is left alone.
///
/// [run] never throws, and it is idempotent: a second run finds nothing to do.
class LegacyStorageCleanup {
  LegacyStorageCleanup({
    required LegacyMigrationStore store,
    required Future<Directory> Function() documentsDirectory,
  }) : // A private field cannot be a named parameter, so an initializing formal
       // is not available for either of these.
       // ignore: prefer_initializing_formals
       _store = store,
       // ignore: prefer_initializing_formals
       _documentsDirectory = documentsDirectory;

  final LegacyMigrationStore _store;
  final Future<Directory> Function() _documentsDirectory;

  Future<LegacyCleanupStatus> run() async {
    try {
      if (_store.readRaw(LegacyMigrationMarker.key) !=
          LegacyMigrationMarker.completed) {
        return LegacyCleanupStatus.skippedMigrationIncomplete;
      }

      bool ok = true;

      final Directory dir = await _documentsDirectory();
      for (final String name in LegacyHiveFiles.all) {
        ok =
            await _attempt(() async {
              final File file = File(p.join(dir.path, name));
              // `existsSync` is false for a directory of the same name, so
              // only a regular legacy file is ever deleted.
              if (file.existsSync()) await file.delete();
            }) &&
            ok;
      }

      for (final String key in LegacyPreferenceKeys.all) {
        ok =
            await _attempt(() async {
              if (_store.readRaw(key) != null) await _store.remove(key);
            }) &&
            ok;
      }

      return ok ? LegacyCleanupStatus.cleaned : LegacyCleanupStatus.failed;
    } on Object {
      return LegacyCleanupStatus.failed;
    }
  }

  Future<bool> _attempt(Future<void> Function() action) async {
    try {
      await action();
      return true;
    } on Object {
      return false;
    }
  }
}
