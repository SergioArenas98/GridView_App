# ADR 0005: Snapshot conflict rule and freshness semantics

- Status: Accepted
- Date: 2026-07-19

## Context

The client is offline-first and cache-first (`GridView_TRD.md` §16). A refresh
fetches a server snapshot and writes it into Drift; the UI reads from
Drift-backed streams. Two questions must have a documented answer:

1. When may an incoming snapshot **overwrite** cached data, and when must it be
   **rejected** to protect newer cached data?
2. How is content classified **fresh vs stale**?

The backend publishes **versioned, timestamped snapshots** with a monotonic
active-version pointer (`GridView_Backend_Scheme.md` §13.1). Every snapshot
carries `meta.generatedAt`, and season-scoped snapshots additionally carry
`sourceUpdatedAt`, `staleAfter` and `contentVersion`.

### The three provenance values (do not conflate them)

- **`sourceUpdatedAt`** — the age/revision of the *underlying source data*. This
  is what actually determines whether one snapshot is more recent than another.
- **`generatedAt`** — the time the *GridView snapshot document was produced*. A
  snapshot generated later can still carry **older** source data (a delayed or
  re-run generation), so `generatedAt` is not a safe recency signal on its own.
- **`contentVersion`** — an *immutable identity/provenance token* for the content
  representation. It is compared by **equality only**; it is **not** assumed to
  be numerically or lexicographically sortable.

## Decision

### Conflict rule — `sourceUpdatedAt` is the primary boundary

All three values are persisted in the `snapshots` table, keyed by a logical
snapshot key (`home`, `grand_prix:{season}:{round}`). `generatedAt` **must never
outrank** `sourceUpdatedAt`. On a write (`_decideOutcome`):

1. **incoming `sourceUpdatedAt` < stored → reject.** Newer cached data (and the
   entire cached transaction state) is preserved. DAO returns
   `rejectedOlder`; repository reports `RefreshSuccess(applied: false)`.
2. **incoming `sourceUpdatedAt` > stored → apply** atomically.
3. **equal `sourceUpdatedAt` + equal `contentVersion` → skip (idempotent no-op).**
   No rows are rewritten and the stream does not re-emit. DAO returns
   `skippedUpToDate`; repository reports `RefreshSuccess(applied: false)`.
4. **equal `sourceUpdatedAt` + differing `contentVersion` → `generatedAt` is a
   deterministic tie-breaker only.** A strictly **later** `generatedAt` applies;
   an **equal or earlier** one is rejected.

Fallback: when `sourceUpdatedAt` is unavailable on either side (older data that
predates the field), ordering falls back to `generatedAt`.

The entire write (season/circuit/grand-prix/sessions/freshness) occurs inside a
**single Drift transaction**, so a snapshot is applied all-or-nothing, and a
rejected or skipped snapshot performs **no write at all** (no false stream
emission).

### Freshness rule

`evaluateFreshness(freshness, now)`:

- If `staleAfter` is present: `now.isAfter(staleAfter)` ⇒ **stale**, else fresh.
  Server-provided `staleAfter` is authoritative.
- Else if the server `stale` flag is `true` ⇒ **stale**.
- Else ⇒ **fresh**.

Client-side time-based invalidation without server context is deliberately
avoided (`GridView_TRD.md` §16.4). A Grand Prix cached only indirectly (e.g. via
the Home snapshot, with no detail snapshot yet) has no detail freshness and is
treated as **stale**, so the UI shows content immediately while a detail refresh
completes.

## Consequences

- A failed refresh never erases valid cached data (the write is skipped, not the
  cache).
- Older snapshots (e.g. a delayed retry) cannot regress newer cached data.
- Repeated synchronization of the same snapshot is idempotent.
- Fresh/stale is server-driven and deterministic; the stale/offline notice is
  shown without replacing content.

Covered by `test/database/vertical_slice_dao_test.dart`,
`test/data/repositories/race_weekend_repository_test.dart` and
`test/application/*`.
