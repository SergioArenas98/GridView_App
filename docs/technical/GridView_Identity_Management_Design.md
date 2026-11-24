> **Approval addendum - 2026-11-13 (U0 only).** The product owner has approved
> PO-1 through PO-8. [ADR 0029](../adr/0029-persistent-identity-discovery-and-reviewed-runtime-catalog.md),
> [ADR 0030](../adr/0030-provider-driver-inventory-and-required-identity-closure.md) and
> [ADR 0031](../adr/0031-identity-review-authority-and-catalog-cutover.md) are now Accepted architecture.
> This addendum supersedes the original report's pending-policy status and
> historical assignment restrictions, including sections 3.2-3.3 and 14.1.
> The original report below is preserved byte-for-byte as design/audit provenance;
> its implementation descriptions remain future work. U1-U11 require separate
> approval; nothing has been implemented, provisioned or deployed by U0.
>
> Capacity/retention limits are accepted initial baselines, pending local capacity
> validation before deployment. Named reviewer, activator, recovery custodian and
> backup assignments remain open operational gates, not missing U0 policy votes.
> Section 13 U0's named-person criterion is therefore recorded as an unfulfilled
> pre-provisioning/staging gate, not fabricated completion. ADR 0031 D1 narrows
> section 7.1's optional shared-token read compatibility to shadow access only;
> individual catalog access is required at runtime cutover. ADR 0029 D5 clarifies
> that section 5.2's inactive quarantined-candidate archival retains quarantine
> and tombstones under the 365-day rule in section 5.4.
> See the [current implementation gates](GridView_Implementation_Plan.md#31-identity-management-u0-approval-and-u1-u11-gates).

# GridView - Identity management redesign and implementation-readiness audit

- Date: 2026-11-13
- Status: **Proposed technical design; product-owner decisions pending. Not implementation authorization.**
- Scope: phases 0-3 only; persistent discovery, verified runtime catalog, and driver inventory separation.
- Audited worktree: `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`.
- Audited HEAD: `027da5da59bf6b8c75a3fc432ef4fdc691772528`, including the existing uncommitted November investigation changes.
- Location: `docs/technical/` is the established technical architecture/design location; decisions belong in `docs/adr/` after approval.
- This assignment creates only this report. No application, test, schema, content, configuration or infrastructure changes; no provider requests, synchronization, publication, deployment, commit or push.

## 1. Executive summary

The hybrid architecture is implementable incrementally, but it is **not yet policy-approved**. ADR 0022 D6 explicitly forbids runtime identity storage and admin mutations; ADR 0026 D2 explicitly requires every inventory row to resolve. Both need deliberate amendments before implementation changes those behaviors. Preserving exact typed lookup alone is insufficient: canonical profile data, season content versions, offline batch generation and operator verification must use the same pinned identity revision too.

Recommended design:

1. Add a dedicated SQLite-backed `IdentityCatalog` Durable Object (DO), separate from the publication sequencer and reconciliation ledger. One Formula One catalog per isolated Worker namespace is the transaction boundary for cross-season canonical IDs, candidates and revisions. It is not on the public-read path.
2. Capture bounded, untrusted identity evidence **after successful strict resource decoding and before mapping normalization**. Persist it as an independent shadow side effect. Unknown keys still fail their resources in phase 1. Do not turn decoder failures into usable identity rows.
3. Seed an immutable complete catalog from the reviewed repository corpus. Approvals create immutable proposals; validation and an active-pointer compare-and-swap activate a complete revision. Every run obtains one immutable catalog snapshot, profiles and season metadata together, before constructing its provider ports. No mid-run refresh and no silent bundled fallback.
4. Replace driver inventory's all-or-nothing mapping rule only in phase 3. A complete, structurally valid inventory may contain explicitly accounted unresolved driver observations. Classifications and standings remain strict. Assembly includes verified inventory profiles plus every verified identity referenced by the selected race/standings data. Participation still derives only from accepted selected Jolpica race classifications.
5. Keep whole-season publication, reconciliation acceptance, standings-round coherence and D14/D15/D16 unchanged. No predecessor payloads supply missing current data. A new identity approval never accepts a classification, releases a reconciliation hold or publishes anything.

Verified corpus: **33 drivers; 94 mappings; 101 evidence identities; seven acknowledgements**. The four November keys remain unresolved. No retained November response bodies are established by the investigation. The synthetic 25-request regression explains a possible failure pattern, not every real failure.

Phase 3 can remove an inventory-only mapping blocker without resource-scoped publication. It cannot publish around an unresolved race row, unresolved standings row, failed inventory HTTP request, malformed inventory, missing round, pending correction or any other full-season prerequisite. It therefore does **not** establish that the November run would publish.

Recommended first unit: **U0, the ADR/owner decision pack**, followed by the inert evidence model and extractor U1. Do not begin runtime implementation on the authority of this report alone.

## 2. Verified current implementation

All service paths below are relative to `services/edge-api/`; content and Flutter paths are repository-relative. Symbols are supplied alongside paths to make references stable across later edits. Old comments stating “dormant” are historical and sometimes stale; executable composition and current configuration take precedence when describing current code, while accepted ADR policy remains binding.

### 2.1 Code and contract map

| Concern                  | Verified source and behavior                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundled mappings         | [`src/providers/mappings/index.ts`](../../services/edge-api/src/providers/mappings/index.ts), `providerMappingRegistry`, imports the four registries and 2026 mapping file, then caches a resolver at module scope. Evidence acknowledgements are not resolver input.                                                                                                                                                                                    |
| Strict identity boundary | [`mapping-key.ts`](../../services/edge-api/src/providers/mappings/mapping-key.ts), `decodeProviderMappingKey`, `canonicalKey`: season/source/entity/field/exact typed value, length-prefixed encoding; strings and integers differ, event locators have their own type. [`mapping-registry.ts`](../../services/edge-api/src/providers/mappings/mapping-registry.ts), `buildProviderMappingRegistry`: invalid documents invalidate the complete resolver. |
| Content validation       | `scripts/validate-content.mjs`, `scripts/lib/provider-mapping-rules.mjs`, `content/schemas/provider-{mappings,evidence}.schema.json`: closed records, target existence, document uniqueness and evidence coverage. An acknowledgement satisfies evidence accounting, never lookup.                                                                                                                                                                       |
| Hardened transport       | `src/providers/http/provider-http-client.ts`, `ProviderHttpClient.getJson`; `jolpica-transport.ts`; existing limiter/pacer. Provider JSON arrives as unknown after HTTP/body bounds. Identity discovery must reuse these requests.                                                                                                                                                                                                                       |
| Inventory                | [`participants-port.ts`](../../services/edge-api/src/providers/jolpica/participants-port.ts), `fetchResource`: drivers first, then constructors, each limit 100. Driver decoding or resolution failure prevents the constructor request. No paging/retry.                                                                                                                                                                                                |
| Inventory decoding       | `participants-payload.ts`, `decodeSeasonDrivers`/`decodeSeasonConstructors`: complete pagination, exact season and duplicate detection. Only IDs leave the decoder; names are deliberately not read.                                                                                                                                                                                                                                                     |
| Inventory normalization  | `participants-normalizer.ts`, `normalizeSeasonDrivers`/`normalizeSeasonConstructors`: every key must resolve, duplicate canonical identities fail. `driverEntries` is empty; `constructorSeasonEntries` creates season entries with unsupported descriptive facts null.                                                                                                                                                                                  |
| Profiles                 | `curated-participants.ts`, `curatedParticipants`, `curatedParticipantsFrom`: imports static driver/constructor registries. IDs and full names are curated; absent facts become null and adapter media is null. Mapping injection alone will not make new driver profiles available.                                                                                                                                                                      |
| Race/standings           | `results-{port,payload,normalizer}.ts`, `standings-{port,payload,normalizer}.ts`: decoding precedes mapping, an unresolved row fails the complete resource. These normalizers cannot be converted to filtering. Standings' multi-constructor case can legitimately yield `constructorId: null`.                                                                                                                                                          |
| Provider composition     | [`src/sync/coordinated/composition.ts`](../../services/edge-api/src/sync/coordinated/composition.ts), `composeCoordinatedRuntime`: builds all five ports with bundled defaults, one hardened client, concurrency 1, Jolpica only. `JolpicaResourcePort` dispatches resource families. No OpenF1 live adapter is wired.                                                                                                                                   |
| Run ordering             | `observation/observe.ts`, `observeCoordinatedSeason` → composition → fenced season lease → authoritative published revisions/recovery → `planRun` → coordination → observation commit → conditional publication → lease release. Pinning must account for this existing order.                                                                                                                                                                           |
| Operator verification    | `src/sync/coordinated/operator/verification.ts`: separately composes a runtime and requests one classification under a lease. This is another identity-consuming entry point; updating full sync alone is incomplete.                                                                                                                                                                                                                                    |
| Normalized contracts     | `src/providers/coordination/resource.ts`, `payloadMatchesResource`; `payload-contract.ts`, `validateCoordinatedPayload`; `src/contract/normalized/entities.ts`: deep closed shape validation before selection. Internal inventory additions must be declared, not smuggled through extra keys.                                                                                                                                                           |
| Assembly                 | [`season-assembly.ts`](../../services/edge-api/src/providers/coordination/season-assembly.ts), `assembleSeasonSource`: every planned resource selected; calendar, participants, circuits and both standings required; round continuity, standings horizon and reference integrity required. Profiles currently come solely from participants.                                                                                                            |
| Participation            | `driver-span-derivation.ts`, `deriveDriverSeasonEntries`; `season-integrity.ts`, `validateSeasonReferences`: driver/constructor references, duplicate IDs, supported spans, result-to-span relations and `hasResults`. Only selected classified Jolpica race rows derive spans.                                                                                                                                                                          |
| Publication eligibility  | `src/sync/coordinated/policy/publishability.ts`, `decidePublication`: every refreshed season resource observed, every planned classification observed and accepted without pending/staged/competing/superseded state. Reasons are ordered; `classification-unavailable` precedes `season-resource-unavailable`.                                                                                                                                          |
| Publication authority    | `src/providers/coordination/coordinated-publication.ts` → `src/publication/sequenced/service.ts`, `publishGuarded`; `guard/participation-guard.ts`, `guard/predecessor.ts`; `sequencer/{store,rules,model}.ts`. D14 coverage, D15 participation facts and D16 predecessor CAS remain authoritative.                                                                                                                                                      |
| Metadata/digests         | `src/sync/coordinated/outcome/metadata.ts`, `curatedSeasonMetadata`, imports `season-metadata.development.json`; `outcome/digest.ts`, `candidateDigest`; `src/publication/canonical/snapshot-schemas.ts` includes content versions in bootstrap/home/manifest payload revisions. Classification revisions hash normalized race data, not catalog IDs.                                                                                                    |
| Existing durable storage | `src/publication/sequencer/hosts.ts`, `durableObjectSequencerHost`, uses SQLite-backed synchronous KV and `transactionSync`; `src/sync/coordinated/ledger/durable-object.ts` uses an internal command/fetch client with closed decoders. Plain Node Vitest tests use transactional in-memory hosts. SQL tables would be new, but SQLite DOs are not new infrastructure technology here.                                                                  |
| Admin authority          | `src/admin/auth.ts`, `adminAuthOk`: one shared `ADMIN_TOKEN`. Ledger `OperatorAuthMethod` is explicitly `shared-admin-token`, identifying no individual. Existing reconciliation operation UUIDs identify actions, not people.                                                                                                                                                                                                                           |
| Batch ingestion          | `scripts/season-batch/generate.ts`: offline recordings through the same ports/assembly/generator. `src/ingest/{batch-format,batch-verification,service,source-validation}.ts`: schema v1 closed keys, reviewed digests, exact metadata equality, regeneration, completeness and guarded ingest. Adding an undeclared provenance field breaks v1.                                                                                                         |
| Public generation        | `src/snapshots/generator.ts`: driver list from season entries; driver detail for every driver profile. Inventory-only verified drivers can already have a detail without a participation span.                                                                                                                                                                                                                                                           |
| Flutter                  | `lib/core/database/gridview_database.dart`: schema version 2, foreign keys enabled; `unresolved_identity.dart` and competitor DAO use private empty-name stubs for out-of-order canonical references. These are not unknown provider identities or permission to publish guessed IDs.                                                                                                                                                                    |

### 2.2 Corpus verification

The counts below were computed by parsing the current JSON files, not copied from the earlier report.

| File/data                                               |     Current count |
| ------------------------------------------------------- | ----------------: |
| `content/registries/drivers.mock.json` → `drivers`      |                33 |
| 2026 provider mappings → `mappings`                     |                94 |
| Jolpica driver / constructor / circuit / event mappings | 32 / 11 / 24 / 23 |
| OpenF1 driver / constructor mappings                    |             1 / 3 |
| 2026 evidence → `identities`                            |               101 |
| 2026 evidence → `acknowledgedUnmapped`                  |                 7 |

Acknowledgements are the four Jolpica `driverId` strings `rafael_camara`, `gabriele_mini`, `freddie_slater`, `nikola_tsolov`; OpenF1 integer `driver_number: 12`; and OpenF1 `team_name: "Cadillac"` and `"Racing Bulls"`. Preserve all seven as unresolved, even where a plausible existing canonical target is documented. The latter three have `no-approved-provider-mapping`; the four November cases have `no-canonical-gridview-identity`.

The metadata file owns `datasetVersion: "2026.10.07.1"`. Neither the driver registry nor mapping document itself has a datasetVersion field. Evidence-only acknowledgements did not bump that version. Migration must not fabricate such fields in historical input.

### 2.3 Configuration and evidence limits

`wrangler.toml` declares compatibility date `2026-07-01`, declarative SQLite `exports`, separate named environment bindings and distinct snapshot KV namespaces. Staging has coordinated mode, proxy transport and reconciliation ledger. Production declares provider mode `none`, sequencer authority and batch-ingest season 2026, without the staging ledger binding. E2E uses `ENVIRONMENT=staging` but a different Worker/namespace and controlled KV provider source. All three named environments currently declare empty cron lists. These are **repository configuration facts, not a fresh audit of deployed infrastructure**.

Never select a catalog solely by the `ENVIRONMENT` string: staging and E2E share that value. Isolation is by Worker-local binding namespace plus an explicit installation ID. No cross-Worker `script_name` binding is proposed.

The [November investigation](../operations/2026-11-12-jolpica-mapping-investigation.md) records operator-reported 25 HTTP 200s, zero 429s, 22 selected resources, three unavailable and zero publication calls. Its new proxy regression is synthetic. This audit neither accesses another worktree nor establishes missing response bodies, exact failed rounds or approved names. It does not rerun the prior test suite or claim its recorded results as newly executed results.

## 3. Phase 0: policy amendments and approval gates

### 3.1 Guarantees retained without amendment

- Canonical IDs never change, never derive automatically from provider strings and never merge by name. Provider identifiers remain internal.
- Exact typed season-qualified mappings; no fallback field, fuzzy match, coercion, auto-alias or cross-season inheritance.
- Complete revision validation; no valid subset of a corrupt catalog and no last-writer-wins mapping collision.
- Only valid accepted race evidence creates participation. DNS/retired/disqualified rows that are present remain rows. FP1, standings, inventory and expected lineups do not create spans.
- Existing provider authority, quota, request pacing, reconciliation cadence/settling, operator holds and immutable classification revisions remain unchanged.
- Whole-season assembly and guarded sequenced publication remain required. D14, D15, D16 and rollback-republication guards are not relaxed.
- Public v1 IDs, schema, snapshot readability, Flutter offline database and production Android identity `com.sejuma.gridview` remain unchanged. No release-signing or Android work is part of this design.

### 3.2 Exact proposed decision changes

Reserve the following ADR subjects; numbers 0029-0031 are available in the audited tree but must be rechecked before creating them. **Do not edit existing ADRs as part of this report.**

| Proposed ADR/amendment                                                       | Exact policy delta                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0029, `persistent-identity-discovery-and-reviewed-runtime-catalog`           | Replace ADR 0022 D6 for the migrated identity domain: immutable runtime revisions and individually authenticated review replace editable bundled runtime content. Amend D7 to require durable evidence and review lineage rather than only a Git commit. Preserve D1-D5, D8-D9 and public secrecy in D10. Explicitly permit internal sanitized evidence persistence.                                              |
| 0030, `provider-driver-inventory-and-required-identity-closure`              | Amend ADR 0022 D10 and ADR 0026 D1-D2/D11/D13 only for driver discovery inventory: each row is accounted as verified or unresolved; unresolved inventory is not normalized public data. Allow the constructor request after a structurally valid driver inventory containing unmapped drivers. Retain strict constructor inventory, all result/standings rows, D3-D10 participation rules and D12-D16 safeguards. |
| 0031, `identity-review-authority-and-catalog-cutover`                        | Supplement ADR 0009 with individual credential principals for catalog operations, immutable audit history, explicit proposal/activation and authority cutover. Establish the dataset-version allocator, batch v2 provenance, runtime failure policy and recovery limitations below.                                                                                                                               |
| ADR 0023 D11 and normalized contract ADR 0024                                | Reference new internal inventory accounting and assembly closure validation. Do not redefine “selected”, source preference or complete publication. Preserve A1 attempt accounting, A2 classification normalization and A3 standings coherence.                                                                                                                                                                   |
| ADR 0020 and ADR 0028                                                        | Add catalog provenance as internal run context, explicitly excluded from classification content revisions. Identity approval does not count as provider corroboration or reconcile a pending correction. Cadence and publication authority unchanged.                                                                                                                                                             |
| Backend Scheme §§6.5, 8.1, 9 and Implementation Plan §14/Definition of Ready | Record the transfer of identity runtime authority, narrowed inventory exception and phases/gates here. Keep attribution/media/nonidentity policy ownership separate. Update dataset-version ownership wording in the season metadata documentation.                                                                                                                                                               |
| Separate future ADR, no unit in this roadmap                                 | Resource-scoped publication via complete release reconstruction. No copying old resources into a new release is authorized here.                                                                                                                                                                                                                                                                                  |

### 3.3 Product-owner decisions required before dependent implementation

These are recommendations awaiting approval, not new “accepted” decisions.

| ID   | Proposed decision                                                                                                                                                                                                                                                                                        | Gate                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| PO-1 | Transfer runtime authority for all provider bindings and canonical driver profiles to one reviewed catalog; non-driver canonical registries initially enter as sealed imports. Git becomes seed/export provenance, not an independently editable runtime overlay.                                        | Before U3-U8             |
| PO-2 | Apply the inventory exception to **drivers only** initially. Retain complete inventory transport/decoding and strict constructor inventory. Required identities may be loaded from the pinned catalog even if absent from the driver's inventory.                                                        | Before U9-U10            |
| PO-3 | Use individual catalog credentials with reader/reviewer/activator roles. One authorized person may review then activate in two explicit operations; a second person is recommended for new identities but is not a mandatory quorum. A mandatory two-person quorum would change the activation contract. | Before U5                |
| PO-4 | Approve evidence minimization, limits and retention in §5. A diagnostic-only ID without identity evidence cannot authorize a new driver. Reviewed provenance is retained for the lifetime of affected catalog/release history.                                                                           | Before U1-U2             |
| PO-5 | Runtime catalog pin failure blocks new ingestion before provider calls; discovery persistence failure does not affect data validity and remains best effort. Existing public snapshots remain available.                                                                                                 | Before U2/U6             |
| PO-6 | Catalog activation allocates new season dataset versions as specified in §6.4; it does not publish. Adopt batch v2 and seed-only v1 admission rather than accepting unpinned runtime batches.                                                                                                            | Before U4/U7             |
| PO-7 | No retargeting/deletion of activated bindings, canonical merges or identity reassignment in phases 0-3. Record corrections and contain incidents; published identity repair needs a separately approved design.                                                                                          | Before U4-U5             |
| PO-8 | Approve baseline capacity thresholds, named reviewer provisioning and recovery/export custodian. Approve staging rollout separately; production deployment remains a separate approval after all gates.                                                                                                  | Before U2/U11 deployment |

The technical plan resolves the recommended mechanism for each choice. If the owner rejects a recommendation, revise the relevant protocol before coding; do not leave an implementer to choose a weaker invariant.

## 4. Storage choice and authority boundary

### 4.1 Decision: dedicated SQLite-backed DO

Use a new `IdentityCatalog` class and `IDENTITY_CATALOG` binding. Object name: `formula-one-identity-v1` within each environment's own namespace. The name's `v1` identifies the catalog domain, **not** its schema version: future schema migrations keep the same object identity. A stored `installationId` UUID prevents importing administrative requests from another environment accidentally.

One object is intentional: canonical uniqueness spans seasons, while approval, proposal creation and active-pointer changes must commit together. Partitioning candidates per provider or season and canonical IDs elsewhere adds distributed commits to a corpus with 33 drivers. Public requests never touch this object. Reconsider partitioning only after measured administrative/ingestion contention; do not route all Worker traffic through it.

| Option                            | Assessment                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedicated SQLite DO               | Selected. Transactional candidate upserts, constraints, immutable revisions and pointer CAS in one authority. Existing repository host/client patterns and local test strategy are reusable.                                                        |
| Existing reconciliation ledger DO | Reject for identity data. Its closed records explicitly forbid provider text/payloads, and its authority is classification acceptance. Coupling schemas, backlog capacity and identity review would weaken boundaries.                              |
| Existing publication sequencer    | Reject for catalog ownership. It arbitrates release commits, not human identity decisions; independent catalog updates must not take publication transactions.                                                                                      |
| Workers KV                        | Not the candidate/revision pointer authority: eventual consistency cannot provide the required atomic review/activation view. Optional immutable distribution copies add complexity unnecessary at this size.                                       |
| D1                                | Technically viable with transactional batches, constraints and careful read consistency; no D1 binding or integration exists here. It adds a second persistence stack without a present query/scale requirement.                                    |
| R2                                | Suitable for later encrypted/restricted exports or retained evidence objects, not the initial indexed review workflow and multi-record transaction authority. Existing media use is not permission to put private evidence in public media storage. |
| Module memory / local files       | Useful for offline tests only. Worker eviction/restart loses state. Git remains immutable seed provenance, not runtime discovery persistence.                                                                                                       |

Platform verification: Cloudflare documents [transactional SQLite DO storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [KV eventual consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [R2 strong object consistency](https://developers.cloudflare.com/r2/reference/consistency/). The choice above is a design inference from those primitives and this repository's workload, not a claim that alternatives cannot be made correct.

### 4.2 Transaction and implementation conventions

Implement a pure state/store boundary with a real SQL host and deterministic in-memory test host. Use explicit parameterized SQL, `UNIQUE` constraints and `ctx.storage.transactionSync` for related changes, with no await or external I/O inside the callback. Do not issue SQL `BEGIN`; DO storage supplies the transaction. Initialize/migrate local tables before serving requests; `blockConcurrencyWhile` is only for asynchronous initialization if needed, never provider requests.

Use a typed internal port and a bounded command/fetch transport consistent with the repository's existing DO clients, rather than requiring an unrelated RPC refactor. The class has no public route. Only the Worker constructs commands, including verified principal context. Every input, persisted row and returned snapshot is decoded; in-memory caches are keyed by revision hash and updated only after successful durable writes. A cache never substitutes for reading the authoritative pointer at run admission.

Store full immutable catalog snapshots as bounded canonical JSON plus normalized indexes and immutable review rows. The snapshot is the resolver input; indexes support validation and admin reads. They must be generated in the same transaction, never edited separately. One malformed/dangling entry refuses the complete snapshot. Use actual SQLite integration tests in addition to the in-memory host; a mock cannot establish SQL constraints or restart behavior.

## 5. Phase 1: persistent identity discovery

### 5.1 Exact capture seam and decoder safety

Add an injected run-scoped `IdentityObservationCollector` to all five existing Jolpica ports. After `getJson` succeeds, call the existing strict decoder unchanged. **Only if it succeeds**, and before invoking the normalizer, enumerate the exact keys that normalizer resolves against the same resolver. Collect keys whose result is `unmapped`. Do not turn `registry-invalid`, `invalid-key` or missing curated profile into “new person” candidates; report those as catalog/integration faults.

Attach optional identity evidence from the corresponding original parsed JSON row using a separate allowlisted extractor (`ownDataProperty`, own array elements, bounded strings). Match by the decoder-approved exact ID and expected table/row location, not by name. Names are evidence only; malformed optional names produce an omitted-field reason and do not change the decoder's success or failure. Do not extend the strict decoder's accepted output to arbitrary raw fields, and do not spread a provider object into an observation.

Paths for driver evidence are `MRData.DriverTable.Drivers[i]`, `MRData.RaceTable.Races[0].Results[i].Driver`, and `MRData.StandingsTable.StandingsLists[0].DriverStandings[i].Driver`. Reuse the exact envelope/season/round decisions of each decoder. If those decoders later support another envelope, add a specific tested extractor rather than recursive JSON scanning. The results extractor inspects every decoded driver, not just the bounded failures eventually logged by the normalizer.

Also persist key-only discovery for non-driver identities already encountered: participants' decoded constructor IDs; results' constructor IDs and event locator; both standings' constructor IDs; circuits' decoded circuit IDs; calendar's circuit IDs and `{round,raceName,circuitId}` event locators. Reuse the normalizers' exact key construction, with tested pure enumeration helpers to avoid divergent lookup scope. No additional constructor/circuit names or biographies are harvested. These candidates use the same lifecycle and read API; approving their content uses the existing curated base-import workflow, not the driver creation endpoint. This gives persistent discovery of all existing mapped entity kinds without widening participation or constructor-inventory policy.

No candidate is extracted from an invalid/truncated/duplicate-row resource in phase 1. Emit a bounded `identity.discovery.skipped` reason; raw malformed input is not evidence eligible for approval. This intentionally trades diagnostic completeness for a trustworthy extraction boundary. It does not conceal failures: the existing failed resource remains failed.

No new requests are issued. In particular, a driver mapping failure still prevents the participants constructor request in phase 1. There is no `/drivers/{id}` enrichment, OpenF1 lookup, paging or retry. OpenF1 keys can be imported from existing evidence; no OpenF1 ingestion is enabled.

### 5.2 Entity definitions

All schemas described here are **proposed internal schemas**, not changes to checked-in schema files. They are closed objects; required nullable fields are present as null. Instants are canonical UTC ISO strings. Hashes are lower-case `sha256:` plus 64 hex digits. UUIDs are lower-case v4. Exact provider-key validation/serialization is reused from `mapping-key.ts` without reimplementation.

**IdentityObservation** (immutable):

| Field                          | Type/requirement                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                | Required literal 1.                                                                                                                                                                                                                                                                    |
| `observationId`, `candidateId` | Required hashes defined below.                                                                                                                                                                                                                                                         |
| `key`                          | Required `ProviderMappingKey`; includes season, source, entity, providerField and exact typed providerValue. Online collection supports the existing Jolpica entity kinds enumerated in §5.1; migration also imports acknowledged OpenF1 keys.                                         |
| `runId`                        | UUID for online runs; null for legacy imported evidence. Never use a provider value or per-port sequence alone as a global correlation ID.                                                                                                                                             |
| `requestOrdinal`               | Positive safe integer within run; null for legacy evidence.                                                                                                                                                                                                                            |
| `resource`                     | Valid `CoordinatedResource` for online evidence; null if historical diagnostics did not identify it.                                                                                                                                                                                   |
| `endpointKind`                 | `season-drivers`, `season-constructors`, `race-results`, `driver-standings`, `constructor-standings`, `season-calendar`, `season-circuits`, `legacy-evidence`; internal enum, not arbitrary URL.                                                                                       |
| `round`, `sessionType`         | Validated round/null and existing session enum/null. Season inventory must use null/null; standings use decoded table round and null session. Results use validated round and `race`; calendar observations use their decoded round and null session. Do not infer FP1 from inventory. |
| `observedAt`, `recordedAt`     | Observation time from the run clock, nullable only for undated legacy evidence; ingestion time assigned by the DO. Preserve a legacy date-only claim separately in provenance, do not invent a precise instant.                                                                        |
| `catalogRef`                   | Bundled digest or runtime revision ID/hash used to detect the unknown key; null only where legacy resolution context is unknown.                                                                                                                                                       |
| `evidence`                     | Required object: optional `givenName`, `familyName`, `fullName`, `dateOfBirth`, `nationality`, `shortCode`, `permanentNumber`; each field is an observed claim with original type and source field. No auto-concatenated name.                                                         |
| `evidenceDigest`               | Hash of the canonical allowlisted projection, key, resource and extractor version. Not a hash of the HTTP response body.                                                                                                                                                               |
| `provenance`                   | Discriminated source record from §5.3; includes extractor version and decoder success for online evidence.                                                                                                                                                                             |
| `omittedFields`                | Bounded enum list for unsupported/invalid optional evidence; never includes raw discarded values.                                                                                                                                                                                      |

**ResolutionCandidate** (durable mutable aggregate with immutable decisions):

| Field                                                                              | Requirement                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `candidateId`, `key`                                                               | Candidate ID hash plus exact key; unique exact serialized key in the installation.                                       |
| `state`                                                                            | `unresolved`, `quarantined`, `rejected`, `approved-pending`, `resolved`, `archived`.                                     |
| `recordVersion`                                                                    | Integer CAS version for review/lifecycle/material evidence changes; repeated sightings alone do not invalidate a review. |
| `evidenceHead`                                                                     | Hash of sorted retained material evidence digests, plus overflow/conflict flags. Review binds this value.                |
| `firstSeenAt`, `lastSeenAt`, `lastRecordedAt`                                      | Nullable observation instants as above; ingestion instant nonnull.                                                       |
| `observationCount`, `distinctEvidenceCount`                                        | Saturating counters; observationCount counts admitted unique occurrences, never claimed as a complete provider census.   |
| `contexts`                                                                         | Bounded aggregate resource/round/session references; exact observations retained under the policies below.               |
| `latestDecisionId`, `proposedRevisionId`, `resolvedRevisionId`                     | Nullable references. `resolved` requires an activated binding for the exact key.                                         |
| `reviewGeneration`, `notificationGeneration`, `acknowledgedNotificationGeneration` | Monotonic integers; prevent repeated unread notifications.                                                               |
| `overflowed`, `conflict`                                                           | Required booleans. Neither permits an automatic mapping.                                                                 |

Lifecycle: first observation → unresolved; explicit review → rejected/quarantined or approved-pending; successful activation → resolved. Reject means the claimed association/evidence is unusable, **not** that the provider row can be ignored in race data. Quarantine means ambiguity/conflict. An abandoned proposal returns its candidate to unresolved with its decision retained. Archived is an inactive unresolved/rejected/quarantined record after the retention rule, never a deletion of its exact-key tombstone.

Repeated observations do not reopen rejected/quarantined/resolved candidates or re-notify. New material evidence increments `evidenceHead` and sets “new evidence awaiting review”; explicit `reopen` increments review/notification generation. If a new race/standings occurrence raises urgency, expose it in the backlog without repeated per-run notifications. Old pinned runs observing a now-bound key cannot reopen it: the DO checks its active binding before updating the aggregate. Approval is always against current evidence and current base revision.

Resolved candidates cannot be rejected/quarantined/reopened through the ordinary disposition endpoint; it returns `REVISION_ALREADY_ACTIVATED` and directs the reviewer to a correction record. This avoids showing “rejected” while the same key remains an active verified binding. Context aggregates retain at most 64 distinct resource/round/session tuples; counters saturate at `Number.MAX_SAFE_INTEGER`, never wrap or affect identity resolution.

### 5.3 Evidence, provenance and idempotency

`IdentityEvidence` is an immutable support record with `evidenceId`, `kind`, `createdAt`, `createdBy` (service or verified reviewer), `projectionDigest`, `claims`, and `sourceRef`:

- `provider-observation`: observation ID, decoder/extractor versions, provider, validated season/resource, attempt ordinal, capture time and `transportKind` (`direct`, `proxy`, `controlled`, `offline-replay`). Retain no proxy origin or credentials. Controlled/synthetic evidence is tagged `synthetic: true` and is ineligible for real environment approvals.
- `repository-import`: repository-relative document path, exact file SHA-256, optional commit if it really contains those bytes, section/record pointer, legacy acknowledgement/mapping status and original provenance text bounded to 2,000 code points. Dirty bytes carry their own hashes, never a false clean-commit claim.
- `review-dossier`: reviewer-entered claim set, cited existing observation IDs and approved evidence references, duplicate-search attestation and rationale. Optional HTTPS source URL is retained only as a credential-free citation, never fetched by the Worker; deny userinfo/fragments and remove query-bearing citations rather than silently rewriting them. Prefer document refs with hashes. Supporting captures stay in approved restricted storage, not the public repository.

Names: maximum 200 Unicode code points per field, no control characters, no Unicode normalization or trimming for storage/identity matching. Optional dates must be valid ISO dates; numbers require exact documented type, never coercion. A provider's race number is a session/season claim, not canonical permanentNumber without separate approval. Do not store HTTP bodies, authorization/cookies/headers, arbitrary URLs, HTML, biographies, images, contact details, device/user data or raw exception messages. Race positions, times, points and team association are outside this evidence projection. A constructor key may be recorded as contextual provenance only in a future specifically approved extension, never as a driver team assignment.

Keys:

- `candidateId = SHA256("gv-identity-candidate/1" + canonicalKey(key))`; store the full key and check equality on hash collision.
- `evidenceDigest = SHA256(canonicalText({extractorVersion,key,resource,round,sessionType,evidence,provenanceKind}))`. Do not include run time/counters so equivalent sightings share material evidence.
- `observationId = SHA256(canonicalText({format:"gv-identity-observation/1",candidateId,runId,requestOrdinal,evidenceDigest}))` for online occurrences. Imports use the exact file hash and record pointer instead of run/ordinal.
- `UNIQUE(observationId)` makes retry of the same batch idempotent; another run is a new occurrence, not new material evidence. `UNIQUE(candidate key)` and a single transaction prevent concurrent duplicate candidates. Existing `canonicalKey` parity tests protect type tags/Unicode framing.

No raw-body hash is claimed by an online observation: `getJson` does not expose retained raw bytes. Offline provenance may name an actually verified capture hash. A sanitized-projection hash proves what was recorded, not the provider's truth or a human identity match.

For implementation, `claims` is an array of at most 32 closed `{field, value, sourceField}` records. `field` is one of `provider-key`, `fullName`, `givenName`, `familyName`, `dateOfBirth`, `nationality`, `shortCode`, `permanentNumber`, `canonical-association`; `value` is the validated ProviderMappingKey for provider-key, a bounded exact string for text, or an exact safe integer/string numeric claim where the provider's field contract allows that wire type. `canonical-association` is a reviewer assertion `{key,targetId}` only, never emitted automatically. `sourceField` is an extractor-owned enum for online evidence or null for a dossier assertion. A provider's string number remains a string observation; only separate reviewed canonical content can supply a permanentNumber integer.

`references` is a list of 1-32 discriminated refs: `{kind:"observation",observationId}`, `{kind:"repository",path,fileSha256,recordPointer}`, or `{kind:"citation",httpsUrl,claimSummary}` under the citation restrictions above. Dossier rationale/claimSummary are bounded to 2,000 code points. Historical acknowledgements may have no name claims. `evidenceId` hashes the canonical immutable evidence content excluding its own ID; server actor/time are fixed once at first idempotent creation. The projection digest intentionally excludes actor/time, so repeated identical observed claims still deduplicate materially. Every referenced ID must exist in the transaction's evidence closure.

Disposition `reasonCode` is closed to `no-canonical-gridview-identity`, `no-approved-provider-mapping`, `insufficient-evidence`, `conflicting-evidence`, `ambiguous-person`, `invalid-association`, `invalid-provider-record`, `duplicate-candidate`, `new-evidence`, and `capacity-review-required`. Only reopen accepts `new-evidence`; a code never turns an acknowledgement into a binding. Existing legacy reasons are retained exactly.

### 5.4 Persistence, limits and failure policy

Collector operations are synchronous, bounded and exception-contained; they never await storage inside normalization. Schedule a caught persistence promise through the execution context, with no await in the provider decision path. The fetch handler currently lacks an execution-context parameter and will need an injected background-task sink; scheduled handling already uses `waitUntil`. Offline tools use an explicit collector drain and never a cloud binding. A run-final drain includes any remaining observations on cancellation/failure. Persist in batches of at most 100 observations/256 KiB, at most one in-flight batch per collector; retain at most 2,000 observations/2 MiB per run. On overflow retain existing evidence, mark/count dropped discoveries and continue normal ingestion decisions.

The DO transaction inserts the observation, upserts the candidate/material evidence, updates counts and creates a notification row together. A failed write acknowledges nothing; retry once using the same batch/observation IDs within a 2-second background-task budget. Further recovery is through a later observation or offline import. No new provider request is allowed as a persistence retry.

This is **best-effort capture with durable acknowledged state**, not an exactly-once delivery guarantee. A Worker can die before the background write commits. Shadow-mode behavior and request counts must remain unchanged, so adding a mandatory queue/outbox before normalization is rejected for phase 1. Persistence failure emits `identity.discovery.persistence_failed`, never converts a mapping failure to success, never blocks a known-data publication, and never changes classification acceptance. The rollout gate requires measuring loss/overflow; a future guarantee of lossless discovery requires a separate ingestion durability decision.

Proposed hard limits, configurable only through reviewed deployment policy, not provider input:

| Data                                    | Limit and retention                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate keys                          | 1,024 per season/source; 4,096 per installation including archived tombstones. Warn at 80%; refuse new keys at cap with a capacity event. Never evict approved/resolved/tombstoned keys to make room.                                                                                                                                                          |
| Material evidence                       | At most 32 projections per candidate, 8 KiB each; keep decision-referenced evidence permanently. At cap retain previous evidence, mark overflow and quarantine unreviewed candidates; do not claim complete evidence or permit approval until an operator reviews capacity/export.                                                                             |
| Occurrence detail                       | At most 64 recent occurrences per candidate; 90 days for unreferenced occurrence detail and run receipts. Preserve aggregate counts, first/last dates, decision-referenced occurrences and import provenance. Beyond this window dedup guarantees apply only to retained IDs; imported/decision operations have permanent IDs.                                 |
| Inactive unresolved/rejected candidates | After 365 days without a sighting, archive with exact key, state, decision refs and evidence summary retained. No automatic reopening on replay.                                                                                                                                                                                                               |
| Decisions/revisions                     | No age eviction of activated revisions, canonical IDs, bindings or decision lineage. Admission caps: 4,096 revisions and 16,384 decision/audit operations before an explicit capacity expansion/export maintenance plan. Abandoned full proposal bodies may be removed after 90 days if an export is verified; keep hash, decision, base and status tombstone. |
| Catalog snapshot                        | 2 MiB canonical JSON per revision; at most 10,000 driver identities and 100,000 bindings, subject to the tighter byte limit. Reject oversized proposals atomically.                                                                                                                                                                                            |
| Total logical data                      | 256 MiB admission budget for this initial design, measured transactionally; housekeeping/export before cap. Fail new writes safely rather than deleting history. SQLite overhead/platform limit monitoring is separate.                                                                                                                                        |

These limits make growth bounded, not infinitely available. Retention operations run in small transactions through a maintenance command/alarm with persisted progress; never delete evidence referenced by a decision or activated revision. A saturated discovery store cannot affect public snapshots. Approvals fail closed if their durable history cannot be retained.

For the first implementation, also cap a single revision's self-contained export (snapshot plus decision/evidence reference closure) at 2 MiB. Validate that bound before proposal admission, not only during later backup. Export historical revisions independently using the revision list/history pagination; no endpoint constructs the entire lifetime database in Worker memory. A future increase requires measured streaming/restore limits and an approved capacity change, not truncating evidence from an export. The 256 MiB total budget does not imply a 256 MiB request or response body.

Notifications are internal unread-backlog entries (`UNIQUE(candidateId, notificationGeneration)`), not email/Slack deliveries. `acknowledge` records the reader and generation. No automatic messaging service or UI is required. A future external notifier needs delivery idempotency and separate authorization.

### 5.5 Reads, metrics and shadow acceptance

Provide authenticated paginated candidate list, detail, evidence and health reads in §7. Aggregate metrics: observations collected/persisted/replayed/dropped, candidates created, unresolved/quarantined backlog, oldest unresolved age, persistence failures/latency, capacity ratio and notification generations. Labels: environment installation, provider, season, resource kind and bounded reason only. Do not label metrics with provider keys or names.

Structured events: `identity.discovery.{observed,duplicate,skipped,persistence_failed,capacity_exceeded}`, `identity.candidate.{created,reviewed,reopened,notification_acknowledged}`. Logs contain candidate hash/run ID and bounded reasons; exact provider keys/names are available only through authenticated evidence reads. Extend `src/logging/logger.ts`'s closed vocabulary and redaction tests; do not put arbitrary errors into its existing fields.

Shadow acceptance requires equality of provider request sequence/count, resource outcomes, normalized payloads, reconciliation mutations, generated documents and publication calls with collection off/on under the same fixtures, including persistence errors. Collecting observations is not success at resolving identities.

## 6. Phase 2: versioned runtime catalog

### 6.1 Exact logical model

Use `catalog_schema_version` for storage encoding and `revisionId` for content history; neither is a public dataset version. All entities have closed versioned decoders. Proposed table relationships below are logical SQL requirements; implement them with foreign keys/unique constraints plus transaction-level validation where SQLite cannot express the full condition. No cascading deletes of history.

**CanonicalDriver** consists of a permanent anchor and immutable profile versions:

- Anchor: `driverId` (PK, existing public slug grammar), `createdDecisionId` (FK), `createdAt` (UTC), `origin` (`repository-import` or `reviewed-new`). The anchor may be reserved by a proposed revision before activation. A reserved ID is never silently reused for another person, even if that proposal is abandoned.
- Profile: `(driverId, profileVersion)` PK, `profileHash` unique per driver/version, `decisionId`, `evidenceIds[]` (nonempty FKs), `fullName` (required nonempty), and required nullable `givenName`, `familyName`, `shortCode`, `permanentNumber`, `nationality`, `countryCode`, `dateOfBirth`, `placeOfBirth`, `biography`. These exactly cover `CuratedDriver`; media remains outside identity catalog ownership and adapters still emit null media.
- Validate using the existing driver normalized contract plus internal storage bounds: names/place/nationality 200 code points, shortCode 16, biography 8,000, valid country/date fields and safe integer permanentNumber. Validate existing data against these bounds before seeding; never truncate legacy canonical content to fit. If legacy data exceeds a bound, amend the bound deliberately before migration.
- ID immutable; profile changes create a version with explicit evidence/review, never mutate a prior version. Names are not unique. Neither name, date of birth nor race number is a reliable globally unique person key. New canonical creation requires a complete-catalog duplicate review described below.

**ProviderBinding**:

- `bindingId` hash of immutable binding content; `key` is the existing complete typed ProviderMappingKey; `targetId`, `targetEntity` must agree with its entity; `decisionId`, nonempty `evidenceIds[]`, `createdAt` required.
- In a revision, `UNIQUE(revisionId, canonicalKey(key))`; target is a member of that revision's canonical registry of the declared entity kind. A global admitted-key reservation prevents concurrent proposals for different targets of one key.
- Season scope is exact, no effective-round wildcard or automatic next-season carry-over. Reuse across seasons requires separate evidence/review/binding. Suspected reuse within one season is quarantined and unresolved because the current key cannot distinguish it; extending scope would need another ADR.
- Multiple explicit aliases can target one identity; duplicate canonical rows within a single provider collection still fail normalization. Separate provider aliases do not authorize cross-provider name matching.
- Activated binding keys and targets are append-only in phases 0-3. Never edit a target in place or silently remove a binding from a later revision. Administrative quarantine of a candidate does not disable an already active binding; that requires the incident containment procedure.

**CatalogRevision**:

- Required: `revisionId` UUID, `sequence` monotonic safe integer, `parentRevisionId` nullable only for seed, `catalogSchemaVersion: 1`, `contentHash`, `createdAt`, `createdByPrincipal`, `decisionIds[]`, `baseContentDigest`, `snapshotByteLength` and `snapshot`.
- Snapshot has `format: "gridview-identity-catalog/1"`, `drivers[]` selecting exactly one profile version per member; sealed `constructors[]`, `circuits[]`, `events[]`; all `bindings[]`; `seasonContent[]`; and evidence/decision references. Sort registries by exact ID, bindings by `canonicalKey`, season records numerically and reference sets lexicographically. Hash `canonicalText(snapshot)` with the existing canonical JSON helper; no timestamps/counters in the hash unless they are explicit content/provenance fields in the snapshot. No self-referential hash fields.
- Mutable status is held separately: `proposed`, `validated`, `activated`, `abandoned`, or `stale`. An activated revision stays historically activated after it stops being current; “current” is exclusively the singleton pointer, not a rewritten old revision state.
- Validation row: `revisionId`, `contentHash`, `validatorVersion`, `baseRevisionId`, `evidenceHeads[]`, `reportHash`, `validatedAt`, `issues[]`, `valid`. Any material change requires a new proposal, not changing a validated snapshot.
- Singleton `CatalogHead`: `installationId`, `activeRevisionId`, `activationSequence`, `schemaVersion`, `admissionState` (`open`/`paused`), `seedDigest`, `minimumReaderVersion`, `legacyV1AdmissionEnabled` and `hasRuntimeOnlyActivation`. The latter is a one-way false-to-true bit; activation sets it when effective catalog data first differs from seed, and new v1 batch admission then stays closed. Head and activation event commit atomically. First seed activation requires expected head null. Later activation requires exact active ID and sequence.

**ReviewDecision**:

- Immutable `decisionId` UUID, `operationId` UUID (unique per installation/principal/operation family), `candidateId` nullable for seed/profile-only change, `expectedCandidateVersion` nullable correspondingly, `evidenceHead`, `baseRevisionId`, `principalId`, `credentialId`, `authMethod: "individual-catalog-token"` (seed import also records the importing reviewer), `decidedAt` assigned by DO.
- `action`: `bind-existing`, `create-driver`, `reject`, `quarantine`, `reopen`, `approve-profile`, `import-seed`, `import-base` or `request-correction`; `targetId` nullable; `proposedBindingKey` nullable; `profileHash` nullable; nonempty `evidenceIds[]` for any approval; bounded `reasonCode`, `rationale` (1-2,000 code points); `duplicateReview` required for create-driver.
- `duplicateReview` records `catalogHashReviewed`, inspected canonical IDs, evidence refs, a reviewer attestation that the full canonical list was checked, and an explicit same-name distinction if relevant. Store historical actor metadata; never overwrite it on credential rotation. Client-supplied actor names are ignored/rejected.
- Exact key conflict/ID duplicate checks are machine-enforced. Real-world same-person detection cannot be proven from names alone: serialized full-catalog human review is the required control. A second proposal based on a stale head must be re-reviewed against the new catalog, preventing simultaneous unseen creation from separate candidates. Deliberate or mistaken human misidentification remains a residual risk, not a solvable uniqueness constraint.

**IdentityCorrection** is necessary as a record, not a bypass:

- `correctionId`, `operationId`, `principalId`, `createdAt`, `affectedDriverIds[]`, `affectedBindingIds[]`, `affectedRevisionIds[]`, `affectedSeasons[]`, optional known `publishedVersions[]`, `reasonCode`, `rationale`, nonempty `evidenceIds[]`, `status` (`reported`, `contained`, `requires-separate-plan`, `closed-no-change`), append-only status events.
- FKs to existing identities/bindings/revisions; referenced published versions are assertions checked against publication authority during incident review, not identity-store authority over releases.
- No `merge`, `retarget`, `delete-public-history` or `force-publish` operation. A spelling/profile correction can create a reviewed profile version retaining the same ID. A wrong-person association requires containment and a separate approved historical correction design; D15 must continue to reject a result-row identity replacement.

**Supporting tables**:

| Table                                                        | Key/integrity rule                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_evidence`, `observations`, `candidates`            | Definitions in §5; FK evidence/observation membership; immutable evidence referenced by decisions retained.                                                                                                                                                                                  |
| `revision_drivers`, `revision_bindings`, `revision_evidence` | Composite revision/member uniqueness, target/profile FKs; complete snapshot/index parity checked on write/read.                                                                                                                                                                              |
| `season_content`                                             | Immutable `(season, datasetVersion)` → `seasonProjectionHash`, `baseContentDigest`, `catalogRevisionId`; one label never names two different projections. Identical projection may appear in later revisions retaining its label.                                                            |
| `operations`                                                 | `(principalId, operationFamily, operationId)` unique; canonical request hash, response hash/body and terminal outcome. Same ID/different body → conflict. Immutable mutation receipts retained with audit history.                                                                           |
| `audit_events`                                               | Monotonic `eventSequence`, event ID, server time, actor, operation, before/after references and bounded outcome. Written in the same transaction as mutations; no dependence on best-effort log delivery.                                                                                    |
| `run_pins`                                                   | `runId` PK, installation, season, optional ledger fence, purpose, revision ID/hash, datasetVersion, pinnedAt, state (`started`, `completed`, `uncertain`), optional publication result/version. Pin identity fields immutable. This is provenance, not a second lease/publication authority. |
| `notifications`                                              | Candidate/generation unique; createdAt, acknowledgedAt/principal nullable.                                                                                                                                                                                                                   |
| `schema_migrations`                                          | Integer version PK and migration hash; ordered, transactional, additive upgrade steps. Unknown newer schema refuses service.                                                                                                                                                                 |

### 6.2 Proposal, validation and atomic activation

1. Reviewer reads candidate detail, exact key, evidence head/version and current catalog revision. Reads may suggest existing IDs as navigation aids, but no suggestion resolves anything automatically.
2. Reviewer supplies an existing target or an explicitly chosen new canonical ID/profile, supporting dossier and duplicate review. The four November keys currently lack sufficient new-identity evidence.
3. Approval transaction checks principal role, operation idempotency, installation, candidate version/evidence head and base active revision. It verifies target existence or reserves a genuinely new ID, writes the immutable decision and **complete proposed revision**, and marks the candidate approved-pending. It makes no lookup active.
4. `validate` runs complete closed-shape, reference, uniqueness, evidence coverage, profile, non-driver base, append-only binding, scope, version and capacity validation. Build the complete `ProviderMappingRegistry`; any invalid state refuses the whole revision. Compare seed parity or parent delta as appropriate. Synthetic evidence cannot validate real-environment approvals.
5. Store the validation certificate against the exact immutable proposal hash, validator version, parent and evidence heads. Existing valid seed content is grandfathered through documented repository provenance, not falsely labeled as newly observed online evidence.
6. `activate` rechecks certificate freshness, current implementation validator version, candidate/evidence versions and exact expected active pointer/sequence. Inside **one synchronous transaction**, update head, append activation event, register season labels, mark associated candidates resolved and store the idempotent response. No KV writes, provider calls, publication or reconciliation mutation occurs in this transaction.
7. A subsequent `pin` reads the new head/snapshot together. A run already pinned continues using its previous immutable revision.

Two proposals may coexist; the first valid activation against a head wins. The other returns `CATALOG_HEAD_CONFLICT` and becomes stale only through a durable status update. It must be regenerated/re-reviewed on the new head; do not automatically merge reviewer intent. A retry after a lost activation response returns the committed operation result. A write exception rolls back the whole activation. A timeout with unknown result is reported as uncertain and resolved by operation ID/head/history, never by a second fresh activation ID.

Approval stores the candidate's post-approval recordVersion as the proposal's expected version; validation/activation compare against that version and the approved evidence head. Hashing and expensive pure validation may occur outside a transaction over immutable bytes; the final synchronous transaction rechecks head, immutable content hash, certificate and evidence versions before writing. An await for hashing is never placed between related SQL writes. Key reservations for **unactivated** bindings may be released on explicit abandonment while preserving their decision history; activated keys and canonical-ID reservation tombstones are never released by this API.

Unactivated proposals can be abandoned by explicit command. Keep their audit/reserved-ID tombstones. Abandoning an already activated revision returns conflict. There is no mutation of old snapshot contents and no “rollback pointer” endpoint in this phase.

### 6.3 Pinning the entire run and every entry point

Introduce an immutable `IdentityRunContext`:

```text
{ runId, installationId, mode: bundled|runtime, revisionId|null,
  catalogHash, datasetVersion, season, registry, participants,
  circuits, events, seasonMetadata, inventoryPolicyVersion }
```

`registry` is constructed once from the entire verified snapshot; profile/event/circuit lookups come from the same snapshot/base digest. No field is read later from the current active catalog. Runtime composition must explicitly supply every port's registry and curated lookup; do not leave optional defaults in the runtime branch. Bundled tests/mocks keep an explicit bundled context.

Refactor composition into dependency admission and context-dependent construction. Preserve the existing fail-closed dependency checks. In `observation/observe.ts`, acquire the existing ledger lease, read/recover authoritative publication state, plan work, then pin before constructing ports and before the first provider request. Nothing-due runs need not pin. The catalog pin transaction records `runId` and returns the snapshot for one active head. Subsequent reads by runId return that same revision, even after activation. Recheck lease time/budget before transport; release the lease on pin/load/validation failure. Do not await catalog storage inside sequencer/ledger transactions.

Pin RPC timeout is 2 seconds with at most one retry using the identical runId/season/purpose. A committed first pin whose response was lost must be returned on retry, never repinned to a newer head. Reject a reused runId with different context. Both attempts count against the existing 240-second coordination/300-second publication-intent budgets; do not extend those budgets. Bound snapshot decoding/hash validation by the admitted snapshot size and measure it in staging. A timeout outcome that cannot establish a context sends no provider requests.

The same helper must be used by scheduled/manual sync, `operator/verification.ts`, offline batch generation and batch admission. Calendar diagnostic entry points that consume mappings must either pin explicitly or use an explicitly declared bundled diagnostic mode; they may not silently use bundled defaults while runtime mode is selected. Egress identity diagnostics that do not resolve provider entities need no catalog. Mock fixture generation remains a separate explicit bundled test mode.

Runtime failure to read/validate the head/snapshot produces bounded `catalog-unavailable`/`catalog-invalid` with zero provider requests and zero publication attempts; no fallback to the bundle or an arbitrary isolate cache. Once the complete context has been obtained, catalog availability is not required to finish that run. Best-effort completion receipts may become uncertain; the durable pin and immutable `(season,datasetVersion)` mapping still establish provenance. Existing sequencer/ledger recovery handles publication outcome; never duplicate that state machine in the catalog.

Approval during a run is allowed: run A pinned R10 completes under R10; run B pins R11 later. Ordinary activation does not invalidate accepted classification hashes, and does not need publication lease acquisition. Because later revisions cannot reassign old keys, this permits safe additive updates. Cutover between bundled/runtime modes is different: drain active runs under an operator hold, as §11 describes.

Do not add catalog revision IDs to `classificationRevision`: its equality is public normalized race content. A new profile or unrelated alias must not reset settling confirmations. Preserve schema-v1 ledger records unchanged by keeping pin provenance in the catalog; if future implementation needs ledger fields, that becomes an explicit versioned migration, never an in-place v1 extension.

### 6.4 Dataset versions and one source of truth

For seed R0, preserve `2026.10.07.1` exactly and bind it to the seed's effective 2026 projection. The seed must contain all current approved data; importing acknowledgements alone does not change public content versions.

For later revisions, compute `seasonProjectionHash` over the exact canonical profiles/registries, bindings and immutable base-content inputs relevant to that season. Include a driver profile if it is season-bound or explicitly season-referenced; every changed global driver profile affects all such seasons. A change to this projection requires a new `YYYY.MM.DD.N` label, even if the mapping is not used in that day's classification. Evidence/candidate/audit-only changes do not create a catalog revision or bump datasetVersion.

The DO allocates and reserves labels in proposal creation from the server's UTC date and a monotonically incremented per-date suffix, with a uniqueness constraint and no reuse after abandonment. The date may not precede the last allocated date for a season; clock regression refuses allocation. Seed labels are reserved first. Reviewer sees the exact reserved label before activation. This is a proposed replacement for manually editing season metadata for identity changes, and requires PO-6. Other metadata formats (`mediaVersion`, attribution version) retain their owners.

`seasonContent` also stores seasonLabel, mediaVersion and attributionVersion from an immutable reviewed base bundle. Changes outside identity still require their existing review workflow and an explicit `import-base` proposal keyed to expected active revision, hashes and approval evidence. Import may update non-driver canonical content and bindings only under those existing curation decisions; it cannot replace runtime drivers with old Git copies or discard runtime additions. Publishable content is always a **complete activated catalog plus its bound base**, not a live merge with current Git files. All 94 current mappings therefore migrate together; only driver curation has new convenience endpoints in this scope.

Git files remain the archived seed, mock fixtures and input to reviewed base imports. After runtime cutover, edits to migrated fields are rejected as direct runtime updates by CI/operator tooling; an export may be checked in for review/recovery but is marked generated/non-authoritative. A deploy never reseeds a nonempty catalog. Roll forward code and state independently; no dual-write synchronization from Git.

Keep legal attribution/media activation policy under its existing reviewed code/content workflow. A catalog base import must name attribution/media hashes supported by the deployed Worker; it cannot turn a bundled dormant source into an active one by changing a catalog label. `ingest/service.ts`'s attribution admission remains in force. A Worker/base hash mismatch fails admission rather than combining a new attribution label with old attribution content. Thus driver approvals need no deployment, while a separate change to legal/media policy can still require its existing deployment process. This boundary is not a second editor for driver identities or provider bindings.

`contentVersion` continues carrying the dataset label in public metadata. `catalogRevisionId/hash` stays internal. Many sync runs/releases can use one catalog; one global catalog can carry unchanged labels for unaffected seasons. A label identifies one effective season projection, not necessarily one global revision. Catalog-only changes affecting a season bump home/bootstrap/manifest content revisions through existing canonical specs; the existing candidate no-change digest must be tested, not replaced. Release versions and snapshot revisions remain sequencer-owned, distinct from catalog versions.

## 7. Administrative API and CLI contracts

### 7.1 Authentication and accountability

`ADMIN_TOKEN` is sufficient for current shared operational authorization and shadow read access, but **insufficient to attribute irreversible identity decisions to an individual**. Do not accept a client-provided `reviewer` header alongside it as proof.

Proposed minimal mechanism: a separate ignored/secret `IDENTITY_REVIEWER_CREDENTIALS` configuration containing `{credentialId, tokenSha256, principalId, roles, disabled, expiresAt}` entries. Tokens are cryptographically random at least 256 bits, individually issued, submitted only as Bearer credentials over HTTPS, never in URLs/CLI arguments/logs. Compare token digests safely; principal/roles derive only from server configuration. Rotation may overlap credential IDs for one principal; audit preserves which credential authenticated the action. Expired/disabled credentials fail immediately on the receiving Worker. An IdP/Cloudflare Access JWT mechanism may replace this in a later security decision but is not a prerequisite for a CLI-sized initial workflow.

Roles: `reader` (inspect/export), `reviewer` (evidence/approval/reject/quarantine/profile/correction), `activator` (validate/activate/seed/base-import/admission control). A principal may have multiple roles. Every mutation requires an individual credential; shared ADMIN_TOKEN is read-only for catalog routes during shadow rollout and may be removed from catalog reads at cutover. Legacy admin routes keep their existing auth and behavior. Route dispatch must recognize catalog routes **before** enforcing only the shared-token gate; all other `/internal/admin/*` routes retain that gate. Never let an identity-only token authorize synchronization, rollback or cache purge.

No UI is justified: the corpus and infrequent decisions fit inspectable JSON files plus a small CLI. The CLI must display candidate/evidence/base hash/delta/version, then submit the exact reviewed file. It must not fetch evidence URLs, resolve identities by fuzzy matching or automatically activate after approval.

### 7.2 Common wire rules

Base path: `/internal/admin/identity`. JSON only, `Cache-Control: no-store`, no wildcard CORS. All requests/responses are closed versioned shapes; reject unknown fields. Dates/hashes/UUIDs follow §5.2. Body cap 256 KiB for ordinary operations; seed/export import cap 2 MiB with bounded streaming read; never parse an unbounded body.

All mutations are POST and require:

```json
{
  "schemaVersion": 1,
  "installationId": "<uuid>",
  "operationId": "<uuid>",
  "expectedActiveRevisionId": "<uuid-or-null-for-seed>",
  "expectedActivationSequence": 0,
  "reason": "<review rationale>",
  "payload": {}
}
```

Use an `Idempotency-Key` header equal to operationId; differing/missing values are a 400. Idempotency is per principal/operation family/ID, not request ID. Same body replay returns original status/body plus `replayed: true`; differing body returns 409. Body hashes exclude network request ID. Server times/actor are never accepted from client fields. Candidate mutations additionally carry `candidateId`, `expectedCandidateVersion`, `expectedEvidenceHead`; revision mutations carry exact revision ID/hash. Read-only validation has durable audit/certificate effects, so it too is a POST with an operation ID.

Success envelope: `{data: T, requestId: string, replayed: boolean}`. Error: `{error:{code,message,requestId,details?}}`; details include only bounded internal issue codes, stale version pointers and retryability, never tokens or raw provider payloads. HTTP errors are authoritative only if their operation status is known; network loss requires receipt lookup.

Lists: `limit` 1-100 (default 50), opaque cursor over an immutable `eventSequence`/creation-ID upper bound; stable ID tie-breaker. Responses `{items: T[], nextCursor: string|null, asOfSequence: integer}`. Candidate state filters reflect current aggregate state at read time; a cursor is a bounded navigation view, not a transaction across multiple HTTP calls. Review CAS handles changes after inspection. Unknown filters/cursors are 400, not silently ignored.

### 7.3 Concrete operations

Payload types below are the exact operation-specific contents inside the common mutation envelope. `CandidateRef = {candidateId,expectedCandidateVersion,expectedEvidenceHead}`. `ReviewSupport = {evidenceIds: nonempty hash[], dossierId: hash, rationale: string}`. `DriverProfile` is the closed profile field set in §6.1, without ID/version/hash/decision; the server derives those fields. A mutation response always includes its `operationId` and durable `auditEventSequence` in addition to the listed data.

| Method/path or CLI subcommand                                                | Request/filter                                                                                  | Response and authorization                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`; `identity status`                                             | No query                                                                                        | `{installationId,mode,admissionState,activeRevisionId,activationSequence,catalogHash,capacity,storageSchemaVersion}`; reader. No provider calls.                                                                                                      |
| GET `/candidates`; `identity candidates list`                                | Optional season, source, state, entity, cursor, limit                                           | Page of candidate summaries `{candidateId,key,state,recordVersion,evidenceHead,firstSeenAt,lastSeenAt,latestDecisionId,notificationGeneration}`; reader.                                                                                              |
| GET `/candidates/{id}`; `identity candidate inspect`                         | Hash ID                                                                                         | `{candidate: ResolutionCandidate, evidenceIds, decisions: decision summaries, activeBinding: ProviderBinding                                                                                                                                          | null}`; reader.                                                                                                                                                               |
| GET `/candidates/{id}/evidence`; `identity evidence list`                    | cursor, limit                                                                                   | Page of sanitized IdentityEvidence/observation records; reader. Detail by GET `/evidence/{id}`.                                                                                                                                                       |
| POST `/evidence`; `identity evidence add --file`                             | `{candidate: CandidateRef, kind:"review-dossier", claims, references, duplicateReview           | null}`                                                                                                                                                                                                                                                | `{evidenceId,candidateVersion,evidenceHead}`; reviewer. Server derives author/hash. Claims can assert exact-key-to-person evidence but cannot make it verified by themselves. |
| POST `/bindings/approve`; `identity approve-existing --file`                 | `{candidate:CandidateRef,targetDriverId, support:ReviewSupport}`                                | `{decisionId,proposedRevisionId,catalogHash,datasetVersions,candidateVersion,status:"proposed"}`; reviewer. Reject non-driver keys here.                                                                                                              |
| POST `/drivers/approve`; `identity approve-new --file`                       | `{candidate:CandidateRef,driverId,profile:DriverProfile,support:ReviewSupport,duplicateReview}` | Same proposal response, plus reserved driverId; reviewer. No slug/name generation on server.                                                                                                                                                          |
| POST `/drivers/{id}/profiles`; `identity approve-profile --file`             | `{expectedProfileHash,profile:DriverProfile,support:ReviewSupport}`                             | Proposal response; reviewer. ID remains identical; no binding target change.                                                                                                                                                                          |
| POST `/candidates/{id}/disposition`; `identity candidate disposition --file` | `{expectedCandidateVersion,expectedEvidenceHead,action:"reject"                                 | "quarantine"                                                                                                                                                                                                                                          | "reopen",reasonCode,evidenceIds}`                                                                                                                                             | `{candidateVersion,state,decisionId}`; reviewer. Does not suppress strict required-row failure.                                                         |
| POST `/candidates/{id}/acknowledge`; `identity candidate acknowledge`        | `{notificationGeneration}`                                                                      | `{acknowledgedGeneration}`; individual reader. Replay safe; stale generation conflicts. Common head fields are checked but do not change catalog content.                                                                                             |
| GET `/revisions`; `identity revisions list`                                  | cursor, limit, optional status                                                                  | Revision summaries with parent/hash/status/datasetVersions/validation result; reader.                                                                                                                                                                 |
| GET `/revisions/{id}`; `identity revision inspect`                           | UUID                                                                                            | `{revision: CatalogRevision,validation,activationEvents,deltaFromParent}`; reader.                                                                                                                                                                    |
| GET `/revisions/{id}/export`; `identity export --revision`                   | UUID                                                                                            | Canonical export `{format,installationId,revision,decisions,evidence,exportHash}` with closure of references; reader. Export wrapper hash excludes itself. Retained occurrence details not needed for referenced decisions may be omitted explicitly. |
| POST `/revisions/{id}/validate`; `identity validate --file`                  | `{catalogHash,expectedValidatorVersion}`                                                        | `{valid,reportHash,validatorVersion,issues: {code,path}[],baseRevisionId}`; activator. Invalid contents return 422, persist failure report and never activate.                                                                                        |
| POST `/revisions/{id}/activate`; `identity activate --file`                  | `{catalogHash,validationReportHash}`                                                            | `{activeRevisionId,activationSequence,catalogHash,activatedAt,datasetVersions}`; activator. Requires exact current parent and certificate; explicit separate call.                                                                                    |
| POST `/revisions/{id}/abandon`; `identity abandon --file`                    | `{catalogHash}`                                                                                 | `{status:"abandoned"}`; original reviewer or activator. Activated revisions refused.                                                                                                                                                                  |
| GET `/history`; `identity history`                                           | optional candidateId, revisionId, principalId, afterSequence; limit                             | Page of immutable review/activation/audit records; reader.                                                                                                                                                                                            |
| GET `/operations/{id}?family=...`; `identity operation inspect`              | Operation UUID and family                                                                       | `{state:"committed"                                                                                                                                                                                                                                   | "rejected"                                                                                                                                                                    | "unknown",requestHash,result}`; actor or activator. Unknown is not evidence that a timed-out call cannot still complete; reuse same idempotent request. |
| POST `/seed`; `identity seed --file`                                         | `{seedArtifact,seedArtifactHash,approvedImportDossierId}`                                       | Proposed R0 and parity report; activator, empty catalog only. Replaying same seed is idempotent; different nonempty seed is 409. Separate validate/activate required.                                                                                 |
| POST `/base-imports`; `identity import-base --file`                          | `{baseArtifact,baseArtifactHash,support:ReviewSupport}`                                         | Complete proposed revision/delta; activator. Preserve runtime identities and bindings; no blind full replacement.                                                                                                                                     |
| POST `/corrections`; `identity correction report --file`                     | IdentityCorrection claim fields excluding server IDs/actor/state, plus evidence refs            | `{correctionId,status:"reported"}`; reviewer. No active identity change.                                                                                                                                                                              |
| POST `/admission`; `identity admission --file`                               | `{expectedAdmissionState,state:"open"                                                           | "paused"}`                                                                                                                                                                                                                                            | `{admissionState}`; activator. Closes only new pins; does not cancel already pinned runs or alter public reads. Emergency containment must drain them.                        |

Evidence create/seed bootstrap: seedArtifact embeds legacy evidence and a reviewer dossier; their IDs are derived and inserted in the same proposal transaction so empty-store FK creation is possible. `approvedImportDossierId` must name that embedded dossier. Online dossier submission references an existing candidate, records its pre-write evidence head and returns the new one; approval must use the returned head/version.

Error codes: 400 `INVALID_REQUEST`/`INVALID_CURSOR`; 401 `UNAUTHORIZED`; 403 `ROLE_REQUIRED`/`IDENTITY_WRITES_DISABLED`; 404 `CANDIDATE_NOT_FOUND`/`REVISION_NOT_FOUND`; 409 `INSTALLATION_MISMATCH`, `CANDIDATE_STALE`, `EVIDENCE_CHANGED`, `CATALOG_HEAD_CONFLICT`, `BINDING_CONFLICT`, `CANONICAL_ID_RESERVED`, `IDEMPOTENCY_CONFLICT`, `REVISION_ALREADY_ACTIVATED`, `CATALOG_PAUSED`; 413 `BODY_TOO_LARGE`; 422 `EVIDENCE_INSUFFICIENT`, `CATALOG_INVALID`, `PROFILE_INVALID`, `VALIDATION_STALE`, `PUBLISHED_IDENTITY_CORRECTION_UNSUPPORTED`; 429 `ADMIN_RATE_LIMITED`; 503 `CATALOG_UNAVAILABLE`, `CATALOG_CAPACITY`, `CATALOG_SCHEMA_UNSUPPORTED`. Capacity is not a validation success and never partially applies. Bound rejected-request audit volume separately; raw authentication attempts never carry credentials into durable audit.

Admin rate policy: 60 reads/minute and 10 writes/minute per credential, with idempotent replay counting as a read; return Retry-After. Enforce a bounded installation aggregate limit too (300 reads/60 writes per minute). Counters live in the DO and expire after two windows; reject unauthenticated requests before the DO. This is separate from provider quota accounting.

Audit events: `identity.review.{approved,rejected,quarantined,reopened}`, `identity.catalog.{seeded,proposed,validated,validation_failed,activated,abandoned,activation_conflict,admission_changed}`, `identity.correction.reported`. Mutation and event are atomic. Authorization failures generate bounded security logs; no individual token material or full evidence is logged. Reader exports are audited by principal/hash, not by logging their contents.

## 8. Phase 3: inventory versus publishable identity requirements

### 8.1 Chosen semantics

Do not add a new independent scheduled resource or another provider endpoint. Preserve the existing `season-participants` request identity and two-request resource, but split its **internal driver inventory accounting** from its normalized public profile projection. This avoids changing the planner, cadence or classification acceptance vocabulary merely to remove one mapping dependency.

Six separate concepts must remain explicit:

| Concept                                    | Owner/meaning                                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-observed inventory                | Every driver row in a successfully decoded complete season inventory, exact key accounted; a private observation, not an entrant claim.                                                         |
| Verified canonical profile                 | A profile and exact binding present in the pinned catalog. May exist without any race entry.                                                                                                    |
| Season identity reference                  | Canonical identity required by a selected season resource, or verified inventory identity. This set does not assign teams or create participation.                                              |
| Accepted race participation                | Existing assembly-derived spans from selected classified Jolpica rows after reconciliation eligibility; unchanged.                                                                              |
| Required classification/standings identity | Every row and fastest-lap reference must resolve, have a profile and satisfy final reference checks. A missing mapping fails the complete resource, even if discovered through inventory first. |
| Unresolved inventory-only observation      | A private candidate, explicitly counted and omitted from the public profile projection because it has no canonical identity. It cannot create a public route, span or team assignment.          |

### 8.2 Internal contract and exact algorithm

Extend the internal participants payload with a required field in the new inventory mode:

```text
driverInventory: {
  policyVersion: 1,
  catalogHash: Hash,
  providerRowCount: integer,
  resolved: [{driverId: CanonicalId, observationKeyHash: Hash}],
  unresolved: [{candidateId: Hash, reason: "unmapped"}],
  projectionDigest: Hash
}
```

`drivers` continues containing complete normalized Driver objects for every verified inventory member in provider order. `driverEntries` remains empty. `constructors` and `constructorEntries` keep their current strict derivation and complete membership. Canonical-ID aliases that cause duplicate inventory profiles remain contradictions, not silently merged duplicates. All inventory accounting hashes are internal and **must not enter any public schema, generated snapshot or snapshot revision**.

Validate `providerRowCount = resolved.length + unresolved.length`, unique observation/candidate hashes, unique canonical drivers, exact `resolved` ↔ `drivers` ID equality, and catalogHash matching the run context. A failing resolver, invalid provider key, dangling mapped target, malformed optional accounting or inconsistent projection fails the whole resource. Only the exact `unmapped` driver case is optional. Candidate ID calculation does not require storage success: unknown status remains explicit if the background store is unavailable.

Implementation sequence within participants:

1. Fetch and strictly decode the complete driver page as today.
2. Resolve all IDs against the pinned catalog. Partition only valid unmapped driver keys into inventory accounting, emit discovery observations, and load all resolved canonical profiles.
3. Fail for any invalid key/registry/profile/duplicate. If only unmapped drivers remain, continue to the constructor request. Strictly decode/resolve every constructor as today; return no partial resource on constructor failure.
4. Return the complete verified projection plus explicit inventory accounting. Unknown optional names never become profiles. The existing provider attempt accounting reports the actual two requests.

Assembly computes a driver-reference closure after it has the selected classifications and both standings:

```text
required = IDs from every selected result entry
         union every nonnull selected fastestLap.driverId
         union every selected driver standing
         union every derived participation span driver
         union every nonnull constructor-lineup driver reference
outputDriverIds = verifiedInventoryIds union required
```

For each required ID missing from inventory projection, load its **already verified** profile from the same pinned context. This closes the legitimate “race debutant already curated, absent from inventory” case. Missing profile is an `inconsistent-references` refusal; do not create a new identity. Keep verified inventory order, then append additional required IDs in deterministic exact-ID order. Do not add every global driver to every season. Constructor references must still be covered by the strict constructor inventory/entries; no inferred constructor team data is added in this driver-focused phase.

Use this source to run unchanged `deriveDriverSeasonEntries` and `validateSeasonReferences`, including result-entry-span, driver-entry-support, duplicate identity and `hasResults` rules. Deep validate profiles loaded from the context too, not only profiles that passed through a provider port. Classifications/standings normalizers remain all-or-nothing and **never filter unresolved rows**. The `driverInventory` field is consumed and removed before constructing `ProviderSeasonSource`; the public source schema/generator stays unchanged.

### 8.3 Exact modules and compatibility requirements

Change `participants-normalizer.ts` to introduce a separate `normalizeDriverInventory` function; retain strict normalization for mode-off regression and for required row paths. Update `participants-port.ts` to select the policy explicitly. `participants-payload.ts` retains strict envelope/pagination/duplicate decoding; evidence extraction remains separate. Add inventory types/checks to `coordination/resource.ts` and `payload-contract.ts`; pass expected inventory policy/catalog hash into coordinator validation from the run context, rather than trusting the payload's own policy claim. `coordination/port.ts` owns `detachPayload` and must preserve complete deep detachment; `coordinator.ts` validates that detached copy. Extend the existing candidate-payload snapshot tests and only change `outcome.ts` if its closed types require it.

Change `season-assembly.ts` to take an explicit identity context and build the closure; add a pure `season-identity-closure.ts`. Adapt `coordinated-publication.ts` and offline generation callers to supply it. `season-integrity.ts` should preserve existing relations and add narrowly named inventory/context-integrity checks at the internal boundary, rather than weakening missing-driver checks. Do not change public `Driver`, `DriverSeasonEntry`, `RaceResult`, standings, API v1 schemas or Flutter DTOs.

`src/ingest/source-validation.ts` already validates source collections directly with normalized entity validators and `validateSeasonReferences`; preserve that public-source shape and validation. Never fabricate a provider inventory census from an imported public document. New batch manifests carry inventory-policy provenance; public source objects do not carry it.

`policy/publishability.ts`, `policy/refresh.ts`, `policy/planner.ts`, classification state transitions, sequencer and D14-D16 algorithms need **no semantic change**. Participants is still a required observed resource; it can now be valid with explicit unresolved inventory observations. Tests must prove it, not delete the prerequisite. Keep strict mode payload validation for legacy fixtures and use a discriminated explicit internal policy version; no broad “extra keys allowed” switch.

### 8.4 Benefit and limits

- Inventory-only new driver, otherwise complete valid season: publication may proceed with verified profiles and existing race facts; no public profile is invented for the unknown row.
- New race debutant unknown to catalog: full classification fails; discovery records a candidate; no publication until reviewed mapping/profile and normal reconciliation acceptance.
- Known returning driver missing from inventory: required reference closure loads its verified profile; participation comes from results. A future round's absence never closes a span.
- FP1-only identity: inventory may discover it, and a verified profile may have a detail; no DriverSeasonEntry. No FP1 requests/adapter/participation feature is introduced.
- Transfers/multiple constructors: retain existing split spans and multi-constructor standings semantics; inventory supplies no team associations.
- Inventory HTTP/pagination/schema failure, unknown constructor, any missing/inconsistent race/standings resource, accepted-history conflict or D14-D16 rejection: still withhold the whole candidate.

The exceptional path will make **one additional constructor request** in the old driver-unmapped early-exit case; total requested endpoint set remains unchanged. Phase 1's request-count equality does not apply to this phase-3 behavior change. Its revised accounting and capture requirements must be approved/tested; the synthetic November count fixture must remain a strict-mode incident regression, with a separate phase-3 expectation. Do not rewrite it to claim the real incident is fixed.

This is safe without resource-scoped publication because all required current data is still freshly selected and complete. No old row/resource is copied into the new candidate. Existing published historical classifications remain protected; optional inventory-only detail disappearance is not covered by D14/D15, so this phase must not introduce a broad profile-deletion policy. Retaining all selected historical race references closes the important driver-history case; any broader guarantee for nonparticipating profile availability would require a separate season-reference retention decision.

## 9. Migration and backward compatibility

### 9.1 Seed preparation and parity

1. Establish a reviewed source bundle from the exact registries, mapping/evidence files, season metadata and referenced historical decision documents. Include per-file byte hashes, parsed semantic hashes, origin paths and commit provenance where applicable. A future import must acknowledge the current investigation changes through review; a HEAD identifier alone does not include those uncommitted bytes.
2. Run the existing content/schema/semantic validators offline. Export all 33 driver IDs exactly, all other canonical registries and **all 94 bindings**, including typed integer/locator values. Preserve original provenance references; imported reviewer records mean “migration of an existing decision”, not fabricated knowledge of the historical individual approver.
3. Import all 101 evidence identities. For mapped identities, link evidence and imported binding decision. For seven acknowledged keys, create unresolved candidates with original reason/detail, never bindings. Four November observations use `repository-import`/operator-report quality, null unknown resource/round/session/full-name/body-hash and the report reference. Do not label them verified provider-body observations.
4. Produce a parity report: sorted canonical IDs/profile fields, exact key → target relation including types/seasons, evidence coverage and acknowledgement set, base-content hashes, current datasetVersion. Compare every existing known-key lookup and all seven unresolved results under bundled and seeded resolvers. Compare strict-mode normalized outputs and generated documents byte for byte for representative complete offline runs.
5. Seed an empty environment catalog by explicit operation. Import transaction stores evidence/decision/anchor/revision graph with deferred FK checks or insertion ordering and commits only after full graph integrity. R0 is proposed, validated and activated separately. Interrupted seeding is either absent or complete; never partially usable.
6. Keep bundled resolution authoritative while shadow comparison runs. No reviewed additions may become active in the runtime authority until the selected environment cutover gate is approved; proposals may be exercised in a separate controlled test installation.

No published snapshot is rewritten or given retroactive invented catalog metadata. Existing snapshots remain readable through the existing snapshot authority. Historical provenance may say `legacy-bundled/unknown-catalog`; do not pretend a post hoc seed was the actual runtime input to an old release without independent evidence.

### 9.2 Batch ingestion protocol

Add **batch schema v2** for catalog-aware artifacts/manifests/submissions, keeping public snapshot schema v1 unchanged. V2 adds a closed `identityCatalog` block to artifact and manifest:

```text
{ format: "gridview-identity-catalog-ref/1",
  installationId, revisionId, catalogHash, seasonProjectionHash,
  datasetVersion, baseContentDigest, exportSha256,
  inventoryPolicy: "strict-v1" | "optional-driver-inventory-v1" }
```

The offline generator requires `--catalog-export <local-file>` and verifies the export digest and complete catalog before constructing ports. A read-only authenticated export is a separate explicit operator action, never hidden network access during generation. Keep replay-only transport and throw on any unrecorded URL. Emit the catalog reference in both reviewed files and bind it through their existing digests. Runtime-backed generation may not silently default to bundled content.

Batch admission pins the active catalog once and requires installation, revision/hash, season projection, metadata and supported inventory policy to match the reviewed artifact. Activation after admission does not change the batch's context; the existing lease/predecessor/publication guards still govern commit. A batch generated against an older revision is refused for new submission and regenerated/re-reviewed; do not simply rewrite its metadata label. Identical existing operation replay is still recovered through its existing idempotent submission semantics.

Retain a version-dispatching v1 reader for archived artifacts and explicit legacy mode. V1 new ingestion is allowed only while bundled mode is authoritative or runtime R0 is parity-equal to the exact approved seed and the installation's v1 compatibility gate is explicitly enabled. The first runtime data-changing activation permanently closes new v1 admission for that installation. Old files and previously published snapshots remain readable; this is not a new permission to republish an obsolete batch. Retaining a v1 decoder is different from accepting it as current curation input.

`batch-verification.ts` currently verifies release metadata and regenerated documents but does not independently replay provider bodies during ingestion. V2 must additionally verify that every submitted Driver/Constructor/Circuit/event identity/profile is in the pinned catalog/base, and that driver profile fields match exactly after the existing media policy. Still require the reviewed manifest, source validation, complete classification rounds and regeneration. The catalog does not replace manual capture review, and the Worker must not pretend normalized IDs prove which raw provider row produced them. No provider call is needed for any of these checks.

Affected code: `scripts/season-batch/{generate,entry,cli-guards,fixtures,submission}.ts/.mjs` as applicable, `src/ingest/{batch-format,batch-verification,submission,service}.ts` and their strict key lists. Preserve source shape and submission fencing. Extend frozen-fixture tooling to carry private catalog provenance in generation manifests only, never into public fixture DTOs or APK secrets. Version 2 readers must reject mismatched schema combinations, not accept “any newer version”.

### 9.3 Flutter and public API

No public API field, canonical ID, endpoint, snapshot schema version or Drift migration is needed. New verified canonical IDs arrive through normal public profiles/results; existing IDs and historical classification keys remain unchanged. `DriverSeasonEntry` split-span IDs are still derived by the existing canonical rule. Driver profile spelling updates use the same ID and ordinary refresh/conflict handling.

Flutter's database-v2 referential stubs allow a known canonical reference to arrive before its profile, then replace the empty-name marker with authoritative data. They cannot store a provider key as a placeholder and cannot justify a server-side unresolved race row. Test bootstrap atomicity, per-resource metadata isolation, offline reopen, out-of-order profile refresh, late profile arrival and older snapshots against the unmodified client. No catalog/evidence/reviewer fields enter DTOs, Drift, cache keys or routes.

Old active snapshots remain served during catalog outages. Catalog activation alone changes no app-visible response. Publication of a new guarded release carries ordinary contentVersion/revision freshness; no client cache reset or forced database clear is proposed. Android application ID/signing/Firebase/AdMob configuration is untouched.

### 9.4 Separate November curation issue

Keep the four cases tracked in the existing investigation and import them unresolved. Do not curate them “immediately” from the slugs or aggregate diagnostics. If the owner supplies and approves the required identity dossier **before runtime cutover**, the existing repository workflow remains the only active authority: add approved identities/mappings, remove matching acknowledgements, issue a new datasetVersion and replay offline. Then regenerate the seed from those reviewed bytes.

After runtime cutover, use the runtime workflow exclusively. Once evidence is approved, one of the four may be a controlled first real curation example; its identity, proposed ID and evidence must be reviewed separately. The migration must also pass with all four still unresolved. No milestone/test requires guessed identities, and no result claims the four account for all three actual unavailable resources.

## 10. Failure modes and safety guarantees

| Failure or race                                     | Required result/recovery                                                                                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown valid inventory key, strict mode            | Candidate discovered; whole participants resource still mapping-failure; constructor request still skipped.                                                                                                                                              |
| Unknown valid inventory key, optional-driver mode   | Explicit internal unresolved inventory entry; no public ID/profile/span; constructor request may proceed.                                                                                                                                                |
| Unknown required race/standings key                 | Complete resource fails. No row dropped, no empty success, no guessed ID; normal reconciliation/publication withholding remains.                                                                                                                         |
| Provider payload invalid or incomplete              | Strict decoder failure preserved; no approving evidence extracted; bounded skip metric.                                                                                                                                                                  |
| Candidate persistence fails or background task lost | Existing ingestion outcome unchanged; bounded failure/loss metric; acknowledged records survive restart. Later observation/import retries. No exactly-once delivery claim.                                                                               |
| Concurrent candidate creation/replayed batch        | Unique key/observation constraints and one transaction; one candidate and one count per retained occurrence ID.                                                                                                                                          |
| Conflict or more evidence during review             | Candidate/evidence-head CAS fails; review again. Repeated identical sightings do not invalidate review.                                                                                                                                                  |
| Two approvals for same key/different target         | Key reservation/uniqueness rejects conflicting proposal. No overwrite or automatic alias.                                                                                                                                                                |
| Two apparent new people with same name              | Names not a unique key; full-catalog duplicate review and stale-head check required. Ambiguity quarantined; no automated merge.                                                                                                                          |
| Two catalog activations                             | Exactly one expected-head CAS succeeds. Loser is re-reviewed/rebased; no lost update.                                                                                                                                                                    |
| Activation write failure/lost response              | Transaction aborts or durable operation receipt proves success. Read receipt/head; reuse operation ID. No partial active catalog.                                                                                                                        |
| Invalid/oversized revision or missing evidence      | No activation; complete old revision remains active. Invalid active snapshot fails new pins, never resolves a valid subset.                                                                                                                              |
| Activation midway through sync/verification/batch   | That run uses its pinned snapshot throughout, including profiles/metadata. Next run sees new head.                                                                                                                                                       |
| Catalog unavailable before runtime pin              | Fail before provider calls; old public snapshots remain readable. No bundled fallback.                                                                                                                                                                   |
| Catalog unavailable after pin                       | Frozen in-memory context remains usable; durable pin exists. Completion receipt may be uncertain, but sequencer remains publication authority.                                                                                                           |
| Worker restart/DO eviction                          | Durable rows, pointer, decisions and idempotency receipts reload. No seed-on-start or clearing storage. Reconciliation lease/recovery rules handle interrupted runs.                                                                                     |
| Incorrect unactivated approval                      | Abandon proposal, quarantine/reopen candidate, retain reserved ID/audit. No public impact.                                                                                                                                                               |
| Incorrect active approval, no release yet           | Pause new pins, hold affected seasons and drain all pinned runs; prove no published references before a separately reviewed compensating revision. No ad hoc key deletion through ordinary API.                                                          |
| Incorrect identity already published                | Preserve snapshots, report correction, hold ingestion/publication through existing operator controls. D15 continues refusing destructive replacement. Escalate a separate correction plan; neither catalog rollback nor Worker rollback repairs history. |
| Bad profile spelling, same actual person            | Reviewed immutable profile version with same canonical ID, new datasetVersion; historical snapshots remain as published. This is distinct from identity reassignment.                                                                                    |
| Stale batch/generated with another environment      | Refuse before writes using catalog/installation/schema/provenance checks; regenerate locally from intended export.                                                                                                                                       |
| Missing constructor/profile despite mapping         | Catalog validation/pin or final closure fails; never manufacture a team or profile.                                                                                                                                                                      |
| Reused identifier in another season                 | Distinct scoped key, fresh review. Within-season reuse unsupported; quarantine and fail required data.                                                                                                                                                   |
| Capacity/retention failure                          | Alert and refuse relevant new storage/approvals; never evict approved provenance or weaken identity lookup.                                                                                                                                              |
| Older Worker after new DO schema                    | Compatibility reader or fail closed; never downgrade durable schema. Keep current DO export declarations.                                                                                                                                                |
| D14/D15/D16 guard failure                           | Existing active release remains authoritative, no candidate repair from predecessor. Catalog approval cannot override guard result.                                                                                                                      |

Recovery exports must include closure of referenced decisions/evidence, hashes, schema version, installation and active head. Store them in an approved restricted operator location; encrypt at rest if that location requires it. Verify exports by restoring to a **new isolated local/test namespace** and replaying parity tests. Never import an export over a live nonempty catalog. Cloudflare's SQLite DO [PITR facilities](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) are an additional recovery tool, not a catalog rollback protocol: restoring old state may remove mappings still referenced by published releases and lose audit receipts. Reconcile externally preserved audit/export history and published release usage before reopening admission after any restore.

## 11. Deployment, rollout and recovery strategy

### 11.1 Explicit controls

Proposed configuration variables, parsed strictly; unknown values are configuration errors:

| Control                    | Values/default                                              | Meaning                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IDENTITY_DISCOVERY_MODE`  | `off` (default), `shadow`                                   | Off constructs no collector/store client; shadow writes candidates without influencing provider results. Remains usable with runtime resolution.                           |
| `IDENTITY_CATALOG_MODE`    | `bundled` (default), `compare`, `runtime`                   | Compare pins seeded snapshot for offline-equivalence diagnostics but bundled inputs decide behavior. Runtime requires a valid bound catalog/context. No implicit fallback. |
| `IDENTITY_ADMIN_MODE`      | `off` (default), `read-only`, `review`                      | Review enables individually authorized mutation endpoints, not publication. Shadow reads may use the existing admin token.                                                 |
| `IDENTITY_INVENTORY_MODE`  | `strict` (default), `optional-drivers`                      | Optional-drivers requires runtime mode plus approved phase-3 implementation/policy.                                                                                        |
| `IDENTITY_INSTALLATION_ID` | Explicit UUID for each local/staging/E2E/production catalog | Must match persisted installation; never derive solely from ENVIRONMENT.                                                                                                   |
| DO `admissionState`        | `open`/`paused`                                             | Durable gate on new pins; an incident uses existing season holds to contain in-flight publications too.                                                                    |

Feature flags select **whole-run contexts**, not per-row behavior. Flag changes require draining active runs for a controlled cutover. `compare` cannot activate an independent data-changing authority; seed-only comparison may fail diagnostically without changing normal bundled behavior. No deployment in this assignment is authorized.

### 11.2 Local and namespace/schema rollout

The repository uses `[exports.ClassName]`/`[env.<name>.exports.ClassName]` with `storage = "sqlite"`; do not introduce old `[[migrations]]` tags alongside it. Cloudflare's [class-export lifecycle documentation](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) confirms declarative class management and per-environment namespaces. The skill's legacy migration example is not the convention of this worktree.

Separate two migrations:

1. **Namespace lifecycle:** add the named class export, exact environment export map and `IDENTITY_CATALOG` binding in a separately reviewed configuration change. Named exports tables must retain all existing classes; do not accidentally replace the table with only the new class. Initial staging/E2E provisioning must not add the new class to an inherited top-level export that would implicitly affect production. Local tests may use a dedicated local configuration; do not alter production entries during staging preparation.
2. **Application schema:** new DO creates schema 1 and its migration record transactionally. Future additive migrations are ordered and hash-checked, preserve IDs and unknown-schema refusal, and have restart/fault tests. SQLite schema/version changes do not roll back when Worker code rolls back.

Local development uses ignored Wrangler persistence directories with explicit local-only bindings, controlled transports and no secrets/provider network. Keep the plain-Node Vitest runner and add a separate Miniflare integration harness that launches the bundled test Worker with SQLite DO persistence in an isolated temporary directory, disposes it, and reopens that directory to prove recovery. The audited lockfile has Wrangler `4.112.0` and transitive Miniflare `4.20260714.0`; U2 should declare the tested Miniflare version explicitly for this harness rather than rely on a transitive import. Exercise actual `transactionSync`/SQL support against the repository compatibility date before admitting the unit; a necessary dependency upgrade is a separate review, not a switch to fake persistence tests. No Workers Vitest pool conversion of the entire suite is required. No remote Wrangler dev, deploy, namespace creation or type-generation command that writes files is needed for this audit.

### 11.3 Staging sequence and activation criteria

1. **Approve policies and units.** Record PO-1 through PO-8 choices and their ADR amendments. Keep PRD, provider licensing/attribution, Implementation Plan §14 and §§22-24 gates intact; this redesign adds an operational capability, no new app feature.
2. **Deploy inert mechanism after separate staging approval.** Preserve all existing bindings, proxy configuration, secrets and empty cron lists. Modes remain off/bundled/read-only/strict. Verify deployed Worker and namespace identity with no provider call.
3. **Shadow discovery on controlled/local evidence first.** Inject known, unknown and malformed fixtures; confirm exact normal outcomes/request counts. Restart the local object and verify persistence/notification dedup. Capacity/failure tests must pass before enabling background writes for any authorized staging run.
4. **Seed staging R0 and verify closure.** Review artifact hashes/corpus totals and input cleanliness; perform explicit seed/validate/activate of parity-equal R0. Read it back and compare all mappings/profiles/metadata. Export and restore into an isolated test store. Do not copy staging's installation ID, review credentials or synthetic decisions into production.
5. **Compare mode.** Use a minimum of three controlled complete runs plus unknown inventory, unknown classification, invalid payload, storage outage and mid-run-activation scenarios. Require zero resolver/profile/document differences for R0 and unchanged request accounting. Report discovery persistence success/failure counts; zero unexplained drops/overflows is the gate. Volume can be synthetic; no live provider call is required to establish mechanism parity.
6. **Cut over resolution.** Require U6/U7 compatibility, owner approval, a rollback-capable deployment artifact, exported catalog, active revision/hash readback and all tests in §12. Apply existing operator holds to affected seasons, wait for active leases/verification/batch operations to finish, then select runtime mode with strict inventory. Release holds only through the established operator workflow. Do not automatically clear existing durable blocks. Initially activate no data-changing revision until seed parity is confirmed.
7. **Exercise one reviewed addition in controlled evidence.** Approve existing binding and synthetic new identity in an isolated test installation; test proposal/activation/pin/guard flow. A real staging addition must use real approved evidence and individual credentials. The four unresolved November cases are optional examples, not prerequisites.
8. **Enable optional-driver inventory separately.** After U9/U10, verify exact positive/negative scenarios, changed early-exit request count, complete closure, no leaked private inventory and unchanged guards. Inventory mode has its own owner gate; do not couple it to the runtime cutover deployment.
9. **Observe and record.** Backlog age, persistence failures, pin/validation latency, revision adoption, refused/stale approvals, unknown required rows, withhold reasons, D14-D16 rejections and public heartbeat/freshness. “No new release” can be correct; compare evidence and reason codes rather than using successful publication alone as the health check.
10. **Production readiness only.** Produce an approved immutable seed/export source, reviewer/backup ownership, rollback drill, compatibility evidence and separate production change proposal. Production remains untouched until that proposal is explicitly approved. Do not infer production deployment permission from staging acceptance or this report.

### 11.4 Rollback limits

- Before runtime cutover, disable shadow collection/comparison; public behavior remains bundled. Keep the DO and its data.
- While runtime still equals R0 and no runtime-dependent output exists, hold/drain runs and explicitly switch back to the verified bundled seed. Prove equivalence; do not use a generic error-triggered fallback.
- After runtime-only identity approval/publication, bundle rollback may lack required identities. Prefer rolling back code to a **runtime-capable compatibility build** while retaining the current catalog and schema. Disabling optional-driver inventory restores strict withholding but does not undo published data.
- Never remove/delete/rename the DO export or namespace as a rollback shortcut. Never run `deleteAll`, reseed over active state or restore a database snapshot without reconciling immutable releases.
- Restoring previous catalog contents requires a newly reviewed compensating revision and compatibility analysis, not moving the head backward. Removing/repointing activated identities is outside ordinary phase-2 APIs. New dataset labels are not reused.
- An incorrect published identity cannot be repaired through the existing reconciliation “accept correction” alone if D15 would be violated. Preserve records and propose a separate audited historical correction mechanism; there is no hidden break-glass approval in this plan.

## 12. Detailed testing matrix

All fixtures are synthetic or already available approved local evidence; install a throwing default network transport. Tests may simulate HTTP 200/429 but must never contact Jolpica/OpenF1/proxy. Existing tests mentioned below are reusable baselines, **not claimed newly run by this audit**.

### 12.1 Phase matrix

| ID/phase  | Scenario                                                  | Expected assertions and suite                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0 / 0    | ADR/contracts/corpus                                      | Exact 33/94/101/7 current baseline; seven still unresolved; future expected counts change only through approved data. Reuse `test/providers/mappings/{driver-dataset-2026,constructor-dataset-2026,circuit-dataset-2026,mapping-acknowledgement}.test.ts`. |
| T1 / 1    | Known driver                                              | No unresolved candidate, byte-identical normalized output, no extra requests. New `test/identity/discovery/extractor.test.ts`; existing participants/results/standings adapters.                                                                           |
| T2 / 1    | Unknown driver in each supported endpoint                 | All unknown decoded driver keys recorded, including beyond log-failure cap; strict outcome unchanged. Round/session/season/provenance exact.                                                                                                               |
| T3 / 1    | Malformed/truncated/duplicate/wrong-season page           | Decoder still fails, no approved evidence/canonical rows, no second page. Reuse adapter boundary fixtures.                                                                                                                                                 |
| T4 / 1    | Hostile optional names/accessors/oversized fields         | Extractor never invokes accessors, never coerces IDs, bounded omitted-field reasons, no raw body/name in logs or metric labels.                                                                                                                            |
| T5 / 1    | Duplicate delivery/concurrent candidate creation          | One candidate/key, unique occurrence counted once, same material evidence aggregated. Both fake store and actual SQLite tests.                                                                                                                             |
| T6 / 1    | Store throws/times out, crash before/after acknowledgment | Before ack loss is reported/allowed; committed evidence survives restart; outcome/request sequence/publish calls unaffected. No provider retry.                                                                                                            |
| T7 / 1    | Reviewed/rejected candidate repeatedly seen               | No repeated notification; new material evidence flagged; explicit reopen needed. Stale pinned run cannot reopen active binding.                                                                                                                            |
| T8 / 1    | Capacity/retention/restart alarm                          | Bounded rows/bytes, no approval-history eviction, overflow quarantine, no request-count change. Alarm restart continues stored progress.                                                                                                                   |
| T9 / 2    | Seed parity/missing/duplicate/dangling row                | All-or-nothing import and resolver; exact old IDs and typed scope; no partial snapshot on interrupted insert. Reuse mapping validation/coverage/closed-shape/Unicode/key-parity tests.                                                                     |
| T10 / 2   | Existing binding/new verified driver/profile update       | Decision → proposal → validation → activation only; no lookup before activation, complete profile after; profile correction retains ID.                                                                                                                    |
| T11 / 2   | Aliases and multiple providers                            | Explicit Jolpica/OpenF1 keys independently resolved, integer/string distinction, no name joins; OpenF1 runtime remains disabled. Existing `mapping-resolution`, `mapping-scope`, `mapping-boundary`, `event-mapping` tests.                                |
| T12 / 2   | Same-name collision and duplicate canonical creation      | New unrelated same-name person requires dossier; conflicting same key/ID rejected; second stale-head proposal must re-review complete catalog. No claim of automatic real-world dedup.                                                                     |
| T13 / 2   | Identifier reused across/within seasons                   | Separate seasons never inherit binding; within-season contradiction quarantined/required row fails.                                                                                                                                                        |
| T14 / 2   | Conflicting evidence and concurrent approvals             | Head/evidence/candidate CAS, no last-write-wins. Matching retry returns original operation; different payload same ID conflicts.                                                                                                                           |
| T15 / 2   | Invalid revision/failed activation/lost response          | Old head unchanged on invalid/failed transaction; receipt resolves committed timeout; no partial candidates-resolved state.                                                                                                                                |
| T16 / 2   | Mid-run activation                                        | Participants/results/standings/calendar/circuits/metadata all use old pinned context; next run uses new. Repeat for verification and batch admission.                                                                                                      |
| T17 / 2   | Catalog unavailable/unknown schema                        | Runtime refuses before network/publication; compare mode remains diagnostic; no cached/bundled fallback.                                                                                                                                                   |
| T18 / 2   | Worker/DO restart and schema upgrades                     | Restore snapshot/head/review/idempotency history; additive migration atomic; older reader compatible or closed refusal. Actual persistent local Worker test required.                                                                                      |
| T19 / 2   | Admin auth/role/principal/rotation/body limits            | Shared token cannot mutate catalog; reviewer cannot activate without role; spoofed actor rejected; no identity token access to sync; oversized body refused before parse.                                                                                  |
| T20 / 2   | Dataset label allocation                                  | Concurrent proposals unique labels, abandoned labels not reused, evidence-only no bump, same date counter, clock regression refused; contentVersion affects existing candidate digest as intended.                                                         |
| T21 / 2   | Batch v1/v2                                               | Strict schema dispatch; export/ref/hash/environment mismatch refused; v1 seed-only gate closes; v2 profile catalog mismatch refused; capture completeness/regeneration/D14-D16 retained.                                                                   |
| T22 / 2   | New catalog, unchanged classification                     | Existing classification revision hash/accepted state unchanged; profile/catalog version does not reset corroboration or release holds.                                                                                                                     |
| T23 / 3   | Inventory-only unknown                                    | Explicit private accounting, verified profiles unchanged, no span/guessed ID, complete otherwise-valid season can publish through real guarded harness.                                                                                                    |
| T24 / 3   | Unknown classification or standings row                   | Whole resource/season withheld, every row retained in diagnostic evidence, zero publication calls before guard; never filter it out.                                                                                                                       |
| T25 / 3   | Verified debutant absent from inventory                   | Required-reference closure supplies exact pinned profile; result creates valid span only after accepted selection. Unknown debutant remains blocking.                                                                                                      |
| T26 / 3   | FP1-only/inventory-only verified identity                 | Detail may exist, season driver list has no extra span; no team assignment or practice-based span.                                                                                                                                                         |
| T27 / 3   | Returning driver/transfer/multiple constructors           | Existing span boundaries, no overlapping spans, constructor from race row; multi-constructor standing null remains valid. Reuse split-participation/driver-span derivation fixtures.                                                                       |
| T28 / 3   | Constructor inventory unknown/missing profile             | Still withhold; no inferred constructor entry. Known driver closure cannot conceal missing constructor.                                                                                                                                                    |
| T29 / 3   | Forged inventory accounting                               | Count mismatch, duplicate IDs, wrong catalog hash or unknown private keys rejected at deep boundary; nothing leaks to public snapshots.                                                                                                                    |
| T30 / 3   | Historical classifications preserved                      | All earlier selected rows/profiles survive; candidate losing round rejected D14, losing driver fact/reassigning constructor rejected D15. Stored docs unchanged after rejection.                                                                           |
| T31 / all | D16 overlapping wider/narrower candidates                 | Existing expected-predecessor CAS and finalize invariant stop stale overwrite; no catalog transaction bypass. Both in-process and DO clients.                                                                                                              |
| T32 / all | Staging/production/E2E isolation                          | Identical object name in distinct namespaces stays isolated; wrong installation token/artifact rejected; production flags/bindings untouched; ENVIRONMENT=staging does not identify E2E as staging namespace.                                              |
| T33 / all | Flutter old/new snapshots and offline                     | Unchanged v1 decode; existing IDs preserved, canonical stub upgrades, database reopen, bootstrap transaction/conflict/metadata isolation, no candidate fields.                                                                                             |
| T34 / all | November synthetic regression                             | Preserve strict-mode 25 HTTP 200/22 selected/3 unavailable/no publication; phase-3 synthetic scenario has its own expected constructor attempt and still fails required unknown rows. Do not claim real incident root-cause proof.                         |
| T35 / all | No provider network or added authority                    | Throwing global transport, verified replay only; identity endpoints do not sync/publish/clear holds; public reads do not require catalog.                                                                                                                  |

### 12.2 Existing regression suites to retain

- `test/providers/jolpica/{participants-adapter,results-adapter,standings-adapter,resource-port}.test.ts` and support fixtures.
- `test/providers/mappings/` plus `test/scripts/provider-mapping-{rules,parity,document-set}.test.mjs` and key-parity tests. Reuse existing semantic checks rather than implement a weaker runtime-only validator.
- `test/providers/coordination/{payload-contract,deep-validation-gate,candidate-payload-snapshot,season-identity-integrity,participation-integrity,driver-span-derivation,driver-entry-span,standings-round-coherence,coordinated-guarded-publication,coordinated-publication-concurrency}.test.ts`.
- `test/publication/guard/{participation-guard,predecessor,standings-predecessor}.test.ts`, `test/publication/sequencer/expected-predecessor.test.ts`, `test/publication/sequenced/{publication-guard,rollback-provenance}.test.ts` and failure-containment suites.
- `test/sync/coordinated/{observation,outcome,operator,ledger,policy,entry-points}/`, especially `entry-points/proxy-transport.test.ts`; existing ledger schemas/lease/uncertain commit tests must not be relaxed.
- `test/season-batch/{generate,units,fixtures,submission}.test.ts`, CLI suites and `test/ingest/{batch-verification,guarded-ingest,season-ingest-worker,season-ingest-route}.test.ts`.
- Flutter `test/database/{unresolved_identity,competitor_dao,cross_layer_chronology}_test.dart`, `test/data/repositories/{bootstrap_repository,entity_metadata_isolation,split_participation}_test.dart`, `test/data/sync/snapshot_conflict_rule_test.dart`, `test/contract/mapping_test.dart` and frozen-data identity tests.

### 12.3 New suites and implementation verification

New proposed suite groups: `test/identity/discovery/` (extractor, collector, retention, shadow parity); `test/identity/catalog/` (seed, schema, store, revision validation, conflicts, activation, recovery, dataset versions); `test/admin/identity/` (routes, credentials, audit, replay); `test/sync/coordinated/identity-context.test.ts`; `test/providers/coordination/identity-closure.test.ts`; `test/season-batch/catalog-provenance.test.ts`; and a separate local persistent-DO integration configuration/suite. Exercise both store/transport doubles and real SQLite persistence. Existing Vitest config is a plain Node runner; do not silently replace its runtime for the entire suite.

For each implementation unit run the focused meaningful tests, typecheck/lint and applicable validators. Before cutover run full edge-api validation/test suite with the documented resource-conscious worker limit, relevant Flutter tests and controlled end-to-end publication guards. The previous investigation recorded frozen-fixture export timeouts at five seconds and successful isolated 30-second reruns; report such results honestly rather than silently changing assertions/timeouts to make this redesign appear green. No live smoke or real provider capture is required by this design-only assignment.

## 13. Ordered implementation roadmap and acceptance gates

These are **future** independently reviewable units. Every unit lists its own migration/recovery implications. File paths are service-relative unless prefixed `docs/`, `content/` or `lib/`. Proposed files do not exist yet. Do not create them in this assignment.

“No public behavior change” means output/publication policy remains unchanged under existing modes; it does not mean new administrative storage has no operational effect. Keep development changes disabled by default until each gate. Unit numbering is an implementation order, not permission to deploy.

### U0 - Accept policy and compatibility decisions (phase 0)

1. **Objective/scope:** approve PO-1 through PO-8 and record the authority, inventory and recovery boundaries.
2. **Existing files:** ADRs 0009, 0020, 0022, 0023, 0024, 0026, 0028; `docs/adr/README.md`; `docs/technical/{GridView_Backend_Scheme,GridView_Implementation_Plan,GridView_Environments}.md`; mapping guide. Exact amendments are in §3.2.
3. **New files:** proposed ADRs 0029-0031 named in §3.2, with number collision check; no code.
4. **Model/API:** approve the contracts in §§5-8; no endpoint exists yet.
5. **Dependencies:** owner review of this report, Implementation Plan Definition of Ready.
6. **Migration:** record exact source-of-truth handover and seed provenance; none executed.
7. **Tests:** review decision matrix against existing strictness/guard contracts; confirm every requested owner decision is resolved or the dependent unit stays blocked.
8. **Acceptance:** accepted ADR text, named reviewer/activator/backup responsibility, no accidental authorization for live operations. **No public behavior change.**
9. **Risks:** treating this proposal as approval; silently broadening inventory exception to required rows.
10. **Recovery:** amend proposed design before implementation; no state to revert.

### U1 - Pure evidence model and safe extraction (phase 1a)

1. **Objective/scope:** bounded allowlisted extraction from decoder-accepted responses; no persistence/integration yet.
2. **Existing files:** `src/providers/jolpica/{participants-payload,results-payload,standings-payload,calendar-payload,circuits-payload}.ts` and their corresponding normalizers as consumed contracts/key-enumeration seams; `src/providers/mappings/mapping-key.ts`, `src/runtime/own-property.ts`; reuse without weakening them.
3. **New files:** `src/identity/discovery/{model,extract-jolpica,keys,collector}.ts`; matching `test/identity/discovery/{extractor,collector,keys}.test.ts`.
4. **Model/API:** IdentityObservation, Evidence, Candidate types and exact hash/type codecs; injected collector with inert default.
5. **Dependencies:** U0/PO-4; current decoder/mapper contracts.
6. **Migration:** none; synthetic evidence only.
7. **Tests:** T1-T4, all endpoint paths, hostile properties, pagination rejection, full unknown set beyond log cap.
8. **Acceptance:** no network/storage imports, deterministic keys, zero changed decoder outcomes, no field leaked to public types. **No public behavior change.**
9. **Risks:** accepting evidence from invalid rows; conflating projection digest with raw-body hash.
10. **Recovery:** leave collector unused; remove new inert modules if rejected.

### U2 - Durable candidate store and shadow integration (phase 1b)

1. **Objective/scope:** atomic candidates/evidence/notifications, bounded retention, caught background drain.
2. **Existing files:** `src/providers/jolpica/{participants-port,results-port,standings-port,calendar-port,circuits-port}.ts`, `src/sync/coordinated/composition.ts`, `src/index.ts`, `src/config/environment.ts`, `src/logging/logger.ts`; use existing DO host/client patterns as reference. Configuration preparation is a separate small review within this unit; no deploy.
3. **New files:** `src/identity/{port,durable-object,client,store,schema,wire-decoders,local}.ts`, `src/identity/discovery/{persist,retention}.ts`; dedicated local Worker test config and candidate storage/restart suites.
4. **Model/API:** SQL schema 1, bounded internal `observe-batch`, `list`, `inspect`, `acknowledge`, `health` commands; modes off/shadow. Initial read endpoints through existing auth only, mutation commands not exposed publicly.
5. **Dependencies:** U1, PO-4/5/8; local persistence harness.
6. **Migration:** local new class/schema only; prepare named staging/E2E export/binding plan without editing production or provisioning anything. Never modify the existing ledger schema.
7. **Tests:** T5-T8 and complete off/on parity including failure paths; real local SQLite restart/rollback.
8. **Acceptance:** acknowledged candidates survive restart; one candidate per key; no extra provider call, changed resource output, accepted revision or publication decision. **No intended public behavior change.**
9. **Risks:** background-task loss, memory/candidate growth, accidentally awaiting storage in provider flow.
10. **Recovery:** disable discovery; retain durable history and class export. No public data rollback needed.

### U3 - Catalog snapshot/seed and shared validation (phase 2a)

1. **Objective/scope:** complete immutable seed snapshot, parity and export/import closure, no runtime selection.
2. **Existing files:** `src/providers/mappings/{index,mapping-registry,mapping-key}.ts`, `src/providers/jolpica/curated-{participants,circuits,events}.ts`, `scripts/lib/provider-mapping-rules.mjs`, `scripts/validate-content.mjs`, `src/ingest/canonical-json.ts`. Read current content as seed input; do not invent new content.
3. **New files:** `src/identity/catalog/{model,validate,snapshot,seed,export}.ts`; `scripts/identity/{seed,export}.ts`; `test/identity/catalog/{seed,parity,validation}.test.ts`.
4. **Model/API:** permanent anchors, profile versions, bindings, evidence/import decisions and R0 schema; explicit dataset/base hashes.
5. **Dependencies:** U0, U2, PO-1; review any uncommitted source changes before approving an import artifact.
6. **Migration:** offline artifact with 33/94/101/7 parity, all exact IDs/types and historical provenance; seed only an empty local store for tests.
7. **Tests:** T0/T9/T11; export round trip, missing evidence, malformed/duplicate targets, crash within seed transaction.
8. **Acceptance:** every existing lookup/profile/output matches; seven keys remain unresolved; full snapshot invalidates on any bad member. **No public behavior change.**
9. **Risks:** dual validators diverge; treating dirty bytes as approved HEAD; omission of non-driver mappings.
10. **Recovery:** reject/abandon unactivated seed, regenerate artifact; no overwrite of active/nonempty state.

### U4 - Review/proposal/version/activation state machine (phase 2b)

1. **Objective/scope:** pure durable approval and activation protocol behind internal port only.
2. **Existing files:** new U2 store/schema/client and U3 catalog validator; `src/sync/coordinated/outcome/metadata.ts` contract and publication canonical specs are compatibility references, not yet switched.
3. **New files:** `src/identity/catalog/{review,revision,activation,dataset-version,correction}.ts`; corresponding concurrency/replay/correction tests.
4. **Model/API:** immutable ReviewDecision, proposals/certificates/head CAS, reserved IDs/labels, operations/audit, corrections as records only.
5. **Dependencies:** U3, PO-1/6/7; preapproved logical review identity carried by the test port, no publicly reachable bypass.
6. **Migration:** additive local schema evolution with version/decoder tests; no staged environment writes yet.
7. **Tests:** T10-T15/T20; conflicting proposals, same-name ambiguity, abandoned reservations, failure injection at every write, dataset uniqueness.
8. **Acceptance:** approval cannot resolve before activation; activation atomic/idempotent; no activated binding retarget/delete; review history intact. **No public behavior change.**
9. **Risks:** mutable proposals invalidate review; catalog head and candidate state drift; reused version labels.
10. **Recovery:** abandon unactivated proposals; old head remains authoritative. No backward pointer mutation.

### U5 - Individual authority and administrative CLI (phase 2c)

1. **Objective/scope:** expose §7 exact contracts with accountable actors and inspectable JSON-file workflow.
2. **Existing files:** `src/admin/{auth,router}.ts`, `src/index.ts`, `src/config/environment.ts`, `src/logging/logger.ts`, service package scripts only if a CLI command is added.
3. **New files:** `src/admin/identity/{auth,routes,requests,responses}.ts`, `scripts/identity/{cli,client,guards}.mjs`, `test/admin/identity/` and CLI tests.
4. **Model/API:** principal/credential roles, common CAS/idempotency envelopes, paginated reads, review/validation/activation/history, audit and correction/admission operations.
5. **Dependencies:** U4, PO-3/8; actual credentials provisioned only during separately approved deployment.
6. **Migration:** existing ADMIN_TOKEN remains valid for old routes; new catalog mutations have no shared-token compatibility mode. No secret committed.
7. **Tests:** T19, stale requests, bounded parse, credential rotation/revocation, no identity-token sync authority, export/import closure.
8. **Acceptance:** actor derived server-side, every mutation audited, approve and activate separate, CLI never auto-resolves/fetches provider evidence. **No public app behavior change.**
9. **Risks:** routing through old shared auth blocks legitimate credentials or grants too much authority; actor spoofing; plaintext tokens in shell history.
10. **Recovery:** set admin read-only/off; preserve audit/catalog; revoke individual compromised credential without rewriting its history.

### U6 - Whole-run identity context and runtime reader (phase 2d)

1. **Objective/scope:** pin registry/profiles/base/metadata together and inject every identity-consuming path; default mode bundled.
2. **Existing files:** `src/sync/coordinated/{composition,run}.ts`, `observation/observe.ts`, `outcome/{metadata,publish}.ts`, `operator/verification.ts`; `src/providers/jolpica/{calendar-port,circuits-port,participants-port,results-port,standings-port}.ts`; `src/providers/coordination/coordinated-publication.ts`; `src/index.ts`; identity-consuming calendar diagnostic composition.
3. **New files:** `src/identity/catalog/{run-context,pin,bundled-context}.ts`, `test/sync/coordinated/identity-context.test.ts` and verification/context tests.
4. **Model/API:** IdentityRunContext, durable run pin, runtime unavailable/invalid causes, strict no-fallback gate; unchanged public schemas and classification hash.
5. **Dependencies:** U4/U5; activation/cutover held until U7/U8. PO-5 and mode flags approved.
6. **Migration:** reader code understands R0 before any runtime activation; no ledger v1 shape changes. Bundle defaults isolated to explicit bundled contexts.
7. **Tests:** T16-T18/T22/T35; pin after lease/before requests, all ports same hash, failures release lease, mid-run activation and restarted receipt.
8. **Acceptance:** default behavior identical; runtime outage causes zero provider requests; subsequent run adopts new catalog without deploy. **No public behavior change while mode remains bundled.**
9. **Risks:** forgotten optional constructor defaults, verification using a different revision, mixed profile/mapping versions, pin latency under lease budget.
10. **Recovery:** before cutover leave bundled; after cutover use compatible runtime reader, not old bundled code.

### U7 - Catalog-aware offline batches (phase 2e)

1. **Objective/scope:** v2 private artifact provenance, explicit local catalog export and pinned ingest validation.
2. **Existing files:** `scripts/season-batch/{generate,entry,fixtures,submission}.ts`, `{cli-guards,fixtures-guards,submission-guards}.mjs`; `src/ingest/{batch-format,batch-verification,submission,service,source-validation}.ts`; ingestion/fixture tests.
3. **New files:** `src/ingest/catalog-reference.ts`, `scripts/identity/catalog-file.ts`, `test/season-batch/catalog-provenance.test.ts`.
4. **Model/API:** internal batch v2 only; explicit v1 compatibility admission; matching installation/revision/export/projection and catalog profile checks.
5. **Dependencies:** U6; PO-6; must complete before runtime data-changing activation in any environment that admits batches.
6. **Migration:** readers accept archived v1; new v1 admission closes after first data-changing catalog activation. Regenerate/re-review pending batches; never relabel them.
7. **Tests:** T21/T33/T35 and existing guarded-ingest/capture/digest/regeneration suites.
8. **Acceptance:** no unpinned runtime batch; no provider requests; old snapshots/client remain readable; D14-D16 unchanged. **No public behavior change by itself.**
9. **Risks:** a forged normalized profile bypassing runtime catalog; breaking frozen builds; believing exporter provenance replaces capture review.
10. **Recovery:** retain v1 reader, disable new ingest if compatibility uncertain; no replay of old v1 as current runtime content.

### U8 - Seed comparison and cutover rehearsal (phase 2f)

1. **Objective/scope:** prove handover, isolation and recovery on local/controlled evidence; prepare a reviewable staging change.
2. **Existing files:** `test/config/wrangler-config.test.ts`, `test/sync/coordinated/entry-points/{binding,runs,stops,proxy-transport}.test.ts`, publication guard tests and batch tests; `wrangler.toml` only in separately reviewed preparation with production untouched.
3. **New files:** `test/identity/integration/{cutover,isolation,restart,restore}.test.ts`, `docs/operations/GridView_Identity_Catalog_Runbook.md` in a future documentation unit.
4. **Model/API:** explicit flags, compare diagnostics and run receipts; no new public contract.
5. **Dependencies:** U2-U7; owner approval for any actual staging provisioning, separate from code review.
6. **Migration:** empty local installation seed/export/restore, schema and R0 parity; document staging deployment order without executing it implicitly.
7. **Tests:** T17-T22/T30-T35; real local SQLite restart, duplicate installation rejection, phase-1 exact request parity.
8. **Acceptance:** complete cutover/recovery checklist with immutable artifacts and zero unexplained parity differences. **No public behavior change until separately authorized runtime selection.**
9. **Risks:** export table replacement or inheritance affecting production; wrong namespace; rollback build unable to read current state.
10. **Recovery:** modes remain default; retain provisioned data if later authorized deployment is cancelled.

### U9 - Explicit optional driver inventory (phase 3a)

1. **Objective/scope:** produce complete internal inventory accounting with verified profile projection; strict constructor behavior retained.
2. **Existing files:** `src/providers/jolpica/{participants-normalizer,participants-port}.ts`; `src/providers/coordination/{resource,payload-contract,port,coordinator,outcome}.ts`; adapters/shape/snapshot tests.
3. **New files:** `src/identity/inventory/{model,normalize,validate}.ts`, `test/providers/jolpica/driver-inventory.test.ts`.
4. **Model/API:** internal `driverInventory` and policy discrimination; no public schema change. Validate mode-specific closed payloads, not a permissive superset.
5. **Dependencies:** U6-U8, PO-2; feature remains strict until U10 and phase-3 gate.
6. **Migration:** no durable publication/ledger schema changes; new optional policy version recorded in run/batch provenance.
7. **Tests:** T23/T24/T26/T28/T29/T34, constructor call continuation and actual attempt accounting, no leaks.
8. **Acceptance:** only valid unmapped inventory drivers become optional; every other invalid/required row still fails. **No public behavior change while strict flag remains selected.**
9. **Risks:** generalized filtering reused for results; count drift; accidental duplicate canonical collapse; false “empty inventory” success.
10. **Recovery:** select strict mode under controlled run drain; retain discovered evidence and all approved IDs.

### U10 - Required identity closure and complete guarded publication (phase 3b)

1. **Objective/scope:** source required verified profiles from pinned catalog independently of inventory membership; retain whole-season safeguards.
2. **Existing files:** `src/providers/coordination/{season-assembly,season-integrity,coordinated-publication}.ts`, `scripts/season-batch/generate.ts`; consume direct source validation unchanged; `src/sync/coordinated/outcome/publish.ts` context wiring only.
3. **New files:** `src/providers/coordination/season-identity-closure.ts`, `test/providers/coordination/identity-closure.test.ts`.
4. **Model/API:** internal closure input; ProviderSeasonSource/public schemas unchanged; reject missing profiles before generation.
5. **Dependencies:** U9 and U7 batch policy support; owner accepts narrow benefit/limitations.
6. **Migration:** no old snapshot rewrite or client migration; identity revision/dataset lineage accompanies new runs only.
7. **Tests:** T23-T35, including positive inventory-only publication, negative unknown race/standings, debutant/return/transfer/FP1 and real D14-D16 harnesses.
8. **Acceptance:** positive case publishes only a complete guarded season; every negative preserves active documents and accepted history. **Behavior change only when optional-driver mode is explicitly enabled.**
9. **Risks:** borrowing historical payloads, making profiles imply spans, losing old entrants absent from inventory, catalog/context disagreement.
10. **Recovery:** disable optional policy; strict withholding returns. Published new facts remain immutable/protected; no profile deletion rollback.

### U11 - Approved staging rollout and production-readiness evidence

1. **Objective/scope:** execute §11's staging steps only after explicit authorization; produce production-readiness evidence, not production deployment.
2. **Existing files:** deployment environment/config tests, approved ADR/Implementation Plan/runbooks; use existing operator hold/lease tooling without changing its authority.
3. **New files:** dated staging identity-catalog evidence report and recovery drill record, created by the future authorized rollout.
4. **Model/API:** no further model changes; flags/credentials/namespaces use the already approved contracts.
5. **Dependencies:** U0-U10 gates; named operator approval for actual infrastructure/secrets/deploy actions and any future real sync.
6. **Migration:** seed/compare/runtime-strict/optional inventory in separate recorded steps; production seed prepared independently from approved corpus, never copied with synthetic staging decisions.
7. **Tests:** controlled full-season replay, restart/restore, runtime adoption, unknown-required refusal, auth/isolation; separately authorized live validation only if later required.
8. **Acceptance:** all gates pass, exported recovery artifact verified, reviewer and backup ownership recorded, no claim that deployment rolled back persisted state; separate production change request. Production untouched.
9. **Risks:** environment drift, approved staging identity lacking production evidence, unobserved in-flight old revision, mistaken publication-based health conclusion.
10. **Recovery:** follow §11.4; hold/drain, use runtime-compatible code, preserve data and historical publication guards. Incorrect identity enters correction workflow, not an emergency alias patch.

## 14. Residual risks, readiness conclusion and audit method

### 14.1 Remaining owner inputs and factual unknowns

- Approval of PO-1 through PO-8 remains outstanding. In particular, runtime authority, individual reviewer credentials, single-person versus two-person activation, inventory-only omission, evidence retention and lack of automatic historical repair are product/operational decisions, not implementation defaults that may be silently accepted.
- The four November keys have no approved name/ID dossiers in this worktree. Their actual resource appearances and all real validation failures remain unknown. The roadmap is intentionally valid with them unresolved.
- No current deployed Worker version, secret, namespace contents, reviewer account or production release is inspected. A future rollout must obtain actual environment state under its authorization; repository declarations alone are insufficient.
- Human duplicate review can still misidentify two people or create the same person twice under separate canonical IDs. Exact key uniqueness cannot prove human identity. Ambiguity must stay quarantined; a stronger mandatory second-reviewer policy is PO-3, not a fuzzy-matching solution.
- The proposed hard capacity/retention budgets need operational owner acceptance and controlled-load measurement. At capacity the system preserves correctness and history at the expense of new discovery/approval availability.
- Persisted sanitized names/biographical claims introduce a bounded internal data-retention surface absent from today's log-only failures. Review evidence licensing/retention against existing provider attribution policy without expanding app data or persisting raw responses.
- Strict runtime pinning adds an ingestion dependency and some latency. Public reads remain independent. Measure pin/validation duration under the existing lease/run budget before activation; do not increase provider quota/request cadence to compensate.
- Constructor/circuit/event profiles remain sealed reviewed imports in this driver-first redesign. Their curation can be imported into a new complete runtime revision without deploying code, but this plan does not add separate constructor/circuit/event review UIs or loosen their inventory requirements.
- Correcting a wrong published identity is deliberately not solved by phases 0-3. It needs a separate design for immutable history, client identity continuity and guarded release reconstruction/correction. Resource-scoped publication is also a separate future project; neither is a hidden dependency for the narrow inventory-only benefit.

### 14.2 Readiness conclusion

The repository has usable seams: injectable resolvers/curated lookup interfaces, strict decoders, transactional DO precedent, explicit coordination contracts, complete assembly and guarded publication tests. The essential missing work is not just “put mappings in storage”: it is durable review authority, complete snapshot/profile/version provenance, all-entry-point pinning, batch compatibility and a narrowly scoped inventory contract amendment.

After U0 approval, U1-U5 can establish the mechanism without changing public application behavior. U6-U8 can prove parity and safe runtime handover. U9-U10 deliver only the defined inventory-only improvement. Production remains a separately approved deployment, and unresolved facts never become test fixtures that masquerade as verified canonical identities.

### 14.3 Audit method and preservation record

This audit used read-only repository inspection, JSON count/group checks, source symbol tracing and official Cloudflare documentation for storage/configuration semantics. It did not execute provider-facing scripts, real synchronization, publication, batch submission, Wrangler deployment, infrastructure reads/writes, Android release operations or the application test suite. The test strategy above is an implementation deliverable, not a claim of executed validation.

The working tree initially contained eight tracked modifications from the previous investigation (evidence JSON, mapping guide, implementation plan and five test files) plus the untracked November investigation report. Their byte hashes were captured for preservation checking. The only permitted new repository file in this assignment is this report. Final verification checks branch/HEAD, unchanged hashes for those nine files, local Markdown links and whitespace; no commit, push or merge is part of completion.

Cloudflare sources consulted on 2026-11-13 are linked at the relevant storage/rollout decisions above. They establish platform capabilities, not the actual configuration or safety of a future deployment. Recheck applicable platform/dependency documentation when implementing and preserve this repository's accepted authority boundaries.
