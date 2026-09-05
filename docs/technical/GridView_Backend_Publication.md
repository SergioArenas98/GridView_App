# GridView Backend Publication

Status: Phase 5B — the publication model below is deployed to Cloudflare staging
(`gridview-api-staging`) backed by a real Workers KV namespace. The operational
deploy/seed/rollback procedure is in
`../operations/GridView_Staging_Edge_Runbook.md`.

## Request Flow

Public requests are read-only:

```text
request -> route/parameter validation -> active:{season}
  -> snapshot:{season}:{activeVersion}:{document}
  -> response envelope + per-request requestId
  -> cache headers / weak ETag / optional 304
```

Public routes never call a provider and never write storage.

## Snapshot Key Model

Versioned documents use:

```text
snapshot:{season}:{version}:{document}
```

Pointers and metadata use:

```text
active:{season}
previous:{season}
meta:current-season
meta:content-schema
sync:{season}:state
quota:provider
```

Document names mirror public resources: `bootstrap`, `home`, `season`,
`calendar`, `grand-prix:{round}`, `grand-prix:{round}:results`, collections,
standings, detail documents and `content:manifest`.

Each version additionally stores its **exact document inventory** under its own
snapshot prefix:

```text
snapshot:{season}:{version}:__inventory
```

The suffix is deliberately not a `SnapshotDocumentName`. That union is closed,
so the inventory can never be requested through `readVersionedDocument`, can
never be mapped to a public URL, and is removed with the version by
`deleteUnpublishedVersion`.

## Publication Algorithm

1. Generate a unique immutable release version.
2. Fetch mock source data through the synchronization service.
3. Generate every required public document for the release.
4. Validate each generated document before any pointer change.
5. Write every versioned document under the release version.
6. Record the exact inventory of what was generated.
7. Read back that inventory to verify completeness.
8. Update content/current-season metadata.
9. Write `active:{season}` last. **This is the commit point.**
10. Record the outgoing version as `previous:{season}`, after the commit.
11. Purge every affected public URL - each document's canonical numeric URL,
    plus the current-season aliases when the affected season is current -
    through the cache-purge abstraction. The affected documents are the union
    of the incoming version's inventory and the replaced version's, so a route
    the new release withdraws is invalidated too.

If validation, provider fetch or pre-activation storage writes fail, the active
pointer is unchanged. Repeating publication of the already active immutable
version is treated as idempotent, and its completeness is decided over that
version's own recorded inventory. A generated release whose `sourceUpdatedAt` is
older than the active release is rejected.

### Exact per-version inventory

Completeness and cache invalidation are decided over the sorted, deduplicated
set of document names generation actually produced - never reconstructed from
the collection documents.

The two sets are not the same. `circuits`, `drivers` and `constructors` are
derived from the calendar and from the season entry lists, while the matching
detail documents are generated from the registries, so a circuit with no
calendar event or a registry driver with no season entry is generated and stored
while appearing in no collection. The shipped curated content already contains
one such circuit. Reconstruction therefore under-reports what a version holds,
which silently accepts an incomplete rollback target and silently skips a public
route during invalidation.

A version is complete when:

- every inventoried document exists;
- every required season-level document is inventoried;
- every calendar event has its detail document; and
- every event advertising `hasResults: true` has its results document.

A generated optional `unavailable` classification is inventoried, so its absence
means a corrupted version. A classification generation never produced is never
inventoried, so an ordinary in-season release remains a valid rollback target.
Nothing is fabricated into an inventory.

A version carrying **no** inventory fails closed: it is rejected as a rollback
target with `missing-version-inventory` rather than falling back to the
collection heuristic. No deployed coordinated snapshot depends on this
compatibility path.

#### One validated boundary for persisted inventories

A stored inventory is **deserialized data, not a typed value**. The storage
signature declares `SnapshotDocumentName[] | null`, but that describes what a
correct write produces, not what a read returns: KV hands back whatever JSON the
key holds, so a truncated write, a hand-edited entry or a partially rolled-back
migration can deserialize to a number, a string, an object or an array carrying
a non-string - all valid JSON, none of them an inventory.

Every consumer downstream assumes an array of strings. The route mapper calls
`startsWith` on each entry, the purge builders spread the list, and the
completeness check iterates it; spreading a number throws and `startsWith` on a
number throws, neither inside the guarded purge-adapter call.

`src/publication/version-inventory.ts` is therefore the **single** point at
which a persisted inventory is validated, and every reader passes through it -
the replaced-version read, the outgoing-current-season alias read, both rollback
reads, the operator purge read and the completeness check. There is no second
shape test anywhere else, and no route knowledge is duplicated: the boundary
accepts an array of strings and stops there, because an unrecognised document
name maps to no canonical path and no alias and is therefore inert, while a
non-string is exactly what throws.

It returns a four-valued discriminated result, because *absent*, *malformed* and
*unreadable* are three different facts and only the calling phase knows which
bounded outcome each maps to:

| Value        | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| `documents`  | A validated list, safe to spread, map to routes and alias       |
| `absent`     | The key holds `null` - a version predating exact inventories    |
| `malformed`  | The key holds something that is not a list of document names    |
| `unreadable` | The read itself failed; nothing at all is known about the version |

#### Phase-specific behaviour for a malformed inventory

The phase that discovers a malformed inventory decides the outcome, and the
commit point is the dividing line:

| Where it is discovered                             | Outcome                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Rollback target, pre-commit                        | `rejected`, `missing-version-inventory`; pointer unchanged       |
| Rollback outgoing active version, pre-commit       | `rejected`, `missing-version-inventory`; pointer unchanged       |
| Replaced same-season version, post-commit purge    | `applied`, `cachePurge: 'failed'`, `cache-purge-failed`          |
| Outgoing current-season aliases, post-commit purge | `applied`, `cachePurge: 'failed'`, `cache-purge-failed`          |
| Operator purge of the active version               | Bounded `207`, `missing-version-inventory`, no URLs purged       |
| Completeness check of a republished active version | `rejected`, `active-version-incomplete`                          |

A malformed inventory never escapes as a rejected promise, never un-publishes a
committed release, and never adds a status or reason to the closed vocabulary.
`absent` keeps its established meanings unchanged: a rollback *target* with no
inventory is still rejected with `missing-version-inventory`, and an *outgoing*
version with no inventory still contributes nothing to the rollback purge union
rather than blocking the recovery.

### Pointer transitions

`active:{season}` is the commit point and the last write that decides what
serves. `previous:{season}` is written **after** it.

Writing `previous` first means a failed commit overwrites the one version a
default rollback can reach with the version that is still serving: the release
did not change, but the recovery path from it was destroyed. Ordering the two
writes this way makes that impossible.

| Phase                              | Outcome on failure                                                          |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Any pre-commit read or write       | `failed`; both pointers unchanged; nothing purged                            |
| Active-pointer commit              | `failed`, `storage-write`; both pointers unchanged; nothing purged           |
| Post-commit `previous` maintenance | `applied` with `pointerMaintenance: 'failed'`; the required purge still runs |
| Post-commit cache purge            | `applied` with `cachePurge: 'failed'`                                        |

`pointerMaintenance` and `cachePurge` are independent bounded dispositions. The
single `reason` field reports the maintenance failure first when both occurred,
because a stale `previous` silently removes the recovery path while a stale
cache is visible and self-correcting.

That comparison stays well defined once the sources publish no recency signal:
`sourceUpdatedAt` then carries GridView's first observation of the currently
published normalized **snapshot revision**, assigned **strictly monotonically**
per snapshot key as `max(now, previous + 1 millisecond)`
([ADR 0020](../adr/0020-provider-source-observation-and-reconciliation.md) §1,
D1.7-D1.11). Binding it to the snapshot revision rather than to the contributing
resources is what keeps this rejection rule safe: a snapshot that changed only
because an entry was **removed** still carries a later timestamp and is
published, instead of being rejected as "older". The assignment is made in the
same transaction that publishes the snapshot, so it survives a crash between
generation and publication. It is a proxy for source age, so the check protects
the publication sequence GridView itself observed — it does **not** prove
upstream ordering. And where the `previous + 1 millisecond` branch of the clamp
fires — two revisions published inside one millisecond, or a backwards host
clock — the value is a **local monotonic publication clock** rather than a
literal observation time; it stays a conservative ordering proxy and raises an
operational event (ADR 0020 D1.11a).

## Rollback

Rollback resolves the target version from the request body or `previous:{season}`.
It verifies the target against that version's exact inventory before writing
`active:{season}`. Cache purge failure is reported but does not undo the pointer
change.

**A rollback whose target is already active is a bounded no-op**: `skipped` with
reason `idempotent`, mapped to HTTP `200`. It writes no pointer, purges nothing
and preserves the existing rollback target. Reporting a transition that did not
happen - and overwriting `previous` while doing it - is precisely how the
recovery path is lost.

**Every expected operational failure returns a bounded result rather than
throwing.** Rollback is the recovery path, so a caller reaching for it during an
outage must still be told which side of the commit point the attempt ended on:

| Situation                                  | Result                                              |
| ------------------------------------------ | --------------------------------------------------- |
| Storage read before the commit fails       | `failed`, `storage-read`; both pointers unchanged    |
| Target carries no or a malformed inventory | `rejected`, `missing-version-inventory`              |
| Outgoing version has a malformed inventory | `rejected`, `missing-version-inventory`              |
| Target inventory is empty                  | `rejected`, `rollback-target-missing`                |
| Target is missing an inventoried document  | `rejected`, `rollback-target-incomplete`             |
| Active-pointer commit fails                | `failed`, `storage-write`; both pointers unchanged   |
| Post-commit `previous` maintenance fails   | `applied`, `pointerMaintenance: 'failed'`            |
| Post-commit purge fails, throws or rejects | `applied`, `cachePurge: 'failed'`                    |

No raw storage message reaches a response or a log line; only the bounded phase
and category are recorded.

### Cache invalidation covers every accepted URL alias

Numeric-season URLs stay canonical, and the public router keeps serving the
`current` and omitted-season forms exactly as before. Nothing about routing,
cache keys, TTLs or the OpenAPI contract changes; what changed is only which
URLs an invalidation covers.

A CDN keys on the request URL, and the router accepts the same document under
more than one. `season` may be omitted - `params.ts` defaults it to `current` -
or given explicitly as `current`, and `/v1/seasons/current` is matched as its
own path. Those are separate cache entries, so purging only
`/v1/bootstrap?season=2026` left `/v1/bootstrap` and
`/v1/bootstrap?season=current` serving the withdrawn release until their TTL
expired - an hour for a profile route.

When the affected season is the current one, invalidation therefore expands to
every alias the router accepts for the affected documents:

| Document                                    | Canonical URL                    | Current-season aliases                                                  |
| ------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `bootstrap`                                 | `/v1/bootstrap?season={season}`  | `/v1/bootstrap`, `/v1/bootstrap?season=current`                          |
| `home`                                      | `/v1/home?season={season}`       | `/v1/home`, `/v1/home?season=current`                                    |
| `season`                                    | `/v1/seasons/{season}`           | `/v1/seasons/current`                                                    |
| `driver:`, `constructor:`, `circuit:`       | `/v1/{kind}/{id}?season={season}`| `/v1/{kind}/{id}`, `/v1/{kind}/{id}?season=current`                      |
| `content:manifest`                          | `/v1/content/manifest`           | none - the URL carries no season and rejects every query key             |
| calendar, collections, standings, event routes | `/v1/seasons/{season}/...`    | none - those paths accept no query and no `current` segment              |

The alias set is **derived from the route table**, not hand-maintained. There is
no `/v1/seasons/current/calendar` or any other `current` sub-path:
`resolveSeasonRoute` parses that segment with the four-digit season pattern, so
those forms are rejected as invalid parameters rather than served, and purging
one would be inventing an alias. Duplicated `season` query keys are accepted by
the parameter guard but unbounded in number, so they are not enumerable and are
not part of the surface.

Publication, rollback and `POST /internal/admin/cache/purge` all expand through
the **same** mechanism, so none of the three can fall back to numeric-only
invalidation. A season known **not** to be current keeps numeric-only
invalidation: its aliases belong to whatever season is current, and purging them
would evict a valid entry.

Current-season identity is read from the stored pointer, never inferred from a
clock. An unreadable or unset pointer expands the aliases anyway, because
purging an alias that was not stale costs one cache miss while skipping one that
was leaves a withdrawn release serving.

A publication that **moves** the current-season pointer also invalidates the
alias URLs the outgoing season was being served through, taken from that
season's own inventory - aliases only, since its numeric URLs still serve
correct content. Most aliases are covered already, because an alias URL is
season-independent; what this adds is a profile the outgoing season carried and
the incoming one does not. If that inventory cannot be read the surface is not
enumerable, and the purge reports `cachePurge: 'failed'` rather than claiming a
success that leaves a withdrawn profile serving. That remains post-commit and
never reverts the pointer.

### Cache invalidation of withdrawn routes

Replacing a version in the same season purges the **union** of the incoming
version's inventory and the replaced version's exact inventory, plus the
season-wide routes derived from the active pointer. A route the new release
drops - a driver who left the grid, a cancelled round, results reclassified as
absent - is named by no other set: the origin stops answering it as soon as
`active:{season}` moves, while the CDN keeps the withdrawn body for the rest of
its TTL. The union goes through the same route expansion as everything else, so
a withdrawn route on the current season is invalidated at its canonical numeric
URL and at both of its aliases, and a historical season keeps numeric-only
invalidation.

The ten base documents cannot be withdrawn. A version missing one of them is
`incomplete` and rejected before the commit point, so the withdrawable families
are exactly the driver, constructor and circuit profiles and the Grand Prix
detail and results routes - including a results document withdrawn while its
round is retained.

This is **not** the cross-season case. A season that stops being current keeps
its own active version, so only its aliases are invalidated; a season whose
active version is replaced has every dropped route go stale, canonical URLs
included. The replaced version's inventory is read before the commit block,
while that version is still the one serving.

A season with no active version has withdrawn nothing: that is an ordinary
first publication, not a fault. An existing version whose inventory is missing,
malformed or unreadable is a different fact - the withdrawn surface cannot be
enumerated at all - and the purge reports `cachePurge: 'failed'` rather than
reading it as empty and claiming a success it cannot stand behind. Like every
other post-commit outcome it never reverts the committed pointer, and it never
turns an applied publication into a failed one.

### Cache invalidation on rollback

The purge set is the **union** of the outgoing active version's and the target
version's exact inventories mapped to public routes, plus the season-wide routes
whose representation depends on the active pointer. It is not gated on
`hasResults`: a round's results URL is purged whenever either version carries
it, because otherwise a classification cached from the newer version keeps being
served at a URL the rollback restored to a meaningful absence.

The union covers orphan profile details, added and removed profiles, and rounds
present in only one of the two calendars. It is deduplicated and sorted
deterministically, and one rollback issues exactly one purge request, after the
commit. An outgoing active version carrying no inventory contributes nothing to
the union rather than blocking the recovery it is being rolled back from. One
carrying a *malformed* inventory is a different fact and refuses the rollback
pre-commit with `missing-version-inventory`, because moving the pointer over a
surface that cannot be described would silently drop every route only that
version carried.

`POST /internal/admin/cache/purge` uses the same exact inventory and the same
route expansion for the **active** version, so an operator purge covers the
whole active release, aliases included. It moves no pointer and writes nothing;
with no active version, or with an inventory that is missing, malformed or
unreadable, it returns a bounded `207` rather than throwing.

## KV Consistency Boundary

Workers KV does not provide multi-key transactions. GridView treats publication
as atomic from the reader perspective by making public readers select only
through `active:{season}` and by writing that pointer after the full version is
validated and verified. During KV propagation, an edge location may briefly read
an older active pointer. It must not observe an unpublished version unless that
pointer has already changed.

## Publication authority (design, Phase 9B-6b — not implemented)

[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
records a design decision that replaces **which write is the commit point**
for the algorithm above. Nothing in this section is implemented, provisioned
or activated; the "Publication Algorithm" and "Rollback" sections above remain
exactly how publication and rollback work **today**, and continue to work that
way until the steps below are each separately authorized and completed.

### The two-phase flow

Once implemented, generation and validation stay exactly as described above,
but the pointer transition moves behind a `prepare`/`finalize` protocol served
by one `SeasonPublicationSequencer` Durable Object per season
(`idFromName(String(season))`):

```text
obtain candidate data (provider fetch, or a historical version for rollback)
  -> compute snapshotRevision per document
  -> enumerate the planned document manifest; compute expectedManifestCommitment
  -> DO.prepare(season, operationKind, candidateVersion, perKeyRevisions,
                 orderingInput, expectedManifestCommitment)
       <- assigned snapshotObservedAt per key, operation token
  -> bake assigned timestamps into each document; regenerate volatile fields
  -> validate; write every versioned document + inventory to KV (unchanged),
     recording which planned writes completed successfully
  -> only once every planned write has succeeded, produce completionAttestation
  -> DO.finalize(season, token, completionAttestation)
       <- authoritative active/previous transition, one atomic DO-storage write
```

`operationKind` is `ordinary-publication` or `rollback-republication` (see
"Rollback republication" below for what the second one changes). The Durable
Object never generates provider data, never validates a document and never
stores a complete snapshot payload — its own storage holds metadata
proportional to the current committed release's document manifest and,
while one is in progress, the prepared candidate's (ADR 0025 D2/D3):
`activeVersion`, `previousVersion`, the current
`snapshotRevision`/`snapshotObservedAt` per key **named in the current active
inventory**, one durable constant-size scalar
`seasonSnapshotObservedAtHighWaterMark` (the greatest `snapshotObservedAt`
ever committed for any key that season, never retired when a key leaves the
inventory — see "Per-key revision and timestamp assignment" below), and the
**complete** current publication-operation record (`operationKind`, `phase`,
`priorVersion`, `candidateVersion`, the candidate's per-key revisions and
assigned timestamps, `sourceOrderingInput`, `expectedManifestCommitment`,
epoch, token, `preparedAt`, `deadline`) — every value `finalize` needs, so a
restart between `prepare` and `finalize` loses nothing it must later verify
or commit (ADR 0025 D4). This per-key state does not grow with historical
release count — superseded operation and per-key state for a key no longer
in the current inventory are retired per ADR 0025 D5/D9 — so its size is
bounded by the current release's inventory, plus at most one prepared
operation, plus the one constant-size high-water mark, never by all versions
ever published.
Comparing the manifest commitment carried by `completionAttestation` against
the durably-recorded `expectedManifestCommitment` proves only that the two
values match; it is not, and is never claimed to be, independent proof that
the written documents are globally visible across Workers KV, that every
planned write actually completed, or that a matching attestation is
truthful rather than falsely reported. The Durable Object cannot
independently audit the caller — that responsibility belongs to
`SnapshotPublisher` itself, which must produce `completionAttestation` only
once every planned write has actually succeeded and must never call
`finalize` after a failed, timed-out, cancelled or otherwise ambiguous one.
See [ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
D4 "The guarantee's precise boundary" for the exact split between what the
Durable Object proves and what remains a publisher obligation.

### Per-key revision and timestamp assignment

`prepare` assigns each key's `snapshotObservedAt` inside one atomic
Durable Object storage transaction, against that same transaction's read of
the DO's own currently-committed state — never against a Workers KV read
raced against an unobserved second publication attempt, which is the
specific gap [ADR 0020](../adr/0020-provider-source-observation-and-reconciliation.md)
D1.10 identified as unclosable under the current architecture:

- a key whose candidate `snapshotRevision` equals the currently active
  revision **for that key** **keeps its current `snapshotObservedAt`** — no
  manufactured churn for unchanged content, and no timestamp change merely
  because some *other* key in the same candidate changed;
- every other key — one whose candidate revision differs from the currently
  active revision for that key, **or one with no currently active revision
  at all** (never published this season, or previously withdrawn from the
  active inventory and now restored) — is a **fresh activation**, assigned
  `max(now, seasonSnapshotObservedAtHighWaterMark + 1 ms)`. This is D1.10's
  existing rule, generalized from a per-key floor to a durable, per-season
  floor: per-key state for a key not in the current active inventory is not
  retained (below), so a restored key has no per-key "previous" value to
  compare against; `seasonSnapshotObservedAtHighWaterMark` — the greatest
  `snapshotObservedAt` ever committed for **any** key that season — is read
  and advanced inside the same transaction instead, guaranteeing a restored
  key's fresh value exceeds every timestamp an offline client could already
  hold for it. See
  [ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
  D2-D4 for the full rule and why this closes the withdrawn-key gap without
  unbounded per-key tombstone history.

Timestamps are assigned **before** final document construction, because
`meta.sourceUpdatedAt` is baked into each immutable document.

### The authoritative active/previous pair

`finalize` performs the authoritative transition — from the prior
`(activeVersion, previousVersion)` pair to the candidate pair — as **one
atomic Durable Object storage transaction**. There is no external Workers KV
pointer write inside this commit. This is the public commit point, replacing
today's "write `active:{season}` last" step; see
[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
§"Safety reasoning" for why an external KV write cannot provide the same
guarantee.

### Router resolution and previous-version fallback

Once activated, the public router resolves `activeVersion` (and, where a
rollback needs a default target, `previousVersion`) through a call to the
per-season Durable Object, then reads the active version's **inventory**
before deciding anything about the document itself — because a missing
document at the active version is not, by itself, evidence of propagation
lag. This codebase's own publication model deliberately allows driver,
constructor and circuit profiles and Grand Prix detail/results routes to be
withdrawn from a version's inventory (see "Cache invalidation of withdrawn
routes" above), so a route the active inventory does not name must return the
intended not-found response and never fall back to `previousVersion` — doing
so would serve a withdrawn route forever instead of the 404 the withdrawal
intends. Only when the active inventory **names** the document but the
document itself is not yet readable from KV does a bounded fallback apply,
and then only if `previousVersion`'s own inventory also names that document.
If the active inventory itself is unreadable or not yet visible, the router
returns the bounded unavailable/degraded response rather than treating
`previousVersion` as a substitute answer. This never reinterprets what the
Durable Object itself reports as active, and preserves the existing
stale/degraded response semantics — see
[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
D6 for the full rule and the narrow, bounded, per-document mixed-release
trade-off it introduces. If the Durable Object binding or lookup itself is
unavailable, the router returns the existing bounded fail-closed shape; it
does not fall back to a legacy KV pointer, because after cutover nothing
maintains one as a live value (see "Legacy pointer retirement" below).

### Failure behavior

Because the commit is one atomic local storage transaction, **only the
"post-commit `previous` maintenance failed" row of today's four-row table
disappears** — `previous` is no longer a second, separately-failable write,
since it commits together with `active` in the same DO transaction. The
other three collapse to two authoritative-pointer outcomes, plus one
independent, still-applicable post-commit outcome for cache purge:

- **Pre-commit failure**: any failure before `finalize`'s transaction
  completes leaves the prior active/previous pair untouched — no partial
  pointer state is possible, because there is only one write; cache purge
  never runs.
- **Committed, cache purge succeeded**: the transaction succeeded, both the
  new active and previous values are in effect together, never one without
  the other, and the purge reports success using the existing bounded
  vocabulary.
- **Committed, cache purge failed**: the authoritative commit is
  **unaffected** — no authoritative state is reverted because a purge
  failed, exactly as today. The result still reports `cachePurge: 'failed'`,
  the existing `cache-purge-failed` disposition is unchanged, and a stale or
  withdrawn cached route may persist until CDN TTL expiry, exactly as it can
  today ("Cache purge" under "Staging Notes" above).

Cache purge remains an external, post-commit, best-effort Cache API
operation, entirely independent of whether the authoritative pointer commit
itself is a Workers KV write (today) or a Durable Object storage transaction
(once ADR 0025 is activated) — moving the pointer commit does not make the
purge atomic with it, and this section does not claim otherwise. The
Mechanism/Integration PRs must retain a regression test proving a purge
failure never reverts the committed release and remains visible in the
returned publication outcome, mirroring the existing rollback and ordinary
publication purge-failure tests.

### Legacy pointer retirement

`active:{season}` and `previous:{season}` become **migration-only** inputs
after cutover: their last valid values, together with the active (and
best-effort previous) version's documents, seed the new Durable Object's
per-key revision/timestamp state and its
`seasonSnapshotObservedAtHighWaterMark` floor once, through an
operator-controlled migration procedure that verifies the imported state
before any authority-mode switch and aborts that season's cutover — leaving
legacy pointers authoritative — on any missing, malformed or inconsistent
input. After a successful switch, no publication or rollback writes them and
no router reads them for authority. They are not kept as a live best-effort
projection — a second writer or a second thing anything still consults would
recreate the ambiguity this design removes. Full migration procedure,
including why it cannot claim coverage beyond `activeVersion`/`previousVersion`,
is in
[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
D12.

### Rollback republication

Rollback stops being a direct flip of `active:{season}`. It becomes
republication of a selected historical version's stable, normalized public
data as a **new** immutable version: volatile publication and freshness
fields are regenerated, per-key `snapshotRevision`/`snapshotObservedAt` are
recomputed against the **currently active** revision for each key (a key
currently active and unchanged keeps its current timestamp; every other
restored key — changed, or currently absent from the active inventory — is a
fresh activation floored by `seasonSnapshotObservedAtHighWaterMark`, per
"Per-key revision and timestamp assignment" above), and the result is
committed through the same `prepare`/`finalize` protocol as
any other publication — never a direct pointer flip — with `prepare` called
as `operationKind: 'rollback-republication'`. That is what exempts a
rollback's necessarily-older `sourceOrderingInput` from the staleness
rejection ordinary publication still enforces unchanged; it changes nothing
about the per-key revision/timestamp comparison, which applies to a rollback
candidate exactly as to any other. It remains provider-independent. Full
rationale, the exact copied-vs-regenerated field list and the operational
trade-off are in
[ADR 0025](../adr/0025-season-publication-authority-and-rollback-republication.md)
D8.

## Snapshot revision (`snapshotRevision`)

**Implemented as a mechanism in Phase 9B-6 (PR 1). It has no production caller,
and no published value changes because of it.** What it computes is the
equality-and-identity signal
[ADR 0020](../adr/0020-provider-source-observation-and-reconciliation.md) §1
D1.7 defines. Binding it to a `snapshotObservedAt` and publishing that under
`meta.sourceUpdatedAt` is the second half of Phase 9B-6 and is **blocked** — see
*Why the observation clock is not implemented yet* below.

### The canonical input is constructed, never filtered

D1.7 excludes envelope, provenance, transport and time-varying metadata
"without exception". A recursive serializer that filtered a deny-list of
envelope keys would satisfy that only for the fields somebody remembered to
name — and the field that is easiest to miss is not in the envelope at all:
`HomeData.freshness` carries `generatedAt`, `sourceUpdatedAt`, `staleAfter` and
the server-`stale` flag **inside `data`**, so such a serializer would hash
`sourceUpdatedAt` into the input that derives it.

So the input is **constructed** from a declared schema, one per snapshot key
(`src/publication/canonical/snapshot-schemas.ts`). The projection reads the
declared properties and nothing else, which makes every exclusion an exclusion
by construction: `requestId`, `generatedAt`, `sourceUpdatedAt`,
`snapshotObservedAt`, `staleAfter`, `stale`, ETags, server-stale flags,
provider identifiers, `fetchedAt`, `reconciledAt`, and retry and reconciliation
state are not declared, so none of them is read.

Exactly three things are hashed:

| Part | Why |
|---|---|
| `data`, projected onto the schema for this key | The normalized public payload, and only that |
| `schemaVersion` | D1.7: a schema change genuinely changes the public representation |
| `documentName` | A **domain separator**, not content. Two keys with byte-identical payloads stay two keys. It cannot cause a false revision change, because a key's name is fixed for the life of the key |

`freshness` is **selectively** projected, not excluded wholesale. Four of its
five properties are D1.7 exclusions - `generatedAt`, `sourceUpdatedAt`,
`staleAfter` and the server-`stale` flag - and stay unread. `contentVersion` is
different: it carries the same curated, provider-supplied version as
`BootstrapData.contentVersion`, not a derived or time-varying signal, so it is
declared inside a nested `freshness` schema (one field: `contentVersion`) and
read like any other stable payload field. Without it, a genuine curated content
bump left the standalone `home` document's revision unchanged even though the
identical bump moved `bootstrap`'s. `BootstrapData.contentVersion` /
`mediaVersion` and the whole of `content:manifest` **are** declared at the top
level too — those are top-level payload fields the client reads, and a curated
content bump is a genuine change to what is served.

### Determinism rules

| Aspect | Rule |
|---|---|
| Key ordering | Lexicographic **UTF-8 byte** order, which is Unicode code-point order by construction of the encoding. JavaScript's default comparison is *not* this order — it compares UTF-16 code units, so a supplementary code point sorts below ordinary BMP characters above U+DFFF — so a dedicated comparator is used and pinned by non-ASCII and supplementary-code-point tests |
| Ordered arrays | Serialized in domain order, which is part of the content: calendar rounds, standings positions, classification entries, weekend sessions, the upcoming-event list, and a constructor's driver lineup (a presentation order the client renders) |
| Unordered arrays | Exactly two, each declared with the stable GridView identity it sorts by: `media` (curated assets, no domain order) by `id`, and `supportedSeasons` (a set of years) by value. The policy is **per declaration**; no array is sorted heuristically |
| Null vs absent | Absent and explicitly `null` collapse onto one representation for the properties `contract/types.ts` declares with `?` — only `MediaVariants`. A **required** property keeps the distinction: absent is a contract violation, not a null |
| Dates | RFC 3339 canonicalized to UTC: case-normalized designators, numeric offsets converted, insignificant trailing zeros dropped. **No truncation.** See the precision note below |
| Numbers | One spelling per value: no exponent, no `-0`, no insignificant trailing zeros. Fractional championship points hash stably |
| Encoding | UTF-8, from one shared `TextEncoder` — the same bytes the digest is taken over |
| Framing | Length-prefixed rather than delimited: every string, key, canonical instant and canonical number is framed `<tag><UTF-8 byte length>:<text>`. Before framing, the raw text passes through `canonicalizeString`, which doubles a literal backslash and rewrites an unpaired UTF-16 surrogate to `\uXXXX` (its own code unit in hex); a valid surrogate pair is left untouched. String canonicalization always happens **before** byte-length framing, so the recorded length is the length of the bytes actually hashed. Together, length-prefixing and injective string encoding are what prevent both delimiter ambiguity and `TextEncoder`'s silent U+FFFD replacement from collapsing distinct inputs onto the same text |
| Hostile values | Every property is taken once through the shared `ownDataProperty` discipline (an accessor is described, never invoked); records are classified by prototype rather than by `typeof`; array-vs-record classification is contained the same way - a revoked `Proxy` makes `Array.isArray` itself throw, and that throw is caught and mapped to the bounded `unreadable` marker rather than escaping; every other reflective trap that can throw is likewise contained. The public boundary never throws, and a mismatch becomes a bounded marker carrying the *kind* of mismatch, never the value |

### Format and algorithm

The canonical text is prefixed `gv-canon/1` — inside the hashed bytes, because a
change to the serialization rules must change every revision. The digest is
**SHA-256** over its UTF-8 bytes via `crypto.subtle`, rendered lowercase
hexadecimal and prefixed with the algorithm: `sha256:<64 hex digits>`, so a
later algorithm is a visibly different value rather than a silent
reinterpretation of the same one. Both the exact canonical text and the digest
encoding are pinned by test.

### Fractional precision: the ADR reading

D1.7 says dates are serialized "as ISO-8601 UTC with a fixed precision". Phase
9B-5 accepts `time-secfrac = "." 1*DIGIT` with **no ceiling**, exactly as RFC
3339 §5.6 writes it, so the wire contract carries unbounded fractional
precision. Reading "fixed precision" as *truncate to the millisecond the
publication clock uses* would make `…:00.0001Z` and `…:00.0002Z` share a
revision — two distinct instants, one identity.

It is therefore read as **one canonical spelling**, not a digit cap: the zone is
normalized, insignificant trailing zeros are dropped, and every significant
digit survives. That satisfies the ADR without narrowing the contract, and it
is recorded as an implementation note on ADR 0020 rather than a change to the
decision.

`Date.parse` and `new Date` are never used. Both roll a leap second silently
into the following minute, so `1998-12-31T23:59:60Z` and `1999-01-01T00:00:00Z`
would collapse onto one revision. Offsets are applied with integer civil-date
arithmetic, and because an RFC 3339 offset is a whole number of minutes it never
touches the seconds field.

### Why the observation clock is not implemented yet

D1.9 binds `snapshotObservedAt` to `snapshotRevision`; D1.10 requires the
assignment to be **strictly monotonic per snapshot key**,
`max(now, previous + 1 ms)`; D1.11 requires that guarantee end to end.

Storing the revision/timestamp pair with the **immutable versioned document**
would satisfy D1.9 and every failure property that follows from it: the pair is
reachable only through `active:{season}`, so it cannot be separated from the
release it describes; a pre-commit failure leaves the previous active release
and its pair untouched; `deleteUnpublishedVersion` refuses the active version;
and rollback republishes a historical version's own documents, so it restores
that pair exactly without fabricating a timestamp.

It does **not** establish D1.10. The assignment must be computed **before** the
commit point, from the pair the active pointer currently names, and two
publications for one season can both reach `SnapshotPublisher` — the staging
cron (`[env.staging.triggers]`) and the protected `/internal/admin/sync/full`,
which forces every job and always publishes. Both read the same active pointer,
neither observes the other, and the pointer ends wherever the interleaving puts
it. Two changed revisions can then receive **equal** timestamps (ADR 0005 rule 3
then makes the client skip a genuinely changed snapshot) or a **decreasing**
one (rule 1 then makes the client reject the active release). Workers KV offers
no compare-and-set and no cross-isolate lock ([ADR 0007](../adr/0007-versioned-kv-publication-active-pointer.md),
[ADR 0010](../adr/0010-workers-kv-consistency-limitation.md)), and a
read-before-write check, a last-write-wins race or an in-isolate mutex is not a
serialization guarantee.

The published `meta.sourceUpdatedAt` is therefore **unchanged**, and the second
half of Phase 9B-6 is blocked on a genuine serialization mechanism. G-i stays
open in **both** halves.

### Database transactions are not what makes this atomic

Worth restating, because D1.9 says the pair is assigned "in the same publication
transaction" and KV has no transactions. GridView has never had one: what it has
is **reader atomicity**, and the two are different guarantees.

- A *database transaction* would make a set of writes commit or fail together.
  Workers KV provides none, and GridView does not claim one.
- *Reader atomicity* is what the active pointer buys: every document of a
  version is written and verified while nothing selects it, and
  `setActiveVersion` — the single last decisive write — is what makes the whole
  set reachable at once. A reader therefore never sees half a release.

Carrying the revision/timestamp pair inside the versioned documents keeps it on
the reader-atomic side of that line, which is what "the same publication
transaction" has to mean here. It is also why a **mutable per-snapshot record**
is the wrong shape even when it is written before `setActiveVersion`: it would
be reachable independently of the pointer, so it could be updated by a
publication that never commits, and a rollback would find it describing a
release that is no longer serving.

## ETag Semantics

Stored snapshots do not contain `requestId`; it is added per request. Because the
body bytes differ between otherwise identical responses, the Worker emits weak
ETags derived from:

```text
api version + resource identity + contentVersion
```

## Staging Notes (Phase 5B)

On staging the publisher runs against a real Workers KV namespace and the
Cloudflare Cache API purge adapter (local/development use in-memory fakes). This
does not change the algorithm above; it only changes where documents are stored
and which URLs are purged.

- **Initial publication.** The namespace starts empty and public routes serve
  controlled empty/`404` responses until the first `sync/full` publishes a
  release. Publication provenance is `status: "mock"` — the staging data is
  non-authoritative. Deterministic first-release fields may be supplied through
  the temporary `MOCK_PROVIDER_SOURCE_UPDATED_AT` / `MOCK_PROVIDER_CONTENT_VERSION`
  seeding variables, which are never committed as permanent configuration.
- **Eventual consistency.** Immediately after a publish or rollback, an edge
  location may briefly read the previous `active:{season}` pointer until KV
  propagates; it never observes an unpublished version. Admin `sync/status`
  reflects the pointer immediately.
- **Cache purge.** A purge failure is reported (`207`) and logged but never
  reverts the pointer; clients revalidate via the weak ETag, so a missed purge
  degrades to a revalidation rather than stale-forever content.

No ETag depends on JSON serialization order.

## Media publication (Phase 8B)

Media objects are published **beside** the snapshot mechanism, not through it.
Snapshots are versioned JSON documents behind the `active:{season}` pointer;
media objects are immutable binaries whose URLs appear inside those documents.
No second active-pointer model was created.

### Rights gate

`content/media/media-rights.json` is the authoritative approved inventory and is
**empty**. The gate fails closed, so an empty inventory means nothing can be
processed, uploaded or referenced from a manifest — the intended behaviour, not a
gap. It refuses on a missing or duplicated record, a non-affirmative approval,
missing commercial or derivative permission, a lapsed or unparseable expiry,
missing required attribution, a licence requiring *adjacent* attribution (which
GridView's central acknowledgements screen does not satisfy), an uncovered
territory, or a missing or unreadable master. None of these is a warning.

The register records the *existence* of a permission, never its evidence: no
contract, credential or confidential document belongs in the repository.

### Object layout

```
media/<owner>/<stable-id>/<version>/<variant>.<ext>
```

Stable GridView identity only — no localized name, no provider id, no secret and
no timestamp acting as the version boundary. An existing key whose content hash
differs is a conflict: publication is blocked and a version bump is required.
Identical content at an existing key is a no-op, so a re-run is idempotent.

### Order of operations

Rights for **every** asset, then processing, then a conflict check across the
whole object set, then writes. A conflict cannot be discovered mid-upload,
because that would leave half a version published. One unapproved asset blocks
the publication in full rather than being skipped.

### Dry-run and upload

`npm run media:dry-run` requires no Cloudflare credential, no bucket and no
network, and is the only media path ordinary pull-request CI exercises. Upload
defaults to off; production is refused by default even when an upload is
explicitly requested. The public media base URL is always supplied by the
operator and validated as HTTPS — no production host is hardcoded anywhere.

### Operational blocker

**No R2 media bucket is provisioned in any environment.** `wrangler.toml` gives
staging a KV namespace and nothing else; production has no bindings at all. No
live media publication has been executed, and none is claimed.

Full detail: [GridView_Media.md](GridView_Media.md).
