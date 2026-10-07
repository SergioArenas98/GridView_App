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
| D1.2 | **Re-reading identical normalized content never advances it.** An idempotent re-check refreshes confirmation metadata only; `sourceObservedAt` is unchanged. It is internal state (D1.12), so it never sets the wire value on its own: the published `sourceUpdatedAt` is unchanged in this case because the resulting snapshot carries the **same `snapshotRevision`** and therefore keeps its existing `snapshotObservedAt` (D1.9). |
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

## Implementation notes

Added **2026-09-03** by Phase 9B-6 (PR 1). These record how obligation 1 is
being implemented and what is still outstanding. **The decision above is
unchanged**; nothing here revises it.

### What is implemented

`snapshotRevision` and its binding canonical input (D1.7), in
`src/publication/canonical/` and `src/publication/snapshot-revision.ts`. The
canonical input is **constructed** from a declared schema per snapshot key
rather than filtered out of a serialized envelope, which is what makes the
exclusion table hold by construction. The digest is SHA-256 over the UTF-8
bytes of a length-framed canonical text prefixed `gv-canon/1`, rendered as
`sha256:<64 hex digits>`. The full determinism rules and the per-key schemas are
recorded in
[`../technical/GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md).

`HomeData.freshness` — and therefore `BootstrapData.home.freshness` — is the
one place where excluded metadata lives inside `data`, but the exclusion is not
wholesale: four of its five properties (`generatedAt`, `sourceUpdatedAt`,
`staleAfter`, the server-`stale` flag) are exclusions in the table above, and
`contentVersion` is read, because it carries the same curated, provider-supplied
version `BootstrapData.contentVersion` already includes rather than a derived
or time-varying signal.

**It has no production caller.** Nothing yet assigns an observation time or
changes `meta.sourceUpdatedAt`.

### "Fixed precision" means one canonical spelling, not a digit cap

The `Dates` row says "a fixed precision". Phase 9B-5 accepts
`time-secfrac = "." 1*DIGIT` with no ceiling, exactly as RFC 3339 §5.6 writes
it, so the wire contract carries unbounded fractional precision. Truncating to
the millisecond the publication clock uses would make two distinct instants
share one revision, which contradicts D1.7's own purpose.

The row is therefore implemented as **one canonical spelling** — zone
normalized to UTC, insignificant trailing zeros dropped, every significant digit
preserved. This narrows nothing and loses nothing. `Date.parse` and `new Date`
are not used anywhere in the canonicalization, because both silently roll a leap
second into the following minute.

### D1.9-D1.11 are not implemented, and D1.10 is blocked

D1.9 and its failure properties are satisfiable by storing the
revision/timestamp pair with the **immutable versioned document**, which the
active pointer already makes atomic for readers.

**D1.10 is not reachable with the current architecture.** The assignment must be
computed pre-commit from the pair the active pointer names, and two publications
for one season can both reach `SnapshotPublisher` — the staging cron and the
protected `/internal/admin/sync/full`, which forces every job and always
publishes. Both read the same pointer, neither observes the other, and the
commit order is decided by interleaving. Two changed revisions can then receive
equal timestamps (ADR 0005 rule 3 skips a genuinely changed snapshot) or a
decreasing one (rule 1 rejects the active release). Workers KV offers no
compare-and-set and no cross-isolate lock (ADR 0007, ADR 0010), and a
read-before-write check, a last-write-wins race or an in-isolate mutex is not a
serialization guarantee.

D1.10 therefore needs a mechanism that genuinely serializes the assignment. That
is an infrastructure decision this ADR does not take and Phase 9B-6 was not
authorized to take. Until it is taken, `meta.sourceUpdatedAt` is unchanged, the
clamp event of D1.11a has nothing to raise, and **G-i stays open in both
halves**.

### The serialization decision, taken (2026-09-05, Phase 9B-6b design)

[ADR 0025](0025-season-publication-authority-and-rollback-republication.md)
takes the infrastructure decision the paragraph above says this ADR does not:
authority over each season's `activeVersion` (the pair D1.10's assignment must
be computed against) moves to one atomic transaction in a per-season Durable
Object's own storage, closing the two-unserialized-writers problem described
above without relying on Workers KV to provide anything it does not.

Four documentation-only clarifications follow; nothing below is implemented:

- **D1.9's comparison is, and remains, per snapshot key against the
  currently active revision for that key** — never against a global,
  cross-version historical revision identity, and never against a target
  version's own previously-recorded revision when that target was itself
  once active. This was always what D1.9 meant ("if a regenerated snapshot
  has the *same* `snapshotRevision` as the published one, it keeps that
  revision's existing `snapshotObservedAt`"); it is restated here because
  ADR 0025's rollback design (Model 1) makes the distinction load-bearing:
  a restored historical key is compared against **what is active now**, so
  its `snapshotObservedAt` reflects **continuous active residence** of that
  exact content — how long the currently-serving revision has been the
  active one — not some notion of "when this content was first ever
  observed across the season's whole history." A key that was active before,
  was replaced or withdrawn, and is now restored by a rollback gets a
  **fresh** timestamp by the same rule as any other key with no currently
  active revision to compare against — never by comparing it to its own,
  no-longer-retained pre-withdrawal value (ADR 0025 D3 corrected this: a
  withdrawn key's per-key state is not kept, precisely so it cannot be
  mistaken for a comparison basis).
- **Rollback Model 1 (ADR 0025 D8) creates a new activation for every
  restored key whose revision differs from what is currently active, or
  that has no currently active revision at all** (withdrawn and now
  restored) — never only the "differs" case — through the same D1.10
  monotonic assignment, floored by the season-wide
  `seasonSnapshotObservedAtHighWaterMark` (ADR 0025 D2/D4), computed during
  the sequencer's `prepare` step, **before** the immutable document carrying
  `meta.sourceUpdatedAt` is constructed, exactly as D1.9 already requires for
  ordinary publication ("It is persisted with the revision in the same
  publication transaction"). Rollback introduces no second
  timestamp-assignment mechanism.
- **Post-cutover, a published `meta.sourceUpdatedAt` carries that key's own
  assigned `snapshotObservedAt` (D1.8-D1.10) and is therefore *not* a
  release-wide provenance value.** Today's generator happens to write one
  release-wide `sourceUpdatedAt` uniformly into every document of a release,
  which is why ADR 0025 D12's migration and D8's legacy rollback path can both
  derive a legacy release's ordering input from those documents. Once the
  observation clock is active, that uniformity is gone by design: each key's
  value is its own activation timestamp. The release-wide `sourceOrderingInput`
  a rollback needs therefore lives in ADR 0025 D3's internal per-version
  `__publication_metadata` record — never in a public document, never in a
  public contract field, and never inferred from `meta.sourceUpdatedAt` on a
  post-cutover version. This changes nothing in D1.8: the wire shape, the
  required field and the conflict semantics are all unchanged.
- **A D1.11a clock-regression clamp can place a historical
  `snapshotObservedAt` ahead of the wall-clock time it was actually
  assigned.** This is the concrete mechanism by which
  [ADR 0025](0025-season-publication-authority-and-rollback-republication.md)
  D12's cutover migration seed is **not** guaranteed to dominate a timestamp
  held only by a pre-cutover version outside a complete, audited set — one
  whose KV keys were deleted, one temporarily omitted from the eventually
  consistent `listVersions` prefix scan that repository already has, one
  recorded only in an operator's external records, or a snapshot retained
  only by an offline client. D1.11a's already-documented "appears newer"
  direction becomes, for that migration, an explicit **activation
  precondition**, not merely a bounded-excess note. See ADR 0025 D12, "The
  pre-cutover historical-floor activation precondition" and "The completeness
  limit."

**D1.9-D1.11 remain unimplemented in every deployed environment.** ADR 0025's
**Mechanism slice** (2026-09-06) and **Integration slice** (2026-09-08) both
exist in code: the inert Durable Object class and its durable state machine,
the per-version metadata sidecar's storage operations, and now
`SequencedPublicationService` wiring the two-phase protocol into ordinary
publication, rollback and the public read path behind a
`PublicationAuthorityMode` composition boundary. **That boundary is disabled by
default** - no environment sets `SEASON_PUBLICATION_AUTHORITY`, no
`wrangler.toml` binding, `[exports]` entry, migration or Durable Object
namespace declares the class, and no provisioning, deployment, seeding, cutover
or activation has occurred. (Superseded in part, and true when written: the
2026-09-10 staging cutover preparation slice declared the export and a
staging-only binding, and the 2026-09-12 staging deployment
`985115b7-abb3-4346-8845-d8ff41c80cf6` provisioned the staging namespace. The
authority mode is still unset and no seeding, cutover or activation has
occurred — see ADR 0025 D12.) So nothing computes a `snapshotObservedAt` on any
production publication path: `meta.sourceUpdatedAt` is unchanged today (the
sequenced path that assigns per-key values runs only under a test that has
seeded and activated a season), the D1.11a clamp event has nothing to raise
yet, the **resource-level `sourceObservedAt` half of G-i is untouched**, and
**G-i stays open in both halves** at least until the cutover sequence ADR 0025
D12 governs has been separately authorized and completed: admission closure,
operator checkpoint construction and approval, the seed and the separate
activation, each its own authorization. Staging provisioning is not
outstanding; it completed on 2026-09-12. Smoke and latency verification and any
production decision are later, separately authorized gates (ADR 0025 D12).

### G5 and G9 remain open behind a dormant coordinated runtime (2026-09-27)

The dormant coordinated runtime composition (Implementation Plan §14.0.29;
ADR 0023 D14 status note) adds only a **seam** for the G9 reconciliation
ledger: the `ReconciliationLedgerPort` interface in
`src/sync/coordinated/ledger-port.ts`. It has no implementation, no Durable
Object, no binding and no test hook, so `resolveReconciliationLedger` always
answers `null`. Every coordinated run is refused as `ledger-unbound` before any
provider request.
*(Superseded in part on 2026-09-27, and true when written. The C1 note below
adds the storage implementation as an exported Durable Object class. It is
unregistered and unbound, and the resolver still answers `null`.)*

**None of obligations 1-4 is advanced by it.** The obligations stay open:
`sourceObservedAt`, the 60-record backlog capacity, the §10.4.1 state machine
recorded against I1-I5, and D2.1-D2.9. The event-aware G5 scheduler does not
exist either. The runtime
fixes one rule in code ahead of both. A manual coordinated run is a forced
publication run that **never advances scheduled due times**, so it cannot move
the cadence or build D2.1 corroboration by repetition (runtime activation
decision O-8). Obligation 5 is unchanged and reinforced by wiring: no OpenF1
port is registered, and no provisional bound is passed.

The decision above is unchanged.

### C1: the reconciliation ledger storage foundation (2026-09-27)

Owner decision **O-6** chose G9's storage: one global SQLite-backed
`ReconciliationLedger` Durable Object, intended to be addressed by the stable
name `reconciliation` once it is bound. Implementation Plan §14.0.30 records
the **storage foundation** built on that decision. It is storage and protocol
only, under `src/sync/coordinated/ledger/`, and it is **dormant**. The class is
a named Worker export with no `[exports]` entry, no migration and no binding.
`resolveReconciliationLedger` still answers `null`, so every coordinated run is
still refused as `ledger-unbound`. O-6 approved no binding, migration,
provisioning or deployment, and none was made.

What the storage now guarantees, for a later G9 implementation to build on:

- **Closed, versioned, payload-free records** (schema version 1). They hold
  only bounded identifiers, canonical UTC instants, bounded counters, closed
  states and `sha256:` revision hashes, and every read and write is strictly
  decoded. No record can carry a provider body, a normalized payload, a name, a
  URL, a header or a credential. The provider-payload retention gates in §4 are
  therefore not engaged by the ledger.
- **Fenced per-season leases** with a 10-minute lifetime and a fencing token
  that only ever grows. A released, expired or superseded token commits
  nothing and cannot release.
- **Versioned conditional commits**, applied all or nothing. A refused or
  failed transaction changes no record.
- **Obligation 2's capacity half.** The operator backlog is capped at 60
  records **globally across seasons**, with at most one entry per
  classification resource. A competing correction stays on the record's own
  slot, never as a second entry. The cap is counted inside the committing
  transaction of the one global object. An insertion that would exceed it is
  refused, and there is no eviction and no age-based deletion. The typed
  capacity-exceeded **event**, the operator alert and the disposition path are
  **not** implemented. Obligation 2 therefore stays open.
- **D2.2 at the storage layer.** The superseded-revision history is bounded (16)
  and append-only. An insertion beyond it is refused rather than made room for
  by eviction, so no revision can be forgotten and then applied again. While a
  revision is in the history, no candidate, staged or competing slot may hold
  it.
- **The ledger is not a publication authority.** `publishedRevision` is a cache
  that only `reconcilePublishedRevisions` writes, from the authoritative
  release's revisions. An ordinary commit can never set it, and reconciliation
  never refuses the authority's value, including after a rollback.

**Obligations 1, 3 and 4 are not advanced, and G9 and G5 are not complete.**
Still open:

- the §10.4.1 observation transitions, recorded against I1-I5;
- D2.1 corroboration, settling, and D2.3-D2.9 with both operational events;
- the due-work planner (G5);
- the no-change publication gate (O-12) and ordering input (O-13);
- source ordering, and the observation and outcome orchestration.

Owner decisions **O-3 to O-5, O-7, O-9 and O-12 to O-16** remain open. So do
**round coherence** and **empty-standings replacement** (ADR 0023 A3.5), and
**attribution**. These belong to PR-C2 and later, separately authorized steps.
*(Superseded in part on 2026-09-27, and true when written. The C2 note below
implements the §10.4.1 transitions and the due-work planner as dormant pure
policy, under owner decisions O-3, O-4, O-5(a) and O-7. The other items in
this list stay open.)*

The decision above is unchanged.

### C2: the reconciliation policy and due-work planner (2026-09-27)

Implementation Plan §14.0.31 records the **pure policy and planner** built on
the C1 ledger. They live in `src/sync/coordinated/policy/`. They are
**implemented, not connected**: no Worker module imports them, and
`resolveReconciliationLedger` still answers `null`. The scheduled handler and
the manual route therefore still stop at `ledger-unbound`, with zero provider
requests and zero publication writes. **G5 and G9 are not complete.**

**Owner decisions taken for this dormant implementation:**

- **O-3.** A publication candidate rereads every round with an accepted
  classification, plus every check due now. No provider row carries over from
  an earlier run. The request cost against the three-request model is recorded
  in Provider Evaluation §11.1.
- **O-4.** Race classifications carry D2.1 corroboration and the §10.4.1
  review machine. The calendar, circuits, participants and both standings are
  **refresh resources**: an identical revision is idempotent, a differing one
  overwrites and raises an overwrite event, and nothing settles.
- **O-5(a).** If any selected round is pending, staged, review-locked,
  superseded or otherwise not accepted, the **whole season candidate is
  withheld**. No row of an earlier release is substituted. **Consequence:** a
  staged correction withholds the season until an operator disposes of it
  (T12), and no disposition mechanism exists yet. A persistently rejected
  correction can therefore keep the season frozen until that separate
  mechanism exists.
- **O-7, as a planning target only.** The eventual cron is hourly at minute 17.
  The planner does not depend on the cron. The committed cron stays
  `17 3 * * *`, and no environment changed.

**How D2.1-D2.9 are enforced:**

| Rule | Enforcement |
|---|---|
| D2.1 | An unsettled differing revision is recorded as pending (T2). It is accepted only when the next **cadence** check returns it again (T3). A third revision replaces it (T4), and the third consecutive replacement raises the unstable-source event. |
| D2.2 | A superseded revision is rejected however often it returns (T5), and it clears any pending run. The history is append-only and bounded at 16. When it is full, a corroborated change stays pending instead of forgetting a revision. The store now also refuses an accepted `contentRevision` that is in the history. |
| D2.3 | No provisional input form exists, and OpenF1 stays locked, so T7 cannot arise. |
| D2.4 | Revisions are compared for equality only. A test shows that swapping which hash sorts first changes no decision. |
| D2.5, D2.8 | A differing revision on a settled record is sighted once (T8). Its second sighting stages it (T9), and it is never applied. The staged slot is immutable. A staged or locked record takes **no** transition from any run, and T11-T11d stay unreachable. *(From any run, still. Since 2026-10-05, T11-T11c are reachable only through an operator verification: see E3.)* `classification.staged-correction` is its own event, distinct from the overwrite event. |
| D2.6 | An identical revision confirms and changes neither the accepted content nor `sourceObservedAt` (T1). An identical refresh revision is recorded as unchanged. |
| D2.7 | `classification.overwrite` fires on T3, and `refresh.overwrite` on a changed season-level revision. |
| D2.9 | An event is a closed category and nothing else: no season, round, revision, instant or payload. |

**How I1-I5 are shown** (each by its own test over the real C1 store, on
hourly minute-17 ticks):

| # | Demonstration |
|---|---|
| I1 | A revision first sighted at unsettled slot 2, 9 or 16 has a next check, and is accepted there. One sighted at the ceiling is staged, flagged uncorroborated. A late change to a settled round is read again within seven days and staged. |
| I2 | A first result at each of the 17 slots settles by the ceiling: by the predicate for slots 1-15, and on deadline for slots 16 and 17. So do a corroborated change, and a revision held pending by an alternating source. |
| I3 | At most 17 cadence checks, whatever the source does. After the last one, `nextDueAt` is `null` and no cadence check is planned again. |
| I4 | A settled round is reread by every publication run. The weekly season-level refresh guarantees one such run at least every seven days. A correction 20 days after the race is sighted, then staged, and never published. |
| I5 | In the ordinary case the first publishable candidate carrying the round comes at the first tick after `anchor + 5h`, within 24 hours, and the round settles at `+24h`. A companion test shows that this is an objective, not a guarantee: a source that answers only after 30 hours is published at the next due check, beyond 24 hours. |

**The schema refinement.** Schema version 1 was refined in place, because no
v1 record was ever stored: the class has never been registered or bound. The
refinement adds `ClassificationRecord.contentRevision`, the revision the
machine accepted, which is this ADR's `contentRevision` and §10.4.1's
"published revision". It is kept apart from the authority cache
`publishedRevision`, which only reconciliation writes. It also adds
`SeasonRecord.calendarAnchors`, the last observed race anchors the planner
schedules from. No binding or migration was added.

**Choices made in implementation, not owner decisions** (each is recorded in
Implementation Plan §14.0.31):

1. Only a **cadence** check is a reconciliation check on an unsettled record.
   An O-3 reread between slots is a read, not a check.
2. On a settled record, every publication-run reread is a slow-path check.
3. T5 also discards a pending revision, because corroboration must be
   consecutive.
4. The 14-day ceiling is a **time rule**. It fires at the final slot whatever
   that check returned, and never on a deferred or cancelled one.
5. A round with no result by the ceiling is abandoned and flagged. If a manual
   run later finds its first result, it settles on deadline at once.
6. A manual first write counts no confirmation.
7. At backlog capacity, or with a full revision history, the revision stays
   pending, so the season stays withheld, and it is retried at the next read.
8. Any unexpired limiter deferral recorded on a classification withholds
   scheduled planning. A deferred season-level request records nothing.
9. Standings are refreshed daily from the first race to the final race's
   ceiling, and weekly otherwise.
10. A round's own record anchor governs once the round is recorded.
11. A scheduled bootstrap honours the calendar's due time, so a failed
    bootstrap waits its six hours. A manual run asks at once.

**Still open, and prerequisites for any provider-backed run:**

- the runtime observation and outcome orchestration (decision pack §6.6);
- the no-change publication gate (O-12) and the ordering input (O-13);
- source ordering;
- round coherence and empty-standings replacement (ADR 0023 A3.5);
- attribution;
- operator verification, the T12 disposition, and the capacity alert;
- publication of `sourceObservedAt` (obligation 1; D1.9-D1.11);
- every binding, migration, provisioning, cron and staging-mode change.

Owner decisions **O-9 and O-12 to O-16** remain open. Obligations 3 and 4 are
implemented as policy but are not in force, because nothing runs the policy.
Obligation 2's alert and disposition path stay open.

*(Status note, 2026-09-28. The list above records what was open when C2
landed. Since then, round coherence (ADR 0023 A3.5 item 1) is implemented and
**dormant** (Implementation Plan §14.0.33): season assembly withholds any
candidate whose two standings tables are not both bound to the latest
selected, classified race round, as `standings-round-incoherent`. Empty
replacement follows from that rule and D14 only while the authoritative
predecessor is itself coherent, so no independent predecessor-standings guard
was added. The read-only operational gate on the active release that A3.5
item 2 requires is **not implemented**. It remains a required gate before
any staging activation. Jolpica's actual pre-season standings response has
not been observed. The runtime observation and outcome orchestration remains
open, and nothing runs the policy. This note does not revisit the other items
above.)*

*(Superseded in part on 2026-09-28, and true when written. The C3 note below
implements the observation half of the runtime orchestration as injected,
unconnected code. The outcome half, publication and every item above other
than round coherence stay open.)*

The decision above is unchanged.

### C3: the observation half of the runtime orchestration (2026-09-28)

Implementation Plan §14.0.34 records PR-C3. It implements decision pack §6.6
steps 1 to 5, the **observation half** of the runtime orchestration, in
`src/sync/coordinated/observation/`. It is **injected and not connected**. No
Worker module imports it, and `runCoordinatedSync` does not call it.
`resolveReconciliationLedger` still answers `null`, so the scheduled handler
and the manual route still stop at `ledger-unbound`, with zero provider
requests. The Wrangler dry-run bundle is byte-identical to the one before this
change. **G5 and G9 are not complete.**

**One run, for one season:**

1. The runtime is composed through the existing gate. A refused composition
   builds nothing that could send a request.
2. The season's fenced lease is acquired. If another run holds it, the run
   answers `run-in-progress`: it reads nothing from the authority and sends
   nothing.
3. The sequencer is asked which release is active. The run proceeds only when
   the season is **active and authoritative**. That release's
   `grand-prix:{round}:results` revisions are recomputed by the D14-D16
   predecessor read and reconciled into `publishedRevision`. The planner reads
   the reconciled snapshot.
4. The C2 planner decides. **Nothing due makes zero provider requests.** A
   calendar bootstrap, a due observation run and a publication run are the
   planner's own plans, unchanged. The O-3 reread and the scheduled cadence
   check stay distinct, because the planner's checks reach the policy as they
   are.
5. One plan is executed through the single coordinator. The coordinator reaches
   Jolpica only through the one routing port, the hardened HTTP client, the
   per-run pacer and the global limiter that the composition built. No other
   client is built, and the global `fetch` is never called.
6. Each request's result is mapped onto the C2 policy (`recordRunObservations`).
   The resulting records are committed in one conditional ledger transaction
   under the lease. The policy's instant is the **observation instant**, taken
   after every response has arrived. It is never the planning instant, so no
   attempt, observation or due time predates the response it describes.
7. The lease is released on every path after it was acquired.

**Revisions.** A race classification is recorded under the revision its
release would publish: `snapshotRevision` of a `grand-prix:{round}:results`
document at the generator's schema version. `contentRevision` and
`publishedRevision` are therefore equal exactly when the content is equal. A
test pins this against both a generated set and the active release. A
season-level refresh resource is compared only with its own earlier
observations. It is hashed as a domain-separated (`gv-observation/1`)
canonical JSON of the whole normalized payload, so every field counts,
including the internal standings round. Calendar anchors come from each race
session's UTC start.

**Failure accounting.** Only a completed request is a check.

| What the request did | Recorded as | Effect (C2 policy) |
|---|---|---|
| Selected candidate | `observed` | The §10.4.1 transition for its check kind |
| Sent and failed: upstream error, timeout, `429`, invalid payload or unresolved identity | `failed` (T6) | The attempt time, and a cadence slot is consumed. No revision, count, candidate or review state changes. |
| Limiter deferral, including one that interrupts a two-request execution | `deferred` with its `retryAt` | Only `limiterDeferralUntil`, and no slot. A scheduled tick sends nothing before `retryAt`. |
| Cancelled, limiter unavailable, or never reached | `not-attempted` | Nothing |

*(Amended 2026-10-06, "Run budget" below: a request the run's signal
aborted in flight, and a response that arrived after the abort, are also
`not-attempted`. They are not `failed` (T6), although the request was
sent and still counts in the run's accounting.)*

**Fail closed.** None of the following commits any observation or publishes
anything, and the lease is still given back:

- a lease that expired before coordination (no request is sent), or during the
  run (the store refuses the commit as `lease-expired` or `lease-superseded`);
- an authority that throws, cannot answer or is not active and authoritative;
- a release whose results cannot be read or are invalid;
- a refused reconciliation;
- a coordination the run cannot believe (a rejected plan, a violated
  invariant, an adapter error, a malformed answer, a missing resource);
- a selected payload that cannot be hashed or anchored;
- a refused, unavailable or uncertain commit.

The next clean run then makes exactly the requests the failed run was due to
make. Every outcome is one bounded log line (`sync.coordinated.observation`).
It carries closed statuses, the request count and a count per fixed policy
event category, and never a revision, round, instant, provider value or
payload.

**The boundary this slice stops at.** This slice does not implement the
following, and nothing in it does their work:

- calling `publishGuarded` or the bridge, or creating a release. The run
  outcome always says `publication: 'not-attempted'`;
- acting on the O-5(a) **publishability decision**. `recordRunObservations`
  computes it, and the run discards it;
- the **O-12 no-change gate**, the **O-13 ordering input** and the **O-14
  publication metadata**;
- the **publication outcome commit** (§6.6 step 9). One consequence must be
  closed by it before any activation. The C2 step-5 rule clears
  `publicationDueAt` on every scheduled publication run, including a cancelled
  or withheld one. The outcome commit must set it again whenever a candidate is
  not applied;
- **runtime activation**: connecting this path to `runCoordinatedSync`, a
  ledger binding, `[exports]` entry or resolver, `PROVIDER_MODE =
  "coordinated"`, the hourly cron, O-9, and the A3.5 staging predecessor gate.

G5 now plans real runs in injected tests. G9's transitions now run against
real requests' results there. Neither is in force in any environment, and
obligations 1 to 4 are unchanged in status.

*(Superseded in part on 2026-09-29, and true when written. The C4 note below
implements the publication half: `publishGuarded`, the publishability
decision, O-12, O-13, O-14 and the outcome commit, including re-setting
`publicationDueAt` on every non-applied path. Runtime activation stays open.)*

The decision above is unchanged.

### C4: the publication half of the runtime orchestration (2026-09-29)

Implementation Plan §14.0.35 records PR-C4. It implements decision pack §6.6
steps 6 to 9, the **publication half** of the runtime orchestration, in
`src/sync/coordinated/outcome/`. The injected orchestration in `observation/`
hands it every publication plan **under the same fenced lease**. It applies
owner decisions **O-12, O-13 and O-14** as the PR-C4 instruction states them.
It is still **injected and not connected**: no Worker module imports either
package, `runCoordinatedSync` is unchanged, and `resolveReconciliationLedger`
still answers `null`. Every scheduled and manual coordinated run therefore
still stops at `ledger-unbound`, with zero provider requests. **G5 and G9 are
not complete.**

**One publication run, under one lease.** Observation plans and nothing-due
runs behave exactly as C3 left them. A publication plan continues:

1. **Recovery, before planning.** A `publishing` slot left by an earlier run
   is resolved against the authority (below).
2. **Observation commit.** The C2 records are committed with the season marked
   `publishing`, so a run that never records its outcome leaves the
   publication due rather than lost.
3. **Publishability** is decided from the *committed* records (O-5(a)). A
   withheld candidate is never assembled.
4. **One candidate** is assembled and generated once by the bridge the
   composition built (`prepareCandidate`). It carries curated metadata (O-14)
   and a reserved ordering input (O-13).
5. **The no-change gate (O-12).** The digest is SHA-256 over `gv-candidate/1`
   and the sorted `(documentName, snapshotRevision)` pairs of the prepared
   set. These are the per-key revisions `prepare` receives, so `generatedAt`,
   `sourceUpdatedAt`, `staleAfter`, `fetchedAt` and the release label cannot
   change it. The guarded publisher is skipped only when the digest equals
   `lastPublication.digest` **and** a fresh authority read serves exactly
   `lastPublication.activeVersion`. That read is taken after the candidate
   exists, never reused from before coordination. An authority that cannot
   be confirmed never skips.
6. **Reservation.** One fenced commit writes the ordering input and the digest
   into the `publishing` slot. Without it, nothing is sent.
7. **One guarded publication** (`publishCandidate`, at most once per prepared
   candidate). The D14-D16 guard, prepare CAS and finalize are the existing
   ones.
8. **Outcome commit**, with an explicit durable next-due decision. Only then
   is the lease released.

**The race the gate cannot close.** Another writer can commit between the
fresh authority read and the outcome commit. The run then records the release
it confirmed while the authority serves another. The planner treats that
difference as drift (`releaseDrifted`): the reconciled `activeVersion` differs
from `lastPublication.activeVersion`, so a publication is due at the next tick
and the identical candidate is published again. A rollback is handled the
same way. The work is found at the next tick, not lost. Drift never retries a
season that is `blocked`.

**Ordering (O-13).** The release-wide `sourceOrderingInput` is the run's
observation instant, raised to one millisecond past the season's last
reservation when the clock repeated or went backwards. The ledger refuses any
season write that does not strictly increase `lastOrderingInput`
(`ordering-input-regression`), inside the fenced transaction. The per-key
`sourceUpdatedAt` stays the sequencer-assigned `snapshotObservedAt`,
unchanged. A reservation stays consumed when its publication is not applied.

**Metadata (O-14).** `contentVersion` is the curated dataset version. It is
`datasetVersion` of a new curated record,
`content/seasons/2026/season-metadata.development.json`. `seasonLabel` is the
same record's label. `attributionVersion` is the `version` of
`content/attribution/data-sources.json` (`data-sources-v1`), and `mediaVersion`
is `null`. Nothing comes from a provider response. A season without exactly
one valid record is `blocked` as `metadata-unavailable`. The record's two
values are curator-owned. `validate:content` checks the record's schema and
location.

*Curator confirmation, 2026-09-29:* the curator approved both values exactly
as committed: `datasetVersion` `2026.09.29.1` and `seasonLabel`
`2026 FIA Formula One World Championship`. `2026.09.29.1` is the initial
curated 2026 dataset version. Any later change to the curated 2026 identities
or provider mappings requires a new dataset version. The season label is
display metadata and does not imply FIA endorsement.

*Reissue proposed, 2026-10-07:* curating the off-calendar circuit `jeddah`
(Provider Evaluation §8.13) changes the curated 2026 identities and
mappings, so `datasetVersion` becomes `2026.10.07.1`. `2026.09.29.1` is
retired, never reused. The new value awaits curator confirmation together
with the identity; the season label is unchanged. *Confirmed 2026-10-08:*
the curator approved `2026.10.07.1` together with the identity.

**Every ending makes a durable next-due decision.**

| Ending | Decision |
|---|---|
| Applied | `completed`: `lastPublication` records the committed version and the digest |
| Identical digest, authority confirmed | `completed`: `confirmedAt` only, no release |
| Cancelled; season resource or classification unavailable; an assembly gap such as `standings-round-incoherent`; a stale or unreadable predecessor; a busy, superseded or refused `prepare`; a storage failure; an older ordering input | `retry`: `publicationDueAt` = now + 1 h |
| Withheld only as pending, unaccepted or superseded | `cadence`: the earliest selected round's next cadence check, never sooner than now + 1 h |
| Staged or review-locked record; D14 or D15 refusal; an invalid candidate or predecessor; a season not active on the sequencer; contract validation; `inconsistent-references`; generation failure; no curated metadata | `blocked`: no due time; the disposition holds the closed reason and when it began |
| `sequencer-authority-unavailable` (the commit is unknown) | `resolve`: the reservation is kept, and the next run decides |

A `retry` or `cadence` ending never clears an earlier block, because the run
never decided the held reason; only a completion or a new block replaces it.
A manual run records completions, blocks and reservations, but moves no due
time (O-8), so without that rule a failed manual retry would leave a blocked
season with neither a due time nor a hold. A failed or uncertain reservation or outcome commit is reported as
a run failure at stage `intent` or `outcome`, with what was published. It is
never a clean success.

**Restart and lost answers.** Every run starts by resolving a `publishing`
slot against the authority it has just reconciled:

- **No reservation.** The guarded publisher was never reached. The
  publication is due now.
- **A reservation.** The reserved ordering input was written into the
  candidate's immutable `__publication_metadata` sidecar before `finalize`.
  The authoritative release is this run's exactly when its sidecar carries
  that value. Then the release is recorded as published with the reserved
  digest, and nothing is published again. Otherwise the publication is due
  now, and the next publication run builds a fresh candidate through every
  guard.

A sidecar that cannot be read fails the run at stage `recovery` before any
provider request. Nothing is replayed, rebuilt or cleaned up.

**Ledger schema v1**, refined in place a second time, because no instance has
ever been bound. `SeasonRecord` gains `lastOrderingInput`, `lastPublication`
(`digest`, `activeVersion`, `publishedAt`, `confirmedAt`) and a bounded
`publicationDisposition` (`publishing` or `blocked` with a closed reason).
`publishedRevision` is still written only by reconciliation from the
authority. An applied release reaches it at the next run. No migration exists
or is needed.

**Choices made in implementation, not owner decisions:**

1. The observation commit of a publication run marks the season `publishing`.
2. An unfinished publication is recognized by its sidecar ordering input.
3. Drift makes a publication due, except while the season is `blocked`. An
   operator rollback is therefore republished at the next tick. Holding a
   rollback needs the operator disposition path below.
4. Withholding that only a cadence check can resolve waits for that check. An
   hourly retry would repeat six or more requests for nothing.
5. Every `sequencer-authority-unavailable` answer is treated as an unknown
   commit, including one raised before `prepare`. Recovery then finds it not
   published, which is conservative.
6. `older-source-updated-at` is retried, not blocked.
7. A crashed manual run's recovery makes a publication due, even though a
   manual run otherwise moves no due time.

**G5 and G9 now.** Implemented but **dormant** (injected tests only):

- the §6.6 run end to end, from lease to outcome commit;
- the publishability decision acting on the candidate;
- O-12, O-13 and O-14;
- durable next-due decisions on every path;
- restart recovery;
- the `blocked` disposition for staged corrections and D14/D15 refusals.

Obligations 3 and 4 run inside that orchestration, and are in force nowhere.

**Still open:**

- the **operator disposition path**: clearing a `blocked` season, disposing
  of a staged correction and the T12 verification (obligation 2);
- the **capacity and blocked-season alerts**;
- the read-only **A3.5 staging predecessor gate**;
- **O-9**, O-15 and O-16;
- publication of `sourceObservedAt` as obligation 1 frames it, including its
  clamp event. The O-13 clamp raises no dedicated event either;
- **runtime activation**: connecting `runCoordinatedSync`, the ledger
  `[exports]` entry, binding and resolver, `PROVIDER_MODE = "coordinated"` and
  the hourly cron;
- every provisioning and deployment step.

*(Superseded in part on 2026-09-30 by E1 below: the operator hold, the
durable blocks that end the hourly loops, the T12 storage transition and the
hold-gated rollback prerequisite now exist, dormant, and O-15 and O-16 are
answered. The operator routes, the alerts and every other item stay open.)*

The decision above is unchanged.

### E1: operator holds, durable blocks and the T12 storage transition (2026-09-30)

PR-E1 of the operator disposition decision pack (2026-09-29, private,
read-only). It is **dormant**: the resolver still answers `null`, no route
reaches any of it, and every coordinated run still stops at `ledger-unbound`.

**Owner decisions (curator, 2026-09-30).**

| # | Decision |
|---|---|
| OD-1 | Daily operator review is sufficient for staging. Production requires **verified** alert delivery. Nothing in E1 emits or delivers an alert. |
| OD-2 | An operator action records the **authentication method** and a **unique operation ID**, never the admin token. The record does not claim to identify an individual. |
| OD-3 | A coordinated rollback requires an explicit **hold** first. D14/D15 are still enforced on it. |
| OD-4 | "Keep published" permanently rejects the **exact staged revision**. A different later revision follows the normal review rules. |
| OD-5 | The unbounded hourly retries stop: the affected seasons are **durably blocked** until an explicit operator action. |
| OD-6 | D2.2 stays **absolute** for now. |
| OD-7 | Later operator verification (PR-E3) may show counts, canonical driver IDs and changed field **names**, but no values. |
| OD-8 | Warn at **48 of the 60** backlog slots, and at capacity. |

**O-15 and O-16, defined.** The repository named both without defining them.
Their only definitions are in §14 of the private runtime activation decision
pack of 2026-09-27 (SHA-256 `cef20b48…7925`, re-verified 2026-09-30). They
are copied here verbatim:

- **O-15**, "Step-4 irreversibility": *acknowledge that D14/C1 refuse
  rollback to the mock baseline after the first real publication.*
  **Answer (2026-09-30):** acknowledged. The first real staging publication is
  data-level forward-only. The acknowledgement **does not authorize** that
  publication: activation step 4 still needs its own authorization.
- **O-16**, "Production genesis (C3)": *ADR 0025 sequencer-genesis amendment;
  seeding from a legacy release is impossible in production.*
  **Answer (2026-09-30):** a **separate production genesis design** is
  approved, only for a season with **no earlier release**. It is not designed
  or implemented here. E1 contains no genesis code (ADR 0025 status note of
  the same date).

No activation step is complete, or authorized, by either answer.

**Baseline re-verified at `383d8aa` (2026-09-30).** The ledger has never been
bound or used in any environment:

- no revision of `wrangler.toml` ever named `ReconciliationLedger` in an
  `[exports]` entry, a migration or a binding (`git log -S` finds none);
- `resolveReconciliationLedger()` has always answered `null`, and `Env` has no
  ledger field (true when written; since 2026-10-06 the resolver reads an
  optional `RECONCILIATION_LEDGER` field that no environment binds, "Ledger
  resolver" below);
- staging's only deployed version, `c297d260-…`, was built from `36b0fd2`,
  which predates the ledger class (`a67278f`). Production runs provider mode
  `none`.

Schema v1 was therefore refined in place a third time. This justification ends
at activation step 3, the first deploy that resolves a ledger. After that, a
record change needs a versioned decoder and a migration decision.

**What E1 implements.**

| Area | Implementation |
|---|---|
| Record model | `SeasonRecord.operatorHold` (`since`, `operationId`), `durableBlock` (`since`, `reason`: `classification-superseded` or `backlog-capacity-exceeded`) and `lastOperatorAction` (`operationId`, `action`, `at`, `authMethod`). `ClassificationRecord.lastDisposition` (`operationId`, `action`, `at`, `authMethod`, `stagedRevision`). An operation ID is a lowercase UUID v4. `authMethod` is the closed value `shared-admin-token`, which names a method, not a person. |
| Independent stops | The hold and the durable block are separate from the transient `publicationDisposition`. Marking a run `publishing`, crashing, recovering and completing all leave them exactly as they were. |
| Operator transitions | Two new store operations, each one fenced, version-checked and idempotent transaction. **`operate`**: `hold`, `release-hold` or `clear-block`, conditional on the inspected season-record version (0 creates the record, so a season can be held before its first run). **`dispose`** is T12: `accept-staged`, `accept-competing` or `retain-published`. It is conditional on the record version and on the exact accepted, staged and competing revisions the operator inspected, and it releases the backlog entry in the same transaction. A resent operation ID answers `already-applied` and writes nothing. The same ID for another action is refused as `operation-id-reused`. The pure transitions are in `ledger/operator.ts`, and the decoders for the new requests are in `ledger/requests.ts`. |
| T12 semantics | Every disposition clears the staged, competing and pending slots and appends exactly one revision to the history. `accept-*` appends the displaced accepted revision. `retain-published` appends the staged revision, so it is rejected permanently (OD-4). A competing revision is cleared, not superseded. The history bound refuses a disposition and never evicts. A transient `classification-staged` or `classification-review-locked` block lifts, with publication due now, only when no other round of the season still waits for review. A hold, a durable block, other block reasons and a `publishing` slot are untouched. Nothing is published: the next run publishes through every guard, and only if upstream then serves the accepted revision. |
| Storage invariants (`commit`) | `staged-correction-immutable`: a commit that clears or changes a stored staged or competing correction, writes `lastDisposition`, or carries any backlog removal. A competing slot may still be filled (T11b). *(Superseded on 2026-10-05 by E3: only the `verify` operation fills it, and `commit` refuses any change to it.)* `backlog-staged-mismatch`: a backlog entry is inserted only together with the newly staged slot of the same revision, and the reverse. `operator-state-immutable`: a commit that sets, changes or clears a hold or `lastOperatorAction`, or changes or clears a durable block. A run may set a durable block. `publication-stopped`: a publication **reservation** while a hold or durable block is set. |
| Every publishing path refuses | The **planner** plans no publication for a due publication alone, or for drift, while a stop is in force. A **manual** run answers `nothing-due` / `publication-stopped` with zero provider requests, even for a season held before its first calendar was observed. A **scheduled** calendar bootstrap still observes. **Cadence** checks and the weekly **refreshes** still observe, so the ledger keeps following upstream. The **publication half** checks the stop first, on the committed record, before anything is prepared, reserved or sent. It ends as `withheld` (`operator-hold` or `durable-block`), next-due `stopped`: an earlier block is kept, and a scheduled run clears its due time. The observation commit of a stopped season writes no `publishing` mark. **Recovery** resolves an unfinished publication as before and keeps both stops. The store's `publication-stopped` check backs all of these. |
| OD-5 | A **settled** round whose reread returns a superseded revision, and a correction the full backlog could not stage (this run's `classification.backlog-capacity-exceeded`), now end `durably-blocked` instead of `cadence`. The run records `durableBlock` and clears its due time. It takes precedence over every other withholding decision in that run. An unsettled round serving a superseded revision keeps its own bounded cadence. |
| OD-3 | `operator/rollback.ts`, `rollbackUnderHold`, dormant. It takes the season lease and refuses `not-held` before the rollback is reached. It refuses `run-in-progress`, `ledger-unavailable` and `lease-expired`. Otherwise it calls the existing rollback once, under the lease, and releases the lease on every path. The rollback is unchanged: the sequencer path runs the D8 republication through the D14/D15 guard. The hold is kept whatever the result. |
| OD-8 | `BACKLOG_WARNING_THRESHOLD = 48`, and a pure `backlogAttention(count)`: `normal`, `warning` from 48, `full` at 60. Nothing emits it yet. |

**Choices made in implementation, not owner decisions:**

1. "Hold or block" means the operator hold and the durable block. The
   transient `blocked` disposition is unchanged. It is re-derived by each run
   from the same records and the same guard that caused it, and a completing
   run still clears it. A staged or locked round still withholds through
   publishability, and a D14/D15 refusal is still decided by the guard.
2. A durable block is cleared only by `clear-block`. A disposition that frees
   backlog capacity does not clear a `backlog-capacity-exceeded` block, even
   in the same season.
3. A hold does not move `publicationDueAt`. While a stop is in force, the
   planner ignores it. `release-hold` and `clear-block` make publication due
   now.
4. A hold may be placed whatever the transient disposition, including an
   unresolved `publishing` slot. Because it is independent, it cannot
   overwrite a reservation. Recovery still records a release the crashed run
   committed, and nothing is published again.
5. Replay detection keeps only the last action of each record. An old ID
   resent after a later action fails its version check, so it never applies
   twice.
6. The rollback prerequisite is a function, not a route change.
   `POST /internal/admin/rollback` is unchanged.

**Tests.** 112 new tests; the suite is now 4,576 in 200 files.

- Store (49): schema, `operate`, replay, fencing, restart, the commit
  invariants and T12.
- Durable Object client (3): a lost answer is `uncertain`, and resending it
  answers `already-applied`.
- Planner (14).
- Outcome rules (9).
- Operator package (4): dormancy and OD-8.
- The pairing invariant (1).
- End to end, over both transports (32). These cover: a held cadence check
  and weekly refresh; a refused manual run; release; a crash and restart
  under a hold; recovery of a crash-committed release under a hold; an
  operator kept out by a run's lease; the hold-gated rollback, including a
  D14 refusal, a run in progress, an expired lease and a throwing rollback;
  the superseded and capacity durable blocks stopping the hourly loop; and a
  failed outcome commit that is re-derived and recorded by the next run.

**Negative controls.** Each is a mutation of the committed code (`f8f6ede`),
restored from a hash-verified backup:

| Mutation | Tests failed |
|---|---|
| Publication-half stop check removed | 6 |
| Store `publication-stopped` removed | 2 |
| All three stop layers removed | 21 |
| Staged immutability removed from `commit` | 5 |
| `commit` may remove a backlog entry | 3 |
| OD-5 durable block never raised | 8 |

**Review correction.** Codex raised one P2 on PR #59, and it was valid. A
manual run on a season held before its first observation still made the
calendar bootstrap request, because the planner reached the missing-calendar
branch before the stop check. That contradicted the zero-request rule above.
The manual stop check now comes first. Four new tests fail with the old order:
a planner case for each stop kind, and an end-to-end case for each transport.
The end-to-end case holds a season with no record, sees a manual run send
nothing and a scheduled bootstrap send only the calendar request, then sees
the first publication run withheld. The suite is now 4,578 tests. The bundle
is unchanged, because the planner is not bundled.

**Bundle.** The Wrangler dry-run `index.js` goes from `a473a777…725b`
(649,568 B) to `e5b6a16f…cbcf` (664,968 B), identical in all three
environments, and the binding reports are unchanged. The +15,400 B are the
ledger package only (`store`, `records`/`requests`, `operator`, `model`,
`durable-object`), because the Durable Object class is exported. Policy,
observation, outcome and operator code stay out of the bundle.

**Still open, for PR-E2 and later:**

- **PR-E2 (operator surface):**
  - the inspect, hold, release, clear-block and dispose routes;
  - wiring `rollbackUnderHold` into `POST /internal/admin/rollback` for
    coordinated mode;
  - the level-triggered attention line (A7) using the OD-8 levels;
  - the daily-review procedure that OD-1 accepts for staging;
  - the runbook sections and the Backend Operations route table.
- **PR-E3:** operator verification (T11-T11d) with the OD-7 content.
  *(Implemented, dormant, on 2026-10-05: see E3.)*
- **PR-G:** the production genesis design O-16 approves.
- Before production: verified alert delivery (OD-1).
- **O-9**, and running the A3.5 staging predecessor gate.
- Every activation step. E1 must merge before step 3.

**Residual risks.**

- An upstream revert to a superseded revision freezes the season. It is now
  a visible durable block, not a loop, but D2.2 stays absolute (OD-6).
- Releasing a hold after a rollback republishes the rolled-back content
  unless upstream changed. Release is consent.
- A full revision history (16) is a dead end for T12 as well as T3.
- Audit identity rests on the operator keeping private evidence against the
  operation ID.
- A durably blocked or held season is visible today only by reading the
  ledger or the run's `warn` line. No attention line exists yet (PR-E2).
  *(Since E2: the attention line exists in the injected orchestration; see
  below.)*

The decision above is unchanged.

### E2: the operator routes and the attention line (2026-10-05)

PR-E2 of the operator disposition decision pack, under the same OD-1 to OD-8
answers. **Nothing is bound, deployed or activated.**
`resolveReconciliationLedger()` still answers `null`, so every route below
answers `503` `reconciliation-unavailable` with `ledger-unbound` in every
environment, having read nothing.

**Routes.** All five are under `/internal/admin/`, behind `ADMIN_TOKEN`,
`Cache-Control: no-store` and outside the public OpenAPI:

| Route | Ledger operation |
|---|---|
| `GET /internal/admin/reconciliation?season=YYYY` | `readSeason` only: no lease, no write |
| `POST /internal/admin/reconciliation/hold` | `operate` `hold` |
| `POST /internal/admin/reconciliation/release-hold` | `operate` `release-hold` |
| `POST /internal/admin/reconciliation/clear-block` | `operate` `clear-block` |
| `POST /internal/admin/reconciliation/disposition` | `dispose` (T12) |

Each request is checked in a fixed order, and nothing after a refusal is
reached: authentication (the router), the method, the complete request
(closed keys, a season, a lowercase UUID v4 operation ID, version counters,
`sha256:` revisions, a round 1-100, a body of at most 2,048 characters), then
`PROVIDER_MODE = coordinated` and a resolved ledger, and only then the ledger.
A mutation takes the season lease, makes exactly one `operate` or `dispose`
call, and releases the lease on every path. Every precondition is the
store's own (E1): the lease fence, the inspected versions and revisions, the
operation-ID replay and the state the action requires. The answer carries a
closed `status`: `applied` or `already-applied` (`200`), `run-in-progress` or
`refused` with the ledger's closed reason (`409`), `ledger-unavailable` or
`outcome-unknown` (`503`, settled by resending the same operation ID). The
response carries only what the ledger holds. The audit line is one `warn`
`reconciliation.operator-action` with the season, round, closed action and
outcome, the operation ID and `operatorAuthMethod: shared-admin-token`
(OD-2), never the token and no revision. A mutation refused before the
ledger, as `reconciliation-unavailable`, still carries its operation ID and
authentication method. The Provider Evaluation's
`reconciled.review_disposed` event is this line with a disposition action.

**Coordinated rollback (OD-3).** In `coordinated` mode only,
`POST /internal/admin/rollback` runs `rollbackUnderHold`: the existing
rollback, once, under the season lease, only while `operatorHold` is set,
with the D14/D15 guard unchanged. Without a hold it answers `409`
`publication-not-held` and the publisher is never reached. `mock` and `none`
keep the existing path exactly.

**Attention line (OD-1, OD-8).** After every **scheduled** run of
`observeCoordinatedSeason`, whatever its outcome, the season is read once more
(after the lease is released), including after a refused composition while a
ledger is bound, and, while it is held, durably blocked, or the
global backlog holds 48 or 60 of its 60 slots, one
`reconciliation.attention` line is written: `warn`, or `error` at a full
backlog. It carries the season, the closed conditions, the durable block
reason and the backlog count, and nothing else. A manual run writes none.

**Departures from the decision pack, and why.**

- The release and clear actions keep E1's names (`release-hold`,
  `clear-block`) as their paths, and a hold and a durable block are released
  independently, because E1 stores them independently.
- Inspection reads only the ledger. It does not read the authority, so it
  reports no `servingVersion` or `drifted`: the cutover `status` route already
  reports the authority, and a ledger-only read cannot fail on the sequencer.
- A coordinated rollback **with no ledger** is refused as `ledger-unbound`
  instead of running unchanged (pack A4). The requirement is that a
  coordinated rollback needs an active hold, and without a ledger the hold
  cannot be verified. Switching `PROVIDER_MODE` back to `mock` removes only
  the hold gate. It publishes nothing and restores no earlier release, and
  D14/D15 still apply to any rollback then asked for. After the first real
  staging publication, D14/C1 refuse a rollback to the mock baseline (O-15),
  so that publication stays data-level forward-only in every mode.
- The attention conditions are exactly the hold, the durable block and the
  two backlog levels. A transient `blocked` disposition and a pending review
  are not conditions of their own: their backlog entries count toward the
  backlog levels, and inspection shows them.
- The line is written by the injected orchestration only. The Worker's
  scheduled handler still calls `runCoordinatedSync`, which stops at
  composition, so **no deployed Worker can write it**. Connecting the
  orchestration is an activation step.
  *(Superseded in part on 2026-10-06 by "Entry points" below: the scheduled
  handler now reaches the orchestration through `runCoordinatedSync`, behind
  a gate that needs a bound ledger. No ledger is bound, so no deployed Worker
  can write the line yet.)*

**Tests.** 133 new tests (4,711 in 204 files). Through the Worker entry point,
with the resolver's answer injected by `vi.mock` (no environment field or
test hook supplies a ledger) and the ledger reached in process and through
the Durable Object client: authentication, methods, malformed input, the
mode gate, read-only inspection with a recursive key allow-list, replay,
stale versions, reused operation IDs, a held lease, an expired lease, a lost
answer, independent hold and block, every T12 action, and the coordinated
rollback over the real sequencer (not held, held then drift-free ticks then
release, a D14 refusal, a held lease). With the real resolver, every route
and the coordinated rollback answer `ledger-unbound` with zero reservations,
transport calls, sequencer commands, storage writes and purges. The
attention line is tested over both transports at 47, 48, 59 and 60 slots,
for a hold and a durable block on every tick, during a run in progress, and
with an unreadable ledger. Existing E1 and C4 tests that pin a scheduled
run's ledger calls now end with the attention read.

**Negative controls.** Each is a one-line mutation, restored from a
hash-verified backup:

| Mutation | Failed tests |
|---|---|
| Operator routes dispatched before authentication | 2 |
| Coordinated rollback bypassing the hold gate in the router | 5 |
| `rollbackUnderHold` without its hold check | 2 |
| Inspection takes and releases the lease | 4 |
| Attention only after a run that observed | 14 |
| Backlog warning above 48 instead of at 48 | 4 |
| Season-action body keys not closed | 2 |
| Provider-mode gate ignored | 8 |
| Both review corrections reverted to `6942091` | 3 (1 route, 2 attention) |

**Bundle.** `e5b6a16f…cbcf` (664,968 B) → `79575c4d…452a` (685,799 B),
identical in all three environments, binding reports unchanged (staging
`mock`, production `none`, no ledger binding). The +20,831 B are the admin
reconciliation routes and the operator package. Policy, observation and
outcome code stay out of the bundle.

**Still open:** connecting the orchestration to the scheduled handler, the
ledger binding and resolver, and every other activation step; verified
production alert delivery (OD-1); PR-E3 (OD-7); PR-G (O-16); O-9; running the
A3.5 gate. *(PR-E3 is implemented, dormant, since 2026-10-05: see E3.)*

### E3: operator verification of a staged correction (2026-10-05)

PR-E3 of the operator disposition decision pack: T11-T11c and the OD-7
content. **Nothing is bound, deployed, activated or run.** The resolver still
answers `null`, so the route below answers `503`
`reconciliation-unavailable` with `ledger-unbound` in every environment,
having read nothing. **No verification has ever been sent to Jolpica.**
Running one is provider contact, and each run needs its own authorization.

**Owner decisions (2026-10-05).** The private E3 decision request (V-1 to
V-5) was answered as follows:

| # | Decision |
|---|---|
| V-1 | The accepted T11-T11c tracking is implemented. A verification may write only the observation and review fields those transitions need. It never disposes of a correction, changes accepted or published content, clears a hold or block, or publishes. Only an explicit operator verification may create a competing correction and the review lock. |
| V-2 | The season's fenced lease and the record-version checks guard the write. An operation ID makes a repeated request safe. A stale target is refused without modifying the review fields. |
| V-3 | The OD-7 display compares a fresh valid result with the active release's published race-results document. The base is labelled **`published`**, never `accepted`. Only counts, sorted canonical driver IDs and changed `RaceResult` field names are shown. When the authority or the document cannot support a coherent comparison, a closed `unavailable` reason is returned. |
| V-4 | One provider request per verification, no retry. A failed response keeps T11's attempt accounting and changes no candidate or competing slot. A limiter deferral follows the existing deferral rule and is not a completed check. |
| V-5 | A strict request: `season`, `round`, a UUID v4 `operationId` and `expectedStagedRevision`. Authentication comes before the ledger and the provider. The staged target, the review lock and the earliest verification time are checked before capacity is reserved. A record already locked for review is refused. |

*Amended 2026-10-06 by E4 (below): the V-5 body also requires
`expectedVerificationGeneration`, checked before anything else.*

**Route.** `POST /internal/admin/reconciliation/verification`, behind
`ADMIN_TOKEN`, with `Cache-Control: no-store`, and not in the public
OpenAPI. Checks run in this fixed order, and nothing after a refusal is
reached:

1. authentication (the router);
2. the method;
3. the strict body `{season, round, operationId, expectedStagedRevision}`:
   closed keys, a round from 1 to 100, a lowercase UUID v4 and a `sha256:`
   revision;
4. `coordinated` mode and a resolved ledger;
5. the coordinated runtime's own composition gate, the same one a run passes:
   limiter, sequencer authority and purge origin. A refused composition
   builds nothing.

Then, under the season's fenced lease, which is released on every path:

1. a resent operation ID is answered from the ledger;
2. the record must hold exactly `expectedStagedRevision` as its staged
   revision, with its backlog entry;
3. the record must not be locked for review (T11d);
4. the round must have reached the planner's own earliest time, `anchor + 5h`;
5. the lease must not have expired.

Only then does it make **one** classification request through the composed
runtime's coordinator, routing port, hardened client, pacer and global
limiter (`requestClassification` in `composition.ts`, still the only module
that imports a provider package). The results port sends one `GET`, with one
attempt, no retry and no second page. The answer is recorded through a new
store operation, `verify`. In one transaction, `verify` re-checks the lease,
the record version, the staged target, the review lock, the backlog entry and
the replay, and makes its one write.

**Transitions** (`ledger/verification.ts`, in §10.4.1 evaluation order):

| Observed | Transition | Written besides the attempt and the `verifications` entry |
|---|---|---|
| A superseded revision | `superseded-rejected` (T5) | The candidate is cleared, and `consecutiveConfirmations` becomes 0. |
| The accepted revision | `accepted-seen` (T11), or `candidate-discarded` (T11c) with a candidate pending | nothing, or the candidate is cleared |
| The staged revision | `staged-seen` (T11), or `candidate-discarded` (T11c) | nothing, or the candidate is cleared |
| The pending candidate | `candidate-corroborated` (T11b) | `competingCorrection` := the candidate, `firstSeenAt` from its first sighting, corroborated. The candidate is cleared, and the marker becomes `review_locked`. |
| Any other revision | `candidate-observed` (T11), or `candidate-replaced` (T11c) | The candidate becomes that revision, first seen now. |
| A failed request (any attempted failure: `5xx`, `429`, network, invalid payload, unresolved identity) | `check-failed` (T6) | nothing |

Every attempted verification records `lastAttemptedAt` and clears
`limiterDeferralUntil`. A successful one also records
`lastSuccessfulObservationAt`. Each completed verification appends one
entry to `ClassificationRecord.verifications`: the operation ID, instant,
`shared-admin-token`, the staged revision asked about and the transition.
An entry never holds a payload or a diff. The history holds at most 32
entries (`MAXIMUM_VERIFICATIONS`), is never evicted, and names each
operation ID once. A full history refuses further verification of the round
as `verification-history-full`, before any request. That also bounds the
requests verification can make for one round.

A limiter **deferral** writes only `limiterDeferralUntil` (the existing
rule), records no verification, and answers `429` `deferred`. A request that
never left GridView (`not-attempted`) and a coordinator defect or malformed
selection (`observation-refused`) record nothing.

`verify` never writes:

- the staged slot;
- `contentRevision`, `publishedRevision` or the superseded history;
- `reviewState` or `sourceObservedAt`;
- the season record, so no hold, durable block, disposition or due time;
- the backlog;
- Workers KV, the sequencer or a cache.

**Storage invariants tightened.** E1 let `commit` fill an empty competing
slot, for T11b's sake. T11b is now `verify`, so `commit` refuses
(`staged-correction-immutable`) any change to `competingCorrection`,
including creating one. It also refuses any change to a staged record's
candidate slot, and any write of `verifications`. Only an explicit
operator verification can lock a record for review. Tests that need a
competing slot for a disposition or an inspection plant it directly in
storage.

**OD-7 comparison** (`operator/comparison.ts`). It is made only for a fresh,
valid observation, and only after the lease is released. It reads the
season's authority from the sequencer and, when the season is `active` and
authoritative, the active release's `grand-prix:{round}:results` document.
The answer has these fields:

- `base: "published"`;
- `publishedIsAccepted`: whether that document's revision is the ledger's
  `contentRevision`;
- `counts`: observed entries, published entries, and how many drivers were
  added, removed or changed;
- `drivers`: sorted canonical driver IDs, added, removed and changed;
- `resultFields`: the `RaceResult` field names that differ. `entries` is
  named when membership, order or any entry differs;
- `entryFields`: the `RaceResultEntry` field names that differ in a kept
  entry.

No value is ever shown: no position, points, time, status, name, revision
or provider string.

It is otherwise `unavailable` with one of these reasons:

- `authority-unavailable`;
- `authority-not-authoritative`;
- `published-document-unavailable`: absent or unreadable, never treated as
  empty;
- `published-document-invalid`: another round, a malformed or repeated
  driver ID, or a wrong envelope;
- `observed-result-invalid`;
- `no-observation`, for T6;
- `not-repeated`, for a resent operation ID.

The comparison is never logged, stored or cached.

**Answers.**

| Status | `data.status` |
|---|---|
| `200` | `verified`, or `already-applied` (a resent ID: no request, no write, `comparison.reason` `not-repeated`) |
| `502` | `provider-failed` (T6, recorded), or `observation-refused` (nothing recorded) |
| `429` | `deferred`, with `retryAt` |
| `409` | `precondition-failed`: `operation-id-reused`, `not-staged`, `staged-revision-mismatch`, `backlog-entry-missing`, `review-locked`, `verification-history-full`, `not-eligible`, `lease-expired`. Also `run-in-progress`, and `refused` with the ledger's closed reason. |
| `503` | `reconciliation-unavailable`, `coordinated-runtime-unavailable`, `not-attempted`, `ledger-unavailable`, `outcome-unknown` (resend the same operation ID) |

A verified answer carries the transition, the match (`superseded`,
`accepted`, `staged`, `candidate`, `other`), the record's version, review
state and markers, and the comparison. It carries no revision.

The audit trail is one `warn` `reconciliation.verification` line per
verification. It carries these closed values only:

- the season, round, operation ID and `shared-admin-token`;
- the outcome and the provider request count;
- the transition and the match;
- `compared`, or the comparison's closed reason;
- any refusal reason or limiter retry instant.

It never carries a revision, a driver ID, a field name or a count from the
comparison. The read-only inspection now shows each round's
`verificationCount` and its latest verification as `lastVerification`.

**Choices made in implementation, not owner decisions:**

1. **T11's "last-seen counter" does not exist.** The ledger has no such field,
   so the staged revision seen again refreshes nothing durable, as pack A6
   says.
2. **The staged revision seen while a candidate is pending discards the
   candidate**, as the accepted revision does. The candidate failed to
   reappear (T11c), and the staged revision is never a candidate.
3. **T5 precedes the T11 family**, as everywhere else in §10.4.1. A
   superseded revision is never tracked, and it resets the confirmation
   count.
4. **The accepted revision seen again counts no confirmation.** T11 says it
   "changes nothing".
5. **A verification is not the sweep.** It advances neither `lastSweptAt`
   nor `lastPriorityAttemptAt`.
6. **Replay memory is the season's whole verification history.** Unlike E1's
   one-slot memory, it does not rely on a version check, because V-5 gives
   the route no record version to check. The route and the store both
   search every round's history:
   - any ID already recorded on this round for this staged revision is
     answered `already-applied`, with no request, however many verifications
     came after it;
   - the same ID on another round or staged revision is
     `operation-id-reused`.

   A resend is therefore never a second sighting. A deferral is not
   recorded, so its ID stays usable. *(This replaces the one-slot design
   PR #61 first opened with; see "Review correction" below.)* *(Narrowed
   2026-10-06 by E4: this holds within the ID's verification generation. A
   request from an earlier generation is refused
   `verification-generation-mismatch`, sends nothing and writes nothing.)*
7. **The deferral rule is the existing one, with its existing effect.** The
   planner defers the season's scheduled runs until the latest
   `limiterDeferralUntil` of any record. A deferred verification therefore
   defers them too, until the limiter's `retryAt`.
8. **The verification holds the season lease** across its one request. A
   scheduled tick in that window answers `run-in-progress` and sends nothing.
9. **Eligibility is the planner's own `isEligible`** (`policy/cadence.ts`). A
   staged record is always past it in practice, since staging needs
   settlement. The check is real, and a planted future anchor proves it.
10. **Bundle placement.** The one request lives in `composition.ts`, which
    is still the only importer of either provider package. The
    contribution-to-outcome mapping moved there from `observation/outcomes.ts`
    and is shared. `classificationRevision` moved to
    `classification-revision.ts`, re-exported by `observation/revisions.ts`,
    so a verification's sighting and a run's hash the same way.
    `policy/cadence.ts` is the one policy module now in the Worker bundle.
    The store's reads moved to `ledger/reads.ts` to keep `store.ts` under 800
    lines.

**Tests.** 104 new tests; the suite is now 4,815 in 207 files.

- Store `verify` (49): T11, T11b, T11c, T5, T6, deferral, replay (including
  an older ID after a later verification, and another round), the full
  history, every refusal and invalid requests, over the in-process and
  Durable Object transports.
- Comparison (14): the diff, the value boundary with marker values, an
  order-only change, and every `unavailable` reason.
- Worker route (38): over both ledger and sequencer transports, on a staged
  correction reached through the real state machine (round 1 published as
  A, settled, then C staged by two publication runs):
  - first sighting, corroboration and the review lock;
  - the OD-7 output, with recursive key allow-lists on answers and log lines
    and a value-leak check against the published document;
  - replay, an older ID resent after a later verification, and a reused ID;
  - a full verification history;
  - a stale, unstaged or unrecorded target;
  - not eligible;
  - four provider failures;
  - deferral and its retry;
  - an unavailable limiter;
  - a held lease, a lost write answer, and an unreachable ledger;
  - authentication, method and body refusals, a non-coordinated mode, and a
    runtime that cannot compose.

  Each test also checks that nothing else changed: the season record,
  backlog, other rounds, staged slot, accepted and published revisions,
  history, authority, active version, releases, guarded publications,
  Workers KV writes and purges are unchanged.
- Commit invariants (3), and the real-resolver `ledger-unbound` proof, which
  now includes this route.

Existing tests changed in these ways only:

- fixtures gained `verifications: []`;
- competing slots are planted rather than committed;
- the D2.2 history loop no longer commits a competing slot;
- the dormancy, bundle-graph and Durable Object command pins name the new
  modules and edges.

**Negative controls.** Each is a mutation of the final code, restored from a
backup:

| Mutation | Failed tests |
|---|---|
| The comparison exposes a points value with a changed driver | 4 |
| The audit line carries the comparison | 2 |
| Corroboration also changes the accepted revision | 4 |
| Corroboration also clears the staged slot | 4 |
| A failed request discards the candidate | 10 |
| The store's replay check removed | 2 |
| The route's replay check removed | 4 |
| `commit` may create a competing slot again | 1 |
| The eligibility check disabled | 2 |
| A stale staged target checked only by the store, after the request | 2 |
| Only the latest verification ID recognized (the first design) | 6 |
| Replay searched on one round only | 6 |

**Bundle.** `79575c4d…452a` (685,799 B) → `7a1a992d…e061a` (718,392 B),
identical in all three environments. The binding reports are unchanged:
staging `mock`, production `none`, and no ledger binding. The +32,593 B are:

- the verification and comparison modules;
- the ledger `verify` operation;
- the request helper in `composition.ts`;
- `classification-revision.ts`;
- `policy/cadence.ts`;
- the route.

Observation and outcome code stay out of the bundle.

**Still open:**

- running any verification (provider contact, authorized each time);
- connecting the orchestration to the scheduled handler, the ledger binding
  and resolver, and every other activation step;
- verified production alert delivery (OD-1);
- PR-G (O-16);
- O-9;
- running the A3.5 gate.

**Residual risks.**

- Verification spends the shared limiter's capacity, because no separate
  manual-recovery reserve exists (pack F9).
- The comparison can only show what the active release serves. After a
  rollback, that is not the accepted revision, which `publishedIsAccepted`
  reports.
- A round that reaches 32 verifications can never be verified again. The
  history is never evicted, so freeing it needs an owner decision. Like a
  full revision history, it is a dead end. *(2026-10-06: E4 adds the explicit
  recovery, an operator rotation into the next verification generation.)*

**Review correction.** Codex raised one P1 on PR #61 at `9f906d9`, and it was
valid. The first design remembered only each record's latest verification.
An older operation ID resent after a later verification, for example after
a recorded failure, therefore sent a new request. If upstream still served
the candidate, it was counted as the second sighting and created a competing
correction and the review lock. The same ID was also accepted on another
round. The single slot became the bounded, never-evicted history above,
searched across the season by both the route and the store. Ten new tests
cover it. With the old search, the older-ID tests fail (6), and with a
one-round search the cross-round tests fail (6).

The decision above is unchanged.

### E4: verification generation rotation (2026-10-06)

PR-E4 gives E3's full verification history an explicit recovery path.
**Nothing is bound, deployed, activated or run.** The resolver still answers
`null`, so both new routes answer `503` `reconciliation-unavailable` with
`ledger-unbound` in every environment, having read nothing. No rotation and
no verification has ever run, and Jolpica was not contacted.

**Why it was needed.** A read-only probe at `81e91d2` showed that nothing
frees a full 32-entry history:

- T12 keeps it;
- `commit` refuses to change it;
- re-staging the round does not help;
- a Durable Object restart changes nothing.

A round that reached 32 verifications could never be verified again (the E3
residual risk).

**Owner decisions (2026-10-06).** R-1 to R-7 of the private
verification-history recovery decision pack were answered as follows:

| # | Decision |
|---|---|
| R-1 | A persisted per-round verification generation. Every verification request names `expectedVerificationGeneration`. It is checked before transport or limiter use, and again inside the ledger transaction. A replay from an earlier generation returns `verification-generation-mismatch` with no provider request and no write. Within the current generation, a repeated operation returns `already-applied`. |
| R-2 | ADR 0020 is amended with this narrower replay contract (below). Operation identity is defined within a generation. Bounded storage does not detect reuse of a UUID across every historical generation, and this ADR does not claim it does. The current-generation checks across rounds and action types are kept. |
| R-3 | An authenticated rotation action. It requires an active operator hold, a full 32-entry history, a fenced season lease, and a matching record version, generation and history digest. It is refused while a competing correction has locked the record for review; T12 must resolve that first. |
| R-4 | Rotation is one transaction. It clears only the verification history, increments the safe-integer generation and records a bounded reset receipt. It keeps the staged and candidate corrections, the accepted and published revisions, the superseded history, the attempt accounting, the backlog and Workers KV. It refuses safely when the generation cannot be incremented. |
| R-5 | A read-only inspection and a private archive of the bounded history come first. The rotation request names the inspected history digest and explicitly acknowledges the archive. The answer is a receipt with the old and new generations, the digest and the count. The cleared entries are never returned after the write: a lost answer would lose that evidence. |
| R-6 | A retry of the same rotation after a lost answer never rotates again. What an older rotation retry returns after a later rotation is documented (below). |
| R-7 | Logs stay bounded, with no provider payload, revision value or cleared operation ID. |

**The replay contract, amended.** This narrows E3 choice 6.

- **Operation identity is defined within one generation.** Within the
  current generation, an operation ID any verification of the season recorded
  is answered `already-applied`, with no request and no write, however many
  verifications came after it. The same ID for another round or staged
  revision is `operation-id-reused`, as E3 defined.
- **A request formed against any other generation is refused**
  `verification-generation-mismatch` before anything else is matched. That
  covers an earlier generation (a resend from before a rotation) and a
  generation that does not exist yet. The route refuses it under the lease
  before the limiter or the transport is used. The store's `verify` refuses
  it again inside its transaction.
- **G1 is unchanged: a resend is never executed again and never counted as a
  second sighting.** A prior-generation resend now gets a refusal instead of
  `already-applied`, but it still sends nothing and writes nothing.
- **Bounded storage forgets a cleared generation's IDs.** A UUID used in a
  cleared generation and sent again *naming the current generation* is a new
  verification. Every generation is an authenticated, audited operator act,
  and the runbook requires a new UUID for every verification.
- **One namespace between verification and rotation.** A verification may
  not reuse an ID a round's last rotation used. A rotation may not reuse an ID
  of the current generation's verifications on any round, or another round's
  last rotation. Hold, release, clear-block and disposition IDs keep their E1
  one-slot rules; no new cross-check against them is added.
- **E3's per-round request bound is now per generation:** at most 32 per
  generation, and each new generation needs an operator rotation. The global
  limiter applies throughout. No cap on rotations was set.

**Model** (schema version 1, refined in place a fifth time, on the same
grounds as E1 and E3: re-verified at `81e91d2`, no `wrangler.toml` has ever
declared the class, and the resolver answers `null`):

- `ClassificationRecord.verificationGeneration`: a safe integer, 0 until the
  first rotation.
- `ClassificationRecord.lastVerificationReset`: `null` exactly while the
  generation is 0. Otherwise it holds the closed receipt
  `{operationId, at, authMethod, fromGeneration, clearedCount,
  clearedDigest}`.

The decoder requires `fromGeneration + 1` to equal the generation,
`clearedCount` to be 32, and the receipt's ID not to appear in the current
history. `commit` refuses (`staged-correction-immutable`) any change to
either field, and a first write that does not start at generation 0 with no
receipt. `verify` and T12 spread the record and keep both.

**The history digest.** It is `sha256:` followed by the lowercase hex SHA-256
of the UTF-8 compact JSON of the canonical history. Each entry is
`{operationId, at, authMethod, stagedRevision, transition}`, in that key
order, oldest first. An operator recomputes it from an archived answer as
`JSON.stringify(entries)`.

**Routes** (behind `ADMIN_TOKEN`, `Cache-Control: no-store`, not in the
public OpenAPI):

- `GET /internal/admin/reconciliation/verification-history?season=YYYY&round=N`
  is read-only, with no lease. It answers `200` with
  `{status: "read", season, round, recordVersion, verificationGeneration,
  count, historyDigest, entries, lastVerificationReset}`, or `404`
  `not-recorded`. **It is the only answer that carries the digest**, so a
  rotation can name one only after this read. Its `info` line names the
  round and the outcome only.
- `POST /internal/admin/reconciliation/verification-rotation` takes
  `{season, round, operationId, expected: {recordVersion,
  verificationGeneration, historyDigest}, historyArchived}`. `historyArchived`
  must be `true`. `false` is refused `400` `history-archive-not-acknowledged`,
  and any other unknown, missing or ill-typed field is `invalid-body`. No
  runtime is composed, and no provider, limiter or sequencer can be reached.
- The verification body (V-5) gains a required
  `expectedVerificationGeneration`.
- The inspection shows each round's `verificationGeneration` and
  `lastVerificationReset`, the latter with `toGeneration`.

**Rotation check order.** The route checks run first: authentication, method,
strict body, then `coordinated` mode and a resolved ledger. Then the season
lease is taken (`run-in-progress` if it is held) and released on every path.
The store's `rotateVerifications` then checks, in its transaction:

1. the lease fence and expiry;
2. **the resend.** This round's receipt names the same operation ID:
   - with the same `fromGeneration` and digest, the answer is
     `already-applied` and nothing is written, even after the record moved on;
   - otherwise it is `operation-id-reused`;
3. the ID namespace above (`operation-id-reused`);
4. a recorded round (`operator-precondition-failed`);
5. the generation (`verification-generation-mismatch`);
6. the record version (`version-conflict`);
7. the archived digest (`verification-history-digest-mismatch`);
8. an operator hold on the season (`operator-hold-required`);
9. no competing correction (`review-locked`);
10. a full history (`verification-history-not-full`);
11. a generation below `Number.MAX_SAFE_INTEGER`
    (`verification-generation-exhausted`).

Only then does it write that one classification record:

- an empty history;
- the generation plus one;
- the receipt;
- the version plus one.

Nothing else changes: the staged, candidate and competing slots, the markers,
the attempt accounting, `limiterDeferralUntil`, the accepted, published and
superseded revisions, `lastDisposition`, the season record (and so the hold),
the backlog, Workers KV and the sequencer.

**Lost answers and retries.**

- **The same rotation, resent after `outcome-unknown`,** is `already-applied`
  if it committed. Otherwise it applies, provided the version, generation and
  digest still match. It never rotates twice.
- **An older rotation, resent after a later rotation,** is refused
  `verification-generation-mismatch` (step 5) and writes nothing. Only the
  latest receipt is remembered, so the older ID is no longer recognized as a
  resend. Its generation is behind, so it cannot apply. It answers
  `operation-id-reused` instead only if that UUID was reused in the meantime.
- **A verification left `outcome-unknown` before a rotation** gets
  `verification-generation-mismatch` when resent after it. The runbook
  therefore requires settling every such verification by resending it before
  rotating. The archived history then shows whether it committed.

**Answers.** `200` `applied` / `already-applied`, carrying the receipt
(`operationId`, `at`, `authMethod`, `fromGeneration`, `toGeneration`,
`clearedCount`, `clearedDigest`) and the season and round views, never the
cleared entries. `409` `run-in-progress`, or `refused` with the reason. `503`
`reconciliation-unavailable`, `ledger-unavailable` or `outcome-unknown`. A
verification refused for its generation is `409` `precondition-failed`,
`reason` `verification-generation-mismatch`, with `providerRequests: 0`.

**Audit.** One `warn` `reconciliation.verification-rotation` line per rotation
request carries only these:

- the season, round, operation ID and `shared-admin-token`;
- the outcome and any refusal reason;
- `verificationGenerationFrom`, `verificationGenerationTo` and
  `verificationClearedCount`;
- the lease release.

It never carries the digest, a revision, a cleared entry or a cleared
operation ID. The receipt is durable in the ledger.

**Choices made in implementation, not owner decisions:**

1. **The digest is checked by the store against a read made just before its
   transaction.** `crypto.subtle` is asynchronous and a storage transaction
   is not, and no synchronous SHA-256 exists in the runtime without
   `nodejs_compat`. The transaction re-reads the history and treats anything
   other than exactly the hashed history as a digest mismatch, so it never
   acts on a digest of another history. All checks and the one write stay in
   that one transaction.
2. **A dedicated read-only history route** is the archive source, and the
   only place the digest appears. The inspection carries no digest.
3. **The archive acknowledgement is a required boolean.** `false` has its own
   closed problem, so an operator who has not archived is told why.
4. **The check order** puts the generation before the version, so an older
   rotation retry always reads as a generation mismatch.
5. **A rotation needs no staged correction.** After T12 it prepares the round
   for the next correction's verification.
6. **`clearedCount` is always 32,** because only a full history rotates. The
   field is kept because R-5 asks for the count.
7. **The ledger's value primitives moved to `ledger/primitives.ts`**, which
   `records.ts` re-exports, to keep `records.ts` under 800 lines without an
   import cycle.

**Tests.** 49 new tests; the suite is now 4,864 in 209 files.

- Store, over both transports (31):
  - rotation writes exactly the history, the generation and the receipt,
    with every other key byte-equal, and the candidate kept;
  - an earlier, current or future generation;
  - a later corroboration of the kept candidate;
  - a lost-answer resend, including after the record moved on, and the same
    ID naming another history;
  - an older rotation after a later one;
  - a restart;
  - a stale version, generation or digest, a history that is not full, no
    hold, a review lock and generation overflow;
  - the cross-round and verify/rotation ID namespace, and the stated
    cross-generation limit;
  - an unrecorded round, invalid requests and an expired lease;
  - `commit` refusals, and strict decoding.
- Worker route, over both transports on the real state machine (18):
  - archive, rotate, and the generation-0 resend refused with no provider
    request, no limiter reservation and only the lease taken and released;
  - the rotation ID refused as a verification ID;
  - the kept candidate corroborated in generation 1;
  - key allow-lists on the audit line, and no digest, revision, cleared ID or
    token in any log line;
  - a lost answer;
  - five ledger refusals;
  - a held lease;
  - authentication, method, body, query, archive-acknowledgement and mode
    refusals, and an unrecorded round.
- The real-resolver `ledger-unbound` proof now includes both routes.

Existing tests changed in these ways only:

- fixtures and verification requests gained the generation;
- method, command and route lists name the new operation;
- the inspection key allow-list names the two new fields;
- the operator-package writer pin names `rotateVerifications`.

**Negative controls.** Each is a mutation of the final code, restored from a
backup:

| Mutation | Failed tests |
|---|---|
| Rotation clears the history without raising the generation | 18 |
| The route's generation check skipped | 2 |
| The store's generation check skipped | 4 |
| Both generation checks accept a later generation (`<` for `!==`) | 2 |
| Rotation allowed on a history that is not full | 4 |
| Rotation without an operator hold | 4 |
| Rotation under a review lock | 4 |
| Rotation ignores the archived digest | 4 |
| Rotation ignores the record version | 4 |
| Rotation also clears the candidate | 6 |
| The rotation's resend slot removed | 6 |
| The rotation's ID-namespace check removed | 2 |
| `verify` accepts a rotation ID (store and route) | 4 |
| `commit` may write the generation and its receipt | 2 |
| A generation of `Number.MAX_SAFE_INTEGER` is raised | 2 |

**Bundle.** `7a1a992d…e061a` (718,392 B) → `d8022e63…42e6` (736,707 B),
identical in all three environments. The dry-runs report staging `mock`,
production `none`, and no ledger binding. The +18,315 B are the two routes,
the rotation operation, its decoders and the digest.

**Still open:**

- running any verification or rotation, and everything E3 lists as open.

**Residual risks.**

- A UUID reused across generations is not detected. The procedure (a new
  UUID for every action) is the only guard.
- A verification answer lost before a rotation can no longer be settled by
  resending it after the rotation. Only the archived history shows whether
  it committed.
- Rotation needs an operator hold, so recovering verification capacity stops
  the season's publication until the hold is released. Release is consent to
  publish (E2).
- Only the latest rotation per round is remembered. Earlier receipts live
  only in the operator's private archive.

**Review correction.** Codex raised one P1 on PR #62 at `bb9c686`, and it was
valid. The implementation plan, the source of truth for phases, had no E4
phase. §14.0.40 now records the phase, its acceptance criteria and its
status, with a status-table row and a forward note in §14.0.39. The change is
documentation only; the code is unchanged.

### Entry points: the orchestration wired, and unbound (2026-10-06)

Implementation Plan §14.0.41 records this slice. It connects the C3/C4
orchestration to the Worker's two coordinated entry points: the scheduled
handler and `POST /internal/admin/sync/full` in `coordinated` mode. **The
orchestration is now wired, but it is not active.** No ledger is bound, no
environment selects `coordinated`, nothing is deployed, and **G5 and G9 are
not complete**.

**Three states, kept apart in every document:**

| State | Meaning | Where it holds |
|---|---|---|
| Implemented, injected | The code exists, and only tests call it. | C1 to E4, until this slice |
| **Wired, unbound** | A Worker entry point reaches the code, behind a gate that needs a reconciliation ledger. `resolveReconciliationLedger()` answers `null`, so the gate refuses every run first. *(Since 2026-10-06, "Ledger resolver" below: `resolveReconciliationLedger(env)` answers `null` without a `RECONCILIATION_LEDGER` binding, which no environment declares.)* *(On 2026-10-07 a staging declaration was committed and removed the same day before any deployment; "Staging ledger binding" below.)* | **Every environment, from this slice** |
| Active | A deployed Worker with `coordinated` selected resolves a bound ledger, and runs reach the orchestration and the provider. | Nowhere. It needs every activation step below. |

**One path.** Both entry points call `runCoordinatedSync`. It checks every
dependency first: the limiter, a reachable sequencer authority with its
guarded publication, a purge origin and the ledger. Only when all are
present does it hand the run to `observeCoordinatedSeason`, with the
sequencer and storage the Worker resolved. That function holds the §6.6 run
end to end: lease, reconciliation, recovery, the G5 planner, one
coordination, the G9 observation commit and, for a publication plan, the
publication half. The publication half covers publishability, the O-12
no-change gate, the O-13 ordering input, O-14 metadata, the hold and
durable-block stops, one guarded publication and the outcome commit. There
is no second publication path, and `SynchronizationService` and the legacy
publisher are never reached in `coordinated` mode.

**The two triggers.** The accepted O-8 semantics live in the orchestration,
and the entry points only name the trigger:

- **Scheduled**: it serves only what is due, and advances the due times it
  serves. Its cadence checks count confirmations and corroborate. It ends
  with the attention read (E2).
- **Manual**: a forced publication run. Its observations are out of cadence:
  a first write counts no confirmation, and a differing revision is not
  applied. It moves no due time, ignores the limiter deferral (the limiter
  still decides), is refused as `publication-stopped` on a held or durably
  blocked season before any request, and writes no attention line.

**The gate.** It runs before composition, so a refused run constructs no
pacer, client, transport, port, coordinator or bridge. It takes no lease and
makes no limiter reservation, provider request or publication write. A
refusal writes the existing bounded `sync.coordinated.withheld` line, and
`sync/full` answers `503` with the closed reasons. With the resolver
unchanged, that is every coordinated run in every environment, with the
reason `ledger-unbound`. Production also reports `authority-not-sequencer`.
A refused **scheduled** run with a ledger bound still reads it once for the
attention line, so a degraded runtime cannot silence a stopped season. That
is the rule E2 set for the orchestration's own refusals.

**Answers.** A run the orchestration handles writes its one
`sync.coordinated.observation` line (and, when scheduled, the attention
line). `sync/full` answers `200` with the closed outcome:

- `observed`, with the plan, coordination status, request count, policy
  event counts, publication result and lease release;
- `nothing-due`, with its reason;
- `run-in-progress`;
- `failed`, with stage and closed failure.

Each answer also carries the run kind. That `200` is the router's existing
rule (PR-B): only a refusal before the orchestration is a `503`. It is the
same rule as the whole-season sync, which answers `200` with its own result.

**`mock` and `none` are unchanged.** A trace recorded from the baseline
source (`192e83d`), before any source change, covers the scheduled handler,
every admin route and the public reads. It covers every environment and mode
combination: `mock`, `none`, unset and the refused ones. Each step records
the answer and body hash, the mock provider requests, the storage calls in
order, the log lines and the coordinated traffic counters. The trace is
reproduced exactly. With a ledger bound, it is also exact, except that the
read-only E2 inspection route no longer lists `ledger-unbound`.

**Choices made in implementation, not owner decisions:**

1. The gate runs before composition, and a refusal there keeps the
   `sync.coordinated.withheld` line. An orchestrated run keeps the
   orchestration's `sync.coordinated.observation` line. One run writes one
   of the two, never both.
2. **No cancellation source.** The orchestration defines what a cancelled
   run records (`retry`, `publicationDueAt` = now + 1 h for a scheduled run;
   no due time for a manual one). But no accepted decision gives a Worker
   entry point a reason to cancel. The decision pack's five-minute run budget
   (§7) was a recommendation, and O-8 did not adopt it. A deployed Worker
   therefore never cancels a run. The cancelled path is driven through the
   real entry points only by a test hook, `__COORDINATED_RUN_SIGNAL`. A run
   budget, or tying a manual run to its request's lifetime, needs an owner
   decision.
3. `__PACER_SLEEP` is a test hook, read only after the gate, so a Worker-level
   test advances its own clock instead of sleeping.
4. The orchestration's mapping reads `coordinationFor` through the
   composition, and imports only types from the coordination package. The
   composition therefore stays the only Worker module that imports either
   provider package by value (ADR 0022 A9 allow-list, unchanged).

**Tests.** 44 new tests, for 4,908 in 212 files. Everything is driven through
`worker.scheduled` and `worker.fetch`, over both sequencer and ledger
transports. The resolver's answer is injected by `vi.mock`, because no
environment field or test hook supplies a ledger. They cover:

- the missing-ledger path;
- a due bootstrap observation and nothing due;
- a guarded publication with curated metadata and the ordering input, and
  unchanged content confirmed without publishing;
- scheduled versus manual confirmation and due-time accounting;
- cancellation, limiter deferral, a failed provider request, a failed ledger
  commit and a held lease;
- held and durably blocked seasons, and backlog levels 47, 48 and 60 of 60;
- production's legacy authority, with and without a ledger;
- the baseline trace, with and without a ledger.

The dormancy tests now pin the wiring: the orchestration is imported only by
`run.ts`, `run.ts` only by the Worker entry point (and, for a type, the
router), and the resolver answers `null`.

**Negative controls.** Each is a mutation of the final code, restored from a
backup:

| Mutation | Failed tests |
|---|---|
| The gate skipped, so a null ledger reaches the orchestration | 9 |
| A fallback ledger supplied when the resolver answers `null` | 12 |
| The runtime composed before the gate | 11 |
| `sync/full` takes the whole-season path in `coordinated` mode | 43 |
| The scheduled handler takes the whole-season path in `coordinated` mode | 37 |
| A manual run sent as a scheduled one | 29 |
| The attention read dropped from a refused scheduled run | 4 |
| One extra storage read in the whole-season scheduled path | 2 |

**Bundle.** `d8022e63…42e6` (736,707 B) → `e866e387…c4cb` (804,240 B),
identical in all three environments. Binding reports are unchanged: staging
`mock`, production `none`, and no ledger binding. The +67,533 B are 18
modules now reachable from the Worker:

- the policy, the observation orchestration and the outcome half;
- the two curated records O-14 reads.

The modules the verification already reached also grew a little.

**Still open, all needed before "active":**

- the ledger's `[exports]` entry, binding and a resolver that reads it;
- selecting `coordinated` in staging, and deploying it (activation steps 2
  and 3, each separately authorized and cutover-sensitive);
- the hourly cron (O-7, step 6);
- O-9, and O-10 (plan limits and CPU, before step 3);
- running the A3.5 staging predecessor gate;
- the first provider-backed run (step 4, data-level irreversible, O-15);
- verified production alert delivery (OD-1), and PR-G (O-16);
- an owner decision on a run budget, if one is wanted.

*(Superseded in part on 2026-10-06, and true when written. The "Run
budget" note below records the owner's run-budget decision (RB-1 to RB-8)
and implements it, superseding choice 2 in part. O-10 itself stays open as
two activation checks. Everything else here stays open.)*

The decision above is unchanged.

### Run budget: one bound for both triggers (2026-10-06)

Implementation Plan §14.0.42 records this slice. It gives the wired, unbound
orchestration a run budget, under the owner's answers to the private O-10
run-budget decision pack (2026-10-06). The orchestration is still **wired,
not active**: no ledger is bound, no environment selects `coordinated`,
nothing is deployed, and **O-10, G5 and G9 are not complete**.

**Owner decisions (2026-10-06):**

| # | Decision |
|---|---|
| RB-1, RB-3 | Adopt a run budget, the same for scheduled and manual runs. |
| RB-2 | Abort the provider phase **240 s** after lease acquisition. Immediately before committing to publication, require elapsed time **≤ 300 s** and **≥ 300 s** left on the lease. |
| RB-4, **modified** | A request the budget aborts in flight is still a **sent request for limiter accounting**, but a **cancelled observation for ledger policy** (amendment below). |
| RB-5 | A closed cause, `run-budget-exhausted`, for an intent-gate refusal. |
| RB-6 | The manual route's HTTP status rule is unchanged. |
| RB-7 | Recorded as two activation checks (below). No `[limits]` change. |
| RB-8 | A run is not coupled to its client's connection: it reads no request signal. |

**How it works** (`src/sync/coordinated/run-budget.ts`):

1. **Start.** The budget starts when the run acquires its lease, on the
   Worker's clock. Its timer is armed there and nowhere earlier: a run
   refused at the gate, or answered `run-in-progress`, arms nothing.
2. **The coordination deadline**, 240 s after the start, aborts the run's
   own `AbortSignal`. That signal is handed to the coordinator and nothing
   else. A run whose coordination has not begun by the deadline begins it
   already cancelled, so it reserves and sends nothing. A
   `__COORDINATED_RUN_SIGNAL` test signal is linked into the same signal.
3. **The intent gate** runs in the publication half immediately before the
   reservation commit, after the hold and durable-block stops, the
   publishability decision and the no-change gate, and after the existing
   expired-lease check. It is open while at most 300 s have elapsed **and** at
   least 300 s remain on the lease. When it is closed, the run withholds the
   candidate as `run-budget-exhausted` and makes the existing `retry`
   decision through the outcome commit, under the still-valid lease:
   - scheduled: `publicationDueAt` = now + 1 h;
   - manual: no due time moves (O-8);
   - in both, the `publishing` mark is cleared and an earlier block is kept.

   The candidate existed only in memory. Nothing was reserved, prepared or
   written.
4. **No cancellation after intent.** The timer is disarmed as soon as
   coordination returns. Nothing in the guarded publication, `finalize`'s
   single re-drive, the outcome commit or the lease release reads the
   budget. A stall in that phase is left to the existing recovery: the
   sidecar, the sequencer's prepare TTL and the D5 cleanup.

**Constants.** 240 s < 300 s, and 300 s + 300 s = `LEASE_TTL_MS` (600 s),
which is under the 15-minute Cron Trigger wall. A test pins all three
against the ledger's constant.

#### Amendment to C2/C3 accounting: a budget abort is a cancelled observation (RB-4, 2026-10-06)

The decision pack recommended counting an in-flight request aborted at the
deadline as a T6 `failed` check, because it was sent. The owner modified
that. **The interpretation recorded here is binding on the orchestration's
mapping:**

> Any resource the routing port answered only **after the run's signal
> aborted** is a cancelled observation, `not-attempted`, whatever it carried.
> That covers a request aborted in flight and a response that arrived after
> the deadline. It is not a completed or failed cadence check. It adds no
> corroboration, cannot settle or trigger the 14-day ceiling, and its
> payload is never accepted. Its request still counts as sent.

**Checked against the accepted rules:**

| Accepted rule | Consistent? |
|---|---|
| C3: "only a completed request is a check" | Yes. An aborted request did not complete, and a late answer completed after the run stopped accepting answers. |
| C3: a cancellation is `not-attempted` and records nothing | Yes. This extends the cancellation row from "before sending" to "answered after the abort". |
| C3: an execution interrupted after an earlier request was sent is `not-attempted` | Yes, the same precedent. A sent request does not make a check. |
| C2 T6: a sent-and-failed request consumes a slot | Not applicable. T6 is a provider outcome (an upstream error, a timeout, a `429`, an invalid payload). A budget abort is GridView's own stop. |
| C2 choice 4: the ceiling never fires on a deferred or cancelled check | Yes. A `not-attempted` outcome returns before any cadence step, so slot 17 is not consumed. |
| C2 D2.1: only a cadence check returning a revision corroborates | Yes. A late payload is never mapped to `observed`. |
| O-8: manual runs move no due time | Yes. Nothing here moves a due time. |

**Before this amendment** the code did otherwise. A run-signal abort in
flight surfaced from the HTTP boundary as an attempted `cancelled` failure.
The port answered it as `failed` (`provider-unavailable`), and the C3 mapping
recorded T6 `failed`. That consumed the slot and, at slot 17, reached the
ceiling. A response that arrived despite the abort was selected and recorded
as `observed`.

**Where it is enforced.** ADR 0023's port and coordinator vocabulary is
unchanged: the contribution still says `attempted`, the run's accounting
still counts the request, and the Durable Object limiter reservation was
consumed when it was made. The Jolpica routing port is registered through a
pass-through in the coordination package, `recordLateAnswers`. It answers
exactly what the port answers and only notes which resources were answered
after the request's signal aborted. The orchestration's mapping
(`observation/outcomes.ts`) then records those resources as `not-attempted`.
A coordinator-side defect still refuses the whole mapping first.

The C3 failure-accounting table above is read with this amendment.

**Answers (RB-6, RB-8).** `sync/full` keeps the PR-B rule: `503` only for a
refusal before the orchestration, and `200` with the closed outcome
otherwise. A budget-cancelled run answers `200` with `coordination:
'cancelled'` and publication `withheld` / `cancelled`. An intent-gate refusal
answers `200` with `withheld` / `run-budget-exhausted`. The operator must read
the body. The Worker passes no request signal to the run, so a disconnect is
never a cooperative cancellation. It is not a guarantee that the run
survives one: the platform may end a request's execution after its client
disconnects, and `waitUntil` would extend it by at most 30 s. That is a hard
stop, like a CPU or wall-clock kill, and the existing recovery covers it. The
lease expires within 10 minutes, unexecuted checks stay due, a `publishing`
mark makes the publication due, and a committed release is recognized
through its sidecar, so it is not published twice. An operator keeps the
connection open until the answer arrives. A durable background mechanism for
manual runs (decision pack option 4) is not part of this decision.
*(Corrected 2026-10-06, PR #64 review: the first wording said a disconnect
neither cancels nor shortens a run.)*

**RB-7: O-10 as two activation checks.** Neither is done or authorized here.

1. **Before enabling the coordinated environment** (activation step 3,
   before selecting `coordinated` or binding the ledger), the owner verifies
   that the Cloudflare account is on **Workers Paid**. The decision pack
   found the Free plan infeasible: 10 ms of CPU, a 50-subrequest reading and
   1,000 KV writes a day.
2. **Before enabling the hourly cron** (O-7, step 6), real CPU time is
   measured on the first separately authorized staging runs (step 4), per
   run type, from dashboard metrics or `wrangler tail`. Staging has
   invocation logs off. `[limits] cpu_ms` is set only if that measurement
   argues for it.

**Choices made in implementation, not owner decisions:**

1. The budget's start is the Worker's clock right after `acquireLease`
   answers. The lease's own `expiresAt` stays the ledger's. On one clock the
   lease half of the gate implies the elapsed half; the elapsed half decides
   alone only when the ledger's clock runs ahead of the Worker's.
2. The intent gate sits after the existing expired-lease check. A lease that
   has already expired still fails as `lease-expired` and leaves the
   `publishing` mark to recovery, as before. Only a valid lease can carry the
   outcome commit the budget's `retry` needs.
3. The no-change gate (O-12) is not budgeted. It commits to no publication,
   and its settlement is one outcome commit.
4. A late answer is recognized per resource, by the time the port answered,
   not by its contents. A defect in a late answer still refuses the mapping.
5. A budget refusal logs at `info`, like every other withheld `retry`. The
   cause is in `publicationReason`.
6. A test hook, `__RUN_BUDGET_TIMER`, read only after the gate, lets a
   Worker-level test fire the deadline from its own clock. That is the
   `__PACER_SLEEP` precedent.

**Entry points, choice 2** ("no cancellation source") is superseded in part.
The run budget is now the one deployed cooperative cancellation source. The
client's connection is not one.

**Tests.** 49 new, for 4,957 in 215 files. The budget is driven through
`worker.scheduled` and `worker.fetch` over both sequencer and ledger
transports (`test/sync/coordinated/entry-points/budget.test.ts`). The
deadline is fired from the harness clock through `__RUN_BUDGET_TIMER`, and
the ledger, transport and sequencer port only move that clock. The tests
cover:

- a deadline before any request, for both triggers;
- a deadline during a request, with a transport that honours the abort and
  one that answers late;
- a cancelled check at the final slot, which does not reach the ceiling;
- the intent gate past 300 s (under a skewed ledger clock) and at exactly
  300 s, and the lease reserve at exactly 300 s and 1 ms short of it;
- the durable scheduled retry, and manual due times left unmoved;
- a publication pushed past both deadlines after the intent commit, which
  still completes, and a stall past the lease, which the existing recovery
  confirms without a second release;
- no timer for a refused or `run-in-progress` run, the linked test-hook
  signal, and a client signal the run never reads. A platform stop after a
  real disconnect cannot be reproduced locally; its effects are the hard
  stops the recovery tests cover.

Unit tests pin the constants against `LEASE_TTL_MS` and the cron wall, the
gate's two boundaries, the timer and the late-answer pass-through. The
existing entry-point, orchestration and baseline-trace tests pass unchanged.
The dormancy allow-lists name the one new module, `run-budget.ts`.

**Negative controls.** Each is a mutation of the final code, restored from a backup.

| Mutation | Failed tests |
|---|---|
| The run signal is not handed to the coordinator | 23 |
| The intent gate is removed | 6 |
| The intent gate is moved after the intent commit | 4 |
| The budget is re-checked after the intent commit, cancelling a prepared publication | 4 |
| The budget applies to scheduled runs only | 14 |
| A gate refusal skips the outcome commit and leaves `publishing` | 6 |
| The intent deadline is raised so the budget no longer fits the lease | 2 |
| A budget-cancelled manual run answers `503` | 4 |
| The budget starts from `Date.now()` instead of the run clock | 9 |
| A timer is armed before the gate | 10 |
| Late answers are mapped as they came (RB-4 as first drafted) | 10 |
| The pass-through records no late answer | 11 |
| The timer stays armed after coordination | 4 |

**Bundle.** `e866e387…c4cb` (804,240 B) → `9feebe7e…4625` (807,475 B),
identical in all three environments. Binding reports are unchanged: staging
`mock`, production `none`, and no ledger binding. The +3,235 B are the
budget module, the late-answer pass-through and the gate.

**Still open, all needed before "active":** the RB-7 checks; the ledger
`[exports]` entry, binding and resolver; selecting `coordinated` and every
deployment; the hourly cron; O-9; running the A3.5 gate; the first
provider-backed run (O-15); verified production alert delivery (OD-1); PR-G
(O-16). The pack's residual observations stay open: an overlap after an
expired lease can still publish a redundant identical release (recovery
answers `not-published` while another run's `prepare` is live), DO and KV
calls have no timeouts, and the purge batch's connection accounting is
undocumented. **O-10, G5 and G9 are not complete.**

*(Superseded in part on 2026-10-06 by the "Ledger resolver" note below: a
resolver that reads an optional `RECONCILIATION_LEDGER` binding now exists.
The `[exports]` entry and binding, and everything else here, stay open.)*

The decision above is unchanged.

### Ledger resolver: an optional binding, failing closed (2026-10-06)

**Preparatory work only.** `resolveReconciliationLedger` no longer answers a
hard-coded `null`. It reads one optional Durable Object binding,
`RECONCILIATION_LEDGER`, and fails closed. This change adds **no** Wrangler
`[exports.ReconciliationLedger]` entry, binding or migration. It also changes
no provider mode, no cron and no deployment configuration, and nothing is
deployed or provisioned. No committed environment declares the binding, so
the resolver still answers `null` in every one of them. *(A staging declaration
committed on 2026-10-07 was removed the same day before any deployment;
"Staging ledger binding" below.)* Every coordinated run,
scheduled or manual, still stops at `ledger-unbound` before any lease,
limiter reservation, provider request or publication write. Every operator
route and the coordinated rollback still refuse before reading anything.
**No activation step is complete or authorized: activation step 1 stays
open, and O-10, G5 and G9 are not complete.**

**Shape**, following the existing `PROVIDER_RATE_LIMITER` and
`SEASON_PUBLICATION_SEQUENCER` conventions:

- `Env` gains an optional `RECONCILIATION_LEDGER?: DurableObjectNamespace`.
- `ledgerClientFor(binding)` lives in `ledger/durable-object.ts`, the one
  package that constructs ledger clients. It answers a
  `DurableObjectReconciliationLedger` only for a value with a namespace's
  `idFromName` and `get` functions. Anything else answers `null`, the
  caller's `ledger-unbound`: an absent binding, `null`, a variable, a KV
  namespace, or an object missing either function.
- `resolveReconciliationLedger(env)` reads that one field. It reads no
  provider mode and no test hook. Both Worker call sites now pass `env`.
- Resolving performs **no lookup**: neither `idFromName` nor `get` is called
  until the client's first command. A namespace that then fails (a throwing
  `idFromName` or `get`, a rejected or `500` stub, an answer that is not a
  ledger outcome) is the client's existing bounded `unavailable`. The run
  stops at its lease as `failed` / `lease` / `ledger-unavailable`, with no
  reservation, request or publication write.

**Choices made in implementation:**

1. The resolver does not check the provider mode. `mock` and `none` never
   reach a coordinated path, and the operator routes refuse
   `provider-mode-not-coordinated` first. A binding there is never looked
   up: the baseline trace replays with a bound namespace and zero lookups.
2. No `__RECONCILIATION_LEDGER` test hook was added. The real path is
   testable through a local namespace double that dispatches to a real
   `ReconciliationLedger` object, so a hook would only add an untested
   second route. A hook-shaped or misnamed field is still ignored.
3. The resolver lives in `ledger-port.ts`, where every existing `vi.mock`
   of it points.

**Tests** (32 new; 4,989 in 217 files):

- `test/sync/coordinated/entry-points/binding.test.ts` (17) drives the real
  Worker entry points with the real resolver, over the Durable Object
  sequencer:
  - no binding: `ledger-unbound`, zero traffic, an empty ledger host;
  - a usable binding: the bootstrap observation and the first publication,
    a `200` manual run, and the inspection route served from the bound
    ledger;
  - seven unusable bindings, each answering `ledger-unbound` untouched;
  - five failing namespaces, each stopping at the lease;
  - `mock` and `none` with a binding: the baseline trace, with zero
    lookups.
- `test/sync/coordinated/ledger/resolver.test.ts` (14) covers the resolver
  and factory.
- The dormancy test now pins one optional `Env` field, no test hook, and two
  `resolveReconciliationLedger(env)` call sites in `index.ts`. It still pins
  no `[exports]` entry, binding, migration, `coordinated` mode or cron
  change.
- `coordinated-runtime.test.ts` keeps proving that ledger-shaped namespaces
  under other names, or under a hook name, reach nothing.

**Negative controls**, each restored from a backup:

| Mutation | Tests failing |
|---|---|
| The resolver answers `null` again | 11 |
| The namespace shape check removed | 14 |
| A `__RECONCILIATION_LEDGER` hook also accepted | 1 |
| The run's dependencies ignore the binding | 8 |
| An eager lookup at resolution | 5 |
| The whole-season scheduled path reads the bound ledger | 1 |

**Bundle.** `9feebe7e…4625` (807,475 B) → `052590b6…728d` (818,039 B),
identical in all three environments. Binding reports are unchanged: staging
lists only `PROVIDER_RATE_LIMITER` and `SEASON_PUBLICATION_SEQUENCER`, and
`wrangler types` generates no ledger field. The +10,564 B are the Durable
Object client and its wire decoders. Until now these were tree-shaken,
because nothing constructed the client.

**Still open, all needed before "active":** activation step 1; the ledger
`[exports]` entry and per-environment binding, each a separately authorized,
cutover-sensitive change *(committed for staging on 2026-10-07 and removed
the same day; Stage B parked; "Staging ledger binding" below)*; selecting `coordinated` and every deployment; the
two RB-7 checks (O-10); the hourly cron; O-9; running the A3.5 gate; the
first provider-backed run (O-15); verified production alert delivery (OD-1);
PR-G (O-16). **O-10, G5 and G9 are not complete.**

The decision above is unchanged.

### Staging ledger binding: committed, not deployed (2026-10-07)

> **Superseded 2026-10-07: removed before any deployment; Stage B parked.**
> The declaration below was taken out of `wrangler.toml` the same day
> (Implementation Plan §14.0.45). It was never deployed and no ledger
> namespace was ever provisioned. The owner's no-cost requirement
> authorizes no Workers Paid plan and no other paid service, the account
> is on Workers Free, and the ledger serves only `coordinated` mode, which
> RB-7 check 1 puts behind Workers Paid. Deploying it (Stage B) is
> therefore parked, with the coordinated runtime. Staging again resolves
> to the two Durable Objects that Stage A deployed (version `cc8d9a54-…`,
> operator-recorded source `3228725`), and development and production
> are unchanged. The class export, the dormant ledger implementation and
> the resolver stay. `test/config/staging-ledger-binding.test.ts` became
> `test/config/ledger-binding-absent.test.ts`, which pins the absence.
> The analysis below is kept for a future, separately decided Stage B.

**Configuration only.** `wrangler.toml` now registers the
`ReconciliationLedger` class (`type = "durable-object"`,
`storage = "sqlite"`) and declares the `RECONCILIATION_LEDGER` binding
**for `env.staging` only**. Nothing is deployed or provisioned: the live
staging version predates it, and no ledger namespace exists. Development
and production declare neither. **No activation step is complete or
authorized: activation step 1 stays open, and O-10, G5 and G9 are not
complete.**

**Why a staging `exports` table, not a top-level entry.** In Wrangler 4.112
`exports` is inheritable: a named environment's own table replaces the
top-level one rather than merging with it. A top-level
`[exports.ReconciliationLedger]` (the form Implementation Plan §14.0.30
sketched) would have put the class into production's resolved
configuration, so a first production deployment would create it unbound,
as it would `SeasonPublicationSequencer` today. Staging's table instead
restates `ProviderRateLimiter` and `SeasonPublicationSequencer` exactly and
adds the ledger. Development and production resolve to byte-identical
configuration. No migration is used: the repository uses `exports`, and
Wrangler treats the two as mutually exclusive. The cost is that the two
restated entries must stay identical to the top-level ones, which a test
pins through Wrangler's own configuration reader.

**What the binding does and does not change.** The resolver is unchanged
and still reads no provider mode ("Ledger resolver", choice 1). Once a
staging deployment carries the binding, the ledger stops gating staging.
`PROVIDER_MODE = "mock"` then keeps staging out of the coordinated paths:
the scheduled run and `sync/full` take the whole-season path, every
reconciliation route refuses `provider-mode-not-coordinated` before reading
anything, and nothing looks the namespace up. That deployment is
cutover-sensitive (staging runbook §6, "Reconciliation ledger binding"), and
RB-7 check 1 comes before it.

**Tests.** `test/config/staging-ledger-binding.test.ts` (7) reads the
committed file through `unstable_readConfig`. It pins the staging
registration and binding, the unchanged development and production
configuration, and the restated entries. It drives the committed staging
(`mock`) and production (`none`) variables, with a counting namespace
bound, through the scheduled handler, `sync/full` and all eight
reconciliation routes. Every run has zero lookups, reservations, transport
or global `fetch` calls, guarded publications and `sync.coordinated` lines.
The dormancy test now pins the staging-only declaration. Five negative
controls fail 3 / 3 / 2 / 2 / 3 tests (Implementation Plan §14.0.44).

**Bundle.** Unchanged: `052590b6…728d` (818,039 B) in all three
environments. The staging dry-run now lists `RECONCILIATION_LEDGER`.

**Still open, all needed before "active":** deploying the binding, a
separately authorized cutover-sensitive staging deployment; activation step
1; selecting `coordinated`; the two RB-7 checks (O-10); the hourly cron;
O-9; running the A3.5 gate; the first provider-backed run (O-15); verified
production alert delivery (OD-1); PR-G (O-16). **O-10, G5 and G9 are not
complete.**

The decision above is unchanged.

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
