# GridView — Synchronization & Offline Behaviour

- Status: Phase 4 (first offline-first vertical slice)
- Related: `GridView_TRD.md` §16, `GridView_Local_Data.md`,
  `docs/adr/0005-snapshot-conflict-and-freshness.md`,
  `docs/adr/0006-riverpod-state-and-result-pattern.md`

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

Rule (`_decideOutcome`):

1. incoming `sourceUpdatedAt` **older** than stored → **reject** (newer cache and
   its whole transaction state preserved) → `RefreshSuccess(applied: false)`.
2. incoming `sourceUpdatedAt` **newer** → **apply** atomically.
3. equal `sourceUpdatedAt` **+** equal `contentVersion` → **skip** (idempotent
   no-op; no rows rewritten, no stream re-emit) → `RefreshSuccess(applied: false)`.
4. equal `sourceUpdatedAt` **+** differing `contentVersion` → `generatedAt`
   tie-breaker: strictly **later** applies; **equal/earlier** is rejected.

Fallback: when `sourceUpdatedAt` is unavailable on either side, ordering falls
back to `generatedAt`. A rejected or skipped snapshot performs **no write** (no
false stream update). See ADR 0005.

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

The remote data source throws exactly one typed exception
(`GridViewApiException` carrying `ApiFailure`), covering: network unavailable,
timeout, rate-limited, server unavailable, invalid response, unsupported
API/schema version, not found, invalid request. The repository catches it and
returns a typed `RefreshFailure`; the UI derives a **localized** message. Raw
Dio/SQLite errors, server text and stack traces never reach the UI. Development
logging is safe (method, path, status, request id — never bodies or keys).

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
