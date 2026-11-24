# 0029 - Persistent identity discovery and reviewed runtime catalog

- Status: Accepted
- Date: 2026-11-13
- Authorization: U0 architecture only; U1-U11 require separate approval.
- Product-owner decisions: PO-1, PO-4, PO-5 and PO-7.
- Amends: [ADR 0022](0022-curated-provider-identifier-mappings.md) D6, D7 and the internal-storage boundary in D10.
- Related: [ADR 0030](0030-provider-driver-inventory-and-required-identity-closure.md), [ADR 0031](0031-identity-review-authority-and-catalog-cutover.md).
- Design: [Identity Management Design](../technical/GridView_Identity_Management_Design.md), sections 4-6.

## Context and scope

Bundled mappings preserve exact lookup but cannot durably accumulate evidence or
adopt a reviewed identity without a deployment. The owner approves a dedicated
runtime authority with immutable history, without making discovery evidence an
identity decision. This ADR accepts the architecture; no catalog, credential,
route, schema, migration or deployment is implemented by U0.

## Decision

### D1 - One authority after controlled migration

Use a dedicated SQLite-backed `IdentityCatalog` Durable Object, separate from
the reconciliation ledger and publication sequencer. One Formula One catalog
per isolated Worker namespace provides the cross-season transaction boundary.
Use the stable object name `formula-one-identity-v1` and an explicit persisted
installation UUID; the domain name is not a schema version. Public reads never
depend on this object.

Migrate all reviewed provider bindings and canonical driver profiles together.
Non-driver registries enter as sealed reviewed imports. Git remains the seed,
export and historical provenance source; after cutover it is not a second
independently editable runtime authority. No live overlay, dual write or
deployment-triggered reseeding of a nonempty catalog is allowed. Nonidentity
media and attribution policy retain their existing owners; a reviewed base
import must preserve runtime additions and match supported base hashes.

Before controlled cutover the bundled authority remains in effect.
[ADR 0031](0031-identity-review-authority-and-catalog-cutover.md) defines handover, versioning and admission.

### D2 - Stable canonical identities and exact internal bindings

Preserve all existing canonical IDs. A new ID is deliberately chosen by a
reviewer after sufficient evidence and full-catalog duplicate review, never
generated from a provider slug, display name or race number. Names are not
unique person identifiers.

Bindings use exact season, provider, entity kind, field and typed value.
Integer and string values remain distinct; event locators retain their type.
No fuzzy matching, coercion, field fallback, automatic aliases or cross-season
inheritance is allowed. Multiple aliases require individually reviewed records.
Ambiguous within-season key reuse is quarantined; extending key scope requires
a separate decision.

ADR 0022 D1-D5 and D8-D9 remain authoritative. Complete closed-shape,
reference, uniqueness and evidence validation must succeed before any resolver
is exposed. A corrupt catalog has no usable subset. Provider identifiers and
evidence remain private; none enter public API v1, Flutter, Drift, public
routes, cache keys or snapshot documents.

### D3 - Evidence is not verified identity

Capture only after existing strict decoding succeeds and before normalization,
using the decoder-approved exact keys and a separate allowlisted extractor.
Collect only valid `unmapped` keys; invalid keys, corrupt registries and missing
curated profiles are faults, not new-person candidates. Malformed, truncated,
duplicate or wrong-season resources yield no eligible evidence.

Driver evidence can contain bounded observed names, date of birth, nationality,
short code and number claims. Non-driver discovery is key-only in this scope.
Preserve source, season, resource, round/session, run/request ordinal,
extractor/decoder version and actual provenance. Unknown legacy facts stay null.
Repository imports retain exact byte hashes and record pointers, including
dirty-file provenance; a HEAD alone does not describe uncommitted content.
Projection hashes are not raw-body hashes or proof that a human match is true.

No full provider bodies, sensitive request headers, cookies, credentials,
arbitrary URLs, HTML, contact/device/user data or raw exceptions are retained.
Citations are credential-free HTTPS without userinfo, fragments or queries,
and are never fetched by the Worker. Diagnostic IDs, acknowledgements and
synthetic observations alone cannot approve a real identity. Synthetic evidence
is explicitly tagged and ineligible for real-environment approvals.

Approvals require nonempty supporting evidence, rationale and immutable
individual audit provenance. New drivers additionally require a complete-catalog
duplicate-review attestation tied to the exact catalog hash. Ambiguity remains
quarantined. Historical approved content is imported with honest repository
decision provenance, not invented historical reviewer identities.

### D4 - Best-effort discovery, durable acknowledged state

Discovery is an exception-contained shadow side effect. Its success or failure
must not change normalization, reconciliation, publication outcomes or provider
request sequence/count. It issues no enrichment, paging, OpenF1 or retry request.
In phases 1-2 a driver mapping failure still prevents the constructor request.

Insert observation, candidate/evidence updates, counters and notification in one
transaction. Same observation ID is idempotent. A failed write acknowledges
nothing; retry storage once with identical IDs within a two-second background
budget. Never retry a provider request because persistence failed. Worker death
before commit can lose discovery: this is not exactly-once delivery.
Overflow/loss is counted and reported without changing valid ingestion outcomes.

### D5 - Accepted retention and capacity baseline

These are reviewed initial hard limits from design section 5, not measured
deployment capacity. Local capacity validation is mandatory before deployment;
changes require reviewed policy, never provider-controlled configuration.

| Item                    | Accepted limit and retention                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence fields         | Names/text claims: at most 200 Unicode code points per field, no controls, trimming, normalization or type coercion. Dates must be valid ISO dates; numbers retain their exact documented wire type.                                                                                                        |
| Evidence records        | At most 32 closed claims; 1-32 discriminated references. Dossier rationale, citation claim summary and imported provenance text: at most 2,000 code points.                                                                                                                                                 |
| Context aggregates      | At most 64 distinct resource/round/session tuples per candidate; counters saturate at `Number.MAX_SAFE_INTEGER`.                                                                                                                                                                                            |
| Collector               | At most 100 observations / 256 KiB per batch, one in flight per collector; at most 2,000 observations / 2 MiB per run. Retain existing observations and count dropped overflow.                                                                                                                             |
| Candidate keys          | 1,024 per season/provider and 4,096 per installation, including archived tombstones. Warn at 80%; refuse new keys at cap, never evict approved/resolved/tombstoned keys.                                                                                                                                    |
| Material evidence       | At most 32 projections per candidate, 8 KiB each. Decision-referenced evidence is permanent. At cap preserve existing evidence, mark overflow and quarantine unreviewed candidates; approval waits for capacity/export review.                                                                              |
| Occurrence detail       | At most 64 recent occurrences per candidate; retain unreferenced detail and run receipts for 90 days. Preserve aggregates, first/last dates, decision-referenced occurrences and import provenance. Deduplication after eviction covers retained IDs only; import and decision operation IDs are permanent. |
| Inactive candidates     | Archive unresolved/rejected/quarantined candidates after 365 days without a sighting, retaining exact-key tombstone, state, decision references and evidence summary. Replay never automatically reopens them.                                                                                              |
| Revisions and decisions | No age eviction of activated revisions, canonical IDs, bindings or decision lineage. Admission caps: 4,096 revisions and 16,384 decision/audit operations, then an explicit expansion/export maintenance plan.                                                                                              |
| Abandoned proposals     | Full bodies may be removed after 90 days only with verified export; retain hash, decision, base, status and reserved-ID tombstones.                                                                                                                                                                         |
| Catalog snapshot        | At most 2 MiB canonical JSON, 10,000 driver identities and 100,000 bindings; the tighter byte limit wins. Oversized proposals fail atomically.                                                                                                                                                              |
| Recovery export         | Each self-contained revision export, including decision/evidence reference closure, is at most 2 MiB. Validate before proposal admission. Export history revision by revision, never truncate evidence or build the lifetime database in memory.                                                            |
| Total logical data      | 256 MiB transactionally measured admission budget. Housekeeping/export precede the cap; refuse new writes rather than deleting history. SQLite overhead/platform monitoring is separate.                                                                                                                    |

The design lifecycle explicitly includes quarantined candidates among inactive
archives; the shorter section 5.4 table label does not exempt them. Archival
preserves their quarantine and exact-key tombstones, not approval or reopening.
Maintenance uses small transactions with persisted progress and never removes
decision/activated-revision evidence. Notifications are deduplicated private
backlog entries, not authorized email or messaging. Logs/metrics contain bounded
reasons and hashes, not names or provider-key labels.

Canonical profile bounds remain as specified in design section 6.1:
names/place/nationality 200 code points, short code 16, biography 8,000, valid
country/date fields and safe integer permanent number. Validate legacy content
before import; never truncate it to fit.

### D6 - Immutable complete revisions and atomic activation

Approval records an immutable decision and complete proposed revision; it does
not change lookup. Validation binds the exact content hash, parent, evidence
heads, candidate versions and validator version. Activation rechecks these and
the expected head/sequence, then atomically commits the head, audit event,
season labels, candidate resolutions and idempotent receipt.

Stale proposals require renewed review, never an automatic merge.
Same operation ID/body returns its durable receipt; different body conflicts.
No mutation succeeds without audit retention. A lost response is resolved by
receipt/history, not a fresh activation. Catalog activation neither triggers
synchronization nor grants reconciliation or publication authority.

Every synchronization pins one complete immutable identity context; runtime
failure before a valid pin stops ingestion before provider requests.
[ADR 0031](0031-identity-review-authority-and-catalog-cutover.md) defines every consuming entry point and budgets.

### D7 - Append-only history and containment

Activated canonical identities and provider binding keys/targets cannot be
silently deleted, merged, reassigned or retargeted in phases 0-3. Canonical ID
reservations are never reused, including abandoned proposals. Reviewed profile
corrections create new versions under the same ID and retain prior versions.
Approved history and evidence remain immutable and recoverable.

An incorrect approval creates an audited correction record, pauses new pins
and uses existing holds/draining to contain in-flight work. It requires a
separately reviewed historical correction procedure. No break-glass,
force-publish, destructive retarget or backward-head operation is authorized.
D14-D16 continue to protect published identity/classification references.

## Consequences and implementation gates

ADR 0022 D6's prohibition on runtime identity storage/admin mutation is
superseded only for this controlled migration. D7's repository-only evidence and
validation workflow becomes durable review/evidence lineage after cutover.
D10 permits this private sanitized evidence store while retaining public
secrecy; its inventory-only exception is solely [ADR 0030](0030-provider-driver-inventory-and-required-identity-closure.md).
Original rationale and unrelated clauses remain historical and authoritative
respectively. Constructor/circuit/event curation retains its existing reviewed
import process; no additional curation UI or provider unlock is approved.

U1-U2 establish safe discovery; U3-U8 establish the catalog and compatibility.
They are pending separate authorization. Local persistence, capacity, failure,
parity and recovery evidence must precede environment activation.
