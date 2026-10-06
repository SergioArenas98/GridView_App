# GridView Staging Edge Runbook

Status: Phase 5B — staging deployment of the GridView edge API to Cloudflare
Workers. This runbook is operational: it describes how the staging Worker is
deployed, seeded, verified and rolled back, and the limitations that apply.

Scope and constraints:

- Staging only. Production is **not** deployed in Phase 5B. Do not create the
  production Worker, a production KV namespace, a custom domain or a DNS route.
- The staging Worker serves mock provider data (`PROVIDER_MODE = mock`); it is
  not backed by a live Formula 1 provider.
- Secrets are referenced by **name only**. No token, account credential or
  provider key appears in this document or in the repository.

All commands run from `services/edge-api` unless stated otherwise. `wrangler` is
the repo-pinned dependency; invoke it through npm rather than a global install.

**Wrangler command form.** Always put the `--` argument separator between
`npm exec` and `wrangler`:

- general form: `npm exec -- wrangler <command> [flags]`;
- **Windows PowerShell: `npm.cmd exec -- wrangler <command> [flags]`.** In
  PowerShell, `npm` resolves to the `npm.ps1` shim, which, with npm 10.9.9,
  can consume the separator or the Wrangler flags. Calling `npm.cmd` directly
  avoids the shim.

Without the separator, npm takes flags such as `--env` and `--dry-run` as its
own, and Wrangler runs with the wrong arguments. For example, a staging
dry-run then reaches Wrangler as a `deploy` of an entry point named `staging`,
and fails. The examples below use the general form; in Windows PowerShell,
write `npm.cmd` in place of `npm`.

## 1. Cloudflare account selection

The project uses a **single** Cloudflare account, so no
`CLOUDFLARE_ACCOUNT_ID` disambiguation is required. Wrangler operates on the
OAuth-authenticated account.

```text
npm exec -- wrangler whoami
```

Confirm exactly one account is listed and that the token includes the
`workers_tail (read)` scope (required by the observability helper). If more than
one account is ever associated, set `CLOUDFLARE_ACCOUNT_ID` explicitly before
deploying so the target is unambiguous.

## 2. Committed staging baseline vs. deployed state

These values are committed in `services/edge-api/wrangler.toml` (`[env.staging]`)
and are the single source of truth for the **baseline** — what the next
deploy will upload. They are not automatically the **currently deployed**
state: a row can be committed before it is uploaded, or removed while still
live, as the last row below records. Section 6 covers confirming what is
actually live.

| Setting | Value |
|---|---|
| Worker name | `gridview-api-staging` |
| URL | `https://gridview-api-staging.sejuma18.workers.dev` |
| `workers_dev` | `true` (no custom domain / route) |
| `preview_urls` | `false` |
| KV binding | `GRIDVIEW_DATA` |
| KV namespace id | `1d0fb55486a745a1ad12e03d9f04942b` |
| `ENVIRONMENT` | `staging` |
| `PROVIDER_MODE` | `mock` (permanent staging config) |
| `PUBLIC_BASE_URL` | `https://gridview-api-staging.sejuma18.workers.dev` |
| Cron trigger | `17 3 * * *` |
| Observability | enabled, `head_sampling_rate = 1`, persisted logs |
| Required secret | `ADMIN_TOKEN` |
| Durable Object bindings | `PROVIDER_RATE_LIMITER`, `SEASON_PUBLICATION_SEQUENCER` — both provisioned 2026-09-12 (version `985115b7-abb3-4346-8845-d8ff41c80cf6`); since 2026-09-15 (version `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c`) the sequencer is looked up, and the rate limiter still is not; see `../technical/GridView_Environments.md` |
| `SEASON_PUBLICATION_CUTOVER_CONTROL` | **Committed: `activate:2026`**, prepared on 2026-09-15 after the season-2026 seed committed; see "Season-2026 seed record and activation phase (2026-09-15)" in section 6. Before that, `master` carried `seed:2026`, restored by the reclosure configuration (PR #24). **Live: `activate:2026`**, since 2026-09-16 (version `c297d260-c81b-4110-bdf2-7572e1206af3`), so committed and live match again. The earlier `seed:2026` was first deployed on 2026-09-12 from source revision `d3de839a7b297c060e6e4ee7cf1d9974a198be93` (version `00012c06-6c09-4b2f-b24c-02d6e51ec08d`). It was absent only during the separately authorized recovery window on 2026-09-13 (reopening version `38b5169a-6e3b-4e44-aed1-89ef74c0995c`). The reclosure deployment from `549bb5f3f3ee3963727a816b96fa39752355e9cd` restored it the same day as version `c35f99c0-9e89-4dd7-8fbe-449d295fb567` at 100% traffic, and version `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c` kept it on 2026-09-15. Season 2026's legacy publication and rollback admission was **closed** from 2026-09-12, and `activate:2026` kept it closed until the activation. **Season 2026 was activated on 2026-09-16**, so `admissionClosed` is now `false` and its publication and rollback run through the sequencer, never through the legacy pointers; see "Recovery window record (2026-09-13)" and "Season-2026 activation-phase deployment and activation (2026-09-16)" in section 6. Any change to the live value is cutover-sensitive (section 6). Neither phase activates anything by itself. See [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary). |
| `SEASON_PUBLICATION_AUTHORITY` | **Committed: `sequencer`**, staging only, prepared on 2026-09-15 for the approved season-2026 seed. **Live: `sequencer`** since 2026-09-15 (version `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c`), kept unchanged by version `c297d260-c81b-4110-bdf2-7572e1206af3` on 2026-09-16; every earlier live version lacked it. A later deployment that omits or changes it is cutover-sensitive (section 6). See "Season-2026 seed authority (prepared 2026-09-15, not deployed)" and "Season-2026 seed record and activation phase (2026-09-15)" in section 6. |

`PUBLIC_BASE_URL` is mandatory in staging: the scheduled publisher uses it to
compute the public URLs it purges. Its absence is a configuration error.

## 3. Cron trigger and timezone

Cloudflare cron triggers always run in **UTC**. The deployed schedule is:

```text
17 3 * * *      # 03:17 UTC every day
```

Do not change the schedule to a high-frequency cadence for testing — verify the
scheduled handler with the local test suite (section 13) instead. If the cron is
ever edited, redeploy and re-confirm it with:

```text
npm exec -- wrangler deployments list --env staging
```

## 4. Secrets

`ADMIN_TOKEN` is the only staging secret. Set it interactively so the value is
never echoed, stored in shell history, or passed as a CLI argument:

```text
npm exec -- wrangler secret put ADMIN_TOKEN --env staging
# paste the value at the interactive prompt
```

List secret **names** (never values) with:

```text
npm exec -- wrangler secret list --env staging
```

Never commit `.dev.vars`, `.env`, or any file containing the token. Do not
print, log, rotate-in-place or retrieve the value through tooling. To run the
authenticated verification scripts locally, export the token for the current
shell only and clear it afterwards (PowerShell):

```powershell
$env:GRIDVIEW_STAGING_ADMIN_TOKEN = Read-Host "Staging admin token"  # not logged to history
# ... run the checks ...
Remove-Item Env:\GRIDVIEW_STAGING_ADMIN_TOKEN
```

**Rotation record (2026-09-13).** Under explicit operator authorization, the
staging `ADMIN_TOKEN` was rotated once, as part of the season-2026 recovery
window's reopening deployment
(`wrangler deploy --env staging --secrets-file <temporary file>`). The
temporary file lived outside the repository and was deleted immediately after
Wrangler read it. The previous value no longer authenticates. The operator's
reusable copy exists only as a Windows-DPAPI-encrypted file, readable by the
operator's Windows user, in a private credential directory under that user's
profile, outside the repository. Authenticated calls decrypt it into process
memory only and never print it. See "Recovery window record (2026-09-13)" in
section 6.

## 5. Validate and dry-run (no deploy)

```text
npm run validate                          # OpenAPI + content + fixtures + worker-config types
npm exec -- wrangler deploy --dry-run --env staging
```

In Windows PowerShell, run the dry-run as
`npm.cmd exec -- wrangler deploy --dry-run --env staging`.

The dry-run bundles the Worker and resolves bindings without uploading anything
(`--dry-run: exiting now`). Expected bindings: `GRIDVIEW_DATA` (KV), the
`PROVIDER_RATE_LIMITER` and `SEASON_PUBLICATION_SEQUENCER` Durable Objects,
plus the `ENVIRONMENT`, `PROVIDER_MODE`, `PUBLIC_BASE_URL`,
`SEASON_PUBLICATION_CUTOVER_CONTROL` (`activate:2026`, live since 2026-09-16)
and `SEASON_PUBLICATION_AUTHORITY` (`sequencer`, live since 2026-09-15) vars.
Committed and live now match for both, and for `PROVIDER_MODE` (`mock`), the
cron and the Durable Object bindings. That is necessary, not sufficient: a
deploy of `master` is ordinary under the section 6 gate only if no later
subsection of section 6 marks the code it carries as cutover-sensitive. The
publication guard and the coordinated runtime composition both do, so a
deploy of current `master` is cutover-sensitive. The historical dry-run of the temporary season-2026
reopening configuration (PR #23) showed **no**
`SEASON_PUBLICATION_CUTOVER_CONTROL` while live staging carried `seed:2026`;
that configuration is superseded — see section 2. **Read the dry-run output, and compare it with the
live version, before proceeding to section 6** — that comparison is how the
cutover-sensitive gate below is checked.

## 6. Deploy staging

> **Amended 2026-09-27: the gate compares five things, not two.** Besides
> the two vars below, a deploy is cutover-sensitive when the dry-run and the
> live version differ in `PROVIDER_MODE`, in the cron trigger, or in any
> Durable Object binding (added, removed or renamed). That includes a future
> reconciliation-ledger binding. Each of these changes when, how and from
> where season-2026 publications run. The comparison procedure, the
> authorization it requires and the rule that merging authorizes nothing are
> unchanged. Selecting `PROVIDER_MODE = "coordinated"` is a separate
> authorization of its own (see "Coordinated runtime composition" below).

There are two kinds of staging deploy, distinguished by comparing
`SEASON_PUBLICATION_CUTOVER_CONTROL` and `SEASON_PUBLICATION_AUTHORITY` in
the section 5 dry-run with the live version's (read the active version id
from `npm exec -- wrangler deployments status --env staging`, then
`npm exec -- wrangler versions view <version-id> --env staging`). An absent var
is a value like any other:

- **Ordinary deployment** — for each of the two vars, the dry-run and the
  live version carry the same value, or both lack it. Proceed as a routine
  deploy.
- **Cutover-sensitive deployment** — either var differs in any way: the
  dry-run adds it, changes its value, or **omits a var the live version
  carries**. This is **never routine**. Adding `seed:2026` was
  [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary)
  step 1, closing publication and rollback admission for season 2026 in live
  staging before any checkpoint, seed or activation; omitting it — as the
  temporary reopening configuration below does — reopens that admission, and
  restoring it — as the prepared reclosure configuration below does — closes
  it again. Before running the command below in this case, the operator must
  hold explicit, separate authorization naming: the exact control and
  authority values being deployed (or their absence), the season affected
  (2026), the target
  environment (staging), the reviewed commit being deployed and, for a
  reopening, the bounded recovery window. **Merging a PR — PR #21, the PR that
  prepared the reopening configuration, or any other — does not itself
  authorize this deployment**: the deployment, not the merge, changes
  admission. Without that authorization in hand, stop here; do not run the
  deploy command.

```text
npm exec -- wrangler deploy --env staging
```

In Windows PowerShell, run it as `npm.cmd exec -- wrangler deploy --env staging`.
This is a normal deploy — never `--env production`. Record the returned version
id. Confirm the deployment:

```text
npm exec -- wrangler deployments list --env staging
```

**Persistence rule, once `SEASON_PUBLICATION_CUTOVER_CONTROL` is live:**
every subsequent staging deployment must preserve the live value unchanged
unless it carries an explicitly authorized D12 transition (e.g. the
`seed:` → `activate:` step) or an authorized recovery. Removing, replacing or
simply omitting the var from a future deploy is itself a cutover-sensitive
change, not a routine one, and needs the same separate authorization as
above — an ordinary redeploy must never reopen admission by accident.

### Temporary season-2026 reopening configuration (prepared 2026-09-13, not deployed)

> **Executed 2026-09-13.** Two kinds of statement in this subsection were true
> when written: that this configuration and the reclosure configuration are
> "not deployed", and that live version `00012c06-…` still carries
> `seed:2026`. The recovery window has since deployed both, in order, and live
> staging is closed again at version `c35f99c0-9e89-4dd7-8fbe-449d295fb567`.
> See "Recovery window record (2026-09-13)" below.

**Live staging remains closed.** Version
`00012c06-6c09-4b2f-b24c-02d6e51ec08d` still carries
`SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"`. The reopening
configuration (PR #23) omits that value from `wrangler.toml` — its only
configuration change — so a staging deployment of it would **reopen** season
2026's legacy publication and rollback admission. Creating, pushing or
merging the PR that prepared it changes nothing in Cloudflare.

**Why.** The read-only D12 checkpoint audit (2026-09-13) found that none of
the 57 retained season-2026 versions — active `20260912031739186-f641607c`,
previous `20260911031751466-6b2dd9d1` — records an exact `__inventory`. The
repository's `importRelease` reports `inventory-unavailable` for them, so a
seed from the active version would fail `active-inventory-unavailable`.
Existing releases are immutable: none may receive a reconstructed or
backfilled inventory. D12 step 10 lets a season be retried from step 1 once
the underlying data problem is fixed; the fix is one new publication under the
current code, which writes its own exact inventory.

**The recovery sequence**, each step separately authorized:

1. a time-bounded `wrangler deploy --env staging` of this configuration,
   reopening admission;
2. exactly one season-2026 publication under the current code;
3. an immediate redeploy restoring exactly `seed:2026`, re-closing admission;
4. verification of the new version and its `__inventory`;
5. the staging-client baseline reset, separately authorized and recorded;
6. a re-run of the D12 checkpoint audit.

Only then does D12's sequence resume at checkpoint construction.

**The prepared reclosure configuration (2026-09-13, not deployed)** is step
3's reviewed change, prepared before any reopening deployment: it restores
exactly `SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"` under
`[env.staging.vars]` and changes nothing else, so its executable configuration
matches that of live version `00012c06-…`. Because its control equals the live
value today, the gate above would class deploying it now as ordinary — **it
is not**. It is deployed only as step 3, under that step's separate
authorization, immediately after step 2's publication has committed; never
before that publication, and never as routine or unrelated work. Creating,
pushing or merging it changes nothing in Cloudflare either.

**What a reopened Worker does.** The control resolves to `disabled`, so
season 2026's publication and rollback reach the legacy `SnapshotPublisher`
again. `SEASON_PUBLICATION_AUTHORITY` stays absent, so nothing is seeded or
activated and legacy KV pointers stay authoritative; `PROVIDER_MODE` stays
`mock`.

- **The next cron run (03:17 UTC) publishes.** A
  `season-paused-for-cutover` refusal records no job success and the longest
  job interval is 24 hours, so every job is due unless provider quota blocks
  it. The mock provider's `sourceUpdatedAt` equals the active version's
  (`2026-07-18T11:55:00.000Z`) and only a strictly older candidate is
  rejected, so the publisher writes a new legacy-format version with its
  documents and `__inventory`, then moves `active:2026` to it and
  `previous:2026` to `20260912031739186-f641607c`. No existing version's keys
  are written or deleted.
- **Expect `applied` with `reason: cache-purge-failed`.** The outgoing version
  has no inventory, so the routes it withdraws cannot be enumerated and the
  purge is reported failed even if the purge call succeeded. The publication
  itself committed, and the synchronization run completes.
- **Every further cron run and every successful
  `POST /internal/admin/sync/full` creates another version.** The recovery
  authorization names which one produces the single publication, and
  reclosure must be live before a second can run.

> **Operator warning.**
>
> - **Do not deploy this configuration as part of unrelated work.** While it
>   is on `master` without the reclosure configuration, every staging
>   deployment of `master` is cutover-sensitive (it omits the live
>   `seed:2026`), so routine staging deployment is prohibited until the
>   reviewed reclosure restores `seed:2026` on `master`.
> - **Do not leave admission open longer than the separately authorized
>   recovery window.** Have the reclosure change reviewed before reopening,
>   deploy it as soon as the one publication has committed, and do not call
>   the season-2026 rollback endpoint in between.
> - **Do not run state-changing verification until reclosure is complete.**
>   `npm run workflow:staging-auth` (section 10) and
>   `npm run check:staging-observability` (section 12) both POST
>   `/internal/admin/sync/full` and `/internal/admin/rollback`; while admission
>   is open, each run adds another publication and pointer transition. The same
>   holds for any manual sync (section 7) or rollback (section 11) beyond the
>   single authorized publication.
> - **Do not open or sync the staging app on retained test clients during the
>   recovery window.**
> - **Do not proceed to checkpoint construction until reclosure and inventory
>   verification have completed.** The client reset, checkpoint and seed all
>   come after reclosure.

### Recovery window record (2026-09-13)

Executed once, under the operator's separate authorization, which also
authorized rotating the staging `ADMIN_TOKEN`. Times are UTC; version times are
Cloudflare's creation times. Source revisions are operator-recorded, because
Cloudflare records each version's source only as `Upload`.

| Step | Record |
|---|---|
| Baseline (18:28:20Z) | Version `00012c06-…` at 100%, `seed:2026`, no `SEASON_PUBLICATION_AUTHORITY`, `PROVIDER_MODE = "mock"`, secret name `ADMIN_TOKEN` only. `active:2026` was `20260912031739186-f641607c` and `previous:2026` was `20260911031751466-6b2dd9d1`. There were 57 retained versions, none with an `__inventory`, and 2287 KV keys. |
| `ADMIN_TOKEN` rotation | A new random value was generated and supplied through `wrangler deploy --secrets-file`, in the reopening deployment only. The temporary secrets file was outside the repository and was deleted immediately after Wrangler read it. The value was never printed, committed or logged. The operator's reusable copy exists only as a Windows-DPAPI-encrypted file, readable by the operator's Windows user, in a private credential directory under that user's profile, outside the repository. The previous token no longer authenticates. |
| Reopening | `wrangler deploy --env staging` of `master` `d50ef2f8daa6e0292274e97a5effe231951cc9fd` created version `38b5169a-6e3b-4e44-aed1-89ef74c0995c` at 18:29:21.732Z, at 100% traffic. It has no cutover control, so admission was open. Authority stayed absent, `PROVIDER_MODE` stayed `mock`, and every binding, the cron and observability were preserved. |
| Read-only status | `GET /internal/admin/sync/status?season=2026` at 18:30:22Z (request `aff46d85-ba23-4f6b-8020-ffec731c0630`) returned 200 with the rotated token. Pointers and the 57 versions were unchanged, and no synchronization was in flight. |
| Manual full synchronization | Exactly one authenticated `POST /internal/admin/sync/full?season=2026` was sent at 18:31:05Z (request `995967b7-9b7a-46dc-97dc-d7c18fdb5beb`) and never retried. It returned HTTP 200, `status: completed` and `season: 2026`, with all six jobs due and none skipped. The publication was `applied`, `releaseVersion` was `20260913183106443-4f683541` and `failureCategory` was `null`. It made one provider request, to the `mock` source, which succeeded. The admin response does not carry the publisher's purge reason, so whether it reported `cache-purge-failed` was not observed. |
| Pointer transition | `active:2026` moved from `20260912031739186-f641607c` to `20260913183106443-4f683541`, and `previous:2026` moved from `20260911031751466-6b2dd9d1` to `20260912031739186-f641607c`. |
| Reclosure | `wrangler deploy --env staging` of `549bb5f3f3ee3963727a816b96fa39752355e9cd`, with no secrets file, created version `c35f99c0-9e89-4dd7-8fbe-449d295fb567` at 18:31:58.035Z, at 100% traffic, with `SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"`. Admission is closed again. Its dry-run bundle was byte-identical to the reopening one. Admission was open from 18:29:21.732Z to 18:31:58.035Z, and no cron fell inside that interval. |
| Post-reclosure status | `GET /internal/admin/sync/status?season=2026` at 18:33:10Z (request `ae19d25b-aa93-460b-b3fe-2fddf4044cf9`) returned 200 with the rotated token, so the secret survived reclosure. It reported the new active and previous versions and 58 retained versions, with the last run completed and `applied`. |
| Inventory verification | KV went from 2287 to 2328 keys. All 41 added keys are under the new release's prefix: 40 documents plus one exact `__inventory` listing exactly those 40 names, sorted and unique. No key under any older version was added or removed, and no publication-metadata sidecar was written. `meta.sourceUpdatedAt` is uniform, at `2026-07-18T11:55:00.000Z`. The repository's own `importRelease`, replayed offline against the stored values, accepts the release with provenance `legacy-uniform-documents` and 40 per-key states. |

**Not done:** no second synchronization, rollback, cron invocation, client
reset, checkpoint or fingerprint, seed, activation, smoke or latency test,
live-provider contact or production contact. `SEASON_PUBLICATION_AUTHORITY`
stayed absent throughout. Production still has no Worker.

**Remaining, in order, each separately authorized:**

1. merge the reclosure configuration, so `master` again carries the closed
   configuration. Until then, every staging deployment of `master` is
   cutover-sensitive;
2. reset the staging app data on the emulator and the reference phone;
3. record durable evidence of that reset;
4. re-run the D12 checkpoint audit;
5. present the exact checkpoint for explicit operator approval;
6. seed only after approval;
7. activate through a later authorization;
8. smoke and latency verification after activation.

**Item 2 narrowed (2026-09-13), then corrected (2026-09-14).** On 2026-09-13
the reference phone item 2 names, the HONOR DNP-NX9, was recorded as
permanently decommissioned from GridView staging instead of being reset. That
record became invalid on 2026-09-14, when the operator reintroduced the same
phone. The Honor 400 Pro is the DNP-NX9, so no different new reference phone
exists. Item 1 is done (PR #24, `ca5142a`). The historical record is
[ADR 0025 D12, "What the client decommissioning record supplies (2026-09-13)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-client-decommissioning-record-supplies-2026-09-13).

**Client-baseline evidence recorded (2026-09-14).** Items 2 and 3 are
recorded through the `authorized-client-baseline-reset` variant, a contract
migration:

- every restorable disk state of the `gv_phase8c2_verify` emulator held no
  staging package;
- the DNP-NX9 received one protected staging build (PR #27 backup isolation),
  which restored no data, and was then cleared, uninstalled and found
  package-absent twice;
- the four locally retained unprotected staging APKs were deleted.

No cloud-backup deletion, real-payload exclusion test or Quick Boot RAM
inspection is claimed. Evidence and limitations:
[ADR 0025 D12, "What the authorized client-baseline reset supplies (2026-09-14)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-authorized-client-baseline-reset-supplies-2026-09-14).

The eligible staging clients are exactly that emulator and that phone. Until
activation:

- no other device or AVD may install, open, run or sync
  `com.sejuma.gridview.staging`;
- never install a staging APK built before PR #27 on either eligible client;
- do not open, run or sync staging on either eligible client, because that
  creates new pre-cutover state.

Breaking any of these invalidates the baseline and requires new evidence.

Separately, and not only until activation: never load the `default_boot`
Quick Boot snapshot of `gv_phase8c2_verify`. Its RAM state was neither
inspected nor retired. First inspect it, or delete the snapshot, under a
separate authorization.

### Season-2026 seed authority (prepared 2026-09-15, not deployed)

The operator approved the exact season-2026 checkpoint on 2026-09-15. It is
recorded, with its derived fingerprint, in
[ADR 0025 D12, "What the approved checkpoint and seed-authority preparation supply (2026-09-15)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-approved-checkpoint-and-seed-authority-preparation-supply-2026-09-15).
The seed refuses with `authority-mode-not-sequencer` unless the authority
mode is exactly `sequencer`. So `wrangler.toml` adds
`SEASON_PUBLICATION_AUTHORITY = "sequencer"` to `[env.staging.vars]` and keeps
`seed:2026`. Development and production set no authority.

- **Merging deploys nothing.** Live staging (`c35f99c0-…`) keeps the
  authority absent. A dry-run of the merged configuration adds it, so
  deploying it is cutover-sensitive under the gate above. It needs its own
  authorization naming `sequencer`, `seed:2026` unchanged, season 2026,
  staging and the reviewed commit.
- **Deploying it seeds and activates nothing.** An `uninitialized` or
  `seeded` season keeps using the legacy KV pointers for publication,
  rollback and public reads. `seed:2026` keeps season 2026's publication and
  rollback paused, and permits only the seed. Publications and public reads do
  start asking the sequencer for each season's cutover state, and fail closed
  if that lookup fails.
- **The seed is a separate authorization.** It must present the approved
  checkpoint verbatim, with every field exactly as recorded. The fingerprint
  is derived from the checkpoint and is not a field of it. `seeded` is not
  `active`.
- **Activation is a later, separate authorization.** It needs a further
  cutover-sensitive deployment that replaces `seed:2026` with `activate:2026`,
  then the fingerprint-bound confirmation.
- **Once the authority value is live, the persistence rule above applies to
  it too.** Omitting or changing it is cutover-sensitive, never routine.

What remains now, in order, each separately authorized:

1. merge the pull request carrying the seed-authority configuration;
2. a cutover-sensitive `wrangler deploy --env staging` of the merged
   configuration, which adds `SEASON_PUBLICATION_AUTHORITY = "sequencer"` to
   live staging and leaves `seed:2026` unchanged;
3. the seed, presenting the approved checkpoint verbatim, only once step 2 is
   live. Before then the seed is refused with `authority-mode-not-sequencer`;
4. activation: a further cutover-sensitive deployment replacing `seed:2026`
   with `activate:2026`, then the fingerprint-bound confirmation;
5. smoke and latency verification after activation;
6. any later production decision.

The client-baseline evidence merge, the checkpoint audit re-run and the
checkpoint approval are done. See the ADR 0025 record linked above.

### Season-2026 seed record and activation phase (2026-09-15)

This supersedes the "Merging deploys nothing" and "What remains now" parts
of the subsection above, which were true when written.

- **Seed authority deployed.** Under separate authorization, one
  cutover-sensitive `wrangler deploy --env staging` of `master`
  `606922488f382f77fbad979aae659dac5721c887` (operator-recorded; Cloudflare
  records only `Upload`) created version
  `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c` at 100% traffic, replacing
  `c35f99c0-9e89-4dd7-8fbe-449d295fb567`. It added
  `SEASON_PUBLICATION_AUTHORITY = "sequencer"` and kept `seed:2026`,
  `PROVIDER_MODE = "mock"` and the existing `PUBLIC_BASE_URL`.
- **Seed committed on the first attempt.** Under a further separate
  authorization, exactly one authenticated `POST` to
  `/internal/admin/publication/cutover/seed` was sent at
  `2026-09-15T20:33:07.492Z` and completed at `2026-09-15T20:33:09.602Z`. It
  returned HTTP `200` with `Cache-Control: no-store` (request
  `c889bfd3-364a-461a-a709-33b8bdf9eb9f`). It presented the approved
  checkpoint verbatim. The receipt reports `seeded`, echoes the checkpoint
  exactly and carries the approved fingerprint. The full receipt is recorded
  in
  [ADR 0025 D12, "What the season-2026 seed supplies (2026-09-15)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-season-2026-seed-supplies-2026-09-15).
- **Resulting state.** The cutover status is `seeded`, phase `seed`,
  `admissionClosed: true`, `authoritative: false`. The legacy pointers did not
  move (active `20260913183106443-4f683541`, previous
  `20260912031739186-f641607c`), and 58 versions are retained. The public
  `/v1/status` and `/v1/seasons/2026/calendar` responses kept their ETags. No
  activation, synchronization, publication, rollback, purge or cron trigger
  occurred.

**Activation phase — prepared, not deployed.** `wrangler.toml` replaces
`seed:2026` with `SEASON_PUBLICATION_CUTOVER_CONTROL = "activate:2026"` and
keeps `sequencer`. Nothing else in the configuration changes.

- **Merging deploys nothing.** A dry-run of the merged configuration differs
  from live staging in the cutover control, so deploying it is
  cutover-sensitive under the gate above. It needs its own authorization,
  naming `activate:2026`, `sequencer` unchanged, season 2026, staging and the
  reviewed commit.
- **Deploying it activates nothing.** `activate:2026` keeps season 2026's
  publication and rollback admission closed, permits the activation route,
  and refuses another seed with `phase-not-permitted`. Season 2026 stays
  `seeded`, and public reads stay on the legacy authority.
- **Activation is a separate authorization.** It is one authenticated `POST`
  to `/internal/admin/publication/cutover/activate` whose body is
  `{"checkpoint": <the approved checkpoint, verbatim>, "confirmActivation": true}`.
  - Any value other than the literal `true` fails as
    `activation-not-confirmed`.
  - A checkpoint that is not exactly the approved one does not reproduce the
    seeded fingerprint, and fails closed.
  - Either failure leaves the seed as it is.
  - The request performs only the durable `seeded -> active` transition, and
    an identical retry returns `already-active`.
- **A successful activation alone resumes the mutators.** No further
  configuration change or deployment is needed.
  - While `activate:2026` is deployed with `sequencer`, every season-2026
    publication and rollback first reads the season's durable authority. It
    stays refused unless the sequencer positively reports the season
    `active` and authoritative.
  - A failed or `unavailable` lookup fails closed. A deployed `seed:2026`
    never reopens the season.
  - After a successful activation, the next publication or rollback is
    admitted through `SequencedPublicationService`. It never reaches the
    legacy publisher. The legacy `active:2026` and `previous:2026` pointers
    are not written and remain historical context.
  - Public reads follow the sequencer from the same moment.
  - Other seasons and the operator cache purge are unaffected.
  - The full record is in
    [ADR 0025 D12, "What the season-2026 seed supplies (2026-09-15)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-season-2026-seed-supplies-2026-09-15).

What remains, in order, each separately authorized:

1. merge the pull request carrying `activate:2026` and the seed record;
2. a cutover-sensitive `wrangler deploy --env staging` of the merged
   configuration, replacing `seed:2026` with `activate:2026` in live staging;
3. the activation `POST` described above, whose success alone resumes season
   2026's publication and rollback through the sequencer;
4. post-activation smoke and latency verification, as a separate step;
5. any later production decision.

### Season-2026 activation-phase deployment and activation (2026-09-16)

This supersedes "Activation phase — prepared, not deployed" and items 1 to 4 of
the list above, which were true when written. Each step below ran under its own
separate authorization.

**Item 1 — merge.** PR #30 merged as `master`
`36b0fd21c31c78a7b213f5c542f4367f8471c1e0`.

**Item 2 — the activation-phase deployment.** One cutover-sensitive
`wrangler deploy --env staging` of that commit. Times are UTC; the source
revision is operator-recorded, because Cloudflare records each version's source
only as `Upload`.

| Deployment | Record |
|---|---|
| Source commit | `36b0fd21c31c78a7b213f5c542f4367f8471c1e0` |
| Previous version | `cccdcf11-0eb0-44cf-8854-1ceb0eb30e2c` |
| New version | `c297d260-c81b-4110-bdf2-7572e1206af3` |
| Deployment interval | `2026-09-16T16:02:49.010Z` to `2026-09-16T16:03:09.042Z` |
| New version created | `2026-09-16T16:03:01.459Z` |
| Traffic | 100% |
| Control transition | `seed:2026` to `activate:2026` |
| `SEASON_PUBLICATION_AUTHORITY` | `sequencer`, unchanged |

No other configuration change was intended or made: `ENVIRONMENT`,
`PROVIDER_MODE`, `PUBLIC_BASE_URL`, every binding, the `ADMIN_TOKEN`
declaration, the cron and observability are unchanged. **No seed or activation
occurred during the deployment.** Immediately afterwards season 2026 was still
`seeded`, phase `activate`, `admissionClosed: true` and `authoritative: false`,
with the approved active version and fingerprint unchanged. **No rollback was
required.**

**Item 3 — the activation.** Exactly one authenticated `POST` to
`/internal/admin/publication/cutover/activate`, never retried, re-presenting
the approved checkpoint verbatim with `confirmActivation: true`.

| Activation | Record |
|---|---|
| Requests sent | Exactly one `POST` |
| Start | `2026-09-16T16:22:11.2531640Z` |
| Completed | `2026-09-16T16:22:11.3570831Z` |
| Response | HTTP `200`, `Cache-Control: no-store` |
| Request ID | `48bc9ea7-87bf-42a6-ae1e-da45e3dbf9fa` |
| Request body | 481 UTF-8 bytes, SHA-256 `ca3766731417914103aff9b9801bcffb8e2c6d9d89b6b67064541bc5707f0fa7` |
| Receipt | `kind` `activated`, `outcome` `activated`, `cutoverState` `active`, `season` `2026`, `activeVersion` `20260913183106443-4f683541`, `previousVersion` `null`, fingerprint `cutover1:38f726065f8cbb7f46525c213013936b9673cdccbb0128ca45a0ecfccd7c9ac2` |

**There is no durable receipt object.** `CutoverActivationReceipt` is the shape
of the HTTP response; the system stores no separate activation-receipt record
and no KV receipt key. The durable proof is the authority record's transition
to `active`, with `authoritative: true`, the unchanged fingerprint and the
committed versions. Do not go looking for a stored receipt — there is none.

**Resulting state.** Two bounded read-only observations minutes apart returned
identical authoritative state: `active`, phase `activate`, `authoritative:
true`, `admissionClosed: false`, the same versions and fingerprint.
**`admissionClosed` became `false`, so the activation alone resumed the
mutators — no third deployment was required.** The legacy `active:2026` and
`previous:2026` pointers remained present and unchanged but **ceased to be
authoritative**. **No publication or rollback was triggered during
activation**, and no synchronization, purge or cron run was either; the 58
retained versions, the synchronization record and the public ETags were
unchanged.

Full record:
[ADR 0025 D12, "What the season-2026 activation supplies (2026-09-16)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-season-2026-activation-supplies-2026-09-16).

### Season-2026 post-activation verification (2026-09-16)

Item 4 of the list above is done, read-only and staging-only. **No live fault
was injected and no live mutation was performed.**

- **Official smoke** (section 8): run **exactly once, unmodified** — 60 HTTP
  requests, **41 checks, exit code 0**. 59 requests are public `GET` or `HEAD`;
  one is a `POST` asserting the unsupported-method contract and is rejected
  with `405` before any handler (section 8).
- **ETag, HEAD and conditional requests** (section 9): three representative
  routes each returned `200` with a weak `W/"gv1-…"` ETag, `HEAD` parity, and a
  conditional `GET` returning `304` with an empty body. No internal
  publication version or storage identity was exposed.
- **Bounded concurrency:** twelve overlapping requests at a measured maximum
  concurrency of 12 returned **twelve `200`s, no `429`, no `5xx`**, one stable
  ETag per route — calendar `W/"gv1-12d59307"`, `generatedAt`
  `2026-09-13T18:31:06.443Z` — and **no mixed-release or fallback signature**.
- **Latency:** 90 measured requests over three public routes, 30 per route, at
  a combined **37.9 requests per minute**, nearest-rank percentiles, **zero
  failures**. Combined **p95 94.7 ms** (`/v1/status` 102.8 ms, calendar
  88.1 ms, home 94.7 ms) against the internal cached-public-API target of
  **p95 at most 300 ms**: **passed**.
- **Fallback:** no live fault injection. Eleven existing local test files and
  **163 tests passed**, covering fail-closed authority lookup, unavailable
  sequencer, non-authoritative `active` answers, unreadable active inventory,
  bounded degraded responses, the positive adjacent-version fallback,
  `no-store` fallback behaviour and the prohibition on falling back to the
  legacy pointers.
- **Final state:** version `c297d260-…` still newest at 100%; season 2026 still
  `active`, authoritative and admission-open; fingerprint, versions and legacy
  pointers unchanged; **58 retained versions**; the KV key set **identical by
  name — 2328 total, 2321 snapshot and 7 non-snapshot**; synchronization state
  **byte-identical**; no new publication version; public ETags unchanged.
  `/v1/status` differed only in request-specific metadata and elapsed
  `snapshotAgeSeconds`, which is expected and left its ETag unchanged.

**Evidence limitations.** The live cron configuration was **inferred**
unchanged because no deployment occurred — it is not readable through the
authorized read-only Wrangler surface. KV listing is eventually consistent. The
Wrangler version list is rolling and capped. No live failure was injected, so
the deployed Worker's degraded paths were never exercised here. The activation
receipt exists as a response, not as a stored object. The latency figure is a
bounded client-observed sample from one interval and one network location: it
establishes **no monthly availability**, and it is **not** a before-and-after
comparison, because no equivalent pre-activation sample was preserved. The
provisional 60 requests-per-minute figure is **not implemented as a Worker
per-IP limiter**.

Full record:
[ADR 0025 D12, "What the post-activation verification supplies (2026-09-16)"](../adr/0025-season-publication-authority-and-rollback-republication.md#what-the-post-activation-verification-supplies-2026-09-16).

**What remains:** a separate **production-readiness assessment and an explicit
operator decision**. Production has never been deployed and is not authorized
for deployment by anything above.

### Publication guard deployment (prepared 2026-09-27, not deployed)

The ADR 0026 D14-D16 publication guard now exists on the sequenced publication
path (Implementation Plan §14.0.26; ADR 0025 D4, "Amendment (2026-09-27): the
expected-predecessor binding"). It leaves `SEASON_PUBLICATION_CUTOVER_CONTROL`
and `SEASON_PUBLICATION_AUTHORITY` unchanged, so the var comparison above would
call it ordinary. **Treat it as cutover-sensitive anyway.** Deploying it changes
how staging publishes and rolls back season 2026, the one season the sequencer
is authoritative for:

- **Every season-2026 publication and rollback is compared with the active
  release.** The candidate must keep every classified round of the active
  release. It must also keep every `(round, driver)` participation fact of that
  release with the same constructor.
  - Otherwise it is withheld as `rejected`, with
    `guard-round-coverage-regression`, `guard-participation-fact-removed` or
    `guard-constructor-replaced`, and the active release keeps serving.
  - **Rollback has no exemption.** A rollback to a release that lacks any of
    those rounds or facts, or names another constructor, is refused the same
    way.
- **`prepare` binds the comparison to the active release.** A candidate
  compared against a release that is no longer active fails as
  `guard-predecessor-stale`. The next scheduled run compares against whatever
  is active then; nothing is rebuilt automatically.
- **Missing or invalid active-release data fails closed.** If the active
  release's inventory or a results document cannot be read, the run fails as
  `guard-predecessor-unavailable`. If it is invalid or does not match the
  sequencer's committed revisions, the run fails as `guard-predecessor-invalid`.
  - Both block publication **and** rollback for season 2026 until resolved.
  - No correction or break-glass mechanism exists (ADR 0026 curator decision
    C4).
- **Lost sequencer answers are uncertain, not failures of the candidate.**
  - A lost `finalize` answer is re-driven once. A commit that happened is then
    reported as applied.
  - If the re-drive's answer is lost too, the authority is read once. If it
    serves this run's candidate version, the run is reported as applied and
    the current-season update and cache purge run as usual. Otherwise the run
    fails as `sequencer-authority-unavailable`, deletes nothing, and the next
    scheduled run finds whichever version is authoritative. Nothing polls.
  - A lost `prepare` answer is reported as `sequencer-authority-unavailable`
    and never retried. An operation it may have prepared holds the season for
    at most 15 minutes, then expires.
- **Mixed versions fail closed.** While a Worker with the guard talks to a
  sequencer object still running older code, every `prepare` is refused as
  `state-corrupt` (reported as `sequencer-prepare-rejected`). An operation that
  such an object prepared expires after 15 minutes.

**The fail-closed mock predecessor (ADR 0026 curator decision C2).** Staging's
active season-2026 release was published from the mock provider. The mock's
only classified race is **round 12** (the Italian Grand Prix), with five
participation facts:

| Driver | Constructor |
|---|---|
| `max-verstappen` | `red-bull` |
| `lando-norris` | `mclaren` |
| `oscar-piastri` | `mclaren` |
| `charles-leclerc` | `ferrari` |
| `lewis-hamilton` | `ferrari` |

Every later season-2026 candidate must keep round 12 classified with those five
facts:

- A mock candidate is identical, so ordinary mock synchronization passes.
- A future real candidate that lacks any of them is withheld until a correction
  mechanism is accepted.

The live release itself was not inspected here; the mock generator is its
proxy. An offline comparison against the privately preserved 2026-09-24 race
results found all five facts, with the same constructors, in both real round 1
and real round 12. So the comparison exposed no staging cutover blocker. No
provider was contacted for it.

Before running the deploy command above for a Worker that contains the guard,
the operator must hold explicit, separate authorization. It must name:

- the reviewed commit;
- staging;
- season 2026;
- that the deployment changes season-2026 publication and rollback behaviour.

Merging the pull request does not authorize the deployment.

### Coordinated runtime composition (prepared 2026-09-27, not deployed)

The dormant coordinated runtime composition is in `master` (Implementation
Plan §14.0.29). It changes no committed var, cron or binding: staging stays
`PROVIDER_MODE = "mock"`, the cron stays `17 3 * * *`, and no ledger binding
exists. **Treat a deploy that carries it as cutover-sensitive anyway**, under
the same authorization the publication guard needs:

- `/v1/status` now reads season 2026's active version from the sequencer, not
  from the stale legacy `active:2026` pointer. Its `snapshotAgeSeconds` and
  ETag therefore follow the sequencer-active release.
- `PROVIDER_MODE` now admits `coordinated`. Deploying code that admits it does
  not select it. With staging on `mock`, the scheduled handler and every admin
  route behave exactly as before, and the coordinated runtime is never
  reached.

**Selecting `coordinated` is a separate, later authorization.** It must name
the mode change, staging and season 2026. Until a reconciliation ledger
exists and is bound, a staging Worker with `coordinated` selected makes **no
provider request**:

- every scheduled run writes one `sync.coordinated.withheld` warn line with
  `coordinationMissingDependencies` including `ledger-unbound`;
- `POST /internal/admin/sync/full` answers 503 with the same closed reasons;
- since 2026-10-06 both entry points are **wired** to the reconciliation
  orchestration (Implementation Plan §14.0.41), behind that same gate. Wired
  is not active: without a bound ledger the gate refuses first, so nothing
  is leased, reserved, requested or published. Binding a ledger is its own
  activation step and its own authorization;
- `sync/resource` and `rebuild/home` answer 409 `SYNC_MODE_UNSUPPORTED`;
- mock synchronization stops, so the last published release keeps serving.

### A3.5 standings predecessor gate (prepared 2026-09-29, not deployed, never run)

ADR 0023 A3.5 item 2 lets an empty standings candidate replace only a release
with no classified race round. That keeps a published non-empty table from
being emptied **only if the active release is itself coherent**: its driver
and constructor standings are both non-empty exactly when it has at least one
classified race round. Staging's active season-2026 release came from the mock
provider, not from coordinated assembly, so this read-only gate must pass
**before any staging activation of coordinated mode**. If it refuses, or
cannot be run, activation stops for an owner decision. Nothing in this
repository runs it.

**What it is.** One read-only admin route (Implementation Plan §14.0.36):

```text
GET /internal/admin/publication/standings-predecessor?season=2026
```

- It asks the sequencer for season 2026 and examines only the release that is
  `active` **and** authoritative. It never reads the legacy `active:2026`
  pointer.
- It reads that release's classified race rounds (the D14 read) and both
  standings tables, and validates each table row by row.
- It re-reads the authority and reports only a release that is still active.
- It writes nothing: no pointer, sequencer record, ledger, cache purge or log
  content beyond the season, the version and a closed reason.

**Preconditions.**

1. The deployed staging Worker must contain the gate. Version `c297d260-…`
   (from `36b0fd2`) does **not**. The deploy that adds it also carries the
   publication guard and the coordinated runtime composition above, so it is
   cutover-sensitive and needs the explicit, separate authorization those
   subsections describe. Merging does not authorize it.
2. Running the gate is a separate, explicit operator step. It must name
   staging, season 2026 and this read-only check.
3. `SEASON_PUBLICATION_AUTHORITY` must still be `sequencer`, and season 2026
   must still be `active` and authoritative (the cutover `status` route).

**Procedure (PowerShell).** Export the token for this shell only, as section 4
describes, and send exactly one request. `Invoke-WebRequest` keeps the token
in process memory, out of the command line and history:

```powershell
$env:GRIDVIEW_STAGING_ADMIN_TOKEN = Read-Host "Staging admin token"
$uri = "https://gridview-api-staging.sejuma18.workers.dev/internal/admin/publication/standings-predecessor?season=2026"
$headers = @{ Authorization = "Bearer $env:GRIDVIEW_STAGING_ADMIN_TOKEN" }
try {
  $r = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -UseBasicParsing
  "$($r.StatusCode) $($r.Content)"
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    "$([int]$resp.StatusCode) $((New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd())"
  } else { "no response" }
} finally {
  Remove-Item Env:\GRIDVIEW_STAGING_ADMIN_TOKEN
}
```

**Reading the answer.**

| Answer | Meaning | Next step |
|---|---|---|
| `200`, `data.kind` `coherent` | The active release's two tables agree and are non-empty exactly when a race round is classified. `data.activeVersion` names the release checked. | Record the request ID, `activeVersion`, `classifiedRace` and `standings`. The gate has passed **for that version only**. |
| `409`, `data.reason` `authority-changed` | No verdict: the active release changed during the check, so nothing was concluded about any release. | Confirm with the cutover `status` route that season 2026 is still `active` and authoritative, then run the gate **once** more. A second `authority-changed` means publication is not quiet: **stop** and find out why. |
| `409`, any other `data.reason` | `data.reason` is one closed value (listed below), about the release that was still active when the check finished. | **Stop.** Activation needs an owner decision. Do not retry to get a different answer, and do not repair, roll back or republish the release to make the gate pass. |
| `401`, `404`, `405`, `5xx`, no response | The gate did not run: wrong token, a Worker without the route, or an outage. | **Stop.** An unrun gate is not a pass. |

The closed refusals:

- `authority-not-sequenced`, `authority-unavailable` or
  `authority-not-active`: the release was not examined.
- `authority-changed`: the active release changed during the check. Every
  refusal below is reported only after the authority confirms that the same
  release is still active, so a defect of a superseded release is never
  reported.
- `release-unavailable`: a read failed or read as absent (possibly Workers KV
  visibility lag). It is never read as an empty table.
- `release-invalid` or `standings-invalid`: a document is not a valid release
  or standings table.
- `standings-missing`: the release lacks a standings document.
- `standings-tables-disagree`: one table is empty and the other is not.
- `standings-without-classified-round`: rows but no classified race round. This
  is the shape that would let an empty candidate pass D14 vacuously.
- `classified-round-without-standings`: a classified race round with two empty
  tables.

**Expected answer, not observed.** The mock generator's release (round 12
classified, both tables non-empty) is `coherent` with `classifiedRace`
`present` and `standings` `non-empty` in the repository tests. The live
release has not been inspected. The daily mock synchronization may have
published newer versions since the 2026-09-16 activation.

**Binding the result to activation.** The answer describes one version.

- If any season-2026 publication or rollback happens after the gate passes,
  the pass no longer applies. That includes the `17 3 * * *` mock
  synchronization.
- Run the gate again immediately before the `PROVIDER_MODE = "coordinated"`
  change. Confirm that its `activeVersion` is still the version the cutover
  `status` route reports.

**Limits. Do not claim more than this.**

- A published standings table carries **no round**, so the gate **cannot
  prove which round a table describes**. A non-empty table bound to another
  round passes beside a classified race round. It checks only the emptiness
  correspondence that A3.5 item 2 depends on.
- A pass does not keep any later release coherent. That is round coherence
  (A3.5 item 1) plus D14, for coordinated candidates.
- It does not observe Jolpica's real pre-season response. It cannot detect a
  table that lost its last row with `total` lowered to match.
- It is not a substitute for any other activation prerequisite: O-9, O-15,
  O-16, the ledger binding and resolver, and the cron change all stay open.

### Reconciliation operator routes and attention line (prepared 2026-10-05, not deployed, never run)

PR-E2 adds the operator surface for the coordinated runtime's reconciliation
ledger (ADR 0020 "E2"). It is in no deployed Worker. Staging's deployed
version (`c297d260-…`) predates it, and staging stays on `mock`.

**Today every one of these routes refuses.** No environment binds a ledger,
so a Worker that contains them answers each `503` with
`data.status` `reconciliation-unavailable` and reads nothing. On `mock` or
`none` the reasons are `provider-mode-not-coordinated` and `ledger-unbound`.
On `coordinated` the reason is `ledger-unbound` alone. That is the expected
answer, not a fault. **Do not send a mutating request to staging** until a
separate authorization covers the deploy that binds the ledger (activation
step 3). That authorization must name the route, staging and season 2026.

**Routes.** All need `Authorization: Bearer <ADMIN_TOKEN>`, answer
`Cache-Control: no-store`, and are not in the public OpenAPI.

| Route | Method | Body | Effect |
|---|---|---|---|
| `/internal/admin/reconciliation?season=YYYY` | `GET` | none; `season` is the only query parameter | Reads the season's ledger state. Takes no lease, writes nothing, and works while a run holds the lease. |
| `/internal/admin/reconciliation/hold` | `POST` | `{season, expectedSeasonRecordVersion, operationId}` | Sets the operator hold. Nothing publishes for the season until it is released. |
| `/internal/admin/reconciliation/release-hold` | `POST` | same | Clears the hold and makes publication due now. **Release is consent**: the next tick publishes through every guard, including content a rollback replaced. |
| `/internal/admin/reconciliation/clear-block` | `POST` | same | Clears a durable block (`classification-superseded` or `backlog-capacity-exceeded`) and makes publication due now. It never clears a hold. |
| `/internal/admin/reconciliation/disposition` | `POST` | `{season, round, action, operationId, expected: {recordVersion, contentRevision, stagedRevision, competingRevision}}` | T12 for one staged round: `accept-staged`, `accept-competing` or `retain-published`. Releases its backlog slot. It publishes nothing. |
| `/internal/admin/reconciliation/verification` | `POST` | `{season, round, operationId, expectedStagedRevision, expectedVerificationGeneration}` | PR-E3: **one Jolpica request** for one staged round, recording a candidate, a competing correction or a failed attempt (T11-T11c). Decides nothing. See "Operator verification" below. |
| `/internal/admin/reconciliation/verification-history?season=YYYY&round=N` | `GET` | none; `season` and `round` are the only query parameters | PR-E4: reads one round's whole verification history and its `historyDigest`. Takes no lease and writes nothing. The archive source before a rotation. |
| `/internal/admin/reconciliation/verification-rotation` | `POST` | `{season, round, operationId, expected: {recordVersion, verificationGeneration, historyDigest}, historyArchived: true}` | PR-E4: clears one round's **full** verification history into the next generation, under an operator hold. Reaches no provider. See "Verification-history rotation" below. |
| `/internal/admin/rollback` | `POST` | `{version?}` (existing) | In `coordinated` mode only: runs the existing rollback once, **only while the season is held**, with D14/D15 unchanged. `mock` and `none` are unchanged. |

- `season` is always named in the request. These routes never use
  `meta:current-season`. The coordinated rollback keeps the existing season
  resolution, and checks the hold on whichever season that resolves to.
- `operationId` is a **new lowercase UUID v4 per action**, generated by the
  operator and recorded in private evidence. Resending the same ID is safe: it
  answers `already-applied` and writes nothing.
- `expectedSeasonRecordVersion` is `seasonRecordVersion` from an inspection
  just made (`0` when the season has no record). The `expected` values of a
  disposition are copied from that round in the same inspection.
- The audit trail is one `warn` `reconciliation.operator-action` line per
  request, with `operationId` and `operatorAuthMethod: shared-admin-token`.
  The shared token identifies no person (OD-2): who acted lives only in the
  private evidence record.

**Answers.**

| HTTP | `data.status` / `error.code` | Meaning | Next step |
|---|---|---|---|
| `200` | `read` | Inspection succeeded. | Record `seasonRecordVersion` and the values the next action needs. |
| `200` | `applied` | The action was written. `data.state` is the season after it. | Record the request ID, operation ID and new version. |
| `200` | `already-applied` | This operation ID was already applied. Nothing was written. | None. This is the answer to a safe resend. |
| `400` | `INVALID_PARAMETER` (`invalid-season`, `invalid-body`, `body-too-large`) | The request was refused before the ledger was read. | Fix the request. Unknown, missing or ill-typed fields refuse the whole body. |
| `401` / `405` | `UNAUTHORIZED` / `METHOD_NOT_ALLOWED` | Refused before anything was read. | Check the token or the method. |
| `409` | `run-in-progress` | A run or another operator action holds the season's lease. | Wait for the run to finish (the lease lasts at most 10 minutes), inspect again, and retry with the new version. |
| `409` | `refused`, `reason` `version-conflict` | The season or round changed since it was inspected. | Inspect again. Decide again on the new state, with a **new** operation ID. |
| `409` | `refused`, `reason` `operator-precondition-failed` | The state does not allow the action: a hold already set, no hold to release, no durable block to clear, or a disposition whose revisions differ from the record. | Inspect. Nothing was written. |
| `409` | `refused`, `reason` `operation-id-reused` | The ID names a different action already taken. | Use a new ID. |
| `409` | `refused`, `reason` `lease-expired` / `lease-superseded` / `lease-not-held` | The action's lease ended before it committed. Nothing was written. | Inspect, then retry with the same ID. |
| `409` | `refused`, `reason` `backlog-entry-missing`, `revision-history-capacity`, `superseded-revision-reapplied` | T12 cannot apply. A full revision history is a dead end (ADR 0020 E1). | **Stop.** Owner decision. |
| `409` | `publication-not-held` | Coordinated rollback without a hold. The publisher was not reached. | Hold first, then roll back. |
| `409` | `rejected` with a `guard-*` reason | Coordinated rollback refused by D14/D15. The hold stays. | **Stop.** Do not release the hold to retry. Owner decision. |
| `503` | `reconciliation-unavailable` | Not `coordinated`, or no ledger bound. Nothing was read. | Expected today. |
| `503` | `ledger-unavailable` | The ledger could not be reached. | Retry later with the same operation ID. |
| `503` | `outcome-unknown` | The write's answer was lost. It may have committed. | **Resend the same request with the same operation ID.** The answer settles it as `applied` or `already-applied`. |

**Coordinated rollback procedure** (after step 3, separately authorized):

1. Inspect, and record `seasonRecordVersion`.
2. `hold` with that version and a new operation ID.
3. `POST /internal/admin/rollback`. A `409` `rejected` with a `guard-*`
   reason means the target would drop a classified round or a participation
   fact. The hold stays; stop.
4. Inspect again, and confirm the hold. Ticks now observe but never
   publish, and the attention line repeats every scheduled tick.
5. `release-hold` only when republishing whatever upstream then serves is
   acceptable. If upstream has not changed, that republishes the content the
   rollback replaced.

**Disposition procedure (T12):** inspect, choose the round, copy its
`recordVersion`, `contentRevision`, `stagedCorrection.revision` and
`competingCorrection.revision` (or `null`) into `expected`, and send one
action with a new operation ID. The next scheduled run publishes only if
Jolpica then serves the accepted revision. `retain-published` rejects that
exact staged revision permanently (OD-4).

**Attention line.** `reconciliation.attention` is one line per scheduled
run while a season is held, durably blocked, or the global review backlog
holds at least 48 of its 60 slots: `warn`, or `error` at 60 of 60. It
carries `season`, `reconciliationAttention` (closed conditions),
`durableBlockReason`, `backlogCount` and `backlogCapacity`, and nothing else.
**It is written only by the coordinated orchestration.** Since 2026-10-06
the scheduled handler is wired to it, behind a gate that needs a bound
ledger (Implementation Plan §14.0.41). No ledger is bound and no deployed
Worker carries the wiring, so no deployed Worker can write it yet. Binding
the ledger and deploying are activation steps.

**Staging daily review (OD-1).** OD-1 accepts a daily operator review for
staging. **It is not alert delivery**: nothing pages anyone, and production
needs a verified delivery path that does not exist. Once a staging Worker
runs the orchestration with a bound ledger, once a day:

1. In the Cloudflare dashboard, open Workers Logs for the staging Worker
   (persisted by `[env.staging.observability.logs]`). Search the last 24 hours
   for `reconciliation.attention`, `reconciliation.operator-action` and the
   `warn` and `error` lines of `sync.coordinated.observation`. This search
   has not been exercised against real staging logs yet.
2. Inspect season 2026 with the read-only route. Confirm that the hold,
   durable block and backlog it reports match the attention lines.
3. For each condition, decide: keep a hold, release it, clear a durable block
   once its cause is understood, or dispose of a staged round. Any mutation
   needs its own authorization.
4. Record the review privately, never in the repository: date, request IDs,
   `seasonRecordVersion`, every condition seen, every operation ID used and
   who acted. **Never record the token.**

A day without a review leaves a stopped season unseen until the next one
(residual risk R7).

### Operator verification (prepared 2026-10-05, not deployed, never run)

PR-E3 adds `POST /internal/admin/reconciliation/verification` (ADR 0020
"E3"). It is in no deployed Worker. Like the routes above, it answers `503`
`reconciliation-unavailable` today, having read nothing.

**A verification is a Jolpica request.** Once a ledger is bound, each call
can send one real classification request. **Every verification needs its own
written authorization** naming staging, season 2026, the round and the
staged revision. Without one, do not send it. Never verifying is a supported
steady state: a staged round simply waits for a disposition.

**What it does.** For one staged round, it asks Jolpica once for the round's
classification and records what it saw (T11-T11c):

- a new revision becomes the **candidate**;
- the same candidate on a **later** verification becomes the **competing
  correction**, and the round becomes `review_locked`;
- the staged or accepted revision discards a pending candidate, and a third
  revision replaces it;
- a failed request records only the attempt.

**It never decides anything.** It never accepts or rejects a correction,
publishes, clears a hold or block, or changes accepted or published content.
Deciding remains the disposition (T12) above.

**Request.** `Authorization: Bearer <ADMIN_TOKEN>`, with this body:

```json
{"season": 2026, "round": 3, "operationId": "<new lowercase UUID v4>",
 "expectedStagedRevision": "<stagedCorrection.revision from an inspection>",
 "expectedVerificationGeneration": <verificationGeneration from the same inspection>}
```

The checks run in this order: authentication, method, the strict body,
`coordinated` mode and a bound ledger, and the coordinated runtime's own gate
(limiter, sequencer authority, purge origin). Then, under the season lease:

1. the round's verification generation (PR-E4);
2. a resent operation ID;
3. the staged revision and its backlog entry;
4. the review lock;
5. the round's earliest time (`anchor + 5h`).

Only then is the one request sent, and it is never retried.

**Answers.**

| HTTP | `data.status` | Meaning | Next step |
|---|---|---|---|
| `200` | `verified` | Recorded. `transition` and `match` say what was seen. `comparison` is the OD-7 view. | Record the request ID, operation ID and transition privately. |
| `200` | `already-applied` | This operation ID was already recorded. Nothing was sent or written. The comparison is not repeated (`not-repeated`). | None. |
| `502` | `provider-failed` | Jolpica failed (`check-failed`, T6). Only the attempt was recorded. The candidate is kept. | A new authorization and a **new** operation ID to try again. |
| `502` | `observation-refused` | The answer was not a usable classification. Nothing was recorded. | Investigate before any retry. |
| `429` | `deferred` | The limiter deferred the request until `retryAt`. Nothing was sent. Only that instant was recorded, which also defers the season's scheduled runs until then. | Retry after `retryAt` with the **same** operation ID. |
| `409` | `precondition-failed`, `reason` `staged-revision-mismatch` / `not-staged` / `backlog-entry-missing` | The target is stale or not staged. Nothing was sent or written. | Inspect again. |
| `409` | `precondition-failed`, `reason` `review-locked` | A competing correction already exists (T11d). Nothing was sent. | Dispose (T12). |
| `409` | `precondition-failed`, `reason` `verification-history-full` | The round already has 32 verifications in this generation. Nothing was sent. | Only with an authorization for it: "Verification-history rotation" below. Otherwise stop. |
| `409` | `precondition-failed`, `reason` `verification-generation-mismatch` | The request names another verification generation than the round's: a request formed before a rotation, or a stale or future value. Nothing was sent or written. | **Never edit an old request's generation to resend it.** Inspect again, and form a new verification with a **new** operation ID. |
| `409` | `precondition-failed`, `reason` `not-eligible` / `lease-expired` / `operation-id-reused` | The round is not yet eligible, the lease ran out, or the ID named another target. | Wait, retry, or use a new ID. |
| `409` | `run-in-progress` | A run or operator action holds the lease. Nothing was sent. | Retry later with the same ID. |
| `503` | `coordinated-runtime-unavailable` / `not-attempted` / `ledger-unavailable` | Nothing was sent, or nothing is known to be written. | Fix the cause. Retry with the same ID. |
| `503` | `outcome-unknown` | Sent, and the write's answer was lost. | **Resend with the same operation ID.** If it committed, the answer is `already-applied` with no new request. |

**The OD-7 comparison.** It is shown only for a fresh, valid result. The base
is the **published** document, the active release's
`grand-prix:{round}:results`, never the accepted revision.
`publishedIsAccepted` says whether they are the same. It shows these fields
only:

- `counts`;
- `drivers` (`added`, `removed`, `changed`: sorted canonical driver IDs);
- `resultFields`;
- `entryFields`: the names of changed fields.

**It never shows a value**, old or new. Otherwise it is `unavailable` with a
closed reason. It is never logged or stored, so record what you need from the
answer privately. **Never record the token.**

**Limits.**

- Every verification ID of each round's **current generation** is
  remembered. Resending any of them within its generation, however old,
  answers `already-applied` and sends nothing. After a rotation, a request
  from the earlier generation is refused `verification-generation-mismatch`
  and sends nothing. Use a **new** ID for each intended verification: a
  rotated generation's IDs are forgotten, so reusing one in the new
  generation would be a new verification.
- A round holds at most 32 verifications per generation. The 33rd is
  refused (`verification-history-full`) until an authorized rotation.
- The verification holds the season lease during its request. A scheduled
  tick in that window sends nothing (`run-in-progress`).
- It spends the shared limiter's capacity. No reserve is set aside for
  operators.

**Audit.** One `warn` `reconciliation.verification` line carries the
outcome, the transition, the match, `compared` or the comparison's reason,
the request count, the operation ID and `shared-admin-token`. It carries no
revision, driver ID, field name or count. Inspection shows the round's
`verificationGeneration`, `verificationCount`, `lastVerification` and
`lastVerificationReset`.

### Verification-history rotation (prepared 2026-10-06, not deployed, never run)

PR-E4 adds the read-only `GET /internal/admin/reconciliation/verification-history`
and `POST /internal/admin/reconciliation/verification-rotation` (ADR 0020
"E4"). They are in no deployed Worker, and today both answer `503`
`reconciliation-unavailable`, having read nothing.

**What it is for.** It is the only way to verify a round again after its
history is full. It clears that round's 32 verifications, raises its
`verificationGeneration` by one and records a receipt. It never touches the
staged, candidate or competing slots, the accepted or published content, the
backlog or Workers KV. It reaches no provider. **Every rotation needs its own
written authorization** naming staging, season 2026 and the round.

**Preconditions.** All of these must hold, or the rotation is refused and
nothing is written:

- an operator **hold** on the season, which stops its publication until it is
  released;
- a full history (32 entries);
- no competing correction (`review_locked`). Dispose of it first (T12);
- the record version, generation and history digest the operator archived.

**Procedure:**

1. **Settle every `outcome-unknown` verification of the round** by resending
   it with its own operation ID until it answers. After a rotation, its
   resend is refused `verification-generation-mismatch`, and only the archive
   can show whether it committed.
2. Inspect. If the season is not held, `hold` it with a new operation ID.
3. `GET …/verification-history?season=2026&round=N`. **Archive the whole
   answer privately, never in the repository**, with the request ID and the
   date. It holds every entry: operation IDs, instants, the staged revision
   asked about and each transition. Check the digest:
   `sha256:` + the hex SHA-256 of `JSON.stringify(data.entries)` must equal
   `data.historyDigest`.
4. Send the rotation with a **new** UUID v4, copying `recordVersion`,
   `verificationGeneration` and `historyDigest` from that archived answer, and
   `"historyArchived": true`. Only send `true` once the archive is stored.
5. Record the answer's receipt privately: `fromGeneration`, `toGeneration`,
   `clearedCount` and `clearedDigest`. The answer never repeats the cleared
   entries. The archive from step 3 is their only copy.
6. Verify again only with a new authorization, the new
   `expectedVerificationGeneration` and new operation IDs.
7. Release the hold only when republishing whatever upstream then serves is
   acceptable. Release is consent to publish.

**Answers.**

| HTTP | `data.status` / `error.message` | Meaning | Next step |
|---|---|---|---|
| `200` | `applied` | Rotated. `receipt` names both generations, the count and the digest. | Record the receipt privately. |
| `200` | `already-applied` | This rotation was already applied. Nothing was written. | None. This is the answer to a safe resend. |
| `400` | `history-archive-not-acknowledged` | `historyArchived` was `false`. Nothing was read. | Archive first (step 3). |
| `400` | `invalid-body` / `invalid-season` / `invalid-round` / `body-too-large` | Refused before the ledger was read. | Fix the request. |
| `404` | `not-recorded` (history read) | The ledger holds no record for the round. | Check the round. |
| `409` | `run-in-progress` | A run or operator action holds the lease. | Retry later with the same request. |
| `409` | `refused`, `verification-generation-mismatch` | Another generation than the round's. After a later rotation, **this is what an older rotation's resend gets**: it never rotates again. | Inspect; nothing was written. |
| `409` | `refused`, `version-conflict` / `verification-history-digest-mismatch` | The record or its history changed since the archive. | Start again at step 1. |
| `409` | `refused`, `operator-hold-required` | The season is not held. | Hold first (step 2). |
| `409` | `refused`, `review-locked` | A competing correction exists. | Dispose of it (T12) first. |
| `409` | `refused`, `verification-history-not-full` | Fewer than 32 entries. Rotation is never a routine reset. | None needed. |
| `409` | `refused`, `verification-generation-exhausted` | The generation cannot be raised. | **Stop.** Owner decision. |
| `409` | `refused`, `operation-id-reused` | The ID named a verification or another rotation, or the same ID named another history. | Use a new ID. |
| `503` | `outcome-unknown` | The write's answer was lost. | **Resend the identical request.** It answers `already-applied` if it committed, and never rotates twice. |
| `503` | `reconciliation-unavailable` / `ledger-unavailable` | Not `coordinated`, no ledger, or the ledger could not be reached. | Expected today; otherwise retry with the same request. |

**Audit.** One `warn` `reconciliation.verification-rotation` line carries the
outcome, any refusal reason, the generations, the cleared count, the
operation ID and `shared-admin-token`. It never carries the digest, a
revision or a cleared operation ID. The history read writes one `info` line
naming only the round and the outcome.

## 7. Initial synchronization and publication

**Not for season 2026 between the deploy of a `SEASON_PUBLICATION_CUTOVER_CONTROL`
naming season 2026 (`seed:2026` or `activate:2026`) and that season's successful
D12 activation.** Inside that window season 2026's legacy publication admission
is closed and this command is rejected for it — see [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary).
**Season 2026 was activated on 2026-09-16, so that window is closed for it:**
this endpoint is admitted for season 2026 again and publishes through the
sequencer, never through the legacy pointers. That is a real staging mutation
and still needs its own authorization. The control remains `activate:2026` in
deployed staging; a live control alone no longer bars the endpoint once the
season it names has been activated.
This section remains the correct workflow for any season whose admission is
still open (a season not covered by a live cutover control, or before this
control is deployed). **Season 2026's temporary recovery window (section 6) was
not such an opening:** there this endpoint could run only as the single
authorized publication, if that authorization named it.

The Worker starts with an empty KV namespace and serves controlled empty/`404`
responses until the first release is published. Seed it through the admin
sync endpoint (authenticated):

```text
curl -i -X POST https://gridview-api-staging.sejuma18.workers.dev/internal/admin/sync/full \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

To make the first release deterministic, the mock provider accepts **temporary**
override variables for a single seeding deploy — `MOCK_PROVIDER_SOURCE_UPDATED_AT`
and `MOCK_PROVIDER_CONTENT_VERSION`. These are seeding aids only and **must not**
be committed as permanent `[env.staging.vars]`; the permanent staging provider
configuration is `PROVIDER_MODE = mock`. After seeding, redeploy without the
overrides so the committed configuration is authoritative.

A successful publication writes the full versioned document set, the
`previous:{season}` pointer (if any), content/season metadata, and finally the
`active:{season}` pointer. Publication provenance is `status: "mock"` — the data
is non-authoritative.

For a sequencer-active season (season 2026 in staging), a Worker that contains
the publication guard refuses a candidate that loses a classified round or a
participation fact of the active release, or that changes one of its
constructors. See section 6, "Publication guard deployment (prepared
2026-09-27, not deployed)".

## 8. Public smoke tests

All public routes are unauthenticated `GET`/`HEAD`:

```text
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/status
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/seasons/2026/calendar
curl -i https://gridview-api-staging.sejuma18.workers.dev/v1/home?season=2026
```

The bundled `scripts/staging-smoke.mjs` walks every public OpenAPI route:

```text
npm run smoke:staging -- https://gridview-api-staging.sejuma18.workers.dev
```

**The script is read-only, but it is not strictly `GET`/`HEAD`.** A full run
issues **60 requests and asserts 41 checks**. 59 requests are public `GET` or
`HEAD`; **one is a `POST` to `/v1/seasons/2026/calendar`**, which exists to
verify the unsupported-method contract (`405`, `Allow: GET, HEAD`,
`Cache-Control: no-store`, `error.code = METHOD_NOT_ALLOWED`). That request is
rejected at the Worker entry point **before routing, storage, the publisher or
any sequencer logic is reached**, so it cannot mutate anything and it is safe
to run against a live cutover season. Do not describe this script as
`GET`/`HEAD`-only. It last ran unmodified on 2026-09-16 with exit code 0
(section 6, post-activation verification).

## 9. ETag, HEAD and 304 verification

Success snapshot responses carry a **weak** ETag derived from
`api version + resource identity + contentVersion` (the per-request `requestId`
in the body prevents a strong byte ETag). Verify:

- A first `GET` returns `200` with `ETag: W/"..."`.
- Repeating the `GET` with `If-None-Match: <that ETag>` returns `304` with no
  body and an `X-Request-ID`.
- The same route with `HEAD` returns headers and **no** body.
- After a new content version is published, the ETag changes.

## 10. Admin-security workflow

- No `Authorization` header, or an invalid token → `401` (identical generic
  unauthorized shape for missing vs invalid).
- A valid `Bearer <ADMIN_TOKEN>` → `200`.
- State-changing admin paths reject `GET` (`405`).
- Public write attempts are rejected.

Automated:

```text
npm run check:staging-admin -- https://gridview-api-staging.sejuma18.workers.dev
npm run workflow:staging-auth -- https://gridview-api-staging.sejuma18.workers.dev
```

(Both read `GRIDVIEW_STAGING_ADMIN_TOKEN` from the environment; see section 4.)
`workflow:staging-auth` changes state — it POSTs `/internal/admin/sync/full`
and `/internal/admin/rollback`. The season-2026 reclosure it originally waited
on completed on 2026-09-13, and **season 2026 was activated on 2026-09-16**, so
both POSTs are now admitted for that season and run through the sequencer, each
creating a real publication or rollback. Do not run it without the separate
authorization a season-2026 mutation requires. `check:staging-admin` only reads status,
probes rejected methods and purges the cache.

## 11. Rollback workflow

**Not for season 2026 between the deploy of a `SEASON_PUBLICATION_CUTOVER_CONTROL`
naming season 2026 (`seed:2026` or `activate:2026`) and that season's successful
D12 activation.** Legacy rollback admission for that season is closed by the
same deploy that closes publication admission (section 7) — see
[ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary).
**Season 2026 was activated on 2026-09-16, so that window is closed for it:**
rollback is admitted for season 2026 again and runs through the sequencer,
never through the legacy pointers. That is a real staging mutation and still
needs its own authorization. The control remains `activate:2026` in deployed
staging; a live control alone no longer bars rollback once the season it names
has been activated.
This section remains the correct workflow for any season whose admission is
still open. **It was not for season 2026 during that season's temporary
recovery window (section 6) either.**

Rollback repoints `active:{season}` to a verified previous/target release:

- A rollback with no available target returns `409` and preserves the active
  release.
- A valid rollback restores the prior release and its ETag.

```text
curl -i -X POST https://gridview-api-staging.sejuma18.workers.dev/internal/admin/rollback \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

The publisher verifies the target has its complete document set before writing
the pointer; a cache-purge failure is reported but never undoes the pointer
change.

For a sequencer-active season, rollback republishes the target as a new
release (ADR 0025 D8). A Worker that contains the publication guard refuses a
rollback whose target lacks a classified round or a participation fact of the
active release, or names another constructor for one of those facts. There is
no rollback exemption. See section 6, "Publication guard deployment (prepared
2026-09-27, not deployed)".

**In `coordinated` mode (prepared 2026-10-05, not deployed),** a Worker that
contains PR-E2 runs this rollback only while an operator holds the season,
under the season's lease. Otherwise it answers `409` `publication-not-held`
without reaching the publisher. With no ledger bound, which is every
environment today, it answers `503` `reconciliation-unavailable`
(`ledger-unbound`). `mock` and `none` are unchanged. Switching
`PROVIDER_MODE` back to `mock` removes only the hold gate: it restores no
earlier release, and after the first real staging publication D14/C1 refuse a
rollback to the mock baseline (O-15). The procedure is in section 6,
"Reconciliation operator routes and attention line".

## 12. Observability and redaction

The observability helper tails the deployed Worker while it drives a full
public + admin workflow and asserts that every expected structured operation
(`request.completed`, `sync.started`, `sync.completed`, `publication.completed`,
`cache.purge`, `rollback.completed`) is observed, and that **no credential
material** appears in the logs.

```text
npm run check:staging-observability -- https://gridview-api-staging.sejuma18.workers.dev
```

That workflow changes state — it POSTs `/internal/admin/sync/full`,
`/internal/admin/cache/purge` and `/internal/admin/rollback`. The season-2026
reclosure it originally waited on completed on 2026-09-13, and **season 2026
was activated on 2026-09-16**, so its publication and rollback POSTs are now
admitted for that season and run through the sequencer. Do not run it without
the separate authorization a season-2026 mutation requires.

Two hard-won details are baked into the helper:

- **Tail launch (Windows).** The tail is launched by invoking Wrangler's real
  CLI entry point directly — `node --no-warnings node_modules/wrangler/wrangler-dist/cli.js tail <worker> --format json`
  — on every platform. Launching the `.cmd` wrapper through `cmd.exe` fails on
  Windows because Node re-escapes the pre-quoted command line with backslash
  quotes that `cmd.exe` cannot parse; the tail then exits within ~40 ms and
  readiness never confirms.
- **Redaction.** Cloudflare's tail renders request headers with the
  `authorization` value already replaced by `REDACTED` (the real header value,
  and therefore the admin token, never reaches the log stream). The Worker's own
  logger additionally redacts sensitive fields to `[redacted]`. The helper
  distinguishes this benign metadata from real credentials: it walks structured
  log fields and flags only an actual token/`Bearer` value, a non-redacted
  `authorization` field value, `GRIDVIEW_STAGING_ADMIN_TOKEN`, provider
  mappings, stack traces, or internal KV keys. The words `authorization`,
  `unauthorized`, `authorization_failed` and an HTTP `401` are **not** treated
  as leaks. Redaction findings report only a category and structured field
  path — never the matched value.

## 13. Scheduled handler verification

The scheduled handler runs the **same** orchestration as the manual admin sync
(`SynchronizationService.run` → `SnapshotPublisher.publish`), reads KV sync and
quota state, skips when no job is due, updates sync/quota metadata, and — because
`active:{season}` is written only on the full success path — preserves the active
release on any failure. It logs only operational metadata (no token or
authorization material). Scheduled execution cannot reopen admission by
itself: while a `SEASON_PUBLICATION_CUTOVER_CONTROL` naming season 2026 is live
and the sequencer does not yet report the season `active` and authoritative, a
scheduled run's covered publication attempt for season 2026 is rejected by the
same admission guard as the manual endpoint in section 7, exactly as any other
caller's would be. **Since the 2026-09-16 activation, season 2026 is `active`
and authoritative, so a scheduled season-2026 publication is admitted and runs
through the sequencer, never through the legacy pointers** (section 6).

Verify with the local test suite (the safe mechanism — no remote trigger, no
cron change):

```text
npm test -- test/sync/scheduled-handler.test.ts test/sync/synchronization.test.ts
```

Do not trigger the schedule by editing the cron to a high-frequency cadence.

## 14. Workers KV eventual-consistency limitations

Workers KV is eventually consistent and offers no multi-key transaction.
GridView makes publication atomic **from the reader's perspective** by having
public readers select only through `active:{season}` and by writing that pointer
last. Consequences on staging:

- Immediately after a publish or rollback, a given edge location may briefly
  serve the previous `active` pointer until KV propagates (typically seconds).
- A reader must never observe an unpublished version: the version documents are
  written and verified before the pointer flips.
- Admin `sync/status` reflects the authoritative pointer immediately; public
  edge responses may lag by the propagation window. Re-check after a few seconds
  rather than treating a brief stale read as a failure.

## 15. Cache-purge limitations

Publication and rollback compute the affected public URLs from the published
document set and purge only those URLs through the Cache API adapter. Limits:

- Purge covers the URLs GridView derives; it does not guarantee eviction of
  arbitrary downstream/CDN caches outside the Worker's Cache API scope.
- A purge failure is surfaced (`207`) and logged but **never** corrupts or
  reverts the active pointer — correctness does not depend on purge success.
- Clients still revalidate via weak ETags, so a missed purge degrades to a
  revalidation, not stale-forever content.

## 16. Flutter staging run

Point the staging flavor at the deployed Worker's **public** API (no admin token
— the app only ever calls public routes):

```powershell
fvm flutter run --flavor staging `
  --dart-define=APP_ENV=staging `
  --dart-define=API_BASE_URL=https://gridview-api-staging.sejuma18.workers.dev
```

With `API_BASE_URL` set, dev/staging use the real `DioGridViewApi`, not
`FixtureGridViewApi`, so the client "Sample data" banner is **absent** (its
presence would mean fixtures are in use). Staging identity is the flavor itself
(`applicationId com.sejuma.gridview.staging`, version name suffix `-staging`).
The offline/restart checklist is in `docs/testing/README.md`.

## 17. Production prerequisites

Before any production deployment (out of scope for Phase 5B):

- A production KV namespace and its id in `[env.production]`.
- The `ADMIN_TOKEN` production secret.
- A decision on whether Cloudflare Access protects the admin routes.
- The real Formula 1 provider: legal approval, credentials, and `PROVIDER_MODE`
  other than `mock`/`none`.
- A production cache-purge mechanism and, if used, a custom domain / route and
  its DNS.
- Confirmation that no mock override variable is present in production config.
