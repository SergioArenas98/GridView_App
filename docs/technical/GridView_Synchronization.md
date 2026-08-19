# GridView — Synchronization & Offline Behaviour

- Status: accumulated through **Phase 7D**, with a Phase 8 hand-off in §15.8.
  The header previously read "Phase 6B1", which described only §10 and had not
  been updated as the document grew. Its actual scope today:
  §1–§9 the Phase 4 Home/Grand Prix slice, generalized to every resource;
  §10 the Phase 6B1 conditional client (conditional requests, ETags, the shared
  sync writer, per-resource dedup, the full repository inventory);
  §11 the Phase 6B2 bootstrap and application synchronization orchestration;
  §12–§15 feature ownership for Phases 7A (Calendar and Grand Prix), 7B
  (Standings), 7C (Explore and the three detail profiles) and 7D (Home).
  Synchronization architecture is unchanged since Phase 6B2; later sections add
  per-feature ownership rather than new policy.
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

### 8.1 The bundled inventory is incomplete

**Fixture selection works.** What is incomplete is what the bundle contains.

`assets/dev_fixtures/` currently holds three files:

| File | Serves |
|---|---|
| `home.json` | `/v1/home` |
| `grand-prix-2026-12.json` | Grand Prix round 12 |
| `grand-prix-2026-13.json` | Grand Prix round 13 |

`FixtureGridViewApi` resolves sixteen filename families. The rest are absent —
including **`bootstrap`** and **`season-current`** — so a `DATA_SOURCE=fixture`
build cannot resolve the current season, and **every season-scoped screen renders
"Season unavailable"**: Home, Calendar, Grand Prix detail, both Standings tables,
all three Explore collections and all three entity details. Settings and its
sub-screens are unaffected, because they are not season-scoped.

Consequences and boundaries:

- **Full application development currently requires an explicit
  `API_BASE_URL`** pointing at a local or staging Worker (below).
- **Production never falls back to fixtures**, and this changes nothing about
  that: the selection rules in §8 are unaffected.
- **The production and staging HTTP paths are unaffected.** This is a
  development-tooling gap only.
- The validated Edge API contract corpus remains available under
  `services/edge-api/test/fixtures/api/v1/`, covering bootstrap, seasons,
  calendar, standings, drivers, constructors, circuits, grand-prix, results,
  content and status.
- A **separate follow-up** should derive the app's bundled inventory from that
  corpus rather than author new data, keeping one source of truth. It belongs to
  the Phase 2 fixture / Phase 3 mock-navigation owner
  ([GridView_Implementation_Plan.md](GridView_Implementation_Plan.md) §7.5,
  §8.8). It is **not fixed**, and fixture mode is **not** removed.

## 9. Manual local-development flow

Point dev/staging at a real HTTP endpoint (a local Worker or the staging edge
API) with remote mode and a base URL. **This is the flow that currently reaches
every screen**, because the bundled fixture inventory is incomplete (§8.1):

```bash
flutter run --flavor dev \
  --dart-define=APP_ENV=development \
  --dart-define=DATA_SOURCE=remote \
  --dart-define=API_BASE_URL=http://10.0.2.2:8787   # 10.0.2.2 = host from the Android emulator
```

Deliberate fixture mode still exists and is still selected exactly as documented
in §8, but it currently reaches only Home's own response and two Grand Prix
rounds; every season-scoped screen shows "Season unavailable" until the §8.1
follow-up lands:

```bash
# Deliberate fixture mode: bundled dev fixtures (assets/dev_fixtures/*).
# The "Sample data" banner is shown. Season-scoped screens are unavailable
# until the bundled inventory is completed — see §8.1.
flutter run --flavor dev --dart-define=APP_ENV=development \
  --dart-define=DATA_SOURCE=fixture
```

Fixture mode is never inferred: remote mode (the default) with no `API_BASE_URL`
is a controlled configuration failure, not a fixture fallback.

Exercising states manually:

- **Offline / stale:** turn off connectivity (or airplane mode) and relaunch —
  cached Home/detail still render; the stale/offline notice appears. Use a real
  base URL for this: the bundled fixtures cannot populate the season-scoped
  screens the notice belongs to (§8.1).
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

### 10.7a Media metadata ownership (Phase 8B)

Media metadata is carried by the four **detail** resources — `Driver`,
`Constructor`, `Circuit`, `GrandPrix` — and by nothing else. No summary schema,
no season entry, `HomeData` and `BootstrapData` carry media, so media arrives
only through `driver:*`, `constructor:*`, `circuit:*` and `grand-prix:*`, under
those resources' own metadata. Imagery on a collection screen is therefore
whatever previous detail synchronisations happened to persist, read locally.

Phase 8B created **no new freshness hierarchy**:

- an individual resource ETag is never fabricated from `content:manifest`;
- `content:manifest` remains version metadata only (`contentVersion`,
  `mediaVersion`, `supportedSeasons`, `attributionVersion`,
  `minimumApiSchemaVersion`) and gained no asset inventory;
- media freshness is never fabricated from image cache age.

**Image bytes are a separate system.** Disk-cache age is not GridView freshness:
no "updated at" is derived from a cache file, no stale notice comes from an old
image, and no resource refresh is triggered by an expired cache entry. A
versioned immutable URL is the invalidation boundary — new metadata means a new
cache identity, and superseded bytes are left to normal eviction rather than
purged eagerly, because nothing references them any more.

Nothing on the media path calls `GridViewApi`, a repository,
`AppSyncCoordinator`, a detail refresh or a content-manifest refresh. There is no
startup media prefetch, no background media job, no global download queue, no
second coordinator and no additional lifecycle observer. See
[GridView_Media.md](GridView_Media.md).

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

Bootstrap's **own** row does record which season it applied. The request always
asks for the server's current season, so the scope is only known once the
payload arrives: the declared scope is empty and an accepted `200` writes the
season it actually materialized (`SyncedRepository.refreshResource`'s `scopeOf`
hook, used by this one resource). This is bootstrap's own scope column and
nothing else — no individual resource gains a row, an ETag or any provenance
from it — and it is what lets a reader tell an older season's bootstrap from the
current one's (§12.5).

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
                         && materializedHomeSeason == currentSeason
```

A locally resolvable current season, and a **materialized Home representation
for that season**. Nothing more: requiring the calendar, standings or the
explore collections would turn a perfectly renderable returning launch into a
forced first-use bootstrap, and a Home snapshot left over from last season does
not count.

Materialization is read from the persisted snapshot — `snapshots.focusSeason`
for the `home` key, exposed as `HomeRepository.materializedSeason()` — and is
**never** inferred from the presence of a featured Grand Prix. A current season
whose Home legitimately has no scheduled events is a valid empty state and a
usable cache: inferring materialization from a featured event would send such a
season back through bootstrap on every single restart.

The Home read model reflects this directly: `HomeView.featured` is nullable and
`HomeView.seasonYear` always names the season the representation describes, so
an empty season renders a defined empty Home rather than looking like a missing
or still-loading one.

### 11.6 Startup policy

1. Open local services and Drift.
2. Render the shell and any cached Home data.
3. Start synchronization **after the first frame** (a post-frame callback).
4. The local database stays the only UI read source; successful repository
   transactions reach the UI through Drift streams.

**No usable cache.** Bootstrap is the first and only remote resource attempted.
On success or a valid `304` the run ends there — no immediate fan-out to the
individual resources. On failure the shell stays usable, partial caches are
preserved, there is no loop, and the run recovers with the **minimal** plan:
season context, then the minimum Home resource for the resolved season.

Because Home is season-scoped (§11.8), that recovery has a strict order:

1. use a valid locally resolved current season when there is one;
2. otherwise attempt the public current-season resource **exactly once**;
3. only once a season is resolved, refresh Home for that exact year;
4. if no season can be resolved, **do not call Home at all** — the run finishes
   as `AppSyncSeasonContextUnavailable`;
5. non-season-scoped work (the content manifest) may remain independently
   eligible, but it never justifies an unscoped Home request.

All collections are never launched to compensate for a failed bootstrap.

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
| Home | `home:<year>` |
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

**Home is season-scoped.** The server serves a different Home per season, so its
validator, provenance and attempt metadata belong to a specific year and its key
is always `home:<year>`. There is deliberately **no** `home:current`, no unscoped
key, no temporary key and no unconditional request whose metadata is assigned
after the response: a caller that does not yet know the season cannot build a
canonical key and must resolve the season first. `home:current` parses to an
unsupported resource, so a legacy row can never be dispatched.

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
when it changed. That re-plan is also how the bootstrap-failure recovery reaches
Home with the right year — stage 1 resolves the season, the plan is rebuilt, and
only then is `home:<year>` scheduled.

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

---

## 12. Feature ownership (Phase 7A: Calendar and Grand Prix)

Phase 7A is the first consumer of the Phase 6 layer. Nothing about the
synchronization contract changed; this section records how the two features sit
on top of it.

### 12.1 Calendar ownership

`CalendarController` (`lib/features/calendar/application/calendar_providers.dart`)
owns the Calendar's *presentation* refresh status and nothing else.

- **It starts no refresh when it is created.** Startup and foreground refresh of
  the current-season core set belong to `AppSyncCoordinator` (§11.6, §11.10). A
  controller that also refreshed on creation would issue a known-duplicate
  request that per-key deduplication should never have to absorb, and would
  couple "the user looked at a screen" to "the app synchronised". Building or
  rebuilding the Calendar screen therefore cannot produce a request.
- **It mirrors the coordinator's report** for the exact `calendar:<season>`
  resource, through the shared `resourceRefreshStatus` projection. An unrelated
  core resource failing during a run is never a Calendar error, and another
  season's calendar never matches.
- **Content comes only from Drift**: `calendarCacheProvider(season)` streams
  `CalendarRepository.watchCalendar`, which returns `CalendarEntry` domain read
  models (the persisted Grand Prix summary joined with its host circuit
  summary). No Drift row and no DTO reaches presentation.

### 12.2 Manual Calendar refresh

Pull-to-refresh and the app-bar refresh action both call
`CalendarController.refresh()`, which calls the one manual entry point,
`manualCoreRefreshProvider` -> `AppSyncCoordinator.refreshNow()`.

- It forces **eligibility** for one run and keeps conditional requests and
  persisted ETags — a `304` is a successful validation, not a failure.
- Concurrent taps are collapsed: the controller's own in-progress guard drops
  the second tap, and the coordinator queues at most one forced follow-up behind
  an active run.
- The returned future always completes — after success, failure **or**
  cancellation — so the refresh indicator can never hang.
- The aggregate result is read **resource by resource**: only a failed
  `calendar:<season>` (or an unresolvable season) becomes a Calendar error.
- No `BuildContext` is stored anywhere in the controller.

`manualCoreRefreshProvider` exists so a feature depends on the *capability*
rather than on the coordinator's whole object graph; there is still exactly one
implementation in the application.

### 12.3 Current-season resolution

The Calendar branch root stays season-agnostic (`/calendar`). The season is
resolved locally from `currentSeasonProvider`, a stream over
`SeasonRepository.watchCurrentSeason()`:

- no year is ever hardcoded;
- a season transition re-points the screen at the new season's resources; the
  previous season's rows and metadata stay in Drift, simply unwatched;
- a transient loss of connectivity never clears an already-resolved season;
- with no season resolvable **and** no calendar stored, the screen shows a
  controlled, retryable state rather than throwing. It only claims the season is
  unresolvable once an application run has actually finished trying.

### 12.4 Relevant-event resolution

`resolveRelevantEvent` (`lib/features/shared/domain/relevant_event.dart`) is the
single rule shared by Home, the Calendar screen and `CalendarDao.nextEvent`, so
the three can never disagree. It is pure and takes an injected clock.

1. An event **in progress** wins — either the server says so, or today falls
   inside its `[startDate, endDate]` window.
2. Otherwise the earliest still-eligible event dated on or after today, with
   `round` as the stable tie-breaker.
3. Otherwise none.

**Cancelled** events are never relevant. **Completed** events are never
upcoming. **Postponed** events stay eligible while they still carry a date on or
after today — they remain on the calendar, only moved. Missing or malformed
dates make an event ineligible for the date rules; they never throw.

### 12.5 Calendar presentation states

`computeCalendarState` is pure and independently testable. Materialization is
read from the persisted `resource_sync_metadata` row (`lastSuccessAt != null`),
matching `SyncedRepository.collectionRepresentation` — **never** inferred from
the number of events. So:

- a successfully synchronised but **empty** calendar is `CalendarEmpty`, a real
  state with its own copy, never a loader and never an error;
- a calendar that has never synchronised and has no events is `CalendarLoading`
  (or `CalendarFirstLoadError` once a failure has been reported);
- cached events always win: `CalendarReady` keeps its rows through a refresh and
  through a refresh failure, which is reported as a non-blocking notice.

Materialization has **two** sources, and neither is a row count:

1. the calendar resource's own record — `calendar:<season>.lastSuccessAt` is
   set (the `collectionRepresentation` rule);
2. an accepted bootstrap **for this exact season** — one atomic transaction
   applied the contract-defined calendar collection, so a season that
   legitimately has no events is materialized even though the calendar endpoint
   has never been called.

The bootstrap record is consulted for materialization only. It contributes no
ETag, no provenance and no freshness to the calendar resource; `calendar:<season>`
stays absent, so the resource remains due for the next foreground or manual run
and its first conditional request still carries no validator (§11.3). The season
match uses bootstrap's own recorded season, so an older season's bootstrap can
never materialize a newer current season's calendar.

Because a bootstrap-materialized calendar has no record of its own, its freshness
is **unknown** rather than fresh or stale: no "updated at" line and no stale
notice are shown until the calendar endpoint has synced once. A later failed
calendar refresh keeps the bootstrap-derived empty/ready state and adds only a
non-blocking error.

### 12.6 Grand Prix detail and results ownership

Detail and results stay **feature-owned and on demand** (§11.8); neither is
routed through the application planner.

- `GrandPrixController` issues at most **one** detail refresh for
  `grand-prix:<season>:<round>` when a valid route opens. The notifier is built
  once per provider lifetime, so a widget rebuild cannot produce a second
  request. Disposal cancels the in-flight request, releasing the repository's
  per-key slot so a later visit retries cleanly.
- `GrandPrixResultsController` owns `grand-prix-results:<season>:<round>` and is
  driven by **eligibility**, never by a timer.
- Rendering never waits for either request: both local streams are subscribed
  immediately and cached content is visible while a request runs.
- The two are independent: a result failure never replaces valid detail with a
  full-screen error, and a detail failure never erases cached detail or cached
  results.

### 12.7 Result eligibility and cached-result precedence

- Stored classifications make the resource eligible, so entering the screen
  revalidates them **conditionally, exactly once**.
- With nothing stored, the event's own `hasResults` decides: an upcoming event
  with `hasResults == false` never asks for a classification that does not exist.
- A detail refresh that flips `hasResults` from `false` to `true` triggers
  exactly one result request; no further local emission repeats it.
- A failed automatic attempt is **not** retried automatically — the user's retry
  action calls the result controller directly.
- **Cached results always win.** Once a document with entries is stored it is
  rendered regardless of what a later compact or detail `hasResults` flag says.
  A stored document with `status = unavailable` and no entries is not a
  classification and does not count as cached results.

### 12.8 Freshness presentation

Calendar, Grand Prix detail and the result section each read **their own**
record; ETags and freshness are never combined.

- Calendar and result freshness come from `resource_sync_metadata` via
  `evaluateResourceFreshness`, which applies exactly the same rule as
  `evaluateFreshness` — there is one freshness policy, not two.
- Grand Prix detail freshness comes from the persisted snapshot it already
  carries.
- Stale or failed states show a discreet notice **alongside** the cached
  content, never instead of it, and never claim the device is offline merely
  because one request failed. There is no connectivity polling and no
  `/v1/status` call before a feature refresh.
- A `304` writes no domain rows, so no stream re-emits and no visible content
  changes.

## 13. Feature ownership (Phase 7B: Standings)

Standings consumes the same Phase 6 layer with no new synchronization seam. The
two championships are **independent remote resources** throughout:
`standings:drivers:<season>` and `standings:constructors:<season>` have their own
rows, their own ETags, their own freshness and their own refresh status. Nothing
is ever derived from one for the other.

### 13.1 Controller ownership

`StandingsController` (`features/standings/application/standings_providers.dart`)
owns **presentation** refresh status only; content always comes from the
Drift-backed streams.

- Creating it starts **no** refresh, and neither does a rebuild or a selector
  change. Startup and foreground refresh of the current-season core set remain
  the application coordinator's job (ADR 0015).
- It mirrors `appSyncStateProvider` through `resourceRefreshStatus`, matched
  strictly against `DriverStandingsSyncResource` / `ConstructorStandingsSyncResource`
  for the rendered season. An unrelated core resource, another season, or the
  *other* championship never becomes a table's error.
- It is a family over `StandingsScope` — the route's season and championship, or
  `null`/`null` at the season-agnostic branch root.

### 13.2 Season resolution

- `/standings` resolves the season from `currentSeasonProvider` and re-points
  itself when the current season changes. Previous seasons stay on disk, simply
  unwatched, and are never rendered under the new season.
- `/standings/drivers/:season` and `/standings/constructors/:season` render their
  exact validated route season and never substitute the current year.

### 13.3 Manual refresh

- **Current season** (branch root, or an explicit route whose season *is* the
  locally current one): `manualCoreRefreshProvider` → `AppSyncCoordinator.refreshNow()`,
  exactly once per user action. It forces eligibility for one run while keeping
  conditional requests and persisted ETags, refreshes both standings resources,
  and its report is then interpreted **per resource**.
- **Historical explicit route**: one focused
  `StandingsRepository.refresh{Driver,Constructor}Standings(routeSeason)` for the
  selected championship only — conditional, with its own persisted ETag, never
  touching the other championship and never a current-season key. The comparison
  reads the locally stored current season through `currentSeasonResolverProvider`
  (no request).
- The refresh future always completes — success, failure or cancellation. A
  cancelled request clears the transient state instead of surfacing an error.
- Duplicate taps coalesce through the existing in-progress guard and the
  coordinator's own deduplication. There is no lifecycle observer, no timer and
  no `/v1/status` call inside Standings.

### 13.4 Materialization

Both tables use the shared `hasMaterializedCollection` rule
(`features/shared/domain/collection_materialization.dart`) — the same one the
Calendar delegates to, so the two can never drift apart. A table is materialized
by either its **own** successful record or an **accepted bootstrap for that exact
season**, never by a row count.

Bootstrap applies both standings collections in one transaction, so an accepted
same-season bootstrap materializes both. It still contributes **no** individual
metadata: no ETag, no `generatedAt`/`sourceUpdatedAt`/`staleAfter`/`contentVersion`,
no `lastSuccessAt`. Consequently:

- a bootstrap-materialized table has `freshness == null` and shows **no** update
  time (unknown is never presented as fresh and never as stale);
- both resources remain due for their first individual synchronization, whose
  first request sends no fabricated validator;
- a `200` on one endpoint creates only its own metadata, and a later `304` uses
  only its own persisted ETag.

### 13.5 Ordering and value semantics

- `order_index` is authoritative. Rows are never re-sorted by position, points or
  name, and ties are never broken locally. Duplicated, null and non-monotonic
  positions survive exactly as delivered.
- A null position is unranked: it renders as a localized em dash with an explicit
  accessible meaning, never as `0`, and never as the list index.
- Leader emphasis comes only from a **confirmed** `position == 1` — never from a
  maximum points total and never from the first row. Several confirmed leaders
  are all treated (and announced) as tied.
- Points are fractional-capable and formatted through the existing shared
  `ResultFormatter`: the numeric value is preserved, the locale's decimal
  separator is used and meaningless trailing zeros are dropped. Formatted strings
  are presentation only and are never parsed back or persisted.
- Optional statistics stay optional: a confirmed zero is shown, a null is omitted
  rather than turned into a zero.
- `provisional` is a per-row nullable boolean. When every row that states it
  agrees, one section-level notice represents the data; when rows disagree they
  are marked individually and no global claim is made. A null never means
  "final".
- A competitor whose identity has not synchronized yet is a **referential stub**
  in persistence (`GridView_Local_Data.md` §9): the read model reports no name at
  all and the row shows the localized "unavailable" copy. A display name is never
  derived from an identifier, the stable id stays available for identity and
  routing, and a later authoritative upsert resolves the stub in place so the
  local stream re-emits the real name. The same rule covers circuits, so a
  Calendar entry, Home hero or Grand Prix detail carries no circuit rather than a
  name derived from its identifier.

### 13.6 Freshness and failure scoping

Everything is scoped to the **selected** table: its own `lastSuccessAt`, its own
stale notice, its own non-blocking failure. The drivers' timestamp is never shown
while Constructors is selected, and switching the selector switches that context
immediately. Cached rows (and a valid empty representation) always stay visible
through a refresh and through a failure; nothing is deleted because a later
refresh failed.

### 13.7 Presentation-only session state

`standingsUiStateProvider` holds the selected championship and each table's
remembered scroll offset. It performs no synchronization and reads no content.
Selection defaults to Drivers on the first visit of an application session,
survives branch switches and detail round trips, and is deliberately **not**
persisted across launches in Phase 7B. Offsets are remembered per season, so a
season transition starts the new season's tables at the top without corrupting
anything on disk.

### 13.8 Phase 7C hand-off

- Driver and Constructor **detail** already have entry points: from the Standings
  rows (by stable `driverId` / `constructorId`) and from Grand Prix results.
- Detail resources stay **on demand** and must follow the Grand Prix pattern: one
  request per opened route, cancellation on dispose, cached content preserved
  through failures. They are never swept by an automatic run.
- Explore collection screens use the current-season collection pattern
  (`drivers:<season>`, `constructors:<season>`, `circuits:<season>`), which the
  coordinator already plans.
- Detail screens must reuse the stable identities and the season context they are
  opened with; they must not re-resolve identity from a display name.
- Standings controllers must **not** be modified to own detail synchronization.
- Reuse `currentSeasonProvider`, `resourceSyncStateProvider`,
  `resourceRefreshStatus`, `evaluateResourceFreshness` and
  `hasMaterializedCollection`; do not add a second result, error or
  state-management pattern.

## 14. Feature ownership (Phase 7C: Explore, Driver, Team and Circuit)

Phase 7C adds no synchronization seam. It consumes the Phase 6 layer through two
distinct ownership models that must not be conflated:

| Resource family | Keys | Owner |
|---|---|---|
| Explore collections | `drivers:<season>`, `constructors:<season>`, `circuits:<season>` | the application coordinator (core set, ADR 0015) |
| Entity details | `driver:<id>:<season>`, `constructor:<id>:<season>`, `circuit:<id>:<season>` | the opened detail controller, on demand |

### 14.1 Explore collection ownership

The three collections are **independent** current-season core resources. Each has
its own row, its own ETag, its own freshness and its own refresh status; nothing
is ever derived from one for another.

`ExploreController` (`features/explore/application/explore_providers.dart`) owns
**presentation** refresh status only.

- Creating it starts **no** refresh. Neither does selecting a category, nor a
  widget rebuild, nor a Drift emission. Startup and foreground refresh of the
  current-season core set remain the coordinator's job (ADR 0015).
- It mirrors `appSyncStateProvider` through `resourceRefreshStatus`, matched
  strictly against `SeasonDriversSyncResource` / `SeasonConstructorsSyncResource`
  / `SeasonCircuitsSyncResource` for the resolved season. Another season, another
  category or an unrelated core resource never becomes this collection's error.
- Selecting a category is **navigation state**, never remote-data state.

### 14.2 Focused collection retry

`ExploreController.retry(category)` is the only request this feature can produce.
It is user-triggered feature recovery, not a second synchronization policy:

- it issues **one** conditional request for exactly `<category>:<season>`,
  retaining that resource's persisted ETag (`bypassValidator` is never set);
- it touches nothing else — not Calendar, not Home, not Standings, not the other
  two collections;
- the season is read at retry time, so a retry can never target a season the
  screen has moved on from, and never runs without one;
- repeated taps collapse (the running status is claimed before the first await,
  and `RefreshCoordinator` deduplicates per key as defence in depth);
- it returns a typed `RefreshResult`, preserves cached cards throughout, and its
  future always completes — after success, failure **or** cancellation.

There is no general pull-to-refresh on Explore in Phase 7C.

### 14.3 Collection materialization

Materialization uses the shared `hasMaterializedCollection` rule unchanged — the
collection's own `lastSuccessAt`, or an accepted bootstrap whose **own** season
scope equals the resolved season. It is never inferred from a row count.

| Local state | Result |
|---|---|
| own metadata + rows | ready, with individual freshness |
| own metadata + zero rows | **empty**, with individual freshness |
| same-season bootstrap + rows | ready, freshness `null` |
| same-season bootstrap + zero rows | **empty**, freshness `null` |
| older-season bootstrap | does **not** materialize the current season |
| no matching record | loading, or a first-load error |

A bootstrap-only collection therefore renders real content while claiming **no**
update time and **no** staleness: unknown is presented as neither fresh nor
stale. Bootstrap contributes no ETag and no provenance, so each collection stays
due for its own first individual synchronization, and its first request after a
bootstrap sends no fabricated validator (ADR 0014).

Collection **ordering** is documented in `GridView_Local_Data.md` §10.5.1. Only
the circuits order is provider-authoritative (the calendar round); the drivers
and teams orders are deterministic product rules, because their season entries
carry no delivered-order field.

### 14.4 Detail resource ownership

Driver, Team and Circuit details remain **on demand**. `EntityDetailController`
(`features/shared/application/entity_detail_controller.dart`) is the shared base:

1. the local profile stream is subscribed immediately, and any authoritative
   local identity renders **before** any request completes;
2. **at most one** refresh of the exact detail key is triggered per opened page
   with a resolved season;
3. a widget rebuild or a Drift emission never schedules a duplicate — the request
   is claimed once per resolved season;
4. it cancels on dispose (`RemoteCancellation`), and a cancelled request is not a
   user-facing failure;
5. it stays retryable after a failure or a cancellation;
6. `RefreshCoordinator` deduplication is relied on as defence in depth.

Opening a detail never refreshes all Drivers, all Teams, all Circuits, Standings,
Calendar or Home, and detail refresh never routes through the coordinator's
core-resource plan.

### 14.5 Collection / detail metadata isolation

Collection and detail are separate representations with separate validators:

- a collection `200` creates only its own metadata;
- the **first** detail request after a collection or a bootstrap sends **no**
  validator — a collection ETag is never reused for a detail, and vice versa;
- a later detail `304` uses only that detail's persisted ETag;
- collection freshness never becomes detail freshness; one entity's detail
  freshness never becomes another's.

### 14.6 Partial versus materialized details

A local profile and a materialized detail are different claims.

| Local state | Rendering |
|---|---|
| unresolved stub only, or no row | not renderable; one detail request when a season exists |
| real identity / season summary, detail never synced | **partial**: render what exists, structured placeholders elsewhere, **no** detail freshness claimed |
| exact detail resource has `lastSuccessAt` and a valid local representation | **materialized**: full detail, exact detail freshness |

`EntityDetailReady.materialized` carries this distinction, and `freshness` is
always `null` when it is `false`. Collection, bootstrap, Standings, Calendar,
Home and Grand Prix data may supply useful summary content, but never prove that
the detail endpoint was called.

`404` handling depends on what exists locally:

- with a **real** local summary, the summary stays visible and the detail-owned
  sections report unavailable (focused, non-blocking);
- with **no** real local entity, it is a definitive not-found;
- an older or rejected detail response preserves newer local content
  (`RefreshApplication.rejectedOlder`).

### 14.7 Referential stubs and 304 recovery

A referential stub satisfies a foreign key; it is **not** a local domain
representation. The three detail repositories therefore check
`hasResolvedDriver` / `hasResolvedConstructor` / `hasResolvedCircuit` rather than
a raw row count, so a stub cannot suppress the single unconditional recovery
request ADR 0012 requires after a `304`.

For all three families:

- stub-only local state plus a `304` produces exactly **one** unconditional
  retry;
- a successful retry resolves the identity and persists the detail normally;
- a second `304` with still no representation produces one typed
  `invalidResponse` failure, never a loop (exactly two requests in total);
- a transient failure after the retry stays a typed failure and preserves the
  stub's relationship rows;
- a `304` against a **materialized** authoritative detail revalidates once and
  never retries;
- an existing real identity is never downgraded (`ensure*` is insert-or-ignore).

### 14.8 Season context for detail resources

The public detail routes carry only a stable entity id, while the detail
resources are season-scoped. The missing half travels as typed, runtime-only
navigation metadata (`EntityNavigationOrigin.season`) rather than by changing a
route path or inventing a query parameter.

| Origin | Season passed |
|---|---|
| Explore (current season) | the resolved current season |
| current-season Standings | the current season |
| historical Standings route | that route's exact season |
| Driver to Team, Team to Driver | the originating detail's resolved season |
| Grand Prix result to Driver / Team | the classification's own season |
| Grand Prix to Circuit | the Grand Prix season |
| Circuit to Grand Prix | the related event's exact season and round (in the path) |
| direct deep link | none; the current season is resolved locally |

`EntityDetailScope(entityId, originSeason)` keys every provider family, so the
same entity in two seasons is two independent controllers reading two different
metadata keys and validators. If neither an origin nor a local current season is
available, the screen shows a controlled season-unavailable state with a retry
and makes **no** season-scoped request.

### 14.9 Phase 7D hand-off

- Driver, Team and Circuit routes now render complete local features.
- Home may link directly to them through stable identifiers, using
  `context.openEntity(location, season: ...)`.
- Home must **not** take ownership of detail synchronization: the detail
  controllers already own exactly one request per opened page.
- Home should reuse the existing entity read models (`SeasonDriverCard`,
  `SeasonTeamCard`, `SeasonCircuitCard`, `DriverProfile`, `TeamProfile`,
  `CircuitProfile`) and the existing navigation helpers.
- Home must continue reading Drift only.
- Phase 7D must not alter Explore or detail lifecycle ownership.
- Real media downloading was Phase 8 work when this constraint was written;
  Phase 7C shipped placeholders only. **Phase 8B implemented it** — the loader,
  cache and `GvRemoteImage` exist — and the constraint it expressed still holds:
  Home never downloads media itself.

---

## 15. Feature ownership (Phase 7D: Home)

Home is the season-focused dashboard. It reads **only** local domain read models
and owns **no** synchronization of its own.

### 15.1 Composition sources and provenance

Home combines several independent resources. The composition
(`HomeDashboardDao`) reads each module from the resource that already owns it,
so no semantic fact is cached twice and every module keeps its own provenance:

| Module | Content source | Provenance key |
| --- | --- | --- |
| Season heading / context | `seasons` row | — (never shown as a timestamp) |
| Featured Grand Prix, its circuit and sessions | Home snapshot `focusSeason`/`focusRound`, resolved against the calendar rows | `home:<season>` |
| Featured event via the calendar fallback | season calendar | `calendar:<season>` |
| Latest completed Grand Prix | season calendar | `calendar:<season>` |
| Upcoming events | season calendar | `calendar:<season>` |
| Drivers' leader | `driver_standings` + identities + season branding | `standings:drivers:<season>` |
| Teams' leader | `constructor_standings` + identities + branding | `standings:constructors:<season>` |
| Cached race-result enrichment | `race_results` for the latest completed round | `grand-prix-results:<season>:<round>` |

The contract's `HomeData` also carries `latestCompletedEvent`, `driverLeader`,
`constructorLeader` and `upcomingEvents`. **None of them is persisted a second
time under the Home snapshot**: each is reconstructed from the normalized
resource above, which is what keeps Home from ever disagreeing with the Calendar
or the Standings screens. No OpenAPI field required a schema workaround, and no
schema change was made.

### 15.2 Materialization

A Home representation is materialized for a season when the persisted Home
snapshot's `focusSeason` equals that exact season. It does **not** require a
featured event: a season with nothing scheduled is a valid, materialized,
season-empty Home. Materialization is never inferred from featured-event
presence, session count, calendar row count, standings row count or raw
snapshot-row existence without season validation, and it survives a database
close/reopen.

A bootstrap-only Home is materialized and ready, but has **no** individual
`home:<season>` metadata (ADR 0014): Home therefore shows no update time at all
for it, the first individual Home request sends no fabricated `If-None-Match`,
and the resource stays due for a later refresh.

### 15.3 Refresh ownership

`HomeController` starts **no** refresh on creation, on widget build, on a Drift
emission, on a detail round trip, on branch selection or on temporal
recomputation. `AppSyncCoordinator` remains the only owner of startup and
foreground refresh (ADR 0015).

Pull-to-refresh and the app-bar action call the approved manual seam
(`manualCoreRefreshProvider` → `AppSyncCoordinator.refreshNow`) exactly once per
user action. It forces eligibility for one run while keeping conditional
requests and persisted ETags, coalesces repeated taps, and always completes
after success, failure or cancellation. A first-load retry uses the same
boundary — it creates no second startup policy.

Home never refreshes a Grand Prix, a result document or an entity detail. The
optional race-result enrichment renders only what is *already* cached.

### 15.4 Failure scoping

The controller mirrors the coordinator's report per resource:

- only a `home:<season>` failure can become a Home-level error, and only when no
  representation is materialized;
- a `calendar:<season>` failure is scoped to the calendar-derived modules and
  never removes a valid Home snapshot;
- each championship's failure is scoped to its own leader module;
- an unrelated Explore collection failure is ignored entirely;
- a result-resource failure never removes the latest-event card;
- a `304` is successful validation, never a failure.

### 15.5 Module availability and partial data

Availability and cardinality are **independent**. "Can this module answer?" is
decided by materialization; "what did it answer?" is decided by content. Home
keeps them apart in the model (`HomeModuleAvailability`: `resolving`,
`unavailable`, `availableEmpty`, `available`) so an empty answer is never
reported as missing information — and neither is reported before the local read
that decides it has finished.

Materialization reuses the single approved rule shared with the Calendar and
Standings screens (`hasMaterializedCollection`): the collection's **own**
successful record (`calendar:<season>`, `standings:drivers:<season>`,
`standings:constructors:<season>`), or an **accepted bootstrap for that exact
season**. It is never inferred from a row count in either direction — rows
without a record do not make a module available, and a materialized module with
no rows is not unavailable. Bootstrap is consulted for materialization only and
still lends no ETag, provenance or freshness (ADR 0014), so a bootstrap-only
module is available and shows no update time.

**`resolving` is neutral.** Until the persisted record has actually been read,
every module reports `resolving`, because `availableEmpty` and `unavailable` are
both positive findings about stored state: the first asserts that the resource
*is* materialized and evaluated to nothing, the second that it is *not*
materialized. Neither may be claimed from a read still in flight, and neither is
ever inferred from a row count in the meantime. `resolving` therefore claims
**no** missing information, **no** valid empty result and **no** freshness or
update time; it never marks Home partial, and it never triggers a request — it
is a local read, not a synchronization state. Content the module already holds
stays visible throughout, with only the freshness and availability claims
suppressed; an empty module renders a restrained static placeholder rather than
empty-state or unavailable copy, and the page is never replaced by a loader.
One flag covers all of the records deliberately: they come from the same local
store, and resolving one module while another record is still in flight would
risk a claim the database has not confirmed.

Consequently:

- **no upcoming events after the season finale** — or when every later event is
  excluded by the approved upcoming rule, such as a cancelled one — is a
  complete, valid empty result. Home stays `HomeReady`, keeps its post-race
  emphasis, and shows "No upcoming events" with **no** partial-data notice;
- an unmaterialized calendar is genuinely unavailable: the module says so and
  Home is partial while the rest of the dashboard still renders;
- a championship whose table is materialized but names no confirmed leader yet
  says "No leader yet" and is not partial; only an unmaterialized table is
  reported as unavailable;
- a season with no events at all remains `HomeSeasonEmpty` and is never turned
  into a partial `HomeReady`.

**Partial means required information is unavailable, not merely absent by
design.** Only module availability feeds `HomeReady.isPartial`. A single
confirmed leader (rather than a tie), a never-cached race classification, a
season with no completed event yet, an absent optional circuit or location field
and absent media are all normal, complete states and none of them is partial.

The four conditions stay distinct and are never collapsed into one another:

| Condition | Meaning | Notice | Partial? |
|---|---|---|---|
| resolving | the materialization record has not been read yet | none — a restrained placeholder at most | no |
| unavailable | no materialized representation for this season | "Some information is unavailable" | **yes** |
| empty | a materialized resource answered with nothing | the module's own empty line | no |
| available | a materialized resource answered with content | the content itself | no |
| stale | a materialized resource's freshness window passed | aggregate "may be outdated" | no |
| refresh failure | a run failed over content that is still valid | scoped, non-blocking "Update failed" | no |

A stale module stays available; a failed refresh over cached rows never makes a
module unavailable and never discards its valid empty or non-empty result; and
an unresolved read is none of the other five.

### 15.6 Freshness communication

Home publishes **no** single screen-wide "updated" time. An exact timestamp is
shown only for the Home resource itself, and only once that resource has
synchronised under its own key. Anything wider is expressed as safe aggregate
uncertainty ("Some information may be outdated"). Freshness is evaluated with
`evaluateResourceFreshness` and the injected clock; no parallel evaluator
exists. One stale section never makes fresh sections stale.

### 15.7 Season transitions

No season is hardcoded. Home watches `currentSeasonProvider`; when the current
season changes it re-points at the new season's resources, the old season's rows
and metadata stay untouched on disk, an old-season dashboard is never rendered
as the new season, and the new season's materialization is evaluated
independently. Home's remembered scroll offset is season-scoped, so a transition
starts the new season at the top while leaving the branch valid.

### 15.8 Phase 8 hand-off

- Every primary screen (Home, Calendar, Grand Prix, Standings, Explore and the
  three detail profiles) now renders from local data under a single
  synchronization policy. Phase 8 adds cross-cutting capabilities on top; it
  does **not** need to change refresh ownership again.
- **Media is implemented** (Phase 8B, merged). The remote image component
  (`GvRemoteImage`), the variant selector, the strict HTTPS URL policy, the
  shared bounded disk cache and the image loader all exist, and they read the
  `media` rows whose single-owner integrity this layer already guaranteed.
  Images nevertheless render as **placeholders** in practice, because no media
  rights are approved and no R2 bucket is provisioned, so nothing has been
  published. That is the specified fallback behaviour of the implemented
  architecture, not an absence of it — and it changes nothing here: **domain
  data availability is not media availability**, so a missing image never makes
  a screen partial and image bytes never enter Drift.
- Localization is complete for the shipped screens: both ARBs carry the same
  keys and no user-facing string is hardcoded. Fallback-language resolution
  shipped in Phase 8A, and text expansion is covered by the Phase 8C-3
  200%-text matrix over every screen family in both locales — in
  `flutter_test` only; OS-level display scaling on a device remains unverified.
- **Settings and Firebase observability are implemented** (Phase 8A and Phase
  8C-1, both merged; 8C-2 verified the observability signals externally). They
  own **no** synchronization: Settings persists three preferences through
  `shared_preferences` and never touches Drift or the network, and the
  observability boundary only *observes* synchronization — `gv_sync_run`
  attributes are derived from a run the coordinator already owns. The rule is
  unchanged and still binding: anything that needs to refresh goes through
  `AppSyncCoordinator` (ADR 0015) rather than introducing a second policy.
