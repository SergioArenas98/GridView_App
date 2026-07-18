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

## Fixtures and client models

- Validated API fixtures live in `../../services/edge-api/test/fixtures/api/v1/`
  with a `manifest.json` index; they back both the Worker and Flutter contract
  tests. See `../testing/README.md`.
- Curated-content JSON Schemas and mock data live in `../../content/`.
- Worker contract types and runtime validation: `../../services/edge-api/src/contract/`.
- Flutter DTOs, domain entities and mappers:
  `../../lib/core/api/` and `../../lib/features/shared/`. Regenerate DTO code with
  `dart run build_runner build`.

## Scope note

Batch 2A delivered the contract and domain documentation. Batch 2B added the
curated-content schemas, mock content, API fixtures, Worker contract validation
and Flutter DTOs/entities/mappings. The OpenAPI file remains the source of truth
and may evolve additively.
