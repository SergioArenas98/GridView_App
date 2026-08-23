# ADR 0021: Hardened outbound provider boundary and Durable Object rate limiter

- Status: Accepted
- Date: 2026-08-23

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
| D1.9 | The reservation timestamp is the Durable Object's own clock. A caller cannot choose it. |
| D1.10 | The object never sleeps, retries or holds a request until capacity returns. |
| D1.11 | A binding, dispatch or storage failure resolves to `unavailable`, and the boundary then issues **no** request. |
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
- The Durable Object is declared and validated but **not provisioned**. Until a
  namespace is bound, every reservation resolves to `unavailable` and no
  request can be issued — the fail-closed default.
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

## References

- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers KV write limits](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
- [Workers `fetch`](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Jolpica F1 documentation](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md)
- [OpenF1](https://openf1.org/)
- [ADR 0019](0019-formula-one-provider-legal-gate.md), [ADR 0020](0020-provider-source-observation-and-reconciliation.md)
- [GridView_Provider_Evaluation.md](../technical/GridView_Provider_Evaluation.md) §9.1, §9.2, §11.4, §14.4
