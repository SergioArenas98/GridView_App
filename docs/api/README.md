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

## Data sources and licensing

The contract's `info.description` carries the public licence notice for
provider-derived data ([ADR 0019](../adr/0019-formula-one-provider-legal-gate.md)
decision 5; Provider Evaluation §7.6.2 and §7.6.4). It keeps three things
apart:

- **Data derived from Jolpica F1** is credited to Jolpica F1, linked, and stated
  to remain available under CC BY-NC-SA 4.0 wherever ShareAlike applies, with
  GridView's transformation, normalization and combination disclosed. GridView
  claims no exclusive ownership of it. No GridView runtime retrieves Jolpica F1
  data yet, and the notice says so.
- **GridView's own work** - the application and edge API source code and this
  contract document - is not licensed by that notice.
- **Service controls** such as rate limiting protect GridView's infrastructure
  and are not restrictions on the data licence.

`info.license` deliberately names no single licence, because one label would
either claim the data or license GridView's own work under the data licence;
see [`../../redocly.yaml`](../../redocly.yaml). The notice names the attribution
version of [`../../content/attribution/data-sources.json`](../../content/attribution/data-sources.json),
the same record the app's Acknowledgements screen renders. No response schema
changed, and no per-record provenance is published.
`services/edge-api/test/contract/api-licensing-notice.test.ts` checks the notice
against that record and refuses blanket ownership wording; the provider-neutrality
test still refuses provider names everywhere else in the contract.

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
