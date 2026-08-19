# ADR 0019: The Formula 1 provider legal gate and the first inquiry candidate

- Status: Proposed
- Date: 2026-08-19

## Context

Phase 9 replaces the mock backend provider with a real Formula 1 data source
(`GridView_Implementation_Plan.md` §14). `GridView_Backend_Scheme.md` §2 names
**API-Sports** as the leading technical candidate and §3 makes provider
selection an explicitly legal decision as well as a technical one: production
use is blocked until the intended use and any required data-publication rights
are confirmed in writing.

Three things force that decision to be taken deliberately now rather than
drifted into.

**1. The premise the existing documentation is written against is stale.**
`GridView_Implementation_Plan.md` §14.2 requires confirming "ad-supported use",
and `GridView_Backend_Scheme.md` §2, §3.1 and §7.3 assess every candidate
against an "ad-supported GridView release". [ADR 0018](0018-advertising-not-retained-for-v1.md)
subsequently decided that **advertising is not retained for v1**. Assessing
providers against advertising GridView will not carry would ask the wrong
questions. Assuming the absence of advertising makes the use non-commercial
would answer them wrongly.

**2. The real question was never the advertising.** GridView's architecture
fetches provider data server-side on a schedule, normalizes it into its own
contract, stores snapshots, and serves those snapshots to a **publicly
distributed Google Play application through GridView's own public HTTP API**.
That is redistribution of normalized data by a public service. It needs
permission whether or not an advertisement is ever shown, and the absence of
advertising does not dispose of it.

**3. The repository's own provider claims are unsourced.**
`GridView_Backend_Scheme.md` §3.1 asserts six specific things about API-Sports'
terms and §7.2 asserts six technical properties, none carrying a source URL or
an access date. A production decision resting on them would rest on
uncorroborated assertions.

A Phase 9A research pass was therefore run on 2026-08-19 and recorded in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md).
It purchased nothing, contacted nobody, created no account, handled no
credential and implemented no adapter.

### What that pass found

**Every official API-Sports source was unreachable.** All eight official hosts
returned HTTP 403 to every retrieval method available. No current API-Sports
statement about terms, licensing, pricing, quotas or endpoints could be read, so
none is asserted, and the repository's existing §3.1 and §7.2 claims remain
unverified.

**Both open candidates carry a NonCommercial licence.** OpenF1 and Jolpica F1
both publish their data under CC BY-NC-SA 4.0. Jolpica's terms direct commercial
usage to `admin@jolpi.ca`; OpenF1 directs other use cases to contact the project
to discuss licensing. Beyond NonCommercial, **ShareAlike** would arguably oblige
GridView to license its own normalized API output under the same terms, which is
a second structural question, not a detail. Jolpica additionally disclaims
uptime, availability and correctness, and states its rate limits will decrease.

**One candidate's terms could be read and are materially more permissive.**
Sportmonks was added to the comparison this pass. Its published terms
affirmatively permit building commercial products on the data, permit
"distribution, transfer, and storage" of it, and place logo and photo rights
squarely on the customer, which matches GridView's own documented assumption
that no media rights arrive with a data subscription. But the same terms forbid
reselling the product without consent, and **GridView's public normalized API
sits between those two clauses**. The terms themselves invite customers who are
unsure to explain their plan and ask.

**No candidate explicitly permits the intended use.** Across all four, not one
source states that public redistribution of normalized data through the
customer's own API is allowed.

**Formula 1 competition-data rights are separate from every candidate and are
unresolved.** No data subscription clears them.

## Decision

**1. The Phase 9 legal gate is confirmed as a hard, blocking gate.** No Formula
1 data provider is approved, selected for production, subscribed to or
activated. Production provider integration does not begin until a provider has
confirmed **in writing** that GridView's architecture, as described in
`GridView_Provider_Evaluation.md` §2, is permitted.

**2. Silence is not permission.** A paid plan, an API key, an available
endpoint, a public API, a commercial pricing tier, a free trial, or a request
that succeeds is **not** evidence that GridView may publicly redistribute
normalized Formula 1 data. Every legal-use question is classified against the
scheme in `GridView_Provider_Evaluation.md` §4, and `Not stated or ambiguous` is
recorded as such rather than resolved in the convenient direction.

**3. Sportmonks is the preferred candidate for the first written legal
inquiry.** This is a decision about **who to ask first**, not about who to use.
It rests on evidence availability and licensing clarity, not on a claim of
superiority:

- it is the only candidate whose current official terms could be read and which
  is not barred by a categorical NonCommercial licence;
- its media position already matches GridView's;
- its single decisive ambiguity — permitted distribution versus prohibited
  resale — is one sharply formed question a provider can answer in writing,
  where the NonCommercial candidates present two structural ones and API-Sports
  presents nothing readable at all.

**4. The technical preference is recorded separately and is not settled.** Of
the candidates whose capabilities could actually be verified, **Jolpica** has
the cleanest fit for GridView's v1 resource set. The repository's stated
preference for API-Sports (`GridView_Backend_Scheme.md` §7.2) is neither
endorsed nor withdrawn here; it is marked unverified pending U3 below.

**5. No media or logo rights are inferred from any data agreement.** GridView
assumes no image, logo, driver photo or constructor crest rights arrive with a
data subscription. Media continues to follow GridView's own separate rights and
publication process. Sportmonks' terms confirm this assumption for that
provider; it is applied to all candidates regardless.

**6. Future advertising is a separate question and is not assumed permitted.**
ADR 0018 stands. Whether advertising would require a different agreement is
asked explicitly in the outreach draft so that a later reversal is a priced
decision rather than a discovered problem. Nothing in this ADR authorizes
advertising.

**7. The "ad-supported use" wording is reinterpreted, not deleted.**
`GridView_Implementation_Plan.md` §14.2 is read as *confirm the intended use —
which for v1 is not ad-supported — and separately establish whether advertising
would change the answer*. The underlying requirement is unchanged; only its
factual premise is corrected.

**8. No production activation before written confirmation.** No production
provider adapter, no provider credential, no live provider mode, no production
cron trigger and no Worker deployment follows from this ADR. The mock provider
is preserved permanently for automated tests.

## Consequences

**Phase 9 is now gated on correspondence, not on engineering.** Phase 9B cannot
start until a provider answers. The blocking actions are the user's:

| # | Required action |
|---|---|
| U1 | Review and approve or amend the outreach draft (`GridView_Provider_Evaluation.md` Appendix A) |
| U2 | Send the inquiry to Sportmonks |
| U3 | Read `api-sports.io` terms and pricing in an ordinary browser and record what they say, since automated retrieval is blocked |
| U4 | Decide whether to open parallel inquiries to API-Sports and Jolpica |
| U5 | Decide whether GridView independently seeks Formula 1 competition-data clearance, and whether legal review is accepted |
| U6 | Decide whether production gets a cron trigger, and at what cadence |

**Phase 9B carries structural work this pass deliberately did not do.** The
audit in `GridView_Provider_Evaluation.md` Appendix C found eight seams missing:
no live provider mode (`ProviderMode` admits only `'mock'` and `'none'`), no
credential binding, no production cron trigger, a coarse single-call provider
interface with undefined partial-failure semantics, no event-window awareness in
the scheduler, untyped provider call counting, no outbound-request hardening
helper, and no provider-ID mapping registry. None was implemented.

**Two quota findings change Phase 9B's shape.** The modelled requirement is
about 5,700 requests per month with a peak near 810 on a race day — small, and
within every assessable candidate's published rate limits, so licensing rather
than quota is the constraint. But the *implemented* scheduler is not
event-aware and would cost roughly 12,450 requests per month by polling
standings and results at race-day cadence year-round.

**Positive.** The gate is now evidence-backed rather than asserted; the wrong
premise is corrected before questions were asked against it; the decisive
question is identified precisely enough to be answered in one reply; and the
unsourced API-Sports claims are marked rather than propagated.

**Negative.** Phase 9 is blocked on an external party with no committed response
time, and the answer may be unfavourable. Three of four candidates may prove
unusable, in which case GridView faces either an enterprise feed at
significantly higher cost or a scope decision about shipping live competition
data at all.

## Evidence required to move this ADR to Accepted

All of the following:

1. A **written provider statement** that GridView's architecture — scheduled
   server-side fetching, normalization, snapshot storage, historical retention,
   and serving normalized data to a free, publicly distributed Google Play
   application through GridView's own public API — is permitted.
2. A written statement that this is **not** prohibited resale or redistribution.
3. **Attribution requirements** stated exactly: wording and placement.
4. A written statement on whether **historical snapshot retention** is permitted
   and what must be deleted on termination.
5. Confirmation that **provider images and logos are excluded** and that a
   data-only subscription with no media use is acceptable.
6. A written position on whether **Formula 1 competition-data rights** remain
   GridView's separate responsibility.
7. Confirmation of whether **support's written answer is contractually
   sufficient** or an amended or separate commercial agreement is required — and
   if the latter, that agreement being in place.
8. **Verified current pricing and quota** for the subscription that actually
   grants the required endpoints, resolving the conflict recorded in
   `GridView_Provider_Evaluation.md` §8.5.
9. The approval **recorded in project documentation**, per
   `GridView_Implementation_Plan.md` §14.2.

Items 1, 2 and 7 are individually blocking. Item 6 may require professional
legal review rather than a provider answer.

## Rejection and fallback conditions

**This ADR is Rejected, and Sportmonks is dropped as the inquiry candidate, if
any of these occurs:**

- Sportmonks answers that serving normalized data through GridView's own public
  API **is** prohibited resale or redistribution.
- Sportmonks requires an enterprise agreement whose cost or terms are outside
  what the project will accept.
- The pricing conflict resolves such that the standings endpoints GridView
  requires are unavailable at an acceptable price.
- No usable answer arrives within a period the user judges reasonable.

**Fallback order, in sequence:**

1. **API-Sports**, once U3 makes its terms readable. If they permit the
   architecture, it returns as leading candidate, consistent with the
   repository's existing technical preference.
2. **Jolpica**, if written commercial permission is granted on terms compatible
   with GridView setting its own API terms. It is the strongest verified
   technical fit, but the volunteer-run availability disclaimer and the
   published intention to reduce rate limits are material operational risks.
3. **OpenF1**, only with written permission, and only after confirming
   constructor-standings coverage and accepting that historical depth starts at
   2023.
4. **An enterprise licensed feed** (Sportradar, SportsDataIO or equivalent),
   accepting materially higher cost in exchange for contractual rights and an
   SLA. `GridView_Backend_Scheme.md` §7.3 already anticipates this path, and the
   provider adapter keeps the migration invisible to the mobile API.
5. **If no candidate can be cleared**, Phase 9 stops and becomes a product
   decision about whether GridView can ship live competition data at all. That
   decision is not taken here.

**If the fallback order is exhausted, no provider is silently adopted.** The
mock provider stays, production stays at `PROVIDER_MODE = "none"`, and the
question returns to the user.

## Alternatives considered

**Subscribe to a paid plan and treat the API key as clearance.** Rejected. This
is the exact inference `GridView_Backend_Scheme.md` §3.1 already warns against:
subscribing to a data provider is not a rights clearance, and a successful
authenticated request proves only that the endpoint works.

**Treat the absence of advertising as making the use non-commercial, and adopt
OpenF1 or Jolpica under CC BY-NC-SA.** Rejected. Whether a free, ad-free but
publicly distributed application is "non-commercial" under that licence is not
stated by either provider, and ShareAlike would separately constrain GridView's
own API terms. Adopting on that reading would be treating silence as permission.

**Keep API-Sports as the inquiry candidate because the repository already names
it.** Rejected for this pass. Not one current API-Sports statement could be
read, so an inquiry could not even be aimed at the right clauses, and the
existing §3.1 claims cannot be cited as though verified. This is a deferral
pending U3, not a rejection of API-Sports.

**Contact all four providers now.** Rejected as a decision to take here. It is a
reasonable strategy and is offered to the user as U4, but parallel inquiry is a
commercial and time-management choice, not an architecture decision.

**Build the adapter behind a disabled flag while waiting.** Rejected.
`GridView_Backend_Scheme.md` §3.3 permits development against mocks and
fixtures, which is exactly what exists. Building a provider-specific adapter
before knowing the provider would commit the mapping registry, the DTO shapes
and the quota model to a candidate that may be rejected, and would create
pressure to justify the sunk work.

**Leave the gate as prose in the Backend Scheme.** Rejected: that is the status
quo, and it produced unsourced claims, a stale advertising premise and no
recorded decision point.

## References

- [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) — full evidence, classifications, quota model, outreach draft and code audit
- [`0018-advertising-not-retained-for-v1.md`](0018-advertising-not-retained-for-v1.md) — advertising is not retained for v1
- [`0002-replace-spring-boot-backend-with-cloudflare-edge-api.md`](0002-replace-spring-boot-backend-with-cloudflare-edge-api.md) — the edge architecture the provider sits behind
- `GridView_Backend_Scheme.md` §2, §3, §7, §14-§18, §23.1
- `GridView_Implementation_Plan.md` §14
- `GridView_Backend_Operations.md` — quota behaviour and the outstanding real-provider prerequisites
- `GridView_Media.md` — the separate media rights and publication process
