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
  collections render from Drift in a deterministic local order — the provider's
  calendar round for Circuits, and a documented product rule for Drivers and
  Teams, whose season entries carry no delivered order — keep
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
  See
  `docs/technical/GridView_Synchronization.md` §14,
  `docs/technical/GridView_Local_Data.md` §10 and
  `docs/technical/GridView_Navigation.md` §11.
- Phase 7D - Home: done. Home composes the season dashboard from independently
  materialized modules. Module availability comes from **materialization**, never
  from row count: a valid empty result (a season finale with no next race, a
  championship with no confirmed leader) is an honest empty state, never a
  "partial" or an error. A module whose materialization read is still in flight
  renders a neutral unresolved state rather than asserting anything about stored
  data. See `docs/technical/GridView_Synchronization.md` §15.
- Phase 8A - preferences, theming, localization, time display and Settings:
  done (local only; **Phase 8 as a whole is not complete**). Three typed
  persisted preferences (language, theme, time display) each store a stable wire
  token, resolve unknown or corrupted values to a documented safe default, and
  are read synchronously during bootstrap so the first frame already has the
  right theme and language. A full light theme joins the flagship dark one:
  both are produced by one builder from one component configuration, so only the
  palette differs, and every semantic pair is contrast-asserted for both
  palettes. One presentation-time policy (Device/Event/Both) serves every live
  session-time surface; an event zone is never inferred, and a missing one falls
  back to the device clock and is labelled as such. Settings is a secondary
  screen on the root navigator with seven sub-routes, so opening it never changes
  the active branch and back returns to the exact origin. Outside production an
  absent policy URL or contact address is explained; in production the
  affordance is omitted entirely rather than shown as a dead control. See
  `docs/technical/GridView_Preferences_And_Settings.md`.
- Phase 8B - media: **implemented and merged** (PR #1); **live media
  publication is blocked externally.** Persisted media metadata now reaches the product
  through domain-facing read models, a pure size-and-DPR variant selector, a
  strict HTTPS URL policy, one shared bounded disk cache and one reviewed image
  loader, behind a data-agnostic `GvRemoteImage`. The governing rule is that
  **domain data availability is not media availability**: a missing, failed,
  rejected or uncached image never makes Home, Calendar, Explore, Grand Prix or a
  detail screen partial, and image bytes never enter Drift. Media appears only in
  slots the approved design already has, so Calendar rows, standings and results
  stay information-led. On the publication side, a fail-closed rights register
  gates deterministic WebP processing that never upscales and never overwrites an
  immutable object key, with an offline dry-run that needs no credentials.
  **No Formula 1 media rights have been cleared and no R2 media bucket is
  provisioned**, so the approved inventory is empty and no image has been
  published — both are external operational blockers, not defects. See
  `docs/technical/GridView_Media.md`.
- Phase 8C-1 - observability: **implemented and merged** (PR #4). A
  platform-neutral `ErrorReporter`/`PerformanceTracer` boundary with exactly one
  file importing `firebase_*`; Crashlytics and Performance Monitoring activated
  in **production only**; global fatal and allow-listed non-fatal capture;
  selected performance traces; and a fail-closed mapping-upload authorization
  gate asserted by Gradle.
- Phase 8C-2 - external observability verification: **implemented, merged and
  externally verified** (PR #5, 2026-08-16). Controlled signals were observed in
  Firebase Console from a production **debug** pass and from a **release-like**
  pass built from a signed, R8-minified, non-debuggable production release APK.
  Keep the three evidence levels apart — produced locally, accepted by ingestion
  (HTTP 200), observed in Console; only the last is delivery. Phase 8C-2 uploaded
  no mapping or symbol file, built no AAB and published nothing.
- Phase 8C-3 - accessibility, performance and Phase 8 closure: **in progress.**
  Automated accessibility hardening is implemented on the working branch and
  proves the **Flutter semantics and interaction layer only**. TalkBack, Switch
  Access, D-pad hardware, OS-level accessibility, physical-device performance
  measurement, the final reports and Phase 8 closure are **still pending**.
- **Phase 8 as a whole is not closed.**

Home's next-Grand-Prix hero, the Calendar, the Grand Prix detail screen, both
standings tables, the three Explore collections and the Driver, Team and Circuit
detail screens are driven by a **Drift-backed** local store: content renders
immediately from cache (offline included), a refresh writes one atomic snapshot
transaction, and a failed refresh never erases cached content. Settings is
implemented (Phase 8A) and the media pipeline is implemented (Phase 8B): variant
selection, a strict HTTPS URL policy, one shared bounded disk cache and one
reviewed image loader behind a data-agnostic `GvRemoteImage`. Images still
render as placeholders in practice because **no Formula 1 media rights are
approved and no R2 bucket is provisioned**, so nothing has been published —
external operational prerequisites, not missing architecture.

**Firebase is wired and initialized in production only** (Phase 8C-1, verified
in Console in Phase 8C-2): Crashlytics and Performance Monitoring behind a
platform-neutral observability boundary, never awaited before `runApp`, and
degrading to inert on any failure. Dev and staging own no Firebase
configuration and report reporting as off. **No ads SDK, consent SDK, ad unit,
ad request or advertising runtime exists** — advertising is not retained for v1
([ADR 0018](docs/adr/0018-advertising-not-retained-for-v1.md)) — and the
preserved production AdMob **application ID** is inert published-app identity
that nothing reads. **No production provider is wired yet.** Dev/staging builds serve OpenAPI-valid fixtures via an injected fixture API
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
User preferences, the two themes, the presentation-time policy and the Settings
information architecture are documented in
`docs/technical/GridView_Preferences_And_Settings.md`.
The edge API has its own instructions in `services/edge-api/README.md`.

## Release constraints

- The production Android application ID must remain `com.sejuma.gridview`.
- The app must always ship as an update to the existing Google Play listing.
- Release signing credentials live in ignored local files or CI secrets.
  Never commit `.jks`, `.keystore` or `key.properties`.
- Before preparing a release, confirm the highest published `versionCode` in
  Play Console (see `docs/release/play-store-baseline.md`).
