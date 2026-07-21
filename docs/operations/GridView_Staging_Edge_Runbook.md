# GridView Staging Edge Runbook

Status: Phase 5B — staging deployment of the GridView edge API to Cloudflare
Workers. This runbook is operational: it describes how the staging Worker is
deployed, seeded, verified and rolled back, and the limitations that apply.

Scope and constraints:

- Staging only. Production is **not** deployed in Phase 5B. Do not create the
  production Worker, a production KV namespace, a custom domain or a DNS route.
- The staging Worker serves mock provider data (`PROVIDER_MODE = mock`); it is
  not backed by a live Formula 1 provider.
- Secrets are referenced by **name only**. No token, account credential or
  provider key appears in this document or in the repository.

All commands run from `services/edge-api` unless stated otherwise. `wrangler` is
the repo-pinned dependency; invoke it through `npm exec` / the local
`node_modules/.bin` rather than a global install.

## 1. Cloudflare account selection

The project uses a **single** Cloudflare account, so no
`CLOUDFLARE_ACCOUNT_ID` disambiguation is required. Wrangler operates on the
OAuth-authenticated account.

```text
npm exec wrangler whoami
```

Confirm exactly one account is listed and that the token includes the
`workers_tail (read)` scope (required by the observability helper). If more than
one account is ever associated, set `CLOUDFLARE_ACCOUNT_ID` explicitly before
deploying so the target is unambiguous.

## 2. Deployed staging configuration

These values are committed in `services/edge-api/wrangler.toml` (`[env.staging]`)
and are the single source of truth:

| Setting | Value |
|---|---|
| Worker name | `gridview-api-staging` |
| URL | `https://gridview-api-staging.sejuma18.workers.dev` |
| `workers_dev` | `true` (no custom domain / route) |
| `preview_urls` | `false` |
| KV binding | `GRIDVIEW_DATA` |
| KV namespace id | `1d0fb55486a745a1ad12e03d9f04942b` |
| `ENVIRONMENT` | `staging` |
| `PROVIDER_MODE` | `mock` (permanent staging config) |
| `PUBLIC_BASE_URL` | `https://gridview-api-staging.sejuma18.workers.dev` |
| Cron trigger | `17 3 * * *` |
| Observability | enabled, `head_sampling_rate = 1`, persisted logs |
| Required secret | `ADMIN_TOKEN` |

`PUBLIC_BASE_URL` is mandatory in staging: the scheduled publisher uses it to
compute the public URLs it purges. Its absence is a configuration error.

## 3. Cron trigger and timezone

Cloudflare cron triggers always run in **UTC**. The deployed schedule is:

```text
17 3 * * *      # 03:17 UTC every day
```

Do not change the schedule to a high-frequency cadence for testing — verify the
scheduled handler with the local test suite (section 13) instead. If the cron is
ever edited, redeploy and re-confirm it with:

```text
npm exec wrangler deployments list --env staging
```

## 4. Secrets

`ADMIN_TOKEN` is the only staging secret. Set it interactively so the value is
never echoed, stored in shell history, or passed as a CLI argument:

```text
npm exec wrangler secret put ADMIN_TOKEN --env staging
# paste the value at the interactive prompt
```

List secret **names** (never values) with:

```text
npm exec wrangler secret list --env staging
```

Never commit `.dev.vars`, `.env`, or any file containing the token. Do not
print, log, rotate-in-place or retrieve the value through tooling. To run the
authenticated verification scripts locally, export the token for the current
shell only and clear it afterwards (PowerShell):

```powershell
$env:GRIDVIEW_STAGING_ADMIN_TOKEN = Read-Host "Staging admin token"  # not logged to history
# ... run the checks ...
Remove-Item Env:\GRIDVIEW_STAGING_ADMIN_TOKEN
```

## 5. Validate and dry-run (no deploy)

```text
npm run validate                          # OpenAPI + content + fixtures + worker-config types
npm exec wrangler deploy --dry-run --env staging
```

The dry-run bundles the Worker and resolves bindings without uploading anything
(`--dry-run: exiting now`). Expected bindings: `GRIDVIEW_DATA` (KV) plus the
`ENVIRONMENT`, `PROVIDER_MODE` and `PUBLIC_BASE_URL` vars.

## 6. Deploy staging

```text
npm exec wrangler deploy --env staging
```

This is a normal deploy — never `--env production`. Record the returned version
id. Confirm the deployment:

```text
npm exec wrangler deployments list --env staging
```

## 7. Initial synchronization and publication

The Worker starts with an empty KV namespace and serves controlled empty/`404`
responses until the first release is published. Seed it through the admin
sync endpoint (authenticated):

```text
curl -i -X POST https://gridview-api-staging.sejuma18.workers.dev/internal/admin/sync/full \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

To make the first release deterministic, the mock provider accepts **temporary**
override variables for a single seeding deploy — `MOCK_PROVIDER_SOURCE_UPDATED_AT`
and `MOCK_PROVIDER_CONTENT_VERSION`. These are seeding aids only and **must not**
be committed as permanent `[env.staging.vars]`; the permanent staging provider
configuration is `PROVIDER_MODE = mock`. After seeding, redeploy without the
overrides so the committed configuration is authoritative.

A successful publication writes the full versioned document set, the
`previous:{season}` pointer (if any), content/season metadata, and finally the
`active:{season}` pointer. Publication provenance is `status: "mock"` — the data
is non-authoritative.

## 8. Public smoke tests

All public routes are unauthenticated `GET`/`HEAD`:

```text
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/status
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/seasons/2026/calendar
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/home?season=2026
```

The bundled `scripts/staging-smoke.mjs` walks every public OpenAPI route:

```text
npm run smoke:staging -- https://gridview-api-staging.sejuma18.workers.dev
```

## 9. ETag, HEAD and 304 verification

Success snapshot responses carry a **weak** ETag derived from
`api version + resource identity + contentVersion` (the per-request `requestId`
in the body prevents a strong byte ETag). Verify:

- A first `GET` returns `200` with `ETag: W/"..."`.
- Repeating the `GET` with `If-None-Match: <that ETag>` returns `304` with no
  body and an `X-Request-ID`.
- The same route with `HEAD` returns headers and **no** body.
- After a new content version is published, the ETag changes.

## 10. Admin-security workflow

- No `Authorization` header, or an invalid token → `401` (identical generic
  unauthorized shape for missing vs invalid).
- A valid `Bearer <ADMIN_TOKEN>` → `200`.
- State-changing admin paths reject `GET` (`405`).
- Public write attempts are rejected.

Automated:

```text
npm run check:staging-admin -- https://gridview-api-staging.sejuma18.workers.dev
npm run workflow:staging-auth -- https://gridview-api-staging.sejuma18.workers.dev
```

(Both read `GRIDVIEW_STAGING_ADMIN_TOKEN` from the environment; see section 4.)

## 11. Rollback workflow

Rollback repoints `active:{season}` to a verified previous/target release:

- A rollback with no available target returns `409` and preserves the active
  release.
- A valid rollback restores the prior release and its ETag.

```text
curl -i -X POST https://gridview-api-staging.sejuma18.workers.dev/internal/admin/rollback \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

The publisher verifies the target has its complete document set before writing
the pointer; a cache-purge failure is reported but never undoes the pointer
change.

## 12. Observability and redaction

The observability helper tails the deployed Worker while it drives a full
public + admin workflow and asserts that every expected structured operation
(`request.completed`, `sync.started`, `sync.completed`, `publication.completed`,
`cache.purge`, `rollback.completed`) is observed, and that **no credential
material** appears in the logs.

```text
npm run check:staging-observability -- https://gridview-api-staging.sejuma18.workers.dev
```

Two hard-won details are baked into the helper:

- **Tail launch (Windows).** The tail is launched by invoking Wrangler's real
  CLI entry point directly — `node --no-warnings node_modules/wrangler/wrangler-dist/cli.js tail <worker> --format json`
  — on every platform. Launching the `.cmd` wrapper through `cmd.exe` fails on
  Windows because Node re-escapes the pre-quoted command line with backslash
  quotes that `cmd.exe` cannot parse; the tail then exits within ~40 ms and
  readiness never confirms.
- **Redaction.** Cloudflare's tail renders request headers with the
  `authorization` value already replaced by `REDACTED` (the real header value,
  and therefore the admin token, never reaches the log stream). The Worker's own
  logger additionally redacts sensitive fields to `[redacted]`. The helper
  distinguishes this benign metadata from real credentials: it walks structured
  log fields and flags only an actual token/`Bearer` value, a non-redacted
  `authorization` field value, `GRIDVIEW_STAGING_ADMIN_TOKEN`, provider
  mappings, stack traces, or internal KV keys. The words `authorization`,
  `unauthorized`, `authorization_failed` and an HTTP `401` are **not** treated
  as leaks. Redaction findings report only a category and structured field
  path — never the matched value.

## 13. Scheduled handler verification

The scheduled handler runs the **same** orchestration as the manual admin sync
(`SynchronizationService.run` → `SnapshotPublisher.publish`), reads KV sync and
quota state, skips when no job is due, updates sync/quota metadata, and — because
`active:{season}` is written only on the full success path — preserves the active
release on any failure. It logs only operational metadata (no token or
authorization material).

Verify with the local test suite (the safe mechanism — no remote trigger, no
cron change):

```text
npm test -- test/sync/scheduled-handler.test.ts test/sync/synchronization.test.ts
```

Do not trigger the schedule by editing the cron to a high-frequency cadence.

## 14. Workers KV eventual-consistency limitations

Workers KV is eventually consistent and offers no multi-key transaction.
GridView makes publication atomic **from the reader's perspective** by having
public readers select only through `active:{season}` and by writing that pointer
last. Consequences on staging:

- Immediately after a publish or rollback, a given edge location may briefly
  serve the previous `active` pointer until KV propagates (typically seconds).
- A reader must never observe an unpublished version: the version documents are
  written and verified before the pointer flips.
- Admin `sync/status` reflects the authoritative pointer immediately; public
  edge responses may lag by the propagation window. Re-check after a few seconds
  rather than treating a brief stale read as a failure.

## 15. Cache-purge limitations

Publication and rollback compute the affected public URLs from the published
document set and purge only those URLs through the Cache API adapter. Limits:

- Purge covers the URLs GridView derives; it does not guarantee eviction of
  arbitrary downstream/CDN caches outside the Worker's Cache API scope.
- A purge failure is surfaced (`207`) and logged but **never** corrupts or
  reverts the active pointer — correctness does not depend on purge success.
- Clients still revalidate via weak ETags, so a missed purge degrades to a
  revalidation, not stale-forever content.

## 16. Flutter staging run

Point the staging flavor at the deployed Worker's **public** API (no admin token
— the app only ever calls public routes):

```powershell
fvm flutter run --flavor staging `
  --dart-define=APP_ENV=staging `
  --dart-define=API_BASE_URL=https://gridview-api-staging.sejuma18.workers.dev
```

With `API_BASE_URL` set, dev/staging use the real `DioGridViewApi`, not
`FixtureGridViewApi`, so the client "Sample data" banner is **absent** (its
presence would mean fixtures are in use). Staging identity is the flavor itself
(`applicationId com.sejuma.gridview.staging`, version name suffix `-staging`).
The offline/restart checklist is in `docs/testing/README.md`.

## 17. Production prerequisites

Before any production deployment (out of scope for Phase 5B):

- A production KV namespace and its id in `[env.production]`.
- The `ADMIN_TOKEN` production secret.
- A decision on whether Cloudflare Access protects the admin routes.
- The real Formula 1 provider: legal approval, credentials, and `PROVIDER_MODE`
  other than `mock`/`none`.
- A production cache-purge mechanism and, if used, a custom domain / route and
  its DNS.
- Confirmation that no mock override variable is present in production config.
