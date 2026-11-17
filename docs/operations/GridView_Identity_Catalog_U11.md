# GridView identity catalog - U11: staging preflight, strict rollout packet and go/no-go

- Date: 2026-11-17 (preflight window 18:05-18:25Z)
- Worktree: `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`, HEAD
  `027da5da59bf6b8c75a3fc432ef4fdc691772528`, index empty, U0-U10 uncommitted.
- Authorization used: U11 preparation, local verification and read-only staging
  inspection only.
- **Outcome: NO-GO.** Read-only preflight is complete. The approval packet is
  prepared but **cannot be approved as it stands**, because of blockers B1-B6
  in section 16. Nothing was deployed, provisioned, seeded, activated,
  synchronized or published. No secret was changed. No provider was contacted.
  Production and E2E were only read.

Evidence folder (outside the repository, not committed):
`%USERPROFILE%\.gridview\evidence\identity-u11-preflight-2026-11-17\`.

## 1. Read-only staging preflight report

### 1.1 What was executed

Every call was a GET. The Cloudflare OAuth token stayed in process memory and
was never printed.

| Time (UTC)     | Operation                                                                                         | Effect                                         |
| -------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 18:12:30       | `cf-read.mjs` (account KV, DO namespaces, scripts, schedules, deployments, settings, subdomain)  | Read; `cf-now.json`                            |
| 18:13-18:15    | `wrangler versions view` for 3 staging versions; `wrangler deployments list --env staging`       | Read                                           |
| 18:16:28       | `content-read.mjs`: GET the deployed module of version `1d858d56`                                | Read; module saved for comparison              |
| 18:16-18:17    | Clean detached temp worktree at `027da5d` (`%TEMP%\gv-u11-pf`), `npm ci`, `wrangler deploy --dry-run` | Local only; no upload                    |
| 18:18:09       | `staging-admin-get.ps1` (GET-only copy of the 11-04 helper, POST branch removed): cutover status, sync status, reconciliation inspect | **HTTP 401** on all three (section 1.3) |
| 18:18:10       | Public GETs: staging, production, E2E (14 routes each)                                           | Read                                           |
| ~18:19         | `resolved-vs-live.mjs`: resolved config (no network) plus live script list and staging KV key names | Read                                        |

Before the admin GETs I checked the **deployed** source (`027da5d`) to confirm
all three routes only read. Reconciliation inspect is documented as "Takes no
lease and writes nothing". The other two read the sequencer and storage.

Not executed: any POST, `wrangler tail`, the KV pointer and route-walk script,
any proxy or Jolpica request, any identity route (none exists live).

### 1.2 Verified deployed state

| Item                        | Verified value                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker                      | `gridview-api-staging`, workers.dev enabled, previews disabled                                                                                                                                                                       |
| Active deployment           | `36b9697d-673c-48fe-a133-6ad8c02367b4`, 2026-11-12T18:48:40Z, version **`1d858d56-f91e-4f62-b10b-1a2c06daece7`** at 100 % (number 22, `triggered_by: secret`)                                                                       |
| Code version                | `1d858d56` carries the same script as `deabb568-6dd6-4bc5-b088-9446c1ecfb87` (2026-11-12T18:27:04Z, `upload`): script etag `5a55c1b4…5864` in both                                                                                 |
| Previous code               | `de0dc58a-5c09-4b16-8ce4-aae56199dbde` (2026-11-05)                                                                                                                                                                                  |
| **Build provenance**        | Deployed `index.js` SHA-256 `7415b82dbc77da64655b33638b1f2afb75f131e036c67db0d834cc783458e49b`, **byte-identical** to a clean `wrangler deploy --dry-run --env staging` of committed `027da5d`. So live staging contains **no identity-catalog code**. |
| Exports                     | `ProviderRateLimiter`, `SeasonPublicationSequencer`, `ReconciliationLedger`, all `durable-object`/`sqlite`; `migration_tag` null                                                                                                     |
| DO namespaces (staging)     | Sequencer `294f25eb…12bb`, rate limiter `3d7ad4a9…91b2`, **reconciliation ledger `f4ebd45f…96dd`**. No `IdentityCatalog` namespace on the account.                                                                                 |
| KV                          | `GRIDVIEW_DATA` → `1d0fb554…942b` (`gridview-snapshots-staging`); 3,982 keys, names digest `596242654fef…ccfc6`, 0 with expiry. **Identical to 2026-11-03.**                                                                         |
| Vars                        | `ENVIRONMENT=staging`, `PROVIDER_MODE=coordinated`, `JOLPICA_TRANSPORT=proxy`, `JOLPICA_PROXY_ORIGIN=https://gridviewjol.vps.webdock.cloud`, `SEASON_PUBLICATION_AUTHORITY=sequencer`, `SEASON_PUBLICATION_CUTOVER_CONTROL=activate:2026`, `SEASON_BATCH_INGEST=2026`, `PUBLIC_BASE_URL` |
| Secrets (names only)        | `ADMIN_TOKEN`, `JOLPICA_PROXY_TOKEN`                                                                                                                                                                                                 |
| `IDENTITY_*` vars / binding | **None.** Absent values resolve to `bundled` / `off` / `strict` in the U10 code, but that code is not deployed.                                                                                                                       |
| Schedules                   | `[]` (staging, E2E, production)                                                                                                                                                                                                      |
| Observability               | Logs on, persisted, invocation logs off; traces off                                                                                                                                                                                  |
| Public snapshot             | 14/14 routes 200, **ETags identical to 2026-11-03**. Manifest `contentVersion 2026.10.07.1`, `attributionVersion data-sources-v2`, `generatedAt 2026-10-19T18:43:32.476Z`. `/v1/status` ok, `lastSuccessfulSyncAt 2026-10-13T03:18:04.776Z`, maintenance false. |
| Installation UUID / catalog | **Not provisioned** (no var, no binding, no namespace)                                                                                                                                                                               |

The November investigation records the operator-reported 2026-11-12 proxy sync,
which was withheld with zero publication calls. The unchanged KV key set and
public ETags are consistent with that report. They do not prove the ledger's
current state.

### 1.3 Unknown or inaccessible state

**The staging `ADMIN_TOKEN` copy held locally no longer authenticates.**
`%USERPROFILE%\.gridview\credentials\staging-admin-token.dpapi` dates from
2026-09-13. It worked on 2026-11-05, and today all three GETs returned 401
(3 bounded refused requests in staging logs). The only staging change since
then that could explain this is the 2026-11-12 secret-only version `1d858d56`.
A rotation of `ADMIN_TOKEN` is consistent with that, but which secret changed
cannot be determined from metadata. No other credential was tried.

Therefore **unknown**:

- operator holds and durable blocks;
- lease state, uncertain verification or batch intents, backlog;
- sequencer cutover state (active version, previous version, fingerprint);
- whether the 2026-11-12 run left any reconciliation state that needs operator
  attention.

The public ETags show only that no new release was published since 11-03.

Also unknown or not inspectable with current tools: per-round
`limiterDeferralUntil` (not exposed by Inspect), identity catalog health (no
catalog exists), and which individual operators hold which credentials.

## 2. Actual versus declared configuration

| Aspect                                   | Verified deployed                                         | Repository-declared (`wrangler.toml` = HEAD, byte-identical)             | Note                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging bindings, vars, KV, DO, secrets  | As in section 1.2                                         | Same set; the dry-run binding list of `027da5d` equals live              | Match                                                                                                                                                                                          |
| Staging code                             | `027da5d` bundle                                          | Working tree adds uncommitted U0-U10 (dirty dry-run bundle `fb60cc64…85e3d8`, 1,662 KiB, exports `IdentityCatalog`) | Live is **behind** the tree by all identity work                                                                                                                         |
| Staging comments                         | n/a                                                       | Still say the live staging version is `453af4fb` with provider `none`, and the ledger "not yet deployed" | **Stale documentation**: live runs `coordinated` + proxy with the ledger. Not a runtime risk; correct it in the rollout change.                                                 |
| Branch of the deployed code              | `027da5d` (`feat/jolpica-egress-proxy`)                   | `master` is `aea1387`; this branch is 4 commits ahead and unmerged       | Staging runs **unmerged** code. Record it and decide whether the release identity must come from `master`.                                                                                       |
| Production                               | `62bf40e9…`, `PROVIDER_MODE=none`, `genesis:2026`, no ledger, KV `d76328b3…`, crons `[]`; public 200/503/404 pre-genesis | Same                                                                     | Unchanged                                                                                                                                                                                      |
| E2E                                      | `6b52bc02…`, controlled KV source, own 3 DO namespaces, KV `f8970084…`, crons `[]`; public 14/14 200 | Same                                                                     | Unchanged; `ENVIRONMENT=staging` is shared with staging, so catalog isolation must come from binding + UUID                                                                                    |

Resolved-config differences from 2026-11-03 are all explained: checkout path,
`traces.enabled=false` pin (#101), and the staging proxy vars and secret (124f995).

## 3. PO-1 to PO-8 approval audit

The PO decisions are approved as **architecture** (design addendum 2026-11-13;
ADRs 0029-0031 Accepted). The operational gates they create are not approved.

| Decision                     | Architecture | Operational status for staging                                                                                                                                                                 | Blocker? |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| PO-1 Runtime authority       | Approved     | Runtime cutover needs its own approval (ADR 0031 D6). Not given.                                                                                                                               | Later gate |
| PO-2 Driver inventory only   | Approved     | Optional-driver staging activation explicitly **not authorized**.                                                                                                                              | Later gate |
| PO-3 Individual credentials  | Approved     | **No principal named, no `IDENTITY_REVIEWER_CREDENTIALS` provisioned.** Single-person review+activate allowed; separation is by operation only.                                                   | **Yes (B3)** for any admin enablement |
| PO-4 Evidence and retention  | Approved     | Limits accepted. Restricted export storage location not named.                                                                                                                                 | Yes, with B4 |
| PO-5 Failure behavior        | Approved     | Implemented and locally tested; remote latency unmeasured.                                                                                                                                     | No (measure in U11) |
| PO-6 Versions / batch v2     | Approved     | R0 keeps `2026.10.07.1`. v1 compatibility gate stays unset by default.                                                                                                                         | No |
| PO-7 Historical corrections  | Approved     | Records only; no break-glass.                                                                                                                                                                  | No |
| PO-8 Capacity, recovery, ownership | Approved as baseline | Capacity validated **locally only** (U8 `capacity.test.mjs`). **Recovery custodian, backup custodian and remote backup plan (catalog, sequencer, ledger, KV, audit, secrets) not assigned or rehearsed.** Staging rollout approval separate. | **Yes (B3, B4)** |

Implementation completion is not treated as approval of any of the open items
above.

## 4. Role and credential ownership matrix

No assignment has been recorded anywhere in the repository or evidence. The
product owner's Cloudflare account authored every deployment. That identifies
an account, not a role assignment.

| Role                                 | Primary    | Backup     | Credential needed                                            | Status          |
| ------------------------------------ | ---------- | ---------- | ------------------------------------------------------------ | --------------- |
| Primary staging operator             | Unassigned | -          | Cloudflare deploy access; **current** staging `ADMIN_TOKEN`  | Missing; local admin copy invalid |
| Backup staging operator              | -          | Unassigned | Same                                                         | Missing         |
| Reviewer (catalog)                   | Unassigned | Unassigned | Individual `reviewer` credential                             | Not provisioned |
| Activator (catalog)                  | Unassigned | Unassigned | Individual `activator` credential                            | Not provisioned |
| Recovery/export custodian            | Unassigned | Unassigned | Individual `reader` credential + restricted storage          | Not provisioned |
| Release approver (staging change)    | Unassigned (product owner by default authority; must be recorded) | - | Approval record                                             | Not recorded    |

## 5. Exact staging-only configuration proposal (inert, strict)

The file is `%TEMP%\…\scratchpad\u11\u11-staging-strict.diff` (session
scratch). Its content is reproduced here. The UUID shown is a deliberately
synthetic placeholder used only for the scratch validation. **The real value
must be generated and approved by the owner, never derived from `ENVIRONMENT`.**

```diff
@@ [env.staging.vars] (after SEASON_BATCH_INGEST)
+IDENTITY_INSTALLATION_ID = "<owner-approved-staging-uuid-v4>"
+IDENTITY_DISCOVERY_MODE = "off"
+IDENTITY_CATALOG_MODE = "bundled"
+IDENTITY_ADMIN_MODE = "off"
@@ after [[env.staging.durable_objects.bindings]] RECONCILIATION_LEDGER
+[env.staging.exports.IdentityCatalog]
+type = "durable-object"
+storage = "sqlite"
+
+[[env.staging.durable_objects.bindings]]
+name = "IDENTITY_CATALOG"
+class_name = "IdentityCatalog"
```

`IDENTITY_INVENTORY_MODE` is not added. Absence resolves to `strict`
(`resolveIdentityInventoryMode`), and keeping it absent avoids touching the
committed-environment guard. No `IDENTITY_BATCH_V1_COMPATIBILITY_INSTALLATION_ID`
is added. No `IDENTITY_REVIEWER_CREDENTIALS` is added in the inert step.

Mechanical validation on a scratch copy (`unstable_readConfig`, wrangler 4.112.0):

- the resolved **production and E2E configurations are identical** to baseline;
- staging exports = `ProviderRateLimiter`, `SeasonPublicationSequencer`,
  `ReconciliationLedger`, `IdentityCatalog`;
- staging DO bindings add only `IDENTITY_CATALOG`;
- `migrations: []`, and top-level exports are unchanged (`ProviderRateLimiter`,
  `SeasonPublicationSequencer`).

Unchanged: crons `[]`, proxy vars and secret, KV id, publication authority and
cutover control, batch ingest, observability.

The same change must also update the stale staging comments (section 2) and
add or adjust config tests (`test/config/wrangler-config.test.ts`) to pin the
new staging-only export. It must not relax the guard that forbids
`optional-drivers` in committed environments.

## 6. Reproducible build / artifact identification

| Artifact                           | Identity                                                                                                                                       | Usable as release? |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Live staging (rollback floor today)| `027da5d`, bundle `7415b82d…e49b`, version `1d858d56`                                                                                          | Yes, verified      |
| Current working tree               | HEAD `027da5d` + 289 uncommitted paths (77 modified, 212 untracked); dirty dry-run bundle `fb60cc64…85e3d8` (current `wrangler.toml`, no identity binding) | **No (B2)**   |
| U10 acceptance tree                | `identity-u10-preservation.json`: 1,541 files, **all byte-identical today**, no unrecorded file other than that record                        | Source evidence only |
| R0 seed set                        | `seed.json 6abc3830…`, `manifest.json bdbaeb37…`, `parity.json 372b67ea…`; regenerated today byte-identical                                    | Yes (content)      |

**Blocker B2:** the code to deploy exists only as uncommitted bytes. Every
earlier staging deployment used a commit, a clean detached worktree and a
dry-run/upload bundle match. A deploy from this dirty tree would have no
release identity that a reviewer or a later rollback could reproduce. I am not
authorized to commit, so no release identity is invented here.

**Smallest safe action:** the owner authorizes committing the U0-U11 work (one
or more reviewed commits on a branch) and decides whether staging may run that
branch's commit (as `027da5d` does today) or only `master`. Then repeat
section 18 on the clean commit and record its dry-run bundle hash.

## 7. Remote mutation approval packet (prepared; NOT approvable yet)

1. **Actual staging state:** section 1. Holds, leases and cutover are unknown (B1).
2. **Exact diff:** section 5, with the real UUID.
3. **Targets:** Worker `gridview-api-staging`; account `786e24f1…`; new DO
   namespace `gridview-api-staging_IdentityCatalog` (created by the deploy);
   existing namespaces unchanged; KV `1d0fb554…`. Not touched:
   `gridview-api-production`, `gridview-api-e2e`.
4. **Provenance:** pending B2. Required: commit SHA, clean worktree, `npm ci`
   log, full suite, dry-run `index.js` SHA-256, uploaded bundle match.
5. **People:** section 4. All unassigned (B3).
6. **Publication and provider effects expected:** none. Modes are inert, no
   schedule, no sync is sent. The bundled path stays the identity authority.
   The deploy changes code on the coordinated path (bundled identity context
   builder), so **no sync may be sent** in the deploy window. Any later sync
   is a separate approval.
7. **Backup/recovery:** nothing to back up for the catalog before it exists.
   Before deploy, capture the read-only baseline (cf-read, KV names digest,
   public ETags, admin GETs with a valid credential). A platform backup plan
   for sequencer, ledger and KV is required before **runtime cutover** (B4),
   not before the inert deploy.
8. **Commands proposed** (from a clean detached worktree at the release commit,
   `services/edge-api`):

   ```text
   npm ci
   npm test -- --maxWorkers=1 --testTimeout=30000
   npm run typecheck; npx eslint .; npx prettier --check .
   npm run validate:content; npm run validate:fixtures; npm run validate:openapi
   node scripts/identity/compile-schemas.mjs --check
   npx wrangler deploy --dry-run --env staging --outdir <evidence>/dryrun
   # pre-reads: cf-read.mjs, resolved-vs-live.mjs, public-etags.mjs, staging-admin-get.ps1 x3
   # MUTATION (requires explicit approval naming the commit and bundle hash):
   npx wrangler deploy --env staging
   # post-reads: same as pre-reads + wrangler versions view <new id> --json
   ```

9. **Reversal and limits:** adding the `IdentityCatalog` class **permanently
   blocks `wrangler rollback`** to `1d858d56` and every earlier version (the
   same constraint the ledger introduced; see the `wrangler.toml` ledger
   comment). Reversal is a **forward deploy** that keeps all four exports:
   - either the same build with modes inert;
   - or `027da5d`-equivalent code plus a kept `IdentityCatalog` export. That
     code does not contain the class, so it **cannot** be deployed with the
     export. The only valid recovery build is therefore a commit containing
     the identity code.

   Removing only the `IDENTITY_CATALOG` binding is allowed. Removing the export
   is forbidden.
10. **Privileged operations:** `wrangler deploy` (Cloudflare OAuth, account
    holder). Admin GETs need the current staging `ADMIN_TOKEN`. No
    `secret put` in the inert step.
11. **Unresolved holds/leases/transactions:** **unknown (B1).** The public state
    shows no publication since 2026-11-03. The 2026-11-12 withheld run's ledger
    effects are unverified.
12. **Blockers:** B1-B6, section 16.

**Approval requested now: none.** First resolve B1-B3 and B6. Then this packet
is re-issued with real values for one explicit approval of the inert deploy
only. Shadow, seed, compare, runtime and optional inventory each keep their own
approvals.

## 8. R0 seed and catalog verification - NOT EXECUTED (remote)

Local reproduction only: `node scripts/identity/seed.mjs --out <new scratch dir>`
regenerated `seed.json`, `manifest.json` and `parity.json` **byte-identical**.

- Parity: `valid: true`, 33 drivers, 11 constructors, 24 circuits, 23 events,
  94 bindings (0 unequal), 101 evidence records, 7 unresolved.
- Catalog `sha256:8a2a62d8…39851` and projection `sha256:ab953da8…c746` are
  present in the artifacts. Dataset `2026.10.07.1`.

Remote seed, validate and activate operation IDs and receipts: **NOT EXECUTED.**
This needs the inert deploy, admin mode `review`, individual credentials (B3)
and a separate approval.

## 9. Comparison runs - NOT EXECUTED

**Design issue for the owner (B6).** Staging's only provider path is the live
proxy to Jolpica. A compare run on staging is a real coordinated sync: it
would send live provider traffic, write ledger bookkeeping, and could publish
if eligible. That is prohibited without separate authorization, and it is not
a "controlled capture". Options:

- (a) run compare in an isolated installation on **E2E**, which reads a
  controlled KV source, with its own UUID;
- (b) add a reviewed staging configuration selecting
  `CONTROLLED_PROVIDER_SOURCE=kv` for the compare window, under an operator
  hold;
- (c) approve recorded live replay explicitly.

The runbook's "three controlled runs per intended deployment" cannot be met on
staging as configured. No option is chosen here.

## 10. Runtime-strict cutover - NOT EXECUTED

Preconditions 1-12 of the U11 prompt §12 are unmet: no R0 in staging, no
compare runs, no export, no custodian, no verified holds or drain, no cutover
approval.

## 11. Staging latency and resources - NOT EXECUTED

No identity code runs remotely. Windows/Miniflare figures from U8-U10 are not
remote evidence. The existing deadlines stay as they are: 2 s pin with 1
identical retry, 10 s admin namespace, 240/300 s budgets.

## 12. Operational recovery drill - NOT EXECUTED

Locally established (U8): cold-copy restore into empty isolated stores and a
fresh-installation reconstruction. Remote: no catalog, no PITR exercise, no
custodian. **Cloudflare point-in-time recovery has not been verified.**

## 13. Public snapshot and publication authority

- Staging serves documents with `generatedAt 2026-10-19T18:43:32.476Z` and
  `contentVersion 2026.10.07.1` (the active version id needs the sequencer
  read blocked by B1; the last verified value, 2026-11-04, was
  `pm1-000000000001d-aed72435`). The 14 checked routes are ETag-identical to
  2026-11-03.
- Authority var is `sequencer` with control `activate:2026`. The sequencer's
  own report is not read (401).
- Production is pre-genesis and unchanged; E2E is unchanged.

## 14. Tests and validators

| Check                                                     | Result                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| U10 acceptance log `.wrangler/identity-u10-full-acceptance.log` | SHA-256 `be94fa9e…68ef326` matches the record; 6,381 passed / 6 skipped / 0 failed, exit 0               |
| Tree vs U10 preservation record                           | 1,541/1,541 byte-identical, 0 missing, no unrecorded file (except the record)                              |
| Full suite re-run                                         | **Not re-run**: no source byte changed since acceptance. **Required again** on the release commit (B2)     |
| `git diff --check`                                        | Pass                                                                                                       |
| `compile-schemas.mjs --check`                             | Pass                                                                                                       |
| R0 regeneration                                           | Byte-identical (section 8)                                                                                 |
| Proposed staging diff (scratch)                           | Production/E2E resolved identical; exports preserved; no migrations                                        |
| Dry-run, clean `027da5d`                                  | Equals the deployed module byte for byte                                                                   |
| Dry-run, dirty tree                                       | Builds (1,662 KiB); exports `IdentityCatalog` + 3 existing                                                 |

Typecheck, ESLint, Prettier, OpenAPI, content and fixture results from U10
§15 apply to the unchanged bytes. They were not newly executed.

## 15. Preservation comparison

- Before: branch, HEAD and empty index verified. 289 status lines inventoried
  with sizes and SHA-256 (session scratch `u11/inventory-before.tsv`); 0 missing.
- Added by U11: this report only. Outside the repository: the evidence folder,
  the temp worktree `%TEMP%\gv-u11-pf` (detached at `027da5d`, kept as the
  verified rollback-build checkout, `git status` clean), and session scratch.
- No reset, clean, stash, checkout of this worktree, commit, push or merge.
  `wt-ui-redesign` was not accessed.

## 16. Remaining risks and stop conditions (blockers)

| ID | Blocker                                                                                                                         | Smallest safe action                                                                                                    |
| -- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| B1 | Staging admin credential invalid (401). Holds, blocks, leases, cutover state and the 11-12 run's ledger effects cannot be verified. | Owner supplies the current staging `ADMIN_TOKEN` into approved custody (DPAPI re-encryption), or confirms a rotation. Then re-run the three GETs. |
| B2 | No reproducible release identity: identity code is uncommitted.                                                                 | Owner authorizes commits (and decides branch vs `master`); rebuild and test from a clean worktree at that commit.        |
| B3 | Operator, backup, reviewer, activator, custodian and release approver all unassigned (ADR 0031 D6).                             | Owner records named primary/backup per role (one person may cover reviewer and activator).                              |
| B4 | No remote backup/recovery plan or custodian; PITR unverified; restricted export storage unnamed.                                | Required before runtime cutover. Name the custodian and storage, and approve a platform plan covering catalog, sequencer, ledger, KV, audit and secrets. |
| B5 | Staging installation UUID not allocated.                                                                                        | Owner approves a freshly generated UUIDv4 for staging (and a different one for any E2E installation).                   |
| B6 | Compare runs on staging would mean live provider traffic and possible publication; no controlled source on staging.             | Owner chooses option (a), (b) or (c) in section 9.                                                                      |

Risks: the class addition is irreversible for `wrangler rollback` (section
7.9); staging runs unmerged `027da5d`; the stale `wrangler.toml` comments could
mislead an operator; node:sqlite suites are load-sensitive locally (U10 §17).

## 17. Optional-inventory staging proposal - NOT ACTIVATED

Not proposed for approval yet. Its preconditions (strict runtime cutover
accepted, verified active revision, export) do not exist. When they do, the
proposal will contain:

- a staging-only `IDENTITY_INVENTORY_MODE = "optional-drivers"` diff, plus an
  explicit, reviewed adjustment of the committed-environment guard, limited to
  staging;
- evidence for each scenario named in the U11 prompt §16, via controlled source
  only;
- the strict recovery procedure: remove the var under hold and drain.

## 18. Production-readiness report - NO DEPLOYMENT

Production verified unchanged: `62bf40e9`, `PROVIDER_MODE=none`, genesis
pre-state, crons `[]`, 3 DO namespaces with no catalog, no identity vars. The
checklist before any production change request:

1. Staging U11 accepted through runtime-strict.
2. Independent production UUID, namespace and credentials.
3. Production seed prepared independently from the approved corpus. No staging
   history, synthetic decisions or credentials are copied.
4. Named production roles and custodian.
5. Production backup plan rehearsed.
6. A production-only config diff validated to leave staging and E2E unchanged.
7. Separate explicit owner approval.

Nothing here authorizes production.
