# API contract

This directory holds the GridView API v1 contract:

- `gridview-api-v1.yaml` - OpenAPI 3.1 specification. **The machine-readable
  source of truth** for the wire contract between the Flutter application and the
  edge API.

The human-readable domain vocabulary, identity rules and modelling rationale live
in [`../technical/GridView_Domain_Model.md`](../technical/GridView_Domain_Model.md).
Where the two disagree, the OpenAPI file wins for wire shape (field names, types,
nullability) and the domain model wins for meaning and identity rules.

The contract was created in Phase 2 (Batch 2A) of
[`../technical/GridView_Implementation_Plan.md`](../technical/GridView_Implementation_Plan.md).
It uses the response and error envelopes defined in
[`../technical/GridView_Backend_Scheme.md`](../technical/GridView_Backend_Scheme.md)
sections 11-12.

## Coverage

All 17 v1 endpoints: `status`, `bootstrap`, `home`, season metadata and
current-season, calendar, Grand Prix detail and results, driver and constructor
standings, season and detail views for drivers, constructors and circuits, and
the content manifest.

## Validation

The contract is linted with [Redocly CLI](https://redocly.com/docs/cli). The
ruleset is configured in [`../../redocly.yaml`](../../redocly.yaml) (the public
API is intentionally unauthenticated, so the `security-defined` rule is disabled).

```bash
npx @redocly/cli lint docs/api/gridview-api-v1.yaml
```

## Scope note

Batch 2A delivers the contract and domain documentation only. Curated-content
JSON Schemas, mock fixtures, Worker contract tests and Flutter DTOs are delivered
in Batch 2B.
