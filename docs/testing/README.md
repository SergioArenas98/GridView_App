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
antialiasing/rasterization drift (~1% measured between the developer machine and
the Linux CI runner). It must **not** be used to hide layout, spacing, colour or
component regressions — those change a large fraction of pixels and are expected
to fail. Do not regenerate goldens per platform; regenerate only when appearance
changes intentionally.

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
  2% tolerance, committed under `test/screens/goldens/`. Regenerate with
  `flutter test --update-goldens test/screens/screen_golden_test.dart`.

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
- `test/data/repositories/race_weekend_repository_test.dart` — empty-cache
  refresh, existing cache, failure-with-cache, failure-without-cache, invalid
  response, newer/older snapshot, detail lookup, missing Grand Prix, and
  cache-preserved-after-failure.
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
