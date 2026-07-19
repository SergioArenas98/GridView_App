import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// The reconstructed database filename.
///
/// Deliberately new and explicit: the legacy application persisted its API cache
/// through Hive boxes (`*.hive`/`*.lock`), never SQLite, so this name cannot
/// collide with, reinterpret or destroy any legacy local file. The `v2` marker
/// signals the reconstructed schema and reserves room for a future, separately
/// reviewed legacy-cleanup migration. See
/// `docs/adr/0004-drift-local-database.md`.
const String kDatabaseFileName = 'gridview_v2.sqlite';

/// Opens the on-disk application database connection.
///
/// Foreign-key enforcement is enabled centrally in the database's
/// `beforeOpen` migration hook (see `GridViewDatabase`), so it applies to both
/// this on-disk connection and the in-memory connection used by tests.
LazyDatabase openAppConnection() {
  return LazyDatabase(() async {
    final Directory dir = await getApplicationDocumentsDirectory();
    final File file = File(p.join(dir.path, kDatabaseFileName));
    return NativeDatabase.createInBackground(file);
  });
}
