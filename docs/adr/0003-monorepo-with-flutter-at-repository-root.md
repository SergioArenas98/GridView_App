# ADR 0003: Monorepo with Flutter at the repository root

- Status: Accepted
- Date: 2026-07-18

## Context

The reconstruction needs the Flutter application, the edge API, curated
content, documentation and CI in one repository. The existing Android
application identity and signing configuration are associated with the
current Flutter project, so deep path changes carry risk.
`docs/technical/GridView_TRD.md` (section 6) defines the target layout.

## Decision

Use a single monorepo with the Flutter project at the repository root:

```text
/
├── android/            Android project (applicationId com.sejuma.gridview)
├── assets/             Bundled Flutter assets
├── lib/                Flutter source
├── services/edge-api/  Cloudflare Worker (TypeScript)
├── content/            Curated, schema-validated GridView content
├── docs/               Product, technical, release, ADR, API, testing, operations docs
├── scripts/            Project scripts
└── .github/workflows/  CI pipelines
```

The legacy `/frontend` and `/backend` directories were dissolved: Flutter
moved to the root and the legacy backend was deleted (see ADR 0002).

## Consequences

- Standard Flutter tooling works from the repository root without wrapper
  configuration.
- The edge API and curated content are versioned alongside the app.
- Git history was rewritten during the restructure; the pre-rewrite state is
  archived locally outside the repository.
