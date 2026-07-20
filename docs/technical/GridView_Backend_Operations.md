# GridView Backend Operations

Status: Phase 5A local operations guide.

## Local Commands

```text
cd services/edge-api
npm install
cp .dev.vars.example .dev.vars
npm run typecheck
npm run lint
npm run format
npm test
npm run validate
npm run dev
```

No command provisions Cloudflare resources or deploys a Worker.

## Administrative Authorization

Phase 5A uses a simple injected `ADMIN_TOKEN` for local/staging-safe
administration. The token lives in `.dev.vars` locally or CI/Worker secrets later.
It is never committed. Authorization is:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

Missing and invalid tokens return the same generic unauthorized shape. Public
routes do not expose CORS behavior for internal routes.

Cloudflare Access remains a Phase 5B+ hardening option.

## Internal Routes

- `POST /internal/admin/sync/full`
- `POST /internal/admin/sync/resource`
- `POST /internal/admin/rebuild/home`
- `POST /internal/admin/rollback`
- `POST /internal/admin/cache/purge`
- `GET /internal/admin/quota`
- `GET /internal/admin/sync/status`

No state-changing route uses `GET`.

## Synchronization Flow

```text
scheduled/manual trigger
  -> read sync state + quota state
  -> calculate due jobs
  -> skip provider if no job is due
  -> call mock provider for due jobs
  -> generate complete public snapshot set
  -> validate and publish through the versioned publisher
  -> record sync/quota state
```

Policy categories:

- `season-calendar`
- `event-schedule`
- `profiles`
- `standings`
- `results`
- `home-rebuild`

GridView v1 is not a live-timing product; no second-by-second refresh behavior
is implemented.

## Quota Behavior

The internal quota model stores daily and per-minute limits/remaining counts,
last provider success/failure, retry-after, usage by job category and warning
level.

High quota pressure skips low-priority jobs (`profiles`, `home-rebuild`).
Critical quota preserves capacity and does not perform scheduled jobs. An active
retry-after prevents immediate retries. Public reads never consume provider
quota.

## Cache Purge

Phase 5A uses an in-memory fake purge adapter. Publication and rollback compute
the affected public URLs from the published document set and purge only those
URLs. A purge failure is returned and logged, but does not corrupt the active
snapshot pointer.

## Structured Logging

Logs are structured JSON events for request completion, sync, publication,
rollback, cache purge, quota-related outcomes and validation failures.

Allowed fields include request ID, operation, route template, HTTP status,
duration, season, release version and failure category. Authorization headers,
tokens, provider bodies, full public responses and stack traces are not logged.

## Phase 5B Prerequisites

Before Phase 5B, decide/provide:

- Cloudflare account and environment separation.
- Real KV namespace IDs for dev/staging/production.
- Whether Cloudflare Access protects admin routes.
- Staging cache purge mechanism.
- Cron trigger schedules.
- Production provider legal approval and credentials.

Do not add account IDs, namespace IDs or provider credentials in Phase 5A.
