# GridView Backend Operations

Status: Phase 5B — local development and Cloudflare **staging** operations. The
step-by-step staging deployment, seeding, verification and rollback procedure
lives in `../operations/GridView_Staging_Edge_Runbook.md`; this document covers
the operational model behind it.

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

No local command provisions Cloudflare resources or deploys a Worker.

## Staging (Phase 5B)

The edge API is deployed to Cloudflare Workers staging:

- Worker `gridview-api-staging` at
  `https://gridview-api-staging.sejuma18.workers.dev` (`workers_dev`, no custom
  domain or route).
- KV namespace `gridview-snapshots-staging`
  (`1d0fb55486a745a1ad12e03d9f04942b`) bound as `GRIDVIEW_DATA`.
- `ENVIRONMENT = staging`, `PROVIDER_MODE = mock` (deterministic mock provider,
  no live Formula 1 source), `PUBLIC_BASE_URL` set for scheduled purge.
- Cron `17 3 * * *` (03:17 **UTC** daily; Cloudflare crons are always UTC).
- Observability enabled with persisted logs.
- The single required secret is `ADMIN_TOKEN`, set with
  `wrangler secret put ADMIN_TOKEN --env staging` (interactive; never committed,
  printed or passed as a CLI argument).

Deploy is a normal `wrangler deploy --env staging`; a non-deploying
`wrangler deploy --dry-run --env staging` bundles and resolves bindings without
uploading. Temporary mock seeding variables
(`MOCK_PROVIDER_SOURCE_UPDATED_AT`, `MOCK_PROVIDER_CONTENT_VERSION`) are used only
to make the first published release deterministic and must never be committed as
permanent `[env.staging.vars]`. Full procedure and verification:
`../operations/GridView_Staging_Edge_Runbook.md`.

Production is not deployed in Phase 5B — no production Worker, KV, custom domain
or DNS route exists.

## Administrative Authorization

Administration uses an injected `ADMIN_TOKEN`. Locally it lives in `.dev.vars`;
in staging it is a Cloudflare Worker secret. It is never committed. Authorization
is:

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

Local/development uses an in-memory fake purge adapter; staging and production
use the Cloudflare Cache API adapter. Publication and rollback compute the
affected public URLs from the published document set and purge only those URLs.
A purge failure is returned (`207`) and logged, but never corrupts or reverts the
active snapshot pointer — reader correctness relies on weak-ETag revalidation, not
on purge success. Purge covers only the URLs GridView derives, not arbitrary
downstream caches.

## Structured Logging

Logs are structured JSON events for request completion, sync, publication,
rollback, cache purge, quota-related outcomes and validation failures.

Allowed fields include request ID, operation, route template, HTTP status,
duration, season, release version and failure category. Authorization headers,
tokens, provider bodies, full public responses and stack traces are not logged;
the logger redacts sensitive keys (`authorization`, `adminToken`, `token`,
`secret`, `providerKey`, `apiKey`, `password`) to `[redacted]`.

On staging, structured logs are verified against the live tail with
`npm run check:staging-observability`. Cloudflare's tail additionally renders the
request `authorization` header value as `REDACTED`, so the admin token never
reaches the log stream. The helper flags only real credential material — an
actual token or `Bearer` value, a non-redacted `authorization` field value,
provider mappings, stack traces or internal KV keys — and treats the words
`authorization`/`unauthorized`, an `authorization_failed` category and an HTTP
`401` as benign. Its findings report a category and structured field path only,
never the matched value.

## Scheduled Handler

The cron-triggered `scheduled` handler runs the same orchestration as the manual
admin sync (`SynchronizationService.run` → `SnapshotPublisher.publish`): it reads
KV sync/quota state, skips when no job is due, updates sync/quota metadata, and
preserves the active release on any failure (the `active:{season}` pointer is
written only on the full success path). It logs operational metadata only. It is
verified by `test/sync/scheduled-handler.test.ts` and
`test/sync/synchronization.test.ts` (the safe local mechanism — no remote trigger,
no cron change). See `../operations/GridView_Staging_Edge_Runbook.md` §13.

## Staging decisions (settled in Phase 5B)

- Single Cloudflare account; no `CLOUDFLARE_ACCOUNT_ID` disambiguation needed.
- Staging KV namespace id committed in `wrangler.toml`.
- Admin routes are protected by the `ADMIN_TOKEN` bearer check; Cloudflare Access
  remains an optional future hardening layer.
- Staging cache purge uses the Cloudflare Cache API adapter.
- Cron schedule `17 3 * * *` (UTC).

## Production Prerequisites

Before any production deployment (out of scope for Phase 5B):

- A production KV namespace id in `[env.production]` and the production
  `ADMIN_TOKEN` secret.
- Whether Cloudflare Access protects admin routes.
- The real Formula 1 provider: legal approval, credentials, and a `PROVIDER_MODE`
  other than `mock`/`none`.
- A production cache-purge mechanism and, if used, a custom domain / route + DNS.
- Confirmation that no mock override variable is present in production config.
