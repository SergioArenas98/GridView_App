import schemas from './content-schemas.cjs';
import spec from './source-spec.json';
import {
  validateRegistryDocumentSet,
  validateSeasonalDocumentSet,
  validateMappingDocument,
  validateEvidenceCoverage,
} from './rules/provider-mapping-rules.mjs';
import { validateDriverSeasonEntries } from './rules/driver-entry-rules.mjs';
import { canonicalJson, sha256Hex, utf8 } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { buildProviderMappingRegistry } from '../../providers/mappings/mapping-registry';
import {
  requireCatalog,
  catalogLimits,
  type Json,
  type Document,
  type RepositorySource,
} from './model';

export function boundedJson(input: unknown): Json {
  let nodes = 0,
    size = 0;
  const visit = (v: unknown, depth: number): Json => {
    requireCatalog(++nodes <= 200000 && depth <= 32, 'structure-limit');
    if (typeof v === 'string') {
      size += utf8(v).length;
      requireCatalog(size <= catalogLimits.exportBytes, 'byte-limit');
      return v;
    }
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      requireCatalog(Number.isFinite(v), 'number');
      return v;
    }
    requireCatalog(typeof v === 'object' && v !== null, 'json-type');
    requireCatalog(
      Array.isArray(v) ||
        Object.getPrototypeOf(v) === Object.prototype ||
        Object.getPrototypeOf(v) === null,
      'prototype',
    );
    requireCatalog(Object.getOwnPropertySymbols(v).length === 0, 'symbol');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (Array.isArray(v)) {
      requireCatalog(
        v.length <= 100000 && Object.keys(descriptors).length === v.length + 1,
        'array',
      );
      return Array.from({ length: v.length }, (_, i) => {
        const d = descriptors[String(i)];
        requireCatalog(d && 'value' in d, 'accessor');
        return visit(d.value, depth + 1);
      });
    }
    const out: Document = {};
    for (const [k, d] of Object.entries(descriptors)) {
      requireCatalog(
        !['__proto__', 'constructor', 'prototype'].includes(k) &&
          d.enumerable &&
          'value' in d,
        'property',
      );
      size += utf8(k).length;
      out[k] = visit(d.value, depth + 1);
    }
    return out;
  };
  const result = visit(input, 0);
  requireCatalog(
    utf8(canonicalJson(result)).length <= catalogLimits.exportBytes,
    'byte-limit',
  );
  return result;
}
export function object(v: unknown): asserts v is Document {
  requireCatalog(
    v !== null && typeof v === 'object' && !Array.isArray(v),
    'object',
  );
}
export function records(v: unknown): Document[] {
  requireCatalog(Array.isArray(v), 'records');
  v.forEach(object);
  return v;
}
export function exact(v: unknown, keys: string[]): asserts v is Document {
  object(v);
  requireCatalog(
    Object.keys(v).sort().join('\0') === keys.sort().join('\0'),
    'closed-shape',
  );
}
export function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
export async function validateSources(
  input: unknown,
): Promise<{ sources: RepositorySource[]; documents: Map<string, Document> }> {
  const values = boundedJson(input);
  requireCatalog(
    Array.isArray(values) && values.length === Object.keys(spec).length,
    'complete-source-set',
  );
  const sources: RepositorySource[] = [],
    documents = new Map<string, Document>();
  for (const v of values) {
    exact(v, [
      'path',
      'text',
      'fileHash',
      'semanticHash',
      'documentVersion',
      'sourceStatus',
      'exactCommit',
      'baseCommit',
    ]);
    requireCatalog(
      typeof v.path === 'string' &&
        Object.hasOwn(spec, v.path) &&
        !sources.some((s) => s.path === v.path),
      'source-path',
    );
    requireCatalog(
      typeof v.text === 'string' &&
        typeof v.baseCommit === 'string' &&
        /^[a-f0-9]{40}$/.test(v.baseCommit),
      'source-provenance',
    );
    requireCatalog(
      v.exactCommit === null || v.exactCommit === v.baseCommit,
      'source-commit',
    );
    requireCatalog(
      v.fileHash === 'sha256:' + (await sha256Hex(utf8(v.text))),
      'source-byte-hash',
    );
    const document: unknown = JSON.parse(v.text);
    object(document);
    requireCatalog(
      v.semanticHash === (await hashIdentityProjection(document)),
      'source-semantic-hash',
    );
    requireCatalog(
      v.documentVersion ===
        (document.schemaVersion ?? document.datasetVersion ?? null) &&
        v.sourceStatus === document.status,
      'source-version',
    );
    const kind = spec[v.path as keyof typeof spec];
    const { $schema: hint, ...domain } = document;
    requireCatalog(
      hint === undefined || typeof hint === 'string',
      'schema-hint',
    );
    requireCatalog(
      schemas[kind.replaceAll('-', '_')]!(domain),
      'source-schema',
    );
    requireCatalog(
      document.kind === kind && !documents.has(kind),
      'source-kind',
    );
    if (v.path.includes('/2026/'))
      requireCatalog(document.season === 2026, 'source-season');
    sources.push(v as unknown as RepositorySource);
    documents.set(kind, domain);
  }
  const ids: Record<string, ReadonlySet<string>> = {};
  for (const entity of ['driver', 'constructor', 'circuit', 'event']) {
    const kind = entity + '-registry',
      d = documents.get(kind)!;
    const result = validateRegistryDocumentSet(
      kind,
      entity === 'driver' ? 'drivers' : entity + 's',
      [{ label: kind, data: d }],
    );
    requireCatalog(result.problems.length === 0, 'registry-completeness');
    ids[entity] = result.ids;
  }
  const mapping = documents.get('provider-mappings')!,
    evidence = documents.get('provider-evidence')!;
  requireCatalog(
    validateSeasonalDocumentSet(
      [{ label: 'mapping', data: mapping }],
      [{ label: 'evidence', data: evidence }],
    ).problems.length === 0,
    'season-pairing',
  );
  requireCatalog(validateMappingDocument(mapping, ids).length === 0, 'mapping');
  requireCatalog(
    validateEvidenceCoverage(evidence, mapping).length === 0,
    'evidence-coverage',
  );
  requireCatalog(
    buildProviderMappingRegistry(
      [mapping],
      ids as unknown as Parameters<typeof buildProviderMappingRegistry>[1],
    ).isValid,
    'resolver',
  );
  requireCatalog(
    validateDriverSeasonEntries(documents.get('driver-season-entries'))
      .length === 0,
    'driver-season-entries',
  );
  for (const kind of ['driver-season-entries', 'constructor-season-entries'])
    for (const row of records(documents.get(kind)!.entries)) {
      requireCatalog(
        row.season === 2026 &&
          (row.driverId === undefined ||
            ids.driver!.has(row.driverId as string)) &&
          (row.constructorId === null ||
            row.constructorId === undefined ||
            ids['constructor']!.has(row.constructorId as string)),
        'entry-reference',
      );
    }
  const meta = documents.get('season-metadata')!;
  requireCatalog(
    meta.datasetVersion === '2026.10.07.1',
    'seed-dataset-version',
  );
  requireCatalog(
    ids.driver!.size === 33 &&
      ids['constructor']!.size === 11 &&
      ids.circuit!.size === 24 &&
      ids.event!.size === 23 &&
      records(mapping.mappings).length === 94 &&
      records(evidence.identities).length === 101 &&
      records(evidence.acknowledgedUnmapped).length === 7,
    'R0-corpus-counts',
  );
  sources.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { sources, documents };
}
