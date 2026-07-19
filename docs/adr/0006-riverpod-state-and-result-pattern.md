# ADR 0006: Riverpod state management and the result/state pattern

- Status: Accepted
- Date: 2026-07-19

## Context

`GridView_TRD.md` §20.2 requires the project to choose **one** consistent result
strategy and record it in an ADR. §9 mandates Riverpod for state management and
enumerates the async states a screen must represent (initial loading, data,
background refresh, empty, recoverable error, stale). §9 also forbids a single
ambiguous boolean loading state.

## Decision

### State management: Riverpod 3.x, manual providers

- **Manual providers only** (no `riverpod_generator`), to avoid an extra
  code-generation surface in CI. Drift, Freezed and `json_serializable`
  generation is already present.
- Dependency graph is wired through `Provider`s (`databaseProvider`,
  `remoteApiProvider`, `raceWeekendRepositoryProvider`, `clockProvider`,
  `appEnvironmentProvider`), overridable in tests via `ProviderScope`.
- Drift-backed reads are exposed as `StreamProvider`s; Home is keep-alive (its
  data persists across normal branch navigation), Grand Prix detail uses an
  `autoDispose.family` keyed by `(season, round)` so controllers never
  accumulate while the cached data survives in Drift.
- Refresh orchestration lives in `Notifier` controllers (`HomeController`,
  `GrandPrixController`) that trigger one refresh on creation and de-duplicate
  overlapping refreshes. No `BuildContext` is ever placed in a provider.

### Result pattern (data → application boundary)

Repositories translate remote/local errors into a **sealed `RefreshResult`**
(`RefreshSuccess { applied }` / `RefreshFailure { failure }`). The remote data
source throws exactly one typed exception (`GridViewApiException` carrying an
`ApiFailure`), caught at the repository boundary. Raw Dio/SQLite errors and
server text never reach the application or UI.

### Presentation state: explicit sealed states

Each screen exposes a **sealed presentation state** derived by a pure function
from the cache stream + refresh status + clock:

- Home: `HomeLoading`, `HomeFirstLoadError`, `HomeReady { view, freshness,
  refreshing, refreshError }`.
- Grand Prix detail: `GrandPrixLoading`, `GrandPrixNotFound`,
  `GrandPrixFirstLoadError`, `GrandPrixReady { view, freshness, refreshing,
  refreshError }`.

`HomeReady` / `GrandPrixReady` carry explicit `freshness`, `refreshing` and
`refreshError` fields, so the six required situations (initial loading, fresh,
stale, refreshing-with-content, refresh-error-with-content, first-load-error)
are all unambiguously representable. The derivation functions
(`computeHomeState`, `computeGrandPrixState`) are pure and unit-tested without a
widget tree.

## Consequences

- One consistent error path: DTO → typed `ApiFailure` → `RefreshResult` →
  localized message; no ambiguous boolean loading state.
- Widget tests drive screens through the fake repository (`FakeRaceWeekendRepository`)
  with plain streams; the real Drift pipeline is exercised end to end by the DAO,
  repository and `ProviderContainer` controller tests. This separation avoids
  Drift's stream-query timers, which are incompatible with `pumpAndSettle` under
  the widget-test `FakeAsync` zone.
