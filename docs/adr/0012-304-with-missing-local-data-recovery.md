# ADR 0012: Recovering from a 304 with missing local data

- Status: Accepted
- Date: 2026-07-25

## Context

A conditional request sends `If-None-Match` with the resource's persisted ETag.
The server answers `304 Not Modified` when that ETag still matches — meaning
"you already have the current representation". The client then keeps its cache
and does not re-parse a body.

But the ETag lives in `resource_sync_metadata` while the representation lives in
domain rows. If the domain rows are absent even though an ETag is stored — a
cache inconsistency (an interrupted write, an external wipe, a partial
migration) — a naive `304` handler would report success while the resource has
**no data to render**, and would keep doing so on every refresh because the ETag
keeps producing a `304`.

Because a modified snapshot commits the domain write and its metadata in one
transaction, this inconsistency should not arise from normal operation; the
recovery is defence in depth for the cases above.

## Decision

When a resource returns `304` but **no local representation of it has been
materialized**:

1. Treat the local cache as inconsistent.
2. Retry the request **exactly once**, **unconditionally** (no `If-None-Match`).
3. If the unconditional retry returns `200`, persist it normally.
4. If it returns `304` again, or fails, return a typed
   invalid-cache/protocol failure (`ApiFailureKind.invalidResponse`) and record
   a safe `invalid_cache` category.
5. Never loop.

### What "a local representation exists" means (resource-specific)

Presence is **not** a generic "domain row count > 0" — that would wrongly treat a
successfully-synced but legitimately **empty** collection as missing, retrying on
every later `304`. Three states are distinguished:

- **No representation ever materialized** — the resource has no recorded
  successful sync. A `304` here (an ETag with no success) is inconsistent →
  recover.
- **A materialized representation whose authoritative collection is empty** — a
  valid, present representation. A `304` updates synchronization metadata only;
  **no** retry, **no** domain write.
- **A singleton/detail whose required entity row is missing** — an inconsistent
  cache → recover.

Accordingly the check is:

- **Collections** (calendar, standings, season drivers/constructors/circuits,
  results, content manifest): materialized iff a **successful sync has been
  recorded** (`resource_sync_metadata.lastSuccessAt != null`). Because a modified
  snapshot commits the domain write and its success metadata in one transaction,
  a recorded success guarantees the (possibly empty) collection was written.
- **Singletons/details** (current season, season, home, Grand Prix, driver,
  constructor, circuit): materialized iff the **required domain row exists**.

No schema change or extra column is introduced for this; the existing
`lastSuccessAt` and the domain rows carry the signal.

## Consequences

- A successfully-synced empty collection is a first-class present representation:
  its first `200` persists normal success metadata, and every later `304` updates
  metadata only (one HTTP request, no retry, no domain write) — including after a
  database close/reopen.
- A corrupted/cleared singleton, or a collection that was never materialized,
  self-heals on the next refresh with at most one extra request.
- Covered by `test/data/repositories/conditional_refresh_test.dart` (empty
  collection + `304` → one request; never-materialized collection + `304` → one
  retry; missing singleton + `304` → one retry) and
  `test/data/repositories/persistence_reopen_test.dart` (a valid empty collection
  survives reopen and stays valid on a `304`).
