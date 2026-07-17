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

Phase 1 (repository and project foundation) of
`docs/technical/GridView_Implementation_Plan.md` is in progress. The Flutter
source currently at the root is the sanitized legacy application; it will be
replaced by the reconstructed app shell during this phase. Setup
instructions (FVM pin, flavors, CI) arrive with the Flutter baseline work.

## Release constraints

- The production Android application ID must remain `com.sejuma.gridview`.
- The app must always ship as an update to the existing Google Play listing.
- Release signing credentials live in ignored local files or CI secrets.
  Never commit `.jks`, `.keystore` or `key.properties`.
- Before preparing a release, confirm the highest published `versionCode` in
  Play Console (see `docs/release/play-store-baseline.md`).
