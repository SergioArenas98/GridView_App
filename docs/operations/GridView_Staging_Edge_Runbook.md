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
the repo-pinned dependency; invoke it through `npm exec` / the local
`node_modules/.bin` rather than a global install.

## 1. Cloudflare account selection

The project uses a **single** Cloudflare account, so no
`CLOUDFLARE_ACCOUNT_ID` disambiguation is required. Wrangler operates on the
OAuth-authenticated account.

```text
npm exec wrangler whoami
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
| Durable Object bindings | `PROVIDER_RATE_LIMITER`, `SEASON_PUBLICATION_SEQUENCER` — both provisioned 2026-09-12 (version `985115b7-abb3-4346-8845-d8ff41c80cf6`), neither looked up by any deployed code path; see `../technical/GridView_Environments.md` |
| `SEASON_PUBLICATION_CUTOVER_CONTROL` | **Committed: `seed:2026`** — restored by the season-2026 reclosure configuration (PR #24) after the temporary reopening configuration of PR #23 omitted it; see "Temporary season-2026 reopening configuration" in section 6. **Live: `seed:2026`.** It was first deployed on 2026-09-12 from source revision `d3de839a7b297c060e6e4ee7cf1d9974a198be93` (version `00012c06-6c09-4b2f-b24c-02d6e51ec08d`). It was absent only during the separately authorized recovery window on 2026-09-13 (reopening version `38b5169a-6e3b-4e44-aed1-89ef74c0995c`). The reclosure deployment from `549bb5f3f3ee3963727a816b96fa39752355e9cd` restored it the same day as version `c35f99c0-9e89-4dd7-8fbe-449d295fb567` at 100% traffic. Season 2026's legacy publication and rollback admission is **closed**; see "Recovery window record (2026-09-13)" in section 6. Any change to the live value is cutover-sensitive (section 6). `SEASON_PUBLICATION_AUTHORITY` is absent from all of them, so none seeds or activates anything. See [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary). |

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
npm exec wrangler deployments list --env staging
```

## 4. Secrets

`ADMIN_TOKEN` is the only staging secret. Set it interactively so the value is
never echoed, stored in shell history, or passed as a CLI argument:

```text
npm exec wrangler secret put ADMIN_TOKEN --env staging
# paste the value at the interactive prompt
```

List secret **names** (never values) with:

```text
npm exec wrangler secret list --env staging
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
npm exec wrangler deploy --dry-run --env staging
```

The dry-run bundles the Worker and resolves bindings without uploading anything
(`--dry-run: exiting now`). Expected bindings: `GRIDVIEW_DATA` (KV), the
`PROVIDER_RATE_LIMITER` and `SEASON_PUBLICATION_SEQUENCER` Durable Objects,
plus the `ENVIRONMENT`, `PROVIDER_MODE`, `PUBLIC_BASE_URL` and
`SEASON_PUBLICATION_CUTOVER_CONTROL` (`seed:2026`, restored by the prepared
reclosure configuration) vars. A dry-run of the temporary season-2026
reopening configuration (PR #23) shows **no**
`SEASON_PUBLICATION_CUTOVER_CONTROL`, although live staging carries
`seed:2026`; see section 2. **Read the dry-run output, and compare it with the
live version, before proceeding to section 6** — that comparison is how the
cutover-sensitive gate below is checked.

## 6. Deploy staging

There are two kinds of staging deploy, distinguished by comparing
`SEASON_PUBLICATION_CUTOVER_CONTROL` in the section 5 dry-run with the live
version's (read the active version id from
`npm exec wrangler deployments status --env staging`, then
`npm exec wrangler versions view <version-id> --env staging`). An absent var
is a value like any other:

- **Ordinary deployment** — the dry-run and the live version carry the same
  value, or both lack the var. Proceed as a routine deploy.
- **Cutover-sensitive deployment** — the two differ in any way: the dry-run
  adds the var, changes its value, or **omits a var the live version
  carries**. This is **never routine**. Adding `seed:2026` was
  [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary)
  step 1, closing publication and rollback admission for season 2026 in live
  staging before any checkpoint, seed or activation; omitting it — as the
  temporary reopening configuration below does — reopens that admission, and
  restoring it — as the prepared reclosure configuration below does — closes
  it again. Before running the command below in this case, the operator must
  hold explicit, separate authorization naming: the exact control value being
  deployed (or its absence), the season affected (2026), the target
  environment (staging), the reviewed commit being deployed and, for a
  reopening, the bounded recovery window. **Merging a PR — PR #21, the PR that
  prepared the reopening configuration, or any other — does not itself
  authorize this deployment**: the deployment, not the merge, changes
  admission. Without that authorization in hand, stop here; do not run the
  deploy command.

```text
npm exec wrangler deploy --env staging
```

This is a normal deploy — never `--env production`. Record the returned version
id. Confirm the deployment:

```text
npm exec wrangler deployments list --env staging
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

What remains now, in order, each separately authorized:

1. merge the pull request recording the client-baseline evidence;
2. re-run the D12 checkpoint audit;
3. present the exact checkpoint for explicit operator approval;
4. seed only after that approval, under a separate authorization;
5. activate under another authorization;
6. run smoke and latency verification after activation;
7. make any later production decision.

## 7. Initial synchronization and publication

**Not for season 2026 while `SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"`
is live in deployed staging.** Once that deploy has happened, season 2026's
legacy publication admission is closed and this command is rejected for that
season — see [ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary).
This section remains the correct workflow for any season whose admission is
still open (a season not covered by a live cutover control, or before this
control is deployed). For season 2026 after closure, the next authorized step
is the D12 checkpoint and seed sequence, not this endpoint. **Season 2026's
temporary recovery window (section 6) is not such an opening:** there this
endpoint may run only as the single authorized publication, if that
authorization names it.

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
and `/internal/admin/rollback` — so do not run it until the season-2026
reclosure in section 6 is complete. `check:staging-admin` only reads status,
probes rejected methods and purges the cache.

## 11. Rollback workflow

**Not for season 2026 while `SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"`
is live in deployed staging.** Legacy rollback admission for that season is
closed by the same deploy that closes publication admission (section 7) — see
[ADR 0025 D12](../adr/0025-season-publication-authority-and-rollback-republication.md#d12-activation-boundary).
This section remains the correct workflow for any season whose admission is
still open. For season 2026 after closure, the next authorized step is the
D12 checkpoint and seed sequence, not this endpoint. **Not for season 2026
during its temporary recovery window (section 6) either.**

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
`/internal/admin/cache/purge` and `/internal/admin/rollback` — so do not run it
until the season-2026 reclosure in section 6 is complete.

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
authorization material). Scheduled execution cannot reopen admission: while
`SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"` is live, a scheduled run's
covered publication attempt for season 2026 is rejected by the same admission
guard as the manual endpoint in section 7, exactly as any other caller's would
be. Once the temporary reopening configuration in section 6 is deployed, the
next scheduled run **does** publish season 2026; see that subsection.

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
