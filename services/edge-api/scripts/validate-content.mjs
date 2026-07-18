// Validates every curated-content mock file against its JSON Schema 2020-12
// schema. Reports the file, instance path and failing schema path.
//
// Usage: node scripts/validate-content.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { heading, printAjvErrors, summarize } from './lib/report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const contentDir = join(repoRoot, 'content');
const schemasDir = join(contentDir, 'schemas');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

// Load and register every schema (each carries its own $id).
for (const file of readdirSync(schemasDir)) {
  if (!file.endsWith('.schema.json')) continue;
  ajv.addSchema(JSON.parse(readFileSync(join(schemasDir, file), 'utf8')));
}

// The `kind` discriminator in each content file selects its schema.
const kindToSchemaId = {
  'driver-registry':
    'https://gridview.local/schemas/driver-registry.schema.json',
  'constructor-registry':
    'https://gridview.local/schemas/constructor-registry.schema.json',
  'circuit-registry':
    'https://gridview.local/schemas/circuit-registry.schema.json',
  'driver-season-entries':
    'https://gridview.local/schemas/driver-season-entries.schema.json',
  'constructor-season-entries':
    'https://gridview.local/schemas/constructor-season-entries.schema.json',
  'media-assets': 'https://gridview.local/schemas/media-assets.schema.json',
  'provider-mappings':
    'https://gridview.local/schemas/provider-mappings.schema.json',
  overrides: 'https://gridview.local/schemas/overrides.schema.json',
};

function collectJsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectJsonFiles(full));
    } else if (name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

// Content files are every JSON under content/ except the schemas themselves.
const files = collectJsonFiles(contentDir).filter(
  (p) => !p.includes(`${sep}schemas${sep}`),
);

heading('curated content');
let failures = 0;
for (const file of files) {
  const label = relative(repoRoot, file);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const kind = raw.kind;
  const schemaId = kindToSchemaId[kind];
  if (!schemaId) {
    console.error(`FAIL ${label}`);
    console.error(
      `  - (root) unknown or missing "kind": ${JSON.stringify(kind)}`,
    );
    failures += 1;
    continue;
  }
  const validate = ajv.getSchema(schemaId);
  // `$schema` is an editor hint, not domain data; schemas forbid extra keys.
  const data = { ...raw };
  delete data.$schema;
  if (validate(data)) {
    console.log(`ok   ${label}  (${kind})`);
  } else {
    printAjvErrors(label, validate.errors);
    failures += 1;
  }
}

process.exit(summarize('content files', files.length, failures));
