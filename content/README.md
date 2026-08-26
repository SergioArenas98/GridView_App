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
│   ├── provider-mappings.schema.json   (INTERNAL: curated provider-ID mappings)
│   ├── provider-evidence.schema.json   (INTERNAL: approved provider-ID corpus)
│   └── overrides.schema.json
├── registries/        stable identities (drivers, constructors, circuits)
├── seasons/2026/      season entries, provider mappings, provider evidence, overrides
└── media/             media asset metadata
```

Each content file carries a `kind` discriminator that selects its schema, an
optional `$schema` editor hint, and a `status` of `mock` or `development`.

## Rules

- Curated source files set `additionalProperties: false`; add a field to the
  schema before adding it to data.
- Public IDs are lowercase ASCII kebab-case; `countryCode` is uppercase ISO
  3166-1 alpha-2.
- Provider identifiers appear **only** in `provider-mappings.*.json` and
  `provider-evidence.*.json`. They must never appear in a public API fixture or
  response. See `../docs/operations/GridView_Provider_Mapping_Guide.md`.
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

## Provider-identifier mapping registry

`seasons/<year>/provider-mappings.development.json` (`kind: provider-mappings`)
maps an **exact** provider identifier to a GridView public ID that already
exists in one of the curated registries. It is **internal**, and it is
**dormant**: no provider adapter exists, so nothing consumes it at runtime.

A mapping is keyed on five things together — season, source (`jolpica` or
`openf1`), entity kind, exact provider field and exact provider value — and is
matched by exact typed equality. Nothing is trimmed, case-folded, slugged,
transliterated or fuzzy-matched, and integer `1` is never string `"1"`. There
is no `mock` source: the mock provider emits GridView-owned identities and must
not have a mapping.

`seasons/<year>/provider-evidence.development.json` (`kind: provider-evidence`)
records every provider identity this repository already has evidence for.
`npm run validate:content` fails unless each one is either mapped or explicitly
acknowledged as unmapped with a written reason, so a coverage gap is always
visible and a mapping can never be invented for a value the repository never
recorded.

The document envelope is checked at runtime as well as by the schema: the
resolver accepts only `kind: provider-mappings` with `schemaVersion: 2`.
Version 1 was an incompatible per-provider grouped shape carrying opaque mock
identifiers, so an unknown, missing or older version fails closed rather than
being partially interpreted.

Construction is all-or-nothing: a duplicate, ambiguous, dangling or malformed
record means **no** index is exposed, not a partially usable one. Adding a
mapping never creates, renames or repoints a public ID — if no canonical
identity exists yet, add it to the registry first.

Every mapping carries an `evidence` note pointing inside this repository. As
with the media-rights register, **never commit a contract, a credential, a
confidential document or a raw provider payload.**

Procedure, including how to read an unmapped-identity signal:
`../docs/operations/GridView_Provider_Mapping_Guide.md`. Decision and
rationale: `../docs/adr/0022-curated-provider-identifier-mappings.md`.
