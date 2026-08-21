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

## Publication Algorithm

1. Generate a unique immutable release version.
2. Fetch mock source data through the synchronization service.
3. Generate every required public document for the release.
4. Validate each generated document before any pointer change.
5. Write every versioned document under the release version.
6. Read back the required set to verify completeness.
7. Preserve the current active version as `previous:{season}`.
8. Update content/current-season metadata.
9. Write `active:{season}` last.
10. Purge only affected public URLs through the cache-purge abstraction.

If validation, provider fetch or pre-activation storage writes fail, the active
pointer is unchanged. Repeating publication of the already active immutable
version is treated as idempotent. A generated release whose `sourceUpdatedAt` is
older than the active release is rejected.

That comparison stays well defined once the sources publish no recency signal:
`sourceUpdatedAt` then carries GridView's first observation of the currently
published normalized revision, which is non-decreasing per snapshot key
([ADR 0020](../adr/0020-provider-source-observation-and-reconciliation.md) §1).
It is a proxy for source age, so the check protects the publication sequence
GridView itself observed — it does **not** prove upstream ordering.

## Rollback

Rollback resolves the target version from the request body or `previous:{season}`.
It verifies that the target release has the required document set before writing
`active:{season}`. Cache purge failure is reported but does not undo the pointer
change.

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
