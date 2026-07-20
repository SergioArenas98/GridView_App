# ADR 0007: Versioned KV publication with active pointer

- Status: Accepted
- Date: 2026-07-20

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
