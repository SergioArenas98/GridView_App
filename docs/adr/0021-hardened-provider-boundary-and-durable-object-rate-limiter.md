# ADR 0021: Hardened outbound provider boundary and Durable Object rate limiter

- Status: Accepted
- Date: 2026-08-23
- Amended: [A1](#amendment-a1---the-operator-run-jolpica-capture) (2026-10-13) -
  the operator-run Jolpica capture for reviewed season batches (decision pack
  2026-10-07, DP-9)

> **What this ADR does not do.** It creates no provider adapter, sends no
> provider request, unlocks no provider mode, provisions no Cloudflare
> resource and deploys nothing. `PROVIDER_MODE` remains `mock | none`,
> staging remains `mock`, production remains `none`, and the OpenF1 path stays
> fail-closed under [ADR 0020](0020-provider-source-observation-and-reconciliation.md)
> §5. No provider has been contacted, and none has approved GridView.

## Context

[GridView_Provider_Evaluation.md](../technical/GridView_Provider_Evaluation.md)
§11.4 records gap **G7**: GridView has no outbound-request hardening helper and
no per-provider rate limiter. §11.4 also withdraws the earlier claim that
serializing requests keeps a per-second limit out of reach — a single batch can
complete more than three requests inside one rolling second even when they are
issued one after another.

Phase 9B-1 closed G6 and G10: request accounting is typed per source, and quota
is modelled locally in each source's own published windows. That model is the
**reporting and scheduling** surface. It is not an atomic admission control,
and it was never intended to be one.

Two published policies must be honoured simultaneously, per source
(Evaluation §9.1, §9.2):

| Source | Burst | Sustained | Daily |
|---|---|---|---|
| OpenF1 | 3 requests/second | 30 requests/minute | none published |
| Jolpica | 4 requests/second | 500 requests/hour | none published |

Jolpica also requires a stable identifying `User-Agent`, and neither source
authenticates.

## Decision

Two things, together:

1. **One hardened HTTP boundary** through which every future real provider
   request must pass. Adapters never call global `fetch`, never choose an
   origin and never skip pacing.
2. **One Cloudflare Durable Object per canonical real source** as the
   authoritative reservation coordinator, addressed by `idFromName(sourceId)`
   so that `jolpica` and `openf1` each have exactly one global budget.

### Why a Durable Object, and what was rejected

| Candidate | Why it cannot be the authority |
|---|---|
| **Isolate / module-level state** | A Worker isolate is neither durable nor global. Cloudflare runs many isolates in many locations and evicts them freely, so each would hold its own private counter and the real outbound rate would be a multiple of the limit. |
| **Workers KV** | Eventually consistent, with no atomic read-modify-write, so two concurrent reservations can both read the same pre-state and both succeed. It also documents a **one-write-per-second limit to the same key** ([KV write docs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)), which is slower than the 3-4 requests/second the burst windows must arbitrate. |
| **Workers Rate Limiting binding** | The binding documents `period` values of **only 10 or 60 seconds**, a **separate limit per Cloudflare location**, and an API that is explicitly "permissive, eventually consistent, and intentionally designed to not be used as an accurate accounting system" ([binding docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)). It therefore cannot express 3/second **plus** 30/minute, nor 4/second **plus** 500/hour, as one global budget. |
| **A per-request or per-route counter** | Provider pacing is a property of GridView's outbound behaviour, not of inbound traffic. Public reads consume no provider quota, so counting them is meaningless. |
| **The Phase 9B-1 quota record** | It is the reporting and alerting model, updated after an attempt. Reusing it as an atomic reservation would conflate two different jobs and give neither honest semantics. |

A **Durable Object** has a globally unique identity, serialized execution and
strongly consistent storage ([Durable Objects docs](https://developers.cloudflare.com/durable-objects/)),
which is exactly the atomic "decide across every window at once" operation this
needs.

**Reservation and provider attempt stay distinct.** A reservation is
permission to send; a provider attempt is a request that actually left
GridView. A locally deferred reservation increments no ledger, no quota usage
and no success/failure timestamp, because nothing was sent. A granted
reservation is likewise not proof that a request was issued.

### D1 — Reservation semantics

| # | Rule |
|---|---|
| D1.1 | Windows come from the canonical typed policies in `src/providers/provider-source.ts`. The limiter never restates a limit. |
| D1.2 | State is one ascending list of reservation timestamps per source. Every window is recomputed from the *current* policy on each call, so no per-window counter can go stale. |
| D1.3 | At time `t`, a timestamp `ts` is active iff `ts > t - duration`. Capacity returns exactly at `ts + duration`. |
| D1.4 | One timestamp counts simultaneously against every window the source declares. |
| D1.5 | Admission is all-or-nothing. If any window is exhausted, no window is mutated. |
| D1.6 | A deferral returns a deterministic `retryAt`: the latest boundary among the limiting windows, which is the first instant at which *every* window can admit the request. |
| D1.7 | History is pruned to the longest declared window, so storage is bounded by that window's limit — 500 for Jolpica, 30 for OpenF1. Neither source has a daily bucket. |
| D1.8 | Source identity fails closed. A ledger belonging to another source is never adopted, and a mismatched request is rejected before any state is read or mutated. |
| D1.8a | **Absent state and invalid state are different.** A missing record means a genuinely new source and starts with full capacity. A record that *exists* but is unusable - written for another source, or containing anything that is not a finite, non-negative integer millisecond - **fails closed** with `state-corrupt`: no reservation is granted and no request is issued. Dropping an unreadable entry would reduce the active count and hand back capacity whose safety cannot be established, and adopting a foreign record would let one source's budget be spent as another's. |
| D1.8b | Corrupt state is **never repaired, deleted, reset or relabelled** by the limiter. The affected source stays blocked until the record is fixed out of band. There is deliberately no automatic recovery path and no administrative repair route. |
| D1.9 | The reservation timestamp is the Durable Object's own clock. A caller cannot choose it. |
| D1.10 | The object never sleeps, retries or holds a request until capacity returns. |
| D1.11 | A binding, dispatch or storage failure resolves to `unavailable`, and the boundary then issues **no** request. The reason is a bounded enum - `limiter-unreachable`, `storage-failure` or `state-corrupt` - and never carries a stored value, storage key or object id. |
| D1.12 | **A caller already cancelled on entry reserves nothing.** There is no live request to acquire capacity for, and reserving first would spend the single global per-source budget on a request that will never be sent - three cancelled callers would exhaust an OpenF1 second and deny a live one. The signal is therefore checked *before* the reservation, not after it. |
| D1.12a | If the caller cancels **while the reservation is in flight**, the granted slot is **not** released. Keeping it is deliberately conservative and avoids a release race. No request is sent, so it is not an attempted provider request. |
| D1.13 | Policy reconciliation may only forget real observations, never fabricate historical attempts. |
| D1.14 | **The serialized callback must not throw.** Cloudflare terminates and resets a Durable Object when an exception escapes `blockConcurrencyWhile`, which would tear down the shared limiter for every caller rather than failing one request. The body is wrapped and a storage or state failure resolves to `unavailable` - still fail-closed, but the object survives. |

### D2 — Outbound boundary

| # | Rule |
|---|---|
| D2.1 | Fixed HTTPS origins: Jolpica `https://api.jolpi.ca`, OpenF1 `https://api.openf1.org`. The caller supplies neither an origin nor a full URL. |
| D2.2 | Paths must sit inside the documented prefix — Jolpica `/ergast/f1/`, OpenF1 `/v1/`. HTTP, credentials, fragments, ports, alternative or lookalike hosts, protocol-relative input and traversal are all rejected. |
| D2.3 | Query parameters are encoded from structured input. |
| D2.4 | GET only for this phase. |
| D2.5 | Capacity is reserved before the transport is called. No reservation means no request. |
| D2.6 | `redirect: "manual"`, and every 3xx is rejected rather than followed. |
| D2.7 | A **10-second** timeout covers the whole operation including body consumption. Caller cancellation is preserved and stays distinct from the timeout. |
| D2.8 | Nothing is retried automatically — not timeouts, network errors, 429, 5xx, redirects or validation failures. |
| D2.9 | An explicit JSON `Accept` header is sent. Jolpica additionally receives a reviewed constant `User-Agent`. No `Authorization`, cookie or caller-supplied header is ever accepted or forwarded. |
| D2.10 | Only `application/json` and `application/*+json` are accepted, with parameters such as `charset=utf-8`. An absent or incompatible type is rejected before parsing. |
| D2.11 | A **2 MiB** decoded-body cap is enforced by both a trustworthy `Content-Length` and bounded streaming, so a missing or false header cannot bypass it. The stream is cancelled on rejection. |
| D2.12 | JSON is parsed only after the bounded read succeeds; malformed JSON is a typed safe error. |
| D2.13 | HTTP 429 is a typed provider rate-limit response. `Retry-After` is parsed in delta-seconds and HTTP-date form; at the exact boundary an expired instruction is not active, and a missing or malformed one yields nothing rather than an invented time. **A delta beyond one year is refused**, because an unbounded integer builds an unrepresentable `Date` whose `RangeError` would be swallowed by the request try-block and silently reclassify the 429 as a network failure. |
| D2.15 | The not-attempted category is a **closed union**, so an adapter cannot place a provider-controlled string into a log field or the internal admin response. |
| D2.14 | No provider body, transport exception, query string, header or full URL ever appears in an error, an API response or a log. |

**10 seconds and 2 MiB are chosen engineering constants**, not published
provider figures. They may be tuned, but only while preserving the invariants
they exist to enforce: a bounded wait and a bounded memory footprint.

### D3 — Typed outcomes

The boundary distinguishes, at minimum: local rate-limit deferral, limiter
unavailable, invalid request, timeout, caller cancellation, network failure,
redirect rejected, invalid content type, response too large, malformed JSON,
provider HTTP failure, and provider HTTP 429 with an optional parsed
`Retry-After`. Each carries whether a request was actually attempted.

`ProviderRateLimitedError` is **not** reused for a local deferral: that type
means the upstream answered 429 after an attempt. A new
`ProviderRequestNotAttemptedError` covers the opposite case and deliberately
does not extend `ProviderError`, so the synchronization service cannot record
a failed provider attempt for a request that never happened. Its category is a
bounded union (`ProviderNotAttemptedCategory`), not a free string.

## Consequences

- A future adapter cannot reach the network except through this boundary, and
  cannot exceed a published limit without the Durable Object agreeing.
- Pacing is global per source rather than per isolate or per location.
- `retryAt` is exposed for a future scheduler. **G5 event-aware scheduling
  remains open**; nothing here reschedules anything.
- At acceptance (2026-08-23) the Durable Object was declared and validated but
  **not provisioned**. **Superseded for staging on 2026-09-12:** staging
  version `985115b7-abb3-4346-8845-d8ff41c80cf6` bound `PROVIDER_RATE_LIMITER`
  and created its staging namespace; production has never been deployed and
  has none. A bound namespace is not an open provider path: no adapter exists
  and no production module constructs the hardened client, so nothing
  reserves through it. Staging stays off the network because `PROVIDER_MODE`
  is `mock` and no live adapter exists — not because of this binding.
  Wherever the namespace is unbound, every reservation still resolves to
  `unavailable` and no request can be issued — the fail-closed default.
- This does **not** implement G4, G5, G8 or G9, a circuit breaker, a retry
  scheduler, public API rate limiting, or either adapter.

## Configuration

Registered with the current supported form:

```toml
[[durable_objects.bindings]]
name = "PROVIDER_RATE_LIMITER"
class_name = "ProviderRateLimiter"

[exports.ProviderRateLimiter]
type = "durable-object"
storage = "sqlite"
```

SQLite-backed storage is required for Durable Objects on the Workers Free
plan. Bindings are not inherited by named environments, so development,
staging and production each declare the binding; `exports` is declared once.

## Amendment A1 - The operator-run Jolpica capture

- Date: 2026-10-13
- Status: Accepted when merged (decision pack "Real Jolpica data in a test APK
  at zero cost", 2026-10-07, DP-9)
- Amends: the Decision's first item, "every future real provider request must
  pass" the hardened boundary, and therefore the Durable Object limiter. It
  changes nothing in D1-D3 for any request a Worker sends.

### Why

The curated-batch path (decision pack Option 3; Implementation Plan §14.0.46,
§14.0.51) brings Jolpica data to staging without the Worker sending a provider
request. The operator captures the responses from their own machine, the
offline generator turns them into a reviewed batch, and the guarded staging
ingest publishes it. Those capture requests leave GridView through neither the
hardened client nor the Durable Object, so the Decision's "every" no longer
holds as written. This amendment records the second path, bounds it, and keeps
the two from sharing Jolpica's budget.

### A1.1 - Scope

| Rule | |
|---|---|
| Source | Jolpica only. OpenF1 has no capture path. |
| Client | The capture procedure in the Frozen Test APK runbook, step 2, run by hand by the operator. **No capture tool exists in this repository**; no Worker, cron trigger or CI runner captures. |
| Authorization | Each capture is separately authorized (DP-3). The procedure is never run in a loop or on a schedule. |
| Size | The six season-level requests plus one race classification per eligible round: at most 6 + the season's race count (29 for 2026's 23 races). The generator refuses any other URL set. |
| Credential | None. The capture sends no `Authorization` header, cookie or token. |

### A1.2 - Hardening, rule by rule

Some D2 rules are enforced in code when the capture is **replayed**: the
generator's replay transport answers the hardened `ProviderHttpClient` with the
recorded status, content type and body, so the client's own response checks
run on every recorded response. The rest are enforced by the procedure.

| D2 rule | How the operator capture meets it | Enforced by |
|---|---|---|
| D2.1, D2.2 origin and path | Every URL is built from the fixed base `https://api.jolpi.ca/ergast/f1/{season}`. The generator refuses any recorded URL outside that prefix, and any repeated, unrequested or missing one. | Code (generation) and procedure |
| D2.3 query encoding | Fixed literal queries (`?limit=100`) only. | Procedure |
| D2.4 GET only | `curl` issues `GET`; the replay refuses any other method. | Code (generation) and procedure |
| D2.6 no redirects | `curl` without `-L`, and `--max-redirs 0`; the procedure stops on any status but 200, a 3xx included. Any recording that is not HTTP 200 also refuses the capture at generation. | Code (generation) and procedure |
| D2.7 10-second timeout | `--max-time 10` per request. | Procedure |
| D2.8 no automatic retry | No `--retry`; the first non-200 answer or transport failure stops the capture, and the runbook forbids retrying in a loop. | Procedure |
| D2.9 headers | `Accept: application/json` and the reviewed constant `User-Agent`; nothing else. | Procedure |
| D2.10 content type | The recorded `Content-Type` passes through the client's check at replay. | Code (generation) |
| D2.11 2 MiB body cap | `--max-filesize 2097152` while capturing; at replay each body is read within its declared `byteLength`, itself capped at the client's 2 MiB. | Code (generation) and procedure |
| D2.12 JSON after the bounded read | The client parses each replayed body only after its bounded read. | Code (generation) |
| D2.13 429 | A 429 stops the capture; the capture is not re-run before the authorization allows it. `Retry-After` is not parsed. | Procedure |
| D2.14 no provider body in logs | Capture and batch stay outside the repository (generator path guard; `test/season-batch/tracked-data.test.ts`); responses and logs of the ingest carry no provider data. | Code and procedure |

### A1.3 - Pacing (the in-process limiter)

The Durable Object is not consulted. The capture paces itself: **one request in
flight, sequential, at least one second between requests** (`sleep 1` after
each). That is at most 1 request per second against Jolpica's 4, and at most 29
requests per capture against its 500 per hour. DP-9 named this "an in-process
limiter"; it is a property of the procedure, not of code, and the amendment does
not claim otherwise.

### A1.4 - Mutually exclusive with coordinated mode

The Durable Object's budget assumes it is GridView's only Jolpica client. Its
pacer admits a reservation every 260 ms; a concurrent capture would add up to
one request per second, which can exceed 4 per second in one rolling second.
The two paths are therefore never live together:

- the guarded ingest refuses `PROVIDER_MODE = coordinated` before reading the
  body (`provider-mode-coordinated`), so a capture has no use while staging is
  coordinated;
- no committed environment selects `coordinated` while the attribution record
  calls Jolpica `active`, because that record's public wording says no Worker
  retrieves Jolpica data (`test/contract/api-licensing-notice.test.ts`);
- the operator never captures while any deployed environment runs
  `coordinated`.

Selecting `coordinated` anywhere therefore needs a new decision that retires or
re-bounds this path, and new attribution wording.

### A1.5 - What does not change

D1, D2 and D3 hold unchanged for every request a Worker sends: the hardened
client and the Durable Object remain the only way a Worker can reach a
provider. Production never captures and never ingests. Nothing in this
amendment sends a request, authorizes a capture or deploys anything.

### Implementation status (2026-10-13)

The Frozen Test APK runbook's capture step now passes `--proto =https`,
`--max-redirs 0`, `--max-time 10`, `--max-filesize 2097152` and
`Accept: application/json`, and stops on any status but 200. A1.2's code-enforced rules already exist in the
generator (Implementation Plan §14.0.46). No capture was run for this
amendment.

## References

- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers KV write limits](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
- [Workers `fetch`](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Jolpica F1 documentation](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md)
- [OpenF1](https://openf1.org/)
- [ADR 0019](0019-formula-one-provider-legal-gate.md), [ADR 0020](0020-provider-source-observation-and-reconciliation.md), [ADR 0023 A4](0023-multi-source-provider-coordination.md#amendment-a4---operator-run-season-batches)
- [GridView_Frozen_Test_APK_Runbook.md](../operations/GridView_Frozen_Test_APK_Runbook.md) step 2
- [GridView_Provider_Evaluation.md](../technical/GridView_Provider_Evaluation.md) §9.1, §9.2, §11.4, §14.4
