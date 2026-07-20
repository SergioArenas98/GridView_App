# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for the
GridView reconstruction.

## Conventions

- One decision per file, numbered sequentially: `NNNN-short-title.md`.
- Status values: Proposed, Accepted, Superseded, Rejected.
- A superseded ADR is never deleted; it is marked Superseded with a link to
  its replacement.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-retain-flutter-for-the-reconstruction.md) | Retain Flutter for the reconstruction | Accepted |
| [0002](0002-replace-spring-boot-backend-with-cloudflare-edge-api.md) | Replace Spring Boot backend with Cloudflare edge API | Accepted |
| [0003](0003-monorepo-with-flutter-at-repository-root.md) | Monorepo with Flutter at the repository root | Accepted |
| [0004](0004-drift-local-database.md) | Drift local database and database file identity | Accepted |
| [0005](0005-snapshot-conflict-and-freshness.md) | Snapshot conflict rule and freshness semantics | Accepted |
| [0006](0006-riverpod-state-and-result-pattern.md) | Riverpod state management and the result/state pattern | Accepted |
| [0007](0007-versioned-kv-publication-active-pointer.md) | Versioned KV publication with active pointer | Accepted |
| [0008](0008-weak-etag-strategy-with-request-ids.md) | Weak ETags with per-request request IDs | Accepted |
| [0009](0009-protected-staging-administration-token.md) | Protected administration with injected token | Accepted |
| [0010](0010-workers-kv-consistency-limitation.md) | Workers KV consistency limitation | Accepted |
