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
