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

A `429` remains an attempted, source-attributed, rate-limited request; a
limiter deferral remains not attempted and may carry `retryAt` as **data
only** — nothing in this phase schedules on it, because that is G5.

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

### D7 - One transport request is counted exactly once

An outcome carries a bounded **transport reference** identifying the single
physical request it was derived from. One response legitimately serving several
derived resources reports the same reference from each, and the coordinator —
never the adapter — counts it once while crediting every job category it
served. The same reference claiming a _different attempt outcome_ cannot
describe one request, so the later claim fails closed as a
`coordination-invariant` violation.

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
lost. One failing resource never blocks an independent one, a failure stays
attached to its exact resource and source, and a healthy subset never conceals
a coordination invariant violation.

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

**The all-or-nothing publication contract is not weakened.** The generator
derives every document from one whole season, so a partial run simply does not
publish: it is represented explicitly and withheld with a bounded gap reason.
A cancelled run, a rejected plan, an unavailable planned resource, a missing
required resource and a calendar round without a race classification are all
distinct, and none of them reaches the publisher. A publisher failure is
returned as-is — nothing compensates, rolls forward or republishes — so the
prior active release keeps serving.

Publication metadata (`contentVersion`, `mediaVersion`, `attributionVersion`,
`sourceUpdatedAt`, the season label), the generation timestamp and the release
version are **inputs**, not derivations. See D13.

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
open** — no live provider mode and no production cron. Both adapters remain
unimplemented, OpenF1 remains fail-closed pending a justified
maximum-session-duration bound, and nothing here authorizes production
synchronization, deployment or public release. Every EUR 0 budget,
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
