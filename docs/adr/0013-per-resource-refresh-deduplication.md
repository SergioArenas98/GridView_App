# ADR 0013: Per-resource refresh deduplication

- Status: Accepted
- Date: 2026-07-25

## Context

Several triggers can request the same resource at once — a screen appearing
while a background refresh is already running, two widgets watching the same
data, or a pull-to-refresh overlapping an automatic one (Phase 6B2). Firing
duplicate HTTP requests for one resource wastes network and can interleave
writes.

Different resources, however, must refresh **independently**: fetching the
calendar must not block fetching standings.

## Decision

A single reusable `RefreshCoordinator`, held once per data layer, deduplicates
refreshes by **canonical resource key** (`ResourceKey`, whose prefixes make keys
globally unique across resources):

- While a refresh for a key is in flight, any further refresh for that same key
  **joins** the running one and shares its single `RefreshResult` — one HTTP
  request.
- Different keys run concurrently; there is **no global lock**.
- When a run completes — success, failure or cancellation — its in-flight slot is
  released, so a later retry starts a fresh request.

Cancellation is cooperative and transport-neutral (`RemoteCancellation`), so a
cancelled request releases its slot without leaking a Dio `CancelToken`.
Repositories and the remote client never hold a `BuildContext`.

This is only per-resource **request** deduplication. It makes **no** policy
decision about whether or when to refresh — that (foreground orchestration,
bootstrap, scheduling) is Phase 6B2, which will consume the same coordinator.

## Consequences

- At most one in-flight HTTP request per resource key; independent keys are
  unaffected.
- A failed or cancelled refresh is always retryable.
- Covered by `test/data/sync/refresh_coordinator_test.dart` and
  `test/data/repositories/repository_concurrency_test.dart`.
