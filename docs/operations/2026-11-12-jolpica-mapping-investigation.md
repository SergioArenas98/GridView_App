# 2026-11-12 staging Jolpica mapping investigation

Status: offline correction proposal; curation remains blocked. No deployment,
commit, provider request or synchronization was performed for this investigation.
Scope: `Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`.

## Evidence and limits

The operator's verified report of 2026-11-12 records proxy transport, 25 real
Jolpica requests, 25 HTTP 200 responses, no observed HTTP 429, 22 selected
resources and three unavailable resources. Publication was withheld with
`classification-unavailable` and `publishCalls=0`; the reconciliation
observation committed and the lease was released. Production was unchanged;
staging cron triggers remained empty. These are operator-reported observations,
not a capture independently replayed by this investigation.

The report identifies these exact season-2026 Jolpica `driverId` values:

| Provider value   | Existing canonical identity | Decision                       |
| ---------------- | --------------------------- | ------------------------------ |
| `rafael_camara`  | None recorded               | New identity curation required |
| `gabriele_mini`  | None recorded               | New identity curation required |
| `freddie_slater` | None recorded               | New identity curation required |
| `nikola_tsolov`  | None recorded               | New identity curation required |

The canonical driver registry contains 33 identities; the 2026 mappings contain
32 Jolpica driver mappings. Provider Evaluation §8.10 records the September 23
observation and its approved identity decisions. None of these four values or
corresponding names is recorded there, in the registry, or in existing fixtures.
No saved November response bodies or resource-level run diagnostics were found
in this worktree, including ignored evidence/capture files. Private evidence
referenced by older documents was not accessed outside this worktree.

Under the [mapping guide](GridView_Provider_Mapping_Guide.md) §§4–6 and
[ADR 0022](../adr/0022-curated-provider-identifier-mappings.md) D2–D7, a provider
slug is insufficient to establish a canonical name, stable public ID or alias.
In particular, a similar existing name is not evidence of identity.

## Supported content correction

Record the four exact reported keys in
`content/seasons/2026/provider-evidence.development.json`, each with an explicit
`no-canonical-gridview-identity` acknowledgement and this report as provenance.
This records diagnostic evidence only; it does not claim an approved mapping,
captured full name, response hash or curator decision.

Canonical registries, mappings, mock season entries and production code stay
unchanged. An acknowledgement is a blocker, never permission to omit a row.
The resolver still returns `unmapped` and each affected resource fails closed.
The corpus becomes 101 identities, 94 mappings and seven acknowledgements
(four Jolpica drivers and the existing three OpenF1 keys).

`datasetVersion` remains `2026.10.07.1`: this proposal changes evidence only,
not the runtime registry, mappings or published dataset. Issue a new version
when reviewed canonical identities and mappings are actually added. Do not
reserve a future version or infer public IDs in advance.

## Why three resources can fail

The participants port resolves every season driver before requesting
constructors. An unmapped driver fails that entire resource and skips its
constructor request. Driver standings and each race classification separately
resolve every driver and constructor; an unmapped row fails the whole resource.
Thus four distinct unknown keys can affect three resources; key counts do not
equal resource counts.

The reported participants and driver standings failures plus at least one race
classification are consistent with all three unavailable resources. A synthetic
offline proxy regression models 20 selected race rounds plus five season
resources: participants stops after the driver request, yielding 25 HTTP 200
requests, 22 selected resources and three unavailable resources. This proves
the failure pattern is possible, not that these were the actual rounds or rows.

HTTP 200 establishes transport success, not valid normalized data. Decoders run
before mapping; normalization returns mapping failures before some canonical
duplicate checks, event-scope checks and assembled-season validation. Failed
participants also leaves the constructors endpoint unexamined in that run.
Consequently the available evidence cannot prove that fixing these four keys
would eliminate every validation problem.

The publication policy retains all withhold reasons, but its outward cause is
the first ordered reason. `classification-unavailable` precedes
`season-resource-unavailable`; the single reported cause does not imply
participants and standings succeeded.

## Preservation and reconciliation review

- `src/sync/coordinated/policy/publishability.ts` requires every selected
  season resource and classification to be observed and accepted.
- `src/sync/coordinated/outcome/publish.ts` applies that decision before
  preparing a candidate or invoking guarded publication. Successful observations
  may be durably recorded while the whole publication remains withheld.
- `src/sync/coordinated/observation/observe.ts` commits observations under the
  lease and releases it in cleanup. Observation success is not publication success.
- The guarded sequenced publication path enforces ADR 0026 D14 (no removal of
  published classified rounds), D15 (no removal or constructor reassignment of
  published participation facts), and D16 (comparison bound to the authoritative
  predecessor, with stale publication rejected). No guard bypass is proposed.
- The offline proxy regression compares stored documents before and after the
  failed run, checks zero publication writes, and verifies that accepted
  classification state survives the failure. Existing guard tests cover
  destructive candidates and predecessor races.

All source paths above are relative to `services/edge-api`. Existing published
results and participation records remain served; the failed candidate does not
replace them with empty collections or merge a partial result into them.

## Evidence required to finish the correction

1. Existing retained November driver identity evidence tying each exact key to
   the competitor's recorded full name, source, season, observation time and
   endpoint, with capture integrity metadata if available. A raw payload must
   not be committed. Provide a reviewable repository evidence summary.
2. A curator-approved canonical full name and stable public ID for each new
   identity, including diacritics and any alias/duplicate decision. Optional
   facts stay absent unless separately supported.
3. Existing per-resource diagnostics identifying the three unavailable resource
   keys, affected race round and all validation failures, plus retained payloads
   suitable for local replay. These are needed to rule out additional issues;
   aggregate counts and four driver keys cannot do so.
4. After that review: add identities first, exact season-qualified mappings
   second, remove the four acknowledgements, issue a new dataset version, and
   replay the retained evidence offline through decoding, normalization,
   assembly and publication guards.

No new capture, synchronization, infrastructure change or deployment is
authorized by this proposal.

## Exact proposal files

| File                                                                           | Change                                                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `content/seasons/2026/provider-evidence.development.json`                      | Four diagnostic evidence records and four explicit curation blockers; provenance note distinguishes them from approved mappings.         |
| `docs/operations/2026-11-12-jolpica-mapping-investigation.md`                  | This evidence, limitation, safeguard and correction report.                                                                              |
| `docs/operations/GridView_Provider_Mapping_Guide.md`                           | Dated proposal note explaining the new blockers.                                                                                         |
| `docs/technical/GridView_Implementation_Plan.md`                               | Updates the G-l coverage row with the proposal and its seven acknowledgements.                                                           |
| `services/edge-api/test/providers/mappings/driver-dataset-2026.test.ts`        | Pins the four new keys and blocking reasons, preserves all 32 approved mappings and all 33 canonical identities.                         |
| `services/edge-api/test/providers/mappings/constructor-dataset-2026.test.ts`   | Updates corpus totals while preserving the existing OpenF1 decisions and constructor mapping assertions.                                 |
| `services/edge-api/test/providers/mappings/circuit-dataset-2026.test.ts`       | Updates corpus totals and the plan's count assertion while preserving circuit decisions.                                                 |
| `services/edge-api/test/providers/mappings/mapping-acknowledgement.test.ts`    | Checks that all seven acknowledged keys still resolve as unmapped.                                                                       |
| `services/edge-api/test/sync/coordinated/entry-points/proxy-transport.test.ts` | Adds the synthetic 25-response regression and checks publication, stored-document preservation, reconciliation commit and lease release. |

Local diff and safeguard review found no need for production-code changes.
Canonical identity curation and a real-evidence replay remain unresolved; this
proposal is not a claim that the next real synchronization would publish.

## Validation results

All commands ran locally from `services/edge-api` using repository fixtures.

| Check                                                                                        | Result                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`                                                                           | Passed: OpenAPI, 18 content files/semantic checks, 32 API fixtures (including the intentional tolerance-only fixture), and local Worker type generation. Generated Worker types have no diff.                                                                     |
| `npm run typecheck`                                                                          | Passed.                                                                                                                                                                                                                                                           |
| `npm run lint`                                                                               | Passed.                                                                                                                                                                                                                                                           |
| Focused mappings, proxy entry points and sequenced publication guard tests, `--maxWorkers=2` | 18 files, 449 tests passed. Includes the 25 HTTP 200 / 22 selected / three unavailable regression.                                                                                                                                                                |
| Full suite, `--maxWorkers=2 --reporter=dot`                                                  | 262 files passed, one file timed out, three files skipped; 5,815 tests passed, four timed out, six skipped. All four timeouts were the existing frozen-build archive/export cases in `test/season-batch/fixtures-cli.test.mjs`, at the default five-second limit. |
| Isolated `test/season-batch/fixtures-cli.test.mjs --maxWorkers=1 --testTimeout=30000`        | All 37 tests passed, including the four cases above. No assertions or repository timeout settings changed.                                                                                                                                                        |
| Changed TypeScript, evidence JSON, mapping guide and investigation report formatting         | Passed. The implementation plan retains its existing formatting with a one-line coverage change.                                                                                                                                                                  |
| `git diff --check`                                                                           | Passed.                                                                                                                                                                                                                                                           |

The first full run at default parallelism had 47 failed tests, including many
five-second timeouts. The lower-concurrency rerun and isolated export rerun
above supersede it for diagnosis. There was no single all-green full-suite run
at the default timeout; every non-skipped test passed across the final full and
isolated runs. The full rerun log is retained locally as the ignored
`services/edge-api/staging-mapping-tests.log`.

The initial service-wide formatting check flagged only checkout CRLF endings
in `.prettierrc`. They were normalized locally to LF without changing its
content or creating a Git diff.
The final `npm run format` passed for the entire edge service.
