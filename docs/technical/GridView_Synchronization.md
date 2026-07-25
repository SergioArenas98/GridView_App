# GridView — Synchronization & Offline Behaviour

- Status: Phase 6B1 (conditional remote client + complete repositories). §1–§9
  describe the Phase 4 Home/Grand Prix slice, now generalized to every resource;
  §10 documents the Phase 6B1 layer (conditional requests, ETags, the shared
  sync writer, per-resource dedup and the full repository inventory).
- Related: `GridView_TRD.md` §16, `GridView_Local_Data.md`,
  `docs/adr/0005-snapshot-conflict-and-freshness.md`,
  `docs/adr/0006-riverpod-state-and-result-pattern.md`,
  `docs/adr/0011-typed-conditional-http-results.md`,
  `docs/adr/0012-304-with-missing-local-data-recovery.md`,
  `docs/adr/0013-per-resource-refresh-deduplication.md`

## 1. Remote-to-local flow

The UI reads from Drift-backed streams; a refresh fetches a remote snapshot and
writes it atomically into Drift, after which the stream re-emits.

```
remote DTO (Dio / dev fixture)
   → repository maps DTO → domain entities + freshness
   → DAO writes ONE atomic Drift transaction (conflict rule applied)
   → Drift stream re-emits the updated domain view
   → controller derives the sealed presentation state
   → UI renders (content was already visible from cache)
```

Repository surface (`RaceWeekendRepository`):

- `watchHome()` / `watchGrandPrix(season, round)` — Drift-backed streams.
- `refreshHome()` — fetches `GET /v1/home` and writes the Home snapshot.
- `refreshGrandPrix(season, round)` — fetches
  `GET /v1/seasons/{season}/grand-prix/{round}` and writes the detail snapshot.

`refreshHome` persists the season context, the featured (next) Grand Prix, its
host circuit and the featured session in **one transaction**. `refreshGrandPrix`
persists the full Grand Prix with its ordered session list.

## 2. Conflict / content-version rule

Three provenance values, kept distinct (all persisted per snapshot key `home`,
`grand_prix:{season}:{round}`):

- **`sourceUpdatedAt`** — age/revision of the underlying **source data**. This is
  the **primary conflict boundary**.
- **`generatedAt`** — when the GridView snapshot document was produced. Only an
  **equal-source tie-breaker**; it never outranks `sourceUpdatedAt` (a
  later-generated snapshot can carry older source data).
- **`contentVersion`** — immutable content identity/provenance, compared by
  **equality only** (never assumed sortable).

`SnapshotMeta` **requires** `sourceUpdatedAt`, so the conflict key is
`meta.sourceUpdatedAt` (not the optional `data.freshness.sourceUpdatedAt`). A
snapshot response missing `meta.sourceUpdatedAt` is **contract-invalid** and is
rejected at the remote boundary (`requireSnapshotMeta` → typed
`invalidResponse`) before it reaches the database — it **never** falls back to
`generatedAt`.

Rule (`_decideOutcome`), `generatedAt` never outranks or substitutes for
`sourceUpdatedAt`:

0. incoming `sourceUpdatedAt` **missing** → **reject as invalid** (no write,
   `generatedAt` not consulted; cache preserved).
0b. stored `sourceUpdatedAt` missing but incoming present → **apply** (repair an
   incomplete pre-invariant cached snapshot).
1. incoming `sourceUpdatedAt` **older** than stored → **reject** (newer cache and
   its whole transaction state preserved) → `RefreshSuccess(applied: false)`.
2. incoming `sourceUpdatedAt` **newer** → **apply** atomically.
3. equal `sourceUpdatedAt` **+** equal `contentVersion` → **skip** (idempotent
   no-op; no rows rewritten, no stream re-emit) → `RefreshSuccess(applied: false)`.
4. equal `sourceUpdatedAt` **+** differing `contentVersion` → `generatedAt`
   tie-breaker: strictly **later** applies; **equal/earlier** is rejected.

A rejected, invalid or skipped snapshot performs **no write** (no false stream
update). The Drift `snapshots.sourceUpdatedAt` column stays nullable (schema
unchanged) so legacy null-source rows remain readable and are repaired by rule
0b. See ADR 0005.

## 3. Freshness semantics

`evaluateFreshness(freshness, now)`:

1. `staleAfter` present → stale iff `now > staleAfter` (server-authoritative).
2. else server `stale` flag → stale.
3. else fresh.

A Grand Prix cached only via the Home snapshot (no detail snapshot yet) has no
detail freshness and is treated as **stale**, prompting a detail refresh while
its cached identity/sessions stay visible.

## 4. Presentation states

Pure derivation from `cache + refresh status + clock`:

| Situation | Home state | Detail state |
|---|---|---|
| No cache, first load | `HomeLoading` | `GrandPrixLoading` |
| No cache, refresh failed (network/server) | `HomeFirstLoadError` | `GrandPrixFirstLoadError` |
| No cache, refresh determined it does not exist | — | `GrandPrixNotFound` |
| Cached + fresh | `HomeReady(fresh)` | `GrandPrixReady(fresh)` |
| Cached + stale | `HomeReady(stale)` | `GrandPrixReady(stale)` |
| Cached + background refresh running | `HomeReady(refreshing)` | `GrandPrixReady(refreshing)` |
| Cached + refresh failed | `HomeReady(refreshError)` | `GrandPrixReady(refreshError)` |

## 5. Offline behaviour

After at least one successful sync:

- Home and Grand Prix detail render **cached content immediately**, offline.
- A **skeleton** is shown only when there is no cached content yet.
- Existing content stays visible during a refresh.
- A stale/offline notice is shown **without replacing** content.
- A **failed refresh never erases** valid cached data (the write is skipped).
- First-load failure with no cache is a recoverable error with a **retry**.
- A definitive not-found (404) after a successful determination shows a
  controlled not-found state.

## 6. Error model

The remote data source returns exactly one typed result per call —
`RemoteResult<T>` = `RemoteModified` (200) / `RemoteNotModified` (304) /
`RemoteFailure` (a provider-agnostic `ApiFailure`) — never an exception for a
non-2xx, and never a Dio type (see §10 and ADR 0011). `ApiFailure` covers:
network unavailable, timeout, rate-limited, server unavailable, invalid
response, unsupported API/schema version, not found, invalid request,
cancelled. The repository maps it to a typed `RefreshFailure`; the UI derives a
**localized** message. Raw Dio/SQLite errors, server text and stack traces never
reach the UI. Development logging is safe (method, path, status, request id —
never bodies or keys).

## 7. Date & timezone handling

- API instants are parsed as UTC and stored in UTC.
- The event IANA timezone is a separate field, never derived from a country.
- Session times are presented in **event-local time** (DST-correct via the
  `timezone` package), falling back to the **device** clock when the zone is
  unknown; the shown zone is always labelled.
- Calendar-only dates (`YYYY-MM-DD`) are formatted from their components with no
  timezone conversion, so they never shift. DST transitions are covered by
  `test/time/session_time_test.dart`.

## 8. Development data source

The dev/staging build uses an **injected fixture API**
(`FixtureGridViewApi`) that serves OpenAPI-valid snapshots bundled under
`assets/dev_fixtures/` through the *same* DTO → repository → Drift → stream → UI
path as production. It is:

- Available **only** in dev/staging; production always uses the Dio HTTP client
  and never falls back to mock data (`remoteApiProvider`).
- **Visibly flagged** by a "Sample data — not live results" banner
  (`usesMockDataProvider`).
- Free of provider identifiers.

Production selection (`remoteApiProvider`):

- **production** → `DioGridViewApi` (real HTTPS only; a missing base URL surfaces
  as a refresh failure, never fixtures).
- **dev/staging** → the bundled fixture source, unless an explicit `API_BASE_URL`
  is provided (e.g. a local fixture Worker or staging), in which case the Dio
  client is used against it.

## 9. Manual local-development flow

The default dev flow is **one command** — no running Worker required:

```bash
# Uses the bundled dev fixtures (assets/dev_fixtures/*). Mock banner is shown.
flutter run --flavor dev --dart-define=APP_ENV=development
```

Optional: point dev/staging at a real HTTP endpoint (e.g. a local Worker or
staging edge API):

```bash
flutter run --flavor dev \
  --dart-define=APP_ENV=development \
  --dart-define=API_BASE_URL=http://10.0.2.2:8787   # 10.0.2.2 = host from the Android emulator
```

Exercising states manually:

- **Offline / stale:** turn off connectivity (or airplane mode) and relaunch —
  cached Home/detail still render; the stale/offline notice appears. With the
  bundled fixtures, adjust a fixture's `staleAfter` to a past instant to force
  the stale notice.
- **First-load error:** with `API_BASE_URL` set to an unreachable host and no
  cache, Home shows the recoverable error + Retry.
- **Clear the reconstructed database:** uninstall the dev app
  (`adb uninstall com.sejuma.gridview.dev`) or clear its app storage; the next
  launch starts from an empty `gridview_v2.sqlite`.

**Production never falls back to mock data.** The fixture source is constructed
only for non-production environments.

## 10. Phase 6B1 — conditional client & complete repositories

Phase 6B1 generalizes the Phase 4 slice into the complete v1 read layer, without
a second HTTP client, error hierarchy or repository pattern.

### 10.1 Remote-to-local resource flow

```
GridViewApi (Dio prod / fixture dev)  — one conditional read per resource
   → RemoteResult<T>  (RemoteModified 200 | RemoteNotModified 304 | RemoteFailure)
   → repository maps DTO → domain entities (+ RemoteSnapshotMeta from meta)
   → ResourceSync.applySnapshot: ONE transaction {conflict rule, domain write,
       resource_sync_metadata success update}
   → Drift stream re-emits the domain view
   → (Phase 7) controller derives sealed state → UI renders from cache
```

Each modified public resource is persisted through **one atomic transaction**
that includes the validated domain data, the relational collection
replacement/upserts and the `resource_sync_metadata` success update. A failed
domain write leaves no success metadata behind; a metadata failure rolls the
domain write back. A 304 transaction updates only synchronization metadata.
Independently cacheable resources are never combined into one transaction.

### 10.2 ETag lifecycle & 304 semantics

- Each cacheable resource stores its ETag in `resource_sync_metadata.etag`.
- A refresh reads that ETag and sends `If-None-Match` when present (never on the
  first sync, and never after a `forceRefresh`).
- **200** → persist the returned ETag with the snapshot (success metadata).
- **304** → a successful validation: `lastAttemptAt`/`lastSuccessAt` bump,
  `lastFailureCategory` clears, the ETag is replaced **only if** the server
  supplies a new one, and snapshot provenance (`sourceUpdatedAt`, `generatedAt`,
  `contentVersion`, `serverStale`) is **preserved unchanged** — no new metadata
  is invented from the clock, and no domain rows are rewritten.
- **304 with absent local data** (an inconsistent cache — an ETag but no rows) →
  retry **exactly once** without `If-None-Match`; a 200 persists normally, a
  second 304 or a failure returns a typed invalid-cache/protocol failure. Never
  loops. See ADR 0012.

### 10.3 Conflict rule (centralized)

The §2 rule is implemented once in `SnapshotConflict.decide` (domain layer) and
consumed by **both** `VerticalSliceDao` and `ResourceSync`, so the ordering can
never diverge. `sourceUpdatedAt` is primary; `generatedAt` is only an
equal-source tie-breaker; `contentVersion` is compared by equality. A rejected
(older/invalid) snapshot writes no domain rows and records a safe
`lastFailureCategory` (`conflict_older` / `invalid_snapshot`).

### 10.4 Metadata semantics

`resource_sync_metadata` is the sole local source of remote-resource freshness
and HTTP validator state. On every attempt `lastAttemptAt` updates. On an
accepted 200: ETag, `generatedAt`, `sourceUpdatedAt`, `staleAfter`,
`contentVersion`, `serverStale`, `lastSuccessAt` set and `lastFailureCategory`
clears. On failure: ETag and all prior domain data are preserved, a safe
`lastFailureCategory` is recorded, and `lastSuccessAt` is **not** updated.

### 10.5 Concurrency & cancellation

`RefreshCoordinator` deduplicates concurrent refreshes of the **same** canonical
resource key: a second refresh joins the in-flight one and shares its single
result (one HTTP request). Different keys refresh independently (no global
lock). A completed run — success, failure or cancellation — releases its slot so
a later retry starts fresh. Cancellation is transport-neutral
(`RemoteCancellation`, no Dio `CancelToken` leak). Repositories hold no
`BuildContext`. See ADR 0013.

### 10.6 Repository inventory

| Repository | Reads (local streams) | Refreshes (conditional) |
|---|---|---|
| `SeasonRepository` | current season, season | `/v1/seasons/current`, `/v1/seasons/{s}` |
| `HomeRepository` | Home view | `/v1/home` |
| `CalendarRepository` | season calendar | `/v1/seasons/{s}/calendar` |
| `GrandPrixRepository` | GP detail | `/v1/seasons/{s}/grand-prix/{r}` |
| `ResultRepository` | results by (season, round) | `…/grand-prix/{r}/results` |
| `StandingsRepository` | driver + constructor standings | `…/standings/{drivers,constructors}` |
| `DriverRepository` | season roster, driver detail | `/v1/seasons/{s}/drivers`, `/v1/drivers/{id}` |
| `ConstructorRepository` | season list, team detail | `/v1/seasons/{s}/constructors`, `/v1/constructors/{id}` |
| `CircuitRepository` | season circuits, circuit detail | `/v1/seasons/{s}/circuits`, `/v1/circuits/{id}` |
| `ContentRepository` | content version (metadata) | `/v1/content/manifest` |

Repositories return only domain entities, domain read models and typed
`RefreshResult` — never DTOs, Dio objects, Drift rows/companions or SQLite
errors. `status` and `bootstrap` are covered by typed remote calls
(`fetchStatus`, `fetchBootstrap`); the cross-resource bootstrap **orchestration**
policy is Phase 6B2.

Collection boundaries: the season roster owns a season's driver entries; driver
detail owns the stable identity (biography + media). The constructor line-up is
**derived** from the season's driver entries (never a stored duplicate). Circuit
identity is stable and shared across seasons, so a circuit sync upserts and never
deletes. Media is persisted only for the four FK-backed owner types; a driver's
`media` array is written under its driver owner.

### 10.7 Canonical resource keys

Built exclusively via `ResourceKey` (stable ids only, season-scoped):
`season:current`, `season:2026`, `home:current`, `calendar:2026`,
`standings:drivers:2026`, `standings:constructors:2026`, `drivers:2026`,
`driver:max-verstappen:2026`, `constructors:2026`, `constructor:ferrari:2026`,
`circuits:2026`, `circuit:spa-francorchamps:2026`, `grand-prix:2026:13`,
`grand-prix-results:2026:13`, `content:manifest`.

### 10.8 Development / production isolation

Unchanged from §8 and extended to every repository: production always uses
`DioGridViewApi` (never constructs `FixtureGridViewApi`, never falls back to
mock content — a missing base URL is a typed failure), no admin credential is
ever sent, and no provider identifier enters the domain or Drift. Proven in
`test/application/production_isolation_test.dart`.

### 10.9 How Phase 6B2 consumes this layer

Phase 6B1 owns the local **due/stale query**
(`SyncMetadataDao.readDueResources` / `watchDueResources`) and every per-resource
refresh; it wires **no** cross-resource orchestration, foreground policy,
scheduling or background jobs. Phase 6B2 will read the due-resource query and
drive refreshes through these repositories (e.g. bootstrap on first launch, then
foreground/stale-driven refresh), reusing the coordinator's per-key dedup.
