# GridView Edge API

TypeScript Cloudflare Worker for GridView API v1.

The Worker runs locally for development and is deployed to Cloudflare **staging**
(`gridview-api-staging`, Phase 5B). Production is not deployed. Public routes read
only versioned snapshots through the active pointer. Synchronization is available
through the cron `scheduled` handler and protected internal admin routes, backed
by the deterministic mock provider (`PROVIDER_MODE = mock`). The full staging
deploy/seed/verify/rollback procedure is in
`../../docs/operations/GridView_Staging_Edge_Runbook.md`.

## Local Setup

```text
npm install
cp .dev.vars.example .dev.vars
npm run typecheck
npm run lint
npm run format
npm test
npm run validate
npm run dev
```

Use a disposable local `ADMIN_TOKEN` in `.dev.vars`. Do not commit `.dev.vars`.

## Local Workflow

Start the Worker:

```text
npm run dev
```

Seed/publish the first mock snapshot:

```text
curl -i -X POST http://127.0.0.1:8787/internal/admin/sync/full \
  -H "Authorization: Bearer <local-token>"
```

Call public routes:

```text
curl -i http://127.0.0.1:8787/v1/status
curl -i http://127.0.0.1:8787/v1/seasons/2026/calendar
curl -i http://127.0.0.1:8787/v1/drivers/max-verstappen?season=2026
```

Test ETag / 304:

```text
curl -i http://127.0.0.1:8787/v1/home?season=2026
curl -i http://127.0.0.1:8787/v1/home?season=2026 \
  -H 'If-None-Match: W/"etag-from-first-response"'
```

Rollback to the previous complete release:

```text
curl -i -X POST http://127.0.0.1:8787/internal/admin/rollback \
  -H "Authorization: Bearer <local-token>"
```

Inspect internal state:

```text
curl -i http://127.0.0.1:8787/internal/admin/sync/status \
  -H "Authorization: Bearer <local-token>"

curl -i http://127.0.0.1:8787/internal/admin/quota \
  -H "Authorization: Bearer <local-token>"
```

Simulate provider failure in `.dev.vars`, restart `wrangler dev`, then call admin
sync again:

```text
MOCK_PROVIDER_FAILURE=failure
MOCK_PROVIDER_FAILURE=rate_limited
MOCK_PROVIDER_INVALID_DATA=true
```

## Staging Deployment

Staging config lives in `wrangler.toml` (`[env.staging]`): Worker
`gridview-api-staging` at `https://gridview-api-staging.sejuma18.workers.dev`
(`workers_dev`), KV `GRIDVIEW_DATA` (`1d0fb55486a745a1ad12e03d9f04942b`),
`PROVIDER_MODE = mock`, `PUBLIC_BASE_URL` set, and cron `17 3 * * *` (03:17 UTC).

```text
# validate + bundle without deploying
npm run validate
npm exec wrangler deploy --dry-run --env staging

# set the admin secret (interactive; value never echoed or committed)
npm exec wrangler secret put ADMIN_TOKEN --env staging

# deploy staging (never --env production)
npm exec wrangler deploy --env staging
```

Seed the first release, then run the staging verification scripts (each reads
`GRIDVIEW_STAGING_ADMIN_TOKEN` from the environment where auth is required):

```text
npm run smoke:staging               -- https://gridview-api-staging.sejuma18.workers.dev
npm run check:staging-admin         -- https://gridview-api-staging.sejuma18.workers.dev
npm run workflow:staging-auth       -- https://gridview-api-staging.sejuma18.workers.dev
npm run check:staging-observability -- https://gridview-api-staging.sejuma18.workers.dev
```

See `../../docs/operations/GridView_Staging_Edge_Runbook.md` for the complete
procedure, including ETag/HEAD/304, rollback, observability/redaction and KV
eventual-consistency notes.

## Public Routes

Implemented public `GET` and `HEAD` operations:

- `/v1/status`
- `/v1/bootstrap`
- `/v1/home`
- `/v1/seasons/current`
- `/v1/seasons/{season}`
- `/v1/seasons/{season}/calendar`
- `/v1/seasons/{season}/grand-prix/{round}`
- `/v1/seasons/{season}/grand-prix/{round}/results`
- `/v1/seasons/{season}/standings/drivers`
- `/v1/seasons/{season}/standings/constructors`
- `/v1/seasons/{season}/drivers`
- `/v1/drivers/{driverId}`
- `/v1/seasons/{season}/constructors`
- `/v1/constructors/{constructorId}`
- `/v1/seasons/{season}/circuits`
- `/v1/circuits/{circuitId}`
- `/v1/content/manifest`

Unsupported public methods return the public `METHOD_NOT_ALLOWED` envelope.
Unknown routes and invalid parameters return controlled public error envelopes.

## Internal Admin Routes

Internal routes are not in the public OpenAPI document. Every route requires:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

- `POST /internal/admin/sync/full`
- `POST /internal/admin/sync/resource`
- `POST /internal/admin/rebuild/home`
- `POST /internal/admin/rollback`
- `POST /internal/admin/cache/purge`
- `GET /internal/admin/quota`
- `GET /internal/admin/sync/status`

State-changing operations reject `GET`.

## Storage Model

The storage interface has local-memory and Workers KV adapters. Phase 5A uses
memory locally unless a fake/test KV binding is injected.

Logical keys:

- `snapshot:{season}:{version}:bootstrap`
- `snapshot:{season}:{version}:home`
- `snapshot:{season}:{version}:season`
- `snapshot:{season}:{version}:calendar`
- `snapshot:{season}:{version}:grand-prix:{round}`
- `snapshot:{season}:{version}:grand-prix:{round}:results`
- `snapshot:{season}:{version}:drivers`
- `snapshot:{season}:{version}:constructors`
- `snapshot:{season}:{version}:circuits`
- `snapshot:{season}:{version}:standings:drivers`
- `snapshot:{season}:{version}:standings:constructors`
- `snapshot:{season}:{version}:driver:{driverId}`
- `snapshot:{season}:{version}:constructor:{constructorId}`
- `snapshot:{season}:{version}:circuit:{circuitId}`
- `snapshot:{season}:{version}:content:manifest`
- `active:{season}`
- `previous:{season}`
- `meta:current-season`
- `meta:content-schema`
- `sync:{season}:state`
- `quota:provider`

## Cache Semantics

Success snapshot responses use weak ETags based on immutable snapshot identity:

```text
contentVersion + resource identity
```

The body includes a per-request `meta.requestId`, so strong byte-based ETags are
not emitted. Matching `If-None-Match` returns `304` with no body and with
`X-Request-ID`. Cache policies vary by resource category; public errors use
`Cache-Control: no-store`.

## Mock Provider

The mock provider is named `mock-development-provider`, uses only repository
mock/curated content, has no live network access, supports injected failure and
quota states, and is rejected if explicitly selected in production.

Provider mappings remain internal; provider IDs are not emitted in public
snapshots.
