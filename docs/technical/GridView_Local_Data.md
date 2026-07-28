# GridView — Local Data (Drift)

- Status: Phase 6B1 (remote-to-local repositories over the Phase 6A schema —
  §7 documents the writers/streams the remote layer adds; schema stays v2)
- Related: `GridView_TRD.md` §12/§15, `GridView_Domain_Model.md`,
  `GridView_Synchronization.md` §10,
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
ISO 3166-1 alpha-2. A **required** display name whose identity has not
synchronized yet is stored as an explicit referential stub, never as a name
derived from the identifier — see §9.

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
| `CalendarDao` | `upsertCircuits` (full circuit + media), `upsertCircuitSummaries` (compact identity only), `replaceCalendar` | `calendar`, `nextEvent`, `latestCompletedEvent`, `currentSession`, `circuitsForSeason`, `circuitDetail` |
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

## 7. Phase 6B1 — how the remote layer writes local data

Phase 6B1 adds no schema and no table/column changes; schema stays **v2**. It
introduces the writers and streams the repositories use:

- **`SeasonDao`** (new) — the current-season pointer (`setCurrentSeason` clears
  `isCurrent` on all other seasons) and per-season metadata; streams + counts.
- **`CalendarDao`** — `replaceCalendar` (season-scoped: obsolete events removed
  and their sessions cascade; unrelated seasons untouched; summary companions
  preserve detail-synced sessions/officialName/media); circuit streams + counts.
- **`StandingsDao`**, **`CompetitorDao`**, **`ResultsDao`** — season/round
  streams and counts; `CompetitorDao` gains partial-identity upserts
  (`upsertDriverIdentities` / `upsertConstructorIdentities`) so a season-summary
  sync never clobbers detail-owned biography/media. `ResultsDao.writeRaceResult`
  now requires the parent Grand Prix to exist (a missing parent is a typed
  rejection, never a fabricated event).
- **`VerticalSliceDao`** — Home/GP snapshot writes accept a `force` flag used
  when the outer `ResourceSync` has already applied the conflict rule against
  `resource_sync_metadata`; the snapshots-table gate then only guards direct
  callers. The conflict decision is delegated to the centralized
  `SnapshotConflict.decide` (shared with `ResourceSync`).

All writes remain transactional at the DAO boundary; the repository composes the
domain write and the `resource_sync_metadata` update into **one** transaction via
`ResourceSync.applySnapshot` (nested DAO transactions become savepoints, so the
whole apply is atomic). See `GridView_Synchronization.md` §10.

The local **due/stale query** (`SyncMetadataDao.readDueResources` /
`watchDueResources`) is unchanged from Phase 6A and is the seam Phase 6B2's
orchestration consumes.

## 8. Phase 6B2 — bootstrap writes and compact-merge safety

Phase 6B2 adds **no** schema change: schema stays **v2**, the database file stays
`gridview_v2.sqlite`, and both exported schema snapshots are byte-identical to
Phase 6A. It adds two write helpers and tightens two existing companions so that
compact aggregate data can never downgrade richer detail data.

**New DAO writes**

- **`CalendarDao.upsertCircuitSummaries`** — the compact `CircuitSummary` upsert
  bootstrap needs: id and name, plus locality/country code **only when the
  summary carries them**. It never deletes (a circuit may host another season's
  events) and never touches the detail-owned coordinates, length, corner count,
  direction, first-Grand-Prix year, lap record or media.

**Home snapshot materialization** (no schema change; existing nullable columns)

- `snapshots.focusSeason` is now the Home representation's **materialization
  signal** and is written unconditionally; `focusRound` is written only when
  there is a featured event to point at. `writeHomeSnapshot` therefore takes a
  required `homeSeason` and a **nullable** `featured`, so a season with nothing
  scheduled is a valid, materialized Home rather than an unwritable one.
- `VerticalSliceDao.homeSnapshotSeason()` / `watchHomeSnapshotSeason()` expose
  that signal; the application-level first-use policy reads it instead of
  inferring materialization from a featured Grand Prix.
- `watchHome()` composes a `HomeView` with a null `featured` for such a season,
  and a `focusRound` whose event row is missing still yields `null` — an
  inconsistent cache, not an empty season.

**Tightened companions** (an omitted optional field is not a deletion
instruction)

- `VerticalSliceDao`'s snapshot circuit companion no longer writes
  `locality` / `country` / `countryCode` as null when a *summary* omits them, so
  a Home snapshot cannot blank a detail-synced circuit's geography.
- The same companion no longer writes a null `officialName`, so a Home snapshot's
  summary event cannot erase the official name a Grand Prix detail sync stored.

**Bootstrap's transaction.** `BootstrapRepositoryImpl` composes the season,
calendar, circuit summaries, driver/constructor identities and season entries,
both standings tables and the Home snapshot into the **single** transaction
`ResourceSync.applySnapshot` opens (nested DAO transactions become savepoints).
Any failure — in a family or in the metadata write — rolls back the whole
bootstrap. See `GridView_Synchronization.md` §11.2–§11.4 and ADR 0014.

**Metadata.** Only the `bootstrap` row is written by a bootstrap sync. No other
`resource_sync_metadata` row is created or updated, so no individual resource
inherits an ETag or a freshness window the server never issued for its URL.

**Aggregate run state is not persisted.** `resource_sync_metadata` remains the
only durable synchronization record; the application-level run state lives in
memory and adds no table.

## 9. Phase 7B — referential stubs for unsynchronized identities

Phase 7B adds **no** schema change: schema stays **v2**, the database file stays
`gridview_v2.sqlite`, and both exported schema snapshots remain byte-identical to
Phase 6A.

### The problem

`driver_standings`, `constructor_standings` and `race_result_entries` reference
`drivers` / `constructors` by stable identifier, and `grand_prix` references
`circuits`. All of them can legitimately be persisted **before** the corresponding
collection has synchronized (bootstrap ordering, a season-scoped refresh that
fails after the standings, a Home or Grand Prix snapshot that carries only a
summary, or a historical season whose competitors were never fetched). The foreign
keys must still hold, and `drivers.full_name`, `constructors.name` and
`circuits.name` are `NOT NULL`, so the parent row has to carry some value.

### The encoding

The parent is created as an explicit **referential stub**: a row whose display
name is `kUnresolvedIdentityName` — the empty string — defined once in
`lib/core/database/unresolved_identity.dart`.

It is deliberately **not** derived from the identifier. Humanising a slug
(`unsynced-driver` → "Unsynced Driver") writes a real-looking name into a real
row, which no reader can afterwards distinguish from an authoritative one; the
invented text then reaches the user and suppresses the localized
"unavailable" copy. That is the defect this encoding exists to prevent.

The encoding is:

- **deterministic** — one exact constant, tested only through
  `isUnresolvedIdentityName`, never a heuristic or a name pattern;
- **unambiguous** — `validateDisplayName` (in `entity_validation.dart`) rejects a
  blank name on every authoritative identity upsert, so a stored empty name means
  *unresolved* and nothing else, and a real identity can never be mistaken for a
  stub;
- **safe to fail on** — it carries no characters, so even a hypothetical leak past
  a read could only render as nothing. It can never read as a plausible name,
  which a humanised identifier always does.

A referential stub is **persistence only**. It is not a domain `Driver`,
`Constructor` or `Circuit`, and it is not a display name.

### Creation — one path

`CompetitorDao.ensureDriverIdentity` / `ensureConstructorIdentity` and
`CalendarDao.ensureCircuitIdentity` are the single creation paths.
`StandingsDao` and `ResultsDao` delegate to the competitor ones, and
`VerticalSliceDao` delegates to the circuit one, rather than writing a parent
themselves. **No DAO humanises an identifier any more** — `_humanizeSlug` is gone
from the codebase.

Both use `INSERT OR IGNORE`, which gives three properties for free:

- an identity that has already synchronized is **never** downgraded or
  overwritten by a standings or classification write;
- repeating a write before the identity arrives is **idempotent** (one row, no
  churn, no stream re-emission);
- the referencing row's stable identifier is untouched, so identity and routing
  keep working while the name is unavailable.

### Reads — the stub never escapes

Every read that projects a competitor name goes through `resolvedDisplayName`,
which maps the marker to `null`:

- `StandingsDao.driverStandingEntries` → `driverName` is `null`;
  `constructorStandingEntries` → `stableName` (and therefore `displayName`) is
  `null`. The Standings screen renders its localized "Name unavailable" copy.
- A driver standing whose `constructorId` is unresolved exposes no team name and
  no team colour — and a team is never inferred from the driver's season entries.
- `ResultsDao` resolves classification names from the stored profiles, so an
  unresolved competitor simply has no name, exactly as if the row were absent.
- `CompetitorDao.driverDetail` / `teamDetail` return `null` for a stub: a
  referential stub is **not a materialized detail**.
- `CompetitorDao.driversForSeason` / `constructorsForSeason` and
  `CalendarDao.circuitsForSeason` omit stubs: a referential stub is **not a
  collection member**. The underlying `driver_season_entries` /
  `constructor_season_entries` / `grand_prix` rows are untouched — only the
  identity-shaped projection skips them.
- For circuits, whose domain `name` is required, an unresolved identity reads
  exactly like an **absent** row: `CalendarEntry.circuit`, `HomeView.circuit` and
  `GrandPrixDetailView.circuit` are `null`, so `circuitName`, `locality` and
  `country` are `null` too and the existing "a missing name stays missing"
  contract holds. `CalendarDao.circuitDetail` returns `null`.

### Resolution

A later authoritative `upsertDrivers` / `upsertConstructors` /
`upsertDriverIdentities` / `upsertConstructorIdentities` / `upsertCircuits` /
`upsertCircuitSummaries` replaces the stub row in place. Because it is the same row, every Drift stream watching `drivers`,
`constructors` or `circuits` re-emits, and the standings, classifications and
calendar entries that referenced it show the real name with no further
synchronization. Nothing is deleted or rewritten to make that happen: no
standings row, no season entry, no event row and no `resource_sync_metadata` row
is involved in resolution, and `order_index` is preserved.

### Scope

All three families that can be referenced before they synchronize are covered:
`drivers`, `constructors` and `circuits`. `seasons` needs no stub rule — its only
required column is the year that identifies it, so an ensured season row carries
no invented content.

## 10. Phase 7C — Explore collection and entity-detail read models

Phase 7C adds **no** table, no column and no migration. `schemaVersion` stays
`2`, `gridview_v2.sqlite` is unchanged, and both Drift schema snapshots remain
byte-identical to the Phase 6A baseline. Everything below is a read model
composed on read, plus two corrected queries.

### 10.1 Read models

Domain-only aggregates (no Drift rows, no DTOs) in
`features/shared/domain/entities/`:

| Type | File | Purpose |
|---|---|---|
| `SeasonDriverCard` | `season_card.dart` | one card per stable driver identity in a season |
| `SeasonTeamCard` | `season_card.dart` | one card per constructor season entry, with its derived line-up |
| `TeamLineupMember` | `season_card.dart` | one participation span of one real driver |
| `SeasonCircuitCard` | `season_card.dart` | one card per circuit hosting a season event |
| `RelatedGrandPrixSummary` | `season_card.dart` | the season-specific event a circuit hosts |
| `DriverProfile` / `DriverParticipation` | `entity_profile.dart` | driver detail for one exact season, with **every** span |
| `TeamProfile` | `entity_profile.dart` | team detail for one exact season |
| `CircuitProfile` | `entity_profile.dart` | circuit detail plus the season's related event |

Every optional value stays `null` when the contract did not supply it, so a
missing statistic is never a zero and a missing name is never an identifier.

### 10.2 Driver participation semantics

`driver_season_entries` already models a mid-season move as **two rows** with
different `start_round`/`end_round` spans; the driver identity never changes.

- `CompetitorDao.seasonDriverCards` groups by `driver_id` and emits **one** card
  per stable identity, carrying `spanCount` so presentation can tell that a
  single "current team" statement would be incomplete. The relevant span is the
  open one (`end_round IS NULL`), else the latest by `start_round`.
- `CompetitorDao.driverProfile` carries **all** spans in relevance order, so the
  detail screen can present them accurately instead of flattening them.
- The team association comes from the **exact** `DriverSeasonEntry`, never from
  `DriverStanding.constructorId`: a standing describes the championship table,
  not participation history.

### 10.3 Team rebranding and line-up

- Stable identity lives in `constructors`; season branding lives in
  `constructor_season_entries`. `SeasonTeamCard.displayName` and
  `TeamProfile.displayName` prefer the season name and fall back to the stable
  name — never to the identifier.
- Rebranding varies the display name only. The collection is ordered by the
  **stable** name, so a rebrand never moves a team.
- The line-up is derived from the season's `driver_season_entries` — the single
  local source of truth for membership. A supplied
  `ConstructorSeasonEntry.driverLineup` is still deliberately not stored and not
  consulted (see §2), so the relational source can never be contradicted.
- Each span is its own line-up member, so a mid-season arrival and exit are both
  representable and are never flattened into a false simultaneous line-up.

### 10.4 Circuit identity versus event properties

Circuit identity is **stable and season-independent**: name, locality, country,
coordinates, length, corners, direction, first Grand Prix year and lap record.

Only the *related event* is season-specific. Race distance and the event's lap
count belong to the Grand Prix and deliberately never appear as circuit identity
fields. `CircuitProfile.relatedGrandPrix` is read from the season's own
`grand_prix_events` row — never inferred from the circuit's name, and never
borrowed from another season. Hosting no event in the selected season is a valid
state.

### 10.5 Corrected queries (no schema change)

Two read queries were corrected to use an authoritative order or a correct
predicate. Neither changes the schema.

- **Circuit collection order.** `CalendarDao.seasonCircuitCards` orders by the
  hosting event's `round` — the season calendar's authoritative order — instead
  of the circuit name. A circuit hosting more than one round is anchored to its
  earliest round, keeping one card per identity and a deterministic order.
- **Resolved-identity checks.** `hasResolvedDriver`, `hasResolvedConstructor`
  and `hasResolvedCircuit` count only **real** identities. The previous
  `count* > 0` checks counted referential stubs, which wrongly suppressed the
  ADR 0012 `304` recovery retry.

### 10.5.1 Collection ordering: what is authoritative and what is not

The three collections do **not** share one ordering story, and the distinction
matters:

| Collection | Order | Authority |
|---|---|---|
| Circuits | the round of the season event the circuit hosts | **Authoritative** — the provider's own calendar |
| Drivers | race number ascending, unnumbered last, stable name as tie-breaker | a deterministic **product / presentation rule** |
| Teams | the stable constructor name | a deterministic **product / presentation rule** |

**Schema conflict reported, not worked around:** `driver_season_entries` and
`constructor_season_entries` carry **no delivered-order column** (unlike
`driver_standings.order_index`), and the contract supplies no explicit ordering
for those collections. The Drivers and Teams orders are therefore **product
decisions made by this application** — they must not be described as
provider-delivered or remotely authoritative. They were chosen over inventing an
order from row insertion order, and over changing the schema, which Phase 7C
forbids.

Both rules are stable across repeated emissions, unaffected by standings
enrichment and unaffected by rebranding. If the provider contract later supplies
an explicit collection order, these rules are the part to replace: it needs a
schema change and its own phase.

### 10.6 Media availability

`MediaDao.ownersWithMedia(type, ids)` reports, in **one** batched query per
collection, which owners have at least one locally known asset. It reports local
availability only — Phase 7C fetches and downloads nothing — and exists so a
placeholder can describe itself accurately.

### 10.7 Referential stubs (unchanged mechanism)

The Phase 7B mechanism (§9) is preserved exactly and now also guards the Explore
collections and the three detail profiles:

- lists omit unresolved stubs (`seasonDriverCards`, `seasonTeamCards`,
  `seasonCircuitCards`, and team line-ups);
- `driverProfile`, `teamProfile` and `circuitProfile` return `null` for a stub,
  so a stub never materializes a detail;
- relationship-bearing rows are preserved throughout, and a later authoritative
  upsert resolves the same row in place;
- `isUnresolvedIdentityName` / `resolvedDisplayName` remain the single detection
  path; no identifier is ever humanised into a display name.
