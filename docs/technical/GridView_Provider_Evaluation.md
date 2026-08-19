# GridView - Formula 1 Data Provider Evaluation

## Document information

- Product: GridView
- Document type: Provider evaluation and legal-gate preparation
- Version: 0.2
- Status: Draft - **no provider is approved**
- Phase: 9A (provider evaluation and legal-gate preparation)
- Related documents:
  - [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3, §7, §14-§18
  - [`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14
  - [`GridView_Backend_Operations.md`](GridView_Backend_Operations.md)
  - [`../adr/0019-formula-one-provider-legal-gate.md`](../adr/0019-formula-one-provider-legal-gate.md)
  - [`../adr/0018-advertising-not-retained-for-v1.md`](../adr/0018-advertising-not-retained-for-v1.md)
- Research access date: **2026-08-19**
- Document date: 2026-08-19

### Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-19 | First evaluation. Four candidates; Sportmonks proposed as the first written-inquiry candidate. |
| 0.2 | 2026-08-19 | **Superseded by a product-constraint change.** A zero-provider-budget, no-monetisation constraint was recorded (§2). Sportmonks is rejected for v1 on budget grounds only. The proposal becomes a **dual-source, zero-cost, post-session model using OpenF1 (provisional) and Jolpica (reconciled)**, validated by an unauthenticated feasibility check (§8) and specified as a synchronisation design (§10). Two provider-specific inquiries replace the single Sportmonks draft. |

---

## 0. Stop statement

**No Formula 1 data provider is approved, selected for production, subscribed to,
contacted or activated.**

This document is a research and preparation artefact only. Producing it did not
send any message, submit any form, create any account, start any trial, purchase
any plan, accept any terms, request or handle any API key, or call any
authenticated provider endpoint. No production adapter exists and none is
authorized by this document.

A small number of **unauthenticated public `GET` requests** was made under the
explicit authorisation in §8.1, solely to validate the proposed data mapping. No
credential, cookie or token was used; no paid or live endpoint was touched; no
image was downloaded; no response was retained inside the repository.

Everything below is evidence and analysis assembled to make a later decision
possible. It is not legal advice. The provider question is a documented product
and licensing gate that requires written confirmation from each project and,
where the answers remain ambiguous, professional legal review.

---

## 1. Scope

### 1.1 In scope

- Reading the governing GridView documentation and the existing Edge API
  provider abstraction.
- Researching current public provider documentation, pricing and terms.
- A minimal unauthenticated feasibility check against public endpoints.
- Classifying each intended use against published evidence.
- Designing, on paper, a dual-source synchronisation policy.
- Estimating GridView's expected upstream request volume.
- Recommending candidates for **written legal inquiry**.
- Drafting, but not sending, those inquiries.

### 1.2 Out of scope

- Any purchase, account, trial, credential, sponsorship or provider contact.
- Any production provider adapter, provider DTO, mapping or authentication code.
- Any change to Worker configuration, secrets, routes, cron schedules or
  environment variables.
- Any media, image, headshot or logo acquisition or publication.
- Self-hosting of either project (contingency only, §12.5).

---

## 2. Product constraints

These constraints are **non-negotiable inputs** to the evaluation. They were
recorded after version 0.1 and they are what supersede its recommendation.

| # | Constraint |
|---|---|
| C1 | **Provider budget for v1 is EUR 0.** No paid data plan, no sponsorship tier, no supporter tier. |
| C2 | GridView **remains free** for as long as it relies on non-commercial data sources. |
| C3 | **No monetisation of any kind**: no advertising, no in-app purchases, no paid subscriptions, no affiliate links, no sponsorship, no other direct revenue. |
| C4 | Any future monetisation requires **either** explicit written commercial permission from every affected provider, **or** migration to a provider whose licence permits it. Monetisation reopens the provider decision entirely. |
| C5 | GridView **does not need live telemetry or live timing** during a session. |
| C6 | Freshness objective for **provisional** session results, points and standings: **30-60 minutes after a session ends**. |
| C7 | Freshness objective for **reconciled / final** data: **within 24 hours**, subject to provider availability. |
| C8 | **Reliability and replaceability matter more** than obtaining updates during a session. |

### 2.1 Two clarifications that must not be misread

**C6 and C7 are GridView objectives, not provider guarantees.** Neither OpenF1
nor Jolpica publishes a service-level agreement, an uptime commitment or a
correctness guarantee, and both explicitly disclaim them. The 30-60 minute and
24-hour figures are targets GridView aims at and must degrade gracefully from.
They must never be described, in documentation or in the product, as an SLA, a
guarantee, or a provider commitment.

**Removing advertising does not settle the licensing questions.** C3 makes the
NonCommercial question *more favourable* than it was in version 0.1 — but it
does not answer it, and it does not touch the **ShareAlike** obligation or the
question of whether serving normalized data through GridView's own public API is
permitted redistribution. Those remain open for both candidates (§7, §13.1).

**Advertising is not being removed by this decision.** It was already absent
from v1 before this pass: [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md)
records that GridView ships with no advertising SDK, no consent SDK, no ad unit
and no ad request, and the repository confirms it. C3 restates and hardens an
existing state; it is not a new code removal.

---

## 3. Intended architecture being assessed

The legal questions in this document are about **this specific architecture**,
not about "using an F1 API" in the abstract. Both projects are being asked to
confirm the architecture as described here.

```text
                        Cloudflare (server side)
  OpenF1   --(1a)-->                                     no credential is
  Jolpica  --(1b)-->  GridView sync job  --(2)-->  KV    used or held by
                      (Cron Trigger)                |    either adapter
                                                   (3)
                                                    v
                                    GridView public API (/v1/...)
                                                    |
                                                   (4)
                                                    v
                                    GridView Android app (Google Play, free)
```

1. **Scheduled, server-side fetch only, after the session has ended.**
   - (1a) **OpenF1** supplies *provisional* post-session data, fetched only
     after its free historical window opens.
   - (1b) **Jolpica** supplies *complete metadata, historical coverage and
     reconciled final results*.
   - Neither project is ever called from the mobile application.
2. **Validate, normalize, map.** Responses are validated, normalized into
   GridView's own domain model, and mapped from provider identifiers to
   GridView's own stable public identifiers
   ([`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §8). No provider
   DTO reaches the public contract.
3. **Serve normalized snapshots.** The public GridView API serves stored,
   normalized snapshots. Public read traffic performs **zero** upstream requests
   ([`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §14.2, enforced
   by the test `public reads consume no provider quota`).
4. **Publicly distributed app.** The Android client is intended for public
   distribution on Google Play, free of charge, with no monetisation (C1-C3).

Additional properties material to the assessment:

| Property | Statement |
|---|---|
| Credentials | Neither candidate requires authentication for the access GridView needs. No API key would exist, therefore none can be shipped, logged or leaked. |
| Upstream volume | Independent of the number of app users or app requests. Driven only by the session calendar. |
| Live data | **Never fetched.** GridView does not call OpenF1 inside its live window, and neither project is used for live timing or telemetry. |
| Monetisation | None, now or while these sources are used (C1-C4). |
| Historical retention | Intended, if permitted. Snapshots are versioned and retained. |
| Provider images and logos | **Not used.** Both projects expose media URLs pointing at third-party hosts; none is treated as cleared. See §7.4. |
| Attribution | Will be displayed in-app and in documentation, in whatever form each project requires. |
| Open-sourcing | GridView may later publish adapter code. Asked about explicitly, because ShareAlike may bear on it. |
| Automated tests | Continue to use the mock provider and small derived fixtures. The mock provider is preserved permanently. |

GridView must **not** be described to either project as a private prototype. The
intended public Google Play distribution and the server-side redistribution of
normalized data through GridView's own public API are the material facts.

---

## 4. Current Phase 9 requirements

Extracted from
[`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14 and
[`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3, §7, §14-§18.

### 4.1 Legal gate

| # | Requirement | Source |
|---|---|---|
| L1 | Provider contract confirmed | Plan §14.2 |
| L2 | The intended mobile-app use is permitted | Scheme §3.2 |
| L3 | Whether advertising changes the applicable rights | Scheme §3.2 |
| L4 | Caching of normalized data is permitted | Plan §14.2, Scheme §3.2 |
| L5 | Redistribution terms for GridView's own public API | Plan §14.2, Scheme §3.2 |
| L6 | Historical snapshot retention is permitted | Scheme §3.2 |
| L7 | Attribution requirements | Plan §14.2, Scheme §3.2 |
| L8 | Image and logo exclusions | Plan §14.2, Scheme §3.2 |
| L9 | Approval recorded in project documentation | Plan §14.2 |

Under the zero-cost model, **L1 has no counterparty in the ordinary sense**:
there is no subscription and no commercial agreement to sign. What replaces it
is a written statement from each project that the use is permitted under its
published licence. That is weaker than a contract and is recorded as such
(§14, R2).

### 4.2 Technical and operational requirements

| # | Requirement | Source |
|---|---|---|
| T1 | Quota and rate-limit capture | Scheme §16 |
| T2 | Provider failure preserves the previous snapshot | Plan §14.8, Scheme §18.1 |
| T3 | Public traffic remains independent of provider request volume | Plan §14.5, Scheme §14.2 |
| T4 | No provider DTO leaks into the GridView public contract | Plan §14.8, Scheme §7.1 |
| T5 | The mock provider is preserved for automated tests | Plan §14.6 |
| T6 | All v1 resources supplied reliably | Plan §14.8 |
| T7 | Provider IDs must not become GridView public IDs | Scheme §7.2, §8.1 |
| T8 | Reserve quota for manual recovery; alert on quota thresholds | Scheme §16.1 |

**T1 is not satisfiable as written by either candidate.** Neither exposes
quota headers (§8.6). Daily and per-minute limits must be modelled locally from
published limits rather than read from responses.

### 4.3 Product reconciliation

[`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14.2
requires confirming **"ad-supported use"**, and
[`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §2, §3.1 and §7.3
assess candidates against an **"ad-supported GridView release"**. Those
statements predate [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md)
and are now doubly stale: v1 has no advertising, and under C3 v1 has no
monetisation of any kind.

**Reconciled position.** The gate is assessed against a free, unmonetised,
publicly distributed application that redistributes normalized data through its
own public API. The §14.2 wording is read as *"confirm the intended use, which
for v1 is free and unmonetised, and separately establish whether any future
monetisation would change the answer."*

---

## 5. Evidence classification method

Every legal-use question is classified as exactly one of:

| Classification | Meaning |
|---|---|
| `Explicitly permitted` | An official project source states the use is allowed. |
| `Explicitly prohibited` | An official project source states the use is not allowed. |
| `Written permission required` | An official project source states the use requires contacting the project or obtaining consent. |
| `Not stated or ambiguous` | No official source addresses it, or official sources are unclear or conflicting. |
| `Not applicable` | The question does not arise for this project or this use. |

**Silence is never permission.** None of the following is treated as evidence
that GridView may publicly redistribute normalized Formula 1 data:

- a free public API; an endpoint that responds; a request that succeeds; the
  absence of authentication; an open-source repository; a permissive **code**
  licence; a paid tier existing; a free tier existing.

An open-source server implementation in particular **does not** grant rights to
the underlying Formula 1 data it serves. Code licence and data licence are
separate questions and are treated separately throughout.

Where official sources conflict, the contradiction is recorded rather than
resolved in the convenient direction.

---

## 6. Candidates

| Provider | Role under the proposal | Evidence status |
|---|---|---|
| **OpenF1** | **Proposed provisional fast source** — post-session results, points and championship state, fetched after its free historical window opens | Primary sources retrieved; feasibility-checked |
| **Jolpica F1** | **Proposed complete and reconciled source** — season metadata, calendar, drivers, constructors, circuits, historical coverage, reconciliation and final results | Primary sources retrieved; feasibility-checked |
| Sportmonks | **Rejected for v1 — budget only** (§6.1) | Primary sources retrieved in v0.1; retained as evidence |
| API-Sports | **Unselected** — free availability, terms and redistribution permission all unverified (§6.2) | Official sources unreachable |

### 6.1 Sportmonks: rejected for v1, on budget grounds only

Sportmonks was the preferred inquiry candidate in version 0.1. It is rejected
for v1 because its lowest published Formula 1 tier is EUR 69-79 per month
(§9.4), which conflicts irreconcilably with C1 (budget EUR 0).

**This is not a finding that Sportmonks is technically or legally unsuitable.**
The opposite is closer to true, and the record should be preserved accurately:

- Its terms are the only ones among the four that **affirmatively permit
  commercial use** and state that "distribution, transfer, and storage" of the
  data is allowed.
- Its media position — logos and photos are the copyright of their owners and
  the customer must arrange proof of intellectual property and attribute them —
  already matches GridView's own documented assumption.
- Its data coverage includes driver and constructor standings, sessions and
  classifications.

Its one decisive legal ambiguity (permitted distribution versus prohibited
resale) and its pricing conflict were never resolved, because it was never
contacted.

**Sportmonks is therefore the natural first candidate to revisit if C1 or C3 is
ever relaxed** — for example if monetisation is reconsidered under C4. That is
recorded rather than discarded.

### 6.2 API-Sports: still unselected and still unverified

Every official API-Sports host returned **HTTP 403** to every retrieval method
available on 2026-08-19: `api-sports.io` (root, `/terms`, `/pricing`,
`/documentation/formula-1/v1`, `/sports/formula-1`),
`www.api-football.com/pricing`, `dashboard.api-football.com` and
`v1.formula-1.api-sports.io`. The responses are bot mitigation, not
authentication; nothing was logged into and no credential was presented.

Consequently **no API-Sports statement is asserted anywhere in this document**,
including any statement about whether a free tier exists, what it permits, or
whether redistribution is allowed. It stays unselected until someone reads the
terms and pricing in an ordinary browser.

**This also invalidates the repository's existing API-Sports claims as
evidence.** [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3.1
asserts six specific things about API-Sports terms and §7.2 asserts six
technical properties. None carries a source URL or an access date and none could
be verified. They are **unverified legacy assertions**, not findings, and are
flagged as such in the Backend Scheme itself.

---

## 7. Legal-evidence classification

Classifications are per project, per intended use, against the architecture in
§3 and the constraints in §2. Sources are listed in §13.

### 7.1 OpenF1

| # | Intended use | Classification | Basis |
|---|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` | Distribution channel is not addressed; the commercial character of the use is what the licence turns on. |
| 2 | Free, unmonetised v1 | `Not stated or ambiguous`, **leaning permitted** | Stated intended use is "educational purposes, personal learning projects, research, and non-commercial fan engagement". Under C1-C3 GridView is unmonetised, which sits far closer to that description than v0.1's position did — but the project does not state that a publicly distributed free app qualifies, and silence is not permission. |
| 3 | Any future monetisation | `Explicitly prohibited` without a separate licence | CC BY-NC-SA 4.0; NC excludes use primarily directed toward commercial advantage or monetary compensation. C4 already treats this as reopening the decision. |
| 4 | Server-side caching of normalized data | `Not stated or ambiguous` | Not addressed. |
| 5 | Normalization and derived fields | `Not stated or ambiguous` | Not addressed for the act itself, but **ShareAlike** applies to the result: adaptations must be shared under the same licence. |
| 6 | Public redistribution via GridView's own API | `Written permission required` | **Decisive.** Redistribution of an adaptation is constrained by BY-NC-SA, and official text directs "other use cases" to contact the project to "discuss appropriate licensing". |
| 7 | Historical retention | `Not stated or ambiguous` | Not addressed. Historical coverage itself begins at 2023. |
| 8 | Retention if access later ends | `Not stated or ambiguous` | Not addressed. |
| 9 | Display of results, points and championship state | `Not stated or ambiguous` | Permitted within the NC licence; the NC status of GridView's use is the open question. |
| 10 | Attribution requirement | `Explicitly permitted`, with attribution **required** | BY term of CC BY-NC-SA 4.0. Exact wording and placement not specified — asked in Appendix A. |
| 11 | Small derived test fixtures in a public repository | `Not stated or ambiguous` | Not addressed. Asked in Appendix A. |
| 12 | Open-sourcing GridView adapter code | `Not stated or ambiguous` | The repository's own LICENSE is CC BY-NC-SA 4.0, which is a content licence rather than a software licence; what that implies for a downstream adapter is unclear. Asked in Appendix A. |
| 13 | Termination and deletion obligations | `Not stated or ambiguous` | Not addressed. |
| 14 | Usage-reporting requirements | `Not applicable` | No account and no reporting for free historical access. |
| 15 | Images, headshots and logos | `Explicitly prohibited` to treat as cleared | The project states it is unofficial and does not claim ownership of Formula 1 data, trademarks or broadcasts. Media URLs it exposes point at `media.formula1.com` (§7.4). |
| 16 | Geographic restrictions | `Not stated or ambiguous` | Not addressed. |
| 17 | Formula 1 rights remain GridView's responsibility | `Explicitly` so | Unofficial, community-operated, not associated with or endorsed by Formula One World Championship Limited, and claiming no ownership of F1 data, trademarks or broadcasts. |

### 7.2 Jolpica F1

| # | Intended use | Classification | Basis |
|---|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` | Not addressed; the commercial character governs. |
| 2 | Free, unmonetised v1 | `Not stated or ambiguous`, **leaning permitted** | "The API is freely available for **non-commercial use**." Under C1-C3 GridView is unmonetised. The project does not state that a publicly distributed free app qualifies. |
| 3 | Any future monetisation | `Written permission required` | "For commercial usage, please contact us via `admin@jolpi.ca`". |
| 4 | Server-side caching of normalized data | `Explicitly permitted` and encouraged | The rate-limit guide's first recommendation for higher throughput is "Implement a cache to store results." |
| 5 | Normalization and derived fields | `Not stated or ambiguous` | Not addressed for the act itself; **ShareAlike** (CC BY-NC-SA 4.0) applies to the result. |
| 6 | Public redistribution via GridView's own API | `Written permission required` | **Decisive.** Constrained by BY-NC-SA; commercial usage is directed to the contact address, and whether GridView's API is "commercial" is exactly what is unclear. |
| 7 | Historical retention | `Not stated or ambiguous` | Not addressed. Coverage extends to 1950. |
| 8 | Retention if access later ends | `Not stated or ambiguous` | Not addressed. Asked in Appendix B. |
| 9 | Display of standings, results, schedules | `Not stated or ambiguous` | Permitted within the NC licence; NC status is the open question. |
| 10 | Attribution requirement | `Explicitly permitted`, with attribution **required** | BY term of CC BY-NC-SA 4.0; the terms link to the licence deed. Exact wording and placement not specified — asked in Appendix B. |
| 11 | Small derived test fixtures in a public repository | `Not stated or ambiguous` | Not addressed. Asked in Appendix B. |
| 12 | Open-sourcing GridView adapter code | `Not stated or ambiguous` | The **code** repository is Apache-2.0 while the **data** is CC BY-NC-SA 4.0 — a clean separation that makes the question about adapted data, not about code. Asked in Appendix B. |
| 13 | Termination and deletion obligations | `Not stated or ambiguous` | The terms reserve the right to block for abuse and to change the terms; deletion obligations are not stated. |
| 14 | Usage-reporting requirements | `Explicitly` required, in a limited form | A custom `User-Agent` identifying the application and version is mandatory. |
| 15 | Images, headshots and logos | `Not applicable` | Jolpica supplies no images or logos — only Wikipedia article URLs (§7.4). |
| 16 | Geographic restrictions | `Not stated or ambiguous` | Not addressed. |
| 17 | Formula 1 rights remain GridView's responsibility | `Not stated or ambiguous` | Not addressed directly; the terms disclaim all warranties and liability. |
| 18 | Database dumps under the free tier | `Explicitly permitted` for non-commercial use | Free dumps are published on a delay and require no authentication; the **Supporter** tier, which licenses dumps for commercial use, requires payment and is excluded by C1. |

### 7.3 Cross-provider summary

| Intended use | OpenF1 | Jolpica | Sportmonks (rejected, C1) | API-Sports |
|---|---|---|---|---|
| Free unmonetised public app | ambiguous, leaning permitted | ambiguous, leaning permitted | permitted | unverified |
| Server-side caching | ambiguous | **permitted** | permitted | unverified |
| Public redistribution via GridView's API | **written permission required** | **written permission required** | ambiguous | unverified |
| Future monetisation | prohibited without licence | written permission required | permitted in principle | unverified |
| Historical retention | ambiguous | ambiguous | ambiguous | unverified |
| Attribution | required | required | required for media | unverified |
| Images and logos | must not be treated as cleared | not applicable | excluded, own rights required | unverified |
| F1 competition rights are GridView's | **yes, explicitly** | ambiguous | leaning yes | unverified |

**No cell reads `Explicitly permitted` for public redistribution through
GridView's own API. That is the gate, and it remains open for both proposed
sources.** Removing monetisation improved the NonCommercial position; it did not
close the gate.

### 7.4 Media: nothing from either source is cleared

Both projects expose URLs that look like usable media and are not.

| Field | Source | Host | Treatment |
|---|---|---|---|
| `headshot_url` on `drivers` | OpenF1 | `media.formula1.com` | **Never fetched, never stored, never displayed.** |
| `circuit_image` on `meetings` | OpenF1 | `media.formula1.com` | Same. |
| `country_flag` on `meetings` | OpenF1 | `media.formula1.com` | Same. |
| `circuit_info_url` on `meetings` | OpenF1 | `api.multiviewer.app` | Third-party API, not a GridView dependency. Not used. |
| `url` on drivers, constructors, circuits, races | Jolpica | `en.wikipedia.org` | Article links, not media. Not treated as image rights; not fetched. |

An image URL being reachable through a data API establishes nothing about the
right to redistribute the image. GridView's media continues to follow its own
separate rights and publication process
([`GridView_Media.md`](GridView_Media.md)). **No media was downloaded during
this pass.**

---

## 8. Feasibility check

### 8.1 Authorisation and restrictions observed

A small number of public `GET` requests was explicitly authorised solely to
validate the proposed mapping. Every restriction was observed:

| Restriction | Compliance |
|---|---|
| No account, login, token, key, cookie or authenticated endpoint | No credential of any kind existed or was sent. |
| No paid or live OpenF1 endpoints | Only free historical endpoints were called. |
| No requests during an active live-session window | The target session ended **2026-07-26T15:00:00Z**, 24 days before the check at 2026-08-19T18:12Z — far outside the 30-minute live window. The 2026 season was in its summer break; no session was live. |
| Respect documented public rate limits | Requests were issued sequentially, roughly 25 in total across both projects, against limits of 3/s and 30/min (OpenF1) and 4/s burst and 500/hour (Jolpica). |
| No images, headshots or logos downloaded or retained | None was requested. |
| Raw responses kept outside the repository | Stored only in the session scratchpad; nothing was committed. |
| No personal identifiers or machine-specific paths in documentation | None appears below. |
| Stop if authentication, payment or permission is indicated | No such response was received; every call returned HTTP 200. |

### 8.2 Target event

The latest safely completed session was selected programmatically as the most
recent session whose end time was more than 30 minutes in the past:

| Field | Value |
|---|---|
| Event | Hungarian Grand Prix 2026 |
| OpenF1 `meeting_key` | 1291 |
| OpenF1 `session_key` | 11342 (Race) |
| Jolpica season / round | 2026 / 11 |
| Session end | 2026-07-26T15:00:00+00:00 |

### 8.3 OpenF1 — what it can supply

| Requirement | Result | Endpoint and evidence |
|---|---|---|
| Meeting identity | **Yes** | `/v1/meetings` — `meeting_key`, `meeting_name`, `meeting_official_name`, `location`, `country_*`, `circuit_key`, `circuit_short_name`, `circuit_type`, `gmt_offset`, `date_start`, `date_end`, `year`, `is_cancelled` |
| Session identity | **Yes** | `/v1/sessions` — `session_key`, `session_type`, `session_name`, `date_start`, `date_end`, `meeting_key`, `circuit_key`, `gmt_offset`, `year`, `is_cancelled`. 131 sessions returned for 2026, of which 10 carry `is_cancelled = true`. |
| Drivers | **Yes, with gaps** | `/v1/drivers` — 22 rows for the session. Carries `driver_number`, `full_name`, `first_name`, `last_name`, `name_acronym`, `broadcast_name`, `team_name`, `team_colour`. **No stable driver ID and no stable team ID.** `country_code` was `null` on every row and is documented as deprecated, to be removed at the end of the 2026 season. |
| Session classification / results | **Yes** | `/v1/session_result` — 22 rows carrying `position`, `driver_number`, `number_of_laps`, `points`, `dnf`, `dns`, `dsq`, `duration`, `gap_to_leader`. Disqualification, retirement and non-start are represented as explicit booleans. |
| Driver championship state | **Yes (beta)** | `/v1/championship_drivers` — 22 rows carrying `position_start`, `position_current`, `points_start`, `points_current`. Documented as **beta** and **only available for race sessions**. |
| Team championship state | **Yes (beta)** | `/v1/championship_teams` — 11 rows, same shape keyed by `team_name`. Documented as **beta** and **only available for race sessions**. |
| Stable identifiers for reconciliation | **Partial** | `meeting_key` and `session_key` are stable integers. Driver identity is `driver_number` only. **Team identity is a display string.** |
| Update timestamps | **No** | No `updated_at` field on any payload, and no `Last-Modified`, `ETag` or `Cache-Control` response header (§8.6). Reconciliation must use GridView's own fetch time. |

### 8.4 Jolpica — what it can supply

| Requirement | Result | Endpoint and evidence |
|---|---|---|
| Season and calendar | **Yes** | `/2026/races/` — 23 races, `MRData.total` 23. Each race carries `season`, `round`, `raceName`, `Circuit` with `Location` (lat, long, locality, country), `date`, UTC `time`, and optional `FirstPractice`, `SecondPractice`, `ThirdPractice`, `Qualifying`, `Sprint`, `SprintQualifying`. |
| Sprint weekends | **Yes** | Round 2 (Chinese Grand Prix) carries `Sprint` and `SprintQualifying` and omits `SecondPractice`/`ThirdPractice`, correctly modelling the sprint format. |
| Race results | **Yes** | `/2026/11/results/` — 22 rows with `position`, `positionText`, `points`, `grid`, `laps`, `status`, `Time.millis`, `FastestLap`, plus full `Driver` and `Constructor` objects. |
| Retirement / DSQ representation | **Yes** | Non-numeric `positionText` distinguishes classification outcomes; the Hungarian GP returned three `R` (Retired) entries with matching `status`. |
| Sprint results | **Yes** | `/2026/2/sprint/` — 22 rows in the same shape as race results, with sprint points. |
| Driver standings | **Yes** | `/2026/driverstandings/` — 22 rows at `round` 11 with `position`, `positionText`, `points`, `wins`, full `Driver`, and the driver's `Constructors`. |
| Constructor standings | **Yes** | `/2026/constructorstandings/` — 11 rows at `round` 11 with `position`, `points`, `wins`, full `Constructor`. |
| Drivers | **Yes** | `/2026/drivers/` — **31 rows** for 2026, against 22 on the grid at any one race. Strong evidence of substantial mid-season driver churn, which the season-scoped endpoint captures. |
| Constructors | **Yes** | `/2026/constructors/` — 11 rows with `constructorId`, `name`, `nationality`. |
| Circuits | **Yes** | `/2026/circuits/` — 24 rows with `circuitId`, `circuitName` and `Location`. Note 24 circuits against 23 races; the discrepancy is unexplained and is listed as a mapping check in §8.7. |
| Stable identifiers | **Yes** | Lower-case string slugs: `driverId` (`norris`, `antonelli`), `constructorId` (`mclaren`, `mercedes`), `circuitId` (`hungaroring`, `albert_park`). These are the natural anchor for GridView's own IDs. |
| Update timestamps | **No** | Ergast-compatible payloads carry none. `Last-Modified` equals `Date` on every response, so it reports generation time, not data-change time (§8.6). |
| Recoverability | **Yes** | Database dumps are published; the free non-commercial tier is available 14 days after upload with no authentication (§12.4). |

### 8.5 Cross-source agreement — the decisive result

The two sources were compared on the same event. This is the evidence that the
dual-source model is viable at all.

| Comparison | Result |
|---|---|
| **Race winner** | OpenF1 `session_result` position 1: `driver_number` 1, `points` 25, `number_of_laps` 70, `duration` 5996.18 s. Jolpica results position 1: Norris, `points` "25", `laps` "70", `Time.millis` "5996180". **5996.18 s = 5 996 180 ms — exact agreement.** |
| **Driver championship** | OpenF1 `championship_drivers` leader: `driver_number` 12, `points_current` 219, `position_current` 1. Jolpica `driverstandings` leader: Antonelli, `permanentNumber` "12", `points` "219", `position` "1". **Exact agreement.** |
| **Driver join, all 22 entries** | Joining `driver_number` to `permanentNumber` and comparing championship points: **22 / 22 matched exactly.** |
| **Constructor championship** | OpenF1 `championship_teams` leader: `Mercedes`, `points_current` 379. Jolpica `constructorstandings` leader: Mercedes, `points` "379". **Exact agreement.** |
| **Constructor join by name string** | **Only 7 / 11 matched.** |

**The constructor name mismatch is the single most important technical finding
of this check:**

| OpenF1 `team_name` | Jolpica `Constructor.name` |
|---|---|
| Alpine | Alpine F1 Team |
| Cadillac | Cadillac F1 Team |
| Racing Bulls | RB F1 Team |
| Red Bull Racing | Red Bull |

Four of eleven constructors are named differently by the two sources. **A
curated constructor mapping registry is therefore mandatory, not optional** —
which is exactly what
[`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §8.1 already
requires, and which §8.1 also requires to *fail validation* rather than silently
invent an identifier when an unknown entity appears.

### 8.6 Response headers — neither source supports conditional or quota-aware fetching

| Header | OpenF1 | Jolpica |
|---|---|---|
| `ETag` | absent | absent |
| `Last-Modified` | absent | present, but equal to `Date` — generation time, not data-change time |
| `Cache-Control` | absent | `max-age=600` |
| Rate-limit headers (`X-RateLimit-*` or equivalent) | **absent** | **absent** |
| `Retry-After` | not observed (no 429 encountered) | documented behaviour is HTTP 429; header not observed |

Consequences:

1. **Conditional requests are not available.** GridView cannot use `If-None-Match`
   or a meaningful `If-Modified-Since` against either source, so every
   reconciliation check is a full fetch. The request model in §11 assumes this.
2. **`QuotaState` cannot be populated from responses** (T1). Daily and
   per-minute figures must be modelled locally from published limits, and the
   `warningLevel` thresholds in Backend Scheme §16.1 must be driven by
   GridView's own counters.
3. Jolpica's `max-age=600` means a repeat request inside ten minutes may be
   served from cache, so polling faster than that gains nothing.

### 8.7 Mapping gaps, beta dependencies and derived logic required

| # | Gap | Consequence |
|---|---|---|
| M1 | **Constructor identity differs between sources** (§8.5) | Curated mapping registry required before any adapter can reconcile. |
| M2 | **OpenF1 has no stable driver or team identifier** | Driver joins must go through `driver_number`, scoped to a season. Numbers are reassigned between seasons and the champion's `#1` is a per-season choice, so the number is not a cross-season key. Jolpica's `driverId` slug is the only durable anchor. |
| M3 | **Both championship endpoints are beta** and documented as available for race sessions only | GridView's standings freshness path depends on a beta interface. Whether they populate for **sprint** sessions is `unverified`; OpenF1 types a sprint as `session_type = "Race"`, which makes it plausible but unconfirmed. |
| M4 | **OpenF1 conflates sprint and race in `session_type`** | `session_type` takes only `Practice`, `Qualifying`, `Race`. Sprint appears as `session_name = "Sprint"` with `session_type = "Race"`, and sprint qualifying as `session_name = "Sprint Qualifying"` with `session_type = "Qualifying"`. Derived logic on `session_name` is required to populate GridView's session type, which the local schema keys on (`UNIQUE(race_results gp + sessionType)`). |
| M5 | **OpenF1 sessions include pre-season testing** | `session_name` values include `Day 1`, `Day 2`, `Day 3`. These must be filtered out of the Grand Prix calendar. |
| M6 | **No update timestamps anywhere** (§8.6) | Provenance must record GridView's own fetch time; "has this changed?" can only be answered by content comparison. |
| M7 | **OpenF1 `country_code` on drivers is deprecated and was null** | Documented for removal at the end of the 2026 season. Must not be depended on. |
| M8 | **Jolpica `/2026/circuits/` returned 24 for 23 races** | Unexplained. Must be reconciled against the calendar rather than assumed one-to-one. |
| M9 | **Jolpica `/last` and `/next` are date-derived** | A public issue records `/current/last` returning the previous round on a Sunday evening after a race, reported and later fixed. Explicit `season/round` addressing should be preferred over `last`/`next`. |
| M10 | **Jolpica pagination** | `limit` defaults to 30 and caps at 100. Season-scoped queries must pass `limit` explicitly; a 23-race season and a 31-driver season both exceed the default. |
| M11 | **OpenF1 `date_end` is the scheduled end** | A red-flagged or delayed session may actually end later than `date_end`, which would move the live-window boundary. See §10.2. |

**No adapter was implemented.** These are recorded as Phase 9B requirements.

---

## 9. Cost and quota evidence

All figures as published on the access date **2026-08-19**. Prices and limits
are time-sensitive and must be re-verified before any decision.

### 9.1 OpenF1

| Tier | Price | Currency | Billing period | Limits |
|---|---|---|---|---|
| **Community (proposed)** | **Free** | - | - | All 18 endpoints; all historical sessions since 2023; JSON and CSV; **no authentication required**; up to **3 requests/second and 30 requests/minute** |
| Sponsor — **not used** | 9.90 | EUR | per month | Adds live data during sessions via REST, MQTT and WebSocket; 6 req/s and 60 req/min; up to 10 concurrent MQTT/WebSocket connections |

**The Sponsor tier is explicitly not used** (C1). GridView needs no live data
(C5), so the only thing the paid tier would buy is the capability GridView has
decided not to use.

**The free/paid boundary is a time window, not a feature flag.** The project
states: *"Data is considered live from 30 minutes before a session starts until
30 minutes after it ends. Outside of this window, data is classified as
historical and is free to access."* This single sentence is what makes the
proposal work and what constrains it — see §10.2.

No daily or monthly cap is published. Overage behaviour is `unverified`.

### 9.2 Jolpica

| Tier | Price | Currency | Billing period | Limits |
|---|---|---|---|---|
| **Unauthenticated public access (proposed)** | **Free** | - | - | Burst **4 requests/second**; sustained **500 requests/hour**; HTTP 429 on breach; mandatory identifying `User-Agent` |
| API token access | Not yet available | - | - | "Currently in the process of implementing"; will provide higher limits |
| Free database dumps | **Free** | - | - | Published **14 days after upload**; non-commercial; no authentication |
| Supporter dumps — **not used** | Ko-fi supporter | - | - | Latest dumps immediately; **licensed for commercial use**; API key required |

**The Supporter tier is explicitly not used** (C1). It is nonetheless a material
finding: it means Jolpica has a stated commercial-licensing path for its
database dumps, which is directly relevant if C4 is ever invoked.

Published limits are stated to be subject to change and **expected to decrease**
as token access rolls out. This is a planned reduction, not a risk that might
not materialise, and §12 treats it accordingly.

### 9.3 Combined v1 cost

**EUR 0 per month**, satisfying C1. No account, no payment method, no trial and
no subscription is required for anything GridView proposes to use.

### 9.4 Sportmonks — retained for reference only

Rejected under C1. Recorded because it is the fallback if monetisation is ever
reconsidered: Full Season F1 at **EUR 69/month** (or EUR 830 billed yearly),
excluding VAT, with 2,000 API calls per hour per endpoint on the product page;
the Motorsport API standings documentation states **EUR 79/month** with 3,000
API calls per hour. **These two official pages conflict**, and the conflict was
never resolved because the provider was never contacted.

### 9.5 API-Sports

**Unverified.** No official pricing page could be retrieved (§6.2). No plan
name, price, currency, billing period, quota or free-tier claim is asserted.

### 9.6 Quota headers

Neither proposed source exposes them (§8.6). This is a documented shortfall
against requirement T1 and is carried into §14 as a risk.

---

## 10. Proposed dual-source synchronisation policy

**Design only. Nothing in this section is implemented, and no cron trigger,
provider mode, binding or route was created or changed.**

### 10.1 Roles

| Source | Role | Never used for |
|---|---|---|
| **OpenF1** | *Provisional* post-session classification, points and championship state | Live timing, telemetry, in-session data, media |
| **Jolpica** | *Complete* season metadata, calendar, participants, circuits, historical depth, and *reconciled* final results and standings | Live or near-live data |

Every stored record is in exactly one of two states: **provisional** (last
written from OpenF1) or **reconciled** (last written from Jolpica). The public
contract exposes freshness semantics that already exist; the provisional and
reconciled distinction is internal unless the existing v1 contract already has a
field for it.

### 10.2 The live-window boundary is the hard constraint

OpenF1 classifies data as live from **30 minutes before** a session starts until
**30 minutes after** it ends. GridView must never fetch inside that window.

Three design rules follow:

1. **The earliest permitted provisional fetch is `scheduled_end + 30 minutes`.**
   GridView's C6 objective of 30-60 minutes is therefore *exactly* aligned with
   the earliest moment free access opens. There is no room to be earlier, and
   trying to be would mean using the paid live feed.
2. **A safety margin is mandatory.** The first attempt is scheduled at
   **+32 minutes**, not +30, so that clock skew, boundary rounding or an
   inclusive interpretation of "30 minutes after" can never place a request
   inside the live window.
3. **`date_end` is a *scheduled* end (M11).** A red-flagged or delayed session
   may genuinely end later, which moves the real boundary. GridView schedules
   from the scheduled end plus margin, and if the first attempt returns data
   that is absent or obviously incomplete, it backs off rather than retrying
   tightly — an incomplete response is a signal the session may have overrun.

### 10.3 Provisional lifecycle — OpenF1

Triggered only for **polled sessions**: Qualifying, Sprint Qualifying, Sprint
and Race. Practice sessions are not polled for results.

| Attempt | Offset from scheduled session end |
|---|---|
| 1 | +32 minutes |
| 2 | +35 minutes |
| 3 | +45 minutes |
| 4 | +60 minutes |

**Stop early.** The sequence terminates as soon as a response is *complete and
internally consistent*, defined as all of:

- a classification row exists for every driver listed for the session;
- positions form a contiguous sequence from 1 with no duplicates, once `dnf`,
  `dns` and `dsq` entries are accounted for;
- points are present and non-negative on every classified row;
- for race sessions, `championship_drivers` and `championship_teams` return rows
  for every driver and team, and `points_current` is greater than or equal to
  `points_start` for every entry.

If attempt 4 still fails the check, **no provisional write occurs**. The
previous snapshot stays published and the resource waits for Jolpica
reconciliation. A failed provisional pass is never an outage.

### 10.4 Reconciliation lifecycle — Jolpica

Triggered after the same polled sessions, and independently of whether the
provisional pass succeeded.

| Check | Offset from scheduled session end |
|---|---|
| 1 | +2 hours |
| 2 | +6 hours |
| 3 | +12 hours |
| 4 | +24 hours |

Then, if still unreconciled, **daily** until reconciled or until the next event
week begins, at which point the resource is marked unreconciled and left alone.
There is no aggressive polling and no tight retry loop at any point.

Jolpica also runs on a slow independent cadence for resources that have nothing
to do with a session: calendar daily, participants and circuits weekly,
standings daily during the season (which is what catches a penalty applied days
after a race).

### 10.5 No polling during a session, and no year-round high-frequency scheduler

**Explicit correction of the superseded model.** Version 0.1 documented that the
*implemented* scheduler in `services/edge-api/src/sync/scheduler.ts` uses fixed
intervals with no event awareness — `standings` and `results` every 15 minutes —
which under a 15-minute cron would issue roughly **415 upstream requests per
day, every day of the year**, polling at race-day cadence in February.

That model is superseded and must not be carried into Phase 9B. The design here
is event-driven: outside a session's post-session windows, only the slow
metadata cadence in §10.4 runs. §11 quantifies the difference.

There is **no polling at all while a session is in progress**, which is both a
licence requirement for OpenF1 and consistent with C5 and C8.

### 10.6 Last-known-good is always served

If either upstream fails, is rate-limited, returns an inconsistent payload or
disappears entirely, **the last published snapshot remains publicly available
and unchanged**. This is requirement T2 and is already enforced by the existing
test `preserves the active snapshot after provider failure`.

A failed fetch updates provenance and health state only. It never deletes,
truncates or downgrades a published snapshot.

### 10.7 Provenance recorded per synchronized resource

Internal only. Every synchronized resource retains:

| Field | Meaning |
|---|---|
| `provider` | `openf1` or `jolpica` |
| `providerResourceRef` | Provider-side anchor where one exists — OpenF1 `session_key` / `meeting_key`, Jolpica `season`/`round`. Null where the provider exposes none. |
| `providerVersion` | Provider-declared version where available. **Null for both current candidates** — neither exposes one (§8.6). |
| `fetchedAt` | GridView's own fetch time. This is the only reliable time anchor either source permits. |
| `sessionIdentity` | GridView's session identity for the record. |
| `state` | `provisional` or `reconciled`. |
| `reconciledAt` | When a reconciled write last replaced or confirmed the record. Null while provisional. |
| `conflictOutcome` | Which rule in §10.9 fired, and what it decided. |

### 10.8 Provider metadata must not leak into the public contract

None of §10.7 appears in the public v1 DTOs unless the existing contract already
requires it. The public API keeps the freshness and staleness semantics it
already has. This is requirement T4, already enforced by
`test/contract/fixtures.test.ts` and `test/contract/generated-snapshots.test.ts`.

Provider identifiers in particular stay internal: `driver_number`, `team_name`,
`session_key`, `meeting_key`, `driverId`, `constructorId` and `circuitId` are
mapping inputs, never public GridView IDs (T7, Backend Scheme §8.1).

### 10.9 Conflict rules

**Governing rule: a reconciled snapshot is never replaced by an older or
provisional snapshot.** State and time both gate every write:

```text
accept the incoming write only if
    incoming.state == reconciled
        and (stored.state == provisional
             or incoming.reconciledAt > stored.reconciledAt)
  or
    incoming.state == provisional
        and stored.state == provisional
        and incoming.fetchedAt > stored.fetchedAt
```

A provisional write against a reconciled record is **rejected and logged**, not
merged. This composes with the existing `SnapshotConflict.decide` rule rather
than replacing it.

| # | Conflict | Rule |
|---|---|---|
| 1 | **Mismatched driver identifier** | Join on `driver_number` scoped to the season. If no Jolpica driver matches, **fail validation for that resource** and do not write. Never invent an identifier (Backend Scheme §8.1). |
| 2 | **Mismatched constructor identifier** | Resolve through the curated mapping registry (M1). An unmapped constructor name **fails validation** and raises an operational signal; it does not fall back to string matching. |
| 3 | **Penalty or post-session classification change** | Jolpica is authoritative. A reconciled write replaces provisional positions, points and status wholesale for that session — never field-by-field, which could leave a record internally inconsistent. |
| 4 | **Disqualification** | Same as 3. OpenF1's `dsq` boolean produces a provisional disqualification; Jolpica's `positionText` and `status` are authoritative on reconciliation. A provisional record must never *remove* a disqualification a reconciled record asserted. |
| 5 | **Corrected championship totals** | Jolpica standings are authoritative. OpenF1 `points_current` is provisional and is replaced, not merged. Where the two disagree at reconciliation time, the disagreement is recorded in `conflictOutcome` before the reconciled value is written. |
| 6 | **Missing sprint or qualifying data** | Absence is never written as an empty result. The resource stays at its previous state and is retried on the §10.4 cadence. A session with no result yet is *unavailable*, which is distinct from *empty* — the same distinction the Home module already enforces via materialization rather than row count. |
| 7 | **One provider updates before the other** | Expected and normal; it is the whole design. Provisional data may lead reconciled data by up to 24 hours. The reverse — Jolpica reconciling before OpenF1 has been fetched at all — simply skips the provisional write; §10.9's governing rule already forbids a later provisional write from overwriting it. |
| 8 | **Beta championship endpoint returns nothing** (M3) | Treated as case 6: no write, retry on cadence, reconcile from Jolpica. A beta endpoint going silent must degrade to *slower*, never to *wrong*. |

### 10.10 Independent adapters

`OpenF1Provider` and `JolpicaProvider` are separate implementations of the
existing `FormulaOneProvider` seam. Neither knows about the other. Reconciliation
is a **coordinator** concern, above both adapters, not a cross-adapter
dependency.

Consequence: **either source can be removed without changing the Flutter-facing
API contract.** If OpenF1 becomes unusable, GridView loses 30-60 minute
freshness and falls back to Jolpica-only reconciliation. If Jolpica becomes
unusable, GridView loses reconciliation and historical depth. In neither case
does the public v1 contract change, and in neither case does the app need a
release.

This requires the interface work recorded as G4 in Appendix D: the existing
single-call `fetchSeasonSource(season, jobs)` cannot express two sources with
different roles and different per-job failure outcomes.

---

## 11. Expected request volume

### 11.1 Cost per polled session

Neither source supports conditional requests (§8.6), so every attempt is a full
fetch.

| Session type | OpenF1 per attempt | Jolpica per check |
|---|---|---|
| Qualifying / Sprint Qualifying | `sessions` 1 + `session_result` 1 = **2** (+1 `drivers` on the first attempt only) | `qualifying` 1 = **1** |
| Sprint | `sessions` 1 + `session_result` 1 + `championship_drivers` 1 + `championship_teams` 1 = **4** (+1 `drivers` once) | `sprint` 1 + `driverstandings` 1 + `constructorstandings` 1 = **3** |
| Race | same as Sprint = **4** (+1 `drivers` once) | `results` 1 + `driverstandings` 1 + `constructorstandings` 1 = **3** |

Worst case, all attempts and checks exhausted:

| Session type | OpenF1 (4 attempts) | Jolpica (4 checks) | Total |
|---|---:|---:|---:|
| Qualifying | 4x2 + 1 = 9 | 4x1 = 4 | **13** |
| Sprint | 4x4 + 1 = 17 | 4x3 = 12 | **29** |
| Race | 4x4 + 1 = 17 | 4x3 = 12 | **29** |

Expected case, first attempt and first check succeed:

| Session type | OpenF1 | Jolpica | Total |
|---|---:|---:|---:|
| Qualifying | 3 | 1 | **4** |
| Sprint / Race | 5 | 3 | **8** |

### 11.2 Baseline, off-event

| Job | Source | Cadence | Requests/day |
|---|---|---|---:|
| Calendar / races | Jolpica | daily | 1 |
| Driver + constructor standings | Jolpica | daily, in season | 2 |
| Session schedule | OpenF1 `sessions` | daily | 1 |
| Participants and circuits | Jolpica | weekly (3 calls) | 3/7 ≈ 0.4 |
| **Total, in season** | | | **≈ 4.4 / day** |
| **Total, off season** (standings weekly) | | | **≈ 2.7 / day** |

### 11.3 Weekend and monthly totals

Assumptions: 24 Grands Prix per season of which 6 are sprint weekends (25%); the
season spans about 9 months, averaging 2 race weekends per calendar month.

| Scenario | Worst case | Expected case |
|---|---:|---:|
| Standard weekend (Qualifying + Race) | 13 + 29 = **42** | 4 + 8 = **12** |
| Sprint weekend (SQ + Sprint + Q + Race) | 13 + 29 + 13 + 29 = **84** | 4 + 8 + 4 + 8 = **24** |

Season month with two race weekends, one in four being a sprint weekend:

| Component | Formula | Worst case | Expected |
|---|---|---:|---:|
| Off-event baseline | `30 x 4.4` | 132 | 132 |
| Weekends | `1.5 x 42 + 0.5 x 84` / `1.5 x 12 + 0.5 x 24` | 105 | 30 |
| Subtotal | | 237 | 162 |
| Manual recovery and retry reserve (20%) | | 47 | 32 |
| **Monthly total** | | **≈ 285** | **≈ 195** |
| **With 2x safety margin** | | **≈ 570** | |

**Peak day** — the Saturday of a sprint weekend, carrying both the Sprint and
Qualifying post-session windows:

```text
baseline 4.4 + Sprint (17 + 12) + Qualifying (9 + 4) = ~47 requests/day
```

Split by source on that day: **OpenF1 ≈ 27**, **Jolpica ≈ 21**.

### 11.4 Headroom against published limits

| Source | Published limit | Peak-day use | Headroom |
|---|---|---:|---|
| OpenF1 free | 30 requests/**minute** | ≈ 27 requests/**day** | The entire peak day fits inside one minute's allowance. Attempts are serialized, so the 3 requests/second burst limit is never approached. |
| Jolpica unauthenticated | 500 requests/**hour** | ≈ 21 requests/**day** | ≈ 4% of a single hour's allowance, spread across 24 hours. Well inside the announced future reduction. |

**Neither source's rate limit is a constraint on this design, even at worst
case, even if published limits are reduced substantially.** Licensing, not
quota, remains the gate.

### 11.5 Against the superseded model

| Model | Off-event daily | Peak daily | Monthly |
|---|---:|---:|---:|
| Superseded static scheduler (§10.5) | 415 | 415 | ≈ 12,450 |
| Proposed event-aware model, worst case | 4.4 | ≈ 47 | ≈ 285 |
| **Reduction** | **~99%** | **~89%** | **~98%** |

### 11.6 Assumptions that remain undecided

| # | Undecided | Effect |
|---|---|---|
| Q1 | **Production cron cadence.** `wrangler.toml` declares a cron only for staging (`17 3 * * *`, once daily); production declares none. An event-aware schedule needs a fine-grained cron (for example every 5 minutes) whose invocations mostly do nothing. | Determines whether §10.3's minute-level offsets are achievable at all. |
| Q2 | **Whether the beta championship endpoints populate for sprint sessions** (M3). | If not, sprint-day standings freshness falls back to Jolpica reconciliation. Reduces OpenF1 cost, increases latency. |
| Q3 | **How quickly Jolpica publishes results after a race.** Not measurable in this pass: the check ran during the 2026 summer break, 24 days after the last session. Round 11 was fully populated, but that proves completeness, not latency. | Determines whether C7's 24-hour objective is realistic. Must be measured against a live race weekend before being asserted. |
| Q4 | **Whether a full-season backfill is needed per rebuild, or only recent rounds.** | Bounds bootstrap cost between roughly 10 and 80 requests. |

---

## 12. Continuity and sustainability

### 12.1 What is not claimed

**Neither project is guaranteed to be operating next year.** Both are free
community efforts. Jolpica states it is volunteer-run and donation-supported and
explicitly does not guarantee uptime, availability or correctness, with use
"entirely at your own risk". OpenF1 states it is unofficial and
community-operated. Neither offers an SLA, and neither can be held to one.

Adopting them is a decision to accept that risk in exchange for EUR 0 and to
mitigate it in architecture. The mitigations below are the substance of that
decision.

### 12.2 Observable maintenance signals

Risk indicators, **not guarantees**, as observed on 2026-08-19:

| Signal | OpenF1 (`br-g/openf1`) | Jolpica (`jolpica/jolpica-f1`) |
|---|---|---|
| Repository archived | No | No |
| Last push | 2026-07-17 (~1 month before access date) | 2026-08-14 (~5 days before access date) |
| Recent commit themes | Vendor-agnostic object storage; MQTT reconnect fix; team-radio cache | Service status endpoint (#389); fix to infer total rounds rather than hardcode; cache reduced to 10 minutes |
| Stars | 1,676 | 880 |
| Open issues | 34 | 22 |
| Code licence | Custom — repository LICENSE file is CC BY-NC-SA 4.0 | **Apache-2.0**, cleanly separated from the CC BY-NC-SA 4.0 data licence |
| Documentation currency | Endpoint reference maintained in-repo, with fields explicitly marked deprecated and dated for removal | Terms dated 27 August 2025; endpoint docs and rate-limit guide maintained in-repo |
| Issue handling | 34 open | A reported result-timing bug drew a maintainer reply the same day and was fixed |
| Data dumps | Not offered | **Offered**, free tier at 14-day delay |
| Announced limit changes | None | Rate limits explicitly stated to be heading **downward** |

**Reading.** Both are actively maintained on this evidence. Jolpica is the more
recently active, has cleaner licence separation, has a status endpoint, and
offers dumps — but has openly announced it will reduce free limits. OpenF1's
last push is a month old, which is unremarkable for a project whose season was
in summer break, but it is a signal to re-check.

### 12.3 Required mitigations

None of these is implemented. All are Phase 9B or later.

| # | Mitigation | Why |
|---|---|---|
| S1 | **Independent adapters** (§10.10) | Either source can be dropped without an app release or a contract change. |
| S2 | **Fixture-backed contract tests** | The public contract is pinned by 30 normalized fixtures that do not depend on any upstream being reachable. A provider disappearing cannot break the contract tests. |
| S3 | **Last-known-good public snapshots** (§10.6) | An upstream outage degrades freshness, never availability. |
| S4 | **Event-aware retry and circuit breaking** | Bounded attempts (§10.3, §10.4), no tight loops, `Retry-After` respected, and a breaker that stops calling a source that is failing rather than burning the published limit. |
| S5 | **Provider health and freshness monitoring** | Per-source last success, last failure, consecutive failures, and age of the newest reconciled record. Jolpica's new service status endpoint is a candidate input. |
| S6 | **Stale-data indicators** | The app already distinguishes unavailable from empty and surfaces staleness. Extend to make "provisional" and "not yet reconciled" legible where the contract allows. |
| S7 | **Identifier mapping isolated from public DTOs** (§10.8, T7) | Changing or dropping a source never changes a public GridView identifier. |
| S8 | **Periodic backups of source data where licensing permits** | Jolpica's free 14-day-delayed dumps are a genuine recovery path (§12.4). OpenF1 offers no equivalent; its recovery path is GridView's own retained snapshots. |
| S9 | **Documented manual recovery procedure** | An operator runbook for rebuilding a season from dumps and retained snapshots, in `docs/operations/`. Does not exist yet. |
| S10 | **Annual provider and licence review** | Terms, rate limits and maintenance signals are all explicitly changeable; Jolpica has already announced a reduction. A dated annual review with a recorded outcome. |
| S11 | **Replaceability without an app release** | Guaranteed as long as the normalized v1 contract is unchanged. This is the single most valuable property of the whole architecture and must be protected in review. |

### 12.4 Backups and dumps

Jolpica publishes database dumps in CSV. The **free tier** is available 14 days
after upload, requires no authentication and is for non-commercial use. The
**Supporter tier** offers the latest dumps immediately *and licenses them for
commercial use*, but requires payment and is excluded by C1.

A 14-day-delayed dump is a viable disaster-recovery input for historical data:
it would not restore the most recent race weekend, but it would restore
everything older. Whether GridView may **retain** such a dump — and in
particular whether it may keep it if Jolpica access later ends — is
`Not stated or ambiguous` and is asked in Appendix B.

Dump enums are documented as integer encodings whose meanings currently live
only in the project's model source. Any use of dumps carries that decoding
burden.

### 12.5 Self-hosting is a contingency to investigate, not a plan

Both projects publish server code. That does **not** mean GridView may self-host
and thereby side-step the data question.

- An open-source **code** licence grants rights to the code, not to the Formula 1
  data the code serves. Jolpica's separation is explicit: Apache-2.0 code,
  CC BY-NC-SA 4.0 data.
- Self-hosting would require GridView to source the underlying data itself,
  which reintroduces every rights question this document exists to answer, plus
  a data-acquisition problem neither project's code solves for a third party.
- Operating a scraper is excluded by
  [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §2 ("No production
  scraper").

Recorded as a contingency to **investigate** if both sources become unavailable
simultaneously. **Not implemented, not planned, and not assumed viable.**

---

## 13. Official sources

All accessed **2026-08-19**. Every decisive claim traces to a row here.

| # | Project | URL | Page title | Type | Paraphrase |
|---|---|---|---|---|---|
| S1 | OpenF1 | `https://openf1.org/` | OpenF1 API \| The open source API for Formula 1 data | Explicit | Licensed CC BY-NC-SA 4.0; intended for educational, personal-learning, research and non-commercial fan-engagement use; unofficial and not associated, affiliated, endorsed or sponsored by Formula One World Championship Limited; claims no ownership of Formula 1 data, trademarks or broadcasts; Community tier free, 18 endpoints, historical sessions since 2023, **no authentication**, 3 req/s and 30 req/min; Sponsor tier EUR 9.90/month adds live data, 6 req/s and 60 req/min. **"Data is considered live from 30 minutes before a session starts until 30 minutes after it ends. Outside of this window, data is classified as historical and is free to access."** |
| S2 | OpenF1 | `https://github.com/br-g/openf1/blob/main/documentation/includes/_api_endpoints.md` | API endpoints | Explicit | Full endpoint reference. Eighteen endpoints: Car data, **Drivers championship (beta)**, **Teams championship (beta)**, Drivers, Intervals, Laps, Location, Meetings, Overtakes, Pit, Position, Race control, Sessions, Session result, Starting grid, Stints, Team radio, Weather. Championship paths are `/v1/championship_drivers` and `/v1/championship_teams`, each documented as "Only available for race sessions" with `points_start`, `points_current`, `position_start`, `position_current`. `country_code` on drivers and `pit_duration` on pit are marked deprecated for removal at the end of the 2026 season. |
| S3 | OpenF1 | `https://github.com/br-g/openf1/blob/main/LICENSE` | Attribution-NonCommercial-ShareAlike 4.0 International | Explicit | The repository's LICENSE file is the CC BY-NC-SA 4.0 legal text. |
| S4 | OpenF1 | `https://api.openf1.org/v1/sessions`, `/v1/meetings`, `/v1/drivers`, `/v1/session_result`, `/v1/championship_drivers`, `/v1/championship_teams` | (JSON API responses) | Explicit | Feasibility check, §8.3. Field inventories and row counts as recorded there. No rate-limit, `ETag`, `Cache-Control` or `Last-Modified` headers were returned. |
| S5 | Jolpica | `https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md` | Jolpica-F1 API - Terms of Use (last updated 27 August 2025) | Explicit | Freely available for **non-commercial use**; data licensed CC BY-NC-SA 4.0; **commercial usage requires contacting `admin@jolpi.ca`**; the project reserves the right to change the terms; volunteer-run and donation-supported with **no guarantee of uptime, availability or correctness**; use entirely at the user's own risk. |
| S6 | Jolpica | `https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md` | Rate Limits | Explicit | Unauthenticated burst 4 requests/second, sustained 500 requests/hour; HTTP 429 on breach; limits subject to change and **"will decrease"** as token access rolls out; **caching results is the first recommended mitigation**. |
| S7 | Jolpica | `https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md` | jolpica-f1 Documentation | Explicit | Thirteen Ergast-compatible endpoints; shared `limit` (default 30, max 100) and `offset`; a custom identifying `User-Agent` is **required**. |
| S8 | Jolpica | `https://github.com/jolpica/jolpica-f1/blob/main/docs/endpoints/races.md` | Races | Explicit | Race objects carry season, round, raceName, Circuit with Location, date and optional UTC time, plus optional `FirstPractice`, `SecondPractice`, `ThirdPractice`, `Qualifying`, `Sprint` and `SprintQualifying`/`SprintShootout`. Historical coverage from 1950. |
| S9 | Jolpica | `https://github.com/jolpica/jolpica-f1/blob/main/docs/database_dumps.md` | Database Dumps | Explicit | CSV exports of the F1 database. **Free tier**: dumps available 14 days after upload, non-commercial, no authentication. **Supporter tier**: latest dumps immediately, **licensed for commercial use**, API key required, arranged via Ko-fi. Integer enum meanings currently live only in the project's model source. |
| S10 | Jolpica | `https://api.jolpi.ca/ergast/f1/2026/...` (races, driverstandings, constructorstandings, drivers, constructors, circuits, `2026/11/results`, `2026/2/sprint`) | (JSON API responses) | Explicit | Feasibility check, §8.4. Row counts, field inventories and cross-source agreement as recorded in §8.4 and §8.5. Response headers carry `Cache-Control: max-age=600` and a `Last-Modified` equal to `Date`; no rate-limit headers and no `ETag`. |
| S11 | Jolpica | `https://github.com/jolpica/jolpica-f1` (repository metadata, recent commits, issue 179) | jolpica/jolpica-f1 | Explicit | Not archived; last push 2026-08-14; Apache-2.0 code licence; 880 stars; 22 open issues; recent commits add a service status endpoint and fix round-count inference. Issue 179 records `/current/last` returning the previous round on a race Sunday, a same-day maintainer reply, and a later fix. |
| S12 | OpenF1 | `https://github.com/br-g/openf1` (repository metadata, recent commits) | br-g/openf1 | Explicit | Not archived; last push 2026-07-17; 1,676 stars; 34 open issues. |
| S13 | Sportmonks | `https://www.sportmonks.com/formula-one-api/`, `https://www.sportmonks.com/terms-of-service/`, `https://docs.sportmonks.com/v3/motorsport-api/endpoints-and-entities/endpoints/standings` | Sportmonks Formula 1 API; Terms of Service; Standings \| Motorsport API 3.0 | Explicit | Retained from v0.1. Commercial creations permitted; distribution, transfer and storage allowed; reselling forbidden without consent; logos and profile photos are copyright of their owners with the customer arranging IP proof and attribution. EUR 69/month with 2,000 calls/hour/endpoint on the product page against EUR 79/month with 3,000 calls/hour in the standings documentation — **an unresolved conflict**. |
| S14 | API-Sports | `https://api-sports.io/` and seven other official paths | (not retrieved) | **Unreachable** | All returned HTTP 403 to every retrieval method available on 2026-08-19. No API-Sports statement is asserted anywhere in this document. |

### 13.1 Ambiguities requiring written confirmation

| # | Project | Ambiguity |
|---|---|---|
| X1 | **Both** | Whether serving normalized data through GridView's own free public API is permitted redistribution under CC BY-NC-SA 4.0. **Decisive for the whole proposal.** |
| X2 | **Both** | Whether a free, unmonetised, publicly distributed Google Play application is "non-commercial" under the NC term. |
| X3 | **Both** | What ShareAlike attaches to: the app source, the backend source, the normalized database, exported datasets, or only adapted data. |
| X4 | **Both** | Required attribution wording and placement, and whether a specific licence link or notice must be reproduced. |
| X5 | **Both** | Whether small derived test fixtures may be stored in a public repository. |
| X6 | **Both** | Whether cached historical data may be retained if access later ends. |
| X7 | **Both** | Whether Formula 1 competition-data rights remain GridView's separate responsibility. |
| X8 | **Both** | Whether any future monetisation would require separate written permission — asked now so that C4 is a priced decision, not a discovered problem. |
| X9 | Jolpica | Whether free 14-day-delayed database dumps may be retained as a GridView backup, and under what conditions. |
| X10 | OpenF1 | Whether GridView's fetch schedule starting at scheduled-session-end + 32 minutes is correctly outside the live window in all cases, including delayed or red-flagged sessions. |
| X11 | API-Sports | Everything. No current statement could be read. |

---

## 14. Risks and unknowns

### 14.1 Legal risks

| # | Risk | Severity |
|---|---|---|
| R1 | **Neither proposed source explicitly permits the intended public redistribution.** Both require written permission (X1). Proceeding without it risks operating a public service outside its data licence. | Critical — this is the gate |
| R2 | **There is no contract.** Under the zero-cost model, the strongest available outcome is a written statement from a volunteer project, not a commercial agreement. It can be changed, withdrawn or superseded, and both projects reserve the right to change their terms. | Critical |
| R3 | **Formula 1 competition-data rights are separate and unresolved** (X7). OpenF1 explicitly disclaims ownership of F1 data, trademarks and broadcasts, which places the burden on GridView. No free source can grant these rights. | Critical |
| R4 | **ShareAlike scope is unknown** (X3). If SA reaches GridView's normalized database or exported datasets, GridView may be obliged to license its own API output under CC BY-NC-SA 4.0 — which would constrain the product's own terms and permanently foreclose monetisation without renegotiation. | High |
| R5 | **Monetisation is foreclosed** while these sources are used. C4 already states this; the risk is that it is forgotten and a later revenue decision is taken without reopening the provider question. | High |
| R6 | **The repository's existing API-Sports legal claims are unsourced and unverified** (§6.2). | Medium |

### 14.2 Availability and continuity risks

| # | Risk | Severity |
|---|---|---|
| R7 | **Neither project guarantees uptime, availability or correctness.** Jolpica says so explicitly. Two free community projects are a thinner foundation than one paid provider, though two independent sources are also a genuine redundancy benefit. | High |
| R8 | **Jolpica has announced its free rate limits will decrease.** This is a stated plan, not a hypothetical. §11.4 shows large headroom, but the size of the reduction is unknown. | Medium |
| R9 | **Both championship endpoints are beta** (M3) and the standings-freshness path depends on them. | Medium |
| R10 | **Q3 is unmeasured**: Jolpica's actual post-race publication latency is unknown, so C7's 24-hour objective is unvalidated. | Medium |
| R11 | **OpenF1's live window is a licence boundary enforced by a clock**, and `date_end` is a scheduled time (M11). A badly delayed session could in principle place a scheduled fetch inside the live window. Mitigated by the +32-minute margin (§10.2), not eliminated. | Medium |
| R12 | **Neither source exposes quota headers** (§8.6), so T1 cannot be satisfied as written and quota state must be modelled locally. | Low |

### 14.3 Technical risks and structural gaps

Unchanged from v0.1 except where the dual-source design alters them. Full detail
in Appendix D.

| # | Gap |
|---|---|
| R13 | `ProviderMode` admits only `'mock'` and `'none'`; production is hard-configured to `'none'`. |
| R14 | **Production declares no cron trigger** (Q1). An event-aware schedule needs one, at fine granularity. |
| R15 | `fetchSeasonSource(season, jobs)` is a single coarse call and **cannot express two sources with different roles**; partial-failure semantics are undefined (G4). |
| R16 | The scheduler is not event-aware (§10.5). |
| R17 | `providerCallCount` reads an untyped optional property via a cast and silently reports `0` for any adapter that does not expose it. |
| R18 | No curated identifier mapping registry exists, and §8.5 proves one is mandatory. |
| R19 | No outbound-request hardening helper exists (Backend Scheme §23.3). |
| R20 | No provenance fields exist for §10.7, and no `provisional`/`reconciled` state exists in the local schema. |

---

## 15. Recommendation

### 15.1 Outcome

**The proposed Phase 9A direction is a dual-source, zero-cost, post-session
model: OpenF1 for provisional data and Jolpica for complete and reconciled
data.**

Both projects are candidates for **written legal inquiry**. Neither is approved,
selected for production, or activated. The proposal is contingent on **both**:

1. **technical feasibility** — largely evidenced by §8, with the gaps in §8.7
   and the undecided items in §11.6 outstanding; and
2. **written licensing confirmation from both projects** — entirely outstanding
   (X1-X10).

Both inquiries must be answered. **A favourable answer from only one does not
unblock the model**, because the two sources fill different roles: OpenF1 alone
cannot supply complete metadata, constructor standings or pre-2023 history;
Jolpica alone cannot plausibly meet C6's 30-60 minute objective.

### 15.2 The recommendation separated into its parts

**Product fit.** *Strong.* The proposal is the only assessed option that
satisfies C1 at EUR 0. Its freshness ceiling — the earliest free OpenF1 fetch at
session end + 30 minutes — coincides exactly with C6's objective, which is
fortunate rather than engineered, and leaves no margin to do better.

**Technical fit.** *Good, with named gaps.* §8.5 is the strongest evidence: the
two sources agreed exactly on winner, laps, race duration, race points, and all
22 driver championship totals. Against that, constructor names disagreed in 4 of
11 cases (M1), OpenF1 exposes no stable driver or team identifier (M2), and the
championship endpoints are beta (M3).

**Commercial fit.** *Trivially satisfied, and that is the risk.* EUR 0 with no
account and no payment method. The cost of that is R2: there is no counterparty
obligation of any kind.

**Licensing certainty.** *Low, and improved but not resolved by C3.* Both
sources are CC BY-NC-SA 4.0. Removing monetisation makes the NonCommercial
question more favourable (X2) but answers neither it nor ShareAlike (X3) nor the
decisive redistribution question (X1).

**Sustainability.** *Acceptable only with the S1-S11 mitigations.* Both projects
show active maintenance, but neither offers a guarantee and Jolpica has already
announced a limit reduction.

### 15.3 Why this is not approval

1. **X1 is unanswered for both projects.** Whether GridView's public normalized
   API is permitted redistribution under CC BY-NC-SA 4.0 is the entire question,
   and neither project's published text answers it.
2. **X2 is unanswered.** "Free and unmonetised" is a strong argument for
   non-commercial status. It is not a statement by either licensor.
3. **X3 is unanswered.** ShareAlike's scope could reach GridView's own database
   and API output.
4. **R3 is unresolved and unresolvable by these projects.** Formula 1
   competition-data rights are not theirs to grant.
5. **Q3 is unmeasured.** C7's 24-hour objective has not been validated against a
   real race weekend.
6. Nothing has been asked, and no written answer exists.

### 15.4 Evidence that would change the recommendation

| If this becomes true | Then |
|---|---|
| Both projects confirm in writing that GridView's free public normalized API is permitted, and state their attribution requirements | The model proceeds to Phase 9B, subject to R3 and the S1-S11 mitigations |
| Either project answers that it is **not** permitted | The dual-source model fails. Fall back per ADR 0019. |
| ShareAlike is confirmed to reach GridView's normalized database or API output | A product decision is required on whether GridView can accept licensing its own output under CC BY-NC-SA 4.0 |
| C1 or C3 is relaxed | **Sportmonks returns as the leading candidate** (§6.1), and its unresolved distribution-versus-resale question becomes the priority |
| API-Sports terms become readable and permit the architecture at zero cost | It becomes a third candidate for inquiry |
| Q3 measurement shows Jolpica routinely publishes results far later than 24 hours | C7 must be revised downward; it is an objective, not a provider commitment |

### 15.5 Required user actions before Phase 9B

| # | Action | Why it needs the user |
|---|---|---|
| U1 | Review and approve or amend the two inquiry drafts (Appendix A, Appendix B) | Sending is outside this pass |
| U2 | **Send** the OpenF1 inquiry | Contacting a project is a hard boundary here |
| U3 | **Send** the Jolpica inquiry to `admin@jolpi.ca` or via GitHub Discussions | As above |
| U4 | Decide the response window after which no reply is treated as no permission | Silence must not become a default yes |
| U5 | Decide whether GridView independently pursues Formula 1 competition-data clearance (R3), and whether legal review is accepted | A product and possibly legal-counsel decision |
| U6 | Decide Q1 — whether production gets a cron trigger and at what granularity | Determines whether §10.3 is achievable |
| U7 | Accept or revise C6 and C7 as **objectives**, knowing Q3 is unmeasured | A product decision about what the app promises |
| U8 | Optionally, open `api-sports.io` in an ordinary browser to close X11 | Automated retrieval is blocked |

---

## Appendix A - Unsent inquiry: OpenF1

> **Status: DRAFT. NOT SENT.** This message has not been sent, submitted,
> emailed or entered into any form. No account exists, no sponsorship has been
> started, and no payment method has been provided.

**Recipient:** OpenF1 project (contact path in Appendix C)
**Subject:** Licence question — free non-commercial F1 app using OpenF1 historical data via its own backend

---

Hello,

Thank you for OpenF1. I would like written confirmation that my intended use is
permitted before I build anything on it.

**What GridView is.** A free Formula 1 companion application for Android,
intended for public distribution on Google Play. It has **no advertising, no
in-app purchases, no subscriptions, no sponsorship and no affiliate income**, and
it will stay that way for as long as it uses OpenF1 data. There is no revenue of
any kind.

**How I would use OpenF1.**

1. **Only after the free historical window opens.** I understand data is live
   from 30 minutes before a session starts until 30 minutes after it ends. My
   first request would be scheduled at the session's scheduled end **plus 32
   minutes**, deliberately leaving a margin so I never call inside the live
   window. I would make at most four attempts, at +32, +35, +45 and +60 minutes,
   stopping as soon as I have a complete result.
2. **No live timing and no telemetry.** I do not need and will not use car data,
   intervals, positions, laps, location, stints, team radio or weather.
3. **Server-side only.** Requests come from my own backend, never from the
   mobile app.
4. **Scheduled, not per-user.** Upstream request volume does not depend on how
   many people use the app. My estimate is roughly 30 requests on the busiest
   race weekend day and a few hundred per month.
5. **Caching and normalization.** I convert responses into my own data model and
   store them as snapshots on my backend.
6. **Retention.** I would like to keep historical snapshots of past seasons.
7. **Redistribution.** My backend serves those normalized snapshots to my own
   app through my own free, read-only public API.
8. **Endpoints I would use:** `sessions`, `meetings`, `drivers`,
   `session_result`, `championship_drivers`, `championship_teams`.

**The questions.**

1. **Is this use permitted under CC BY-NC-SA 4.0?**
2. Does a **free, unmonetised, publicly distributed app** count as
   non-commercial in your view?
3. **Is serving your data — normalized into my own model — through my own free
   public API permitted redistribution?** This is my most important question.
4. **What does ShareAlike attach to here?** Specifically: does it apply to my
   Android app's source code, my backend's source code, my normalized database,
   any dataset I might export, or only to the adapted data itself? I may
   open-source my adapter code later and want to understand the obligation
   before I do.
5. **What attribution do you require** — exact wording, and where it must appear
   (an in-app credits screen, every screen showing your data, my API responses,
   my documentation)? Is a specific licence link or notice required?
6. May I store **small derived samples** — a handful of records — in a public
   repository as fixtures for automated tests? They would exist only to verify my
   code parses correctly, not as a data source.
7. If I later stop using OpenF1, **may I retain the historical data I already
   cached**, or must it be deleted?
8. Do any **Formula 1 competition-data rights remain my responsibility** to
   clear separately? I am assuming they do — that OpenF1 does not and cannot
   grant them — but I would rather have that confirmed than assumed.
9. I will use **no images, headshots or logos**. I understand the `headshot_url`,
   `circuit_image` and `country_flag` fields point at third-party media that is
   not yours to license, and I will not fetch, store or display any of them.
   Please confirm a data-only, no-media use is acceptable.
10. If I ever wanted to **monetise** the app in future, would that require
    separate written permission or a different licence? I am not asking for that
    now — I want to know the answer before it becomes a live question.
11. Is my **+32-minute margin** sufficient to stay outside the live window in
    all cases, including a session that is delayed or red-flagged and therefore
    ends later than its scheduled end time?

I would rather ask and be told no than assume and be wrong.

Thank you for your time and for the project.

Kind regards,
Sergio Arenas
GridView

---

## Appendix B - Unsent inquiry: Jolpica F1

> **Status: DRAFT. NOT SENT.** This message has not been sent, submitted,
> emailed or posted. No account exists, no Ko-fi supporter tier has been taken,
> and no API key has been requested.

**Recipient:** Jolpica F1 project — `admin@jolpi.ca`, or GitHub Discussions
**Subject:** Licence question — free non-commercial F1 app redistributing normalized Jolpica data via its own API

---

Hello,

Thank you for jolpica-f1, and for keeping the Ergast interface alive. Your terms
say commercial usage should be raised with you. I do not believe my use is
commercial, but I would rather ask than assume — so this is that question.

**What GridView is.** A free Formula 1 companion application for Android,
intended for public distribution on Google Play. It has **no advertising, no
in-app purchases, no subscriptions, no sponsorship and no affiliate income**, and
it will stay that way for as long as it uses Jolpica data. There is no revenue of
any kind.

**How I would use the API.**

1. **Server-side only, on a schedule.** Requests come from my own backend, never
   from the mobile app, and volume does not depend on how many people use it. My
   estimate is roughly 20 requests on the busiest race weekend day and a few
   hundred per month — a small fraction of the 500/hour public limit.
2. **A custom `User-Agent`** identifying the app and version, as you require.
3. **Caching**, as your rate-limit guide recommends. I address resources
   explicitly by `season/round` rather than `last`/`next`, and I pass `limit`
   explicitly rather than relying on the default.
4. **Endpoints I would use:** `races`, `results`, `sprint`, `qualifying`,
   `driverstandings`, `constructorstandings`, `drivers`, `constructors`,
   `circuits`.
5. **Normalization.** I convert responses into my own data model, mapping your
   identifiers to my own, and store the result as snapshots.
6. **Retention.** I would like to keep historical snapshots of past seasons.
7. **Redistribution.** My backend serves those normalized snapshots to my own
   app through my own free, read-only public API.
8. **No live timing.** I use your data for complete season metadata and for
   final, reconciled results and standings after a session.

**The questions.**

1. **Is this use permitted under CC BY-NC-SA 4.0 and your Terms of Use?**
2. Does a **free, unmonetised, publicly distributed app** count as
   non-commercial in your view, or would you consider it commercial usage
   requiring the route in your terms?
3. **Is serving your data — normalized into my own model — through my own free
   public API permitted redistribution?** This is my most important question.
4. **What does ShareAlike attach to here?** Specifically: my Android app's source
   code, my backend's source code, my normalized database, any dataset I might
   export, or only the adapted data itself? I note your code is Apache-2.0 while
   the data is CC BY-NC-SA 4.0, so I want to be sure which obligation reaches
   which artefact. I may open-source my adapter code later.
5. **What attribution do you require** — exact wording, and where it must appear
   (an in-app credits screen, every screen showing your data, my API responses,
   my documentation)? Is a specific licence link or notice required?
6. May I store **small derived samples** — a handful of records — in a public
   repository as fixtures for automated tests?
7. If I later lose access, or the project stops, **may I retain the historical
   data I already cached**?
8. Regarding your **free database dumps** (14-day delayed, non-commercial): may I
   download and retain them as a backup for disaster recovery, and does that
   retention survive if my API access later ends?
9. Do any **Formula 1 competition-data rights remain my responsibility** to
   clear separately? I am assuming they do and that jolpica-f1 does not grant
   them; please correct me if that is wrong.
10. If I ever wanted to **monetise** the app in future, I take it that would need
    separate written permission from you — is that right, and is the Supporter
    tier the intended route?
11. You have noted that public rate limits **will decrease** as token access
    rolls out. Is there anything about my usage pattern above that you would
    want changed ahead of that?

I would rather ask and be told no than assume and be wrong.

Thank you for your time and for the project.

Kind regards,
Sergio Arenas
GridView

---

## Appendix C - Official contact paths

**No form was submitted, no email was sent, no discussion was posted, and no
account was created.**

| Project | Contact path | Source |
|---|---|---|
| **OpenF1** | The site directs use cases beyond the stated non-commercial scope to contact the project to discuss appropriate licensing. The repository `br-g/openf1` carries community and support guidance, including a `_community_and_support.md` documentation section. | S1, S12 |
| **Jolpica F1** | **`admin@jolpi.ca`** for commercial usage, per the Terms of Use. GitHub Discussions at `https://github.com/jolpica/jolpica-f1/discussions` for support, feedback and rate-limit questions; the project also references a Discord invite and a Ko-fi page for supporters. | S5, S6, S9 |
| Sportmonks | Support and commercial contact reachable from `https://www.sportmonks.com/`. Retained for reference; rejected under C1. | S13 |
| API-Sports | **Not established.** No official page could be retrieved (§6.2). Must be read from the site by a person. | S14 |

**Contact addresses above are the projects' own published contact points.** They
are published business contact details, not credentials and not personal data of
any GridView user, and they are recorded here for that reason.

---

## Appendix D - Code architecture audit

Read-only. Nothing in `services/edge-api/` was modified.

### D.1 Seams that exist

| Element | Location |
|---|---|
| Provider interface | `services/edge-api/src/providers/formula-one-provider.ts` — `FormulaOneProvider`, with `ProviderSeasonSource`, `ProviderStatus`, `ProviderError`, `ProviderRateLimitedError` |
| Mock provider | `services/edge-api/src/providers/mock/mock-provider.ts` — `MockFormulaOneProvider` |
| Factory seam | `services/edge-api/src/providers/factory.ts` — `resolveProvider(env, config, clock)`, with a test-only `env.__PROVIDER` override |
| Configuration switch | `services/edge-api/src/config/environment.ts` — `resolveProviderMode`, `ProviderMode = 'mock' \| 'none'` |
| Secret names anticipated | `FORMULA_ONE_PROVIDER_API_KEY`, `ADMIN_SYNC_SECRET` (Backend Scheme §23.1). **Neither exists in code, and neither proposed source needs one.** The only implemented secret is `ADMIN_TOKEN`. |
| Normalized domain boundary | `services/edge-api/src/contract/types.ts` — the provider interface returns contract types, so normalization happens inside the adapter |
| Snapshot-writing path | `sync/sync-service.ts` -> `snapshots/generator.ts` -> `publication/publisher.ts` -> `storage/kv.ts` |
| Contract fixtures | `services/edge-api/test/fixtures/api/v1/**` — 30 normalized fixtures, validated by `test/contract/fixtures.test.ts` and `scripts/validate-fixtures.mjs` |

### D.2 Tests a future adapter must satisfy

| Test | Requirement enforced |
|---|---|
| `test/sync/synchronization.test.ts` — "performs no provider call when no scheduled job is due" | Due-calculation gates every upstream call |
| `test/sync/synchronization.test.ts` — "preserves the active snapshot after provider failure" | T2, §10.6 |
| `test/sync/synchronization.test.ts` — "public reads consume no provider quota" | T3 |
| `test/sync/synchronization.test.ts` — "records rate limiting and avoids an immediate retry" | `Retry-After` handling and backoff |
| `test/sync/synchronization.test.ts` — "skips low-priority jobs when quota is high" | T8 |
| `test/sync/synchronization.test.ts` — "runs manual sync through the same orchestration as scheduled sync" | One orchestration path |
| `test/environment.test.ts` — "does not make mock mode a production default", "requires staging to select the provider mode explicitly" | Provider-mode safety |
| `test/config/wrangler-config.test.ts` | Pins the literal `PROVIDER_MODE` values in `wrangler.toml`; **widening the mode union will require updating this test** |
| `test/contract/fixtures.test.ts`, `test/contract/generated-snapshots.test.ts` | T4, §10.8 |

### D.3 Missing seams that would block a clean implementation

Recorded as **Phase 9B** work. None is implemented.

| # | Gap | Detail |
|---|---|---|
| G1 | **No live provider mode** | `validProviderModes` is `['mock', 'none']`. The dual-source model needs at least one live value, and the production guard must be inverted so production selects it rather than `'none'`. `test/config/wrangler-config.test.ts` and `test/environment.test.ts` both pin the current values. |
| G2 | **No credential binding** | Not needed by either proposed source, which is a simplification worth recording: the documented `FORMULA_ONE_PROVIDER_API_KEY` stays unused, and the "no secret in the app" property (Backend Scheme §5.5) becomes trivially true because no secret exists. |
| G3 | **No production cron** | `wrangler.toml` declares `crons` only under `[env.staging.triggers]`. §10.3 needs fine-grained invocation in production (Q1). |
| G4 | **The provider interface cannot express two sources** | `fetchSeasonSource(season, jobs)` demands a whole season from one call and defines no partial-success or per-job failure result. The dual-source model needs per-resource, per-source fetches and a coordinator above them (§10.10). **This is the largest single piece of Phase 9B work.** |
| G5 | **No event-window awareness** | `scheduler.ts` intervals are constants. §10.3 and §10.4 need offsets relative to session end. |
| G6 | **Untyped call counting** | `providerCallCount` casts the provider to `{ callCount?: unknown }` and returns `0` for any adapter that does not expose it, so quota telemetry would silently under-report. Worse with two sources, where per-source attribution is needed. |
| G7 | **No HTTP hardening helper** | Backend Scheme §23.3 requires fixed hostnames, timeouts, redirect limits, content-type validation, response-size limits and header redaction. None exists. Jolpica's mandatory custom `User-Agent` would also live here. |
| G8 | **No provider-ID mapping registry** | Backend Scheme §8.1 requires one. §8.5 proves it is mandatory: 4 of 11 constructor names differ between sources. |
| G9 | **No provenance or provisional/reconciled state** | §10.7 fields do not exist in the local schema, and nothing distinguishes a provisional record from a reconciled one. A schema change is implied — the first since v2. |
| G10 | **No locally-modelled quota state** | `QuotaState` expects values from provider headers; neither source supplies them (§8.6), so counters must be maintained locally per source. |

**None of G1-G10 was implemented, scaffolded or stubbed in this pass.** No
provider client, provider DTO, authentication code, secret name, environment
variable, Worker route, provider-specific mapping, cron trigger, network test or
production configuration was added or changed.
