// Validates every API fixture against the OpenAPI contract, checks the metadata
// variant (BaseMeta / SnapshotMeta / SeasonSnapshotMeta), confirms error
// fixtures use the error envelope, and enforces that no provider ID leaks into a
// public fixture. Driven by the fixture manifest.
//
// Usage: node scripts/validate-fixtures.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

import { heading, printAjvErrors, summarize } from './lib/report.mjs';
import {
  loadOpenApi,
  buildOpenApiAjv,
  compileSchema,
  compileArraySchema,
} from './lib/openapi-ajv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const fixturesRoot = join(here, '..', 'test', 'fixtures', 'api', 'v1');
const manifestPath = join(fixturesRoot, 'manifest.json');

const openapi = loadOpenApi();
const { ajv, ref } = buildOpenApiAjv(openapi);

const metaValidators = {
  BaseMeta: compileSchema(ajv, ref, 'BaseMeta'),
  SnapshotMeta: compileSchema(ajv, ref, 'SnapshotMeta'),
  SeasonSnapshotMeta: compileSchema(ajv, ref, 'SeasonSnapshotMeta'),
};
const errorValidator = compileSchema(ajv, ref, 'ErrorEnvelope');

const PROVIDER_ID_VALUE = /^mock-(drv|con|cir)-\d+$/;

/** Returns human-readable paths where a provider ID leaked into a fixture. */
function findProviderIdLeaks(value, path = '') {
  const leaks = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) =>
      leaks.push(...findProviderIdLeaks(item, `${path}[${i}]`)),
    );
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'providerId' || key === 'providerIds') {
        leaks.push(`${path}.${key}`);
      }
      leaks.push(...findProviderIdLeaks(child, `${path}.${key}`));
    }
  } else if (typeof value === 'string' && PROVIDER_ID_VALUE.test(value)) {
    leaks.push(`${path} (= "${value}")`);
  }
  return leaks;
}

function dataValidator(entry) {
  return entry.dataKind === 'array'
    ? compileArraySchema(ajv, ref, entry.data)
    : compileSchema(ajv, ref, entry.data);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Guard against orphan fixtures that are on disk but not in the manifest.
function collectFixtureFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectFixtureFiles(full));
    else if (name.endsWith('.json') && name !== 'manifest.json') out.push(full);
  }
  return out;
}
const listed = new Set(
  manifest.map((e) => join(fixturesRoot, e.file.split('/').join(sep))),
);
const orphans = collectFixtureFiles(fixturesRoot).filter((f) => !listed.has(f));

heading('api fixtures');
let failures = 0;
let conforming = 0; // validate cleanly against strict OpenAPI
let toleranceOnly = 0; // expectValid:false — MUST fail strict OpenAPI (unknown enum, etc.)

for (const entry of manifest) {
  const file = join(fixturesRoot, entry.file.split('/').join(sep));
  const label = relative(repoRoot, file);
  let body;
  try {
    body = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.error(`FAIL ${label}\n  - cannot read/parse fixture`);
    failures += 1;
    continue;
  }

  const leaks = findProviderIdLeaks(body);
  if (leaks.length > 0) {
    console.error(`FAIL ${label}`);
    for (const leak of leaks)
      console.error(`  - provider ID leaked at ${leak}`);
    failures += 1;
    continue;
  }

  const expectValid = entry.expectValid !== false;
  let ok;
  let validator;

  if (entry.type === 'error') {
    validator = errorValidator;
    ok = validator(body);
  } else if (entry.type === 'entity') {
    validator = dataValidator(entry);
    ok = validator(body);
  } else {
    // envelope: validate data and meta independently.
    validator = dataValidator(entry);
    const dataOk = validator(body?.data);
    const metaValidate = metaValidators[entry.meta];
    const metaOk = metaValidate ? metaValidate(body?.meta) : false;
    ok = dataOk && metaOk;
    if (!metaValidate) {
      console.error(`FAIL ${label}\n  - unknown meta schema "${entry.meta}"`);
      failures += 1;
      continue;
    }
    if (expectValid && !metaOk) {
      printAjvErrors(`${label} (meta ${entry.meta})`, metaValidate.errors);
    }
  }

  if (ok === expectValid) {
    if (expectValid) {
      conforming += 1;
    } else {
      toleranceOnly += 1;
    }
    const tag = expectValid ? 'ok  ' : 'ok* ';
    console.log(
      `${tag} ${label}  (${entry.data ?? 'error'}${entry.note ? ' - ' + entry.note : ''})`,
    );
  } else if (expectValid) {
    printAjvErrors(label, validator.errors);
    failures += 1;
  } else {
    console.error(
      `FAIL ${label}\n  - expected contract violation but fixture validated`,
    );
    failures += 1;
  }
}

if (orphans.length > 0) {
  heading('orphan fixtures (not in manifest)');
  for (const f of orphans) {
    console.error(
      `FAIL ${relative(repoRoot, f)} is not listed in manifest.json`,
    );
    failures += 1;
  }
}

console.log(
  `  ${conforming} conform to OpenAPI, ${toleranceOnly} tolerance-only (expected to fail strict validation, e.g. unknown enum token)`,
);
process.exit(summarize('fixtures', manifest.length, failures));
