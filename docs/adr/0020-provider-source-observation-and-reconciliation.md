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
| D2.5, D2.8 | A differing revision on a settled record is sighted once (T8). Its second sighting stages it (T9), and it is never applied. The staged slot is immutable. A staged or locked record takes **no** transition from any run, and T11-T11d stay unreachable. `classification.staged-correction` is its own event, distinct from the overwrite event. |
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
  ledger field;
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
| Storage invariants (`commit`) | `staged-correction-immutable`: a commit that clears or changes a stored staged or competing correction, writes `lastDisposition`, or carries any backlog removal. A competing slot may still be filled (T11b). `backlog-staged-mismatch`: a backlog entry is inserted only together with the newly staged slot of the same revision, and the reverse. `operator-state-immutable`: a commit that sets, changes or clears a hold or `lastOperatorAction`, or changes or clears a durable block. A run may set a durable block. `publication-stopped`: a publication **reservation** while a hold or durable block is set. |
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
(OD-2), never the token and no revision. The Provider Evaluation's
`reconciled.review_disposed` event is this line with a disposition action.

**Coordinated rollback (OD-3).** In `coordinated` mode only,
`POST /internal/admin/rollback` runs `rollbackUnderHold`: the existing
rollback, once, under the season lease, only while `operatorHold` is set,
with the D14/D15 guard unchanged. Without a hold it answers `409`
`publication-not-held` and the publisher is never reached. `mock` and `none`
keep the existing path exactly.

**Attention line (OD-1, OD-8).** After every **scheduled** run of
`observeCoordinatedSeason`, whatever its outcome, the season is read once more
(after the lease is released) and, while it is held, durably blocked, or the
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
  cannot be verified. The way back to an ungated rollback is the existing
  mode rollback to `mock`.
- The attention conditions are exactly the hold, the durable block and the
  two backlog levels. A transient `blocked` disposition and a pending review
  are not conditions of their own: their backlog entries count toward the
  backlog levels, and inspection shows them.
- The line is written by the injected orchestration only. The Worker's
  scheduled handler still calls `runCoordinatedSync`, which stops at
  composition, so **no deployed Worker can write it**. Connecting the
  orchestration is an activation step.

**Tests.** 131 new tests (4,709 in 204 files). Through the Worker entry point,
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

**Bundle.** `e5b6a16f…cbcf` (664,968 B) → `0e8ddbe7…1696` (685,659 B),
identical in all three environments, binding reports unchanged (staging
`mock`, production `none`, no ledger binding). The +20,691 B are the admin
reconciliation routes and the operator package. Policy, observation and
outcome code stay out of the bundle.

**Still open:** connecting the orchestration to the scheduled handler, the
ledger binding and resolver, and every other activation step; verified
production alert delivery (OD-1); PR-E3 (OD-7); PR-G (O-16); O-9; running the
A3.5 gate.

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
