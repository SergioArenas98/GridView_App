# GridView Edge API

TypeScript Cloudflare Worker for GridView API v1.

The Worker runs locally for development and is deployed to Cloudflare **staging**
(`gridview-api-staging`, Phase 5B). Production is not deployed. Public routes read
only versioned snapshots through the active pointer. Synchronization is available
through the cron `scheduled` handler and protected internal admin routes, backed
by the deterministic mock provider (`PROVIDER_MODE = mock`). The full staging
deploy/seed/verify/rollback procedure is in
`../../docs/operations/GridView_Staging_Edge_Runbook.md`.

## Toolchain

Node 22 and **npm 10.9.9** (recorded in `package.json` as `packageManager`, and
installed and asserted by the CI edge job before `npm ci`). 10.9.9 was the
latest published npm 10 release when this pin was established on 2026-08-13, and
it is the exact version `package-lock.json` was resolved under.

Regenerate the lockfile only with that version:

```text
npx --yes npm@10.9.9 install --package-lock-only
```

Never regenerate it with npm 11. npm 11 computes different hoisting and, on
Windows, prunes optional platform-transitive dependencies that Linux needs - it
re-nests `@emnapi/core` and `@emnapi/runtime`, which `@img/sharp-wasm32`
requires, and `npm ci` then fails on Linux before any gate can run. `npm ci`
still succeeds on Windows with that lockfile, so local verification cannot catch
it. This broke master once; see commit `f2183ba`.

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

### Optional Jolpica egress (Phase 1)

The coordinated runtime supports an optional transport wrapper at
`src/index.ts:providerTransport`. With `JOLPICA_TRANSPORT` absent or `direct`,
the original runtime fetch is used; no proxy origin or credential is needed.
The committed Wrangler environments remain unchanged. The standalone service
and offline tests are now in [jolpica-proxy](../jolpica-proxy/README.md).
Neither phase provisions or activates anything.

After the proxy and a deployment are separately approved, select
`JOLPICA_TRANSPORT=proxy` and set `JOLPICA_PROXY_ORIGIN` to its canonical HTTPS
origin on port 443 (for example `https://egress.example.test`, optionally with
one trailing slash). Paths, queries, credentials and Jolpica's own domain are
rejected. Supply `JOLPICA_PROXY_TOKEN` as a separate Worker secret, never a
Wrangler variable or an admin token. It must be a non-empty bearer token using
letters, digits, `-._~+/` and optional trailing `=`, at most 4096 characters.
Use a high-entropy secret when the later deployment phase is authorized.

The wrapper changes only canonical Jolpica GET destinations and adds
`Authorization: Bearer <proxy token>` to the proxy request. It keeps the path,
query, identifying headers, linked abort signal and manual redirect policy,
and returns the original response without consuming or rewriting it. Other
providers receive no proxy credential. Canonical URL validation, reservations,
pacing, deadlines, 429 evidence/holds and publication safeguards stay in their
existing layers. Invalid proxy configuration fails before provider traffic;
an unavailable proxy has no automatic direct fallback. The existing test
transport override remains first; controlled KV and proxy mode cannot be
combined. Direct mode leaves controlled KV behaviour unchanged.

Disable by removing `JOLPICA_TRANSPORT` or setting it to `direct` in a separately
authorized deployment. Proxy origin and token settings are ignored in direct
mode and can then be removed; no proxy process needs to be reachable. Existing
limiter holds and publication state survive the switch. Eventual deletion of
the wrapper and its configuration needs no adapter, synchronization,
reconciliation or publication changes.

The future proxy is a trusted credential recipient: it must strip proxy auth
before forwarding to Jolpica, never follow redirects, and preserve upstream
response status/body/diagnostic headers. It must forward upstream 429s without
using 429 for its own authentication or overload failures. Worker-side tests cannot establish
those server-side guarantees. No live provider test or activation is part of
Phase 1. All transport tests use in-process mocks, including the runtime-fetch
path through the real Worker entry points.

### Running locally

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
`PROVIDER_MODE = none` with `SEASON_BATCH_INGEST = "2026"` and no cron
(`crons = []`) (committed 2026-10-13, not deployed; live staging still runs
`mock` with cron `17 3 * * *`, 03:17 UTC), and `PUBLIC_BASE_URL` set.

> **Pass the runbook's section 6 gate before every staging deploy.** The gate
> compares `SEASON_PUBLICATION_CUTOVER_CONTROL`,
> `SEASON_PUBLICATION_AUTHORITY`, `PROVIDER_MODE`, the cron trigger and the
> Durable Object bindings in the dry-run below with the live version.
> Any difference makes the deploy cutover-sensitive, never routine, and it
> may run only under the separate authorization section 6 requires. Live
> staging (`c297d260-…`, deployed 2026-09-16) carries
> `SEASON_PUBLICATION_AUTHORITY = "sequencer"` and `activate:2026` — which is
> exactly what this `wrangler.toml` commits, so those values match again. A
> matching configuration is not enough on its own, though: the runbook's
> section 6 also marks the publication guard and the coordinated runtime
> composition in current `master` as cutover-sensitive code, so a staging
> deploy of `master` is **not** ordinary today. Any deploy that changes or
> omits one of those values remains cutover-sensitive. `PROVIDER_MODE` admits
> `coordinated` in code, but no environment selects it, and selecting it is a
> separate authorization. In that mode both sync entry points are wired to
> the reconciliation orchestration (Implementation Plan §14.0.41), but its
> ledger is unbound. The resolver reads an optional `RECONCILIATION_LEDGER`
> binding (§14.0.43), which no environment declares, so every coordinated
> run is refused as `ledger-unbound`: wired, not active. Season 2026 was
> **activated on 2026-09-16** and is `active` and authoritative: its
> publication and rollback run through the sequencer, and the legacy
> `active:2026` / `previous:2026` pointers are unchanged but no longer
> authoritative. The season-2026 recovery window, seed, activation and
> post-activation verification are recorded in section 6.

Always put `--` between `npm exec` and `wrangler`, or npm takes flags such as
`--env` and `--dry-run` as its own. In Windows PowerShell, write
`npm.cmd exec -- wrangler …` instead: the `npm.ps1` shim that `npm` resolves
to there (npm 10.9.9) can consume the separator or the Wrangler flags. See the
runbook's opening notes.

```text
# validate + bundle without deploying
npm run validate
npm exec -- wrangler deploy --dry-run --env staging

# set the admin secret (interactive; value never echoed or committed)
npm exec -- wrangler secret put ADMIN_TOKEN --env staging

# deploy staging (never --env production)
npm exec -- wrangler deploy --env staging
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
