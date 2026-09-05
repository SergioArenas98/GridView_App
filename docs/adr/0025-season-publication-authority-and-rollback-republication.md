# ADR 0025: Season publication authority and rollback republication

- Status: Accepted
- Date: 2026-09-05

> **What "Accepted" means here.** This ADR records **architecture and product
> decisions for a mechanism that does not exist yet**. It authorizes a design,
> not an implementation. It provisions no Cloudflare resource, creates no
> Durable Object class, binds nothing, deploys nothing, activates no authority
> mode and contacts no provider. `snapshotRevision`
> ([`../publication/snapshot-revision.ts`](../../services/edge-api/src/publication/snapshot-revision.ts))
> keeps its **no production caller** status unchanged. `PROVIDER_MODE` remains
> `mock | none`; `recordedProvisionalSessionEndBound` remains `null`. Phase
> 9B-6 and gap **G-i** remain **open** after this ADR, exactly as before it.
> Everything this ADR authorizes for *implementation* is scoped in §"Delivery
> plan" below, and every step after the first requires its own separate,
> explicit authorization.

## Context

### Where Phase 9B-6 stopped

Phase 9B-6 (PR 14, merged as `9e455c5`) implemented the **inert half** of
`snapshotRevision`: a canonical, schema-constructed serialization of each
snapshot key's normalized public `data`, hashed deterministically
(`sha256:<64 hex>`, prefixed `gv-canon/1`). It has no production caller. The
second half — binding a `snapshotObservedAt` to that revision and publishing
it under `meta.sourceUpdatedAt` — is specified by
[ADR 0020](0020-provider-source-observation-and-reconciliation.md) D1.9-D1.11
and was recorded as **blocked**, not implemented:

> "D1.10 is not reachable with the current architecture. The assignment must
> be computed pre-commit from the pair the active pointer names, and two
> publications for one season can both reach `SnapshotPublisher`... Workers KV
> offers no compare-and-set and no cross-isolate lock (ADR 0007, ADR 0010),
> and a read-before-write check, a last-write-wins race or an in-isolate mutex
> is not a serialization guarantee."
> — ADR 0020, "D1.9-D1.11 are not implemented, and D1.10 is blocked"

Closing that block requires **something that genuinely serializes the
assignment**. [ADR 0007](0007-versioned-kv-publication-active-pointer.md) and
[ADR 0010](0010-workers-kv-consistency-limitation.md) already establish why
Workers KV cannot be that something: it is eventually consistent, offers no
multi-key transaction and no conditional write.

### Why a state machine on top of KV is not enough either

Before drafting this ADR, a read-only design-safety pass evaluated whether a
`prepare`/`finalize` protocol with an in-memory single-flight guard and a
durable operation epoch, layered **on top of** the existing two Workers KV
pointer writes (`active:{season}`, `previous:{season}`), could close D1.10
without a platform-level change. It could not, for two independently
confirmed reasons:

1. **A same-token retry admitted while `phase === 'committing'` can issue a
   second, independent external write.** Because an ordinary Durable Object
   input gate closes only around the object's **own transactional storage**
   — *"While a storage operation is executing, no events shall be delivered
   to a Durable Object except for storage completion events"*
   ([Durable Objects: In-memory state](https://developers.cloudflare.com/durable-objects/reference/in-memory-state/),
   accessed 2026-09-05) — and does **not** close around an awaited KV-binding
   call, a retry for the same token can be delivered and start a second
   `KV.put(active, X)` while the first is still in flight, on one live
   instance, with no reset required.
2. **Workers KV documents no ordering guarantee between two independently
   dispatched writes to the same key.** *"If concurrent writes are made to
   the same key, the last write will take precedence... concurrent writes to
   the same key can end up overwriting one another"*
   ([Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/),
   accessed 2026-09-05). Nothing ties which write was issued first, by
   application logic, to which write lands last. Once a stale write is in
   flight, it can land after a **later, already-committed** operation and
   silently revert `active` to an older version.

No combination of `blockConcurrencyWhile`, an in-memory single-flight guard or
a durable operation epoch closes the second point, because none of them can
retroactively cancel or fence an external KV write that a terminated Durable
Object instance already dispatched. This is elaborated in **§"Safety
reasoning: why KV cannot be the authority"** below. The conclusion the design
pass reached is the premise of this ADR: **as long as the pointer's commit
point is an external Workers KV write, no state machine can prove the two
safety properties this design needs.**

### The mechanism this ADR authorizes

A Durable Object's own storage is documented as *"fast, transactional, and
strongly consistent"*
([What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/),
accessed 2026-09-05), and one is already provisioned in this repository —
`ProviderRateLimiter`
([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md)).
This ADR authorizes a **second, unrelated** Durable Object identity that makes
its own storage — not Workers KV — the authoritative decision point for what
is active, per season.

### Product authorization for rollback

The product owner has separately authorized, **in principle**, that rollback
must become **republication of historical public data as a new immutable
version**, rather than a direct flip of the active pointer to an old version:
it must reassign fresh per-key `snapshotObservedAt` values relative to the
currently active revisions, commit through the same protocol as ordinary
publication, and never contact a provider. This is **Model 1** in
§"Rollback Model 1: exact application" below. Models that keep rollback as a
direct pointer flip, or that introduce a public activation-epoch field, are
rejected for this phase (see §"Rejected and superseded alternatives").

## Decision

### D1. Serialization identity

One `SeasonPublicationSequencer` Durable Object identity per season:

```text
idFromName(String(season))
```

Unrelated seasons remain independently concurrent — no operation on season
`2025` ever blocks, reads or writes state belonging to season `2026`.

`ProviderRateLimiter` is **not reused**. It coordinates outbound request
budget per *provider source*; this coordinates publication authority per
*season*. The two have different identity domains, different consistency
requirements and different lifecycles, and conflating them would make an
unrelated provider-limiter change a publication-authority change and vice
versa.

### D2. Authoritative pointer state

The per-season Durable Object's own storage becomes the **sole authoritative
source** for:

- `activeVersion`
- `previousVersion`
- the current `snapshotRevision` per snapshot key
- the current `snapshotObservedAt` per snapshot key
- publication-operation state (`phase`, `priorVersion`, `candidateVersion`,
  `preparedAt`, `deadline`)
- the operation epoch and the caller-facing operation token

The authoritative active/previous transition — the moment a candidate version
becomes what the season serves — occurs as **one atomic Durable Object
storage transaction**. There is **no external Workers KV pointer write inside
the authoritative commit.** The public commit point is the successful atomic
transition of the DO's own storage from the prior `(activeVersion,
previousVersion)` pair to the candidate pair. See §"Safety reasoning" for why
this specifically closes the problem KV-only designs could not.

### D3. Immutable payload storage

Versioned snapshot documents and their per-version inventory remain immutable
in Workers KV, unchanged from
[ADR 0007](0007-versioned-kv-publication-active-pointer.md):

```text
snapshot:{season}:{version}:{document}
snapshot:{season}:{version}:__inventory
```

The caller (the publisher, driven by the synchronization service or an
operator rollback request) still:

1. obtains normalized candidate data (from the provider path, or — for
   rollback — from a historical version, per §"Rollback Model 1");
2. computes `snapshotRevision` per document;
3. calls `prepare`;
4. receives per-key `snapshotObservedAt` assignments back from the DO;
5. finalizes, validates and writes the immutable versioned documents and
   inventory to KV, with the assigned timestamps baked into each document's
   `meta.sourceUpdatedAt`;
6. calls `finalize`.

The Durable Object never generates provider data, never validates a document
body and never stores a complete snapshot payload. It stores only the
authoritative pointer/revision/operation state named in D2 — bounded per
season, not proportional to document count or history depth.

### D4. Two-phase publication protocol

#### `prepare(season, candidateVersion, perKeyRevisions, sourceOrderingInput)`

The Durable Object, in one atomic storage transaction:

- examines its own currently committed state (`activeVersion`, and the
  current `snapshotRevision`/`snapshotObservedAt` per key);
- evaluates candidate staleness against that state (the existing ADR 0007
  rejection rule — a candidate whose ordering input is not newer than what is
  committed is rejected — is preserved, now decided against durable DO state
  rather than a KV read);
- assigns each key's `snapshotObservedAt`:
  - **retains the current timestamp** where the candidate's
    `snapshotRevision` for that key equals the currently active revision for
    that key;
  - **assigns `max(now, previous + 1 ms)`** where it differs — the exact
    D1.10 rule, now computable, because "previous" is read from the DO's own
    strongly consistent storage inside the same transaction that decides the
    new value, not raced against a second, unobserved publication attempt;
- allocates a new, strictly-increasing `operationEpoch` for this season and a
  fresh caller-facing `operationToken`;
- persists a `prepared` operation record: `{epoch, token, priorVersion,
  candidateVersion, preparedAt, deadline}`;
- returns the token and the assigned per-key timestamps to the caller.

Timestamp assignment happens **before** final document construction, because
`meta.sourceUpdatedAt` is baked into each immutable document and the document
cannot be finalized without it.

#### Caller document phase (no Durable Object involvement)

The caller:

- inserts each key's assigned timestamp into its document;
- regenerates every volatile publication and freshness field
  (`requestId`, `generatedAt`, `staleAfter`, the server `stale` flag —
  everything already excluded from the `snapshotRevision` hash input under
  ADR 0020 D1.7);
- validates the final documents against the existing schema/inventory
  discipline ([`GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md));
- writes every version-scoped document and its inventory to KV;
- **never** touches `activeVersion`/`previousVersion` and gains **no**
  commit authority merely by holding a valid token — a token authorizes one
  `finalize` call, nothing else.

#### `finalize(season, token, inventoryDigestOrCompletenessProof)`

The Durable Object, in one atomic storage transaction:

- verifies the current `operationEpoch` and `operationToken` match the
  caller's;
- verifies the operation is still `prepared` (not cancelled, not superseded,
  not expired);
- verifies the supplied completeness proof against what `prepare` recorded;
- records the candidate as `activeVersion` and the version that was active
  immediately before this operation as `previousVersion`;
- commits the per-key `snapshotRevision`/`snapshotObservedAt` state assigned
  during `prepare`;
- marks the operation `committed`.

**No Workers KV pointer write occurs during `finalize`.** A stale, cancelled
or superseded token is rejected **before** any authoritative state change —
never partially applied, never silently replayed.

### D5. Prepared-operation cancellation

A `prepared` operation has not crossed commit intent and may be cancelled or
replaced safely, under a durable `operationEpoch` — not a phase string alone,
which cannot distinguish a genuinely new prepared operation from a stale one
that happens to share the same phase name:

- **Explicit cancellation** requires the caller's matching token, checked
  against the current epoch.
- **A later candidate may replace a `prepared` operation.** The old epoch is
  retired and the new one installed in **one** atomic storage write — never
  two, because a window between them is exactly the ambiguity this design
  exists to remove.
- **Deadline expiry invalidates only a `prepared` token.** Each prepared
  record carries `preparedAt`/a deadline; a later `prepare` or `cancel` call
  treats an expired token as already cancelled before admitting a
  replacement.
- **Expiry never authorizes a pointer transition.** Time is never read as a
  lease that permits `finalize` to proceed, or that permits any automatic
  write to `activeVersion`/`previousVersion`. It only ever narrows what
  counts as "the current prepared token" for **admission** of a *new*
  `prepare`.
- **An old token cannot finalize after its epoch is retired.** `finalize`
  re-validates epoch and token as the first synchronous action of its own
  atomic transaction, so a delayed `finalize` call for a superseded operation
  is rejected with no storage mutation and no possibility of it having
  already passed validation before the epoch changed underneath it.
- **Partially written documents remain unreachable.** This is inherited
  unchanged from ADR 0007: documents are written under an immutable
  per-version key before any pointer moves, and public readers resolve only
  through the authoritative `activeVersion`/`previousVersion` the DO reports
  — never by enumerating versions. An abandoned `prepared` operation's
  documents are simply never pointed to.
- **Orphan cleanup is allowed only from `cancelled`,** and must independently
  re-verify, atomically, at the moment of deletion, that the operation's
  epoch is still `cancelled` — not `committing` or `committed` — as a second,
  defense-in-depth guard rather than relying solely on the cancellation path
  above. This extends the existing `deleteUnpublishedVersion` guard (which
  already refuses the active version) to also refuse any version whose
  durable phase is not `cancelled`.
- **A dead caller cannot block a season forever** — for `prepared` operations
  only, via deadline expiry. This explicitly does **not** extend to
  `committing` or `recovery-required` (see D9): pre-commit abandonment is
  provably harmless to auto-clear; post-ambiguity abandonment is not, and
  that asymmetry is intentional.

**There is no lease over pointer mutation anywhere in this design.**

### D6. Public read path

The public router resolves `activeVersion` and (where needed, for rollback
default-target resolution) `previousVersion` through a call to the
per-season Durable Object — never through an independent Workers KV read of
a pointer key.

It then reads the selected immutable versioned document from KV, as today.

**If the active version's requested document is not yet visible** because KV
propagation of that *document* (not the pointer — there is no separate
pointer to propagate) is incomplete:

- the router **may** retry against the `previousVersion` the same
  authoritative DO lookup returned;
- the fallback is **bounded** (a fixed, small retry/fallback budget, not an
  unbounded search) and **observable** (an operational event, per D11);
- it **never** rewrites or reinterprets the authoritative pointer — the DO's
  answer to "what is active" is not questioned or second-guessed by this
  fallback, only which document is *servable right now* is affected;
- the response **retains the repository's existing stale/degraded semantics**
  (ADR 0010's existing "an edge location may briefly serve the older active
  version during propagation" trade-off, now scoped to the document, not the
  pointer).

**If the Durable Object binding or the authoritative lookup call itself is
unavailable:**

- the router does **not** silently fall back to trusting a legacy KV active
  pointer — there is no live legacy pointer to trust after cutover (D7);
- it returns the repository's existing bounded fail-closed/service-unavailable
  response shape, unchanged in kind from how an unreadable storage
  dependency is already handled elsewhere in this codebase;
- the offline-first Flutter client retains its last valid local snapshot
  (existing behavior, [ADR 0005](0005-snapshot-conflict-and-freshness.md) is
  unaffected).

**The latency and availability trade-off is stated honestly, not minimized:**
every authoritative public version resolution now depends on a call to one
per-season Durable Object, which — unlike Workers KV's global edge read —
is coordinated from a single location
([What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/):
*"since transactions must be coordinated in a single location, clients on the
opposite side of the world from that location will experience moderate
latency"*, accessed 2026-09-05). This ADR does **not** hide that cost behind
an unmeasured caching layer.

**No pointer caching is introduced by this ADR.** A cache in front of the DO
lookup would reintroduce exactly the staleness/authority ambiguity this
design exists to remove, unless its own consistency model — invalidation
trigger, staleness bound, and what a public reader is told when the cache and
the DO disagree — is fully specified and reviewed on its own terms. That is
deferred to a future ADR, only if measured latency from the Mechanism/
Integration PRs (see "Delivery plan") shows it is needed.

### D7. Legacy KV pointers

The existing keys `active:{season}` and `previous:{season}` are **migration
inputs only, after cutover**:

- At staging activation (a separate future authorization — see "Activation
  boundary"), their last valid values seed the new Durable Object's state
  through a **one-time, operator-controlled migration procedure**.
- **After successful cutover:** no publication or rollback operation writes
  these keys; public routing does not read them; they are **not** a fallback
  authority under any circumstance, including Durable Object unavailability
  (D6).
- They **may** be retained temporarily, unwritten, for audit or for rolling
  back *the deployment of this mechanism itself*, then retired under an
  explicit future cleanup decision.

**They are not described as a live best-effort projection**, and no future
implementation may reintroduce them as one without reopening this ADR.
Keeping a second writer, or a second thing anything treats as authoritative,
recreates precisely the ambiguity D2 removes — a stale legacy write landing
in a key nothing reads is inert; a stale legacy write landing in a key
*anything* still consults, even as a fallback, is not.

### D8. Rollback Model 1: exact application

Rollback is no longer a direct flip of `active:{season}` to an old immutable
version. It is **republication**:

1. Read the selected historical version's documents.
2. **Copy verbatim, without contacting a provider:** the stable, normalized
   public `data` payload per document — exactly the fields already declared
   as the `snapshotRevision` hash input
   (`src/publication/canonical/snapshot-schemas.ts`): calendar rounds,
   results, standings, registries, curated `content:manifest` fields,
   `contentVersion`/`mediaVersion`. These are copied from the **historical**
   version, never regenerated from a live provider fetch and never
   regenerated from present-day generation logic (which may not be able to
   reproduce a historical season's exact prior state).
3. Create a new candidate version identity.
4. **Regenerate, never copy:** everything already excluded from the
   `snapshotRevision` hash under ADR 0020 D1.7 — `requestId`, `generatedAt`,
   `staleAfter`, the server `stale` flag, ETag inputs — set fresh for this
   rollback's publication time. The exact per-version inventory is freshly
   computed and re-verified for completeness against what this rollback
   actually writes; it is never copied from the old version's inventory.
5. Compute `snapshotRevision` for each restored key using the same canonical
   hashing already implemented for ordinary publication ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
   D1.7) — Model 1 introduces **no new revision-computation mechanism**.
6. Compare each restored key's revision against the **currently active**
   version's revision for that same key (not against the historical
   version's own old revision).
7. **Retain the current `snapshotObservedAt`** for a key whose restored
   revision equals the currently active one — this key did not actually
   change across whatever regression the rollback corrects, and must not
   manufacture spurious churn.
8. **Assign a fresh, strictly monotonic `snapshotObservedAt`** (D1.10's
   existing rule, applied through the same `prepare` mechanism as ordinary
   publication) for a key whose restored revision differs from the currently
   active one.
9. Write a complete new immutable version and inventory to KV.
10. Commit it through the same `prepare`/`finalize` protocol as any other
    publication — rollback has **no separate commit path** and cannot flip
    the authoritative pointer directly.

**No public activation-epoch field is introduced.** The `operationEpoch` in
D2/D4/D5/D9 is internal Durable Object coordination state; it never appears
in a published document or the public contract.

**Operational trade-off, stated plainly:**

- Today's rollback already requires one working KV pointer write.
- This rollback additionally requires enough KV write availability to create
  a **complete new immutable version and its inventory** before any
  authoritative commit is attempted — strictly more pre-commit work than
  today's rollback, which reuses an already-existing version's documents
  verbatim.
- It remains **provider-independent** — no rollback path ever contacts a
  provider.
- Any pre-commit failure (a partial-KV-write outage that stops the new
  version's documents from being fully written) leaves the current release
  serving, inherited for free from the `prepare`/`finalize` protocol, which
  never touches the authoritative pointer before its commit step.
- A partial KV-write outage that would have tolerated today's single pointer
  write may **not** tolerate writing a full new version, so this rollback can
  fail in a scenario today's rollback would have survived. This is an
  accepted cost of Model 1, not an oversight.

### D9. Failure and recovery model

Because the authoritative commit is a single atomic **local** Durable Object
storage transaction:

- there is no ambiguous external pointer commit to reason about;
- there is no blind replay of a Workers KV pointer write, because no such
  write exists in the commit path;
- **no terminated instance can overwrite the authoritative pointer later**,
  because the pointer only ever changes inside the DO's own storage
  transaction, and Cloudflare documents that a request that is still
  accessing a Durable Object's storage during a shutdown is **stopped
  immediately and errors**, rather than allowed to complete silently in the
  background: *"In-flight requests are allowed to finish if they do not
  access a Durable Object's storage. If a request attempts to access a
  Durable Object's storage, it will be stopped immediately and return an
  error to maintain Durable Objects' global uniqueness property."*
  ([Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/),
  accessed 2026-09-05). A `finalize` transaction therefore either commits
  before a shutdown boundary or is stopped and reported as an error — it
  cannot half-commit and it cannot land after the fact;
- duplicate `finalize` calls resolve from the durable operation identity
  (epoch + token), never from a phase string alone;
- the operation token is idempotent: a call for an already-`committed` token
  returns the recorded result rather than re-executing anything;
- a cancelled or superseded token is rejected before any state change;
- **no `blockConcurrencyWhile` call needs to enclose the commit**, because
  the commit is a single fast local storage transaction with no outbound
  network call inside it — see D10 for why `blockConcurrencyWhile` is neither
  necessary nor appropriate here.

**Stated limitation, not glossed over:** the guarantee above covers the
Durable Object's **own storage**. It says nothing about, and this design
deliberately no longer depends on, the fate of any external Workers KV write
— because D2 removes the external pointer write from the commit path
entirely. An `operationEpoch` is a durable fencing value for the DO's own
transitions; it cannot retroactively fence a KV write, because Workers KV
has no conditional/compare-and-set primitive to check it against. This is
exactly why D2 does not merely add an epoch to the *existing* KV-pointer
design — it removes the KV pointer write from the authority path altogether.

Implementation is required to use **SQLite-backed Durable Object storage**
(`storage = "sqlite"`, matching the existing `ProviderRateLimiter`
declaration — required for Durable Objects on the Workers Free plan per
ADR 0021), with the active/previous/epoch/token/phase transition performed as
one indivisible multi-key storage write. The exact call
(`ctx.storage.transaction(...)` or an equivalent single atomic write the
SQLite-backed storage API provides) is a Mechanism-PR implementation detail;
this ADR requires only that it be **one** atomic storage-level operation,
never a sequence of separately-awaited writes with a gap between them where
another caller's synchronous check-and-install (D5, D9) could observe a
half-transitioned state. Ordinary input gates are not claimed to provide this
on their own — they are documented to protect the object's storage calls
from interleaving with each other, not to make a multi-statement sequence of
application logic atomic by themselves; the atomicity must come from the
storage transaction API itself.

### D10. Lifecycle and `blockConcurrencyWhile` — corrected against current documentation

This corrects and narrows an earlier draft of this section, verified against
[Durable Objects: Lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
and [Durable Object State](https://developers.cloudflare.com/durable-objects/api/state/)
(both accessed 2026-09-05). It does **not** repeat the earlier claim that an
awaited external `fetch()` mid-request automatically hibernates or evicts the
object — that is also not accurate. The actual documented picture:

| Fact | Source |
|---|---|
| A Durable Object has five lifecycle states: **Active, in-memory**; **Idle, in-memory, non-hibernatable**; **Idle, in-memory, hibernatable**; **Hibernated**; **Inactive**. | Durable Object lifecycle |
| While a request or event is **still being processed** — including while it is awaiting a subrequest such as `fetch()` or a KV-binding call — the object is in the **Active, in-memory** state, not idle. The **idle**-state, inactivity-based eviction clock (70-140 seconds with no incoming requests or events) applies once nothing is being processed, not while a request is genuinely in flight. | Durable Object lifecycle |
| **Hibernation is a distinct, narrower state**, not a synonym for eviction. It additionally requires **no in-progress awaited `fetch()`**, no pending timer, no in-use WebSocket standard API and no active outbound TCP/WebSocket connection. An in-progress awaited `fetch()` (or KV-binding call, which is implemented as a subrequest) explicitly **disqualifies** the object from hibernating while it is pending — it does not, by itself, either force or prevent ordinary eviction; it simply keeps the object out of the hibernated state specifically. | Durable Object lifecycle |
| **During a genuine shutdown** (a deployment, a runtime update, or the inactivity-eviction timer firing once nothing is in progress): an in-flight request is allowed to finish **if it does not touch the Durable Object's own storage**; one that does is **stopped immediately and errors**, rather than silently completing in the background. A runtime update additionally gives in-flight requests up to 30 seconds to complete. WebSocket connections are terminated on shutdown. | Durable Object lifecycle |
| Only a genuine **persistent** outbound connection (`connect()`, or an outbound WebSocket) is documented to *prevent eviction* for its duration. A one-shot `fetch()` or a KV-binding call is **not** documented to have this property, even while its response is still streaming. | [Outbound connections keep Durable Objects alive](https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/), accessed 2026-09-05 |
| `blockConcurrencyWhile` blocks delivery of **all** other events — not just storage-completion events — for the duration of its callback, including while the callback awaits external I/O: *"All events that were not explicitly initiated as part of the callback itself will be blocked."* It carries a **hard 30-second timeout**; exceeding it resets the object. An uncaught exception inside it also resets the object. | Durable Object State |

**What this means for this design:**

- `finalize`'s commit is a single local storage transaction with no
  subrequest inside it, so none of the fetch/hibernation nuances above are
  relevant to whether it is safe — its safety comes from D9's shutdown
  guarantee for in-flight storage access, not from lifecycle timing.
- `blockConcurrencyWhile` is **unnecessary for the authoritative commit**,
  because there is no external I/O inside it to guard and no concurrent
  in-instance caller problem it needs to solve that the storage transaction
  and epoch check (D4/D5) don't already close.
- `blockConcurrencyWhile` remains **explicitly disallowed** around document
  generation (a caller-side, potentially long-running, KV-writing phase) and
  around any external pointer write, because using it there would either (a)
  block every other caller of that DO id for the duration of unrelated,
  possibly slow work, or (b) risk hitting its 30-second timeout mid-operation
  with no documented guarantee about the fate of whatever external write was
  in flight at that moment — the exact hazard D2 exists to remove, not to
  relocate behind a different API.

### D11. Security, privacy and observability

Bounded, redacted fields only, in every operational event this mechanism
raises:

- `season`
- `candidateVersion`
- `operationEpoch`
- `phase`
- `outcome`
- `latency`
- `fallbackReason`

**Never logged:** complete storage keys, document bodies, provider payloads,
secrets, or stack traces in a public-facing response — unchanged from the
existing structured-logging discipline in
[`GridView_Backend_Operations.md`](../technical/GridView_Backend_Operations.md).

**Operational events required** (mechanism-PR scope to define precisely;
authorized here as a category list):

- `prepare` accepted / rejected (with a bounded rejection reason)
- stale candidate rejected
- token cancelled or superseded
- `finalize` committed
- authoritative lookup unavailable (D6 fail-closed path)
- active-document propagation fallback used (D6 bounded fallback)
- rollback republication committed
- migration/cutover result (D7/D12)

### D12. Activation boundary

**Nothing in this ADR, and nothing in this documentation PR, provisions or
activates this design.** Future activation requires separate, explicit
authorization at each step below (see "Delivery plan"). The expected staging
cutover sequence, recorded here for planning only:

1. Mechanism code merged and unused (no binding, no caller).
2. Staging `SeasonPublicationSequencer` class and binding provisioned.
3. Publication mutators paused.
4. Current valid KV `active`/`previous` state imported once, per season,
   through the operator-controlled migration procedure (D7).
5. Imported version and inventory verified against the DO's newly seeded
   state.
6. Public and administrative authority mode switched to the sequencer.
7. Cron/admin mutators resumed.
8. Concurrent publication, rollback and read-path smoke tests run.
9. Latency, fallback and availability metrics reviewed against D6's stated
   trade-off before any further step is considered.

**Production remains untouched and continues in its current dormant state**
(`PROVIDER_MODE = "none"`, no production Worker deployment implied or
performed by this ADR).

## Safety reasoning: why KV cannot be the authority

Restated concisely as the load-bearing argument for D2, since it is the
reason this ADR exists rather than a smaller patch to the existing
`prepare`/`finalize` sketch:

**The two properties any safe design here must prove:**

1. No two pointer-write sequences can be in flight for the same season at
   once.
2. No write from an earlier or terminated operation can land after a later,
   already-committed operation.

**Against a Workers-KV-pointer design, neither is provable from documented
platform behavior.** (1) fails because an ordinary input gate does not span
an awaited external call (§"Context"), so a same-token retry can start a
second independent write while the first is still in flight — demonstrated
without any instance reset at all. (2) fails because — even granting a
perfect in-memory/durable single-flight guard that closes (1) for one live
instance — no Cloudflare documentation was found stating that a Durable
Object instance's outbound KV write is cancelled on reset/eviction, that
successive instances of one DO identity have any ordering guarantee over
their outbound KV writes, or that Workers KV offers any conditional write a
newer instance could use to fence out an older instance's stale write.
Workers KV documents the opposite: last-write-wins with no causal ordering.
A staging experiment showing this "did not happen" in some number of trials
would not prove it cannot happen — it would bound observed behavior in an
eventually-consistent, explicitly last-write-wins system, which is not the
same claim.

**Against the D2 design, both are provable from documented platform
behavior.** (1) is closed by making the commit a single atomic Durable
Object storage transaction, gated by epoch/token validation performed inside
that same transaction (D4, D5, D9) — a second admission cannot observe a
half-transitioned state, because the object is single-threaded and the
transition is one indivisible storage write. (2) is closed because the only
thing that can change `activeVersion`/`previousVersion` is that same local
storage transaction, and Cloudflare documents that an in-flight request still
accessing a Durable Object's own storage during a shutdown is stopped and
errors rather than allowed to land later (D9's citation). There is no
external write left for an old instance to have "in flight" when it is
reset — the only state that could be ambiguous is the DO's own storage state,
and the platform's own documented shutdown behavior for that specific case is
exactly "stop and error," not "may complete unobserved."

This is why the classification of the preceding read-only safety pass —
which found this problem unresolved for a KV-authoritative design based on
documented Cloudflare behavior available at the time — is answered by this
ADR with an architectural change (moving authority to Durable Object storage)
rather than by additional state-machine logic layered on the same KV write.

## Rejected and superseded alternatives

| Alternative | Disposition |
|---|---|
| **Workers KV as the authoritative pointer** (the design this ADR replaces) | **Rejected.** Cannot satisfy either safety property above; see "Safety reasoning". |
| **A KV compare-and-set or lease design** | **Rejected — does not exist.** Workers KV's `put()` accepts no version precondition and no conditional-write token in current documentation. A design assuming one is not implementable. |
| **Timestamp allocation without commit authority** (assigning `snapshotObservedAt` from a component that does not also hold pointer-commit authority) | **Rejected.** D1.9 requires the revision/timestamp pair to be assigned atomically with the same operation that could commit it; splitting the two reintroduces exactly the interleaving ADR 0020 identified as the D1.10 blocker. |
| **Blind replay of an ambiguous Workers KV pointer write on recovery** | **Rejected.** Proven unsafe by the reproduced duplicate-replay race in "Context"; a recovering instance cannot know whether a prior instance's external write already landed, and KV gives it no way to find out safely. |
| **Silent KV-pointer fallback when the Durable Object is unavailable** | **Rejected.** D6 requires a bounded, fail-closed response instead. A silent fallback to a legacy pointer that nothing else writes or verifies would let a stale, unmaintained value quietly become load-bearing again. |
| **`blockConcurrencyWhile` around document generation or an external pointer write** | **Rejected for that scope**, for two independent reasons: it blocks every other caller of the DO id for the duration of work that can be slow (throughput anti-pattern), and it carries a 30-second reset with no documented guarantee about an external write in flight at the moment it fires — seef D10, D9. |
| **A public activation-epoch field** | **Rejected for this phase.** `operationEpoch` is internal Durable Object coordination state (D2, D9) and must not appear in any published document or the public contract (D8). |
| **Direct pointer-flip rollback** (the pre-existing rollback design) | **Superseded by Model 1** (D8). Rollback now republishes historical data as a new immutable version through the same `prepare`/`finalize` protocol as ordinary publication; it never flips `activeVersion` directly. |

## Failure-state model

Four distinct identities are used throughout this design, and conflating any
two of them is how the duplicate-replay race in "Context" happens in the
first place:

| Identity | Lifetime | Purpose |
|---|---|---|
| `operationToken` | One `prepare()` call | Caller-facing handle, presented back to `finalize`/`cancel` |
| `operationEpoch` | Durable, monotonic, per season | The actual fencing value every transition checks; increments on every admitted `prepare` |
| In-memory single-flight guard | One live Durable Object instance | Prevents duplicate concurrent *in-instance* callers from racing each other during one call; never durable, never trusted for recovery |
| Durable operation record | Durable, until superseded | `{epoch, token, phase, priorVersion, candidateVersion, preparedAt, deadline}` — sole restart-recovery source of truth |

### State transition table

| State | Permitted caller | Durable mutation | External KV action | New candidate admitted? | Cleanup allowed? | Restart behavior | Idempotent retry? |
|---|---|---|---|---|---|---|---|
| `idle` | anyone | none | none | yes — any `prepare` | n/a | resumes `idle` | trivially |
| `prepared` | holder of current epoch/token | writes epoch/token/prior/candidate/deadline in one transaction | none | only as an atomic *replacement* of this record | not yet | resumes `prepared`; deadline re-evaluated | `prepare` retried is a fresh epoch; old one retired |
| `committing` | holder of current epoch only | phase → `committing`, then → `committed`, in the same atomic transaction as the pointer change | **none** | no | no | resumes `committing`; per D9, either the transaction already completed or the platform stopped it and errored — never both ambiguous | idempotent by construction (D9) |
| `committed` | n/a for this epoch | epoch marked committed | none | yes — next `prepare` | yes, for epoch(s) it superseded | resumes `committed` | trivially |
| `cancelled` | n/a | epoch marked cancelled | none | yes | yes, re-verified at deletion time | resumes `cancelled` | trivially |
| `recovery-required` | admin only | none automatic | none automatic | **no** | no | resumes `recovery-required` until operator clears it | not applicable by design |

`recovery-required` is retained in the vocabulary as a defensive terminal
state for an operation-level invariant violation detected by the Mechanism
PR's own tests (for example, a durable record the code cannot reconcile with
any defined transition) — **not** because an ambiguous external write is
expected under this design. Under D2, the class of failure that previously
motivated `recovery-required` (an ambiguous KV write) no longer exists,
because there is no external write in the commit path to be ambiguous about.

## Testing obligations

Deterministic, application-logic tests the Mechanism PR must include:

- Two simultaneous same-token `finalize` calls resolve to one committed
  result, never two writes.
- A same-token retry arriving while the original operation's transaction is
  in progress joins/no-ops rather than starting a second transition.
- A `prepare` for a new candidate is rejected while an operation for the same
  season is `committing`.
- A stale (superseded) epoch's `finalize` is rejected before any storage
  mutation.
- A `prepared` operation replaced by a later `prepare` durably retires the
  old epoch atomically with installing the new one; a subsequent
  `finalize(oldToken)` is rejected.
- A stale `finalize` after a `prepared`-then-cancelled token is rejected, no
  version is deleted while its status is ambiguous.
- Rollback Model 1: no provider port is ever invoked.
- Rollback Model 1: a key whose restored content hash matches the currently
  active version's hash keeps its currently recorded `snapshotObservedAt`
  unchanged; a key that differs receives a new, strictly greater timestamp
  for that key only.
- Rollback Model 1: a pre-commit failure (mid new-version write) leaves the
  existing active release completely untouched and serving.
- Router: authoritative-lookup-unavailable path returns the existing bounded
  fail-closed shape and never reads a legacy KV pointer as a substitute.
- Router: bounded, observable fallback to `previousVersion` when a document
  has not yet propagated, and that this never changes what `finalize`
  considers active.

**Tests that cannot prove Cloudflare platform behavior** — must be labeled as
demonstrating application logic only, never as proof of the underlying
platform guarantee:

- Any test asserting that a Durable Object shutdown does or does not stop an
  in-flight storage-accessing request — this is asserted by Cloudflare's own
  documentation (D9's citation) and cannot be independently forced or
  verified from application code in this repository's test suite.
- Any staging experiment demonstrating the duplicate-replay race did or did
  not occur in N trials — bounds observed behavior only.
- Any test asserting a Durable Object "stays alive" for a given duration
  absent the documented lifecycle rules in D10 — lifecycle timing is
  platform-controlled.

## Consequences

- Phase 9B-6's D1.9-D1.11 block (ADR 0020) has a **named, platform-grounded
  path to closure** that does not require an undiscovered Cloudflare
  guarantee: moving authority to Durable Object storage, which is already
  documented as strongly consistent and already provisioned elsewhere in this
  repository as a pattern (`ProviderRateLimiter`).
- The public read path gains a new dependency (a per-season Durable Object
  call) and a new, honestly-stated latency/availability trade-off (D6).
  Nothing in this ADR pretends that cost away.
- Rollback becomes materially more expensive pre-commit (a full new version
  write, not a single pointer flip) in exchange for provider-independence and
  freshness-rule consistency with ordinary publication (D8).
- `active:{season}`/`previous:{season}` stop being anything code depends on,
  after cutover — a deliberate simplification of the KV Consistency Boundary
  ADR 0010 originally had to describe.
- **Nothing here is implemented.** `snapshotRevision` still has no production
  caller; D1.9-D1.11 remain unimplemented; G-i remains open; Phase 9B-6 is
  not closed by this ADR.

## Reopening conditions

| Trigger | Consequence |
|---|---|
| Cloudflare documents a Workers KV conditional/compare-and-set write, or an explicit cross-instance outbound-write ordering guarantee for Durable Objects | Re-evaluate whether D2's move to DO-storage authority is still the minimal design, or whether a lighter KV-based mechanism now suffices |
| Measured latency from the Mechanism/Integration PRs shows the D6 read-path cost is unacceptable | Revisit pointer caching under its own fully-specified consistency model, per D6 |
| The Mechanism PR's own tests cannot establish the D9 shutdown-guarantee assumption behaves as documented in this repository's actual Workers runtime version | Reopen D9 and D2 together before proceeding to the Integration PR |
| An implementation discovers the SQLite-backed storage transaction API does not provide the single-atomic-write property D9 assumes | Reopen D9; do not proceed to Integration without an alternative atomic mechanism |
| A future phase needs cross-season coordination (e.g. a shared content manifest spanning seasons) | Reopen D1; a single per-season identity may not be the right shape |

## References

- [ADR 0005](0005-snapshot-conflict-and-freshness.md) — snapshot conflict rule and freshness semantics, qualified by this ADR's rollback timestamp rule
- [ADR 0007](0007-versioned-kv-publication-active-pointer.md) — the versioned-KV publication design this ADR partially supersedes
- [ADR 0010](0010-workers-kv-consistency-limitation.md) — the KV consistency limitation this ADR's D2 responds to
- [ADR 0020](0020-provider-source-observation-and-reconciliation.md) — D1.7-D1.11, the blocked observation-clock mechanism this ADR unblocks
- [ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md) — the existing, unrelated Durable Object this ADR's D1 explicitly does not reuse
- [`GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md) — the publication algorithm this ADR revises
- [`GridView_Backend_Operations.md`](../technical/GridView_Backend_Operations.md) — the operational runbook this ADR revises
- [Durable Objects: What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/) — accessed 2026-09-05
- [Durable Objects: Lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) — accessed 2026-09-05
- [Durable Objects: In-memory state (input/output gates)](https://developers.cloudflare.com/durable-objects/reference/in-memory-state/) — accessed 2026-09-05
- [Durable Object State (`blockConcurrencyWhile`)](https://developers.cloudflare.com/durable-objects/api/state/) — accessed 2026-09-05
- [Outbound connections keep Durable Objects alive](https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/) — accessed 2026-09-05
- [Workers KV: Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/) — accessed 2026-09-05
- [Workers KV: How KV works (consistency model)](https://developers.cloudflare.com/kv/concepts/how-kv-works/) — accessed 2026-09-05
