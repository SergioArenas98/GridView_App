# ADR 0010: Workers KV consistency limitation

- Status: Accepted
- Date: 2026-07-20

## Context

Workers KV is eventually consistent and optimized for read-heavy workloads. It
does not offer transactional multi-key updates.

## Decision

GridView does not claim database-style atomic commits in KV. Publication is
atomic from the public-reader perspective by using immutable versioned documents
and switching readers through `active:{season}` only after verification.

## Consequences

An edge location may briefly serve the older active version during propagation.
That is acceptable for GridView v1 because stale data is preferable to no data
and the product is not live timing. A reader must not see a partially written new
version unless the active pointer has already changed at that location.
