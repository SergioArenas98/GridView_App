# ADR 0009: Protected administration with injected token

- Status: Accepted
- Date: 2026-07-20

## Context

Phase 5A needs local and automated tests for manual sync, rollback, cache purge
and quota inspection. Cloudflare Access and production identity controls are not
being configured in this phase.

## Decision

Internal admin routes live under `/internal/admin/*` and require:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

The token is supplied through ignored local files or secrets. Missing and invalid
tokens receive a generic unauthorized response. State-changing operations use
POST only.

## Consequences

Phase 5A can exercise protected operations without adding real credentials or
Cloudflare Access configuration. Cloudflare Access remains a Phase 5B hardening
option before staging/prod exposure.

## U0 amendment - 2026-11-13

Status: Accepted architecture; implementation and activation pending separate approval.

[ADR 0031](0031-identity-review-authority-and-catalog-cutover.md) D1 narrows this ADR's blanket shared-token requirement for future catalog routes. Individually authenticated reader/reviewer/activator roles govern identity operations; the shared `ADMIN_TOKEN` never authorizes catalog mutations. Approval and activation are separate audited operations, which one authorized person may perform without a mandatory two-person quorum. Identity credentials confer no legacy synchronization, rollback or purge authority. Existing operational routes retain this ADR unchanged. No route or credential is implemented/provisioned in U0.
