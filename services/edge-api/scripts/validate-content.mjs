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
import {
  validateEvidenceCoverage,
  validateMappingDocument,
  validateSeasonalDocumentSet,
} from './lib/provider-mapping-rules.mjs';

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
  'media-rights': 'https://gridview.local/schemas/media-rights.schema.json',
  'provider-mappings':
    'https://gridview.local/schemas/provider-mappings.schema.json',
  'provider-evidence':
    'https://gridview.local/schemas/provider-evidence.schema.json',
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
/** Structurally valid documents, kept for the semantic pass below. */
const parsedByKind = new Map();
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
    if (!parsedByKind.has(kind)) parsedByKind.set(kind, []);
    parsedByKind.get(kind).push({ label, data });
  } else {
    printAjvErrors(label, validate.errors);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// Semantic pass.
//
// JSON Schema cannot express composite-key uniqueness, target existence in
// another file, or coverage of the approved evidence corpus. Those rules live
// in ./lib/provider-mapping-rules.mjs and are applied here so there is still
// exactly one content-validation command.
// ---------------------------------------------------------------------------

heading('provider mapping semantics');

const registryIds = {
  driver: collectIds('driver-registry', 'drivers'),
  constructor: collectIds('constructor-registry', 'constructors'),
  circuit: collectIds('circuit-registry', 'circuits'),
};

function collectIds(kind, arrayKey) {
  const ids = new Set();
  for (const { data } of parsedByKind.get(kind) ?? []) {
    for (const entry of data[arrayKey] ?? []) ids.add(entry.id);
  }
  return ids;
}

const mappingDocuments = parsedByKind.get('provider-mappings') ?? [];
const evidenceDocuments = parsedByKind.get('provider-evidence') ?? [];

let semanticChecks = 0;

// One canonical document of each kind per season, paired one-to-one. Checked
// before coverage: a duplicate would otherwise let every document after the
// first bypass the evidence corpus entirely.
const { problems: structureProblems, mappingsBySeason } =
  validateSeasonalDocumentSet(mappingDocuments, evidenceDocuments);

for (const problem of structureProblems) {
  semanticChecks += 1;
  failures += 1;
  console.error(`FAIL ${problem.label}`);
  console.error(`  - (root) ${problem.message}`);
}

if (structureProblems.length === 0) {
  for (const { label, data } of mappingDocuments) {
    semanticChecks += 1;
    const problems = validateMappingDocument(data, registryIds);
    if (problems.length === 0) {
      console.log(`ok   ${label}  (${data.mappings.length} mappings)`);
    } else {
      console.error(`FAIL ${label}`);
      for (const problem of problems) console.error(`  - ${problem}`);
      failures += 1;
    }
  }

  for (const { label, data } of evidenceDocuments) {
    semanticChecks += 1;
    // Safe: uniqueness and pairing were proven above, so exactly one mapping
    // document exists for this season.
    const mapping = mappingsBySeason.get(data.season)[0];
    const problems = validateEvidenceCoverage(data, mapping.data);
    if (problems.length === 0) {
      console.log(
        `ok   ${label}  (${data.identities.length} approved identities, ` +
          `${data.acknowledgedUnmapped.length} acknowledged unmapped)`,
      );
    } else {
      console.error(`FAIL ${label}`);
      for (const problem of problems) console.error(`  - ${problem}`);
      failures += 1;
    }
  }
}

if (semanticChecks === 0) {
  console.log('ok   no provider mapping content present');
}

process.exit(
  summarize('content files', files.length + semanticChecks, failures),
);
