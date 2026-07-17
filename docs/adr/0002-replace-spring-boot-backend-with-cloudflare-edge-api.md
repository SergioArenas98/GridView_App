# ADR 0002: Replace Spring Boot backend with Cloudflare edge API

- Status: Accepted
- Date: 2026-07-18

## Context

The legacy backend was a Spring Boot service on Railway with a MySQL database
populated by Jsoup web scrapers, exposing public scraper-trigger routes. Its
database credentials were committed to source control. The workload is
read-only data aggregation with no user accounts or transactions. The legacy
Railway and MySQL services have been shut down, and long-term compatibility
with the old backend is not required.

## Decision

Replace the backend entirely with a small read-optimized edge service as
defined in `docs/technical/GridView_Backend_Scheme.md`:

- Cloudflare Workers (TypeScript) serving a versioned GridView API contract.
- Workers KV for normalized, versioned JSON snapshots with rollback.
- Cloudflare R2 for licensed media variants.
- Cron-triggered provider synchronization; no public write routes.
- Version-controlled curated content in `/content`.

The legacy Spring Boot/MySQL/scraper code was deleted from this repository. A
full pre-rewrite archive is kept locally outside the repository.

## Consequences

- No server or database lifecycle to operate; low fixed cost.
- Provider credentials stay server-side; the mobile app consumes only the
  GridView contract.
- Production data integration is blocked behind the provider legal/licensing
  gate defined in the Backend Scheme.
