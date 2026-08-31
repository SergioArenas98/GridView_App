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
| Target carries no inventory                | `rejected`, `missing-version-inventory`              |
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
the union rather than blocking the recovery it is being rolled back from.

`POST /internal/admin/cache/purge` uses the same exact inventory and the same
route expansion for the **active** version, so an operator purge covers the
whole active release, aliases included. It moves no pointer and writes nothing;
with no active version or no inventory it returns a bounded `207`.

## KV Consistency Boundary

Workers KV does not provide multi-key transactions. GridView treats publication
as atomic from the reader perspective by making public readers select only
through `active:{season}` and by writing that pointer after the full version is
validated and verified. During KV propagation, an edge location may briefly read
an older active pointer. It must not observe an unpublished version unless that
pointer has already changed.

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
