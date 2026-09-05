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
> Everything this ADR authorizes for *implementation* is scoped in
> §"D12. Activation boundary" below and the separated-future-work list in
> [`GridView_Implementation_Plan.md`](../technical/GridView_Implementation_Plan.md)
> §14.0.11, and every step after the first requires its own separate,
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
   ([Durable Objects Glossary, "input gate"](https://developers.cloudflare.com/durable-objects/reference/glossary/),
   accessed 2026-09-05, re-verified 2026-09-05) — and does **not** close around an awaited KV-binding
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
accessed 2026-09-05). This repository's code and `wrangler.toml` already
**declare** one Durable Object class following this pattern —
`ProviderRateLimiter`
([ADR 0021](0021-hardened-provider-boundary-and-durable-object-rate-limiter.md))
— but ADR 0021 itself records that class as *"declared and validated but not
provisioned"*: no namespace has been bound into any live environment, and
this ADR changes nothing about that. The precedent this ADR relies on is the
**pattern being present in code and configuration**, not a live, provisioned
namespace. This ADR authorizes a **second, unrelated** Durable Object identity
that makes its own storage — not Workers KV — the authoritative decision
point for what is active, per season; it provisions nothing, exactly as
ADR 0021 did not.

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

### Context: design-review corrections

A Codex review of the first version of this ADR (commit `524815c`, review
`PRR_kwDOTb8J4M8AAAABMTsY2w`) found and this revision corrects three defects,
independently reproduced against this ADR and the merged publication
documentation before being accepted:

1. **The D6 read-path fallback lacked positive evidence that a missing
   document meant propagation lag rather than intentional withdrawal.**
   [`GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md)
   already documents that driver, constructor and circuit profiles and Grand
   Prix detail/results routes can be legitimately absent from a version's
   inventory — "the withdrawable families are exactly the driver, constructor
   and circuit profiles and the Grand Prix detail and results routes." A
   fallback that does not check inventory membership first would serve a
   withdrawn document from `previousVersion` forever instead of the intended
   not-found response. Corrected in D6.
2. **The prepared operation record omitted the values `finalize` claims to
   verify and commit.** The original D4 persisted only
   `{epoch, token, priorVersion, candidateVersion, preparedAt, deadline}` —
   no candidate per-key revisions, no assigned timestamps, no completeness
   material — so a restart between `prepare` and `finalize` left nothing for
   `finalize` to commit or verify against. Corrected in D4.
3. **The ordinary source-ordering staleness rejection, as originally
   written, applied unconditionally — including to rollback.** Since a
   rollback's historical `sourceOrderingInput` is expected to be older than
   or equal to what is currently active, the rule as drafted would reject
   every rollback attempt before Model 1 (D8) could ever execute. Corrected
   in D4 with an explicit, bounded `operationKind`, and in D8.

Two further self-inconsistencies, found during the same corrective pass, are
also fixed below without a separate review thread: D9's atomic-commit claim
contradicted the state table's durable `committing` row (corrected — see D9
and the state transition table), and D5's cleanup guarantee claimed
atomicity between a Durable Object check and a Workers KV deletion that this
ADR's own premise says does not exist across those two products (corrected —
see D5).

A second Codex review, against commit `25e4c3e`, found and this revision
corrects three further defects, independently reproduced against this ADR,
`GridView_Backend_Publication.md` and the edge-api source tree before being
accepted:

1. **D3's per-key state retirement removed the only floor a withdrawn key's
   later restoration needed.** A key's per-key `snapshotObservedAt` state was
   retired the moment it left the current active inventory (D3), but D4's
   D1.10 assignment read "previous" from that same per-key state — leaving a
   restored key with no floor to compare against and no guarantee its fresh
   timestamp exceeds a value an offline client already holds from before
   withdrawal (ADR 0005 rule 2). Corrected by adding one durable, constant-size
   per-season scalar, `seasonSnapshotObservedAtHighWaterMark` (D2), and
   restating D4's per-key assignment as two cases — unchanged-and-currently-active
   retains its timestamp; everything else (changed, new, or restored) is a
   fresh activation floored by the season-wide high-water mark, not a per-key
   value that withdrawal already destroyed. Corrected in D2, D3, D4, D5, D8,
   D9, the failure-state identity table and the testing obligations.
2. **D12's migration imported only the two legacy pointers, not the per-key
   state the first post-cutover `prepare` call needs.** `snapshotRevision`
   has no production caller before cutover, so no per-key revision/timestamp
   baseline exists anywhere until migration computes one; importing only
   `activeVersion`/`previousVersion` would leave every key looking "new" on
   the first post-cutover publication, manufacturing exactly the spurious
   churn D1.9 exists to prevent. Corrected by expanding D12's migration into
   an explicit per-season procedure that reads, validates and computes
   revisions for every active (and, best-effort, previous) document,
   seeds both the per-key state and the high-water mark, verifies before any
   authority-mode switch, and aborts that season's cutover — leaving legacy
   pointers authoritative — on any missing, malformed or inconsistent input.
   The migration's coverage is explicitly bounded to the operator-approved
   checkpoint inputs (`activeVersion`, `previousVersion`) — see D12, "the
   completeness limit."
3. **The future "Failure behavior" section overstated what the atomic commit
   eliminates.** It collapsed today's four pointer-transition outcomes to two
   without noting that only `pointerMaintenance: 'failed'` disappears —
   `cachePurge: 'failed'` remains fully applicable, because cache purge is
   still an external, post-commit, best-effort Cache API call independent of
   the DO commit. Corrected in `GridView_Backend_Publication.md`'s "Failure
   behavior" section to state three outcomes, not two.

Two further self-found documentation gaps, unrelated to correctness, are also
fixed without a separate review thread: this ADR referenced a `"Delivery
plan"` section by name in three places without ever defining one (corrected
by pointing each reference at D12 "Activation boundary" and/or
`GridView_Implementation_Plan.md` §14.0.11, whichever it actually meant), and
D6's cited single-location-latency sentence could not be found verbatim on
the Cloudflare page it was attributed to (corrected by removing the direct
quote and restating the latency dependency as an explicit, unmeasured
performance risk rather than a documented platform guarantee — see D6).

A third Codex review, against commit `3db9e46`, found and this revision
corrects five further defects, independently reproduced against this ADR,
`GridView_Backend_Publication.md` and the edge-api source tree before being
accepted:

1. **`sourceOrderingInput` lived only in the mutable prepared-operation
   record**, which every new `prepare` replaces and which a cancelled or
   expired operation leaves describing an uncommitted candidate, not the
   active release — and D12's migration seeded no initial value. Corrected
   by adding one distinct durable field, `committedSourceOrderingInput`
   (D2), updated only by a successful `prepared → committed` transition
   (D4, D9) and seeded by migration from the selected release's uniform
   legacy `sourceUpdatedAt` value, failing closed on inconsistency (D12).
   *(That migration seed rule was generalized by the later review recorded
   below — see D12 step 6: a valid per-version metadata record is preferred,
   and the uniform-document rule is the fallback for a release that predates
   one.)*
2. **The staleness rejection was restated as "not newer than what is
   committed"**, a `<=` rejection, when the current implementation
   (`services/edge-api/src/publication/publisher.ts:347-350`) rejects only
   `<` and has always admitted equality. Corrected in D4, with the rationale
   that consecutive genuinely-changed candidates may legitimately share one
   source-ordering value.
3. **The D2 season high-water-mark description read as an exact equality**
   ("the greatest value ever committed") that a conservative migration seed
   can exceed. Corrected by restating it as a durable, monotonically
   non-decreasing assignment **floor** — at least the greatest committed
   value, not necessarily equal to it (D2).
4. **D12 treated two equal Workers KV rereads of the legacy pointers as proof
   of convergence**, which Workers KV's documented propagation model does not
   support. Corrected by restructuring D12 around an operator-approved
   **cutover checkpoint** naming the exact versions to migrate, read
   thereafter only by immutable versioned key, never by re-reading the live
   pointer.
5. **D12's atomic seed omitted `activeVersion`/`previousVersion` themselves**,
   committing only per-key state and the high-water mark before authority
   switched — leaving the newly authoritative object unable to answer a
   lookup. Corrected by defining the complete seed (D12) and a durable
   `uninitialized`/`seeded`/`active` cutover lifecycle that separates
   "the seed is committed" from "this season's authority has switched."

An independently confirmed sixth defect, found during the same corrective
pass and fixed without a separate review thread: D12 claimed
`activeVersion`/`previousVersion` and the migration clock necessarily
dominate every older, unenumerable timestamp — disproven by ADR 0020 D1.11a's
clock-regression clamp, and reachable through ordinary publication restoring
a pre-cutover key, not only through deep rollback. Corrected by adding an
explicit pre-cutover historical-floor activation precondition to D12, and by
narrowing `previousVersion`'s claimed role to best-effort only.

A subsequent Codex review, against commit `0329e1c`, found and this revision
corrects two further defects, independently reproduced against this ADR and
the edge-api source tree before being accepted:

1. **No immutable record retained a release's own `sourceOrderingInput`, so
   rollback provenance was undefined after the first supersession.**
   `committedSourceOrderingInput` (D2) holds only the **currently active**
   release's value and is replaced by every successful `finalize`; the
   prepared-operation record is replaced by every new `prepare`, cancellation,
   expiry or supersession (D4, D5); post-cutover public documents carry each
   key's assigned `snapshotObservedAt` in `meta.sourceUpdatedAt`, not a
   release-wide ordering input; and `sourceUpdatedAt` is excluded from
   `snapshotRevision` ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
   D1.7). D8 nevertheless requires a rollback to carry the **target release's**
   historical ordering input, which nothing retained. Corrected by adding an
   immutable per-version sidecar,
   `snapshot:{season}:{version}:__publication_metadata` (D3), written as part
   of the required publication write set (D3, D4), read as rollback's
   provenance source with a bounded legacy fallback and fail-closed
   classification (D8), used identically by migration (D12 step 6), removed
   with its version by cleanup (D5), and never publicly routed (D3, D6).
2. **D12's migration required every checkpoint-named artifact to validate
   while simultaneously declaring an invalid previous version non-blocking.**
   Step 3 aborted the cutover when any checkpoint-named inventory or document
   failed to validate — and the checkpoint may name an optional
   `previousVersion` — while step 8 stated that an invalid or absent
   `previousVersion` is not cutover-blocking. The two rules are opposite
   migration outcomes for the same input. Corrected by scoping mandatory
   validation to `activeVersion` alone (step 3), stating the best-effort
   previous path and its outcome in one place (step 8), and defining the
   resulting authoritative representation explicitly: a previous version that
   validates is seeded as `previousVersion`, and one that is absent or fails
   validation seeds `previousVersion` as `null` rather than committing a
   known-invalid rollback target (steps 8, 10).

A self-found defect in that same correction, fixed here without a separate
review thread: **the legacy provenance fallback was not decidable.** D8 and
D12 both classified an absent `__publication_metadata` key as "a version
predating the sidecar" and permitted the uniform-document fallback, while the
testing obligations separately required a missing sidecar on "a version known
to require the new format" to be rejected — and nothing anywhere defined how a
reader could *know* which case it was in. Absence cannot supply that answer:
Workers KV document storage remains eventually consistent
([ADR 0010](0010-workers-kv-consistency-limitation.md)), so a written record
that has not yet propagated reads identically to one that was never written;
and uniformity of `meta.sourceUpdatedAt` cannot supply it either, because D4
gives every changed, new or restored key in one `prepare` call the same
timestamp, so a post-cutover release whose keys all changed is uniform — and
treating that per-key activation timestamp as a release-wide
`sourceOrderingInput` would install a wrong committed ordering baseline.
Corrected by minting every version this protocol creates in an explicit,
reserved `pm1-…` namespace (D3) that records *whether a sidecar was required*,
making eligibility for the fallback a property of the immutable identifier
rather than an inference from a KV read (D3, D8, D12 steps 3, 6 and 8, the
testing obligations and the rejected-alternatives table).

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
- the current `snapshotRevision` per snapshot key **named in the current
  active inventory**
- the current `snapshotObservedAt` per snapshot key **named in the current
  active inventory**
- `committedSourceOrderingInput` — the `sourceOrderingInput` belonging to the
  **currently active release** for this season. This is a **distinct durable
  field**, separate from the `sourceOrderingInput` carried by the current
  *prepared* operation record below, which describes an as-yet-uncommitted
  candidate and is replaced or discarded by every new `prepare`, cancellation,
  expiry or supersession. `prepare` reads `committedSourceOrderingInput` —
  never the prepared record's own value, and never anything else — when
  applying the ordinary-publication staleness admission rule (D4). A new
  `prepare` call, a cancellation, an expiry, a supersession, or a
  document-writing phase that fails before `finalize` is ever called never
  changes it. It is updated **only** by a successful `finalize`, atomically
  with `activeVersion`, `previousVersion`, the committed per-key state and
  `seasonSnapshotObservedAtHighWaterMark` (D4, D9). An idempotent retry of an
  already-`committed` `finalize` call — presented while that operation is
  still the current durable record — returns the already-committed result
  without advancing or recomputing it; a retry arriving after a newer
  `prepare` has superseded that record resolves to D9's bounded `superseded`
  outcome instead, which likewise never advances or recomputes this field.
  See D4 for the exact admission rule
  this field makes possible, and D8 for how a successful rollback
  republication updates it. **This field is deliberately not a history, and
  is never a source a rollback can read its target's ordering input back
  from:** it describes the currently active release only, so once a release is
  superseded its ordering input is no longer in Durable Object state at all.
  The value a rollback needs comes from the **target version's own immutable
  `__publication_metadata` record** (D3, D8), never from here.
- `cutoverState` — one of exactly three durable values, `uninitialized`,
  `seeded` or `active` (D12), plus the migration identity/fingerprint that
  produced the current `seeded`/`active` state. `uninitialized` is the state
  of any season this ADR's migration procedure has never touched. Public and
  administrative routing (D6, D7) treats only `active` as the authoritative
  switch away from legacy Workers KV pointers — `seeded` is a distinct,
  pre-activation state in which legacy pointers remain authoritative by
  design (see D12, "The cutover lifecycle").
- `seasonSnapshotObservedAtHighWaterMark` — one durable scalar per season: a
  durable, monotonically non-decreasing **assignment floor**, not
  necessarily an exact equality with any single committed value. It is
  guaranteed to be **at least** the greatest `snapshotObservedAt` value the
  sequencer has itself authoritatively committed for any document key in
  that season, past or present (unlike the two per-key maps above, which
  are scoped to the current manifest, this scalar is **never removed or
  lowered merely because a document key leaves the current active
  inventory**). It **may be greater** than every value actually committed to
  a document, because D12's migration may seed it conservatively — from the
  migration clock or an audited upper bound — rather than only from
  imported document timestamps. After activation, every successful
  `prepared → committed` transition (D4, D9) atomically advances it to
  `max(prior floor, every per-key snapshotObservedAt value just committed)`
  — never by a `prepare` call, a cancellation, an expiry, a supersession or
  a failed publication.

  **What this floor actually guarantees, stated precisely:**
  - it provides a **complete** floor for all **post-cutover** history this
    sequencer has itself committed — an offline client that only ever holds
    a snapshot the sequencer itself published is always safe against it
    (D4, D8);
  - its protection over **pre-cutover, unenumerable** history is bounded by
    whatever D12's migration seed actually imported or conservatively
    assumed for that season, and is only as complete as D12's **pre-cutover
    historical-floor activation precondition** establishes — this scalar
    does not, by itself, prove coverage that precondition has not yet
    established.

  See D3 for why this is a bounded, constant-size addition, D4/D8 for the
  exact assignment rule it exists to make safe across document withdrawal
  and restoration, and D12 for the activation precondition that scopes its
  pre-cutover guarantee.
- the current publication-operation record in full — `operationKind`, `phase`,
  `priorVersion`, `candidateVersion`, the candidate's per-key
  `snapshotRevision` values, the per-key `snapshotObservedAt` values assigned
  during `prepare`, the `sourceOrderingInput` supplied to `prepare`, the
  `expectedManifestCommitment` supplied to `prepare` (against which
  `finalize` will check the caller's later `completionAttestation`),
  `preparedAt` and `deadline` — see D4 for why every one of these fields must
  survive a restart between `prepare` and `finalize`
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
[ADR 0007](0007-versioned-kv-publication-active-pointer.md), and this ADR adds
exactly one internal per-version record alongside them:

```text
snapshot:{season}:{version}:{document}
snapshot:{season}:{version}:__inventory
snapshot:{season}:{version}:__publication_metadata
```

Their roles, stated precisely, because two of the three are internal and only
one is public:

- **`{document}`** — the immutable public snapshot documents, unchanged. These
  are the only keys any public route ever resolves.
- **`__inventory`** — unchanged from ADR 0007: the sorted, deduplicated list of
  **public document names** belonging to that version, in its existing array
  shape. This ADR does **not** change that shape, does not add a wrapper object
  around it, and does not add the sidecar below to it — an inventory reader
  written against today's contract keeps working, and no inventory migration is
  created here.
- **`__publication_metadata`** — an **internal immutable sidecar**, new in this
  ADR, recording the **release-wide `sourceOrderingInput`** that admitted the
  version this key belongs to. Minimum shape:

  ```ts
  {
    schemaVersion: 1,
    sourceOrderingInput: string
  }
  ```

  Season and version are already carried by the immutable storage key itself
  and are therefore not duplicated in the record; a future implementation may
  add fields only if it needs them for validation, and any such addition is a
  `schemaVersion` decision, not a silent shape change.

**What the sidecar is, and is not:**

- It is **never exposed through a public route.** Like `__inventory`, its
  suffix is not, and cannot become, a `SnapshotDocumentName` — that union is
  closed — so nothing can request it through `readVersionedDocument`, and no
  public URL or alias maps to it (D6).
- It is **never listed as a public document in `__inventory`.** The inventory
  enumerates public documents only; adding an internal record to it would make
  every inventory consumer — route mapping, purge expansion, completeness
  assessment — responsible for filtering it out.
- It is **excluded from `snapshotRevision`**, exactly as
  `sourceUpdatedAt`/`snapshotObservedAt` already are
  ([ADR 0020](0020-provider-source-observation-and-reconciliation.md) D1.7):
  the canonical hash input is constructed from the public `data` payload, and
  this record is not part of any payload.
- It is **written once, before `finalize`, and never mutated.** It is
  version-scoped, so it survives every later active/previous transition: a
  version that is superseded keeps its own metadata for as long as the version
  itself is retained.
- It is **not a second authority.** Workers KV does not become authoritative
  for active/previous selection because this record exists; the Durable Object
  remains the sole pointer authority (D2), and nothing reads this record to
  decide what is active.
- **Eventual consistency is acceptable for it**, for the same reason it is
  acceptable for the immutable documents and inventory beside it: a version
  cannot be finalized until its complete planned write phase — documents,
  inventory and this record — has succeeded (D4), and a later reader that
  requires it and cannot yet read it **fails closed** rather than proceeding on
  its absence (D8). It is never read as a live, mutable signal, so KV's
  last-write-wins model has nothing to resolve for it.

#### The sidecar-required version namespace

**A reader must be able to decide whether a version was *supposed* to have a
sidecar, and absence of the key can never answer that question.** Two facts make
this a correctness requirement rather than a nicety:

- **A `null` KV read is not proof that no write occurred.** Workers KV document
  storage remains eventually consistent
  ([ADR 0010](0010-workers-kv-consistency-limitation.md), permanent for
  documents whatever this ADR does to pointer authority), and D6 already treats
  "the document is named but not yet readable" as a real, expected state. A
  sidecar that was written and has not yet propagated to the reading edge
  location reads exactly like a sidecar that was never written.
- **Uniformity of `meta.sourceUpdatedAt` cannot stand in for the answer
  either.** D4 assigns *every* changed, new or restored key admitted in the same
  `prepare` call the **same** freshly computed timestamp, so a post-cutover
  release in which every key changed carries a uniform `meta.sourceUpdatedAt`
  across all of its documents. That uniform value is a **per-key activation
  timestamp**, not a release-wide `sourceOrderingInput`. Inferring "legacy" from
  uniformity would install that activation timestamp as the committed ordering
  baseline — a silently wrong admission baseline for every subsequent ordinary
  publication.

Therefore **the version identifier itself carries the discriminator.** Every
version created by the sidecar-aware publication protocol is allocated by the
Durable Object inside `prepare` (D4) in a reserved, self-identifying namespace:

```text
pm1-<operationEpoch, injectively encoded>-<opaque component>
```

`pm1` is "publication metadata, record schema generation 1". The invariant:

- **Every** ordinary publication and **every** rollback republication created
  after this mechanism activates uses this namespace. A new-format publisher may
  **never** emit an unmarked version.
- **The candidate version is allocated by the sequencer, never minted by the
  caller.** `prepare` allocates it in the same atomic transaction that
  allocates the new `operationEpoch`, and returns it to the caller (D4). No
  caller supplies, chooses or pre-computes a destination version, and no
  version exists before an epoch owns it.
- **Uniqueness is structural, not probabilistic.** The suffix carries an
  **injective encoding of the newly allocated `operationEpoch`** — distinct
  epochs therefore always produce distinct version identifiers, by
  construction. `operationEpoch` is durable and strictly increasing per season
  (D2), so no two epochs for a season can ever be assigned the same candidate
  version, and **no version is ever reusable by a later epoch.** Any further
  opaque material is a Mechanism-PR implementation detail; it may add entropy
  but the no-reuse property must **never** rest on it, and must **never** rest
  on an eventually consistent Workers KV preflight read (a `null` list or read
  is not proof of absence — ADR 0010, D3 above). The encoding must be
  colon-free for the reason the next-but-one bullet gives.
- **A retry of the same live operation identity allocates nothing.** A caller
  replaying `finalize`/`cancel` for the operation that is still the current
  durable record works against the version that epoch already owns. A
  genuinely new `prepare` allocates a new epoch and therefore, necessarily, a
  different version — which is what makes D5's orphan cleanup safe to
  authorize against a named, retired epoch.
- The marker is part of the **internal version identifier only**. It is not a
  public document field, not part of `snapshotRevision`, not an `__inventory`
  member, and adds no public API field — release version identifiers are not
  part of the public contract today (they appear in internal results and
  structured logs), and this ADR does not make them so.
- **Existing historical versions are legacy-format by construction.** Today's
  generator (`services/edge-api/src/sync/sync-service.ts`,
  `releaseVersionFor`) produces `<ISO-8601 stripped of "-:.TZ">-<8 hex>`, which
  always begins with a digit, so no already-published version can collide with a
  `pm1-` prefix.
- **The prefix is colon-free, deliberately.** `parseVersionFromSnapshotKey`
  (`services/edge-api/src/storage/keys.ts`) reads a version as everything
  between `snapshot:{season}:` and the next `:`, so a marker containing `:`
  would break key parsing. A `-`-delimited prefix does not. No version-format
  validator exists anywhere in the codebase today, so nothing needs relaxing to
  admit the new shape.
- **A historical identifier that accidentally resembles the reserved format is
  rejected conservatively** if its sidecar is absent — for example one supplied
  through the internal `forceVersion` override, which is test-only today but is
  not format-validated. Safety takes precedence over rollback availability: the
  operator selects a different target rather than the system guessing an
  ordering baseline.

The discriminator answers exactly one question — *was this version required to
have a sidecar?* — and nothing else. It never decides what is active, never
appears in a public response, and is never consulted when a valid sidecar is
present, since a valid record is authoritative regardless of the era its
version identifier belongs to (D8).

The caller (the publisher, driven by the synchronization service or an
operator rollback request) still:

1. obtains normalized candidate data (from the provider path, or — for
   rollback — from a historical version, per §"Rollback Model 1");
2. computes `snapshotRevision` per document, and — once document identities
   are known from that same normalized data, before `prepare` is ever
   called — deterministically enumerates the planned document manifest and
   computes an `expectedManifestCommitment` from it (e.g. the sorted,
   deduplicated document-name list, or a digest of it; the exact shape is a
   Mechanism-PR detail). **Every step up to here is version-independent**:
   the manifest commits to document *names*, not to a destination version,
   which is exactly why it can be computed before one exists;
3. calls `prepare`, passing that `expectedManifestCommitment` — and **not** a
   candidate version, which it neither mints nor chooses;
4. receives back, from the DO, the allocated `operationEpoch`, the
   `operationToken`, the **allocated `candidateVersion`** in the
   sidecar-required namespace (`pm1-…`, above), and the per-key
   `snapshotObservedAt` assignments. This is the first point at which a
   destination version exists at all — so that any later reader of this
   version can tell, from the identifier alone, that a sidecar was required,
   and so that no version can ever be shared by two epochs;
5. only now finalizes, validates and writes the immutable versioned documents
   and inventory to KV **under the version `prepare` allocated**, with the
   assigned timestamps baked into each document's `meta.sourceUpdatedAt`,
   recording which planned writes completed successfully;
6. writes the immutable `__publication_metadata` sidecar for that same
   allocated version, carrying the **same** `sourceOrderingInput` it passed to
   `prepare` — this write is part of the **required publication write set**,
   not an optional annotation beside it (D4);
7. **only once every planned write has succeeded** — every document, the
   inventory **and** the sidecar — produces a `completionAttestation` carrying
   the manifest commitment for what was actually written, and calls `finalize`
   with it, presenting **both** the `operationEpoch` and the `operationToken`
   it received in step 4 (D9). A write phase that fails or completes only
   partially must never produce a `completionAttestation` and must never call
   `finalize` — an incomplete write is not a candidate for commit.

The Durable Object never generates provider data, never validates a document
body and never stores a complete snapshot payload. Its own storage holds
metadata proportional to the current committed release's document manifest
and, while one is in progress, the prepared candidate's (D2) — never
complete document bodies. This **per-key** state does **not** grow with
historical release count: superseded operation and per-key state for a key
no longer named in the current active inventory are retired per the
lifecycle D5/D9 define, so its size is bounded by the current release's
inventory plus at most one prepared operation, never by all versions ever
published.

**Retiring a key's per-key state on withdrawal does not, by itself, lose the
monotonicity floor that key needs if it is later restored.** That floor lives
in the one additional scalar D2 adds for exactly this reason —
`seasonSnapshotObservedAtHighWaterMark` — which is **not** scoped to the
current inventory and is never retired when a key leaves it. This keeps the
capacity argument intact: the per-key maps stay bounded by the current
manifest, and the season adds exactly one constant-size value on top,
never a per-key tombstone history and never storage proportional to how many
times a key has been withdrawn and restored. See D4 for how this scalar is
used to assign a safe timestamp to a restored key, and "Rejected and
superseded alternatives" for why an unbounded per-key tombstone history was
not the chosen fix.

**The sidecar does not participate in that bounded-DO-state argument, and is
not claimed to.** `__publication_metadata` lives in Workers KV, not in the
Durable Object, so it adds **nothing** to the per-season durable state D2/D3
bound and nothing to `finalize`'s single atomic transaction (D9). What it does
add is one small, constant-size KV record **per immutable release** — so total
KV storage grows with the number of retained versions, exactly as versioned
document storage already does, and is retired with its version by the same
cleanup path (D5). That is a per-version cost of retaining history, honestly
stated, not a claim that this record is free or that it is part of the DO's
bounded per-season state.

**Storage-layer obligations this creates, recorded so the Mechanism/
Integration PRs inherit them explicitly:**

- `SnapshotStorage` gains explicit **read**, **write** and **delete**
  operations for the per-version metadata sidecar, alongside the existing
  versioned-document and inventory operations. It is never reached through
  `readVersionedDocument`, which is closed over `SnapshotDocumentName`.
- The **memory** and **Workers KV** implementations must behave consistently
  for all three, including how each reports absence versus a read failure —
  the classification in D8 depends on that distinction being real, not on one
  implementation collapsing it.
- **Orphan cleanup removes the sidecar together with the candidate's
  documents and inventory** (D5), and remains prohibited for any version that
  is, or may become, active.
- A version's **rollback completeness assessment** requires all three: a
  complete, valid inventory; every public document it names; and **resolvable
  source-ordering provenance** — a valid sidecar, or a valid legacy fallback
  (D8). A version satisfying only the first two is not a usable rollback
  target.
- The sidecar carries **no provider payload, no secret and no personal data**
  — one schema version and one ordering timestamp — and is subject to D11's
  logging discipline: bounded classification outcomes only, never the raw
  storage key and never the stored value.

### D4. Two-phase publication protocol

#### `prepare(season, operationKind, perKeyRevisions, sourceOrderingInput, expectedManifestCommitment)`

`operationKind` is one of exactly two bounded values: `ordinary-publication`
or `rollback-republication` (see D8 for what authorizes the second one). It
is durable, logged (D11) and never inferred after the fact from other fields.

**`candidateVersion` is not a parameter.** The destination version is
*allocated by this call*, not supplied to it — for both operation kinds,
through the identical allocation path (D3). A caller that could name its own
destination could name one a retired epoch already owns, which is exactly the
reuse D5's orphan cleanup must be able to rule out structurally rather than by
convention.

The Durable Object, in one atomic storage transaction:

- examines its own currently committed state (`activeVersion`,
  `committedSourceOrderingInput`, and the current
  `snapshotRevision`/`snapshotObservedAt` per key);
- evaluates candidate staleness against `committedSourceOrderingInput` — never
  against the prepared operation record's own `sourceOrderingInput`, which
  describes an uncommitted candidate, not the active release — **only for
  `operationKind === 'ordinary-publication'`**: the existing ADR 0007
  rejection rule rejects a candidate whose `sourceOrderingInput` is **strictly
  older** than `committedSourceOrderingInput`, and **admits** one that
  **equals** it. This is preserved **exactly as strict as it is today**: the
  current implementation
  (`services/edge-api/src/publication/publisher.ts`) rejects only `<`
  (`Date.parse(candidate) < Date.parse(active)`), never `<=`, so equality has
  always been admissible — an earlier draft of this ADR restated the rule as
  "not newer than what is committed", which is a `<=` rejection and would
  have silently tightened today's behavior. Equality is deliberately
  admissible, not an oversight: consecutive genuinely-changed candidates may
  legitimately carry the same `sourceOrderingInput`, because neither adopted
  source publishes a recency signal finer than what this field already
  carries ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
  §1) — rejecting an equal-but-differently-revisioned candidate on ordering
  grounds would block a genuine change for no safety reason, since staleness
  admission and per-key revision comparison are independent checks (the
  per-key comparison below is what actually detects whether content
  changed). This rejection, now decided against durable DO state rather than
  a KV read, is **never weakened, bypassed or made conditional for ordinary
  publication** — the exemption below applies to rollback and nothing else;
- for `operationKind === 'rollback-republication'`, **the source-ordering
  staleness rejection above does not run at all.** Admission authority for a
  rollback operation comes from the authenticated operator rollback request
  itself, not from `sourceOrderingInput` — a historical release's ordering
  input is expected to be older than or equal to what is currently committed,
  and rejecting it on that basis would make the already-authorized Model 1
  (D8) impossible to execute. `sourceOrderingInput` is still recorded
  verbatim for audit and idempotent-retry purposes; it is simply not
  evaluated as a rejection predicate for this operation kind;
- **for both operation kinds, without exception**, assigns each key's
  `snapshotObservedAt` by the same D1.9/D1.10 rule, now stated in exactly two
  cases — the staleness exemption above affects *admission* only, never the
  per-key revision/timestamp assignment:
  - **Currently active, unchanged key — retains its current timestamp.**
    Where the candidate's `snapshotRevision` for that key equals the
    currently active revision **for that key**, `prepare` keeps that key's
    existing `snapshotObservedAt` unchanged. No timestamp changes merely
    because some *other* key in the same candidate changed.
  - **Changed, new, or restored key — a fresh activation.** Every other
    case — the candidate's revision for that key differs from the currently
    active revision for that key, **or the key has no currently active
    revision at all** (never published this season, or published before but
    currently absent from the active inventory because it was withdrawn) —
    is treated identically, as a fresh activation, and assigned
    `max(now, seasonSnapshotObservedAtHighWaterMark + 1 ms)`. A restored key
    is never compared against its own old, pre-withdrawal value, and never
    described as "unchanged" merely because its restored content happens to
    match some earlier revision it once held — its only comparison base is
    the revision **currently active** for that key, and a withdrawn key has
    none, so restoration is unconditionally a fresh activation. This is
    D1.10's existing rule, generalized from a per-key floor to a per-season
    floor: "previous" is no longer that one key's own last value (which D3
    explains is not retained once a key leaves the active inventory) but
    `seasonSnapshotObservedAtHighWaterMark`, read from the same strongly
    consistent DO storage inside the same transaction that decides the new
    value — never raced against a second, unobserved publication attempt,
    and never lower than any timestamp ever committed for any key this
    season. Every changed, new, or restored key admitted in the **same**
    `prepare` call receives this same freshly computed value; nothing in the
    public contract requires distinct values across keys published together,
    and the pre-existing rule already produced this outcome whenever several
    keys changed at the same real-world instant.

  This is **strictly stronger** than the minimum a per-key floor would give:
  a restored key's fresh value is guaranteed greater than every timestamp
  the sequencer has itself authoritatively committed for *any* key this
  season, not merely greater than that one key's own (now-discarded) last
  value. For a season fully activated post-cutover, this alone is
  sufficient: an offline client can only ever have cached a snapshot the
  sequencer itself published, so a restored key can never be rejected as
  stale by such a client (ADR 0005 rule 2). Extending that same guarantee to
  a client holding a snapshot from **before this season's cutover** —
  content the sequencer never itself committed — additionally depends on
  D12's migration seed dominating that pre-cutover timestamp, which is
  exactly what D12's pre-cutover historical-floor activation precondition
  exists to establish before activation is permitted; this scalar does not,
  by itself, prove that for a season whose precondition remains unresolved.
  It adds exactly one constant-size scalar to the state D3 already bounds;
  it requires no per-key tombstone history and no change to which keys'
  state D3 retires.
- allocates a new, strictly-increasing `operationEpoch` for this season and a
  fresh caller-facing `operationToken`;
- **allocates this operation's `candidateVersion`, in the same transaction,
  immediately after the epoch it is derived from** — in the sidecar-required
  `pm1-…` namespace, carrying an injective encoding of that newly allocated
  epoch (D3). Because `operationEpoch` is durable and strictly increasing per
  season, and the encoding is injective, **two distinct epochs for a season
  can never be assigned the same candidate version**: no version a retired
  epoch owned is ever reachable again through a later `prepare`. This holds
  for `ordinary-publication` and `rollback-republication` alike, and does not
  depend on any Workers KV read, existence check or list;
- persists a `prepared` operation record containing **everything `finalize`
  will need, and everything a restart between `prepare` and `finalize` must
  not lose**: `{epoch, token, operationKind, priorVersion, candidateVersion,
  perKeyRevisions, assignedTimestamps, sourceOrderingInput,
  expectedManifestCommitment, preparedAt, deadline}`. Omitting any of these was the
  review-confirmed defect this ADR corrects (see "Context: design-review
  corrections" above) — without them, a restart between `prepare` and
  `finalize` leaves the Durable Object durably remembering only *that*
  something was prepared, not *what*, which is insufficient to finalize
  correctly or to resolve a same-token retry deterministically;
- returns, to the caller, the allocated `operationEpoch`, the `operationToken`,
  the allocated `candidateVersion` and the assigned per-key timestamps.
  **`operationEpoch` is part of the caller-visible operation identity**, not an
  internal-only fencing value: `finalize` and `cancel` present epoch *and*
  token together, which is what lets D9 distinguish a superseded operation
  from an invalid one.

Timestamp assignment and version allocation both happen **before** final
document construction, because `meta.sourceUpdatedAt` is baked into each
immutable document, and because the versioned KV keys the caller writes are
keyed under the version `prepare` allocated — neither the documents nor their
destination exists before this call returns.

#### Caller document phase (no Durable Object involvement)

The caller:

- inserts each key's assigned timestamp into its document;
- regenerates every volatile publication and freshness field
  (`requestId`, `generatedAt`, `staleAfter`, the server `stale` flag —
  everything already excluded from the `snapshotRevision` hash input under
  ADR 0020 D1.7);
- validates the final documents against the existing schema/inventory
  discipline ([`GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md));
- writes every version-scoped document and its inventory to KV, recording
  which planned writes (from the manifest already fixed before `prepare`)
  completed successfully;
- writes this version's immutable `__publication_metadata` sidecar (D3),
  carrying exactly the `sourceOrderingInput` it passed to `prepare`. **This is
  part of the required publication write set**, and a missing, failed,
  timed-out or otherwise ambiguous sidecar write has exactly the same
  consequence as a failed document or inventory write: no
  `completionAttestation`, no `finalize` call, the active state unchanged, and
  whatever was already written left as unreachable orphan data for the same
  cancellation/cleanup lifecycle (D5) — never a special case, never a
  "publish anyway and backfill later" path;
- **only once every planned write has succeeded** — documents, inventory and
  sidecar alike — derives a `completionAttestation`: the manifest commitment
  for what was actually written, computed the same deterministic way as
  `expectedManifestCommitment` so the two are comparable, and covering the
  same **public document manifest** `expectedManifestCommitment` describes (the
  sidecar is a precondition for producing an attestation, not an entry in the
  manifest it commits to — see D3 on why it is not an inventory member). A
  write phase that fails or completes only partially stops here: it produces
  no `completionAttestation` and never calls `finalize`;
- **never** touches `activeVersion`/`previousVersion` and gains **no**
  commit authority merely by holding a valid token — a token authorizes one
  `finalize` call, nothing else.

#### `finalize(season, token, completionAttestation)`

The Durable Object, in one atomic storage transaction:

- verifies the current `operationEpoch` and `operationToken` match the
  caller's;
- verifies the operation is still `prepared` (not cancelled, not superseded,
  not expired);
- compares the manifest commitment carried by `completionAttestation` against
  the `expectedManifestCommitment` value `prepare` durably recorded for this
  exact epoch — never against any other epoch's record. **This proves only
  that the caller's post-write attestation names the same manifest this
  Durable Object was given before `prepare` admitted the candidate; it is a
  caller-attestation consistency check, not an independent inspection of
  Workers KV, and it is not a cryptographic proof of anything beyond that
  internal consistency.** The Durable Object never reads the versioned
  documents or their inventory from KV; it has no way to independently verify
  global KV visibility, and this ADR does not claim it does. A caller that
  attests to a manifest *other than* the one it was prepared against produces
  a mismatch this check rejects outright — that part of the guarantee holds
  without qualification. **But a caller that attests to the *same* manifest
  despite an incomplete, failed or falsified write phase produces no
  detectable mismatch: the Durable Object has no independent way to observe
  whether the writes actually happened, so a false-but-matching attestation
  is indistinguishable to it from a true one.** This check therefore rules
  out committing a candidate whose caller never went through the recorded
  `prepare` step for it, or that attests to a manifest other than the one
  prepared — it does **not**, and cannot, rule out a caller that falsely
  reports success for a write phase that did not finish. See "The
  guarantee's precise boundary" below for where that remaining gap is closed,
  and why it cannot be closed here;
- if the attestation matches: performs the **one and only** authoritative
  state transition this design has, `prepared → committed`, in the same
  atomic write — recording the candidate as `activeVersion`, the version that
  was active immediately before this operation as `previousVersion`,
  replacing `committedSourceOrderingInput` with the `sourceOrderingInput`
  `prepare` durably recorded for this exact epoch (D2) — never recomputed and
  never read from anywhere else — committing the per-key
  `snapshotRevision`/`snapshotObservedAt` state `prepare` assigned, and
  advancing
  `seasonSnapshotObservedAtHighWaterMark` to
  `max(current high-water mark, every per-key snapshotObservedAt value just
  committed)` — derived entirely from the `assignedTimestamps` already
  persisted by `prepare` (D2, D4), never recomputed or read from the
  attestation. If every key in this operation retained its existing
  timestamp (no key changed), the high-water mark is left exactly as it was.
  There is **no separate durable `committing` state** — see D9 for why an
  earlier draft's claim of one was a contradiction, now corrected.

**No Workers KV pointer write occurs during `finalize`.** A stale, cancelled
or superseded identity never reaches an authoritative state change — never
partially applied, never silently replayed. A retry presenting the
epoch+token of the **current** `committed` record returns the recorded result
rather than re-evaluating anything; one presenting a lower epoch resolves to
the bounded `superseded` outcome, and one presenting the current epoch with a
non-matching token is rejected as an invalid identity (D9).

**The guarantee's precise boundary.** The comparison in `finalize` is a
value comparison inside the Durable Object's own storage, nothing more. It
proves only that:

- the presented `operationEpoch` and `operationToken` identify the current
  prepared operation for this season;
- that operation remains eligible for finalization (`prepared`, not
  cancelled, superseded or expired);
- the manifest commitment carried by `completionAttestation` equals the
  `expectedManifestCommitment` durably recorded for that epoch;
- the per-key `snapshotRevision`/`snapshotObservedAt` values committed are
  exactly those `prepare` assigned for that epoch — nothing recomputed and
  nothing substituted.

It cannot prove, and this ADR does not claim it proves, that:

- every intended Workers KV write for that manifest actually completed;
- a matching `completionAttestation` is truthful rather than falsely
  reported by a buggy or malicious caller;
- the stored inventory or document bodies match what the attestation
  describes;
- the written values are already globally visible to public readers;
- an ambiguous Workers KV write (neither confirmed success nor confirmed
  failure) actually succeeded or actually failed.

**Where the remaining guarantee lives, and why it cannot live in the
Durable Object.** `SnapshotPublisher` — the caller described in D3 — is a
**trusted** internal protocol participant here, not an untrusted input this
comparison can independently audit:

- it must construct `completionAttestation` only from the exact planned
  manifest, and only after every required document, inventory **and
  `__publication_metadata`** write for that version has returned success;
- **the Durable Object does not read the sidecar during `finalize`, and does
  not independently verify that it exists or that its contents match the
  prepared `sourceOrderingInput`.** It has no more ability to audit that KV
  write than any other, and inventing a read here would contradict the
  boundary this section exists to state. `finalize` proves only
  prepared-record and attestation-value consistency (above); writing the
  sidecar **truthfully**, before attesting completion, is a
  `SnapshotPublisher` correctness obligation of exactly the same kind as
  writing the documents themselves, enforced by its own tests ("Testing
  obligations") and never described here as something the Durable Object
  checks;
- a rejected, timed-out, cancelled or otherwise ambiguous write means no
  attestation is produced and `finalize` is never called for that operation;
- such a failure leaves the currently active version **untouched** — the
  operation simply remains `prepared` until it expires, is cancelled, or is
  superseded by a later `prepare` (D5);
- whatever was successfully written before the failure remains unreachable
  orphan data, exactly like any other abandoned `prepared` operation's
  documents (D5) — nothing points to it, and it is handled by the same
  cancellation/cleanup lifecycle, never by a special case introduced here;
- a crash after every planned KV write completed but before `finalize` was
  called leaves that same uncommitted `prepared` operation and that same
  unreachable version; the existing retry, deadline-expiry and cancellation
  rules (D5, D9) apply exactly as they would to any other incomplete
  operation — there is no third outcome for this case to invent;
- a programming defect that falsely emits a matching `completionAttestation`
  for an incomplete write phase is, by construction, **outside what this
  Durable Object comparison can detect.** Preventing it is a
  `SnapshotPublisher` correctness obligation — its own validation, control
  flow and tests — never something this ADR describes the Durable Object as
  proving.

A mismatched manifest commitment is, and remains, rejected unconditionally.
Nothing above weakens that check; it narrows only what a *matching* value is
honestly said to establish.

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
- **Orphan cleanup is allowed only from `cancelled`,** and `cancelled` is
  **terminal** for that epoch: no cancelled epoch ever transitions to
  `prepared` or `committed` (D9's state table). The safety argument does
  **not** claim atomicity between the Durable Object and Workers KV — that
  claim would contradict this ADR's own premise that no such cross-product
  atomicity exists (§"Safety reasoning"). Instead, cleanup is a two-step,
  non-atomic sequence with a one-directional safety property.

  **The cleanup request names the operation it wants to clean up, and the
  Durable Object authorizes only that one.** The request carries the
  `operationEpoch`, the `operationToken` **and** the `candidateVersion` of the
  cancelled operation. Inside its own transaction the DO authorizes the
  deletion **only if all of the following hold**:

  - its **current durable operation record is exactly that record** —
    the same epoch and the same token — and that record's state is
    `cancelled`. **"Recheck the current epoch" means checking the
    specifically named epoch against the current durable record, never
    accepting whichever epoch happens to be current**: if a later `prepare`
    has already superseded the named record, authorization is **refused**,
    not granted on the strength of some other epoch also being terminal;
  - the supplied `candidateVersion` is the version **that named record owns**
    (a mismatched triple is refused outright, never partially honoured);
  - that version is **not** `activeVersion`, **not** `previousVersion`,
    **not** the candidate of the current `prepared` operation, and **not**
    the candidate of the current `committed` operation record.

  Only **then**, outside any DO transaction, does the caller issue the
  external KV deletion. What makes an authorization safe to act on afterwards
  is no longer terminality of the epoch alone — terminality of epoch A never made
  *version V* terminal — but D3/D4's structural guarantee that **a candidate
  version is owned by exactly one epoch for its whole existence**: the named
  epoch is cancelled and terminal, and no later `prepare` can ever allocate
  that version again, so once authorization is returned there is no future
  operation that could make the version reachable and no writer that could
  legitimately recreate it. A delayed deletion can therefore only ever remove
  artifacts of the one dead operation that owned them. The external KV deletion
  itself remains **best-effort**, exactly like every other KV write in this
  design: if it fails, the orphaned version simply persists unreferenced
  (harmless, since nothing points to it) until a later cleanup attempt.
  **That deletion covers the whole version — its documents, its `__inventory`
  and its `__publication_metadata` sidecar together** (D3), for the same
  reason the inventory is already keyed under the version's own prefix: a
  sidecar that outlived its documents would describe a version that no longer
  exists. `deleteUnpublishedVersion` additionally continues to refuse the
  currently authoritative active version, unchanged from ADR 0007 — and
  cleanup remains **prohibited for any version that may be, or may become,
  active**, sidecar included; nothing here authorizes deleting a retained
  historical version's metadata while that version is still a possible
  rollback target.
- **A dead caller cannot block a season forever** — for `prepared` operations
  only, via deadline expiry. This explicitly does **not** extend to
  `recovery-required` (see D9): pre-commit abandonment is provably harmless to
  auto-clear; a genuine invariant-violation state is not, and that asymmetry
  is intentional. There is no intermediate durable state between `prepared`
  and `committed` for this rule to need to cover (D9).
- **`seasonSnapshotObservedAtHighWaterMark` is untouched by every outcome in
  this section.** Cancellation (explicit or by replacement), deadline expiry,
  and rejection of a stale or superseded token none of them read, advance or
  lower the high-water mark — it is a **committed-state** value, and D4
  advances it only inside a successful `prepared → committed` transition
  (D9). A `prepared` operation's proposed per-key timestamps are visible only
  in that operation's own durable record until `finalize` commits them; an
  abandoned or cancelled `prepared` operation leaves the high-water mark
  exactly as it was before that operation began, with the same "never
  observed" property D5 already gives every other piece of state a
  `prepared` operation touches before commit.
- **`committedSourceOrderingInput` is untouched by every outcome in this
  section, for the identical reason.** It describes the currently
  **committed** release; cancellation (explicit or by replacement), deadline
  expiry, and rejection of a stale or superseded token all operate on a
  `prepared` record that has not committed anything, so none of them read,
  replace or otherwise change it. Only a successful `prepared → committed`
  transition (D4, D9) replaces it, with the committing operation's own
  `sourceOrderingInput`.

**There is no lease over pointer mutation anywhere in this design.**

### D6. Public read path

The public router resolves `activeVersion` and (where needed, for rollback
default-target resolution) `previousVersion` through a call to the
per-season Durable Object — never through an independent Workers KV read of
a pointer key.

**A previous-version fallback requires positive evidence, never absence
alone.** A missing document at the active version cannot, by itself,
distinguish two different facts: the document has not yet propagated through
KV, or the document was **never part of this version at all** — GridView's
own publication model deliberately allows driver, constructor and circuit
profiles and Grand Prix detail/results routes to be withdrawn from a version
([`GridView_Backend_Publication.md`](../technical/GridView_Backend_Publication.md)
"Cache invalidation of withdrawn routes"). Treating a missing document as
"not yet propagated" and falling back to `previousVersion` would serve a
withdrawn route from the previous release **forever**, never returning the
not-found response the withdrawal intends. The router therefore resolves a
document request in this order:

1. Resolve `activeVersion` (and `previousVersion`) from the authoritative
   Durable Object.
2. Read and validate the active version's inventory.
3. **If the active inventory is readable and does not name the requested
   document, return the intended not-found response.** `previousVersion` is
   never consulted for this case — a validly excluded document is not a
   propagation problem to route around.
4. **If the active inventory names the document but the document itself is
   not yet readable from KV**, a bounded fallback may be considered.
5. **A `previousVersion` response may be served only if the previous
   version's own inventory also names that document.** `previousVersion` is
   never used as a *negative* oracle (its absence never implies the document
   should 404) and never as a blind substitute (its presence is checked, not
   assumed).
6. **If the active inventory itself is missing, unreadable or not yet
   visible**, the router does not guess whether the route exists in either
   direction. It uses the documented bounded unavailable/degraded response —
   the same shape as "Durable Object binding or lookup unavailable" below —
   rather than treating `previousVersion` as a stand-in decision for a
   question the active inventory alone can answer.

**The `__publication_metadata` sidecar is outside this path entirely.** It is
never resolved by step 2's inventory read (it is not an inventory member), is
never a document step 3-5 can be asked for (its suffix is not a
`SnapshotDocumentName`), has no public URL or alias, and therefore never
participates in the previous-version fallback and never appears in a cache
invalidation set — there is no cached public response for it to invalidate.
Reading it is exclusively an internal publication/rollback concern (D3, D8).

Steps 4-5's fallback remains **bounded** (a fixed, small retry/fallback
budget, not an unbounded search) and **observable** (an operational event,
per D11). It never rewrites or reinterprets what the Durable Object reports
as active — only which document is *servable right now* is affected — and it
retains the repository's existing stale/degraded response semantics (ADR
0010's "an edge location may briefly serve the older active version during
propagation" trade-off, now scoped to the document, not the pointer).

**This introduces a genuinely new, narrow, accepted trade-off, stated
precisely rather than left implicit.** Before this design, an edge location
that had not yet observed a pointer change served an *entire* release
consistently — every document it returned belonged to the same version,
because the pointer and the documents propagated through the same
eventually-consistent KV mechanism together. Under this design the
authoritative pointer is resolved instantly and strongly consistently
through the Durable Object, so a client's requests within one short window
can observe document A from the **new** active version (already propagated)
and document B from the **previous** version (steps 4-5's fallback, not yet
propagated) — a per-document mixed view across two *adjacent* versions that
the pre-cutover architecture did not need to describe, because pointer lag
and document lag were previously correlated. This ADR does **not** invent a
cross-request atomicity guarantee to hide this: it is accepted, bounded to
exactly one version boundary, restricted to documents both versions'
inventories positively confirm, time-limited to ordinary KV propagation
(ADR 0010), and consistent with the existing "stale data is preferable to no
data" philosophy for a product that is not live timing (ADR 0010). It is a
narrower, more precisely-scoped version of a trade-off this codebase already
accepted, not a new kind of risk.

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

**The latency and availability trade-off is stated as a risk to measure, not
as a documented platform guarantee.** Every authoritative public version
resolution now depends on a call to one per-season Durable Object. Cloudflare
documents that a Durable Object's storage is *"fast, transactional, and
strongly consistent"* and that each object instance runs at a single location
the caller may optionally influence
([What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/),
accessed 2026-09-05) — unlike Workers KV's globally-replicated read path. No
official Cloudflare documentation reviewed for this ADR quantifies the
latency a client geographically distant from that single location should
expect, so this ADR does **not** cite a specific latency figure or framing as
a platform guarantee. The single-location dependency is real by construction;
its magnitude is an **explicit, unmeasured performance risk**, to be measured
against D6's stated trade-off during the Mechanism/Integration PRs' staging
latency review (see "Reopening conditions" below), not assumed acceptable in
advance. This ADR does **not** hide that cost behind an unmeasured caching
layer.

**No pointer caching is introduced by this ADR.** A cache in front of the DO
lookup would reintroduce exactly the staleness/authority ambiguity this
design exists to remove, unless its own consistency model — invalidation
trigger, staleness bound, and what a public reader is told when the cache and
the DO disagree — is fully specified and reviewed on its own terms. That is
deferred to a future ADR, only if measured latency from the Mechanism/
Integration PRs (see "Reopening conditions" below) shows it is needed.

### D7. Legacy KV pointers

The existing keys `active:{season}` and `previous:{season}` are **migration
inputs only, after cutover**:

- At staging activation (a separate future authorization — see "Activation
  boundary"), their last valid values seed the new Durable Object's state
  through a **one-time, operator-controlled migration procedure**.
- **After successful cutover:** no *newly admitted* publication or rollback
  operation writes these keys — new legacy admission is closed at D12
  migration step 1, before cutover — and public routing does not read them;
  they are **not** a fallback authority under any circumstance, including
  Durable Object unavailability (D6). A legacy-path invocation admitted
  before that admission closure may still complete late and write one of
  these keys; that write is inert precisely because nothing authoritative
  reads it any longer (see D12, "Already-admitted legacy invocations, after
  the boundary").
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
3. Receive a new candidate version identity **allocated by `prepare`, in the
   sidecar-required `pm1-…` namespace and bound to that call's newly allocated
   `operationEpoch`** (D3, D4) — regardless of which namespace the rollback
   source belongs to, and through the identical allocation path an ordinary
   publication uses. Rollback mints no version of its own, so a rollback
   candidate can no more collide with a retired epoch's version than an
   ordinary publication can.
4. **Regenerate, never copy:** everything already excluded from the
   `snapshotRevision` hash under ADR 0020 D1.7 — `requestId`, `generatedAt`,
   `staleAfter`, the server `stale` flag, ETag inputs — set fresh for this
   rollback's publication time. The exact per-version inventory is freshly
   computed against what this rollback actually intends to write; it is
   never copied from the old version's inventory. This freshly-computed
   inventory is also what the caller deterministically enumerates into a
   planned document manifest and turns into an `expectedManifestCommitment`
   — exactly as D3/D4 describe for ordinary publication — before step 10's
   `prepare` call, never after.
5. Compute `snapshotRevision` for each restored key using the same canonical
   hashing already implemented for ordinary publication ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
   D1.7) — Model 1 introduces **no new revision-computation mechanism**.
6. Compare each restored key's revision against the **currently active**
   version's revision for that same key (not against the historical
   version's own old revision, and not against any revision that key held
   the last time it happened to be active, if it is currently absent from
   the active inventory) — exactly D4's two-case rule, applied here without
   a third case for rollback:
7. **Retain the current `snapshotObservedAt`** for a key whose restored
   revision equals the **currently active** revision for that same key —
   this key did not actually change across whatever regression the rollback
   corrects, and must not manufacture spurious churn.
8. **Assign `max(now, seasonSnapshotObservedAtHighWaterMark + 1 ms)`** (D4's
   fresh-activation rule, applied through the same `prepare` mechanism as
   ordinary publication) for every other restored key: one whose revision
   differs from the currently active revision for that key, **or one with no
   currently active revision at all** — a key this rollback restores that is
   currently withdrawn from the active inventory is, by D4's rule, always a
   fresh activation, never a comparison against that key's own historical
   value, however recently or long ago it was last observed. For a
   since-withdrawn key whose withdrawal, and every client's cached copy of
   it, are themselves post-cutover, this guarantees the rollback can never
   hand an offline client a "restored" document timestamped earlier than
   what that client already has; the same guarantee for a client holding a
   pre-cutover-era copy depends additionally on D12's pre-cutover
   historical-floor activation precondition, not on this scalar alone
   (see D4).
9. **Resolve the target's historical `sourceOrderingInput` from the target
   version's own immutable record** — never from the Durable Object's current
   state, never from the operator, and never from a document's
   `meta.sourceUpdatedAt` on a post-cutover version. See "Rollback's
   source-ordering provenance" below for the exact resolution and rejection
   rules; a target whose provenance cannot be resolved is rejected **before**
   `prepare` is called.
10. Call `prepare` with `operationKind: 'rollback-republication'`, the
    `expectedManifestCommitment` from step 4, and the exact historical
    `sourceOrderingInput` step 9 resolved, then write the complete new
    immutable version — its documents, its inventory, and its **own**
    `__publication_metadata` sidecar carrying that same resolved value — to KV
    with the timestamps `prepare` assigned baked in, the same order and the
    same required write set D3/D4 require for any publication.
11. **Only once that write fully succeeds**, produce a `completionAttestation`
    for what was actually written and call `finalize` — rollback has **no
    separate commit path** and cannot flip the authoritative pointer
    directly; a pre-commit failure here leaves the currently active release
    untouched exactly as D4 already requires. On success, `finalize` commits
    that same resolved value as the new `committedSourceOrderingInput` (D2,
    D4), exactly as it does for any other operation kind.

**Rollback's source-ordering provenance, stated as the rule step 9 applies.**
A rollback republishes a historical release, so it must carry that release's
own release-wide ordering input — and the Durable Object cannot supply it:
`committedSourceOrderingInput` describes only whatever release is **currently
active**, and is replaced by every successful `finalize` (D2), so once a
target has been superseded its value is gone from DO state. Post-cutover
public documents cannot supply it either: their `meta.sourceUpdatedAt` carries
that key's assigned `snapshotObservedAt` (D4), which is a per-key activation
timestamp, not the release-wide ordering input. The immutable per-version
sidecar (D3) exists precisely to close that gap, and the resolution is:

1. Read and validate the target version's `__inventory`, and confirm every
   public document it names is readable and valid — the existing
   rollback-completeness requirement, unchanged.
2. Read the target version's `__publication_metadata` and classify the result
   using the **same four-valued discipline** the repository already applies to
   stored inventories (`services/edge-api/src/publication/version-inventory.ts`).
   **The KV result alone never decides the outcome for an absent key** — it says
   only whether the expected key is *currently readable as a valid value*, and
   the version identifier's namespace (D3) says whether the key was *required*:
   - **valid sidecar** — the key holds a record of the declared shape with a
     valid `sourceOrderingInput`. Use that value verbatim, **regardless of which
     namespace the version identifier belongs to**. A valid record is
     authoritative; the discriminator is not consulted in this case at all.
   - **absent sidecar on a sidecar-required (`pm1-…`) version** — the version
     was minted by a protocol that must have written this record before it
     could finalize (D3, D4), so `null` here means *not readable right now*, not
     *never written*. **Fail closed**: reject the target. **Never** fall through
     to document inference.
   - **absent sidecar on a legacy-format version** — the version predates this
     record entirely, which is a known historical state rather than corruption.
     Apply the legacy fallback below.
   - **malformed sidecar** — the key holds something that is not a record of
     the declared shape. **Fail closed**: reject the target, in either
     namespace.
   - **unreadable sidecar** — the read itself failed, so nothing is known
     about the version at all, *including whether it recorded a sidecar*.
     **Fail closed**: reject the target, in either namespace.

   Three distinctions here are load-bearing and must not be collapsed. An
   **unreadable** sidecar is not evidence of an absent one, so a read failure
   must never silently select the legacy path. A **malformed** sidecar is a
   version whose provenance we cannot describe, not one that never recorded
   provenance. And **`null` alone never proves legacy status**: eligibility for
   the fallback comes from the version-format discriminator, never from the
   absence of the key, because Workers KV propagation lag produces the identical
   read (ADR 0010) and because a post-cutover release whose keys all changed in
   one `prepare` call carries a *uniform* `meta.sourceUpdatedAt` that would make
   the fallback appear to succeed while installing a per-key activation
   timestamp as the release-wide ordering baseline (D3, D4).
3. **Legacy fallback, for an absent sidecar on a legacy-format version only.**
   Versions created
   before this record existed still need a deterministic provenance rule, and
   one already-relied-upon invariant supplies it — the same one D12's
   migration uses: the current generator writes **one release-wide
   `sourceUpdatedAt` value uniformly into every document of a release**
   (`services/edge-api/src/publication/publisher.ts` applies a single
   `set.sourceUpdatedAt` per publication). So: read **every** document the
   target's inventory names, and verify that all of them carry the **same**
   valid `meta.sourceUpdatedAt`. If they do, that value **is** the target's
   legacy `sourceOrderingInput`. If any is missing, malformed, or differs from
   the others, **reject the target** — a value is never picked from one
   document arbitrarily, and the operator is never asked to invent or type the
   missing value by hand. This fallback applies only when the complete target
   inventory validates; it is never used to paper over an incomplete target.
4. **Write the resolved value into the new rollback version's own sidecar**
   (step 10), whether it came from a sidecar or from the legacy fallback. **The
   rollback's destination version is always the one `prepare` allocated in the
   sidecar-required namespace (D3, D4), even when its source is a legacy-format
   version** — a rollback mints no identifier of its own and never inherits or
   reuses the target's, so rolling back a
   legacy release produces a `pm1-…` version carrying new-format provenance,
   and the migration never has to retrofit metadata onto an already-existing
   historical version.

**A target that fails any of the above is rejected before `prepare`**, with a
bounded internal reason in the repository's established kebab-case
publication vocabulary (`services/edge-api/src/publication/publisher.ts`),
for example:

```text
rollback-source-ordering-unavailable
```

The exact final member name is a Mechanism/Integration-PR detail; what this
ADR fixes is that the rejection is **bounded, internal and pre-`prepare`** —
never an exception, never a raw storage key or stored value in a response or
a log line (D11), and never a rollback admitted with an unresolved or
operator-invented ordering input. A rejected target leaves the currently
active release serving, untouched, exactly like every other pre-commit
failure.

This keeps rollback **provider-independent** (no provenance lookup contacts a
provider), **deterministic** (the same target always resolves to the same
value, or is always rejected), **tied to the actual selected historical
version** rather than to whatever happens to be active now, **free of an
unaudited operator-supplied timestamp**, and fully compatible with the
compare-against-currently-active behavior below — the value a rollback
commits is the target's own, which is exactly what a later ordinary candidate
is then measured against.

**Rollback's admission authority, stated explicitly.** Step 10's `prepare`
call carries the historical `sourceOrderingInput` step 9 resolved from the
target's own immutable record, a value that is, by construction, never newer
than what is currently committed — that is what makes it a rollback. D4's ordinary source-ordering staleness rejection is **not**
evaluated for `operationKind: 'rollback-republication'`; admission instead
comes from the fact that the request itself reached `prepare` only through
an authenticated operator rollback request, which is a different, and
already-existing, authorization boundary from source-ordering freshness. This
exemption:

- is **unavailable to `operationKind: 'ordinary-publication'`** — D4's
  staleness rejection for ordinary publication is not touched, weakened or
  made conditional by this ADR in any way;
- changes **only** admission — step 6's per-key comparison against the
  currently active revision, and steps 7-8's D1.9/D1.10 timestamp assignment,
  apply to a rollback candidate exactly as they apply to any other candidate;
- remains **provider-independent** (step 2);
- uses the **same** `prepare`/`finalize` commit authority as ordinary
  publication — no separate rollback commit path exists;
- is **logged with its bounded `operationKind` and outcome** (D11), so a
  rollback admission is distinguishable in operational events from an
  ordinary one;
- introduces **no public activation-epoch field** (below);
- **on a successful `finalize`, commits that rollback candidate's own
  recorded `sourceOrderingInput` as the new active release's
  `committedSourceOrderingInput`** (D2, D4) — exactly the same commit rule
  every other operation kind follows, which is what preserves today's
  behavior of comparing a future ordinary candidate against **whatever
  release is currently active**, rollback included. **This is deliberately
  not a monotonic upstream-source high-water mark.**
  `committedSourceOrderingInput` can, and for a rollback deliberately does,
  move **backward** in source-ordering terms relative to the release it
  replaces, because ordinary staleness admission (D4) always compares the
  next candidate against **whatever is currently active**, never against the
  highest `sourceOrderingInput` this season has ever seen. Turning this field
  into a monotonic high-water mark would be a **different admission
  policy** — it would reject an ordinary candidate that is newer than the
  rollback target but older than whatever release the rollback superseded,
  a rejection today's design does not make — and adopting it is out of
  scope for this ADR; it would require its own separate architectural
  decision, not a documentation clarification.

Without this exemption, Model 1 as authorized in principle — republishing
historical data through `prepare`/`finalize` — would be **unexecutable**: the
unconditional staleness rule would reject the very rollback attempt this ADR
exists to authorize. This is a clarification that makes the already-accepted
Model 1 constructible, not a new product decision.

**No public activation-epoch field is introduced.** The `operationEpoch` in
D2/D4/D5/D9 is internal Durable Object coordination state; it never appears
in a published document or the public contract.

**Operational trade-off, stated plainly:**

- Today's rollback already requires one working KV pointer write.
- This rollback additionally requires enough KV write availability to create
  a **complete new immutable version — its documents, its inventory and its
  `__publication_metadata` sidecar** — before any authoritative commit is
  attempted, and enough KV **read** availability to resolve the target's own
  provenance first (step 9). This is strictly more pre-commit work than
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

**The durable model has exactly two operation-carrying states: `prepared` and
`committed`.** An earlier draft of this ADR additionally described a durable
`committing` state that a restart could "resume into," while also claiming
the whole transition happened in one atomic transaction — those two claims
contradict each other: a genuinely atomic, single-write transition has no
externally observable intermediate state for a restart to resume into.
Corrected: `finalize` performs exactly **one** atomic `prepared → committed`
transition (D4). There is no durable `committing` state anywhere in this
design. A restart between `prepare` and `finalize` resumes into `prepared`
(with everything D4 now records) and is either finalized from there or
cancelled/superseded/expired (D5) — never into a state describing a
transition that was "in progress," because the transition is not observable
as separate from its own completion.

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
  (epoch **and** token), never from a token or a phase string alone;
- the operation identity is idempotent **while its record is still the current
  durable operation record**: a call for an already-`committed` epoch+token
  returns the recorded result rather than re-executing anything. This
  guarantee is deliberately bounded — see "Delayed retries and the superseded
  outcome" below for what a retry gets once a newer `prepare` has replaced
  that record, and why an unbounded history of retired results is not the
  answer;
- a cancelled or superseded identity is never re-executed and never
  re-committed; a superseded one resolves to the bounded `superseded` outcome
  below rather than to an ambiguous rejection;
- **no `blockConcurrencyWhile` call needs to enclose the commit**, because
  the commit is a single fast local storage transaction with no outbound
  network call inside it — see D10 for why `blockConcurrencyWhile` is neither
  necessary nor appropriate here.

**Delayed retries and the superseded outcome.** A `finalize` response can be
lost in flight while its transaction has already committed. If the caller's
retry arrives after a *newer* `prepare` has been admitted, the committed
record it is asking about is no longer the current durable record — D3 bounds
the sequencer's state to the current release plus at most one operation, and
this ADR does **not** relax that bound. An earlier draft nonetheless promised,
without qualification, that a committed token always "returns the recorded
result"; that promise and the record's stated lifetime cannot both hold, and
this is the review-confirmed defect corrected here. The answer is **not** an
unbounded map of retired committed results — that would reintroduce
unbounded, historical per-operation state exactly where D3 refuses it, and it
would still not tell the caller anything it can act on. Instead the identity
is widened and the outcome made total.

**The caller-visible operation identity is `{operationEpoch, operationToken}`.**
`prepare` returns both (D4); `finalize` and `cancel` present both. Every
presented identity resolves to exactly one of these outcomes, decided inside
the Durable Object's own transaction against its current durable record:

| Presented identity | Outcome |
|---|---|
| epoch **and** token match the current **`committed`** record | the **recorded committed result**, replayed verbatim, nothing re-executed |
| epoch **and** token match the current **`prepared`** record | ordinary `finalize`/`cancel` evaluation for that operation |
| epoch is **lower** than the current durable epoch | **`superseded`** — a distinct, terminal outcome, returned together with the current authoritative `activeVersion` (or an equivalent bounded projection of committed state) |
| epoch **equals** the current epoch but the token does not match | **rejected as an invalid/stale identity** — not `superseded`; the current operation exists and this caller is not its holder |
| epoch is **higher** than the current durable epoch, or the identity is malformed | **fails closed** — an epoch this season never allocated is never treated as prior state |

**What `superseded` does and does not say.** It does **not** reproduce the
retired response, and it does **not** claim to prove whether that old
candidate committed before the later epoch was admitted — the record that
would have answered that is gone, and inventing an answer would be worse than
declining to. What it resolves is the only question the caller can still act
on: **that operation is obsolete, and must not be republished, replayed or
retried.** The caller's correct response is to stop, read the returned
authoritative state, and — if a publication is still wanted — start a fresh
`prepare`, which will allocate its own epoch and its own version. A
`superseded` outcome is therefore never a licence to re-drive the old
candidate, and never indistinguishable from "your operation failed".

**The replay guarantee is explicitly bounded** to the period during which that
committed operation remains the **current** durable operation record. Once a
newer `prepare` supersedes it, the guaranteed answer is `superseded` plus
current authoritative state — never the retired recorded response. Nothing in
this design promises indefinite replay of retired results.

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
this ADR requires only that it be **one** atomic storage-level operation, with
every read `finalize` needs (current epoch, token, phase,
`expectedManifestCommitment`) and every write it performs (activeVersion,
previousVersion, per-key state, phase → committed) inside that **single**
transaction, never a sequence of separately-awaited operations with a gap
between them.

**Capacity obligation, stated honestly rather than assumed away.** The
per-key `snapshotRevision`/`snapshotObservedAt` maps this transaction writes
grow with the release's document count (D2/D3); "one atomic write" is a
requirement about transactional indivisibility, not a license to serialize
an arbitrarily large per-key map into a single oversized value without
proof it fits. `seasonSnapshotObservedAtHighWaterMark`,
`committedSourceOrderingInput` and `cutoverState`/its migration
identity-or-fingerprint (D2, D4, D12) each add exactly **one** constant-size
value to this same transaction, independent of document count and
independent of how many times any key has been withdrawn and restored — none
of them changes this obligation's shape. The Mechanism PR
must demonstrate the chosen SQLite-backed representation handles the largest
supported release inventory without relying on one oversized serialized
blob, by either: storing bounded per-key records in a SQLite-backed layout
appropriate to that API and updating them atomically within the single
transaction above; or establishing and enforcing a safe serialized-state
size limit before any versioned KV document is written for that release.
This ADR leaves the storage-layout choice to the Mechanism PR; it does not
leave the capacity obligation itself optional.

**No correctness-critical in-memory single-flight identity (a
`commitPromise` or equivalent) is retained, and none is required.** An
earlier design needed one because its critical section spanned an *awaited
external Workers KV write*, which an ordinary input gate does not cover
(§"Context"). That external write no longer exists: `finalize`'s entire
critical section — validation and the state transition together — is now one
call into the Durable Object's own storage. Durable Object storage
operations **are** exactly what an ordinary input gate is documented to
protect from interleaving with other events. So two concurrent `finalize`
calls for the same season cannot both enter their storage transaction at
once; the second is simply delivered after the first's transaction (and the
synchronous code around it) has completed, by which point it reads
`committed` and returns the idempotent result (below) rather than racing
anything. Retaining an application-level single-flight guard on top of that
would be leftover machinery from the rejected KV-authoritative design,
carried forward for a purpose it no longer serves — removed here rather than
kept "just in case" (see "Rejected and superseded alternatives").

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
**This covers the `__publication_metadata` sidecar (D3) without exception:** a
rollback provenance outcome is reported as a bounded classification — resolved
from the version's own record, resolved through the legacy uniform-document
fallback, or rejected with a bounded reason such as
`rollback-source-ordering-unavailable` (D8) — never as the raw storage key and
never as the stored ordering value. The record contains no provider payload,
secret or personal data, so this is a key-and-value-hygiene rule of the same
kind already applied everywhere else, not a new data-classification concern.

**Operational events required** (mechanism-PR scope to define precisely;
authorized here as a category list):

- `prepare` accepted / rejected (with a bounded rejection reason)
- stale candidate rejected
- token cancelled or superseded
- `finalize` committed
- authoritative lookup unavailable (D6 fail-closed path)
- active-document propagation fallback used (D6 bounded fallback)
- rollback republication committed
- rollback target rejected for unresolvable source-ordering provenance (D8),
  carrying its bounded reason and its bounded provenance classification
- migration/cutover result (D7/D12)

### D12. Activation boundary

**Nothing in this ADR, and nothing in this documentation PR, provisions or
activates this design.** Future activation requires separate, explicit
authorization at each step below, and at each PR-scoped boundary in the
separated-future-work list of
[`GridView_Implementation_Plan.md`](../technical/GridView_Implementation_Plan.md)
§14.0.11 (Mechanism PR, Integration PR, staging provisioning and cutover,
production activation). The expected staging cutover sequence, recorded here
for planning only:

1. Mechanism code merged and unused (no binding, no caller).
2. Staging `SeasonPublicationSequencer` class and binding provisioned.
3. **The per-season migration procedure below runs to completion for that
   season** — first committing a durable `seeded` state through an
   operator-approved cutover checkpoint, then performing a separate,
   idempotent activation transition to `active`, which is what switches
   authority and resumes that season's mutators — **or the cutover aborts at
   any point, at any step, with legacy pointers left authoritative.**
4. Concurrent publication, rollback and read-path smoke tests run.
5. Latency, fallback and availability metrics reviewed against D6's stated
   trade-off before any further step is considered.

**Production remains untouched and continues in its current dormant state**
(`PROVIDER_MODE = "none"`, no production Worker deployment implied or
performed by this ADR).

**The cutover checkpoint, established before migration reads anything.**
Migration does not begin by re-reading the legacy `active:{season}`/
`previous:{season}` pointers and treating an unchanged reread as proof they
are current. Pausing mutators prevents *new* writes; it does not
retroactively make an already-issued Workers KV write strongly consistent,
and Workers KV publishes no finite global-convergence barrier this design
can rely on ([ADR 0010](0010-workers-kv-consistency-limitation.md)). Instead,
an operator explicitly approves a **cutover checkpoint** for that season
before migration reads anything:

- the checkpoint **names** the exact `activeVersion`, and optional
  `previousVersion`, chosen for cutover — an authenticated operator decision,
  never an inference drawn from a KV read;
- it carries a unique **migration identity or deterministic fingerprint**,
  covering the season and the chosen version(s), identifying this specific
  cutover attempt;
- its selected values are authoritative inputs to migration **because the
  operator explicitly approved this exact cutover state** — never because
  repeated KV reads are read as proof those pointers are "globally latest".
  No such proof is available from documented Workers KV behavior, and this
  design does not claim one;
- it **does not carry `sourceOrderingInput`, and no operator is asked to
  supply one.** The checkpoint's job is to *identify* the selected version;
  that version's own immutable `__publication_metadata` sidecar, or — for a
  legacy version that predates it — its own validated uniform document
  timestamps, supply the provenance (step 6). Asking an operator to type a
  historical ordering timestamp by hand would put an unaudited,
  unverifiable value into the field ordinary publication admission is decided
  against, which is precisely what this design avoids.

This is the distinction between *explicitly selecting* a cutover version and
*inferring* that a cached pointer read is globally current: the former is
what the checkpoint is, and the latter is what this migration must not do.

**Checkpoint timing, relative to admission closure and activation.** The
per-season sequence below is not six independent, freely-orderable events —
each step depends on the one before it:

1. New legacy mutation admission is closed for this season (procedure
   step 1) — before the checkpoint is approved, so the checkpoint reflects
   pointer state as of a moment when no *new* legacy mutation can begin.
2. The operator accounts for whatever already-admitted legacy invocations
   are known to still be in flight, as far as the future Integration/Cutover
   mechanism permits identifying them — the same operational care described
   in "This is an operational caution, not a correctness gap" below. This
   narrows operational risk; it does not, by itself, prove no unknown or
   delayed invocation exists.
3. Only then does the operator approve/select the cutover checkpoint
   itself (naming `activeVersion`, optional `previousVersion`, and the
   migration identity/fingerprint, above).
4. Migration reads and validates the checkpoint's named immutable versioned
   artifacts (procedure steps 2-3).
5. Migration commits the complete `seeded` state (procedure step 10).
6. A separate, later, authenticated operator confirmation — bound to that
   same seeded migration identity/fingerprint — explicitly activates it
   (procedure step 11, "Perform one idempotent durable transition").

A checkpoint approved at step 3 above may be a **provisional selection**:
the operator names an intended `activeVersion`/`previousVersion` pair and
its fingerprint before migration runs. That provisional selection is not
itself the activation confirmation. Step 6's confirmation is a separate,
final, authenticated act, made after the seed already exists, that must name
the same fingerprint the provisional selection produced — it is what
authorizes activation, not the provisional selection by itself.

**The per-season migration procedure, for every season being activated:**

1. **Close new legacy mutation admission for this season.** No publication
   or rollback mutator may be *admitted* against the legacy pointers once
   this step completes. This is an **admission-closure boundary, not a
   quiescence guarantee**: it stops new legacy operations from starting; it
   does **not**, by itself, prove that a publication or rollback already
   admitted before this step completed has finished. See "Already-admitted
   legacy invocations, after the boundary" below: such a late-completing
   invocation can never affect the sequencer's own authority at any
   `cutoverState`, though — while this season is still `uninitialized` or
   `seeded` — it can still change what legacy pointers serve, exactly as it
   always could before this migration began. If the repository
   cannot establish or confirm even this narrower admission-closure boundary
   (for example, a mutator path that cannot be paused, or a pause that
   cannot be verified), activation for that season **remains blocked** —
   this is never satisfied by a fixed sleep presented as proof that
   admission has closed, and this boundary is never described as proving
   that every already-admitted invocation has drained.
2. **Read the checkpoint's selected `activeVersion` (and, if named,
   `previousVersion`) by exact versioned key** —
   `snapshot:{season}:{version}:*` — never through the live
   `active:{season}`/`previous:{season}` pointer keys. These versioned keys
   are immutable once written ([ADR 0007](0007-versioned-kv-publication-active-pointer.md)),
   so reading them by exact key reads a fixed artifact, not a moving
   pointer. **The two reads carry different obligations, and steps 3, 8, 9
   and 10 apply them separately:** the `activeVersion` read is **mandatory**,
   and the `previousVersion` read is **best-effort** — including on step 9's
   re-verification, which is not an exception to this asymmetry (see
   "`previousVersion`'s role in this migration is limited and best-effort"
   below).
3. **Wait/retry, within a bounded budget, until every document, inventory and
   required provenance belonging to the checkpoint's selected `activeVersion`
   is readable and validates.** A missing, malformed, inconsistent or
   still-unavailable **active-version** document, inventory or provenance
   (step 6) after that bounded budget aborts this season's cutover with no DO
   state written (step 10); legacy pointers remain authoritative and mutators
   resume exactly as before the attempt. **A selected `activeVersion` in the
   sidecar-required namespace whose sidecar is absent after that budget aborts
   the cutover**, exactly like any other unresolvable active provenance — it is
   never diverted onto the legacy fallback (step 6). A stale legacy pointer read can never
   silently substitute a different version here, because migration never reads
   the live pointer keys at all past step 1.

   **This mandatory-validation rule is scoped to `activeVersion` and does not
   extend to `previousVersion`.** An earlier draft of this step required
   "every checkpoint-named inventory and document" to validate, which — since
   the checkpoint may also name an optional `previousVersion` — made a
   missing or malformed previous version abort the cutover, directly
   contradicting step 8's rule that exactly that condition is **not**
   cutover-blocking. An implementation cannot satisfy both, so the two are
   reconciled here in the direction step 8 and "`previousVersion`'s role in
   this migration is limited and best-effort" already state: **active
   validation is mandatory and aborts on failure; previous validation is
   optional, best-effort, and never aborts the active-version migration.**
   Step 8 defines what a failed previous validation does instead, and step 10
   defines what is then committed in its place.
4. Compute each active document's `snapshotRevision` using the
   already-implemented canonical serializer ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
   D1.7) — the same mechanism ordinary publication and rollback both use;
   the migration introduces no second revision computation.
5. Import each active document's existing public `meta.sourceUpdatedAt` as
   that key's initial `snapshotObservedAt`.
6. **Resolve the selected `activeVersion`'s release-wide source-ordering
   provenance, and import it as `committedSourceOrderingInput`.** This uses
   **exactly the same rules and the same classification discipline as rollback
   provenance** (D8, "Rollback's source-ordering provenance") — one rule, two
   callers, never two rules that can drift apart:
   - **A valid `__publication_metadata` sidecar** (D3) for the selected
     version is used as-is, **whichever namespace its identifier belongs to**.
     A season being cut over may already have one if its selected version was
     itself published by a rollback or a publication that ran after this record
     existed.
   - **An absent sidecar on a legacy-format version** — the expected state for
     a release predating this record — permits the **legacy uniform-document
     fallback**: validate that `meta.sourceUpdatedAt` is uniform across
     **every** document in the selected version and import that single value.
     The current generator writes one release-wide `sourceUpdatedAt` value into
     every document of a release, so a uniform value is expected.
   - **An absent sidecar on a sidecar-required (`pm1-…`) version fails
     closed.** Such a version could not have finalized without the record, so
     `null` means not-currently-readable, never never-written; the fallback is
     **not** available to it, even if its documents happen to carry a uniform
     `meta.sourceUpdatedAt` (which, post-cutover, is a per-key activation
     timestamp — D3, D4).
   - **A malformed sidecar fails closed.** **An unreadable sidecar fails
     closed** — an unreadable record is never treated as an absent one, so a
     read failure can never silently divert migration onto the legacy
     document-inference path.
   - **Non-uniform, missing or malformed legacy document timestamps fail
     closed** — migration does not arbitrarily choose one of them.

   **Eligibility for the fallback is decided by the version-format
   discriminator (D3), never by the KV read returning `null`.**

   Any fail-closed outcome aborts this season's cutover (step 10) with no DO
   state written. **The migration never creates or mutates a
   `__publication_metadata` record under an already-existing historical
   version**: those keys are immutable, a legacy version legitimately has
   none, and backfilling one would write into an artifact this design treats
   as fixed. Any rollback republication created **after** cutover writes its
   own sidecar normally (D8), so new-format provenance accrues going forward
   rather than being retrofitted backwards.
7. Stage the per-key `snapshotRevision`/`snapshotObservedAt` state computed
   in steps 4-5, and the `committedSourceOrderingInput` computed in step 6,
   as this season's initial state (D2) — not yet committed to the DO.
8. **Attempt `previousVersion` validation, best-effort, and seed
   `seasonSnapshotObservedAtHighWaterMark` conservatively, as the maximum
   of:**
   - every imported active-document `snapshotObservedAt` from step 5;
   - every `snapshotObservedAt` importable the same way (steps 2-5, applied
     to `previousVersion` instead of `activeVersion`) from `previousVersion`,
     **only if `previousVersion` was named in the checkpoint and its own
     inventory, documents and importable timestamps all validate** — an
     invalid or absent `previousVersion` is not a cutover-blocking condition,
     exactly as it already is not one for an ordinary rollback request (see
     "`previousVersion`'s role in this migration is limited and best-effort"
     and "The pre-cutover historical-floor activation precondition" below for
     why this is not, by itself, sufficient to activate);
   - the migration's own observation clock at the moment this step runs.

   **What a failed previous validation does, stated as one coherent
   representation rather than left to the implementation:**
   - if previous validation **succeeds**, its observations contribute to the
     high-water-mark seed above **and** its version identifier is what step 10
     commits as the authoritative `previousVersion`;
   - if previous validation **fails**, or the checkpoint named no previous
     version at all, its observations are **omitted** from the seed and step
     10 commits the authoritative `previousVersion` as **`null`** — the
     active-version migration continues unaffected either way. **A selected
     `previousVersion` in the sidecar-required namespace whose sidecar is
     absent is one such failure**: it is omitted and seeded as `null` under
     this same best-effort rule, never rescued by the legacy fallback and never
     escalated into a cutover abort.

   **A previous version that did not validate is never committed as an
   authoritative rollback target.** Atomically seeding a known-invalid pointer
   merely because the checkpoint named it would publish, as authoritative
   recovery state, a version migration has just proven it cannot read or
   validate — the operator would then discover the failure at the moment they
   most need the rollback. Omitting it costs only the default-target
   convenience: an operator may still roll back by explicitly naming a
   version, subject to D8's own target-completeness and provenance rules.
9. **Re-verify the staged state against the same exact versioned keys read in
   step 2 — mandatorily for the selected `activeVersion`, best-effort for the
   optional `previousVersion`.** Because step 2 reads immutable, versioned
   artifacts rather than a live pointer, this re-verification guards against a
   local read failure; it is not, and is not needed as, a wait for external KV
   convergence. The two halves carry the **same asymmetric obligations steps 3
   and 8 already apply**, and this step is not an exception to them:
   - **Active version — mandatory.** The `activeVersion` documents, inventory
     and required provenance staged in step 7 must still be readable and must
     still describe the same revisions, or this season's cutover **aborts**
     (step 10) rather than committing against a local read that failed or
     changed.
   - **Previous version — best-effort, never cutover-blocking.** If a
     `previousVersion` that validated in step 8 fails its step-9 reread,
     becomes unreadable, or no longer validates, **the migration continues**.
     Its observations are **removed** from the staged
     `seasonSnapshotObservedAtHighWaterMark` contribution, and the seed
     commits `previousVersion` as **`null`** — the identical outcome step 8
     already defines for a previous version that never validated. A failed
     previous-version recheck is **never** permitted to fail the
     active-version migration. Treating it as cutover-blocking would
     contradict steps 3, 8 and 10 and the standing best-effort rule; that
     contradiction was a review-confirmed defect, corrected here.

   **Step 10 commits the post-recheck result, never step 8's optimistic
   one** — so a previous version that validated in step 8 and failed in
   step 9 is seeded as `null`, and its timestamps are absent from the
   high-water-mark seed, exactly as if it had never validated.
10. **Commit the complete seed to the Durable Object in one atomic
    operation, only if every prior step for this season succeeded, and
    record the durable cutover-lifecycle state as `seeded`.** The seed
    written in this single operation is, at minimum: the validated
    `activeVersion`; the optional `previousVersion` — the validated version
    identifier only if step 8's best-effort validation succeeded **and step
    9's best-effort recheck still held**, otherwise **`null`**, never a
    checkpoint-named version that failed to validate at either point; the
    imported `committedSourceOrderingInput`; the active per-key `snapshotRevision`;
    the active per-key `snapshotObservedAt`; the conservatively seeded
    `seasonSnapshotObservedAtHighWaterMark`; the checkpoint's migration
    identity/fingerprint; and the `cutoverState` value `seeded` itself. After
    this commit, the Durable Object can answer active (and previous) lookups
    **immediately**, without consulting legacy pointers — but `seeded` is
    **not yet** an active sequencer authority (see "The cutover lifecycle"
    below): legacy pointer state remains the declared authority, and
    publication/rollback mutators for this season remain paused, until the
    separate activation transition in step 11. A missing, malformed or
    inconsistent **required** input at any earlier step — the selected
    `activeVersion`'s inventory, its documents, or its step-6 provenance —
    aborts this season's cutover with no DO state written and no
    cutover-lifecycle transition; legacy KV pointers remain authoritative for
    that season exactly as before migration was attempted, and the season may
    be retried from step 1 once the underlying data problem is fixed. **A
    failed optional `previousVersion` validation is not such an input**: it
    seeds `previousVersion` as `null` (step 8) and the migration proceeds. Migration is only ever
    all-or-nothing per season — no partially-seeded season reaches `seeded`.
11. **Perform one idempotent durable transition from `seeded` to `active`,
    only after step 10 has committed successfully and only once an operator
    supplies an authenticated, explicit activation confirmation bound to the
    exact seeded migration identity/fingerprint**, then switch that season's
    public and administrative authority mode to the sequencer and resume
    that season's publication and rollback mutators. This confirmation:
    - names the season and confirms the seeded `activeVersion` (and, if
      present, `previousVersion`), the committed ordering baseline, the
      per-key state and the high-water mark as still the desired cutover
      target — it is presented to this transition itself, never inferred
      from the mere fact that a `seeded` state exists;
    - is **rejected** if it is missing, or if its migration identity/
      fingerprint does not exactly match the currently `seeded` season's own
      fingerprint — the mismatched-fingerprint handling in "Required
      invariants" below applies: the operator must explicitly abandon,
      restart, or otherwise resolve the seeded attempt, never activate a
      mismatch;
    - authorizes an **operator cutover decision**, not proof that the seeded
      checkpoint is the globally latest legacy state: this design does not
      need, and does not claim, that proof (see "The cutover checkpoint,
      established before migration reads anything" above). If legacy KV
      moved after the checkpoint was selected, confirming and activating the
      seed is an explicit switch to the checkpoint-selected version —
      potentially replacing what legacy KV was serving immediately before
      activation — not evidence that no later legacy write exists;
    - must be **declined** by the operator if, having considered every known
      already-admitted legacy invocation, the seeded checkpoint is no longer
      the intended cutover target — the operator then uses the existing
      different-fingerprint handling to abandon/restart or otherwise resolve
      the seeded attempt, rather than activating a target that is no longer
      wanted;
    - does **not** require, and this design does not provide, a strict
      zero-in-flight legacy-drain guarantee — that remains optional future
      hardening (see "If a future implementation needs a strict
      zero-in-flight drain guarantee" below), not a property this step
      claims today;
    - is itself idempotent: retrying the **same** confirmation against a
      season already `active` under that fingerprint leaves the season
      `active`, unchanged, exactly as a bare retry of the transition already
      is (see "Required invariants" below).

    Switching authority and resuming mutators both wait on this confirmed
    transition alone — never on an assumption that migration "probably"
    succeeded, never on step 10 alone, since `seeded` is not yet `active`,
    and never on the seed's mere existence standing in for operator approval
    (see "The cutover lifecycle").

**Already-admitted legacy invocations, after the boundary.** Closing new
admission (step 1) says nothing about a publication or rollback that was
admitted through the legacy path *before* the boundary closed and is still
executing. This design does not claim, and does not need, a proof that such
an invocation has drained:

- it may still, after the boundary closes and even after this season
  reaches `seeded` or `active`, write one or more immutable versioned
  documents, write the legacy `active:{season}`/`previous:{season}`
  pointers, execute its own existing cache purge, and return its own legacy
  result to its caller — none of that is fenced or prevented by this
  migration;
- **while this season is `uninitialized` or `seeded`, such a late write is
  not inert for authority.** Legacy KV pointers remain the sole authority in
  `uninitialized` and the still-declared authority in `seeded` (D2, D7), so a
  late pointer move can still change what public and administrative routing
  serves during that interval — this is ordinary legacy behavior, unchanged
  by this migration having started or even reached `seeded` for this season.
  It cannot, however, mutate anything already committed to the DO's `seeded`
  state — `activeVersion`, `previousVersion`, `committedSourceOrderingInput`,
  the per-key `snapshotRevision`/`snapshotObservedAt` state, the seeded
  `seasonSnapshotObservedAtHighWaterMark`, or the migration
  identity/fingerprint are fixed the moment step 10 commits and are never
  re-derived from a subsequent legacy pointer read;
- **none of it can regain authority once `cutoverState: active`**, because:
  - the sequencer's `finalize` commit (D2, D4, D9) never reads or writes
    the legacy pointers at all — there is no code path by which a late
    legacy write could be observed by the transition that decides
    authority;
  - a post-activation public or administrative router never consults the
    legacy pointers for authority (D6, D7) — a late legacy pointer write is
    simply never read by anything authoritative again;
  - a late-written immutable versioned document remains **unreachable**
    unless it is later explicitly selected by name (an operator rollback
    target, or a future migration checkpoint) — ordinary readers only ever
    resolve through the sequencer once `active`;
  - a late cache purge changes nothing about authority: it only causes a
    future public request to be served fresh, which then resolves through
    the authoritative sequencer-backed router exactly like any other
    request;
- this is precisely **why** the design does not need to infer Workers KV
  convergence, or fence a late legacy pointer write, to be safe — safety
  here rests on the sequencer and every post-activation reader never
  consulting the legacy pointers at all, not on legacy activity having
  provably stopped.

**This is an operational caution, not a correctness gap.** An operator
should still wait for, or otherwise account for, known in-flight legacy
operations before approving a cutover checkpoint — a late legacy write that
lands after cutover is harmless to authority, but it can still produce a
misleading operational picture (a legacy pointer that appears to move after
migration) and unreferenced orphan data, both avoidable by ordinary
operational care rather than by a stronger guarantee this ADR does not make.

**If a future implementation needs a strict zero-in-flight drain guarantee
instead of this admission-closure model, that guarantee and its supporting
proof must be supplied by the Integration/Cutover PR that builds it — this
ADR does not assume one exists today.**

**The cutover lifecycle, stated explicitly rather than assumed atomic.**
Steps 10 and 11 are two separate durable transitions, not one, and this ADR
does not claim they are effectively atomic: a crash between them is a real,
distinguishable state this design must define, not an interval it can wave
away.

- `uninitialized` — the state of any season this migration procedure has
  never touched. Legacy KV pointers are the sole authority; the sequencer
  holds no seed for this season at all.
- `seeded` — step 10 has committed the complete seed listed above, for a
  specific migration identity/fingerprint. The Durable Object can already
  answer lookups for this season, but it is **not yet** the authoritative
  switch: legacy pointer state remains the declared authority for public and
  administrative routing, and publication/rollback mutators for this season
  remain paused. No code path may treat the Durable Object as authoritative
  for a season still in `seeded`. This is deliberately distinct from, and
  must never be conflated with, D6/D7's forbidden **post-activation** legacy
  KV fallback: `seeded` is a **pre-activation** state in which legacy remains
  authoritative by design, not a fallback reached after authority has
  already moved.
- `active` — step 11's transition has completed. Public/admin routing (D6)
  treats `active` as the authoritative switch, legacy pointers stop being
  read for authority (D7), and the season's mutators resume.

Required invariants:

- A crash after step 10 commits and before step 11 runs resumes as `seeded`
  — distinguishable from both `uninitialized` (no seed exists at all) and
  `active` (the transition already completed) by the durable `cutoverState`
  value itself, never inferred from whether other state happens to be
  present.
- Repeating migration with the **same** migration identity/fingerprint
  against a season already `seeded` or `active` returns the existing seeded
  or active result, rather than reseeding or re-transitioning.
- A migration attempt carrying a **different** seed or fingerprint against a
  season already `seeded` or `active` is **rejected** and requires explicit
  operator handling — it is never silently applied over an existing seed.
- A retry of the step-11 activation transition, carrying the **same**
  operator confirmation and fingerprint, is idempotent: repeating it against
  a season already `active` leaves the season `active`, unchanged. A step-11
  confirmation missing, or naming a fingerprint that does not match the
  currently `seeded` season's own fingerprint, is rejected rather than
  applied.
- No interval exists in which one code path treats legacy KV as
  authoritative for a season while another code path treats the Durable
  Object as authoritative for that same season — `cutoverState` is the
  single value every authority-sensitive code path reads to decide which one
  applies.
- If an atomic single-write per-season authority switch cannot be
  represented by the storage design the Mechanism PR selects, that is a
  **blocker** to state explicitly, not a basis for describing steps 10 and
  11 as "effectively atomic" — this two-state `seeded`/`active` split exists
  specifically because this ADR does not assume that single-write property
  holds.
- **A late-completing, pre-boundary legacy invocation never changes the
  sequencer's own authority, in `uninitialized`, `seeded` or `active` alike**
  — its legacy pointer write, if any, is never read by the sequencer's
  commit or by any post-activation reader (see "Already-admitted legacy
  invocations, after the boundary" above). This is a narrower claim than
  "harmless in every state," and the difference matters: in `uninitialized`,
  legacy KV pointers remain the sole authority, so such a write changes what
  is actually served, exactly as it always has; in `seeded`, legacy pointers
  are still the declared live authority for public and administrative
  routing, so such a write may still change what those routes serve during
  the remaining pre-activation interval, even though it can never mutate the
  DO's already-committed seed; only in `active` is the write fully inert —
  never read by the sequencer's commit, by any post-activation reader, or by
  anything else authoritative.

**The pre-cutover historical-floor activation precondition.** An earlier
draft claimed that `activeVersion`, `previousVersion` and the migration's
own clock necessarily dominate every older, unenumerable timestamp this
season has ever produced. That claim is **disproven** by
[ADR 0020](0020-provider-source-observation-and-reconciliation.md) D1.11a: a
clock-regression clamp can place a historical `snapshotObservedAt` **ahead
of** the wall-clock time at which it was actually assigned, so a timestamp
held only by an unenumerable pre-cutover version is not guaranteed to be
less than `max(active, previous, migration-now)`.

This is not only a deep-rollback problem, and restricting rollback to
`activeVersion`/`previousVersion` does not fix it: the identical exposure
occurs through **ordinary publication**. If a key that existed only in an
unenumerable pre-cutover version is later restored by an ordinary
publication (not a rollback) after cutover, and an offline client still
holds that pre-cutover snapshot with its clamped, ahead-of-wall-clock
timestamp, the freshly-assigned post-cutover timestamp can be less than or
equal to what that client already holds — the same rejection this design
exists to prevent for a withdrawn-then-restored key.

The real guarantee this migration provides, stated precisely:

- The imported floor covers exactly the selected `activeVersion` and any
  validated `previousVersion` named in the checkpoint.
- From a successful activation forward, every committed fresh activation
  advances from the durable `seasonSnapshotObservedAtHighWaterMark` (D2, D4,
  D9), so the guarantee is **complete** for all post-cutover history — no gap
  exists for anything committed after activation.
- The migration **cannot prove** that its seed exceeds a timestamp held only
  by a pre-cutover version outside any complete, audited set — a version whose
  KV keys were deleted, one temporarily omitted from an eventually consistent
  prefix scan, one recorded only externally by an operator, or a snapshot
  retained only by an offline client. The repository's `listVersions` prefix
  scan can name retained version keys and is useful audit evidence, but it
  cannot prove that set complete (see "The completeness limit" below), and a
  D1.11a clock-regression clamp may in any case have placed such a historical
  timestamp ahead of migration wall time.

**Activating this authority for a season therefore requires establishing one
of the following, as an explicit precondition — never a vague "reopening"
note to revisit later:**

- a trustworthy historical index or an audited upper bound over every
  timestamp this season's pre-cutover history could contain is imported into
  the seed. **The existing `listVersions`/`retainedVersions` prefix scan is
  not, by itself, such an index** — it is eventually consistent, cannot prove
  no key was omitted, and cannot see deleted, externally recorded or
  client-retained history (see "The completeness limit" below). It may serve
  as an *input* to such an audit; satisfying this alternative requires the
  completeness argument, not merely running the scan; or
- an audit specifically proves no uncovered future-clock/clamp value exists
  for this season's pre-cutover history; or
- the target environment has **no** retained pre-cutover client state for
  this season (no offline client holds a snapshot predating the cutover); or
- a separately authorized client-baseline reset or contract migration
  removes any such retained client state before activation.

**This repository, today** — a statement about current environment
evidence, not a general guarantee this ADR can claim indefinitely on the
repository's behalf: staging has never activated this design (nothing in
this ADR is implemented), and production remains dormant
(`PROVIDER_MODE = "none"`, no deployment). Neither fact **by itself**
establishes "no retained pre-cutover client state" as a durable property —
each establishes only that, **today**, no client has yet had the opportunity
to retain one. Whichever environment first attempts activation must
re-establish the relevant precondition against its own state at that time;
this sentence is not a substitute for doing so.

If satisfying this precondition requires a new public client contract or a
data reset, that is separate future authorization this documentation
correction does not itself grant.

**The completeness limit, stated precisely rather than assumed away.** An
earlier draft justified this seed's scope by claiming that nothing in this
system can list or discover a season's versions at all. **That claim was
false, and is corrected here** — a listing capability exists today:

- `SnapshotStorage.listVersions(season)` is part of the storage interface
  (`services/edge-api/src/storage/types.ts`).
- `WorkersKvSnapshotStorage` implements it with a **paginated `kv.list` over
  the `snapshot:{season}:` prefix** (`services/edge-api/src/storage/kv.ts`),
  deriving each version through `parseVersionFromSnapshotKey`.
- The admin status route exposes the result as `retainedVersions`
  (`services/edge-api/src/admin/router.ts`).

So this system **can** discover versions represented by keys visible to that
prefix scan at the time it runs, and that set is legitimate **audit
evidence**. What it is **not** is an authoritative, completeness-proving
historical index:

- the scan is **eventually consistent** — it cannot prove that no key is
  temporarily omitted from the result it returned
  ([ADR 0010](0010-workers-kv-consistency-limitation.md));
- it cannot recover versions whose KV keys were **deleted** (D5's orphan
  cleanup, and any operator-performed deletion, remove them permanently);
- it cannot enumerate versions that exist only in an **operator's external
  records**, nor bound a timestamp held only in a **snapshot retained by an
  offline client**, neither of which is represented by any KV key at all.

**Terminology.** Where this ADR and its mirrors call pre-cutover history
"unenumerable", that means precisely **history outside a complete, audited
set** — the deleted, temporarily omitted, externally recorded and
client-retained cases just listed. It has never meant, and must not be read
as meaning, that Workers KV or this repository lacks a version-listing
capability. It does not.

**Therefore `listVersions`/`retainedVersions` cannot, by itself, establish the
historical timestamp upper bound the activation precondition requires** — it
answers "which version keys are visible to this scan now", not "no
pre-cutover timestamp exceeds this floor". It is available as supporting
evidence for such an audit, never as a substitute for one.

The migration seed is therefore limited to the selected `activeVersion` plus
a validated best-effort `previousVersion` (D7) for the honest reason: those
are the **bounded, authoritative checkpoint inputs** an operator has approved
and this procedure can read by exact immutable key and fully validate — not
because no listing exists. Anything beyond that bound is covered by the
separately enforced activation precondition above, not by widening the seed
to a set the scan cannot prove complete. This is not a new gap this ADR
introduces: today's KV-pointer design has exactly the same blind spot for a
rollback target older than `previousVersion`, resolved only by an operator's
own external record-keeping, unchanged by this migration. Making
`listVersions` an authoritative historical index — rather than the
eventually consistent, operator-facing audit listing it is — would require
its own decision about completeness guarantees and retention, which this ADR
does not take. Nothing here changes the public read path: **public readers
still never enumerate snapshot versions**
([ADR 0007](0007-versioned-kv-publication-active-pointer.md)), and
`listVersions` remains an internal/admin capability only.

**`previousVersion`'s role in this migration is limited and best-effort.**
It is only: (a) an optional operator-selected cutover fallback, named in the
checkpoint; (b) an additional conservative timestamp input folded into the
seeded high-water mark when its own inventory and documents validate
(step 8, re-verified best-effort in step 9). "Best-effort" is a statement
about **both** halves, and both are now stated in one place rather than split
across steps that disagreed: validating it is **never mandatory** and its
failure **never aborts** the active-version migration **at any step that
touches it — steps 3, 8, 9 and 10 alike**; and a previous version that did
not validate, **or that validated in step 8 and then failed step 9's
recheck**, is **omitted from the seed and committed as `null`**, never
committed as an authoritative rollback target on the strength of the
checkpoint having named it. It is **never** evidence, by itself, that this season's deeper
history contains no timestamp higher than what `activeVersion`/
`previousVersion` already cover — the existing race and rollback behavior
mean it may not, which is exactly why the activation precondition above is
a separate, explicit requirement rather than something `previousVersion`'s
mere presence is assumed to satisfy.

**What the migration does and does not activate.** Computing revisions and
importing timestamps in steps 2-9 happens entirely within this
separately-authorized, operator-controlled migration procedure — it is where
`snapshotRevision` first becomes a real baseline for existing production
data, not a claim that this documentation PR activates anything. `snapshotRevision`
still has no production caller until this migration runs, and this migration
does not run as part of merging this PR. No authority switch occurs on
partial success (step 10 of the migration procedure, `cutoverState` staying
`uninitialized`); legacy pointers remain authoritative for a season until
that season's migration procedure — through its own idempotent activation
transition, step 11, to `cutoverState: 'active'` — completes in full (step 3
of the cutover sequence above).

**Future migration tests, Mechanism/Integration-PR scope:**

- The first post-cutover `prepare` for a season whose migration ran, given an
  unchanged candidate, retains every seeded per-key timestamp.
- The first post-cutover `prepare` for a season whose migration ran, given a
  candidate with one changed key, assigns that key a timestamp strictly
  greater than the seeded high-water mark, and leaves every unchanged key's
  seeded timestamp untouched.
- A key restored via ordinary publication or rollback after migration
  receives a timestamp using the seeded high-water floor, never a value
  derived from that key's pre-migration history.
- A malformed, missing or empty active inventory aborts migration for that
  season with no DO state written (step 10) and legacy pointers left
  authoritative.
- A season whose migration completes only partially (any step 1-9 failing)
  never reaches `cutoverState: 'seeded'` for that season, and therefore never
  reaches an authority-mode switch.
- Migration retried after an aborted attempt is idempotent: re-running steps
  1-9 against the same checkpoint produces the same staged per-key state and
  the same seeded high-water mark as the first attempt.
- **A stale legacy pointer read cannot substitute a different version**: a
  test simulating a legacy pointer that changes after step 2's versioned-key
  read proves migration still commits against the checkpoint's originally
  named version, never the pointer's new value, because migration reads only
  by exact versioned key past step 1.
- **Incomplete payload propagation is bounded, not silently accepted**: a
  test in which a document of the checkpoint's selected **`activeVersion`**
  remains unreadable for longer than the bounded retry budget in step 3
  proves migration aborts with no DO state written, rather than proceeding on
  a partial read. The companion test for the same condition on the optional
  `previousVersion` proves the opposite outcome, per step 3's scoping rule
  and step 8.
- **A mismatched checkpoint fingerprint on retry is rejected**: a test
  presenting a different migration identity/fingerprint against a season
  already `seeded` or `active` proves the attempt is rejected rather than
  silently applied.
- **Step-6 provenance resolution, one case per classification**:
  - a selected active version carrying a **valid** `__publication_metadata`
    sidecar imports that value as `committedSourceOrderingInput`, without
    inspecting document timestamps at all;
  - a selected **legacy-format** active version with an **absent** sidecar and
    **uniform** legacy `meta.sourceUpdatedAt` across every inventory-named
    document imports that single value;
  - a selected **legacy-format** active version with an absent sidecar and
    **two different** legacy `meta.sourceUpdatedAt` values aborts migration (no
    DO state written) rather than importing an arbitrarily-chosen one;
  - a selected active version in the **`pm1-…` namespace** with an **absent**
    sidecar aborts migration, proven to still abort when its documents carry a
    uniform `meta.sourceUpdatedAt` — the discriminator, not the KV `null`,
    decides fallback eligibility;
  - a selected **`pm1-…`** `previousVersion` with an absent sidecar is
    **omitted and seeded as `null`**, and does not abort the active-version
    migration — the same best-effort rule as any other previous-validation
    failure;
  - a **malformed** sidecar aborts migration, and is proven **not** to fall
    back to document inference;
  - an **unreadable** sidecar aborts migration, and is likewise proven **not**
    to fall back to document inference — the test distinguishes it from the
    absent case explicitly;
  - no case writes or mutates a `__publication_metadata` record under the
    already-existing historical version being migrated.
- **Active-version provenance is mandatory; a failure to resolve it aborts
  migration**, proven with no DO state written and legacy pointers left
  authoritative.
- **A valid optional `previousVersion` contributes to the seeded high-water
  mark and becomes the authoritative seeded `previousVersion`.**
- **An invalid, unreadable or malformed optional `previousVersion` is omitted
  from the seed, sets the authoritative seeded `previousVersion` to `null`,
  and does **not** abort the active-version migration** — the season still
  reaches `seeded` with its complete active state.
- **Step 3's mandatory-validation rule is never applied to optional previous
  data**: a test naming a `previousVersion` whose inventory or documents do
  not validate proves the cutover proceeds, distinguishing this explicitly
  from an active-version validation failure, which aborts.
- **A `previousVersion` that validates in step 8 but fails step 9's recheck
  does not abort the cutover.** With the active version re-verifying cleanly
  and the previous version's step-9 reread failing (unreadable, or no longer
  describing the same revisions), the test proves the season still reaches
  `seeded`; that step 10 commits `previousVersion` as **`null`**, not the
  optimistic step-8 identifier; and that the previous version's timestamps are
  **absent** from the committed `seasonSnapshotObservedAtHighWaterMark` — the
  seed being byte-identical to the one produced when that previous version had
  never validated at all.
- **Step 9's abort path is scoped to the active version**: a test failing the
  active version's step-9 re-verification proves the cutover aborts with no DO
  state written, while the same failure injected only on the previous version
  proves it does not.
- **Cutover-lifecycle restart tests**, each proving the exact resulting
  `cutoverState`, whether legacy pointers or the Durable Object are
  authoritative, and whether mutators are paused or resumed:
  - crash before any seed is written (resumes `uninitialized`, legacy
    authoritative, mutators for this season unaffected by this migration);
  - crash immediately after step 10 commits (resumes `seeded`, legacy still
    authoritative, mutators still paused);
  - a repeated identical seed attempt (same migration identity/fingerprint)
    against an already-`seeded` or already-`active` season (idempotent,
    returns the existing result, no re-seed and no re-transition);
  - a conflicting seed attempt (different identity/fingerprint) against an
    already-`seeded` or already-`active` season (rejected, requires explicit
    operator handling);
  - crash during the step-11 activation transition (resumes `seeded` until
    the transition is retried and completes; never observed as a
    partially-active state);
  - a repeated activation transition against an already-`active` season
    (idempotent, remains `active`, no re-effect);
  - read and mutator behavior probed in each of the three `cutoverState`
    values (`uninitialized`, `seeded`, `active`), proving legacy pointers are
    authoritative and mutators run normally in `uninitialized`, legacy
    pointers remain authoritative and this season's mutators stay paused in
    `seeded`, and the Durable Object is authoritative with mutators resumed
    only in `active`.
- **Already-admitted legacy invocation tests**, each proving a pre-boundary
  legacy invocation's late completion never regains or affects DO authority:
  - a legacy invocation admitted before step 1's admission closure that only
    completes (writes its immutable documents and its legacy pointer) after
    this season reaches `seeded` — the DO's seeded state (`activeVersion`,
    `previousVersion`, `committedSourceOrderingInput`, per-key state, HWM) is
    unchanged by that completion, **but** the legacy pointer it wrote does
    change what public/admin routing serves during the remaining
    pre-activation interval, because legacy pointers are still the declared
    authority while `seeded` — this is the state-specific case that
    distinguishes "DO state unchanged" from "authority unaffected";
  - a late-completing legacy invocation in `uninitialized` (before this
    season's migration has run at all) changes the legacy-authoritative
    active/previous state exactly as it always has — ordinary legacy
    behavior, not a special case this migration introduces or suppresses;
  - the same scenario, but the late completion lands after this season
    reaches `active` — the DO's active state and every subsequent public
    lookup are unaffected, and the router never observes the legacy pointer
    change;
  - the late legacy pointer write itself is proven **never read** by any
    sequencer-authorized code path in either case;
  - the late invocation's immutable versioned documents are proven
    **unreachable** through ordinary public/admin resolution after
    activation, remaining reachable only if later explicitly selected by
    name;
  - the late invocation's own cache purge is proven to leave the
    sequencer-authoritative DO state untouched, only affecting which cached
    response a future request receives before it re-resolves through the
    authoritative router;
  - a new legacy publication or rollback attempted after step 1's admission
    closure is proven **rejected outright**, distinguishing "new admission
    rejected" from "already-admitted invocation still running."
- **Operator activation-confirmation tests** (step 11):
  - activation attempted with no confirmation, or a confirmation naming a
    migration identity/fingerprint that does not match the currently
    `seeded` season's own fingerprint, is **rejected** — the season stays
    `seeded`, unchanged;
  - activation attempted with a confirmation naming the exact seeded
    fingerprint **commits the checkpoint-selected state** — including when a
    simulated legacy pointer write has landed and changed the legacy
    `active:{season}`/`previous:{season}` keys after step 10 seeded but
    before step 11 confirmed — proving activation switches to the
    checkpoint-selected version, not to whatever the legacy pointer most
    recently read;
  - an operator who declines to confirm (because, having reviewed known
    already-admitted legacy invocations, the seeded checkpoint is no longer
    the desired target) leaves the season `seeded` indefinitely, with no
    forced or implicit activation — the season is only ever moved forward by
    an explicit conflicting-fingerprint abandon/restart or by a later,
    correctly-fingerprinted confirmation;
  - retrying the **same** confirmation (identical fingerprint) against a
    season already `active` is idempotent — the season remains `active`,
    unchanged, and no re-effect occurs.
- **Cutover refuses activation when the historical-floor precondition is
  unresolved**: a test asserting that step 11 (or an equivalent activation
  gate) requires one of "The pre-cutover historical-floor activation
  precondition"'s four conditions to be recorded as satisfied for that
  season before the transition to `active` is permitted, and that its
  absence blocks activation rather than being silently assumed.

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
| **`blockConcurrencyWhile` around document generation or an external pointer write** | **Rejected for that scope**, for two independent reasons: it blocks every other caller of the DO id for the duration of work that can be slow (throughput anti-pattern), and it carries a 30-second reset with no documented guarantee about an external write in flight at the moment it fires — see D10, D9. |
| **A public activation-epoch field** | **Rejected for this phase.** `operationEpoch` is internal Durable Object coordination state (D2, D9) and must not appear in any published document or the public contract (D8). |
| **Direct pointer-flip rollback** (the pre-existing rollback design) | **Superseded by Model 1** (D8). Rollback now republishes historical data as a new immutable version through the same `prepare`/`finalize` protocol as ordinary publication; it never flips `activeVersion` directly. |
| **An application-level in-memory single-flight guard (`commitPromise`) as a correctness-critical mechanism** | **Rejected — no longer needed, not merely unused.** It was necessary only while the critical section spanned an awaited external Workers KV write, which an ordinary input gate does not cover. D2 removed that external write; `finalize`'s entire critical section is now one Durable Object storage transaction, which an ordinary input gate already serializes (D9). Retaining the guard would be leftover machinery from the rejected KV-authoritative design. |
| **An ordinary source-ordering staleness rejection applied unconditionally to every `prepare` call, including rollback** | **Rejected.** It would make the authorized Model 1 (D8) impossible to execute, since a rollback's historical ordering input is expected to be older than or equal to what is currently active. Replaced by the bounded `operationKind` exemption in D4, which narrows the exception to rollback admission only and leaves ordinary publication's rejection untouched. |
| **Claiming atomicity between a Durable Object cancellation check and an external Workers KV deletion during orphan cleanup** | **Rejected — not implementable.** No cross-product atomicity between Durable Object storage and Workers KV exists (§"Safety reasoning" is this ADR's own premise). Replaced in D5 by a non-atomic two-step sequence whose safety rests on the named cancelled epoch being terminal **and** on D3/D4's structural guarantee that a candidate version belongs to exactly one epoch, with the external KV deletion remaining best-effort. |
| **Authorizing orphan cleanup from epoch terminality alone** (a "yes, some epoch is cancelled" answer, with a caller-minted candidate version) | **Rejected — a review-confirmed race.** Terminality of epoch A never made *version V* terminal. With a caller-minted version, a later epoch B could re-use V, and A's delayed cleanup could delete artifacts B had already written but not yet finalized. Replaced by DO-allocated, epoch-bound candidate versions (D3, D4) plus a cleanup authorization that names the exact cancelled epoch, token and version and refuses a superseded record or an authoritative version (D5). |
| **An unbounded map of retired committed results, retained so any delayed `finalize` retry can always replay its original response** | **Rejected — unbounded history in the one place D3 refuses it, for an answer the caller cannot use.** It would grow per-operation state without limit, and would still not tell a caller whose epoch is retired anything actionable. Replaced by D9's total outcome table: the recorded result is replayed only while that committed operation is the **current** durable record; a lower epoch resolves to a distinct terminal `superseded` outcome carrying current authoritative state, which resolves what the caller must do now without claiming to reproduce the retired response. |
| **Recovering a rollback target's historical `sourceOrderingInput` from Durable Object state alone** | **Rejected — the value is not there.** `committedSourceOrderingInput` describes only the currently active release and is replaced by every successful `finalize` (D2); the prepared-operation record is replaced by every new `prepare`, cancellation, expiry or supersession (D4/D5). Once a release is superseded, nothing in DO state retains its ordering input, so a rollback to it would have no value to record — which is exactly the gap D3's immutable per-version sidecar closes. |
| **Requiring an operator to supply the historical `sourceOrderingInput` for a normal rollback** | **Rejected.** It would put an unaudited, unverifiable, hand-typed timestamp into the one field ordinary-publication admission is decided against (D4), make rollback non-deterministic for the same target, and turn a recoverable data question into a human-recall question at the moment of an incident. The value is recoverable from the target's own immutable record (D8); an operator is asked to select a version, never to invent its provenance. |
| **Publishing `sourceOrderingInput` in the public snapshot documents, or overloading `meta.sourceUpdatedAt` to carry it** | **Rejected.** It would add a public contract field for an internal admission input (no client needs it), and `meta.sourceUpdatedAt`'s post-cutover meaning is already fixed as that key's per-key `snapshotObservedAt` (D4, [ADR 0020](0020-provider-source-observation-and-reconciliation.md) D1.8-D1.10) — overloading it would destroy the per-key activation semantics the whole observation clock depends on. |
| **Adding the metadata record to `__inventory`, or reshaping `__inventory` into an object carrying it** | **Rejected.** `__inventory` is the list of **public document names**, consumed today by route mapping, purge expansion and completeness assessment; adding an internal record to it would make every one of those consumers responsible for filtering it out, and reshaping it would be a breaking migration for existing inventory readers for no gain. The sidecar is a sibling key under the same version prefix instead (D3). |
| **Backfilling a `__publication_metadata` record onto an already-existing legacy version during migration** | **Rejected.** Those versioned keys are immutable by design (ADR 0007), a legacy version legitimately has no such record, and writing one would mutate a historical artifact this design treats as fixed. The legacy uniform-document fallback (D8, D12 step 6) resolves such a version's provenance without touching it, and any rollback of it writes new-format provenance into the **new** version it creates. |
| **Inferring "this version predates the sidecar" from the sidecar key reading `null`** | **Rejected — undecidable, and unsafe in both directions.** Workers KV document storage stays eventually consistent (ADR 0010), so a written-but-not-yet-propagated record reads exactly like one that was never written; D6 already treats "named but not yet readable" as a real state. Absence therefore cannot distinguish a legacy version from a new-format version whose record has not arrived, and guessing "legacy" would run document inference against a release that has an authoritative value. Replaced by the explicit `pm1-…` version namespace (D3): the identifier says whether a record was required, and the KV read says only whether it is currently readable. |
| **Using uniformity of `meta.sourceUpdatedAt` as the legacy discriminator** | **Rejected — it is not a discriminator at all.** D4 assigns every changed, new or restored key admitted in the same `prepare` call the same freshly computed timestamp, so a post-cutover release in which every key changed is *uniform* across its documents. That uniform value is a per-key activation timestamp, not a release-wide `sourceOrderingInput`; accepting it would install a silently wrong committed ordering baseline for every subsequent ordinary publication. Uniformity is a validity check *within* the legacy fallback, never the test for entering it. |
| **A durable per-season "sidecar era began at" record, or a cutover-time flag, as the discriminator** | **Rejected for this decision.** It would put the answer in mutable per-season state that a rollback to a version older than the flag still could not interpret, add a value migration must seed correctly for the discriminator itself to be trustworthy, and make provenance depend on reading two things instead of one. The version identifier already travels with every artifact that needs classifying — including in an operator's external records — and is immutable by construction. |
| **Treating an unreadable metadata record as an absent one** | **Rejected.** An unreadable read says nothing about the version — including whether it ever recorded a sidecar — so silently selecting the legacy document-inference path on a read failure could publish a document-derived value for a version that had an authoritative one. D8 keeps *absent*, *malformed* and *unreadable* as three distinct outcomes, exactly as `version-inventory.ts` already does for inventories. |
| **An unbounded per-key tombstone history** (retaining every withdrawn key's last `snapshotObservedAt` indefinitely, keyed by document identity, instead of one season-wide scalar) | **Rejected — unnecessary for the property needed.** A per-key floor only needs to be *at least as high* as every value the sequencer has itself authoritatively committed for any key this season to keep a restored key's timestamp ahead of anything a client of **post-cutover** history could hold; a single monotonic `seasonSnapshotObservedAtHighWaterMark` (D2, D4) already provides that floor for every key, current or withdrawn, for that post-cutover history, without storage proportional to how many distinct keys have ever existed or been withdrawn and restored. Coverage of **pre-cutover, unenumerable** history is a separate question this scalar alone does not answer — that is D12's migration seed and its historical-floor activation precondition, not a larger in-DO tombstone structure; an unbounded per-key tombstone map would not close that gap either, and would only reintroduce the unbounded-history growth D3's capacity argument exists to avoid, for a property one constant-size scalar already secures for the history it does cover. |

## Failure-state model

The table below distinguishes six identities or state values used throughout
this design. Its **first three rows** are the operation identities whose
conflation is how the duplicate-replay race in "Context" happens in the first
place; the **remaining three rows** list additional durable per-season
authority and coordination values that the same state model must keep
distinct. An application-level in-memory single-flight guard appeared in an
earlier draft and is deliberately **not** carried forward: see "Rejected and
superseded alternatives" and D9 for why it no longer serves a purpose once the
commit is one Durable-Object-storage-protected transaction.

| Identity | Lifetime | Purpose |
|---|---|---|
| `operationToken` | One `prepare()` call | Caller-facing handle; presented back to `finalize`/`cancel` **together with `operationEpoch`** — the two form the caller-visible operation identity (D9) |
| `operationEpoch` | Durable, monotonic, per season | The actual fencing value every transition checks; increments on every admitted `prepare`. Also **caller-visible** (half of the operation identity) and the value whose injective encoding makes each `candidateVersion` unique to exactly one epoch (D3, D4) |
| Durable operation record | Durable, until superseded | `{epoch, token, operationKind, phase, priorVersion, candidateVersion, perKeyRevisions, assignedTimestamps, sourceOrderingInput, expectedManifestCommitment, preparedAt, deadline}` — sole restart-recovery source of truth, and the only source `finalize` reads from (D4). `candidateVersion` is **allocated by `prepare`**, never supplied by the caller. Because only the current record is retained, the recorded-result replay guarantee is bounded to while it is current; past that, D9's `superseded` outcome applies |
| `seasonSnapshotObservedAtHighWaterMark` | Durable, monotonic, per season — never scoped to a single key or a single operation | The per-season timestamp floor a fresh-activation assignment must exceed (D4); advanced only by a committed `prepared → committed` transition (D9), never by a `prepared`, `cancelled` or `recovery-required` state |
| `committedSourceOrderingInput` | Durable, per season — describes the currently committed release only, not a monotonic history | The value ordinary-publication staleness admission (D4) compares a new candidate's `sourceOrderingInput` against (strictly older rejected, equal or newer admitted); replaced only by a committed `prepared → committed` transition (D4, D9, D8), never by a `prepared`, `cancelled` or `recovery-required` state |
| `cutoverState` | Durable, per season, exactly `uninitialized` \| `seeded` \| `active` (D12) | Which authority — legacy KV pointers or this Durable Object — is currently declared authoritative for the season; transitions `uninitialized → seeded` (migration step 10) then `seeded → active` (migration step 11), each an idempotent, independently-recorded transition |

### State transition table

There are exactly two operation-carrying durable states, `prepared` and
`committed`, plus the non-operation state `idle` and the two terminal states
`cancelled` and `recovery-required`. **There is no durable `committing`
state** — an earlier draft's claim of one contradicted its own claim that the
transition is atomic; see D9.

| State | Permitted caller | Durable mutation | External KV action | New candidate admitted? | Cleanup allowed? | Restart behavior | Idempotent retry? |
|---|---|---|---|---|---|---|---|
| `idle` | anyone | none | none | yes — any `prepare` | n/a | resumes `idle` | trivially |
| `prepared` | holder of current epoch/token | writes the full operation record (D4) in one transaction | none | only as an atomic *replacement* of this record | not yet | resumes `prepared`, with every value D4 records intact; deadline re-evaluated | `prepare` retried is a fresh epoch; old one retired |
| `committed` | n/a for this epoch | one atomic `prepared → committed` transition: activeVersion, previousVersion, `committedSourceOrderingInput`, per-key state and `seasonSnapshotObservedAtHighWaterMark` all written together with the phase change | **none** | yes — next `prepare` | yes, for epoch(s) it superseded | resumes `committed` | **while this record is current**: a retry of its epoch+token returns the recorded result. **Once a newer `prepare` supersedes it**: the lower epoch resolves to `superseded` plus current authoritative state, never the retired response (D9) |
| `cancelled` | n/a | epoch marked cancelled; **terminal** — never transitions to `prepared` or `committed` (D5) | none | yes | yes, but only against the **named** cancelled epoch+token+version while that record is still current, and never for a version that is or may become authoritative (D5; non-atomic with the external KV deletion) | resumes `cancelled` | trivially |
| `recovery-required` | admin only | none automatic | none automatic | **no** | no | resumes `recovery-required` until operator clears it | not applicable by design |

`recovery-required` is retained in the vocabulary as a defensive terminal
state for a genuine operation-level invariant violation the Mechanism PR's
own tests can define (for example, a durable record the code cannot
reconcile with any defined transition) — **not** as an intermediate state an
atomic commit supposedly leaves behind, and **not** because an ambiguous
external write is expected under this design. Under D2, the class of failure
that previously motivated `recovery-required` (an ambiguous KV write) no
longer exists, because there is no external write in the commit path to be
ambiguous about.

## Testing obligations

Deterministic, application-logic tests the Mechanism PR must include:

- Two simultaneous same-identity `finalize` calls resolve to one committed
  result, never two writes — the second observes `committed` and returns the
  recorded result rather than re-entering the transaction (D9).
- A same-identity retry arriving after the original `finalize` call's storage
  transaction has already completed, **while that record is still the current
  durable record**, observes `committed` and returns the recorded result
  deterministically, never re-evaluating the operation.
- A `prepare` for a new candidate is rejected while an operation for the same
  season is `prepared` and not yet superseded, cancelled or expired.
- A stale (superseded) epoch's `finalize` performs no storage mutation.
- A `prepared` operation replaced by a later `prepare` durably retires the
  old epoch atomically with installing the new one; a subsequent
  `finalize(oldEpoch, oldToken)` never commits.
- A stale `finalize` after a `prepared`-then-cancelled identity is rejected,
  no version is deleted while its status is ambiguous.

**Candidate-version ownership and cleanup safety (D3, D4, D5):**

- **`prepare` allocates the candidate version; the caller cannot supply one.**
  The API accepts no `candidateVersion` argument, and the returned version is
  in the `pm1-…` namespace.
- **Distinct epochs never receive the same candidate version.** Across a
  sequence of `prepare` calls for one season — including cancelled, expired
  and superseded ones — every allocated version is distinct, and each decodes
  to the epoch that allocated it (injective encoding, D3). The property is
  asserted without any Workers KV read, list or existence check.
- **A retry of the same live operation identity allocates no new version**;
  a genuinely new `prepare` allocates a new epoch and therefore a different
  version.
- **The exact review race is proven impossible.** Epoch A is prepared for
  version V and then cancelled; epoch B is admitted afterward; B writes its
  artifacts and has not yet finalized; A's cleanup authorization is only now
  requested and acted on. The test asserts that B's version is **not** V, that
  A's cleanup authorization is **refused** because A's record is no longer the
  current durable record, and — even if a stale authorization obtained earlier
  is replayed — that acting on it can only delete V, never any artifact B
  wrote. B's subsequent `finalize` commits onto documents that still exist.
- **Cleanup authorization requires the full triple.** A request naming the
  right epoch but the wrong token, the right identity but the wrong
  `candidateVersion`, or an epoch that has since been superseded, is refused.
- **Cleanup is refused for an authoritative version**: `activeVersion`,
  `previousVersion`, the current prepared candidate and the current committed
  operation's candidate are each refused.
- The external KV deletion remains best-effort and is **never** asserted to be
  atomic with the DO decision; a failed deletion leaves an unreferenced
  version and no authoritative state change.

**Delayed retries and the superseded outcome (D9):**

- **Duplicate `finalize` while the committed record is current** returns the
  recorded result, once, with no second write.
- **A lost `finalize` response followed by a newer `prepare`**: the original
  caller's retry no longer returns the retired recorded result, and returns
  the `superseded` outcome instead.
- **Delayed retry after the newer operation is `prepared` but not committed**
  resolves to `superseded` plus the current authoritative state.
- **Delayed retry after the newer operation commits** likewise resolves to
  `superseded` plus the then-current authoritative state.
- **Classification is exact**: a *lower* epoch yields `superseded`; the
  *current* epoch with a non-matching token yields an invalid/stale-identity
  rejection, never `superseded`; a *higher* epoch or a malformed identity
  fails closed.
- **`superseded` initiates no duplicate publication**: the publisher-side test
  proves a caller receiving `superseded` does not re-drive, replay or
  republish the old candidate, and that any new publication goes through a
  fresh `prepare` with its own epoch and its own version.
- **No unbounded result history is retained**: after N successive committed
  operations for a season, the sequencer holds at most the current operation
  record — retired results are not accumulated.

The completion-attestation obligations below are split by what each test can
actually prove: a **Durable Object** test proves this comparison behaves
correctly given whatever attestation it is handed; a **`SnapshotPublisher`**
test proves the publisher only ever hands it a truthful one. Neither
substitutes for the other, and no single test may claim to cover both.

**Durable Object tests:**

- **The `expectedManifestCommitment` is computed before `prepare` is ever
  called**: given the same normalized candidate data and document identities,
  the caller's deterministic manifest enumeration produces the same
  commitment whether computed once or repeated, and `prepare` is shown to
  accept it as an input rather than compute or derive it itself.
- **A restart between `prepare` and `finalize` does not lose the ability to
  finalize correctly**: after simulating a restart, `finalize` for the
  surviving `prepared` record still commits the exact per-key
  `snapshotRevision`/`snapshotObservedAt` values `prepare` originally
  assigned, and still holds the exact `expectedManifestCommitment` `prepare`
  recorded, read entirely from the durable record (D4) — no in-memory state
  is required.
- **A `completionAttestation` carrying a manifest commitment that does not
  match the durably-recorded `expectedManifestCommitment` for the current
  epoch is rejected by `finalize`**, with no state transition.
- **A token or epoch belonging to a different operation is rejected** —
  stale, superseded, cancelled, or simply never issued — `finalize` never
  commits against a durable record other than the one its own epoch/token
  identify.
- **When the token and the manifest commitment both match, `finalize`
  commits exactly the durable per-key `snapshotRevision`/`snapshotObservedAt`
  assignments `prepare` recorded for that epoch** — nothing recomputed and
  nothing read from the attestation's payload itself.
- **None of the above is described, in the test or its assertions, as
  proving Workers KV contents, document completeness or global visibility**
  — each proves only a value comparison and a durable-storage transition
  internal to the Durable Object, per "The guarantee's precise boundary" in
  D4.
- **The chosen SQLite-backed representation handles the largest supported
  release inventory without relying on one oversized serialized value**: a
  test using a release-sized document manifest (drivers, constructors,
  circuits and Grand Prix routes at the largest count this codebase
  currently supports) proves the per-key state either lives in bounded,
  atomically-updated per-key records, or that a serialized-state size limit
  is enforced before any versioned KV document is written, per D9's capacity
  obligation.
- **A key present in the currently active inventory, whose candidate revision
  matches, retains its existing `snapshotObservedAt` even when other keys in
  the same `prepare` call change** — retirement of a *different*, absent
  key's per-key state (D3) never causes an unrelated, still-active,
  unchanged key to be reassigned a timestamp.
- **A key absent from the currently active inventory is always treated as a
  fresh activation**, assigned `max(now, seasonSnapshotObservedAtHighWaterMark
  + 1 ms)` — never rejected for lack of a per-key `previous` value, and never
  compared against a stale value the key held before it was withdrawn (D3's
  per-key retirement makes that old value unavailable by design).
- **`seasonSnapshotObservedAtHighWaterMark` only advances on a successful
  `prepared → committed` transition, to `max(prior high-water mark, every
  per-key value just committed)`**: a cancelled, expired, or superseded
  `prepared` operation's proposed timestamps never advance it (D5), and an
  operation where every key retained its existing timestamp leaves it
  unchanged.
- **Restoring a withdrawn key never produces a timestamp less than or equal
  to any timestamp ever committed for any key that season** — proven by
  withdrawing a key, committing at least one unrelated intervening
  publication that advances the high-water mark, then restoring the
  withdrawn key and asserting its new timestamp exceeds the intervening
  publication's own assigned value, not merely the withdrawn key's own last
  value.
- **The high-water mark adds exactly one scalar to the per-transaction write
  cost**, independent of document count and independent of how many
  withdraw/restore cycles a key has been through — proven together with the
  release-sized-manifest capacity test above.

**`SnapshotPublisher` tests:**

- **`completionAttestation` is produced only after every planned document
  and inventory write for that manifest has returned success** — a
  simulated partial-write failure (fewer than every planned document
  written) never produces one.
- **`finalize` is never called after any failed, timed-out, cancelled or
  otherwise ambiguous write** — ambiguous outcomes are treated the same as
  known failures, never optimistically as success.
- **A pre-`finalize` failure of any kind leaves the currently active version
  unchanged** — the season continues serving whatever it served immediately
  before the attempt.
- **Documents successfully written before such a failure are treated as
  unreachable orphan data**, handled by the same cancellation/cleanup
  lifecycle (D5) as any other abandoned `prepared` operation's documents —
  never specially retried or specially adopted.
- **A crash after every planned KV write completed but before `finalize` was
  called is covered explicitly**: the operation remains `prepared` and
  uncommitted, resolved only through the existing retry, deadline-expiry or
  cancellation rules (D5, D9) — never through a recovery path invented for
  this specific case.

**Per-version publication-metadata tests (D3, D8):**

*Version namespace (D3):*

- **Every** sidecar-aware ordinary publication mints its candidate in the
  `pm1-…` namespace; no code path in the new protocol can emit an unmarked
  version.
- **Every** rollback republication mints its **destination** version in that
  namespace, including when its source is a legacy-format version.
- The marker never reaches a public document body, never enters the
  `snapshotRevision` canonical input, never becomes an `__inventory` member,
  and never expands into a public route or cache-invalidation URL.

*Ordinary publication:*

- The `__publication_metadata` sidecar is written **before** any
  `completionAttestation` is produced.
- The sidecar contains **exactly** the `sourceOrderingInput` passed to
  `prepare` for that operation — not a recomputed, re-read or substituted
  value.
- A **failed** sidecar write prevents `finalize`: no attestation is produced,
  the active version is unchanged.
- A **timed-out or otherwise ambiguous** sidecar write has the identical
  outcome, treated as a failure rather than optimistically as success.
- A successful `finalize` commits that same value as
  `committedSourceOrderingInput`.
- Orphan cleanup for an abandoned candidate deletes its sidecar together with
  its inventory and documents.

*Post-cutover rollback:*

- Rollback reads the historical `sourceOrderingInput` from the **target
  version's** sidecar, and passes exactly that value to `prepare`.
- Rollback republishes that same value into the **new** version's own sidecar.
- A `pm1-…` target with a **valid** sidecar succeeds.
- A `pm1-…` target with an **absent** sidecar rejects before `prepare`, with
  the bounded reason — **proven to still reject when every one of its documents
  carries a uniform, valid `meta.sourceUpdatedAt`**, which is precisely the
  case document inference would otherwise have accepted.
- A **transient `null`** read for a `pm1-…` sidecar (a simulated
  not-yet-propagated read, followed by a readable one) never selects the legacy
  fallback — the first read rejects rather than inferring from documents.
- A **valid** sidecar on a **legacy-format** identifier is used as-is; the
  discriminator is not consulted when a valid record exists.
- A **malformed** sidecar rejects the target, in either namespace.
- An **unreadable** sidecar fails closed in either namespace — proven **not**
  to be treated as absent, and proven **not** to fall through to document
  inference.
- No provider port is invoked on any of these paths.

*Legacy rollback:*

- A **legacy-format** identifier with an **absent** sidecar plus **uniform**
  `meta.sourceUpdatedAt` across every inventory-named document resolves
  successfully to that value.
- The derived legacy value is written into the **new** rollback version's
  sidecar, and that destination version is itself `pm1-…`, so the rollback's
  own output carries new-format provenance and is decidable from then on.
- A **legacy-format** identifier whose sidecar is **malformed** or
  **unreadable** fails closed — the legacy namespace does not weaken the
  malformed/unreadable rules, it only makes the *absent* case eligible.
- **Non-uniform** document timestamps reject the target; no document is
  chosen arbitrarily.
- A **missing** `meta.sourceUpdatedAt` on any inventory-named document
  rejects the target.
- An **unreadable** sidecar does **not** fall back to document inference.
- A **malformed** sidecar does **not** fall back to document inference.

*Restart and concurrency:*

- A restart **after `prepare`** retains the prepared `sourceOrderingInput`
  from the durable operation record (D4), so the sidecar written after the
  restart still carries the prepared value.
- A restart **after the sidecar write but before `finalize`** can safely
  retry without mutating the immutable record — a byte-equivalent rewrite is
  accepted as idempotent.
- A **conflicting** sidecar write for the same immutable version — different
  content under the same version identifier — is rejected or surfaced as an
  invariant violation, never silently accepted as an overwrite.
- Two concurrent candidates cannot write **different** metadata under the same
  version identifier; version identities are per-candidate, and a test proves
  the design does not permit two prepared operations to share one.

These are Mechanism/Integration-PR obligations; none of them is created by
this documentation correction.

- **Ordinary publication's staleness rejection is unaffected by the rollback
  exemption**: a `prepare` call with `operationKind: 'ordinary-publication'`
  and a `sourceOrderingInput` strictly older than `committedSourceOrderingInput`
  is still rejected exactly as before.
- **Ordinary publication's equality behavior is exactly preserved, not
  tightened**: a `prepare` call with `operationKind: 'ordinary-publication'`
  and a `sourceOrderingInput` **strictly older** than
  `committedSourceOrderingInput` is rejected; one **equal** to it is
  **admitted**; one **newer** is admitted. A `prepare` call with
  `operationKind: 'rollback-republication'` is admitted regardless of how its
  `sourceOrderingInput` compares to `committedSourceOrderingInput` — the
  staleness predicate is never evaluated for that operation kind.
- **Rollback admission**: a `prepare` call with `operationKind:
  'rollback-republication'` and an older `sourceOrderingInput` is admitted,
  while an otherwise-identical call with `operationKind:
  'ordinary-publication'` is rejected — proving the exemption is scoped to
  the operation kind, not to the ordering value.
- **`committedSourceOrderingInput` only changes on a successful `prepared →
  committed` transition**: a cancelled, expired or superseded `prepared`
  operation's `sourceOrderingInput` never becomes the committed value; an
  idempotent retry of an already-`committed` `finalize` call, while that
  record is still current, returns the recorded result without recomputing
  it; and a `superseded` outcome for a retired epoch likewise leaves the
  field untouched.
- **A successful rollback commits its own historical `sourceOrderingInput` as
  the new `committedSourceOrderingInput`**, and a subsequent ordinary
  candidate's staleness is proven to be evaluated against the rollback's
  value, not against whatever release the rollback superseded.
- Rollback Model 1: no provider port is ever invoked.
- Rollback Model 1: a key whose restored content hash matches the currently
  active version's hash keeps its currently recorded `snapshotObservedAt`
  unchanged; a key that differs, or that is absent from the currently active
  inventory (a restored, previously-withdrawn key), receives
  `max(now, seasonSnapshotObservedAtHighWaterMark + 1 ms)` — the same
  fresh-activation value any other changed key in the same operation
  receives, not a value scoped to that key alone.
- A key withdrawn from the active inventory in one operation and later
  restored by a subsequent ordinary publication or rollback receives a
  timestamp strictly greater than every timestamp this season has ever
  committed for any key — never a value that could be less than or equal to
  a timestamp an offline client already holds for that key from before its
  withdrawal (ADR 0005 rule 2).
- Rollback Model 1: a pre-commit failure (mid new-version write) leaves the
  existing active release completely untouched and serving.
- **Router: a document the active inventory positively excludes returns the
  intended not-found response and never consults `previousVersion`**, even
  when `previousVersion`'s own inventory happens to contain that document.
- **Router: a document the active inventory names, but that is not yet
  readable, falls back to `previousVersion` only when the previous
  version's inventory also names it**; if the previous inventory does not
  name it, the fallback does not serve it.
- **Router: an unreadable or not-yet-visible active inventory returns the
  bounded unavailable/degraded response** rather than consulting
  `previousVersion` as a substitute decision.
- Router: authoritative-lookup-unavailable path returns the existing bounded
  fail-closed shape and never reads a legacy KV pointer as a substitute.
- Router: the bounded, observable fallback to `previousVersion` never changes
  what the Durable Object itself reports as active.
- **Cleanup**: a DO-authorized recheck that finds the epoch still `cancelled`
  is followed by a best-effort external KV deletion, and the deletion's
  success or failure never changes the durable `cancelled` state.

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
  documented as strongly consistent and already follows an existing pattern
  declared elsewhere in this repository's code (`ProviderRateLimiter`,
  ADR 0021) — a pattern present in code and configuration, not a live,
  provisioned namespace (ADR 0021 itself records that class as declared but
  not provisioned).
- The public read path gains a new dependency (a per-season Durable Object
  call) and a new, honestly-stated latency/availability trade-off (D6),
  including a narrow, bounded, newly-possible per-document mixed-release view
  during ordinary KV propagation that is stated precisely rather than
  papered over. Nothing in this ADR pretends any of that cost away.
- Rollback becomes materially more expensive pre-commit (a full new version
  write, not a single pointer flip) in exchange for provider-independence and
  freshness-rule consistency with ordinary publication (D8), and requires an
  explicit, bounded `operationKind` exemption from ordinary staleness
  admission to be constructible at all (D4).
- `active:{season}`/`previous:{season}` stop being anything code depends on,
  after cutover — a deliberate simplification of the KV Consistency Boundary
  ADR 0010 originally had to describe.
- **Each immutable release gains one small internal sidecar,
  `snapshot:{season}:{version}:__publication_metadata` (D3), recording that
  release's own `sourceOrderingInput`.** Without it, a rollback to a release
  that has since been superseded would have no way to recover the ordering
  input D8 requires: DO state keeps only the currently active release's value,
  and post-cutover documents carry per-key `snapshotObservedAt`, not a
  release-wide ordering input. It is internal, never publicly routed, never an
  `__inventory` member, excluded from `snapshotRevision`, written once as part
  of the required publication write set, and deleted with its version. Its
  cost is one constant-size KV record per retained version — KV history grows
  with retained versions exactly as document storage already does — and it
  adds nothing to the Durable Object's bounded per-season state.
- **Versions predating the sidecar remain rollback-able** through a bounded
  legacy fallback (D8): an absent record **on a legacy-format identifier**
  permits deriving the value from the target's own uniformly-written document
  timestamps, while a malformed or unreadable record fails closed. Migration
  uses the identical rule (D12 step 6), and never backfills metadata onto an
  existing historical version.
- **Every version this protocol creates is allocated by the sequencer inside
  `prepare`, in a reserved `pm1-…` namespace carrying an injective encoding of
  the allocating `operationEpoch`** (D3, D4), so a reader can tell from the
  immutable identifier alone whether a sidecar was required, and so no two
  operations for a season can ever be assigned the same version. This is what makes the legacy fallback
  *decidable*: absence of the key can never establish legacy status, because
  KV propagation lag produces the same read, and because a post-cutover release
  whose keys all changed carries a uniform `meta.sourceUpdatedAt` that would
  make document inference appear to succeed while installing a per-key
  activation timestamp as the release-wide ordering baseline. An absent sidecar
  on a `pm1-…` version fails closed everywhere — rollback rejects the target,
  migration aborts for a selected active version, and a selected previous
  version is omitted and seeded as `null`. The marker is internal: no public
  contract field, no `snapshotRevision` input, no inventory member, no route.
- **D12's migration now distinguishes mandatory from best-effort validation
  explicitly.** The selected `activeVersion`'s inventory, documents and
  provenance must all validate or cutover aborts; the optional
  `previousVersion` is validated best-effort, and on failure is omitted from
  the high-water-mark seed and committed as `null` rather than seeded as a
  known-invalid authoritative rollback target. An earlier draft's step 3
  required every checkpoint-named artifact to validate, which contradicted
  step 8's own non-blocking rule for exactly that case.
- A single durable per-season scalar, `seasonSnapshotObservedAtHighWaterMark`
  (D2, D3, D4), closes a withdrawn-then-restored-key monotonicity gap that
  D3's per-key retirement rule would otherwise leave open, without
  reintroducing unbounded per-key tombstone history — the capacity argument
  (D3, D9) is unchanged in shape, plus exactly one constant-size value.
- The cutover migration (D12) commits its complete seed — the validated
  pointers, `committedSourceOrderingInput`, per-key revision/timestamp state
  and the conservatively seeded high-water mark — from an operator-approved
  cutover checkpoint naming exactly `activeVersion` and, best-effort,
  `previousVersion`, read by exact versioned key rather than inferred from a
  repeated legacy-pointer read. Those are the **bounded, operator-approved
  checkpoint inputs** this procedure can read by exact immutable key and fully
  validate. The repository's `listVersions`/`retainedVersions` prefix scan can
  additionally name retained version keys and is useful audit evidence, but it
  is eventually consistent and proves no completeness, so the migration does
  not, and cannot, claim to cover every version ever published for a season
  (D12, "The completeness limit").
- **Activation is now explicitly gated on a pre-cutover historical-floor
  precondition** (D12): this design does not claim its seed necessarily
  dominates a timestamp held only by an unenumerable pre-cutover version,
  because an ADR 0020 D1.11a clock-regression clamp can place such a
  timestamp ahead of migration wall time. Activating a season requires
  establishing a historical index/audited bound, an audit disproving the
  exposure, the absence of retained pre-cutover client state, or an
  authorized client-baseline reset — an explicit precondition, not an
  assumption.
- **A durable three-state cutover lifecycle** (`uninitialized` → `seeded` →
  `active`, D12) replaces an earlier draft's implicit assumption that
  committing the migration seed and switching authority are effectively one
  atomic step. `seeded` is a real, distinguishable, pre-activation state in
  which legacy pointers remain authoritative and this season's mutators stay
  paused; only the separate, idempotent `seeded → active` transition
  switches authority and resumes them.
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
| A future need arises to support rollback to a version outside the operator-approved checkpoint inputs, or to treat `listVersions`/`retainedVersions` as an authoritative historical index | Reopen D12; the existing prefix scan is eventually consistent and proves no completeness, so an index with explicit completeness and retention guarantees must be designed before such a rollback or migration seed can be honestly claimed safe |
| A season's pre-cutover historical-floor activation precondition (D12) cannot be established — no historical index/audited bound, no audit disproving the exposure, retained pre-cutover client state exists, and no authorized baseline reset is available | Activation for that season remains blocked; do not activate on an assumption that the seed "probably" dominates unenumerable history |
| The repository cannot establish or confirm a trustworthy cutover checkpoint, or cannot confirm the legacy mutation-admission closure D12's migration step 1 requires | Activation for that season remains blocked; never substitute a fixed sleep or an unverified legacy-pointer reread for either |
| A future implementation needs a strict zero-in-flight legacy-drain guarantee rather than this admission-closure model | That guarantee and its proof must be supplied by the Integration/Cutover PR that builds it; this ADR does not assume one exists today |
| A future need arises to turn `committedSourceOrderingInput` into a monotonic upstream-source high-water mark rather than "whatever release is currently active" | Reopen D4/D8; this is a different admission policy requiring its own architectural decision, not assumed by this ADR |

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
- [Durable Objects Glossary (input/output gates)](https://developers.cloudflare.com/durable-objects/reference/glossary/) — accessed 2026-09-05; this is where the input-gate quotation cited in "Context" and "Safety reasoning" actually appears verbatim (an earlier draft misattributed it to the "In-memory state" reference page, which does not contain this text)
- [Durable Object State (`blockConcurrencyWhile`)](https://developers.cloudflare.com/durable-objects/api/state/) — accessed 2026-09-05
- [Outbound connections keep Durable Objects alive](https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/) — accessed 2026-09-05
- [Workers KV: Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/) — accessed 2026-09-05
- [Workers KV: How KV works (consistency model)](https://developers.cloudflare.com/kv/concepts/how-kv-works/) — accessed 2026-09-05
