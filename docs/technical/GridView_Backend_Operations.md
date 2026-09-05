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

> **Design note (Phase 9B-6b, not implemented).**
> [ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
> authorizes routing this flow's final publish step through one
> `SeasonPublicationSequencer` Durable Object per season instead of writing
> `active:{season}` directly. Both the cron-triggered `scheduled` handler and
> the manual `/internal/admin/sync/full`/`/internal/admin/sync/resource` path
> would call the **same** sequencer for the same season, which is what closes
> the two-unserialized-callers gap recorded in
> [ADR 0020](../adr/0020-provider-source-observation-and-reconciliation.md)'s
> D1.10 note. Today, both paths still call `SnapshotPublisher.publish`
> directly and write `active:{season}` as described below; nothing here is
> activated until the steps gated by ADR 0025 D12 "Activation boundary" and
> [`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md)
> §14.0.11 are each separately authorized.

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

### Multi-source coordination

Phase 9B-4 added the coordination seam above the adapters
([ADR 0023](../adr/0023-multi-source-provider-coordination.md)). **No provider
adapter exists, no port is registered in production wiring and no provider
request is possible**; what exists is the mechanism a future pair of adapters
will be driven through, and the mock provider still serves the synchronization
path unchanged.

An operator reading a coordination run sees, per resource: which sources were
considered, which one was selected and under which declared role, whether each
source's request was actually attempted, and a bounded closed reason when it
was not. Jolpica is the `reconciled` source and OpenF1 the `provisional` one;
selection consults the declared role and nothing else, so provisional data can
never overwrite reconciled data, and a provisional candidate is only ever
returned for a resource OpenF1 is capable of serving.

**OpenF1 is skipped, and that is the expected steady state.** Eligibility is an
already-decided input, not something the coordinator calculates, and **no
maximum-session-duration bound is recorded anywhere in the repository**. A
skipped source performs no reservation, issues no request and increments no
attempted-request accounting, so `source-locked` in a coordination log is
normal rather than an incident.

**Partial coordination does not publish.** The coordinator never writes an
active pointer. A completed run whose every planned resource produced a
candidate is assembled into one complete season and handed to the existing
publisher exactly once; anything else - a cancelled run, a rejected plan, an
unavailable resource, a missing required resource, a calendar round without a
race classification - is withheld with a bounded reason, and the previous
active release keeps serving. A publisher failure is not retried or
compensated, so last-known-good survives it too.

`retryAt` on a deferred contribution is carried as **data only**. Acting on it
is **G5 event-aware scheduling, which remains open**, and no persisted
provenance or provisional/reconciled record state exists - that is **G9**,
which also remains open.

**A plan is untrusted input.** The coordinator validates the plan object itself
before anything runs: closed root shape, a season bounded to the supported
domain, `resources` required to be an actual array and read by index rather
than through a caller-reachable iterator, and every reflection and property
access inside containment. A malformed or hostile plan - a throwing `ownKeys`
trap, a throwing getter, a non-iterable `resources`, a symbol-keyed or
prototype-borne field on an entry - becomes a bounded `plan-rejected` run with
no port call, no accounting and no hostile detail in any log line. A plan whose
season could never be read reports `season: 0`, outside the supported domain
and therefore unambiguous.

**`SnapshotValidator` is structural, not a deep contract validator.** It checks
snapshot metadata, the required top-level shape of each document and provider
neutrality of the body. It does not validate a driver's fields, a standing's
points or any other per-field contract detail. Deep normalized-contract
validation is an **adapter** responsibility, and a real Jolpica or OpenF1
adapter must not be registered or enabled until its normalized outputs pass the
authoritative contract validators. That is an activation gate on G1 and on the
adapter work, not a control running today
([ADR 0023](../adr/0023-multi-source-provider-coordination.md) D14).

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

### A rejected publication is not automatically a successful run

`publish` returns four statuses, and a rejection is the publisher declining a
candidate it examined - a different fact from an operational failure. Exactly
one rejection is benign:

| Publication rejection                       | Synchronization consequence |
| ------------------------------------------- | --------------------------- |
| `older-source-updated-at`                   | Benign completed no-op      |
| `contract-validation`                       | Failed synchronization      |
| `active-version-incomplete`                 | Failed synchronization      |
| Any integrity or malformed-snapshot refusal | Failed synchronization      |
| Any future rejection reason                 | Must be classified explicitly; there is no permissive default |

A candidate older than what is already serving is the pacing system working:
completion advances under the existing documented semantics, due jobs are
marked successful and no `sync.failed` line is emitted.

An integrity refusal fails the run — overall status `failed`,
`lastCompletedAt` does not advance, no due job is marked successful, one
`sync.failed` line instead of `sync.completed`, and the publisher's own precise
bounded reason preserved. Last-known-good is untouched because nothing
published, and the publication's own status stays `rejected` in the result and
in stored sync state: a declined candidate and a broken dependency are
different facts, and an operator has to be able to tell them apart.

Recording an integrity refusal as a completed run advanced `lastCompletedAt`
and marked every due job successful, so the next cadence saw nothing due and a
season that could not be published looked healthy until someone read the
publication status by hand.

The mapping is one exhaustive switch over the closed reason union with no
default, so a new reason is a compile error rather than something that silently
takes the success path. An `applied` publication whose post-commit `previous`
maintenance failed is still a completed run — the release is serving — and its
`sync.completed` line carries the bounded `pointerMaintenance` disposition so
the degraded rollback path is visible without reading storage.

## Version transitions and rollback

Every version records the exact set of document names generation produced
([GridView_Backend_Publication.md](../technical/GridView_Backend_Publication.md)).
Completeness, rollback eligibility, cache invalidation and the operator purge
are all derived from that one set, never from the collection documents, which
are known to omit documents a version really carries.

`active:{season}` is the commit point. Everything before it may fail without
changing what serves; everything after it may fail without un-moving the
pointer. `previous:{season}` is written **after** the commit, so a failed
publication can no longer overwrite the one version a default rollback reaches.

| Situation | Result | Operator action |
| --- | --- | --- |
| Rollback target equals the active version | `skipped`, `idempotent`, HTTP `200` | None. No pointer moved and the existing rollback target is preserved. |
| Target carries no inventory, or one that is malformed | `rejected`, `missing-version-inventory`, HTTP `409` | Roll back to a version that records a well-formed one, or republish. Nothing is reconstructed heuristically or repaired. |
| The outgoing active version has a malformed inventory | `rejected`, `missing-version-inventory`, HTTP `409` | Republish the affected season so it records a well-formed inventory, then retry. No pointer moved, nothing purged. |
| Target inventory is empty | `rejected`, `rollback-target-missing`, HTTP `409` | Choose another target. |
| Target is missing an inventoried document | `rejected`, `rollback-target-incomplete`, HTTP `409` | Choose another target. No pointer moved, nothing purged. |
| Any storage read before the commit fails | `failed`, `storage-read`, HTTP `409` | Retry once storage recovers. Both pointers are unchanged. |
| The active-pointer commit fails | `failed`, `storage-write`, HTTP `409` | Retry. Both pointers are unchanged and nothing was purged. |
| The post-commit `previous` write fails | `applied`, `pointerMaintenance: 'failed'`, HTTP `200` | **The transition applied.** The rollback target is stale, so a default rollback would land on the wrong version — roll back explicitly by version until a later successful transition repairs it. |
| The post-commit purge fails | `applied`, `cachePurge: 'failed'`, HTTP `200` | The transition applied. Re-run the manual purge. |

No storage or purge failure escapes rollback as an exception, and no raw storage
message reaches a response or a log line.

### Design change: rollback republication and authoritative lookup (Phase 9B-6b, not implemented)

[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
authorizes replacing the direct pointer-flip rollback above with
**republication**: rollback reads a selected historical version's stable
public data, copies it into a **new** immutable version without contacting a
provider, recomputes volatile publication/freshness fields and per-key
timestamps against the currently active revision, and commits through the
same `prepare`/`finalize` protocol as ordinary publication — never a direct
write to `active:{season}`. Provider independence is unchanged: no rollback
path, before or after this change, ever contacts a provider.

This changes rollback's operational failure profile, not just its mechanism:
today's rollback needs only one working KV pointer write; the republication
design needs enough KV write availability to create a **complete new version
and inventory** before any commit is attempted, so a partial KV-write outage
that would have tolerated today's single pointer write may not tolerate the
richer rollback. Any pre-commit failure still leaves the current release
serving, unchanged in effect from today's table above.

Once the sequencer is activated, an operator's rollback request resolves its
default target from the Durable Object's own durable operation history rather
than from an independent read of `previous:{season}`, and every rollback
result additionally depends on the Durable Object being reachable: if the
authoritative lookup fails, the request returns the existing bounded
fail-closed shape rather than falling back to a legacy KV pointer, exactly as
the public read path does (ADR 0025 D6). **None of this is implemented.**
Today's rollback table above remains accurate until the Mechanism, Integration
and cutover steps ADR 0025 gates are each separately authorized.

### Staging migration and recovery obligations (design, not implemented)

Cutover (ADR 0025 D12) requires a one-time, operator-controlled migration that
seeds each season's Durable Object state from the last valid
`active:{season}`/`previous:{season}` KV values, verified against the
imported version's own inventory before the authority mode switch. This is
future runbook content: the step-by-step procedure belongs in
`../operations/GridView_Staging_Edge_Runbook.md` and is written when the
Mechanism and Integration PRs exist to run it against, not in this design
pass. Recorded here only so the obligation is not lost: the runbook must
cover the migration procedure itself, verification of the imported state,
the authority-mode switch, and the rollback-of-the-deployment path (reverting
to KV-pointer authority) if cutover verification fails.

## Cache Purge

Local/development uses an in-memory fake purge adapter; staging and production
use the Cloudflare Cache API adapter. Publication computes the affected public
URLs from exact inventories - the published version's and the version it
replaces - and purges only those URLs. A purge the adapter reports as failed is
reported as failed: the URL list on a result is the set that was submitted, not
a claim that every entry was evicted.

**Purge completeness is not numeric-URL completeness.** A CDN keys on the
request URL, and the public router serves the same document under several: the
canonical numeric season, an explicit `season=current`, an **omitted** `season`
that defaults to `current`, and the path form `/v1/seasons/current`. Those are
separate cache entries. When the affected season is the current one, publication,
rollback and the operator purge all expand invalidation - through one shared
mechanism - to every alias the router accepts for the affected documents:
`/v1/bootstrap`, `/v1/home` and the driver, constructor and circuit profile
routes in both their omitted and explicit-`current` forms, plus
`/v1/seasons/current`. `/v1/content/manifest` carries no season and needs none,
and the remaining season routes accept no query and no `current` segment, so they
have exactly one URL each. Nothing about routing, cache keys, TTLs or the public
contract changes - only which URLs an invalidation covers.

**A replacement release also purges what it withdraws.** Publication invalidates
the union of the incoming version's inventory and the exact inventory of the
version it replaces in that season, so a route the new release drops - a driver
who left the grid, a cancelled round, results reclassified as absent - is
invalidated rather than left serving a withdrawn body until its TTL expires. The
union goes through the same expansion, so a withdrawn route on the current season
covers its canonical URL and both aliases. A season with no active version has
withdrawn nothing and is an ordinary first publication; an existing version whose
inventory is missing, malformed or unreadable reports `cachePurge: 'failed'`
rather than being read as an empty surface. The ten base documents cannot be
withdrawn, because a version missing one of them is rejected before the commit
point.

A season known **not** to be current keeps numeric-only invalidation, because its
aliases belong to whatever season is current. Current-season identity is read
from the stored pointer, never from a clock; if it cannot be read the aliases are
purged anyway, since over-invalidating costs one cache miss and under-invalidating
serves a withdrawn release. A publication that moves the current-season pointer
additionally purges the alias URLs the outgoing season was served through, from
that season's own inventory; if that inventory cannot be read the purge reports
`cachePurge: 'failed'` rather than a success it cannot stand behind, still
post-commit and still without reverting the pointer.

**Rollback purges a wider set than it validates.** Whether a version is a legal
rollback target and which public responses may still carry the outgoing
version's representation are two different questions. Completeness is decided
over one version's exact inventory; cache invalidation is decided over the
**union** of the outgoing active version's and the target version's exact
inventories, mapped to public routes, plus the season-wide routes whose
representation depends on the active pointer. It is not gated on `hasResults` at
all — a round's results URL is purged whenever either version carries it, because
otherwise a final classification cached from the newer version would keep being
served at a URL the rollback restored to a meaningful absence. The union covers
orphan profile details, added and removed profiles, and rounds present in only
one of the two calendars. It is deduplicated and sorted deterministically, and
one rollback issues exactly one purge request, after the commit. An outgoing
active version carrying no inventory contributes nothing to the union rather
than blocking the recovery it is being rolled back from. One carrying a
*malformed* inventory refuses the rollback before the commit instead, because
moving the pointer over a surface that cannot be described would silently drop
every route only that version carried.

**`POST /internal/admin/cache/purge` covers the whole active release.** It maps
the active version's exact inventory through the same public-route expansion, so
the season detail, both standings, all three collections, the content manifest
and every driver, constructor, circuit, Grand Prix and results route are
included - together with their current-season aliases when the season it is
purging is the current one. It moves no pointer and writes nothing. With no active version it
returns `207` with `no-active-version`; with an active version whose inventory
is missing or malformed it returns `207` with `missing-version-inventory`, and
whose inventory cannot be read at all it returns `207` with `storage-read`; a
purge adapter that fails, throws or rejects is contained and also returns `207`.

**A stored inventory is validated once, at one boundary.** KV returns whatever
JSON a key holds, so an inventory can deserialize to a number, a string or an
array carrying a non-string. Every reader - the replaced-version read, the
outgoing-current-season alias read, both rollback reads, the operator purge read
and the completeness check - passes through
`src/publication/version-inventory.ts` before anything spreads the value, maps
it to a route or builds an alias from it. A malformed value never escapes as a
thrown error: discovered **before** a commit point it rejects the operation with
`missing-version-inventory` and leaves both pointers untouched; discovered
**after** one it degrades only the purge, reporting `applied` with
`cachePurge: 'failed'`. No new status or reason was introduced for it. See
`GridView_Backend_Publication.md` for the full phase table.

A purge failure is returned (`207`) and logged, but never corrupts or reverts the
active snapshot pointer — reader correctness relies on weak-ETag revalidation, not
on purge success. The rollback purge runs after the pointer write, so a purge
that fails, throws or rejects still reports the rollback as applied with a
bounded `cachePurge: 'failed'`. Purge covers only the URLs GridView derives, not
arbitrary downstream caches.

## Structured Logging

Logs are structured JSON events for request completion, sync, publication,
rollback, cache purge, quota-related outcomes and validation failures.

Allowed fields include request ID, operation, route template, HTTP status,
duration, season, release version and failure category. Phase 9B-4 adds ten
bounded coordination fields (`providerSourceRole`, `coordinationResource`,
`jobCategory`, `coordinationStatus`, `coordinationOutcome`,
`coordinationMissing` and the integer run counts), all closed enum members or
integers. A coordination line never carries a provider payload, a public
snapshot body, an entity identity, a transport reference, a raw exception or a
duplicate of the mapping-failure detail below. Phase 9B-3 adds five
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
