# Curated GridView content

Version-controlled curated data that the edge API merges with provider data:
driver/constructor/circuit registries, season entries, provider-ID mappings,
manual overrides and media metadata.

Structure and schema requirements are defined in
`../docs/technical/GridView_Backend_Scheme.md` (section 6.5). Every change to
curated content must pass JSON-schema validation in CI before deployment.

Status: schemas and initial content are created in Phase 2 of the
Implementation Plan.
