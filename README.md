# GridView

GridView is an Android application for following the Formula 1 season:
calendar, Grand Prix details, circuits, drivers, teams and the Drivers' and
Constructors' Championship standings.

This repository is the GridView monorepo for the complete reconstruction of
the published application. The documents under `docs/` are the source of
truth for the rebuild; see `AGENTS.md` for the non-negotiable constraints.

## Repository structure

```text
/
├── android/            Android project (production applicationId com.sejuma.gridview)
├── assets/             Bundled Flutter assets
├── lib/                Flutter application source
├── services/edge-api/  GridView edge API - Cloudflare Worker, TypeScript
├── content/            Curated, schema-validated GridView content
├── docs/               Product, technical, release, ADR, API, testing and operations docs
├── scripts/            Project scripts
└── .github/workflows/  CI pipelines
```

## Status

Reconstruction per `docs/technical/GridView_Implementation_Plan.md`:

- Phase 1 - repository and project foundation: done.
- Phase 2 - API contract, domain model, fixtures and DTOs: done
  (`docs/api/gridview-api-v1.yaml`, `docs/technical/GridView_Domain_Model.md`).
- Phase 3A - design-system foundation (tokens, theme, shared components,
  component catalogue): done. See `docs/technical/GridView_Design_System.md`.
- Phase 3B - navigation shell and data-independent screen skeletons
  (`go_router`, four-branch state-preserving shell, floating pill navigation,
  validated routes): done. See `docs/technical/GridView_Navigation.md`.
- Phase 4 - first offline-first vertical slice (Home next Grand Prix → Grand
  Prix detail) through Drift + Riverpod + Dio: done. See
  `docs/technical/GridView_Local_Data.md` and
  `docs/technical/GridView_Synchronization.md`.
- Phase 5A - edge API foundation (KV-backed versioned snapshots, active/previous
  pointers, admin sync, publication, rollback, cache purge, scheduled handler):
  done. See `services/edge-api/README.md`.
- Phase 5B - Cloudflare **staging** deployment of the edge API
  (`gridview-api-staging`, mock provider, cron `17 3 * * *` UTC) with live smoke,
  admin-security, rollback and observability/redaction verification: in progress.
  See `docs/operations/GridView_Staging_Edge_Runbook.md`. Production is not
  deployed.
- Phase 6A - complete local data layer on Drift **schema v2** (full v1 domain
  persistence, DAOs, queries and a non-destructive migration): done. See
  `docs/technical/GridView_Local_Data.md`.
- Phase 6B1 - conditional remote client and complete repositories: done. Every
  v1 resource has a typed conditional remote call (`If-None-Match`/`304`/ETags)
  and a domain repository that writes atomically to Drift through a shared
  sync writer, with per-resource refresh deduplication. See
  `docs/technical/GridView_Synchronization.md` §10 and ADRs 0011–0013.
- Phase 6B2 - bootstrap and application synchronization orchestration: done.
  A single `AppSyncCoordinator` owns first-use bootstrap policy, deterministic
  due-resource planning, staged and bounded refreshes, lifecycle-driven
  foreground revalidation, a manual current-season refresh and run cancellation.
  Rendering never waits for the network: the shell and any cached content render
  first, then one post-frame run begins. `GET /v1/bootstrap` is a single
  conditional resource persisted in one transaction, and its ETag is never
  copied onto individual resources. See
  `docs/technical/GridView_Synchronization.md` §11 and ADRs 0014-0015.
- Phase 7A - Calendar and Grand Prix feature implementation: done. The Calendar
  renders the locally resolved current season from Drift in its persisted round
  order, highlights the one relevant event through a rule shared with Home,
  positions the list at it exactly once per branch session, and refreshes only
  when the user asks — through the single application coordinator, never on
  controller creation. Grand Prix detail renders identity, the weekend facts,
  every persisted session in delivered order and the stored sprint/race
  classifications; detail and results are independent on-demand resources, each
  requested at most once per opened route, each keeping its cached content
  through a refresh or a failure. See
  `docs/technical/GridView_Synchronization.md` §12 and
  `docs/technical/GridView_Navigation.md` §9.
- Phase 7B - Drivers' and Constructors' standings: done. Both championship
  tables render from Drift in their delivered `order_index` order — never
  re-sorted, with duplicated and null positions preserved, fractional points
  formatted for the locale and optional statistics never turned into false
  zeroes. They are **independent** resources end to end: separate streams,
  separate metadata, separate ETags, separate freshness and separate failures, so
  one table's problem is never the other's. `/standings` resolves the current
  season locally and opens on Drivers; the explicit season routes render their
  exact season. The selector and both scroll positions are presentation state
  that survives branch switches and detail round trips, and changing the
  selection never issues a request. A refresh happens only when the user asks:
  through the application coordinator for the current season, or through one
  focused request for the exact resource on a historical season route. See
  `docs/technical/GridView_Synchronization.md` §13 and
  `docs/technical/GridView_Navigation.md` §10.
- Phase 7C - Explore, Driver, Team and Circuit: done. Explore is a
  route-addressable category selector (`/explore` opens Drivers;
  `/explore/drivers`, `/explore/teams` and `/explore/circuits` are siblings, so
  switching category replaces the page instead of stacking one). All three
  collections render from Drift in their authoritative local order, keep
  independent scroll positions across category switches, branch switches and
  detail round trips, and **never** issue a request on creation, on a category
  switch or on a rebuild — the only request the screen can produce is a focused
  retry of exactly the selected collection. Driver, Team and Circuit detail
  render local content immediately and trigger **one** on-demand refresh of their
  exact resource, cancellable on dispose and retryable after a failure; opening a
  detail refreshes nothing else. Collection and detail metadata stay isolated
  (no collection ETag is ever reused for a detail, or vice versa), and a
  collection-derived profile renders as an honest **partial** state that claims
  no detail freshness. The season a detail is scoped to travels as typed
  navigation metadata, so a historical Standings route opens that exact season
  while a deep link resolves the current one locally — no year is ever
  hardcoded. Mid-season driver participation keeps both spans, team rebranding
  never rewrites stable identity, the line-up is derived from participation
  entries, and circuit identity stays separate from event properties.
  Unresolved referential stubs remain invisible and never materialize a detail.
  Media is placeholder-only: no remote image request was added. See
  `docs/technical/GridView_Synchronization.md` §14,
  `docs/technical/GridView_Local_Data.md` §10 and
  `docs/technical/GridView_Navigation.md` §11. Phase 7D (Home) is not started.

Home's next-Grand-Prix hero, the Calendar, the Grand Prix detail screen, both
standings tables, the three Explore collections and the Driver, Team and Circuit
detail screens are driven by a **Drift-backed** local store: content renders
immediately from cache (offline included), a refresh writes one atomic snapshot
transaction, and a failed refresh never erases cached content. Home is still a
partial screen pending Phase 7D, and Settings remains a skeleton; real media
downloading is Phase 8. No Firebase, ads or production provider is wired yet. Dev/staging builds serve OpenAPI-valid fixtures via an injected fixture API
only under a deliberate `DATA_SOURCE=fixture` build define (never inferred from a
missing `API_BASE_URL`) and show a "Sample data" banner; **production never
constructs the fixture source** — an attempted fixture mode or a missing base URL
is a controlled configuration failure. A
**development-only** component catalogue is reachable from **Settings → Developer**
in dev/staging builds (never production).

## Development setup

1. Install [FVM](https://fvm.app): `dart pub global activate fvm`
2. Install the pinned Flutter SDK: `fvm install`
3. Run the app: `fvm flutter run --flavor dev --dart-define=APP_ENV=development --dart-define=DATA_SOURCE=fixture`
   (no Worker needed — the deliberate `DATA_SOURCE=fixture` serves the bundled
   `assets/dev_fixtures/*`; see `docs/technical/GridView_Environments.md`)
4. Run checks: `fvm flutter analyze && fvm flutter test`

The Drift-backed local-development flow — running against the bundled fixtures or
an explicit `API_BASE_URL`, simulating offline/stale, and clearing the local
database — is documented in `docs/technical/GridView_Synchronization.md` §9.
Flavors, environment defines, Firebase/AdMob state and the edge API
environments are documented in `docs/technical/GridView_Environments.md`.
The edge API has its own instructions in `services/edge-api/README.md`.

## Release constraints

- The production Android application ID must remain `com.sejuma.gridview`.
- The app must always ship as an update to the existing Google Play listing.
- Release signing credentials live in ignored local files or CI secrets.
  Never commit `.jks`, `.keystore` or `key.properties`.
- Before preparing a release, confirm the highest published `versionCode` in
  Play Console (see `docs/release/play-store-baseline.md`).
