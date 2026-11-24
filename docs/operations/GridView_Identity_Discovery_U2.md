# U2 identity discovery: local implementation and rollout gates

U2 implements private SQLite discovery and best-effort shadow collection.
It does not implement a verified catalog, seed migration, identity approval,
activation, inventory exceptions or external notification delivery.
Nothing has been provisioned or deployed by this unit.

## Local configuration

The ordinary `wrangler.toml` and all of its environment declarations remain
unchanged. `IdentityCatalog` is a named Worker export; exporting a class does
not provision a namespace. Only
[`wrangler.identity-local.toml`](../../services/edge-api/wrangler.identity-local.toml)
declares its SQLite export and binding for the local harness.

- `IDENTITY_DISCOVERY_MODE`: absent or `off` creates no collector/client;
  `shadow` captures only responses already decoded by the five existing ports.
- `IDENTITY_INSTALLATION_ID`: explicit lower-case UUID v4, checked against the
  database installation record. Object names include this UUID. Staging and E2E
  must have different IDs even though both may use `ENVIRONMENT=staging`.
- `IDENTITY_CATALOG`: dedicated namespace, separate from reconciliation and
  publication storage.
- `IDENTITY_ADMIN_MODE=read-only`: enables existing-admin-token GET inspection;
  absent disables these routes. This flag enables no mutation.

The local configuration's installation UUID is a test fixture, not an assignment
for staging or production. The local harness entry point is a direct internal
protocol adapter for tests, not an externally deployable admin API.

## Store and inspection

Schema 1 has installation metadata, candidates, material evidence, occurrences,
notifications and bounded-age delivery receipts. Exact serialized provider keys
and observation IDs are unique. Candidate/evidence/observation/notification writes
and their receipt commit in one synchronous SQLite transaction. SHA-256 work
precedes the transaction; internal SQL mutation versions are rechecked before
commit. Review versions change for material evidence/lifecycle, not merely for
repeated sightings. Unsupported schema versions and installation changes fail
closed rather than rewriting existing data.

Material projections retain their immutable first-admission sanitized provenance,
including synthetic/controlled status. Retained observations provide subsequent
occurrences. These are unverified claims; no storage result creates a binding or
canonical identity.

GET routes below `/internal/admin/identity` are authenticated, JSON-only,
`Cache-Control: no-store`, and reject unknown query parameters:

- `/candidates?limit=50&cursor=...&unread=true`
- `/candidates/{candidateId}`
- `/candidates/{candidateId}/evidence`
- `/candidates/{candidateId}/observations`
- `/health`

Lists allow 1–100 candidates; evidence/occurrence pages allow 1–16 records to
remain within the 256 KiB protocol boundary. Cursors are opaque exact hash keys.
No candidate data enters public v1 responses.

The namespace-only `acknowledge` operation accepts the trusted caller's
authenticated reader principal and credential attribution. U2 exposes no public
acknowledgement route or credential mechanism. ADR 0031 forbids the shared token
from performing this mutation. An individually authenticated route belongs to
the later review-authority unit.

## Capacity, retention and failures

The accepted baselines remain 1,024 candidate keys per season/provider, 4,096 per
installation, 32 material projections of at most 8 KiB, 64 retained occurrences,
64 context summaries and a 256 MiB logical admission budget. Health reports
capacity pressure at 80%. Candidate tombstones consume capacity permanently.
Projection overflow retains old evidence and quarantines unresolved candidates;
already rejected, quarantined, resolved or archived state is never reopened
by a sighting.

Logical accounting measures stored UTF-8 text columns and reserves eight bytes
per integer, plus 1 KiB for bounded installation metadata. SQLite pages, indexes,
runtime heap and platform overhead require separate capacity measurements.

A retention alarm processes at most 50 candidates and 100 expired receipts per
transaction, with a persisted cursor. Expired unreferenced occurrence detail and
receipts are removed after 90 days. Unresolved, rejected and quarantined
candidates become archived after 365 inactive days, retaining the exact key,
prior state, summary and material evidence. Protected occurrences/evidence are
not evicted. Future decision/reference operations must mark their history
protected atomically; U2 implements no such decisions.

Collection retains at most 2,000 observations / 2 MiB. Concurrent extraction is
bounded to eight tasks; excess capture attempts are dropped with a bounded
diagnostic. Pure decoder/extractor working buffers are additional to the retained
collector payload. The final caught `waitUntil` task persists batches of at most
100 observations / 256 KiB, one batch at a time, with one two-second drain budget.
One settled failure may be retried with identical observations. An unresolved
timeout is not overlapped by a retry because it may still commit.

A hard Worker stop before commit can lose discoveries. After commit, acknowledged
state survives restart; identical delivery replays without duplicate candidates.
Deduplication after retention applies only to retained occurrence IDs/receipts.
The mechanism does not promise exactly-once delivery or lossless discovery.

Failures log bounded reasons only and do not change provider request count,
normalization, reconciliation or publication. Driver mapping failure still stops
the constructors request. Bundled resolution and D14–D16 remain authoritative.

Notifications are durable unread entries unique by candidate and generation.
New evidence/urgency is recorded without generating another notification on
each sighting. Acknowledgement preserves actor/generation. A future email worker
can consume this state only after separately reviewed delivery idempotency,
authorization and retry rules. U2 sends nothing and schedules no notifications.

## Local verification and future gates

The ordinary Node Vitest runner remains unchanged. Tests use Node's real SQLite
for deterministic transactional faults and Miniflare/workerd for actual
SQLite-backed Durable Object disk restart and rollback. Miniflare is pinned as
a development dependency to the version already supplied by Wrangler. Test
Workers have a throwing outbound transport; only temporary local storage is used.

Run from `services/edge-api`:

```text
node node_modules/vitest/vitest.mjs run test/identity --maxWorkers=2 --testTimeout=30000
```

Before a separately authorized staging/E2E rollout:

1. Assign named reviewer, activator, recovery custodian and backup owners.
2. Assign separate installation UUIDs and namespaces; review declarative SQLite
   exports/bindings for each environment without changing production.
3. Validate capacity, physical overhead, alarm progress, loss/overflow metrics,
   restart recovery and backup/export procedures on the intended local/staging
   scale. U2's local restart test is not a verified production recovery export.
4. Keep discovery off for the first separately authorized provision; shadow
   enablement requires its own staging approval and operational observation.
5. Preserve the class and durable history if shadow capture is disabled.
   Production provisioning/deployment always needs separate authorization.

U3 may begin only with separate authorization. Its acceptance must cover the
complete reviewed seed corpus, exact canonical-ID/mapping parity, immutable
catalog validation and evidence provenance. U2 grants no catalog approval or
activation authority.

## Local validation result (2026-11-14)

- Identity tests: 137 passed (86 U1 regressions and 51 U2 tests), including three
  Miniflare/workerd tests against actual SQLite Durable Object storage.
- Full edge-api suite: 5,956 passed, six existing opt-in tests skipped;
  275 test files passed and three skipped. No failures or timeouts.
- Type checking, ESLint, package-wide Prettier checks, this document's formatting
  and relative links, content validation and `git diff --check` passed.
- Content validation: 18 checks passed; dataset version remains `2026.10.07.1`.
- Restart evidence covers complete local runtime disposal/recreation using the
  same SQLite directory, durable acknowledgement, injected failure inside a real
  transaction, rollback recovery and replay after commit. It is not a production
  export/restore test or proof of lossless delivery during abrupt termination.
- Off/shadow parity tests compare provider request count/order, normalized
  outcomes and manual/scheduled reconciliation/publication effects with synthetic
  transports. No live providers were called.
- Coverage percentage was not measured; the existing runner has no coverage
  provider installed. Test counts are not a coverage claim.

The branch remains `feat/jolpica-egress-proxy`, at HEAD
`027da5da59bf6b8c75a3fc432ef4fdc691772528`. No changes were staged or committed.
No operational synchronization, publication, remote provisioning or deployment
was performed.

## U2 file inventory and preservation audit

The starting worktree had 38 uncommitted files. SHA-256 comparison against the
pre-U2 snapshot leaves 35 byte-identical; only the three boundary tests listed
below were extended. The U1 purity checks remain; assertions that discovery was
unreachable from the Worker now require the exact reviewed U2 import edges.
No November regression expectations or U0 decisions were changed.

### Created by U2 (22)

- `docs/operations/GridView_Identity_Discovery_U2.md`
- `services/edge-api/src/admin/identity-routes.ts`
- `services/edge-api/src/identity/client.ts`
- `services/edge-api/src/identity/discovery/persist.ts`
- `services/edge-api/src/identity/durable-object.ts`
- `services/edge-api/src/identity/factory.ts`
- `services/edge-api/src/identity/local.ts`
- `services/edge-api/src/identity/port.ts`
- `services/edge-api/src/identity/response-decoders.ts`
- `services/edge-api/src/identity/schema.ts`
- `services/edge-api/src/identity/store.ts`
- `services/edge-api/src/identity/wire-decoders.ts`
- `services/edge-api/test/identity/catalog/admin.test.ts`
- `services/edge-api/test/identity/catalog/boundaries.test.ts`
- `services/edge-api/test/identity/catalog/local-persistence.test.mjs`
- `services/edge-api/test/identity/catalog/local-worker.ts`
- `services/edge-api/test/identity/catalog/retention.test.ts`
- `services/edge-api/test/identity/catalog/sqlite-support.ts`
- `services/edge-api/test/identity/catalog/store.test.ts`
- `services/edge-api/test/identity/discovery/shadow.test.ts`
- `services/edge-api/test/identity/discovery/sync-shadow.test.ts`
- `services/edge-api/wrangler.identity-local.toml`

### Modified by U2 (16)

- `services/edge-api/package-lock.json`
- `services/edge-api/package.json`
- `services/edge-api/src/admin/router.ts`
- `services/edge-api/src/config/environment.ts`
- `services/edge-api/src/index.ts`
- `services/edge-api/src/logging/logger.ts`
- `services/edge-api/src/providers/jolpica/calendar-port.ts`
- `services/edge-api/src/providers/jolpica/circuits-port.ts`
- `services/edge-api/src/providers/jolpica/participants-port.ts`
- `services/edge-api/src/providers/jolpica/results-port.ts`
- `services/edge-api/src/providers/jolpica/standings-port.ts`
- `services/edge-api/src/sync/coordinated/composition.ts`
- `services/edge-api/src/sync/coordinated/run.ts`
- `services/edge-api/test/identity/discovery/boundaries.test.ts`
- `services/edge-api/test/providers/mappings/mapping-containment.test.ts`
- `services/edge-api/test/providers/provider-neutrality.test.ts`

### Prior uncommitted files (38)

An asterisk marks a prior file also extended by U2. All other files are
byte-identical to the pre-U2 snapshot.

- `content/seasons/2026/provider-evidence.development.json`
- `docs/adr/0009-protected-staging-administration-token.md`
- `docs/adr/0020-provider-source-observation-and-reconciliation.md`
- `docs/adr/0022-curated-provider-identifier-mappings.md`
- `docs/adr/0023-multi-source-provider-coordination.md`
- `docs/adr/0024-deep-normalized-contract-validation.md`
- `docs/adr/0025-season-publication-authority-and-rollback-republication.md`
- `docs/adr/0026-season-participation-semantics-and-derivation.md`
- `docs/adr/0028-automatic-end-to-end-season-updates.md`
- `docs/adr/README.md`
- `docs/operations/GridView_Provider_Mapping_Guide.md`
- `docs/technical/GridView_Backend_Scheme.md`
- `docs/technical/GridView_Environments.md`
- `docs/technical/GridView_Implementation_Plan.md`
- `services/edge-api/test/providers/coordination/coordination-containment.test.ts`
- `services/edge-api/test/providers/mappings/circuit-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/constructor-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/driver-dataset-2026.test.ts`
- `services/edge-api/test/providers/mappings/mapping-acknowledgement.test.ts`
- `services/edge-api/test/providers/mappings/mapping-containment.test.ts` *
- `services/edge-api/test/providers/provider-neutrality.test.ts` *
- `services/edge-api/test/sync/coordinated/entry-points/proxy-transport.test.ts`
- `docs/adr/0029-persistent-identity-discovery-and-reviewed-runtime-catalog.md`
- `docs/adr/0030-provider-driver-inventory-and-required-identity-closure.md`
- `docs/adr/0031-identity-review-authority-and-catalog-cutover.md`
- `docs/operations/2026-11-12-jolpica-mapping-investigation.md`
- `docs/technical/GridView_Identity_Management_Design.md`
- `services/edge-api/src/identity/discovery/boundary.ts`
- `services/edge-api/src/identity/discovery/collector.ts`
- `services/edge-api/src/identity/discovery/extract-jolpica.ts`
- `services/edge-api/src/identity/discovery/keys.ts`
- `services/edge-api/src/identity/discovery/model.ts`
- `services/edge-api/test/identity/discovery/boundaries.test.ts` *
- `services/edge-api/test/identity/discovery/collector.test.ts`
- `services/edge-api/test/identity/discovery/extractor.test.ts`
- `services/edge-api/test/identity/discovery/keys.test.ts`
- `services/edge-api/test/identity/discovery/parity.test.ts`
- `services/edge-api/test/identity/discovery/support.ts`
