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

The app still ships as an offline reconstruction shell (no Firebase, ads,
backend, Drift or provider integration yet). A **development-only** component
catalogue is reachable from the shell in dev/staging builds (never production).

## Development setup

1. Install [FVM](https://fvm.app): `dart pub global activate fvm`
2. Install the pinned Flutter SDK: `fvm install`
3. Run the app: `fvm flutter run --flavor dev --dart-define=APP_ENV=development`
4. Run checks: `fvm flutter analyze && fvm flutter test`

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
