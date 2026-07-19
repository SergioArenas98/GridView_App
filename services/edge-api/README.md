# GridView edge API

TypeScript Cloudflare Worker that serves the GridView API contract.
Architecture, endpoints, storage model and synchronization design:
`../../docs/technical/GridView_Backend_Scheme.md`.

## Current state

- `GET|HEAD /v1/status` implemented with the GridView response envelopes.
- Contract layer (`src/contract`), runtime validation and fixtures added in
  Phase 2 Batch 2B. Production routing for the other endpoints arrives in Phase
  5; contract tests use a fixture-backed test router.
- Local development only: **no Cloudflare account resources are provisioned**
  (no KV, R2, routes, domains or secrets). Bindings arrive in Phase 5.
- No Formula 1 provider integration.

## Development

```text
npm install
npm run dev              # wrangler dev (local Miniflare, no account needed)
npm test                 # vitest (routes + contract tests)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run format           # prettier --check
npm run validate:openapi # redocly lint of docs/api/gridview-api-v1.yaml
npm run validate:content # curated content vs JSON Schemas
npm run validate:fixtures # API fixtures vs OpenAPI + provider-ID guard
npm run validate         # all three
```

`wrangler dev` serves http://localhost:8787/v1/status locally.

### Flutter client and this Worker

The Phase 4 offline-first slice does **not** require this Worker to run. The
dev/staging Flutter build serves OpenAPI-valid snapshots bundled in the app
(`assets/dev_fixtures/*`, the same shapes as `test/fixtures/api/v1/`) through the
same DTO → repository → Drift → UI path as production. To point the client at a
running Worker or staging instead, pass
`--dart-define=API_BASE_URL=...` to `flutter run` (see
`../../docs/technical/GridView_Synchronization.md` §9). Production always uses the
real HTTP client and never falls back to fixtures.

## Layout

```text
src/
├── index.ts              Fetch handler and routing
├── config/environment.ts Environment validation (Env bindings)
├── http/envelope.ts      Success/error response envelopes
├── routes/status.ts      /v1/status handler
└── contract/             Contract types, enums, runtime validation, parsers
scripts/                  ajv-based content/fixture validators (Node ESM)
test/
├── fixtures/api/v1/       API fixtures + manifest.json (shared source of truth)
├── support/               fixture-backed test router
├── contract/              contract tests (envelopes, meta variants, tolerance)
└── status.test.ts         route tests
```

## Fixtures

`test/fixtures/api/v1/manifest.json` maps every fixture to its OpenAPI data
schema, `dataKind` (single/array), metadata variant (BaseMeta / SnapshotMeta /
SeasonSnapshotMeta) and whether it is expected to validate. The same fixtures
back the Flutter parsing and mapping tests. See `../../docs/testing/README.md`
for naming and how to add a fixture safely.
