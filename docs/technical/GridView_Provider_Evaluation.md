# GridView - Formula 1 Data Provider Evaluation

## Document information

- Product: GridView
- Document type: Provider evaluation and legal-gate preparation
- Version: 0.1
- Status: Draft - **no provider is approved**
- Phase: 9A (provider evaluation and legal-gate preparation)
- Related documents:
  - [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3, §7, §14-§17
  - [`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14
  - [`GridView_Backend_Operations.md`](GridView_Backend_Operations.md)
  - [`../adr/0019-formula-one-provider-legal-gate.md`](../adr/0019-formula-one-provider-legal-gate.md)
  - [`../adr/0018-advertising-not-retained-for-v1.md`](../adr/0018-advertising-not-retained-for-v1.md)
- Research access date: **2026-08-19**
- Document date: 2026-08-19

---

## 0. Stop statement

**No Formula 1 data provider is approved, selected for production, subscribed to,
contacted or activated.**

This document is a research and preparation artefact only. Producing it did not
send any message, submit any form, create any account, start any trial, purchase
any plan, accept any terms, request or handle any API key, or call any
authenticated provider endpoint. No production adapter exists and none is
authorized by this document.

Everything below is evidence and analysis assembled to make a later decision
possible. It is not legal advice. The provider question is a documented product
and licensing gate that requires written provider confirmation and, where the
answers remain ambiguous, professional legal review.

---

## 1. Scope

### 1.1 In scope

- Reading the governing GridView documentation and the existing Edge API
  provider abstraction.
- Researching current public provider documentation, pricing and terms.
- Classifying each intended use against published evidence.
- Estimating GridView's expected upstream request volume.
- Recommending a single candidate for a **written legal inquiry**.
- Drafting, but not sending, that inquiry.

### 1.2 Out of scope

- Any purchase, account, trial, credential or provider contact.
- Any production provider adapter, provider DTO, mapping or authentication code.
- Any change to Worker configuration, secrets, routes, cron schedules or
  environment variables.
- Any media, image or logo acquisition or publication.

---

## 2. Intended architecture being assessed

The legal questions in this document are about **this specific architecture**,
not about "using an F1 API" in the abstract. Providers are being asked to
confirm the architecture as described here.

```text
                    Cloudflare (server side)
  Provider  <--(1)--  GridView sync job  --(2)-->  Workers KV snapshots
     ^                (Cron Trigger)                        |
     |                                                     (3)
  API key held only as a Worker secret                      v
                                          GridView public API (/v1/...)
                                                            |
                                                           (4)
                                                            v
                                          GridView Android app (Google Play)
```

1. **Scheduled, server-side fetch only.** A Cloudflare Cron Trigger invokes the
   Worker's scheduled handler, which calls the provider only for synchronization
   jobs that are due. The provider is never called from the mobile application.
2. **Validate, normalize, map.** Provider responses are validated, normalized
   into GridView's own domain model, and mapped from provider identifiers to
   GridView's own stable public identifiers
   ([`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §8). No provider
   DTO reaches the public contract.
3. **Serve normalized snapshots.** The public GridView API serves stored,
   normalized snapshots. Public read traffic performs **zero** upstream provider
   requests
   ([`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §14.2, enforced by
   the test `public reads consume no provider quota`).
4. **Publicly distributed app.** The Android client is intended for public
   distribution on Google Play, free of charge.

Additional properties material to the assessment:

| Property | Statement |
|---|---|
| Credentials | The provider API key lives only in server-side Worker secrets. It is never shipped in the mobile application, never returned by the public API, and never logged. |
| Upstream volume | Independent of the number of app users or app requests. Driven only by the synchronization schedule. |
| Advertising in v1 | **None.** See [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md). No advertising SDK, no consent SDK, no ad unit, no ad request. |
| Future advertising | **Not assumed permitted.** Treated as a separate question requiring its own agreement and its own architecture decision. |
| Historical retention | Intended, if permitted. Snapshots are versioned and retained. |
| Provider images and logos | **Not used.** GridView assumes no image, logo or media rights arrive with a data subscription. Any media follows GridView's own separate rights and publication process ([`GridView_Media.md`](GridView_Media.md)). |
| Attribution | Will be displayed wherever contractually required. |
| Automated tests | Continue to use the mock provider and sanitized fixtures. The mock provider is preserved permanently. |

GridView must **not** be described to a provider as a private prototype. The
intended public Google Play distribution and the server-side redistribution of
normalized data through GridView's own public API are the material facts.

---

## 3. Current Phase 9 requirements

Extracted from
[`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14 and
[`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3, §7, §14-§18.

### 3.1 Legal gate (Implementation Plan §14.2, Backend Scheme §3.2)

Before production activation, GridView must obtain written confirmation of:

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

If approval is not obtained, Plan §14.2 requires selecting another provider
rather than bypassing the requirement.

### 3.2 Technical and operational requirements

| # | Requirement | Source |
|---|---|---|
| T1 | Quota and rate-limit capture: daily limit, daily remaining, per-minute limit, per-minute remaining, usage by job type | Scheme §16 |
| T2 | Provider failure preserves the previous snapshot | Plan §14.8, Scheme §18.1 |
| T3 | Public traffic remains independent of provider request volume | Plan §14.5, Scheme §14.2 |
| T4 | No provider DTO leaks into the GridView public contract | Plan §14.8, Scheme §7.1 |
| T5 | The mock provider is preserved for automated tests | Plan §14.6 |
| T6 | All v1 resources supplied reliably | Plan §14.8 |
| T7 | Provider IDs must not become GridView public IDs | Scheme §7.2, §8.1 |
| T8 | Reserve quota for manual recovery; alert on quota thresholds | Scheme §16.1 |

### 3.3 Product reconciliation

Two documented statements are now in tension and are reconciled here.

- [`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14.2
  requires confirming **"ad-supported use"**, and
  [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §2, §3.1 and §7.3
  repeatedly qualify provider suitability against an **"ad-supported GridView
  release"**. Those statements predate
  [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md).
- [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md) (Accepted,
  2026-08-16) decided that **advertising is not retained for v1**.

**Reconciled position for Phase 9.** The legal gate is assessed against the
product as it will actually ship:

1. GridView v1 contains **no advertising**. Any provider answer that is
   conditional on advertising must be read against a v1 with none.
2. GridView v1 is nevertheless intended for **public Google Play distribution**
   and does **redistribute normalized data** through its own public API. Absence
   of advertising does not by itself make the use non-commercial, and this
   document does not assume that it does.
3. A **possible future advertising model is a separate question**. It is not
   assumed permitted, it is asked about separately in the outreach draft, and it
   would require its own agreement and its own ADR superseding ADR 0018.

The §14.2 wording "Confirm ad-supported use" is therefore treated as **"confirm
the intended use, which for v1 is not ad-supported, and separately establish
whether advertising would change the answer."** The underlying requirement is
unchanged; only the factual premise is corrected.

---

## 4. Evidence classification method

Every legal-use question is classified as exactly one of:

| Classification | Meaning |
|---|---|
| `Explicitly permitted` | An official provider source states the use is allowed. |
| `Explicitly prohibited` | An official provider source states the use is not allowed. |
| `Written permission required` | An official provider source states the use requires contacting the provider or obtaining consent. |
| `Not stated or ambiguous` | No official source addresses it, or official sources are unclear or conflicting. |
| `Not applicable` | The question does not arise for this provider or this use. |

**Silence is never permission.** None of the following is treated as evidence
that GridView may publicly redistribute normalized Formula 1 data:

- a paid plan; an API key; an available endpoint; a public API; a commercial
  pricing tier; a free trial; a request that succeeds.

Where official sources conflict, the contradiction is recorded rather than
resolved in the convenient direction.

### 4.1 Source-quality note for this pass

Sources are ranked as:

- **Primary** - fetched directly from the provider's own documentation, terms,
  pricing or API on the access date, with the URL and date recorded below.
- **Unreachable** - the official source exists but could not be retrieved by any
  method available in this pass. Nothing is asserted from it.

No blog, affiliate comparison, scraped summary or search-result snippet is used
for any decisive claim in this document.

---

## 5. Candidates evaluated

| Provider | Considered because | Evidence status |
|---|---|---|
| API-Sports Formula 1 | The repository's incumbent technical candidate (Backend Scheme §2, §7.2) | **Official sources unreachable** - see §5.1 |
| OpenF1 | Named in Backend Scheme §3.1, §7.3 | Primary sources retrieved |
| Jolpica F1 | Named in Backend Scheme §3.1, §7.3 | Primary sources retrieved |
| Sportmonks Motorsport / Formula 1 | Added this pass: current official documentation, dedicated F1 product covering the v1 resource set, publicly published terms and pricing, and a clear commercial contact path | Primary sources retrieved |

Sportmonks was added under the §5 admission criteria: it has current official
documentation, a plausible technical fit (sessions, classifications, driver and
constructor standings, seasons), publicly available terms, and coverage broad
enough to merit comparison.

Enterprise feeds (Sportradar, SportsDataIO) were **not** evaluated in depth.
Both are quote-based rather than publicly priced, which makes a comparison
impossible without commercial contact, and commercial contact is outside this
pass.

### 5.1 API-Sports: official sources could not be retrieved

Every official API-Sports host returned **HTTP 403** to every retrieval method
available in this pass, on 2026-08-19:

| URL | Result |
|---|---|
| `https://api-sports.io/` | HTTP 403 |
| `https://api-sports.io/terms` | HTTP 403 |
| `https://api-sports.io/pricing` | HTTP 403 |
| `https://api-sports.io/sports/formula-1` | HTTP 403 |
| `https://api-sports.io/documentation/formula-1/v1` | HTTP 403 |
| `https://www.api-football.com/pricing` | HTTP 403 |
| `https://dashboard.api-football.com/` | HTTP 403 |
| `https://v1.formula-1.api-sports.io/status` | HTTP 403 |

The interactive browser channel was also unavailable in this session. The 403
responses are bot-mitigation, not authentication: nothing was logged into, and
no credential was presented or held.

**Consequence.** No current API-Sports statement about terms, licensing,
redistribution, pricing, quotas or endpoints is asserted anywhere in this
document. Every API-Sports row in §6 and §7 is
`Not stated or ambiguous - unverified (official source unreachable 2026-08-19)`.

**This also invalidates the repository's existing API-Sports claims as
evidence.** [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3.1
asserts six specific things about API-Sports terms ("Direct resale of its data
is prohibited", "Users are responsible for obtaining any rights required by
leagues...", and so on) and §7.2 asserts six technical properties. None of these
statements carries a source URL or an access date, and none could be verified in
this pass. They must be treated as **unverified legacy assertions**, not as
findings. This is recorded in §11 as a risk and flagged in the Backend Scheme
itself.

Retrieving the API-Sports terms and pricing requires a person opening the site
in an ordinary browser. That is listed in §12 as a required user action.

---

## 6. Legal-evidence classification

Classifications are per provider, per intended use, against the architecture in
§2. Sources are listed in §10.

### 6.1 API-Sports Formula 1

| # | Intended use | Classification |
|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` - unverified, source unreachable |
| 2 | Non-advertising v1 | `Not stated or ambiguous` - unverified, source unreachable |
| 3 | Future advertising or monetization | `Not stated or ambiguous` - unverified, source unreachable |
| 4 | Server-side caching of normalized data | `Not stated or ambiguous` - unverified, source unreachable |
| 5 | Normalization and derived fields | `Not stated or ambiguous` - unverified, source unreachable |
| 6 | Public redistribution via GridView's own API | `Not stated or ambiguous` - unverified, source unreachable |
| 7 | Historical retention | `Not stated or ambiguous` - unverified, source unreachable |
| 8 | Display of standings, results, schedules | `Not stated or ambiguous` - unverified, source unreachable |
| 9 | Attribution requirement | `Not stated or ambiguous` - unverified, source unreachable |
| 10 | Termination and deletion obligations | `Not stated or ambiguous` - unverified, source unreachable |
| 11 | Usage-reporting requirements | `Not stated or ambiguous` - unverified, source unreachable |
| 12 | Images and logos | `Not stated or ambiguous` - unverified, source unreachable |
| 13 | Geographic restrictions | `Not stated or ambiguous` - unverified, source unreachable |
| 14 | App-store distribution | `Not stated or ambiguous` - unverified, source unreachable |
| 15 | Formula 1 rights remain the customer's responsibility | `Not stated or ambiguous` - unverified, source unreachable |

### 6.2 OpenF1

| # | Intended use | Classification | Basis |
|---|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` | Distribution channel is not addressed; the commercial character of the use is what the terms turn on. |
| 2 | Non-advertising v1 | `Not stated or ambiguous` | Stated intended use is "educational purposes, personal learning projects, research, and non-commercial fan engagement". Whether a free, ad-free, publicly distributed app qualifies as non-commercial is not stated. |
| 3 | Future advertising or monetization | `Explicitly prohibited` without a separate licence | The licence is CC BY-NC-SA 4.0; NC excludes use primarily directed toward commercial advantage or monetary compensation. `Written permission required` to proceed at all. |
| 4 | Server-side caching of normalized data | `Not stated or ambiguous` | Not addressed. |
| 5 | Normalization and derived fields | `Not stated or ambiguous` | Not addressed for the act itself, but the **ShareAlike** term applies to the result: adaptations must be shared under the same licence, which conflicts with GridView serving them under its own terms. |
| 6 | Public redistribution via GridView's own API | `Written permission required` | Redistribution of an adaptation is constrained by BY-NC-SA. Official text directs "other use cases" to contact to "discuss appropriate licensing". |
| 7 | Historical retention | `Not stated or ambiguous` | Not addressed; historical coverage begins at the 2023 season. |
| 8 | Display of standings, results, schedules | `Not stated or ambiguous` | Permitted within the NC licence; the NC status of GridView's use is the open question. |
| 9 | Attribution requirement | `Explicitly permitted`, with attribution **required** | BY term of CC BY-NC-SA 4.0. |
| 10 | Termination and deletion obligations | `Not stated or ambiguous` | Not addressed. |
| 11 | Usage-reporting requirements | `Not applicable` | No account or reporting is required for the free tier. |
| 12 | Images and logos | `Not applicable` | OpenF1 supplies no images or logos. It explicitly disclaims ownership of Formula 1 trademarks. |
| 13 | Geographic restrictions | `Not stated or ambiguous` | Not addressed. |
| 14 | App-store distribution | `Not stated or ambiguous` | Not addressed. |
| 15 | Formula 1 rights remain the customer's responsibility | `Explicitly` so | The project states it is unofficial and does not claim ownership of Formula 1 data, trademarks or broadcasts. |

### 6.3 Jolpica F1

| # | Intended use | Classification | Basis |
|---|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` | Not addressed; the commercial character governs. |
| 2 | Non-advertising v1 | `Not stated or ambiguous` | "The API is freely available for non-commercial use." Whether a free, ad-free, publicly distributed app is non-commercial is not stated. |
| 3 | Future advertising or monetization | `Written permission required` | "For commercial usage, please contact us via admin@jolpi.ca". |
| 4 | Server-side caching of normalized data | `Explicitly permitted` and encouraged | The rate-limit guide's first recommendation is "Implement a cache to store results." |
| 5 | Normalization and derived fields | `Not stated or ambiguous` | Not addressed for the act itself; **ShareAlike** (CC BY-NC-SA 4.0) applies to the result. |
| 6 | Public redistribution via GridView's own API | `Written permission required` | Constrained by BY-NC-SA; commercial usage is directed to the contact address. |
| 7 | Historical retention | `Not stated or ambiguous` | Not addressed. Coverage extends to 1950. |
| 8 | Display of standings, results, schedules | `Not stated or ambiguous` | Permitted within the NC licence; NC status is the open question. |
| 9 | Attribution requirement | `Explicitly permitted`, with attribution **required** | BY term of CC BY-NC-SA 4.0. |
| 10 | Termination and deletion obligations | `Not stated or ambiguous` | The terms reserve the right to block for abuse and to change the terms; they do not state deletion obligations. |
| 11 | Usage-reporting requirements | `Explicitly` required in a limited form | A custom `User-Agent` identifying the application and version is mandatory. |
| 12 | Images and logos | `Not applicable` | Jolpica supplies no images or logos. |
| 13 | Geographic restrictions | `Not stated or ambiguous` | Not addressed. |
| 14 | App-store distribution | `Not stated or ambiguous` | Not addressed. |
| 15 | Formula 1 rights remain the customer's responsibility | `Not stated or ambiguous` | Not addressed directly; the terms disclaim all warranties and liability. |

**Additional Jolpica risk.** The terms state the project is volunteer-run and
donation-supported, and explicitly **do not guarantee uptime, availability or
correctness**, with use "entirely at your own risk". The rate-limit guide
further states that current limits "**will decrease** in the future".

### 6.4 Sportmonks

| # | Intended use | Classification | Basis |
|---|---|---|---|
| 1 | Public Google Play distribution | `Not stated or ambiguous` | No clause addresses app-store distribution specifically. |
| 2 | Non-advertising v1 | `Explicitly permitted` | The service is offered for building "apps, websites, games". Non-commercial use is a subset of what is allowed. |
| 3 | Future advertising or monetization | `Explicitly permitted` in principle | Creating something from the data and "earning money from your creation" is permitted. This does **not** extend to reselling the data itself. |
| 4 | Server-side caching of normalized data | `Explicitly permitted` | "Distribution, transfer, and storage of data provided by our services is allowed". |
| 5 | Normalization and derived fields | `Explicitly permitted` | Building a creation on the data is the stated purpose. |
| 6 | Public redistribution via GridView's own API | **`Not stated or ambiguous` - this is the decisive question** | "Distribution, transfer, and storage ... is allowed" appears to permit it; "reselling the product is forbidden without our consent" and "you cannot directly sell the data we provide" appear to constrain it. GridView does not sell data, but serving normalized data through its own public API sits between the two clauses. The terms invite exactly this question: users uncertain about compliance should "explain your plan and ask if this is allowed." |
| 7 | Historical retention | `Not stated or ambiguous` | Only addressed for tournament packages, where removing data after a tournament concludes is described as the customer's responsibility if access is no longer required. General snapshot retention is not addressed. |
| 8 | Display of standings, results, schedules | `Explicitly permitted` | Within the permitted app use. |
| 9 | Attribution requirement | `Explicitly` required **for logos and photos** | "Clearly attribute the logos and photos to their respective owners." Attribution for data is `Not stated or ambiguous`. |
| 10 | Termination and deletion obligations | Partially `Explicitly` stated | Accounts may be terminated immediately for direct violation of the terms. Post-termination deletion of cached data is `Not stated or ambiguous`. |
| 11 | Usage-reporting requirements | `Not stated or ambiguous` | Not addressed. |
| 12 | Images and logos | `Explicitly prohibited` without separate rights | "All logos and profile photos are copyrighted by their legal owner. To display these types of content in your app or website, you have to arrange proof of intellectual property yourself." This matches GridView's own position exactly: no media rights are assumed to arrive with the data subscription. |
| 13 | Geographic restrictions | `Not stated or ambiguous` | Not addressed. |
| 14 | App-store distribution | `Not stated or ambiguous` | Not addressed. |
| 15 | Formula 1 rights remain the customer's responsibility | `Not stated or ambiguous`, leaning to yes | The terms disclaim responsibility for losses and, for media, place the IP burden on the customer. They do not make a general statement about competition-data rights. |

### 6.5 Cross-provider summary

| Intended use | API-Sports | OpenF1 | Jolpica | Sportmonks |
|---|---|---|---|---|
| Non-advertising v1 public app | unverified | ambiguous | ambiguous | permitted |
| Server-side caching | unverified | ambiguous | permitted | permitted |
| Public redistribution via GridView's API | unverified | written permission | written permission | **ambiguous - decisive question** |
| Future advertising | unverified | prohibited without licence | written permission | permitted in principle |
| Historical retention | unverified | ambiguous | ambiguous | ambiguous |
| Attribution | unverified | required | required | required for media |
| Images and logos | unverified | not applicable | not applicable | excluded, own rights required |
| F1 competition rights are the customer's | unverified | yes | ambiguous | leaning yes |

**No cell in this table reads `Explicitly permitted` for public redistribution
through GridView's own API. That is the gate, and it is open for all four
candidates.**

---

## 7. Technical coverage matrix

`unverified` means the capability could not be confirmed from an official source
in this pass. It is **not** inferred from endpoint names.

| Capability | API-Sports | OpenF1 | Jolpica | Sportmonks |
|---|---|---|---|---|
| Seasons | unverified | 2023 onward | 1950 onward | available |
| Calendar and rounds | unverified | via `meetings` / `sessions` | `/races/` with round numbers | fixtures per session |
| Grand Prix detail | unverified | meeting + session objects | race object with circuit and location | fixture with venue and state |
| Practice sessions | unverified | yes (`session_type`) | yes (`FirstPractice`, `SecondPractice`, `ThirdPractice`) | yes (practice fixtures) |
| Qualifying | unverified | yes | yes (`Qualifying`) | yes |
| Sprint | unverified | yes | yes (`Sprint`, `SprintQualifying`/`SprintShootout`) | yes |
| Race | unverified | yes | yes | yes |
| Completed results | unverified | classification data | `/results/` | classification per fixture |
| Future events without results | unverified | yes - sessions listed ahead of time | yes - races listed with dates and no results | unverified |
| Postponed events | unverified | unverified | unverified - Ergast schema has no status field | fixture `state` exists; postponed semantics unverified |
| Cancelled events | unverified | **yes** - `is_cancelled` field on session objects | unverified | fixture `state` exists; cancelled semantics unverified |
| Driver standings | unverified | championship standings endpoint present | `/{season}/driverstandings/` | `/v3/motorsport/standings/drivers/seasons/{id}` |
| Constructor standings | unverified | unverified | `/{season}/constructorstandings/` | `/v3/motorsport/standings/teams/seasons/{id}` |
| Drivers | unverified | yes | `/drivers/` | yes, with official driver photo |
| Constructors / teams | unverified | yes | `/constructors/` | yes, with constructor crests |
| Circuits | unverified | circuit key and short name on sessions | `/circuits/` with lat/long and locality | venue on fixture |
| Mid-season substitutions | unverified | unverified | unverified | unverified |
| Provisional classifications | unverified | unverified | unverified | unverified |
| Stable provider identifiers | unverified | integer keys (`session_key`, `meeting_key`, `circuit_key`) | string slugs (`hamilton`, `monza`) | integer IDs |
| Pagination | unverified | unverified | `limit` (default 30, max 100) and `offset` | `select` and `include`; max 2 nested includes; pagination unverified |
| Quota headers | unverified | unverified | unverified | unverified |
| Update timestamps | unverified | `date_start` / `date_end` per session | date and time per session | fixture start time |
| Time zones | unverified | UTC plus `gmt_offset` | UTC times | unverified |
| Error formats | unverified | unverified | HTTP 429 with "Request was throttled" | unverified |
| Response-size controls | unverified | unverified | `limit` parameter | `select` parameter |
| Rate limits | unverified | 3 req/s, 30 req/min free; 6 req/s, 60 req/min sponsor | 4 req/s burst, 500 req/hour sustained, unauthenticated | 2,000-3,000 calls/hour - **see pricing conflict in §8.5** |
| Historical depth | unverified | 2023 onward | 1950 onward | unverified |
| Authentication | unverified | none required (free tier) | none required; custom `User-Agent` mandatory | API token |

### 7.1 Coverage against GridView's v1 resource set

GridView v1 needs: current-season calendar, session schedules, Grand Prix
detail, results, driver standings, constructor standings, drivers,
constructors, circuits.

| Provider | Covers the full v1 set? |
|---|---|
| API-Sports | unverified |
| OpenF1 | **Not demonstrated.** Constructor standings could not be confirmed from an official source, and historical depth starts at 2023. Its strengths (telemetry, radio, weather) are not v1 requirements. |
| Jolpica | **Yes** - all nine v1 resources are covered by documented endpoints, with session times, sprint support and 1950-onward depth. |
| Sportmonks | **Yes** for the data set; driver photos and constructor crests are additionally offered but are explicitly excluded from GridView's use under §6.4 row 12. |

---

## 8. Pricing and quota evidence

All figures are as published on the access date **2026-08-19**. Prices are
time-sensitive and must be re-verified before any purchase decision.

### 8.1 API-Sports

**Unverified.** No official pricing page could be retrieved (§5.1). No plan
name, price, currency, billing period or quota is asserted here.

### 8.2 OpenF1

| Plan | Price | Currency | Billing period | Quota / limits |
|---|---|---|---|---|
| Community | Free | - | - | All 18 endpoints, all historical sessions since 2023, JSON and CSV, no authentication, up to 3 requests/second and 30 requests/minute |
| Sponsor | 9.90 | EUR | per month | Everything in Community, plus live data during sessions via REST, MQTT and WebSocket; up to 6 requests/second and 60 requests/minute; up to 10 concurrent MQTT/WebSocket connections |

No daily or monthly cap is published. Overage behaviour is `unverified`.

### 8.3 Jolpica

| Plan | Price | Currency | Billing period | Quota / limits |
|---|---|---|---|---|
| Unauthenticated public access | Free | - | - | Burst 4 requests/second; sustained 500 requests/hour. Exceeding returns HTTP 429. |
| API token access | Not yet available | - | - | Stated as "currently in the process of implementing"; will provide higher limits than unauthenticated access |
| Commercial | Not published | - | - | Requires contacting `admin@jolpi.ca` |

Overage behaviour: HTTP 429 throttling; abuse "may result in temporary or
permanent blocking", possibly without notice. Published limits are stated to be
subject to change and are expected to **decrease**.

### 8.4 Sportmonks

| Plan | Price | Currency | Billing period | Quota / limits |
|---|---|---|---|---|
| Full Season F1 (product page) | 69 | EUR, excl. VAT | per month | Every race weekend session of the season; classifications, drivers, constructors with photos; 2,000 API calls per hour per endpoint; 7-day human support |
| Full Season F1, yearly (product page) | 830 per year, presented as 69/12 months | EUR, excl. VAT | per year | as above |
| Motorsport API (documentation page) | 79 | EUR | per month | 3,000 API calls per hour |

Trial: a free trial is offered, with an API token issued instantly, no credit
card and no sales call. Trial restrictions are `unverified`.

Overage behaviour: `unverified`. Support channel: 7-day human support (product
page). Contract or enterprise requirement: not stated for these tiers.

### 8.5 Recorded source conflict

Two official Sportmonks pages, both retrieved on 2026-08-19, state different
prices and different hourly quotas for what appears to be the same subscription:

- The Formula 1 product page states **EUR 69/month** with **2,000 API calls per
  hour per endpoint**.
- The Motorsport API standings documentation states standings endpoints require
  an active Motorsport API subscription at **EUR 79/month** with **3,000 API
  calls per hour**.

This contradiction is recorded, not resolved. It may reflect two distinct
products (a Formula 1 season package versus the full Motorsport API), or a stale
page. **Which subscription actually grants the driver and constructor standings
endpoints GridView requires is an open commercial question** and is included in
the outreach draft.

### 8.6 What is not being recommended

No plan is recommended for purchase. Plan sufficiency is assessed in §9.6
purely as engineering input; the legal gate in §6 is unsatisfied for every
candidate, and Implementation Plan §14.2 places legal approval before
implementation.

---

## 9. Expected quota requirement

### 9.1 Method

The model is derived from GridView's own synchronization design, not from
invented traffic. Two schedules exist and are modelled separately:

- The **documented** event-aware refresh policy in
  [`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §15.
- The **implemented** static scheduler in
  `services/edge-api/src/sync/scheduler.ts`, which has fixed intervals and no
  event awareness.

Public request volume is excluded by design: public reads perform zero upstream
requests (Backend Scheme §14.2), so **no term in this model depends on the
number of app users**.

### 9.2 Assumptions

| # | Assumption | Basis |
|---|---|---|
| A1 | 24 Grands Prix per season, of which 6 are sprint weekends | Typical current-era calendar; not provider-specific |
| A2 | The season spans about 9 months, averaging 2 race weekends per calendar month during the season | Derived from A1 |
| A3 | Sessions actively polled for results and standings: qualifying, sprint (when present) and race. Practice sessions need schedule data only. | Backend Scheme §15.1: GridView is not a live-timing product |
| A4 | An active session polling window is 3 hours at a 10-minute cadence | Backend Scheme §15 "Every 5-10 minutes for a limited window", conservative end |
| A5 | A post-session finalization window is 4 hours at a 15-minute cadence | Backend Scheme §15 "until stable" |
| A6 | Cron invokes the Worker every 15 minutes; due-calculation decides whether any upstream call happens | Backend Scheme §15.2 worked example |
| A7 | Upstream request cost per job category, as in the table below | **Estimated, not measured. See §9.7.** |

### 9.3 Upstream request cost per synchronization job

The mock provider currently charges **one unit per due job category**. A real
adapter will issue one or more HTTP requests per job. The conservative estimate
used here:

| Job category (`SyncJobCategory`) | Estimated upstream requests | Rationale |
|---|---:|---|
| `season-calendar` | 1 | one season-races call |
| `event-schedule` | 1 | one session-times call |
| `profiles` | 3 | drivers + constructors + circuits |
| `standings` | 2 | driver standings + constructor standings |
| `results` | 2 | race result + sprint result |
| `home-rebuild` | 0 | derived locally from stored snapshots |

### 9.4 Scenario table - documented event-aware policy

Formulas use `requests = cadence_per_day x cost_per_job`, summed over jobs.

| Scenario | Formula | Requests |
|---|---|---:|
| **S1 - Normal off-event day** | calendar `4x1` + schedule `4x1` + standings `4x2` + results `0` + profiles `3/7` + season metadata `1x1` | **~17 / day** |
| **S2 - Race-week build-up day** (Mon-Thu of a race week) | calendar `12x1` + schedule `48x1` + standings `24x2` + season metadata `1` | **~109 / day** |
| **S3 - Active session window** (per polled session, A4) | standings `18x2` + results `18x2` + schedule `12x1` | **84 / session** |
| **S4 - Post-session finalization** (per polled session, A5) | results `16x2` + standings `16x2` | **64 / session** |
| **S5 - Manual recovery reserve** | 20% of the daily plan allowance, floor 100 | **>=100 / day held back** |
| **S6 - One complete bootstrap or snapshot rebuild** | calendar `1` + profiles `3` + standings `2` + results `24 rounds x 2` = 54, plus pagination headroom | **<=80 / rebuild** |

### 9.5 Daily peak and monthly total

**Daily peak** - a race day with two polled sessions (qualifying-day or
race-day):

```text
S2 base 109 + 2 x (S3 84 + S4 64) = 109 + 296 = 405 requests/day
```

A three-session day (sprint weekend) reaches `109 + 3 x 148 = 553 requests/day`.

**Monthly total** - a season month containing two race weekends:

| Component | Formula | Requests |
|---|---|---:|
| Race-weekend days (Fri-Sun) | `2 weekends x 3 days x 109` | 654 |
| Session windows | `2 weekends x 3 sessions x (84 + 64)` | 888 |
| Build-up days (Mon-Thu) | `2 weekends x 4 days x 109` | 872 |
| Remaining off-event days | `16 days x 17` | 272 |
| Bootstraps / rebuilds | `2 x 80` | 160 |
| **Season-month subtotal** | | **2,846** |
| **With 2x safety margin** | | **~5,700 / month** |

Off-season month: `30 x 17 + 80` = **590 / month**, or ~1,200 with the same
margin.

**Recommended safety margin: 2x.** It absorbs the A7 per-job cost estimate being
wrong by up to a factor of two, plus retries, pagination and recovery runs.

### 9.6 Which plans appear technically sufficient

Assessed against a **peak of ~810 requests/day** (405 x 2 margin) and **~5,700
requests/month**:

| Provider | Published limit | Sufficient? |
|---|---|---|
| API-Sports | unverified | **Cannot be assessed.** |
| OpenF1 free (3 req/s, 30 req/min) | 43,200/day theoretical | Ample on rate, but the licence gate in §6.2, not quota, is the blocker. |
| Jolpica unauthenticated (4 req/s, 500 req/hour) | 12,000/day theoretical | Ample on rate. Note the published intention that limits **will decrease**. |
| Sportmonks (2,000-3,000 calls/hour) | 48,000-72,000/day theoretical | Ample on rate. |

Rate capacity is not the constraining factor for any assessable candidate. The
constraint is licensing.

### 9.7 Labelled missing decisions

The model is bounded, not exact. Four inputs are undecided and each is flagged:

| # | Missing decision | Effect on the model |
|---|---|---|
| Q1 | **Actual upstream request cost per job category.** A7 is an estimate. Only a real adapter against a chosen provider settles it. | Scales the whole model linearly. The 2x margin is sized for this. |
| Q2 | **Production cron cadence.** `wrangler.toml` declares a cron only for staging (`17 3 * * *`, once daily). **Production declares no cron trigger at all.** A6's 15-minute cadence is the documented example, not configured reality. | Determines whether the documented policy in §9.4 can even be executed. |
| Q3 | **Event-window awareness.** The implemented scheduler has fixed intervals only. See §9.8. | Determines whether S1/S2/S3 differentiation exists at all. |
| Q4 | **Whether `results` must backfill every round or only recent rounds.** S6 assumes a full 24-round backfill per rebuild. | Bounds rebuild cost between ~10 and ~80 requests. |

Configuring cron schedules or quotas in production is **not** part of this pass
and was not done.

### 9.8 The implemented scheduler costs more than the documented policy

`services/edge-api/src/sync/scheduler.ts` uses fixed intervals with no event
awareness:

| Job | Implemented interval |
|---|---|
| `season-calendar` | 6 hours |
| `event-schedule` | 1 hour |
| `profiles` | 24 hours |
| `standings` | 15 minutes |
| `results` | 15 minutes |
| `home-rebuild` | 5 minutes |

Under A6 (cron every 15 minutes), this schedule would run standings and results
**every single cycle, every day of the year**:

```text
standings   96 cycles x 2 = 192
results     96 cycles x 2 = 192
schedule    24 cycles x 1 =  24
calendar     4 cycles x 1 =   4
profiles     1 cycle  x 3 =   3
                        -------
                            415 requests/day  ->  ~12,450/month
```

That is **24x the off-event day cost** of the documented policy and ~4x the
modelled monthly total, because it polls standings and results at race-day
cadence in February. Making the scheduler event-aware is Phase 9B work (§11.3),
not a defect introduced here - the current mock-only configuration never
exercises it against a metered provider.

---

## 10. Official sources

All accessed **2026-08-19**. Every decisive claim in this document traces to a
row here.

| # | Provider | URL | Page title | Statement type | Paraphrase |
|---|---|---|---|---|---|
| S1 | OpenF1 | `https://openf1.org/` | OpenF1 API \| The open source API for Formula 1 data | Explicit | Licensed under CC BY-NC-SA 4.0; intended for educational, personal-learning, research and non-commercial fan-engagement use; unofficial and not affiliated with Formula One World Championship Limited; does not claim ownership of Formula 1 data, trademarks or broadcasts; Community tier free with 18 endpoints, historical sessions since 2023, no authentication, 3 req/s and 30 req/min; Sponsor tier EUR 9.90/month adding live data and 6 req/s, 60 req/min. |
| S2 | OpenF1 | `https://api.openf1.org/v1/sessions?year=2026` | (JSON API response) | Explicit | The `sessions` endpoint returns session objects carrying `session_key`, `session_type`, `session_name`, `date_start`, `date_end`, `meeting_key`, `circuit_key`, `circuit_short_name`, `country_*`, `location`, `gmt_offset`, `year` and `is_cancelled`. Confirms session-schedule coverage, UTC offsets and an explicit cancellation flag. |
| S3 | Jolpica F1 | `https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md` | Jolpica-F1 API - Terms of Use (last updated 27 August 2025) | Explicit | Freely available for non-commercial use; data licensed CC BY-NC-SA 4.0; commercial usage requires contacting `admin@jolpi.ca`; the project reserves the right to change the terms; volunteer-run and donation-supported with no guarantee of uptime, availability or correctness; use entirely at the user's own risk. |
| S4 | Jolpica F1 | `https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md` | Rate Limits | Explicit | Unauthenticated burst limit 4 requests/second, sustained 500 requests/hour; HTTP 429 on breach; limits subject to change and expected to decrease as token access rolls out; caching results is the first recommended mitigation. |
| S5 | Jolpica F1 | `https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md` | jolpica-f1 Documentation | Explicit | Thirteen Ergast-compatible endpoints (circuits, constructors, constructor standings, drivers, driver standings, laps, pitstops, qualifying, races, results, seasons, sprint, status); shared `limit` (default 30, max 100) and `offset` query parameters; a custom identifying `User-Agent` is required. |
| S6 | Jolpica F1 | `https://github.com/jolpica/jolpica-f1/blob/main/docs/endpoints/races.md` | Races | Explicit | Race objects carry season, round, raceName, Circuit (with locality and coordinates), date and optional UTC time, plus optional `FirstPractice`, `SecondPractice`, `ThirdPractice`, `Qualifying`, `Sprint` and `SprintQualifying`/`SprintShootout` session objects. Historical coverage from 1950. |
| S7 | Sportmonks | `https://www.sportmonks.com/formula-one-api/` | Formula 1 API \| Live F1 Race Data & Results \| Sportmonks | Explicit | Every race-weekend session modelled as a fixture; per-driver timing and entry-list data; official driver photos and constructor crests; Full Season F1 plan at EUR 69/month (EUR 830 billed yearly), excluding VAT, with 2,000 API calls per hour per endpoint; free trial with an instant API token, no credit card. |
| S8 | Sportmonks | `https://www.sportmonks.com/terms-of-service/` | Sportmonks Terms of Service (no last-updated date shown) | Explicit | Data may be used to build apps, websites and games, and earning money from the creation is permitted; distribution, transfer and storage of the data is allowed; reselling the product is forbidden without consent and the data may not be sold directly; users unsure about compliance are invited to explain their plan and ask; logos and profile photos are copyrighted by their legal owner and the customer must arrange proof of intellectual property and clearly attribute them; accounts may be terminated immediately for direct violation. |
| S9 | Sportmonks | `https://docs.sportmonks.com/v3/motorsport-api/endpoints-and-entities/endpoints/standings` | Standings \| Motorsport API 3.0 | Explicit | Four standings endpoints covering all driver standings, driver standings by season, all team standings and team standings by season, at `/v3/motorsport/standings/drivers/seasons/{id}` and `/v3/motorsport/standings/teams/seasons/{id}`; fields include `participant_id`, `position`, `points`, `stage_id`; maximum two nested includes; states an active Motorsport API subscription at EUR 79/month with 3,000 API calls/hour is required. |
| S10 | API-Sports | `https://api-sports.io/terms`, `https://api-sports.io/pricing`, `https://api-sports.io/documentation/formula-1/v1`, `https://api-sports.io/sports/formula-1`, `https://api-sports.io/`, `https://www.api-football.com/pricing`, `https://dashboard.api-football.com/`, `https://v1.formula-1.api-sports.io/status` | (not retrieved) | **Unreachable** | All eight official endpoints returned HTTP 403 to every retrieval method available in this pass on 2026-08-19. No API-Sports statement is asserted anywhere in this document. |

### 10.1 Ambiguities requiring written confirmation

| # | Provider | Ambiguity |
|---|---|---|
| X1 | Sportmonks | Whether serving normalized data through GridView's own public API is permitted "distribution" or prohibited "resale". **Decisive.** |
| X2 | Sportmonks | Which subscription grants the standings endpoints, at which price and hourly quota (§8.5 conflict). |
| X3 | Sportmonks | Whether cached snapshots must be deleted on termination, and whether historical snapshots may be retained indefinitely. |
| X4 | Sportmonks | Whether Formula 1 competition-data rights remain the customer's responsibility, as they explicitly do for logos and photos. |
| X5 | OpenF1, Jolpica | Whether a free, ad-free, publicly distributed Google Play application is "non-commercial" under CC BY-NC-SA 4.0. |
| X6 | OpenF1, Jolpica | Whether ShareAlike obliges GridView to license its normalized public API output under CC BY-NC-SA 4.0. |
| X7 | API-Sports | Everything. No current statement could be read. |

---

## 11. Risks and unknowns

### 11.1 Legal risks

| # | Risk | Severity |
|---|---|---|
| R1 | **No candidate explicitly permits the intended public redistribution.** Every candidate is ambiguous or requires written permission. Proceeding without confirmation risks operating a public service outside its data licence. | Critical - this is the gate |
| R2 | **Formula 1 competition-data rights are separate from any provider subscription** and are unresolved for all four candidates. A data subscription is not a rights clearance. | Critical |
| R3 | **The repository's existing API-Sports legal claims are unsourced and unverified** (§5.1). Any decision resting on Backend Scheme §3.1 as written would rest on assertions with no citation and no access date. | High |
| R4 | CC BY-NC-SA ShareAlike may propagate to GridView's own API output (X6), constraining GridView's ability to set its own terms. | High for OpenF1 and Jolpica |
| R5 | Future advertising is foreclosed or renegotiation-dependent under the NC candidates and unconfirmed for the others. ADR 0018 keeps v1 clean, but a later reversal would reopen the provider question entirely. | Medium |
| R6 | Sportmonks' terms show no last-updated date, so their currency cannot be established. | Medium |
| R7 | Jolpica's terms explicitly reserve the right to change, and its rate limits are stated to be heading downward. | Medium |

### 11.2 Commercial risks

| # | Risk |
|---|---|
| R8 | API-Sports pricing and quotas are entirely unverified; the repository's "low entry price" premise cannot be checked. |
| R9 | Sportmonks publishes two conflicting prices and quotas for what may be the same subscription (§8.5). |
| R10 | Jolpica has no published commercial tier at all; a commercial price is unknown until the project is contacted. |
| R11 | OpenF1's Sponsor tier is priced for live data GridView does not need; there is no commercial tier for GridView's actual use. |

### 11.3 Technical risks and structural gaps

| # | Gap | Owner |
|---|---|---|
| R12 | `ProviderMode` admits only `'mock'` and `'none'`. There is no mode that selects a live provider, and production is hard-configured to `'none'`. A real adapter cannot be selected without extending this union. | Phase 9B |
| R13 | No provider credential binding exists in `Env`. Documentation anticipates `FORMULA_ONE_PROVIDER_API_KEY` (Backend Scheme §23.1) but no code reads it and no secret is declared. | Phase 9B |
| R14 | **Production declares no cron trigger.** Only staging has one, once daily. Nothing would drive synchronization in production today. | Phase 9B |
| R15 | The scheduler is not event-aware (§9.8), so it would consume race-day cadence year-round. | Phase 9B |
| R16 | `FormulaOneProvider.fetchSeasonSource` returns the **entire season source in one call**. A real adapter must fan out to many upstream endpoints internally and reconcile partial failures behind a single-call interface. Partial-failure semantics are undefined. | Phase 9B |
| R17 | `QuotaState` expects daily and per-minute limits and remaining counts. Whether any candidate exposes these as response headers is `unverified` for all four. If a provider does not, quota state must be derived locally. | Phase 9B |
| R18 | `providerCallCount` reads an untyped optional `callCount` property off the provider via a cast. It is a mock-only affordance, not part of the interface, and silently reports `0` for any adapter that does not expose it. | Phase 9B |

---

## 12. Preferred candidate for written inquiry

### 12.1 Outcome

**Sportmonks is the preferred candidate for written legal inquiry.**

This is **not** production-provider approval, not a selection, and not a
recommendation to purchase. It identifies who to ask first.

### 12.2 The recommendation separated into its parts

**Technical preference.** *Unsettled between API-Sports and Jolpica.* The
repository's stated technical preference is API-Sports (Backend Scheme §7.2),
but no part of that preference could be verified in this pass. Of the candidates
whose capabilities could actually be read, **Jolpica has the cleanest fit** for
GridView's v1 resource set: all nine resources, session-level schedules
including sprint variants, stable string identifiers, explicit pagination, and
1950-onward depth. Sportmonks also covers the set. OpenF1 does not demonstrably
cover constructor standings and starts at 2023.

**Commercial fit.** *Sportmonks is the only candidate with published commercial
pricing that could be read* - albeit with the §8.5 conflict. Jolpica has no
published commercial tier. OpenF1's paid tier does not address GridView's use
case. API-Sports is unverified.

**Licensing certainty.** *Sportmonks is materially ahead, and still
insufficient.* It is the only candidate whose official terms affirmatively
permit commercial use, storage and distribution, and it is the only one whose
media position (logos and photos require the customer's own IP proof and
attribution) already matches GridView's documented assumption. Its single
decisive ambiguity - distribution versus resale (X1) - is a sharply formed
question a support or commercial contact can answer in writing. By contrast,
OpenF1 and Jolpica both carry a categorical NonCommercial licence plus a
ShareAlike obligation, which is two structural questions rather than one, and
API-Sports offers nothing readable at all.

**Outstanding questions.** X1 through X4 for Sportmonks; X5 and X6 if the NC
candidates are revisited; X7 in full for API-Sports.

**Risks.** R1, R2 and R6 apply to Sportmonks. R2 in particular is unresolved for
every candidate and is not something a data provider can grant.

### 12.3 Why Sportmonks is not approved

1. The decisive question (X1) is **unanswered**. GridView's public API sits
   between an explicit permission ("distribution, transfer, and storage ... is
   allowed") and an explicit prohibition ("reselling the product is forbidden
   without our consent"). Reading the permissive clause as covering GridView's
   architecture would be exactly the inference §4 forbids.
2. **Formula 1 competition-data rights (R2) remain unresolved** and no data
   subscription resolves them.
3. **Pricing is contradictory across two official pages** (§8.5), so the
   commercially correct subscription is not established.
4. **The terms carry no last-updated date** (R6), so their currency is unknown.
5. Nothing has been asked, and no written answer exists.

### 12.4 Evidence that would change the recommendation

| If this becomes true | Then |
|---|---|
| Sportmonks confirms in writing that GridView's normalized public API is permitted distribution and not prohibited resale | Sportmonks becomes the candidate for provider selection, subject to R2 and a commercial decision |
| Sportmonks answers that it **is** prohibited resale | Sportmonks is rejected; re-open with API-Sports once its terms are readable |
| API-Sports terms and pricing become readable and permit the architecture | API-Sports returns as the leading candidate, consistent with the repository's existing technical preference |
| Jolpica grants written commercial permission on terms compatible with GridView setting its own API terms | Jolpica becomes viable and is the strongest **technical** fit |
| Any candidate confirms that F1 competition-data rights must be licensed separately by GridView | That becomes a product-level blocker for **all** candidates and requires a separate decision about whether GridView can ship at all with live competition data |

### 12.5 Required user actions before Phase 9B

| # | Action | Why it needs the user |
|---|---|---|
| U1 | Review and approve or amend the outreach draft in Appendix A | Sending is explicitly outside this pass |
| U2 | **Send** the inquiry to Sportmonks via the contact path in Appendix B | Contacting a provider is a hard boundary here |
| U3 | Open `api-sports.io/terms` and `api-sports.io/pricing` in an ordinary browser and record what they say | Automated retrieval is blocked (§5.1); this cannot be done from this environment |
| U4 | Decide whether to open a parallel inquiry to API-Sports and Jolpica, or to serialize | A commercial and time-management decision |
| U5 | Decide whether GridView will independently seek Formula 1 competition-data clearance (R2), and whether it will accept legal review | A product and possibly legal-counsel decision |
| U6 | Decide Q2 - whether production gets a cron trigger, and at what cadence | Affects §9 and Phase 9B scope |

---

## Appendix A - Unsent provider outreach draft

> **Status: DRAFT. NOT SENT.** This message has not been sent, submitted,
> emailed or entered into any form. No account exists and no trial has been
> started. It is recorded here for review.

**Recipient:** Sportmonks support or commercial contact (see Appendix B)
**Subject:** Licensing confirmation request - server-side use of Formula 1 data in a free public Android application

---

Hello,

I am building **GridView**, a free Formula 1 companion application for Android.
Before subscribing to any plan, I would like written confirmation that my
intended architecture and use are permitted under your terms. I would rather ask
first than assume, and your terms invite exactly this.

**What GridView is**

A free Android application, intended for public distribution on Google Play.
There is no charge to users, no in-app purchase and no subscription. Version 1
contains **no advertising**: there is no advertising SDK, no consent SDK, no ad
unit and no ad request in the application.

**How the data would be used - architecture summary**

1. Your API would be called **only from my own server-side backend**, a
   Cloudflare Worker. The mobile application never calls your API.
2. The API key would be stored **only as a server-side secret**. It would never
   be shipped in the mobile application, never returned in any response and
   never written to logs.
3. A **scheduled job** fetches data on a fixed timetable. There is **no upstream
   request per user request** - if a million people open the app, your API sees
   the same number of calls as if nobody did. Expected volume is roughly 6,000
   requests per month with a peak of about 800 on a race day.
4. Responses are **validated, normalized and mapped** into my own data model,
   including mapping your identifiers to my own stable public identifiers. Your
   raw response objects never leave my backend.
5. Normalized results are **stored as snapshots** on my backend, and I would
   like to **retain historical snapshots** of past seasons.
6. My backend serves those normalized snapshots to my own mobile application
   through **my own public HTTP API**.

**The questions I need answered**

*On the architecture*

1. Is the architecture above permitted under your terms?
2. Specifically: your terms state that "distribution, transfer, and storage of
   data provided by our services is allowed", and separately that "reselling the
   product is forbidden without our consent" and that I "cannot directly sell
   the data". I do not sell data, and my API exists only to serve my own
   application. **Does serving normalized data to my own app through my own
   public API count as permitted distribution, or as prohibited resale or
   redistribution?** This is the single most important question for me.
3. Is server-side caching of normalized data permitted?
4. Is indefinite retention of historical snapshots permitted, or must data be
   deleted after some period?

*On distribution and monetization*

5. Is public distribution of the application on Google Play permitted?
6. Version 1 has no advertising. Is that use permitted as described?
7. **If I later added advertising**, would that require a different agreement or
   a different plan? I am asking now so I do not build on a wrong assumption -
   I am not asking for permission to add advertising today.

*On what may be displayed*

8. May the application display race calendars, session schedules, driver and
   constructor standings, drivers, constructors, circuits and race results?
9. **What attribution do you require?** Exact wording, and where it must appear
    (an in-app credits screen, every screen that shows your data, my public API
    responses, or elsewhere).
10. Are there specific copyright or trademark notices I must reproduce?

*On rights that are not yours to grant*

11. Do **Formula 1 competition-data rights** remain my responsibility to clear
    separately with Formula One World Championship Limited, the FIA or other
    rights holders? I am assuming they do and that a subscription to your
    service does not clear them - please correct me if that is wrong.
12. I intend to use **no images, logos, driver photos or constructor crests**
    from your service. I understand from your terms that these are copyrighted
    by their owners and that I would have to arrange proof of intellectual
    property myself. Please confirm that a data-only subscription with no media
    use is acceptable.

*On plan and quota*

13. Given roughly 6,000 requests per month and a peak of about 800 per day, from
    a single server-side source, **which plan do you recommend?**
14. Your Formula 1 product page lists EUR 69/month with 2,000 API calls per hour
    per endpoint, while your Motorsport API standings documentation states EUR
    79/month with 3,000 API calls per hour. **Which subscription grants access to
    the driver and constructor standings endpoints, and at what price and
    quota?**
15. What happens if I exceed the hourly limit - throttling, overage charges, or
    suspension?

*On termination and testing*

16. If I stop subscribing or the agreement is terminated, must I delete cached
    and stored data, and within what period?
17. May I keep a small number of **sanitized example responses** in my source
    repository as fixtures for automated tests? These would be a handful of
    records, used only to verify that my code parses correctly, not as a data
    source.

*On the status of your answer*

18. **Is a written confirmation from support contractually sufficient**, or does
    my intended use require an amended or separate commercial agreement? If the
    latter, please tell me how to start that process.

I appreciate that some of these questions are unusual for a small customer. I
would rather have the answers in writing before I subscribe than discover a
problem after publishing.

Thank you for your time.

Kind regards,
Sergio Arenas
GridView

---

## Appendix B - Official contact path

**No form was submitted, no email was sent, and no account was created.**

| Provider | Contact path | Source |
|---|---|---|
| Sportmonks | Support and commercial contact are reachable from `https://www.sportmonks.com/` (contact and support links in the site footer). The terms themselves invite customers who are unsure about compliance to "explain your plan and ask if this is allowed", which establishes support as the intended channel for exactly this question. Whether that answer is contractually binding is question 18 of the draft. | S7, S8 |
| Jolpica F1 | `admin@jolpi.ca` for commercial usage; GitHub Discussions at `https://github.com/jolpica/jolpica-f1/discussions` for support, feedback and rate-limit requests. | S3, S4 |
| OpenF1 | The site directs other use cases to contact the project to discuss appropriate licensing. | S1 |
| API-Sports | **Not established.** No official page could be retrieved (§5.1). The contact path must be read from the site by a person - see U3. | S10 |

---

## Appendix C - Code architecture audit

Read-only. Nothing in `services/edge-api/` was modified.

### C.1 Seams that exist

| Element | Location |
|---|---|
| Provider interface | `services/edge-api/src/providers/formula-one-provider.ts` - `FormulaOneProvider`, with `ProviderSeasonSource`, `ProviderStatus`, `ProviderError`, `ProviderRateLimitedError` |
| Mock provider | `services/edge-api/src/providers/mock/mock-provider.ts` - `MockFormulaOneProvider` |
| Dependency-injection / factory seam | `services/edge-api/src/providers/factory.ts` - `resolveProvider(env, config, clock)`, with a test-only `env.__PROVIDER` override |
| Configuration switch | `services/edge-api/src/config/environment.ts` - `resolveProviderMode`, `ProviderMode = 'mock' \| 'none'` |
| Secret names anticipated | `FORMULA_ONE_PROVIDER_API_KEY`, `ADMIN_SYNC_SECRET` (Backend Scheme §23.1). **Neither exists in code.** The only implemented secret is `ADMIN_TOKEN`. |
| Normalized domain boundary | `services/edge-api/src/contract/types.ts` - the provider interface already returns contract types, so normalization happens **inside** the adapter |
| Provider DTO isolation boundary | The adapter itself. `ProviderSeasonSource` is composed of contract types, so no provider-shaped DTO can escape by construction |
| Snapshot-writing path | `sync/sync-service.ts` -> `snapshots/generator.ts` -> `publication/publisher.ts` -> `storage/kv.ts` |
| Contract fixtures | `services/edge-api/test/fixtures/api/v1/**` - 30 normalized public-contract fixtures, validated by `test/contract/fixtures.test.ts` and `scripts/validate-fixtures.mjs` |

### C.2 Tests a future adapter must satisfy

| Test | Requirement enforced |
|---|---|
| `test/sync/synchronization.test.ts` - "performs no provider call when no scheduled job is due" | Due-calculation gates every upstream call |
| `test/sync/synchronization.test.ts` - "preserves the active snapshot after provider failure" | T2 - failure never destroys the last valid snapshot |
| `test/sync/synchronization.test.ts` - "public reads consume no provider quota" | T3 - public traffic is independent of upstream volume |
| `test/sync/synchronization.test.ts` - "records rate limiting and avoids an immediate retry" | `Retry-After` handling and backoff |
| `test/sync/synchronization.test.ts` - "skips low-priority jobs when quota is high" | T8 - quota-pressure degradation |
| `test/sync/synchronization.test.ts` - "runs manual sync through the same orchestration as scheduled sync" | One orchestration path |
| `test/environment.test.ts` - "does not make mock mode a production default" and "requires staging to select the provider mode explicitly" | Provider-mode safety |
| `test/config/wrangler-config.test.ts` | Asserts the literal `PROVIDER_MODE` values in `wrangler.toml`; **changing the mode union will require updating this test** |
| `test/contract/fixtures.test.ts`, `test/contract/generated-snapshots.test.ts` | T4 - no provider DTO reaches the public contract |

### C.3 Missing seams that would block a clean adapter

Recorded as **Phase 9B** work. None of it is implemented here.

| # | Gap | Detail |
|---|---|---|
| G1 | No live provider mode | `validProviderModes` is `['mock', 'none']`. A third value is required, plus the production guard must be inverted so production selects the live mode rather than `'none'`. `test/config/wrangler-config.test.ts` and `test/environment.test.ts` both pin the current values. |
| G2 | No credential binding | `Env` has no provider key field. A binding, a `wrangler.toml` `secrets` declaration and the documented `FORMULA_ONE_PROVIDER_API_KEY` name must be introduced together. |
| G3 | No production cron | `wrangler.toml` declares `crons` only under `[env.staging.triggers]`. Production has no trigger, so nothing would drive synchronization. |
| G4 | Coarse provider interface | `fetchSeasonSource(season, jobs)` demands the whole season source from one call. A real adapter fans out to many endpoints behind it, and the interface defines no partial-success or per-job failure result. |
| G5 | No event-window awareness | `scheduler.ts` intervals are constants. The documented §15 event-aware policy has no implementation. |
| G6 | Untyped call counting | `providerCallCount` casts the provider to `{ callCount?: unknown }`. It is not on the interface and returns `0` for any adapter that does not happen to expose it, so quota telemetry would silently under-report. |
| G7 | No HTTP hardening helpers | Backend Scheme §23.3 requires fixed hostnames, timeouts, redirect limits, content-type validation, response-size limits and header redaction. No shared outbound-request helper exists. |
| G8 | No provider-ID mapping registry | Backend Scheme §8.1 requires a mapping file resolving provider IDs to GridView IDs, with unknown entities failing validation. No such registry exists. |

**None of G1-G8 was implemented, scaffolded or stubbed in this pass.** No
API-Sports client, provider DTO, authentication code, secret name, environment
variable, Worker route, provider-specific mapping, network test, sandbox request
or production configuration was added.
