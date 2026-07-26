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

The dev/staging build can use an **injected fixture API**
(`FixtureGridViewApi`) that serves OpenAPI-valid snapshots bundled under
`assets/dev_fixtures/` through the *same* DTO → repository → Drift → stream → UI
path as production. It is:

- Selected **only** by a deliberate `DATA_SOURCE=fixture` build define, and only
  in non-production builds. It is **never** inferred from a missing
  `API_BASE_URL`.
- **Visibly flagged** by a "Sample data — not live results" banner
  (`usesMockDataProvider`).
- Free of provider identifiers.

Selection (`remoteApiProvider`) is a deliberate function of `(environment,
DATA_SOURCE, API_BASE_URL)` — see `GridView_Environments.md` for the full truth
table:

- **production** → `DioGridViewApi` with a valid base URL; a missing base URL or
  an attempted fixture mode is a controlled configuration failure
  (`MisconfiguredGridViewApi`, typed `configuration`). Production **never**
  constructs `FixtureGridViewApi`.
- **dev/staging** → `FixtureGridViewApi` only under `DATA_SOURCE=fixture`; under
  remote mode (explicit, or the missing/malformed default) a valid base URL uses
  `DioGridViewApi`, and a missing base URL is a controlled configuration failure,
  never fixtures.

## 9. Manual local-development flow

The default dev flow uses the bundled fixtures via a **deliberate** fixture mode
— no running Worker required:

```bash
# Deliberate fixture mode: bundled dev fixtures (assets/dev_fixtures/*).
# The "Sample data" banner is shown.
flutter run --flavor dev --dart-define=APP_ENV=development \
  --dart-define=DATA_SOURCE=fixture
```

Point dev/staging at a real HTTP endpoint instead (a local Worker or staging edge
API) with remote mode and a base URL:

```bash
flutter run --flavor dev \
  --dart-define=APP_ENV=development \
  --dart-define=DATA_SOURCE=remote \
  --dart-define=API_BASE_URL=http://10.0.2.2:8787   # 10.0.2.2 = host from the Android emulator
```

Fixture mode is never inferred: remote mode (the default) with no `API_BASE_URL`
is a controlled configuration failure, not a fixture fallback.

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
only in non-production builds and only under a deliberate `DATA_SOURCE=fixture`
value; production forbids it entirely (see `GridView_Environments.md`).

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
- **304 with no materialized local representation** → retry **exactly once**
  without `If-None-Match`; a 200 persists normally, a second 304 or a failure
  returns a typed invalid-cache/protocol failure. Never loops. "Materialized" is
  resource-specific: a **collection** is present as soon as a successful sync is
  recorded (`lastSuccessAt`), so a valid **empty** collection is present and a
  304 updates metadata only (no retry, no write); a **singleton/detail** is
  present iff its required row exists, so a missing row recovers via the retry.
  See ADR 0012.

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

Per §8 and extended to every repository: the bundled fixture source is used only
under a deliberate `DATA_SOURCE=fixture` non-production build; production never
constructs `FixtureGridViewApi` (an attempted fixture mode or a missing base URL
is a controlled `configuration` failure, never mock content), no admin credential
is ever sent, and no provider identifier enters the domain or Drift. The complete
selection truth table (including missing, malformed and production-forbidden
fixture configuration) is proven in
`test/application/production_isolation_test.dart`.

### 10.9 How Phase 6B2 consumes this layer

Phase 6B1 owns the local **due/stale query**
(`SyncMetadataDao.readDueResources` / `watchDueResources`) and every per-resource
refresh; it wires **no** cross-resource orchestration, foreground policy,
scheduling or background jobs. Phase 6B2 (§11) reads the due-resource query and
drives refreshes through these repositories, reusing the coordinator's per-key
dedup.

One Phase 6B2 change reaches back into this layer: the repository refresh
methods' low-level `bypassValidator` flag (previously `forceRefresh`) is named to
say exactly what it does — drop the stored `If-None-Match`. Application-level
"force" means *eligibility*, never a validator bypass (§11.9), and the two must
never be confused. Repository refresh methods also accept an optional
`RemoteCancellation` so an application-level run can abort what it started.

---

## 11. Phase 6B2 — bootstrap and application synchronization orchestration

Phase 6B2 adds the cross-resource policy and the application lifecycle
orchestration on top of the Phase 6B1 repositories:

```
local Drift cache
  -> immediate application render
  -> bootstrap when first-use data is absent
  -> deterministic due-resource plan
  -> bounded repository refreshes
  -> Drift stream updates
  -> automatic foreground revalidation
  -> manual refresh entry point
```

See ADR 0014 (bootstrap persistence and metadata isolation) and ADR 0015
(startup/foreground/manual policy) for the decisions behind this section.

### 11.1 Ownership

`AppSyncCoordinator` (`lib/features/sync/application/`) is the single
application-level synchronization boundary. It owns:

- first-use bootstrap policy;
- current-season resolution;
- due-resource planning;
- the startup run, the foreground run and the manual current-season refresh;
- cross-resource priority and dependency ordering;
- aggregate run state;
- cancellation of an application-level run.

It owns **none** of: DTO parsing, HTTP response handling, ETag persistence, the
snapshot-conflict comparison, per-resource domain writes, or feature
presentation state. Those stay in Phase 6B1.

`HomeController` no longer starts a refresh when it is created. Automatic
startup/foreground refresh of Home belongs to the coordinator; the controller
mirrors the coordinator's Home outcome and keeps `refresh()` for the user's
explicit retry. Grand Prix detail keeps its on-demand refresh when the detail
page is opened.

### 11.2 Bootstrap as a conditional resource

`BootstrapRepository` / `BootstrapRepositoryImpl` treats `GET /v1/bootstrap` as
one conditional resource under `ResourceKey.bootstrap()` (`bootstrap`), running
through the same `SyncedRepository` pipeline as everything else.

**Transaction boundary.** `ResourceSync.applySnapshot` wraps the conflict
decision, the whole domain write and the success metadata in one transaction:

| Outcome | Domain rows | Metadata |
|---|---|---|
| Newer accepted `200` | all families applied | full success metadata + ETag |
| Equal revision | untouched (idempotent) | validation recorded |
| Older / contract-invalid | untouched | safe conflict category |
| `304` | untouched | validation only |
| Any failure (family or metadata) | **all rolled back** | safe failure category |

**Families persisted** (exactly what OpenAPI `BootstrapData` defines): season
metadata, calendar summaries, season driver summaries + entries, season
constructor summaries + entries, circuit summaries, driver standings,
constructor standings, and the Home snapshot.

### 11.3 Metadata and ETag isolation

Bootstrap is **one** HTTP representation with **one** ETag, so:

- its ETag and provenance are persisted only under `ResourceKey.bootstrap()`;
- `home`, `calendar:<season>`, `standings:*`, `drivers:*`, `constructors:*`,
  `circuits:*` and `content:manifest` are **not** created, marked revalidated, or
  given invented `generatedAt` / `sourceUpdatedAt` / `staleAfter` /
  `contentVersion` values;
- the payload's `contentVersion` / `mediaVersion` are informational echoes and
  drive no local write — writing them under `content:manifest` would forge that
  resource's metadata.

Each individual endpoint acquires its own metadata only when its own
representation is refreshed. Sending a validator the server never issued for a
URL would make the next conditional request a lie.

### 11.4 Compact-data merge rules

Bootstrap must never downgrade richer local detail data. Every write is either a
**partial-identity upsert** (only the columns the summary carries; an omitted
optional field is left out of the companion, never written as null) or a
**season-scoped replacement** of a collection the contract defines as complete
for that season.

| Bootstrap family | Write | Preserves |
|---|---|---|
| Season | `setCurrentSeason` / `upsertSeason` | other seasons' rows and data |
| Calendar | `replaceCalendar` (authoritative for the season) | detail-synced sessions, `officialName`, media on surviving events; other seasons |
| Circuit summaries | `upsertCircuitSummaries` (never deletes) | coordinates, length, corner count, direction, first-GP year, lap record, media |
| Season drivers | identity upsert + `replaceDriverSeasonEntries` | biography, given/family name, nationality, birth, media |
| Season constructors | identity upsert + `replaceConstructorSeasonEntries` | nationality, country, biography, media |
| Standings | `replaceDriverStandings` / `replaceConstructorStandings` | competitor identities; the other table |
| Home | `writeHomeSnapshot` (skipped when the contract-permitted `featuredEvent` is absent) | detail-synced event data |

Results are never written or deleted by bootstrap. Removing an event from the
authoritative season calendar does cascade that event's own child rows — that is
referential integrity, not bootstrap deleting data outside its contract.

Constructor line-ups are derived from the season's driver entries, so a
summary's `driverLineup` is deliberately ignored (Phase 6A ownership).

### 11.5 First-use cache predicate

```
hasUsableFirstScreenCache = currentSeason != null
                         && homeFeaturedSeason == currentSeason
```

A locally resolvable current season, and a renderable Home read model **for that
season**. Nothing more: requiring the calendar, standings or the explore
collections would turn a perfectly renderable returning launch into a forced
first-use bootstrap. A Home snapshot left over from last season does not count.

### 11.6 Startup policy

1. Open local services and Drift.
2. Render the shell and any cached Home data.
3. Start synchronization **after the first frame** (a post-frame callback).
4. The local database stays the only UI read source; successful repository
   transactions reach the UI through Drift streams.

**No usable cache.** Bootstrap is the first and only remote resource attempted.
On success or a valid `304` the run ends there — no immediate fan-out to the
individual resources. On failure: the shell stays usable, partial caches are
preserved, there is no loop, and the run recovers with the **minimal** plan
(season context + first screen). With no local season, the public current-season
resource is attempted once and the minimum Home resource is refreshed; all
collections are never launched to compensate.

**Usable cache.** Render it immediately, do not force bootstrap merely because
the process restarted, resolve the season locally, and refresh only the eligible
resources the server's metadata says are due. No client-side TTL is invented.

### 11.7 Due-resource planner

`SyncPlanner.plan` is pure and deterministic: same inputs, same typed plan, no
clock, no I/O.

Inputs: trigger, supplied UTC now, locally resolved season, expected core keys,
persisted `ResourceSyncState` values, the persisted due-query result, the
usable-cache flag, whether bootstrap is materialized, and whether bootstrap has
already been attempted in this run.

**Due semantics** (`isResourceDue`, the in-memory twin of the SQL predicate):

- `lastSuccessAt` is null → due;
- `serverStale` is true → due;
- `staleAfter` non-null and `<= now` → due (the `<=` boundary is deliberate);
- otherwise not due. No fallback TTL when `staleAfter` is absent.

**Missing metadata rows.** `readDueResources` can only return rows that exist, so
the planner merges the expected canonical keys (built through `ResourceKey`,
never string concatenation) with the query's result and treats a missing row as
never synchronized.

**Resource-key dispatch.** `SyncResourceParser` is the only place a resource key
is taken apart. It maps canonical keys to typed `SyncResource` values, validating
season (1950–2100), round (1–30) and stable ids. Parsing is total: an unknown
prefix, a wrong segment count or a malformed scope becomes
`UnsupportedSyncResource`, which is never refreshed, never crashes a run, and
whose metadata row is never deleted — so an additive key type from a newer build
survives a downgrade. `ResourceRefreshDispatcher` is the single typed registry
mapping those values to repository calls.

### 11.8 Automatic versus on-demand resources

**Automatic core** (startup + foreground):

| Resource | Key |
|---|---|
| Current season | `season:current` |
| Season metadata | `season:<year>` |
| Home | `home:current` |
| Calendar | `calendar:<year>` |
| Driver standings | `standings:drivers:<year>` |
| Constructor standings | `standings:constructors:<year>` |
| Season drivers | `drivers:<year>` |
| Season constructors | `constructors:<year>` |
| Season circuits | `circuits:<year>` |
| Content manifest | `content:manifest` |

**On demand** (never swept automatically; refreshed when their feature/detail is
opened or explicitly requested): `grand-prix:<year>:<round>`,
`grand-prix-results:<year>:<round>`, `driver:<id>:<year>`,
`constructor:<id>:<year>`, `circuit:<id>:<year>`, and any historical-season
resource. Their metadata remains stored and queryable.

Bootstrap itself is not part of the automatic core set: it is scheduled only by
the first-use policy.

### 11.9 Stages, concurrency and manual refresh

| Stage | Resources |
|---|---|
| 0 — Bootstrap | only when first-use policy requires it |
| 1 — Season context | current season, season metadata |
| 2 — First screen | Home, calendar |
| 3 — Championship | driver standings, constructor standings |
| 4 — Explore & content | season drivers, constructors, circuits, content manifest |

Stages execute in order; resources inside a stage are independent and run
concurrently, bounded by an **injected limit of 4**
(`kDefaultSyncConcurrency` / `syncConcurrencyProvider`). This is not a global
HTTP lock: whole runs are serialised, resources within a stage are not. A Home
failure never blocks the calendar or a later stage; one standings failure never
erases or blocks the other. Home appears at most once per plan, and
`GET /v1/status` is never used as a connectivity preflight.

A changed current season is resolved before season-scoped commands are built: the
coordinator executes stage 1, re-reads the local current season, and re-plans
when it changed.

**Manual refresh** (`AppSyncCoordinator.refreshNow`, exposed for Phase 7 through
`refreshCurrentSeasonCore(ref)`) refreshes the current-season core set, ignoring
due eligibility for that run, while **keeping** conditional requests and every
persisted ETag. It uses the same stage order, the same concurrency limit and the
same per-key deduplication, returns an aggregate typed result that represents
partial success, and needs no `BuildContext`. Forcing eligibility is not a
validator bypass; `bypassValidator` remains a separate low-level repository
option that ordinary refreshes never use.

### 11.10 Foreground lifecycle and coalescing

`AppSyncLifecycleScope` is mounted once at the composition root (in
`bootstrap()`), never by a screen, and holds no `BuildContext` beyond its own
`State`.

- The startup run is scheduled in a post-frame callback and runs exactly once.
- The initial `resumed` notification never duplicates it.
- Only a genuine background → resumed transition triggers a foreground run; a
  transient `inactive` (an iOS overlay) does not.
- Rebuilds never trigger synchronization.
- Freshness is queried at the moment the run begins.
- Pause, hidden, detached and provider-scope disposal cancel the active run.
- There is no periodic timer, background isolate or scheduled job, and no
  synchronization continues while the app is deliberately backgrounded.

**Coalescing.** One run owns automatic orchestration at a time:

| Situation | Behaviour |
|---|---|
| Automatic trigger during an active run | joins it; no second run |
| Repeated foreground triggers | one run |
| Manual trigger during an active run | queues **exactly one** forced follow-up |
| Repeated manual taps while that follow-up is pending | still one follow-up |
| Cancellation | resolves pending work; never blocks a future run |

**Cancellation** stops scheduling new resource commands, aborts in-flight
requests through the run's `RemoteCancellation` (releasing each repository's
in-flight slot), and reports the run as cancelled — never as a success. A later
resume or manual refresh starts a fresh run normally.

### 11.11 Aggregate run state

In memory only; `resource_sync_metadata` remains the durable record for each
remote representation, and no run state is persisted to a table.

| State | Meaning |
|---|---|
| `AppSyncIdle` | no run has started |
| `AppSyncRunning` | in progress, with trigger and optional current stage |
| `AppSyncCompleted` | finished; `fullSuccess` separates a clean run from partial failures, with success/failure counts |
| `AppSyncCancelled` | cancelled; never reported as success |
| `AppSyncSeasonContextUnavailable` | no season context could be resolved; season-scoped work was skipped |

Per-resource outcomes carry the canonical key, a category (`applied`,
`unchanged`, `skipped`, `failed`, `cancelled`) and — for a failure — the typed
`ApiFailureKind` only. No exception, Dio response, DTO, Drift row, server body or
configuration value is reachable from the state.

`unchanged` deliberately covers "`304`", "idempotent" and "older revision
rejected" together: Phase 6B1's `RefreshResult` records precisely which case
occurred (`RefreshApplication`), and the application-level report collapses them
into the one fact a consumer needs — the cache was preserved and nothing was
written.

### 11.12 Failure and retry semantics

- A failed resource preserves its valid domain cache and its ETag.
- Other independent resources continue; no transaction spans unrelated resources.
- No coordinator-level retry loop; a rate-limited resource is not immediately
  retried (transport `Retry-After` behaviour is unchanged).
- The single unconditional `304` recovery stays repository-owned (ADR 0012).
- A configuration failure surfaces as a typed `configuration` failure; production
  never falls back to fixtures.
- Offline first launch leaves the shell and local sections usable; offline
  returning launch continues to render cached Home.
- A partial bootstrap failure rolls back the complete bootstrap transaction.
- Safe failure categories may be logged; response bodies and credentials are not.

### 11.13 Season transitions

No active year is hardcoded anywhere. When the current season changes:

- all previous-season data (calendars, standings, entities, details) and its
  metadata are preserved untouched;
- new automatic plans switch to the new season;
- the new `Season` is persisted through the existing repository transaction;
- the new season's core resources have no metadata, so they are treated as
  missing/due rather than fresh;
- a new season with no usable Home cache prefers bootstrap;
- stable identities are not mutated because seasonal branding changed;
- there is no global database reset.

### 11.14 Phase 7 hand-off

- Screens continue to read **Drift streams**; content never comes from a refresh
  result.
- The application coordinator owns **startup and foreground** refresh of the core
  current-season resources listed in §11.8.
- Feature controllers call the manual/core refresh entry point
  (`refreshCurrentSeasonCore(ref)` / `AppSyncCoordinator.refreshNow`) for a
  user-initiated refresh — they must **not** start their own refresh when they
  are created.
- Detail controllers own **on-demand** detail refresh (Grand Prix, results,
  driver, constructor, circuit) when their page is opened.
- Feature controllers must not recreate lifecycle policy: no
  `WidgetsBindingObserver`, no timers, no second startup run.
