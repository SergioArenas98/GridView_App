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

## Decision

### Conflict rule (ordering key: `generatedAt`)

Each persisted snapshot records its `generatedAt` in the `snapshots` table,
keyed by a logical snapshot key (`home`, `grand_prix:{season}:{round}`). On a
write:

- **Incoming `generatedAt` is strictly older than the stored one → reject.**
  The newer cached data is preserved; the DAO returns
  `SnapshotWriteOutcome.rejectedOlder`, and the repository reports
  `RefreshSuccess(applied: false)`.
- **Incoming `generatedAt` is equal → apply (idempotent).** Re-applying the same
  snapshot upserts identical rows and replaces the same session set, so it
  produces no duplicates and no net change.
- **Incoming `generatedAt` is newer → apply (update).** The snapshot replaces the
  cached one; obsolete child sessions are removed by the wholesale replacement.

`generatedAt` is the primary ordering key because it is the monotonic snapshot
version. `contentVersion` is retained as informational provenance.

The entire write (season/circuit/grand-prix/sessions/freshness) occurs inside a
**single Drift transaction**, so a snapshot is applied all-or-nothing.

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
