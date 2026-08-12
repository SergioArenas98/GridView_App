# Curated GridView content

Version-controlled curated data that the edge API will merge with provider data.
All files here are **non-authoritative development mock data** and are marked
`"status": "mock"`. They exist to back the contract fixtures and tests; they are
not an official Formula 1 dataset and must not be presented as authoritative.

## Layout

```text
content/
├── schemas/           JSON Schema 2020-12 (source of truth for content shape)
│   ├── common.schema.json          shared $defs: ids, country codes, dates, media
│   ├── driver-registry.schema.json
│   ├── constructor-registry.schema.json
│   ├── circuit-registry.schema.json
│   ├── driver-season-entries.schema.json
│   ├── constructor-season-entries.schema.json
│   ├── media-assets.schema.json
│   ├── provider-mappings.schema.json   (INTERNAL: provider IDs live only here)
│   └── overrides.schema.json
├── registries/        stable identities (drivers, constructors, circuits)
├── seasons/2026/      season entries, provider mappings, overrides
└── media/             media asset metadata
```

Each content file carries a `kind` discriminator that selects its schema, an
optional `$schema` editor hint, and a `status` of `mock` or `development`.

## Rules

- Curated source files set `additionalProperties: false`; add a field to the
  schema before adding it to data.
- Public IDs are lowercase ASCII kebab-case; `countryCode` is uppercase ISO
  3166-1 alpha-2.
- Provider identifiers appear **only** in `provider-mappings.*.json`. They must
  never appear in a public API fixture or response.
- Optional values stay `null` or absent — never substitute `0` or `""`.

## Validation

Run from `services/edge-api` (ajv, JSON Schema 2020-12):

```bash
npm run validate:content
```

CI runs this via `npm run validate`. Failures report the file, instance path and
failing schema path.

Model and identity rules: `../docs/technical/GridView_Domain_Model.md`.

## Media rights register

`media/media-rights.json` (`kind: media-rights`) is the **authoritative approved
inventory** the publication gate reads, and it is deliberately **empty**: no
Formula 1 media rights have been cleared for GridView.

Because the gate fails closed, an empty inventory means nothing can be processed,
uploaded or referenced from a manifest. That is the intended behaviour, not a gap
to work around — **do not add a record here to make a build or a test pass.**
Automated tests use synthetic records built inside the test run, outside
`content/` entirely.

A record belongs here only once a real permission exists and is recorded outside
this repository. The register captures the *existence* of a permission and a
reference to where the signed record is held; it never contains a contract, a
credential or a confidential document. No image binary is committed under
`content/` at all, and CI asserts that.

`media/media-assets.mock.json` remains non-authoritative development data on a
non-routable `.local` host, and is never a publication source.

See `../docs/technical/GridView_Media.md`.
