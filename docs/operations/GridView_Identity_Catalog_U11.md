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

| Time (UTC)  | Operation                                                                                                                             | Effect                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 18:12:30    | `cf-read.mjs` (account KV, DO namespaces, scripts, schedules, deployments, settings, subdomain)                                       | Read; `cf-now.json`                     |
| 18:13-18:15 | `wrangler versions view` for 3 staging versions; `wrangler deployments list --env staging`                                            | Read                                    |
| 18:16:28    | `content-read.mjs`: GET the deployed module of version `1d858d56`                                                                     | Read; module saved for comparison       |
| 18:16-18:17 | Clean detached temp worktree at `027da5d` (`%TEMP%\gv-u11-pf`), `npm ci`, `wrangler deploy --dry-run`                                 | Local only; no upload                   |
| 18:18:09    | `staging-admin-get.ps1` (GET-only copy of the 11-04 helper, POST branch removed): cutover status, sync status, reconciliation inspect | **HTTP 401** on all three (section 1.3) |
| 18:18:10    | Public GETs: staging, production, E2E (14 routes each)                                                                                | Read                                    |
| ~18:19      | `resolved-vs-live.mjs`: resolved config (no network) plus live script list and staging KV key names                                   | Read                                    |

Before the admin GETs I checked the **deployed** source (`027da5d`) to confirm
all three routes only read. Reconciliation inspect is documented as "Takes no
lease and writes nothing". The other two read the sequencer and storage.

Not executed: any POST, `wrangler tail`, the KV pointer and route-walk script,
any proxy or Jolpica request, any identity route (none exists live).

### 1.2 Verified deployed state

| Item                        | Verified value                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker                      | `gridview-api-staging`, workers.dev enabled, previews disabled                                                                                                                                                                                                                           |
| Active deployment           | `36b9697d-673c-48fe-a133-6ad8c02367b4`, 2026-11-12T18:48:40Z, version **`1d858d56-f91e-4f62-b10b-1a2c06daece7`** at 100 % (number 22, `triggered_by: secret`)                                                                                                                            |
| Code version                | `1d858d56` carries the same script as `deabb568-6dd6-4bc5-b088-9446c1ecfb87` (2026-11-12T18:27:04Z, `upload`): script etag `5a55c1b4…5864` in both                                                                                                                                       |
| Previous code               | `de0dc58a-5c09-4b16-8ce4-aae56199dbde` (2026-11-05)                                                                                                                                                                                                                                      |
| **Build provenance**        | Deployed `index.js` SHA-256 `7415b82dbc77da64655b33638b1f2afb75f131e036c67db0d834cc783458e49b`, **byte-identical** to a clean `wrangler deploy --dry-run --env staging` of committed `027da5d`. So live staging contains **no identity-catalog code**.                                   |
| Exports                     | `ProviderRateLimiter`, `SeasonPublicationSequencer`, `ReconciliationLedger`, all `durable-object`/`sqlite`; `migration_tag` null                                                                                                                                                         |
| DO namespaces (staging)     | Sequencer `294f25eb…12bb`, rate limiter `3d7ad4a9…91b2`, **reconciliation ledger `f4ebd45f…96dd`**. No `IdentityCatalog` namespace on the account.                                                                                                                                       |
| KV                          | `GRIDVIEW_DATA` → `1d0fb554…942b` (`gridview-snapshots-staging`); 3,982 keys, names digest `596242654fef…ccfc6`, 0 with expiry. **Identical to 2026-11-03.**                                                                                                                             |
| Vars                        | `ENVIRONMENT=staging`, `PROVIDER_MODE=coordinated`, `JOLPICA_TRANSPORT=proxy`, `JOLPICA_PROXY_ORIGIN=https://gridviewjol.vps.webdock.cloud`, `SEASON_PUBLICATION_AUTHORITY=sequencer`, `SEASON_PUBLICATION_CUTOVER_CONTROL=activate:2026`, `SEASON_BATCH_INGEST=2026`, `PUBLIC_BASE_URL` |
| Secrets (names only)        | `ADMIN_TOKEN`, `JOLPICA_PROXY_TOKEN`                                                                                                                                                                                                                                                     |
| `IDENTITY_*` vars / binding | **None.** Absent values resolve to `bundled` / `off` / `strict` in the U10 code, but that code is not deployed.                                                                                                                                                                          |
| Schedules                   | `[]` (staging, E2E, production)                                                                                                                                                                                                                                                          |
| Observability               | Logs on, persisted, invocation logs off; traces off                                                                                                                                                                                                                                      |
| Public snapshot             | 14/14 routes 200, **ETags identical to 2026-11-03**. Manifest `contentVersion 2026.10.07.1`, `attributionVersion data-sources-v2`, `generatedAt 2026-10-19T18:43:32.476Z`. `/v1/status` ok, `lastSuccessfulSyncAt 2026-10-13T03:18:04.776Z`, maintenance false.                          |
| Installation UUID / catalog | **Not provisioned** (no var, no binding, no namespace)                                                                                                                                                                                                                                   |

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

| Aspect                                  | Verified deployed                                                                                                        | Repository-declared (`wrangler.toml` = HEAD, byte-identical)                                                        | Note                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Staging bindings, vars, KV, DO, secrets | As in section 1.2                                                                                                        | Same set; the dry-run binding list of `027da5d` equals live                                                         | Match                                                                                                                           |
| Staging code                            | `027da5d` bundle                                                                                                         | Working tree adds uncommitted U0-U10 (dirty dry-run bundle `fb60cc64…85e3d8`, 1,662 KiB, exports `IdentityCatalog`) | Live is **behind** the tree by all identity work                                                                                |
| Staging comments                        | n/a                                                                                                                      | Still say the live staging version is `453af4fb` with provider `none`, and the ledger "not yet deployed"            | **Stale documentation**: live runs `coordinated` + proxy with the ledger. Not a runtime risk; correct it in the rollout change. |
| Branch of the deployed code             | `027da5d` (`feat/jolpica-egress-proxy`)                                                                                  | `master` is `aea1387`; this branch is 4 commits ahead and unmerged                                                  | Staging runs **unmerged** code. Record it and decide whether the release identity must come from `master`.                      |
| Production                              | `62bf40e9…`, `PROVIDER_MODE=none`, `genesis:2026`, no ledger, KV `d76328b3…`, crons `[]`; public 200/503/404 pre-genesis | Same                                                                                                                | Unchanged                                                                                                                       |
| E2E                                     | `6b52bc02…`, controlled KV source, own 3 DO namespaces, KV `f8970084…`, crons `[]`; public 14/14 200                     | Same                                                                                                                | Unchanged; `ENVIRONMENT=staging` is shared with staging, so catalog isolation must come from binding + UUID                     |

Resolved-config differences from 2026-11-03 are all explained: checkout path,
`traces.enabled=false` pin (#101), and the staging proxy vars and secret (124f995).

## 3. PO-1 to PO-8 approval audit

The PO decisions are approved as **architecture** (design addendum 2026-11-13;
ADRs 0029-0031 Accepted). The operational gates they create are not approved.

| Decision                           | Architecture         | Operational status for staging                                                                                                                                                                                                               | Blocker?                              |
| ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| PO-1 Runtime authority             | Approved             | Runtime cutover needs its own approval (ADR 0031 D6). Not given.                                                                                                                                                                             | Later gate                            |
| PO-2 Driver inventory only         | Approved             | Optional-driver staging activation explicitly **not authorized**.                                                                                                                                                                            | Later gate                            |
| PO-3 Individual credentials        | Approved             | **No principal named, no `IDENTITY_REVIEWER_CREDENTIALS` provisioned.** Single-person review+activate allowed; separation is by operation only.                                                                                              | **Yes (B3)** for any admin enablement |
| PO-4 Evidence and retention        | Approved             | Limits accepted. Restricted export storage location not named.                                                                                                                                                                               | Yes, with B4                          |
| PO-5 Failure behavior              | Approved             | Implemented and locally tested; remote latency unmeasured.                                                                                                                                                                                   | No (measure in U11)                   |
| PO-6 Versions / batch v2           | Approved             | R0 keeps `2026.10.07.1`. v1 compatibility gate stays unset by default.                                                                                                                                                                       | No                                    |
| PO-7 Historical corrections        | Approved             | Records only; no break-glass.                                                                                                                                                                                                                | No                                    |
| PO-8 Capacity, recovery, ownership | Approved as baseline | Capacity validated **locally only** (U8 `capacity.test.mjs`). **Recovery custodian, backup custodian and remote backup plan (catalog, sequencer, ledger, KV, audit, secrets) not assigned or rehearsed.** Staging rollout approval separate. | **Yes (B3, B4)**                      |

Implementation completion is not treated as approval of any of the open items
above.

## 4. Role and credential ownership matrix

No assignment has been recorded anywhere in the repository or evidence. The
product owner's Cloudflare account authored every deployment. That identifies
an account, not a role assignment.

| Role                              | Primary                                                           | Backup     | Credential needed                                           | Status                            |
| --------------------------------- | ----------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | --------------------------------- |
| Primary staging operator          | Unassigned                                                        | -          | Cloudflare deploy access; **current** staging `ADMIN_TOKEN` | Missing; local admin copy invalid |
| Backup staging operator           | -                                                                 | Unassigned | Same                                                        | Missing                           |
| Reviewer (catalog)                | Unassigned                                                        | Unassigned | Individual `reviewer` credential                            | Not provisioned                   |
| Activator (catalog)               | Unassigned                                                        | Unassigned | Individual `activator` credential                           | Not provisioned                   |
| Recovery/export custodian         | Unassigned                                                        | Unassigned | Individual `reader` credential + restricted storage         | Not provisioned                   |
| Release approver (staging change) | Unassigned (product owner by default authority; must be recorded) | -          | Approval record                                             | Not recorded                      |

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

| Artifact                            | Identity                                                                                                                                                   | Usable as release?   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Live staging (rollback floor today) | `027da5d`, bundle `7415b82d…e49b`, version `1d858d56`                                                                                                      | Yes, verified        |
| Current working tree                | HEAD `027da5d` + 289 uncommitted paths (77 modified, 212 untracked); dirty dry-run bundle `fb60cc64…85e3d8` (current `wrangler.toml`, no identity binding) | **No (B2)**          |
| U10 acceptance tree                 | `identity-u10-preservation.json`: 1,541 files, **all byte-identical today**, no unrecorded file other than that record                                     | Source evidence only |
| R0 seed set                         | `seed.json 6abc3830…`, `manifest.json bdbaeb37…`, `parity.json 372b67ea…`; regenerated today byte-identical                                                | Yes (content)        |

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

| Check                                                           | Result                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| U10 acceptance log `.wrangler/identity-u10-full-acceptance.log` | SHA-256 `be94fa9e…68ef326` matches the record; 6,381 passed / 6 skipped / 0 failed, exit 0             |
| Tree vs U10 preservation record                                 | 1,541/1,541 byte-identical, 0 missing, no unrecorded file (except the record)                          |
| Full suite re-run                                               | **Not re-run**: no source byte changed since acceptance. **Required again** on the release commit (B2) |
| `git diff --check`                                              | Pass                                                                                                   |
| `compile-schemas.mjs --check`                                   | Pass                                                                                                   |
| R0 regeneration                                                 | Byte-identical (section 8)                                                                             |
| Proposed staging diff (scratch)                                 | Production/E2E resolved identical; exports preserved; no migrations                                    |
| Dry-run, clean `027da5d`                                        | Equals the deployed module byte for byte                                                               |
| Dry-run, dirty tree                                             | Builds (1,662 KiB); exports `IdentityCatalog` + 3 existing                                             |

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

| ID  | Blocker                                                                                                                             | Smallest safe action                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Staging admin credential invalid (401). Holds, blocks, leases, cutover state and the 11-12 run's ledger effects cannot be verified. | Owner supplies the current staging `ADMIN_TOKEN` into approved custody (DPAPI re-encryption), or confirms a rotation. Then re-run the three GETs.        |
| B2  | No reproducible release identity: identity code is uncommitted.                                                                     | Owner authorizes commits (and decides branch vs `master`); rebuild and test from a clean worktree at that commit.                                        |
| B3  | Operator, backup, reviewer, activator, custodian and release approver all unassigned (ADR 0031 D6).                                 | Owner records named primary/backup per role (one person may cover reviewer and activator).                                                               |
| B4  | No remote backup/recovery plan or custodian; PITR unverified; restricted export storage unnamed.                                    | Required before runtime cutover. Name the custodian and storage, and approve a platform plan covering catalog, sequencer, ledger, KV, audit and secrets. |
| B5  | Staging installation UUID not allocated.                                                                                            | Owner approves a freshly generated UUIDv4 for staging (and a different one for any E2E installation).                                                    |
| B6  | Compare runs on staging would mean live provider traffic and possible publication; no controlled source on staging.                 | Owner chooses option (a), (b) or (c) in section 9.                                                                                                       |

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

---

## Addendum A - 2026-11-17: release preparation (local commits only)

- Authorization: the owner's narrow U11 continuation of 2026-11-17. Local Git
  commits only, after preservation and security review. No push, merge,
  deployment, secret change or remote mutation.
- **Outcome: NO-GO remains.** Local release blockers B2 and B5 are resolved.
  B1, B3, B4 and B6 remain open. The controlled-KV comparison path on staging
  was found **not demonstrably safe** (A7), so it is not proposed.

### A1. Release-candidate commit and artifact

Local commits on `feat/jolpica-egress-proxy` (not pushed, not merged; `master`
untouched):

| Commit    | Subject                                                            | Content                                                                                                  |
| --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `6c46b25` | docs: add identity management design and ADRs 0029-0031            | 18 docs (design, ADRs, ADR amendments, November investigation)                                           |
| `ecab741` | docs: add identity catalog U2-U11 reports, runbook and R0 evidence | 57 paths (reports, runbook, R0 seed set, U5 examples, baselines/preservation/patches, `.gitattributes`)  |
| `e6c77e9` | feat(edge-api): add identity catalog U1-U10 (inert by default)     | 215 paths (src, tests, scripts, package files, content evidence, local harness config, `.gitattributes`) |
| `d364bb4` | chore(config): propose inert staging identity catalog (U11)        | `wrangler.toml` staging-only declaration and comment correction; 6 config/E2E test files                 |
| `6a60954` | fix(identity): anchor R0 corpus checks to the reviewed base commit | `scripts/identity/corpus.mjs` (see A3)                                                                   |

**Release candidate: `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`.** The
first candidate, `d364bb4`, failed its clean-checkout suite and is superseded
(A3).

Reproducible build procedure, executed:

```text
git worktree add --detach %TEMP%\gv-u11-rc 6a609543fd762b028e0e3b4101d2f0ce9e851ce0
cd %TEMP%\gv-u11-rc\services\edge-api
npm ci
npx wrangler deploy --dry-run --env staging --outdir <evidence>\rc-6a60954-dryrun
```

- `index.js` SHA-256
  **`fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`**
  (1,662.04 KiB, gzip 294.44 KiB), wrangler 4.112.0.
- The same hash comes from this worktree, and the clean checkout stays at 0
  `git status` lines after `npm ci` and the build.
- The dry-run lists four DO bindings (`PROVIDER_RATE_LIMITER`,
  `SEASON_PUBLICATION_SEQUENCER`, `RECONCILIATION_LEDGER`, `IDENTITY_CATALOG`),
  KV `1d0fb554…`, and the identity vars bundled/off/off with the proposed UUID.

Variables and offline tooling are not part of the bundle, so the hash is
the same for `d364bb4`, `6a60954` and the preflight's uncommitted-tree build. The deployable identity is the commit plus this hash.
The uploaded bundle must be checked against it at deploy time.

### A2. Commit hygiene, security review and preservation

- **Exact lists reviewed before each commit.** `git diff --cached --check` is
  clean for every commit.
- **Security scan of all 290 candidate paths:**
  - no private keys and no GitHub/AWS/Google/Slack-style tokens;
  - no plaintext credential assignments;
  - bearer literals only in synthetic tests (`synthetic-local-u7-operator`);
  - credential fixtures are generated in tests or deliberately invalid;
  - the local harness UUID is a synthetic pattern;
  - the only e-mail address (`admin@jolpi.ca`) was already committed.
- **Never staged:** credential stores, `.dev.vars`, `.wrangler/` (logs,
  runtime SQLite/KV state), evidence folders.
- **Deliberately left untracked:** `docs/operations/identity-u8-evidence.json`
  and `identity-u8-evidence-final.json`. Both are unchanged local evidence, but
  they contain absolute local temp paths with the Windows user name, and the
  origin repository is **public**. Their hashes remain in the U8-U10
  preservation records. The owner may decide later whether to redact a copy.
- **`.gitattributes`:**
  - identity evidence JSON, patches and the proposal diff are now
    `-text -whitespace`. The preservation records hash these files, so line
    endings must not be converted; the patches legitimately contain
    trailing-space context lines.
  - LF rules were added for `*.cjs`, `*.mts` and `*.cts`. Only the new files
    use these extensions, so clean checkouts reproduce generated-schema bytes.
- **Staged bytes:** every evidence, report and code file was byte-identical
  between index and working tree. The only differences were `.gitattributes`
  and `.prettierignore` (tracked text files, normalized as before).
- **Preservation after commits 1-3:**
  - all 289 originally inventoried paths are byte-identical;
  - 1,540 of the 1,541 U10-recorded files are byte-identical;
  - the one difference is the deliberate `.gitattributes` change;
  - the U10 acceptance log is unchanged
    (`be94fa9e…68ef326`, 6,381 / 6 / 0), retained as historical evidence.
- **Known whitespace note:** `wrangler.identity-local.toml` (U2 local harness)
  ends with a blank line. It was committed byte-exact instead of being edited.
- No reset, clean, stash, rewrite, push or merge. `wt-ui-redesign` was not
  accessed.

### A3. Release-candidate validation

**The full-suite validation of the release candidate is NOT complete.**

| Run / check                                                                                      | Tree                                          | Result                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full suite, clean checkout, `npm test -- --maxWorkers=1 --testTimeout=30000`, machine kept awake | `d364bb4`                                     | **FAILED**: 10 tests failed and 24 files failed to load; 6,145 passed, 237 skipped (file-level failures turn into skips); 638 s; exit 1. Log preserved: `rc-d364bb4-full-suite-FAILED.log`, SHA-256 `ec5e2125be4abef28a6cb5bd50fb75a94fd72f2866dbfc6845b0cc0e37def7b0`.                                                                                |
| Root cause                                                                                       | -                                             | `scripts/identity/corpus.mjs` compared R0 sources with a floating `HEAD`. Once the November evidence was committed, every corpus load refused with "Historical evidence changed without review". This latent defect was hidden while all work was uncommitted. It would also have made R0 manifest provenance drift with `HEAD`.                       |
| Fix                                                                                              | `6a60954`                                     | Anchored to the reviewed base commit `027da5d` (the `baseCommit` of every reviewed manifest source), with an ancestry check. No comparison relaxed, no test or data changed.                                                                                                                                                                           |
| R0 regeneration after fix                                                                        | `6a60954`                                     | `seed.json`, `manifest.json`, `parity.json` **byte-identical** to the reviewed set.                                                                                                                                                                                                                                                                    |
| The 24 previously failing files                                                                  | `6a60954`                                     | **24 files, 241 tests passed**, `--maxWorkers=1 --testTimeout=30000`.                                                                                                                                                                                                                                                                                  |
| Full suite, clean checkout, same command                                                         | `6a60954`                                     | **INTERRUPTED, NO RESULT.** Started 19:11:36Z. **Claude Code stopped the run because the machine was critically low on memory** (about 3.3 GB free of 31.7 GB afterwards, held by unrelated applications). No result was printed before the stop. Partial log: `rc-6a60954-full-suite-INTERRUPTED.log`. Not restarted without the owner's instruction. |
| Config, guard and E2E-stage tests (`test/config`, inventory-policy, `test/e2e`)                  | `d364bb4` tree (identical files in `6a60954`) | 188 passed, 6 existing opt-in skips; `test/config` 139/139, including the new staging-identity test                                                                                                                                                                                                                                                    |
| Content / fixtures / OpenAPI validators                                                          | clean `6a60954`                               | 18/0, 32/0, valid                                                                                                                                                                                                                                                                                                                                      |
| Generated identity-schema freshness                                                              | clean `6a60954`                               | `compile-schemas.mjs --check` exit 0                                                                                                                                                                                                                                                                                                                   |
| Typecheck (Worker + scripts)                                                                     | clean `6a60954`                               | exit 0                                                                                                                                                                                                                                                                                                                                                 |
| ESLint, whole package                                                                            | clean `6a60954`                               | exit 0                                                                                                                                                                                                                                                                                                                                                 |
| Prettier, whole package                                                                          | clean `6a60954`                               | One warning: `.prettierrc`. **Pre-existing:** a clean Windows checkout gives it CRLF (no `eol` rule, `core.autocrlf=true`). The clean `027da5d` checkout shows the same warning; this worktree's LF copy passes. Not introduced by these commits.                                                                                                      |
| `git diff --check 027da5d 6a60954`                                                               | -                                             | One finding: `wrangler.identity-local.toml` blank line at EOF (preserved U2 bytes; A2)                                                                                                                                                                                                                                                                 |
| U10 acceptance (historical)                                                                      | U10 tree                                      | 6,381 passed / 6 skipped / 0 failed, log `be94fa9e…68ef326`, retained unchanged                                                                                                                                                                                                                                                                        |

**Required before G1:** one complete full-suite pass on a clean checkout of
`6a60954`, run when the machine has enough free memory, with the same command
and unchanged timeouts. Until then, the 6,381-test U10 result applies only to
the U10 tree, not to the release candidate.

### A4. Verified forward-recovery strategy

The first deploy of `IdentityCatalog` permanently ends `wrangler rollback`
for `1d858d56` and all earlier versions. **The pre-migration Worker is not a
usable Cloudflare rollback after that point.** Recovery is forward only:

| Recovery case                                                     | Build                                                     | Configuration                                                                                                                | Local proof (no deploy)                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 return to inert (after any later shadow/admin/compare change) | RC `6a60954` (or a later commit keeping the four exports) | Staging exactly as committed in `6a60954`: catalog `bundled`, discovery `off`, admin `off`, no inventory-mode var (= strict) | Built: RC dry-run, bundle `fb60cc64…85e3d8`, four exports, four DO bindings, bundled/off/off                                                                                                                                                                                                               |
| R-2 containment (catalog object unreachable, data kept)           | Same code                                                 | As R-1, but the `IDENTITY_CATALOG` binding removed; `[env.staging.exports.IdentityCatalog]` kept                             | Built from the clean RC with a scratch config: four exports kept, `IDENTITY_CATALOG` absent, no migrations. Bundle `732c609e…` is **byte-identical to the RC after normalizing build-root path labels** (the scratch config sits outside the repository); a committed R-2 config builds from the same root |
| Forbidden                                                         | `027da5d`-era code, or any config without the export      | Removing or renaming the export deletes the class and its data; old code lacks the class                                     | Not built                                                                                                                                                                                                                                                                                                  |

Between versions that all carry the four exports, `wrangler rollback`
remains available, because there is no class change. A forward deploy of
R-1 is still the documented path, since a rollback would restore old vars
together with old code.

### A5. Proposed staging installation UUID

**`c45d60b8-a723-4b6e-8530-750592af2b94`**:

- generated with `crypto.randomUUID()` on 2026-11-17, input-free, UUID v4
  pattern checked;
- committed only as a proposal in `d364bb4` (unchanged in `6a60954`);
- not installed: no namespace and no persisted catalog exist;
- for staging alone, never for E2E or production;
- `test/config/staging-identity-catalog.test.ts` pins that only staging
  declares it, exactly once.

### A6. Responsibility and credential matrix

No assignment has been made; none is invented here.

| Role                      | Primary    | Backup                                                     | Credential / custody                                    | Status          |
| ------------------------- | ---------- | ---------------------------------------------------------- | ------------------------------------------------------- | --------------- |
| Primary staging operator  | Unassigned | -                                                          | Cloudflare deploy access; current staging `ADMIN_TOKEN` | Missing         |
| Backup staging operator   | -          | **Unassigned; a separately identified person is required** | Same                                                    | Missing         |
| Reviewer                  | Unassigned | Unassigned                                                 | Individual `reviewer` credential                        | Not provisioned |
| Activator                 | Unassigned | Unassigned                                                 | Individual `activator` credential                       | Not provisioned |
| Recovery/export custodian | Unassigned | Unassigned                                                 | Individual `reader` credential + restricted storage     | Not provisioned |
| Release approver          | Unassigned | -                                                          | Recorded approval                                       | Not recorded    |

Under PO-3 (ADR 0031 D1), one individual may hold both reviewer and
activator; review, validation and activation stay separate audited
operations. That does not remove the operational-readiness requirement for
a **separately identified backup operator** (ADR 0031 D6; runbook §1).

**Staging `ADMIN_TOKEN` (B1): unresolved.** The local DPAPI store
(`staging-admin-token.dpapi`) is unchanged since 2026-09-13, i.e. no current
token has been provided. The three authorized GETs were therefore **not
re-run**: repeating them with a known-stale token would only add refused
requests. Once the owner places the current token in that store, only these
three run:

```text
staging-admin-get.ps1 -Op CutoverStatus
staging-admin-get.ps1 -Op SyncStatus
staging-admin-get.ps1 -Op Inspect
```

No hold, drain or mutation follows from them.

### A7. Controlled comparison plan

**Requested approach examined:** controlled KV source on staging under an
existing operator hold, with active operations drained. Verified against RC
code:

| Requirement                | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging-only configuration | `CONTROLLED_PROVIDER_SOURCE = "kv"` is admitted only with `ENVIRONMENT=staging` and `PROVIDER_MODE=coordinated` (`resolveControlledProviderSource`); staging qualifies. **It is a configuration error together with `JOLPICA_TRANSPORT=proxy`** (`resolveJolpicaTransport`), so the window config must also drop `JOLPICA_TRANSPORT` and `JOLPICA_PROXY_ORIGIN`, plus set `IDENTITY_CATALOG_MODE=compare` (only after R0 activation).                                                                                                                                                                                                                 |
| Source provenance          | Documents live in staging's own `GRIDVIEW_DATA` under `__controlled-source/v1/jolpica…`. Loading them is a remote KV write into the live snapshot namespace (separate prefix, unread by public routes). Documents would be built from a reviewed recorded capture with per-file hashes.                                                                                                                                                                                                                                                                                                                                                               |
| No live provider traffic   | **Verified:** `controlledSourceTransport` reads one KV key per request and never fetches; non-Jolpica URLs and non-GET answer 404, malformed documents 503 (`providers/controlled/source.ts`; `providerTransport` in `index.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| No publication             | **Verified:** a hold ends the run "before anything is prepared, reserved or sent" (`outcome/publish.ts`, `publicationStop`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Safe restoration           | A forward deploy of RC configuration (R-1) restores the proxy vars. No class change between those versions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Ledger integrity**       | **NOT SAFE.** The hold does not stop the observation commit (`observation/observe.ts`: `recordRunObservations` → `ledger.commit`). An identical re-observation increments `consecutiveConfirmations` and can settle a record (`policy/classification.ts`, T1). Ledger provenance is only `absent / reconciled`: no source or transport marker. Controlled replays would count as genuine Jolpica confirmations in the **real staging ledger**, could settle real unsettled rounds (R1 and R12 on 11-04), and would shape the next real publication after the hold is released. A differing replay would instead create candidate/competing revisions. |

**Conclusion:** the controlled-KV staging path is **not proposed**; I stopped
here as instructed. Alternatives for the owner:

1. **Recommended: offline parity against the real staging catalog.**
   - After R0 activation, obtain one authenticated read-only U5 export of the
     staging catalog (an audited read).
   - Run three complete offline generations (U7 `--catalog-export`,
     replay-only transport that throws on unrecorded URLs, fixed clocks,
     three reviewed recorded captures). Run each under bundled authority and
     under the exported staging catalog.
   - Compare request order and count, limiter reservations, resolution,
     profiles, all resource families, generated documents and publication
     eligibility.
   - Effects: zero staging ledger or KV writes, zero provider traffic.
   - It is evidence about the **staging catalog's content**, not about the
     staging Worker's runtime. Pin latency on the Worker needs a real staging
     run (option 3 or a later runtime run).
   - It departs from the literal "three compare runs on staging" in ADR 0031
     D6 / runbook §7, and needs the owner's explicit acceptance.
2. **Isolated staging-class compare Worker.** A new Worker with its own
   ledger, sequencer, KV and catalog installation, seeded from R0, using the
   controlled source. This is new infrastructure needing separate approval.
   Like E2E, it is **not** staging evidence.
3. **Accept ledger effects explicitly.** Controlled documents byte-equal to
   the latest real observations, Inspect before/after (needs B1), and the
   owner's written acceptance that confirmations may advance from replayed
   data. **Not recommended.**
4. **New diagnostic no-commit sync mode.** This changes reconciliation
   semantics and needs its own ADR and unit. Out of scope.

E2E comparisons may supplement any option, labelled as E2E evidence only.

### A8. Recovery and backup plan (prerequisites)

| Layer                             | What it is                                                                                                                                          | Covers                                                                                                     | Does not cover                                                                                                 | Status                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Revision export (U5)              | Authenticated read-only `GET /revisions/{id}/export`; `exportHash` verified; U7 `exportSha256` = that prefixed value                                | Revision lineage, evidence/decision closure, mappings, profiles, dataset commitments, installation binding | Activation history, pins, receipts, audit beyond closure, admission flags; ledger, sequencer, KV               | Procedure exists (U5/U8 local); **no staging catalog yet**                     |
| Full operational backup           | Per-store custody: catalog SQLite DO, reconciliation ledger DO, publication sequencer DO, KV snapshots, admin audit, secrets inventory (names only) | A consistent, reviewed restore point across stores                                                         | No single Cloudflare mechanism provides it; a DO's storage cannot be copied out like U8's local stopped tree   | **Not designed or rehearsed remotely**; needs custodian (B3/B4)                |
| Cloudflare platform recovery      | SQLite DO point-in-time recovery (per object, platform feature)                                                                                     | Platform-level object history within its window                                                            | Cross-store consistency, published-release reconciliation, audit continuity; never a catalog rollback protocol | **Not exercised.** Remote PITR has **not** been tested and must not be claimed |
| Forward code recovery             | A4 R-1 / R-2 builds from `6a60954`                                                                                                                  | Returning to inert/bundled behavior and containing the catalog binding                                     | State: Worker rollback is not state rollback                                                                   | **Verified locally (A4)**                                                      |
| Fresh-installation reconstruction | New UUID, namespace and credentials; U5 seed/validate/activate of R0                                                                                | Effective R0 content parity                                                                                | Original receipts, head UUID, actors                                                                           | Locally rehearsed (U8)                                                         |

Required before **runtime cutover** (not before the inert deploy):

- named custodian and backup custodian;
- restricted storage location with access list;
- a verified staging revision export and an isolated restore of it;
- a written per-store backup/restore procedure approved by the custodian;
- an explicit decision on whether PITR is part of the plan (and if so, an
  approved, evidenced exercise).

### A9. Exact proposed remote operations and approval boundaries

Each gate needs its own explicit approval naming the exact values. None is
requested by this addendum.

| Gate | Operation (from clean `%TEMP%\gv-u11-rc`, `services/edge-api`)                                                                                              | Preconditions                                                                            | Effects / irreversibility                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| G0   | The three admin GETs (A6) + `cf-read.mjs`, `resolved-vs-live.mjs`, `public-etags.mjs` (read-only)                                                           | Current token in DPAPI store (B1)                                                        | Reads only                                                                                          |
| G1   | `npx wrangler deploy --env staging` of `6a60954`; the uploaded bundle must equal `fb60cc64…85e3d8`                                                          | G0 clean (no hold/lease/uncertain intent); B3 operator + backup named; no sync in window | Creates `gridview-api-staging_IdentityCatalog`; **ends `wrangler rollback` to ≤ `1d858d56`**; inert |
| G1v  | Post-deploy reads: bindings and namespaces, KV names digest, public ETags, schedules `[]`, production/E2E unchanged, `wrangler versions view`               | G1                                                                                       | Reads only                                                                                          |
| G2   | `wrangler secret put IDENTITY_REVIEWER_CREDENTIALS --env staging`; append to `secrets.required`; deploy with `IDENTITY_ADMIN_MODE=read-only`, then `review` | Named principals (B3); secure token distribution                                         | Secret change; new versions (no class change)                                                       |
| G3   | `npm run identity -- seed`, `validate`, `activate` for R0 with the U5 reviewed wrapper; readback `status`, `revision inspect`, `export`                     | G2; reviewer and activator credentials; recovery custodian for the export (B4)           | Durable catalog state; never reseeded                                                               |
| G4   | Comparison per the owner's choice in A7                                                                                                                     | G3; A7 decision (B6)                                                                     | Depends on option                                                                                   |
| G5   | Runtime-strict cutover: operator hold, drain, deploy `IDENTITY_CATALOG_MODE=runtime`                                                                        | All design §12 preconditions; recovery plan (A8); explicit cutover approval              | Runtime authority; hold release separately approved                                                 |
| -    | Optional-driver inventory                                                                                                                                   | Separate owner decision after G5 acceptance                                              | Not proposed                                                                                        |

### A10. Updated GO/NO-GO

| Blocker                      | Status after Addendum A                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 staging admin credential  | **Open**: store unchanged; three GETs await the current token                                                                                             |
| B2 release identity          | **Identity resolved, validation pending**: `6a60954`, bundle `fb60cc64…85e3d8`; the full suite was interrupted by low memory (A3) and must pass before G1 |
| B3 human roles               | **Open**: all unassigned; separate backup operator required                                                                                               |
| B4 recovery plan / custodian | **Open** (needed before runtime cutover; A8)                                                                                                              |
| B5 staging UUID              | **Resolved as proposal**: `c45d60b8-a723-4b6e-8530-750592af2b94`, not installed                                                                           |
| B6 comparison method         | **Open, re-scoped**: controlled-KV on staging not safe; owner chooses an A7 alternative                                                                   |

**Decision: NO-GO for G1.** G1 becomes approvable once (1) the full suite
passes on a clean `6a60954` checkout, (2) B1 is cleared (G0 clean), and (3) B3
names a primary and a backup operator. B4 and B6 gate later
steps (G3-G5), not the inert deploy. Nothing in this addendum authorizes
any remote operation.

---

## Addendum B - 2026-11-17: release-candidate acceptance and comparison-policy proposal

- Authorization: the owner's U11 continuation for release-candidate
  verification only. **NO-GO remains for every remote change.**
- Nothing was pushed, merged, deployed, provisioned, synchronized or sent to
  a provider. No secret was changed. The release-candidate source was not
  altered.

### B1. Clean release-candidate acceptance: PASSED

| Item                 | Value                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree                 | Clean detached checkout of **`6a609543fd762b028e0e3b4101d2f0ce9e851ce0`** (`%TEMP%\gv-u11-rc`), 0 status lines before and after                                                                               |
| Command              | `npm test -- --maxWorkers=1 --testTimeout=30000` (same as U10 run 3); timeouts, deadlines and assertions unchanged                                                                                            |
| Conditions           | Machine kept awake (`SetThreadExecutionState`); 17.7 GB free at start and 17.9 GB at end (the interrupted run had about 3.3 GB); CPU about 20 %, no competing build or test workload                          |
| Time                 | 20:30:05Z - 20:40:41Z, Vitest 634.96 s                                                                                                                                                                        |
| Result               | **6,386 passed, 6 existing opt-in skips, 0 failed**; 315 files passed, 3 skipped (318); **exit 0**                                                                                                            |
| Log                  | `identity-u11-rc-6a60954-acceptance.log` (in the RC checkout's ignored `.wrangler/`), copy `rc-6a60954-full-suite-ACCEPTANCE.log`, SHA-256 `4ab3fd4ae039fda63c3a1bd3767eae8d3101273d6be7ad75a7aa6a28a3cea876` |
| Count reconciliation | U10 6,381 + 5 tests in the new `test/config/staging-identity-catalog.test.ts` = 6,386; 317 + 1 files = 318                                                                                                    |

Earlier runs are retained unchanged as evidence:

- `d364bb4` **failed**: log SHA-256 `ec5e2125…def7b0`;
- `6a60954` **interrupted** (low memory): log SHA-256 `4bd9e86b…`.

The U10 acceptance (6,381 / 6 / 0, `be94fa9e…68ef326`) remains the U10
tree's result. The static checks from A3 (validators, schema freshness,
typecheck, ESLint) were run on this same clean tree and still apply. Prettier's
only warning remains the pre-existing CRLF `.prettierrc` of a Windows checkout.

### B2. R0 seed-loader provenance (independent verification)

`scripts/identity/corpus.mjs` compares against the constant
`R0_REVIEWED_BASE_COMMIT = 027da5da59bf6b8c75a3fc432ef4fdc691772528`, the
`baseCommit` of every reviewed manifest source, never `HEAD`. It refuses when
that commit is not an ancestor of `HEAD`. No comparison was relaxed.

Checks in a separate throwaway worktree at `6a60954`, using the real seed
tool (`evidence/r0-provenance-checks.json`, script `tamper_checks.py`):

| Case                                                                                         | Result                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Authentic regeneration                                                                       | exit 0; `seed.json`, `manifest.json`, `parity.json` **byte-identical** to the reviewed set |
| Canonical driver profile changed (`drivers.mock.json`)                                       | **Refused**: `Unreviewed source change`                                                    |
| Typed mapping retargeted (`provider-mappings.development.json`)                              | **Refused**: `Unreviewed source change`                                                    |
| Historical evidence identity altered                                                         | **Refused**: `Historical evidence changed without review`                                  |
| Contradictory extra acknowledgement (invented key)                                           | **Refused**: `Historical evidence changed without review`                                  |
| One of the four pending November keys removed                                                | **Refused**: `Incomplete pending November evidence`                                        |
| `HEAD` moved to a commit that does not descend from `027da5d` (throwaway detached HEAD only) | **Refused**: `git merge-base --is-ancestor 027da5d… HEAD` failed; no output written        |

The throwaway worktree was restored after each case, its package junction
removed first, then the worktree itself. The RC checkout stayed clean, with
its packages intact.

### B3. Deployable artifact versus documentation commits

- **Deployable source: `6a60954`.** A fresh `wrangler deploy --dry-run
--env staging` on the clean checkout reproduces `index.js`
  **`fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`**, the
  third identical build.
- **Documentation-only commits after it:**
  - `433c35c` (Addendum A) changes only this report;
  - the commit recording Addendum B adds this addendum, the comparison-policy
    proposal and `identity-u11-preservation.json`.

  Neither touches `services/`, `content/` or app code. Either may be the
  repository tip, but the deployment must name `6a60954` and its bundle hash.

### B4. Comparison policy: proposed amendment (not accepted)

[GridView_Identity_Catalog_U11_Comparison_Policy_Proposal.md](GridView_Identity_Catalog_U11_Comparison_Policy_Proposal.md)
proposes exact amendment text for ADR 0031 D6 and runbook §7. Three
independent offline catalog-parity comparisons (captures `2026-10-07`,
`2026-10-13`, `2026-10-19`, against a verified U5 export of the active staging
revision) would replace writing controlled replays into the authoritative
staging ledger. Staging-specific checks S1-S7 remain mandatory. It states what
the offline checks prove (catalog content and output parity under the deployed
code) and what they do not (live pin path, deadlines, fail-closed behavior on
Cloudflare, binding, restart). **ADR 0031 and the runbook are unchanged**, and
the staging comparison gate stays unmet until the owner decides.

### B5. Preservation evidence

New file `docs/operations/identity-u11-preservation.json` (no earlier record
modified). It contains:

- the RC commit, bundle hash and build procedure;
- the six local commits;
- all three full-suite runs with log hashes;
- the R0 provenance results;
- SHA-256 of the two deliberately untracked U8 evidence files;
- blob hashes of all 296 files changed from `027da5d` to `6a60954`.

### B6. GO/NO-GO and remaining conditions for the first inert staging deployment (G1)

**Decision: NO-GO.** Release-candidate validation is now complete: B2 is
resolved (`6a60954`, `fb60cc64…85e3d8`, 6,386 / 6 / 0). G1 still requires,
all verified rather than assumed:

1. **B1, staging `ADMIN_TOKEN`: unresolved.** The local DPAPI store is
   unchanged since 2026-09-13. After the owner provisions the current token
   there, run only the three read-only GETs (G0). They must show no operator
   hold or durable block, the lease released, no uncertain verification or
   batch intent, and no pending publication recovery. Repeat the Cloudflare,
   resolved-config, KV and public-ETag reads and confirm they are unchanged.
2. **B3, people: unresolved.** A named primary staging operator, a
   **separately identified backup operator**, and a recorded release
   approver. Under PO-3, one person may hold reviewer and activator, but that
   does not replace the backup operator.
3. **An explicit G1 approval naming** commit `6a60954`, bundle
   `fb60cc64…85e3d8` and UUID `c45d60b8-a723-4b6e-8530-750592af2b94`. It must
   also accept that creating `IdentityCatalog` permanently ends `wrangler
rollback` to `1d858d56` and earlier, with forward recovery R-1/R-2 (A4) as
   the only recovery path.
4. Deployment window conditions: no synchronization, schedules `[]`, uploaded
   bundle equal to the recorded hash, post-deploy reads G1v.

These gate later steps, not G1, and remain **unresolved**:

- B4: recovery and backup custodian, and the per-store backup plan (G3, G5);
- B6: the comparison-policy decision (G4);
- individual reviewer/activator credentials (G2).

Optional-driver inventory is not proposed. Production is untouched.

---

## Addendum C - 2026-11-21: single-operator staffing decision and staging exception proposal

- Authorization used: documentation and approval proposal only. No remote
  environment was read or changed in this addendum. Nothing was deployed,
  rotated, provisioned, activated, synchronized, pushed or merged. No provider
  was contacted.
- Release candidate unchanged: `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`,
  bundle `fb60cc64…85e3d8`, acceptance 6,386 / 6 / 0 (Addendum B). This
  addendum touches only `docs/operations/`.
- Full proposal:
  `GridView_Identity_Catalog_U11_Solo_Operator_Exception_Proposal.md`
  (exception **SOE-1**, PROPOSED, not accepted).

### C1. Staffing decision (recorded)

Product-owner decision of 2026-11-21: GridView has **one operator**. The
**product owner** is the **primary staging operator** and the **staging
release approver**. **No separate backup operator is available**, and none
is named or invented.

Reviewer, activator and recovery/export custodian stay **unassigned**. PO-3
allows one authorized individual to hold reviewer and activator, but that is
not an assignment, and no credential exists or is created.

### C2. Backup-operator requirements: not met, not waived

Requirements X1-X10 in proposal section 2 (ADR 0031 D6 opening rule and its
reviewer, activator and backup-recovery rows; runbook §1 backup column and
availability text; U5 guide provisioning text; U8 closing text; this
report's §4, §16 B3, A6, A8, A9, A10 and B6 item 2) **remain unmet**. None is
marked satisfied. ADR 0031 and the runbook are not edited; proposal
section 9 gives the note to add below each requirement if SOE-1 is accepted.

### C3. Updated role and credential matrix

| Role                      | Primary                                 | Backup                                                | Credential / custody                                    | Status                                |
| ------------------------- | --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| Primary staging operator  | **Product owner** (decision 2026-11-21) | **None available.** Requirement unmet; SOE-1 proposed | Cloudflare deploy access; current staging `ADMIN_TOKEN` | Assigned; token **not verified** (B1) |
| Staging release approver  | **Product owner** (decision 2026-11-21) | -                                                     | Recorded approval per gate                              | Assigned; no gate approved            |
| Reviewer                  | Unassigned                              | Unassigned (X2 unmet)                                 | Individual `reviewer` credential                        | Not provisioned (G2)                  |
| Activator                 | Unassigned                              | Unassigned (X3 unmet)                                 | Individual `activator` credential                       | Not provisioned (G2)                  |
| Recovery/export custodian | Unassigned                              | Unassigned (X4 unmet)                                 | Individual `reader` credential + restricted storage     | Not provisioned (G3, B4)              |

### C4. Tiers and compensating controls (summary)

- **Read-only G0 checks:** already authorized (A6, A9). They may run with a
  valid staging token and **do not depend on SOE-1 acceptance**.
- **Tier A (G0, G1, G1v):** SOE-1 would allow G1 and G1v without a backup
  operator, only once accepted, inside a controlled no-sync window
  (proposal §3.2), under compensating controls CC-1 to CC-9 and CC-11: verified forward
  recovery on the day, credential custody with offline account recovery,
  complete hashed operation logs, approval records committed before each
  window (8-hour gap proposed for irreversible steps), holds/drain checks and
  safe stopping points, durable receipts, a written recovery card, mechanical
  before/after cross-checks, a private continuity note, and scope
  containment for E2E and production.
- **Tier B (G2, G3, G4):** needs role assignment, CC-10 (PO-3: separate
  authenticated review and activation operations, separate operation IDs and
  receipts, separate credential IDs per role proposed), and an explicit SOE-1
  extension.
- **Tier C (G5 runtime cutover, optional-driver activation):** not covered.
  Needs B4 in full and either a named backup or a new, separate exception.
  SOE-1 ends when G5 approval is requested, or on 2027-02-28 at the latest.
- **Production:** excluded; §18 checklist unchanged.

Residual risks RS-1 to RS-8 (proposal section 6) are **pending
product-owner review; none is accepted**.

### C4a. Corrections after owner review (2026-11-21)

The owner reviewed SOE-1 and found it acceptable in principle for Tier A
only. **That is not formal acceptance** of SOE-1 or of RS-1 to RS-8. Three
corrections were made, in the proposal and here:

1. **Empty schedules do not prove that nothing runs unattended.** Verified:
   no cron trigger on 2026-11-17, so `scheduled()` is not invoked. Not
   excluded: HTTP-triggered synchronization, ingest, verification, cutover,
   rollback and purge through the admin routes for any holder of the current
   `ADMIN_TOKEN`; other Cloudflare principals; work admitted before the
   window (proposal §3.1, paths P1-P7). G1 therefore requires a documented
   controlled no-sync window with pre- and post-window reads and abort
   conditions (proposal §3.2). No production or runtime logic was added or
   changed.
2. **Staging token recovery (B1).** If the current token is available through
   authorized secure custody, it is placed in the existing encrypted local
   store without being shown. If it is not, a staging-only rotation is a
   remote mutation that needs its own explicit authorization. It is **not
   done**. A rotation would create a new deployed staging Worker version, so
   the preflight baselines and every approval record naming the active
   version would have to be refreshed (proposal §7.1).
3. **RS-3** no longer reads as accepted. The read-only G0 checks may be run
   with valid credentials without SOE-1 acceptance; SOE-1 acceptance is a
   prerequisite for G1 only.

### C5. Updated blocker status

| Blocker                      | Status after Addendum C                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| B1 staging admin credential  | **Open.** Not verified; G0 GETs not run. Recovery routes in proposal §7.1; rotation not authorized                               |
| B2 release identity          | **Resolved** (Addendum B)                                                                                                        |
| B3 human roles               | **Re-scoped, open.** Operator and release approver recorded. Backup unmet; for G1 it depends on SOE-1 acceptance. G2+ roles open |
| B4 recovery / custodian      | **Open** (G3, G5)                                                                                                                |
| B5 staging UUID              | **Resolved as proposal**, not installed                                                                                          |
| B6 comparison method         | **Open** (G4)                                                                                                                    |
| B7 single-operator exception | **New, open.** SOE-1 proposed; needs explicit owner acceptance                                                                   |

### C6. GO/NO-GO

**Decision: NO-GO for G1.** It stays NO-GO until all of proposal section 7.2
holds:

1. B1: the current `ADMIN_TOKEN` is in the DPAPI store (from authorized
   custody, or after a separately authorized rotation with refreshed
   baselines) and the three G0 GETs return 200;
2. G0 read-only checks pass (no hold or block, lease released, no uncertain
   intent, no pending publication recovery, Cloudflare/config/KV/ETag reads
   unchanged, live versions and schedules `[]` as recorded). These checks do
   not need SOE-1 acceptance;
3. SOE-1 and RS-1 to RS-8 are explicitly accepted by the product owner;
4. the role record in C3 stands;
5. Tier A compensating-control evidence exists;
6. a separate G1 approval names `6a60954`, `fb60cc64…85e3d8` and
   `c45d60b8-a723-4b6e-8530-750592af2b94` and accepts the rollback floor;
7. the controlled no-sync window (proposal §3.2) is recorded, its pre- and
   post-window reads are clean and no abort condition occurs.

This addendum requests no approval for any remote operation and authorizes
none.

---

## Addendum D - 2026-11-21: owner acceptance of SOE-1 (Tier A only)

- Authorization used: documentation only. No remote environment was read or
  changed. Nothing was deployed, rotated, activated, synchronized, pushed or
  merged.
- Release candidate unchanged: `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`,
  bundle `fb60cc64…85e3d8`, UUID `c45d60b8-a723-4b6e-8530-750592af2b94`,
  acceptance 6,386 / 6 / 0 (Addendum B).

### D1. Owner decision (recorded)

The product owner, as GridView's sole operator, on 2026-11-21:

- **accepts SOE-1** for Tier A gates **G0, G1 and G1v only**, as revised in
  commit `d50301e`;
- **explicitly accepts residual risks RS-1 to RS-8** within that limited
  scope;
- acknowledges that backup-operator requirements **X1, X6, X9 and X10 remain
  unmet**, neither satisfied nor waived for other environments or gates;
- keeps **CC-1 to CC-11 mandatory** at their specified gates, including the
  **eight-hour separation** before an irreversible operation (required for
  G1);
- confirms the expiry: documented conditions, at the latest **2027-02-28**.

Recorded in: SOE-1 §10 (status now ACCEPTED, Tier A only); ADR 0031 (header
and a note under D6); runbook §1 (note below the ownership text). The
original backup requirements in ADR 0031 D6 and runbook §1 are unchanged.
Addendum C is left as written: it records the proposal stage.

### D2. Updated blocker status

| Blocker                      | Status after Addendum D                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 staging admin credential  | **Open.** Not verified; G0 GETs not run. Rotation not authorized                                                                                                  |
| B2 release identity          | **Resolved** (Addendum B)                                                                                                                                         |
| B3 human roles               | **Resolved for Tier A only** by SOE-1: operator and release approver recorded; backup unmet and excepted for G0/G1/G1v. Reviewer, activator, custodian open (G2+) |
| B4 recovery / custodian      | **Open** (G3, G5)                                                                                                                                                 |
| B5 staging UUID              | **Resolved as proposal**, not installed                                                                                                                           |
| B6 comparison method         | **Open** (G4)                                                                                                                                                     |
| B7 single-operator exception | **Resolved for Tier A**: SOE-1 accepted 2026-11-21. Not applicable beyond G1v                                                                                     |

### D3. GO/NO-GO

**Decision: NO-GO for G1.** The owner's acceptance authorizes **no** gate: not
G1, catalog activation, runtime cutover, optional-driver inventory, a
production change, credential rotation, deployment or synchronization. G1
stays NO-GO until:

1. the current staging `ADMIN_TOKEN` is verified (B1; proposal §7.1);
2. G0 passes (proposal §7.2 item 2), which needs no further acceptance;
3. compensating-control evidence for Tier A is complete (CC-1 to CC-9 and
   CC-11, including the controlled no-sync window plan and an approval record
   committed at least eight hours before execution);
4. the owner separately approves the exact irreversible deployment, naming
   `6a60954`, `fb60cc64…85e3d8` and `c45d60b8-a723-4b6e-8530-750592af2b94`
   and accepting the rollback floor.

---

## Addendum E - 2026-11-21: staging `ADMIN_TOKEN` investigation and G0 readiness

- Authorization used: read-only investigation of the existing credential and
  local records; G0 preparation. **No request was sent to staging or any
  other remote service** in this addendum. The known-401 credential was not
  retried. No secret was printed, logged, copied or committed. Nothing was
  deployed, rotated, synchronized or published.
- Release candidate `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`, bundle
  `fb60cc64…85e3d8`, UUID `c45d60b8-a723-4b6e-8530-750592af2b94`, SOE-1
  (accepted, Tier A) and CC-1 to CC-11 are unchanged. The backend suite was
  not re-run: no implementation or configuration changed.
- Local evidence folder (outside the repository): `identity-u11-g0-2026-11-21`
  under the existing GridView evidence directory.

### E1. Verified facts

| #   | Fact                                                                                                                                                                                                                                                                                                                                          | Source                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| F1  | The staging DPAPI store exists, is 262 bytes, was created and last written on 2026-09-13 18:27:44Z, and its folder grants Full Control to the current Windows user only (no inherited entries).                                                                                                                                               | File metadata and ACL, read 2026-11-21                     |
| F2  | The store **decrypts** under the current user. The value has base64url characters and at least 32 characters. Only these two properties were output.                                                                                                                                                                                          | In-memory check; value discarded                           |
| F3  | The store was written by the 2026-09-13 recovery-window rotation and was then recorded as the only copy of the live token.                                                                                                                                                                                                                    | 2026-09-13 operation record; staging runbook rotation note |
| F4  | On 2026-11-05 at 19:15Z the same store, with the same Bearer construction, authenticated: `POST /internal/admin/sync/full` returned **200** on version `de0dc58a`.                                                                                                                                                                            | 2026-11-05 run record and script                           |
| F5  | On 2026-11-17 at 18:18Z the three G0 GETs returned **401** with the Worker's own `UNAUTHORIZED` envelope (request IDs recorded), on version `1d858d56`.                                                                                                                                                                                       | 2026-11-17 evidence                                        |
| F6  | Admin authentication (`src/admin/auth.ts`) compares the whole `Authorization` header with `Bearer <ADMIN_TOKEN>` in constant time, and returns 401 if the secret is empty. The file is unchanged since phase 5A, so the 401 is not an authentication-scheme change.                                                                           | `git log` of `auth.ts`                                     |
| F7  | The G0 helper targets the staging Worker's workers.dev host, sends GET only to `/internal/admin/publication/cutover/status`, `/internal/admin/sync/status` and `/internal/admin/reconciliation` (each `?season=2026`), and uses the same Bearer scheme. It matches the routes in `027da5d` and `6a60954`.                                     | Helper source and route constants                          |
| F8  | Version `de0dc58a` (2026-11-05, `upload`) had secret `ADMIN_TOKEN` only. Version `deabb568` (2026-11-12 18:27:04Z, `upload`) had `ADMIN_TOKEN` and `JOLPICA_PROXY_TOKEN`. Version `1d858d56` (18:48:40Z, `triggered_by: secret`) has the same two names and the **same script etag** `5a55c1b4…5864`.                                         | `wrangler versions view` output of 2026-11-17              |
| F9  | The proxy activation procedure (`services/jolpica-proxy/deploy/staging.md`) adds `JOLPICA_PROXY_TOKEN` through `wrangler deploy --secrets-file`, keeps `ADMIN_TOKEN`, and says **not** to run a separate `secret put` or rotate the admin token. A separate secret-only version (`1d858d56`) nevertheless exists 21 minutes after the upload. | Procedure text; F8                                         |
| F10 | The operator-reported 2026-11-12 proxy synchronization was run through an admin route, so a valid `ADMIN_TOKEN` existed and was used that day.                                                                                                                                                                                                | 2026-11-12 investigation report                            |
| F11 | No other DPAPI store or admin-token file exists in the GridView project folders or the GridView credential folder. No repository commit or document records an `ADMIN_TOKEN` change on 2026-11-12.                                                                                                                                            | Bounded file search; `git log --all` 11-11 to 11-14        |

### E2. Conclusions and hypotheses

- **Established:** the value held in the store no longer matches the staging
  Worker's `ADMIN_TOKEN` (F2, F4, F5, F6). The secret value changed between
  2026-11-05 19:15Z and 2026-11-17 18:18Z. The only staging versions in that
  interval are `deabb568` and `1d858d56` (F8).
- **Not established:** which deployment changed it, or which value it now
  holds. Version metadata gives secret names, not values or a per-secret
  change log.
- Hypotheses, unverified:
  - **H1 (most consistent):** the 18:48Z secret-only version replaced
    `ADMIN_TOKEN` (for example, a `secret put` because the stored value was
    not to hand during the proxy session), contrary to F9.
  - **H2:** the 18:27Z `--secrets-file` deploy included an `ADMIN_TOKEN`
    entry with a new value, and the 18:48Z version re-put
    `JOLPICA_PROXY_TOKEN`.
  - **H3:** some other value change at 18:48Z, such as an empty or mistyped
    `ADMIN_TOKEN`. F6 would give 401 in that case too.
- Under every hypothesis, **the current value exists only where the 2026-11-12
  operator kept it, if anywhere** (F10, F11). That is outside the GridView
  workflow folders I am authorized to inspect, so I did not search further.

### E3. Credential status

**B1: OPEN. The current staging `ADMIN_TOKEN` is not available in authorized
local custody.** The existing store is intact but holds the superseded
2026-09-13 value. G0 cannot run yet.

### E4. Outcome A, prepared: you supply the current value

Three local scripts, none run, in the evidence folder:

- `store-candidate.ps1`: SHA-256 `1d84b096…2db7`;
- `g0-admin-get.ps1`: SHA-256 `cc4e5af8…f7aa`;
- `promote-candidate.ps1`: SHA-256 `bbf5ef70…1f57`.

1. **Owner, in their own PowerShell window:** `store-candidate.ps1`. The
   value is entered hidden (`Read-Host -AsSecureString`), checked (non-empty,
   no whitespace, at least 32 characters), DPAPI-protected for the current
   user and written as a separate candidate file. The existing store is
   untouched and nothing is printed.
2. `g0-admin-get.ps1 -TokenFile candidate`: one `CutoverStatus` GET first;
   **any non-200 stops everything, with no retry**. Then `SyncStatus` and
   `Inspect`. Status lines and response bodies go to the evidence folder.
   Bodies hold operational state, not credentials.
3. If all three return 200: `promote-candidate.ps1` makes the candidate the
   standard store. It renames, not deletes, the superseded store.
4. Then the remaining G0 reads: `cf-read.mjs`, `resolved-vs-live.mjs`,
   schedules, `public-etags.mjs` and the KV names digest, compared with the
   2026-11-17 baseline.
5. G0 passes only if all of these hold: no operator hold or durable block,
   lease released, no uncertain verification or batch intent, no pending
   publication recovery, and every comparison unchanged. In particular, the
   active version must still be `1d858d56`. Anything else is reported, and
   **no mutation follows**.

### E5. Outcome B, proposed for separate approval: staging-only rotation

Use this only if the current value cannot be recovered from an authorized
source. **Not approved, not prepared as a script, not performed.**

| Item                 | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operation            | `wrangler secret put ADMIN_TOKEN --env staging` from a clean worktree's `services/edge-api`, Worker `gridview-api-staging` only. No code upload. `JOLPICA_PROXY_TOKEN`, vars and bindings untouched.                                                                                                                                                                                                                                                      |
| Value handling       | Generated in memory from 32 bytes of a cryptographic RNG, encoded as unpadded base64url (43 characters). It is **first** DPAPI-stored as the candidate, then passed to Wrangler on standard input. It never appears in arguments, environment variables, files, history, logs, chat or Git.                                                                                                                                                               |
| Remote effect        | Cloudflare creates and deploys at 100% a **new staging Worker version** (`triggered_by: secret`) with the same script etag `5a55c1b4…5864`, bindings, vars and secret names. The current value stops working immediately for every holder. No class or migration change. E2E and production are not touched.                                                                                                                                              |
| Rollback note        | A `wrangler rollback` to `1d858d56` would restore the previous secret value along with it. Fixing a bad value means rotating again, not rolling back.                                                                                                                                                                                                                                                                                                     |
| Single-operator note | SOE-1 covers G0, G1 and G1v only. This rotation concerns the legacy shared token (ADR 0009), not catalog provisioning (ADR 0031 D6). The approval should still state explicitly that the product owner performs it alone.                                                                                                                                                                                                                                 |
| Preconditions        | Approval record naming the operation and window. Controlled window in the style of SOE-1 §3.2, with no admin calls or deploys in it. Pre-reads: deployment list (active still `1d858d56`, nothing newer), versions view of the active version (two secret names, script etag), schedules `[]` for staging, E2E and production, public ETags and KV digest unchanged from 2026-11-17, and Wrangler signed in to the expected account.                      |
| Abort before the put | Any newer version or changed secret names, non-empty schedules, changed ETags or KV digest, a wrong account, or a candidate-store failure. Nothing has changed at that point.                                                                                                                                                                                                                                                                             |
| Validation after     | `g0-admin-get.ps1 -TokenFile candidate`: one `CutoverStatus` GET. If 401, allow one re-check after 30 seconds for propagation, then stop. Then the full G0 and promotion as in E4.                                                                                                                                                                                                                                                                        |
| Refreshed baselines  | The new version ID replaces `1d858d56` everywhere it is the expected active version. Re-record versions view (same script etag), resolved-versus-live (no drift), the downloaded bundle hash (must still equal the `027da5d` build `7415b82d…`), KV digest, ETags and schedules. The G1 approval, recovery card and NSW-1 baseline must name the new version, and the G1 rollback-floor statement becomes "ends rollback to the new version and earlier". |

### E6. Updated blockers and GO/NO-GO

| Blocker                     | Status after Addendum E                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| B1 staging admin credential | **Open.** Store intact but superseded; current value not in authorized custody. Outcome A ready; outcome B proposed, not approved |
| B3 human roles              | Resolved for Tier A only (Addendum D)                                                                                             |
| B4, B6                      | Open (G3-G5, G4)                                                                                                                  |

**Decision: NO-GO for G1**, unchanged. G0 has not run.

**Next owner action (exactly one of these):**

1. If you hold the current staging `ADMIN_TOKEN` in an authorized secure
   source: run `store-candidate.ps1` yourself and tell me. I then run E4 steps
   2-5, read-only.
2. If you do not: approve, or decline, the E5 staging-only rotation as a
   separate remote mutation. If you approve, name the window.

### E7. Staging `ADMIN_TOKEN` rotation, 2026-11-21: executed; authentication NOT verified

Owner authorization: an explicit GO for one staging-only
`wrangler secret put ADMIN_TOKEN --name gridview-api-staging`, run from an
empty scratch directory with the value supplied from a DPAPI candidate on
stdin, plus verification steps 1-7. No other remote mutation was performed.
The token value was never displayed, logged or committed.

**Method chosen and why.** The classic `secret put` is one server-side call,
`PUT …/workers/scripts/gridview-api-staging/secrets`. Cloudflare copies the
deployed version and changes only that secret, which is the mechanism that
produced `1d858d56`. It was run from an empty directory, where no Wrangler
configuration resolves (verified), so the U11 `wrangler.toml` was never
read. `wrangler versions secret put` was **rejected**: Wrangler 4.112
re-uploads the modules with `exports` undefined, while the live runtime
declares three Durable Object exports. How deploying such a version would
reconcile those classes is not verifiable, and the ledger and sequencer
data depend on them.

| Time (UTC)  | Step                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16:21       | Candidate generated locally: 32 bytes from the OS CSPRNG, 43-character base64url, DPAPI CurrentUser, separate file, previous store untouched | OK                                                                                                                                                                                                                                                                                                                                                                                       |
| 16:28:03    | Step 1 read-only preflight compared with the approved baseline (16:19)                                                                       | **No differences**: active and latest `1d858d56`, script etag `5a55c1b4…5864`, `index.js` `7415b82d…`, three DO exports, 14 bindings with identical var values, secret names `ADMIN_TOKEN` and `JOLPICA_PROXY_TOKEN`, settings, DO namespaces, no `IdentityCatalog`, KV 3,982 keys `59624265…ccfc6`, schedules `[]` x3, E2E `6b52bc02`, production `62bf40e9`                            |
| 16:28:26    | In-memory safeguard on the candidate                                                                                                         | Non-empty, exactly 43 base64url characters, decodes to 32 bytes; 43 bytes written to stdin                                                                                                                                                                                                                                                                                               |
| 16:28:26-29 | `secret put`, executed once                                                                                                                  | Exit 0, empty output (`WRANGLER_LOG=warn` hides the success line), so **ambiguous**. Not repeated                                                                                                                                                                                                                                                                                        |
| 16:28:43    | Authoritative state read                                                                                                                     | **One new version `986cf8a2-89a3-4654-8000-67d751dcc8b6`** (number 23, `triggered_by: secret`) at 100%, deployment `96be14aa-f3a2-48de-84bf-d0adaea1530c`. Everything else equals the preflight: script etag, `index.js` hash, handlers, exports, compatibility, bindings and var values, secret names, settings, DO namespaces, KV, schedules, E2E and production. No `IdentityCatalog` |
| 16:29:06    | One `CutoverStatus` GET with the candidate                                                                                                   | **HTTP 401. Stopped**; no retry, no `SyncStatus` or `Inspect`, no promotion                                                                                                                                                                                                                                                                                                              |
| after       | Public routes                                                                                                                                | 14/14 return 200, ETags identical to 2026-11-17                                                                                                                                                                                                                                                                                                                                          |
| after       | Token-value scan (count only) of the evidence folders, the session scratchpad and Wrangler's log folder                                      | 298 files, **0** contain the value                                                                                                                                                                                                                                                                                                                                                       |

**Root cause (verified locally with a dummy value, no remote request).** On
this machine the console input code page is 65001, UTF-8 with a 3-byte
preamble. Windows PowerShell's `Process.StandardInput` is a `StreamWriter`
in that encoding, and it wrote the preamble (`EF BB BF`) before the raw
bytes the script wrote to the underlying stream. A local echo of 43 dummy
bytes through the identical procedure received 46 bytes, starting with
`efbbbf`. Wrangler removes only trailing whitespace. The staging secret is
therefore, with near certainty, U+FEFF followed by the candidate (44
characters), which no Bearer header matches. The safeguard validated the
candidate and the byte count written, but not what the channel added.

**Current state.**

- Staging serves version `986cf8a2` with unchanged code, configuration and
  data.
- Its admin routes are unusable for every holder: the unknown 2026-11-12
  value no longer works, and the new value was stored with the leading BOM.
- No cron or other automatic path depends on `ADMIN_TOKEN` (§3.1 of SOE-1).
  Public routes are unaffected.
- A `wrangler rollback` to `1d858d56` would restore the unknown 2026-11-12
  value, so it is not a recovery path.
- B1 remains **open**. The candidate is kept, not promoted. The previous
  store is unchanged and still invalid.

**Refreshed G0 baseline (Cloudflare and public parts only).**

- Active staging version `986cf8a2…` (replaces `1d858d56` as the expected
  active version).
- Script etag `5a55c1b4…5864`; `index.js` `7415b82d…`.
- Exports, bindings and var values, and secret names as above.
- KV 3,982 keys, digest `59624265…ccfc6`.
- Schedules `[]` on all three Workers; E2E `6b52bc02`, production `62bf40e9`.
- Public ETags as on 2026-11-17.
- The admin part (holds, blocks, lease, intents) is **still unread**.

**Proposed correction (needs a new explicit GO, not run).**
`rotate-put-v2.ps1` repeats the same single `secret put` with the **same
candidate value**, with two changes:

- it sets a BOM-less UTF-8 input encoding before starting Wrangler; a local
  dummy echo then receives exactly 43 bytes with no preamble;
- immediately before the real call, it self-tests the exact channel with a
  dummy value and aborts unless exactly `43:414141` comes back.

It also logs at `log` level, so Wrangler's success line is visible. The
expected effect is one more `triggered_by: secret` version with everything
else unchanged. Then: one `CutoverStatus` GET, stopping on non-200; then
`SyncStatus`, `Inspect`, promotion and the remaining checks, as in the
original plan.

Local scripts (outside the repository), SHA-256:

| Script                                  | SHA-256         |
| --------------------------------------- | --------------- |
| `generate-candidate.ps1`                | `dabadbfd…b10e` |
| `staging-state.mjs`                     | `0917fc56…feda` |
| `rotate-put.ps1` (v1, as executed)      | `24961614…0d8b` |
| `rotate-put-v2.ps1` (proposed, not run) | `19574b7a…b016` |

**G1 remains NO-GO.** No U11 deployment, catalog provisioning,
synchronization, provider or proxy request, publication, other secret
change, E2E or production change, push or merge occurred.

### E8. Corrective `ADMIN_TOKEN` rotation, 2026-11-21: B1 RESOLVED; G0 PASSED

Owner authorization: an explicit GO for exactly one corrective staging-only
`wrangler secret put ADMIN_TOKEN --name gridview-api-staging`, using the
existing candidate and the reviewed `rotate-put-v2.ps1`, followed by
read-only verification. One mutation was performed. The token value was
never displayed, logged, committed or transmitted.

**Pre-execution safeguards (all passed):**

1. **Target:** exactly `gridview-api-staging` (fixed in the script's
   arguments; account fixed; empty run directory, so no Wrangler config).
2. **Live state (16:57:31Z):** **no difference** from the recorded `986cf8a2`
   state (version active and latest, script etag, code hash, exports,
   bindings and var values, secret names, settings, DO namespaces, KV,
   schedules, E2E, production).
3. **Script digest:** full SHA-256 of `rotate-put-v2.ps1` =
   `19574b7a0c30fbaa0cf50a1ed73c45bc90f0f1cc20e84d4071962098eccdb016`,
   equal to the approved digest.
4. **Script review:** one remote-capable call (Wrangler `secret put`, fixed
   arguments). Otherwise only local DPAPI decryption, validation and a local
   echo test. No code upload, deploy, config read, other secret, provider
   contact or retry.
5. **Candidate:** 43 base64url characters, decodes to 32 bytes (booleans only
   output).
6. **Channel:** standalone test with a mixed dummy value through the
   identical mechanism (BOM-less input encoding, `Process.Start`, raw
   stream write): 43 bytes sent and 43 received, byte-identical, no BOM, no
   trailing newline. The script's own self-test gave `43:414141`.

**Execution:** 16:57:54-56Z, one call. Wrangler exit **0**, output
`Creating the secret for the Worker "gridview-api-staging"` and
`Success! Uploaded secret ADMIN_TOKEN`. 43 bytes were written to stdin.

**Authoritative result:** exactly **one** new version,
**`bc9b9315-c228-42cc-b406-9892ad601034`** (number 24,
`triggered_by: secret`), at **100%**, deployment
`59913912-53f4-4793-89e6-d12f1bad8cc4`, created 16:57:55Z.

- Unchanged against the pre-execution state: script etag `5a55c1b4…5864`,
  `index.js` `7415b82d…`, handlers, the three DO exports, compatibility,
  all 14 bindings with var values, secret names (`ADMIN_TOKEN`,
  `JOLPICA_PROXY_TOKEN`), script settings, DO namespaces.
- No `IdentityCatalog`. KV 3,982 keys, digest `59624265…ccfc6`.
- Schedules `[]` for staging, E2E and production. E2E `6b52bc02` and
  production `62bf40e9` unchanged.
- Secret values cannot be read back. `JOLPICA_PROXY_TOKEN`'s name is
  retained, and the secrets API call names only `ADMIN_TOKEN`.

**Admin verification (G0), 16:58:31-32Z, new token:**

| GET                                     | HTTP    | Finding                                                                                                                                                                                           |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CutoverStatus`                         | **200** | `state: active`, `phase: activate`, `admissionClosed: false`, `authoritative: true`, active `pm1-000000000001d-aed72435`, previous `pm1-000000000001c-a82904e2`, fingerprint `cutover1:38f72606…` |
| `SyncStatus`                            | **200** | Legacy sync record: last completed 2026-10-13T03:18:04Z, no failure, no skipped jobs; last publication `pm1-000000000001b-cbcf2628` applied                                                       |
| `Inspect` (reconciliation, season 2026) | **200** | `seasonRecordVersion 11`; operator hold **none**; durable block **none**; publication disposition and due time **none**; lease **released**; backlog 0/60 `normal`                                |

Across all 20 rounds there are no markers, terminal reasons, candidate,
staged or competing corrections, dispositions or verification activity. So
there is **no unresolved hold, block, lease, uncertain operation or pending
publication recovery**. Informational only: rounds 18 and 19 are
`unsettled` with observed content never published, and round 20 is
`absent`. This is consistent with the 2026-11-12 sync whose publication was
withheld. `publishedReconciliation` is `pm1-000000000001d-aed72435`, at
2026-11-12T19:15:33Z.

**Other checks:**

- Public routes: 14/14 return 200 with ETags identical to 2026-11-17.
- Token-value scan of the evidence folders, session scratchpad, Wrangler
  log folder and `docs/operations`: 378 files, **0** matches.

**Credential custody:** after all three GETs authenticated and the checks
passed, the candidate was promoted.

- The standard DPAPI store's ciphertext equals the former candidate's.
- It decrypts to 43 characters (boolean output only).
- The candidate file no longer exists.
- The 2026-09-13 store is kept as
  `staging-admin-token.OBSOLETE-from-20260913-superseded-20261121.dpapi`,
  ciphertext unchanged, invalid on staging.

**B1: RESOLVED.** The current staging `ADMIN_TOKEN` is in authorized custody
and verified.

**Refreshed G0 baseline (2026-11-21 16:58Z).** Every G1 approval, recovery
card and NSW-1 check must name this version:

- **staging active version `bc9b9315-c228-42cc-b406-9892ad601034`**;
- script etag `5a55c1b4…5864`, `index.js` `7415b82d…` (the `027da5d` build);
- bindings and var values as on 2026-11-17;
- secrets `ADMIN_TOKEN` (new) and `JOLPICA_PROXY_TOKEN`;
- KV 3,982 keys `59624265…ccfc6`; public ETags as on 2026-11-17;
- schedules `[]` x3; E2E `6b52bc02`, production `62bf40e9`;
- admin state as in the table above.

The G1 rollback-floor statement becomes: creating `IdentityCatalog` ends
`wrangler rollback` to `bc9b9315` and every earlier version. Versions
`986cf8a2` and `1d858d56` carry superseded `ADMIN_TOKEN` values and are not
recovery targets.

Scripts (local, outside the repository): `rotate-put-v2.ps1` (as executed)
`19574b7a…b016`; `staging-state.mjs` `0917fc56…feda`.

**GO/NO-GO.** G0 has **PASSED**. **G1 remains NO-GO.** Still required:

- compensating-control evidence for Tier A (CC-1 to CC-9 and CC-11,
  including the no-sync window plan and the recovery card, both naming
  `bc9b9315`);
- an approval record committed at least eight hours before execution;
- the owner's separate approval of the exact irreversible deployment
  (`6a60954`, `fb60cc64…85e3d8`,
  `c45d60b8-a723-4b6e-8530-750592af2b94`, rollback floor `bc9b9315`).

Nothing else happened: no U11 deployment, catalog provisioning,
synchronization, publication, provider or proxy request, other secret
change, E2E or production change, push or merge.

---

## Addendum F - 2026-11-21: formal SOE-1 acceptance and G1 readiness

- Authorization used: documentation and local `--dry-run` builds only. No
  remote change. G1 remains **NOT AUTHORIZED**.
- Release candidate `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`, bundle
  `fb60cc64…85e3d8`, UUID `c45d60b8-a723-4b6e-8530-750592af2b94` and the
  6,386 / 6 / 0 acceptance are unchanged.

### F1. Owner decision

SOE-1 was formally accepted, effective 2026-11-21, for staging Tier A only
(G0, G1 subject to its own authorization, G1v).

- RS-1 to RS-8 were accepted individually (SOE-1 §11).
- The product owner is primary staging operator and staging release
  approver. No backup operator exists.
- X1, X6, X9 and X10 remain unmet and are excepted for Tier A only.
- Expiry at the latest 2027-02-28, with no automatic extension.
- ADR 0031 D6 and runbook §1 already carry the narrow exception note
  (`b055dcb`); their requirements are unchanged.
- The offline-comparison policy proposal stays pending.

### F2. Clarifications reconciled

- **A, empty schedules:** SOE-1 §3.1 and §3.2 distinguish cron triggers
  from HTTP-triggered and manual paths, and define the controlled no-sync
  window.
- **B, token:** the corrective rotation succeeded and G0 passed (E8). No
  further rotation is required or authorized. History is kept: `1d858d56`
  (prior), `986cf8a2` (failed authentication, BOM), `bc9b9315` (current).
- **C, RS-3:** recorded as accepted on 2026-11-21. Read-only G0 checks do
  not require SOE-1; G1 requires its formal acceptance.

### F3. G1 readiness

Packet: `GridView_Identity_Catalog_U11_G1_Readiness.md` (`f04146c`).

- Baseline and rollback boundary: `bc9b9315-c228-42cc-b406-9892ad601034`.
  Existing reconciliation observations (rounds 18-19 unsettled, round 20
  absent) are left untouched.
- R-1 `--dry-run` reproduced `fb60cc64…85e3d8` on 2026-11-21. R-2 is
  byte-identical to R-1 after build-path normalization. Its raw hash
  depends on where the scratch config sits; it is `c4714402…7953` from the
  pinned location.
- RC config vs live: only the four `IDENTITY_*` vars, the `IdentityCatalog`
  export and the `IDENTITY_CATALOG` binding are added.
- Unsigned G1 authorization text: packet section 6.

### F4. Remaining blockers for G1 (NO-GO)

1. Owner attestation for CC-2: Cloudflare MFA enabled and recovery codes
   stored offline. Codes are not to be shared.
2. CC-9 private continuity note.
3. The separate G1 approval, recorded and committed. The eight-hour interval
   starts only then.
4. Deployment-day work: CC-1 rebuilds, NSW-1 reads, log and manifest.

---

## Addendum G - 2026-11-21: owner attestations, CC-9, final G1 packet

- Authorization used: documentation and read-only checks. No mutation.
  G1 remains **NOT AUTHORIZED**.
- **Owner attestations (2026-11-21), recorded as statements only:** Cloudflare
  MFA is enabled; account recovery codes are stored securely outside the
  computer. No secret or code was requested, inspected or recorded. The
  product owner remains sole operator and staging release approver under
  SOE-1.
- **CC-9:** the private continuity note exists outside the repository, in
  the GridView private operations directory. It contains no secrets and is
  readable by the owner's account.
- **Fresh read-only checks, 19:26-19:27Z:** Cloudflare state identical to
  E8 (`bc9b9315` active and latest; no `IdentityCatalog`); G0 GETs 200 with
  bodies identical to E8; public ETags unchanged; E2E and production
  unchanged.
- **Baseline references:** sections 4-16 and Addenda A-D name `1d858d56`
  as the staging version. Those statements were correct when written and
  are kept as history. From E8 onward the verified pre-G1 baseline and
  rollback boundary is **`bc9b9315-c228-42cc-b406-9892ad601034`**. The
  readiness packet and SOE-1 use it.
- **Readiness:** `GridView_Identity_Catalog_U11_G1_Readiness.md` revision 2
  holds the control status (sections 5-7) and the final unsigned approval
  record with objective abort conditions (section 8). The only remaining
  blocker is the owner's explicit G1 approval, committed, followed by at
  least eight hours.

---

## Addendum H - 2026-11-21: G1 approved and window amended; G2-G5 prepared

- **G1 approval:** `GridView_Identity_Catalog_U11_G1_Approval.md`, commit
  `c9022a4` (19:32:53Z). **Amendment 1** (commit `254f40f`, 19:48:25Z)
  sets the window to **2026-11-22 11:00-12:00 UTC**; scope is unchanged.
  - CC-4: eight hours from each commit end at 03:32:53Z and 03:48:25Z.
  - **Earliest valid deployment: 11:00:00Z.**
  - Supervised session only. No deployment after 12:00Z without a new
    window.
- **Deployment-day preparation:** readiness packet §9 and a private
  evidence folder holding the command sequence, operation log and manifest
  script.
  - Recovery cards C1-C8 and the R-1/R-2 procedures are unchanged.
  - R-1 and R-2 expected hashes: `fb60cc64…` and `c4714402…7953`.
- **Incident, 19:33:54Z, no remote effect:** while the assistant was
  updating a local note, shell command substitution ran
  `npx wrangler deploy --env staging` in a directory with no Wrangler
  config.
  - Wrangler stopped during local project detection; its debug log has no
    Cloudflare API request.
  - Read-only state at 19:34:22Z was identical to 19:26Z: staging still
    `bc9b9315`, only the three GridView Workers, no Pages projects.
  - Prevention: notes are written with file tools, never shell-quoted
    prose.
- **G2-G5:** `GridView_Identity_Catalog_U11_G2_G5_Preparation.md`
  (proposals only):
  - the role proposal and SOE-1-B extension text;
  - the credential and config procedure;
  - the R0 sequence, custody and restore;
  - G4 capture integrity: 2026-10-07, 2026-10-13 and 2026-10-19 verified,
    22/23/23 files, 0 mismatches;
  - the G5 checklist and optional-inventory and production dependencies.
    Nothing accepted or executed.
- **G1 readiness:** no new finding changes it.

---

## Addendum I - 2026-11-22: G1 executed and verified (G1v)

Live session supervised by the product owner. Approval `c9022a4` plus
amendment `254f40f`; window 11:00-12:00 UTC. Exactly one remote mutation:
the approved deploy. Sanitized operation log, scripts, raw outputs and
`SHA256SUMS` are in the private evidence folder
`identity-u11-g1-2026-11-22` (42 files; manifest SHA-256
`35d065f803e4ed70cd06414642ac0b2739821c335f4cfea9f23ac015a7283989`). The
folder holds no credential or e-mail address (scanned).

### I1. Outcome

| Item                  | Value                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- |
| Result                | **G1 deployed and verified; no deviation in scope; no recovery card used**             |
| Worker                | `gridview-api-staging`, account `786e24f1…e6bf`                                        |
| Replaced version      | `bc9b9315-c228-42cc-b406-9892ad601034` (#24)                                           |
| **New version**       | **`13c3a90c-4fd8-4794-9fd6-efaf4f950bb6`** (#25, 100%, `triggered_by: upload`)         |
| **New deployment**    | **`fdaf88d1-8581-4bfe-acc6-f024f259391b`**, created 2026-11-22T11:00:57Z               |
| Command               | `npx wrangler deploy --env staging --outdir <evidence>/deploy`, once, exit 0, no retry |
| Executed              | 11:00:46Z-11:01:01Z, from `$TEMP/gv-u11-rc/services/edge-api`                          |
| Owner presence        | Explicitly confirmed in-session after the window opened, before the command            |
| Reconciliation output | `Created: IdentityCatalog`; no `Deleted`, no `Renamed`                                 |
| New DO namespace      | `541e9043dfeb4e46aa9362fd198bae5a` (`gridview-api-staging_IdentityCatalog`, sqlite)    |

Rollback note (accepted in the approval): ordinary Cloudflare rollback to
`bc9b9315` or any earlier version is now unavailable. Recovery is
forward-only through R-1 or R-2.

### I2. Preparation (A1-A7, from 10:22Z)

- Approval and amendment verified: commits at 19:32:53Z and 19:48:25Z;
  both eight-hour separations elapsed; scope unchanged.
- Release-candidate checkout at `6a609543…`, 0 changes; only the ignored
  `.wrangler/` cache; no `.dev.vars`. Wrangler 4.112.0; account verified.
- R-1 dry-run `fb60cc64…85e3d8` (match). R-2 dry-run `c4714402…7953`
  (match), byte-identical to R-1 after path-label normalization (0 diff
  lines). Both export all four DO classes. R-2 has three DO bindings (no
  `IDENTITY_CATALOG`), as designed.
- Cards C1-C8 reviewed. The three preflight scripts were read and are
  GET-only.

### I3. NSW-1 preflight (G0)

Run at 10:30Z, then refreshed at 10:50:14Z-10:50:33Z, so it was valid at
upload (within 30 minutes). Both runs passed.

- `staging-state.mjs` vs the readiness baseline: **0 differing fields**.
  Covered: active `bc9b9315`; main module `7415b82d…`; three exports; 14
  bindings; two secret names; settings; namespaces; KV 3,982 keys with
  digest `59624265…`; schedules `[]` x3; E2E `6b52bc02`; production
  `62bf40e9`.
- Admin GETs (standard token): CutoverStatus, SyncStatus and Inspect all
  return HTTP 200, with bodies identical except the per-request
  `requestId`. Findings:
  - no operator hold, no durable block;
  - no publication disposition or due time, no last operator action;
  - lease `released`, backlog 0;
  - rounds 1-17 published, 18-19 unsettled and unpublished, 20 absent;
  - last sync 2026-10-13.
- Public endpoints: 14/14 status and ETag identical.
- Comparator note: the first raw ETag and admin-body comparisons flagged
  per-request fields only (`requestId`; on `/v1/status`, `generatedAt` and
  `snapshotAgeSeconds`). Normalizing comparators that remove only those
  fields were added to the evidence and used for every later check.

### I4. Artifact verification

- Deploy output `index.js` = `fb60cc64…85e3d8`, byte-identical to the
  same-day R-1 rebuild.
- Remote main module of `13c3a90c`: SHA-256 `fb60cc64…85e3d8`, 1,701,933
  bytes, single part, entrypoint `index.js`.

### I5. G1v results (11:01Z)

| Check              | Result                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active version     | `13c3a90c` at 100%, the latest uploaded                                                                                                                                                         |
| Exports            | Four, all sqlite: the three previous ones unchanged, plus `IdentityCatalog`                                                                                                                     |
| Bindings (by name) | 14 → 19; 0 removed; 0 changed. Added: `IDENTITY_CATALOG` (DO), `IDENTITY_CATALOG_MODE=bundled`, `IDENTITY_DISCOVERY_MODE=off`, `IDENTITY_ADMIN_MODE=off`, `IDENTITY_INSTALLATION_ID=c45d60b8-…` |
| Inventory          | No inventory-mode variable (strict)                                                                                                                                                             |
| DO namespaces      | The eight existing ones unchanged (IDs, classes, scripts); one new `IdentityCatalog` namespace                                                                                                  |
| Unchanged          | Secret names, script settings, compatibility date `2026-07-01`, handlers `fetch`/`scheduled`                                                                                                    |
| KV                 | 3,982 keys, digest unchanged; no mutation                                                                                                                                                       |
| Schedules          | `[]` on staging, E2E and production                                                                                                                                                             |
| E2E / production   | Unchanged                                                                                                                                                                                       |
| Admin GETs         | 3x HTTP 200; bodies identical to the baseline (`requestId` excluded): no sync, publication, hold, block or lease change                                                                         |
| Public ETags       | 14/14 identical                                                                                                                                                                                 |
| Catalog inactive   | Bundled authority, discovery off, admin off (binding values). Identity admin routes deliberately not probed. No seed, validation or activation                                                  |
| Forward recovery   | R-1 bundle equals the deployed bundle; R-2 builds with all four exports and keeps data. Both remain valid against `13c3a90c`                                                                    |

### I6. Deviations and incidents

None affecting scope or remote state. Only the comparator refinement in
I3. No retry, no recovery deployment, no other remote write.

### I7. Acceptance and next gate

- **G1 meets every condition of the signed approval and can be formally
  accepted by the owner.** It stays pending owner acceptance. This report
  records the evidence; it does not accept.
- **New staging baseline:** `13c3a90c`, with deployed code `fb60cc64…`.
  Every later gate compares against the G1v snapshot, not `bc9b9315`.
- **G2 is NOT ready to execute.** Per G2-G5 preparation §6 it still needs:
  - formal G1 acceptance;
  - acceptance of the role proposal (§1.1) and of the SOE-1 Tier B
    extension (§1.2);
  - an approved, signed G2 packet;
  - authorization of the G2 configuration commit and credential
    provisioning.
    SOE-1 still covers Tier A only. Nothing for G2-G5 was executed.

---

## Addendum J - 2026-11-22: G1 accepted; owner decisions D0-D11

- **D0, G1 accepted** by the product owner. The new staging baseline is
  `13c3a90c-4fd8-4794-9fd6-efaf4f950bb6` (bundle `fb60cc64…`), with
  comparisons against the G1v snapshot. Addendum I and the G1 approval
  record are kept as they are, with an execution and acceptance note
  appended.
- **Decisions recorded** (owner message, 2026-11-22):
  - D1: three role credentials (reviewer, activator, reader), all held
    by the owner. Local generation only.
  - D2: SOE-1-B accepted **in principle only**. The full RB-1..RB-3
    wording goes into the P1 packet for express acceptance, and nothing
    is marked accepted until then.
  - D3: the owner is the primary recovery/export custodian, with
    restricted local storage and two encrypted copies, one of them
    offline. Completion must be shown with evidence before any gate
    depends on it.
  - D4: offline comparison policy adopted for G4. ADR 0031 and runbook
    amendments are applied, and S1-S7 stay mandatory.
  - D5: local tasks L1-L9 authorized. L10 and L11 are proposals only.
  - D6: P1 (G2+G3) and P2 (G5) may each be a combined packet with a
    stop on any failure. The G3 eight-hour wait still applies, and hold
    release needs a separate live confirmation.
  - D7: export artifacts plus SQLite Durable Object PITR as a
    supplement, which is not a consistent cross-store backup.
  - D8: G5 single-operator exception to be drafted, not accepted.
  - D9: a stability criterion to propose (three meaningful runtime
    runs), not authorized.
  - D10: production single-operator exception to be drafted, not
    accepted.
  - D11: eight hours from approval to execution for optional-driver
    activation.
- **Still not authorized:** any remote step of P1-P4.

---

## Addendum K - 2026-11-22: P1 local preparation complete (no remote change)

Under owner decisions D0-D11. Nothing remote was changed. Staging stays on
`13c3a90c`.

- **Local commits** (not pushed):
  - `3f7b1c8`: G1 acceptance and decisions;
  - `09e774b`: tooling and tests;
  - `2ad2427`: G2a config;
  - `faa9113`: G2b config;
  - `bc4b4af`: exact-seed rehearsal mode;
  - `4022155`: review fixes;
  - this docs commit: the D4 amendments to ADR 0031 and runbook §7, the S6
    to R-4 correction, the P1 packet and the recovery/G5/production
    proposals.
- **Finding D12 (blocks P1 until decided).** A seed by a credential without
  `reviewer` produces an export the offline verifier refuses. That blocks G4,
  the S3 restore check and future runtime batches, permanently. It is
  reproduced and pinned in `role-split.test.mjs`. Recommended: a single-use
  bootstrap seed credential (P1 packet §1).
- **Finding PITR.** Durable Object PITR is reachable only from inside each
  class. No GridView class implements it. It needs code before it can serve
  as a recovery supplement (D13).
- **Evidence:** `~/.gridview/evidence/identity-u11-p1-prep-2026-11-22/`.
  - Credentials: three role credentials plus the D12 bootstrap candidate,
    DPAPI-stored, verified through the Worker's own `authenticate()`.
  - Seed review file v2 `afba0282…`.
  - Full rehearsal of that exact file: export, S3, parity 0 findings on
    3/3 captures, accounting 3/3.
  - Custody and GnuPG rehearsals.
  - R-3 and R-4 at normalized `fb60cc64…`.
- **Acceptance:** 6,415 passed / 11 skipped / 0 failed on clean `4022155`.
  Independent review: no CRITICAL or HIGH; MEDIUM items fixed.
- **Next:** the owner signs P1 (`GridView_Identity_Catalog_U11_P1_Packet.md`
  §9), then the 8-hour wait, then the supervised session. P2-P4 remain
  separate.

---

## Addendum L - 2026-11-22: P1 executed (G2, G3) and G4 completed

Executed under owner amendment A1 (`ed034b7`), with the owner available
throughout. Evidence: `~/.gridview/evidence/identity-u11-p1-2026-11-22/`
(manifest `84f14724…`).

### L1. Remote mutations (8, each once, each verified)

| Step                                  | Time (UTC) | Result                                                                                                            |
| ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| M1 secret V3 (`b6de09a8…`)            | 15:49:22   | version `3ab185f4` (secret); only the `IDENTITY_REVIEWER_CREDENTIALS` secret added                                |
| M2 deploy G2a `2ad2427`               | 15:50:11   | version `88548205`; bundle `fb60cc64…`; no export reconciliation; only admin → `read-only`                        |
| M3 deploy G2b `faa9113`               | 15:51:29   | version `83d77cc2`; only admin → `review`                                                                         |
| M4a secret V4 (`f43640c2…`)           | 15:52:34   | version `2c8ba6fb` (secret); bootstrap authenticates after propagation                                            |
| M4 seed (bootstrap, file `afba0282…`) | 15:53:33   | proposal `3bc0c7b8-9300-4076-99d2-12ec677e167d`, catalog `8a2a62d8…`, receipt `committed`                         |
| M4r secret V3 (revocation)            | 15:54:32   | version `59a882a0` (secret); bootstrap 401, reader/reviewer/activator 200; local bootstrap token deleted 15:55:12 |
| M5 validate (activator)               | 15:55:28   | `valid: true`, no issues, report `bb01e0c8…`, receipt `committed`                                                 |
| M6 activate (activator)               | 15:55:57   | active sequence 1, revision `3bc0c7b8-…`, projection `ab953da8…`, dataset `2026.10.07.1`, receipt `committed`     |

### L2. Verification

- Preflight: state identical to G1v, G0 identical, 14 ETags identical.
- Authorization checks:
  - G2a: A1 401, A2 200, A3 403 `IDENTITY_WRITES_DISABLED`, A4R 404, A5
    refused locally, A7 unchanged.
  - G2b: A6 403 `ROLE_REQUIRED`, and A1/A4/A4R 401.
- After every step: code `fb60cc64…`, exports, KV (3,982 keys,
  `59624265…`), settings, schedules `[]` x3, E2E and production unchanged.
  G0 bodies and 14 ETags identical throughout.
- **Nothing was published.**
- Export: `sha256 732f905e…`, `exportHash 9b6f2e69…`, 1,611,640 bytes.
  - S3 restore passed: exact R0 and identical snapshot in a new
    installation; 94 bindings, 101 evidence, 7 unresolved; dossier
    non-synthetic, created by a credential holding `reviewer`.
  - Custody: `~/.gridview/custody/identity-staging` (ACL, owner,
    protected), with a DPAPI copy.
  - **Offline GnuPG copy: pending (the owner's step).**
- G4 against the real export, from the clean RC `6a60954`:
  - parity 0 findings on 2026-10-07, 2026-10-13 and 2026-10-19 (116, 117,
    117 documents), both sides deterministic;
  - accounting 3/3 identical (22/23/23 requests, Jolpica reservations
    equal, reference equals the verified export).

### L3. Deviations (expectation corrections; no state deviation)

- **A1 with admin `off`** returns 503 `CATALOG_UNAVAILABLE` (the
  `configured()` check), not 404 as the packet and a `wrangler.toml`
  comment said.
- **A4 in `read-only`:** the shared `ADMIN_TOKEN` reaches the U2
  discovery-health compatibility read (GET only, `identity-routes.ts`).
  Catalog routes stay unreachable (A4R 404), and in `review` it gets 401.
- **Secret propagation:** the first bootstrap read about 1 s after M4a
  returned 401. After propagation it returned 200. Later checks waited for
  the new version.
- The CLI output was summarized, so no seed payload was printed or kept.

### L4. Status

- Staging is on `59a882a0`: admin `review`, catalog R0 active, authority
  `bundled`.
- G3 complete. G4 comparisons pass. **G4 acceptance waits only for the
  offline-copy evidence.**
- G5 stays blocked (recovery, Recovery proposals §2.3).

---

## Addendum M - 2026-11-22: G5 recovery implemented and drilled in isolation

Under amendment A1. Staging was not mutated: it was only read (the KV
snapshot). Evidence:
`~/.gridview/evidence/identity-u11-g5-recovery-drill-2026-11-22/`.

### M1. Storage backend

All four staging Durable Objects are **SQLite-backed**: exports have
`storage: sqlite` and namespaces `use_sqlite: true`. Cloudflare PITR is
therefore available for each of them. None is a legacy KV-backed object.

### M2. Implementation (local commits, not deployed to staging)

- **`7e2ebf4`:** in-object PITR commands and an `ADMIN_TOKEN`-authenticated
  `POST /internal/admin/recovery`, for IdentityCatalog, ReconciliationLedger
  and SeasonPublicationSequencer.
  - Commands: bookmark, bookmark-for-time (30 days), schedule-restore (only
    against the exact current bookmark; returns the undo bookmark), restart.
  - Restore and restart are refused unless `RECOVERY_RESTORE=enabled`. No
    committed configuration sets it.
- **`8a5d018`:** Workers KV snapshot, restore and verify tool.
  - Per-key SHA-256 over value, metadata and expiration.
  - Restore refuses the snapshot source, every committed namespace and an
    unconfirmed target.
- **Tests:**
  - handler and route units (10);
  - end-to-end through the real Worker and objects in Miniflare (3:
    routing, addressing, auth, gate, stale-bookmark refusal);
  - KV tool units (4).
  - Targeted suites for the touched classes and admin: 1,010 passed.

### M3. Isolated drill on Cloudflare

- **Drill Worker:** `gridview-recovery-drill`, version `191349d9`.
  - Own new SQLite Durable Object namespaces (4).
  - Own KV namespace `a1dfe9f1d35549829c160743bfecbabf`.
  - Own throwaway secrets and installation `61fe817b-…`.
  - `PROVIDER_MODE=coordinated` with the controlled KV source, no
    schedules, `RECOVERY_RESTORE=enabled` (drill only).
- **Method, per store:** bookmark B0, visible change, bookmark B1, restore
  to B0 (expected B1), restart, verify; then restore the undo bookmark,
  restart, verify.

| Store                                       | Change                                                                                       | After restore to B0              | After undo                                       | Verdict  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------ | -------- |
| ReconciliationLedger                        | operator hold (record v0 → v1)                                                               | no hold, v0                      | hold, v1                                         | **pass** |
| SeasonPublicationSequencer                  | cutover genesis (uninitialized → genesis)                                                    | uninitialized                    | genesis                                          | **pass** |
| IdentityCatalog, including durable receipts | validation of the R0 proposal (seed receipt committed, validate receipt unknown → committed) | seed committed, validate unknown | both committed                                   | **pass** |
| Workers KV (staging data)                   | snapshot of staging, 3,982 keys (`df568003…`), restored into the drill namespace             | —                                | verify: identical, 0 missing, 0 changed, 0 extra | **pass** |

Restoring the KV snapshot onto staging itself was refused by the tool
(`target-is-snapshot-source`).

### M4. What is and is not recoverable

- **Recoverable and drilled:** catalog content, receipts and audit rows (one
  SQLite store, by PITR, plus the verified export and S3 reconstruction);
  ledger and sequencer state (PITR, 30-day window); KV content (snapshot).
- **Not demonstrated separately:** catalog run pins. They live in the same
  catalog SQLite store that PITR restored, but bundled mode creates none,
  so no pin was exercised.
- **Not recoverable by GridView:**
  - Cloudflare-persisted operational logs. Their retention is set by the
    platform.
  - Point-in-time KV history. Only the snapshot moments exist, so a snapshot
    must be taken immediately before each gate.
- **Consistency:** PITR is per object and approximate in time, and the KV
  snapshot is separate. A coordinated restore needs a hold, bookmarks for
  all three objects and a KV snapshot taken together, restored in the order
  catalog, ledger, sequencer, then KV. It is never a single transactional
  backup.

### M5. Remaining before G5

1. The acceptance suite on `8a5d018` and an independent review of the
   recovery code.
2. **G5-1 config tests.** Runtime authority deliberately changes staging
   behaviour:
   - v1 batches are refused (`runtime-batch-requires-u7`);
   - the manual-batch fallback needs v2 batches from the verified export;
   - coordinated runs fail closed without an active catalog.

   Nine committed staging behaviour tests encode the bundled behaviour.
   They are being re-authored to prove the same safety properties under
   runtime. They are not being weakened.

3. Live owner confirmation for: G5-0 (deploy the recovery-capable code with
   the bundled config, then capture bookmarks and a KV snapshot), the hold,
   S6 on R-4, the runtime-strict cutover, S7, and the hold release.

---

## Addendum N - 2026-11-22: G5 runtime-strict cutover executed on staging

Each step was confirmed live by the owner (A1): steps 1-5 at about 16:51Z,
then the S6 hold release and the S7 hold release. Code `7ded2d9` passed
acceptance at 6,443 / 11 / 0 (log `f9bb922f…`). Evidence:
`~/.gridview/evidence/identity-u11-g5-2026-11-22/`.

| Step                                      | Time (UTC)        | Result                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-check                                 | 16:48-16:53       | state unchanged since P1; only the drill Worker's namespaces were new in the account list. G0 identical, 14 ETags identical. Pre-cutover KV snapshot `df568003…` (3,982 keys)                                                                           |
| Hold                                      | 16:53:34          | operation `3b5da7d4-…`, record v12. Drain check: drained, with unobservable items listed                                                                                                                                                                |
| S6: deploy R-4                            | 16:53:50          | version `1e22f172`: runtime, catalog binding removed, four exports kept, nothing else changed                                                                                                                                                           |
| S6: run under hold                        | 16:54:48          | `nothing-due / publication-stopped`, 0 provider requests. **The hold stops a run before identity admission, so S6 was not exercised** (a design error in the plan)                                                                                      |
| S6: owner-confirmed release, run, re-hold | 16:58:16-16:58:19 | **`failed / identity / catalog-unavailable`, 0 provider requests, lease released**; hold re-applied (v14). Nothing published                                                                                                                            |
| Cutover: deploy `7ded2d9`                 | 16:58:48          | version **`a379d30d`**, bundle `4595219f…`; catalog runtime, admin read-only; exports, secrets, KV, namespaces, E2E and production unchanged                                                                                                            |
| S1/S2                                     | 16:59             | catalog R0 active at sequence 1 (`8a2a62d8…`), mode read-only; A3 403 `IDENTITY_WRITES_DISABLED`, A4R 404, A1 401                                                                                                                                       |
| Pre-S7 bookmarks                          | 16:59             | catalog `00000001-00000002-0000512b-456b…`, ledger `0000001d-00000000-0000512b-aea5…`, sequencer `00000098-00000000-0000512b-4682…`                                                                                                                     |
| S7 under hold                             | 20:25:20          | `publication-stopped`, 0 requests (same limitation as S6)                                                                                                                                                                                               |
| Hold release (owner confirmed)            | 20:28:03          | record v15; no hold                                                                                                                                                                                                                                     |
| **S7: first runtime run**                 | 20:28:04-20:29:36 | **`observed`, coordination completed, 26 provider requests, observations committed, 92 s**. Events: unchanged 2, overwrite 1, refresh.failed 2, classification.check-failed 2. **Publication withheld (`classification-unavailable`), 0 publish calls** |

**State after G5:**

- Staging is on `a379d30d`, runtime-strict, with no hold and crons `[]`.
- Ledger rounds: 1-17 published; 18 and 19 unsettled; 20 and 21 absent and
  not yet classifiable.
- 14 ETags identical, active version still `pm1-…1d`. **No runtime-derived
  content has been published yet**, so no runtime-only fact exists.
- Recovery: R-4 or PITR to the bookmarks above, plus the KV snapshot. R-1 and
  R-2 stop being valid once runtime content is first published.

**Open items:**

- S7 latency per request, and the two `refresh.failed` causes (429 or
  missing data), need the Worker logs.
- D9 stability: this is the first of three genuine runtime runs. Further
  runs only when data changes, each authorized individually.
- The offline GnuPG copy of the export is still pending (the owner's step).
- The drill Worker `gridview-recovery-drill` and its KV namespace remain.
  Remove them only on the owner's decision.
- Optional-driver activation (P3) and production (P4) are separately
  confirmed and not started.

---

## Addendum O - 2026-11-22: catalog R1 (Rafael Câmara) activated on staging

Owner decision: option (c), R1 for Rafael Câmara before optional drivers.
Every remote step was confirmed live by the owner (Phase A, Phase B, and the
corrected B2). Evidence: `~/.gridview/evidence/identity-r1-camara-2026-11-22/`
(manifest `0140b5bc…`, 76 files).

### O1. Identity evidence

- **Jolpica** (public API, 3 + 3 GETs from the operator machine, bodies
  hashed): `driverId rafael_camara`, Rafael / Camara, born 2005-05-05,
  Brazilian, #51, code CAM. Round 20 (São Paulo, 2026-11-08) P20 Haas;
  round 21 (Las Vegas, 2026-11-22) P16 Haas. `gabriele_mini`,
  `freddie_slater` and `nikola_tsolov` have **no** 2026 race results
  (inventory-only).
- **Official F1:** driver page (Haas, #51, Brazil, born 05/05/2005,
  Recife), the São Paulo race result (P20, No. 51, CAM, Haas, +2 laps), and
  the 2026-11-22 Haas confirmation article.
- **Spelling:** both primary sources write "Camara". The owner chose
  "Rafael Câmara" (GridView keeps diacritics, as in Hülkenberg and Pérez),
  supported by Wikipedia, which is the URL in the Jolpica record. Profile:
  `fullName` only, every other fact null, like all 33 R0 drivers.

### O2. Blocker found and route chosen

`create-driver` requires a discovery candidate. Staging had 0 candidates
(discovery `off` since G1), and base import refuses driver creation
(`base-import-driver-creation-forbidden`). Owner-chosen route: a temporary
config with discovery `shadow` plus admin `review`, and one genuine sync
(D9 run 2, justified by the new Las Vegas data).

### O3. Remote steps

| Step                                  | Time (UTC)  | Result                                                                                                                                                                     |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-check (reads)                     | 21:03-21:05 | state 0 differences vs post-G5, 14 ETags and G0 identical; bookmarks catalog `00000004-…`, ledger `00000020-…`, sequencer `0000009b-…`; KV snapshot 3,982 keys `df568003…` |
| A1 deploy temporary config            | 21:05:51    | version `a7785c1a` (#33); only admin `review` and discovery `shadow` changed; bundle `f714253a…` = `4595219f…` after path-label normalization                              |
| A2 sync (D9 run 2)                    | 21:06:44    | observed, 26 requests, committed; withheld `classification-unavailable`, 0 publish calls; candidates for all 4 keys (Câmara: 4 real proxy observations)                    |
| B1 dossier (reviewer)                 | ~21:10      | evidence `67ef0399…`, receipt committed                                                                                                                                    |
| B2 approve-new, first attempt         | ~21:11      | **rejected** 404 `REVISION_NOT_FOUND`, no state change: `support.evidenceIds` listed provider-evidence digests; only dossiers are allowed (`catalog-record-missing`)       |
| B2 approve-new (corrected, new op ID) | 21:12:58    | proposal `8723d5ec-…`, catalog `d95ad634…`, dataset `2026.11.22.1` reserved; receipt committed                                                                             |
| B3 validate (activator)               | 21:13:55    | valid, no issues, report `1a99b24d…`                                                                                                                                       |
| B4 activate (activator)               | 21:14:12    | **R1 active, sequence 2**                                                                                                                                                  |
| B5 restore committed config `7ded2d9` | 21:14:22    | version `a504c946`; bundle `4595219f…` again; admin `read-only`, discovery `off`; A3 403 `IDENTITY_WRITES_DISABLED`                                                        |

R1 delta (preview, validation and activation all agree): +1 driver
`rafael-camara` (origin `reviewed-new`), +1 binding
`jolpica/2026/driverId/rafael_camara → rafael-camara`, its review decision
and dossier, dataset `2026.10.07.1 → 2026.11.22.1`, and `rafael_camara`
removed from unresolved. Totals: 34 drivers, 95 bindings, 6 unresolved.

### O4. Verification and recovery baseline

- After B5: Cloudflare state differs from the pre-check only in version
  IDs; 14 ETags identical; KV unchanged (`df568003…`). **Nothing published.**
- G0 `Inspect` differs only by the A2 observation commit (record versions,
  lease time, `reconciledAt`); no hold, no settlement change.
- **R1 export:** `exportHash 50defe36…`, file sha `4d78ace9…`, 1,682,489
  bytes; offline `verifyCatalogFile` passed (sequence 2, parent R0, creators
  include `reviewer`). Custody: `staging-r1-export-20261122.*` beside the
  untouched R0 files. Offline GnuPG copy of R1: pending (the owner's step).
  A seed-based S3 reconstruction does not apply to R1 (a seed cannot create a
  reviewed driver); PITR is the R1 restore path.
- **Post-R1 bookmarks:** catalog `00000006-0000004f-0000512b-9c43…`, ledger
  `00000022-00000000-0000512b-8c9d…`, sequencer
  `0000009e-00000000-0000512b-e365…`; KV snapshot `post-r1-…` (3,982 keys).

### O5. Lessons

- The admin layer maps `catalog-record-missing` to `REVISION_NOT_FOUND`,
  which misleads for a missing dossier.
- PowerShell 5.1 `Get-Content`/`Set-Content` re-encoding mangled "Câmara"
  into mojibake in a regenerated file; the live preview caught it before
  submission. Generate review files with Node or byte-safe tools only.

### O6. Status

- Staging `a504c946` (code `7ded2d9`), runtime-strict, catalog R1 active,
  admin read-only, discovery off, no hold, crons `[]`.
- The next run will still withhold under strict inventory: Mini, Slater and
  Tsolov stay unmapped in season participants. They appear in no race
  classification, so the optional-driver policy (P3) can unblock
  publication while race and standings guards stay strict.
- Candidates remain for those three keys (unresolved, not quarantined).

---

## Addendum P - 2026-11-22: optional-driver inventory (P3) activated; first runtime publication

Code `51f7667`. Each remote step was confirmed live by the owner (C1 and
C2). Evidence: `~/.gridview/evidence/identity-u11-p3-2026-11-22/`
(manifest `48e373f0…`, 37 files).

### P1. Change

- Only `[env.staging.vars]` gains `IDENTITY_INVENTORY_MODE =
"optional-drivers"`. Acceptance 37 now allows exactly that one assignment;
  production, E2E, development and every other committed config stay
  forbidden.
- New config test: the committed staging variables resolve to
  `optional-drivers` only with the catalog binding. Without the binding, or
  under bundled authority, they are a configuration error (500 on admin
  routes, including hold and release).
- **Recovery builds must drop the variable.** R-3 (strict) and R-4 (catalog
  unbound) were regenerated from `51f7667` with it removed, and both dry-run
  cleanly (`recovery/`).
- Unit tests that run the committed staging variables without a bound
  catalog keep exercising the strict policy. The runtime + optional path with
  a real catalog stays covered by `optional-inventory.test.mjs` (T23-T25,
  T24 race guard).
- Targeted verification (owner instruction, no full cycle): config,
  inventory-policy, optional-inventory integration, driver-inventory,
  catalog-v2-optional and automatic-update suites, 272 passed / 0 failed;
  eslint and `tsc --noEmit` clean.

### P2. Remote steps

| Step                   | Time (UTC)        | Result                                                                                                                                                                                                          |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 deploy `51f7667`    | 21:28:12          | version **`5ee3b49c`**; by-name comparison: only the `IDENTITY_INVENTORY_MODE` binding added; bundle `4595219f…` and script etag unchanged; 14 ETags identical                                                  |
| Pre-C2 recovery point  | 21:29             | bookmarks catalog `00000007-…b40a`, ledger `00000023-…d075`, sequencer `0000009f-…2e4c`; G0 PASS; KV 3,982 keys `df568003…`                                                                                     |
| **C2 sync (D9 run 3)** | 21:29:40-21:31:27 | observed, 27 requests (the constructors request now runs), committed; `classification.first-write` 2, `refresh.first-observation` 2; **published `pm1-000000000001e-3aa0228f`**, 1 publish call, lease released |

### P3. Publication review

- **KV:** +124 keys (the new release), 0 removed; only `meta:content-schema`
  changed. All 29 earlier releases are retained.
- **Against the previous release `…1d`:**
  - GP1-17 results are identical apart from `meta` (D14 held). 72 of 119
    common documents are data-identical.
  - New: results for GP18-21 and the driver document for `rafael-camara`.
  - Changed: standings and points, calendar `hasResults` for rounds 18-21,
    and dependent driver and constructor documents.
- **Participation (D15):** 26 → 28 entries, none removed or reassigned.
  Added `2026-rafael-camara-20` (Haas, from R20) and `2026-ryo-hirakawa-19`
  (Haas, R19 only). Esteban Ocon's entry gained `endRound 18`.
- **Câmara:** GP20 present, GP21 P16 Haas (grid 15), in driver standings;
  published name "Rafael Câmara". Mini, Slater and Tsolov are not published
  (optional inventory).
- `contentVersion` is now `2026.11.22.1`, the R1 dataset.
- Cloudflare state differs from C1 only in the KV key count and names digest.
- Post-C2 bookmarks: catalog `00000008-…1904`, ledger `00000024-…3627`,
  sequencer `000000a0-…0f3b`. Post-C2 KV snapshot: 4,106 keys `f5d7eebf…`.

### P4. Consequences and status

- **First runtime-derived publication.** R-1/R-2 (return to bundled) are
  now invalid for good. Recovery is forward-only: R-3/R-4 from `51f7667`,
  PITR to the bookmarks above, and the KV snapshots.
- D9 stability: runs 1-3 done (S7, A2, C2). Runs 1 and 2 withheld
  legitimately, run 3 published.
- Staging `5ee3b49c` (code `51f7667`), runtime catalog R1, optional-driver
  inventory, admin read-only, discovery off, no hold, crons `[]`.
- Open: the offline GnuPG copy of the R1 export (owner); the unresolved
  candidates for Mini, Slater and Tsolov (no curation needed while they stay
  inventory-only); production (P4) needs separate confirmation.

---

## Addendum Q - 2026-11-23: production (P4) prepared; nothing in production changed

Owner decision 2026-11-22: carry Rafael Câmara into the repository identity
sources before the initial production seed; staging R1 is the source of
truth. Evidence: `~/.gridview/evidence/identity-p4-production-2026-11-22/`.

### Q1. Repository identity sources (P0)

- Commits `b2c8b31`, `9477d75` and `685b57e` (the P0 anchor) add exactly:
  - driver `rafael-camara`, "Rafael Câmara" (fullName only);
  - Jolpica 2026 `driverId rafael_camara → rafael-camara`, with provenance
    citing this report (Addendum O, R1 revision `8723d5ec`);
  - the removal of its November acknowledgement; Mini, Slater and Tsolov
    stay acknowledged and unmapped;
  - dataset version `2026.11.22.1`.
- **R0 preserved.** `loadCorpus()` reads R0 from git at `027da5d` (and the
  R0 evidence file at `6d39d48`, byte-identical to R0's `9ab5c486…`), never
  the working tree. Regenerated R0 `seed.json`, `manifest.json` and
  `parity.json` are byte-identical to the committed files.
- **P0 seed** (`docs/operations/identity-seed-p0/`, `loadCorpus('p0')`,
  `seed.mjs --corpus p0`): content hash `0a1b093a…`, 34 drivers, 95
  bindings, 101 evidence, 6 unresolved. The loader refuses any P0 source
  difference from R0 other than the delta above.
- **P0 equals staging R1** in every identity field: driver IDs, profiles and
  profile hashes, all 95 key→target bindings, unresolved keys, constructors,
  circuits, events, the season projection (`bec52f09…`) and the dataset
  version. Only provenance differs: Câmara is `repository-import` (citing
  R1) instead of `reviewed-new`, and P0 carries no review decisions (no
  approval was invented).

### Q2. Code (closed, reviewed)

- The seed validator accepts exactly two corpus profiles, by dataset version:
  R0 (`2026.10.07.1`, 33/94/7, four pending keys) and P0 (`2026.11.22.1`,
  34/95/6, three pending keys, with the exact added identity and binding).
  Anything else is refused.
- Runtime admission already requires a catalog's base digest to equal the
  deployed bundled sources (`unsupported-runtime-base`), so only an
  unaltered P0 catalog can serve production.
- **Staging consequence:** staging R1 has R0's base. Before staging deploys
  this code it must import the P0 base as R2 (`import-base`, allowed:
  Câmara and his binding already exist in R1). Staging stays on `51f7667`
  until then.
- Tests follow the change. R0 stays the default fixture for the lifecycle
  mechanics; suites that pair a catalog with current content use P0. The
  dataset tests count the one later reviewed row. The whole-season baseline
  changed only in storage and body digests, asserted against the amended
  recording. The production behaviour tests run their genesis and ingest
  mechanics under explicit bundled authority; a new test pins runtime and
  optional inventory with the binding, and a configuration error without it.

### Q3. Production configuration

- New installation `98f14de8-d974-423a-bb78-dafe6251164a` (never staging's
  or E2E's); catalog `runtime`, discovery `off`, admin `read-only`,
  inventory `optional-drivers`.
- Production now declares four exports. **Two new classes:**
  `ReconciliationLedger` (the season lease a runtime batch ingest needs) and
  `IdentityCatalog`, each with its own binding.
- `IDENTITY_REVIEWER_CREDENTIALS` is required (production's own digest-only
  value). `PROVIDER_MODE` stays `none`, `genesis:2026` and crons `[]` stay
  as they are.
- **Acceptance 37** now allows exactly staging and production; E2E and
  development stay forbidden. Race-classification and driver-standings
  identity guards are unchanged.

### Q4. Existing production state (read-only baseline, 2026-11-22 21:48Z)

- Worker `62bf40e9` (code `09e0686`, 2026-10-22), crons `[]`.
- Sequencer `uninitialized`, phase `genesis`, admission closed; nothing
  published (sync status empty).
- KV `d76328b3…` holds 0 keys (snapshot digest = empty).
- Public season routes 404/503; `/v1/status` 200.
- So existing production state recovers trivially: an empty KV and an
  uninitialized sequencer.

### Q5. Prepared artifacts (local; verified)

- Code `9535a04` (consolidated targeted run: 5,511 passed / 11 skipped / 0
  failed across 290 files; eslint and both `tsc` projects clean). Clean
  deployment worktree `%TEMP%\gv-p4-prod`.
- Dry-runs: committed build bundle `6acb6230…`; the temporary `review`
  build and the RP4 recovery builds `b88f2577…`, which equal `6acb6230…`
  after path-label normalization.
- Credentials `prd-po-{read,review,activate}-1` (expiry 2027-02-28) and the
  seed-only `prd-po-bootstrap-1` (backstop expiry 2026-11-23T20:00Z), all
  DPAPI. Secret values: 4-entry `5bcd3af1…`, 3-entry `51c0cb7b…`. Every token
  authenticates to exactly its credential through the Worker's own
  `authenticate()`; the bootstrap token is refused by the 3-entry value.
- Seed request `production-p0-reviewed-seed.json` (op `2bc4a2d5`, P0
  `seed.json` `e50a64db…`, non-synthetic dossier); CLI contract check passed.

### Q6. Operations (each needs the owner's live confirmation)

1. Put the 4-entry secret on `gridview-api-production` (a new version of
   the current `62bf40e9` code; nothing else changes).
2. Deploy the temporary `review` build from `9535a04`. This creates the
   `ReconciliationLedger` and `IdentityCatalog` classes. Runtime ingest stays
   refused while no catalog is active.
3. Seed P0 with the bootstrap credential.
4. Put the 3-entry secret (bootstrap revoked); verify that bootstrap gets
   401 and the role credentials get 200.
5. Validate and activate P0 with the activator credential.
6. Deploy the committed build (admin `read-only`); probe A3 must return
   403 `IDENTITY_WRITES_DISABLED`.
7. Export with the reader credential, verify offline, store in custody
   (`production-p0-export-*`); take PITR bookmarks of catalog, ledger and
   sequencer, and a KV snapshot.

After each step: Cloudflare state diff, production public ETags, and
staging, E2E and production KV unchanged. No retry, and stop on any
deviation.

### Q7. Recovery

- **Existing state:** an empty KV and an uninitialized sequencer (Q4);
  nothing to restore.
- **Forward builds:** RP4-strict (no optional inventory) and RP4-unbound
  (catalog unbound, every runtime ingest refused before reading a body), both
  dry-run.
- **Catalog:** PITR to the step-7 bookmarks, or a reseed from the committed
  P0 package (deterministic). Production catalog data is fully reproducible
  until a season is published.
- **Rolling back to `62bf40e9`** would undeclare the two new classes. That
  is acceptable only while they hold nothing of value; the forward builds
  are preferred.

### Q8. Remaining blockers and limits

- **Not in scope:** genesis and the first production season batch (a v2
  batch from the production export and a fresh capture) need a separate
  confirmation.
- **Large code step:** production moves from `09e0686` (2026-10-22) to
  `9535a04`. All of it is covered by the suites above; public behaviour
  while nothing is published stays 404/503.
- **Staging:** staging must import the P0 base (R2) before it deploys this
  code (Q2).
- **Local commits:** the commits are not pushed, so production would run
  code that exists only locally until the owner authorizes a push.
- **Single operator:** SOE-P (production single-operator exception) is
  still a draft; the owner's live confirmation is the only approval.

---

## Addendum R - 2026-11-23: production P4 executed and verified

The owner confirmed steps 0-7 live. Code `9535a04` came from the clean
worktree `%TEMP%\gv-p4-prod`. Evidence:
`~/.gridview/evidence/identity-p4-production-2026-11-22/`.

| Step                              | Time (UTC)          | Result                                                                                                                                                                                              |
| --------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 pre-check (reads)               | 08:12               | identical to the post-P3 state; production `62bf40e9`, sequencer `uninitialized/genesis`, KV 0 keys, 14 ETags identical                                                                             |
| 1 secret, 4 entries (`5bcd3af1…`) | 08:13:16            | version `0ececf38` (same script etag and exports, secret added). Wrangler's record was not saved because of a log-name bug in the script after Wrangler exited; the outcome was verified from state |
| 2 deploy `review` build           | 08:14:04            | version `b0bfdaa2`, bundle `b88f2577…` (= dry-run); "Created: IdentityCatalog, ReconciliationLedger" (namespaces `575fdee7…`, `c2e5ce1b…`); staging and E2E unchanged                               |
| 3 seed P0 (bootstrap)             | 08:15:46            | proposal `75c87f54-aa21-48ea-bef0-1248c0f6815a`, catalog `0a1b093a…`, `exactSeed: true`, 95 bindings, 34 profiles                                                                                   |
| 4 secret, 3 entries (`51c0cb7b…`) | 08:16:00            | version `398795ed`; bootstrap `UNAUTHORIZED`, reader, reviewer and activator authenticate; local bootstrap token deleted                                                                            |
| 5 validate and activate           | 08:16:59 / 08:17:15 | valid, no issues, report `a09e8a05…`; **P0 active at sequence 1**, dataset `2026.11.22.1`, projection `bec52f09…`                                                                                   |
| 6 deploy the committed build      | 08:17:49            | version **`f1700b39`**, bundle `6acb6230…` (= committed dry-run); admin `read-only`; A3 403 `IDENTITY_WRITES_DISABLED`, A1 401                                                                      |
| 7 export, custody, baseline       | 08:18-08:20         | see below                                                                                                                                                                                           |

**Verification:**

- The catalog's base digest `923719d2…` equals the deployed bundled-source
  digest, so runtime admission accepts it.
- Export: `exportHash 0e7b5593…`, file sha `313228fd…`, 1,619,482 bytes.
  Offline `verifyCatalogFile` passed, the export reconstructs exactly from
  `loadCorpus('p0')` (0 differing paths), and its creators include
  `reviewer`.
- Custody: `~/.gridview/custody/identity-production/production-p0-export-20261123.*`
  (new folder). The staging R0 and R1 files are untouched. Offline GnuPG
  copy pending (owner).
- Bookmarks: catalog `00000001-00000004-0000512c-f54e…`, ledger
  `00000000-00000000-0000512c-8989…`, sequencer
  `00000020-00000000-0000512c-89f8…`. Post-P4 KV snapshot: 0 keys.
- Sequencer still `uninitialized/genesis`, nothing published, 14 public
  ETags identical, crons `[]` everywhere. Staging (`5ee3b49c`, KV
  unchanged) and E2E (`6b52bc02`) are untouched.

**Status:** production runs `f1700b39` (code `9535a04`) with catalog P0
active, runtime authority, optional-driver inventory and read-only admin.
`PROVIDER_MODE=none`, no season published.

**Next steps, each needing separate confirmation:**

- genesis plus the first v2 season batch, generated from the production
  export;
- the staging P0 base import (R2) before staging takes this code;
- pushing the commits;
- the offline copies.
