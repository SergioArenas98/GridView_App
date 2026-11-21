# 0031 - Identity review authority and catalog cutover

- Status: Accepted
- Date: 2026-11-13
- Authorization: U0 documentation only. U1-U11 and every deployment require separate approval.
- Product-owner decisions: PO-3, PO-5, PO-6, PO-7 and PO-8.
- Staging exception: SOE-1, accepted 2026-11-21, Tier A only (note under D6). The D6 requirements are unchanged.
- Supplements: [ADR 0009](0009-protected-staging-administration-token.md), [ADR 0020](0020-provider-source-observation-and-reconciliation.md), [ADR 0025](0025-season-publication-authority-and-rollback-republication.md) and [ADR 0028](0028-automatic-end-to-end-season-updates.md).
- Design: [Identity Management Design](../technical/GridView_Identity_Management_Design.md), sections 6-7, 9 and 11.

## Context

Runtime curation needs individual accountability, one identity context per run,
immutable dataset provenance and a controlled handover from Git. Architecture
approval does not establish operational readiness, assign people or authorize
provisioning. No authentication routes, credentials, schemas or state are
created by U0.

## Decision

### D1 - Individual authority and separate operations

Catalog roles are reader (inspect/export), reviewer (evidence, approval,
disposition, profile and correction review), and activator (validation,
activation, seed/base import and admission control). Every mutation requires an
individually authenticated principal and server-derived credential/role identity.
The shared `ADMIN_TOKEN` cannot authorize catalog mutations, including
acknowledgements and validation certificates. Existing legacy operational routes
retain their authorization. An identity-only credential cannot authorize sync,
publication, rollback or purge.

The design's initial mechanism is a separately provisioned ignored-local/CI
secret configuration of credential ID, token digest, principal, roles,
disabled flag and expiry. Individually issued random tokens have at least
256 bits of entropy, travel only as HTTPS Bearer credentials, and never enter
URLs, CLI arguments, logs or Git. Rotation/revocation preserves historical
actor and credential attribution. No credentials or authentication routes are
implemented or provisioned in U0.

Identity approval and catalog activation are separate explicit audited
operations. One authorized individual may hold both roles and perform both;
there is no mandatory two-person quorum. A second reviewer is recommended for
genuinely new or ambiguous identities. Approval never auto-activates, and
activation never starts synchronization/publication or accepts a classification.
Mutation and audit receipt commit together with CAS and idempotency.

The design permits shared-token read-only shadow inspection as a transitional
compatibility option, never mutation authority. It is not the reviewed
operating model: named reader/reviewer/activator access must be individually
authenticated at runtime cutover; shared-token catalog reads must then be
disabled. This makes PO-3's individual accountability explicit while preserving
the existing shared authorization for unrelated routes.

Ordinary operation bodies are capped at 256 KiB; seed/export imports at 2 MiB
with bounded reads. Lists accept 1-100 items, default 50, with opaque bounded
cursors. Closed versioned requests reject unknown fields; actor and time come
from the server. The CLI reviews exact files/hashes/deltas and never fetches
evidence URLs, guesses identity or silently activates a proposal.

### D2 - Pinning and fail-closed runtime admission

Every identity-consuming synchronization uses one complete immutable context:
installation, run ID, season, revision/hash, registry, driver profiles, sealed
non-driver/base content, dataset metadata and inventory policy. No mid-run
refresh or bundled defaults inside runtime composition.

Acquire the existing lease and recover/read authoritative publication state,
plan, then pin before constructing provider ports and before provider requests.
Nothing-due runs need not pin. Pin timeout is two seconds with at most one
retry of the identical run ID/season/purpose; a committed pin is returned on
retry, never rebound to a newer head. Both attempts consume existing
240-second coordination / 300-second publication-intent budgets.

Apply this to scheduled/manual sync, operator verification, offline batch
generation and batch admission. Identity-consuming diagnostics pin or declare
an explicit bundled diagnostic mode; they cannot silently use bundled defaults
in runtime mode. Offline generation pins a verified local export and performs
no hidden network access.

Missing, invalid, unavailable or unvalidated required catalog means zero provider
requests and zero publication attempts. Release the lease on admission failure.
Existing published snapshots remain readable. Never silently fall back to
bundled mappings or an arbitrary cached head after runtime cutover. A fully
pinned run can finish even if the catalog later becomes unavailable; subsequent
runs see subsequent activated revisions.

Internal pin provenance is separate from classification content hashes and
ledger schema v1. Profile/alias updates do not reset settling or supply provider
corroboration. Discovery persistence remains best-effort as
[ADR 0029](0029-persistent-identity-discovery-and-reviewed-runtime-catalog.md) requires, including no provider retry.

### D3 - Dataset and release version policy

Seed R0 preserves `2026.10.07.1` and all existing canonical IDs exactly.
Acknowledgement/evidence-only imports do not change the dataset version.
No dataset or schema is changed in U0.

For effective catalog-content changes, hash each season's exact relevant
profiles, registries, bindings and immutable base inputs. A changed projection
gets a new `YYYY.MM.DD.N` dataset label, even for a binding not used that day.
A global profile change affects every season binding/referencing that profile.
Unaffected projections retain their labels. Candidate/evidence/audit-only
changes create neither a catalog revision nor a dataset bump.

Reserve labels at proposal creation using server UTC date and a monotonically
increasing per-date suffix with uniqueness enforced per season. Reserve seed
labels first; dates cannot regress, and abandoned labels are never reused.
The reviewer sees the reserved label before activation. Activation atomically
registers the immutable season projection/version relationship.

Catalog revision IDs/hashes and schema versions remain internal and distinct
from public dataset labels, release versions and snapshot revisions.
`contentVersion` keeps the dataset label; publication versions remain
sequencer-owned. Historical bytes and provenance are immutable, and historical
snapshots never acquire invented retroactive catalog references.
Media/attribution ownership and supported-base admission remain unchanged.

This replaces manual season-metadata edits as the runtime identity-version
allocator only after controlled migration. Git remains the archived seed and
reviewed import/export provenance, never an independent runtime editor.

### D4 - Catalog-aware batch v2 and legacy v1

Implementation U7 introduces private batch schema v2, preserving public API and
snapshot schema v1. Artifact and reviewed manifest bind installation ID,
revision ID/hash, season projection, datasetVersion, base digest, export SHA-256
and strict/optional-driver inventory policy under
`gridview-identity-catalog-ref/1`.

Offline generation requires an explicit verified local catalog export and
replay-only transport. A separately authorized authenticated export is never
hidden inside generation. Admission pins once and requires exact matching
catalog/projection/metadata/policy, verifies submitted profiles against that
catalog/base, and retains manifest review, source validation, completeness,
regeneration and publication fencing. Activation after admission does not
change its pinned context. Stale new submissions must be regenerated and
re-reviewed, never relabeled; identical operation replay retains existing
idempotent recovery semantics.

Keep v1 readability for archives and explicit legacy mode. New v1 admission is
allowed only while bundled authority is selected or runtime R0 is parity-equal
to the exact approved seed with an explicit compatibility gate. First
data-changing runtime activation sets the one-way
`hasRuntimeOnlyActivation` bit and permanently closes new v1 admission for
that installation. Archive readability does not authorize obsolete
republication. No unpinned new legacy batches after runtime-only activation.
Readers reject mismatched schema combinations. U0 modifies no batch schema.

### D5 - Isolation, capacity and recovery

Use separate Worker-local catalog binding namespaces and installation UUIDs
for local, staging, E2E and production. Never choose solely from
`ENVIRONMENT`: staging and E2E can share that string. Do not share cross-Worker
bindings or copy staging credentials, installation IDs or synthetic decisions
into production. Catalog state, schemas and deployment actions remain isolated.

[ADR 0029](0029-persistent-identity-discovery-and-reviewed-runtime-catalog.md) records the accepted initial capacity/retention
limits. Local capacity, actual SQLite constraints, restart and restore tests
are deployment prerequisites; acceptance of limits is not measurement.
Require complete verified revision exports with evidence/decision closure,
restricted storage, a recovery custodian and restore drills before runtime
cutover. Approvals fail closed if provenance cannot be retained.

Before runtime cutover, disable discovery/compare without deleting data.
A deliberate return to bundled R0 is allowed only while parity holds and no
runtime-dependent output exists, after hold/drain and explicit equivalence
review; never as outage fallback. After runtime-only changes use a compatible
runtime reader while retaining catalog/schema/history. Worker rollback is not
state rollback. Do not delete/rename the object, reseed active state, move the
head backward or restore old data over immutable releases.

Identity corrections remain append-only records and containment under ADR 0029
D7. Any compensating revision still obeys append-only identity/binding rules.
Destructive historical correction needs a separate accepted procedure.
D14-D16 have no break-glass bypass.

### D6 - Unfulfilled operational ownership and rollout gates

The owner approves these responsibilities but has supplied no individual names
or credentials. Every assignment below is **unassigned**; none is provisioned.
Record named primary and backup coverage before provisioning or staging
activation. One person may cover reviewer and activator; accountability remains
separate by operation.

> **Staging exception SOE-1 (accepted by the product owner on 2026-11-21).**
> GridView has one operator: the product owner, who is primary staging
> operator and staging release approver. The backup coverage required above is
> **not met** and is **not waived**. For the staging Worker
> `gridview-api-staging` and installation
> `c45d60b8-a723-4b6e-8530-750592af2b94` only, Tier A gates G0, G1 and G1v may
> go ahead without a backup operator under exception SOE-1, with compensating
> controls CC-1 to CC-11 mandatory at their gates (including the eight-hour
> separation before an irreversible operation) and residual risks RS-1 to RS-8
> accepted within that scope. It expires on its documented conditions, at the
> latest 2027-02-28. This requirement remains in force, unexcepted, for G2-G5,
> optional-driver activation, E2E and production. Acceptance authorizes no
> gate: G1 still needs its own approval. Record:
> [SOE-1](../operations/GridView_Identity_Catalog_U11_Solo_Operator_Exception_Proposal.md).

| Responsibility                      | Required named ownership/evidence                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer                            | Named principal for evidence sufficiency, duplicate review, approvals and ambiguous-case escalation; backup reviewer coverage.               |
| Activator                           | Named principal for validation, exact head/hash/delta review, activation and admission control; backup activator coverage.                   |
| Recovery/export custodian           | Named owner for restricted exports, integrity/closure verification, retention/capacity monitoring and restore drills.                        |
| Backup recovery responsibility      | Named alternate custodian with verified restore access and documented handover/recovery duty.                                                |
| Provisioning/rollout accountability | Named authorized operator and recorded environment-specific approval for credentials, infrastructure, holds/draining and staging activation. |

The staged gates are: separately approve units; validate local mechanism and
capacity; separately authorize inert staging provisioning; seed parity;
verified export/isolated restore; at least three controlled complete compare
runs plus unknown-inventory, unknown-required, invalid-payload, storage-outage
and mid-run-activation cases; zero unexplained differences/drops/overflows;
runtime-strict cutover with U6/U7 compatibility, hold/drain and rollback-capable
artifact; then separately gate optional-driver mode after U9/U10.
Existing holds/blocks are never automatically cleared.

U11 is separately authorized staging rollout and production-readiness assessment
only. It must record actual deployed state under that future authorization.
Production always needs its own explicit change approval; a documentation
status, code merge or staging acceptance never authorizes deployment.

## PO decision traceability and retained guarantees

| Approved decision                     | Normative record                     |
| ------------------------------------- | ------------------------------------ |
| PO-1 Runtime authority                | ADR 0029 D1-D2/D6; this ADR D2-D3/D5 |
| PO-2 Driver inventory only            | ADR 0030 D1-D4                       |
| PO-3 Individual accountability        | This ADR D1/D6                       |
| PO-4 Evidence and retention           | ADR 0029 D3-D5                       |
| PO-5 Failure behavior                 | ADR 0029 D4; this ADR D2             |
| PO-6 Versions and batch compatibility | This ADR D3-D4                       |
| PO-7 Historical corrections           | ADR 0029 D7; this ADR D5             |
| PO-8 Capacity, recovery and ownership | ADR 0029 D5; this ADR D5-D6          |

Stable canonical IDs, exact typed private provider keys, separate evidence and
decisions, sufficient reviewable new-identity evidence, immutable atomic
revisions and one pinned context are mandatory. Unknown required
classifications/standings still block; inventory cannot fabricate participation;
only accepted race evidence supplies participation. Reconciliation acceptance
is not publication authority. Whole-season completeness, internal consistency,
historical classifications/identity protections and D14-D16 remain effective.

Flutter, public API v1, production Android identity `com.sejuma.gridview` and
its signing configuration are unchanged. Resource-scoped publication and
destructive historical corrections are separate future projects.
