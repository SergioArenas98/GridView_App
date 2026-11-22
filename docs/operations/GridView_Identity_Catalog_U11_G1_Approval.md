# GridView identity catalog - U11: G1 approval record (SIGNED)

- Status: **G1 APPROVED by the product owner**, under SOE-1 (accepted
  2026-11-21, staging Tier A).
- Approval given: 2026-11-21 (owner message received about 19:31Z).
- Recorded and committed locally: see this file's commit. The eight-hour
  separation (CC-4) is measured from that commit's timestamp.
- Not executed: this record authorizes; it does not deploy.

## Approved deployment

| Item              | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Account           | `786e24f1c137661ce01035393acee6bf` (verified staging account; readiness packet §1)                                                    |
| Worker            | `gridview-api-staging` only                                                                                                           |
| Baseline replaced | `bc9b9315-c228-42cc-b406-9892ad601034`; NSW-1 must confirm it is still active                                                         |
| Release candidate | `6a609543fd762b028e0e3b4101d2f0ce9e851ce0`, clean checkout, `services/edge-api`                                                       |
| Bundle SHA-256    | `fb60cc641359c34026de6b32b5a3e0701c55dbf8c94c276059f174e34485e3d8`                                                                    |
| Installation UUID | `c45d60b8-a723-4b6e-8530-750592af2b94`                                                                                                |
| Command           | `npx wrangler deploy --env staging`, executed **once**                                                                                |
| Modes             | `IDENTITY_CATALOG_MODE=bundled`, `IDENTITY_DISCOVERY_MODE=off`, `IDENTITY_ADMIN_MODE=off`, strict inventory (no inventory-mode var)   |
| Durable Objects   | The three existing exports and bindings preserved. Adds only the `IdentityCatalog` export (sqlite) and the `IDENTITY_CATALOG` binding |
| Catalog           | Operationally inert: no seed, validation or activation                                                                                |

## Window and timing

- Approved window: **2026-11-22, 10:00-11:00 UTC**.
- The deployment may begin only after at least **eight full hours** since
  this record's commit, and only in an active, supervised session. Never
  asynchronously.
- If the earliest permitted time falls after the window, do not deploy:
  request a revised window.

## Irreversibility and recovery (accepted)

Adding the `IdentityCatalog` class prevents ordinary Cloudflare rollback to
`bc9b9315` and every earlier pre-IdentityCatalog version. Recovery is
forward-only, through R-1 (inert, bundle `fb60cc64…`) or R-2 (containment,
config at its pinned location, raw `c4714402…7953`), both keeping all four
exports. A Worker deployment does not restore Durable Object, ledger,
sequencer or KV state.

## Mandatory pre-deployment checks

Any failure means abort before upload and report.

1. This record committed; earliest eligible time computed.
2. R-1 and R-2 rebuilt and matched (readiness packet §3, CC-1).
3. Deployment log, recovery cards and evidence manifest prepared.
4. Within 30 minutes before the deploy, the full G0 read-only set (NSW-1):
   - `staging-state.mjs` identical to the `bc9b9315` baseline (version,
     code, bindings, exports, vars, secret names, settings, namespaces, KV,
     schedules, E2E, production);
   - the three admin GETs all 200 and identical to the baseline bodies: no
     hold, block, held lease, uncertain operation or pending publication
     recovery;
   - public ETags unchanged.
5. Same-day R-1 dry-run bundle = `fb60cc64…85e3d8`; checkout clean at
   `6a60954`; Wrangler signed in to the expected account.
6. No-sync window controlled (readiness packet §2); recovery procedures at
   hand.

## Authorized execution and verification

1. Run the single command.
2. Record the version and deployment IDs.
3. Verify the deployed `index.js` = `fb60cc64…` and the bindings.
4. Confirm the four DO exports.
5. Confirm the catalog is inactive (bundled, discovery off, admin off).
6. Confirm public ETags and KV are unchanged.
7. Confirm staging schedules are `[]`.
8. Confirm E2E and production are unchanged.
9. Run G1v (readiness packet §4).
10. Record sanitized evidence in the U11 report.

On an ambiguous result: inspect the authoritative Cloudflare state first.
**No automatic retry.**

## Excluded

G2-G5; catalog seed, validation or activation; runtime identity authority;
optional-driver inventory; synchronization or provider requests;
publication or reconciliation mutations; secret rotation; E2E or
production changes; push or merge; destructive rollback or namespace
deletion. SOE-1 stays limited to Tier A.

## Signature

Approved by: **the GridView product owner** (sole staging operator and
staging release approver), 2026-11-21, by explicit written instruction:
"This message constitutes my explicit G1 approval as GridView product
owner."

---

## Amendment 1 (2026-11-21): window change only

The product owner explicitly changed the G1 deployment window to **Sunday
2026-11-22, 11:00-12:00 UTC**, with an intended start of 11:00 UTC subject
to a successful preflight. This supersedes the 10:00-11:00 UTC window
above and any other earlier window. **Scope, values, conditions and
exclusions are unchanged.** The original approval above is preserved as
recorded in `c9022a4579cbfcb185ce691b32608daa4c83e03a`
(2026-11-21T19:32:53Z).

**Timing (CC-4).** The separation runs from the approval record's commit
to execution.

- Original record `c9022a4`: eight hours end at 2026-11-22T03:32:53Z.
- Applied conservatively to this amendment as well: eight hours from this
  amendment's commit, which ends before 04:00Z on 2026-11-22.
- Both end well before the window opens. **Earliest valid deployment:
  2026-11-22T11:00:00Z** (window start).
- Preflight (NSW-1) begins no earlier than 10:30Z, so it falls within the
  30 minutes before the upload.
- No deployment after 12:00:00Z without a newly approved window.

**Execution conditions (unchanged):**

- live, owner-supervised session only;
- no scheduled, background or automatic deployment;
- any failed or different preflight value means no deployment.

No further authorization is needed for G1 beyond this amended timing and
the mandatory execution conditions.

---

## Execution and acceptance record (2026-11-22)

- **Executed:** 2026-11-22T11:00:46Z-11:01:01Z, once, in the approved
  window, with the owner present. New staging version
  `13c3a90c-4fd8-4794-9fd6-efaf4f950bb6`, deployment
  `fdaf88d1-8581-4bfe-acc6-f024f259391b`, bundle `fb60cc64…85e3d8`.
  Evidence and G1v: U11 report Addendum I.
- **Accepted:** the product owner formally accepted G1 on 2026-11-22
  (decision D0). Approval, amendment and execution evidence are preserved
  unchanged above and in Addendum I.
- **New staging baseline:** `13c3a90c`. Every later gate compares against
  the G1v snapshot (`g1v-state.json`, G1v admin bodies and ETags), not
  `bc9b9315`. This approval authorizes nothing further.
