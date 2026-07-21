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
