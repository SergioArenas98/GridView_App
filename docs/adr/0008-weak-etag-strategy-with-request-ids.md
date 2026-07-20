# ADR 0008: Weak ETags with per-request request IDs

- Status: Accepted
- Date: 2026-07-20

## Context

Every GridView success envelope includes `meta.requestId`, and the same request
ID is returned in `X-Request-ID`. The request ID changes per request, so response
body bytes can change even when snapshot content is unchanged.

## Decision

The Worker emits weak ETags for snapshot responses. The ETag identity is derived
from:

```text
api version + resource identity + contentVersion
```

It is not calculated from serialized JSON. Matching `If-None-Match` returns
`304 Not Modified` with no body and with `X-Request-ID`.

## Consequences

Clients and caches can perform conditional requests safely without pretending
that per-request response bytes are identical. A new immutable content version
changes the ETag for the affected resource.
