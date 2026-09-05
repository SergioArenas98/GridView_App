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
   The migration's coverage is explicitly bounded to the versions this
   repository's storage design can already name (`activeVersion`,
   `previousVersion`) — see D12, "the enumerability limit."
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
  already-`committed` `finalize` call returns the already-committed result
  without advancing or recomputing it. See D4 for the exact admission rule
  this field makes possible, and D8 for how a successful rollback
  republication updates it.
- `cutoverState` — one of exactly three durable values, `uninitialized`,
  `seeded` or `active` (D12), plus the migration identity/fingerprint that
  produced the current `seeded`/`active` state. `uninitialized` is the state
  of any season this ADR's migration procedure has never touched. Public and
  administrative routing (D6, D7) treats only `active` as the authoritative
  switch away from legacy Workers KV pointers — `seeded` is a distinct,
  pre-activation state in which legacy pointers remain authoritative by
  design (see D12, "The cutover lifecycle").
- `seasonSnapshotObservedAtHighWaterMark` — one durable scalar per season: the
  greatest `snapshotObservedAt` value ever authoritatively committed for
  **any** document key in that season, past or present. It is
  monotonically non-decreasing, is **never removed or lowered merely because
  a document key leaves the current active inventory** (unlike the two
  per-key maps above, which are scoped to the current manifest), and is
  advanced only by a successful `prepared → committed` transition (D4, D9) —
  never by a cancelled, expired or superseded `prepared` operation. See D3
  for why this is a bounded, constant-size addition, and D4/D8 for the exact
  assignment rule it exists to make safe across document withdrawal and
  restoration.
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
[ADR 0007](0007-versioned-kv-publication-active-pointer.md):

```text
snapshot:{season}:{version}:{document}
snapshot:{season}:{version}:__inventory
```

The caller (the publisher, driven by the synchronization service or an
operator rollback request) still:

1. obtains normalized candidate data (from the provider path, or — for
   rollback — from a historical version, per §"Rollback Model 1");
2. computes `snapshotRevision` per document, and — once document identities
   are known from that same normalized data, before `prepare` is ever
   called — deterministically enumerates the planned document manifest and
   computes an `expectedManifestCommitment` from it (e.g. the sorted,
   deduplicated document-name list, or a digest of it; the exact shape is a
   Mechanism-PR detail);
3. calls `prepare`, passing that `expectedManifestCommitment`;
4. receives per-key `snapshotObservedAt` assignments back from the DO;
5. finalizes, validates and writes the immutable versioned documents and
   inventory to KV, with the assigned timestamps baked into each document's
   `meta.sourceUpdatedAt`, recording which planned writes completed
   successfully;
6. **only once every planned write has succeeded**, produces a
   `completionAttestation` carrying the manifest commitment for what was
   actually written, and calls `finalize` with it. A document-writing phase
   that fails or completes only partially must never produce a
   `completionAttestation` and must never call `finalize` — an incomplete
   write is not a candidate for commit.

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

### D4. Two-phase publication protocol

#### `prepare(season, operationKind, candidateVersion, perKeyRevisions, sourceOrderingInput, expectedManifestCommitment)`

`operationKind` is one of exactly two bounded values: `ordinary-publication`
or `rollback-republication` (see D8 for what authorizes the second one). It
is durable, logged (D11) and never inferred after the fact from other fields.

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
  this season has ever committed for *any* key, not merely greater than that
  one key's own (now-discarded) last value, so an offline client holding an
  older cached copy of that key — from before it was withdrawn — can never
  see the republished document rejected as stale (ADR 0005 rule 2). It adds
  exactly one constant-size scalar to the state D3 already bounds; it
  requires no per-key tombstone history and no change to which keys' state
  D3 retires.
- allocates a new, strictly-increasing `operationEpoch` for this season and a
  fresh caller-facing `operationToken`;
- persists a `prepared` operation record containing **everything `finalize`
  will need, and everything a restart between `prepare` and `finalize` must
  not lose**: `{epoch, token, operationKind, priorVersion, candidateVersion,
  perKeyRevisions, assignedTimestamps, sourceOrderingInput,
  expectedManifestCommitment, preparedAt, deadline}`. Omitting any of these was the
  review-confirmed defect this ADR corrects (see "Context: design-review
  corrections" below) — without them, a restart between `prepare` and
  `finalize` leaves the Durable Object durably remembering only *that*
  something was prepared, not *what*, which is insufficient to finalize
  correctly or to resolve a same-token retry deterministically;
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
- writes every version-scoped document and its inventory to KV, recording
  which planned writes (from the manifest already fixed before `prepare`)
  completed successfully;
- **only once every planned write has succeeded**, derives a
  `completionAttestation` — the manifest commitment for what was actually
  written, computed the same deterministic way as `expectedManifestCommitment`
  so the two are comparable — that it will present to `finalize`. A
  document-writing phase that fails or completes only partially stops here:
  it produces no `completionAttestation` and never calls `finalize`;
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
or superseded token is rejected **before** any authoritative state change —
never partially applied, never silently replayed. A retry for an
already-`committed` token returns the recorded result rather than
re-evaluating anything (D9).

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
  manifest, and only after every required document and inventory write for
  that manifest has returned success;
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
  non-atomic sequence with a one-directional safety property: a
  **DO-authorized cleanup decision** first calls the Durable Object, which
  rechecks the current epoch and confirms it is still `cancelled` inside its
  own transaction and returns that decision; only **then**, outside any DO
  transaction, does the caller issue the external KV deletion. Because
  `cancelled` is terminal, a "yes, still cancelled" answer can never be
  invalidated by anything that happens afterward — there is no transition out
  of `cancelled` for that epoch to race against. The external KV deletion
  itself remains **best-effort**, exactly like every other KV write in this
  design: if it fails, the orphaned version simply persists unreferenced
  (harmless, since nothing points to it) until a later cleanup attempt.
  `deleteUnpublishedVersion` additionally continues to refuse the currently
  authoritative active version, unchanged from ADR 0007.
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
   computed against what this rollback actually intends to write; it is
   never copied from the old version's inventory. This freshly-computed
   inventory is also what the caller deterministically enumerates into a
   planned document manifest and turns into an `expectedManifestCommitment`
   — exactly as D3/D4 describe for ordinary publication — before step 9's
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
   value, however recently or long ago it was last observed. This is what
   guarantees a rollback can never hand an offline client, holding an older
   cached copy of a since-withdrawn key, a "restored" document timestamped
   earlier than what that client already has.
9. Call `prepare` with `operationKind: 'rollback-republication'` and the
   `expectedManifestCommitment` from step 4, then write the complete new
   immutable version and inventory to KV with the timestamps `prepare`
   assigned baked in — the same order D3/D4 require for any publication.
10. **Only once that write fully succeeds**, produce a `completionAttestation`
    for what was actually written and call `finalize` — rollback has **no
    separate commit path** and cannot flip the authoritative pointer
    directly; a pre-commit failure here leaves the currently active release
    untouched exactly as D4 already requires.

**Rollback's admission authority, stated explicitly.** Step 9's `prepare`
call carries a historical `sourceOrderingInput` that is, by construction,
never newer than what is currently committed — that is what makes it a
rollback. D4's ordinary source-ordering staleness rejection is **not**
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
  design does not claim one.

This is the distinction between *explicitly selecting* a cutover version and
*inferring* that a cached pointer read is globally current: the former is
what the checkpoint is, and the latter is what this migration must not do.

**The per-season migration procedure, for every season being activated:**

1. **Disable new legacy mutation admission for this season and confirm the
   mutation-quiescence boundary** — no publication or rollback mutator may
   admit a new candidate against the legacy pointers once this step
   completes. If the repository cannot establish or confirm this boundary
   (for example, a mutator path that cannot be paused, or a pause that
   cannot be verified), activation for that season **remains blocked** —
   this is never satisfied by a fixed sleep presented as proof of
   quiescence.
2. **Read the checkpoint's selected `activeVersion` (and, if named,
   `previousVersion`) by exact versioned key** —
   `snapshot:{season}:{version}:*` — never through the live
   `active:{season}`/`previous:{season}` pointer keys. These versioned keys
   are immutable once written ([ADR 0007](0007-versioned-kv-publication-active-pointer.md)),
   so reading them by exact key reads a fixed artifact, not a moving
   pointer.
3. **Wait/retry, within a bounded budget, until every document and
   inventory the checkpoint names is readable and validates.** A missing,
   malformed, inconsistent or still-unavailable selected document or
   inventory after that bounded budget aborts this season's cutover with no
   DO state written (step 10); legacy pointers remain authoritative and
   mutators resume exactly as before the attempt. A stale legacy pointer
   read can never silently substitute a different version here, because
   migration never reads the live pointer keys at all past step 1.
4. Compute each active document's `snapshotRevision` using the
   already-implemented canonical serializer ([ADR 0020](0020-provider-source-observation-and-reconciliation.md)
   D1.7) — the same mechanism ordinary publication and rollback both use;
   the migration introduces no second revision computation.
5. Import each active document's existing public `meta.sourceUpdatedAt` as
   that key's initial `snapshotObservedAt`.
6. **Validate that `meta.sourceUpdatedAt` is uniform across every document
   in the selected `activeVersion`, and import that single value as
   `committedSourceOrderingInput`.** The current generator writes one
   release-wide `sourceUpdatedAt` value into every document of a release, so
   a uniform value is expected. If the selected active release's documents
   carry **inconsistent** `meta.sourceUpdatedAt` values, this step **fails
   closed** — migration does not arbitrarily choose one of them — and this
   season's cutover aborts (step 10) with no DO state written.
7. Stage the per-key `snapshotRevision`/`snapshotObservedAt` state computed
   in steps 4-5, and the `committedSourceOrderingInput` computed in step 6,
   as this season's initial state (D2) — not yet committed to the DO.
8. **Seed `seasonSnapshotObservedAtHighWaterMark` conservatively, as the
   maximum of:**
   - every imported active-document `snapshotObservedAt` from step 5;
   - every `snapshotObservedAt` importable the same way (steps 2-5, applied
     to `previousVersion` instead of `activeVersion`) from `previousVersion`,
     **only if `previousVersion` was named in the checkpoint and its own
     inventory validates** — an invalid or absent `previousVersion` is not a
     cutover-blocking condition, exactly as it already is not one for an
     ordinary rollback request (see "`previousVersion`'s role in this
     migration is limited and best-effort" and "The pre-cutover
     historical-floor activation precondition" below for why this is not,
     by itself, sufficient to activate);
   - the migration's own observation clock at the moment this step runs.
9. **Re-verify the staged state from steps 7-8 against the same exact
   versioned keys read in step 2** — the same immutable documents must still
   describe the same revisions, or this season's cutover aborts (step 10)
   rather than committing against a local read that failed or changed.
   Because step 2 reads immutable, versioned artifacts rather than a live
   pointer, this re-verification guards against a local read failure; it is
   not, and is not needed as, a wait for external KV convergence.
10. **Commit the complete seed to the Durable Object in one atomic
    operation, only if every prior step for this season succeeded, and
    record the durable cutover-lifecycle state as `seeded`.** The seed
    written in this single operation is, at minimum: the validated
    `activeVersion`; the validated optional `previousVersion`; the imported
    `committedSourceOrderingInput`; the active per-key `snapshotRevision`;
    the active per-key `snapshotObservedAt`; the conservatively seeded
    `seasonSnapshotObservedAtHighWaterMark`; the checkpoint's migration
    identity/fingerprint; and the `cutoverState` value `seeded` itself. After
    this commit, the Durable Object can answer active (and previous) lookups
    **immediately**, without consulting legacy pointers — but `seeded` is
    **not yet** an active sequencer authority (see "The cutover lifecycle"
    below): legacy pointer state remains the declared authority, and
    publication/rollback mutators for this season remain paused, until the
    separate activation transition in step 11. A missing, malformed or
    inconsistent input at any earlier step aborts this season's cutover with
    no DO state written and no cutover-lifecycle transition; legacy KV
    pointers remain authoritative for that season exactly as before
    migration was attempted, and the season may be retried from step 1 once
    the underlying data problem is fixed. Migration is only ever
    all-or-nothing per season — no partially-seeded season reaches `seeded`.
11. **Perform one idempotent durable transition from `seeded` to `active`,
    only after step 10 has committed successfully**, then switch that
    season's public and administrative authority mode to the sequencer and
    resume that season's publication and rollback mutators. Switching
    authority and resuming mutators both wait on this transition alone —
    never on an assumption that migration "probably" succeeded, and never
    on step 10 alone, since `seeded` is not yet `active` (see "The cutover
    lifecycle").

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
- A retry of the step-11 activation transition is idempotent: repeating it
  against a season already `active` leaves the season `active`, unchanged.
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
  by an unenumerable pre-cutover version, because nothing in this system can
  enumerate or bound "every version ever published" (see "The enumerability
  limit" below), and because a D1.11a clock-regression clamp may have placed
  such a historical timestamp ahead of migration wall time.

**Activating this authority for a season therefore requires establishing one
of the following, as an explicit precondition — never a vague "reopening"
note to revisit later:**

- a trustworthy historical index or an audited upper bound over every
  timestamp this season's unenumerable pre-cutover history could contain is
  imported into the seed; or
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

**The enumerability limit, stated precisely rather than assumed away.** This
migration seeds its floor from exactly the versions this repository's
storage design can already name and validate today — `activeVersion` and,
best-effort, `previousVersion` (D7) — because those are the **only**
versions any part of this system tracks. Workers KV offers no listing of a
season's historical `snapshot:{season}:{version}:*` keys by version, this
codebase maintains no separate version index, and — unchanged by this ADR —
"public readers never enumerate snapshot versions"
([ADR 0007](0007-versioned-kv-publication-active-pointer.md)); an operator
rollback request may **name** an older version by an identifier it already
knows from external records, but nothing in this system can **discover**
that a version exists or **list** every version a season has ever had. This
migration therefore does not, and cannot honestly, claim to import a floor
derived from "every version ever published" — only from the two versions the
existing design already tracks, subject to the activation precondition
above. This is not a new gap this ADR introduces: today's KV-pointer design
has exactly the same blind spot for a rollback target older than
`previousVersion`, resolved only by an operator's own external
record-keeping, unchanged by this migration. If a future need arises to
safely support rollback to a version this system cannot already name from
`active`/`previous`, that requires a version-index capability this ADR does
not create, and is out of scope here — not a defect in this migration's
seed, but a pre-existing, explicitly acknowledged limit on what "the
retained set" means in this repository's storage design today.

**`previousVersion`'s role in this migration is limited and best-effort.**
It is only: (a) an optional operator-selected cutover fallback, named in the
checkpoint; (b) an additional conservative timestamp input folded into the
seeded high-water mark when its own inventory and documents validate
(step 8). It is **never** evidence, by itself, that this season's deeper
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
  test in which a checkpoint-named document remains unreadable for longer
  than the bounded retry budget in step 3 proves migration aborts with no DO
  state written, rather than proceeding on a partial read.
- **A mismatched checkpoint fingerprint on retry is rejected**: a test
  presenting a different migration identity/fingerprint against a season
  already `seeded` or `active` proves the attempt is rejected rather than
  silently applied.
- **The step-6 uniform-`sourceUpdatedAt` validation fails closed on
  inconsistency**: a test whose selected active release carries documents
  with two different legacy `meta.sourceUpdatedAt` values proves migration
  aborts (no DO state written) rather than importing an arbitrarily-chosen
  one as `committedSourceOrderingInput`.
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
| **Claiming atomicity between a Durable Object cancellation check and an external Workers KV deletion during orphan cleanup** | **Rejected — not implementable.** No cross-product atomicity between Durable Object storage and Workers KV exists (§"Safety reasoning" is this ADR's own premise). Replaced in D5 by a non-atomic two-step sequence relying on `cancelled` being a terminal state, with the external KV deletion remaining best-effort. |
| **An unbounded per-key tombstone history** (retaining every withdrawn key's last `snapshotObservedAt` indefinitely, keyed by document identity, instead of one season-wide scalar) | **Rejected — unnecessary for the property needed.** A per-key floor only needs to be *at least as high* as every value ever committed for any key that season to keep a restored key's timestamp ahead of anything an offline client could hold; a single monotonic `seasonSnapshotObservedAtHighWaterMark` (D2, D4) already provides that floor for every key, current or withdrawn, without storage proportional to how many distinct keys have ever existed or been withdrawn and restored. Retaining a growing per-key tombstone map would reintroduce the unbounded-history growth D3's capacity argument exists to avoid, for a safety property one constant-size scalar already secures. |

## Failure-state model

Three distinct identities are used throughout this design, and conflating any
two of them is how the duplicate-replay race in "Context" happens in the
first place. A fourth — an application-level in-memory single-flight guard —
appeared in an earlier draft and is deliberately **not** carried forward: see
"Rejected and superseded alternatives" and D9 for why it no longer serves a
purpose once the commit is one Durable-Object-storage-protected transaction.

| Identity | Lifetime | Purpose |
|---|---|---|
| `operationToken` | One `prepare()` call | Caller-facing handle, presented back to `finalize`/`cancel` |
| `operationEpoch` | Durable, monotonic, per season | The actual fencing value every transition checks; increments on every admitted `prepare` |
| Durable operation record | Durable, until superseded | `{epoch, token, operationKind, phase, priorVersion, candidateVersion, perKeyRevisions, assignedTimestamps, sourceOrderingInput, expectedManifestCommitment, preparedAt, deadline}` — sole restart-recovery source of truth, and the only source `finalize` reads from (D4) |
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
| `committed` | n/a for this epoch | one atomic `prepared → committed` transition: activeVersion, previousVersion, `committedSourceOrderingInput`, per-key state and `seasonSnapshotObservedAtHighWaterMark` all written together with the phase change | **none** | yes — next `prepare` | yes, for epoch(s) it superseded | resumes `committed` | trivially — a retry for a committed token returns the recorded result (D9) |
| `cancelled` | n/a | epoch marked cancelled; **terminal** — never transitions to `prepared` or `committed` (D5) | none | yes | yes, after a DO-authorized recheck (D5; non-atomic with the external KV deletion) | resumes `cancelled` | trivially |
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

- Two simultaneous same-token `finalize` calls resolve to one committed
  result, never two writes — the second observes `committed` and returns the
  recorded result rather than re-entering the transaction (D9).
- A same-token retry arriving after the original `finalize` call's storage
  transaction has already completed observes `committed` and returns the
  recorded result deterministically, never re-evaluating the operation.
- A `prepare` for a new candidate is rejected while an operation for the same
  season is `prepared` and not yet superseded, cancelled or expired.
- A stale (superseded) epoch's `finalize` is rejected before any storage
  mutation.
- A `prepared` operation replaced by a later `prepare` durably retires the
  old epoch atomically with installing the new one; a subsequent
  `finalize(oldToken)` is rejected.
- A stale `finalize` after a `prepared`-then-cancelled token is rejected, no
  version is deleted while its status is ambiguous.

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
  operation's `sourceOrderingInput` never becomes the committed value, and an
  idempotent retry of an already-`committed` `finalize` call returns the
  recorded result without recomputing it.
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
  repeated legacy-pointer read. Those are the **only** versions this
  repository's storage design can already name and validate; the migration
  does not, and cannot, claim to cover every version ever published for a
  season (D12, "The enumerability limit").
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
| A future need arises to support rollback to a version this system cannot already name from `activeVersion`/`previousVersion` | Reopen D12; a version-index capability must be designed before such a rollback or migration seed can be honestly claimed safe |
| A season's pre-cutover historical-floor activation precondition (D12) cannot be established — no historical index/audited bound, no audit disproving the exposure, retained pre-cutover client state exists, and no authorized baseline reset is available | Activation for that season remains blocked; do not activate on an assumption that the seed "probably" dominates unenumerable history |
| The repository cannot establish or confirm a trustworthy cutover checkpoint, or cannot confirm the mutation-quiescence boundary D12's migration step 1 requires | Activation for that season remains blocked; never substitute a fixed sleep or an unverified legacy-pointer reread for either |
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
