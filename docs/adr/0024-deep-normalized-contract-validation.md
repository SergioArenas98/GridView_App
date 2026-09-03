# ADR 0024: Deep normalized-contract validation at the coordination boundary

- **Status:** Accepted
- **Date:** 2026-09-02
- **Phase:** 9B-5
- **Amends:** [ADR 0023](0023-multi-source-provider-coordination.md) D14
- **Related:** [ADR 0019](0019-formula-one-provider-legal-gate.md),
  [ADR 0020](0020-provider-source-observation-and-reconciliation.md),
  [ADR 0022](0022-curated-provider-identifier-mappings.md)

## Context

[ADR 0023](0023-multi-source-provider-coordination.md) closed **G4** as a
dormant coordination mechanism and recorded one explicit activation gate in
**D14**:

> A real Jolpica or OpenF1 adapter **must not be registered or enabled** until
> its normalized outputs pass the authoritative contract validators.

Those validators did not exist. `RuntimeSnapshotValidator` checks snapshot
metadata, the required top-level shape of each document and provider neutrality
of the body — structural, and it claims nothing more. A test pinned the gap
precisely: `[{ driverId: 42, fullName: null, raceNumber: 'one' }, {}]` passed
publication validation unchanged.

D14 also stated that deep validation "is an adapter responsibility". That is
true of *normalization* and remains true. It is not a workable answer for
*verification*, because the adapter is the one boundary in the coordination
package whose output is untrusted by construction — which is exactly why the
coordinator already re-parses its outcome shape, derives its job category
rather than accepting one, refuses to take its word on an attempt, and detaches
its payload instead of holding its reference. Contract conformance is the same
kind of claim from the same untrusted source.

Two further facts made the gate urgent rather than theoretical.

**Normalized entities are published verbatim.** `snapshots/generator.ts`
projects `season`, `calendar`, `drivers`, `constructors` and `circuits` field by
field, but carries the entity object straight through for `driver:{id}`,
`constructor:{id}`, `circuit:{id}`, `grand-prix:{round}`,
`grand-prix:{round}:results`, `standings:drivers`, `standings:constructors`,
`home` and `bootstrap`. Season assembly copies collections shallowly and
spreads events. `structuredClone` detachment preserves own enumerable
properties. So anything an adapter attaches to an entity reaches a public
document unexamined.

**Three referential gaps were already recorded.** The final bounded review of
PR #12 raised F3, F4 and F5 — driver participation spans, the canonical event
identity and the canonical constructor season-entry identity — and deferred all
three to this gate, where a non-canonical value first becomes possible. They
were recorded only in that pull request's discussion.

## Decision

### D24.1 - An authoritative normalized-contract validator exists

`src/contract/normalized/` validates a normalized value field by field:
required-property presence, exact primitive types, integer versus general
number, finiteness, the identifier grammar, patterned strings, enumerated
vocabularies, calendar dates, RFC 3339 date-times, absolute URLs, array
elements and nested objects. It knows nothing about coordination, providers,
transport or publication.

Authority precedence is explicit. `src/contract/types.ts` decides which
properties exist: a property declared without `?` must be present, and the
contract states that absent optionals are represented as `null`. Only
`MediaVariants` declares genuinely optional keys.
`docs/api/gridview-api-v1.yaml` decides what values may be. Its `required` list
is the floor a *consumer* may rely on; it does not license a producer to omit a
declared property.

**Only bounds the contract states are applied.** `position >= 1`, `round >= 1`
and the season range are enforced. Nothing constrains the sign or magnitude of
wins, podiums, laps, lengths, corner counts, coordinates, aspect ratios,
durations, gaps or points, because the contract does not, and inventing one
would reject data the contract calls valid.

### D24.2 - The adapter normalizes; the coordinator verifies

Validation runs in the coordinator, after the outcome is normalized, after the
candidate payload is detached and after resource binding — and before the
payload can become a candidate. The value validated is the same detached
snapshot that is later selected, assembled and published, so nothing is checked
at one moment and consumed at another.

This amends D14's division of labour. The adapter is still the component that
normalizes provider data into the public contract types, and a real adapter is
still expected to satisfy the contract by construction. What changes is that
its conformance is now *verified* rather than assumed.

Publication is deliberately **not** the place. A document reaching the
publisher was assembled from candidates, so a failure there would surface after
selection, assembly and generation had all consumed the value, would attach to
a season rather than to the source contribution that produced it, and would put
the same rule in a second place it could drift from. `RuntimeSnapshotValidator`
therefore keeps its existing scope unchanged.

### D24.3 - Unknown properties are refused

A normalized value may not carry an own property the contract does not declare.
Symbol-keyed and non-enumerable own properties count.

This is not in tension with the tolerant-consumer posture recorded in
`contract/parse.ts` and `contract/validation.ts`. That posture governs the
**reading** direction — a client ignoring a future server's additive fields, as
`test/fixtures/api/v1/grand-prix/unknown-additive.json` exercises. This governs
the **producing** direction, where by D24's own context an undeclared property
is published verbatim. Both rules are correct at once, and both fixtures that
exercise consumer tolerance (`unknown-additive.json` and
`unknown-enum-status.json`) are asserted to be *refused* by the producing rule,
so the distinction is pinned rather than assumed.

The same reasoning applies to enum members. Every contract vocabulary contains
`unknown`, and that member is **accepted** — it is what an adapter is required
to normalize an unrecognised upstream token into. The raw token is refused,
because it would otherwise carry the provider's own vocabulary into a public
document.

### D24.4 - Failure is contained, and redacted

A payload that fails validation becomes the **existing** `invalid-payload`
attempted-failure contribution — "the response was read but did not validate
against the contract". No new public reason, status or vocabulary is
introduced. The contribution stays `attempted`, because the request really left
GridView; the transport is counted exactly once; the payload is never selected,
assembled or published; a healthy fallback may still carry the resource; an
independent resource is unaffected; and the run is not tainted.

An issue says **where** and **what kind**, never **what**. Paths are structural
(`data.entries[3].driverId`) and codes are a closed set. No value, no key name
and no upstream token appears in an issue, and the issue list is not carried
into a contribution or a log line: the failing paths are diagnostic detail about
provider-controlled content, and the bounded reason is what an operator acts on.

A value is accepted as a record only when its prototype is `Object.prototype`
or `null`, decided by identity rather than by `instanceof`, which would consult
`Symbol.hasInstance` and would accept any subclass of `Object`. "Not null and
not an array" is a weaker question that a `Date`, a `Map`, a typed array, a
boxed primitive and a class instance all pass, and where every declared property
is optional - `MediaVariants` is the only such object in the contract - such a
value produces no issue at all. `null` is accepted because a null-prototype
record inherits nothing and is therefore safer, not more dangerous.

The validator never throws. Every declared field is read once through the shared
`ownDataProperty` discipline, so an accessor is described rather than invoked
and an inherited property is not mistaken for an own one; every reflective trap
it touches - `getPrototypeOf`, `ownKeys` and `getOwnPropertyDescriptor` - is
contained; array holes are missing elements; and an outer guard makes
"never throws" true by construction rather than by having enumerated every trap
correctly. Traversal is bounded by a documented collection cap and a documented
issue cap. **No depth limit is invented**: the schema is finite and
non-recursive, so traversal depth is bounded statically.

`ownDataProperty` moved from `providers/coordination/` to `runtime/`. Two layers
now need the same primitive, the contract validator must not depend on the
coordination package and the coordination package must not depend on the
contract validator, so the shared primitive belongs to neither. The rule stays
one implementation, which is what its own documentation requires.

### D24.5 - The season referential vocabulary is completed

Three relations join the closed `seasonRelations` vocabulary, each independent
of the others and of `duplicate-identity`, `session-event`, `result-event`,
`result-identity` and `event-has-results`:

- **`event-identity`** — `calendar[].id` must equal `{season}-{eventSlug}`
  (F4). An event with an arbitrary unique id passes every existing relation as
  long as its sessions and classifications use that same wrong id.
- **`constructor-entry-identity`** — `constructorEntries[].id` must equal
  `{season}-{constructorId}` (F5).
- **`driver-entry-span`** — a driver's participation spans may not be inverted
  or overlapping (F3), mirroring `CompetitorDao._validateDriverSpans()`
  including its null-bound semantics and its treatment of touching spans.

There is deliberately **no** symmetric identity relation for a driver season
entry: the domain model appends a start round for a split seat, so its identity
is not a strict function of the payload.

## Consequences

### What this delivers

- The D14 activation gate is an implemented mechanism instead of a written
  requirement, and a future adapter's normalized output is verified rather than
  trusted.
- F3, F4 and F5 are closed, and are recorded in the repository rather than only
  in a merged pull request's discussion.
- A provider cannot publish an undeclared field, a raw upstream enum token, a
  malformed identifier, a non-finite number, a non-calendar date or a
  non-canonical derived identity, even after an adapter exists.
- Validation costs nothing on the live path: the mock provider's whole season
  and every production public fixture validate clean, proving the gate is
  openable and not merely closed.

### What stays dormant

No adapter, no provider DTO, no live provider mode, no provider request, no
cron trigger, no Cloudflare resource, no binding, no deployment, no credential
and no schema change follows from this decision. `PROVIDER_MODE` still admits
exactly `mock` and `none`; staging is `mock` and production is `none`. No class
implements `ProviderResourcePort`, no production module constructs
`MultiSourceCoordinator`, `SynchronizationService` stays on the single-provider
path, the rate-limiter namespace stays unbound and
`recordedProvisionalSessionEndBound` stays `null`. Nothing was fetched and no
provider was contacted.

### Still open

Registering a real adapter remains gated on that adapter's own normalization
being correct for its source — this validator proves conformance of what an
adapter produces, not that the adapter maps its provider's semantics correctly,
which is per-source work and needs recorded evidence.

**Media URLs must additionally satisfy the client loading policy before an
adapter is activated.** The wire contract declares `MediaVariant.url` as
`format: uri`, which is RFC 3986, and that is what this validator enforces: a
raw string carrying whitespace, a C0 control, DEL or a backslash is refused
before `new URL()` can repair it into something that parses, because the value
retained and published is the unrepaired original. It is deliberately **not**
narrowed to `MediaUrlPolicy.strict`, the Flutter loading rule
(`lib/features/shared/domain/media/media_url_policy.dart`), which additionally
requires HTTPS, requires a host and refuses `userinfo`. Those are stricter than
anything an authoritative repository document states about the wire, and
adopting them here would silently replace the producing contract with a
consumer's policy. The gap is real all the same: a URI this gate accepts and
that policy refuses is media no client will load. **Any future adapter that
produces media must therefore demonstrate that its emitted URLs satisfy
`MediaUrlPolicy.strict` before it is registered or enabled**, as part of the
same per-source normalization evidence. Changing the wire requirement itself
would need the OpenAPI contract to say so first.

**G1** (live provider
mode), **G3** (production cron), **G5** (event-aware scheduling), **G9**
(persisted provenance and provisional/reconciled state) and **G-l** (mapping
dataset coverage) remain open. Both real adapters remain unimplemented, OpenF1
remains fail-closed with no recorded maximum-session-duration bound, and the
attribution and ShareAlike publication surfaces remain outstanding. Nothing here
authorizes production synchronization, deployment or public release, and every
budget, non-commercial, licensing and attribution conclusion of
[ADR 0019](0019-formula-one-provider-legal-gate.md) is unchanged.
