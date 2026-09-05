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

> **Qualified (2026-09-05) by
> [ADR 0025](0025-season-publication-authority-and-rollback-republication.md),
> not superseded — and not yet implemented.** The limitation recorded above is
> permanent for **document** storage: public payloads remain in Workers KV and
> therefore keep this eventual-consistency propagation behavior for the
> document bytes themselves, whatever ADR 0025 does to pointer authority.
>
> What changes, once ADR 0025's cutover is separately authorized and
> performed, is that **pointer authority is no longer eventually consistent**:
> `activeVersion`/`previousVersion` are resolved through a per-season Durable
> Object's own storage, which is documented as strongly consistent, rather
> than through the `active:{season}`/`previous:{season}` KV keys this ADR
> describes. If the **document** for the now-active version has not yet
> propagated to a given edge location, the router may fall back to the
> **previous** version the same authoritative Durable Object lookup returned
> — a bounded, observable fallback that never changes what the Durable Object
> itself considers active (ADR 0025 D6).
>
> This trades one availability/latency profile for another rather than
> removing a trade-off: resolving the authoritative pointer now depends on a
> single-location Durable Object call instead of a globally-replicated KV
> read, which is slower in the ordinary case and, if the Durable Object
> binding itself is unavailable, fails closed rather than silently falling
> back to a legacy KV pointer nothing else maintains (ADR 0025 D6, D7). This
> new read-path dependency and its cost are recorded, not minimized, in
> ADR 0025.
