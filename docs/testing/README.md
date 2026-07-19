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
- `golden_test.dart` — a small representative set (status chips, primary button,
  data card, standings row) in the dark theme, with committed goldens under
  `test/design_system/goldens/`.

Goldens are deterministic across platforms because no custom fonts are bundled
(text uses flutter_test's default font). Regenerate them with
`flutter test --update-goldens test/design_system/golden_test.dart` only when a
component's appearance intentionally changes.
