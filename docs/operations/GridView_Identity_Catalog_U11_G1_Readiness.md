# GridView identity catalog - U11: G1 readiness packet (G1 NOT AUTHORIZED)

- Date: 2026-11-21. Status: **preparation only. G1 is NOT AUTHORIZED.**
- SOE-1 accepted for staging Tier A (G0, G1, G1v) on 2026-11-21, with
  RS-1 to RS-8 accepted within that scope. G2-G5, optional-driver
  inventory, E2E and production are not covered.
- No remote change was made while preparing this packet. The recovery
  builds below are local `--dry-run` builds.
- Revision 2 (2026-11-21 19:30Z): fresh read-only checks, CC-2 and CC-9
  completed, final unsigned approval text (sections 5-8).
- **Revision 3 (2026-11-21 19:50Z): G1 APPROVED.** The signed record is
  `GridView_Identity_Catalog_U11_G1_Approval.md` (commit `c9022a4`,
  19:32:53Z), with Amendment 1 (commit `254f40f`, 19:48:25Z) changing the
  window to **2026-11-22 11:00-12:00 UTC**.
  - Earliest valid deployment: **11:00:00Z** (both eight-hour periods end
    before 04:00Z).
  - Section 8 below is kept as the pre-signature draft. The signed record
    governs.
  - Deployment-day sequence: section 9.

## 1. Fixed values

| Item                        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account / Worker            | Cloudflare account `786e24f1…e6bf`; Worker `gridview-api-staging` only                                                                                                                                                                                                                                                                                                                                                                        |
| Pre-deployment baseline     | Active version `bc9b9315-c228-42cc-b406-9892ad601034` (G0 passed 2026-11-21 16:58Z; U11 Addendum E8)                                                                                                                                                                                                                                                                                                                                          |
| Release commit              | `6a609543fd762b028e0e3b4101d2f0ce9e851ce0` (clean checkout; 6,386 passed / 6 skipped / 0 failed)                                                                                                                                                                                                                                                                                                                                              |
| Bundle SHA-256 (`index.js`) | `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`, reproduced again on 2026-11-21                                                                                                                                                                                                                                                                                                                                            |
| Installation UUID           | `c45d60b8-a723-4b6e-8530-750592af2b94`                                                                                                                                                                                                                                                                                                                                                                                                        |
| Config delta vs live        | Adds only `IDENTITY_INSTALLATION_ID`, `IDENTITY_CATALOG_MODE=bundled`, `IDENTITY_DISCOVERY_MODE=off`, `IDENTITY_ADMIN_MODE=off`, export `IdentityCatalog` (sqlite) and binding `IDENTITY_CATALOG`. No inventory-mode var (= strict). All other vars, KV, the three existing DO exports and bindings, compatibility `2026-07-01`, `workers_dev` on, previews off and crons `[]` are unchanged (resolved config compared with the live version) |
| Rollback floor after G1     | `wrangler rollback` to `bc9b9315` and every earlier version is no longer possible                                                                                                                                                                                                                                                                                                                                                             |

Runtime: `IDENTITY_CATALOG` is read only by the identity admin routes
(admin `off`) and by the catalog run-context and factory, which are used for
runtime or compare modes and discovery (all off). With bundled authority,
public and synchronization behaviour is expected to be unchanged. This rests
on the RC test suite; it is not yet observed remotely, so it is a G1v check.

## 2. No-sync deployment window

Empty schedules stop cron execution only. The admin HTTP routes (sync,
ingest, verification, cutover, rollback, purge), other Cloudflare
principals and work admitted earlier remain possible paths (SOE-1 §3.1).
The admin token now exists only in the operator's DPAPI store, since every
earlier value was invalidated on 2026-11-21. No hold is applied: applying
one is a mutation, and a hold does not stop ledger commits.

1. **NSW-0:** the G1 approval record (section 8), committed at least eight
   hours before execution, names the start and end of the window.
2. **NSW-1 (at most 30 minutes before upload):**
   - `staging-state.mjs`: must equal the `bc9b9315` baseline (version
     active and latest, script etag `5a55c1b4…5864`, `index.js`
     `7415b82d…`, three exports, 14 bindings and var values, two secret
     names, settings, DO namespaces, no `IdentityCatalog`, KV 3,982 /
     `59624265…ccfc6`, schedules `[]` x3, E2E `6b52bc02`, production
     `62bf40e9`);
   - the three G0 GETs: no hold or block, lease released, no intents or
     verification activity, backlog 0, cutover state unchanged; rounds 18-19
     unsettled and round 20 absent stay untouched;
   - `public-etags.mjs`: 14/14 unchanged;
   - R-1 and R-2 rebuilt (CC-1).
3. **NSW-2 (during):** no admin POST, workflow dispatch, other `wrangler`
   command or other session.
4. **Deploy:** the single approved command (section 8).
5. **NSW-3 (G1v):** see section 4.

**Safe stopping points:** before the upload (nothing has changed); after a
successful inert G1 (stable; no cron).

**Abort before upload:** any NSW-1 difference, any failed or 401 read, an
R-1 hash other than `fb60cc64…`, or the end of the window.

## 3. Forward-recovery cards (never roll back to `bc9b9315` or earlier)

Builds from the clean `6a60954` worktree, `services/edge-api`. Both keep
**all four exports**.

- **R-1 (return to inert):** `npx wrangler deploy --env staging`. Its
  `--dry-run` reproduced `fb60cc64…85e3d8` on 2026-11-21.
- **R-2 (containment, catalog unreachable, data kept):** same command with
  `--config` set to the scratch config `wrangler.r2-containment.toml`, kept
  at its recorded evidence location. Raw hash from there:
  `c4714402…7953`. After normalizing build-path labels it is
  byte-identical to R-1 and to the 2026-11-17 R-2 build. Three DO bindings;
  four exports.

A Worker deployment never restores Durable Object, ledger, sequencer or KV
state.

| Card | Trigger                                                                    | Action                                                                                                                         |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C1   | Deploy fails or the result is ambiguous                                    | Do not repeat. Read deployments and versions. If unchanged, the window ends at no change. If a new version exists, go to C2-C8 |
| C2   | Unexpected version, or deployed `index.js` ≠ `fb60cc64…`                   | Stop; record; R-1 after a separate decision                                                                                    |
| C3   | Unexpected namespace, binding, or DO reconciliation "Deleted" or "Renamed" | Stop; record; never remove exports; R-2 for containment if the catalog binding is implicated                                   |
| C4   | Script settings changed (observability, logpush, subdomain)                | Record; restore the setting with a separately approved change; no code action                                                  |
| C5   | Public ETag or KV digest differs                                           | Stop; G0 GETs; investigate; no purge or republish without approval                                                             |
| C6   | Sync or publication observed                                               | Stop; G0 GETs; preserve evidence; do not clear holds or blocks                                                                 |
| C7   | E2E or production differs                                                  | Stop; record; nothing there is in scope for G1                                                                                 |
| C8   | Inert deploy succeeded but containment is wanted                           | R-2 (data kept)                                                                                                                |

## 4. G1v read-only checks

- `staging-state.mjs`: exactly one new version at 100%; `index.js` =
  `fb60cc64…`; exports = the three existing plus `IdentityCatalog`;
  bindings = the existing 14 plus `IDENTITY_CATALOG` and the four
  `IDENTITY_*` vars; secret names unchanged; one new namespace
  `IdentityCatalog` for this script only; existing namespace IDs
  unchanged; KV unchanged; schedules `[]` x3; E2E and production unchanged.
- Script settings compared before and after (the config's observability
  block is a subset of the live settings: verify, do not assume).
- G0 GETs and `public-etags.mjs` unchanged.

## 5. Fresh read-only verification (2026-11-21 19:26-19:27Z)

No mutation.

- `staging-state.mjs`: **identical** to the E8 baseline.
  - `bc9b9315-c228-42cc-b406-9892ad601034` is active at 100% and is the
    latest upload.
  - Script etag `5a55c1b4…5864`; `index.js` `7415b82d…`.
  - Three DO exports; 14 bindings and var values; two secret names.
  - No `IdentityCatalog`. KV 3,982 / `59624265…ccfc6`.
  - Schedules `[]` x3; E2E `6b52bc02`; production `62bf40e9`.
- G0 GETs with the promoted token: `CutoverStatus`, `SyncStatus` and
  `Inspect` all return **200**, with bodies byte-identical to E8.
  - No operator hold, durable block or publication disposition or due time.
  - Lease released; backlog 0/60; no verification or correction activity.
  - Rounds 18-19 unsettled and round 20 absent, untouched.
- Public ETags: 14/14 return 200, unchanged since 2026-11-17.
- Release candidate in the report and here: `6a60954`, `fb60cc64…85e3d8`,
  `c45d60b8-…94`, bundled, discovery off, admin off, strict inventory.
  Consistent across U11 E8/F, SOE-1 §11 and this packet.

## 6. Tier A compensating controls

| Control | Status                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CC-1    | **Satisfied as rehearsal:** R-1 reproduced `fb60cc64…`; R-2 equivalent; both keep four exports. **Required during the window:** rebuild both and match the hashes (NSW-1)                                                                                                                   |
| CC-2    | **Satisfied.** MFA enabled: **owner attestation, 2026-11-21**. Recovery codes stored offline outside the computer: **owner attestation, 2026-11-21** (not inspected or recorded). Staging token in DPAPI custody, verified by 200s at 16:58Z and 19:27Z (E8/F). SOE-1 accepted, Tier A only |
| CC-3    | **Satisfied (prepared):** scripts and evidence folders. **Required during the window:** window log and SHA-256 manifest, recorded in a local docs commit                                                                                                                                    |
| CC-4    | **Blocked until the owner acts:** the approval text (section 8) is unsigned. The eight-hour interval starts only when the signed record is committed                                                                                                                                        |
| CC-5    | **Satisfied today** (section 5). **Required during the window:** NSW-1 re-check within 30 minutes, with the abort conditions in section 8                                                                                                                                                   |
| CC-6    | **Satisfied (prepared):** the G1v snapshot records version and deployment IDs (no catalog operations in G1)                                                                                                                                                                                 |
| CC-7    | **Satisfied:** recovery cards C1-C8 (section 3)                                                                                                                                                                                                                                             |
| CC-8    | **Satisfied (prepared):** before and after `staging-state.mjs`, G0 GETs and `public-etags.mjs`                                                                                                                                                                                              |
| CC-9    | **Satisfied:** private continuity note created 2026-11-21 in the GridView private operations directory outside the repository. Readable by the owner's account; no secrets; not in Git                                                                                                      |
| CC-10   | Not applicable to Tier A (G2/G3)                                                                                                                                                                                                                                                            |
| CC-11   | **Satisfied today; required during the window:** E2E and production compared in every snapshot; any difference blocks deployment                                                                                                                                                            |

Coverage checks:

- R-1 and R-2 are documented, and both keep the four exports.
- C1-C8 cover failed or ambiguous deploys, version or hash mismatch,
  namespace or binding anomalies, settings changes, ETag or KV changes,
  unexpected sync or publication, E2E or production changes, and
  containment.
- The abort conditions are objective (section 8).
- The NSW-1 reads run within 30 minutes of the deploy.
- A staging, E2E or production change, a hold, block, held lease,
  uncertain operation or pending publication recovery all stop the
  deployment.
- G1 contains no provider request, synchronization, seed, activation,
  optional inventory, runtime cutover or publication.
- Recovery after G1 is forward-only, with the `IdentityCatalog` export kept.

## 7. Remaining blockers

The only remaining blocker is **the owner's explicit G1 approval**: sign
section 8, commit it locally, then wait at least eight hours. Everything
else is either satisfied or is a deployment-window step.

## 8. G1 approval record: UNSIGNED, NOT AUTHORIZED

> **G1 approval (staging, first inert deployment).**
>
> I, the product owner and sole GridView operator, under SOE-1 (accepted
> 2026-11-21, Tier A), authorize exactly one deployment:
>
> - **Target:** Cloudflare account `786e24f1c137661ce01035393acee6bf`,
>   Worker `gridview-api-staging` only.
> - **Replaces:** verified baseline `bc9b9315-c228-42cc-b406-9892ad601034`.
>   NSW-1 must confirm it is still active.
> - **Source:** clean checkout of
>   `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`, directory
>   `services/edge-api`.
> - **Command:** `npx wrangler deploy --env staging`, once.
> - **Bundle:** `index.js` SHA-256
>   `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`,
>   from the same-day dry-run and the deployed content.
> - **Configuration:** installation
>   `c45d60b8-a723-4b6e-8530-750592af2b94`; catalog `bundled`; discovery
>   `off`; admin `off`; strict inventory. The three existing DO exports and
>   bindings, KV, vars and secrets are preserved. `IdentityCatalog` (sqlite)
>   and `IDENTITY_CATALOG` are added.
> - **Scope:** this deployment and its read-only G1v checks only. No
>   synchronization, provider or proxy request, seed, validation,
>   activation, optional inventory, runtime cutover, publication, secret
>   change, hold, E2E or production change.
> - **Irreversibility:** I accept that adding `IdentityCatalog` permanently
>   prevents normal Cloudflare rollback to `bc9b9315` and every earlier
>   version. Recovery is forward only: R-1 (inert, `fb60cc64…`) or R-2
>   (containment; config at its pinned location, raw `c4714402…7953`),
>   both keeping all four exports. A Worker deployment does not restore
>   DO, ledger, sequencer or KV state.
> - **Timing:** this record is committed locally first. Execution starts
>   no earlier than **eight hours after that commit**, within the window
>   `<start UTC>` to `<end UTC>`.
>
> **Abort before the upload if any of these occurs:**
>
> 1. An NSW-1 snapshot (taken at most 30 minutes before) differs from the
>    baseline in any field: active or latest version, script etag,
>    `index.js`, exports, bindings and vars, secret names, settings, DO
>    namespaces, KV digest, schedules, E2E or production.
> 2. The G0 GETs are not all 200, or show a hold, block, non-released
>    lease, verification, correction or intent activity, a publication
>    disposition or due time, or a change from the baseline bodies.
> 3. Public ETags differ.
> 4. The R-1 dry-run hash is not `fb60cc64…`, or R-2 is not
>    `c4714402…7953` from its pinned location.
> 5. The checkout is not clean at `6a60954`, or Wrangler is signed in to a
>    different account.
> 6. The window has ended.
>
> **After the upload:** do not repeat the deploy. Run G1v (section 4). Any
> difference follows recovery cards C1-C8 and never a rollback.
>
> Signed: `<product owner>` Date/time (UTC): `<…>` Commit: `<…>`

## 9. Deployment-day sequence (2026-11-22)

The private evidence folder `identity-u11-g1-2026-11-22` holds the exact
commands (`00-SEQUENCE.md`), the operation-log template
(`01-OPERATION-LOG.md`) and the SHA-256 manifest script
(`02-make-manifest.ps1`).

| Phase          | When (UTC)                                | Content                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Preparation | from about 10:15                          | Owner present; checkout clean at `6a60954`; local Wrangler 4.112.0 (always run inside the RC `services/edge-api`, never elsewhere); account check; R-1 rebuild = `fb60cc64…`; R-2 rebuild = `c4714402…7953` from its pinned path |
| B. NSW-1       | not before 10:30, within 30 min of upload | `staging-state.mjs` zero differences vs the 19:26Z baseline; the three G0 GETs 200 and identical bodies; 14/14 ETags unchanged. Any difference means ABORT                                                                       |
| C. Deploy      | ≥ 11:00:00, before 12:00:00               | `npx wrangler deploy --env staging --outdir <evidence>/deploy`, once. Expect "Created: IdentityCatalog" and no "Deleted" or "Renamed"; output `index.js` = `fb60cc64…`. Ambiguous: no retry, go to G1v and cards C1-C8           |
| D. G1v         | immediately                               | Section 4 checks; G0 GETs and ETags unchanged; catalog inert (admin off, discovery off; identity routes not probed); manifest; U11 docs commit                                                                                   |

No deployment after 12:00:00Z without a newly approved window. No
unattended, scheduled or background execution.
