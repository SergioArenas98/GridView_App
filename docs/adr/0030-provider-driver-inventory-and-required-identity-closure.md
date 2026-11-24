# 0030 - Provider driver inventory and required identity closure

- Status: Accepted
- Date: 2026-11-13
- Authorization: U0 architecture only; U9-U10 implementation is not authorized.
- Product-owner decision: PO-2.
- Amends: [ADR 0022](0022-curated-provider-identifier-mappings.md) D7/D10 inventory blocking wording and [ADR 0026](0026-season-participation-semantics-and-derivation.md) D1-D2/D11/D13.
- Design: [Identity Management Design](../technical/GridView_Identity_Management_Design.md), section 8.

## Context

Driver discovery inventory can contain unresolved people who are not required by
any selected race or standings resource. Making every such observation a public
identity prerequisite is broader than the required identity closure. The owner
accepts a driver-only exception while retaining complete guarded publication.

## Decision

### D1 - Narrow optional driver inventory

After U9-U10 acceptance and separately approved mode activation, a complete,
strictly decoded driver inventory may explicitly account for valid unmapped
driver keys as private unresolved observations. They do not invalidate an
otherwise complete valid season solely by being inventory-only.

Keep `season-participants` as one required resource and its existing two
requests. Do not create a separate scheduled resource. A structurally valid
driver inventory containing only such unmapped cases may continue to the
constructor request. Constructor transport, decoding, identity resolution and
inventory membership remain strict. HTTP failure, malformed/truncated pages,
duplicates, invalid keys/catalogs or dangling profiles still fail the resource.

Every driver row is counted as verified or unresolved. Enforce row-count
equality, unique observation/candidate hashes, unique canonical driver IDs,
verified-profile equality and matching pinned catalog hash. Duplicate aliases
within a collection remain contradictions. Persistence success is not required
to compute private unresolved accounting.

No unresolved observation creates a public provisional ID, route, profile,
season entry, team assignment or participation span. Acknowledgement is still
not resolution. This exception never applies to constructor inventory or any
required race/classification/standings row, including fastest-lap references.

### D2 - Required identity closure from one pinned catalog

The public driver profile set is the union of verified inventory members and
all required IDs from selected results, nonnull fastest-lap references, driver
standings, derived participation spans and nonnull constructor-lineup driver
references. Load a required profile absent from inventory only if already
verified in the same pinned catalog. Missing profiles block the complete
candidate; never create an identity or copy a predecessor profile as repair.

Retain verified inventory order, then append additional required profiles in
deterministic exact-ID order. Do not include every global driver in every
season. Deep-validate loaded profiles and existing reference/span relations.
Constructor reference coverage still comes from strict constructor inventory.

The new internal policy has a closed, discriminated payload; the coordinator
checks it against the expected run policy/hash and detaches it fully.
Consume private inventory accounting before constructing
`ProviderSeasonSource`. Public API v1, normalized public entities, snapshot
schemas, Flutter DTOs and Drift remain unchanged. This supplements
[ADR 0024](0024-deep-normalized-contract-validation.md), not a general
unknown-property allowance.

### D3 - Participation and publication stay strict

Participation derives only from selected, accepted classified Jolpica race
evidence under ADR 0026 D3-D10 and current reconciliation eligibility. Keep
present DNS, retired and disqualified rows. Inventory, standings, practice,
expected lineups, identity approval or profile existence cannot fabricate
participation. `driverEntries` remains empty in the participants contribution;
assembly owns derivation.

Never filter unresolved race or standings rows. They still fail their complete
resource. Every planned required resource/round, standings coherence rule,
reference-integrity check and reconciliation prerequisite must hold.
Reconciliation acceptance is not publication authority; catalog activation is
neither. Publication remains one complete guarded season through the sequencer.

ADR 0026 D12 and D14-D16 remain mandatory: historical classified-round coverage,
published participation facts and atomic comparison against the same
authoritative predecessor. Earlier snapshots are guards, never sources for
missing current rows. [ADR 0023](0023-multi-source-provider-coordination.md)
A1 actual request accounting, A2 race normalization, A3 standings coherence,
and D11 complete publication remain in force. Source preference, quotas,
cadence and operator holds are unchanged.

### D4 - Compatibility, limitations and gates

Strict inventory remains the existing behavior until explicitly changed under
[ADR 0031](0031-identity-review-authority-and-catalog-cutover.md). Optional drivers requires runtime catalog mode,
U9/U10 validation and a separate activation gate. Record inventory policy in
internal run/batch provenance; legacy payloads remain strictly validated.

A positive controlled case must show complete guarded publication with unknown
inventory-only drivers. Negative cases must preserve the active release for
unknown required race/standings identities, failed inventory transport/decoding,
missing profiles/rounds, pending corrections and D14-D16 conflicts. Verify the
additional constructor attempt after the newly permitted driver case.

This does not prove that the November incident would publish, establish its
complete root cause, or authorize curation of its four unresolved keys.
Resource-scoped publication and destructive historical identity correction
remain separate future architectural projects with no unit in U0-U11.
There is no broad nonparticipating-profile deletion policy.

## Supersession boundaries

ADR 0026 D1-D2 no longer require every driver discovery observation to be a
canonical identity in optional mode, nor make inventory membership the only
source of required driver profiles. D11 adds assembly-owned verified profile
closure; D13 permits the constructor request after the narrow unmapped-driver
case while preserving endpoints, pagination and actual attempt accounting.
ADR 0022 D7/D10 blanket unmapped-resource blocking is narrowed only for that
case. All strict behavior remains in effect before implementation and mode
activation. Original reasoning is retained in those ADRs.
