# GridView Backend Operations

Status: Phase 5B — local development and Cloudflare **staging** operations. The
step-by-step staging deployment, seeding, verification and rollback procedure
lives in `../operations/GridView_Staging_Edge_Runbook.md`; this document covers
the operational model behind it.

## Local Commands

The edge toolchain is Node 22 and **npm 10.9.9** - the exact version
`services/edge-api/package-lock.json` was resolved under, declared as
`packageManager` in `package.json` and installed and asserted by the CI edge job
before `npm ci`. Regenerate the lockfile only with
`npx --yes npm@10.9.9 install --package-lock-only`; see
`services/edge-api/README.md` for why npm 11 must not be used.

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

The internal quota model is **per source** and holds an extensible collection
of the windows that source actually publishes, plus last provider
success/failure, retry-after, usage by job category and a derived warning
level. OpenF1 publishes per-second and per-minute limits; Jolpica publishes
per-second and per-hour limits; neither publishes a daily figure, so no daily
bucket is modelled. The mock provider's limits are explicitly test-only.

Every count is a **GridView-local counter** derived from each project's
published limits. Neither adopted source returns rate-limit headers
([GridView_Provider_Evaluation.md](GridView_Provider_Evaluation.md) §8.6), so
nothing is read from a response.

Records are stored under `quota:provider:<sourceId>`, and a write whose state
names a different source than its key is rejected rather than relabelled.
`GET /internal/admin/quota` returns `data.sources`, keyed by canonical source
id, with `null` for any source that has no modelled state. There is no
source-neutral quota object, because there is no longer a single quota.

The pre-Phase-9B-1 global `quota:provider` record is read as a narrow fallback
for the **mock** source only. Its daily and per-minute figures are discarded
rather than reinterpreted as a limit any source publishes, and **its warning
level is discarded with them** — that level was derived from those figures, so
it cannot outlive them; carrying a legacy `critical` forward would skip every
job forever, since skipping means no provider attempt and no attempt means the
fallback is never replaced. The migrated level is `unknown` until the first
attempt evaluates one from policy-backed windows. Last provider success and
failure, usage by job category and `Retry-After` do survive: an active
`Retry-After` is a provider instruction and still blocks the next request,
while an expired one blocks nothing. The legacy record is never written again
and never deleted automatically.

Warning levels follow [GridView_Backend_Scheme.md](GridView_Backend_Scheme.md)
§16.1: sustained windows escalate at 30%, 15% and 5% remaining; a burst window
reaching zero once is normal pacing pressure and does not escalate, while
repeated burst saturation stays observable; a provider rate-limit rejection is
critical and preserves `Retry-After`.

### Refreshed before scheduling

Warning level, window usage and `Retry-After` are all **time-dependent** but
persisted, so the stored state is refreshed against the current source policy
and clock **before any scheduler gate reads it**. The refresh rolls expired
windows forward, clears an expired `Retry-After` and re-derives the warning
level. It consumes no quota, makes no provider request, increments no usage
counter, touches no request metric, and is pure and deterministic under a fixed
clock.

This is what stops a source freezing permanently. Only a provider attempt used
to roll a window over, but a stored `critical` blocked the scheduler from
making one, so the state that caused the block was the only thing that could
have cleared it. A level with no current cause is now removed, while a
genuinely current one is retained and still blocks. The refreshed state is
persisted whenever it differs from what was stored, **even when no job runs**,
so the admin quota surface cannot keep reporting an expired critical state.

### Scheduled versus manual behaviour

| Condition | Scheduled | Protected manual recovery |
|---|---|---|
| Active `Retry-After` | Blocked | **Blocked** — a direct provider instruction binds both |
| Current `critical`, reserve has capacity | Blocked | **Allowed**, spending the reserve |
| Current `critical`, reserve exhausted | Blocked | Blocked |
| `high` | Low-priority jobs (`profiles`, `home-rebuild`) skipped | Same |

§16.1 reserves part of the **longest sustained window** — Jolpica's hour,
OpenF1's minute — for manual recovery. Capacity no operation can reach is not
reserved capacity, so an explicit operator run may spend it while it lasts, and
is refused once that window has zero remaining. Manual recovery is a typed
planning input driven by `SyncRequest.trigger`, not inferred from a forced job
list. Every manual trigger arrives through the admin-authenticated router;
there is no public synchronization route, and public reads never consume
provider quota.

### Outbound pacing and the hardened boundary

Phase 9B-2 added the per-provider rate limiter and the hardened outbound HTTP
boundary ([ADR 0021](../adr/0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)).
**No provider adapter exists and no provider request is sent**; what exists is
the seam every future adapter must use.

Pacing is a **Cloudflare Durable Object, one identity per real source**
(`jolpica`, `openf1`), reached with `idFromName(sourceId)`, so the budget is
global rather than per isolate or per Cloudflare location. It reserves across
every published window at once, all-or-nothing, and answers immediately - it
never sleeps or holds a request waiting for capacity. A deferral carries a
deterministic `retryAt`; acting on it is **G5 event-aware scheduling, which
remains open**.

Fail-closed everywhere: if the binding is absent - which it is in every
environment today, because nothing is provisioned - or the object or its
storage fails, the reservation resolves to `unavailable` and **no request is
issued**. A storage failure is absorbed inside the object rather than thrown,
because an exception escaping the serialized section would terminate and reset
the shared limiter for every caller.

Persisted limiter state distinguishes **absent** from **invalid**. A missing
record means a genuinely new source and starts with full capacity. A record
that exists but is unusable - written for another source, or holding anything
that is not a finite, non-negative integer millisecond - blocks that source
with a bounded `state-corrupt` reason: no reservation is granted and no request
is issued. The limiter never restores capacity by guessing what invalid data
meant, and it never repairs, deletes, resets or relabels the record. The source
stays blocked until the state is fixed out of band; there is deliberately no
automatic recovery and no administrative repair route.

Cancellation is handled at two distinct points. A caller already cancelled when
the request is entered **reserves nothing**: there is no live request to acquire
capacity for, and reserving first would spend the single global per-source
budget on something that will never be sent. A caller that cancels **while the
reservation is in flight** keeps the granted slot, because releasing it would
race. Neither sends a request, so neither is an attempted provider request.

**A reservation is not a provider attempt.** A locally deferred or
limiter-unavailable outcome means nothing left GridView, so it increments no
request ledger, no quota usage and no provider success or failure timestamp. An
upstream HTTP 429 is the opposite: a request was attempted and rate-limited,
and it is accounted as such.

Outbound requests are pinned to fixed HTTPS origins and documented path
prefixes, are GET-only, use `redirect: "manual"` and reject every 3xx, carry a
10-second whole-operation timeout, accept only JSON media types, and cap the
decoded body at 2 MiB using both `Content-Length` and bounded streaming.
Nothing is retried automatically. Jolpica receives a reviewed constant
identifying `User-Agent`; neither source authenticates, and no caller header,
cookie or `Authorization` is accepted or forwarded.

Structured events cover reservation allowed, reservation deferred, limiter
failure, request completed, request failed and provider 429. They carry only
bounded fields - operation, canonical source id, bounded failure category, HTTP
status, duration, limiting window kind, `retryAt`, integer remaining counts and
whether a request was attempted. They never carry a body, a full URL, a query
string, a header, a `User-Agent`, a provider-controlled message, a raw
exception or a Durable Object storage key or id.

### Failure accounting

Provider-fetch failures and post-fetch failures are accounted separately.

- A **fetch** error records exactly one failed or rate-limited provider
  attempt, preserving any supplied `Retry-After`.
- A successful fetch records exactly one successful attempt, before any later
  work can throw.
- A **generation, validation, storage or publication** exception after that
  success fails the synchronization as `snapshot-publication-failure` without
  recording a second attempt and without rewriting provider quota as a provider
  failure, so `lastProviderSuccessAt` stands and request metrics, quota
  timestamps and the reported outcome agree.
- In every case the previously active snapshot is preserved, and internal
  exception bodies are never surfaced publicly or logged.

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
duration, season, release version and failure category. Phase 9B-3 adds five
bounded provider-mapping fields (`providerMappingEntity`,
`providerMappingField`, `providerMappingFailure`,
`providerMappingKeyProblem` and the internal
diagnostic `providerMappingValue`), emitted only under
`failureCategory: provider_mapping_unresolved`. The first four are closed
enum members; the fifth is the exact provider identifier, bounded by the
curated schema and truncated again before it is written. It is the one
internal diagnostic field a provider identifier may reach, it exists so an
operator can find the entity to curate
([mapping guide](../operations/GridView_Provider_Mapping_Guide.md)), and it
never enters a public response, an OpenAPI example, a fixture, a published
snapshot or a client-visible cache key. No mapping record, registry dump,
upstream payload or exception body is ever logged. Authorization headers,
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
