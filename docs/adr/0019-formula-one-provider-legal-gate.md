# ADR 0019: The Formula 1 provider legal gate and the first inquiry candidates

- Status: Proposed
- Date: 2026-08-19 (revised the same day; see *Revision*)

## Revision

This ADR was first drafted proposing **Sportmonks** as the single candidate for
written legal inquiry. That proposal is **withdrawn**, superseded by a
product-constraint change recorded the same day: GridView's provider budget for
v1 is **EUR 0** and the application will carry **no monetisation of any kind**.

The decision below is the revised one. Sportmonks is rejected for v1 **on budget
grounds only** — not because it was found technically or legally unsuitable —
and is retained as the named fallback if that constraint is ever relaxed. The
earlier reasoning is preserved in the repository history and its evidence is
retained in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md)
§6.1 and §9.4.

## Context

Phase 9 replaces the mock backend provider with a real Formula 1 data source
(`GridView_Implementation_Plan.md` §14). `GridView_Backend_Scheme.md` §2 names
**API-Sports** as the leading technical candidate and §3 makes provider
selection an explicitly legal decision as well as a technical one: production
use is blocked until the intended use and any required data-publication rights
are confirmed in writing.

### The product constraints that govern the decision

| # | Constraint |
|---|---|
| C1 | Provider budget for v1 is **EUR 0** |
| C2 | GridView remains **free** while it relies on non-commercial data sources |
| C3 | **No monetisation**: no advertising, in-app purchases, subscriptions, affiliate links or sponsorship |
| C4 | Any future monetisation requires explicit written commercial permission from every affected provider, or migration to a provider whose licence permits it |
| C5 | **No live telemetry or live timing** is required |
| C6 | Freshness objective for **provisional** results, points and standings: **30-60 minutes after a session ends** |
| C7 | Freshness objective for **reconciled** data: **within 24 hours**, subject to provider availability |
| C8 | **Reliability and replaceability matter more** than in-session updates |

Two points must not be misread.

**C3 does not settle the licensing questions.** Removing monetisation makes the
NonCommercial question more favourable than it was, but it answers neither that
question nor the ShareAlike obligation, and it does not touch the decisive one:
whether serving normalized data through GridView's own public API is permitted
redistribution.

**C3 is not a new code removal.** Advertising was already absent from v1 before
this pass. [ADR 0018](0018-advertising-not-retained-for-v1.md) recorded that
GridView ships with no advertising SDK, no consent SDK, no ad unit and no ad
request, and the repository confirms it. C3 restates and hardens an existing
state.

### Three further reasons the decision must be taken deliberately

**1. The premise the existing documentation is written against is stale.**
`GridView_Implementation_Plan.md` §14.2 requires confirming "ad-supported use",
and `GridView_Backend_Scheme.md` §2, §3.1 and §7.3 assess candidates against an
"ad-supported GridView release". ADR 0018 superseded that, and C3 supersedes it
further: v1 has no revenue at all.

**2. The real question was never the advertising.** GridView fetches data
server-side on a schedule, normalizes it into its own contract, stores snapshots,
and serves them to a publicly distributed Google Play application through its
own public HTTP API. That is redistribution of normalized data by a public
service. It needs permission whether or not any money changes hands.

**3. The repository's own provider claims are unsourced.**
`GridView_Backend_Scheme.md` §3.1 asserts six specific things about API-Sports'
terms and §7.2 asserts six technical properties, none carrying a source URL or an
access date.

### What the Phase 9A research found

Recorded in full in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md).
The pass purchased nothing, contacted nobody, created no account, handled no
credential and implemented no adapter. It did make a small number of
**unauthenticated public `GET` requests** to validate the proposed mapping,
outside any live-session window, with no image or credential involved and no
response retained in the repository.

**A zero-cost dual-source model is technically viable.** Two sources agreed
exactly on the same event — the 2026 Hungarian Grand Prix — on winner, laps, race
duration, race points, constructor championship points, and **all 22 driver
championship totals**. That is the evidence the model rests on.

**But OpenF1's free tier is bounded by a clock, not a feature flag.** The project
states data is live from 30 minutes before a session starts until 30 minutes
after it ends, and only outside that window is it free. GridView's C6 objective
of 30-60 minutes therefore coincides *exactly* with the earliest moment free
access opens. There is no margin to do better without paying for a live feed the
product has decided it does not need.

**Both proposed sources are CC BY-NC-SA 4.0, and neither permits the intended
redistribution on its published text.** Both require written permission for it.
Attribution is required by both. Neither guarantees uptime, availability or
correctness; Jolpica says so explicitly and has announced its free rate limits
**will decrease**.

**Four of eleven constructors are named differently by the two sources** —
Alpine/Alpine F1 Team, Cadillac/Cadillac F1 Team, Racing Bulls/RB F1 Team, Red
Bull Racing/Red Bull. A curated mapping registry is therefore mandatory, which
`GridView_Backend_Scheme.md` §8.1 already requires.

**Both championship endpoints OpenF1 exposes are beta**, and neither source
exposes quota headers, update timestamps or `ETag`s.

**Every official API-Sports source remained unreachable** — eight hosts, all
HTTP 403 — so nothing about it is asserted, including whether a usable free tier
exists.

## Decision

**1. The Phase 9 legal gate is confirmed as a hard, blocking gate.** No Formula 1
data source is approved, selected for production or activated. Production
integration does not begin until **both** proposed projects confirm in writing
that GridView's architecture is permitted.

**2. Silence is not permission.** A free public API, an endpoint that responds,
the absence of authentication, or an open-source repository is **not** evidence
that GridView may publicly redistribute normalized Formula 1 data. An
open-source **code** licence in particular grants no rights to the underlying
data — Jolpica's own separation (Apache-2.0 code, CC BY-NC-SA 4.0 data) makes
that explicit.

**3. The proposed direction is a dual-source, zero-cost, post-session model.**

| Source | Role |
|---|---|
| **OpenF1** | *Provisional* post-session classification, points and championship state, fetched only after its free historical window opens |
| **Jolpica F1** | *Complete* season metadata, calendar, participants, circuits, historical depth, and *reconciled* final results and standings |

Both are candidates for **written legal inquiry**. Two separate inquiries are
prepared, one per project. **Both must be answered favourably.** A favourable
answer from only one does not unblock the model: OpenF1 alone cannot supply
complete metadata, constructor standings or pre-2023 history, and Jolpica alone
cannot plausibly meet the C6 objective.

**4. Sportmonks is rejected for v1 on budget grounds only.** Its lowest published
Formula 1 tier conflicts with C1. It was *not* found technically or legally
invalid — its terms were the only ones among the four that affirmatively permit
commercial use and explicitly allow distribution, transfer and storage. **It is
the named first fallback if C1 or C3 is relaxed** under C4.

**5. API-Sports stays unselected** while its current free availability, terms and
redistribution permission are all unverified.

**6. The freshness figures are GridView objectives, never provider guarantees.**
C6's 30-60 minutes and C7's 24 hours must never be described, in documentation
or in the product, as an SLA, a guarantee or a provider commitment. Neither
project offers one, and the actual post-race publication latency of Jolpica is
**unmeasured** — the feasibility check ran during the season's summer break.

**7. Provisional and reconciled data are distinguished throughout.** Every
synchronized record carries internal provenance and is in exactly one of two
states. **A reconciled snapshot is never replaced by an older or provisional
one.** Provider metadata does not leak into the public v1 DTO contract.

**8. No media or logo rights are inferred from any data source.** Both projects
expose URLs that look like usable media and are not — OpenF1's `headshot_url`,
`circuit_image` and `country_flag` all point at `media.formula1.com`. None is
fetched, stored or displayed. No media was downloaded during this pass.

**9. Future monetisation reopens the provider decision entirely.** C4 is
recorded here so a later revenue decision cannot be taken as an incremental
product change. It would require written commercial permission from both
projects or migration to a different source, and it would supersede this ADR.

**10. No production activation, and no year-round high-frequency polling.** No
adapter, credential, live provider mode, cron trigger or deployment follows from
this ADR. The mock provider is preserved permanently. The superseded static
scheduler model — roughly 415 upstream requests per day, every day of the year —
is explicitly withdrawn and must not be carried into Phase 9B; the event-aware
design replaces it at roughly 285 requests per **month** worst case.

## Consequences

**Phase 9 is gated on correspondence, not engineering.** Phase 9B cannot start
until both projects answer. The blocking actions are the user's:

| # | Required action |
|---|---|
| U1 | Review and approve or amend the two inquiry drafts (Provider Evaluation, Appendices A and B) |
| U2 | Send the OpenF1 inquiry |
| U3 | Send the Jolpica inquiry to `admin@jolpi.ca` or via GitHub Discussions |
| U4 | Decide the response window after which no reply is treated as **no permission** |
| U5 | Decide whether GridView independently pursues Formula 1 competition-data clearance, and whether legal review is accepted |
| U6 | Decide whether production gets a cron trigger, and at what granularity |
| U7 | Accept or revise C6 and C7 as objectives, knowing the reconciliation latency is unmeasured |
| U8 | Optionally, read `api-sports.io` in an ordinary browser |

**Phase 9B carries more structural work than the single-source model implied.**
The largest item is new: `fetchSeasonSource(season, jobs)` demands a whole season
from one call and **cannot express two sources with different roles and
different per-job failure outcomes**. A coordinator above two independent
adapters is required. Alongside it: no live provider mode, no production cron, no
event-window awareness, no curated identifier mapping registry, no outbound
hardening helper, untyped per-source call counting, no locally-modelled quota
state, and **no provenance or provisional/reconciled state in the local schema** —
which implies the first schema change since v2.

**The cost is zero and that is itself the principal risk.** There is no
subscription, no account and no payment method — and therefore **no
counterparty obligation of any kind**. The strongest achievable outcome is a
written statement from a volunteer project that reserves the right to change its
terms. That is materially weaker than a commercial agreement and is accepted
knowingly, mitigated by architecture rather than by contract: independent
adapters, fixture-backed contract tests, last-known-good public snapshots,
event-aware retry and circuit breaking, health and freshness monitoring, stale
indicators, identifier mapping isolated from public DTOs, periodic backups where
licensing permits, a documented manual recovery procedure, an annual provider and
licence review, and the ability to replace either source without an app release.

**Positive.** EUR 0 cost; no credential exists so none can leak; two independent
sources are genuine redundancy; the freshness objective is met at the earliest
moment the licence permits; and the request volume falls by roughly 98% against
the superseded model.

**Negative.** Two free community dependencies instead of one paid one; no SLA
from either; monetisation foreclosed while they are used; a beta dependency on
both championship endpoints; a mandatory curated mapping registry; and a legal
position that rests on goodwill rather than contract.

## Evidence required to move this ADR to Accepted

From **both** projects, in writing:

1. That GridView's architecture — scheduled server-side fetching outside any live
   window, normalization, snapshot storage, historical retention, and serving
   normalized data to a free, unmonetised, publicly distributed Google Play
   application through GridView's own free public API — is permitted.
2. That this is **not** prohibited redistribution under CC BY-NC-SA 4.0.
3. That a free, unmonetised, publicly distributed application is
   **non-commercial** under the NC term.
4. **What ShareAlike attaches to**: the app source, the backend source, the
   normalized database, exported datasets, or only adapted data.
5. **Attribution requirements** stated exactly — wording, placement, and any
   required licence link or notice.
6. Whether **small derived test fixtures** may be stored in a public repository.
7. Whether **cached historical data may be retained** if access later ends.
8. Whether **Formula 1 competition-data rights** remain GridView's separate
   responsibility.
9. Whether **future monetisation** would require separate written permission.

And additionally:

10. From OpenF1: that a fetch scheduled at **scheduled session end + 32 minutes**
    is reliably outside the live window, including for delayed or red-flagged
    sessions.
11. From Jolpica: whether **free 14-day-delayed database dumps** may be retained
    as a GridView backup.
12. A **measurement** of Jolpica's actual post-race publication latency against a
    real race weekend, validating or revising the C7 objective.
13. The approvals **recorded in project documentation**, per
    `GridView_Implementation_Plan.md` §14.2.

Items 1, 2 and 3 are individually blocking, **from both projects**. Item 8 may
require professional legal review rather than a project's answer.

## Rejection and fallback conditions

**This ADR is Rejected, and the dual-source model is dropped, if:**

- Either project answers that GridView's public normalized API is **not**
  permitted redistribution.
- Either project answers that a free, publicly distributed app is **not**
  non-commercial in its view.
- ShareAlike is confirmed to reach GridView's normalized database or public API
  output **and** the product owner will not accept licensing GridView's own
  output under CC BY-NC-SA 4.0.
- No usable answer arrives within the window decided in U4. **Silence is a
  rejection, not a default yes.**

**Fallback order, in sequence:**

1. **Single-source Jolpica**, if Jolpica permits but OpenF1 does not. GridView
   loses the 30-60 minute provisional objective and falls back to reconciliation
   latency only. C6 would have to be revised or withdrawn. This is a **viable
   degraded product**, not a failure.
2. **API-Sports**, once its terms are readable and only if a free tier permits
   the architecture at zero cost.
3. **Sportmonks**, only if C1 or C3 is relaxed under C4 — at which point its
   unresolved distribution-versus-resale question becomes the priority, together
   with its unresolved pricing conflict.
4. **An enterprise licensed feed**, accepting materially higher cost for
   contractual rights and an SLA. `GridView_Backend_Scheme.md` §7.3 already
   anticipates this path, and the provider adapter keeps the migration invisible
   to the mobile API.
5. **If no source can be cleared**, Phase 9 stops and becomes a product decision
   about whether GridView can ship live competition data at all.

**Self-hosting is not a fallback.** It may be *investigated* as a contingency,
but an open-source server implementation grants no rights to the Formula 1 data
it serves, GridView would still have to source that data, and
`GridView_Backend_Scheme.md` §2 excludes a production scraper.

**If the fallback order is exhausted, no source is silently adopted.** The mock
provider stays, production stays at `PROVIDER_MODE = "none"`, and the question
returns to the user.

## Alternatives considered

**Pay for a data plan.** Rejected by C1. Recorded rather than argued: this is a
product constraint, not an engineering conclusion, and §6.1 of the evaluation
preserves the case for revisiting it.

**Pay OpenF1's Sponsor tier for live data.** Rejected twice over: by C1, and by
C5 — GridView does not need live timing, so the paid tier would buy only the
capability the product has decided not to use.

**Use OpenF1 alone.** Rejected. It has no constructor standings that could be
confirmed, no complete season metadata, no pre-2023 history, no stable driver or
team identifier, and its championship endpoints are beta and race-session-only.

**Use Jolpica alone.** Not rejected — retained as fallback 1. It covers every v1
resource with stable identifiers and 1950-onward depth. It is not the *first*
choice only because its reconciliation latency is unmeasured and probably cannot
meet the C6 objective on its own.

**Treat the absence of monetisation as settling the NonCommercial question and
proceed without asking.** Rejected. It is the strongest argument GridView has,
but it is GridView's argument, not the licensors'. Acting on it would be
treating silence as permission.

**Assume the open-source repositories grant data rights.** Rejected explicitly,
because it is a tempting and specific error. Jolpica publishes Apache-2.0 code
and CC BY-NC-SA 4.0 data, which demonstrates the separation rather than
resolving it.

**Build the adapters behind a disabled flag while waiting.** Rejected.
`GridView_Backend_Scheme.md` §3.3 permits development against mocks and
fixtures, which is what exists. Building two adapters, a coordinator, a mapping
registry and a schema change before knowing whether either source may be used
would create pressure to justify the sunk work.

**Contact only one project first.** Rejected. Both answers are required, and
serialising them doubles the calendar time on a gate that already has no
committed response time.

## References

- [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) — product constraints, evidence, classifications, feasibility check, dual-source design, quota model, sustainability assessment, both unsent inquiries and the code audit
- [`0018-advertising-not-retained-for-v1.md`](0018-advertising-not-retained-for-v1.md) — advertising is not retained for v1
- [`0005-snapshot-conflict-and-freshness.md`](0005-snapshot-conflict-and-freshness.md) — the existing snapshot-conflict rule the provisional/reconciled rule composes with
- [`0002-replace-spring-boot-backend-with-cloudflare-edge-api.md`](0002-replace-spring-boot-backend-with-cloudflare-edge-api.md) — the edge architecture the sources sit behind
- `GridView_Backend_Scheme.md` §2, §3, §7, §8.1, §14-§18, §23.1
- `GridView_Implementation_Plan.md` §14
- `GridView_Backend_Operations.md` — quota behaviour and the outstanding real-provider prerequisites
- `GridView_Media.md` — the separate media rights and publication process
