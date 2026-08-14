# Testing documentation

Test strategy and coverage policy: `../technical/GridView_TRD.md` (section 32).

## Contract fixtures

The single source of truth for contract fixtures is
`services/edge-api/test/fixtures/api/v1/`, with a `manifest.json` index. The same
fixtures are validated by the Worker (ajv, against the OpenAPI schemas) and by
the Flutter client (DTO parsing + DTO→domain mapping), so both sides agree on one
set of examples.

### Naming

- Group by resource: `status/`, `bootstrap/`, `home/`, `calendar/`,
  `grand-prix/`, `results/`, `standings/`, `drivers/`, `constructors/`,
  `circuits/`, `content/`, `errors/`, and `entities/` (raw entity arrays with no
  envelope).
- Name the file after the scenario: `standard-weekend.json`, `sprint-weekend.json`,
  `unknown-enum-status.json`, `detail-missing-optional.json`, `stale.json`.
- Response fixtures are the real `{ data, meta }` body. Error fixtures are the
  `{ error }` body. Entity fixtures are a bare array of one entity type.

### Manifest

Each entry declares:

| field | meaning |
|---|---|
| `file` | path under `api/v1/` |
| `type` | `envelope`, `error` or `entity` |
| `data` | OpenAPI component schema name for the payload |
| `dataKind` | `single` or `array` |
| `meta` | `BaseMeta`, `SnapshotMeta` or `SeasonSnapshotMeta` (envelope only) |
| `expectValid` | `false` for deliberately out-of-contract fixtures (e.g. unknown enum) |

### Strict conformance vs tolerance fixtures

Fixtures fall into two categories, and the validator reports the split
(`N conform to OpenAPI, M tolerance-only`):

- **Conforming** (`expectValid` unset/true): a GridView-produced public response
  must satisfy the strict OpenAPI schema. Public enums may emit only documented
  wire values (including the documented `unknown`).
- **Tolerance-only** (`expectValid: false`): simulates a *future undocumented*
  wire token from an upstream provider. Such a fixture **must fail** strict
  OpenAPI validation and exists only to prove the clients tolerate it. The
  validator asserts it fails; if it ever validates (e.g. because someone widened
  the enum), the check fails.

The one tolerance-only fixture today is
`grand-prix/unknown-enum-status.json`, which carries `status: "red_flagged"` and
a session `type: "super_sprint"` (neither documented). The Worker
(`src/contract/parse.ts`) and the Flutter mapper both map such tokens to the
`unknown` enum value. Never widen a public OpenAPI enum to make a future token
validate.

### Mock-data status

All fixtures and curated content are **non-authoritative mock data**: deterministic
timestamps, GridView public IDs only, no provider IDs, no secrets, and clearly
labelled `(mock)` values. They must not be presented as authoritative results.

### Adding a fixture safely

1. Add the JSON file under the right resource folder.
2. Add a `manifest.json` entry (the fixture validator fails on any unlisted
   fixture, and the Flutter parser test fails if no DTO parser is registered for
   its `data` schema).
3. If it introduces a new data shape, add or extend the OpenAPI schema first.
4. Run `npm run validate` (from `services/edge-api`) and `flutter test`.
5. Never include a provider ID; the fixture validator scans for and rejects them.

## Validation and code generation

```bash
# Worker + contract data
cd services/edge-api
npm run validate        # OpenAPI lint + content schemas + fixtures
npm test                # route + contract tests

# Flutter
flutter pub get
dart run build_runner build   # regenerate DTO code (freezed/json_serializable)
flutter analyze
flutter test
```

CI runs all of the above, plus a generated-code-consistency check
(`dart run build_runner build` then `git diff --exit-code`).

## Design-system tests (Phase 3A)

Under `test/design_system/` (harness: `test/support/component_harness.dart`):

- `component_behavior_test.dart` — buttons, segmented control, bottom nav and
  error-retry callbacks; disabled and loading states.
- `semantics_test.dart` — semantic labels and selected/button flags on the
  important controls.
- `resilience_test.dart` — no overflow with long English/Spanish strings on a
  320px phone, and rendering at 1.6-2.0x text scale.
- `touch_target_test.dart` — every interactive shared component exposes a hit
  area of at least 48 logical pixels (`GvLayout.minTouchTarget`).
- `golden_test.dart` — a small representative set (status chips, primary button,
  data card, standings row) in the dark theme, with committed goldens under
  `test/design_system/goldens/`.

### Golden tolerance

`test/flutter_test_config.dart` installs a tolerant golden comparator with a **2%**
differing-pixel threshold. It exists **only** to absorb cross-platform font
antialiasing/rasterization drift between a developer machine and the Linux CI
runner. It must **not** be used to hide layout, spacing, colour or component
regressions — those change a large fraction of pixels and are expected to fail.
Do not regenerate goldens per platform; regenerate only when appearance changes
intentionally.

### Linux is the canonical golden environment

**Golden baselines are authored on Linux**, because CI is the authoritative gate:
a baseline that matches the runner exactly leaves the only rendering drift on
developer machines, where the tolerant comparator absorbs it. Windows and macOS
are supported *execution* environments — `flutter test` is expected to pass there
— but they are not authoring environments.

Author a baseline with the **Render canonical goldens** workflow
(`.github/workflows/render-canonical-goldens.yml`, manual dispatch): render the
commit, download the `canonical-goldens` artifact, inspect what changed, copy only
the approved images into the branch, commit. No developer needs Linux, WSL or
Docker installed.

### Two complementary golden gates

Tolerance is an **execution allowance**. It is not evidence that a baseline is
current. Those are separate concerns and are now checked separately:

| Gate | Where | Allowance | Catches |
|---|---|---|---|
| `flutter test` | any platform | 2% | meaningful visual regressions beyond tolerance |
| **Canonical golden freshness** | Linux CI only | **zero** | a baseline that no longer matches what the code renders |

The freshness job regenerates every golden on Linux and requires
`git diff --exit-code` over the three golden directories to be clean. It also
self-tests: it modifies a golden, asserts the gate reports it, and restores the
tree — so a wrong path can never make the check pass vacuously.

**Neither gate may be removed or weakened.**

#### Why this was introduced

Phase 8A commit `07efdd5` changed a visible line break. The affected baselines
drifted ~1.7% from what the code rendered — real visual drift, but under 2%, so
every local run stayed green and the staleness survived five commits. Ordinary
Windows/Linux rendering variance (~0.5%) then pushed five of those stale baselines
past the tolerance in CI.

**2% is not an error and was not reduced.** The defect was using one number for
two jobs: a cross-platform execution allowance *and* an implicit "the baselines
are current" check.

#### Why a magnitude-aware comparator was rejected

A per-channel tolerance was considered and **measured to be unsafe**. Rendering
the whole corpus on both platforms from the same commit showed genuine
Windows/Linux noise reaching **1.64%** of pixels with per-channel deltas up to
**234** — the test font draws solid boxes, so a sub-pixel edge shift flips a pixel
between background and foreground rather than producing a soft gradient. The
semantic regression the gate must still catch, the primary-button correction
`#FF3B30 → #DC2626`, has a per-channel delta of only **35**. No magnitude
threshold can accept the platform noise while rejecting the colour change, so
per-channel tolerance, platform-specific expected images and per-platform skips
are all ruled out.

## Navigation & screen skeletons (Phase 3B)

Router and screens are covered end-to-end through the real `GoRouter` via
`test/support/router_harness.dart` (`pumpApp`, `tapNav`, `shellLocation`,
`pageStack`).

- `test/app/app_boot_test.dart` — the app boots into Home with the pill
  navigation; Spanish labels load; only en/es are supported.
- `test/navigation/router_test.dart` — switching among all four branches;
  opening Settings + system back; unknown route → recoverable not-found; invalid
  `season`/`round`/id → controlled invalid-route state; direct (deep-link)
  opening of every detail route; **production exclusion of the component
  catalogue**; **no duplicate entity-route loop** (driver → team → same driver
  collapses instead of stacking).
- `test/navigation/state_preservation_test.dart` — branch **stack** preservation
  across tab switches; re-select-to-root; branch **scroll** preservation; a
  detail pushed from a branch returns to that branch on system back; app-bar back
  pops a detail.
- `test/screens/screen_skeletons_test.dart` — every one of the 13 skeletons
  renders without errors; a valid-but-unknown entity id shows a generic
  placeholder (id shown as a technical identifier, never as the name).
- `test/resilience/navigation_resilience_test.dart` — no overflow at 2.0x text
  scale and at 320px width; Spanish content on a narrow phone; a bottom safe-area
  inset; reduced-motion rendering.
- `test/screens/screen_golden_test.dart` — four full-screen goldens (primary
  shell pill navigation, Home loaded, Standings, Grand Prix detail loaded) at the
  2% tolerance, committed under `test/screens/goldens/`. Regenerate through the
  **Render canonical goldens** workflow — baselines are authored on Linux, not
  locally (see "Linux is the canonical golden environment" above).

## Offline-first vertical slice (Phase 4)

The Home → Grand Prix detail slice is tested at every layer. The **real Drift
pipeline** is exercised by the DAO, repository and `ProviderContainer` controller
tests (which run with real async). **Widget tests** drive the screens through a
fake repository (`test/support/fake_repository.dart`) with plain streams — the
real Drift pipeline schedules stream-query timers that are incompatible with
`pumpAndSettle` under the widget-test `FakeAsync` zone, so mixing them there is
deliberately avoided.

- `test/database/vertical_slice_dao_test.dart` — schema creation, foreign keys,
  cascade delete, upsert/idempotent sync, atomic-transaction rollback, session
  replacement without duplicates, snapshot version-conflict rule, UTC round-trip,
  unknown-enum preservation, and DAO stream emissions (in-memory SQLite).
- `test/database/schema_migration_test.dart` — schema version 1, grand_prix and
  sessions columns, and the `(season, round)` uniqueness constraint.
- `test/database/persistence_test.dart` — cached Grand Prix data survives closing
  and reopening a temporary on-disk database.
- `test/data/remote/*` — the Dio client with an injected fake HTTP transport
  (success + every typed failure), the dev fixture source, and dev-fixture
  contract validity (apiVersion 1, no provider ids).
- Home/Grand Prix repository behaviour is covered by the generalized Phase 6B1
  repository tests (see the Phase 6B1 section below); the Phase 4
  `RaceWeekendRepository` was split into `HomeRepository` + `GrandPrixRepository`.
- `test/application/*` — the pure state machines (every Home and detail state),
  the freshness evaluator, and the real controllers via `ProviderContainer`
  (loading → data, stale, first-load failure, refresh-failure-keeps-cache,
  not-found, offline-from-cache).
- `test/time/session_time_test.dart` — event-local conversion incl. DST (CEST vs
  CET), device fallback, and calendar dates that never shift.
- `test/screens/vertical_slice_widget_test.dart` — Home loading skeleton, cached
  content, background refresh, stale/offline notice, first-load error + retry,
  mock-data banner, Spanish, Home → Grand Prix detail navigation, deep-link with
  ordered sessions, session ordering, controlled not-found, and offline-from-cache.

No test requires a real Worker, network, Firebase or Android device. Drift tests
use `NativeDatabase.memory()` (and a temporary on-disk file for the persistence
test).

## Observability (`test/observability/`)

57 tests covering the Phase 8C-1 boundary. None constructs a Firebase type: the
default `observabilityProvider` is the inert surface, and `pumpApp` takes an
`observability:` parameter that defaults to `Observability.disabled()`, so a
test transmits nothing unless it deliberately asks for a recording fake from
`test/support/fake_observability.dart`.

- `observability_isolation_test.dart` — the eligibility truth table (production
  only; dev, staging and a malformed `APP_ENV` all fail closed), plus structural
  assertions: exactly one `lib/` file imports `package:firebase_`;
  `google-services.json` exists only under `android/app/src/production/`; the
  native collection-policy meta-data is declared `false`; the flavor/`APP_ENV`
  gate exists; and the Gradle dependency gate encodes the reviewed Android
  facts. The `pubspec.lock` check is **scoped to direct Dart packages only** —
  it cannot see native artifacts, which is why Remote Config and ABT (transitive
  components of Performance Monitoring) are asserted in Gradle instead.
- `report_exactly_once_test.dart` — the whole reporting pipeline with both hooks
  live. Each typed validation exception produces exactly **one**
  `invalidRemoteContract` at the refresh boundary; a genuine storage fault
  produces exactly one `localDatabaseFailure` at the persistence boundary; a
  success produces none. This is the test that catches double-reporting.
- `sync_run_trace_test.dart` — `gv_sync_run` against the real coordinator:
  one trace per run, outcome recorded, and peak concurrency of 1 even when
  startup, foreground and a queued manual refresh all overlap.
- `global_error_handlers_test.dart` — fatal routing. Framework errors and
  uncaught async errors each report **exactly once**; the previous handler still
  runs so debug output survives; a throwing reporter cannot escape. Restoration
  is ownership-aware: a later Flutter or platform handler owner is never
  overwritten, repeated restoration is safe, and one half can be restored while
  the other is left alone.
- `observability_policy_test.dart` — the non-fatal allowlist and its exclusions,
  redaction (a resource key never reaches a report), bounded attributes, and
  flood suppression (200 identical failures produce one report; fatals are never
  throttled).
- `sync_observation_test.dart` — the two hooks. Successes and operational
  failures report nothing; the five reportable categories report correctly; a
  throwing observer or reporter cannot change a refresh outcome or leak a slot;
  collapsed duplicate refreshes are observed once.
- `tracing_test.dart` — traces stop in `finally` on success, failure and
  cancellation; a tracer that fails to start still runs the action; a broken
  tracer cannot change a result or swallow an error.
- `observability_startup_test.dart` — drives the real `installObservability`
  with the activation seam injected: a non-eligible build never activates; an
  eligible one reports `pending` first; success, a null result and a throwing
  activator all resolve safely; the app renders while activation is still
  pending. Also covers the startup buffer — in-order replay exactly once,
  overflow dropping the newest, `disable()` discarding without throwing, and a
  replay failure that cannot become a new uncaught error.
- `privacy_status_test.dart` — Settings → Privacy across all four states
  (disabled, starting, enabled, unavailable), the live correction when
  activation resolves, and the packaged-components disclosure.

Run them alone with:

```text
flutter test test/observability
```

## Canonical goldens pending regeneration

The Phase 8C-1 Privacy-screen copy change (live status plus the diagnostics
disclosure) legitimately changes three baselines:

- `test/settings/goldens/settings_privacy_unconfigured.png`
- `test/settings/goldens/settings_privacy_configured.png`
- `test/settings/goldens/settings_privacy_production.png`

They have **not** been regenerated. Canonical baselines are Linux-owned: run the
manual "Render canonical goldens" workflow, inspect the artifact, and commit
only approved images. Do not author them on Windows.

## Edge API foundation (Phase 5A)

The Worker backend foundation is tested locally with injected adapters only. No
test requires a Cloudflare account, real KV namespace, provider key or live
Formula 1 data source.

From `services/edge-api`:

```bash
npm run typecheck
npm run lint
npm run format
npm test
npm run validate
```

Coverage includes:

- Every public OpenAPI route for GET and HEAD.
- Invalid season, round and stable-ID parameters.
- Unknown routes, unsupported methods and safe error envelopes.
- Request ID header/body correlation.
- Weak ETag stability, `If-None-Match` and `304`.
- Cache policy differences and no-store error responses.
- Versioned publication, active-pointer-last writes, previous pointer, rollback,
  validation failure and write failure.
- Mock provider failure, rate limiting, quota skip behavior and due-job
  calculation.
- Protected internal admin routes and log/response secret redaction.
- Fake Workers KV adapter behavior without provisioning KV.
- Generated snapshot provenance, provider-ID isolation, null preservation and
  fractional points.

The existing fixture validator still reports strict OpenAPI conformance:
30 conforming fixtures and 1 tolerance-only fixture that must fail strict
validation.

## Staging verification (Phase 5B)

The staging Worker (`gridview-api-staging`) is verified with automated helpers
and a manual Flutter pass. The deploy/seed/verify procedure is in
`../operations/GridView_Staging_Edge_Runbook.md`.

### Automated Worker tests

The cron `scheduled` handler is covered locally (no remote trigger, no cron
change) — this is the safe verification mechanism:

- `test/sync/scheduled-handler.test.ts` — drives the real `scheduled()` export
  through the in-memory harness: same sync-and-publish orchestration as the manual
  admin sync, reads KV state, skips when no job is due, a failed required job
  preserves the active release, sync/quota metadata is updated, and no admin token
  or authorization material appears in the captured logs.
- `test/sync/synchronization.test.ts` — due-job calculation, quota skip/retry
  behavior and provider-failure preservation.
- `test/scripts/staging-observability-command.test.mjs` — the observability
  helper's tail-launch construction and the redaction scanner: it rejects a real
  admin token, a `Bearer <value>` and a non-redacted `authorization` field value,
  while accepting `unauthorized`, `authorization_failed`, an HTTP `401` and a
  redacted `authorization` field, and never echoes a secret in failure output.

### Live staging scripts (`services/edge-api`)

Read-only public checks need no token; authenticated checks read
`GRIDVIEW_STAGING_ADMIN_TOKEN` from the environment (never a CLI argument):

```bash
npm run smoke:staging               -- https://gridview-api-staging.sejuma18.workers.dev
npm run check:staging-admin         -- https://gridview-api-staging.sejuma18.workers.dev
npm run workflow:staging-auth       -- https://gridview-api-staging.sejuma18.workers.dev
npm run check:staging-observability -- https://gridview-api-staging.sejuma18.workers.dev
```

The observability helper launches `wrangler tail` via the real
`wrangler-dist/cli.js` entry point (the `.cmd` wrapper is not used — see the
runbook §12), confirms every expected structured operation, and asserts the logs
carry no credential material.

### Manual Flutter staging + offline pass

Run the staging flavor against the deployed **public** API (the app never uses
the admin token):

```powershell
fvm flutter run --flavor staging `
  --dart-define=APP_ENV=staging `
  --dart-define=DATA_SOURCE=remote `
  --dart-define=API_BASE_URL=https://gridview-api-staging.sejuma18.workers.dev
```

Clear only the staging install between runs:

```powershell
adb uninstall com.sejuma.gridview.staging
```

Offline/restart checklist:

1. First launch with an empty local database — Home shows a loading state, then
   remote data.
2. Open a Grand Prix detail; confirm session ordering and event-local timezone
   labels.
3. Close and reopen the app — content renders immediately from the Drift cache.
4. Enable airplane mode — Home and detail still render from Drift, with a
   stale/offline notice; a failed refresh preserves cached content.
5. Confirm `FixtureGridViewApi` is **not** in use: with `DATA_SOURCE=remote` the
   client "Sample data" banner is absent (it appears only under a deliberate
   `DATA_SOURCE=fixture`); staging identity is the
   `com.sejuma.gridview.staging` / `-staging` flavor.

## Conditional remote client & complete repositories (Phase 6B1)

The generalized remote-to-local layer is tested at every level, all without a
real Worker, network, admin token or device (in-memory SQLite, plus temporary
on-disk files for the persistence tests):

- `test/data/remote/dio_gridview_api_test.dart` — path/query construction for
  every v1 endpoint, `If-None-Match` sent only when an ETag exists, `200`/`304`/
  empty-`304`, request-id preservation, all typed failures (offline, timeout,
  404, 429, 503, invalid JSON, invalid envelope, unsupported version, missing
  `sourceUpdatedAt`), pre- and in-flight cancellation, and **no** Authorization/
  admin header.
- `test/data/remote/fixture_gridview_api_test.dart` — the dev fixture source with
  conditional-request (content ETag → `RemoteNotModified`) behaviour and 404 for
  an absent fixture.
- `test/data/sync/snapshot_conflict_rule_test.dart` — the centralized
  `SnapshotConflict.decide` (source-primary; generatedAt tie-break only;
  contentVersion equality).
- `test/data/sync/resource_sync_test.dart` — metadata semantics and transaction
  boundaries: a modified apply commits full success metadata; a metadata failure
  rolls back the domain write; `304` preserves provenance and bumps success; a
  failure preserves the ETag; an older snapshot records a safe conflict category.
- `test/data/sync/refresh_coordinator_test.dart` — same-key dedup, different-key
  independence, slot release on failure and on a thrown action.
- `test/data/repositories/conditional_refresh_test.dart` — the full pipeline
  through the calendar repository: empty-cache 200, ETag persistence + reuse,
  `304`, newer/older/equal snapshots, network/invalid failures preserving the
  cache, the `304`-with-absent-local one-shot unconditional retry, other-seasons
  untouched, stream-only-after-commit, no false emission on `304`, and
  cross-resource independence (driver vs constructor standings).
- `test/data/repositories/repository_domain_test.dart` — sprint weekend, sprint+
  race coexistence, fractional/tied standings, DNF/DNS/DSQ nulls, missing
  bio/media, constructor rebranding across seasons, and nullable circuit values.
- `test/data/repositories/repository_concurrency_test.dart` — two simultaneous
  same-key refreshes make one request; different keys run independently; failure
  and cancellation release the key and a retry re-requests.
- `test/data/repositories/persistence_reopen_test.dart` — synchronized data,
  ETags and freshness survive a close/reopen; the reopened cache renders offline;
  a `304` after reopen sends `If-None-Match` with the persisted ETag.
- `test/application/production_isolation_test.dart` — the complete remote-source
  selection truth table: `DATA_SOURCE` parsing (only `fixture` selects fixtures;
  missing/malformed resolve to remote); dev/staging select fixtures only under a
  deliberate `DATA_SOURCE=fixture` (never inferred from a missing base URL);
  remote mode with no base URL is a controlled `configuration` failure, not
  fixtures; production never constructs the fixture API (an attempted fixture
  mode or a missing base URL is a controlled `configuration` failure); no admin
  credential; no provider identifier in any consumed fixture.

Optional manual staging smoke (non-CI): `tool/staging_smoke.dart` self-skips
without a base URL. Run it against a public deployment with:

```powershell
flutter test tool/staging_smoke.dart `
  --dart-define=API_BASE_URL=https://gridview-api-staging.sejuma18.workers.dev
```

It uses only public GET routes and a throwaway on-disk database, synchronizes a
few resources, closes/reopens the database, and confirms local counts and an
ETag fingerprint survived — printing no response bodies and using no admin token.

## Bootstrap & application synchronization orchestration (Phase 6B2)

The application-level policy is tested end to end without a Worker, network,
admin token or device (in-memory SQLite, plus temporary on-disk files for the
persistence suites):

- `test/data/repositories/bootstrap_repository_test.dart` — bootstrap as one
  conditional resource: an empty database plus a `200` materializes every
  contract-defined family; success metadata and the ETag persist under
  `bootstrap` only, and **no** individual resource key acquires metadata or a
  fabricated ETag; equal is idempotent, older is rejected, a missing
  `sourceUpdatedAt` is invalid — all preserving the cache; one invalid family
  rolls back every other bootstrap change (domain rows *and* success metadata);
  a transport failure keeps the cache and the validator; a valid `304` makes one
  request and rewrites no domain rows; a `304` with no recorded bootstrap
  representation retries once unconditionally; a valid *empty* bootstrap stays
  materialized and needs no retry; compact merges never erase a driver
  biography, a constructor's nationality/country/media, a circuit's physical
  facts and lap record, detail-synced sessions or the official name, or stored
  race results; unrelated seasons are untouched; stable identities are not
  duplicated; a contract-permitted Home with no featured event still
  materializes.
- `test/sync/first_screen_cache_test.dart` — the usable-cache predicate as
  materialization, not featured-event presence: a current season whose Home has
  no events is usable; no materialized Home is not; a Home belonging to another
  season is not; an empty season yields a defined local empty read model
  (`HomeView.featured == null`, `seasonYear` set); and on a temporary on-disk
  database a valid empty Home survives close/reopen so the returning launch does
  **not** bootstrap again.
- `test/sync/sync_resource_parser_test.dart` — every canonical key round-trips to
  its typed resource; unknown prefixes, wrong segment counts, non-numeric or
  out-of-range seasons/rounds, malformed stable ids and additive future keys all
  resolve to an unsupported resource (never an exception, never a deletion); the
  automatic-core versus on-demand inventory is asserted key by key.
- `test/sync/sync_planner_test.dart` — the due rule (null `lastSuccessAt`,
  `serverStale`, `staleAfter == now`, `staleAfter > now`, no fallback TTL, a
  missing metadata row); no usable cache plans bootstrap and nothing beside it; a
  usable cache never forces bootstrap; a failed bootstrap recovers with season
  context + first screen only; a manual run ignores due eligibility; deterministic
  stage and resource order; details, historical and unrelated seasons excluded;
  the content manifest plannable without season context; no hardcoded season.
- `test/sync/app_sync_coordinator_test.dart` — startup runs once and the initial
  `resumed` never duplicates it; an empty cache requests bootstrap **only**;
  after a failed bootstrap Home is season-scoped throughout — no local season
  plus a failed current-season lookup makes **zero** Home requests and finishes
  as `AppSyncSeasonContextUnavailable`, a local season makes Home use that exact
  canonical year, a remotely resolved season makes Home use the returned year,
  and no unscoped or `home:current` metadata row can ever exist; automatic runs
  refresh only due resources and never sweep details; a malformed stored key
  cannot crash a run and its row is left alone; stages keep dependency order;
  independent resources overlap but never exceed the injected limit (4, and a
  stricter 2); one failure never blocks independent resources; a rate-limited
  resource is not retried inside the run; manual refreshes non-due core
  resources while still sending the persisted ETags; two foreground triggers
  coalesce into one run; repeated manual taps queue exactly one forced follow-up;
  cancellation stops scheduling, is never reported as success, releases the
  repository in-flight slots and leaves a later run able to retry; no raw
  exception, DTO or transport object reaches the state.
- `test/sync/season_transition_test.dart` — a new current season is adopted while
  every previous-season row and metadata entry survives; the new season's core
  resources have no metadata and are treated as never synchronized; a new season
  with no usable Home cache prefers bootstrap over a fan-out; no year is
  hardcoded.
- `test/sync/sync_providers_test.dart` — every dependency is override-friendly;
  one database instance backs the whole graph; the aggregate state provider
  needs no database of its own; the coordinator publishes into it; disposing the
  scope cancels the run in flight; the manual entry point needs no
  `BuildContext`; the startup run happens after the first frame; rebuilds never
  trigger synchronization; only a genuine background → resumed transition does
  (a transient `inactive` does not); no `BuildContext` is retained.
- `test/app/startup_non_blocking_test.dart` — the navigation shell is built while
  a never-completing bootstrap is in flight; an empty first launch shows the
  structured shell rather than a blocking splash; cached Home renders before a
  delayed response completes; startup does not request every v1 endpoint at once;
  the run starts only after the shell is on screen.
- `test/sync/sync_persistence_test.dart` (temporary on-disk database) — a
  first-use bootstrap survives close/reopen with its ETag and freshness; a
  returning launch renders cached Home with zero network calls; a foreground pass
  after reopen sends the persisted validators; a failed refresh preserves cached
  content and reports a typed partial result; a valid empty collection stays
  valid across a reopen; and no synchronized core screen needs live network after
  a successful bootstrap.
- `test/application/home_controller_test.dart` — Home does **not** launch its own
  refresh on creation (startup ownership moved to the coordinator), while its
  loading/ready/stale/first-load-error/retry behaviour is unchanged.

Optional manual staging orchestration smoke (non-CI): `tool/staging_smoke.dart`
also contains a first-use bootstrap → reopen → returning-revalidation pass. It
self-skips without a base URL and requires an explicit remote data source:

```powershell
flutter test tool/staging_smoke.dart `
  --dart-define=DATA_SOURCE=remote `
  --dart-define=API_BASE_URL=https://gridview-api-staging.sejuma18.workers.dev
```

It uses only public GET routes, a throwaway on-disk database and no admin token,
and prints only counts, safe failure categories and redacted ETag fingerprints.
CI never depends on staging availability.

## Calendar & Grand Prix features (Phase 7A)

The two feature screens are covered end to end without a Worker, network, admin
token or device (pure functions, `ProviderContainer` over in-memory SQLite,
widget tests over fake repositories, and temporary on-disk files for the
persistence suite):

- `test/domain/relevant_event_test.dart` — the one relevant-event rule shared by
  Home, the Calendar and `CalendarDao.nextEvent`: an in-progress event wins over
  a later upcoming one (both by explicit status and by date window); the next
  eligible event is chosen otherwise; cancelled events are never selected as
  current **or** upcoming; completed events are never upcoming and a completed
  season has none; a postponed event that still carries a future date stays
  eligible; missing and malformed dates are skipped rather than thrown on; round
  breaks a same-date tie; the injected clock alone decides the boundary (start
  day, last day, the day after, well before); and Home's featured event and the
  Calendar's highlighted event resolve to the same identity from the same input.
- `test/application/calendar_state_test.dart` — the pure state derivation: no
  season, an unemitted stream, and metadata that has never succeeded are all
  loading and never "empty"; an unresolvable season becomes a controlled
  recoverable error only once a run has settled; no representation plus a failure
  is a first-load error; a materialized empty calendar is `CalendarEmpty` with
  its own non-blocking failure slot; cached events survive a refresh and a
  refresh failure; the persisted round order is preserved exactly; the
  `staleAfter` boundary and the server stale flag; a season transition carries
  the new season through the state. The materialization predicate is covered
  directly: a direct calendar success materializes; an accepted bootstrap for the
  same season materializes; one for another season, with no recorded season, or
  that never succeeded does not; bootstrap materialization claims no freshness of
  its own; the calendar's own record stays the preferred freshness source; and a
  failed later refresh keeps the bootstrap-derived state with only a non-blocking
  error.
- `test/application/calendar_controller_test.dart` — ownership over the real
  coordinator, repositories and Drift, plus bootstrap materialization end to end
  (a first-use bootstrap with an empty calendar is empty rather than loading,
  creates no calendar metadata or ETag, leaves the resource due for a later run
  that writes only its own validator, keeps its state through a failed later
  refresh, and an older season's bootstrap materializes nothing for a newer one):
  creating the controller and re-reading the derived state produce **zero**
  requests; a manual refresh runs the application
  coordinator exactly once and still sends the persisted ETag; a duplicate tap is
  coalesced; the refresh future completes even when the run is cancelled; a run
  in progress reports as refreshing and then settles; an unrelated core failure
  is not a Calendar error; a Calendar failure keeps its cache as a non-blocking
  error and becomes a first-load error without one; the resource key is exactly
  `calendar:<season>`; a season transition switches the watched calendar while
  the previous season's rows and metadata stay on disk.
- `test/application/grand_prix_results_state_test.dart` — the result section's
  pure derivation: an upcoming event is unavailable, an advertised classification
  is loading, a recorded success with nothing stored is unavailable (not an
  error), a stored-but-empty document is not a classification, a failure with no
  cache is a scoped error, a refresh outranks a previous failure; sprint and race
  documents coexist and stay separate and ordered; cached results render even
  when nothing advertises them; result freshness comes from its own metadata.
- `test/application/grand_prix_results_controller_test.dart` — on-demand
  ownership: opening a route triggers exactly one detail request and re-reading
  the state triggers none; a retry after a failure issues a new one; the keys are
  exactly `grand-prix:<season>:<round>` and
  `grand-prix-results:<season>:<round>`; a route season may differ from the
  stored current season (and works with none stored at all); an upcoming event
  with `hasResults == false` requests nothing; `hasResults == true` requests
  exactly once; a detail refresh that flips the flag false→true requests exactly
  once and never again; repeated local emissions never repeat the request; cached
  results render even after the flag is cleared; detail and result failures stay
  independent in both directions; a result retry touches only the result
  resource; disposing the scope cancels the in-flight request (observed on the
  cancellation token) and a later visit still succeeds.
- `test/screens/calendar_widget_test.dart` — the loading skeleton, a valid empty
  calendar (a real empty state, not a loader), a first-load failure with a retry
  that refreshes, an unresolvable season; the persisted order, the "Next" marker,
  a localized label for every status including postponed/cancelled/unknown,
  missing locality/country rendering nothing at all, no placeholder content
  remaining; tapping an event opens the correct season/round; a stale cached-data
  notice, pull-to-refresh and a refresh failure both keeping the rows visible, an
  unrelated core failure not becoming a Calendar error, the labelled refresh
  action; the one-time positioning of the relevant event, its non-repetition on a
  later emission, and scroll preservation across a branch switch and a return
  from detail; semantics, 48 px targets, a 2× text scale and Spanish copy.
- `test/screens/grand_prix_widget_test.dart` — identity, status, format,
  location, dates and both time-zone contexts; a duplicate official name not
  repeated; missing locality/country/timezone vanishing; unknown status and
  format still reading as labels; sprint and standard weekends through the same
  widget path in delivered order; unknown, cancelled and postponed sessions
  staying visible; a session with no time showing none; an empty schedule as a
  controlled empty state; results-pending without an error; a rendered
  classification with fractional points, elapsed time and gap; sprint and race
  sections coexisting and separate; DNF/DNS/DSQ/DNQ/lapped/unknown finishes,
  laps-behind, duplicate displayed positions, a fastest-lap badge and a
  provisional status; a result failure scoped to its section with and without
  cache; cached results surviving a `hasResults == false`; a detail failure
  keeping the weekend visible; the stale notice; circuit, driver and constructor
  navigation by stable id; loop prevention; Android back to the Calendar branch;
  a deep link; an invalid parameter staying controlled; row semantics, the 48 px
  team target, a 2× text scale and Spanish copy.
- `test/data/repositories/feature_offline_test.dart` — on a temporary **on-disk**
  database: the calendar survives a close/reopen and renders with zero network
  calls; Grand Prix detail and *both* classifications survive and stay visible
  while every on-demand refresh fails; the persisted ETags drive the next
  conditional validation; a `304` after a reopen produces no domain emission and
  no visible change; a valid empty calendar stays empty rather than loading; a
  Grand Prix with no sessions stays renderable; a calendar materialized only by
  an accepted bootstrap survives a reopen and shows the empty state rather than a
  loader while creating no `calendar:<season>` row or ETag, and a later calendar
  sync creates and uses only its own validator; the previous season stays on disk
  after a transition.
- `test/design_system/result_row_test.dart` — the extended classification row:
  omitted values are not rendered (no false zeroes), supplied values all render,
  the primary and team actions are separate non-overlapping hit areas with their
  own button semantics, the team target is at least 48 px, a long value at a 2×
  text scale wraps instead of overflowing, and a session row shows an accent only
  for a non-neutral tone.

### Phase 7A goldens

`test/screens/screen_golden_test.dart` adds dark-theme goldens for the populated
Calendar (with the one-time relevant-event positioning visible), the valid empty
Calendar, the stale/cached Calendar, an upcoming standard Grand Prix, a completed
Grand Prix with its classification, and a Grand Prix whose result section failed.
The existing `grand_prix_detail_loaded` golden was regenerated for the new
real-data layout and inspected; `home_loaded` and `primary_shell_nav` are
unchanged.

### Manual staging validation (Phase 7A, non-CI)

CI never depends on staging availability; this pass is manual and uses only
public GET routes — no admin route and no `ADMIN_TOKEN`.

Build and install a staging APK with an externally supplied base URL:

```powershell
flutter build apk --debug `
  --dart-define=APP_ENV=staging `
  --dart-define=DATA_SOURCE=remote `
  --dart-define=API_BASE_URL=<staging base URL>
```

Checklist:

1. Open **Calendar** on an install that has already synchronised.
2. Verify the season header shows the current season and that the event list is
   in chronological (round) order.
3. Verify the current/next event is easy to identify (accent, "Next" chip) and
   that the list opened positioned near it, with earlier rounds reachable above.
4. Open an **upcoming standard** Grand Prix; check the header, weekend facts and
   the full session schedule.
5. Open a **sprint** Grand Prix; check that the sprint sessions render through
   the same schedule, in delivered order.
6. Open a **completed** Grand Prix with results; check the classification.
7. Where the event is a completed sprint weekend, confirm the **sprint and race
   sections coexist** and are never merged.
8. Confirm session names, dates, times and the time-zone labels, plus the event
   and device time-zone fields.
9. Navigate to **Circuit**, then back; from a result row navigate to **Driver**
   and to **Constructor** (the team is its own tap target), then back.
10. Return to **Calendar** and confirm the scroll position was preserved.
11. Enable **airplane mode** now that the data is cached.
12. Reopen Calendar and a Grand Prix detail; confirm cached content still
    renders, with a discreet cached-data notice rather than an error.
13. Trigger pull-to-refresh while offline; confirm the cached content stays
    visible, the indicator completes, and the failure is non-blocking.
14. Restore connectivity and refresh again; confirm the content updates (or that
    a `304` leaves it visually unchanged).
15. Confirm the **STAGING** badge is visible.
16. Confirm **no "Sample data" banner** appears (staging with
    `DATA_SOURCE=remote` must never use fixtures).

## Standings feature (Phase 7B)

Both championship tables are covered without a Worker, network, admin token or
device — pure functions, `ProviderContainer` over in-memory SQLite, widget tests
over fake repositories, and temporary on-disk files for the persistence suite.

- `test/database/standings_read_model_test.dart` — the presentation read models
  over a real database: the drivers' table joins the stable driver identity and
  prefers the season team branding over the stable constructor name; the team
  comes from **exactly** `DriverStanding.constructorId`, so a null one guesses
  nothing and a mid-season stint neither duplicates a row nor re-teams it; the
  constructors' table prefers season branding then the stable identity and never
  uses a name as identity; `order_index` wins over null, duplicated and
  non-monotonic positions; fractional points, confirmed zeros and null
  wins/podiums survive; other seasons are excluded and competitor identities are
  never deleted; season branding is scoped to the read season; an empty season
  yields an empty table rather than an error.
- `test/application/standings_state_test.dart` — the pure state derivation for
  both championships: unresolved season, unemitted stream and unloaded metadata
  are loading and never "empty"; a settled run with no season is a controlled
  recoverable error; direct metadata (with or without rows) materializes; an
  accepted same-season bootstrap materializes **without** individual freshness or
  an update time; an older season's bootstrap materializes nothing; one
  championship never materializes the other; the shared
  `hasMaterializedCollection` rule is the one used; cached rows survive a refresh
  and a failure as a non-blocking notice; a refresh in flight hides the previous
  failure; the `staleAfter` boundary; one table's failure is not the other's, and
  the retained state is immediately available; and the provisional summary
  (`unspecified` / `provisional` / `mixed` / `notProvisional`) never flattens a
  disagreement into a false global state.
- `test/application/standings_controller_test.dart` — ownership and refresh over
  the real Drift + coordinator pipeline: creating the controller (root **or**
  explicit route) issues no request, and neither does rebuilding the derived
  state; one root user action runs the coordinator once for both tables and keeps
  the persisted validators; duplicate taps coalesce; a cancelled run still
  settles the refresh state; an unrelated core failure and the *other* table's
  failure are never this table's error; a selected failure without
  materialization is a first-load error and a retry issues a new request;
  bootstrap creates no standings metadata or ETag, the first individual request
  after it sends no validator and creates only its own metadata, and a later
  refresh sends its own persisted ETag; a historical explicit route refreshes
  **only** the selected championship for the exact route season (never the other
  championship, never a current-season key), while an explicit route on the
  current season uses the core path; a season transition switches the watched
  keys and leaves the previous season on disk.
- `test/screens/standings_widget_test.dart` — the screen: skeleton only while
  unmaterialized, real empty states (including bootstrap-materialized empty),
  bootstrap-only data claiming no update time, per-championship first-load
  errors, populated tables with delivered order, an unranked em dash with an
  accessible meaning, a row with no team leaving no dangling separator, leader
  emphasis from a confirmed position 1 only, tied leaders, section-level vs
  row-level provisional, the selected table's own timestamp and stale/failure
  notices, selector behaviour (Drivers first, no request on switch, survives a
  branch switch and a detail round trip, repeated taps stack nothing, a fresh
  session returns to Drivers), independent scroll offsets across switches,
  branch switches, detail round trips and stream emissions, navigation by stable
  id, pull-to-refresh and the app-bar action, the historical-route refresh, and
  accessibility (row reading order, selected semantics, explicit refresh label,
  48 px targets, a 2x text scale and Spanish copy with a decimal comma).
- `test/data/repositories/standings_offline_test.dart` — a real on-disk database:
  both collections, their rows and their **separate** ETags survive a
  close/reopen and render with zero network calls; a later revalidation sends the
  selected resource's own validator and a `304` emits no false content change;
  bootstrap-materialized rows (and a bootstrap-materialized *empty* table)
  survive a reopen with no individual metadata; a failed refresh of one
  championship preserves both caches and its own validator; an old season
  survives a current-season transition.
- `test/design_system/component_behavior_test.dart` — the extended
  `GvStandingsRow`: omitted values render nothing (no dangling separator, no
  false zero), supplied values join on one secondary line, a two-digit position
  stays on a single line, and `semanticLabel` exposes one explicit reading order.

### Referential stubs (Phase 7B correction)

`test/database/unresolved_identity_test.dart` covers the persistence-only
referential stub that satisfies a foreign key while a competitor identity has not
synchronized (`GridView_Local_Data.md` §9). It is the one place allowed to read
the stored name column raw; every other assertion goes through a DAO read.

- **Standings before the identity** — a driver standing persists with its stable
  identifier, position, fractional points and confirmed-zero statistics intact,
  while the read model exposes no name at all: not the marker, not the raw
  identifier and not a humanised identifier. The stored parent is asserted to be
  the marker so a future regression to a fabricated name fails loudly. The
  equivalent holds for a constructor standing (no season name, no stable name, no
  display name, no colour).
- **Idempotence** — repeating the standings write before identity synchronization
  leaves exactly one identity row, still a stub, and one standing row.
- **A missing team invents nothing** — a standing that names a constructor which
  has not synchronized shows the real driver name with no team name and no team
  colour.
- **Resolution** — a later authoritative driver upsert resolves the stub *in
  place*: a stream observed before the upsert emits the unnamed row first and the
  real name second, and the standing's position, points, wins and `orderIndex`
  survive. A constructor upsert resolves the stub, and a later season entry then
  takes precedence over the stable name and supplies the accent colour.
- **No downgrade** — repeated standings and constructor-standings writes never
  overwrite an identity that already synchronized, and an authoritative upsert is
  *rejected* when it tries to store a blank name (so the marker can only ever mean
  "unresolved"), leaving no partial row behind.
- **Not a domain entity** — `driverDetail` / `teamDetail` return `null` for a stub
  and become materialized as soon as the identity arrives (with the standing still
  attached); `driversForSeason` / `constructorsForSeason` omit stubs while the
  underlying season-entry rows are proven still present; and a classification
  exposes null competitor names rather than invented ones.
- **On disk** — after a close/reopen of a real database file, an unresolved
  standing is still readable, still nameless, still not a materialized detail, and
  still resolvable by a later upsert.
- **Historical seasons** — a past-season standings write may hold unresolved
  identities without showing invented names and without touching the current
  season.
- **The projection is exhaustive** — every nullable name/colour a standings read
  model exposes is asserted null for an unresolved pair, and the predicate itself
  is asserted exact (a real name, an identifier and a blank-looking space are all
  *not* the marker).

`test/screens/standings_widget_test.dart` adds the screen-level half: an
unresolved driver and an unresolved constructor both render the localized
**"Name unavailable"** copy, never the identifier or a humanised form of it; the
row still announces its position and points; an unresolved team leaves the row's
secondary line without a dangling separator; and tapping the row still navigates
by its stable id.

The same rules are covered for **circuits**, whose domain `name` is required, so
an unresolved identity reads exactly like an absent row: an event persists and
carries no circuit, `circuitName`/`locality`/`country` are all null, the stored
parent is asserted to be the marker (never containing anything derived from
`spa-francorchamps`), `circuitsForSeason` and `circuitDetail` exclude it, and
`HomeView.circuit` / `GrandPrixDetailView.circuit` are null. A later
`upsertCircuits` resolves it — observed as a calendar-stream emission — after
which the circuit is a real collection member with its related events attached.
Repeated calendar and Grand Prix snapshot writes never downgrade a synchronized
circuit, and a blank circuit upsert is rejected.

`test/database/competitor_dao_test.dart` roster and detail cases now seed the
authoritative identities they read, which is how season participation and the
competitor collections actually arrive together. Their assertions (ordering, span
selection, transactional rejection, preserved role) are unchanged.

### Phase 7B goldens

`test/screens/screen_golden_test.dart` adds dark-theme goldens for the populated
drivers' table, the populated constructors' table, a fractional/tied/unranked
provisional table, the valid empty table, the stale/cached notice and a
non-blocking refresh failure with the rows retained. The Phase 3
`standings_skeleton` golden was **replaced** by `standings_loading` — a
deliberate final-screen loading frame (the real screen with the selected table
not yet materialized), so the skeleton-only golden no longer has a role. The
`standings_row_leader` design-system golden was regenerated for the row's
minimum-width position slot. Every changed golden was inspected; all other
goldens are unchanged.

### Manual staging validation (Phase 7B, non-CI)

CI never depends on staging availability; this pass is manual and uses only
public GET routes — no admin route and no `ADMIN_TOKEN`.

Build and install a staging APK with an externally supplied base URL:

```powershell
flutter build apk --debug --flavor staging `
  --dart-define=APP_ENV=staging `
  --dart-define=DATA_SOURCE=remote `
  --dart-define=API_BASE_URL=<staging base URL>
```

Checklist:

1. Open **Standings** on an install that has already synchronised.
2. Confirm **Drivers** is selected on the first visit.
3. Verify the delivered positions, driver names, team names and points.
4. Verify fractional points render with the locale's decimal separator, and that
   a confirmed zero shows as zero while an unavailable statistic is absent.
5. Switch to **Constructors**; verify season team names, positions and points.
6. Scroll both tables to clearly different positions.
7. Switch between them and confirm each position is preserved.
8. Switch bottom-navigation branches and return; confirm the selected
   championship and both positions survived.
9. Open a **Driver** from the drivers' table and return; confirm the selection
   and scroll position are preserved.
10. Open a **Constructor** and return; confirm the same for that table.
11. Manually refresh each selected view (pull-to-refresh and the app-bar action).
12. Confirm the content stays visible during the refresh — no full-screen loader.
13. Enable **airplane mode** now that the data is cached.
14. Reopen Standings; confirm both tables are still available.
15. Refresh offline; confirm the cached rows stay visible and the failure is a
    non-blocking notice scoped to the selected table.
16. Restore connectivity and revalidate; confirm the content updates (or that a
    `304` leaves it visually unchanged).
17. Confirm the freshness and error copy is scoped to the **selected** table —
    switching the selector switches that context.
18. Confirm the **STAGING** badge is visible.
19. Confirm **no "Sample data" banner** appears.

## Explore, Driver, Team & Circuit features (Phase 7C)

Phase 7C adds **232** tests (221 unit/widget/integration + 11 goldens), taking
the Flutter suite from 844 to **1076** with **27** goldens. No existing
assertion was weakened. Every test is deterministic and offline: none needs the
internet, Cloudflare, `ADMIN_TOKEN`, a real provider or an Android device.

### Support additions

| File | Purpose |
|---|---|
| `test/support/entity_fixtures.dart` | Explore cards and entity profiles, including the awkward legal cases: a driver with no resolvable team, two mid-season spans, a rebranded constructor, an unranked entrant, a confirmed zero, fractional points and a circuit with no related event |
| `test/support/fake_entity_repository.dart` | Independent fakes for the Driver, Constructor and Circuit repositories, each recording collection and detail refreshes separately so a test can prove exactly which resource was requested |

`pumpApp` now also overrides the three entity repositories, so every navigation
and rendering test runs against deterministic fakes rather than a database.

### Collection read models — `test/database/entity_collection_read_model_test.dart` (25)

Read from a real in-memory database:

- the drivers collection contains the real current-season identities;
- an unresolved driver stub is omitted while its relationship row survives;
- the team comes from the exact `DriverSeasonEntry`, never from a standing that
  names a different constructor;
- an unresolved constructor contributes no team name and no team colour;
- mid-season participation produces **one** card, not two, with `spanCount == 2`
  and the open span as the relevant one;
- optional values stay `null` and a confirmed zero survives;
- standings enrichment does not reorder the collection, and repeated reads keep
  the same order (unnumbered entrants last);
- season branding takes precedence over the stable name, and a rebrand preserves
  both the stable id and the collection position;
- the line-up derives from participation entries, keeps both mid-season spans and
  omits stubs;
- circuits follow the **calendar** order (deliberately not alphabetical in the
  fixture), the related Grand Prix uses the exact season and round, another
  season contributes nothing, and stubs are omitted;
- a driver profile carries every span in relevance order;
- a stub never materializes a driver, team or circuit profile;
- a later authoritative upsert resolves the same row in place;
- a circuit profile resolves its lap-record holder's name, yields `null` for an
  unresolvable one, and remains valid with no related event.

### State derivation — `explore_state_test.dart` (19) and `entity_detail_state_test.dart` (14)

Pure functions, no Riverpod and no widget tree.

The full Explore materialization matrix (own metadata, same-season bootstrap,
older-season bootstrap, nothing) crossed with rows/zero rows; the stale boundary;
season-unresolved while settling versus settled; first-load error versus cached
content preserved through a failure; a failure suppressed while a refresh is
still running; three independently derived categories; progress scoped to the
selected one.

For details: season resolving / unavailable / refreshing; partial versus
materialized and the `null` freshness that a partial state must claim; a stale
materialized detail; `404` with and without a real local summary; not-found
outranking a transient failure; cached content surviving a failure; and section
availability on all three profile types.

### Controllers — `explore_controller_test.dart` (14) and `entity_detail_controller_test.dart` (19)

**Explore:** creating the controller, deriving every category, switching category
repeatedly and re-reading a state all produce **zero** requests. The focused
retry targets only the selected collection, for the exact resolved season, makes
no request without one, collapses repeated taps, surfaces a failure without
discarding cached cards, treats a cancellation as no failure, and always
completes.

**Details:** an origin season is used exactly and a deep link resolves the local
current season; no resolvable season makes no request at all; the same entity in
two seasons is two independent controllers; opening one detail requests only that
detail and nothing else; rebuilds and repeated local emissions create no
duplicate; a `404` with no entity is a definitive not-found while a `404` with a
summary keeps the content; a transient failure stays retryable; a cancellation
clears transient state; a successful retry clears a previous not-found; repeated
retries collapse; and team/circuit season propagation is exact.

### Metadata isolation — `test/data/repositories/entity_metadata_isolation_test.dart` (12)

Through the real conditional pipeline: a collection `200` creates only its own
metadata; the first detail request after a collection sends **no** validator; a
later detail `304` uses only its own persisted ETag while the collection keeps a
different one; a collection sync produces a real partial profile without
materializing the detail; one collection failing leaves the other two untouched;
and an older detail snapshot preserves newer local content.

### Referential stubs and 304 recovery — `test/data/repositories/stub_recovery_test.dart` (25)

The same eight cases run identically for **all three** detail families, so they
cannot drift apart:

1. a stub is never returned as detail content;
2. stub-only state plus a `304` causes exactly one **unconditional** retry;
3. a successful retry resolves the identity and persists the detail normally;
4. a `304` after a materialized authoritative detail revalidates once and does
   **not** retry;
5. a persistent `304` with no representation yields one typed `invalidResponse`
   failure after exactly two requests — it cannot loop;
6. a transient failure after the retry stays a typed failure and preserves the
   stub's relationship rows;
7. an existing real identity is never downgraded by `ensure*`;
8. a real identity makes a `304` a plain revalidation.

Plus one shared check that the unresolved marker never leaks into a resolved
name and never reaches a collection.

### Offline and persistence — `test/data/repositories/entity_offline_test.dart` (6)

Against a real on-disk database in a temporary directory:

- all three collections and all three details survive a close/reopen and render
  with **zero** network calls;
- each resource keeps its own ETag across the reopen, and the next conditional
  request sends exactly that validator;
- a bootstrap-only state survives a reopen while the individual collections
  remain due;
- a failed detail refresh preserves the persisted content;
- another season stays isolated (including a circuit that legitimately has no
  related event in it);
- an unresolved stub stays hidden after a reopen, then resolves and stays
  resolved across a further reopen.

### Widgets — `explore_widget_test.dart` (27) and `entity_detail_widget_test.dart` (29)

Explore: `/explore` defaults to Drivers; each explicit category route opens its
own collection; selecting a category replaces the page and produces no request;
repeated taps do not stack; an invalid category is a controlled not-found; a
materialized empty collection renders empty while an unmaterialized one stays
loading; a bootstrap-only collection shows **no** fabricated timestamp; a
first-load failure offers a retry that targets only the selected collection;
cached cards survive a coordinator-reported failure; one category's failure never
becomes another's; no placeholder catalogue data and no identifier appears
anywhere; the selector exposes selected semantics; targets meet 48 px; large text
does not break; all three rows navigate; the resolved season travels to the
detail; and the three scroll offsets are independent and survive detail round
trips and branch switches.

Details: complete and partial profiles for all three entities; missing
biography/birth data/standing/team/media hidden rather than shown empty; a
mid-season driver showing both spans; localized role labels; unranked and
confirmed-zero statistics; definitive not-found versus retained partial content;
a retry from a first-load error; a non-blocking failure keeping cached content;
semantic headings; large text; the team line-up and its navigation; localized
kilometre and lap-time formatting; a missing lap-record driver using localized
copy rather than an identifier; an unknown direction fallback; no related event
as a valid state; and the exact season/round of the related event.

### Cross-entity navigation — `test/navigation/entity_graph_navigation_test.dart` (16)

Every entry point (Explore, Standings, constructors standings, Grand Prix
result, Grand Prix, Driver detail, Team detail); the three immediate loops
(Driver → Team → Driver, Team → Driver → Team, Grand Prix → Circuit → Grand
Prix) popping rather than stacking; a different entity still pushing; Android
back returning to the exact originating branch, category and scroll; a
historical Standings season reaching the driver detail; and the Standings
context surviving a detail round trip.

### Design system — `test/design_system/section_header_test.dart` (15)

`GvSectionHeader`'s overflow fix: no overflow for the longest English and Spanish
actions at 1x and 2x text scale and at 320 px width; the title keeps at least
half the row; the target meets the minimum touch size in both dimensions; the
complete label survives visual truncation in semantics; the action stays a
tappable button; the header is a heading; and no tooltip was introduced.

### Goldens (11 new, 27 total)

`explore_drivers_populated`, `explore_teams_populated`,
`explore_circuits_populated`, `explore_empty`, `driver_detail_complete`,
`driver_detail_partial`, `team_detail_complete`, `team_detail_partial`,
`circuit_detail_complete`, `circuit_detail_partial`,
`entity_detail_cached_failure`.

All pin locale, clock, text scale, surface size, device time-zone label, every
provider input and the deterministic placeholder state. No existing golden was
regenerated or superseded — the Phase 3 Explore and entity skeleton screens had
no goldens of their own.

### Manual staging validation (Phase 7C, non-CI)

CI never depends on staging availability or on a device; this pass is manual and
uses only public GET routes — no admin route and no `ADMIN_TOKEN`.

Build and install a staging APK with an externally supplied base URL:

```powershell
flutter build apk --debug --flavor staging `
  --dart-define=APP_ENV=staging `
  --dart-define=DATA_SOURCE=remote `
  --dart-define=API_BASE_URL=<staging base URL>
```

Checklist:

1. Open **Explore** on an install that has already synchronised.
2. Confirm **Drivers** is the default category on the first visit.
3. Browse Drivers; verify names, numbers, teams, nationalities and standings, and
   that an unavailable value is absent rather than zero.
4. Switch to **Teams**; verify season branding, power unit, standings and the
   compact line-up summary.
5. Switch to **Circuits**; verify names, locations, the related Grand Prix and
   that the list follows the season's calendar order.
6. Scroll each of the three lists to a clearly different position.
7. Switch categories and confirm each scroll position is restored independently.
8. Switch bottom-navigation branches and return; confirm the selected category
   and all three positions survived.
9. Open a **Driver** from Explore.
10. Open a **Driver** from Standings.
11. Open a **Driver** from a Grand Prix result.
12. Confirm the profile content is consistent across all three entry points.
13. From the driver, open the **Team**; navigate back and confirm you return to
    the exact origin.
14. Open a **Team** from Explore and from the constructors' standings.
15. Inspect the season branding, the facts card and the derived line-up,
    including any mid-season span.
16. Open a **Driver** from the team, then re-open the same team: confirm it
    returns rather than stacking a duplicate (loop prevention).
17. Open a **Circuit** from Explore and from a Grand Prix.
18. Inspect the physical facts, the lap record and the layout placeholder.
19. Open the related **Grand Prix**, then re-open the same circuit: confirm the
    Grand Prix ↔ Circuit loop is bounded.
20. With all three lists and several details now cached, enable **airplane
    mode**.
21. Reopen Explore and the cached details; confirm everything still renders and
    remains navigable.
22. Where practical, reach an error state and trigger the focused retry; confirm
    only that collection is affected.
23. Restore connectivity and confirm a detail revalidates without visibly
    changing content.
24. Confirm **no raw identifier or humanised slug** appears anywhere — no
    `max-verstappen`, no `Max-verstappen`, no `Red Bull` derived from `red-bull`.
25. Confirm the **STAGING** badge remains visible.
26. Confirm **no "Sample data" banner** appears.

## Media (Phase 8B)

124 Flutter tests under `test/media/`, plus 74 Edge tests under
`services/edge-api/test/media/`. None touches the network.

### Test media is always generated

GridView has no approved Formula 1 media, so **every image any test or golden
renders is generated at run time**: flat geometric bands from
`test/support/synthetic_png.dart` (Flutter) and `sharp` (tooling). Nothing in the
suite is a driver photograph, a team logo, a Formula 1 mark, circuit photography,
a screenshot or a provider URL, and no image binary is committed under
`content/`. Every test URL uses the reserved, non-routable host
`https://media.gridview.invalid`.

The PNG encoder is written by hand rather than pulled from a package so its
output is byte-identical every run, which is what a stable golden needs.

`services/edge-api/test/media/inventory-isolation.test.ts` enforces the
separation: the production register must be authoritative and empty, the gate
must consequently approve nothing, no synthetic test asset id may appear anywhere
under `content/`, and no image binary may be committed there. A fixture drifting
into the production directory would otherwise be indistinguishable from a real
approval.

### No test can reach the network by accident

`pumpApp` installs a `MediaLoaderScope` only when a test passes `mediaLoader`.
Without one, every remote image slot renders its placeholder and issues no
request — so the many widget tests that are not about media cannot make a request
even by mistake, and a media test asserts exactly which requests it caused.

`FakeMediaImageLoader` counts cache probes and fetches. Requests are asserted on
the **cache key**, not on rendered pixels, so "a 40px Explore row never fetches a
hero" is checked on the thing that would actually cost bandwidth.

| Suite | Covers |
| --- | --- |
| `media_url_policy_test.dart` | scheme, host, credential, control-character and redaction rules |
| `variant_selector_test.dart` | DPR 1/2/3, smallest-adequate, undersized fallback, unknown dimensions, determinism, cache identity |
| `media_ownership_test.dart` | single-owner integrity, descriptors, replacement, batched reads, slot policy, GP hero fallback, reopen |
| `media_loader_test.dart` | cache hit/miss, exception mapping, no retry, enforceable limits |
| `gv_remote_image_test.dart` | every no-image state, layout stability, duplicate requests, semantics, themes, reduced motion |
| `media_slot_integration_test.dart` | live slots, row-sized requests, failure resilience, acknowledgements |
| `rights.test.ts` | every publication refusal |
| `process.test.ts` | object keys, no-upscale, WebP/PNG, orientation, metadata stripping, determinism |
| `publish.test.ts` | dry-run, refusals, production protection, immutable conflicts, idempotence |
| `inventory-isolation.test.ts` | test/production media separation |

### Media goldens

Media goldens follow the Linux-canonical workflow like every other golden: final
PNGs are rendered by `Render canonical goldens` and never authored on Windows.
Loader state and cache state are pinned alongside locale, theme, DPR, dimensions,
clock, timezone and preferences, so a media golden is as deterministic as any
other.

The 2% cross-platform comparator is unchanged and must not be raised because an
image introduces platform variance; a new golden approaching that threshold is a
signal to diagnose, not to weaken the gate.
