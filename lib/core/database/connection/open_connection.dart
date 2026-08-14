import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../observability/performance_tracer.dart';

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
///
/// [tracer] measures the open itself — resolving the documents directory and
/// handing back the executor. It defaults to a no-op, so nothing about opening
/// the database depends on observability being configured, and the lazy
/// callback runs exactly when it did before: on first use, not at construction.
LazyDatabase openAppConnection({
  PerformanceTracer tracer = const NoopPerformanceTracer(),
}) {
  return LazyDatabase(() async {
    return tracer.trace(TraceName.databaseOpen, () async {
      final Directory dir = await getApplicationDocumentsDirectory();
      final File file = File(p.join(dir.path, kDatabaseFileName));
      return NativeDatabase.createInBackground(file);
    });
  });
}
