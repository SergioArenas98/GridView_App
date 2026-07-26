# ADR 0014: Bootstrap atomic persistence and metadata isolation

- Status: Accepted
- Date: 2026-07-26

## Context

`GET /v1/bootstrap` returns a compact first-launch aggregate: season metadata,
calendar summaries, driver/constructor/circuit summaries, both standings tables,
the Home snapshot and the content/media manifest versions. One request replaces a
fan-out of ten individual requests on an empty cache.

That convenience creates two hazards.

**Partial application.** Bootstrap writes several unrelated domain families. If
they were written independently, a failure part-way through would leave the
database describing a season whose calendar, roster and standings disagree — and
possibly a `resource_sync_metadata` row claiming success over it.

**Borrowed validators.** Bootstrap's compact families look like the payloads the
individual endpoints serve. It is tempting to record bootstrap's ETag (and its
`generatedAt` / `sourceUpdatedAt` / `staleAfter` / `contentVersion`) under
`home`, `calendar:<season>`, `standings:*`, `drivers:*`, `constructors:*`,
`circuits:*` and `content:manifest` so those resources "start out fresh". Doing
so would be wrong in three ways: the server never issued that validator for those
URLs, so a later `If-None-Match` would be a lie; the compact payload is a
*subset* of what those endpoints return, so marking them synchronized hides
missing detail; and the freshness window would be invented rather than
server-provided.

A third hazard is specific to compact data: bootstrap must never *downgrade* the
richer data a detail sync already stored.

## Decision

**Bootstrap is one conditional resource like any other.** It runs through the
same `SyncedRepository` pipeline as every other resource: stored ETag →
conditional request → typed `RemoteResult` → centralized snapshot-conflict rule →
atomic write. Its key is `ResourceKey.bootstrap()`.

**One transaction.** `ResourceSync.applySnapshot` opens a single transaction
around the conflict decision, the whole domain write and the success metadata.
Consequently:

- a newer accepted `200` applies every family **and** the success metadata
  together;
- an equal revision is an idempotent no-op; an older or contract-invalid one
  writes no domain rows;
- a `304` updates synchronization metadata only;
- a failure in any single family — or in the metadata write — rolls back every
  other bootstrap change, leaving the previous cache intact;
- no transaction ever spans bootstrap and an unrelated resource.

**Metadata isolation.** Bootstrap is one HTTP representation with one ETag, so
its validator and provenance are persisted **only** under
`ResourceKey.bootstrap()`. No individual resource key is created, marked
successfully revalidated, or given a `generatedAt` / `sourceUpdatedAt` /
`staleAfter` / `contentVersion` because its compact data happened to arrive
inside bootstrap. Each endpoint earns its own metadata the first time its own
representation is refreshed. The `contentVersion` and `mediaVersion` fields
inside the bootstrap payload are informational echoes of the content manifest:
they drive no local write, because recording them under `content:manifest` would
forge that resource's metadata.

**Compact data never downgrades detail data.** Every bootstrap write is either

- a *partial-identity upsert* carrying only the columns the summary actually
  holds — an omitted optional field is left out of the companion rather than
  written as null, so it is never a deletion instruction; or
- a *season-scoped replacement* of a collection OpenAPI defines as complete and
  authoritative for that season (the calendar, the season rosters, both
  standings tables).

Concretely: a compact driver never erases a biography or detail media; a compact
constructor never erases nationality, country or media; a compact circuit never
erases coordinates, length, corner count, direction, first-Grand-Prix year, lap
record or media; calendar summaries never erase detail-synced sessions or the
official name; no results are written or deleted by bootstrap itself; unrelated
seasons are untouched; and stable identities are upserted, never duplicated.

Removing an event from the authoritative season calendar does cascade the rows
that belong to that event (its sessions and result documents). That is
referential integrity for a row the server says no longer exists, not bootstrap
deleting data outside its contract.

**304 recovery predicate.** A valid local bootstrap representation requires a
recorded successful bootstrap **and** the current-season identity its stored data
needs in order to render. Collection emptiness is deliberately not consulted: a
season with nothing scheduled yet is a valid, materialized bootstrap and must not
trigger the unconditional retry from ADR 0012.

**Contract-permitted empty Home.** Unlike `GET /v1/home`, the bootstrap contract
permits a Home block with no featured event. That is not an invalid payload here:
it leaves the Home snapshot unwritten rather than failing the whole bootstrap.

## Consequences

- The database never holds a half-applied bootstrap.
- A later conditional request for an individual resource only ever sends a
  validator the server actually issued for that URL.
- Bootstrap can be re-run safely at any time; it is idempotent for an unchanged
  revision.
- The first useful frame after a first launch comes from one request, not ten.
- Covered by `test/data/repositories/bootstrap_repository_test.dart` (atomicity,
  metadata isolation, conflict outcomes, 304 recovery, compact-merge safety) and
  `test/sync/sync_persistence_test.dart` (on-disk survival and revalidation).
