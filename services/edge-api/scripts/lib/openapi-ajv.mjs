// Builds an Ajv 2020 instance whose registered root document exposes the
// OpenAPI component schemas, so fixtures can be validated against them.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const OPENAPI_ID = 'gridview://openapi';

export function loadOpenApi() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..', '..', '..', '..');
  const openapiPath = join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml');
  return yaml.load(readFileSync(openapiPath, 'utf8'));
}

/**
 * Returns `{ ajv, ref }` where `ref(name)` yields the resolvable `$ref` string
 * for an OpenAPI component schema.
 */
export function buildOpenApiAjv(openapi) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema({
    $id: OPENAPI_ID,
    components: { schemas: openapi.components.schemas },
  });
  const ref = (name) => `${OPENAPI_ID}#/components/schemas/${name}`;
  return { ajv, ref };
}

/** Compiles a validator for a single named component schema. */
export function compileSchema(ajv, ref, name) {
  return ajv.getSchema(ref(name)) ?? ajv.compile({ $ref: ref(name) });
}

/** Compiles a validator for an array of a named component schema. */
export function compileArraySchema(ajv, ref, name) {
  return ajv.compile({ type: 'array', items: { $ref: ref(name) } });
}
