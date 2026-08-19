# ADR 0019: Formula 1 data sources under a public-licence compliance model

- Status: Accepted
- Date: 2026-08-19 (revised twice the same day; see *Revision history*)

> **What "Accepted" means here.** This ADR accepts an **architecture and
> product-risk decision** based on compliance with a public licence. It is
> **not** provider-specific approval, **not** legal advice, and **not** Formula 1
> rights clearance. No provider has approved, endorsed or reviewed GridView, and
> none has been asked.

## Revision history

| Rev | Change |
|---|---|
| 1 | Proposed Sportmonks as the single candidate for written legal inquiry. |
| 2 | Withdrawn after a zero-budget, zero-monetisation product constraint. Proposed a dual-source OpenF1 + Jolpica model, **gated on a written reply from both projects**. |
| 3 | **The individual-permission gate is withdrawn.** GridView relies on the public CC BY-NC-SA 4.0 licence both projects publish. Status moves to Accepted on that basis. |

Earlier reasoning is preserved in the repository history and its evidence is
retained in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md).

## Context

Phase 9 replaces the mock backend provider with a real Formula 1 data source
(`GridView_Implementation_Plan.md` §14). `GridView_Backend_Scheme.md` §3 makes
that selection an explicitly legal decision as well as a technical one.

### The product constraints

| # | Constraint |
|---|---|
| C1 | Provider budget for v1 is **EUR 0** |
| C2 | GridView remains **free** while it relies on non-commercial data sources |
| C3 | **No monetisation**: no advertising, in-app purchases, subscriptions, affiliate income or sponsorship |
| C4 | Any future monetisation requires written commercial permission from every affected provider, or migration to a provider whose licence permits it — and **reopens this decision** |
| C5 | **No live telemetry or live timing** is required |
| C6 | Freshness objective for **provisional** results: **30-60 minutes after a session ends** |
| C7 | Freshness objective for **reconciled** data: **within 24 hours**, subject to provider availability |
| C8 | **Reliability and replaceability matter more** than in-session updates |

C3 restates an existing state. [ADR 0018](0018-advertising-not-retained-for-v1.md)
already recorded that GridView ships with no advertising SDK, no consent SDK, no
ad unit and no ad request. **This is not the removal of an implemented
advertising SDK — none exists.**

### Why the previous gate was wrong

Revision 2 required a written reply from both OpenF1 and Jolpica before Phase 9B
could begin. That framing had a defect: it treated a **standardised public
licence** as though it were an unanswered request.

Both projects publish their data under **CC BY-NC-SA 4.0**. That licence is a
grant made in advance to everyone who complies with its terms. It is not
conditional on the licensor answering an email, and its conditions —
NonCommercial, Attribution, ShareAlike, no additional restrictions — are written
down and testable. Waiting for a reply would have blocked development on a
courtesy, while the actual permission was already published.

The question of what silence means therefore does not arise. **GridView is not
treating silence as permission; it is relying on a published licence.**

### What the research established

Recorded in full in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md),
from the official Creative Commons deed, legal code and FAQ and from each
project's own published material, accessed 2026-08-19.

**The licence covers databases, not merely prose.** §4(a) grants the right to
*"extract, reuse, reproduce, and Share all or a substantial portion of the
database for NonCommercial purposes only"*. §4(b) then draws the boundary that
matters most here: including a substantial portion in a database in which you
hold sui generis database rights makes *"the database in which You have Sui
Generis Database Rights (**but not its individual contents**)"* Adapted Material.

**A zero-cost dual-source model is technically viable.** On the 2026 Hungarian
Grand Prix the two sources agreed exactly on winner, laps, race duration, race
points, constructor championship points and **all 22 driver championship
totals**. But **only 7 of 11 constructor names matched**, so a curated mapping
registry is mandatory.

**OpenF1's free tier is bounded by a clock, not a feature flag.** Data is live —
and not free — from 30 minutes before a session starts until 30 minutes after it
ends. GridView's C6 objective therefore coincides exactly with the earliest
moment free access opens.

**There is a wording tension in OpenF1's material**, recorded rather than
smoothed over: the free tier is labelled *"Personal use"*, while the FAQ
describes intended uses including *"non-commercial fan engagement"*, and the
licence actually applied to the data contains no personal-use term at all — only
NonCommercial.

**Every official API-Sports source remained unreachable** — eight hosts, all HTTP
403 — so nothing about it is asserted.

## Decision

**1. GridView relies on the public CC BY-NC-SA 4.0 licence** published by OpenF1
and Jolpica F1. For uses inside its scope, **that licence is the permission**.

**2. Separate written permission from each project is not required before Phase
9B.** Outreach remains available as an **optional courtesy or clarification
channel** and is never a development or release gate. No inquiry has been sent,
and no waiting period exists anywhere in the documentation.

**3. The adopted model is dual-source, zero-cost and post-session.**

| Source | Role |
|---|---|
| **OpenF1** | *Provisional* post-session classification, points and championship state, fetched only outside its live window |
| **Jolpica F1** | *Complete* season metadata, calendar, participants, circuits, historical depth, and *reconciled* final results and standings |

**4. GridView's use is classified as sharing and potentially adapting licensed
database material** — not as private API consumption. Caching, field extraction,
normalization, combining the two sources, deriving internal state, retaining
historical snapshots, serving the app and serving GridView's public API are all
enumerated act by act, each mapped to the licence provision relied on. The
stricter classification is chosen deliberately, because it is the one that
triggers attribution and ShareAlike.

**5. Compliance obligations are mandatory, not aspirational.** Each is a Phase 9B
implementation requirement and a release requirement:

- **Non-commercial operation** — no advertising, in-app purchases, paid
  subscriptions, affiliate income, sponsorship, sale of data or API access, or
  indirect monetisation designed around the provider data. **Any future
  monetisation must reopen this decision before implementation.**
- **Attribution** — a clear surface reachable from the app naming OpenF1 and
  Jolpica separately, linking to each project and to CC BY-NC-SA 4.0, stating
  that GridView transforms, normalizes and combines the data, and stating that
  GridView is unofficial and not affiliated with Formula 1, the FIA or related
  entities. **The public API documentation must carry equivalent information.**
  §3(a)(1)(A) is *conditional*, so that list is a floor: any copyright notice,
  warranty-disclaimer notice or requested creator designation a project supplies
  must also be retained, and §3(a)(3) requires removing such information if the
  licensor asks. Attribution is therefore held as **per-source data, not
  hard-coded strings**.
- **ShareAlike** — adapted provider data, the normalized database material and
  publicly redistributed derived datasets stay available under CC BY-NC-SA 4.0
  where ShareAlike applies, with per-source attribution retained. Application and
  backend source code are treated as separate from the licensed dataset.
- **No additional restrictions** — GridView's API documentation and terms must
  not claim exclusive ownership of provider-derived data or prohibit reuse the
  licence permits. Operational rate limiting and abuse prevention remain
  permitted and must be presented as protecting GridView's infrastructure, not
  as restricting the downstream licence.
- **Excluded material** — no team logos, Formula 1 logos, driver photographs or
  headshots, audio, radio recordings, broadcasts, protected artwork, official
  branding or live telemetry, and no indication that GridView is official or
  endorsed.

**6. No absolute claim is made about the ShareAlike boundary.** Where the line
falls between application code, database structure and individual facts is
genuinely contested. §4(b)'s "but not its individual contents" anchors the
interpretation, but the boundary is **preserved technically** so that either
reading remains workable, and it is documented for the final licence-compliance
review.

**7. The Phase 9B entry gate is objective and internal.** Ten criteria, all
verifiable in this repository. **No provider email, reply or waiting period
appears among them.**

**8. Residual third-party-rights risk is accepted knowingly.** A licensor can
only license what it holds; the public licences do not establish Formula 1
competition-data clearance; §2(b)(2) states trademark rights are not licensed;
neither project offers an SLA; terms and limits may change. The product owner
accepts this for continued non-commercial development and intended release. That
acceptance is **not** a legal opinion, a data-rights certification, a Formula 1
clearance or an accessibility certification, and **no claim is made that a
dispute or enforcement action cannot occur**.

**9. The validated technical design is unchanged in substance.** OpenF1
provisional attempts at +32/+35/+45/+60 minutes with early stop; Jolpica
reconciliation at +2/+6/+12/+24 hours then daily; no polling during the live
window; a reconciled snapshot never replaced by older provisional data;
mandatory identifier mapping; beta championship endpoints guarded; provider DTOs
never in the public contract; either source disableable independently. **C6 and
C7 remain GridView objectives, never guarantees.**

Two guards were tightened during review and are **binding Phase 9B
requirements**, not implementation detail. First, those offsets are measured
from the **actual** session end, not the scheduled one: the live window closes
30 minutes after a session really ends, so an overrunning session would move the
boundary, and the anchor must be bounded conservatively before the first request
is made, with a detect-and-re-anchor rule as a backstop. Second, **serialization
does not satisfy a per-second burst limit** — an explicit per-provider rate
limiter is required.

**10. Sportmonks stays rejected for v1 on budget grounds only** and is the named
fallback if C1 or C3 is relaxed. **API-Sports stays unselected** and unverified.

**11. Phase 9B has not started, and nothing here authorises production
activation.** No adapter, credential, live provider mode, cron trigger or
deployment follows from this ADR. The mock provider is preserved permanently.

## Consequences

**Phase 9 is unblocked on engineering terms.** Phase 9B may begin once Phase 9A
is merged and its post-merge CI is green, subject to the ten entry criteria.
Nothing waits on a third party.

**The obligations are real work.** Attribution surfaces in both the app and the
API documentation, a per-source attribution model, a documented ShareAlike
strategy for the normalized output, runtime switches to disable either adapter,
and licence-terms monitoring are now Phase 9B scope rather than optional polish.

**Phase 9B carries the structural gaps already recorded.** The largest:
`fetchSeasonSource(season, jobs)` demands a whole season from one call and cannot
express two sources with different roles. Alongside it — no live provider mode,
no production cron, no event-window awareness, no curated identifier mapping
registry, no outbound hardening helper, untyped per-source call counting, and no
provenance or provisional/reconciled state in the local schema, which implies the
first schema change since v2.

**Public release remains separately gated** by the existing Play, privacy, media
and production-environment requirements, **plus a final licence-compliance sweep**
verifying the §5 obligations in the shipped build and the published API
documentation.

**Positive.** Development is no longer blocked on correspondence; the basis is a
written, testable, public licence rather than an informal reply; cost is EUR 0;
no credential exists so none can leak; two independent sources give genuine
redundancy; and the compliance obligations are concrete enough to verify.

**Negative.** GridView depends on two volunteer projects with no SLA; the
residual Formula 1 rights gap is real and unresolvable at this level;
monetisation is foreclosed while these sources are used; the ShareAlike boundary
is interpreted rather than settled; and a rights holder could still object, in
which case the affected use pauses immediately.

## Reopening and reassessment

| Trigger | Consequence |
|---|---|
| Any monetisation is contemplated | Reopen **before** implementation; contact both projects; supersede this ADR |
| A provider or rights holder raises an objection | Pause the affected adapter and use immediately, then reassess |
| Either project changes its licence or terms | Re-evaluate against the new text; the annual provider and licence review is the routine backstop |
| Jolpica's announced rate-limit reduction lands below what the schedule needs | Re-tune the schedule, or fall back |
| ShareAlike is authoritatively read to reach GridView's application code | A product decision on whether that is acceptable |
| C1 or C3 is relaxed | Sportmonks returns as the leading candidate |

**Fallback order if a source becomes unusable:** single-source Jolpica (a viable
degraded product, losing the C6 objective); then API-Sports if its terms become
readable and permit the architecture at zero cost; then Sportmonks if C1 or C3 is
relaxed; then an enterprise licensed feed. **If none can be used, no source is
silently adopted** — the mock provider stays, production stays at
`PROVIDER_MODE = "none"`, and the question returns to the product owner.

**Self-hosting is not a fallback.** It may be investigated as a contingency, but
an open-source server implementation grants no rights to the data it serves —
Jolpica's own Apache-2.0 code and CC BY-NC-SA 4.0 data demonstrate the separation
— GridView would still have to source the data, and
`GridView_Backend_Scheme.md` §2 excludes a production scraper.

## Alternatives considered

**Keep waiting for individual provider replies.** Rejected. It blocks development
on a courtesy while the actual grant is already published, and it forces
reasoning about what silence means — a question that only exists if the reply is
mistaken for the permission.

**Treat the public licence as unconditional permission.** Rejected, and the
opposite of what is decided. The licence permits use **only** for NonCommercial
purposes and **only** subject to attribution, modification-indication,
ShareAlike and the no-additional-restrictions rule. §5 above makes each of those
a binding requirement precisely so the decision cannot be read as
"GridView can do anything with the data".

**Classify GridView's use as private API consumption.** Rejected. Serving
normalized data to a publicly distributed app through a public API is Sharing,
and normalizing and combining two sources very likely produces Adapted Material
and a derived database. Choosing the weaker classification would have avoided
attribution and ShareAlike obligations that the stricter — and safer — reading
imposes.

**Assume the open-source repositories grant data rights.** Rejected explicitly,
because it is a tempting and specific error. A code licence grants rights to
code.

**Pay for a data plan.** Rejected by C1. Recorded rather than argued: this is a
product constraint, and the case for revisiting it is preserved.

**Read OpenF1's "Personal use" tier label as excluding a public fan app.**
Considered seriously and not adopted, but the tension is recorded in full rather
than resolved silently, GridView's interpretation is labelled as an
interpretation, and its limits are stated.

**Build the adapters now, before Phase 9A is merged.** Rejected. This pass is
documentation-only, and Phase 9A is not complete until its branch is merged and
post-merge CI is green.

## References

- [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) — licence-compliance analysis, permitted-use mapping, obligations, feasibility evidence, dual-source design, quota model, residual risk and the optional clarification templates
- [`0018-advertising-not-retained-for-v1.md`](0018-advertising-not-retained-for-v1.md) — advertising is not retained for v1
- [`0005-snapshot-conflict-and-freshness.md`](0005-snapshot-conflict-and-freshness.md) — the existing snapshot-conflict rule the provisional/reconciled rule composes with
- [`0002-replace-spring-boot-backend-with-cloudflare-edge-api.md`](0002-replace-spring-boot-backend-with-cloudflare-edge-api.md) — the edge architecture the sources sit behind
- `GridView_Backend_Scheme.md` §2, §3, §7, §8.1, §14-§18, §23.1
- `GridView_Implementation_Plan.md` §14
- `GridView_Media.md` — the separate media rights and publication process
- CC BY-NC-SA 4.0 deed, legal code and FAQ — cited with access dates in the evaluation document
