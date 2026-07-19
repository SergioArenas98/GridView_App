# GridView — Local Data (Drift)

- Status: Phase 4 (first offline-first vertical slice)
- Related: `GridView_TRD.md` §12/§15, `GridView_Domain_Model.md`,
  `docs/adr/0004-drift-local-database.md`,
  `docs/adr/0005-snapshot-conflict-and-freshness.md`

This document describes the local persistence layer introduced by the Phase 4
vertical slice (Home next Grand Prix → Grand Prix detail). It covers only the
tables required by that slice; the full v1 schema is delivered in Phase 6.

## 1. Database identity

- Engine: **Drift 2.34.x over SQLite** (`sqlite3_flutter_libs` native library).
- Filename: **`gridview_v2.sqlite`** in the application documents directory
  (`lib/core/database/connection/open_connection.dart`).
- Schema version: **1**.
- Instants stored in **UTC** (`storeDateTimeAsText: true`).
- Foreign keys enforced on every open (`PRAGMA foreign_keys = ON` in
  `beforeOpen`).

The filename is deliberately new: the legacy app used **Hive** box files, never
SQLite, so there is no collision. Legacy files are **not deleted** in Phase 4
(see ADR 0004).

## 2. Tables and ownership

All tables live in `lib/core/database/tables.dart`. Row classes are suffixed
`Row` so they never collide with the equally-named domain entities.

| Table | Owns | Key | Notes |
|---|---|---|---|
| `seasons` | Season context | `year` (PK) | Minimal rows may be inserted to satisfy FKs; enriched by a full season sync. |
| `circuits` | Circuit summary | `id` (slug, PK) | `name` nullable-safe via humanised fallback; a real name from Home/calendar is never clobbered. |
| `grand_prix` | Grand Prix edition | `id` (PK) + **unique `(season, round)`** | `season → seasons.year`, `circuitId → circuits.id`. Calendar-only `startDate`/`endDate`; event-local IANA `timezone` kept separate from any UTC instant. |
| `sessions` | Weekend sessions | `id` (PK) | `grandPrixId → grand_prix.id` **ON DELETE CASCADE**. `startTimeUtc`/`endTimeUtc` are UTC instants. **Explicit `orderIndex`** for weekend order. |
| `snapshots` | Per-snapshot freshness | `key` (PK) | `home`, `grand_prix:{season}:{round}`. Stores `generatedAt` (conflict key), `sourceUpdatedAt`, `staleAfter`, `contentVersion`, `serverStale`, and a `focusSeason`/`focusRound` pointer used by the Home snapshot to resolve its featured event. |

### Relationships

```
seasons 1───* grand_prix 1───* sessions        (sessions cascade on GP delete)
circuits 1───* grand_prix
snapshots (freshness metadata, keyed by logical snapshot)
```

Stable GridView IDs are the primary identifiers everywhere; display names are
never keys. Country codes follow the approved ISO 3166-1 alpha-2 rule. Optional
values remain nullable; unrecognised enum tokens are stored and read back as the
explicit `unknown` case.

## 3. Data-layer separation

```
Screens (ConsumerWidget)            presentation — no Drift/Dio/DTO imports
  │  watch
Controllers + StreamProviders       application (Riverpod)
  │
RaceWeekendRepository (interface)    domain-facing contract
  │
RaceWeekendRepositoryImpl           data — maps DTO⇄domain, orchestrates
  ├── GridViewApi (remote)          Dio / dev fixture source (DTOs)
  └── VerticalSliceDao (local)      the only place Drift rows exist
```

Rules enforced by structure and review:

- Screens import neither Drift, Dio nor API DTOs.
- Drift rows never escape `VerticalSliceDao`; it returns **domain entities and
  domain views** (`HomeView`, `GrandPrixDetailView`).
- API DTOs never escape the remote data layer; the repository maps them
  explicitly (`event_mapper`, `home_mapper`, `freshness_mapper`).
- Database writes happen only inside the DAO transaction, never in widgets.

## 4. DAO surface (`VerticalSliceDao`)

Reads (Drift streams → domain views):

- `watchHome()` → `Stream<HomeView?>` — resolves the featured event from the
  `home` snapshot's `focusSeason`/`focusRound` pointer, joining season, circuit
  and the featured session.
- `watchGrandPrix(season, round)` → `Stream<GrandPrixDetailView?>` — the Grand
  Prix, its ordered sessions, host circuit and detail freshness.

Writes (atomic snapshot transactions, returning `SnapshotWriteOutcome`):

- `writeHomeSnapshot(...)` — upserts season/circuit/grand-prix + upserts the
  featured session (additive) + writes the `home` freshness row with its focus
  pointer.
- `writeGrandPrixSnapshot(...)` — upserts the grand-prix + **replaces** its
  sessions wholesale (no duplicates) + writes the detail freshness row.

Both apply the **snapshot conflict rule** (ADR 0005): an older `generatedAt` is
rejected; an equal one is idempotent; a newer one updates.

## 5. Migrations

- v1 is the initial schema; `onCreate` runs `createAll()`.
- Schema-version and structural tests: `test/database/schema_migration_test.dart`.
- Future schema bumps must add explicit step tests there. No destructive
  production migration without an approved strategy.

## 6. Legacy database isolation

The reconstructed database (`gridview_v2.sqlite`, SQLite) cannot open, reinterpret
or destroy the legacy Hive cache (`*.hive` files). Legacy cleanup is deferred to
a separate, reviewed Phase 10 migration (see ADR 0004).
