# Automatic qualifying updates: what exists and what is missing

Read from the code on 2026-11-23 (`feat/jolpica-egress-proxy`). Automatic
updates (ADR 0028) cover **race results only** (D12). No part of the pipeline
fetches, stores, publishes or displays qualifying classifications. The calendar
already publishes qualifying and sprint-qualifying **start times**, because they
are part of the weekend schedule.

## Where it stops today

| Layer               | Today                                                                                                                                                                               | File                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Proxy allowlist     | Only `/{season}/{round}/results/` per round. A `/qualifying/` request is refused before it reaches Jolpica                                                                          | `services/jolpica-proxy/src/policy.mjs`                                                     |
| Provider port       | `resource-unsupported` for every session except the race, before any reservation                                                                                                    | `services/edge-api/src/providers/jolpica/results-port.ts`                                   |
| Planner and ledger  | `session-classification` requests are built with `sessionType: 'race'` only. The slot plan (D5), revisions and settling are race-only                                               | `src/sync/coordinated/policy/planner.ts`, `policy/classification.ts`, `ledger/`             |
| Contract            | `RaceResultEntry` has position, grid, points, status, laps and times. It has no Q1/Q2/Q3 times or elimination stage                                                                 | `src/contract/types.ts`                                                                     |
| Generator and guard | `grand-prix:{round}:results` holds the race classification only. The D14-D16 guard protects classified race rounds and participation facts                                          | `src/snapshots/`, `src/publication/`                                                        |
| App                 | `RaceResults` is unique per `(grandPrixId, sessionType)` and could hold another session type. It has no qualifying columns or screen, and the installed 2.0.0 build cannot show one | `lib/core/database/result_tables.dart`, `lib/features/shared/data/remote/gridview_api.dart` |

## The smallest correct extension

All seven parts are needed before qualifying can honestly be described as
automatic:

1. **Proxy:** allow `^/ergast/f1/{season}/{round}/qualifying/?limit=100$`,
   add a test and redeploy the VPS service (owner SSH).
2. **Source:** a qualifying port that decodes Jolpica's `QualifyingTable`
   (position, driver, constructor, Q1/Q2/Q3) with the same deep validation:
   complete page, contiguous positions, and every driver resolved through the
   pinned runtime catalog. An unmapped driver withholds, as for races.
3. **Contract:** a separate resource,
   `GET /v1/seasons/{season}/grand-prix/{round}/qualifying` (`QualifyingResult`
   with entries `{position, driverId, constructorId, q1Millis, q2Millis,
q3Millis}`), added to the OpenAPI, the validator and the manifest. A separate
   resource is safer than reusing `RaceResultEntry`, because it leaves
   unchanged the `/results` shape the installed 2.0.0 app already parses.
4. **Ledger and cadence:** a qualifying classification record with its own
   slot plan (first check at qualifying start + 90 min, hourly through + 10 h
   30 min, then the D5 back-off) and its own revision and settling. This
   changes the ledger schema, so it needs a migration test over the live
   staging and production ledger state.
5. **Publication:** the run includes due qualifying rounds. The D14-D16 guard
   extends to qualifying facts. The request budget grows by at most one per
   unsettled qualifying round per run.
6. **App:** a schema migration (a qualifying table or columns), the DTO and
   parser, the repository, a "Qualifying" section on the Grand Prix screen,
   goldens, and a new Play release. Until users install it, qualifying data
   published by the API is invisible to them.
7. **Verification:** gate tests (late, missing, corrected, unmapped), a staging
   rehearsal and a staging soak, as was done for races.

Sprint and sprint-qualifying classifications are not part of this extension.

## Timing

Two 2026 weekends remain: Qatar (round 22, qualifying 2026-11-28) and Abu
Dhabi (round 23). Steps 1-5 are server work on the same guarded path as races.
Step 6 needs a Play review. Qualifying cannot reach users' devices this season
without an app release, so the realistic target is the 2027 season opener, with
the server half able to ship earlier and stay invisible until the app supports
it.
