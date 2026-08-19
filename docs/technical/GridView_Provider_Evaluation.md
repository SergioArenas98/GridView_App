# GridView - Formula 1 Data Provider Evaluation

## Document information

- Product: GridView
- Document type: Provider evaluation and public-licence compliance basis
- Version: 0.3
- Status: Decided - **relying on the providers' published public licence; no provider has approved GridView**
- Phase: 9A (provider evaluation and licensing basis)
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
| 0.3 | 2026-08-19 | **The individual-permission gate is withdrawn.** The product owner decided that GridView relies on the **public CC BY-NC-SA 4.0 licence** both projects publish, rather than on a per-project written reply. The licence itself is the permission for uses inside its scope. §7 is rewritten as a compliance analysis against the official Creative Commons deed and legal code; §14 becomes an accepted-residual-risk record; §15 becomes an objective Phase 9B entry gate with no provider-response prerequisite. The two inquiry drafts are retained as **optional, unsent, non-blocking clarification templates**. The dual-source technical design in §8-§12 is unchanged. |

---

## 0. What this document does and does not claim

### 0.1 The basis GridView relies on

GridView relies on the **public Creative Commons Attribution-NonCommercial-ShareAlike
4.0 International licence (CC BY-NC-SA 4.0)** that OpenF1 and Jolpica F1 each
publish for their data. That standardised public licence is a grant made in
advance to everyone who complies with it. **For uses that stay inside its scope,
the licence is the permission**, and GridView does not need a separate reply from
either project before proceeding.

This is a **product risk decision and a licence interpretation**. It is not a
legal certification.

### 0.2 What is explicitly not claimed

| Not claimed |
|---|
| That OpenF1, Jolpica, Formula 1, the FIA, Formula One Management, Formula One Licensing B.V. or any other rights holder has **approved, endorsed or reviewed** GridView |
| That any lawyer has reviewed or certified this analysis |
| That GridView **owns** the source data |
| That the licence grants rights the providers **do not themselves possess** — a licensor can only license what it holds |
| That GridView has **Formula 1 competition-data clearance** |
| That Formula 1 names, marks or logos are licensed to GridView — CC BY-NC-SA 4.0 §2(b) expressly does not license trademark rights |
| That no dispute, objection or enforcement action can ever occur |

No provider is described as officially approving GridView anywhere in this
document or in the product.

### 0.3 What has not happened

Producing this document did not send any message, submit any form, create any
account, start any trial, purchase any plan, accept any bespoke terms, request or
handle any API key, or call any authenticated endpoint. **No inquiry has been
sent to either project.** No production adapter exists and none is authorised
here.

A small number of **unauthenticated public `GET` requests** was made under the
authorisation recorded in §8.1, solely to validate the data mapping. No
credential, cookie or token was used; no paid or live endpoint was touched; no
image was downloaded; no response was retained inside the repository.

### 0.4 Why silence is not the question

Earlier versions of this document treated a written reply from each project as a
blocking gate, and therefore had to reason about what silence would mean.

That framing is withdrawn. **GridView is not treating silence as permission —
it is relying on a published licence that was granted in advance.** Whether
either project replies to an optional clarification message changes nothing
about the licence already published. The question of how long to wait for a
reply no longer arises, and no waiting period appears anywhere in this
documentation.

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

**C3 is what makes the licence usable, and it is now a binding obligation, not
a preference.** CC BY-NC-SA 4.0 permits use only for NonCommercial purposes,
defined in §1 of the legal code as *"not primarily intended for or directed
towards commercial advantage or monetary compensation"*. C1-C3 are therefore not
merely product choices — while these sources are in use they are **licence
compliance requirements**, enumerated in §7.6.1. Breaching them would put
GridView outside the licence, not merely outside its own plan.

**Advertising is not being removed by this decision.** It was already absent
from v1 before this pass: [ADR 0018](../adr/0018-advertising-not-retained-for-v1.md)
records that GridView ships with no advertising SDK, no consent SDK, no ad unit
and no ad request, and the repository confirms it. C3 restates and hardens an
existing state; **it is not the removal of an implemented advertising SDK,
because none exists.**

**C3 alone does not discharge the other licence obligations.** Being
unmonetised satisfies the NonCommercial term. Attribution (§7.6.2), ShareAlike
(§7.6.3), the no-additional-restrictions rule (§7.6.4) and the excluded-material
rule (§7.6.5) are separate, independent obligations that must each be met.

---

## 3. Intended architecture being assessed

The licence analysis in this document is about **this specific architecture**,
not about "using an F1 API" in the abstract. §7.5 states exactly which acts
GridView performs and maps each to the licence provision that permits it.

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
| Historical retention | Snapshots are versioned and retained. Permitted under CC BY-NC-SA 4.0 §2(a)(1) and §4(a), subject to the obligations in §7.6. |
| Provider images and logos | **Not used.** Both projects expose media URLs pointing at third-party hosts; none is treated as cleared. See §7.4 and §7.6.5. |
| Attribution | **Mandatory.** Displayed in-app and in the public API documentation, per §7.6.2. |
| Open-sourcing | GridView may later publish adapter code. The ShareAlike boundary is analysed in §7.6.3. |
| Automated tests | Continue to use the mock provider and small derived fixtures. The mock provider is preserved permanently. |

This architecture is **not** private API consumption. The intended public Google
Play distribution and the redistribution of normalized data through GridView's
own public API mean GridView is **Sharing**, and potentially **Adapting**,
licensed database material within the meaning of the licence. §7.5 classifies it
that way deliberately, and the obligations in §7.6 follow from that
classification rather than from a weaker one.

---

## 4. Current Phase 9 requirements

Extracted from
[`GridView_Implementation_Plan.md`](GridView_Implementation_Plan.md) §14 and
[`GridView_Backend_Scheme.md`](GridView_Backend_Scheme.md) §3, §7, §14-§18.

### 4.1 Legal gate

The gate as originally written assumed a negotiated commercial provider. Each
item is retained and mapped to how it is now satisfied.

| # | Requirement | Source | How it is satisfied |
|---|---|---|---|
| L1 | Provider contract confirmed | Plan §14.2 | **No contract exists and none is sought.** The public CC BY-NC-SA 4.0 licence is the grant. §7.3 records what it permits; §14 records what that does and does not give GridView. |
| L2 | The intended mobile-app use is permitted | Scheme §3.2 | §7.5, mapped act by act to licence provisions |
| L3 | Whether advertising changes the applicable rights | Scheme §3.2 | Yes, decisively — §7.6.1. Any monetisation leaves the NonCommercial scope and must reopen the provider decision **before** implementation. |
| L4 | Caching of normalized data is permitted | Plan §14.2, Scheme §3.2 | §7.5 acts 2-4, under §2(a)(1) and §4(a) |
| L5 | Redistribution terms for GridView's own public API | Plan §14.2, Scheme §3.2 | §7.5 acts 8-9, under §2(a)(1) Share and §4(a), conditioned by §7.6.2 and §7.6.3 |
| L6 | Historical snapshot retention is permitted | Scheme §3.2 | §7.5 act 7 |
| L7 | Attribution requirements | Plan §14.2, Scheme §3.2 | §7.6.2, mandatory |
| L8 | Image and logo exclusions | Plan §14.2, Scheme §3.2 | §7.4 and §7.6.5, mandatory |
| L9 | Approval recorded in project documentation | Plan §14.2 | This document and [ADR 0019](../adr/0019-formula-one-provider-legal-gate.md). **What is recorded is a licence-compliance decision, not a provider approval.** |

**L1 has no counterparty.** There is no subscription, no commercial agreement
and no signature. The public licence is a standing grant to everyone who
complies with it, which is materially different from a contract: there is no
negotiated obligation running in GridView's favour, and no counterparty
commitment to service, accuracy or continuity. §14.1 records that plainly.

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

## 5. Evidence method

### 5.1 What counts as the grant

The grant GridView relies on is a **published public licence**, read from its
official text. Every permission claimed in §7.5 cites the specific provision of
the CC BY-NC-SA 4.0 legal code that provides it, and every obligation in §7.6
cites the provision that imposes it.

Sources are the **official Creative Commons deed, legal code and FAQ**, plus each
project's own published licence identification and terms. No secondary legal
summary, blog, comparison site or search-result snippet is used for any claim in
this document.

### 5.2 What still does not count as a grant

The shift to a public-licence basis narrows what needs asking. It does not
loosen what counts as evidence. None of the following is treated as permission
for anything:

- a free public API; an endpoint that responds; a request that succeeds; the
  absence of authentication; a paid tier existing; a free tier existing;
- an open-source **code** repository or a permissive **code** licence.

The last point is worth stating plainly because it is a tempting and specific
error. **An open-source server implementation grants rights to the code, not to
the data it serves.** Jolpica demonstrates the separation in its own repository:
Apache-2.0 code, CC BY-NC-SA 4.0 data. Code licence and data licence are treated
as separate questions throughout.

### 5.3 The limit of the licence itself

A licensor can only license rights it actually holds. CC BY-NC-SA 4.0 §2(a)(1)
grants only the *Licensed Rights* — the copyright and similar rights the licensor
has authority to grant — and §2(b) confirms that trademark and patent rights are
not licensed, and that publicity, privacy and personality rights may still limit
use. **A CC licence on a Formula 1 dataset therefore cannot, and does not,
deliver Formula 1 competition-data or trademark clearance.** That residual gap is
recorded in §14.1 and accepted knowingly; it is not argued away.

### 5.4 Recording tensions rather than resolving them conveniently

Where official sources are in tension, the tension is recorded, GridView's
working interpretation is stated as an interpretation, and its limits are
labelled. §7.1.1 is the worked example.

---

## 6. Candidates

| Provider | Role | Licensing basis | Evidence status |
|---|---|---|---|
| **OpenF1** | **Provisional fast source** — post-session results, points and championship state, fetched after its free historical window opens | Its published CC BY-NC-SA 4.0 licence (§7.1) | Primary sources retrieved; feasibility-checked |
| **Jolpica F1** | **Complete and reconciled source** — season metadata, calendar, drivers, constructors, circuits, historical coverage, reconciliation and final results | Its published CC BY-NC-SA 4.0 licence (§7.2) | Primary sources retrieved; feasibility-checked |
| Sportmonks | **Rejected for v1 — budget only** (§6.1) | n/a | Primary sources retrieved in v0.1; retained as evidence |
| API-Sports | **Unselected** — free availability, terms and redistribution permission all unverified (§6.2) | n/a | Official sources unreachable |

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

## 7. Licensing basis and compliance

Both proposed sources publish their data under the **same** public licence:
**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0)**. That licence is the basis GridView relies on. This section
records each project's published position, what the licence permits and
requires, exactly which acts GridView performs, and the obligations that follow.

### 7.1 OpenF1 — official position

Recorded from OpenF1's own site on 2026-08-19 (source S1, §13).

| Point | Recorded position |
|---|---|
| Cost of historical access | **Free.** The Community tier is "Free / forever". |
| Authentication | **None required** for historical access. |
| Licence | Identified on the site as **"Licensed under CC BY-NC-SA 4.0"**. |
| Free tier label | **"Community \| Historical data \| Personal use \| Free / forever"** |
| Stated intended uses | *"OpenF1 is intended for educational purposes, personal learning projects, research, and non-commercial fan engagement."* |
| Live window | *"Data is considered live from 30 minutes before a session starts until 30 minutes after it ends. Outside of this window, data is classified as historical and is free to access."* |
| Other use cases | *"For other use cases, please contact us to discuss appropriate licensing and ensure compliance with all applicable rights."* |
| Independence | *"OpenF1 is an unofficial, community-operated project…It is not associated, affiliated, endorsed, or sponsored by Formula One World Championship Limited, Formula One Management, Formula One Licensing B.V., or any of their subsidiaries."* |
| Ownership | *"The project does not claim ownership of Formula 1 data, trademarks, or broadcasts, and does not attempt to compete with or substitute official Formula 1 products or licensed data services."* |

**GridView will not use the paid live feed.** Historical data is free **only**
outside the defined live window, and every GridView fetch is scheduled outside
it (§10.2). The Sponsor tier buys live access, which C5 says GridView does not
need.

**OpenF1's disclaimers are not Formula 1 rights clearance.** A project stating
that it does not claim ownership of Formula 1 data is telling the truth about the
limit of what it can license. It does not supply the missing clearance to anyone
downstream. See §14.1.

#### 7.1.1 The "personal use" / "non-commercial fan engagement" tension

There is a genuine wording tension in OpenF1's published material, and it is
recorded rather than smoothed over:

- The **free tier label** reads **"Personal use"**. Read strictly, "personal"
  could suggest use by an individual for themselves.
- The **FAQ** describes intended uses as *"educational purposes, personal
  learning projects, research, and **non-commercial fan engagement**"*. "Fan
  engagement" is inherently plural — it describes engaging fans, not one person
  studying alone — and it is qualified by "non-commercial", not by "private".
- The **licence identified for the data** is CC BY-NC-SA 4.0, whose operative
  restriction is **NonCommercial**, defined in §1 of the legal code as *"not
  primarily intended for or directed towards commercial advantage or monetary
  compensation"*. That licence contains no "personal use only" or "private use
  only" term at all.

**The product owner's interpretation.** A free, unmonetised, publicly
distributed fan application falls within *non-commercial fan engagement*, and
therefore within the NonCommercial term of the licence that governs the data.
The tier label is read as shorthand for the non-commercial tier, in contrast to
the paid live tier, rather than as a narrower separate condition — an
interpretation supported by the licence being the thing actually applied to the
data.

**The limits of that interpretation, stated plainly.** This is GridView's
reading. It is:

- **not** a judicial determination;
- **not** a provider-specific determination — OpenF1 has not been asked and has
  not answered;
- **not** legal advice;
- a reading that could be disputed, in which case §14.2's reassessment trigger
  applies.

If certainty on this specific point is later wanted, Appendix A is an optional
clarification template. It is **not** a prerequisite for Phase 9B.

### 7.2 Jolpica F1 — official position

Recorded verbatim from `TERMS.md` (last updated 27 August 2025) and the
rate-limit guide on 2026-08-19 (sources S5, S6, §13).

| Point | Recorded position |
|---|---|
| Openness | *"The jolpica-f1 API is free and open for public use."* |
| Cost and scope | *"The API is freely available for **non-commercial use**."* |
| Licence | *"The data is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)."* |
| Commercial use | *"For commercial usage, please contact us via `admin@jolpi.ca`"* |
| Fair use and limits | Rate limits apply and must be respected: burst 4 requests/second, sustained 500 requests/hour unauthenticated, HTTP 429 on breach. Abuse "may result in temporary or permanent blocking", possibly without notice. Limits are stated to be subject to change and **expected to decrease**. |
| Operation | *"volunteer-run, donation-supported"* |
| Guarantees | *"we **do not guarantee** uptime, availability, or correctness of the data"*; use is *"entirely at your own risk"*. |
| Changes | *"We reserve the right to change these terms."* |
| Identification | A custom `User-Agent` identifying the application and version is **required**. |

GridView's use is unmonetised (C1-C3), so the commercial-contact route in
Jolpica's terms is not the applicable path today. **If monetisation is ever
contemplated, that route becomes mandatory before implementation** (§7.6.1).

Jolpica's terms are explicitly changeable and its limits explicitly expected to
fall. Both are accepted risks (§14.2) with monitoring as the mitigation
(§12.3 S10, §14.3).

### 7.3 CC BY-NC-SA 4.0 — what it permits and what it requires

Read from the official Creative Commons deed, legal code and FAQ on 2026-08-19
(sources S15, S16, S17, §13). Section numbers are those of the legal code.

#### 7.3.1 Permissions

| # | Permission | Provision |
|---|---|---|
| P1 | Reproduce and Share the licensed material, in whole or in part, **for NonCommercial purposes only** | §2(a)(1)(A) |
| P2 | Produce, reproduce and Share **Adapted Material**, for NonCommercial purposes only | §2(a)(1)(B) |
| P3 | The licence covers **applicable sui generis database rights** as well as copyright and similar rights | §1 definitions, §2(a)(1), §4 |
| P4 | Where sui generis database rights apply: **extract, reuse, reproduce and Share all or a substantial portion of the contents of the database**, for NonCommercial purposes only | §4(a) |

"NonCommercial" is defined in §1 as *"not primarily intended for or directed
towards commercial advantage or monetary compensation."*

#### 7.3.2 Conditions

| # | Condition | Provision |
|---|---|---|
| O1 | **Attribution** when licensed material is Shared. §3(a)(1)(A) requires retaining, **if supplied by the Licensor**: (i) identification of the creator(s) and any others designated to receive attribution, in any reasonable manner requested; (ii) a copyright notice; (iii) a notice referring to the licence; (iv) a notice referring to the disclaimer of warranties; (v) a URI or hyperlink to the licensed material, to the extent reasonably practicable | §3(a)(1)(A) |
| O1a | **Removal on request** — if the Licensor asks, the §3(a)(1)(A) information must be removed to the extent reasonably practicable | §3(a)(3) |
| O2 | **Identify modifications** — *"indicate if You modified the Licensed Material and retain an indication of any previous modifications"* | §3(a)(1)(B) |
| O3 | **ShareAlike** — Adapted Material that is Shared must carry *"a Creative Commons license with the same License Elements, this version or later, or a BY-NC-SA Compatible License"* | §3(b)(1) |
| O4 | **No additional restrictions** — *"You may not offer or impose any additional or different terms or conditions on, or apply any Effective Technological Measures to, the Licensed Material if doing so restricts exercise of the Licensed Rights"* by recipients | §2(a)(5)(C) |
| O5 | **Attribution also applies to database sharing** — §3(a) must be complied with when Sharing all or a substantial portion of database contents | §4(c) |

#### 7.3.3 The database-adaptation boundary

§4(b) is the provision that determines how far ShareAlike reaches when the
licensed material is a database:

> if You include all or a substantial portion of the database contents in a
> database in which You have Sui Generis Database Rights, then the database in
> which You have Sui Generis Database Rights (**but not its individual
> contents**) is Adapted Material.

The parenthesis is doing real work: the **derived database** is Adapted Material
and therefore carries ShareAlike; the **individual contents** are not made
Adapted Material by that act. §4 also states it *"supplements and does not
replace"* obligations arising from other Copyright and Similar Rights, so where
both apply, both apply.

#### 7.3.4 Limits of the grant

| # | Limit | Provision |
|---|---|---|
| N1 | The licence grants **only** the copyright and similar rights the **licensor has authority to grant** | §2(a)(1), definition of Licensed Rights |
| N2 | **Patent and trademark rights are not licensed** | §2(b)(2) |
| N3 | Publicity, privacy and personality rights are **not licensed** — but the Licensor does give a **limited waiver of its own** such rights | §2(b)(1), Deed "Notices" |
| N3a | That waiver reaches **only rights held by the Licensor**, and only *"to the limited extent necessary to allow You to exercise the Licensed Rights, but not otherwise"*. **Third-party publicity and personality rights — a driver's, for instance — are untouched by it.** | §2(b)(1) |
| N4 | Moral rights, such as the right of integrity, are not licensed — subject to the same limited Licensor waiver as N3a | §2(b)(1) |
| N5 | **No warranty of any kind**, including as to title or accuracy, unless separately given | §5, Deed "Notices" |

N1 and N2 are the reason this document never claims Formula 1 clearance. The
official deed itself carries the warning that *"other rights such as publicity,
privacy, or moral rights may limit how you use the material."*

N3a is worth separating from N3 rather than collapsing the two. The licence is
not silent on personality rights: it contains a real, if narrow, waiver. But
that waiver is bounded twice over — to rights **the Licensor holds**, and to the
extent **necessary to exercise the licensed rights**. Neither OpenF1 nor Jolpica
holds the personality rights of Formula 1 drivers, so nothing in §2(b)(1)
reaches them. The residual exposure recorded in §14.1 is therefore about
**third-party** rights, and the Licensor's limited waiver neither creates nor
reduces it.

### 7.4 Media: nothing from either source is cleared

Both projects expose URLs that look like usable media and are not.

| Field | Source | Host | Treatment |
|---|---|---|---|
| `headshot_url` on `drivers` | OpenF1 | `media.formula1.com` | **Never fetched, never stored, never displayed.** |
| `circuit_image` on `meetings` | OpenF1 | `media.formula1.com` | Same. |
| `country_flag` on `meetings` | OpenF1 | `media.formula1.com` | Same. |
| `circuit_info_url` on `meetings` | OpenF1 | `api.multiviewer.app` | Third-party API, not a GridView dependency. Not used. |
| `url` on drivers, constructors, circuits, races | Jolpica | `en.wikipedia.org` | Article links, not media. Not treated as image rights; not fetched. |

A media URL being reachable through a data API establishes nothing about the
right to redistribute the image, and CC BY-NC-SA 4.0 §2(b)(2) confirms trademark
rights are not licensed in any case. GridView's media continues to follow its
own separate rights and publication process
([`GridView_Media.md`](GridView_Media.md)). **No media was downloaded during any
pass.** The binding exclusion list is §7.6.5.

### 7.5 The exact permitted GridView use

Each act GridView performs, with the licence provision relied on.

| # | Act | Provision relied on |
|---|---|---|
| 1 | **Fetch permitted historical data** — OpenF1 only outside its live window; Jolpica within its published rate limits | P1, P4 |
| 2 | **Cache provider responses** server-side | P1, P4 (reproduce) |
| 3 | **Extract the required fields** from responses | P4 (extract) |
| 4 | **Transform and normalize** identifiers and structures into GridView's own model | P2, P4 (reuse) |
| 5 | **Combine data from OpenF1 and Jolpica** into a single normalized model | P2, P4; both sources are under the same licence and version, so no incompatibility arises (§7.6.3) |
| 6 | **Calculate internal derived state** where necessary (for example provisional-versus-reconciled state, freshness, materialisation) | P2 |
| 7 | **Retain historical snapshots** of past seasons | P1, P4 (reproduce) |
| 8 | **Expose normalized read-only data to the Android app** | P1, P2, P4 (Share) |
| 9 | **Expose that data through GridView's public API** | P1, P2, P4 (Share) |
| 10 | **Preserve last-known-good snapshots** during provider failure | P1 (reproduce), plus §10.6 |

#### 7.5.1 Classification

Acts 8, 9 and 10 mean GridView is **Sharing** licensed material publicly, and
acts 4, 5 and 6 mean the result is very likely **Adapted Material** and a
derived database within §4(b).

**This is deliberately classified as sharing and potentially adapting licensed
database material — not as private API consumption.** The stricter
classification is chosen on purpose: it is the one that triggers attribution
(O1, O5), modification-indication (O2) and ShareAlike (O3), and building to the
stricter reading is safer than building to a weaker one and being wrong.

Nothing in this section supports a statement like "GridView can do anything with
the data". Every act above is permitted **only** for NonCommercial purposes and
**only** subject to every obligation in §7.6.

### 7.6 Mandatory compliance obligations

These are **not optional and not aspirational**. They are Phase 9B
implementation requirements and public-release requirements. Failing any of them
puts GridView outside the licence it relies on.

#### 7.6.1 Non-commercial operation

While OpenF1 or Jolpica data is in use, GridView must have:

| # | Prohibited |
|---|---|
| 1 | Advertising |
| 2 | In-app purchases |
| 3 | Paid subscriptions |
| 4 | Affiliate income |
| 5 | Sponsorship |
| 6 | Sale of data or of API access |
| 7 | Any indirect monetisation designed around the provider data |

Item 7 is included so the rule cannot be met on a technicality: monetising
something built around the licensed data, rather than the data itself, is still
directed towards commercial advantage.

[ADR 0018](../adr/0018-advertising-not-retained-for-v1.md) already records that
advertising is absent. **This is not the removal of an implemented advertising
SDK — none exists.** The obligation is to keep it that way.

**Any future monetisation must reopen the provider decision before
implementation**, not after. Under Jolpica's terms that means the
`admin@jolpi.ca` route; under OpenF1's it means its stated contact route for
other use cases; and it would supersede
[ADR 0019](../adr/0019-formula-one-provider-legal-gate.md).

#### 7.6.2 Attribution

Required by O1, O2 and O5. GridView must provide a **clear attribution surface
reachable from the application**, expected to carry:

| # | Element |
|---|---|
| 1 | **OpenF1** named as a data source |
| 2 | **Jolpica F1** named as a data source |
| 3 | A link to each project |
| 4 | A link to **CC BY-NC-SA 4.0** (`https://creativecommons.org/licenses/by-nc-sa/4.0/`) |
| 5 | Notice that **GridView transforms, normalizes and combines** the data — this is the O2 modification indication, and it must not be omitted |
| 6 | Notice that **GridView is unofficial and not affiliated with Formula 1, the FIA or related entities** |

**The public API documentation must carry equivalent attribution and licence
information**, because the API is itself a Sharing surface (§7.5 act 9).

Attribution must be **per source**, not merged into one generic credit: each
licensor is separately entitled to attribution.

**The six elements above are a floor, not a ceiling.** §3(a)(1)(A) is
*conditional*: whatever the Licensor actually supplies with the material must be
retained. Elements 1-4 cover the parts GridView knows are supplied today, but a
compliant implementation must also:

| # | Conditional duty | Provision |
|---|---|---|
| 7 | Retain any **copyright notice** either project supplies | §3(a)(1)(A)(ii) |
| 8 | Retain any **notice referring to the disclaimer of warranties** either project supplies | §3(a)(1)(A)(iv) |
| 9 | Retain **creator identification** in any reasonable manner the Licensor requests, including a designated pseudonym or additional parties designated to receive attribution | §3(a)(1)(A)(i) |
| 10 | Retain a **URI or hyperlink to the licensed material** to the extent reasonably practicable | §3(a)(1)(A)(v) |
| 11 | **Remove** any §3(a)(1)(A) information if the Licensor requests it, to the extent reasonably practicable | §3(a)(3) |

**Phase 9B must implement the attribution surface so these are possible, not
merely so the six known elements render.** Concretely, that means attribution
content is **data, not hard-coded strings**: a per-source record that can carry a
copyright notice, a warranty-disclaimer notice and a requested creator
designation if one appears, and from which an entry can be removed under duty 11.
An implementation that hard-codes six literals cannot satisfy §3(a)(1)(A) if
either project later ships a notice, and cannot satisfy §3(a)(3) at all.

Duty 11 is easy to overlook because it runs the other way from the rest: it is an
obligation to **stop** displaying something on request.

Whether a stable machine-readable attribution or data-sources endpoint is
appropriate is a **Phase 9B determination**. It is deliberately not added in this
documentation-only pass.

#### 7.6.3 ShareAlike

The intended separation, following §4(b) (§7.3.3):

| Artefact | Treatment |
|---|---|
| **GridView Flutter application source code** | Separate from the licensed sporting dataset. The current interpretation is that unrelated application code does **not** become CC BY-NC-SA licensed merely because it processes licensed data. |
| **GridView Worker / backend source code** | As above. |
| **Adapted provider data** | ShareAlike applies. |
| **The normalized database material** derived from provider databases | ShareAlike applies where §4(b) makes the derived database Adapted Material. |
| **Publicly redistributed derived datasets** | ShareAlike applies. |
| **Per-source attribution** | Retained individually for OpenF1 and Jolpica in all of the above. |

**Combining the two sources creates no licence incompatibility**: both are
CC BY-NC-SA 4.0, the same licence elements at the same version, which §3(b)(1)
accommodates directly.

**The boundary is not asserted as settled law.** Exactly where the line falls
between application code, database structure and individual facts is a genuinely
contested area, and this document makes **no absolute legal claim** about it.
§4(b)'s "but not its individual contents" is the anchor for the interpretation
above, not a guarantee that every reading agrees.

What follows from that uncertainty is an engineering obligation:
**preserve the boundary technically** so that whichever way the line is drawn,
the artefacts are already separable. Concretely — provider-derived data stays out
of application source; normalized data lives in snapshots and the database, not
baked into code; adapters are isolated; and the public DTO contract stays
provider-neutral. The boundary is documented here for the final licence-
compliance review before public release (§15.3).

#### 7.6.4 No additional restrictions

Required by O4. GridView's API documentation and terms **must not**:

- claim exclusive ownership of provider-derived data;
- prohibit reuse that CC BY-NC-SA 4.0 permits;
- impose terms that restrict recipients from exercising the licensed rights.

**Operational controls remain permitted and are distinct from the licence.**
Rate limiting, abuse prevention, bot mitigation, caching rules and
service-security controls protect GridView's own infrastructure. They govern
*access to GridView's service*; they are not, and must not be presented as,
restrictions on the *downstream licence* applying to the data. GridView's
published terms must keep those two things visibly separate.

#### 7.6.5 Excluded material

GridView must not obtain from these providers, nor imply permission for:

| # | Excluded |
|---|---|
| 1 | Team logos |
| 2 | Formula 1 logos |
| 3 | Driver photographs or headshots |
| 4 | Audio |
| 5 | Radio recordings |
| 6 | Broadcasts |
| 7 | Protected artwork |
| 8 | Official branding |
| 9 | Live telemetry |
| 10 | Any indication that GridView is official or endorsed |

Items 1-8 are outside what a CC licence on a dataset can convey, and §2(b)(2)
confirms trademark rights are not licensed. Item 9 is excluded by C5 and by
OpenF1's live-window terms. Item 10 is a statement GridView must never make in
any surface, and §7.6.2 element 6 requires the opposite statement.

### 7.7 Summary of the position

| Question | Position |
|---|---|
| What permits GridView's use? | The public CC BY-NC-SA 4.0 licence published by each project. |
| Is a per-project reply required first? | **No.** It is an optional clarification, never a gate. |
| Is GridView's use non-commercial? | Yes, as long as §7.6.1 holds — and §7.6.1 is binding, not aspirational. |
| Does the licence cover the database, not just prose? | Yes — §4 covers sui generis database rights explicitly. |
| Does ShareAlike reach GridView's app and backend code? | On the current interpretation, no. On the derived **database** and publicly shared derived datasets, yes. The boundary is not asserted as settled and is preserved technically. |
| Does any of this clear Formula 1 competition-data or trademark rights? | **No.** §2(b)(2) and N1 make that impossible, and §14.1 records it as accepted residual risk. |
| Has any provider approved GridView? | **No, and none has been asked.** |

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
| M11 | **Whether OpenF1 revises `date_end` after an overrun is `unverified`** | A red-flagged or delayed session actually ends later, which moves the live-window boundary. Anchoring on the scheduled end alone would place a request inside the paid live window. Because the revision behaviour is unverified, the detect-and-re-anchor backstop (§10.2 rule 4) **cannot be relied on to notice the overrun**. The operative control is therefore §10.2 rule 3: fetch only from a justified upper bound, otherwise **skip the provisional fetch** and wait for reconciliation. Both are Phase 9B requirements. |

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

> **Gated (see §10.2 rule 3).** OpenF1's provisional role is conditional on a
> justified upper bound on the actual session end existing. **None is recorded
> today**, so as things stand the skip rule applies to every session and
> Jolpica supplies everything. The provisional path is designed and specified;
> it is not yet unlocked.

Every stored record is in exactly one of two states: **provisional** (last
written from OpenF1) or **reconciled** (last written from Jolpica). The public
contract exposes freshness semantics that already exist; the provisional and
reconciled distinction is internal unless the existing v1 contract already has a
field for it.

### 10.2 The live-window boundary is the hard constraint

OpenF1 classifies data as live from **30 minutes before** a session starts until
**30 minutes after** it ends. GridView must never fetch inside that window.

**The window closes 30 minutes after the session *actually* ends, not 30 minutes
after it was *scheduled* to end.** That distinction is the whole difficulty: a
red-flagged or delayed session pushes the real boundary later, and a schedule
anchored on the nominal end would then fire inside the live window. Detecting
that afterwards cannot undo the request. **Prevention therefore has to be
conservative, and detection is only a backstop.**

Five design rules follow:

1. **The earliest permitted provisional fetch is `actual_end + 30 minutes`.**
   GridView's C6 objective of 30-60 minutes is therefore *exactly* aligned with
   the earliest moment free access opens. There is no room to be earlier, and
   trying to be would mean using the paid live feed.
2. **A safety margin is mandatory.** The first attempt is placed at
   **+32 minutes**, not +30, so that clock skew, boundary rounding or an
   inclusive interpretation of "30 minutes after" cannot by itself place a
   request inside the window.
3. **The anchor must be *provably* at or after the actual end — and if it
   cannot be proven, GridView does not fetch at all.** GridView cannot observe
   the actual end without querying, and querying during the window is the thing
   being avoided. So the anchor may only be built from signals that are
   themselves safe to hold, and it must be an **upper bound**, not an estimate:

   ```text
   bound = a value B for which GridView can state a source and a reason
           why the session cannot still be running at B

   anchor = max(scheduled_end,
                latest date_end already known for the session,
                bound)

   first attempt = anchor + 32 minutes
   ```

   **If no such `bound` is available for a session, the provisional fetch is
   skipped.** The session waits for Jolpica reconciliation (§10.4). As the
   table below records, **no usable bound is presently recorded**, so today
   the skip applies to every session, not to an unlucky few.

   That trade is deliberate. Losing the 30-60 minute objective for one
   red-flagged session is a bounded product cost. Issuing a request inside the
   paid live window is a licence breach, and no freshness objective justifies
   it. **C6 yields to §7.6; the objective is never a reason to fetch early.**

   Candidate bounds, each of which must carry a source and an access date
   before it may be relied on:

   | Candidate bound | Status |
   |---|---|
   | A published maximum session duration from the governing sporting regulations | **Not recorded.** No such figure is cited anywhere in this document, and none may be assumed. Recording one is Phase 9B work and requires an official source. |
   | The **scheduled** start of the next session at the same meeting | **Rejected — unsound.** See below. |
   | Confirmation that the next session **actually began** | Theoretically sound, but GridView cannot obtain it without querying during the window it is trying to avoid. **Not usable.** |
   | A confirmed statement from OpenF1 that `date_end` is revised to the actual end | **Unverified** — see M11. Would make rule 4 a reliable detector rather than a backstop, but is not itself a bound. |

   **Why the scheduled next-session start is rejected.** It looks like a bound —
   a session cannot still be running once the next has begun — but the
   inference fails exactly when it is needed. Delays cascade: if a session
   overruns, the *next* session is pushed back too, so its **scheduled**
   timestamp passes while the previous session is still running. Treating that
   timestamp as an upper bound could therefore schedule a request while the
   earlier session is still under way, or inside the 30 minutes after it
   finally ends. The bound is unsound precisely in the delayed case it was
   supposed to cover, and it is not rescued by only applying it to
   non-final sessions.

   **Consequently, no usable bound is recorded today, and the skip rule is the
   operative behaviour for every session.** GridView does not perform the
   provisional OpenF1 fetch at all until a bound is recorded with its source;
   provisional freshness is supplied by nothing, and every session reaches the
   app through Jolpica reconciliation (§10.4).

   That is a real reduction in what the design delivers, and it is stated
   rather than hidden: **until a bound is recorded, the C6 objective is not met
   by any implemented mechanism.** Recording one — most plausibly a published
   maximum session duration — is the first item of Phase 9B work on this path.
4. **Detect and re-anchor, without pretending it is a cure — and without relying
   on it.** Every response carries `date_end`. If a response reveals a `date_end`
   later than the anchor used, GridView must **discard the response, write
   nothing, record a compliance incident, and re-anchor every remaining attempt
   to `actual date_end + 32 minutes`.**

   Two limits are stated plainly. Discarding does not undo the request already
   made. And whether OpenF1 revises `date_end` after an overrun is **unverified**
   (M11), so this rule may silently fail to detect the very case it is aimed at.
   **Rule 4 is therefore a backstop against repetition across the +35, +45 and
   +60 attempts, not a control that makes rule 3 optional.** Rule 3 — bound or
   skip — is what actually prevents the breach.
5. **An incomplete response is treated as a possible overrun signal.** If the
   first attempt returns absent or obviously incomplete data, GridView backs off
   rather than retrying tightly, because the most likely explanation is that the
   session ran long.

Rules 3 and 4 together are a **Phase 9B requirement**, not an implementation
detail: an adapter that anchors on the scheduled end alone, or that fetches
without a justified bound, does not satisfy §7.6 and must not ship. **E6 and M9
may not be treated as satisfied until a recorded bound or the skip rule is
implemented.**

This changes when — and whether — the first attempt fires. It never increases
the number of attempts, so the request-volume model in §11 remains an upper
bound. While the skip rule applies to every session, the OpenF1 component of
that model is **not exercised at all**, and actual volume is the Jolpica
baseline and reconciliation figures alone.

### 10.3 Provisional lifecycle — OpenF1

Triggered only for **polled sessions**: Qualifying, Sprint Qualifying, Sprint
and Race. Practice sessions are not polled for results.

| Attempt | Offset from the §10.2 anchor (actual session end, conservatively bounded) |
|---|---|
| 1 | +32 minutes |
| 2 | +35 minutes |
| 3 | +45 minutes |
| 4 | +60 minutes |

Offsets are measured from the anchor computed in §10.2 rule 3, **never from the
scheduled end alone**, and are re-anchored under rule 4 if a response reveals a
later actual end.

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

| Check | Offset from the §10.2 anchor |
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
| OpenF1 free | 3 requests/**second** and 30 requests/**minute** | ≈ 27 requests/**day** | The entire peak day fits inside one minute's allowance. The **per-second** limit is a separate matter — see the note below. |
| Jolpica unauthenticated | 500 requests/**hour** | ≈ 21 requests/**day** | ≈ 4% of a single hour's allowance, spread across 24 hours. Well inside the announced future reduction. |

**Neither source's daily or hourly volume is a constraint on this design, even
at worst case, even if published limits are reduced substantially.** Licensing,
not quota, remains the gate.

**Serialization alone does not satisfy a per-second burst limit.** A single Race
or Sprint attempt issues five OpenF1 calls, and if responses return quickly,
more than three of them can complete inside one rolling second even though they
were issued one after another. The earlier claim that serialization keeps the
3 requests/second limit out of reach was unsafe and is withdrawn.

**Phase 9B requirement: an explicit per-provider rate limiter.** Each adapter
must pace its own outbound requests against that provider's published limits
rather than relying on the shape of the call sequence — a minimum interval
between OpenF1 requests that cannot exceed 3 per rolling second or 30 per
rolling minute, and the equivalent for Jolpica's 4 per second and 500 per hour.
The limiter belongs with the outbound-request hardening helper recorded as G7 in
Appendix D, alongside timeouts, redirect limits and Jolpica's mandatory
`User-Agent`. `Retry-After` and HTTP 429 handling remain as specified in §10.

This does not change the request-volume model in §11: the same number of
requests is made, spaced out.

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

### 12.3 Required continuity mitigations

These are the **availability and continuity** mitigations. The
**licence-risk** mitigations are in §14.3; the two sets overlap deliberately
(S1/M1, S3/M3, S10/M8) because independent adapters and last-known-good
snapshots protect against both a project disappearing and a licence position
changing. None of these is implemented. All are Phase 9B or later.

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
| S15 | Creative Commons | `https://creativecommons.org/licenses/by-nc-sa/4.0/` | Attribution-NonCommercial-ShareAlike 4.0 International (deed) | Explicit | You are free to **Share** ("copy and redistribute the material in any medium or format") and **Adapt** ("remix, transform, and build upon the material"). Under **Attribution** ("give appropriate credit, provide a link to the license, and indicate if changes were made"), **NonCommercial** ("You may not use the material for commercial purposes"), **ShareAlike** ("you must distribute your contributions under the same license") and **No additional restrictions** ("You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits"). Notices: no warranties are given, and other rights such as publicity, privacy or moral rights may limit use. |
| S16 | Creative Commons | `https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en` | CC BY-NC-SA 4.0 legal code | Explicit | §1 defines **NonCommercial** as "not primarily intended for or directed towards commercial advantage or monetary compensation". §2(a)(1) grants the right to "reproduce and Share the Licensed Material, in whole or in part, for NonCommercial purposes only" and to "produce, reproduce, and Share Adapted Material for NonCommercial purposes only". §2(a)(5)(C) forbids additional or different terms or Effective Technological Measures that restrict exercise of the Licensed Rights. §2(b) excludes moral, publicity, privacy and personality rights, and states "Patent and trademark rights are not licensed under this Public License." §3(a) requires retaining creator identification, copyright notice, licence reference, warranty disclaimer and a URI, and to "indicate if You modified the Licensed Material and retain an indication of any previous modifications". §3(b) requires an Adapter's License that is "a Creative Commons license with the same License Elements, this version or later, or a BY-NC-SA Compatible License". §4(a) grants the right to "extract, reuse, reproduce, and Share all or a substantial portion of the database for NonCommercial purposes only"; §4(b) provides that including a substantial portion in a database in which You hold Sui Generis Database Rights makes "the database in which You have Sui Generis Database Rights (but not its individual contents)" Adapted Material; §4(c) applies §3(a) when sharing a substantial portion of database contents; and §4 "supplements and does not replace" other obligations. §5 disclaims warranties. |
| S17 | Creative Commons | `https://creativecommons.org/faq/` | Frequently Asked Questions — data and databases | Explicit | "CC licenses can be used on databases." In version 4.0, applicable sui generis database rights are licensed under the same conditions as copyright. 4.0 licences cover copyright, neighbouring rights and sui generis database rights only — not trademark, patent or personality rights. |

### 13.1 Optional clarification topics

**None of these is a gate.** GridView relies on the published licence (§0.1,
§7). The topics below are the ones where a project's own view would add
certainty if it were ever offered. Appendices A and B are optional templates for
asking; sending them is not a prerequisite for Phase 9B and no reply is awaited.

| # | Project | Topic | Why it is not blocking |
|---|---|---|---|
| X1 | OpenF1 | Whether "Personal use" on the tier label is read as narrower than "non-commercial fan engagement" in the FAQ (§7.1.1) | The licence applied to the data is CC BY-NC-SA 4.0, whose operative term is NonCommercial; GridView complies with that term via §7.6.1. |
| X2 | OpenF1 | Whether `date_end` is revised to the **actual** end after a red flag or delay, and what upper bound OpenF1 would consider safe for scheduling a first fetch | §10.2 rule 3 does not depend on an answer: without a justified upper bound GridView **skips** the provisional fetch rather than guessing. An answer would let the fetch happen more often, not more safely. |
| X3 | Both | Exactly where ShareAlike's boundary falls between application code, database structure and individual facts | §7.6.3 states no absolute claim, follows §4(b), and preserves the boundary technically so either reading remains workable. |
| X4 | Both | Preferred attribution wording | §7.6.2 satisfies the licence's own §3(a) requirements; a project preference would refine presentation, not permission. |
| X5 | Both | Whether cached historical data may be retained if access later ends | The licence is irrevocable for material already received under it; retention is exercised under P1 and P4. |
| X6 | Jolpica | Whether free 14-day-delayed database dumps may be retained as a GridView backup | Same licence and same terms as the API data; treated identically. |
| X7 | API-Sports | Everything — no current statement could be read (§6.2) | API-Sports is not used. |

---

## 14. Residual risk

### 14.1 What the public licence does not deliver

Recorded neutrally, and accepted rather than argued away.

| # | Risk |
|---|---|
| R1 | **Providers can only license rights they possess.** CC BY-NC-SA 4.0 grants only the Licensed Rights the licensor has authority to grant (§2(a)(1), N1). Neither project is a Formula 1 rights holder, and OpenF1 says so itself. |
| R2 | **The public licences do not independently establish Formula 1 competition-data clearance.** No CC licence on a dataset can supply rights its licensor never held. |
| R3 | **Formula 1 and related trademarks are not licensed.** §2(b)(2) states patent and trademark rights are not licensed under the public licence. |
| R4 | **There is no contract and no counterparty obligation.** A public licence is a standing grant to everyone who complies; it is not a negotiated agreement running in GridView's favour. |
| R5 | **Provider access, limits and future terms may change.** Jolpica reserves the right to change its terms and has stated its free rate limits **will decrease**. |
| R6 | **Neither provider supplies an SLA**, an uptime commitment or a correctness guarantee. Jolpica disclaims all three explicitly and states use is at the user's own risk. |
| R7 | **A provider may block abusive or excessive traffic**, in Jolpica's case possibly without notice. |
| R8 | **Public factual sporting data, sui generis database rights and provider-created compilations may not all have identical legal treatment**, and treatment varies by jurisdiction. GridView applies the stricter reading (§7.5.1) rather than assuming the most favourable one. |
| R9 | **The §7.1.1 interpretation is GridView's**, not a judicial or provider-specific determination. |
| R10 | **Reconciliation latency is unmeasured** (§11.6 Q3), so the C7 objective is unvalidated. |
| R11 | Both OpenF1 championship endpoints are **beta** (§8.7 M3), and the standings-freshness path depends on them. |
| R12 | **Neither source exposes quota headers** (§8.6), so requirement T1 must be met with locally modelled counters. |

### 14.2 The decision

**The product owner accepts this limited residual risk** for continued
non-commercial development and for the intended release under the published
licence.

That acceptance is explicitly **not**:

- a legal opinion;
- a data-rights certification;
- a Formula 1 rights clearance;
- an accessibility certification;
- an assertion that no dispute, objection or enforcement action can occur.

**No claim is made that a dispute or enforcement action is impossible.** If a
provider or a rights holder raises an objection, §14.3 M10 applies immediately.

### 14.3 Practical mitigations

| # | Mitigation | Status |
|---|---|---|
| M1 | **Independent provider adapters**, so either source can be removed without changing the public contract | Phase 9B (§10.10, Appendix D G4) |
| M2 | **Attribution by source**, never merged into a generic credit | Phase 9B (§7.6.2) |
| M3 | **Last-known-good snapshots** preserved through provider failure | Already enforced by an existing test (§10.6) |
| M4 | **Feature switches allowing either provider to be disabled independently** — distinct from S1: S1 makes removal possible at build time, M4 makes it possible at runtime without a deployment | Phase 9B |
| M5 | **No protected media** — the §7.6.5 exclusion list | Binding now; nothing has ever been fetched |
| M6 | **No official-affiliation language** anywhere in the product or documentation | Binding now |
| M7 | **Conservative request volumes** — roughly 285 requests per month worst case, far inside both published limits (§11) | Designed |
| M8 | **Licence-version and terms monitoring**, including watching for Jolpica's announced limit reduction | Phase 9B, plus §12.3 S10 annual review |
| M9 | **A final licence-compliance review before public release**, covering §7.6.1-§7.6.5, the §10.2 live-window anchor and the §11.4 rate limiter | Release gate (§15.3) |
| M10 | **Immediate reassessment if a provider or rights holder raises an objection** — pause the affected adapter, stop the affected use, re-evaluate before resuming | Standing obligation from now |

### 14.4 Technical gaps carried into Phase 9B

Full detail in Appendix D.

| # | Gap |
|---|---|
| G-a | `ProviderMode` admits only `'mock'` and `'none'`; production is hard-configured to `'none'`. |
| G-b | **Production declares no cron trigger** (§11.6 Q1). |
| G-c | `fetchSeasonSource(season, jobs)` is a single coarse call and **cannot express two sources with different roles**; partial-failure semantics are undefined. |
| G-d | The scheduler is not event-aware (§10.5). |
| G-e | No curated identifier mapping registry exists, and §8.5 proves one is mandatory. |
| G-f | No outbound-request hardening helper exists; Jolpica's mandatory custom `User-Agent` would live there. |
| G-g | No provenance or provisional/reconciled state exists in the local schema. |
| G-h | `providerCallCount` is untyped and would silently under-report per-source usage. |

---

## 15. Decision and the Phase 9B entry gate

### 15.1 Decision

**GridView adopts the dual-source, zero-cost, post-session model, operating
under the public CC BY-NC-SA 4.0 licence that OpenF1 and Jolpica each publish.**

| Source | Role |
|---|---|
| **OpenF1** | *Provisional* post-session classification, points and championship state, fetched only outside its live window — **gated on a justified end bound, none of which is recorded today (§10.2 rule 3)** |
| **Jolpica F1** | *Complete* season metadata, calendar, participants, circuits, historical depth, and *reconciled* final results and standings |

**As things stand the OpenF1 path is specified but not unlocked**, so Jolpica
supplies everything and the C6 objective is not met by any implemented
mechanism. Recording a bound is the first Phase 9B item on this path.

**Individual provider replies are not required and are not awaited.** Outreach
remains available as an optional courtesy or clarification channel (Appendices A
and B) and is never a development or release gate. No inquiry has been sent.

**This is a product risk and licence-interpretation decision**, recorded in
[ADR 0019](../adr/0019-formula-one-provider-legal-gate.md). It is not legal
advice, not a certification, and not an approval by any provider or by any
Formula 1 entity.

Sportmonks remains rejected for v1 on budget grounds only and is the named
fallback if C1 or C3 is ever relaxed (§6.1). API-Sports remains unselected and
unverified (§6.2).

### 15.2 Phase 9B entry criteria

Phase 9B may begin once Phase 9A is merged and its post-merge CI is green,
provided **all** of the following hold. Every criterion is objective and
verifiable inside this repository. **No provider email, reply or waiting period
appears among them.**

| # | Criterion |
|---|---|
| E1 | The product remains **unmonetised** — none of the seven items in §7.6.1 is present |
| E2 | **Both current licence notices are recorded** — OpenF1 (§7.1) and Jolpica (§7.2), each with its source URL and access date |
| E3 | **Attribution requirements are part of the implementation plan** — the six elements of §7.6.2 **and its conditional duties 7-11**, in the app and in the public API documentation, with attribution held as per-source data rather than hard-coded strings |
| E4 | **Provider-derived data is separated from application source code** (§7.6.3) |
| E5 | The normalized data output has a **documented ShareAlike strategy** (§7.6.3) |
| E6 | **Live-window and rate-limit restrictions are encoded as requirements** — the §10.2 anchor computed from the **actual** session end via a justified upper bound, **with the skip rule implemented for sessions where no bound is available**, plus the re-anchor backstop; an explicit per-provider rate limiter (§11.4) rather than reliance on serialization; and Jolpica's published limits and mandatory `User-Agent` respected |
| E7 | **Adapters can be disabled independently** (§14.3 M4) |
| E8 | The **public DTO contract remains provider-neutral** (§10.8, requirement T4) |
| E9 | **No protected images, logos or branding are imported** (§7.6.5) |
| E10 | **No provider is described as officially approving GridView** in any surface |

### 15.3 Public release remains separately gated

Phase 9B entry is not release approval. Public release remains subject to the
existing gates, unchanged by this decision:

- the Play Store requirements tracked in
  [`../release/play-store-baseline.md`](../release/play-store-baseline.md);
- the privacy requirements tracked with them;
- the media rights and publication process in
  [`GridView_Media.md`](GridView_Media.md);
- the production-environment gates in
  [`GridView_Environments.md`](GridView_Environments.md) and
  [`GridView_Backend_Operations.md`](GridView_Backend_Operations.md);
- **plus a final licence-compliance sweep** verifying §7.6.1 through §7.6.5 in
  the shipped build and the published API documentation (§14.3 M9).

### 15.4 What would reopen this decision

| Trigger | Consequence |
|---|---|
| Any monetisation is contemplated | Reopen **before** implementation; contact both projects; supersede ADR 0019 |
| A provider or rights holder raises an objection | §14.3 M10 — pause the affected use immediately and reassess |
| Either project changes its licence or terms | Re-evaluate against the new text; §12.3 S10 annual review is the routine backstop |
| Jolpica's announced rate-limit reduction lands below what §11 needs | Re-tune the schedule, or fall back per ADR 0019 |
| ShareAlike is authoritatively read to reach GridView's application code | A product decision on whether that is acceptable |
| C1 or C3 is relaxed | Sportmonks returns as the leading candidate (§6.1) |

---

## Appendix A - Optional clarification template: OpenF1

> **Status: OPTIONAL. UNSENT. NON-BLOCKING.**
>
> This is a template, not a pending action. **It has not been sent**, submitted,
> emailed or entered into any form. No account exists, no sponsorship has been
> started, and no payment method has been provided.
>
> **Phase 9B does not depend on it.** GridView relies on OpenF1's published
> CC BY-NC-SA 4.0 licence (§0.1, §7.1), not on a reply. This template exists
> only in case the product owner later wants project-specific confirmation of a
> topic in §13.1 — most plausibly the §7.1.1 wording tension. No reply is
> awaited and no waiting period applies.
>
> Some questions below are phrased as requests for permission. If the template
> is ever used, that framing should be revisited: the operative question is
> whether OpenF1 reads its own published licence the same way GridView does, not
> whether GridView may proceed.

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

1. **Only after the free historical window opens — and only when I can prove
   it has.** I understand data is live from 30 minutes before a session starts
   until 30 minutes after it ends. Because that window closes 30 minutes after
   the session *actually* ends, I do not schedule from the published start time
   alone: a delayed or red-flagged session would move the boundary and I could
   call inside your live window without realising it.

   So my rule is **bound-or-skip**. I fetch only when I can justify an upper
   bound on the actual end — a value I can point to a source for and say the
   session cannot still be running by then — and I measure **+32 minutes** from
   that, leaving margin for clock skew. If I cannot justify such a bound for a
   session, **I do not fetch it at all** and wait for my other source instead.
   Where I do fetch, I make at most four attempts, at +32, +35, +45 and +60
   minutes, stopping as soon as I have a complete result.

   I would rather lose freshness on a session than make one request inside your
   paid window.
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
11. For a session that is delayed or red-flagged and therefore ends later than
    scheduled: **is `date_end` revised to the actual end**, or does it stay at
    the scheduled value? And is there an upper bound you would consider safe for
    scheduling a first request — a maximum session duration, for instance?

    I ask because I do not want to guess. My current rule is that if I cannot
    justify an upper bound for a session, I **skip** the post-session fetch
    entirely and wait for my other source, rather than risk a request inside
    your live window.

I would rather ask and be told no than assume and be wrong.

Thank you for your time and for the project.

Kind regards,
Sergio Arenas
GridView

---

## Appendix B - Optional clarification template: Jolpica F1

> **Status: OPTIONAL. UNSENT. NON-BLOCKING.**
>
> This is a template, not a pending action. **It has not been sent**, submitted,
> emailed or posted. No account exists, no Ko-fi supporter tier has been taken,
> and no API key has been requested.
>
> **Phase 9B does not depend on it.** GridView relies on Jolpica's published
> CC BY-NC-SA 4.0 licence (§0.1, §7.2), not on a reply. No reply is awaited and
> no waiting period applies.
>
> Some questions below are phrased as requests for permission. If the template
> is ever used, that framing should be revisited: the operative question is
> whether Jolpica reads its own published licence the same way GridView does,
> not whether GridView may proceed. The one context in which contacting Jolpica
> becomes **mandatory** rather than optional is monetisation — its terms direct
> commercial usage to `admin@jolpi.ca`, and §7.6.1 requires that route to be
> taken **before** any monetisation is implemented.

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
account was created.** These paths are recorded for two purposes only: the
optional clarification templates in Appendices A and B, and the **mandatory**
route that monetisation would require under §7.6.1. Neither is a Phase 9B
prerequisite.

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
| G7 | **No HTTP hardening helper and no rate limiter** | Backend Scheme §23.3 requires fixed hostnames, timeouts, redirect limits, content-type validation, response-size limits and header redaction. None exists. Jolpica's mandatory custom `User-Agent` would also live here, as would the **per-provider rate limiter required by §11.4** — serialization alone does not satisfy a per-second burst limit. |
| G8 | **No provider-ID mapping registry** | Backend Scheme §8.1 requires one. §8.5 proves it is mandatory: 4 of 11 constructor names differ between sources. |
| G9 | **No provenance or provisional/reconciled state** | §10.7 fields do not exist in the local schema, and nothing distinguishes a provisional record from a reconciled one. A schema change is implied — the first since v2. |
| G10 | **No locally-modelled quota state** | `QuotaState` expects values from provider headers; neither source supplies them (§8.6), so counters must be maintained locally per source. |

**None of G1-G10 was implemented, scaffolded or stubbed in this pass.** No
provider client, provider DTO, authentication code, secret name, environment
variable, Worker route, provider-specific mapping, cron trigger, network test or
production configuration was added or changed.
