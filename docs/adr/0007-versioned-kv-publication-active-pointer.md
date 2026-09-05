# ADR 0007: Versioned KV publication with active pointer

- Status: Accepted
- Date: 2026-07-20

> **Qualified (2026-09-05) by
> [ADR 0025](0025-season-publication-authority-and-rollback-republication.md),
> not superseded — and not yet implemented.** Versioned snapshot documents and
> their per-version inventory **remain** immutable in Workers KV exactly as
> below. What ADR 0025 changes, once its own Mechanism/Integration/cutover
> steps are separately authorized and completed, is **which write is the
> commit point**: authority over `active`/`previous` moves from the two
> Workers KV pointer writes described below to one atomic transaction in a
> per-season Durable Object's own storage. After that cutover,
> `active:{season}`/`previous:{season}` become **migration-only** inputs, not
> a live pointer any code writes or reads for authority (ADR 0025 D7).
> Rollback also changes in kind: it becomes **republication** of historical
> data through the same `prepare`/`finalize` protocol as ordinary publication,
> never a direct flip of `active:{season}` (ADR 0025 D8) — so the "active-last"
> KV pointer-write logic below is **not** part of the post-cutover
> authoritative protocol; it is preserved here as the historical record of how
> publication works **today**, and remains exactly how it works until cutover
> is separately authorized and performed. Nothing in ADR 0025 has been
> implemented, provisioned or activated.

## Context

GridView public routes must serve only complete, validated snapshots. Workers KV
does not provide multi-key transactions, so a release cannot be committed as one
database transaction.

## Decision

Snapshots are written under immutable versioned keys:

```text
snapshot:{season}:{version}:{document}
```

Public readers first read:

```text
active:{season}
```

They then read the document for that active version. Publication writes and
validates every versioned document, verifies the required set, preserves the old
active version as `previous:{season}`, and writes `active:{season}` last.

## Consequences

A failed provider call, validation failure or pre-activation storage failure
leaves the previous active release visible. Rollback switches `active:{season}`
to a verified previous complete version. Public readers never enumerate snapshot
keys and do not expose internal storage names.
