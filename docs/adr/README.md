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
| [0011](0011-typed-conditional-http-results.md) | Typed conditional HTTP results | Accepted |
| [0012](0012-304-with-missing-local-data-recovery.md) | Recovering from a 304 with missing local data | Accepted |
| [0013](0013-per-resource-refresh-deduplication.md) | Per-resource refresh deduplication | Accepted |
| [0014](0014-bootstrap-atomic-persistence-and-metadata-isolation.md) | Bootstrap atomic persistence and metadata isolation | Accepted |
| [0015](0015-application-synchronization-policy.md) | Application startup, foreground and manual synchronization policy | Accepted |
| [0016](0016-production-only-firebase-observability.md) | Production-only Firebase observability behind an application boundary | Accepted |
| [0017](0017-selected-non-fatal-reporting.md) | A narrow non-fatal allowlist with enum-only diagnostic context | Accepted |
| [0018](0018-advertising-not-retained-for-v1.md) | Advertising is not retained for v1 | Accepted |
| [0019](0019-formula-one-provider-legal-gate.md) | Formula 1 data sources under a public-licence compliance model | Accepted |
| [0020](0020-provider-source-observation-and-reconciliation.md) | Source observation, reconciled ordering and the settling design | Accepted |
| [0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md) | Hardened outbound provider boundary and Durable Object rate limiter | Accepted |
| [0022](0022-curated-provider-identifier-mappings.md) | Curated provider-identifier mapping registry | Accepted |
| [0023](0023-multi-source-provider-coordination.md) | Multi-source provider coordination | Accepted |
