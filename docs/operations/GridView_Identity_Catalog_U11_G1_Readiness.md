# GridView identity catalog - U11: G1 readiness packet (G1 NOT AUTHORIZED)

- Date: 2026-11-21. Status: **preparation only. G1 is NOT AUTHORIZED.**
- SOE-1 accepted for staging Tier A (G0, G1, G1v) on 2026-11-21, with
  RS-1 to RS-8 accepted within that scope. G2-G5, optional-driver
  inventory, E2E and production are not covered.
- No remote change was made while preparing this packet. The recovery
  builds below are local `--dry-run` builds.

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

1. **NSW-0:** the G1 approval record (section 6), committed at least eight
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
4. **Deploy:** the single approved command (section 6).
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

## 5. Tier A compensating controls: status on 2026-11-21

| Control | Status                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CC-1    | **Prepared and rehearsed** (R-1 exact; R-2 equivalent). **Pending deployment-day verification**                                                                                          |
| CC-2    | **Verified:** DPAPI custody of the new token, folder restricted to the current user, old store marked obsolete. **Pending owner attestation:** Cloudflare MFA on, recovery codes offline |
| CC-3    | **Prepared:** logging scripts and evidence folders. Window log and hash manifest: **pending deployment day**                                                                             |
| CC-4    | **Prepared:** approval record (section 6). Eight-hour interval: **not started**; it starts only when the owner records the G1 approval                                                   |
| CC-5    | **Prepared:** sections 2 and 3. G0 state verified clean 2026-11-21. NSW-1 re-check: **pending deployment day**                                                                           |
| CC-6    | **Prepared:** version and deployment IDs recorded by the G1v snapshot (no catalog operations in G1)                                                                                      |
| CC-7    | **Prepared:** section 3                                                                                                                                                                  |
| CC-8    | **Prepared:** `staging-state.mjs` and `public-etags.mjs` before and after                                                                                                                |
| CC-9    | **Pending:** private continuity note (outside the repository) not yet written                                                                                                            |
| CC-11   | **Prepared:** E2E and production compared in every snapshot                                                                                                                              |

## 6. G1 authorization proposal (NOT AUTHORIZED)

> I authorize one deployment to Cloudflare account `786e24f1…e6bf`, Worker
> `gridview-api-staging`, replacing `bc9b9315-c228-42cc-b406-9892ad601034`:
> from a clean checkout of `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`,
> directory `services/edge-api`, the command
> `npx wrangler deploy --env staging`, whose bundle must be
> `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`,
> with installation `c45d60b8-a723-4b6e-8530-750592af2b94`, catalog
> `bundled`, discovery `off`, admin `off`, strict inventory. The existing
> exports and bindings are preserved, and `IdentityCatalog` and
> `IDENTITY_CATALOG` are added. No synchronization, seed, activation,
> optional-driver mode, secret change, E2E or production change. I accept
> that this permanently ends `wrangler rollback` to `bc9b9315` and earlier,
> and that R-1/R-2 forward recovery is the only path. Window: `<start>` to
> `<end>` UTC, at least eight hours after this record is committed. G1v
> follows immediately; abort conditions per section 2.

## 7. Remaining blockers for G1

1. The owner's attestation for CC-2 (MFA, offline recovery codes; do not
   share codes).
2. The CC-9 continuity note.
3. The owner's G1 approval (section 6), recorded and committed, then at
   least eight hours elapsed.
4. Deployment-day CC-1, NSW-1 and log preparation.

The offline-comparison policy proposal remains pending and is not affected.
