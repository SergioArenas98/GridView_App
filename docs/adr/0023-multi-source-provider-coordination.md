# 0023 - Multi-source provider coordination

- Status: Accepted
- Date: 2026-08-26
- Phase: 9B-4
- Closes: gap **G4** (Provider Evaluation Appendix D.3 **G4**, §10.10) —
  **the coordination mechanism only.** No adapter consumes it, so no real
  reconciliation happens and none is claimed.
- Related: [0019](0019-formula-one-provider-legal-gate.md),
  [0020](0020-provider-source-observation-and-reconciliation.md),
  [0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md),
  [0022](0022-curated-provider-identifier-mappings.md),
  [0007](0007-versioned-kv-publication-active-pointer.md)

## Context

The provider seam GridView has carried since Phase 2 is a single call:

```ts
fetchSeasonSource(season: number, jobs: SyncJobCategory[]): Promise<ProviderSeasonSource>
```

It demands a **whole season from one source in one call** and defines no
partial-success result, no per-resource failure and no notion of a source role.
[ADR 0019](0019-formula-one-provider-legal-gate.md) adopted a **two-source**
model — Jolpica for complete and reconciled data, OpenF1 for provisional
post-session data — and
[GridView_Provider_Evaluation.md](../technical/GridView_Provider_Evaluation.md)
§10.10 requires the two adapters to be **independent**, with reconciliation
living in a coordinator above them.

That is impossible against the single-call seam. A two-source adapter would
have to know about its peer, and a one-source adapter would have to manufacture
a complete season out of the fraction it can actually serve. Appendix D.3
records this as **G4** and calls it "the largest single piece of Phase 9B
work".

G4 also blocked itself on identity, which is why it was sequenced last of the
mechanism gaps: G7 supplied the hardened outbound boundary and the rate limiter
([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)),
and G8 supplied the fail-closed identifier registry
([ADR 0022](0022-curated-provider-identifier-mappings.md)).

## Decision

Introduce a **typed, deterministic, fail-closed multi-source coordination
seam**: independent per-source resource ports, a plan of logical resources, a
closed outcome taxonomy, role-based selection, exact accounting and a guarded
bridge to the unchanged publication boundary.

### D1 - Adapters are independent ports, and know nothing of each other

A port is asked for **one resource at a time** and answers with **one typed
outcome**. It receives the source identity, the resource identity and the
caller's cancellation signal — nothing else. It never sees the plan, never sees
another source's outcome, never decides which source wins and never publishes.

This is what makes §10.10's promise structural rather than aspirational:
either source can be removed without changing the public v1 contract, because
no adapter has ever been able to depend on the other's existence.

### D2 - Coordination sits above the adapters, and is the only thing that knows both

One module owns source role and source capability, and one component drives the
ports. Nothing below it can reach the policy, and nothing above it needs to.

`mock` is deliberately **not** a coordinated source. It is a whole-season
deterministic double with a `testOnly` quota policy; it owns no role in the
reconciled/provisional model, and giving it one would let a test fixture be
presented as source policy. The mock provider and the existing synchronization
path are untouched.

### D3 - Requests are per resource and per source, not per season

The unit of work is a **logical resource**: the season calendar, the season
participants, the season circuits, one event's schedule, one session's
classification, the driver standings, the constructor standings. Each carries
its season, and its round and session scope where it genuinely has one, as a
closed discriminated union — so an event-scoped request without a round, or a
season-scoped request carrying one, is a compile error rather than an ignored
field.

The job category used for accounting is **derived** from the resource kind by a
total function, never supplied by the caller, so attribution is exact by
construction. **No resource kind maps to `home-rebuild`**: rebuilding a derived
GridView document is not a provider request and can never become one.

### D4 - Source capability and role are policy, owned above the adapters

| Source  | Role          | May be asked for                                                                   |
| ------- | ------------- | ---------------------------------------------------------------------------------- |
| Jolpica | `reconciled`  | every coordinated resource                                                         |
| OpenF1  | `provisional` | session classification, driver standings, constructor standings — and nothing else |

The provisional capability set is exactly the documented post-session result
and championship resources. There is deliberately **no** capability for
telemetry, live timing, media, a baseline metadata refresh or a health check:
[ADR 0020](0020-provider-source-observation-and-reconciliation.md) D5.2 admits
no exception at all, and an ungated schedule or discovery lookup could itself
fire inside the live window.

A request outside a source's capability is skipped with a bounded typed reason
**before** the adapter is called, so it can never reserve capacity, reach
transport or produce an attempt.

### D5 - The provisional source stays locked, bound-or-skip

OpenF1 remains locked closed. Eligibility is an **already-decided input**, not
a calculation: the coordinator consumes a recorded maximum-session-duration
bound and never derives one, because D5.3 and D5.4 forbid deriving it from a
scheduled start or end time.

Absence, `null`, a bare number, a wrong discriminant, a non-integer, a
non-positive value, an absurd value and an object carrying an extra property
**all mean locked**. Nothing is read as permission by default.

**No bound is recorded.** The production policy constant is `null`, so every
production wiring is locked, and the lock is checked before capability
resolution ever reaches transport. The only unlocked path is a test fixture
that is explicitly labelled as not being a recorded bound, exactly as D5.5
permits for fixture testing.

### D6 - A closed result taxonomy, with "not attempted" unrepresentable as an attempt

Outcomes separate three things that are routinely conflated:

| Class                | Members                                                                                                                  | Counted as a provider request |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Not attempted        | `source-locked`, `source-unavailable`, `resource-unsupported`, `rate-limit-deferred`, `limiter-unavailable`, `cancelled` | **No**                        |
| Attempted failure    | `provider-rate-limited`, `provider-unavailable`, `invalid-payload`                                                       | **Yes**                       |
| Coordination failure | `malformed-outcome`, `adapter-error`, `mapping-unresolved`, `coordination-invariant`                                     | See below                     |

The `not-attempted` outcome variant **carries no attempt field at all**, so
counting one as a provider request is structurally impossible rather than
merely forbidden.

**That claim is enforced at runtime, not only in the type.** An adapter is an
input boundary, so a compile-time union proves nothing about the object that
actually arrives: a validator that merely recognises enough fields to enter a
branch would accept `not-attempted` carrying a real `attempt`, classify the
operation as skipped and lose the request from accounting entirely. The union
is therefore validated as a **closed discriminated union**. One centralized,
discriminator-keyed table states each variant's required, permitted-optional
and consequently forbidden properties, and an outcome is admitted only when it
carries exactly the properties its own variant declares:

| Variant           | Required (besides `outcome`) | Optional     |
| ----------------- | ---------------------------- | ------------ |
| `candidate`       | `attempt`, `payload`         | —            |
| `not-attempted`   | `reason`                     | `retryAt`    |
| `failed`          | `attempt`, `reason`          | `retryAfter` |
| `mapping-failure` | `attempt`                    | —            |

Presence is decided **structurally, never by value**: an own `attempt` property
holding `undefined` is still an attempt-bearing outcome and is rejected, as is
one reachable only through the prototype chain. A property another variant
declares — `retryAt` on `failed`, `payload` on `mapping-failure` — is rejected
rather than silently ignored. Nothing on a rejected outcome is read afterwards,
so a malformed answer can neither hide a request from accounting nor
contribute one, and a hostile accessor or proxy trap is contained by the same
bounded attribution boundary that contains a throwing adapter.

**A malformed shape never becomes accounting data.** It takes the existing
`malformed-outcome` contribution reason, stays `attempted: false`, registers no
transport, is not selected, assembled or published, and leaves the lifetime
total at zero. The embedded attempt is not re-read as trustworthy accounting
data: its containing outcome is malformed, so under-reporting is preferred to
inventing a request from an unusable answer — and the Durable Object
reservation ledger remains the pacing authority, exactly as it does for
`adapter-error`.

A `429` remains an attempted, source-attributed, rate-limited request; a
limiter deferral remains not attempted and may carry `retryAt` as **data
only** — nothing in this phase schedules on it, because that is G5.

**A reason and its attempt outcome are two statements about one request, so
they must agree.** One total table decides which pairings describe a request
that could actually have happened, and an outcome that contradicts itself is
rejected as `malformed-outcome` rather than believed in either direction:

| Outcome / reason                   | Allowed `attempt.outcome`    |
| ---------------------------------- | ---------------------------- |
| `candidate`                        | `successful`                 |
| `mapping-failure`                  | `successful`                 |
| `failed` + `provider-rate-limited` | `rate-limited`               |
| `failed` + `invalid-payload`       | `successful`                 |
| `failed` + `provider-unavailable`  | `failed` **or** `successful` |

`provider-unavailable` is deliberately the one reason with two allowed endings,
because it genuinely covers two. `timeout`, `network`, `redirect-rejected` and
`provider-http-error` are transports that never completed usefully; but
`invalid-content-type`, `response-too-large` and `malformed-json` are
GridView's own policy rejecting a response that **arrived**, with a status,
after a request that left and was answered — the hardened boundary records
`requestAttempted: true` for exactly those
([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)).
Forcing `failed` on them would make coordination contradict the transport layer
and under-report a real answered request. It still never admits `rate-limited`:
a `429` has its own reason, so that pairing remains a contradiction.

A contradictory pairing is a **coordination** failure, not an attempted one. It
is not selected, not assembled, not published, and **no request activity is
derived from it**: an outcome whose shape is self-contradictory makes its own
attempt record unusable, so counting it would write a provider failure
timestamp on the strength of a claim already known to be false. This
under-reports for the same reason `adapter-error` does, and the Durable Object
reservation ledger remains the pacing authority.

A `mapping-unresolved` failure follows a request that _was_ sent and _was_
answered, so its transport attempt still counts while the resource contribution
fails. An `adapter-error` — a port that threw instead of answering — is
deliberately **not** counted: a throw is evidence of an adapter defect, not
evidence that a request left GridView, and inventing an attempt would write a
provider failure timestamp for something the provider may never have seen. This
under-reports rather than over-reports, which is safe because pacing authority
belongs to the Durable Object reservation ledger
([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)) —
it already holds any slot a real request consumed — and these counts are
reporting, not admission control.

#### The plan and the attempt are runtime boundaries too

The result taxonomy above is only closed if the values entering and leaving it
are. Two of them were still admitted on weaker evidence than the outcome
variant itself, and both are now checked with the same mechanism.

**A plan is untrusted input, not a typed value.** `CoordinationPlan` proves
nothing at runtime: a caller can hand over a proxy whose `ownKeys` trap throws,
an object whose `season` getter throws, a `resources` that is not an array, or
an entry carrying a symbol-keyed, non-enumerable or prototype-borne field.
Validation now closes the plan's own root shape, bounds its season to the
supported domain, requires `resources` to be an actual array, reads it by index
rather than through a caller-reachable iterator, and performs every reflection
and property access inside containment. Every malformed or hostile plan becomes
a bounded `plan-rejected` result with **no port call, no transport
registration, no accounting and no hostile detail in any log line**. A plan
whose season could never be read reports `season: 0`, which is outside the
supported domain and therefore unambiguous.

Resource identities are closed with the **same** key-inspection principle the
outcome boundary uses — `Reflect.ownKeys`, `Object.hasOwn` and `in` rather than
an `Object.keys` count, which sees neither a symbol-keyed nor a non-enumerable
nor a prototype-borne field — and shape is decided before any value is read, so
a throwing accessor on a scope field never fires from a shape decision. A
validated identity is copied into a plain frozen object whose declared fields
were each read once, and the coordinator executes **that** copy: an accessor
cannot answer differently on a second read, so a plan cannot pass duplicate
detection and then expand into two different requests.

**A transport attempt is shape-closed.** It is the value the run's whole
accounting is keyed by — two outcomes sharing one reference are counted once,
and a reference claiming two endings fails the run closed — so admitting it on
two readable fields would let an adapter hang a URL, a body or a provider
identifier on the one object the coordinator retains and compares. Its own keys
are now exactly `reference` and `outcome`, nothing is coerced, a required field
inherited from a prototype is not an attempt, and a throwing accessor is
contained rather than escaping into attribution. The reference bound is decided
from the UTF-16 length before the string is walked, so an adapter-supplied
value cannot decide how much work the boundary performs.

**A candidate payload must be a plain object before anything asks what it
contains.** `typeof null === 'object'` and `typeof [] === 'object'` are both
true, so neither was refused at the outcome boundary. Both are now rejected as
a precondition; the payload's actual contract is still decided in one place, by
`payloadMatchesResource`.

### D7 - One transport request is counted exactly once

An outcome carries a bounded **transport reference** identifying the single
physical request it was derived from. One response legitimately serving several
derived resources reports the same reference from each, and the coordinator —
never the adapter — counts it once while crediting every job category it
served. The same reference claiming a _different attempt outcome_ cannot
describe one request, so the later claim is rejected immediately as a
`coordination-invariant` violation — **and the contradiction taints the whole
run**. The two claims purport to describe one physical request and cannot both
be true, so the run's own request accounting is already unusable; the run is
marked `invariant-violated`, no season source may be assembled as complete, and
neither generation nor publication runs. Nothing is repaired, no claim is
chosen over the other, and no other source may mask it. Accounting established
before the contradiction is preserved as it stood, the reference is not counted
twice, and no request activity is invented from the rejected claim. Diagnostics
name the invariant category and the source; the reference itself is never
logged.

This is deliberately narrow. It applies only to a same-source, same-reference
contradiction. An ordinary `provider-unavailable`, `provider-rate-limited`,
`invalid-payload`, mapping failure, missing resource or legitimate cross-source
disagreement is **not** a run-level violation, and a healthy fallback remains
exactly the right answer for those.

A reference is scoped to **its source**. It is a token one adapter mints for
itself, and by D1 the adapters are independent — neither imports, calls or
knows about the other — so they share no namespace and cannot agree to avoid
each other's tokens. The same string arriving from both sources is a
coincidence, never evidence about one request: the two are never deduplicated
against each other, never treated as a conflict, and each is counted and
attributed in full. Scoping the reference is what keeps D8 true, because
otherwise one source's choice of token could discard the other's candidate.

The reference is never logged. It is a correlation token, bounded at 64 code
points, and it exists only inside one run.

### D8 - Selection is decided by declared role, and by nothing else

`reconciled` outranks `provisional`. That single precedence table is the whole
of the decision.

Arrival time, completion order, plan order, payload size, truthiness,
display-name similarity and string comparison are all **unreachable** from
selection by construction. A provisional payload therefore never overwrites a
reconciled one — not because of an ordering accident, but because the role
table says so.

A provisional candidate is returned **only** for a resource the provisional
source is capable of serving, and it is never relabelled as reconciled.

### D9 - Partial success is a first-class result

Each resource carries its own selection and the full list of what every
considered source contributed, including diagnostic outcomes for sources that
lost. One failing resource never blocks an independent one, and a failure stays
attached to its exact resource and source.

**A healthy subset cannot restore publishability after a coordination-invariant
violation.** Partial success is first-class for provider failures, where the
worst case is missing data; it is not a way to recover from a run whose account
of its own requests is impossible. So a fallback candidate may still be
_selected_ for the affected resource — attribution stays exact — but the run is
`invariant-violated` and withheld regardless of how complete the selection
looks. This is what makes "a healthy subset never conceals a coordination
invariant violation" true in the published output rather than only in the
diagnostics, and it settles the tension with D7: D7 rejects the contradictory
contribution, and D9 refuses to let anything else compensate for it.

A duplicate logical resource in a plan is **rejected fail-closed as a whole**
rather than canonicalized: a duplicate is a caller defect, and collapsing it
silently would hide the defect while quietly changing what was asked for.
Rejection happens before any expansion, so nothing is reserved, nothing is
called and nothing is counted. There is no last-entry-wins behaviour anywhere.

Duplicates are decided on **semantic identity**, which is why an identity is
validated as a closed shape: a resource carrying a scope its kind does not have
names the same logical resource as the same identity without it, so it is
rejected as invalid rather than admitted as a second identity for one resource.
Each class of plan violation is also decided over the whole plan before the
next is considered, so the reported problem depends on the plan's contents and
a fixed precedence, never on the order the entries arrived in.

### D10 - Mapping stays a separate fail-closed boundary

Identity resolution belongs to the adapter, which is the component that holds
provider identifiers, and the Phase 9B-3 registry raises its own bounded
signal there. The coordinator receives only a bounded `mapping-failure` marker
and contains it to the affected source contribution; it never re-reports the
mapping payload, never infers, normalizes or mints an identity, and never
imports the registry.

An invalid registry makes every contribution routed through it unavailable
while unrelated resources continue.

### D11 - Publication stays exactly where it was

Adapters never publish. The coordinator never writes an active pointer, never
touches storage and never generates a snapshot.

One guarded step bridges a **completed** run to the existing publisher: it
assembles a complete `ProviderSeasonSource` or explains precisely why it
cannot, and calls `SnapshotPublisher.publish` at most once, from one call site,
with no loop and no retry. The publisher remains the sole publication
authority, the active pointer remains its final write, and
[ADR 0007](0007-versioned-kv-publication-active-pointer.md) is unchanged.

**Only `completed` rounds require a race classification.** Completeness is
decided per event by a pure, total predicate over the closed status union, and
by nothing else:

| Event status  | Race result required |
| ------------- | -------------------- |
| `scheduled`   | no                   |
| `upcoming`    | no                   |
| `in_progress` | no                   |
| `completed`   | **yes**              |
| `postponed`   | no                   |
| `cancelled`   | no                   |
| `unknown`     | no                   |

Only `completed` establishes that a race was run and therefore that a
classification must exist. `in_progress` is excluded because a race under way
has no stable result yet, and `unknown` because it establishes nothing —
inventing a requirement from it would block an entire season on a value the
enum contract defines as merely "not recognised". Both choices fail towards
**not fabricating data**, which is the direction the result contract already
takes: the Grand Prix results resource returns the race classification _when
available_, and an unavailable future result must be a meaningful absence
rather than a fabricated empty classification (GridView_Backend_Scheme.md
§10.5). The generator honours that by emitting a results document only when one
exists, so a non-completed round simply has none, and an ordinary in-season
snapshot — some rounds raced, the rest still ahead — publishes normally. A
`completed` round whose classification is genuinely missing still withholds the
whole snapshot and preserves last-known-good.

**A completed round needs an actual classification, not merely a document.**
Every round carries a race-result resource, because a not-yet-run session must
answer with a meaningful absence rather than a fabricated empty classification,
so the presence of a document proves nothing. Two sets are therefore kept
apart: the _selected race-result resources_, which are what gets published, and
the _classified rounds_, which are what proves completeness. Only `final` and
`provisional` enter the second; `unavailable`, `unknown` and any unrecognised
value do not. A completed round whose result is an absence document withholds
the whole candidate and preserves last-known-good, while a non-completed round
keeps publishing that same absence document exactly as before. The
`unavailable` contribution is never discarded to force completeness, and
`hasResults` is never rewritten.

**This is publication completeness, not scheduling.** The predicate reads one
field of data the source supplied. No clock, event offset, session duration,
cadence or due-job calculation is involved, and G5 remains untouched. A
classification supplied for a non-completed event is governed by the existing
result contract and is not specially rejected here.

**Only a race classification is publishable.** The public resource
`/v1/seasons/{season}/grand-prix/{round}/results` is defined as the race
classification, and the generator selects its document by round alone, so any
non-race classification left in the assembled `results` could be published in
the race's place. Assembly therefore admits `sessionType: 'race'` only. A
qualifying or sprint classification remains a valid _coordination_ result and
stays visible in the run; this phase simply has no public document to carry it,
and no session-scoped result document is added, because that would widen the v1
contract. A non-race classification consequently cannot satisfy a round's
race-result completeness either.

**Referential integrity is settled before generation.** Every resource is
selected independently, so nothing upstream compares a calendar event against
the circuits collection or a standing against the driver profiles. Two
individually valid candidates can be mutually inconsistent, and generation
assumes those references resolve in two ways that are both unacceptable here:
it **throws** on a missing driver, constructor or circuit — which would escape
the publication boundary as a rejected promise rather than the bounded outcome
it promises — and it **publishes the dangling identifier** for standings and
classification entries, which are copied through verbatim.

One preflight therefore re-states the generator's lookup assumptions as a
closed set of named relations and reports which of them do not hold. One broken
relation withholds the whole candidate as `inconsistent-references`; nothing is
resolved, repaired, normalized or dropped, no partial subset is published, and
the diagnostic carries relation names only, never an identifier. Two relations
are deliberately excluded because requiring them would reject correct data: a
circuit's `lapRecord` is an optional historical fact whose driver need not be
on this season's grid, and one driver may legitimately hold several season
entries, because mid-season participation is modelled as split spans
(GridView_Domain_Model.md §6.7, decision M6).

**A version's contents are recorded, not reconstructed.** Every version stores
the sorted, deduplicated set of document names generation actually produced, as
internal metadata under its own snapshot prefix. Nothing about a version is
inferred from its collection documents any more.

Reconstruction was wrong, and provably so against the shipped content. The
`circuits`, `drivers` and `constructors` collections are derived from the
calendar and from the season entry lists, while the matching detail documents
are generated from the registries — so a circuit with no calendar event, or a
registry driver with no season entry, is generated and stored while appearing
in no collection at all. The curated content already contains one such circuit.
Reconstruction therefore under-reported what a version holds, which silently
accepted an incomplete rollback target and silently skipped that document's
public route during invalidation.

Completeness is now decided over the exact inventory: every inventoried
document must exist, every required season-level document must be inventoried,
every calendar event must have its detail document, and every event advertising
`hasResults: true` must have its results document. Because the cross-resource
preflight binds `hasResults` to `final` or `provisional`, a completed
classified round still cannot evade results-document verification — its own
flag is what demands the document — while an event advertising no
classification does not make a results document mandatory merely by appearing
in the calendar. A generated optional absence document _is_ inventoried and so
must exist; a classification generation never produced is never inventoried, so
an ordinary active-season release stays a valid rollback target both explicitly
and through the previous pointer. Nothing is fabricated into an inventory.

A version carrying **no** inventory fails closed as a rollback target with
`missing-version-inventory`. Falling back to the collection heuristic is not
available, because that heuristic is exactly what was proven to under-report.
No deployed coordinated snapshot depends on this compatibility path.

**Target completeness and cache invalidation are two different sets.** They
answer two different questions over the same exact inventories, and are
deliberately not derived from one another:

| Set                   | Question                                                                                          | Rule                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Target completeness   | Which documents must the target contain to be a legal rollback target?                            | The target's own exact inventory, plus the calendar-derived requirements above.                  |
| Rollback invalidation | Which public routes may still serve the outgoing version's representation once the pointer moves? | The **union** of both versions' exact inventories mapped to routes, never gated on `hasResults`. |

Using the completeness set for both left a real gap: a target advertising
`hasResults: false` for a round — whether it stores an `unavailable` absence
document or no results document at all — excluded that round's public results
URL from the purge, so a **final classification cached from the newer version
kept being served** after the pointer had rolled back to the meaningful
absence.

Rollback therefore purges the union of the **currently active** version's and
the **target** version's exact inventories mapped to public routes, plus the
season-wide routes whose representation depends on the active pointer: every
event's detail _and_ results URL for every round present in either version
regardless of either version's `hasResults` flag, and every driver, constructor
and circuit route either version carries — including an orphan profile no
collection names. A route present in only one of the two versions is still
invalidated, in both directions. The union is deduplicated and sorted
deterministically, and one rollback issues exactly one purge request. An
outgoing active version carrying no inventory contributes nothing to the union
rather than blocking the recovery it is being rolled back from.

The same exact inventory and the same route mapper serve
`POST /internal/admin/cache/purge` for the **active** version, so an operator
purge covers the whole active release rather than a hand-maintained subset. It
moves no pointer and writes nothing; with no active version or no inventory it
returns a bounded result.

This is intentionally conservative. Purging a results URL whose new
representation is a meaningful absence, or which has no document at all, costs
one cache miss; leaving the newer version's classification cached contradicts
the pointer the rollback just restored. Validation still runs before the
pointer moves, a completeness rejection moves no pointer and purges nothing,
`setActiveVersion` remains the commit point, and the purge remains
**post-commit**: it cannot un-move the pointer, so a purge that fails, throws
or rejects is reported as `applied` with `cachePurge: 'failed'` and never
reverts the rollback. Explicit-target and `previous:{season}` rollback behave
identically, and publication-time purge behaviour is unchanged.

**Publication is a phase transition with one irreversible point.** KV offers
ordered writes, not a transaction, and the design says so rather than
pretending otherwise:

1. active-version read;
2. idempotency and completed-version reads, over the active version's own
   recorded inventory;
3. active-source-updated-at read;
4. snapshot-set contract validation;
5. inactive version writes;
6. exact-inventory write, completion check and metadata writes;
7. **`setActiveVersion` — the commit point, and deliberately the final storage
   write that decides what serves**;
8. post-commit previous-pointer maintenance;
9. post-commit cache purge.

Before step 7 the new release is not serving; after it, it is.
`SnapshotPublisher` is the only component that knows which side of that line a
run ended on, so it is where expected operational failures are converted into
bounded `PublicationResult` values instead of rejected promises. Every failure
in steps 1–7 returns `failed` (or `rejected` for a contract violation),
preserves **both** pointers, leaves any partial version inactive and performs
no purge. If the compensating `deleteUnpublishedVersion` also fails, its
rejection is contained and the **original** failure classification is
preserved: the caller needs the phase that actually failed, not the cleanup.
Neither raw error is read, returned or logged.

**The previous pointer is maintained after the commit, never before it.**
Writing it first made a failed commit overwrite the one version a default
rollback can reach with the version that was still serving: the release had not
changed, but the recovery path from it was destroyed — and a rollback whose
target was already active did the same thing while reporting a transition that
never happened. So `previous` is written in step 8, and an already-active
rollback is an explicit bounded no-op (`skipped`, reason `idempotent`) that
writes no pointer, purges nothing and preserves the existing rollback target.

Steps 8 and 9 are post-commit and cannot un-move the pointer, so each reports
its own bounded disposition alongside a truthful `applied`:
`pointerMaintenance: 'failed'` for the maintenance write and
`cachePurge: 'failed'` for the purge. Maintenance failure does not skip the
purge — the release is serving and its stale routes still have to go. The
single `reason` field reports the maintenance failure first when both occurred,
because a stale `previous` silently removes the recovery path while a stale
cache is visible and self-correcting.

**Rollback is contained the same way.** It is the operation an operator reaches
for during an outage, so every expected storage or purge failure returns a
bounded result naming the phase — `storage-read` before the commit,
`storage-write` at it, `applied` with a degraded disposition after it — rather
than a rejected promise the caller cannot classify. No raw storage message
reaches a response or a log line.

The purge runs only after the commit point, so it cannot un-publish anything.
A purge that throws or rejects therefore returns **`applied` with a bounded
`cachePurge: 'failed'`** — never `withheld`, never a failure implying the old
release still serves, and with no rollback. `cachePurge` is a closed internal
domain (`not-required | succeeded | failed`) so a caller switches over a value
rather than parsing a warning string, and the publication reason vocabulary is
likewise closed, so an adapter's own category string can never become the
published reason. Nothing about the public v1 contract changes.

**A broken validator and a rejected candidate are different facts.** A
validator that _returns issues_ has examined the documents and found them
wanting: that is a genuine `rejected`, and the candidate is declined. A
validator that _throws_ has examined nothing — it is a broken dependency, like
any other operational failure, and returns `failed`. Collapsing the two would
be more than imprecise: `SynchronizationService` diverts only `failed`
publications to its failure path, so a thrown validator reported as `rejected`
would record a completed run and mark every due job successful while nothing
was published, suppressing retries until the next cadence and hiding the
breakage. Neither branch exposes the exception.

The guarantee is deliberately stated as **expected operational failures are
contained**, not as "nothing can throw". An arbitrary programmer defect is not
claimed to be impossible, because the only honest report for one would have to
say whether publication committed — and nothing outside the publisher can know
that. `CoordinatedSeasonPublication` therefore does not wrap the publisher in a
catch that would have to guess; it returns the publisher's truthful result,
and a committed release whose purge failed stays `published`.

**`hasResults` is an exact cross-resource assertion, not a local flag.** The
calendar states whether a round's classification is available and the client
acts on it: with nothing cached, a `false` flag means the classification is
never requested at all. The flag must therefore equal, exactly, whether that
round has a selected race result carrying an actual classification. Availability
means `final` or `provisional`; `unavailable` is the contract's meaningful
absence for a session that has not run, and `unknown` establishes nothing, so
neither asserts availability — the same fail-towards-not-fabricating rule the
event-status table uses. Both mismatch directions fail closed: a classification
published under a `false` flag would be invisible, and a `true` flag with no
classification advertises data that does not exist. No flag is rewritten and no
result is fabricated or discarded to repair the disagreement.

**Grand Prix round and Grand Prix id are independently unique.** The local
database keys `grand_prix` on `id` _and_ carries `UNIQUE(season, round)`, so
they are two separate constraints and both are checked. Two rounds sharing one
id would silently overwrite each other on write and the stored season would
lose a round.

Duplicate detection is one mechanism over a closed set of identity categories —
driver, constructor, circuit, event, event round, session, race result, race
result round, race result entry, driver standing, constructor standing, driver
season entry and constructor season entry — each one an identity the domain
model defines and persistence keys a single row on. Documented multiplicity is
preserved rather than outlawed: a driver may hold several `driverEntries` rows,
because mid-season participation is modelled as split spans keyed by their own
`id` (GridView_Domain_Model.md §6.7, decision M6), so the _entry ids_ are
checked and the driver ids are not; and a circuit's `lapRecord` may name a
driver outside the current grid, so it is not an identity of this season at all.

**A season entry has two independent stored identities, and both are checked.**
`constructor_season_entries` keys rows on the entry's own `id` and additionally
carries `UNIQUE(season, constructorId)`. Only the second was checked, so two
entries naming different constructors under one entry `id` satisfied the UNIQUE
constraint while still colliding on the primary key — the exact collision the
driver side already rejected, because `driver-season-entry` was keyed on
`entry.id`. Both entry collections are now checked on both of their own
identities, symmetrically, and the documented multiplicities are unaffected: a
driver may still hold several entry rows for split participation spans, and a
circuit's `lapRecord` may still name a driver outside the current grid.

**Generation itself is contained.** Preflight settles every reference, but
generation also derives values from caller inputs it cannot vouch for, so the
call is guarded and an unexpected defect becomes a bounded `generation-failed`
withheld outcome. The thrown value is never read or logged, the publisher is
never reached, no pointer moves and the prior active release keeps serving. The
guard is around generation only: once the publisher has been reached, its own
result is returned unchanged and never reinterpreted.

**The all-or-nothing publication contract is not weakened.** The generator
derives every document from one whole season, so a partial run simply does not
publish: it is represented explicitly and withheld with a bounded gap reason.
A cancelled run, a rejected plan, an unavailable planned resource, a missing
required resource, a calendar round without a race classification, an
inconsistent set of references and a failed generation are all distinct, and
none of them reaches the publisher. A publisher failure is
returned as-is — nothing compensates, rolls forward or republishes — so the
prior active release keeps serving.

Publication metadata (`contentVersion`, `mediaVersion`, `attributionVersion`,
`sourceUpdatedAt`, the season label), the generation timestamp and the release
version are **inputs**, not derivations. See D13.

**A rejected publication is not automatically a successful synchronization.**
`publish` returns four statuses, and only `failed` used to take the failure
path. Everything else — including a candidate refused for failing contract
validation, and an active version that read back incomplete — was recorded as a
completed run: `lastCompletedAt` advanced, every due job was marked successful
and one `sync.completed` line was emitted, so the next cadence saw nothing due
and a season that could not be published looked healthy until an operator read
the publication status by hand.

Exactly one rejection is benign:

| Publication rejection                       | Synchronization consequence                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `older-source-updated-at`                   | Benign completed no-op                                        |
| `contract-validation`                       | Failed synchronization                                        |
| `active-version-incomplete`                 | Failed synchronization                                        |
| Any integrity or malformed-snapshot refusal | Failed synchronization                                        |
| Any future rejection reason                 | Must be classified explicitly; there is no permissive default |

A candidate older than what is already serving is the pacing system working:
nothing needed publishing, completion advances under the existing documented
semantics, due jobs are marked successful and no `sync.failed` line is emitted.

An integrity refusal fails the run: the overall status is `failed`,
`lastCompletedAt` does not advance, no due job is marked successful, one
`sync.failed` line is emitted instead of `sync.completed`, and the publisher's
own precise bounded reason is preserved. Last-known-good is untouched — nothing
published — and the publication's own status stays `rejected` in the result and
in stored sync state, because a declined candidate and a broken dependency are
different facts.

The mapping is a single exhaustive switch over `PublicationReason` with **no
default**, so a new reason is a compile error rather than something that
silently takes the success path. An absent reason fails closed.

An `applied` publication whose post-commit `previous` maintenance failed is
still a completed run — the release is serving — and the run's
`sync.completed` line carries the bounded `pointerMaintenance` disposition so
the degraded rollback path is visible without reading storage.

### D12 - Cancellation contains, and never publishes

A pre-cancelled run performs no reservation, no adapter call, no accounting
write and no publication. A mid-run cancellation stops **scheduling** further
operations; work already in flight is owned by the hardened HTTP boundary,
which received the same signal, and a reservation already granted is not
returned — keeping it is the conservative choice and avoids a release race.

Cancellation and timeout stay distinguishable: `cancelled` is not attempted,
a timeout is `provider-unavailable` and is. A cancelled run is never reported
as `completed`, so a caller cannot read it as a success.

Independent operations may overlap only through an explicit bounded pool with a
hard ceiling. The default is **sequential**, matching the current
synchronization service exactly. There is no `Promise.all` over a plan.

### D13 - G5 and G9 boundaries are respected, not implemented around

**G5 (event-aware scheduling) is untouched.** Scheduling decides what is due;
the coordinator executes an explicit plan. It computes no event offset, no
session-relative window and no recurring cadence, and a test asserts the
coordination modules contain none of the scheduler's primitives.

**G9 (persisted provenance and provisional/reconciled state) is untouched.**
No source role, provenance value or reconciliation state is persisted, and no
schema changes. In particular, `sourceUpdatedAt` for the adopted sources is
GridView's own observation timestamp bound to a stored snapshot revision
([ADR 0020](0020-provider-source-observation-and-reconciliation.md) §1, D1.9),
which requires persisted reconciliation state. Deriving it inside assembly
would implement G9 implicitly, so it is supplied by the caller exactly as the
mock provider supplies it today.

### D14 - The seam is dormant, and stays dormant

No Jolpica adapter and no OpenF1 adapter exists, so **no port is registered
anywhere in production wiring**, and a test asserts that no runtime module
outside `src/providers/coordination/` consumes the coordinator.

`SynchronizationService` is deliberately **not** rewired. Wiring it today would
mean adding a branch that can only ever be empty — no adapter can register a
port, and the mock is not a coordinated source — which is a dead duplicate
orchestration path contradicting the service that actually runs. Activation
waits for a real adapter, and full reconciled operation additionally waits for
G9.

`PROVIDER_MODE` still admits exactly `mock` and `none`; staging is `mock`,
production is `none`.

#### Deep normalized-contract validation is an activation gate

`SnapshotValidator` is **not** a deep per-field OpenAPI validator, and nothing
here should be read as claiming that it is. What `RuntimeSnapshotValidator`
enforces today is:

- snapshot **metadata** validity, against the `SeasonSnapshotMeta` /
  `SnapshotMeta` schema;
- required **top-level shape** of each document — a collection document must be
  an array, any document body must be an object or an array;
- **provider neutrality** — no provider identifier may appear anywhere in a
  document body.

That is structural. It does not check a driver's fields, a standing's points, a
session's timestamps or any other per-field contract detail, and it is not a
substitute for one.

**Deep normalized-contract validation is an adapter responsibility.** The
adapter is the component that normalizes provider data into the public contract
types, so it is the only place with both the provider payload and the
normalization in hand. The coordinator's own containment checks — closed
resource identities, closed outcome and attempt shapes, and
`payloadMatchesResource` binding a payload's identity fields to the resource it
answers — prevent selecting a payload that does not belong to the request. They
do not, and are not intended to, prove the payload satisfies the public
contract field by field.

This is therefore recorded as a **gate on adapter registration and on G4
activation**, not as evidence of reconciliation running today:

- A real Jolpica or OpenF1 adapter **must not be registered or enabled** until
  its normalized outputs pass the authoritative contract validators.
- Until then G4 stays dormant: no port is registered, `SynchronizationService`
  is not rewired, and the mock provider continues to serve the synchronization
  path unchanged.
- The gate belongs to **G1** (live provider mode) and to the adapter work, and
  is open alongside them.

## Consequences

### What this delivers

- The single-call whole-season assumption is superseded by a boundary that
  expresses individual resource operations and independent outcomes, without
  requiring any adapter to manufacture a complete season.
- Source role and capability are decided, centralized and closed.
- Partial success, partial failure and "no usable candidate" are typed,
  attributed and inspectable.
- Selection between a reconciled and a provisional candidate is deterministic
  and depends on declared role alone.
- Provider request accounting is exact: never inflated by work GridView
  declined to send, never doubled for one request serving several consumers.
- Every established guarantee is preserved: atomic publication, last-known-good
  on every failure combination, provider neutrality of the public contract,
  no provider work on a public read, and bounded logs.

### What stays dormant

No adapter, no provider DTO, no live provider mode, no provider request, no
cron trigger, no Cloudflare resource, no binding, no deployment, no credential
and no schema change follows from this decision. Nothing was fetched and no
provider was contacted.

### Still open

**G5 remains open** — no event-aware scheduling or cadence calculation.
**G9 remains open** — no persisted provenance and no provisional/reconciled
record state. **G-l remains open** — the mapping dataset is still limited to
identifiers already recorded in Provider Evaluation §8. **G1 and G3 remain
open** — no live provider mode and no production cron. **Deep
normalized-contract validation for a real adapter remains open** and is an
activation gate on registering one (D14). Both adapters remain unimplemented,
OpenF1 remains fail-closed pending a justified maximum-session-duration bound,
and nothing here authorizes production synchronization, deployment or public
release. Every EUR 0 budget,
non-commercial, licensing, attribution and ShareAlike conclusion of
[ADR 0019](0019-formula-one-provider-legal-gate.md) is unchanged.

**G4 is closed as a dormant coordination mechanism, not as working
reconciliation.** Real multi-source synchronization is not operating, has never
run, and cannot run until an adapter exists.

## Alternatives considered

| Alternative                                                                | Why rejected                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep `fetchSeasonSource` and let one adapter merge both sources internally | Makes the adapters mutually dependent, which §10.10 forbids, and hides the selection decision inside the component least able to justify it                                        |
| Let each adapter declare its own role or authority                         | Role is a property of the source, decided by ADR 0019. An adapter that could declare itself reconciled could overwrite reconciled data with provisional data                       |
| Publish whatever subset coordination produced                              | Weakens the all-or-nothing publication contract and can replace a complete active release with an incomplete one. Partial coordination is represented instead, and simply withheld |
| Count an attempt per derived consumer                                      | Inflates modelled quota usage for one physical request and would make the accounting unusable for cost reasoning                                                                   |
| Canonicalize a duplicate plan entry                                        | Hides a caller defect and silently changes what was asked for. Rejecting the plan fails closed with nothing attempted                                                              |
| Wire the coordinator into `SynchronizationService` now                     | Every branch would be unreachable — no adapter can register a port — producing a dead duplicate orchestration path beside the service that actually runs                           |
| Derive `sourceUpdatedAt` during assembly                                   | That is the observation state ADR 0020 §1 defines, which requires persistence. Implementing it here would be G9 by stealth                                                         |

## References

- [`../technical/GridView_Provider_Evaluation.md`](../technical/GridView_Provider_Evaluation.md) §10.2, §10.9, §10.10, §11.1, Appendix D.3
- [`../technical/GridView_Backend_Scheme.md`](../technical/GridView_Backend_Scheme.md) §8.1, §15, §16, §23.3
- [`../technical/GridView_Implementation_Plan.md`](../technical/GridView_Implementation_Plan.md) §14.0.8, §14.3
- [`0020-provider-source-observation-and-reconciliation.md`](0020-provider-source-observation-and-reconciliation.md) §5 (D5.1-D5.8), implementation obligations 5 and 7
- [`0021-hardened-provider-boundary-and-durable-object-rate-limiter.md`](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md) — the reservation and transport authority this seam sits above
- [`0022-curated-provider-identifier-mappings.md`](0022-curated-provider-identifier-mappings.md) — the fail-closed identity boundary this seam contains
