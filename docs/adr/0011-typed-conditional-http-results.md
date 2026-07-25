# ADR 0011: Typed conditional HTTP results

- Status: Accepted
- Date: 2026-07-25

## Context

Phase 6B1 generalizes the Phase 4 Home/Grand Prix remote slice into the complete
v1 read layer. Every cacheable resource is fetched with an HTTP conditional
request (`If-None-Match`), so a response can be `200` (a fresh representation),
`304` (the cached representation is still valid) or a transport/contract error.

Phase 4 modelled the remote boundary as "return a parsed envelope, or throw a
`GridViewApiException`". That does not express `304` — which is a **success**
with no body — and forces every caller into a try/catch. It also risked leaking
transport types (Dio `Response`, `DioException`, `CancelToken`).

## Decision

The remote boundary returns exactly one sealed type per call,
`RemoteResult<T>`:

- `RemoteModified<T>` — HTTP 200: parsed `data`, response `meta`, the response
  ETag and the `X-Request-Id`.
- `RemoteNotModified<T>` — HTTP 304: the ETag (if the server re-sent one) and the
  request id. **No body is parsed.**
- `RemoteFailure<T>` — a provider-agnostic `ApiFailure` (network, timeout,
  rate-limited, server unavailable, invalid response, unsupported version, not
  found, invalid request, cancelled).

Rules:

- `304` is never represented as an exception, and its body is never parsed.
- No Dio type is ever exposed outside the remote data layer. Cancellation is a
  transport-neutral `RemoteCancellation` handle bridged to Dio internally.
- The `X-Request-Id` is preserved for development-safe diagnostics.
- Public mobile code never sends an admin credential or calls an internal route.
- A snapshot response missing `sourceUpdatedAt` maps to a typed
  `invalidResponse` failure before it can reach the conflict rule or the
  database (`snapshotMetaIsValid`).

The one client (`DioGridViewApi`) and one fixture source (`FixtureGridViewApi`)
implement the same `GridViewApi` interface for all 17 endpoints; the fixture
source honours conditional requests via a stable content ETag so dev/staging
exercises the exact same conditional path as production.

## Consequences

- Callers pattern-match a single result type; `304` is a first-class,
  non-applied success that leaves the cache untouched.
- Transport concerns cannot leak past the data layer.
- The conditional-request pipeline is centralized in `SyncedRepository`, so every
  repository shares identical ETag, 304, retry and failure handling.
