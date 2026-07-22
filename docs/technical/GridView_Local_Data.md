# GridView — Local Data (Drift)

- Status: Phase 6A (complete local data layer — full v1 domain persistence,
  DAOs, queries and migration)
- Related: `GridView_TRD.md` §12/§15, `GridView_Domain_Model.md`,
  `docs/adr/0004-drift-local-database.md`,
  `docs/adr/0005-snapshot-conflict-and-freshness.md`

This document describes the local persistence layer. **Phase 4** introduced the
offline-first vertical slice (Home → Grand Prix detail) on **schema v1**.
**Phase 6A** completes the local model for every v1 feature on **schema v2**: a
non-destructive `1 → 2` migration adds the remaining domain — competitors,
season participation, standings, results and media — plus resource sync
metadata provisioned for Phase 6B.

Phase 6A is local-only: it delivers the Drift schema, DAOs, transactional
writes, local queries and local↔domain mappings. Remote repositories, bootstrap,
ETags, freshness and synchronization orchestration are **Phase 6B** and are not
implemented here.

## 1. Database identity

- Engine: **Drift 2.34.x over SQLite** (`sqlite3_flutter_libs` native library).
- Filename: **`gridview_v2.sqlite`** in the application documents directory
  (`lib/core/database/connection/open_connection.dart`). The `v2` is a
  reconstruction-lineage marker in the **filename**, unrelated to the schema
  version.
- Schema version: **2**.
- Instants stored in **UTC** (`storeDateTimeAsText: true`).
- Foreign keys enforced on every open (`PRAGMA foreign_keys = ON` in
  `beforeOpen`).

The filename is deliberately new: the legacy app used **Hive** box files, never
SQLite, so there is no collision. Legacy files are not deleted (see ADR 0004).

## 2. Schema (v2)

Tables are grouped into focused files under `lib/core/database/`. Row classes
are suffixed `Row` so they never collide with the equally-named domain
entities.

**v1 calendar spine** (`tables.dart`) — unchanged from v1 except `circuits`,
which gained its full physical/geographic identity in v2 (all-nullable columns
added non-destructively):

| Table | Owns | Key |
|---|---|---|
| `seasons` | Season context | `year` (PK) |
| `circuits` | Circuit identity | `id` (PK) — v2 adds `latitude`, `longitude`, `lengthMeters`, `cornerCount`, `direction`, `firstGrandPrixYear`, `lapRecord*` |
| `grand_prix` | Grand Prix edition | `id` (PK) + unique `(season, round)` |
| `sessions` | Weekend sessions | `id` (PK); `grandPrixId` cascade; explicit `orderIndex` |
| `snapshots` | Vertical-slice freshness | `key` (PK) |

**Competitors** (`competitor_tables.dart`):

| Table | Owns | Key |
|---|---|---|
| `drivers` | Stable driver identity | `id` (PK) |
| `constructors` | Stable constructor identity | `id` (PK) |
| `driver_season_entries` | Driver participation span | `id` (PK); `season`/`driverId`/`constructorId` FKs |
| `constructor_season_entries` | Team season branding | `id` (PK) + **unique `(season, constructorId)`** |

A constructor's line-up is **not** a table — it is derived from the season's
`driver_season_entries` (the single source of truth for membership).

**Standings** (`standing_tables.dart`): `driver_standings` `(season, driverId)`,
`constructor_standings` `(season, constructorId)`. Points are **REAL** (fractional
allowed); `position` is nullable (unranked ≠ 0). A non-negative `orderIndex`
persists the delivered championship order (reads order by it).

**Results** (`result_tables.dart`): `race_results` (`id` PK, `grandPrixId`
cascade, **unique `(grandPrixId, sessionType)`** — a sprint weekend has both a
sprint and a race result), `race_result_entries` (`(raceResultId, driverId)`,
cascade, explicit `orderIndex`). Durations are stored as whole **milliseconds**
(`...Millis`).

**Media** (`media_tables.dart`): `media_assets` (`id` PK), `media_variants`
(`(mediaId, variantName)`, cascade), and four **FK-backed ownership association
tables** — `driver_media`, `constructor_media`, `circuit_media`,
`grand_prix_media` (each `mediaId` PK, cascade on both ends). SQLite cannot
express one polymorphic FK across four parents, so ownership is one association
table per real owner. **`placeholder` and `unknown` media never get an
association row — no foreign-key relationship is fabricated for them.**
Single-owner integrity is enforced transactionally in `MediaDao`: a mediaId
lives in exactly one owner table, the owner type must be real, and each asset's
`entityType` must match the owner (ownership moves clear the prior association).

**Sync** (`sync_tables.dart`): `resource_sync_metadata` (`resourceKey` PK), with
scope (`season`/`entityId`/`round`), `etag`, snapshot provenance
(`generatedAt`/`sourceUpdatedAt`/`staleAfter`/`contentVersion`), and
`lastAttemptAt`/`lastSuccessAt`/`lastFailureCategory`/`serverStale`. Provisioned
by v2 so Phase 6B needs no further migration. Keys are built by `ResourceKey`
from stable identifiers and are season-scoped (`home:2026`,
`standings:drivers:2026`, `driver:max-verstappen:2026`, `grand-prix:2026:13`) —
never a display name.

`SyncMetadataDao` provides local CRUD (`upsert`/`read`) plus the **due/stale
query** (`readDueResources`/`watchDueResources`) that Phase 6B's orchestration
consumes. **Phase 6A owns this local query; Phase 6B owns the refresh policy
and the remote calls it triggers.** A resource is locally *due* when it has
never synced successfully (`lastSuccessAt == null`), the server flagged it stale
(`serverStale == true`, an explicit server signal independent of any boundary),
or its expiry has passed (`staleAfter` — the normal expiry boundary — is
non-null and `<= now`). A supplied UTC instant is used (the DAO never calls
`DateTime.now`); results are optionally season-scoped, ordered deterministically
(never-successful, then server-stale, then oldest `staleAfter`, then
`resourceKey`), and returned as `ResourceSyncState` — never Drift rows.

### Constraints, indexes and validation

- **Indexes** back every non-trivial DAO query: `grand_prix(season,start_date)`
  and `(circuit_id,season)`; `sessions(grand_prix_id,order_index)`;
  `driver_season_entries(season,driver_id,…)` and `(season,constructor_id,…)`;
  `driver_standings(season,order_index)` and the constructor equivalent;
  `race_result_entries(race_result_id,order_index)`; the four
  `{owner}_media(owner_id)` lookups; and, for the due/stale query,
  `resource_sync_metadata(stale_after)` plus `(season,stale_after)` for the
  season-scoped variant. No speculative indexes are created.
- **SQL CHECK** constraints on the v2 tables enforce numeric ranges (season
  1950–2100, round 1–30, non-negative order/timing/laps, positive media
  dimensions). The v1 spine cannot gain CHECKs post-migration, so those values
  plus kebab-case IDs and uppercase ISO country codes are validated
  transactionally at the DAO boundary (`entity_validation.dart`).

Conventions: stable GridView IDs are the only keys; enum values are stored as
their wire token and read back through `fromWire` (unrecognised → `unknown`);
optional values stay nullable (`null` ≠ `0`/`""`/`false`); country codes are
ISO 3166-1 alpha-2.

### Relationships (v2)

```
seasons 1─* grand_prix 1─* sessions           (sessions cascade on GP delete)
        1─* driver_season_entries              circuits 1─* grand_prix
        1─* constructor_season_entries         (unique per season+constructor)
        1─* driver_standings / constructor_standings
grand_prix 1─* race_results 1─* race_result_entries   (both cascade)
drivers / constructors ─* season entries, standings, result entries
media_assets 1─* media_variants        (cascade)
media_assets 1─1 {driver|constructor|circuit|grand_prix}_media  (single FK owner)
```

## 3. Data-layer separation

```
Screens (ConsumerWidget)            presentation — no Drift/Dio/DTO imports
  │
Controllers + Providers             application (Riverpod)
  │
Repositories (interfaces)           domain-facing contracts  [Phase 6B]
  │
DAOs (local)                        the only place Drift rows exist
```

Rules enforced by structure and review:

- Screens import neither Drift, Dio nor API DTOs.
- **Drift rows never escape a DAO**; DAOs accept and return domain entities and
  domain views only (`HomeView`, `GrandPrixDetailView`, `DriverDetailView`,
  `TeamDetailView`, `CircuitDetailView`, `SeasonDriver`, `SeasonConstructor`).
- Every multi-row write runs inside a single DAO `transaction`; collection
  writes replace the collection wholesale so obsolete rows never linger.

## 4. DAO surface (queries)

| DAO | Writes | Reads (local queries) |
|---|---|---|
| `VerticalSliceDao` | `writeHomeSnapshot`, `writeGrandPrixSnapshot` | `watchHome`, `watchGrandPrix` |
| `CalendarDao` | `upsertCircuits` (full circuit + media) | `calendar`, `nextEvent`, `latestCompletedEvent`, `currentSession`, `circuitsForSeason`, `circuitDetail` |
| `CompetitorDao` | `upsertDrivers`, `upsertConstructors`, `replaceDriverSeasonEntries`, `replaceConstructorSeasonEntries` | `driversForSeason`, `constructorsForSeason`, `driverDetail`, `teamDetail` |
| `StandingsDao` | `replaceDriverStandings`, `replaceConstructorStandings` | `driverStandingsForSeason`, `constructorStandingsForSeason`, `driverStanding`, `constructorStanding` |
| `ResultsDao` | `writeRaceResult` | `raceResult`, `resultsForGrandPrix` |
| `MediaDao` | `replaceOwnerMedia` | `mediaForOwner` |
| `SyncMetadataDao` | `upsert` | `read`, `readDueResources`/`watchDueResources` (local query; refresh policy is 6B) |

Identity upserts preserve the stable row and refresh media (a non-null domain
`media` list replaces it; an empty list clears it; a null list leaves it
untouched). Detail reads compose identity + media + season entry + standing; a
team's line-up is derived from the season's driver entries. Standings are read
back in their delivered `orderIndex` order. All writes validate scalars and
reject invalid batches transactionally.

## 5. Migrations and schema export

- **v1 → v2 is non-destructive**: `onUpgrade` runs `addColumn` for each new
  `circuits` column and `createTable` for every new table. It never touches,
  rewrites or drops an existing v1 row — the Phase 4 calendar spine survives the
  upgrade intact. A fresh install is created directly at v2 via `onCreate`.
- **Schema export**: both `drift_schemas/drift_schema_v1.json` and
  `drift_schema_v2.json` are committed (v1 retained). Regenerate with
  `dart run drift_dev schema dump lib/core/database/gridview_database.dart drift_schemas/`
  (deterministic — the same code produces a byte-identical file).
- **Migration test harness**: `test/database/generated/` holds drift-generated
  per-version schema helpers (excluded from analysis). `schema_migration_test.dart`
  uses `SchemaVerifier` to (a) validate that the real `1 → 2` migration produces
  a schema **matching the exported v2**, and (b) assert every seeded Phase 4 row
  survives the upgrade. It also covers the fresh-v2 shape, the media cascade and
  the placeholder-no-FK rule.
- **CI** (`.github/workflows/pull_request.yml`): verifies generated code is
  current, verifies the schema export is current (`schema dump` + clean
  `git diff`), and runs the migration tests as part of `flutter test`.
- Future schema bumps add a `verifier.schemaAt(n)` step test and re-export.

## 6. Legacy database isolation

The reconstructed database (`gridview_v2.sqlite`, SQLite) cannot open,
reinterpret or destroy the legacy Hive cache (`*.hive` files). Legacy cleanup is
deferred to a separate, reviewed migration (see ADR 0004).
