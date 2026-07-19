# ADR 0004: Drift local database and database file identity

- Status: Accepted
- Date: 2026-07-19

## Context

Phase 4 introduces the offline-first local store. `GridView_TRD.md` (§15)
mandates Drift + SQLite as the explicit persistence layer, with foreign keys,
unique constraints, transactions, schema versioning from the first release and
tested migrations.

The reconstructed app installs as an **update over the existing published
application** (`com.sejuma.gridview`). The legacy app persisted its API cache
through **Hive** (`*.hive` / `*.lock` box files), never SQLite. The new database
must not accidentally open, reinterpret or destroy any legacy local file.

## Decision

- Use **Drift 2.34.x** over SQLite (`sqlite3_flutter_libs` for the bundled
  native library) as the local database.
- Store the database under the application documents directory with the
  **explicit, new filename `gridview_v2.sqlite`** (`kDatabaseFileName`).
  - The name is distinct from any legacy Hive artifact, so there is no collision
    or accidental reinterpretation.
  - The `v2` marker denotes the reconstructed schema and reserves room for a
    future, separately reviewed legacy-cleanup migration.
- **Instants are stored in UTC** via `DriftDatabaseOptions(storeDateTimeAsText:
  true)`, so `DateTime` columns round-trip as ISO-8601 UTC text.
- **Foreign keys are enforced** on every connection through the database's
  `beforeOpen` hook (`PRAGMA foreign_keys = ON`), covering both the on-disk and
  in-memory (test) connections.
- **Schema version 1** is the initial version. Migration and schema-version
  tests exist from this first version (`test/database/schema_migration_test.dart`).

### Legacy isolation

The legacy Hive files are **not deleted** during Phase 4. Any later cleanup is a
separate, reviewed migration decision (Phase 10). Because the new database uses
a distinct filename and a distinct storage engine, the reconstructed app and the
legacy cache cannot interfere with each other.

## Consequences

- Cached content survives app/database restarts (verified by
  `test/database/persistence_test.dart`).
- The database is independently inspectable and its migrations are testable.
- A future ADR will decide if/when the legacy Hive files are removed.
