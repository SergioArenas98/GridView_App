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

When a resource returns `304` but its **local domain data is absent**:

1. Treat the local cache as inconsistent.
2. Retry the request **exactly once**, **unconditionally** (no `If-None-Match`).
3. If the unconditional retry returns `200`, persist it normally.
4. If it returns `304` again, or fails, return a typed
   invalid-cache/protocol failure (`ApiFailureKind.invalidResponse`) and record
   a safe `invalid_cache` category.
5. Never loop.

"Local data present" is a **domain-level** check (the rows exist), not a metadata
check — otherwise the recovery could never trigger, since an ETag is only ever
stored alongside a recorded success.

## Consequences

- A corrupted or partially-cleared cache self-heals on the next refresh with at
  most one extra request.
- A genuinely-empty-but-synced collection re-validates unconditionally on each
  `304` (one extra request); acceptable, since real F1 collections are non-empty
  and the alternative (metadata-only presence) would make the recovery
  unreachable.
- Covered by `test/data/repositories/conditional_refresh_test.dart`
  ("304 with absent local data …").
