# ADR 0005: Snapshot conflict rule and freshness semantics

- Status: Accepted
- Date: 2026-07-19

> **Qualified (2026-08-21) by
> [ADR 0020](0020-provider-source-observation-and-reconciliation.md), not
> superseded.** Every rule below stands as written, and the client
> implementation is unchanged. ADR 0020 qualifies **one** thing: what
> `sourceUpdatedAt` *means* for a source that publishes no recency signal.
> Neither adopted Formula 1 source (OpenF1, Jolpica) exposes an update
> timestamp or version, so for those sources the published value is GridView's
> **first-observed** timestamp for the currently published **normalized snapshot
> revision** — a proxy for source age rather than the upstream modification
> time, which can make data appear newer than it is by up to one polling
> interval. That value is assigned **strictly monotonically per snapshot key**
> (ADR 0020 D1.10), so rule 2 below always fires for a changed snapshot and
> rule 1 can never reject GridView's own publication sequence — including when a
> snapshot changes because an entry was **removed** or a membership or filtered
> set changed. The prohibitions below are untouched: `generatedAt` and fetch
> time still never substitute for source recency, and `contentVersion` is still
> compared by equality only. See ADR 0020 §1.
>
> **Further qualified (2026-09-05) by
> [ADR 0025](0025-season-publication-authority-and-rollback-republication.md),
> also not superseded.** ADR 0025 D8 authorizes rollback as **republication**
> of historical public data rather than a direct pointer flip. The freshness
> comparison this rollback uses is still exactly rule 2/3 below, applied
> per snapshot key: a restored key's `sourceUpdatedAt` is compared against the
> **currently active** version's value for that key, never against the
> historical version's own old value. A key whose restored content is
> byte-identical to what is currently active keeps its current
> `sourceUpdatedAt` unchanged (rule 3, no-op); a key whose restored content
> differs receives a fresh, strictly later `sourceUpdatedAt` (rule 2, applies)
> through the same monotonic assignment ADR 0020 D1.10 already defines. A
> client therefore accepts a rollback's republished snapshots through the
> **existing** rules below with no new client behavior. No activation-epoch or
> other new field is added to the wire contract for this.
>
> **Amended (2026-10-14): rule 3 keeps a later publication's freshness.** The
> server publishes every resource again in each release, so identical content
> arrives as a `200` whose `generatedAt` and `staleAfter` belong to the new
> publication. Rule 3 used to discard those values with the rest of the
> snapshot, so a resource whose content did not change kept the previous
> release's expiry indefinitely. Rule 3 now reads: equal `sourceUpdatedAt` and
> equal `contentVersion` → **skip the domain write**. If, in addition, the
> incoming `generatedAt` is **strictly later** than the stored one, the
> resource's `resource_sync_metadata` record takes the incoming `generatedAt`,
> `staleAfter` and server `stale` flag (a null is set, not preserved), in the
> same transaction as the validation bookkeeping.
>
> - What still holds: no domain row is written, including the `snapshots` row
>   and media, and no domain-table stream emits. `sourceUpdatedAt` and
>   `contentVersion` are equal by construction and stay as stored. Rules 0-2 and
>   4 are unchanged, and the outcome is still `skippedUpToDate` /
>   `RefreshSuccess(application: idempotent)`.
> - Why it is legitimate: these three fields are excluded from the snapshot
>   revision (ADR 0020 D1.7). They describe a publication, not the content, and
>   the server re-issued them for this resource. The client invents nothing and
>   reads no clock.
> - What it cannot do: an equal `generatedAt` (the same publication fetched
>   again) or an earlier one (an older cached copy) changes nothing. A `304`
>   still never moves provenance (Synchronization §10.2), so a fetch never
>   extends `staleAfter` on its own.
> - `generatedAt` still never orders content. Storing a later value only raises
>   the bar for rule 4, which only a later publication can clear anyway.
>
> The "no write at all" wording below described the domain write. Since Phase
> 6B, a skip has also recorded validation bookkeeping (ETag, `lastSuccessAt`,
> cleared failure) in `resource_sync_metadata`. This amendment adds the three
> publication fields to that bookkeeping. Because a skip never rewrites the
> `snapshots` row, the Grand Prix detail screen now reads its freshness from its
> own metadata record, as the result section and the Calendar already did.
> Covered by `test/data/sync/resource_sync_test.dart` and
> `test/application/grand_prix_controller_test.dart`.
>
> **Season boundary (2026-10-18).** Publication instants are ordered only
> within a season. The content manifest's record is the only one ordered within
> the season it was accepted under (Synchronization §10.4), because its payload
> names no season. A snapshot accepted under a different season than the stored
> record's is decided as a first record, so rules 1-4 never compare it with the
> outgoing season's. It applies with its own `generatedAt`, `sourceUpdatedAt`
> and `staleAfter`, even when they are earlier. Every other record is
> unchanged. A rejected snapshot never changes a stored record's scope.

## Context

The client is offline-first and cache-first (`GridView_TRD.md` §16). A refresh
fetches a server snapshot and writes it into Drift; the UI reads from
Drift-backed streams. Two questions must have a documented answer:

1. When may an incoming snapshot **overwrite** cached data, and when must it be
   **rejected** to protect newer cached data?
2. How is content classified **fresh vs stale**?

The backend publishes **versioned, timestamped snapshots** with a monotonic
active-version pointer (`GridView_Backend_Scheme.md` §13.1). Every snapshot
carries `meta.generatedAt`, and season-scoped snapshots additionally carry
`sourceUpdatedAt`, `staleAfter` and `contentVersion`.

### The three provenance values (do not conflate them)

- **`sourceUpdatedAt`** — the age/revision of the *underlying source data*. This
  is what actually determines whether one snapshot is more recent than another.
  *(Qualified by [ADR 0020](0020-provider-source-observation-and-reconciliation.md)
  §1: where the upstream source publishes no recency signal, the value carried
  here is GridView's first observation of the currently published normalized
  **snapshot revision**, assigned strictly monotonically per snapshot key. It
  keeps the rules below well defined for any snapshot change, including a
  removal or a membership change — but it is a proxy for source age, and it does
  not order two payloads that GridView did not itself observe in that order.)*
- **`generatedAt`** — the time the *GridView snapshot document was produced*. A
  snapshot generated later can still carry **older** source data (a delayed or
  re-run generation), so `generatedAt` is not a safe recency signal on its own.
  *(Narrowed on 2026-10-14 by
  [ADR 0025](0025-season-publication-authority-and-rollback-republication.md)
  D4, "Amendment (2026-10-14)": for a season under the publication sequencer it
  is the **logical publication instant**, identical on every document of one
  release and strictly later than the instant of the release it replaced,
  rollback republication included. This makes it a publication-membership and
  publication-order signal. It is still not a content-recency signal, and every
  rule below that keeps it subordinate to `sourceUpdatedAt` stands unchanged.
  The client's two uses of it, the rule-3 amendment above and release
  convergence (Synchronization §11.7), keep it subordinate too.)*
- **`contentVersion`** — an *immutable identity/provenance token* for the content
  representation. It is compared by **equality only**; it is **not** assumed to
  be numerically or lexicographically sortable.

### Nullability of `sourceUpdatedAt` at each layer

`SnapshotMeta` **requires** `sourceUpdatedAt`, so an incoming public snapshot
without it is contract-invalid. But the value passes through layers that are
structurally nullable, so the invariant is enforced explicitly:

| Layer | `sourceUpdatedAt` | Note |
|---|---|---|
| OpenAPI `SnapshotMeta`/`SeasonSnapshotMeta` | **required** | Home + Grand Prix responses. (`DataFreshness` object: optional — so it is **not** the conflict key.) |
| API DTO `MetaDto` | nullable (`String?`) | One DTO unions BaseMeta/SnapshotMeta/SeasonSnapshotMeta. |
| Remote parser | **enforced non-null** | `requireSnapshotMeta` rejects a snapshot whose `meta.sourceUpdatedAt` is missing as `invalidResponse`, before mapping/persisting. |
| Domain `DataFreshness` | nullable (`DateTime?`) | Always non-null after the guard + `freshnessFromMeta`. |
| Drift `snapshots.sourceUpdatedAt` | **nullable column** | Kept nullable so a pre-invariant row can be repaired; no new null row is ever written. |
| DAO `_decideOutcome` | guards both sides | See rule 0/0b below. |

The **conflict key is `meta.sourceUpdatedAt`** (required), never the optional
`data.freshness.sourceUpdatedAt`.

## Decision

### Conflict rule — `sourceUpdatedAt` is the primary boundary

All three values are persisted in the `snapshots` table, keyed by a logical
snapshot key (`home`, `grand_prix:{season}:{round}`). `generatedAt` **must never
outrank `sourceUpdatedAt`, nor substitute for it when it is missing**. On a
write (`_decideOutcome`):

0. **incoming `sourceUpdatedAt` missing → reject as invalid.** Contract-invalid;
   no write, `generatedAt` is **not** consulted. DAO returns `rejectedInvalid`.
   (The remote parser already rejects this as a typed `invalidResponse` failure
   before it reaches the DAO; this is defence in depth for a direct caller.)
0b. **stored `sourceUpdatedAt` missing but incoming present → apply (cache
   repair).** A valid incoming snapshot repairs an incomplete pre-invariant
   stored row; this is not `generatedAt` ordering.
1. **incoming `sourceUpdatedAt` < stored → reject.** Newer cached data (and the
   entire cached transaction state) is preserved. DAO returns
   `rejectedOlder`; repository reports `RefreshSuccess(applied: false)`.
2. **incoming `sourceUpdatedAt` > stored → apply** atomically.
3. **equal `sourceUpdatedAt` + equal `contentVersion` → skip (idempotent no-op).**
   No rows are rewritten and the stream does not re-emit. DAO returns
   `skippedUpToDate`; repository reports `RefreshSuccess(applied: false)`.
   *(Amended 2026-10-14: a strictly later `generatedAt` updates the
   publication fields in `resource_sync_metadata` only. See the amendment
   above.)*
4. **equal `sourceUpdatedAt` + differing `contentVersion` → `generatedAt` is a
   deterministic tie-breaker only.** A strictly **later** `generatedAt` applies;
   an **equal or earlier** one is rejected.

The entire write (season/circuit/grand-prix/sessions/freshness) occurs inside a
**single Drift transaction**, so a snapshot is applied all-or-nothing, and a
rejected, invalid or skipped snapshot performs **no write at all** (no false
stream emission).

### Why the Drift column stays nullable (no schema bump)

The `snapshots.sourceUpdatedAt` column remains nullable and the schema version
stays **1**. Making it `NOT NULL` would require a migration to backfill or drop
any pre-invariant rows that an already-installed app may hold. Instead the
invariant is enforced at the **write boundary** (no new null-source row is ever
written) and rule 0b **repairs** any legacy null-source row on the next valid
sync. Existing databases therefore remain readable.

### Freshness rule

`evaluateFreshness(freshness, now)`:

- If `staleAfter` is present: `now.isAfter(staleAfter)` ⇒ **stale**, else fresh.
  Server-provided `staleAfter` is authoritative.
- Else if the server `stale` flag is `true` ⇒ **stale**.
- Else ⇒ **fresh**.

Client-side time-based invalidation without server context is deliberately
avoided (`GridView_TRD.md` §16.4). A Grand Prix cached only indirectly (e.g. via
the Home snapshot, with no detail snapshot yet) has no detail freshness and is
treated as **stale**, so the UI shows content immediately while a detail refresh
completes.

## Consequences

- A failed refresh never erases valid cached data (the write is skipped, not the
  cache).
- Older snapshots (e.g. a delayed retry) cannot regress newer cached data.
- Repeated synchronization of the same snapshot is idempotent.
- Fresh/stale is server-driven and deterministic; the stale/offline notice is
  shown without replacing content.

Covered by `test/database/vertical_slice_dao_test.dart`,
`test/data/repositories/race_weekend_repository_test.dart` and
`test/application/*`.
