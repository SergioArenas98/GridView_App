# U4 preflight: stopped before implementation

Review date: 2026-11-14. U4 is **not implemented**. The mandatory preflight
found a material incompatibility between R0's season projection calculation
and the approved dataset-version policy. Per the task's stop condition, no
source data, seed artifacts, schemas or application code were repaired.

## Worktree and preservation

Work was confined to `Gridview-jolpica-proxy`, branch
`feat/jolpica-egress-proxy`, HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`.
The UI-redesign worktree was neither inspected nor modified.

[Pre-U4 inventory](identity-u4-baseline.json) records all 1,400 tracked and
nonignored untracked files with SHA-256 hashes, plus the complete expanded
Git status (108 prior dirty files), HEAD and branch. Ignored local artifacts
and dependencies are outside this Git inventory. It was captured before
artifact regeneration or other worktree writes; the inventory excludes itself.

A subsequent hash comparison found zero changed or missing baseline files.
The prior November investigation and U0-U3 work remain byte-identical, including
the source evidence file and all three R0 artifacts. Nothing was staged,
committed, pushed or merged.

## R0 package checks

The exact seed, manifest and parity report were read. Running the existing
offline generator against their current directory accepted all three existing
artifacts as byte-identical. Its preflight rejects differing output before
writing; it then rewrote only identical bytes. No package content changed.

| Check                                                      | Result                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Canonical drivers / constructors / circuits / events       | 33 / 11 / 24 / 23                                                                  |
| Approved mappings / evidence / unresolved acknowledgements | 94 / 101 / 7                                                                       |
| Dataset version                                            | `2026.10.07.1`, unchanged                                                          |
| Catalog content hash                                       | `sha256:c4177cd01b71c4b6bdd4d38aeb813d415f8acdbd9f073d9db6e0f2536be2c0e5`          |
| Exact seed export file SHA-256, independently computed     | `sha256:a19153d43ffb25e9539dbdc2c99cef1bd581cc0b88eaf96c66cc4d6515c1cbc9`          |
| Snapshot / export bytes                                    | 403,732 / 555,679                                                                  |
| Manifest source file hashes                                | All ten match actual current file bytes                                            |
| Exact commit provenance                                    | Nine sources match HEAD bytes; dirty evidence has `exactCommit: null`              |
| Historical review attribution                              | Import reviewer and approval timestamps remain null                                |
| Historical creation timestamps                             | Driver anchors and bindings remain null                                            |
| Evidence classification                                    | 94 historical mapped, three historical unresolved, four pending operator reports   |
| Parity report                                              | Every binding, profile and unresolved comparison is equal; no equivalence failures |
| Seed state                                                 | `prepared-unactivated`                                                             |

The dirty evidence hash is
`sha256:9ab5c486201beff9fcd81ce4696a4b4d2a513149eef2c4ec85fabcd69c1c479d`.
The generator also checks the historical evidence against HEAD and the four
pending additions separately. Historical provider citations remain imported
claims; this review did not contact providers or recapture those observations.

All seven blockers remain unresolved: OpenF1 constructor values `Racing Bulls`
and `Cadillac`, OpenF1 integer driver number `12`, and Jolpica driver keys
`rafael_camara`, `gabriele_mini`, `freddie_slater`, `nikola_tsolov`.

These checks establish structural validity and reproducibility under the U3
validator. They do not constitute product-owner approval of real-world evidence
or permission to activate R0 in staging or production.

## Material blocker: evidence participates in the effective season hash

The authoritative [design section 6.4](../technical/GridView_Identity_Management_Design.md#64-dataset-versions-and-one-source-of-truth)
requires evidence-only changes to leave dataset versions unchanged. A dataset
label identifies one effective season projection, with immutable historical
projection/version relationships.

In `services/edge-api/src/identity/catalog/snapshot.ts`, lines 225-239,
`sourceDocuments` includes **all ten** source documents, including
`provider-evidence`. `baseContentDigest` hashes that entire collection and
`seasonProjectionHash` includes that digest. The effective season projection
therefore changes when only an evidence document's descriptive note changes.
The projection input additionally includes `datasetVersion` itself; a future
allocator must explicitly settle its treatment rather than assume the hash
already represents version-independent effective content.

An isolated, in-memory probe used the existing `prepareSeed` implementation:

1. Load the current corpus and prepare its seed.
2. Clone the corpus in memory.
3. Append ` Evidence-only in-memory preflight probe.` only to the
   provider-evidence document's top-level `note`.
4. Re-encode that document, recompute its actual file hash and set its
   `exactCommit` to null. Leave every identity, mapping and metadata value alone.
5. Prepare the cloned corpus and compare the results.

Both packages passed the existing seed validator. No probe was written to disk
or imported into storage.

| Value             | Original R0                                                               | Evidence-only in-memory probe                                             |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dataset label     | `2026.10.07.1`                                                            | `2026.10.07.1`                                                            |
| Base digest       | `sha256:2b4ee57f8c0c3e3433f4248cbe63d74bf1b0e028d967ff3b43e5db82774d5674` | `sha256:06b47cad07a76c66afa95411156e3f997a64b785f2ad2fee8e32a54da2dba12c` |
| Season projection | `sha256:99aff70e52568355ea549053f00ded27b2fcd9cdf4eea044bd4c0ff70365920a` | `sha256:b6d8048f0ae25e43f27a2dfbe52002a6a806d658a73e1c8ae7ad037e7fccbec7` |

Driver members, constructor profiles, circuit profiles, event profiles, and
every binding's exact key and target were identical. This is a semantic hash
boundary problem, not an omitted identity or a corrupted SHA-256 calculation.

Using this projection unchanged for U4 allocation would either allocate labels
for evidence-only changes or admit different stored projection hashes for the
same label. Simply replacing the projection algorithm also changes R0's
reviewed projection/content/export hashes. That choice requires an explicit
correction or compatibility decision before implementation proceeds.

No other material inconsistency was established in the completed package
checks. This stopped preflight is not an exhaustive approval of every external
historical claim or of the as-yet-unimplemented revision model.

## Validation actually performed

From `services/edge-api`:

```text
node scripts/identity/seed.mjs --out ../../docs/operations/identity-seed-r0
node scripts/identity/compile-schemas.mjs --check
npx vitest run test/identity/catalog/seed.test.ts test/identity/catalog/validation.test.ts test/identity/catalog/parity.test.ts test/identity/catalog/seed-storage.test.ts test/identity/catalog/seed-local.test.mjs --maxWorkers=1 --testTimeout=30000
git diff --check
```

All commands passed. The focused run passed 43 tests in five files, zero skips
and zero timeouts, in 30.12 seconds. It included U3's real local SQLite DO
rollback/restart/replay and export/reimport checks. Node emitted its existing
experimental SQLite warning. This demonstrates U3 recovery only; it is not
evidence of any U4 activation transaction.

U4 tests, the full edge-api suite, separate U1-U2/mapping/normalization/sync
regressions, type checking, linting and content validation were not run: the
mandatory preflight stopped implementation, and no application code changed.
The report and baseline inventory were formatted and checked with the installed
Prettier. No new code coverage claim is made.

## Change inventory and unimplemented deliverables

Only these preflight deliverables were added:

- `docs/operations/identity-u4-baseline.json`: complete prior Git file/hash and
  expanded change inventory; separates all earlier work from these additions.
- `docs/operations/GridView_Identity_Catalog_U4_Preflight.md`: this report.

No earlier file was modified in content. There are no U4 review/proposal/
validation/activation modules, tables, migrations, internal ports, reservations,
correction records or concurrency guarantees to report. All requested U4
implementation and acceptance scenarios remain pending. Existing U3 tests
passing does not satisfy U4 acceptance.

## Required decision before resuming U4

Authorize a narrowly scoped correction of the seed's effective projection
boundary and regeneration/review of the affected offline artifacts, or approve
an explicit compatibility treatment for the already prepared R0 hash. Keep
dataset `2026.10.07.1`, source metadata, canonical identities, bindings and all
seven unresolved acknowledgements unchanged. No such repair has been made.

After that decision, repeat the exact R0 preflight, then implement and validate
U4 under its original scope. U5 remains unauthorized and requires completed U4
acceptance, including atomic activation, concurrency, idempotent recovery,
strict additive migration and restart tests. Named operational owners and
individual credentials remain separate future gates.

No administrative route, CLI, runtime synchronization, public publication,
provider call, deployment, remote resource change, credential or real-world
identity was introduced.

## Corrective addendum: U3 season projection integrity (2026-11-14)

This addendum supersedes the unresolved hash-boundary finding above. The original
preflight findings and investigation history remain intact. The product owner
subsequently authorized this U3 correction only. U4 remains unimplemented and
must not resume automatically.

### Root cause, hash boundaries and affected callers

The previous projection included the full source-document digest and the dataset
label. Evidence notes, unresolved acknowledgement details, document annotations
and source-level provenance therefore affected effective season identity.
Including the label also made the proposed allocation input depend on its output.

The corrected pure helper in `services/edge-api/src/identity/catalog/projection.ts`
constructs effective content for a requested season. It includes:

- Exact typed provider keys and targets belonging to that season.
- Complete canonical driver profiles when bound or explicitly referenced by
  driver entries, constructor lineups or applicable overrides.
- Complete sealed constructor, circuit and event profiles selected by that
  season's bindings and explicit base references.
- The season label, complete driver/constructor entry rows and applicable
  driver/constructor/circuit overrides from the validated immutable base.

Registries and bindings are sorted deterministically. Existing base row order
is preserved. No fields within selected normalized profiles or entry/override
rows are dropped. R0's effective projection includes all 33 drivers, 11
constructors, 24 circuits, 23 events and 94 mappings; no R0 identity is excluded.
An unbound driver such as the existing season-referenced driver is included.

Evidence, acknowledgements, observations, review/import history, source paths,
source hashes, document notes/status/schema hints and the dataset label are not
effective-content inputs. Candidate observations live outside the snapshot;
this helper has no discovery/store dependency. Multi-season isolation is tested
with synthetic snapshots, without broadening the fixed R0 loader to new seasons.

The full integrity mechanisms deliberately retain their original scope:

- `baseContentDigest` still hashes the complete validated source-document
  collection, including evidence. It is an integrity/provenance digest, not an
  effective-content digest, and no longer feeds the season projection.
- `contentHash` still hashes the entire canonical snapshot, including evidence,
  import references, unresolved cases and full source documents.
- Each source retains its exact byte hash, semantic hash and provenance fields.
  The canonical self-contained export covers the complete package; SeedStore's
  separate export hash protects that whole package in durable storage.
- `validateSeed` still rebuilds every member from the validated source closure
  and compares the entire snapshot and its hash. No partial acceptance or
  compatibility fallback was added.
- `datasetVersion` remains a separate label bound to effective season content.
  No allocator or version reservation was implemented; R0 stays `2026.10.07.1`.

Call chain: the local CLI loads exact source bytes with `loadCorpus`, then
`artifacts` calls `prepareSeed`, which validates sources, calls
`deriveSnapshot` and hashes the entire resulting snapshot. Only
`deriveSnapshot`'s effective projection calculation changed. Export/import,
SeedStore import/read and `catalogIndexes` all call the unchanged strict
validator, which recomputes the same corrected projection transitively. The
manifest/parity generator carries the resulting full catalog hash. Searches
found no other season projection calculator or runtime consumer to switch.
Production Worker reachability and runtime resolution remain unchanged.

### Exact R0 regeneration and compatibility findings

Before replacement, the original package was checked against its exact source
hashes, full snapshot hash, full base digest and the original projection formula.
All matched. Under the corrected formula the old package is intentionally
rejected by whole-snapshot parity, even with its old self-consistent catalog
hash; a regression test preserves that fail-closed behavior.

The existing offline generator produced artifacts in a separate local directory
using only the existing reviewed corpus. An asserted structural comparison
allowed only the seed's projection hash and full catalog hash to differ. The
manifest and parity JSON differed only in their propagated catalog hash. Only
then were the generated artifacts copied to the R0 directory. The temporary
output directory was removed. Repeating the generator accepted the corrected
artifacts as byte-identical. No generated hash was hand-edited.

| Semantic value         | Previous                                                                  | Corrected                                                                 |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Season projection hash | `sha256:99aff70e52568355ea549053f00ded27b2fcd9cdf4eea044bd4c0ff70365920a` | `sha256:ab953da8b44e80f7d9bc87fd948a32b0c67785eaa15c4d50348f0a4f8b7cc746` |
| Catalog content hash   | `sha256:c4177cd01b71c4b6bdd4d38aeb813d415f8acdbd9f073d9db6e0f2536be2c0e5` | `sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851` |

| Artifact      | Previous exact file SHA-256                                        | Corrected exact file SHA-256                                       |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| seed.json     | `a19153d43ffb25e9539dbdc2c99cef1bd581cc0b88eaf96c66cc4d6515c1cbc9` | `6abc3830314c2c08fad2c3577141ca548b0b7e3a2109d7acf66e3c85448edab7` |
| manifest.json | `d4e37f895116d7b14b948a52562dcffbe6b7b42f099bd008c67b68fb888fb104` | `bdbaeb3792056c9d7a4e4e81633b2ce66dc7f458f55642994999de9e3bcd1fe1` |
| parity.json   | `8d8dbdb538b4a9e1552db47fd2f9ed9c22ffb93ee9d14c0133cc3623843a652e` | `372b67eaa9ca1b8043ee1604e80961beb66274b9c95e70a40b165ec63b6d6f46` |

All other package fields remain identical: source bytes/hashes/provenance,
canonical anchors and profiles, binding IDs/keys/targets, evidence, historical
null attribution/timestamps, acknowledgements, dataset label, sequence and
unactivated state. The complete base digest, snapshot size (403,732 bytes)
and export size (555,679 bytes) remain unchanged. Resolver, normalization and
generated-document parity are retained.

No active installation needs migration: R0 remains unactivated. Local fixtures
with the old prepared artifact must be regenerated in a fresh isolated store;
an existing store is never overwritten or reset by this patch. This is an
explicit replacement of an unactivated review artifact, not a silent reuse of
an activated dataset label. Any external review checklist referencing the old
hash must use the corrected hash before a future authorized import.

### Regression and validation evidence

Tests were written first. The original implementation failed both evidence-note
and acknowledgement-detail invariance tests, while its tamper rejection passed.
After correction, all 30 focused tests pass. They cover evidence-only invariance
with full catalog sensitivity, acknowledgement invariance, candidate isolation,
season-specific binding key/target sensitivity, all mutable driver profile
fields, cross-season relevance, constructor/circuit/event sensitivity, base
entry/override/label sensitivity, metadata/version exclusion, ordering and input
immutability, missing/duplicate metadata rejection, exact deterministic R0 bytes,
export/import provenance, seven unresolved cases and old-contract rejection.

The complete identity run passed 208 tests across 18 files before the final two
artifact tests were added; those final tests passed in the focused 30-test run.
It includes all U1/U2 and U3 suites, Node SQLite and real Miniflare/workerd SQLite
rollback/restart/replay/export/reimport checks. Node's existing experimental
SQLite warning appeared. No test deadline or assertion was weakened.

Initial type checking caught test-fixture inference and readonly-key mutation
errors. Those test-only errors were corrected, and the subsequent full type
check passed. ESLint, package formatting, generated-schema freshness and
content validation also passed. Content validation checked 18 items, zero failures.
The first full-suite attempt exposed a missing exact utility-import allowance
in the existing mapping containment test. The allowance was added without
changing its assertion or Worker dormancy guard. A focused mapping/provider
neutrality run then passed 168 tests in five files. Final full-suite and
preservation results are recorded below when complete.
Coverage percentage was not measured: the existing package has no installed
Vitest coverage provider; no dependency or lockfile was changed for this patch.

### Corrective file inventory and preservation

[Correction baseline](identity-u3-correction-baseline.json) captures all 1,402
preexisting tracked/nonignored files, their SHA-256 hashes, expanded Git status,
branch and HEAD before corrective edits. It includes the earlier preflight
report and the original pre-U4 baseline. It excludes itself and ignored files.

Modified by this correction:

- `services/edge-api/src/identity/catalog/snapshot.ts`: delegate effective
  season hashing to the pure projection helper.
- `docs/operations/identity-seed-r0/seed.json`: generated hash correction.
- `docs/operations/identity-seed-r0/manifest.json`: generated catalog hash.
- `docs/operations/identity-seed-r0/parity.json`: generated catalog hash.
- `docs/operations/GridView_Identity_Catalog_U4_Preflight.md`: this addendum.
- `docs/operations/GridView_Identity_Catalog_U3.md`: appended correction pointer.

- `services/edge-api/test/providers/mappings/mapping-containment.test.ts`: add
  only the exact `canonicalKey` utility import for the new offline helper.

Created by this correction:

- `services/edge-api/src/identity/catalog/projection.ts`.
- `services/edge-api/test/identity/catalog/projection.test.ts`.
- `docs/operations/identity-u3-correction-baseline.json`.

The baseline's expanded Git status distinguishes every earlier investigation/
U0-U3 edit from these ten corrective paths. No actual content source, Android
configuration, dependency, schema, discovery/store implementation, runtime
composition or publication contract was changed.

### Preflight disposition and remaining gates

The reported projection integrity blocker is corrected. The exact regenerated
R0 package passes technical preflight: complete counts and parity, exact actual
source provenance/hashes, full snapshot/export integrity, historical null
attribution, unchanged dataset and all seven unresolved acknowledgements.
Technical validity is not product-owner approval of the underlying real-world
evidence, staging import or activation.

U4 remains stopped pending separate authorization. No review/proposal/activation
state machine, runtime cutover, dataset allocation, provider call, sync,
publication, infrastructure operation, deployment, credential, real identity,
commit, push or merge was performed. Future schema additions must explicitly
classify new base-content fields and extend projection tests; unknown schema
content continues to fail existing closed validation.

### Final corrective acceptance results

| Check                                                      | Final result                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Focused projection regressions                             | 30 passed, zero skips/timeouts                                                                            |
| U1-U3 identity run before final artifact assertions        | 208 passed across 18 files; final two assertions subsequently passed in focused and full runs             |
| Mapping/dataset/provider-neutrality retest                 | 168 passed across five files                                                                              |
| Final full edge-api suite                                  | 6,029 passed, six existing skips; 281 files passed, three skipped; zero failures/timeouts; 270.13 seconds |
| Type checking and ESLint                                   | Passed                                                                                                    |
| Package and corrective-document formatting                 | Passed                                                                                                    |
| Generated schema freshness                                 | Passed                                                                                                    |
| Content validation                                         | 18 checks passed, zero failures                                                                           |
| Repeated R0 generation and exact export/import             | Passed; identical generated bytes                                                                         |
| Source/provenance and original report-body verification    | Passed                                                                                                    |
| Final preservation inventory and git diff whitespace check | Passed                                                                                                    |

The first full attempt had 6,028 passes, six skips and one import-allowlist
failure (262.41 seconds). After the exact allowance correction and focused
retest, the complete command was rerun successfully:

```text
npm test -- --maxWorkers=1 --testTimeout=30000
```

The six skips are the existing opt-in tests in
`test/e2e/automatic-updates/{staging-first-run-rehearsal,controlled-source-export,app-gate}.test.ts`.
Their conditions were retained. No opt-in staging/capture workflow was enabled.

The final baseline comparison confirms exactly seven modified preexisting
paths and three added paths, all enumerated above. All other 1,395 baseline
files are byte-identical; none is missing. Every actual content source and the
original pre-U4 inventory remain unchanged. The original U3 and preflight
report bodies match their pre-correction hashes after separating the appended
addenda. Branch and HEAD remain unchanged and nothing is staged or committed.

**Disposition:** the technical R0 preflight gate now passes under the corrected
projection contract. This correction grants no evidence approval, activation,
staging/production migration or U4 implementation authority. Stop after U3.
