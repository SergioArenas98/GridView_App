# GridView edge API

TypeScript Cloudflare Worker that serves the GridView API contract.
Architecture, endpoints, storage model and synchronization design:
`../../docs/technical/GridView_Backend_Scheme.md`.

## Current state

- `GET|HEAD /v1/status` implemented with the GridView response envelopes.
- Local development only: **no Cloudflare account resources are provisioned**
  (no KV, R2, routes, domains or secrets). Bindings arrive in Phase 5.
- No Formula 1 provider integration.

## Development

```text
npm install
npm run dev        # wrangler dev (local Miniflare, no account needed)
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --check
```

`wrangler dev` serves http://localhost:8787/v1/status locally.

## Layout

```text
src/
├── index.ts             Fetch handler and routing
├── config/environment.ts Environment validation (Env bindings)
├── http/envelope.ts     Success/error response envelopes
└── routes/status.ts     /v1/status handler
test/                    Vitest suites
```
