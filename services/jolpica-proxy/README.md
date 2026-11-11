# Temporary Jolpica egress proxy

A removable transport for GridView's Cloudflare Worker using only Node.js
built-ins at runtime. No framework, database, cache, queue, retries, data
normalization or scheduling. GridView still owns reservations, pacing, 429
holds, validation, synchronization, reconciliation and publication.

Phase 2 provides code, offline tests and deployment templates. Nothing is
provisioned or activated. Live provider tests require separate authorization.

## Contract and security

The loopback listener requires `Authorization: Bearer <dedicated secret>`.
Fixed-length SHA-256 digests are compared with `timingSafeEqual`; duplicate
authorization fields are rejected. Only these exact raw GET targets pass:

| Target                                      | Query                                          |
| ------------------------------------------- | ---------------------------------------------- |
| `/ergast/f1/{season}/races/`                | exactly `limit=100`                            |
| `/ergast/f1/{season}/circuits/`             | exactly `limit=100`                            |
| `/ergast/f1/{season}/drivers/`              | exactly `limit=100`                            |
| `/ergast/f1/{season}/constructors/`         | exactly `limit=100`                            |
| `/ergast/f1/{season}/driverstandings/`      | exactly `limit=100`                            |
| `/ergast/f1/{season}/constructorstandings/` | exactly `limit=100`                            |
| `/ergast/f1/{season}/{round}/results/`      | exactly `limit=100`                            |
| `/test/`                                    | none; existing authenticated egress diagnostic |

`season` is four digits without a leading zero; `round` is 1–999 without leading
zeros. These are syntax bounds, not a calendar registry. All other paths,
encoded inputs, traversal, absolute URLs, extra/duplicate query parameters,
bodies and methods are rejected before upstream I/O.

The upstream is fixed to `https://api.jolpi.ca:443`, with certificate/hostname
validation, IPv4 selection and fresh sockets. Only the fixed GridView User-Agent,
JSON Accept and `Accept-Encoding: identity` are sent. Proxy auth, cookies,
client-IP headers, incoming Host and other request metadata never pass upstream.
The fixture connector is a test seam, not an environment-configurable upstream.

Response status, raw bytes, encoding/length, Retry-After and end-to-end diagnostic
headers (Server, CF-Ray, CF-Cache-Status, rate limits and others) are retained.
Cookies and hop-by-hop/Connection-nominated headers are removed. Redirects are
returned without following them; the Worker rejects all 3xx. No response
compression or cache is added. Removed cookies and transport headers can change
refusal header fingerprints; original body bytes and diagnostic values survive.

Proxy errors carry `X-GridView-Proxy-Error` and a bounded
`{"error":"proxy_..."}` body. An upstream cannot forge that marker. Local
connection failures produce 502, overload 503, and pre-header deadlines 504.
**Only an upstream can produce 429.** Worker failure classification is unchanged.

## Resource limits and diagnostics

- Incoming: 8 KiB headers, 512-character target, zero body, 64 connections.
- Default four active forwards, no waiting queue or extra provider rate limiter.
- Three-second header timeout; five-second request timeout.
- Eight-second absolute forwarding deadline covers DNS, TLS, streaming and
  downstream backpressure, inside the Worker's existing ten-second deadline.
- Upstream: 16 KiB headers, 8 MiB raw response cap. GridView retains its separate
  2 MiB **decoded** response limit.
- Backpressure pauses upstream; downstream disconnect, expiry or oversize closes
  upstream and releases capacity. Shutdown allows bounded in-flight completion.

After headers have been sent, stream failures terminate the connection. They
cannot replace status or append JSON without corrupting the response. A partial
429 retains its status/Retry-After so GridView can record its hold first.

Logs contain only fixed startup/shutdown/error event names: no credentials,
URLs, headers, IPs, provider bodies or raw exceptions. `GET /healthz` reports only
local process readiness, requires no secret and never calls Jolpica. Caddy blocks
it externally. Use one authorized Worker environment per VPS initially: different
Cloudflare environments have separate limiter namespaces but would share egress.

## Local use

Use a patched Node 22 release (repository CI) or Node 24. No production install
or build is needed: `npm start` runs `src/main.mjs`. Imports never bind a port.

| Variable                       | Meaning/default                                               |
| ------------------------------ | ------------------------------------------------------------- |
| `JOLPICA_PROXY_TOKEN_FILE`     | External secret file; production uses systemd credentials     |
| `JOLPICA_PROXY_TOKEN`          | Alternative local process secret; never set both sources      |
| `JOLPICA_PROXY_PORT`           | Loopback port, default 8788; binding is always `127.0.0.1`    |
| `JOLPICA_PROXY_TIMEOUT_MS`     | 100–9000; default 8000                                        |
| `JOLPICA_PROXY_MAX_CONCURRENT` | 1–16; default 4                                               |
| `JOLPICA_PROXY_LOCAL_IPV4`     | Optional IPv4 assigned to the machine; binds outbound sockets |

Generate a dedicated secret from at least 32 cryptographically random bytes,
represented as 43–128 base64url characters (hex encoding of 32 bytes also works).
Length checks cannot prove entropy. Protect the file outside the checkout; one
trailing newline is accepted. Invalid configuration emits only
`configuration_error` and exits nonzero. Rotation requires a service restart
and coordinated Worker secret update; there is no dual-token store.

Set an external disposable token-file path in the process environment before
`npm start`, or copy `.env.example` to ignored `.env`, set the external file path
and run `node --env-file=.env src/main.mjs`. Never put real tokens in shell
arguments. Inspect only `http://127.0.0.1:8788/healthz`; use tests for forwarding.

## Offline tests

```text
npx --yes npm@10.9.9 ci
npm run validate
```

Dev dependencies provide strict JSDoc type checking, lint and formatting.
Tests use Node's built-in runner and loopback fixtures. The fixture connector
checks fixed HTTPS/TLS/IPv4 options before mapping sockets to local HTTP;
non-fixture HTTPS calls are blocked in the HTTP test harness.

The real Phase 1 wrapper and hardened client also run against this service:

```text
cd ../edge-api
npm test -- test/providers/jolpica-proxy-compatibility.test.mjs test/providers/jolpica-transport.test.ts test/config/jolpica-transport.test.ts test/sync/coordinated/entry-points/proxy-transport.test.ts --maxWorkers=1
```

## Later Webdock deployment — Phase 3 authorization required

1. Confirm VPS resources, Linux image with systemd 247+ credentials support, patched
   Node at `/usr/bin/node`, Caddy version, SSH access, a DNS-only hostname pointing
   directly at the VPS (no intervening CDN cache), and ACME email.
   Confirm the assigned IPv4 and routing. `JOLPICA_PROXY_LOCAL_IPV4` must be an
   actual interface address; NAT public translation needs separate verification.
   The service forces IPv4 and never rotates, spoofs or disguises IP identities.
2. Create the unprivileged `gridview-jolpica` user/group without login. Copy the
   reviewed service to root-owned `/opt/gridview-jolpica-proxy`, readable but not
   writable by that account. No production `node_modules` are required.
3. Store a fresh secret in root-owned mode-0600
   `/etc/gridview-jolpica-proxy/token`. Optional non-secret overrides go in
   `/etc/gridview-jolpica-proxy/service.env`. Install the supplied unit into
   `/etc/systemd/system/`. Its `LoadCredential` delivers a protected file rather
   than embedding credentials in the unit environment.
4. Run `systemd-analyze verify` against the unit on Linux, then
   `systemctl daemon-reload` and `systemctl enable --now gridview-jolpica-proxy`.
   Check loopback-only binding, local health, process restart, boot startup and
   bounded shutdown. The unit limits resources and uses a read-only filesystem.
5. Install/adapt `deploy/Caddyfile`. Set `PROXY_HOSTNAME` and `ACME_EMAIL` in
   Caddy's service environment or replace the placeholders. Validate using
   `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` before
   starting/reloading. Align the port if changed. Keep access logging off and
   never enable credential logging. The template disables retries and upstream
   keepalive (avoiding implicit transport retries), and preserves diagnostics.
6. Expose only ports 443/80 for HTTPS/ACME and restricted SSH; never expose 8788.
   Application egress pinning is not an OS firewall. Plan firewall rules for DNS,
   HTTPS, ACME, updates and SSH; do not pin changing provider CDN IPs. Confirm
   certificate renewal and sanitized logs. Do not pass proxy environment settings
   such as `HTTP_PROXY`, `HTTPS_PROXY` or `NODE_OPTIONS` into either service.
7. Verify invalid/unauthenticated requests and limits without provider traffic.
   Obtain explicit authorization for bounded staging/provider tests, confirm the
   observed public IPv4 and only then enable Phase 1 proxy mode in staging.
   Preserve existing holds/state; no schedules or production activation are part
   of this phase. A dedicated public IP does not guarantee provider acceptance.

Caddyfile syntax was adapted offline with Caddy 2.11.9. Native systemd/Caddy runtime validation, TLS issuance/renewal and actual egress
verification require the later Linux environment. Offline tests do not establish
those operational properties or measured VPS capacity.

References: [Node HTTPS](https://nodejs.org/api/https.html#httpsrequestoptions-callback),
[Caddy transport/retries](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[systemd credentials](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LoadCredential=).

## Removal

1. Select direct transport in Cloudflare (`JOLPICA_TRANSPORT=direct`, or unset)
   through an authorized deployment. Verify direct operation under existing
   budgets/holds. No adapter or publication change is required.
2. Revoke/remove the proxy secret from Worker and VPS. Stop/disable
   `gridview-jolpica-proxy`; remove its Caddy site and reload Caddy, preserving any
   unrelated sites/services.
3. Remove this directory, dedicated unit/user/configuration and the temporary
   Worker wrapper/configuration in a reviewed change. Retain direct-transport
   regressions. No data migration or state reset is needed.
4. Remove dedicated DNS/certificate material and decommission the VPS after
   checking it has no other responsibilities.

Never reset provider holds or bypass publication safeguards during removal.
Speculative Jolpica API-token support is outside this service.
