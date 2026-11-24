import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import {
  catalogLimits,
  requireCatalog,
  type RepositorySource,
  type SeedArtifact,
} from './model';
import { boundedJson, freeze, records, validateSources } from './sources';
import { deriveSnapshot } from './snapshot';

export async function prepareSeed(
  input: readonly Omit<RepositorySource, 'semanticHash'>[],
): Promise<SeedArtifact> {
  const copy = records(boundedJson(input));
  const enriched = await Promise.all(
    copy.map(async (s) => {
      requireCatalog(typeof s.text === 'string', 'source-text');
      return {
        ...s,
        semanticHash: await hashIdentityProjection(JSON.parse(s.text)),
      };
    }),
  );
  const { sources, documents } = await validateSources(enriched);
  const snapshot = await deriveSnapshot(sources, documents);
  const seed: SeedArtifact = {
    format: 'gridview-identity-seed/1',
    catalogSchemaVersion: 1,
    state: 'prepared-unactivated',
    revisionId: null,
    sequence: 0,
    parentRevisionId: null,
    contentHash: await hashIdentityProjection(snapshot),
    snapshotByteLength: utf8(canonicalJson(snapshot)).length,
    sources,
    snapshot,
  };
  requireCatalog(
    utf8(canonicalJson(seed)).length <= catalogLimits.exportBytes,
    'export-capacity',
  );
  return freeze(seed);
}
