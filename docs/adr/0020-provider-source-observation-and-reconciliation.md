# ADR 0020: Source observation, reconciled ordering and the settling design

- Status: Accepted
- Date: 2026-08-21

> **What "Accepted" means here.** This ADR records **product-owner approval of
> architecture and product decisions** that had to be taken before Phase 9B
> implementation could begin. It is **not** provider approval, **not** legal
> clearance, **not** a freshness guarantee, **not** a claim that reconciled
> writes are correctly ordered, and **not** a statement that anything described
> here is implemented. No adapter, provider mode, cron trigger, credential or
> deployment follows from it, and no provider has been contacted.

## Context

[ADR 0019](0019-formula-one-provider-legal-gate.md) adopted a dual-source,
zero-cost, post-session model — OpenF1 for *provisional* post-session data and
Jolpica F1 for *complete* and *reconciled* data — under the CC BY-NC-SA 4.0
licence each project publishes. It left three of the twelve Phase 9B entry
criteria deliberately unresolved, because each required a decision that must
**precede** the work rather than emerge from it:

| Criterion | What was left open |
|---|---|
| **E5a** | Both halves of the absent-recency-signal problem: the `sourceUpdatedAt` conflict ([`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) §10.7.1) and the residual reconciled-ordering risk (§10.9.1) |
| **E5b** | Whether the five settling invariants in §10.4.1 are accepted as **binding** |
| **E6** | Whether the OpenF1 live-window rule is written down as a binding requirement |

### The missing provider recency signal

**Neither adopted source publishes an update timestamp, a version or a usable
`Last-Modified`** (Evaluation §8.6). Both are read as full, unconditional
fetches; neither supports conditional requests, and neither returns quota
headers.

That collides with an Accepted decision and with the public contract:

| Existing requirement | Where |
|---|---|
| `SnapshotMeta.sourceUpdatedAt` is **required**; a snapshot missing it is contract-invalid | [`../api/gridview-api-v1.yaml`](../api/gridview-api-v1.yaml) |
| `ProviderSeasonSource.sourceUpdatedAt` is a required non-null `string` | `services/edge-api/src/providers/formula-one-provider.ts` |
| A snapshot response missing `meta.sourceUpdatedAt` is rejected as `invalidResponse` before persisting, and **never** falls back to `generatedAt` | [ADR 0005](0005-snapshot-conflict-and-freshness.md), [ADR 0011](0011-typed-conditional-http-results.md) |
| It means *the age or revision of the underlying source data*, and is the **primary** snapshot-conflict key | [ADR 0005](0005-snapshot-conflict-and-freshness.md) |

So an adapter for either adopted source could not produce a contract-valid
snapshot at all. Publishing GridView's fetch time under the field is not an
available exit: ADR 0005 forbids substituting generation or fetch time for
source recency, and doing so would make every re-read of unchanged content look
like fresh upstream data.

The **same absent signal** also means two differing *reconciled* payloads cannot
in general be ordered. Corroboration across consecutive checks and the
superseded-revision ledger reduce that risk without eliminating it: a
persistently stale replica may serve an older payload GridView never previously
stored, which the ledger cannot recognise (Evaluation §10.9.1).

### Why the settling design was still open

Evaluation §10.4.1 stopped at five invariants rather than a state machine, after
two review rounds produced settling rules that each broke a different case — a
rule keyed on "unchanged across the full check sequence" is unreachable for a
result first published at check 2, and a rule that stops polling at settlement
makes the staged-review path unreachable for a later correction. The invariants
were recorded; their acceptance as binding was not.

## Decision

### 1. Observation timestamps, published as `sourceUpdatedAt`

Two timestamps are defined, at two different levels, and only the second is ever
published:

- **`sourceObservedAt`** — the time at which GridView first observed the
  normalized `contentRevision` currently held for **one internal resource**. It
  drives reconciliation (§10.4.1) and is **internal only**.
- **`snapshotObservedAt`** — the time at which GridView first observed the
  normalized **public snapshot revision** currently published for one snapshot
  key. **This is the value published as `meta.sourceUpdatedAt`.**

**Corrected 2026-08-22 (PR #8 review, P1).** An earlier draft projected the
snapshot-level value as the *maximum* `sourceObservedAt` across the resources
contributing to a snapshot. That is only non-decreasing while the contributing
set is stable. Remove the resource that currently supplies the maximum — a
withdrawn entry, a membership change, a narrowed filtered set — and the next
snapshot carries an **older** `sourceUpdatedAt`. ADR 0005 rule 1 then rejects it
before its differing `contentVersion` or later `generatedAt` can be considered,
so a legitimate removal could never reach clients. The projection is therefore
**not** derived from the contributing resources at all; it is derived from the
snapshot revision itself.

| Rule | Statement |
|---|---|
| D1.1 | `sourceObservedAt` is set when a `contentRevision` **becomes the published revision** for a resource, to the observation time of the check at which that revision was **first seen** — not the time it was corroborated, and not the time it was written. |
| D1.2 | **Re-reading identical normalized content never advances it.** An idempotent re-check refreshes confirmation metadata only; `sourceObservedAt`, and therefore `sourceUpdatedAt`, are unchanged. |
| D1.3 | It is **persisted with the resource revision**. A Worker restart, a redeploy or another identical fetch must not reset it while that revision remains current. |
| D1.4 | `fetchedAt` remains GridView's request time for the current request and is **never** published under `sourceUpdatedAt`. |
| D1.5 | `generatedAt` remains the snapshot generation time and **never** substitutes for source recency. ADR 0005's prohibition is unchanged. |
| D1.6 | `contentRevision` remains an **equality and identity** signal. It is not temporally sortable and never orders two payloads. |
| D1.7 | **`snapshotRevision` is a stable hash of a deterministic canonical serialization of the normalized public `data` payload only**, for one snapshot key. Envelope, provenance, transport and time-varying metadata are excluded without exception. Like `contentRevision` it is equality-only and is never temporally sorted. The canonical input is specified immediately below and is binding. |
| D1.8 | `sourceUpdatedAt` **stays required** in `SnapshotMeta` and `SeasonSnapshotMeta`. The wire shape is unchanged: a required UTC date-time string. No nullability change, no re-keying of the conflict semantics, and no client or Drift change. |
| D1.9 | **`snapshotObservedAt` is bound to `snapshotRevision`, not to the contributing set.** If a regenerated snapshot has the *same* `snapshotRevision` as the published one, it keeps that revision's existing `snapshotObservedAt` unchanged. If it **differs** in any way — including a removal, a membership change or a filtered-set change — a new `snapshotObservedAt` is assigned. It is persisted with the revision in the same publication transaction, so a restart, redeploy or regeneration never re-derives or resets it. |
| D1.10 | **The assignment is strictly monotonic per snapshot key**, which is what makes D1.9 safe: `snapshotObservedAt := max(now, previousSnapshotObservedAt + 1 tick)`. Because the result is *strictly* greater than the previously published value, no changed snapshot can ever sort at or before its predecessor under ADR 0005, whatever happened to the contributing resources. |
| D1.11 | **Equality and clock regression are handled, not assumed away.** `1 tick` is one unit of the published serialization precision, which is **milliseconds** (`.000Z`). The guarantee fails if any stage truncates to whole seconds, so the precision is verified end to end rather than inferred from the OpenAPI `date-time` format: the Worker emits `Date.prototype.toISOString()` via `runtime/clock.ts` (`isoNow`), which always writes milliseconds; the Flutter client parses with `DateTime.parse(...).toUtc()` in `mappers/wire.dart` and `freshness_mapper.dart`, which retains sub-second precision; and Drift persists it under `DriftDatabaseOptions(storeDateTimeAsText: true)` (`lib/core/database/gridview_database.dart`), i.e. as ISO-8601 **text**, so no second-granularity Unix-epoch truncation occurs. The `max(...)` also absorbs a backwards clock step (NTP correction, host skew). |
| D1.11a | **When the clamp fires, the value is no longer a wall-clock measurement — say so.** `max(now, previous + 1 ms)` is a **local monotonic publication clock**. Whenever the `previous + 1 ms` branch wins — because two revisions were published inside the same millisecond, or because the host clock moved backwards — the published `sourceUpdatedAt` is *not* a literal first-observation time. It remains a conservative **local ordering proxy**, it never claims anything about the provider, and each activation must raise an operational event so the substitution is visible rather than silent. The excess over wall clock is bounded by the size of the regression, and is the already-documented "appears newer" direction. |
| D1.12 | **Resource-level `sourceObservedAt` is never published.** It stays internal reconciliation state (§10.4.1 T0/T1/T3). Only `snapshotObservedAt` reaches the wire. |

#### The canonical hash input for `snapshotRevision`

Binding, because an ambiguous hash input would make the revision unstable and
the monotonic assignment meaningless.

**Included:** exactly the normalized, stable, public `data` payload that the
snapshot serves — nothing else.

**Excluded, without exception:**

| Excluded | Why |
|---|---|
| `requestId` | Per-request transport metadata |
| `generatedAt` | Regeneration time; would make every rebuild a new revision |
| `sourceUpdatedAt` | Derived *from* the revision — including it would be circular |
| `snapshotObservedAt` | Internal, and likewise derived from the revision |
| `staleAfter` | Time-varying policy output, not content |
| ETag values | Transport metadata derived from the payload |
| Server-stale flags | Freshness state, not content |
| Provider observation timestamps, `fetchedAt`, `reconciledAt` | Provenance, not content |
| Provider identifiers | Internal mapping inputs, never public (§10.8) |
| Retry and reconciliation state | `pendingRevision`, confirmation counters, review slots |
| `contentVersion` **when it is itself derived from the same payload** | Never fed recursively into its own hash input |

**Determinism rules:**

| Aspect | Rule |
|---|---|
| Key ordering | Object keys serialized in **lexicographic (UTF-8 code-point) order** at every level. Insertion order is never relied on. |
| Array ordering | Arrays whose order is **semantically meaningful** (calendar rounds, classification positions, standings) are serialized in that domain order, which is part of the content. Arrays with **no** meaningful domain order are sorted by their stable GridView identifier before hashing, so an incidental reordering upstream is not a false revision change. |
| Null vs absent | Normalized to **one** representation: an optional field that is absent and one explicitly `null` serialize identically, so a provider switching between the two is not a false change. |
| Dates | Serialized as **ISO-8601 UTC** with a fixed precision, `Z` suffix, never a local offset — so an equivalent instant written in another zone hashes identically. |
| Numbers | A single canonical numeric form: integers without a decimal point, decimals with a fixed normalized representation, no exponent notation, no `-0`, no trailing zeros. Fractional championship points therefore hash stably. |
| Schema version | The snapshot `schemaVersion` **is** part of the hashed payload, because a schema change genuinely changes the public representation and must produce a new revision. |
| Atomicity | The revision is computed, compared and — if it differs — assigned its `snapshotObservedAt` inside the **same publication transaction** that writes the snapshot, so a crash between generation and publication can never leave a revision without its timestamp or a timestamp without its revision. |

**The property this buys.** A removal, a membership change, a filtered-set
change or any normalized field change produces a **different** revision and
therefore a new, strictly later `sourceUpdatedAt`. Re-reading or regenerating
identical normalized data produces the **same** revision and does **not** move
the timestamp.

**What the proxy proves.** That the normalized public snapshot GridView serves
for this key has not changed since `snapshotObservedAt`, as observed by GridView.
It also keeps ADR 0005's conflict rule self-consistent for the writes GridView
actually makes: D1.10 makes the published `sourceUpdatedAt` **strictly
increasing** per snapshot key, so rule 2 (newer applies) always fires for a
changed snapshot, rule 1 (older rejects) can never fire against GridView's own
publication sequence, and the equal-timestamp branches — rules 3 and 4 — are
unreachable for successive snapshots on the same key.

**What the proxy does not prove.**

1. **It is not the upstream modification time.** It is GridView's first
   observation of the current revision, which is an *upper bound* on when
   upstream actually changed.
2. **It therefore makes upstream data look newer than it is, by up to one
   polling interval** — up to six hours on the calendar cadence, less around a
   session. A consumer computing `now - sourceUpdatedAt` gets a *lower* bound on
   the true age. This is a cost of the proxy, not a point in its favour.
3. **It does not provide sound ordering between different reconciled
   payloads.** Self-consistency of GridView's own write sequence is not
   correctness with respect to upstream: if a stale replica supplies content
   that is genuinely older, GridView will publish it carrying a *newer*
   `sourceUpdatedAt`. See §2.
4. It says nothing about content GridView has never observed.

**Public documentation must state the substitution.** Where a provider does not
expose source recency, `sourceUpdatedAt` is GridView's first-observed timestamp
for the currently published **normalized snapshot revision**. It must not be
described as the actual upstream modification time, and no ordering guarantee
about the *provider* may be claimed from it. The monotonicity in D1.10 is a
property of GridView's own publication sequence and nothing more.

### 2. Residual reconciled-ordering risk: accepted, with monitoring

Of the three options in Evaluation §10.9.1, **option 1 is adopted**: accept the
residual risk with the existing mitigations, plus monitoring that surfaces every
reconciled overwrite for inspection rather than trusting it silently. Requiring
operator review for *every* reconciled overwrite (option 2) was rejected as
disproportionate; re-keying on a source-derived signal (option 3) is not
available, because no such signal exists in either source.

The following are **binding**:

| # | Rule |
|---|---|
| D2.1 | A differing reconciled payload must be observed in **two consecutive** reconciliation checks before it may replace an **unsettled** reconciled payload. |
| D2.2 | A `contentRevision` previously stored for a resource and since superseded is **never re-applied**, however many consecutive checks return it. |
| D2.3 | A **provisional** payload never replaces a **reconciled** one. It is rejected and logged, never merged. |
| D2.4 | Reconciled payloads are **never** ordered by fetch time, `generatedAt`, `reconciledAt`, or by comparing hashes. |
| D2.5 | A differing payload for a **settled** record is **never applied automatically**. After the required corroboration it is **retained for review**, the published snapshot is unchanged, and a staged-review event is raised. **A staged correction is immutable until an operator disposes of it**: no later provider response may publish, discard, overwrite or replace it. A competing revision is tracked in a separate bounded slot and must satisfy the same two-consecutive-check corroboration independently before it becomes a second review entry; a single sighting never stages anything. |
| D2.6 | **Identical payloads are idempotent.** They may refresh confirmation metadata (`reconciledAt`, the confirmation count) but must not rewrite the published content and must not advance `sourceObservedAt`. |
| D2.7 | Every reconciled **overwrite** produces a safe operational event suitable for monitoring and inspection. |
| D2.8 | A corroborated change to a **settled** record produces a **distinct** staged-review event, separate from D2.7. |
| D2.9 | Monitoring fields are structured, bounded, non-personal and safe for logs. **No credentials or authorization material, no raw upstream bodies, no unbounded provider values.** |

**The unresolved failure mode is acknowledged and is not closed by this ADR.** A
persistently stale replica may return an older revision that GridView never
previously stored. Corroboration cannot distinguish it from a genuine
correction, because repetition proves only that the source being read is stable,
not that it is current; and the superseded-revision ledger cannot recognise it,
because the ledger only remembers revisions that were once current here.
**Reconciled writes are ordered on a best-effort basis with explicit mitigations
and monitoring.** The withdrawn absolute assurance — that stale or superseded
reconciled data can never replace newer data — is **not** restored, and must not
reappear in any document, test name or exit criterion.

### 3. The five settling invariants are binding

I1-I5 in Evaluation §10.4.1 are **accepted as binding Phase 9B requirements**:

| # | Invariant |
|---|---|
| **I1** | **Corroboration must be reachable.** Every pending revision must have a defined subsequent check at which it can be confirmed or discarded. |
| **I2** | **Settlement must be reachable from any starting point**, including a result first published or changed late in the normal check sequence. |
| **I3** | **High-frequency and daily per-session polling must terminate.** Polling must not accumulate without bound across the season. |
| **I4** | **Late corrections to the specific classification resource must remain observable** through a slow post-settlement ingestion path that re-reads *that* resource. Independently polling standings does not satisfy this. |
| **I5** | **The ordinary case must continue to target reconciled data within 24 hours**, subject to provider availability. A GridView objective, never an SLA or a guarantee. |

### 4. The settling state machine

The concrete design is specified in
[`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md)
**§10.4.1**: a state table, an ordered transition table, a per-invariant
satisfaction table and a walk through first publication at each check in the
sequence. It required no further product decision, so it is settled at entry
rather than deferred to exit. Its shape:

- **Two axes are kept separate.** *Provenance state* is `provisional` or
  `reconciled` and says which source last wrote the record. *Review state* is
  `unsettled` or `settled` and says whether the record may still be changed
  automatically. `pendingRevision`, `staged` and `review_locked` are markers on
  the review axis, never on the provenance axis.
- **Review state is bounded by construction:** at most one immutable
  `stagedCorrection`, at most one independently corroborated
  `competingCorrection`, and at most one transient `candidateRevision` — never
  a growing list of provider payloads. A second corroborated correction locks
  the record for operator escalation instead of displacing the first.
- **Settling predicate:** three consecutive checks returning the published
  revision, evaluated **only from the `+24h` check onward**, with no pending
  revision outstanding. In the ordinary case — first reconciled value at check 1
  — settlement coincides exactly with the end of the normal cadence at `+24h`.
- **Bounded cadence:** the four dense checks at `+5/+9/+15/+24` hours from the
  Jolpica start anchor, then daily **only while unsettled**, and a hard ceiling
  at **`jolpica_anchor + 14 days`** — the same scheduled session start, never
  the first-publication time — at which the resource is settled on deadline with
  its own event, whatever its confirmation count. Maximum **17 checks on this
  cadence**; that is not a lifetime per-resource total, because sweep re-reads
  follow settlement and are bounded by budget rather than by count.
- **Bounded slow path:** after settlement the same classification resource joins
  a **fixed-budget weekly rotating sweep** (8 slots, one slot = one
  classification request), with failed reads consuming their slot so a failing
  resource cannot starve the queue, and with corroboration priority capped at
  **half the budget** so the rotation always keeps at least 4 slots. Rotation
  order is the persisted `lastSweptAt`; priority order is the persisted
  `(lastPriorityAttemptAt, firstSeenAt, resourceKey)` tuple, drawn
  least-recently-attempted first so a new candidate can never permanently
  overtake an older one. Resources leave the sweep once their season is
  `completed` and they have been swept once after its final round.
- **Active polling and operator review are different obligations** *(corrected
  2026-08-22, PR #8 review)*. A staged correction leaves the **active sweep**
  for a durable **operator-review backlog** that issues no *scheduled* request
  and consumes no sweep slot. The backlog is **never automatically polled**, so
  the scheduler cannot execute the staged-record transitions at all; they run
  only inside an explicit, per-record **operator verification**, which is manual
  recovery traffic charged to the existing reserve and subject to the same
  outbound hardening, rate limiter, call counting and quota checks as any other
  request. The backlog is itself capped at **60 records globally across
  seasons**, with **no automatic eviction or age-based deletion**; at capacity
  reconciliation **fails closed** — nothing is published, nothing is overwritten,
  a typed capacity-exceeded event alarms, and publication for that resource stays
  blocked until an operator releases capacity through disposition. The cap bounds
  storage and operational state only; it grants no retention right, and provider
  payload retention stays subject to the unresolved licensing, historical-retention
  and ShareAlike gates. Active membership is therefore genuinely bounded by the season shape
  (`<= 60`), which is what makes the intervals below true: **8 weeks** normally
  and **15 weeks** under sustained priority contention for the rotation, and
  `ceil(P / 4)` weeks for a corroboration attempt — 1 week when at most 4
  candidates are eligible, 15 weeks at the absolute ceiling. The previous
  unconditional "within 7 days" corroboration claim is **withdrawn**: 4 priority
  slots cannot serve 5 or more candidates in one sweep.
- **A staged payload is never abandoned and never overwritten.** It is retained
  until explicit operator disposition; season completion removes a resource from
  the active sweep but never from the backlog, so it cannot orphan or discard a
  staged payload. After disposition the resource re-enters the sweep only if it
  is still inside the active observation horizon.
- **Failure is never a state change.** A failed, missing, malformed, empty or
  rate-limited response writes nothing, confirms nothing and discards nothing;
  the previous published snapshot remains served throughout (Evaluation §10.6).

### 5. OpenF1 fail-closed rule (E6)

Preserved in full and binding. Until GridView records a **justified upper bound
on the actual end of each applicable session type, supported by an official
source and an access date**:

| # | Rule |
|---|---|
| D5.1 | **Every real OpenF1 request is skipped.** The bound-or-skip rule applies to every session, not to an unlucky few. |
| D5.2 | **There are no exceptions.** No baseline request, metadata request, discovery call, health check or test request outside the gate. An ungated schedule lookup could itself fire inside the live window. |
| D5.3 | The **scheduled start of the next session is not a valid upper bound** — delays cascade, so it passes while the earlier session is still running. |
| D5.4 | **Scheduled end time alone is not a valid anchor.** The live window closes 30 minutes after the session *actually* ends. |
| D5.5 | OpenF1 **may** be implemented and tested against **local fixtures**, and must remain unable to contact the live service. |
| D5.6 | **Jolpica scheduling is independent of the OpenF1 gate** and runs from its own always-available anchor. Jolpica is the only provider currently eligible for later real integration. |
| D5.7 | The **30-60 minute provisional freshness objective (C6) is not currently delivered** by any mechanism. |
| D5.8 | The maximum-session-duration item **remains open**. It blocks only the real OpenF1 path, never Jolpica development. |

Recording that bound is Phase 9B work, requires an official source, and is
**not** attempted here.

### 6. What this ADR does not do

No adapter, provider DTO, live provider mode, cron trigger, Cloudflare resource,
binding, deployment, credential or schema change is created by this decision.
`PROVIDER_MODE` remains `"none"` in production and the mock provider is
preserved. Phase 9B implementation has **not** started.

## Relationship to the existing ADRs

### What it qualifies in ADR 0005

[ADR 0005](0005-snapshot-conflict-and-freshness.md) stays **Accepted and in
force**. Its conflict rules 0, 0b, 1, 2, 3 and 4, its freshness rules, its
transaction atomicity and its nullability table are unchanged, and the client
implementation needs no change.

This ADR qualifies **one thing**: what `sourceUpdatedAt` *means* when the
upstream source publishes no recency signal. ADR 0005 defines it as "the
age/revision of the underlying source data" and warns that it must not be
conflated with `generatedAt` or `contentVersion`. Both warnings remain exactly
as written. What is added is that for OpenF1 and Jolpica the published value is
GridView's **first-observed** timestamp for the current normalized revision — a
proxy for source age, not the thing itself, with the understatement in §1 stated
rather than hidden. ADR 0005 keeps its original history; a qualification note
points here.

### How it composes with ADR 0019

[ADR 0019](0019-formula-one-provider-legal-gate.md) stays **Accepted and
unchanged in substance**. Its licensing decision, its compliance obligations,
its accepted residual third-party-rights risk and its fallback order are
untouched. This ADR does not revisit any of them and creates no new licensing
position.

What it does is **close the three entry criteria ADR 0019 deliberately left
open** — E5a (§1 and §2), E5b (§3, with §4 additionally supplying the design)
and E6 (§5) — on the terms ADR 0019 itself set out. ADR 0019 §9's technical
design is preserved in substance, including its statement that corroboration and
the ledger do **not** make reconciled ordering sound. Where ADR 0019 says the
choice among the §10.9.1 options "is folded into the E5a decision", this ADR is
that decision.

## Consequences

- **Phase 9B entry is unblocked on E5a, E5b and E6.** An adapter can now produce
  a contract-valid snapshot, because `sourceUpdatedAt` has a defined, derivable
  value.
- **The public wire contract is unchanged.** No field is added, removed or made
  nullable; only the description of `SnapshotMeta.sourceUpdatedAt` changes to
  match the semantics actually published. No client release is implied.
- **The proxy costs honesty about age.** Published data can appear newer than it
  is by up to one polling interval, and every surface that describes the field
  must say so.
- **A residual rollback path stays open** and must be reported as such: exit
  criteria, tests and operational documents may claim only best-effort ordering
  with mitigations and monitoring.
- **Monitoring becomes Phase 9B scope**, not optional polish: a reconciled
  overwrite event, a distinct staged-review event, and the field discipline in
  D2.9.
- **Observation state must be persisted at the edge.** `snapshotRevision` and
  `snapshotObservedAt` per published snapshot key, plus `sourceObservedAt`,
  `contentRevision`, `pendingRevision`, `supersededRevisions`, the confirmation
  count and the review state all have to survive a restart, which is part of the
  already-recorded gap G9 (`services/edge-api/`). **No Drift schema change is
  implied**: the client keeps its existing snapshot columns.
- **`sourceObservedAt` is coordinator state, not adapter state.** Deriving it
  needs the previously stored revision, which a stateless adapter does not have.
  This lands on the coordinator that gap G4 introduces.
- **No code change is required today.** The value is read in
  `snapshots/generator.ts`, `publication/publisher.ts`, `routes/status.ts` and
  `http/cache.ts`; all four continue to work unchanged against a required UTC
  date-time string, and the mock provider keeps supplying its own literal.
- **OpenF1 stays locked**, so the C6 objective stays undelivered and the
  reconciliation path carries every resource.

## Alternatives considered

**Re-key the conflict semantics on `contentRevision` and make `sourceUpdatedAt`
advisory or nullable.** Rejected. It is the larger change — it touches ADR 0005,
the OpenAPI contract, the Flutter remote parser, the Drift write path and the
client conflict rule — and it buys less than it costs: `contentRevision` is
identity, not ordering, so it can say that two payloads differ but never which
is newer. It would remove the need to publish a value GridView cannot derive
without solving the ordering problem at all. Making the field nullable purely to
avoid the design work was explicitly not accepted.

**Publish `fetchedAt` under `sourceUpdatedAt`.** Rejected outright, in ADR 0005
and again here. Every re-read of unchanged content would look like fresh
upstream data, which is the precise failure the field exists to prevent.

**Require operator review for every reconciled overwrite** (§10.9.1 option 2).
Rejected as disproportionate: the ordinary case is a first reconciled write with
nothing stored before it, and gating those on human review would make routine
publication depend on an operator.

**Re-key on a source-derived signal** (§10.9.1 option 3). Not available. Neither
source publishes a version, an update timestamp or a usable `Last-Modified`, and
nothing in the payloads themselves orders two classifications.

**Defer the settling design to Phase 9B exit**, as E5b permits. Not taken,
because a concrete design satisfying all five invariants was reachable without a
further product decision. Deferring it would have left the request-volume model
a lower bound for no benefit.

**Use the scheduled next-session start as the OpenF1 end bound.** Rejected as
unsound, unchanged from ADR 0019 and Evaluation §10.2: delays cascade, so it
fails exactly in the case it was meant to cover.

**Research a maximum session duration in this pass.** Out of scope by
instruction, and it needs an official source with an access date rather than an
inferred figure.

## Residual risks

| # | Risk |
|---|---|
| N1 | A persistently stale replica can still roll an unsettled reconciled record backwards with a revision GridView never stored. Mitigated, not eliminated. |
| N2 | Published age is understated by up to one polling interval, so a consumer's freshness computation is optimistic. |
| N3 | The settling design is specified but unimplemented and unmeasured; its request-volume figures are modelled, not observed. |
| N4 | The 14-day settle-on-deadline ceiling and the weekly sweep budget are chosen bounds, not empirically validated ones. Both are tunable without reopening this ADR, provided I1-I5 still hold. |
| N5 | While OpenF1 stays locked, every resource depends on a single volunteer-run source with no SLA. |
| N6 | Where Jolpica omits the optional session `time`, the end-of-day anchor fallback can push a resource outside C7. Known and accepted (Evaluation §10.4). |

## Implementation obligations

Binding on Phase 9B, verified at its exit and in the release sweep:

1. Derive and persist `sourceObservedAt` per resource revision as **internal**
   reconciliation state, and `snapshotObservedAt` per **published snapshot
   revision**; publish only the latter as `sourceUpdatedAt`, under the strictly
   monotonic assignment in D1.10 at millisecond precision; never advance either
   on an identical revision; never publish `fetchedAt` or `generatedAt` under
   the field. Compute `snapshotRevision` from the binding canonical input in
   §1, and raise the clamp event whenever `previous + 1 ms` wins.
2. Enforce the operator-backlog capacity of 60 records globally, with no
   automatic eviction and no age-based deletion, failing closed with a typed
   capacity-exceeded event and an operator alert when it is reached; and keep
   the staged-record transitions unreachable from the scheduler, running only
   under an explicit operator verification that is charged to the manual-recovery
   reserve and passes through the same provider controls as any other request.
3. Implement the §10.4.1 state machine exactly as specified, and record the
   implementation against I1-I5 individually.
4. Implement D2.1-D2.9, including both operational events and the field
   discipline.
5. Enforce D5.1-D5.6: no OpenF1 request may leave the Worker until a bound is
   recorded, and the OpenF1 adapter is fixture-tested only.
6. Claim in tests, exit criteria and operational documents only what the adopted
   strategy delivers — best-effort ordering with mitigations and monitoring.
7. Keep the public contract provider-neutral: none of the internal provenance
   fields appears in a v1 DTO.

## Reopening conditions

| Trigger | Consequence |
|---|---|
| Either source begins publishing a genuine update timestamp or version | Re-key `sourceUpdatedAt` on the real signal and supersede §1; the proxy becomes unnecessary |
| An observed rollback reaches published data | Reassess §2 immediately; option 2 (review every reconciled overwrite) returns as the leading candidate |
| The implemented state machine cannot satisfy an invariant in practice | Reopen §4 rather than weakening an invariant silently |
| A justified session-end bound is recorded with its source | The OpenF1 path unlocks under §5; C6 becomes deliverable and must be re-verified |
| The source set changes under ADR 0019's fallback order | Re-evaluate §1 and §2 against whatever recency signal the new source offers |
| Any monetisation is contemplated | ADR 0019 reopens first; this ADR follows whatever it decides |

## References

- [`0005-snapshot-conflict-and-freshness.md`](0005-snapshot-conflict-and-freshness.md) — the conflict rule and freshness semantics this ADR qualifies
- [`0019-formula-one-provider-legal-gate.md`](0019-formula-one-provider-legal-gate.md) — the licence-compliance decision and the twelve-criterion entry gate
- [`0011-typed-conditional-http-results.md`](0011-typed-conditional-http-results.md) — the typed `invalidResponse` a missing `sourceUpdatedAt` maps to
- [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) §10.2, §10.4.1, §10.7, §10.7.1, §10.9, §10.9.1, §14.4, §15.2
- [`../technical/GridView_Implementation_Plan.md`](../technical/GridView_Implementation_Plan.md) §14
- [`../technical/GridView_Backend_Scheme.md`](../technical/GridView_Backend_Scheme.md) §15
- [`../api/gridview-api-v1.yaml`](../api/gridview-api-v1.yaml) — `SnapshotMeta.sourceUpdatedAt`
